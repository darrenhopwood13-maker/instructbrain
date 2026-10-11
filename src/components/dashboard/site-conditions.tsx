import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ErrorState, LoadingState } from "@/components/query-states";
import { SiteConditionsHeading, SiteConditionsList } from "@/components/dashboard/site-conditions-list";
import { siteConditions } from "@/lib/weather/site-conditions.functions";

/**
 * Live wind at each project, on the dashboard.
 *
 * Ambient information, so it sits below the reports and above the setup card
 * and never pushes "what came in from site?" down the page. The reading comes
 * from a server function, cached there for ten minutes, so a dashboard load
 * does not chase the weather service on every render.
 *
 * Nothing here is a lifting decision - see the note under the list.
 */

const REFRESH_MS = 10 * 60 * 1000;

export function SiteConditions({ organisationIds }: { organisationIds: string[] }) {
  const load = useServerFn(siteConditions);
  const query = useQuery({
    queryKey: ["site-conditions", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: () => load({ data: { organisationIds } }),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    retry: 1,
  });

  if (organisationIds.length === 0) return null;

  return (
    <section aria-labelledby="site-conditions-heading" className="mt-6">
      <SiteConditionsHeading />
      <div className="mt-3">
        {query.isPending ? (
          <LoadingState label="Reading the wind at your projects…" />
        ) : query.isError ? (
          <ErrorState
            title="The wind reading could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <SiteConditionsList rows={query.data ?? []} />
        )}
      </div>
    </section>
  );
}
