-- The instructDABS early-access list.
--
-- The family launcher's showcase for instructDABS offers an email field ("tell
-- me when it opens"). That address has to land somewhere, and this is it: one
-- row per request, nothing more. There is no mail behind it yet, and the page
-- copy says so - the address is collected, not contacted.
--
-- Deliberately NOT readable through the API. RLS is on, an anonymous visitor
-- may INSERT and nothing else - no SELECT policy exists, so the list can never
-- be scraped back out with the public key that ships in the browser. Reading it
-- is a service-role/dashboard job.
--
-- The product column is stored rather than assumed, so the same table can hold
-- a request for any product the launcher later offers.
--
-- Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS public.hub_early_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  product text NOT NULL DEFAULT 'dabs',
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One request per address per product. A repeat simply does nothing rather
  -- than creating a second identical row.
  CONSTRAINT hub_early_access_email_product_key UNIQUE (product, email),
  -- A floor, not a validator: the app checks the shape, this stops nonsense.
  CONSTRAINT hub_early_access_email_shape CHECK (position('@' IN email) > 1)
);

COMMENT ON TABLE public.hub_early_access IS
  'Early-access requests left on the Instruct family launcher (/hub). Write-only from the browser; read with the service role.';
COMMENT ON COLUMN public.hub_early_access.product IS
  'The launcher product id the request came from, e.g. dabs. Stored, never assumed.';

ALTER TABLE public.hub_early_access ENABLE ROW LEVEL SECURITY;

-- Anyone - signed in or not - may leave an address. Nobody may read the list.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hub_early_access'
      AND policyname = 'hub_early_access_insert_anyone'
  ) THEN
    CREATE POLICY "hub_early_access_insert_anyone" ON public.hub_early_access
      FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;
END
$$;
