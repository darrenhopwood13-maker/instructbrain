/**
 * Sorting uploaded photographs into rooms after upload.
 *
 * Every field name, role id and limit comes from the template's own photo
 * workflow — no room name or discipline word is written here (invariant 5).
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
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
  renameRoomFields,
  reorderedRoomLabels,
  roomOrderFields,
} from "@/lib/photos/rooms";

export function RoomOrganiser({
  workflow,
  photos,
  urls,
  selectedIds,
  onApply,
  onClearSelection,
}: {
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

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleting, setDeleting] = useState<{ key: string; label: string } | null>(null);

  const nextOrder = grouped.rooms.length;

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
    await allocate(label, nextOrder);
  };

  const renameRoom = async () => {
    if (!renaming) return;
    const label = renameTitle.trim();
    const room = grouped.rooms.find((item) => item.key === renaming.key);
    setRenaming(null);
    if (label === "" || !room) return;
    const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
    await onApply(ids, renameRoomFields(workflow, label));
  };

  const deleteRoom = async () => {
    if (!deleting) return;
    const room = grouped.rooms.find((item) => item.key === deleting.key);
    setDeleting(null);
    if (!room) return;
    const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
    await onApply(ids, clearRoomFields(workflow));
  };

  const moveRoom = async (key: string, direction: -1 | 1) => {
    const labels = reorderedRoomLabels(grouped.rooms, key, direction);
    for (const [index, label] of labels.entries()) {
      const room = grouped.rooms.find((item) => item.label === label);
      if (!room) continue;
      const ids = [...room.overviewPhotos, ...room.itemPhotos].map((photo) => photo.id);
      if (ids.length > 0) await onApply(ids, roomOrderFields(index));
    }
  };

  const setHeader = async (room: (typeof grouped.rooms)[number], photoId: string) => {
    if (headerSlotsLeft(room, workflow) <= 0) return;
    await onApply([photoId], markAsRoomHeaderFields(workflow));
  };

  return (
    <section aria-labelledby="rooms-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rooms-heading" className="text-sm font-semibold">
          Rooms
        </h2>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={selectedIds.length === 0}
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" className="size-4" />
          Create a room
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Select photographs above, then put them in a room. Up to {limit} of each room&apos;s
        photographs can be its header photographs — those are shown at the top of the room&apos;s page
        and are not analysed.
      </p>

      {grouped.rooms.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No rooms yet. Select photographs and create your first room.
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {grouped.rooms.map((room, index) => (
          <li key={room.key} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{room.label}</p>
              <div className="flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={selectedIds.length === 0}
                  onClick={() => void allocate(room.label, room.order)}
                >
                  Add {selectedIds.length || ""} here
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Move ${room.label} up`}
                  disabled={index === 0}
                  onClick={() => void moveRoom(room.key, -1)}
                >
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Move ${room.label} down`}
                  disabled={index === grouped.rooms.length - 1}
                  onClick={() => void moveRoom(room.key, 1)}
                >
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Rename ${room.label}`}
                  onClick={() => {
                    setRenaming({ key: room.key, label: room.label });
                    setRenameTitle(room.label);
                  }}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={`Remove ${room.label}`}
                  onClick={() => setDeleting({ key: room.key, label: room.label })}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {room.overviewPhotos.length} of {limit} header photographs ·{" "}
              {room.itemPhotos.length} item photograph{room.itemPhotos.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[...room.overviewPhotos, ...room.itemPhotos]
                .sort((a, b) => a.sequence - b.sequence)
                .map((photo) => {
                  const isHeader = room.overviewPhotos.some((item) => item.id === photo.id);
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
                        disabled={!isHeader && headerSlotsLeft(room, workflow) <= 0}
                        onClick={() =>
                          void (isHeader
                            ? onApply([photo.id], markAsItemFields(workflow))
                            : setHeader(room, photo.id))
                        }
                      >
                        {isHeader ? "Header photo" : "Item photo"}
                      </Button>
                    </li>
                  );
                })}
            </ul>
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
              The {selectedIds.length} selected photograph
              {selectedIds.length === 1 ? "" : "s"} will be put in this room.
            </DialogDescription>
          </DialogHeader>
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
