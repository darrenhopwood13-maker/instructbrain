import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Report Ready" },
      {
        name: "description",
        content: "Sign in to Report Ready to review site photographs and issue construction reports.",
      },
      { property: "og:title", content: "Sign in — Report Ready" },
      { property: "og:description", content: "Sign in to your Report Ready account." },
    ],
  }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
      toast.success("Check your email", {
        description: "We have sent a one-time sign-in link to that address.",
      });
    } catch (error) {
      toast.error("Could not send the sign-in link", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      intro="Access your projects, reviews and issued reports."
      footer={
        <span className="text-muted-foreground">
          Invited by a colleague?{" "}
          <Link
            to="/auth/accept-invite"
            className="font-semibold text-brand-purple-ink underline underline-offset-2"
          >
            Accept your invitation
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
          <Button type="submit" variant="brand" className="w-full" disabled={sending}>
            {sending ? "Sending link…" : "Email me a sign-in link"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Passwordless by default. You set your own password later if you want one.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
