"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, RotateCcw, Skull } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Lot = {
  publicId: string;
  variety: string;
  district: string;
  grade: string | null;
  events: { id: string; title: string; type: string; onChain: boolean; tampered: boolean }[];
};

export function TamperBoard({ lots }: { lots: Lot[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; publicId: string; bad: boolean } | null>(null);

  async function act(eventId: string, action: "tamper" | "restore") {
    setBusy(eventId);
    setMessage(null);
    const res = await fetch("/api/demo/tamper", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, action }),
    });
    const body = await res.json();
    setBusy(null);
    if (!res.ok) {
      setMessage({ text: body.error ?? "İşlem başarısız", publicId: "", bad: true });
      return;
    }
    setMessage({
      text: action === "tamper" ? `Veritabanı değiştirildi: ${body.description}` : "Orijinal veri geri yüklendi.",
      publicId: body.publicId,
      bad: action === "tamper",
    });
    router.refresh();
  }

  return (
    <div className="mt-8">
      {message && (
        <div
          className={cn(
            "sticky top-20 z-10 mb-6 flex flex-col gap-3 rounded-2xl p-4 shadow-lift sm:flex-row sm:items-center sm:justify-between animate-in slide-in-from-top-2",
            message.bad ? "bg-alarm-500 text-white" : "bg-field-600 text-white",
          )}
        >
          <p className="text-sm font-semibold">{message.text}</p>
          {message.publicId && (
            <Link href={`/p/${message.publicId}`} target="_blank" className={buttonVariants({ variant: "light", size: "sm" })}>
              Pasaportta doğrula <ExternalLink />
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lots.map((lot) => (
          <div key={lot.publicId} className="paper-card p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold tracking-widest text-wheat-600">{lot.publicId}</p>
                <p className="display text-xl font-semibold">{lot.variety}</p>
                <p className="text-xs text-ink-mute">
                  {lot.district}
                  {lot.grade ? ` · ${lot.grade}` : ""}
                </p>
              </div>
              <Link href={`/p/${lot.publicId}`} target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Pasaport
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {lot.events.map((e) => (
                <li
                  key={e.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                    e.tampered ? "bg-alarm-50 ring-1 ring-alarm-500/40" : "bg-paper-2/50",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{e.title}</span>
                    {e.tampered ? <Badge variant="alarm">Kurcalandı</Badge> : !e.onChain && <Badge variant="wheat">Zincir kuyruğunda</Badge>}
                  </span>
                  {e.tampered ? (
                    <Button size="sm" variant="field" disabled={busy === e.id} onClick={() => act(e.id, "restore")}>
                      {busy === e.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Geri al
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" disabled={busy === e.id || !e.onChain} onClick={() => act(e.id, "tamper")}>
                      {busy === e.id ? <Loader2 className="animate-spin" /> : <Skull />} Kurcala
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
