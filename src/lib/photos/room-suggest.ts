/**
 * Turning a model's grouping answer into a proposal a person can read.
 *
 * Nothing here writes anything, and nothing here names a room, a role or a
 * discipline: every title, limit and field comes from the template's own photo
 * workflow (invariant 5). A grouping the model is not confident about is held
 * back — it never lands in the nearest room (invariant 1 in spirit: an
 * uncertain answer is never presented as settled).
 */

import type { PhotoWorkflow } from "@/lib/survey-types";
import { maxOverviewPhotos } from "@/lib/photos/rooms";

export type ProposedRoom = {
  label: string;
  /** Photograph ids, in the order they were taken. */
  photoIds: string[];
  /** A subset of `photoIds`, never longer than the workflow's limit. */
  overviewPhotoIds: string[];
  confidence: number;
  reason: string;
  /** Below the confidence threshold: shown, explained, never pre-ticked. */
  lowConfidence: boolean;
};

export type RoomProposal = {
  rooms: ProposedRoom[];
  /** Photographs the model was not sure about, plus anything it left out. */
  unsure: string[];
};

export type CoerceOptions = {
  /** Photograph ids in the order handed to the model. Refs are 1-based into this. */
  photoIds: string[];
  workflow: PhotoWorkflow;
  /** Below this a grouping is marked low confidence. */
  confidenceThreshold: number;
};

function refsToIds(value: unknown, photoIds: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    const ref = Number(entry);
    if (!Number.isInteger(ref) || ref < 1 || ref > photoIds.length) continue;
    const id = photoIds[ref - 1] as string;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Prefer the template's own wording, so the report reads consistently. */
function canonicalLabel(raw: unknown, workflow: PhotoWorkflow): string {
  const label = typeof raw === "string" ? raw.trim() : "";
  if (label === "") return "";
  const match = (workflow.sectionSuggestions ?? []).find(
    (suggestion) => suggestion.toLowerCase() === label.toLowerCase(),
  );
  return match ?? label;
}

function confidenceOf(value: unknown): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0;
  return Math.min(1, Math.max(0, raw));
}

export function coerceRoomProposal(payload: unknown, options: CoerceOptions): RoomProposal {
  const { photoIds, workflow, confidenceThreshold } = options;
  const limit = maxOverviewPhotos(workflow);
  const source = (payload ?? {}) as { rooms?: unknown; unsure?: unknown };

  const claimed = new Set<string>();
  const rooms: ProposedRoom[] = [];
  const unsure = new Set<string>(refsToIds(source.unsure, photoIds));

  const rawRooms = Array.isArray(source.rooms) ? source.rooms : [];
  const order = new Map(photoIds.map((id, index) => [id, index] as const));

  for (const entry of rawRooms) {
    const room = (entry ?? {}) as Record<string, unknown>;
    const label = canonicalLabel(room["label"], workflow);
    const ids = refsToIds(room["photoRefs"], photoIds).filter(
      (id) => !claimed.has(id) && !unsure.has(id),
    );
    if (label === "" || ids.length === 0) {
      // A room with no title or no photographs is not a room. Its photographs
      // go to "Not sure" rather than being guessed into another room.
      for (const id of ids) unsure.add(id);
      continue;
    }
    for (const id of ids) claimed.add(id);
    ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

    const overviewPhotoIds = refsToIds(room["overviewRefs"], photoIds)
      .filter((id) => ids.includes(id))
      .slice(0, limit);
    const confidence = confidenceOf(room["confidence"]);

    rooms.push({
      label,
      photoIds: ids,
      overviewPhotoIds,
      confidence,
      reason: typeof room["reason"] === "string" ? (room["reason"] as string).trim() : "",
      lowConfidence: confidence < confidenceThreshold,
    });
  }

  // Anything the model never mentioned is held back too — never dropped.
  for (const id of photoIds) {
    if (!claimed.has(id)) unsure.add(id);
  }

  return {
    rooms,
    unsure: photoIds.filter((id) => unsure.has(id) && !claimed.has(id)),
  };
}

