import { createFileRoute, redirect } from "@tanstack/react-router";

type NewReportSearch = { project?: string | undefined; type?: string | undefined };

/**
 * There is one start screen for every report. This older address simply carries
 * its project and template through to it, so existing links keep working.
 */
export const Route = createFileRoute("/_authenticated/reports/new")({
  validateSearch: (search: Record<string, unknown>): NewReportSearch => ({
    project: typeof search["project"] === "string" ? search["project"] : undefined,
    type: typeof search["type"] === "string" ? search["type"] : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/reports/quick", search });
  },
});
