import { cn } from "@/lib/utils";

const GRADE_STYLE: Record<string, { color: string; num: string }> = {
  SINIF_1: { color: "#2F6B45", num: "1." },
  SINIF_2: { color: "#A06D1B", num: "2." },
  SINIF_3: { color: "#A8431F", num: "3." },
};

/** Döner yazılı, mürekkep damgası görünümlü kalite mührü. */
export function GradeStamp({ grade, className, animate = true }: { grade?: string | null; className?: string; animate?: boolean }) {
  const s = (grade && GRADE_STYLE[grade]) || { color: "#7A7364", num: "?" };
  const id = `arc-${grade ?? "none"}`;
  return (
    <div className={cn("relative size-36 sm:size-44", animate && "animate-stamp-in", className)} style={{ color: s.color }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <path id={id} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
          <filter id="rough">
            <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
          </filter>
        </defs>
        <g filter="url(#rough)" opacity=".92">
          <circle cx="100" cy="100" r="95" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <g className="origin-center animate-spin-slow" style={{ transformBox: "fill-box" }}>
            <text fontSize="12.5" fontWeight="700" letterSpacing="3.2" fill="currentColor" fontFamily="var(--font-mono)">
              <textPath href={`#${id}`}>TANEİZ · YAPAY ZEKÂ KALİTE ANALİZİ · ZİNCİRDE MÜHÜRLÜ ·</textPath>
            </text>
          </g>
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none" style={{ filter: "url(#rough)" }}>
          <div className="display text-5xl font-bold italic sm:text-6xl">{s.num}</div>
          <div className="mt-1 font-mono text-[11px] font-bold tracking-[0.35em]">SINIF</div>
        </div>
      </div>
    </div>
  );
}
