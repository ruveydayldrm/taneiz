import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10">
      <div className="container flex flex-col gap-6 py-10 text-sm text-ink-mute sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden h-6 w-px bg-ink/15 sm:block" />
          <span className="max-w-xs">Buğday için doğrulanabilir kalite ve köken. Demo sürümü.</span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/model" className="hover:text-ink">Model Kartı</Link>
          <Link href="/#nasil" className="hover:text-ink">Nasıl çalışır</Link>
          <span>Zincire yalnızca hash yazılır · kişisel veri yazılmaz</span>
        </div>
      </div>
    </footer>
  );
}
