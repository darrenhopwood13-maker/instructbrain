import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The site-to-desk hand-off must only ever happen because a person pressed the
 * button, and the desk queue must read the same reports the person sent.
 */

type Call = { table: string; update?: Record<string, unknown>; filters: string[] };

const calls: Call[] = [];
let queueRows: Array<Record<string, unknown>> = [];

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return {
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
          in: chain("in"),
          not: chain("not"),
          neq: chain("neq"),
          eq: chain("eq"),
          order: chain("order"),
          limit: () => Promise.resolve({ data: queueRows, error: null }),
          update: (values: Record<string, unknown>) => {
            call.update = values;
            return builder;
          },
        });
        (builder as { eq: (...a: unknown[]) => unknown }).eq = (...args: unknown[]) => {
          call.filters.push(`eq:${args.map(String).join(",")}`);
          return Promise.resolve({ data: null, error: null });
        };
        return builder;
      },
    };
  },
}));

beforeEach(() => {
  calls.length = 0;
  queueRows = [];
});

describe("send to the dashboard", () => {
  it("stamps the report only when the function is called", async () => {
    const { sendReportToDashboard } = await import("@/lib/field/handoff");
    expect(calls).toHaveLength(0);

    await sendReportToDashboard("report-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]!.table).toBe("reports");
    expect(typeof calls[0]!.update!["submitted_at"]).toBe("string");
    expect(calls[0]!.filters).toContain("eq:id,report-1");
  });

  it("queues sent reports oldest first and leaves issued reports out", async () => {
    const { siteQueueQuery } = await import("@/lib/field/handoff");
    queueRows = [
      { id: "r1", title: "Flat 2 inventory", status: "in_review", submitted_at: "2026-09-22T07:00:00Z", project_id: null },
    ];

    const rows = await (siteQueueQuery(["o1"]).queryFn as () => Promise<unknown[]>)();

    expect(rows).toHaveLength(1);
    expect(calls[0]!.filters).toContain("not:submitted_at,is,null");
    expect(calls[0]!.filters).toContain("neq:status,issued");
    expect(calls[0]!.filters.some((f) => f.startsWith("order:submitted_at"))).toBe(true);
  });

  it("is disabled until an organisation is known", async () => {
    const { siteQueueQuery } = await import("@/lib/field/handoff");
    expect(siteQueueQuery([]).enabled).toBe(false);
    expect(siteQueueQuery(["o1"]).enabled).toBe(true);
  });
});

describe("the field app manifest", () => {
  it("opens on the cockpit and installs standalone", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as Record<
      string,
      unknown
    >;
    expect(manifest["start_url"]).toBe("/field");
    expect(manifest["display"]).toBe("standalone");
    expect(manifest["name"]).toContain("instructBrain");
    const icons = manifest["icons"] as Array<{ purpose?: string }>;
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  it("is linked from the root document", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain("/manifest.webmanifest");
    expect(root).toContain("apple-touch-icon");
  });
});
