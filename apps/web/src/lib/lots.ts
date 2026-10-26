import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashEventData, type AnalysisResult, type EventType } from "@taneiz/shared";
import { prisma } from "./prisma";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newPublicId() {
  const bytes = crypto.randomBytes(6);
  return "TZ-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

type Tx = Prisma.TransactionClient;

/**
 * Olay verisini oluşturur, kanonik hash'ini alır ve kuyruğa (PENDING) ekler.
 * Zincirde yalnızca dataHash saklanır; veri kişisel bilgi içermez (yalnızca rol).
 */
export async function appendEvent(
  tx: Tx,
  args: { lotId: string; publicId: string; type: EventType; payload: Record<string, unknown>; actorId?: string; at?: Date },
) {
  const at = args.at ?? new Date();
  const last = await tx.supplyEvent.findFirst({ where: { lotId: args.lotId }, orderBy: { seq: "desc" } });
  const seq = (last?.seq ?? -1) + 1;
  const data = { schema: "taneiz.event.v1", lot: args.publicId, type: args.type, seq, at: at.toISOString(), ...args.payload };
  return tx.supplyEvent.create({
    data: {
      lotId: args.lotId,
      seq,
      type: args.type,
      data: JSON.stringify(data),
      dataHash: hashEventData(data),
      actorId: args.actorId,
      createdAt: at,
    },
  });
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

export interface LotInfo {
  product: string;
  variety: string;
  harvestDate: Date;
  quantityKg: number;
  province: string;
  district: string;
}

export async function createLotWithAnalysis(args: {
  publicId?: string;
  ownerId: string;
  info: LotInfo;
  moisture: number;
  analysis: AnalysisResult;
  images: { path: string; sha256: string }[];
  annotated: { path: string; sha256: string }[];
  createdAt?: Date;
  analyzedAt?: Date;
}) {
  const publicId = args.publicId ?? newPublicId();
  const createdAt = args.createdAt ?? new Date();
  const analyzedAt = args.analyzedAt ?? createdAt;
  const ratios = Object.fromEntries(Object.entries(args.analysis.ratios).map(([k, v]) => [k, round4(v)]));

  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.create({
      data: { publicId, ownerId: args.ownerId, ...args.info, createdAt },
    });
    await tx.qualityReport.create({
      data: {
        lotId: lot.id,
        images: JSON.stringify(args.images),
        annotatedImages: JSON.stringify(args.annotated),
        grainCount: args.analysis.grain_count,
        ratios: JSON.stringify(ratios),
        counts: JSON.stringify(args.analysis.counts),
        grade: args.analysis.grade.code,
        gradeLabel: args.analysis.grade.label,
        moisture: args.moisture,
        avgConfidence: round4(args.analysis.avg_confidence),
        modelVersion: args.analysis.model_version,
        warnings: JSON.stringify(args.analysis.warnings),
        createdAt: analyzedAt,
      },
    });
    await appendEvent(tx, {
      lotId: lot.id,
      publicId,
      type: "PARTI_OLUSTURULDU",
      actorId: args.ownerId,
      at: createdAt,
      payload: {
        role: "URETICI",
        product: args.info.product,
        variety: args.info.variety,
        harvestDate: args.info.harvestDate.toISOString().slice(0, 10),
        quantityKg: args.info.quantityKg,
        province: args.info.province,
        district: args.info.district,
      },
    });
    await appendEvent(tx, {
      lotId: lot.id,
      publicId,
      type: "KALITE_ANALIZI",
      actorId: args.ownerId,
      at: analyzedAt,
      payload: {
        role: "URETICI",
        grade: args.analysis.grade.code,
        gradeLabel: args.analysis.grade.label,
        grainCount: args.analysis.grain_count,
        ratios,
        avgConfidence: round4(args.analysis.avg_confidence),
        moisturePct: args.moisture,
        moistureSource: "cihaz-elle-giris",
        modelVersion: args.analysis.model_version,
        images: { originals: args.images.map((i) => i.sha256), annotated: args.annotated.map((i) => i.sha256) },
      },
    });
    return lot;
  });
}
