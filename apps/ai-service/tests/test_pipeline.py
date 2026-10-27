import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.grading import grade, load_rules
from app.pipeline import analyze_images
from app.quality import check_image_quality
from app.segment import segment_grains


def test_segmentation_counts_and_splits_touching(sample):
    img, expected = sample
    grains, _ = segment_grains(img)
    # Değen çiftler watershed ile ayrılmalı: ±%5 tolerans
    assert abs(len(grains) - expected) <= max(2, int(expected * 0.05)), (len(grains), expected)


def test_segmentation_empty_background():
    img = np.full((900, 1200, 3), 230, np.uint8)
    grains, _ = segment_grains(img)
    assert len(grains) <= 1


def test_quality_flags_blur(sample):
    img, _ = sample
    assert check_image_quality(img)["blur_score"] > check_image_quality(cv2.GaussianBlur(img, (31, 31), 12))["blur_score"]
    assert not check_image_quality(cv2.GaussianBlur(img, (41, 41), 20))["ok"]


def _grain_pile(seed=1):
    """Zemin görünmeyen, üst üste yığılmış taneler (sahada sık çekilen ama analiz edilemeyen sahne)."""
    rng = np.random.default_rng(seed)
    img = np.full((700, 1000, 3), (60, 110, 165), np.uint8)  # BGR: buğday rengi
    for _ in range(900):
        c = tuple(int(v) for v in rng.integers([40, 90, 140], [90, 150, 210]))
        cv2.ellipse(img, (int(rng.integers(0, 1000)), int(rng.integers(0, 700))), (34, 18), float(rng.uniform(0, 180)), 0, 360, c, -1)
        cv2.ellipse(img, (int(rng.integers(0, 1000)), int(rng.integers(0, 700))), (30, 3), float(rng.uniform(0, 180)), 0, 360, (25, 45, 70), -1)
    return img


def test_background_check_rejects_grain_pile(sample):
    from app.quality import check_background

    assert not check_background(_grain_pile())["ok"]
    assert check_background(sample[0])["ok"]


def test_pipeline_refuses_pile_instead_of_fake_grade():
    import pytest

    from app.pipeline import SceneRejected

    with pytest.raises(SceneRejected):
        analyze_images([_grain_pile()], _StubClassifier(), load_rules())


def test_grading_rules():
    rules = load_rules()
    assert grade({"SAGLIKLI": 0.97, "KUFLU": 0.0}, rules)["code"] == "SINIF_1"
    assert grade({"SAGLIKLI": 0.97, "KUFLU": 0.02}, rules)["code"] == "SINIF_2"  # küf sınırı
    assert grade({"SAGLIKLI": 0.90}, rules)["code"] == "SINIF_2"
    assert grade({"SAGLIKLI": 0.70}, rules)["code"] == "SINIF_3"


class _StubClassifier:
    """YALNIZCA TEST: segmentasyon + açıklama hattını model olmadan sınamak için."""

    version = "test-stub"
    preprocessing = "grain-neutral-bg-v1"

    def predict(self, crops):
        return [("SAGLIKLI" if i % 5 else "KIRIK_CATLAK", 0.9) for i in range(len(crops))]


def test_pipeline_end_to_end_with_stub(sample):
    img, expected = sample
    out = analyze_images([img], _StubClassifier(), load_rules())
    assert out["grain_count"] == out["images"][0]["grain_count"]
    assert abs(sum(out["ratios"].values()) - 1) < 1e-9
    assert out["images"][0]["annotated_jpeg_base64"]
    assert out["grade"]["code"] in {"SINIF_1", "SINIF_2", "SINIF_3"}


def test_service_without_model_refuses_to_analyze(sample):
    from app.main import app

    img, _ = sample
    ok, buf = cv2.imencode(".jpg", img)
    with TestClient(app) as client:
        assert client.get("/health").json()["status"] == "model_missing"
        r = client.post("/analyze", files={"files": ("a.jpg", buf.tobytes(), "image/jpeg")})
        assert r.status_code == 503
        assert "Model" in r.json()["detail"]
        assert client.get("/model-card").status_code == 503
