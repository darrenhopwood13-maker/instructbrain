import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeUkAddress } from "./geocode.server";
import { fetchConditions, type SiteConditions } from "./forecast.server";

/**
 * Live conditions for the caller's projects, for the dashboard panel.
 *
 * The project list is read through the caller's own authenticated client, so
 * row level security decides what is visible - the browser never sends us an
 * address to look up. Bounded to 12 projects and cached per point, so one
 * dashboard load costs at most a handful of upstream calls.
 *
 * Nothing here is a lifting decision. The reading is a model forecast on a
 * coarse grid; see the resolution note carried back with each result.
 */

const MAX_PROJECTS = 12;

export type SiteConditionRow = {
  projectId: string;
  name: string;
  address: string;
  /** What the address resolved to, e.g. "BH23 1AF, Bournemouth, Christchurch and Poole". */
  locationLabel: string | null;
  locationPrecision: "postcode" | "outcode" | null;
  state: "ok" | "no_postcode" | "unavailable";
  /** Set when state is not "ok". */
  reason: string | null;
  conditions: SiteConditions | null;
};

export const siteConditions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ organisationIds: z.array(z.string().uuid()).max(20) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<SiteConditionRow[]> => {
    const { organisationIds } = data;
    if (organisationIds.length === 0) return [];

    const { data: rows, error } = await context.supabase
      .from("projects")
      .select("id, name, address")
      .in("organisation_id", organisationIds)
      .order("created_at", { ascending: false })
      .limit(MAX_PROJECTS);

    if (error) throw new Error(error.message);

    const projects = (rows ?? []) as Array<{ id: string; name: string; address: string | null }>;

    return Promise.all(
      projects.map(async (project): Promise<SiteConditionRow> => {
        const address = project.address ?? "";
        const base = { projectId: project.id, name: project.name, address };

        const point = await geocodeUkAddress(address);
        if (!point) {
          return {
            ...base,
            locationLabel: null,
            locationPrecision: null,
            state: "no_postcode",
            reason: "No usable postcode on this project's address.",
            conditions: null,
          };
        }

        const result = await fetchConditions(point.latitude, point.longitude);
        if (!result.ok) {
          return {
            ...base,
            locationLabel: point.label,
            locationPrecision: point.precision,
            state: "unavailable",
            reason: result.reason,
            conditions: null,
          };
        }

        return {
          ...base,
          locationLabel: point.label,
          locationPrecision: point.precision,
          state: "ok",
          reason: null,
          conditions: result.conditions,
        };
      }),
    );
  });
