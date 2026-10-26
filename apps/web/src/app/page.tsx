import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Camera,
  CheckCircle2,
  Eye,
  FileWarning,
  Fingerprint,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Unlink,
} from "lucide-react";
import { CLASS_META, GRAIN_CLASSES, canonicalize } from "@taneiz/shared";
import { prisma } from "@/lib/prisma";
import { loadPassport, type Passport } from "@/lib/passport";
import { formatDate, pct, shortHash } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { GradeStamp } from "@/components/grade-stamp";
import { CompareSlider } from "@/components/compare-slider";

export const dynamic = "force-dynamic";

async function loadShowcase() {
  try {
    const lots = await prisma.lot.findMany({
      where: { reports: { some: {} } },
      include: { reports: { select: { grade: true }, take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "asc" },
    });
    const pick =
      lots.find((l) => l.reports[0]?.grade === "SINIF_1") ??
      lots[0] ??
      (await prisma.lot.findFirst({ where: { events: { some: { chainStatus: "CONFIRMED" } } }, orderBy: { createdAt: "asc" } }));
    const passport = pick ? await loadPassport(pick.publicId) : null;
    const events = await prisma.supplyEvent.findMany({
      where: { chainStatus: "CONFIRMED" },
      include: { lot: { select: { publicId: true } } },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
    const qualityEvent = passport
      ? await prisma.supplyEvent.findFirst({
          where: { lot: { publicId: passport.publicId }, type: "KALITE_ANALIZI" },
        })
      : null;
    return { passport, events, qualityEvent, lotCount: lots.length };
  } catch {
    return { passport: null, events: [], qualityEvent: null, lotCount: 0 };
  }
}

export default async function Home() {
  const { passport, events, qualityEvent } = await loadShowcase();
  const passportHref = passport ? `/p/${passport.publicId}` : "/giris";

  return (
    <main>
      {/* HERO */}
      <section className="ink-stage relative overflow-hidden">
        <FloatingGrains />
        <div className="container relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:py-28">
          <div className="animate-rise-in">
            <p className="inline-flex items-center gap-2 rounded-full border border-paper/15 bg-paper/5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-wheat-200">
              <Sparkles className="size-3.5" /> Buğday · Yapay zekâ · Blokzincir
            </p>
            <h1 className="display mt-6 text-[3.4rem] font-semibold leading-[0.92] text-paper sm:text-7xl lg:text-[5.6rem]">
              Her tanenin
              <br />
              <span className="italic text-wheat-300">izi</span> var.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75">
              Numune fotoğrafından yapay zekâ ile <b className="text-paper">tane tane kalite analizi</b>. Her tedarik adımı
              <b className="text-paper"> blokzincirde mühürlü</b>. QR okutan herkes, kaydın değiştirilmediğini
              <b className="text-paper"> kendisi doğrular</b>.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={passportHref} className={buttonVariants({ variant: "wheat", size: "lg" })}>
                <QrCode /> Örnek pasaportu aç
              </Link>
              <Link href="/model" className={buttonVariants({ variant: "ghost", size: "lg", className: "text-paper hover:bg-paper/10" })}>
                Model başarısını gör <ArrowRight />
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-paper/60">
              {["Zincire yalnızca hash yazılır", "Nem cihazdan, tahmin değil", "Metrikler kilitli test setinden"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-wheat-400" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <PassportPreview passport={passport} />
        </div>
      </section>

      {/* HASH ŞERİDİ */}
      <section className="border-y border-ink/10 bg-wheat-400 py-3 text-ink">
        <div className="mask-fade-x overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-mono text-[12px] font-semibold">
            {[0, 1].map((k) => (
              <div key={k} className="flex gap-10" aria-hidden={k === 1}>
                {(events.length
                  ? events.map((e) => `${e.lot.publicId} · ${e.type} · blok #${e.blockNumber} · ${shortHash(e.dataHash, 8)}`)
                  : ["olay verisi → kanonik JSON → keccak256 → zincir", "görseller → SHA-256 → olay verisine", "doğrulama: aynı fonksiyon, aynı hash"]
                ).map((t, i) => (
                  <span key={i} className="flex items-center gap-3">
                    <span className="size-1.5 rotate-45 bg-ink" /> {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SORUN */}
      <section className="container py-24">
        <p className="eyebrow">Sorun</p>
        <h2 className="display mt-2 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Buğdayın kalitesi tartışılır, <span className="italic text-wheat-600">kaydı ise sessizce değişir.</span>
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Eye,
              t: "Göz kararı kalite",
              d: "Numune değerlendirmesi kişiden kişiye değişir. Üretici, depo ve alıcı arasında aynı parti için farklı sınıflar konuşulur.",
            },
            {
              icon: FileWarning,
              t: "Değiştirilebilir kayıt",
              d: "Kâğıt fişler ve tablolar sonradan düzeltilebilir. Kimin neyi ne zaman değiştirdiği çoğu zaman görünmez.",
            },
            {
              icon: Unlink,
              t: "Kopuk zincir",
              d: "Tarladan fabrikaya kadar bilgi el değiştirirken kaybolur. Son alıcı, partinin geçmişini kendi başına doğrulayamaz.",
            },
          ].map(({ icon: Icon, t, d }, i) => (
            <div key={t} className="paper-card group relative overflow-hidden p-7 transition hover:-translate-y-1 hover:shadow-lift">
              <span className="display absolute -right-2 -top-6 text-[7rem] font-bold italic text-ink/[.04]">{i + 1}</span>
              <Icon className="size-7 text-alarm-500" />
              <h3 className="display mt-5 text-2xl font-semibold">{t}</h3>
              <p className="mt-2 text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* YAPAY ZEKÂ VİTRİNİ */}
      {passport?.quality && passport.pairs.length > 0 && (
        <section className="bg-paper-2/60 py-24">
          <div className="container grid items-center gap-12 lg:grid-cols-[1fr_1.3fr]">
            <div>
              <p className="eyebrow">Çözüm · 1</p>
              <h2 className="display mt-2 text-4xl font-semibold leading-tight sm:text-5xl">
                Tane tane <span className="italic text-wheat-600">gören</span> yapay zekâ.
              </h2>
              <p className="mt-4 text-ink-soft">
                Bu, örnek partinin gerçek analizi: {passport.quality.grainCount} tane bulundu, her biri ayrı ayrı sınıflandırıldı.
                Sürgüyü kaydırın.
              </p>
              <ol className="mt-8 space-y-4">
                {[
                  ["Kalite kontrolü", "Bulanıklık (Laplacian), pozlama, çözünürlük"],
                  ["Segmentasyon", "Arka plan çıkarma, Otsu eşikleme, morfoloji"],
                  ["Ayırma", "Değen taneler watershed ile bölünür"],
                  ["Sınıflandırma", "EfficientNet · ONNX Runtime · CPU'da saniyeler"],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs font-bold text-wheat-300">{i + 1}</span>
                    <span>
                      <span className="block font-bold">{t}</span>
                      <span className="text-sm text-ink-mute">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <CompareSlider pairs={passport.pairs.slice(0, 1)} />
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                {GRAIN_CLASSES.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                    <span className="size-2.5 rounded-sm" style={{ background: CLASS_META[c].color }} />
                    {CLASS_META[c].label} {pct(passport.quality!.ratios[c] ?? 0)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* NASIL ÇALIŞIR */}
      <section id="nasil" className="container scroll-mt-20 py-24">
        <p className="eyebrow">Nasıl çalışır</p>
        <h2 className="display mt-2 text-4xl font-semibold sm:text-5xl">Üç adım. Sıfır güven varsayımı.</h2>
        <div className="relative mt-14 grid gap-10 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-[repeating-linear-gradient(90deg,theme(colors.ink.line)_0_8px,transparent_8px_16px)] md:block" />
          {[
            { icon: Camera, n: "01", t: "Fotoğrafla", d: "Üretici numuneyi açık zemine serip çeker, nemi cihazdan girer. Yapay zekâ taneleri sayar, kusur oranlarını ve kalite sınıfını çıkarır." },
            { icon: Fingerprint, n: "02", t: "Mühürle", d: "Kayıt kanonik JSON'a çevrilir, keccak256 özeti blokzincire yazılır. Görsellerin SHA-256 özetleri de kaydın içindedir." },
            { icon: ScanLine, n: "03", t: "Okut & doğrula", d: "Depo ve alıcı QR okutup kendi adımını ekler. Herkes “Şimdi doğrula” ile veriyi zincirdeki mühürle karşılaştırır." },
          ].map(({ icon: Icon, n, t, d }) => (
            <div key={n} className="relative">
              <div className="relative grid size-16 place-items-center rounded-2xl bg-ink text-wheat-300 shadow-lift">
                <Icon className="size-7" />
              </div>
              <p className="display mt-6 text-6xl font-bold italic text-wheat-400/70">{n}</p>
              <h3 className="display mt-1 text-2xl font-semibold">{t}</h3>
              <p className="mt-2 text-ink-soft">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ZİNCİR ANLATIMI (gerçek veriyle) */}
      <section className="container pb-24">
        <div className="ink-stage overflow-hidden rounded-[2rem] p-6 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-wheat-300">Çözüm · 2</p>
              <h2 className="display mt-2 text-4xl font-semibold text-paper sm:text-5xl">
                Değiştirmek mümkün. <span className="italic text-wheat-300">Fark edilmemek değil.</span>
              </h2>
              <p className="mt-4 text-paper/70">
                Veritabanında tek bir rakam değişse, yeniden hesaplanan hash zincirdeki mühürle tutmaz. Pasaport bunu anında
                “EŞLEŞMEDİ” olarak gösterir. Zincire kişisel veri ya da görsel değil, yalnızca 32 baytlık özetler yazılır.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Link href={passportHref} className={buttonVariants({ variant: "wheat" })}>
                  <ShieldCheck /> Doğrulamayı dene
                </Link>
              </div>
            </div>
            <HashPipeline sample={qualityEvent ? { data: qualityEvent.data, hash: qualityEvent.dataHash, block: qualityEvent.blockNumber } : null} />
          </div>
        </div>
      </section>

      {/* SON ÇAĞRI */}
      <section className="container">
        <div className="guilloche paper-card flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-12">
          <div>
            <h2 className="display text-3xl font-semibold sm:text-4xl">Bir partiyi uçtan uca izleyin.</h2>
            <p className="mt-2 text-ink-soft">Üretici hesabıyla girin, numune fotoğrafını yükleyin, QR etiketinizi basın.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/giris" className={buttonVariants({ size: "lg" })}>
              Demoya gir <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PassportPreview({ passport }: { passport: Passport | null }) {
  const q = passport?.quality;
  return (
    <div className="relative mx-auto w-full max-w-md animate-in fade-in zoom-in-95 duration-700 [perspective:1400px]">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-wheat-400/20 blur-3xl" />
      <div className="paper-card guilloche relative rotate-[-4deg] overflow-hidden text-ink shadow-lift transition-transform duration-700 hover:rotate-0">
        <div className="flex items-center justify-between bg-ink px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-wheat-300">Ürün Pasaportu</span>
          <span className="font-mono text-[11px] font-bold text-paper">{passport?.publicId ?? "TZ-······"}</span>
        </div>
        <div className="flex items-start justify-between gap-2 p-5">
          <div>
            <p className="eyebrow">{passport?.product ?? "Buğday"}</p>
            <p className="display text-3xl font-semibold italic">{passport?.variety ?? "Çeşit"}</p>
            <p className="mt-1 text-sm text-ink-mute">
              {passport ? `${passport.district}, ${passport.province}` : "İlçe, il"}
            </p>
            {passport && <p className="text-xs text-ink-mute">Hasat {formatDate(passport.harvestDate)}</p>}
          </div>
          <GradeStamp grade={q?.grade} className="!size-28 -mr-2 -mt-1 sm:!size-32" />
        </div>
        <div className="px-5">
          <div className="flex h-3 overflow-hidden rounded-full bg-ink/5 ring-1 ring-ink/10">
            {q
              ? GRAIN_CLASSES.map((c) => (
                  <div key={c} style={{ width: `${(q.ratios[c] ?? 0) * 100}%`, background: CLASS_META[c].color }} />
                ))
              : null}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-mute">
            <span>{q ? `sağlıklı ${pct(q.ratios.SAGLIKLI ?? 0)}` : "kusur dağılımı"}</span>
            <span>{q ? `nem %${q.moisture}` : "nem"}</span>
          </div>
        </div>
        <div className="perforated mt-5 h-3" />
        <ul className="space-y-2 p-5 pt-3">
          {(passport?.timeline.slice(0, 4) ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold">{t.title}</span>
              {t.chainStatus === "CONFIRMED" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-field-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <CheckCircle2 className="size-3" /> Zincirde
                </span>
              ) : (
                <span className="rounded-full bg-wheat-100 px-2 py-0.5 text-[10px] font-bold text-wheat-700">Kuyrukta</span>
              )}
            </li>
          ))}
          {!passport && <li className="text-sm text-ink-mute">Seed çalıştırıldığında burada gerçek bir parti görünür.</li>}
        </ul>
      </div>
    </div>
  );
}

function HashPipeline({ sample }: { sample: { data: string; hash: string; block: number | null } | null }) {
  const canonical = sample ? canonicalize(JSON.parse(sample.data)) : '{"grade":"SINIF_2","lot":"TZ-…","moisturePct":11.4,…}';
  return (
    <div className="space-y-3 font-mono text-[12px]">
      <Stage icon={Boxes} label="1 · Olay verisi (anahtarlar sıralı, kanonik JSON)">
        <p className="line-clamp-4 break-all text-paper/80">{canonical}</p>
      </Stage>
      <Arrow />
      <Stage icon={Fingerprint} label="2 · keccak256">
        <p className="break-all font-bold text-wheat-300">{sample?.hash ?? "0x…"}</p>
      </Stage>
      <Arrow />
      <Stage icon={ShieldCheck} label="3 · Zincirde">
        <p className="text-paper/80">
          TaneIzRegistry.recordEvent(lotIdHash, 2, dataHash){sample?.block ? ` · blok #${sample.block}` : ""}
        </p>
      </Stage>
    </div>
  );
}

function Stage({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-paper/10 bg-paper/[.04] p-4">
      <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-paper/50">
        <Icon className="size-3.5 text-wheat-400" /> {label}
      </p>
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <svg width="16" height="22" viewBox="0 0 16 22" className="text-wheat-400">
        <path d="M8 0v18M2 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

function FloatingGrains() {
  const grains = [
    { l: "6%", t: "18%", s: 1.1, r: 20, d: 0 },
    { l: "44%", t: "8%", s: 0.7, r: 120, d: 1.2 },
    { l: "88%", t: "14%", s: 0.9, r: 70, d: 0.6 },
    { l: "52%", t: "84%", s: 1.3, r: 160, d: 2.1 },
    { l: "12%", t: "78%", s: 0.8, r: 95, d: 1.6 },
    { l: "94%", t: "70%", s: 1, r: 40, d: 0.3 },
    { l: "34%", t: "50%", s: 0.55, r: 140, d: 2.6 },
    { l: "70%", t: "40%", s: 0.6, r: 10, d: 3.1 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {grains.map((g, i) => (
        <svg
          key={i}
          viewBox="0 0 40 70"
          className="absolute w-8 animate-float opacity-70 sm:w-10"
          style={{ left: g.l, top: g.t, scale: String(g.s), animationDelay: `${g.d}s`, ["--r" as string]: `${g.r}deg` }}
        >
          <defs>
            <linearGradient id={`g${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F0D08A" />
              <stop offset="1" stopColor="#A06D1B" />
            </linearGradient>
          </defs>
          <ellipse cx="20" cy="35" rx="15" ry="31" fill={`url(#g${i})`} />
          <path d="M20 8 C 16 25, 16 45, 20 62" stroke="#7B5317" strokeWidth="1.6" fill="none" opacity=".55" />
          <ellipse cx="14" cy="22" rx="3" ry="8" fill="#fff" opacity=".22" />
        </svg>
      ))}
    </div>
  );
}
