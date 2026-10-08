import { describe, expect, it } from "vitest";
import { assignPins, pinFor, type PinItem } from "@/lib/report/photo-pins";

const item = (ref: string, photoId: string): PinItem => ({
  findingId: `id-${ref}`,
  ref,
  photoId,
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
});
