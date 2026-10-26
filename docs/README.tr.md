# TaneİZ — Türkçe kurulum ve kullanım rehberi

Buğday için **yapay zekâ ile tane tane kalite analizi**, **blokzincirde mühürlü tedarik kaydı** ve
**QR ile açılan, herkesin doğrulayabildiği Ürün Pasaportu**. Genel bakış ve mimari için
[ana README](../README.md).

**Zincire yalnızca hash yazılır.** Olay verisi → anahtarları sıralı kanonik JSON → `keccak256`
(`packages/shared/src/hash.ts`). Görseller `SHA-256` ile hash'lenip olay verisine eklenir. Kayıt ve
doğrulama aynı fonksiyonu kullanır.

## 1. Docker ile

```bash
cp .env.example .env          # telefonla QR için PUBLIC_BASE_URL=http://<bilgisayar-IP>:3000
docker compose up --build
```

- Web: http://localhost:3000 · AI: http://localhost:8000/health · Zincir RPC: http://localhost:8545
- `ml/artifacts/` içinde eğitilmiş model ve `apps/web/prisma/seed-samples/` içinde numune fotoğrafları
  varsa web konteyneri açılışta seed çalıştırır.
- Model yoksa AI servisi açık bir hata mesajıyla açılır, analiz 503 döner ve sahte sonuç üretilmez.
  Kalite analizi olmadan doldurmak için: `docker compose exec web npm run seed -- --no-ai`
- Yerel Hardhat zinciri her `up`'ta sıfırlanır; web veritabanı da her açılışta sıfırlanıp yeniden seed
  edilir.

## 2. Docker'sız

Gerekenler: Node 20+ (22 ile test edildi) ve Python 3.11.

```bash
npm install
pip install -r apps/ai-service/requirements.txt
cp apps/web/.env.example apps/web/.env
npm run db:push
```

| # | Komut | Ne yapar |
|---|---|---|
| 1 | `npm run chain` | Yerel Hardhat node (8545) |
| 2 | `npm run deploy:local` | Kontratı deploy eder, relayer'a `RECORDER_ROLE` verir |
| 2 | `npm run ai` | AI servisi (8000), modeli `ml/artifacts/`'tan yükler |
| 3 | `npm run seed` / `npm run seed:no-ai` | Demo kullanıcıları + 6 parti |
| 4 | `npm run dev` | Web (3000), zincir kuyruğu işleyicisi sunucu içinde |

> Hardhat node yeniden başlarsa zincir boşalır: `npm run deploy:local` ve `npm run seed`'i tekrar çalıştırın.

## 3. Model eğitimi

1. Veri setlerini indirip yerleştirin: [ml/DATASETS.md](../ml/DATASETS.md). Veri setleri repoya konmaz.
2. Colab (ücretsiz T4, 1 saatin altında): [ml/train_colab.ipynb](../ml/train_colab.ipynb). İnen zip'teki
   `artifacts/*` dosyalarını `ml/artifacts/`'a, `seed-samples/*` dosyalarını `apps/web/prisma/seed-samples/`'a açın.
3. Yerel (GPU varsa):
   ```bash
   pip install -r ml/requirements.txt
   cd ml
   python prepare_data.py && python train.py && python evaluate.py && python export_onnx.py && python make_demo_samples.py
   ```
4. AI servisini yeniden başlatıp `npm run seed` çalıştırın.

## 4. Demo hesapları

Şifre: **`taneiz123`**

| Rol | E-posta | Sayfa |
|---|---|---|
| Üretici | uretici@taneiz.demo | `/panel`, `/panel/yeni` |
| Depo | depo@taneiz.demo | `/depo` |
| Alıcı | alici@taneiz.demo | `/alici` |
| Yönetici | admin@taneiz.demo | hepsi + `/demo/kurcala` |

## 5. Telefonla QR

- `PUBLIC_BASE_URL`'i bilgisayarın yerel ağ IP'sine ayarlayın (ör. `http://192.168.1.20:3000`). Telefon
  aynı Wi-Fi ağında olmalı ve güvenlik duvarı 3000 portuna izin vermeli.
- Uygulama içi kamera taraması (`/depo`, `/alici`) tarayıcı gereği HTTPS ister (localhost hariç).
  Bunun yerine "Fotoğraftan oku" seçeneğini, elle kod girişini ya da bir HTTPS tünelini (ngrok,
  localtunnel) kullanabilirsiniz.

## 6. Polygon Amoy'a geçiş

```bash
# contracts/.env
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_ADDRESS=0x...
npm run deploy:amoy

# apps/web/.env
CHAIN_NETWORK=amoy
RPC_URL=https://rpc-amoy.polygon.technology
RELAYER_PRIVATE_KEY=0x...
```
Docker'da `RESET_DB_ON_START=false` yapın.

## 7. Postgres'e geçiş

`apps/web/prisma/schema.prisma` dosyasında `provider = "postgresql"` yapıp `DATABASE_URL=postgresql://...`
tanımlamak yeterli.

## 8. Varsayımlar

- Kalite sınıfı eşikleri `apps/ai-service/grading_rules.yaml` dosyasındadır. Demo amaçlıdır ve resmi standart değildir.
- Nem fotoğraftan tahmin edilmez; cihazdan elle girilir (`moistureSource: "cihaz-elle-giris"`).
- `label_map.yaml` dosyasındaki WheatVision klasör adları tahmindir; indirilen sürüme göre düzeltilmelidir.
- Seed numuneleri, kilitli test setindeki gerçek tane görüntülerinden üretilen kompozitlerdir.
- Olay verisinde kişi adı tutulmaz; zincire yalnızca hash gider.
- QR etiket PDF'inde, standart fontlar Türkçe karakter içermediği için metin ASCII'ye sadeleştirilir.
