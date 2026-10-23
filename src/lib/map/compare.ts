import type { DashboardItem } from "@/lib/analytics/item-map";
import { daysLate, stateOf } from "@/lib/analytics/item-map";

/**
 * Plain-English comparison over the items already on the map.
 *
 * There is no language model in here, and that is deliberate. Every group the reader names is
 * matched against values that actually exist in their data, and every number is counted from the
 * same findings the dashboard uses. A model that "understands" a query it cannot answer would
 * invent a trade that does not exist and a cycle time to go with it; this cannot.
 *
 * What it understands: trades, projects, severity, hazard category, survey type and month - and
 * "vs", "versus", "against" or "compared to" between two sides. It matches on stems, so
 * "electrics", "electrician" and "Electrical" all land on the same group.
 */

export type CompareDimension = "trade" | "project" | "severity" | "hazard" | "survey" | "month";

export type CompareGroup = {
  key: string;
  label: string;
  raised: number;
  open: number;
  overdue: number;
  lateShare: number | null;
  medianDaysToClose: number | null;
  medianDaysLate: number | null;
  topTrade: string | null;
};

export type Comparison = {
  dimension: CompareDimension;
  dimensionLabel: string;
  groups: CompareGroup[];
  /** Words the reader used that matched nothing in their data. */
  unmatched: string[];
  /** True when only one side was named, so the other side is "everything else". */
  againstRest: boolean;
  verdict: string;
  caveat: string;
};

const DIMENSION_LABEL: Record<CompareDimension, string> = {
  trade: "Trade",
  project: "Project",
  severity: "Severity",
  hazard: "Hazard",
  survey: "Survey",
  month: "Month",
};

const SEVERITY_ORDER = ["high", "medium", "low"];

/** Words that name the thing being compared. If one is present, that dimension wins outright. */
const DIMENSION_HINTS: Record<CompareDimension, string[]> = {
  trade: ["trade", "trades", "subcontractor", "subcontractors", "package", "packages", "contractor"],
  project: ["project", "projects", "site", "sites", "job", "jobs"],
  severity: ["severity", "severities", "serious"],
  hazard: ["hazard", "hazards", "category", "categories"],
  survey: ["survey", "surveys", "report", "reports"],
  month: ["month", "months"],
};

/** Words that carry no meaning when matching a group name. */
const FILLER = new Set([
  "a",
  "across",
  "against",
  "all",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "between",
  "by",
  "can",
  "compare",
  "compared",
  "comparing",
  "do",
  "does",
  "for",
  "from",
  "give",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "more",
  "most",
  "my",
  "of",
  "on",
  "or",
  "other",
  "our",
  "show",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "to",
  "us",
  "versus",
  "vs",
  "was",
  "we",
  "what",
  "which",
  "who",
  "with",
  "work",
  "works",
]);

const SPLITTERS = /\s+(?:vs\.?|versus|against|compared\s+to|compared\s+with|or)\s+/i;

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s&+/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Crude but useful stemming: drop plural and trade-suffix noise so "electrics" finds "Electrical". */
function stem(word: string): string {
  let w = word;
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
  if (w.length > 6 && w.endsWith("ing")) w = w.slice(0, -3);
  if (w.length > 5 && w.endsWith("er")) w = w.slice(0, -2);
  return w;
}

function monthKey(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [year = "", month = ""] = key.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  return `${names[index] ?? month} ${year.slice(2)}`;
}

function titleCase(value: string): string {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  if (lower === undefined || upper === undefined) return null;
  return Math.round((lower + upper) / 2);
}

/** Every distinct value a dimension can take, taken from the reader's own items. */
function searchableValues(dimension: CompareDimension, items: DashboardItem[]): string[] {
  const seen = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    const clean = value.trim();
    if (clean) seen.add(clean);
  };

  for (const item of items) {
    switch (dimension) {
      case "trade":
        add(item.assignedTrade);
        break;
      case "project":
        add(item.projectName);
        add(item.projectAddress);
        break;
      case "severity":
        add(item.severity);
        break;
      case "hazard": {
        add(item.hazardCategory);
        break;
      }
      case "survey":
        add(item.surveyLabel);
        break;
      case "month":
        {
          const key = monthKey(item.createdAt ?? item.reportDate);
          if (key) add(key);
        }
        break;
    }
  }

  const values = [...seen];
  if (dimension === "severity") {
    return values.sort(
      (a, b) => SEVERITY_ORDER.indexOf(normalise(a)) - SEVERITY_ORDER.indexOf(normalise(b)),
    );
  }
  return values.sort((a, b) => a.localeCompare(b));
}

export function groupLabelFor(dimension: CompareDimension, value: string): string {
  if (dimension === "month") return monthLabel(value);
  if (dimension === "hazard") return titleCase(value);
  if (dimension === "severity") return titleCase(value);
  return value;
}

/** Two words are the same thing if one starts the other, or they share five leading letters. */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // Never match on a fragment: this is what made "&" match everything before.
  if (a.length < 3 || b.length < 3) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;

  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1;
  return shared >= 5;
}

