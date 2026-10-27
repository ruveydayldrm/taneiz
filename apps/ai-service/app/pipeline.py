import time

import numpy as np

from .annotate import draw_annotations, to_jpeg_base64
from .classes import CLASSES
from .grading import grade
from .model import GrainClassifier
from .preprocess import PREPROCESS_VERSION, crop_grain, normalize_grain
from .quality import check_image_quality
from .segment import segment_grains


class NoGrainsFound(ValueError):
    pass


def analyze_images(images_bgr: list[np.ndarray], clf: GrainClassifier, rules: dict) -> dict:
    t0 = time.perf_counter()
    per_image = []
    all_preds: list[tuple[str, float]] = []
    warnings: list[str] = []
    grains_out = []

    for idx, img in enumerate(images_bgr):
        quality = check_image_quality(img)
        warnings += [f"Fotoğraf {idx + 1}: {w}" for w in quality["warnings"]]
        grains, rejected = segment_grains(img)
        crops = []
        for g in grains:
            crop, mask = crop_grain(img, g.bbox, g.contour)
            crops.append(normalize_grain(crop, mask) if clf.preprocessing == PREPROCESS_VERSION else crop)
        preds = clf.predict(crops) if crops else []
        all_preds += preds
        annotated = draw_annotations(img, grains, preds)
        for g, (cls, conf) in zip(grains, preds):
            grains_out.append({"image": idx, "bbox": list(g.bbox), "class": cls, "confidence": round(conf, 4)})
        per_image.append(
            {
                "index": idx,
                "width": int(img.shape[1]),
                "height": int(img.shape[0]),
                "grain_count": len(grains),
                "rejected_contours": rejected,
                "quality": quality,
                "annotated_jpeg_base64": to_jpeg_base64(annotated),
            }
        )

    n = len(all_preds)
    if n == 0:
        raise NoGrainsFound(
            "Fotoğrafta tane bulunamadı. Taneleri açık renkli, düz bir zemine birbirine değmeyecek şekilde dağıtıp tekrar çekin."
        )

    # Yalnızca modelin bildiği sınıflar raporlanır; diğerleri "ölçülmedi"dir, %0 değil.
    counts = {c: 0 for c in CLASSES if c in getattr(clf, "classes", CLASSES)}
    for cls, _ in all_preds:
        counts[cls] = counts.get(cls, 0) + 1
    ratios = {c: counts[c] / n for c in counts}
    avg_conf = float(np.mean([p for _, p in all_preds]))

    min_reliable = int(rules.get("min_grains_for_reliable", 50))
    if n < min_reliable:
        warnings.append(f"Yalnızca {n} tane bulundu; güvenilir bir oran için en az {min_reliable} tane önerilir.")
    low_conf = sum(1 for _, p in all_preds if p < 0.6)
    if low_conf / n > 0.2:
        warnings.append(f"Tanelerin %{low_conf / n * 100:.0f}'inde model güveni düşük (<%60). Sonucu dikkatle yorumlayın.")

    return {
        "grain_count": n,
        "counts": counts,
        "ratios": ratios,
        "avg_confidence": avg_conf,
        "grade": grade(ratios, rules),
        "warnings": warnings,
        "model_version": clf.version,
        "processing_ms": int((time.perf_counter() - t0) * 1000),
        "images": per_image,
        "grains": grains_out,
    }
