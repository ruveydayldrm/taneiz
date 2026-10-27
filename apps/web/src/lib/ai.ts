import type { AnalysisResult } from "@taneiz/shared";
import { HttpError } from "./auth";
import { config } from "./config";

export type AiAnalyzeResponse = Omit<AnalysisResult, "images"> & {
  images: (AnalysisResult["images"][number] & { annotated_jpeg_base64: string })[];
};

export async function analyzeWithAi(files: { data: Uint8Array; name: string; type: string }[]) {
  const form = new FormData();
  for (const f of files) form.append("files", new Blob([f.data], { type: f.type }), f.name);

  let res: Response;
  try {
    res = await fetch(`${config.aiServiceUrl}/analyze`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new HttpError(503, `Yapay zekâ servisine ulaşılamadı (${config.aiServiceUrl}). Servis çalışıyor mu?`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : "Analiz başarısız oldu.";
    throw new HttpError(res.status === 503 ? 503 : 422, detail);
  }
  return body as AiAnalyzeResponse;
}

export async function fetchModelCard(): Promise<{ ok: true; card: ModelCard } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${config.aiServiceUrl}/model-card`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.detail ?? "Model kartı alınamadı." };
    const m = body?.test_metrics;
    if (!m?.per_class || !Array.isArray(m.confusion_matrix) || !Array.isArray(body.classes)) {
      return { ok: false, error: `Model kartında (${body?.model_version ?? "?"}) kilitli test seti metrikleri yok. ml/evaluate.py çalıştırılmalı.` };
    }
    return { ok: true, card: { datasets: [], limitations: [], split_counts: {}, ...body } as ModelCard };
  } catch {
    return { ok: false, error: `Yapay zekâ servisine ulaşılamadı (${config.aiServiceUrl}).` };
  }
}

export interface ModelCard {
  model_name: string;
  model_version: string;
  architecture: string;
  created_at: string;
  classes: string[];
  input_size: number;
  preprocessing?: string;
  excluded_classes?: Record<string, { unique_grains: number; reason: string }>;
  datasets: { name: string; source: string; license: string; images_used: number }[];
  split_counts: Record<string, Record<string, number>>;
  test_metrics: {
    accuracy: number;
    macro_f1: number;
    weighted_f1: number;
    n_test: number;
    per_class: Record<string, { precision: number; recall: number; f1: number; support: number }>;
    confusion_matrix: number[][];
  };
  test_set_lock?: { sha256: string; count: number };
  onnx?: { sha256: string; max_abs_diff: number; max_prob_diff?: number; argmax_agreement: number; opset: number };
  confusion_matrix_image?: string;
  samples?: Record<string, { path: string; true: string; pred: string; confidence: number }[]>;
  training?: Record<string, unknown>;
  pipeline_eval?: {
    description: string;
    grain_recall: number;
    healthy_ratio_mae: number;
    samples: { file: string; true_grains: number; found_grains: number; true_healthy: number; pred_healthy: number; ms: number }[];
  };
  limitations: string[];
}
