/**
 * The room proposal, shown before anything is written.
 *
 * Every suggestion is labelled as a suggestion, carries the model's reason, and
 * can be moved, renamed or dropped. Nothing is applied until the person presses
 * Apply, and a low-confidence room is never ticked for them.
 */

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ProposedRoom, RoomProposal } from "@/lib/photos/room-suggest";
import { maxOverviewPhotos } from "@/lib/photos/rooms";
import type { PhotoWorkflow } from "@/lib/survey-types";

const UNSURE = "__unsure__";

export type AppliedRoom = { label: string; photoIds: string[]; overviewPhotoIds: string[] };

export function RoomSuggestionsDialog({
  open,
  onOpenChange,
  proposal,
  workflow,
  urls,
  sequences,
  applying,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: RoomProposal | null;
  workflow: PhotoWorkflow;
  urls: Record<string, string>;
  sequences: Record<string, number>;
  applying: boolean;
  onApply: (rooms: AppliedRoom[]) => Promise<void>;
}) {
  const limit = maxOverviewPhotos(workflow);
  const [rooms, setRooms] = useState<ProposedRoom[]>([]);
  const [unsure, setUnsure] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!proposal) return;
    setRooms(proposal.rooms.map((room) => ({ ...room })));
    setUnsure([...proposal.unsure]);
    // A room the model was unsure about starts unticked — the person decides.
    setAccepted(
      Object.fromEntries(proposal.rooms.map((room) => [room.label, !room.lowConfidence])),
    );
  }, [proposal]);

  const roomOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const room of rooms) for (const id of room.photoIds) map[id] = room.label;
    return map;
  }, [rooms]);

  const movePhoto = (photoId: string, target: string) => {
    setRooms((current) =>
      current.map((room) => {
        if (room.label === target) {
          return room.photoIds.includes(photoId)
            ? room
            : {
                ...room,
                photoIds: [...room.photoIds, photoId].sort(
                  (a, b) => (sequences[a] ?? 0) - (sequences[b] ?? 0),
                ),
              };
        }
        return room.photoIds.includes(photoId)
          ? {
              ...room,
              photoIds: room.photoIds.filter((id) => id !== photoId),
              overviewPhotoIds: room.overviewPhotoIds.filter((id) => id !== photoId),
            }
          : room;
      }),
    );
    setUnsure((current) =>
      target === UNSURE
        ? current.includes(photoId)
          ? current
          : [...current, photoId]
        : current.filter((id) => id !== photoId),
    );
  };

  const toggleOverview = (label: string, photoId: string) => {
    setRooms((current) =>
      current.map((room) => {
        if (room.label !== label) return room;
        const isOverview = room.overviewPhotoIds.includes(photoId);
        if (isOverview) {
          return {
            ...room,
            overviewPhotoIds: room.overviewPhotoIds.filter((id) => id !== photoId),
          };
        }
        if (room.overviewPhotoIds.length >= limit) return room;
        return { ...room, overviewPhotoIds: [...room.overviewPhotoIds, photoId] };
      }),
    );
  };

  const renameRoom = (label: string, next: string) => {
    setRooms((current) =>
      current.map((room) => (room.label === label ? { ...room, label: next } : room)),
    );
    setAccepted((current) => {
      const { [label]: was, ...rest } = current;
      return { ...rest, [next]: was ?? true };
    });
  };

  const dropRoom = (label: string) => {
    const room = rooms.find((item) => item.label === label);
    setRooms((current) => current.filter((item) => item.label !== label));
    setUnsure((current) => [...current, ...(room?.photoIds ?? []).filter((id) => !current.includes(id))]);
  };

  const chosen = rooms.filter((room) => accepted[room.label] && room.photoIds.length > 0);

  const photoTile = (photoId: string, label: string | null) => (
    <li key={photoId} className="w-28">
      {urls[photoId] ? (
        <img
          src={urls[photoId]}
          alt={`Photograph ${sequences[photoId] ?? ""}`}
          className="h-20 w-28 rounded-lg object-cover"
        />
      ) : (
        <div className="h-20 w-28 rounded-lg bg-muted" />
      )}
      <Select
        value={label ?? UNSURE}
        onValueChange={(value) => movePhoto(photoId, value)}
      >
        <SelectTrigger
          className="mt-1 min-h-11 text-xs"
          aria-label={`Room for photograph ${sequences[photoId] ?? ""}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rooms.map((room) => (
            <SelectItem key={room.label} value={room.label}>
              {room.label}
            </SelectItem>
          ))}
          <SelectItem value={UNSURE}>Not sure</SelectItem>
        </SelectContent>
      </Select>
      {label ? (
        <Button
          type="button"
          variant={
            rooms.find((room) => room.label === label)?.overviewPhotoIds.includes(photoId)
              ? "default"
              : "secondary"
          }
          size="sm"
          className="mt-1 min-h-11 w-full text-xs"
          onClick={() => toggleOverview(label, photoId)}
        >
          {rooms.find((room) => room.label === label)?.overviewPhotoIds.includes(photoId)
            ? "Overview photo"
            : "Item photo"}
        </Button>
      ) : null}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Suggested rooms</DialogTitle>
          <DialogDescription>
            These are suggestions. Nothing changes until you press Apply — move anything that is in
            the wrong place first.
          </DialogDescription>
        </DialogHeader>

        {rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rooms could be suggested from these photographs. Create your rooms as usual.
          </p>
        ) : null}

        <ul className="space-y-4">
          {rooms.map((room) => (
            <li key={room.label} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`accept-${room.label}`}
                    checked={accepted[room.label] ?? false}
                    onCheckedChange={(value) =>
                      setAccepted((current) => ({ ...current, [room.label]: value === true }))
                    }
                  />
                  <label className="text-sm font-semibold" htmlFor={`accept-${room.label}`}>
                    {room.label}
                  </label>
                  {room.lowConfidence ? (
                    <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                      Not confident — check this one
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => dropRoom(room.label)}
                  >
                    Drop room
                  </Button>
                </div>
              </div>
              <label className="mt-2 block text-xs font-medium" htmlFor={`title-${room.label}`}>
                Room title
              </label>
              <input
                id={`title-${room.label}`}
                value={room.label}
                onChange={(event) => renameRoom(room.label, event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-surface p-3 text-sm"
              />
              {room.reason ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Why: {room.reason} (confidence {Math.round(room.confidence * 100)}%)
                </p>
              ) : null}
              <ul className="mt-2 flex flex-wrap gap-2">
                {room.photoIds.map((photoId) => photoTile(photoId, room.label))}
              </ul>
            </li>
          ))}
        </ul>

        {unsure.length > 0 ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-sm font-semibold">
              Not sure ({unsure.length}) — these were left out
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Put each one in a room here, or leave it and sort it out yourself afterwards.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {unsure.map((photoId) => photoTile(photoId, null))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={chosen.length === 0 || applying}
            onClick={() =>
              void onApply(
                chosen.map((room) => ({
                  label: room.label.trim(),
                  photoIds: room.photoIds,
                  overviewPhotoIds: room.overviewPhotoIds,
                })),
              )
            }
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {applying
              ? "Applying…"
              : `Apply ${chosen.length} room${chosen.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
