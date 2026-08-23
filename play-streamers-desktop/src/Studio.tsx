import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasNativeBridge,
  readEngineStatus,
  type StudioAudioDevice,
  type StudioCaptureOptions,
  type StudioCaptureSource,
  type StudioEngineStatus,
  type StudioSceneDefinition,
  type StudioSourceLayer,
  type StudioSourceLayerKind,
  type VirtualCameraStatus,
} from "./nativeBridge";

type BrowserCaptureState = "idle" | "choosing" | "recording" | "stopping";

interface StudioSettings {
  service: string;
  ingestUrl: string;
  streamKeyRef: string;
  secondaryOutputEnabled: boolean;
  secondaryService: string;
  secondaryIngestUrl: string;
  secondaryStreamKeyRef: string;
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
  noiseSuppression: boolean;
  microphoneCompressor: boolean;
  microphoneLimiter: boolean;
  microphoneNoiseGate: boolean;
  transitionMode: "cut" | "fade" | "crossfade";
  transitionDurationMs: number;
  replayBufferEnabled: boolean;
  replayBufferSeconds: number;
}

type StudioProfile = { id: string; name: string; settings: StudioSettings; scenes?: StudioScene[]; createdAt: number };

type StudioScene = StudioSceneDefinition & { createdAt: number };

interface LiveContext {
  observedAt: number;
  metrics: { activeViewers: number; interactions: number; followersGained: number; subscriptions: number; revenueMinor: number; revenueCurrency?: string; revenueByCurrency?: Record<string, number> };
  insight: { title: string; summary: string; nextAction: string; direction: "rising" | "falling" | "steady"; percentChange: number };
  verification: { kick: string; donations: string };
}

const SETTINGS_KEY = "ps.studio.settings.v1";
const SETTINGS_UPDATED_KEY = "ps.studio.settings.updatedAt";
const API_BASE = "https://api.pstreamers.com";
const PROFILES_KEY = "ps.studio.profiles.v1";
const SCENES_KEY = "ps.studio.scenes.v2";
const ACTIVE_SCENE_KEY = "ps.studio.scene.v2";
const PROGRAM_SCENE_KEY = "ps.studio.programScene.v1";
const MAX_STUDIO_SCENES = 32;
const MAX_SCENE_LAYERS = 64;
const DEFAULT_SETTINGS: StudioSettings = {
  service: "Kick",
  ingestUrl: "",
  streamKeyRef: "ps.streamKey.primary",
  secondaryOutputEnabled: false,
  secondaryService: "İkinci RTMPS",
  secondaryIngestUrl: "",
  secondaryStreamKeyRef: "ps.streamKey.secondary",
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
  noiseSuppression: true,
  microphoneCompressor: true,
  microphoneLimiter: true,
  microphoneNoiseGate: false,
  transitionMode: "cut",
  transitionDurationMs: 300,
  replayBufferEnabled: false,
  replayBufferSeconds: 30,
};

function normalizeSettings(value: Partial<StudioSettings>): StudioSettings {
  const merged = { ...DEFAULT_SETTINGS, ...value };
  return {
    ...merged,
    streamKeyRef: DEFAULT_SETTINGS.streamKeyRef,
    secondaryStreamKeyRef: DEFAULT_SETTINGS.secondaryStreamKeyRef,
    secondaryOutputEnabled: merged.secondaryOutputEnabled === true,
    transitionMode: merged.transitionMode === "fade" || merged.transitionMode === "crossfade" ? merged.transitionMode : "cut",
    transitionDurationMs: [150, 300, 500, 800].includes(Number(merged.transitionDurationMs)) ? Number(merged.transitionDurationMs) : 300,
    replayBufferEnabled: merged.replayBufferEnabled === true,
    replayBufferSeconds: [15, 30, 60, 120].includes(Number(merged.replayBufferSeconds)) ? Number(merged.replayBufferSeconds) : 30,
  };
}

function scenePercent(value: unknown, fallback: number, minimum = 0, maximum = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
}

