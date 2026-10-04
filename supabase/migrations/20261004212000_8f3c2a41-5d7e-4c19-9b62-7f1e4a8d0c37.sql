-- The Snag Master write-up, on the finding.
--
-- instructSite's Snag Master returns a full defect report per photograph. An
-- instructBrain finding already carries most of that set — finding_text,
-- likely_cause, remedial_text, regulatory_reference, severity, and the trade
-- with `ai_suggested_trade` / `ai_trade_confidence` / `assigned_trade` — but
-- four parts of the write-up have nowhere to live. This adds them so one
-- finding holds the same report:
--
--   snag_title         the one-line defect title
--   rectification_alt  the second rectification option
--   tradesman_hack     the trade tip
--   hs_notes           health and safety notes
--
-- Additive and nullable: existing rows, the analysis path and the report output
-- are unaffected, and nothing reads these until the AI is asked to fill them.
--
-- Regulatory citations are deliberately NOT added as a free-text array. This
-- survey already constrains `regulatory_reference` to the snapshot's own
-- verified list, and invents nothing; a free-text citation array would be the
-- one place a model could put a clause number that cannot be checked.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS snag_title text,
  ADD COLUMN IF NOT EXISTS rectification_alt text,
  ADD COLUMN IF NOT EXISTS tradesman_hack text,
  ADD COLUMN IF NOT EXISTS hs_notes text;

COMMENT ON COLUMN public.findings.snag_title IS
  'One-line defect title, matching the Snag Master write-up.';
COMMENT ON COLUMN public.findings.rectification_alt IS
  'Second rectification option: the alternative fix, where a second one exists.';
COMMENT ON COLUMN public.findings.tradesman_hack IS
  'A hard-won trade tip for carrying out the remedial works.';
COMMENT ON COLUMN public.findings.hs_notes IS
  'Health and safety notes for the remedial works.';
