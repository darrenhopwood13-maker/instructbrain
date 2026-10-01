# Bring back "Create link" for manual photographic reports — link opens the finished PDF

## Outcome
Issued manual photographic reports get a **Create link** button again. Pressing it creates a link you can copy or send. Whoever opens it gets the finished, issued PDF straight away. There's no review page, no comments and no live report view. The **Email PDF** button stays as it is.

## What changes
1. **Create link button** in the Share menu for manual reports. It only works once the report is issued, so no link exists to a draft. Pressing it copies the link and shows it on screen. Nothing is sent automatically: you choose where to paste or send it.
2. **The link opens a branded PDF landing screen, then the PDF.** The landing screen has navy with the blueprint grid, the white "instruct" plus green "Brain" wordmark, and the organisation's own logo and name if the report has one. It shows the report title, reference and issue date, with a large **Open PDF** and a **Download PDF** button. The PDF itself is the same branded, issued document you get from Email PDF: cover photo on page one, two photos per page, item number, date and time.
3. **Always the frozen issued version.** The link serves the issued version that existed when the link was made. Reopening or editing the report later doesn't change what the link delivers. Confidential items are never included.
4. **Link controls stay the same.** Links can expire or be revoked like today's links. A dead link shows a branded "This link has expired / been withdrawn" message.
5. **Branding check across all three outputs**: the email, the link screen and the PDF. Each carries the organisation's branding and the discreet "instructBrain · AN INSTRUCTSITE COMPANY" credit.

Other report types keep their existing review links unchanged.

## Technical details
- `report-actions.tsx`: for `isManualOnly`, add a "Create link" item that calls `createShareLink` only when issued.
- New public route `src/routes/api/public/shared-report-pdf.$token.ts`. It validates the token, expiry and revocation, then builds the PDF from `report_versions.document`, reusing the `buildIssuedEmailPdf` snapshot and re-signing logic (refactored into a shared `buildIssuedPdfBytes`). It returns `application/pdf` with `Cache-Control: private, no-store`. A manualOnly snapshot is required, so the endpoint can't serve other templates.
- `shared.$token.tsx`: when the share's snapshot is manualOnly, render the branded PDF landing instead of the review document.
- Pin the share to a version: store the issued version number on the share row. If `report_shares` has no such column, add a small external-Supabase migration with a nullable `version int`. No grant changes are needed on the existing table.
- Tests: the manual link returns a PDF (`%PDF`), the manual share never renders the review view, links can't be made before issue, and revoked or expired links are refused. Run the full suite before and after.
- Visual QA of the PDF via rendered page images.
