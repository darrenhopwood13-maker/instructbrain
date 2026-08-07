import { supabase } from "@/integrations/supabase/client";
import { DataError } from "@/lib/data";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Trade links let a subcontractor respond without an account, exactly like a
 * report share link — but scoped to ONE trade's items on ONE report. They
 * never see another trade's work, and never a confidential finding.
 */

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function generateTradeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function tradeLinkUrl(token: string): string {
  return absoluteUrl(`/trade/${token}`);
}

export type TradeLink = {
  id: string;
  token: string;
  trade: string;
  label: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  url: string;
};

function table(name: string) {
  return supabase.from(name as never) as any;
}

function unwrap<T>(result: { data: T | null; error: any }): T {
  if (result.error) {
    throw new DataError(
      result.error.message,
      result.error.code,
      result.error.hint,
      result.error.details,
    );
  }
  return (result.data ?? []) as T;
}

export async function listTradeLinks(reportId: string): Promise<TradeLink[]> {
  const rows = unwrap(
    await table("trade_access")
      .select("id, token, trade, label, expires_at, revoked_at")
      .eq("report_id", reportId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ) as Array<Record<string, any>>;

  return rows.map((row) => ({
    id: row["id"] as string,
    token: row["token"] as string,
    trade: row["trade"] as string,
    label: (row["label"] as string | null) ?? null,
    expiresAt: (row["expires_at"] as string | null) ?? null,
    revokedAt: (row["revoked_at"] as string | null) ?? null,
    url: tradeLinkUrl(row["token"] as string),
  }));
}

/** One live link per trade: reuse before minting another. */
export async function ensureTradeLink(input: {
  reportId: string;
  organisationId: string;
  trade: string;
  label?: string | null;
}): Promise<TradeLink> {
  const existing = await listTradeLinks(input.reportId);
  const live = existing.find(
    (link) =>
      link.trade === input.trade &&
      (!link.expiresAt || new Date(link.expiresAt).getTime() > Date.now()),
  );
  if (live) return live;

  const token = generateTradeToken();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await table("trade_access")
    .insert({
      report_id: input.reportId,
      organisation_id: input.organisationId,
      trade: input.trade,
      token,
      label: input.label ?? input.trade,
      created_by: user.user?.id ?? null,
    })
    .select("id, token, trade, label, expires_at, revoked_at")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);

  const row = data as Record<string, any>;
  await table("audit_log").insert({
    report_id: input.reportId,
    actor_id: user.user?.id ?? null,
    action: "trade_link.created",
    after: { trade: input.trade },
  });

  return {
    id: row["id"] as string,
    token: row["token"] as string,
    trade: row["trade"] as string,
    label: (row["label"] as string | null) ?? null,
    expiresAt: null,
    revokedAt: null,
    url: tradeLinkUrl(row["token"] as string),
  };
}

export async function revokeTradeLink(linkId: string, reportId: string): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await table("trade_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  await table("audit_log").insert({
    report_id: reportId,
    actor_id: user.user?.id ?? null,
    action: "trade_link.revoked",
    after: { link_id: linkId },
  });
}
