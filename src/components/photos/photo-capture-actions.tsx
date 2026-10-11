import { Camera, ImagePlus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The three ways a photograph gets into a report, each named for what it
 * actually does.
 *
 * WHY THE ORDER IS THIS WAY (Dal, 11 Oct, from a phone): "why do we have to use
 * the video recorder to take photos in the app anyway?"
 *
 * Because that is literally what the in-app camera is. It holds a getUserMedia
 * video stream open and lifts frames out of it, which buys a camera that never
 * closes between shots — genuinely useful on a walk-round — and pays for it in
 * resolution. A video track offers 1280x720 or 1920x1080; the phone's own
 * camera gives 3072x4080. That is three quarters to seven eighths of the sensor
 * discarded before anything else can go wrong.
 *
 * On iOS it cannot be fixed. Safari supports neither ImageCapture.takePhoto nor
 * grabFrame, so the in-app camera there is permanently capped at video
 * resolution. Only Chromium can reach a full-resolution still from a stream.
 *
 * A 2mm sealant gap is the product, and a Schedule of Condition is evidence, so
 * the phone's own camera leads. The keep-shooting camera is still one tap away
 * and says what it costs. Nothing is hidden and nothing is chosen silently.
 */
export function PhotoCaptureActions({
  onCamera,
  onGallery,
  onInAppCamera,
  disabled = false,
  busy = false,
  compact = false,
  showHint = true,
}: {
  /** The phone's own camera. Full sensor resolution. */
  onCamera: () => void;
  onGallery: () => void;
  /** The keep-shooting in-app camera. Omitted where the browser cannot offer one. */
  onInAppCamera?: (() => void) | undefined;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  showHint?: boolean;
}) {
  const stack = compact ? "grid grid-cols-2 gap-2" : "grid gap-2";
  const tall = compact ? "min-h-12" : "min-h-14 text-base";
  const shaped = `${tall} h-auto w-full flex-col gap-0 whitespace-normal py-1.5`;

  const hint = (text: string) =>
    showHint ? (
      <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">
        {text}
      </span>
    ) : null;

  return (
    <div className={stack}>
      <Button
        type="button"
        variant="brand"
        size={compact ? "default" : "lg"}
        className={shaped}
        disabled={disabled || busy}
        onClick={onCamera}
        aria-label="Take photo with your phone's camera, at full resolution"
      >
        <span className="flex items-center gap-2">
          <Camera aria-hidden="true" className="size-5 shrink-0" />
          Take photo
        </span>
        {hint("Your phone's camera, full resolution")}
      </Button>

      {onInAppCamera ? (
        <Button
          type="button"
          variant="quiet"
          size={compact ? "default" : "lg"}
          className={shaped}
          disabled={disabled || busy}
          onClick={onInAppCamera}
          aria-label="Keep shooting with the in-app camera. It stays open between shots but captures at a lower resolution."
        >
          <span className="flex items-center gap-2">
            <Smartphone aria-hidden="true" className="size-5 shrink-0" />
            Keep shooting
          </span>
          {hint("In-app, stays open, lower resolution")}
        </Button>
      ) : null}

      <Button
        type="button"
        variant="quiet"
        size={compact ? "default" : "lg"}
        className={`${shaped} ${compact && onInAppCamera ? "col-span-2" : ""}`}
        disabled={disabled || busy}
        onClick={onGallery}
        aria-label="Add from albums — Google Photos, albums or Files. Select as many as you like."
      >
        <span className="flex items-center gap-2">
          <ImagePlus aria-hidden="true" className="size-5 shrink-0" />
          Add from albums
        </span>
        {hint("Google Photos, albums or Files")}
      </Button>
    </div>
  );
}
