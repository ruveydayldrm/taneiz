import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { chainInfo, publicClient, registryAddress } from "@/lib/chain";
import { processChainQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const [db, ai, chain] = await Promise.all([
    prisma.lot.count().then((n) => ({ ok: true, lots: n })).catch((e) => ({ ok: false, error: String(e) })),
    fetch(`${config.aiServiceUrl}/health`, { cache: "no-store", signal: AbortSignal.timeout(3000) })
      .then((r) => r.json())
      .catch(() => ({ status: "unreachable" })),
    (async () => {
      const address = registryAddress();
      if (!address) return { ok: false, error: "kontrat adresi yok" };
      const code = await publicClient.getCode({ address }).catch(() => null);
      return { ok: !!code && code !== "0x", address, ...chainInfo };
    })(),
  ]);
  const queue = await prisma.supplyEvent.count({ where: { chainStatus: { not: "CONFIRMED" } } }).catch(() => -1);
  return NextResponse.json({ db, ai, chain, pendingChainEvents: queue });
}

/** Kuyruğu elle tetikler (kuyruk işleyicisi kapalıysa). */
export async function POST() {
  return NextResponse.json(await processChainQueue());
}
