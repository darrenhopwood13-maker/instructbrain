import type { DocFinding, ReportDocument } from "@/lib/report/document";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The party wall schedule of condition.
 *
 * A party wall schedule is the one report in this product that is a STATEMENT OF
 * FACT. It records the visible condition of the adjoining owner's property before
 * notifiable works start, so that a later damage claim is settled by comparison
 * with a dated record instead of by recollection.
 *
 * Everything in this module exists to protect that one property:
 *
 *  - The element list is the walk. An element in the list that nobody recorded is
 *    a hole in the evidence, so it blocks issue rather than disappearing.
 *  - Every entry carries a photograph. A written note with no photograph is a
 *    claim with no evidence behind it.
 *  - The word list below is what turns a record into an opinion. A party wall
 *    schedule that says "likely caused by movement" is giving an opinion it was
 *    never asked for, in a document that says on its face it gives none. The
 *    surveyor may still write one, deliberately, and sign it - but the software
 *    will not let one slip in unexamined.
 *
 * The Act: Party Wall etc. Act 1996. The schedule is not required by the Act; it
 * is good practice, and it is what makes s.7(2) liability provable. Nothing here
 * is legal advice and nothing here creates or limits liability.
 */

export type PartyWallElement = { id: string; label: string };

/**
 * The walk, in order. Deliberately not the external-fabric list used by the
 * general Schedule of Condition: a party wall schedule follows the line of
 * influence of the works, which starts at the party wall itself.
 */
export const PARTY_WALL_ELEMENTS: PartyWallElement[] = [
  { id: "party_wall_construction", label: "Party wall — construction and bond" },
  { id: "party_wall_ao_ground", label: "Party wall — adjoining face, ground floor" },
  { id: "party_wall_ao_first", label: "Party wall — adjoining face, first floor" },
  { id: "plumb_and_level", label: "Plumb and level readings" },
  { id: "moisture", label: "Moisture readings" },
  { id: "chimney_breast", label: "Chimney breast and flues" },
  { id: "roof_junction", label: "Roof-line junction and flashing" },
  { id: "rear_rooms_ground", label: "Rear rooms — ground floor" },
  { id: "rear_rooms_first", label: "Rear rooms — first floor" },
  { id: "rear_elevation", label: "Rear elevation and render" },
  { id: "boundary_walls", label: "Boundary walls and fencing" },
  { id: "hardstanding", label: "Hardstanding and paths" },
  { id: "drains", label: "Drains and manholes" },
  { id: "garden", label: "Garden, planting and outbuildings" },
];

/** The element labels, in walk order, for the capture field's option list. */
export const PARTY_WALL_ELEMENT_LABELS: string[] = PARTY_WALL_ELEMENTS.map(
  (element) => element.label,
);

/**
 * What this document is not. Printed on the artefact, never only in the covering
 * message: a third party will read a schedule as a promise unless it says
 * otherwise. Keep the wording here and nowhere else, so no renderer can drift.
 */
export const PARTY_WALL_LIMITATIONS: string[] = [
  "This is a record of the visible condition of the elements listed, as seen on the date and at the times stated, in the areas agreed as within the likely influence of the works.",
  "It is a statement of fact. It gives no opinion on the cause of any defect, on structural significance, on fitness for purpose, or on what should be done about it.",
  "It is not a structural survey, not a building survey and not a defects report, and it reports on nothing beyond the visible condition of those elements.",
  "No opening up, no dismantling, no lifting of floor coverings, no removal of fixtures and no testing of any kind was carried out. Services were checked by normal operation only.",
  "Concealed, unentered and inaccessible areas are excluded and identified as such. No opinion is given on them.",
  "Nothing in this schedule is a specification, a scope of works or an instruction to build.",
  "It is prepared for the purposes of the award under the Party Wall etc. Act 1996 and for the parties to that award, and is not for reliance by anyone else for any other purpose.",
];

/**
 * Words that turn a record into an opinion.
 *
 * Matched on word boundaries against the finding text. Deliberately narrow: this
 * is a prompt to look again, not a censor, and a surveyor can put any of these in
 * an entry and sign it - the check exists so that nobody does it by accident.
 */
