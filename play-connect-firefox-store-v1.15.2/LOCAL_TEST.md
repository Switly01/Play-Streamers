# Play Connect — yerel Chrome testi · 4 Eylül 2026

Bu çalışma canlıya, GitHub'a veya mağazaya gönderilmedi. Eklenti tarayıcıya kurulmadı.

## Çeviri önbelleği ve dil para birimi güncellemesi

Tüm hazır dil paketleri sürümlü yerel önbellekte tutulur; popup yeniden açıldığında
paket tekrar okunmaz. Platform ekranı DOM'a eklenmeden çevrilir. Menü aynı kalır;
sonradan değişen durum/hata alanları, bütün sayfa yerine ayrı ayrı işlenir.
26 platform × 8 dilde 208 görünüm, ilk karede doğru dil ve önbellekten yeniden
açılış kontrol edildi. Para birimi tercihi arka plan işlemine de uygulanır.

Dil varsayılanları: TR→TRY, EN→USD, DE/ES/FR→EUR, RU→RUB, AR→SAR, JA→JPY.
Platformda **Dil varsayılanı** seçeneği dili takip eder; elle seçilip kaydedilen
para birimi korunur. Gerçek bağıştaki açık para birimi değiştirilmez veya kurla
dönüştürülmez. Varsayılan yalnız para birimi eksik gelen yeni olaylarda kullanılır;
geçmiş olaylar ve kuyruk yeniden yazılmaz.

Yüklü test eklentisi için Chrome eklenti yönetimindeki **Yenile** düğmesine basıp
açık Play Connect panelini kapatıp yeniden aç. Klasör aynı; tekrar kurulum gerekmez.

## Kurulum

Chrome adres çubuğuna `chrome://extensions` yaz. Geliştirici modunu aç ve
**Paketlenmemiş öğe yükle** ile şu klasörü seç (ZIP veya manifest dosyası değil):

`C:\Users\esatb\Downloads\yayin-paneli-eklenti_2\play-connect-chrome-local-test`

Eski Play Connect'i test sırasında devre dışı bırak; iki eklenti aynı kaynağı
eşzamanlı takip etmesin. Eski eklentiyi silmen gerekmez. Ayrı klasördeki test
eklentisi yeniden eşleştirme isteyebilir. Kayıtlı gerçek bağlantıların kopyalanmadı.

## Test listesi

- Popup ve Play Connect panelini aç; platformlar, destek ve onay pencerelerini kontrol et.
- İlk açılışta desteklenen tarayıcı/sistem dili kullanılır. TR/EN düğmesinden
  elle seçebilir veya **Sistem dili** seçeneğine dönebilirsin. Desteklenmeyen
  dillerde Türkçe kullanılır. Türkçe, İngilizce, Almanca, İspanyolca, Fransızca,
  Rusça, Arapça ve Japonca paketleri eklentinin içindedir. Çeviri için dış istek yoktur.
- DAB ve SSB platformlarında OBS / Alert Box / Overlay linki ekle, kaydet,
  yeniden aç ve doğrula. SSB bildirim/webhook adresini bu alana yapıştırma;
  buraya platformun yayıncı panelindeki OBS/Alert Box bağlantısı girilir.
- Link gizli alanda kilitli saklanır. Değiştirmek için önce **OBS bağlantısını
  kaldır** işlemini onayla. Gizli linki ekran görüntüsü veya destek mesajıyla paylaşma.
- Merkezi DAB/SSB aktifse yerel link yedekte bekler. Aynı anda iki kaynak okunmaz.
  Sunucudaki bağlantıyı yönetmek için **Hesap bağlantılarını aç** düğmesini kullan.
- Yerel API destekli platforma OBS linki eklemek, kaydedilmiş API ayarlarını
  silmez. Link kaldırıldığında API yöntemi yeniden kullanılabilir.

## Yapılan kontroller ve sınırlar

Chrome kurmadan, sahte eklenti API'siyle gerçek tarayıcı motorunda 49 platform /
ekran genişliği kombinasyonu test edildi (320–1280 px). Sekiz dil, Arapça RTL,
hızlı dil geçişi, metin alanındaki taslağın korunması ve sıfır dış çeviri isteği
kontrol edildi. 10 DAB/API/SSB platformunda gerçek arka plan modülüne gönderilen
sahte mesajlarla link kaydı, URL doğrulama, kaldırma, canlı olay adayı ve merkezi
bağlantıda çift okuma engeli doğrulandı. Sözdizimi ve ilgili bağlantı testleri geçti.

Tam eski test kümesinde iki kapsam dışı kontrol başarısızdır: yayımlanmış Firefox
paketinin değiştirilen Chrome kaynağıyla birebir eşitliği ve sitede artık bulunmayan
eski Kick grafik başlığı beklentisi. Firefox mağaza paketi veya site bu görevde
değiştirilmedi. Bunlar ilgili Chrome davranış testlerinin sonucu değildir.

Canlı OAuth, hesap eşleştirme, platformun iframe izinleri, webhook ve gerçek bağış
teslimatı gerçek hesaplarla sınanmadı. Kaynak yüklendi durumu, gerçek bağış teslim
edildi anlamına gelmez. Yeni dil metinleri yerel modellerle hazırlanmış, temel
eylem/gizlilik etiketleri gözden geçirilmiştir; uç durum metinleri kullanıcı
testinde ayrıca değerlendirilebilir.

Görseller: `output/play-connect-local-test/`. Kaynak: `play-connect/`.
Yayın/mağaza paketlerini ancak test sonrası açık talebinle güncelle.
