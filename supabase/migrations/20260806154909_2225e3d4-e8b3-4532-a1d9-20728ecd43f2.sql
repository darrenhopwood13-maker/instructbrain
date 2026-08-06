alter table public.organisations
  add column if not exists ai_monthly_cost_cap numeric not null default 25;

alter table public.findings
  add column if not exists ai_abstain_reason text,
  add column if not exists ai_tier text,
  add column if not exists ai_region jsonb,
  add column if not exists severity_rationale text;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  report_id uuid references public.reports(id) on delete set null,
  photo_id uuid references public.photos(id) on delete set null,
  tier text not null,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric not null default 0,
  cached boolean not null default false,
  outcome text not null default 'ok',
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_org_created_idx
  on public.ai_usage_events (organisation_id, created_at desc);
create index if not exists ai_usage_events_report_idx
  on public.ai_usage_events (report_id);

grant select, insert on public.ai_usage_events to authenticated;
grant all on public.ai_usage_events to service_role;
alter table public.ai_usage_events enable row level security;

create policy "ai_usage_events_select" on public.ai_usage_events
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "ai_usage_events_insert" on public.ai_usage_events
  for insert to authenticated with check (public.is_org_member(organisation_id));

create table if not exists public.ai_analysis_cache (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  checksum text not null,
  snapshot_key text not null,
  provider text not null,
  model text not null,
  tier text not null,
  raw_output jsonb,
  envelope jsonb not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, checksum, snapshot_key)
);

create index if not exists ai_analysis_cache_lookup_idx
  on public.ai_analysis_cache (organisation_id, checksum, snapshot_key);

grant select, insert, update, delete on public.ai_analysis_cache to authenticated;
grant all on public.ai_analysis_cache to service_role;
alter table public.ai_analysis_cache enable row level security;

create policy "ai_analysis_cache_select" on public.ai_analysis_cache
  for select to authenticated using (public.is_org_member(organisation_id));
create policy "ai_analysis_cache_insert" on public.ai_analysis_cache
  for insert to authenticated with check (public.is_org_member(organisation_id));
create policy "ai_analysis_cache_update" on public.ai_analysis_cache
  for update to authenticated using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));
create policy "ai_analysis_cache_delete" on public.ai_analysis_cache
  for delete to authenticated using (public.is_org_member(organisation_id));