/** Prompt text. Built entirely from the template's workflow, never hardcoded. */
export function roomSuggestionPrompt(
  workflow: PhotoWorkflow,
  input: { count: number; roomsSoFar: string[] },
): { system: string; user: string } {
  const limit = maxOverviewPhotos(workflow);
  const suggestions = workflow.sectionSuggestions ?? [];

  const system = [
    "You group photographs of a property into the sections they were taken in.",
    "The photographs are given in the order they were taken, numbered from 1.",
    "A section normally starts with wide shots that establish the space, then close shots of individual items in it.",
    `Choose up to ${limit} of each section's photographs as its overview photographs — the wide shots that best show the whole space.`,
    suggestions.length > 0
      ? `Use one of these section titles wherever it fits: ${suggestions.join(", ")}. Only invent a title when none of them fits.`
      : "Use a short, plain title for each section.",
    "Describe conditions and spaces only. Never describe, identify, count or characterise a person.",
    "If you are not sure which section a photograph belongs to, list its number in `unsure`. An honest `unsure` is better than a guess.",
    "Never put the same photograph in two sections. Never create a section with no photographs.",
    "Give each section a confidence between 0 and 1 and a short reason naming what you saw.",
  ].join(" ");

  const user = [
    `There are ${input.count} photographs, numbered 1 to ${input.count} in the order they were taken.`,
    input.roomsSoFar.length > 0
      ? `Sections already identified earlier in this property: ${input.roomsSoFar.join(", ")}. Reuse a title only if these photographs are genuinely the same space; otherwise start a new section.`
      : "",
    "Return the sections in the order the photographs were taken.",
  ]
    .filter((line) => line !== "")
    .join(" ");

  return { system, user };
}

export const ROOM_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rooms", "unsure"],
  properties: {
    rooms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "photoRefs", "overviewRefs", "confidence", "reason"],
        properties: {
          label: { type: "string" },
          photoRefs: { type: "array", items: { type: "integer" } },
          overviewRefs: { type: "array", items: { type: "integer" } },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
    unsure: { type: "array", items: { type: "integer" } },
  },
} as const;

/** Merges batched answers, keeping photograph order and room order. */
export function mergeProposals(parts: RoomProposal[]): RoomProposal {
  const rooms: ProposedRoom[] = [];
  const unsure: string[] = [];
  for (const part of parts) {
    for (const room of part.rooms) {
      const existing = rooms.find(
        (candidate) => candidate.label.toLowerCase() === room.label.toLowerCase(),
      );
      if (existing) {
        existing.photoIds.push(...room.photoIds.filter((id) => !existing.photoIds.includes(id)));
        existing.lowConfidence = existing.lowConfidence || room.lowConfidence;
        continue;
      }
      rooms.push({ ...room, photoIds: [...room.photoIds] });
    }
    unsure.push(...part.unsure.filter((id) => !unsure.includes(id)));
  }
  const claimed = new Set(rooms.flatMap((room) => room.photoIds));
  return { rooms, unsure: unsure.filter((id) => !claimed.has(id)) };
}

export type ApplyBatch = { ids: string[]; patch: Record<string, string> };

/**
 * The write plan for an accepted proposal, built and validated before anything
 * is written. If the plan is not sound nothing is attempted, so a bad proposal
 * can never be half-applied.
 */
export function roomApplyPlan(
  accepted: Array<{ label: string; photoIds: string[]; overviewPhotoIds: string[] }>,
  workflow: PhotoWorkflow,
  startAt: number,
): ApplyBatch[] {
  const limit = maxOverviewPhotos(workflow);
  const seen = new Set<string>();
  const labels = new Set<string>();
  const batches: ApplyBatch[] = [];

  accepted.forEach((room, index) => {
    const label = room.label.trim();
    if (label === "") throw new Error("Every room needs a title.");
    const key = label.toLowerCase();
    if (labels.has(key)) throw new Error(`There is more than one room called ${label}.`);
    labels.add(key);
    if (room.photoIds.length === 0) throw new Error(`${label} has no photographs.`);
    for (const id of room.photoIds) {
      if (seen.has(id)) throw new Error("A photograph cannot be in two rooms.");
      seen.add(id);
    }

    const overview = room.overviewPhotoIds
      .filter((id) => room.photoIds.includes(id))
      .slice(0, limit);
    const items = room.photoIds.filter((id) => !overview.includes(id));
    const allocation = allocateToRoomFields(workflow, label, startAt + index);
    if (items.length > 0) batches.push({ ids: items, patch: allocation });
    if (overview.length > 0) {
      batches.push({
        ids: overview,
        patch: { ...allocation, ...markAsRoomHeaderFields(workflow) },
      });
    }
  });

  return batches;
}
