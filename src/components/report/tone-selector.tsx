import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { analysePhoto, analysisState } from "@/lib/ai/analyse.functions";
import { coerceBrief, EMPTY_BRIEF, REPORT_TONES, toneById, type ReportToneId } from "@/lib/report/brief";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Lets the writer change the AI writing tone on an existing report. The tone
 * only shapes wording; status rules, abstention and human confirmation are
 * unaffected. New analysis and "re-analyse" use the chosen tone.
 */
export function ToneSelector({ reportId, disabled }: { reportId: string; disabled?: boolean }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const loadState = useServerFn(analysisState);
  const runPhoto = useServerFn(analysePhoto);

  /** Rewrites every unconfirmed AI draft in the new tone. Confirmed or edited findings are kept. */
  async function rewriteAll(label: string) {
    const states = await loadState({ data: { reportId } });
    const ids = states.filter((s) => s.analysed).map((s) => s.photoId);
    if (ids.length === 0) {
      // Never return silently. The tone HAS been saved by the time we get here,
      // so an early return with no message makes a working control look broken.
      // Say what was saved and what will happen.
      toast.info(
        states.length === 0
          ? `Tone set to ${label}. There are no photographs on this report yet — it applies as they are analysed.`
          : `Tone set to ${label}. There is nothing written to rewrite yet — it applies as photographs are analysed.`,
      );
      return;
    }
    const id = toast.loading(`Rewriting ${ids.length} photo${ids.length === 1 ? "" : "s"} in ${label} tone…`);
    let done = 0;
    let failed = 0;
    const queue = [...ids];
    await Promise.all(
      Array.from({ length: Math.min(6, queue.length) }, async () => {
        while (queue.length) {
          const photoId = queue.shift()!;
          try {
            await runPhoto({ data: { reportId, photoId, force: true, fast: false } });
          } catch {
            failed += 1;
          }
          done += 1;
          toast.loading(`Rewriting in ${label} tone… ${done} of ${ids.length}`, { id });
          void queryClient.invalidateQueries({ queryKey: ["findings", reportId] });
        }
      }),
    );
    await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    await queryClient.invalidateQueries({ queryKey: ["report-document", reportId] });
    if (failed) toast.error(`${failed} photo${failed === 1 ? "" : "s"} could not be rewritten. Try again.`, { id });
    else toast.success(`Findings rewritten in ${label} tone. Confirmed or edited findings were left as they are.`, { id });
  }
  const brief = useQuery({
    queryKey: ["report-brief", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("brief")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      return coerceBrief((data as { brief: unknown }).brief);
    },
  });

  const current = toneById(brief.data?.tone ?? null);

  async function change(next: string) {
    if (next === current.id) return;
    setSaving(true);
    const updated = { ...(brief.data ?? EMPTY_BRIEF), tone: next as ReportToneId };
    const { error } = await supabase
      .from("reports")
      .update({ brief: JSON.parse(JSON.stringify(updated)) })
      .eq("id", reportId);
    setSaving(false);
    if (error) {
      toast.error("The tone could not be changed. Try again.");
      return;
    }
    queryClient.setQueryData(["report-brief", reportId], updated);
    await rewriteAll(toneById(next).label);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="eyebrow" id={`tone-label-${reportId}`}>
        AI tone
      </span>
      <Select value={current.id} onValueChange={change} disabled={disabled || saving || brief.isPending}>
        <SelectTrigger className="h-11 w-48" aria-labelledby={`tone-label-${reportId}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_TONES.map((tone) => (
            <SelectItem key={tone.id} value={tone.id}>
              {tone.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{current.description}</span>
    </div>
  );
}
