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


def test_grading_rules():
    rules = load_rules()
    assert grade({"SAGLIKLI": 0.97, "KUFLU": 0.0}, rules)["code"] == "SINIF_1"
    assert grade({"SAGLIKLI": 0.97, "KUFLU": 0.02}, rules)["code"] == "SINIF_2"  # küf sınırı
    assert grade({"SAGLIKLI": 0.90}, rules)["code"] == "SINIF_2"
    assert grade({"SAGLIKLI": 0.70}, rules)["code"] == "SINIF_3"


class _StubClassifier:
    """YALNIZCA TEST: segmentasyon + açıklama hattını model olmadan sınamak için."""

    version = "test-stub"

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
