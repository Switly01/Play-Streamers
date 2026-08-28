# Play Streamers — Kalıcı Proje Bağlamı

## Güncel geliştirme durumu · 28 Ağustos 2026

Site 10.6.0 / Worker 5.5 / SW Identity 1.8.1 / Desktop 0.14.4 / Play Connect
1.15.1 kaynakları hazırlandı. Site kartları ve temel yüzeyler, mobilde daha
düşük bulanıklık kullanan belirgin sıvı cam katmanına geçirildi. Yıldız alanında
tek `requestAnimationFrame` ile çalışan gerçek imleç feneri bulunur. Ortak
yükleyici yıldız alanı, yüzen PS amblemi ve hareketli ilerleme çizgisiyle
yenilendi. PS monogramında P/S aralığı daraltıldı; S üst ucu yuvarlak ve kesintisiz
bir eğri olarak yeniden çizildi, üst soldaki Play Streamers adı büyütüldü.

Dil seçimi artık sayfayı yenilemez: kaynak Türkçe metinler geri yüklenir, seçilen
dil aynı DOM üzerinde uygulanır ve tercih `ps15-locale` ile bütün sayfalarda
kalıcıdır. İlk tercih yoksa ülke/tarayıcı dili, desteklenmeyen bölgelerde
İngilizce kullanılır. Görünür alan önce çevrilir; Dashboard, giriş/kayıt,
destek, gizlilik ve kullanım koşulları dahil kalan yüzeyler arka planda
tamamlanır. D1 çeviri önbelleği `v9`, istemci önbelleği `ps-live-i18n-v10`
ad alanını kullanır; Worker yapılandırmasında KV binding'i yoktur.

Turnstile `interaction-only` görünümünde giriş/kayıt penceresi açılır açılmaz
hazırlanır; etkileşim gerekirse kutu “Beni hatırla” satırının altında görünür,
pencere kapanınca sıfırlanıp görünmez alana taşınır. Şifre gözünde seçim ve
imleç konumu korunur. SW Identity izinli ürün CORS yanıtlarında `cross-origin`
CORP kullanır; böylece Play Streamers'taki geçerli giriş/kayıt yanıtları tarayıcı
tarafından “Failed to fetch” olarak gizlenmez. Canlı sayaç yazma isteği başarısız
olursa D1'e yazmayan GET anlık görüntüsü kullanılır. SW Bot kullanıcıya yalnız
D1'de tutulan ortak sunucu sonucunu gösterir; denetim kapsamına kimlik dönüşü,
404 sayfası ve SW Identity sağlığı da eklendi.

Desktop 0.14.4 doğrudan kurucusu Tauri updater anahtarıyla yeniden
imzalanmıştır; Tauri `.sig` dosyası Windows Authenticode yayımlayıcı
sertifikasının yerine geçmez.

Önceki Site 10.4.2 / Desktop 0.14.3 / Play Connect 1.15.0 durumu:
Play Connect paneli artık eklenti simgesinden doğrudan yeni sekmede açılır ve
sağlayıcı seçimini URL üzerinden korur. Desktop özellik kartları erişilebilir
bir sıvı cam çekmece açar; Escape ve kapatma düğmesiyle kapanır. Microsoft Store
derlemesi uygulama içi Tauri güncelleyicisini içermez, güncellemeyi Store'a
bırakır ve `0.14.4.0` MSIX olarak paketlenir.

Canlı çeviri görünür/gizli Dashboard yüzeyleri ile placeholder, başlık, erişim
etiketi ve düğme değerlerini kapsar. Önce yerel tarayıcı önbelleği uygulanır;
küçük gruplar paralel çevrilir ve eksik AI yanıtları tekil güvenli yeniden
denemelerle tamamlanır. Worker'daki çeviri KV önbelleği kaldırılmıştır. Ortak
çeviri sonuçları D1 `interface_translation_cache` tablosunda metin/dil bazında,
istemci sonuçları ise cihazın yerel önbelleğinde tutulur. Çeviri oran sınırı
Worker örneğinin sınırlı belleğinde en iyi çaba yöntemiyle uygulanır; bu akışta
KV binding'i yoktur.

SW Bot kaynak sözleşmeleri Site 10.4.2 ile eşitlendi; router, analitik, logolar,
masaüstü güncelleme bildirimi ve Play Connect 1.15.0 paketi denetime eklendi.
İstemci denetimi ayrıca etiketsiz form alanlarını, güvenli olmayan dış
bağlantıları ve birden fazla görünür ana içeriği kontrol eder. Kullanıcıya
gösterilen açıklama başlığı yalnız `SW AI` olur. PS logosu tek dış çerçeve ve
daha küçük/dengeli monogram kullanır; mağaza görselleri monokrom sıvı cam
kimliğiyle yenilenmiştir.

Site 9.2.0 / Platform 5.2 / Desktop 0.14.1 / Play Connect 1.13.0 tarihsel durumu: Ana sayfa,
Klyze referansının güçlü ürün sunumu örnek alınarak ancak özgün bir Play
Streamers kimliğiyle tamamen siyah-beyaz düzene geçirildi. Yeni PS monogramı,
katmanlı Desktop ön izlemesi, web/uygulama görev ayrımı, masaüstü indirme
çağrıları ve responsive ürün bölümleri tek aktif vitrin katmanında çalışır.
Turuncu Control Room dili kaldırıldı; hesap, üye ve Dashboard yüzeyleri de aynı
monokrom değişkenleri kullanır. 8.1 revizyonunda Klyze referansına daha yakın
ortalanmış sinematik hero, yıldız/toz alanı, büyük PLAY.STREAMERS kelime markası,
tek güçlü Windows indirme çağrısı ve hero altı masaüstü ürün sahnesi kuruldu.
PS logosu yuvarlak çizgilerden arındırılarak keskin geometrik P ve S harfleriyle
yeniden çizildi. 8.2 revizyonunda yıldız katmanlarının hızı artırıldı; ışık
izleri, işaretçi odak ışığı, sürekli kayan yetenek bandı, kademeli scroll reveal,
hareketli grafik çubukları ve süzülen ürün penceresi eklendi. Logo; çift sekizgen
çerçeve, diyagonal iç katman, tonlu harf yüzeyi ve teknik mikro detaylarla daha
karakterli hale getirildi. `prefers-reduced-motion` hareketleri kapatır. Kick yayınları artık
dakikalık Worker görevi ve imzalı livestream webhooklarıyla sunucuda otomatik
oturum oluşturur. Site, masaüstü uygulaması ve eklenti kapalıyken de izleyici
örnekleri toplanır; yayın kapanınca ortalama/tepe izleyici, takip, abonelik,
bağış ve etkileşim özeti D1 üzerinde tamamlanır. Site; ziyaretçi, üye, hesap ve
Dashboard yüzeylerini ortak monokrom tasarım sisteminde birleştirdi. Desktop aynı özeti açılışta
ve dakikada bir yeniler. Windows 10/11 tek 0.14.1 uygulama ve 0.14.1.0 Store
paketini kullanır; Store bildiriminde artık kamera/mikrofon yetkisi yoktur.
Chrome ve Firefox Play Connect paketleri 1.13.0 sürümünde eşitlenmiştir. Popup;
normal, dar ve kapalı panel genişliklerinde yatay taşma veya yalnız kaydırma
çubuğuna dönüşmeden güvenli bir responsive görünüm kullanır.
Chrome/Chromium mağaza paketi `play-connect-chromium-v1.13.0.zip`, Firefox/AMO
paketi `play-connect-gecko-v1.13.0.zip`, site indirme paketi ise
`play-connect-v1.13.0.zip` ve geriye uyumlu `play-connect.zip` adlarıyla tutulur.
Play Connect açılır paneli ve yönetim ekranı ile Desktop 0.14.1; Site 9'un
keskin siyah/beyaz amblemleri, teknik ızgarası, monokrom kartları ve erişilebilir
odak durumlarını paylaşır. Eklenti 240–392 piksel aralığında yatay taşma üretmez.

Site 8.3 görsel denetimi: yıldız/parçacık/meteor hızları artırıldı, işaretçi ve
kaydırma paralaksı ile PLAY.STREAMERS ışık taraması eklendi. Masaüstü özellik
ızgarasındaki boş üçüncü sütun 8/4 + 4/4/4 yerleşimiyle kapatıldı. Mobil sabit
destek düğmesi içerik üzerinden üst menüdeki boş alana taşındı; uygulama durum
rozeti pencere kontrollerinin üzerinden kaldırıldı. Gerçek değer gelmediğinde
üç büyük tire gösteren canlı istatistik şeridi artık saklanır ve değer geldiği
anda otomatik görünür.

Site çalışma tercihi: Kullanıcı aksi yönde açıkça istemedikçe tamamlanan site
değişiklikleri, yerel doğrulama ve testlerden sonra GitHub Pages üzerinden
`pstreamers.com` alan adına yayınlanır; canlı dosya ve görünüm ayrıca kontrol
edilir.

Site 9.0: Monokrom premium tasarım dili yalnız genel ana sayfada kalmaz;
kullanıcı ana sayfası, Dashboard, hesap merkezi, giriş/kayıt ve e-posta
doğrulama pencereleri, açılır menüler, ürün/bilgi yüzeyleri, Gizlilik ve yeni
Kullanım Koşulları sayfası aynı panel, çizgi, tipografi, logo ve hareket
sistemini kullanır. Sayfa genelindeki hafif yıldız/meteor/işaretçi hareketi ile
yeni yüzey girişleri `prefers-reduced-motion` tercihini korur. PS amblemi;
keskin, asimetrik dış gövde, parçalı metal çerçeve ve birbirine geçen P/S
geometrisiyle yenilendi; yalnız düz “PS” yazısı değildir.

Play Bot kullanıcıya görünen ad olarak **SW Bot** oldu. Sunucu endpoint'i
`/api/sw-bot/status` olup eski `/api/play-bot/status` geriye uyumlu takma ad
olarak kalır. Denetim; canlı Site 9.0 dosyaları, ana/onarım/davranış betikleri,
premium stil, logo, dil görselleri, Gizlilik, Kullanım Koşulları, Windows
kurucusu ve D1 iç sağlığını kapsar. Tarayıcı tarafı ayrıca yinelenen görünür
kimlik, boş ekran, aynı anda görünen Dashboard/üye evi, uzun yükleyici, yatay
taşma, bozuk görsel, giriş/Google düzeni, dil menüsü, güncelleme akordeonu,
TipeeeStream kartı, grafik bağlantısı, sıfırlama kapsamı, adsız/çok küçük
kontroller, hedefsiz bağlantılar, bozuk `aria-expanded` ve açılır katman
çakışmalarını denetler. Workers AI, sonuç değiştiğinde tek toplu çağrıyla SW AI
açıklaması üretir; geçersiz/başarısız AI çıktısında deterministik Türkçe özet
ve güvenli sonraki adım kullanılır. Aynı sorun kümesi değişmedikçe AI sonucu
önbellekten tekrar kullanılır.

Site 9.1 ana sayfa akış onarımı: genel sayfa dikey kaydırma alanı açık biçimde korunur. Hakkımızda, Ürünlerimiz ve Nasıl Çalışır bağlantıları ayrı tam ekran katman açmak yerine aynı sinematik ana sayfadaki ilgili bölümlere yumuşak kaydırır. Yeni Hakkımızda bölümü ürün tasarım diliyle bütünleşir; doğrudan `/about`, `/products` ve `/how-it-works` rotaları da aynı ana sayfa bölümlerine bağlanır. PS amblemi daha temiz, keskin, iç içe geçen P/S geometrisine ve teknik asimetrik çerçeveye geçirilmiştir.

Site 9.2 sıvı cam ve hareket revizyonu: Ana sayfa yıldızları merkezden dışarı
hızlanan 44 izli perspektif tüneline geçirildi; büyük kelime markası noktasız
`PLAY STREAMERS` olarak güvenli genişlikte iki parçaya ayrıldı ve son harfin
kırpılması engellendi. Kayan yetenek bandının iki kopyası en az ekran genişliği
taşıdığı için döngü ortada kesilmez. Windows hareket tercihi site animasyonlarını
artık kapatmaz. Hakkımızda ve Creator Operating System kartlarındaki sıralama
sayıları kaldırıldı; dönen metin yerine yeni karakteristik PS portal amblemi
kullanılır. Ürünler bölümü Play Streamers Plans ve SW Create Plans sekmelerinde
altı planı, SW CREATE ana bağlantısını, Play Streamers, Play Connect ve masaüstü
uygulama bağlantılarını sunar. Navigasyon, ziyaretçi, üye, Dashboard, hesap,
doğrulama ve modal yüzeylerinde siyah-beyaz ana tema korunarak dinamik ışık,
yansıma, saydamlık ve bulanıklık kullanan ortak sıvı cam dili uygulanır.
`Developed by SW CREATE` bağlantısı `https://swcreate.com` adresine gider.

