-- The condition grade, on the finding.
--
-- A condition survey grades each element it records. That grade is a
-- suggestion by the machine and a decision by a person, and the two must never
-- be collapsed into one value. This adds the trio, exactly as the trade trio
-- works beside it:
--
--   ai_suggested_grade   the grade the assessment proposes, A to D
--   ai_grade_confidence  how sure the assessment is, 0 to 1
--   condition_grade      the grade a PERSON confirms, and the only one that
--                        reads as fact on the report
--
-- Additive and nullable: existing rows, the analysis path and the report output
-- are unaffected, and nothing reads these until the AI is asked to fill them.
-- A finding with no `condition_grade` is not "Good" by default — it is not yet
-- confirmed, and renders as "to be confirmed".
--
-- The grade is stored as the bare letter (A, B, C or D). The legend that gives
-- each letter its label and meaning lives in the application
-- (src/lib/review/condition-grade.ts), not in the database: a database
-- constraint would freeze the wording of a discipline the report template owns.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS condition_grade text,
  ADD COLUMN IF NOT EXISTS ai_suggested_grade text,
  ADD COLUMN IF NOT EXISTS ai_grade_confidence numeric;

COMMENT ON COLUMN public.findings.condition_grade IS
  'The condition grade a person confirmed: A, B, C or D. Null until confirmed; never a silent default.';
COMMENT ON COLUMN public.findings.ai_suggested_grade IS
  'The condition grade the assessment proposed: A, B, C or D. Kept beside its confidence, never overwritten by the person''s decision.';
COMMENT ON COLUMN public.findings.ai_grade_confidence IS
  'The assessment''s confidence in ai_suggested_grade, 0 to 1. Kept even when the grade was not accepted.';
