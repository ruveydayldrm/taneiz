export const ROLES = ["URETICI", "DEPO", "ALICI", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

/** Zincirdeki uint8 olay türleri. Sıra değişmemeli; kontrat yalnızca sayıyı saklar. */
export const EVENT_TYPES = {
  PARTI_OLUSTURULDU: 1,
  KALITE_ANALIZI: 2,
  DEPO_TESLIM: 3,
  ALICI_TESLIM: 4,
} as const;
export type EventType = keyof typeof EVENT_TYPES;

export const EVENT_LABELS: Record<EventType, string> = {
  PARTI_OLUSTURULDU: "Parti oluşturuldu",
  KALITE_ANALIZI: "Yapay zekâ kalite analizi",
  DEPO_TESLIM: "Depoya teslim alındı",
  ALICI_TESLIM: "Alıcı satın aldı",
};

export const GRAIN_CLASSES = [
  "SAGLIKLI",
  "KIRIK_CATLAK",
  "BOCEK_SUNE_ZARARI",
  "KUFLU",
  "LEKELI_RENK_BOZUK",
  "BURUSUK_CILIZ",
] as const;
export type GrainClass = (typeof GRAIN_CLASSES)[number];

/** AI servisindeki açıklama görüntüsüyle aynı renkler (apps/ai-service/app/classes.py). */
export const CLASS_META: Record<GrainClass, { label: string; color: string }> = {
  SAGLIKLI: { label: "Sağlıklı", color: "#2F9E44" },
  KIRIK_CATLAK: { label: "Kırık / Çatlak", color: "#F08C00" },
  BOCEK_SUNE_ZARARI: { label: "Böcek / Süne zararı", color: "#E03131" },
  KUFLU: { label: "Küflü", color: "#7048E8" },
  LEKELI_RENK_BOZUK: { label: "Lekeli / Renk bozuk", color: "#1C7ED6" },
  BURUSUK_CILIZ: { label: "Buruşuk / Cılız", color: "#D6336C" },
};

export interface AnalysisGrade {
  code: string;
  label: string;
  rule: string;
  disclaimer: string;
}

/** AI servisinin POST /analyze yanıtı (görüntü base64 alanları hariç). */
export interface AnalysisResult {
  grain_count: number;
  counts: Record<string, number>;
  ratios: Record<string, number>;
  avg_confidence: number;
  grade: AnalysisGrade;
  warnings: string[];
  model_version: string;
  processing_ms: number;
  images: {
    index: number;
    width: number;
    height: number;
    grain_count: number;
    rejected_contours: number;
    quality: { blur_score: number; brightness: number; ok: boolean; warnings: string[] };
  }[];
}
