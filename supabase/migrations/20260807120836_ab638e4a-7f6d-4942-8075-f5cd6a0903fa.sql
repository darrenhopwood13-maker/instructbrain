-- Fallback recipient per project
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS fallback_recipient_name text,
  ADD COLUMN IF NOT EXISTS fallback_recipient_email text;

-- Human override of a derived target date, and close-out bookkeeping
ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS due_date_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifecycle_note text,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_at timestamptz;

-- Organisation-level directory templates
CREATE TABLE IF NOT EXISTS public.directory_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_templates TO authenticated;
GRANT ALL ON public.directory_templates TO service_role;
ALTER TABLE public.directory_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read directory templates" ON public.directory_templates
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "editors create directory templates" ON public.directory_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor']::app_role[]));
CREATE POLICY "editors update directory templates" ON public.directory_templates
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor']::app_role[]));
CREATE POLICY "editors delete directory templates" ON public.directory_templates
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor']::app_role[]));

CREATE TRIGGER directory_templates_set_updated_at
  BEFORE UPDATE ON public.directory_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.directory_template_org(_template_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  select t.organisation_id from public.directory_templates t where t.id = _template_id;
$$;

CREATE TABLE IF NOT EXISTS public.directory_template_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.directory_templates(id) ON DELETE CASCADE,
  trade text NOT NULL,
  company_name text NOT NULL,
  notes text,
  contacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_template_entries TO authenticated;
GRANT ALL ON public.directory_template_entries TO service_role;
ALTER TABLE public.directory_template_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read template entries" ON public.directory_template_entries
  FOR SELECT TO authenticated
  USING (public.is_org_member(public.directory_template_org(template_id)));
CREATE POLICY "editors create template entries" ON public.directory_template_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(public.directory_template_org(template_id), ARRAY['owner','admin','surveyor']::app_role[]));
CREATE POLICY "editors update template entries" ON public.directory_template_entries
  FOR UPDATE TO authenticated
  USING (public.has_org_role(public.directory_template_org(template_id), ARRAY['owner','admin','surveyor']::app_role[]))
  WITH CHECK (public.has_org_role(public.directory_template_org(template_id), ARRAY['owner','admin','surveyor']::app_role[]));
CREATE POLICY "editors delete template entries" ON public.directory_template_entries
  FOR DELETE TO authenticated
  USING (public.has_org_role(public.directory_template_org(template_id), ARRAY['owner','admin','surveyor']::app_role[]));

CREATE TRIGGER directory_template_entries_set_updated_at
  BEFORE UPDATE ON public.directory_template_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Token-based, trade-scoped close-out access for subcontractors
CREATE TABLE IF NOT EXISTS public.trade_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  trade text NOT NULL,
  token text NOT NULL UNIQUE,
  label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_access_report_idx ON public.trade_access(report_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_access TO authenticated;
GRANT ALL ON public.trade_access TO service_role;
ALTER TABLE public.trade_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read trade access" ON public.trade_access
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "editors create trade access" ON public.trade_access
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor','surveyor']::app_role[]));
CREATE POLICY "editors update trade access" ON public.trade_access
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor','surveyor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor','surveyor']::app_role[]));
CREATE POLICY "editors delete trade access" ON public.trade_access
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor','surveyor']::app_role[]));

CREATE TRIGGER trade_access_set_updated_at
  BEFORE UPDATE ON public.trade_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();