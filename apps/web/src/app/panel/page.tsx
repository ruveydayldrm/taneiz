import Link from "next/link";
import { redirect } from "next/navigation";
import { FileDown, Plus, QrCode } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STATUS_TR } from "@/lib/passport";
import { formatDate, kg } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradeStamp } from "@/components/grade-stamp";

export const metadata = { title: "Üretici paneli" };
export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const session = await getSession();
  if (!session) redirect("/giris");
  const lots = await prisma.lot.findMany({
    where: session.user.role === "ADMIN" ? {} : { ownerId: session.user.id },
    include: { reports: { orderBy: { createdAt: "desc" }, take: 1 }, events: { select: { chainStatus: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="container py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Üretici paneli</p>
          <h1 className="display mt-1 text-4xl font-semibold sm:text-5xl">Partilerim</h1>
          <p className="mt-1 text-ink-mute">Merhaba {session.user.name}. {lots.length} parti kayıtlı.</p>
        </div>
        <Link href="/panel/yeni" className={buttonVariants({ variant: "wheat", size: "lg" })}>
          <Plus /> Yeni parti
        </Link>
      </div>

      {lots.length === 0 ? (
        <div className="paper-card mt-10 grid place-items-center p-12 text-center">
          <QrCode className="size-10 text-wheat-500" />
          <p className="display mt-4 text-2xl font-semibold">Henüz parti yok</p>
          <p className="mt-1 max-w-sm text-sm text-ink-mute">Yeni parti sihirbazıyla numune fotoğrafını analiz edin, kaydı zincire mühürleyin.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map((lot) => {
            const r = lot.reports[0];
            const pending = lot.events.filter((e) => e.chainStatus !== "CONFIRMED").length;
            return (
              <article key={lot.id} className="paper-card group relative overflow-hidden p-5 transition hover:-translate-y-1 hover:shadow-lift">
                <div className="absolute -right-8 -top-8 opacity-90 transition group-hover:rotate-6">
                  <GradeStamp grade={r?.grade} animate={false} className="!size-28" />
                </div>
                <p className="font-mono text-xs font-bold tracking-widest text-wheat-600">{lot.publicId}</p>
                <h2 className="display mt-1 pr-20 text-2xl font-semibold">{lot.variety}</h2>
                <p className="text-sm text-ink-mute">
                  {lot.district}, {lot.province} · {kg(lot.quantityKg)}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Badge variant="outline">{STATUS_TR[lot.status]}</Badge>
                  {r && <Badge variant="wheat">Nem %{r.moisture}</Badge>}
                  <Badge variant={pending ? "wheat" : "field"}>{pending ? `${pending} kayıt kuyrukta` : "Tümü zincirde"}</Badge>
                </div>
                <p className="mt-3 text-xs text-ink-mute">Hasat {formatDate(lot.harvestDate)}</p>
                <div className="mt-5 flex gap-2">
                  <Link href={`/p/${lot.publicId}`} className={buttonVariants({ size: "sm", className: "flex-1" })}>
                    Pasaport
                  </Link>
                  <a href={`/api/lots/${lot.publicId}/label`} target="_blank" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    <FileDown /> QR etiket
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