Site 10.1 kimlik, hareket ve kararlılık revizyonu: Ana sayfanın uzay sahnesine
katmanlı yörünge, ay, takımyıldız ve uzak araç hareketleri eklendi. Beş dakika
sonra Windows indirme düğmesine halatla inen özgün piksel astronot “Hey,
geleceğin yayıncısı!” mesajını gösterir; tıklanınca aynı halatla yukarı çıkar.
Canlı ziyaretçi/hesap/aktif sayaçları yükleme iskeletiyle her zaman görünür ve
büyük başlıkla çakışmaz. Giriş penceresi kullanıcı adı veya e-posta + şifreyi,
Google/Kick/SW sağlayıcılarını; kayıt penceresi kullanıcı adı, iki şifre, doğum
tarihi ve Google/Kick sağlayıcılarını doğrudan SW Identity üzerinde kullanır.
Hesap kapsamı değiştiğinde önceki hesabın yerel panel verileri yeni hesaba
taşınmaz. Bütün dil seçimleri sayfayı tek kaynak dille yeniden kurar; canlı
çeviri görünür metin, form açıklaması ve erişilebilirlik etiketlerine uygulanır,
Arapçada genel yerleşim LTR kalır. SW Bot kaydırılabilir sabit panelde çalışır,
yenileme sırasında eski sonucu silmez, kaydırılabilir ana sayfanın aşağıdaki
kontrollerini yanlış taşma olarak raporlamaz ve SW AI kullanıcıya işlem talimatı
vermek yerine sorunu sade biçimde açıklar. Destek, Gizlilik ve Kullanım
Koşulları ortak monokrom sıvı cam tasarımına geçirildi. Site sürümü 10.2.3,
ana betik 5.3.6, son onarım betiği 5.7.8 ve canlı çeviri önbelleği v4.3'tür.
10.2 ile ana kahraman alanındaki dikdörtgen blur kaldırıldı; cam yüzeyler yansıma,
kenar kırılması ve katmanlı saydamlıkla yeniden kuruldu. Saf beyaz beşgen PS
monogramı, sabit canlı metrik kapsülü, kancalı halat astronotu, özel doğum tarihi
takvimi ve yenilenen destek ekranı eklendi. SW Identity 1.8 doğrudan ürün geçiş
kodu üreterek parola ve 2FA akışını Play Streamers içinde tutar.
Canlı çeviri, uzun AI JSON paketlerinin eksik kalmasını önlemek için görünür
metinleri 12'li paketler hâlinde işler; geçersiz paketleri kontrollü biçimde
böler, en fazla dört küçük paketi paralel işler ve başarılı her paketi sayfaya
beklemeden uygular.

Site 9.0.2 etkileşim onarımı: `showDialog` kullanan destek, güncelleme,
grafik, hesap güvenliği, çıkış ve sıfırlama pencereleri ortak sabit modal
katmanına alındı; böylece body sonuna görünmeden eklenmez. Eski sistem durumu
penceresi SW Bot ile aynı tıklamada ikinci kez açılmaz. SW Bot görünürlük
denetimi gizli/ölçüsüz atıl kopyaları ve kapalı Google ölçüm düğmesini sorun
saymaz; altlık bağlantıları güvenli dokunma yüksekliğine sahiptir.

Sürüm 4.8 / Desktop 0.12.0: Kullanıcı kararıyla Studio, yerel kayıt/yayın
motoru, genel kayıt-yayın-replay kısayolları, FFmpeg yan uygulaması ve sanal
kamera dağıtımı masaüstü ürününden rafa kaldırıldı. Kaynak kodu gelecekteki
yeniden değerlendirme için depoda pasif tutulabilir ancak derlenen uygulamaya,
menüye, Tauri komutlarına veya kurulum paketine bağlanmaz. Masaüstü uygulaması
45 içerik, analiz, topluluk, marka, gelir, kasa ve ayar aracına odaklanır.
Windows üretim EXE'si `windows_subsystem = "windows"` ile konsolsuz çalışır;
uygulamayı kapatmak için bağlı bir CMD penceresine ihtiyaç duymaz. Bu karar,
aşağıdaki 0.11.0 ve daha eski Studio kayıtlarını yalnız tarihsel bilgi haline
getirir.

Sürüm 4.7: Desktop 0.11.0 tek FFmpeg kodlama akışını iki güvenli RTMPS
hedefine eşzamanlı gönderebilir; ikinci anahtar da yalnız Windows Credential
Manager'da tutulur. Studio proje sınırı 32 sahneye, sahne başına kaynak sınırı
64'e çıkarıldı. Kaynaklar yayın/kayıt dışındayken doğrudan Önizleme tuvalinde
sürüklenerek konumlandırılabilir. Yayın motoru telemetrisi FFmpeg çocuk
sürecinin gerçek CPU kullanımını da gösterir. OBS eklenti uyumluluğu,
tarayıcı kaynağı, stinger/luma, ses izleme bus'ı ve gerçek çoklu görünüm bu
sürümde tamamlanmış sayılmaz.
Play Streamers API aynı sürüm için 23 Ağustos 2026'da
`a5abc7b3-ea1b-4c9e-9621-99169a7ec123` Worker kimliğiyle canlıya dağıtıldı;
health, Workers AI binding ve `https://pstreamers.com` CORS ön kontrolü geçti.

Sürüm 4.6: Ürün sayfası masaüstü uygulamasının çoklu sahne, gerçek program
önizlemesi, canlı ses/telemetri ve doğrulanmış olay hattını; 54 hazır çalışma
alanıyla birlikte yeni Creator OS mimarisinde sunar. Site hesap, plan, güvenlik,
bağlantılar ve indirme merkezi olarak kalır.

Sürüm 4.5: Ürün sayfası masaüstü uygulamasının hazır yayın/kayıt çekirdeğini,
erken sürüm çalışma alanlarını ve OBS sınıfına ulaşmak için eksik Studio
işlerini ayrı durum kartlarında gösterir. Doğrudan EXE'nin güncelleme imzası
ile Windows yayınevi imzası arasındaki fark açıklandı. Site sağlık kontrolü,
API'nin eski bir sürüm numarasına eşit olmasını beklemek yerine `/health`
sözleşmesindeki gerçek servis durumunu kullanır.

Bu belge, Play Streamers üzerinde gelecekte yapılacak çalışmaların ortak
başvuru noktasıdır. Gizli değerler burada veya başka bir proje dosyasında
tutulmaz.

## Masaüstü ürün kararı · 23 Ağustos 2026

- Kullanıcıya sunulan ürün tek bir **Play Streamers masaüstü uygulamasıdır**.
- Bütün Free, Pro ve Product Pro araçları bu uygulamada bulunur.
- `Studio` ve yerel yayın/kayıt motoru 0.12.0 itibarıyla rafa kaldırılmıştır;
  uygulamanın menüsünde, yerel köprüsünde veya dağıtım paketinde yer almaz.
- Studio kaynakları yalnız gelecekte yeniden değerlendirme yapılabilmesi için
  pasif kaynak olarak korunabilir; derlenen ürüne bağlanamaz.
- Site; ürün tanıtımı, hesap, plan, güvenlik ve indirme merkezi olarak hafif
  kalır. Gelişmiş araçların tamamı siteye kopyalanmaz.
- SW Identity kimlik ve plan otoritesidir. Paylaşılan SSO secret yalnız Worker
  tarafında kalır; masaüstü uygulaması tek kullanımlık ürün kodu değişimi yapar.
- Yapay zekâ temel metriklerin yerine geçmez. Sayısal ölçüm deterministik
  hesaplanır; Product Pro AI katmanı yalnız kişisel veri içermeyen kanıt özetini
  anlaşılır Türkçe açıklamaya dönüştürür.
- Ayrıntılı bileşen sınırı ve teslim sırası
  `PLAY_STREAMERS_PLATFORM_ARCHITECTURE.md` dosyasında tutulur.

## Masaüstü önizleme 0.3.0 · 22 Ağustos 2026

- Studio kayıt/yayın sürerken ana sahne ile gizli mola sahnesi arasında FFmpeg
  komut kanalıyla geçiş yapar; süreç ve kodlayıcı yeniden başlamaz.
- Ana kaynak tüm ekran, belirli oyun/uygulama/tarayıcı penceresi veya DirectShow
  kamera olabilir. Yerel PNG/JPG/WebP ve kısa metin katmanı aynı kareye eklenir.
- Masaüstü ve mikrofon sesleri yayın sırasında ayrı ayrı değiştirilebilir.
  Normal MKV kaydında yayın miksiyle birlikte kaynaklar ayrı ses kanallarında
  tutulabilir.
- Tamamlanan MKV kayıtları güvenli kayıt klasörü sınırı doğrulanarak, görüntü
  yeniden kodlanmadan MP4 kabına aktarılabilir.
- Studio profilleri, canlı klip işaretleri ve sistem genelinde Ctrl+Alt+R/L
  kısayolları eklendi.
- Çalışma alanı yedeği, yayıncı denge sayacı, etkileşimli hikâye, eşik tabanlı
  bildirim, HTML overlay, yerel ses panosu ve Insider tercihi çalışan yerel
  çalışma ekranlarıdır.
- İçerik dönüştürücü yalnız doğrulanmış kullanıcı özetini yeniden düzenler;
  konuşma koçu seçilen sesi sunucuya göndermeden sessizlik ve konuşma bloklarını
  ölçer. Geçiş paketi, çok boyutlu PNG rozet ve paylaşılabilir medya kiti yerel
  olarak dışa aktarılır.
- Site ürün ekranı 0.3.0 Windows kurucusunu doğrudan indirir; `app-final.js`
  önbellek sürümü 4.25'e yükseltildi.
- `wrangler.play-streamers.jsonc`, canlı Worker'ın mevcut KV, D1, OAuth istemci
  kimlikleri, özel alan adı ve dakikalık cron bağlarını koruyan dağıtım
  yapılandırmasıdır.
- `0010_desktop_platform.sql` 22 Ağustos 2026 tarihinde yedek alınarak canlı
  `play-streamers-users` D1 veritabanına uygulandı. Yedek yalnız yerel
  `tmp/play-streamers-users-pre-0010.sql` dosyasındadır; dört `ps_*` tablosu ve
  `users.sw_identity_user_id` alanı canlıda ayrıca doğrulandı.
- SW Identity ile Play Streamers Worker arasında ortak ürün SSO secret'ı yalnız
  Cloudflare secret kasasına kaydedildi. SW Identity canlı Worker sürümü
  `f79a15cf-8a12-4e82-a3d3-7172c442db2a`, Workers AI binding'i eklenmiş Play
  Streamers API canlı Worker sürümü `d726202b-3553-4d05-ae68-8494043dac4c`
  kimliğini taşır. Sağlık, AI binding, oturumsuz 401 koruması ve Tauri CORS
  yanıtı dağıtım sonrasında doğrulandı.
- 0.3.0 site paketi ve Windows kurucusu GitHub `main` dalına `a259ce2` commit'iyle
  gönderildi; `v0.3.0` önizleme sürümü oluşturuldu ve Pages için HTTPS zorunlu
  hale getirildi.

## Masaüstü önizleme 0.3.1 · 22 Ağustos 2026

- Tauri updater ve process eklentileri uygulamaya bağlandı. Uygulama açılışta
  HTTPS manifestini sessizce denetler; yeni sürüm varsa üst çubukta gösterir,
  kurucuyu indirir, minisign imzasını doğrular ve pasif Windows kurulumu
  sonrasında uygulamayı yeniden başlatır.
- Updater açık anahtarı uygulama yapılandırmasındadır. Parola korumalı özel
  anahtar proje ve GitHub dışında, yalnız mevcut Windows kullanıcısına açık
  yerel imza klasöründedir; parolası Windows DPAPI ile korunur. Kaybolursa eski
  kurulumlara aynı güncelleme zincirinden yeni sürüm gönderilemeyeceği için
  güvenli yedeği operasyonel zorunluluktur.
- `build-signed-update.ps1` üretim derlemesinde anahtarı yalnız süreç belleğine
  alır; kurucu ve `.sig` dosyasını yayın klasörüne taşır.
  `create-update-manifest.ps1` Tauri'nin statik manifest biçimini üretir.
- `updater_signature.rs`, yayınlanan Windows kurucusunu uygulamadaki açık
  anahtar ve manifestteki imzayla gerçek dosya üzerinde doğrular.
- Windows Authenticode/SmartScreen yayıncı güveni updater minisign imzasından
  ayrıdır. Güvenilir yayıncı adı için Microsoft Artifact Signing, Microsoft
  Store veya kimliği doğrulanmış bir CA sertifikası gerekir.
- Windows 11 sanal kamera `IMFVirtualCamera` ile tamamlandı. MIT lisanslı resmî
  Microsoft örneğinden uyarlanan Media Foundation kaynak DLL'i, Studio'nun
  1280×720 BGRA karelerini `Local\\PlayStreamersVirtualCameraFrameV1` adlı,
  sıralı paylaşımlı bellek protokolünden okur. Doğrudan indirmede DLL Program
  Files altına yönetici izniyle kurulur; Store/MSIX paketi COM sınıfını manifest
  üzerinden kaydeder. Windows 10 sanal kamera bilinçli olarak kapsam dışıdır.
- Store dağıtımı için `build-store-msix.ps1`, Partner Center'daki Identity Name
  ve Publisher değerleriyle imzasız x64 MSIX üretir. Store sertifikasyon sonrası
  MSIX'i ücretsiz Microsoft sertifikasıyla yeniden imzalar; NSIS doğrudan indirme
  kanalı mevcut minisign güncelleme zincirini kullanmaya devam eder.
- Play Streamers Partner Center ürünü `Switly.PlayStreamers` paket kimliği ve
  `9NWZ0TF5K999` Store ID değeriyle 22 Ağustos 2026'da oluşturuldu. Publisher
  değeri `CN=C7E10994-8739-4CF7-9F8C-2F23700A5BDC`, görünen yayıncı adı
  `Switly` olarak kullanılır.
- Store dağıtımı x64 için iki sıralı paket kullanır. Güncel `0.11.1.0` paketi Windows
  10 2004 (`10.0.19041`) ve sonrasında Studio, yayın ve kayıt özelliklerini
  sunar ancak Windows 11'e özel COM sanal kamera kaydını içermez. `0.11.2.0`
  paketi Windows 11 (`10.0.22000`) ve sonrasında aynı uygulamayı sanal kamera
  kaydıyla sunar. Uygulama ayrıca işletim sistemi derlemesini yerelde denetler;
  Windows 10'da sanal kamera yöneticisini çalıştırmaz.
  Güncel paketlerde dahili sürümler `0.11.1.0` (Windows 10) ve `0.11.2.0`
  (Windows 11), kullanıcıya gösterilen ürün sürümü ise her ikisinde de `0.11.0`'dır.
  Farklı MSIX numaraları aynı x64 mimarisindeki iki paketin Store tarafından
  ayırt edilmesi ve doğru işletim sistemine sıralanması içindir.

