export type EngineState = "unavailable" | "idle" | "recording" | "streaming" | "recording-and-streaming";

export interface StudioEngineStatus {
  state: EngineState;
  backend: "native" | "browser-preview";
  encoder?: string;
  droppedFrames?: number;
  encodedFrames?: number;
  totalBytes?: number;
  fps?: number;
  bitrateKbps?: number;
  speed?: number;
  systemAudioLevel?: number;
  microphoneAudioLevel?: number;
  reconnectAttempts?: number;
  cpuPercent?: number;
  gpuPercent?: number;
  elapsedSeconds?: number;
  outputPath?: string;
  lastError?: string;
  activeScene?: string;
  previewScene?: string;
  replayBufferEnabled?: boolean;
  replayBufferSeconds?: number;
  replayBufferReady?: boolean;
}

export interface StudioSceneDefinition {
  id: string;
  name: string;
  kind: "capture" | "slate";
  sourceKind: "desktop" | "window" | "camera";
  sourceId?: string;
  overlayText?: string;
  overlayImagePath?: string;
  sourceScale?: number;
  sourceX?: number;
  sourceY?: number;
  sourceCropLeft?: number;
  sourceCropRight?: number;
  sourceCropTop?: number;
  sourceCropBottom?: number;
  overlayTextVisible?: boolean;
  overlayTextX?: number;
  overlayTextY?: number;
  overlayImageVisible?: boolean;
  overlayImageScale?: number;
  overlayImageX?: number;
  overlayImageY?: number;
  layers?: StudioSourceLayer[];
}

export type StudioSourceLayerKind = "text" | "image" | "media" | "color";

export interface StudioSourceLayer {
  id: string;
  name: string;
  kind: StudioSourceLayerKind;
  visible: boolean;
  text?: string;
  path?: string;
  color?: string;
  scale?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
}

export interface StudioCaptureOptions {
  path?: string;
  framerate: number;
  width: number;
  height: number;
  bitrateKbps: number;
  audioDevice?: string;
  captureSystemAudio: boolean;
  systemAudioVolume: number;
  microphoneVolume: number;
  captureMode: "desktop" | "slate";
  activeSceneId?: string;
  scenes?: StudioSceneDefinition[];
  drawCursor: boolean;
  sourceKind: "desktop" | "window" | "camera";
  sourceId?: string;
  overlayText?: string;
  overlayImagePath?: string;
  multitrackAudio: boolean;
  noiseSuppression: boolean;
  microphoneCompressor: boolean;
  microphoneLimiter: boolean;
  microphoneNoiseGate: boolean;
  replayBufferEnabled: boolean;
  replayBufferSeconds: number;
}

export interface StudioStreamTarget {
  service: string;
  ingestUrl: string;
  streamKeyRef: string;
}

export interface StudioAudioDevice {
  id: string;
  label: string;
}

export interface StudioCaptureSource {
  id: string;
  label: string;
}

export interface VirtualCameraStatus {
  supported: boolean;
  installed: boolean;
  running: boolean;
  label: string;
  message: string;
}

export interface PlayStreamersNativeBridge {
  getEngineStatus(): Promise<StudioEngineStatus>;
  listAudioDevices(): Promise<StudioAudioDevice[]>;
  listVideoDevices(): Promise<StudioCaptureSource[]>;
  listCaptureWindows(): Promise<StudioCaptureSource[]>;
  openRecordingsFolder(): Promise<void>;
  remuxRecording(inputPath: string): Promise<string>;
  startRecording(options: StudioCaptureOptions): Promise<void>;
  stopRecording(): Promise<{ path?: string }>;
  startStreaming(options: StudioCaptureOptions & { service: string; ingestUrl: string; streamKeyRef: string; additionalTargets?: StudioStreamTarget[]; recordLocally: boolean }): Promise<void>;
  stopStreaming(): Promise<void>;
  saveReplayBuffer(): Promise<string>;
  startStudioPreview(options: StudioCaptureOptions): Promise<void>;
  readStudioPreviewFrame(): Promise<string | null>;
  stopStudioPreview(): Promise<void>;
  getVirtualCameraStatus(): Promise<VirtualCameraStatus>;
  installVirtualCamera(): Promise<void>;
  startVirtualCamera(options: StudioCaptureOptions): Promise<void>;
  stopVirtualCamera(): Promise<void>;
  switchScene(scene: string, transition?: "cut" | "fade" | "crossfade", durationMs?: number): Promise<void>;
  setPreviewScene(scene: string): Promise<void>;
  setAudioVolume(channel: "system" | "microphone", level: number): Promise<void>;
  setSourceOpacity(scene: string, source: string, level: number): Promise<void>;
  openExternal(url: string): Promise<void>;
  secureStore(key: string, value: string): Promise<void>;
  secureRead(key: string): Promise<string | null>;
  onOpenUrl(handler: (url: string) => void): () => void;
  onStudioShortcut(handler: (action: "record" | "stream" | "replay") => void): () => void;
}

declare global {
  interface Window {
    playStreamersNative?: PlayStreamersNativeBridge;
  }
}

export function hasNativeBridge() {
  return Boolean(window.playStreamersNative);
}

export async function openExternal(url: string) {
  if (window.playStreamersNative) {
    await window.playStreamersNative.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function readEngineStatus(): Promise<StudioEngineStatus> {
  if (window.playStreamersNative) return window.playStreamersNative.getEngineStatus();
  return { state: "idle", backend: "browser-preview" };
}
