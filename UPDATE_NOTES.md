# Play Streamers — Birleştirilmiş Güncelleme Notları

Bu doküman; Play Streamers web uygulaması, Cloudflare Worker API'si ve Play Connect tarayıcı eklentisindeki kullanıcıya yansıyan önemli sürüm değişikliklerini bir arada özetler.

## Güncel sürümler

- Web uygulaması / ürün bağlamı: **4.22**
- Play Connect: **1.10.3**
- Worker kaynak sabiti: **4.4**

> Yayın öncesinde Worker'daki bildirim sürüm sabiti ile bu sürüm geçmişi aynı numaraya yükseltilmelidir.

## Play Streamers web uygulaması

### 1.0–1.2 · Kullanıcı ana sayfası

- Girişten sonra Dashboard yerine kişisel karşılama sayfası eklendi.
- "Neler yeni?", "Neler sunuyoruz?" ve geliştirme hedefleri alanları eklendi.
- Gmail ve Kick bağlantı durumları ile Dashboard geçişi görünür hale getirildi.
- 1.2 ek güncellemesiyle ana sayfa ve Dashboard menü düğmeleri ortak davranışta birleştirildi; Play Streamers markası hover durumunda belirginleşti; bağlı hesap sayısı bağlantı değiştiğinde yenilenir hale getirildi; "Neler yeni?" oku tüm güncelleme geçmişini açacak biçimde düzenlendi.

### 3.7–3.9 · Bağlantılar ve donate altyapısı

- Streamlabs, DonationAlerts ve TipeeeStream için merkezi OAuth bağlantıları eklendi.
- Bağış olayları bağlantı anındaki eski verileri almadan, yeni ve tekil olaylar olarak işlenmeye başladı.
- Donate sağlayıcı bağlantıları DAB/SSB düzenine taşındı.
- Kick takipçi özeti kullanılamazsa doğrulanmış takip olaylarından açıkça belirtilen yedek değer gösterimi eklendi.

### 3.8–4.4 · Canlılık, Dashboard ve kararlılık

- Donate, Kick, bildirim, bağlantı ve canlı veri kontrolleri daha sık ve kontrollü yenilenir hale getirildi.
- Dashboard olayları, donate ayrıntıları ve okunmuş olay davranışları tam sayfa yeniden çizimi gerektirmeden çalışacak şekilde iyileştirildi.
- Giriş sonrası ana sayfanın birden çok kez çizilmesine neden olan geçişler önlendi.
- "Neler yeni?" alanı ortak sürüm geçmişi ve açılır/kapanır notlarla geliştirildi.
- Dil, durum, menü ve bildirim yüzeylerinin konum/yeniden boyutlanma sonrası tetikleyicilerine yeniden bağlanması sağlandı.
- Canlı sayaç onarım döngüsü sınırlandırıldı; yalnız bozulmuş bileşenler yeniden kurulur hale getirildi.

### 4.10–4.17 · Grafikler, etkileşimler ve Play Bot

- Aktif abone alanı veri yoksa `0` gösterir; devam eden gün 90 günlük grafiğe dahil edilmez.
- Günlük Kick sütunundan 24 saatlik ayrıntı görünümüne geçiş eklendi ve bu görünüm bağımsız, ortalanmış katmana taşındı.
- Dashboard'daki durum/dünya/menü düğmelerinin ve istatistik kartlarının tıklama alanlarını bozan genel hover dönüşümleri engellendi.
- Sıfırla düğmesi aktif Panel/İstatistik sekmesinin kapsamını tek öğeden doğru uygular hale getirildi.
- Play Bot; Worker kaynağı, görünür DOM, API sağlığı, logo, taşma ve kritik arayüz sözleşmelerini birlikte denetleyecek biçimde genişletildi.
- Canlı sayılar, yeni veri geldiğinde ekranda görünen değerden devam eder; eski sekme yanıtlarının sayıyı geriye çekmesi engellendi.

### 4.14–4.20 · Logo doğrulama ve saatlik Kick ölçümleri

- TipeeeStream DAB kartı resmî gömülü logoya geçirildi; eski metin yedekleri ve yanlış logo uyarıları kaldırıldı.
- Bozuk veya eksik logo durumları hem kullanıcı arayüzünde hem Play Bot denetiminde güvenli şekilde ele alındı.
- Worker sağlık denetimi kendi alan adına dönüp hata üretmek yerine doğrudan D1 bağlantısını doğrular hale getirildi.
- Kick takipçi ve abone ölçümü, bütün hesapları tek işaretle kilitlemek yerine hesap bazlı saat satırlarıyla işlendi; tamamlanmayan hesaplar sonraki cron turunda yeniden denenir.

### 4.21–4.22 · Footer ve gizlilik

