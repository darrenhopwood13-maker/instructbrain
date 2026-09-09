/**
 * Email sending, server-side only.
 *
 * Every function here is triggered by an explicit human action in the UI.
 * Nothing in this file is called on a schedule, on report issue, or from any
 * automatic path — invariant 6 is absolute.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EmailConfigurationError, EmailProviderError, isResendConfigured } from "./config";
import { sendRenderedEmail } from "./resend.server";
import {
  assertNoConfidentialItems,
  renderEmail,
  type EmailMessage,
  type ExtractItem,
} from "./templates";
import { resolveSeverity, type SurveyTypeSnapshot } from "@/lib/survey-types";
import { absoluteUrl } from "@/lib/site-url";
import { shareUrlForToken } from "@/lib/report/share-url";

type Db = SupabaseClient<any, any, any>;

export type SendOutcome = {
  ok: boolean;
  /** The distribution row written for this send, when the send is report-linked. */
  distributionId: string | null;
  providerMessageId: string | null;
  error: string | null;
};

function actorName(claims: Record<string, unknown> | null | undefined, fallback: string): string {
  const meta = (claims?.["user_metadata"] ?? {}) as Record<string, unknown>;
  const name = typeof meta["full_name"] === "string" ? meta["full_name"].trim() : "";
  const email = typeof claims?.["email"] === "string" ? (claims["email"] as string) : "";
  return name || email || fallback;
}

function gbDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Distribution bookkeeping                                             */
/* ------------------------------------------------------------------ */

type DistributionSeed = {
  reportId: string;
  directoryId?: string | null;
  trade?: string | null;
  findingIds: string[];
  recipient: { email: string; name?: string | null };
  message: EmailMessage;
  sentBy: string;
};

/** The stored payload never carries the PDF: it would bloat every row. */
function withoutAttachment(data: EmailMessage["data"]): Record<string, unknown> {
  const { attachment: _attachment, ...rest } = data as Record<string, unknown>;
  return rest;
}

