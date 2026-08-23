# Play Connect

Chrome Manifest V3 eklentisi; API, sunucu bildirimi veya OBS/Alert Box
bağlantısıyla donate hareketlerini Play Streamers
hesabına bağlar.

## Desteklenen platformlar ve otomatik bağlantı seçimi

Ana ekranda:

- ByNoGame
- Klasgame
- Streamlabs
- StreamElements

“Diğerleri” bölümünde:

- Pindirim
- Oyunfor
- İtemSatış
- Oyuneks
- Hesap.com.tr
- Dijipin
- EPİN
- İnovapin
- Ko-fi
- Buy Me a Coffee
- TipeeeStream
- DonationAlerts
- Pally.gg
- Streamloots
- DeStream
- LivePix
- Saweria
- Trakteer
- SociaBuzz
- Tipply
- Toonation
- Doneru

Katalog toplam 26 platform içerir. Katalog yalnız yayıncıya doğrudan destek
aktaran ve canlı yayın kullanımı bulunan servisleri içerir. Play Connect her platformu aynı kırılgan
sayfa okuyucusundan geçirmez. Uygun olanlarda doğrudan API, platformun desteklediği
durumlarda kişisel sunucu bildirim adresi, diğerlerinde yayıncı panelinden alınan
OBS Browser Source / Alert Box bağlantısı kullanılır. Birincil yöntem çalışmazsa yalnızca o platform için
tanımlı güvenli yedek yöntem devreye alınabilir.

## Çalışma biçimi

- API sunmayan platformlarda kullanıcı yayıncı panelindeki **OBS**, **Browser
  Source**, **Alert Box**, **bildirim bağlantısı** veya **Overlay** adresini
  Play Connect'e yapıştırır. Platform hesabı ya da parolası eklentiye girilmez.
- Bağlantı Klasgame, Oyunfor, EPİN, Dijipin, İnovapin, Pindirim veya
  Hesap.com.tr'nin kendi alan adından gelebileceği gibi Streamlabs ya da
  StreamElements üzerinde de olabilir. Sağlayıcı bağlantının alan adından
  otomatik belirlenir; doğrulanmamış bir platforma sabit etiket atanmaz.
- Streamlabs resmî donation API'sini, StreamElements resmî `channel.tips`
  WebSocket akışını, TipeeeStream resmî Events API'sini ve DonationAlerts resmî
  Donations API'sini destekler. Pally.gg destek olayları platformun canlı
  WebSocket akışından alınır. Bu sağlayıcıların erişim anahtarları yerel
  Chrome profilinde kalır.
- İtemSatış, Ko-fi ve Buy Me a Coffee için Play Streamers hesabından kişisel
  ve iptal edilebilir bir bildirim adresi oluşturulabilir. Adres platforma bir kez
  eklenince olaylar Chrome veya platform sekmesi açık olmasa da doğrudan Worker'a
  gelir. Bu adres bir parola gibi korunmalı ve herkese açık paylaşılmamalıdır.
- Sunucu bildirim bağlantısı etkin olan platform eklentide otomatik olarak
  `Sunucu bağlantısı aktif` görünür ve çift donate oluşmaması için aynı
  platformun yerel sayfa taraması durdurulur.
- OBS bağlantıları Chrome'un görünmeyen offscreen belgesinde iframe olarak
  çalışır; kullanıcıya platform sekmesi açılmaz. Bağlantının `fetch`, XHR,
  WebSocket ve Server-Sent Events olayları yerelde izlenir. Görünür ana sayfa
  kartları taranmaz.
  Kaydedilen bağlantı kaldırılıncaya kadar kilitli kalır; kullanıcı bağlantıyı
  açıkça kaldırmadan adres silinmez veya başka bir adresle değiştirilemez.
  Alert sayfasının kendi OBS sesi, medya oynatımı, Web Audio ve sesli okuması
  görünmeyen çerçevede susturulur; Play Connect yalnızca donate verisini işler.
  Ağ cevabı ortak JSON alanlarından ayrıştırılamazsa ekranda gerçekten oluşan
  OBS alert kartı ikinci bir güvenli kaynak olarak okunur. Ağdan yakalanan olay
  öncelikli tutulur, böylece aynı donate karttan ikinci kez kuyruğa alınmaz.
  Yalnızca olay kimliği, bağışçı, tutar, para birimi, mesaj ve zaman alanları
  ayrılır; platform yanıtının geri kalanı Play Streamers sunucusuna taşınmaz.
