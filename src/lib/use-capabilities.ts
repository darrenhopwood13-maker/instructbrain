import { useMemo } from "react";

import { capabilitiesFor, type AppRole, type Capabilities } from "@/lib/roles";
import { useOrganisations } from "@/lib/use-organisations";

/**
 * The signed-in person's capabilities, resolved once for the whole app.
 *
 * `loading` matters: while memberships are still in flight every capability is false, so a
 * screen that gates on one must wait rather than flash "not for your role" at someone who
 * is entitled to it.
 */
export function useCapabilities(): { capabilities: Capabilities; loading: boolean } {
  const { memberships, loading, error } = useOrganisations();
  const capabilities = useMemo(
    () => capabilitiesFor(memberships.map((membership) => membership.role as AppRole)),
    [memberships],
  );
  return { capabilities, loading: loading || Boolean(error) };
}
