import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setReportTradeAllocation } from "@/lib/report/report-data";

/**
 * The per-report override for the trade allocation layer.
 *
 * Off is a display and gate decision only: nothing is deleted, assigned trades
 * are kept, and switching it back on restores everything. The account setting
 * is the default, and clearing the override returns the report to following it.
 */
export function TradeAllocationSwitch({
  reportId,
  organisationDefault,
  reportValue,
  disabled = false,
}: {
  reportId: string;
  /** The account's answer, shown as the default this report follows. */
  organisationDefault: boolean;
  /** This report's own answer, or null when it follows the account. */
  reportValue: boolean | null;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [override, setOverride] = useState<boolean | null>(reportValue ?? null);
  const effective = override ?? organisationDefault;

  const mutation = useMutation({
    mutationFn: (next: boolean | null) => setReportTradeAllocation(reportId, next),
    onSuccess: async (_result, next) => {
      setOverride(next);
      await queryClient.invalidateQueries({ queryKey: ["report-document", reportId] });
      await queryClient.invalidateQueries({ queryKey: ["distribution-plan", reportId] });
      toast.success(
        next === null
          ? "Following your organisation setting again"
          : next
            ? "Trade allocation on for this report"
            : "Trade allocation off for this report",
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "The setting could not be saved."),
  });

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="report-trade-allocation" className="text-sm font-semibold">
            Trade allocation
          </Label>
          <p className="text-sm text-muted-foreground">
            {effective
              ? "Findings are routed to trades: the trade column, the publish gate and one extract per trade. Switch it off for a report that does not need any of that."
              : "Off for this report. Nothing is deleted — your directory and any trades already assigned are kept, and the report publishes without a trade gate."}
          </p>
          <p className="text-xs text-muted-foreground">
            {override === null
              ? `Following your organisation setting (${organisationDefault ? "on" : "off"}).`
              : `Set on this report, overriding your organisation (${organisationDefault ? "on" : "off"}).`}
          </p>
        </div>
        <Switch
          id="report-trade-allocation"
          checked={effective}
          disabled={disabled || mutation.isPending}
          onCheckedChange={(checked) => mutation.mutate(checked)}
        />
      </div>
      {override === null ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3"
          disabled={disabled || mutation.isPending}
          onClick={() => mutation.mutate(null)}
        >
          Use the organisation setting
        </Button>
      )}
    </section>
  );
}
