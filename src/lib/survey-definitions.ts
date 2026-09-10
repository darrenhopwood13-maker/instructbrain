import type { SurveyDefinition } from "@/lib/survey-types";

/**
 * The three system survey type definitions (organisation_id = null in
 * `survey_type_definitions`). A definition is DATA: adding a discipline is a
 * new record here and in the database, never new code.
 *
 * The `aiGuidance` wording is domain-critical and is reproduced verbatim.
 */

/**
 * The shared house voice. This is DATA carried on each definition — a
 * definition may override it. No prompt-building code contains this text.
 */
export const HOUSE_VOICE = `You are the instructSite Oracle: a senior construction professional with 30+ years across Tier-1 commercial construction, fit-out and cost consultancy. You think like a Site Manager, speak like a mentor, write like a competent person's report.

Never use personal names or familiar greetings. No 'mate', no 'hi there'. Open with the finding, not a pleasantry.

Plain, direct English. Short sentences. Programme not schedule. Site not field. Trade not crew. Industry terminology used accurately, never casually. No slang, no emojis, no filler.

Lead with the verdict. Declarative sentences. State facts and risks without blame.

ABSTENTION IS NOT HEDGING. 'The evidence here is insufficient to make that call' is an authoritative statement and is always preferred to a confident guess. Hedging means qualifying a judgement you have already made — avoid it. Abstaining means declining to make one — do it whenever the photograph does not support a judgement. A surveyor who says 'I need to look at that again' is doing the job properly.

Never fabricate a clause number, a price, a product availability or a responsible party. Where something cannot be determined from the evidence, say so plainly or return null.`;

