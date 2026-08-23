# Play Streamers Hazırlık Denetimi

Tarih: 23 Ağustos 2026

## Kısa karar

Play Streamers Desktop 0.11.0; hafif bir yayın/kayıt Studio'su, doğrulanmış canlı
veri hattı ve 54 Free, Pro, Product Pro çalışma alanıyla üretim paketi
oluşturabilecek durumdadır. Studio artık 32 kalıcı sahne, gerçek FFmpeg
canlı Program'dan bağımsız Önizleme sahnesi, tek düğmeyle Programa alma,
yalnız Program çıkışına uygulanan canlı kesme/crossfade/kararma geçişi, ana kaynak kırpma,
konumlandırılabilir ana kaynak ve sahne başına 64 sıralanabilir yazı, görsel,
yerel medya veya renk kaynağı; çalışan grafikte canlı kaynak görünürlüğü ve
opaklık değişimi, 15–120 saniyelik gerçek replay
buffer, motor/ses telemetrisi, ses filtreleri ve otomatik yeniden bağlanma sunar.

Buna rağmen Studio, OBS Studio ile birebir özellik eşitliğinde değildir.
Tarayıcı kaynağı, gerçek oyun hook'u,
stinger/luma gibi geçiş çeşitleri ve eklenti/VST/WebSocket ekosistemi henüz
bulunmaz. Ürün “OBS'nin bütün özellikleri” diye tanıtılmamalıdır.

## Bu derlemede doğrulananlar

- React/TypeScript üretim derlemesi geçti.
- Rust Studio motorunda 22 testin 21'i geçti. Kurulu Windows 11 sanal kamera
  bileşeni isteyen gerçek cihaz testi bilinçli olarak atlandı.
- Ayrı updater testi, yayınlanan kurucu baytlarının `latest.json` içindeki Tauri
  minisign imzasıyla eşleştiğini doğruladı.
- 54 özellik tanımının tamamı `ready`; `foundation` veya `planned` kayıt yok.
  Bu durum her özelliğin kendi güncel açıklamasındaki akışın çalıştığını ifade
  eder, dış platformların sunmadığı otomasyonları vaat etmez.
- Ana sayfa ve Ürünler sayfası yerel gerçek tarayıcıda açıldı; Creator OS
  anlatımı, indirme bağlantısı, üç ürün komut kartı, teknik kanıt etiketleri ve
  yatay taşma denetlendi. Ana sayfa ürün demosundaki örnek canlı sayaçlar
  kaldırıldı; temsili ekran ile doğrulanmış hesap verisi açıkça ayrıldı.
- Masaüstü Studio arayüzü gerçek tarayıcıda çalıştırıldı. Mola sahnesi seçimi
  yalnız Önizleme'yi değiştirdi, Program ana sahnede kaldı; `Programa al`
  eyleminden sonra Program güncellendi ve düğme yeniden pasif duruma geçti.
- `Sahneler arası yumuşak geçiş` seçeneği gerçek arayüzde seçildi; süre alanı
  etkinleşti ve 500 ms değeri `Programa al` denetiminde doğru gösterildi.
- Kaynak düzenleyicide yazı kaynağı ekleme, görünürlük anahtarı, opaklık
  denetimi ve yatay taşma gerçek tarayıcıda doğrulandı.
- 0.11.0 Studio arayüzünde `Tuvalde düzenle`, `2/32` sahne sayacı, `0/64`
  kaynak sayacı ve ikinci RTMPS çıkışını açınca görünen ayrı adres/anahtar
  alanları gerçek tarayıcıda doğrulandı.
- Çalışan FFmpeg ZMQ grafiğinde canlı kaynak alfa komutu, hedef seçici, 10
  adımlı crossfade, Program devri, alfa sıfırlama, eski fade/cut ve canlı ses
  komutları birlikte geçti.
- `app.js`, `app-final.js`, `site-router.js` ve `cloudflare-worker.js` JavaScript
  sözdizimi kontrollerinden geçti.
- Yeni NSIS kurucusu üretildi: 31.615.243 bayt, SHA-256
  `B16705EB42437EB56BC070FFB8E4F5152ECF51158BC98322EB57A6C0605F476D`.
  Bundle ve site indirme kopyası birebir eşleşiyor; updater imza testi geçti.
