"""Sınıflandırıcı girdisi hazırlığı.

ÖNEMLİ: ml/common.py içindeki `pad_to_square` ve normalizasyonla birebir aynı olmalı;
aksi halde eğitim ve çıkarım arasında dağılım farkı oluşur.
"""
import cv2
import numpy as np

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def corner_color(img_rgb: np.ndarray) -> tuple[int, int, int]:
    h, w = img_rgb.shape[:2]
    k = max(2, min(h, w) // 10)
    corners = np.concatenate(
        [
            img_rgb[:k, :k].reshape(-1, 3),
            img_rgb[:k, -k:].reshape(-1, 3),
            img_rgb[-k:, :k].reshape(-1, 3),
            img_rgb[-k:, -k:].reshape(-1, 3),
        ]
    )
    return tuple(int(v) for v in np.median(corners, axis=0))


def pad_to_square(img_rgb: np.ndarray, margin: float = 0.15) -> np.ndarray:
    h, w = img_rgb.shape[:2]
    side = int(max(h, w) * (1 + margin))
    color = corner_color(img_rgb)
    canvas = np.full((side, side, 3), color, dtype=np.uint8)
    y0, x0 = (side - h) // 2, (side - w) // 2
    canvas[y0 : y0 + h, x0 : x0 + w] = img_rgb
    return canvas


NEUTRAL_BG = (226, 226, 226)
PREPROCESS_VERSION = "grain-neutral-bg-v1"


def crop_grain(img_bgr: np.ndarray, bbox: tuple[int, int, int, int], contour: np.ndarray | None = None, pad: float = 0.12):
    """Taneyi kırpar; kontur verilirse kırpıntı koordinatlarında dolu maskeyi de döndürür."""
    x, y, w, h = bbox
    H, W = img_bgr.shape[:2]
    px, py = int(w * pad), int(h * pad)
    x0, y0 = max(0, x - px), max(0, y - py)
    x1, y1 = min(W, x + w + px), min(H, y + h + py)
    crop = cv2.cvtColor(img_bgr[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    mask = None
    if contour is not None:
        mask = np.zeros(crop.shape[:2], np.uint8)
        cv2.drawContours(mask, [contour - np.array([x0, y0])], -1, 255, -1)
    return crop, mask


def normalize_grain(img_rgb: np.ndarray, mask: np.ndarray | None, pad: float = 0.12) -> np.ndarray:
    """ml/common.py → normalize_grain ile aynı: zemin rengine göre beyaz dengesi, nötr zemin, kırpma."""
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


def to_tensor(img_rgb: np.ndarray, size: int, mean=IMAGENET_MEAN, std=IMAGENET_STD) -> np.ndarray:
    sq = pad_to_square(img_rgb)
    resized = cv2.resize(sq, (size, size), interpolation=cv2.INTER_AREA)
    x = resized.astype(np.float32) / 255.0
    x = (x - mean) / std
    return x.transpose(2, 0, 1)
