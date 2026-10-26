import { notFound } from "next/navigation";
import { EVENT_LABELS, type EventType } from "@taneiz/shared";
import { getSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { TamperBoard } from "./tamper-board";

export const metadata = { title: "Kurcalama demosu" };
export const dynamic = "force-dynamic";

export default async function TamperPage() {
  const session = await getSession();
  if (!config.demoMode || session?.user.role !== "ADMIN") notFound();

  const lots = await prisma.lot.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      events: { orderBy: { seq: "asc" }, include: { tamperLogs: { where: { restoredAt: null } } } },
      reports: { select: { gradeLabel: true }, take: 1 },
    },
  });

  const data = lots.map((l) => ({
    publicId: l.publicId,
    variety: l.variety,
    district: l.district,
    grade: l.reports[0]?.gradeLabel ?? null,
    events: l.events.map((e) => ({
      id: e.id,
      title: EVENT_LABELS[e.type as EventType] ?? e.type,
      type: e.type,
      onChain: e.chainStatus === "CONFIRMED",
      tampered: e.tamperLogs.length > 0,
    })),
  }));

  return (
    <main className="container py-10">
      <div className="max-w-3xl">
        <p className="eyebrow text-alarm-600">Yalnızca demo · DEMO_MODE açık</p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">
          Veritabanını kurcala. <span className="italic text-alarm-500">Zincir unutmaz.</span>
        </h1>
        <p className="mt-3 text-ink-soft">
          Bir olayın veritabanındaki verisini, kötü niyetli bir yöneticinin yapabileceği gibi doğrudan değiştirin (ör. 3. sınıf
          partiyi 1. sınıf gösterin). Zincirdeki hash'e dokunulmaz. Pasaportta doğrulama “EŞLEŞMEDİ” der; geri alınca tekrar “EŞLEŞTİ”.
        </p>
      </div>
      <TamperBoard lots={data} />
    </main>
  );
}
