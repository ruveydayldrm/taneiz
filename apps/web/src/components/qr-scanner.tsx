"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp } from "lucide-react";
import { Button } from "./ui/button";

/** QR içeriğinden parti kimliğini çıkarır: ".../p/TZ-XXXXXX" veya doğrudan "TZ-XXXXXX". */
export function extractPublicId(text: string): string | null {
  const m = text.toUpperCase().match(/TZ-[23456789A-HJ-KM-NP-Z]{6}/);
  return m ? m[0] : null;
}

type Scanner = {
  start: (...a: unknown[]) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  scanFile: (f: File, show: boolean) => Promise<string>;
  isScanning: boolean;
};

export function QrScanner({ onResult }: { onResult: (publicId: string) => void }) {
  const id = useId().replace(/:/g, "");
  const scanner = useRef<Scanner | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function getScanner() {
    if (!scanner.current) {
      const { Html5Qrcode } = await import("html5-qrcode");
      scanner.current = new Html5Qrcode(`qr-${id}`) as unknown as Scanner;
    }
    return scanner.current;
  }

  async function start() {
    setError(null);
    try {
      const s = await getScanner();
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (text: string) => {
          const pid = extractPublicId(text);
          if (!pid) return;
          await s.stop().catch(() => {});
          setActive(false);
          onResult(pid);
        },
        () => {},
      );
      setActive(true);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      setError(
        /secure|https|permission|NotAllowed/i.test(msg)
          ? "Kameraya erişilemedi. Telefonda kamera için HTTPS gerekir; izin verin veya fotoğraftan okutun."
          : `Kamera başlatılamadı: ${msg}`,
      );
    }
  }

  async function stop() {
    if (scanner.current?.isScanning) await scanner.current.stop().catch(() => {});
    setActive(false);
  }

  async function scanFile(f: File) {
    setError(null);
    try {
      if (scanner.current?.isScanning) await stop();
      const s = await getScanner();
      const text = await s.scanFile(f, false);
      const pid = extractPublicId(text);
      if (!pid) throw new Error("QR bir TaneİZ pasaportu değil.");
      onResult(pid);
    } catch (e) {
      setError((e as Error)?.message?.includes("TaneİZ") ? (e as Error).message : "Fotoğrafta QR kodu bulunamadı.");
    }
  }

  useEffect(() => {
    return () => {
      if (scanner.current?.isScanning) scanner.current.stop().catch(() => {});
    };
  }, []);

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-ink sm:aspect-[4/3]">
        <div id={`qr-${id}`} className="size-full [&_video]:!size-full [&_video]:object-cover" />
        {!active && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="relative size-48">
              {["left-0 top-0 border-l-4 border-t-4", "right-0 top-0 border-r-4 border-t-4", "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4"].map((c) => (
                <span key={c} className={`absolute size-10 rounded-sm border-wheat-400 ${c}`} />
              ))}
              <div className="absolute inset-0 grid place-items-center">
                <Button variant="wheat" onClick={start}>
                  <Camera /> Kamerayı aç
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {active && (
          <Button variant="outline" size="sm" onClick={stop}>
            <CameraOff /> Durdur
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageUp /> Fotoğraftan oku
        </Button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && scanFile(e.target.files[0])} />
      </div>
      {error && <p className="mt-3 rounded-xl bg-alarm-50 p-3 text-sm text-alarm-600">{error}</p>}
    </div>
  );
}
