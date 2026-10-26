import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/api";
import { HttpError, requireRole } from "@/lib/auth";
import { appendEvent } from "@/lib/lots";
import { kickChainQueue } from "@/lib/queue";

export const runtime = "nodejs";

const Depo = z.object({
  type: z.literal("DEPO_TESLIM"),
  warehouseName: z.string().min(2).max(80),
  receivedKg: z.coerce.number().positive(),
  province: z.string().min(2).max(40),
  district: z.string().min(2).max(40),
  note: z.string().max(200).optional(),
});
const Alici = z.object({
  type: z.literal("ALICI_TESLIM"),
  buyerName: z.string().min(2).max(80),
  purchasedKg: z.coerce.number().positive(),
  destination: z.string().min(2).max(80),
  note: z.string().max(200).optional(),
});
const Body = z.discriminatedUnion("type", [Depo, Alici]);

export const POST = handle(async (req: Request, { params }: { params: { publicId: string } }) => {
  const body = Body.parse(await req.json());
  const user = await requireRole(body.type === "DEPO_TESLIM" ? "DEPO" : "ALICI");

  const lot = await prisma.lot.findUnique({ where: { publicId: params.publicId.toUpperCase() } });
  if (!lot) throw new HttpError(404, "Parti bulunamadı.");
  if (lot.status === "SATILDI") throw new HttpError(409, "Bu parti zaten satılmış.");
  if (body.type === "DEPO_TESLIM" && lot.status === "DEPODA") throw new HttpError(409, "Bu parti zaten depoda.");

  const { type, note, ...rest } = body;
  const qty = type === "DEPO_TESLIM" ? (rest as { receivedKg: number }).receivedKg : (rest as { purchasedKg: number }).purchasedKg;
  if (qty > lot.quantityKg * 1.05) throw new HttpError(400, "Miktar, partinin kayıtlı miktarını aşıyor.");

  const event = await prisma.$transaction(async (tx) => {
    const ev = await appendEvent(tx, {
      lotId: lot.id,
      publicId: lot.publicId,
      type,
      actorId: user.id,
      payload: { role: type === "DEPO_TESLIM" ? "DEPO" : "ALICI", ...rest, ...(note ? { note } : {}) },
    });
    await tx.lot.update({ where: { id: lot.id }, data: { status: type === "DEPO_TESLIM" ? "DEPODA" : "SATILDI" } });
    return ev;
  });
  kickChainQueue();
  return NextResponse.json({ id: event.id, publicId: lot.publicId });
});
