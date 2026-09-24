do $$
declare r record;
begin
  for r in
    select distinct on (definition->>'id', organisation_id) id, organisation_id, definition, version
    from public.survey_type_definitions
    where is_active and (definition->>'requiresTradeAssignment')::boolean is true
    order by definition->>'id', organisation_id, version desc
  loop
    if not (coalesce(r.definition->'standardTrades', '[]'::jsonb) ? 'Principal contractor') then
      insert into public.survey_type_definitions (organisation_id, definition, version, is_active)
      values (
        r.organisation_id,
        jsonb_set(
          jsonb_set(r.definition, '{standardTrades}',
            coalesce(r.definition->'standardTrades', '[]'::jsonb) || '["Principal contractor"]'::jsonb),
          '{version}', to_jsonb(r.version + 1)),
        r.version + 1, true);
      update public.survey_type_definitions set is_active = false where id = r.id;
    end if;
  end loop;
end $$;