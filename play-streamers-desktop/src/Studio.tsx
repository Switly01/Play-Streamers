import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasNativeBridge,
  readEngineStatus,
  type StudioAudioDevice,
  type StudioCaptureOptions,
  type StudioCaptureSource,
  type StudioEngineStatus,
  type VirtualCameraStatus,
} from "./nativeBridge";

type BrowserCaptureState = "idle" | "choosing" | "recording" | "stopping";

interface StudioSettings {
  service: string;
  ingestUrl: string;
  streamKeyRef: string;
  width: number;
  height: number;
  framerate: number;
  bitrateKbps: number;
  audioDevice: string;
  captureSystemAudio: boolean;
  systemAudioVolume: number;
  microphoneVolume: number;
  drawCursor: boolean;
  recordLocally: boolean;
  sourceKind: "desktop" | "window" | "camera";
  sourceId: string;
  overlayText: string;
  overlayImagePath: string;
  multitrackAudio: boolean;
}

type StudioProfile = { id: string; name: string; settings: StudioSettings; createdAt: number };

const SETTINGS_KEY = "ps.studio.settings.v1";
const SETTINGS_UPDATED_KEY = "ps.studio.settings.updatedAt";
const API_BASE = "https://api.pstreamers.com";
const PROFILES_KEY = "ps.studio.profiles.v1";
const DEFAULT_SETTINGS: StudioSettings = {
  service: "Kick",
  ingestUrl: "",
  streamKeyRef: "ps.streamKey.primary",
  width: 1920,
  height: 1080,
  framerate: 30,
  bitrateKbps: 6000,
  audioDevice: "",
  captureSystemAudio: true,
  systemAudioVolume: 100,
  microphoneVolume: 100,
  drawCursor: true,
  recordLocally: true,
  sourceKind: "desktop",
  sourceId: "",
  overlayText: "",
  overlayImagePath: "",
  multitrackAudio: true,
};

function loadSettings(): StudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<StudioSettings>;
    return { ...DEFAULT_SETTINGS, ...stored, streamKeyRef: DEFAULT_SETTINGS.streamKeyRef };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadProfiles(): StudioProfile[] {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILES_KEY) || "[]") as StudioProfile[];
    return Array.isArray(value) ? value.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

function captureOptions(settings: StudioSettings, captureMode: "desktop" | "slate"): StudioCaptureOptions {
  return {
    width: settings.width,
    height: settings.height,
    framerate: settings.framerate,
    bitrateKbps: settings.bitrateKbps,
    audioDevice: settings.audioDevice || undefined,
    captureSystemAudio: settings.captureSystemAudio,
    systemAudioVolume: settings.systemAudioVolume,
    microphoneVolume: settings.microphoneVolume,
    captureMode,
    drawCursor: settings.drawCursor,
    sourceKind: settings.sourceKind,
    sourceId: settings.sourceId || undefined,
    overlayText: settings.overlayText.trim() || undefined,
    overlayImagePath: settings.overlayImagePath.trim() || undefined,
    multitrackAudio: settings.multitrackAudio,
  };
}

