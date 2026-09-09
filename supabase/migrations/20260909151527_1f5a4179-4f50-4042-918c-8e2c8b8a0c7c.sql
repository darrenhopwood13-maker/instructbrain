CREATE TABLE public.report_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_id text,
  tone text NOT NULL DEFAULT 'factual',
  special_request text,
  survey_type_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_templates TO authenticated;
GRANT ALL ON public.report_templates TO service_role;

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_templates_select" ON public.report_templates
  FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY "report_templates_insert" ON public.report_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id) AND created_by = auth.uid());

CREATE POLICY "report_templates_update" ON public.report_templates
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id)
         AND (created_by = auth.uid() OR public.has_org_role(organisation_id, ARRAY['owner','admin']::app_role[])))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY "report_templates_delete" ON public.report_templates
  FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id)
         AND (created_by = auth.uid() OR public.has_org_role(organisation_id, ARRAY['owner','admin']::app_role[])));

CREATE TRIGGER report_templates_set_updated_at
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX report_templates_org_idx ON public.report_templates (organisation_id, created_at DESC);

ALTER TABLE public.reports
  ADD COLUMN brief jsonb,
  ADD COLUMN survey_type_ids jsonb NOT NULL DEFAULT '[]'::jsonb;