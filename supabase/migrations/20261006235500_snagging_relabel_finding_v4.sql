-- Relabel the snagging survey type from "Snag" to "Finding".
--
-- House rule (see .lovable/plan/report-templates-one-library-used-everywhere-2026-09-10.md
-- and UI-OVERHAUL-BRIEF.md): a definition is versioned, and a relabel is a NEW
-- version row, never a mutation of the existing one. Existing reports hold their
-- own survey_type_snapshot and must not change retrospectively.
--
-- The stored status id stays 'snag' - it is a value in the database, not a word
-- anyone reads. Only the two labels a person sees are changed.
--
-- Applied to krwphsejinmlwvtwugwk on 2026-10-06; version 4 is active.

do $$
declare
  src_id uuid;
  base jsonb;
  newdef jsonb;
  next_version integer;
begin
  -- The highest version currently held for this type.
  select coalesce(max(version), 0) into next_version
  from public.survey_type_definitions
  where definition->>'id' = 'snagging' and organisation_id is null;

  -- Already relabelled? Then there is nothing to do.
  if exists (
    select 1 from public.survey_type_definitions
    where definition->>'id' = 'snagging'
      and organisation_id is null
      and is_active
      and definition->>'label' = 'Finding identification & remedial schedule'
  ) then
    return;
  end if;

  select id, definition into src_id, base
  from public.survey_type_definitions
  where definition->>'id' = 'snagging'
    and organisation_id is null
    and is_active;

  if src_id is null then
    raise exception 'no active snagging definition to relabel';
  end if;

  newdef := jsonb_set(
              jsonb_set(base, '{label}', '"Finding identification & remedial schedule"'::jsonb),
              '{statuses,0,label}', '"Finding — rectification required"'::jsonb);
  newdef := jsonb_set(newdef, '{version}', to_jsonb(next_version + 1));

  insert into public.survey_type_definitions (organisation_id, definition, version, is_active)
  values (null, newdef, next_version + 1, true);

  update public.survey_type_definitions
     set is_active = false
   where id = src_id;
end $$;
