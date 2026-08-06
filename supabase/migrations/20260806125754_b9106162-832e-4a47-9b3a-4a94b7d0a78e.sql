-- safe uuid cast for storage paths
create or replace function public.safe_uuid(_t text)
returns uuid language plpgsql immutable set search_path = public, pg_temp as $$
begin
  return _t::uuid;
exception when others then
  return null;
end; $$;
revoke all on function public.safe_uuid(text) from public, anon;
grant execute on function public.safe_uuid(text) to authenticated;

-- revoke anon execute on every helper/trigger routine
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, public.app_role[]) from public, anon;
revoke all on function public.create_organisation(text) from public, anon;
revoke all on function public.project_org(uuid) from public, anon;
revoke all on function public.report_org(uuid) from public, anon;
revoke all on function public.finding_org(uuid) from public, anon;
revoke all on function public.finding_is_confidential(uuid) from public, anon;
revoke all on function public.directory_org(uuid) from public, anon;
revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.findings_ref_immutable() from public, anon;
revoke all on function public.distributions_block_confidential() from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.app_role[]) to authenticated;
grant execute on function public.create_organisation(text) to authenticated;
grant execute on function public.project_org(uuid) to authenticated;
grant execute on function public.report_org(uuid) to authenticated;
grant execute on function public.finding_org(uuid) to authenticated;
grant execute on function public.finding_is_confidential(uuid) to authenticated;
grant execute on function public.directory_org(uuid) to authenticated;

-- ============ STORAGE POLICIES: report-photos (private) ============
-- path convention: <organisation_id>/<report_id>/<filename>
create policy "report_photos_select_member" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-photos'
    and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));

create policy "report_photos_insert_staff" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'report-photos'
    and public.has_org_role(public.safe_uuid((storage.foldername(name))[1]),
      array['owner','admin','surveyor','supervisor']::public.app_role[]));

create policy "report_photos_update_staff" on storage.objects
  for update to authenticated
  using (bucket_id = 'report-photos'
    and public.has_org_role(public.safe_uuid((storage.foldername(name))[1]),
      array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (bucket_id = 'report-photos'
    and public.has_org_role(public.safe_uuid((storage.foldername(name))[1]),
      array['owner','admin','surveyor','supervisor']::public.app_role[]));

create policy "report_photos_delete_staff" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-photos'
    and public.has_org_role(public.safe_uuid((storage.foldername(name))[1]),
      array['owner','admin','surveyor','supervisor']::public.app_role[]));