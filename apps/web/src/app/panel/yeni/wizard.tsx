"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Droplets,
  FileDown,
  ImagePlus,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AnalysisResult } from "@taneiz/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CompareSlider } from "@/components/compare-slider";
import { DefectBars } from "@/components/defect-bars";
import { GradeStamp } from "@/components/grade-stamp";
import { cn, kg } from "@/lib/utils";

const STEPS = ["Ürün", "Fotoğraf", "Nem", "Analiz", "Onay"];
const VARIETIES = ["Bezostaja-1", "Gerek-79", "Tosunbey", "Kızıltan-91", "Esperia", "Konya-2002", "Ceyhan-99", "Pehlivan"];
const PROVINCES = ["Konya", "Ankara", "Eskişehir", "Tekirdağ", "Edirne", "Şanlıurfa", "Diyarbakır", "Adana", "Yozgat", "Kırklareli"];

type Analysis = { draftId: string; result: AnalysisResult; pairs: { original: string; annotated: string }[] };

export function LotWizard() {
  const [step, setStep] = useState(0);
  const [info, setInfo] = useState({
    product: "Buğday",
    variety: "",
    harvestDate: new Date().toISOString().slice(0, 10),
    quantityTon: "",
    province: "",
    district: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [moisture, setMoisture] = useState(11.5);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ publicId: string; passportUrl: string; qr: string } | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const infoValid =
    info.variety.trim().length >= 2 &&
    info.province.trim().length >= 2 &&
    info.district.trim().length >= 2 &&
    Number(info.quantityTon) > 0 &&
    !!info.harvestDate;

  async function runAnalysis() {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Analiz başarısız.");
      setAnalysis(body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (step === 3 && !analysis && !analyzing && !error) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function save() {
    if (!analysis) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: analysis.draftId,
          product: info.product,
          variety: info.variety,
          harvestDate: info.harvestDate,
          quantityKg: Math.round(Number(info.quantityTon) * 1000),
          province: info.province,
          district: info.district,
          moisture,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kayıt başarısız.");
      const qr = await QRCode.toDataURL(body.passportUrl, { margin: 1, width: 480, color: { dark: "#1B1A16", light: "#FFFFFF" } });
      setDone({ ...body, qr });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <Success {...done} />;

  return (
    <div className="mt-8">
      <Stepper step={step} />

      <div className="paper-card mt-6 p-5 sm:p-8">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2 animate-rise-in">
            <Field label="Ürün">
              <Input value={info.product} onChange={(e) => setInfo({ ...info, product: e.target.value })} />
            </Field>
            <Field label="Çeşit">
              <Input list="varieties" placeholder="ör. Bezostaja-1" value={info.variety} onChange={(e) => setInfo({ ...info, variety: e.target.value })} />
              <datalist id="varieties">{VARIETIES.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Hasat tarihi">
              <Input type="date" max={new Date().toISOString().slice(0, 10)} value={info.harvestDate} onChange={(e) => setInfo({ ...info, harvestDate: e.target.value })} />
            </Field>
            <Field label="Miktar (ton)">
              <Input type="number" inputMode="decimal" min="0" step="0.1" placeholder="ör. 24" value={info.quantityTon} onChange={(e) => setInfo({ ...info, quantityTon: e.target.value })} />
            </Field>
            <Field label="İl">
              <Input list="provinces" placeholder="ör. Konya" value={info.province} onChange={(e) => setInfo({ ...info, province: e.target.value })} />
              <datalist id="provinces">{PROVINCES.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="İlçe">
              <Input placeholder="ör. Cihanbeyli" value={info.district} onChange={(e) => setInfo({ ...info, district: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <PhotoStep
            files={files}
            previews={previews}
            onAdd={(fs) => {
              setFiles((cur) => [...cur, ...fs].slice(0, 3));
              setAnalysis(null);
            }}
            onRemove={(i) => {
              setFiles((cur) => cur.filter((_, j) => j !== i));
              setAnalysis(null);
            }}
          />
        )}

        {step === 2 && (
          <div className="animate-rise-in text-center">
            <Droplets className="mx-auto size-8 text-wheat-600" />
            <p className="mt-3 text-sm font-semibold text-ink-soft">Nem ölçer cihazınızdaki değer</p>
            <div className="mt-2 flex items-baseline justify-center gap-1">
              <span className="display text-3xl text-ink-mute">%</span>
              <input
                type="number"
                step="0.1"
                min="5"
                max="30"
                value={moisture}
                onChange={(e) => setMoisture(Number(e.target.value))}
                className="display w-44 bg-transparent text-center text-8xl font-semibold tabular-nums outline-none"
                aria-label="Nem yüzdesi"
              />
            </div>
            <input
              type="range"
              min="8"
              max="20"
              step="0.1"
              value={moisture}
              onChange={(e) => setMoisture(Number(e.target.value))}
              className="mt-4 w-full max-w-md accent-wheat-500"
            />
            <div className="mx-auto mt-1 flex max-w-md justify-between font-mono text-[10px] text-ink-mute">
              <span>%8</span>
              <span>%14 depolama sınırı (genel kabul)</span>
              <span>%20</span>
            </div>
            <p className="mx-auto mt-6 max-w-md rounded-xl bg-wheat-50 p-3 text-xs text-wheat-700 ring-1 ring-wheat-500/20">
              Nem fotoğraftan <b>tahmin edilmez</b>. Değer kayıt verisine “cihaz-elle-giriş” kaynağıyla yazılır ve zincire mühürlenir.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="animate-rise-in">
            {analyzing && <Scanning preview={previews[0]} />}
            {error && !analyzing && (
              <div className="rounded-2xl bg-alarm-50 p-5 text-alarm-600">
                <p className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="size-5" /> Analiz yapılamadı
                </p>
                <p className="mt-1 text-sm">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={runAnalysis}>
                  <RotateCcw /> Tekrar dene
                </Button>
              </div>
            )}
            {analysis && !analyzing && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="eyebrow">Sonuç · {(analysis.result.processing_ms / 1000).toLocaleString("tr-TR")} sn</p>
                    <p className="display mt-1 text-4xl font-semibold">{analysis.result.grade.label}</p>
                    <p className="text-sm text-ink-mute">
                      {analysis.result.grain_count} tane bulundu · ort. güven %{Math.round(analysis.result.avg_confidence * 100)}
                    </p>
                    <p className="mt-1 text-xs text-ink-mute">Kural: {analysis.result.grade.rule}</p>
                  </div>
                  <GradeStamp grade={analysis.result.grade.code} />
                </div>
                <CompareSlider pairs={analysis.pairs} />
                <DefectBars ratios={analysis.result.ratios} counts={analysis.result.counts} />
                {analysis.result.warnings.length > 0 && (
                  <div className="space-y-1.5 rounded-xl bg-wheat-50 p-3 text-[13px] text-wheat-700 ring-1 ring-wheat-500/20">
                    {analysis.result.warnings.map((w, i) => (
                      <p key={i} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-ink-mute">{analysis.result.grade.disclaimer}</p>
              </div>
            )}
          </div>
        )}

        {step === 4 && analysis && (
          <div className="animate-rise-in">
            <dl className="divide-y divide-dashed divide-ink-line">
              {[
                ["Ürün / çeşit", `${info.product} · ${info.variety}`],
                ["Hasat", new Date(info.harvestDate).toLocaleDateString("tr-TR", { dateStyle: "long" })],
                ["Miktar", kg(Number(info.quantityTon) * 1000)],
                ["Menşei", `${info.district}, ${info.province}`],
                ["Nem (cihaz)", `%${moisture}`],
                ["Kalite", `${analysis.result.grade.label} · sağlıklı %${(analysis.result.ratios.SAGLIKLI * 100).toFixed(1)}`],
                ["Numune", `${files.length} fotoğraf · ${analysis.result.grain_count} tane`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                  <dt className="text-ink-mute">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-paper-2/60 p-4 text-sm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 size-4 accent-ink" />
              <span>
                Bilgilerin doğru olduğunu onaylıyorum. Kayıt verisinin özeti (hash) blokzincire yazılacak ve
                <b> sonradan değiştirilemeyecek</b>.
              </span>
            </label>
            {error && <p className="mt-4 rounded-xl bg-alarm-50 p-3 text-sm text-alarm-600">{error}</p>}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || saving || analyzing}>
          <ArrowLeft /> Geri
        </Button>
        {step < 4 ? (
          <Button
            size="lg"
            onClick={() => {
              setError(null);
              setStep((s) => s + 1);
            }}
            disabled={(step === 0 && !infoValid) || (step === 1 && files.length === 0) || (step === 3 && !analysis)}
          >
            {step === 2 ? <Sparkles /> : null}
            {step === 2 ? "Analiz et" : "Devam"} <ArrowRight />
          </Button>
        ) : (
          <Button size="lg" variant="wheat" onClick={save} disabled={!confirm || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Kaydet ve zincire mühürle
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-5 gap-2">
      {STEPS.map((s, i) => (
        <li key={s} className="flex flex-col gap-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className={cn("h-full rounded-full bg-wheat-500 transition-all duration-500", i <= step ? "w-full" : "w-0")} />
          </div>
          <span className={cn("flex items-center gap-1 text-[11px] font-semibold sm:text-xs", i === step ? "text-ink" : "text-ink-mute")}>
            {i < step ? <Check className="size-3.5 text-field-500" /> : <span className="font-mono">{i + 1}</span>}
            <span className="truncate">{s}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function PhotoStep({
  files,
  previews,
  onAdd,
  onRemove,
}: {
  files: File[];
  previews: string[];
  onAdd: (f: File[]) => void;
  onRemove: (i: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const accept = (list: FileList | null) => list && onAdd(Array.from(list).filter((f) => f.type.startsWith("image/")));

  return (
    <div className="animate-rise-in">
      <div className="mb-5 grid gap-2 text-[13px] text-ink-soft sm:grid-cols-3">
        {["Açık renkli, düz zemin (A4 kâğıt)", "Taneleri birbirine değmeden dağıtın", "Gölgesiz, yukarıdan, net çekim"].map((t, i) => (
          <div key={t} className="flex items-center gap-2 rounded-xl bg-paper-2/60 px-3 py-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] text-paper">{i + 1}</span> {t}
          </div>
        ))}
      </div>

      {files.length < 3 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            accept(e.dataTransfer.files);
          }}
          className={cn(
            "grid place-items-center rounded-2xl border-2 border-dashed p-8 text-center transition",
            over ? "border-wheat-500 bg-wheat-50" : "border-ink/15 bg-white/40",
          )}
        >
          <ImagePlus className="size-9 text-wheat-600" />
          <p className="mt-3 font-semibold">Numune fotoğrafını sürükleyin</p>
          <p className="text-sm text-ink-mute">1–3 fotoğraf · JPEG, PNG, WebP · en fazla 15 MB</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => camera.current?.click()}>
              <Camera /> Fotoğraf çek
            </Button>
            <Button type="button" variant="outline" onClick={() => input.current?.click()}>
              Dosya seç
            </Button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => accept(e.target.files)} />
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => accept(e.target.files)} />
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-5 grid grid-cols-3 gap-3">
          {previews.map((src, i) => (
            <li key={src} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-ink/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Numune ${i + 1}`} className="size-full object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/80 text-paper opacity-90 hover:bg-alarm-500"
                aria-label="Kaldır"
              >
                <Trash2 className="size-4" />
              </button>
              <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-paper">{i + 1}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Scanning({ preview }: { preview?: string }) {
  const [phase, setPhase] = useState(0);
  const phases = ["Görüntü kalitesi kontrol ediliyor", "Taneler zeminden ayrılıyor", "Değen taneler watershed ile bölünüyor", "Her tane sınıflandırılıyor", "Açıklama görüntüsü çiziliyor"];
  useEffect(() => {
    const t = setInterval(() => setPhase((p) => Math.min(p + 1, phases.length - 1)), 900);
    return () => clearInterval(t);
  }, [phases.length]);
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="size-full object-contain opacity-70" />}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(217,164,65,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(217,164,65,.12)_1px,transparent_1px)] bg-[size:28px_28px]" />
        <div className="absolute inset-x-0 h-24 -translate-y-full animate-scan bg-gradient-to-b from-transparent via-wheat-300/40 to-wheat-300/0">
          <div className="absolute bottom-0 h-0.5 w-full bg-wheat-300 shadow-[0_0_20px_4px_rgba(228,190,100,.8)]" />
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {phases.map((p, i) => (
          <li key={p} className={cn("flex items-center gap-2 text-sm transition", i <= phase ? "text-ink" : "text-ink-mute/50")}>
            {i < phase ? <Check className="size-4 text-field-500" /> : i === phase ? <Loader2 className="size-4 animate-spin text-wheat-600" /> : <span className="size-4" />}
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Success({ publicId, passportUrl, qr }: { publicId: string; passportUrl: string; qr: string }) {
  const local = /localhost|127\.0\.0\.1/.test(passportUrl);
  return (
    <div className="mt-8 overflow-hidden rounded-[2rem] ink-stage p-6 text-center sm:p-10 animate-in zoom-in-95 fade-in duration-500">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-field-500 text-white ring-8 ring-field-500/20">
        <Check className="size-7" />
      </div>
      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-wheat-300">Parti oluşturuldu · zincir kuyruğunda</p>
      <h2 className="display mt-2 text-4xl font-semibold text-paper sm:text-5xl">{publicId}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Pasaport QR kodu" className="mx-auto mt-8 size-56 rounded-2xl bg-white p-3" />
      <p className="mt-3 break-all font-mono text-xs text-paper/60">{passportUrl}</p>
      {local && (
        <p className="mx-auto mt-3 max-w-md rounded-xl bg-wheat-400/15 p-3 text-xs text-wheat-200">
          QR “localhost” içeriyor; başka bir telefonda açılmaz. .env içinde PUBLIC_BASE_URL'i bilgisayarın ağ adresine (ör. http://192.168.1.20:3000) ayarlayın.
        </p>
      )}
      <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href={`/p/${publicId}`} className={buttonVariants({ variant: "wheat", size: "lg" })}>
          <ShieldCheck /> Pasaportu aç
        </Link>
        <a href={`/api/lots/${publicId}/label`} target="_blank" className={buttonVariants({ variant: "light", size: "lg" })}>
          <FileDown /> QR etiket (PDF)
        </a>
        <Link href="/panel" className={buttonVariants({ variant: "ghost", size: "lg", className: "text-paper hover:bg-paper/10" })}>
          Panele dön
        </Link>
      </div>
    </div>
  );
}
