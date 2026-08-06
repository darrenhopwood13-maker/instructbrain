import type { SurveyTypeSnapshot } from "@/lib/survey-types";

export type ReportStatus = "draft" | "in_review" | "issued";

export type Project = {
  id: string;
  name: string;
  reference: string;
  client: string;
  address: string;
  openReports: number;
  overdueItems: number;
};

export type Report = {
  id: string;
  projectId: string;
  title: string;
  surveyType: string;
  /** Frozen copy of the survey type definition. Owns all discipline vocabulary. */
  surveyTypeSnapshot: SurveyTypeSnapshot;
  status: ReportStatus;
  reference: string;
  photoCount: number;
  findingCount: number;
  updated: string;
  author: string;
};

export type Finding = {
  id: string;
  /** Assigned once at creation and persisted. Never derived from position. */
  ref: string;
  title: string;
  location: string;
  trade: string;
  /** A status id defined by the report's survey type snapshot. */
  status: string;
  aiDrafted: boolean;
  confirmed: boolean;
  isConfidential: boolean;
  photoIds: string[];
  note: string;
};

export type DirectoryEntry = {
  id: string;
  trade: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
};

export const reportStatusLabels: Record<ReportStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  issued: "Issued",
};

/**
 * Sample survey type definition. In production this is a `survey_type_definitions`
 * row, frozen into the report as `survey_type_snapshot` at creation.
 */
export const prePlasterSnapshot: SurveyTypeSnapshot = {
  id: "std-pre-plaster",
  name: "Pre-plaster QA",
  version: 3,
  requiresLifecycle: true,
  statuses: [
    { id: "compliant", label: "Compliant", tone: "pass" },
    { id: "defective", label: "Defective", tone: "fail" },
    { id: "monitor", label: "Monitor", tone: "caution" },
    { id: "not_applicable", label: "Not applicable", tone: "neutral" },
    { id: "not_assessed", label: "Not assessed", tone: "unknown" },
  ],
  severities: ["Minor", "Significant", "Critical"],
  trades: ["Fire stopping", "Drylining", "Insulation", "M&E", "Structures"],
  captureFields: [
    { id: "location", label: "Location", type: "text" },
    { id: "grid_ref", label: "Grid reference", type: "text" },
  ],
  outputSections: ["Scope", "Methodology", "Observations", "Close-out"],
};

export const fireStoppingSnapshot: SurveyTypeSnapshot = {
  id: "std-fire-stopping",
  name: "Fire stopping audit",
  version: 2,
  requiresLifecycle: true,
  statuses: [
    { id: "sealed", label: "Sealed", tone: "pass" },
    { id: "breach", label: "Breach", tone: "fail" },
    { id: "partial", label: "Partially sealed", tone: "caution" },
    { id: "not_assessed", label: "Not assessed", tone: "unknown" },
  ],
  severities: ["Minor", "Significant", "Critical"],
  trades: ["Fire stopping", "M&E"],
  outputSections: ["Scope", "Methodology", "Breaches", "Close-out"],
};

export const projects: Project[] = [
  {
    id: "p-1042",
    name: "Ravensbourne Wharf, Phase 2",
    reference: "RW-2024-002",
    client: "Halloway Estates plc",
    address: "Deptford Creek, London SE8",
    openReports: 4,
    overdueItems: 6,
  },
  {
    id: "p-1043",
    name: "Kingsmead Academy Refurbishment",
    reference: "KMA-0117",
    client: "Fenchurch Borough Council",
    address: "Kingsmead Road, Manchester M14",
    openReports: 2,
    overdueItems: 0,
  },
  {
    id: "p-1044",
    name: "Bramfield Logistics Park, Unit C",
    reference: "BLP-C-0033",
    client: "Northgate Industrial LLP",
    address: "Bramfield, Leeds LS10",
    openReports: 1,
    overdueItems: 3,
  },
  {
    id: "p-1045",
    name: "St Aldate's Chambers",
    reference: "STA-2024-011",
    client: "Merrow & Vale Partners",
    address: "St Aldate's, Oxford OX1",
    openReports: 0,
    overdueItems: 0,
  },
];