function matchesValue(value: string, term: string): boolean {
  const haystack = normalise(value);
  const needle = normalise(term);
  if (!needle || !haystack) return false;
  if (haystack === needle) return true;

  const hayStems = haystack.split(" ").map(stem);
  const needleStems = needle.split(" ").map(stem).filter((word) => word.length > 2);
  if (needleStems.length === 0) return false;

  // Every word the reader typed has to land somewhere in the value.
  return needleStems.every((needleStem) => hayStems.some((hay) => tokenMatch(hay, needleStem)));
}

function scoreDimension(dimension: CompareDimension, terms: string[], items: DashboardItem[]) {
  const values = searchableValues(dimension, items);
  const hits = new Set<string>();
  let weight = 0;
  for (const term of terms) {
    for (const value of values) {
      if (!matchesValue(value, term)) continue;
      // A whole-value match ("high" against the severity "high") is worth far more than a
      // word that merely appears inside a longer name ("High Street").
      const exact = normalise(value) === normalise(term);
      weight += exact ? 3 : 1;
      hits.add(value);
    }
  }
  return { dimension, values, hits: [...hits], weight };
}

function groupKey(item: DashboardItem, dimension: CompareDimension): string | null {
  switch (dimension) {
    case "trade":
      return item.assignedTrade?.trim() || null;
    case "project":
      return item.projectName?.trim() || null;
    case "severity":
      return item.severity?.trim() || null;
    case "hazard":
      return item.hazardCategory?.trim() || null;
    case "survey":
      return item.surveyLabel?.trim() || null;
    case "month":
      return monthKey(item.createdAt ?? item.reportDate);
  }
}

function belongsTo(item: DashboardItem, dimension: CompareDimension, target: string): boolean {
  const key = groupKey(item, dimension);
  if (dimension === "project") {
    return matchesValue(item.projectName ?? "", target) || matchesValue(item.projectAddress ?? "", target);
  }
  return key !== null && matchesValue(key, target);
}

/** The real value behind what the reader typed - a town can resolve to a project's own name. */
function resolveKey(
  items: DashboardItem[],
  dimension: CompareDimension,
  target: string,
): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = groupKey(item, dimension);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return best ?? target;
}

