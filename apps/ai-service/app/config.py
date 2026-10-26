import os
from pathlib import Path

SERVICE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SERVICE_DIR.parent.parent

# Eğitilmiş model ve model kartı (ml/export_onnx.py ile üretilir)
MODEL_DIR = Path(os.getenv("MODEL_DIR", REPO_ROOT / "ml" / "artifacts"))
MODEL_FILE = MODEL_DIR / "model.onnx"
MODEL_CARD_FILE = MODEL_DIR / "model_card.json"

GRADING_RULES_FILE = Path(os.getenv("GRADING_RULES_FILE", SERVICE_DIR / "grading_rules.yaml"))

MAX_IMAGES = 3
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# Görüntü kalite eşikleri
BLUR_MIN_LAPLACIAN_VAR = float(os.getenv("BLUR_MIN_LAPLACIAN_VAR", "60"))
BRIGHTNESS_MIN = 70
BRIGHTNESS_MAX = 235
MIN_SIDE_PX = 600

# Segmentasyon için iş çözünürlüğü (uzun kenar). Konturlar orijinale geri ölçeklenir.
SEGMENT_MAX_SIDE = 1600
