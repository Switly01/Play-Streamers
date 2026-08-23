import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { PlayStreamersNativeBridge } from "./nativeBridge";

export async function installTauriBridge() {
  if (!isTauri()) return;
  const bridge: PlayStreamersNativeBridge = {
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
  };
  window.playStreamersNative = bridge;
}
