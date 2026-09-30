import { useEffect, useRef, useState } from "react";
import {
  MARKER_UNITS,
  STROKE_UNITS,
  TEXT_UNITS,
  type MarkupColour,
  type MarkupLayer,
} from "@/lib/photos/markup";

export const MARKUP_COLOUR_VARS: Record<MarkupColour, string> = {
  accent: "var(--brand-accent)",
  red: "var(--fail)",
  yellow: "var(--warn)",
  white: "var(--background)",
  black: "var(--foreground)",
};

/** Contrasting backing for text drawn in a given colour. */
function backingFor(colour: MarkupColour): string {
  return colour === "white" || colour === "yellow" || colour === "accent" ? "var(--foreground)" : "var(--background)";
}

/**
 * Renders saved markup on top of a photograph. It measures its own box so the
 * drawing coordinate space matches the photo's real proportions — text and
 * circles never stretch.
 */
export function PhotoMarkupOverlay({ layers, className }: { layers: MarkupLayer[]; className?: string }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box && box.height > 0) setAspect(box.width / box.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox={`0 0 ${1000 * aspect} 1000`}
      preserveAspectRatio="none"
      className={className ?? "pointer-events-none absolute inset-0 size-full"}
    >
      <MarkupShapes layers={layers} width={1000 * aspect} />
    </svg>
  );
}

/** Pure SVG shapes in a (width × 1000) coordinate space. */
export function MarkupShapes({ layers, width }: { layers: MarkupLayer[]; width: number }) {
  const H = 1000;
  return (
    <>
      {layers.map((layer) => {
        const x = layer.x * width, y = layer.y * H, x2 = layer.x2 * width, y2 = layer.y2 * H;
        const colour = MARKUP_COLOUR_VARS[layer.colour];
        const sw = STROKE_UNITS[layer.stroke ?? "m"];
        const outline = { stroke: "var(--foreground)", strokeOpacity: 0.35, strokeWidth: sw + 4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
        const main = { stroke: colour, strokeWidth: sw, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
        if (layer.kind === "arrow" || layer.kind === "line") {
          const angle = Math.atan2(y2 - y, x2 - x);
          const head = sw * 3.2;
          const hp = `M${x2},${y2} L${x2 - head * Math.cos(angle - 0.45)},${y2 - head * Math.sin(angle - 0.45)} M${x2},${y2} L${x2 - head * Math.cos(angle + 0.45)},${y2 - head * Math.sin(angle + 0.45)}`;
          const d = `M${x},${y} L${x2},${y2}${layer.kind === "arrow" ? " " + hp : ""}`;
          return <g key={layer.id}><path d={d} {...outline} /><path d={d} {...main} /></g>;
        }
        if (layer.kind === "pen" && layer.points) {
          const d = layer.points.map(([px, py], i) => `${i ? "L" : "M"}${px * width},${py * H}`).join(" ");
          return <g key={layer.id}><path d={d} {...outline} /><path d={d} {...main} /></g>;
        }
        if (layer.kind === "rectangle") {
          const r = { x: Math.min(x, x2), y: Math.min(y, y2), width: Math.abs(x2 - x), height: Math.abs(y2 - y) };
          return <g key={layer.id}><rect {...r} {...outline} /><rect {...r} {...main} /></g>;
        }
        if (layer.kind === "ellipse") {
          const e = { cx: (x + x2) / 2, cy: (y + y2) / 2, rx: Math.abs(x2 - x) / 2, ry: Math.abs(y2 - y) / 2 };
          return <g key={layer.id}><ellipse {...e} {...outline} /><ellipse {...e} {...main} /></g>;
        }
        if (layer.kind === "marker") {
          const r = MARKER_UNITS[layer.size ?? "m"];
          return (
            <g key={layer.id}>
              <circle cx={x} cy={y} r={r} fill={colour} stroke="var(--background)" strokeWidth={r * 0.14} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.15} fontWeight="800" fill={backingFor(layer.colour)}>{layer.number ?? 1}</text>
            </g>
          );
        }
        // text and speech
        const fs = TEXT_UNITS[layer.size ?? "m"];
        const label = layer.text ?? "";
        const pad = fs * 0.35;
        const w = Math.max(fs * 2, label.length * fs * 0.56 + pad * 2);
        const h = fs * 1.4;
        const bx = Math.min(x, width - w);
        const by = y;
        const isSpeech = layer.kind === "speech";
        const bg = isSpeech ? "var(--background)" : backingFor(layer.colour);
        const fg = isSpeech ? "var(--foreground)" : colour;
        return (
          <g key={layer.id}>
            {isSpeech ? (
              <path d={`M${bx + w * 0.18},${by + h - 2} l${-fs * 0.5},${fs * 0.9} l${fs * 1.2},${-fs * 0.9} z`} fill={bg} stroke={colour} strokeWidth={sw * 0.6} strokeLinejoin="round" />
            ) : null}
            <rect x={bx} y={by} width={w} height={h} rx={isSpeech ? fs * 0.45 : fs * 0.18} fill={bg} fillOpacity={isSpeech ? 0.97 : 0.82} stroke={isSpeech ? colour : "none"} strokeWidth={sw * 0.6} />
            <text x={bx + pad} y={by + h / 2} dominantBaseline="central" fontSize={fs} fontWeight="700" fill={fg}>{label}</text>
          </g>
        );
      })}
    </>
  );
}