Desktop 0.6.0: Ana görüntü kaynağına dört yönlü kırpma eklendi. Kayıt veya yayın
sırasında aynı FFmpeg kodlama akışından beslenen 15, 30, 60 veya 120 saniyelik
döngüsel replay buffer son tamamlanmış parçaları cihazda tutar; Ctrl + Alt + B
ile ayrı MKV dosyasına kaydeder. Replay medyası buluta eşitlenmez. Rust motoru
18 test içerir; 17 test geçer, yalnız kurulu Windows 11 sanal kamera bileşeni
gerektiren fiziksel test CI/yerel cihaz dışı koşullarda atlanır.

Desktop 0.7.0: Sabit yazı/görsel alanı, eski sahneleri otomatik dönüştüren
sıralanabilir kaynak yığınına genişletildi. Her görüntü sahnesi 12 ek yazı,
PNG/JPG/WebP görsel, döngüsel MP4/MKV/MOV/WebM/M4V/AVI medya veya renk alanı
taşıyabilir. Kaynaklar eklenebilir, adlandırılabilir, gizlenebilir, silinebilir,
yeniden sıralanabilir; boyut, konum ve opaklıkları değiştirilebilir. Aynı sıra
kayıt, yayın, program önizlemesi ve Windows 11 sanal kamera grafiğine gider.
Rust motorunda 20 test bulunur; gerçek yerel medya bileşimi dahil 19 test geçer,
yalnız kurulu Windows 11 sanal kamera bileşeni gerektiren fiziksel test atlanır.

Desktop 0.8.0: OBS Studio Mode yaklaşımındaki Önizleme ve Program durumları
ayrıldı. Sahne listesinde yapılan seçim yalnız Önizleme kanalını değiştirir;
kayıt, yayın ve sanal kameranın paylaştığı Program çıkışı tek `Programa al`
eylemiyle güncellenir. Kesme veya 150–800 ms siyaha kararma yalnız Program
portlarına uygulanır; FFmpeg önizleme grafiği kendi 5557 komut kanalında kalır.
Rust motoru 21 test içerir; kaynak sırası ve gerçek medya bileşimi yanında
Program/Önizleme komut yalıtımı da doğrulanır. 20 test geçer, yalnız kurulu
Windows 11 sanal kamera bileşeni gerektiren fiziksel test atlanır.

Desktop 0.9.0: Program grafiğine ikinci hedef sahne seçicisi ve komutla
değiştirilen alfa katmanı eklendi. Yumuşak geçiş hedef sahneyi `scene_next`
seçicisine alır, 10 adımda gerçek crossfade uygular, ardından ana Program
seçicisine devredip geçiş katmanını sıfırlar. Aynı akış kayıt/yayın portu 5555
ve sanal kamera portu 5556 üzerinde çalışır; hata halinde alfa sıfırlanarak eski
Program görüntüsü korunur. Kesme ve siyaha kararma seçenekleri değişmeden kalır.
Gerçek FFmpeg duman testi crossfade, cut, fade ve ses komutlarını aynı çalışan
grafikte doğrular.

Desktop 0.10.0: Her yazı, görsel, döngüsel yerel medya ve renk kaynağı FFmpeg
grafiğinde kendine ait adlandırılmış alfa filtresiyle kalıcı tutulur. Kayıt,
yayın, bağımsız Önizleme veya Windows 11 sanal kamera çalışırken kaynak
görünürlüğü ve opaklığı ZMQ komutuyla değiştirilir; kodlayıcı ve yakalama
süreçleri yeniden başlamaz. Başlangıçta gizli fakat geçerli yerel dosyalar da
canlı açılabilmeleri için grafiğe yüklenir; kayıp gizli dosya yayını engellemez.
Aynı kaynak komutu etkin Program, sanal kamera ve Önizleme portlarına ayrı ayrı
uygulanır. Gerçek FFmpeg duman testi kaynak alfa komutunu crossfade, fade, cut
ve ses komutlarıyla aynı çalışan grafikte doğrular.

Desktop 0.11.0: Aynı H.264/AAC kodlama akışı birincil ve ikincil güvenli RTMPS
hedefine FFmpeg tee çıkışıyla eşzamanlı gönderilir; hedefler ayrı doğrulanır ve
iki yayın anahtarı da yalnız Windows Credential Manager'da saklanır. Studio
projesi 32 sahne ve sahne başına 64 ek kaynak taşıyabilir. Yayın/kayıt
dışındayken görünür ek kaynaklar Önizleme tuvalinde fareyle sürüklenerek
konumlandırılır. FFmpeg çocuk sürecinin işlemci zamanı Windows süreç
telemetrisiyle ölçülür ve Studio sağlık kartında gösterilir. Rust motorunda 22
testin 21'i geçer; yalnız kurulu Windows 11 sanal kamera isteyen fiziksel test
atlanır.

Sürüm 4.20: Saatlik Kick takipçi/abone ölçümü bütün hesapları kilitleyen tek
cron işaretinden çıkarıldı. Worker artık her hesabın ilgili saat satırını ayrı
denetler; tamamlanmayan hesap bir sonraki cron turunda yeniden denenir ve site
açık değilken de veri birikmeye devam eder. İkinci ana sayfadaki tekrarlı canlı
kart/yardımcı bölüm çizimleri sınırlandı. Gizlilik Politikası bağlantısı genel
altlıklara ve üye menüsüne görünür biçimde eklendi.

Sürüm 4.19: TipeeeStream logosu görünür kart ve gerçek görsel yükleme üzerinden
denetlenir. Geçici DAB şablonunun ürettiği yanlış gömülü-logo uyarısı kaldırıldı
ve önceki sürümden kalan aynı uyarı Play Bot çıktısından temizlendi.

Sürüm 4.18: TipeeeStream DAB logosunun Play Bot denetimi, gömülü görsel
sözleşmesini doğrular. Logo yedekleri DOM'dan kaldırılmış olsa bile görsel hata
akışı artık boş bir öğenin `hidden` alanına yazmaya çalışmaz.

Sürüm 4.17: Canlı site verilerindeki sayaçlar yeni veri geldiğinde ekranda
görünen sayıdan devam eder, aynı hedef için animasyonu yeniden başlatmaz ve
birden fazla tarayıcı sekmesinden geç gelen eski yanıtlarla geriye dönmez.
Sekmeler ortak, kısa süreli bir istek kilidi kullanır.

Sürüm 4.15: TipeeeStream DAB kartındaki resmî gömülü logo tek görüntü
katmanına alındı. Eski `TI` metin yedeği karttan kaldırıldı ve Play Bot bu
yedeğin yeniden eklenmesini kullanıcı Bağlantılar sayfasını açmasa da denetler.

## Güncel canlı kontrol aralıkları

- Sürüm 4.14 ile TipeeeStream DAB kartı resmî gömülü logo kaynağına taşındı;
  Play Bot'un ayrı GitHub görseli eksik olduğunda ürettiği iki yanlış uyarı
  kaldırıldı. Worker'ın zamanlanmış sağlık denetimi artık kendi API alan adına
  geri dönüp 522 üretmek yerine doğrudan D1 bağlantısını doğruluyor.
- Sürüm 4.13 ile 24 saatlik Kick grafiği, Hesabım ve 90 günlük grafik
  katmanlarından bağımsız, ortalanmış bir viewport penceresine taşındı.
  TipeeeStream DAB kartı gömülü resmî görseli birinci kaynak olarak kullanır;
  Play Bot bağlantılar ekranını kullanıcı açmasa bile aynı kart şablonunu
  bellekte üretip logo ve sağlayıcı sözleşmelerini denetler. Worker taraması
  ayrıca logo dosyasının geçerli ve yeterli boyutta bir PNG olduğunu doğrular.
- Sürüm 4.12 ile ikinci ana sayfa ve Dashboard dünya/durum düğmelerinin yanı
  sıra yayıncı istatistiği kartlarında hit alanını değiştiren genel hover
  dönüşümleri yüksek öncelikli sabit geometri kuralıyla kapatıldı. Dashboard
  sıfırlama düğmesi tek DOM öğesi olarak aktif sekmenin `panel`/`stats`
  kapsamını taşır. Günlük Kick sütununa tıklanınca açılan 24 saatlik pencere her
  defasında en üst katmana alınır. Play Bot'un Worker kaynak denetimi ile gerçek
  tarayıcı DOM/geometri denetimi artık birbirinin alternatifi değil, birleşik
  sonuç üretir. DAB kartı için TipeeeStream'in resmî kare simgesi kullanılır ve
  bozuk görselin altında eski `TI` metin yedeği gösterilmez.
- Sürüm 4.10 ile açık dil/durum/menü/bildirim yüzeyleri tarayıcı boyutu veya
  yerleşim değiştiğinde tetikleyicilerine yeniden bağlanır. Aktif abone alanı
  veri yoksa `0` gösterir; devam eden İstanbul günü 90 günlük grafiğe alınmaz ve
  günlük sütun 24 saatlik ayrıntıyı tek tıklamayla açar. Play Bot'un Worker Cron
  denetimi kullanıcı sayfayı açmasa da canlı HTML/JS/CSS, API sağlık yanıtı,
  bayraklar, TipeeeStream logosu ve kritik arayüz sözleşmelerini ortak D1 durumuna
  yazar. Gerçek tarayıcı tıklamaları ve oturum gerektiren sayfalar için ayrıca
  Browser Rendering ya da harici sentetik tarayıcı çalıştırıcısı gerekir.
- Ortak Play Bot durumu henüz oluşmamışsa ilk durum isteği Worker taramasını
  otomatik başlatır; böylece farklı kullanıcılar ve farklı sayfalar aynı global
  sorun listesini görür. Eski arayüz katmanında kaldırılmış metin alanlarına
  yazılmasını önleyen güvenli DOM kontrolleri ana betiğe eklendi.
- Sürüm 4.4 ile canlı sayaçların her metin değişiminde bütün arayüzü yeniden
  onarmasına yol açan MutationObserver döngüsü sınırlandırıldı. Google sosyal
  düğmesi ve Kick düğmesi yalnız gerçekten bozulduğunda yeniden kurulur; dil,
  durum, güncelleme ve hesap yüzeylerinin kendi canlı değişimleri genel onarımı
  tetiklemez. Play Bot görünür kullanıcı akışlarını (Google işareti, bayraklar,
  DAB TipeeeStream logosu, aktif abone alanı, güncelleme işareti ve Dashboard
  sıfırlama bağlamı) açık hata cümleleriyle denetler. Play Connect 1.10.3,
  merkezi DAB sağlayıcısı seçildiğinde sayfa gövdesinin boyutunu değiştirmez.
- Sürüm 3.9 ile Bağlantılar alanındaki doğrudan sağlayıcı OAuth bağlantıları
  `DAB` adıyla SSB'nin altına yerleştirildi. Kick resmi Public API toplam takipçi
  sayısını sunmadığından Worker, salt-okunur kanal özetini dener; bu kaynak
  erişilemezse arayüz Play Streamers'a ulaşmış doğrulanmış takip olaylarından
  bilinen değeri açıkça yedek değer olarak gösterir.
- Sürüm 3.8 ile görünür sayfadaki donate denetimi 1 saniye, Kick denetimi 3
  saniye, bildirim denetimi 3 saniye, bağlantı durumu 1–2 saniye, açık
  cihaz/konum ekranı 5 saniye, oturum doğrulaması 15 saniye ve canlı site
  verileri 10 saniye aralığına indirildi.
- Play Connect 1.9.7, eklenti uyanıkken olay kuyruğunu 750 ms, sayfa/alert
  değişikliklerini 500 ms ve bağlantı durumunu 1 saniye aralıkla denetler.
  Uzun süren tur bitmeden yeni tur başlatılmaz; böylece yinelenen istek oluşmaz.
- Cloudflare Cron Trigger altyapısının en kısa desteklenen aralığı 1 dakikadır.
  Güvenlik oran sınırları, oturum ömürleri ve OAuth yenileme kuralları
  hızlandırma amacıyla değiştirilmez.

## Ürün özeti

Play Streamers, öncelikle Kick yayıncıları için kişisel yayıncı paneli/web
uygulamasıdır. Amaç; yayıncının kendi Kick kanalındaki abonelik, hediye
abonelik, Kicks ve yayın durumunu tek panelde göstermektir. İleride bağış
platformları çoklu hesap mantığıyla eklenebilmeli; olay akışı, istatistikler ve
bağlantı durumları sade ama güçlü bir arayüzde sunulmalıdır.

- Hedef kullanıcı: Türkçe odaklı Kick yayıncıları; ileride çoklu dil desteği.
- Marka: **Play Streamers**.
- Geliştirici/alt marka: **SW CREATE**.
- Ana alan adı: `https://pstreamers.com`.
- API alan adı: `https://api.pstreamers.com`.

## Marka ve tasarım dili

- Koyu, modern, yayıncılık ve teknoloji hissi veren arayüz.
- Lacivert/siyaha yakın zemin; Kick yeşili ana vurgu (`#53fc18` civarı).
- Yardımcı renkler: mor, cyan, turuncu/amber ve pembe.
- Saydam/bulanık cam kartlar, ince neon sınırlar, yumuşak gölgeler, yuvarlak
  köşeler, yumuşak geçiş ve hover efektleri.
- Font yaklaşımı: Plus Jakarta Sans ve Space Grotesk gibi modern, okunaklı
  yazı tipleri.
- PS logosu: siyah zemin üzerinde Kick yeşili, hafif eğik/karakterli “PS”.
- Her sayfanın footer'ında şu metin görünür:
  - `Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç`
  - `Developed by SW CREATE`
- SW CREATE bağlantısı: `https://guns.lol/switly`.

## Sayfalar ve etkileşimler

### Ziyaretçi anasayfası

- Sol üstte PS logosu ve `PLAY STREAMERS`; sağda dil/dünya, sistem durumu,
  Giriş yap ve Kayıt ol kontrolleri vardır.
- Hareketli sürüm/duyuru bandı; ürünün canlı yayın/topluluk paneli olduğunu
  açıklayan hero alanı ve örnek canlı panel kartı bulunur.
- `Hakkımızda`, `Ürünlerimiz`, `Nasıl çalışır?` sekmeleri ziyaretçi ana
  sayfasının dünya görselli sahnesi ve üst navigasyonu üzerinde sağa doğru kayan
  bilgi katmanını açar; ortak ziyaretçi alt bilgisi bu katmanda da korunur.
