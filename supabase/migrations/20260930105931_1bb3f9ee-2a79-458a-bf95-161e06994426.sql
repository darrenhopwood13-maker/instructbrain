CREATE TABLE public.photo_markups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_markups TO authenticated;
GRANT ALL ON public.photo_markups TO service_role;
ALTER TABLE public.photo_markups ENABLE ROW LEVEL SECURITY;
CREATE INDEX photo_markups_report_idx ON public.photo_markups(report_id);
CREATE INDEX photo_markups_organisation_idx ON public.photo_markups(organisation_id);
CREATE TRIGGER photo_markups_set_updated_at BEFORE UPDATE ON public.photo_markups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.photo_markup_row_valid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  photo_report uuid;
  report_organisation uuid;
BEGIN
  SELECT p.report_id INTO photo_report FROM public.photos p WHERE p.id = NEW.photo_id;
  SELECT r.organisation_id INTO report_organisation FROM public.reports r WHERE r.id = NEW.report_id;
  IF photo_report IS NULL OR report_organisation IS NULL
     OR photo_report IS DISTINCT FROM NEW.report_id
     OR report_organisation IS DISTINCT FROM NEW.organisation_id THEN
    RAISE EXCEPTION 'Photo markup must belong to its photo report and organisation';
  END IF;
  IF jsonb_typeof(NEW.layers) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Photo markup layers must be an array';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER photo_markups_validate BEFORE INSERT OR UPDATE ON public.photo_markups
  FOR EACH ROW EXECUTE FUNCTION public.photo_markup_row_valid();

CREATE POLICY "photo_markups_select_member" ON public.photo_markups
  FOR SELECT TO authenticated
  USING (
    organisation_id = public.report_org(report_id)
    AND public.is_org_member(organisation_id)
  );
CREATE POLICY "photo_markups_insert_staff" ON public.photo_markups
  FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.report_org(report_id)
    AND public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::public.app_role[])
  );
CREATE POLICY "photo_markups_update_staff" ON public.photo_markups
  FOR UPDATE TO authenticated
  USING (
    organisation_id = public.report_org(report_id)
    AND public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::public.app_role[])
  )
  WITH CHECK (
    organisation_id = public.report_org(report_id)
    AND public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::public.app_role[])
  );
CREATE POLICY "photo_markups_delete_supervisor" ON public.photo_markups
  FOR DELETE TO authenticated
  USING (
    organisation_id = public.report_org(report_id)
    AND public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor']::public.app_role[])
  );