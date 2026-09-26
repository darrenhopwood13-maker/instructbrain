import { collisionSafeFilename } from "@/lib/photos/storage-paths";

/**
 * Branding files live under the report's own folder, alongside its
 * photographs — never in a shared or cross-organisation location.
 */
export function brandingPath(
  organisationId: string,
  reportId: string,
  filename: string,
): string {
  return `${organisationId}/${reportId}/branding/${collisionSafeFilename(filename)}`;
}

/**
 * A per-report logo wins; otherwise the organisation's saved logo is used;
 * otherwise there is no logo. Everything that renders a report — screen,
 * PDF and shared link — resolves through this one rule.
 */
export function resolveLogoPath(
  reportLogoPath: string | null | undefined,
  organisationLogoPath: string | null | undefined,
): string | null {
  return reportLogoPath ?? organisationLogoPath ?? null;
}


/**
 * Organisation-level logo, stored once per organisation (not per report).
 * Lives under `<organisation_id>/organisation/` so it shares the same
 * storage RLS policies as everything else in the report-photos bucket
 * (the policies key off the first path segment only).
 *
 * The filename is fixed to `logo<extension>` so re-uploading (with the same
 * extension) replaces the previous object in place via upsert, instead of
 * accumulating orphaned files.
 */
export function organisationLogoPath(organisationId: string, filename: string): string {
  const dot = filename.lastIndexOf(".");
  const rawExt = dot > 0 ? filename.slice(dot + 1) : "";
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 10);
  return `${organisationId}/organisation/logo${ext ? `.${ext}` : ""}`;
}
