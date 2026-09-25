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
    <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2"}>
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
        className={compact ? "min-h-12 w-full" : "min-h-14 w-full text-base"}
        disabled={disabled || busy}
        onClick={onGallery}
      >
        <ImagePlus aria-hidden="true" className="size-5 shrink-0" />
        Add photos
      </Button>
    </div>
  );
}