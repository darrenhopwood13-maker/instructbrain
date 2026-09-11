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