- Microsoft Store için iki yeni MSIX üretildi. Her ikisi aynı uygulama EXE'sini
  içeriyor. Windows 10 paketi minimum `10.0.19041.0` ve sanal kamera kaydı yok;
  Windows 11 paketi minimum `10.0.22000.0` ve COM sanal kamera kaydı var. Türkçe
  paket açıklaması UTF-8 olarak doğrulandı. Ortak uygulama EXE SHA-256 değeri
  `033716B30B872F720A4DCB37E4420CA1FAD3094DCB093B2D57EA2555EC2DD372`;
  paket SHA-256 değerleri sırasıyla
  `F649B54F52D1968283AD8343F96027EAECB6CE6C527C233F9A31D2C37ADD4056` ve
  `6D4BD9EE7195D126EE270887FC09D9CAAE755F13FA680A4A038495653E22138C`.

## Studio kapsamı

| Alan | Çalışan kapsam | OBS'ye göre kalan sınır |
| --- | --- | --- |
| Kayıt | MKV, isteğe bağlı çoklu ses kanalı, MP4'e kayıpsız yeniden paketleme, aynı kodlama akışında 15–120 saniyelik döngüsel replay buffer | Gelişmiş kayıt profilleri yok |
| Yayın | Güvenli RTMPS, GPU/x264 seçimi, tek kodlama akışından iki platforma eşzamanlı çıkış, yayınla birlikte yerel kayıt, beş denemeli kurtarma | Yerleşik servis sihirbazları ve üçten fazla eşzamanlı çıkış yok |
| Sahneler | 32'ye kadar kalıcı sahne, çoğaltma/silme/sıralı profil; ayrı Önizleme ve Program durumu, tek düğmeyle canlıya alma | Geçiş kuyruğu ve çoklu Program çıkışı yok |
| Kaynaklar | Sahne başına masaüstü, tam pencere veya kamera ana kaynağı; dört yönlü kırpma; 64 sıralanabilir yazı, görsel, döngüsel yerel medya ve renk kaynağı; tuvalde sürükleyerek konumlandırma; çalışan Program/Önizleme/sanal kamera grafiğinde canlı görünürlük ve opaklık | Canlı konum/boyut komutu ve tarayıcı kaynağı yok |
| Önizleme | Kendi FFmpeg komut kanalında çalışan bağımsız hazırlık sahnesi; seçim Program'ı değiştirmez | Ayrı ikinci Program monitörü ve çoklu görünüm yok |
| Oyun yakalama | Seçilen pencereyi kesin pencere tanıtıcısıyla yakalama | Yüksek performanslı oyun hook'u yok |
| Ses | Sistem sesi + mikrofon miksajı, ayrı kayıt kanalları, gerçek seviye metreleri | İzleme bus'ı, VST ve kapsamlı yönlendirme matrisi yok |
| Ses filtreleri | Yüksek geçiren filtre/gürültü azaltma, noise gate, compressor ve limiter | Expander ve kullanıcı sıralı filtre zinciri yok |
| Geçiş | Kayıt, yayın ve sanal kamera Program çıkışında gerçek kesme, 150–800 ms sahneler arası crossfade veya siyaha karararak geçiş | Stinger ve luma geçişleri yok |
| Telemetri | FPS, bit hızı, kodlanan/düşen kare, toplam bayt, hız, FFmpeg CPU kullanımı, ses seviyeleri ve yeniden bağlanma | GPU kullanımı ve rota bazlı ağ teşhisi yok |
| Sanal kamera | Windows 11 Media Foundation kaynağı | Windows 10'da bilinçli olarak yok |
| Genişletme | Uygulamaya özel yerleşik araçlar | OBS eklenti, script, WebSocket, dock ve multiview ekosistemi yok |

## Free / Pro / Product Pro kapsamı

- Canlı Merkez, Kick imzalı olayları ve Play Connect/sağlayıcı desteklerini
  ortak doğrulanmış zaman çizelgesinde gösterir; sahte veri üretmez.
- Gelişmiş grafik ve yayın sonrası rapor gerçek yayın oturumlarından hesaplanır.
- Gelir Kokpiti ve Destekçi Haritası para birimlerini ayrı tutar; kur verisi
  olmadan TRY, USD veya diğer para birimlerini tek yanıltıcı toplama çevirmez.
