# Complete the weekly compliance register — templates 2 to 6

Fire is already live. The other five check types exist as named placeholders with no
questions behind them. This fills them in from the approved template docs so all six
are usable, and adds the two small engine capabilities two of them need.

Nothing about fire, snagging or any other report type changes.

## What you will see

- Excavation, Scaffold, Welfare, Lifting and plant, and Housekeeping stop saying
  "reserved" and open a real weekly check, same shape as fire: add a record, answer
  the questions, take a photo, compliant / non-compliant / not applicable.
- Every failed item still raises an action with an owner and a close-out date, and
  still has to be proven closed in the six-week register. That loop is already built
  and is shared by all six.
- Scaffold shows when the next seven-day report is due and flags anything past it.
- Lifting and plant treats an out-of-date thorough examination as an automatic fail,
  whatever else is answered.

## The five templates

**Excavation** (competent person). Per excavation: location, depth, support/shoring
per design, safe access and egress, spoil clear of the edge, edge protection,
services located, water ingress controlled, falling-object risk controlled, daily
visual checks logged this week, photo.

**Scaffold** (competent person). Per scaffold or lift: location, date first taken
into use, next report due (seven days on, filled in for you), sole plates, upright
and square, bracing, fully boarded deck with no gaps, guardrails and toe boards, safe
access, ties, no damage or corrosion, tag green and in date, handover/load sheet
present, photo. Past its due date with no report = flagged as critical.

**Lifting and plant** (competent person). Types: crane, MEWP, telehandler, hoist,
chain block, slings. Thorough examination in date (hard gate), chains free of
stretch and wear, hooks undeformed with a free latch, wire rope free of broken wires
and kinks, brakes and limit switches working, tyres/undercarriage, guards in place,
SWL label legible, daily check sheet completed, photo.

**Welfare**. Areas: main welfare unit, tower, eating and rest, drying room, first
aid, compound. Toilets clean and stocked, washing with hot and cold water, soap and
towels, drinking water, drying area, rest area clean with food-heating facilities,
first aid stocked and accessible, lighting and ventilation, unit in good repair,
photo. Recorded as a documented weekly check, not a statutory inspection.

**Housekeeping and site management walk**. Per zone: access and egress clear,
housekeeping and trip hazards, waste segregated, PPE correct, edge protection and
guarded openings, working platforms safe, plant and tools guarded, permits live and
matching actual work, RAMS available and matching the activity, fire exits clear,
signage, welfare adjacent. Photo required where non-compliant.

## Technical notes

- All five are written as data in `src/lib/compliance/checks.ts`, following the fire
  definition's shape: `unitTypes`, `fields` with `compliance: true` on the ones that
  decide the outcome, `onlyForUnitTypes` for type-specific questions. `live: true`
  replaces `placeholder(...)`. No new tables, no migration, no route changes.
- Two additions to the shared definition type, both generic:
  - `type: "number"` field kind, for the excavation daily-visual count — rendered as a
    numeric input; not a compliance driver.
  - `derivedDueField` / `dueFromField`: a date field auto-populated as another date
    field plus N days (scaffold: first use + 7). When today is past that date the run
    screen shows the point as overdue with a text label, not colour alone.
- `deriveStatus` gains a `hardGate` flag on a field (lifting's thorough exam): a
  false answer forces `non_compliant` and short-circuits. Fire is unaffected —
  behaviour is identical when no field carries the flag.
- Photo-required-only-when-non-compliant (housekeeping) becomes
  `photoRequired: "on_fail"` alongside the existing `true`; fire keeps `true`.
- Tests added in the existing compliance test file: each of the six definitions
  derives the right status from answers, the hard gate overrides, vocabulary stays
  isolated from snagging, and the seven-day due date computes correctly.
