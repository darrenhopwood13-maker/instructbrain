import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lookupStreetImage, type StreetLevelResult } from "@/lib/map/street-level.server";

/**
 * The nearest street-level capture for one point, for the map's detail card.
 *
 * Behind the same auth middleware as the rest of the app: the map is only reachable
 * when signed in, so the imagery lookup is too. The browser sends a coordinate and gets
 * back an image URL - it never sees the Mapillary token, which lives in server
 * configuration as MAPILLARY_TOKEN.
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
    lookupStreetImage(data.latitude, data.longitude),
  );
