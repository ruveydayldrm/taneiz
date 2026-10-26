import { readStored } from "@/lib/storage";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Numune ve açıklama görüntülerini sunar (yalnızca resimler; taslak sonuç JSON'ları sunulmaz). */
export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const rel = params.path.join("/");
  const ext = rel.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext] || !/^(lots|drafts)\//.test(rel)) return new Response("Bulunamadı", { status: 404 });
  try {
    const data = await readStored(rel);
    return new Response(Buffer.from(data), {
      headers: { "Content-Type": TYPES[ext], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Bulunamadı", { status: 404 });
  }
}
