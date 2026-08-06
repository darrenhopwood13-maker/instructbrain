alter table public.reports
  add column if not exists synthesis jsonb,
  add column if not exists synthesis_confirmed boolean not null default false,
  add column if not exists cover_photo_id uuid references public.photos(id) on delete set null,
  add column if not exists current_version integer not null default 0;

create table if not exists public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  version integer not null,
  document jsonb not null,
  issued_at timestamptz not null default now(),
  issued_by uuid,
  created_at timestamptz not null default now(),
  unique (report_id, version)
);

grant select, insert on public.report_versions to authenticated;
grant all on public.report_versions to service_role;
alter table public.report_versions enable row level security;

create policy "report_versions_select_member" on public.report_versions
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "report_versions_insert_staff" on public.report_versions
  for insert to authenticated with check (
    public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::app_role[])
    and organisation_id = public.report_org(report_id)
  );

create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  token text not null unique,
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.report_shares to authenticated;
grant all on public.report_shares to service_role;
alter table public.report_shares enable row level security;

create policy "report_shares_select_member" on public.report_shares
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "report_shares_insert_staff" on public.report_shares
  for insert to authenticated with check (
    public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::app_role[])
    and organisation_id = public.report_org(report_id)
  );
create policy "report_shares_update_staff" on public.report_shares
  for update to authenticated using (
    public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::app_role[])
  ) with check (
    public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::app_role[])
  );
create policy "report_shares_delete_staff" on public.report_shares
  for delete to authenticated using (
    public.has_org_role(organisation_id, array['owner','admin','supervisor']::app_role[])
  );

create trigger report_shares_set_updated_at
  before update on public.report_shares
  for each row execute function public.set_updated_at();

create index if not exists report_shares_token_idx on public.report_shares(token);
create index if not exists report_versions_report_idx on public.report_versions(report_id);

-- An issued report is locked: its wording and its findings stop changing.
create or replace function public.findings_locked_when_issued()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare _status text;
begin
  select r.status into _status from public.reports r where r.id = new.report_id;
  if _status = 'issued' then
    if new.finding_text is distinct from old.finding_text
      or new.remedial_text is distinct from old.remedial_text
      or new.status is distinct from old.status
      or new.severity is distinct from old.severity
      or new.assigned_trade is distinct from old.assigned_trade
      or new.is_confidential is distinct from old.is_confidential then
      raise exception 'this report has been issued: reopen it before editing findings';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists findings_locked_when_issued on public.findings;
create trigger findings_locked_when_issued
  before update on public.findings
  for each row execute function public.findings_locked_when_issued();
