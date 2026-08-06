import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/query-states";
import { useOrganisations } from "@/lib/use-organisations";

/**
 * Every application route sits under this gate. A signed-out visitor is sent
 * to the sign-in screen before any application chrome renders — there is no
 * placeholder portfolio for someone who is not signed in.
 *
 * `ssr: false` because the Supabase session lives in browser storage; gating
 * server-side would loop on every hard refresh.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth/sign-in" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const { organisationIds, loading, error } = useOrganisations();

  const needsOrganisation = !loading && !error && organisationIds.length === 0;

  useEffect(() => {
    // The create-organisation flow already lives on the callback screen.
    if (needsOrganisation) navigate({ to: "/auth/callback", replace: true });
  }, [needsOrganisation, navigate]);

  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Checking your organisation membership…" />
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <ErrorState title="Could not read your organisation membership" error={error} />
      </AppShell>
    );
  }

  if (needsOrganisation) {
    return (
      <AppShell>
        <LoadingState label="Taking you to set up your organisation…" />
      </AppShell>
    );
  }

  return <Outlet />;
}
