# TaneİZ — Demo

Buğday için **yapay zekâ ile tane tane kalite analizi** + **blokzincirde mühürlü tedarik kaydı** +
**QR ile açılan, herkesin doğrulayabildiği Ürün Pasaportu**.

```
 Telefon / tarayıcı
        │
 ┌──────▼──────────────────────┐   POST /analyze    ┌───────────────────────────────┐
 │ apps/web  (Next.js 14)      │ ─────────────────▶ │ apps/ai-service (FastAPI)     │
 │  • sayfalar, NextAuth       │                    │  kalite kontrol → OpenCV      │
 │  • Prisma + SQLite          │ ◀───────────────── │  segmentasyon + watershed →   │
 │  • zincir kuyruğu (relayer) │  oranlar + görsel  │  ONNX Runtime sınıflandırma   │
 └──────┬──────────────────────┘                    └──────────────▲────────────────┘
        │ viem: registerLot / recordEvent / verify                 │ ml/artifacts/model.onnx
 ┌──────▼──────────────────────┐                    ┌──────────────┴────────────────┐
 │ contracts/TaneIzRegistry    │                    │ ml/ (PyTorch + timm, Colab)   │
 │  Hardhat (yerel) / Amoy     │                    │  prepare → train → evaluate → │
 └─────────────────────────────┘                    │  export_onnx                  │
                                                    └───────────────────────────────┘
```

**Zincire yalnızca hash yazılır.** Olay verisi → anahtarları sıralı kanonik JSON → `keccak256`
(`packages/shared/src/hash.ts`). Görseller `SHA-256` ile hash'lenip olay verisine eklenir. Kayıt ve
doğrulama aynı fonksiyonu kullanır.

---

## 1. Hızlı başlangıç (Docker)

```bash
cp .env.example .env          # telefonla QR için PUBLIC_BASE_URL=http://<bilgisayar-IP>:3000
docker compose up --build
```

- Web: http://localhost:3000 · AI: http://localhost:8000/health · Zincir RPC: http://localhost:8545
- `ml/artifacts/` içinde eğitilmiş model ve `apps/web/prisma/seed-samples/` içinde numune fotoğrafları
  varsa web konteyneri açılışta **seed** çalıştırır ve tüm sayfalar dolu gelir (bkz. §3).
