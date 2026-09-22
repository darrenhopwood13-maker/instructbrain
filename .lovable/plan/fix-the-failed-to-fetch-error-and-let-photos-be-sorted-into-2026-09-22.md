# Fix the "Failed to fetch" error, and let photos be sorted into rooms after upload

## Part 1 — the "Failed to fetch" error

Tapping **Take photo** first creates the report record and saves the cover photo and logo. Both need a live connection. On a weak site signal one of them fails, the phone shows the bare browser message **"Failed to fetch"**, and the whole attempt is thrown away — no report, and the photographs you just chose are gone.

What will change:

- Plain message instead of "Failed to fetch": we could not reach the service, your photographs are still held, try again.
- The chosen photographs stay held, with a **Try again** action that resumes with the same photographs, brief and cover — no re-picking.
- Short automatic retries first, so a momentary signal drop is invisible.
- If the phone is offline, say so instead of attempting and failing.
- Cover photo and logo become non-blocking: if the report is created but the cover upload fails, the report is kept and the title page can be set later.

## Part 2 — rooms after upload (Property inventory)

The flow becomes: upload all the photographs, then sort them into rooms, then pick the three header photographs for each room.

On the inventory report screen, after photographs are uploaded:

- **Create a room** and give it a title you type yourself (Living room, Kitchen, Master bedroom, En-suite…). One report holds as many rooms as you like.
- **Allocate photographs to a room** by selecting them in the grid and choosing the room. A photograph can be moved between rooms, and un-allocated photographs are shown clearly so none is forgotten.
- **Choose up to three room photographs** per room. These are marked as room header photographs, are **not analysed by the AI**, and appear at the top of that room's page in the report.
- Everything else allocated to the room stays an item photograph and is analysed, one inventory row each.
- Rename a room, reorder rooms, and delete a room (its photographs return to un-allocated rather than being deleted).
- Order within a room follows the order you added the photographs, as now.

In the generated landscape report, nothing about the format changes: each room page shows its three header photographs, then the Item / Description / Condition / Check Out Comment table, with numbered references to the item photographs at the rear, followed by the backing pages.

## What stays exactly as it is

- The report row is still created on the first photograph, never on arrival.
- Photograph order still follows the order you selected them.
- Full-resolution photographs still reach the AI; nothing is downscaled.
- Title-page/exterior photograph still excluded from analysis.
- No change to other report templates, compliance registers, issued reports, distribution rules, or the external Supabase setup.

## Technical notes

- Capture start: route the error through the existing plain-language network translation, add a bounded retry (2 retries, short backoff) for network-class failures only — never for plan-limit or permission errors — hold the snapshotted files in a ref and expose a retry of the same payload. Move `applyBranding` out of the create mutation's failure path and surface a soft warning if it fails.
- Rooms: keep using the existing photo `capture_fields` (`room`, `_photo_role`) as the store — no migration. Room titles and order come from the distinct `room` values ordered by first photo `sequence`, with an explicit order key written into `capture_fields` so a room can be moved.
- Room assignment writes through the existing `updateCaptureFields` batch update; header photographs set `_photo_role: "room_overview"` (max three, enforced in the UI and in the workflow definition), item photographs set `inventory_detail`.
- Analysis exclusion already flows from the definition (`photoExcludesFromAnalysis`); no discipline words enter shared code.
- Room UI lives in the inventory workflow section of the photos panel: dropdown room picker, multi-select on the grid, 44px+ targets, keyboard reachable, real dialogs for rename/delete.
- Report assembly keeps using `inventoryRooms`/`inventoryAppendixEntries`, which already read room and role from capture fields.

## Verification

- Network-class failure yields the plain message and preserves the held files; plan-limit errors are not retried; a failing cover upload still leaves a usable report.
- Tests for: allocating photographs to several rooms, room order from first photo sequence, at most three header photographs per room, header photographs excluded from analysis, item photographs producing one row each with matching rear photo references, deleting a room returning its photographs to un-allocated, and non-inventory templates unchanged.
- Full suite run before and after.
