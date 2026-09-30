import { useCallback, useEffect, useState } from "react";
import { ImageOff, PenLine } from "lucide-react";
import { PhotoMarkupEditor } from "@/components/photos/photo-markup";
import { listPhotos, signedThumbnailUrls, type PhotoRow } from "@/lib/photos/photo-service";
import type { Finding } from "@/lib/types";

/**
 * Review step for manual (no-AI) reports: every photograph with its own
 * description, and a visible button to open the markup editor.
 */
export function ManualReviewList({
  reportId,
  findings,
  readOnly,
  onSaved,
}: {
  reportId: string;
  findings: Finding[];
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<PhotoRow | null>(null);

  const load = useCallback(async () => {
    const rows = await listPhotos(reportId);
    setPhotos(rows);
    setUrls(await signedThumbnailUrls(rows));
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const findingFor = (photoId: string) => findings.find((f) => f.photoIds.includes(photoId));

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No photographs on this report yet.</p>;
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => {
          const finding = findingFor(photo.id);
          const text = (finding?.description ?? finding?.note ?? "").trim();
          const url = urls[photo.id];
          return (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised">
              {url ? (
                <img src={url} alt={`Photograph ${photo.sequence}`} loading="lazy" className="aspect-4/3 w-full bg-surface object-cover" />
              ) : (
                <div className="flex aspect-4/3 w-full items-center justify-center bg-surface text-muted-foreground">
                  <ImageOff aria-hidden="true" className="size-6" />
                  <span className="sr-only">Preview unavailable</span>
                </div>
              )}
              <div className="p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  {finding?.ref ?? `#${photo.sequence}`}
                </p>
                <p className={"mt-1 text-sm " + (text ? "text-foreground" : "italic text-muted-foreground")}>
                  {text || "No description yet"}
                </p>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => setEditing(photo)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-brand-accent bg-brand-accent-soft px-2 text-sm font-semibold text-brand-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
                    aria-label={`Describe and mark up photograph ${photo.sequence}`}
                  >
                    <PenLine aria-hidden="true" className="size-4" />
                    Describe &amp; mark up
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <PhotoMarkupEditor
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        reportId={reportId}
        photoId={editing?.id ?? null}
        photoUrl={editing ? (urls[editing.id] ?? null) : null}
        sequence={editing?.sequence ?? null}
        onSaved={() => {
          onSaved();
          void load();
        }}
      />
    </>
  );
}
