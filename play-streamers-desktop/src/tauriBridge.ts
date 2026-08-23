import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { listen } from "@tauri-apps/api/event";
import type { PlayStreamersNativeBridge, StudioAudioDevice, StudioCaptureSource, StudioEngineStatus, VirtualCameraStatus } from "./nativeBridge";

export async function installTauriBridge() {
  if (!isTauri()) return;
  const bridge: PlayStreamersNativeBridge = {
    getEngineStatus: () => invoke<StudioEngineStatus>("get_engine_status"),
    listAudioDevices: () => invoke<StudioAudioDevice[]>("list_audio_devices"),
    listVideoDevices: () => invoke<StudioCaptureSource[]>("list_video_devices"),
    listCaptureWindows: () => invoke<StudioCaptureSource[]>("list_capture_windows"),
    openRecordingsFolder: async () => openPath(await invoke<string>("get_recordings_directory")),
    remuxRecording: (inputPath) => invoke<string>("remux_recording", { inputPath }),
    startRecording: (options) => invoke<void>("start_recording", { options }),
    stopRecording: () => invoke<{ path: string }>("stop_recording"),
    startStreaming: (options) => invoke<void>("start_streaming", { options }),
    stopStreaming: () => invoke<void>("stop_streaming"),
    saveReplayBuffer: () => invoke<string>("save_replay_buffer"),
    startStudioPreview: (options) => invoke<void>("start_studio_preview", { options }),
    readStudioPreviewFrame: () => invoke<string | null>("read_studio_preview_frame"),
    stopStudioPreview: () => invoke<void>("stop_studio_preview"),
    getVirtualCameraStatus: () => invoke<VirtualCameraStatus>("get_virtual_camera_status"),
    installVirtualCamera: () => invoke<void>("install_virtual_camera"),
    startVirtualCamera: (options) => invoke<void>("start_virtual_camera", { options }),
    stopVirtualCamera: () => invoke<void>("stop_virtual_camera"),
    switchScene: (scene, transition, durationMs) => invoke<void>("switch_scene", { scene, transition, durationMs }),
    setPreviewScene: (scene) => invoke<void>("set_preview_scene", { scene }),
    setAudioVolume: (channel, level) => invoke<void>("set_audio_volume", { channel, level }),
    setSourceOpacity: (scene, source, level) => invoke<void>("set_source_opacity", { scene, source, level }),
    openExternal: (url) => openUrl(url),
    secureStore: (key, value) => invoke<void>("secure_store", { key, value }),
    secureRead: (key) => invoke<string | null>("secure_read", { key }),
    onOpenUrl(handler) {
      let disposed = false;
      let unlisten: (() => void) | null = null;
      void getCurrent().then((urls) => {
        if (!disposed) urls?.forEach(handler);
      });
      void onOpenUrl((urls) => {
        if (!disposed) urls.forEach(handler);
      }).then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
      return () => {
        disposed = true;
        unlisten?.();
      };
    },
    onStudioShortcut(handler) {
      let disposed = false;
      let unlisten: (() => void) | null = null;
      void listen<string>("studio-global-shortcut", (event) => {
        if (!disposed && (event.payload === "record" || event.payload === "stream" || event.payload === "replay")) handler(event.payload);
      }).then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      });
      return () => { disposed = true; unlisten?.(); };
    },
  };
  window.playStreamersNative = bridge;
}
