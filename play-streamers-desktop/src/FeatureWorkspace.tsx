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
  "revenue-cockpit": ["Gelir kaynaklarını yalnız doğrulanmış olaylarla karşılaştır"],
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
  if (feature.id === "studio-transition-lab") return <TransitionWorkspace />;
  if (feature.id === "emote-badge-studio") return <EmoteBadgeWorkspace />;
  if (feature.id === "media-kit") return <MediaKitWorkspace />;
  if (feature.id === "insider") return <InsiderWorkspace />;
  if (feature.id === "stream-timer") return <TimerWorkspace feature={feature} />;
  if (feature.id === "teleprompter") return <TeleprompterWorkspace feature={feature} />;
  if (feature.id === "themes") return <ThemeWorkspace />;
  if (GOAL_FEATURES.has(feature.id)) return <GoalWorkspace feature={feature} />;
  if (ANALYSIS_FEATURES.has(feature.id)) return <AnalysisWorkspace feature={feature} />;
  if (feature.id === "stream-bingo") return <BingoWorkspace feature={feature} />;
  return <ListWorkspace feature={feature} />;
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

  return <div className="feature-workspace">
    <div className="workspace-toolbar"><span><b>{items.filter((item) => item.done).length}</b> tamamlandı · {items.length} kayıt</span><button onClick={exportData}>Yedeğini al</button></div>
    <form className="workspace-form" onSubmit={(event) => { event.preventDefault(); add(); }}>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${feature.title} için yeni kayıt…`} maxLength={160} />
      <textarea value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Ayrıntı veya sonraki adım (isteğe bağlı)" maxLength={700} rows={3} />
      <button className="primary-button" type="submit">Çalışma alanına ekle</button>
    </form>
    <div className="workspace-list">
      {items.map((item) => <article key={item.id} className={item.done ? "done" : ""}>
        <button className="workspace-check" onClick={() => update(items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}>{item.done ? "✓" : ""}</button>
        <span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}<time>{new Date(item.createdAt).toLocaleDateString("tr-TR")}</time></span>
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

function AnalysisWorkspace({ feature }: { feature: FeatureDefinition }) {
  const [sessions, setSessions] = useState<InsightSession[]>([]);
  const [state, setState] = useState("Yayın geçmişi yükleniyor…");
  const [insight, setInsight] = useState<EvidenceInsight | null>(null);
  const [insightState, setInsightState] = useState("");
  const completed = useMemo(() => sessions.filter((session) => session.endedAt), [sessions]);
  const totalSeconds = completed.reduce((sum, session) => sum + Math.max(0, Number(session.endedAt) - Number(session.startedAt)) / 1000, 0);
  const totalInteractions = completed.reduce((sum, session) => sum + Number(session.interactions || 0), 0);
  const totalRevenue = completed.reduce((sum, session) => sum + Number(session.revenueMinor || 0), 0) / 100;
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
      setState(payload?.sessions?.length ? "Gerçek Studio oturumları" : "İlk Studio yayınından sonra burada karşılaştırma oluşacak.");
    })().catch(() => setState("Bağlantı çevrimdışı; yerel Studio çalışmaya devam eder."));
    return () => { disposed = true; };
  }, []);

  function exportCsv() {
    const rows = [["platform", "baslangic", "bitis", "sure_dakika", "tepe_izleyici", "etkilesim", "takipci", "gelir"], ...completed.map((session) => [session.platform, new Date(session.startedAt).toISOString(), new Date(session.endedAt!).toISOString(), Math.round((session.endedAt! - session.startedAt) / 60000), session.peakViewers, session.interactions, session.followersGained, (session.revenueMinor / 100).toFixed(2)])];
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
          current: { minutes: minutes(current), interactions: current.interactions, activeViewers: current.peakViewers, supporters: Math.max(0, Math.round(current.revenueMinor / 100)) },
          previous: { minutes: minutes(previous), interactions: previous.interactions, activeViewers: previous.peakViewers, supporters: Math.max(0, Math.round(previous.revenueMinor / 100)) },
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
    <div className="analysis-metrics"><article><span>Yayın</span><strong>{completed.length}</strong></article><article><span>Toplam süre</span><strong>{Math.round(totalSeconds / 60)} dk</strong></article><article><span>Etkileşim</span><strong>{totalInteractions}</strong></article><article><span>Doğrulanmış gelir</span><strong>₺{totalRevenue.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</strong></article></div>
    <div className="analysis-evidence"><span>VERİ DURUMU</span><strong>{state}</strong><p>{completed.length >= 2 ? "Karşılaştırma yapılabilir. Değişim oranları yalnız kayıtlı sayılardan hesaplanır; bilinmeyen nedenler uydurulmaz." : "Güvenilir bir eğilim söylemek için en az iki tamamlanmış yayın gerekir."}</p></div>
    {feature.ai && <div className="insight-action"><button className="primary-button" onClick={() => void createInsight()} disabled={completed.length < 2}>Kanıtlı açıklama oluştur</button>{insightState && <small>{insightState}</small>}</div>}
    {insight && <article className="generated-insight"><span>KANITLI YAYIN AÇIKLAMASI</span><h3>{insight.title}</h3><p>{insight.summary}</p><ul>{insight.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul><strong>Sonraki adım</strong><p>{insight.nextAction}</p></article>}
    {feature.id === "data-export" && <button className="primary-button" onClick={exportCsv} disabled={!completed.length}>CSV olarak indir</button>}
    <div className="session-list">{sessions.slice(0, 12).map((session) => <article key={session.id}><span><strong>{session.platform}</strong><small>{new Date(session.startedAt).toLocaleString("tr-TR")}</small></span><b>{session.endedAt ? `${Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))} dk` : "Canlı"}</b></article>)}</div>
  </div>;
}
