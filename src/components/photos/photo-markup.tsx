import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Circle,
  Copy,
  Hash,
  Minus,
  MousePointer2,
  MessageSquare,
  PenTool,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getManualPhotoEntry, saveManualPhotoEntry } from "@/lib/photos/manual-report.functions";
import {
  MARKER_UNITS,
  MAX_PEN_POINTS,
  TEXT_UNITS,
  markupId,
  moveLayer,
  layerBounds,
  type MarkupColour,
  type MarkupKind,
  type MarkupLayer,
  type MarkupScale,
} from "@/lib/photos/markup";
import { MARKUP_COLOUR_VARS, MarkupShapes } from "@/components/photos/photo-markup-overlay";

type Tool = "select" | MarkupKind;
type Drag =
  | { mode: "draw"; id: string; before: MarkupLayer[] }
  | { mode: "move"; id: string; before: MarkupLayer[]; start: [number, number]; origin: MarkupLayer }
  | { mode: "handle"; id: string; before: MarkupLayer[]; handle: "a" | "b" };

const TOOLS: Array<{ id: Tool; label: string; Icon: typeof Type }> = [
  { id: "select", label: "Select and move", Icon: MousePointer2 },
  { id: "arrow", label: "Arrow", Icon: ArrowUpRight },
  { id: "line", label: "Line", Icon: Minus },
  { id: "rectangle", label: "Rectangle", Icon: Square },
  { id: "ellipse", label: "Circle", Icon: Circle },
  { id: "pen", label: "Freehand pen", Icon: PenTool },
  { id: "text", label: "Text label", Icon: Type },
  { id: "speech", label: "Speech bubble", Icon: MessageSquare },
  { id: "marker", label: "Numbered marker", Icon: Hash },
];
const COLOUR_LABELS: Record<MarkupColour, string> = { accent: "Green", red: "Red", yellow: "Yellow", white: "White", black: "Black" };
const SCALE_LABELS: Record<MarkupScale, string> = { s: "Small", m: "Medium", l: "Large" };
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Normalised hit box for any layer, matching how it is drawn. */
function hitBox(layer: MarkupLayer, aspect: number) {
  if (layer.kind === "text" || layer.kind === "speech") {
    const fs = TEXT_UNITS[layer.size ?? "m"] / 1000;
    const w = Math.max(fs * 2, (layer.text ?? "").length * fs * 0.56 + fs * 0.7) / aspect;
    return { x: Math.min(layer.x, 1 - w), y: layer.y, x2: Math.min(layer.x, 1 - w) + w, y2: layer.y + fs * 1.4 };
  }
  if (layer.kind === "marker") {
    const r = MARKER_UNITS[layer.size ?? "m"] / 1000;
    return { x: layer.x - r / aspect, y: layer.y - r, x2: layer.x + r / aspect, y2: layer.y + r };
  }
  return layerBounds(layer);
}

