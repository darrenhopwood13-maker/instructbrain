import type { DocFindingPhoto } from "@/lib/report/document";

/**
 * A photograph with the region the finding refers to drawn on it. Without the
 * box a busy site photo tells the reader nothing about which part is meant.
 */
export function PhotoFigure({
  attachment,
  caption,
  className,
  useFullResolution = false,
}: {
  attachment: DocFindingPhoto;
  caption?: string;
  className?: string;
  useFullResolution?: boolean;
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
            className="pointer-events-none absolute rounded-sm border-2 border-brand-purple shadow-[0_0_0_9999px_rgba(15,23,42,0.18)]"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.w * 100}%`,
              height: `${region.h * 100}%`,
            }}
          />
        ) : null}
      </div>
      {caption ? (
        <figcaption className="mt-1.5 text-xs text-muted-foreground">
          {caption}
          {region ? " · the marked area indicates the finding" : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
