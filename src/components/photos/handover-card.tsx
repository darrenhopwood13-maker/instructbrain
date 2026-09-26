import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, Plus, ScanLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useSinglePhotoCapture } from "@/components/photos/single-photo-capture";
import {
  coerceHandover,
  handoverMissing,
  keyPhotos,
  meterPhotoFor,
  meterSlots,
  type HandoverLayout,
  type HandoverRecord,
  type MeterEntry,
} from "@/lib/report/handover";
import { readMeterPhoto } from "@/lib/report/meter-read.functions";
import type { PhotoWorkflow } from "@/lib/survey-types";

type CardPhoto = { id: string; sequence: number; capture_fields: Record<string, string> };

type Target = { kind: "meter"; slotId: string } | { kind: "keys" };

/**
 * Meters and keys: the handover evidence of a room-schedule report. Every label
 * comes from the template. Nothing here blocks analysis or issue.
 */
export function HandoverCard({
  reportId,
  layout,
  workflow,
  photos,
  urls,
  selectedIds,
  onUpload,
  onApply,
  onClearSelection,
}: {
  reportId: string;
  layout: HandoverLayout;
  workflow: PhotoWorkflow;
  photos: CardPhoto[];
  urls: Record<string, string>;
  selectedIds: string[];
  onUpload: (file: File, captureFields: Record<string, string>) => void;
  onApply: (ids: string[], patch: Record<string, string>) => Promise<void>;
  onClearSelection: () => void;
}) {
  const [record, setRecord] = useState<HandoverRecord | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string | null | "loading">>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readMeter = useServerFn(readMeterPhoto);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await (supabase.from("reports") as any)
        .select("handover")
        .eq("id", reportId)
        .maybeSingle();
      if (active) setRecord(coerceHandover(data?.handover));
    })();
    return () => {
      active = false;
    };
  }, [reportId]);

  const persist = useCallback(
    (next: HandoverRecord) => {
      setRecord(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void (async () => {
          const { error } = await (supabase.from("reports") as any).update({ handover: next }).eq("id", reportId);
          if (error) toast.error("Meters and keys could not be saved", { description: "Check your connection and try again." });
        })();
      }, 600);
    },
    [reportId],
  );

  const targetRef = useRef<Target | null>(null);
  const capture = useSinglePhotoCapture(
    useCallback(
      (file: File) => {
        const target = targetRef.current;
        if (!target) return;
        onUpload(
          file,
          target.kind === "meter"
            ? { [workflow.roleField]: layout.meterRoleId, [layout.slotField]: target.slotId }
            : { [workflow.roleField]: layout.keysRoleId },
        );
      },
      [onUpload, workflow.roleField, layout],
    ),
  );

  const assignSelected = async (target: Target) => {
    const ids = target.kind === "meter" ? selectedIds.slice(0, 1) : selectedIds;
    if (ids.length === 0) return;
    const patch =
      target.kind === "meter"
        ? {
            [workflow.roleField]: layout.meterRoleId,
            [layout.slotField]: target.slotId,
            ...(workflow.sectionField ? { [workflow.sectionField]: "" } : {}),
          }
        : {
            [workflow.roleField]: layout.keysRoleId,
            [layout.slotField]: "",
            ...(workflow.sectionField ? { [workflow.sectionField]: "" } : {}),
          };
    await onApply(ids, patch);
    onClearSelection();
  };

  const release = async (photoId: string) => {
    await onApply([photoId], {
      [workflow.roleField]: workflow.detailRoleId ?? "",
      [layout.slotField]: "",
    });
  };

  const slots = useMemo(() => (record ? meterSlots(layout, record) : []), [layout, record]);
  const keys = useMemo(() => keyPhotos(layout, workflow.roleField, photos), [layout, workflow.roleField, photos]);
  const missing = useMemo(
    () => (record ? handoverMissing(layout, workflow.roleField, record, photos) : []),
    [layout, workflow.roleField, record, photos],
  );

  if (!record) return null;

  const setMeter = (slotId: string, patch: Partial<MeterEntry>) =>
    persist({ ...record, meters: { ...record.meters, [slotId]: { ...record.meters[slotId], ...patch } } });

  const suggest = async (slotId: string, label: string, photoId: string) => {
    setSuggestions((current) => ({ ...current, [slotId]: "loading" }));
    try {
      const result = await readMeter({ data: { reportId, photoId, meterLabel: label } });
      setSuggestions((current) => ({ ...current, [slotId]: result.reading }));
    } catch (error) {
      setSuggestions((current) => {
        const next = { ...current };
        delete next[slotId];
        return next;
      });
      toast.error("The reading could not be checked", {
        description: error instanceof Error ? error.message : "Please enter it yourself.",
      });
    }
  };

  const selectionHint =
    selectedIds.length > 0 ? `Use selected (${selectedIds.length})` : null;

  return (
    <section aria-labelledby="handover-heading" className="mt-6 space-y-5 rounded-xl border border-border bg-surface-raised p-4">
      {capture.element}
      <div>
        <h3 id="handover-heading" className="text-base font-semibold">
          {layout.meterTitle} and {layout.keysTitle.toLowerCase()}
        </h3>
        <p className="text-sm text-muted-foreground">
          Optional. Printed on their own pages at the end of the report; never analysed into a room.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {slots.map((slot) => {
          const photo = meterPhotoFor(layout, workflow.roleField, photos, slot.id);
          const entry = record.meters[slot.id] ?? {};
          const suggestion = suggestions[slot.id];
          return (
            <li key={slot.id} className="space-y-2 rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-semibold">{slot.label}</p>
              {photo ? (
                <div className="relative">
                  <img
                    src={urls[photo.id]}
                    alt={`${slot.label}, photo ${photo.sequence}`}
                    className="aspect-[4/3] w-full rounded-md object-cover"
                  />
                  <Button
                    variant="quiet"
                    size="sm"
                    className="mt-1"
                    onClick={() => void release(photo.id)}
                  >
                    <Trash2 aria-hidden="true" />
                    Remove photo
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="min-h-11 w-full whitespace-normal"
                    onClick={() => {
                      targetRef.current = { kind: "meter", slotId: slot.id };
                      capture.takePhoto();
                    }}
                  >
                    <Camera aria-hidden="true" />
                    Take photo
                  </Button>
                  <Button
                    variant="quiet"
                    className="min-h-11 w-full whitespace-normal"
                    onClick={() => {
                      targetRef.current = { kind: "meter", slotId: slot.id };
                      capture.choosePhoto();
                    }}
                  >
                    <ImagePlus aria-hidden="true" />
                    Choose photo
                  </Button>
                  {selectionHint ? (
                    <Button variant="quiet" className="min-h-11 w-full" onClick={() => void assignSelected({ kind: "meter", slotId: slot.id })}>
                      Use selected photo
                    </Button>
                  ) : null}
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor={`reading-${slot.id}`}>{layout.readingLabel}</Label>
                <Input
                  id={`reading-${slot.id}`}
                  inputMode="decimal"
                  value={entry.reading ?? ""}
                  disabled={entry.notAccessible === true}
                  onChange={(event) => setMeter(slot.id, { reading: event.target.value })}
                  className="min-h-11"
                />
                {photo && !entry.notAccessible ? (
                  suggestion === "loading" ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                      <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Reading the photo…
                    </p>
                  ) : suggestion === null ? (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      Couldn't read — enter it yourself.
                    </p>
                  ) : typeof suggestion === "string" ? (
                    <div className="rounded-md border border-border p-2 text-xs" aria-live="polite">
                      <p>
                        Suggested — check against the photo: <span className="font-semibold">{suggestion}</span>
                      </p>
                      <div className="mt-1 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMeter(slot.id, { reading: suggestion });
                            setSuggestions((current) => {
                              const next = { ...current };
                              delete next[slot.id];
                              return next;
                            });
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() =>
                            setSuggestions((current) => {
                              const next = { ...current };
                              delete next[slot.id];
                              return next;
                            })
                          }
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="quiet" size="sm" onClick={() => void suggest(slot.id, slot.label, photo.id)}>
                      <ScanLine aria-hidden="true" />
                      Read from photo
                    </Button>
                  )
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`serial-${slot.id}`}>{layout.serialLabel} (optional)</Label>
                <Input
                  id={`serial-${slot.id}`}
                  value={entry.serial ?? ""}
                  onChange={(event) => setMeter(slot.id, { serial: event.target.value })}
                  className="min-h-11"
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={entry.notAccessible === true}
                  onCheckedChange={(checked) => setMeter(slot.id, { notAccessible: checked === true })}
                />
                {layout.notAccessibleLabel}
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        variant="quiet"
        onClick={() => {
          const id = `extra_${Date.now()}`;
          const label = `Meter ${slots.length + 1}`;
          persist({ ...record, extraMeters: [...record.extraMeters, { id, label }] });
        }}
      >
        <Plus aria-hidden="true" />
        {layout.addMeterLabel}
      </Button>
      {record.extraMeters.length > 0 ? (
        <div className="space-y-2">
          {record.extraMeters.map((meter, index) => (
            <div key={meter.id} className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor={`meter-name-${meter.id}`}>Name of added meter</Label>
                <Input
                  id={`meter-name-${meter.id}`}
                  value={meter.label}
                  className="min-h-11"
                  onChange={(event) => {
                    const extraMeters = [...record.extraMeters];
                    extraMeters[index] = { ...meter, label: event.target.value || meter.label };
                    persist({ ...record, extraMeters });
                  }}
                />
              </div>
              <Button
                variant="quiet"
                aria-label={`Remove ${meter.label}`}
                className="min-h-11"
                onClick={() => {
                  const meters = { ...record.meters };
                  delete meters[meter.id];
                  persist({ ...record, meters, extraMeters: record.extraMeters.filter((item) => item.id !== meter.id) });
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-semibold">{layout.keysTitle}</p>
        {keys.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {keys.map((photo) => (
              <li key={photo.id} className="space-y-1">
                <img
                  src={urls[photo.id]}
                  alt={`${layout.keysTitle}, photo ${photo.sequence}`}
                  className="aspect-square w-full rounded-md object-cover"
                />
                <Button variant="quiet" size="sm" onClick={() => void release(photo.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="min-h-11 whitespace-normal"
            onClick={() => {
              targetRef.current = { kind: "keys" };
              capture.takePhoto();
            }}
          >
            <Camera aria-hidden="true" />
            Take photo
          </Button>
          <Button
            variant="quiet"
            className="min-h-11 whitespace-normal"
            onClick={() => {
              targetRef.current = { kind: "keys" };
              capture.choosePhoto();
            }}
          >
            <ImagePlus aria-hidden="true" />
            Choose photo
          </Button>
        </div>
        {selectionHint ? (
          <Button variant="quiet" className="min-h-11" onClick={() => void assignSelected({ kind: "keys" })}>
            {selectionHint} as {layout.keysTitle.toLowerCase()}
          </Button>
        ) : null}

        {record.keys.map((key, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`key-${index}`}>{layout.keyItemLabel}</Label>
              <Input
                id={`key-${index}`}
                value={key.label}
                className="min-h-11"
                onChange={(event) => {
                  const next = [...record.keys];
                  next[index] = { ...key, label: event.target.value };
                  persist({ ...record, keys: next });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`key-qty-${index}`}>{layout.keyQuantityLabel}</Label>
              <Input
                id={`key-qty-${index}`}
                inputMode="numeric"
                value={key.quantity}
                className="min-h-11"
                onChange={(event) => {
                  const next = [...record.keys];
                  next[index] = { ...key, quantity: event.target.value };
                  persist({ ...record, keys: next });
                }}
              />
            </div>
            <Button
              variant="quiet"
              className="min-h-11"
              aria-label={`Remove ${key.label || "key"}`}
              onClick={() => persist({ ...record, keys: record.keys.filter((_, i) => i !== index) })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          variant="quiet"
          onClick={() => persist({ ...record, keys: [...record.keys, { label: "", quantity: "1" }] })}
        >
          <Plus aria-hidden="true" />
          Add key
        </Button>

        {layout.questions.map((question) => (
          <fieldset key={question.id} className="space-y-1">
            <legend className="text-sm font-medium">{question.label}</legend>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((value) => (
                <Button
                  key={value}
                  variant={record.answers[question.id] === value ? "outline" : "quiet"}
                  aria-pressed={record.answers[question.id] === value}
                  className="min-h-11 min-w-16"
                  onClick={() => persist({ ...record, answers: { ...record.answers, [question.id]: value } })}
                >
                  {value === "yes" ? "Yes" : "No"}
                </Button>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="border-t border-border pt-3 text-sm" aria-live="polite">
        {missing.length === 0 ? (
          <p className="font-medium">Meters and keys — complete.</p>
        ) : (
          <>
            <p className="font-medium">Meters and keys (optional) — still to add:</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {missing.slice(0, 6).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
