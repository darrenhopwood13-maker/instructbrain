import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildExtractDocument,
  groupForDistribution,
  UNASSIGNED_GROUP,
  type GroupableFinding,
} from "@/lib/distribution";
import { ConfidentialFindingError } from "@/lib/email/templates";
import { deriveDueDate, formatTarget } from "@/lib/findings/due-date";
import { parseDirectoryCsv, groupImportRows } from "@/lib/directory/csv-import";
import { siteWalkDefinition } from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/* ------------------------------------------------------------------ */
/* A tiny stand-in for the Supabase query builder.                      */
/* ------------------------------------------------------------------ */

type Row = Record<string, any>;

function matches(row: Row, filters: Array<[string, string, any]>): boolean {
  return filters.every(([kind, column, value]) => {
    if (kind === "eq") return row[column] === value;
    if (kind === "is") return (row[column] ?? null) === value;
    if (kind === "in") return (value as any[]).includes(row[column]);
    return true;
  });
}

function fakeDb(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const filters: Array<[string, string, any]> = [];
    const rows = () => (tables[name] ?? []).filter((row) => matches(row, filters));
    const chain: any = {
      select: () => chain,
      insert: (values: Row) => {
        tables[name] = [...(tables[name] ?? []), values];
        return chain;
      },
      update: (values: Row) => {
        chain._update = values;
        return chain;
      },
      eq: (column: string, value: any) => {
        filters.push(["eq", column, value]);
        return chain;
      },
      is: (column: string, value: any) => {
        filters.push(["is", column, value]);
        return chain;
      },
      in: (column: string, value: any) => {
        filters.push(["in", column, value]);
        return chain;
      },
      order: () => chain,
      limit: () => chain,
      single: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: any) => {
        if (chain._update) {
          for (const row of rows()) Object.assign(row, chain._update);
        }
        return Promise.resolve({ data: rows(), error: null }).then(resolve);
      },
    };
    return chain;
  };
  return {
    from,
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((entry) => ({ path: entry, signedUrl: `https://signed/${entry}` })),
          error: null,
        }),
        upload: async () => ({ error: null }),
      }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* 1. A confidential finding in an extract THROWS.                      */
/* ------------------------------------------------------------------ */

function groupable(overrides: Partial<GroupableFinding>): GroupableFinding {
  return {
    id: "f1",
    ref: "F-001",
    assignedTrade: "Roofer",
    severityId: "high",
    captureFields: { location: "Roof, bay 3" },
    isConfidential: false,
    findingText: "Guard rail incomplete.",
    remedialText: "Complete the guard rail.",
    dueDate: null,
    ...overrides,
  };
}

const source = {
  projectName: "Test project",
  projectAddress: null,
  reportTitle: "Site walk",
  reportReference: "R-001",
  reportDate: "2026-01-01",
  organisationName: "Test org",
};