- Tüm ana altlıklara görünür Gizlilik Politikası bağlantısı eklendi.
- Footer üç bölüme düzenlendi: Gizlilik Politikası, ürün mesajı ve SW CREATE bağlantısı.
- Dar ekranlarda footer öğeleri okunaklı biçimde alt alta ortalanır.

## Cloudflare Worker / API

- Kullanıcı adı-parola, Google OAuth ve Kick OAuth ile kayıt/giriş akışları; oturum doğrulama ve güvenli çıkış desteği sağlandı.
- D1 tabanlı kullanıcı, oturum, e-posta kodu, güvenlik, olay ve hesap verisi altyapısı geliştirildi; yeni kimlik kayıtlarında KV bağımlılığı kaldırıldı.
- PBKDF2 parola hashleme; kullanıcı adı/e-posta/parola değişikliklerinde süre kısıtları; e-posta kodu; hesap silme ve parola sıfırlama akışları eklendi.
- Turnstile, CORS, hassas endpoint oran sınırı, güvenilir cihaz ve TOTP/Authenticator güvenlik katmanları geliştirildi.
- Kick webhook, yayın/abonelik/hediye/Kicks olayları, kanal özeti yenilemesi ve saatlik metrikler eklendi.
- OAuth erişim ve yenileme anahtarları şifreli saklama yaklaşımına geçirildi; anahtarlar istemciye veya düz metin D1 kaydına yazılmaz.
- Destek sistemi; e-posta gönderimi, ekler, konuşma geçmişi, durum filtreleri, güvenli indirme yönlendirmeleri ve yeni yanıt bildirimleriyle genişletildi.
- Canlı site sayaçları; tekil ziyaretçi, tamamlanmış hesap ve son iki dakikadaki aktif kullanıcı değerlerini toplu ve gizlilik odaklı şekilde ölçer.

## Play Connect tarayıcı eklentisi

### 0.5–0.9.3 · Eşleştirme ve güvenilir olay yakalama

- Eşleştirme kodu biçimi 10/12 karakterden 16 karakterlik, dört gruplu forma geçirildi; eski kullanılmamış kodlar geçiş desteğiyle korundu.
- Bağlantı durumları, teslimat kuyruğu, sunucu onayı ve hata/oturum bilgileri kullanıcıya görünür hale getirildi.
- Donate olayları için kalıcı tekilleştirme ve geçerli başlangıç noktası mantığı eklendi.
- Platform sayfalarının kendi ağ JSON yanıtlarını izleyen ortak algılama altyapısı geliştirildi.

### 1.0–1.8.1 · Arka plan çalışma ve OBS

- API sunmayan sağlayıcılar için yönetilen oturum/sekme yaklaşımı geliştirildi; daha sonra kalıcı yönetilen sekme zorunluluğu kaldırıldı.
- Her olayda "yakalandı" ve "sunucu onayladı" durumları ayrıştırıldı.
- Genel sayfalardaki örnek donor kartları gerçek olay kabul edilmez hale getirildi.
- OBS Browser Source / Alert Box üzerinden güvenli, doğrulanabilir olay yakalama eklendi.
- Arka plan çalışma ayarı kullanıcı anahtarından bağımsız sürekli etkin hale getirildi.
- OBS bağlantısını kaldırma için markaya uygun onay penceresi ve çift kuyruk engeli eklendi.

### 1.9.0–1.10.3 · Sağlayıcılar, performans ve arayüz

- Donate olay kimliği sağlayıcı, gönderen, tutar, mesaj ve zaman bileşimiyle güçlendirildi.
- OBS kartlarından gönderen/mesaj verisinin semantik olarak okunması ve test olaylarının ayrı yaşam döngüsüyle işlenmesi sağlandı.
- Dashboard canlı olaylarla güncellenirken görünür yüzey ve oturum rotası korunur hale getirildi.
- Kick hesabı yeniden bağlanınca kanal özeti ve takipçi bilgileri sunucudan tekrar alınır.
- SSB/DAB sağlayıcı seçimi arka plan yenilemelerinde korunur; test olayı Dashboard'a anında aktarılır.
- Eklentinin olay kuyruğu, sayfa/alert değişimi ve bağlantı durumu daha kısa ama çakışmayan çevrimlerle izlenir.
- Merkezi DAB ekranındaki boş/çift arka planlar kaldırıldı; TipeeeStream logo yedekleri kararlılaştırıldı.

## Dağıtım notu

Frontend `index.html` üzerinden, API ise `api.pstreamers.com` alan adı üzerinden yayınlanmalıdır. Bu doküman sürüm özeti niteliğindedir; canlı sürüme geçmeden önce Worker'ın `CURRENT_RELEASE_VERSION` ve yayın tarihi, en güncel sürüm notuyla eşitlenmelidir.
