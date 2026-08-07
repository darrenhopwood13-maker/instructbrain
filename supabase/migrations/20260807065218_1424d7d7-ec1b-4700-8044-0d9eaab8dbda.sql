ALTER TABLE public.report_shares ALTER COLUMN expires_at DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.report_shares_expiry_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
declare _status text;
begin
  if new.expires_at is null then
    select r.status into _status from public.reports r where r.id = new.report_id;
    if _status is distinct from 'issued' then
      raise exception 'a link with no expiry is only allowed once the report has been issued';
    end if;
  end if;
  return new;
end; $$;

DROP TRIGGER IF EXISTS report_shares_expiry_rules ON public.report_shares;
CREATE TRIGGER report_shares_expiry_rules
BEFORE INSERT OR UPDATE ON public.report_shares
FOR EACH ROW EXECUTE FUNCTION public.report_shares_expiry_rules();