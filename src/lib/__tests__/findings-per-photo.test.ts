import { describe, expect, it } from "vitest";
import { coerceBrief, EMPTY_BRIEF, findingsPerPhotoById } from "@/lib/report/brief";
import { allowsMultipleFindingsPerPhoto } from "@/lib/survey-types";
import { draftsFromEnvelope, type Envelope } from "@/lib/ai/observation";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";

const multiDefinition = systemDefinitions.find(
  (definition) => snapshotOf(definition).findingsPerPhoto === "multiple",
);
const multiSnapshot = snapshotOf(multiDefinition!);

const options = { confidenceThreshold: 0.6, tradeConfidenceThreshold: 0.7, tier: "triage" as const };

function observation(text: string) {
  return {
    status: multiSnapshot.statuses.find((status) => status.id !== "not_assessed")!.id,
    description: text,
    confidence: 0.9,
    involves_person: false,
  } as unknown as Envelope["observations"][number];
}

describe("findings per photograph brief option", () => {
  it("only recognises the explicit one-per-photo value", () => {
    expect(findingsPerPhotoById("one")).toBe("one");
    expect(findingsPerPhotoById("anything else")).toBe("template");
    expect(findingsPerPhotoById(null)).toBe("template");
    expect(EMPTY_BRIEF.findingsPerPhoto).toBe("template");
    expect(coerceBrief({ findingsPerPhoto: "one" })?.findingsPerPhoto).toBe("one");
    expect(coerceBrief({})?.findingsPerPhoto).toBe("template");
  });

  it("can only tighten a multi-finding template, never loosen a single-finding one", () => {
    expect(allowsMultipleFindingsPerPhoto(multiSnapshot)).toBe(true);
    expect(allowsMultipleFindingsPerPhoto(multiSnapshot, { findingsPerPhoto: "one" })).toBe(false);
    const single = { ...multiSnapshot, findingsPerPhoto: "single" as const };
    expect(allowsMultipleFindingsPerPhoto(single, { findingsPerPhoto: "template" })).toBe(false);
  });

  it("marks the photograph not assessed when the model ignores one-per-photo", () => {
    const envelope = {
      assessable: true,
      abstain_reason: null,
      observations: [observation("first item"), observation("second item")],
    } as unknown as Envelope;

    const loose = draftsFromEnvelope(envelope, multiSnapshot, options);
    expect(loose).toHaveLength(2);

    const tight = draftsFromEnvelope(envelope, multiSnapshot, options, {
      findingsPerPhoto: "one",
    });
    expect(tight).toHaveLength(1);
    expect(tight[0]?.status).toBe("not_assessed");
  });
});
