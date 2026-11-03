import { describe, expect, it } from "vitest";
import {
  blockerCount,
  issueBlockers,
  type DocFinding,
  type ReportDocument,
} from "@/lib/report/document";
import {
  PARTY_WALL_ELEMENT_LABELS,
  PARTY_WALL_LIMITATIONS,
  findOpinionTerms,
  partyWallChecklist,
} from "@/lib/report/party-wall";
import { partyWallConditionDefinition, snaggingDefinition } from "@/lib/survey-definitions";
import { isFactsOnly, requiresConditionGrade, requiresPhotoEvidence } from "@/lib/survey-types";

/**
 * A party wall schedule is a statement of fact. These tests pin the three
 * promises that make it one: no grade, a photograph behind every entry, and
 * wording that records what was seen rather than what it means.
 */

const A_PHOTO: DocFinding["photos"][number] = {
  photo: {
    id: "p1",
    sequence: 1,
    filename: "p1.jpg",
    capturedAt: "2026-11-03T09:45:00Z",
    url: "https://example.test/p1.jpg",
    thumbUrl: "https://example.test/p1t.jpg",
    printUrl: "https://example.test/p1.jpg",
    captureFields: {},
  },
  role: "overview",
  region: null,
};

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  const base: DocFinding = {
    id: "f1",
    ref: "PW-001",
    sequence: 1,
    statusId: "noted",
    severityId: null,
    categoryId: null,
    findingText:
      "Stepped crack following the mortar joints, 780mm long, rising from 240mm above floor.",
    snagTitle: null,
    remedialText: "",
    rectificationAlt: null,
    tradesmanHack: null,
    hsNotes: null,
    captureFields: {
      element: PARTY_WALL_ELEMENT_LABELS[1] ?? "",
      location: "Rear reception room",
    },
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: "2026-11-03T10:00:00Z",
    likelyCause: null,
    regulatoryReference: null,
    regulatoryClause: null,
    abstainReason: null,
    photos: [A_PHOTO],
  };
  return { ...base, ...overrides };
}

function changed(base: DocFinding, changes: Partial<DocFinding>): DocFinding {
  return { ...base, ...changes };
}

function reportDocument(
  findings: DocFinding[],
  snapshot: ReportDocument["snapshot"],
): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "Schedule of Condition",
      subtitle: null,
      reference: "SOC/PW/2026-0417",
      reportDate: "2026-11-03",
      status: "draft",
      issuedAt: null,
      currentVersion: 0,
      scopeText: null,
      methodologyText: null,
      executiveSummary: null,
      synthesisConfirmed: false,
      coverPhotoId: null,
      outputLanguage: "en",
    },
    project: null,
    organisation: null,
    snapshot,
    findings,
    photos: [],
    synthesis: null,
    author: "R. Sims MRICS",
  };
}

const partyWallDocument = (findings: DocFinding[]) =>
  reportDocument(findings, partyWallConditionDefinition);

/** One entry per element on the walk, each with a photograph. */
function completeSchedule(): DocFinding[] {
  return PARTY_WALL_ELEMENT_LABELS.map((label, index) =>
    finding({
      id: `f${index}`,
      ref: `PW-${String(index + 1).padStart(3, "0")}`,
      sequence: index,
      captureFields: { element: label, location: "Recorded on site" },
    }),
  );
}

/** Replace the entry at `index`, without the array access reading as undefined. */
function setAt(findings: DocFinding[], index: number, next: DocFinding): DocFinding[] {
  const copy = [...findings];
  copy[index] = next;
  return copy;
}

describe("the party wall definition", () => {
  it("carries no condition grade, because a grade is an opinion", () => {
    expect(requiresConditionGrade(partyWallConditionDefinition)).toBe(false);
    expect(partyWallConditionDefinition.severityScale).toEqual([]);
  });

  it("requires photographic evidence and facts-only wording", () => {
    expect(requiresPhotoEvidence(partyWallConditionDefinition)).toBe(true);
    expect(isFactsOnly(partyWallConditionDefinition)).toBe(true);
  });

  it("walks fourteen elements, and offers them as the element field's options", () => {
    const fields = partyWallConditionDefinition.captureFields ?? [];
    const elementField = fields.find((field) => field.id === "element");
    expect(elementField?.type).toBe("select");
    expect(elementField?.required).toBe(true);
    expect(elementField?.options).toEqual(PARTY_WALL_ELEMENT_LABELS);
    expect(PARTY_WALL_ELEMENT_LABELS).toHaveLength(14);
  });

  it("says on its face what it is not", () => {
    expect(PARTY_WALL_LIMITATIONS.length).toBeGreaterThanOrEqual(5);
    const joined = PARTY_WALL_LIMITATIONS.join(" ");
    expect(joined).toContain("statement of fact");
    expect(joined).toContain("no opinion on the cause");
    expect(joined).toContain("not a structural survey");
    expect(joined).toContain("no testing of any kind");
  });

  it("is claimed by the picker, with its own line", async () => {
    const { TEMPLATE_CHOICE } = await import("@/lib/report/template-families");
    expect(TEMPLATE_CHOICE["party_wall_condition"]?.family).toBe("condition");
  });
});

