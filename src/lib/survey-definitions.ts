import type { SurveyDefinition } from "@/lib/survey-types";

/**
 * The three system survey type definitions (organisation_id = null in
 * `survey_type_definitions`). A definition is DATA: adding a discipline is a
 * new record here and in the database, never new code.
 *
 * The `aiGuidance` wording is domain-critical and is reproduced verbatim.
 */

export const weatherproofingDefinition: SurveyDefinition = {
  id: "weatherproofing",
  version: 1,
  label: "Weatherproofing membrane survey",
  category: "condition_survey",
  findingsPerPhoto: "single",
  statuses: [
    { id: "intact", label: "Intact — no action required", tone: "pass" },
    { id: "damaged", label: "Damaged — remedial required", tone: "fail" },
    { id: "monitor", label: "Serviceable — monitor", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    { id: "low", label: "Low", guidance: "Cosmetic or minor wear. No immediate risk." },
    {
      id: "medium",
      label: "Medium",
      guidance: "Localised defect. Schedule within current programme.",
    },
    {
      id: "high",
      label: "High",
      guidance: "Active or imminent water ingress risk. Prioritise.",
    },
    { id: "critical", label: "Critical", guidance: "Immediate action. Escalate same day." },
  ],
  captureFields: [
    { id: "location", label: "Location / grid ref", type: "text", required: true },
    {
      id: "element",
      label: "Element",
      type: "select",
      options: ["Roof field", "Parapet", "Upstand", "Flashing", "Outlet", "Lap / seam"],
    },
    {
      id: "membrane_type",
      label: "Membrane type",
      type: "select",
      options: ["Torch-on felt", "Single ply", "Liquid applied", "Bituminous sheet", "Unknown"],
    },
  ],
  aiGuidance: {
    persona: "A UK chartered building surveyor assessing weatherproofing membrane condition.",
    focus:
      "Roof and parapet membranes, laps, upstands, flashings, terminations and drainage outlets.",
    failCriteria:
      "A clear rip, tear, split, puncture, lifted or debonded seam, failed termination, or standing water indicating a fall defect.",
    excludeCriteria:
      "Surface staining, debris, moss or minor weathering with no breach of the membrane is NOT a defect.",
    abstainGuidance:
      "If the photo is too dark, distant, obstructed or out of focus to judge the membrane surface, return not_assessed.",
  },
  defaultRemedial:
    "Localised patch repair to damaged area using matched membrane system with minimum 100mm lap to sound material.",
  outputSections: ["cover", "scope", "methodology", "summary", "schedule", "appendix"],
  requiresTradeAssignment: false,
  requiresLifecycle: false,
  supportsDistribution: false,
};

export const snaggingDefinition: SurveyDefinition = {
  id: "snagging",
  version: 1,
  label: "Snag identification & remedial schedule",
  category: "snagging",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "snag", label: "Snag — rectification required", tone: "fail" },
    { id: "acceptable", label: "Acceptable — no action", tone: "pass" },
    { id: "monitor", label: "Monitor — review before handover", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "cosmetic",
      label: "Cosmetic",
      guidance: "Appearance only. No performance or compliance consequence.",
    },
    {
      id: "workmanship",
      label: "Workmanship",
      guidance:
        "Below the expected standard of finish or installation. Rectify before handover.",
    },
    {
      id: "performance",
      label: "Performance",
      guidance: "Affects durability, weathertightness, thermal or acoustic performance.",
    },
    {
      id: "compliance",
      label: "Compliance",
      guidance:
        "May not satisfy Building Regulations or the specification. Escalate for verification.",
    },
    {
      id: "structural_safety",
      label: "Structural or safety",
      guidance: "Potential risk to structure or to persons. Escalate immediately.",
    },
  ],
  snagCategories: [
    { id: "finishes", label: "Finishes & decoration", defaultTrades: ["Decorator", "Plasterer"] },
    { id: "joinery", label: "Joinery, doors & ironmongery", defaultTrades: ["Carpenter / joiner"] },
    { id: "wet_trades", label: "Plaster, screed & render", defaultTrades: ["Plasterer"] },
    { id: "tiling", label: "Tiling & sealant", defaultTrades: ["Tiler"] },
    {
      id: "glazing",
      label: "Windows, glazing & external doors",
      defaultTrades: ["Window installer"],
    },
    { id: "roofing_rainwater", label: "Roofing & rainwater goods", defaultTrades: ["Roofer"] },
    {
      id: "external_envelope",
      label: "External walls & weathertightness",
      defaultTrades: ["Bricklayer", "Renderer"],
    },
    { id: "mechanical", label: "Mechanical, heating & ventilation", defaultTrades: ["M&E"] },
    { id: "electrical", label: "Electrical", defaultTrades: ["Electrician"] },
    { id: "sanitary", label: "Sanitaryware & drainage", defaultTrades: ["Plumber"] },
    { id: "structure", label: "Structure & movement", defaultTrades: ["Structural"] },
    {
      id: "fire_safety",
      label: "Fire safety & means of escape",
      defaultTrades: ["Principal contractor"],
    },
    {
      id: "accessibility",
      label: "Accessibility & Part M",
      defaultTrades: ["Principal contractor"],
    },
  ],
  regulatoryReferences: [
    { id: "ad_a", label: "Approved Document A — structure" },
    { id: "ad_b", label: "Approved Document B — fire safety" },
    {
      id: "ad_c",
      label:
        "Approved Document C — site preparation and resistance to contaminants and moisture",
    },
    { id: "ad_e", label: "Approved Document E — resistance to the passage of sound" },
    { id: "ad_f", label: "Approved Document F — ventilation" },
    {
      id: "ad_k",
      label: "Approved Document K — protection from falling, collision and impact",
    },
    { id: "ad_l", label: "Approved Document L — conservation of fuel and power" },
    { id: "ad_m", label: "Approved Document M — access to and use of buildings" },
    { id: "ad_part_p", label: "Part P — electrical safety" },
    { id: "bs_8000", label: "BS 8000 — workmanship on construction sites" },
    { id: "nhbc", label: "NHBC Standards" },
    { id: "spec", label: "Project specification / employer's requirements" },
    { id: "manufacturer", label: "Manufacturer's installation instructions" },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Plot, level, room or grid ref",
    },
    { id: "element", label: "Element", type: "text" },
    {
      id: "stage",
      label: "Stage",
      type: "select",
      options: ["Pre-plaster", "Pre-handover", "Handover", "Defects liability", "End of defects"],
    },
  ],
  aiGuidance: {
    persona:
      "A UK chartered building surveyor or clerk of works identifying construction defects at inspection. Plain, direct English in the register of a snagging schedule issued to a main contractor.",
    focus:
      "Defects in workmanship, finish, installation and weathertightness across all trades — cracking, poor jointing, gaps, misalignment, damaged components, missing sealant, incomplete installation, incorrect fixings, staining and water damage.",
    multiFindingGuidance:
      "A single photo may show several separate defects. Return one observation per distinct defect. Do not merge unrelated defects into one observation, and do not split one defect into several.",
    descriptionGuidance:
      "Describe what is actually visible in plain English a site manager would use, including approximate extent and dimension where it can be judged. Do not use jargon where a plain word will do.",
    causeGuidance:
      "State the MOST LIKELY cause as an assessment, not a finding of fact — a photograph rarely contains enough evidence to be certain. Where more than one cause is plausible, say so. Where the cause cannot reasonably be inferred from the image, return null rather than guessing.",
    regulatoryGuidance:
      "Where the defect plausibly engages a regulation or standard, select the SINGLE most relevant entry from the regulatoryReferences list provided. Select only from that list. NEVER invent, cite or infer a clause, paragraph, section or table number — reference the document only. If no listed reference clearly applies, return null.",
    remedialGuidance:
      "Give the most logical and efficient rectification, sequenced where the order of operations matters. Prefer the least invasive fix that properly resolves the defect and its cause rather than only its symptom. State where opening up or further investigation is needed before a fix can be specified.",
    failCriteria:
      "Any departure from the expected standard of workmanship, the specification, manufacturer's instructions, or good building practice that a client or clerk of works would raise at inspection.",
    excludeCriteria:
      "Incomplete work that is simply not yet finished, protective coverings, temporary works and normal construction dust or debris are NOT snags. Do not flag work in progress.",
    peopleGuidance:
      "Describe conditions and defects only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "Where the responsible trade can be reasonably inferred from the element and the nature of the defect, suggest it and state the reason. If it cannot be reasonably inferred, return null rather than guessing. Never state a trade as certain.",
    abstainGuidance:
      "If the photo is too dark, blurred, distant or ambiguous to identify the element or judge its condition, return not_assessed.",
  },
  outputSections: [
    "cover",
    "scope",
    "summary",
    "schedule_by_trade",
    "schedule_by_area",
    "appendix",
  ],
  requiresTradeAssignment: true,
  requiresLifecycle: true,
  supportsDistribution: true,
  defaultDistributionGrouping: "trade",
};

