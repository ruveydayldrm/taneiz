# Web uygulaması ve Hardhat için ortak Node imajı (monorepo kökünden derlenir).
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY contracts/package.json contracts/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

COPY . .

# Solidity derleyicisini imaj oluşturulurken indir, kontratı derle
RUN cd contracts && npx hardhat compile
# Next.js production build
RUN cd apps/web && npx prisma generate && CHAIN_WORKER=off npx next build

RUN chmod +x docker/*.sh