- Model yoksa: AI servisi açık hata mesajıyla açılır, analiz 503 döner, seed durur ve nasıl
  ilerleyeceğini yazar. Sahte sonuç üretilmez. Kalite analizi olmadan zaman çizelgesi/zincir
  demosu için: `docker compose exec web npm run seed -- --no-ai` (Docker'sız: `npm run seed:no-ai`)
- Yerel Hardhat zinciri her `up`'ta sıfırlanır; bu yüzden web veritabanı da her açılışta sıfırlanıp
  yeniden seed edilir.

## 2. Docker'sız çalıştırma

Gereken: Node 20+ (22 ile test edildi), Python 3.11.

```bash
npm install
pip install -r apps/ai-service/requirements.txt
cp apps/web/.env.example apps/web/.env
npm run db:push
```

Dört terminal:

| # | Komut | Ne yapar |
|---|---|---|
| 1 | `npm run chain` | Yerel Hardhat node (8545) |
| 2 | `npm run deploy:local` | Kontratı deploy eder, relayer'a `RECORDER_ROLE` verir, `contracts/deployments/localhost.json` yazar |
| 2 | `npm run ai` | AI servisi (8000), modeli `ml/artifacts/`'tan yükler |
| 3 | `npm run seed` | Demo kullanıcıları + 6 parti (gerçek analiz, zincire yazılmış) |
| 4 | `npm run dev` | Web (3000) — zincir kuyruğu işleyicisi sunucu içinde çalışır |

> Hardhat node'u yeniden başlatırsanız zincir boşalır: `npm run deploy:local` ve `npm run seed`
> komutlarını tekrar çalıştırın.

## 3. Modeli eğitmek (bir kez)

1. Veri setlerini indirin ve yerleştirin → [`ml/DATASETS.md`](ml/DATASETS.md)
   (WheatVision DOI 10.17632/bx27hg9vwd, GrainSet, süne seti; repoya konmaz).
2. **Colab (önerilen, ücretsiz T4, < 1 saat):** [`ml/train_colab.ipynb`](ml/train_colab.ipynb)'i açıp
   hücreleri sırayla çalıştırın. Sonda inen zip'i açın:
   `artifacts/*` → `ml/artifacts/`, `seed-samples/*` → `apps/web/prisma/seed-samples/`.
3. Yerel (GPU varsa):
   ```bash
   pip install -r ml/requirements.txt
   cd ml
   python prepare_data.py       # birleştir, dengesizliği raporla, 70/15/15, test setini KİLİTLE
   python train.py              # EfficientNet-B0, augmentation, sınıf ağırlıklı kayıp
   python evaluate.py           # kilitli test seti → model_card.json + confusion_matrix.png
   python export_onnx.py        # ONNX + PyTorch çıktılarıyla eşitlik doğrulaması
   python make_demo_samples.py  # seed için test setinden numune fotoğrafları
   ```
4. AI servisini yeniden başlatın, `npm run seed` çalıştırın.

Model Kartı (`/model`) yalnızca `model_card.json`'daki gerçek test metriklerini gösterir; kart yoksa
"henüz metrik yok" der.

## 4. Demo hesapları

Hepsinin şifresi **`taneiz123`** (giriş sayfasında tek tıkla da girilebilir).

| Rol | E-posta | Sayfa |
|---|---|---|
| Üretici | uretici@taneiz.demo | `/panel`, `/panel/yeni` |
| Depo | depo@taneiz.demo | `/depo` |
| Alıcı | alici@taneiz.demo | `/alici` |
| Yönetici | admin@taneiz.demo | hepsi + `/demo/kurcala` |

## 5. Sayfalar

| Yol | Açıklama |
|---|---|
| `/` | Tanıtım: sorun → çözüm → 3 adım → örnek pasaport (gerçek veriden) |
| `/p/[publicId]` | Ürün Pasaportu (girişsiz): mühür, nem, menşei, orijinal ↔ açıklamalı görüntü sürgüsü, kusur oranları, zaman çizelgesi, **"Bu kaydı şimdi doğrula"** |
| `/panel`, `/panel/yeni` | Üretici: parti listesi, 5 adımlı sihirbaz, QR etiket PDF'i (`/api/lots/[id]/label`) |
| `/depo`, `/alici` | QR okut (kamera / fotoğraftan / elle) → teslim al / satın al |
| `/model` | Model Kartı: test metrikleri, confusion matrix, sınıf örnekleri, veri setleri, sınırlamalar |
| `/demo/kurcala` | ADMIN + `DEMO_MODE=true`: olay verisini DB'de değiştir / geri al |
| `/api/health` | DB, AI, zincir ve kuyruk durumu |

## 6. Telefonla QR

- `PUBLIC_BASE_URL`'i bilgisayarın yerel ağ IP'sine ayarlayın (ör. `http://192.168.1.20:3000`),
  telefon ile bilgisayar aynı Wi-Fi'de olsun. Windows güvenlik duvarı 3000 portuna izin vermeli.
  QR kodları bu adresle üretilir; telefonun kendi kamerasıyla okutunca pasaport açılır.
- **Uygulama içi kamera ile tarama** (`/depo`, `/alici`) tarayıcı gereği HTTPS ister (localhost hariç).
  Demoda tarama bilgisayarda yapılabilir, "Fotoğraftan oku" veya elle kod girişi kullanılabilir. Telefonda
  kamera taraması gerekiyorsa `npx localtunnel --port 3000` / ngrok gibi bir HTTPS tüneli kullanın ve
  `PUBLIC_BASE_URL`'i o adrese ayarlayın.

## 7. Polygon Amoy'a geçiş

```bash
# contracts/.env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=0x...        # test MATIC/POL'lü hesap
RELAYER_ADDRESS=0x...             # web sunucusunun yazacağı adres (boşsa deployer)
npm run deploy:amoy

# apps/web/.env
CHAIN_NETWORK=amoy
RPC_URL=https://rpc-amoy.polygon.technology
RELAYER_PRIVATE_KEY=0x...         # RELAYER_ADDRESS'in anahtarı
```
Pasaportta işlem bağlantıları Polygonscan'e gider. Docker'da `RESET_DB_ON_START=false` yapın.

## 8. Postgres'e geçiş

`apps/web/prisma/schema.prisma` → `provider = "postgresql"` ve `DATABASE_URL=postgresql://...`.
JSON alanları metin olarak tutulduğundan başka değişiklik gerekmez.

## 9. Testler

```bash
npm run test:contracts                         # 10 Hardhat testi: yetkisiz yazma, doğru/yanlış hash, ...
npm run test:shared                            # kanonik JSON + hash
cd apps/ai-service && python -m pytest -q      # segmentasyon, watershed, kalite kontrol, kurallar, modelsiz 503
```

## 10. Varsayımlar ve kararlar

- **Kalite sınıfı eşikleri** `apps/ai-service/grading_rules.yaml`'dadır (sağlıklı ≥ %95 → 1. Sınıf,
  ≥ %88 → 2. Sınıf, aksi 3. Sınıf; ek olarak küf/böcek üst sınırları). Demo amaçlıdır,
  **resmi standart değildir** ve arayüzde böyle belirtilir.
