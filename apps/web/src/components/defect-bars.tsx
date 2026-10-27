import { CLASS_META, GRAIN_CLASSES } from "@taneiz/shared";
import { pct } from "@/lib/utils";

export function DefectBars({ ratios, counts }: { ratios: Record<string, number>; counts?: Record<string, number> }) {
  const healthy = ratios.SAGLIKLI ?? 0;
  const defects = GRAIN_CLASSES.filter((c) => c !== "SAGLIKLI");

  return (
    <div>
      {/* Tek şerit: tüm dağılım */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-ink/5 ring-1 ring-ink/10">
        {GRAIN_CLASSES.map((c) =>
          (ratios[c] ?? 0) > 0 ? (
            <div
              key={c}
              title={`${CLASS_META[c].label}: ${pct(ratios[c] ?? 0)}`}
              className="h-full origin-left animate-in slide-in-from-left duration-700"
              style={{ width: `${(ratios[c] ?? 0) * 100}%`, background: CLASS_META[c].color }}
            />
          ) : null,
        )}
      </div>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink-soft">Sağlıklı tane</span>
        <span className="display text-3xl font-semibold text-field-600">{pct(healthy)}</span>
      </div>

      <ul className="mt-4 space-y-3">
        {defects.map((c) => {
          // Modelin hiç ölçmediği sınıf: oranlarda anahtar yoktur → "%0" değil "ölçülmüyor"
          if (!(c in ratios)) {
            return (
              <li key={c} className="flex items-center justify-between gap-3 opacity-55">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <span className="size-2.5 rounded-sm bg-ink/20" />
                  {CLASS_META[c].label}
                </span>
                <span className="text-[11px] font-semibold text-ink-mute">modelde yok · ölçülmüyor</span>
              </li>
            );
          }
          const v = ratios[c] ?? 0;
          // Kusurlar küçük oranlar: %20'yi tam genişlik kabul et ki farklar görünsün
          const w = Math.min(100, (v / 0.2) * 100);
          return (
            <li key={c} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <span className="size-2.5 rounded-sm" style={{ background: CLASS_META[c].color }} />
                {CLASS_META[c].label}
                {counts && <span className="font-mono text-[11px] text-ink-mute">· {counts[c] ?? 0} tane</span>}
              </span>
              <span className="font-mono text-[13px] font-semibold tabular-nums">{pct(v)}</span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-ink/[.06]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(v > 0 ? 2 : 0, w)}%`, background: CLASS_META[c].color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-ink-mute">Kusur çubuklarında tam genişlik = %20.</p>
    </div>
  );
}
