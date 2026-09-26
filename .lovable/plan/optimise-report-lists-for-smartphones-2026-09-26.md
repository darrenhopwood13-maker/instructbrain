# Optimise report lists for smartphones

## Goal
Make Recent reports and All reports easy to scan, open, and select on a phone without clipped titles, hidden dates, or horizontal overflow.

## Changes
- Use one consistent responsive report-card pattern for both the dashboard’s Recent reports and the All reports page.
- On phones, give the report title its own wrapping row and move the status below or beside it only when space permits.
- Keep checkboxes in a fixed 44px touch area without allowing them to squeeze the report title.
- Break the report type, reference, and updated date into short labelled lines on narrow screens instead of one long sentence.
- Add the missing shrink and width constraints to every list item and card so long report names cannot widen the page.
- Rework “Select all” and the selected-reports toolbar into stacked phone layouts, while retaining the compact desktop layout.
- Keep the fixed bottom navigation clear of the last report card and preserve all existing open, select, and bulk-delete behaviour.
- Support enlarged Android text settings as well as ordinary 320–375px phone widths.

## Verification
- Check Recent reports on the dashboard and All reports at 320px and 375px, including long titles, references, dates, statuses, and multiple cards.
- Check selection, Select all, the delete confirmation, and opening a report from the card.
- Confirm there is no horizontal overflow and the final card remains fully reachable above the bottom navigation.
- Check the desktop two-column report list remains compact and readable.
- Run the full automated checks and type checks.
