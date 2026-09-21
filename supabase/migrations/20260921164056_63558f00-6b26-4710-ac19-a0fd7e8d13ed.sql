do $$
declare
  source_def jsonb;
  new_def jsonb;
  backing_pages jsonb := $pages$
[
  {
    "title": "Inventory guidance notes",
    "body": [
      "This inventory records the visible contents, fixtures and fittings photographed at the time of inspection. Each room section shows the room overview photographs first, followed by the item schedule recorded for that room.",
      "Item photographs are reproduced at the rear of the report in upload order. The photograph number shown in the table links the schedule entry to the matching photograph.",
      "The Check Out Comment column is left available for end-of-tenancy or close-out notes. It should be completed by a person before it is relied on as a check-out record.",
      "Any item marked Not assessed was not resolved automatically and requires human review before the report is issued."
    ]
  },
  {
    "title": "Check-in notes",
    "body": [
      "The inventory should be checked at the start of occupation and any differences recorded before the report is issued or relied on.",
      "Where a photograph does not support a condition judgement, the item remains Not assessed until a person resolves it."
    ]
  },
  {
    "title": "Check-out report wording",
    "body": [
      "Check-out comments are recorded separately from the original inventory condition so later observations do not overwrite the original record.",
      "Any charge, liability or commercial decision must be confirmed by a person before distribution."
    ]
  },
  {
    "title": "Schedule of condition",
    "body": [
      "The condition wording is based on the photographs supplied and the information recorded on site. The report is intended as a professional record of the photographed inventory."
    ]
  },
  {
    "title": "Keys and meter readings",
    "body": [
      "Keys, fobs, access devices and meter readings should be recorded here when captured as part of the inventory evidence."
    ]
  }
]
$pages$::jsonb;
begin
  select definition
    into source_def
  from public.survey_type_definitions
  where organisation_id is null
    and definition->>'id' = 'property_inventory'
  order by version desc
  limit 1;

  if source_def is null then
    raise exception 'property_inventory definition must exist before applying v4';
  end if;

  new_def := source_def;
  new_def := jsonb_set(new_def, '{version}', '4'::jsonb, true);
  new_def := jsonb_set(new_def, '{photoWorkflow,roles,2,maxFindingsPerPhoto}', '1'::jsonb, true);
  new_def := jsonb_set(new_def, '{reportLayout,backingPages}', backing_pages, true);

  if not exists (
    select 1
    from public.survey_type_definitions
    where organisation_id is null
      and definition->>'id' = 'property_inventory'
      and version = 4
  ) then
    insert into public.survey_type_definitions (organisation_id, definition, version, is_active)
    values (null, new_def, 4, true);
  end if;

  update public.survey_type_definitions
    set is_active = false
    where organisation_id is null
      and definition->>'id' = 'property_inventory'
      and version < 4;
end $$;