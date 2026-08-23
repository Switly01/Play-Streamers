import type { AppSection, FeatureDefinition, PlanTier } from "./types";

export const tierRank: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
  "product-pro": 2,
};

export const planLabels: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  "product-pro": "Product Pro",
};

export const sectionLabels: Record<AppSection, string> = {
  home: "Başlangıç",
  live: "Canlı merkez",
  studio: "Studio",
  analysis: "Analiz",
  content: "İçerik",
  community: "Topluluk",
  brand: "Marka",
  revenue: "Gelir",
  vault: "Kasa",
  settings: "Ayarlar",
};

export const FEATURES: FeatureDefinition[] = [
  { id: "home-command-center", title: "Yayın komuta merkezi", description: "Bugünün hazırlığını, hedefini ve son yayın sonucunu tek ekranda toplar.", section: "home", minimumTier: "free", status: "ready" },
  { id: "quick-notes", title: "Hızlı notlar", description: "Yayın sırasında tek tuşla zaman damgalı not bırakır.", section: "home", minimumTier: "free", status: "ready", localFirst: true },
  { id: "stream-timer", title: "Yayın sayacı", description: "Yayın, mola ve bölüm sürelerini sade bir sayaçta izler.", section: "live", minimumTier: "free", status: "ready", localFirst: true },
  { id: "live-events", title: "Canlı olay akışı", description: "Abone, hediye, Kicks ve bağış olaylarını aynı zaman çizgisinde gösterir.", section: "live", minimumTier: "free", status: "ready" },
  { id: "goal-board", title: "Hedef panosu", description: "Yayın hedeflerini görünür, ölçülebilir ve bölüm bazlı tutar.", section: "live", minimumTier: "free", status: "ready" },

  { id: "studio-scenes", title: "Sahneler ve kaynaklar", description: "Sekiz kalıcı sahnede 12 sıralanabilir ek kaynağı düzenler; kaynakları çalışan grafikte canlı gizler, gösterir ve opaklığını değiştirir; ayrı Önizleme/Program akışı ile kesme, crossfade veya siyaha kararma kullanır.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-record", title: "Yerel kayıt ve replay", description: "Ekran ve sesi cihazda kaydeder; 15–120 saniyelik döngüsel replay buffer ile son anı ayrı MKV olarak korur. Medya buluta gönderilmez.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-stream", title: "Canlı yayın", description: "Studio programını güvenli RTMPS ile yayınlar; bağlantı kesilirse beş kez kontrollü yeniden bağlanır.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-mixer", title: "Ses mikseri", description: "Mikrofon ve masaüstü sesini gerçek metreler, canlı kazanç, gürültü azaltma, gate, compressor ve limiter ile yönetir.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-hotkeys", title: "Kısayollar", description: "Kayıt, yayın ve replay kaydını Ctrl + Alt + R / L / B genel sistem kısayollarıyla yönetir.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-recovery", title: "Kayıt kurtarma", description: "MKV kaydı ve kontrollü motor kapanışıyla beklenmeyen kapanmalarda görüntüyü mümkün olduğunca korur.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-multitrack", title: "Çok kanallı ses kaydı", description: "Yayın miksini, mikrofonu ve masaüstü sesini düzenleme için ayrı MKV kanallarında tutar.", section: "studio", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "studio-virtual-camera", title: "Sanal kamera", description: "Windows 11'de Studio sahnesini Zoom, Discord, Teams ve tarayıcılara kamera olarak sunar.", section: "studio", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "studio-transition-lab", title: "Geçiş laboratuvarı", description: "Marka renkli geçiş ekranlarını önizleyip yerel HTML paketi olarak dışa aktarır.", section: "studio", minimumTier: "pro", status: "ready", localFirst: true },

  { id: "basic-stats", title: "Temel yayın özeti", description: "Yayın süresi, tepe izleyici ve toplam etkileşimi gösterir.", section: "analysis", minimumTier: "free", status: "ready" },
  { id: "advanced-graphs", title: "Gelişmiş grafikler", description: "Tamamlanan yayınların tepe izleyici ve etkileşim değerlerini tarih sırasıyla karşılaştırır.", section: "analysis", minimumTier: "pro", status: "ready" },
  { id: "after-stream-report", title: "Yayın sonrası rapor", description: "Doğrulanmış oturum verisinden farkları ve bir sonraki ölçüm adımını çıkarır; bilinmeyen nedenleri uydurmaz.", section: "analysis", minimumTier: "pro", status: "ready" },
  { id: "data-export", title: "CSV dışa aktarma", description: "Tamamlanmış Studio yayınlarını tablo uygulamalarına uygun CSV olarak dışa aktarır.", section: "analysis", minimumTier: "pro", status: "ready" },
  { id: "channel-memory", title: "Kanal hafızası", description: "Önceki yayın kararlarını, gözlenen sonuçları ve sonraki ölçüm adımını cihazında saklar.", section: "analysis", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "stream-intelligence", title: "Yayın zekâsı", description: "Sayısal kanıtları anlaşılır Türkçe açıklamalara dönüştürür.", section: "analysis", minimumTier: "product-pro", status: "ready", ai: true },
  { id: "audience-pulse", title: "İzleyici nabzı", description: "Etkileşim hızını sessiz, dengeli veya yükselen olarak açıklar.", section: "analysis", minimumTier: "product-pro", status: "ready", ai: true },
  { id: "smart-alerts", title: "Akıllı bildirimler", description: "Açık bir değişim eşiğiyle yalnız gerçekten anlamlı fark oluştuğunda uyarır.", section: "analysis", minimumTier: "product-pro", status: "ready" },
  { id: "goal-route", title: "Hedef rotası", description: "Hedefe giden yolu yayın sayısı ve gerekli ortalama üzerinden hesaplar.", section: "analysis", minimumTier: "product-pro", status: "ready" },

  { id: "idea-vault", title: "Fikir kasası", description: "Yayın ve video fikirlerini ayrıntılarıyla cihazında toplar, sıralar ve yedekler.", section: "content", minimumTier: "free", status: "ready", localFirst: true },
  { id: "stream-script", title: "Yayın akışı", description: "Açılış, bölümler, mola ve kapanışı sıralanabilir bir yayın planına dönüştürür.", section: "content", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "teleprompter", title: "Teleprompter", description: "Akış notlarını ayarlanabilir hız ve yazı boyutuyla tam ekran okunabilir görünümde kaydırır.", section: "content", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "clip-markers", title: "Klip işaretleri", description: "Önemli yayın ve kayıt anlarını oluşturulma zamanı ve notlarıyla cihazında saklar.", section: "content", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "content-repurpose", title: "İçerik dönüştürücü", description: "Girdiğin yayın özeti ve öne çıkan andan kısa video metni, gönderi ve devam bölümü taslağı çıkarır.", section: "content", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "speech-coach", title: "Konuşma koçu", description: "Yerel ses kaydındaki sessizlik oranını, en uzun sessizliği ve konuşma bloklarını ölçer.", section: "content", minimumTier: "product-pro", status: "ready", localFirst: true },

  { id: "stream-challenges", title: "Yayın görevleri", description: "Yayın içinde tamamlanabilen kişisel görev ve seri kartları oluşturur.", section: "community", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "silence-rescuer", title: "Sessiz an kurtarıcı", description: "Uzun sessizlikte kullanılacak konu ve mini görev havuzunu hazır tutar.", section: "community", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "stream-bingo", title: "Yayın bingosu", description: "Dokuz hücreli yayın kartını cihazında oluşturur ve yayın sırasında ilerletir.", section: "community", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "secret-codes", title: "Gizli kodlar", description: "Yayındaki kodların sürprizlerini ve kullanım kurallarını yerel çalışma alanında tutar.", section: "community", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "community-seasons", title: "Topluluk sezonları", description: "Aylık tema, görev ve ortak ilerleme kartları oluşturur.", section: "community", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "no-code-minigames", title: "Kodsuz mini oyunlar", description: "İki seçenek, hızlı tahmin ve görev seçimi için oyun kartları hazırlar.", section: "community", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "interactive-story", title: "Etkileşimli hikâye", description: "İki seçenekli karar kartlarıyla izleyici yönlendirmeli yayın bölümleri tasarlar.", section: "community", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "time-capsule", title: "Topluluk zaman kapsülü", description: "Mesaj ve hedefleri gelecekteki bir yayın için cihazında saklar.", section: "community", minimumTier: "product-pro", status: "ready", localFirst: true },

  { id: "overlay-studio", title: "Görsel yayın stüdyosu", description: "Başlık ve etiket görsellerini marka rengiyle düzenleyip şeffaf HTML overlay olarak dışa aktarır.", section: "brand", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "soundboard", title: "Ses panosu", description: "Yerel ses dosyalarını oturum içinde tek dokunuşla çalışan bir panoda çalar.", section: "brand", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "brand-kit", title: "Marka kiti", description: "Renk, yazı, logo ve görsel kullanım kurallarını tek çalışma alanında tutar.", section: "brand", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "motion-identity", title: "Hareketli kimlik", description: "Marka renginden animasyonlu alt bant üretip şeffaf HTML paketi olarak dışa aktarır.", section: "brand", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "emote-badge-studio", title: "Emote ve rozet stüdyosu", description: "Renk ve kısa işaretten 112, 56 ve 28 piksel PNG rozetler üretir.", section: "brand", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "media-kit", title: "Canlı medya kiti", description: "Doğruladığın kanal bilgileri ve metriklerle paylaşılabilir yerel marka sayfası oluşturur.", section: "brand", minimumTier: "product-pro", status: "ready", localFirst: true },

  { id: "supporter-map", title: "Destekçi haritası", description: "Doğrulanmış destek olaylarını destekçi ve para birimi bazında gruplar.", section: "revenue", minimumTier: "product-pro", status: "ready" },
  { id: "revenue-cockpit", title: "Gelir kokpiti", description: "Play Connect ve sağlayıcıdan doğrulanan destek toplamlarını para birimlerini karıştırmadan gösterir.", section: "revenue", minimumTier: "product-pro", status: "ready" },
  { id: "monetization-gates", title: "Gelir kilometre taşları", description: "Hedefi mevcut değer, kalan yayın ve gerekli ortalama üzerinden aşamalara böler.", section: "revenue", minimumTier: "product-pro", status: "ready" },

  { id: "file-vault", title: "Dosya kasası", description: "Yayın görselleri, sesleri ve belgeleri taşımadan yerel bir dosya indeksinde düzenler.", section: "vault", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "snapshots", title: "Çalışma alanı anlık görüntüsü", description: "Studio, araç ve tema ayarlarını oturum bilgisi içermeyen geri yüklenebilir dosya olarak saklar.", section: "vault", minimumTier: "product-pro", status: "ready", localFirst: true },
  { id: "equipment-log", title: "Ekipman günlüğü", description: "Cihaz, bakım, garanti ve yayın profili notlarını cihazında saklar.", section: "vault", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "music-license-log", title: "Müzik izin günlüğü", description: "Kullanılan müzik, lisans kaynağı ve kanıt notlarını cihazında tutar.", section: "vault", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "wellbeing", title: "Yayıncı denge merkezi", description: "Mola aralığını ve yayın süresi sınırını cihazda çalışan sayaçla izler.", section: "vault", minimumTier: "pro", status: "ready", localFirst: true },

  { id: "layouts", title: "Çalışma alanı düzenleri", description: "Studio ayarı, sahne düzeni ve temayı adlandırılmış yerel profiller olarak kaydedip uygular.", section: "settings", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "themes", title: "Arayüz temaları", description: "Okunaklı koyu tema varyasyonları ve vurgu renkleri sunar.", section: "settings", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "insider", title: "Insider kanalı", description: "Deneysel sürüm tercihini kararlı araçlardan ayrı ve açık onayla yönetir.", section: "settings", minimumTier: "pro", status: "ready", localFirst: true },
];

export function canUseFeature(tier: PlanTier, feature: FeatureDefinition) {
  return tierRank[tier] >= tierRank[feature.minimumTier];
}

export function featuresForSection(section: AppSection) {
  return FEATURES.filter((feature) => feature.section === section);
}
