# Play Connect mağaza yerelleştirmesi — 1.15.3 durumu

9 Eylül 2026 itibarıyla sekiz dil için metinler ve her dilde üç adet 1280×800
ekran görüntüsü hazırdır: tr, en, de, es, fr, ru, ja, ar. Metinlerin kaynağı
`play-connect/store-listing/locales.json`, görsellerin kaynağı
`chrome-web-store-assets/locales/<dil>/` dizinidir.

Chrome geliştirici paneline 1.15.3 Chromium paketi yüklendi. Sekiz dilin uzun
açıklamaları, toplam 24 yerelleştirilmiş ekran görüntüsü ve iki yeni ortak tanıtım
görseli kaydedildi. Sürüm incelemeye gönderildi; panel durumu `İncelenmeyi bekliyor`
olarak doğrulandı ve inceleme geçince otomatik yayımlama açıktır. İnceleme bitene
kadar herkese açık Chrome sürümü 1.15.2 olarak kalır.

Firefox Manifest V2 paketi aynı ortak kaynaklarla 1.15.3'e eşitlendi ve sekiz
`_locales` paketiyle oluşturuldu. `play-connect-gecko-v1.15.3.zip`, Mozilla'nın
otomatik doğrulamasını 0 hata ve 0 uyarıyla geçti. AMO gönderim 6473507 incelemeye
iletildi; yayımlanma onayı henüz gelmedi. Mozilla, işlemin 24 saate kadar veya
manuel incelemede daha uzun sürebileceğini bildirdi.

Mozilla ürün sayfasında Türkçe varsayılanına ek olarak İngilizce (en-us), Almanca,
İspanyolca (es-es), Fransızca, Rusça ve Japonca metinler kayıtlıdır. AMO arayüzünde
Arapça ürün sayfası seçeneği görünmemiştir; buna rağmen eklenti paketinin Arapça
arayüz dosyaları mevcuttur.

Mağaza görüntüleri gerçek hesap verisi değil, yerel tanıtım verisi kullanır.
