import { useEffect, useMemo, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { FEATURES, canUseFeature, featuresForSection, planLabels, sectionLabels } from "./features";
import { FeatureWorkspace } from "./FeatureWorkspace";
import { openExternal } from "./nativeBridge";
import { installLiveI18n } from "./liveI18n";
import type { AppSection, FeatureDefinition, PlanTier } from "./types";

const NAVIGATION: Array<{ id: AppSection; icon: string }> = [
  { id: "home", icon: "⌂" },
  { id: "live", icon: "◉" },
  { id: "analysis", icon: "↗" },
  { id: "content", icon: "✦" },
  { id: "community", icon: "◎" },
  { id: "brand", icon: "◇" },
  { id: "revenue", icon: "₺" },
  { id: "vault", icon: "□" },
  { id: "settings", icon: "⚙" },
];

const STATUS_LABELS = {
  ready: "Kullanılabilir",
  foundation: "Erken sürüm",
  planned: "Sırada",
} as const;

const API_BASE = "https://api.pstreamers.com";
const IS_STORE_BUILD = import.meta.env.VITE_DISTRIBUTION_CHANNEL === "store";

interface DesktopSessionSummary {
  id: string;
  startedAt: number;
  endedAt: number | null;
  peakViewers: number;
  interactions: number;
  followersGained: number;
  revenueMinor: number;
  summary?: { durationSeconds?: number; averageViewers?: number; sampleCount?: number; collector?: string };
}

interface StreamMonitor {
  connected: boolean;
  status: "live" | "ended" | "offline" | "not-connected";
  title?: string;
  startedAt?: number | null;
  currentViewers?: number;
  peakViewers?: number;
  lastCheckedAt?: number;
  healthy?: boolean;
}

function useLocalList(key: string, initial: string[]) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as string[]) : initial;
    } catch {
      return initial;
    }
  });
  const update = (next: string[]) => {
    setItems(next);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return [items, update] as const;
}

