# Manual photographic report — no AI

Add a new **Manual photographic report** template that keeps the existing title page, document preview, issuing, sharing and PDF format, but never sends a photograph or report text to AI.

## What you’ll be able to do

1. Choose **Manual photographic report** from the report-template list.
2. Add or take photographs using the existing capture screen.
3. Enter one manual description for each photograph.
4. Open any photograph in a markup editor and add, move, edit or remove:
   - text labels
   - arrows
   - rectangles and circles
   - speech bubbles
5. Review the photographs and wording, then issue the report through the existing title-page, preview, share and PDF journey.

The original photograph remains untouched. Markup is stored separately as editable vector information and is composited only when the report is displayed or produced.

## Workflow

- The report journey becomes **Photos → Review → Issue**, but “Review” means checking the user’s own descriptions and markup, not confirming AI output.
- Each photograph creates exactly one stable report item. Deleting or reordering photographs never renumbers an existing item.
- A description can be added immediately after upload or later from the photograph/editor.
- The markup editor is touch-friendly and keyboard reachable, with 44px controls, undo/redo, delete, colour choice and clear save/cancel actions.
- A user must still press **Issue report**; nothing is sent automatically.

## Absolute AI exclusion

- Add a versioned template capability declaring the report manual-only.
- Hide all analysis, tone, AI summary and AI translation controls for this template.
- Do not start analysis during upload or from navigation parameters.
- Add a server-side guard so even an accidental analysis request exits before any AI provider is called.
- Other report templates and all existing AI behaviour remain unchanged.

## Report output

- Preserve the current cover/title page, organisation branding, report details, issued-version history, sharing and PDF download.
- Show each marked-up photograph with its manual description in the report body.
- Render the same saved vector markup in the working preview, print preview, shared link and downloadable PDF.
- Freeze descriptions and markup into every issued version so old reports never change retrospectively.

## Technical detail

- Add a new versioned `manual_photo_report` survey definition with one item per photograph, manual wording, no trade/lifecycle/severity requirements and a non-passing fallback status.
- Extend the generic definition engine with a `manualOnly` capability; shared upload, analysis, review and output code interprets it without hardcoding discipline wording.
- Add a `photo_markups` table in one external-Supabase migration. It stores organisation/report/photo ownership and validated JSON vector layers, with explicit grants, RLS, organisation-scoped `USING` and `WITH CHECK` policies, timestamps and audit-safe ownership.
- Create one manual finding and `finding_photos` link for every uploaded photograph. Persist the user’s description in the finding, keeping refs immutable and photos many-to-many for every other template.
- Add a small SVG-based markup editor using normalized coordinates, without a heavy drawing dependency or destructive image processing.
- Extend the shared report document model so saved markup flows through current preview, print, share, PDF and issued snapshots.
- Keep original, thumbnail and analysis-image handling separate and unchanged.

## Verification

- Run the existing suite before and after implementation.
- Add tests proving manual reports make zero AI calls, create one stable item per photo, preserve `not_assessed` as the safe fallback, validate markup data and freeze it into issued documents.
- Verify capture, description editing, all markup tools, issue, shared view and PDF output on desktop and at 375px, including keyboard operation and no horizontal overflow.
- Confirm every other template still analyses and issues exactly as before.