// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canShareNatively,
  copyLink,
  emailShareUrl,
  shareLinksFor,
  shareNatively,
  smsShareUrl,
  telegramShareUrl,
  whatsappShareUrl,
} from "@/lib/hub/share";
import { HUB_PRODUCTS } from "@/lib/hub/products";

/**
 * Sharing, and specifically the two ways it can lie.
 *
 * 1. A cancelled share must not report success. `navigator.share` rejects with
 *    AbortError when the person backs out, and a "shared!" confirmation after
 *    that is the product telling them something untrue.
 * 2. A failed clipboard write must not say "Link copied".
 *
 * The URLs are asserted character-for-character because they are the one part a
 * wrong change cannot be seen in the UI: a double-encoded ampersand still looks
 * like a working button.
 */

const brain = HUB_PRODUCTS.find((product) => product.id === "brain")!;

function setShare(impl: ((data: ShareData) => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, "share", {
    value: impl as unknown,
    configurable: true,
  });
}

function setClipboard(impl: (() => Promise<void>) | undefined) {
  Object.defineProperty(window.navigator, "clipboard", {
    value: impl ? { writeText: impl } : undefined,
    configurable: true,
  });
}

afterEach(() => {
  setShare(undefined);
  setClipboard(undefined);
  vi.restoreAllMocks();
});

/** Read one parameter back out of a share URL, the way a mail client would. */
function decodedParam(url: string, key: string): string {
  const after = url.split(`${key}=`)[1] ?? "";
  return decodeURIComponent(after.split("&")[0] ?? "");
}

describe("the fallback share URLs", () => {
  it("encodes the message for WhatsApp", () => {
    expect(whatsappShareUrl("a b&c=d?")).toBe("https://wa.me/?text=a%20b%26c%3Dd%3F");
  });

  it("encodes the body for SMS and keeps the sms: ?&body= shape", () => {
    const url = smsShareUrl("Hello there");
    expect(url.startsWith("sms:?&body=")).toBe(true);
    expect(url).toBe("sms:?&body=Hello%20there");
  });

  it("sends the link and the message as separate Telegram parameters", () => {
    const url = telegramShareUrl("https://instructbrain.com/hub?product=brain", "Have a look");
    expect(url).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Finstructbrain.com%2Fhub%3Fproduct%3Dbrain&text=Have%20a%20look",
    );
  });

  it("puts the subject and the body on the mailto", () => {
    const url = emailShareUrl("A subject", "A body");
    expect(url).toBe("mailto:?subject=A%20subject&body=A%20body");
  });

  it("builds all four from a product's own copy, and never re-encodes a clean string", () => {
    const links = shareLinksFor(brain.share);
    // The message as written contains a colon and an em dash; both must survive
    // a single encode and be debuggable by eye in the href.
    expect(decodedParam(links.whatsapp, "text")).toBe(brain.share.message);
    expect(decodedParam(links.email, "body")).toBe(brain.share.message);
    expect(decodedParam(links.email, "subject")).toBe(brain.share.subject);
    // A double-encoded message is the classic break, and this catches it.
    expect(links.whatsapp).not.toContain("%2520");
  });
});

describe("the native share sheet", () => {
  it("is unavailable where the browser has no share sheet", () => {
    setShare(undefined);
    expect(canShareNatively()).toBe(false);
  });

  it("hands over the message, the link and the title", async () => {
    const share = vi.fn(async () => undefined);
    setShare(share);
    await expect(shareNatively(brain.share)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: brain.share.subject,
      text: brain.share.message,
      url: brain.share.url,
    });
  });

  it("reports a cancellation as cancelled, not as a share", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    setShare(async () => {
      throw abort;
    });
    await expect(shareNatively(brain.share)).resolves.toBe("cancelled");
  });

  it("falls back to the drawer on any other refusal", async () => {
    setShare(async () => {
      throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
    });
    await expect(shareNatively(brain.share)).resolves.toBe("unavailable");
  });

  it("falls back to the drawer when there was never a share sheet", async () => {
    setShare(undefined);
    await expect(shareNatively(brain.share)).resolves.toBe("unavailable");
  });
});

describe("copy link", () => {
  it("reports true when the clipboard took the link", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard(writeText);
    await expect(copyLink(brain.share.url)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(brain.share.url);
  });

  it("reports false when the clipboard is refused, so no false confirmation", async () => {
    setClipboard(async () => {
      throw new Error("denied");
    });
    await expect(copyLink(brain.share.url)).resolves.toBe(false);
  });

  it("reports false where there is no clipboard at all", async () => {
    setClipboard(undefined);
    await expect(copyLink(brain.share.url)).resolves.toBe(false);
  });
});
