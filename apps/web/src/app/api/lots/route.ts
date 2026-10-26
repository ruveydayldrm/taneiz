import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnalysisResult } from "@taneiz/shared";
import { HttpError, requireRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { createLotWithAnalysis, newPublicId } from "@/lib/lots";
import { moveStored, readStored, storagePath } from "@/lib/storage";
import { kickChainQueue } from "@/lib/queue";
import { baseUrlFrom } from "@/lib/config";

export const runtime = "nodejs";

const Body = z.object({
  draftId: z.string().uuid(),
  product: z.string().min(2).max(60),
  variety: z.string().min(2).max(60),
  harvestDate: z.coerce.date().refine((d) => d <= new Date(), "Hasat tarihi gelecekte olamaz"),
  quantityKg: z.coerce.number().positive().max(10_000_000),
  province: z.string().min(2).max(40),
  district: z.string().min(2).max(40),
  moisture: z.coerce.number().min(5).max(30),
});

type Draft = {
  result: AnalysisResult;
  originals: { path: string; sha256: string }[];
  annotated: { path: string; sha256: string }[];
};

export const POST = handle(async (req: Request) => {
  const user = await requireRole("URETICI");
  const body = Body.parse(await req.json());

  let draft: Draft;
  try {
    draft = JSON.parse(new TextDecoder().decode(await readStored(`drafts/${body.draftId}/result.json`)));
  } catch {
    throw new HttpError(400, "Analiz taslağı bulunamadı veya süresi doldu. Fotoğrafı yeniden analiz edin.");
  }

  const publicId = newPublicId();
  const move = (files: { path: string; sha256: string }[]) =>
    Promise.all(
      files.map(async (f) => ({
        path: await moveStored(f.path, f.path.replace(`drafts/${body.draftId}/`, `lots/${publicId}/`)),
        sha256: f.sha256,
      })),
    );
  const images = await move(draft.originals);
  const annotated = await move(draft.annotated);
  await fs.rm(storagePath(`drafts/${body.draftId}`), { recursive: true, force: true });

  const lot = await createLotWithAnalysis({
    publicId,
    ownerId: user.id,
    info: {
      product: body.product,
      variety: body.variety,
      harvestDate: body.harvestDate,
      quantityKg: body.quantityKg,
      province: body.province,
      district: body.district,
    },
    moisture: body.moisture,
    analysis: draft.result,
    images,
    annotated,
  });
  kickChainQueue();

  return NextResponse.json({ publicId: lot.publicId, passportUrl: `${baseUrlFrom(req.headers)}/p/${lot.publicId}` });
});
