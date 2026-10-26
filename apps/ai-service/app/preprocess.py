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


def crop_grain(img_bgr: np.ndarray, bbox: tuple[int, int, int, int], pad: float = 0.12) -> np.ndarray:
    x, y, w, h = bbox
    H, W = img_bgr.shape[:2]
    px, py = int(w * pad), int(h * pad)
    x0, y0 = max(0, x - px), max(0, y - py)
    x1, y1 = min(W, x + w + px), min(H, y + h + py)
    return cv2.cvtColor(img_bgr[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)


def to_tensor(img_rgb: np.ndarray, size: int, mean=IMAGENET_MEAN, std=IMAGENET_STD) -> np.ndarray:
    sq = pad_to_square(img_rgb)
    resized = cv2.resize(sq, (size, size), interpolation=cv2.INTER_AREA)
    x = resized.astype(np.float32) / 255.0
    x = (x - mean) / std
    return x.transpose(2, 0, 1)
