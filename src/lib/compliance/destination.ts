import type { RecentReport } from "@/lib/types";

/**
 * Where the dashboard's "Compliance reports" control should go.
 *
 * The register always belongs to a project, so we follow the most recently
 * touched project-backed report. Quick reports have no project and are
 * skipped. When nothing qualifies we return null and the caller asks the
 * person to pick a project — never a dead end.
 */
export function complianceProjectId(
  recent: readonly RecentReport[],
  projectIds: readonly string[] = [],
): string | null {
  const fromRecent = recent.find((report) => Boolean(report.projectId));
  if (fromRecent?.projectId) return fromRecent.projectId;
  return projectIds[0] ?? null;
}
