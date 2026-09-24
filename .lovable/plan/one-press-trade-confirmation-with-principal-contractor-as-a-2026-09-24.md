# One-press trade confirmation, with Principal contractor as a standard trade

## What you will see
- On the Review step of any report that uses trades (Site condition, Snag identifier and any other template with trades), a single button above the list: **Confirm all trades 80% or over (N)**. N is how many findings have no trade yet and an AI suggestion at 80% or higher.
- Pressing it opens a short confirmation listing those findings and their suggested trades. Press **Confirm** and every one of them gets its suggested trade, recorded as confirmed by you, with the usual target dates.
- Findings below 80%, or with no suggestion, stay unassigned. You pick those as you do now. **Principal contractor** now appears in every trade dropdown.
- Any confirmed trade can still be changed afterwards, exactly as today.
- The button only shows when N is more than zero. It never appears on issued reports or on templates without trades.

## What does not change
- Nothing is confirmed until you press the button. Nothing sends automatically.
- The AI's suggestion, its confidence and its reasoning are all still kept, separately from your decision.
- Confidential (person-related) findings still stay out of every subcontractor send.
- Reports already issued keep their frozen template.
- Other templates, the compliance register, the property inventory layout and distribution.

## Technical notes
- New definition versions (insert, never mutate) for every template that has trades, adding "Principal contractor" to its trades list. One ordered migration on the external Supabase project. New reports pick up the new version; existing reports keep their snapshot.
- The 80% threshold is a named config value (`BULK_TRADE_CONFIRM_THRESHOLD = 0.8`) in `src/lib/ai/config.ts`, not a magic number.
- `review-list.tsx`: compute eligible findings (`!assignedTrade && aiSuggestedTrade && aiTradeConfidence >= threshold && !isConfidential-gating unchanged`). A real dialog, keyboard reachable, with 44px targets.
- The route adds `onAssignTradeMany`, which reuses the existing `onAssignTrade` path for each finding (derived due date, `confirmed_by` = current user, `stateAfterAssignment`, audited `before`) so the audit trail is identical to confirming one at a time.
- Tests: below-threshold and null suggestions are never assigned; already-assigned findings are untouched; the AI suggestion is preserved; the button is hidden when N=0, when the report is issued and on templates without trades; new definition versions include Principal contractor and issued snapshots don't change. Full suite runs before and after.
