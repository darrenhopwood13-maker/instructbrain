ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'assessment',
  ADD COLUMN IF NOT EXISTS include_fix boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_severity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS advisory_footer boolean NOT NULL DEFAULT false;