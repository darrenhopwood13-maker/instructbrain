# Finish manual photographic report output and PDF sending

## Outcome
Manual photographic reports will produce a finished, issued PDF: the title-page photograph stays on the title page, schedule photographs follow the order the user selected them, and every schedule page contains no more than two photographs. After issuing, the user can explicitly email that PDF as an attachment; recipients will not be sent to a browser review page.

## Changes

1. **Keep the title-page photograph on page one**
   - Add the selected cover photograph to the generated PDF title page; it is currently missing from the downloadable PDF.
   - Give the manual-report cover a fixed A4 layout and fit the photograph into the remaining space without cropping, overflow, or a second cover page.
   - Match the print/save-as-PDF title page to the same bounded layout.

2. **Use the user’s photograph order everywhere**
   - Preserve the existing selection-order numbering reserved before concurrent uploads begin.
   - Remove the manual browser/print view’s incorrect re-sort by item-creation order, so preview, print, issued PDF, and emailed PDF all follow photograph sequence.
   - Keep permanent item references unchanged; deleting or retrying a photograph will not renumber earlier items.

3. **Retain the two-photographs-per-page contract**
   - Keep the existing two fixed photograph areas on every schedule page, with item number, capture date, and capture time only.
   - Preserve saved markup and aspect-ratio-safe image fitting.
   - Keep the existing automated page-count safeguard and add ordering and cover-page checks.

4. **Replace review-link sharing for this template with “Email PDF”**
   - For an issued manual photographic report, replace the browser review-link action with an **Email PDF** action.
   - Open a simple recipient name/email dialog, then send the issued PDF as an attachment through the existing attachment-capable report mail path.
   - Remove the “Open report” browser-review button and URL from this manual-report email. The recipient gets the PDF attachment only.
   - Keep the existing device share/download options for people who want to use their phone’s own share sheet.
   - Do not send on issue: issuing freezes the report, and a separate human press sends it.

5. **Send the issued version, not a live draft**
   - Allow email sending only while the manual report is issued.
   - Build the attachment from the frozen current issued version and re-resolve its stored photographs securely, so reopening or later edits cannot change what an earlier version represents.
   - Preserve expiry/revocation and browser links for other report templates; this attachment-only behaviour is scoped to the frozen `manualOnly` capability.

## Technical details
- Add a manual-cover drawing branch to the server PDF builder and matching print-only cover sizing.
- Keep `sortByPhotoOrder` as the single ordering rule and stop `ManualPhotoDocument` from overriding it.
- Add a manual-report PDF email function and template variant that accepts one validated recipient, one fixed report attachment, and no public review URL.
- Reuse the existing authenticated send, audit, delivery, and attachment controls; no automatic or bulk sending.
- If the frozen version needs a durable PDF/storage reference, add the smallest external-Supabase migration with explicit grants and organisation-scoped access. Do not change the underlying versioned survey definition.

## Verification
- Run the full existing test suite before and after implementation.
- Add tests proving reverse upload completion still renders in selection order, the cover photograph is on page one, five photographs produce one cover plus three schedule pages, and the manual email contains one PDF attachment with no browser review URL.
- Generate a representative PDF with portrait/landscape photographs and markup, render every page to images, and visually inspect for overflow, clipping, overlap, legibility, and correct order.
- Verify the email action is unavailable before issue and requires an explicit final send press.
