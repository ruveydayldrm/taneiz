import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { analyzeWithAi } from "@/lib/ai";
import { extFor, fileUrl, writeStored } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Numune fotoğraflarını AI servisine iletir, sonucu sunucu tarafında bir "taslak" olarak saklar.
 * Parti kaydı bu taslaktan oluşturulur; istemci analiz sonucunu değiştiremez.
 */
export const POST = handle(async (req: Request) => {
  await requireRole("URETICI");
  const form = await req.formData();
  const files = form.getAll("images").filter((f): f is File => f instanceof File);
  if (files.length < 1 || files.length > 3) throw new HttpError(400, "1 ile 3 arasında numune fotoğrafı yükleyin.");

  const inputs = [];
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) throw new HttpError(400, `${f.name}: yalnızca JPEG, PNG veya WebP.`);
    if (f.size > 15 * 1024 * 1024) throw new HttpError(400, `${f.name}: 15 MB sınırını aşıyor.`);
    inputs.push({ data: new Uint8Array(await f.arrayBuffer()), name: f.name, type: f.type });
  }

  const ai = await analyzeWithAi(inputs);

  const draftId = crypto.randomUUID();
  const originals = await Promise.all(
    inputs.map((f, i) => writeStored(`drafts/${draftId}/orig-${i}.${extFor(f.type)}`, f.data)),
  );
  const annotated = await Promise.all(
    ai.images.map((img, i) =>
      writeStored(`drafts/${draftId}/annotated-${i}.jpg`, new Uint8Array(Buffer.from(img.annotated_jpeg_base64, "base64"))),
    ),
  );
  const { images, ...rest } = ai;
  const result = { ...rest, images: images.map(({ annotated_jpeg_base64: _, ...m }) => m) };
  await writeStored(
    `drafts/${draftId}/result.json`,
    new TextEncoder().encode(JSON.stringify({ result, originals, annotated })),
  );

  return NextResponse.json({
    draftId,
    result,
    pairs: originals.map((o, i) => ({ original: fileUrl(o.path), annotated: fileUrl(annotated[i].path) })),
  });
});
