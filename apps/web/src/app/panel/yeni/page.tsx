import { LotWizard } from "./wizard";

export const metadata = { title: "Yeni parti" };

export default function NewLotPage() {
  return (
    <main className="container max-w-3xl py-8 sm:py-12">
      <p className="eyebrow">Yeni parti</p>
      <h1 className="display mt-1 text-4xl font-semibold sm:text-5xl">Partiyi pasaportla</h1>
      <p className="mt-1 text-ink-mute">Beş adımda: ürün bilgisi, numune fotoğrafı, nem, yapay zekâ analizi ve zincire mühür.</p>
      <LotWizard />
    </main>
  );
}
