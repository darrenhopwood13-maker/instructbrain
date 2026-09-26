# One guided flow instead of three tabs

## What you'll see

The report screen stops being three tabs you have to click between. It becomes one guided flow that moves you on by itself, with a simple step indicator at the top ("Photos → Review → Issue") that shows where you are. You can tap a step you've already finished to go back to it, but you never need to.

1. **Photos.** Add or take photos as now. When uploads finish, a bar pinned to the bottom of the screen shows **Analyse 18 photos**. It's the one orange button on the screen. If **Analyse as I shoot** was on, most photos are already done and the bar shows how many are left.
   - Property inventory: the bar says **Sort into rooms** until every photo is in a room and each room has its overview photos picked. Then it changes to **Analyse items**.
2. **Analysing.** A progress bar ("12 of 18 analysed"). As soon as it finishes, you're taken to **Review** straight away, starting on the first item that needs you.
3. **Review.** A bottom bar shows "14 of 18 confirmed". When everything is confirmed and nothing is left as Not assessed, a card appears: **All findings confirmed — Continue to issue**, and you're taken to Issue after a short moment. You can cancel that if you want to stay.
4. **Issue.** A preview of the report, then **Issue report** and **Share**. These move off the top of the screen, so the first thing you see on a new report is your photos, not an Issue button.

## What does not change

- Nothing is analysed without you pressing Analyse. The only exception is Analyse as I shoot, which you switch on yourself.
- Nothing is confirmed or sent automatically. Moving to the next step is just moving you along.
- Not assessed items still stop the report being issued.
- Issued reports open straight on the Issue step, and their contents stay locked.

## Technical notes

- `reports.$id.index.tsx`: replace `Tabs` with a stepper component (`report-stepper.tsx`, buttons with `aria-current="step"`, 44px targets). Keep the `?tab=` search param so links and the back button still work. Compute the default step: issued → output; findings exist and all resolved → output; photos analysed → review; otherwise photos.
- Move Issue report, Share and the language picker from the header into the output step.
- Sticky bottom action bar (above the tab bar, thumb zone): one primary action worked out from state — upload in progress, Analyse N, inventory readiness (`inventory-readiness.ts`), or Continue to review/issue.
- `use-analysis-run.ts`: expose run completion; the route navigates to `tab=review` once, and only for the run the user started (not for a revisit).
- `review-list.tsx`: emit `onAllResolved` when confirmed = total and not_assessed = 0; the route shows a dismissable "Continue to issue" card with a 3s auto-advance and a Stay here button (a real component, announced via aria-live).
- The analysis panel stays as it is, inside the Photos step.
- Tests: step derivation for each state; auto-advance fires once per run; not_assessed blocks the Continue to issue card. Full suite before and after.
