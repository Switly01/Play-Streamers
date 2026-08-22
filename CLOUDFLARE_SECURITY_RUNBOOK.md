# Play Streamers — kalan Cloudflare güvenlik adımları

Bu dosya sadece Cloudflare panelinden yapılacak, koda bağlı olmayan son
adımları içerir. Worker ve site dosyalarındaki güvenlik değişiklikleri ayrı
olarak hazırlandı.

## 1. D1 migration'ı bir kez uygula

Cloudflare > **Workers & Pages** > **D1** > play-streamers-users >
**Console** yolunu aç. migrations/0002_security_hardening.sql dosyasının
içeriğini yapıştırıp çalıştır.

## 2. Eski Workers KV binding'ini kaldır

Bu Worker sürümü Workers KV kullanmaz; oturumlar, OAuth durumları, doğrulama
kodları ve Kick oturumları D1'de tutulur. Worker'ın bu sürümünü dağıttıktan ve
Google/Kick girişi ile normal giriş akışını doğruladıktan sonra:

1. Cloudflare > **Workers & Pages** > play-streamers-api > **Settings** >
   **Bindings** alanını aç.
2. Eski **Workers KV Namespace** binding'i varsa kaldır ve Worker'ı kaydet/
   yeniden dağıt.

Bu adım KV işlemlerini sıfıra indirir. KV namespace'ini hemen silmek zorunda
değilsin; önce birkaç gün canlı akışları izle. Eski bir Worker sürümü veya
başka bir servis hâlâ namespace'i kullanıyorsa silmek onu bozabilir.

## 3. Rate limiting kuralını kontrol et

Cloudflare > pstreamers.com > **Security** > **Security rules** >
**Rate limiting rules** içindeki giriş kuralının eşleşmesine şu yolları ekle:

- /api/auth/login
- /api/auth/register
- /api/auth/request-password-reset
- /api/auth/request-email-verification
- /api/auth/oauth/start
- /auth/oauth/continue

Önerilen başlangıç: **IP başına 10 istek / 1 dakika**, eylem: **Block**,
süre: **10 dakika**. Gerçek kullanıcı girişlerinde sorun görürsen limiti
20 istek / 1 dakika yap.

## 4. Bot Fight Mode (isteğe bağlı)

Cloudflare > pstreamers.com > **Security** > **Settings** > **Bot Fight
Mode**. Önce iki gün giriş, Google ve Kick akışını gözlemle. Sorun yoksa
etkinleştir. Bir sağlayıcı engellenirse kapatabilir veya istisna kuralı
oluşturabilirsin.

## 5. Güvenlik olaylarını izle

Cloudflare > **Workers & Pages** > play-streamers-api > **Observability**
> **Logs**. Şu olay adları beklenir:

- external_retry
- external_failure
- turnstile_rejected
- kick_token_refreshed
- kick_event_subscription_unavailable

Loglar anahtar, parola, kod, token, çerez veya e-posta içermez.

## 6. Turnstile

Turnstile anahtarları zaten Worker'da tanımlıysa başka işlem gerekmez.
Yeni alan adları eklendiğinde widgetın **Hostnames** listesine
pstreamers.com, www.pstreamers.com ve api.pstreamers.com değerlerinin
eklendiğini doğrula.
