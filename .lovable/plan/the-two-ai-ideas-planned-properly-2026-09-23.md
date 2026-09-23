# The two AI ideas, planned properly

Property inventory only. Both are suggestions a person accepts — nothing is applied on its own.

## Idea 1 — Suggest the rooms (the one worth building)

Today you upload the photographs, then create every room by hand and post each batch into it. On a
three-bed flat that is fine; on a six-bedroom house with 140 photographs it is the slow part of the job.

**What you'll see**

1. Upload the photographs as now.
2. A quiet second button next to "Create room": **Suggest rooms**. Nothing happens until you press it.
3. It thinks for a few seconds, then shows a **proposal you can read before anything changes**:
   - the rooms it thinks it can see, in the order the photographs were taken;
   - for each room, which photographs belong to it, and which three it would use as the room
     overview photographs;
   - photographs it is not sure about, held back in a "Not sure" group rather than guessed into a room;
   - a short reason per room ("wide shots of a tiled room with a bath, then taps, sealant, extractor").
4. Every row has a room dropdown, so you can move a photograph before accepting. You can rename a
   suggested room, delete a suggested room, or accept only some of them.
5. **Apply suggestions** writes it. Until you press that, your existing rooms are untouched.
6. After applying, every room is a normal room — rename, reorder, remove, change the overview
   photographs exactly as now.

**When it gets a room wrong**

- Nothing is destroyed: applying only fills in room titles and roles on photographs. Wrong room →
  select the photographs and use "Add to room", as today. Wrong overview photograph → tap
  "Item photo" on it and tap another.
- It never merges two rooms it isn't confident are the same, and it never invents a room with no
  photographs.
- A suggestion it isn't confident about goes to "Not sure", never into the nearest room.
- If the suggestion run fails or times out, you get a plain message and the manual flow, unchanged.
  It never half-applies: either the whole accepted proposal is written or none of it is.
- Suggested rooms stay visibly marked as suggestions until you apply them.

**Room titles** come from the template's own suggestion list first (Porch, Hallway, Kitchen…), so the
report reads consistently; it only proposes a title of its own when nothing on the list fits.

## Idea 2 — Draft the findings earlier (small, optional)

This one is mostly what the app already does — "Draft the findings" already writes the item,
description and condition for each item photograph. The only real gain is *when* it is offered:
today it waits until the photographs are organised, so on site you sit and wait at the end.

Proposed change, deliberately small:

- Once a room has been given item photographs, offer **Draft this room's findings** on that room.
- Rooms drafted as you go, so by the time the last room is allocated most of the report is written.
- Same rules as now: every line is marked as a draft with its reasoning, anything the model is
  unsure of is recorded as **Not assessed** and blocks issuing until you resolve it, and overview
  and title-page photographs are never analysed.
- No new wording, no new statuses, no change to the report itself.

I would build idea 1 first and treat idea 2 as a follow-on — it is a convenience, not a capability.

## What does not change

Other report templates, the compliance register, issued reports and their snapshots, distribution,
the landscape inventory output, full-resolution photographs to the AI, stable photograph reference
numbers, and the external Supabase setup. No database migration, no new definition version.

## Technical notes

- New server function `suggestRooms` in `src/lib/photos/rooms.functions.ts` behind
  `requireSupabaseAuth`, calling the Lovable AI Gateway server-side with `openai/gpt-6-astra` on
  `/v1/responses` (streamed, consumed in the handler, no timer abort). Returns a proposal object
  only — it performs **no writes**.
- Input: the report's photographs in persisted `sequence` order, each with a signed full-resolution
  URL from `analysisSourceFor` (invariant 3 — never a thumbnail), batched to respect the image-per-
  request cap, with earlier batches' room list carried forward as text so room boundaries hold
  across batches.
- Strict structured output: rooms with `label`, `photoIds`, `overviewPhotoIds` (≤ workflow limit),
  `confidence`, `reason`, plus a top-level `unsure: string[]`. Below the configured confidence
  threshold a photograph goes to `unsure`; a room below threshold is returned marked low-confidence
  and never pre-ticked.
- No room name, role id or discipline word in shared code: titles are matched against
  `workflow.sectionSuggestions` and the prompt is built from the template's photo workflow
  (invariant 5). Nothing new is hardcoded in `rooms.ts` or the organiser.
- Applying reuses the existing `allocateToRoomFields` / `markAsRoomHeaderFields` /
  `roomOrderFields` patches through the organiser's existing `onApply`, in one pass per room, so
  `ref`, `sequence` and capture-field storage are unchanged.
- New `src/components/photos/room-suggestions.tsx` — a real dialog (no native prompts), 44px+
  targets, keyboard reachable, room dropdowns per photograph, per-room accept toggles.
- Idea 2 adds a per-room trigger to the existing analysis run in `use-analysis-run.ts`, scoped to
  that room's item photographs; concurrency, caching, retries and `not_assessed` coercion unchanged.
- Tests: proposal never writes; low confidence lands in "Not sure" and never in a room; overview
  suggestions capped at the workflow limit; suggested titles prefer the template list; apply is
  all-or-nothing; a failed run leaves rooms untouched; gateway failure surfaces a plain message;
  non-inventory templates see no new controls. Full suite run before and after.
