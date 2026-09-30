# Two clear photographs per page

## Outcome
Make the **Manual photographic report** use a dedicated A4 results layout with no more than two photograph entries on each page. Each photograph and its saved markup will be large enough to read comfortably, with only the item number, capture date and capture time shown alongside it.

## What will change
- Keep the existing title page unchanged.
- Start the photographic schedule on a fresh page after the title page.
- Place two photograph entries on each following page; an odd final photograph will occupy the remaining half-page without being stretched disproportionately.
- Give each entry a stable half-page area with a large, aspect-ratio-preserving image and visible markup.
- Show only the stable item number plus the photograph&rsquo;s captured date and time. Do not show a separate photograph number, status, finding copy or remedial copy in this report output.
- Prevent each complete photograph entry from splitting across pages.
- Apply the same pagination to the downloadable PDF and the print/save-as-PDF preview so they do not disagree.
- Scope all layout changes through the frozen `manualOnly` capability; every other report template keeps its current PDF and print layout.

## Technical details
- Add a dedicated manual-report drawing path in `src/lib/report/pdf.server.ts`, selected with `isManualOnly(document.snapshot)` for full reports.
- Render findings in stable report order, in pairs, with an explicit new A4 page for each pair and a bounded image and metadata region.
- Keep manual copy stored for the editing workflow, but omit it from this template&rsquo;s report, print and PDF presentation.
- Scale markup from its existing normalised coordinates over the actual fitted image rectangle, preserving arrows, shapes, text and speech bubbles.
- Add a manual-report class/path in `ReportDocumentView` and print-only rules in `src/styles.css` to enforce two fixed entries per printed results page.
- Keep title-page, issue, sharing, stable references and issued-snapshot behaviour unchanged.

## Verification
- Add PDF tests proving a five-photo manual report produces one title page plus three results pages, while ordinary reports retain their current pagination.
- Test that markup, item number, capture date and capture time are included; photograph number and finding copy are absent; and landscape and portrait images stay inside their allotted area.
- Run the full existing test suite.
- Generate and visually inspect a representative PDF with mixed portrait/landscape photos and markup, checking every page for clipping, overlap, small text and page-splitting; adjust and re-check any affected pages.