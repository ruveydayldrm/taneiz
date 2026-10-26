import { decodeEventLog, type Hex } from "viem";
import { EVENT_TYPES, lotIdHash, registryAbi, type EventType } from "@taneiz/shared";
import { prisma } from "./prisma";
import { publicClient, relayer, requireRegistry } from "./chain";

/**
 * DB tabanlı zincir kuyruğu. Tek süreç içinde sırayla çalışır (nonce çakışması olmaz).
 * Her parti önce registerLot ile kaydedilir; olaylar `seq` sırasıyla yazılır, böylece
 * zincirdeki indeks = partideki sıra olur. Başarısızlar üstel bekleme ile yeniden denenir.
 */
const g = globalThis as unknown as { __taneizQueueRunning?: boolean };

function backoff(attempts: number) {
  return new Date(Date.now() + Math.min(5000 * 2 ** attempts, 5 * 60_000));
}

function errMsg(err: unknown) {
  const e = err as { shortMessage?: string; message?: string };
  return (e.shortMessage ?? e.message ?? String(err)).slice(0, 500);
}

export async function processChainQueue(limit = 50) {
  if (g.__taneizQueueRunning) return { skipped: true, processed: 0 };
  g.__taneizQueueRunning = true;
  let processed = 0;
  try {
    const now = new Date();
    const pendingLots = await prisma.lot.findMany({
      where: { chainStatus: { not: "CONFIRMED" }, chainNextAttempt: { lte: now } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    if (pendingLots.length === 0) {
      const anyEvent = await prisma.supplyEvent.count({
        where: { chainStatus: { not: "CONFIRMED" }, nextAttemptAt: { lte: now } },
      });
      if (anyEvent === 0) return { skipped: false, processed: 0 };
    }

    const registry = requireRegistry();
    const wallet = relayer();

    for (const lot of pendingLots) {
      const id = lotIdHash(lot.publicId);
      try {
        // İdempotent: daha önce gönderilmiş ama DB'ye işlenememiş olabilir.
        const already = await publicClient.readContract({ ...registry, functionName: "isRegistered", args: [id] });
        let txHash: Hex | null = null;
        if (!already) {
          txHash = await wallet.writeContract({ ...registry, functionName: "registerLot", args: [id] });
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status !== "success") throw new Error("registerLot işlemi geri alındı");
        }
        await prisma.lot.update({
          where: { id: lot.id },
          data: { chainStatus: "CONFIRMED", chainTxHash: txHash ?? lot.chainTxHash, chainError: null },
        });
        processed++;
      } catch (err) {
        await prisma.lot.update({
          where: { id: lot.id },
          data: {
            chainStatus: "FAILED",
            chainAttempts: { increment: 1 },
            chainError: errMsg(err),
            chainNextAttempt: backoff(lot.chainAttempts + 1),
          },
        });
      }
    }

    const events = await prisma.supplyEvent.findMany({
      where: {
        chainStatus: { not: "CONFIRMED" },
        nextAttemptAt: { lte: new Date() },
        lot: { chainStatus: "CONFIRMED" },
      },
      include: { lot: true },
      orderBy: [{ lotId: "asc" }, { seq: "asc" }],
      take: limit,
    });

    const blocked = new Set<string>();
    for (const ev of events) {
      if (blocked.has(ev.lotId)) continue;
      // Önceki olaylar zincirde değilse sırayı bozmamak için bekle.
      const earlierPending = await prisma.supplyEvent.count({
        where: { lotId: ev.lotId, seq: { lt: ev.seq }, chainStatus: { not: "CONFIRMED" } },
      });
      if (earlierPending > 0) {
        blocked.add(ev.lotId);
        continue;
      }

      const id = lotIdHash(ev.lot.publicId);
      try {
        const confirmedCount = await prisma.supplyEvent.count({
          where: { lotId: ev.lotId, chainStatus: "CONFIRMED" },
        });
        const onChain = await publicClient.readContract({ ...registry, functionName: "getEvents", args: [id] });

        // İdempotent: işlem zincire girmiş ama DB güncellenememişse yeniden yazma.
        if (onChain.length > confirmedCount && onChain[confirmedCount].dataHash === ev.dataHash) {
          await prisma.supplyEvent.update({
            where: { id: ev.id },
            data: { chainStatus: "CONFIRMED", chainIndex: confirmedCount, lastError: null },
          });
          processed++;
          continue;
        }

        const txHash = await wallet.writeContract({
          ...registry,
          functionName: "recordEvent",
          args: [id, EVENT_TYPES[ev.type as EventType], ev.dataHash as Hex],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") throw new Error("recordEvent işlemi geri alındı");

        let index: number | null = null;
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: registryAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "EventRecorded") index = Number(decoded.args.index);
          } catch {
            /* başka bir log */
          }
        }
        if (index === null) throw new Error("EventRecorded logu bulunamadı");

        await prisma.supplyEvent.update({
          where: { id: ev.id },
          data: {
            chainStatus: "CONFIRMED",
            chainIndex: index,
            txHash,
            blockNumber: Number(receipt.blockNumber),
            lastError: null,
          },
        });
        processed++;
      } catch (err) {
        blocked.add(ev.lotId);
        await prisma.supplyEvent.update({
          where: { id: ev.id },
          data: {
            chainStatus: "FAILED",
            attempts: { increment: 1 },
            lastError: errMsg(err),
            nextAttemptAt: backoff(ev.attempts + 1),
          },
        });
      }
    }
    return { skipped: false, processed };
  } finally {
    g.__taneizQueueRunning = false;
  }
}

/** Kuyruğu boşaltana kadar çalıştırır (seed ve testler için). */
export async function drainChainQueue(maxRounds = 20) {
  for (let i = 0; i < maxRounds; i++) {
    await processChainQueue(200);
    const remaining =
      (await prisma.lot.count({ where: { chainStatus: { not: "CONFIRMED" } } })) +
      (await prisma.supplyEvent.count({ where: { chainStatus: { not: "CONFIRMED" } } }));
    if (remaining === 0) return 0;
    // Başarısız olanlar backoff bekliyor; seed'de beklemeden tekrar dene.
    await prisma.lot.updateMany({ where: { chainStatus: "FAILED" }, data: { chainNextAttempt: new Date() } });
    await prisma.supplyEvent.updateMany({ where: { chainStatus: "FAILED" }, data: { nextAttemptAt: new Date() } });
    await new Promise((r) => setTimeout(r, 300));
  }
  return (
    (await prisma.lot.count({ where: { chainStatus: { not: "CONFIRMED" } } })) +
    (await prisma.supplyEvent.count({ where: { chainStatus: { not: "CONFIRMED" } } }))
  );
}

export function kickChainQueue() {
  processChainQueue().catch((err) => console.error("[zincir kuyruğu]", err));
}
