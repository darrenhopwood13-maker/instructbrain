/**
 * The urgency ladder: one grouping that every template's severity can be read on.
 *
 * The problem this solves is real and measurable. Each template carries its own
 * severity scale, and those scales share no words: the electrical report says
 * "danger present", the snagging list says "cosmetic", the damp survey says
 * "mould with occupancy risk". A dashboard that pulls items from every template
 * at once therefore groups nothing - on 12 Oct 2026 the live account carried 20 of
 * 32 open items in "Not set" and the remaining 12 across nine different words.
 *
 * So the dashboard groups on urgency instead, on four rungs. The item keeps its
 * own words: nothing on a report changes, only the sorting on this one screen.
 *
 * THE MAPPING IS THE JUDGEMENT, AND IT IS ALL HERE. One line per severity the
 * product ships, so it can be read, argued with and changed. Two guards stop it
 * drifting:
 *   1. A test fails if a template ships a severity this table does not know, so a
 *      new template cannot quietly fall out of the chart.
 *   2. Where a template sets its own target time for a severity, a test checks the
 *      rung agrees with that time. The rungs are therefore not arbitrary: they are
 *      the product's own response times, collapsed into four.
 */
export type LadderStepId = "now" | "week" | "planned" | "record";

export type LadderStep = {
  id: LadderStepId;
  label: string;
  /** One plain sentence, shown to the reader when the row is open. */
  meaning: string;
  /**
   * The longest target time this rung may carry, in hours, taken from the
   * templates' own scales. `null` on the last rung because it claims no action.
   */
  withinHours: number | null;
};

/** Worst first. The order is fixed, so the chart cannot reorder itself. */
export const LADDER: readonly LadderStep[] = [
  {
    id: "now",
    label: "Do it now",
    meaning: "Danger or an imminent risk. Sort it before anything else.",
    withinHours: 8,
  },
  {
    id: "week",
    label: "This week",
    meaning: "Needs attention, but not an emergency.",
    withinHours: 120,
  },
  {
    id: "planned",
    label: "Planned in",
    meaning: "A proper repair that fits the programme.",
    withinHours: 336,
  },
  {
    id: "record",
    label: "Just a record",
    meaning: "A condition to watch. Nothing to do.",
    withinHours: null,
  },
];

/**
 * Every severity in the product, worst first within its own template, with the
 * rung it sits on. The comment above each block is the template and its own target
 * times, so the reasoning can be checked against the template rather than taken on
 * trust.
 */
const STEP_OF: Record<string, LadderStepId> = {
  // Site condition - 0 / 8 / 120 / 168 hours.
  immediate: "now", // "Imminent risk of serious harm. Work stops now."
  same_day: "now", // "Significant hazard. Rectify before end of shift." (8h)
  this_week: "week", // "Requires action but not an immediate risk." (120h)
  housekeeping: "planned", // "Tidiness... rectify in normal course of work." (168h)

  // Electrical installation condition - 0 / 24 / 336 hours, plus FI.
  danger_present: "now", // "Risk of shock, burn or fire. Isolate and make safe now." (0h)
  potentially_dangerous: "week", // "Could become unsafe in service. Attend urgently." (24h)
  further_investigation: "week", // cannot be judged from the evidence; the same urgency as C2
  improvement_item: "planned", // "Serviceable but short of good practice." (336h)

  // Mechanical & HVAC - 0 / 72 / 336 / 336 hours.
  leak_or_imminent_failure: "now", // "Water, gas or air loss visible or imminent." (0h)
  commissioning_risk: "week", // "Will prevent or delay commissioning." (72h)
  efficiency_loss: "planned", // "Will run, but output or efficiency is compromised." (336h)
  labelling_item: "planned", // "Identification, bracketing or tidiness." (336h)

  // Fit-out & finishes quality - 168 / 168 / 336 / 336 hours.
  prominent_area: "planned", // "Client-facing or high-traffic. Rectify before handover." (168h)
  specification_difference: "planned", // "Material, colour or component differs." (168h)
  interface_unresolved: "planned", // "The junction between two packages is not closed out." (336h)
  visual_minor: "planned", // "Appearance only." - and the template gives it a 336h target

  // Damp, mould & water ingress - 24 / 72 / 168 / 336 hours.
  occupancy_risk: "week", // "Visible mould in an occupied space. Escalate." (24h)
  widespread_moisture: "week", // "A substantial area is affected." (72h)
  localised_ingress: "planned", // "Moisture at a single identifiable point." (168h)
  surface_marking: "planned", // "Discolouration only." - and the template gives it a 336h target

  // Weatherproofing membrane - no target times, so the rungs follow its wording.
  critical: "now", // "Immediate action. Escalate same day."
  high: "week", // "Active or imminent water ingress risk. Prioritise."
  medium: "planned", // "Localised defect. Schedule within current programme."
  low: "record", // "Cosmetic or minor wear. No immediate risk."

  // Snagging - no target times, so the rungs follow its wording.
  structural_safety: "now", // "Potential risk to structure or to persons. Escalate immediately."
  compliance: "week", // "May not satisfy Building Regulations. Escalate for verification."
  performance: "planned", // "Affects durability, weathertightness, thermal or acoustic performance."
  workmanship: "planned", // "Below the expected standard. Rectify before handover."
  cosmetic: "record", // "Appearance only. No performance or compliance consequence."
};

/** Every severity id this ladder knows about. Used by the coverage test. */
export const LADDER_KNOWN_SEVERITIES: readonly string[] = Object.keys(STEP_OF);

/** The rung a stored severity sits on, or null when it is not one we know. */
export function ladderStepFor(severity: string | null | undefined): LadderStep | null {
  const key = (severity ?? "").trim();
  if (!key) return null;
  const id = STEP_OF[key];
  if (!id) return null;
  return LADDER.find((step) => step.id === id) ?? null;
}

/** The row key the severity axis groups on: a rung, or `unset` for the rest. */
export const LADDER_UNSET_KEY = "unset";

/**
 * Where a row sits in the chart. The rungs are fixed in order - worst first - so a
 * single dangerous item never sinks below a pile of cosmetic ones. Anything the
 * ladder cannot read sorts last, under its own heading, rather than being pushed
 * into a rung it did not earn.
 */
export function ladderRank(key: string): number {
  const index = LADDER.findIndex((step) => step.id === key);
  return index === -1 ? LADDER.length : index;
}
