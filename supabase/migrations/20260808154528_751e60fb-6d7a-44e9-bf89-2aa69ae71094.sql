-- 1. Platform admins ------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key,
  granted_at timestamptz not null default now()
);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

alter table public.platform_admins enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins p where p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated, service_role;

drop policy if exists "platform admins read the list" on public.platform_admins;
create policy "platform admins read the list"
  on public.platform_admins for select to authenticated
  using (public.is_platform_admin());

-- 2. Blanket override policy on every application table --------------------
do $$
declare t text;
begin
  foreach t in array array[
    'ai_analysis_cache','ai_usage_events','audit_log','directory_contacts',
    'directory_template_entries','directory_templates','distributions',
    'finding_photos','findings','memberships','organisations','photos',
    'project_directory','projects','report_creation_events','report_shares',
    'report_versions','reports','survey_type_definitions','trade_access',
    'plan_limits'
  ] loop
    execute format('drop policy if exists "platform admin full access" on public.%I', t);
    execute format(
      'create policy "platform admin full access" on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t
    );
  end loop;
end $$;

-- 3. Seed the founder ------------------------------------------------------
insert into public.platform_admins (user_id)
select u.id from auth.users u where lower(u.email) = 'darrenhopwood13@gmail.com'
on conflict (user_id) do nothing;

update public.organisations o
set plan = 'internal'
where o.id in (
  select m.organisation_id from public.memberships m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = 'darrenhopwood13@gmail.com'
);

-- 4. Quick reports ---------------------------------------------------------
alter table public.reports alter column project_id drop not null;
alter table public.reports add column if not exists is_quick boolean not null default false;

alter table public.reports drop constraint if exists reports_project_or_quick;
alter table public.reports add constraint reports_project_or_quick
  check (project_id is not null or is_quick = true);

-- 5. Translation store -----------------------------------------------------
create table if not exists public.finding_translations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  language text not null,
  source_checksum text not null,
  document jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, language, source_checksum)
);

grant select, insert, update, delete on public.finding_translations to authenticated;
grant all on public.finding_translations to service_role;

alter table public.finding_translations enable row level security;

create policy "members read translations"
  on public.finding_translations for select to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "members write translations"
  on public.finding_translations for insert to authenticated
  with check (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "members update translations"
  on public.finding_translations for update to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin())
  with check (public.is_org_member(organisation_id) or public.is_platform_admin());

create policy "members delete translations"
  on public.finding_translations for delete to authenticated
  using (public.is_org_member(organisation_id) or public.is_platform_admin());

create trigger finding_translations_set_updated_at
  before update on public.finding_translations
  for each row execute function public.set_updated_at();