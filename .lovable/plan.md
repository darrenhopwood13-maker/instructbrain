# Make every item photo get analysed

## What the report data shows

In your latest Property inventory report (46 photos):

- 1 title photo and 18 room overview photos (3 each for Porch, Hallway, Stairs 1, Stairs 2, Bedroom 1 and Living room). You chose these, and the app doesn't analyse them on purpose. The "Room overview" label is right.
- 27 item photos. **Only 11 were sent for analysis, all within about 45 seconds. The other 16 were never started.** No error, cap or refusal was recorded. The run just stopped.

11 is almost exactly one batch: the app analyses 12 photos at a time. So the run looks like it was cut off after the first batch.

## Likely cause (to confirm first)

The analysis runs inside the Photos step of the screen. When the first results come back, the new guided flow can decide the report "has findings" and switch the screen to Review. The Photos step closes, the analysis goes with it, and the remaining photos are left unanalysed without any message.

## Fix

1. Confirm the cause in the browser with a test report: watch whether the step changes mid-run and whether that cancels the analysis.
2. Keep the analysis running wherever you are in the report. Moving between Photos, Review and Issue, or results arriving, must not stop it.
3. Only move to Review once the whole run has finished. This is the existing "takes you to Review when analysis finishes" behaviour.
4. If a run is interrupted (for example the page is closed), show "16 photos not analysed yet" with an **Analyse remaining** button on the Photos and Review steps, instead of stopping silently.
5. Keep room overview, title, meter and key photos excluded from analysis, as now.
6. For your current report, the 16 photos show as not analysed, so one press of **Analyse remaining** finishes it. Nothing already drafted is lost or renumbered.

## Tests

- A run keeps going when the step changes or results arrive.
- It moves to Review only after the last photo.
- The count of photos still to analyse is correct and excludes overview, title, meter and key photos.

## Technical details

- `src/lib/ai/use-analysis-run.ts` cancels on unmount (`mounted`/`cancelled` refs). `AnalysisPanel` is mounted only on the photos step in `reports.$id.index.tsx`. The fix is to lift the run to the report route, or make the step selection stay put while `running`.
- Check `defaultStep` in `report-stepper.tsx`: it must not re-derive the step during a run.
- No database change.
