import { describe, expect, it } from "vitest";

import { MATERIAL_CONTENT_FIELDS, withdrawsConfirmation } from "@/lib/report/report-data";

/**
 * The defect these cover: allocating a trade wrote confirmed_at, so routing an
 * item counted as approving its wording, and the publish gate -- blocked on
 * unconfirmed items -- was satisfied by a decision nobody had made.
 */
describe("what withdraws a person's confirmation", () => {
  it("withdraws it when the report wording changes", () => {
    expect(withdrawsConfirmation({ finding_text: "A new description." })).toBe(true);
  });

  it("withdraws it when the remedy is rewritten", () => {
    expect(withdrawsConfirmation({ remedial_text: "Rake out and repoint." })).toBe(true);
  });

  it("withdraws it when the severity or grade is changed", () => {
    expect(withdrawsConfirmation({ severity: "high" })).toBe(true);
    expect(withdrawsConfirmation({ condition_grade: "C2" })).toBe(true);
  });

  it("withdraws it when the evidence is corrected", () => {
    expect(withdrawsConfirmation({ capture_fields: { location: "Level 2" } })).toBe(true);
  });

  it("does NOT withdraw it for allocation, which is a routing decision", () => {
    expect(withdrawsConfirmation({ assigned_trade: "Bricklayer" })).toBe(false);
  });

  it("does NOT withdraw it for a date, a status or the lifecycle", () => {
    expect(withdrawsConfirmation({ due_date: "2026-10-20" })).toBe(false);
    expect(withdrawsConfirmation({ status: "snag" })).toBe(false);
    expect(withdrawsConfirmation({ due_date_overridden: true })).toBe(false);
    expect(withdrawsConfirmation({ lifecycle_state: "open" })).toBe(false);
  });

  it("does not withdraw it for an empty patch", () => {
    expect(withdrawsConfirmation({})).toBe(false);
  });

  it("counts a confirmation as content-free, so approving cannot clear itself", () => {
    for (const field of MATERIAL_CONTENT_FIELDS) {
      expect(field).not.toBe("confirmed_at");
      expect(field).not.toBe("confirmed_by");
      expect(field).not.toBe("assigned_trade");
    }
    expect(withdrawsConfirmation({ confirmed_at: "2026-10-11T00:00:00Z" })).toBe(false);
  });

  it("covers every content field the report actually prints", () => {
    // A field that reaches the client's report but is missing from this list is
    // a field a person can change after approving, silently.
    for (const field of [
      "finding_text",
      "remedial_text",
      "severity",
      "condition_grade",
      "regulatory_reference",
    ]) {
      expect(MATERIAL_CONTENT_FIELDS).toContain(field);
    }
  });
});
