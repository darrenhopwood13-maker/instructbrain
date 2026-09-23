/**
 * Sorting uploaded photographs into rooms after upload.
 *
 * Every field name, role id, limit and suggested title comes from the
 * template's own photo workflow — no room name or discipline word is written
 * here (invariant 5).
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FolderPlus, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  RoomSuggestionsDialog,
  type AppliedRoom,
} from "@/components/photos/room-suggestions";
import { suggestRooms } from "@/lib/photos/rooms.functions";
import type { RoomProposal } from "@/lib/photos/room-suggest";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PhotoRow } from "@/lib/photos/photo-service";
import type { PhotoWorkflow } from "@/lib/survey-types";
import {
  allocateToRoomFields,
  clearRoomFields,
  groupPhotosByRoom,
  headerSlotsLeft,
  markAsItemFields,
  markAsRoomHeaderFields,
  maxOverviewPhotos,
  mergeDraftRooms,
  renameRoomFields,
  reorderedRoomLabels,
  roomOrderFields,
} from "@/lib/photos/rooms";

function draftKey(reportId: string): string {
  return `instructbrain.rooms.${reportId}`;
}

function readDrafts(reportId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(draftKey(reportId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function RoomOrganiser({
  reportId,
  workflow,
  photos,
  urls,
  selectedIds,
  onApply,
  onClearSelection,
}: {
  reportId: string;
  workflow: PhotoWorkflow;
  photos: PhotoRow[];
  urls: Record<string, string>;
  selectedIds: string[];
  /** Writes a capture-field patch to the given photographs and refreshes. */
  onApply: (ids: string[], fields: Record<string, string>) => Promise<void>;
  onClearSelection: () => void;
}) {
  const grouped = useMemo(
    () =>
      groupPhotosByRoom(
        photos.map((photo) => ({
          ...photo,
          capture_fields: (photo.capture_fields ?? {}) as Record<string, string>,
        })),
        workflow,
      ),
    [photos, workflow],
  );
  const limit = maxOverviewPhotos(workflow);
  const suggestions = workflow.sectionSuggestions ?? [];

  const [drafts, setDrafts] = useState<string[]>(() => readDrafts(reportId));
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(draftKey(reportId), JSON.stringify(drafts));
    } catch {
      /* storage unavailable — rooms with photographs are still persisted */
    }
  }, [drafts, reportId]);

  const entries = useMemo(() => mergeDraftRooms(grouped.rooms, drafts), [grouped.rooms, drafts]);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState("");
  const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleting, setDeleting] = useState<{ key: string; label: string } | null>(null);

  const allocate = async (room: string, order: number) => {
    if (selectedIds.length === 0) return;
    await onApply(selectedIds, allocateToRoomFields(workflow, room, order));
    onClearSelection();
  };

  const createRoom = async () => {
    const label = newTitle.trim();
    if (label === "") return;
    setCreateOpen(false);
    setNewTitle("");
    setDrafts((current) =>
      current.some((item) => item.toLowerCase() === label.toLowerCase()) ? current : [...current, label],
    );
    if (selectedIds.length > 0) await allocate(label, entries.length);
  };

  const addToRoom = async () => {
    const label = addTarget.trim();
    if (label === "") return;
    setAddOpen(false);
    const index = entries.findIndex((entry) => entry.key === label.toLowerCase());
    await allocate(label, index === -1 ? entries.length : index);
  };

  const renameRoom = async () => {
    if (!renaming) return;
    const label = renameTitle.trim();
    const previous = renaming.label;
    const room = grouped.rooms.find((item) => item.key === renaming.key);
    setRenaming(null);
    if (label === "") return;
    setDrafts((current) =>
      current.map((item) => (item.toLowerCase() === previous.toLowerCase() ? label : item)),
    );
    if (!room) return;
    const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
    await onApply(ids, renameRoomFields(workflow, label));
  };

  const deleteRoom = async () => {
    if (!deleting) return;
    const room = grouped.rooms.find((item) => item.key === deleting.key);
    const label = deleting.label;
    setDeleting(null);
    setDrafts((current) => current.filter((item) => item.toLowerCase() !== label.toLowerCase()));
    if (!room) return;
    const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
    await onApply(ids, clearRoomFields(workflow));
  };

  const moveRoom = async (key: string, direction: -1 | 1) => {
    const labels = reorderedRoomLabels(grouped.rooms, key, direction);
    setDrafts(labels);
    for (const [index, label] of labels.entries()) {
      const room = grouped.rooms.find((item) => item.label === label);
      if (!room) continue;
      const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
      if (ids.length > 0) await onApply(ids, roomOrderFields(index));
    }
  };

  const setHeader = async (
    room: NonNullable<(typeof entries)[number]["room"]>,
    photoId: string,
  ) => {
    if (headerSlotsLeft(room, workflow) <= 0) return;
    await onApply([photoId], markAsRoomHeaderFields(workflow));
  };

  return (
    <section aria-labelledby="rooms-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rooms-heading" className="text-sm font-semibold">
          Rooms
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" className="size-4" />
            Create room
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={selectedIds.length === 0 || entries.length === 0}
            onClick={() => {
              setAddTarget(entries[0]?.label ?? "");
              setAddOpen(true);
            }}
          >
            <FolderPlus aria-hidden="true" className="size-4" />
            Add {selectedIds.length || ""} to room
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Create your rooms first, then select photographs above and add them to a room. Up to {limit}{" "}
        of each room&apos;s photographs can be its overview photographs — those are shown at the top
        of the room&apos;s page and are not analysed.
      </p>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No rooms yet. Create your first room.
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {entries.map((entry, index) => (
          <li key={entry.key} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{entry.label}</p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={selectedIds.length === 0}
                  onClick={() => void allocate(entry.label, index)}
                >
                  Add {selectedIds.length || ""} here
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Move ${entry.label} up`}
                  disabled={index === 0 || !entry.room}
                  onClick={() => void moveRoom(entry.key, -1)}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Move ${entry.label} down`}
                  disabled={index === entries.length - 1 || !entry.room}
                  onClick={() => void moveRoom(entry.key, 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Rename ${entry.label}`}
                  onClick={() => {
                    setRenaming({ key: entry.key, label: entry.label });
                    setRenameTitle(entry.label);
                  }}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remove ${entry.label}`}
                  onClick={() => setDeleting({ key: entry.key, label: entry.label })}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
            {entry.room ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.room.overviewPhotos.length} of {limit} overview photographs ·{" "}
                  {entry.room.itemPhotos.length} item photograph
                  {entry.room.itemPhotos.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {[...entry.room.overviewPhotos, ...entry.room.itemPhotos]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((photo) => {
                      const isHeader = entry.room!.overviewPhotos.some((item) => item.id === photo.id);
                      return (
                        <li key={photo.id} className="w-24">
                          {urls[photo.id] ? (
                            <img
                              src={urls[photo.id]}
                              alt={`Photograph ${photo.sequence}`}
                              className="h-20 w-24 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="h-20 w-24 rounded-lg bg-muted" />
                          )}
                          <Button
                            type="button"
                            variant={isHeader ? "default" : "secondary"}
                            size="sm"
                            className="mt-1 min-h-11 w-full text-xs"
                            disabled={!isHeader && headerSlotsLeft(entry.room ?? undefined, workflow) <= 0}
                            onClick={() =>
                              void (isHeader
                                ? onApply([photo.id], markAsItemFields(workflow))
                                : setHeader(entry.room!, photo.id))
                            }
                          >
                            {isHeader ? "Overview photo" : "Item photo"}
                          </Button>
                        </li>
                      );
                    })}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                No photographs in this room yet. Select photographs above and add them here.
              </p>
            )}
          </li>
        ))}
      </ul>

      {grouped.unallocated.length > 0 ? (
        <p className="mt-3 text-sm">
          {grouped.unallocated.length} photograph{grouped.unallocated.length === 1 ? "" : "s"} not in
          a room yet.
        </p>
      ) : null}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
            <DialogDescription>
              {selectedIds.length > 0
                ? `The ${selectedIds.length} selected photograph${selectedIds.length === 1 ? "" : "s"} will be put in this room.`
                : "Create your rooms one by one, then add photographs to them."}
            </DialogDescription>
          </DialogHeader>
          {suggestions.length > 0 ? (
            <div>
              <p className="text-sm font-medium">Common rooms</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <Button
                      type="button"
                      variant={newTitle.trim() === suggestion ? "default" : "secondary"}
                      size="sm"
                      className="min-h-11"
                      onClick={() => setNewTitle(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label className="text-sm font-medium" htmlFor="new-room-title">
            Room title
          </label>
          <input
            id="new-room-title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm"
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={newTitle.trim() === ""} onClick={() => void createRoom()}>
              Create room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add photographs to a room</DialogTitle>
            <DialogDescription>
              {selectedIds.length} photograph{selectedIds.length === 1 ? "" : "s"} selected.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium" htmlFor="add-room-target">
            Room
          </label>
          <Select value={addTarget} onValueChange={setAddTarget}>
            <SelectTrigger id="add-room-target" className="min-h-11">
              <SelectValue placeholder="Choose a room" />
            </SelectTrigger>
            <SelectContent>
              {entries.map((entry) => (
                <SelectItem key={entry.key} value={entry.label}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={addTarget.trim() === ""} onClick={() => void addToRoom()}>
              Add to room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renaming !== null} onOpenChange={(open) => (open ? null : setRenaming(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename room</DialogTitle>
            <DialogDescription>The room keeps its place in the report.</DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium" htmlFor="rename-room-title">
            Room title
          </label>
          <input
            id="rename-room-title"
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm"
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={renameTitle.trim() === ""}
              onClick={() => void renameRoom()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => (open ? null : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its photographs are kept and returned to the not-in-a-room list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteRoom()}>Remove room</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
