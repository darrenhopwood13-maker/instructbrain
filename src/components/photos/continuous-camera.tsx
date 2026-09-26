import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stampFile, stampFor, type Fix } from "@/lib/photos/device-provenance";
import { markAppOwnedFile } from "@/lib/photos/file-snapshot";

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
  single = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShot: (file: File) => void;
  /** Called when the in-app camera cannot give a full-resolution picture. */
  onFallback: () => void;
  uploadedCount: number;
  /** Hidden for templates whose photographs must be organised before analysis. */
  allowAnalyse: boolean;
  /** Close after one shot, for screens that need a single photo. */
  single?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const [locationState, setLocationState] = useState<"waiting" | "on" | "off">("waiting");
  const [starting, setStarting] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flash, setFlash] = useState(false);
  const [analyse, setAnalyse] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      setCapturing(false);
      setDetailsOpen(false);
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

  // Location while the camera is open. Refused or unavailable → time only.
  useEffect(() => {
    if (!open || typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState(open ? "off" : "waiting");
      return;
    }
    setLocationState("waiting");
    const id = navigator.geolocation.watchPosition(
      (position) => {
        fixRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          at: position.timestamp || Date.now(),
        };
        setLocationState("on");
      },
      () => setLocationState("off"),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      fixRef.current = null;
    };
  }, [open]);

  const takeShot = useCallback(async () => {
    if (capturing) return;
    const stream = streamRef.current;
    const video = videoRef.current;
    const track = stream?.getVideoTracks()[0];
    if (!track || !video) return;
    setCapturing(true);
    const shotAt = Date.now();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 120);
    try {
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
      const file = markAppOwnedFile(new File([blob], `photo-${now}.jpg`, {
        type: blob.type || "image/jpeg",
        lastModified: now,
      }));
      stampFile(file, stampFor(shotAt, fixRef.current));
      const url = URL.createObjectURL(blob);
      setShots((current) => [...current, { id: String(now), url }]);
      onShot(file);
      if (single) onOpenChange(false);
    } finally {
      setCapturing(false);
    }
  }, [capturing, onShot, single, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden border-0 bg-foreground p-0 text-background shadow-none [&>button]:hidden sm:h-[min(92dvh,900px)] sm:w-[min(92vw,720px)] sm:rounded-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Take photos</DialogTitle>
          <DialogDescription>Keep pressing the shutter. Each photo uploads in the background.</DialogDescription>
        </DialogHeader>

        <div className="absolute inset-0 overflow-hidden bg-foreground">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Camera view"
            className="h-full w-full object-cover"
          />
          {starting ? (
            <div className="absolute inset-0 grid place-items-center bg-foreground text-background">
              <Loader2 aria-hidden="true" className="size-8 animate-spin" />
              <span className="sr-only">Opening the camera…</span>
            </div>
          ) : null}
          {flash ? <div aria-hidden="true" className="absolute inset-0 bg-background/60" /> : null}
        </div>

        <div className="absolute inset-x-0 top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-gradient-to-b from-foreground/80 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="flex min-h-11 min-w-0 items-center gap-2 justify-self-start rounded-full bg-foreground/70 px-3 text-sm font-semibold text-background backdrop-blur-sm"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((current) => !current)}
          >
            <span className="truncate">{shots.length} taken · {Math.min(uploadedCount, shots.length)} uploaded</span>
            <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
          <Button
            type="button"
            variant="quiet"
            size="icon"
            className="size-11 shrink-0 border-background/40 bg-foreground/70 text-background backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Done taking photos"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        {detailsOpen ? (
          <div className="absolute left-3 right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+4.25rem))] z-20 space-y-3 rounded-lg bg-foreground/85 p-3 text-background shadow-sheet backdrop-blur-md sm:left-auto sm:w-96">
            <p className="flex min-h-11 items-center gap-2 text-sm">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {locationState === "on"
                ? "Time and location recorded"
                : locationState === "off"
                  ? "Time recorded · location unavailable"
                  : "Finding your location…"}
            </p>
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
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-foreground/90 via-foreground/55 to-transparent px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
          {shots.length > 0 ? (
            <ol className="mb-3 flex justify-center gap-2 overflow-hidden" aria-label="Recent photos taken">
              {shots.slice(-5).map((shot, index, visible) => (
                <li key={shot.id} className="relative shrink-0">
                  <img src={shot.url} alt="" className="size-12 rounded border border-background/50 object-cover" />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-foreground/80 px-1 text-[10px] font-semibold text-background">
                    {shots.length - visible.length + index + 1}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <span aria-hidden="true" />
          <Button
            type="button"
            variant="brand"
            className="size-20 rounded-full border-4 border-background shadow-sheet active:scale-95"
            disabled={starting || capturing}
            onClick={() => void takeShot()}
            aria-label={capturing ? "Saving photo" : "Take photo"}
          >
            {capturing ? <Loader2 aria-hidden="true" className="size-8 animate-spin" /> : <Camera aria-hidden="true" className="size-8" />}
          </Button>
            <p role="status" aria-live="polite" className="min-w-0 justify-self-end text-right text-xs font-semibold text-background">
              {capturing ? "Saving…" : "Ready"}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
