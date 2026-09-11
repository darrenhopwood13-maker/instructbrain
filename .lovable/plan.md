# Calmer report screens: fewer buttons, less noise

Four tidy-ups across the report workspace. All are presentation-only — no change to reports, photos, findings, AI behaviour, permissions or PDFs.

## 1. Report header: one clear action, the rest tucked away

Today nine controls sit side by side and wrap into six rows on a phone.

New layout:

- **Issue report** stays as the single large orange action (or **Reopen for editing** once issued).
- **Download PDF** stays visible next to it — it is the thing people reach for most.
- The language chooser stays.
- Everything else moves into one **More** menu: Preview, Print, Share, Draft summary, Review distribution, Delete report. Delete sits at the bottom, separated and marked as destructive.

Same actions, same behaviour, same dialogs — just two visible buttons plus a menu instead of nine buttons.

## 2. Hide the AI spend meter

The month's spend, remaining balance and token counts disappear from the analysis screen. The per-run line stays short: photographs analysed, draft findings, and not-assessed count — no dollar figures.

The cap itself still applies. If an organisation reaches its monthly limit, the existing plain-English "cap reached" message still appears, so nobody hits a silent failure. Owners and admins can still see full usage in organisation settings.

## 3. Photograph list collapses to the ones needing attention

Once photographs have been analysed, the long list closes down to show only the ones that need a person: failed, cancelled, still waiting, or analysed but marked not assessed.

- A single line reads e.g. "18 photographs analysed — 2 need attention".
- A "Show all photographs" toggle reopens the full list, with each row's Re-analyse button unchanged.
- While a run is in progress the list stays fully visible so progress is watchable.
- If nothing needs attention, the list stays collapsed behind the toggle.

## 4. Keyboard shortcuts off the screen

The keyboard strip above the review list is removed from the visible page. The shortcuts keep working exactly as they do now (J/K, status keys, Enter to confirm).

In its place, a small "Keyboard shortcuts" link opens the same list in a panel when wanted. The shortcut list is also announced to screen readers so keyboard-only reviewers still discover it.

## 5. Softer, flatter buttons everywhere

The glossy 3D treatment goes. All buttons — orange primary, navy, choices, secondary — become:

- Rounded, pill-like corners instead of tight radii.
- Flat colour: no specular highlight strip, no bottom "depth" edge, no outer glow.
- Gentle feedback instead of machinery: a slight colour deepen on hover/press and a subtle soft shadow, plus the existing focus ring.

Orange stays reserved for the single primary action on a screen; selected choices stay lighter navy with white text. The wordmark, colours and layout are unchanged — only the button surface treatment. The report document itself (`.paper`) is untouched.

## Technical notes

- `src/components/report/report-actions.tsx`: keep Issue/Reopen and Download PDF inline; move Preview, Print, Share, Draft summary into a shadcn `DropdownMenu`. `reports.$id.index.tsx` moves its Review distribution link and `DeleteReportButton` into the same menu, passed in as children so the menu owns the layout.
- `src/components/ai/analysis-panel.tsx`: drop `<AiUsageMeter />` and the `costUsd` segment of the totals line. Keep the exhausted-cap warning by rendering only that branch of the meter (a compact `AiCapNotice`), leaving `usage-meter.tsx` intact for settings.
- `src/lib/ai/use-analysis-run.ts` unchanged; add a derived `needsAttention` filter in the panel from existing `state` plus the per-photo message, so no new data is fetched.
- `src/components/review-list.tsx`: move the keyboard strip into a `Sheet`/`Dialog` triggered by a text button; keep the existing `onKeyDown` handler and `sr-only` copy untouched.
- No token, layout-scope or `.paper` changes. 44px targets, focus rings and status-with-text preserved. Run the full test suite before and after; update any test asserting the removed usage meter or keyboard strip.
