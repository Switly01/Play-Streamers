import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

function download(name: string, body: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

export function SnapshotWorkspace() {
  const [message, setMessage] = useState("Araç ve tema ayarlarının güvenli yerel yedeğini oluştur.");
  function createSnapshot() {
    const data: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) || "";
      if (key.startsWith("ps.workspace.") || key === "ps.theme") {
        const value = localStorage.getItem(key);
        if (value != null) data[key] = value;
      }
    }
    download(`play-streamers-calisma-alani-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), data }, null, 2), "application/json");
    setMessage(`${Object.keys(data).length} yerel ayar yedeklendi. Oturum ve yayın anahtarı dahil edilmedi.`);
  }
  async function restore(file: File) {
    try {
      const payload = JSON.parse(await file.text()) as { version?: number; data?: Record<string, string> };
      if (payload.version !== 1 || !payload.data || typeof payload.data !== "object") throw new Error();
      let count = 0;
      for (const [key, value] of Object.entries(payload.data)) {
        if (typeof value !== "string") continue;
        if (key.startsWith("ps.workspace.") || key === "ps.theme") {
          localStorage.setItem(key, value);
          count += 1;
        }
      }
      setMessage(`${count} ayar geri yüklendi. Uygulamayı yeniden açtığında tamamı uygulanacak.`);
    } catch {
      setMessage("Bu dosya geçerli bir Play Streamers çalışma alanı yedeği değil.");
    }
  }
  return <div className="feature-workspace special-workspace"><div className="special-actions"><button className="primary-button" onClick={createSnapshot}>Anlık görüntü indir</button><label className="file-action">Yedeği geri yükle<input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.currentTarget.value = ""; }} /></label></div><p className="special-message">{message}</p></div>;
}

export function WellbeingWorkspace() {
  const key = "ps.workspace.wellbeing.v1";
  const initial = readJson(key, { sessionMinutes: 120, breakEvery: 45, startedAt: 0 });
  const [sessionMinutes, setSessionMinutes] = useState(initial.sessionMinutes);
  const [breakEvery, setBreakEvery] = useState(initial.breakEvery);
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { localStorage.setItem(key, JSON.stringify({ sessionMinutes, breakEvery, startedAt })); }, [sessionMinutes, breakEvery, startedAt]);
  useEffect(() => { if (!startedAt) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [startedAt]);
  const elapsed = startedAt ? Math.floor((now - startedAt) / 60000) : 0;
  const nextBreak = startedAt ? Math.max(0, breakEvery - (elapsed % Math.max(1, breakEvery))) : breakEvery;
  const over = elapsed >= sessionMinutes;
  return <div className="feature-workspace special-workspace"><div className="special-fields"><label>Yayın sınırı (dk)<input type="number" min="30" max="720" value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))} /></label><label>Mola aralığı (dk)<input type="number" min="10" max="180" value={breakEvery} onChange={(event) => setBreakEvery(Number(event.target.value))} /></label></div><div className={`wellbeing-status ${over ? "warning" : ""}`}><strong>{startedAt ? `${elapsed} dakika yayındasın` : "Denge sayacı hazır"}</strong><span>{over ? "Belirlediğin süre sınırına ulaştın." : startedAt ? `Sonraki mola hatırlatmasına yaklaşık ${nextBreak} dakika.` : "Sayaç yalnız bu cihazda çalışır."}</span></div><div className="special-actions"><button className="primary-button" onClick={() => setStartedAt(startedAt ? 0 : Date.now())}>{startedAt ? "Sayacı bitir" : "Yayını takip etmeye başla"}</button>{startedAt && <button onClick={() => setStartedAt(Date.now())}>Molayı şimdi tamamladım</button>}</div></div>;
}

type StoryNode = { id: string; prompt: string; left: string; right: string };
export function InteractiveStoryWorkspace() {
  const key = "ps.workspace.interactive-story.v1";
  const [nodes, setNodes] = useState<StoryNode[]>(() => readJson(key, []));
  const [prompt, setPrompt] = useState(""); const [left, setLeft] = useState(""); const [right, setRight] = useState("");
  const [active, setActive] = useState(0);
  function persist(next: StoryNode[]) { setNodes(next); localStorage.setItem(key, JSON.stringify(next)); }
  function add() { if (!prompt.trim() || !left.trim() || !right.trim()) return; persist([...nodes, { id: crypto.randomUUID?.() || String(Date.now()), prompt: prompt.trim(), left: left.trim(), right: right.trim() }]); setPrompt(""); setLeft(""); setRight(""); }
  const current = nodes[active % Math.max(1, nodes.length)];
  return <div className="feature-workspace special-workspace"><form className="story-form" onSubmit={(event) => { event.preventDefault(); add(); }}><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Hikâyedeki karar anı" maxLength={180} /><div><input value={left} onChange={(event) => setLeft(event.target.value)} placeholder="A seçeneği" maxLength={80} /><input value={right} onChange={(event) => setRight(event.target.value)} placeholder="B seçeneği" maxLength={80} /></div><button className="primary-button">Karar kartı ekle</button></form>{current ? <article className="story-stage"><small>KARAR {active + 1} / {nodes.length}</small><strong>{current.prompt}</strong><div><button onClick={() => setActive((active + 1) % nodes.length)}>A · {current.left}</button><button onClick={() => setActive((active + 1) % nodes.length)}>B · {current.right}</button></div></article> : <p className="special-message">İzleyicinin iki seçenekten birini belirleyeceği ilk karar kartını ekle.</p>}<div className="mini-list">{nodes.map((node, index) => <span key={node.id}><button onClick={() => setActive(index)}>{index + 1}</button><b>{node.prompt}</b><button onClick={() => persist(nodes.filter((item) => item.id !== node.id))}>×</button></span>)}</div></div>;
}

export function SmartAlertsWorkspace() {
  const [baseline, setBaseline] = useState(100); const [current, setCurrent] = useState(100); const [threshold, setThreshold] = useState(20);
  const change = baseline ? ((current - baseline) / baseline) * 100 : 0;
  const meaningful = Math.abs(change) >= threshold;
  return <div className="feature-workspace special-workspace"><div className="special-fields three"><label>Önceki değer<input type="number" value={baseline} onChange={(event) => setBaseline(Number(event.target.value))} /></label><label>Şimdiki değer<input type="number" value={current} onChange={(event) => setCurrent(Number(event.target.value))} /></label><label>Uyarı eşiği %<input type="number" min="1" max="200" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label></div><article className={`alert-result ${meaningful ? "meaningful" : ""}`}><small>DEĞİŞİM</small><strong>{change >= 0 ? "+" : ""}{change.toFixed(1)}%</strong><p>{meaningful ? `Değişim belirlediğin %${threshold} eşiğini geçti; bu uyarı gösterilir.` : `Değişim %${threshold} eşiğinin altında; gereksiz bildirim oluşturulmaz.`}</p></article><p className="workspace-privacy">Karar yapay zekâyla değil, açık eşik ve gerçek sayılarla verilir.</p></div>;
}

export function OverlayWorkspace() {
  const [title, setTitle] = useState("Yayın birazdan başlıyor"); const [subtitle, setSubtitle] = useState("playstreamers"); const [color, setColor] = useState("#53fc18");
  const html = useMemo(() => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden;font-family:Arial;color:white}.card{position:absolute;left:5%;bottom:7%;padding:24px 30px;border-left:7px solid ${color};background:#07100de8;border-radius:12px;animation:in .55s ease both}.card b{display:block;font-size:34px}.card span{color:${color};font-size:18px}@keyframes in{from{opacity:0;transform:translateY(25px)}}</style><div class="card"><b>${title.replace(/[<>&]/g, "")}</b><span>${subtitle.replace(/[<>&]/g, "")}</span></div>`, [color, subtitle, title]);
  return <div className="feature-workspace special-workspace"><div className="special-fields"><label>Başlık<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} /></label><label>Alt etiket<input value={subtitle} maxLength={60} onChange={(event) => setSubtitle(event.target.value)} /></label><label>Vurgu rengi<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label></div><div className="overlay-preview" style={{ "--overlay-color": color } as CSSProperties}><strong>{title}</strong><span>{subtitle}</span></div><button className="primary-button" onClick={() => download("play-streamers-overlay.html", html, "text/html;charset=utf-8")}>Şeffaf HTML overlay indir</button></div>;
}