export function App() {
  const [section, setSection] = useState<AppSection>("home");
  const [plan, setPlan] = useState<PlanTier>("free");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [identityStatus, setIdentityStatus] = useState("Güvenli SW Identity");
  const [sessions, setSessions] = useState<DesktopSessionSummary[]>([]);
  const [streamMonitor, setStreamMonitor] = useState<StreamMonitor>({ connected: false, status: "not-connected", healthy: true });
  const [search, setSearch] = useState("");
  const [selectedFeature, setSelectedFeature] = useState<FeatureDefinition | null>(null);
  const [updateState, setUpdateState] = useState<{ phase: "idle" | "checking" | "available" | "installing" | "current" | "error"; version?: string; message: string }>({ phase: "idle", message: "Güncellemeleri denetle" });
  const [locale, setLocale] = useState(() => localStorage.getItem("ps.locale") || "tr");
  const [notes, setNotes] = useLocalList("ps.quick-notes", ["Yayın açılışında yeni hedefi anlat", "Mola öncesi soru kutusunu aç"]);
  const [ideas, setIdeas] = useLocalList("ps.idea-vault", ["İzleyici seçimli oyun gecesi", "Yayın kurulumunun kamera arkası"]);

  const visibleFeatures = useMemo(() => {
    const source = search.trim() ? FEATURES : featuresForSection(section);
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    return needle ? source.filter((feature) => `${feature.title} ${feature.description}`.toLocaleLowerCase("tr-TR").includes(needle)) : source;
  }, [search, section]);
  useEffect(() => {
    localStorage.setItem("ps.locale", locale);
    return installLiveI18n(locale);
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.theme = localStorage.getItem("ps.theme") || "violet";
    let disposed = false;
    async function bootstrap() {
      const token = window.playStreamersNative
        ? await window.playStreamersNative.secureRead("ps.session")
        : sessionStorage.getItem("ps.session");
      if (!token || disposed) return;
      const response = await fetch(`${API_BASE}/api/platform/bootstrap`, { headers: { authorization: `Bearer ${token}` } });
      const data = await response.json().catch(() => null) as { signedIn?: boolean; user?: { name?: string }; plan?: { tier?: PlanTier }; recentSessions?: DesktopSessionSummary[]; sessions?: DesktopSessionSummary[]; streamMonitor?: StreamMonitor } | null;
      if (!disposed && response.ok && data?.signedIn) {
        setPlan(data.plan?.tier || "free");
        setAccountName(data.user?.name || "SW hesabı");
        setSessions(Array.isArray(data.recentSessions) ? data.recentSessions : Array.isArray(data.sessions) ? data.sessions : []);
        setStreamMonitor(data.streamMonitor || { connected: false, status: "not-connected", healthy: true });
        setIdentityStatus("Hesap ve plan eşitlendi");
      }
    }
    void bootstrap().catch(() => setIdentityStatus("Bağlantı çevrimdışı"));
    const interval = window.setInterval(() => { if (!document.hidden) void bootstrap().catch(() => {}); }, 60_000);
    const refreshVisible = () => { if (!document.hidden) void bootstrap().catch(() => {}); };
    document.addEventListener("visibilitychange", refreshVisible);
    const unsubscribe = window.playStreamersNative?.onOpenUrl((url) => void completeIdentityLogin(url));
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener("visibilitychange", refreshVisible); unsubscribe?.(); };
  }, []);

  useEffect(() => {
    if (!window.playStreamersNative || IS_STORE_BUILD) return;
    const timer = window.setTimeout(() => void checkDesktopUpdate(true), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedFeature) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedFeature(null); };
    document.body.classList.add("feature-workspace-visible");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("feature-workspace-visible");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedFeature]);

  async function checkDesktopUpdate(silent = false) {
    if (!window.playStreamersNative) {
      if (!silent) setUpdateState({ phase: "current", message: "Güncelleme denetimi masaüstü uygulamasında çalışır" });
      return;
    }
    if (!silent) setUpdateState({ phase: "checking", message: "Güncelleme denetleniyor…" });
    try {
      const update = await check();
      if (update) {
        setUpdateState({ phase: "available", version: update.version, message: `${update.version} hazır · yüklemek için tıkla` });
      } else if (!silent) {
        setUpdateState({ phase: "current", message: "Uygulama güncel" });
      }
    } catch {
      if (!silent) setUpdateState({ phase: "error", message: "Güncelleme sunucusuna ulaşılamadı" });
    }
  }

  async function installDesktopUpdate() {
    if (!window.playStreamersNative || updateState.phase === "installing") return;
    setUpdateState({ ...updateState, phase: "installing", message: "Güncelleme indiriliyor ve doğrulanıyor…" });
    try {
      const update = await check();
      if (!update) {
        setUpdateState({ phase: "current", message: "Uygulama güncel" });
        return;
      }
      await update.downloadAndInstall();
      setUpdateState({ phase: "installing", version: update.version, message: "Kurulum tamamlandı · yeniden başlatılıyor…" });
      await relaunch();
    } catch {
      setUpdateState({ phase: "error", message: "Güncelleme kurulamadı; mevcut sürüm korunuyor" });
    }
  }

  async function completeIdentityLogin(callbackUrl: string) {
    try {
      const callback = new URL(callbackUrl);
      if (callback.protocol !== "playstreamers:" || callback.hostname !== "identity" || callback.pathname !== "/callback") throw new Error("Geçersiz giriş dönüşü.");
      const code = callback.searchParams.get("code") || "";
      const state = callback.searchParams.get("state") || "";
      const expectedState = sessionStorage.getItem("ps.identity-state") || "";
      sessionStorage.removeItem("ps.identity-state");
      if (!expectedState || state !== expectedState) throw new Error("Giriş isteğinin güvenlik kodu eşleşmedi.");
      setIdentityStatus("SW Identity doğrulanıyor…");
      const response = await fetch(`${API_BASE}/api/auth/sw/exchange`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null) as { error?: string; sessionId?: string; user?: { name?: string }; plan?: { tier?: PlanTier } } | null;
      if (!response.ok || !data?.sessionId) throw new Error(data?.error || "SW Identity girişi tamamlanamadı.");
      if (window.playStreamersNative) await window.playStreamersNative.secureStore("ps.session", data.sessionId);
      else sessionStorage.setItem("ps.session", data.sessionId);
      setPlan(data.plan?.tier || "free");
      setAccountName(data.user?.name || "SW hesabı");
      setIdentityStatus("Hesap ve plan eşitlendi");
    } catch (error) {
      setIdentityStatus(error instanceof Error ? error.message : "Giriş tamamlanamadı");
    }
  }

  async function startIdentityLogin() {
    const stateBytes = crypto.getRandomValues(new Uint8Array(24));
    const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem("ps.identity-state", state);
    setIdentityStatus("Tarayıcıda giriş bekleniyor…");
    const authorize = new URL("https://api.swcreate.com/api/auth/product/authorize");
    authorize.searchParams.set("client_id", "play-streamers");
    authorize.searchParams.set("redirect_uri", "playstreamers://identity/callback");
    authorize.searchParams.set("state", state);
    await openExternal(authorize.toString());
  }

  function openFeature(feature: FeatureDefinition) {
    if (feature.section === "home") {
      setSection("home");
      setSearch("");
      return;
    }
    setSelectedFeature(feature);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setSection("home")} aria-label="Play Streamers başlangıç">
          <span className="brand-mark"><img src="./play-streamers-ps-logo.svg" alt="" /></span>
          <span><strong>PLAY</strong><small>STREAMERS</small></span>
        </button>
        <nav aria-label="Ana menü">
          {NAVIGATION.map((item) => (
            <button key={item.id} className={section === item.id && !search ? "active" : ""} onClick={() => { setSection(item.id); setSearch(""); }}>
              <span className="nav-icon">{item.icon}</span><span>{sectionLabels[item.id]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="plan-pill"><span>{planLabels[plan]}</span><small>SW Identity ile yönetilir</small></div>
          <button className="profile-row" onClick={() => void startIdentityLogin()}>
            <span className="profile-avatar">{accountName?.slice(0, 1).toLocaleUpperCase("tr-TR") || "E"}</span><span><strong>{accountName || "Hesabını bağla"}</strong><small>{identityStatus}</small></span><b>›</b>
          </button>
        </div>
      </aside>

      <main className="main-surface">
        <header className="topbar">
          <div className="topbar-title"><span className="mobile-mark"><img src="./play-streamers-ps-logo.svg" alt="" /></span><div><small>PLAY STREAMERS</small><strong>{search ? "Arama sonuçları" : sectionLabels[section]}</strong></div></div>
          <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bir araç veya özellik ara…" /><kbd>Ctrl K</kbd></label>
          <div className="top-actions"><label className="desktop-locale" title="Dil seçimi"><span>◎</span><select aria-label="Dil seçimi" value={locale} onChange={(event) => setLocale(event.target.value)}><option value="tr">Türkçe</option><option value="en">English</option><option value="de">Deutsch</option><option value="es">Español</option><option value="fr">Français</option><option value="ru">Русский</option><option value="ar">العربية</option><option value="ja">日本語</option></select></label>{!IS_STORE_BUILD && <button className={`update-button ${updateState.phase}`} aria-label={updateState.message} title={updateState.message} disabled={updateState.phase === "checking" || updateState.phase === "installing"} onClick={() => void (updateState.phase === "available" ? installDesktopUpdate() : checkDesktopUpdate(false))}>{updateState.phase === "available" ? "↑" : updateState.phase === "installing" || updateState.phase === "checking" ? "…" : "↻"}</button>}<span className="system-ready"><i /> {IS_STORE_BUILD ? "Microsoft Store ile güncel" : updateState.phase === "available" ? `Sürüm ${updateState.version} hazır` : "Sistem hazır"}</span></div>
        </header>

        {section === "home" && !search ? (
          <HomeDashboard notes={notes} setNotes={setNotes} ideas={ideas} setIdeas={setIdeas} sessions={sessions} streamMonitor={streamMonitor} onOpen={setSection} />
        ) : (
          <FeatureLibrary section={section} plan={plan} features={visibleFeatures} search={search} onSelect={openFeature} />
        )}
      </main>

      {selectedFeature && <FeatureDrawer feature={selectedFeature} plan={plan} onClose={() => setSelectedFeature(null)} />}
    </div>
  );
}

function HomeDashboard({ notes, setNotes, ideas, setIdeas, sessions, streamMonitor, onOpen }: {
  notes: string[];
  setNotes: (items: string[]) => void;
  ideas: string[];
  setIdeas: (items: string[]) => void;
  sessions: DesktopSessionSummary[];
  streamMonitor: StreamMonitor;
  onOpen: (section: AppSection) => void;
}) {
  const [noteValue, setNoteValue] = useState("");
  const [ideaValue, setIdeaValue] = useState("");
  const addItem = (value: string, items: string[], update: (items: string[]) => void, clear: () => void) => {
    const clean = value.trim();
    if (!clean) return;
    update([clean, ...items].slice(0, 12));
    clear();
  };
  const completedSessions = sessions.filter((session) => Number(session.endedAt || 0) > 0);
  const latestSession = completedSessions[0];
  const durationSeconds = Number(latestSession?.summary?.durationSeconds || (latestSession?.endedAt && latestSession.startedAt ? (latestSession.endedAt - latestSession.startedAt) / 1000 : 0));
  const durationLabel = durationSeconds > 0 ? `${Math.floor(durationSeconds / 3600)}s ${Math.floor((durationSeconds % 3600) / 60)}dk` : "—";
  const latestDetail = latestSession?.endedAt ? new Date(latestSession.endedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }) : "İlk yayınını bekliyor";
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const thisMonth = completedSessions.filter((session) => Number(session.endedAt || 0) >= monthStart.getTime()).length;
  const averageViewers = Number(latestSession?.summary?.averageViewers || 0);
  const live = streamMonitor.status === "live";
  const addTimestampedNote = () => {
    const clean = noteValue.trim();
    if (!clean) return;
    const timestamp = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    addItem(`${timestamp} · ${clean}`, notes, setNotes, () => setNoteValue(""));
  };
  return (
    <div className="page-content home-content">
      <section className="welcome-band">
        <div><span className="eyebrow">BUGÜNÜN YAYIN MERKEZİ</span><h1>Yayın senin.<br /><em>Kontrol sende.</em></h1><p>Kanalını bağla, yayın akışını hazırla ve yayın bittikten sonra neyin işe yaradığını tek yerde gör.</p></div>
        <div className="welcome-actions"><button className="primary-button" onClick={() => onOpen("content")}><span>✦</span> Yayın akışını hazırla</button><button className="secondary-button" onClick={() => onOpen("analysis")}>Sonuçları incele</button></div>
      </section>

      <section className="metric-grid">
        <MetricCard label={live ? "Anlık izleyici" : "Ortalama izleyici"} value={live ? String(streamMonitor.currentViewers || 0) : (latestSession ? String(averageViewers) : "—")} detail={live ? "Sunucu her dakika ölçüyor" : `${durationLabel} · ${latestDetail}`} color="green" />
        <MetricCard label="Tepe izleyici" value={latestSession ? String(latestSession.peakViewers || 0) : "—"} detail={latestSession ? "Doğrulanmış oturum" : "Kanal bağlanınca hazır"} color="purple" />
        <MetricCard label="Etkileşim" value={latestSession ? String(latestSession.interactions || 0) : "—"} detail={latestSession ? `+${latestSession.followersGained || 0} takipçi` : "Henüz veri yok"} color="cyan" />
        <MetricCard label="Bu ay yayın" value={String(thisMonth)} detail={thisMonth ? "Tamamlanan oturum" : "İlk yayınını bekliyor"} color="amber" />
      </section>

      <div className="dashboard-grid">
        <section className="glass-panel span-two">
          <div className="panel-heading"><div><span className="eyebrow">YAYINA HAZIRLIK</span><h2>Üç adımda yayına çık</h2></div><span className="progress-label">1 / 3 hazır</span></div>
          <div className="prep-list">
            <PrepRow done title="Uygulama hazır" detail="Yerel ayarlar ve kayıt alanı kullanılabilir" />
            <PrepRow done={streamMonitor.connected} title={streamMonitor.connected ? "Sunucu takibi açık" : "Kanalını bağla"} detail={streamMonitor.connected ? "Uygulama kapalıyken de yayın ölçülür" : "Canlı olaylar ve yayın verileri için"} />
            <PrepRow title="Yayın akışını hazırla" detail="Açılış, bölümler, mola ve kapanışı planla" action="Planla" onClick={() => onOpen("content")} />
          </div>
        </section>

        <section className="glass-panel now-panel">
          <div className="panel-heading"><div><span className="eyebrow">CANLI DURUM</span><h2>Şu an</h2></div><span className={`offline-badge${live ? " live" : ""}`}>{live ? "Canlı" : "Çevrimdışı"}</span></div>
          <div className={`empty-orbit${live ? " live" : ""}`}><span>◉</span><strong>{live ? (streamMonitor.title || "Yayın açık") : "Yayın kapalı"}</strong><small>{live ? `${streamMonitor.currentViewers || 0} anlık · ${streamMonitor.peakViewers || 0} tepe izleyici` : streamMonitor.connected ? "Sunucu kanalını izlemeyi sürdürüyor." : "Kick kanalını bağladığında otomatik sunucu takibi başlar."}</small></div>
        </section>

        <LocalListPanel eyebrow="HIZLI NOTLAR" title="Aklından çıkmasın" items={notes} value={noteValue} onValue={setNoteValue} placeholder="Yeni bir yayın notu…" onAdd={addTimestampedNote} onRemove={(index) => setNotes(notes.filter((_, itemIndex) => itemIndex !== index))} />
        <LocalListPanel eyebrow="FİKİR KASASI" title="Sıradaki yayınlar" items={ideas} value={ideaValue} onValue={setIdeaValue} placeholder="Yeni bir yayın fikri…" onAdd={() => addItem(ideaValue, ideas, setIdeas, () => setIdeaValue(""))} onRemove={(index) => setIdeas(ideas.filter((_, itemIndex) => itemIndex !== index))} />

        <section className="glass-panel span-two insight-panel">
          <div><span className="eyebrow">YAYIN ZEKÂSI</span><h2>Önce veri, sonra anlaşılır açıklama</h2><p>Play Streamers değişimleri kayıtlı oturum sayılarından hesaplar. Product Pro AI, neden uydurmadan bu karşılaştırmayı anlaşılır Türkçeye çevirir; dakika ve olaylar doğrulanmış Kick/Play Connect hattından gelir.</p></div>
          <div className="evidence-card"><span>Doğrulanmış veri</span><strong>{latestSession ? `${latestSession.interactions || 0} etkileşim` : "Yayın oturumu bekleniyor"}</strong><small>{latestSession ? `${latestSession.peakViewers || 0} tepe izleyici · +${latestSession.followersGained || 0} takipçi` : "İlk yayın tamamlandığında burada özetlenir"}</small></div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return <div className={`metric-card ${color}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small><i /></div>;
}

function PrepRow({ done, title, detail, action, onClick }: { done?: boolean; title: string; detail: string; action?: string; onClick?: () => void }) {
  return <div className="prep-row"><span className={done ? "check done" : "check"}>{done ? "✓" : ""}</span><span><strong>{title}</strong><small>{detail}</small></span>{action && <button onClick={onClick}>{action}</button>}</div>;
}

function LocalListPanel({ eyebrow, title, items, value, onValue, placeholder, onAdd, onRemove }: { eyebrow: string; title: string; items: string[]; value: string; onValue: (value: string) => void; placeholder: string; onAdd: () => void; onRemove: (index: number) => void }) {
  return <section className="glass-panel"><div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="local-badge">Bu cihazda</span></div><form className="quick-add" onSubmit={(event) => { event.preventDefault(); onAdd(); }}><input value={value} onChange={(event) => onValue(event.target.value)} placeholder={placeholder} maxLength={140} /><button aria-label="Ekle">+</button></form><div className="local-list">{items.slice(0, 4).map((item, index) => <div key={`${item}-${index}`}><span>{item}</span><button aria-label="Sil" onClick={() => onRemove(index)}>×</button></div>)}</div></section>;
}

function FeatureLibrary({ section, plan, features, search, onSelect }: { section: AppSection; plan: PlanTier; features: FeatureDefinition[]; search: string; onSelect: (feature: FeatureDefinition) => void }) {
  const accessible = features.filter((feature) => canUseFeature(plan, feature)).length;
  return <div className="page-content feature-content"><section className="feature-hero"><div><span className="eyebrow">{search ? "TÜM ARAÇLARDA" : sectionLabels[section].toLocaleUpperCase("tr-TR")}</span><h1>{search ? `“${search}” için sonuçlar` : sectionIntro(section).title}</h1><p>{search ? `${features.length} ilgili araç bulundu.` : sectionIntro(section).description}</p></div><div className="feature-count"><strong>{features.length}</strong><span>araç</span><small>{accessible} tanesi planında açık</small></div></section><div className="feature-grid">{features.map((feature) => <FeatureCard key={feature.id} feature={feature} plan={plan} onSelect={onSelect} />)}{features.length === 0 && <div className="no-results"><strong>Bir sonuç bulunamadı</strong><span>Farklı bir kelimeyle tekrar ara.</span></div>}</div></div>;
}

function FeatureCard({ feature, plan, onSelect }: { feature: FeatureDefinition; plan: PlanTier; onSelect: (feature: FeatureDefinition) => void }) {
  const unlocked = canUseFeature(plan, feature);
  return <button className={`feature-card ${unlocked ? "" : "locked"}`} onClick={() => onSelect(feature)}><div className="feature-card-top"><span className="feature-symbol">{feature.ai ? "AI" : feature.localFirst ? "PC" : "PS"}</span><span className={`status-tag ${feature.status}`}>{STATUS_LABELS[feature.status]}</span></div><h3>{feature.title}</h3><p>{feature.description}</p><footer><span>{feature.localFirst ? "Yerel öncelikli" : feature.ai ? "Sayısal AI" : sectionLabels[feature.section]}</span><b>{unlocked ? "Aç ›" : `${planLabels[feature.minimumTier]} ◇`}</b></footer></button>;
}

function FeatureDrawer({ feature, plan, onClose }: { feature: FeatureDefinition; plan: PlanTier; onClose: () => void }) {
  const unlocked = canUseFeature(plan, feature);
  const usable = unlocked && feature.status !== "planned";
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className={`feature-drawer ${usable ? "workspace-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="featureDrawerTitle" tabIndex={-1}><button className="drawer-close" aria-label="Çalışma alanını kapat" onClick={onClose}>×</button><span className="eyebrow">{sectionLabels[feature.section].toLocaleUpperCase("tr-TR")}</span><div className="drawer-symbol">{feature.ai ? "AI" : feature.localFirst ? "PC" : "PS"}</div><h2 id="featureDrawerTitle">{feature.title}</h2><p>{feature.description}</p><div className="drawer-details"><div><span>Plan</span><strong>{planLabels[feature.minimumTier]}</strong></div><div><span>Durum</span><strong>{STATUS_LABELS[feature.status]}</strong></div><div><span>Veri</span><strong>{feature.localFirst ? "Önce bu cihaz" : feature.ai ? "Sayısal özet" : "Hesapla eşitlenir"}</strong></div></div>{usable ? <FeatureWorkspace feature={feature} /> : <button className="secondary-button full" disabled>{unlocked ? "Yerel motor entegrasyonu hazırlanıyor" : `${planLabels[feature.minimumTier]} ile açılır`}</button>}<small className="drawer-note">Araçlar açıklanan kapsamda çalışır. Dış platform verileri yalnız SW Identity üzerinden doğrulanabildiğinde gösterilir; bilinmeyen değerler üretilmez.</small></aside></div>;
}

function sectionIntro(section: AppSection) {
  const copy: Record<AppSection, { title: string; description: string }> = {
    home: { title: "Başlangıç", description: "Günün yayın akışı ve önemli işler." },
    live: { title: "Yayın sırasında gerekli olan her şey", description: "Olayları, süreyi ve hedefleri kalabalık yaratmadan takip et." },
    analysis: { title: "Rakamı göster, nedenini açıkla", description: "Yayın verilerini karşılaştır; değişimin nerede ve neden oluştuğunu gör." },
    content: { title: "Fikirden yayına tek akış", description: "Fikirleri topla, yayın akışını hazırla ve önemli anları işaretle." },
    community: { title: "İzleyiciyi yayının parçası yap", description: "Tekrara düşmeyen oyunlar, görevler ve topluluk ritüelleri oluştur." },
    brand: { title: "Kanalın her yerde aynı hissetsin", description: "Görsel dilini, seslerini ve hareketli kimliğini bir merkezde yönet." },
    revenue: { title: "Geliri okunabilir hale getir", description: "Destek kaynaklarını, kilometre taşlarını ve dönem değişimlerini gör." },
    vault: { title: "Yayın çalışma kasan", description: "Dosya, ekipman, izin ve geri yüklenebilir çalışma alanlarını cihazında tut." },
    settings: { title: "Uygulama senin çalışma biçimine uysun", description: "Düzen, tema ve deneysel özellikleri yönet." },
  };
  return copy[section];
}
