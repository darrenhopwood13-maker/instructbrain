# Fix the Property inventory report

Three faults, confirmed against your recent inventory reports.

## 1. Photos coming back "not assessed"

Two of your recent reports show real failures. One item records the exact cause: the AI was
given a temporary link to the photograph and replied *"Unable to download content from the
provided URL before the timeout"*. Inventory photos are large full-resolution files, and the
AI gives up waiting for them.

**Fix:** send the photograph itself with the request instead of a link, so nothing has to be
fetched over the internet by the AI. The image stays full resolution — no shrinking, no change
to the quality the AI sees. If a request still fails it retries once before the photo is marked
not assessed, as now.

One report (19 photographs, no items at all) needs a separate look: the plan's first step is to
confirm whether analysis was never started on it or every photo failed the same way, and fix
accordingly.

## 2. Too many, near-duplicate items per photograph

One report produced 26 items from 14 photographs because the inventory template tells the AI to
list every distinct object it can see. The "Findings per photograph" choice already exists in
the Custom Report options but is not offered when you start an inventory report from a project.

**Fix:**
- Offer the same choice — "Follow the template" or "One entry per photograph" — when starting
  any report, including inventory ones, and remember the last choice you used.
- Tighten the inventory wording so trivial and repeated objects are grouped rather than listed
  separately: one entry per item worth recording, and several of the same thing in one
  photograph recorded once with a quantity.

## 3. Title, subtitle and date not asked for

The document header block (main title, subtitle, report date, author) only appears on the
project route, which is why every inventory report is titled "Property inventory — <date>" with
no subtitle.

**Fix:** show the same header block on the Custom Report screen when the inventory template is
chosen, inside the existing Options panel, with today's date prefilled and the author shown
read-only. Blank fields keep today's automatic title, exactly as now.

## Technical notes

- `src/lib/ai/analyse.server.ts` (367-369): replace the signed-URL hand-off with a server-side
  fetch of the stored object, passed to the adapter as a base64 data URL. `analysis-source.ts`
  gains a `loadAnalysableImage` helper returning bytes + content type; `adapters.server.ts:101`
  keeps `detail: "high"`. No resize, no shared code path with `thumbnail.ts` — the existing
  isolation test stays green. Add one retry on a provider 400/timeout before falling through to
  the existing `not_assessed` path.
- `src/lib/report/brief.ts` already carries `findingsPerPhoto`; add the control to
  `src/routes/_authenticated/reports.new.tsx` and persist it on the report's brief jsonb. No
  migration, no new template column.
- `src/lib/survey-definitions.ts`: new version (version 2) of `propertyInventoryDefinition` with
  revised `multiFindingGuidance` and `excludeCriteria`, inserted as a new row in
  `survey_type_definitions` with version 1 deactivated. Existing issued reports keep their own
  snapshot and do not change.
- `reports.new.tsx`'s `asksForHeader` block moves into a small shared component reused by
  `reports.quick.tsx`; `createReport` already accepts `subtitle` and `reportDate`.
- Tests: provider failure still resolves to `not_assessed`; data-URL path asserts no downscale;
  one-entry-per-photo enforcement; inventory vocabulary isolation. Full suite run before and
  after.

Nothing here touches Project Reports' other templates, Weekly Compliance Registers, review,
distribution, share links, PDFs or issued snapshots.
