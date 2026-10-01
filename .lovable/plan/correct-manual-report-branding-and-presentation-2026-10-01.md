# Correct manual-report branding and presentation

## Outcome
Manual photographic reports will use the approved instructBrain identity: navy, white and **Laser Green `#57FF00`**, with a restrained, professional document layout. The title page remains one page and every schedule page remains limited to **two photographs**.

## Changes

1. **Replace the legacy orange PDF styling**
   - Change manual-report rules, highlights and small brand details from orange to Laser Green.
   - Use a darker accessible green only where green text appears on white; retain `#57FF00` for rules and graphic accents.
   - Remove the incorrect all-orange `INSTRUCTSITE` treatment and use the instructBrain family credit consistently.

2. **Make the title page look like a professional issued document**
   - Strengthen the title, subtitle and project-information hierarchy with cleaner spacing, alignment and typography.
   - Keep the organisation name/logo prominent when supplied, with instructBrain as the discreet platform credit.
   - Keep the selected cover photograph on page one, fitted cleanly without cropping or forcing another page.
   - Preserve issued-version wording and report facts; no report data or workflow changes.

3. **Refine the photographic schedule**
   - Keep exactly two fixed photograph areas per A4 page.
   - Retain only item number, capture date and capture time for each photograph.
   - Improve image scale, whitespace, divider weight and metadata alignment so portrait and landscape photographs feel balanced and legible.
   - Preserve saved markup and the user’s original photograph-selection order.

4. **Apply the same brand treatment everywhere this report is delivered**
   - Match the downloadable PDF, PDF-link output, email attachment and print/save-as-PDF view.
   - Keep the PDF-link landing screen in the established navy blueprint treatment with white “instruct” and Laser Green “Brain”.
   - Keep expired or withdrawn link messages branded in the same system.

## Technical details
- Separate document brand colours from status colours and markup colours so changing the report accent cannot alter evidential annotations or status meaning.
- Replace the PDF builder’s legacy orange accent constant with semantic instructBrain document tokens; update stale orange-specific comments.
- Keep manual pagination paired with `index += 2` / two fixed print rows, and add regression checks for five photographs producing one cover plus three schedule pages.
- Add checks for Laser Green branding, the instructBrain credit, photograph order and the absence of finding copy/photo-number labels.

## Verification
- Run the complete existing test suite before and after the change.
- Generate a representative issued manual report with mixed portrait/landscape images and markup, render every PDF page to images, and inspect the cover plus all schedule pages.
- Check PDF-link and print output at phone and desktop widths for clipping, overlap, legibility and consistent branding.