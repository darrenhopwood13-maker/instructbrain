import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Languages } from "lucide-react";
import { toast } from "sonner";

import { LANGUAGES, languageLabel } from "@/i18n/languages";
import { updateReportFields } from "@/lib/report/report-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The language the report is ISSUED in — the preview, the print view, the PDF
 * and the covering email. It sits beside Issue and Share so choosing it is a
 * deliberate act at the point of sending, never something buried in a menu.
 *
 * It does not change the language of the app itself: the person building the
 * report keeps working in their own language.
 */
export function ReportLanguageControl({
  reportId,
  value,
  disabled = false,
}: {
  reportId: string;
  value: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();

  const change = useMutation({
    mutationFn: (language: string) =>
      updateReportFields(reportId, { output_language: language }, { output_language: value }),
    onSuccess: async (_result, language) => {
      await queryClient.invalidateQueries({ queryKey: ["report-document", reportId] });
      await queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      toast.success(
        language === "en"
          ? "This report will be issued in English"
          : `This report will be issued in ${languageLabel(language)}`,
        {
          description:
            language === "en"
              ? "English is the record copy."
              : "The English text stays the record copy. Your own screens are unchanged.",
        },
      );
    },
    onError: (error) =>
      toast.error("The report language could not be changed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      }),
  });

  return (
    <div className="flex min-h-11 items-center gap-2">
      <Languages aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <label htmlFor="report-language" className="text-sm text-muted-foreground">
        Issue in
      </label>
      <Select
        value={value}
        disabled={disabled || change.isPending}
        onValueChange={(next) => change.mutate(next)}
      >
        <SelectTrigger
          id="report-language"
          aria-label={`Report language — currently ${value === "en" ? "English (record copy)" : languageLabel(value)}`}
          className="h-11 w-[11rem] border-border bg-transparent text-sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value="en">English (record copy)</SelectItem>
          {LANGUAGES.filter((item) => item.code !== "en").map((item) => (
            <SelectItem key={item.code} value={item.code}>
              {item.native}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
