-- A report reference is allocated by the system, and once allocated it can
-- never be changed.
--
-- Why this exists: `reports.reference` was a plain nullable text column with no
-- default and no uniqueness, typed by hand in the report editor. Nothing
-- allocated it and nothing stopped a repeat, so three issued reports on this
-- project all read "001" (one of them "001 " with a trailing space, one of them
-- a duplicate of another). A reference appears on issued evidence and gets
-- quoted to clients; it has to be unique, stable, and impossible to edit after
-- the fact. It is now built in exactly one place - here - and locked.
--
-- Format: TYPE-YYYY-MM-NNN, e.g. SOC-2026-10-001. The number counts up per
-- organisation, per type, per month.
--
-- Read-only discipline for the reader: this migration writes schema plus one
-- backfill, and the backfill touches DRAFTS ONLY. No issued report is
-- renumbered - issued evidence is never rewritten.

-- --------------------------------------------------------------------------
-- 1. What each survey type is called in a reference
-- --------------------------------------------------------------------------
-- Data, not a CASE statement: a new survey type gets a code by adding one row,
-- and an unknown type degrades to RPT rather than failing the insert.

create table if not exists public.report_reference_codes (
  survey_type_id text primary key,
  code text not null,
  constraint report_reference_codes_code_format check (code ~ '^[A-Z0-9]{2,6}$')
);

insert into public.report_reference_codes (survey_type_id, code) values
  ('schedule_of_condition',            'SOC'),
  ('site_walk',                        'SW'),
  ('snagging',                         'SNG'),
  ('property_inventory',               'PINV'),
  ('weatherproofing',                  'WPS'),
  ('electrical_installation',          'EIC'),
  ('mechanical_services',              'MEC'),
  ('fitout_quality',                   'FIT'),
  ('damp_moisture',                    'DMP'),
  ('photo_condition_record',           'PCR'),
  ('manual_photo_report',              'MPR'),
  ('weekly_compliance_fire',           'WCF'),
  ('weekly_compliance_excavation',     'WCE'),
  ('weekly_compliance_scaffold',       'WCS'),
  ('weekly_compliance_welfare',        'WCW'),
  ('weekly_compliance_lifting_plant',  'WCL'),
  ('weekly_compliance_housekeeping',   'WCH'),
  ('test',                             'TEST')
on conflict (survey_type_id) do update set code = excluded.code;

-- --------------------------------------------------------------------------
-- 2. The counter
-- --------------------------------------------------------------------------
-- One row per organisation, per type, per month. `last_number` is bumped with
-- an atomic upsert, so two reports created in the same second cannot be handed
-- the same number. (A count(*) would race; this does not.)

create table if not exists public.report_reference_counters (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type_code text not null,
  period text not null,
  last_number integer not null default 0,
  primary key (organisation_id, type_code, period)
);

alter table public.report_reference_codes enable row level security;
alter table public.report_reference_counters enable row level security;

-- The app may read the codes (it shows them). Nothing reads or writes the
-- counters: allocation runs inside a security-definer function.
drop policy if exists "reference codes are readable" on public.report_reference_codes;
create policy "reference codes are readable"
  on public.report_reference_codes for select to authenticated using (true);

-- --------------------------------------------------------------------------
-- 3. Building a reference
-- --------------------------------------------------------------------------

create or replace function public.report_reference_code(p_snapshot jsonb)
returns text
language sql
stable
as $$
  select coalesce(
    (select c.code
       from public.report_reference_codes c
      where c.survey_type_id = (p_snapshot->>'id')),
    'RPT'
  );
$$;

create or replace function public.next_report_reference(
  p_organisation_id uuid,
  p_snapshot jsonb,
  p_on date
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_period text;
  v_number integer;
begin
  v_code := public.report_reference_code(p_snapshot);
  v_period := to_char(coalesce(p_on, current_date), 'YYYY-MM');

  insert into public.report_reference_counters (organisation_id, type_code, period, last_number)
  values (p_organisation_id, v_code, v_period, 1)
  on conflict (organisation_id, type_code, period)
  do update set last_number = public.report_reference_counters.last_number + 1
  returning last_number into v_number;

  return v_code || '-' || v_period || '-' || lpad(v_number::text, 3, '0');
end;
$$;

-- --------------------------------------------------------------------------
-- 4. Allocation on insert
-- --------------------------------------------------------------------------
-- Any reference supplied by a caller is IGNORED and overwritten. Otherwise a
-- user could bypass the builder by posting their own value on creation, and the
-- column would not be "unable to be changed by a user" in any real sense.

create or replace function public.assign_report_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.reference := public.next_report_reference(
    new.organisation_id,
    new.survey_type_snapshot,
    coalesce(new.report_date, new.created_at::date, current_date)
  );
  return new;
end;
$$;

drop trigger if exists reports_assign_reference on public.reports;
create trigger reports_assign_reference
  before insert on public.reports
  for each row execute function public.assign_report_reference();

-- --------------------------------------------------------------------------
-- 5. The lock
-- --------------------------------------------------------------------------
-- One-way only. A blank reference may be filled (rows created before this
-- migration); an allocated reference may never move. Loosening this to allow
-- edits "just this once" is the same as not having it.

create or replace function public.report_reference_immutable()
returns trigger
language plpgsql
as $$
begin
  if btrim(coalesce(old.reference, '')) <> ''
     and new.reference is distinct from old.reference then
    raise exception
      'A report reference is allocated by the system and cannot be changed (was %, attempted %)',
      old.reference, new.reference
      using errcode = '42501',
            hint = 'The reference is part of the issued record.';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_reference_immutable on public.reports;
create trigger reports_reference_immutable
  before update on public.reports
  for each row execute function public.report_reference_immutable();

-- --------------------------------------------------------------------------
-- 6. Uniqueness, for references the system generates
-- --------------------------------------------------------------------------
-- Deliberately a PARTIAL index. Legacy hand-typed references are excluded,
-- because two issued reports already share "001" and issued evidence is never
-- renumbered to satisfy a constraint. Every reference built from here on must
-- be unique within its organisation.

drop index if exists public.reports_generated_reference_unique;
create unique index reports_generated_reference_unique
  on public.reports (organisation_id, reference)
  where reference ~ '^[A-Z0-9]{2,6}-[0-9]{4}-[0-9]{2}-[0-9]{3,}$';

-- --------------------------------------------------------------------------
-- 7. Backfill the blank drafts
-- --------------------------------------------------------------------------
-- Eight reports were created before the builder and carry no reference at all.
-- All eight are drafts; this touches nothing that has been issued. The
-- immutability trigger permits this because the transition is blank -> set.

do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id, organisation_id, survey_type_snapshot, report_date, created_at
      from public.reports
     where (reference is null or btrim(reference) = '')
       and status <> 'issued'
     order by created_at
  loop
    update public.reports
       set reference = public.next_report_reference(
             r.organisation_id,
             r.survey_type_snapshot,
             coalesce(r.report_date, r.created_at::date)
           )
     where id = r.id;
    n := n + 1;
  end loop;
  raise notice 'report_reference_builder: filled % draft reference(s)', n;
end $$;
