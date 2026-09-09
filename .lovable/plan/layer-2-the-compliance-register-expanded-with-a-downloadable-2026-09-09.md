# Layer 2 — the compliance register, expanded, with a downloadable weekly pack

Layer 1 (the six weekly checks, points, entries, actions, locking) is done. Layer 2 turns
the register page from a list of weeks into the actual assurance record, and lets you
hand that record over as a file — photographs included.

Nothing about snagging, site condition, weatherproofing or property inventory changes.

## What you will see

**1. The register becomes a real grid, not a list.**
On a site, for the chosen check type, the last six weeks run across the top and every
point (location + unit ID) runs down the side. Each cell shows that week's outcome —
compliant, non-compliant, not applicable, not assessed, or blank where the point did not
exist yet — as a colour *and* a short word, never colour alone. Decommissioned points
stay in the grid, greyed, with the week they were removed. On a phone the grid becomes
one card per point with its six weeks inside, so nothing scrolls sideways.

**2. Open items sit above the grid.**
A single strip: how many actions are open, how many are overdue, and the oldest one.
Expanding it lists them with owner, target date and which week raised them. Overdue
items are labelled "Overdue", not just coloured.

**3. Every week gets a completeness read-out.**
Per week column: points checked, non-compliant count, photographs missing, whether it is
signed and whether it is locked. An unfinished week is obvious at a glance.

**4. Download a weekly compliance pack.**
A "Download pack" button on each week, and a "Download six-week pack" on the register.
The pack is a single PDF:

- Cover: site, check type, week ending, performed by, competent person, report number,
  and the counts.
- The register table for that week (or all six weeks for the six-week pack).
- One page per point: every question and its answer, the outcome, the note, and the
  photograph printed at readable size with its capture date.
- The actions schedule: everything raised that week, plus everything still open from
  earlier weeks, with owner, target and status.
- Close-out evidence: for actions closed in the period, the close-out photograph, date
  and note.
- Any point with a missing photograph is listed explicitly as missing — never quietly
  omitted.

The pack is generated when you press the button; nothing sends automatically.

## Technical notes

- No schema change. Everything comes from `compliance_runs`, `compliance_points`,
  `compliance_entries`, `compliance_actions` and `photos`.
- New `src/lib/compliance/register.ts`: pure functions turning runs + points + entries +
  actions into the grid model (rows, columns, cells, per-week completeness, action
  summary). Unit-tested, no React, no Supabase.
- New `src/lib/compliance/pack.server.ts`: builds the pack with `pdf-lib`, reusing the
  existing page/text/image writer in `src/lib/report/pdf.server.ts` and the signed-URL
  helper pattern from `document.server.ts` (`createSignedUrls` against the
  `report-photos` bucket). Photographs embed from the stored original.
- New `src/lib/compliance/pack.functions.ts`: `downloadCompliancePack`, a
  `createServerFn` behind `requireSupabaseAuth`, taking `{ projectId, checkType, runId? }`
  and returning `{ filename, content }` base64 — same shape as `downloadReportPdf`, so
  the browser save path is already proven. RLS scopes it to the caller's organisation.
- `src/routes/_authenticated/projects.$id.compliance.index.tsx` is rewritten around the
  grid, the open-items strip and the two download buttons. The run screen gains a
  "Download this week's pack" action next to Complete.
- Status derivation stays in `checks.ts`; the pack and grid both read it, so an unknown
  or missing answer resolves to `not_assessed` in the document exactly as it does on
  screen. `not_assessed` and missing photographs are printed, never dropped.
- Tests added to `src/lib/__tests__/compliance.test.ts`: grid assembly across six weeks
  including a point that starts late and one decommissioned mid-window, overdue action
  detection, per-week completeness counts, and a pack-model test asserting missing
  photographs and `not_assessed` entries appear in the output model.
