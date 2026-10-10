import type { DocFinding, DocRegion } from "@/lib/report/document";

/**
 * Numbered pins on a photograph.
 *
 * The AI returns the patch of the image it read (`ai_region`, stored on the
 * finding). When one photograph carries several findings, the reader needs to
 * know which numbered item each patch belongs to — that is what a pin is.
 *
 * Three rules, all deliberate:
 *
 *  1. A pin is drawn only where there is a region to point at. No region, no
 *     pin — never a confident marker floating over a photograph the model did
 *     not actually read.
 *  2. A photograph carrying a single marked item gets no pin. There is only
 *     one thing on it; a marker adds a number to look up and nothing to look
 *     up.
 *  3. Pins are numbered per photograph, in the order the document lists the
 *     items, so "Pin 2" on the photograph is the second *marked* item on that
 *     photograph in the schedule — never a number invented at render time.
 *
 * Changed 8 October 2026, deliberately: numbering used to count every item on
 * the photograph, including the ones with no region. A photograph carrying six
 * findings of which four had a region therefore showed "Pin 1, 2, 4, 5 of 6" —
 * pins that look missing and a total that does not match what a reader can
 * count. Numbering the marked items only makes the number and the total both
 * true. Nothing was published under the old rule, so no issued report changes.
 */

export type PinItem = {
  findingId: string;
  ref: string;
  photoId: string;
  /**
   * The patch of the photograph this item refers to, or null when the model
   * gave none. Required rather than optional so every call site has to decide.
   */
  region: DocRegion | null;
};

export type Pin = {
  findingId: string;
  ref: string;
  photoId: string;
  /** 1-based, within its own photograph. */
  number: number;
  /** How many marked items share this photograph — "Pin 2 of 3". */
  total: number;
};

function key(photoId: string, findingId: string): string {
  return `${photoId}:${findingId}`;
}

/** Build the pin input from anything document-shaped, so callers cannot disagree. */
export function pinItemsOf(
  findings: Array<{
    id: string;
    ref: string;
    photos: Array<{ photo: { id: string }; region: DocRegion | null }>;
  }>,
): PinItem[] {
  return findings.flatMap((finding) =>
    finding.photos.map((attachment) => ({
      findingId: finding.id,
      ref: finding.ref,
      photoId: attachment.photo.id,
      region: attachment.region,
    })),
  );
}

/**
 * Assign pins to the marked items that share a photograph. Items must be in the
 * order the document shows them; the same input always produces the same pins.
 */
export function assignPins(items: PinItem[]): Map<string, Pin> {
  const byPhoto = new Map<string, PinItem[]>();
  for (const item of items) {
    // Rule 1: no region, no pin.
    if (!item.region) continue;
    const list = byPhoto.get(item.photoId);
    if (list) list.push(item);
    else byPhoto.set(item.photoId, [item]);
  }

  const pins = new Map<string, Pin>();
  for (const [photoId, list] of byPhoto) {
    // Rule 2: a photograph with one marked item needs no number.
    if (list.length < 2) continue;
    list.forEach((item, index) => {
      pins.set(key(photoId, item.findingId), {
        findingId: item.findingId,
        ref: item.ref,
        photoId,
        number: index + 1,
        total: list.length,
      });
    });
  }
  return pins;
}

/** The pin for one finding on one photograph, or null when there is none. */
export function pinFor(pins: Map<string, Pin>, photoId: string, findingId: string): Pin | null {
  return pins.get(key(photoId, findingId)) ?? null;
}

export type PhotoPlateMark = {
  findingId: string;
  ref: string;
  /** The pin number, or null where this item carries no region to number. */
  number: number | null;
  /** How many marked items share this photograph; 0 when fewer than two do. */
  total: number;
  region: DocRegion | null;
};

/**
 * A photograph carrying more than one finding, with every one of those findings
 * and the pin number it carries if any. This is what the document shows ONCE,
 * so a photograph never appears twice in the same list.
 *
 * Membership is "more than one finding", NOT "more than one region": the
 * repeating-picture problem comes from the photograph being shared, and a
 * shared photograph with only one region on it must still be shown once.
 */