export const reports: Report[] = [
  {
    id: "r-8801",
    projectId: "p-1042",
    title: "Level 06 — Pre-plaster inspection",
    surveyType: "Pre-plaster QA",
    surveyTypeSnapshot: prePlasterSnapshot,
    status: "in_review",
    reference: "RW-002/PP/06",
    photoCount: 148,
    findingCount: 37,
    updated: "2 hours ago",
    author: "H. Okonjo MRICS",
  },
  {
    id: "r-8802",
    projectId: "p-1042",
    title: "External envelope — Weekly progress",
    surveyType: "Progress record",
    surveyTypeSnapshot: prePlasterSnapshot,
    status: "draft",
    reference: "RW-002/EX/W12",
    photoCount: 62,
    findingCount: 0,
    updated: "Yesterday",
    author: "D. Whitfield",
  },
  {
    id: "r-8803",
    projectId: "p-1042",
    title: "Core B — Fire stopping audit",
    surveyType: "Fire stopping audit",
    surveyTypeSnapshot: fireStoppingSnapshot,
    status: "issued",
    reference: "RW-002/FS/B",
    photoCount: 211,
    findingCount: 54,
    updated: "12 June 2026",
    author: "H. Okonjo MRICS",
  },
  {
    id: "r-8804",
    projectId: "p-1043",
    title: "Block A — Handover snagging",
    surveyType: "Snagging",
    surveyTypeSnapshot: prePlasterSnapshot,
    status: "draft",
    reference: "KMA-0117/SN/A",
    photoCount: 0,
    findingCount: 0,
    updated: "3 days ago",
    author: "R. Patel",
  },
];

export const findings: Finding[] = [
  {
    id: "f-1",
    ref: "F-001",
    title: "Penetration through compartment wall not sealed",
    location: "Level 06, Core B riser",
    trade: "Fire stopping",
    status: "defective",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-11", "ph-12"],
    note: "Cable bundle passes through 60-minute compartment wall with no collar or batt seal present.",
  },
  {
    id: "f-2",
    ref: "F-002",
    title: "Insulation compressed behind service run",
    location: "Level 06, Grid E/4",
    trade: "Insulation",
    status: "monitor",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-12"],
    note: "Mineral wool compressed to approximately half depth behind horizontal containment.",
  },
  {
    id: "f-3",
    ref: "F-003",
    title: "Head restraint fixings correctly installed",
    location: "Level 06, Grid C/2",
    trade: "Drylining",
    status: "compliant",
    aiDrafted: true,
    confirmed: true,
    isConfidential: false,
    photoIds: ["ph-13"],
    note: "Deflection head detail matches approved drawing DL-204 Rev C.",
  },
  {
    id: "f-4",
    ref: "F-004",
    title: "Substrate could not be determined from the photograph",
    location: "Level 06, Grid A/7",
    trade: "Drylining",
    status: "not_assessed",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-14"],
    note: "Image is out of focus and the analysis returned low confidence. Re-photograph required before this finding can be resolved.",
  },
  {
    id: "f-5",
    ref: "F-005",
    title: "Temporary propping left in permanent works zone",
    location: "Level 06, Grid D/5",
    trade: "Structures",
    status: "defective",
    aiDrafted: false,
    confirmed: true,
    isConfidential: false,
    photoIds: ["ph-15"],
    note: "Raised on site with the works manager at time of inspection.",
  },
  {
    id: "f-6",
    ref: "F-006",
    title: "Access arrangement requires supervisor review",
    location: "Level 06, Core A stair",
    trade: "Structures",
    status: "not_assessed",
    aiDrafted: true,
    confirmed: false,
    isConfidential: true,
    photoIds: ["ph-16"],
    note: "Restricted record. Reviewed by supervisor and above only, and excluded from every subcontractor distribution.",
  },
];

export const directory: DirectoryEntry[] = [
  {
    id: "d-1",
    trade: "Fire stopping",
    company: "Meridian Passive Fire Ltd",
    contact: "Sean Carberry",
    email: "s.carberry@meridianpf.co.uk",
    phone: "0161 496 0114",
  },
  {
    id: "d-2",
    trade: "Drylining",
    company: "Ashcroft Interiors",
    contact: "Nadia Rahman",
    email: "nadia@ashcroftinteriors.co.uk",
    phone: "020 7946 0330",
  },
  {
    id: "d-3",
    trade: "M&E",
    company: "Trellick Building Services",
    contact: "Owen Priest",
    email: "o.priest@trellickbs.com",
    phone: "0113 496 2288",
  },
  {
    id: "d-4",
    trade: "Structures",
    company: "Kelmarsh Frame Contractors",
    contact: "Bridget Lowe",
    email: "b.lowe@kelmarshframe.co.uk",
    phone: "01604 231 990",
  },
];

export const overdueItems = [
  {
    id: "o-1",
    ref: "F-014",
    title: "Fire stopping omission — Core B riser, Level 04",
    trade: "Fire stopping",
    due: "Overdue by 9 days",
    status: "defective",
  },
  {
    id: "o-2",
    ref: "F-022",
    title: "Damaged vapour control layer not remediated",
    trade: "Drylining",
    due: "Overdue by 4 days",
    status: "defective",
  },
  {
    id: "o-3",
    ref: "F-031",
    title: "Missing photographic evidence of close-out",
    trade: "M&E",
    due: "Overdue by 1 day",
    status: "monitor",
  },
];

export const getProject = (id: string) => projects.find((p) => p.id === id);
export const getReport = (id: string) => reports.find((r) => r.id === id);
export const reportsForProject = (projectId: string) =>
  reports.filter((r) => r.projectId === projectId);
