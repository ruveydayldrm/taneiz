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

## 1. WheatVision (öncelikli)

- Kaynak: Mendeley Data — DOI [10.17632/bx27hg9vwd](https://doi.org/10.17632/bx27hg9vwd)
- Lisans: Mendeley sayfasında belirtilen lisans (çoğunlukla CC BY 4.0) — **doğrulayın**.
- Yerleşim: `raw/WheatVision/<etiket_klasörü>/*.jpg`
- İndirdikten sonra klasör adlarını kontrol edin. `label_map.yaml` içindeki `wheatvision.labels`
  anahtarları **tahminidir**; gerçek klasör adlarını buraya ekleyin. `prepare_data.py` eşlenmemiş
  klasörleri listeler.

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