type Sound = { id: string; name: string; url: string };
export function SoundboardWorkspace() {
  const [sounds, setSounds] = useState<Sound[]>([]);
  function add(files: FileList | null) {
    const next = Array.from(files || []).filter((file) => file.type.startsWith("audio/") && file.size <= 10 * 1024 * 1024).slice(0, 12 - sounds.length).map((file) => ({ id: crypto.randomUUID?.() || `${Date.now()}-${file.name}`, name: file.name, url: URL.createObjectURL(file) }));
    setSounds([...sounds, ...next]);
  }
  return <div className="feature-workspace special-workspace"><label className="file-action">Ses ekle<input type="file" accept="audio/*" multiple onChange={(event) => { add(event.target.files); event.currentTarget.value = ""; }} /></label><div className="sound-grid">{sounds.map((sound, index) => <article key={sound.id}><button onClick={() => void new Audio(sound.url).play()}><b>{index + 1}</b><span>{sound.name}</span></button><button aria-label={`${sound.name} sesini kaldır`} onClick={() => { URL.revokeObjectURL(sound.url); setSounds(sounds.filter((item) => item.id !== sound.id)); }}>×</button></article>)}</div><p className="workspace-privacy">Sesler yüklenmez; bu oturum boyunca doğrudan cihazından çalınır. En fazla 10 MB.</p></div>;
}

