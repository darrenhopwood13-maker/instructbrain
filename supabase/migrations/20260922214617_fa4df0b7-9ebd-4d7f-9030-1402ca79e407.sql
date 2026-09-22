ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
COMMENT ON COLUMN public.reports.submitted_at IS 'Set only when a person on site presses Send to the dashboard. Never set automatically.';
CREATE INDEX IF NOT EXISTS reports_submitted_at_idx ON public.reports (submitted_at DESC) WHERE submitted_at IS NOT NULL;