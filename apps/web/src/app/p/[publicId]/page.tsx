import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { CalendarDays, Droplets, Gauge, MapPin, ScanLine, Scale, Info, AlertTriangle } from "lucide-react";
import { CLASS_META, GRAIN_CLASSES } from "@taneiz/shared";
import { loadPassport, STATUS_TR } from "@/lib/passport";
import { chainInfo } from "@/lib/chain";
import { baseUrlFrom } from "@/lib/config";
import { formatDate, kg, pct } from "@/lib/utils";
import { GradeStamp } from "@/components/grade-stamp";
import { CompareSlider } from "@/components/compare-slider";
import { DefectBars } from "@/components/defect-bars";
import { SupplyTimeline } from "@/components/supply-timeline";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { publicId: string } }): Promise<Metadata> {
  return { title: `Ürün Pasaportu ${params.publicId}` };
}

export default async function PassportPage({ params }: { params: { publicId: string } }) {
  const p = await loadPassport(params.publicId.toUpperCase());
  if (!p) notFound();

  const url = `${baseUrlFrom(headers())}/p/${p.publicId}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: "#1B1A16", light: "#FBF7EE" } });
  const q = p.quality;

  return (
    <main className="pb-10">
      {/* Pasaport kapağı */}
      <section className="guilloche border-b border-ink/10">
        <div className="container py-8 sm:py-12">
          <div className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="animate-rise-in">
              <p className="eyebrow flex items-center gap-2">
                <span className="inline-block size-1.5 rounded-full bg-wheat-500" /> Türkiye · Ürün Pasaportu
              </p>
              <h1 className="display mt-3 text-5xl font-semibold leading-[0.95] sm:text-7xl">
                {p.product}
                <span className="block italic text-wheat-600">{p.variety}</span>
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-ink px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-wheat-300">{p.publicId}</span>
                <Badge variant="outline">{STATUS_TR[p.status] ?? p.status}</Badge>
                <Badge variant={p.lotChainStatus === "CONFIRMED" ? "field" : "wheat"}>
                  {p.lotChainStatus === "CONFIRMED" ? "Zincire kayıtlı" : "Zincir kaydı bekliyor"}
                </Badge>
              </div>
            </div>
            {q ? (
              <div className="self-end sm:self-auto">
                <GradeStamp grade={q.grade} />
              </div>
            ) : (
              <Badge variant="muted">Kalite analizi yok</Badge>
            )}
          </div>
        </div>
        <div className="perforated h-3" />
      </section>

      <div className="container mt-8 space-y-14">
        {/* Künye */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Tile icon={Droplets} label="Nem (cihaz)" value={q ? `%${String(q.moisture).replace(".", ",")}` : "—"} />
          <Tile icon={CalendarDays} label="Hasat" value={formatDate(p.harvestDate)} />
          <Tile icon={MapPin} label="Menşei" value={p.district} sub={p.province} />
          <Tile icon={Scale} label="Miktar" value={kg(p.quantityKg)} />
          <Tile icon={ScanLine} label="İncelenen tane" value={q ? `${q.grainCount}` : "—"} />
          <Tile icon={Gauge} label="Ortalama güven" value={q ? pct(q.avgConfidence, 0) : "—"} />
        </section>

        {q && (
          <section className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div>
              <p className="eyebrow">Numune · tane tane analiz</p>
              <h2 className="display mt-1 text-3xl font-semibold">Yapay zekânın gördüğü</h2>
              <p className="mt-1 mb-4 text-sm text-ink-mute">Sürgüyü kaydırın: her tane bulundu, kırpıldı ve sınıflandırıldı.</p>
              {p.pairs.length > 0 ? (
                <CompareSlider pairs={p.pairs} />
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-2xl bg-ink/5 text-sm text-ink-mute">Görsel yok</div>
              )}
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {GRAIN_CLASSES.map((c) => (
                  <li key={c} className="flex items-center gap-1.5 text-[12px] font-medium text-ink-soft">
                    <span className="size-3 rounded-[3px] ring-2 ring-inset ring-black/10" style={{ background: CLASS_META[c].color }} />
                    {CLASS_META[c].label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="paper-card h-fit p-6">
              <p className="eyebrow">Kusur dağılımı</p>
              <h2 className="display mt-1 mb-5 text-2xl font-semibold">
                {q.gradeLabel} <span className="text-ink-mute">· {q.grainCount} tane</span>
              </h2>
              <DefectBars ratios={q.ratios} counts={p.counts} />
              {p.warnings.length > 0 && (
                <div className="mt-5 space-y-1.5 rounded-xl bg-wheat-50 p-3 text-[12px] text-wheat-700 ring-1 ring-wheat-500/20">
                  {p.warnings.map((w, i) => (
                    <p key={i} className="flex gap-1.5">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-5 flex gap-1.5 border-t border-dashed border-ink-line pt-4 text-[11px] leading-relaxed text-ink-mute">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Kalite sınıfı yapılandırılabilir demo eşikleriyle hesaplanır; resmi bir standart değildir. Nem fotoğraftan tahmin
                edilmez, nem ölçerden elle girilir. Model: <span className="font-mono">{q.modelVersion}</span>
              </p>
            </div>
          </section>
        )}

        <SupplyTimeline items={p.timeline} network={chainInfo.label} />

        {/* QR */}
        <section className="ink-stage relative overflow-hidden rounded-3xl p-6 sm:p-10">
          <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`${p.publicId} QR kodu`} className="size-44 rounded-2xl ring-8 ring-paper/10" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-wheat-300">Bu pasaportu paylaşın</p>
              <p className="display mt-2 text-3xl font-semibold text-paper">Telefonla okutun, herkes doğrulasın.</p>
              <p className="mt-2 break-all font-mono text-xs text-paper/60">{url}</p>
              <p className="mt-4 max-w-xl text-sm text-paper/70">
                Zincire yalnızca verilerin özetleri (hash) yazılır; kişisel bilgi ve görseller asla yazılmaz. Görsellerin SHA-256
                özetleri kalite kaydının içindedir, bu yüzden bir fotoğraf değiştirilirse doğrulama bunu yakalar.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="paper-card p-4">
      <Icon className="size-4 text-wheat-600" />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="display mt-0.5 text-xl font-semibold leading-tight">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}
