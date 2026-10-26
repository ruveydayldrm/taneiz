"use client";

import { useCallback, useRef, useState } from "react";
import { ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";

/** Orijinal ↔ yapay zekâ açıklama görüntüsü karşılaştırma sürgüsü. */
export function CompareSlider({
  pairs,
  className,
}: {
  pairs: { original: string; annotated: string }[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  }, []);

  const pair = pairs[active];
  if (!pair) return null;

  return (
    <div className={className}>
      <div
        ref={ref}
        className="group relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-2xl bg-ink shadow-paper ring-1 ring-ink/10"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && move(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pair.annotated} alt="Yapay zekâ açıklama görüntüsü" className="absolute inset-0 size-full object-contain" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pair.original} alt="Orijinal numune fotoğrafı" className="absolute inset-0 size-full object-contain" draggable={false} />
        </div>

        <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-wheat-300 shadow-[0_0_0_1px_rgba(0,0,0,.2)]" style={{ left: `${pos}%` }}>
          <div className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-wheat-400 text-ink shadow-lift ring-4 ring-ink/20">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M9 6l-6 6 6 6M15 6l6 6-6 6" />
            </svg>
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/75 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-paper backdrop-blur">
          Orijinal
        </span>
        <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-wheat-400 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
          <ScanSearch className="size-3.5" /> Yapay zekâ
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="w-full accent-wheat-500"
          aria-label="Karşılaştırma sürgüsü"
        />
        {pairs.length > 1 && (
          <div className="flex shrink-0 gap-1.5">
            {pairs.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  "size-8 rounded-full font-mono text-xs font-bold ring-1 ring-ink/15",
                  i === active ? "bg-ink text-paper" : "bg-white/70 hover:bg-white",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
