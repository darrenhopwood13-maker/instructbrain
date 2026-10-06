import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LOCATION_FIELD_IDS,
  LOCATION_NOT_RECORDED,
  locationLabel,
  resolveLocation,
} from "@/lib/report/location";
import { locationOf as distributionLocationOf } from "@/lib/distribution";
import { groupFindings, type DocFinding } from "@/lib/report/document";

/**
 * One location model, everywhere.
 *
 * Before this, six places answered "where is this finding?" six different ways:
 * the review list joined every capture field together, the by-area grouping
 * took whichever field came first in the object, the PDF header read four
 * fields in one order, the distribution extract and the trade page read a
 * fifth, the email templates read a sixth, and the shared page read none at
 * all. The same finding therefore showed a different location on each surface.
 *
 * These tests assert two things: the resolver behaves, and no surface has gone
 * back to answering for itself.
 */

const SOURCE_ROOT = new URL("../../", import.meta.url).pathname;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      sourceFiles(path, out);
      continue;
    }
    if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const asFinding = (captureFields: Record<string, string>): DocFinding =>
  ({
    id: "f1",
    ref: "F-001",
    sequence: 1,
    statusId: "fail",
    severityId: null,
    categoryId: null,
    findingText: "Text",
    remedialText: "",
    captureFields,
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    photos: [],
  }) as unknown as DocFinding;

describe("resolveLocation", () => {
  it("reads the fields a definition actually declares", () => {
    expect(resolveLocation({ location: "Level 2, Bay 4" })).toBe("Level 2, Bay 4");
    expect(resolveLocation({ room: "Kitchen" })).toBe("Kitchen");
  });

  it("answers the field a report actually filled, not the first one in the object", () => {
    // The by-area grouping used to take whichever value came first here, which
    // is not a location model — it is object ordering.
    expect(resolveLocation({ item: "Radiator", location: "Bay 6" })).toBe("Bay 6");
  });

  it("takes the most specific answer when a report recorded more than one", () => {
    expect(resolveLocation({ zone: "Zone A", location: "Bay 3" })).toBe("Bay 3");
    expect(resolveLocation({ level: "Level 1", room: "Kitchen" })).toBe("Kitchen");
  });

  it("is empty when nothing recorded one, and never a guess", () => {
    expect(resolveLocation(null)).toBe("");
    expect(resolveLocation({})).toBe("");
    expect(resolveLocation({ item: "Radiator" })).toBe("");
    expect(resolveLocation({ location: "   " })).toBe("");
  });

  it("says so plainly when it is shown, and does not when it is not", () => {
    expect(locationLabel({ location: "Bay 4" })).toBe("Bay 4");
    expect(locationLabel({})).toBe(LOCATION_NOT_RECORDED);
  });

  it("trims what it returns", () => {
    expect(resolveLocation({ location: "  Bay 4  " })).toBe("Bay 4");
  });

  it("does not treat a kind of space as a position", () => {
    // `area_type` is the list of space types — internal, welfare — which is a
    // different question from where inside it.
    expect(LOCATION_FIELD_IDS).not.toContain("area_type");
  });
});

describe("every surface gives the same answer", () => {
  const cases: Array<Record<string, string>> = [
    { location: "Bay 4" },
    { room: "Kitchen" },
    { zone: "Zone A" },
    { item: "Radiator", location: "Bay 6" },
    { item: "Radiator" },
    {},
  ];

  it("the distribution extract agrees with the resolver", () => {
    for (const fields of cases) {
      expect(distributionLocationOf(fields)).toBe(resolveLocation(fields));
    }
  });

  it("the by-area grouping agrees with the resolver", () => {
    for (const fields of cases) {
      const [group] = groupFindings([asFinding(fields)], "area");
      const expected = resolveLocation(fields) || "Location not recorded";
      expect(group?.key).toBe(expected);
      expect(group?.label).toBe(expected);
    }
  });
});

describe("no surface has gone back to answering for itself", () => {
  it("only the location module decides between location fields", () => {
    // One field name on its own is a database column or a label, which is fine.
    // Two or more in the same file is a second implementation of "where" — and
    // that duplication IS the bug this replaced, six times over. This is what
    // catches a seventh copy being written, anywhere, on any surface.
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter((path) => !path.endsWith("report/location.ts"))
      .map((path) => {
        const text = readFileSync(path, "utf8");
        const found = LOCATION_FIELD_IDS.filter((id) =>
          new RegExp(`\\[\\s*"${id}"\\s*\\]`).test(text),
        );
        return { file: path.replace(SOURCE_ROOT, "src/"), found };
      })
      .filter((entry) => entry.found.length >= 2);

    expect(offenders).toEqual([]);
  });
});
