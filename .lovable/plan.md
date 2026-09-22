# Photos, PDF saving, and a QA report on the report flow

Three pieces. The first two are small builds. The third is a written findings list for you to approve before anything changes.

## 1. Adding photos from Google Photos

On a phone, Google Photos is offered by the phone's own picker, so the fix is wording and a second clearly-labelled button rather than a new integration.

- On the capture screen, the current "Add photos from the gallery" becomes two clear choices: **Take photo** (unchanged, large, primary) and **Choose from Photos** — the phone picker, which lists Google Photos, Files, Drive and the camera roll.
- Same wording used inside the photos panel of an open report, and on the title-page photo picker, so it reads the same everywhere.
- The held-file protection already in place stays, so a photo picked from Google Photos that has to download first cannot fail with a file-read error.

No Google sign-in, no account approval needed.

## 2. Choosing where the PDF is saved

- **Desktop (Chrome/Edge):** Download PDF opens a proper Save-as window so you pick the folder and filename. Filename still defaults to the report reference.
- **Other desktop browsers:** unchanged behaviour, straight to the downloads folder.
- **Phones and tablets:** a second action, **Share / Save to…**, hands the PDF to the phone's own share sheet, so it can go to Drive, Files, WhatsApp, email or a client folder. If the phone does not support sharing files, it falls back to a normal download.
- Both use the exact same PDF the emails carry — nothing about the document changes.

## 3. QA of the report generation flow — findings first

I'll produce a written review, one entry per issue, each with what you see now, why it is confusing, and my recommended fix. You pick which ones get built. Already-observed candidates, to be confirmed by a full pass:

- **Two front doors.** Custom report capture and Project report creation are separate screens with overlapping wording and different orders of the same questions.
- **Template explained twice.** The template is chosen, then explained again, then repeated as "locked for this report" once capturing starts.
- **"Options" says Options twice.** A heading reading "Options" sits next to a button reading "Options"/"Hide options", with the brief summary line in between.
- **Big Options drawer.** Saved templates, preset, tone, report type, three include toggles and special requests all sit in one long drawer with no grouping, so it reads as a form rather than a short brief.
- **Three tabs, unclear order.** Photos / Review / Report gives no sense of progress, what is outstanding, or when it is safe to generate.
- **Actions split unevenly.** Language, Download PDF and Issue sit on the header while Preview, Print, Share, Draft summary, Review distribution, Attach to project and Delete are behind More — Preview and Print overlap, and Download PDF and Share overlap.
- **Property inventory adds steps not signposted anywhere.** Title-page photo, rooms, three overview photos per room and review are not presented as a sequence, so it is easy to generate too early.

### How I would set the flow up

One report, one path, the same four steps for every template:

```text
1  Set up      template, tone, what's included, title page, logo
2  Photos      take or choose photos, allocate rooms, pick room overviews
3  Review      only what needs a decision; not-assessed items block step 4
4  Issue       generate, download or share, send to trades
```

- A single step bar at the top of the report with a tick and a count per step, so "what's left" is always answerable.
- Each step has exactly one primary orange action; everything else is quiet.
- Step 4 will not generate while anything is unresolved, and says plainly what is blocking it.
- Steps that do not apply to a template (rooms, trades, close-out) simply do not appear — driven by the template definition, never hardcoded.

## Technical notes

- Google Photos: extra `<input type="file">` trigger and label changes only, in `photos-panel.tsx`, `reports.quick.tsx` and `cover-branding-fields.tsx`.
- PDF saving: in `report-actions.tsx`, use the File System Access save picker when available, `navigator.share` with a `File` on mobile, and the existing anchor download as fallback. `downloadReportPdf` and `pdf.server.ts` unchanged.
- QA output: a markdown findings document delivered in chat; no source changes until you approve items from it.
- Full test suite run before and after any change; report document model, AI safety handling, stable references, landscape inventory output and the external Supabase connection untouched.
