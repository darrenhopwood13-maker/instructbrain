import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Circle, MessageSquare, Redo2, Square, Trash2, Type, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getManualPhotoEntry, saveManualPhotoEntry } from "@/lib/photos/manual-report.functions";
import { newMarkupLayer, type MarkupColour, type MarkupKind, type MarkupLayer } from "@/lib/photos/markup";
import { PhotoMarkupOverlay } from "@/components/photos/photo-markup-overlay";

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
  const [colour, setColour] = useState<MarkupColour>("accent");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !photoId) return;
    setBusy(true);
    void loadEntry({ data: { reportId, photoId } }).then((entry) => {
      setDescription(entry.description);
      setLayers(entry.layers);
      setHistory([]);
      setFuture([]);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "The photograph could not be opened.")).finally(() => setBusy(false));
  }, [open, photoId, reportId, loadEntry]);

  const selectedLayer = useMemo(() => layers.find((layer) => layer.id === selected) ?? null, [layers, selected]);
  const commit = (next: MarkupLayer[]) => { setHistory((items) => [...items, layers]); setFuture([]); setLayers(next); };
  const add = (kind: MarkupKind) => { const layer = newMarkupLayer(kind, colour); commit([...layers, layer]); setSelected(layer.id); };
  const updateSelected = (patch: Partial<MarkupLayer>) => selected && commit(layers.map((layer) => layer.id === selected ? { ...layer, ...patch } : layer));
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [layers, ...items]); setLayers(previous); setHistory((items) => items.slice(0, -1)); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((items) => [...items, layers]); setLayers(next); setFuture((items) => items.slice(1)); };

  const save = async () => {
    if (!photoId) return;
    setBusy(true);
    try {
      await saveEntry({ data: { reportId, photoId, description, layers } });
      toast.success(`Photograph #${sequence ?? ""} saved`);
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The markup could not be saved.");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Mark up photograph #{sequence}</DialogTitle><DialogDescription>Add the description and visual callouts that will appear in the report.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-sunken">
            {photoUrl ? <img src={photoUrl} alt={`Photograph ${sequence}`} className="block h-auto w-full" /> : null}
            <PhotoMarkupOverlay layers={layers} />
            {layers.map((layer) => <button key={layer.id} type="button" aria-label={`Select ${layer.kind}`} onClick={() => setSelected(layer.id)} className="absolute min-h-11 min-w-11 rounded-md border-2 border-transparent focus-visible:border-brand-accent" style={{ left: `${Math.min(layer.x, layer.x2)*100}%`, top: `${Math.min(layer.y, layer.y2)*100}%`, width: `${Math.max(.08, Math.abs(layer.x2-layer.x))*100}%`, height: `${Math.max(.08, Math.abs(layer.y2-layer.y))*100}%` }} />)}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ k:"text", I:Type },{ k:"arrow", I:ArrowUpRight },{ k:"rectangle", I:Square },{ k:"ellipse", I:Circle },{ k:"speech", I:MessageSquare }].map(({k,I}) => <Button key={k} type="button" variant="quiet" size="icon" title={`Add ${k}`} aria-label={`Add ${k}`} onClick={() => add(k as MarkupKind)}><I /></Button>)}
              <Button type="button" variant="quiet" size="icon" aria-label="Delete selected markup" disabled={!selected} onClick={() => { commit(layers.filter((layer) => layer.id !== selected)); setSelected(null); }}><Trash2 /></Button>
              <Button type="button" variant="quiet" size="icon" aria-label="Undo" disabled={!history.length} onClick={undo}><Undo2 /></Button>
              <Button type="button" variant="quiet" size="icon" aria-label="Redo" disabled={!future.length} onClick={redo}><Redo2 /></Button>
            </div>
            <label className="block text-sm font-medium">Colour<select value={colour} onChange={(event) => { const value = event.target.value as MarkupColour; setColour(value); if (selected) updateSelected({ colour: value }); }} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3"><option value="accent">Accent</option><option value="red">Red</option><option value="yellow">Yellow</option><option value="white">White</option><option value="black">Black</option></select></label>
            {selectedLayer ? <><label className="block text-sm font-medium">Horizontal position<input type="range" min="0" max="1" step="0.01" value={selectedLayer.x} onChange={(event) => updateSelected({ x: Number(event.target.value) })} className="mt-1 w-full" /></label><label className="block text-sm font-medium">Vertical position<input type="range" min="0" max="1" step="0.01" value={selectedLayer.y} onChange={(event) => updateSelected({ y: Number(event.target.value) })} className="mt-1 w-full" /></label>{selectedLayer.kind === "text" || selectedLayer.kind === "speech" ? <label className="block text-sm font-medium">Callout text<input value={selectedLayer.text ?? ""} onChange={(event) => updateSelected({ text: event.target.value })} maxLength={160} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3" /></label> : null}</> : <p className="text-sm text-muted-foreground">Choose a tool, then select its callout to position or edit it.</p>}
          </div>
        </div>
        <label className="block text-sm font-semibold">Photograph description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={4000} className="mt-2 w-full rounded-lg border border-border bg-background p-3" placeholder="Enter the observation to appear beneath this photograph." /></label>
        <DialogFooter><Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save photograph"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}