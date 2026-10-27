import base64

import cv2
import numpy as np

from .classes import CLASSES, COLORS_BGR, LABELS_TR


def draw_annotations(img_bgr: np.ndarray, grains, preds: list[tuple[str, float]], max_side: int = 1600) -> np.ndarray:
    """Her tanenin konturunu ve kutusunu sınıf rengiyle çizer; altta lejant şeridi ekler."""
    h, w = img_bgr.shape[:2]
    scale = min(1.0, max_side / max(h, w))
    out = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else img_bgr.copy()
    # Hafif karartma: renkli kutular daha iyi seçilsin
    out = cv2.addWeighted(out, 0.85, np.zeros_like(out), 0.15, 0)
    thick = max(2, int(round(max(out.shape[:2]) / 600)))

    overlay = out.copy()
    for g, (cls, conf) in zip(grains, preds):
        color = COLORS_BGR[cls]
        c = (g.contour.astype(np.float32) * scale).astype(np.int32)
        cv2.drawContours(overlay, [c], -1, color, -1)
    out = cv2.addWeighted(overlay, 0.28, out, 0.72, 0)

    for i, (g, (cls, conf)) in enumerate(zip(grains, preds), start=1):
        color = COLORS_BGR[cls]
        c = (g.contour.astype(np.float32) * scale).astype(np.int32)
        cv2.drawContours(out, [c], -1, color, thick)
        x, y, bw, bh = (int(v * scale) for v in g.bbox)
        cv2.rectangle(out, (x - 2, y - 2), (x + bw + 2, y + bh + 2), color, max(1, thick - 1))
        if cls != "SAGLIKLI":
            tag = f"{i}"
            fs = 0.35 * thick
            (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
            cv2.rectangle(out, (x - 2, y - th - 6), (x + tw + 4, y - 2), color, -1)
            cv2.putText(out, tag, (x + 1, y - 4), cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 255, 255), 1, cv2.LINE_AA)

    # Lejant şeridi
    counts = {k: 0 for k in CLASSES}
    for cls, _ in preds:
        counts[cls] += 1
    shown = [c for c in CLASSES if c == "SAGLIKLI" or counts[c] > 0]
    bar_h = max(36, out.shape[0] // 18)
    bar = np.full((bar_h, out.shape[1], 3), (22, 26, 27), dtype=np.uint8)
    x = 12
    fs = bar_h / 70
    for cls in shown:
        label = f"{LABELS_TR[cls]} {counts[cls]}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        if x + tw + 40 > out.shape[1]:
            break
        cv2.rectangle(bar, (x, bar_h // 2 - 7), (x + 14, bar_h // 2 + 7), COLORS_BGR[cls], -1)
        cv2.putText(bar, label, (x + 20, bar_h // 2 + th // 2), cv2.FONT_HERSHEY_SIMPLEX, fs, (235, 235, 235), 1, cv2.LINE_AA)
        x += tw + 44
    return np.vstack([out, bar])


def to_jpeg_base64(img_bgr: np.ndarray, quality: int = 85) -> str:
    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("JPEG kodlanamadı")
    return base64.b64encode(buf.tobytes()).decode("ascii")