export const siteWalkDefinition: SurveyDefinition = {
  id: "site_walk",
  version: 1,
  label: "Site walk — housekeeping & safety",
  category: "site_walk",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "observation", label: "Observation — action required", tone: "fail" },
    { id: "satisfactory", label: "Satisfactory", tone: "pass" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "immediate",
      label: "Immediate — stop work",
      guidance:
        "Imminent risk of serious harm. Work stops now. Escalate to the site manager in person.",
      targetHours: 0,
    },
    {
      id: "same_day",
      label: "Same day",
      guidance: "Significant hazard. Rectify before end of shift.",
      targetHours: 8,
    },
    {
      id: "this_week",
      label: "This week",
      guidance: "Requires action but not an immediate risk.",
      targetHours: 120,
    },
    {
      id: "housekeeping",
      label: "Housekeeping",
      guidance:
        "Tidiness, storage and general order. Rectify in normal course of work.",
      targetHours: 168,
    },
  ],
  hazardCategories: [
    { id: "access_egress", label: "Access & egress", defaultTrades: ["Principal contractor"] },
    { id: "working_at_height", label: "Working at height & edge protection", defaultTrades: [] },
    { id: "electrical", label: "Temporary power & trailing leads", defaultTrades: ["M&E"] },
    { id: "material_storage", label: "Material storage & stacking", defaultTrades: [] },
    { id: "waste", label: "Waste, pallets & debris", defaultTrades: [] },
    { id: "water_spillage", label: "Standing water & spillages", defaultTrades: [] },
    {
      id: "welfare",
      label: "Welfare facilities & cleanliness",
      defaultTrades: ["Principal contractor", "Cleaning"],
    },
    {
      id: "fire_safety",
      label: "Fire safety & escape routes",
      defaultTrades: ["Principal contractor"],
    },
    { id: "plant_equipment", label: "Plant & equipment", defaultTrades: [] },
    { id: "ppe_behaviour", label: "PPE & unsafe acts", confidential: true, defaultTrades: [] },
    { id: "signage", label: "Signage & barriers", defaultTrades: ["Principal contractor"] },
    { id: "environmental", label: "Environmental & pollution", defaultTrades: [] },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Level, zone, grid ref or room",
    },
    {
      id: "area_type",
      label: "Area",
      type: "select",
      options: ["Internal", "External", "Welfare", "Access route", "Storage", "Compound"],
    },
  ],
  aiGuidance: {
    persona:
      "A UK construction site manager carrying out a daily site safety and housekeeping walk. Practical and direct, in the register of a site observation record rather than a formal report.",
    focus:
      "Materials left in walkways, trailing cables and leads, missing or incomplete edge protection, empty pallets and waste accumulation, standing water and spillages, blocked fire escape routes and extinguisher access, unsecured or badly stacked materials, damaged or missing barriers and signage, poorly maintained welfare facilities, uncovered floor openings, plant left unsecured, and general untidiness.",
    multiFindingGuidance:
      "A single photo may show several separate issues. Return one observation per distinct issue. Do not merge unrelated issues into one observation, and do not split one issue into several.",
    failCriteria:
      "Any condition that presents a hazard, obstructs safe access or egress, breaches housekeeping standards, or would be criticised on an HSE or client inspection.",
    excludeCriteria:
      "Work in progress with materials in active use and correctly managed is NOT an observation. Do not flag normal, controlled site activity.",
    peopleGuidance:
      "Describe conditions and hazards only. Do NOT describe, identify, count or characterise any person visible in the photograph. If the only issue visible relates to a person's behaviour or PPE, categorise it as ppe_behaviour and describe the safety issue in general terms without reference to the individual.",
    tradeGuidance:
      "Where the responsible trade can be reasonably inferred from the materials, tools or work visible, suggest it — and state the reason for the inference. If it cannot be reasonably inferred, return null rather than guessing. Never state a trade as certain.",
    abstainGuidance:
      "If the photo is too dark, blurred or ambiguous to identify what is shown, return not_assessed.",
  },
  outputSections: ["cover", "summary", "schedule_by_trade", "schedule_by_area", "appendix"],
  requiresTradeAssignment: true,
  requiresLifecycle: true,
  supportsDistribution: true,
  defaultDistributionGrouping: "trade",
};

/** Every system definition, in picker order. */
export const systemDefinitions: SurveyDefinition[] = [
  snaggingDefinition,
  siteWalkDefinition,
  weatherproofingDefinition,
];

export function getDefinition(id: string): SurveyDefinition | undefined {
  return systemDefinitions.find((definition) => definition.id === id);
}

/** A definition is frozen into the report at creation — never referenced live. */
export function snapshotOf(definition: SurveyDefinition): SurveyDefinition {
  return structuredClone(definition);
}
