import { BrainCircuit, Database, FlaskConical, Lock, ShieldAlert, Terminal } from "lucide-react";
import { CLASS_META, type GrainClass } from "@taneiz/shared";
import { fetchModelCard, type ModelCard } from "@/lib/ai";
import { cn, formatDate, pct } from "@/lib/utils";

export const metadata = { title: "Model Kartı" };
export const dynamic = "force-dynamic";

const label = (c: string) => CLASS_META[c as GrainClass]?.label ?? c;
const color = (c: string) => CLASS_META[c as GrainClass]?.color ?? "#888";

export default async function ModelPage() {
  const res = await fetchModelCard();
  if (!res.ok) return <NoModel error={res.error} />;
  const card = res.card;
  const m = card.test_metrics;

  return (
    <main className="pb-10">
      <section className="ink-stage">
        <div className="container py-12 sm:py-16">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-wheat-300">Model Kartı · {card.model_version}</p>
          <h1 className="display mt-3 max-w-3xl text-5xl font-semibold leading-[1] text-paper sm:text-6xl">
            Ezber değil, <span className="italic text-wheat-300">kilitli test seti.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-paper/70">
            Aşağıdaki tüm sayılar, eğitim ve model seçiminde hiç kullanılmayan, hash'i kilitlenmiş {m.n_test.toLocaleString("tr-TR")} görüntülük
            test setinden <code className="font-mono text-wheat-200">ml/evaluate.py</code> tarafından üretildi.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-paper/10 sm:grid-cols-4">
            <Metric label="Doğruluk" value={pct(m.accuracy)} />
            <Metric label="Macro F1" value={pct(m.macro_f1)} />
            <Metric label="Ağırlıklı F1" value={pct(m.weighted_f1)} />
            <Metric label="Test görüntüsü" value={m.n_test.toLocaleString("tr-TR")} />
          </div>
        </div>
      </section>

      <div className="container mt-12 space-y-14">
        <section className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Sınıf bazında</p>
            <h2 className="display mt-1 text-3xl font-semibold">Precision · Recall · F1</h2>
            <div className="paper-card mt-5 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper-2/60 text-left text-[11px] uppercase tracking-wider text-ink-mute">
                  <tr>
                    <th className="p-3 font-semibold">Sınıf</th>
                    <th className="p-3 text-right font-semibold">P</th>
                    <th className="p-3 text-right font-semibold">R</th>
                    <th className="p-3 text-right font-semibold">F1</th>
                    <th className="p-3 text-right font-semibold">n</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {card.classes.map((c) => {
                    const r = m.per_class[c];
                    return (
                      <tr key={c}>
                        <td className="p-3">
                          <span className="flex items-center gap-2 font-semibold">
                            <span className="size-2.5 rounded-sm" style={{ background: color(c) }} />
                            {label(c)}
                          </span>
                          <div className="mt-1.5 h-1 rounded-full bg-ink/5">
                            <div className="h-full rounded-full" style={{ width: `${r.f1 * 100}%`, background: color(c) }} />
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono tabular-nums">{r.precision.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono tabular-nums">{r.recall.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono font-bold tabular-nums">{r.f1.toFixed(3)}</td>
                        <td className="p-3 text-right font-mono tabular-nums text-ink-mute">{r.support}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="eyebrow">Karışıklık matrisi</p>
            <h2 className="display mt-1 text-3xl font-semibold">Nerede şaşırıyor?</h2>
            <ConfusionMatrix classes={card.classes} cm={m.confusion_matrix} />
            {card.confusion_matrix_image && (
              <a href={`/api/model-assets/${card.confusion_matrix_image}`} target="_blank" className="mt-3 inline-block text-xs font-semibold link-underline">
                evaluate.py'nin ürettiği PNG'yi aç
              </a>
            )}
          </div>
        </section>

        {card.samples && Object.keys(card.samples).length > 0 && (
          <section>
            <p className="eyebrow">Test setinden örnekler</p>
            <h2 className="display mt-1 text-3xl font-semibold">Sınıf başına gerçek görüntüler</h2>
            <p className="mt-1 text-sm text-ink-mute">Rastgele seçildi; yanlış tahminler de gizlenmedi (kırmızı çerçeve).</p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(card.samples).map(([cls, items]) => (
                <div key={cls} className="paper-card p-4">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <span className="size-2.5 rounded-sm" style={{ background: color(cls) }} /> {label(cls)}
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {items.map((s) => (
                      <figure key={s.path} className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/model-assets/${s.path}`}
                          alt={`${label(s.true)} örneği`}
                          loading="lazy"
                          className={cn("aspect-square w-full rounded-lg object-cover ring-2", s.pred === s.true ? "ring-field-500/40" : "ring-alarm-500")}
                        />
                        <figcaption className="mt-1 truncate text-center font-mono text-[9px] text-ink-mute">
                          {s.pred === s.true ? "✓" : `→ ${label(s.pred)}`} {Math.round(s.confidence * 100)}%
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          <InfoCard icon={Database} title="Veri setleri">
            <ul className="space-y-3">
              {card.datasets.map((d) => (
                <li key={d.name}>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-ink-mute">{d.source}</p>
                  <p className="text-xs text-ink-mute">
                    {d.license} · {d.images_used.toLocaleString("tr-TR")} görüntü
                  </p>
                </li>
              ))}
            </ul>
            <SplitTable splits={card.split_counts} />
          </InfoCard>

          <InfoCard icon={BrainCircuit} title="Model ve çıkarım">
            <dl className="space-y-2 text-sm">
              <Dl k="Mimari" v={card.architecture} />
              <Dl k="Girdi" v={`${card.input_size}×${card.input_size} RGB`} />
              <Dl k="Oluşturma" v={formatDate(card.created_at)} />
              {card.training?.minutes != null && <Dl k="Eğitim süresi" v={`${card.training.minutes} dk (${card.training.device})`} />}
              {card.onnx && (
                <>
                  <Dl k="ONNX opset" v={String(card.onnx.opset)} />
                  <Dl k="PyTorch↔ONNX fark" v={card.onnx.max_abs_diff.toExponential(2)} />
                  <Dl k="Argmax uyumu" v={pct(card.onnx.argmax_agreement)} />
                </>
              )}
            </dl>
            {card.test_set_lock && (
              <div className="mt-4 rounded-xl bg-paper-2/60 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-mute">
                  <Lock className="size-3.5" /> Test seti kilidi (SHA-256)
                </p>
                <p className="hash mt-1">{card.test_set_lock.sha256}</p>
              </div>
            )}
          </InfoCard>

          <InfoCard icon={ShieldAlert} title="Sınırlamalar">
            <ul className="list-disc space-y-2 pl-4 text-sm text-ink-soft">
              {card.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </InfoCard>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink/40 p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60">{label}</p>
      <p className="display mt-1 text-4xl font-semibold text-wheat-300 sm:text-5xl">{value}</p>
    </div>
  );
}

function ConfusionMatrix({ classes, cm }: { classes: string[]; cm: number[][] }) {
  const rowSums = cm.map((r) => r.reduce((a, b) => a + b, 0) || 1);
  return (
    <div className="paper-card mt-5 overflow-x-auto p-4">
      <div className="grid min-w-[420px] gap-1" style={{ gridTemplateColumns: `90px repeat(${classes.length}, minmax(0,1fr))` }}>
        <div className="text-[10px] font-semibold text-ink-mute">gerçek ↓ / tahmin →</div>
        {classes.map((c) => (
          <div key={c} className="truncate text-center text-[10px] font-semibold text-ink-soft" title={label(c)}>
            {label(c).split(" ")[0]}
          </div>
        ))}
        {cm.map((row, i) => (
          <div key={i} className="contents">
            <div className="flex items-center truncate text-[11px] font-semibold">{label(classes[i])}</div>
            {row.map((v, j) => {
              const p = v / rowSums[i];
              return (
                <div
                  key={j}
                  title={`${label(classes[i])} → ${label(classes[j])}: ${v}`}
                  className={cn("grid aspect-square place-items-center rounded-md font-mono text-[11px] tabular-nums", i === j && "ring-1 ring-ink/30")}
                  style={{
                    background: i === j ? `rgba(47,107,69,${0.12 + p * 0.88})` : p > 0 ? `rgba(201,42,42,${0.08 + p * 1.6})` : "rgba(27,26,22,.03)",
                    color: (i === j && p > 0.55) || (i !== j && p > 0.35) ? "white" : "#1B1A16",
                  }}
                >
                  {v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SplitTable({ splits }: { splits: ModelCard["split_counts"] }) {
  const classes = Array.from(new Set(Object.values(splits).flatMap((s) => Object.keys(s))));
  return (
    <table className="mt-4 w-full text-xs">
      <thead className="text-ink-mute">
        <tr>
          <th className="py-1 text-left font-semibold">Sınıf</th>
          {["train", "val", "test"].map((s) => (
            <th key={s} className="py-1 text-right font-semibold">{s}</th>
          ))}
        </tr>
      </thead>
      <tbody className="font-mono">
        {classes.map((c) => (
          <tr key={c} className="border-t border-ink/5">
            <td className="py-1 font-sans">{label(c)}</td>
            {["train", "val", "test"].map((s) => (
              <td key={s} className="py-1 text-right tabular-nums">{splits[s]?.[c] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="paper-card p-6">
      <Icon className="size-5 text-wheat-600" />
      <h3 className="display mt-3 mb-4 text-xl font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function Dl({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-mute">{k}</dt>
      <dd className="text-right font-mono text-[13px] font-semibold">{v}</dd>
    </div>
  );
}

function NoModel({ error }: { error: string }) {
  return (
    <main className="container max-w-3xl py-16">
      <p className="eyebrow">Model Kartı</p>
      <h1 className="display mt-2 text-5xl font-semibold">Henüz gösterilecek metrik yok.</h1>
      <p className="mt-4 text-ink-soft">
        Bu sayfa yalnızca gerçek test metriklerini gösterir; uydurma sayı göstermez. Model eğitilip kilitli test setinde
        değerlendirildiğinde burası otomatik dolar.
      </p>
      <p className="mt-4 rounded-xl bg-alarm-50 p-3 text-sm text-alarm-600">{error}</p>
      <div className="paper-card mt-8 p-6">
        <p className="flex items-center gap-2 font-bold">
          <Terminal className="size-4" /> Modeli üretmek için
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-paper">
{`# Colab (önerilen): ml/train_colab.ipynb
python ml/prepare_data.py     # setleri birleştir, test setini kilitle
python ml/train.py            # EfficientNet-B0 transfer learning
python ml/evaluate.py         # model_card.json + confusion_matrix.png
python ml/export_onnx.py      # model.onnx + eşitlik doğrulaması
# sonra AI servisini yeniden başlatın`}
        </pre>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-mute">
          <FlaskConical className="size-3.5" /> Ayrıntılar: ml/DATASETS.md ve README.
        </p>
      </div>
    </main>
  );
}
