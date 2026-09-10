# Report templates — one library, used everywhere

## What changes for you

**Custom report screen**
- No plan details, no "survey types" wording.
- You pick a **report template** instead. That template is the set of instructions the AI works to when it reads your photographs.
- You can still change: tone, report type (Assessment / Identifier), suggested remedial work, severity rating, advisory note, and the special request.
- Everything else the template carries — what counts as a pass or a fail, the statuses, the on-site fields, the wording guidance the AI receives — is fixed and cannot be edited.

**Project reports**
- "Survey type" becomes "Report template" throughout that screen. Same information, same behaviour, new name. Existing reports keep the copy of the template they were created with, so nothing already issued changes.

**The library**
About 15–20 ready-to-use templates covering:
- Construction & fabric — condition survey, snagging, pre-handover, damp & mould, roofing/weatherproofing, external works & hard landscaping, fire stopping & compartmentation, structural visual walkover.
- Electrical — installation condition, containment & cable management, emergency lighting, temporary site power & distribution.
- Mechanical / HVAC — pipework & valves, plantroom, ductwork & ventilation, thermal insulation & lagging.
- Design & interiors — design intent vs installed, fit-out finishes quality, photographic identifier / inventory.

The three existing templates (Site condition, Snag identifier, Weatherproofing survey) stay exactly as they are and keep working.

**Untouched:** compliance registers, close-out, distribution, share links, review.

## Technical detail

- **Data, not code.** Each new template is a versioned row in `survey_type_definitions` (`organisation_id = null`, `version = 1`, `is_active = true`), inserted by one ordered migration. Existing rows are never mutated; `survey_type_snapshot` continues to freeze the definition into each report. The definition engine in `src/lib/survey-types.ts` is not changed — no discipline vocabulary enters shared code (invariant 5).
- Each definition carries its own `statuses` (always including `not_assessed`), `severityScale`, `captureFields`, `aiGuidance` (persona, focus, failCriteria, excludeCriteria, abstainGuidance), `defaultRemedial`, `outputSections`, `findingsPerPhoto`, and the trade/lifecycle/distribution flags. `houseVoice` reuses the shared `HOUSE_VOICE` constant.
- `src/lib/survey-definitions.ts` gains the matching typed definitions so the client can list and snapshot them, mirrored 1:1 with the seeded rows.
- **Custom report route** (`src/routes/_authenticated/reports.quick.tsx`): remove `PlanUsageMeter` and the survey-type fieldset; add a single-select template picker (grouped by discipline, searchable), labelled "Report template". The brief panel keeps tone, report type, the three includes switches and the special request; nothing else is user-editable. Saved brief templates keep working and store the chosen template id in `survey_type_ids`.
- **Project report route** (`src/routes/_authenticated/reports.new.tsx`) plus `src/i18n/strings.ts`: relabel to "Report template". No behaviour change, no schema change.
- Where template counts grow, the picker groups by `category` so the list stays usable at 375px; 44px targets, keyboard reachable, real components.
- Tests: extend `src/lib/__tests__/custom-reports.test.ts` and the definition tests to assert every new definition includes `not_assessed`, has non-empty AI guidance and capture fields, ids are unique and stable, and that the custom report screen no longer references survey-type or plan wording. Full suite re-run before and after.
