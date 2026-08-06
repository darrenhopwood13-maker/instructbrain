import { describe, expect, it } from "vitest";
import {
  NOT_ASSESSED_ID,
  resolveStatus,
  statusesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { selectDistributionFindings, distributionRefs } from "@/lib/distribution";
import { detachPhoto, nextRef } from "@/lib/finding-refs";
import { findings, prePlasterSnapshot } from "@/lib/mock-data";

describe("status coercion", () => {
  const malformed: unknown[] = [
    undefined,
    null,
    "",
    "   ",
    "PASS",
    "pass",
    "ok",
    "intact",
    0,
    1,
    true,
    {},
    [],
    NaN,
    { id: "compliant" },
    "compliant-ish",
  ];

  it("resolves every malformed value to not_assessed", () => {
    for (const value of malformed) {
      const status = resolveStatus(prePlasterSnapshot, value);
      expect(status.id).toBe(NOT_ASSESSED_ID);
      expect(status.tone).not.toBe("pass");
    }
  });

  it("never resolves an unknown value to a passing status", () => {
    for (const value of malformed) {
      expect(resolveStatus(prePlasterSnapshot, value).tone).not.toBe("pass");
    }
  });

  it("resolves a defined status id", () => {
    expect(resolveStatus(prePlasterSnapshot, "compliant").tone).toBe("pass");
    expect(resolveStatus(prePlasterSnapshot, "defective").tone).toBe("fail");
  });

  it("guarantees not_assessed exists even when the definition omits it", () => {
    const broken = {
      id: "x",
      name: "Broken",
      version: 1,
      statuses: [{ id: "good", label: "Good", tone: "pass" }],
    } as SurveyTypeSnapshot;
    expect(statusesOf(broken).some((s) => s.id === NOT_ASSESSED_ID)).toBe(true);
    expect(resolveStatus(broken, "explodes").id).toBe(NOT_ASSESSED_ID);
  });

  it("handles a null or malformed snapshot", () => {
    expect(resolveStatus(null, "compliant").id).toBe(NOT_ASSESSED_ID);
    expect(resolveStatus({} as SurveyTypeSnapshot, "compliant").id).toBe(NOT_ASSESSED_ID);
  });

  it("forces not_assessed to the unknown tone even if a definition lies", () => {
    const lying = {
      id: "y",
      name: "Lying",
      version: 1,
      statuses: [{ id: NOT_ASSESSED_ID, label: "Not assessed", tone: "pass" }],
    } as unknown as SurveyTypeSnapshot;
    expect(resolveStatus(lying, NOT_ASSESSED_ID).tone).toBe("unknown");
  });
});

describe("confidential exclusion", () => {
  it("never returns a confidential finding for distribution", () => {
    const selected = selectDistributionFindings(findings);
    expect(findings.some((f) => f.isConfidential)).toBe(true);
    expect(selected.every((f) => !f.isConfidential)).toBe(true);
  });

  it("excludes confidential findings from a per-trade extract", () => {
    const refs = distributionRefs(findings, "Structures");
    const confidentialRefs = findings.filter((f) => f.isConfidential).map((f) => f.ref);
    for (const ref of confidentialRefs) expect(refs).not.toContain(ref);
  });
});

describe("reference stability", () => {
  it("deleting a photo does not change any finding ref", () => {
    const before = findings.map((f) => f.ref);
    const after = detachPhoto(findings, "ph-12").map((f) => f.ref);
    expect(after).toEqual(before);
  });

  it("detaches only the deleted photo", () => {
    const result = detachPhoto(findings, "ph-12");
    expect(result.every((f) => !f.photoIds.includes("ph-12"))).toBe(true);
    expect(result[0]?.photoIds).toContain("ph-11");
  });

  it("new refs continue from the highest issued ref, not the array length", () => {
    const remaining = findings.slice(0, 2).map((f) => f.ref);
    expect(nextRef(findings.map((f) => f.ref))).toBe("F-007");
    expect(nextRef([...remaining, "F-006"])).toBe("F-007");
  });
});