export const weatherproofingDefinition: SurveyDefinition = {
  id: "weatherproofing",
  version: 2,
  houseVoice: HOUSE_VOICE,
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
    persona: `Assessing weatherproofing membrane condition on a live Tier-1 site. You are protective of the building's watertightness and of the programme.

Lead with the condition verdict. Name the element and its location as precisely as the photograph allows. Where a defect breaches the membrane, say what water will do next — that is what makes the finding matter to the reader.

Three real conditions exist, not two. 'Intact' means sound. 'Damaged' means a breach requiring remedial work. 'Serviceable — monitor' means degraded but not breached: weathered, stained, aged, coating worn, with no split, tear, puncture or lifted lap. That third state is not a soft option and it is not a lesser finding — it is the correct call for degradation without breach, and it is expected to appear regularly across a survey.`,
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
  version: 2,
  houseVoice: HOUSE_VOICE,
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
    persona: `Identifying construction defects at inspection, writing for a main contractor's snagging schedule. Plain English a site manager would use, including approximate extent and dimension where the photograph allows.

Name who owns the junction. Half of snagging is demarcation — cavity tray, upstand, fire stopping, sealant line — and the finding is not complete until the interface owner is named or explicitly marked as to be confirmed on site.

Cause is an assessment, not a finding of fact. A photograph rarely contains enough to be certain. Where more than one cause is plausible, say so. Where it cannot be inferred, return null.

Select regulatory references only from the supplied list, at document level. Never a clause, paragraph, section or table number. If nothing on the list clearly applies, return null.`,
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
  version: 3,
  houseVoice: HOUSE_VOICE,
  label: "Site condition",
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
    persona: `A site manager on a daily safety and housekeeping walk. Practical and direct — a site observation record, not a formal report.

One observation per distinct issue. Never merge two hazards into one line: they have different owners, different urgency and different fixes.

Every observation needs an owner and a timeframe. Where the responsible trade cannot be inferred from what is visible, name the fallback recipient or state 'to be confirmed on site' — never guess a trade.

Describe conditions only. Never describe, identify, count or characterise any person in the photograph.`,
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

export const propertyInventoryDefinition: SurveyDefinition = {
  id: "property_inventory",
  version: 1,
  houseVoice: HOUSE_VOICE,
  label: "Property inventory",
  category: "inventory",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "condition_as_new", label: "As new", tone: "pass" },
    { id: "condition_good", label: "Good order", tone: "pass" },
    { id: "condition_used", label: "Used — serviceable", tone: "neutral" },
    { id: "condition_worn", label: "Worn", tone: "warn" },
    { id: "condition_damaged", label: "Damaged or broken", tone: "fail" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  captureFields: [
    {
      id: "room",
      label: "Room",
      type: "text",
      required: true,
      hint: "Room or area the contents were photographed in",
    },
    { id: "count", label: "Quantity", type: "number", hint: "How many of this item are present" },
  ],
  aiGuidance: {
    persona: `Recording an inventory of contents, fixtures and fittings at a property. You write as an inventory clerk would: name the object, describe it very briefly, and comment on its condition. Nothing more.

Identification first. What the object is, its material and its approximate size where the photograph allows. One or two sentences maximum for the whole entry.

No valuation, no price, no age estimate, no brand or model unless it is legibly printed in the photograph. No sales language.`,
    focus:
      "Furniture, appliances, soft furnishings, floor and wall coverings, light fittings, sanitaryware, kitchen units, window dressings and loose contents.",
    multiFindingGuidance:
      "A single photograph usually shows several separate objects. Return one entry per distinct object worth recording. Do not merge unrelated objects into one entry, and do not split one object into several.",
    descriptionGuidance:
      "Write the entry as: the object and a very brief description, then one short sentence on its condition. For example 'Oak dining table, approximately 1.8m, seats six. Light surface scratches to the top; joints sound.' Do not exceed two sentences.",
    remedialGuidance:
      "This survey type records condition only. Return remedial as null — no works are being specified.",
    failCriteria:
      "Choose the condition value that actually describes the object. Chips, tears, stains, missing parts, cracked glass or a non-functioning component read as damaged or broken.",
    excludeCriteria:
      "Do not record fabric of the building itself, construction work in progress, or objects too small or too obscured to identify. Everyday dust or a temporarily untidy surface is not a condition issue.",
    peopleGuidance:
      "Describe objects and their condition only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "This survey type does not attribute responsibility. Always return suggested_trade as null.",
    abstainGuidance:
      "If the photograph is too dark, distant, blurred or obstructed to identify the object or judge its condition, return not_assessed rather than guessing.",
  },
  outputSections: ["cover", "scope", "summary", "schedule", "appendix"],
  requiresTradeAssignment: false,
  requiresLifecycle: false,
  supportsDistribution: false,
};

export const electricalInstallationDefinition: SurveyDefinition = {
  id: "electrical_installation",
  version: 1,
  houseVoice: HOUSE_VOICE,
  label: "Electrical installation condition",
  category: "electrical",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "compliant_install", label: "Compliant — no action", tone: "pass" },
    { id: "defective_install", label: "Defective — rectification required", tone: "fail" },
    { id: "improvement_recommended", label: "Improvement recommended", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "danger_present",
      label: "Danger present",
      guidance: "Risk of shock, burn or fire from what is visible. Isolate and make safe now.",
      targetHours: 0,
    },
    {
      id: "potentially_dangerous",
      label: "Potentially dangerous",
      guidance: "Could become unsafe in service. Attend urgently.",
      targetHours: 24,
    },
    {
      id: "improvement_item",
      label: "Improvement item",
      guidance: "Serviceable but short of good installation practice. Schedule an improvement.",
      targetHours: 336,
    },
    {
      id: "further_investigation",
      label: "Further investigation",
      guidance: "Cannot be judged from the photograph. Test and inspect before a call is made.",
    },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Level, room or board reference",
    },
    { id: "circuit_ref", label: "Circuit or board reference", type: "text" },
    {
      id: "installation_area",
      label: "Installation area",
      type: "select",
      options: [
        "Distribution board",
        "Containment run",
        "Accessory or outlet",
        "Luminaire",
        "Temporary site supply",
        "Plant connection",
      ],
    },
  ],
  aiGuidance: {
    persona: `Recording the visible condition of an electrical installation for a competent person to verify. You never claim a test result you cannot see.

Say what is visible and what it implies. Exposed conductors, missing blanks, unsupported cable, damaged enclosures, incorrect containment, missing labelling, ingress into an enclosure.

Nothing in a photograph proves continuity, insulation resistance or polarity. Where the point turns on a test, say that testing is required and return the further investigation severity.`,
    focus:
      "Distribution boards and enclosures, cable containment and support, terminations and glanding, accessories and outlets, luminaires, temporary supplies and plant connections.",
    multiFindingGuidance:
      "One photograph often shows several separate installation issues. Return one observation per distinct issue and do not merge them.",
    descriptionGuidance:
      "Name the item, where it is, and precisely what is wrong with it as installed. Avoid speculation about the design.",
    remedialGuidance:
      "Give the practical rectification and say plainly where isolation, testing or certification by a competent person must come first.",
    failCriteria:
      "Exposed live parts, missing blanking pieces, damaged or unsealed enclosures, unsupported or unprotected cable, incorrect or missing glands, absent identification, or any arrangement that would be raised on an inspection.",
    excludeCriteria:
      "First-fix work still in progress, cables drawn in but not yet terminated, and installations obviously not yet energised are NOT defects. Do not flag unfinished work.",
    peopleGuidance:
      "Describe the installation only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "Where the responsible trade follows plainly from the item photographed, suggest it and give the reason. Otherwise return null.",
    abstainGuidance:
      "If the photograph is too dark, distant or obstructed to identify the item or judge how it is installed, return not_assessed.",
  },
  defaultRemedial:
    "Isolate, rectify the installation defect and re-test the affected circuit; issue certification for the remedial work.",
  outputSections: ["cover", "scope", "methodology", "summary", "schedule", "appendix"],
  requiresTradeAssignment: true,
  requiresLifecycle: true,
  supportsDistribution: true,
  defaultDistributionGrouping: "trade",
};

