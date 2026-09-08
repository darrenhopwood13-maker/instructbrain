import { describe, expect, it } from "vitest";
import { complianceProjectId } from "@/lib/compliance/destination";
import type { RecentReport } from "@/lib/types";

function report(partial: Partial<RecentReport>): RecentReport {
  return {
    id: "r1",
    title: "Report",
    reference: "REF",
    status: "draft",
    updated: "1 January 2026",
    projectId: null,
    isQuick: false,
    ...partial,
  };
}

describe("compliance destination", () => {
  it("follows the most recently touched project-backed report", () => {
    const recent = [
      report({ id: "a", projectId: null, isQuick: true }),
      report({ id: "b", projectId: "project-2" }),
      report({ id: "c", projectId: "project-3" }),
    ];
    expect(complianceProjectId(recent)).toBe("project-2");
  });

  it("returns null when only quick reports exist, so the caller can ask", () => {
    expect(complianceProjectId([report({ projectId: null, isQuick: true })])).toBeNull();
  });

  it("falls back to a known project rather than a dead end", () => {
    expect(complianceProjectId([], ["project-9"])).toBe("project-9");
  });

  it("returns null with nothing at all", () => {
    expect(complianceProjectId([], [])).toBeNull();
  });
});
