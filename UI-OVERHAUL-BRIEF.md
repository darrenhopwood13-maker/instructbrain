# instructBrain — UI Overhaul Brief

**For:** Claude Code
**Repo:** instructBrain (originally scaffolded in Lovable, synced to GitHub)
**Scope:** User interface and navigation only. No changes to data model, AI pipeline, RLS, or business logic.

---

## 1. What this product is

instructBrain turns a folder of site photographs into a client-ready UK construction report. Condition surveys, snagging, site walks.

**One line:** Photos in, client-ready report out. Minutes, not days.

It sits in the Instruct suite alongside instructSite (instructsite.ai) and carries "An instructSite Company".

**The user is on site, not at a desk.** On a roof, in a stairwell, in the rain, on a phone, often in gloves, often with no signal. Every interface decision follows from that.

**Stack:** React + TypeScript + TanStack Start + Tailwind. Supabase (Postgres, Auth, Storage, RLS) as an external project — NOT Lovable Cloud. Edge functions for anything touching AI keys or email. Resend for transactional email.

---

## 2. Non-negotiable invariants

These came out of a failed v1 prototype and are enforced in code and in the database. **A UI refactor must not weaken any of them.** If a change you're making appears to require breaking one, stop and raise it.

1. **AI failure must never become a pass.** `not_assessed` is a first-class status. Any AI error, timeout, low confidence or parse failure resolves to it. Unknown status values coerce to `not_assessed`, never to a passing status. These items block export until a human resolves them, and always appear in output clearly marked.

2. **Images are persisted from day one.** Supabase Storage, never blob URLs.

3. **Full-resolution images go to the AI.** Minimum 1500px long edge. Display-optimisation and analysis-optimisation must never share a code path. There is a deliberate separation between `thumbnail.ts` and the analysis derivative module, with a test asserting they don't import from each other. Do not merge them.

4. **References are stable.** `ref` is assigned once at creation and persisted, enforced by a database trigger. Never derived from array index.

5. **No discipline's vocabulary leaks into another.** All discipline-specific language — statuses, capture fields, AI prompts, severity, trades, output sections — comes from the survey type definition record (`survey_type_definitions`, jsonb) via the definition engine. Never hardcode a status id, category or trade name in shared code or components.

6. **Trade attribution is a suggestion, never an assertion.** Always show the AI suggestion, its confidence and its reasoning. A human confirms before anything is distributed. **Nothing sends automatically, ever.**

7. **People are handled separately from conditions.** Findings with `involves_person` are confidential, restricted to supervisor and above, and excluded from every subcontractor distribution — enforced at database level.

8. **Close-out is mandatory** where the definition sets `requiresLifecycle: true`.

---

## 3. Current state

Working today:

- Landing page at `/` (public), app at `/projects` (authenticated)
- Photo upload with EXIF extraction, HEIC support, full-res preservation
- AI analysis pipeline (two-tier, structured output, abstention handling)
- Review workspace with keyboard-first navigation
- Report output, print route, PDF, share links with expiry
- Project directory, per-trade distribution, close-out lifecycle
- Plan limits: free = 3 reports/month, 30 photos per report, enforced by database triggers

### Survey types — there are exactly three

1. **Site condition** — currently stored with id `site_walk` and label "Site walk — housekeeping & safety". **Relabel to "Site condition".** Housekeeping is not a separate report type; it is part of this one. Multiple findings per photo, trade assignment and lifecycle required, distribution supported.
2. **Snag identifier** — id `snagging`. Multiple findings per photo. Adds `likely_cause` and `regulatory_reference` fields. Trade assignment and lifecycle required, distribution supported.
3. **Weatherproofing survey** — id `weatherproofing`. Single finding per photo. No trade assignment, no lifecycle, no distribution.

**How to make the relabel:** definitions are versioned rows in `survey_type_definitions`. Insert a new version rather than mutating the existing row — issued reports hold their own `survey_type_snapshot` and must not change retrospectively (this is why snapshots exist). Keep the `site_walk` id; change only the label. Changing the id would orphan existing reports.

**Naming caution worth raising with the owner:** in UK usage "condition survey" ordinarily means building fabric, which is what the weatherproofing type does. "Site condition" and "Weatherproofing survey" sitting side by side may read as overlapping to a surveyor. The owner has chosen this deliberately; flag it once if it causes user confusion in testing, then leave it.

---

## 4. What is changing

### 4.1 Move the action buttons off the landing page

Currently the landing page shows three large glossy buttons (Project report / Quick report / My reports) to signed-out visitors. Tapping one hits an auth wall.

**Change:** those three move to the authenticated dashboard. They are only visible once signed in.

The landing page keeps: wordmark, tagline, headline, the ROI calculator, use cases, pricing, sign-up. It sells; it does not pretend to be the app.

### 4.2 The dashboard becomes the entry point

New authenticated dashboard, replacing the current project list as the landing destination.

**Step one — how are you working?**

Two large primary actions:

- **Project report** — belongs to a project, uses that project's directory, supports distribution and close-out. The full workflow.
- **Quick report** — a standalone report with no project setup. For someone who has just walked a site and wants a document. *Confirm the intended behaviour with the owner before building: specifically whether a Quick report can later be attached to a project, and whether it supports distribution.*

