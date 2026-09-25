import { itemLabel } from "@/lib/item-label";
import type { DocFinding, DocPhoto, ReportDocument } from "@/lib/report/document";
import {
  photoRoleOf,
  photoWorkflowOf,
  reportLayoutOf,
  resolveStatus,
  type ReportLayout,
} from "@/lib/survey-types";

export type InventoryRoomSection = {
  key: string;
  label: string;
  overviewPhotos: DocPhoto[];
  findings: DocFinding[];
  firstSequence: number;
};

export type InventoryAppendixEntry = {
  photo: DocPhoto;
  findings: DocFinding[];
  room: string;
};

const UNRECORDED_SECTION = "Room not recorded";

export function isInventoryLayout(document: Pick<ReportDocument, "snapshot">): boolean {
  return reportLayoutOf(document.snapshot)?.kind === "inventory_room_schedule";
}

export function inventoryLayout(document: Pick<ReportDocument, "snapshot">): ReportLayout | null {
  const layout = reportLayoutOf(document.snapshot);
  return layout?.kind === "inventory_room_schedule" ? layout : null;
}

export function inventoryCoverPhoto(document: ReportDocument): DocPhoto | null {
  const workflow = photoWorkflowOf(document.snapshot);
  const chosen = document.photos.find((photo) => photo.id === document.report.coverPhotoId);
  if (chosen) return chosen;
  const workflowCover = workflow
    ? document.photos.find(
        (photo) =>
          photoRoleOf(document.snapshot, photo.captureFields, { isFirstPhoto: photo.sequence === 1 })
            ?.countsAsCover === true,
      )
    : null;
  return workflowCover ?? document.photos[0] ?? null;
}

function sectionValue(fields: Record<string, string>, key: string | undefined): string {
  if (!key) return UNRECORDED_SECTION;
  const value = fields[key]?.trim();
  return value || UNRECORDED_SECTION;
}

export function inventoryRooms(document: ReportDocument): InventoryRoomSection[] {
  const layout = inventoryLayout(document);
  if (!layout) return [];

  const sectionField = layout.sectionField;
  const overviewRoleId = layout.overviewRoleId;
  const map = new Map<string, InventoryRoomSection>();
  const add = (label: string): InventoryRoomSection => {
    const key = label.toLowerCase();
    const existing = map.get(key);
    if (existing) return existing;
    const next = { key, label, overviewPhotos: [], findings: [], firstSequence: Number.MAX_SAFE_INTEGER };
    map.set(key, next);
    return next;
  };

  const cover = inventoryCoverPhoto(document);
  for (const photo of document.photos) {
    if (photo.id === cover?.id) continue;
    const label = sectionValue(photo.captureFields, sectionField);
    if (label === UNRECORDED_SECTION) continue;
    const role = photoRoleOf(document.snapshot, photo.captureFields);
    if (role?.countsAsCover === true) continue;
    const room = add(sectionValue(photo.captureFields, sectionField));
    if (role?.id === overviewRoleId) room.overviewPhotos.push(photo);
    room.firstSequence = Math.min(room.firstSequence, photo.sequence);
  }

  for (const finding of document.findings) {
    const currentPhotos = inventoryFindingPhotos(finding, document.snapshot);
    const currentPhoto = currentPhotos[0];
    if (finding.photos.length > 0 && !currentPhoto) continue;
    const room = add(
      currentPhoto
        ? sectionValue(currentPhoto.captureFields, sectionField)
        : sectionValue(finding.captureFields, sectionField),
    );
    room.findings.push(finding);
    const firstPhotoSequence = currentPhoto?.sequence ?? Number.MAX_SAFE_INTEGER;
    room.firstSequence = Math.min(room.firstSequence, firstPhotoSequence, finding.sequence);
  }

  return [...map.values()]
    .map((room) => ({
      ...room,
      overviewPhotos: room.overviewPhotos.sort((a, b) => a.sequence - b.sequence).slice(0, 3),
      findings: room.findings.sort((a, b) => {
        const aSeq = inventoryFindingPhotos(a, document.snapshot)[0]?.sequence ?? Number.MAX_SAFE_INTEGER;
        const bSeq = inventoryFindingPhotos(b, document.snapshot)[0]?.sequence ?? Number.MAX_SAFE_INTEGER;
        return aSeq === bSeq ? a.sequence - b.sequence : aSeq - bSeq;
      }),
    }))
    .sort((a, b) => a.firstSequence - b.firstSequence || a.label.localeCompare(b.label, "en-GB"));
}

export function inventoryFindingPhotos(
  finding: DocFinding,
  snapshot?: ReportDocument["snapshot"],
): DocPhoto[] {
  const seen = new Set<string>();
  return finding.photos
    .map((attachment) => attachment.photo)
    .filter((photo) => {
      if (seen.has(photo.id)) return false;
      seen.add(photo.id);
      if (snapshot) {
        const role = photoRoleOf(snapshot, photo.captureFields);
        const layout = reportLayoutOf(snapshot);
        if (role?.countsAsCover === true || role?.id === layout?.overviewRoleId) return false;
      }
      return true;
    })
    .sort((a, b) => a.sequence - b.sequence);
}

