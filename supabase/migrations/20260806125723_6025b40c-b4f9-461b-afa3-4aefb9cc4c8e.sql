-- ============ ENUMS ============
create type public.app_role as enum ('owner','admin','surveyor','viewer','supervisor');
create type public.finding_photo_role as enum ('primary','detail','closeout');
create type public.distribution_channel as enum ('email','link','manual');

-- ============ UPDATED_AT ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ TABLES ============
create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_path text,
  brand_colour text,
  address text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organisations to authenticated;
grant all on public.organisations to service_role;
alter table public.organisations enable row level security;

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (user_id, organisation_id)
);
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
create index memberships_user_idx on public.memberships(user_id);
create index memberships_org_idx on public.memberships(organisation_id);

-- ============ ROLE HELPERS (SECURITY DEFINER, pinned search_path) ============
create or replace function public.is_org_member(_org uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.organisation_id = _org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(_org uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.organisation_id = _org
      and m.user_id = auth.uid()
      and m.role = any(_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, public.app_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.app_role[]) to authenticated;

-- ============ ORGANISATIONS POLICIES ============
create policy "orgs_select_member" on public.organisations
  for select to authenticated using (public.is_org_member(id));
create policy "orgs_update_admin" on public.organisations
  for update to authenticated
  using (public.has_org_role(id, array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(id, array['owner','admin']::public.app_role[]));
create policy "orgs_delete_owner" on public.organisations
  for delete to authenticated
  using (public.has_org_role(id, array['owner']::public.app_role[]));
-- no INSERT policy: organisations are created through public.create_organisation()

-- ============ MEMBERSHIPS POLICIES ============
create policy "memberships_select_member" on public.memberships
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "memberships_insert_admin" on public.memberships
  for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));
create policy "memberships_update_admin" on public.memberships
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));
create policy "memberships_delete_admin" on public.memberships
  for delete to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));

-- ============ ORGANISATION BOOTSTRAP ============
create or replace function public.create_organisation(_name text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare _id uuid; _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if _name is null or btrim(_name) = '' then raise exception 'organisation name required'; end if;
  insert into public.organisations(name) values (btrim(_name)) returning id into _id;
  insert into public.memberships(user_id, organisation_id, role) values (_uid, _id, 'owner');
  return _id;
end; $$;
revoke all on function public.create_organisation(text) from public;
grant execute on function public.create_organisation(text) to authenticated;

-- ============ PROJECTS ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  reference text,
  client_name text,
  address text,
  principal_contractor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create index projects_org_idx on public.projects(organisation_id);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create policy "projects_select_member" on public.projects
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "projects_insert_staff" on public.projects
  for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "projects_update_staff" on public.projects
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "projects_delete_admin" on public.projects
  for delete to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));

create or replace function public.project_org(_project_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.organisation_id from public.projects p where p.id = _project_id;
$$;
revoke all on function public.project_org(uuid) from public;
grant execute on function public.project_org(uuid) to authenticated;

-- ============ SURVEY TYPE DEFINITIONS ============
create table public.survey_type_definitions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references public.organisations(id) on delete cascade,
  definition jsonb not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.survey_type_definitions to authenticated;
grant all on public.survey_type_definitions to service_role;
alter table public.survey_type_definitions enable row level security;
create index std_org_idx on public.survey_type_definitions(organisation_id);
create trigger std_set_updated_at before update on public.survey_type_definitions
  for each row execute function public.set_updated_at();

-- system defaults (organisation_id is null) are readable by any signed-in user
create policy "std_select" on public.survey_type_definitions
  for select to authenticated
  using (organisation_id is null or public.is_org_member(organisation_id));
create policy "std_insert_admin" on public.survey_type_definitions
  for insert to authenticated
  with check (organisation_id is not null
    and public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));
create policy "std_update_admin" on public.survey_type_definitions
  for update to authenticated
  using (organisation_id is not null
    and public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]))
  with check (organisation_id is not null
    and public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));
create policy "std_delete_admin" on public.survey_type_definitions
  for delete to authenticated
  using (organisation_id is not null
    and public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));

-- ============ REPORTS ============
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  survey_type_id uuid references public.survey_type_definitions(id) on delete set null,
  survey_type_snapshot jsonb not null,
  title text not null,
  subtitle text,
  reference text,
  report_date date not null default current_date,
  author_id uuid,
  status text not null default 'draft',
  scope_text text,
  methodology_text text,
  executive_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz
);
grant select, insert, update, delete on public.reports to authenticated;
grant all on public.reports to service_role;
alter table public.reports enable row level security;
create index reports_org_idx on public.reports(organisation_id);
create index reports_project_idx on public.reports(project_id);
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

create policy "reports_select_member" on public.reports
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "reports_insert_staff" on public.reports
  for insert to authenticated
  with check (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[])
    and public.project_org(project_id) = organisation_id);
create policy "reports_update_staff" on public.reports
  for update to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(organisation_id, array['owner','admin','surveyor','supervisor']::public.app_role[])
    and public.project_org(project_id) = organisation_id);
