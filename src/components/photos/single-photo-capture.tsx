import { useCallback, useRef, useState, type ReactNode } from "react";
import { ContinuousCamera, canUseInAppCamera } from "@/components/photos/continuous-camera";
import { snapshotFile } from "@/lib/photos/file-snapshot";

/**
 * The same capture process as report photos, for screens that need one photo:
 * the in-app camera (time and location stamped), falling back to the phone's
 * own camera, plus the gallery. The file is snapshotted into memory at once so
 * Android cannot release it before upload.
 */
export function useSinglePhotoCapture(onFile: (file: File) => void): {
  takePhoto: () => void;
  choosePhoto: () => void;
  element: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const deliver = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      try {
        onFile(await snapshotFile(file));
      } catch {
        onFile(file);
      }
    },
    [onFile],
  );

  const takePhoto = useCallback(() => {
    if (canUseInAppCamera()) setOpen(true);
    else cameraInput.current?.click();
  }, []);
  const fallback = useCallback(() => cameraInput.current?.click(), []);

  const element = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void deliver(file);
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void deliver(file);
        }}
      />
      <ContinuousCamera
        open={open}
        onOpenChange={setOpen}
        onShot={(file) => void deliver(file)}
        onFallback={fallback}
        uploadedCount={0}
        allowAnalyse={false}
        single
      />
    </>
  );

  return { takePhoto, choosePhoto: () => galleryInput.current?.click(), element };
}
