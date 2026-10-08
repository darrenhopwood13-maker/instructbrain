import { useRef, useState } from "react";
import type { DocFindingPhoto, DocRegion } from "@/lib/report/document";
import type { Pin } from "@/lib/report/photo-pins";
import { PhotoMarkupOverlay } from "@/components/photos/photo-markup-overlay";

/** One patch of the photograph, and the pin number it carries if any. */
export type PhotoMark = {
  region: DocRegion;
  /** Set only where a photograph carries more than one marked item. */
  number?: number | null;
  total?: number;
  findingId?: string;
};

const clamp01 = (value: number, limit: number) => Math.max(0, Math.min(limit, value));

/**
 * A photograph with the region the finding refers to drawn on it. Without the
 * box a busy site photo tells the reader nothing about which part is meant.
 *
 * When one photograph carries several marked findings the caller passes every
 * mark and the photograph is shown ONCE, with a numbered pin per item, so the
 * schedule can say "Pin 2 of 6" and the reader can find it. Marks are passed in
 * rather than read off the attachment because a shared photograph belongs to
 * more than one finding and this component only ever holds the one picture.
 *
 * Tapping a pin (`zoomable`) shows that patch at full width, because the patch
 * is the thing the reader came for and on a phone the whole frame is not.
 *
 * Dragging a box (`onRegionMove`) corrects it. The region is the model's
 * estimate and will sometimes be in the wrong place, so a person has to be able
 * to move it; the correction is written to the finding↔photo link, which wins
 * over the model's own region at read time, so the original estimate is never
 * destroyed. Dragging needs a pointer, so it is not offered to a keyboard user —
 * the pin number and the caption carry the same information without it.
 */
