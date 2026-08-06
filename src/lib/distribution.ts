import type { Finding } from "@/lib/types";

/**
 * Invariant 7: findings involving a person are confidential and are EXCLUDED
 * from every subcontractor distribution. The database enforces this too — this
 * helper keeps the application from ever building such a payload in the first
 * place.
 */
export function selectDistributionFindings(findings: Finding[], trade?: string): Finding[] {
  return findings.filter(
    (finding) => !finding.isConfidential && (trade === undefined || finding.trade === trade),
  );
}

/** Refs included in a trade extract, in stable creation order. */
export function distributionRefs(findings: Finding[], trade?: string): string[] {
  return selectDistributionFindings(findings, trade).map((finding) => finding.ref);
}