export function PhotoMarkupEditor({ open, onOpenChange, reportId, photoId, photoUrl, sequence, onSaved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  photoId: string | null;
  photoUrl: string | null;
  sequence: number | null;
  onSaved?: () => void;
}) {
  const loadEntry = useServerFn(getManualPhotoEntry);
  const saveEntry = useServerFn(saveManualPhotoEntry);
  const [description, setDescription] = useState("");
  const [layers, setLayers] = useState<MarkupLayer[]>([]);
  const [history, setHistory] = useState<MarkupLayer[][]>([]);
  const [future, setFuture] = useState<MarkupLayer[][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("arrow");
  const [colour, setColour] = useState<MarkupColour>("red");
  const [stroke, setStroke] = useState<MarkupScale>("m");
  const [size, setSize] = useState<MarkupScale>("m");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const [focusText, setFocusText] = useState(false);

  useEffect(() => {
    if (!open || !photoId) return;
    setBusy(true);
    setFullUrl(null);
    setSelected(null);
    setDirty(false);
    setConfirmClose(false);
    void loadEntry({ data: { reportId, photoId } })
      .then((entry) => {
        setDescription(entry.description);
        setLayers(entry.layers);
        setFullUrl(entry.imageUrl ?? null);
        setHistory([]);
        setFuture([]);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "The photograph could not be opened."))
      .finally(() => setBusy(false));
  }, [open, photoId, reportId, loadEntry]);

  useEffect(() => {
    if (focusText && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
      setFocusText(false);
    }
  }, [focusText, selected]);

  const selectedLayer = useMemo(() => layers.find((l) => l.id === selected) ?? null, [layers, selected]);
  const src = fullUrl ?? photoUrl;

  const commit = useCallback((next: MarkupLayer[], before: MarkupLayer[] = layers) => {
    setHistory((items) => [...items.slice(-49), before]);
    setFuture([]);
    setLayers(next);
    setDirty(true);
  }, [layers]);
  const patchSelected = (patch: Partial<MarkupLayer>) => {
    if (!selected) return;
    commit(layers.map((l) => (l.id === selected ? { ...l, ...patch } : l)));
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [layers, ...items]);
    setLayers(previous);
    setHistory((items) => items.slice(0, -1));
    setSelected(null);
    setDirty(true);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, layers]);
    setLayers(next);
    setFuture((items) => items.slice(1));
    setDirty(true);
  };
  const removeSelected = () => {
    if (!selected) return;
    commit(layers.filter((l) => l.id !== selected));
    setSelected(null);
  };
  const duplicateSelected = () => {
    if (!selectedLayer) return;
    const copy = { ...moveLayer(selectedLayer, 0.04, 0.04), id: markupId() };
    if (copy.kind === "marker") copy.number = nextMarker();
    commit([...layers, copy]);
    setSelected(copy.id);
  };
  const nextMarker = () => Math.max(0, ...layers.filter((l) => l.kind === "marker").map((l) => l.number ?? 0)) + 1;

  const point = (event: { clientX: number; clientY: number }): [number, number] => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return [0, 0];
    return [clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height)];
  };

  const onCanvasDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy) return;
    const [px, py] = point(event);
    const target = event.target as HTMLElement | SVGElement;
    const handle = target.getAttribute?.("data-handle") as "a" | "b" | null;
    const layerId = target.getAttribute?.("data-layer");
    canvasRef.current?.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (handle && selected) {
      drag.current = { mode: "handle", id: selected, before: layers, handle };
      return;
    }
    if (layerId && (tool === "select" || layerId === selected)) {
      const origin = layers.find((l) => l.id === layerId);
      if (!origin) return;
      setSelected(layerId);
      drag.current = { mode: "move", id: layerId, before: layers, start: [px, py], origin };
      return;
    }
    if (tool === "select") {
      setSelected(null);
      return;
    }
    const base = { id: markupId(), colour, stroke, size, x: px, y: py, x2: px, y2: py };
    if (tool === "text" || tool === "speech" || tool === "marker") {
      const layer: MarkupLayer =
        tool === "marker"
          ? { ...base, kind: "marker", number: nextMarker() }
          : { ...base, kind: tool, text: tool === "speech" ? "Note" : "Label" };
      commit([...layers, layer]);
      setSelected(layer.id);
      if (tool !== "marker") setFocusText(true);
      canvasRef.current?.releasePointerCapture(event.pointerId);
      return;
    }
    const layer: MarkupLayer = { ...base, kind: tool, ...(tool === "pen" ? { points: [[px, py]] as Array<[number, number]> } : {}) };
    drag.current = { mode: "draw", id: layer.id, before: layers };
    setLayers([...layers, layer]);
    setSelected(layer.id);
  };

  const onCanvasMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const [px, py] = point(event);
    setLayers((current) =>
      current.map((l) => {
        if (l.id !== d.id) return l;
        if (d.mode === "move") return moveLayer(d.origin, px - d.start[0], py - d.start[1]);
        if (d.mode === "handle") return d.handle === "a" ? { ...l, x: px, y: py } : { ...l, x2: px, y2: py };
        if (l.kind === "pen") {
          const pts = l.points ?? [];
          const last = pts.at(-1);
          if (pts.length >= MAX_PEN_POINTS || (last && Math.hypot(last[0] - px, last[1] - py) < 0.004)) return l;
          const next = [...pts, [px, py] as [number, number]];
          const b = layerBounds({ ...l, points: next });
          return { ...l, points: next, x: b.x, y: b.y, x2: b.x2, y2: b.y2 };
        }
        return { ...l, x2: px, y2: py };
      }),
    );
  };

  const onCanvasUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    setLayers((current) => {
      let next = current;
      if (d.mode === "draw") {
        next = current.flatMap((l) => {
          if (l.id !== d.id) return [l];
          if (l.kind === "pen") return (l.points?.length ?? 0) >= 2 ? [l] : [];
          // A tap rather than a drag: give the shape a sensible default size.
          if (Math.hypot(l.x2 - l.x, l.y2 - l.y) < 0.02) {
            return [{ ...l, x2: clamp(l.x + 0.2), y2: clamp(l.y + (l.kind === "arrow" || l.kind === "line" ? 0 : 0.15)) }];
          }
          return [l];
        });
      }
      if (next !== d.before) {
        setHistory((items) => [...items.slice(-49), d.before]);
        setFuture([]);
        setDirty(true);
      }
      return next;
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const t = event.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
    if (mod && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
    if (!selectedLayer) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); return; }
    if (event.key === "Escape") { setSelected(null); event.stopPropagation(); event.preventDefault(); return; }
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[event.key];
    if (m) {
      event.preventDefault();
      commit(layers.map((l) => (l.id === selectedLayer.id ? moveLayer(l, m[0], m[1]) : l)));
    }
  };

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (dirty && !busy) { setConfirmClose(true); return; }
    onOpenChange(false);
  };

  const save = async () => {
    if (!photoId) return;
    setBusy(true);
    try {
      await saveEntry({ data: { reportId, photoId, description, layers } });
      toast.success(`Photograph #${sequence ?? ""} saved`);
      setDirty(false);
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The markup could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const setColourAll = (value: MarkupColour) => { setColour(value); if (selectedLayer) patchSelected({ colour: value }); };
  const setStrokeAll = (value: MarkupScale) => { setStroke(value); if (selectedLayer) patchSelected({ stroke: value }); };
  const setSizeAll = (value: MarkupScale) => { setSize(value); if (selectedLayer) patchSelected({ size: value }); };
  const hasText = selectedLayer && (selectedLayer.kind === "text" || selectedLayer.kind === "speech");
  const showStroke = tool !== "select" ? !["text", "speech", "marker"].includes(tool) : selectedLayer && !["text", "speech", "marker"].includes(selectedLayer.kind);
  const showSize = tool !== "select" ? ["text", "speech", "marker"].includes(tool) : selectedLayer && ["text", "speech", "marker"].includes(selectedLayer.kind);
  const W = 1000 * aspect;
  const selBox = selectedLayer ? hitBox(selectedLayer, aspect) : null;
  const endpoints = selectedLayer && ["arrow", "line", "rectangle", "ellipse"].includes(selectedLayer.kind);

  const pill = (active: boolean) =>
    "flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent " +
    (active ? "border-brand-accent bg-brand-accent-soft text-brand-accent-ink" : "border-border bg-background text-foreground");

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        onKeyDown={onKeyDown}
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-3 overflow-y-auto rounded-none p-3 sm:h-auto sm:max-h-[95vh] sm:max-w-5xl sm:rounded-lg sm:p-6"
      >
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>Mark up photograph #{sequence}</DialogTitle>
          <DialogDescription>Pick a tool, then draw on the photo. Drag a shape to move it; drag its round handles to resize.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div
            ref={canvasRef}
            tabIndex={0}
            role="application"
            aria-label={`Photograph ${sequence ?? ""} markup canvas. ${layers.length} callouts.`}
            onPointerDown={onCanvasDown}
            onPointerMove={onCanvasMove}
            onPointerUp={onCanvasUp}
            onPointerCancel={onCanvasUp}
            className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-surface-sunken focus-visible:outline-2 focus-visible:outline-brand-accent"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          >
            {src ? (
              <img
                src={src}
                alt={`Photograph ${sequence}`}
                draggable={false}
                onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) setAspect(i.naturalWidth / i.naturalHeight); }}
                className="pointer-events-none block h-auto w-full"
              />
            ) : (
              <div className="aspect-4/3 w-full" />
            )}
            <svg viewBox={`0 0 ${W} 1000`} preserveAspectRatio="none" className="absolute inset-0 size-full">
              <MarkupShapes layers={layers} width={W} />
              {layers.map((l) => {
                const b = hitBox(l, aspect);
                const pad = 0.015;
                return (
                  <rect
                    key={`hit-${l.id}`}
                    data-layer={l.id}
                    x={(b.x - pad) * W}
                    y={(b.y - pad) * 1000}
                    width={(b.x2 - b.x + pad * 2) * W}
                    height={(b.y2 - b.y + pad * 2) * 1000}
                    fill="transparent"
                    style={{ cursor: tool === "select" || l.id === selected ? "move" : "crosshair" }}
                  />
                );
              })}
              {selBox ? (
                <rect x={(selBox.x - 0.015) * W} y={(selBox.y - 0.015) * 1000} width={(selBox.x2 - selBox.x + 0.03) * W} height={(selBox.y2 - selBox.y + 0.03) * 1000} fill="none" stroke="var(--brand-accent)" strokeWidth="3" strokeDasharray="12 8" pointerEvents="none" />
              ) : null}
              {selectedLayer && endpoints
                ? (["a", "b"] as const).map((h) => (
                    <circle
                      key={h}
                      data-handle={h}
                      cx={(h === "a" ? selectedLayer.x : selectedLayer.x2) * W}
                      cy={(h === "a" ? selectedLayer.y : selectedLayer.y2) * 1000}
                      r="28"
                      fill="var(--background)"
                      stroke="var(--brand-accent)"
                      strokeWidth="6"
                      style={{ cursor: "grab" }}
                    />
                  ))
                : null}
            </svg>
            {busy && !src ? <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Opening photograph…</p> : null}
          </div>

          <div className="space-y-3">
            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tool</legend>
              <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-3">
                {TOOLS.map(({ id, label, Icon }) => (
                  <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={pill(tool === id)}>
                    <Icon aria-hidden="true" className="size-5" />
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colour</legend>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(COLOUR_LABELS) as MarkupColour[]).map((c) => {
                  const active = (selectedLayer?.colour ?? colour) === c;
                  return (
                    <button key={c} type="button" aria-label={COLOUR_LABELS[c]} aria-pressed={active} title={COLOUR_LABELS[c]} onClick={() => setColourAll(c)}
                      className={"flex size-11 items-center justify-center rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent " + (active ? "border-foreground" : "border-border")}>
                      <span className="size-7 rounded-full border border-border" style={{ background: MARKUP_COLOUR_VARS[c] }} />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {showStroke ? (
              <fieldset>
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Line thickness</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["s", "m", "l"] as MarkupScale[]).map((s) => (
                    <button key={s} type="button" aria-pressed={(selectedLayer?.stroke ?? stroke) === s} onClick={() => setStrokeAll(s)} className={pill((selectedLayer?.stroke ?? stroke) === s)}>{SCALE_LABELS[s]}</button>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {showSize ? (
              <fieldset>
                <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["s", "m", "l"] as MarkupScale[]).map((s) => (
                    <button key={s} type="button" aria-pressed={(selectedLayer?.size ?? size) === s} onClick={() => setSizeAll(s)} className={pill((selectedLayer?.size ?? size) === s)}>{SCALE_LABELS[s]}</button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {hasText ? (
              <label className="block text-sm font-semibold">
                Callout text
                <input ref={textInputRef} value={selectedLayer.text ?? ""} onChange={(e) => patchSelected({ text: e.target.value })} maxLength={160} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal" />
              </label>
            ) : null}
            {selectedLayer?.kind === "marker" ? (
              <label className="block text-sm font-semibold">
                Marker number
                <input type="number" min={1} max={999} value={selectedLayer.number ?? 1} onChange={(e) => patchSelected({ number: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal" />
              </label>
            ) : null}
          </div>
        </div>

        <label className="block text-sm font-semibold">
          Photograph description
          <textarea value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} rows={3} maxLength={4000} className="mt-2 w-full rounded-lg border border-border bg-background p-3 font-normal" placeholder="Optional — a note to go with this photograph." />
        </label>

        {confirmClose ? (
          <div role="alertdialog" aria-label="Discard changes" className="rounded-lg border border-warn bg-surface-raised p-3 text-sm">
            <p className="font-semibold">Discard your unsaved markup?</p>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="quiet" onClick={() => setConfirmClose(false)}>Keep editing</Button>
              <Button type="button" variant="brand" onClick={() => { setConfirmClose(false); setDirty(false); onOpenChange(false); }}>Discard</Button>
            </div>
          </div>
        ) : null}

        <div className="sticky bottom-0 -mx-3 mt-auto flex flex-wrap items-center gap-1.5 border-t border-border bg-background px-3 py-2 sm:-mx-6 sm:px-6">
          <Button type="button" variant="quiet" size="icon" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.length} onClick={undo}><Undo2 /></Button>
          <Button type="button" variant="quiet" size="icon" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!future.length} onClick={redo}><Redo2 /></Button>
          <Button type="button" variant="quiet" size="icon" aria-label="Duplicate selected" title="Duplicate" disabled={!selected} onClick={duplicateSelected}><Copy /></Button>
          <Button type="button" variant="quiet" size="icon" aria-label="Delete selected" title="Delete" disabled={!selected} onClick={removeSelected}><Trash2 /></Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="quiet" onClick={() => requestClose(false)}>Cancel</Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
