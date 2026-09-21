import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Info, Loader2, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { organisationPlanQuery } from "@/lib/plans";
import { toast } from "sonner";
import { setCoverPhoto } from "@/lib/report/branding";
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
import {
  assignUploadSequences,
  overallProgress,
  runUploadQueue,
  type TaskProgress,
} from "@/lib/photos/upload-queue";
import {
  allowsMultipleFindingsPerPhoto,
  captureFieldsOf,
  definitionLabel,
  photoRoleOf,
  photoWorkflowOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

const CONCURRENCY = 12;

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Pending = {
  id: string;
  file: File;
  captureFields: Record<string, string>;
  /** Reserved once from selection order and retained when this item is retried. */
  sequence: number | null;
};

export function PhotosPanel({
  reportId,
  snapshot,
  initialFiles,
  pinnedFields,
}: {
  reportId: string;
  snapshot: SurveyTypeSnapshot;
  /** Files already chosen before the report existed (quick capture). */
  initialFiles?: File[];
  /** Capture values stamped on every new photograph (e.g. its survey type). */
  pinnedFields?: Record<string, string>;
}) {

  const { session, loading: sessionLoading } = useSession();
  const fields = useMemo(() => captureFieldsOf(snapshot), [snapshot]);
  const workflow = useMemo(() => photoWorkflowOf(snapshot), [snapshot]);
  const inventoryWorkflow = workflow?.kind === "inventory_room_schedule" ? workflow : null;
  const zoneFields = useMemo(
    () =>
      inventoryWorkflow?.sectionField
        ? fields.filter((field) => field.id === inventoryWorkflow.sectionField)
        : fields,
    [fields, inventoryWorkflow],
  );
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
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [inventoryUploadMode, setInventoryUploadMode] = useState<"auto" | "overview" | "detail">("auto");
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
        .select("id, organisation_id, cover_photo_id")
        .eq("id", reportId)
        .maybeSingle();
      if (!active) return;
      if (!report) {
        setReady("unavailable");
        return;
      }
      setOrganisationId(report.organisation_id);
      setCoverPhotoId(report.cover_photo_id ?? null);
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
      const unnumbered = items.some((item) => item.sequence === null);
      if (unnumbered) {
        const databaseNext = await nextSequence(reportId);
        const pendingNext =
          Math.max(
            0,
            ...[...pendingRef.current.values()].map((item) => item.sequence ?? 0),
          ) + 1;
        assignUploadSequences(items, Math.max(databaseNext, pendingNext));
      }
      const overviewCounts = new Map<string, number>();
      if (inventoryWorkflow?.sectionField && inventoryWorkflow.overviewRoleId) {
        for (const photo of photos) {
          if (photo.capture_fields?.[inventoryWorkflow.roleField] !== inventoryWorkflow.overviewRoleId) {
            continue;
          }
          const roomKey = (photo.capture_fields?.[inventoryWorkflow.sectionField] ?? "")
            .trim()
            .toLowerCase();
          overviewCounts.set(roomKey, (overviewCounts.get(roomKey) ?? 0) + 1);
        }
      }
      try {
        const results = await runUploadQueue(
          // The number was reserved above, in selection order — never inside
          // the task, where a slow or retried upload could take a later number.
          items.map((item) => ({
            id: item.id,
            run: async (report) => {
              const sequence = item.sequence;
              if (sequence === null) throw new Error("Photograph number was not reserved.");
              const captureFields = { ...item.captureFields };
              if (
                workflow?.firstPhotoRoleId &&
                sequence === 1 &&
                !captureFields[workflow.roleField]
              ) {
                captureFields[workflow.roleField] = workflow.firstPhotoRoleId;
              }
              if (
                inventoryWorkflow?.sectionField &&
                inventoryWorkflow.detailRoleId &&
                inventoryWorkflow.overviewRoleId &&
                sequence !== 1 &&
                !captureFields[inventoryWorkflow.roleField]
              ) {
                const roomKey = (captureFields[inventoryWorkflow.sectionField] ?? "").trim().toLowerCase();
                const usedOverviews = overviewCounts.get(roomKey) ?? 0;
                const maxOverviews = inventoryWorkflow.maxOverviewPhotos ?? 3;
                const shouldBeOverview =
                  inventoryUploadMode === "overview" ||
                  (inventoryUploadMode === "auto" && usedOverviews < maxOverviews);
                if (shouldBeOverview && usedOverviews < maxOverviews) {
                  captureFields[inventoryWorkflow.roleField] = inventoryWorkflow.overviewRoleId;
                  overviewCounts.set(roomKey, usedOverviews + 1);
                } else {
                  captureFields[inventoryWorkflow.roleField] = inventoryWorkflow.detailRoleId;
                }
              }
              // Photographs reach storage on selection — never held in memory only.
              return uploadPhoto(
                item.file,
                { organisationId, reportId, captureFields },
                sequence,
                report,
              );
            },
          })),
          { concurrency: CONCURRENCY, maxAttempts: 3, onProgress: applyProgress },
        );
        const firstCover = results
          .map((result) => result.value?.photo ?? null)
          .find((photo) => {
            if (!photo) return false;
            return (
              photoRoleOf(snapshot, photo.capture_fields, { isFirstPhoto: photo.sequence === 1 })
                ?.countsAsCover === true
            );
          });
        if (!coverPhotoId && firstCover) {
          await setCoverPhoto(reportId, firstCover.id);
          setCoverPhotoId(firstCover.id);
        }
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [organisationId, reportId, workflow, inventoryWorkflow, inventoryUploadMode, photos, snapshot, coverPhotoId, applyProgress, refresh],
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
        captureFields: { ...zoneValues, ...(pinnedFields ?? {}) },
        sequence: null,
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
    [runQueue, zoneValues, pinnedFields, remainingPhotos, photoCap],
  );

  // Quick capture picks the photographs before the report exists; they are
  // enqueued once, as soon as this panel is able to upload.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    if (ready !== "ready" || !organisationId) return;
    if (!initialFiles || initialFiles.length === 0) return;
    seededRef.current = true;
    const transfer = new DataTransfer();
    for (const file of initialFiles) transfer.items.add(file);
    addFiles(transfer.files);
  }, [ready, organisationId, initialFiles, addFiles]);


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

  const setPhotoRole = async (photo: PhotoRow, roleId: string) => {
    if (!workflow) return;
    if (roleId === workflow.overviewRoleId) {
      const roomKey = workflow.sectionField
        ? (photo.capture_fields?.[workflow.sectionField] ?? "").trim().toLowerCase()
        : "";
      const existing = photos.filter((item) => {
        if (item.id === photo.id) return false;
        const sameRoom = workflow.sectionField
          ? (item.capture_fields?.[workflow.sectionField] ?? "").trim().toLowerCase() === roomKey
          : true;
        return sameRoom && item.capture_fields?.[workflow.roleField] === roleId;
      }).length;
      if (existing >= (workflow.maxOverviewPhotos ?? 3)) {
        toast.error(`Only ${workflow.maxOverviewPhotos ?? 3} overview photographs per room.`);
        return;
      }
    }
    try {
      await updateCaptureFields([photo.id], { [workflow.roleField]: roleId });
      const role = workflow.roles.find((item) => item.id === roleId);
      if (role?.countsAsCover) {
        await setCoverPhoto(reportId, photo.id);
        setCoverPhotoId(photo.id);
      }
      await refresh();
      toast.success(role ? `Photograph #${photo.sequence} set as ${role.label}.` : "Photograph type cleared.");
    } catch (error) {
      toast.error("Could not update photograph type", {
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

        {zoneFields.length > 0 ? (
          <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  {inventoryWorkflow ? "Current room" : keepWalking ? "Current zone" : "Applied to new photographs"}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {inventoryWorkflow
                    ? "Set the room before uploading. The first three room photographs become overviews; the rest become inventory items."
                    : keepWalking
                    ? "Set once, then keep shooting. Every photograph takes these values until you change them."
                    : "These values are recorded against each photograph as it uploads."}
                </p>
              </div>
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </div>
            <div className="mt-3">
              <CaptureFieldsForm
                fields={zoneFields}
                values={zoneValues}
                onChange={(fieldId, value) =>
                  setZoneValues((current) => ({ ...current, [fieldId]: value }))
                }
                idPrefix="zone"
                compact
              />
            </div>
            {inventoryWorkflow ? (
              <label className="mt-3 block text-sm font-medium text-foreground">
                Next photographs
                <select
                  value={inventoryUploadMode}
                  onChange={(event) =>
                    setInventoryUploadMode(event.target.value as "auto" | "overview" | "detail")
                  }
                  className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-base"
                >
                  <option value="auto">Auto — first 3 room photos, then items</option>
                  <option value="overview">Room overview photos only</option>
                  <option value="detail">Inventory item photos only</option>
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        {workflow ? (
          <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
            First exterior photograph is used on the title page. Each room can have up to {workflow.maxOverviewPhotos ?? 3} wide-angle overview photographs before the item photographs are analysed.
          </p>
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

          <p className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm">
            <span className="font-semibold">Title page photograph: </span>
            {coverPhotoId
              ? `#${photos.find((photo) => photo.id === coverPhotoId)?.sequence ?? "—"} — ${
                  photos.find((photo) => photo.id === coverPhotoId)?.original_filename ??
                  "chosen photograph"
                }`
              : "the first photograph will be used. Choose any photograph below instead."}
          </p>

          <PhotoGrid
            photos={photos}
            urls={urls}
            selected={selected}
            onToggle={toggle}
            coverPhotoId={coverPhotoId}
            onSetCover={(photo) => {
              void (async () => {
                try {
                  await setCoverPhoto(reportId, photo.id);
                  setCoverPhotoId(photo.id);
                  toast.success(`Photograph #${photo.sequence} is now the title page.`);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "The title page could not be changed.",
                  );
                }
              })();
            }}
            snapshot={snapshot}
            {...(workflow ? { onSetRole: setPhotoRole } : {})}
            onOpen={(photo) => {
              setEditing(photo);
              setEditValues({ ...(photo.capture_fields ?? {}) });
            }}
          />
        </>
      )}

      {/* One-handed controls: primary actions in the lower third on a phone. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
        {atPhotoCap ? (
          <p className="text-center text-sm text-fail-soft">
            Photograph limit reached for this report ({photoCap} on your plan).
          </p>
        ) : (
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
        )}
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
            <Button
              variant="quiet"
              disabled={!editing || editing.id === coverPhotoId}
              onClick={() => {
                if (!editing) return;
                void (async () => {
                  try {
                    await setCoverPhoto(reportId, editing.id);
                    setCoverPhotoId(editing.id);
                    toast.success("Photograph set as the report cover.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "The cover could not be set.");
                  }
                })();
              }}
            >
              {editing && editing.id === coverPhotoId ? "Cover photo" : "Use as cover"}
            </Button>
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
