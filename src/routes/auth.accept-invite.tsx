import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession, setOwnPassword, sendMagicLink } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/accept-invite")({
  head: () => ({
    meta: [
      { title: "Accept invitation — Report Ready" },
      {
        name: "description",
        content:
          "Accept your invitation to join a Report Ready organisation and start reviewing reports.",
      },
      { property: "og:title", content: "Accept invitation — Report Ready" },
      { property: "og:description", content: "Join your organisation on Report Ready." },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const requestLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      toast.success("Invitation link sent", {
        description: "Open the link in your email to confirm your account.",
      });
    } catch (error) {
      toast.error("Could not send the link", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const choosePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await setOwnPassword(password);
      toast.success("Password set");
      navigate({ to: "/auth/callback" });
    } catch (error) {
      toast.error("Could not set your password", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Accept your invitation"
      intro={
        user
          ? "Your invitation is confirmed. Choose a password if you would like to sign in without a link in future."
          : "Enter the email address your invitation was sent to and we will confirm it with a one-time link."
      }
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Sign in
          </Link>
        </span>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Checking your invitation…</p>
      ) : user ? (
        <form className="space-y-5" onSubmit={choosePassword}>
          <div className="space-y-2">
            <Label htmlFor="invited-email">Signed in as</Label>
            <Input id="invited-email" value={user.email ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Choose a password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              Minimum 10 characters. Only you ever see this — no administrator can set it for you.
            </p>
          </div>
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Set password and continue"}
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={requestLink}>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Work email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@practice.co.uk"
            />
          </div>
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Confirm my invitation"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
