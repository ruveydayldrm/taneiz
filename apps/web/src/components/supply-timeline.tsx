"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FlaskConical,
  Link2,
  Loader2,
  Package,
  ShieldCheck,
  ShieldX,
  Sprout,
  Warehouse,
} from "lucide-react";
import type { TimelineItem } from "@/lib/passport";
import type { VerifyResult } from "@/lib/verify";
import { cn, formatDate } from "@/lib/utils";
import { Button } from "./ui/button";

const ICONS = {
  PARTI_OLUSTURULDU: Sprout,
  KALITE_ANALIZI: FlaskConical,
  DEPO_TESLIM: Warehouse,
  ALICI_TESLIM: Package,
} as const;

type RunState = "idle" | "running" | "done";

export function SupplyTimeline({ items, network }: { items: TimelineItem[]; network: string }) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, VerifyResult | "loading">>({});
  const [run, setRun] = useState<RunState>("idle");
  const [manual, setManual] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const pending = items.some((i) => i.chainStatus !== "CONFIRMED");
  const confirmedKey = items
    .filter((i) => i.chainStatus === "CONFIRMED")
    .map((i) => i.id)
    .join(",");

  // Kuyrukta kayıt varsa sayfayı tazele: zincire yazılınca rozetler kendiliğinden güncellenir.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [pending, router]);

  const verifyAll = useCallback(
    async (isManual: boolean) => {
      setManual(isManual);
      setRun("running");
      setResults({});
      for (const item of items) {
        setResults((r) => ({ ...r, [item.id]: "loading" }));
        try {
          const res = await fetch(`/api/verify/${item.id}`, { method: "POST", cache: "no-store" });
          const body = (await res.json()) as VerifyResult;
          setResults((r) => ({ ...r, [item.id]: body }));
        } catch {
          setResults((r) => {
            const { [item.id]: _, ...rest } = r;
            return rest;
          });
        }
        if (isManual) await new Promise((r) => setTimeout(r, 220));
      }
      setRun("done");
    },
    [items],
  );

  useEffect(() => {
    verifyAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedKey]);

  const summary = useMemo(() => {
    const vals = Object.values(results).filter((v): v is VerifyResult => v !== "loading");
    return {
      ok: vals.filter((v) => v.status === "ESLESTI").length,
      bad: vals.filter((v) => v.status === "ESLESMEDI"),
      wait: vals.filter((v) => v.status === "BEKLEMEDE").length,
      err: vals.filter((v) => v.status === "HATA").length,
      total: items.length,
    };
  }, [results, items.length]);

  const showBanner = run === "done" && (manual || summary.bad.length > 0);

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Tedarik zinciri</p>
          <h2 className="display mt-1 text-3xl font-semibold">Tarladan alıcıya</h2>
          <p className="mt-1 text-sm text-ink-mute">Her adımın verisi kanonik JSON → keccak256 ile {network} üzerine mühürlendi.</p>
        </div>
        <Button size="lg" variant="wheat" onClick={() => verifyAll(true)} disabled={run === "running"} className="w-full sm:w-auto">
          {run === "running" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {run === "running" ? "Zincirle karşılaştırılıyor…" : "Bu kaydı şimdi doğrula"}
        </Button>
      </div>

      {showBanner && <VerifyBanner summary={summary} />}

      <ol className="relative mt-8 space-y-4 before:absolute before:bottom-6 before:left-[21px] before:top-6 before:w-px before:bg-[repeating-linear-gradient(to_bottom,theme(colors.ink.line)_0_6px,transparent_6px_12px)]">
        {items.map((item, idx) => {
          const Icon = ICONS[item.type] ?? Link2;
          const r = results[item.id];
          const res = r && r !== "loading" ? r : null;
          const isOpen = open === item.id;
          return (
            <li key={item.id} className="relative pl-14 animate-rise-in" style={{ animationDelay: `${idx * 80}ms` }}>
              <span
                className={cn(
                  "absolute left-0 top-3 grid size-11 place-items-center rounded-full ring-4 ring-paper transition-colors",
                  res?.status === "ESLESMEDI" ? "bg-alarm-500 text-white" : res?.status === "ESLESTI" ? "bg-field-500 text-white" : "bg-ink text-wheat-300",
                )}
              >
                <Icon className="size-5" />
              </span>
              <div
                className={cn(
                  "paper-card overflow-hidden transition-all",
                  res?.status === "ESLESMEDI" && "border-alarm-500/50 ring-2 ring-alarm-500/30",
                )}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
                        Adım {idx + 1} · {formatDate(item.at, true)}
                      </p>
                      <h3 className="mt-0.5 text-[17px] font-bold">{item.title}</h3>
                    </div>
                    <ChainBadge item={item} result={r} />
                  </div>
                  <div className="mt-2 space-y-0.5 text-[14px] text-ink-soft">
                    {item.lines.map((l, i) => (
                      <p key={i}>{l}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-ink-mute hover:text-ink"
                  >
                    Zincir ayrıntıları <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>
                </div>
                {isOpen && (
                  <div className="space-y-2 border-t border-dashed border-ink-line bg-paper-2/40 p-4 sm:px-5">
                    <Row k="Kayıtlı hash" v={item.dataHash} />
                    {res && <Row k="Yeniden hesaplanan" v={res.recomputedHash} bad={res.status === "ESLESMEDI"} />}
                    {res?.onChainHash && <Row k="Zincirdeki hash" v={res.onChainHash} />}
                    <Row k="Zincir indeksi" v={item.chainIndex !== null ? `#${item.chainIndex}` : "—"} />
                    <Row k="Blok" v={item.blockNumber ? `#${item.blockNumber}` : "—"} />
                    <Row k="İşlem" v={item.txHash ?? "—"} />
                    {item.explorerUrl && (
                      <a href={item.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold link-underline">
                        Polygonscan'de aç <ExternalLink className="size-3" />
                      </a>
                    )}
                    {res && res.imageChecks.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[11px] font-semibold text-ink-mute">Görsel bütünlüğü (SHA-256)</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {res.imageChecks.map((c) => (
                            <li key={c.kind} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", c.ok ? "bg-field-50 text-field-600" : "bg-alarm-50 text-alarm-600")}>
                              {c.ok ? "✓" : "✗"} {c.kind}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {res && <p className="pt-1 text-[12px] text-ink-soft">{res.reason}</p>}
                    {item.lastError && item.chainStatus !== "CONFIRMED" && (
                      <p className="text-[12px] text-alarm-600">Son hata: {item.lastError}</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 sm:grid-cols-[140px_1fr]">
      <span className="text-[11px] font-semibold text-ink-mute">{k}</span>
      <span className={cn("hash", bad && "text-alarm-600 font-bold")}>{v}</span>
    </div>
  );
}

function ChainBadge({ item, result }: { item: TimelineItem; result?: VerifyResult | "loading" }) {
  if (result === "loading")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
        <Loader2 className="size-3.5 animate-spin" /> Doğrulanıyor
      </span>
    );
  if (result?.status === "ESLESTI")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-field-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
        <CheckCircle2 className="size-3.5" /> Zincirde doğrulandı
      </span>
    );
  if (result?.status === "ESLESMEDI")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-alarm-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
        <ShieldX className="size-3.5" /> EŞLEŞMEDİ
      </span>
    );
  if (item.chainStatus !== "CONFIRMED")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-wheat-100 px-2.5 py-1 text-[11px] font-semibold text-wheat-700 ring-1 ring-wheat-500/30">
        <Clock3 className="size-3.5" /> {item.chainStatus === "FAILED" ? "Yeniden denenecek" : "Zincir kuyruğunda"}
      </span>
    );
  if (result?.status === "HATA")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
        <AlertTriangle className="size-3.5" /> Zincire ulaşılamadı
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
      <Link2 className="size-3.5" /> Blok #{item.blockNumber}
    </span>
  );
}

function VerifyBanner({
  summary,
}: {
  summary: { ok: number; bad: VerifyResult[]; wait: number; err: number; total: number };
}) {
  const bad = summary.bad.length > 0;
  if (!bad && summary.err > 0) {
    return (
      <div className="mt-6 rounded-2xl border border-ink/10 bg-white/60 p-5 text-sm">
        <AlertTriangle className="mb-2 size-5" /> Zincire ulaşılamadı; doğrulama tamamlanamadı. Blokzincir düğümünün çalıştığından emin olun.
      </div>
    );
  }
  return (
    <div
      className={cn(
        "relative mt-6 overflow-hidden rounded-3xl p-6 text-white shadow-lift animate-in zoom-in-95 fade-in duration-500 sm:p-8",
        bad ? "bg-alarm-500" : "bg-field-600",
      )}
    >
      <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-16 right-16 size-32 rounded-full bg-white/5" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/30">
          {bad ? <ShieldX className="size-9" /> : <ShieldCheck className="size-9" />}
        </div>
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/75">Zincir doğrulaması</p>
          <p className="display text-4xl font-bold sm:text-5xl">{bad ? "EŞLEŞMEDİ" : "EŞLEŞTİ"}</p>
          <p className="mt-1 text-sm text-white/85">
            {bad
              ? `${summary.bad.length} kayıt, zincire mühürlenen hash ile uyuşmuyor. Veritabanındaki veri sonradan değiştirilmiş.`
              : `${summary.ok}/${summary.total} kayıt, veritabanından yeniden hesaplanan hash ile zincirde birebir aynı.${summary.wait ? ` ${summary.wait} kayıt kuyrukta.` : ""}`}
          </p>
        </div>
      </div>
      {bad &&
        summary.bad.map((b) => (
          <div key={b.eventId} className="relative mt-4 space-y-1 rounded-2xl bg-black/15 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Zincirdeki mühür</p>
            <p className="hash text-white">{b.onChainHash}</p>
            <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">Şu anki veriden hesaplanan</p>
            <p className="hash font-bold text-yellow-200">{b.recomputedHash}</p>
          </div>
        ))}
    </div>
  );
}
