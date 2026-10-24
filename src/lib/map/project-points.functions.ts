import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertEstateAccess } from "@/lib/roles.server";
import { geocodeWithGoogle, type GooglePlacement } from "@/lib/map/google-maps.server";
import { geocodeUkAddress, extractUkPostcode } from "@/lib/weather/geocode.server";

/**
 * Where the caller's projects are, for the map screen.
 *
 * Reads through the caller's own authenticated client, so row level security decides
 * what is visible: the browser never sends an address to look up.
 *
 * Placing runs Google Geocoding first, which returns a rooftop point, then falls back to
 * postcodes.io - free, no key, and the helper the dashboard's site-conditions panel
 * already uses. Google is preferred because a postcode centroid can sit eighty metres
 * down the road from the building; postcodes.io is kept because a Google quota problem
 * must never leave the estate unpinned. Whichever resolved is recorded in `precision`, so
 * a pin that is only postcode-accurate says so rather than implying a doorstep.
 *
 * A project with no postcode on its address is returned with `pinned: false` rather
 * than dropped - the screen counts them and says so. Half an estate silently missing
 * from a map is worse than a number that admits it.
 */

const MAX_PROJECTS = 200;

export type ProjectPlacement = GooglePlacement["precision"] | "outcode";

export type ProjectPoint = {
  projectId: string;
  name: string;
  address: string;
  /** Null when the address carries no postcode we can resolve. */
  latitude: number | null;
  longitude: number | null;
  /** What resolved, e.g. "11-13 Bruton St, London W1J 6JH, UK". */
  locationLabel: string | null;
  precision: ProjectPlacement | null;
  /** "google" for a rooftop point, "postcodes.io" for a postcode centroid. */
  placedBy: "google" | "postcodes.io" | null;
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

    // Every project on the account, placed on one map: that is the estate view, so it is
    // checked here rather than trusted to the browser having hidden a link.
    await assertEstateAccess(context.supabase);

    const { data: rows, error } = await context.supabase
      .from("projects")
      .select("id, name, address")
      .in("organisation_id", organisationIds)
      .order("created_at", { ascending: false })
      .limit(MAX_PROJECTS);

    if (error) throw new Error(error.message);

    const projects = (rows ?? []) as Array<{ id: string; name: string; address: string | null }>;

    // One upstream call per distinct postcode, not per project: a developer with six
    // phases on one site should cost one lookup, and Google bills per call.
    type Placement = {
      latitude: number;
      longitude: number;
      label: string;
      precision: ProjectPlacement;
      placedBy: "google" | "postcodes.io";
    };

    const cache = new Map<string, Placement | null>();

    const place = async (address: string): Promise<Placement | null> => {
      const key = extractUkPostcode(address) ?? address.trim().toLowerCase();
      const cached = cache.get(key);
      if (cached !== undefined) return cached;

      const google = await geocodeWithGoogle(address);
      if (google) {
        const placement: Placement = { ...google, placedBy: "google" };
        cache.set(key, placement);
        return placement;
      }

      const fallback = await geocodeUkAddress(address);
      const placement: Placement | null = fallback
        ? { ...fallback, placedBy: "postcodes.io" }
        : null;
      cache.set(key, placement);
      return placement;
    };

    return Promise.all(
      projects.map(async (project): Promise<ProjectPoint> => {
        const address = project.address ?? "";
        const point = await place(address);
        return {
          projectId: project.id,
          name: project.name,
          address,
          latitude: point?.latitude ?? null,
          longitude: point?.longitude ?? null,
          locationLabel: point?.label ?? null,
          precision: point?.precision ?? null,
          placedBy: point?.placedBy ?? null,
          pinned: Boolean(point),
        };
      }),
    );
  });
