# Check every earlier request is still in place

A code check shows the recent changes are all still there. This plan tests them on real phone and desktop screens, so anything that looks different from what you asked for gets found and fixed.

## What gets checked
1. Item column shows short names only. Full wording appears only under Description.
2. Unidentified item reviewer: "Unidentified only" filter, editing the item name and description, setting the condition, and "Edited by you".
3. Inventory review: Description shows in full with no "Open description" button, and there is no Remedial action card.
4. Dashboard "Recent reports / Show all reports" spacing at 320px and 375px.
5. Orange help button can be hidden and brought back from the Account menu.
6. Report screen has only Issue, Share and one Add to project. Draft summary is a switch in the AI brief.
7. Take photo and Add photos buttons: text stays inside the button.
8. Password reset link opens the change-password screen, not the QR screen.
9. Inventory PDF: landscape, rooms in order, 3 overview photos, then the table, then numbered photos. The full report is built.
10. Photo order follows the order you picked them. The title-page photo can be chosen.
11. Master admin menu and delete rules.

## How
- Run all 248 checks. Open each screen in a test browser at phone and desktop sizes and take screenshots.
- Screens that need you signed in can't be opened automatically on this project. For those I check the code and tests, and list the ones you need to try yourself.
- Anything missing or reverted gets fixed. I then report pass or fail for each item.

## Technical details
- Code-level evidence already found: `field-card` `expandable`, `review-list` `unresolvedOnly`/`onEditText`, help-sheet hidden key, inventory v6 `aiCaptureFields`, `PhotoCaptureActions`, dashboard grid heading, recovery hash routing.
- No database changes, unless a check turns up a regression that needs one. In that case I'll raise it first.
