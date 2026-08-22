# Play Streamers Desktop

Bu klasör tek Play Streamers masaüstü uygulamasını içerir. `Studio` ayrı bir
uygulama değildir; aynı kabuğun içindeki yayın ve kayıt çalışma alanıdır.

## Sürüm 0.4.0

- React/Vite arayüzü ve 54 araçlık ortak Free / Pro / Product Pro kataloğu,
- cihazda saklanan hızlı notlar ve fikir kasası,
- SW Identity özel bağlantı dönüşü ve Windows güvenli kimlik kasası,
- Tauri 2 Windows kabuğu, tek uygulama örneği ve `playstreamers://` kaydı,
- yerel FFmpeg 9.0.1 Studio motoru,
- GPU kodlayıcı sırası: NVIDIA NVENC, Intel Quick Sync, AMD AMF, Windows Media
  Foundation; uygun donanım bulunamazsa x264,
- GPU öncelikli masaüstü yakalama, WASAPI masaüstü sesi, mikrofon/DirectShow
  ses girişi ve H.264 + AAC MKV kayıt,
- mikrofon ve masaüstü sesi için ayrı, kayıttan önce ayarlanabilen ses düzeyi,
- güvenli RTMPS yayın ve isteğe bağlı tek kodlama akışından eş zamanlı MKV kayıt,
- tüm ekran, belirli oyun/uygulama/tarayıcı penceresi veya kamera kaynağı,
- yerel görsel ve metin katmanı; kayıt/yayın sürerken ana/mola sahnesi geçişi,
- kayıt/yayın sırasında değiştirilebilen masaüstü ve mikrofon ses düzeyi,
- yayın miksiyle birlikte ayrı masaüstü/mikrofon MKV ses kanalları,
- güvenli klasör doğrulamalı MKV → MP4 yeniden paketleme,
- Studio profilleri, canlı klip işaretleri ve sistem genelinde kayıt/yayın kısayolları,
- Windows 11 Media Foundation tabanlı, sürücüsüz `Play Streamers Camera`; Studio
  sahnesini 720p/30 FPS olarak yalnız paylaşımlı bellek üzerinden diğer uygulamalara verir,
- kayıt klasörüne güvenli erişim ve uygulama odaklı kayıt/yayın kısayolları,
- sayaç, hedef hesabı, yayın akışı, teleprompter, bingo, görev, marka, ekipman,
  lisans ve yayın geçmişi çalışma ekranları,
- Studio ayarı ve yayın oturumu özetlerini eşitleyen Worker uçları; ham medya ve
  yayın anahtarı bu eşitlemeye dahil değildir,
- yayın anahtarını Windows Credential Manager dışında hiçbir kalıcı ayara
  yazmayan yayın ayarları,
- Tauri minisign açık anahtarıyla doğrulanan, HTTPS manifestli otomatik
  güncelleme kontrolü ve pasif Windows kurulum akışı.

Studio kaynakları ve temel katmanları gerçek FFmpeg grafiğinde işler. Serbest
sürükle-bırak çok kaynak yerleşimi ve gerçek zamanlı ses seviye ölçümü sonraki
motor katmanlarıdır. Windows 11 sanal kamera uygulama içinden bir kez kurulur;
doğrudan indirme sürümünde kaynak DLL Windows servislerinin okuyabildiği Program
Files konumuna alınır, Store/MSIX sürümünde COM kaydı paket manifestiyle yapılır.

## Windows 11 sanal kamera ve Store paketi

```powershell
.\scripts\build-virtual-camera.ps1
.\scripts\build-store-msix.ps1 -IdentityName '<Partner Center adı>' -Publisher '<Partner Center yayıncısı>'
```

MSIX için sertifika satın almak gerekmez; Microsoft Store sertifikasyon sonrası
paketi Microsoft sertifikasıyla imzalar. Store dağıtımı iki x64 paket kullanır:
Windows 10 2004 ve sonrası için temel paket, Windows 11 için daha yüksek sürümlü
sanal kamera paketi. Store uyumlu cihaza en yüksek uygulanabilir paketi verir.
Windows 10'da Studio, yayın ve kayıt çalışır; sanal kamera bilinçli olarak
desteklenmez ve arayüz bunu açıkça belirtir.

## FFmpeg paketini hazırlama

FFmpeg ikili dosyası depoya eklenmez. Windows paketinden önce doğrulanan sürümü
indirmek için:

```powershell
.\scripts\fetch-ffmpeg.ps1
```

Betik arşivi sabit SHA-256 değeriyle doğrular. Lisans ve kaynak bilgileri
`THIRD_PARTY_NOTICES.md` dosyasındadır.

## Geliştirme

```text
pnpm install
pnpm run build
pnpm run desktop
pnpm run desktop:build
```

Oturum ve yayın anahtarları kaynak dosyalara veya `localStorage` alanına
yazılmaz. Yalnız güvenli kasa referansı ayarlarda tutulur.
