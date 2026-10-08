import { describe, expect, it } from "vitest";
import { assignPins, photoPlates, platedPhotoIds, pinFor, type PinItem } from "@/lib/report/photo-pins";
import type { DocRegion } from "@/lib/report/document";

const region: DocRegion = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

const item = (ref: string, photoId: string, patch: DocRegion | null = region): PinItem => ({
  findingId: `id-${ref}`,
  ref,
  photoId,
  region: patch,
});

describe("pins on a photograph", () => {
  it("numbers the findings that share a photograph, in document order", () => {
    const pins = assignPins([item("F-001", "p1"), item("F-002", "p1"), item("F-003", "p1")]);
    expect(pinFor(pins, "p1", "id-F-001")?.number).toBe(1);
    expect(pinFor(pins, "p1", "id-F-002")?.number).toBe(2);
    expect(pinFor(pins, "p1", "id-F-003")?.number).toBe(3);
    expect(pinFor(pins, "p1", "id-F-002")?.total).toBe(3);
  });

  it("gives no pin to a photograph carrying a single finding", () => {
    const pins = assignPins([item("F-001", "p1"), item("F-002", "p2")]);
    expect(pins.size).toBe(0);
    expect(pinFor(pins, "p1", "id-F-001")).toBeNull();
  });

  it("numbers each photograph independently", () => {
    const pins = assignPins([
      item("F-001", "p1"),
      item("F-002", "p1"),
      item("F-003", "p2"),
      item("F-004", "p2"),
    ]);
    expect(pinFor(pins, "p1", "id-F-002")?.number).toBe(2);
    expect(pinFor(pins, "p2", "id-F-003")?.number).toBe(1);
    expect(pinFor(pins, "p2", "id-F-004")?.number).toBe(2);
  });

  it("carries the reference so a pin can be looked up by item", () => {
    const pins = assignPins([item("F-001", "p1"), item("F-002", "p1")]);
    expect(pinFor(pins, "p1", "id-F-001")?.ref).toBe("F-001");
  });

  it("is stable: the same document always produces the same pins", () => {
    const once = assignPins([item("F-001", "p1"), item("F-002", "p1")]);
    const twice = assignPins([item("F-001", "p1"), item("F-002", "p1")]);
    expect(pinFor(once, "p1", "id-F-002")).toEqual(pinFor(twice, "p1", "id-F-002"));
  });

  it("gives no pin to an item the model recorded no area for", () => {
    // Rule 1. Rewritten deliberately on 8 Oct 2026: pins used to be numbered
    // across every item on the photograph, including the ones with no region,
    // which produced "Pin 1, 2, 4, 5 of 6" — numbers a reader cannot find and a
    // total that does not match the pins on the picture.
    const pins = assignPins([item("F-001", "p1", null), item("F-002", "p1")]);
    expect(pinFor(pins, "p1", "id-F-001")).toBeNull();
    expect(pinFor(pins, "p1", "id-F-002")).toBeNull();
  });

  it("numbers only the marked items, and counts only those", () => {
    const pins = assignPins([
      item("F-001", "p1"),
      item("F-002", "p1", null),
      item("F-003", "p1"),
      item("F-004", "p1", null),
      item("F-005", "p1"),
    ]);
    expect(pinFor(pins, "p1", "id-F-001")?.number).toBe(1);
    expect(pinFor(pins, "p1", "id-F-003")?.number).toBe(2);
    expect(pinFor(pins, "p1", "id-F-005")?.number).toBe(3);
    expect(pinFor(pins, "p1", "id-F-001")?.total).toBe(3);
    expect(pinFor(pins, "p1", "id-F-002")).toBeNull();
  });
});

describe("photographs carrying several items", () => {
  it("returns a plate once for a photograph shared by two items", () => {
    const plates = photoPlates([item("F-001", "p1"), item("F-002", "p1")]);
    expect(plates).toHaveLength(1);
    expect(plates[0]?.photoId).toBe("p1");
    expect(plates[0]?.items).toBe(2);
    expect(plates[0]?.marks.map((mark) => mark.number)).toEqual([1, 2]);
  });

  it("leaves a photograph carrying a single item out of the plates", () => {
    const plates = photoPlates([item("F-001", "p1"), item("F-002", "p2")]);
    expect(plates).toHaveLength(0);
  });

  it("plates a shared photograph even when the model marked only one item", () => {
    // Membership is "more than one finding", not "more than one region": the
    // repeating picture is the problem, and it repeats regardless of regions.
    const plates = photoPlates([item("F-001", "p1", null), item("F-002", "p1", null)]);
    expect(plates).toHaveLength(1);
    expect(plates[0]?.marks.every((mark) => mark.number === null)).toBe(true);
    expect(plates[0]?.marks.every((mark) => mark.region === null)).toBe(true);
  });

  it("numbers the plate marks with the same numbers the item rows read", () => {
    const items = [
      item("F-001", "p1"),
      item("F-002", "p1"),
      item("F-003", "p1"),
      item("F-004", "p2"),
      item("F-005", "p2"),
    ];
    const pins = assignPins(items);
    const plates = photoPlates(items);
    const plateNumbers = new Map(
      plates.flatMap((plate) => plate.marks.map((mark) => [mark.findingId, mark.number] as const)),
    );
    for (const entry of items) {
      expect(plateNumbers.get(entry.findingId) ?? null).toBe(
        pinFor(pins, entry.photoId, entry.findingId)?.number ?? null,
      );
    }
  });

  it("reports which photographs are on a plate", () => {
    const plates = photoPlates([item("F-001", "p1"), item("F-002", "p1"), item("F-003", "p2")]);
    const ids = platedPhotoIds(plates);
    expect(ids.has("p1")).toBe(true);
    expect(ids.has("p2")).toBe(false);
  });
});
