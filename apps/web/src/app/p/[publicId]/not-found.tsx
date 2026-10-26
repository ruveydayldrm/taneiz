import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="container grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <p className="eyebrow">Ürün Pasaportu</p>
        <h1 className="display mt-3 text-5xl font-semibold">Böyle bir parti yok.</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-mute">QR kodu doğru okunmamış ya da parti kimliği hatalı olabilir. Kimlikler TZ- ile başlar.</p>
        <Link href="/" className={buttonVariants({ className: "mt-8" })}>
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
