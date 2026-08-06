alter table public.findings
  add column if not exists likely_cause text,
  add column if not exists regulatory_reference text;

drop policy if exists "findings_update_staff" on public.findings;

create policy "findings_update_staff" on public.findings
for update to authenticated
using (
  has_org_role(report_org(report_id), array['owner','admin','surveyor','supervisor']::app_role[])
  and (
    is_confidential = false
    or has_org_role(report_org(report_id), array['owner','admin','supervisor']::app_role[])
  )
)
with check (
  has_org_role(report_org(report_id), array['owner','admin','surveyor','supervisor']::app_role[])
);

create or replace function public.findings_confidentiality_transition()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
begin
  if old.is_confidential = true and new.is_confidential = false then
    if not has_org_role(report_org(new.report_id), array['owner','admin','supervisor']::app_role[]) then
      raise exception 'only supervisor, admin or owner can remove confidentiality from a finding';
    end if;
  end if;
  return new;
end; $$;

revoke execute on function public.findings_confidentiality_transition() from anon, public;

drop trigger if exists findings_confidentiality_transition on public.findings;
create trigger findings_confidentiality_transition
before update on public.findings
for each row execute function public.findings_confidentiality_transition();