- `01 Akış`, `02 Güven`, `03 Topluluk` bilgi kartları tıklanabilirdir.
- Giriş/kayıt modalları animasyonlu açılıp kapanır. Ziyaretçi giriş/kayıt
  ekranında güncel Google işareti ve Kick düğmesi aynı satırda gösterilir.
  Bilgi sayfalarında açılan giriş/kayıt penceresi kullanıcıyı birinci ana
  sayfaya geri atmaz. Oturum açmış kullanıcının ayrıca Hesabım > Bağlantılar
  üzerinden kurduğu Kick kanal bağlantısı bu sosyal girişten ayrı tutulur.
  Parola alanlarında standart göz ikonu kullanılır.
- Birinci ve ikinci ana sayfada toplam tekil ziyaretçi, tamamlanmış kayıtlı
  hesap ve son iki dakikada aktif olan tekil ziyaretçi/hesap değerlerini
  gösteren ortak canlı sayaç kartı vardır. Ziyaretçi ana sayfasında kart üst
  menüdeki Giriş yap/Kayıt ol grubunun, üye ana sayfasında Dashboard grubunun
  hemen altında; iki yüzeyde de aynı genişlikte, büyük ve yatay olarak
  ortalanmış biçimde durur.
- Kayıt formu: kullanıcı adı, parola, parola tekrarı ve doğum tarihi. İlk
  formda e-posta alanı yoktur; 18 yaş altı kayıt olamaz.
- Dil seçimi çoklu dil altyapısı üzerinden çalışmalıdır.

### Giriş sonrası anasayfa

- Dashboard yerine kullanıcının ilk gördüğü kişisel karşılama sayfasıdır.
- Sağda bağlantı durumu/Wi-Fi, Dashboard ve menü düğmeleri vardır.
- Ana karşılama alanındaki eski “Hesap bağlılığı” kutusu kaldırılmıştır; yerine
  hazırlık, canlı akış ve topluluk okumasını anlatan yayıncı çalışma akışı gelir.
  Gerçek bağlantı durumu yalnızca Wi-Fi düğmesinin açılır penceresinde gösterilir.
- “Hoş geldin, kullanıcıadı” ve “Yayın senin. Kontrol sende.” tarzı güçlü bir
  başlık bulunur.
- `Neler yeni?` sürüm notlarını ve ok düğmesiyle ayrıntılarını sunar.
- `Neler sunuyoruz?`: Canlı Dashboard, İstatistikler, Bağlantılar.
- `Neleri geliştiriyoruz?` her güncellemede gelecek hedefleri gösterir.
- Ziyaretçi anasayfasıyla aynı footer kullanılır. Dashboard geçişinde markaya
  özel yükleme ekranı görünür.

### Dashboard

- Sol üstteki Play Streamers logosu giriş sonrası anasayfaya döner.
- Yayıncı paneli kartları: 1 Aylık Abone, 2+ Aylık Abone, Hediye Abonelik,
  Kicks, Donate.
- Yayıncı istatistikleri kartları: Bu Ay Aramıza Katılanlar, Top Aboneler,
  Hediye Abonelikler, Kicks Gönderenler, Donate Gönderenler.
- Panelden istatistiklere geçiş sağa, ters yön sola kayar.
- Kartlar büyütülebilir; büyüyen kart simge ve içerik dilini korur, kapatması
  animasyonludur.
- Bağlantı durumu ve menü, düğmelerinin hemen altından sağa doğru açılır.
- Menü: Hesabım, Güncelleme notları, Ürünlerimiz, Çıkış yap.
- Yayın açık/kapalı ve sıfırlama denetimleri kompakt kalmalıdır.
- Yayıncı Paneli/Yayıncı İstatistikleri sekme çubuğu üstte, yayın durumu ve
  Sıfırla çubuğu onun hemen altında yer alır.
- Eksik render edilen Dashboard kartlarını oluşturmaya çalışan mevcut onarım
  davranışını koru veya iyileştir.

## Hesap ve güvenlik davranışları

- Desteklenen yöntemler: kullanıcı adı + parola, Google OAuth, Kick OAuth.
- Kullanıcı adı ve e-posta benzersizdir; kullanıcı adında büyük harf olabilir;
  sakıncalı adlar ve türevleri engellenir.
- Parolalar PBKDF2 ile hashlenir.
- Kullanıcı adı 60 günde bir, e-posta ve parola 90 günde bir değiştirilebilir.
- Hesap silme, parola sıfırlama ve e-posta bağlama/değiştirme e-posta doğrulama
  kodu ile yapılır.
- Kod yaklaşık 10 dakika geçerli; yeniden gönderme düğmesi 40 saniye sonra
  kullanılabilir olur.
- “Beni hatırla” seçildiyse oturum en fazla 30 gün geri yüklenir. Seçilmezse
  oturum yalnızca mevcut tarayıcı oturumunda kullanılır; sonraki ziyarette
  istemci ve sunucu oturumu kapatılarak birinci ana sayfa gösterilir.
- Hesap tamamlama: kullanıcı adı, parola, parola tekrarı, doğum tarihi/18+
  kontrolü ve Çıkış yap. Bu sayfada Google/Kick sosyal düğmeleri görünmez.

## Teknik yapı

### Frontend

- Ana dosya: `index.html`.
- Framework kullanılmıyor; CSS ve JavaScript büyük oranda aynı HTML dosyasında.
- GitHub Pages üzerinden yayımlanıyor; eski adres:
  `https://switly01.github.io/Play-Streamers/`.
- Daha önce `type="text/plain"` ile dosyada tutulan çalışmayan güncelleme
  arşivleri 23 Temmuz 2026'da kaldırıldı. Çalışan tarihsel katmanlarda aynı
  işlevi yöneten kodlar hâlâ bulunabildiği için son arayüz katmanı tekil olay
  hedeflerini korumalıdır.
- Uzun vadeli hedef: davranış korunarak `index.html`, `styles.css`, `app.js`
  yapısına geçmek ve pasif eski katmanları temizlemektir.

### Backend

- Ana Worker dosyası: `cloudflare-worker.js`.
- Cloudflare Worker; Google/Kick OAuth, kullanıcı adı-parola kayıt/giriş,
  oturum doğrulama, e-posta kodları, parola sıfırlama, hesap silme/kullanıcı
  güncelleme, Kick webhook, Turnstile ve CORS yönetimini yürütür.
- Cloudflare D1; kullanıcılar, oturumlar, e-posta kodları ve güvenlik/hesap
  verilerini tutar. Eski KV kullanımından yeni kimlik kayıtları D1'e taşınma
  hedefindedir.
- Canlı site sayaçları D1'de ham tarayıcı kimliği yerine SHA-256 özeti tutar.
  Toplam ziyaretçi ölçümü bu özelliğin üretime alındığı andan itibaren başlar;
  eski trafik geriye dönük tahmin edilmez. Görünür sekme yaklaşık 30 saniyede
  bir tek birleşik istek gönderir, arka plan sekmeleri durur ve aynı tarayıcıdaki
  sekmeler önbellek/BroadcastChannel üzerinden sonucu paylaşır.
- Worker'da Workers KV binding'i veya KV okuma/yazma işlemi bulunmaz. Eski KV
  namespace binding'i, D1 kullanan Worker sürümü dağıtıldıktan sonra Cloudflare
  panelinden kaldırılmalıdır.
- Resend e-posta doğrulama, parola sıfırlama ve hesap silme bildirimlerinde;
  Google ve Kick OAuth giriş/kayıtta; Kick webhooks kanal/abonelik/hediye
  abonelik/Kicks/yayın durumunda kullanılır.
- Site içi destek formu da Resend üzerinden sabit
  `swcreate.info@gmail.com` alıcısına gider. Oturum açmış kullanıcıların destek
  konuşmaları D1'de kullanıcıya bağlı olarak saklanır; anonim taleplerde D1
  yalnızca saatlik kötüye kullanım sınırı için kimliği açığa çıkarmayan zaman
  kaydı tutar. Dosya seçimleri birbirini silmeden birikir;
  form en fazla 10 ek, dosya başına 10 MB ve ham dosyalarda toplam 25 MB kabul
  eder. Bu sınır, Base64 büyümesi sonrasında Resend'in 40 MB e-posta sınırının
  altında kalacak şekilde seçilmiştir. Gönderilen ve gelen eklerin ad/boyut
  bilgileri konuşmada görünür; Resend attachment kimliği olan dosyalar yalnızca
  talebin sahibi oturum açtığında Worker üzerinden indirilebilir. Turnstile
  kontrolü uygulanır.
- Destek konuşmalarındaki görsel ekler mesaj içinde önizlenir; diğer eklerle
  birlikte ayrı `EKLER` alanında indirme düğmesiyle gösterilir. Worker, Resend'in
  süresi sınırlı imzalı dosya adreslerini ve en fazla üç HTTPS yönlendirmesini
  her adımda özel/yerel ağ hedeflerini engelleyerek doğrular.
- Destek talepleri `failed`, `open` ve `answered` durumlarını sırasıyla
  Gönderilemedi, Yanıt bekliyor ve Yanıtlandı olarak gösterir. Arayüz bu
  durumları filtreler; yanıt bekleyen kayıtları Güncel, yanıtlanan veya
  gönderilemeyen kayıtları Eski talepler grubunda ayırır. Resend ek kimliği eski D1 kaydında
  eksikse saklanan e-posta kimliği, dosya adı ve boyutla sağlayıcı listesinden
  geriye dönük eşleştirme yapılır.
- Oturum açmış kullanıcılarda yeni destek yanıtı bildirimi,
  `/api/notifications/sync` üzerinden ETag kullanan hafif kontrolle sayfa
  yenilenmeden alınır. Kontrol yalnızca sekme görünür ve çevrimiçiyken yaklaşık
  sekiz saniyede bir çalışır; aynı tarayıcıdaki sekmeler BroadcastChannel ile
  birbirini yeniler.
- Güncelleme bildirimi frontend sabitine ek olarak Worker'daki
  `CURRENT_RELEASE_VERSION` ve yayın zamanını okur. Yeni sürümde hem Worker
  sabiti hem güncelleme geçmişinin ilk kaydı birlikte yükseltilmelidir.
- Bildirim okundu bilgisi kullanıcı kimliğine göre tarayıcıda saklanır. Çıkış
  yapmak bu kaydı silmez; kullanıcı bildirimi gerçekten açana kadar sonraki
  girişinde de okunmamış olarak kalır.

### Altyapı yapılandırması

- Turnstile site key frontend'de, secret yalnızca Worker secret'ta tutulur.
- Google Authenticator TOTP anahtarlarını D1'e yazmadan önce AES-GCM ile
  şifreleyen `TOTP_ENCRYPTION_KEY`, en az 32 karakterlik ayrı bir Worker secret
  olarak tutulur; hiçbir frontend dosyasına konulmaz.
- TOTP hesap endpoint'leri oturumla korunur ve Turnstile beklemez; Worker secret
  eksikse arayüze açık yapılandırma hatası döner. Frontend istekleri 12 saniyede
  sonlandırılarak kurulum ekranının süresiz beklemesi engellenir.
- Authenticator kurulumu önce QR veya kurulum anahtarı yöntemini seçtirir. QR,
  sürümü ve SRI bütünlük değeri sabitlenmiş `qrcode-generator` ile yalnızca
  tarayıcıda üretilir; kurulum anahtarı üçüncü bir QR servisine gönderilmez.
  QR kodu `H` hata düzeltme seviyesi kullanır ve ortasında taramayı engellemeyen,
  beyaz koruma alanıyla çevrelenmiş şeffaf SW CREATE logosu bulunur. CDN dosyasının
  SRI değeri gerçek 1.4.4 içeriğiyle
  eşleşmelidir; eşleşmezse tarayıcı QR üreticisini güvenlik nedeniyle engeller.
- Authenticator açıkken yedek kodlar yalnızca güncel Authenticator kodu veya
  kullanılmamış bir kurtarma koduyla yenilenir. Yenileme eski kodların tamamını
  geçersiz kılar ve yeni sekiz kodu yalnızca bir kez gösterir. Yenileme onayından
  sonra kod giriş penceresi hesap merkezinin üzerinde görünmeli; başarılı
  yanıtta sekiz kod eksiksiz gelmeden sonuç ekranına geçilmemelidir.
- Hesap merkezindeki kullanıcı adı, profil fotoğrafı, e-posta, şifre,
  Authenticator ve Kick bağlantısı değişiklikleri uygulanmadan önce ortak
  kaydetme/onay penceresi gösterir. Hesap silme kendi daha güçlü uyarı akışını
  kullanmayı sürdürür.
- Hassas endpoint'lerde Cloudflare rate limit yaklaşık `5 istek / 10 saniye`;
  ihlalde yaklaşık `10 saniye` engel vardır.
- CORS izinleri: `https://pstreamers.com`, `https://www.pstreamers.com` ve
  eski GitHub Pages origin'i.
- Custom Worker domain `api.pstreamers.com`; alan adı Cloudflare nameserver
  kullanır. Resend için SPF/DKIM/MX/TXT DNS kayıtları yapılandırılmıştır.
- Google OAuth: origin `https://pstreamers.com`, callback
  `https://api.pstreamers.com/auth/google/callback`.
- Kick OAuth callback: `https://api.pstreamers.com/auth/kick/callback`.
- Eski `workers.dev` yönlendirmeleri kullanılmamalıdır.

## Son bilinen durum ve dikkat noktaları

- Donate bağlantıları tek bir yönteme zorlanmaz. Katalogdaki 26 platformun her
  biri `provider-api`, `server-webhook` veya `alert-link` birincil
  yöntemlerinden birine ve yalnızca desteklediği güvenli yedeklere sahiptir.
  Streamlabs, StreamElements, TipeeeStream, DonationAlerts ve Pally.gg doğrudan
  API/canlı bağlantı; İtemSatış, Ko-fi ve Buy Me a Coffee kişisel sunucu bildirim
  adresi; kalan platformlar OBS/Alert Box bağlantısını kullanır. Sunucu bağlantısı
  aktifse eklenti aynı sağlayıcının yerel taramasını otomatik durdurur.
