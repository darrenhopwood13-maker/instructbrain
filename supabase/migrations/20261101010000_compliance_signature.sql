-- Sign-off on a weekly compliance check.
--
-- Until now a completed check recorded only `signed_at` - a timestamp with nothing
-- attached to it. The PDF said "Performed by" and named nobody new, and there was no
-- evidence of who pressed the button. A signed register that cannot name its signer is
-- not much of a register.
--
-- `signer_name` is the name typed at the moment of signing, kept separate from
-- `performed_by_name` because the person completing the check is not always the person
-- the header was set up for. `signature_path` points at the drawn signature in the
-- report-photos bucket, under <organisation_id>/<report_id>/signatures/.
--
-- No guard change is needed here: `compliance_runs_locked_guard()` already refuses every
-- UPDATE once `locked_at` is set, and both columns are written in the same statement that
-- sets `locked_at`, so the signature is fixed by the same rule that fixes the rest of a
-- completed check.

alter table public.compliance_runs
  add column if not exists signer_name    text,
  add column if not exists signature_path text;

comment on column public.compliance_runs.signer_name is
  'Name typed by the person who signed the check off. Null on checks signed before 1 Nov 2026.';
comment on column public.compliance_runs.signature_path is
  'Storage object holding the drawn signature, <organisation_id>/<report_id>/signatures/<run_id>.png.';