- **Nem** fotoğraftan tahmin edilmez; nem ölçerden elle girilir ve veride `moistureSource:
  "cihaz-elle-giris"` olarak işaretlenir.
- `label_map.yaml`'daki **WheatVision klasör adları tahminidir**; indirilen sürüme göre düzeltilmelidir
  (`prepare_data.py` eşlenmemiş klasörleri listeler). Süne seti için kesin bir DOI verilmediğinden
  kaynak kullanıcı tarafından belgelenir.
- Sınıflandırıcı tek tane görüntüleriyle eğitilir; eğitimde %50 olasılıkla **zemin değiştirme**
  augmentasyonu uygulanır ki sahadaki açık zemin fotoğraflarına genellesin.
- Seed numuneleri, **kilitli test setindeki gerçek tane görüntülerinin** açık zemine dağıtılmasıyla
  üretilen kompozitlerdir (gerçek dağılım `manifest.json`'da). Analiz yine AI servisinden gelir.
- Pasaport, kalite/miktar bilgisini **hash'i zincire yazılan olay verisinden** okur. Böylece
  veritabanında yapılan bir kurcalama hem ekranda görünür hem de doğrulamada yakalanır.
- Zincire yazma DB tabanlı bir kuyrukla, olay sırası korunarak yapılır (zincirdeki indeks = partideki
  sıra). Başarısız yazımlar üstel beklemeyle yeniden denenir; işlem zincire girmiş ama DB
  güncellenememişse tekrar yazılmaz (idempotent).
- Olay verisinde kişi adı tutulmaz, yalnızca rol (ve firma/depo adı) bulunur; zincire yalnızca hash gider.
- QR etiket PDF'inde standart PDF fontları Türkçe karakter içermediği için metin ASCII'ye sadeleştirilir.
- Hardhat #0 hesabının anahtarı yalnızca yerel ağ için `.env.example`'da yer alır.

## 11. Klasörler

```
apps/web           Next.js 14 (App Router), Tailwind, shadcn tarzı bileşenler, Prisma, NextAuth
apps/ai-service    FastAPI + OpenCV + ONNX Runtime
contracts          TaneIzRegistry.sol, Hardhat testleri, deploy betiği
packages/shared    kanonik JSON + hash fonksiyonları, ABI, ortak tipler
ml                 prepare_data, train, evaluate, export_onnx, make_demo_samples, Colab notebook
docs               demo-senaryosu.md
docker             ortak Node imajı ve giriş betikleri
```
