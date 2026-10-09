/**
 * Sharing a product from the launcher.
 *
 * Two paths, and the difference matters:
 *
 *  - `shareNatively` hands the message to the phone's own share sheet. This is
 *    the primary path on a handset and it is the whole point of the launcher.
 *  - The five fallbacks below are plain URLs for the platforms that can be
 *    reached without a share sheet (desktop, in-app webviews). They only ever
 *    OPEN a compose window. Nothing in this module sends anything: there is no
 *    fetch, no API call and no background submission anywhere in it, so a
 *    cancelled share cannot quietly deliver a message.
 *
 * Pure functions for the URLs, so the encoding is tested rather than hoped for.
 */

/** A channel the fallback drawer can offer. */
export type ShareChannel = "whatsapp" | "sms" | "telegram" | "email" | "copy";

export type ShareOutcome =
  /** The share sheet opened and the person completed a share. */
  | "shared"
  /** The share sheet opened and the person backed out. Nothing was sent. */
  | "cancelled"
  /** No share sheet on this device - show the fallback drawer. */
  | "unavailable";

/** `https://wa.me/?text=<message>` */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** `sms:?&body=<message>` */
export function smsShareUrl(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

/** `https://t.me/share/url?url=<link>&text=<message>` */
export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** `mailto:?subject=<subject>&body=<message>` */
export function emailShareUrl(subject: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

export type ShareLinks = Record<Exclude<ShareChannel, "copy">, string>;

/** Every fallback URL for one product, built from its own share copy. */
export function shareLinksFor(share: { message: string; url: string; subject: string }): ShareLinks {
  return {
    whatsapp: whatsappShareUrl(share.message),
    sms: smsShareUrl(share.message),
    telegram: telegramShareUrl(share.url, share.message),
    email: emailShareUrl(share.subject, share.message),
  };
}

type NavigatorWithShare = Navigator & {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
};

/** Whether this browser has a native share sheet at all. */
export function canShareNatively(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as NavigatorWithShare).share === "function";
}

/**
 * Try the native share sheet.
 *
 * A cancelled share REJECTS with `AbortError`. That is not a failure and it is
 * not a delivery: the caller must show nothing and send nothing, because a
 * "thanks for sharing" message after a cancellation tells the person something
 * untrue about what just happened.
 */
export async function shareNatively(share: {
  message: string;
  url: string;
  subject: string;
}): Promise<ShareOutcome> {
  if (!canShareNatively()) return "unavailable";
  try {
    await (navigator as NavigatorWithShare).share?.({
      title: share.subject,
      text: share.message,
      url: share.url,
    });
    return "shared";
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (name === "AbortError") return "cancelled";
    // Anything else (NotAllowedError without a user gesture, a data error):
    // fall through to the drawer rather than claiming the share happened.
    return "unavailable";
  }
}

/**
 * Copy a link to the clipboard.
 *
 * Returns whether it actually worked. The caller must not confirm a copy that
 * did not happen - `navigator.clipboard` is absent on insecure origins and its
 * promise rejects when permission is refused.
 */
export async function copyLink(url: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