- Sunucu bildirim adresleri 48 baytlık rastgele değerle oluşturulur, Worker'da
  yalnızca SHA-256 özeti saklanır ve kullanıcı tarafından iptal edilebilir. Gelen
  olaylar mevcut `donate_bridge_events` tablosuna yazılır; aynı kullanıcı,
  platform ve platform olay kimliği D1 benzersizlik kuralıyla ikinci kez
  sayılmaz. Bu yapı `0006_donate_provider_webhooks.sql` migration'ını gerektirir.
- Platformların canlı hesap, ödeme ve webhook ayarları kullanıcı yetkisi olmadan
  uçtan uca doğrulanmış kabul edilmez. Kod testleri katalog/yöntem eşleşmesini,
  API yollarını, D1 tekilleştirmesini ve eklenti bağlantı durumunu doğrular;
  gerçek platform testi ilgili hesabın test donate/webhook aracıyla yapılır.

- Kullanıcı adı/e-posta + parola girişi Turnstile'a bağlandı; eski formların
  ikinci istek göndermesini engelleyen akış eklendi.
- “10 saniye bekle” mesajı yalnızca gerçek timeout durumunda gösterilmelidir.
- Başarılı kullanıcı adı girişi özel yükleme ekranıyla yönlendirilir.
- Dil/dünya simgesi giriş düğmesinin solunda olmalıdır.
- Ana sayfadaki sistem durumu kare, oval köşeli tek düğmeyle açılır; Hakkımızda,
  Ürünlerimiz ve Nasıl çalışır sayfaları birinci ana sayfanın arka planını,
  üst gezinmesini ve alt bilgi çubuğunu aynı ölçü/konumlarla yeniden kullanır.
  Destek kısayolu ekranın sol
  altında sabittir, birinci/ikinci ana sayfa ile Dashboard'da aynı ölçü ve
  konumda görünür ve giriş/kayıt penceresi açıldığında arka planla birlikte
  bulanıklaşır. Destek alıcısı değiştirilemeyen `swcreate.info@gmail.com`
  adresidir; oturumdaki e-posta varsa gönderen alanı da salt okunur doldurulur.
  Destek açıklamasının oku yazı kutusunun alt orta noktasından başlar ve destek
  düğmesinin sağ orta noktasının hemen dışında biter.
- İkinci ana sayfanın bağlantı simgesi, Gmail/e-posta ve Kick bağlantılarının
  yerel oturum durumunu birlikte okur; API polling eklemeden depolama, odak ve
  görünürlük değişimlerinde güncellenir.
- Güncelleme notları, çalışan eski kod katmanlarını geri getirmeden, yayınlanan
  sürümlerin tamamını geniş bir ve aşağı kaydırılabilir zaman çizelgesinde
  gösterir. Her sürüm ayrı ayrı büyütülüp daraltılabilir; son sürüm daha belirgin
  görünür ve dikey çizgi son kayda kadar devam eder.
- İkinci ana sayfadaki eski ek eylem ve hesap bağlılığı kartları kaldırılmıştır;
  yerine ürünün işlevini ve yayın öncesi/sırası/sonrası kullanımını anlatan
  tasarımla bütünleşik açıklama alanları kullanılır.
- Dashboard üst çubuğu kart/kutu görünümünde değildir; bağlantı simgesi ikinci
  ana sayfayla aynı bağlı/eksik Wi-Fi işaretini kullanır.
- Eksik Dashboard kartlarını yeniden oluşturmaya yönelik kontrol bulunur.
- Dashboard yayıncı paneli Takipçi kartıyla başlar ve altı kart üç sıra/iki
  sütun halinde şu sırayla dizilir: Takipçi + 1 Aylık Abone, 2+ Aylık Abone +
  Hediye Abonelik, Kicks + Donate.
  Yayıncı İstatistikleri bölümünde Yeni Katılanlar, Top Abone, Top Hediye
  Abonelik ve Top Kicks 2x2 dizilir; Top Donate aynı ölçüde altta ortalanır.
  Kart simgeleri normal ve büyütülmüş görünümde korunur; panel ve istatistik
  kartları aynı büyütülmüş kopya katmanını kullanır.
- Özel tooltip tek bir öğeye bağlı kalır; imleç hedefi terk ettiğinde, kaydırma,
  odak kaybı, görünürlük değişimi veya kısa güvenlik süresi sonunda kapanır.
  `pageshow`/`load` onarımı, art arda yenilemelerden kalabilecek geçici tooltip,
  kart büyütme ve açılır panel durumlarını temizler.
- Oturum geri yükleme isteği art arda yenileme, bağlantı kesintisi veya geçici
  rate limit nedeniyle tamamlanamazsa `ps15-session-pending` en geç 4,5 saniye
  içinde bırakılır. Bekleme sırasında boş arka plan yerine marka yükleyicisi
  gösterilir; eksik/eski yerel Dashboard veri şekli güvenli varsayılanlarla
  tamamlanır. Yükleyicinin kendisi çalışamazsa ziyaretçi ana sayfası son CSS
  katmanında görünür tutulur; yalnız arka plan gösteren bir durum oluşmaz.
- Normal tarayıcı profilinde eski oturum verisi bulunurken üye ana sayfası
  oluşmadan giriş ekranının kapatılması engellenir. Hedef ekran önce hazırlanır;
  hazırlanamazsa oturum verisi silinmeden ziyaretçi ana sayfası korunur.
- Yükleme veya sayfa geçişi sonrasında ana ekranların tamamı kapalı kalırsa
  görünür-yüzey kurtarması otomatik olarak ziyaretçi ana sayfasını geri getirir.
  Ortak yükleyici çalışırken ilk geçiş işlemi daha sonraki arayüz onarımlarıyla
  değiştirilemez; ilk açılış yükleyicisi de üye ana sayfası, Dashboard veya
  ziyaretçi ana sayfasından biri gerçekten hazır olmadan kapatılmaz.
- Hesabım, solda Veriler, Profil, Hesap, Bağlantılar ve Destek talepleri
  sırasıyla çalışan tek bir
  hesap merkezidir. İlk açılış Veriler'dir; nick/profil fotoğrafı Profil'de,
  e-posta/şifre Hesap'ta, Kick bağlama ve bağlantıyı kesme Bağlantılar'dadır.
  Gönderilen destek mesajları ve destek cevapları son sekmede konuşma olarak
  görünür. Hesap merkezinin açılışı/kapanışı ve bu sekmeler arasındaki geçişler
  animasyonludur; sekme değişiminde bütün katman yeniden oluşturulmaz.
- Ziyaretçi, OAuth dönüşü ve kayıtlı üye yenilemesi dahil bütün ilk açılışlar
  Dashboard geçişinde kullanılan ortak video yükleyicisini gösterir. Turnstile
  doğrulamasından ikinci ana sayfaya yönlendirme de aynı yükleyiciyi kullanır.
  Doğrulanmış giriş tek bir geçiş sahibi tarafından tamamlanır; eski gözlemci
  ikinci kez yükleyici başlatamaz ve üye ana sayfası hazırsa tam sayfa
  yenilemesi olmadan görünür hale getirilir.
- İkinci ana sayfa ile Dashboard arasında geçilirken açık menü, bağlantı paneli,
  dil/durum katmanı ve tooltip kapatılır. Üye menüsündeki Ürünlerimiz, ziyaretçi
  ana sayfasının tuşlarını veya arka planını taşımayan, geri dönüş düğmeli
  bağımsız ürün kopyasını açar. Bu kopyadaki yalnız ok biçimindeki geri dönüş
  düğmesi ve marka, ortak yükleyiciyle ikinci ana sayfaya döner.
- Dashboard ikonları ve kart büyütme düğmeleri yalnızca son onarım katmanı
  tarafından yönetilir. Büyütülmüş kart açıkken destek kısayolu aynı yerde
  bulanık ve etkileşimsiz kalır; Yayıncı İstatistikleri kartlarının tamamı
  klavye veya fareyle açılabilir ve tek kapatma/büyütme düğmesi kullanır.
- Ziyaretçi bilgi sayfaları ana sayfanın çerçevesini korur. Ortak üst çubuk
  kutu içindedir; dil, sistem durumu, giriş ve kayıt kontrolleri bilgi sayfası
  kapanırken doğrudan ziyaretçi hesap akışını açar. Bilgi sayfasındaki marka,
  ana ziyaretçi yüzeyini geri yükleyerek boş ekran oluşturmadan ana sayfaya
  döner. Ürünler sayfası eski ürün metinleri yerine "Yakında"
  durumundaki abonelik sistemini ve Sitelerimiz alanını gösterir. Hakkımızda
  SW CREATE'in marka kimliğini, üretim kültürünü ve gelecek yaklaşımını;
  Nasıl çalışır ise oturum, Turnstile, OAuth ve veri
  ayrımı güvenliğini anlatır. Sabit destek kısayolu bu sayfalarda da görünürdür.
- Hesap merkezinin Veriler sekmesinde bağlı Kick hesabının kullanıcı adı ve resmi,
  işlenen takip/abonelik olaylarından türetilen Aktif takipçi, Aktif abone ve
  Bu ay takip eden özetleri bulunur. Ortalama izleyici özelliği ve örnekleme
  kaydı kullanılmaz. İlk iki kart üst sırada, Bu ay takip eden kartı aynı
  büyüklükte alt sıranın ortasındadır. Kartların büyütme düğmesi son üç aylık
  Kick olaylarından oluşturulan aylık grafiği açar.
  Hesap merkezi açıkken arka sayfa
  kaymaz; iç kaydırma çubuğu Play Streamers tasarımını kullanır.
- Kick kullanıcı profili resmi resmi `/public/v1/users` yanıtından Worker
  tarafında alınır ve oturum hesabında saklanır. Eski oturumlarda eksik profil
  alanı en fazla günde bir kez yenilenir; gizli anahtar veya erişim tokenı
  frontend'e aktarılmaz.
- Dashboard Sıfırla işlemi yalnızca Yayıncı Paneli olaylarını ve toplamlarını
  temizler; kullanıcı oturumu, hesap bağlantıları ve Yayıncı İstatistikleri
  korunur. İşlem ortak yükleyici üzerinden ikinci ana sayfaya döner.
- Site hesabı açıkken Kick bağlantısı `connection` OAuth amacıyla başlatılır ve
  mevcut kullanıcıya bağlanır; yeni hesap/profil tamamlama akışı açılmaz.
- Hesap silme, e-posta koduyla son kez doğrulandıktan sonra kullanıcıyı,
  oturumlarını, bağlı Kick oturum/olaylarını ve destek taleplerini D1'den siler.
- E-posta veya parola değişikliği tamamlandığında eski oturum sürümü iptal edilir;
  doğrulama kodunu tamamlayan tarayıcı için yeni bir oturum oluşturulur.
- Destek talepleri D1'de `support_tickets` ve `support_messages` tablolarında
  tutulur. Resend Inbound için `SUPPORT_INBOUND_DOMAIN` ve
  `RESEND_WEBHOOK_SECRET` tanımlanıp `/api/webhooks/resend` için
  `email.received` webhook'u açıldığında, izinli destek gönderenlerinden gelen
  cevaplar talebe gerçek zamanlı eklenir. İstemci görünürken en fazla 60 saniye
  aralıkla ve sekmeye geri dönüldüğünde yeniler; sürekli kısa polling yapmaz.
- İkinci ana sayfa ve Dashboard'da Wi-Fi simgesinin solundaki bildirim merkezi,
  okunmamış son sürümü güncelleme notlarına ve yeni destek cevabını Destek
  talepleri sekmesine yönlendirir. Okundu bilgisi kullanıcıya göre yerelde
  tutulur ve çıkış sırasında silinmez.
- Başarılı destek gönderimi de anında "Destek talebiniz gönderildi" bildirimi
  üretir. Resend ile gönderilen e-postanın SMTP From adresi doğrulanmış
  `pstreamers.com` alanında kalır; kullanıcı adı ve kayıtlı e-posta, Gmail'de
  görünen gönderici adında ve mesaj içeriğinde belirtilir.
- Hesap içi destek cevaplarında Gmail'in eklediği eski konuşma alıntısı
  gösterilmez; yalnızca destek ekibinin yeni mesajı ve gönderim tarihi/saati
  görünür. Ziyaretçi ana sayfasından oturumsuz gönderilen mesajlar hesap içi
  talep veya bildirim oluşturmaz; destek ekibinin e-posta yanıtı ziyaretçinin
  forma yazdığı adrese doğrudan gider. Başarılı gönderim ekranı ziyaretçiye
  yanıt için kendi e-postasını kontrol etmesini açıkça söyler.
- Resend üzerinden gönderilen doğrulama, destek ve hesap silme e-postalarının
  tamamı aynı Play Streamers e-posta şablonunu kullanır. Güncel PS logosunun
  96×96 e-posta kopyası `play-streamers-email-logo.png` dosyasında tutulur ve
  e-postaya Content-ID ile gömülür; bu nedenle dış görsel izni beklenirken kırık
  görsel oluşmaz. Gmail kişi fotoğrafı Resend tarafından taşınmaz; gelen kutusu
  avatarı için ayrıca alan adı düzeyinde BIMI/DMARC kurulumu gerekir.
- Hesap merkezinin Hesap sekmesinde Google Authenticator uyumlu TOTP tabanlı iki
  adımlı doğrulama açılıp kapatılabilir. Kurulum, Base32 anahtar ve `otpauth://`
  bağlantısı verir; doğrulamadan sonra sekiz tek kullanımlık kurtarma kodu
  gösterir. Açık olduğunda kullanıcı adı/e-posta ve parola, Google OAuth ya da
  Kick OAuth ile yapılan yeni oturum açılışları 6 haneli Authenticator veya
  kurtarma kodu tamamlanmadan kullanıcı oturumu oluşturmaz. Kullanılmış
  TOTP sayacı ve kurtarma kodları tekrar kabul edilmez; ayar değişikliği eski
  oturumları iptal edip işlemi tamamlayan tarayıcıya yeni oturum verir.
