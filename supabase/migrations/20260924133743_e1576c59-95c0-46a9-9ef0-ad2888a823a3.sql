do $$
declare f text;
begin
  foreach f in array array[
    'compliance_entries_locked_guard()','compliance_runs_locked_guard()',
    'findings_locked_when_issued()','distributions_block_confidential()',
    'findings_confidentiality_transition()','findings_ref_immutable()',
    'photos_enforce_cap()','reports_enforce_allowance()','reports_record_creation()',
    'report_shares_expiry_rules()','organisations_apply_plan_defaults()',
    'rls_auto_enable()','set_updated_at()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'compliance_run_is_archived(uuid)','compliance_run_is_locked(uuid)',
    'create_organisation(text)','directory_org(uuid)','directory_template_org(uuid)',
    'finding_is_confidential(uuid)','finding_org(uuid)','has_org_role(uuid, app_role[])',
    'is_org_member(uuid)','is_platform_admin()','next_finding_ref(uuid, text)',
    'project_org(uuid)','report_org(uuid)','safe_uuid(text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;