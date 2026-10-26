import Link from "next/link";
import { getSession } from "@/lib/auth";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

const ROLE_LINKS: Record<string, { href: string; label: string }[]> = {
  URETICI: [{ href: "/panel", label: "Panelim" }],
  DEPO: [{ href: "/depo", label: "Depo" }],
  ALICI: [{ href: "/alici", label: "Alıcı" }],
  ADMIN: [
    { href: "/panel", label: "Panel" },
    { href: "/depo", label: "Depo" },
    { href: "/alici", label: "Alıcı" },
    { href: "/demo/kurcala", label: "Kurcala" },
  ],
};

export async function SiteHeader() {
  const session = await getSession();
  const roleLinks = session ? ROLE_LINKS[session.user.role] ?? [] : [];

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="TaneİZ ana sayfa">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/model" className="hidden rounded-full px-3 py-2 text-ink-soft hover:bg-ink/5 hover:text-ink sm:inline-flex">
            Model Kartı
          </Link>
          {roleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hidden rounded-full px-3 py-2 text-ink-soft hover:bg-ink/5 hover:text-ink md:inline-flex"
            >
              {l.label}
            </Link>
          ))}
          <UserMenu user={session?.user ?? null} links={[{ href: "/model", label: "Model Kartı" }, ...roleLinks]} />
        </nav>
      </div>
    </header>
  );
}
