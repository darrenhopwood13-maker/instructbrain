import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/accept-invite")({
  head: () => ({
    meta: [
      { title: "Accept invitation — Report Ready" },
      {
        name: "description",
        content: "Accept your invitation to join a Report Ready organisation and start reviewing reports.",
      },
      { property: "og:title", content: "Accept invitation — Report Ready" },
      { property: "og:description", content: "Join your organisation on Report Ready." },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  return (
    <AuthLayout
      title="Accept your invitation"
      intro="Okonjo Building Consultancy has invited you to join Report Ready as a reviewer."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-brand-purple-ink underline underline-offset-2"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          toast.info("Invitations are not connected yet", {
            description: "This screen is presentation only in the current release.",
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="full-name">Full name</Label>
          <Input id="full-name" autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Work email</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            defaultValue="r.patel@practice.co.uk"
            readOnly
            aria-describedby="invite-email-hint"
          />
          <p id="invite-email-hint" className="text-xs text-muted-foreground">
            This is the address the invitation was sent to and cannot be changed.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Choose a password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" required />
        </div>
        <Button type="submit" variant="brand" className="w-full">
          Accept invitation
        </Button>
      </form>
    </AuthLayout>
  );
}
