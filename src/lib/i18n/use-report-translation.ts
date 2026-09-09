import { useQuery } from "@tanstack/react-query";
import { translateReport } from "@/lib/i18n/translate.functions";
import { applyTranslation } from "@/lib/i18n/apply-translation";
import type { ReportDocument } from "@/lib/report/document";

/**
 * A translated view of a report, driven by the REPORT's own issue language —
 * never by the language the surveyor happens to be working in. English stays
 * the record copy: while a translation is on screen the document is read-only,
 * and setting the report back to English brings the editable record back.
 */
export function useReportTranslation(
  reportId: string,
  document: ReportDocument | null,
  language?: string,
) {
  const target = language ?? document?.report.outputLanguage ?? "en";
  const translated = target !== "en";

  const query = useQuery({
    queryKey: ["report-translation", reportId, target],
    enabled: translated && !!document,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () => translateReport({ data: { reportId, language: target } }),
  });

  const strings = query.data?.strings ?? {};
  const ready = translated && Object.keys(strings).length > 0;

  return {
    language: target,
    translated,
    loading: translated && query.isPending,
    error: query.error as Error | null,
    document: document && ready ? applyTranslation(document, strings) : document,
    isTranslatedView: !!document && ready,
  };
}
