"""Ortak sınıf şeması. Renkler packages/shared/src/types.ts ile aynıdır."""

CLASSES = [
    "SAGLIKLI",
    "KIRIK_CATLAK",
    "BOCEK_SUNE_ZARARI",
    "KUFLU",
    "LEKELI_RENK_BOZUK",
    "BURUSUK_CILIZ",
]

LABELS_TR = {
    "SAGLIKLI": "Saglikli",
    "KIRIK_CATLAK": "Kirik/Catlak",
    "BOCEK_SUNE_ZARARI": "Bocek/Sune",
    "KUFLU": "Kuflu",
    "LEKELI_RENK_BOZUK": "Lekeli/Renk",
    "BURUSUK_CILIZ": "Burusuk/Ciliz",
}

COLORS_HEX = {
    "SAGLIKLI": "#2F9E44",
    "KIRIK_CATLAK": "#F08C00",
    "BOCEK_SUNE_ZARARI": "#E03131",
    "KUFLU": "#7048E8",
    "LEKELI_RENK_BOZUK": "#1C7ED6",
    "BURUSUK_CILIZ": "#D6336C",
}


def hex_to_bgr(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)


COLORS_BGR = {k: hex_to_bgr(v) for k, v in COLORS_HEX.items()}
