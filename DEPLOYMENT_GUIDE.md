# Play Streamers — Güncel yükleme dosyaları

Bu sürüm iki açık dağıtım klasörü, masaüstü uygulaması ve bir eklenti paketi üretir:

- `play-connect.zip`: Chrome eklentisi.
- `release/github-pages-latest`: GitHub Pages / `pstreamers.com` ön yüzü.
- `cloudflare-worker-latest`: Cloudflare Worker ve D1 migration dosyaları.
- `downloads/Play-Streamers-Setup.exe`: Play Streamers 0.11.0 Windows kurucusu.
- `release/microsoft-store/Play-Streamers-0.11.1.0-win10-x64.msix`: Windows 10
  2004 ve sonrası için sanal kamera kaydı içermeyen temel Store paketi.
- `release/microsoft-store/Play-Streamers-0.11.2.0-win11-x64.msix`: Windows 11
  için daha yüksek sürümlü, Play Streamers Camera kayıtlı Store paketi.
  Uygulamanın kullanıcıya gösterilen ürün sürümü iki pakette de `0.11.0`'dır;
  `0.11.1.0` ve `0.11.2.0` yalnızca Store paket seçimi için dahili numaralardır.
  İki paketin kimliği `Switly.PlayStreamers`, Store ID değeri
  `9NWZ0TF5K999`'dir.

## GitHub Pages

1. `release/github-pages-latest` klasörünü aç.
2. Klasörün içindeki dosyaların tamamını GitHub Pages deposunun ana dizinine yükle.
3. Eski dosyaların yerine aynı adlı güncel dosyaların yazılmasına izin ver.
4. `CNAME` dosyasının içeriğinin `pstreamers.com` olduğunu kontrol et.
5. GitHub Pages dağıtımı tamamlandıktan sonra siteyi normal ve gizli sekmede
   birer kez aç.

## Cloudflare Worker

1. `cloudflare-worker-latest` klasörünü aç.
2. D1 konsolunda `migrations` klasöründeki SQL dosyalarını numara sırasıyla,
   daha önce uygulanmamış olanlardan başlayarak çalıştır. Bu sürüm için en yeni
   dosya `0010_desktop_platform.sql` dosyasıdır. Bu dosya SW Identity eşlemesi,
   plan yetkileri, masaüstü ayarları, yayın oturumları ve AI açıklama önbelleğini
   ekler. `0009_kick_metric_hourly.sql` daha önce uygulanmadıysa önce onu çalıştır.
3. Worker kodunu `cloudflare-worker.js` dosyasının tamamıyla değiştir ve dağıt.
4. Worker D1 binding adının `DB` olduğunu doğrula.
5. Aşağıdaki değişken/secret adlarının Worker ayarlarında bulunduğunu kontrol et.
   Gizli değerleri hiçbir dosyaya yazma:

   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `KICK_CLIENT_ID`
   - `KICK_CLIENT_SECRET`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `RESEND_WEBHOOK_SECRET`
   - `SUPPORT_INBOUND_DOMAIN`
   - `SUPPORT_REPLY_SENDERS`
   - `TOTP_ENCRYPTION_KEY`
   - `TURNSTILE_SECRET_KEY`
   - `TURNSTILE_SITE_KEY`
   - `STREAMLABS_CLIENT_ID`
   - `STREAMLABS_CLIENT_SECRET`
   - `DONATIONALERTS_CLIENT_ID`
   - `DONATIONALERTS_CLIENT_SECRET`
   - `TIPEEESTREAM_CLIENT_ID`
   - `TIPEEESTREAM_CLIENT_SECRET`
   - `DONATE_OAUTH_ENCRYPTION_KEY`
   - `SW_PRODUCT_SSO_SECRET`

   AI açıklamaları açılacaksa ayrıca `OPENAI_API_KEY` secret'ını ve isteğe bağlı
   `OPENAI_MODEL` değişkenini ekle. Anahtar yoksa sistem sayısal, deterministik
   açıklamayı kullanır; Studio ve analiz akışı çalışmaya devam eder.

6. Worker route/custom domain değerinin `api.pstreamers.com` olduğunu doğrula.
7. Worker **Triggers** bölümünde Cron Trigger olarak `* * * * *` ekle. Böylece
   merkezi API bağlantıları site veya platform sekmesi açık değilken de dakikada
   bir kontrol edilir.

Depo kökünde bulunan `wrangler.play-streamers.jsonc`, mevcut canlı KV/D1
kimliklerini, OAuth istemci kimliklerini, `api.pstreamers.com` özel alan adını
ve cron tetikleyicisini koruyan doğrulanmış CLI yapılandırmasıdır. Canlı
migration öncesi D1 dışa aktarımı alınmalı; `SW_PRODUCT_SSO_SECRET` aynı rastgele
değerle hem Play Streamers hem SW Identity Worker secret alanına yazılmalıdır.

## Güncelleme sırası

Önce D1 migration, sonra hem Play Streamers hem SW Identity Worker'larında aynı
`SW_PRODUCT_SSO_SECRET`, ardından Worker ve Cron Trigger, GitHub Pages dosyaları,
masaüstü kurucusu ve son olarak güncel Play Connect kurulmalıdır. Eski eklenti klasörü Chrome'da
kaldırılmadan güncellenecekse paketlenmemiş uzantının klasörünü yeni
`play-connect` klasörüyle değiştirip **Yeniden yükle** düğmesine bas.

> Bu sürümde `0010_desktop_platform.sql`, Worker, GitHub Pages ön yüzü ve
> Play Streamers 0.11.0 kurucusu birlikte güncellenmelidir. Client secret ve şifreleme
> anahtarı GitHub'a veya ön yüz dosyalarına kesinlikle eklenmez.
