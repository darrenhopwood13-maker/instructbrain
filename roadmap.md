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