export function inventoryPhotoReference(
  finding: DocFinding,
  snapshot?: ReportDocument["snapshot"],
): string {
  const sequences = inventoryFindingPhotos(finding, snapshot)
    .map((photo) => photo.sequence)
    .filter((sequence) => Number.isFinite(sequence));
  if (sequences.length === 0) return "Photo not linked";
  return sequences.length === 1
    ? `Photo ${sequences[0]}`
    : `Photos ${sequences.join(", ")}`;
}

export function inventoryPhotoReferenceSuffix(
  finding: DocFinding,
  snapshot?: ReportDocument["snapshot"],
): string {
  const references = inventoryPhotoReference(finding, snapshot);
  return references === "Photo not linked" ? "" : ` (${references})`;
}

export function inventoryAppendixEntries(document: ReportDocument): InventoryAppendixEntry[] {
  const layout = inventoryLayout(document);
  if (!layout) return [];

  const cover = inventoryCoverPhoto(document);
  const findingsByPhoto = new Map<string, DocFinding[]>();
  for (const finding of document.findings) {
    for (const photo of inventoryFindingPhotos(finding, document.snapshot)) {
      const existing = findingsByPhoto.get(photo.id) ?? [];
      existing.push(finding);
      findingsByPhoto.set(photo.id, existing);
    }
  }

  return document.photos
    .filter((photo) => {
      if (photo.id === cover?.id) return false;
      const role = photoRoleOf(document.snapshot, photo.captureFields, { isFirstPhoto: photo.sequence === 1 });
      return role?.id !== layout.overviewRoleId && role?.countsAsCover !== true;
    })
    .sort((a, b) => a.sequence - b.sequence)
    .map((photo) => {
      const findings = (findingsByPhoto.get(photo.id) ?? []).sort((a, b) => a.sequence - b.sequence);
      const room = sectionValue(photo.captureFields, layout.sectionField);
      return { photo, findings, room: room || UNRECORDED_SECTION };
    });
}

export type InventoryRoomPhotoGroup = {
  key: string;
  label: string;
  entries: InventoryAppendixEntry[];
};

/**
 * Item photographs grouped into the room they belong to, so each room's
 * photographs can be shown inside that room's own section of the report.
 */
export function inventoryRoomPhotoGroups(document: ReportDocument): {
  rooms: InventoryRoomPhotoGroup[];
  unallocated: InventoryAppendixEntry[];
} {
  const entries = inventoryAppendixEntries(document);
  const order = inventoryRooms(document).map((room) => room.key);
  const map = new Map<string, InventoryRoomPhotoGroup>();
  const unallocated: InventoryAppendixEntry[] = [];

  for (const entry of entries) {
    const label = entry.room.trim();
    if (label === "" || label === UNRECORDED_SECTION) {
      unallocated.push(entry);
      continue;
    }
    const key = label.toLowerCase();
    const group = map.get(key) ?? { key, label, entries: [] };
    group.entries.push(entry);
    map.set(key, group);
  }

  const rooms = [...map.values()].sort((a, b) => {
    const aIndex = order.indexOf(a.key);
    const bIndex = order.indexOf(b.key);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
  for (const room of rooms) room.entries.sort((a, b) => a.photo.sequence - b.photo.sequence);
  unallocated.sort((a, b) => a.photo.sequence - b.photo.sequence);
  return { rooms, unallocated };
}

export function inventoryConditionLabel(document: ReportDocument, finding: DocFinding): string {
  return resolveStatus(document.snapshot, finding.statusId).label;
}

export function inventoryItemLabel(finding: DocFinding): string {
  const count = finding.captureFields["count"]?.trim();
  return count ? `${itemLabel(finding.ref)} · Qty ${count}` : itemLabel(finding.ref);
}

export function inventoryItemWithPhotoLabel(
  finding: DocFinding,
  document?: Pick<ReportDocument, "snapshot">,
): string {
  return `${inventoryItemLabel(finding)} · ${inventoryPhotoReference(finding, document?.snapshot)}`;
}

/** Short fallback label: the first clause only, capped at a word boundary, no ellipsis. */
export function shortItemLabel(value: string): string {
  const first = value
    .replace(/^not assessed automatically:\s*/i, "")
    .split(/[.,;:\n(]|\s[-–—]\s/)[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (!first) return "";
  if (first.length <= 30) return first;
  const cut = first.slice(0, 30);
  const space = cut.lastIndexOf(" ");
  return (space > 10 ? cut.slice(0, space) : cut).trim();
}

export function inventoryItemTableLabel(
  finding: DocFinding,
  document?: Pick<ReportDocument, "snapshot">,
): string {
  const explicit =
    finding.captureFields["item"]?.trim() ||
    finding.captureFields["item_name"]?.trim() ||
    finding.captureFields["object"]?.trim();
  const inferred = shortItemLabel(finding.findingText);
  const base = explicit || inferred || "Unidentified item";
  const label = finding.statusId === "not_assessed" ? "Unidentified item" : base;
  return `${label}${inventoryPhotoReferenceSuffix(finding, document?.snapshot)}`;
}

export function inventoryCheckoutComment(document: ReportDocument, finding: DocFinding): string {
  const field = inventoryLayout(document)?.checkoutCommentField;
  return field ? (finding.captureFields[field] ?? "") : "";
}