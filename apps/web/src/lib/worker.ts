import { processChainQueue } from "./queue";

const g = globalThis as unknown as { __taneizWorker?: NodeJS.Timeout };

export function startChainWorker(intervalMs = 4000) {
  if (g.__taneizWorker) return;
  console.log("[zincir kuyruğu] işleyici başlatıldı");
  g.__taneizWorker = setInterval(() => {
    processChainQueue().catch((err) => console.error("[zincir kuyruğu]", (err as Error).message));
  }, intervalMs);
}
