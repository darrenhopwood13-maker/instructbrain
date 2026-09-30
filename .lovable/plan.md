# Manual photographic report: no confirming, and a proper markup editor

## 1. No confirmation step
In the no-AI photographic report, the photos and wording are the user's own, so nothing needs confirming.
- Every photo item counts as done the moment it is uploaded, whether or not it has a description yet.
- Review no longer shows "unconfirmed" warnings or blocks Issue for this report type.
- The "Continue to issue" prompt appears as soon as there is at least one photo.
- Other report types keep their confirmation rules exactly as now.

## 2. Markup editor rebuilt
Today you add a shape in a fixed spot and nudge it with sliders. The new editor works like a normal drawing app:

- **Draw directly on the photo**: pick a tool, then drag on the photo to draw an arrow, rectangle, circle or line where you want it. Tap with the Text or Speech tool to place a label, and type straight away.
- **Move and resize by touch**: drag any shape to move it. Drag its corner handles to resize it, or drag either end of an arrow. Works with a finger, a stylus or a mouse.
- **More tools**: straight line, freehand pen, and a numbered marker (1, 2, 3…) as well as the existing text, arrow, rectangle, circle and speech bubble.
- **Style controls**: large colour swatches instead of a dropdown, three line thicknesses and three text sizes. Text and speech bubbles get a solid backing so they are readable on busy photos.
- **Full-screen on phones**: the photo fills the screen, with a tool bar at the bottom within thumb reach and 44px buttons. The description box sits below the photo. On desktop the tools sit beside the photo.
- **Undo, redo, delete, and duplicate** for the selected shape. Unsaved changes prompt before closing.
- **Keyboard**: arrow keys move the selected shape (Shift for bigger steps), Delete removes it, Ctrl+Z / Ctrl+Y undo/redo, and Tab moves between shapes.
- The editor uses the full-size photo rather than the small preview, so markup lines up precisely.
- Markup looks the same in the editor, the report preview, the shared link and the PDF.

## What doesn't change
- The original photo is never altered. Markup is stored separately and drawn on top.
- Item numbers never change. Issuing and sharing are still done only by you.
- No AI anywhere in this template.

## Technical notes
- `issueBlockers` / step state: when `isManualOnly(snapshot)`, ignore unconfirmed items; `ensureManualPhotoItem` and save set `confirmed_at`/`confirmed_by` on creation so existing data paths agree. Backfill existing manual items on open (idempotent). No migration.
- `markup.ts`: extend kinds with `line`, `pen` (normalised point list, capped), `marker` (number); add optional `stroke` (s/m/l) and `size` (s/m/l). `coerceMarkup` stays backward compatible: old layers default to medium; unknown kinds dropped.
- Rewrite `photo-markup.tsx` with pointer events (pointer capture, normalised coords from the image box), selection handles, inline text editing, and a mobile full-screen layout. Keep it dependency-free SVG.
- Update `photo-markup-overlay.tsx` and the PDF `drawMarkup` in `pdf.server.ts` for the new kinds, stroke widths and text backing.
- Server validation in `manual-report.functions.ts` accepts the extended schema.
- Tests: coercion of new/old layers, manual reports never report unconfirmed blockers, other templates still do, PDF renders new kinds. Run the full suite before and after, and check at 375px.
