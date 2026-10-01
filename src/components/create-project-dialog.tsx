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
import { uploadProjectCover } from "@/lib/project-cover";

async function toCoverJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Photo could not be read."))), "image/jpeg", 0.85),
  );
}

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
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const projectId = await createProject({
        organisationId,
        name,
        reference,
        clientName,
        address,
        principalContractor,
      });
      if (coverFile) {
        try {
          await uploadProjectCover(organisationId, projectId, await toCoverJpeg(coverFile));
        } catch {
          toast.error("Project created, but the project photo could not be uploaded.");
        }
      }
      return projectId;
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
      setCoverFile(null);
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

          <div className="space-y-2">
            <Label htmlFor="project-cover">Project photo (optional)</Label>
            <Input
              id="project-cover"
              type="file"
              accept="image/*"
              className="min-h-11"
              onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              aria-describedby="project-cover-help"
            />
            <p id="project-cover-help" className="text-xs text-muted-foreground">
              Used as the title page photo on every report for this project.
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
