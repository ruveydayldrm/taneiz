import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string, withTime = false) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function pct(v: number, digits = 1) {
  return `%${(v * 100).toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function shortHash(h?: string | null, n = 6) {
  if (!h) return "—";
  return `${h.slice(0, n + 2)}…${h.slice(-n)}`;
}

export function kg(v: number) {
  return v >= 1000
    ? `${(v / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ton`
    : `${v.toLocaleString("tr-TR")} kg`;
}

export function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
