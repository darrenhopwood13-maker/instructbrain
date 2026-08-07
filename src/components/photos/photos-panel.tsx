import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Info, Loader2, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { organisationPlanQuery } from "@/lib/plans";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { CaptureFieldsForm } from "@/components/photos/capture-fields-form";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { UploadTray, type UploadItem } from "@/components/photos/upload-tray";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import {
  deletePhotos,
  listPhotos,
  nextSequence,
  updateCaptureFields,
  uploadPhoto,
  signedThumbnailUrls,
  type PhotoRow,
} from "@/lib/photos/photo-service";
import { overallProgress, runUploadQueue, type TaskProgress } from "@/lib/photos/upload-queue";
import {
  allowsMultipleFindingsPerPhoto,
  captureFieldsOf,
  definitionLabel,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

const CONCURRENCY = 5;

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Pending = { id: string; file: File; captureFields: Record<string, string> };

export function PhotosPanel({
  reportId,
  snapshot,
}: {
  reportId: string;
  snapshot: SurveyTypeSnapshot;
}) {
  const { session, loading: sessionLoading } = useSession();
  const fields = useMemo(() => captureFieldsOf(snapshot), [snapshot]);
  const keepWalking = allowsMultipleFindingsPerPhoto(snapshot);

  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [ready, setReady] = useState<"checking" | "ready" | "unavailable">("checking");
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  /** Files stay addressable so a failed item can be retried, not re-picked. */
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const [busy, setBusy] = useState(false);
  const [zoneValues, setZoneValues] = useState<Record<string, string>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<PhotoRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastToggledRef = useRef<string | null>(null);

  const planQuery = useQuery(organisationPlanQuery(organisationId));
  const photoCap = planQuery.data?.photo_cap_per_report ?? null;
  const remainingPhotos = photoCap === null ? null : Math.max(0, photoCap - photos.length);
  const atPhotoCap = remainingPhotos !== null && remainingPhotos === 0;

  const filePickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);


  const refresh = useCallback(async () => {
    const rows = await listPhotos(reportId);
    setPhotos(rows);
    setUrls(await signedThumbnailUrls(rows));
  }, [reportId]);

  useEffect(() => {
    let active = true;
    if (sessionLoading) return;
    if (!session) {
      setReady("unavailable");
      return;
    }
    void (async () => {
      const { data: report } = await supabase
        .from("reports")
        .select("id, organisation_id")
        .eq("id", reportId)
        .maybeSingle();
      if (!active) return;
      if (!report) {
        setReady("unavailable");
        return;
      }
      setOrganisationId(report.organisation_id);
      try {
        await refresh();
        if (active) setReady("ready");
      } catch {
        if (active) setReady("unavailable");
      }
    })();
    return () => {
      active = false;
    };
  }, [session, sessionLoading, reportId, refresh]);

  const applyProgress = useCallback((snapshotProgress: TaskProgress[]) => {
    setUploads((current) =>
      current.map((item) => {
        const match = snapshotProgress.find((entry) => entry.id === item.id);
        if (!match) return item;
        const next: UploadItem = {
          ...item,
          state: match.state,
          progress: match.progress,
        };
        if (match.error) next.error = match.error;
        else delete next.error;
        return next;
      }),
    );
  }, []);

  const runQueue = useCallback(
    async (items: Pending[]) => {
      if (!organisationId || items.length === 0) return;
      setBusy(true);
      let sequence = await nextSequence(reportId);
      try {
        await runUploadQueue(
          items.map((item) => ({
            id: item.id,
            run: async (report) => {
              const assigned = sequence;
              sequence += 1;
              // Photographs reach storage on selection — never held in memory only.
              return uploadPhoto(
                item.file,
                { organisationId, reportId, captureFields: item.captureFields },
                assigned,
                report,
              );
            },
          })),
          { concurrency: CONCURRENCY, maxAttempts: 3, onProgress: applyProgress },
        );
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [organisationId, reportId, applyProgress, refresh],
  );

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      let selected = Array.from(fileList);
      // The database enforces the cap too; this only avoids doomed uploads.
      if (remainingPhotos !== null && selected.length > remainingPhotos) {
        toast.error("Photograph limit reached", {
          description:
            remainingPhotos === 0
              ? `This report already holds the ${photoCap} photographs included in your plan.`
              : `Only ${remainingPhotos} more photograph${remainingPhotos === 1 ? "" : "s"} can be added to this report on your plan.`,
        });
        selected = selected.slice(0, remainingPhotos);
        if (selected.length === 0) return;
      }
      const items: Pending[] = selected.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        captureFields: { ...zoneValues },
      }));

      for (const item of items) pendingRef.current.set(item.id, item);
      setUploads((current) => [
        ...current,
        ...items.map<UploadItem>((item) => ({
          id: item.id,
          name: item.file.name,
          sizeLabel: sizeLabel(item.file.size),
          state: "queued",
          progress: 0,
        })),
      ]);
      void runQueue(items);
    },
    [runQueue, zoneValues, remainingPhotos, photoCap],
  );

  const retry = useCallback(
    (ids: string[]) => {
      const items = ids
        .map((id) => pendingRef.current.get(id))
        .filter((item): item is Pending => !!item);
      setUploads((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, state: "queued", progress: 0 } : item,
        ),
      );
      void runQueue(items);
    },
    [runQueue],
  );

  const toggle = (id: string, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const anchor = lastToggledRef.current;
      if (shiftKey && anchor) {
        const from = photos.findIndex((photo) => photo.id === anchor);
        const to = photos.findIndex((photo) => photo.id === id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from < to ? [from, to] : [to, from];
          for (let index = start; index <= end; index += 1) {
            const photo = photos[index];
            if (photo) next.add(photo.id);
          }
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastToggledRef.current = id;
      return next;
    });
  };

  const selectedPhotos = photos.filter((photo) => selected.has(photo.id));

  const doDelete = async () => {
    setConfirmDelete(false);
    try {
      await deletePhotos(selectedPhotos);
      setSelected(new Set());
      await refresh();
      toast.success(
        `${selectedPhotos.length} photograph${selectedPhotos.length === 1 ? "" : "s"} deleted`,
        { description: "Findings keep their references — nothing was renumbered." },
      );
    } catch (error) {
      toast.error("Could not delete", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const applyBulk = async () => {
    const values = Object.fromEntries(
      Object.entries(bulkValues).filter(([, value]) => value.trim() !== ""),
    );
    setBulkOpen(false);
    try {
      await updateCaptureFields(
        selectedPhotos.map((photo) => photo.id),
        values,
      );
      await refresh();
      toast.success(`Applied to ${selectedPhotos.length} photographs`);
    } catch (error) {
      toast.error("Could not apply", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const photo = editing;
    setEditing(null);
    try {
      await updateCaptureFields([photo.id], editValues);
      await refresh();
      toast.success(`Photograph #${photo.sequence} updated`);
    } catch (error) {
      toast.error("Could not save", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const overall = overallProgress(
    uploads.map((item) => ({
      id: item.id,
      state: "queued",
      progress: item.progress,
      attempts: 0,
    })),
  );

  if (ready === "checking" && !sessionLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Loading photographs…
      </p>
    );
  }

  if (ready === "unavailable") {
    return (
      <EmptyState
        icon={Camera}
        eyebrow="Step one"
        title="Sign in to upload photographs"
        description={`Photographs are stored against the saved ${definitionLabel(snapshot)} report from the moment they are selected, never held in the browser. Sign in to a report in your organisation to start uploading.`}
      />
    );
  }

  return (
    <div className="space-y-5 pb-28 sm:pb-0">
      <section className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised sm:p-5">
        <p className="eyebrow">Step one</p>
        <h2 className="editorial-title mt-1 text-lg font-semibold">Photographs</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Each photograph is uploaded at full resolution and untouched — that original is what the
          analysis reads. A small preview is generated separately for this grid only.
        </p>

        {fields.length > 0 ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  {keepWalking ? "Current zone" : "Applied to new photographs"}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {keepWalking
                    ? "Set once, then keep shooting. Every photograph takes these values until you change them."
                    : "These values are recorded against each photograph as it uploads."}
                </p>
              </div>
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3">
              <CaptureFieldsForm
                fields={fields}
                values={zoneValues}
                onChange={(fieldId, value) =>
                  setZoneValues((current) => ({ ...current, [fieldId]: value }))
                }
                idPrefix="zone"
                compact
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Required fields are flagged but never block an upload. Complete them later, off site.
            </p>
          </div>
        ) : null}

        <input
          ref={filePickerRef}
          type="file"
          accept="image/*,.heic,.heif,.HEIC,.HEIF,image/heic,image/heif"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,.heic,.heif,.HEIC,.HEIF,image/heic,image/heif"
          capture="environment"
          multiple
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <p className="mt-3 text-xs text-muted-foreground">
          iPhone HEIC photographs are supported. Whatever your phone hands over — HEIC or JPEG —
          is stored as the original, and a full-resolution copy is made for analysis when needed.
        </p>

        <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
          <Button
            variant="brand"
            onClick={() => filePickerRef.current?.click()}
            disabled={busy || atPhotoCap}
          >
            <ImagePlus aria-hidden="true" />
            Add photographs
          </Button>
          <Button
            variant="quiet"
            onClick={() => cameraRef.current?.click()}
            disabled={busy || atPhotoCap}
          >
            <Camera aria-hidden="true" />
            Take a photograph
          </Button>
        </div>
        {atPhotoCap ? (
          <p className="mt-3 text-sm text-fail-soft">
            This report holds the {photoCap} photographs included in your plan. Remove one, or move
            the rest into a second report.
          </p>
        ) : remainingPhotos !== null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {remainingPhotos} of {photoCap} photographs remaining on this report.
          </p>
        ) : null}


      </section>

      <UploadTray
        items={uploads}
        overall={overall}
        onRetry={(id) => retry([id])}
        onRetryAll={() =>
          retry(uploads.filter((item) => item.state === "error").map((item) => item.id))
        }
        onDismiss={() => setUploads([])}
      />

      {photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No photographs yet"
          description="Upload the photographs captured on site, or shoot straight from the phone. They are stored the moment they are selected."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 sm:justify-between">
            <div className="min-w-0 flex-1 basis-full sm:basis-auto">
              <h3 className="editorial-title truncate text-base font-semibold">
                {photos.length} photograph{photos.length === 1 ? "" : "s"}
              </h3>
              <p className="text-sm text-muted-foreground">{selected.size} selected</p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">

              <Button
                variant="quiet"
                size="sm"
                onClick={() =>
                  setSelected((current) =>
                    current.size === photos.length
                      ? new Set()
                      : new Set(photos.map((photo) => photo.id)),
                  )
                }
              >
                {selected.size === photos.length ? "Clear selection" : "Select all"}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                disabled={selected.size === 0 || fields.length === 0}
                onClick={() => {
                  setBulkValues({});
                  setBulkOpen(true);
                }}
              >
                Set details for {selected.size || "…"}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>

          <PhotoGrid
            photos={photos}
            urls={urls}
            selected={selected}
            onToggle={toggle}
            onOpen={(photo) => {
              setEditing(photo);
              setEditValues({ ...(photo.capture_fields ?? {}) });
            }}
          />
        </>
      )}

      {/* One-handed controls: primary actions in the lower third on a phone. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="flex gap-2">
          <Button
            variant="brand"
            className="h-14 flex-1 text-base"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera aria-hidden="true" className="size-5" />
            Take photo
          </Button>
          <Button
            variant="quiet"
            className="h-14 flex-1 text-base"
            onClick={() => filePickerRef.current?.click()}
          >
            <ImagePlus aria-hidden="true" className="size-5" />
            Add photos
          </Button>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set details for {selected.size} photographs</DialogTitle>
            <DialogDescription>
              Fields left blank are unchanged. Use this to apply a location to a whole run of
              photographs at once.
            </DialogDescription>
          </DialogHeader>
          <CaptureFieldsForm
            fields={fields}
            values={bulkValues}
            onChange={(fieldId, value) =>
              setBulkValues((current) => ({ ...current, [fieldId]: value }))
            }
            idPrefix="bulk"
          />
          <DialogFooter>
            <Button variant="quiet" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void applyBulk()}>
              Apply to {selected.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Photograph #{editing?.sequence}</DialogTitle>
            <DialogDescription>
              {editing?.captured_at
                ? `Captured ${new Date(editing.captured_at).toLocaleString("en-GB")} — read from the file's own metadata.`
                : "No capture time was present in the file. Nothing has been assumed."}
            </DialogDescription>
          </DialogHeader>
          <CaptureFieldsForm
            fields={fields}
            values={editValues}
            onChange={(fieldId, value) =>
              setEditValues((current) => ({ ...current, [fieldId]: value }))
            }
            idPrefix="edit"
          />
          <DialogFooter>
            <Button variant="quiet" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void saveEdit()}>
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} photograph{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The stored originals and previews are removed. Any finding that used them keeps its
              reference — nothing is renumbered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
