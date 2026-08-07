import { createFileRoute } from "@tanstack/react-router";
import { assertTransition, coerceLifecycleState } from "@/lib/lifecycle";
import { collisionSafeFilename, originalPath } from "@/lib/photos/storage-paths";

/**
 * Token-scoped subcontractor endpoint. No account is involved, so this handler
 * does the work RLS would otherwise do:
 *
 *  - the token resolves to exactly ONE trade on ONE report;
 *  - only that trade's findings are ever returned;
 *  - a confidential finding is filtered out HERE, on the server (Invariant 7);
 *  - the holder may report progress only — never finding text, status,
 *    severity, trade or due date;
 *  - every transition is written to audit_log with the token identity.
 */
export const Route = createFileRoute("/api/public/trade-access/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => resolveAndRun(params, (context) => payload(context)),
      POST: async ({ params, request }) =>
        resolveAndRun(params, (context) => transition(context, request)),
      PUT: async ({ params, request }) =>
        resolveAndRun(params, (context) => closeOutPhoto(context, request)),
    },
  },
});

type Access = {
  id: string;
  report_id: string;
  organisation_id: string;
  trade: string;
  label: string | null;
};

type Context = { admin: any; access: Access; token: string };

const TOKEN_PATTERN = /^[a-z0-9]{16,64}$/i;
const MAX_PHOTO_BYTES = 40 * 1024 * 1024;

function problem(reason: string, error: string, status = 404) {
  return Response.json({ reason, error }, { status });
}

