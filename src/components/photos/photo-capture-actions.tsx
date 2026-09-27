import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PhotoCaptureActions({
  onCamera,
  onGallery,
  disabled = false,
  busy = false,
  compact = false,
}: {
  onCamera: () => void;
  onGallery: () => void;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
      <Button
        type="button"
        variant="brand"
        size={compact ? "default" : "lg"}
        className={compact ? "min-h-12 w-full" : "min-h-14 w-full text-base"}
        disabled={disabled || busy}
        onClick={onCamera}
      >
        <Camera aria-hidden="true" className="size-5 shrink-0" />
        Take photo
      </Button>
      <Button
        type="button"
        variant="quiet"
        size={compact ? "default" : "lg"}
        className={`${compact ? "min-h-12" : "min-h-14 text-base"} h-auto w-full flex-col gap-0 whitespace-normal py-1.5`}
        disabled={disabled || busy}
        onClick={onGallery}
        aria-label="Add from albums — Google Photos, albums or Files. Select as many as you like."
      >
        <span className="flex items-center gap-2">
          <ImagePlus aria-hidden="true" className="size-5 shrink-0" />
          Add from albums
        </span>
        <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">
          Google Photos, albums or Files
        </span>
      </Button>
    </div>
  );
}
