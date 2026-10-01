import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
    toast.success(
      `Tone set to ${toneById(next).label}. New photos use it now — press Re-analyse on a photo to rewrite its findings.`,
    );
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
