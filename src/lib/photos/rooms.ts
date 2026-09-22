/**
 * Sorting uploaded photographs into rooms after the fact.
 *
 * No room name, role name or discipline word lives here: the field names and
 * role ids all come from the template's own photo workflow (invariant 5). The
 * store is the photograph's existing capture fields, so nothing new is needed
 * in the database.
 */

import type { PhotoWorkflow } from "@/lib/survey-types";

export type RoomPhoto = {
  id: string;
  sequence: number;
  capture_fields: Record<string, string>;
};

export type RoomGroup<T extends RoomPhoto = RoomPhoto> = {
  /** Case-insensitive identity for the room. */
  key: string;
  label: string;
  overviewPhotos: T[];
  itemPhotos: T[];
  firstSequence: number;
  order: number;
};

/** Written into capture fields so rooms can be moved without renaming them. */
export const ROOM_ORDER_FIELD = "_room_order";

function roomOf(photo: RoomPhoto, workflow: PhotoWorkflow): string {
  if (!workflow.sectionField) return "";
  return (photo.capture_fields?.[workflow.sectionField] ?? "").trim();
}

function orderOf(photo: RoomPhoto): number | null {
  const raw = Number(photo.capture_fields?.[ROOM_ORDER_FIELD]);
  return Number.isFinite(raw) ? raw : null;
}

export function groupPhotosByRoom<T extends RoomPhoto>(
  photos: T[],
  workflow: PhotoWorkflow,
): { rooms: RoomGroup<T>[]; unallocated: T[] } {
  const map = new Map<string, RoomGroup<T>>();
  const unallocated: T[] = [];
  const ordered = [...photos].sort((a, b) => a.sequence - b.sequence);

  for (const photo of ordered) {
    const label = roomOf(photo, workflow);
    if (label === "") {
      unallocated.push(photo);
      continue;
    }
    const key = label.toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label,
        overviewPhotos: [],
        itemPhotos: [],
        firstSequence: photo.sequence,
        order: orderOf(photo) ?? photo.sequence,
      };
      map.set(key, group);
    }
    const explicit = orderOf(photo);
    if (explicit !== null) group.order = explicit;
    if (photo.capture_fields?.[workflow.roleField] === workflow.overviewRoleId) {
      group.overviewPhotos.push(photo);
    } else {
      group.itemPhotos.push(photo);
    }
  }

  const rooms = [...map.values()].sort(
    (a, b) => a.order - b.order || a.firstSequence - b.firstSequence,
  );
  return { rooms, unallocated };
}

export function maxOverviewPhotos(workflow: PhotoWorkflow): number {
  return workflow.maxOverviewPhotos ?? 3;
}

/** Capture-field patch that allocates a photograph to a room as an item photo. */
export function allocateToRoomFields(
  workflow: PhotoWorkflow,
  room: string,
  order: number,
): Record<string, string> {
  const patch: Record<string, string> = { [ROOM_ORDER_FIELD]: String(order) };
  if (workflow.sectionField) patch[workflow.sectionField] = room.trim();
  if (workflow.detailRoleId) patch[workflow.roleField] = workflow.detailRoleId;
  return patch;
}

/** Capture-field patch that marks a photograph as one of the room header photos. */
export function markAsRoomHeaderFields(workflow: PhotoWorkflow): Record<string, string> {
  return workflow.overviewRoleId ? { [workflow.roleField]: workflow.overviewRoleId } : {};
}

/** Capture-field patch that turns a header photograph back into an item photo. */
export function markAsItemFields(workflow: PhotoWorkflow): Record<string, string> {
  return workflow.detailRoleId ? { [workflow.roleField]: workflow.detailRoleId } : {};
}

/** Capture-field patch that returns a photograph to the un-allocated list. */
export function clearRoomFields(workflow: PhotoWorkflow): Record<string, string> {
  const patch: Record<string, string> = { [ROOM_ORDER_FIELD]: "" };
  if (workflow.sectionField) patch[workflow.sectionField] = "";
  patch[workflow.roleField] = "";
  return patch;
}

/** Patch that renames a room, keeping its position in the report. */
export function renameRoomFields(
  workflow: PhotoWorkflow,
  label: string,
): Record<string, string> {
  return workflow.sectionField ? { [workflow.sectionField]: label.trim() } : {};
}

export function roomOrderFields(order: number): Record<string, string> {
  return { [ROOM_ORDER_FIELD]: String(order) };
}

/** How many header photographs this room can still take. */
export function headerSlotsLeft(
  room: RoomGroup | undefined,
  workflow: PhotoWorkflow,
): number {
  const limit = maxOverviewPhotos(workflow);
  return Math.max(0, limit - (room?.overviewPhotos.length ?? 0));
}

/** Rooms in report order, after moving one room up or down. */
export function reorderedRoomLabels(
  rooms: RoomGroup[],
  key: string,
  direction: -1 | 1,
): string[] {
  const labels = rooms.map((room) => room.label);
  const index = rooms.findIndex((room) => room.key === key);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= labels.length) return labels;
  const moved = labels[index]!;
  labels[index] = labels[target]!;
  labels[target] = moved;
  return labels;
}
