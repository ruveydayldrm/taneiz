import cv2
import numpy as np

from . import config


def check_image_quality(img_bgr: np.ndarray) -> dict:
    """Bulanıklık (Laplacian varyansı), pozlama ve çözünürlük kontrolü. Analizi durdurmaz, uyarı üretir."""
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    # Ölçekten bağımsız olsun diye 1024 px'e indirip ölç
    scale = 1024 / max(h, w)
    small = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else gray
    blur_score = float(cv2.Laplacian(small, cv2.CV_64F).var())
    brightness = float(small.mean())

    warnings = []
    if blur_score < config.BLUR_MIN_LAPLACIAN_VAR:
        warnings.append(f"Görüntü bulanık görünüyor (keskinlik skoru {blur_score:.0f}). Telefonu sabit tutup yeniden çekin.")
    if brightness < config.BRIGHTNESS_MIN:
        warnings.append("Görüntü karanlık. Daha aydınlık bir ortamda çekin.")
    elif brightness > config.BRIGHTNESS_MAX:
        warnings.append("Görüntü aşırı pozlanmış. Doğrudan ışığı azaltın.")
    if min(h, w) < config.MIN_SIDE_PX:
        warnings.append(f"Çözünürlük düşük ({w}×{h}). En az {config.MIN_SIDE_PX} px kısa kenar önerilir.")

    return {
        "blur_score": round(blur_score, 1),
        "brightness": round(brightness, 1),
        "ok": not warnings,
        "warnings": warnings,
    }
