import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/api";
import { HttpError, requireRole } from "@/lib/auth";
import { config } from "@/lib/config";
import { parseJson } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({ eventId: z.string(), action: z.enum(["tamper", "restore"]) });

type Data = Record<string, any>;

/** Bir "kötü niyetli veritabanı yöneticisinin" yapabileceği değişikliği taklit eder. dataHash'e DOKUNMAZ. */
function tamper(type: string, d: Data): { data: Data; description: string } {
  switch (type) {
    case "KALITE_ANALIZI": {
      const better = { grade: "SINIF_1", gradeLabel: "1. Sınıf" };
      const moisture = typeof d.moisturePct === "number" ? Math.round((d.moisturePct - 1.5) * 10) / 10 : d.moisturePct;
      const ratios = { ...(d.ratios ?? {}), SAGLIKLI: 0.991 };
      return {
        data: { ...d, ...better, moisturePct: moisture, ratios },
        description: `Kalite "${d.gradeLabel}" → "1. Sınıf", sağlıklı oran → %99,1, nem %${d.moisturePct} → %${moisture}`,
      };
    }
    case "PARTI_OLUSTURULDU":
      return {
        data: { ...d, quantityKg: Math.round(d.quantityKg * 1.5), province: "Konya", district: "Karatay" },
        description: `Miktar ${d.quantityKg} → ${Math.round(d.quantityKg * 1.5)} kg, menşei değiştirildi`,
      };
    case "DEPO_TESLIM":
      return { data: { ...d, receivedKg: d.receivedKg + 5000 }, description: `Depoya giren miktar +5 ton şişirildi` };
    case "ALICI_TESLIM":
      return { data: { ...d, purchasedKg: Math.max(1, d.purchasedKg - 5000) }, description: `Satılan miktar −5 ton düşürüldü` };
    default:
      throw new HttpError(400, "Bu olay türü kurcalanamaz.");
  }
}

export const POST = handle(async (req: Request) => {
  await requireRole("ADMIN");
  if (!config.demoMode) throw new HttpError(403, "DEMO_MODE kapalı.");
  const { eventId, action } = Body.parse(await req.json());

  const ev = await prisma.supplyEvent.findUnique({
    where: { id: eventId },
    include: { tamperLogs: { where: { restoredAt: null } }, lot: true },
  });
  if (!ev) throw new HttpError(404, "Olay bulunamadı.");
  const active = ev.tamperLogs[0];

  if (action === "tamper") {
    if (active) throw new HttpError(409, "Bu olay zaten kurcalanmış. Önce geri alın.");
    const { data, description } = tamper(ev.type, parseJson<Data>(ev.data, {}));
    await prisma.$transaction([
      prisma.tamperLog.create({ data: { eventId: ev.id, originalData: ev.data } }),
      prisma.supplyEvent.update({ where: { id: ev.id }, data: { data: JSON.stringify(data) } }),
    ]);
    return NextResponse.json({ ok: true, tampered: true, description, publicId: ev.lot.publicId });
  }

  if (!active) throw new HttpError(409, "Geri alınacak bir kurcalama yok.");
  await prisma.$transaction([
    prisma.supplyEvent.update({ where: { id: ev.id }, data: { data: active.originalData } }),
    prisma.tamperLog.update({ where: { id: active.id }, data: { restoredAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true, tampered: false, publicId: ev.lot.publicId });
});
