export type EngineState = "unavailable" | "idle" | "recording" | "streaming" | "recording-and-streaming";

export interface StudioEngineStatus {
  state: EngineState;
  backend: "native" | "browser-preview";
  encoder?: string;
  droppedFrames?: number;
  cpuPercent?: number;
  gpuPercent?: number;
  elapsedSeconds?: number;
  outputPath?: string;
  lastError?: string;
  activeScene?: "desktop" | "slate";
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
  drawCursor: boolean;
  sourceKind: "desktop" | "window" | "camera";
  sourceId?: string;
  overlayText?: string;
  overlayImagePath?: string;
  multitrackAudio: boolean;
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
  startStreaming(options: StudioCaptureOptions & { service: string; ingestUrl: string; streamKeyRef: string; recordLocally: boolean }): Promise<void>;
  stopStreaming(): Promise<void>;
  getVirtualCameraStatus(): Promise<VirtualCameraStatus>;
  installVirtualCamera(): Promise<void>;
  startVirtualCamera(options: StudioCaptureOptions): Promise<void>;
  stopVirtualCamera(): Promise<void>;
  switchScene(scene: "desktop" | "slate"): Promise<void>;
  setAudioVolume(channel: "system" | "microphone", level: number): Promise<void>;
  openExternal(url: string): Promise<void>;
  secureStore(key: string, value: string): Promise<void>;
  secureRead(key: string): Promise<string | null>;
  onOpenUrl(handler: (url: string) => void): () => void;
  onStudioShortcut(handler: (action: "record" | "stream") => void): () => void;
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
