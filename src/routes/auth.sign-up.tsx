import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  signUpWithPassword,
  validatePassword,
} from "@/lib/auth";
import { type NextDestination, safeNext } from "@/lib/next-destination";


export const Route = createFileRoute("/auth/sign-up")({
  validateSearch: (search: Record<string, unknown>): { next?: NextDestination } => {
    const next = safeNext(search["next"]);
    return next ? { next } : {};
  },

  head: () => ({
    meta: [
      { title: "Create an account — instructBrain" },
      {
        name: "description",
        content:
          "Create a instructBrain account to turn site photographs into client-ready construction reports.",
      },
      { property: "og:title", content: "Create an account — instructBrain" },
      {
        property: "og:description",
        content: "Set up your instructBrain account with an email and your own password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const passwordProblem = password.length > 0 ? validatePassword(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validatePassword(password);
    if (problem) return setFormError(problem);
    if (password !== confirm) return setFormError("The two passwords do not match.");

    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithPassword(email.trim(), password);
      if (needsConfirmation) setCheckEmail(true);
      else navigate({ to: "/auth/callback", search: next ? { next } : {}, replace: true });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  if (checkEmail) {
    return (
      <AuthLayout
        title="Confirm your email"
        intro="Your account exists but is not active yet."
      >
        <div className="space-y-4" role="status">
          <p className="text-sm leading-relaxed">
            We have emailed a confirmation link to{" "}
            <span className="font-semibold">{email}</span>. Open it to activate the account, then
            sign in with the password you just chose.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nothing arrived after a few minutes? The default email sender is rate-limited — wait and
            request the confirmation email again.
          </p>
          <Button variant="brand" className="w-full" onClick={() => navigate({ to: "/auth/sign-in" })}>
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="3 free reports — no card needed"
      intro="Turn site photographs into a client-ready report in minutes. Email and a password you choose — that is the whole sign-up."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="inline-flex min-h-11 items-center font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Work email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@practice.co.uk"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Choose a password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordProblem ? true : undefined}
            aria-describedby="signup-password-hint"
          />
          <p
            id="signup-password-hint"
            className={`text-xs ${passwordProblem ? "font-medium text-fail" : "text-muted-foreground"}`}
          >
            {passwordProblem ??
              `At least ${MIN_PASSWORD_LENGTH} characters. Passwords found in known breaches are rejected.`}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-confirm">Repeat password</Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch ? true : undefined}
            aria-describedby="signup-confirm-hint"
          />
          {mismatch ? (
            <p id="signup-confirm-hint" className="text-xs font-medium text-fail">
              The two passwords do not match.
            </p>
          ) : null}
        </div>

        {formError ? (
          <p role="alert" className="text-sm font-medium text-fail">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="brand" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
