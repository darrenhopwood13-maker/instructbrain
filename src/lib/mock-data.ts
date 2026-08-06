import type { SurveyDefinition } from "@/lib/survey-types";
import {
  snaggingDefinition,
  siteWalkDefinition,
  weatherproofingDefinition,
  snapshotOf,
} from "@/lib/survey-definitions";

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
  /** Frozen copy of the survey type definition. Owns all discipline vocabulary. */
  surveyTypeSnapshot: SurveyDefinition;
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
  /** A severity id defined by the report's survey type snapshot. */
  severity?: string;
  /** A category id from whichever category list the definition provides. */
  category?: string;
  aiDrafted: boolean;
  confirmed: boolean;
  isConfidential: boolean;
  photoIds: string[];
  note: string;
  /** Only defined by disciplines whose definition asks for it. */
  likelyCause?: string | null;
  likelyCauseConfirmed?: boolean;
  regulatoryReference?: string | null;
  regulatoryReferenceConfirmed?: boolean;
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
    title: "Level 06 — Pre-handover inspection",
    surveyTypeSnapshot: snapshotOf(snaggingDefinition),
    status: "in_review",
    reference: "RW-002/SN/06",
    photoCount: 148,
    findingCount: 6,
    updated: "2 hours ago",
    author: "H. Okonjo MRICS",
  },
  {
    id: "r-8802",
    projectId: "p-1042",
    title: "Thursday walk — Levels 04 to 07",
    surveyTypeSnapshot: snapshotOf(siteWalkDefinition),
    status: "draft",
    reference: "RW-002/SW/W12",
    photoCount: 62,
    findingCount: 3,
    updated: "Yesterday",
    author: "D. Whitfield",
  },
  {
    id: "r-8803",
    projectId: "p-1042",
    title: "Podium roof — Membrane condition survey",
    surveyTypeSnapshot: snapshotOf(weatherproofingDefinition),
    status: "issued",
    reference: "RW-002/WP/PD",
    photoCount: 211,
    findingCount: 3,
    updated: "12 June 2026",
    author: "H. Okonjo MRICS",
  },
  {
    id: "r-8804",
    projectId: "p-1043",
    title: "Block A — Handover snagging",
    surveyTypeSnapshot: snapshotOf(snaggingDefinition),
    status: "draft",
    reference: "KMA-0117/SN/A",
    photoCount: 0,
    findingCount: 0,
    updated: "3 days ago",
    author: "R. Patel",
  },
];

/** Snagging findings — vocabulary comes from the snagging definition only. */
export const snaggingFindings: Finding[] = [
  {
    id: "f-1",
    ref: "F-001",
    title: "Sealant missing to head of door frame",
    location: "Level 06, Plot 6.04 hallway",
    trade: "Carpenter / joiner",
    status: "snag",
    severity: "workmanship",
    category: "joinery",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-11", "ph-12"],
    note: "Approximately 900mm of the frame head is unsealed, with a gap of 3–5mm to the plaster reveal.",
    likelyCause: "Second fix completed before the plaster reveal was made good.",
    likelyCauseConfirmed: false,
    regulatoryReference: "bs_8000",
    regulatoryReferenceConfirmed: false,
  },
  {
    id: "f-2",
    ref: "F-002",
    title: "Cracking to plaster at wall/ceiling junction",
    location: "Level 06, Plot 6.04 living room",
    trade: "Plasterer",
    status: "monitor",
    severity: "cosmetic",
    category: "wet_trades",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-12"],
    note: "Hairline crack running approximately 1.2m along the junction.",
    likelyCause: "Most likely shrinkage or minor settlement. Movement cannot be ruled out from the photograph alone.",
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  },
  {
    id: "f-3",
    ref: "F-003",
    title: "Tiling and grout line acceptable",
    location: "Level 06, Plot 6.04 bathroom",
    trade: "Tiler",
    status: "acceptable",
    severity: "cosmetic",
    category: "tiling",
    aiDrafted: true,
    confirmed: true,
    isConfidential: false,
    photoIds: ["ph-13"],
    note: "Setting out and grout joints consistent with the approved sample.",
    likelyCause: null,
    likelyCauseConfirmed: true,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: true,
  },
  {
    id: "f-4",
    ref: "F-004",
    title: "Element could not be identified from the photograph",
    location: "Level 06, Plot 6.05",
    trade: "",
    status: "not_assessed",
    category: "finishes",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["ph-14"],
    note: "Image is out of focus and the analysis returned low confidence. Re-photograph required before this finding can be resolved.",
    likelyCause: null,
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  },
  {
    id: "f-5",
    ref: "F-005",
    title: "Damaged plasterboard to riser cupboard reveal",
    location: "Level 06, Plot 6.05 hallway",
    trade: "Plasterer",
    status: "snag",
    severity: "workmanship",
    category: "wet_trades",
    aiDrafted: false,
    confirmed: true,
    isConfidential: false,
    photoIds: ["ph-15"],
    note: "Raised on site with the works manager at time of inspection.",
    likelyCause: "Impact damage during movement of materials.",
    likelyCauseConfirmed: true,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: true,
  },
  {
    id: "f-6",
    ref: "F-006",
    title: "Access arrangement requires supervisor review",
    location: "Level 06, Core A stair",
    trade: "Principal contractor",
    status: "not_assessed",
    category: "fire_safety",
    aiDrafted: true,
    confirmed: false,
    isConfidential: true,
    photoIds: ["ph-16"],
    note: "Restricted record. Reviewed by supervisor and above only, and excluded from every subcontractor distribution.",
    likelyCause: null,
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  },
];

