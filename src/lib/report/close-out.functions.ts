import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { actorFromUser } from "@/lib/audit/actor";
import { assertTransition, LifecycleTransitionError } from "@/lib/lifecycle";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";
import {
  CLOSE_OUT_PHOTO_LIMIT_BYTES,
  closeOutRefusal,
  extensionFor,
  normaliseComment,
  photoTypeRefusal,
  type CloseOutPhoto,
} from "@/lib/report/close-out";

/**
 * Close an item out from the dashboard, with a comment or a photograph.
 *
 * The whole write happens as the signed-in user, through their own Supabase client,
 * so the database's own rules decide who may do it - the same owner/admin/surveyor/
 * supervisor roles that may already add a photograph - and nothing here widens them.
 *
 * Two things are checked before anything is written:
 *
 * 1. The item really can be closed from where it stands, using the product's one
 *    `assertTransition` rule, so an already-closed item is refused here exactly as it
 *    is refused from a trade link.
 * 2. There is evidence: a comment, a photograph, or both. An item marked closed with
 *    nothing behind it is worse than an item left open, because the report then says
 *    a hazard was dealt with and nobody can show what was done.
 *
 * A close-out on an item that belongs to an ISSUED report is allowed on purpose:
 * that is the whole point of it - the report was issued, the trade has since done the
 * work, and the item needs closing. The issued document itself is untouched.
 */

type CloseOutInput = {
  findingId: string;
  reportId: string;
  comment?: string | null;
  photo?: CloseOutPhoto | null;
};

function decodePhoto(photo: CloseOutPhoto): Uint8Array {
  const typeRefusal = photoTypeRefusal(photo.mimeType);
  if (typeRefusal) throw new Error(typeRefusal);
  const base64 = photo.base64.replace(/^data:[^;]+;base64,/, "");
  // Decoded with atob rather than Buffer: this runs in a worker, where Buffer is not
  // there unless nodejs_compat is switched on, and a close-out photograph is not the
  // place to find that out.
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("That photograph could not be read.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.byteLength === 0) throw new Error("That photograph came through empty.");
  if (bytes.byteLength > CLOSE_OUT_PHOTO_LIMIT_BYTES) {
    throw new Error("That photograph is larger than 8MB. Resize it and try again.");
  }
  return bytes;
}

export const closeOutItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CloseOutInput) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const { data: finding, error: findingError } = await supabase
      .from("findings")
      .select(
        "id, ref, snag_title, finding_text, lifecycle_state, report_id, reports!inner(id, organisation_id, reference, status)",
      )
      .eq("id", data.findingId)
      .maybeSingle();

    if (findingError) throw new Error(findingError.message);
    if (!finding) throw new Error("That item could not be found, or it is not yours to close.");

    const report = Array.isArray(finding.reports) ? finding.reports[0] : finding.reports;
    if (!report || report.id !== data.reportId) {
      throw new Error("That item does not belong to this report.");
    }

    const comment = normaliseComment(data.comment);
    const refusal = closeOutRefusal({
      lifecycleState: finding.lifecycle_state,
      comment,
      hasPhoto: Boolean(data.photo),
    });
    if (refusal) throw new Error(refusal);

    let next: string;
    try {
      next = assertTransition(finding.lifecycle_state, "verified", "reviewer");
    } catch (error) {
      if (error instanceof LifecycleTransitionError) throw new Error(error.message);
      throw error;
    }

    // 1. The photograph, if there is one: object first, then the row that points at
    //    it, then the link to the item. A row pointing at an object that was never
    //    written is exactly the failure this product has had to fix before.
    let photoId: string | null = null;
    if (data.photo) {
      const bytes = decodePhoto(data.photo);
      const mimeType = data.photo.mimeType.trim().toLowerCase();
      const path = `${report.organisation_id}/${report.id}/closeout/${crypto.randomUUID()}.${extensionFor(mimeType)}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, bytes, { contentType: mimeType, upsert: false });
      if (uploadError) throw new Error(`The photograph could not be stored: ${uploadError.message}`);

      const { data: last } = await supabase
        .from("photos")
        .select("sequence")
        .eq("report_id", report.id)
        .order("sequence", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sequence = Number(last?.sequence ?? 0) + 1;

      const { data: photoRow, error: photoError } = await supabase
        .from("photos")
        .insert({
          report_id: report.id,
          storage_path: path,
          original_filename: data.photo.filename ?? null,
          sequence,
          captured_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (photoError || !photoRow) {
        throw new Error(photoError?.message ?? "The photograph row could not be written.");
      }
      photoId = photoRow.id;

      const { error: linkError } = await supabase
        .from("finding_photos")
        .insert({ finding_id: finding.id, photo_id: photoId, role: "closeout" });
      if (linkError) throw new Error(linkError.message);
    }

    // 2. The item itself: closed, with the note and the time it happened.
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("findings")
      .update({
        lifecycle_state: next,
        lifecycle_note: comment,
        lifecycle_updated_at: now,
        human_edited: true,
      })
      .eq("id", finding.id)
      // Defence in depth: the update is scoped to this report as well as this item.
      .eq("report_id", report.id);
    if (updateError) throw new Error(updateError.message);

    // 3. The audit trail, with the actor named as at the time. Same action name the
    //    trade link writes, so one item's history reads as one history.
    const { data: auth } = await supabase.auth.getUser();
    const actor = actorFromUser(auth?.user);
    if (actor.id) {
      await supabase.from("audit_log").insert({
        report_id: report.id,
        finding_id: finding.id,
        actor_id: actor.id,
        actor_name: actor.name,
        action: "lifecycle.transition",
        before: { lifecycle_state: finding.lifecycle_state },
        after: { lifecycle_state: next, note: comment, photo_id: photoId, from: "dashboard" },
      });
    }

    return { ok: true as const, lifecycleState: next, photoId, note: comment };
  });
