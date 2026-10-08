/**
 * Shared fixtures for the PDF layout suites.
 *
 * Reading text back out of a built PDF is the only way to assert most of what
 * matters about pagination, so it lives here once rather than being copied into
 * every suite that needs it.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { vi } from "vitest";
import type { DocFinding, DocPhoto, ReportDocument } from "@/lib/report/document";
import { siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";

/**
 * Defaults first, overrides last. Written the other way round — reading each
 * field out of `overrides` individually — a field nobody remembered to read is
 * silently dropped, which is how the layout sample below managed to set a title
 * and get `null` back without a single test complaining.
 */
const FINDING_DEFAULTS = {
  id: "f1",
  ref: "F-001",
  sequence: 1,
  statusId: "observation",
  severityId: null,
  categoryId: null,
  findingText: "A described defect on the north elevation.",
  snagTitle: null,
  remedialText: "Remedial work required.",
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
  photos: [],
};

export function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return { ...FINDING_DEFAULTS, ...overrides } as DocFinding;
}

export function reportDocument(findings: DocFinding[]): ReportDocument {
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

export function photo(id: string, sequence: number): DocPhoto {
  return {
    id,
    sequence,
    filename: `${id}.png`,
    capturedAt: "2026-10-01T09:00:00Z",
    url: `https://example.test/${id}.png`,
    thumbUrl: `https://example.test/${id}-thumb.png`,
    captureFields: {},
  };
}

/** A unique token, so a piece of prose can be found again after it is printed. */
export function marker(kind: "START" | "END", n: number): string {
  return `ZQ${kind}${n}ZQ`;
}

/** Prose of a chosen length, flanked by the item's two tokens. */
export function body(n: number, words: number): string {
  const filler = Array.from({ length: words }, (_, i) => `filler${i % 9}`).join(" ");
  return `${marker("START", n)} ${filler} ${marker("END", n)}`;
}

/**
 * Everything a page draws as text, with pdf-lib's encoding undone.
 *
 * Two facts make this necessary and easy to get wrong: the content streams are
 * Flate-compressed, and pdf-lib draws text as a HEX string rather than a literal
 * one ("<48454C4C4F> Tj"). A decoder written on the wrong assumption returns ""
 * for every page, which makes a "nothing was split" assertion pass for entirely
 * the wrong reason.
 */
export function decodePageTexts(bytes: Uint8Array): Promise<string[]> {
  return PDFDocument.load(bytes).then((doc) =>
    doc.getPages().map((_, index) => {
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
        for (const match of raw.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
          const hex = match[1] ?? "";
          let text = "";
          for (let i = 0; i + 1 < hex.length; i += 2) {
            text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
          }
          out += text + " ";
        }
        for (const match of raw.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)) {
          out += match[1].replace(/\\([()\\])/g, "$1") + " ";
        }
      }
      return out;
    }),
  );
}

/** The page each given needle appears on, and whether it was found at all. */
export function pagesOf(needles: string[], pages: string[]): Map<string, number> {
  const found = new Map<string, number>();
  pages.forEach((text, index) => {
    for (const needle of needles) if (text.includes(needle)) found.set(needle, index);
  });
  return found;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.slice(4, 8 + data.length)));
  return out;
}

/** A real, valid PNG built in the test, so no fixture file is needed. */
export function png(width: number, height: number): Uint8Array {
  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * stride + 1 + x * 3;
      raw[at] = 180;
      raw[at + 1] = 60;
      raw[at + 2] = 60;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(deflateSync(raw))),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export const PHOTO_BYTES = png(1200, 900);

export function serveImages() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(PHOTO_BYTES, { status: 200 })));
}
