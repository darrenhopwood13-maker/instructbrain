import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAuthError, sendMagicLink, signInWithPassword } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Report Ready" },
      {
        name: "description",
        content:
          "Sign in to Report Ready with your email and password, or request a one-time sign-in link.",
      },
      { property: "og:title", content: "Sign in — Report Ready" },
      { property: "og:description", content: "Sign in to your Report Ready account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await signInWithPassword(email.trim(), password);
      navigate({ to: "/auth/callback", replace: true });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  const submitLink = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
      toast.success("Check your email", {
        description: "We have sent a one-time sign-in link to that address.",
      });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      intro="Access your projects, reviews and issued reports."
      footer={
        <span className="text-muted-foreground">
          No account yet?{" "}
          <Link
            to="/auth/sign-up"
            className="font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Create one
          </Link>{" "}
          ·{" "}
          <Link
            to="/auth/accept-invite"
            className="font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Accept an invitation
          </Link>
        </span>
      }
    >
      {sent ? (
        <div className="space-y-4" role="status">
          <p className="text-sm leading-relaxed">
            A sign-in link is on its way to <span className="font-semibold">{email}</span>. Open it
            on this device to continue.
          </p>
          <Button variant="quiet" className="w-full" onClick={() => setSent(false)}>
            Use a different email
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate({ to: "/auth/callback" })}
          >
            I have already signed in
          </Button>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={mode === "password" ? submitPassword : submitLink}>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@practice.co.uk"
            />
          </div>

          {mode === "password" ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs font-semibold text-brand-accent-ink underline underline-offset-2"
                >
                  Forgotten it?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          ) : null}

          {formError ? (
            <p role="alert" className="text-sm font-medium text-fail">
              {formError}
            </p>
          ) : null}

          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy
              ? mode === "password"
                ? "Signing in…"
                : "Sending link…"
              : mode === "password"
                ? "Sign in"
                : "Email me a sign-in link"}
          </Button>

          <Button
            type="button"
            variant="quiet"
            className="w-full"
            onClick={() => {
              setFormError(null);
              setMode(mode === "password" ? "link" : "password");
            }}
          >
            {mode === "password" ? "Email me a link instead" : "Use my password instead"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            A one-time link is easier on site. Nobody but you ever sets your password.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
