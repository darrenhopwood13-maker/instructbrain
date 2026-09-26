ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.projects
ADD CONSTRAINT projects_status_valid
CHECK (status IN ('active', 'completed', 'archived'));

CREATE INDEX IF NOT EXISTS projects_organisation_status_idx
ON public.projects (organisation_id, status, created_at DESC);