/** Site walk findings — no likely cause or regulatory reference in this discipline. */
export const siteWalkFindings: Finding[] = [
  {
    id: "sw-1",
    ref: "O-001",
    title: "Pallets and offcuts obstructing the escape route",
    location: "Level 05, Core B lobby",
    trade: "Principal contractor",
    status: "observation",
    severity: "same_day",
    category: "fire_safety",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["sw-ph-1"],
    note: "Stacked pallets reduce the escape route to roughly 600mm clear width.",
  },
  {
    id: "sw-2",
    ref: "O-002",
    title: "Trailing leads across a walkway",
    location: "Level 04, Grid C/3",
    trade: "M&E",
    status: "observation",
    severity: "this_week",
    category: "electrical",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["sw-ph-2"],
    note: "Two 110V leads run uncovered across the main circulation route.",
  },
  {
    id: "sw-3",
    ref: "O-003",
    title: "Unsafe act recorded — restricted",
    location: "Level 07, external edge",
    trade: "",
    status: "observation",
    severity: "immediate",
    category: "ppe_behaviour",
    aiDrafted: true,
    confirmed: false,
    isConfidential: true,
    photoIds: ["sw-ph-3"],
    note: "Restricted record. Described as a general safety issue only, supervisor and above, excluded from every distribution.",
  },
];

/** Weatherproofing findings — single finding per photograph. */
export const weatherproofingFindings: Finding[] = [
  {
    id: "wp-1",
    ref: "M-001",
    title: "Lifted lap to single ply seam",
    location: "Podium roof, bay 3",
    trade: "",
    status: "damaged",
    severity: "high",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["wp-ph-1"],
    note: "Approximately 400mm of seam is debonded with the edge lifting clear of the substrate.",
  },
  {
    id: "wp-2",
    ref: "M-002",
    title: "Parapet upstand termination sound",
    location: "Podium roof, north parapet",
    trade: "",
    status: "intact",
    severity: "low",
    aiDrafted: true,
    confirmed: true,
    isConfidential: false,
    photoIds: ["wp-ph-2"],
    note: "Termination bar and sealant continuous, no lifting observed.",
  },
  {
    id: "wp-3",
    ref: "M-003",
    title: "Ponding adjacent to outlet",
    location: "Podium roof, bay 5 outlet",
    trade: "",
    status: "monitor",
    severity: "medium",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: ["wp-ph-3"],
    note: "Standing water approximately 2m² retained 48 hours after rainfall.",
  },
];

const findingSets: Record<string, Finding[]> = {
  [snaggingDefinition.id]: snaggingFindings,
  [siteWalkDefinition.id]: siteWalkFindings,
  [weatherproofingDefinition.id]: weatherproofingFindings,
};

export function findingsForSnapshot(snapshot: SurveyDefinition | null | undefined): Finding[] {
  return snapshot ? (findingSets[snapshot.id] ?? []) : [];
}

/** Default working set used by the review list. */
export const findings: Finding[] = snaggingFindings;

export const directory: DirectoryEntry[] = [
  {
    id: "d-1",
    trade: "Carpenter / joiner",
    company: "Meridian Joinery Ltd",
    contact: "Sean Carberry",
    email: "s.carberry@meridianjoinery.co.uk",
    phone: "0161 496 0114",
  },
  {
    id: "d-2",
    trade: "Plasterer",
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
    trade: "Principal contractor",
    company: "Kelmarsh Construction",
    contact: "Bridget Lowe",
    email: "b.lowe@kelmarshconstruction.co.uk",
    phone: "01604 231 990",
  },
];

export const overdueItems = [
  {
    id: "o-1",
    ref: "F-014",
    title: "Damaged door leaf not replaced — Plot 4.02",
    trade: "Carpenter / joiner",
    due: "Overdue by 9 days",
  },
  {
    id: "o-2",
    ref: "F-022",
    title: "Sealant to shower tray not reinstated",
    trade: "Tiler",
    due: "Overdue by 4 days",
  },
  {
    id: "o-3",
    ref: "O-031",
    title: "Trailing leads not cleared from access route",
    trade: "M&E",
    due: "Overdue by 1 day",
  },
];

export const getProject = (id: string) => projects.find((p) => p.id === id);
export const getReport = (id: string) => reports.find((r) => r.id === id);
export const reportsForProject = (projectId: string) =>
  reports.filter((r) => r.projectId === projectId);
