import { describe, expect, it } from "vitest";
import { getDefinition } from "@/lib/survey-definitions";
import { aiCaptureFieldsOf } from "@/lib/survey-types";
import { envelopeJsonSchema, parseEnvelope, toDraftFinding } from "@/lib/ai/observation";
import { shortItemLabel } from "@/lib/report/inventory-layout";

const inventory = getDefinition("property_inventory")!;
const opts = { confidenceThreshold: 0.6, tradeConfidenceThreshold: 0.6, tier: "t" };

describe("inventory item labels (v6)", () => {
  it("declares a short AI item field", () => {
    expect(inventory.version).toBeGreaterThanOrEqual(6);
    expect(aiCaptureFieldsOf(inventory).map((f) => f.id)).toEqual(["item"]);
    const schema = envelopeJsonSchema(inventory) as any;
    expect(schema.properties.observations.items.properties.capture_fields).toBeTruthy();
  });

  it("keeps declared ids, drops unknown and blank", () => {
    const status = inventory.statuses!.find((s: any) => s.id !== "not_assessed")!.id;
    const env = parseEnvelope({
      observations: [{ status, confidence: 0.9, finding: "Oak table", capture_fields: { item: " Dining table ", colour: "red", other: "" } }],
    });
    const draft = toDraftFinding(env.observations[0]!, inventory, opts);
    expect(draft.ai_capture_fields).toEqual({ item: "Dining table" });
    const blank = parseEnvelope({ observations: [{ status, confidence: 0.9, capture_fields: { item: "  " } }] });
    expect(toDraftFinding(blank.observations[0]!, inventory, opts).ai_capture_fields).toBeUndefined();
  });

  it("drops AI labels on not-assessed findings", () => {
    const env = parseEnvelope({ observations: [{ status: "pass", confidence: 0.1, capture_fields: { item: "Sofa" } }] });
    expect(toDraftFinding(env.observations[0]!, inventory, opts).ai_capture_fields).toBeUndefined();
  });

  it("derives a short fallback label with no ellipsis", () => {
    expect(shortItemLabel("Oak dining table, approximately 1.8m, seats six.")).toBe("Oak dining table");
    const long = shortItemLabel("Freestanding double wardrobe with mirrored sliding doors and chrome handles");
    expect(long.length).toBeLessThanOrEqual(30);
    expect(long).not.toMatch(/\.\.\.|…/);
  });
});
