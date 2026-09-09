# Fix the "Review distribution" button

Pressing **Review distribution** on a report does nothing. I could not sign in to your app to reproduce the click myself, so the cause is not yet confirmed — the first step is to confirm it, then fix it.

## What I did check

- The button is on the report page and links to the distribution screen for that report.
- The distribution screen itself has all the data it needs for the report you have open: 36 items, none confidential, and the project "Grafton Street" has a fallback recipient set. So the destination page should show one group ("No trade assigned") ready to send.
- No errors are being reported by the app at the moment.

Because the data is healthy, the problem is most likely in the button or the screen it opens, not in the underlying report.

## The fix

1. **Confirm the behaviour.** Reproduce the press in a browser against the running app and capture what happens: no navigation at all, navigation to a blank screen, or navigation to the "nothing to send" message.
2. **Make the button a plain, reliable link.** Rebuild it so pressing it always navigates, rather than relying on the button-wrapping-a-link arrangement that can swallow the press.
3. **Show the button on every report.** At present it only appears where the survey type assigns work to trades, so on some reports there is nothing to press at all. It will appear on all reports, with a clear message on the screen itself when a report has nothing to distribute.
4. **Never leave the screen looking dead.** If a report genuinely has nothing to send, or a recipient is missing, the screen will say so plainly with the next action, instead of an unexplained empty page.
5. **Re-check the send path** on that screen so the whole route — press, review, send — works end to end. Nothing sends without you pressing send.

## Technical detail

- Investigate `src/routes/_authenticated/reports.$id.tsx` (the `Button asChild` + `Link` to `/reports/$id/distribute`, gated by `requiresTradeAssignment`) and `src/routes/_authenticated/reports.$id.distribute.tsx`.
- Replace the `asChild` Slot composition with a directly styled `Link`, so no Radix `Slot` prop-forwarding issue can block the click.
- Remove the `requiresTradeAssignment` gate on the link; handle "not distributable" as messaging on the distribution route.
- Note a real inconsistency to tidy while there: a report created as a Custom Report and later attached to a project keeps `is_quick = true` but takes the project-directory branch in `distribution-data.ts`. The screen's `isQuick` flag comes from the plan, so behaviour stays correct, but the branch selection should key off `project_id` only, which it already does — confirm no path reads `is_quick` for distribution decisions.
- No database changes. No changes to statuses, references, confidentiality handling, or automatic sending.
