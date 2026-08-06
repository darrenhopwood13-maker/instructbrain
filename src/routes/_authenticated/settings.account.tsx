import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_PASSWORD_LENGTH,
  changePassword,
  describeAuthError,
  signOut,
  useSession,
  validatePassword,
} from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => ({
    meta: [
      { title: "Account settings — Report Ready" },
      {
        name: "description",
        content: "Change the password on your Report Ready account or sign out of every device.",
      },
      { property: "og:title", content: "Account settings — Report Ready" },
      { property: "og:description", content: "Manage your Report Ready sign-in details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountSettings,
});

function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordProblem = next.length > 0 ? validatePassword(next) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validatePassword(next);
    if (problem) return setFormError(problem);
    if (next !== confirm) return setFormError("The two new passwords do not match.");

    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed", { description: "Use it the next time you sign in." });
    } catch (error) {
      setFormError(describeAuthError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <p className="eyebrow">Your account</p>
      <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">Account</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Signed in as <span className="font-semibold text-foreground">{user?.email ?? "—"}</span>. Only
        you can set your password — no administrator can see it or set one for you.
      </p>

      <form className="mt-8 max-w-md space-y-6" onSubmit={submit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Signed in with a one-time link and never set a password? Use “Forgotten it?” on the
            sign-in screen to create one.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-new-password">New password</Label>
          <Input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-invalid={passwordProblem ? true : undefined}
            aria-describedby="account-password-hint"
          />
          <p
            id="account-password-hint"
            className={`text-xs ${passwordProblem ? "font-medium text-fail" : "text-muted-foreground"}`}
          >
            {passwordProblem ??
              `At least ${MIN_PASSWORD_LENGTH} characters. Passwords found in known breaches are rejected.`}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-confirm-password">Repeat new password</Label>
          <Input
            id="account-confirm-password"
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

        <div className="rule-top pt-6">
          <Button type="submit" variant="brand" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>

      <div className="rule-top mt-10 max-w-md pt-6">
        <h2 className="text-base font-semibold">Sign out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ends the session on every device signed in with this account.
        </p>
        <Button
          type="button"
          variant="quiet"
          className="mt-3"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth/sign-in", replace: true });
          }}
        >
          Sign out everywhere
        </Button>
      </div>
    </AppShell>
  );
}