export type PhotoPlate = {
  photoId: string;
  /** How many findings are on this photograph. */
  items: number;
  marks: PhotoPlateMark[];
};

/** Whether a stored photograph can actually be read. No source, no picture. */
export function photoHasImage(photo: { url: string | null; thumbUrl: string | null }): boolean {
  return Boolean(photo.url || photo.thumbUrl);
}

/**
 * The photographs that must be shown once with all their pins. Derived from the
 * same `assignPins` result the item rows read, so a plate and the row that
 * points at it can never carry different numbers.
 *
 * `pins` is passed in rather than recomputed here because a photograph whose
 * image cannot be read still has to be shown ONCE — the repeating-picture
 * problem exists whether or not the bytes arrive — while carrying no pin
 * numbers, because there is no place to point at. Membership and numbering are
 * therefore two different questions, answered by two different inputs.
 */
/**
 * A one-line handle for an item on a plate: its title, or the opening of its
 * description. Not the whole entry — the schedule already carries the full
 * record, and repeating it beside the picture would double the document for no
 * extra information. This names the thing; the schedule describes it.
 */
export function plateHeadline(finding: DocFinding): string {
  const title = (finding.snagTitle ?? "").trim();
  if (title) return title;
  const text = (finding.findingText ?? "").replace(/\s+/g, " ").trim();
  const stop = text.indexOf(". ");
  const head = stop > 0 ? text.slice(0, stop + 1) : text;
  if (head.length <= 120) return head;
  // Cut at a word, never inside one. A hard 117-character slice printed "abuttin"
  // and "predominantly blue and red figurative panels w..." down a plate's pin list
  // on a client's report.
  const cut = head.slice(0, 117);
  const lastSpace = cut.lastIndexOf(" ");
  const body = lastSpace > 60 ? cut.slice(0, lastSpace) : cut;
  return `${body.trimEnd()}...`;
}

/**
 * Which plates are shown immediately above which item.
 *
 * A photograph carrying several items belongs beside the entries that use it. It
 * used to be collected into one block above the whole schedule, which on the
 * 58-item report put ten pages of pictures ahead of the first finding: reviewing
 * it meant holding a photograph in your head while reading an item nine pages
 * later. The first item that refers to a plate carries it; later items on the
 * same photograph point up at the pins above them.
 *
 * Pure, and separate from either renderer, so the screen and the PDF can be held
 * to the same placement rule and it can be asserted without rendering anything.
 */
export function planPlatePlacements(
  findings: DocFinding[],
  plates: PhotoPlate[],
): Map<string, PhotoPlate[]> {
  const plateByPhotoId = new Map(plates.map((plate) => [plate.photoId, plate]));
  const placed = new Set<string>();
  const plan = new Map<string, PhotoPlate[]>();
  for (const finding of findings) {
    for (const attachment of finding.photos) {
      const plate = plateByPhotoId.get(attachment.photo.id);
      if (!plate || placed.has(plate.photoId)) continue;
      placed.add(plate.photoId);
      const here = plan.get(finding.id) ?? [];
      here.push(plate);
      plan.set(finding.id, here);
    }
  }
  return plan;
}

export function photoPlates(items: PinItem[], pins: Map<string, Pin>): PhotoPlate[] {
  const byPhoto = new Map<string, PhotoPlateMark[]>();
  for (const item of items) {
    const pin = pinFor(pins, item.photoId, item.findingId);
    const marks = byPhoto.get(item.photoId) ?? [];
    marks.push({
      findingId: item.findingId,
      ref: item.ref,
      number: pin ? pin.number : null,
      total: pin ? pin.total : 0,
      region: item.region,
    });
    byPhoto.set(item.photoId, marks);
  }
  return [...byPhoto.entries()]
    .filter(([, marks]) => marks.length > 1)
    .map(([photoId, marks]) => ({ photoId, items: marks.length, marks }));
}

export function platedPhotoIds(plates: PhotoPlate[]): Set<string> {
  return new Set(plates.map((plate) => plate.photoId));
}
