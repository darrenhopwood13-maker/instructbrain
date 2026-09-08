/**
 * Typed email templates.
 *
 * Every template renders both an HTML part and a plain-text alternative, from
 * one payload. Restrained and document-adjacent: these land in the inboxes of
 * tier-1 clients and subcontractors. No marketing language, no emoji.
 *
 * Pure functions — no provider, no database, no environment. That is what
 * makes the confidentiality assertion below testable.
 */

import { itemLabel } from "@/lib/item-label";

export type EmailTemplateName =
  | "INVITE"
  | "REPORT_SHARED"
  | "TRADE_EXTRACT"
  | "CLOSE_OUT_REQUEST";

export type EmailAttachment = {
  filename: string;
  /** Base64-encoded content. */
  content: string;
  contentType?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  attachments: EmailAttachment[];
};

/** A finding as it appears in a distribution. Confidential items must not be here. */
export type ExtractItem = {
  ref: string;
  location: string;
  action: string;
  severityLabel: string;
  dueDate: string | null;
  isConfidential: boolean;
};

export type InvitePayload = {
  organisationName: string;
  invitedByName: string;
  acceptUrl: string;
  roleLabel: string;
};

export type ReportSharedPayload = {
  reportTitle: string;
  projectName: string;
  reference: string | null;
  issueDate: string | null;
  sentByName: string;
  shareUrl: string;
  /** Plain-English expiry, e.g. "12 May 2026" or null for no expiry. */
  expiresOn: string | null;
  /** The report itself, as a PDF. Null when it was too large to attach. */
  attachment?: EmailAttachment | null;
};


export type TradeExtractPayload = {
  projectName: string;
  reportReference: string | null;
  trade: string;
  items: ExtractItem[];
  /** Live list the recipient can open and respond on, without an account. */
  itemListUrl: string;
  sentByName: string;
  attachment?: EmailAttachment | null;
};

export type CloseOutPayload = {
  ref: string;
  location: string;
  requiredAction: string;
  targetDate: string | null;
  projectName: string;
  itemListUrl: string;
  sentByName: string;
  attachment?: EmailAttachment | null;
};


export type EmailMessage =
  | { template: "INVITE"; data: InvitePayload }
  | { template: "REPORT_SHARED"; data: ReportSharedPayload }
  | { template: "TRADE_EXTRACT"; data: TradeExtractPayload }
  | { template: "CLOSE_OUT_REQUEST"; data: CloseOutPayload };

/**
 * Invariant 7, second line of defence. The distribution query and the database
 * trigger already exclude confidential findings; the builder refuses to render
 * one even if both were bypassed.
 */
export class ConfidentialFindingError extends Error {
  readonly refs: string[];

  constructor(refs: string[]) {
    super(
      `Confidential findings cannot be distributed to a subcontractor: ${refs.join(", ")}. ` +
        "Nothing was sent.",
    );
    this.name = "ConfidentialFindingError";
    this.refs = refs;
  }
}

export function assertNoConfidentialItems(items: ExtractItem[]): void {
  const refs = items.filter((item) => item.isConfidential).map((item) => item.ref);
  if (refs.length > 0) throw new ConfidentialFindingError(refs);
}

