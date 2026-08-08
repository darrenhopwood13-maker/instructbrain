create or replace function public.next_finding_ref(_report_id uuid, _prefix text default 'F')
returns table (ref text, sequence integer)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare _n integer; _s integer;
begin
  if not (public.is_org_member(public.report_org(_report_id)) or public.is_platform_admin()) then
    raise exception 'not permitted for this report';
  end if;

  -- Serialise allocation per report: concurrent analysis can never collide.
  perform pg_advisory_xact_lock(hashtextextended(_report_id::text, 0));

  select coalesce(max((regexp_match(f.ref, '(\d+)\s*$'))[1]::integer), 0),
         coalesce(max(f.sequence), 0)
    into _n, _s
    from public.findings f
   where f.report_id = _report_id;

  ref := _prefix || '-' || lpad((_n + 1)::text, 3, '0');
  sequence := _s + 1;
  return next;
end; $$;

revoke all on function public.next_finding_ref(uuid, text) from public;
grant execute on function public.next_finding_ref(uuid, text) to authenticated, service_role;