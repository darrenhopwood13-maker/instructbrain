import type { MarkupColour, MarkupLayer } from "@/lib/photos/markup";

const COLOUR_CLASSES: Record<MarkupColour, string> = {
  accent: "var(--brand-accent)",
  red: "var(--fail)",
  yellow: "var(--warn)",
  white: "var(--background)",
  black: "var(--foreground)",
};

export function PhotoMarkupOverlay({ layers }: { layers: MarkupLayer[] }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1000 1000" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
      <defs>
        {layers.map((layer) => (
          <marker key={layer.id} id={`arrow-${layer.id}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={COLOUR_CLASSES[layer.colour]} />
          </marker>
        ))}
      </defs>
      {layers.map((layer) => {
        const x = layer.x * 1000, y = layer.y * 1000, x2 = layer.x2 * 1000, y2 = layer.y2 * 1000;
        const colour = COLOUR_CLASSES[layer.colour];
        if (layer.kind === "arrow") return <line key={layer.id} x1={x} y1={y} x2={x2} y2={y2} stroke={colour} strokeWidth="12" markerEnd={`url(#arrow-${layer.id})`} />;
        if (layer.kind === "rectangle") return <rect key={layer.id} x={Math.min(x, x2)} y={Math.min(y, y2)} width={Math.abs(x2-x)} height={Math.abs(y2-y)} fill="none" stroke={colour} strokeWidth="10" />;
        if (layer.kind === "ellipse") return <ellipse key={layer.id} cx={(x+x2)/2} cy={(y+y2)/2} rx={Math.abs(x2-x)/2} ry={Math.abs(y2-y)/2} fill="none" stroke={colour} strokeWidth="10" />;
        const width = Math.max(140, Math.abs(x2-x));
        const height = Math.max(80, Math.abs(y2-y));
        return (
          <g key={layer.id}>
            {layer.kind === "speech" ? <><rect x={x} y={y} width={width} height={height} rx="24" fill="var(--background)" fillOpacity="0.9" stroke={colour} strokeWidth="8" /><path d={`M${x+width*.2} ${y+height} l-30 55 l75-55`} fill="var(--background)" stroke={colour} strokeWidth="8" /></> : null}
            <text x={x + 18} y={y + 48} fill={colour} stroke={layer.colour === "white" ? "var(--foreground)" : "none"} strokeWidth="1" fontSize="44" fontWeight="700">{layer.text ?? ""}</text>
          </g>
        );
      })}
    </svg>
  );
}