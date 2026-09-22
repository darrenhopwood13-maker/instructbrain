# Easier room allocation, and every photo shown in its room

Property inventory only. Nothing else changes.

## The workflow you'll get

1. **Upload all the photographs** exactly as now, in the order you took them.
2. **Create your rooms one by one** — a "Create room" button that no longer needs photographs selected first. Tap it, pick from a suggested list (Porch, Hallway, Storage cupboard, Living room, Dining room, Kitchen, Conservatory, Stairs, Landing, Bathroom, Bedroom, Ensuite, Toilet, Loft room) or type your own, and the room appears in the list even while empty.
3. **Allocate photographs**: select several photographs in the grid, tap **Add to room**, and choose the room from a dropdown of the rooms you created. Repeat until nothing is left in "not in a room yet".
4. **Pick the 3 room overview photographs**: inside each room, tap up to three of its photographs to become that room's header photographs. They are not analysed by the AI.
5. **Title-page photograph is unchanged** — still chosen separately and still excluded from analysis.

Rooms can still be renamed, reordered and removed, and removing a room returns its photographs to the un-allocated list rather than deleting them.

## The generated report

- Every page of the issued/downloaded PDF stays landscape — cover, index, room pages, photograph pages and backing pages.
- Each room page shows: room title, the three overview photographs, then the four-column table (Item / Description / Condition / Check Out Comment).
- **Change:** each room's item photographs are now shown inside that room's own section, immediately after its table, numbered to match the photo references in the rows — instead of being pooled into one report-wide photograph appendix.
- Any photograph not allocated to a room still appears in a final "Photographs not in a room" section so nothing is silently dropped.
- Room order, photo order within a room, table rows and reference numbers all follow the saved selection order.

## Technical notes

- Room membership and the room header role continue to live in existing photo capture fields (`room`, `_photo_role`, `_room_order`) via `src/lib/photos/rooms.ts` — no schema change.
- Empty rooms have no photographs to store, so newly created room titles are held per report in browser storage and merged into the room list from `groupPhotosByRoom` until a photograph is allocated.
- `src/components/photos/room-organiser.tsx`: create-room dialog gains a suggestion picker and works with zero selection; a new "Add to room" control with a room dropdown replaces the per-room "Add N here" buttons.
- Suggested room names come from the survey type definition (new Property inventory definition version with a `roomSuggestions` list on the photo workflow), never hardcoded in shared components — this needs one small external-Supabase definition insert, leaving earlier versions inactive and issued snapshots untouched.
- `src/lib/report/inventory-layout.ts`: replace the single `inventoryAppendixEntries` list with per-room item-photograph entries plus an un-allocated remainder; `src/lib/report/pdf.server.ts` renders those inside each room section and keeps every page landscape Letter.
- Tests: room creation without selection, allocation via dropdown, three-header limit, per-room photograph sections in room order, references matching, every page landscape, other report types unchanged. Full suite run before and after.