function sourceLayerId() {
  return crypto.randomUUID?.() || `layer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSourceLayer(layer: StudioSourceLayer): StudioSourceLayer {
  const kind: StudioSourceLayerKind = ["text", "image", "media", "color"].includes(layer.kind) ? layer.kind : "text";
  return {
    id: typeof layer.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(layer.id) ? layer.id : sourceLayerId(),
    name: String(layer.name || ({ text: "Yazı", image: "Görsel", media: "Medya", color: "Renk alanı" }[kind])).slice(0, 40),
    kind,
    visible: layer.visible !== false,
    text: typeof layer.text === "string" ? layer.text.slice(0, 300) : undefined,
    path: typeof layer.path === "string" ? layer.path.slice(0, 520) : undefined,
    color: /^#[0-9a-f]{6}$/i.test(layer.color || "") ? layer.color : "#53fc18",
    scale: scenePercent(layer.scale, kind === "text" ? 42 : 30, kind === "text" ? 12 : 5, kind === "text" ? 96 : 100),
    x: scenePercent(layer.x, 50),
    y: scenePercent(layer.y, 50),
    width: scenePercent(layer.width, 30, 2),
    height: scenePercent(layer.height, 20, 2),
    opacity: scenePercent(layer.opacity, 100, 0),
  };
}

function legacySourceLayers(scene: StudioScene): StudioSourceLayer[] {
  const layers: StudioSourceLayer[] = [];
  if (scene.overlayImagePath) layers.push(normalizeSourceLayer({
    id: sourceLayerId(), name: "Görsel", kind: "image", visible: scene.overlayImageVisible !== false,
    path: scene.overlayImagePath, scale: scene.overlayImageScale ?? 20, x: scene.overlayImageX ?? 100,
    y: scene.overlayImageY ?? 100, opacity: 100,
  }));
  if (scene.overlayText) layers.push(normalizeSourceLayer({
    id: sourceLayerId(), name: "Yayın yazısı", kind: "text", visible: scene.overlayTextVisible !== false,
    text: scene.overlayText, scale: 42, x: scene.overlayTextX ?? 0, y: scene.overlayTextY ?? 100,
    opacity: 100,
  }));
  return layers;
}

function normalizeScene(scene: StudioScene): StudioScene {
  const rawLayers = Array.isArray(scene.layers) ? scene.layers : legacySourceLayers(scene);
  const seenLayerIds = new Set<string>();
  return {
    ...scene,
    sourceScale: scenePercent(scene.sourceScale, 100, 10),
    sourceX: scenePercent(scene.sourceX, 50),
    sourceY: scenePercent(scene.sourceY, 50),
    sourceCropLeft: scenePercent(scene.sourceCropLeft, 0, 0, 45),
    sourceCropRight: scenePercent(scene.sourceCropRight, 0, 0, 45),
    sourceCropTop: scenePercent(scene.sourceCropTop, 0, 0, 45),
    sourceCropBottom: scenePercent(scene.sourceCropBottom, 0, 0, 45),
    overlayTextVisible: scene.overlayTextVisible !== false,
    overlayTextX: scenePercent(scene.overlayTextX, 0),
    overlayTextY: scenePercent(scene.overlayTextY, 100),
    overlayImageVisible: scene.overlayImageVisible !== false,
    overlayImageScale: scenePercent(scene.overlayImageScale, 20, 5),
    overlayImageX: scenePercent(scene.overlayImageX, 100),
    overlayImageY: scenePercent(scene.overlayImageY, 100),
    layers: rawLayers.map(normalizeSourceLayer).filter((layer) => !seenLayerIds.has(layer.id) && seenLayerIds.add(layer.id)).slice(0, MAX_SCENE_LAYERS),
  };
}

function loadSettings(): StudioSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") as Partial<StudioSettings>;
    return normalizeSettings(stored);
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

function sceneId() {
  return crypto.randomUUID?.() || `scene-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultScenes(settings: StudioSettings): StudioScene[] {
  return [
    {
      id: "main",
      name: "Ana sahne",
      kind: "capture",
      sourceKind: settings.sourceKind,
      sourceId: settings.sourceId || undefined,
      overlayText: settings.overlayText || undefined,
      overlayImagePath: settings.overlayImagePath || undefined,
      sourceScale: 100,
      sourceX: 50,
      sourceY: 50,
      sourceCropLeft: 0,
      sourceCropRight: 0,
      sourceCropTop: 0,
      sourceCropBottom: 0,
      overlayTextVisible: true,
      overlayTextX: 0,
      overlayTextY: 100,
      overlayImageVisible: true,
      overlayImageScale: 20,
      overlayImageX: 100,
      overlayImageY: 100,
      layers: [
        ...(settings.overlayImagePath ? [{ id: sourceLayerId(), name: "Görsel", kind: "image" as const, visible: true, path: settings.overlayImagePath, scale: 20, x: 100, y: 100, opacity: 100 }] : []),
        ...(settings.overlayText ? [{ id: sourceLayerId(), name: "Yayın yazısı", kind: "text" as const, visible: true, text: settings.overlayText, scale: 42, x: 0, y: 100, opacity: 100 }] : []),
      ],
      createdAt: Date.now(),
    },
    { id: "break", name: "Mola", kind: "slate", sourceKind: "desktop", createdAt: Date.now() },
  ];
}

function loadScenes(settings: StudioSettings): StudioScene[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SCENES_KEY) || "[]") as StudioScene[];
    const seen = new Set<string>();
    const valid = stored.filter((scene) => scene && typeof scene.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(scene.id) && !seen.has(scene.id) && seen.add(scene.id) && typeof scene.name === "string" && scene.name.trim().length > 0 && scene.name.length <= 48 && (scene.kind === "capture" || scene.kind === "slate"));
    return valid.length ? valid.slice(0, MAX_STUDIO_SCENES).map(normalizeScene) : defaultScenes(settings);
  } catch {
    return defaultScenes(settings);
  }
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${rest}`;
}

function transitionCopy(mode: StudioSettings["transitionMode"], durationMs: number, compact = false) {
  if (mode === "fade") return compact ? `${durationMs} MS KARARMA` : `${durationMs} ms kararma`;
  if (mode === "crossfade") return compact ? `${durationMs} MS YUMUŞAK GEÇİŞ` : `${durationMs} ms yumuşak geçiş`;
  return compact ? "ANINDA KES" : "anında kesme";
}

function captureOptions(settings: StudioSettings, activeScene: StudioScene, scenes: StudioScene[]): StudioCaptureOptions {
  return {
    width: settings.width,
    height: settings.height,
    framerate: settings.framerate,
    bitrateKbps: settings.bitrateKbps,
    audioDevice: settings.audioDevice || undefined,
    captureSystemAudio: settings.captureSystemAudio,
    systemAudioVolume: settings.systemAudioVolume,
    microphoneVolume: settings.microphoneVolume,
    captureMode: activeScene.kind === "slate" ? "slate" : "desktop",
    activeSceneId: activeScene.id,
    scenes: scenes.map(({ createdAt: _, ...scene }) => scene),
    drawCursor: settings.drawCursor,
    sourceKind: activeScene.sourceKind,
    sourceId: activeScene.sourceId || undefined,
    overlayText: activeScene.overlayText?.trim() || undefined,
    overlayImagePath: activeScene.overlayImagePath?.trim() || undefined,
    multitrackAudio: settings.multitrackAudio,
    noiseSuppression: settings.noiseSuppression,
    microphoneCompressor: settings.microphoneCompressor,
    microphoneLimiter: settings.microphoneLimiter,
    microphoneNoiseGate: settings.microphoneNoiseGate,
    replayBufferEnabled: settings.replayBufferEnabled,
    replayBufferSeconds: settings.replayBufferSeconds,
  };
}

export function Studio({ onOpenTransitionLab }: { onOpenTransitionLab?: () => void }) {
  const [browserState, setBrowserState] = useState<BrowserCaptureState>("idle");
  const [browserElapsed, setBrowserElapsed] = useState(0);
  const [message, setMessage] = useState("Studio motoru ve cihazlar denetleniyor…");
  const [engine, setEngine] = useState<StudioEngineStatus>({ state: "idle", backend: "browser-preview" });
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [draft, setDraft] = useState<StudioSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [hasStreamKey, setHasStreamKey] = useState(false);
  const [secondaryStreamKey, setSecondaryStreamKey] = useState("");
  const [hasSecondaryStreamKey, setHasSecondaryStreamKey] = useState(false);
  const [audioDevices, setAudioDevices] = useState<StudioAudioDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<StudioCaptureSource[]>([]);
  const [captureWindows, setCaptureWindows] = useState<StudioCaptureSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastRecordingPath, setLastRecordingPath] = useState("");
  const [profiles, setProfiles] = useState<StudioProfile[]>(loadProfiles);
  const [profileName, setProfileName] = useState("");
  const [scenes, setScenes] = useState<StudioScene[]>(() => loadScenes(loadSettings()));
  const [activeSceneId, setActiveSceneId] = useState(() => localStorage.getItem(ACTIVE_SCENE_KEY) || "main");
  const [programSceneId, setProgramSceneId] = useState(() => localStorage.getItem(PROGRAM_SCENE_KEY) || localStorage.getItem(ACTIVE_SCENE_KEY) || "main");
  const [virtualCamera, setVirtualCamera] = useState<VirtualCameraStatus>({
    supported: false,
    installed: false,
    running: false,
    label: "Play Streamers Camera",
    message: "Sanal kamera denetleniyor…",
  });
  const [nativePreviewFrame, setNativePreviewFrame] = useState("");
  const [nativePreviewRunning, setNativePreviewRunning] = useState(false);
  const [liveContext, setLiveContext] = useState<LiveContext | null>(null);
  const [canvasEditing, setCanvasEditing] = useState(false);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const previewRunningRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cloudSessionRef = useRef<string | null>(null);
  const liveContextRef = useRef<LiveContext | null>(null);
  const peakViewersRef = useRef(0);

  const activeScene = scenes.find((scene) => scene.id === activeSceneId) || scenes[0] || defaultScenes(settings)[0];
  const programScene = scenes.find((scene) => scene.id === programSceneId) || activeScene;

  const native = engine.backend === "native" && hasNativeBridge();
  const recording = native
    ? engine.state === "recording" || engine.state === "recording-and-streaming"
    : browserState === "recording";
  const streaming = native && (engine.state === "streaming" || engine.state === "recording-and-streaming");
  const liveGraphRunning = native && (recording || streaming || virtualCamera.running || nativePreviewRunning);
  const elapsed = native ? engine.elapsedSeconds || 0 : browserElapsed;
  const qualityLabel = `${settings.height}p · ${settings.framerate} FPS · ${(settings.bitrateKbps / 1000).toFixed(1)} Mbps`;
  const encoderLabel = useMemo(() => {
    if (!native) return "Tarayıcı kayıt prototipi";
    if (!engine.encoder) return "Donanım kodlayıcı otomatik seçilir";
    return engine.encoder === "libx264" ? "İşlemci kodlayıcı · x264" : `Donanım kodlayıcı · ${engine.encoder}`;
  }, [engine.encoder, native]);
  const health = useMemo(() => {
    if (!recording && !streaming) return { tone: "", label: native ? "Yerel motor hazır" : "Güvenli kayıt prototipi" };
    if ((engine.speed || 1) < 0.9) return { tone: "error", label: "Kodlama gerçek zamanın gerisinde" };
    if ((engine.droppedFrames || 0) > 0) return { tone: "warning", label: `${engine.droppedFrames} kare düştü` };
    if (streaming && (engine.bitrateKbps || settings.bitrateKbps) < settings.bitrateKbps * 0.7) return { tone: "warning", label: "Yayın bit hızı hedefin altında" };
    if ((engine.reconnectAttempts || 0) > 0) return { tone: "warning", label: `Bağlantı yeniden kuruldu · ${engine.reconnectAttempts}` };
    return { tone: "healthy", label: "Yayın sağlığı iyi" };
  }, [engine.bitrateKbps, engine.droppedFrames, engine.reconnectAttempts, engine.speed, native, recording, settings.bitrateKbps, streaming]);

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
    void window.playStreamersNative!.secureRead(DEFAULT_SETTINGS.secondaryStreamKeyRef).then((value) => setHasSecondaryStreamKey(Boolean(value))).catch(() => undefined);
    void refreshVirtualCamera();
    void hydrateCloudSettings();
  }, [engine.backend]);

  useEffect(() => {
    if (!streaming || !cloudSessionRef.current) return;
    let disposed = false;
    const syncLiveContext = async () => {
      try {
        const token = await desktopSessionToken();
        const sessionId = cloudSessionRef.current;
        if (!token || !sessionId) return;
        const response = await fetch(`${API_BASE}/api/platform/live-context?sessionId=${encodeURIComponent(sessionId)}`, { headers: { authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => null) as LiveContext | null;
        if (!disposed && response.ok && payload?.metrics) {
          peakViewersRef.current = Math.max(peakViewersRef.current, payload.metrics.activeViewers || 0);
          liveContextRef.current = payload;
          setLiveContext(payload);
        }
      } catch {
        // Doğrulanmış veri özeti yayından bağımsızdır; bağlantı hatası motoru etkilemez.
      }
    };
    void syncLiveContext();
    const timer = window.setInterval(() => void syncLiveContext(), 10_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [streaming]);

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
        await window.playStreamersNative!.startVirtualCamera(captureOptions(settings, programScene, scenes));
        setMessage(`“${programScene.name}” Program sahnesi Play Streamers Camera üzerinden paylaşılıyor.`);
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

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    if (previewRunningRef.current) void window.playStreamersNative?.stopStudioPreview();
  }, []);

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
      if (event.code === "KeyB") {
        event.preventDefault();
        void saveReplayBuffer();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [activeSceneId, programSceneId, browserState, busy, engine, hasStreamKey, scenes, settings, streaming]);

  useEffect(() => {
    if (!window.playStreamersNative) return;
    return window.playStreamersNative.onStudioShortcut((action) => {
      if (action === "record") void toggleRecording();
      if (action === "stream") void toggleStreaming();
      if (action === "replay") void saveReplayBuffer();
    });
  }, [activeSceneId, programSceneId, browserState, busy, engine, hasStreamKey, scenes, settings, streaming]);

  async function openPreview(includeAudio = false, scene = activeScene) {
    if (native) {
      try {
        if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
        await window.playStreamersNative!.stopStudioPreview().catch(() => undefined);
        await window.playStreamersNative!.startStudioPreview(captureOptions(settings, scene, scenes));
        previewRunningRef.current = true;
        setNativePreviewRunning(true);
        const refreshFrame = async () => {
          const frame = await window.playStreamersNative!.readStudioPreviewFrame().catch(() => null);
          if (frame && previewRunningRef.current) setNativePreviewFrame(frame);
        };
        await refreshFrame();
        previewTimerRef.current = window.setInterval(() => void refreshFrame(), 180);
        setMessage(`“${scene.name}” bağımsız Önizleme kanalında açık; Program çıkışı değişmedi.`);
      } catch (error) {
        previewRunningRef.current = false;
        setNativePreviewRunning(false);
        setMessage(error instanceof Error ? error.message : String(error));
      }
      return null;
    }
    if (scene.kind === "slate") {
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
    if (previewTimerRef.current) window.clearInterval(previewTimerRef.current);
    previewTimerRef.current = null;
    previewRunningRef.current = false;
    setNativePreviewRunning(false);
    setNativePreviewFrame("");
    void window.playStreamersNative?.stopStudioPreview();
  }

  async function startBrowserRecording() {
    if (typeof MediaRecorder === "undefined") {
      setMessage("Bu önizleme ortamı ekran kaydını desteklemiyor.");
      return;
    }
    setBrowserState("choosing");
    const stream = await openPreview(true, programScene);
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
        await window.playStreamersNative!.startRecording(captureOptions(settings, programScene, scenes));
        setMessage(`Güvenli MKV kaydı “${programScene.name}” Program sahnesiyle başladı.`);
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
    const secondaryIncomplete = settings.secondaryOutputEnabled && (!settings.secondaryIngestUrl || !hasSecondaryStreamKey);
    if (!streaming && (!settings.ingestUrl || !hasStreamKey || secondaryIncomplete)) {
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
        peakViewersRef.current = 0;
        liveContextRef.current = null;
        setLiveContext(null);
        await window.playStreamersNative!.startStreaming({
          ...captureOptions(settings, programScene, scenes),
          service: settings.service,
          ingestUrl: settings.ingestUrl,
          streamKeyRef: settings.streamKeyRef,
          additionalTargets: settings.secondaryOutputEnabled ? [{
            service: settings.secondaryService,
            ingestUrl: settings.secondaryIngestUrl,
            streamKeyRef: settings.secondaryStreamKeyRef,
          }] : [],
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
      const context = liveContextRef.current;
      await fetch(`${API_BASE}/api/platform/stream-sessions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          peakViewers: peakViewersRef.current,
          interactions: context?.metrics.interactions || 0,
          followersGained: context?.metrics.followersGained || 0,
          revenueMinor: context?.metrics.revenueMinor || 0,
          summary: { durationSeconds, sceneId: programScene.id, sceneName: programScene.name, recordedLocally: settings.recordLocally, subscriptions: context?.metrics.subscriptions || 0, revenueCurrency: context?.metrics.revenueCurrency || null, revenueByCurrency: context?.metrics.revenueByCurrency || {}, insight: context?.insight || null, verification: context?.verification || null },
        }),
      });
    } catch {
      // Yayın motoru ağ günlüğünden bağımsızdır; günlük hatası yayını etkilemez.
    }
  }

  async function saveSettings() {
    const ingestUrl = draft.ingestUrl.trim();
    const secondaryIngestUrl = draft.secondaryIngestUrl.trim();
    if (ingestUrl && !ingestUrl.startsWith("rtmps://")) {
      setMessage("Yayın sunucusu güvenli rtmps:// adresi olmalıdır.");
      return;
    }
    if (draft.secondaryOutputEnabled && (!secondaryIngestUrl || !secondaryIngestUrl.startsWith("rtmps://"))) {
      setMessage("İkinci yayın çıkışı için güvenli rtmps:// sunucu adresi gereklidir.");
      return;
    }
    const incompleteScene = scenes.find((scene) => scene.kind === "capture" && (scene.sourceKind === "window" || scene.sourceKind === "camera") && !scene.sourceId);
    if (incompleteScene) {
      setMessage(`“${incompleteScene.name}” için ${incompleteScene.sourceKind === "window" ? "yakalanacak pencereyi" : "kamerayı"} seç.`);
      return;
    }
    if (streamKey.trim() && hasNativeBridge()) {
      await window.playStreamersNative!.secureStore(draft.streamKeyRef, streamKey.trim());
      setHasStreamKey(true);
      setStreamKey("");
    }
    if (secondaryStreamKey.trim() && hasNativeBridge()) {
      await window.playStreamersNative!.secureStore(draft.secondaryStreamKeyRef, secondaryStreamKey.trim());
      setHasSecondaryStreamKey(true);
      setSecondaryStreamKey("");
    }
    if (draft.secondaryOutputEnabled && !secondaryStreamKey.trim() && !hasSecondaryStreamKey) {
      setMessage("İkinci yayın çıkışı için yayın anahtarını gir.");
      return;
    }
    const safeDraft = normalizeSettings({ ...draft, ingestUrl, secondaryIngestUrl });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeDraft));
    localStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
    localStorage.setItem(SETTINGS_UPDATED_KEY, String(Date.now()));
    setSettings(safeDraft);
    closePreview();
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
    const next = [{ id: crypto.randomUUID?.() || String(Date.now()), name, settings: normalizeSettings(draft), scenes: scenes.map(normalizeScene), createdAt: Date.now() }, ...profiles].slice(0, 12);
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

  function loadProfile(profile: StudioProfile) {
    setDraft({ ...DEFAULT_SETTINGS, ...profile.settings });
    if (profile.scenes?.length) {
      const nextScenes = profile.scenes.slice(0, MAX_STUDIO_SCENES);
      persistScenes(nextScenes);
      setActiveSceneId(nextScenes[0].id);
      localStorage.setItem(ACTIVE_SCENE_KEY, nextScenes[0].id);
      setProgramSceneId(nextScenes[0].id);
      localStorage.setItem(PROGRAM_SCENE_KEY, nextScenes[0].id);
    }
    setMessage(`“${profile.name}” profili düzenleyiciye yüklendi. Değişiklikleri uygulamak için Kaydet'i seç.`);
  }

  function markClip() {
    if (!recording && !streaming) return;
    const key = "ps.workspace.clip-markers.v1";
    let items: Array<{ id: string; title: string; detail: string; done: boolean; createdAt: number }> = [];
    try { items = JSON.parse(localStorage.getItem(key) || "[]"); } catch { items = []; }
    const at = formatDuration(elapsed);
    items.unshift({ id: crypto.randomUUID?.() || String(Date.now()), title: `Studio işareti · ${at}`, detail: `${streaming ? "Canlı yayın" : "Kayıt"} · ${programScene.name}`, done: false, createdAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(items.slice(0, 100)));
    setMessage(`${at} anı klip listesine eklendi.`);
  }

  async function saveReplayBuffer() {
    if (!native || busy || !settings.replayBufferEnabled || (!recording && !streaming && !engine.replayBufferReady)) return;
    setBusy(true);
    try {
      const path = await window.playStreamersNative!.saveReplayBuffer();
      setLastRecordingPath(path);
      setMessage(`Son ${engine.replayBufferSeconds || settings.replayBufferSeconds} saniye kaydedildi: ${path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function cloudSafeSettings(value: StudioSettings) {
    return {
      service: value.service,
      ingestUrl: value.ingestUrl,
      secondaryOutputEnabled: value.secondaryOutputEnabled,
      secondaryService: value.secondaryService,
      secondaryIngestUrl: value.secondaryIngestUrl,
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
      multitrackAudio: value.multitrackAudio,
      noiseSuppression: value.noiseSuppression,
      microphoneNoiseGate: value.microphoneNoiseGate,
      microphoneCompressor: value.microphoneCompressor,
      microphoneLimiter: value.microphoneLimiter,
      transitionMode: value.transitionMode,
      transitionDurationMs: value.transitionDurationMs,
      replayBufferEnabled: value.replayBufferEnabled,
      replayBufferSeconds: value.replayBufferSeconds,
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
      const merged = normalizeSettings(remote.value);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      localStorage.setItem(SETTINGS_UPDATED_KEY, String(remote.updatedAt || Date.now()));
      setSettings(merged);
      setDraft(merged);
    } catch {
      // Çevrimdışı açılışta mevcut yerel ayarlar korunur.
    }
  }

  function persistScenes(next: StudioScene[]) {
    const normalized = next.slice(0, MAX_STUDIO_SCENES).map(normalizeScene);
    setScenes(normalized);
    localStorage.setItem(SCENES_KEY, JSON.stringify(normalized));
  }

  function updateActiveScene(patch: Partial<StudioScene>) {
    persistScenes(scenes.map((scene) => scene.id === activeScene.id ? { ...scene, ...patch } : scene));
  }

  function addSourceLayer(kind: StudioSourceLayerKind) {
    const layers = activeScene.layers || [];
    if (layers.length >= MAX_SCENE_LAYERS) {
      setMessage(`Bir sahnede en fazla ${MAX_SCENE_LAYERS} ek kaynak kullanılabilir.`);
      return;
    }
    const defaults: Record<StudioSourceLayerKind, Omit<StudioSourceLayer, "id" | "kind">> = {
      text: { name: "Yeni yazı", visible: true, text: "Yayın yazısı", scale: 42, x: 50, y: 50, opacity: 100 },
      image: { name: "Yeni görsel", visible: true, path: "", scale: 30, x: 50, y: 50, opacity: 100 },
      media: { name: "Yeni medya", visible: true, path: "", scale: 50, x: 50, y: 50, opacity: 100 },
      color: { name: "Renk alanı", visible: true, color: "#53fc18", width: 30, height: 20, x: 50, y: 50, opacity: 80 },
    };
    updateActiveScene({ layers: [...layers, normalizeSourceLayer({ id: sourceLayerId(), kind, ...defaults[kind] })] });
  }

  function updateSourceLayer(id: string, patch: Partial<StudioSourceLayer>) {
    updateActiveScene({ layers: (activeScene.layers || []).map((layer) => layer.id === id ? normalizeSourceLayer({ ...layer, ...patch }) : layer) });
  }

  function moveLayerOnCanvas(id: string, clientX: number, clientY: number) {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - bounds.left) / bounds.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - bounds.top) / bounds.height) * 100)));
    setScenes((current) => {
      const next = current.map((scene) => scene.id !== activeScene.id ? scene : normalizeScene({
        ...scene,
        layers: (scene.layers || []).map((layer) => layer.id === id ? normalizeSourceLayer({ ...layer, x, y }) : layer),
      }));
      localStorage.setItem(SCENES_KEY, JSON.stringify(next));
      return next;
    });
  }

  function finishCanvasDrag() {
    if (!dragLayerId) return;
    setDragLayerId(null);
    setMessage("Kaynak tuval üzerinde konumlandırıldı. Açık Önizleme yeniden başlatıldığında gerçek kompozisyona uygulanır.");
  }

  async function setLiveSourceOpacity(sourceId: string, level: number) {
    if (!liveGraphRunning || !window.playStreamersNative) return true;
    try {
      await window.playStreamersNative.setSourceOpacity(activeScene.id, sourceId, Math.max(0, Math.min(100, Math.round(level))));
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async function toggleSourceLayer(layer: StudioSourceLayer, visible: boolean) {
    const applied = await setLiveSourceOpacity(layer.id, visible ? layer.opacity ?? 100 : 0);
    if (!applied) return;
    updateSourceLayer(layer.id, { visible });
    if (liveGraphRunning) {
      setMessage(`“${layer.name}” kaynağı ${visible ? "canlı çıkışta gösteriliyor" : "canlı çıkıştan gizlendi"}.`);
    }
  }

  async function commitSourceOpacity(sourceId: string, level: number) {
    const layer = (activeScene.layers || []).find((item) => item.id === sourceId);
    if (!layer?.visible || !liveGraphRunning) return;
    if (await setLiveSourceOpacity(sourceId, level)) {
      setMessage(`“${layer.name}” canlı opaklığı %${Math.round(level)} olarak uygulandı.`);
    }
  }

  function removeSourceLayer(id: string) {
    updateActiveScene({ layers: (activeScene.layers || []).filter((layer) => layer.id !== id) });
  }

  function moveSourceLayer(id: string, direction: -1 | 1) {
    const layers = [...(activeScene.layers || [])];
    const index = layers.findIndex((layer) => layer.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return;
    [layers[index], layers[target]] = [layers[target], layers[index]];
    updateActiveScene({ layers });
  }

  function addScene() {
    if (scenes.length >= MAX_STUDIO_SCENES) {
      setMessage(`Bir Studio projesinde en fazla ${MAX_STUDIO_SCENES} sahne kullanılabilir.`);
      return;
    }
    const scene: StudioScene = {
      id: sceneId(),
      name: `Sahne ${scenes.length + 1}`,
      kind: "capture",
      sourceKind: "desktop",
      sourceScale: 100,
      sourceX: 50,
      sourceY: 50,
      sourceCropLeft: 0,
      sourceCropRight: 0,
      sourceCropTop: 0,
      sourceCropBottom: 0,
      overlayTextVisible: true,
      overlayTextX: 0,
      overlayTextY: 100,
      overlayImageVisible: true,
      overlayImageScale: 20,
      overlayImageX: 100,
      overlayImageY: 100,
      layers: [],
      createdAt: Date.now(),
    };
    if (previewRunningRef.current || streamRef.current) closePreview();
    persistScenes([...scenes, scene]);
    setActiveSceneId(scene.id);
    localStorage.setItem(ACTIVE_SCENE_KEY, scene.id);
    setSettingsOpen(true);
    setMessage(`“${scene.name}” eklendi. Kaynağını ve sahne ayrıntılarını seç.`);
  }

  function duplicateScene() {
    if (scenes.length >= MAX_STUDIO_SCENES) {
      setMessage(`Bir Studio projesinde en fazla ${MAX_STUDIO_SCENES} sahne kullanılabilir.`);
      return;
    }
    const copy: StudioScene = { ...activeScene, id: sceneId(), name: `${activeScene.name} kopyası`, layers: (activeScene.layers || []).map((layer) => ({ ...layer, id: sourceLayerId() })), createdAt: Date.now() };
    if (previewRunningRef.current || streamRef.current) closePreview();
    const index = scenes.findIndex((scene) => scene.id === activeScene.id);
    const next = [...scenes];
    next.splice(index + 1, 0, copy);
    persistScenes(next);
    setActiveSceneId(copy.id);
    localStorage.setItem(ACTIVE_SCENE_KEY, copy.id);
    setMessage(`“${activeScene.name}” çoğaltıldı.`);
  }

  function removeScene() {
    if (scenes.length <= 1 || recording || streaming || virtualCamera.running) {
      setMessage(scenes.length <= 1 ? "Studio projesinde en az bir sahne kalmalıdır." : "Etkin kayıt, yayın veya sanal kamera sırasında sahne silinemez.");
      return;
    }
    if (previewRunningRef.current || streamRef.current) closePreview();
    const next = scenes.filter((scene) => scene.id !== activeScene.id);
    persistScenes(next);
    setActiveSceneId(next[0].id);
    localStorage.setItem(ACTIVE_SCENE_KEY, next[0].id);
    if (programScene.id === activeScene.id) {
      setProgramSceneId(next[0].id);
      localStorage.setItem(PROGRAM_SCENE_KEY, next[0].id);
    }
    setMessage(`“${activeScene.name}” sahnesi silindi.`);
  }

  async function selectScene(scene: StudioScene) {
    if (previewRunningRef.current && native) {
      try {
        await window.playStreamersNative!.setPreviewScene(scene.id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
        return;
      }
    }
    setActiveSceneId(scene.id);
    localStorage.setItem(ACTIVE_SCENE_KEY, scene.id);
    setMessage(scene.kind === "slate" ? `“${scene.name}” Önizleme'de: Programa alındığında görüntüyü güvenli biçimde gizler.` : `“${scene.name}” Önizleme'ye alındı; Program değişmedi.`);
  }

  async function takePreviewToProgram() {
    if (busy || activeScene.id === programScene.id) return;
    setBusy(true);
    try {
      if (native && (recording || streaming || virtualCamera.running)) {
        await window.playStreamersNative!.switchScene(activeScene.id, settings.transitionMode, settings.transitionDurationMs);
      }
      setProgramSceneId(activeScene.id);
      localStorage.setItem(PROGRAM_SCENE_KEY, activeScene.id);
      const transition = transitionCopy(settings.transitionMode, settings.transitionDurationMs);
      setMessage(`“${activeScene.name}” Programa alındı · ${transition}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
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
          <div><span className="eyebrow">STUDIO MODE</span><h2>Önizleme ve Program</h2></div>
          <div className="studio-heading-actions"><button type="button" className={`canvas-edit-toggle ${canvasEditing ? "active" : ""}`} disabled={recording || streaming || virtualCamera.running} onClick={() => setCanvasEditing((value) => !value)}>{canvasEditing ? "Tuval düzenleme açık" : "Tuvalde düzenle"}</button><div className={`studio-health ${health.tone}`}><span className={`status-dot ${native ? "online" : ""}`} /> {health.label}</div></div>
        </div>
        <div className="studio-bus-strip">
          <div className="studio-bus preview"><span>ÖNİZLEME</span><strong>{activeScene.name}</strong><small>Hazırlık alanı</small></div>
          <button type="button" className="take-button" onClick={() => void takePreviewToProgram()} disabled={busy || activeScene.id === programScene.id}>
            <span>{transitionCopy(settings.transitionMode, settings.transitionDurationMs, true)}</span>
            <strong>{activeScene.id === programScene.id ? "Program güncel" : "Programa al →"}</strong>
          </button>
          <div className="studio-bus program"><span>PROGRAM</span><strong>{programScene.name}</strong><small>{recording || streaming || virtualCamera.running ? "Canlı çıkış" : "Başlangıç sahnesi"}</small></div>
        </div>
        <div ref={canvasRef} className={`studio-canvas ${canvasEditing ? "editing" : ""}`} onPointerMove={(event) => { if (dragLayerId) moveLayerOnCanvas(dragLayerId, event.clientX, event.clientY); }} onPointerUp={finishCanvasDrag} onPointerCancel={finishCanvasDrag}>
          <video ref={previewRef} autoPlay muted playsInline hidden={nativePreviewRunning} />
          {nativePreviewRunning && nativePreviewFrame && <img className="native-program-preview" src={nativePreviewFrame} alt={`${activeScene.name} bağımsız önizlemesi`} />}
          {!streamRef.current && !nativePreviewRunning && activeScene.kind === "capture" && <div className="canvas-empty"><span>PS</span><strong>{activeScene.name}</strong><small>Bu görüntü Program'a gönderilmeden hazırlanır</small><button className="secondary-button preview-button" onClick={() => void openPreview(false)}>Önizlemeyi aç</button></div>}
          {!streamRef.current && !nativePreviewRunning && activeScene.kind === "slate" && <div className="canvas-empty break"><span>PS</span><strong>{activeScene.name}</strong><small>Programa alındığında canlı görüntüyü gizler</small><button className="secondary-button preview-button" onClick={() => void openPreview(false)}>Önizlemeyi aç</button></div>}
          {canvasEditing && activeScene.kind === "capture" && (activeScene.layers || []).filter((layer) => layer.visible).map((layer) => <button
            type="button"
            key={layer.id}
            className={`canvas-layer-handle ${selectedLayerId === layer.id ? "selected" : ""}`}
            style={{ left: `${layer.x ?? 50}%`, top: `${layer.y ?? 50}%`, width: layer.kind === "color" ? `${Math.max(5, layer.width ?? 30)}%` : `${Math.max(8, layer.scale ?? 30)}%`, aspectRatio: layer.kind === "color" ? `${Math.max(2, layer.width ?? 30)} / ${Math.max(2, layer.height ?? 20)}` : "16 / 5" }}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayerId(layer.id); setDragLayerId(layer.id); moveLayerOnCanvas(layer.id, event.clientX, event.clientY); }}
            aria-label={`${layer.name} kaynağını tuvalde taşı`}
          ><span>{layer.name}</span></button>)}
          {(recording || streaming) && <div className={`recording-chip ${streaming ? "live" : ""}`}><i /> {streaming ? "LIVE" : "REC"} {formatDuration(elapsed)}</div>}
        </div>
        <div className="studio-message" title={message}>{message}</div>
      </section>

      <aside className="studio-side-panel">
        <div className="panel-heading compact"><div><span className="eyebrow">SAHNELER</span><h3>Yayın düzeni · {scenes.length}/{MAX_STUDIO_SCENES}</h3></div><button className="icon-button" aria-label="Sahne ekle" onClick={addScene} disabled={recording || streaming || virtualCamera.running}>+</button></div>
        <div className="scene-list">{scenes.map((scene) => <button key={scene.id} className={`scene-row ${activeScene.id === scene.id ? "active" : ""} ${programScene.id === scene.id ? "on-program" : ""}`} onClick={() => void selectScene(scene)}><span className={`scene-preview ${scene.kind === "slate" ? "muted" : ""}`}>{scene.kind === "slate" ? "•••" : "PS"}</span><span><strong>{scene.name}</strong><small>{scene.kind === "slate" ? "Gizli ekran sahnesi" : scene.sourceKind === "window" ? "Pencere yakalama" : scene.sourceKind === "camera" ? "Kamera yakalama" : "Masaüstü yakalama"}</small><span className="scene-bus-badges">{activeScene.id === scene.id && <b className="preview">ÖNİZLEME</b>}{programScene.id === scene.id && <b className="program">PROGRAM</b>}</span></span></button>)}</div>
        <div className="scene-actions"><button type="button" onClick={() => setSettingsOpen(true)}>Düzenle</button><button type="button" onClick={duplicateScene} disabled={recording || streaming || virtualCamera.running}>Çoğalt</button><button type="button" className="danger" onClick={removeScene} disabled={scenes.length <= 1 || recording || streaming || virtualCamera.running}>Sil</button></div>
        <div className="studio-divider" />
        <div className="panel-heading compact"><div><span className="eyebrow">SESLER</span><h3>Mikser</h3></div></div>
        <MixerRow label={settings.captureSystemAudio ? "Masaüstü sesi" : "Masaüstü sesi kapalı"} level={settings.captureSystemAudio ? settings.systemAudioVolume : 0} meterLevel={recording || streaming ? engine.systemAudioLevel || 0 : 0} disabled={!settings.captureSystemAudio} onLevel={(level) => void updateMixer("systemAudioVolume", level)} />
        <MixerRow label={settings.audioDevice || "Mikrofon seçilmedi"} level={settings.audioDevice ? settings.microphoneVolume : 0} meterLevel={recording || streaming ? engine.microphoneAudioLevel || 0 : 0} disabled={!settings.audioDevice} onLevel={(level) => void updateMixer("microphoneVolume", level)} />
        {native && <div className={`virtual-camera-card ${virtualCamera.running ? "active" : ""} ${!virtualCamera.supported ? "unsupported" : ""}`}>
          <div><span>SANAL KAMERA · WINDOWS 11</span><strong>{virtualCamera.label}</strong><small>{virtualCamera.message}</small></div>
          <button type="button" onClick={() => void toggleVirtualCamera()} disabled={busy || !virtualCamera.supported}>
            {!virtualCamera.supported ? "Desteklenmiyor" : !virtualCamera.installed ? "Bir kez kur" : virtualCamera.running ? "Kamerayı kapat" : "Kamerayı aç"}
          </button>
        </div>}
        <div className="engine-card"><span>YAYIN MOTORU</span><strong>{encoderLabel}</strong><small>{recording || streaming ? `${(engine.fps || 0).toFixed(1)} FPS · ${Math.round(engine.bitrateKbps || 0)} kbps · CPU %${(engine.cpuPercent || 0).toFixed(1)} · ${(engine.speed || 0).toFixed(2)}× · ${engine.droppedFrames || 0} düşen kare${engine.reconnectAttempts ? ` · ${engine.reconnectAttempts} yeniden bağlanma` : ""}` : native ? "Gerçek telemetri oturum başladığında görünür" : "Yerel paket bekleniyor"}</small></div>
        {streaming && liveContext && <div className={`live-insight-card ${liveContext.insight.direction}`}><span>DOĞRULANMIŞ CANLI VERİ</span><strong>{liveContext.insight.title}</strong><small>{liveContext.metrics.activeViewers} izleyici · {liveContext.metrics.interactions} etkileşim · +{liveContext.metrics.followersGained} takipçi</small><p>{liveContext.insight.nextAction}</p></div>}
        {native && <button className="recordings-folder" onClick={() => void window.playStreamersNative!.openRecordingsFolder().catch(() => setMessage("Kayıt klasörü açılamadı."))}>Kayıt klasörünü aç</button>}
        {native && lastRecordingPath && !recording && !streaming && <button className="recordings-folder" onClick={() => void convertLastRecording()} disabled={busy}>Son kaydı MP4 yap</button>}
        <small className="studio-shortcuts">Genel kısayollar<br />Ctrl + Alt + R · Kayıt<br />Ctrl + Alt + L · Yayın<br />Ctrl + Alt + B · Replay kaydet</small>
      </aside>

      <footer className="studio-controls">
        <div className="quality-summary"><strong>{qualityLabel}</strong><span>{encoderLabel}</span></div>
        <div className="studio-actions">
          {onOpenTransitionLab && <button className="secondary-button" onClick={onOpenTransitionLab}>Geçiş laboratuvarı</button>}
          <button className="secondary-button" onClick={() => { setDraft(settings); setSettingsOpen(true); }} disabled={recording || streaming}>Yayın ayarları</button>
          {(recording || streaming) && <button className="secondary-button" onClick={markClip}>Anı işaretle</button>}
          {settings.replayBufferEnabled && (recording || streaming || engine.replayBufferReady) && <button className="secondary-button" onClick={() => void saveReplayBuffer()} disabled={busy || !engine.replayBufferReady}>Son {settings.replayBufferSeconds} saniyeyi kaydet</button>}
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
              <div className="scene-settings-heading span-two"><span>ÇOKLU YAYIN ÇIKIŞI</span><strong>Tek kodlama · iki güvenli RTMPS hedefi</strong><small>İkinci platform aynı görüntü ve ses akışını yeniden kodlamadan alır.</small></div>
              <label className="span-two layer-toggle"><input type="checkbox" checked={draft.secondaryOutputEnabled} onChange={(event) => setDraft({ ...draft, secondaryOutputEnabled: event.target.checked })} /><span>İkinci yayın çıkışını etkinleştir</span></label>
              {draft.secondaryOutputEnabled && <>
                <label><span>İkinci platform adı</span><input value={draft.secondaryService} maxLength={40} onChange={(event) => setDraft({ ...draft, secondaryService: event.target.value })} placeholder="Örn. YouTube" /></label>
                <label><span>İkinci RTMPS adresi</span><input value={draft.secondaryIngestUrl} onChange={(event) => setDraft({ ...draft, secondaryIngestUrl: event.target.value })} placeholder="rtmps://ikinci-sunucu/app" autoComplete="off" /></label>
                <label className="span-two"><span>İkinci yayın anahtarı</span><input type="password" value={secondaryStreamKey} onChange={(event) => setSecondaryStreamKey(event.target.value)} placeholder={hasSecondaryStreamKey ? "Güvenli kasada kayıtlı · değiştirmek için yaz" : "İkinci yayın anahtarını gir"} autoComplete="new-password" /></label>
              </>}
              <label><span>Çözünürlük</span><select value={`${draft.width}x${draft.height}`} onChange={(event) => { const [width, height] = event.target.value.split("x").map(Number); setDraft({ ...draft, width, height }); }}><option value="1280x720">1280 × 720</option><option value="1920x1080">1920 × 1080</option><option value="2560x1440">2560 × 1440</option></select></label>
              <label><span>Kare hızı</span><select value={draft.framerate} onChange={(event) => setDraft({ ...draft, framerate: Number(event.target.value) })}><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
              <label><span>Sahne geçişi</span><select value={draft.transitionMode} onChange={(event) => setDraft({ ...draft, transitionMode: event.target.value as StudioSettings["transitionMode"] })}><option value="cut">Anında kes</option><option value="crossfade">Sahneler arası yumuşak geçiş</option><option value="fade">Siyaha karararak geç</option></select></label>
              <label><span>Geçiş süresi</span><select value={draft.transitionDurationMs} disabled={draft.transitionMode === "cut"} onChange={(event) => setDraft({ ...draft, transitionDurationMs: Number(event.target.value) })}><option value={150}>150 ms</option><option value={300}>300 ms</option><option value={500}>500 ms</option><option value={800}>800 ms</option></select></label>
              <label><span>Replay buffer süresi</span><select value={draft.replayBufferSeconds} disabled={!draft.replayBufferEnabled} onChange={(event) => setDraft({ ...draft, replayBufferSeconds: Number(event.target.value) })}><option value={15}>15 saniye</option><option value={30}>30 saniye</option><option value={60}>60 saniye</option><option value={120}>120 saniye</option></select></label>
              <label><span>Video bit hızı</span><input type="number" min={1000} max={50000} step={500} value={draft.bitrateKbps} onChange={(event) => setDraft({ ...draft, bitrateKbps: Number(event.target.value) })} /></label>
              <label><span>Ses girişi</span><select value={draft.audioDevice} onChange={(event) => setDraft({ ...draft, audioDevice: event.target.value })}><option value="">Sessiz kanal</option>{audioDevices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
              <div className="scene-settings-heading span-two"><span>ETKİN SAHNE</span><strong>{activeScene.name}</strong><small>Bu alan yalnız seçili sahnenin kaynaklarını değiştirir.</small></div>
              <label><span>Sahne adı</span><input value={activeScene.name} maxLength={48} onChange={(event) => updateActiveScene({ name: event.target.value.slice(0, 48) })} /></label>
              <label><span>Sahne türü</span><select value={activeScene.kind} onChange={(event) => updateActiveScene({ kind: event.target.value as StudioScene["kind"] })}><option value="capture">Görüntü sahnesi</option><option value="slate">Gizli / mola sahnesi</option></select></label>
              {activeScene.kind === "capture" && <label><span>Ana görüntü kaynağı</span><select value={activeScene.sourceKind} onChange={(event) => updateActiveScene({ sourceKind: event.target.value as StudioScene["sourceKind"], sourceId: undefined })}><option value="desktop">Tüm ekran</option><option value="window">Uygulama / tarayıcı penceresi</option><option value="camera">Kamera</option></select></label>}
              {activeScene.kind === "capture" && activeScene.sourceKind === "window" && <label className="span-two"><span>Yakalanacak pencere</span><select value={activeScene.sourceId || ""} onChange={(event) => updateActiveScene({ sourceId: event.target.value || undefined })}><option value="">Pencere seç</option>{captureWindows.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>}
              {activeScene.kind === "capture" && activeScene.sourceKind === "camera" && <label className="span-two"><span>Kamera</span><select value={activeScene.sourceId || ""} onChange={(event) => updateActiveScene({ sourceId: event.target.value || undefined })}><option value="">Kamera seç</option>{videoDevices.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}</select></label>}
              {activeScene.kind === "capture" && <div className="scene-layer-editor span-two"><div className="layer-title"><span>ANA KAYNAK DÖNÜŞÜMÜ</span><small>Kaynağı kırp, tuval içinde ölçekle ve konumlandır.</small></div><div className="layer-range-grid"><label><span>Boyut · %{activeScene.sourceScale ?? 100}</span><input type="range" min={10} max={100} value={activeScene.sourceScale ?? 100} onChange={(event) => updateActiveScene({ sourceScale: Number(event.target.value) })} /></label><label><span>Yatay · %{activeScene.sourceX ?? 50}</span><input type="range" min={0} max={100} value={activeScene.sourceX ?? 50} onChange={(event) => updateActiveScene({ sourceX: Number(event.target.value) })} /></label><label><span>Dikey · %{activeScene.sourceY ?? 50}</span><input type="range" min={0} max={100} value={activeScene.sourceY ?? 50} onChange={(event) => updateActiveScene({ sourceY: Number(event.target.value) })} /></label><label><span>Soldan kırp · %{activeScene.sourceCropLeft ?? 0}</span><input type="range" min={0} max={45} value={activeScene.sourceCropLeft ?? 0} onChange={(event) => updateActiveScene({ sourceCropLeft: Number(event.target.value) })} /></label><label><span>Sağdan kırp · %{activeScene.sourceCropRight ?? 0}</span><input type="range" min={0} max={45} value={activeScene.sourceCropRight ?? 0} onChange={(event) => updateActiveScene({ sourceCropRight: Number(event.target.value) })} /></label><label><span>Üstten kırp · %{activeScene.sourceCropTop ?? 0}</span><input type="range" min={0} max={45} value={activeScene.sourceCropTop ?? 0} onChange={(event) => updateActiveScene({ sourceCropTop: Number(event.target.value) })} /></label><label><span>Alttan kırp · %{activeScene.sourceCropBottom ?? 0}</span><input type="range" min={0} max={45} value={activeScene.sourceCropBottom ?? 0} onChange={(event) => updateActiveScene({ sourceCropBottom: Number(event.target.value) })} /></label></div></div>}
              {activeScene.kind === "capture" && <section className="source-stack span-two" aria-label="Sahne kaynakları">
                <div className="source-stack-heading"><div><span>EK KAYNAKLAR · {(activeScene.layers || []).length}/{MAX_SCENE_LAYERS} {liveGraphRunning && <b className="source-live-badge">CANLI DENETİM</b>}</span><small>Alttan üste sıralanır; görünürlük ve opaklık çalışan Program, önizleme ve sanal kameraya anında uygulanır.</small></div><div><button type="button" onClick={() => addSourceLayer("text")}>+ Yazı</button><button type="button" onClick={() => addSourceLayer("image")}>+ Görsel</button><button type="button" onClick={() => addSourceLayer("media")}>+ Medya</button><button type="button" onClick={() => addSourceLayer("color")}>+ Renk</button></div></div>
                {(activeScene.layers || []).length === 0 && <p className="source-stack-empty">Bu sahnede ek kaynak yok. Ana görüntü kaynağı tek başına kullanılacak.</p>}
                {(activeScene.layers || []).map((layer, index, layers) => <article className="source-layer-card" key={layer.id}>
                  <header><label className="layer-toggle"><input type="checkbox" checked={layer.visible} onChange={(event) => void toggleSourceLayer(layer, event.target.checked)} /><span>{layer.kind === "text" ? "YAZI" : layer.kind === "image" ? "GÖRSEL" : layer.kind === "media" ? "YEREL MEDYA" : "RENK ALANI"}</span></label><input className="source-layer-name" value={layer.name} maxLength={40} aria-label="Kaynak adı" onChange={(event) => updateSourceLayer(layer.id, { name: event.target.value })} /><div className="source-layer-actions"><button type="button" aria-label={`${layer.name} kaynağını alta taşı`} disabled={index === 0} onClick={() => moveSourceLayer(layer.id, -1)}>↓</button><button type="button" aria-label={`${layer.name} kaynağını üste taşı`} disabled={index === layers.length - 1} onClick={() => moveSourceLayer(layer.id, 1)}>↑</button><button type="button" className="danger" aria-label={`${layer.name} kaynağını sil`} onClick={() => removeSourceLayer(layer.id)}>×</button></div></header>
                  {layer.kind === "text" && <input value={layer.text || ""} maxLength={300} onChange={(event) => updateSourceLayer(layer.id, { text: event.target.value })} placeholder="Yayında gösterilecek yazı" />}
                  {(layer.kind === "image" || layer.kind === "media") && <input value={layer.path || ""} onChange={(event) => updateSourceLayer(layer.id, { path: event.target.value })} placeholder={layer.kind === "image" ? "C:\\Görseller\\logo.png" : "C:\\Videolar\\döngü.mp4"} />}
                  {layer.kind === "color" && <label className="source-color-field"><span>Renk</span><input type="color" value={layer.color || "#53fc18"} onChange={(event) => updateSourceLayer(layer.id, { color: event.target.value })} /></label>}
                  <div className="layer-range-grid">
                    {(layer.kind === "text" || layer.kind === "image" || layer.kind === "media") && <label><span>Boyut · %{layer.scale}</span><input type="range" min={layer.kind === "text" ? 12 : 5} max={layer.kind === "text" ? 96 : 100} value={layer.scale} onChange={(event) => updateSourceLayer(layer.id, { scale: Number(event.target.value) })} /></label>}
                    {layer.kind === "color" && <><label><span>Genişlik · %{layer.width}</span><input type="range" min={2} max={100} value={layer.width} onChange={(event) => updateSourceLayer(layer.id, { width: Number(event.target.value) })} /></label><label><span>Yükseklik · %{layer.height}</span><input type="range" min={2} max={100} value={layer.height} onChange={(event) => updateSourceLayer(layer.id, { height: Number(event.target.value) })} /></label></>}
                    <label><span>Yatay · %{layer.x}</span><input type="range" min={0} max={100} value={layer.x} onChange={(event) => updateSourceLayer(layer.id, { x: Number(event.target.value) })} /></label><label><span>Dikey · %{layer.y}</span><input type="range" min={0} max={100} value={layer.y} onChange={(event) => updateSourceLayer(layer.id, { y: Number(event.target.value) })} /></label><label><span>Opaklık · %{layer.opacity}</span><input type="range" min={0} max={100} value={layer.opacity} onChange={(event) => updateSourceLayer(layer.id, { opacity: Number(event.target.value) })} onPointerUp={(event) => void commitSourceOpacity(layer.id, Number(event.currentTarget.value))} onKeyUp={(event) => void commitSourceOpacity(layer.id, Number(event.currentTarget.value))} /></label>
                  </div>
                </article>)}
              </section>}
            </div>
            <div className="settings-checks">
              <label><input type="checkbox" checked={draft.recordLocally} onChange={(event) => setDraft({ ...draft, recordLocally: event.target.checked })} /> Yayınla birlikte güvenli MKV kaydı al</label>
              <label><input type="checkbox" checked={draft.replayBufferEnabled} onChange={(event) => setDraft({ ...draft, replayBufferEnabled: event.target.checked })} /> Yayın veya kayıt sırasında son anları replay buffer’da tut</label>
              <label><input type="checkbox" checked={draft.captureSystemAudio} onChange={(event) => setDraft({ ...draft, captureSystemAudio: event.target.checked })} /> Windows masaüstü sesini kaydet</label>
              <label><input type="checkbox" checked={draft.drawCursor} onChange={(event) => setDraft({ ...draft, drawCursor: event.target.checked })} /> Fare imlecini göster</label>
              <label><input type="checkbox" checked={draft.multitrackAudio} onChange={(event) => setDraft({ ...draft, multitrackAudio: event.target.checked })} /> Normal kayıtta yayın miksiyle birlikte mikrofon ve masaüstü sesini ayrı kanallarda tut</label>
              <label><input type="checkbox" checked={draft.noiseSuppression} onChange={(event) => setDraft({ ...draft, noiseSuppression: event.target.checked })} /> Mikrofon gürültüsünü azalt</label>
              <label><input type="checkbox" checked={draft.microphoneNoiseGate} onChange={(event) => setDraft({ ...draft, microphoneNoiseGate: event.target.checked })} /> Konuşma dışındaki düşük mikrofon seslerini kapat</label>
              <label><input type="checkbox" checked={draft.microphoneCompressor} onChange={(event) => setDraft({ ...draft, microphoneCompressor: event.target.checked })} /> Mikrofon sesini dengele</label>
              <label><input type="checkbox" checked={draft.microphoneLimiter} onChange={(event) => setDraft({ ...draft, microphoneLimiter: event.target.checked })} /> Ani ses patlamalarını sınırla</label>
            </div>
            <section className="studio-profiles">
              <div><strong>Studio profilleri</strong><small>Oyun, sohbet veya kayıt düzenlerini ayrı sakla.</small></div>
              <div className="profile-create"><input value={profileName} maxLength={40} onChange={(event) => setProfileName(event.target.value)} placeholder="Örn. Oyun yayını" /><button type="button" onClick={saveProfile}>Profili kaydet</button></div>
              <div className="profile-list">{profiles.map((profile) => <article key={profile.id}><button type="button" onClick={() => loadProfile(profile)}><strong>{profile.name}</strong><small>{new Date(profile.createdAt).toLocaleDateString("tr-TR")} · {profile.settings.height}p/{profile.settings.framerate} · {profile.scenes?.length || 1} sahne</small></button><button type="button" aria-label={`${profile.name} profilini sil`} onClick={() => removeProfile(profile.id)}>×</button></article>)}</div>
            </section>
            <div className="settings-security"><strong>Yayın anahtarın uygulama ayarlarına yazılmaz.</strong><span>Windows Kimlik Bilgileri Yöneticisi’nde şifreli olarak tutulur.</span></div>
            <div className="modal-actions"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>Vazgeç</button><button className="primary-button" onClick={() => void saveSettings()}>Güvenle kaydet</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function MixerRow({ label, level, meterLevel, disabled, onLevel }: { label: string; level: number; meterLevel: number; disabled: boolean; onLevel: (level: number) => void }) {
  return <div className="mixer-row"><div><strong title={label}>{label}</strong><button aria-label={`${label} sesini aç veya kapat`} disabled={disabled} onClick={() => onLevel(level > 0 ? 0 : 100)}>{level > 0 ? "⌁" : "×"}</button></div><div className="meter"><span style={{ width: `${Math.min(100, meterLevel)}%` }} /></div><input aria-label={`${label} ses düzeyi`} type="range" min="0" max="150" value={level} disabled={disabled} onChange={(event) => onLevel(Number(event.target.value))} /></div>;
}
