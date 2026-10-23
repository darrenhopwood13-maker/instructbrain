import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupStreetLevel, type StreetLevelResult } from "@/lib/map/street-level.server";

/**
 * The nearest street-level capture for one point, for the map's detail card.
 *
 * Behind the same auth middleware as the rest of the app: the map is only reachable
 * when signed in, so the imagery lookup is too. The browser sends a coordinate and gets
 * back an image - either a provider URL or a data URL we fetched - and never sees the
 * Google key (GOOGLE_MAPS_API_KEY) or the Mapillary token (MAPILLARY_TOKEN), which live in
 * server configuration. Google is asked first, Mapillary second.
 */
export const streetLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<StreetLevelResult> =>
    lookupStreetLevel(data.latitude, data.longitude),
  );
