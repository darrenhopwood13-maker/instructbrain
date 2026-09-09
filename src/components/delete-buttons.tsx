import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteReport, deleteProject } from "@/lib/delete.functions";

/**
 * Destructive confirm dialogs. Both are permanent and irreversible, so the
 * copy says exactly what goes and there is no shortcut — a human presses
 * "Delete permanently".
 */

export function DeleteReportButton({
  reportId,
  title,
  projectId,
}: {
  reportId: string;
  title: string;
  projectId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteReport({ data: { reportId } });
      toast.success("Report deleted.");
      await navigate(
        projectId ? { to: "/projects/$id", params: { id: projectId } } : { to: "/dashboard" },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The report could not be deleted.",
      );
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="quiet" className="min-h-11 text-fail hover:text-fail">
          <Trash2 aria-hidden="true" className="size-4" />
          Delete report
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the report, every finding, every photograph and any
            issued versions and share links. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Keep the report</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 bg-fail text-white hover:bg-fail/90"
            onClick={() => void onDelete()}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteProjectButton({
  projectId,
  name,
  reportCount,
}: {
  projectId: string;
  name: string;
  reportCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteProject({ data: { projectId } });
      toast.success("Project deleted.");
      await navigate({ to: "/projects" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The project could not be deleted.",
      );
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="quiet" className="min-h-11 text-fail hover:text-fail">
          <Trash2 aria-hidden="true" className="size-4" />
          Delete project
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project
            {reportCount > 0
              ? `, its ${reportCount} ${reportCount === 1 ? "report" : "reports"},`
              : ","}{" "}
            its directory, compliance runs and all associated photographs. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Keep the project</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 bg-fail text-white hover:bg-fail/90"
            onClick={() => void onDelete()}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
