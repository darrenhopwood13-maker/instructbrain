# Rooms: name each room once, in one place

## What's wrong today
In a Property inventory report you can be asked for a room in four separate places:

1. **When adding photos** – a room box plus a "Next photographs: overview / item" choice above the upload buttons.
2. **When you tap a photo** – the edit screen has its own room box.
3. **Create room** – a pop-up where you type the room name.
4. **Add to room** – a second pop-up where you pick the room again.

So the same room gets typed or picked more than once, and it isn't clear which place actually counts.

## The new flow (one way to do it)

```text
Add photos  ->  tick photos  ->  "Put in a room"  ->  tap a room or type a new name  ->  done
                                                   (the room is created and the photos go in)
Inside each room: tap "Overview" on up to 3 photos
```

- **Adding photos:** the room box and the overview/item choice are gone. Photos just upload in order into "Not in a room".
- **Tapping a photo:** the room box is removed from the edit screen. To move a photo, tick it and use "Put in a room".
- **One "Put in a room" sheet** replaces both Create room and Add to room. It shows your existing rooms as big buttons, then a "New room" name box with common room names to tap. Picking or naming a room puts the ticked photos in straight away. There's no second confirm step.
- **Overview photos:** chosen inside the room card, as now. Nothing is made an overview automatically. A room with no overview yet shows "Tap Overview on up to 3 photos".
- **Suggest rooms** stays as it is. Its Apply is still the one confirmation, because it moves many photos at once.
- **Each room card** keeps Rename, Move up/down and Remove. The per-room "Add here" button stays as a shortcut when photos are ticked.
- **Start of the report:** nothing asks for a room.
- Instructions are cut down to one line: "Tick photos, then Put in a room. Tap Overview on up to 3 per room."

## What does not change
- Photo order, numbering, the title-page photo, the landscape PDF layout, and room overviews not being analysed.
- Other report types. The room box only appears for Property inventory, and they're unaffected.
- Photos already in rooms stay where they are.

## Technical details
- `photos-panel.tsx`: for inventory templates, hide the section-field input in the upload zone (`zoneFields`) and the "Next photographs" select. Uploads always use the detail role with an empty section. In the photo edit dialog, filter out `workflow.sectionField` (and the role field) for inventory.
- `room-organiser.tsx`: merge `createOpen` and `addOpen` into one `PutInRoomSheet`: existing-room buttons, then a title input with suggestion chips. It calls the existing allocate/create logic with the ticked `selectedIds`. Remove the separate "Create room" header button; the primary header button becomes "Put N in a room" (disabled when nothing is ticked). Allow an empty-room draft only through this sheet. Keep rename/delete/move dialogs.
- No data model or migration changes; rooms remain derived from `capture_fields[sectionField]`.
- Update `inventory-readiness` / room tests for the removed upload-time room entry; add a test that one sheet action creates the room and allocates the photos.