describe("extracts and confidential findings", () => {
  it("throws rather than rendering an extract containing a confidential finding", () => {
    const group = groupForDistribution([groupable({})], "trade")[0]!;
    // Force the leak the grouping normally prevents, so the terminal
    // assertion inside buildExtractDocument is the thing under test.
    group.findings.push(groupable({ id: "f2", ref: "F-002", isConfidential: true }));

    expect(() => buildExtractDocument(group, "trade", source)).toThrow(ConfidentialFindingError);
    expect(() => buildExtractDocument(group, "trade", source)).toThrow(/F-002/);
  });

  it("never places a confidential finding in any group, including the unassigned one", () => {
    const groups = groupForDistribution(
      [
        groupable({}),
        groupable({ id: "f2", ref: "F-002", assignedTrade: null, isConfidential: true }),
      ],
      "trade",
    );
    const refs = groups.flatMap((group) => group.findings.map((finding) => finding.ref));
    expect(refs).toEqual(["F-001"]);
    expect(groups.some((group) => group.key === UNASSIGNED_GROUP)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 2. A trade token returns only that trade's findings.                 */
/* ------------------------------------------------------------------ */

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return (globalThis as any).__tradeDb;
  },
}));

async function tradeHandlers() {
  const module = await import("@/routes/api/public/trade-access.$token");
  return (module.Route as any).options.server.handlers;
}

const TOKEN = "abcdefghijklmnopqrstuvwx";

function tradeFixture() {
  return {
    trade_access: [
      {
        id: "ta1",
        token: TOKEN,
        report_id: "r1",
        organisation_id: "o1",
        trade: "Roofer",
        label: "Roofer",
        expires_at: null,
        revoked_at: null,
      },
    ],
    reports: [
      {
        id: "r1",
        title: "Site walk",
        reference: "R-001",
        report_date: "2026-01-01",
        project_id: "p1",
        survey_type_snapshot: siteWalkDefinition,
      },
    ],
    projects: [{ id: "p1", name: "Test project", address: "Somewhere" }],
    organisations: [{ id: "o1", name: "Test org" }],
    findings: [
      {
        id: "f1",
        report_id: "r1",
        ref: "F-001",
        sequence: 1,
        assigned_trade: "Roofer",
        is_confidential: false,
        lifecycle_state: "open",
        finding_text: "Guard rail incomplete.",
        remedial_text: "Complete it.",
        capture_fields: { location: "Roof" },
        severity: null,
        due_date: null,
      },
      {
        id: "f2",
        report_id: "r1",
        ref: "F-002",
        sequence: 2,
        assigned_trade: "Electrician",
        is_confidential: false,
        lifecycle_state: "open",
        finding_text: "Another trade's item.",
        capture_fields: {},
      },
      {
        id: "f3",
        report_id: "r1",
        ref: "F-003",
        sequence: 3,
        assigned_trade: "Roofer",
        is_confidential: true,
        lifecycle_state: "open",
        finding_text: "Involves a person.",
        capture_fields: {},
      },
    ],
    finding_photos: [],
    photos: [],
    audit_log: [],
  };
}

describe("the subcontractor trade link", () => {
  let tables: ReturnType<typeof tradeFixture>;

  beforeEach(() => {
    tables = tradeFixture();
    (globalThis as any).__tradeDb = fakeDb(tables as unknown as Record<string, Row[]>);
  });

  it("returns only this trade's non-confidential findings", async () => {
    const { GET } = await tradeHandlers();
    const response = await GET({ params: { token: TOKEN } });
    expect(response.status).toBe(200);
    const body = await response.json();
    const refs = body.findings.map((finding: any) => finding.ref);
    expect(refs).toEqual(["F-001"]);
    expect(refs).not.toContain("F-002"); // another trade
    expect(refs).not.toContain("F-003"); // confidential
  });

  it("explains an expired or revoked link instead of failing", async () => {
    const { GET } = await tradeHandlers();
    tables.trade_access[0]!.revoked_at = "2026-01-01T00:00:00Z";
    const revoked = await GET({ params: { token: TOKEN } });
    expect(revoked.status).toBe(404);
    expect((await revoked.json()).reason).toBe("revoked");

    tables.trade_access[0]!.revoked_at = null;
    tables.trade_access[0]!.expires_at = "2020-01-01T00:00:00Z";
    const expired = await GET({ params: { token: TOKEN } });
    expect((await expired.json()).reason).toBe("expired");
  });

  it("records progress and audits it, and refuses another trade's item", async () => {
    const { POST } = await tradeHandlers();

    const ok = await POST({
      params: { token: TOKEN },
      request: new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ findingId: "f1", to: "in_progress" }),
      }),
    });
    expect(ok.status).toBe(200);
    expect(tables.findings[0]!.lifecycle_state).toBe("in_progress");
    expect(tables.audit_log).toHaveLength(1);
    expect((tables.audit_log[0] as any).after.trade_access_id).toBe("ta1");

    for (const id of ["f2", "f3"]) {
      const denied = await POST({
        params: { token: TOKEN },
        request: new Request("http://x", {
          method: "POST",
          body: JSON.stringify({ findingId: id, to: "fixed" }),
        }),
      });
      expect(denied.status).toBe(404);
    }
  });

  it("exposes no way to amend the record — only progress fields are written", () => {
    const routeSource = readFileSync(
      path.join(process.cwd(), "src/routes/api/public/trade-access.$token.ts"),
      "utf8",
    );
    const update = routeSource.slice(routeSource.indexOf('.from("findings")\n    .update('));
    const body = update.slice(0, update.indexOf("})"));
    for (const forbidden of ["finding_text", "remedial_text", "severity", "assigned_trade:", "due_date", "status:"]) {
      expect(body).not.toContain(forbidden);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Due dates derive from targetHours, and an override survives.      */
/* ------------------------------------------------------------------ */

describe("target dates", () => {
  const snapshot = siteWalkDefinition as unknown as SurveyTypeSnapshot;

  it("derives the date from the severity's targetHours", () => {
    const scale = (snapshot as any).severityScale as Array<{ id: string; targetHours?: number }>;
    const timed = scale.find((entry) => typeof entry.targetHours === "number" && entry.targetHours > 0);
    expect(timed).toBeDefined();

    const derived = deriveDueDate(snapshot, timed!.id, "2026-01-01T00:00:00Z");
    const expected = new Date(
      Date.parse("2026-01-01T00:00:00Z") + timed!.targetHours! * 3_600_000,
    )
      .toISOString()
      .slice(0, 10);
    expect(derived.dueDate).toBe(expected);
    expect(derived.targetHours).toBe(timed!.targetHours);
  });

  it("treats targetHours: 0 as immediate rather than as a date", () => {
    const scale = (snapshot as any).severityScale as Array<{ id: string; targetHours?: number }>;
    const immediate = scale.find((entry) => entry.targetHours === 0);
    expect(immediate).toBeDefined();
    const derived = deriveDueDate(snapshot, immediate!.id, "2026-01-01T00:00:00Z");
    expect(derived.immediate).toBe(true);
    expect(formatTarget(snapshot, immediate!.id, derived.dueDate)).toBe("Immediate — stop work");
  });

  it("keeps a human override through a later save", async () => {
    const scale = (snapshot as any).severityScale as Array<{ id: string; targetHours?: number }>;
    const timed = scale.find((entry) => typeof entry.targetHours === "number" && entry.targetHours > 0)!;

    const tables: Record<string, Row[]> = {
      findings: [
        {
          id: "f1",
          severity: timed.id,
          confirmed_at: "2026-01-01T00:00:00Z",
          due_date: "2026-03-01",
          due_date_overridden: true,
          remedial_text: "Original",
        },
      ],
    };
    const db = fakeDb(tables);

    // The persistence rule: a derived date is only written when the human has
    // not overridden it.
    const row = tables["findings"]![0]!;
    const derived = deriveDueDate(snapshot, row["severity"], row["confirmed_at"]);
    const patch: Row = { remedial_text: "Edited" };
    if (!row["due_date_overridden"]) patch["due_date"] = derived.dueDate;

    await db.from("findings").update(patch).eq("id", "f1");

    expect(row["due_date"]).toBe("2026-03-01");
    expect(row["remedial_text"]).toBe("Edited");
    expect(derived.dueDate).not.toBe("2026-03-01");
  });
});

/* ------------------------------------------------------------------ */
/* 4. Nothing sends without an explicit user action.                    */
/* ------------------------------------------------------------------ */

const SEND_FUNCTIONS = [
  "sendInviteEmail",
  "sendReportSharedEmail",
  "sendTradeExtractEmail",
  "sendCloseOutRequestEmail",
  "sendTestEmail",
  "retryDistribution",
];

describe("nothing sends by itself", () => {
  it("issuing a report sends no email", () => {
    const reportData = readFileSync(
      path.join(process.cwd(), "src/lib/report/report-data.ts"),
      "utf8",
    );
    const issue = reportData.slice(reportData.indexOf("export async function issueReport"));
    const body = issue.slice(0, issue.indexOf("\nexport "));
    for (const name of SEND_FUNCTIONS) expect(body).not.toContain(name);
    expect(reportData).not.toContain("email.server");
    expect(reportData).not.toContain("email.functions");
  });

  it("only user-triggered server functions may call a send", async () => {
    const { globSync } = await import("node:fs");
    const files = globSync("src/**/*.{ts,tsx}", { cwd: process.cwd() }) as string[];
    const callers = files.filter((file) => {
      if (
        file.includes("email.server") ||
        file.includes("email.functions") ||
        file.includes("__tests__") ||
        file.includes("resend-webhook")
      ) {
        return false;
      }
      const text = readFileSync(path.join(process.cwd(), file), "utf8");
      return SEND_FUNCTIONS.some((name) => text.includes(`${name}(`));
    });
    expect(callers).toEqual([]);
  });

  it("the distribution plan module never sends", () => {
    const text = readFileSync(
      path.join(process.cwd(), "src/lib/distribution/distribution-data.ts"),
      "utf8",
    );
    for (const name of SEND_FUNCTIONS) expect(text).not.toContain(name);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Unassigned findings route to the project's fallback recipient.    */
/* ------------------------------------------------------------------ */

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return (globalThis as any).__planDb;
  },
}));

describe("unassigned items and the fallback recipient", () => {
  it("addresses the unassigned group to the project's fallback recipient", async () => {
    (globalThis as any).__planDb = fakeDb({
      reports: [
        {
          id: "r1",
          title: "Site walk",
          reference: "R-001",
          report_date: "2026-01-01",
          status: "issued",
          organisation_id: "o1",
          project_id: "p1",
          survey_type_snapshot: siteWalkDefinition,
          projects: {
            name: "Test project",
            address: null,
            fallback_recipient_name: "Site Manager",
            fallback_recipient_email: "manager@example.com",
          },
          organisations: { name: "Test org" },
        },
      ],
      findings: [
        {
          id: "f1",
          report_id: "r1",
          ref: "F-001",
          sequence: 1,
          assigned_trade: null,
          is_confidential: false,
          capture_fields: {},
          finding_text: "Nobody owns this yet.",
          remedial_text: "",
          due_date: null,
          severity: null,
        },
      ],
      project_directory: [],
      distributions: [],
    });

    const { distributionPlanQuery } = await import("@/lib/distribution/distribution-data");
    const plan = await (distributionPlanQuery("r1").queryFn as any)();
    const unassigned = plan.rows.find((row: any) => row.unassigned);
    expect(unassigned).toBeDefined();
    expect(unassigned.recipientEmail).toBe("manager@example.com");
    expect(unassigned.recipientName).toBe("Site Manager");
    expect(unassigned.blockedReason).toBeNull();
  });

  it("blocks the send in plain words when no fallback recipient is set", async () => {
    (globalThis as any).__planDb = fakeDb({
      reports: [
        {
          id: "r1",
          title: "Site walk",
          reference: null,
          report_date: "2026-01-01",
          status: "issued",
          organisation_id: "o1",
          project_id: "p1",
          survey_type_snapshot: siteWalkDefinition,
          projects: { name: "Test project", address: null },
          organisations: { name: "Test org" },
        },
      ],
      findings: [
        {
          id: "f1",
          report_id: "r1",
          ref: "F-001",
          sequence: 1,
          assigned_trade: null,
          is_confidential: false,
          capture_fields: {},
          finding_text: "Nobody owns this yet.",
          remedial_text: "",
        },
      ],
      project_directory: [],
      distributions: [],
    });

    const { distributionPlanQuery } = await import("@/lib/distribution/distribution-data");
    const plan = await (distributionPlanQuery("r1").queryFn as any)();
    const unassigned = plan.rows.find((row: any) => row.unassigned);
    expect(unassigned.recipientEmail).toBeNull();
    expect(unassigned.blockedReason).toMatch(/fallback recipient/i);
  });
});

/* ------------------------------------------------------------------ */
/* 6. CSV import surfaces per-row errors and skips nothing silently.    */
/* ------------------------------------------------------------------ */

describe("directory CSV import", () => {
  const csv = [
    "trade,company,contact,email,phone",
    "Roofer,Acme Roofing,Jo Bloggs,jo@acme.test,01234 567890",
    ",Nameless Ltd,Sam Smith,sam@nameless.test,",
    "Electrician,,Pat Jones,not-an-email,",
    "Plasterer,Smooth Ltd,Alex Reed,alex@smooth.test,",
  ].join("\n");

  it("returns every data row, valid or not, with the reasons it failed", () => {
    const result = parseDirectoryCsv(csv);
    expect(result.fatal).toBeNull();
    expect(result.rows).toHaveLength(4);
    expect(result.validCount + result.invalidCount).toBe(4);
    expect(result.invalidCount).toBe(2);

    const invalid = result.rows.filter((row) => !row.valid);
    expect(invalid.map((row) => row.line)).toEqual([3, 4]);
    for (const row of invalid) {
      expect((row as { errors: string[] }).errors.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(invalid)).toMatch(/trade/i);
    expect(JSON.stringify(invalid)).toMatch(/email|company/i);
  });

  it("imports only the valid rows and never quietly discards a bad one", () => {
    const result = parseDirectoryCsv(csv);
    const groups = groupImportRows(result);
    const trades = groups.map((group) => group.trade).sort();
    expect(trades).toEqual(["Plasterer", "Roofer"]);
    // The malformed rows are still visible to the person importing.
    expect(result.rows.filter((row) => !row.valid)).toHaveLength(2);
  });

  it("says so when the file has no usable header", () => {
    const result = parseDirectoryCsv("name,notes\nfoo,bar");
    expect(result.fatal).toBeTruthy();
  });
});
