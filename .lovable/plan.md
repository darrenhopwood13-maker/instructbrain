# Custom Reports — standalone report engine (option A)

Quick Report becomes **Custom Reports**: a standalone way to produce a report without setting up a project, with presets, tone control, special requests, saved templates and faster analysis — on full-size photographs.

## What you'll be able to do

1. Open **Custom Reports** from the dashboard.
2. Pick a **preset** (the starting point for what the report is about) or start from one of your **saved templates**.
3. Choose a **tone** — Factual, Client-facing, or Detailed technical.
4. Add a **special request** in your own words ("focus on the roof edge detail", "flag anything affecting handover").
5. Drop in photographs and let it analyse them.
6. Review, then issue — the PDF gets a **contents page** and can cover **more than one survey type in a single report**.
7. Save the whole setup as a **template** to reuse next time.

## Speed

Analysis gets faster without shrinking your photos:

- More photographs analysed at the same time (raising the current limit of 4).
- Shorter, tighter AI answers — most of the wait is the AI writing, not looking.
- The second-opinion pass is optional in Custom Reports, so a fast draft stays fast.

Photographs still go to the AI at full size, exactly as in Project reports. Nothing about the existing photo handling changes.

## The AI helper

A single, fixed assistant button beside the report controls opens the brief panel (preset, tone, special request). Restrained and static — in keeping with the rest of the app. No floating or animated character.

## What stays exactly as it is

Project reports, Compliance registers, Snagging, the review screen, statuses, references, distribution and close-out are untouched.

---

## Technical detail

**Database (one migration)**
- `report_templates` — org-scoped, name, preset id, tone, special request, survey type ids, created_by. Full RLS with GRANTs, org-membership scoped, USING + WITH CHECK.
- `reports` gains `brief` jsonb (preset, tone, special_request) and `survey_type_ids` jsonb array for multi-survey. Existing single-type reports keep working via the existing `survey_type_snapshot`; multi-survey stores one snapshot per type under a keyed object.

**Presets and tones** — new data module `src/lib/report/brief.ts`: preset list, tone definitions and the post-processing rules. Tone text is appended to the prompt built from the survey type snapshot; no discipline vocabulary is added here, so invariant 5 holds.

**Prompting** — `src/lib/ai/prompt.ts` gains an optional `brief` argument (tone + special request). Special request text is passed as user guidance, never as a status instruction; low confidence still resolves to `not_assessed`.

**Speed** — `RUN_CONCURRENCY` in `src/lib/ai/use-analysis-run.ts` and `concurrency` in `src/lib/ai/config.ts` raised to a configurable 12 (env-overridable, retaining backoff on 429/5xx). `maxOutputTokens` per-tone. Escalation pass skippable per report via `escalationEnabled` at call level. `analysis-derivative.ts`, `thumbnail.ts` and `analysis-source.ts` are not touched.

**Multi-survey reports** — `src/lib/report/document.server.ts` groups findings by survey type into ordered sections; `pdf.server.ts` gains a contents page listing sections with page numbers. Item numbering stays continuous and stable across sections.

**Templates** — `src/lib/report/templates.functions.ts` with list/create/delete server functions under existing auth middleware.

**UI**
- `src/routes/_authenticated/reports.quick.tsx` renamed in copy to Custom Reports, with a brief panel (preset, tone, special request, template picker/save).
- Dashboard tile and `src/i18n/strings.ts` relabelled; the compliance and project tiles unchanged.
- Route path kept to avoid breaking existing links; a redirect is unnecessary.

**Tests** — brief/tone composition, multi-survey section ordering and continuous item numbering, contents-page generation, template RLS scoping, and the existing invariant tests re-run unchanged.
