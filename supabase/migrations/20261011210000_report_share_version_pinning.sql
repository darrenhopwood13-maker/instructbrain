-- Share links pinned to an issued version.
--
-- Publishing already freezes the report into report_versions, but report_shares
-- had no way to say WHICH version a link points at. So the public page read live
-- tables, and a link could quietly change its contents after it was sent --
-- including showing the working copy the moment a report was reopened.
--
-- Additive and backwards compatible. Existing rows keep version_id NULL and the
-- reader falls back to the report's current version at read time. Nothing is
-- backfilled: guessing a version for an old link would be worse than resolving
-- it at read time.
--
-- APPLIED. Verified against the production database on 12 October 2026: both
-- report_shares.version_id and its index report_shares_version_idx exist, so the
-- pinning code that reads and writes this column is safe to ship. This header said
-- "NOT APPLIED YET" while the database had already had it applied, which is the
-- worst of both - a file that lies in the direction of holding work back. Corrected
-- here rather than left to mislead the next reader.
--
-- Order for any future change of this shape: apply the migration, verify it landed,
-- then land the code that depends on it. That order was followed for the pinning
-- code, which merged to main only once this column was confirmed present.

alter table public.report_shares
  add column if not exists version_id uuid references public.report_versions(id) on delete set null;

comment on column public.report_shares.version_id is
  'The issued report version this link serves. NULL on links minted before version pinning; those resolve to the report''s current version at read time.';

create index if not exists report_shares_version_idx on public.report_shares(version_id);
