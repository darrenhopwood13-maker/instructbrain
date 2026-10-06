import { describe, expect, it } from "vitest";
import { SURVEY_TYPE_FIELD, fieldLabel, readableCaptureFields } from "@/lib/report/sections";

/**
 * Capture fields as a client reads them.
 *
 * A report document is read by people, but capture fields are machine names and
 * ids. Two things were reaching client documents: the internal survey-type
 * marker, which only exists so items can be grouped into sections, and raw
 * survey-type ids printed where a label was meant. A client read
 * "survey type: weekly_compliance_fire" on their own report.
 */

const TYPES = [
  { id: "weekly_compliance_fire", label: "Weekly fire compliance check" },
  { id: "snagging", label: "Snagging" },
];

describe("readableCaptureFields", () => {
  it("drops the survey-type marker, which is an internal key", () => {
    const fields = readableCaptureFields(
      { [SURVEY_TYPE_FIELD]: "snagging", item: "Handrail" },
      TYPES,
    );
    expect(fields).toEqual([{ label: "Item", value: "Handrail" }]);
  });

  it("shows the label, never the id, where the value names a survey type", () => {
    const fields = readableCaptureFields({ [SURVEY_TYPE_FIELD]: "weekly_compliance_fire" }, TYPES);
    expect(fields).toEqual([]);

    const visible = readableCaptureFields({ survey_under: "weekly_compliance_fire" }, TYPES);
    expect(visible).toEqual([{ label: "Survey under", value: "Weekly fire compliance check" }]);
  });

  it("leaves an unrecognised value exactly as stored rather than guessing", () => {
    const fields = readableCaptureFields({ bay: "Bay 3", material: "Torch-on felt" }, TYPES);
    expect(fields.map((field) => field.value)).toEqual(["Bay 3", "Torch-on felt"]);
  });

  it("never prints a leading underscore or a bare marker in a label", () => {
    expect(fieldLabel(SURVEY_TYPE_FIELD)).toBe("Survey type");
    expect(fieldLabel("__private")).toBe("Private");
    expect(fieldLabel("item_name")).toBe("Item name");
    expect(fieldLabel("area")).toBe("Area");
  });

  it("drops empty values rather than printing a blank", () => {
    const fields = readableCaptureFields({ item: "  ", bay: "Bay 1" }, TYPES);
    expect(fields).toEqual([{ label: "Bay", value: "Bay 1" }]);
  });

  it("copes with no capture fields at all", () => {
    expect(readableCaptureFields(null)).toEqual([]);
    expect(readableCaptureFields(undefined)).toEqual([]);
    expect(readableCaptureFields({})).toEqual([]);
  });

  it("trims a value it does print", () => {
    expect(readableCaptureFields({ bay: "  Bay 3  " }, TYPES)).toEqual([
      { label: "Bay", value: "Bay 3" },
    ]);
  });
});
