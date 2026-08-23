# Play Streamers Desktop

## Sürüm 0.12.0

Play Streamers Desktop, Windows 10 ve Windows 11 için tek pencereli yayıncı
çalışma alanıdır. Kullanıcı kararıyla Studio ile yerel kayıt/yayın motoru bu
sürümde rafa kaldırılmıştır.

Dağıtılan uygulama:

- Studio menüsü veya ekranı göstermez,
- FFmpeg ya da sanal kamera bileşeni paketlemez,
- kayıt, yayın ve replay için genel sistem kısayolu kaydetmez,
- içerik, analiz, topluluk, marka, gelir, kasa ve ayar bölümlerindeki 45 aracı
  korur,
- SW Identity oturumunu Windows Credential Manager içinde saklar,
- üretim sürümünde CMD/konsol penceresi açmadan çalışır,
- imzalı Tauri güncelleme zincirini kullanır.

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

## Dağıtım sınırı

Masaüstü uygulaması ham medya yakalamaz veya sunucuya göndermez. Canlı kanal
olayları ve yayın geçmişi yalnız SW Identity üzerinden doğrulanan Play
Streamers API yanıtlarından okunur. Bilinmeyen değerler örnek veriyle
doldurulmaz.
