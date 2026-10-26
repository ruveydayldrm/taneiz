# TaneİZ — 3 dakikalık jüri akışı

**Hazırlık (sunumdan önce)**
- `docker compose up` (veya README §2'deki dört terminal) çalışıyor, seed tamamlandı.
- `PUBLIC_BASE_URL` bilgisayarın Wi-Fi IP'si; bir partinin QR etiketi (PDF) basılı veya ikinci ekranda.
- Tarayıcı sekmeleri: `/` · `/giris` · `/model` · `/demo/kurcala` (admin oturumu ayrı pencerede).
- Kilitli test setinden bir numune fotoğrafı masaüstünde (ör. `apps/web/prisma/seed-samples/ornek-3.jpg`).

---

### 0:00 – 0:20 · Sorun (`/`)
> "Buğdayın kalitesi göz kararı tartışılıyor, kayıtları ise sessizce değişebiliyor. Son alıcı
> partinin geçmişini kendi başına doğrulayamıyor."

Ana sayfada uçuşan taneleri ve hash şeridini gösterin: "Bu şeritteki her satır, zincire yazılmış gerçek bir kayıt."

### 0:20 – 1:10 · Yapay zekâ (`/panel/yeni`, üretici)
1. "Üretici" demo hesabıyla tek tıkla girin → **Yeni parti**.
2. Çeşit/il/ilçe/miktar → **Devam**.
3. Masaüstündeki numune fotoğrafını sürükleyin → nem **%11,8** → **Analiz et**.
4. Tarama animasyonu → 10 saniye içinde sonuç: tane sayısı, kusur oranları, mühür.
   **Sürgüyü kaydırın**: "Her tane bulundu, ayrıldı ve tek tek sınıflandırıldı."
5. "Nemi fotoğraftan tahmin etmiyoruz; cihazdan giriliyor. Eşikler yapılandırılabilir, resmi standart değil."
6. Onay → **Kaydet ve zincire mühürle** → QR ekranı.

### 1:10 – 1:40 · Model gerçekten çalışıyor mu? (`/model`)
> "Bu sayılar eğitimde hiç görülmeyen, hash'i kilitlenmiş test setinden."

Doğruluk / macro-F1, confusion matrix, yanlış tahminlerin de gizlenmediği örnekler, sınırlamalar.

### 1:40 – 2:10 · QR ve pasaport (telefon)
1. Jüriden birine basılı QR'ı **kendi telefonuyla** okutturun → pasaport açılır (giriş gerekmez).
2. Zaman çizelgesindeki **"Zincirde doğrulandı"** rozetleri; **"Bu kaydı şimdi doğrula"** → yeşil **EŞLEŞTİ**.
3. "Zincir ayrıntıları"nı açın: kayıtlı hash, yeniden hesaplanan hash, blok numarası, görsel SHA-256 kontrolleri.

### 2:10 – 2:50 · Kurcalama (`/demo/kurcala`, admin)
1. 3. sınıf bir partinin **Kalite analizi** olayında **Kurcala** → "Kalite 3. Sınıf → 1. Sınıf".
   > "Kötü niyetli bir veritabanı yöneticisi tam olarak bunu yapabilir."
2. **Pasaportta doğrula** → mühür artık 1. Sınıf gösteriyor ama doğrulama kırmızı **EŞLEŞMEDİ**;
   zincirdeki mühür ile şimdiki verinin hash'i yan yana.
3. **Geri al** → pasaportu yenile → **EŞLEŞTİ**.

### 2:50 – 3:00 · Kapanış
> "Kalite tartışması yerine tane tane kanıt; değiştirilebilir kayıt yerine herkesin doğrulayabildiği mühür.
> Zincirde kişisel veri yok, yalnızca 32 baytlık özetler."

---

**Yedek planlar**
- Wi-Fi yoksa: pasaportu bilgisayarda açın; QR'ı `/api/lots/<id>/label` PDF'inden gösterin.
- AI servisi yavaşsa: seed edilmiş partilerin pasaportlarındaki açıklamalı görüntüyle devam edin.
- Kamera izni sorunu (`/depo`): "Fotoğraftan oku" ya da "İşlem bekleyen partiler" listesinden seçin.
