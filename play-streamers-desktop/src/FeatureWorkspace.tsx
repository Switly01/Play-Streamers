import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { FeatureDefinition } from "./types";
import {
  InsiderWorkspace,
  EmoteBadgeWorkspace,
  InteractiveStoryWorkspace,
  MediaKitWorkspace,
  OverlayWorkspace,
  RepurposeWorkspace,
  SpeechCoachWorkspace,
  SmartAlertsWorkspace,
  SnapshotWorkspace,
  SoundboardWorkspace,
  TransitionWorkspace,
  WellbeingWorkspace,
} from "./SpecialWorkspaces";

const API_BASE = "https://api.pstreamers.com";

type WorkspaceItem = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  createdAt: number;
};

type GoalState = {
  current: number;
  target: number;
  plannedStreams: number;
};

type InsightSession = {
  id: string;
  platform: string;
  startedAt: number;
  endedAt: number | null;
  peakViewers: number;
  interactions: number;
  followersGained: number;
  revenueMinor: number;
  summary?: {
    subscriptions?: number;
    revenueCurrency?: string | null;
    revenueByCurrency?: Record<string, number>;
  } | null;
};

type EvidenceInsight = {
  title: string;
  summary: string;
  evidence: string[];
  nextAction: string;
};

const LIST_STARTERS: Record<string, string[]> = {
  "quick-notes": ["Açılışta yayın hedefini anlat", "Mola öncesi izleyici sorusunu aç"],
  "live-events": ["Kanal bağlandığında doğrulanmış olaylar burada zaman sırasına girecek"],
  "stream-script": ["Açılış · 5 dakika", "Ana bölüm · 45 dakika", "Mola · 5 dakika", "Kapanış · 10 dakika"],
  "clip-markers": ["Önemli anı yayın sırasında tek tıkla işaretle"],
  "channel-memory": ["Kararı ve sonraki yayında ölçmek istediğin sonucu birlikte yaz"],
  "stream-challenges": ["Yayın boyunca üç yeni izleyici sorusu sor"],
  "silence-rescuer": ["Bugün öğrendiğin küçük ama şaşırtıcı bir şeyi anlat", "İzleyiciye iki seçenekli soru sor"],
  "secret-codes": ["Kodun kendisini değil, açacağı sürprizi ve kullanım kuralını kaydet"],
  "community-seasons": ["Aylık tema", "Topluluk ortak hedefi", "Sezon kapanış yayını"],
  "no-code-minigames": ["İki seçenek", "Hızlı tahmin", "Sıradaki görevi seç"],
  "time-capsule": ["Gelecekteki yayında açılacak mesaj"],
  "brand-kit": ["Ana renk", "Vurgu rengi", "Başlık yazısı", "Logo kullanım kuralı"],
  "supporter-map": ["Destek olayları bağlandığında dönem ve yayın türüne göre kümelenecek"],
  "revenue-cockpit": ["Gelir kaynaklarını kayıtlı oturum verileriyle karşılaştır"],
  "file-vault": ["Yayın açılış görseli", "Mola sesi", "Kanal açıklama metni"],
  "snapshots": ["Yayın düzeni ve araç ayarları için sürüm notu"],
  "equipment-log": ["Mikrofon · bakım tarihi", "Kamera · garanti bitişi"],
  "music-license-log": ["Parça adı · lisans kaynağı · kanıt dosyası"],
  "layouts": ["Sohbet yayını", "Oyun yayını", "Kayıt çalışma alanı"],
  "insider": ["Deneysel özellikler yalnız açık onayla etkinleştirilir"],
};

const GOAL_FEATURES = new Set(["goal-board", "goal-route", "monetization-gates"]);
const ANALYSIS_FEATURES = new Set(["basic-stats", "advanced-graphs", "after-stream-report", "data-export", "stream-intelligence", "audience-pulse", "smart-alerts", "revenue-cockpit", "supporter-map"]);

function localKey(featureId: string) {
  return `ps.workspace.${featureId}.v1`;
}

function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function itemId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function sessionToken() {
  if (window.playStreamersNative) return window.playStreamersNative.secureRead("ps.session");
  return sessionStorage.getItem("ps.session");
}

