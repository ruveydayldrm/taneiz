import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, getAddress, http, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, polygonAmoy } from "viem/chains";
import { registryAbi } from "@taneiz/shared";

const network = process.env.CHAIN_NETWORK ?? "localhost";
const chain: Chain = network === "amoy" ? polygonAmoy : hardhat;
const rpcUrl = process.env.RPC_URL ?? (network === "amoy" ? "https://rpc-amoy.polygon.technology" : "http://127.0.0.1:8545");

/** REGISTRY_ADDRESS, yoksa contracts/deployments/<ağ>.json. Deploy sonrası yeniden okunabilsin diye önbelleksiz. */
export function registryAddress(): Address | null {
  if (process.env.REGISTRY_ADDRESS) return getAddress(process.env.REGISTRY_ADDRESS);
  const file =
    process.env.DEPLOYMENT_FILE ?? path.resolve(process.cwd(), "..", "..", "contracts", "deployments", `${network}.json`);
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    return json.address ? getAddress(json.address) : null;
  } catch {
    return null;
  }
}

export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

let wallet: ReturnType<typeof makeWallet> | null = null;
function makeWallet() {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY tanımlı değil; zincire yazılamaz.");
  return createWalletClient({ chain, transport: http(rpcUrl), account: privateKeyToAccount(key as `0x${string}`) });
}
export function relayer() {
  wallet ??= makeWallet();
  return wallet;
}

export function requireRegistry() {
  const address = registryAddress();
  if (!address) throw new Error("Kontrat adresi bulunamadı. Önce `npm run deploy:local` çalıştırın.");
  return { address, abi: registryAbi } as const;
}

export function explorerTxUrl(txHash?: string | null) {
  if (!txHash) return null;
  return network === "amoy" ? `https://amoy.polygonscan.com/tx/${txHash}` : null;
}

export const chainInfo = {
  network,
  chainId: chain.id,
  label: network === "amoy" ? "Polygon Amoy testnet" : "Yerel Hardhat ağı",
};
