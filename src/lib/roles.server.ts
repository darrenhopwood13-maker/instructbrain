import { capabilitiesFor, type AppRole } from "@/lib/roles";

/**
 * The estate map's real boundary.
 *
 * Row level security cannot do this job. A surveyor has to read projects, reports and
 * findings to capture anything at all, so tightening those tables by role would lock them
 * out of their own site. What is genuinely restricted is the ESTATE VIEW - every project at
 * once, ranked - and that is produced by server functions, not by a table. So the check
 * lives where the aggregate is built.
 *
 * Anything else that returns estate-wide data belongs behind the same call.
 */

/* The generated client's generic types do not survive being passed around; the shape used
   here is two calls wide and each one's result is checked. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CallerClient = any;

export async function assertEstateAccess(supabase: CallerClient): Promise<void> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error("Unauthorized");
  const userId: string | undefined = auth?.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const { data, error } = await supabase.from("memberships").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);

  const capabilities = capabilitiesFor(
    ((data ?? []) as Array<{ role: string }>).map((row) => row.role as AppRole),
  );
  if (!capabilities.estate) {
    throw new Error("The estate map is for appointed users.");
  }
}
