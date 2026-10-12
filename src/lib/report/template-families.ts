import { systemDefinitions } from "@/lib/survey-definitions";
import type { SurveyDefinition } from "@/lib/survey-types";

/**
 * Choosing a report, grouped by the job rather than by the internal category key.
 *
 * WHY THIS EXISTS
 * The picker used to group the templates by their `category` key, and two pairs of
 * keys share one display label: `condition` and `condition_survey` both printed
 * "Building fabric", `snagging` and `fit_out` both printed "Quality & handover".
 * Groups are built in registry order, so the repeated heading reappeared further
 * down the list with other groups in between - on the live screen that read as a
 * list with everything in it twice, and Dal reported exactly that on 12 Oct 2026.
 *
 * A family is one heading, printed once, and it names the work rather than the
 * code. Every template also carries one line saying what it is for: names alone
 * ("Schedule of Condition" against "Photo condition record") cannot be chosen
 * between by anybody who does not already know the product.
 *
 * A template that no family claims still renders, under "Other", so a new
 * definition can never fall out of the picker unnoticed. The test beside this
 * module fails if any definition is unclaimed.
 */
export type TemplateFamilyId = "snagging" | "condition" | "site" | "mne" | "records";

export const TEMPLATE_FAMILIES: { id: TemplateFamilyId; label: string }[] = [
  { id: "snagging", label: "Snagging & handover" },
  { id: "condition", label: "Condition & fabric" },
  { id: "site", label: "Site & safety" },
  { id: "mne", label: "M&E" },
  { id: "records", label: "Records & registers" },
];

/** Handed to templates no family has claimed, so none can disappear. */
export const UNCLAIMED_FAMILY = { id: "other" as const, label: "Other" };

export type TemplateChoice = {
  family: TemplateFamilyId;
  /** One line, in the words used on site rather than the product's. */
  purpose: string;
};

/** Keyed by the definition id: the id is the contract, the label is not. */
export const TEMPLATE_CHOICE: Record<string, TemplateChoice> = {
  snagging: {
    family: "snagging",
    purpose:
      "Every photograph becomes a finding: a trade, a severity and the fix. The one for a snagging list.",
  },
  fitout_quality: {
    family: "snagging",
    purpose:
      "Finished work checked against the drawing and the specification, including tolerances.",
  },
  schedule_of_condition: {
    family: "condition",
    purpose:
      "Condition of each element, room by room, on a four-step grade. Records, does not ask for a fix.",
  },
  weatherproofing: {
    family: "condition",
    purpose: "Roof and membrane condition, with the membrane type and the extent affected.",
  },
  damp_moisture: {
    family: "condition",
    purpose: "Moisture diagnosed as active, historic or widespread, with a meter reading.",
  },
  site_walk: {
    family: "site",
    purpose: "A walk of the site: safety, housekeeping, access and welfare, each with a time to fix.",
  },
  electrical_installation: {
    family: "mne",
    purpose: "Defects graded against BS 7671, with the board or circuit for each item.",
  },
  mechanical_services: {
    family: "mne",
    purpose: "Plant defects, commissioning risks and efficiency losses, by system.",
  },
  property_inventory: {
    family: "records",
    purpose: "Rooms, contents and condition item by item, with quantities.",
  },
  certificate_register: {
    family: "records",
    purpose: "The register of certificates: what it covers, who issued it, when it runs out.",
  },
  manual_photo_report: {
    family: "records",
    purpose: "Photographs you label yourself. Issued as a PDF, never a review page.",
  },
  photo_condition_record: {
    family: "records",
    purpose: "A dated photographic record. Nothing is graded and nothing is analysed.",
  },
};

export function choiceOf(id: string): TemplateChoice | null {
  return TEMPLATE_CHOICE[id] ?? null;
}

export function purposeOf(id: string): string | null {
  return TEMPLATE_CHOICE[id]?.purpose ?? null;
}

export type TemplateGroup = {
  id: string;
  label: string;
  definitions: SurveyDefinition[];
};

/**
 * The picker's groups: one per family, in family order, and the templates inside a
 * group in registry order. Every definition appears exactly once.
 */
export function templateGroups(definitions: SurveyDefinition[] = systemDefinitions): TemplateGroup[] {
  const groups: TemplateGroup[] = TEMPLATE_FAMILIES.map((family) => ({
    id: family.id,
    label: family.label,
    definitions: [],
  }));
  const other: TemplateGroup = { id: UNCLAIMED_FAMILY.id, label: UNCLAIMED_FAMILY.label, definitions: [] };

  for (const definition of definitions) {
    const choice = choiceOf(definition.id);
    const target = choice ? groups.find((group) => group.id === choice.family) : undefined;
    if (target) target.definitions.push(definition);
    else other.definitions.push(definition);
  }

  return other.definitions.length > 0
    ? [...groups.filter((group) => group.definitions.length > 0), other]
    : groups.filter((group) => group.definitions.length > 0);
}

/** Family a definition belongs to, or null when nothing has claimed it yet. */
export function familyOf(id: string): TemplateFamilyId | null {
  return TEMPLATE_CHOICE[id]?.family ?? null;
}
