import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_STATUS_IDS,
  DEFAULT_CERTIFICATE_LEAD_DAYS,
  certificateStatusLabel,
  certificateStatusTone,
  deriveCertificateExpiry,
  describeCertificateExpiry,
  isCertificateInDate,
} from "@/lib/certificates/expiry";
import { certificateRegisterDefinition, getDefinition, systemDefinitions } from "@/lib/survey-definitions";
import { NOT_ASSESSED_ID, regulatoryReferencesOf, resolveStatus, statusesOf } from "@/lib/survey-types";

const TODAY = "2026-10-10";

describe("certificate expiry — no date, no answer", () => {
  /**
   * The rule this whole feature exists for. A certificate register that assumes
   * something is in date because nobody wrote the date down is worse than no
   * register: it says the paperwork is fine when the paperwork is missing.
   */
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["whitespace", "   "],
    ["not a date", "next year"],
    ["words", "expired soon"],
    ["day/month/year", "01/11/2026"],
    ["impossible day", "2026-02-30"],
    ["month thirteen", "2026-13-01"],
    ["day zero", "2026-11-00"],
    ["SQL-ish nonsense", "0000-00-00"],
  ])("resolves %s to not_assessed, never to valid", (_label, value) => {
    const expiry = deriveCertificateExpiry({ expiryDate: value, today: TODAY });
    expect(expiry.statusId).toBe("not_assessed");
    expect(expiry.daysRemaining).toBeNull();
    expect(expiry.expiryDate).toBeNull();
    expect(certificateStatusTone(expiry.statusId)).toBe("flag");
    expect(isCertificateInDate(expiry.statusId)).toBe(false);
  });

  it("does not treat an unusable 'today' as a licence to pass a certificate", () => {
    for (const today of ["not-a-date", "", "   ", "10/10/2026"]) {
      expect(deriveCertificateExpiry({ expiryDate: "2027-01-01", today }).statusId).toBe(
        "not_assessed",
      );
    }
  });

  it("falls back to the clock only when no day is supplied at all", () => {
    // Omitting the day is a caller saying "now". That is a different thing from
    // supplying a day it cannot read, which resolves to not_assessed above.
    const expiry = deriveCertificateExpiry({ expiryDate: "2099-01-01" });
    expect(expiry.statusId).toBe("valid");
    expect(typeof expiry.daysRemaining).toBe("number");
  });
});

