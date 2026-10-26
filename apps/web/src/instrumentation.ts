export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CHAIN_WORKER !== "off") {
    const { startChainWorker } = await import("./lib/worker");
    startChainWorker();
  }
}
