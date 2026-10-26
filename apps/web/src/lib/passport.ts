import { EVENT_LABELS, type EventType } from "@taneiz/shared";
import { prisma } from "./prisma";
import { fileUrl } from "./storage";
import { explorerTxUrl } from "./chain";
import { formatDate, kg, parseJson, pct } from "./utils";

export interface TimelineItem {
  id: string;
  type: EventType;
  title: string;
  at: string;
  lines: string[];
  dataHash: string;
  chainStatus: string;
  chainIndex: number | null;
  txHash: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
  lastError: string | null;
}

type Data = Record<string, any>;

function describe(type: EventType, d: Data): string[] {
  switch (type) {
    case "PARTI_OLUSTURULDU":
      return [
        `${d.product ?? "Buğday"} · ${d.variety ?? "—"} · ${typeof d.quantityKg === "number" ? kg(d.quantityKg) : "—"}`,
        `${d.province ?? ""} / ${d.district ?? ""} · Hasat ${d.harvestDate ? formatDate(d.harvestDate) : "—"}`,
      ];
    case "KALITE_ANALIZI":
      return [
        `${d.gradeLabel ?? d.grade} · Sağlıklı ${pct(d.ratios?.SAGLIKLI ?? 0)} · ${d.grainCount ?? "?"} tane`,
        `Nem %${String(d.moisturePct ?? "—").replace(".", ",")} (cihaz) · Model ${d.modelVersion ?? "—"}`,
      ];
    case "DEPO_TESLIM":
      return [
        `${d.warehouseName ?? "Depo"} · ${typeof d.receivedKg === "number" ? kg(d.receivedKg) : "—"} teslim alındı`,
        `${d.province ?? ""} / ${d.district ?? ""}${d.note ? ` · ${d.note}` : ""}`,
      ];
    case "ALICI_TESLIM":
      return [
        `${d.buyerName ?? "Alıcı"} · ${typeof d.purchasedKg === "number" ? kg(d.purchasedKg) : "—"} satın alındı`,
        `Varış: ${d.destination ?? "—"}${d.note ? ` · ${d.note}` : ""}`,
      ];
    default:
      return [];
  }
}

export async function loadPassport(publicId: string) {
  const lot = await prisma.lot.findUnique({
    where: { publicId },
    include: {
      reports: { orderBy: { createdAt: "desc" }, take: 1 },
      events: { orderBy: { seq: "asc" } },
    },
  });
  if (!lot) return null;

  const events = lot.events.map((e) => ({ ...e, parsed: parseJson<Data>(e.data, {}) }));
  // Pasaporttaki bilgiler, hash'i zincire yazılan olay verisinden okunur (kurcalama görünür olsun).
  const created = events.find((e) => e.type === "PARTI_OLUSTURULDU")?.parsed ?? {};
  const quality = [...events].reverse().find((e) => e.type === "KALITE_ANALIZI")?.parsed ?? null;
  const report = lot.reports[0] ?? null;

  const images = report ? parseJson<{ path: string }[]>(report.images, []) : [];
  const annotated = report ? parseJson<{ path: string }[]>(report.annotatedImages, []) : [];

  const timeline: TimelineItem[] = events.map((e) => ({
    id: e.id,
    type: e.type as EventType,
    title: EVENT_LABELS[e.type as EventType] ?? e.type,
    at: e.createdAt.toISOString(),
    lines: describe(e.type as EventType, e.parsed),
    dataHash: e.dataHash,
    chainStatus: e.chainStatus,
    chainIndex: e.chainIndex,
    txHash: e.txHash,
    blockNumber: e.blockNumber,
    explorerUrl: explorerTxUrl(e.txHash),
    lastError: e.lastError,
  }));

  return {
    publicId: lot.publicId,
    status: lot.status,
    product: (created.product as string) ?? lot.product,
    variety: (created.variety as string) ?? lot.variety,
    harvestDate: (created.harvestDate as string) ?? lot.harvestDate.toISOString(),
    quantityKg: (created.quantityKg as number) ?? lot.quantityKg,
    province: (created.province as string) ?? lot.province,
    district: (created.district as string) ?? lot.district,
    lotChainStatus: lot.chainStatus,
    quality: quality
      ? {
          grade: quality.grade as string,
          gradeLabel: quality.gradeLabel as string,
          ratios: (quality.ratios ?? {}) as Record<string, number>,
          moisture: quality.moisturePct as number,
          grainCount: quality.grainCount as number,
          avgConfidence: quality.avgConfidence as number,
          modelVersion: quality.modelVersion as string,
        }
      : null,
    counts: report ? parseJson<Record<string, number>>(report.counts, {}) : undefined,
    warnings: report ? parseJson<string[]>(report.warnings, []) : [],
    pairs: images.map((img, i) => ({ original: fileUrl(img.path), annotated: fileUrl(annotated[i]?.path ?? img.path) })),
    timeline,
  };
}

export type Passport = NonNullable<Awaited<ReturnType<typeof loadPassport>>>;

export const STATUS_TR: Record<string, string> = { HASAT: "Üreticide", DEPODA: "Depoda", SATILDI: "Satıldı" };
