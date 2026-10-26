// Web sunucusundan bağımsız kuyruk işleyicisi (CHAIN_WORKER=off ile birlikte kullanın).
import { processChainQueue } from "../src/lib/queue";

async function loop() {
  for (;;) {
    try {
      const r = await processChainQueue();
      if (r.processed) console.log(`[zincir kuyruğu] ${r.processed} kayıt işlendi`);
    } catch (err) {
      console.error("[zincir kuyruğu]", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

loop();
