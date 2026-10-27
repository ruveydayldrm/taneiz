"""Eğitimdeki (ml/common.py) ve çıkarımdaki (app/preprocess.py) zemin nötrleştirmesi aynı olmalı."""
import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

pytest.importorskip("PIL")
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "ml"))
import common as ml_common  # noqa: E402

from app import preprocess  # noqa: E402


def _grain_on_tinted_bg():
    img = np.full((300, 300, 3), (238, 222, 196), np.uint8)  # bej, sıcak tonlu zemin (RGB)
    cv2.ellipse(img, (150, 150), (70, 35), 30, 0, 360, (170, 120, 60), -1)
    mask = np.zeros((300, 300), np.uint8)
    cv2.ellipse(mask, (150, 150), (70, 35), 30, 0, 360, 255, -1)
    return img, mask


def test_constants_match():
    assert ml_common.NEUTRAL_BG == preprocess.NEUTRAL_BG
    assert ml_common.PREPROCESS_VERSION == preprocess.PREPROCESS_VERSION


def test_same_output_for_same_mask():
    img, mask = _grain_on_tinted_bg()
    a = ml_common.normalize_grain(img, mask)
    b = preprocess.normalize_grain(img, mask)
    assert a.shape == b.shape
    assert np.array_equal(a, b)


def test_background_becomes_neutral():
    img, mask = _grain_on_tinted_bg()
    out = preprocess.normalize_grain(img, mask)
    corner = out[:5, :5].reshape(-1, 3).mean(axis=0)
    assert np.allclose(corner, preprocess.NEUTRAL_BG, atol=2)
