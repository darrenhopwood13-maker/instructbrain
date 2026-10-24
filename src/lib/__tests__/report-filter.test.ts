import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  countActiveFilters,
  filterReports,
  filtersAreActive,
  surveyOptions,
  type ReportFilters,
} from "@/lib/reports/filter";
import type { RecentReport } from "@/lib/types";

const NOW = new Date("2026-10-24T12:00:00.000Z");

function report(partial: Partial<RecentReport>): RecentReport {
  return {
    id: "r1",
    title: "Report",
    reference: "REF-1",
    status: "draft",
    updated: "24 October 2026",
    updatedAt: "2026-10-24T09:00:00.000Z",
    projectId: null,
    isQuick: false,
    surveyLabel: null,
    ...partial,
  };
}

const site = report({
  id: "site",
  title: "Block C snagging",
  reference: "SNG-2026-10-001",
  status: "issued",
  projectId: "p1",
  surveyLabel: "Finding identification & remedial schedule",
  updatedAt: "2026-10-20T09:00:00.000Z",
});
const fire = report({
  id: "fire",
  title: "Fire door check",
  reference: "RPT-2026-10-004",
  status: "in_review",
  projectId: "p2",
  surveyLabel: "Fire safety compliance check",
  updatedAt: "2026-08-01T09:00:00.000Z",
});
const quick = report({
  id: "quick",
  title: "Ad hoc walk round",
  reference: "No reference",
  status: "draft",
  isQuick: true,
  updatedAt: "2025-12-01T09:00:00.000Z",
});

const all = [site, fire, quick];

function withFilters(partial: Partial<ReportFilters>): ReportFilters {
  return { ...NO_FILTERS, ...partial };
}

const projectNames = new Map([
  ["p1", "Northbank Phase 3"],
  ["p2", "Albert Dock Conversion"],
]);

describe("filtering the all-reports page", () => {
  it("shows everything when nothing is set", () => {
    expect(filterReports(all, NO_FILTERS)).toHaveLength(3);
    expect(filtersAreActive(NO_FILTERS)).toBe(false);
  });

  it("matches free text against title, reference, type and project name", () => {
    expect(filterReports(all, withFilters({ search: "fire door" })).map((r) => r.id)).toEqual(["fire"]);
    expect(filterReports(all, withFilters({ search: "sng-2026" })).map((r) => r.id)).toEqual(["site"]);
    expect(filterReports(all, withFilters({ search: "compliance" })).map((r) => r.id)).toEqual(["fire"]);
    expect(
      filterReports(all, withFilters({ search: "albert dock" }), { projectNameById: projectNames }).map(
        (r) => r.id,
      ),
    ).toEqual(["fire"]);
  });

  it("ignores case and surrounding spaces in the search", () => {
    expect(filterReports(all, withFilters({ search: "  FIRE  " })).map((r) => r.id)).toEqual(["fire"]);
  });

  it("narrows by status", () => {
    expect(filterReports(all, withFilters({ status: "issued" })).map((r) => r.id)).toEqual(["site"]);
    expect(filterReports(all, withFilters({ status: "in_review" })).map((r) => r.id)).toEqual(["fire"]);
    expect(filterReports(all, withFilters({ status: "draft" })).map((r) => r.id)).toEqual(["quick"]);
  });

  it("narrows by report type, and can single out reports that carry none", () => {
    expect(
      filterReports(all, withFilters({ survey: "Fire safety compliance check" })).map((r) => r.id),
    ).toEqual(["fire"]);
    expect(filterReports(all, withFilters({ survey: "" })).map((r) => r.id)).toEqual(["quick"]);
  });

  it("narrows by project, including reports that are on no project at all", () => {
    expect(filterReports(all, withFilters({ project: "p1" })).map((r) => r.id)).toEqual(["site"]);
    expect(filterReports(all, withFilters({ project: "none" })).map((r) => r.id)).toEqual(["quick"]);
  });

  it("narrows by when it was last worked on", () => {
    expect(filterReports(all, withFilters({ period: "7" }), { now: NOW }).map((r) => r.id)).toEqual([
      "site",
    ]);
    expect(filterReports(all, withFilters({ period: "90" }), { now: NOW }).map((r) => r.id)).toEqual([
      "site",
      "fire",
    ]);
    expect(filterReports(all, withFilters({ period: "365" }), { now: NOW }).map((r) => r.id)).toEqual([
      "site",
      "fire",
      "quick",
    ]);
  });

  it("leaves out a report that carries no machine-readable date rather than guessing", () => {
    const { updatedAt: _omitted, ...undated } = report({ id: "undated" });
    expect(filterReports([undated], withFilters({ period: "30" }), { now: NOW })).toHaveLength(0);
    expect(filterReports([undated], NO_FILTERS, { now: NOW })).toHaveLength(1);
  });

  it("combines filters, and keeps the incoming newest-first order", () => {
    const result = filterReports(
      all,
      withFilters({ status: "draft", period: "365", project: "none" }),
      { now: NOW },
    );
    expect(result.map((r) => r.id)).toEqual(["quick"]);

    const everything = filterReports(all, withFilters({ period: "365" }), { now: NOW });
    expect(everything.map((r) => r.id)).toEqual(["site", "fire", "quick"]);
  });

  it("counts what is narrowing the list, so the page can offer one clear", () => {
    expect(countActiveFilters(NO_FILTERS)).toBe(0);
    expect(countActiveFilters(withFilters({ search: "   " }))).toBe(0);
    expect(countActiveFilters(withFilters({ search: "door", status: "issued", period: "30" }))).toBe(3);
    expect(filtersAreActive(withFilters({ project: "none" }))).toBe(true);
  });

  it("lists the report types present, with a plain heading for the ones with none", () => {
    expect(surveyOptions(all)).toEqual([
      { value: "Finding identification & remedial schedule", label: "Finding identification & remedial schedule" },
      { value: "Fire safety compliance check", label: "Fire safety compliance check" },
      { value: "", label: "No report type" },
    ]);
  });
});
