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

export type ProjectStatus = "active" | "completed" | "archived";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

/** Unknown persisted values never become anything other than "active" by accident. */
export function coerceProjectStatus(value: unknown): ProjectStatus {
  return value === "completed" || value === "archived" ? value : "active";
}

export type Project = {
  id: string;
  name: string;
  reference: string;
  client: string;
  address: string;
  status: ProjectStatus;
  openReports: number;
  overdueItems: number;
};

/** A lightweight row for dashboard listings — not the full report record. */
export type RecentReport = {
  id: string;
  title: string;
  reference: string;
  status: ReportStatus;
  updated: string;
  /**
   * The same instant as `updated`, machine-readable, so the list can be narrowed by
   * period. Optional because some older fixtures and snapshots predate it; the list
   * query always supplies it, and a filter by period simply cannot judge a report
   * without one rather than guessing from the formatted label.
   */
  updatedAt?: string;
  /** Null for a quick report that has never been attached to a project. */
  projectId: string | null;
  isQuick: boolean;
  /**
   * The survey type's label as it stood when the report was made — the name the
   * report type is known by on this account. Null on a report that carries no
   * survey type at all, which is a real state and not the same as an empty name.
   */
  surveyLabel: string | null;
  /**
   * The organisation the report belongs to. References are unique per organisation,
   * so an account that spans two of them can legitimately show the same reference
   * twice - the name is what tells the reader that, rather than looking like a fault.
   */
  organisationName?: string | null;
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
  /** The author's name, or null. A placeholder is never acceptable here. */
  author: string | null;
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
  /** Per-finding capture fields, e.g. a short `item` label on inventory templates. */
  captureFields?: Record<string, string>;
  /**
   * The assessment's own one-line title for the item, where it wrote one.
   * A label, never the observation — see `findingHeading` in `lib/data`.
   */
  snagTitle?: string | null;

  /** The human's decision. Null until someone assigns a trade. */
  assignedTrade?: string | null;
  /** The AI's suggestion, kept even after a human overrides it. */
  aiSuggestedTrade?: string | null;
  aiTradeConfidence?: number | null;
  aiTradeReasoning?: string | null;
  /**
   * The condition grade. The person's decision, and the only value that reads
   * as fact; null until someone confirms one. The AI's proposal lives beside it.
   */
  conditionGrade?: string | null;
  aiSuggestedGrade?: string | null;
  aiGradeConfidence?: number | null;
  /** Derived from the severity's target window, then editable by a person. */
  dueDate?: string | null;
  dueDateOverridden?: boolean;
  lifecycleState?: string;

  /** Only defined by disciplines whose definition asks for it. */
  likelyCause?: string | null;
  likelyCauseConfirmed?: boolean;
  regulatoryReference?: string | null;
  regulatoryReferenceConfirmed?: boolean;
  /**
   * The clause a PERSON chose for that instrument, from the list the instrument supplies -
   * the publisher's own unit number as a string, e.g. "4". Never free text and never chosen
   * by a model, so this is only ever a number that is on the instrument's own list. Null
   * until somebody chooses one.
   */
  regulatoryClause?: string | null;
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
