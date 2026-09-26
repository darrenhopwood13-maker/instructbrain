# Align copy, centre headings, and unify orange outlines

## Goal
Make every app screen and generated report feel consistently composed: centred headings, justified longer copy, comfortable button labels, and orange outlines around buttons and bordered boxes on both blue and white screens.

## Changes

### App screens
- Centre page, section, card, empty-state, and dialog headings within their own content area.
- Justify paragraphs, descriptions, guidance, and longer review/report text where the line width supports it.
- Keep navigation, wordmarks, form labels, field values, tables, lists, status labels, counters, short instructions, and button text in their functional alignment so screens remain easy to scan.
- On narrow phones, use natural left alignment where justification would create large word gaps; preserve centred headings.

### Buttons and bordered boxes
- Give buttons and bordered content boxes on white working screens the same soft orange outline language already used on blue screens, with white or transparent surfaces rather than orange fills.
- Cover shared controls, cards, panels, dialogs, inputs, selection controls, fixed action bars, and empty states through semantic theme rules rather than page-by-page hardcoded colours.
- Preserve safety and meaning: destructive controls stay red; pass, fail, warning, flag, disabled, selected, and focus states remain distinct and never rely on colour alone.
- Replace fixed button heights with minimum heights where labels may wrap, and add safe horizontal padding, line height, and width constraints so labels remain fully inside controls at 320px and 375px.
- Correct the review controls shown in the screenshots, including “Open description”, “Continue to issue”, Previous/Next, and status choices.

### Report previews and PDFs
- Centre report titles and section headings without changing the established page structure, landscape inventory format, room order, table columns, photograph numbering, or page breaks.
- Justify narrative paragraphs and finding descriptions in report previews, shared reports, print views, and downloaded PDFs.
- Keep table headings, table cells, metadata, labels, references, captions, status text, and short item names aligned for fast reading rather than forcing them into centred or justified text.
- Add measured PDF text layout for centred headings and justified body lines, while leaving the final line of each paragraph natural and falling back safely when a line is too short.
- Keep the legal-adjacent white paper treatment and existing status colours unchanged; orange remains a restrained rule/accent rather than an orange-filled report.

## Layout safeguards
- Apply alignment by content role, not with a blanket rule over every text element.
- Let buttons grow vertically for two-line labels instead of clipping or overlapping.
- Retain minimum 44×44px touch targets and prevent horizontal overflow.
- Do not centre or justify controls where doing so would harm data entry, comparison, or accessibility.
- Preserve all report-generation logic, AI behaviour, room workflows, permissions, and stored report data.

## Verification
- Run the full automated checks and type checks.
- Inspect every public, authentication, dashboard, project, report, review, issue/share, compliance, directory, settings, admin, shared-link, and trade-recipient screen.
- Check representative screens at 320px, 375px, tablet, and desktop widths for clipped labels, crowded controls, overlap, and horizontal scrolling.
- Generate representative standard and Property inventory PDFs, render every page to images, and visually inspect centred headings, justified narratives, tables, room pages, photographs, meter/key pages, and page breaks.
- Confirm destructive/status styling remains distinct and all keyboard focus states are visible.