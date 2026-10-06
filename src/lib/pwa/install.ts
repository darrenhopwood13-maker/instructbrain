import { useEffect, useState } from "react";

/**
 * Installability helpers for the field app.
 *
 * A manifest alone does NOT make an app installable. Chrome requires a
 * registered service worker with a `fetch` handler before it will consider the
 * app installable or fire `beforeinstallprompt` - so `registerServiceWorker`
 * below is load-bearing, not decoration. The worker it registers caches
 * nothing; see `public/sw.js` for why that is deliberate.
 */

type InstallEvent = Event & { prompt: () => Promise<void> };

export type InstallPlatform = "ios" | "android" | "other";

/**
 * Register the worker that makes the app installable.
 *
 * Without this, Android Chrome never fires `beforeinstallprompt` and the
 * install offer silently never appears - the failure looks like "the feature is
 * missing" rather than like an error.
 */
export function registerServiceWorker(): void {
  // `"serviceWorker" in navigator` is not enough: a browser that has the
  // property but no implementation on it (or a test double set to undefined)
  // passes that check and then throws on `.register`.
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.register) return;
  void navigator.serviceWorker.register("/sw.js").catch(() => {
    // An install offer is a convenience. In an in-app browser, a private window
    // or a locked-down device, registration fails and the app simply carries on
    // and offers the manual steps instead.
  });
}

function detectPlatform(): InstallPlatform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  // CriOS/FxiOS are Chrome and Firefox ON iOS, which behave like Safari here.
  if (/iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/**
 * True on a device whose primary input is touch: a phone or a tablet.
 *
 * Deliberately `(hover: none) and (pointer: coarse)` rather than a screen width.
 * A width rule was what excluded tablets in the first place, and width is the
 * wrong question - a tablet has a home screen and a desktop does not. This query
 * asks about the input instead, so it catches phones and tablets of any size and
 * still excludes a touchscreen laptop, whose primary pointer is a mouse.
 */
export function isHandheldDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches === true;
}

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
  platform: InstallPlatform;
  /** Whether this device has a home screen to add the app to at all. */
  handheld: boolean;
  install: () => Promise<void>;
} {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  // Starts false so a desktop never flashes the offer before the effect runs.
  const [handheld, setHandheld] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setPlatform(detectPlatform());
    setHandheld(isHandheldDevice());
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return {
    canPrompt: event !== null,
    /**
     * iOS Safari never fires the event at all, and on Android the offer can
     * arrive a moment after the first load while the service worker activates.
     * Either way the person is told how, rather than seeing nothing.
     */
    needsManualSteps: event === null && (platform === "ios" || platform === "android"),
    platform,
    handheld,
    install: async () => {
      if (!event) return;
      await event.prompt();
      setEvent(null);
    },
  };
}
