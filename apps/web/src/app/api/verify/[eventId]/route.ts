import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { verifyEvent } from "@/lib/verify";
import { HttpError } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Herkese açık: hash'i güncel veriden yeniden hesaplayıp zincirle karşılaştırır. */
export const POST = handle(async (_req: Request, { params }: { params: { eventId: string } }) => {
  try {
    return NextResponse.json(await verifyEvent(params.eventId));
  } catch (err) {
    if ((err as Error).message === "Olay bulunamadı") throw new HttpError(404, "Olay bulunamadı.");
    throw err;
  }
});
