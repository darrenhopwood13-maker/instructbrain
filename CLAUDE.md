# instructBrain

Turns a folder of site photographs into a client-ready UK construction report. Condition surveys, snagging, site walks.

**Pitch:** Photos in, client-ready report out. Minutes, not days.

Part of the Instruct suite alongside instructSite (instructsite.ai). Carries "An instructSite Company".

**The user is on site, not at a desk.** On a roof, in a stairwell, in the rain, on a phone, often in gloves, often with no signal. Interface decisions follow from that.

## Stack

React + TypeScript + TanStack Start + Tailwind. Supabase (Postgres, Auth, Storage, RLS) as an **external project — not Lovable Cloud**. Edge functions for anything touching AI keys or email. Resend for transactional email. OpenAI for vision analysis.

## Non-negotiable invariants

These came out of a failed v1 prototype. They are enforced in code, in tests, and in database triggers. If a change appears to require breaking one, **stop and ask** — do not work around it.

1. **AI failure must never become a pass.** `not_assessed` is a first-class status defined in every survey type. Any AI error, timeout, low confidence or parse failure resolves to it. Unknown or unrecognised status values coerce to `not_assessed`, **never** to a passing status, anywhere. These items block export until a human resolves them, and always appear in output clearly marked — never omitted.

2. **Images are persisted from day one.** Supabase Storage, never blob URLs. A saved report must reopen with its photos.

3. **Full-resolution images go to the AI.** Minimum 1500px long edge. Display-optimisation and analysis-optimisation must never share a code path. `thumbnail.ts` and the analysis derivative module are deliberately separate, with a test asserting neither imports the other. Do not merge them, do not add a resize step to the analysis path.

4. **References are stable.** `ref` is assigned once at creation and persisted, enforced by a database trigger. Never derived from array index or recomputed from position. Deleting a photo must not renumber anything.

5. **No discipline's vocabulary leaks into another.** All discipline-specific language — statuses, capture fields, AI prompts, severity scales, hazard and snag categories, trades, output sections — comes from the survey type definition (`survey_type_definitions`, jsonb) via the definition engine in `src/lib/survey-types.ts`. **Never hardcode a status id, category id, trade name or discipline term in shared code or components.** New disciplines are data, not code.

6. **Trade attribution is a suggestion, never an assertion.** Naming a trade as responsible for a defect is a commercial act. Always show the AI suggestion, its confidence and its reasoning; a human confirms before anything is distributed. Store the AI suggestion and the human decision separately. **Nothing sends automatically, ever** — every send is a human pressing a button.

7. **People are handled separately from conditions.** The AI describes conditions and hazards only, never a person. Findings with `involves_person` are confidential, restricted to supervisor and above, and excluded from every subcontractor distribution — enforced at database level, not only in application code.

8. **Close-out is mandatory** where the definition sets `requiresLifecycle: true`. Overdue open items surface prominently.

## Survey types — there are exactly three

| Label | id | Findings per photo | Trade | Lifecycle | Distribution |
|---|---|---|---|---|---|
| Site condition | `site_walk` | multiple | yes | yes | yes |
| Snag identifier | `snagging` | multiple | yes | yes | yes |
| Weatherproofing survey | `weatherproofing` | single | no | no | no |

Definitions are **versioned rows**. Never mutate an existing version — insert a new one. Issued reports hold their own `survey_type_snapshot` and must not change retrospectively.

## Design

Reference: instructsite.ai. Same family.

- Navy `#24417B` background with a blueprint grid (48px, ~7% opacity)
- Accent orange `#FF5E00` for fills and borders
- **Orange text on navy fails WCAG.** Text and micro-labels use the lighter warm token (`#FFD4A3`, 7.2:1). Do not undo this.
- Buttons are glossy and three-dimensional: vertical gradient, specular highlight across the upper third, outer glow, inner border. instructSite's signature.
- Wordmark: Audiowide, "instruct" orange, "Brain" white
- Display: Inter Tight, heavy, tight, white. Body: Inter.
- Uppercase letterspaced orange micro-labels above section headings
- **Everything routes through theme tokens. No hardcoded hex in components.**

Two exceptions that must survive any restyle:

- **The `.paper` scope stays light.** Report preview and print route are white paper, black text. The document is legal-adjacent and goes to tier-1 clients.
- **Status colours stay distinct.** `pass` / `fail` / `warn` / `flag` must remain distinguishable from each other and from the accent. `warn` is shifted toward amber so it cannot be mistaken for a primary action. **Status is never communicated by colour alone** — always colour plus text label.

No mascots, cartoon characters, floating orbs or gradient blobs. No dark mode toggle — navy *is* the theme.

## Accessibility and mobile

- WCAG 2.1 AA. Keyboard reachable, screen-reader labelled.
- Minimum 44×44px touch targets. Primary actions in the lower third — thumb reach.
- Test at 375px. No horizontal overflow.
- Real components for dialogs and notifications. Never `alert()`, `confirm()` or `prompt()`.
- Review must be completable for 150 findings without a mouse.
- No inner scroll regions — use the established pop-out card pattern where text may overflow.

## Explicitly out of scope

Do not build, and do not let a refactor introduce:

- Trade scoring, league tables, performance ranking, per-trade grades, or trend charts of subcontractor performance. Excluded by decision — the tool records and distributes observations, it does not rate companies.
- Stock take / inventory counting
- Programme, cost management, BIM integration
- Timesheets, RAMS, permits
- Automatic sending of anything to anyone

## Working practice

- Run the test suite before and after any change. ~90 tests; they encode the invariants above. A failing test is a stop, not a nuisance.
- Read the definition engine, review list, report document model and theme tokens before changing them.
- Do not write migrations for UI work — raise it instead.
- Never commit secrets. Keys live in Supabase secrets and Lovable secrets.