create policy "reports_delete_admin" on public.reports
  for delete to authenticated
  using (public.has_org_role(organisation_id, array['owner','admin']::public.app_role[]));

create or replace function public.report_org(_report_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select r.organisation_id from public.reports r where r.id = _report_id;
$$;
revoke all on function public.report_org(uuid) from public;
grant execute on function public.report_org(uuid) to authenticated;

-- ============ FINDINGS ============
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  ref text not null,
  sequence integer not null default 0,
  status text not null default 'not_assessed',
  severity text,
  hazard_category text,
  finding_text text,
  remedial_text text,
  capture_fields jsonb not null default '{}'::jsonb,
  ai_confidence numeric,
  ai_raw_output jsonb,
  human_edited boolean not null default false,
  ai_suggested_trade text,
  ai_trade_reasoning text,
  ai_trade_confidence numeric,
  assigned_trade text,
  assigned_contact_id uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  due_date date,
  lifecycle_state text not null default 'open',
  is_confidential boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, ref)
);
grant select, insert, update, delete on public.findings to authenticated;
grant all on public.findings to service_role;
alter table public.findings enable row level security;
create index findings_report_idx on public.findings(report_id);
create trigger findings_set_updated_at before update on public.findings
  for each row execute function public.set_updated_at();

-- ref is assigned once and is immutable
create or replace function public.findings_ref_immutable()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.ref is distinct from old.ref then
    raise exception 'finding ref is immutable once assigned';
  end if;
  return new;
end; $$;
create trigger findings_ref_immutable before update on public.findings
  for each row execute function public.findings_ref_immutable();

-- non-confidential findings: any member of the owning organisation
create policy "findings_select_member" on public.findings
  for select to authenticated
  using (is_confidential = false and public.is_org_member(public.report_org(report_id)));
-- confidential findings: supervisor and above only, enforced in the database
create policy "findings_select_confidential" on public.findings
  for select to authenticated
  using (is_confidential = true
    and public.has_org_role(public.report_org(report_id),
      array['owner','admin','supervisor']::public.app_role[]));
create policy "findings_insert_staff" on public.findings
  for insert to authenticated
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "findings_update_staff" on public.findings
  for update to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[])
    and (is_confidential = false
      or public.has_org_role(public.report_org(report_id),
        array['owner','admin','supervisor']::public.app_role[])))
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[])
    and (is_confidential = false
      or public.has_org_role(public.report_org(report_id),
        array['owner','admin','supervisor']::public.app_role[])));
create policy "findings_delete_admin" on public.findings
  for delete to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin','supervisor']::public.app_role[]));

-- ============ PHOTOS ============
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text,
  blurred_path text,
  original_filename text,
  captured_at timestamptz,
  gps_lat double precision,
  gps_lng double precision,
  width integer,
  height integer,
  sequence integer not null default 0,
  faces_detected boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.photos to authenticated;
grant all on public.photos to service_role;
alter table public.photos enable row level security;
create index photos_report_idx on public.photos(report_id);

create policy "photos_select_member" on public.photos
  for select to authenticated using (public.is_org_member(public.report_org(report_id)));
create policy "photos_insert_staff" on public.photos
  for insert to authenticated
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "photos_update_staff" on public.photos
  for update to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "photos_delete_staff" on public.photos
  for delete to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));

-- ============ FINDING_PHOTOS (many-to-many) ============
create table public.finding_photos (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  role public.finding_photo_role not null default 'primary',
  region jsonb,
  created_at timestamptz not null default now(),
  unique (finding_id, photo_id, role)
);
grant select, insert, update, delete on public.finding_photos to authenticated;
grant all on public.finding_photos to service_role;
alter table public.finding_photos enable row level security;
create index finding_photos_finding_idx on public.finding_photos(finding_id);
create index finding_photos_photo_idx on public.finding_photos(photo_id);