function summarise(key: string, label: string, items: DashboardItem[], today: string): CompareGroup {
  let open = 0;
  let overdue = 0;
  let closed = 0;
  const lateDays: number[] = [];
  const closeDays: number[] = [];
  const trades = new Map<string, number>();

  for (const item of items) {
    const state = stateOf(item, today);
    if (state === "closed") {
      closed += 1;
      if (item.closedAt) {
        const raised = item.createdAt ?? item.reportDate;
        if (raised) {
          const from = Date.parse(raised.length === 10 ? `${raised}T00:00:00Z` : raised);
          const to = Date.parse(item.closedAt);
          if (!Number.isNaN(from) && !Number.isNaN(to) && to >= from) {
            closeDays.push(Math.round((to - from) / 86_400_000));
          }
        }
      }
      continue;
    }

    open += 1;
    if (state === "overdue") {
      overdue += 1;
      const late = daysLate(item, today);
      if (late !== null) lateDays.push(late);
    }
    if (item.assignedTrade) {
      const trade = item.assignedTrade.trim();
      trades.set(trade, (trades.get(trade) ?? 0) + 1);
    }
  }

  const topTrade =
    trades.size > 0 ? ([...trades.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) : null;

  return {
    key,
    label,
    raised: items.length,
    open,
    overdue,
    lateShare: open > 0 ? Math.round((overdue / open) * 100) : null,
    medianDaysToClose: median(closeDays),
    medianDaysLate: median(lateDays),
    topTrade: closed > 0 || open > 0 ? topTrade : null,
  };
}

function describeDays(days: number): string {
  if (days === 0) return "the same day it is raised";
  return `in a median ${days} ${days === 1 ? "day" : "days"}`;
}

function verdictFor(groups: CompareGroup[], dimension: CompareDimension): string {
  const [first, second] = groups;
  if (!first || !second) return "";
  if (first.raised === 0 && second.raised === 0) return "Neither side has any items in scope.";

  const parts: string[] = [];
  const closeFirst = first.medianDaysToClose;
  const closeSecond = second.medianDaysToClose;

  if (closeFirst !== null && closeSecond !== null) {
    const faster = closeFirst <= closeSecond ? first : second;
    const slower = faster === first ? second : first;
    const fasterDays = Math.min(closeFirst, closeSecond);
    const slowerDays = Math.max(closeFirst, closeSecond);
    const gap = slowerDays - fasterDays;
    parts.push(
      gap === 0
        ? `${first.label} and ${second.label} both close ${describeDays(fasterDays)}.`
        : `${faster.label} closes ${describeDays(fasterDays)}, ${gap} ${gap === 1 ? "day" : "days"} quicker than ${slower.label}, which takes ${describeDays(slowerDays)}.`,
    );
  } else if (closeFirst !== null || closeSecond !== null) {
    const known = closeFirst !== null ? first : second;
    const unknown = known === first ? second : first;
    parts.push(
      `${known.label} closes ${describeDays(known.medianDaysToClose ?? 0)}; ${unknown.label} has nothing closed yet to measure.`,
    );
  }

  const lateFirst = first.lateShare;
  const lateSecond = second.lateShare;
  if (lateFirst !== null && lateSecond !== null) {
    if (lateFirst === lateSecond) {
      parts.push(`Both carry ${lateFirst}% of their open work past its date.`);
    } else {
      const worse = lateFirst > lateSecond ? first : second;
      const better = worse === first ? second : first;
      parts.push(
        `${worse.label} is the one to watch - ${worse.lateShare}% of what is open is past its date, against ${better.lateShare}% for ${better.label}.`,
      );
    }
  }

  if (parts.length === 0) {
    parts.push(
      `${first.label} has ${first.raised} items on record, ${second.label} has ${second.raised}${dimension === "trade" ? "" : ""}.`,
    );
  }

  return parts.join(" ");
}

/**
 * Read a plain-English comparison request and turn it into measured groups.
 *
 * Falls back to the dimension that matched most, and if nothing at all matched it returns null so
 * the screen can say "nothing here matches that" rather than comparing something else quietly.
 */
export function parseComparison(
  query: string,
  items: DashboardItem[],
  today: string,
): Comparison | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const sides = trimmed
    .split(SPLITTERS)
    .map((side) =>
      side
        .split(/[\s,]+/)
        .map((word) => word.replace(/[^A-Za-z0-9&+/'’-]/g, ""))
        .filter((word) => word.length > 0 && !FILLER.has(word.toLowerCase())),
    )
    .filter((words) => words.length > 0);

  const allTerms = sides.flat();
  if (allTerms.length === 0) return null;

  const hinted = (Object.keys(DIMENSION_HINTS) as CompareDimension[]).filter((dimension) =>
    DIMENSION_HINTS[dimension].some((hint) => allTerms.some((term) => term.toLowerCase() === hint)),
  );

  const scored = (["trade", "project", "severity", "hazard", "survey", "month"] as CompareDimension[])
    .map((dimension) => scoreDimension(dimension, allTerms, items))
    .filter((entry) => entry.hits.length > 0)
    // An explicit dimension word beats a coincidental name match every time.
    .sort((a, b) => {
      const aHint = hinted.includes(a.dimension) ? 1 : 0;
      const bHint = hinted.includes(b.dimension) ? 1 : 0;
      if (aHint !== bHint) return bHint - aHint;
      if (b.weight !== a.weight) return b.weight - a.weight;
      return b.hits.length - a.hits.length;
    });

  const best = scored[0];
  if (!best) return null;

  const dimension = best.dimension;
  const matched: string[] = [];
  const unmatched: string[] = [];
  const againstRest = sides.length < 2;

  for (const words of sides) {
    let found: string | null = null;
    for (const word of words) {
      const hit = best.values.find((value) => matchesValue(value, word));
      if (hit) {
        found = hit;
        break;
      }
    }
    if (!found) {
      unmatched.push(words.join(" "));
      continue;
    }
    const key = resolveKey(
      items.filter((item) => belongsTo(item, dimension, found ?? "")),
      dimension,
      found,
    );
    if (!matched.includes(key)) matched.push(key);
  }

  let groups: CompareGroup[];

  if (matched.length === 0) {
    // Words were used but none of them named anything that exists: say so rather than guess.
    return null;
  }

  // One side named (or one side named and the other not recognised): hold it against the rest,
  // and the unmatched words are reported rather than silently ignored.
  if (matched.length === 1) {
    const only = matched[0] ?? "";
    const inGroup = items.filter((item) => groupKey(item, dimension) === only);
    const rest = items.filter((item) => groupKey(item, dimension) !== only);
    groups = [
      summarise(only, groupLabelFor(dimension, only), inGroup, today),
      summarise("__rest__", "Everything else", rest, today),
    ];
  } else {
    groups = matched.slice(0, 4).map((key) => {
      const groupItems = items.filter((item) => groupKey(item, dimension) === key);
      return summarise(key, groupLabelFor(dimension, key), groupItems, today);
    });
  }

  if (groups.length === 0) return null;

  return {
    dimension,
    dimensionLabel: DIMENSION_LABEL[dimension],
    groups,
    unmatched,
    againstRest: matched.length === 1 || againstRest,
    verdict: verdictFor(groups, dimension),
    caveat:
      "Counted from the findings on this map, using the same overdue rule as the dashboard. Cycle time only includes items with a recorded close date.",
  };
}

/** Example questions, offered as chips so the box is discoverable rather than a blank guess. */
export function compareSuggestions(items: DashboardItem[]): string[] {
  const busiest = (dimension: CompareDimension) => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = groupKey(item, dimension);
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
  };

  const trades = busiest("trade");
  const projects = busiest("project");
  const suggestions: string[] = [];

  if (trades.length >= 2) suggestions.push(`${trades[0]} vs ${trades[1]}`);
  if (projects.length >= 2) suggestions.push(`${projects[0]} vs ${projects[1]}`);
  suggestions.push("high vs medium severity");
  if (trades.length >= 1) suggestions.push(`${trades[0]} vs everything else`);

  return suggestions.slice(0, 4);
}
