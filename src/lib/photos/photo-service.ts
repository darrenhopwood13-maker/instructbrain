import { supabase } from "@/integrations/supabase/client";
import { nextRef } from "@/lib/finding-refs";
import { humanisePlanError } from "@/lib/plans";
import { readProvenanceFromFile, type PhotoProvenance } from "@/lib/photos/exif";
import { createDisplayThumbnail } from "@/lib/photos/thumbnail";
import {
  createAnalysisDerivative,
  modelReadableFromBytes,
} from "@/lib/photos/analysis-derivative";
import {
  PHOTO_BUCKET,
  analysisPath,
  collisionSafeFilename,
  originalPath,
  reportPrefix,
  thumbnailPath,
} from "@/lib/photos/storage-paths";

export type PhotoRow = {
  id: string;
  report_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  analysis_path: string | null;
  original_filename: string | null;
  captured_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  width: number | null;
  height: number | null;
  sequence: number;
  checksum: string | null;
  capture_fields: Record<string, string>;
  created_at: string;
};

const photoColumns =
  "id, report_id, storage_path, thumbnail_path, analysis_path, original_filename, captured_at, gps_lat, gps_lng, width, height, sequence, checksum, capture_fields, created_at";

function table() {
  // The generated types lag a migration; the shape above is the contract.
  return supabase.from("photos") as unknown as {
    select: (columns: string) => any;
    insert: (values: Record<string, unknown>) => any;
    update: (values: Record<string, unknown>) => any;
    delete: () => any;
  };
}

export async function listPhotos(reportId: string): Promise<PhotoRow[]> {
  const { data, error } = await table()
    .select(photoColumns)
    .eq("report_id", reportId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PhotoRow[];
}

/** Sequence is stable: it continues from the highest ever issued, not the count. */
export async function nextSequence(reportId: string): Promise<number> {
  const { data, error } = await table()
    .select("sequence")
    .eq("report_id", reportId)
    .order("sequence", { ascending: false })
    .limit(1);
  if (error) throw error;
  const highest = (data ?? [])[0]?.sequence;
  return typeof highest === "number" ? highest + 1 : 1;
}

/**
 * The finding reference for a report's next finding. Assigned once at
 * creation from the highest ref ever issued — never from array length and
 * never recomputed from position (invariant 4).
 */
export async function nextFindingRef(reportId: string, prefix = "F"): Promise<string> {
  const { data, error } = await supabase.from("findings").select("ref").eq("report_id", reportId);
  if (error) throw error;
  return nextRef((data ?? []).map((row) => row.ref as string), prefix);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * ORIGINAL UPLOAD PATH.
 *
 * The File is streamed to storage byte for byte. No canvas, no resize, no
 * recompression, no EXIF stripping, no maximum-size step. This is the object
 * the AI reads, so whatever the camera produced is what is stored.
 */
export function uploadOriginal(
  path: string,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    void (async () => {
      const token = await accessToken();
      const baseUrl =
        (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) ??
        (typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined);
      const apiKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
      if (!token) {
        reject(new Error("You need to be signed in to upload photographs."));
        return;
      }
      if (!baseUrl || !apiKey) {
        reject(new Error("Storage is not configured."));
        return;
      }

      const request = new XMLHttpRequest();
      request.open("POST", `${baseUrl}/storage/v1/object/${PHOTO_BUCKET}/${path}`, true);
      request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.setRequestHeader("apikey", apiKey);
      request.setRequestHeader("x-upsert", "true");
      if (file.type) request.setRequestHeader("Content-Type", file.type);

      request.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
      };
      request.onerror = () => reject(new Error("Connection lost during upload."));
      request.ontimeout = () => reject(new Error("Upload timed out."));
      request.onabort = () => reject(new Error("Upload cancelled."));
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          onProgress(1);
          resolve();
        } else {
          reject(new Error(`Upload failed (${request.status}). ${request.responseText.slice(0, 160)}`));
        }
      };
      signal?.addEventListener("abort", () => request.abort(), { once: true });
      // The File object itself — untouched bytes.
      request.send(file);
    })();
  });
}

/**
 * DISPLAY DERIVATIVE PATH — entirely separate from the original above and
 * only ever read by the grid. Failure here is non-fatal.
 */
async function uploadThumbnail(path: string, file: Blob): Promise<string | null> {
  const thumbnail = await createDisplayThumbnail(file);
  if (!thumbnail) return null;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, thumbnail.blob, { contentType: "image/jpeg", upsert: true });
  return error ? null : path;
}

/**
 * ANALYSIS DERIVATIVE PATH — a third, separate path. Only used for sources a
 * vision model cannot read (HEIC / HEIF / AVIF). Full resolution, never
 * downscaled; see `analysis-derivative.ts` for why it shares no code with the
 * thumbnail module. A JPEG never reaches this function.
 */
async function uploadAnalysisDerivative(
  path: string,
  file: File,
): Promise<{ path: string; blob: Blob } | null> {
  const derivative = await createAnalysisDerivative(file);
  if (!derivative) return null;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, derivative.blob, { contentType: "image/jpeg", upsert: true });
  return error ? null : { path, blob: derivative.blob };
}