describe("the wording rule", () => {
  it("leaves a description of what was seen alone", () => {
    expect(
      findOpinionTerms(
        "Plaster parted each side of the joint, no offset across it, no light through the wall.",
      ),
    ).toEqual([]);
  });

  it("finds cause, significance and remedy language", () => {
    // Whole words only: "caused" is matched, "cause" is not a substring hit.
    expect(findOpinionTerms("Likely caused by historic movement.")).toEqual([
      "caused",
      "movement",
    ]);
    expect(findOpinionTerms("The cause is not established.")).toEqual(["cause"]);
    expect(findOpinionTerms("Subsidence suspected at the rear.")).toContain("subsidence");
    expect(findOpinionTerms("Should be repaired before the works start.")).toContain("should be");
    expect(findOpinionTerms("Recommend monitoring weekly.")).toEqual(["recommend", "monitoring"]);
  });

  it("matches whole words only, so 'causeway' is not an opinion", () => {
    expect(findOpinionTerms("The causeway to the rear is tarmac.")).toEqual([]);
  });
});

describe("the four record checks", () => {
  it("passes a complete schedule", () => {
    const document = partyWallDocument(completeSchedule());
    const blockers = issueBlockers(document);
    expect(blockers.unrecordedElements).toEqual([]);
    expect(blockers.photoMissing).toEqual([]);
    expect(blockers.opinionInWording).toEqual([]);
    expect(blockers.excludedWithoutNote).toEqual([]);
    expect(blockers.blocked).toBe(false);
    expect(blockerCount(blockers)).toBe(0);
    expect(partyWallChecklist(document).every((check) => check.passed)).toBe(true);
  });

  it("blocks when an element on the walk has no entry", () => {
    const blockers = issueBlockers(partyWallDocument(completeSchedule().slice(0, 13)));
    expect(blockers.unrecordedElements).toEqual([PARTY_WALL_ELEMENT_LABELS[13]]);
    expect(blockers.blocked).toBe(true);
  });

  it("blocks when an entry has no photograph", () => {
    const findings = completeSchedule();
    const target = findings[2] as DocFinding;
    findings[2] = changed(target, { photos: [] });
    const blockers = issueBlockers(partyWallDocument(findings));
    expect(blockers.photoMissing.map((item) => item.ref)).toEqual([target.ref]);
    expect(blockers.blocked).toBe(true);
    const check = partyWallChecklist(partyWallDocument(findings)).find(
      (item) => item.id === "photo_per_entry",
    );
    expect(check?.passed).toBe(false);
  });

  it("blocks when the wording states an opinion", () => {
    const findings = completeSchedule();
    const target = findings[1] as DocFinding;
    findings[1] = changed(target, {
      findingText: "Crack likely caused by settlement; recommend monitoring.",
    });
    const document = partyWallDocument(findings);
    const blockers = issueBlockers(document);
    expect(blockers.opinionInWording.map((item) => item.ref)).toEqual([target.ref]);
    expect(blockers.blocked).toBe(true);
    const check = partyWallChecklist(document).find((item) => item.id === "facts_not_opinion");
    expect(check?.passed).toBe(false);
    expect(check?.detail).toContain("settlement");
  });

  it("allows an exclusion, but only when it says why", () => {
    const findings = completeSchedule();
    const last = findings[13] as DocFinding;

    const withoutReason = setAt(
      findings,
      13,
      changed(last, { statusId: "excluded", photos: [], findingText: "" }),
    );
    const blocked = issueBlockers(partyWallDocument(withoutReason));
    expect(blocked.excludedWithoutNote).toHaveLength(1);
    expect(blocked.blocked).toBe(true);

    const withReason = setAt(
      findings,
      13,
      changed(last, {
        statusId: "excluded",
        photos: [],
        findingText: "Loft void: hatch screwed shut, no safe access. Excluded by agreement.",
      }),
    );
    const excluded = issueBlockers(partyWallDocument(withReason));
    expect(excluded.excludedWithoutNote).toEqual([]);
    expect(excluded.photoMissing).toEqual([]);
    expect(excluded.blocked).toBe(false);
  });
});

describe("existing templates are untouched", () => {
  it("computes no record checks for a template that never asked for them", () => {
    const document = reportDocument(
      [
        finding({
          id: "s1",
          ref: "SN-001",
          statusId: "snag",
          severityId: "workmanship",
          assignedTrade: "Window installer",
          photos: [],
          captureFields: { location: "Plot 4" },
          findingText: "Sealant missing to window head. Repair it.",
        }),
      ],
      snaggingDefinition,
    );

    const blockers = issueBlockers(document);
    expect(blockers.photoMissing).toEqual([]);
    expect(blockers.opinionInWording).toEqual([]);
    expect(blockers.unrecordedElements).toEqual([]);
    expect(blockers.excludedWithoutNote).toEqual([]);
    expect(blockers.blocked).toBe(false);
  });
});
