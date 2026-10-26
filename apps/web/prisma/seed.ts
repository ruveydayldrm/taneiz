/**
 * Demo verisi: kullanıcılar + 6 parti (gerçek AI analizi, tam zaman çizelgesi, zincire yazılmış).
 *
 *   npm run seed            → AI servisi + model + seed-samples gerekli
 *   npm run seed:no-ai      → kalite analizi olmadan (yalnızca zaman çizelgesi)
 *
 * Numune fotoğrafları ml/make_demo_samples.py ile KİLİTLİ TEST SETİNDEN üretilir
 * (prisma/seed-samples/manifest.json). Analiz sonuçları her zaman AI servisinden gelir.
 */
import fs from "node:fs";
import fs2 from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { analyzeWithAi } from "../src/lib/ai";
import { config } from "../src/lib/config";
import { appendEvent, createLotWithAnalysis, newPublicId } from "../src/lib/lots";
import { drainChainQueue } from "../src/lib/queue";
import { publicClient, registryAddress, chainInfo } from "../src/lib/chain";
import { storagePath, writeStored } from "../src/lib/storage";

const NO_AI = process.argv.includes("--no-ai");
const SAMPLES_DIR = process.env.SEED_SAMPLES_DIR ?? path.join(__dirname, "seed-samples");
const PASSWORD = "taneiz123";

const day = 86_400_000;
const LOTS = [
  { variety: "Bezostaja-1", province: "Konya", district: "Cihanbeyli", harvest: "2026-07-08", kg: 24000, moisture: 11.2, depo: true, alici: true },
  { variety: "Kızıltan-91", province: "Eskişehir", district: "Sivrihisar", harvest: "2026-07-15", kg: 18500, moisture: 11.8, depo: true, alici: true },
  { variety: "Gerek-79", province: "Ankara", district: "Polatlı", harvest: "2026-07-12", kg: 30000, moisture: 12.1, depo: true, alici: true },
  { variety: "Tosunbey", province: "Tekirdağ", district: "Hayrabolu", harvest: "2026-06-28", kg: 21000, moisture: 12.6, depo: true, alici: false },
  { variety: "Esperia", province: "Şanlıurfa", district: "Harran", harvest: "2026-06-02", kg: 16000, moisture: 13.2, depo: true, alici: false },
  { variety: "Konya-2002", province: "Yozgat", district: "Sorgun", harvest: "2026-07-20", kg: 12000, moisture: 13.8, depo: false, alici: false },
];
const DEPOLAR = [
  { warehouseName: "Ova Lisanslı Depo A.Ş.", province: "Konya", district: "Selçuklu" },
  { warehouseName: "Orta Anadolu Hububat Deposu", province: "Ankara", district: "Polatlı" },
  { warehouseName: "Trakya Lisanslı Depo", province: "Tekirdağ", district: "Süleymanpaşa" },
];
const ALICILAR = [
  { buyerName: "Anadolu Un Sanayi", destination: "Ankara / Sincan" },
  { buyerName: "Ege Makarna Fabrikası", destination: "İzmir / Torbalı" },
  { buyerName: "Marmara Gıda", destination: "İstanbul / Tuzla" },
];

