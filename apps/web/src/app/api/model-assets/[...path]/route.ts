import { config } from "@/lib/config";

/** AI servisindeki model kartı görsellerini (confusion matrix, örnekler) tarayıcıya aktarır. */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const rel = params.path.map(encodeURIComponent).join("/");
  try {
    const res = await fetch(`${config.aiServiceUrl}/artifacts/${rel}`, { cache: "no-store" });
    if (!res.ok) return new Response("Bulunamadı", { status: 404 });
    return new Response(res.body, {
      headers: { "Content-Type": res.headers.get("content-type") ?? "image/png", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return new Response("AI servisine ulaşılamadı", { status: 503 });
  }
}
