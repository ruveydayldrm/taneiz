"""timm ile transfer learning (EfficientNet-B0 varsayılan, MobileNetV3 seçeneği).

Colab T4 üzerinde varsayılan ayarlar (12 epoch, 224 px, sınıf başına en fazla 4000 görüntü)
1 saatin altında biter. En iyi model doğrulama macro-F1'e göre seçilir.

    python ml/train.py --model efficientnet_b0 --epochs 12
    python ml/train.py --model mobilenetv3_large_100 --epochs 15
"""
from __future__ import annotations

import argparse
import json
import math
import time
from collections import Counter
from pathlib import Path

import numpy as np
import timm
import torch
import torch.nn as nn
from sklearn.metrics import f1_score
from torch.utils.data import DataLoader
from tqdm import tqdm

from common import ARTIFACTS_DIR, CLASSES, IMAGENET_MEAN, IMAGENET_STD, PREPROCESS_VERSION, RAW_DIR, SPLITS_DIR
from dataset import GrainDataset, build_transforms


def class_weights(targets: list[int], n: int) -> torch.Tensor:
    counts = Counter(targets)
    w = np.array([len(targets) / (n * counts[i]) if counts.get(i) else 0.0 for i in range(n)], dtype=np.float32)
    return torch.tensor(w / w[w > 0].mean())


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    ys, ps = [], []
    for x, y in loader:
        with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
            logits = model(x.to(device, non_blocking=True))
        ps += logits.argmax(1).cpu().tolist()
        ys += y.tolist()
    ys, ps = np.array(ys), np.array(ps)
    return {"accuracy": float((ys == ps).mean()), "macro_f1": float(f1_score(ys, ps, average="macro", zero_division=0))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="efficientnet_b0")
    ap.add_argument("--epochs", type=int, default=12)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--max-per-class", type=int, default=4000, help="Süreyi sınırlamak için (0 = sınırsız)")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--splits", type=Path, default=SPLITS_DIR)
    ap.add_argument("--out", type=Path, default=ARTIFACTS_DIR)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Cihaz: {device}")

    report_file = args.splits / "report.json"
    classes = json.loads(report_file.read_text(encoding="utf-8")).get("classes", CLASSES) if report_file.exists() else CLASSES
    print(f"Sınıflar: {classes}")

    train_ds = GrainDataset(
        args.splits / "train.csv", args.raw_dir, build_transforms(args.img_size, True), classes, args.max_per_class or None, args.seed
    )
    val_ds = GrainDataset(args.splits / "val.csv", args.raw_dir, build_transforms(args.img_size, False), classes)
    print(f"Eğitim: {len(train_ds)}  Doğrulama: {len(val_ds)}")

    train_dl = DataLoader(train_ds, args.batch_size, shuffle=True, num_workers=args.workers, pin_memory=True, drop_last=True, persistent_workers=args.workers > 0)
    val_dl = DataLoader(val_ds, args.batch_size * 2, num_workers=args.workers, pin_memory=True)

    model = timm.create_model(args.model, pretrained=True, num_classes=len(classes)).to(device)
    weights = class_weights(train_ds.targets, len(classes)).to(device)
    print("Sınıf ağırlıkları:", {c: round(float(w), 2) for c, w in zip(classes, weights)})
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    total = args.epochs * len(train_dl)
    warmup = len(train_dl)
    scheduler = torch.optim.lr_scheduler.LambdaLR(
        optimizer, lambda s: (s + 1) / warmup if s < warmup else 0.5 * (1 + math.cos(math.pi * (s - warmup) / max(1, total - warmup)))
    )
    scaler = torch.cuda.amp.GradScaler(enabled=device.type == "cuda")

    args.out.mkdir(parents=True, exist_ok=True)
    best, history, t0 = -1.0, [], time.time()
    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        for x, y in tqdm(train_dl, desc=f"epoch {epoch}/{args.epochs}", leave=False):
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, enabled=device.type == "cuda"):
                loss = criterion(model(x), y)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            running += loss.item()
        val = evaluate(model, val_dl, device)
        rec = {"epoch": epoch, "train_loss": running / len(train_dl), **val}
        history.append(rec)
        flag = ""
        if val["macro_f1"] > best:
            best = val["macro_f1"]
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "model_name": args.model,
                    "classes": classes,
                    "preprocessing": PREPROCESS_VERSION,
                    "img_size": args.img_size,
                    "mean": IMAGENET_MEAN,
                    "std": IMAGENET_STD,
                    "epoch": epoch,
                    "val": val,
                },
                args.out / "model.pt",
            )
            flag = "  ← en iyi"
        print(f"epoch {epoch:>2}  loss {rec['train_loss']:.4f}  val acc {val['accuracy']:.4f}  val macro-F1 {val['macro_f1']:.4f}{flag}")

    minutes = (time.time() - t0) / 60
    (args.out / "training.json").write_text(
        json.dumps(
            {
                "model_name": args.model,
                "epochs": args.epochs,
                "batch_size": args.batch_size,
                "lr": args.lr,
                "img_size": args.img_size,
                "max_per_class": args.max_per_class,
                "train_images": len(train_ds),
                "val_images": len(val_ds),
                "best_val_macro_f1": best,
                "minutes": round(minutes, 1),
                "device": str(device),
                "history": history,
            },
            indent=2,
        )
    )
    print(f"Bitti ({minutes:.1f} dk). En iyi doğrulama macro-F1: {best:.4f} → {args.out / 'model.pt'}")


if __name__ == "__main__":
    main()
