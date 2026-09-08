# Attach a real PDF to every report send

## What's wrong today

Nothing in the app ever produces a PDF file. The "Print / PDF" button opens the browser's own print dialog, and the sending code passes `attachment: null` to the trade extract email. Sharing a report and chasing an overdue item send a link and a table only. So a recipient never receives a document.

## What will change

1. **A real PDF builder on the server.** A pure-JavaScript PDF generator (pdf-lib, which runs in this project's serverless environment — no headless browser is possible there) that lays out the report the same way the on-screen document reads:
   - Cover: title, subtitle, reference, project, report date, author, version.
   - Report summary.
   - Items in the currently selected results view (by trade, severity or deadline), each with its item number, location, description, status and severity shown as **text plus colour**, target date, and its photographs.
   - Items marked *not assessed* clearly flagged, never omitted.
   - Page numbers and a footer carrying the report reference.

2. **Photographs included.** Each item's photos are fetched from storage on the server and placed beside the item, scaled to fit the page. Photos are compressed for print size, which is separate from both the display thumbnail path and the AI analysis path — neither of those is touched.

3. **Three PDF variants, one builder:**
   - Full report — attached when a report is shared.
   - Trade extract — only that trade's items, confidential items excluded (the existing exclusion checks stay and run before the PDF is built).
   - Single item — attached to an overdue chase.

4. **Attachments wired into the three sends.** `sendReportSharedEmail`, `sendTradeExtractEmail` and `sendCloseOutRequestEmail` build the matching PDF and pass it through to the mail provider, which already supports attachments. If the PDF cannot be built, the send stops with a plain-English error rather than sending an email with nothing attached.

5. **Download PDF in the report workspace.** A new button downloads the same file the email would carry. The existing print view stays as-is.

6. **Guard against oversized mail.** Resend caps attachments at roughly 40 MB. If a photo-heavy report exceeds a safe limit, photo quality is reduced first; if it still exceeds it, the email sends with the link and a clear note that the report was too large to attach, rather than failing silently.

## Technical notes

- New `src/lib/report/pdf.server.ts`: `buildReportPdf(document, options)` returning `Uint8Array`, with `variant: "full" | "trade" | "item"`.
- Photo bytes come from the existing storage paths via a signed URL read on the server; JPEG/PNG only, HEIC-derived files use the already-stored JPEG derivative.
- `EmailAttachment` already exists (base64 + content type) — the sending code base64-encodes the buffer.
- New server function `downloadReportPdf` (authenticated) for the workspace button.
- `package.json` gains `pdf-lib`.
- New unit tests: PDF is non-empty and starts with `%PDF`, trade variant contains no confidential item references, and a not-assessed item still appears in the output text layer. Existing suite must stay green.
