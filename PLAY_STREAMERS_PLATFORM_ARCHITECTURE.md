# Play Streamers Platform Mimarisi

Bu belge, Play Streamers'ın web sitesi ve masaüstü uygulaması arasındaki kalıcı
ürün sınırını tanımlar. Kullanıcı açısından yalnızca **tek masaüstü uygulaması**
vardır. Studio ve yerel kayıt/yayın motoru 0.12.0 kararıyla rafa kaldırılmıştır;
pasif kaynakları derlenen ürüne veya menülere bağlanmaz.

## Ürün yüzeyleri

### Web sitesi

Web sitesi hafif ve her cihazdan erişilebilir kalır. Burada yalnızca şu temel
işler bulunur:

- ürünü ve Free / Pro / Product Pro planlarını tanıtma,
- hesap açma, giriş, ödeme ve plan yönetimi,
- SW Identity güvenlik ve cihaz yönetimine geçiş,
- masaüstü uygulamasını indirme,
- sunucunun ürettiği temel canlı durum ve kısa yayın özeti.

Sahne düzenleme, kayıt, yayın, ayrıntılı analiz, içerik üretimi ve gelişmiş
araçlar web sitesine taşınmaz.

### Play Streamers masaüstü uygulaması

Uygulama tüm yayıncı araçlarının ana merkezidir:

- canlı kontrol paneli,
- analiz ve yayın sonrası raporlar,
- içerik ve yayın hazırlığı,
- topluluk ve etkileşim araçları,
- marka, gelir ve medya kiti,
- dosya kasası, notlar, ayarlar ve cihaz yönetimi.

Navigasyon plan adlarını değil kullanıcının yapmak istediği işi gösterir. Plan
kontrolü, kullanıcı bir aracı açtığında ortak özellik kataloğundan uygulanır.

## Studio sınırı

Bu bölüm tarihsel motor tasarımını belgeler. 0.12.0 ve sonrasında Studio,
FFmpeg yan uygulaması, sanal kamera ve kayıt/yayın komutları dağıtılan üründe
bulunmaz. Aşağıdaki maddeler yeniden etkin bir özellik listesi değildir.

Studio uygulamanın bir bölümüdür. Güvenilirlik için yayın motoru gerektiğinde
arka planda ayrı bir işletim sistemi süreci olarak çalışabilir; bu yalnızca
teknik bir ayrımdır. Kullanıcı tek kurulum, tek pencere, tek hesap ve tek
güncelleme akışı görür.

0.3.0 Windows önizlemesindeki çalışan Studio boru hattı şöyledir:

1. desteklenen donanımda FFmpeg Desktop Duplication (`ddagrab`), güvenli
   yedekte `gdigrab` ile ana Windows ekranını yakalama,
2. WASAPI loopback ile masaüstü sesi ve DirectShow ile seçilen mikrofonu alma,
3. tüm ekran, belirli oyun/uygulama/tarayıcı penceresi veya DirectShow kamera
   kaynağı; isteğe bağlı yerel görsel ve metin katmanı,
4. donanım uygunsa H.264 GPU kodlama, değilse x264'e güvenli geri dönüş,
5. kayıt/yayın sürerken ana sahne ile ekran göstermeyen mola sahnesi arasında
   geçiş ve masaüstü/mikrofon ses düzeylerini canlı değiştirme,
6. aynı kodlanmış paketleri RTMPS yayına ve yerel MKV kaydına dağıtma,
7. normal kayıtta yayın miksi, masaüstü ve mikrofonu ayrı ses kanallarında
   tutma; tamamlanan MKV kaydını görüntüyü yeniden kodlamadan MP4'e aktarma.

Sanal kamera, gelişmiş çok kaynaklı serbest yerleşim ve imzalı otomatik
güncelleme ayrı motor/dağıtım katmanlarıdır; 0.3.0'da çalışıyor kabul edilmez.

Normal kullanımda tek kodlama yapılır. Kullanıcı daha kaliteli ayrı kayıt
isterse ikinci kodlayıcı bilinçli bir seçenek olarak açılır. Motor çökerse ana
uygulama açık kalır ve kurtarılabilir kayıt parçasını korur.

## Kimlik ve yetki akışı

