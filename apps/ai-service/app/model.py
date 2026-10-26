import json
import logging
from pathlib import Path

import numpy as np

from . import config
from .preprocess import IMAGENET_MEAN, IMAGENET_STD, to_tensor

log = logging.getLogger("taneiz.model")


class ModelNotAvailable(RuntimeError):
    pass


class GrainClassifier:
    """ONNX Runtime (CPU) ile tane sınıflandırıcı. Model yoksa ASLA sahte sonuç üretmez."""

    def __init__(self, model_file: Path = config.MODEL_FILE, card_file: Path = config.MODEL_CARD_FILE):
        if not model_file.exists():
            raise ModelNotAvailable(
                f"Model dosyası bulunamadı: {model_file}. "
                "Önce ml/ altındaki eğitim hattını çalıştırın (prepare_data → train → evaluate → export_onnx) "
                "ya da MODEL_DIR ortam değişkenini model.onnx içeren klasöre yönlendirin."
            )
        if not card_file.exists():
            raise ModelNotAvailable(f"Model kartı bulunamadı: {card_file}. evaluate.py ve export_onnx.py çalıştırılmalı.")

        import onnxruntime as ort

        try:
            self.card = json.loads(card_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise ModelNotAvailable(f"Model kartı okunamadı ({card_file}): {e}") from e
        self.classes: list[str] = self.card["classes"]
        self.size: int = int(self.card.get("input_size", 224))
        self.mean = np.array(self.card.get("mean", IMAGENET_MEAN), dtype=np.float32)
        self.std = np.array(self.card.get("std", IMAGENET_STD), dtype=np.float32)
        self.version: str = self.card.get("model_version", "bilinmiyor")

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(model_file), opts, providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        log.info("Model yüklendi: %s (%d sınıf)", self.version, len(self.classes))

    def predict(self, crops_rgb: list[np.ndarray], batch_size: int = 64) -> list[tuple[str, float]]:
        out: list[tuple[str, float]] = []
        for i in range(0, len(crops_rgb), batch_size):
            batch = np.stack([to_tensor(c, self.size, self.mean, self.std) for c in crops_rgb[i : i + batch_size]])
            logits = self.session.run(None, {self.input_name: batch.astype(np.float32)})[0]
            logits = logits - logits.max(axis=1, keepdims=True)
            probs = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
            for p in probs:
                k = int(p.argmax())
                out.append((self.classes[k], float(p[k])))
        return out
