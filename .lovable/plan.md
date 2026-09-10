# Report templates — one library, used everywhere

## What changes for you

**Custom report screen**
- No plan details, no "survey types" wording.
- You pick a **report template** instead. That template is the fixed set of instructions the AI works to when it reads your photographs.
- You can still change: tone, report type (Assessment / Identifier), suggested remedial work, severity rating, advisory note, and the special request.
- Everything else the template carries — what counts as a pass or a fail, the statuses, the on-site fields, the AI's guidance — is fixed and cannot be edited.

**Project reports**
- "Survey type" becomes "Report template" throughout that screen. Same information, same behaviour, new name. Existing reports keep the copy they were created with, so nothing already issued changes.

**Four new templates** (added to the four already there: Snag identifier, Site condition, Weatherproofing survey, Property inventory):
1. **Electrical installation condition** — containment, terminations, accessories, distribution boards, temporary site power.
2. **Mechanical & HVAC installation** — pipework, valves, plantroom, ductwork, ventilation, insulation and lagging.
3. **Fit-out & finishes quality** — design intent versus installed, joinery, finishes, tolerances, interfaces.
4. **Damp, mould & water ingress** — staining, condensation, penetrating and rising damp, mould growth.

**Untouched:** compliance registers, close-out, distribution, share links, review, and the existing four templates.

## Technical detail

- **Data, not code.** Each new template is a versioned row in `survey_type_definitions` (`organisation_id = null`, `version = 1`, `is_active = true`), inserted by one ordered migration. Existing rows are never mutated; `survey_type_snapshot` continues to freeze the definition into each report. The engine in `src/lib/survey-types.ts` is unchanged — no discipline vocabulary enters shared code (invariant 5).
- Each definition carries its own `statuses` (always including `not_assessed`), `severityScale`, `captureFields`, `aiGuidance` (persona, focus, failCriteria, excludeCriteria, peopleGuidance, tradeGuidance, abstainGuidance), `defaultRemedial`, `outputSections`, `findingsPerPhoto`, and the trade/lifecycle/distribution flags. `houseVoice` reuses the shared `HOUSE_VOICE` constant.
- `src/lib/survey-definitions.ts` gains the four typed definitions, mirrored 1:1 with the seeded rows, appended to `systemDefinitions`.
- **Custom report route** (`src/routes/_authenticated/reports.quick.tsx`): remove `PlanUsageMeter` and the survey-type fieldset; add a single-select **Report template** picker (grouped by `category`). The brief panel keeps tone, report type, the three includes switches and the special request; nothing else is user-editable. Saved brief templates keep working, storing the chosen template id in `survey_type_ids`.
- **Project report route** (`src/routes/_authenticated/reports.new.tsx`) plus `src/i18n/strings.ts`: relabel "survey type" to "report template". No behaviour or schema change.
- Picker stays usable at 375px; 44px targets, keyboard reachable, real components, tokenised colours.
- Tests: extend the definition and custom-report tests to assert every new definition includes `not_assessed`, has non-empty AI guidance and capture fields, has unique stable ids, and that the custom report screen no longer references survey-type or plan wording. Full suite run before and after.