/** Severity counts, in first-seen order, for the extract summary. */
export function severityBreakdown(items: ExtractItem[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item.severityLabel || "Unclassified";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

/** Earliest target date across the items, or null when none is set. */
export function earliestTargetDate(items: ExtractItem[]): string | null {
  const dates = items
    .map((item) => item.dueDate)
    .filter((date): date is string => !!date)
    .sort();
  return dates[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Shell                                                                */
/* ------------------------------------------------------------------ */

const INK = "#101c33";
const MUTED = "#5a6478";
const RULE = "#d9dee8";
const ACCENT = "#ff5e00";
const PAPER = "#ffffff";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;text-align:left;">
<tr><td style="padding-bottom:16px;border-bottom:1px solid ${RULE};">
<span style="font-size:15px;letter-spacing:0.04em;font-weight:700;color:${ACCENT};">instruct</span><span style="font-size:15px;letter-spacing:0.04em;font-weight:700;color:${INK};">Brain</span>
</td></tr>
<tr><td style="padding:24px 0 8px;">${body}</td></tr>
<tr><td style="padding-top:20px;border-top:1px solid ${RULE};font-size:12px;line-height:1.6;color:${MUTED};">
An instructSite company.<br />This message was sent by a person using instructBrain. Nothing is sent automatically.
</td></tr>
</table></td></tr></table></body></html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${INK};">${esc(text)}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${esc(text)}</p>`;
}

function small(text: string): string {
  return `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:${MUTED};">${esc(text)}</p>`;
}

function button(label: string, url: string): string {
  return `<p style="margin:0 0 18px;"><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;background:${ACCENT};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">${esc(label)}</a></p>
<p style="margin:0 0 18px;font-size:12px;line-height:1.6;color:${MUTED};word-break:break-all;">${esc(url)}</p>`;
}

function definitions(rows: Array<[string, string]>): string {
  const cells = rows
    .filter(([, value]) => !!value)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${MUTED};white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;color:${INK};">${esc(value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${cells}</table>`;
}

function itemTable(items: ExtractItem[]): string {
  const head = `<tr>${["Item", "Location", "Required action", "Severity", "Target"]
    .map(
      (label) =>
        `<th align="left" style="padding:6px 10px 6px 0;font-size:12px;color:${MUTED};border-bottom:1px solid ${RULE};font-weight:600;">${label}</th>`,
    )
    .join("")}</tr>`;
  const rows = items
    .map(
      (item) =>
        `<tr>` +
        [
          itemLabel(item.ref),
          item.location || "—",
          item.action || "—",
          item.severityLabel || "Unclassified",
          item.dueDate ?? "Not set",
        ]
          .map(
            (value) =>
              `<td style="padding:8px 10px 8px 0;font-size:13px;line-height:1.5;color:${INK};border-bottom:1px solid ${RULE};vertical-align:top;">${esc(value)}</td>`,
          )
          .join("") +
        `</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${head}${rows}</table>`;
}

function textShell(lines: string[]): string {
  return ["instructBrain", "", ...lines, "", "—", "An instructSite company.", "This message was sent by a person using instructBrain. Nothing is sent automatically."].join(
    "\n",
  );
}

/* ------------------------------------------------------------------ */
/* Templates                                                            */
/* ------------------------------------------------------------------ */

export function renderEmail(message: EmailMessage): RenderedEmail {
  switch (message.template) {
    case "INVITE":
      return renderInvite(message.data);
    case "REPORT_SHARED":
      return renderReportShared(message.data);
    case "TRADE_EXTRACT":
      return renderTradeExtract(message.data);
    case "CLOSE_OUT_REQUEST":
      return renderCloseOut(message.data);
  }
}

function renderInvite(data: InvitePayload): RenderedEmail {
  const subject = `You have been invited to ${data.organisationName} on instructBrain`;
  const html = shell(subject, [
    h1(`Join ${data.organisationName}`),
    p(
      `${data.invitedByName} has invited you to work on reports for ${data.organisationName} as ${data.roleLabel}.`,
    ),
    button("Accept the invitation", data.acceptUrl),
    small("You will be asked to set a password when you accept. The link is for you alone."),
  ].join(""));
  const text = textShell([
    `Join ${data.organisationName}`,
    "",
    `${data.invitedByName} has invited you to work on reports for ${data.organisationName} as ${data.roleLabel}.`,
    "",
    `Accept the invitation: ${data.acceptUrl}`,
    "",
    "You will be asked to set a password when you accept. The link is for you alone.",
  ]);
  return { subject, html, text, attachments: [] };
}

function renderReportShared(data: ReportSharedPayload): RenderedEmail {
  const subject = data.reference
    ? `${data.reportTitle} (${data.reference}) — ${data.projectName}`
    : `${data.reportTitle} — ${data.projectName}`;
  const expiry = data.expiresOn
    ? `This link expires on ${data.expiresOn}. Save your own copy before then.`
    : "This link stays live until it is withdrawn. Save your own copy for your records.";
  const html = shell(subject, [
    h1(data.reportTitle),
    p(`${data.sentByName} has shared a read-only copy of this report with you.`),
    definitions([
      ["Project", data.projectName],
      ["Reference", data.reference ?? ""],
      ["Issue date", data.issueDate ?? ""],
    ]),
    button("Open the report", data.shareUrl),
    small(expiry),
  ].join(""));
  const text = textShell([
    data.reportTitle,
    "",
    `${data.sentByName} has shared a read-only copy of this report with you.`,
    "",
    `Project: ${data.projectName}`,
    data.reference ? `Reference: ${data.reference}` : "",
    data.issueDate ? `Issue date: ${data.issueDate}` : "",
    "",
    `Open the report: ${data.shareUrl}`,
    "",
    expiry,
  ]);
  return { subject, html, text, attachments: [] };
}

function renderTradeExtract(data: TradeExtractPayload): RenderedEmail {
  // Second line of defence: refuse to render rather than send.
  assertNoConfidentialItems(data.items);

  const count = data.items.length;
  const breakdown = severityBreakdown(data.items);
  const earliest = earliestTargetDate(data.items);
  const subject = `${data.trade} — ${count} item${count === 1 ? "" : "s"} — ${data.projectName}${
    data.reportReference ? ` (${data.reportReference})` : ""
  }`;
  const breakdownLine = breakdown.map((entry) => `${entry.label}: ${entry.count}`).join(", ");

  const html = shell(subject, [
    h1(`${data.trade}: ${count} item${count === 1 ? "" : "s"} to action`),
    p(`${data.sentByName} has issued the items below from a survey of ${data.projectName}.`),
    definitions([
      ["Project", data.projectName],
      ["Report reference", data.reportReference ?? ""],
      ["Items", String(count)],
      ["Severity", breakdownLine],
      ["Earliest target date", earliest ?? "Not set"],
    ]),
    itemTable(data.items),
    button("Open the live item list", data.itemListUrl),
    small(
      data.attachment
        ? "A PDF of these items is attached. You can respond on the item list without an account."
        : "You can respond on the item list without an account.",
    ),
  ].join(""));

  const text = textShell([
    `${data.trade}: ${count} item${count === 1 ? "" : "s"} to action`,
    "",
    `${data.sentByName} has issued the items below from a survey of ${data.projectName}.`,
    "",
    `Project: ${data.projectName}`,
    data.reportReference ? `Report reference: ${data.reportReference}` : "",
    `Items: ${count}`,
    `Severity: ${breakdownLine}`,
    `Earliest target date: ${earliest ?? "Not set"}`,
    "",
    ...data.items.map(
      (item) =>
        `${itemLabel(item.ref)} — ${item.location || "location not recorded"} — ${item.action || "action not recorded"} — ${item.severityLabel || "Unclassified"} — target ${item.dueDate ?? "not set"}`,
    ),
    "",
    `Open the live item list: ${data.itemListUrl}`,
    "",
    data.attachment
      ? "A PDF of these items is attached. You can respond on the item list without an account."
      : "You can respond on the item list without an account.",
  ]);

  return {
    subject,
    html,
    text,
    attachments: data.attachment ? [data.attachment] : [],
  };
}

function renderCloseOut(data: CloseOutPayload): RenderedEmail {
  const subject = `Overdue: ${itemLabel(data.ref)} — ${data.projectName}`;
  const html = shell(subject, [
    h1(`${itemLabel(data.ref)} is overdue`),
    p(`${data.sentByName} is asking for an update on the item below.`),
    definitions([
      ["Project", data.projectName],
      ["Item", itemLabel(data.ref)],
      ["Location", data.location],
      ["Required action", data.requiredAction],
      ["Target date", data.targetDate ?? "Not set"],
    ]),
    button("Update this item", data.itemListUrl),
    small("Recording the close-out keeps the report complete and defensible."),
  ].join(""));
  const text = textShell([
    `${itemLabel(data.ref)} is overdue`,
    "",
    `${data.sentByName} is asking for an update on the item below.`,
    "",
    `Project: ${data.projectName}`,
    `Item: ${itemLabel(data.ref)}`,
    `Location: ${data.location}`,
    `Required action: ${data.requiredAction}`,
    `Target date: ${data.targetDate ?? "Not set"}`,
    "",
    `Update this item: ${data.itemListUrl}`,
  ]);
  return { subject, html, text, attachments: [] };
}
