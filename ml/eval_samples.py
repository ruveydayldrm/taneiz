"""Uçtan uca numune değerlendirmesi: make_demo_samples.py'nin ürettiği kompozit fotoğrafları
çalışan AI servisine gönderir ve sonucu GERÇEK dağılımla (manifest.json) karşılaştırır.

Tek tane test metriği sınıflandırıcıyı ölçer; bu betik segmentasyon + sınıflandırma hattının
tamamını (tane sayımı ve sağlıklı oranı) ölçer.

    python ml/eval_samples.py [--ai http://127.0.0.1:8000] [--write]
"""
from __future__ import annotations

import argparse
import json
import urllib.request
import uuid
from pathlib import Path

from common import ARTIFACTS_DIR, ML_DIR, write_json

SAMPLES = ML_DIR.parent / "apps" / "web" / "prisma" / "seed-samples"


def analyze(url: str, path: Path) -> dict:
    boundary = uuid.uuid4().hex
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"{path.name}\"\r\n"
        f"Content-Type: image/jpeg\r\n\r\n".encode() + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    )
    req = urllib.request.Request(f"{url}/analyze", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ai", default="http://127.0.0.1:8000")
    ap.add_argument("--samples", type=Path, default=SAMPLES)
    ap.add_argument("--write", action="store_true", help="Sonucu model_card.json'a 'pipeline_eval' olarak yaz")
    args = ap.parse_args()

    manifest = json.loads((args.samples / "manifest.json").read_text(encoding="utf-8"))
    rows = []
    print(f"{'Numune':<12}{'tane (bulunan/gerçek)':>24}{'sağlıklı gerçek':>18}{'tahmin':>10}{'fark':>8}{'süre':>9}")
    for s in manifest["samples"]:
        res = analyze(args.ai, args.samples / s["file"])
        true_n = s["grains"]
        true_h = s["true_counts"].get("SAGLIKLI", 0) / true_n
        pred_h = res["ratios"].get("SAGLIKLI", 0.0)
        rows.append(
            {
                "file": s["file"],
                "true_grains": true_n,
                "found_grains": res["grain_count"],
                "true_healthy": round(true_h, 4),
                "pred_healthy": round(pred_h, 4),
                "abs_error": round(abs(pred_h - true_h), 4),
                "ms": res["processing_ms"],
            }
        )
        print(
            f"{s['file']:<12}{res['grain_count']:>14}/{true_n:<9}{true_h * 100:>16.1f}%{pred_h * 100:>9.1f}%"
            f"{(pred_h - true_h) * 100:>+7.1f}{res['processing_ms']:>7} ms"
        )

    recall = sum(min(r["found_grains"], r["true_grains"]) for r in rows) / sum(r["true_grains"] for r in rows)
    mae = sum(r["abs_error"] for r in rows) / len(rows)
    print(f"\nTane bulma oranı: %{recall * 100:.1f}   Sağlıklı oranı ortalama mutlak hata: {mae * 100:.2f} puan")

    if args.write:
        card_path = ARTIFACTS_DIR / "model_card.json"
        card = json.loads(card_path.read_text(encoding="utf-8"))
        card["pipeline_eval"] = {
            "description": "Kilitli test setindeki taneler açık zemine dağıtılarak üretilen kompozit numunelerde uçtan uca (segmentasyon + sınıflandırma) ölçüm",
            "grain_recall": round(recall, 4),
            "healthy_ratio_mae": round(mae, 4),
            "samples": rows,
        }
        write_json(card_path, card)
        print(f"→ {card_path}")


if __name__ == "__main__":
    main()
