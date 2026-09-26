# One capture process everywhere, with time and location on every shot

## What you'll get
1. **Time and location on in-app camera shots.** Each shot records the exact time it was taken. If you allow location, it also records where it was taken. These go into the same photo details as gallery photos, so reports, the photograph pages and the provenance record show them the same way. If you refuse location or there's no signal, the photo still saves with the time only and says "Location not recorded". It never guesses.
2. **The same capture process on every photo screen:**
   - Report photos (every report type). These already use it.
   - Weekly Compliance Register check photos
   - Trade close-out photos sent from a subcontractor's link
   - Report title-page photo and logo picker
   - Directory company logo (this only gets the same button styling, because a logo isn't a site photo)

   Every screen gets the same **Take photo** button, which opens the in-app camera that stays open between shots, plus a secondary **Add photos** button and "Choose from Photos". Every screen gets the same background upload with a "N taken · M uploaded" counter. Photos keep the order you took or picked them in. Every screen gets the same "Try again" for failed uploads and the same Android fix for files that can't be read. Where a screen needs only one photo (a single compliance check, a close-out, the title page), the camera closes after one shot.
3. "Analyse as I shoot" stays only where analysis applies. It stays off for Property inventory and anywhere photos aren't analysed.

## Technical details
- `continuous-camera.tsx`: when the camera opens, start `navigator.geolocation.watchPosition` (high accuracy) and stamp each shot with `capturedAt = new Date()` and the latest fix, if it's under 2 minutes old, along with its accuracy. Pass this metadata alongside the File. EXIF is not rewritten.
- `photo-service.ts` `uploadPhoto`: take an optional `provenance` override. EXIF still wins when present; otherwise it uses the camera metadata for `captured_at`, `gps_lat` and `gps_lng`, and stores the source (`exif` | `device`) and accuracy in `capture_fields`. This uses existing columns, so no migration is needed.
- New shared `usePhotoCapture({ single, onFiles })` hook plus the existing `PhotoCaptureActions` and `ContinuousCamera`. It wraps file snapshotting, upload-queue sequence reservation and retry. The compliance run page, `trade.$token.tsx` and `cover-branding-fields.tsx` replace their bare `<input type=file capture>` with it. The trade page runs without a sign-in, so it uploads through its existing token path. Only the UI and file-handling process are shared.
- Thumbnail and analysis paths stay separate, and full resolution is still used for analysis.
- Tests: provenance precedence (EXIF over device), no location when permission is denied, and single-shot mode closing after one photo.

---

# Part 2: One report brand everywhere (instructBrain)

## What you'll get
- Every report looks the same wherever you see it: while you create it, in Review, on the report page, through a shared link, as a downloaded PDF and in Print. This covers all report types, including Property inventory and the Weekly Compliance Register packs.
- The only brand wording on reports is one faint footer on every page: **instructBrain · AN INSTRUCTSITE COMPANY**. There's no "instructSite family" wording and no other instructSite mentions on reports.
- Subtle orange touches, on a white page with black text so it stays professional and readable:
  - a thin orange rule under the report header and at the top of the cover page
  - small orange section labels above headings, such as "FINDINGS" or "ROOM 3"
  - an orange left edge on table headers and on the numbered photo tags
  - Condition and status colours don't change, and each one still shows its word next to it.
- The AI's writing instructions currently call it the "instructSite Oracle". That becomes "instructBrain". The wording of findings doesn't change.

## Technical details
- One shared report brand module (colours, footer text, rule widths) is used by the on-screen `.paper` preview, the print page, the shared link page and the PDF builders (standard and inventory landscape). Their separate copies of the header and footer are removed.
- `BRAND_CREDIT` becomes "instructBrain · AN INSTRUCTSITE COMPANY". It's shown at about 55% opacity in small caps in every page footer.
- A new `--paper-accent` token uses the brand orange, for borders and rules only. Where it appears as text it uses the darker orange text token, so it passes WCAG AA on white.
- A test scans the report, PDF and share output for "family" or any other "instructSite" wording outside the footer credit.
- The contact email and code comments are unchanged.
