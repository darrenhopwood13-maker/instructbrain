import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

/**
 * Platform administration sits ABOVE organisation membership. It is granted to
 * explicitly listed user IDs in public.platform_admins — never to a role name a
 * customer could assign themselves — and the real boundary is the database
 * policy, not this hook.
 */
export const platformAdminQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["platform-admin", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await (
        supabase.from("platform_admins" as never) as unknown as {
          select: (columns: string) => any;
        }
      )
        .select("user_id")
        .eq("user_id", userId)
        .limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });

export function useIsPlatformAdmin(): { isPlatformAdmin: boolean; loading: boolean } {
  const { user, loading } = useSession();
  const query = useQuery(platformAdminQuery(user?.id ?? null));
  return {
    isPlatformAdmin: query.data === true,
    loading: loading || (!!user && query.isPending),
  };
}
