# Photo order, and a cleaner basic photo report

Two fixes, both small and contained. Nothing changes for Project reports, Compliance registers, distribution, close-out or already-issued reports.

## 1. Photos stay in the order you picked them

Today several photos upload at the same time to keep things fast, and the photo's number is stamped at the moment its upload starts. When one photo is slower, or is retried, it takes a later number — so the report can show them out of order. Findings have the same problem: each one is numbered when the AI finishes reading that photo, and the AI reads several photos at once, so finishing order wins over picking order.

What changes:

- The number for each photo is decided the moment you select the files, in the order they appear in your selection — not when its upload happens to start. Uploading stays parallel and just as fast.
- The report and the review list order findings by the photo they belong to, so item 1 is the first photo you added, item 2 the second, and so on. Existing item references stay exactly as they are; nothing is renumbered.

You should then see: pick 40 photos, the report lists them 1 to 40 in the same order.

## 2. Basic photo report shows one text box only

When the "Photo condition record" template is selected, the review screen still shows a "Remedial action" panel even though this report has no repairs, no severity and no target date. That panel is removed for this template, leaving the condition/finding text as the only text box on each item. The same panel is left out of the finished document and PDF for this template.

Every other template keeps all its current panels.

## Technical notes

- `src/components/photos/photos-panel.tsx`: assign `sequence` per item at enqueue time (`base + index`) instead of incrementing inside the queue task.
- Order findings for display and output by their primary linked photo's `sequence`, then by finding `sequence` as a tie-break — applied in `src/lib/report/document.ts` / `report-data.ts` / `document.server.ts` assembly, not by rewriting stored `ref` or `sequence` (invariant 4 holds).
- `src/components/review-list.tsx`: gate the "Remedial action" FieldCard on the report's brief/template, using the existing `isMinimalBriefTemplate` helper in `src/lib/report/brief.ts` rather than any hardcoded discipline term; same gate in the document view and PDF section builder.
- Tests: upload ordering under out-of-order task completion; document ordering by photo sequence; remedial panel hidden for the minimal template and present for others.
