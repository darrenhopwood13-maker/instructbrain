-- The clause a PERSON chose for the instrument a finding already names.
--
-- A finding may name the instrument it engages (regulatory_reference). This adds the second,
-- narrower decision beside it: which section of that instrument. The distinction matters
-- because the two are chosen by different things.
--
--   regulatory_reference  the instrument - an id the ASSESSMENT may select from the template's
--                         own closed list, and which a person confirms
--   regulatory_clause     the section - chosen by a PERSON ONLY, from the list the instrument's
--                         publisher gives for itself. There is no AI column beside this one,
--                         deliberately: no `ai_suggested_clause` exists and none should be
--                         added. A clause number is the one thing a model cannot be trusted to
--                         produce, and it is never asked to.
--
-- Stored as the publisher's own unit number as text ("4", "20A", "SCHEDULE 5"), never free
-- text and never a number the instrument does not publish. The heading printed beside it comes
-- from the report's FROZEN survey type snapshot, not from here, so what the report says about
-- a clause is fixed at issue and cannot drift. A number that is not on the instrument's own
-- list prints as nothing at all - it is never shown as though the publisher had titled it.
--
-- Additive and nullable: every existing row, the analysis path, and every report already
-- issued are unaffected. Null reads as "the instrument is named without a section", which is
-- exactly how every finding behaved before this column existed.
--
-- ---------------------------------------------------------------------------------------
-- NOT APPLIED. This file was written for review and has deliberately NOT been run against any
-- live project (`krwphsejinmlwvtwugwk` or otherwise). Until it is applied, the clause picker
-- still renders and the value still resolves (the read falls back to null), but nothing it
-- writes can be stored. Applying it is a decision for the reviewer.
-- ---------------------------------------------------------------------------------------
--
-- Known gap, pre-existing and left alone: `findings_locked_when_issued()`
-- (20260806181751_…sql:84-89) does not name this column - nor `regulatory_reference`. So a
-- clause can still be written on the live row of an issued report. The PDF is safe regardless:
-- it is rendered from `report_versions.document`, which is append-only, so the issued copy
-- cannot move. Extending the trigger is the belt-and-braces follow-up and would need the
-- function recreated in full, which is why it is not done inside this migration.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS regulatory_clause text;

COMMENT ON COLUMN public.findings.regulatory_clause IS
  'The clause/section a PERSON chose, from the list the cited instrument publishes for itself: the publisher''s own unit number as text, e.g. ''4''. Null until chosen. Never written by an assessment, never free text, never inferred.';
