# Title page photo and logo when creating a report

When creating a report — Custom Reports **and** Project reports — a new **Cover & branding** step appears after the report parameters. The user can add a title page photo and see the company logo the report will carry.

## What you'll see

1. Create a report as usual (choose template, parameters, brief).
2. A new **Cover & branding** section appears before the start button:
   - **Title page photo** — optionally upload a dedicated cover image. If you skip it, you can pick any report photo as the cover later, and the cover falls back to the first photo as it does today.
   - **Company logo** — shows your organisation's saved logo (from Settings). An optional "Use a different logo for this report" upload overrides it for this report only; the organisation default is unchanged.
3. In the report itself, a **"Use as cover"** action on any photo lets you switch the cover to a photo from the job — the "allow either" half of the request.
4. The issued document and PDF use the report's own logo if one was set, otherwise the organisation logo. Nothing else about the cover or document layout changes.

## What stays exactly as it is

Templates, briefs, parameters, photo upload/analysis, review, compliance registers, distribution, share links, and all existing reports. The organisation logo setting in Settings is untouched. Skipping the whole section is always allowed — everything in it is optional.

---

## Technical detail

**Database (one migration)**
- `reports` gains `logo_path text null` — a per-report logo override. No new table. Existing rows stay null, meaning "use the organisation logo", so nothing changes for existing reports.

**Storage**
- Dedicated cover uploads and per-report logos go to the existing private photos bucket under `<org>/<report>/branding/<filename>`, using the existing storage policies (already org-scoped). No new bucket, no new policies.

**Data layer**
- `src/lib/report/report-data.ts` and `src/lib/report/document.server.ts`: the report query selects `logo_path`; document assembly resolves the logo as report override → organisation logo → none, and signs whichever path wins. Shared/trade document routes already follow the same assembly, so they inherit the behaviour.
- `createReport` in `src/lib/data.ts` accepts an optional `logoPath` and `coverPath` (dedicated cover upload). A dedicated cover upload is stored as a photo row flagged as the cover (`cover_photo_id` set at creation); it is not part of analysis.
- A `setCoverPhoto(reportId, photoId)` mutation — sets `cover_photo_id` to any existing photo row.

**UI**
- `src/routes/_authenticated/reports.new.tsx` (Project reports) and `src/routes/_authenticated/reports.quick.tsx` (Custom Reports): a Cover & branding section after the parameters — cover image upload (file input with preview, remove button), and the organisation logo shown with an optional override upload (with preview and revert-to-default). Both use the existing upload plumbing; keyboard reachable, 44px targets, no native dialogs.
- `src/components/photos/photo-grid.tsx` (or the photos panel): "Use as cover" action per photo, visible in the report; sets the cover via the new mutation with a toast confirmation.

**Tests**
- Logo resolution order: report override beats organisation logo; null override falls back to organisation.
- `setCoverPhoto` sets `cover_photo_id` and never renumbers refs (invariant 4).
- createReport with a branding upload stores the file under the report's path and leaves analysis untouched (full-resolution analysis path unchanged — invariant 3).
- Existing document/PDF tests re-run unchanged.

**Explicitly not in scope:** changing the document/PDF layout, removing the Settings → Organisation logo, or any migration of existing reports.
