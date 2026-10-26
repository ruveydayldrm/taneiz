import os
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np
import pytest

# Testler model OLMADAN çalışır: boş bir model klasörü göster.
os.environ.setdefault("MODEL_DIR", tempfile.mkdtemp(prefix="taneiz-nomodel-"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def synthetic_sample(n_single=30, n_pairs=6, seed=0, size=(1200, 1600)):
    """Açık zemin üzerinde buğday benzeri elipsler; bazıları birbirine değiyor."""
    rng = np.random.default_rng(seed)
    h, w = size
    img = np.full((h, w, 3), (228, 232, 235), np.uint8)
    noise = rng.normal(0, 3, img.shape)
    img = np.clip(img + noise, 0, 255).astype(np.uint8)
    # Hafif aydınlatma gradyanı
    grad = np.linspace(-12, 12, w)[None, :, None]
    img = np.clip(img + grad, 0, 255).astype(np.uint8)

    cells = []
    cols, rows = 10, 7
    for r in range(rows):
        for c in range(cols):
            cells.append((int((c + 0.5) * w / cols), int((r + 0.5) * h / rows)))
    rng.shuffle(cells)
    placed = 0
    for i, (cx, cy) in enumerate(cells[: n_single + n_pairs]):
        color = tuple(int(v) for v in rng.integers([40, 110, 160], [70, 140, 190]))  # BGR tane rengi
        ang = float(rng.uniform(0, 180))
        if i < n_single:
            cv2.ellipse(img, (cx, cy), (34, 18), ang, 0, 360, color, -1, cv2.LINE_AA)
            placed += 1
        else:
            # İki tane hafifçe üst üste
            dx = int(30 * np.cos(np.radians(ang)))
            dy = int(30 * np.sin(np.radians(ang)))
            cv2.ellipse(img, (cx - dx, cy - dy), (34, 18), ang, 0, 360, color, -1, cv2.LINE_AA)
            cv2.ellipse(img, (cx + dx, cy + dy), (34, 18), ang, 0, 360, color, -1, cv2.LINE_AA)
            placed += 2
    img = cv2.GaussianBlur(img, (3, 3), 0)
    return img, placed


@pytest.fixture
def sample():
    return synthetic_sample()
