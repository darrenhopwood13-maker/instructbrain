import type { ReportDocument } from "@/lib/report/document";
import { isInventoryLayout } from "@/lib/report/inventory-layout";
import { isManualOnly } from "@/lib/survey-types";

/** Named print-page class used by every rendered report surface. */
export function reportPrintPageClass(
  document: Pick<ReportDocument, "snapshot">,
): string {
  if (isManualOnly(document.snapshot)) return "manual-photo-print-surface";
  return isInventoryLayout(document) ? "inventory-print-surface" : "";
}