/**
 * Weekly Compliance Register — check type definitions.
 *
 * This is DATA. A check type owns its own per-point fields; nothing here is
 * shared with the snagging engine, and no snagging vocabulary appears in it.
 * The register has exactly three outcomes and no severity scale.
 */

export const COMPLIANCE_STATUSES = [
  { id: "compliant", label: "Compliant", tone: "pass" as const },
  { id: "non_compliant", label: "Non-compliant", tone: "fail" as const },
  { id: "not_applicable", label: "Not applicable", tone: "neutral" as const },
];

export type ComplianceStatus = "compliant" | "non_compliant" | "not_applicable";

export function complianceStatusLabel(status: string): string {
  return COMPLIANCE_STATUSES.find((item) => item.id === status)?.label ?? "Not applicable";
}

export function complianceStatusTone(status: string): "pass" | "fail" | "neutral" {
  return COMPLIANCE_STATUSES.find((item) => item.id === status)?.tone ?? "neutral";
}

export type PointField = {
  id: string;
  label: string;
  type: "yesno" | "text" | "date" | "number";
  /** Present only for the unit types listed. Absent means: always ask. */
  onlyForUnitTypes?: string[];
  /** A "no" answer on these fields is what makes a point non-compliant. */
  compliance?: boolean;
  /** A "no" here forces non-compliant outright, whatever else is answered. */
  hardGate?: boolean;
  /** Date field filled in for you as another date field plus N days. */
  dueFromField?: string;
  dueAfterDays?: number;
  hint?: string;
};

export type CheckTypeDefinition = {
  id: string;
  label: string;
  /** Fully specified and usable. The rest are named placeholders. */
  live: boolean;
  requiresCompetentPerson: boolean;
  unitNoun: string;
  unitTypes: string[];
  /**
   * true — a photograph of every unit, every week.
   * "on_fail" — a photograph only where the point is non-compliant.
   * Missing required photograph blocks completing the run.
   */
  photoRequired: boolean | "on_fail";
  fields: PointField[];
  blurb: string;
};


/**
 * Water and foam extinguishers carry a pressure gauge. CO2 and wet chemical
 * do not — they are checked by seal instead. Asking for a gauge reading on a
 * CO2 unit produces a false record, so the field is conditional.
 */
const fireCheck: CheckTypeDefinition = {
  id: "fire",
  label: "Fire",
  live: true,
  requiresCompetentPerson: false,
  unitNoun: "Extinguisher",
  unitTypes: ["Water", "Foam", "CO2", "Wet chemical", "Dry powder"],
  photoRequired: true,
  blurb: "Every extinguisher checked, photographed and dated, week by week.",
  fields: [
    { id: "present", label: "Present at its point?", type: "yesno", compliance: true },
    { id: "service_in_date", label: "Service in date?", type: "yesno", compliance: true },
    { id: "service_due", label: "Service due", type: "date" },
    { id: "tag_secured", label: "Tag / pin secured?", type: "yesno", compliance: true },
    {
      id: "gauge_full",
      label: "Gauge reading full?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["Water", "Foam", "Dry powder"],
      hint: "Needle in the green.",
    },
    {
      id: "seal_intact",
      label: "Seal intact?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["CO2", "Wet chemical"],
      hint: "CO2 units carry no gauge — the seal is the check.",
    },
    { id: "signage", label: "Signage in place?", type: "yesno", compliance: true },
    { id: "access_clear", label: "Access clear?", type: "yesno", compliance: true },
  ],
};

/**
 * HSE cis47: a daily visual at shift start, plus one written report every
 * seven days. The weekly one is the dated, signed competent-person evidence.
 */
const excavationCheck: CheckTypeDefinition = {
  id: "excavation",
  label: "Excavation",
  live: true,
  requiresCompetentPerson: true,
  unitNoun: "Excavation",
  unitTypes: ["Trench", "Pit", "Shaft", "Basement / bulk dig", "Battered slope"],
  photoRequired: true,
  blurb: "Every excavation inspected, photographed and signed, week by week.",
  fields: [
    { id: "depth", label: "Depth (m)", type: "text" },
    {
      id: "support_per_design",
      label: "Support / shoring per design?",
      type: "yesno",
      compliance: true,
    },
    { id: "access_egress", label: "Safe access and egress (ladder)?", type: "yesno", compliance: true },
    {
      id: "spoil_clear",
      label: "Spoil and materials clear of the edge?",
      type: "yesno",
      compliance: true,
      hint: "Nothing loose within 1m of the edge.",
    },
    { id: "edge_protection", label: "Edge protection in place?", type: "yesno", compliance: true },
    { id: "services_located", label: "Services located and marked?", type: "yesno", compliance: true },
    { id: "water_controlled", label: "Water ingress controlled?", type: "yesno", compliance: true },
    {
      id: "falling_objects",
      label: "Falling-object risk controlled?",
      type: "yesno",
      compliance: true,
    },
    {
      id: "daily_visuals_logged",
      label: "Daily visual checks logged this week",
      type: "number",
      hint: "How many shift-start visuals are recorded.",
    },
  ],
};

