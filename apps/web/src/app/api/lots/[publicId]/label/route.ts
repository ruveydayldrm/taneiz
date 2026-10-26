import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { baseUrlFrom } from "@/lib/config";
import { formatDate, kg } from "@/lib/utils";

export const runtime = "nodejs";

// pdf-lib'in standart fontları Türkçe karakterleri (ğ, ş, ı, İ) içermez → etikette sadeleştir.
const tr = (s: string) =>
  s
    .replace(/ğ/g, "g").replace(/Ğ/g, "G").replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ı/g, "i").replace(/İ/g, "I").replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ü/g, "u").replace(/Ü/g, "U").replace(/ç/g, "c").replace(/Ç/g, "C").replace(/â/g, "a");

const mm = (v: number) => (v * 72) / 25.4;

/** 100 × 70 mm QR etiketi (çuval/silo için). */
export const GET = handle(async (req: Request, { params }: { params: { publicId: string } }) => {
  const lot = await prisma.lot.findUnique({
    where: { publicId: params.publicId.toUpperCase() },
    include: { reports: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!lot) throw new HttpError(404, "Parti bulunamadı.");
  const url = `${baseUrlFrom(req.headers)}/p/${lot.publicId}`;
  const qrPng = await QRCode.toBuffer(url, { margin: 0, width: 600, errorCorrectionLevel: "M" });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`TaneIZ etiket ${lot.publicId}`);
  const page = pdf.addPage([mm(100), mm(70)]);
  const { width, height } = page.getSize();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const ink = rgb(0.106, 0.102, 0.086);
  const gold = rgb(0.85, 0.64, 0.25);

  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.984, 0.969, 0.933) });
  page.drawRectangle({ x: 0, y: height - mm(11), width, height: mm(11), color: ink });
  page.drawText("TaneIZ", { x: mm(5), y: height - mm(7.6), size: 13, font: bold, color: gold });
  page.drawText("URUN PASAPORTU", { x: mm(25), y: height - mm(7.3), size: 7, font: bold, color: rgb(0.97, 0.95, 0.89) });

  const qr = await pdf.embedPng(qrPng);
  const qs = mm(46);
  page.drawImage(qr, { x: width - qs - mm(5), y: mm(6), width: qs, height: qs });

  const r = lot.reports[0];
  let y = height - mm(19);
  page.drawText(lot.publicId, { x: mm(5), y, size: 15, font: mono, color: ink });
  y -= mm(8);
  const rows: [string, string][] = [
    ["Urun", tr(`${lot.product} / ${lot.variety}`)],
    ["Mensei", tr(`${lot.district}, ${lot.province}`)],
    ["Hasat", tr(formatDate(lot.harvestDate))],
    ["Miktar", tr(kg(lot.quantityKg))],
    ["Kalite", r ? tr(`${r.gradeLabel} · nem %${r.moisture}`) : "-"],
  ];
  for (const [k, v] of rows) {
    page.drawText(k.toUpperCase(), { x: mm(5), y, size: 5.5, font: bold, color: rgb(0.48, 0.45, 0.39) });
    page.drawText(v.slice(0, 30), { x: mm(5), y: y - mm(3.4), size: 8, font: reg, color: ink });
    y -= mm(8.2);
  }
  page.drawText("Okutun ve zincirde dogrulayin", { x: width - qs - mm(5), y: mm(2.5), size: 5.5, font: reg, color: rgb(0.48, 0.45, 0.39) });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="taneiz-etiket-${lot.publicId}.pdf"`,
    },
  });
});
