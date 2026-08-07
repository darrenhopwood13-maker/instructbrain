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
} from "@/lib/email/templates";

const item = (over: Partial<ExtractItem> = {}): ExtractItem => ({
  ref: "F-001",
  location: "Stair core 2, level 4",
  action: "Reinstate the missing collar to the 110mm soil pipe penetration.",
  severityLabel: "Significant",
  dueDate: "2026-04-01",
  isConfidential: false,
  ...over,
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
      itemListUrl: "https://instructbrain.com/reports/r1",
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
      expect(rendered.html).toContain("An instructSite company");
      expect(rendered.text).toContain("An instructSite company");
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
        itemListUrl: "https://instructbrain.com/reports/r1",
        sentByName: "A. Fenwick",
        attachment: null,
      },
    };
    expect(() => renderEmail(message)).toThrow(ConfidentialFindingError);
    expect(() => renderEmail(message)).toThrow(/F-009/);
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
      "src/components/report/report-actions.tsx",
    ]) {
      const source = read(path);
      expect(source).not.toContain("email.functions");
      expect(source).not.toContain("email.server");
      expect(source).not.toContain("sendRenderedEmail");
    }
  });

  it("keeps the provider transport server-only", () => {
    const transport = read("src/lib/email/resend.server.ts");
    expect(transport).toContain("process.env");
    // The key is only ever read on the server, behind a .server module.
    expect(read("src/lib/email/templates.ts")).not.toContain("RESEND_API_KEY");
  });
});
