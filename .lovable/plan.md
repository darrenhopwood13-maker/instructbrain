# Two clear photographs per page

## Outcome
Make the **Manual photographic report** use a dedicated A4 results layout with no more than two photograph entries on each page. Each photograph, its saved markup, number and manual description will be large enough to read comfortably.

## What will change
- Keep the existing title page unchanged.
- Start the photographic schedule on a fresh page after the title page.
- Place two photograph entries on each following page; an odd final photograph will occupy the remaining half-page without being stretched disproportionately.
- Give each entry a stable half-page area with a large, aspect-ratio-preserving image, visible markup, photograph number and readable manual description.
- Prevent a photograph and its description from splitting across pages.
- Apply the same pagination to the downloadable PDF and the print/save-as-PDF preview so they do not disagree.
- Scope all layout changes through the frozen `manualOnly` capability; every other report template keeps its current PDF and print layout.

## Technical details
- Add a dedicated manual-report drawing path in `src/lib/report/pdf.server.ts`, selected with `isManualOnly(document.snapshot)` for full reports.
- Render findings in stable report order, in pairs, with an explicit new A4 page for each pair and bounded image/description regions.
- Scale markup from its existing normalised coordinates over the actual fitted image rectangle, preserving arrows, shapes, text and speech bubbles.
- Add a manual-report class/path in `ReportDocumentView` and print-only rules in `src/styles.css` to enforce two fixed entries per printed results page.
- Keep title-page, issue, sharing, stable references and issued-snapshot behaviour unchanged.

## Verification
- Add PDF tests proving a five-photo manual report produces one title page plus three results pages, while ordinary reports retain their current pagination.
- Test that manual descriptions and markup are included and that landscape and portrait images stay inside their allotted area.
- Run the full existing test suite.
- Generate and visually inspect a representative PDF with mixed portrait/landscape photos and markup, checking every page for clipping, overlap, small text and page-splitting; adjust and re-check any affected pages.