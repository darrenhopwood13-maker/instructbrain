# Founder access, Quick Reports, and a language toggle

Four pieces of work. All of it is possible. The founder account and the language toggle
touch the database and the AI layer; Quick Reports is a new capture flow; the photo
select control is a small visual fix.

---

## 1. Founder / master account

`darrenhopwood13@gmail.com` already exists as a user with one organisation membership.

Give that account a platform-level role that sits above organisation membership:

- A new `platform_admins` table holding user IDs, plus a `is_platform_admin()`
  security-definer helper with a pinned search path (same pattern as `has_role`).
- Every existing table's read and write policies gain `or is_platform_admin()`
  alongside the current organisation-membership check, so the founder can read and
  edit anything in any organisation — including confidential findings, which today
  are supervisor-and-above only.
- The founder's own organisation gets the `internal` plan: unlimited reports and no
  per-report photo cap. The allowance triggers already treat a null allowance as
  unlimited, so no trigger change is needed.
- A new `/admin` screen, visible only to platform admins: every sign-up, every
  organisation with its plan and usage, every project and report, each linking
  straight into the normal workspace. Plan changes can be made from here.

Safety note: this is a deliberate cross-tenant override. It is granted to explicitly
listed user IDs only, never to a role name that a customer could assign themselves,
and every founder edit still writes to the audit log.

---

## 2. Quick Report

A second, shorter path to a report, for a walk you did not plan.

Flow, three screens on a phone:

1. **Type** — pick the survey type. Nothing else to fill in.
2. **Photos** — camera or gallery, straight into the existing upload queue. Full-size
   originals still go to storage and to the AI unchanged.
3. **Draft** — per photo, either *Analyse with AI* or type the description by hand.
   Manual entries are marked as human-authored, not AI-suggested.

Then: review, issue, and **Send link** — a single field for any email address, sent on a
button press. Nothing sends by itself.

Quick reports are standalone: no project, no client, no reference. They appear in their
own **Quick reports** list, not on any project dashboard. A quick report can be promoted
into a full project report later without losing photos, references or findings.

Because there is no project, per-trade distribution and the project directory are not
offered on a quick report — the share link and manual email are the delivery route.
A quick report still counts against the monthly allowance.

---

## 3. Photo select control

The tick control currently sits in a padded box over the top-left corner of the image.
Shrink it to a compact circular control, reduce the padding, and move it clear of the
image content. Selection stays obvious through the card border and ring, and the tap
target stays at the 44px minimum by extending the invisible hit area rather than the
visible chip.

---

## 4. Language toggle

Ported from instructSite, same 30-language list, same behaviour: a compact selector in
the header, choice remembered on the device.

Three layers translate:

- **Interface** — buttons, labels, guidance. Translated once per language and cached
  on the device, so switching is instant after the first load.
- **On-screen findings** — finding text, remedial text and summaries render in the
  chosen language in the review and report views.
- **Issued report** — the exported document is produced in the chosen language.

Two rules on the document side:

- The English source text is always stored and always retained. A translation is a
  presentation of the record, never a replacement for it.
- Every translated document carries a line stating which language it was produced in
  and that the English original is the version of record. That protects a
  legal-adjacent document from a dispute about a translated word.

---

## Technical notes

- **Access**: `public.platform_admins` (user_id, granted_at), `public.is_platform_admin()`
  as `security definer` with `set search_path`, execute granted to `authenticated` and
  `service_role` only. Policies on every table are amended to
  `using (is_org_member(...) or is_platform_admin())` with matching `with check`.
  Client reads in `src/lib/data.ts` currently filter by `organisation_id in (...)`;
  platform admins get unfiltered variants of those queries.
- **Quick reports**: `reports.project_id` becomes nullable, with a check that a
  standalone report has `is_quick = true`. `report_org()` and the RLS policies read
  `reports.organisation_id`, which is already present, so nothing depends on the
  project row. New routes `/quick/new` and `/quick` under `_authenticated`.
- **Manual descriptions**: reuse the existing finding create path with
  `human_edited = true`, `ai_confidence = null`, `ai_suggested_trade = null`.
  Any AI failure still resolves to `not_assessed`, unchanged.
- **i18n**: `src/i18n/I18nProvider.tsx` mirroring instructSite, with the string table
  and `LANGUAGES` list copied across. Translation runs through a `createServerFn`
  against the existing AI provider layer (no edge function on this stack), cached in
  `localStorage` for interface strings and in a `finding_translations` table for
  document content so a reissued report does not pay for the same translation twice.
- **Photo grid**: `src/components/photos/photo-grid.tsx` only — checkbox wrapper
  padding and size, no data or selection-logic change.

## Order of work

1. Founder access and `/admin`.
2. Photo select control.
3. Quick Report flow.
4. Language toggle: interface, then findings, then issued document.