- Authenticator açıkken Hesap sekmesindeki `Yedek kodları yenile` işlemi güncel
  6 haneli TOTP kodu veya kullanılmamış bir kurtarma koduyla doğrulanır. Eski
  kodların düz metni saklanmadığı için tekrar gösterilmez; yenileme tüm eski
  kodları geçersiz kılar ve yalnızca o anda sekiz yeni kodu bir kez gösterir.
- Dashboard Sıfırla düğmesi yayın açık/kapalı durum çubuğunun en sağındadır.
  Üye Ürünlerimiz kopyası bilgi katmanından daha yüksek ortak yükleyiciyle
  ikinci ana sayfaya döner.
- `schema:play-streamers-users:v14` geçişi, tüm kullanıcıların kullanıcı adı,
  e-posta ve parola değişim sayaçlarını dağıtım sonrası ilk D1 hazırlığında bir
  defaya mahsus sıfırlar.
- Kick webhook abonelik sürümü 2'dir ve `channel.followed` olayını kapsar.
  Dashboard olayları aktif Kick yayıncı kimliğine göre ayrılır; farklı hesaba
  geçildiğinde görünüm temizlenip o yayıncının D1'de korunan olayları yüklenir.
- `index.html` içinde, diğer eski arayüz katmanlarından önce çalışan
  `ps-request-governor` bulunur. Aynı kullanıcı oturumu için eşzamanlı
  `/api/auth/session` çağrılarını beş dakika, `/health` çağrılarını bir dakika
  boyunca tarayıcıda paylaşır; böylece çoklu eski katmanlar gereksiz Worker
  çağrısı oluşturmaz.
- Kick olay senkronizasyonu yalnızca görünür Dashboard'da çalışır ve iki
  dakikalık aralığını korur; canlı olayların gereksiz gecikmemesi için bu
  aralık daha da yükseltilmemelidir.
- Son arayüz güncellemesinin canlıya yansıması için `index.html` frontend'e
  gönderilmelidir. Doğrulama ekranındaki gömülü favicon da değiştiği için aynı
  sürümde `cloudflare-worker.js` ayrıca Deploy edilmelidir.
- Art arda giriş denemeleri rate limit nedeniyle kısa süreli engellenebilir.
- Turnstile başarı mesajı olup giriş olmuyorsa site/secret key eşleşmesi ve
  Worker dağıtımı kontrol edilmelidir.
- Gerçek Dashboard verileri için Kick OAuth ve webhooks gerçek hesapta test
  edilmelidir.
- ByNoGame Listing Token, bağış/event verisi için yeterli olmayabilir; gerçek
  olaylar için yayıncı/merchant/event API veya webhook erişimi gerekebilir.
- Worker çağrıları geçmişte hızlı artmıştır. Gereksiz polling ve sürekli çalışan
  eski JavaScript katmanlarını zamanla güvenle temizlemek önceliklidir.

## Donate Bridge masaüstü uygulaması

- API veya webhook vermeyen donate siteleri için e-posta tabanlı aktarım
  kullanılmayacaktır. Yerel Windows uygulaması, yayıncının kendi bilgisayarında
  arka planda çalışan görünmeyen takip oturumunu kullanır.
- İlk masaüstü ürün yalnızca donate verilerini toplayan **Play Streamers Donate
  Bridge** uygulamasıdır ve `donate-bridge/` klasöründe bulunur.
- Sağlayıcı adları kodda sabitlenmez. Kullanıcı istediği siteyi ekler; OBS/alert
  bağlantısı varsa canlı bildirim alanını, yoksa giriş sonrası işlem geçmişi veya
  son destekler sayfasını görsel alan seçimiyle uygulamaya öğretir. Sağlayıcı
  tanımları çerez ve parola içermeyen JSON şablonu olarak içe/dışa aktarılabilir.
- Her site, kendine özel kalıcı Electron oturum bölümünde çalışır. Platform
  parolası, çerezi veya özel takip bağlantısı Play Streamers sunucusuna
  gönderilmez. Uzak sayfalarda Node.js ve dosya sistemi erişimi kapalıdır.
- Takip penceresinin ekranda veya normal tarayıcı sekmesinde açık olması gerekmez;
  Electron penceresi gizli kalır ve `backgroundThrottling` kapalı biçimde sistem
  tepsisinde çalışır. Bilgisayar kapalı veya uyku durumundayken API/webhook
  olmadığı için olay alınamaz.
- Algılanan olaylar ortak sağlayıcı/tutar/para birimi/mesaj/zaman biçimine
  dönüştürülür, tekrar kimlikleriyle yerelde tekilleştirilir ve teslim edilene
  kadar yerel kuyrukta tutulur. Tek kullanımlık eşleştirme kodu ve cihaz anahtarı
  endpoint'leri tamamlanmıştır; cihaz anahtarının yalnızca özeti D1'de tutulur.

## Play Connect Chrome eklentisi

- Kullanıcıya önerilen birincil donate bağlantısı
  `play-streamers-donate-extension/` içindeki
  Manifest V3 Chrome eklentisidir. Kurulabilir paket kökteki
  `play-connect.zip` dosyasıdır. Eski indirme adı yalnızca geçiş uyumluluğu
  için aynı paketle güncel tutulur.
- Eklentinin ana ekranında ByNoGame, Klasgame, Streamlabs ve StreamElements yer
  alır. `Diğerleri` altında Pindirim, Oyunfor, İtemSatış, Oyuneks,
  Hesap.com.tr, Dijipin, EPİN, İnovapin, Ko-fi, Buy Me a Coffee,
  TipeeeStream, DonationAlerts, Pally.gg, Streamloots, DeStream, LivePix,
  Saweria, Trakteer, SociaBuzz, Tipply, Toonation ve Doneru listelenir. Katalog
  yalnız yayıncıya doğrudan destek aktaran canlı yayın servislerinden oluşur. Her sağlayıcı paket
  içindeki kendi görsel ikonuyla gösterilir; popup ve ayarlar ekranlarında ad
  veya bölgeye göre arama yapılabilir.
- API sunmayan sağlayıcılarda birincil kurulum adımı yayıncı panelinden alınan
  OBS Browser Source / Alert Box / Overlay bağlantısını eklemektir. Bağlantı
  platformun kendi alan adında veya Streamlabs/StreamElements üzerinde olabilir;
  alan adı otomatik tanınır. OBS bağlantısı görünmeyen Chrome offscreen belgesinde
  çalışır ve kullanıcıya platform sekmesi açılmaz.
- Streamlabs bağlantısı donation API'siyle; StreamElements bağlantısı
  JWT/kanal kimliği ve `channel.tips` WebSocket konusuyla; TipeeeStream
  bağlantısı Events API'siyle; DonationAlerts bağlantısı Donations API'siyle
  çalışır. Anahtarlar ve OBS alert bağlantıları `chrome.storage.local` içinde
  kalır; Play Streamers sunucusuna
  yalnızca normalize edilmiş donate olayı gönderilir.
- Worker, desteklenen 26 sağlayıcının ad/yöntem kataloğunu
  `/api/donate-bridge/providers` ve cihaz yanıtlarında sunar. D1 cihaz özeti
  kaç farklı sağlayıcıdan olay geldiğini ve son sağlayıcı adlarını döndürür;
  site Bağlantılar ekranı bu kataloğu ikonlu olarak gösterir. Bu akış Workers KV
  kullanmaz.
- Eklenti `/api/donate-bridge/pair/claim` ve `/api/donate-bridge/events` POST
  uçlarına özel cihaz anahtarıyla bağlanır. Durum ve bağlantı kesme işlemleri
  `/api/donate-bridge/device/status` ile `/api/donate-bridge/device/disconnect`
  üzerinden iki yönlü eşitlenir. Aynı Chrome kurulumu yeniden eşleştiğinde eski
  cihaz anahtarı iptal edilir. Chrome uzantı kaynaklarına CORS yalnızca bu dört
  kendini doğrulayan POST yolu için açılır; hesap uçları açılmaz.
- Play Connect 0.5, Chrome başlangıcında ve 30 saniyelik alarm döngüsünde hazır
  platformları arka planda kontrol eder. Platformlar yalnızca gerçekten
  doğrulanan oturum/API bağlantısında yeşil gösterilir; hesap eşleştirmesi site
  veya eklentiden kaldırıldığında karşı taraf da kapanır. Elle yeni donate
  kontrolü ve her sağlayıcı için gelişmiş kurulum açıklaması bulunur.
- Play Connect 0.6 eşleştirme kodunu 12 karaktere çıkarır; geçiş sırasında
  oluşturulmuş 10 karakterli tek kullanımlık kodları da kabul eder. Başarılı
  eşleştirmeden sonra kullanılan kod Chrome profilinde salt okunur gösterilir
  ve bağlama düğmesi animasyonlu onay işaretine dönüşür. Bağlantı kaldırma
  işlemi özel onay penceresiyle yapılır.
- Play Connect 0.6.1, eşleştirme veya platform ayarı formu Enter tuşuyla
  gönderildiğinde Chrome'un gönderim düğmesini bildirmediği durumda güvenli
  düğme seçimi yapar; boş düğmeye erişim hatası oluşmaz.
- Play Connect 0.6.2, oturumu kapanan platformları kırmızı durum noktasıyla
  gösterir. Donate geçmişi için kalıcı tekilleştirme alanı genişletilmiş,
  göreli zaman metinlerinin aynı olayı yeni olay gibi üretmesi engellenmiş ve
  sunucu teslimat kuyruğu eşzamanlı çağrılarda güvenli şekilde birleştirilmiştir.
  Eski Chrome kayıtlarında kalmış olabilecek `workers.dev` teslimat adresleri
  açılışta otomatik olarak `https://api.pstreamers.com/api/donate-bridge/events`
  adresine taşınır.
- Play Connect 0.7, yeni eşleştirme kodlarını 16 karakter ve dört dörtlü grup
  biçiminde üretir; henüz kullanılmamış eski 10/12 karakterli kodlar yalnızca
  normal süreleri dolana kadar kabul edilir. Eklentinin cihaz anahtarı Chrome
  profilinde kaldığından site hesabından çıkıp yeniden girmek yeni kod istemez.
  İlk taramada eski hareketler başlangıç noktası olarak işaretlenir ve kuyruğa
  eklenmez. Kuyruk sağlayıcı/olay kimliğiyle tekilleştirilir, 90 günden eski veya
  geleceğe ait bozuk zaman kayıtları temizlenir, sunucunun kabul ettiği olaylar
  anında kuyruktan düşer. Aktif service worker 15 saniyelik hızlı kontrol yapar;
  Chrome'un 30 saniyelik alarmı uykuya alınan service worker için güvenilir
  yedek olarak kalır.
- Play Connect 0.8, etkin service worker sırasında bağlantı durumu, sağlayıcı
  taraması ve teslimat kuyruğunu tek bir 5 saniyelik hızlı çevrimde çalıştırır;
  açık platform sayfalarındaki değişiklik taraması yaklaşık 1,5 saniyedir.
  Chrome'un uyuyan service worker için izin verdiği 30 saniyelik alarm güvenli
  yedek olarak korunur. Site yeni eşleştirme kodu oluşturduğunda mevcut cihaz
  anahtarı iptal edilir; eklenti durum çevriminde bunu görüp yerel eşleşmeyi
  kapatır. Eklentiden bağlantı kesme ise Worker'a anında yazılır.
- Play Connect 0.8.1, aynı anda çalışan sayfa algılama, bağlantı durumu ve
  teslimat işlemlerinin Chrome yerel durumunu sırayla güncellemesini sağlar;
  eski bir durum görüntüsü artık yeni donate kuyruğunun üzerine yazamaz.
  Kuyruktaki kayıt yalnızca API açıkça `accepted: true` onayı verdiğinde
  silinir. Zaman aşımı ve doğrulanmayan 2xx yanıtlar yeniden denenir; başarılı
  yanıttaki sunucu olay sayısı eklenti panelinde teslimat makbuzu olarak
  gösterilir.
- Play Connect 0.8.2, son API teslimat denemesinin HTTP yanıtını, sunucuda
  doğrulanan olay toplamını ve bekleyen kuyruk sayısını küçük ve büyük eklenti
  panellerinde birlikte gösterir. Eski teslimat geri çekilme süreleri bir kez
  sıfırlanır ve bekleyen olaylar yeni sürüm açıldığında yeniden denenir. Canlı
  GitHub Pages kökünde `index.html` ile birlikte `play-connect.zip` de
  bulunmalıdır; yalnızca `index.html` yüklemek eklenti indirme bağlantısını 404
  durumunda bırakır.
- Play Connect 0.8.3, ByNoGame'ın güncel oturumlu donate veri akışını doğrudan Chrome profilindeki
  ByNoGame oturumuyla okur. `opId`, `orderRowId` ve `nickName` alanları gerçek
  olay kimliği ve bağışçı adı olarak kullanılır; ByNoGame oturum anahtarı
  yalnızca `chrome.storage.local` içinde tutulur ve Play Streamers sunucusuna
  gönderilmez. İlk bağlantıda eski hareketler başlangıç noktası yapılır,
  bağlantıdan sonra gelen yeni hareketler kuyruğa ve ardından
  `api.pstreamers.com` teslimatına alınır. Sağlayıcı kontrolü; okunan, eski,
  yinelenen ve geçersiz kayıt sayılarını ayırt eden sonuç metni gösterir.
- Play Connect 0.9, listedeki bütün platformlarda sayfanın kendi `fetch` ve
  `XMLHttpRequest` JSON yanıtlarını izleyen ortak, sağlayıcıdan bağımsız bir
  olay katmanı ekler. Katman yalnızca olay kimliği, bağışçı, tutar, para
  birimi, mesaj ve zaman alanlarını ayırır; platformun tam yanıtı, parolası,
  çerezi veya oturum anahtarı Play Streamers sunucusuna gönderilmez. İşlem
  kimliği için `donationId`, `transactionId`, `paymentId`, `orderId`, `tipId`,
  `supportId`, `chargeId`, `referenceId` ve benzeri yaygın alanlar; kuruş
  tabanlı tutarlar için `amountCents`/`amountMinor` ailesi desteklenir.
  Anahtar içermeyen ve aynı sağlayıcı alan adındaki güvenli GET veri adresi
  Chrome profilinde yerel olarak hatırlanıp sayfa kapalıyken yeniden kontrol
  edilir. Resmî API/WebSocket bağlantıları önceliklidir; bearer başlığı veya
  POST gövdesi zorunlu platformlarda sayfa kapalı gerçek zamanlı okuma
  platformun teknik sınırları nedeniyle garanti edilmez.
