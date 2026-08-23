# Play Streamers Donate Bridge

Play Streamers Donate Bridge, herkese açık bir API veya webhook sunmayan donate
sitelerindeki yayıncıya ait takip ekranlarını **yayıncının kendi bilgisayarında**
izleyen Windows uygulamasıdır.

Uygulama belirli platform adlarına bağlı değildir. Kullanıcı:

1. Donate sitesinin adını ve takip sayfasını ekler.
2. Gerekirse uygulama içindeki ayrı pencereden platform hesabına giriş yapar.
3. Sayfadaki bir donate satırını ve içindeki tutar/ad/mesaj/zaman alanlarını
   görsel olarak seçer.
4. Bağlantıyı açar.
5. Play Streamers sitesinde **Hesabım → Bağlantılar** bölümünden tek kullanımlık
   kod oluşturup uygulamanın Ayarlar ekranına girer.

Takip penceresi kapatıldığında ekranda görünmez fakat uygulama sistem tepsisinde
çalışmaya devam eder. Bilgisayar tamamen kapalı veya uyku durumundayken veri
alınamaz.

## Sağlayıcı ekleme biçimleri

- **İşlem geçmişi / son destekler:** Birden fazla donate satırının bulunduğu
  hesap sayfası. Geçmiş ve kaçırılan kayıtları tamamlama açısından tercih edilir.
- **Canlı bildirim / alert:** Tek bir bildirimin anlık değiştiği sayfa.
  Geçmiş sağlamıyorsa uygulama kapalıyken oluşan olaylar sonradan alınamayabilir.

OBS bağlantısı zorunlu değildir. Herhangi bir platformun giriş sonrası işlem
geçmişi veya son destekler sayfası kullanılabilir.

## Güvenlik sınırları

- Platform parolası Play Streamers API'sine gönderilmez.
- Oturum çerezleri platforma özel kalıcı Electron bölümünde yerel olarak tutulur.
- Sağlayıcı şablonu dışa aktarılırken çerez, parola ve cihaz anahtarı eklenmez.
- Bir takip penceresinden gelen olay yalnızca tanımlanan alan adıyla eşleşiyorsa
  kabul edilir.
- API teslimat anahtarı Windows `safeStorage` alanıyla şifrelenir.
- Uzak sayfalar Node.js veya uygulama dosya sistemi yetkisi alamaz.

Bir platformun takip ekranını otomatik okumadan önce ilgili kullanım
koşullarının kontrol edilmesi gerekir.

## Geliştirme

Gereksinimler:

- Node.js
- pnpm

Komutlar:

```text
pnpm install
pnpm test
pnpm start
pnpm dist:win
```

Windows çıktıları `dist` klasöründe oluşur.

## Uygulama verisi

Uygulama aşağıdakileri Electron'ın kullanıcı verisi klasöründe tutar:

- Sağlayıcı tanımları
- Son algılanan olayların ortak biçimi
- Gönderilmeyi bekleyen yerel kuyruk
- Tekrar kaydı engelleyen olay kimlikleri
- Bağlantı çalışma durumları

“Ayarlar → Yerel veri klasörü” düğmesi gerçek klasörü açar.

## Play Streamers API bağlantısı

Uygulama olayları ortak biçime dönüştürür:

- `eventId`
- `providerId` / `providerName`
- `donorName`
- `amountMinor`
- `currency`
- `message`
- `eventAt`
- `observedAt`
- `source`

API teslimatı ilk kurulumda kapalıdır. Sitedeki 10 dakikalık, tek kullanımlık
eşleştirme kodu uygulamaya girildiğinde sunucu bu bilgisayara ayrı bir cihaz
anahtarı verir. Anahtar yalnızca Windows güvenli depolamasında tutulur. Siteden
cihaz bağlantısı kesildiğinde uygulamanın sonraki isteği reddedilir ve teslimat
otomatik olarak kapanır.

Sunucu her olayda cihazı ve kullanıcıyı doğrular; tutarı kuruş cinsinden tam
sayı, para birimini üç harfli kod ve olay zamanını geçerli aralık olarak kontrol
eder. Aynı sağlayıcı olayı ikinci kez gelirse D1 benzersiz kaydı sayesinde
tekrar eklenmez.
