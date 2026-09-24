# Clear all data — full platform reset

Permanent and irreversible. Runs once against the external Supabase project after approval.

## What gets deleted (everyone, not just you)
- Every organisation, and beneath each: projects, reports, findings, photos (including the stored photo files, thumbnails and analysis copies), cover photos and logos, shares and trade access links, distributions, audit rows, AI usage rows, saved templates.
- Every weekly compliance register, including locked/completed ones and their entries.
- Every directory entry and directory template.
- Every membership and pending invite.
- Every sign-in account **except yours** (darrenhopwood13@gmail.com).

## What stays
- Your account and your platform admin (founder) access.
- Report templates (the definitions) — they are app configuration, not customer data.
- The app itself, the database structure and all the safety rules.

## After the reset
- You sign in and are asked to create a new organisation, as a first-time user would.
- Your unlimited plan is attached to organisations, so once you create the new one I set it back to unlimited (internal plan, no report or photo caps).

## Technical details
- Storage: list and remove every object in the `report-photos` bucket and the logo/cover paths before deleting rows.
- Rows: archive locked compliance runs, then delete compliance runs, then delete from `organisations` (cascades projects, reports, findings, finding_photos, photos, shares, directory, memberships, usage, brief_templates). Sweep any remaining orphan rows in those tables.
- Accounts: `auth.admin.deleteUser` for every user id except the founder's; `platform_admins` row kept.
- Locked-report triggers (issued findings immutable) may block cascading deletes; if so they are bypassed only for this one-off run inside a single transaction, then restored.
- Verify afterwards with row counts (all zero except your user and platform_admins) and an empty storage bucket.
