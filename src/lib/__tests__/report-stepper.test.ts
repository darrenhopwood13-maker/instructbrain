import { describe, expect, it } from "vitest";
import { defaultStep, readyToIssue } from "@/components/report/report-stepper";

describe("report step derivation", () => {
  it("opens on photos with no findings", () => {
    expect(defaultStep({ hasFindings: false, unresolved: 0, issued: false })).toBe("photos");
  });
  it("opens on review while anything is unresolved", () => {
    expect(defaultStep({ hasFindings: true, unresolved: 3, issued: false })).toBe("review");
  });
  it("opens on issue once resolved, or when issued", () => {
    expect(defaultStep({ hasFindings: true, unresolved: 0, issued: false })).toBe("output");
    expect(defaultStep({ hasFindings: true, unresolved: 2, issued: true })).toBe("output");
  });
  it("not assessed or unconfirmed items block the continue prompt", () => {
    expect(readyToIssue({ hasFindings: true, unresolved: 1, issued: false })).toBe(false);
    expect(readyToIssue({ hasFindings: true, unresolved: 0, issued: false })).toBe(true);
  });
});
