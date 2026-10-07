import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EmailConfigurationError,
  isResendConfigured,
  resolveResendKey,
} from "@/lib/email/config";
import {
  ConfidentialFindingError,
  earliestTargetDate,
  renderEmail,
  severityBreakdown,
  type EmailMessage,
  type ExtractItem,
  type TradeExtractPayload,
} from "@/lib/email/templates";
import { actorName } from "@/lib/email/email.server";

const item = (over: Partial<ExtractItem> = {}): ExtractItem => ({
  ref: "F-001",
  location: "Stair core 2, level 4",
  action: "Reinstate the missing collar to the 110mm soil pipe penetration.",
  severityLabel: "Significant",
  dueDate: "2026-04-01",
  isConfidential: false,
  ...over,
});

const tradeExtract = (over: Partial<TradeExtractPayload> = {}): EmailMessage => ({
  template: "TRADE_EXTRACT",
  data: {
    projectName: "Ashby Wharf",
    reportReference: "AW-014",
    trade: "Dry lining",
    items: [item()],
    itemListUrl: "https://instructbrain.com/trade/abc123",
    sentByName: "A. Fenwick",
    attachment: null,
    ...over,
  },
});

const messages: EmailMessage[] = [
  {
    template: "INVITE",
    data: {
      organisationName: "Fenwick Surveying",
      invitedByName: "A. Fenwick",
      roleLabel: "a surveyor",
      acceptUrl: "https://instructbrain.com/auth/accept-invite?token=abc",
    },
  },
  {
    template: "REPORT_SHARED",
    data: {
      reportTitle: "Weatherproofing survey",
      projectName: "Ashby Wharf",
      reference: "AW-014",
      issueDate: "1 March 2026",
      sentByName: "A. Fenwick",
      shareUrl: "https://instructbrain.com/shared/abc123",
      expiresOn: null,
    },
  },
  {
    template: "TRADE_EXTRACT",
    data: {
      projectName: "Ashby Wharf",
      reportReference: "AW-014",
      trade: "Dry lining",
      items: [item(), item({ ref: "F-002", severityLabel: "Minor", dueDate: "2026-03-10" })],
      itemListUrl: "https://instructbrain.com/trade/abc123",
      sentByName: "A. Fenwick",
      attachment: null,
    },
  },
  {
    template: "CLOSE_OUT_REQUEST",
    data: {
      ref: "F-001",
      location: "Stair core 2",
      requiredAction: "Reinstate the collar.",
      targetDate: "2026-04-01",
      projectName: "Ashby Wharf",
      itemListUrl: "https://instructbrain.com/reports/r1",
      sentByName: "A. Fenwick",
    },
  },
];

