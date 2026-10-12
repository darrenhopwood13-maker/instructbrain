import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import { breakdownOf } from "@/lib/analytics/control-room";
import {
  LADDER,
  LADDER_KNOWN_SEVERITIES,
  ladderRank,
  ladderStepFor,
} from "@/lib/analytics/severity-ladder";
import { systemDefinitions } from "@/lib/survey-definitions";

const TODAY = "2026-10-12";

function item(over: Partial<DashboardItem> = {}): DashboardItem {
  return {
    id: over.id ?? "i1",
    ref: null,
    title: null,
    status: null,
    lifecycleState: "open",
    severity: null,
    dueDate: null,
    createdAt: null,
    assignedTrade: null,
    reportId: "r1",
    reportRef: null,
    reportTitle: null,
    reportDate: null,
    surveyLabel: null,
    projectId: null,
    projectName: null,
    projectRef: null,
    ...over,
  };
}

describe("the urgency ladder covers what the product ships", () => {
  it("maps every severity in every template, so a new one cannot fall out of the chart", () => {
    const missing: string[] = [];
    for (const definition of systemDefinitions) {
      for (const severity of definition.severityScale ?? []) {
        if (!LADDER_KNOWN_SEVERITIES.includes(severity.id)) {
          missing.push(`${definition.id}/${severity.id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("agrees with the target time each template sets, wherever it sets one", () => {
    // The rungs are not invented: where a template says a severity is due in N
    // hours, the rung it sits on has to be able to carry that time. This is the
    // test that keeps "Do it now" meaning what the templates mean by it.
    const wrong: string[] = [];
    for (const definition of systemDefinitions) {
      for (const severity of definition.severityScale ?? []) {
        const hours = severity.targetHours;
        if (typeof hours !== "number") continue;
        const step = ladderStepFor(severity.id);
        if (!step || step.withinHours === null || hours > step.withinHours) {
          wrong.push(
            `${definition.id}/${severity.id} is due in ${hours}h but sits on ${step?.label ?? "no rung"}`,
          );
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("reads a severity it does not know as unknown, never as a guess", () => {
    expect(ladderStepFor("danger_present")?.id).toBe("now");
    expect(ladderStepFor("cosmetic")?.id).toBe("record");
    expect(ladderStepFor("housekeeping")?.id).toBe("planned");
    expect(ladderStepFor("further_investigation")?.id).toBe("week");
    expect(ladderStepFor(null)).toBeNull();
    expect(ladderStepFor("")).toBeNull();
    expect(ladderStepFor("  ")).toBeNull();
    expect(ladderStepFor("a_severity_retired_in_2024")).toBeNull();
  });
});

describe("the order of the rungs", () => {
  it("runs worst to best, with anything unreadable last", () => {
    expect(ladderRank("now")).toBe(0);
    expect(ladderRank("week")).toBe(1);
    expect(ladderRank("planned")).toBe(2);
    expect(ladderRank("record")).toBe(3);
    expect(ladderRank("unset")).toBe(LADDER.length);
    expect(ladderRank("something_else")).toBe(LADDER.length);
  });

  it("groups the severity axis onto the rungs, worst first, however many are in each", () => {
    const rows = breakdownOf(
      [
        item({ id: "a", severity: "cosmetic" }),
        item({ id: "b", severity: "cosmetic" }),
        item({ id: "c", severity: "cosmetic" }),
        item({ id: "d", severity: "danger_present" }),
        item({ id: "e", severity: null }),
        item({ id: "f", severity: null }),
      ],
      "severity",
      TODAY,
    );

    // Every rung is drawn, in order, even the empty ones - a scale with a missing
    // rung reads like a list. Three cosmetic items do not out-rank the dangerous
    // one, and unset cannot claim a rung it never earned.
    expect(rows.map((row) => row.label)).toEqual([
      "Do it now",
      "This week",
      "Planned in",
      "Just a record",
      "Not set",
    ]);
    expect(rows.map((row) => row.count)).toEqual([1, 0, 0, 3, 2]);
    expect(rows[1]!.meaning).toBe(LADDER[1]!.meaning);
    expect(rows[4]!.meaning).toBeNull();
  });

  it("leaves the unset row out when nothing is unset", () => {
    const rows = breakdownOf([item({ id: "a", severity: "cosmetic" })], "severity", TODAY);
    expect(rows.map((row) => row.label)).toEqual([
      "Do it now",
      "This week",
      "Planned in",
      "Just a record",
    ]);
    expect(rows.every((row) => row.count === 0 || row.key === "record")).toBe(true);
  });

  it("still orders the other axes by weight", () => {
    const rows = breakdownOf(
      [
        item({ id: "a", assignedTrade: "Electrical" }),
        item({ id: "b", assignedTrade: "Electrical" }),
        item({ id: "c", assignedTrade: "Groundworks" }),
      ],
      "trade",
      TODAY,
    );
    expect(rows.map((row) => row.label)).toEqual(["Electrical", "Groundworks"]);
  });
});