function formatClock(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

export function FeatureWorkspace({ feature }: { feature: FeatureDefinition }) {
  if (feature.id === "snapshots") return <SnapshotWorkspace />;
  if (feature.id === "wellbeing") return <WellbeingWorkspace />;
  if (feature.id === "interactive-story") return <InteractiveStoryWorkspace />;
  if (feature.id === "smart-alerts") return <SmartAlertsWorkspace />;
  if (feature.id === "overlay-studio" || feature.id === "motion-identity") return <OverlayWorkspace />;
  if (feature.id === "soundboard") return <SoundboardWorkspace />;
  if (feature.id === "content-repurpose") return <RepurposeWorkspace />;
  if (feature.id === "speech-coach") return <SpeechCoachWorkspace />;
  if (feature.id === "emote-badge-studio") return <EmoteBadgeWorkspace />;
  if (feature.id === "media-kit") return <MediaKitWorkspace />;
  if (feature.id === "insider") return <InsiderWorkspace />;
  if (feature.id === "stream-timer") return <TimerWorkspace feature={feature} />;
  if (feature.id === "live-events") return <LiveEventsWorkspace />;
  if (feature.id === "teleprompter") return <TeleprompterWorkspace feature={feature} />;
  if (feature.id === "themes") return <ThemeWorkspace />;
  if (feature.id === "supporter-map" || feature.id === "revenue-cockpit") return <RevenueWorkspace feature={feature} />;
  if (feature.id === "file-vault") return <FileVaultWorkspace />;
  if (feature.id === "layouts") return <LayoutWorkspace />;
  if (GOAL_FEATURES.has(feature.id)) return <GoalWorkspace feature={feature} />;
  if (ANALYSIS_FEATURES.has(feature.id)) return <AnalysisWorkspace feature={feature} />;
  if (feature.id === "stream-bingo") return <BingoWorkspace feature={feature} />;
  return <ListWorkspace feature={feature} />;
}

type RevenueEvent = { id: string; providerName: string; donorName: string; amountMinor: number; currency: string; receivedAt: number };

function RevenueWorkspace({ feature }: { feature: FeatureDefinition }) {
  const [events, setEvents] = useState<RevenueEvent[]>([]);
  const [state, setState] = useState("Doğrulanmış destek verileri yükleniyor…");
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const token = await sessionToken();
      if (!token) { setState("Gelir görünümü için SW Identity hesabını bağla."); return; }
      const response = await fetch(`${API_BASE}/api/donate-bridge/events`, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null) as { events?: RevenueEvent[]; error?: string } | null;
      if (disposed) return;
      if (!response.ok) { setState(payload?.error || "Destek verileri alınamadı."); return; }
      setEvents(payload?.events || []);
      setState(payload?.events?.length ? `${payload.events.length} doğrulanmış destek olayı` : "Henüz doğrulanmış destek olayı yok.");
    })().catch(() => setState("Destek verisi bağlantısı çevrimdışı."));
    return () => { disposed = true; };
  }, []);
  const totals = useMemo(() => Object.entries(events.reduce<Record<string, number>>((all, event) => ({ ...all, [event.currency]: (all[event.currency] || 0) + event.amountMinor }), {})), [events]);
  const groups = useMemo(() => Object.values(events.reduce<Record<string, { key: string; label: string; count: number; totals: Record<string, number> }>>((all, event) => {
    const key = feature.id === "supporter-map" ? event.donorName : event.providerName;
    const current = all[key] || { key, label: key, count: 0, totals: {} };
    current.count += 1;
    current.totals[event.currency] = (current.totals[event.currency] || 0) + event.amountMinor;
    all[key] = current;
    return all;
  }, {})).sort((a, b) => b.count - a.count), [events, feature.id]);
  return <div className="feature-workspace revenue-workspace"><div className="live-event-status"><span>DOĞRULANMIŞ GELİR</span><strong>{state}</strong><small>Farklı para birimleri birbirine eklenmez; kur veya gelir nedeni uydurulmaz.</small></div><div className="currency-totals">{totals.map(([currency, amount]) => <article key={currency}><span>{currency}</span><strong>{(amount / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</strong></article>)}</div><div className="revenue-groups">{groups.slice(0, 30).map((group) => <article key={group.key}><span><strong>{group.label}</strong><small>{group.count} doğrulanmış olay</small></span><b>{Object.entries(group.totals).map(([currency, amount]) => <i key={currency}>{(amount / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} {currency}</i>)}</b></article>)}</div></div>;
}

type VaultFile = { id: string; name: string; size: number; type: string; category: string; lastModified: number; addedAt: number };

function FileVaultWorkspace() {
  const key = localKey("file-vault");
  const [files, setFiles] = useState<VaultFile[]>(() => safeRead(key, []));
  const [category, setCategory] = useState("Yayın görseli");
  function update(next: VaultFile[]) { setFiles(next); saveJson(key, next.slice(0, 500)); }
  function add(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).map((file) => ({ id: itemId(), name: file.name, size: file.size, type: file.type || "bilinmeyen", category, lastModified: file.lastModified, addedAt: Date.now() }));
    update([...incoming, ...files]);
  }
  return <div className="feature-workspace file-vault-workspace"><div className="vault-import"><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Yayın görseli</option><option>Ses</option><option>Video</option><option>Belge</option><option>Lisans kanıtı</option></select><label className="primary-button">Dosyaları indeksle<input type="file" multiple onChange={(event) => add(event.target.files)} /></label></div><p className="workspace-privacy">Dosyalar taşınmaz veya buluta yüklenmez; yalnız ad, tür, boyut ve değiştirilme tarihi cihazındaki kasaya kaydedilir.</p><div className="vault-file-list">{files.map((file) => <article key={file.id}><span><strong>{file.name}</strong><small>{file.category} · {(file.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB</small></span><time>{new Date(file.lastModified).toLocaleDateString("tr-TR")}</time><button onClick={() => update(files.filter((entry) => entry.id !== file.id))}>×</button></article>)}</div></div>;
}

type LayoutProfile = { id: string; name: string; createdAt: number; theme: string | null };

function LayoutWorkspace() {
  const key = localKey("layouts");
  const [profiles, setProfiles] = useState<LayoutProfile[]>(() => safeRead(key, []));
  const [name, setName] = useState("");
  function update(next: LayoutProfile[]) { setProfiles(next); saveJson(key, next.slice(0, 20)); }
  function save() {
    const clean = name.trim();
    if (!clean) return;
    update([{ id: itemId(), name: clean, createdAt: Date.now(), theme: localStorage.getItem("ps.theme") }, ...profiles]);
    setName("");
  }
  function apply(profile: LayoutProfile) {
    if (profile.theme) localStorage.setItem("ps.theme", profile.theme);
    window.location.reload();
  }
  return <div className="feature-workspace layout-workspace"><form onSubmit={(event) => { event.preventDefault(); save(); }}><input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Örn. Akşam çalışma düzeni" /><button className="primary-button">Mevcut düzeni kaydet</button></form><p className="workspace-privacy">Oturum bilgisi kopyalanmaz; yalnız arayüz ve tema tercihleri saklanır.</p><div>{profiles.map((profile) => <article key={profile.id}><button onClick={() => apply(profile)}><strong>{profile.name}</strong><small>{new Date(profile.createdAt).toLocaleString("tr-TR")}</small></button><button onClick={() => update(profiles.filter((entry) => entry.id !== profile.id))}>×</button></article>)}</div></div>;
}

type UnifiedLiveEvent = { id: string; title: string; detail: string; occurredAt: number; source: string; verified: boolean };

function LiveEventsWorkspace() {
  const [events, setEvents] = useState<UnifiedLiveEvent[]>([]);
  const [state, setState] = useState("Doğrulanmış kanal olayları yükleniyor…");
  useEffect(() => {
    let disposed = false;
    const sync = async () => {
      try {
        const token = await sessionToken();
        if (!token) { setState("Kick ve Play Connect olayları için SW Identity hesabını bağla."); return; }
        const headers = { authorization: `Bearer ${token}` };
        const [kickResponse, donateResponse] = await Promise.all([
          fetch(`${API_BASE}/api/kick/events`, { headers }),
          fetch(`${API_BASE}/api/donate-bridge/events`, { headers }),
        ]);
        const kickPayload = await kickResponse.json().catch(() => null) as { events?: Array<{ id: string; type: string; occurredAt?: string; receivedAt?: string; payload?: Record<string, unknown> }> } | null;
        const donatePayload = await donateResponse.json().catch(() => null) as { events?: Array<{ id: string; providerName: string; donorName: string; amountMinor: number; currency: string; message?: string; eventAt?: number; receivedAt: number; source: string }> } | null;
        const kickEvents: UnifiedLiveEvent[] = (kickPayload?.events || []).map((event) => {
          const payload = event.payload || {};
          const actor = String((payload.follower as { username?: string } | undefined)?.username || (payload.subscriber as { username?: string } | undefined)?.username || "İzleyici");
          const labels: Record<string, string> = { "channel.followed": "Yeni takip", "channel.subscription.new": "Yeni abonelik", "channel.subscription.renewal": "Abonelik yenilendi", "channel.subscription.gifts": "Hediye abonelik", "kicks.gifted": "Kicks desteği", "livestream.status.updated": "Yayın durumu" };
          return { id: `kick-${event.id}`, title: labels[event.type] || event.type, detail: actor, occurredAt: Date.parse(event.occurredAt || event.receivedAt || "") || Date.now(), source: "Kick imzalı olay", verified: true };
        });
        const donateEvents: UnifiedLiveEvent[] = (donatePayload?.events || []).map((event) => ({
          id: `donate-${event.id}`,
          title: `${event.donorName} · ${(event.amountMinor / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${event.currency}`,
          detail: event.message || `${event.providerName} desteği`,
          occurredAt: event.eventAt || event.receivedAt,
          source: event.source === "provider-api" || event.source === "provider-webhook" ? "Sağlayıcı doğrulaması" : "Play Connect",
          verified: true,
        }));
        if (!disposed) {
          const next = [...kickEvents, ...donateEvents].sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 200);
          setEvents(next);
          setState(next.length ? `${next.length} doğrulanmış olay` : "Henüz doğrulanmış kanal olayı yok.");
        }
      } catch {
        if (!disposed) setState("Olay bağlantısı çevrimdışı; diğer yerel araçlar çalışmaya devam eder.");
      }
    };
    void sync();
    const timer = window.setInterval(() => void sync(), 10_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);
  return <div className="feature-workspace live-events-workspace"><div className="live-event-status"><span>VERİ DURUMU</span><strong>{state}</strong><small>Örnek veya tahmin üretilmez; yalnız sunucuda doğrulanan olaylar gösterilir.</small></div><div className="unified-event-list">{events.map((event) => <article key={event.id}><i className={event.verified ? "verified" : ""}>✓</i><span><strong>{event.title}</strong><small>{event.detail}</small></span><time>{new Date(event.occurredAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}<b>{event.source}</b></time></article>)}</div></div>;
}

function ListWorkspace({ feature }: { feature: FeatureDefinition }) {
  const starters = LIST_STARTERS[feature.id] || [feature.description];
  const [items, setItems] = useState<WorkspaceItem[]>(() => safeRead(localKey(feature.id), starters.map((title) => ({ id: itemId(), title, detail: "", done: false, createdAt: Date.now() }))));
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  function update(next: WorkspaceItem[]) {
    setItems(next);
    saveJson(localKey(feature.id), next.slice(0, 100));
  }

  function add() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    update([{ id: itemId(), title: cleanTitle, detail: detail.trim(), done: false, createdAt: Date.now() }, ...items]);
    setTitle("");
    setDetail("");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ feature: feature.id, exportedAt: new Date().toISOString(), items }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `play-streamers-${feature.id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  return <div className="feature-workspace">
    <div className="workspace-toolbar"><span><b>{items.filter((item) => item.done).length}</b> tamamlandı · {items.length} kayıt</span><button onClick={exportData}>Yedeğini al</button></div>
    <form className="workspace-form" onSubmit={(event) => { event.preventDefault(); add(); }}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${feature.title} için yeni kayıt…`} maxLength={160} />
      <textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ayrıntı veya sonraki adım (isteğe bağlı)" maxLength={700} rows={3} />
      <button className="primary-button" type="submit">Çalışma alanına ekle</button>
    </form>
    <div className="workspace-list">
      {items.map((item, index) => <article key={item.id} className={item.done ? "done" : ""}>
        <button className="workspace-check" onClick={() => update(items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}>{item.done ? "✓" : ""}</button>
        <span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}<time>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</time></span>
        <div className="workspace-reorder"><button aria-label="Yukarı taşı" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label="Aşağı taşı" disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</button></div>
        <button className="workspace-remove" aria-label="Kaydı sil" onClick={() => update(items.filter((entry) => entry.id !== item.id))}>×</button>
      </article>)}
    </div>
    <p className="workspace-privacy">Bu ilk çalışma sürümü veriyi cihazında tutar. Görüntü, ses ve dosya içeriği sunucuya gönderilmez.</p>
  </div>;
}

function TimerWorkspace({ feature }: { feature: FeatureDefinition }) {
  const key = localKey(feature.id);
  const initial = safeRead(key, { elapsed: 0, runningSince: 0, markers: [] as Array<{ id: string; at: number; label: string }> });
  const [elapsedBase, setElapsedBase] = useState(initial.elapsed);
  const [runningSince, setRunningSince] = useState(initial.runningSince);
  const [now, setNow] = useState(Date.now());
  const [markers, setMarkers] = useState(initial.markers);
  const elapsed = elapsedBase + (runningSince ? Math.max(0, Math.floor((now - runningSince) / 1000)) : 0);

  useEffect(() => {
    if (!runningSince) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [runningSince]);

  function persist(nextElapsed: number, nextSince: number, nextMarkers = markers) {
    saveJson(key, { elapsed: nextElapsed, runningSince: nextSince, markers: nextMarkers });
  }

  function toggle() {
    if (runningSince) {
      setElapsedBase(elapsed);
      setRunningSince(0);
      persist(elapsed, 0);
    } else {
      const start = Date.now();
      setNow(start);
      setRunningSince(start);
      persist(elapsedBase, start);
    }
  }

  function mark() {
    const next = [{ id: itemId(), at: elapsed, label: `İşaret ${markers.length + 1}` }, ...markers];
    setMarkers(next);
    persist(elapsedBase, runningSince, next);
  }

  return <div className="feature-workspace timer-workspace">
    <span className="workspace-kicker">YEREL YAYIN SAATİ</span><strong className="workspace-clock">{formatClock(elapsed)}</strong>
    <div className="timer-actions"><button className="primary-button" onClick={toggle}>{runningSince ? "Duraklat" : elapsed ? "Devam et" : "Sayacı başlat"}</button><button className="secondary-button" onClick={mark} disabled={!elapsed}>Anı işaretle</button><button onClick={() => { setElapsedBase(0); setRunningSince(0); setMarkers([]); persist(0, 0, []); }}>Sıfırla</button></div>
    <div className="marker-list">{markers.map((marker) => <span key={marker.id}><b>{formatClock(marker.at)}</b>{marker.label}</span>)}</div>
  </div>;
}

function GoalWorkspace({ feature }: { feature: FeatureDefinition }) {
  const key = localKey(feature.id);
  const [goal, setGoal] = useState<GoalState>(() => safeRead(key, { current: 0, target: 100, plannedStreams: 4 }));
  const target = Math.max(1, goal.target || 1);
  const remaining = Math.max(0, target - Math.max(0, goal.current));
  const perStream = remaining / Math.max(1, goal.plannedStreams || 1);
  const percent = Math.min(100, Math.max(0, Math.round((goal.current / target) * 100)));
  function update(next: GoalState) { setGoal(next); saveJson(key, next); }
  return <div className="feature-workspace goal-workspace">
    <div className="goal-ring" style={{ "--goal-progress": `${percent * 3.6}deg` } as CSSProperties}><span><strong>%{percent}</strong><small>tamamlandı</small></span></div>
    <div className="goal-fields"><label><span>Şu an</span><input type="number" min="0" value={goal.current} onChange={(event) => update({ ...goal, current: Number(event.target.value) })} /></label><label><span>Hedef</span><input type="number" min="1" value={goal.target} onChange={(event) => update({ ...goal, target: Number(event.target.value) })} /></label><label><span>Planlanan yayın</span><input type="number" min="1" max="100" value={goal.plannedStreams} onChange={(event) => update({ ...goal, plannedStreams: Number(event.target.value) })} /></label></div>
    <div className="goal-evidence"><span>Kalan <b>{remaining.toLocaleString("tr-TR")}</b></span><span>Yayın başına gereken ortalama <b>{perStream.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}</b></span></div>
    <p className="workspace-privacy">Bu hesaplama yapay zekâ kullanmaz; yalnızca girdiğin mevcut değer, hedef ve yayın sayısından üretilir.</p>
  </div>;
}

function TeleprompterWorkspace({ feature }: { feature: FeatureDefinition }) {
  const key = localKey(feature.id);
  const initial = safeRead(key, { text: "Yayına hoş geldiniz. Bugünkü hedefimizi ve yayın akışını kısaca anlatarak başlayalım.", speed: 28, size: 32 });
  const [text, setText] = useState(initial.text);
  const [speed, setSpeed] = useState(initial.speed);
  const [size, setSize] = useState(initial.size);
  const [playing, setPlaying] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    saveJson(key, { text, speed, size });
  }, [key, size, speed, text]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => { if (readerRef.current) readerRef.current.scrollTop += Math.max(1, speed / 18); }, 50);
    return () => window.clearInterval(timer);
  }, [playing, speed]);
  return <div className="feature-workspace teleprompter-workspace">
    <div className="teleprompter-controls"><label>Hız <input type="range" min="10" max="80" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label><label>Yazı <input type="range" min="22" max="54" value={size} onChange={(event) => setSize(Number(event.target.value))} /></label><button className="primary-button" onClick={() => setPlaying(!playing)}>{playing ? "Durdur" : "Okumayı başlat"}</button><button onClick={() => { if (readerRef.current) readerRef.current.scrollTop = 0; }}>Başa dön</button></div>
    <textarea className="teleprompter-editor" value={text} onChange={(event) => setText(event.target.value)} maxLength={12_000} rows={6} />
    <div className="teleprompter-reader" ref={readerRef} style={{ fontSize: `${size}px` }}>{text}</div>
  </div>;
}

