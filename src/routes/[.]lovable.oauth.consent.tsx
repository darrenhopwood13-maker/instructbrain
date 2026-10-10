import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string } } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connect an agent — instructBrain" },
      { name: "description", content: "Approve an AI assistant's access to your instructBrain account." },
      { property: "og:title", content: "Connect an agent — instructBrain" },
      { property: "og:description", content: "Approve an AI assistant's access to instructBrain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth/sign-in", search: { next: location.pathname + location.searchStr } });
    }
  },
  loader: async ({ location }) => {
    // A link with no id is not an error - it is a link that arrived without its
    // details, and the screen below says so in plain words. Throwing here put a
    // raw "Missing authorization_id" in front of the person, and an uncaught
    // error in the console.
    const id = new URLSearchParams(location.search).get("authorization_id");
    if (!id) return null;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: () => (
    <AuthLayout
      title="We could not read that connection request"
      intro="The link may have expired, or been copied only part of the way. Ask whoever sent it for a fresh one, then try again."
    >
      <span />
    </AuthLayout>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = details?.client?.name ?? "An AI assistant";

  // Arrived without its details: say that in words a person can act on, rather
  // than showing a field name from the auth library.
  if (!authorization_id || !details) {
    return (
      <AuthLayout
        title="This connection link is incomplete"
        intro="The link arrived without the details needed to connect an agent. Ask whoever sent it to start the connection again."
      >
        <span />
      </AuthLayout>
    );
  }

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (error || !target) {
      setBusy(false);
      setError(error?.message ?? "No redirect was returned.");
      return;
    }
    window.location.href = target;
  }

  return (
    <AuthLayout title={`Connect ${name}`} intro="It will be able to read your projects and reports as you. It cannot send or change anything.">
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-3">
        <Button variant="brand" className="min-h-11 w-full" disabled={busy} onClick={() => decide(true)}>Approve</Button>
        <Button variant="quiet" className="min-h-11 w-full" disabled={busy} onClick={() => decide(false)}>Deny</Button>
      </div>
    </AuthLayout>
  );
}
