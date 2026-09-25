ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.reports ALTER COLUMN author_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS projects_delete_admin ON public.projects;
CREATE POLICY projects_delete_own ON public.projects FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS reports_delete_admin ON public.reports;
CREATE POLICY reports_delete_own ON public.reports FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS orgs_delete_owner ON public.organisations;
CREATE POLICY orgs_delete_platform_admin ON public.organisations FOR DELETE TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS directory_delete_admin ON public.project_directory;
CREATE POLICY directory_delete_admin ON public.project_directory FOR DELETE TO authenticated
  USING (public.has_org_role(public.project_org(project_id), ARRAY['owner'::app_role,'admin'::app_role]) OR public.is_platform_admin());