function BingoWorkspace({ feature }: { feature: FeatureDefinition }) {
  const key = localKey(feature.id);
  const defaults = ["Yeni takip", "Komik hata", "İzleyici seçimi", "Hedef ilerledi", "Kliplik an", "Sürpriz soru", "Yeni destek", "Bölüm bitti", "Final görevi"];
  const [cells, setCells] = useState(() => safeRead(key, defaults.map((title) => ({ title, done: false }))));
  function toggle(index: number) { const next = cells.map((cell, cellIndex) => cellIndex === index ? { ...cell, done: !cell.done } : cell); setCells(next); saveJson(key, next); }
  return <div className="feature-workspace"><div className="bingo-grid">{cells.map((cell, index) => <button key={index} className={cell.done ? "done" : ""} onClick={() => toggle(index)}>{cell.done && <b>✓</b>}<span>{cell.title}</span></button>)}</div><button onClick={() => { const next = defaults.map((title) => ({ title, done: false })); setCells(next); saveJson(key, next); }}>Kartı sıfırla</button></div>;
}

function ThemeWorkspace() {
  const themes = [{ id: "violet", label: "Play Violet", color: "#8b5cf6" }, { id: "cyan", label: "Canlı Cyan", color: "#22d3ee" }, { id: "amber", label: "Sıcak Amber", color: "#f59e0b" }, { id: "mono", label: "Sade Gri", color: "#94a3b8" }];
  const [selected, setSelected] = useState(localStorage.getItem("ps.theme") || "violet");
  function select(id: string) { setSelected(id); localStorage.setItem("ps.theme", id); document.documentElement.dataset.theme = id; }
  return <div className="feature-workspace"><div className="theme-grid">{themes.map((theme) => <button key={theme.id} className={selected === theme.id ? "active" : ""} onClick={() => select(theme.id)}><i style={{ background: theme.color }} /><strong>{theme.label}</strong><small>{selected === theme.id ? "Etkin tema" : "Uygula"}</small></button>)}</div></div>;
}

