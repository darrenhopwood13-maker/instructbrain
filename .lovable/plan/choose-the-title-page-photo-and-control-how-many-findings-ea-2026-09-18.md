# Choose the title page photo, and control how many findings each photo gets

Two changes, both in the places you already work.

## 1. Pick the title page photo after uploading

Today the title page photo is only changeable inside a photograph's details pop-out, so in practice it stays as the first photo.

What you'll see:

- A **Title page** line at the top of the photographs list showing the current title page photo (or "First photograph will be used" when none is chosen).
- A **Set as title page** action on every photograph in the grid, and a clear **Title page** badge on the one currently chosen.
- Changing it is instant, with a confirmation message, and you can change it as many times as you like before issuing.
- The existing optional cover upload at creation still works; if you never choose one, the first photograph is still used, exactly as now.

Nothing about photo order, numbering or references changes — swapping the title page never renumbers anything.

## 2. "Findings per photograph" becomes a brief option

Right now, on templates that allow it, the AI writes a separate finding for every item it can spot in a photo, which is where your duplicates come from.

What you'll see in the brief (the Options panel on Custom Reports):

- A new **Findings per photograph** choice: **Follow the template** (current behaviour) or **One finding per photograph**.
- With **One finding per photograph**, each photo gets a single combined condition entry — no more one photo producing five near-identical items.
- The option can only tighten, never loosen: a template that is already one-per-photo (weatherproofing, the basic photo condition record) is unaffected.
- The setting saves with the report and with your saved brief templates, so your usual choice comes back next time.
- If the AI ignores the instruction and still returns several observations for one photo, that photo is marked **not assessed** for you to resolve — a failure never becomes a pass.

Existing reports, issued documents, Project Reports, Compliance Registers, review, distribution and PDFs are untouched.

---

## Technical detail

**Cover selection (UI only, no migration)**
- `src/components/photos/photos-panel.tsx`: surface the existing `setCoverPhoto` mutation as a per-photo action plus a header summary; keep the details-dialog action.
- `src/components/photos/photo-grid.tsx`: accept `coverPhotoId` and `onSetCover`, render the badge and a 44px+ keyboard-reachable action; token colours only, status/badge carries a text label.
- No change to `cover_photo_id` semantics, `applyBranding`, document assembly or PDF.

**Findings-per-photo brief option**
- `src/lib/report/brief.ts`: add `findingsPerPhoto: "template" | "one"` to `ReportBrief`, `EMPTY_BRIEF` and `coerceBrief` (unknown/missing → `"template"`). No discipline vocabulary added.
- `src/lib/ai/prompt.ts`: compute the effective mode as `template allows multiple && brief !== "one"`; the existing single/multiple instruction sentence then follows it. Guidance and status rules unchanged and still ahead of the brief section.
- `src/lib/ai/observation.ts`: `allowsMultipleFindingsPerPhoto` gains an optional brief argument (or a new `effectiveFindingsPerPhoto(snapshot, brief)` helper) used by `draftsFromEnvelope` and `needsEscalation`; the existing "more than one observation for a single-finding type → `not_assessed`" path covers disobedience. Call sites in `analyse.server.ts` pass the report brief, which is already loaded there.
- `src/routes/_authenticated/reports.quick.tsx`: the new control inside Options, hidden when the template is already single-finding; stored in the report `brief` jsonb and in saved brief templates (existing jsonb, no migration).

**Tests**
- Brief coercion defaults and round-trip of the new field.
- Prompt contains the one-per-photograph sentence when the brief forces it, on a multi-finding template.
- `draftsFromEnvelope` with brief `"one"` and two observations → single `not_assessed` finding.
- Brief cannot loosen a single-finding template.
- Cover: setting the title page photo leaves refs and sequence untouched.
