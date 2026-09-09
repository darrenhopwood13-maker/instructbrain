DROP POLICY IF EXISTS reports_insert_staff ON public.reports;
CREATE POLICY reports_insert_staff ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    has_org_role(organisation_id, ARRAY['owner'::app_role, 'admin'::app_role, 'surveyor'::app_role, 'supervisor'::app_role])
    AND (project_id IS NULL OR project_org(project_id) = organisation_id)
  );

DROP POLICY IF EXISTS reports_update_staff ON public.reports;
CREATE POLICY reports_update_staff ON public.reports
  FOR UPDATE TO authenticated
  USING (has_org_role(organisation_id, ARRAY['owner'::app_role, 'admin'::app_role, 'surveyor'::app_role, 'supervisor'::app_role]))
  WITH CHECK (
    has_org_role(organisation_id, ARRAY['owner'::app_role, 'admin'::app_role, 'surveyor'::app_role, 'supervisor'::app_role])
    AND (project_id IS NULL OR project_org(project_id) = organisation_id)
  );