function AudiencePulse({ current, previous }: { current?: InsightSession; previous?: InsightSession }) {
  if (!current || !previous || !current.endedAt || !previous.endedAt) {
    return <article className="generated-insight"><span>İZLEYİCİ NABZI</span><h3>Karşılaştırma bekleniyor</h3><p>Sessiz, dengeli veya yükselen sınıflandırması için en az iki tamamlanmış yayın gerekir.</p></article>;
  }
  const rate = (session: InsightSession) => session.interactions / Math.max(1, (Number(session.endedAt) - session.startedAt) / 60_000);
  const currentRate = rate(current);
  const previousRate = rate(previous);
  const change = previousRate > 0 ? ((currentRate - previousRate) / previousRate) * 100 : currentRate > 0 ? 100 : 0;
  const state = currentRate === 0 || change <= -20 ? "Sessiz" : change >= 15 ? "Yükselen" : "Dengeli";
  return <article className="generated-insight"><span>İZLEYİCİ NABZI</span><h3>{state}</h3><p>Son yayında dakika başına {currentRate.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} etkileşim kaydedildi. Önceki yayına göre değişim {change >= 0 ? "+" : ""}{change.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%.</p><strong>Hesaplama</strong><p>Bu sınıf yalnız yayın süresi ve doğrulanmış etkileşim sayısından hesaplanır; değişimin nedeni tahmin edilmez.</p></article>;
}

function AnalysisWorkspace({ feature }: { feature: FeatureDefinition }) {
  const [sessions, setSessions] = useState<InsightSession[]>([]);
  const [state, setState] = useState("Yayın geçmişi yükleniyor…");
  const [insight, setInsight] = useState<EvidenceInsight | null>(null);
  const [insightState, setInsightState] = useState("");
  const completed = useMemo(() => sessions.filter((session) => session.endedAt), [sessions]);
  const totalSeconds = completed.reduce((sum, session) => sum + Math.max(0, Number(session.endedAt) - Number(session.startedAt)) / 1000, 0);
  const totalInteractions = completed.reduce((sum, session) => sum + Number(session.interactions || 0), 0);
  const revenueTotals = useMemo(() => completed.reduce<Record<string, number>>((totals, session) => {
    const verified = session.summary?.revenueByCurrency || {};
    const entries = Object.entries(verified).filter(([currency, amount]) => /^[A-Z]{3}$/.test(currency) && Number.isFinite(Number(amount)));
    if (entries.length) {
      entries.forEach(([currency, amount]) => { totals[currency] = (totals[currency] || 0) + Number(amount); });
    } else if (session.summary?.revenueCurrency && session.revenueMinor) {
      const currency = session.summary.revenueCurrency;
      totals[currency] = (totals[currency] || 0) + Number(session.revenueMinor);
    }
    return totals;
  }, {}), [completed]);
  const revenueSummary = Object.entries(revenueTotals).length
    ? Object.entries(revenueTotals).map(([currency, amount]) => `${(amount / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${currency}`).join(" · ")
    : "—";
  const graphMaximum = Math.max(1, ...completed.map((session) => Math.max(session.interactions, session.peakViewers)));
  const currentSession = completed[0];
  const previousSession = completed[1];
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const token = await sessionToken();
      if (!token) { setState("Yayın geçmişi için SW Identity hesabını bağla."); return; }
      const response = await fetch(`${API_BASE}/api/platform/stream-sessions`, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null) as { sessions?: InsightSession[]; error?: string } | null;
      if (disposed) return;
      if (!response.ok) { setState(payload?.error || "Yayın geçmişi alınamadı."); return; }
      setSessions(payload?.sessions || []);
      setState(payload?.sessions?.length ? "Doğrulanmış yayın oturumları" : "İlk doğrulanmış yayından sonra burada karşılaştırma oluşacak.");
    })().catch(() => setState("Bağlantı çevrimdışı; yerel araçlar çalışmaya devam eder."));
    return () => { disposed = true; };
  }, []);

  function exportCsv() {
    const rows = [["platform", "baslangic", "bitis", "sure_dakika", "tepe_izleyici", "etkilesim", "takipci", "dogrulanmis_gelir"], ...completed.map((session) => {
      const totals = session.summary?.revenueByCurrency || {};
      const revenue = Object.entries(totals).map(([currency, amount]) => `${(Number(amount) / 100).toFixed(2)} ${currency}`).join(" | ");
      return [session.platform, new Date(session.startedAt).toISOString(), new Date(session.endedAt!).toISOString(), Math.round((session.endedAt! - session.startedAt) / 60000), session.peakViewers, session.interactions, session.followersGained, revenue];
    })];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "play-streamers-yayin-gecmisi.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createInsight() {
    if (completed.length < 2) return;
    setInsightState("Sayısal kanıt hazırlanıyor…");
    try {
      const token = await sessionToken();
      if (!token) throw new Error("SW Identity hesabını bağla.");
      const [current, previous] = completed;
      const minutes = (session: InsightSession) => Math.max(1, Math.round(((session.endedAt || Date.now()) - session.startedAt) / 60000));
      const response = await fetch(`${API_BASE}/api/ai/insight`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          current: { minutes: minutes(current), interactions: current.interactions, activeViewers: current.peakViewers, supporters: Math.max(0, Number(current.summary?.subscriptions || 0)) },
          previous: { minutes: minutes(previous), interactions: previous.interactions, activeViewers: previous.peakViewers, supporters: Math.max(0, Number(previous.summary?.subscriptions || 0)) },
        }),
      });
      const payload = await response.json().catch(() => null) as { insight?: EvidenceInsight; ai?: boolean; error?: string } | null;
      if (!response.ok || !payload?.insight) throw new Error(payload?.error || "Açıklama oluşturulamadı.");
      setInsight(payload.insight);
      setInsightState(payload.ai ? "AI yalnız sayısal özeti anlaşılır Türkçeye çevirdi." : "Sonuç doğrudan sayılardan hesaplandı; AI kullanılmadı.");
    } catch (error) {
      setInsightState(error instanceof Error ? error.message : "Açıklama oluşturulamadı.");
    }
  }

  return <div className="feature-workspace analysis-workspace">
    <div className="analysis-metrics"><article><span>Yayın</span><strong>{completed.length}</strong></article><article><span>Toplam süre</span><strong>{Math.round(totalSeconds / 60)} dk</strong></article><article><span>Etkileşim</span><strong>{totalInteractions}</strong></article><article><span>Doğrulanmış gelir</span><strong>{revenueSummary}</strong></article></div>
    <div className="analysis-evidence"><span>VERİ DURUMU</span><strong>{state}</strong><p>{completed.length >= 2 ? "Karşılaştırma yapılabilir. Değişim oranları yalnız kayıtlı sayılardan hesaplanır; bilinmeyen nedenler uydurulmaz." : "Güvenilir bir eğilim söylemek için en az iki tamamlanmış yayın gerekir."}</p></div>
    {feature.ai && <div className="insight-action"><button className="primary-button" onClick={() => void createInsight()} disabled={completed.length < 2}>Sayısal açıklama oluştur</button>{insightState && <small>{insightState}</small>}</div>}
    {feature.id === "audience-pulse" && <AudiencePulse current={currentSession} previous={previousSession} />}
    {insight && <article className="generated-insight"><span>SAYISAL YAYIN AÇIKLAMASI</span><h3>{insight.title}</h3><p>{insight.summary}</p><ul>{insight.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><strong>Sonraki adım</strong><p>{insight.nextAction}</p></article>}
    {feature.id === "data-export" && <button className="primary-button" onClick={exportCsv} disabled={!completed.length}>CSV olarak indir</button>}
    {feature.id === "advanced-graphs" && <div className="session-graph">{completed.slice(0, 12).reverse().map((session) => <article key={session.id}><span title={`${session.interactions} etkileşim`} style={{ height: `${Math.max(4, (session.interactions / graphMaximum) * 100)}%` }} /><i title={`${session.peakViewers} tepe izleyici`} style={{ height: `${Math.max(4, (session.peakViewers / graphMaximum) * 100)}%` }} /><small>{new Date(session.startedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}</small></article>)}</div>}
    {feature.id === "after-stream-report" && currentSession && <article className="after-stream-card"><span>YAYIN SONRASI RAPOR</span><h3>{previousSession ? (currentSession.interactions >= previousSession.interactions ? "Etkileşim önceki yayının üzerinde" : "Etkileşim önceki yayının altında") : "İlk doğrulanmış yayın özeti hazır"}</h3><div><b>{currentSession.peakViewers}<small>tepe izleyici</small></b><b>{currentSession.interactions}<small>etkileşim</small></b><b>+{currentSession.followersGained}<small>takipçi</small></b></div><p>{previousSession ? `Yayın başına etkileşim farkı ${currentSession.interactions - previousSession.interactions >= 0 ? "+" : ""}${currentSession.interactions - previousSession.interactions}. Bu farkın nedeni bilinmiyorsa sistem neden uydurmaz; bir sonraki yayında aynı bölüm ve saat karşılaştırılmalıdır.` : "Bir sonraki yayın tamamlandığında süre ve etkileşim hızı karşılaştırılacak."}</p></article>}
    <div className="session-list">{sessions.slice(0, 12).map((session) => <article key={session.id}><span><strong>{session.platform}</strong><small>{new Date(session.startedAt).toLocaleString("tr-TR")}</small></span><b>{session.endedAt ? `${Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))} dk` : "Canlı"}</b></article>)}</div>
  </div>;
}
