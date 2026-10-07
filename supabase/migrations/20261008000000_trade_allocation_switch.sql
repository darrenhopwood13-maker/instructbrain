-- Trade allocation becomes optional.
--
-- Two switches, one meaning:
--   organisations.trade_allocation_enabled  the account default (on for everyone
--                                           who has never touched it)
--   reports.trade_allocation_enabled        one report; NULL inherits the account
--
-- Additive only. No existing row changes value, and no report, finding or
-- published version is touched.

alter table public.organisations
  add column if not exists trade_allocation_enabled boolean not null default true;

alter table public.reports
  add column if not exists trade_allocation_enabled boolean;

comment on column public.organisations.trade_allocation_enabled is
  'Account switch for the trade allocation layer: recipient directories, per-trade extracts, the trade portal and the publish gate. Default true.';

comment on column public.reports.trade_allocation_enabled is
  'Per-report override for the trade allocation layer. NULL inherits the organisation setting.';
