# Veri setleri

Veri setleri **repoya konmaz**. Aşağıdaki kaynaklardan indirip `ml/data/raw/` (yerel) veya
`MyDrive/taneiz/raw/` (Colab) altına koyun. Her setin lisansını kendi sayfasından doğrulayın ve
sunumda kaynak gösterin; aşağıdaki lisans notları **kontrol edilmesi gereken varsayımlardır**.

## Hedef şema

| Ortak sınıf | Anlamı |
|---|---|
| `SAGLIKLI` | Sağlam, normal tane |
| `KIRIK_CATLAK` | Kırık, çatlak, parçalanmış tane |
| `BOCEK_SUNE_ZARARI` | Böcek veya süne (Eurygaster) zararı |
| `KUFLU` | Küf / fungal bulaşma |
| `LEKELI_RENK_BOZUK` | Kara nokta, lekeli, renk bozukluğu, ısı hasarı |
| `BURUSUK_CILIZ` | Buruşuk, cılız, fusarium'lu ince tane |

Eşleme: [`label_map.yaml`](label_map.yaml). Şemada karşılığı olmayan etiketler (filizlenmiş,
yabancı madde vb.) `null` ile dışarıda bırakılır.

## 1. WheatVision (kullanılıyor)

- Kaynak: Mendeley Data — DOI [10.17632/bx27hg9vwd](https://doi.org/10.17632/bx27hg9vwd), sürüm 1
- Lisans: **CC BY 4.0** (doğrulandı). Kaynak gösterilerek kullanılabilir.
- İndirme (~71 MB): Mendeley sayfasından `train.zip`, `valid.zip`, `test.zip` dosyalarını indirip
  `ml/data/raw/WheatVision_src/` içine açın → `WheatVision_src/<bölme>/images/<etiket>/*.jpg`.
- Biçim: 512×512, her görüntüde tek tane. Roboflow dışa aktarımı; `annotations/` altındaki YOLO
  poligonları kullanılmıyor, klasör adı görüntü etiketidir.

**İnceleme sırasında bulunan ve hattın düzelttiği sorunlar**

| Sorun | Etkisi | Çözüm |
|---|---|---|
| Roboflow her fotoğrafı ~3 kez artırarak çoğaltmış; **1494 farklı tanenin 956'sı** setin kendi train/valid/test bölmelerinin birden fazlasında yer alıyor | Hazır bölmeyle test skoru ezberi ölçer | Hazır bölmeler birleştirilir; `<orijinal>_jpg.rf.<hash>` adından grup çıkarılıp **tane bazında** yeniden bölünür |
| Sağlıklı taneler bej, hasarlı taneler gri/beyaz zeminde ve farklı ölçekte çekilmiş | Model taneye değil zemine/ölçeğe bakabilir | Eğitimde ve çıkarımda tane zeminden ayrılır, zemine göre beyaz dengesi yapılır, nötr zemine konur ve taneden kırpılır (`normalize_grain`, eşitlik testi var) |
| Leke (8), böcek (5), buruşuk (1) sınıflarında çok az farklı tane var; küf yok | Bu sınıflar için test metriği anlamsız olur | `--min-groups 20` altındaki sınıflar dışarıda bırakılır ve model kartında belirtilir |
| `healthy-70-60`, `healthy-50-40` klasörleri kabuklu, farklı görünümlü taneler; anlamları belgelenmemiş | Etiket gürültüsü | Kullanılmaz (`null`) |

Sonuç olarak bu set ile eğitilen model iki sınıf ayırt eder: **Sağlıklı** (951 farklı tane) ve
**Mekanik hasar → Kırık/Çatlak** (443 farklı tane). Diğer kusur sınıfları için ek veri gerekir
(GrainSet, süne seti).

## 2. GrainSet (buğday alt kümesi)

- Kaynak: *GrainSet: A large-scale dataset of grain kernels for visual quality inspection*,
  Scientific Data (2023). Veri bağlantısı makalenin "Data Records" bölümündedir.
- Lisans: makalede belirtilen lisans (CC BY 4.0 bekleniyor) — **doğrulayın**.
- Yerleşim: `raw/GrainSet/wheat/<sınıf_klasörü>/*.png`
- GrainSet sınıfları: NOR (normal), F&S (fusarium & buruşuk), SD (filizlenmiş), MY (küflü),
  AP (zararlı saldırısı), BN (kırık), BP (kara nokta), HD (ısı hasarı), IM (yabancı madde).
- Aynı tanenin iki yüzü ayrı dosyalar olabilir. `group_regex` aynı tanenin görüntülerini aynı
  bölmeye (train/val/test) koyar; dosya adlandırması farklıysa regex'i uyarlayın. Bu, test
  setine sızıntıyı önlemek için önemlidir.
- Set çok büyükse yalnızca buğday kısmını indirin; `train.py --max-per-class` eğitim süresini sınırlar.

## 3. Süne zararlı buğday seti

- Süne (Eurygaster integriceps) zararlı / sağlam buğday tanesi görüntüleri içeren açık bir set
  kullanın (Mendeley Data, Kaggle veya ilgili makalenin ek verisi). Kaynak ve lisansı
  `label_map.yaml` → `sune.source` / `sune.license` alanlarına yazın.
- Yerleşim: `raw/Sune/saglam/*.jpg`, `raw/Sune/suneli/*.jpg`

> **Varsayım:** Bu set için kesin bir DOI verilmediğinden, bulduğunuz kaynağı belgeleyin.
> Set eklenmese de hat çalışır; `BOCEK_SUNE_ZARARI` sınıfı GrainSet AP ve WheatVision ile beslenir.

## Bölme ve kilit

```
python ml/prepare_data.py
```
- SHA-256 ile birebir kopyalar elenir.
- Sınıf bazlı tabakalı, grup farkındalıklı 70/15/15 bölme (seed 42).
- `data/splits/test.lock.json` test.csv'nin hash'ini saklar. Kilit varken bölme yeniden
  üretilmez; `evaluate.py` kilit eşleşmezse çalışmaz. Model kartındaki metrikler yalnızca bu
  kilitli test setinden gelir.