export const OPINION_TERMS: string[] = [
  "cause",
  "caused",
  "causing",
  "due to",
  "owing to",
  "resulting from",
  "consequent",
  "because of",
  "subsidence",
  "settlement",
  "heave",
  "movement",
  "structural",
  "structurally",
  "unsafe",
  "dangerous",
  "defective",
  "failure",
  "failed",
  "faulty",
  "remedial",
  "remedy",
  "repair",
  "repairs",
  "replace",
  "replacement",
  "recommend",
  "recommended",
  "should be",
  "needs",
  "requires attention",
  "monitor",
  "monitoring",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const OPINION_PATTERNS = OPINION_TERMS.map(
  (term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i"),
);

/** Every opinion term present in a piece of text, in list order, de-duplicated. */
export function findOpinionTerms(text: string | null | undefined): string[] {
  const body = (text ?? "").trim();
  if (!body) return [];
  return OPINION_TERMS.filter((_, index) => OPINION_PATTERNS[index]?.test(body) ?? false);
}

export const PARTY_WALL_EXCLUDED_STATUS = "excluded";
export const PARTY_WALL_RECORDED_STATUS = "noted";

/**
 * The walk this document must account for, read from the report's OWN frozen
 * definition rather than from a template id: the option list on the capture
 * field named `element`. A template with no such field has no walk to check, so
 * nothing is demanded of it.
 */
export function elementWalkOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): string[] {
  const fields = snapshot?.captureFields ?? [];
  const field = fields.find(
    (candidate) =>
      candidate.id === "element" &&
      candidate.type === "select" &&
      (candidate.options?.length ?? 0) > 0,
  );
  return field?.options ?? [];
}

function elementOf(finding: DocFinding): string {
  return (finding.captureFields["element"] ?? "").trim();
}

function isExcluded(finding: DocFinding): boolean {
  return finding.statusId === PARTY_WALL_EXCLUDED_STATUS;
}

/**
 * The four checks this template runs over its own document. Kept as one function
 * so the screen, the issue gate and the tests cannot disagree about them.
 */
export type PartyWallBlockerSet = {
  /** Elements in the walk that have no entry at all. */
  unrecordedElements: string[];
  /** Entries with no photograph attached: a claim with nothing behind it. */
  photoMissing: DocFinding[];
  /** Entries marked excluded that do not say why. */
  excludedWithoutNote: DocFinding[];
  /** Entries whose wording states an opinion the schedule cannot publish. */
  opinionInWording: DocFinding[];
};

export function partyWallBlockersOf(document: ReportDocument): PartyWallBlockerSet {
  const findings = document.findings;

  const recorded = new Set(
    findings.map(elementOf).filter((label) => label.length > 0),
  );
  const unrecordedElements = elementWalkOf(document.snapshot).filter(
    (label) => !recorded.has(label),
  );

  const photoMissing = findings.filter(
    (finding) => !isExcluded(finding) && (finding.photos ?? []).length === 0,
  );

  const excludedWithoutNote = findings.filter(
    (finding) => isExcluded(finding) && (finding.findingText ?? "").trim().length < 10,
  );

  const opinionInWording = findings.filter(
    (finding) => findOpinionTerms(finding.findingText).length > 0,
  );

  return { unrecordedElements, photoMissing, excludedWithoutNote, opinionInWording };
}

/** True when nothing in this template's own checks would stop the document. */
export function partyWallChecksPass(document: ReportDocument): boolean {
  const blockers = partyWallBlockersOf(document);
  return (
    blockers.unrecordedElements.length === 0 &&
    blockers.photoMissing.length === 0 &&
    blockers.excludedWithoutNote.length === 0 &&
    blockers.opinionInWording.length === 0
  );
}

/**
 * A readable form of the same four checks, for a screen that wants to show them
 * as a list rather than a count. `detail` names the offenders so the person
 * knows what to go and fix, rather than being told a number.
 */
export type PartyWallCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export function partyWallChecklist(document: ReportDocument): PartyWallCheck[] {
  const blockers = partyWallBlockersOf(document);
  const refs = (findings: DocFinding[]) =>
    findings.map((finding) => finding.ref || finding.id).join(", ");

  return [
    {
      id: "elements_recorded",
      label: "Every element on the walk has an entry",
      passed: blockers.unrecordedElements.length === 0,
      detail:
        blockers.unrecordedElements.length === 0
          ? `All ${elementWalkOf(document.snapshot).length} elements recorded or excluded in writing.`
          : `Not recorded: ${blockers.unrecordedElements.join("; ")}.`,
    },
    {
      id: "photo_per_entry",
      label: "Every entry carries a photograph",
      passed: blockers.photoMissing.length === 0,
      detail:
        blockers.photoMissing.length === 0
          ? "Every recorded element has at least one photograph."
          : `No photograph: ${refs(blockers.photoMissing)}.`,
    },
    {
      id: "exclusion_in_writing",
      label: "Anything excluded says why",
      passed: blockers.excludedWithoutNote.length === 0,
      detail:
        blockers.excludedWithoutNote.length === 0
          ? "Every exclusion carries its reason."
          : `No reason stated: ${refs(blockers.excludedWithoutNote)}.`,
    },
    {
      id: "facts_not_opinion",
      label: "The wording records facts, not opinions",
      passed: blockers.opinionInWording.length === 0,
      detail:
        blockers.opinionInWording.length === 0
          ? "No cause, significance or remedy language in any entry."
          : blockers.opinionInWording
              .map(
                (finding) =>
                  `${finding.ref || finding.id}: ${findOpinionTerms(finding.findingText).join(", ")}`,
              )
              .join(" · "),
    },
  ];
}
