"""Klasik OpenCV segmentasyonu: açık renkli düz zemin üzerinde dağıtılmış taneler.

1. Aydınlatma düzeltmeli arka plan çıkarma (zemin parlak, taneler koyu/doygun)
2. Otsu eşikleme + morfolojik temizlik + delik doldurma
3. Mesafe dönüşümü + bileşen başına göreli tepe noktaları → watershed ile değen taneleri ayırma
4. Medyan alana göre çok küçük (toz, kırıntı) ve çok büyük (yığın, gölge) konturları eleme
"""
from dataclasses import dataclass

import cv2
import numpy as np

from . import config


@dataclass
class Grain:
    contour: np.ndarray  # orijinal görüntü koordinatlarında
    bbox: tuple[int, int, int, int]  # x, y, w, h
    area: float


MIN_COLOR_DISTANCE = 14  # LAB'de zeminden en az bu kadar farklı pikseller tane adayıdır


def _foreground_mask(work: np.ndarray) -> np.ndarray:
    # Ön plan = yerel zemin renginden LAB uzaklığı. Yalnızca "koyuluk/doygunluk"a bakmak
    # siyah-beyaz ya da çok açık renkli taneleri kaçırıyor ve tanenin parlak kısımlarını kesiyordu.
    lab = cv2.cvtColor(work, cv2.COLOR_BGR2LAB)
    h, w = lab.shape[:2]
    small = cv2.resize(lab, (max(w // 8, 1), max(h // 8, 1)), interpolation=cv2.INTER_AREA)
    # Taneler küçük olduğundan büyük çekirdekli medyan, yerel zemin rengini verir (aydınlatma gradyanı dahil)
    k = max(5, (min(small.shape[:2]) // 5) | 1)
    bg = cv2.medianBlur(small, min(k, 255))
    bg = cv2.resize(cv2.GaussianBlur(bg, (0, 0), 3), (w, h), interpolation=cv2.INTER_LINEAR)

    diff = lab.astype(np.float32) - bg.astype(np.float32)
    diff[..., 0] *= 0.8  # parlaklık farkına (gölge) renk farkından biraz daha az ağırlık
    dist = np.sqrt((diff**2).sum(axis=2))
    feat = cv2.GaussianBlur(np.clip(dist * 4, 0, 255).astype(np.uint8), (5, 5), 0)
    otsu, _ = cv2.threshold(feat, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Boş zeminde Otsu gürültüyü ayırır; mutlak bir alt sınırla bunu engelle
    _, mask = cv2.threshold(feat, max(otsu, MIN_COLOR_DISTANCE * 4), 255, cv2.THRESH_BINARY)

    # Kenarların çoğu ön plan çıktıysa (koyu zemin) ters çevir
    border = np.concatenate([mask[0, :], mask[-1, :], mask[:, 0], mask[:, -1]])
    if border.mean() > 127:
        mask = cv2.bitwise_not(mask)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)), iterations=1)

    # Delik doldurma (tane içindeki parlak yansımalar)
    flood = mask.copy()
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    return mask | cv2.bitwise_not(flood)


def _watershed_split(work: np.ndarray, mask: np.ndarray) -> np.ndarray:
    dist = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    n, comp, stats, _ = cv2.connectedComponentsWithStats(mask)
    areas = stats[1:, cv2.CC_STAT_AREA]
    median = float(np.median(areas)) if len(areas) else 0.0
    sure_fg = np.zeros_like(mask)
    # Bileşen başına göreli eşik. Tek tane boyutundaki bileşen tek tepe verir; tek taneden
    # belirgin büyük bileşenlerde (değen taneler) ayrışma sağlanana kadar eşik yükseltilir.
    for i in range(1, n):
        region = comp == i
        dmax = dist[region].max()
        if dmax <= 0:
            continue
        seeds = region & (dist >= 0.5 * dmax)
        if median and stats[i, cv2.CC_STAT_AREA] > 1.5 * median:
            for f in (0.6, 0.7, 0.8):
                cand = region & (dist >= f * dmax)
                if cv2.connectedComponents(np.uint8(cand))[0] - 1 >= 2:
                    seeds = cand
                    break
        sure_fg[seeds] = 255

    sure_bg = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=2)
    unknown = cv2.subtract(sure_bg, sure_fg)
    _, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(work, markers.astype(np.int32))
    return markers


def segment_grains(img_bgr: np.ndarray) -> tuple[list[Grain], int]:
    """Taneleri bulur. Dönüş: (taneler, elenen kontur sayısı)."""
    h, w = img_bgr.shape[:2]
    scale = min(1.0, config.SEGMENT_MAX_SIDE / max(h, w))
    work = cv2.resize(img_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1 else img_bgr.copy()

    mask = _foreground_mask(work)
    markers = _watershed_split(work, mask)

    contours = []
    for label in np.unique(markers):
        if label <= 1:  # -1 sınır, 1 arka plan
            continue
        region = np.uint8(markers == label) * 255
        cs, _ = cv2.findContours(region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if cs:
            c = max(cs, key=cv2.contourArea)
            contours.append(c)

    if not contours:
        return [], 0

    areas = np.array([cv2.contourArea(c) for c in contours])
    min_abs = max(25.0, work.shape[0] * work.shape[1] * 0.00002)
    valid = areas[areas >= min_abs]
    median = float(np.median(valid)) if len(valid) else 0.0

    grains: list[Grain] = []
    rejected = 0
    for c, a in zip(contours, areas):
        if a < min_abs or (median > 0 and (a < 0.25 * median or a > 3.5 * median)):
            rejected += 1
            continue
        c_orig = (c.astype(np.float32) / scale).astype(np.int32)
        x, y, bw, bh = cv2.boundingRect(c_orig)
        grains.append(Grain(contour=c_orig, bbox=(x, y, bw, bh), area=float(a / (scale * scale))))

    # Okuma sırası: yukarıdan aşağı, soldan sağa
    grains.sort(key=lambda g: (g.bbox[1] // max(1, int(np.sqrt(median) / scale)), g.bbox[0]))
    return grains, rejected
