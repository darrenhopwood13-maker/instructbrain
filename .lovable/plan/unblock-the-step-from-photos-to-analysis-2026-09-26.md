# Unblock the step from photos to analysis

## What is going wrong

Your recording shows the Start a report screen after all 46 photos are uploaded, put into rooms and have their overviews chosen. The room checklist is all ticked, but there's no way to move on.

- On a phone, the **Take photo / Add photos** bar sits on top of the **Draft the findings** button, so that button can't be seen or tapped.
- The Start a report screen has no Analyse button of its own. The analyse controls only exist on the report screen.
- **Draft the findings** also jumps straight to Review. Review is empty before analysis, so even when it works it sends you to a dead end.
- The report screen has the same overlap problem: the **Analyse photos** bar is also hidden behind Take photo / Add photos on phones.

## The room overview rule (confirmed, unchanged)

- **Room overview photos are never analysed.** That rule is right and stays.
- **Only you choose the overview photos** — the AI never picks or changes them.
- **You choose them before analysis starts.** The room checklist blocks the Analyse button until every room has its three overviews, so analysis can never begin before overviews are chosen, and the chosen overviews are always excluded from analysis.

## What will change

1. **One bottom bar on phones, not two.** The photos area gets one bar at the bottom:
   - the next step as a full-width button on top ("Analyse 40 photographs", then later "Continue to review")
   - Take photo and Add photos side by side in one row underneath.
   Nothing gets covered, and the next step is always in thumb reach. This applies on both Start a report and the report screen.
2. **Start a report leads to analysis, not Review.** The button becomes **Analyse photographs**. It opens the report screen on the Photos step and brings up the "Analyse N photographs?" confirmation straight away. That makes it one tap to reach the confirmation and one more to start.
3. **Property inventory: the button follows the room checklist.** Until every room is set up, the button says what's left, e.g. "2 photos not in a room" or "Choose overviews for Hallway". It is greyed out so overview photos are never analysed by mistake. Once all four checks are ticked, it becomes **Analyse photographs**. Other report types can go on as soon as the uploads finish.
4. **While uploads are still running** the button reads "Uploading 12 of 46…" and waits. You can't start analysis on half a set.
5. **After analysis** the existing behaviour stays: you're taken to Review automatically, and to Issue once everything is confirmed.

Nothing is analysed, confirmed or sent until you press the button. The confirmation step before analysis stays.

## Technical details

- `photos-panel.tsx`: the fixed mobile capture bar (`bottom-16 z-30`) takes an optional `nextAction` slot. It is rendered above a compact two-column `PhotoCaptureActions` row, so there's one fixed bar and the page gets matching bottom padding. The panel reports upload progress and the inventory readiness result to its parent (it already has `onUploadedCount`; add a readiness callback using the existing `inventoryReadiness`).
- `photo-capture-actions.tsx`: in compact mode the two buttons sit side by side at every width, still at least 48px tall with wrapping labels.
- `reports.quick.tsx`: remove the separate sticky "Draft the findings" link. Pass a `nextAction` that goes to `/reports/$id` with `tab: "photos", analyse: 1`. It is disabled with a plain-language reason while uploads are in progress or inventory readiness is incomplete.
- `reports.$id.index.tsx`: remove the separate sticky bar on the photos step and pass the same `nextAction` into `PhotosPanel`. Read the pending count from the analysis state instead of the DOM attribute. Add an `analyse` search flag that opens the AnalysisPanel confirmation once on arrival and is then cleared from the address, so going back never reopens it.
- `analysis-panel.tsx`: add `autoConfirm` and an `openConfirm` hook so the page button opens the real confirmation dialog instead of clicking a hidden button.
- The review step's bar is unchanged (it doesn't have the capture bar).
- Tests: readiness-to-label mapping for the next action (uploading / inventory incomplete / ready), and `defaultStep` unchanged. Check at 375px that the bar covers nothing and nothing spills sideways.
