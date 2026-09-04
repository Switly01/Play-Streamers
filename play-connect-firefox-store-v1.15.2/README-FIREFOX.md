# Play Connect — Firefox / Gecko mağaza paketi

Bu klasör Firefox 128 ve üzeri masaüstü sürümleri için hazırlanmıştır. Firefox
mağaza paketinden ayrıdır; Firefox'a özgü `offscreen` servisi yerine Firefox'un
arka plan sayfasını kullanır. OBS / Alert Box iframe'leri bu arka plan sayfasında
görünmeden açık kalır.

## Yerel doğrulama

1. Firefox'ta `about:debugging#/runtime/this-firefox` adresini aç.
2. **Geçici Eklenti Yükle** seçeneğine tıkla.
3. Bu klasördeki `manifest.json` dosyasını seç.
4. Play Connect panelinde hesap eşleştirme, DAB, sunucu bağlantısı ve OBS alert
   bağlantısı akışlarını dene.

Geçici kurulum Firefox kapanınca kaldırılır. Kalıcı kullanım için bu paketin AMO
üzerinden imzalanması gerekir.

## AMO beyan özeti

- Yayıncı adı: SW Create
- Eklenti kimliği: `play-connect@pstreamers.com`
- Ana sayfa: `https://pstreamers.com`
- Gizlilik politikası: `https://pstreamers.com/privacy.html`
- Masaüstü Firefox hedeflenir; Android paketi değildir.
- Kod küçültülmemiş veya karmaşıklaştırılmamıştır; ayrı derleme adımı yoktur.

### Verilerin neden kullanıldığı

- Eşleştirme kodu ve bağlantı kimliği, eklentiyi doğru Play Streamers hesabıyla
  eşleştirmek için kullanılır.
- Donate gönderen adı, mesajı, tutarı, para birimi, platformu ve zamanı kişisel
  yayıncı panelinde göstermek için `https://api.pstreamers.com` adresine iletilir.
- Platform sayfası içeriği yalnızca donate olayını bulup normalleştirmek için
  yerelde incelenir; platform şifresi Play Streamers'a gönderilmez.
- Destek formu kullanıcı seçerse e-posta, mesaj ve ek dosyaları destek sistemine
  iletir.

## AMO'ya yüklenecek dosya

`play-connect-gecko-v1.15.2.zip` dosyasını yükle. ZIP'in kökünde doğrudan
`manifest.json` bulunur; üstte fazladan klasör yoktur.