export function RepurposeWorkspace() {
  const [topic, setTopic] = useState(""); const [moment, setMoment] = useState(""); const [result, setResult] = useState(""); const [generated, setGenerated] = useState(false);
  const cleanTopic = topic.trim(); const cleanMoment = moment.trim(); const cleanResult = result.trim();
  return <div className="feature-workspace special-workspace"><div className="repurpose-form"><input value={topic} maxLength={100} onChange={(event) => { setTopic(event.target.value); setGenerated(false); }} placeholder="Yayının ana konusu" /><textarea value={moment} maxLength={500} rows={3} onChange={(event) => { setMoment(event.target.value); setGenerated(false); }} placeholder="Öne çıkan anı kendi cümlenle yaz" /><input value={result} maxLength={140} onChange={(event) => { setResult(event.target.value); setGenerated(false); }} placeholder="Varsa doğrulanmış sonuç (örn. hedef %80 oldu)" /><button className="primary-button" disabled={!cleanTopic || !cleanMoment} onClick={() => setGenerated(true)}>İçerik paketini hazırla</button></div>{generated && <div className="repurpose-grid"><article><small>KISA VİDEO AÇILIŞI</small><strong>{cleanTopic}: yayında beklemediğimiz an</strong><p>{cleanMoment}</p></article><article><small>GÖNDERİ</small><strong>Bugünkü yayından not</strong><p>{cleanMoment}{cleanResult ? ` Sonuç: ${cleanResult}.` : ""}</p></article><article><small>SONRAKİ BÖLÜM</small><strong>{cleanTopic} · devam fikri</strong><p>Bu anın neden işe yaradığını bir sonraki yayında aynı bölüm süresi ve açık hedefle yeniden dene.</p></article></div>}<p className="workspace-privacy">Sistem yalnız yazdığın bilgileri yeniden düzenler; izlemediği yayına olay veya sonuç eklemez.</p></div>;
}

