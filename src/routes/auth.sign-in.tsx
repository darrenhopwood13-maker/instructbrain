import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeAuthError, signInWithPassword } from "@/lib/auth";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — instructBrain" },
      {
        name: "description",
        content: "Sign in to instructBrain with your email and password.",
      },
      { property: "og:title", content: "Sign in — instructBrain" },
      { property: "og:description", content: "Sign in to your instructBrain account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
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

  return (
    <AuthLayout
      title="Sign in"
      intro="Access your projects, reviews and issued reports."
      footer={
        <span className="text-muted-foreground">
          No account?{" "}
          <Link
            to="/auth/sign-up"
            className="inline-flex min-h-11 items-center font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Sign up
          </Link>
        </span>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-12"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setReveal(!reveal)}
              aria-pressed={reveal}
              aria-label={reveal ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex size-11 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {reveal ? (
                <EyeOff aria-hidden="true" className="size-4" />
              ) : (
                <Eye aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
        </div>

        {formError ? (
          <p role="alert" className="text-sm font-medium text-fail">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="brand" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-sm">
          <Link
            to="/auth/forgot-password"
            className="font-semibold text-brand-accent-ink underline underline-offset-2"
          >
            Forgot password or username?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