- Dosya Kasası dosya içeriğini buluta yüklemez; yerel dosya metadata indeksidir.
- Yerleşim Profilleri Studio ayarlarını, sahneleri ve temayı yerelde kaydeder;
  oturum ve gizli anahtar kopyalamaz.
- Liste tabanlı içerik, topluluk, marka ve planlama araçları ekleme, silme ve
  sıralama akışına sahiptir. Platform API'si gerektiren otomatik paylaşım veya
  moderasyon iddiası taşımaz.
- Product Pro AI, doğrulanmış/sayısal kanıtın yerine geçmez. Deterministik
  karşılaştırma önce hesaplanır; AI yalnız kişisel veri içermeyen özeti daha
  anlaşılır Türkçeye çevirir.

## Veri doğruluğu

Studio açık yayın oturumunu Worker'da kullanıcıyla eşler. `/api/platform/live-context`:

- Kick OAuth hesabına bağlı, imzası doğrulanmış webhook olaylarını;
- Play Connect veya sağlayıcı üzerinden kullanıcıya bağlanan destek olaylarını;
- Kick'in geçerli yayın izleyici sayısını

yayın başlangıç zamanından itibaren toplar. Takipçi, abonelik, etkileşim ve tepe
izleyici değerleri kapanış özetine taşınır. Gelir para birimi bazında saklanır;
yalnız tek para birimi varsa `revenueMinor` doldurulur.

Worker değişiklikleri yerelde sözdizimi ve dry-run açısından doğrulandıktan
sonra `api.pstreamers.com` alanına `a5abc7b3-ea1b-4c9e-9621-99169a7ec123`
sürümüyle dağıtıldı. Canlı `/health` yanıtı sağlıklı, AI binding etkin ve
`https://pstreamers.com` CORS ön kontrolü 204 olarak doğrulandı. Canlı
OAuth/webhook verisi gerçek hesap ve yayın olmadan çalıştı varsayılmıyor.

## Güvenlik ve dağıtım sınırları

- Yayın anahtarı Windows Credential Manager'da saklanır ve uygulama loglarında
  maskelenir. FFmpeg RTMPS hedefini çocuk süreç komut satırından aldığı için aynı
  Windows kullanıcısının gelişmiş süreç inceleme araçlarında görünme riski sürer.
  Bunu tamamen kaldırmak libav tabanlı ayrı bir çıkış motoru gerektirir.
- Doğrudan EXE'nin Tauri updater imzası geçerlidir; Authenticode/Windows yayıncı
  imzası yoktur. Bu nedenle SmartScreen uyarısı mümkündür. Microsoft Store
  dağıtımı paketi Microsoft sertifikasıyla imzalayarak bu sorunu çözer.
- Önceki 0.4.1.0/0.4.2.0 paketlerinin WACK raporları PASS'tir; ancak
  0.11.1.0/0.11.2.0 uygulama ikilisi değiştiği için yeni MSIX'lerde tam WACK
  yeniden çalıştırılmalıdır.
  Mevcut Codex oturumu yönetici olmadığı için WACK yeni rapor üretmedi. Yeni
  paketler MakeAppx ile hatasız oluşturuldu ve manifest/içerik ayrımı denetlendi.
- Gerçek Windows 10 cihazında kamera, mikrofon, masaüstü ses döngüsü, pencere
  yakalama, kayıt ve RTMPS duman testi; gerçek yayın hesabıyla uçtan uca yayın
  testi hâlâ fiziksel doğrulama gerektirir.

## Yayın öncesi kalan zorunlu kontroller

1. Yönetici terminalinde iki yeni MSIX için WACK çalıştır ve sonuçların PASS
   olduğunu doğrula.
2. Gerçek Windows 10 cihazında kayıt/yayın duman testi yap.
3. Gerçek Kick hesabıyla kısa RTMPS yayın aç; yeniden bağlanma, canlı olaylar ve
   yayın kapanış özetini doğrula.
4. Gerçek hesapla OAuth ve canlı bağlam uçlarını uçtan uca kontrol et.
5. Partner Center'a iki MSIX'i yükle ve sertifikasyon sürecini başlat.