- Play Connect 0.9.1, ilk ağ taramasında donate listesinin boş gelmesini de
  geçerli bir başlangıç noktası olarak kaydeder. Böylece daha sonra gelen ilk
  gerçek donate eski geçmiş kaydı sanılmaz; doğrudan teslimat kuyruğuna alınır.
  İlk yakalanan paket zaten yeni bir donate içeriyorsa açık işlem zamanı,
  izlemeye başlama zamanıyla karşılaştırılarak aynı koruma uygulanır. Bu ortak
  düzeltme listedeki bütün platformların ağ tabanlı algılama akışında çalışır.
- Play Connect 0.9.2, sayfadaki genel “Giriş yap” bağlantısının doğrulanmış bir
  platform oturumunu yanlışlıkla kapatmasını engeller. ByNoGame oturumu,
  `cookies` izniyle Chrome profilindeki bilinen kimlik doğrulama çerezinden de
  yerelde doğrulanır; bulunan oturum anahtarı yalnız `chrome.storage.local`
  içinde kalır ve Play Streamers sunucusuna gönderilmez. Oturum anahtarı
  yenilendiğinde tamamlanmış donate başlangıç noktası yeniden sıfırlanmaz; bu
  nedenle yeni test donate'leri tekrar tekrar eski kayıt sayılmaz. Eklenti
  panelindeki ilk teslimat metni de API hatası yerine henüz kuyruğa yeni olay
  girmediğini açıkça belirtir.
- Play Connect 0.9.3, ilk taramadaki görünmemiş hareketleri yalnız eski tarihli
  oldukları için atmaz; yalnız daha önce sunucu onayı almış aynı olay kimliği
  tekrar kuyruğa alınmaz. Sağlayıcı işlem kimliği yoksa aynı içerikteki ayrı
  satırlara oluşum sırasına göre farklı yerel kimlik atanır. Platform oturumu
  kapanınca giriş durumu yeniden `required` olur ve giriş düğmesi geri gelir.
  Oturum veya platform veri akışı algılandığı anda güvenli sayfa/veri adresi
  gelişmiş bağlantı ayarlarına otomatik kaydedilir.
- Play Connect 1.0, API sunmayan sağlayıcıları normal Chrome oturumundan ayrı
  çerez deposu kullanan, eklentinin yönettiği gizli Chrome penceresinde açar.
  Kullanıcı eklenti ayrıntılarından **Gizli modda izin ver** seçeneğini bir kez
  açar; platform parolası yine yalnız platformun kendi sayfasına girilir.
  Giriş algılanınca donate/ödeme/işlem/geçmiş bağlantısı aynı alan adındaki
  menüden otomatik bulunur ve izleme sekmesi hazırlanır. `fetch`, XHR, WebSocket,
  Server-Sent Events ve DOM satırları birlikte izlenir; gerçek zamanlı akışı
  olmayan sayfalarda yönetilen sekme 30 saniyelik yedek aralıkla yenilenir.
  API'siz canlı izleme için bu özel pencere açık veya simge durumuna küçültülmüş
  kalmalıdır; Manifest V3 uzantısının içine bağımsız Chromium motoru gömülmez.
- Play Connect 1.0 teslimat defterinde “yakalandı” ve “sunucu tarafından
  onaylandı” durumlarını ayırır. Olay, kuyruktayken gönderilmiş sayılmaz; yalnız
  `/api/donate-bridge/events` açık `accepted: true` onayı verdikten sonra kalıcı
  tekilleştirme defterine yazılır. Böylece geçici ağ hatasında veya temizlenmiş
  eski kuyrukta yeni bir donate sessizce kaybolmaz. Eşleştirme kodunun bağlı
  olduğu D1 kullanıcı kimliği, normalize olayın hangi Dashboard Donate kartına
  gideceğini belirler.
- Play Connect 1.2, API sunmayan platformların kalıcı yönetilen sekme
  zorunluluğunu kaldırır. Kullanıcı platforma yalnızca ilk kurulum veya oturum
  yenileme sırasında geçici pencerede giriş yapar. Eklenti aynı platform alan
  adındaki güvenli GET/JSON veri adresini ve varsa Bearer oturum anahtarını
  yalnız Chrome profilinde öğrenir, arka plan isteğini doğrular ve geçici giriş
  sekmesini otomatik kapatır. Parola, çerez ve oturum anahtarı Play Streamers
  sunucusuna gönderilmez. Chrome servis çalışanının host izni ve normal profil
  çerezleri kullanılır; gizli mod izni istenmez. Platform arka plan isteğini,
  gömülmeyi veya uzantı erişimini engelliyorsa görünmeyen uzak sekme taklit
  edilmez ve durum kullanıcıya açıkça yeniden giriş/desteklenmiyor olarak
  gösterilir.
- Play Connect 1.3, herkese açık platform ana sayfalarındaki örnek donor
  kartlarını olay kaynağı saymaz. Bütün sağlayıcılarda izleme adresi; hesap,
  geçmiş veya doğrulanmış JSON/API kanıtıyla puanlanır. ByNoGame oturumu
  algılanınca açık `donate.bynogame.com` sayfası yerine yalnız oturumlu
  `/streamer/donate/incoming` akışı kullanılır. Ağ yakalama, donate anlamı
  taşımayan mağaza/ana sayfa nesnelerini ve iptal/iade/başarısız durumları
  eler. Sunucunun daha önce aldığı aynı olay başarılı makbuz sayılarak yerel
  kuyruktan düşürülür fakat yeni olay sayacını artırmaz. Arayüz ham aday
  sayısını göstermez; sunucu toplamı, bekleyen kuyruk ve son gerçek olay
  gösterilir. Aktif sağlayıcılar 2 saniyelik yedek arka plan kontrolüyle,
  görünür Dashboard ise 1,5 saniyelik olay sorgusuyla güncellenir.
- Play Connect 1.6, API sunmayan platformlardaki giriş/oturum öğrenme akışını
  OBS Browser Source / Alert Box bağlantısıyla değiştirdi. Gizli bağlantı yalnız
  Chrome profilinde saklanır; offscreen iframe içinde görünür sekme olmadan
  çalışır. Platformun kendi bağlantıları ile Streamlabs ve StreamElements
  bağlantıları alan adından otomatik ayrılır; Worker'a yalnız `local-alert`
  kaynaklı normalize donate olayı gönderilir.
- Play Connect 1.7'de sağlayıcıların arka planda çalışması kullanıcı ayarı
  olmaktan çıkarıldı. Görünür “Arka planda etkin tut” anahtarı kaldırıldı; eski
  profillerde kapalı kalmış sağlayıcılar da geçiş sırasında otomatik etkinleşir.
  Ayarlar ekranındaki destek kısayolu, sitenin kulaklık simgesi, el çizimi ok,
  ölçü ve renkleriyle aynı bileşene dönüştürüldü.
- Play Connect 1.8, etkin service worker kontrolünü 1 saniyeye indirir; Chrome'un
  30 saniyelik alarmı yalnız uyku/yedek çevrimi olarak kalır. Kaydedilen OBS /
  Alert Box adresi bağlantı kaldırılıncaya kadar salt okunur tutulur ve başka
  bir adresle üzerine yazılamaz. Görünmeyen OBS çerçevesine ses oynatma izni
  verilir. İlk bağlantı yüklemesindeki geçmiş olay kimlikleri ayrı başlangıç
  defterine alınır; yalnız canlı WebSocket/SSE olayı veya başlangıç çizgisinden
  sonra gelen yeni kayıt kalıcı kuyruğa ve ardından Play Streamers API'sine
  gönderilir. Eski sürümün kuyruğunda kalmış OBS geçmiş kayıtları geçişte bir
  kez temizlenir.
- Play Connect 1.4, kullanıcıya gösterilen gelişmiş sayfa adresi/CSS seçici
  ayarlarını ve DOM kart taramasını kaldırır. ByNoGame'de gönderilen bağış akışı
  yerine hesabın aldığı bağışları veren `incoming` akışı kullanılır. Bu istek hem
  yerel Bearer oturum anahtarıyla hem de Chrome profilindeki oturum çerezleriyle
  doğrulanabilir; herkese açık donate sayfası olay kaynağı değildir.
- Play Connect 1.5, katalogdan yayıncıya doğrudan canlı destek aktarmayan satış,
  üyelik, hediye ve genel bağış toplama servislerini; ayrıca GameSatış ve
  ItemSultan'ı çıkarır. LivePix, Saweria, Trakteer, SociaBuzz, Tipply, Toonation
  ve Doneru farklı global pazarlardaki doğrudan streamer desteği ve yayın
  overlay/uyarı akışlarıyla kataloğa eklenir. Worker katalog sürümü 6'dır.
- Play Connect cihaz durum denetimi, gerçekten oturumu/API bağlantısı doğrulanan
  sağlayıcı kimliklerini Worker'a gönderir. Site yalnızca bu sağlayıcıları yeşil
  gösterir. Eklentinin büyük panelindeki destek formu eşleşmiş hesapta hesap
  e-postasını kullanır; eşleşme yoksa e-posta zorunludur. D1 destek kaydı
  `play-connect` veya `play-streamers` kaynak etiketi taşır.
- Hesap merkezindeki mevcut Play Connect platform logoları `index.html` içine
  gömülüdür; yeni katalog ikonları `assets/providers` klasöründen güvenli yerel
  yedekle yüklenir. Üst menü
  yalnızca Hesabım girişini gösterir, cihaz geçmişi Hesabım içindeki Cihazlar
  sekmesinde kalır.
- Oturumu algılanan her platform için kullanıcı isteğiyle çalışan
  **Platformdan çıkış yap** denetimi bulunur. Açık sayfalarda metin, özellik ve satır
  değişiklikleri anlık izlenir; donate bulunan sayfa daha sonraki arka plan
  kontrolleri için yerelde hatırlanır. API/WebSocket vermeyen ve otomatik
  istekleri engelleyen bir platformda sayfa tamamen kapalıyken gerçek zamanlı
  okuma garanti edilmez.
- Dashboard, `/api/donate-bridge/events` GET yolunu normal kullanıcı oturumuyla
  ve yalnızca görünür sayfadayken yaklaşık 1,5 saniyede bir kontrol eder. Gelen
  olaylar Dashboard yayıncı panelindeki Donate toplamına eklenir. Bağlantılar
  ekranı da açıkken 5 saniyede bir yenilenerek cihaz başına doğrulanmış olay
  sayısını gösterir. D1 olayları kullanıcı/sağlayıcı/olay kimliğiyle
  tekilleştirilir.
- Platformların özel hesap sayfaları gerçek yayıncı hesabı olmadan kesin
  doğrulanmış sayılmaz. İlk kurulumdaki bağlantı testi; oturumun, URL'nin ve
  gerekirse gelişmiş CSS alan eşleştirmesinin platform bazında doğrulanması için
  zorunlu kabul edilir.
- Ko-fi, PayPal, Gumroad, GitHub Sponsors, Givebutter ve Donorbox için resmi
  webhook/API seçenekleri bulunsa da bunların sunucu uçları ve imza doğrulaması
  bu sürümde otomatik kurulmuş sayılmaz. İstemci sırrı veya webhook sırrı
  eklentiye konmaz; olası entegrasyonlar Worker secret ve sağlayıcıya özel
  imza doğrulamasıyla ayrı ayrı tamamlanmalıdır.

## Hesap cihazları

- Hesap merkezindeki **Cihazlar** bölümü kullanıcı oturumlarını D1'de tutulan
  cihaz geçmişiyle eşleştirir. Tarayıcı, işletim sistemi, ilk giriş, son
  aktiflik ve Cloudflare'ın sağladığı yaklaşık şehir/ülke/koordinat bilgisi
  yalnızca hesap sahibine gösterilir.
- `/api/account/devices` açık ve geçmiş cihazları listeler;
  `/api/account/devices/revoke` seçilen cihaza ait gerçek `user_sessions`
  kaydını siler. Aynı cihaz anında, açık kalan diğer cihazlar odaklandığında
  veya en geç yaklaşık bir dakikalık kontrol sırasında birinci ana sayfaya
  döner. Geçmiş, bu özellik etkinleştirildikten sonraki oturumları kapsar.
- Cihazlar sekmesi açıldığında güncel liste alınır, 15 saniyede bir yenilenir ve
  son başarılı/başarısız yenileme tarihi saatine kadar gösterilir. Elle Yenile
  düğmesi aynı endpoint'i zorlayarak mevcut tarayıcı oturumunu da cihaz
  geçmişine ekler.
- Aynı kullanıcıya ait oturumlar Cloudflare'ın sağladığı IP adresinin yalnızca
  geri döndürülemez özeti kullanılarak ağ bazında gruplanır; ham IP adresi
  saklanmaz ve istemciye gönderilmez. Aynı IP üzerindeki oturumlar Cihazlar
  ekranında tek cihaz kartı olarak görünür ve karttan çıkış yapıldığında o
  gruptaki açık oturumların tamamı kapatılır. Bu özellikten önce oluşan,
  ağ özeti bulunmayan geçmiş kayıtlar yalnızca tarayıcı/sistem/konum benzerliği
  ile yaklaşık gruplanabilir.

## Güvenilir Authenticator cihazı

- Kullanıcı **Beni hatırla** seçeneğini işaretleyip Google Authenticator
  doğrulamasını başarıyla tamamlarsa Worker, yalnızca HttpOnly/Secure çerezde
  bulunan rastgele cihaz anahtarının özetini D1'de 30 gün saklar. Anahtar
  kullanıcı `session_version` değeriyle bağlıdır; hesap güvenlik sürümü
  değiştiğinde veya süresi dolduğunda yeniden Authenticator doğrulaması gerekir.