function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function preflight() {
  const address = registryAddress();
  if (!address) fail("Kontrat adresi bulunamadı. Önce: npm run chain  (ayrı terminal)  ve  npm run deploy:local");
  const code = await publicClient.getCode({ address }).catch(() => null);
  if (!code || code === "0x")
    fail(`${chainInfo.label} üzerinde ${address} adresinde kontrat yok. Hardhat node yeniden başladıysa tekrar deploy edin: npm run deploy:local`);
  console.log(`✓ Zincir: ${chainInfo.label} · kontrat ${address}`);

  if (NO_AI) return [];
  const manifestPath = path.join(SAMPLES_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath))
    fail(
      `Numune fotoğrafları yok (${manifestPath}). Model eğitildikten sonra: python ml/make_demo_samples.py\n  ` +
        `Kalite analizi olmadan doldurmak için: npm run seed:no-ai`,
    );
  const health = await fetch(`${config.aiServiceUrl}/health`).then((r) => r.json()).catch(() => null);
  if (!health) fail(`AI servisine ulaşılamadı (${config.aiServiceUrl}). Başlatın: npm run ai`);
  if (health.status !== "ok") fail(`AI servisi modelsiz çalışıyor: ${health.error}`);
  console.log(`✓ AI servisi: model ${health.model_version}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { samples: { file: string }[] };
  if (!manifest.samples.length) fail("manifest.json boş.");
  return manifest.samples.map((s) => path.join(SAMPLES_DIR, s.file));
}

async function main() {
  const samples = await preflight();

  console.log("… veritabanı temizleniyor");
  await prisma.tamperLog.deleteMany();
  await prisma.supplyEvent.deleteMany();
  await prisma.qualityReport.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.user.deleteMany();
  await fs2.rm(storagePath("lots"), { recursive: true, force: true });
  await fs2.rm(storagePath("drafts"), { recursive: true, force: true });

  const hash = await bcrypt.hash(PASSWORD, 10);
  const users = {
    uretici: await prisma.user.create({ data: { email: "uretici@taneiz.demo", name: "Cihanbeyli Üretici Kooperatifi", organization: "Kooperatif", role: "URETICI", passwordHash: hash } }),
    depo: await prisma.user.create({ data: { email: "depo@taneiz.demo", name: "Ova Lisanslı Depo", organization: "Depo", role: "DEPO", passwordHash: hash } }),
    alici: await prisma.user.create({ data: { email: "alici@taneiz.demo", name: "Anadolu Un Sanayi", organization: "Alıcı", role: "ALICI", passwordHash: hash } }),
    admin: await prisma.user.create({ data: { email: "admin@taneiz.demo", name: "TaneİZ Yönetici", role: "ADMIN", passwordHash: hash } }),
  };
  console.log("✓ 4 demo kullanıcısı (şifre: taneiz123)");

  for (const [i, spec] of LOTS.entries()) {
    const harvest = new Date(`${spec.harvest}T07:00:00.000Z`);
    const created = new Date(harvest.getTime() + 2 * day);
    const info = {
      product: "Buğday",
      variety: spec.variety,
      harvestDate: harvest,
      quantityKg: spec.kg,
      province: spec.province,
      district: spec.district,
    };
    const publicId = newPublicId();
    let lotId: string;

    if (!NO_AI) {
      const file = samples[i % samples.length];
      const data = new Uint8Array(fs.readFileSync(file));
      const t0 = Date.now();
      const ai = await analyzeWithAi([{ data, name: path.basename(file), type: "image/jpeg" }]);
      const orig = await writeStored(`lots/${publicId}/orig-0.jpg`, data);
      const ann = await writeStored(
        `lots/${publicId}/annotated-0.jpg`,
        new Uint8Array(Buffer.from(ai.images[0].annotated_jpeg_base64, "base64")),
      );
      const { images, ...rest } = ai;
      const lot = await createLotWithAnalysis({
        publicId,
        ownerId: users.uretici.id,
        info,
        moisture: spec.moisture,
        analysis: { ...rest, images: images.map(({ annotated_jpeg_base64: _, ...m }) => m) },
        images: [orig],
        annotated: [ann],
        createdAt: created,
        analyzedAt: new Date(created.getTime() + 3600_000),
      });
      lotId = lot.id;
      console.log(
        `✓ ${publicId} ${spec.variety.padEnd(12)} ${ai.grade.label} · ${ai.grain_count} tane · sağlıklı %${(ai.ratios.SAGLIKLI * 100).toFixed(1)} · ${Date.now() - t0} ms`,
      );
    } else {
      const lot = await prisma.$transaction(async (tx) => {
        const l = await tx.lot.create({ data: { publicId, ownerId: users.uretici.id, ...info, createdAt: created } });
        await appendEvent(tx, {
          lotId: l.id,
          publicId,
          type: "PARTI_OLUSTURULDU",
          actorId: users.uretici.id,
          at: created,
          payload: { role: "URETICI", ...info, harvestDate: spec.harvest },
        });
        return l;
      });
      lotId = lot.id;
      console.log(`✓ ${publicId} ${spec.variety} (kalite analizi yok)`);
    }

    if (spec.depo) {
      const d = DEPOLAR[i % DEPOLAR.length];
      await prisma.$transaction(async (tx) => {
        await appendEvent(tx, {
          lotId,
          publicId,
          type: "DEPO_TESLIM",
          actorId: users.depo.id,
          at: new Date(created.getTime() + 5 * day),
          payload: { role: "DEPO", ...d, receivedKg: spec.kg - 120 * (i + 1) },
        });
        await tx.lot.update({ where: { id: lotId }, data: { status: "DEPODA" } });
      });
    }
    if (spec.alici) {
      const a = ALICILAR[i % ALICILAR.length];
      await prisma.$transaction(async (tx) => {
        await appendEvent(tx, {
          lotId,
          publicId,
          type: "ALICI_TESLIM",
          actorId: users.alici.id,
          at: new Date(created.getTime() + 21 * day),
          payload: { role: "ALICI", ...a, purchasedKg: spec.kg - 120 * (i + 1) },
        });
        await tx.lot.update({ where: { id: lotId }, data: { status: "SATILDI" } });
      });
    }
  }

  console.log("… kayıtlar zincire yazılıyor");
  const remaining = await drainChainQueue();
  if (remaining > 0) fail(`${remaining} kayıt zincire yazılamadı. Hardhat node çalışıyor mu?`);
  const n = await prisma.supplyEvent.count();
  console.log(`✓ ${LOTS.length} parti, ${n} olay zincirde mühürlü.\n`);
  const first = await prisma.lot.findFirst({ orderBy: { createdAt: "asc" } });
  console.log(`Örnek pasaport: ${config.publicBaseUrl ?? "http://localhost:3000"}/p/${first?.publicId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
