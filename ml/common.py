"""Eğitim, değerlendirme ve demo örnek üretimi için ortak yardımcılar.

`pad_to_square` ve normalizasyon apps/ai-service/app/preprocess.py ile BİREBİR aynı olmalı.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ML_DIR = Path(__file__).resolve().parent
DATA_DIR = ML_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
SPLITS_DIR = DATA_DIR / "splits"
ARTIFACTS_DIR = ML_DIR / "artifacts"

CLASSES = ["SAGLIKLI", "KIRIK_CATLAK", "BOCEK_SUNE_ZARARI", "KUFLU", "LEKELI_RENK_BOZUK", "BURUSUK_CILIZ"]
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def corner_color(img: np.ndarray) -> tuple[int, int, int]:
    h, w = img.shape[:2]
    k = max(2, min(h, w) // 10)
    corners = np.concatenate(
        [img[:k, :k].reshape(-1, 3), img[:k, -k:].reshape(-1, 3), img[-k:, :k].reshape(-1, 3), img[-k:, -k:].reshape(-1, 3)]
    )
    return tuple(int(v) for v in np.median(corners, axis=0))


def pad_to_square(img: np.ndarray, margin: float = 0.15) -> np.ndarray:
    h, w = img.shape[:2]
    side = int(max(h, w) * (1 + margin))
    canvas = np.full((side, side, 3), corner_color(img), dtype=np.uint8)
    y0, x0 = (side - h) // 2, (side - w) // 2
    canvas[y0 : y0 + h, x0 : x0 + w] = img
    return canvas


def load_rgb(path: str | Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def grain_mask(img_rgb: np.ndarray) -> np.ndarray | None:
    """Tek tane görüntüsünde taneyi zeminden ayırır (zemin açık veya koyu olabilir). En büyük bileşen."""
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    _, m = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    border = np.concatenate([m[0, :], m[-1, :], m[:, 0], m[:, -1]])
    if border.mean() > 127:
        m = cv2.bitwise_not(m)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return None
    k = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    area = stats[k, cv2.CC_STAT_AREA]
    if area < 0.02 * m.size or area > 0.9 * m.size:
        return None
    out = np.uint8(lab == k) * 255
    cs, _ = cv2.findContours(out, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(out)
    cv2.drawContours(filled, cs, -1, 255, -1)
    return filled


NEUTRAL_BG = (226, 226, 226)
PREPROCESS_VERSION = "grain-neutral-bg-v1"


def normalize_grain(img_rgb: np.ndarray, mask: np.ndarray | None = None, pad: float = 0.12) -> np.ndarray:
    """Zemin kısayolunu ortadan kaldırır: zemin rengine göre beyaz dengesi + parlaklık düzeltmesi,
    taneyi sabit nötr zemine yerleştirme ve tanenin etrafından kırpma (ölçek kısayolu da kalkar).
    apps/ai-service/app/preprocess.py içindeki eşiyle BİREBİR aynı olmalı."""
    if mask is None:
        mask = grain_mask(img_rgb)
    if mask is None or mask.max() == 0:
        return img_rgb
    bg_region = cv2.erode(cv2.bitwise_not(mask), np.ones((7, 7), np.uint8)) > 0
    img = img_rgb.astype(np.float32)
    if bg_region.sum() > 50:
        bg_mean = img[bg_region].mean(axis=0) + 1e-3
        img = np.clip(img * (np.array(NEUTRAL_BG, np.float32) / bg_mean), 0, 255)
    alpha = cv2.GaussianBlur(mask, (3, 3), 0)[..., None].astype(np.float32) / 255.0
    out = img * alpha + np.array(NEUTRAL_BG, np.float32) * (1 - alpha)
    x, y, w, h = cv2.boundingRect(mask)
    px, py = int(w * pad), int(h * pad)
    H, W = mask.shape
    return out[max(0, y - py) : min(H, y + h + py), max(0, x - px) : min(W, x + w + px)].astype(np.uint8)


def imwrite_unicode(path: str | Path, img_bgr: np.ndarray, params: list[int] | None = None) -> None:
    """cv2.imwrite Windows'ta ASCII dışı yollarda (ör. 'Masaüstü') sessizce başarısız olur."""
    ok, buf = cv2.imencode(Path(path).suffix or ".jpg", img_bgr, params or [])
    if not ok:
        raise RuntimeError(f"Görüntü kodlanamadı: {path}")
    buf.tofile(str(path))


def random_light_background(h: int, w: int, rng: np.random.Generator) -> np.ndarray:
    base = rng.integers(205, 245, size=3)
    tint = rng.integers(-8, 8, size=3)
    bg = np.full((h, w, 3), np.clip(base + tint, 0, 255), np.float32)
    bg += rng.normal(0, rng.uniform(1, 5), bg.shape)
    gx = np.linspace(-1, 1, w)[None, :, None] * rng.uniform(-10, 10)
    gy = np.linspace(-1, 1, h)[:, None, None] * rng.uniform(-10, 10)
    return np.clip(bg + gx + gy, 0, 255).astype(np.uint8)


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
