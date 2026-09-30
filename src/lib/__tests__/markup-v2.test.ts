import { describe, expect, it } from "vitest";
import { coerceMarkup, moveLayer } from "@/lib/photos/markup";
import { issueBlockers } from "@/lib/report/document";

describe("markup layers", () => {
  it("keeps older layers readable and accepts the new tools", () => {
    const layers = coerceMarkup([
      { id: "a", kind: "arrow", x: 0.1, y: 0.1, x2: 0.5, y2: 0.5, colour: "red" },
      { id: "b", kind: "pen", x: 0, y: 0, x2: 0, y2: 0, colour: "accent", points: [[0.1, 0.1], [0.2, 0.3]], stroke: "l" },
      { id: "c", kind: "marker", x: 0.5, y: 0.5, x2: 0.5, y2: 0.5, colour: "yellow", number: 3, size: "s" },
      { id: "d", kind: "laser", x: 0, y: 0, x2: 0, y2: 0, colour: "red" },
      { id: "e", kind: "pen", x: 0, y: 0, x2: 0, y2: 0, colour: "red", points: [[0.1, 0.1]] },
    ]);
    expect(layers.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(layers[0]!.stroke).toBeUndefined();
    expect(layers[1]!.stroke).toBe("l");
    expect(layers[2]!.number).toBe(3);
  });
  it("moving never pushes a shape off the photo", () => {
    const moved = moveLayer({ id: "a", kind: "rectangle", x: 0.8, y: 0.8, x2: 0.9, y2: 0.9, colour: "red" }, 0.5, 0.5);
    expect(moved.x2).toBeCloseTo(1);
    expect(moved.x).toBeCloseTo(0.9);
  });
});

describe("manual reports need no confirmation", () => {
  const finding = { id: "f", ref: "1", sequence: 1, statusId: "recorded", confirmedAt: null, assignedTrade: null } as never;
  const doc = (manualOnly: boolean) =>
    ({
      snapshot: {
        manualOnly,
        statuses: [{ id: "recorded", label: "Recorded", tone: "neutral" }, { id: "not_assessed", label: "Not assessed", tone: "flag" }],
      },
      findings: [finding],
    }) as never;
  it("does not block a manual report on unconfirmed items", () => {
    expect(issueBlockers(doc(true)).unconfirmed).toHaveLength(0);
  });
  it("still blocks other report types", () => {
    expect(issueBlockers(doc(false)).unconfirmed).toHaveLength(1);
  });
});
