# Unidentified item reviewer

Today you can find items the AI could not assess, but you cannot fix their wording. This adds a quick way to work through them and name them properly.

## What you will get

1. **"Unidentified items" filter** in Review — one tap shows only the findings still marked Not assessed, with a count ("3 left"). Clears itself when all are resolved.
2. **Editable item name and description** on each finding card. Type "Radiator valve" over "Unidentified item" and the Item column in the PDF uses it. On templates without an item column, only the description is editable.
3. **Set the condition** directly on the card using that template's own status list (for example Good / Fair / Poor). Choosing one resolves the Not assessed block for that item.
4. **Save and next** — moves straight to the next unidentified item, so a batch can be cleared in one pass. Keyboard: N for next, E to edit.
5. Edited findings are marked "Edited by you" so the record shows a person changed the AI's wording; the AI's original output is kept.

## What does not change

- Not assessed still blocks issue until every one is resolved by a person — nothing is auto-filled.
- Issued reports stay locked; editing is only available before issue (or after Reopen).
- Other report templates keep their current layout; the filter simply shows their Not assessed findings.
- No database changes.

## Technical details

- `review-list.tsx`: add filter state (`unresolvedOnly`), inline editors for `finding_text` and, when the snapshot declares an `item` capture field, `capture_fields.item`; status select from `statusesOf(snapshot)` (never hardcoded ids).
- Save through the existing `FindingPatch` (`finding_text`, `capture_fields`, `status_id`, `human_edited: true`); `ai_raw_output` untouched.
- `inventory-layout.ts`: when a human-set label exists, use it even if the original status was not_assessed and it is now resolved (current forced "Unidentified item" applies only while still not_assessed).
- Tests: edited label reaches the Item column; still-not-assessed stays "Unidentified item" and blocks export; filter count; no hardcoded status ids.
