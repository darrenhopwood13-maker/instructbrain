import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganisation, fetchMemberships, useSession } from "@/lib/auth";
import { safeNext } from "@/lib/next-destination";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({ next: safeNext(search["next"]) }),
  head: () => ({
    meta: [
      { title: "Completing sign in — instructBrain" },
      { name: "description", content: "Finishing your instructBrain sign in." },
      { property: "og:title", content: "Completing sign in — instructBrain" },
      { property: "og:description", content: "Finishing your instructBrain sign in." },
    ],
  }),
  ssr: false,
  component: AuthCallback,

});

function AuthCallback() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const destination = next ?? "/projects";
  const { user, loading } = useSession();

  const [needsOrganisation, setNeedsOrganisation] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  useEffect(() => {
    // Supabase reports an unusable link in the URL fragment or query string.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("error_code") ?? query.get("error_code");
    const err = hash.get("error") ?? query.get("error");
    if (code || err) {
      setLinkProblem(
        code === "otp_expired" || `${err}`.includes("expired")
          ? "That link has expired or has already been used."
          : "That link is no longer valid.",
      );
    }
  }, []);

  useEffect(() => {
    if (linkProblem) return;
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth/sign-in", replace: true });
      return;
    }
    let cancelled = false;
    fetchMemberships(user)
      .then((memberships) => {
        if (cancelled) return;
        if (memberships.length === 0) setNeedsOrganisation(true);
        else navigate({ to: destination, replace: true });
      })
      .catch(() => {
        if (!cancelled) setNeedsOrganisation(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, user, navigate, linkProblem, destination]);


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await createOrganisation(orgName.trim());
      toast.success("Organisation created", {
        description: "You are the owner and can invite colleagues from Settings.",
      });
      navigate({ to: destination, replace: true });
    } catch (error) {
      toast.error("Could not create the organisation", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (linkProblem) {
    return (
      <AuthLayout
        title="This link cannot be used"
        intro="Sign-in and reset links are one-time and short-lived."
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" role="status">
            {linkProblem} Request a fresh one and open it on this device.
          </p>
          <Button
            variant="brand"
            className="w-full"
            onClick={() => navigate({ to: "/auth/sign-in", replace: true })}
          >
            Send me a new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!needsOrganisation) {
    return (
      <AuthLayout title="Signing you in" intro="One moment while we confirm your account.">
        <p className="text-sm text-muted-foreground" role="status">
          Checking your organisation membership…
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your organisation"
      intro="You are the first person here. Name your practice or contractor — you become its owner."
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="org-name">Organisation name</Label>
          <Input
            id="org-name"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Okonjo Building Consultancy"
          />
        </div>
        <Button type="submit" variant="brand" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create organisation"}
        </Button>
      </form>
    </AuthLayout>
  );
}