export type UploadTarget = {
  organisationId: string;
  reportId: string;
  captureFields: Record<string, string>;
};

export async function findPhotoByChecksum(
  reportId: string,
  checksum: string,
): Promise<PhotoRow | null> {
  const { data, error } = await table()
    .select(photoColumns)
    .eq("report_id", reportId)
    .eq("checksum", checksum)
    .limit(1);
  if (error) return null;
  return ((data ?? [])[0] as PhotoRow | undefined) ?? null;
}

export type UploadOutcome = { photo: PhotoRow; provenance: PhotoProvenance; skipped: boolean };

/**
 * One photograph, end to end:
 *   1. EXIF read from the original bytes FIRST.
 *   2. Original uploaded untouched.
 *   3. Thumbnail generated separately, for the UI only.
 *   4. Row written with the provenance captured in step 1.
 */
export async function uploadPhoto(
  file: File,
  target: UploadTarget,
  sequence: number,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadOutcome> {
  const bytes = await file.arrayBuffer();
  const provenance = await readProvenanceFromFile(file); // step 1 — before anything else
  const checksum = await sha256Hex(bytes);
  onProgress(0.05);

  if (checksum) {
    const existing = await findPhotoByChecksum(target.reportId, checksum);
    if (existing) {
      onProgress(1);
      return { photo: existing, provenance, skipped: true };
    }
  }

  const filename = collisionSafeFilename(file.name || "photo.jpg");
  const original = originalPath(target.organisationId, target.reportId, filename);

  await uploadOriginal(original, file, (fraction) => onProgress(0.05 + fraction * 0.8), signal);

  // Formats the model cannot read get a full-resolution JPEG twin. The
  // decision is made from the actual bytes received, because iOS Safari
  // sometimes transcodes a HEIC to JPEG on pick and sometimes does not.
  const analysis = modelReadableFromBytes(bytes)
    ? null
    : await uploadAnalysisDerivative(
        analysisPath(target.organisationId, target.reportId, filename),
        file,
      );
  onProgress(0.88);

  // Thumbnail: fall back to the derivative when the browser cannot decode the
  // source directly. A missing thumbnail must never block an upload.
  const thumbTarget = thumbnailPath(target.organisationId, target.reportId, filename);
  const thumbnail =
    (await uploadThumbnail(thumbTarget, file)) ??
    (analysis ? await uploadThumbnail(thumbTarget, analysis.blob) : null);
  onProgress(0.92);

  const { data, error } = await table()
    .insert({
      report_id: target.reportId,
      storage_path: original,
      thumbnail_path: thumbnail,
      analysis_path: analysis?.path ?? null,
      original_filename: file.name || null,
      captured_at: provenance.capturedAt,
      gps_lat: provenance.gpsLat,
      gps_lng: provenance.gpsLng,
      width: provenance.width,
      height: provenance.height,
      sequence,
      checksum,
      capture_fields: target.captureFields,
    })
    .select(photoColumns)
    .single();
  if (error) throw new Error(humanisePlanError((error as { message: string }).message));
  onProgress(1);
  return { photo: data as PhotoRow, provenance, skipped: false };
}

export async function updateCaptureFields(
  photoIds: string[],
  values: Record<string, string>,
): Promise<void> {
  if (photoIds.length === 0) return;
  for (const id of photoIds) {
    const { data, error: readError } = await table()
      .select("capture_fields")
      .eq("id", id)
      .single();
    if (readError) throw readError;
    const merged = { ...(data?.capture_fields ?? {}), ...values };
    const { error } = await table().update({ capture_fields: merged }).eq("id", id);
    if (error) throw error;
  }
}

/**
 * Deleting a photograph removes the object and the row. finding_photos rows
 * cascade, so findings simply lose that image — no finding is renumbered and
 * no ref changes (invariant 4).
 */
export async function deletePhotos(photos: PhotoRow[]): Promise<void> {
  if (photos.length === 0) return;
  const paths = photos.flatMap((photo) =>
    [photo.storage_path, photo.thumbnail_path, photo.analysis_path].filter((value): value is string => !!value),
  );
  await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  const { error } = await table()
    .delete()
    .in(
      "id",
      photos.map((photo) => photo.id),
    );
  if (error) throw error;
}

/** Signed URLs for the grid. Thumbnails only — never the original. */
export async function signedThumbnailUrls(
  photos: PhotoRow[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const withThumbnails = photos.filter((photo) => !!photo.thumbnail_path);
  if (withThumbnails.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      withThumbnails.map((photo) => photo.thumbnail_path as string),
      expiresIn,
    );
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry, index) => {
    const photo = withThumbnails[index];
    if (photo && entry.signedUrl) map[photo.id] = entry.signedUrl;
  });
  return map;
}

export function reportStoragePrefix(organisationId: string, reportId: string): string {
  return reportPrefix(organisationId, reportId);
}
