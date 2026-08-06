import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ErrorState } from "@/components/query-states";
import { createProject } from "@/lib/data";

/**
 * Creating a project writes to the signed-in user's organisation. A rejected
 * insert (including RLS) shows the database's own message, not a generic
 * failure toast.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  organisationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organisationId: string | null;
  onCreated?: (projectId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");
  const [principalContractor, setPrincipalContractor] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      return createProject({
        organisationId,
        name,
        reference,
        clientName,
        address,
        principalContractor,
      });
    },
    onSuccess: async (projectId) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      onOpenChange(false);
      setName("");
      setReference("");
      setClientName("");
      setAddress("");
      setPrincipalContractor("");
      onCreated?.(projectId);
    },
  });

  const nameInvalid = name.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Projects hold the reports, photographs and subcontractor directory for one instruction.
          </DialogDescription>
        </DialogHeader>

        <form
          id="create-project"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (nameInvalid) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameInvalid || undefined}
              aria-describedby="project-name-help"
            />
            <p id="project-name-help" className="text-xs text-muted-foreground">
              Required. Appears on the cover of every report raised against this project.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="project-reference">Reference</Label>
              <Input
                id="project-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-client">Client</Label>
              <Input
                id="project-client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-address">Site address</Label>
            <Input
              id="project-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-pc">Principal contractor</Label>
            <Input
              id="project-pc"
              value={principalContractor}
              onChange={(event) => setPrincipalContractor(event.target.value)}
            />
          </div>

          {mutation.error ? (
            <ErrorState title="The project could not be created" error={mutation.error} />
          ) : null}
        </form>

        <DialogFooter>
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-project"
            variant="brand"
            disabled={nameInvalid || mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
