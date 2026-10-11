-- Stamp the actor's display name onto each audit row.
--
-- Why denormalise, when actor_id already exists: the name lives only in
-- auth.users.raw_user_meta_data, which the browser client cannot read under RLS.
-- Without this column the dashboard can say "an admin closed this" but never
-- "Joe Abbott closed this" - and naming the person is the whole point of the
-- activity feed.
--
-- An audit record should also say who did what AS AT THE TIME, so a name stamped
-- here survives someone being renamed, or leaving the organisation, and does not
-- retroactively change when it would be least welcome. It keeps the feed a plain
-- RLS read with no service-role function behind it.
--
-- Nullable on purpose: rows written before this migration have no stamped name
-- until the backfill below runs, and a token-link event has no user at all (its
-- actor_name is the trade, e.g. "Electrical").

alter table public.audit_log add column if not exists actor_name text;

comment on column public.audit_log.actor_name is
  'Display name of whoever caused this event, as at the time. For an app or email action this is the user''s full_name; for a trade-link action it is the trade or its label. Null on rows written before 11 Oct 2026.';

-- Backfill what can be recovered. Only fills rows that are still null, so it is
-- safe to re-run and will never overwrite a stamped name.
update public.audit_log a
set actor_name = coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1)
    )
from auth.users u
where u.id = a.actor_id
  and a.actor_name is null
  and a.actor_id is not null;
