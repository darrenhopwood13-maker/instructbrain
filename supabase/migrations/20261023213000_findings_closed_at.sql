-- Findings gain a close-out timestamp.
--
-- Until now an item recorded when it was raised and its target date, but nothing recorded when it
-- was signed off - so "how long does it take us to close things" could not be answered, only inferred
-- from what happened to be still open on the day you looked.
--
-- The trigger stamps closed_at when an item enters a closed lifecycle state and clears it if the item
-- is reopened, so the column can never disagree with lifecycle_state.

alter table public.findings add column if not exists closed_at timestamptz;

create or replace function public.findings_stamp_closed_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  closed_states text[] := array['verified', 'closed', 'complete', 'completed'];
  was_closed boolean;
  is_closed boolean;
begin
  was_closed := lower(coalesce(old.lifecycle_state, '')) = any(closed_states);
  is_closed := lower(coalesce(new.lifecycle_state, '')) = any(closed_states);

  if is_closed and (not was_closed or new.closed_at is null) then
    new.closed_at := now();
  elsif not is_closed then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists findings_stamp_closed_at on public.findings;
create trigger findings_stamp_closed_at
  before update on public.findings
  for each row execute function public.findings_stamp_closed_at();

-- Items already closed have no recorded close date. The last update is the closest evidence there
-- is, and it is better than a blank: the UI says plainly that pre-existing closes are dated from
-- their last update, so nobody reads them as measured cycle times.
update public.findings
set closed_at = updated_at
where closed_at is null
  and lower(coalesce(lifecycle_state, '')) in ('verified', 'closed', 'complete', 'completed');

create index if not exists findings_closed_at_idx on public.findings (closed_at);