/**
 * Work at Height Regulations: a written report by a competent person every
 * seven days from first use. The due date is worked out, not typed.
 */
const scaffoldCheck: CheckTypeDefinition = {
  id: "scaffold",
  label: "Scaffold",
  live: true,
  requiresCompetentPerson: true,
  unitNoun: "Scaffold / lift",
  unitTypes: ["Independent", "Birdcage", "Tower", "Loading bay", "Edge protection", "Mobile tower"],
  photoRequired: true,
  blurb: "The seven-day written report, dated, photographed and held together.",
  fields: [
    { id: "first_use", label: "Date first taken into use", type: "date" },
    {
      id: "report_due",
      label: "This report due",
      type: "date",
      dueFromField: "first_use",
      dueAfterDays: 7,
      hint: "Seven days from first use. Past this date with no report is critical.",
    },
    { id: "sole_plates", label: "Sole plates / base plates sound?", type: "yesno", compliance: true },
    { id: "upright_square", label: "Upright and square?", type: "yesno", compliance: true },
    { id: "bracing", label: "Bracing complete?", type: "yesno", compliance: true },
    { id: "deck_boarded", label: "Deck fully boarded, no gaps?", type: "yesno", compliance: true },
    {
      id: "guardrails",
      label: "Guardrails and toe boards in place?",
      type: "yesno",
      compliance: true,
    },
    { id: "safe_access", label: "Safe access to every lift?", type: "yesno", compliance: true },
    { id: "ties", label: "Ties present and secure?", type: "yesno", compliance: true },
    { id: "no_damage", label: "No damage or corrosion?", type: "yesno", compliance: true },
    { id: "tag_in_date", label: "Tag green and in date?", type: "yesno", compliance: true },
    {
      id: "handover_sheet",
      label: "Handover / load sheet present?",
      type: "yesno",
      compliance: true,
    },
  ],
};

/**
 * LOLER thorough examination runs on its own statutory interval; the weekly
 * duty-holder check sits under it. An out-of-date exam fails outright.
 */
const liftingPlantCheck: CheckTypeDefinition = {
  id: "lifting_plant",
  label: "Lifting and plant",
  live: true,
  requiresCompetentPerson: true,
  unitNoun: "Item of plant",
  unitTypes: ["Crane", "MEWP", "Telehandler", "Hoist", "Chain block", "Slings"],
  photoRequired: true,
  blurb: "Duty-holder weekly check, with the thorough examination as a hard gate.",
  fields: [
    {
      id: "thorough_exam_in_date",
      label: "Thorough examination in date?",
      type: "yesno",
      compliance: true,
      hardGate: true,
      hint: "Overdue is non-compliant whatever else is answered.",
    },
    { id: "thorough_exam_due", label: "Thorough examination due", type: "date" },
    {
      id: "chains",
      label: "Chains free of stretch and wear?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["Crane", "Hoist", "Chain block", "Slings"],
    },
    {
      id: "hooks",
      label: "Hooks undeformed, latch free?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["Crane", "Hoist", "Chain block", "Slings"],
    },
    {
      id: "wire_rope",
      label: "Wire rope free of broken wires and kinks?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["Crane", "Hoist", "Slings"],
    },
    {
      id: "brakes_limits",
      label: "Brakes and limit switches working?",
      type: "yesno",
      compliance: true,
    },
    {
      id: "tyres_undercarriage",
      label: "Tyres / undercarriage sound?",
      type: "yesno",
      compliance: true,
      onlyForUnitTypes: ["Crane", "MEWP", "Telehandler"],
    },
    { id: "guards", label: "Guards in place?", type: "yesno", compliance: true },
    { id: "swl_label", label: "SWL label present and legible?", type: "yesno", compliance: true },
    { id: "daily_check_sheet", label: "Daily check sheet completed?", type: "yesno", compliance: true },
  ],
};

/**
 * CDM requires welfare to be provided; it does not mandate a weekly
 * inspection. This is tier-1 practice recorded as a documented weekly check.
 */
const welfareCheck: CheckTypeDefinition = {
  id: "welfare",
  label: "Welfare",
  live: true,
  requiresCompetentPerson: false,
  unitNoun: "Facility",
  unitTypes: [
    "Main welfare unit",
    "Tower",
    "Eating and rest",
    "Drying room",
    "First aid",
    "Compound",
  ],
  photoRequired: true,
  blurb: "The weekly documented welfare check clients probe hardest.",
  fields: [
    { id: "toilets", label: "Toilets clean and stocked?", type: "yesno", compliance: true },
    {
      id: "washing",
      label: "Washing: hot and cold water, soap, towels?",
      type: "yesno",
      compliance: true,
    },
    { id: "drinking_water", label: "Drinking water available?", type: "yesno", compliance: true },
    { id: "drying_area", label: "Drying area usable?", type: "yesno", compliance: true },
    {
      id: "rest_area",
      label: "Rest area clean, with food-heating facilities?",
      type: "yesno",
      compliance: true,
    },
    {
      id: "first_aid",
      label: "First aid stocked and accessible?",
      type: "yesno",
      compliance: true,
    },
    { id: "lighting_ventilation", label: "Lighting and ventilation adequate?", type: "yesno", compliance: true },
    { id: "unit_repair", label: "Unit in good repair?", type: "yesno", compliance: true },
  ],
};

