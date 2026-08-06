import { AlertTriangle, ImageOff, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { PhotoRow } from "@/lib/photos/photo-service";

function captureLabel(photo: PhotoRow): { text: string; missing: boolean } {
  if (!photo.captured_at) return { text: "No capture time in the file", missing: true };
  const date = new Date(photo.captured_at);
  if (Number.isNaN(date.getTime())) return { text: "Capture time unreadable", missing: true };
  return {
    text: date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    missing: false,
  };
}

/**
 * Grid of DISPLAY THUMBNAILS. The original object is never loaded here — it
 * exists for analysis and for the issued document, not for a browser grid.
 * Images are lazily loaded so 200 photographs do not all fetch at once.
 */
export function PhotoGrid({
  photos,
  urls,
  selected,
  onToggle,
  onOpen,
}: {
  photos: PhotoRow[];
  urls: Record<string, string>;
  selected: Set<string>;
  onToggle: (id: string, shiftKey: boolean) => void;
  onOpen: (photo: PhotoRow) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {photos.map((photo) => {
        const capture = captureLabel(photo);
        const isSelected = selected.has(photo.id);
        const url = urls[photo.id];
        return (
          <li
            key={photo.id}
            className={
              "overflow-hidden rounded-xl border bg-surface-raised shadow-raised transition-colors " +
              (isSelected ? "border-brand-purple ring-2 ring-brand-purple/30" : "border-border")
            }
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => onOpen(photo)}
                className="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                aria-label={`Open photograph ${photo.sequence}, ${photo.original_filename ?? "untitled"}`}
              >
                {url ? (
                  <img
                    src={url}
                    alt={`Photograph ${photo.sequence}${photo.original_filename ? `: ${photo.original_filename}` : ""}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-4/3 w-full bg-surface object-cover"
                  />
                ) : (
                  <div className="flex aspect-4/3 w-full items-center justify-center bg-surface text-muted-foreground">
                    <ImageOff aria-hidden="true" className="size-6" />
                    <span className="sr-only">Preview unavailable</span>
                  </div>
                )}
              </button>
              <div className="absolute left-2 top-2 rounded-md bg-background/90 p-1.5">
                <Checkbox
                  checked={isSelected}
                  onClick={(event) => onToggle(photo.id, (event as React.MouseEvent).shiftKey)}
                  aria-label={`Select photograph ${photo.sequence}`}
                  className="size-5"
                />
              </div>
              <span className="absolute right-2 top-2 rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                #{photo.sequence}
              </span>
            </div>

            <div className="p-2.5">
              <p className="truncate text-sm font-medium">
                {photo.original_filename ?? "Untitled photograph"}
              </p>
              <p
                className={
                  "mt-1 flex items-center gap-1.5 text-xs " +
                  (capture.missing ? "text-warn-foreground" : "text-muted-foreground")
                }
              >
                {capture.missing ? (
                  <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
                ) : null}
                <span className="truncate">{capture.text}</span>
              </p>
              {photo.gps_lat !== null && photo.gps_lng !== null ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="truncate tabular-nums">
                    {photo.gps_lat.toFixed(5)}, {photo.gps_lng.toFixed(5)}
                  </span>
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
