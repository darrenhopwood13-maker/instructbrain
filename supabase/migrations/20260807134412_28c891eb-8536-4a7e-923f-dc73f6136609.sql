
-- 1. Plan lookup ------------------------------------------------------
CREATE TABLE public.plan_limits (
  plan text PRIMARY KEY,
  label text NOT NULL,
  price_gbp integer,
  report_allowance integer,
  photo_cap_per_report integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plan_limits TO authenticated;
GRANT SELECT ON public.plan_limits TO anon;
GRANT ALL ON public.plan_limits TO service_role;

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan limits are readable" ON public.plan_limits
  FOR SELECT TO authenticated, anon USING (true);

CREATE TRIGGER plan_limits_set_updated_at BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plan_limits (plan, label, price_gbp, report_allowance, photo_cap_per_report, sort_order) VALUES
  ('free',     'Free',     0,    3,    30,   1),
  ('standard', 'Standard', 49,   10,   200,  2),
  ('pro',      'Pro',      99,   30,   500,  3),
  ('custom',   'Custom',   NULL, NULL, NULL, 4),
  ('internal', 'Internal', NULL, NULL, NULL, 5);

-- 2. Organisation plan columns ----------------------------------------
ALTER TABLE public.organisations
  ADD COLUMN plan text NOT NULL DEFAULT 'free' REFERENCES public.plan_limits(plan),
  ADD COLUMN report_allowance integer,
  ADD COLUMN photo_cap_per_report integer;

-- Fill allowances from the lookup whenever the plan is set or changed.
CREATE OR REPLACE FUNCTION public.organisations_apply_plan_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
declare _l public.plan_limits%rowtype;
begin
  if tg_op = 'INSERT' or new.plan is distinct from old.plan then
    select * into _l from public.plan_limits where plan = new.plan;
    if found then
      new.report_allowance := _l.report_allowance;
      new.photo_cap_per_report := _l.photo_cap_per_report;
    end if;
  end if;
  return new;
end; $$;

CREATE TRIGGER organisations_apply_plan_defaults
  BEFORE INSERT OR UPDATE OF plan ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.organisations_apply_plan_defaults();

UPDATE public.organisations o
SET report_allowance = l.report_allowance,
    photo_cap_per_report = l.photo_cap_per_report
FROM public.plan_limits l
WHERE l.plan = o.plan;

-- The founding organisation (earliest owner membership) is internal.
UPDATE public.organisations
SET plan = 'internal'
WHERE id = (
  SELECT m.organisation_id FROM public.memberships m
  WHERE m.role = 'owner'
  ORDER BY m.created_at ASC
  LIMIT 1
);

-- 3. Creation ledger: deleting a report must not restore allowance -----
CREATE TABLE public.report_creation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX report_creation_events_org_month
  ON public.report_creation_events (organisation_id, created_at);

GRANT SELECT ON public.report_creation_events TO authenticated;
GRANT ALL ON public.report_creation_events TO service_role;

ALTER TABLE public.report_creation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read their creation events" ON public.report_creation_events
  FOR SELECT TO authenticated USING (public.is_org_member(organisation_id));

-- Backfill from existing reports so current usage is honest.
INSERT INTO public.report_creation_events (organisation_id, report_id, created_at)
SELECT r.organisation_id, r.id, r.created_at FROM public.reports r;

CREATE OR REPLACE FUNCTION public.reports_record_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  insert into public.report_creation_events (organisation_id, report_id, created_at)
  values (new.organisation_id, new.id, new.created_at);
  return new;
end; $$;

CREATE TRIGGER reports_record_creation
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_record_creation();

-- 4. Enforcement -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reports_enforce_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare _allowance integer; _used integer;
begin
  select o.report_allowance into _allowance
  from public.organisations o where o.id = new.organisation_id;

  -- NULL allowance means unlimited: short-circuit, never treat as zero.
  if _allowance is null then
    return new;
  end if;

  select count(*) into _used
  from public.report_creation_events e
  where e.organisation_id = new.organisation_id
    and e.created_at >= date_trunc('month', (now() at time zone 'utc')) at time zone 'utc'
    and e.created_at <  (date_trunc('month', (now() at time zone 'utc')) + interval '1 month') at time zone 'utc';

  if _used >= _allowance then
    raise exception 'Report allowance reached for this month. Your plan includes % reports.', _allowance
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;

CREATE TRIGGER reports_enforce_allowance
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_enforce_allowance();

CREATE OR REPLACE FUNCTION public.photos_enforce_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare _cap integer; _used integer;
begin
  select o.photo_cap_per_report into _cap
  from public.reports r join public.organisations o on o.id = r.organisation_id
  where r.id = new.report_id;

  if _cap is null then
    return new;
  end if;

  select count(*) into _used from public.photos p where p.report_id = new.report_id;

  if _used >= _cap then
    raise exception 'Photo limit reached for this report. Your plan includes % photos per report.', _cap
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;

CREATE TRIGGER photos_enforce_cap
  BEFORE INSERT ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.photos_enforce_cap();

-- 5. Keep helper functions off anon, consistent with the rest of the db.
REVOKE EXECUTE ON FUNCTION public.organisations_apply_plan_defaults() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reports_record_creation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reports_enforce_allowance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.photos_enforce_cap() FROM PUBLIC, anon, authenticated;
