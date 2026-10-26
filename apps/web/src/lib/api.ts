import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

/** Rota işleyicilerini sarar: HttpError/ZodError → anlamlı JSON hata. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Geçersiz veri", issues: err.flatten().fieldErrors }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
    }
  };
}