async function resolveAndRun(
  params: unknown,
  run: (context: Context) => Promise<Response>,
): Promise<Response> {
  const token = (params as { token?: string }).token ?? "";
  if (!TOKEN_PATTERN.test(token)) {
    return problem("unknown", "That link is not a valid one.", 400);
  }

  let admin: any;
  try {
    const module = await import("@/integrations/supabase/client.server");
    admin = module.supabaseAdmin as any;
    void admin.from;
  } catch (error) {
    return Response.json(
      {
        reason: "unavailable",
        error: "Trade links are not available on this deployment yet.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }

  const { data: rows } = await admin
    .from("trade_access")
    .select("id, report_id, organisation_id, trade, label, expires_at, revoked_at")
    .eq("token", token)
    .limit(1);
  const access = rows?.[0];
  if (!access) return problem("unknown", "This link is not recognised.");
  if (access.revoked_at) {
    return problem("revoked", "Access to this list has been withdrawn.");
  }
  if (access.expires_at && new Date(access.expires_at).getTime() < Date.now()) {
    return problem("expired", "This link has expired.");
  }

  try {
    return await run({ admin, access: access as Access, token });
  } catch (error) {
    return Response.json(
      { reason: "error", error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

const FINDING_COLUMNS =
  "id, ref, sequence, status, severity, finding_text, remedial_text, capture_fields, due_date, lifecycle_state, lifecycle_note, lifecycle_updated_at, is_confidential, assigned_trade";

/** The one query that defines what a token holder may see. */
async function scopedFindings(context: Context) {
  const { data } = await context.admin
    .from("findings")
    .select(FINDING_COLUMNS)
    .eq("report_id", context.access.report_id)
    .eq("assigned_trade", context.access.trade)
    // Invariant 7 — never a confidential finding, filtered server-side.
    .eq("is_confidential", false)
    .order("sequence", { ascending: true });
  return (data ?? []) as Array<Record<string, any>>;
}

async function audit(
  context: Context,
  findingId: string,
  action: string,
  before: unknown,
  after: unknown,
) {
  await context.admin.from("audit_log").insert({
    report_id: context.access.report_id,
    finding_id: findingId,
    actor_id: null,
    action,
    before,
    after: {
      ...(after as Record<string, unknown>),
      trade_access_id: context.access.id,
      trade: context.access.trade,
      via: "trade_link",
      at: new Date().toISOString(),
    },
  });
}

async function payload(context: Context): Promise<Response> {
  const findings = await scopedFindings(context);

  const [{ data: reports }, { data: organisations }] = await Promise.all([
    context.admin
      .from("reports")
      .select("id, title, reference, report_date, survey_type_snapshot, project_id")
      .eq("id", context.access.report_id)
      .limit(1),
    context.admin
      .from("organisations")
      .select("name")
      .eq("id", context.access.organisation_id)
      .limit(1),
  ]);
  const report = reports?.[0];
  if (!report) return problem("unknown", "That report could not be read.");

  const { data: projects } = await context.admin
    .from("projects")
    .select("name, address")
    .eq("id", report.project_id)
    .limit(1);

  const findingIds = findings.map((finding) => finding.id as string);
  const { data: links } = findingIds.length
    ? await context.admin
        .from("finding_photos")
        .select("finding_id, photo_id, role")
        .in("finding_id", findingIds)
    : { data: [] as any[] };

  const photoIds = [...new Set((links ?? []).map((link: any) => link.photo_id as string))];
  const { data: photos } = photoIds.length
    ? await context.admin
        .from("photos")
        .select("id, storage_path, thumbnail_path")
        .in("id", photoIds)
    : { data: [] as any[] };

  const paths = [
    ...(photos ?? []).map((photo: any) => photo.thumbnail_path),
    ...(photos ?? []).map((photo: any) => photo.storage_path),
  ].filter(Boolean) as string[];

  const { data: signed } = paths.length
    ? await context.admin.storage.from("report-photos").createSignedUrls([...new Set(paths)], 3600)
    : { data: [] as any[] };
  const urls = new Map<string, string>(
    (signed ?? [])
      .filter((entry: any) => entry.path && entry.signedUrl)
      .map((entry: any) => [entry.path as string, entry.signedUrl as string]),
  );

  const photoById = new Map(
    (photos ?? []).map((photo: any) => [
      photo.id as string,
      {
        id: photo.id as string,
        url:
          (photo.thumbnail_path ? urls.get(photo.thumbnail_path) : null) ??
          urls.get(photo.storage_path) ??
          null,
      },
    ]),
  );

  return Response.json(
    {
      trade: context.access.trade,
      label: context.access.label,
      report: {
        id: report.id,
        title: report.title,
        reference: report.reference,
        reportDate: report.report_date,
      },
      snapshot: report.survey_type_snapshot ?? null,
      projectName: projects?.[0]?.name ?? null,
      projectAddress: projects?.[0]?.address ?? null,
      organisationName: organisations?.[0]?.name ?? null,
      findings: findings.map((finding) => {
        const own = (links ?? []).filter((link: any) => link.finding_id === finding.id);
        return {
          id: finding["id"],
          ref: finding["ref"],
          severity: finding["severity"],
          findingText: finding["finding_text"],
          remedialText: finding["remedial_text"],
          captureFields: finding["capture_fields"] ?? {},
          dueDate: finding["due_date"],
          lifecycleState: coerceLifecycleState(finding["lifecycle_state"]),
          lifecycleNote: finding["lifecycle_note"] ?? null,
          lifecycleUpdatedAt: finding["lifecycle_updated_at"] ?? null,
          photos: own
            .filter((link: any) => link.role !== "closeout")
            .map((link: any) => photoById.get(link.photo_id))
            .filter(Boolean),
          closeOutPhotos: own
            .filter((link: any) => link.role === "closeout")
            .map((link: any) => photoById.get(link.photo_id))
            .filter(Boolean),
        };
      }),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

/** Progress only. Nothing here touches finding text, status, severity, trade or due date. */
async function transition(context: Context, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    findingId?: string;
    to?: string;
    note?: string;
  } | null;
  if (!body?.findingId || !body?.to) {
    return problem("error", "Tell us which item and what has changed.", 400);
  }

  const findings = await scopedFindings(context);
  const finding = findings.find((row) => row["id"] === body.findingId);
  if (!finding) {
    return problem("error", "That item is not on your list.", 404);
  }

  const from = coerceLifecycleState(finding["lifecycle_state"]);
  const next = assertTransition(from, body.to, "subcontractor");
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  const { error } = await context.admin
    .from("findings")
    .update({
      lifecycle_state: next,
      lifecycle_note: note,
      lifecycle_updated_at: new Date().toISOString(),
    })
    .eq("id", finding["id"])
    // Defence in depth: the update itself is re-scoped to the token's trade.
    .eq("report_id", context.access.report_id)
    .eq("assigned_trade", context.access.trade)
    .eq("is_confidential", false);
  if (error) throw new Error(error.message);

  await audit(context, finding["id"] as string, "lifecycle.transition", { lifecycle_state: from }, {
    lifecycle_state: next,
    note,
  });

  return Response.json({ ok: true, lifecycleState: next });
}

/**
 * A close-out photograph. The bytes are stored untouched under the report's
 * organisation-scoped prefix, exactly like an original captured in the app,
 * and attached with role 'closeout'.
 */
async function closeOutPhoto(context: Context, request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const findingId = form?.get("findingId");
  const file = form?.get("file");
  if (typeof findingId !== "string" || !(file instanceof File)) {
    return problem("error", "Choose a photograph to upload.", 400);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return problem("error", "That photograph is too large to upload.", 400);
  }

  const findings = await scopedFindings(context);
  const finding = findings.find((row) => row["id"] === findingId);
  if (!finding) return problem("error", "That item is not on your list.", 404);

  const filename = collisionSafeFilename(file.name || "close-out.jpg");
  const path = originalPath(context.access.organisation_id, context.access.report_id, filename);

  const { error: uploadError } = await context.admin.storage
    .from("report-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: last } = await context.admin
    .from("photos")
    .select("sequence")
    .eq("report_id", context.access.report_id)
    .order("sequence", { ascending: false })
    .limit(1);
  const sequence = ((last?.[0]?.sequence as number | undefined) ?? 0) + 1;

  const { data: photo, error: photoError } = await context.admin
    .from("photos")
    .insert({
      report_id: context.access.report_id,
      storage_path: path,
      original_filename: file.name || "close-out.jpg",
      sequence,
      capture_fields: { source: "close-out", trade: context.access.trade },
    })
    .select("id")
    .single();
  if (photoError) throw new Error(photoError.message);

  const { error: linkError } = await context.admin.from("finding_photos").insert({
    finding_id: findingId,
    photo_id: photo.id,
    role: "closeout",
  });
  if (linkError) throw new Error(linkError.message);

  await audit(context, findingId, "lifecycle.closeout_photo", null, {
    photo_id: photo.id,
    storage_path: path,
  });

  return Response.json({ ok: true, photoId: photo.id });
}
