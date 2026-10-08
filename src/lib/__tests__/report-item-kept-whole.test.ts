import { afterEach, describe, expect, it, vi } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { buildReportPdf, shouldBreakBeforeEntry } from "@/lib/report/pdf.server";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import { siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";

/**
 * Phase A of the readability job: an item is never sliced by a page break.
 *
 * A sentence that stops at the foot of page 14 and resumes at the top of page 15
 * is the single thing that makes a generated document look careless. The writer
 * used to check for space one line at a time, so that is exactly what it did.
 *
 * How this is proved. Reading text back out of a PDF is the only way to assert
 * the property, so each item in the fixture carries a unique token at the start
 * of its prose and a matching one at the end. If both tokens land on the same
 * page, nothing sliced it. The first assertion checks the decoder actually found
 * a token: without that, a decoder returning "" would make every other assertion
 * pass for the wrong reason, which is the classic way a test like this lies.
 *
 * The fixture matters as much as the assertion. The first version of this test
 * used twelve short items and PASSED with the page break disabled: nothing ever
 * straddled a page boundary, so it proved nothing whatsoever. It was caught only
 * by disabling the fix and re-running, which is the check that gives a test like
 * this any value at all.
 *
 * A note for the next person. The earlier claim in this suite stands: the content
 * streams ARE Flate-compressed, and pdf-lib draws text as a hex string rather
 * than a literal one. Both facts together mean a naive text search over the file
 * finds nothing, and a decoder written from the wrong assumption returns an
 * empty string for every page — which passes a "not sliced" assertion for
 * entirely the wrong reason. Hence the self-check above.
 */

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "F-001",
    sequence: overrides.sequence ?? 1,
    statusId: "observation",
    severityId: null,
    categoryId: null,
    findingText: overrides.findingText ?? "A described defect on the north elevation.",
    snagTitle: null,
    remedialText: "Make good.",
    rectificationAlt: null,
    tradesmanHack: null,
    hsNotes: null,
    captureFields: {},
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    photos: overrides.photos ?? [],
  };
}

function doc(findings: DocFinding[]): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "Site condition",
      subtitle: null,
      reference: "IB-0002",
      reportDate: "2026-10-01",
      status: "draft",
      issuedAt: null,
      currentVersion: 0,
      scopeText: null,
      methodologyText: null,
      executiveSummary: null,
      synthesisConfirmed: false,
      coverPhotoId: null,
      outputLanguage: "en",
    },
    project: null,
    organisation: null,
    snapshot: snapshotOf(siteWalkDefinition),
    findings,
    photos: [],
    synthesis: null,
    author: null,
  } as ReportDocument;
}

const ITEMS = 10;

/** A unique token at each end of an item's prose, and enough words to wrap. */
function marker(kind: "START" | "END", n: number): string {
  return `ZQ${kind}${n}ZQ`;
}

// Ten items of this length straddle a page boundary twice without the fix —
// item 2 across pages 1-2 and item 7 across pages 3-4 — and not at all with it.
// The count and the length are not arbitrary: an earlier version of this test
// used twelve SHORT items and passed with the page break disabled, because
// nothing ever straddled. A test for "this never happens" has to be shown
// happening, so the fixture is the one measured to break the old behaviour.
function body(n: number): string {
  const filler = Array.from({ length: 260 }, (_, i) => `filler${i % 9}`).join(" ");
  return `${marker("START", n)} ${filler} ${marker("END", n)}`;
}

function longReport(items: number): ReportDocument {
  return doc(
    Array.from({ length: items }, (_, index) => {
      const n = index + 1;
      return finding({ id: `f${n}`, ref: `F-${String(n).padStart(3, "0")}`, findingText: body(n) });
    }),
  );
}

/** Everything the given page draws as text, with pdf-lib's escaping undone. */
function pageText(doc: PDFDocument, index: number): string {
  const contents = doc.getPages()[index]?.node.Contents();
  if (!contents) return "";
  const objects = contents instanceof PDFArray ? contents.asArray() : [contents];
  let out = "";
  for (const entry of objects) {
    const stream = entry ? doc.context.lookup(entry) : undefined;
    if (!(stream instanceof PDFRawStream)) continue;
    let data = stream.contents;
    if (stream.dict.get(PDFName.of("Filter"))) {
      try {
        data = new Uint8Array(inflateSync(Buffer.from(data)));
      } catch {
        continue;
      }
    }
    const raw = new TextDecoder("latin1").decode(data);
    // pdf-lib draws text as a HEX string, not a literal one: <48454C4C4F> Tj.
    // Matching on "(...)" finds nothing at all, which is how the first version of
    // this decoder managed to return an empty page for every page.
    for (const match of raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const hex = match[1] ?? "";
      let text = "";
      for (let i = 0; i + 1 < hex.length; i += 2) {
        text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      out += text + " ";
    }
    // A literal string is still handled, so the decoder is not tied to one
    // encoding choice by pdf-lib.
    for (const match of raw.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)) {
      out += match[1].replace(/\\([()\\])/g, "$1") + " ";
    }
  }
  return out;
}

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((_, index) => pageText(doc, index));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whether an entry starts on a fresh page", () => {
  it("leaves it where it is when it fits", () => {
    expect(shouldBreakBeforeEntry(200, 400, 700)).toBe(false);
  });

  it("moves it when it would be sliced and a fresh page would hold it", () => {
    expect(shouldBreakBeforeEntry(200, 150, 700)).toBe(true);
  });

  it("does not move an entry longer than a whole page", () => {
    // It cannot be kept whole anywhere, so moving it would waste this page and
    // then still flow. It stays, and it flows.
    expect(shouldBreakBeforeEntry(800, 400, 700)).toBe(false);
  });

  it("leaves an entry that exactly fills the room", () => {
    expect(shouldBreakBeforeEntry(400, 400, 700)).toBe(false);
  });
});

describe("no item is sliced across a page break", () => {
  it("keeps every item's prose on one page", async () => {
    const built = await buildReportPdf(longReport(ITEMS), { variant: "full", includePhotos: false });
    const pages = await pageTexts(built.bytes);

    // The instrument works: at least the first item's opening token is readable.
    // If this fails, the decoder is broken and nothing below means anything.
    expect(pages.join(" ")).toContain(marker("START", 1));

    const pageOf = new Map<string, number>();
    pages.forEach((text, index) => {
      for (let n = 1; n <= ITEMS; n++) {
        for (const kind of ["START", "END"] as const) {
          const token = marker(kind, n);
          if (text.includes(token)) pageOf.set(token, index);
        }
      }
    });

    // Every token was found. A missing one must fail loudly rather than be
    // treated as "not sliced".
    expect(pageOf.size).toBe(ITEMS * 2);

    const sliced: string[] = [];
    for (let n = 1; n <= ITEMS; n++) {
      const start = pageOf.get(marker("START", n));
      const end = pageOf.get(marker("END", n));
      if (start !== end) sliced.push(`item ${n} (page ${start} to page ${end})`);
    }
    expect(sliced).toEqual([]);

    // And the document really did run to more than one page, so the assertions
    // above were not satisfied by everything landing on a single sheet.
    expect(pages.length).toBeGreaterThan(1);
  });
});
