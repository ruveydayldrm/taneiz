"""Veri setlerini ortak şemaya eşler, birleştirir, dengesizliği raporlar ve 70/15/15 böler.

Test seti KİLİTLENİR: data/splits/test.lock.json, test.csv'nin SHA-256'sını saklar.
Kilit varken bölme yeniden üretilmez (--force ile bilerek bozulabilir). evaluate.py kilidi denetler.

Kullanım:
    python ml/prepare_data.py                 # ml/data/raw altındaki setler
    python ml/prepare_data.py --raw-dir /content/drive/MyDrive/taneiz/raw
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

from common import IMG_EXTS, RAW_DIR, SPLITS_DIR, sha256_file, write_json


def norm(s: str) -> str:
    return s.strip().lower()


def scan(raw_dir: Path, label_map: dict):
    targets = label_map["target_classes"]
    rows, report, unmapped = [], {}, defaultdict(Counter)
    for ds_name, ds in label_map["datasets"].items():
        root = raw_dir / ds["dir"]
        if not root.exists():
            print(f"  [atla] {ds_name}: {root} bulunamadı")
            continue
        mapping = {norm(k): v for k, v in (ds.get("labels") or {}).items()}
        group_re = re.compile(ds["group_regex"], re.IGNORECASE) if ds.get("group_regex") else None
        src_counts = Counter()
        # label_glob: etiket klasörlerinin konumu (ör. "*/images/*" → <bölme>/images/<etiket>)
        for folder in sorted(p for p in root.glob(ds.get("label_glob", "*")) if p.is_dir()):
            key = norm(folder.name)
            files = [p for p in folder.rglob("*") if p.suffix.lower() in IMG_EXTS]
            if key not in mapping:
                unmapped[ds_name][folder.name] += len(files)
                continue
            target = mapping[key]
            if target is None:
                continue
            if target not in targets:
                sys.exit(f"label_map.yaml: {ds_name}/{folder.name} → bilinmeyen hedef sınıf {target}")
            for p in files:
                m = group_re.match(p.name) if group_re else None
                group = f"{ds_name}/{folder.name}/{m.group(1) if m else p.stem}"
                rows.append({"path": p.relative_to(raw_dir).as_posix(), "label": target, "dataset": ds_name, "group": group})
                src_counts[f"{folder.name} → {target}"] += 1
        report[ds_name] = dict(src_counts)
    return rows, report, dict(unmapped)


def dedupe(rows, raw_dir: Path):
    seen, out, dup = {}, [], 0
    for r in rows:
        h = sha256_file(raw_dir / r["path"])
        if h in seen:
            dup += 1
            continue
        seen[h] = r
        r["sha256"] = h
        out.append(r)
    return out, dup


def split(rows, seed: int, ratios=(0.70, 0.15, 0.15)):
    """Sınıf bazında tabakalı, grup farkındalıklı bölme (aynı grup aynı bölmede kalır)."""
    rng = np.random.default_rng(seed)
    by_class = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_class[r["label"]][r["group"]].append(r)
    out = {"train": [], "val": [], "test": []}
    for label in sorted(by_class):
        groups = sorted(by_class[label])
        rng.shuffle(groups)
        n = len(groups)
        n_test = max(1, round(n * ratios[2])) if n >= 3 else 0
        n_val = max(1, round(n * ratios[1])) if n >= 3 else 0
        parts = {"test": groups[:n_test], "val": groups[n_test : n_test + n_val], "train": groups[n_test + n_val :]}
        for s, gs in parts.items():
            for g in gs:
                out[s].extend(by_class[label][g])
    return out


def write_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "label", "dataset", "group", "sha256"])
        w.writeheader()
        for r in sorted(rows, key=lambda r: r["path"]):
            w.writerow(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    ap.add_argument("--label-map", type=Path, default=Path(__file__).parent / "label_map.yaml")
    ap.add_argument("--out", type=Path, default=SPLITS_DIR)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--force", action="store_true", help="Kilitli test setini bilerek yeniden üret")
    ap.add_argument("--min-groups", type=int, default=20, help="Bir sınıfın eğitime alınması için gereken en az farklı tane (grup) sayısı")
    args = ap.parse_args()

    lock_file = args.out / "test.lock.json"
    if lock_file.exists() and not args.force:
        print(f"Test seti kilitli ({lock_file}). Bölme yeniden üretilmedi.")
        print("Bilerek yeniden üretmek için --force kullanın (önceki metrikler geçersiz olur).")
        return

    label_map = yaml.safe_load(open(args.label_map, encoding="utf-8"))
    print(f"Taranıyor: {args.raw_dir}")
    rows, src_report, unmapped = scan(args.raw_dir, label_map)
    if not rows:
        sys.exit("Hiç görüntü bulunamadı. DATASETS.md'deki indirme ve klasör talimatlarına bakın.")
    rows, dup = dedupe(rows, args.raw_dir)

    # Çok az farklı taneye sahip sınıflar güvenilir biçimde test edilemez → dışarıda bırak ve raporla.
    groups_per_class = {c: len({r["group"] for r in rows if r["label"] == c}) for c in {r["label"] for r in rows}}
    excluded = {c: n for c, n in groups_per_class.items() if n < args.min_groups}
    rows = [r for r in rows if r["label"] not in excluded]
    splits = split(rows, args.seed)

    counts = Counter(r["label"] for r in rows)
    present = [c for c in label_map["target_classes"] if counts.get(c)]
    imbalance = max(counts.values()) / max(1, min(counts[c] for c in present))
    split_counts = {s: dict(Counter(r["label"] for r in rs)) for s, rs in splits.items()}

    for s, rs in splits.items():
        write_csv(args.out / f"{s}.csv", rs)
    test_hash = sha256_file(args.out / "test.csv")
    write_json(
        lock_file,
        {"sha256": test_hash, "count": len(splits["test"]), "seed": args.seed, "created_at": datetime.now(timezone.utc).isoformat()},
    )

    report = {
        "raw_dir": str(args.raw_dir),
        "total_images": len(rows),
        "duplicates_removed": dup,
        "classes": present,
        "class_counts": dict(counts),
        "unique_grains_per_class": {c: groups_per_class[c] for c in present},
        "excluded_classes": {c: {"unique_grains": n, "reason": f"< {args.min_groups} farklı tane"} for c, n in excluded.items()},
        "missing_classes": [c for c in label_map["target_classes"] if not counts.get(c) and c not in excluded],
        "imbalance_ratio_max_min": round(imbalance, 2),
        "split_counts": split_counts,
        "source_mapping": src_report,
        "unmapped_folders": unmapped,
        "datasets": {k: {"source": v.get("source"), "license": v.get("license")} for k, v in label_map["datasets"].items()},
    }
    write_json(args.out / "report.json", report)

    print(f"\nToplam {len(rows)} görüntü ({dup} kopya elendi)")
    print(f"{'Sınıf':<20}{'train':>8}{'val':>8}{'test':>8}")
    for c in label_map["target_classes"]:
        print(f"{c:<20}" + "".join(f"{split_counts[s].get(c, 0):>8}" for s in ("train", "val", "test")))
    print(f"\nDengesizlik oranı (en çok / en az): {imbalance:.1f}x → train.py sınıf ağırlıklı kayıp kullanır")
    print(f"Eğitilecek sınıflar: {present}")
    if excluded:
        print(f"Az örnekli olduğu için dışarıda bırakılan sınıflar (farklı tane sayısı): {excluded}")
    if report["missing_classes"]:
        print(f"UYARI: hiç örneği olmayan sınıflar: {report['missing_classes']}")
    if unmapped:
        print("Eşlenmemiş klasörler (label_map.yaml'a ekleyin ya da null yapın):")
        for ds, fs in unmapped.items():
            print(f"  {ds}: {', '.join(f'{k} ({v})' for k, v in fs.items())}")
    print(f"\nTest seti kilitlendi: {lock_file} (sha256 {test_hash[:16]}…)")


if __name__ == "__main__":
    main()
