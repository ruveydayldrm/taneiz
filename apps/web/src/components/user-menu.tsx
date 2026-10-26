"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Menu, X } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";

const ROLE_TR: Record<string, string> = { URETICI: "Üretici", DEPO: "Depo", ALICI: "Alıcı", ADMIN: "Yönetici" };

export function UserMenu({
  user,
  links,
}: {
  user: { name?: string | null; role: string } | null;
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <Link href="/giris" className={buttonVariants({ size: "sm", className: "ml-1" })}>
        Giriş yap
      </Link>
    );
  }

  return (
    <div className="relative ml-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 py-1 pl-1 pr-3 hover:bg-white"
        aria-expanded={open}
      >
        <span className="grid size-7 place-items-center rounded-full bg-wheat-400 text-xs font-bold text-ink">
          {(user.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden text-[13px] sm:inline">{ROLE_TR[user.role] ?? user.role}</span>
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-60 animate-in fade-in slide-in-from-top-2 rounded-2xl border border-ink/10 bg-[#FBF7EE] p-2 shadow-lift">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="eyebrow mt-0.5">{ROLE_TR[user.role]}</p>
          </div>
          <div className="my-1 h-px bg-ink/10" />
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm hover:bg-ink/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-ink/10" />
          <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl" onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut /> Çıkış yap
          </Button>
        </div>
      )}
    </div>
  );
}
