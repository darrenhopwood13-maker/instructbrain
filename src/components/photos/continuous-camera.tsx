import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * In-app camera that stays open between shots. Each shot is handed over the
 * moment the shutter is pressed so its upload starts while the next is taken.
 *
 * Invariant 3: shots are taken at the full resolution the camera track offers;
 * a track under the minimum long edge is refused and the phone's own camera is
 * used instead. Nothing here resizes a photograph.
 */
export const MIN_LONG_EDGE = 1500;
const ANALYSE_KEY = "instructbrain.analyse-while-shooting";

export function analyseWhileShooting(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ANALYSE_KEY) === "1";
}

export function canUseInAppCamera(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/** True when the camera track is large enough for analysis. */
export function trackMeetsMinimum(width: number, height: number): boolean {
  return Math.max(width, height) >= MIN_LONG_EDGE;
}

type Shot = { id: string; url: string };

export function ContinuousCamera({
  open,
  onOpenChange,
  onShot,
  onFallback,
  uploadedCount,
  allowAnalyse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShot: (file: File) => void;
  /** Called when the in-app camera cannot give a full-resolution picture. */
  onFallback: () => void;
  uploadedCount: number;
  /** Hidden for templates whose photographs must be organised before analysis. */
  allowAnalyse: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState(false);
  const [analyse, setAnalyse] = useState(false);

  useEffect(() => {
    setAnalyse(analyseWhileShooting());
  }, [open]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      setShots((current) => {
        current.forEach((shot) => URL.revokeObjectURL(shot.url));
        return [];
      });
      return;
    }
    let cancelled = false;
    setStarting(true);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 4096 },
            height: { ideal: 3072 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const settings = stream.getVideoTracks()[0]?.getSettings() ?? {};
        const width = settings.width ?? video?.videoWidth ?? 0;
        const height = settings.height ?? video?.videoHeight ?? 0;
        if (!trackMeetsMinimum(width, height)) {
          stop();
          onOpenChange(false);
          onFallback();
        }
      } catch {
        if (cancelled) return;
        stop();
        onOpenChange(false);
        onFallback();
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, stop, onOpenChange, onFallback]);

  const takeShot = useCallback(async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track || !video) return;
    setFlash(true);
    window.setTimeout(() => setFlash(false), 120);
    let blob: Blob | null = null;
    const Capture = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
    if (Capture) {
      try {
        blob = await new Capture(track).takePhoto();
      } catch {
        blob = null;
      }
    }
    if (!blob) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95),
      );
    }
    if (!blob) return;
    const now = Date.now();
    const file = new File([blob], `photo-${now}.jpg`, {
      type: blob.type || "image/jpeg",
      lastModified: now,
    });
    onShot(file);
    setShots((current) => [...current, { id: String(now), url: URL.createObjectURL(blob!) }]);
  }, [onShot]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-3 rounded-none p-3 sm:h-[90dvh] sm:max-w-2xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle>Take photos</DialogTitle>
          <DialogDescription>
            Keep pressing the shutter. Each photo uploads while you take the next.
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-foreground">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Camera view"
            className="h-full w-full object-contain"
          />
          {starting ? (
            <div className="absolute inset-0 grid place-items-center text-background">
              <Loader2 aria-hidden="true" className="size-8 animate-spin" />
              <span className="sr-only">Opening the camera…</span>
            </div>
          ) : null}
          {flash ? <div aria-hidden="true" className="absolute inset-0 bg-background/60" /> : null}
        </div>

        <p role="status" aria-live="polite" className="text-center text-sm font-semibold">
          {shots.length} taken · {Math.min(uploadedCount, shots.length)} uploaded
        </p>

        {shots.length > 0 ? (
          <ol className="flex gap-2 overflow-x-auto" aria-label="Photos taken">
            {shots.slice(-8).map((shot, index, visible) => (
              <li key={shot.id} className="relative shrink-0">
                <img src={shot.url} alt="" className="size-12 rounded object-cover" />
                <span className="absolute bottom-0 right-0 rounded-tl bg-background px-1 text-[10px] font-semibold">
                  {shots.length - visible.length + index + 1}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {allowAnalyse ? (
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            <span>Analyse as I shoot</span>
            <Switch
              checked={analyse}
              onCheckedChange={(value) => {
                setAnalyse(value);
                window.localStorage.setItem(ANALYSE_KEY, value ? "1" : "0");
              }}
              aria-label="Analyse each photo as soon as it uploads"
            />
          </label>
        ) : null}

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-[env(safe-area-inset-bottom)]">
          <span />
          <Button
            type="button"
            variant="brand"
            className="size-20 rounded-full"
            disabled={starting}
            onClick={() => void takeShot()}
            aria-label="Take photo"
          >
            <Camera aria-hidden="true" className="size-8" />
          </Button>
          <Button
            type="button"
            variant="quiet"
            className="min-h-12 justify-self-end"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
