# Roadmap

- [x] Add definition-driven photo roles for property inventory.
- [x] Exclude exterior and room overview photos from AI analysis.
- [x] Show exterior/title-page and room-overview controls in the photo workflow.
- [x] Render the property inventory as room sections with three overview photos and a four-column table.
- [x] Generate a matching landscape inventory PDF.
- [x] Add numerical item/photo references and a rear photograph appendix in upload order.
- [x] Add definition-driven backing pages for Property inventory.
- [x] Add the external-Supabase Property inventory v4 definition migration.
- [x] Add focused tests and rerun the suite.
- [x] Preserve each photograph's selection-order number through slow uploads and retries.
- [x] Verify every Property inventory PDF page is landscape.
- [x] Tighten Property inventory PDF to the uploaded sample structure: centred cover, fuller index, room tables, rear photos and backing pages.
- [x] Create rooms one by one from a suggested list, add selected photographs to a chosen room, pick three room overview photographs.
- [x] Show every photograph in its own room section, under that room's overview photographs.
- [x] Keep each inventory row with its photograph when room allocation changes after analysis.
- [x] Apply landscape Property inventory print formatting to public shared links.
- [x] Whole-app QA implemented: QR card fixed (near-black on white tile), bottom bar swaps Organisation for On site (Organisation now in Account menu), Send to the dashboard added to the report screen's More menu, dashboard opens on the site queue with the QR card at the foot, reports-list selection bar neutral, page headings standardised, wordmark uses text-safe ink on light screens, template explanation shows only until the template is known. 232 tests pass.
- [x] Suggest rooms: a person-approved AI grouping of inventory photographs into rooms, with overview photographs proposed and uncertain photographs held back.

## Sign-in emails
- [x] Recovery/magic links landing on dashboard — route hash tokens to the right auth screen
- [x] Branded Supabase auth email templates (paste-into-dashboard HTML)

## Simplified report journey
- [x] Standardise Take photo and Add photos controls at narrow phone widths.
- [x] Reduce AI brief options and add the Draft report summary toggle.
- [x] Replace report action clutter with Issue, Share and conditional Add to project.
- [x] Simplify the report stages and remove repeated report commands.
- [x] Remove duplicate On site hand-off controls and audit remaining authenticated screens.
- [x] Verify all report types, accessibility, mobile layouts and the complete test suite.

## Capture and rooms (26 Sep)
- [x] Continuous in-app camera: keep shooting, each shot uploads in the background.
- [x] Analyse as I shoot switch (not for Property inventory).
- [x] Review shows one photo number; findings-per-photo line only when more than one.
- [x] Recent reports cards fit narrow phones.
- [x] No automatic room overview photos; suggested overviews start unticked.
- [x] Photos in a room no longer also show in the main grid.

## 26 Sep — capture parity + report brand
- [x] Time and location on in-app camera shots
- [x] Same camera on compliance, close-out and title-page photos
- [x] instructBrain footer credit + subtle orange on all reports
- [ ] Directory logo button restyle (not started)

## 26 Sep — larger, faster camera
- [x] Make the in-app camera a full-screen mobile viewfinder with overlaid thumb-zone controls.
- [x] Move secondary camera status and analysis controls into a compact expandable panel.
- [x] Add immediate capture feedback and prevent overlapping camera reads.
- [x] Skip redundant byte copying only for app-created camera files.
- [ ] Verify the live camera experience on a physical phone.

## 26 Sep — blue-screen button accents
- [x] Replace filled/3D orange buttons on navy screens with soft orange outlines.
- [x] Keep white working-screen buttons neutral, with no orange outlines.
- [x] Verify phone and desktop button states, touch targets and label wrapping.

## 26 Sep — entry and typography
- [x] Replace the duplicate-looking Start and Sign in header actions with one Sign in action.
- [x] Use Sora for headings, Manrope for standard copy, and retain Audiowide for the wordmark.
- [x] Justify paragraph copy broadly while preserving functional alignment for controls and deliberately aligned text.
- [x] Verify the public page and representative app screens at phone and desktop sizes.

## 26 Sep — smartphone report lists
- [x] Make Recent reports and All reports use the same phone-safe card structure.
- [x] Stack long titles, statuses and report details without horizontal clipping.
- [x] Make report selection and bulk deletion usable at 320–375px.
- [x] Verify phone and desktop layout rules and run the full checks.

## 26 Sep — photos to analysis hand-off
- [x] One phone bottom bar: next step on top, Take photo / Add photos side by side beneath.
- [x] Start a report leads to analysis (opens the confirmation), not an empty Review.
- [x] Property inventory waits for the room checklist; uploads must finish first.
- [ ] Live phone check of the new bar and hand-off (needs the user's signed-in phone).

## 26 Sep — meters and keys
- [x] v7 template roles + handover block; reports.handover column
- [x] Meters and keys card on Photos step; Read from photo suggestion (accept only)
- [x] Meter Readings + Keys pages in PDF and preview, listed in index
- [ ] Live phone check (needs your sign-in)

## 26 Sep — alignment and orange outlines
- [x] Centre app and report headings without changing functional table or form alignment.
- [x] Justify longer app and report copy with narrow-phone readability safeguards.
- [x] Apply soft orange outlines to white-screen buttons, inputs, cards, panels and dialogs.
- [x] Make every button label wrap comfortably within its control at 320–375px.
- [x] Verify app screens and rendered report PDFs.
