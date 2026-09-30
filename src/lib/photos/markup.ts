export type MarkupColour = "accent" | "red" | "yellow" | "white" | "black";
export type MarkupKind =
  | "text"
  | "arrow"
  | "line"
  | "rectangle"
  | "ellipse"
  | "speech"
  | "pen"
  | "marker";
export type MarkupScale = "s" | "m" | "l";

export type MarkupLayer = {
  id: string;
  kind: MarkupKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  colour: MarkupColour;
  text?: string;
  /** Line thickness. Missing on older layers — treated as medium. */
  stroke?: MarkupScale;
  /** Text / marker size. Missing on older layers — treated as medium. */
  size?: MarkupScale;
  /** Freehand pen points, normalised 0–1. */
  points?: Array<[number, number]>;
  /** Numbered marker value. */
  number?: number;
};

export const MARKUP_KINDS: MarkupKind[] = ["text", "arrow", "line", "rectangle", "ellipse", "speech", "pen", "marker"];
export const MARKUP_COLOURS: MarkupColour[] = ["accent", "red", "yellow", "white", "black"];
const SCALES: MarkupScale[] = ["s", "m", "l"];
export const MAX_PEN_POINTS = 400;

const clamp = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));
const round = (value: number) => Math.round(value * 10000) / 10000;

/** Stroke width in units of 1/1000 of the image height. */
export const STROKE_UNITS: Record<MarkupScale, number> = { s: 5, m: 9, l: 16 };
/** Font size in units of 1/1000 of the image height. */
export const TEXT_UNITS: Record<MarkupScale, number> = { s: 32, m: 46, l: 68 };
export const MARKER_UNITS: Record<MarkupScale, number> = { s: 28, m: 40, l: 58 };

export function coerceMarkup(value: unknown): MarkupLayer[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((entry): MarkupLayer[] => {
      if (!entry || typeof entry !== "object") return [];
      const raw = entry as Record<string, unknown>;
      if (typeof raw["id"] !== "string" || !MARKUP_KINDS.includes(raw["kind"] as MarkupKind)) return [];
      const kind = raw["kind"] as MarkupKind;
      const colour = MARKUP_COLOURS.includes(raw["colour"] as MarkupColour)
        ? (raw["colour"] as MarkupColour)
        : "accent";
      const layer: MarkupLayer = {
        id: raw["id"].slice(0, 64),
        kind,
        x: clamp(raw["x"]),
        y: clamp(raw["y"]),
        x2: clamp(raw["x2"]),
        y2: clamp(raw["y2"]),
        colour,
      };
      if (typeof raw["text"] === "string") layer.text = raw["text"].slice(0, 160);
      if (SCALES.includes(raw["stroke"] as MarkupScale)) layer.stroke = raw["stroke"] as MarkupScale;
      if (SCALES.includes(raw["size"] as MarkupScale)) layer.size = raw["size"] as MarkupScale;
      if (kind === "marker") {
        const n = Math.round(Number(raw["number"]));
        layer.number = Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 1;
      }
      if (kind === "pen") {
        const pts = Array.isArray(raw["points"]) ? raw["points"] : [];
        layer.points = pts
          .flatMap((p): Array<[number, number]> =>
            Array.isArray(p) && p.length >= 2 ? [[round(clamp(p[0])), round(clamp(p[1]))]] : [],
          )
          .slice(0, MAX_PEN_POINTS);
        if (layer.points.length < 2) return [];
      }
      return [layer];
    })
    .slice(0, 100);
}

export function markupId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function newMarkupLayer(kind: MarkupKind, colour: MarkupColour): MarkupLayer {
  return {
    id: markupId(),
    kind,
    x: 0.2,
    y: 0.2,
    x2: kind === "text" ? 0.55 : 0.65,
    y2: kind === "text" ? 0.3 : 0.55,
    colour,
    ...(kind === "text" || kind === "speech" ? { text: kind === "speech" ? "Note" : "Label" } : {}),
  };
}

/** Bounding box of a layer, normalised. */
export function layerBounds(layer: MarkupLayer): { x: number; y: number; x2: number; y2: number } {
  if (layer.kind === "pen" && layer.points?.length) {
    const xs = layer.points.map((p) => p[0]);
    const ys = layer.points.map((p) => p[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }
  return {
    x: Math.min(layer.x, layer.x2),
    y: Math.min(layer.y, layer.y2),
    x2: Math.max(layer.x, layer.x2),
    y2: Math.max(layer.y, layer.y2),
  };
}

/** Move a layer by a normalised offset, keeping it on the photo. */
export function moveLayer(layer: MarkupLayer, dx: number, dy: number): MarkupLayer {
  const b = layerBounds(layer);
  const ox = Math.max(-b.x, Math.min(1 - b.x2, dx));
  const oy = Math.max(-b.y, Math.min(1 - b.y2, dy));
  return {
    ...layer,
    x: clamp(layer.x + ox),
    y: clamp(layer.y + oy),
    x2: clamp(layer.x2 + ox),
    y2: clamp(layer.y2 + oy),
    ...(layer.points ? { points: layer.points.map(([px, py]) => [round(px + ox), round(py + oy)] as [number, number]) } : {}),
  };
}
