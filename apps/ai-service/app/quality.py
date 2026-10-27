import cv2
import numpy as np

from . import config


BG_MIN_L = 150  # altı: zemin koyu → reddet
BG_WARN_L = 185  # altı: loş → uyar
BG_MAX_CHROMA = 20  # üstü: zemin renkli (çoğunlukla tane yığını) → reddet


def check_background(img_bgr: np.ndarray) -> dict:
    """Sahne kontrolü: sistem açık renkli, düz bir zemine serpilmiş taneler bekler.
    Zemin rengi, büyük çekirdekli medyanla (taneler küçük olduğu için silinir) kestirilir.
    Tane yığınında 'zemin' tanelerin kendisidir: renkli ve koyu çıkar → analiz yapılmaz.
    Böylece sistem yanlış bir kalite sınıfını sessizce üretip zincire mühürletmez."""
    h, w = img_bgr.shape[:2]
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    small = cv2.resize(lab, (max(w // 8, 1), max(h // 8, 1)), interpolation=cv2.INTER_AREA)
    k = max(5, (min(small.shape[:2]) // 5) | 1)
    bg = cv2.medianBlur(small, min(k, 255)).reshape(-1, 3).astype(np.float32)
    L = float(np.median(bg[:, 0]))
    chroma = float(np.hypot(np.median(bg[:, 1]) - 128, np.median(bg[:, 2]) - 128))
    reject = chroma > BG_MAX_CHROMA or L < BG_MIN_L
    return {
        "background_L": round(L, 1),
        "background_chroma": round(chroma, 1),
        "ok": not reject,
        "warn": (not reject) and L < BG_WARN_L,
    }


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
    bg = check_background(img_bgr)
    if bg["warn"]:
        warnings.append("Zemin loş görünüyor. Beyaz kâğıt ve daha iyi ışık sonuçların güvenilirliğini artırır.")

    return {
        "background": bg,
        "blur_score": round(blur_score, 1),
        "brightness": round(brightness, 1),
        "ok": not warnings,
        "warnings": warnings,
    }
