import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Attaching and detaching a report from a project are a matched pair, and both
 * are evidence-relevant. These tests pin three things:
 *
 *   1. Detach really clears the project link (and attach really sets it).
 *   2. Both directions are written to the audit log, in that order, with the
 *      actor who did it.
 *   3. A project-bound template — a compliance register — is identifiable as
 *      such, so the UI never offers to detach one.
 *
 * A detach that silently failed to null the column would leave the report
 * claiming a project it is no longer part of, which is worse than either state.
 */

type Call = {
  table: string;
  update?: Record<string, unknown>;
  insert?: Record<string, unknown>;
  filters: string[];
};

const calls: Call[] = [];
let current: Call | null = null;
let updateError: { message: string; code?: string } | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }),
      },
      from(table: string) {
        const call: Call = { table, filters: [] };
        calls.push(call);
        const builder: Record<string, unknown> = {};
        const chain = (name: string) => (...args: unknown[]) => {
          call.filters.push(`${name}:${args.map(String).join(",")}`);
          return builder;
        };
        Object.assign(builder, {
          select: chain("select"),
          eq: chain("eq"),
          insert: (values: Record<string, unknown>) => {
            call.insert = values;
            return builder;
          },
          update: (values: Record<string, unknown>) => {
            call.update = values;
            current = call;
            return builder;
          },
          // Awaiting the builder resolves the write, like PostgREST does.
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: null, error: current === call ? updateError : null }),
        });
        return builder;
      },
    };
  },
}));

beforeEach(() => {
  calls.length = 0;
  current = null;
  updateError = null;
});

describe("attaching a report to a project", () => {
  it("sets the project and records who did it", async () => {
    const { attachReportToProject } = await import("@/lib/data");

    await attachReportToProject("report-1", "project-9");

    const update = calls.find((c) => c.table === "reports");
    expect(update?.update).toEqual({ project_id: "project-9" });
    expect(update?.filters).toContain("eq:id,report-1");

    const audit = calls.find((c) => c.table === "audit_log");
    expect(audit?.insert).toMatchObject({
      report_id: "report-1",
      actor_id: "user-1",
      action: "report.attached_to_project",
      after: { project_id: "project-9" },
    });
  });
});

describe("detaching a report from a project", () => {
  it("clears the project link", async () => {
    const { detachReportFromProject } = await import("@/lib/data");

    await detachReportFromProject("report-1", "project-9");

    const update = calls.find((c) => c.table === "reports");
    expect(update?.update).toEqual({ project_id: null });
    expect(update?.filters).toContain("eq:id,report-1");
  });

  it("records both sides of the move in the audit log", async () => {
    const { detachReportFromProject } = await import("@/lib/data");

    await detachReportFromProject("report-1", "project-9");

    const audit = calls.find((c) => c.table === "audit_log");
    expect(audit?.insert).toMatchObject({
      report_id: "report-1",
      actor_id: "user-1",
      action: "report.detached_from_project",
      before: { project_id: "project-9" },
      after: { project_id: null },
    });
  });

  it("surfaces a database refusal rather than pretending it worked", async () => {
    const { detachReportFromProject } = await import("@/lib/data");
    updateError = { message: "new row violates row-level security policy", code: "42501" };

    await expect(detachReportFromProject("report-1", "project-9")).rejects.toThrow(
      /row-level security/,
    );
  });
});

describe("project-bound definitions", () => {
  it("marks a compliance register as undetachable", async () => {
    const { isProjectBound } = await import("@/lib/survey-types");
    const { complianceDefinition } = await import("@/lib/compliance/definition");

    expect(isProjectBound(complianceDefinition("fire"))).toBe(true);
  });

  it("leaves an ordinary report free to detach", async () => {
    const { isProjectBound } = await import("@/lib/survey-types");

    // Anything that does not opt in must stay detachable, so adding the flag
    // cannot quietly lock existing templates to their projects.
    expect(isProjectBound({ id: "snagging", version: 2, label: "Snag", statuses: [] })).toBe(false);
    expect(isProjectBound(null)).toBe(false);
    expect(isProjectBound(undefined)).toBe(false);
  });
});
