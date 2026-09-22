import { useEffect, useState } from "react";

/**
 * Installability helpers for the field app.
 *
 * No service worker: the manifest alone is what gets instructBrain onto a home
 * screen, and a cache would risk serving a stale app to someone on site.
 */

type InstallEvent = Event & { prompt: () => Promise<void> };

/** True once hydrated and running from an installed home-screen launch. */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const navigatorStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    const matches = window.matchMedia?.("(display-mode: standalone)").matches === true;
    setStandalone(navigatorStandalone || matches);
  }, []);
  return standalone;
}

/**
 * The browser's own install prompt when it offers one (Android/Chrome), and a
 * flag for the iOS Safari fallback, where the person adds it by hand.
 */
export function useInstallPrompt(): {
  canPrompt: boolean;
  needsManualSteps: boolean;
  install: () => Promise<void>;
} {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const ua = window.navigator.userAgent;
    setIosSafari(/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return {
    canPrompt: event !== null,
    needsManualSteps: event === null && iosSafari,
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
}
