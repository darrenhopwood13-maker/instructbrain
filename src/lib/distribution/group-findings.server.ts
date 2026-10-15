/**
 * Which items a distribution group actually holds — resolved on the server.
 *
 * The plan screen groups by FIRM when a project has a directory, because a firm
 * is what receives an extract. A row's key is therefore a firm
 * (`firm:apex envelope`), not a trade. The send path used to take that key and
 * match it against `findings.assigned_trade`, which a firm name never matches:
 * every firm row failed with "There are no items assigned to firm:…, so nothing
 * was sent", while the row itself showed the items on screen. The plan knew the
 * items; the send did not.
 *
 * This resolves a group key the same way the plan does, and it uses the SAME
 * shared routing (`resolveFirmKey`) rather than a second opinion, so what a
 * person reviewed on screen is what goes out. It is also what the token link
 * uses, so a subcontractor opening their link sees the same set they were
 * emailed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  UNASSIGNED_GROUP,
  firmKeyOf,
  resolveFirmKey,
  type DirectoryHolder,
} from "@/lib/distribution";

type Db = SupabaseClient<any, any, any>;

/** The plan's key for a quick report: no directory, one document, one recipient. */
export const WHOLE_REPORT_GROUP = "__report__";

/** A uuid no finding can hold, so an empty group matches nothing. */
export const NO_MATCHING_ID = "00000000-0000-0000-0000-000000000000";

export type GroupScope =
  /** Items with no trade: the fallback set. */
  | { kind: "unassigned" }
  /** Every non-confidential item on the report. */
  | { kind: "whole-report" }
  /** Items carrying this exact trade. */
  | { kind: "trade"; trade: string }
  /** Items resolved to one firm. `label` is the firm's name, for a human. */
  | { kind: "findings"; ids: string[]; label: string | null };

/** A firm key is the plan's own marking, not a trade name. */
export function isFirmKey(key: string | null | undefined): boolean {
  return (key ?? "").trim().toLowerCase().startsWith("firm:");
}

type Routed = {
  id: string;
  firmKey: string | null;
  company: string | null;
  isConfidential: boolean;
};

/**
 * Every finding on a report, each carrying the firm it belongs to — the same
 * answer the plan screen computes, from the same directory and the same rules.
 */
export async function routeFindingsByFirm(db: Db, reportId: string): Promise<Routed[]> {
  const { data: reportRows } = await db
    .from("reports")
    .select("project_id")
    .eq("id", reportId)
    .limit(1);
  const projectId = ((reportRows ?? []) as Array<{ project_id?: string | null }>)[0]?.project_id;
  if (!projectId) return [];

  const { data: directoryRows } = await db
    .from("project_directory")
    .select("id, trade, company_name, is_active, directory_contacts(id)")
    .eq("project_id", projectId)
    .eq("is_active", true);

  const holdersByTrade = new Map<string, DirectoryHolder[]>();
  const firmByContact = new Map<string, string>();
  const companyByFirm = new Map<string, string>();

  for (const row of ((directoryRows ?? []) as Array<Record<string, any>>)) {
    const company = ((row["company_name"] as string | null) ?? "").trim() || "Unnamed firm";
    const key = firmKeyOf(company);
    if (key) {
      if (!companyByFirm.has(key)) companyByFirm.set(key, company);
      for (const contact of ((row["directory_contacts"] ?? []) as Array<Record<string, any>>)) {
        if (typeof contact["id"] === "string") firmByContact.set(contact["id"], key);
      }
    }
    const tradeKey = ((row["trade"] as string | null) ?? "").trim().toLowerCase();
    if (tradeKey !== "") {
      const holder: DirectoryHolder = {
        id: row["id"] as string,
        company,
        trade: (row["trade"] as string | null) ?? null,
        contactIds: ((row["directory_contacts"] ?? []) as Array<Record<string, any>>)
          .map((contact) => contact["id"])
          .filter((id): id is string => typeof id === "string"),
      };
      holdersByTrade.set(tradeKey, [...(holdersByTrade.get(tradeKey) ?? []), holder]);
    }
  }

  const { data: findingRows } = await db
    .from("findings")
    .select("id, sequence, assigned_trade, assigned_contact_id, is_confidential")
    .eq("report_id", reportId)
    .order("sequence", { ascending: true });

  return ((findingRows ?? []) as Array<Record<string, any>>).map((row) => {
    const firmKey = resolveFirmKey(
      {
        assignedTrade: (row["assigned_trade"] as string | null) ?? null,
        assignedContactId: (row["assigned_contact_id"] as string | null) ?? null,
      },
      holdersByTrade,
      firmByContact,
    );
    return {
      id: row["id"] as string,
      firmKey,
      company: firmKey ? (companyByFirm.get(firmKey) ?? null) : null,
      isConfidential: row["is_confidential"] === true,
    };
  });
}

/**
 * What a group key covers. `grouping` matters for one case only: the unassigned
 * group. Under the firm lens "nobody has this" means no firm resolved, which is
 * not the same set as "no trade" — an item on a trade held by two firms belongs
 * to nobody until a person decides, and it must still reach the fallback
 * recipient rather than quietly reaching no one.
 */
export async function resolveGroupScope(
  db: Db,
  reportId: string,
  key: string | null | undefined,
  grouping: string | null | undefined = "trade",
): Promise<GroupScope> {
  const trimmed = (key ?? "").trim();

  if (trimmed === WHOLE_REPORT_GROUP) return { kind: "whole-report" };

  if (trimmed === "" || trimmed === UNASSIGNED_GROUP) {
    if (grouping !== "subcontractor") return { kind: "unassigned" };
    const routed = await routeFindingsByFirm(db, reportId);
    return {
      kind: "findings",
      ids: routed
        .filter((finding) => finding.firmKey === null && !finding.isConfidential)
        .map((finding) => finding.id),
      label: null,
    };
  }

  if (!isFirmKey(trimmed)) return { kind: "trade", trade: trimmed };

  const routed = await routeFindingsByFirm(db, reportId);
  const held = routed.filter(
    (finding) => finding.firmKey === trimmed.toLowerCase() && !finding.isConfidential,
  );
  return {
    kind: "findings",
    ids: held.map((finding) => finding.id),
    label: routed.find((finding) => finding.firmKey === trimmed.toLowerCase())?.company ?? null,
  };
}
