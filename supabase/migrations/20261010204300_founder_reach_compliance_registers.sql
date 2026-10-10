-- Founder reach: the compliance register tables were left out of the platform
-- administrator's blanket policy (and so were a handful of tables added after
-- it was written).
--
-- The gap: register tables only carry organisation-role policies, so a
-- platform administrator could read or delete a register ONLY in an
-- organisation they happened to be a member of. The founder oversight page
-- therefore could not list, or clear, a register on any other account --
-- which is exactly what is needed while the product is being tested.
--
-- Additive only. Postgres ORs permissive policies together, so this ADDS
-- reach for everyone on public.platform_admins and changes nothing at all for
-- any other user: every existing organisation policy is left untouched.

do $$
declare t text;
begin
  foreach t in array array[
    'compliance_runs',
    'compliance_points',
    'compliance_entries',
    'compliance_actions',
    'photo_markups',
    'report_templates',
    'report_reference_codes',
    'report_reference_counters',
    'deleted_report_backup',
    'hub_early_access'
  ] loop
    execute format('drop policy if exists "platform admin full access" on public.%I', t);
    execute format(
      'create policy "platform admin full access" on public.%I for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin())',
      t
    );
  end loop;
end $$;