- Doğrulama ekranı sağlayıcı bağımsızdır; Google/Kick sosyal giriş düğmeleri bu
  katmanda gösterilmez.

## Modüler ön yüz ve Dashboard sürekliliği

- Windows Defender'ın büyük, tek parça HTML üzerinde verdiği yanlış phishing
  alarmını azaltmak için ön yüz artık `index.html`, `styles.css`, `bootstrap.js`,
  `app.js` ve `app-final.js` dosyalarına ayrılmıştır. Koruma kapatılmaz ve hiçbir
  Defender istisnası eklenmez.
- Dashboard açıkken sayfa yenilenirse kullanıcı Dashboard'da kalır. Yayıncı
  panelindeki Sıfırla işlemi yalnızca panel olaylarını temizler, oturumu kapatmaz
  ve ikinci ana sayfaya yönlendirmez.
- Donate ayrıntısında doğrulanmış bir `http(s)` kaynak adresi yoksa boş `#`
  bağlantısı oluşturulmaz; bu nedenle karta tıklamak birinci ana sayfaya
  yönlendirmez.
- Play Connect 1.7'de arka plan izleme görünür bir kullanıcı anahtarından
  bağımsız olarak daima etkindir. Destek kısayolu sitenin destek bileşeniyle aynı
  kulaklık simgesini ve görsel dili kullanır.
- Play Connect 1.8.1'de OBS bağlantısını kaldırma işlemi tarayıcının standart
  onayı yerine markaya özel bir onay penceresi kullanır. Görünmeyen alert
  çerçevelerinde medya, Web Audio ve sesli okuma susturulur. Ağ olayı ortak JSON
  biçiminde ayrıştırılamazsa yalnızca kayıtlı OBS çerçevesinde oluşan gerçek alert
  kartı yedek kaynak olarak okunur; ağ yakalaması öncelikli tutularak aynı olayın
  iki kez kuyruğa girmesi engellenir.
- Play Connect 1.9.0'da donate olay kimliği; sağlayıcı kimliğiyle birlikte
  gönderen, tutar, mesaj ve olayın saniye hassasiyetindeki zamanını kullanır.
  Böylece aynı kartın tekrar taranması tekilleştirilirken aynı içerikle daha
  sonra gelen test donate yeni olay olarak kabul edilir. İlk gerçek OBS alert
  olayı artık başlangıç görüntüsü sayılarak atılmaz.
- Dashboard donate kartlarında sağlayıcı logosu, gönderen, tutar, mesaj ve
  saniye hassasiyetinde tarih/saat gösterilir. Oturum geri yüklenirken ziyaretçi
  ana sayfası gösterilmez; panel sıfırlama tam sayfa yenilemeden yalnızca panel
  olaylarını temizler.
- Play Connect destek ekranında alıcı `swcreate.info@gmail.com` olarak sabittir.
  Eklenti hesapla eşleşmişse hesap e-postası salt okunur biçimde kullanılır ve
  talep kullanıcının Destek taleplerim alanına kaydedilir; eşleşme yoksa kullanıcı
  yanıt adresini kendisi girer. Başlığa sitenin sekiz dilli seçim menüsü eklendi.
- Canlı site sayaçları D1 yazma ve sayım sorgularını tek bir toplu işlemde
  yürütür; toplam tekil tarayıcı, kullanıcı adı tamamlanmış hesaplar ve son iki
  dakikadaki tekil ziyaretçi/hesap değerleri 30 saniyede bir güncellenir.
- Play Connect 1.9.1'de OBS kartlarındaki gönderen ve mesaj alanları semantik
  alanlardan, gerektiğinde de kartın yaprak metinlerinden okunur. Aynı OBS test
  kartı yeniden kullanılsa bile her görünür bildirim yaşam döngüsü ayrı bir
  olay zamanı alır. Eklenti platform listesi ana içerik kartıyla aynı yükseklikte
  kalır; dar ekranlarda destek metni ve oku gizlenip yalnızca küçülen simge kalır.
- Dashboard donate satırı okunmuş işaretlenirken panel artık tamamen yeniden
  çizilmez; ayrıntı penceresi aynı Dashboard rotasında açılır. Kayıtlı Dashboard
  yenilemelerinde yükleyici zemini opaktır ve ziyaretçi ana sayfası altta belirmez.
- Dashboard açıkken gelen canlı olaylar tam panel çizimi yapsa bile aktif Dashboard
  yüzeyi ve oturum rotası korunur. Donate kartı veya ayrıntısı açılırken eski
  `auth-locked` sınıfı temizlenir; böylece ziyaretçi ana sayfasına dönme ve boş
  ekran oluşma davranışı engellenir.
- Play Connect 1.9.3'te hesap merkezindeki sağlayıcı logoları yüklenmişken metin
  yedeğinin (`DO` gibi) aynı anda görünmesi engellendi. Kick hesabı daha eski bir
  oturumdan geliyorsa eksik kanal kullanıcı adı yeniden alınır; takipçi özeti
  geçici olarak alınamazsa doğrulanmış takip olaylarının toplamı yedek değer
  olarak gösterilir.
- Streamlabs, StreamElements, TipeeeStream, DonationAlerts ve Pally bağlantıları
  API/WebSocket anahtarlarını yalnızca Chrome profilinde tutar. İtemSatış, Ko-fi
  ve Buy Me a Coffee için hesap sahibine özel, iptal edilebilir Worker webhook
  adresleri hesap merkezinden üretilir; olaylar görünür tarayıcı sekmesi
  olmadan D1'e ve aynı kullanıcının Dashboard'una gider.
- Kick bağlantısını kesme işlemi artık yalnızca geçici erişim anahtarını değil,
  kullanıcının Kick eşlemesini ve bu eşlemeye ait eski oturumları da kaldırır;
  geçmiş yayın olayları korunur ve aynı hesap daha sonra yeniden bağlanabilir.
  İkinci ana sayfa ile Dashboard'da geliştirme uyarısının sağında ortak dil
  seçimi bulunur. Sekmesiz sunucu bağlantıları hesap merkezindeki `Test et`
  işlemiyle Worker → D1 → Dashboard veri yolunu gerçek platform bildirimi
  beklemeden doğrulayabilir.
- Play Connect 1.9.6 ve eşlik eden site güncellemesinde Donate satırlarının ayrı
  büyütme düğmesi kaldırıldı; ayrıntı satırın tamamına tıklanarak açılır ve okunmuş
  olayların silinmesi Dashboard'u yeniden çizmez. SSB sağlayıcı seçimi arka plan
  yenilemelerinde korunur; SSB testi oluşturulan olayı aynı anda Dashboard'a çeker.
  Bağlantı durumu Kick ile birlikte Play Connect'i de gösterir. Kick kanalı yeniden
  bağlandığında kanal özeti ve takipçi alanları sunucudan yeniden okunur.
- Sürüm 3.7 ile Streamlabs, DonationAlerts ve TipeeeStream için merkezi OAuth
  bağlantıları Hesabım → Bağlantılar alanına eklendi. OAuth erişim/yenileme
  anahtarları `DONATE_OAUTH_ENCRYPTION_KEY` kullanılarak AES-GCM ile şifrelenir;
  düz metin token istemciye veya D1'e yazılmaz. İlk bağlantı anındaki eski
  bağışlar yalnızca imleç olarak kaydedilir, bağlantıdan sonraki benzersiz
  sağlayıcı olayları ortak `donate_bridge_events` tablosuna aktarılır.
- Merkezi donate API bağlantıları Worker Cron Trigger (`* * * * *`) ile site
  veya sağlayıcı sekmesi açık olmasa da denetlenir. Ön yüz açıkken yapılan hafif
  kontrol yalnızca görünürlüğü hızlandırır; asıl bağlantı kullanıcı parolasını
  almayan sağlayıcı OAuth iznine dayanır.
- Sürüm 4.2 ile ikinci ana sayfa geri yüklemesi tek kararlı geçişe indirildi;
  `pageshow` ve `load` olaylarının aynı yüzeyi art arda çizmesi engellendi.
  “Neler yeni” düğmesi ortak güncelleme geçmişini açar; her sürümün `+`/`−`
  durumu gerçek açık/kapalı haliyle eşleşir ve akordeon yüksekliği daha hafif
  bir geçişle değişir.
- Dil seçiciler emojiye veya işletim sistemi yazı tipine bağlı değildir. Site ve
  Play Connect, sekiz dil için yerel SVG bayraklarını kullanır. Google giriş
  düğmeleri de eski ve yeni işaretlerin üst üste binmesini önleyen tek SVG
  işaretle normalleştirilir.
- Hesap verilerindeki aktif takipçi, aktif abone ve bu ay takip eden grafikleri
  son 90 günü gün gün gösteren sütun grafikleridir. Kick özeti geçici olarak
  abone sayısı döndürmezse doğrulanmış olaylar veya `0` kullanılır; ölçüm açık
  hesap ekranında yeniden bağlantı istemeden düzenli yenilenir.
- Geliştirme uyarısına eklenen Play Bot; çevrimdışı durum, API sağlık yanıtı,
  Kick/Play Connect bağlantı durumu ve yinelenen DOM kimlikleri için yerel,
  salt-okunur bir tanılama özeti sunar. Tarama yalnızca uyarı penceresi açıkken
  30 saniyede bir çalışır; KV veya D1 yazımı yapmaz.
- Play Connect 1.10.1'de merkezi DAB sağlayıcı görünümü yalnızca gerekli bağlantı
  yönlendirmesini ve son işlemleri gösterir; altta yarım kalan boş ayar alanı
  oluşturmaz. TipeeeStream kartı gömülü logo yedeğini kullanır.
- Sürüm 4.3 ile geliştirme uyarısı ve dil düğmelerindeki hover titremesi
  kaldırıldı; uyarı penceresinin içindeki etkileşimler pencereyi kapatmaz.
  Play Bot yinelenen eski/gizli arayüz kopyalarını sorun olarak saymaz; görünür
  DOM, resim, yatay taşma, çevrimdışı durum ve API sağlığını arka planda
  periyodik ve salt-okunur biçimde denetler.
- Kick ölçümleri saatlik `kick_metric_hourly` tablosuna yazılır. Son 90 günlük
  sütunlar günün en yüksek ölçümünü gösterir; sütuna tıklanınca aynı günün
  24 saatlik dağılımı açılır. Bu ay takip eden grafiği doğrulanmış takip
  olaylarından, aktif abone ise resmi özet varsa bu değerden; yoksa yakın tarihli
  doğrulanmış abonelik olaylarından beslenir.
- Play Connect 1.10.2'de merkezi DAB sayfasının altında oluşan ikinci arka plan
  ve gereksiz boş alan kaldırıldı. Yerel bayraklar kenarları kırpılmış biçimde
  gösterilir; TipeeeStream DAB logosu dosya yüklemesi başarısız olsa bile gömülü
  yedekten çizilir.
- Chrome Web Mağazası'nın 26 Ağustos 2026 tarihli `Purple Potassium` reddi,
  Play Connect'in kullanmadığı `tabs` izninden kaynaklandı. Play Connect 1.13.0
  manifesti bu izni istemez; platform giriş/çıkış sayfaları `chrome.tabs.create`
  çağrısı için ayrı `tabs` izni gerekmeden açılır. Chrome mağaza paketinde izinler
  `alarms`, `cookies`, `notifications`, `offscreen`, `storage` ve `webRequest`
  ile sınırlandırılmıştır.
- Sürüm 4.21 ile tüm ana altlıklarda ilk satır Gizlilik Politikası bağlantısı,
  ikinci satır ise guns.lol/switly adresine giden Developed by SW CREATE
  bağlantısı olarak sabitlendi; eski özellik sloganlarının yeniden görünmesi
  engellendi.
- Sürüm 4.22 ile alt bilgi üç parçalı hale getirildi: Gizlilik Politikası solda,
  Güvenli bağlantılar · Kişisel panel · Ücretsiz başlangıç metni tam ortada ve
  Developed by SW CREATE bağlantısı sağda gösterilir; dar ekranda üçü ortalanıp
  alt alta dizilir.
- Site 7.1 görsel sistemi yalnız `site-v7.css` ve `site-v7.js` üzerinden
  yüklenir. Eski `styles.css`, `compact-modern.css` ve 6.0 katmanları çalışma
  geçmişi için korunabilir ancak `index.html` tarafından yüklenmez. Ziyaretçi
  ana sayfası, giriş/kayıt, bilgi sayfaları, üye ana sayfası, hesap merkezi ve
  Dashboard aynı grafit, mercan ve kemik beyazı Control Room dilini kullanır;
  eski işlevsel olay dinleyicileri ve kimlik doğrulama akışları korunur.
  `app-final.js` içindeki ziyaretçi metni yenilemesi DOM'u
  yalnızca içerik gerçekten değiştiğinde günceller; böylece eski düzeltme
  gözlemcisinin kendi değişikliğini sürekli yeniden tetiklemesi önlenir.
- Sunucu analiz kartı görünür üye yüzeyi dışında gereksiz veri isteği göndermez.
  İlgili yüzey açıldığında, tarayıcı yeniden çevrimiçi olduğunda veya sekme
  yeniden görünür olduğunda yenilenir; geçici ağ hatası boş kart yerine açık bir
  yeniden deneme durumu gösterir.
- Site 10.6 canlı çeviri sistemi seçilen dili tarayıcıda kalıcı varsayılan olarak
  saklar; ana sayfa, hesap pencereleri, Dashboard, Gizlilik ve Kullanım Koşulları
  aynı çeviri katmanını kullanır. Çeviri önbelleği KV yerine D1'de kaynak metin
  ve hedef dile göre paylaşılır. Workers AI üretimi GLM 4.7 Flash kullanır; aynı
  yazımlar yeni sürümlerde yeniden ücret oluşturmaz. Almanca gibi Türkçeyle ortak
  sözcükler taşıyan diller tek bir ortak sözcük yüzünden hatalı sayılmaz.
