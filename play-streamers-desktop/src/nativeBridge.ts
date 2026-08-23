export interface PlayStreamersNativeBridge {
  openExternal(url: string): Promise<void>;
  secureStore(key: string, value: string): Promise<void>;
  secureRead(key: string): Promise<string | null>;
  onOpenUrl(handler: (url: string) => void): () => void;
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
