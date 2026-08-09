import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/query-states";
import { EmptyState } from "@/components/empty-state";
import { FolderOpen } from "lucide-react";
import { attachReportToProject, projectsQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";

/**
 * A quick report has no project directory or close-out tracking behind it.
 * Attaching it to a project is a one-way door: once set, the report starts
 * using that project's directory and distribution the same as any other.
 */
export function AttachToProjectDialog({
  open,
  onOpenChange,
  reportId,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  onAttached?: (projectId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { organisationIds } = useOrganisations();
  const projects = useQuery(projectsQuery(organisationIds));
  const [projectId, setProjectId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Choose a project first.");
      await attachReportToProject(reportId, projectId);
      return projectId;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Report attached to project", {
        description: "Its directory and distribution now come from that project.",
      });
      onOpenChange(false);
      setProjectId("");
      onAttached?.(id);
    },
  });

  const projectList = projects.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach to a project</DialogTitle>
          <DialogDescription>
            This report will start using that project's directory and distribution.
          </DialogDescription>
        </DialogHeader>

        {projects.isPending ? (
          <LoadingState label="Loading your projects…" />
        ) : projects.isError ? (
          <ErrorState
            title="Your projects could not be loaded"
            error={projects.error}
            onRetry={() => void projects.refetch()}
          />
        ) : projectList.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Create a project first, then come back and attach this report to it."
          />
        ) : (
          <div className="space-y-2">
            <Label htmlFor="attach-project">Project</Label>
            <select
              id="attach-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-surface-raised px-3 text-sm"
            >
              <option value="">Select a project…</option>
              {projectList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.reference})
                </option>
              ))}
            </select>
          </div>
        )}

        {mutation.error ? (
          <ErrorState title="Could not attach this report" error={mutation.error} />
        ) : null}

        <DialogFooter>
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={!projectId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Attaching…" : "Attach report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
