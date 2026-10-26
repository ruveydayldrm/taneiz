import { cn } from "@/lib/utils";

/** Başak + zincir halkası birleşimi işaret. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <circle cx="20" cy="20" r="19" fill="currentColor" className="text-ink" />
      <g fill="#D9A441">
        <ellipse cx="20" cy="10.5" rx="2.6" ry="4.4" />
        <ellipse cx="15.6" cy="15.5" rx="2.4" ry="4" transform="rotate(-32 15.6 15.5)" />
        <ellipse cx="24.4" cy="15.5" rx="2.4" ry="4" transform="rotate(32 24.4 15.5)" />
        <ellipse cx="15.6" cy="22" rx="2.4" ry="4" transform="rotate(-32 15.6 22)" />
        <ellipse cx="24.4" cy="22" rx="2.4" ry="4" transform="rotate(32 24.4 22)" />
      </g>
      <path d="M20 14v17" stroke="#D9A441" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="15.5" y="28.5" width="9" height="5" rx="2.5" fill="none" stroke="#F7F1E3" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("display text-[22px] font-semibold leading-none", light ? "text-paper" : "text-ink")}>
        Tane<span className="italic text-wheat-500">İZ</span>
      </span>
    </span>
  );
}
