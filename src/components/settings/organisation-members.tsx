import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/query-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteOrganisationMember,
  listOrganisationMembers,
  normaliseEmail,
  type OrganisationRole,
} from "@/lib/organisation/members.functions";

/**
 * Who is in this organisation, and a button to put someone new in it.
 *
 * Before this, the only way to add a second person was to insert a membership
 * row by hand in the database. The form is one email and one role; the role
 * carries the consequence in writing, because "owner" can delete the whole
 * organisation and nobody would guess that from a drop-down.
 */

const ROLES: Array<{ value: OrganisationRole; label: string; note: string }> = [
  // The two field/desk sides of the product, stated as what each can reach rather than as a
  // job title, because the title is what made "Supervisor" sound like a site role.
  { value: "surveyor", label: "Surveyor", note: "On site: captures photographs and writes reports. No estate map." },
  { value: "supervisor", label: "Supervisor / director", note: "Reviews performance and signs reports off. The estate map, no capture." },
  { value: "viewer", label: "Viewer", note: "Can read reports, cannot change them." },
  { value: "admin", label: "Admin", note: "Everything a surveyor can do, plus settings and people." },
  { value: "owner", label: "Owner", note: "Full control, including deleting this organisation." },
];

export function OrganisationMembers({ organisationId }: { organisationId: string }) {
  const queryClient = useQueryClient();
  const load = useServerFn(listOrganisationMembers);
  const invite = useServerFn(inviteOrganisationMember);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganisationRole>("surveyor");

  const members = useQuery({
    queryKey: ["organisation-members", organisationId],
    queryFn: () => load({ data: { organisationId } }),
  });

  const send = useMutation({
    mutationFn: async () =>
      invite({ data: { organisationId, email: normaliseEmail(email), role } }),
    onSuccess: async (outcome) => {
      if (!outcome.ok) {
        toast.error("That person was not added", { description: outcome.reason });
        return;
      }
      setOpen(false);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["organisation-members", organisationId] });
      toast.success(`${outcome.email} is now a ${outcome.role}`, {
        description: outcome.emailed
          ? "We emailed them an invitation link. Nothing else is needed."
          : "They already had an instructBrain account, so they are in already - ask them to sign in.",
      });
    },
    onError: (error) =>
      toast.error("That person was not added", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  const chosen = ROLES.find((entry) => entry.value === role);

  return (
    <section aria-labelledby="members-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="members-heading" className="text-base font-semibold">
          People in this organisation
        </h2>
        <Button
          type="button"
          variant="quiet"
          className="min-h-11"
          onClick={() => setOpen(true)}
        >
          <UserPlus aria-hidden="true" className="size-4" />
          Invite someone
        </Button>
      </div>

      {members.isPending ? (
        <LoadingState label="Loading the people in your organisation…" />
      ) : members.isError ? (
        <ErrorState
          title="The people in this organisation could not be loaded"
          error={members.error}
          onRetry={() => void members.refetch()}
        />
      ) : members.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody is in this organisation yet.</p>
      ) : (
        <ul className="grid gap-2">
          {members.data.map((member) => (
            <li
              key={member.userId}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{member.email}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {member.roleLabel}
                {member.isYou ? " - you" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEmail("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite someone</DialogTitle>
            <DialogDescription>
              They join this organisation, not a new one. If they have never used instructBrain we create
              their account and email them a link; if they already have an account, they simply appear in
              the list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-person-email">Their work email</Label>
              <Input
                id="invite-person-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.co.uk"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-person-role">What they can do</Label>
              <select
                id="invite-person-role"
                value={role}
                onChange={(event) => setRole(event.target.value as OrganisationRole)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
              {chosen ? <p className="text-xs text-muted-foreground">{chosen.note}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="quiet" type="button" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              className="min-h-11"
              disabled={send.isPending || email.trim().length === 0}
              onClick={() => send.mutate()}
            >
              {send.isPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              Add to organisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
