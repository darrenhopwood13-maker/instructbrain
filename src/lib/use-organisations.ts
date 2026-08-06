import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth";
import { membershipsQuery, type MembershipRow } from "@/lib/data";

/**
 * The signed-in user's organisation membership. Every application read is
 * scoped by this — and by RLS on the server side, which is the real boundary.
 */
export function useOrganisations() {
  const { user, loading } = useSession();
  const query = useQuery(membershipsQuery(user?.id ?? null));
  const memberships: MembershipRow[] = query.data ?? [];
  return {
    userId: user?.id ?? null,
    memberships,
    organisationIds: memberships.map((membership) => membership.organisation_id),
    organisationId: memberships[0]?.organisation_id ?? null,
    role: memberships[0]?.role ?? null,
    loading: loading || query.isPending,
    error: query.error,
  };
}
