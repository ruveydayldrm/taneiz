import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { getAddress } from "viem";

async function main() {
  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const relayer = getAddress(process.env.RELAYER_ADDRESS || deployer.account.address);

  console.log(`Ağ: ${hre.network.name} · deploy eden: ${deployer.account.address}`);
  const registry = await hre.viem.deployContract("TaneIzRegistry", [deployer.account.address]);
  console.log(`TaneIzRegistry: ${registry.address}`);

  const role = await registry.read.RECORDER_ROLE();
  const hash = await registry.write.grantRole([role, relayer]);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`RECORDER_ROLE verildi → ${relayer}`);

  const out = {
    network: hre.network.name,
    chainId: await publicClient.getChainId(),
    address: registry.address,
    deployer: deployer.account.address,
    relayer,
    deployedAt: new Date().toISOString(),
  };
  const dir = process.env.DEPLOYMENTS_DIR || path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${hre.network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Deploy bilgisi yazıldı: ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