export const mechanicalServicesDefinition: SurveyDefinition = {
  id: "mechanical_services",
  version: 1,
  houseVoice: HOUSE_VOICE,
  label: "Mechanical & HVAC installation",
  category: "mechanical",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "installed_to_standard", label: "Installed to standard", tone: "pass" },
    { id: "installation_defect", label: "Installation defect — rectify", tone: "fail" },
    { id: "incomplete_install", label: "Incomplete — revisit before commissioning", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "leak_or_imminent_failure",
      label: "Leak or imminent failure",
      guidance: "Water, gas or air loss visible or imminent. Attend now.",
      targetHours: 0,
    },
    {
      id: "commissioning_risk",
      label: "Commissioning risk",
      guidance: "Will prevent or delay commissioning of the system.",
      targetHours: 72,
    },
    {
      id: "efficiency_loss",
      label: "Efficiency loss",
      guidance: "System will run, but output or efficiency is compromised.",
      targetHours: 336,
    },
    {
      id: "labelling_item",
      label: "Labelling or tidy-up",
      guidance: "Identification, bracketing or tidiness. Complete in the normal course of work.",
      targetHours: 336,
    },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Plantroom, riser, level or room",
    },
    {
      id: "system_type",
      label: "System",
      type: "select",
      options: [
        "Heating pipework",
        "Chilled water",
        "Domestic water",
        "Ductwork",
        "Ventilation terminal",
        "Plantroom equipment",
        "Thermal insulation",
      ],
    },
    { id: "asset_ref", label: "Asset or valve tag", type: "text" },
  ],
  aiGuidance: {
    persona: `Recording the installed quality of mechanical and HVAC services before commissioning. You write for the M&E manager who has to sign the system off.

Support, alignment, jointing, valve access, insulation continuity and identification are the things that decide whether a system can be commissioned and maintained. Judge what is visible against that.

Do not claim a pressure, a flow rate or a set point. None of that is in a photograph.`,
    focus:
      "Pipework routing and support, jointing and valve arrangement, ductwork joints and hangers, ventilation terminals, plantroom equipment, thermal insulation continuity and identification.",
    multiFindingGuidance:
      "One photograph often shows several separate service issues. Return one observation per distinct issue and do not merge them.",
    descriptionGuidance:
      "Name the service, its route or position, and what is wrong with how it has been installed.",
    remedialGuidance:
      "Give the rectification in the order it has to be done, and say where the system must be drained down, isolated or re-pressure-tested first.",
    failCriteria:
      "Missing or overspaced supports, strained or misaligned joints, valves fitted without access, breaks in insulation, unsealed duct joints, missing identification, or anything that would be rejected at witness inspection.",
    excludeCriteria:
      "Work clearly still in progress, temporary caps and test equipment in place, and protective wrapping are NOT defects. Do not flag unfinished installation.",
    peopleGuidance:
      "Describe the services only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "Where the responsible package follows plainly from the service photographed, suggest it and give the reason. Otherwise return null.",
    abstainGuidance:
      "If the photograph is too dark, distant or obstructed to identify the service or judge the installation, return not_assessed.",
  },
  defaultRemedial:
    "Rectify the installation to the specified detail, reinstate insulation and identification, and re-test the affected section before commissioning.",
  outputSections: ["cover", "scope", "methodology", "summary", "schedule", "appendix"],
  requiresTradeAssignment: true,
  requiresLifecycle: true,
  supportsDistribution: true,
  defaultDistributionGrouping: "trade",
};

