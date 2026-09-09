# Custom Reports — finish the brief

## Where it stands today

Built already:
- A standalone Custom Report screen at `/reports/quick` — no project needed, report starts on the first photograph, multi survey type in one report, contents page in the PDF.
- A brief carried per report (preset, tone, special request, 500 character limit) that reaches the AI and the finished document.
- Saved templates, scoped to the organisation, with the save/load/delete controls on the screen.
- Photographs still go to the AI full size; up to 12 analysed at once.
- Project reports, compliance registers and the three survey types are untouched.

Missing against this brief:
- Only three tones exist (Factual, Client-facing, Detailed technical). The five named tones and their wording rules are not there.
- No post-processing of the AI's wording at all.
- No include-fix / include-severity / advisory-footer switches.
- No Identifier report type.
- The dashboard entry is an ordinary tile the same size as the others.

## What I'll build

### 1. The five tones
Formal, Easy-going, Sharp, Meticulous, Sarcastic — each with its own writing instruction and its own tidy-up rules applied after the AI answers:
- Easy-going: drop a leading "The", "There is", "There are"; no "Finding:" label.
- Sarcastic: no "Finding:" label.
- All tones: strip impact commentary such as "detracts from the finish".

The three current tones map onto the new set so existing reports and saved templates keep opening correctly.

### 2. Report options
Three switches on the brief panel:
- Include the fix (on by default)
- Include severity (on by default)
- Advisory footer (off by default)

Plus an **Identifier** report type: a plain description of what is in each photograph, with no judgement about damage and no repair advice.

### 3. Templates and the database
One ordered migration adding the new brief settings to the existing saved-templates table and access rules to match — one table, not two, so a person's saved setups stay put.

### 4. The dashboard
Custom Reports becomes a full-width action band directly under the header, clearly the biggest thing on the page: solid accent orange with the glossy raised treatment and glow, one icon, the label, and a one-line pitch — "Brief the AI — your photos, your wording, 160+ in a batch". Keyboard reachable, contrast-safe, a real component. The project and compliance tiles stay below it, unchanged. No orb.

## Technical detail

- `src/lib/report/brief.ts`: replace `REPORT_TONES` with the five specced tones (id, label, instruction, post-processing rule set, output token budget, escalation flag), add a legacy id map, add `reportType: "assessment" | "identifier"` and the three boolean options to `ReportBrief`, `EMPTY_BRIEF` and `coerceBrief`. Presets set tone plus options.
- New `src/lib/report/tone-post-process.ts`: pure functions applied to `finding_text` / `remedial_text` after validation, before persistence. Never touches status, severity id, ref or confidence — invariant 1 and 4 untouched.
- `src/lib/ai/prompt.ts` / `briefPromptSection`: extend to emit the tone instruction, the report-type rule (identifier = describe only, no damage judgement, no remedial), and suppress the remedial/severity asks when those switches are off. No discipline vocabulary added — it all still comes from the survey type snapshot, so invariant 5 holds.
- `src/lib/ai/analyse.server.ts`: apply post-processing to observations; drop remedial/severity when switched off; include the new brief fields in the cache key.
- Migration: add `report_type`, `include_fix`, `include_severity`, `advisory_footer` to `report_templates` with sensible defaults; keep existing GRANTs and organisation-scoped RLS. No change to `reports` (the brief jsonb already carries the new fields).
- `src/lib/report/templates.functions.ts` and `reports.quick.tsx`: carry the new fields through save/load; add the switches and report-type control to the brief panel; advisory footer rendered by `document.server.ts` and `pdf.server.ts` when set.
- `src/routes/_authenticated/dashboard.tsx` + a new `CustomReportBanner` component using existing theme tokens and the established glossy button treatment.
- Tests added to `src/lib/__tests__/custom-reports.test.ts`: each tone's post-processing rules, legacy tone mapping, identifier suppressing remedial text, switches suppressing fields, brief coercion of unknown values. Full suite re-run.
