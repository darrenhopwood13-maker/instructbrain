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
    const next = { key, label, overviewPhotos: [], findings: [] };
    map.set(key, next);
    return next;
  };

  for (const photo of document.photos) {
    const role = photoRoleOf(document.snapshot, photo.captureFields);
    if (role?.id !== overviewRoleId) continue;
    add(sectionValue(photo.captureFields, sectionField)).overviewPhotos.push(photo);
  }

  for (const finding of document.findings) {
    add(sectionValue(finding.captureFields, sectionField)).findings.push(finding);
  }

  return [...map.values()].map((room) => ({
    ...room,
    overviewPhotos: room.overviewPhotos.sort((a, b) => a.sequence - b.sequence).slice(0, 3),
    findings: room.findings.sort((a, b) => {
      const aSeq = a.photos[0]?.photo.sequence ?? Number.MAX_SAFE_INTEGER;
      const bSeq = b.photos[0]?.photo.sequence ?? Number.MAX_SAFE_INTEGER;
      return aSeq === bSeq ? a.sequence - b.sequence : aSeq - bSeq;
    }),
  }));
}

export function inventoryConditionLabel(document: ReportDocument, finding: DocFinding): string {
  return resolveStatus(document.snapshot, finding.statusId).label;
}

export function inventoryItemLabel(finding: DocFinding): string {
  const count = finding.captureFields["count"]?.trim();
  return count ? `${itemLabel(finding.ref)} · Qty ${count}` : itemLabel(finding.ref);
}

export function inventoryCheckoutComment(document: ReportDocument, finding: DocFinding): string {
  const field = inventoryLayout(document)?.checkoutCommentField;
  return field ? (finding.captureFields[field] ?? "") : "";
}