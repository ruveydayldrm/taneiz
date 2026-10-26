import { prisma } from "@/lib/prisma";
import { ScanFlow } from "@/components/scan-flow";

export const metadata = { title: "Depo" };
export const dynamic = "force-dynamic";

export default async function DepoPage() {
  const recent = await prisma.lot.findMany({
    where: { status: "HASAT" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { publicId: true, variety: true, district: true },
  });
  return (
    <main className="container py-10">
      <p className="eyebrow">Depo girişi</p>
      <h1 className="display mt-1 text-4xl font-semibold sm:text-5xl">Çuvalı okut, teslim al.</h1>
      <p className="mt-1 max-w-xl text-ink-mute">Etiketteki QR'ı kameraya gösterin. Teslim kaydı oluşturulur ve özeti zincire mühürlenir.</p>
      <ScanFlow mode="DEPO_TESLIM" recent={recent} />
    </main>
  );
}
