import type { SurveyDefinition } from "@/lib/survey-types";
import { checkType } from "@/lib/compliance/checks";

/**
 * The register keeps its own record, but it still needs a report to hang its
 * photographs and its issued document on. This is the snapshot that report
 * carries. It has no severity scale — severity belongs to snagging — and its
 * vocabulary never leaves this file.
 */
export const COMPLIANCE_DEFINITION_ID = "weekly_compliance";

export function complianceDefinition(checkTypeId: string): SurveyDefinition {
  const type = checkType(checkTypeId);
  return {
    id: `${COMPLIANCE_DEFINITION_ID}_${type.id}`,
    version: 1,
    label: `Weekly compliance register — ${type.label}`,
    category: "compliance_register",
    findingsPerPhoto: "single",
    statuses: [
      { id: "compliant", label: "Compliant", tone: "pass" },
      { id: "non_compliant", label: "Non-compliant", tone: "fail" },
      { id: "not_applicable", label: "Not applicable", tone: "neutral" },
      { id: "not_assessed", label: "Not assessed", tone: "flag" },
    ],
    captureFields: [
      { id: "location", label: "Location", type: "text", required: true },
      { id: "unit_ref", label: `${type.unitNoun} ID`, type: "text", required: true },
    ],
    outputSections: ["cover", "schedule", "appendix"],
    requiresTradeAssignment: false,
    requiresLifecycle: true,
    supportsDistribution: false,
  };
}
