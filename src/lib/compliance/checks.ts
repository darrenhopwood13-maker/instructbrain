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
  type: "yesno" | "text" | "date";
  /** Present only for the unit types listed. Absent means: always ask. */
  onlyForUnitTypes?: string[];
  /** A "no" answer on these fields is what makes a point non-compliant. */
  compliance?: boolean;
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
  /** Photo of every unit, every week. Missing photo blocks issuing. */
  photoRequired: boolean;
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

function placeholder(
  id: string,
  label: string,
  unitNoun: string,
  requiresCompetentPerson: boolean,
): CheckTypeDefinition {
  return {
    id,
    label,
    live: false,
    requiresCompetentPerson,
    unitNoun,
    unitTypes: [],
    photoRequired: true,
    fields: [],
    blurb: "Named and reserved. The per-point checks are added as data, with no rebuild.",
  };
}

/** The six agreed check types, in the agreed order. Fire is live. */
export const CHECK_TYPES: CheckTypeDefinition[] = [
  fireCheck,
  placeholder("excavation", "Excavation", "Excavation", true),
  placeholder("scaffold", "Scaffold", "Scaffold / lift", true),
  placeholder("welfare", "Welfare", "Facility", false),
  placeholder("lifting_plant", "Lifting and plant", "Item of plant", true),
  placeholder("housekeeping", "Housekeeping", "Area", false),
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
  if (notApplicable) return "not_applicable";
  const relevant = fieldsForUnitType(definition, unitType).filter((field) => field.compliance);
  if (relevant.length === 0) return "not_applicable";
  if (relevant.some((field) => answers[field.id] === false)) return "non_compliant";
  if (relevant.every((field) => answers[field.id] === true)) return "compliant";
  return "not_applicable";
}

/** Six weeks, most recent first. The audit window the client asks about. */
export const REGISTER_WINDOW_WEEKS = 6;
