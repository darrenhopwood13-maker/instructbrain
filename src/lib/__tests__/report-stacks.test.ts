import { describe, expect, it } from "vitest";

import { NO_TYPE_LABEL, reportStacks, stackSummary } from "@/lib/reports/report-stacks";
import type { RecentReport } from "@/lib/types";

function report(partial: Partial<RecentReport>): RecentReport {
  return {
    id: "r1",
    title: "Report",
    reference: "REF",
    status: "draft",
    updated: "12 October 2026",
    projectId: null,
    isQuick: false,
    surveyLabel: null,
    ...partial,
  };
}

describe("the reports page, grouped by report type", () => {
  it("gives each type one stack, in the order its newest report appears", () => {
    const stacks = reportStacks([
      report({
        id: "a",
        surveyLabel: "Electrical installation condition",
        updated: "12 October 2026",
      }),
      report({
        id: "b",
        surveyLabel: "Snag identification & remedial schedule",
        updated: "11 October 2026",
      }),
      report({
        id: "c",
        surveyLabel: "Electrical installation condition",
        updated: "9 October 2026",
      }),
    ]);

    expect(stacks.map((stack) => stack.label)).toEqual([
      "Electrical installation condition",
      "Snag identification & remedial schedule",
    ]);
    expect(stacks[0]!.count).toBe(2);
    expect(stacks[0]!.reports.map((row) => row.id)).toEqual(["a", "c"]);
    expect(stacks[0]!.newest).toBe("12 October 2026");
  });

  it("counts what is still a draft without calling anything else a draft", () => {
    const stacks = reportStacks([
      report({ id: "a", surveyLabel: "Damp", status: "draft" }),
      report({ id: "b", surveyLabel: "Damp", status: "in_review" }),
      report({ id: "c", surveyLabel: "Damp", status: "issued" }),
    ]);
    expect(stacks[0]!.count).toBe(3);
    expect(stacks[0]!.drafts).toBe(1);
    expect(stackSummary(stacks[0]!)).toBe("3 reports · 1 draft · newest 12 October 2026");
  });

  it("files a report with no type of its own under a heading of its own", () => {
    const stacks = reportStacks([
      report({ id: "a", surveyLabel: "Damp" }),
      report({ id: "b", surveyLabel: null }),
    ]);
    const none = stacks.find((stack) => stack.label === NO_TYPE_LABEL)!;
    expect(none.count).toBe(1);
    expect(none.reports[0]!.id).toBe("b");
  });

  it("treats a blank label as no type at all, rather than a stack with no name", () => {
    const stacks = reportStacks([
      report({ id: "a", surveyLabel: "   " }),
      report({ id: "b", surveyLabel: null }),
    ]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]!.label).toBe(NO_TYPE_LABEL);
    expect(stacks[0]!.count).toBe(2);
  });

  it("reads one report as one report, not one reports", () => {
    const stacks = reportStacks([report({ id: "a", surveyLabel: "Damp", status: "issued" })]);
    expect(stackSummary(stacks[0]!)).toBe("1 report · newest 12 October 2026");
  });

  it("returns nothing for nothing, so the page can say so", () => {
    expect(reportStacks([])).toEqual([]);
  });
});
