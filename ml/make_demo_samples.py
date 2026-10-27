"""Seed için numune fotoğrafları: KİLİTLİ TEST SETİNDEKİ gerçek tane görüntüleri, açık renkli
zemin üzerine dağıtılarak kompozit "numune fotoğrafı" haline getirilir.

Her kompozitin gerçek sınıf dağılımı manifest.json'a yazılır (dürüstlük için; uygulama
analizi yine AI servisinden alır, bu dağılımı kullanmaz).

    python ml/make_demo_samples.py
    → apps/web/prisma/seed-samples/*.jpg + manifest.json
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
import pandas as pd

from common import CLASSES, ML_DIR, RAW_DIR, SPLITS_DIR, grain_mask, imwrite_unicode, load_rgb, random_light_background, write_json

OUT_DIR = ML_DIR.parent / "apps" / "web" / "prisma" / "seed-samples"

# Hedef sağlıklı oranları: iki 1. sınıf, iki 2. sınıf, iki 3. sınıf adayı
PROFILES = [
    ("ornek-1", 0.985),
    ("ornek-2", 0.96),
    ("ornek-3", 0.92),
    ("ornek-4", 0.895),
    ("ornek-5", 0.80),
    ("ornek-6", 0.70),
]


def cut_grain(img: np.ndarray, target_len: int, rng) -> tuple[np.ndarray, np.ndarray] | None:
    m = grain_mask(img)
    if m is None:
        return None
    x, y, w, h = cv2.boundingRect(m)
    H, W = m.shape
    # Kaynak görüntünün kenarına değen maske genelde zemin/gölge parçasıdır → reddet
    if x <= 2 or y <= 2 or x + w >= W - 2 or y + h >= H - 2:
        return None
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(cs, key=cv2.contourArea)
    solidity = cv2.contourArea(c) / max(cv2.contourArea(cv2.convexHull(c)), 1)
    if solidity < 0.85:  # tane dışbükeye yakındır; düzensiz şekil = hatalı kesim
        return None
    crop, mk = img[y : y + h, x : x + w], m[y : y + h, x : x + w]
    s = target_len / max(w, h) * rng.uniform(0.9, 1.1)
    crop = cv2.resize(crop, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    mk = cv2.resize(mk, None, fx=s, fy=s, interpolation=cv2.INTER_NEAREST)
    ang = rng.uniform(0, 360)
    hh, ww = crop.shape[:2]
    side = int(np.hypot(hh, ww)) + 2
    M = cv2.getRotationMatrix2D((ww / 2, hh / 2), ang, 1.0)
    M[0, 2] += (side - ww) / 2
    M[1, 2] += (side - hh) / 2
    crop = cv2.warpAffine(crop, M, (side, side), flags=cv2.INTER_LINEAR)
    mk = cv2.warpAffine(mk, M, (side, side), flags=cv2.INTER_NEAREST)
    return crop, mk


def iter_cuts(pool: pd.DataFrame, raw_dir: Path, grain_len: int, rng):
    """Sınıf havuzundan, temiz kesilebilen taneleri sırayla verir (hatalı kesimler atlanır)."""
    for _, row in pool.sample(frac=1, random_state=int(rng.integers(1e9))).iterrows():
        cut = cut_grain(load_rgb(raw_dir / row["path"]), grain_len, rng)
        if cut is not None:
            yield row["label"], cut


def compose(wanted: dict[str, int], pools: dict[str, pd.DataFrame], raw_dir: Path, rng, size=(2000, 2600), grain_len=170):
    H, W = size
    canvas = random_light_background(H, W, rng).astype(np.float32)
    cols, rws = 13, 10
    cells = [(c, r) for r in range(rws) for c in range(cols)]
    rng.shuffle(cells)
    items = []
    for cls, k in wanted.items():
        gen = iter_cuts(pools[cls], raw_dir, grain_len, rng)
        items += [next(gen) for _ in range(k)]
    order = rng.permutation(len(items))
    used, labels = 0, []
    for idx, (c, r) in zip(order, cells):
        label, (crop, mk) = items[idx]
        cx = int((c + 0.5) * W / cols + rng.uniform(-18, 18))
        cy = int((r + 0.5) * H / rws + rng.uniform(-18, 18))
        h, w = crop.shape[:2]
        y0, x0 = cy - h // 2, cx - w // 2
        if y0 < 0 or x0 < 0 or y0 + h > H or x0 + w > W:
            continue
        a = cv2.GaussianBlur(mk, (3, 3), 0)[..., None] / 255.0
        # Hafif gölge
        sh = cv2.GaussianBlur(mk, (21, 21), 8)[..., None] / 255.0 * 0.18
        region = canvas[y0 + 4 : y0 + h + 4, x0 + 4 : x0 + w + 4]
        if region.shape[:2] == sh.shape[:2]:
            region *= 1 - sh
        canvas[y0 : y0 + h, x0 : x0 + w] = crop * a + canvas[y0 : y0 + h, x0 : x0 + w] * (1 - a)
        labels.append(label)
        used += 1
    return cv2.cvtColor(canvas.astype(np.uint8), cv2.COLOR_RGB2BGR), labels


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--splits", type=Path, default=SPLITS_DIR)
    ap.add_argument("--out", type=Path, default=OUT_DIR)
    ap.add_argument("--grains", type=int, default=120)
    args = ap.parse_args()

    test = pd.read_csv(args.splits / "test.csv")
    by_class = {c: test[test.label == c] for c in CLASSES}
    defects = [c for c in CLASSES if c != "SAGLIKLI" and len(by_class[c])]
    rng = np.random.default_rng(7)
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for name, healthy_ratio in PROFILES:
        n_h = round(args.grains * healthy_ratio)
        n_d = args.grains - n_h
        wanted = {"SAGLIKLI": n_h}
        if n_d and defects:
            alloc = rng.multinomial(n_d, rng.dirichlet(np.ones(len(defects))))
            wanted.update({c: int(k) for c, k in zip(defects, alloc) if k})
        img, labels = compose(wanted, by_class, args.raw_dir, rng)
        file = f"{name}.jpg"
        imwrite_unicode(args.out / file, img, [cv2.IMWRITE_JPEG_QUALITY, 90])
        truth = {c: labels.count(c) for c in CLASSES}
        manifest.append({"file": file, "grains": len(labels), "true_counts": truth, "source": "kilitli test seti"})
        print(f"{file}: {len(labels)} tane, gerçek sağlıklı oranı %{truth['SAGLIKLI'] / max(1, len(labels)) * 100:.1f}")
    write_json(args.out / "manifest.json", {"note": "Kompozitler kilitli test setindeki gerçek tane görüntülerinden üretildi.", "samples": manifest})
    print(f"→ {args.out}")


if __name__ == "__main__":
    main()
