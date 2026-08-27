# Play Streamers Desktop

## Sürüm 0.14.3

Play Streamers Desktop, Windows 10 ve Windows 11 için tek pencereli yayıncı
çalışma alanıdır. Kullanıcı kararıyla Studio ile yerel kayıt/yayın motoru bu
0.12.0 sürümünden beri rafa kaldırılmıştır.

Dağıtılan uygulama:

- Studio menüsü veya ekranı göstermez,
- FFmpeg ya da sanal kamera bileşeni paketlemez,
- kayıt, yayın ve replay için genel sistem kısayolu kaydetmez,
- içerik, analiz, topluluk, marka, gelir, kasa ve ayar bölümlerindeki 45 aracı
  korur,
- SW Identity oturumunu Windows Credential Manager içinde saklar,
- üretim sürümünde CMD/konsol penceresi açmadan çalışır,
- doğrudan dağıtımda imzalı Tauri güncelleme zincirini kullanır,
- Microsoft Store derlemesinde uygulama içi güncelleyiciyi gizler ve
  güncellemeleri yalnız Store üzerinden alır,
- özellik kartlarını erişilebilir sıvı cam çekmecede açar; Escape ve görünür
  kapatma düğmesiyle ana arayüze döner,
- sekiz dilde metin ve erişilebilirlik etiketlerini önce yerel önbellekten,
  sonra küçük paralel çeviri gruplarından tamamlar.

Eski Studio kaynakları yeniden değerlendirme gerekirse geri alınabilmesi için
depoda pasif tutulabilir; `App.tsx`, Tauri komutları ve paket yapılandırması bu
kaynakları derlenen ürüne bağlamaz.

## Geliştirme

```powershell
pnpm install
pnpm run build
pnpm run desktop
```

Üretim kurucusu updater imza anahtarının bulunduğu yetkili Windows hesabında
`scripts/build-signed-update.ps1` ile oluşturulur. Gizli imza anahtarı ve
parolası depoya eklenmez.

Microsoft Store paketi `scripts/build-store-msix.ps1` ile oluşturulur. Bu yol
`tauri build --no-bundle` kullanarak NSIS/updater imzası istemeden Store'a özel
uygulama ikilisini üretir. Partner Center imzalama ve güncelleme zinciri Store
tarafından tamamlanır.

## Dağıtım sınırı

Masaüstü uygulaması ham medya yakalamaz veya sunucuya göndermez. Canlı kanal
olayları ve yayın geçmişi yalnız SW Identity üzerinden doğrulanan Play
Streamers API yanıtlarından okunur. Bilinmeyen değerler örnek veriyle
doldurulmaz.
