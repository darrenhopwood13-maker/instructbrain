/**
 * Numbered pins on a photograph.
 *
 * The AI returns the patch of the image it read (`ai_region`, stored on the
 * finding). When one photograph carries several findings, the reader needs to
 * know which numbered item each patch belongs to — that is what a pin is.
 *
 * Two rules, both deliberate:
 *
 *  1. A photograph carrying a single finding gets no pin. There is only one
 *     thing on it; a marker adds a number to look up and nothing to look up.
 *  2. Pins are numbered per photograph, in the order the document lists the
 *     items, so "Pin 2" on the photograph is the second item on that
 *     photograph in the schedule — never a number invented at render time.
 */

export type PinItem = {
  findingId: string;
  ref: string;
  photoId: string;
};

export type Pin = {
  findingId: string;
  ref: string;
  photoId: string;
  /** 1-based, within its own photograph. */
  number: number;
  /** How many findings share this photograph — "Pin 2 of 3". */
  total: number;
};

function key(photoId: string, findingId: string): string {
  return `${photoId}:${findingId}`;
}

/**
 * Assign pins to the findings that share a photograph. Items must be in the
 * order the document shows them; the same input always produces the same pins.
 */
export function assignPins(items: PinItem[]): Map<string, Pin> {
  const byPhoto = new Map<string, PinItem[]>();
  for (const item of items) {
    const list = byPhoto.get(item.photoId);
    if (list) list.push(item);
    else byPhoto.set(item.photoId, [item]);
  }

  const pins = new Map<string, Pin>();
  for (const [photoId, list] of byPhoto) {
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
