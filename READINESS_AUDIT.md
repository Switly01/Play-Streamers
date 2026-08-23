# Play Streamers 0.12.0 Hazır Olma Denetimi

Tarih: 23 Ağustos 2026

## Sonuç

Play Streamers Desktop 0.12.0 artık yayın veya kayıt uygulaması değildir.
Kullanıcı kararıyla Studio, FFmpeg tabanlı kayıt/yayın motoru, replay, sanal
kamera ve bunlara ait genel sistem kısayolları rafa kaldırılmıştır.

Uygulama; canlı kanal olayları, yayın geçmişi, analiz, içerik planlama,
topluluk, marka, gelir, yerel kasa ve ayar bölümlerindeki 45 yayıncı aracına
odaklanır. Studio kaynakları depoda pasif kalabilir ancak üretim uygulamasına
bağlanmaz ve kurucuya eklenmez.

## 0.12.0 doğrulamaları

- `Studio` menüsü ve uygulama rotası kaldırıldı.
- Ana sayfadaki Studio çağrıları yayın akışı, analiz ve doğrulanmış kanal verisi
  eylemleriyle değiştirildi.
- Dokuz Studio özellik tanımı ürün kataloğundan kaldırıldı; güncel katalogda 45
  çalışma alanı vardır.
- Tauri Studio komutları ve Windows genel kayıt/yayın/replay kısayolları
  derlenen yerel köprüden çıkarıldı.
- FFmpeg yan uygulaması ile sanal kamera DLL/yöneticisi NSIS ve Store paket
  girdilerinden çıkarıldı.
- Windows üretim çalıştırıcısına `windows_subsystem = "windows"` eklendi.
  Böylece üretim EXE'si CMD/konsol penceresine bağlı çalışmaz.
- SW Identity güvenli kasa, deep link, tek örnek, güncelleme ve dış bağlantı
  altyapıları korunmuştur.
- TypeScript/Vite üretim derlemesi ve Rust denetimi başarılıdır.
- Yerel tarayıcı denetiminde dokuz menü öğesi göründü; Studio menüsü veya
  Studio açma düğmesi bulunmadı ve JavaScript hatası oluşmadı.
- Üretim EXE'sinin PE alt sistemi `Windows GUI (2)` olarak doğrulandı.
- Tauri updater imza testi geçti: `1 passed, 0 failed`.

## Veri ve güvenlik sınırı

- Kullanıcı oturumu Windows Credential Manager içinde saklanır.
- Ham medya yakalanmaz veya sunucuya gönderilmez.
- Kick ve Play Connect olayları yalnız Play Streamers API tarafından
  doğrulandığında gösterilir.
- Sayısal metrikler deterministik hesaplanır; AI yalnız kişisel veri içermeyen
  kanıt özetini anlaşılır dile dönüştürür.
- Gizli API/OAuth/Turnstile değerleri istemci paketine eklenmez.

## Dağıtım

- Kullanıcı sürümü: `0.12.0`
- Windows: 10 2004 ve sonrası, x64
- NSIS kurucusu: 3.112.496 bayt, SHA-256
  `345AF3D433A9E62F6FBEBD03A66094CCD3B791056FEF2593BB827186C449FCE2`
- Store MSIX: `Play-Streamers-0.12.0.0-windows-x64.msix`, sanal kamera kaydı
  yok, SHA-256
  `4A0DBE0A3C17230BEE605FF348AF9EAF2D149BE8D4D543D01311FA8DE19B96A8`
- Güncelleme: Tauri minisign doğrulamalı HTTPS manifesti
- Doğrudan kurucu Authenticode yayınevi imzası bulunmadığı sürece SmartScreen
  uyarısı gösterebilir; bu durum updater imzasından ayrıdır.
- Microsoft Store paketi Studio ve sanal kamera kaydı olmadan tek Windows x64
  paketi olarak hazırlanır.
