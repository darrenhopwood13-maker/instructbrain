import { describe, expect, it } from "vitest";

import { resolveGroupScope } from "@/lib/distribution/group-findings.server";

/**
 * A stand-in for the Supabase client: every chainable call returns itself and
 * awaiting it yields the table's rows. Enough to exercise the routing, which is
 * the part that was wrong.
 */
function stubDb(tables: Record<string, Array<Record<string, any>>>) {
  const from = (table: string) => {
    const result = Promise.resolve({ data: tables[table] ?? [], error: null });
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => chain,
      then: (resolve: any, reject: any) => result.then(resolve, reject),
    };
    return chain;
  };
  return { from } as any;
}

/**
 * The report that failed: a firm holding three trades, a second firm on one
 * trade with a third (which is a decision, not a guess), an item nobody has, and
 * a confidential item that must never leave.
 */
const db = stubDb({
  reports: [{ project_id: "p1" }],
  project_directory: [
    {
      id: "d1",
      trade: "Electrical",
      company_name: "MEP Solutions",
      is_active: true,
      directory_contacts: [{ id: "c1" }, { id: "c2" }],
    },
    {
      id: "d2",
      trade: "M&E",
      company_name: "MEP Solutions",
      is_active: true,
      directory_contacts: [{ id: "c2" }],
    },
    {
      id: "d3",
      trade: "Groundworks",
      company_name: "ABC Civil Engineering",
      is_active: true,
      directory_contacts: [{ id: "c3" }],
    },
    {
      id: "d4",
      // Same trade, a different firm: this is the case a person must decide.
      trade: "Groundworks",
      company_name: "XYZ Contractors",
      is_active: true,
      directory_contacts: [{ id: "c4" }],
    },
    {
      id: "d5",
      trade: "Carpenter / joiner",
      company_name: "Premier Interiors",
      is_active: true,
      directory_contacts: [{ id: "c5" }],
    },
  ],
  findings: [
    { id: "f1", sequence: 1, assigned_trade: "Electrical", assigned_contact_id: null, is_confidential: false },
    { id: "f2", sequence: 2, assigned_trade: "M&E", assigned_contact_id: null, is_confidential: false },
    { id: "f3", sequence: 3, assigned_trade: "Groundworks", assigned_contact_id: null, is_confidential: false },
    { id: "f4", sequence: 4, assigned_trade: "Carpenter / joiner", assigned_contact_id: null, is_confidential: false },
    // Explicitly put on a contact, which wins over the ambiguous trade.
    { id: "f5", sequence: 5, assigned_trade: "Groundworks", assigned_contact_id: "c4", is_confidential: false },
    { id: "f6", sequence: 6, assigned_trade: null, assigned_contact_id: null, is_confidential: false },
    { id: "f7", sequence: 7, assigned_trade: "Electrical", assigned_contact_id: null, is_confidential: true },
  ],
});

describe("resolving what a distribution group covers", () => {
  it("gives a firm row the items of the trades that firm holds", async () => {
    // The exact fault: this key was matched against `assigned_trade`, so a firm
    // row resolved to nothing and its send died with "no items assigned".
    const scope = await resolveGroupScope(db, "r1", "firm:mep solutions", "subcontractor");
    expect(scope).toEqual({ kind: "findings", ids: ["f1", "f2"], label: "MEP Solutions" });
  });

  it("keeps a confidential item out of a firm's extract", async () => {
    const scope = await resolveGroupScope(db, "r1", "firm:mep solutions", "subcontractor");
    expect(scope.kind === "findings" && scope.ids).not.toContain("f7");
  });

  it("names the firm for a human rather than echoing the internal key", async () => {
    const scope = await resolveGroupScope(db, "r1", "firm:premier interiors", "subcontractor");
    expect(scope.kind === "findings" && scope.label).toBe("Premier Interiors");
  });

  it("honours an explicit assignment over an ambiguous trade", async () => {
    const scope = await resolveGroupScope(db, "r1", "firm:xyz contractors", "subcontractor");
    expect(scope.kind === "findings" && scope.ids).toEqual(["f5"]);
  });

  it("sends an item on a two-firm trade to nobody rather than guessing", async () => {
    const abc = await resolveGroupScope(db, "r1", "firm:abc civil engineering", "subcontractor");
    expect(abc.kind === "findings" && abc.ids).toEqual([]);
  });

  it("counts a trade held by two firms as nobody's, not as the first firm's", async () => {
    const scope = await resolveGroupScope(db, "r1", null, "subcontractor");
    // f3 (two firms on Groundworks) and f6 (no trade at all) are both nobody's.
    expect(scope.kind === "findings" && scope.ids).toEqual(["f3", "f6"]);
  });

  it("keeps the unassigned set meaning 'no trade' under the trade lens", async () => {
    expect(await resolveGroupScope(db, "r1", null, "trade")).toEqual({ kind: "unassigned" });
    expect(await resolveGroupScope(db, "r1", "__unassigned__", "trade")).toEqual({
      kind: "unassigned",
    });
  });

  it("still resolves a plain trade by name", async () => {
    expect(await resolveGroupScope(db, "r1", "Electrical", "trade")).toEqual({
      kind: "trade",
      trade: "Electrical",
    });
  });

  it("treats a quick report as the whole report", async () => {
    expect(await resolveGroupScope(db, "r1", "__report__", "trade")).toEqual({
      kind: "whole-report",
    });
  });
});
