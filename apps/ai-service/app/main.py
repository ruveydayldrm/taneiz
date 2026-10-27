import json
import logging
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from . import config
from .grading import load_rules
from .model import GrainClassifier, ModelNotAvailable
from .pipeline import NoGrainsFound, SceneRejected, analyze_images

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("taneiz")

state: dict = {"clf": None, "error": None, "rules": None}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    state["rules"] = load_rules()
    try:
        state["clf"] = GrainClassifier()
    except ModelNotAvailable as e:
        state["error"] = str(e)
        log.error("=" * 72)
        log.error("MODEL YÜKLENEMEDİ — /analyze 503 döndürecek, sahte sonuç ÜRETİLMEZ.")
        log.error(str(e))
        log.error("=" * 72)
    yield


app = FastAPI(title="TaneİZ Yapay Zekâ Servisi", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    clf: GrainClassifier | None = state["clf"]
    return {
        "status": "ok" if clf else "model_missing",
        "model_version": clf.version if clf else None,
        "error": state["error"],
    }


@app.get("/model-card")
def model_card():
    if not config.MODEL_CARD_FILE.exists():
        raise HTTPException(503, "model_card.json bulunamadı. Model henüz eğitilip değerlendirilmedi (ml/evaluate.py).")
    return json.loads(config.MODEL_CARD_FILE.read_text(encoding="utf-8"))


@app.get("/artifacts/{path:path}")
def artifact(path: str):
    """Model kartındaki görseller (confusion matrix, sınıf örnekleri). Yalnızca resimler sunulur."""
    root = config.MODEL_DIR.resolve()
    full = (root / path).resolve()
    if root not in full.parents or full.suffix.lower() not in {".png", ".jpg", ".jpeg"} or not full.exists():
        raise HTTPException(404, "Bulunamadı")
    return FileResponse(full)


@app.post("/analyze")
async def analyze(files: list[UploadFile] = File(...)):
    clf: GrainClassifier | None = state["clf"]
    if clf is None:
        raise HTTPException(503, f"Model yüklü değil; analiz yapılamaz. {state['error']}")
    if not 1 <= len(files) <= config.MAX_IMAGES:
        raise HTTPException(400, f"1 ile {config.MAX_IMAGES} arasında numune fotoğrafı gönderin.")

    images = []
    for f in files:
        data = await f.read()
        if len(data) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"{f.filename}: dosya 15 MB sınırını aşıyor.")
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(400, f"{f.filename}: görüntü okunamadı (JPEG/PNG/WebP gönderin).")
        images.append(img)

    try:
        return analyze_images(images, clf, state["rules"])
    except (NoGrainsFound, SceneRejected) as e:
        raise HTTPException(422, str(e))
