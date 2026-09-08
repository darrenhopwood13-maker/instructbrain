-- Weekly Compliance Register ------------------------------------------------

CREATE TABLE public.compliance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  check_type text NOT NULL,
  check_date date NOT NULL DEFAULT current_date,
  site_reference text,
  report_number text,
  performed_by_name text,
  performed_by_user uuid,
  signed_at timestamptz,
  competent_person text,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.compliance_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  location text NOT NULL,
  unit_ref text NOT NULL,
  unit_type text,
  state text NOT NULL DEFAULT 'active',
  decommissioned_at timestamptz,
  decommissioned_by uuid,
  decommission_photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL,
  decommission_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_points_state_check CHECK (state IN ('active', 'decommissioned')),
  CONSTRAINT compliance_points_unique_ref UNIQUE (project_id, check_type, unit_ref)
);

CREATE TABLE public.compliance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.compliance_runs(id) ON DELETE CASCADE,
  point_id uuid NOT NULL REFERENCES public.compliance_points(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_applicable',
  na_reason text,
  note text,
  photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL,
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_entries_status_check
    CHECK (status IN ('compliant', 'non_compliant', 'not_applicable')),
  CONSTRAINT compliance_entries_unique UNIQUE (run_id, point_id)
);

CREATE TABLE public.compliance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  point_id uuid REFERENCES public.compliance_points(id) ON DELETE SET NULL,
  raised_run_id uuid REFERENCES public.compliance_runs(id) ON DELETE SET NULL,
  raised_entry_id uuid REFERENCES public.compliance_entries(id) ON DELETE SET NULL,
  description text NOT NULL,
  owner text,
  opened_on date NOT NULL DEFAULT current_date,
  target_date date,
  status text NOT NULL DEFAULT 'open',
  closed_on date,
  closeout_photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL,
  closeout_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_actions_status_check
    CHECK (status IN ('open', 'in_progress', 'closed'))
);

CREATE INDEX compliance_runs_project_idx ON public.compliance_runs (project_id, check_type, check_date DESC);
CREATE INDEX compliance_points_project_idx ON public.compliance_points (project_id, check_type);
CREATE INDEX compliance_entries_run_idx ON public.compliance_entries (run_id);
CREATE INDEX compliance_actions_project_idx ON public.compliance_actions (project_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_points TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_actions TO authenticated;
GRANT ALL ON public.compliance_runs TO service_role;
GRANT ALL ON public.compliance_points TO service_role;
GRANT ALL ON public.compliance_entries TO service_role;
GRANT ALL ON public.compliance_actions TO service_role;

ALTER TABLE public.compliance_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_actions ENABLE ROW LEVEL SECURITY;

-- Runs
CREATE POLICY "compliance_runs_select" ON public.compliance_runs
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "compliance_runs_insert" ON public.compliance_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_runs_update" ON public.compliance_runs
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_runs_delete" ON public.compliance_runs
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor']::app_role[]));

-- Points
CREATE POLICY "compliance_points_select" ON public.compliance_points
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "compliance_points_insert" ON public.compliance_points
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_points_update" ON public.compliance_points
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_points_delete" ON public.compliance_points
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor']::app_role[]));

-- Entries
CREATE POLICY "compliance_entries_select" ON public.compliance_entries
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "compliance_entries_insert" ON public.compliance_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_entries_update" ON public.compliance_entries
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_entries_delete" ON public.compliance_entries
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor']::app_role[]));

-- Actions
CREATE POLICY "compliance_actions_select" ON public.compliance_actions
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));
CREATE POLICY "compliance_actions_insert" ON public.compliance_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_actions_update" ON public.compliance_actions
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin','surveyor','supervisor']::app_role[]));
CREATE POLICY "compliance_actions_delete" ON public.compliance_actions
  FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin','supervisor']::app_role[]));

-- updated_at
CREATE TRIGGER compliance_runs_updated_at BEFORE UPDATE ON public.compliance_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER compliance_points_updated_at BEFORE UPDATE ON public.compliance_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER compliance_entries_updated_at BEFORE UPDATE ON public.compliance_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER compliance_actions_updated_at BEFORE UPDATE ON public.compliance_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A locked run is evidence. Nothing in it may change afterwards.
CREATE OR REPLACE FUNCTION public.compliance_run_is_locked(_run_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.compliance_runs r
    WHERE r.id = _run_id AND r.locked_at IS NOT NULL
  )
$$;

REVOKE EXECUTE ON FUNCTION public.compliance_run_is_locked(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.compliance_entries_locked_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.compliance_run_is_locked(OLD.run_id) THEN
      RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
    END IF;
    RETURN OLD;
  END IF;

  IF public.compliance_run_is_locked(NEW.run_id)
     AND (TG_OP = 'INSERT' OR public.compliance_run_is_locked(OLD.run_id)) THEN
    RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER compliance_entries_locked
  BEFORE INSERT OR UPDATE OR DELETE ON public.compliance_entries
  FOR EACH ROW EXECUTE FUNCTION public.compliance_entries_locked_guard();

CREATE OR REPLACE FUNCTION public.compliance_runs_locked_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL THEN
      RAISE EXCEPTION 'A completed register cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This register is complete and locked. Record the correction in the next run.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER compliance_runs_locked
  BEFORE UPDATE OR DELETE ON public.compliance_runs
  FOR EACH ROW EXECUTE FUNCTION public.compliance_runs_locked_guard();