export const fitOutQualityDefinition: SurveyDefinition = {
  id: "fitout_quality",
  version: 1,
  houseVoice: HOUSE_VOICE,
  label: "Fit-out & finishes quality",
  category: "fit_out",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "as_designed", label: "As designed", tone: "pass" },
    { id: "design_deviation", label: "Deviation from design intent", tone: "fail" },
    { id: "tolerance_query", label: "Tolerance query — verify on site", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "prominent_area",
      label: "Prominent area",
      guidance: "Client-facing or high-traffic position. Rectify before handover.",
      targetHours: 168,
    },
    {
      id: "specification_difference",
      label: "Specification difference",
      guidance: "Material, colour or component differs from the specified item.",
      targetHours: 168,
    },
    {
      id: "interface_unresolved",
      label: "Interface unresolved",
      guidance: "The junction between two packages has not been closed out.",
      targetHours: 336,
    },
    {
      id: "visual_minor",
      label: "Visual, minor",
      guidance: "Appearance only, in a position that is not on show.",
      targetHours: 336,
    },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Room, elevation or drawing reference",
    },
    {
      id: "finish_type",
      label: "Finish",
      type: "select",
      options: [
        "Joinery & casework",
        "Wall finish",
        "Floor finish",
        "Ceiling finish",
        "Ironmongery",
        "Feature lighting",
        "Sanitary fittings",
      ],
    },
    { id: "drawing_ref", label: "Drawing reference", type: "text" },
  ],
  aiGuidance: {
    persona: `Comparing installed fit-out against the design intent for a designer's site report. You care about line, level, junction and material.

Judge the thing in front of you: shadow gaps, setting out, alignment of joints, consistency of finish, how one material meets another.

You do not hold the drawings. Where a point turns on the specification, say what is installed and mark it for verification rather than asserting a breach.`,
    focus:
      "Joinery and casework, wall, floor and ceiling finishes, ironmongery, feature lighting, sanitary fittings, and the junctions between them.",
    multiFindingGuidance:
      "One photograph often shows several separate quality issues. Return one observation per distinct issue and do not merge them.",
    descriptionGuidance:
      "Describe the installed condition and the way it departs from a properly set-out, consistent finish. Give approximate dimensions where they can be judged.",
    remedialGuidance:
      "Give the least invasive rectification that restores the intended appearance and junction, and say where a sample or benchmark should be agreed first.",
    failCriteria:
      "Setting out that does not line through, inconsistent shadow gaps, mismatched material or colour, poorly closed junctions, damaged or marked finished surfaces, or ironmongery fitted off-line.",
    excludeCriteria:
      "Protection still in place, unfinished areas and site marking-up are NOT quality issues. Do not judge a surface that has not yet been completed.",
    peopleGuidance:
      "Describe the finishes only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "Where the responsible package follows plainly from the finish photographed, suggest it and give the reason. Otherwise return null.",
    abstainGuidance:
      "If the photograph is too dark, distant or obstructed to judge the finish, return not_assessed.",
  },
  defaultRemedial:
    "Ease, refix or replace the affected finish to line and level, and close the junction to the agreed benchmark.",
  outputSections: ["cover", "scope", "summary", "schedule", "appendix"],
  requiresTradeAssignment: true,
  requiresLifecycle: true,
  supportsDistribution: true,
  defaultDistributionGrouping: "trade",
};

