import { prisma } from "@/lib/prisma";
import { ScanFlow } from "@/components/scan-flow";

export const metadata = { title: "Alıcı" };
export const dynamic = "force-dynamic";

export default async function AliciPage() {
  const recent = await prisma.lot.findMany({
    where: { status: { in: ["HASAT", "DEPODA"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { publicId: true, variety: true, district: true },
  });
  return (
    <main className="container py-10">
      <p className="eyebrow">Alıcı</p>
      <h1 className="display mt-1 text-4xl font-semibold sm:text-5xl">Önce doğrula, sonra satın al.</h1>
      <p className="mt-1 max-w-xl text-ink-mute">QR'ı okutun, pasaportu ve zincir doğrulamasını görün, satın alma kaydını mühürleyin.</p>
      <ScanFlow mode="ALICI_TESLIM" recent={recent} />
    </main>
  );
}
