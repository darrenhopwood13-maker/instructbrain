import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_PASSWORD_LENGTH,
  describeAuthError,
  setOwnPassword,
  useSession,
  validatePassword,
} from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — instructBrain" },
      {
        name: "description",
        content: "Choose a new password for your instructBrain account and sign back in.",
      },
      { property: "og:title", content: "Set a new password — instructBrain" },
      { property: "og:description", content: "Choose a new instructBrain password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordProblem = password.length > 0 ? validatePassword(password) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validatePassword(password);
    if (problem) return setFormError(problem);
    if (password !== confirm) return setFormError("The two passwords do not match.");

    setBusy(true);
    try {
      await setOwnPassword(password);
      toast.success("Password updated", { description: "You are signed in with the new password." });
      navigate({ to: "/auth/callback", replace: true });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Set a new password" intro="Checking your reset link.">
        <p className="text-sm text-muted-foreground" role="status">
          One moment…
        </p>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout
        title="This reset link has expired"
        intro="Reset links are one-time and short-lived."
      >
        <Button
          variant="brand"
          className="w-full"
          onClick={() => navigate({ to: "/auth/forgot-password" })}
        >
          Request a new link
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      intro={`Choose a new password for ${user.email ?? "your account"}.`}
    >
      <form className="space-y-5" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordProblem ? true : undefined}
            aria-describedby="new-password-hint"
          />
          <p
            id="new-password-hint"
            className={`text-xs ${passwordProblem ? "font-medium text-fail" : "text-muted-foreground"}`}
          >
            {passwordProblem ??
              `At least ${MIN_PASSWORD_LENGTH} characters. Passwords found in known breaches are rejected.`}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password-confirm">Repeat new password</Label>
          <Input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {formError ? (
          <p role="alert" className="text-sm font-medium text-fail">
            {formError}
          </p>
        ) : null}
        <Button type="submit" variant="brand" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save password and continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}
