// @vitest-environment jsdom
/**
 * The Review tab must PERSIST confirmations, not just move local state.
 *
 * This renders the real ReviewList, drives its confirm action, and then reads
 * the row back from the database — never from component state — to prove that
 * findings.confirmed_at was actually written. The synthesis pass, which reads
 * that same column, is then shown to unblock.
 *
 * Skipped automatically when service credentials are not present.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ReviewList, type ConfirmPatch } from "@/components/review-list";
import type { Finding } from "@/lib/types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

vi.mock("@/lib/ai/synthesis.server", () => ({
  synthesise: vi.fn(async () => ({
    result: {
      executiveSummary: "Summary.",
      actions: [],
      patterns: [],
      generatedAt: new Date().toISOString(),
    },
    costUsd: 0,
    model: "test-model",
    raw: {},
  })),
}));
vi.mock("@/lib/ai/cost.server", () => ({ logUsage: vi.fn(async () => {}) }));

const url =
  process.env["SUPABASE_URL"] ??
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ??
  "";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const enabled = url !== "" && serviceKey !== "";

const admin = enabled
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const created: { organisation?: string } = {};

afterAll(async () => {
  if (admin && created.organisation) {
    await admin.from("organisations").delete().eq("id", created.organisation);
  }
});

const snapshot = {
  id: "test",
  label: "Test survey",
  statuses: [
    { id: "pass", label: "Satisfactory", tone: "pass", shortcut: "p" },
    { id: "fail", label: "Defective", tone: "fail", shortcut: "f" },
    { id: "not_assessed", label: "Not assessed", tone: "neutral" },
  ],
} as unknown as SurveyTypeSnapshot;

const asFinding = (id: string, ref: string): Finding =>
  ({
    id,
    ref,
    title: "Test finding",
    location: "Level 1",
    trade: "Trade not assigned",
    status: "fail",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: [],
    note: "",
    description: "A described condition.",
    remedial: "",
    likelyCause: null,
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  }) as unknown as Finding;

async function seed() {
  const db = admin!;
  const { data: organisation } = await db
    .from("organisations")
    .insert({ name: `Review confirm test ${Date.now()}` })
    .select("id")
    .single();
  created.organisation = organisation!.id;

  const { data: project } = await db
    .from("projects")
    .insert({ organisation_id: organisation!.id, name: "Test project", reference: "TEST-002" })
    .select("id")
    .single();

  const { data: report } = await db
    .from("reports")
    .insert({
      organisation_id: organisation!.id,
      project_id: project!.id,
      title: "Confirmation persistence",
      report_date: new Date().toISOString().slice(0, 10),
      survey_type_snapshot: snapshot,
    })
    .select("id")
    .single();

  const { data: finding } = await db
    .from("findings")
    .insert({
      report_id: report!.id,
      ref: "F-001",
      sequence: 1,
      status: "fail",
      finding_text: "A described condition.",
    })
    .select("id")
    .single();

  return { reportId: report!.id as string, findingId: finding!.id as string };
}

describe.skipIf(!enabled)("Review tab confirmations reach the database", () => {
  it("writes confirmed_at when the reviewer confirms, and unblocks synthesis", async () => {
    const db = admin!;
    const { reportId, findingId } = await seed();

    // The route's persistence contract, using the same audited column set.
    const onConfirm = async (id: string, patch: ConfirmPatch) => {
      const { error } = await db
        .from("findings")
        .update({ ...patch, human_edited: true })
        .eq("id", id);
      if (error) throw new Error(error.message);
    };

    render(
      <ReviewList
        snapshot={snapshot}
        findings={[asFinding(findingId, "F-001")]}
        onConfirm={onConfirm}
        onConfirmMany={(ids, patch) => Promise.all(ids.map((id) => onConfirm(id, patch))).then()}
      />,
    );

    screen.getByRole("button", { name: /confirm all/i }).click();

    await waitFor(async () => {
      const { data } = await db
        .from("findings")
        .select("confirmed_at")
        .eq("id", findingId)
        .single();
      expect(data?.confirmed_at).toBeTruthy();
    }, { timeout: 10000 });

    // Previously this threw for every report, because nothing was ever confirmed.
    const { synthesiseForReport } = await import("@/lib/report/synthesis-run.server");
    const result = await synthesiseForReport(db as never, reportId);
    expect(result.executiveSummary).toBeTruthy();
  }, 40000);

  it("throws an instructive error while nothing is confirmed", async () => {
    const db = admin!;
    const { reportId } = await seed();
    const { synthesiseForReport } = await import("@/lib/report/synthesis-run.server");
    await expect(synthesiseForReport(db as never, reportId)).rejects.toThrow(
      /no confirmed findings yet/i,
    );
  }, 40000);
});
