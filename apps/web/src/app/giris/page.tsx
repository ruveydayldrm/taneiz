import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const metadata = { title: "Giriş" };

const DEMO = [
  { role: "Üretici", email: "uretici@taneiz.demo", desc: "Parti oluştur, fotoğrafla, QR etiket bas" },
  { role: "Depo", email: "depo@taneiz.demo", desc: "QR okut, teslim al" },
  { role: "Alıcı", email: "alici@taneiz.demo", desc: "QR okut, satın al" },
  { role: "Yönetici", email: "admin@taneiz.demo", desc: "Her şey + kurcalama demosu" },
];

export default function LoginPage() {
  return (
    <main className="container grid gap-10 py-10 lg:grid-cols-2 lg:py-20">
      <section className="ink-stage relative hidden overflow-hidden rounded-[2rem] p-10 lg:block">
        <Logo light />
        <p className="display mt-24 text-5xl font-semibold leading-[1.05] text-paper">
          Kayıt bir kez mühürlenir.
          <span className="block italic text-wheat-300">Sonra herkes doğrular.</span>
        </p>
        <p className="mt-6 max-w-sm text-paper/70">
          Üretici fotoğrafı çeker, yapay zekâ taneleri sayar, zincir mühürler. Depo ve alıcı yalnızca QR okutur.
        </p>
        <GrainField />
      </section>

      <section className="mx-auto w-full max-w-md">
        <p className="eyebrow">Hesabınıza girin</p>
        <h1 className="display mt-2 text-4xl font-semibold">Hoş geldiniz</h1>
        <Suspense>
          <LoginForm demoAccounts={DEMO} />
        </Suspense>
      </section>
    </main>
  );
}

function GrainField() {
  return (
    <div className="pointer-events-none absolute -bottom-10 -right-10 grid grid-cols-6 gap-4 opacity-60">
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="block h-9 w-5 rounded-[50%] bg-gradient-to-br from-wheat-300 to-wheat-600 animate-float"
          style={{ animationDelay: `${(i % 7) * 0.4}s`, ["--r" as string]: `${(i * 37) % 180}deg` }}
        />
      ))}
    </div>
  );
}
