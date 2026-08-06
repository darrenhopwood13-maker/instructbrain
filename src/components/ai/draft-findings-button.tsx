import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { draftFindings } from "@/lib/ai/analyse.functions";
import { definitionLabel, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The only entry point to AI drafting in the UI. Purple marks AI-generated
 * work; nothing is confirmed, assigned or sent by this action.
 */
export function DraftFindingsButton({
  reportId,
  snapshot,
  photoCount,
}: {
  reportId: string;
  snapshot: SurveyTypeSnapshot;
  photoCount: number;
}) {
  const run = useServerFn(draftFindings);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const summary = await run({ data: { reportId } });
      await queryClient.invalidateQueries({ queryKey: ["findings", reportId] });
      await queryClient.invalidateQueries({ queryKey: ["report", reportId] });

      if (summary.photosAnalysed === 0) {
        toast.info("Nothing to draft", {
          description: "Every photograph on this report already has a finding.",
        });
      } else {
        toast.success(`${summary.findingsCreated} draft findings from ${summary.photosAnalysed} photographs`, {
          description: [
            `${summary.notAssessed} not assessed and awaiting a person`,
            summary.confidential > 0 ? `${summary.confidential} marked confidential` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }

      if (summary.errors.length > 0) {
        toast.warning(`${summary.errors.length} photographs could not be assessed`, {
          description: summary.errors.slice(0, 3).join(" · "),
        });
      }
    } catch (error) {
      toast.error("Drafting failed", {
        description:
          error instanceof Error ? error.message : "The AI service could not be reached.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        disabled={busy || photoCount === 0}
        onClick={() => setConfirmOpen(true)}
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden="true" />
        )}
        {busy ? "Drafting findings…" : "Draft findings with AI"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draft findings from {photoCount} photographs?</AlertDialogTitle>
            <AlertDialogDescription>
              Each photograph is assessed against the {definitionLabel(snapshot)} survey type at
              full resolution. Everything produced is a draft: nothing is confirmed, no trade is
              assigned, and nothing is sent to anyone. Anything the model cannot assess with
              confidence is marked <strong>Not assessed</strong> for you to resolve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={start}>Draft findings</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
