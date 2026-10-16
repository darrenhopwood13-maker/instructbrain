import { describe, expect, it } from "vitest";

import { renderEmail } from "@/lib/email/templates";

/**
 * The email that carries a report link.
 *
 * Dal: "when we send a report by link and we select by email, can we make sure
 * it's a branded link with details about viewing and downloading". The branded
 * template existed and had no button anywhere in the app, so the only way to send
 * a link was to paste it into a personal mail client - unbranded, and silent on
 * what the recipient was supposed to do with it.
 *
 * These assert the words a client will actually read, because that is the change:
 * the link is the same link it always was.
 */
const data = {
  reportTitle: "Electrical installation condition — 15 October 2026",
  projectName: "instructSite Development",
  reference: "EIC-2026-10-001",
  issueDate: "15 October 2026",
  sentByName: "Darren Hopwood",
  shareUrl: "https://instructbrain.com/shared/abc123",
  expiresOn: "14 November 2026",
  attachment: null,
};

describe("the email that carries a report link", () => {
  it("is branded", () => {
    const { html, subject, text } = renderEmail({ template: "REPORT_SHARED", data });
    // The wordmark lockup in the shell, and the credit the shell always carries.
    expect(html).toContain("instruct");
    expect(html).toContain("Brain");
    expect(text.startsWith("instructBrain")).toBe(true);
    expect(subject).toBe(
      "Electrical installation condition — 15 October 2026 (EIC-2026-10-001) — instructSite Development",
    );
  });

  it("tells the reader how to view it and how to download it", () => {
    const { html, text } = renderEmail({ template: "REPORT_SHARED", data });

    // Viewing.
    expect(html).toContain("read the report in your browser");
    expect(html).toContain("nothing to sign in to");
    // Downloading, and that the saved copy cannot move afterwards.
    expect(html).toContain("download button");
    expect(html).toContain("as it was issued");

    // The plain-text version a client may be reading instead carries both too.
    expect(text).toContain("Open the link to read the report in your browser.");
    expect(text).toContain("use the download button on that page");
  });

  it("gives the link, the action, and the report's own details", () => {
    const { html, text } = renderEmail({ template: "REPORT_SHARED", data });

    expect(html).toContain("https://instructbrain.com/shared/abc123");
    expect(html).toContain("View the report");
    expect(html).toContain("instructSite Development");
    expect(html).toContain("EIC-2026-10-001");
    expect(html).toContain("15 October 2026");
    expect(html).toContain("14 November 2026");
    expect(text).toContain("View the report: https://instructbrain.com/shared/abc123");
  });

  it("says honestly whether the PDF is attached", () => {
    const without = renderEmail({ template: "REPORT_SHARED", data });
    // Not "too large to attach": what matters to the reader is where the PDF is.
    expect(without.html).toContain("not attached to this email");
    expect(without.html).not.toContain("too large");
    expect(without.attachments).toHaveLength(0);

    const withPdf = renderEmail({
      template: "REPORT_SHARED",
      data: {
        ...data,
        attachment: { filename: "report.pdf", content: "JVBERi0x", contentType: "application/pdf" },
      },
    });
    expect(withPdf.html).toContain("attached as well");
    expect(withPdf.attachments).toHaveLength(1);
  });

  it("escapes a title rather than letting it into the markup", () => {
    const { html } = renderEmail({
      template: "REPORT_SHARED",
      data: { ...data, reportTitle: 'Rooftop <script>alert("x")</script>' },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
