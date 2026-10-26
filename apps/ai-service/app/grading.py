from pathlib import Path

import yaml

from . import config


def load_rules(path: Path = config.GRADING_RULES_FILE) -> dict:
    with open(path, encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    if not rules.get("grades"):
        raise ValueError("grading_rules.yaml: en az bir 'grades' kuralı gerekli")
    return rules


def grade(ratios: dict[str, float], rules: dict) -> dict:
    basis = rules.get("basis_class", "SAGLIKLI")
    healthy = ratios.get(basis, 0.0)
    for g in rules["grades"]:
        if healthy < g.get("min_ratio", 0.0):
            continue
        limits = g.get("max_defect_ratios") or {}
        exceeded = [k for k, lim in limits.items() if ratios.get(k, 0.0) > lim]
        if exceeded:
            continue
        rule = f"{basis} ≥ %{g.get('min_ratio', 0) * 100:.0f}"
        if limits:
            rule += " ve " + ", ".join(f"{k} ≤ %{v * 100:.0f}" for k, v in limits.items())
        return {"code": g["code"], "label": g["label"], "rule": rule, "disclaimer": rules.get("disclaimer", "")}
    last = rules["grades"][-1]
    return {"code": last["code"], "label": last["label"], "rule": "varsayılan", "disclaimer": rules.get("disclaimer", "")}
