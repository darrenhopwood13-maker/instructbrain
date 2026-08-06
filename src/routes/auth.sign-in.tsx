import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          toast.info("Sign-in is not connected yet", {
            description: "Authentication will be wired to your own backend in a later step.",
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" required placeholder="name@practice.co.uk" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" variant="brand" className="w-full">
          Sign in
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          UI only in this release — no credentials are sent anywhere.
        </p>
      </form>
    </AuthLayout>
  );
}
