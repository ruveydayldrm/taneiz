Eğitim çıktıları buraya gelir (Colab zip'inden veya yerel eğitimden):

- `model.onnx` — AI servisinin yüklediği model (export_onnx.py)
- `model_card.json` — kilitli test seti metrikleri (evaluate.py + export_onnx.py)
- `confusion_matrix.png`, `samples/` — Model Kartı sayfasındaki görseller
- `model.pt` — PyTorch ağırlıkları (repoya girmez)

Bu klasörde model yokken AI servisi açık bir hata mesajıyla açılır ve analiz isteklerine 503 döner.
