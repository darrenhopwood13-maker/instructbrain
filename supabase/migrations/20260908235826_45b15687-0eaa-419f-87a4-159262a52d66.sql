ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS output_language text NOT NULL DEFAULT 'en';