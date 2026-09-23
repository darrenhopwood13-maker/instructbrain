import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { sendReportToDashboard } from "@/lib/field/handoff";

/**
 * The desk hand-off. One shared dialog used by the field cockpit's per-report
 * button and the report screen's More menu, so the confirmation reads
 * identically wherever it is pressed.
 *
 * It stays a person pressing a button, never automatic: nothing is emailed
 * and nothing is issued — the report lands in the dashboard's site queue.
 */
export function SendToDashboardControl({
  report,
  trigger,
  className,
}: {
  report: { id: string; title: string };
  trigger: (open: () => void) => React.ReactNode;
  /** Extra classes for the mutation path — not needed by callers today. */
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const send = useMutation({
    mutationFn: () => sendReportToDashboard(report.id),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Sent to the dashboard", {
        description: "It is in the site queue. Anything still unresolved is listed there.",
      });
    },
    onError: (error) =>
      toast.error("It could not be sent", {
        description:
          error instanceof Error
            ? error.message
            : "Check your signal and try again — nothing has been lost.",
      }),
  });

  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this to the dashboard?</DialogTitle>
            <DialogDescription>
              {report.title} goes into the site queue for review. Nothing is emailed to anyone,
              and nothing is issued — a person still confirms every finding before the report
              leaves the office.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Photographs still uploading will finish on their own. You can keep adding to the report
            afterwards.
          </p>
          <DialogFooter>
            <Button variant="quiet" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              className={`min-h-11${className ? ` ${className}` : ""}`}
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? (
                <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Send to the dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