/** The tier-1 assurance walk. Photograph what fails, not what passes. */
const housekeepingCheck: CheckTypeDefinition = {
  id: "housekeeping",
  label: "Housekeeping",
  live: true,
  requiresCompetentPerson: false,
  unitNoun: "Area",
  unitTypes: ["Zone", "Floor / level", "Core / stair", "External", "Compound", "Access route"],
  photoRequired: "on_fail",
  blurb: "The weekly site management walk, zone by zone.",
  fields: [
    { id: "access_egress", label: "Access and egress clear?", type: "yesno", compliance: true },
    {
      id: "housekeeping",
      label: "Housekeeping sound, no trip hazards?",
      type: "yesno",
      compliance: true,
    },
    { id: "waste_segregated", label: "Waste segregated?", type: "yesno", compliance: true },
    { id: "ppe", label: "PPE correct and worn?", type: "yesno", compliance: true },
    {
      id: "edge_protection",
      label: "Edge protection and openings guarded?",
      type: "yesno",
      compliance: true,
    },
    { id: "platforms", label: "Working platforms safe?", type: "yesno", compliance: true },
    { id: "plant_guarded", label: "Plant and tools guarded?", type: "yesno", compliance: true },
    {
      id: "permits_match",
      label: "Live permits match the actual work?",
      type: "yesno",
      compliance: true,
    },
    {
      id: "rams_match",
      label: "RAMS available and matching the activity?",
      type: "yesno",
      compliance: true,
    },
    { id: "fire_exits", label: "Fire exits clear?", type: "yesno", compliance: true },
    { id: "signage", label: "Signage in place?", type: "yesno", compliance: true },
    { id: "welfare_adjacent", label: "Adjacent welfare acceptable?", type: "yesno", compliance: true },
  ],
};

/** The six agreed check types, in the agreed order. */
export const CHECK_TYPES: CheckTypeDefinition[] = [
  fireCheck,
  excavationCheck,
  scaffoldCheck,
  welfareCheck,
  liftingPlantCheck,
  housekeepingCheck,
];

export function checkType(id: string): CheckTypeDefinition {
  return CHECK_TYPES.find((type) => type.id === id) ?? fireCheck;
}

export function fieldsForUnitType(
  definition: CheckTypeDefinition,
  unitType: string | null,
): PointField[] {
  return definition.fields.filter(
    (field) => !field.onlyForUnitTypes || (unitType ? field.onlyForUnitTypes.includes(unitType) : false),
  );
}

/**
 * The outcome is derived from the answers, never typed by hand: any required
 * answer left as "no" is non-compliant. An unanswered field is not a pass —
 * it leaves the point outside "compliant" until a person answers it.
 */
export function deriveStatus(
  definition: CheckTypeDefinition,
  unitType: string | null,
  answers: Record<string, unknown>,
  notApplicable: boolean,
): ComplianceStatus {
  const relevant = fieldsForUnitType(definition, unitType).filter((field) => field.compliance);
  // A hard gate answered "no" is non-compliant even where the point was
  // marked not applicable — an overdue statutory exam is not a nothing.
  if (relevant.some((field) => field.hardGate && answers[field.id] === false)) {
    return "non_compliant";
  }
  if (notApplicable) return "not_applicable";
  if (relevant.length === 0) return "not_applicable";
  if (relevant.some((field) => answers[field.id] === false)) return "non_compliant";
  if (relevant.every((field) => answers[field.id] === true)) return "compliant";
  return "not_applicable";
}

/** Scaffold's seven-day clock: the due date derived from another answer. */
export function derivedDueDate(field: PointField, answers: Record<string, unknown>): string | null {
  if (!field.dueFromField || !field.dueAfterDays) return null;
  const from = answers[field.dueFromField];
  if (typeof from !== "string" || !from) return null;
  const date = new Date(`${from}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + field.dueAfterDays);
  return date.toISOString().slice(0, 10);
}

/** True where a derived-due date has passed. Always shown with a text label. */
export function isOverdue(
  definition: CheckTypeDefinition,
  answers: Record<string, unknown>,
  today = new Date(),
): boolean {
  return definition.fields.some((field) => {
    const due = (typeof answers[field.id] === "string" && (answers[field.id] as string)) ||
      derivedDueDate(field, answers);
    if (!due) return false;
    if (!field.dueFromField) return false;
    return due < today.toISOString().slice(0, 10);
  });
}


/** Six weeks, most recent first. The audit window the client asks about. */
export const REGISTER_WINDOW_WEEKS = 6;
