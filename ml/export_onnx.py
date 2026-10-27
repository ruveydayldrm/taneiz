"""PyTorch → ONNX dönüşümü ve çıktı eşitliği doğrulaması.

Rastgele girdiler ve gerçek test görüntüleri üzerinde PyTorch ile ONNX Runtime çıktıları
karşılaştırılır; fark eşiği aşılırsa veya argmax uyuşmazsa model yazılmaz.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import timm
import torch

from common import ARTIFACTS_DIR, RAW_DIR, SPLITS_DIR, sha256_file, write_json
from dataset import GrainDataset, build_transforms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifacts", type=Path, default=ARTIFACTS_DIR)
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--splits", type=Path, default=SPLITS_DIR)
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--tol", type=float, default=1e-3)
    args = ap.parse_args()

    ckpt = torch.load(args.artifacts / "model.pt", map_location="cpu")
    model = timm.create_model(ckpt["model_name"], pretrained=False, num_classes=len(ckpt["classes"]))
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    if hasattr(model, "set_exportable"):
        model.set_exportable(True)

    size = ckpt["img_size"]
    out_path = args.artifacts / "model.onnx"
    tmp_path = args.artifacts / "model.tmp.onnx"
    torch.onnx.export(
        model,
        torch.randn(1, 3, size, size),
        tmp_path,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=args.opset,
        do_constant_folding=True,
    )

    sess = ort.InferenceSession(str(tmp_path), providers=["CPUExecutionProvider"])
    batches = [torch.randn(8, 3, size, size)]
    test_csv = args.splits / "test.csv"
    if test_csv.exists():
        ds = GrainDataset(test_csv, args.raw_dir, build_transforms(size, False), ckpt["classes"])
        idx = np.random.default_rng(0).choice(len(ds), size=min(64, len(ds)), replace=False)
        batches.append(torch.stack([ds[int(i)][0] for i in idx]))

    max_diff, agree, total = 0.0, 0, 0
    with torch.no_grad():
        for x in batches:
            ref = model(x).numpy()
            got = sess.run(None, {"input": x.numpy()})[0]
            max_diff = max(max_diff, float(np.abs(ref - got).max()))
            agree += int((ref.argmax(1) == got.argmax(1)).sum())
            total += len(x)
    agreement = agree / total
    print(f"PyTorch ↔ ONNX: en büyük mutlak fark {max_diff:.2e}, argmax uyumu {agreement:.4f} ({total} örnek)")
    if max_diff > args.tol or agreement < 1.0:
        tmp_path.unlink(missing_ok=True)
        sys.exit("HATA: ONNX çıktıları PyTorch ile eşleşmiyor; model yazılmadı.")

    tmp_path.replace(out_path)
    card_path = args.artifacts / "model_card.json"
    if not card_path.exists():
        sys.exit("model_card.json yok; önce evaluate.py çalıştırın.")
    card = json.loads(card_path.read_text(encoding="utf-8"))
    card.pop("onnx_previous", None)
    card["onnx"] = {
        "file": "model.onnx",
        "sha256": sha256_file(out_path),
        "opset": args.opset,
        "max_abs_diff": max_diff,
        "argmax_agreement": agreement,
        "verified_samples": total,
    }
    write_json(card_path, card)
    print(f"→ {out_path}\nModel kartı güncellendi. AI servisini yeniden başlatın.")


if __name__ == "__main__":
    main()
