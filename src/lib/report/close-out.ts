import { canTransition, coerceLifecycleState, lifecycleLabels } from "@/lib/lifecycle";

/**
 * Closing an item out from the dashboard.
 *
 * Dal asked on 12 Oct 2026 for the report creator to be able to close overdue items
 * from the dashboard, with a photograph or a comment. The product already has every
 * piece of this: an item moves `open → verified` by a reviewer, the note is stored in
 * `findings.lifecycle_note`, and a photograph is attached with the `closeout` role
 * that the finding_photo_role enum has carried since the first migration. What did
 * not exist was a way to do it without opening the report.
 *
 * The rules live here, as pure functions, so what counts as evidence and what does
 * not is tested rather than trusted. The server function applies them; the screen
 * shows the same sentence the server would refuse with, before anyone types.
 */

/** The note is capped to match the trade link's own limit, so one path cannot store
 * more than the other can read back. */
export const CLOSE_OUT_NOTE_LIMIT = 500;

/** A close-out photograph, as it arrives from the browser. */
export type CloseOutPhoto = {
  /** The image bytes, base64, without the data-URL prefix. */
  base64: string;
  /** e.g. "image/jpeg". */
  mimeType: string;
  filename?: string | null;
};

/** 8 MB of decoded image. A phone photograph is well under this; a video is not. */
export const CLOSE_OUT_PHOTO_LIMIT_BYTES = 8 * 1024 * 1024;

export type CloseOutInput = {
  lifecycleState: unknown;
  comment: string | null | undefined;
  hasPhoto: boolean;
};

/**
 * Why this item cannot be closed out, or null when it can.
 *
 * Deliberately returns the reason rather than a boolean: a screen has to tell
 * someone what to do about it, and "cannot" on its own is the kind of message that
 * makes a person think the app is broken rather than the request incomplete.
 */
export function closeOutRefusal(input: CloseOutInput): string | null {
  const state = coerceLifecycleState(input.lifecycleState);
  if (!canTransition(state, "verified", "reviewer")) {
    if (state === "verified") {
      return "This item is already closed out.";
    }
    return `An item that is "${lifecycleLabels[state]}" cannot be closed out from here.`;
  }

  const comment = (input.comment ?? "").trim();
  if (!comment && !input.hasPhoto) {
    return "Add a comment or a photograph. A close-out with nothing behind it is just a claim.";
  }
  if (comment.length > CLOSE_OUT_NOTE_LIMIT) {
    return `Keep the comment to ${CLOSE_OUT_NOTE_LIMIT} characters or fewer.`;
  }
  return null;
}

/** True when this item is one the dashboard should offer to close. */
export function canCloseOut(lifecycleState: unknown): boolean {
  return canTransition(coerceLifecycleState(lifecycleState), "verified", "reviewer");
}

/**
 * The photograph's own type check, before any bytes are moved.
 *
 * Only the types a phone camera actually produces, and only an image: a PDF or a
 * video renamed .jpg would otherwise land in the report's evidence as a broken
 * object that nobody finds until the client opens it.
 */
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function photoTypeRefusal(mimeType: string | null | undefined): string | null {
  const type = (mimeType ?? "").trim().toLowerCase();
  if (!type) return "That photograph has no file type, so it cannot be stored.";
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    return "Attach a photograph (JPEG, PNG, WebP or HEIC).";
  }
  return null;
}

/** The comment as it will be stored: trimmed, capped, and null when empty. */
export function normaliseComment(comment: string | null | undefined): string | null {
  const trimmed = (comment ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, CLOSE_OUT_NOTE_LIMIT);
}

/** The file extension for a stored close-out original. */
export function extensionFor(mimeType: string): string {
  switch (mimeType.trim().toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "jpg";
  }
}
