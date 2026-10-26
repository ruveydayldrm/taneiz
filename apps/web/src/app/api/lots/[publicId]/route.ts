import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";

/** Depo/alıcı tarama ekranı için herkese açık kısa özet. */
export const GET = handle(async (_req: Request, { params }: { params: { publicId: string } }) => {
  const lot = await prisma.lot.findUnique({
    where: { publicId: params.publicId.toUpperCase() },
    include: { reports: { orderBy: { createdAt: "desc" }, take: 1 }, events: { orderBy: { seq: "asc" } } },
  });
  if (!lot) throw new HttpError(404, "Parti bulunamadı.");
  const r = lot.reports[0];
  return NextResponse.json({
    publicId: lot.publicId,
    product: lot.product,
    variety: lot.variety,
    quantityKg: lot.quantityKg,
    province: lot.province,
    district: lot.district,
    status: lot.status,
    harvestDate: lot.harvestDate,
    grade: r?.grade ?? null,
    gradeLabel: r?.gradeLabel ?? null,
    moisture: r?.moisture ?? null,
    events: lot.events.map((e) => ({ type: e.type, at: e.createdAt, chainStatus: e.chainStatus })),
  });
});
