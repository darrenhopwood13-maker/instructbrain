import { describe, expect, it } from "vitest";

import {
  CLOSE_OUT_NOTE_LIMIT,
  canCloseOut,
  closeOutRefusal,
  extensionFor,
  normaliseComment,
  photoTypeRefusal,
} from "@/lib/report/close-out";

describe("closing an item out", () => {
  it("lets a reviewer close an item that is open, allocated or marked fixed", () => {
    for (const state of ["open", "assigned", "in_progress", "fixed"]) {
      expect(canCloseOut(state), state).toBe(true);
      expect(closeOutRefusal({ lifecycleState: state, comment: "Done", hasPhoto: false }), state).toBeNull();
    }
  });

  it("refuses an item that is already closed", () => {
    expect(canCloseOut("verified")).toBe(false);
    expect(closeOutRefusal({ lifecycleState: "verified", comment: "Done", hasPhoto: true })).toBe(
      "This item is already closed out.",
    );
  });

  it("says why a rejected item cannot be closed from here, rather than just refusing", () => {
    // A reviewer cannot go straight from "rejected" to "verified" - the item has to be
    // worked again first - and the screen has to say so in words, not a code.
    expect(canCloseOut("rejected")).toBe(false);
    const reason = closeOutRefusal({ lifecycleState: "rejected", comment: "Done", hasPhoto: true });
    expect(reason).toContain("Rejected");
    expect(reason).toContain("cannot be closed out from here");
  });

  it("treats an unknown state as open, so nothing is closed by a typo in the data", () => {
    expect(canCloseOut("something_else")).toBe(true);
    expect(canCloseOut(null)).toBe(true);
  });

  it("will not take a close-out with no evidence at all", () => {
    expect(closeOutRefusal({ lifecycleState: "open", comment: "", hasPhoto: false })).toBe(
      "Add a comment or a photograph. A close-out with nothing behind it is just a claim.",
    );
    expect(closeOutRefusal({ lifecycleState: "open", comment: "   ", hasPhoto: false })).not.toBeNull();
    expect(closeOutRefusal({ lifecycleState: "open", comment: null, hasPhoto: false })).not.toBeNull();
  });

  it("accepts either evidence on its own", () => {
    expect(closeOutRefusal({ lifecycleState: "open", comment: "Replaced the tray", hasPhoto: false })).toBeNull();
    expect(closeOutRefusal({ lifecycleState: "open", comment: "", hasPhoto: true })).toBeNull();
  });

  it("caps the comment rather than storing more than the trade link can read back", () => {
    expect(closeOutRefusal({ lifecycleState: "open", comment: "x".repeat(CLOSE_OUT_NOTE_LIMIT + 1), hasPhoto: false }))
      .toBe(`Keep the comment to ${CLOSE_OUT_NOTE_LIMIT} characters or fewer.`);
    expect(closeOutRefusal({ lifecycleState: "open", comment: "x".repeat(CLOSE_OUT_NOTE_LIMIT), hasPhoto: false }))
      .toBeNull();
  });

  it("stores the comment trimmed, and nothing at all when it is empty", () => {
    expect(normaliseComment("  Checked and sound  ")).toBe("Checked and sound");
    expect(normaliseComment("   ")).toBeNull();
    expect(normaliseComment(null)).toBeNull();
    expect(normaliseComment(undefined)).toBeNull();
    expect(normaliseComment("x".repeat(CLOSE_OUT_NOTE_LIMIT + 50))!.length).toBe(CLOSE_OUT_NOTE_LIMIT);
  });

  it("only takes an image, and says so when it is not", () => {
    expect(photoTypeRefusal("image/jpeg")).toBeNull();
    expect(photoTypeRefusal("IMAGE/PNG")).toBeNull();
    expect(photoTypeRefusal("image/heic")).toBeNull();
    expect(photoTypeRefusal("application/pdf")).toBe("Attach a photograph (JPEG, PNG, WebP or HEIC).");
    expect(photoTypeRefusal("video/mp4")).toBe("Attach a photograph (JPEG, PNG, WebP or HEIC).");
    expect(photoTypeRefusal("")).toBe("That photograph has no file type, so it cannot be stored.");
    expect(photoTypeRefusal(null)).toBe("That photograph has no file type, so it cannot be stored.");
  });

  it("names the stored object for the type it actually is", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
    expect(extensionFor("image/heic")).toBe("heic");
    expect(extensionFor("IMAGE/HEIF")).toBe("heic");
    expect(extensionFor("something/odd")).toBe("jpg");
  });
});