type SpeechResult = { duration: number; silencePercent: number; longestSilence: number; blocks: number };
export function SpeechCoachWorkspace() {
  const [result, setResult] = useState<SpeechResult | null>(null); const [status, setStatus] = useState("Yerel bir ses kaydı seç; dosya sunucuya gönderilmez.");
  async function analyze(file: File) {
    if (!file.type.startsWith("audio/") || file.size > 150 * 1024 * 1024) { setStatus("En fazla 150 MB büyüklüğünde bir ses dosyası seç."); return; }
    setStatus("Ses düzeyi ve sessiz bölümler cihazında ölçülüyor…");
    try {
      const context = new AudioContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const data = buffer.getChannelData(0); const windowSize = Math.max(1, Math.floor(buffer.sampleRate * 0.05));
      let silentWindows = 0; let currentSilent = 0; let longestSilent = 0; let blocks = 0; let wasActive = false; let windows = 0;
      for (let start = 0; start < data.length; start += windowSize) {
        let power = 0; const end = Math.min(data.length, start + windowSize);
        for (let index = start; index < end; index += 1) power += data[index] * data[index];
        const active = Math.sqrt(power / Math.max(1, end - start)) >= 0.015;
        windows += 1;
        if (!active) { silentWindows += 1; currentSilent += 1; longestSilent = Math.max(longestSilent, currentSilent); }
        else { if (!wasActive) blocks += 1; currentSilent = 0; }
        wasActive = active;
      }
      setResult({ duration: buffer.duration, silencePercent: windows ? (silentWindows / windows) * 100 : 0, longestSilence: longestSilent * 0.05, blocks });
      setStatus("Analiz tamamlandı; ham ses bellekte bırakılmadı.");
      await context.close();
    } catch { setStatus("Bu ses biçimi çözümlenemedi. WAV, MP3, M4A veya WebM dene."); }
  }
  return <div className="feature-workspace special-workspace"><label className="file-action">Ses kaydı seç<input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyze(file); event.currentTarget.value = ""; }} /></label><p className="special-message">{status}</p>{result && <div className="coach-metrics"><article><span>Süre</span><strong>{Math.round(result.duration / 60)} dk</strong></article><article><span>Sessizlik</span><strong>%{result.silencePercent.toFixed(1)}</strong></article><article><span>En uzun sessizlik</span><strong>{result.longestSilence.toFixed(1)} sn</strong></article><article><span>Konuşma bloğu</span><strong>{result.blocks}</strong></article></div>}<p className="workspace-privacy">Konuşma metne çevrilmez. Sonuç ses enerjisinden deterministik hesaplanır.</p></div>;
}

export function TransitionWorkspace() {
  const [label, setLabel] = useState("Sıradaki bölüm"); const [color, setColor] = useState("#53fc18"); const [style, setStyle] = useState("slide");
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050806;font-family:Arial;color:white}.wipe{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,#050806,${color}33);animation:${style === "fade" ? "fade" : "slide"} 1.1s ease both}.wipe:after{content:'';position:absolute;inset:auto 0 0;height:8px;background:${color}}b{font-size:54px}@keyframes slide{from{transform:translateX(-100%)}to{transform:none}}@keyframes fade{from{opacity:0}to{opacity:1}}</style><div class="wipe"><b>${label.replace(/[<>&]/g, "")}</b></div>`;
  return <div className="feature-workspace special-workspace"><div className="special-fields three"><label>Geçiş yazısı<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} /></label><label>Renk<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label>Hareket<select value={style} onChange={(event) => setStyle(event.target.value)}><option value="slide">Kayarak</option><option value="fade">Yumuşak görünüm</option></select></label></div><div className={`transition-preview ${style}`} style={{ "--overlay-color": color } as CSSProperties}><strong>{label}</strong></div><button className="primary-button" onClick={() => download("play-streamers-transition.html", html, "text/html;charset=utf-8")}>Geçiş paketini indir</button><p className="workspace-privacy">Paket şeffaf tarayıcı kaynağı veya sahne geçiş ekranı olarak yerelde kullanılabilir.</p></div>;
}

