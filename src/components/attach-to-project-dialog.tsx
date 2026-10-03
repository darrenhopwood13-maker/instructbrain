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
import { FolderOpen, FolderOutput } from "lucide-react";
import {
  attachReportToProject,
  detachReportFromProject,
  projectsQuery,
} from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";

/**
 * The one place a report's link to a project is changed, in either direction.
 *
 * A report with no project has no directory and no close-out tracking behind
 * it — it simply holds its photographs and findings. Attaching it gives it the
 * project's directory and distribution. Detaching takes those away again.
 *
 * Detaching is the safe direction: every report-scoped table keys on report_id
 * rather than on the project, so nothing is orphaned and nothing is deleted.
 * The report keeps its photographs, findings, versions, shares, trade links and
 * distribution history throughout.
 *
 * Compliance registers are deliberately not detachable. A compliance run holds
 * both a project_id and a report_id, so a register report belongs to its
 * project in a way an ordinary report does not — detaching one would break the
 * register. The caller must not offer this dialog for one.
 */
export function AttachToProjectDialog({
  open,
  onOpenChange,
  reportId,
  project,
  onAttached,
  onDetached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  /** Set while the report is attached; the dialog then offers to detach it. */
  project?: { id: string; name: string } | null | undefined;
  onAttached?: (projectId: string) => void;
  onDetached?: () => void;
}) {
  const queryClient = useQueryClient();
  const { organisationIds } = useOrganisations();
  const projects = useQuery({ ...projectsQuery(organisationIds), enabled: !project });
  const [projectId, setProjectId] = useState("");

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    await queryClient.invalidateQueries({ queryKey: ["reports"] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const attach = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Choose a project first.");
      await attachReportToProject(reportId, projectId);
      return projectId;
    },
    onSuccess: async (id) => {
      await invalidate();
      toast.success("Report attached to project", {
        description: "Its directory and distribution now come from that project.",
      });
      onOpenChange(false);
      setProjectId("");
      onAttached?.(id);
    },
  });

  const detach = useMutation({
    mutationFn: async () => {
      if (!project) throw new Error("This report is not attached to a project.");
      await detachReportFromProject(reportId, project.id);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Report detached", {
        description: "It keeps everything it holds. Distribution is no longer available.",
      });
      onOpenChange(false);
      onDetached?.();
    },
  });

  const projectList = projects.data ?? [];

  if (project) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detach from project</DialogTitle>
            <DialogDescription>
              This report stays exactly as it is, but it stops using the directory and
              distribution of {project.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Everything it holds is kept — photographs, findings, versions and shared links.</p>
            <p>
              It will no longer appear against the project, and you will not be able to
              distribute it to trades until it is attached to a project again.
            </p>
          </div>

          {detach.error ? (
            <ErrorState title="Could not detach this report" error={detach.error} />
          ) : null}

          <DialogFooter>
            <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="brand"
              disabled={detach.isPending}
              onClick={() => detach.mutate()}
            >
              {detach.isPending ? "Detaching…" : "Detach report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.reference})
                </option>
              ))}
            </select>
          </div>
        )}

        {attach.error ? (
          <ErrorState title="Could not attach this report" error={attach.error} />
        ) : null}

        <DialogFooter>
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="brand"
            disabled={!projectId || attach.isPending}
            onClick={() => attach.mutate()}
          >
            {attach.isPending ? "Attaching…" : "Attach report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Icon re-export so callers offering the detach action stay consistent. */
export { FolderOutput as DetachIcon };
