import { describe, expect, it } from "vitest";
import { countsByProject, mapCaveats, mapTotals } from "@/lib/map/summary";
import type { DashboardItem } from "@/lib/analytics/item-map";
import type { ProjectPoint } from "@/lib/map/project-points.functions";

const TODAY = "2026-10-23";

function item(over: Partial<DashboardItem> & { id: string }): DashboardItem {
  return {
    ref: null,
    title: null,
    status: null,
    lifecycleState: null,
    severity: null,
    dueDate: null,
    createdAt: "2026-10-01",
    assignedTrade: null,
    reportId: "r1",
    reportRef: null,
    reportTitle: null,
    reportDate: "2026-10-16",
    surveyLabel: null,
    projectId: "p1",
    projectName: "Project one",
    projectRef: null,
    ...over,
  };
}

function point(over: Partial<ProjectPoint> & { projectId: string }): ProjectPoint {
  return {
    name: "Project one",
    address: "11-13 Bruton Street, London, W1J 6JH",
    latitude: 51.510721,
    longitude: -0.143776,
    locationLabel: "W1J 6JH, Westminster",
    precision: "postcode",
    pinned: true,
    ...over,
  };
}

describe("countsByProject", () => {
  it("counts items and open items per project, ignoring items with no project", () => {
    const counts = countsByProject(
      [
        item({ id: "a", lifecycleState: "open" }),
        item({ id: "b", lifecycleState: "verified" }),
        item({ id: "c", lifecycleState: "open", projectId: "p2" }),
        item({ id: "d", lifecycleState: "open", projectId: null }),
      ],
      TODAY,
    );

    expect(counts.get("p1")).toMatchObject({ items: 2, open: 1 });
    expect(counts.get("p2")).toMatchObject({ items: 1, open: 1 });
    expect(counts.size).toBe(2);
  });

  it("uses the dashboard's own definition of overdue: open with a passed target date", () => {
    const counts = countsByProject(
      [
        item({ id: "past", lifecycleState: "open", dueDate: "2026-10-01" }),
        item({ id: "future", lifecycleState: "open", dueDate: "2026-12-01" }),
        item({ id: "closed-late", lifecycleState: "verified", dueDate: "2026-10-01" }),
        item({ id: "undated", lifecycleState: "open", dueDate: null }),
      ],
      TODAY,
    );

    // Closed out late is not overdue any more; an item with no date cannot be late.
    // Three of the four are still open; the verified one is closed.
    expect(counts.get("p1")).toMatchObject({ items: 4, overdue: 1, open: 3 });
  });

  it("keeps the latest report date seen for the project", () => {
    const counts = countsByProject(
      [
        item({ id: "a", reportDate: "2026-09-01" }),
        item({ id: "b", reportDate: "2026-10-16" }),
        item({ id: "c", reportDate: "2026-09-20" }),
      ],
      TODAY,
    );
    expect(counts.get("p1")?.lastReportDate).toBe("2026-10-16");
  });
});

describe("mapTotals", () => {
  it("counts pinned, unplaceable and district-only projects separately", () => {
    const points = [
      point({ projectId: "p1" }),
      point({ projectId: "p2", precision: "outcode", locationLabel: "N1, Hackney" }),
      point({ projectId: "p3", pinned: false, latitude: null, longitude: null, precision: null }),
    ];
    const counts = countsByProject(
      [
        item({ id: "a", projectId: "p1", dueDate: "2026-10-01", lifecycleState: "open" }),
        item({ id: "b", projectId: "p2" }),
      ],
      TODAY,
    );

    expect(mapTotals(points, counts)).toEqual({
      projects: 3,
      pinned: 2,
      noAddress: 1,
      outcodeOnly: 1,
      items: 2,
      overdue: 1,
    });
  });

  it("adds nothing for a project that has no items at all", () => {
    const totals = mapTotals([point({ projectId: "empty" })], new Map());
    expect(totals.items).toBe(0);
    expect(totals.overdue).toBe(0);
  });
});

describe("mapCaveats", () => {
  it("says nothing when every project is placed precisely", () => {
    const totals = mapTotals([point({ projectId: "p1" })], new Map());
    expect(mapCaveats(totals)).toEqual([]);
  });

  it("names the unplaceable projects rather than dropping them silently", () => {
    const totals = mapTotals(
      [point({ projectId: "p1" }), point({ projectId: "p2", pinned: false, latitude: null, longitude: null, precision: null })],
      new Map(),
    );
    const [line] = mapCaveats(totals);
    expect(line).toContain("1 of 2 projects");
    expect(line).toContain("not placed on the map");
  });

  it("admits when a pin is only a district", () => {
    const totals = mapTotals([point({ projectId: "p1", precision: "outcode" })], new Map());
    expect(mapCaveats(totals).join(" ")).toContain("postcode district only");
  });
});
