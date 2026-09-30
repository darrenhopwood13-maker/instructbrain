export type MarkupColour = "accent" | "red" | "yellow" | "white" | "black";
export type MarkupKind = "text" | "arrow" | "rectangle" | "ellipse" | "speech";

export type MarkupLayer = {
  id: string;
  kind: MarkupKind;
  x: number;
  y: number;
  x2: number;
  y2: number;
  colour: MarkupColour;
  text?: string;
};

const KINDS: MarkupKind[] = ["text", "arrow", "rectangle", "ellipse", "speech"];
const COLOURS: MarkupColour[] = ["accent", "red", "yellow", "white", "black"];
const clamp = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));

export function coerceMarkup(value: unknown): MarkupLayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    if (typeof raw["id"] !== "string" || !KINDS.includes(raw["kind"] as MarkupKind)) return [];
    const colour = COLOURS.includes(raw["colour"] as MarkupColour)
      ? (raw["colour"] as MarkupColour)
      : "accent";
    return [{
      id: raw["id"],
      kind: raw["kind"] as MarkupKind,
      x: clamp(raw["x"]),
      y: clamp(raw["y"]),
      x2: clamp(raw["x2"]),
      y2: clamp(raw["y2"]),
      colour,
      ...(typeof raw["text"] === "string" ? { text: raw["text"].slice(0, 160) } : {}),
    }];
  }).slice(0, 100);
}

export function newMarkupLayer(kind: MarkupKind, colour: MarkupColour): MarkupLayer {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  return {
    id,
    kind,
    x: 0.2,
    y: 0.2,
    x2: kind === "text" ? 0.55 : 0.65,
    y2: kind === "text" ? 0.3 : 0.55,
    colour,
    ...(kind === "text" || kind === "speech" ? { text: kind === "speech" ? "Note" : "Label" } : {}),
  };
}