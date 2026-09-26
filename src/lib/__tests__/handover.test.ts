import { describe, expect, it } from "vitest";
import { propertyInventoryDefinition } from "@/lib/survey-definitions";
import {
  coerceHandover,
  handoverLayoutOf,
  handoverMissing,
  meterPhotoFor,
  meterReadingText,
  meterSlots,
} from "@/lib/report/handover";
import { coerceMeterSuggestion } from "@/lib/report/meter-read";
import { inventoryReadiness } from "@/lib/photos/inventory-readiness";
import { groupPhotosByRoom } from "@/lib/photos/rooms";
import { photoExcludesFromAnalysis, photoWorkflowOf } from "@/lib/survey-types";

const snapshot = propertyInventoryDefinition;
const layout = handoverLayoutOf(snapshot)!;
const workflow = photoWorkflowOf(snapshot)!;

const meterPhoto = {
  id: "m1",
  sequence: 9,
  capture_fields: { [workflow.roleField]: layout.meterRoleId, [layout.slotField]: "gas" },
};
const keysPhoto = { id: "k1", sequence: 10, capture_fields: { [workflow.roleField]: layout.keysRoleId } };

describe("handover (meters and keys)", () => {
  it("is declared by the v7 template", () => {
    expect(snapshot.version).toBe(7);
    expect(layout.meterTypes.map((type) => type.id)).toEqual(["electric", "gas", "water"]);
  });

  it("keeps meter and key photos out of analysis and rooms", () => {
    for (const photo of [meterPhoto, keysPhoto]) {
      expect(photoExcludesFromAnalysis(snapshot, photo.capture_fields)).toBe(true);
    }
    const grouped = groupPhotosByRoom([meterPhoto, keysPhoto], workflow);
    expect(grouped.unallocated).toHaveLength(0);
    const steps = inventoryReadiness(workflow, [meterPhoto, keysPhoto], null);
    expect(steps.find((step) => step.id === "allocated")?.detail).toContain("All photographs");
  });

  it("coerces stored data safely", () => {
    expect(coerceHandover(null)).toEqual({ meters: {}, extraMeters: [], keys: [], answers: {} });
    const record = coerceHandover({ meters: { gas: { reading: "123", notAccessible: "x" } }, answers: { handed_over: "maybe" } });
    expect(record.meters["gas"]).toEqual({ reading: "123" });
    expect(record.answers).toEqual({});
  });

  it("writes not accessible in words, never a blank", () => {
    expect(meterReadingText(layout, { notAccessible: true, reading: "5" })).toBe(layout.notAccessibleLabel);
  });

  it("finds meter photos by slot and lists what is missing", () => {
    const record = coerceHandover({ extraMeters: [{ id: "oil", label: "Oil tank" }] });
    expect(meterSlots(layout, record)).toHaveLength(4);
    expect(meterPhotoFor(layout, workflow.roleField, [meterPhoto], "gas")?.id).toBe("m1");
    const missing = handoverMissing(layout, workflow.roleField, record, [meterPhoto]);
    expect(missing).toContain("Electric meter: no photo");
    expect(missing).not.toContain("Gas meter: no photo");
  });

  it("never returns a meter guess below the threshold or when malformed", () => {
    expect(coerceMeterSuggestion({ reading: "01234.5", confidence: 0.9 }, 0.6).reading).toBe("01234.5");
    expect(coerceMeterSuggestion({ reading: "01234", confidence: 0.4 }, 0.6).reading).toBeNull();
    expect(coerceMeterSuggestion({ reading: "about 1200", confidence: 0.9 }, 0.6).reading).toBeNull();
    expect(coerceMeterSuggestion("nope", 0.6).reading).toBeNull();
  });
});
