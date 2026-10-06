// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { InstallBar } from "@/components/field/install-bar";
import { registerServiceWorker, useInstallPrompt } from "@/lib/pwa/install";

/**
 * The field app must reach a phone's home screen when someone scans the QR code.
 *
 * The defect these guard: the app shipped with a correct manifest and NO service
 * worker, on the belief that "the manifest alone is what gets instructBrain onto
 * a home screen". That is not true of Chrome, which will not fire
 * `beforeinstallprompt` - so the install offer silently never appeared on
 * Android at all. There was no error to notice; the feature just was not there.
 */

/** Executable JS only. Comments cannot run, so a guard must not read them. */
function executableJs(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile";
const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari";
const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
}

function fireInstallPrompt() {
  const event = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void> };
  event.prompt = vi.fn(async () => {});
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  // RTL's automatic cleanup only registers when vitest globals are on, which
  // they are not here. Without this, each render stays in the document and a
  // later test finds two install bars and cannot tell them apart.
  cleanup();
  vi.restoreAllMocks();
});

describe("the service worker", () => {
  const source = readFileSync("public/sw.js", "utf8");
  const code = executableJs(source);

  it("exists and answers fetch, which is what makes the app installable", () => {
    expect(code).toContain('self.addEventListener("fetch"');
  });

  it("registers install and activate so it takes control on the first visit", () => {
    expect(code).toContain('addEventListener("install"');
    expect(code).toContain('addEventListener("activate"');
    expect(code).toContain("clients.claim");
  });

  /**
   * The whole reason this worker is safe to add. An install prompt is not worth
   * risking a stale build of the app that decides what a report says, so caching
   * must never appear here. If offline support is ever wanted it belongs in its
   * own change, not smuggled into this one.
   */
  it("caches nothing at all", () => {
    for (const forbidden of ["caches.open", "cache.put", "cache.add", "cache.addAll", "CacheStorage"]) {
      expect(code, forbidden).not.toContain(forbidden);
    }
  });
});

describe("registerServiceWorker", () => {
  it("registers /sw.js", () => {
    const register = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });
    registerServiceWorker();
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("stays quiet when registration is refused", () => {
    const register = vi.fn(() => Promise.reject(new Error("blocked")));
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });
    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("does nothing where there is no service worker support", () => {
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: undefined,
      configurable: true,
    });
    expect(() => registerServiceWorker()).not.toThrow();
  });
});

describe("the root document registers it", () => {
  it("calls registerServiceWorker on mount", () => {
    // Comments stripped: a commented-out call is not a registration, and a
    // plain `toContain` would happily pass on one.
    const root = executableJs(readFileSync("src/routes/__root.tsx", "utf8"));
    expect(root).toContain("registerServiceWorker()");
  });
});

describe("the install offer", () => {
  it("offers the browser's own prompt once the event arrives", () => {
    setUserAgent(ANDROID_UA);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);

    fireInstallPrompt();

    expect(result.current.canPrompt).toBe(true);
    expect(result.current.needsManualSteps).toBe(false);
  });

  it("calls the browser's prompt, and only when it has one", async () => {
    setUserAgent(ANDROID_UA);
    const { result } = renderHook(() => useInstallPrompt());
    await act(async () => {
      await result.current.install();
    });
    // No event yet: must be a no-op rather than a crash.
    expect(result.current.canPrompt).toBe(false);

    const event = fireInstallPrompt();
    await act(async () => {
      await result.current.install();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("falls back to written steps on iOS, which never fires the event", () => {
    setUserAgent(IOS_UA);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.platform).toBe("ios");
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.needsManualSteps).toBe(true);
  });

  /**
   * The regression guard. On Android the old code showed NOTHING until the
   * event arrived - and the event never arrived, so a site manager scanning the
   * QR code was offered no way onto his home screen at all.
   */
  it("still tells an Android user how, before the event arrives", () => {
    setUserAgent(ANDROID_UA);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.platform).toBe("android");
    expect(result.current.needsManualSteps).toBe(true);
  });

  it("says nothing on a desktop, which has no home screen to add to", () => {
    setUserAgent(DESKTOP_UA);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.platform).toBe("other");
    expect(result.current.needsManualSteps).toBe(false);
  });
});

describe("the install bar", () => {
  it("shows an Android user what to tap when there is no automatic prompt", () => {
    setUserAgent(ANDROID_UA);
    render(<InstallBar />);
    expect(screen.getByText(/open your browser menu/i)).toBeTruthy();
  });

  it("shows the Share steps on iOS", () => {
    setUserAgent(IOS_UA);
    render(<InstallBar />);
    expect(screen.getByText(/tap Share/i)).toBeTruthy();
    expect(screen.queryByText(/open your browser menu/i)).toBeNull();
  });

  it("shows a button once the browser offers a real prompt", () => {
    setUserAgent(ANDROID_UA);
    render(<InstallBar />);
    fireInstallPrompt();
    expect(screen.getByRole("button", { name: /add to home screen/i })).toBeTruthy();
  });

  it("stays out of the way on a desktop", () => {
    setUserAgent(DESKTOP_UA);
    const { container } = render(<InstallBar />);
    expect(container.textContent).toBe("");
  });
});
