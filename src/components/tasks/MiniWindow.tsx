"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Document Picture-in-Picture (Chrome and Edge 116+): a small always-on-top window. */
interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

function getPipApi(): DocumentPictureInPicture | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture ?? null;
}

const noSubscribe = () => () => {};

/** True when this browser can open the mini window (false on the server and on Firefox, Safari, phones). */
export function useMiniWindowSupported(): boolean {
  return useSyncExternalStore(noSubscribe, () => getPipApi() !== null, () => false);
}

/** Copy the page's styles into the mini window so it looks like the app. */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement("style");
      style.textContent = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

/** Piste 4 — opens, tracks and closes the mini window; `content` is rendered inside it. */
export function useMiniWindow() {
  const [pip, setPip] = useState<Window | null>(null);

  const open = useCallback(async () => {
    const api = getPipApi();
    if (!api) return;
    const win = await api.requestWindow({ width: 340, height: 460 });
    copyStyles(win.document);
    win.document.title = "Dispatch · Mes tâches";
    win.document.body.className = `${document.body.className} bg-background text-foreground`;
    win.addEventListener("pagehide", () => setPip(null), { once: true });
    setPip(win);
  }, []);

  const close = useCallback(() => {
    pip?.close();
    setPip(null);
  }, [pip]);

  // Closing « Mes tâches » (another screen, other profile) closes the mini window too.
  useEffect(() => () => pip?.close(), [pip]);

  const render = useCallback((content: ReactNode) => (pip ? createPortal(content, pip.document.body) : null), [pip]);

  return { pip, open, close, render };
}