create or replace function public.finding_org(_finding_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select r.organisation_id
  from public.findings f join public.reports r on r.id = f.report_id
  where f.id = _finding_id;
$$;
create or replace function public.finding_is_confidential(_finding_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select f.is_confidential from public.findings f where f.id = _finding_id;
$$;
revoke all on function public.finding_org(uuid) from public;
revoke all on function public.finding_is_confidential(uuid) from public;
grant execute on function public.finding_org(uuid) to authenticated;
grant execute on function public.finding_is_confidential(uuid) to authenticated;

create policy "finding_photos_select" on public.finding_photos
  for select to authenticated
  using (public.is_org_member(public.finding_org(finding_id))
    and (public.finding_is_confidential(finding_id) = false
      or public.has_org_role(public.finding_org(finding_id),
        array['owner','admin','supervisor']::public.app_role[])));
create policy "finding_photos_insert" on public.finding_photos
  for insert to authenticated
  with check (public.has_org_role(public.finding_org(finding_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "finding_photos_update" on public.finding_photos
  for update to authenticated
  using (public.has_org_role(public.finding_org(finding_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(public.finding_org(finding_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "finding_photos_delete" on public.finding_photos
  for delete to authenticated
  using (public.has_org_role(public.finding_org(finding_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));

-- ============ PROJECT DIRECTORY ============
create table public.project_directory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  trade text not null,
  company_name text not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.project_directory to authenticated;
grant all on public.project_directory to service_role;
alter table public.project_directory enable row level security;
create index project_directory_project_idx on public.project_directory(project_id);
create trigger project_directory_set_updated_at before update on public.project_directory
  for each row execute function public.set_updated_at();

create policy "directory_select_member" on public.project_directory
  for select to authenticated using (public.is_org_member(public.project_org(project_id)));
create policy "directory_insert_staff" on public.project_directory
  for insert to authenticated
  with check (public.has_org_role(public.project_org(project_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "directory_update_staff" on public.project_directory
  for update to authenticated
  using (public.has_org_role(public.project_org(project_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(public.project_org(project_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "directory_delete_admin" on public.project_directory
  for delete to authenticated
  using (public.has_org_role(public.project_org(project_id),
    array['owner','admin']::public.app_role[]));

create or replace function public.directory_org(_directory_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select p.organisation_id
  from public.project_directory d join public.projects p on p.id = d.project_id
  where d.id = _directory_id;
$$;
revoke all on function public.directory_org(uuid) from public;
grant execute on function public.directory_org(uuid) to authenticated;

create table public.directory_contacts (
  id uuid primary key default gen_random_uuid(),
  directory_id uuid not null references public.project_directory(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  is_primary boolean not null default false,
  receives_copies boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.directory_contacts to authenticated;
grant all on public.directory_contacts to service_role;
alter table public.directory_contacts enable row level security;
create index directory_contacts_directory_idx on public.directory_contacts(directory_id);
create trigger directory_contacts_set_updated_at before update on public.directory_contacts
  for each row execute function public.set_updated_at();

create policy "contacts_select_member" on public.directory_contacts
  for select to authenticated using (public.is_org_member(public.directory_org(directory_id)));
create policy "contacts_insert_staff" on public.directory_contacts
  for insert to authenticated
  with check (public.has_org_role(public.directory_org(directory_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "contacts_update_staff" on public.directory_contacts
  for update to authenticated
  using (public.has_org_role(public.directory_org(directory_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]))
  with check (public.has_org_role(public.directory_org(directory_id),
    array['owner','admin','surveyor','supervisor']::public.app_role[]));
create policy "contacts_delete_admin" on public.directory_contacts
  for delete to authenticated
  using (public.has_org_role(public.directory_org(directory_id),
    array['owner','admin']::public.app_role[]));

-- ============ DISTRIBUTIONS ============
create table public.distributions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  directory_id uuid references public.project_directory(id) on delete set null,
  trade text,
  channel public.distribution_channel not null default 'email',
  recipient_snapshot jsonb not null default '{}'::jsonb,
  finding_ids uuid[] not null default '{}'::uuid[],
  document_path text,
  sent_by uuid,
  sent_at timestamptz,
  status text not null default 'pending',
  opened_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.distributions to authenticated;
grant all on public.distributions to service_role;
alter table public.distributions enable row level security;
create index distributions_report_idx on public.distributions(report_id);
create trigger distributions_set_updated_at before update on public.distributions
  for each row execute function public.set_updated_at();

-- confidential findings can never enter a distribution: enforced in the database
create or replace function public.distributions_block_confidential()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from public.findings f
    where f.id = any(new.finding_ids) and f.is_confidential = true
  ) then
    raise exception 'confidential findings cannot be included in a distribution';
  end if;
  return new;
end; $$;
create trigger distributions_block_confidential
  before insert or update on public.distributions
  for each row execute function public.distributions_block_confidential();

create policy "distributions_select_member" on public.distributions
  for select to authenticated using (public.is_org_member(public.report_org(report_id)));
create policy "distributions_insert_staff" on public.distributions
  for insert to authenticated
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','supervisor']::public.app_role[]));
create policy "distributions_update_staff" on public.distributions
  for update to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin','supervisor']::public.app_role[]))
  with check (public.has_org_role(public.report_org(report_id),
    array['owner','admin','supervisor']::public.app_role[]));
create policy "distributions_delete_admin" on public.distributions
  for delete to authenticated
  using (public.has_org_role(public.report_org(report_id),
    array['owner','admin']::public.app_role[]));

-- ============ AUDIT LOG ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  actor_id uuid,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create index audit_log_report_idx on public.audit_log(report_id);

create policy "audit_select_member" on public.audit_log
  for select to authenticated
  using (report_id is not null and public.is_org_member(public.report_org(report_id)));
create policy "audit_insert_member" on public.audit_log
  for insert to authenticated
  with check (report_id is not null
    and public.is_org_member(public.report_org(report_id))
    and actor_id = auth.uid());
-- audit rows are append-only: no update or delete policy