SW Identity tek kimlik ve plan otoritesidir.

1. Masaüstü uygulaması sistem tarayıcısında SW Identity girişini açar.
2. SW Identity iki dakika geçerli, tek kullanımlık bir kodu uygulamanın özel
   dönüş adresine gönderir.
3. Uygulama kodu Play Streamers API'ye iletir.
4. Play Streamers Worker kodu SW Identity'ye sunucudan sunucuya doğrulatır.
5. Worker yerel kullanıcı eşleşmesini ve plan önbelleğini günceller, ardından
   masaüstü uygulamasına iptal edilebilir bir Play Streamers oturumu verir.

`SW_PRODUCT_SSO_SECRET`, OpenAI anahtarı, OAuth secret değerleri ve yayın
anahtarları hiçbir zaman web arayüzüne veya uygulama paketine gömülmez. Yayın
anahtarı işletim sisteminin güvenli kimlik kasasında tutulur.

## Plan ve özellik modeli

Özellikler tek bir katalogda `id`, `plan`, `alan`, `durum` ve `veri ihtiyacı`
ile tanımlanır. Web, Worker ve masaüstü uygulaması aynı kimlikleri kullanır.

- **Free:** temel panel, sayaçlar, notlar ve temel yayın geçmişi.
- **Pro:** ayrıntılı grafikler, yayın akışı ve içerik
  üretim araçları, dışa aktarma ve kişiselleştirme.
- **Product Pro:** yayın zekâsı, izleyici nabzı, akıllı hedefler, gelir ve marka
  çalışma alanları, gelişmiş topluluk oyunları ve yapay zekâ açıklamaları.

Yönetici/moderatör ekleme, genel API, webhook ürünü, konuk hazırlık odası ve
thumbnail karşılaştırma odası bu kapsamın dışındadır.

## Yapay zekâ sınırı

Yapay zekâ ham olay toplamak veya her sayacı hesaplamak için kullanılmaz.
Önce deterministik sistem sayıları hesaplar: değişim yüzdesi, anlık etkinlik,
sessiz süre, hedef ilerlemesi ve sıra dışı değerler. Yapay zekâ yalnızca bu
kişisel veri içermeyen özeti anlaşılır Türkçe açıklamaya ve öneriye dönüştürür.

- AI kapalıyken bütün temel skorlar ve uyarılar çalışır.
- Ham sohbet, e-posta, yayın anahtarı ve ödeme bilgisi modele gönderilmez.
- Sonuçlar kısa süreli önbelleğe alınır ve neden gösteren sayısal kanıt taşır.
- Model yanıtı doğrulanmış bir JSON şemasına uymuyorsa güvenli yerel açıklama
  kullanılır.

## Veri sahipliği

- SW Identity: kimlik, güvenlik, ürün planı ve yetki kaynağı.
- Play Streamers Worker: ürün oturumu, özellik ayarları, dakikalık Kick canlı
  örnekleri, otomatik yayın özetleri, raporlar ve AI açıklama önbelleği.
- Masaüstü cihazı: büyük medya dosyaları ve kullanıcıya özel yerel çalışma
  alanları.
- Bulut eşitleme: yalnız kullanıcının açtığı küçük ayarlar, şablonlar ve
  özetler; büyük kayıt dosyaları varsayılan olarak yerelde kalır.

## Teslim sırası

1. Ortak özellik kataloğu, SW Identity ürün girişi ve plan yetkisi.
2. Masaüstü uygulama kabuğu, yerel ayarlar ve çalışan kayıt prototipi.
3. Windows yerel Studio motoru, temel sahneler, kayıt öncesi ses mikseri,
   MKV kayıt ve RTMPS yayını.
4. Mevcut panel verilerinin uygulamaya taşınması ve yayın sonrası raporlar.
5. Pro araçları; ardından sayısal kanıtlı Product Pro zekâ katmanı.
6. Çökme kurtarma, otomatik güncelleme, imzalı paket, uzun süreli yayın ve
   düşük donanım testleri.

Her aşama önce Free kullanıcı akışını bozmadan yayınlanır. Pro özellikleri
hazır olmadan yalnızca katalogda görünür; çalışanmış gibi gösterilmez.
