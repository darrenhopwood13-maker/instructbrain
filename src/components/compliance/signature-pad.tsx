import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A box to sign in.
 *
 * Drawn with pointer events rather than an image library, because the only thing needed
 * here is a line that follows a finger. The canvas is re-sized to its container in device
 * pixels so a signature drawn on a phone in the rain is not a blurred grey smear on the
 * PDF, and drawing on a resized canvas starts clean rather than leaving a stretched ghost.
 *
 * Nothing is required: a signature that cannot be drawn (keyboard, screen reader, a tablet
 * with a dead digitiser) falls back to the typed name and the timestamp, which is what the
 * report is really evidencing.
 */
export function SignaturePad({
  onChange,
  disabled = false,
  label = "Sign here",
  hint = "Sign with a finger, a stylus or the mouse. Leave it blank if you cannot draw - your typed name and the time are recorded either way.",
}: {
  onChange: (blob: Blob | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
      // A signature that was on the canvas before a resize cannot be recovered, so say so
      // by clearing the ink state rather than reporting a signature that is no longer there.
      setHasInk(false);
      onChange(null);
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
    // onChange is stable in practice and re-fitting on every render would wipe the ink.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    const at = point(event);
    if (!ctx || !at) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    // A tap is a dot, not nothing: a full stop is a signature too.
    ctx.lineTo(at.x + 0.1, at.y + 0.1);
    ctx.stroke();
    setHasInk(true);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    const at = point(event);
    if (!ctx || !at) return;
    ctx.lineTo(at.x, at.y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => onChange(blob), "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={disabled || !hasInk}>
          Clear
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`${label} - drawing area`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className="mt-2 h-32 w-full touch-none rounded-md border border-dashed border-border bg-white"
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
