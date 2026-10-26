#!/bin/sh
# Yerel Hardhat ağı + kontrat deploy. Hardhat node durumu geçicidir: her başlatmada yeni zincir.
set -e
rm -f /deployments/localhost.json
cd /repo/contracts

npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

until node -e "fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId'})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  sleep 1
done

DEPLOYMENTS_DIR=/deployments npx hardhat run scripts/deploy.ts --network localhost
echo "Zincir hazır."
wait $NODE_PID
