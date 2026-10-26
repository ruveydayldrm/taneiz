"""Kilitli test setinde değerlendirme → artifacts/model_card.json + confusion_matrix.png + sınıf örnekleri.

Test seti kilidi (data/splits/test.lock.json) doğrulanmadan çalışmaz.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import timm
import torch
import yaml
from PIL import Image
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from torch.utils.data import DataLoader

from common import ARTIFACTS_DIR, CLASSES, RAW_DIR, SPLITS_DIR, sha256_file, write_json
from dataset import GrainDataset, build_transforms

LABELS_TR = {
    "SAGLIKLI": "Sağlıklı",
    "KIRIK_CATLAK": "Kırık/Çatlak",
    "BOCEK_SUNE_ZARARI": "Böcek/Süne",
    "KUFLU": "Küflü",
    "LEKELI_RENK_BOZUK": "Lekeli/Renk",
    "BURUSUK_CILIZ": "Buruşuk/Cılız",
}


def plot_cm(cm: np.ndarray, classes: list[str], path: Path):
    norm = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(7.5, 6.5), dpi=150)
    im = ax.imshow(norm, cmap="YlGn", vmin=0, vmax=1)
    ax.set_xticks(range(len(classes)), [LABELS_TR[c] for c in classes], rotation=35, ha="right")
    ax.set_yticks(range(len(classes)), [LABELS_TR[c] for c in classes])
    ax.set_xlabel("Tahmin")
    ax.set_ylabel("Gerçek")
    for i in range(len(classes)):
        for j in range(len(classes)):
            ax.text(j, i, f"{cm[i, j]}\n{norm[i, j]:.0%}", ha="center", va="center", fontsize=7, color="white" if norm[i, j] > 0.6 else "black")
    fig.colorbar(im, ax=ax, fraction=0.046)
    ax.set_title("Kilitli test seti — confusion matrix")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--splits", type=Path, default=SPLITS_DIR)
    ap.add_argument("--artifacts", type=Path, default=ARTIFACTS_DIR)
    ap.add_argument("--samples-per-class", type=int, default=4)
    args = ap.parse_args()

    lock = json.loads((args.splits / "test.lock.json").read_text())
    actual = sha256_file(args.splits / "test.csv")
    if actual != lock["sha256"]:
        sys.exit("HATA: test.csv kilitle eşleşmiyor! Test seti değiştirilmiş; metrikler geçersiz olur.")
    print(f"Test seti kilidi doğrulandı ({lock['count']} görüntü).")

    ckpt = torch.load(args.artifacts / "model.pt", map_location="cpu")
    classes = ckpt["classes"]
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = timm.create_model(ckpt["model_name"], pretrained=False, num_classes=len(classes))
    model.load_state_dict(ckpt["state_dict"])
    model.eval().to(device)

    ds = GrainDataset(args.splits / "test.csv", args.raw_dir, build_transforms(ckpt["img_size"], False))
    dl = DataLoader(ds, 128, num_workers=2)
    ys, ps, confs = [], [], []
    with torch.no_grad():
        for x, y in dl:
            prob = torch.softmax(model(x.to(device)).float(), 1).cpu()
            c, p = prob.max(1)
            ys += y.tolist()
            ps += p.tolist()
            confs += c.tolist()
    ys, ps = np.array(ys), np.array(ps)
    labels = list(range(len(classes)))
    rep = classification_report(ys, ps, labels=labels, target_names=classes, output_dict=True, zero_division=0)
    cm = confusion_matrix(ys, ps, labels=labels)

    args.artifacts.mkdir(parents=True, exist_ok=True)
    plot_cm(cm, classes, args.artifacts / "confusion_matrix.png")

    # Sınıf başına örnekler (doğru ve yanlış tahminler karışık, gerçek test görüntüleri)
    samples_dir = args.artifacts / "samples"
    shutil.rmtree(samples_dir, ignore_errors=True)
    samples: dict[str, list] = {}
    rng = np.random.default_rng(0)
    for ci, cname in enumerate(classes):
        idx = np.where(ys == ci)[0]
        if len(idx) == 0:
            continue
        pick = rng.choice(idx, size=min(args.samples_per_class, len(idx)), replace=False)
        samples[cname] = []
        for k, i in enumerate(sorted(pick)):
            rel = f"samples/{cname}/{k}.jpg"
            (args.artifacts / rel).parent.mkdir(parents=True, exist_ok=True)
            img = Image.open(args.raw_dir / ds.df.iloc[i]["path"]).convert("RGB")
            img.thumbnail((256, 256))
            img.save(args.artifacts / rel, quality=88)
            samples[cname].append({"path": rel, "true": cname, "pred": classes[ps[i]], "confidence": round(float(confs[i]), 4)})

    report = json.loads((args.splits / "report.json").read_text(encoding="utf-8"))
    label_map = yaml.safe_load(open(Path(__file__).parent / "label_map.yaml", encoding="utf-8"))
    ds_counts = ds.df.groupby("dataset").size().to_dict()
    all_counts = {}
    for split in ("train", "val", "test"):
        import pandas as pd

        for name, n in pd.read_csv(args.splits / f"{split}.csv").groupby("dataset").size().items():
            all_counts[name] = all_counts.get(name, 0) + int(n)

    training = {}
    if (args.artifacts / "training.json").exists():
        training = json.loads((args.artifacts / "training.json").read_text())
        training.pop("history", None)

    weights_hash = sha256_file(args.artifacts / "model.pt")[:10]
    card = {
        "model_name": "TaneİZ tane sınıflandırıcı",
        "architecture": ckpt["model_name"],
        "model_version": f"{ckpt['model_name']}-{datetime.now(timezone.utc):%Y%m%d}-{weights_hash}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "classes": classes,
        "input_size": ckpt["img_size"],
        "mean": ckpt["mean"],
        "std": ckpt["std"],
        "datasets": [
            {
                "name": name,
                "source": label_map["datasets"][name].get("source", ""),
                "license": label_map["datasets"][name].get("license", ""),
                "images_used": all_counts.get(name, 0),
            }
            for name in label_map["datasets"]
            if all_counts.get(name)
        ],
        "split_counts": report["split_counts"],
        "test_set_lock": {"sha256": lock["sha256"], "count": lock["count"]},
        "test_metrics": {
            "accuracy": round(float(accuracy_score(ys, ps)), 4),
            "macro_f1": round(float(f1_score(ys, ps, average="macro", zero_division=0)), 4),
            "weighted_f1": round(float(f1_score(ys, ps, average="weighted", zero_division=0)), 4),
            "n_test": int(len(ys)),
            "per_class": {
                c: {
                    "precision": round(rep[c]["precision"], 4),
                    "recall": round(rep[c]["recall"], 4),
                    "f1": round(rep[c]["f1-score"], 4),
                    "support": int(rep[c]["support"]),
                }
                for c in classes
            },
            "confusion_matrix": cm.tolist(),
            "by_dataset": {k: int(v) for k, v in ds_counts.items()},
        },
        "confusion_matrix_image": "confusion_matrix.png",
        "samples": samples,
        "training": training,
        "limitations": [
            "Model tek tek kırpılmış tane görüntüleriyle eğitildi; açık renkli, düz zemin üzerinde dağıtılmış taneler beklenir.",
            "Birbirine çok yapışık veya üst üste yığılmış tanelerde segmentasyon hatası, oranları etkileyebilir.",
            "Eğitim verisi laboratuvar koşullarında çekilmiştir; saha fotoğraflarında doğruluk test setindekinden düşük olabilir.",
            "Nem oranı fotoğraftan TAHMİN EDİLMEZ; nem ölçer cihazından elle girilir.",
            "Kalite sınıfı eşikleri demo amaçlıdır, yapılandırılabilir ve resmi bir standart (ör. TS 2974) değildir.",
            "Az örnekli sınıflarda (bkz. destek sayıları) metrikler istatistiksel olarak daha belirsizdir.",
        ],
    }
    card_path = args.artifacts / "model_card.json"
    if card_path.exists():  # export_onnx bilgilerini koru
        old = json.loads(card_path.read_text(encoding="utf-8"))
        if "onnx" in old:
            card["onnx_previous"] = old["onnx"]
    write_json(card_path, card)
    print(f"Test doğruluğu {card['test_metrics']['accuracy']:.4f}, macro-F1 {card['test_metrics']['macro_f1']:.4f}")
    print(classification_report(ys, ps, labels=labels, target_names=classes, zero_division=0))
    print(f"→ {card_path}\n→ {args.artifacts / 'confusion_matrix.png'}")


if __name__ == "__main__":
    main()
