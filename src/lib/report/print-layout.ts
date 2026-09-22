import type { ReportDocument } from "@/lib/report/document";
import { isInventoryLayout } from "@/lib/report/inventory-layout";

/** Named print-page class used by every rendered report surface. */
export function reportPrintPageClass(
  document: Pick<ReportDocument, "snapshot">,
): string {
  return isInventoryLayout(document) ? "inventory-print-surface" : "";
}