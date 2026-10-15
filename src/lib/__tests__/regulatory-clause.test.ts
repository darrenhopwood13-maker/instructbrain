import { describe, expect, it, vi } from "vitest";

import { envelopeFieldGuide, envelopeJsonSchema } from "@/lib/ai/observation";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { CLAUSE_SETS } from "@/lib/regulatory-clauses";
import { MATERIAL_CONTENT_FIELDS, issueReport, withdrawsConfirmation } from "@/lib/report/report-data";
import { loadReportDocument } from "@/lib/report/document.server";
import {
  certificateRegisterDefinition,
  electricalInstallationDefinition,
  fitOutQualityDefinition,
  mechanicalServicesDefinition,
  siteWalkDefinition,
  snapshotOf,
  systemDefinitions,
} from "@/lib/survey-definitions";
import {
  clauseLabel,
  clausesOf,
  regulatoryReferencesOf,
  resolveClause,
  resolveRegulatoryReference,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

/**
 * A clause is a PERSON's choice, and this is the whole rule in one place.
 *
 * A finding may name the instrument the assessment judged it engages. Only a person may name
 * the section, and only from the list the instrument publishes for itself. Three things have
 * to hold for that to be true rather than merely intended:
 *
 *   1. The list exists, with headings, for the three instruments whose publisher titles its
 *      own units - and for no other instrument, because a picker of bare numbers is not a
 *      choice anybody can make.
 *   2. The model never sees a clause. Not in the prompt, not in the output schema, not in the
 *      field guide. It is asserted by sweeping every clause in the catalogue, not by
 *      spot-checking one, because the leak that was already caught once (instrument ids,
 *      through the schema enum and the field guide) came in sideways.
 *   3. The chosen number survives into the assembled document, and therefore into the version
 *      JSONB that an issued report is rendered from. It cannot be resolved from anywhere live.
 */

const ELECTRICAL = electricalInstallationDefinition;
const MECHANICAL = mechanicalServicesDefinition;
const SITE_WALK = siteWalkDefinition;
const FIT_OUT = fitOutQualityDefinition;
const CERTIFICATES = certificateRegisterDefinition;

/** Every distinct instrument in the catalogue, with the definition it was found on. */
const catalogue = systemDefinitions.flatMap((definition) =>
  regulatoryReferencesOf(definition).map((reference) => ({ definition, reference })),
);

const WITH_HEADINGS = ["eawr_1989", "esqcr_2002", "bldg_regs_2010"];
/** The instruments whose publisher titles nothing, so a list of their units is unusable. */
const WITHOUT_HEADINGS = ["bs_7671", "hsr25", "hsg85", "ad_p"];

describe("the clause lists themselves", () => {
  it("offers a list, with a heading on every entry, for exactly the three instruments that publish one", () => {
    const withClauses = [...new Set(catalogue.filter(({ reference }) => clausesOf(reference).length > 0).map(({ reference }) => reference.id))].sort();
    expect(withClauses).toEqual([...WITH_HEADINGS].sort());

    for (const id of WITH_HEADINGS) {
      const entries = clausesOf(regulatoryReferencesOf(ELECTRICAL).find((r) => r.id === id) ?? null);
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        // The publisher's own number and its own heading, both non-empty. A unit with no
        // heading is not offered: there would be nothing to print beside the reference.
        expect(entry.number.trim().length).toBeGreaterThan(0);
        expect(entry.heading.trim().length).toBeGreaterThan(0);
      }
      // Numbers are stable keys - a person picks one and it is stored as a string.
      const numbers = entries.map((entry) => entry.number);
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it("holds the counts that were verified at source, so a silent change is caught", () => {
    // EAWR 1989: 33 regulations + 2 Schedules = 35 printed units, all titled.
    // ESQCR 2002: 42 printed units, 41 titled - regulation 20A is printed with no heading at
    // all, so it is not offered rather than given an invented one.
    // Building Regulations 2010: 178 printed entries; 44ZB and 44ZC appear twice each with the
    // same number and heading, so 176 distinct units are offered.
    expect(CLAUSE_SETS.eawr_1989.entries).toHaveLength(35);
    expect(CLAUSE_SETS.esqcr_2002.entries).toHaveLength(41);
    expect(CLAUSE_SETS.bldg_regs_2010.entries).toHaveLength(176);
    expect(CLAUSE_SETS.esqcr_2002.entries.some((entry) => entry.number === "20A")).toBe(false);
    expect(CLAUSE_SETS.bldg_regs_2010.entries.filter((entry) => entry.number === "44ZB")).toHaveLength(1);
  });

  it("names the source and the date for each list, so any entry can be checked", () => {
    for (const id of WITH_HEADINGS) {
      const set = CLAUSE_SETS[id as keyof typeof CLAUSE_SETS];
      expect(set.source).toMatch(/^https:\/\//);
      expect(set.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(set.scheme).toBe("regulation");
      expect(set.instrument.trim().length).toBeGreaterThan(0);
    }
  });

  it("offers nothing for an instrument whose publisher titles no paragraph", () => {
    for (const definition of systemDefinitions) {
      for (const reference of regulatoryReferencesOf(definition)) {
        if (!WITHOUT_HEADINGS.includes(reference.id)) continue;
        expect(clausesOf(reference), `${reference.id} offers clauses`).toEqual([]);
      }
    }
    // And the four are genuinely in the catalogue, so the check above is not vacuous.
    const ids = new Set(catalogue.map(({ reference }) => reference.id));
    for (const id of WITHOUT_HEADINGS) expect(ids.has(id), `${id} is not in the catalogue`).toBe(true);
  });

  it("freezes the list into the report's snapshot, so a later edit cannot change a created report", () => {
    for (const definition of [ELECTRICAL, SITE_WALK, MECHANICAL, FIT_OUT, CERTIFICATES]) {
      const snapshot = snapshotOf(definition) as SurveyTypeSnapshot;
      for (const reference of regulatoryReferencesOf(snapshot)) {
        if (!WITH_HEADINGS.includes(reference.id)) continue;
        expect(clausesOf(reference).length).toBeGreaterThan(0);
      }
    }
    // A definition that carries an instrument keeps the same list wherever it appears.
    for (const id of WITH_HEADINGS) {
      const seen = catalogue
        .filter(({ reference }) => reference.id === id)
        .map(({ reference }) => JSON.stringify(clausesOf(reference)));
      expect(new Set(seen).size, `${id} differs between templates`).toBe(1);
    }
  });
});

describe("resolving a chosen clause", () => {
  const eawr = regulatoryReferencesOf(ELECTRICAL).find((reference) => reference.id === "eawr_1989")!;

  it("prints the instrument, the publisher's own unit and its own heading", () => {
    // The heading is the one the source prints for regulation 4 - taken from the JSON, never
    // supplied here. If the heading changes at source, this test changes with it.
    const heading = CLAUSE_SETS.eawr_1989.entries.find((entry) => entry.number === "4")!.heading;
    expect(clauseLabel(eawr, "4")).toBe(`Electricity at Work Regulations 1989, regulation 4 - ${heading}`);
  });

  it("never resolves a number the instrument does not publish", () => {
    expect(resolveClause(eawr, "9999")).toBeNull();
    expect(clauseLabel(eawr, "9999")).toBeNull();
    expect(clauseLabel(eawr, "4.1")).toBeNull();
    expect(clauseLabel(eawr, null)).toBeNull();
    expect(clauseLabel(eawr, undefined)).toBeNull();
    expect(clauseLabel(eawr, "")).toBeNull();
    expect(clauseLabel(eawr, "   ")).toBeNull();
    // A clause from ANOTHER instrument's list is refused, not printed under this one.
    expect(clauseLabel(eawr, "SCHEDULE 6")).toBeNull();
    expect(clauseLabel(eawr, "20A")).toBeNull();
  });

  it("tolerates whitespace around a stored number, and a non-string value is never a clause", () => {
    expect(clauseLabel(eawr, "  4  ")).toBe(clauseLabel(eawr, "4"));
    expect(clauseLabel(eawr, 4)).toBeNull();
    expect(clauseLabel(eawr, { number: "4" })).toBeNull();
    expect(clauseLabel(null, "4")).toBeNull();
    expect(clauseLabel(undefined, "4")).toBeNull();
  });

  it("refuses a clause for an instrument that offers no list at all", () => {
    const bs7671 = regulatoryReferencesOf(ELECTRICAL).find((reference) => reference.id === "bs_7671")!;
    expect(clausesOf(bs7671)).toEqual([]);
    expect(clauseLabel(bs7671, "4")).toBeNull();
  });
});

describe("the model is never shown a clause", () => {
  /**
   * Swept, not sampled. The instrument ids leaked once through the schema enum and the field
   * guide, so the whole catalogue is checked against every string the model is handed: the
   * composed prompt, the JSON schema and the prose field guide.
   */
  const cases = [ELECTRICAL, MECHANICAL, SITE_WALK, FIT_OUT, CERTIFICATES];

  it("carries no printed clause line into the prompt, the schema or the field guide", () => {
    for (const definition of cases) {
      const prompt = buildSystemPrompt(definition);
      const schema = JSON.stringify(envelopeJsonSchema(definition, true));
      const guide = envelopeFieldGuide(definition, true);
      let checked = 0;
      for (const reference of regulatoryReferencesOf(definition)) {
        for (const clause of clausesOf(reference)) {
          // The line the report prints is the exact string a leak would carry through, since
          // it is the whole of what the clause means. Swept, so this cannot pass by sampling.
          const printed = clauseLabel(reference, clause.number)!;
          for (const [where, text] of [
            ["prompt", prompt],
            ["schema", schema],
            ["field guide", guide],
          ] as const) {
            expect(text, `${printed} leaked into the ${where}`).not.toContain(printed);
          }
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });

  it("never states a unit number, and never a titled heading from the list", () => {
    for (const definition of cases) {
      const prompt = buildSystemPrompt(definition);
      const schema = JSON.stringify(envelopeJsonSchema(definition, true));
      const guide = envelopeFieldGuide(definition, true);
      let titled = 0;
      for (const reference of regulatoryReferencesOf(definition)) {
        const scheme = reference.clauses?.scheme ?? "regulation";
        for (const clause of clausesOf(reference)) {
          // The publisher's unit, as a clause reference: "regulation 4". A number nothing in
          // the prompt has any business naming.
          expect(prompt, `${scheme} ${clause.number} is in the prompt`).not.toContain(
            `${scheme} ${clause.number}`,
          );
          // A heading of more than one word cannot be ordinary prose by accident, so if it
          // appears it came from the list. Single-word headings are excluded deliberately: a
          // heading like "Commissioning" is an ordinary English word that the guidance already
          // uses for its own reasons, and failing on it would assert vocabulary, not a leak.
          // The printed-line sweep above still covers those headings together with their
          // number, which is the form a leak would actually take.
          if (!clause.heading.includes(" ")) continue;
          for (const [where, text] of [
            ["prompt", prompt],
            ["schema", schema],
            ["field guide", guide],
          ] as const) {
            expect(text, `${clause.heading} leaked into the ${where}`).not.toContain(clause.heading);
          }
          titled += 1;
        }
      }
      // The control: the sweep above must have had headings to check.
      expect(titled).toBeGreaterThan(10);
    }
  });

  it("has no clause property anywhere in the output schema", () => {
    const schema = envelopeJsonSchema(ELECTRICAL, true) as unknown as {
      properties: { observations: { items: { properties: Record<string, unknown> } } };
    };
    const keys = Object.keys(schema.properties.observations.items.properties);
    expect(keys.some((key) => key.includes("clause"))).toBe(false);
    // The model's citation surface is still, and only, the instrument ids.
    expect(keys).toContain("regulatory_reference");
  });

  it("still offers the instrument ids it always did - the clause work did not widen that", () => {
    const siteWalk = buildSystemPrompt(SITE_WALK);
    expect(siteWalk).toContain("hswa_1974");
    expect(siteWalk).toContain("must be one of these ids exactly, or null. Never invent one");
  });
});

describe("choosing a clause withdraws the person's confirmation", () => {
  it("is a material content field, like naming the instrument itself", () => {
    expect(MATERIAL_CONTENT_FIELDS).toContain("regulatory_clause");
    expect(withdrawsConfirmation({ regulatory_clause: "4" })).toBe(true);
    expect(withdrawsConfirmation({ regulatory_clause: null })).toBe(true);
    // Routing decisions still do not withdraw it - that distinction is not touched here.
    expect(withdrawsConfirmation({ assigned_trade: "Bricklayer" })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* The document: read back, and frozen into the version                */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

/** A db that answers the shapes document.server.ts asks for, and records what was selected. */
function fakeDb(tables: Record<string, Row[]>, selected: Array<{ table: string; columns: string }>) {
  const build = (table: string) => {
    const rows = tables[table] ?? [];
    const chain: Record<string, unknown> = {
      select(columns?: string) {
        selected.push({ table, columns: columns ?? "" });
        return chain;
      },
      eq: () => chain,
      in: () => chain,
      limit: () => chain,
      order: () => Promise.resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return chain;
  };
  return {
    from: (table: string) => build(table),
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
  };
}

const SNAPSHOT = snapshotOf(ELECTRICAL) as SurveyTypeSnapshot;

function findingRow(clause: string | null): Row {
  return {
    id: "f1",
    ref: "F-001",
    sequence: 1,
    status: "observation",
    severity: null,
    hazard_category: null,
    finding_text: "A defective connection was found at the distribution board.",
    remedial_text: "Remake the connection.",
    capture_fields: {},
    assigned_trade: null,
    ai_suggested_trade: null,
    ai_trade_reasoning: null,
    ai_trade_confidence: null,
    condition_grade: null,
    ai_suggested_grade: null,
    ai_grade_confidence: null,
    due_date: null,
    lifecycle_state: "open",
    is_confidential: false,
    confirmed_at: null,
    likely_cause: null,
    regulatory_reference: "eawr_1989",
    regulatory_clause: clause,
    ai_abstain_reason: null,
    ai_region: null,
  };
}

function reportRow(brief: unknown = {}): Row {
  return {
    id: "r1",
    organisation_id: "o1",
    project_id: null,
    title: "Electrical inspection",
    subtitle: null,
    reference: "IB-0001",
    report_date: "2026-10-15",
    status: "in_review",
    issued_at: null,
    current_version: 0,
    scope_text: null,
    methodology_text: null,
    executive_summary: null,
    synthesis: null,
    synthesis_confirmed: false,
    cover_photo_id: null,
    logo_path: null,
    output_language: "en",
    survey_type_snapshot: SNAPSHOT,
    brief,
    handover: null,
    trade_allocation_enabled: true,
  };
}

describe("the chosen clause on the assembled document", () => {
  it("is read from the finding row and carried onto the document", async () => {
    const selected: Array<{ table: string; columns: string }> = [];
    const db = fakeDb(
      {
        reports: [reportRow()],
        organisations: [{ id: "o1", name: "Acme", brand_colour: null, logo_path: null, address: null, trade_allocation_enabled: true }],
        findings: [findingRow("4")],
        photos: [],
        photo_markups: [],
      },
      selected,
    );

    const document = await loadReportDocument(db as never, "r1");
    expect(document).not.toBeNull();
    expect(document!.findings).toHaveLength(1);
    expect(document!.findings[0]!.regulatoryReference).toBe("eawr_1989");
    expect(document!.findings[0]!.regulatoryClause).toBe("4");

    // The column is actually asked for. A missing select column reads as null with no error,
    // which is the failure mode this asserts against.
    const findingsSelect = selected.find((entry) => entry.table === "findings");
    expect(findingsSelect?.columns).toContain("regulatory_clause");
  });

  it("reads as null when no clause was chosen - exactly as it did before the field existed", async () => {
    const selected: Array<{ table: string; columns: string }> = [];
    const db = fakeDb(
      {
        reports: [reportRow()],
        organisations: [{ id: "o1", name: "Acme", brand_colour: null, logo_path: null, address: null, trade_allocation_enabled: true }],
        findings: [findingRow(null)],
        photos: [],
        photo_markups: [],
      },
      selected,
    );
    const document = await loadReportDocument(db as never, "r1");
    expect(document!.findings[0]!.regulatoryClause).toBeNull();
  });
});

describe("publishing freezes the clause with the rest of the document", () => {
  const state = vi.hoisted(() => ({ inserts: [] as Array<{ table: string; values: Record<string, unknown> }> }));

  vi.mock("@/integrations/supabase/client", () => ({
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: "u1", email: "reviewer@example.test" } } }) },
      from: (table: string) => ({
        insert: (values: Record<string, unknown>) => {
          state.inserts.push({ table, values });
          return Promise.resolve({ error: null });
        },
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      }),
      storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
    },
  }));

  it("writes the clause into report_versions.document, which is what an issued PDF is built from", async () => {
    const selected: Array<{ table: string; columns: string }> = [];
    const db = fakeDb(
      {
        reports: [reportRow()],
        organisations: [{ id: "o1", name: "Acme", brand_colour: null, logo_path: null, address: null, trade_allocation_enabled: true }],
        findings: [findingRow("4")],
        photos: [],
        photo_markups: [],
      },
      selected,
    );
    const document = (await loadReportDocument(db as never, "r1"))!;

    state.inserts.length = 0;
    await issueReport(document);

    const version = state.inserts.find((entry) => entry.table === "report_versions");
    expect(version, "no report_versions row was written").toBeTruthy();
    const frozen = version!.values["document"] as {
      findings: Array<{ regulatoryClause: string | null }>;
      snapshot: SurveyTypeSnapshot;
    };
    expect(frozen.findings[0]!.regulatoryClause).toBe("4");
    // The snapshot that gives the clause its words is frozen alongside it, so the printed
    // heading cannot change under an issued report either.
    expect(clausesOf(resolveRegulatoryReference(frozen.snapshot, "eawr_1989"))).toHaveLength(35);
  });
});
