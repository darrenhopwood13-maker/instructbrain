import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geocodeUkAddress, extractUkPostcode, type GeoPoint } from "@/lib/weather/geocode.server";

/**
 * Where the caller's projects are, for the map screen.
 *
 * Reads through the caller's own authenticated client, so row level security decides
 * what is visible: the browser never sends an address to look up. Geocoding is the
 * same helper the dashboard's site-conditions panel uses (postcodes.io, full postcode
 * first, outward code as a labelled fallback), so the map and the weather panel can
 * never disagree about where a project is.
 *
 * A project with no postcode on its address is returned with `pinned: false` rather
 * than dropped - the screen counts them and says so. Half an estate silently missing
 * from a map is worse than a number that admits it.
 */

const MAX_PROJECTS = 200;

export type ProjectPoint = {
  projectId: string;
  name: string;
  address: string;
  /** Null when the address carries no postcode we can resolve. */
  latitude: number | null;
  longitude: number | null;
  /** What resolved, e.g. "BH23 1AF, Bournemouth, Christchurch and Poole". */
  locationLabel: string | null;
  precision: "postcode" | "outcode" | null;
  pinned: boolean;
};

export const projectPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ organisationIds: z.array(z.string().uuid()).max(20) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<ProjectPoint[]> => {
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

    // One upstream call per distinct postcode, not per project: a developer with six
    // phases on one site should cost one lookup, and postcodes.io is a courtesy service.
    const cache = new Map<string, GeoPoint | null>();
    const cachedFetch = async (address: string): Promise<GeoPoint | null> => {
      const key = extractUkPostcode(address) ?? address.trim().toLowerCase();
      if (!cache.has(key)) cache.set(key, await geocodeUkAddress(address));
      return cache.get(key) ?? null;
    };

    return Promise.all(
      projects.map(async (project): Promise<ProjectPoint> => {
        const address = project.address ?? "";
        const point = await cachedFetch(address);
        return {
          projectId: project.id,
          name: project.name,
          address,
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          locationLabel: point?.label ?? null,
          precision: point?.precision ?? null,
          pinned: Boolean(point),
        };
      }),
    );
  });
