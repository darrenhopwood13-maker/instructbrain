import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAuthError, requestPasswordReset } from "@/lib/auth";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Report Ready" },
      {
        name: "description",
        content: "Request a password reset link for your Report Ready account.",
      },
      { property: "og:title", content: "Reset your password — Report Ready" },
      { property: "og:description", content: "Request a Report Ready password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      intro="We will email a link that takes you straight to a new-password screen."
      footer={
        <span className="text-muted-foreground">
          Remembered it?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Back to sign in
          </Link>
        </span>
      }
    >
      {sent ? (
        <p className="text-sm leading-relaxed" role="status">
          If an account exists for <span className="font-semibold">{email}</span>, a reset link is on
          its way. Open it on this device. Links expire, so request a fresh one if it has been a
          while.
        </p>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Work email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@practice.co.uk"
            />
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-fail">
              {formError}
            </p>
          ) : null}
          <Button type="submit" variant="brand" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Email me a reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