describe("certificate expiry — the date it runs out", () => {
  it("is valid when it runs out beyond the lead window", () => {
    const expiry = deriveCertificateExpiry({ expiryDate: "2027-06-30", today: TODAY });
    expect(expiry.statusId).toBe("valid");
    expect(expiry.daysRemaining).toBe(263);
    expect(expiry.expiryDate).toBe("2027-06-30");
  });

  it("asks for attention inside the lead window", () => {
    const expiry = deriveCertificateExpiry({ expiryDate: "2026-11-01", today: TODAY });
    expect(expiry.statusId).toBe("expiring");
    expect(expiry.daysRemaining).toBe(22);
  });

  it("treats the last day of the lead window as expiring, not valid", () => {
    // 2026-10-10 + 30 days
    const expiry = deriveCertificateExpiry({ expiryDate: "2026-11-09", today: TODAY });
    expect(expiry.daysRemaining).toBe(DEFAULT_CERTIFICATE_LEAD_DAYS);
    expect(expiry.statusId).toBe("expiring");
  });

  it("is still in date on the day it runs out, and expired the day after", () => {
    const todayRunOut = deriveCertificateExpiry({ expiryDate: TODAY, today: TODAY });
    expect(todayRunOut.statusId).toBe("expiring");
    expect(todayRunOut.daysRemaining).toBe(0);
    expect(describeCertificateExpiry(todayRunOut)).toBe("Runs out today");

    const yesterday = deriveCertificateExpiry({ expiryDate: "2026-10-09", today: TODAY });
    expect(yesterday.statusId).toBe("expired");
    expect(yesterday.daysRemaining).toBe(-1);
    expect(describeCertificateExpiry(yesterday)).toBe("Expired 1 day ago");
  });

  it("honours a lead window the caller sets", () => {
    expect(
      deriveCertificateExpiry({ expiryDate: "2026-12-01", today: TODAY, leadDays: 90 }).statusId,
    ).toBe("expiring");
    expect(
      deriveCertificateExpiry({ expiryDate: "2026-12-01", today: TODAY, leadDays: 10 }).statusId,
    ).toBe("valid");
  });

  it("falls back to the default lead window when given nonsense", () => {
    for (const leadDays of [undefined, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const expiry = deriveCertificateExpiry({ expiryDate: "2026-11-01", today: TODAY, leadDays });
      expect(expiry.leadDays).toBe(DEFAULT_CERTIFICATE_LEAD_DAYS);
      expect(expiry.statusId).toBe("expiring");
    }
  });

  it("accepts a Date and collapses it to its UTC calendar day", () => {
    const expiry = deriveCertificateExpiry({
      expiryDate: new Date("2027-03-15T23:45:00Z"),
      today: new Date("2026-10-10T06:00:00Z"),
    });
    expect(expiry.expiryDate).toBe("2027-03-15");
    expect(expiry.statusId).toBe("valid");
  });

  it("rejects an invalid Date rather than guessing", () => {
    expect(deriveCertificateExpiry({ expiryDate: new Date("nope"), today: TODAY }).statusId).toBe(
      "not_assessed",
    );
  });
});

describe("certificate status tones", () => {
  it("never returns a pass tone for anything that is not valid", () => {
    const values: unknown[] = [...CERTIFICATE_STATUS_IDS, null, undefined, "", "VALID", "passed", 7, {}];
    for (const value of values) {
      if (value === "valid") continue;
      expect(certificateStatusTone(value)).not.toBe("pass");
    }
    expect(certificateStatusTone("valid")).toBe("pass");
  });

  it("reads an unrecognised status as flagged, not as fine", () => {
    expect(certificateStatusTone("not_assessed")).toBe("flag");
    expect(certificateStatusTone("something_else")).toBe("flag");
    expect(certificateStatusLabel("something_else")).toBe("Not assessed");
  });

  it("describes a missing date as missing", () => {
    expect(describeCertificateExpiry(deriveCertificateExpiry({ expiryDate: null }))).toBe(
      "No date on record - not assessed",
    );
  });
});

describe("the register template", () => {
  const definition = certificateRegisterDefinition;

  it("is a system definition", () => {
    expect(getDefinition("certificate_register")).toBe(definition);
    expect(systemDefinitions.some((item) => item.id === "certificate_register")).toBe(true);
  });

  it("carries every register status, with unknown resolving to not_assessed", () => {
    const ids = statusesOf(definition).map((status) => status.id);
    for (const id of CERTIFICATE_STATUS_IDS) expect(ids).toContain(id);

    // A status from another discipline must never land on a pass here.
    expect(resolveStatus(definition, "snag").id).toBe(NOT_ASSESSED_ID);
    expect(resolveStatus(definition, "compliant_install").id).toBe(NOT_ASSESSED_ID);
    expect(statusesOf(definition).find((s) => s.id === "not_assessed")?.tone).toBe("flag");

    const passing = statusesOf(definition).filter((status) => status.tone === "pass");
    expect(passing.map((status) => status.id)).toEqual(["valid"]);
  });

  it("records the two dates the register is built on", () => {
    const fields = (definition.captureFields ?? []).map((field) => field.id);
    expect(fields).toContain("issue_date");
    expect(fields).toContain("expiry_date");
    expect(fields).toContain("record_type");
  });

  it("cites instruments, never clauses", () => {
    const refs = regulatoryReferencesOf(definition);
    expect(refs.length).toBeGreaterThan(0);

    const ids = refs.map((ref) => ref.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const ref of refs) {
      expect(ref.id).toMatch(/^[a-z0-9_]+$/);
      expect(ref.label).not.toMatch(/\b(clause|paragraph|section\s+\d|table\s+\d|reg\s+\d)/i);
    }
  });

  it("pins the verified citation count, so a silent deletion is caught", () => {
    expect(regulatoryReferencesOf(definition)).toHaveLength(12);
  });

  it("tells the model never to work out a date", () => {
    const guidance = definition.aiGuidance ?? {};
    expect(guidance["abstainGuidance"]).toMatch(/never infer/i);
    expect(guidance["abstainGuidance"]).toMatch(/not_assessed/);
    expect((definition.aiCaptureFields ?? []).map((field) => field.id)).toContain("expiry_date");
  });
});