export function PhotoFigure({
  attachment,
  caption,
  className,
  useFullResolution = false,
  pin = null,
  marks,
  zoomable = false,
  onRegionMove,
}: {
  attachment: DocFindingPhoto;
  caption?: string;
  className?: string;
  useFullResolution?: boolean;
  /** Set only when this photograph carries more than one marked finding. */
  pin?: Pin | null;
  /** Every mark to draw. Defaults to the attachment's own region. */
  marks?: PhotoMark[] | null;
  /** Let a reader tap a pin to see that patch full width. */
  zoomable?: boolean;
  /** Let a person drag a box to the right place. Omit to make the box fixed. */
  onRegionMove?: (findingId: string, region: DocRegion) => void;
}) {
  const { photo, region } = attachment;
  const src = useFullResolution ? (photo.url ?? photo.thumbUrl) : (photo.thumbUrl ?? photo.url);
  const drawn: PhotoMark[] =
    marks ?? (region ? [{ region, number: pin?.number ?? null, ...(pin ? { total: pin.total } : {}) }] : []);

  const [zoomed, setZoomed] = useState<PhotoMark | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // A drag keeps its own preview, so the box follows the finger without waiting
  // for a round trip to the database.
  const [moved, setMoved] = useState<PhotoMark[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    index: number;
    rect: DOMRect;
    startX: number;
    startY: number;
    base: DocRegion;
    findingId?: string;
  } | null>(null);

  const shown = moved ?? drawn;

  const beginDrag = (index: number) => (event: React.PointerEvent<HTMLSpanElement>) => {
    const mark = shown[index];
    if (!onRegionMove || !mark?.findingId) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    event.preventDefault();
    // Pointer capture is what keeps the box following the finger when it leaves
    // the frame. Guarded because older Safari and jsdom do not implement it.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      index,
      rect,
      startX: event.clientX,
      startY: event.clientY,
      base: mark.region,
      ...(mark.findingId ? { findingId: mark.findingId } : {}),
    };
    setMoved(drawn);
    setDragging(index);
  };

  const move = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / drag.rect.width;
    const dy = (event.clientY - drag.startY) / drag.rect.height;
    setMoved((current) =>
      (current ?? drawn).map((mark, index) =>
        index === drag.index
          ? {
              ...mark,
              region: {
                x: clamp01(drag.base.x + dx, 1 - drag.base.w),
                y: clamp01(drag.base.y + dy, 1 - drag.base.h),
                w: drag.base.w,
                h: drag.base.h,
              },
            }
          : mark,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragging(null);
    if (!drag) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const final = (moved ?? drawn)[drag.index]?.region;
    if (final && drag.findingId) onRegionMove?.(drag.findingId, final);
  };

  // Scale about the container centre and slide the patch to the middle, so the
  // patch lands in the viewport without needing the photo's pixel dimensions to
  // be known up front. Uniform scale, never stretched.
  const scale = zoomed ? 1 / Math.max(zoomed.region.w, zoomed.region.h, 0.05) : 1;
  const cx = zoomed ? zoomed.region.x + zoomed.region.w / 2 : 0.5;
  const cy = zoomed ? zoomed.region.y + zoomed.region.h / 2 : 0.5;
  const zoomStyle = zoomed
    ? {
        transform: `translate(${-scale * (cx - 0.5) * 100}%, ${-scale * (cy - 0.5) * 100}%) scale(${scale})`,
        transformOrigin: "50% 50%",
      }
    : undefined;

  return (
    <figure className={className}>
      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-lg border border-border bg-surface-sunken"
        {...(zoomed && natural ? { style: { aspectRatio: `${natural.w} / ${natural.h}` } } : {})}
      >
        {src ? (
          <img
            src={src}
            alt={
              caption ??
              `Photograph ${photo.sequence}${photo.filename ? ` — ${photo.filename}` : ""}`
            }
            loading="lazy"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth > 0) setNatural({ w: image.naturalWidth, h: image.naturalHeight });
            }}
            className={zoomed ? "absolute inset-0 size-full object-contain" : "block h-auto w-full object-cover"}
            {...(zoomStyle ? { style: zoomStyle } : {})}
          />
        ) : (
          <p className="p-6 text-center text-xs text-muted-foreground">
            Photograph unavailable — the stored image could not be read.
          </p>
        )}
        {src && shown.length > 0 ? (
          <div className="absolute inset-0" {...(zoomStyle ? { style: zoomStyle } : {})}>
            {shown.map((mark, index) => {
              const centreX = (mark.region.x + mark.region.w / 2) * 100;
              const centreY = (mark.region.y + mark.region.h / 2) * 100;
              const number = mark.number ?? null;
              const draggable = !!onRegionMove && !!mark.findingId;
              return (
                <span key={`${mark.findingId ?? "mark"}-${index}`}>
                  <span
                    aria-hidden={draggable ? undefined : true}
                    role={draggable ? "button" : undefined}
                    aria-label={draggable ? "Move the marked area to the right place" : undefined}
                    onPointerDown={draggable ? beginDrag(index) : undefined}
                    onPointerMove={draggable ? move : undefined}
                    onPointerUp={draggable ? endDrag : undefined}
                    onPointerCancel={draggable ? endDrag : undefined}
                    className={
                      "absolute rounded-sm border-2 border-brand-accent " +
                      (dragging === index
                        ? "cursor-grabbing touch-none shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]"
                        : "shadow-[0_0_0_9999px_rgba(15,23,42,0.18)] " +
                          (draggable ? "cursor-grab touch-none" : "pointer-events-none"))
                    }
                    style={{
                      left: `${mark.region.x * 100}%`,
                      top: `${mark.region.y * 100}%`,
                      width: `${mark.region.w * 100}%`,
                      height: `${mark.region.h * 100}%`,
                    }}
                  />
                  {number !== null && !zoomed ? (
                    <button
                      type="button"
                      aria-label={
                        zoomable
                          ? `Pin ${number}${mark.total ? ` of ${mark.total}` : ""} — show this area full width`
                          : `Pin ${number}${mark.total ? ` of ${mark.total}` : ""}`
                      }
                      onClick={zoomable ? () => setZoomed(mark) : undefined}
                      className={
                        "absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center " +
                        "rounded-full border-2 border-background bg-brand-accent text-[11px] font-bold leading-none " +
                        "text-brand-accent-ink shadow-raised " +
                        (zoomable ? "pointer-events-auto cursor-zoom-in" : "pointer-events-none")
                      }
                      style={{ left: `${centreX}%`, top: `${centreY}%` }}
                    >
                      {number}
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : null}
        {src && photo.layers?.length ? <PhotoMarkupOverlay layers={photo.layers} /> : null}
        {zoomed ? (
          <button
            type="button"
            onClick={() => setZoomed(null)}
            className="absolute right-2 top-2 z-20 rounded-md bg-foreground/80 px-2 py-1 text-[11px] font-semibold text-background"
          >
            Show whole photograph
          </button>
        ) : null}
      </div>
      {caption ? (
        <figcaption className="mt-1.5 text-xs text-muted-foreground">
          {caption}
          {pin && region && shown.length === 1 ? ` · Pin ${pin.number} of ${pin.total} on this photograph` : ""}
          {region && shown.length === 1 ? " · the marked area indicates the finding" : ""}
          {onRegionMove && shown.some((mark) => mark.findingId)
            ? " · drag a marked area to the right place and it is saved"
            : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}
