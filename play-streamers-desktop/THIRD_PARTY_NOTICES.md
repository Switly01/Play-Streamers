# Third-party notices

Play Streamers Desktop paketinde ayrı bir yardımcı işlem olarak **FFmpeg
9.0.1 Essentials Build** bulunur.

- Upstream: https://ffmpeg.org/
- Windows build: https://www.gyan.dev/ffmpeg/builds/
- Upstream source commit: https://github.com/FFmpeg/FFmpeg/commit/bf1b838f2a
- Archive SHA-256: `fec81ae03971d9dd4be3ebe02e263bd2ec1d789483f931bdba5f5715e65da2e9`
- Build license: GPL version 3

Paketle birlikte `FFMPEG-GPL-3.0-LICENSE.txt` ve sağlayıcının derleme ayrıntılarını
içeren `FFMPEG-BUILD-README.txt` dosyaları dağıtılır. Play Streamers, FFmpeg'i
değiştirmeden ayrı bir süreç olarak çalıştırır.

## Microsoft Windows-Camera VirtualCamera sample

Play Streamers Camera'nın Media Foundation kaynak bileşeni, Microsoft'un MIT
lisanslı Windows-Camera `Samples/VirtualCamera` örneğinden uyarlanmıştır.

- Upstream: https://github.com/microsoft/Windows-Camera/tree/master/Samples/VirtualCamera
- Lisans: MIT

Paketle birlikte `MICROSOFT-WINDOWS-CAMERA-LICENSE.txt` dağıtılır. Play Streamers'a
özgü CLSID, Studio paylaşımlı bellek kare protokolü, kurulum yöneticisi ve arayüz
entegrasyonu bu depoda geliştirilmiştir.
