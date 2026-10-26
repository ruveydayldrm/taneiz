"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, PackageCheck, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { QrScanner, extractPublicId } from "./qr-scanner";
import { Button, buttonVariants } from "./ui/button";
import { Field, Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { kg } from "@/lib/utils";

type Mode = "DEPO_TESLIM" | "ALICI_TESLIM";
type LotSummary = {
  publicId: string;
  product: string;
  variety: string;
  quantityKg: number;
  province: string;
  district: string;
  status: string;
  gradeLabel: string | null;
  moisture: number | null;
};

const STATUS_TR: Record<string, string> = { HASAT: "Üreticide", DEPODA: "Depoda", SATILDI: "Satıldı" };

export function ScanFlow({ mode, recent }: { mode: Mode; recent: { publicId: string; variety: string; district: string }[] }) {
  const [lot, setLot] = useState<LotSummary | null>(null);
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  async function load(publicId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lots/${publicId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Parti bulunamadı.");
      setLot(body);
      setForm(
        mode === "DEPO_TESLIM"
          ? { warehouseName: "", receivedKg: String(body.quantityKg), province: body.province, district: "", note: "" }
          : { buyerName: "", purchasedKg: String(body.quantityKg), destination: "", note: "" },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lot) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { type: mode, ...form };
      if (!form.note) delete payload.note;
      const res = await fetch(`/api/lots/${lot.publicId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Kayıt başarısız.");
      setDone(lot.publicId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const reset = () => {
    setLot(null);
    setDone(null);
    setError(null);
    setManual("");
  };

  if (done) {
    return (
      <div className="ink-stage mt-8 rounded-[2rem] p-8 text-center animate-in zoom-in-95 fade-in">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-field-500 text-white ring-8 ring-field-500/20">
          <Check className="size-7" />
        </div>
        <p className="display mt-5 text-4xl font-semibold text-paper">{mode === "DEPO_TESLIM" ? "Teslim alındı" : "Satın alındı"}</p>
        <p className="mt-2 text-paper/70">{done} için kayıt oluşturuldu; hash birkaç saniye içinde zincire yazılacak.</p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href={`/p/${done}`} className={buttonVariants({ variant: "wheat", size: "lg" })}>
            <ShieldCheck /> Pasaportta gör
          </Link>
          <Button variant="light" size="lg" onClick={reset}>
            <RotateCcw /> Yeni okutma
          </Button>
        </div>
      </div>
    );
  }

  if (lot) {
    const blocked = lot.status === "SATILDI" || (mode === "DEPO_TESLIM" && lot.status === "DEPODA");
    return (
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="paper-card guilloche h-fit p-6">
          <p className="font-mono text-xs font-bold tracking-widest text-wheat-600">{lot.publicId}</p>
          <p className="display mt-1 text-3xl font-semibold">{lot.variety}</p>
          <p className="text-sm text-ink-mute">
            {lot.product} · {lot.district}, {lot.province}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge variant="outline">{STATUS_TR[lot.status]}</Badge>
            {lot.gradeLabel && <Badge variant="field">{lot.gradeLabel}</Badge>}
            {lot.moisture !== null && <Badge variant="wheat">Nem %{lot.moisture}</Badge>}
            <Badge variant="muted">{kg(lot.quantityKg)}</Badge>
          </div>
          <Link href={`/p/${lot.publicId}`} target="_blank" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold link-underline">
            Pasaportu doğrula <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <form onSubmit={submit} className="paper-card space-y-4 p-6">
          <p className="display text-2xl font-semibold">{mode === "DEPO_TESLIM" ? "Depoya teslim al" : "Satın alma kaydı"}</p>
          {blocked && (
            <p className="rounded-xl bg-wheat-50 p-3 text-sm text-wheat-700">
              Bu parti {STATUS_TR[lot.status].toLowerCase()}; bu işlem yapılamaz.
            </p>
          )}
          {mode === "DEPO_TESLIM" ? (
            <>
              <Field label="Depo / lisanslı depo adı">
                <Input required value={form.warehouseName} onChange={(e) => setForm({ ...form, warehouseName: e.target.value })} placeholder="ör. Ova Lisanslı Depo A.Ş." />
              </Field>
              <Field label="Teslim alınan miktar (kg)">
                <Input required type="number" min="1" value={form.receivedKg} onChange={(e) => setForm({ ...form, receivedKg: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Depo ili">
                  <Input required value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
                </Field>
                <Field label="Depo ilçesi">
                  <Input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Alıcı firma">
                <Input required value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} placeholder="ör. Anadolu Un Sanayi" />
              </Field>
              <Field label="Satın alınan miktar (kg)">
                <Input required type="number" min="1" value={form.purchasedKg} onChange={(e) => setForm({ ...form, purchasedKg: e.target.value })} />
              </Field>
              <Field label="Varış yeri">
                <Input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="ör. Ankara / Sincan fabrika" />
              </Field>
            </>
          )}
          <Field label="Not (isteğe bağlı)" hint="Kişisel bilgi yazmayın; not, hash'i zincire yazılan veriye dahil edilir.">
            <Input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          {error && <p className="rounded-xl bg-alarm-50 p-3 text-sm text-alarm-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={reset}>
              Vazgeç
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={loading || blocked}>
              {loading ? <Loader2 className="animate-spin" /> : <PackageCheck />} Kaydet ve mühürle
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <QrScanner onResult={load} />
      <div className="space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const pid = extractPublicId(manual);
            if (pid) load(pid);
            else setError("Geçerli bir parti kimliği girin (ör. TZ-7K3P9Q).");
          }}
          className="paper-card p-5"
        >
          <p className="text-sm font-bold">Kodu elle girin</p>
          <div className="mt-3 flex gap-2">
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="TZ-XXXXXX" className="font-mono uppercase" />
            <Button type="submit" size="icon" className="size-12 shrink-0" aria-label="Ara" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-alarm-600">{error}</p>}
        </form>
        {recent.length > 0 && (
          <div>
            <p className="eyebrow mb-2">İşlem bekleyen partiler</p>
            <div className="grid gap-2">
              {recent.map((r) => (
                <button
                  key={r.publicId}
                  onClick={() => load(r.publicId)}
                  className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/50 px-4 py-3 text-left text-sm transition hover:border-wheat-500 hover:bg-white"
                >
                  <span>
                    <span className="font-mono font-bold">{r.publicId}</span>
                    <span className="ml-2 text-ink-mute">
                      {r.variety} · {r.district}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink-mute" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
