import { describe, expect, it } from "vitest";

import { toExtractItem, type GroupableFinding } from "@/lib/distribution";
import {
  renderEmail,
  type ExtractItem,
  type ExtractPhoto,
  type TradeExtractPayload,
} from "@/lib/email/templates";

/**
 * A work pack shows the picture, in both places somebody reads it.
 *
 * The extract is the one document a subcontractor gets: the covering email, the
 * list on screen they can print, and the PDF attached to the email. The PDF has
 * always carried the photographs; the email body and the on-screen extract did
 * not, because the item shape they both read had nowhere to put one.
 *
 * Two things this pins, and the second one matters more than the first:
 *
 *  - the item's photograph travels from the finding all the way into the item;
 *  - the email carries the SMALL copy. A 4 MB original in a table cell is a
 *    message that will not load on a site phone, and the covering list is read on
 *    a phone far more often than it is read on a desk.
 */

const PHOTO = {
  sequence: 4,
  url: "https://example.test/p4-print.jpg",
  thumbUrl: "https://example.test/p4-thumb.jpg",
};

function groupable(photo: typeof PHOTO | null): GroupableFinding {
  return {
    id: "f1",
    ref: "F-001",
    sequence: 1,
    assignedTrade: "Electrical",
    severityId: null,
    captureFields: {},
    isConfidential: false,
    findingText: "A socket with a cracked faceplate.",
    remedialText: "Replace the faceplate.",
    dueDate: "2026-10-30",
    photo,
  };
}

function item(photo: ExtractPhoto | null): ExtractItem {
  return {
    ref: "F-001",
    location: "Ground floor",
    action: "Replace the faceplate.",
    severityLabel: "Improvement recommended",
    dueDate: "2026-10-30",
    isConfidential: false,
    photo,
  };
}

function extract(items: ExtractItem[]) {
  const data: TradeExtractPayload = {
    projectName: "Bruton Street",
    reportReference: "EIC-2026-10-005",
    trade: "Electrical",
    items,
    itemListUrl: "https://instructbrain.com/trade/example",
    isDraft: false,
    sentByName: "Dal",
    attachment: null,
  };
  return renderEmail({ template: "TRADE_EXTRACT", data });
}

describe("the photograph on a trade extract item", () => {
  it("travels from the finding into the extract item", () => {
    expect(toExtractItem(groupable(PHOTO), null).photo).toEqual(PHOTO);
  });

  it("is null, never invented, when the item has no photograph", () => {
    expect(toExtractItem(groupable(null), null).photo).toBeNull();
  });

  it("puts the small copy in the covering email, never the print-sized one", () => {
    const { html, text } = extract([item(PHOTO)]);

    expect(html).toContain('src="https://example.test/p4-thumb.jpg"');
    expect(html).toContain("Photograph 4");
    // The original is the picture the PDF attachment uses. Sending it into a
    // table cell as well would double the weight of every message.
    expect(html).not.toContain("p4-print.jpg");
    // The plain-text alternative still carries the work, which is all some
    // recipients will ever see.
    expect(text).toContain("Replace the faceplate.");
  });

  it("lists an item that has no photograph, without an image", () => {
    const { html } = extract([item(null)]);

    expect(html).toContain("Ground floor");
    expect(html).not.toContain("<img");
  });
});
