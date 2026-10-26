"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const HOME: Record<string, string> = { URETICI: "/panel", DEPO: "/depo", ALICI: "/alici", ADMIN: "/panel" };
const DEMO_PASSWORD = "taneiz123";

export function LoginForm({ demoAccounts }: { demoAccounts: { role: string; email: string; desc: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("hata") === "yetki" ? "Bu sayfa için yetkiniz yok. Uygun hesapla girin." : null);
  const [loading, setLoading] = useState(false);

  async function submit(e?: React.FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { redirect: false, ...(creds ?? { email, password }) });
    if (!res || res.error) {
      setLoading(false);
      setError("E-posta veya şifre hatalı.");
      return;
    }
    const session = await getSession();
    const cb = params.get("callbackUrl");
    router.push(cb && cb.startsWith("/") ? cb : HOME[session?.user.role ?? ""] ?? "/");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="E-posta">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Şifre">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="rounded-xl bg-alarm-50 px-4 py-3 text-sm font-medium text-alarm-600">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} Giriş yap
        </Button>
      </form>

      <div className="mt-10">
        <p className="eyebrow mb-3">Demo hesapları · şifre: {DEMO_PASSWORD}</p>
        <div className="grid gap-2">
          {demoAccounts.map((a) => (
            <button
              key={a.email}
              type="button"
              disabled={loading}
              onClick={() => {
                setEmail(a.email);
                setPassword(DEMO_PASSWORD);
                submit(undefined, { email: a.email, password: DEMO_PASSWORD });
              }}
              className="group flex items-center justify-between rounded-2xl border border-ink/10 bg-white/50 px-4 py-3 text-left transition hover:border-wheat-500 hover:bg-white"
            >
              <span>
                <span className="block text-sm font-bold">{a.role}</span>
                <span className="block text-xs text-ink-mute">{a.desc}</span>
              </span>
              <ArrowRight className="size-4 text-ink-mute transition group-hover:translate-x-1 group-hover:text-wheat-600" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