async function openDistribution(db: Db, seed: DistributionSeed): Promise<string | null> {

  const { data, error } = await db
    .from("distributions")
    .insert({
      report_id: seed.reportId,
      directory_id: seed.directoryId ?? null,
      trade: seed.trade ?? null,
      channel: "email",
      recipient_snapshot: {
        email: seed.recipient.email,
        name: seed.recipient.name ?? null,
        // Kept so a failed send can be retried without rebuilding the payload.
        template: seed.message.template,
        template_data: withoutAttachment(seed.message.data),

      },
      finding_ids: seed.findingIds,
      sent_by: seed.sentBy,
      status: "sending",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[email] could not open a distribution row:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

async function closeDistribution(
  db: Db,
  distributionId: string | null,
  patch: { status: string; providerMessageId?: string | null; error?: string | null },
): Promise<void> {
  if (!distributionId) return;
  const update: Record<string, unknown> = {
    status: patch.status,
    error: patch.error ?? null,
  };
  if (patch.status === "sent") update["sent_at"] = new Date().toISOString();
  if (patch.providerMessageId) {
    const { data } = await db
      .from("distributions")
      .select("recipient_snapshot")
      .eq("id", distributionId)
      .single();
    const snapshot = ((data as { recipient_snapshot?: Record<string, unknown> } | null)
      ?.recipient_snapshot ?? {}) as Record<string, unknown>;
    update["recipient_snapshot"] = { ...snapshot, provider_message_id: patch.providerMessageId };
  }
  const { error } = await db.from("distributions").update(update).eq("id", distributionId);
  if (error) console.error("[email] could not update a distribution row:", error.message);
}

async function audit(
  db: Db,
  entry: { reportId: string | null; findingId?: string | null; action: string; after: unknown },
  actorId: string,
): Promise<void> {
  await db.from("audit_log").insert({
    report_id: entry.reportId,
    finding_id: entry.findingId ?? null,
    actor_id: actorId,
    action: entry.action,
    before: null,
    after: entry.after as never,
  });
}

/**
 * The single send path. Writes the distribution row, sends, records the real
 * outcome. A configuration failure is re-thrown so the person who pressed the
 * button sees it — it is never recorded as a success.
 */
async function dispatch(
  db: Db,
  seed: DistributionSeed | null,
  to: string,
  message: EmailMessage,
): Promise<SendOutcome> {
  const rendered = renderEmail(message);
  const distributionId = seed ? await openDistribution(db, seed) : null;

  try {
    const result = await sendRenderedEmail(to, rendered, {
      tags: [{ name: "template", value: message.template }],
    });
    await closeDistribution(db, distributionId, {
      status: "sent",
      providerMessageId: result.providerMessageId,
    });
    return {
      ok: true,
      distributionId,
      providerMessageId: result.providerMessageId,
      error: null,
    };
  } catch (error) {
    const detail =
      error instanceof EmailProviderError
        ? error.providerError || error.message
        : error instanceof Error
          ? error.message
          : String(error);
    await closeDistribution(db, distributionId, { status: "failed", error: detail });
    if (error instanceof EmailConfigurationError) throw error;
    throw new Error(detail);
  }
}

/* ------------------------------------------------------------------ */
/* Status for the admin panel                                          */
/* ------------------------------------------------------------------ */

export type EmailStatus = {
  configured: boolean;
  fromAddress: string;
  replyToAddress: string;
  senderDomain: string;
  webhookConfigured: boolean;
};

export async function emailStatus(): Promise<EmailStatus> {
  const { FROM_ADDRESS, REPLY_TO_ADDRESS, SENDER_DOMAIN } = await import("./config");
  return {
    configured: isResendConfigured(process.env["RESEND_API_KEY"]),
    fromAddress: FROM_ADDRESS,
    replyToAddress: REPLY_TO_ADDRESS,
    senderDomain: SENDER_DOMAIN,
    webhookConfigured: !!(process.env["RESEND_WEBHOOK_SECRET"] ?? "").trim(),
  };
}

export type EmailFailure = {
  id: string;
  reportId: string;
  trade: string | null;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
  template: string | null;
};

export async function recentEmailFailures(db: Db, organisationId: string): Promise<EmailFailure[]> {
  const { data: reports } = await db
    .from("reports")
    .select("id")
    .eq("organisation_id", organisationId);
  const ids = ((reports ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length === 0) return [];

  const { data } = await db
    .from("distributions")
    .select("id, report_id, trade, recipient_snapshot, status, error, created_at")
    .in("report_id", ids)
    .in("status", ["failed", "bounced"])
    .order("created_at", { ascending: false })
    .limit(20);

  return ((data ?? []) as Array<Record<string, any>>).map((row) => ({
    id: row["id"] as string,
    reportId: row["report_id"] as string,
    trade: (row["trade"] as string | null) ?? null,
    recipient: (row["recipient_snapshot"]?.["email"] as string) ?? "unknown recipient",
    status: row["status"] as string,
    error: (row["error"] as string | null) ?? null,
    createdAt: row["created_at"] as string,
    template: (row["recipient_snapshot"]?.["template"] as string | null) ?? null,
  }));
}

/* ------------------------------------------------------------------ */
/* Sends                                                               */
/* ------------------------------------------------------------------ */

export async function sendTestEmail(
  db: Db,
  claims: Record<string, unknown> | null,
  organisationName: string,
): Promise<SendOutcome> {
  void db;
  const to = typeof claims?.["email"] === "string" ? (claims["email"] as string) : "";
  if (!to) throw new Error("Your account has no email address, so a test cannot be sent.");
  const rendered = renderEmail({
    template: "INVITE",
    data: {
      organisationName,
      invitedByName: "instructBrain",
      roleLabel: "a test of your email configuration",
      acceptUrl: absoluteUrl("/settings/organisation"),
    },
  });
  const result = await sendRenderedEmail(to, rendered, {
    tags: [{ name: "template", value: "TEST" }],
  });
  return {
    ok: true,
    distributionId: null,
    providerMessageId: result.providerMessageId,
    error: null,
  };
}

export async function sendInviteEmail(
  db: Db,
  input: {
    organisationId: string;
    email: string;
    roleLabel: string;
    acceptUrl: string;
  },
  actor: { id: string; claims: Record<string, unknown> | null },
): Promise<SendOutcome> {
  const { data: organisation } = await db
    .from("organisations")
    .select("name")
    .eq("id", input.organisationId)
    .single();

  const message: EmailMessage = {
    template: "INVITE",
    data: {
      organisationName: (organisation as { name?: string } | null)?.name ?? "your organisation",
      invitedByName: actorName(actor.claims, "A colleague"),
      roleLabel: input.roleLabel,
      acceptUrl: input.acceptUrl,
    },
  };

  // An invite is not tied to a report, so there is no distribution row: the
  // audit log carries it instead.
  const outcome = await dispatch(db, null, input.email, message);
  await audit(
    db,
    { reportId: null, action: "email.invite_sent", after: { to: input.email } },
    actor.id,
  );
  return outcome;
}

export async function sendReportSharedEmail(
  db: Db,
  input: { reportId: string; shareId: string; email: string; name?: string | null },
  actor: { id: string; claims: Record<string, unknown> | null },
): Promise<SendOutcome> {
  const { data: report, error } = await db
    .from("reports")
    .select("id, title, reference, report_date, issued_at, project_id, projects(name)")
    .eq("id", input.reportId)
    .single();
  if (error || !report) throw new Error("That report could not be read, so nothing was sent.");
  const row = report as Record<string, any>;

  const { data: share } = await db
    .from("report_shares")
    .select("token, expires_at, revoked_at")
    .eq("id", input.shareId)
    .single();
  if (!share) throw new Error("That share link no longer exists, so nothing was sent.");
  const shareRow = share as Record<string, any>;
  if (shareRow["revoked_at"]) {
    throw new Error("That share link has been revoked. Create a new link before sending.");
  }

  const { buildEmailPdf } = await import("@/lib/report/pdf-attachment.server");
  const attachment = await buildEmailPdf(db, input.reportId, { variant: "full" });

  const message: EmailMessage = {
    template: "REPORT_SHARED",
    data: {
      reportTitle: row["title"] as string,
      projectName: (row["projects"]?.["name"] as string) ?? "this project",
      reference: (row["reference"] as string | null) ?? null,
      issueDate: gbDate((row["issued_at"] as string | null) ?? (row["report_date"] as string)),
      sentByName: actorName(actor.claims, "Your surveyor"),
      shareUrl: shareUrlForToken(shareRow["token"] as string),
      expiresOn: gbDate(shareRow["expires_at"] as string | null),
      attachment,
    },
  };


  const outcome = await dispatch(
    db,
    {
      reportId: input.reportId,
      findingIds: [],
      recipient: { email: input.email, name: input.name ?? null },
      message,
      sentBy: actor.id,
    },
    input.email,
    message,
  );
  await audit(
    db,
    {
      reportId: input.reportId,
      action: "email.report_shared",
      after: { to: input.email, share_id: input.shareId },
    },
    actor.id,
  );
  return outcome;
}

/** Builds the trade extract items straight from the database, confidential excluded. */
export async function buildTradeExtractItems(
  db: Db,
  reportId: string,
  trade: string | null,
): Promise<{ items: ExtractItem[]; findingIds: string[]; snapshot: SurveyTypeSnapshot | null }> {
  const { data: report } = await db
    .from("reports")
    .select("survey_type_snapshot")
    .eq("id", reportId)
    .single();
  const snapshot = ((report as { survey_type_snapshot?: unknown } | null)?.survey_type_snapshot ??
    null) as SurveyTypeSnapshot | null;

  let query = db
    .from("findings")
    .select(
      "id, ref, severity, remedial_text, finding_text, due_date, is_confidential, capture_fields",
    )
    .eq("report_id", reportId)
    .eq("is_confidential", false);

  // A null trade is the fallback set: everything nobody has been given yet.
  query = trade === null ? query.is("assigned_trade", null) : query.eq("assigned_trade", trade);

  const { data, error } = await query.order("sequence", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, any>>;

  // The covering list is read by the subcontractor, so it follows the report's
  // issue language. English is used unchanged if the translation is unavailable.
  const { data: languageRow } = await db
    .from("reports")
    .select("output_language")
    .eq("id", reportId)
    .single();
  const outputLanguage =
    ((languageRow as { output_language?: string } | null)?.output_language ?? "en") || "en";
  let translated: Record<string, string> = {};
  if (outputLanguage !== "en") {
    try {
      const { reportTranslationStrings } = await import("@/lib/i18n/report-translation.server");
      translated = (await reportTranslationStrings(db, reportId, outputLanguage)).strings;
    } catch (translationError) {
      console.error("Trade extract translation failed", translationError);
    }
  }

  const items: ExtractItem[] = rows.map((row) => {
    const fields = (row["capture_fields"] ?? {}) as Record<string, string>;
    return {
      ref: row["ref"] as string,
      location: fields["location"] ?? fields["zone"] ?? fields["area"] ?? "",
      action:
        translated[`${row["id"] as string}.remedial_text`] ||
        translated[`${row["id"] as string}.finding_text`] ||
        (row["remedial_text"] as string) ||
        (row["finding_text"] as string) ||
        "",
      severityLabel: resolveSeverity(snapshot, row["severity"] as string | null)?.label ?? "",
      dueDate: (row["due_date"] as string | null) ?? null,
      isConfidential: row["is_confidential"] === true,
    };
  });

  // Belt and braces before anything is rendered or sent.
  assertNoConfidentialItems(items);

  return { items, findingIds: rows.map((row) => row["id"] as string), snapshot };
}

/**
 * Where the recipient can respond. A live trade link, scoped to their own
 * items, when one exists — otherwise the report itself, which needs an
 * account.
 */
async function itemListUrlFor(db: Db, reportId: string, trade: string | null): Promise<string> {
  if (trade === null) return absoluteUrl(`/reports/${reportId}`);
  const { data } = await db
    .from("trade_access")
    .select("token, revoked_at, expires_at")
    .eq("report_id", reportId)
    .eq("trade", trade)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = ((data ?? []) as Array<Record<string, any>>)[0];
  const expires = row?.["expires_at"] as string | null | undefined;
  const live = row && (!expires || new Date(expires).getTime() > Date.now());
  return live ? absoluteUrl(`/trade/${row["token"] as string}`) : absoluteUrl(`/reports/${reportId}`);
}

export async function sendTradeExtractEmail(
  db: Db,
  input: {
    reportId: string;
    /** Null sends the unassigned set to the project's fallback recipient. */
    trade: string | null;
    email: string;
    name?: string | null;
    directoryId?: string | null;
  },
  actor: { id: string; claims: Record<string, unknown> | null },
): Promise<SendOutcome> {
  const { data: report, error } = await db
    .from("reports")
    .select("id, reference, project_id, projects(name)")
    .eq("id", input.reportId)
    .single();
  if (error || !report) throw new Error("That report could not be read, so nothing was sent.");
  const row = report as Record<string, any>;

  const { items, findingIds } = await buildTradeExtractItems(db, input.reportId, input.trade);
  if (items.length === 0) {
    throw new Error(
      input.trade === null
        ? "Every item on this report is assigned to a trade, so there was nothing to send to the fallback recipient."
        : `There are no items assigned to ${input.trade} on this report, so nothing was sent.`,
    );
  }

  const tradeLabel = input.trade ?? "Unassigned items";

  // Confidential items are already excluded above; the PDF builder excludes
  // them again for the trade variant.
  const { buildEmailPdf } = await import("@/lib/report/pdf-attachment.server");
  const attachment = await buildEmailPdf(db, input.reportId, {
    variant: "trade",
    trade: input.trade,
  });

  const message: EmailMessage = {
    template: "TRADE_EXTRACT",
    data: {
      projectName: (row["projects"]?.["name"] as string) ?? "this project",
      reportReference: (row["reference"] as string | null) ?? null,
      trade: tradeLabel,
      items,
      itemListUrl: await itemListUrlFor(db, input.reportId, input.trade),
      sentByName: actorName(actor.claims, "Your surveyor"),
      attachment,
    },
  };


  const outcome = await dispatch(
    db,
    {
      reportId: input.reportId,
      directoryId: input.directoryId ?? null,
      trade: input.trade,
      findingIds,
      recipient: { email: input.email, name: input.name ?? null },
      message,
      sentBy: actor.id,
    },
    input.email,
    message,
  );
  await audit(
    db,
    {
      reportId: input.reportId,
      action: "email.trade_extract_sent",
      after: { to: input.email, trade: tradeLabel, refs: items.map((item) => item.ref) },
    },
    actor.id,
  );
  return outcome;
}


export async function sendCloseOutRequestEmail(
  db: Db,
  input: { reportId: string; findingId: string; email: string; name?: string | null },
  actor: { id: string; claims: Record<string, unknown> | null },
): Promise<SendOutcome> {
  const { data: finding, error } = await db
    .from("findings")
    .select("id, ref, remedial_text, finding_text, due_date, is_confidential, capture_fields")
    .eq("id", input.findingId)
    .single();
  if (error || !finding) throw new Error("That item could not be read, so nothing was sent.");
  const row = finding as Record<string, any>;
  if (row["is_confidential"] === true) {
    throw new Error("A confidential item cannot be sent outside the organisation. Nothing was sent.");
  }

  const { data: report } = await db
    .from("reports")
    .select("projects(name)")
    .eq("id", input.reportId)
    .single();
  const fields = (row["capture_fields"] ?? {}) as Record<string, string>;

  const { buildEmailPdf } = await import("@/lib/report/pdf-attachment.server");
  const attachment = await buildEmailPdf(db, input.reportId, {
    variant: "item",
    findingIds: [input.findingId],
  });

  const message: EmailMessage = {
    template: "CLOSE_OUT_REQUEST",
    data: {
      ref: row["ref"] as string,
      location: fields["location"] ?? fields["zone"] ?? fields["area"] ?? "Not recorded",
      requiredAction: (row["remedial_text"] as string) || (row["finding_text"] as string) || "",
      targetDate: (row["due_date"] as string | null) ?? null,
      projectName: ((report as Record<string, any>)?.["projects"]?.["name"] as string) ?? "this project",
      itemListUrl: absoluteUrl(`/reports/${input.reportId}`),
      sentByName: actorName(actor.claims, "Your surveyor"),
      attachment,
    },
  };


  const outcome = await dispatch(
    db,
    {
      reportId: input.reportId,
      findingIds: [input.findingId],
      recipient: { email: input.email, name: input.name ?? null },
      message,
      sentBy: actor.id,
    },
    input.email,
    message,
  );
  await audit(
    db,
    {
      reportId: input.reportId,
      findingId: input.findingId,
      action: "email.close_out_requested",
      after: { to: input.email, ref: row["ref"] },
    },
    actor.id,
  );
  return outcome;
}

/**
 * Re-sends a failed or bounced distribution from its stored payload. A person
 * presses the button; nothing retries itself.
 */
export async function retryDistribution(
  db: Db,
  distributionId: string,
  actor: { id: string; claims: Record<string, unknown> | null },
): Promise<SendOutcome> {
  void actor;
  const { data, error } = await db
    .from("distributions")
    .select("id, report_id, recipient_snapshot")
    .eq("id", distributionId)
    .single();
  if (error || !data) throw new Error("That send could not be found.");
  const snapshot = ((data as Record<string, any>)["recipient_snapshot"] ?? {}) as Record<
    string,
    any
  >;
  const to = snapshot["email"] as string | undefined;
  const template = snapshot["template"] as EmailMessage["template"] | undefined;
  const templateData = snapshot["template_data"];
  if (!to || !template || !templateData) {
    throw new Error("This send is too old to retry. Send it again from the report.");
  }

  const message = { template, data: templateData } as EmailMessage;
  const rendered = renderEmail(message);
  try {
    const result = await sendRenderedEmail(to, rendered, {
      tags: [{ name: "template", value: template }],
    });
    await closeDistribution(db, distributionId, {
      status: "sent",
      providerMessageId: result.providerMessageId,
      error: null,
    });
    return { ok: true, distributionId, providerMessageId: result.providerMessageId, error: null };
  } catch (retryError) {
    const detail =
      retryError instanceof EmailProviderError
        ? retryError.providerError || retryError.message
        : retryError instanceof Error
          ? retryError.message
          : String(retryError);
    await closeDistribution(db, distributionId, { status: "failed", error: detail });
    throw retryError;
  }
}
