#!/bin/sh
set -e
cd /repo/apps/web
mkdir -p /data

# Yerel zincir her başlatmada sıfırlandığından veritabanı da sıfırlanır (aksi halde DB'deki
# kayıtların zincirde karşılığı olmaz). Amoy gibi kalıcı bir ağda RESET_DB_ON_START=false yapın.
if [ "${RESET_DB_ON_START:-true}" = "true" ]; then
  npx prisma db push --force-reset --skip-generate
else
  npx prisma db push --skip-generate
fi

if [ "${SEED_ON_START:-true}" = "true" ]; then
  # AI servisi modeli yüklesin diye kısa bekleme
  for i in $(seq 1 30); do
    node -e "fetch(process.env.AI_SERVICE_URL+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" && break
    sleep 2
  done
  npm run seed || {
    echo "UYARI: seed tamamlanamadı (model veya numune fotoğrafları eksik olabilir)."
    echo "Kalite analizi olmadan doldurmak için: docker compose exec web npm run seed -- --no-ai"
  }
fi

exec npx next start -H 0.0.0.0 -p 3000
