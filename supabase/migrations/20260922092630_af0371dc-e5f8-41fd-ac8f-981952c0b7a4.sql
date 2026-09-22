do $$
declare
  source_def jsonb;
  new_def jsonb;
  suggestions jsonb := '["Porch","Hallway","Storage cupboard","Living room","Dining room","Kitchen","Conservatory","Stairs","Landing","Bathroom","Bedroom","Ensuite","Toilet","Loft room","Garage","Garden"]'::jsonb;
begin
  select definition
    into source_def
  from public.survey_type_definitions
  where organisation_id is null
    and definition->>'id' = 'property_inventory'
  order by version desc
  limit 1;

  if source_def is null then
    raise exception 'property_inventory definition must exist before applying v5';
  end if;

  new_def := source_def;
  new_def := jsonb_set(new_def, '{version}', '5'::jsonb, true);
  new_def := jsonb_set(new_def, '{photoWorkflow,sectionSuggestions}', suggestions, true);

  if not exists (
    select 1
    from public.survey_type_definitions
    where organisation_id is null
      and definition->>'id' = 'property_inventory'
      and version = 5
  ) then
    insert into public.survey_type_definitions (organisation_id, definition, version, is_active)
    values (null, new_def, 5, true);
  end if;

  update public.survey_type_definitions
    set is_active = false
    where organisation_id is null
      and definition->>'id' = 'property_inventory'
      and version < 5;
end $$;