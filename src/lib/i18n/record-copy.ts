import { languageLabel } from "@/i18n/languages";

/**
 * One sentence, stated identically on screen, in print and in the PDF: this
 * document is a translation and the English original is the version of record.
 * A legal-adjacent document must never leave that ambiguous.
 */
export function recordCopyNotice(language: string): string | null {
  if (!language || language === "en") return null;
  return `This document was produced in ${languageLabel(language)}. The English original is the version of record.`;
}
