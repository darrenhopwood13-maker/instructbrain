import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportTranslation = {
  language: string;
  /** Keyed "<findingId>.<field>" plus "report.<field>". English on any miss. */
  strings: Record<string, string>;
  cached: boolean;
};

function cleanLanguage(value: unknown): string {
  const language = typeof value === "string" ? value.trim() : "";
  if (language === "") throw new Error("A language is required.");
  return language;
}

function cleanId(value: unknown, label: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "") throw new Error(`A ${label} is required.`);
  return id;
}

/** Interface chrome. No report data involved, so no auth requirement. */
export const translateStrings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    const strings = value["strings"];
    if (typeof strings !== "object" || strings === null) {
      throw new Error("Nothing to translate.");
    }
    return {
      language: cleanLanguage(value["language"]),
      strings: strings as Record<string, string>,
    };
  })
  .handler(async ({ data }): Promise<{ translations: Record<string, string> }> => {
    if (data.language === "en") return { translations: data.strings };
    const { translateFlat } = await import("@/lib/i18n/translate.server");
    return { translations: await translateFlat(data.language, data.strings) };
  });

/**
 * Report prose in one language. Cached per report AND per language against a
 * checksum of the English source, so a report can be held in several languages
 * at once and every one of them re-translates the moment the English changes.
 */
export const translateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: cleanId(value["reportId"], "report"),
      language: cleanLanguage(value["language"]),
    };
  })
  .handler(async ({ data, context }): Promise<ReportTranslation> => {
    const { reportTranslationStrings } = await import("@/lib/i18n/report-translation.server");
    return reportTranslationStrings(context.supabase, data.reportId, data.language);
  });

