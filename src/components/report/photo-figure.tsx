import type { DocFindingPhoto } from "@/lib/report/document";
import type { Pin } from "@/lib/report/photo-pins";
import { PhotoMarkupOverlay } from "@/components/photos/photo-markup-overlay";

/**
 * A photograph with the region the finding refers to drawn on it. Without the
 * box a busy site photo tells the reader nothing about which part is meant.
 *
 * When one photograph carries several findings it also carries a numbered pin
 * per item, so the schedule can say "Pin 2" and the reader can find it. The
 * number is only drawn where there is a region to point at: a pin floating over
 * an unmarked photograph would be a confident guess.
 */
export function PhotoFigure({
  attachment,
  caption,
  className,
  useFullResolution = false,
  pin = null,
}: {
  attachment: DocFindingPhoto;
  caption?: string;
  className?: string;
  useFullResolution?: boolean;
  /** Set only when this photograph carries more than one finding. */
  pin?: Pin | null;
}) {
  const { photo, region } = attachment;
  const src = useFullResolution ? (photo.url ?? photo.thumbUrl) : (photo.thumbUrl ?? photo.url);

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface-sunken">
        {src ? (
          <img
            src={src}
            alt={
              caption ??
              `Photograph ${photo.sequence}${photo.filename ? ` — ${photo.filename}` : ""}`
            }
            loading="lazy"
            className="block h-auto w-full object-cover"
          />
        ) : (
          <p className="p-6 text-center text-xs text-muted-foreground">
            Photograph unavailable — the stored image could not be read.
          </p>
        )}
        {src && region ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-sm border-2 border-brand-accent shadow-[0_0_0_9999px_rgba(15,23,42,0.18)]"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
              height: `${region.h * 100}%`,
            }}
          />
        ) : null}
        {src && region && pin ? (
          <span
            aria-hidden="true"
            className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-background bg-brand-accent text-[11px] font-bold leading-none text-brand-accent-ink shadow-raised"
            style={{
              left: `${(region.x + region.w / 2) * 100}%`,
              top: `${(region.y + region.h / 2) * 100}%`,
            }}
          >
            {pin.number}
          </span>
        ) : null}
        {src && photo.layers?.length ? <PhotoMarkupOverlay layers={photo.layers} /> : null}
      </div>
      {caption ? (
        <figcaption className="mt-1.5 text-xs text-muted-foreground">
          {caption}
          {pin && region ? ` · Pin ${pin.number} of ${pin.total} on this photograph` : ""}
          {region ? " · the marked area indicates the finding" : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