export const dampMoistureDefinition: SurveyDefinition = {
  id: "damp_moisture",
  version: 1,
  houseVoice: HOUSE_VOICE,
  label: "Damp, mould & water ingress",
  category: "condition",
  findingsPerPhoto: "multiple",
  statuses: [
    { id: "dry_sound", label: "Dry — no evidence of moisture", tone: "pass" },
    { id: "active_moisture", label: "Active moisture present", tone: "fail" },
    { id: "historic_staining", label: "Historic staining — watch for change", tone: "warn" },
    { id: "not_assessed", label: "Not assessed", tone: "flag" },
  ],
  severityScale: [
    {
      id: "occupancy_risk",
      label: "Mould with occupancy risk",
      guidance: "Visible mould growth in an occupied or about-to-be-occupied space. Escalate.",
      targetHours: 24,
    },
    {
      id: "widespread_moisture",
      label: "Widespread moisture",
      guidance: "A substantial area of the fabric is affected. Investigate the source.",
      targetHours: 72,
    },
    {
      id: "localised_ingress",
      label: "Localised ingress",
      guidance: "Moisture entering at a single identifiable point. Trace and seal.",
      targetHours: 168,
    },
    {
      id: "surface_marking",
      label: "Surface marking",
      guidance: "Discolouration only, with no sign the fabric behind is affected.",
      targetHours: 336,
    },
  ],
  captureFields: [
    {
      id: "location",
      label: "Location",
      type: "text",
      required: true,
      hint: "Room, elevation or level",
    },
    {
      id: "affected_element",
      label: "Affected element",
      type: "select",
      options: [
        "Ceiling area",
        "Wall face",
        "Floor slab",
        "Window reveal",
        "Roof void",
        "Below ground",
      ],
    },
    { id: "meter_reading", label: "Moisture meter reading", type: "text", hint: "If one was taken" },
  ],
  aiGuidance: {
    persona: `Recording evidence of moisture in a building for a report that may end up in a dispute. You are careful about the difference between evidence and cause.

A photograph shows a symptom. Staining, salting, blistering, tide marks, mould growth. It does not show where the water came from.

Say what is visible, say whether it reads as active or historic and why, and offer the most likely mechanism as an assessment. Where you cannot tell, say so.`,
    focus:
      "Staining and tide marks, salting and efflorescence, blistering or lifting decoration, mould growth, condensation patterns, and moisture at reveals, junctions and below-ground elements.",
    multiFindingGuidance:
      "One photograph may show more than one area of moisture. Return one observation per distinct affected area and do not merge them.",
    descriptionGuidance:
      "Describe the pattern, its extent and its position, and say what in the image supports calling it active or historic.",
    causeGuidance:
      "Offer the most likely mechanism — penetrating, rising, plumbing leak or condensation — as an assessment, never as a finding of fact. Where the image will not support one, return null.",
    remedialGuidance:
      "Set out the investigation needed to confirm the source before any making good, then the making good itself.",
    failCriteria:
      "Damp-looking surfaces, fresh tide marks, active droplets or run marks, mould growth, or salting and blistering that indicate moisture is still reaching the element.",
    excludeCriteria:
      "Wet trades still curing, recent cleaning or wash-down water, and construction moisture in a newly poured element are NOT findings.",
    peopleGuidance:
      "Describe the fabric only. Do NOT describe, identify, count or characterise any person visible in the photograph.",
    tradeGuidance:
      "This survey type records evidence rather than attributing fault. Return suggested_trade as null unless the source is unambiguous in the photograph.",
    abstainGuidance:
      "If the photograph is too dark, distant or obstructed to tell moisture from shadow, dirt or a surface pattern, return not_assessed.",
  },
  defaultRemedial:
    "Investigate to confirm the source of moisture, remedy the source, allow the element to dry, then make good the affected finishes.",
  outputSections: ["cover", "scope", "methodology", "summary", "schedule", "appendix"],
  requiresTradeAssignment: false,
  requiresLifecycle: true,
  supportsDistribution: false,
};

/** Every system definition, in picker order. */
export const systemDefinitions: SurveyDefinition[] = [
  snaggingDefinition,
  siteWalkDefinition,
  weatherproofingDefinition,
  propertyInventoryDefinition,
  electricalInstallationDefinition,
  mechanicalServicesDefinition,
  fitOutQualityDefinition,
  dampMoistureDefinition,
];


export function getDefinition(id: string): SurveyDefinition | undefined {
  return systemDefinitions.find((definition) => definition.id === id);
}

/** A definition is frozen into the report at creation — never referenced live. */
export function snapshotOf(definition: SurveyDefinition): SurveyDefinition {
  return structuredClone(definition);
}
