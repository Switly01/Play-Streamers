# Play Streamers — Çalışma Kuralları

Bu depoda değişiklik yapmadan önce `PROJECT_CONTEXT.md`, `index.html` ve
`cloudflare-worker.js` dosyalarını incele. `PROJECT_CONTEXT.md`, ürün kapsamı,
tasarım dili, dağıtım hedefleri ve mevcut teknik öncelikler için kalıcı proje
bağlamıdır.

## Değişiklik ilkeleri

- Çalışan bir akışı kaldırma veya davranışını değiştirme; istenen iyileştirmeyi
  küçük, geri alınabilir ve kontrollü bir değişiklik olarak uygula.
- Proje şu an büyük ölçüde tek `index.html` dosyasındaki CSS/JavaScript ile
  çalışır. Aynı davranışı yöneten eski/yeni katmanların çakışabileceğini varsay;
  yeni kod eklemeden önce ilgili mevcut dinleyicileri, fonksiyonları ve DOM
  öğelerini bul.
- Uzun vadeli hedef, davranış korunarak kodu `index.html`, `styles.css` ve
  `app.js` yapısına sadeleştirmektir. Bu, ayrı bir talep olmadıkça büyük çaplı
  yeniden yazım için izin sayılmaz.
- Arayüz değişikliklerinde Play Streamers'ın koyu, modern, yayıncılık odaklı
  görünümünü ve erişilebilir/okunaklı etkileşimleri koru.
- Kullanıcı akışlarında Türkçe varsayılandır; çoklu dil altyapısını bozma.

## Güvenlik ve gizlilik

- API anahtarı, OAuth client secret, Resend anahtarı, Turnstile secret, Kick
  token'ı veya kullanıcı parolasını hiçbir dosyaya, istemci koduna, commit'e ya
  da sohbete ekleme.
- Turnstile secret yalnızca Worker secret olarak kalmalıdır; frontend'de sadece
  site key bulunabilir.
- Kimlik doğrulama, e-posta kodu, hesap silme ve OAuth davranışlarını
  değiştirirken D1, CORS, rate limiting ve mevcut güvenlik akışlarını koru.

## Her kod değişikliğinden sonra

- Etkilenen HTML/JavaScript ve Worker sözdizimini kontrol et.
- Uygunsa API health ve CORS yapılandırmasını doğrula.
- Değişiklikle ilgili kullanıcı akışını denetle: kayıt, giriş, Google/Kick
  OAuth, hesap tamamlama ve Dashboard geçişi.
- Canlı OAuth/webhook veya bağış verisini gerçek hesap ve yetki olmadan
  çalışıyor varsayma; doğrulanamayan noktayı açıkça belirt.

## Dağıtım sınırları

- Frontend: `index.html`, canlı alan adı `https://pstreamers.com`.
- API: `https://api.pstreamers.com`; eski `workers.dev` yönlendirmelerini
  kullanma.
- Worker değişikliği yoksa sadece frontend dağıtımı yeterli olabilir. Yayına,
  GitHub'a gönderme veya Cloudflare deploy'una ancak kullanıcı açıkça isterse
  geç.
