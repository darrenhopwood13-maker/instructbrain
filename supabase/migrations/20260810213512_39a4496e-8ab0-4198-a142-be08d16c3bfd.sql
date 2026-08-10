-- 1. Restrict plan_limits reads to signed-in users only
DROP POLICY IF EXISTS "plan_limits are readable by everyone" ON public.plan_limits;
DROP POLICY IF EXISTS "plan_limits readable" ON public.plan_limits;
DROP POLICY IF EXISTS "Anyone can read plan limits" ON public.plan_limits;
DROP POLICY IF EXISTS "plan_limits_read" ON public.plan_limits;
DROP POLICY IF EXISTS "plan_limits select" ON public.plan_limits;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='plan_limits' AND cmd='SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.plan_limits', p.policyname);
  END LOOP;
END $$;

REVOKE SELECT ON public.plan_limits FROM anon;
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;

CREATE POLICY "Signed-in users can read plan limits"
  ON public.plan_limits FOR SELECT TO authenticated USING (true);

-- 2. Revoke anon EXECUTE on SECURITY DEFINER functions in the public schema
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM anon, public', f.proname, f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', f.proname, f.args);
  END LOOP;
END $$;