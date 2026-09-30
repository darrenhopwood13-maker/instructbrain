# Fix manual photographic reports: photos into the report, and markup you can find

## What's wrong
- In the manual (no-AI) report, a photograph only becomes a report item the first time someone opens it in the markup editor. Uploading alone never creates the item, so Review and the report show only the title page.
- The markup editor only opens by tapping a photo thumbnail on the Photos step. There is no visible button, and nothing on the Review step, so the markup tools look missing.

## What will change
1. **Every uploaded photo becomes a report item automatically** as soon as its upload finishes, in upload order, with its own permanent reference. Photos already uploaded to existing manual reports are caught up the next time the report opens, so nothing needs re-uploading.
2. **A clear "Describe & mark up" button** appears on every photo, both on the Photos step and on the Review step, opening the editor with its text, arrow, shape and speech-bubble tools and the description box.
3. **The Review step lists every photo** with its description (or "No description yet") and a preview of its markup, so the report builds up as you go.
4. The report preview, PDF and shared link then show each photo with its markup and description after the title page.

## Faster uploads (no-AI reports only)
Right now each photo also gets a second, AI-ready copy made and uploaded, even though this report never uses AI. For manual reports:
- Skip that AI copy completely, so each photo is one full-size upload plus a small preview image.
- Make the small preview on the phone while the full-size photo is uploading, not afterwards.
- Keep 12 photos uploading at once, with the same retries and progress counter.
- Keep the full-size original, the time and location details, and the duplicate-photo check.

## What doesn't change
- No AI is used anywhere in this template. Other report types are untouched.
- Deleting a photo never renumbers the others. Issuing and sharing are still done only by you.

## Technical notes
- `photo-service.ts`: add a `skipAnalysisDerivative` option, set from `isManualOnly(snapshot)`. When it is set, leave `analysis_path` null and run `uploadThumbnail` in parallel with `uploadOriginal`, with the derivative fallback removed. Thumbnail and analysis modules stay separate, and the non-manual path is unchanged.
- Also add roadmap.md entries for both tasks.
- In `photos-panel.tsx`, after each successful upload in the manual case, call `ensureManualPhotoItem`. On load, run a one-time backfill for photos with no linked finding (the call is already idempotent). Then invalidate the report/review queries.
- Add a 44px "Describe & mark up" action on manual-report photo tiles, and a manual review list in `reports.$id.index.tsx` that opens `PhotoMarkupEditor`.
- No migration is needed. `photo_markups` and the server functions already exist.
- Add tests: upload→item creation for manual snapshots only; backfill skips photos that already have an item. Run the full suite before and after.
