import { stateOf, type DashboardItem } from "@/lib/analytics/item-map";
import type { ProjectPoint } from "@/lib/map/project-points.functions";

/**
 * Turning the app's own item list into per-project counts for the map.
 *
 * The overdue figure is not recomputed here: it comes from `stateOf`, the same
 * function the dashboard ledger and the control room read. That is deliberate - a map
 * saying 29 past their date beside a dashboard saying 31 is the kind of disagreement
 * that makes people stop trusting both. One definition, three surfaces.
 */

export type ProjectCounts = {
  /** Items on record for this project, closed or not. */
  items: number;
  /** Items the dashboard would call overdue: still open, target date passed. */
  overdue: number;
  /** Items still open (everything that is not closed out). */
  open: number;
  /** Most recent report date seen for the project, yyyy-mm-dd, or null. */
  lastReportDate: string | null;
};

export function countsByProject(items: DashboardItem[], today: string): Map<string, ProjectCounts> {
  const counts = new Map<string, ProjectCounts>();
  for (const item of items) {
    if (!item.projectId) continue;
    const state = stateOf(item, today);
    const current =
      counts.get(item.projectId) ??
      ({ items: 0, overdue: 0, open: 0, lastReportDate: null } satisfies ProjectCounts);

    current.items += 1;
    if (state === "overdue") current.overdue += 1;
    if (state !== "closed") current.open += 1;

    const reportDate = item.reportDate ?? null;
    if (reportDate && (current.lastReportDate === null || reportDate > current.lastReportDate)) {
      current.lastReportDate = reportDate;
    }
    counts.set(item.projectId, current);
  }
  return counts;
}

export type MapTotals = {
  projects: number;
  pinned: number;
  /** Projects whose address carries no postcode, so they cannot be placed. */
  noAddress: number;
  /** Projects placed only to their outward code - a district, not a building. */
  outcodeOnly: number;
  items: number;
  overdue: number;
};

export function mapTotals(points: ProjectPoint[], counts: Map<string, ProjectCounts>): MapTotals {
  const totals: MapTotals = {
    projects: points.length,
    pinned: 0,
    noAddress: 0,
    outcodeOnly: 0,
    items: 0,
    overdue: 0,
  };
  for (const point of points) {
    if (point.pinned) {
      totals.pinned += 1;
      if (point.precision === "outcode") totals.outcodeOnly += 1;
    } else {
      totals.noAddress += 1;
    }
    const c = counts.get(point.projectId);
    if (c) {
      totals.items += c.items;
      totals.overdue += c.overdue;
    }
  }
  return totals;
}

/**
 * The sentences the screen is allowed to say about its own completeness.
 *
 * Returns lines rather than booleans so the caveat is written once, here, and cannot
 * drift into three slightly different phrasings on three surfaces.
 */
export function mapCaveats(totals: MapTotals): string[] {
  const lines: string[] = [];
  if (totals.noAddress > 0) {
    lines.push(
      `${totals.noAddress} of ${totals.projects} projects ${totals.noAddress === 1 ? "has" : "have"} no postcode on the address, so ${totals.noAddress === 1 ? "it is" : "they are"} counted here but not placed on the map.`,
    );
  }
  if (totals.outcodeOnly > 0) {
    lines.push(
      `${totals.outcodeOnly} ${totals.outcodeOnly === 1 ? "project is" : "projects are"} placed to the postcode district only - the pin shows the area, not the gate.`,
    );
  }
  return lines;
}
