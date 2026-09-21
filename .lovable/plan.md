# Property inventory workflow: AI wording, export checklist, and photo ordering

This plan builds on the Property inventory work already in progress and keeps the changes scoped to the inventory workflow unless a shared control needs to call the same report checks.

## What surveyors will be able to do

1. **Add a free-text instruction or room note**
   - On a Property inventory report, the surveyor can enter a short note for the current room or selected inventory item photos.
   - A new **Suggest wording** action uses AI Gateway to draft consistent:
     - item descriptions,
     - condition wording,
     - check-out comments.
   - The suggestion is shown for review and must be accepted by the surveyor before it changes the report.
   - Nothing sends automatically, and AI failures still become a safe unresolved state rather than being treated as acceptable.

2. **Check the report before export**
   - Before a PDF is downloaded, printed, or issued, the app shows a checklist for Property inventory reports.
   - It flags:
     - missing title-page photo,
     - any room with fewer than three overview photos,
     - unreviewed findings,
     - incomplete report fields such as title, date, client/property details where available.
   - Blocking items must be resolved before the final PDF is generated.
   - Non-blocking warnings can be shown clearly so the user understands what will appear in the report.

3. **Arrange photos before generating the report**
   - Surveyors can reorder uploaded photos by drag-and-drop.
   - They can assign photos to rooms and mark each as:
     - exterior/title-page photo,
     - room overview photo,
     - inventory item photo.
   - The report uses the saved order as the source of truth for:
     - room order,
     - overview photo order,
     - item row order,
     - rear appendix photo order.
   - Mobile keeps simple controls as well, so it remains usable on site with gloves or poor weather.

## AI Gateway behaviour

- Add a server-side AI Gateway function for wording suggestions only.
- Use the current default AI Gateway chat model and keep the API key server-side.
- The model receives only the room note, existing item/photo text, allowed inventory statuses, and the frozen report template snapshot.
- The model returns structured suggestions; the app validates them before showing anything to the user.
- Gateway failures surface the safe error message in the UI and do not overwrite human-entered text.

## Pre-export checklist behaviour

- Add one shared checklist function that reads the assembled report document.
- For Property inventory, it checks the title-page photo, room overview counts, unreviewed findings, and required report fields.
- Wire it into the visible export actions so the user sees problems before generating the PDF.
- Keep the server-side PDF function protected too, so checklist bypasses cannot generate an incomplete inventory export.

## Drag-and-drop and room assignment

- Use the existing persisted `sequence` field on photos for ordering.
- Add an audited reorder update that writes new sequence values without changing stable finding references.
- Keep keyboard-accessible move controls alongside drag-and-drop.
- Improve the current room workflow so a user can capture:

```text
Exterior
Living room: 3 overview photos, then item photos
Kitchen: 3 overview photos, then item photos
Dining room: 3 overview photos, then item photos
```

- Preserve title-page selection after reordering.

## What this will not affect

This must not change:

- Snagging, Site condition, Weatherproofing, Electrical, Mechanical, Damp, Fit-out, or basic photo reports.
- Weekly Compliance Registers.
- Existing issued report snapshots.
- Full-resolution image handling for analysis.
- Stable finding references.
- The rule that AI errors or uncertainty become **Not assessed**, never a pass.
- Distribution rules or automatic sending.
- The light working-screen direction and mobile-first capture layout.

## Technical notes

- Add a new AI Gateway server function in a client-safe functions module, with server-only helper logic for the actual Gateway call.
- Use strict structured output for suggestions and validate/clamp returned rows before applying them.
- Extend photo services with a reorder function that updates `photos.sequence` for the report's own photos only.
- Update the photo grid/panel with drag handles, room assignment controls, and accessible move buttons.
- Add a pre-export checklist module and call it from report actions and the PDF download function.
- Continue the inventory landscape PDF work already underway: table photo references, rear appendix photos in upload order, and definition-driven backing pages.
- Add tests for AI suggestion validation, checklist blockers, reorder persistence, room overview counting, and unchanged non-inventory report output.

## Expected result

A surveyor can upload a whole inventory, arrange it room-by-room, get AI wording help from their own notes, pass a clear checklist, and then generate a landscape report matching the uploaded sample format without affecting the rest of instructBrain.
