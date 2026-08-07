import type { SurveyDefinition } from "@/lib/survey-types";

/** Lifecycle of the document itself, not of any finding within it. */
export type ReportStatus = "draft" | "in_review" | "issued";

export const reportStatusLabels: Record<ReportStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  issued: "Issued",
};

/** Unknown persisted values never become "issued" by accident. */
export function coerceReportStatus(value: unknown): ReportStatus {
  return value === "in_review" || value === "issued" ? value : "draft";
}

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
  /** Presentation split of `note`: the observation and the recommended action. */
  description?: string;
  remedial?: string;

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

export type OverdueItem = {
  id: string;
  ref: string;
  title: string;
  trade: string;
  due: string;
  /** Report the item belongs to, so the list can link straight to it. */
  reportId?: string;
  /** Severity id from that report's snapshot, for the worst-outstanding read. */
  severityId?: string | null;
  dueDate?: string;
  daysOverdue?: number;
};

