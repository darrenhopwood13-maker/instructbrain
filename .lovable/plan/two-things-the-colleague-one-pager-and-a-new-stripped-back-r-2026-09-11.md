# Two things: the colleague one-pager, and a new stripped-back report

## 1. Finish the feature one-pager (already approved, credits ran out)

Generate the single-page A4 PDF for your colleague: instructBrain header, the hero line, four capability blocks (Custom reports, Project reports, Weekly compliance registers, Review and issue), the safety and audit guarantees, and the site-first notes. You get it back as a downloadable file. No app code touched.

## 2. New report template — "Photo condition record"

### What you would see

A new template in the same template dropdown you already use, called **Photo condition record**.

Pick it and the screen is deliberately short:

- **Focus of this report** — a box you fill in every time, in your own words ("front elevation brickwork", "handover of unit 4 kitchens", "storm damage to roof coverings"). This is what the AI is told to look at. It is required; you cannot start without it.
- **Tone** — still yours to choose.
- Nothing else. No remedial-work switch, no severity switch, no deadline, no trade, no close-out. Those controls are hidden for this template because they do not apply.

Upload photos, run it, and the finished report is:

- a **title page** — report title, the focus you wrote, date, your organisation
- then **one entry per photograph**: the photo, its reference number, and a single short line saying the condition or the issue seen. Nothing else.

Anything the AI cannot judge still comes out clearly marked "Not assessed" and still has to be resolved by you before the report can be issued. That rule does not bend.

### What is not affected

Nothing existing changes. Snag identifier, Site condition, Weatherproofing, Property inventory and the four newer templates keep their exact wording, statuses and behaviour. Weekly compliance registers, close-out, distribution, share links, reviews, PDFs and already-issued reports are all untouched — the new template is an extra row in the library, not a change to the engine.

## Technical detail

- **Data, not code.** One new versioned definition `photo_condition_record` (`organisation_id = null`, `version = 1`, `is_active = true`) inserted by a single ordered migration, mirrored 1:1 as a typed definition in `src/lib/survey-definitions.ts` and appended to `systemDefinitions`. No existing row is mutated; `survey_type_snapshot` continues to freeze the definition per report.
- Definition shape: `findingsPerPhoto: "single"`; statuses `sound` (pass), `issue_identified` (fail), `not_assessed` (flag); `severityScale: []`; `captureFields: []`; `defaultRemedial: ""`; `requiresTradeAssignment: false`; `requiresLifecycle: false`; `allowsDistribution: false`; `outputSections: ["cover", "schedule"]`; `aiGuidance` instructs a one-line condition statement, no remedial advice, no severity, no person description, abstain to `not_assessed` on any doubt.
- **Focus field.** Reuses the existing brief `specialRequest` plumbing (already sanitised, 500-char capped, prompt-injected as emphasis only — it can never authorise a pass). In `src/routes/_authenticated/reports.quick.tsx` the field is relabelled **Focus of this report** and made required when the selected template declares minimal controls; the include-fix, include-severity, advisory-footer and report-type controls are hidden for it. `src/lib/report/brief.ts` gains a small preset (`condition_record`: tone `sharp`, no fix, no severity, no footer) and `coerceBrief` forces `includeFix`/`includeSeverity` false for this template id — same guard style already used for identifier reports.
- **Document output.** No new renderer. The two-section `outputSections` list plus empty severity/remedial values already yields cover + per-finding photo and text in `src/lib/report/document.ts` and the PDF path; a check confirms empty remedial and null severity render as omitted rather than as blank labelled rows.
- Mobile-first at 375px, 44px targets, keyboard reachable, tokenised colours, real components.
- **Tests.** Extend the definition and custom-report tests: the new definition includes `not_assessed`, carries no severity or capture fields, requires no trade or lifecycle; the brief coercion forces fix/severity off; the report screen refuses to start without a focus. Full suite run before and after.
