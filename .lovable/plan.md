# Weekly Compliance Register + QA changes

Two pieces of work in one pass: a new fourth report type with a real compliance engine behind it, and three sign-in / sign-up / review changes.

## Part 1 — Weekly Compliance Register

A new report type sitting alongside Weatherproofing, Snagging, Site condition and Property inventory. Snagging is untouched — no shared vocabulary, no shared engine.

### What the user does

1. On a project, start a Weekly Compliance Register and pick a check type. Fire is complete; Excavation, Scaffold and Welfare appear in the picker as named but empty check types, ready to be filled in later without a rebuild.
2. Fill the run header: site / reference, check date, check type, performed by (named, signed), report number. Scaffold and excavation also carry a named competent person.
3. Work through the points. On the very first run for a site you add them; every run after that arrives **pre-populated with last week's points**, and you confirm or amend rather than re-typing.
4. Each fire point is one row: location, unit ID, type, present?, service in date?, tag/pin secured?, and a pressure check that changes with the type — water and foam ask "gauge full?", CO2 and wet chemical ask "seal intact?" because CO2 has no gauge. A photo of every unit is required each week; a missing photo blocks issuing.
5. Anything non-compliant raises an **action**: owner, opened date, target close-out date, status open → in progress → closed, and closing needs a photo and a date.
6. Where there is genuinely nothing to check, you record "checked — nothing to see" explicitly. Blank sections are not allowed.
7. A point that is removed or relocated is marked decommissioned with a photo, date and who — so it stops showing as a permanent fake fail.
8. Finishing a run **locks it**. It becomes read-only. A correction is a new entry in the next run, never an edit or a delete.

### Site register screen

Per site: the last six weeks side by side, every non-compliant row and where its action got to. Open actions raised in an earlier week are carried into the current run and shown at the top — "3 items still open from last week".

### Vocabulary

Compliant / non-compliant / not applicable. No severity — severity stays in snagging.

## Part 2 — QA changes

**QA-1 Sign-in.** Remove the "email me a link" toggle and the "Accept an invitation" link from the sign-in screen. What is left: email, password with a show/hide eye button, Sign in, Sign up, and Forgotten your password? The invitation screen itself stays reachable from its emailed link — only the sign-in screen stops advertising it.

**QA-2 Sign-up.** Headline "3 free reports — no card needed", with a supporting line about turning site photos into client-ready reports in minutes. No card field is added.

**QA-3 Review flow.** The stacked results boxes are replaced by a one-at-a-time flow: photo at the top, a single finding underneath, arrow keys or swipe to move between the findings on that photo and on to the next photo, and a thin progress line reading "Finding 2 of 4 · Photo 3 of 15". Keyboard-first is preserved: confirm, amend and move on without a mouse.

## Technical notes

Database (one migration, RLS on everything, org-scoped like the rest):

```text
compliance_runs        site/project, check type, check date, performed by,
                       competent person, report number, locked_at
compliance_points      site-level identity: location, unit id, unit type,
                       state (active | decommissioned), decommission photo/date/by
compliance_entries     one row per point per run: per-field answers (jsonb),
                       status compliant|non_compliant|not_applicable, photo id
compliance_actions     site-level, references the run that raised it and the
                       point, owner, opened/target/closed dates, status,
                       close-out photo
```

Actions hang off the site and the point, not the run, so closing a run cannot orphan them. A database trigger blocks any write to entries of a locked run, mirroring the existing `findings_locked_when_issued` pattern. Pre-population is a server function that copies the previous run's active points into a new run as unconfirmed entries.

The check definition (fields, per-type conditional pressure check, statuses) is authored as a survey type definition record, so Excavation, Scaffold and Welfare are later added as data. Existing photo storage, org roles, PDF and distribution paths are reused; issue is blocked while any entry lacks a photo or a required non-compliant action is unowned.

Seed data ships in the migration: two-three fire locations across a site, a couple of non-compliant units, and a week 1 / week 2 pair so pre-population, the carried-open action and the six-week window are all visible immediately.

Tests: locked-run immutability, pre-population carrying point identity, actions surviving run close, photo-missing export block, and no snagging vocabulary leaking into the compliance definition.
