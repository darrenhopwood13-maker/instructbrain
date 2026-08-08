import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n/i18n-provider";
import { translateReport } from "@/lib/i18n/translate.functions";
import { applyTranslation } from "@/lib/i18n/apply-translation";
import type { ReportDocument } from "@/lib/report/document";

/**
 * A translated view of a report. English stays the record copy: while a
 * translation is on screen the document is read-only, and one press of
 * "Revert to English" brings the editable record back.
 */
export function useReportTranslation(reportId: string, document: ReportDocument | null) {
  const { language, translated } = useI18n();

  const query = useQuery({
    queryKey: ["report-translation", reportId, language],
    enabled: translated && !!document,
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: () => translateReport({ data: { reportId, language } }),
  });

  const strings = query.data?.strings ?? {};
  const ready = translated && Object.keys(strings).length > 0;

  return {
    language,
    translated,
    loading: translated && query.isPending,
    error: query.error as Error | null,
    document: document && ready ? applyTranslation(document, strings) : document,
    isTranslatedView: !!document && ready,
  };
}