**Step two — what kind of report?**

Selecting a mode **reveals** the three survey types. This is decided — do not show all five buttons at once. On a phone, five stacked large buttons is a scrolling wall and it breaks thumb reach. Mode selection, then type selection, in the same view, revealed on demand.

The three types: Site condition, Snag identifier, Weatherproofing survey.

Survey types are read from `survey_type_definitions` via the definition engine. **Do not hardcode the list.** Adding a fourth discipline must remain a data change, not a code change (invariant 5).

Below that: recent reports, and overdue items where any exist.

### 4.3 Reduce text throughout the app

The app currently over-explains. Strip it.

- Remove explanatory paragraphs from app screens. A label labels; it does not also teach.
- Keep field-level microcopy only where it prevents an error.
- Empty states become a single line plus the action, not a paragraph.
- **Do not strip the landing page.** A stranger evaluating the product needs prose, and so does search.

### 4.4 Help videos replace instructional text

- A persistent Help affordance at the bottom of the authenticated app, thumb-reachable.
- Opens a short list of how-to clips, one per task: start a report, capture photos, review findings, issue, distribute.
- Build it to take **short silent screen recordings (6–10 seconds), autoplaying and looping** — not narrated video. Sound is useless on site, and short clips are cheap to re-record when the UI changes.
- Store as data so clips can be added without a deploy.
- Ship the component with placeholders if the clips don't exist yet; do not block the refactor on content.

### 4.5 One-handed use

This is a requirement, not a preference.

- Primary actions in the lower third of the screen.
- Minimum 44×44px touch targets; the mode and type buttons considerably larger.
- Nothing critical in the top corners on mobile.
- No inner scroll regions — the pop-out card pattern already established for findings must be used wherever text might overflow.
- Test at 375px width, and specifically test reachability with a thumb, not a mouse.

---

## 5. Design direction

The brief's own visual direction wins over any default. Follow it exactly.

**Reference:** instructsite.ai. This product is the same family.

- Background: royal navy `#24417B`, with a blueprint grid at low opacity (48px, ~7%).
- Accent: orange `#FF5E00`.
- **Contrast rule already established:** pure `#FF5E00` on navy fails WCAG at text sizes. Orange is used for fills and borders; text and micro-labels use the lighter warm token (`#FFD4A3`, 7.2:1). Do not undo this.
- Buttons: glossy, three-dimensional — vertical gradient, specular highlight band across the upper third, outer glow, inner border. This is instructSite's signature; keep it.
- Wordmark: Audiowide. "instruct" orange, "Brain" white.
- Display headings: Inter Tight, heavy, tight, white. Body: Inter.
- Uppercase letterspaced orange micro-labels above section headings.
- Everything routes through theme tokens. **No hardcoded hex in components.**

**Two exceptions that must survive:**

- **The `.paper` scope stays light.** The report preview and the print route are white paper with black text. The document is legal-adjacent and issued to tier-1 clients. Navy chrome, white document — as instructSite does with its own light data panels.
- **Status colours stay semantically distinct.** `pass`, `fail`, `warn`, `flag` must remain distinguishable from each other and from the orange accent. `warn` has already been shifted toward amber so it cannot be mistaken for a primary action. Status is never communicated by colour alone — always colour plus text label.

**No decoration.** No mascots, no cartoon characters, no floating orbs, no gradient blobs. A v1 prototype had a draggable purple orb with blinking eyes as the primary AI control and it undermined the document's authority.

---

## 6. Explicitly out of scope

Do not build, and do not let a refactor introduce:

- Trade scoring, league tables, performance ranking or comparative trend charts of subcontractor performance. Excluded by decision — the tool records and distributes observations, it does not rate companies.
- Dark mode toggle. The navy theme *is* the theme.
- Stock take / inventory.
- Programme, cost management, BIM.
- Automatic sending of anything to anyone.

---

## 7. How to work

1. **Read before writing.** Load the definition engine (`src/lib/survey-types.ts`), the review list, the report document model, and the theme tokens before changing any of them.
2. **Run the test suite before and after.** There are ~90 tests. They encode the invariants above. A failing test is a stop, not a nuisance.
3. **Do not touch** the AI pipeline, edge functions, migrations, RLS policies, or the analysis image path. This is a UI brief.
4. **Where a UI change appears to need a schema change,** raise it rather than writing a migration.
5. **Ask before assuming** on the one remaining open question in §4.2 — exactly what a Quick report is, whether it can later be attached to a project, and whether it supports distribution. This affects the data model, so settle it before building.

---

## 8. Done means

- Signed-out visitors see a selling page. Signed-in users see a working dashboard. No overlap.
- A user can reach "start a report of type X" in two taps from the dashboard, one-handed.
- Survey types render from the definition records — adding a fifth requires no code change.
- App screens carry no explanatory paragraphs; help lives behind the Help affordance.
- The full test suite passes.
- WCAG 2.1 AA holds on the new surfaces, verified rather than assumed.
- The print route and report preview are unchanged: white paper, black text.
