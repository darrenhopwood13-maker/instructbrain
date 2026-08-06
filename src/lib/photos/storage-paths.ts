/**
 * Storage path convention.
 *
 * Every object lives under `<organisation_id>/<report_id>/…` because the
 * storage RLS policies read the organisation id from the first path segment.
 * Anything else is rejected by the policy.
 *
 * Invariant 3: the ORIGINAL and the THUMBNAIL are two different objects on two
 * different paths, and only the original is ever read by the AI.
 */

export const PHOTO_BUCKET = "report-photos";
export const THUMBNAIL_SEGMENT = "thumbnails";
export const ANALYSIS_SEGMENT = "analysis";

export class ThumbnailNotAnalysableError extends Error {
  constructor(path: string) {
    super(
      `Refusing to analyse "${path}": that is a display thumbnail. Analysis must read the original, full-resolution object.`,
    );
    this.name = "ThumbnailNotAnalysableError";
  }
}

/** Keeps the recognisable part of a filename without letting it break a path. */
export function sanitiseFilename(name: string): string {
  const trimmed = (name ?? "").trim().replace(/^.*[\\/]/, "");
  const cleaned = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "");
  return cleaned === "" ? "photo" : cleaned.slice(-80);
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14).padEnd(12, "0");
}

/**
 * Collision-safe object name. The human-readable original name is kept
 * separately in photos.original_filename and is never lost.
 */
export function collisionSafeFilename(originalFilename: string, token = randomToken()): string {
  const safe = sanitiseFilename(originalFilename);
  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const extension = dot > 0 ? safe.slice(dot).toLowerCase() : "";
  return `${stem}-${token}${extension}`;
}

export function originalPath(
  organisationId: string,
  reportId: string,
  filename: string,
): string {
  return `${organisationId}/${reportId}/${filename}`;
}

export function thumbnailPath(
  organisationId: string,
  reportId: string,
  filename: string,
): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${organisationId}/${reportId}/${THUMBNAIL_SEGMENT}/${stem}.jpg`;
}

/**
 * The full-resolution JPEG transcode used only for formats a vision model
 * cannot read (HEIC / HEIF / AVIF). Never a downscale — see
 * `analysis-derivative.ts`.
 */
export function analysisPath(
  organisationId: string,
  reportId: string,
  filename: string,
): string {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return `${organisationId}/${reportId}/${ANALYSIS_SEGMENT}/${stem}.jpg`;
}

export function isThumbnailPath(path: string | null | undefined): boolean {
  if (typeof path !== "string") return false;
  return path.split("/").includes(THUMBNAIL_SEGMENT);
}

export function reportPrefix(organisationId: string, reportId: string): string {
  return `${organisationId}/${reportId}`;
}

/**
 * The ONLY sanctioned way to obtain the object an AI analysis call reads.
 * It prefers the full-resolution analysis derivative when one exists (HEIC and
 * friends), otherwise the untouched original, and refuses a thumbnail outright
 * no matter which column the path arrived in.
 */
export function analysisSourcePath(photo: {
  storage_path?: string | null;
  thumbnail_path?: string | null;
  analysis_path?: string | null;
}): string {
  const derivative = photo.analysis_path;
  const original = photo.storage_path;
  const path =
    typeof derivative === "string" && derivative.trim() !== "" ? derivative : original;
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error("Photo has no original storage object; it cannot be analysed.");
  }
  // Guard applies to every column: a thumbnail is never analysable.
  if (isThumbnailPath(path)) throw new ThumbnailNotAnalysableError(path);
  return path;
}

