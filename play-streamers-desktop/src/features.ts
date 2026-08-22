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
  { id: "live-events", title: "Canlı olay akışı", description: "Abone, hediye, Kicks ve bağış olaylarını aynı zaman çizgisinde gösterir.", section: "live", minimumTier: "free", status: "foundation" },
  { id: "goal-board", title: "Hedef panosu", description: "Yayın hedeflerini görünür, ölçülebilir ve bölüm bazlı tutar.", section: "live", minimumTier: "free", status: "foundation" },

  { id: "studio-scenes", title: "Sahneler ve kaynaklar", description: "Ekran, pencere, oyun, kamera, görsel, metin ve tarayıcı kaynaklarını düzenler.", section: "studio", minimumTier: "free", status: "foundation", localFirst: true },
  { id: "studio-record", title: "Yerel kayıt", description: "Ekran ve sesi cihazda kaydeder; kayıt dosyası buluta gönderilmez.", section: "studio", minimumTier: "free", status: "ready", localFirst: true },
  { id: "studio-stream", title: "Canlı yayın", description: "Studio sahnesini yayın anahtarıyla canlı platforma gönderir.", section: "studio", minimumTier: "free", status: "foundation", localFirst: true },
  { id: "studio-mixer", title: "Ses mikseri", description: "Mikrofon ve masaüstü sesini ayrı ayrı izler ve yönetir.", section: "studio", minimumTier: "free", status: "foundation", localFirst: true },
  { id: "studio-hotkeys", title: "Kısayollar", description: "Uygulama odaktayken kayıt ve yayını klavyeden başlatır; genel sistem kısayolları sonraki aşamadır.", section: "studio", minimumTier: "free", status: "foundation", localFirst: true },
  { id: "studio-recovery", title: "Kayıt kurtarma", description: "MKV kaydı ve kontrollü motor kapanışıyla beklenmeyen kapanmalarda görüntüyü mümkün olduğunca korur.", section: "studio", minimumTier: "free", status: "foundation", localFirst: true },
  { id: "studio-multitrack", title: "Çok kanallı ses kaydı", description: "Yayın miksini, mikrofonu ve masaüstü sesini düzenleme için ayrı MKV kanallarında tutar.", section: "studio", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "studio-virtual-camera", title: "Sanal kamera", description: "Windows 11'de Studio sahnesini Zoom, Discord, Teams ve tarayıcılara kamera olarak sunar.", section: "studio", minimumTier: "pro", status: "ready", localFirst: true },
  { id: "studio-transition-lab", title: "Geçiş laboratuvarı", description: "Marka renkli geçiş ekranlarını önizleyip yerel HTML paketi olarak dışa aktarır.", section: "studio", minimumTier: "pro", status: "foundation", localFirst: true },

  { id: "basic-stats", title: "Temel yayın özeti", description: "Yayın süresi, tepe izleyici ve toplam etkileşimi gösterir.", section: "analysis", minimumTier: "free", status: "foundation" },
  { id: "advanced-graphs", title: "Gelişmiş grafikler", description: "Yayınları saat, bölüm ve olay türüne göre karşılaştırır.", section: "analysis", minimumTier: "pro", status: "foundation" },
  { id: "after-stream-report", title: "Yayın sonrası rapor", description: "İyi giden anları, düşüşleri ve bir sonraki yayın için net işleri çıkarır.", section: "analysis", minimumTier: "pro", status: "foundation" },
  { id: "data-export", title: "CSV dışa aktarma", description: "Tamamlanmış Studio yayınlarını tablo uygulamalarına uygun CSV olarak dışa aktarır.", section: "analysis", minimumTier: "pro", status: "foundation" },
  { id: "channel-memory", title: "Kanal hafızası", description: "Önceki yayın kararlarını, sonuçlarını ve tekrar eden örüntüleri cihazında saklar.", section: "analysis", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "stream-intelligence", title: "Yayın zekâsı", description: "Sayısal kanıtları anlaşılır Türkçe açıklamalara dönüştürür.", section: "analysis", minimumTier: "product-pro", status: "foundation", ai: true },
  { id: "audience-pulse", title: "İzleyici nabzı", description: "Etkileşim hızını sessiz, dengeli veya yükselen olarak açıklar.", section: "analysis", minimumTier: "product-pro", status: "foundation", ai: true },
  { id: "smart-alerts", title: "Akıllı bildirimler", description: "Açık bir değişim eşiğiyle yalnız gerçekten anlamlı fark oluştuğunda uyarır.", section: "analysis", minimumTier: "product-pro", status: "foundation" },
  { id: "goal-route", title: "Hedef rotası", description: "Hedefe giden yolu yayın sayısı ve gerekli ortalama üzerinden hesaplar.", section: "analysis", minimumTier: "product-pro", status: "foundation" },

  { id: "idea-vault", title: "Fikir kasası", description: "Yayın ve video fikirlerini etiketleyip tek tıkla çalışma planına taşır.", section: "content", minimumTier: "free", status: "ready", localFirst: true },
  { id: "stream-script", title: "Yayın akışı", description: "Açılış, bölümler, mola ve kapanışı sürükle-bırak akışa dönüştürür.", section: "content", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "teleprompter", title: "Teleprompter", description: "Akış notlarını ayarlanabilir hız ve boyutla Studio üzerinde gösterir.", section: "content", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "clip-markers", title: "Klip işaretleri", description: "Önemli anları notlarıyla kaydeder; Studio zaman damgası bağlantısı sıradaki motor adımıdır.", section: "content", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "content-repurpose", title: "İçerik dönüştürücü", description: "Doğruladığın yayın özeti ve öne çıkan andan kısa video, gönderi ve devam bölümü taslağı çıkarır.", section: "content", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "speech-coach", title: "Konuşma koçu", description: "Yerel ses kaydındaki sessizlik oranını, en uzun sessizliği ve konuşma bloklarını ölçer.", section: "content", minimumTier: "product-pro", status: "foundation", localFirst: true },

  { id: "stream-challenges", title: "Yayın görevleri", description: "Yayın içinde tamamlanabilen kişisel görev ve seri kartları oluşturur.", section: "community", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "silence-rescuer", title: "Sessiz an kurtarıcı", description: "Uzun sessizlikte kullanılacak konu ve mini görev havuzunu hazır tutar.", section: "community", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "stream-bingo", title: "Yayın bingosu", description: "Dokuz hücreli yayın kartını cihazında oluşturur ve yayın sırasında ilerletir.", section: "community", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "secret-codes", title: "Gizli kodlar", description: "Yayındaki kodların sürprizlerini ve kullanım kurallarını yerel çalışma alanında tutar.", section: "community", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "community-seasons", title: "Topluluk sezonları", description: "Aylık tema, görev ve ortak ilerleme kartları oluşturur.", section: "community", minimumTier: "product-pro", status: "foundation" },
  { id: "no-code-minigames", title: "Kodsuz mini oyunlar", description: "İki seçenek, hızlı tahmin ve görev seçimi için oyun kartları hazırlar.", section: "community", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "interactive-story", title: "Etkileşimli hikâye", description: "İki seçenekli karar kartlarıyla izleyici yönlendirmeli yayın bölümleri tasarlar.", section: "community", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "time-capsule", title: "Topluluk zaman kapsülü", description: "Mesaj ve hedefleri gelecekteki bir yayın için cihazında saklar.", section: "community", minimumTier: "product-pro", status: "foundation", localFirst: true },

  { id: "overlay-studio", title: "Görsel yayın stüdyosu", description: "Başlık ve etiket görsellerini marka rengiyle düzenleyip şeffaf HTML overlay olarak dışa aktarır.", section: "brand", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "soundboard", title: "Ses panosu", description: "Yerel ses dosyalarını oturum içinde tek dokunuşla çalışan bir panoda çalar.", section: "brand", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "brand-kit", title: "Marka kiti", description: "Renk, yazı, logo ve görsel kullanım kurallarını tek çalışma alanında tutar.", section: "brand", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "motion-identity", title: "Hareketli kimlik", description: "Marka renginden animasyonlu alt bant üretip şeffaf HTML paketi olarak dışa aktarır.", section: "brand", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "emote-badge-studio", title: "Emote ve rozet stüdyosu", description: "Renk ve kısa işaretten 112, 56 ve 28 piksel PNG rozetler üretir.", section: "brand", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "media-kit", title: "Canlı medya kiti", description: "Doğruladığın kanal bilgileri ve metriklerle paylaşılabilir yerel marka sayfası oluşturur.", section: "brand", minimumTier: "product-pro", status: "foundation", localFirst: true },

  { id: "supporter-map", title: "Destekçi haritası", description: "Doğrulanmış Studio oturumlarında destek ve gelir değişimini dönem bazında gösterir.", section: "revenue", minimumTier: "product-pro", status: "foundation" },
  { id: "revenue-cockpit", title: "Gelir kokpiti", description: "Doğrulanmış yayın oturumlarındaki gelir özetini ortak para görünümünde gösterir.", section: "revenue", minimumTier: "product-pro", status: "foundation" },
  { id: "monetization-gates", title: "Gelir kilometre taşları", description: "Hedefi mevcut değer, kalan yayın ve gerekli ortalama üzerinden aşamalara böler.", section: "revenue", minimumTier: "product-pro", status: "foundation" },

  { id: "file-vault", title: "Dosya kasası", description: "Yayın görselleri, sesleri ve belgeleri cihazda düzenli tutar.", section: "vault", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "snapshots", title: "Çalışma alanı anlık görüntüsü", description: "Studio, araç ve tema ayarlarını oturum bilgisi içermeyen geri yüklenebilir dosya olarak saklar.", section: "vault", minimumTier: "product-pro", status: "foundation", localFirst: true },
  { id: "equipment-log", title: "Ekipman günlüğü", description: "Cihaz, bakım, garanti ve yayın profili notlarını cihazında saklar.", section: "vault", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "music-license-log", title: "Müzik izin günlüğü", description: "Kullanılan müzik, lisans kaynağı ve kanıt notlarını cihazında tutar.", section: "vault", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "wellbeing", title: "Yayıncı denge merkezi", description: "Mola aralığını ve yayın süresi sınırını cihazda çalışan sayaçla izler.", section: "vault", minimumTier: "pro", status: "foundation", localFirst: true },

  { id: "layouts", title: "Çalışma alanı düzenleri", description: "Farklı yayın türleri için düzen profillerini cihazında kaydeder.", section: "settings", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "themes", title: "Arayüz temaları", description: "Okunaklı koyu tema varyasyonları ve vurgu renkleri sunar.", section: "settings", minimumTier: "pro", status: "foundation", localFirst: true },
  { id: "insider", title: "Insider kanalı", description: "Deneysel sürüm tercihini kararlı araçlardan ayrı ve açık onayla yönetir.", section: "settings", minimumTier: "pro", status: "foundation", localFirst: true },
];

export function canUseFeature(tier: PlanTier, feature: FeatureDefinition) {
  return tierRank[tier] >= tierRank[feature.minimumTier];
}

export function featuresForSection(section: AppSection) {
  return FEATURES.filter((feature) => feature.section === section);
}