export function EmoteBadgeWorkspace() {
  const [text, setText] = useState("PS"); const [background, setBackground] = useState("#53fc18"); const [foreground, setForeground] = useState("#071007");
  function exportPng(size: number) {
    const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size; const context = canvas.getContext("2d"); if (!context) return;
    context.fillStyle = background; context.beginPath(); context.roundRect(0, 0, size, size, size * 0.24); context.fill(); context.fillStyle = foreground; context.font = `900 ${size * 0.38}px Arial`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text.trim().slice(0, 4).toUpperCase(), size / 2, size / 2 + size * 0.03, size * 0.78);
    const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `play-streamers-badge-${size}.png`; link.click();
  }
  return <div className="feature-workspace special-workspace"><div className="special-fields three"><label>Kısa işaret<input value={text} maxLength={4} onChange={(event) => setText(event.target.value)} /></label><label>Arka plan<input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label><label>Yazı<input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label></div><div className="badge-preview" style={{ background, color: foreground }}>{text.trim().slice(0, 4).toUpperCase()}</div><div className="special-actions">{[112, 56, 28].map((size) => <button key={size} onClick={() => exportPng(size)}>{size} × {size} PNG</button>)}</div><p className="workspace-privacy">Görsel cihazındaki canvas üzerinde üretilir; yapay zekâ veya dosya yükleme kullanılmaz.</p></div>;
}

export function MediaKitWorkspace() {
  const [name, setName] = useState("Kanal adı"); const [tagline, setTagline] = useState("Canlı yayıncı · içerik üreticisi"); const [about, setAbout] = useState(""); const [followers, setFollowers] = useState(0); const [viewers, setViewers] = useState(0);
  const html = `<!doctype html><meta charset="utf-8"><title>${name.replace(/[<>&]/g, "")}</title><style>body{margin:0;padding:8vw;background:#07100d;color:#eaf3ee;font-family:Arial}main{max-width:900px;margin:auto}small{color:#53fc18;font-weight:900;letter-spacing:.15em}h1{font-size:64px;margin:18px 0 8px}h2{color:#8da197;font-weight:400}.stats{display:flex;gap:15px;margin:45px 0}.stats b{padding:20px;border:1px solid #294031;border-radius:14px}p{font-size:20px;line-height:1.7}</style><main><small>PLAY STREAMERS · MEDIA KIT</small><h1>${name.replace(/[<>&]/g, "")}</h1><h2>${tagline.replace(/[<>&]/g, "")}</h2><div class="stats"><b>${followers} takipçi</b><b>${viewers} ortalama izleyici</b></div><p>${about.replace(/[<>&]/g, "")}</p></main>`;
  return <div className="feature-workspace special-workspace"><div className="special-fields"><label>Kanal adı<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label><label>Kısa tanım<input value={tagline} maxLength={120} onChange={(event) => setTagline(event.target.value)} /></label><label>Takipçi<input type="number" min="0" value={followers} onChange={(event) => setFollowers(Number(event.target.value))} /></label><label>Ortalama izleyici<input type="number" min="0" value={viewers} onChange={(event) => setViewers(Number(event.target.value))} /></label></div><textarea className="media-kit-about" value={about} rows={5} maxLength={1000} onChange={(event) => setAbout(event.target.value)} placeholder="Kanalını, yayın türlerini ve iş birliği yaklaşımını anlat." /><button className="primary-button" onClick={() => download("play-streamers-media-kit.html", html, "text/html;charset=utf-8")}>Paylaşılabilir medya kitini indir</button><p className="workspace-privacy">Yalnız girdiğin ve doğruladığın değerler kullanılır; istatistik uydurulmaz.</p></div>;
}

export function InsiderWorkspace() {
  const [enabled, setEnabled] = useState(localStorage.getItem("ps.insider.enabled") === "1");
  return <div className="feature-workspace special-workspace"><article className="insider-switch"><span><strong>Insider güncellemeleri</strong><small>Deneysel işlevler kararlı özelliklerden ayrı etiketlenir.</small></span><button className={enabled ? "active" : ""} onClick={() => { const next = !enabled; setEnabled(next); localStorage.setItem("ps.insider.enabled", next ? "1" : "0"); }}>{enabled ? "Açık" : "Kapalı"}</button></article><p className="workspace-privacy">Bu tercih yalnız sürüm kanalını işaretler; hazır olmayan özellikleri çalışıyor gibi açmaz.</p></div>;
}
