# Editable item labels and descriptions in review

Make the Item label and Description editable on Property inventory findings in the existing Review tab, so "Unidentified item" can be renamed by hand without re-running analysis.

## What exists already

- The Review tab (`src/components/review-list.tsx`) shows each finding as read-only cards; only "Likely cause" is editable, via a pop-out textarea with optimistic save, rollback and an error toast.
- The save path (`updateFinding` in `src/lib/report/report-data.ts`) already accepts `finding_text`, `capture_fields` and `human_edited`, with an audit `before` record. No migration needed.
- The Item column, photograph appendix and HTML preview all share `inventoryItemTableLabel`, which prefers `capture_fields["item"]` — so an edited label flows straight into the PDF and preview with no further work.

## Changes

1. **Expose capture fields on findings** — add `captureFields: Record<string, string>` to the `Finding` type and map `capture_fields` in `toFinding` (`src/lib/types.ts`, `src/lib/data.ts`).

2. **Review list (`src/components/review-list.tsx`)**
   - New optional prop `onEdit?: (findingId, patch: { finding_text?: string; capture_fields?: Record<string, string> }) => Promise<void>`.
   - Description card: editable textarea in the pop-out (same pattern as Likely cause), saving `finding_text` with `human_edited: true` set by the caller.
   - Item card: shown only when the template declares the `item` capture field (via `aiCaptureFieldsOf(snapshot)`, i.e. Property inventory). Single-line input saving `capture_fields` with the AI's other declared fields preserved, merged — never replaced wholesale.
   - "Edited by reviewer" badge when `human_edited` is set, keeping the AI-vs-human audit trail visible.
   - Edits use the existing optimistic overlay + rollback + toast; they never change status — resolving a not-assessed item stays the explicit status action.

3. **Wire-up (`src/routes/_authenticated/reports.$id.index.tsx`)** — pass `onEdit` through `updateFinding(id, findingId, patch, before)` with `human_edited: true`, then refresh findings.

## Out of scope

- No database migration, no prompt or engine changes, no other templates.
- The unidentified-item queue remains as it is (sort-to-top + "Go to first unresolved").

## Verification

- Extend the review-confirmation tests: item edit merges capture fields and preserves undeclared keys; description edit writes `finding_text`; `human_edited` set; failed write rolls back.
- Full suite green before and after; typecheck clean.