export function Studio() {
  const [browserState, setBrowserState] = useState<BrowserCaptureState>("idle");
  const [browserElapsed, setBrowserElapsed] = useState(0);
  const [message, setMessage] = useState("Studio motoru ve cihazlar denetleniyor…");
  const [engine, setEngine] = useState<StudioEngineStatus>({ state: "idle", backend: "browser-preview" });
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [draft, setDraft] = useState<StudioSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [hasStreamKey, setHasStreamKey] = useState(false);
  const [audioDevices, setAudioDevices] = useState<StudioAudioDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<StudioCaptureSource[]>([]);
  const [captureWindows, setCaptureWindows] = useState<StudioCaptureSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastRecordingPath, setLastRecordingPath] = useState("");
  const [profiles, setProfiles] = useState<StudioProfile[]>(loadProfiles);
  const [profileName, setProfileName] = useState("");
  const [activeScene, setActiveScene] = useState<"desktop" | "slate">(() => localStorage.getItem("ps.studio.scene") === "slate" ? "slate" : "desktop");
  const [virtualCamera, setVirtualCamera] = useState<VirtualCameraStatus>({
    supported: false,
    installed: false,
    running: false,
    label: "Play Streamers Camera",
    message: "Sanal kamera denetleniyor…",
  });
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cloudSessionRef = useRef<string | null>(null);

  const native = engine.backend === "native" && hasNativeBridge();
  const recording = native
    ? engine.state === "recording" || engine.state === "recording-and-streaming"
    : browserState === "recording";
  const streaming = native && (engine.state === "streaming" || engine.state === "recording-and-streaming");
  const elapsed = native ? engine.elapsedSeconds || 0 : browserElapsed;
  const qualityLabel = `${settings.height}p · ${settings.framerate} FPS · ${(settings.bitrateKbps / 1000).toFixed(1)} Mbps`;
  const encoderLabel = useMemo(() => {
    if (!native) return "Tarayıcı kayıt prototipi";
    if (!engine.encoder) return "Donanım kodlayıcı otomatik seçilir";
    return engine.encoder === "libx264" ? "İşlemci kodlayıcı · x264" : `Donanım kodlayıcı · ${engine.encoder}`;
  }, [engine.encoder, native]);

  useEffect(() => {
    let disposed = false;
    async function syncStatus() {
      try {
        const next = await readEngineStatus();
        if (!disposed) {
          setEngine(next);
          if (next.lastError && next.state === "idle") setMessage(`Studio: ${next.lastError}`);
          else if (next.backend === "native" && next.state === "idle") setMessage("Yerel Studio motoru hazır. Kayıt görüntüleri cihazında kalır.");
        }
      } catch {
        if (!disposed) setMessage("Studio motorunun durumu okunamadı.");
      }
    }
    void syncStatus();
    const timer = window.setInterval(() => void syncStatus(), 1500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!hasNativeBridge()) return;
    void window.playStreamersNative!.listAudioDevices().then(setAudioDevices).catch(() => setAudioDevices([]));
    void window.playStreamersNative!.listVideoDevices().then(setVideoDevices).catch(() => setVideoDevices([]));
    void window.playStreamersNative!.listCaptureWindows().then(setCaptureWindows).catch(() => setCaptureWindows([]));
    void window.playStreamersNative!.secureRead(DEFAULT_SETTINGS.streamKeyRef).then((value) => setHasStreamKey(Boolean(value))).catch(() => undefined);
    void refreshVirtualCamera();
    void hydrateCloudSettings();
  }, [engine.backend]);

  async function refreshVirtualCamera() {
    if (!window.playStreamersNative) return;
    try {
      setVirtualCamera(await window.playStreamersNative.getVirtualCameraStatus());
    } catch {
      setVirtualCamera((current) => ({ ...current, message: "Sanal kamera durumu okunamadı." }));
    }
  }

  async function toggleVirtualCamera() {
    if (!native || busy) return;
    setBusy(true);
    try {
      if (!virtualCamera.supported) {
        setMessage("Sanal kamera Windows 11 gerektirir.");
        return;
      }
      if (!virtualCamera.installed) {
        setMessage("Windows sanal kamera bileşeni kuruluyor; yönetici izni penceresini onayla.");
        await window.playStreamersNative!.installVirtualCamera();
        setMessage("Play Streamers Camera kuruldu. Artık kamera kullanan uygulamalarda görünecek.");
      } else if (virtualCamera.running) {
        await window.playStreamersNative!.stopVirtualCamera();
        setMessage("Sanal kamera görüntü paylaşımı kapatıldı.");
      } else {
        await window.playStreamersNative!.startVirtualCamera(captureOptions(settings, activeScene));
        setMessage("Studio sahnesi Play Streamers Camera üzerinden paylaşılıyor.");
      }
      await refreshVirtualCamera();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      await refreshVirtualCamera();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (browserState !== "recording") return;
    const startedAt = Date.now() - browserElapsed * 1000;
    const timer = window.setInterval(() => setBrowserElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [browserState]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input,textarea,select,[contenteditable='true']") || !event.ctrlKey || !event.altKey) return;
      if (event.code === "KeyR") {
        event.preventDefault();
        void toggleRecording();
      }
      if (event.code === "KeyL") {
        event.preventDefault();
        void toggleStreaming();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeScene, browserState, busy, engine, hasStreamKey, settings, streaming]);

  useEffect(() => {
    if (!window.playStreamersNative) return;
    return window.playStreamersNative.onStudioShortcut((action) => {
      if (action === "record") void toggleRecording();
      if (action === "stream") void toggleStreaming();
    });
  }, [activeScene, browserState, busy, engine, hasStreamKey, settings, streaming]);

  async function openPreview(includeAudio = false) {
    if (activeScene === "slate") {
      setMessage("Mola sahnesi yerel motor tarafından üretilir; ekran görüntüsü içermez.");
      return null;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMessage("Bu ortam canlı önizlemeyi desteklemiyor.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: settings.framerate }, audio: includeAudio });
      stream.getVideoTracks()[0]?.addEventListener("ended", closePreview, { once: true });
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      if (previewRef.current) previewRef.current.srcObject = stream;
      setMessage("Önizleme açık. Yerel motor kayıt ve yayını ayrı, güvenli süreçte yürütür.");
      return stream;
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "NotAllowedError" ? "Ekran seçimi iptal edildi." : "Önizleme açılamadı.");
      return null;
    }
  }

  function closePreview() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }

  async function startBrowserRecording() {
    if (typeof MediaRecorder === "undefined") {
      setMessage("Bu önizleme ortamı ekran kaydını desteklemiyor.");
      return;
    }
    setBrowserState("choosing");
    const stream = await openPreview(true);
    if (!stream) {
      setBrowserState("idle");
      return;
    }
    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: settings.bitrateKbps * 1000 } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `play-streamers-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setBrowserState("idle");
      setMessage("Kayıt tamamlandı ve cihazına indirildi.");
      setBrowserElapsed(0);
      closePreview();
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    setBrowserState("recording");
    setBrowserElapsed(0);
    setMessage("Kayıt cihazında devam ediyor; hiçbir görüntü sunucuya gönderilmiyor.");
  }

  function stopBrowserRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    setBrowserState("stopping");
    setMessage("Kayıt güvenli biçimde kapatılıyor…");
    recorder.stop();
    recorderRef.current = null;
  }

  async function toggleRecording() {
    if (busy || streaming) return;
    setBusy(true);
    try {
      if (!native) {
        if (browserState === "recording") stopBrowserRecording();
        else await startBrowserRecording();
        return;
      }
      if (recording) {
        const result = await window.playStreamersNative!.stopRecording();
        if (result.path) setLastRecordingPath(result.path);
        setMessage(result.path ? `Kayıt tamamlandı: ${result.path}` : "Kayıt tamamlandı.");
      } else {
        await window.playStreamersNative!.startRecording(captureOptions(settings, activeScene));
        setMessage("Güvenli MKV kaydı başladı.");
      }
      setEngine(await readEngineStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStreaming() {
    if (!native || busy) return;
    if (!streaming && (!settings.ingestUrl || !hasStreamKey)) {
      setDraft(settings);
      setSettingsOpen(true);
      setMessage("Yayın başlamadan önce RTMPS adresi ve yayın anahtarını kaydet.");
      return;
    }
    setBusy(true);
    try {
      if (streaming) {
        const finalElapsed = engine.elapsedSeconds || 0;
        await window.playStreamersNative!.stopStreaming();
        if (engine.outputPath) setLastRecordingPath(engine.outputPath);
        if (cloudSessionRef.current) {
          void finishCloudSession(cloudSessionRef.current, finalElapsed);
          cloudSessionRef.current = null;
        }
        setMessage(engine.outputPath ? `Yayın kapandı. Yerel kayıt: ${engine.outputPath}` : "Yayın güvenli biçimde kapatıldı.");
      } else {
        await window.playStreamersNative!.startStreaming({
          ...captureOptions(settings, activeScene),
          service: settings.service,
          ingestUrl: settings.ingestUrl,
          streamKeyRef: settings.streamKeyRef,
          recordLocally: settings.recordLocally,
        });
        cloudSessionRef.current = await startCloudSession(settings.service);
        setMessage(settings.recordLocally ? "Yayın ve güvenli MKV kaydı tek kodlama akışında başladı." : "RTMPS yayını başladı.");
      }
      setEngine(await readEngineStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function desktopSessionToken() {
    if (window.playStreamersNative) return window.playStreamersNative.secureRead("ps.session");
    return sessionStorage.getItem("ps.session");
  }

  async function startCloudSession(platform: string) {
    try {
      const token = await desktopSessionToken();
      if (!token) return null;
      const response = await fetch(`${API_BASE}/api/platform/stream-sessions`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const payload = await response.json().catch(() => null) as { session?: { id?: string } } | null;
      return response.ok && payload?.session?.id ? payload.session.id : null;
    } catch {
      return null;
    }
  }

  async function finishCloudSession(id: string, durationSeconds: number) {
    try {
      const token = await desktopSessionToken();
      if (!token) return;
      await fetch(`${API_BASE}/api/platform/stream-sessions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ summary: { durationSeconds, scene: activeScene, recordedLocally: settings.recordLocally } }),
      });
    } catch {
      // Yayın motoru ağ günlüğünden bağımsızdır; günlük hatası yayını etkilemez.
    }
  }

  async function saveSettings() {
    const ingestUrl = draft.ingestUrl.trim();
    if (ingestUrl && !ingestUrl.startsWith("rtmps://")) {
      setMessage("Yayın sunucusu güvenli rtmps:// adresi olmalıdır.");
      return;
    }
    if ((draft.sourceKind === "window" || draft.sourceKind === "camera") && !draft.sourceId) {
      setMessage(draft.sourceKind === "window" ? "Yakalanacak oyun, uygulama veya tarayıcı penceresini seç." : "Kullanılacak kamerayı seç.");
      return;
    }
    if (streamKey.trim() && hasNativeBridge()) {
      await window.playStreamersNative!.secureStore(draft.streamKeyRef, streamKey.trim());
      setHasStreamKey(true);
      setStreamKey("");
    }
    const safeDraft = { ...draft, ingestUrl };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeDraft));
    localStorage.setItem(SETTINGS_UPDATED_KEY, String(Date.now()));
    setSettings(safeDraft);
    setSettingsOpen(false);
    setMessage("Studio ayarları kaydedildi. Yayın anahtarı yalnız Windows güvenli kasasında tutuluyor.");
    void syncCloudSettings(safeDraft);
  }

  async function convertLastRecording() {
    if (!native || !lastRecordingPath || busy) return;
    setBusy(true);
    setMessage("MKV kaydı görüntü yeniden kodlanmadan MP4 kabına aktarılıyor…");
    try {
      const output = await window.playStreamersNative!.remuxRecording(lastRecordingPath);
      setMessage(`MP4 hazır: ${output}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function saveProfile() {
    const name = profileName.trim();
    if (!name) {
      setMessage("Profil için kısa bir ad yaz.");
      return;
    }
    const next = [{ id: crypto.randomUUID?.() || String(Date.now()), name, settings: draft, createdAt: Date.now() }, ...profiles].slice(0, 12);
    setProfiles(next);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
    setProfileName("");
    setMessage(`“${name}” Studio profili kaydedildi.`);
  }

  function removeProfile(id: string) {
    const next = profiles.filter((profile) => profile.id !== id);
    setProfiles(next);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(next));
  }

  function markClip() {
    if (!recording && !streaming) return;
    const key = "ps.workspace.clip-markers.v1";
    let items: Array<{ id: string; title: string; detail: string; done: boolean; createdAt: number }> = [];
    try { items = JSON.parse(localStorage.getItem(key) || "[]"); } catch { items = []; }
    const at = formatDuration(elapsed);
    items.unshift({ id: crypto.randomUUID?.() || String(Date.now()), title: `Studio işareti · ${at}`, detail: `${streaming ? "Canlı yayın" : "Kayıt"} · ${activeScene === "slate" ? "Mola" : "Ana sahne"}`, done: false, createdAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
    setMessage(`${at} anı klip listesine eklendi.`);
  }

  function cloudSafeSettings(value: StudioSettings) {
    return {
      service: value.service,
      ingestUrl: value.ingestUrl,
      width: value.width,
      height: value.height,
      framerate: value.framerate,
      bitrateKbps: value.bitrateKbps,
      audioDevice: value.audioDevice,
      captureSystemAudio: value.captureSystemAudio,
      systemAudioVolume: value.systemAudioVolume,
      microphoneVolume: value.microphoneVolume,
      drawCursor: value.drawCursor,
      recordLocally: value.recordLocally,
    };
  }

  async function syncCloudSettings(value: StudioSettings) {
    try {
      const token = await desktopSessionToken();
      if (!token) return;
      await fetch(`${API_BASE}/api/platform/settings`, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ featureId: "studio-stream", value: cloudSafeSettings(value) }),
      });
    } catch {
      // Yerel ayarlar ağdan bağımsız çalışır.
    }
  }

  async function hydrateCloudSettings() {
    try {
      const token = await desktopSessionToken();
      if (!token) return;
      const response = await fetch(`${API_BASE}/api/platform/settings`, { headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => null) as { settings?: Array<{ featureId?: string; value?: Partial<StudioSettings>; updatedAt?: number }> } | null;
      const remote = payload?.settings?.find((item) => item.featureId === "studio-stream");
      const localUpdatedAt = Number(localStorage.getItem(SETTINGS_UPDATED_KEY) || 0);
      if (!response.ok || !remote?.value || Number(remote.updatedAt || 0) <= localUpdatedAt) return;
      const merged = { ...DEFAULT_SETTINGS, ...remote.value, streamKeyRef: DEFAULT_SETTINGS.streamKeyRef };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      localStorage.setItem(SETTINGS_UPDATED_KEY, String(remote.updatedAt || Date.now()));
      setSettings(merged);
      setDraft(merged);
    } catch {
      // Çevrimdışı açılışta mevcut yerel ayarlar korunur.
    }
  }

  async function selectScene(scene: "desktop" | "slate") {
    if ((recording || streaming || virtualCamera.running) && native) {
      try {
        await window.playStreamersNative!.switchScene(scene);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    closePreview();
    setActiveScene(scene);
    localStorage.setItem("ps.studio.scene", scene);
    setMessage(scene === "desktop" ? "Ana sahne seçildi: birincil Windows ekranı." : "Mola sahnesi seçildi: ekran görüntüsü anında gizlendi.");
  }

  async function updateMixer(key: "systemAudioVolume" | "microphoneVolume", level: number) {
    const next = { ...settings, [key]: Math.max(0, Math.min(150, Math.round(level))) };
    if ((recording || streaming) && native) {
      try {
        await window.playStreamersNative!.setAudioVolume(key === "systemAudioVolume" ? "system" : "microphone", next[key]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setSettings(next);
    setDraft(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    localStorage.setItem(SETTINGS_UPDATED_KEY, String(Date.now()));
    void syncCloudSettings(next);
  }

  return (
    <div className="studio-workspace">
      <section className="studio-canvas-panel">
        <div className="panel-heading compact">
          <div><span className="eyebrow">STUDIO ÖNİZLEME</span><h2>Ana sahne</h2></div>
          <div className="studio-health"><span className={`status-dot ${native ? "online" : ""}`} /> {native ? "Yerel motor hazır" : "Güvenli kayıt prototipi"}</div>
        </div>
        <div className="studio-canvas">
          <video ref={previewRef} autoPlay muted playsInline />
          {!streamRef.current && activeScene === "desktop" && <div className="canvas-empty"><span>PS</span><strong>Ana sahne</strong><small>Ekran önizlemesi yalnız cihazında işlenir</small><button className="secondary-button preview-button" onClick={() => void openPreview(false)}>Önizleme aç</button></div>}
          {!streamRef.current && activeScene === "slate" && <div className="canvas-empty break"><span>PS</span><strong>Kısa bir mola</strong><small>Yayın birazdan devam edecek</small></div>}
          {(recording || streaming) && <div className={`recording-chip ${streaming ? "live" : ""}`}><i /> {streaming ? "LIVE" : "REC"} {formatDuration(elapsed)}</div>}
        </div>
        <div className="studio-message" title={message}>{message}</div>
      </section>

      <aside className="studio-side-panel">
        <div className="panel-heading compact"><div><span className="eyebrow">SAHNELER</span><h3>Yayın düzeni</h3></div><button className="icon-button" aria-label="Sahne ekle" disabled>+</button></div>
        <button className={`scene-row ${activeScene === "desktop" ? "active" : ""}`} onClick={() => void selectScene("desktop")}><span className="scene-preview">PS</span><span><strong>Ana sahne</strong><small>{settings.sourceKind === "window" ? "Oyun / pencere yakalama" : settings.sourceKind === "camera" ? "Kamera yakalama" : "Masaüstü yakalama"}</small></span></button>
        <button className={`scene-row ${activeScene === "slate" ? "active" : ""}`} onClick={() => void selectScene("slate")}><span className="scene-preview muted">•••</span><span><strong>Mola</strong><small>Gizli ekran sahnesi</small></span></button>
        <div className="studio-divider" />
        <div className="panel-heading compact"><div><span className="eyebrow">SESLER</span><h3>Mikser</h3></div></div>
        <MixerRow label={settings.captureSystemAudio ? "Masaüstü sesi" : "Masaüstü sesi kapalı"} level={settings.captureSystemAudio ? settings.systemAudioVolume : 0} disabled={!settings.captureSystemAudio} onLevel={(level) => void updateMixer("systemAudioVolume", level)} />
        <MixerRow label={settings.audioDevice || "Mikrofon seçilmedi"} level={settings.audioDevice ? settings.microphoneVolume : 0} disabled={!settings.audioDevice} onLevel={(level) => void updateMixer("microphoneVolume", level)} />
        {native && <div className={`virtual-camera-card ${virtualCamera.running ? "active" : ""} ${!virtualCamera.supported ? "unsupported" : ""}`}>
          <div><span>SANAL KAMERA · WINDOWS 11</span><strong>{virtualCamera.label}</strong><small>{virtualCamera.message}</small></div>
          <button type="button" onClick={() => void toggleVirtualCamera()} disabled={busy || !virtualCamera.supported}>
            {!virtualCamera.supported ? "Desteklenmiyor" : !virtualCamera.installed ? "Bir kez kur" : virtualCamera.running ? "Kamerayı kapat" : "Kamerayı aç"}
          </button>
        </div>}
        <div className="engine-card"><span>KODLAYICI</span><strong>{encoderLabel}</strong><small>{native ? "Uygun GPU yoksa x264’e geçer" : "Yerel paket bekleniyor"}</small></div>
        {native && <button className="recordings-folder" onClick={() => void window.playStreamersNative!.openRecordingsFolder().catch(() => setMessage("Kayıt klasörü açılamadı."))}>Kayıt klasörünü aç</button>}
        {native && lastRecordingPath && !recording && !streaming && <button className="recordings-folder" onClick={() => void convertLastRecording()} disabled={busy}>Son kaydı MP4 yap</button>}
        <small className="studio-shortcuts">Genel kısayollar<br />Ctrl + Alt + R · Kayıt<br />Ctrl + Alt + L · Yayın</small>
      </aside>

      <footer className="studio-controls">
        <div className="quality-summary"><strong>{qualityLabel}</strong><span>{encoderLabel}</span></div>
        <div className="studio-actions">
          <button className="secondary-button" onClick={() => { setDraft(settings); setSettingsOpen(true); }} disabled={recording || streaming}>Yayın ayarları</button>
          {(recording || streaming) && <button className="secondary-button" onClick={markClip}>Anı işaretle</button>}
          <button className={`record-button ${recording ? "active" : ""}`} onClick={() => void toggleRecording()} disabled={busy || streaming || browserState === "choosing" || browserState === "stopping"}>{recording ? "Kaydı bitir" : "Kayıt başlat"}</button>
          <button className={`live-button ${streaming ? "active" : ""}`} onClick={() => void toggleStreaming()} disabled={!native || busy || (recording && !streaming)} title={native ? "" : "Yerel RTMPS motoru gerekli"}>{streaming ? "Yayını bitir" : "Yayını başlat"}</button>
        </div>
      </footer>

      {settingsOpen && (
        <div className="studio-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
          <section className="studio-settings-modal" role="dialog" aria-modal="true" aria-labelledby="studio-settings-title">
            <div className="panel-heading"><div><span className="eyebrow">YEREL VE GÜVENLİ</span><h2 id="studio-settings-title">Studio ayarları</h2></div><button className="drawer-close" onClick={() => setSettingsOpen(false)}>×</button></div>
            <div className="settings-grid">
              <label><span>Platform</span><select value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value })}><option>Kick</option><option>Twitch</option><option>YouTube</option><option>Özel RTMPS</option></select></label>
              <label className="span-two"><span>RTMPS sunucu adresi</span><input value={draft.ingestUrl} onChange={(event) => setDraft({ ...draft, ingestUrl: event.target.value })} placeholder="rtmps://yayın-sunucusu/app" autoComplete="off" /></label>
              <label className="span-two"><span>Yayın anahtarı</span><input type="password" value={streamKey} onChange={(event) => setStreamKey(event.target.value)} placeholder={hasStreamKey ? "Güvenli kasada kayıtlı · değiştirmek için yaz" : "Yayın anahtarını gir"} autoComplete="new-password" /></label>
              <label><span>Çözünürlük</span><select value={`${draft.width}x${draft.height}`} onChange={(event) => { const [width, height] = event.target.value.split("x").map(Number); setDraft({ ...draft, width, height }); }}><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="2560x1440">2560 × 1440</option></select></label>
              <label><span>Kare hızı</span><select value={draft.framerate} onChange={(event) => setDraft({ ...draft, framerate: Number(event.target.value) })}><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
              <label><span>Video bit hızı</span><input type="number" min={1000} max={50000} step={500} value={draft.bitrateKbps} onChange={(event) => setDraft({ ...draft, bitrateKbps: Number(event.target.value) })} /></label>
              <label><span>Ses girişi</span><select value={draft.audioDevice} onChange={(event) => setDraft({ ...draft, audioDevice: event.target.value })}><option value="">Sessiz kanal</option>{audioDevices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
              <label><span>Ana görüntü kaynağı</span><select value={draft.sourceKind} onChange={(event) => setDraft({ ...draft, sourceKind: event.target.value as StudioSettings["sourceKind"], sourceId: "" })}><option value="desktop">Tüm ekran</option><option value="window">Oyun / uygulama / tarayıcı penceresi</option><option value="camera">Kamera</option></select></label>
              {draft.sourceKind === "window" && <label className="span-two"><span>Yakalanacak pencere</span><select value={draft.sourceId} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value })}><option value="">Pencere seç</option>{captureWindows.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>}
              {draft.sourceKind === "camera" && <label className="span-two"><span>Kamera</span><select value={draft.sourceId} onChange={(event) => setDraft({ ...draft, sourceId: event.target.value })}><option value="">Kamera seç</option>{videoDevices.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>}
              <label className="span-two"><span>Sahne yazısı (isteğe bağlı)</span><input value={draft.overlayText} maxLength={180} onChange={(event) => setDraft({ ...draft, overlayText: event.target.value })} placeholder="Örn. Her cuma 21.00'de canlı" /></label>
              <label className="span-two"><span>Logo / görsel dosyası (isteğe bağlı)</span><input value={draft.overlayImagePath} onChange={(event) => setDraft({ ...draft, overlayImagePath: event.target.value })} placeholder="C:\\Görseller\\logo.png" /></label>
            </div>
            <div className="settings-checks">
              <label><input type="checkbox" checked={draft.recordLocally} onChange={(event) => setDraft({ ...draft, recordLocally: event.target.checked })} /> Yayınla birlikte güvenli MKV kaydı al</label>
              <label><input type="checkbox" checked={draft.captureSystemAudio} onChange={(event) => setDraft({ ...draft, captureSystemAudio: event.target.checked })} /> Windows masaüstü sesini kaydet</label>
              <label><input type="checkbox" checked={draft.drawCursor} onChange={(event) => setDraft({ ...draft, drawCursor: event.target.checked })} /> Fare imlecini göster</label>
              <label><input type="checkbox" checked={draft.multitrackAudio} onChange={(event) => setDraft({ ...draft, multitrackAudio: event.target.checked })} /> Normal kayıtta yayın miksiyle birlikte mikrofon ve masaüstü sesini ayrı kanallarda tut</label>
            </div>
            <section className="studio-profiles">
              <div><strong>Studio profilleri</strong><small>Oyun, sohbet veya kayıt düzenlerini ayrı sakla.</small></div>
              <div className="profile-create"><input value={profileName} maxLength={40} onChange={(event) => setProfileName(event.target.value)} placeholder="Örn. Oyun yayını" /><button type="button" onClick={saveProfile}>Profili kaydet</button></div>
              <div className="profile-list">{profiles.map((profile) => <article key={profile.id}><button type="button" onClick={() => setDraft({ ...DEFAULT_SETTINGS, ...profile.settings })}><strong>{profile.name}</strong><small>{new Date(profile.createdAt).toLocaleDateString("tr-TR")} · {profile.settings.height}p/{profile.settings.framerate}</small></button><button type="button" aria-label={`${profile.name} profilini sil`} onClick={() => removeProfile(profile.id)}>×</button></article>)}</div>
            </section>
            <div className="settings-security"><strong>Yayın anahtarın uygulama ayarlarına yazılmaz.</strong><span>Windows Kimlik Bilgileri Yöneticisi’nde şifreli olarak tutulur.</span></div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>Vazgeç</button><button className="primary-button" onClick={() => void saveSettings()}>Güvenle kaydet</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function MixerRow({ label, level, disabled, onLevel }: { label: string; level: number; disabled: boolean; onLevel: (level: number) => void }) {
  return <div className="mixer-row"><div><strong title={label}>{label}</strong><button aria-label={`${label} sesini aç veya kapat`} disabled={disabled} onClick={() => onLevel(level > 0 ? 0 : 100)}>{level > 0 ? "⌁" : "×"}</button></div><div className="meter"><span style={{ width: `${Math.min(100, level)}%` }} /></div><input aria-label={`${label} ses düzeyi`} type="range" min="0" max="150" value={level} disabled={disabled} onChange={(event) => onLevel(Number(event.target.value))} /></div>;
}