describe("email templates", () => {
  it("renders an HTML and a plain-text part for every template", () => {
    for (const message of messages) {
      const rendered = renderEmail(message);
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html).toContain("<html");
      expect(rendered.text.length).toBeGreaterThan(0);
      expect(rendered.text).not.toContain("<");
      // Brand furniture, on every message.
      expect(rendered.html).toContain("AN INSTRUCTSITE COMPANY");
      expect(rendered.text).toContain("AN INSTRUCTSITE COMPANY");
    }
  });

  it("summarises severity and the earliest target date on a trade extract", () => {
    const items = [item(), item({ ref: "F-002", severityLabel: "Minor", dueDate: "2026-03-10" })];
    expect(severityBreakdown(items)).toEqual([
      { label: "Significant", count: 1 },
      { label: "Minor", count: 1 },
    ]);
    expect(earliestTargetDate(items)).toBe("2026-03-10");
  });

  it("refuses to build a trade extract containing a confidential finding", () => {
    const message: EmailMessage = {
      template: "TRADE_EXTRACT",
      data: {
        projectName: "Ashby Wharf",
        reportReference: "AW-014",
        trade: "Dry lining",
        items: [item(), item({ ref: "F-009", isConfidential: true })],
        itemListUrl: "https://instructbrain.com/trade/abc123",
        sentByName: "A. Fenwick",
        attachment: null,
      },
    };
    expect(() => renderEmail(message)).toThrow(ConfidentialFindingError);
    expect(() => renderEmail(message)).toThrow(/F-009/);
  });

  it("links the live item list when the recipient can open it without an account", () => {
    const rendered = renderEmail(tradeExtract());
    expect(rendered.html).toContain("Open the live item list");
    expect(rendered.html).toContain("https://instructbrain.com/trade/abc123");
    expect(rendered.text).toContain("https://instructbrain.com/trade/abc123");
    expect(rendered.html).toContain("You can respond on the item list without an account.");
  });

  it("sends no link, and promises nothing, when there is no page the recipient can open", () => {
    // A custom report has no trade, so there is no trade-scoped list. The
    // in-app report URL would ask the recipient to sign in to an account they
    // do not have, so it is never sent: no link, and no claim of one.
    const rendered = renderEmail(tradeExtract({ itemListUrl: null }));
    expect(rendered.html).not.toContain("Open the live item list");
    expect(rendered.text).not.toContain("Open the live item list");
    expect(rendered.html).not.toContain("without an account");
    expect(rendered.html).not.toContain("instructbrain.com/reports/");
    expect(rendered.text).not.toContain("instructbrain.com/reports/");
    expect(rendered.html).toContain("This is the record of the items above.");
  });

  it("still names the attachment when it cannot offer a link", () => {
    const rendered = renderEmail(
      tradeExtract({
        itemListUrl: null,
        attachment: { filename: "items.pdf", content: "JVBERi0=" },
      }),
    );
    expect(rendered.html).toContain("A PDF of these items is attached.");
    expect(rendered.html).not.toContain("without an account");
    expect(rendered.text).toContain("A PDF of these items is attached.");
  });

  it("hands a client a read-only copy when the report is issued", () => {
    const rendered = renderEmail(
      tradeExtract({
        itemListUrl: "https://instructbrain.com/shared/abc123",
        itemListIsReadOnly: true,
        attachment: { filename: "items.pdf", content: "JVBERi0=" },
      }),
    );
    expect(rendered.html).toContain("Open the report");
    expect(rendered.html).not.toContain("Open the live item list");
    expect(rendered.html).toContain("A read-only copy of the report is also online.");
    // A client reads it; only a trade link promises a page to respond on.
    expect(rendered.html).not.toContain("without an account");
    expect(rendered.text).toContain("Open the report: https://instructbrain.com/shared/abc123");
  });

  it("names the survey by its date when there is no project to name", () => {
    const rendered = renderEmail(
      tradeExtract({
        projectName: null,
        surveyDate: "6 October 2026",
        trade: "Site condition — 6 October 2026",
        reportReference: "SW-2026-10-002",
      }),
    );
    expect(rendered.html).toContain("a survey carried out on 6 October 2026");
    expect(rendered.html).not.toContain("this project");
    expect(rendered.text).not.toContain("this project");
    expect(rendered.text).not.toContain("Project:");
    expect(rendered.subject).toBe("Site condition — 6 October 2026 — 1 item (SW-2026-10-002)");
  });

  it("never turns an email address into a person's name", () => {
    // The chain used to be name, then address, then phrase — so an account with
    // no display name introduced itself to a subcontractor as an address.
    expect(actorName({ email: "someone@example.com" }, "Your surveyor")).toBe("Your surveyor");
    expect(actorName({ user_metadata: { full_name: "A. Fenwick" } }, "Your surveyor")).toBe(
      "A. Fenwick",
    );
    expect(actorName({ email: "someone@example.com", user_metadata: {} }, "A colleague")).toBe(
      "A colleague",
    );
    expect(actorName(null, "Your surveyor")).toBe("Your surveyor");
  });
});

describe("email configuration", () => {
  it("throws a visible error when the key is missing, never a silent success", () => {
    expect(() => resolveResendKey(undefined)).toThrow(EmailConfigurationError);
    expect(() => resolveResendKey("")).toThrow(/RESEND_API_KEY is missing/);
    expect(() => resolveResendKey("   ")).toThrow(/Nothing was sent/);
    expect(() => resolveResendKey("sk-not-a-resend-key")).toThrow(EmailConfigurationError);
    expect(isResendConfigured(undefined)).toBe(false);
    expect(isResendConfigured("re_live_abc")).toBe(true);
  });
});

describe("no automatic sending", () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

  it("does not send email from the issue, versioning or report data layer", () => {
    for (const path of [
      "src/lib/report/report-data.ts",
      "src/lib/report/document.ts",
    ]) {
      const source = read(path);
      expect(source).not.toContain("email.functions");
      expect(source).not.toContain("email.server");
      expect(source).not.toContain("sendRenderedEmail");
    }
    const actions = read("src/components/report/report-actions.tsx");
    expect(actions).not.toContain("email.server");
    expect(actions).not.toContain("sendRenderedEmail");
    expect(actions).toContain("onClick={() => emailPdf.mutate()}");
  });

  it("keeps the provider transport server-only", () => {
    const transport = read("src/lib/email/resend.server.ts");
    expect(transport).toContain("process.env");
    // The key is only ever read on the server, behind a .server module.
    expect(read("src/lib/email/templates.ts")).not.toContain("RESEND_API_KEY");
  });
});

describe("manual photographic PDF email", () => {
  it("attaches the issued PDF without a browser review link", () => {
    const attachment = { filename: "PHOTO-001.pdf", content: "JVBERi0=", contentType: "application/pdf" };
    const rendered = renderEmail({
      template: "MANUAL_REPORT_PDF",
      data: {
        reportTitle: "Photographic report",
        projectName: "Crowndean House",
        reference: "PHOTO-001",
        issueDate: "1 October 2026",
        sentByName: "A. Surveyor",
        attachment,
      },
    });
    expect(rendered.attachments).toEqual([attachment]);
    expect(rendered.html).not.toContain("Open the report");
    expect(rendered.html).not.toContain("/shared/");
    expect(rendered.text).toContain("attached as a PDF");
  });
});
