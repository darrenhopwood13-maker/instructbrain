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
          maybeSingle: () => Promise.resolve({ data: queueRows[0] ?? null, error: null }),
          update: (values: Record<string, unknown>) => {
            call.update = values;
            return builder;
          },
          // Awaiting the builder itself (e.g. update().eq().select()) resolves
          // the queued rows, like PostgREST does.
          then: (resolve: (value: unknown) => unknown) =>
            resolve({ data: queueRows, error: null }),
        });
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

describe("the QR card and the nav swap", () => {
  it("draws the QR code near-black on a white tile with a quiet zone", () => {
    const card = readFileSync("src/components/field/field-app-card.tsx", "utf8");
    // Scannability: dark modules, padded white tile — never navy on navy.
    expect(card).toContain('dark: "#101828"');
    expect(card).toContain("bg-white");
    expect(card).toContain("p-2");
    expect(card).not.toContain("#24417B");
    expect(card).toContain("Scan to open the instructBrain field app");
  });

  it("keeps the hand-off available from the report screen's More menu", () => {
    const actions = readFileSync("src/components/report/report-actions.tsx", "utf8");
    expect(actions).toContain("SendToDashboardControl");
    expect(actions).toContain("Send to the dashboard");
  });

  it("gives the phone's bottom bar the field cockpit, not organisation settings", () => {
    const shell = readFileSync("src/components/app-shell.tsx", "utf8");
    const nav = shell.slice(shell.indexOf("const baseNav"), shell.indexOf("] as const"));
    expect(nav).toContain('"/field"');
    expect(nav).toContain('"nav.field"');
    expect(nav).not.toContain("settings/organisation");
    // Organisation settings is still reachable — from the Account menu.
    expect(shell).toContain('to="/settings/organisation"');
  });

  it("stamps the hand-off only on a button press and returns the row", async () => {
    const { sendReportToDashboard } = await import("@/lib/field/handoff");
    const result = await sendReportToDashboard("r1");
    expect(calls[0]!.update).toHaveProperty("submitted_at");
    expect(result).toBeNull();
  });
});
