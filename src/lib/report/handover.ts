/**
 * Meter readings and keys recorded at handover.
 *
 * Every label comes from the template's own `reportLayout.handover` block —
 * nothing here names a meter, a key or a tenancy. A template without the block
 * simply has no handover pages.
 */
import { reportLayoutOf, type SurveyTypeSnapshot } from "@/lib/survey-types";

export type HandoverOption = { id: string; label: string };

export type HandoverLayout = {
  meterRoleId: string;
  keysRoleId: string;
  /** Photo capture field naming which meter slot a meter photo belongs to. */
  slotField: string;
  meterTitle: string;
  meterNotice: string;
  readingLabel: string;
  serialLabel: string;
  notAccessibleLabel: string;
  startLabel: string;
  endLabel: string;
  addMeterLabel: string;
  meterTypes: HandoverOption[];
  keysTitle: string;
  keysIntro: string;
  keyItemLabel: string;
  keyQuantityLabel: string;
  questions: HandoverOption[];
};

export type MeterEntry = { reading?: string; serial?: string; notAccessible?: boolean };
export type KeyEntry = { label: string; quantity: string };

export type HandoverRecord = {
  meters: Record<string, MeterEntry>;
  extraMeters: HandoverOption[];
  keys: KeyEntry[];
  answers: Record<string, "yes" | "no">;
};

export const EMPTY_HANDOVER: HandoverRecord = { meters: {}, extraMeters: [], keys: [], answers: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function options(value: unknown): HandoverOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((entry) => ({ id: str(entry["id"]).trim(), label: str(entry["label"]).trim() }))
    .filter((entry) => entry.id !== "" && entry.label !== "");
}

export function handoverLayoutOf(snapshot: SurveyTypeSnapshot | null | undefined): HandoverLayout | null {
  if (!reportLayoutOf(snapshot)) return null;
  const raw = (snapshot?.reportLayout as Record<string, unknown> | undefined)?.["handover"];
  if (!isRecord(raw)) return null;
  const meterRoleId = str(raw["meterRoleId"]);
  const keysRoleId = str(raw["keysRoleId"]);
  const slotField = str(raw["slotField"]);
  if (!meterRoleId || !keysRoleId || !slotField) return null;
  return {
    meterRoleId,
    keysRoleId,
    slotField,
    meterTitle: str(raw["meterTitle"], "Meter readings"),
    meterNotice: str(raw["meterNotice"]),
    readingLabel: str(raw["readingLabel"], "Reading"),
    serialLabel: str(raw["serialLabel"], "Serial"),
    notAccessibleLabel: str(raw["notAccessibleLabel"], "Not accessible"),
    startLabel: str(raw["startLabel"], "Start"),
    endLabel: str(raw["endLabel"], "End"),
    addMeterLabel: str(raw["addMeterLabel"], "Add another"),
    meterTypes: options(raw["meterTypes"]),
    keysTitle: str(raw["keysTitle"], "Keys"),
    keysIntro: str(raw["keysIntro"]),
    keyItemLabel: str(raw["keyItemLabel"], "Item"),
    keyQuantityLabel: str(raw["keyQuantityLabel"], "Quantity"),
    questions: options(raw["questions"]),
  };
}

/** Stored jsonb → a safe record. Anything unexpected is dropped, never guessed. */
export function coerceHandover(raw: unknown): HandoverRecord {
  if (!isRecord(raw)) return { ...EMPTY_HANDOVER };
  const meters: Record<string, MeterEntry> = {};
  if (isRecord(raw["meters"])) {
    for (const [id, value] of Object.entries(raw["meters"])) {
      if (!isRecord(value)) continue;
      meters[id] = {
        ...(typeof value["reading"] === "string" ? { reading: value["reading"] } : {}),
        ...(typeof value["serial"] === "string" ? { serial: value["serial"] } : {}),
        ...(value["notAccessible"] === true ? { notAccessible: true } : {}),
      };
    }
  }
  const keys = Array.isArray(raw["keys"])
    ? raw["keys"]
        .filter(isRecord)
        .map((entry) => ({ label: str(entry["label"]), quantity: str(entry["quantity"]) }))
    : [];
  const answers: Record<string, "yes" | "no"> = {};
  if (isRecord(raw["answers"])) {
    for (const [id, value] of Object.entries(raw["answers"])) {
      if (value === "yes" || value === "no") answers[id] = value;
    }
  }
  return { meters, extraMeters: options(raw["extraMeters"]), keys, answers };
}

/** The template's meters, then any the person added for this report. */
export function meterSlots(layout: HandoverLayout, record: HandoverRecord): HandoverOption[] {
  const seen = new Set(layout.meterTypes.map((type) => type.id));
  return [...layout.meterTypes, ...record.extraMeters.filter((type) => !seen.has(type.id))];
}

type SlotPhoto = { id: string; capture_fields?: Record<string, string> | null; captureFields?: Record<string, string> };

function fieldsOf(photo: SlotPhoto): Record<string, string> {
  return photo.captureFields ?? photo.capture_fields ?? {};
}

export function isHandoverPhoto(
  layout: HandoverLayout | null,
  roleField: string | undefined,
  captureFields: Record<string, string> | null | undefined,
): boolean {
  if (!layout || !roleField) return false;
  const role = captureFields?.[roleField];
  return role === layout.meterRoleId || role === layout.keysRoleId;
}

export function meterPhotoFor<T extends SlotPhoto>(
  layout: HandoverLayout,
  roleField: string,
  photos: T[],
  slotId: string,
): T | null {
  return (
    photos.find((photo) => {
      const fields = fieldsOf(photo);
      return fields[roleField] === layout.meterRoleId && fields[layout.slotField] === slotId;
    }) ?? null
  );
}

export function keyPhotos<T extends SlotPhoto>(layout: HandoverLayout, roleField: string, photos: T[]): T[] {
  return photos.filter((photo) => fieldsOf(photo)[roleField] === layout.keysRoleId);
}

/** How a meter reads in the finished report. Never blank without saying why. */
export function meterReadingText(layout: HandoverLayout, entry: MeterEntry | undefined): string {
  if (entry?.notAccessible) return layout.notAccessibleLabel;
  return entry?.reading?.trim() ?? "";
}

/** Short "what's still missing" lines. Informational only — never blocks anything. */
export function handoverMissing<T extends SlotPhoto>(
  layout: HandoverLayout,
  roleField: string,
  record: HandoverRecord,
  photos: T[],
): string[] {
  const missing: string[] = [];
  for (const slot of meterSlots(layout, record)) {
    const entry = record.meters[slot.id];
    if (entry?.notAccessible) continue;
    if (!meterPhotoFor(layout, roleField, photos, slot.id)) missing.push(`${slot.label}: no photo`);
    if (!entry?.reading?.trim()) missing.push(`${slot.label}: ${layout.readingLabel.toLowerCase()} not entered`);
  }
  if (keyPhotos(layout, roleField, photos).length === 0) missing.push(`${layout.keysTitle}: no photo`);
  if (record.keys.filter((key) => key.label.trim() !== "").length === 0) {
    missing.push(`${layout.keysTitle}: none listed`);
  }
  for (const question of layout.questions) {
    if (!record.answers[question.id]) missing.push(`${question.label}: not answered`);
  }
  return missing;
}
