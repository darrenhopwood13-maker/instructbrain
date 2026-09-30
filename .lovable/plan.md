# Manual photographic report

## Outcome
Add a new **Manual photographic report** template. It keeps the current title page and issue flow, but never invokes AI. Each uploaded photograph has a manual description and an editable markup layer for text, arrows, rectangles, circles and speech bubbles.

## Build
- Add a versioned, snapshot-driven `manualOnly` template without changing existing report types.
- Create one stable report item per photograph and store the person’s description separately from the original image.
- Provide a keyboard-accessible photo editor with undo/redo, colour choice, positioning, text and shape tools.
- Enforce no-AI behavior in both the screen workflow and server-side analysis, summary and translation paths.
- Include saved markup in report preview, print, PDF, read-only sharing and issued-version snapshots.
- Keep issue and sharing as explicit human actions; nothing sends automatically.

## Data and security
- Use the new organisation-scoped `photo_markups` table with RLS, role-based write access and database validation that each markup row matches its photograph and report.
- Keep normalized vector coordinates so markup remains editable and scales consistently without modifying original photographs.

## Verification
- Run the existing test suite before and after the change, add focused tests for manual-only behavior and markup coercion, and verify desktop and 375px layouts.
- Confirm other templates keep their existing AI and report behavior.