- Platformun verdiği işlem kimliği donate kimliği olarak kullanılır. Platform
  kimlik vermiyorsa aynı taramadaki ayrı satırlara birbirinden farklı yerel olay
  kimliği atanır. Yalnız sunucu tarafından onaylanmış aynı kimlik tekrar
  gönderilmez; daha önce görülmüş fakat hiç kuyruğa alınmamış bir kayıt sessizce
  "eski" sayılmaz.
- OBS bağlantısı bir hesap anahtarı gibi gizlidir. Ekranda tekrar gösterilmez,
  `chrome.storage.local` içinde tutulur ve Play Streamers sunucusuna gönderilmez.
- Yakalanan olay önce kalıcı yerel kuyruğa girer. Olay yalnız Play Streamers
  sunucusu açık bir teslimat onayı verdiğinde kuyruktan çıkar ve gönderilmiş
  olay defterine yazılır. Geçici hata olursa artan aralıklarla yeniden denenir.
- OBS bağlantısının ilk yüklemesindeki geçmiş olaylar başlangıç kaydı olarak
  ayrılır ve sunucuya gönderilmez. Canlı akıştan gelen yeni olaylar 1 saniyelik
  aktif kontrol çevrimi beklenmeden doğrudan kuyruğa alınır; çevrim bağlantı ve
  geçici teslimat hataları için hızlı yedektir.
- Sunucuda aynı kimlikle zaten bulunan olay da teslim edilmiş kabul edilip
  kuyruktan çıkarılır; fakat ikinci kez Dashboard toplamına veya onaylı olay
  sayısına eklenmez.
- Eşleştirme kodu sunucuda Play Streamers kullanıcı kimliğine bağlanır. Bu
  koddan alınan cihaz anahtarıyla gönderilen donate, yalnız eşleşen hesabın D1
  kayıtlarına ve o hesabın Dashboard Donate kartına gider.
- Platform parolaları, çerezleri, işlem geçmişi adresleri ve API anahtarları
  Play Streamers sunucusuna gönderilmez. Sunucuya yalnızca normalize edilmiş
  donate olayı gönderilir.
- OBS sayfası iframe kullanımını engellerse Play Connect bunu bağlantı hatası
  olarak gösterir. Gerçek platform hesabının test donate aracı kullanılmadan
  bütün sağlayıcı akışları uçtan uca doğrulanmış kabul edilmez.

## Chrome'a kurma

1. ZIP dosyasını ayrı bir klasöre çıkar.
2. Chrome'da `chrome://extensions/` adresini aç.
3. Sağ üstten **Geliştirici modu** seçeneğini aç.
4. **Paketlenmemiş öğe yükle** düğmesine bas.
5. İçinde `manifest.json` bulunan `play-connect` klasörünü seç.
6. Play Streamers sitesinde **Hesabım → Bağlantılar** bölümünden eşleştirme kodu
   oluştur ve eklentinin ayarlar ekranına gir.

## Güvenlik

- 16 karakterli eşleştirme kodu 10 dakika geçerli ve tek kullanımlıktır.
- Sunucu cihaz anahtarının yalnızca SHA-256 özetini saklar.
- Eklentideki cihaz anahtarı `chrome.storage.local` içinde tutulur ve senkronize
  edilmez.
- Her sağlayıcı yalnızca manifestte izin verilen kendi alan adına veya ortak
  Streamlabs/StreamElements alert alanına erişebilir.
- API ve doğrulanmış OBS alert bağlantıları Chrome açıkken görünür platform
  sayfasından bağımsız çalışır. Chrome tamamen kapalıyken yalnız doğrudan sunucu
  webhook'u olan bağlantılar veri almaya devam eder.
