/**
 * Reference stability against the REAL database.
 *
 * Invariant 4: a finding's `ref` is assigned once at creation and persisted.
 * Deleting a photograph detaches it and must not renumber anything.
 *
 * Skipped automatically when service credentials are not present.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { nextRef } from "@/lib/finding-refs";

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

describe.skipIf(!enabled)("finding refs survive photo deletion (real database)", () => {
  it("keeps every ref and sequence unchanged when a photograph is deleted", async () => {
    const db = admin!;

    const { data: organisation, error: orgError } = await db
      .from("organisations")
      .insert({ name: `Ref stability test ${Date.now()}` })
      .select("id")
      .single();
    expect(orgError).toBeNull();
    created.organisation = organisation!.id;

    const { data: project } = await db
      .from("projects")
      .insert({
        organisation_id: organisation!.id,
        name: "Test project",
        reference: "TEST-001",
      })
      .select("id")
      .single();

    const { data: report } = await db
      .from("reports")
      .insert({
        organisation_id: organisation!.id,
        project_id: project!.id,
        title: "Ref stability",
        report_date: new Date().toISOString().slice(0, 10),
        survey_type_snapshot: { id: "test", label: "Test", statuses: [] },
      })
      .select("id")
      .single();

    const reportId = report!.id;

    const { data: photos } = await db
      .from("photos")
      .insert(
        [1, 2, 3].map((sequence) => ({
          report_id: reportId,
          storage_path: `${organisation!.id}/${reportId}/photo-${sequence}.jpg`,
          sequence,
        })),
      )
      .select("id, sequence")
      .order("sequence");

    const { data: findings } = await db
      .from("findings")
      .insert(
        ["F-001", "F-002", "F-003"].map((ref, index) => ({
          report_id: reportId,
          ref,
          sequence: index + 1,
          status: "not_assessed",
        })),
      )
      .select("id, ref")
      .order("ref");

    // Middle photo carries two findings; one finding also has another photo.
    await db.from("finding_photos").insert([
      { finding_id: findings![0]!.id, photo_id: photos![0]!.id, role: "primary" },
      { finding_id: findings![1]!.id, photo_id: photos![1]!.id, role: "primary" },
      { finding_id: findings![1]!.id, photo_id: photos![2]!.id, role: "detail" },
      { finding_id: findings![2]!.id, photo_id: photos![1]!.id, role: "primary" },
    ]);

    // Delete the middle photograph.
    const { error: deleteError } = await db.from("photos").delete().eq("id", photos![1]!.id);
    expect(deleteError).toBeNull();

    const { data: afterFindings } = await db
      .from("findings")
      .select("ref, sequence")
      .eq("report_id", reportId)
      .order("ref");
    expect(afterFindings?.map((row) => row.ref)).toEqual(["F-001", "F-002", "F-003"]);
    expect(afterFindings?.map((row) => row.sequence)).toEqual([1, 2, 3]);

    const { data: afterPhotos } = await db
      .from("photos")
      .select("sequence")
      .eq("report_id", reportId)
      .order("sequence");
    expect(afterPhotos?.map((row) => row.sequence)).toEqual([1, 3]);

    // The link rows are gone; the findings themselves remain.
    const { data: links } = await db
      .from("finding_photos")
      .select("finding_id, photo_id")
      .eq("photo_id", photos![1]!.id);
    expect(links).toEqual([]);

    // The next ref continues from the highest ever issued.
    expect(nextRef((afterFindings ?? []).map((row) => row.ref as string))).toBe("F-004");
  }, 30000);

  it("refuses to change a ref once assigned", async () => {
    const db = admin!;
    const { data: findings } = await db
      .from("findings")
      .select("id, ref, report_id")
      .limit(1);
    const finding = findings?.[0];
    if (!finding) return;

    const { error } = await db.from("findings").update({ ref: "F-999" }).eq("id", finding.id);
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("immutable");
  }, 30000);
});
