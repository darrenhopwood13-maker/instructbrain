import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Founder-level oversight. Every function here re-checks platform admin status
 * against the CALLER'S OWN client (RLS applies) before touching the admin
 * client. Being signed in is never enough.
 */

export type SignUp = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  organisations: { id: string; name: string; role: string }[];
};

export type OrganisationSummary = {
  id: string;
  name: string;
  plan: string;
  reportAllowance: number | null;
  members: number;
  projects: number;
  reports: number;
  createdAt: string;
};

export async function assertPlatformAdmin(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc("is_platform_admin" as never);
  if (error) throw new Error("Could not confirm your access level.");
  if (data !== true) throw new Error("This area is restricted to platform administrators.");
}

export async function listSignUps(supabase: SupabaseClient): Promise<SignUp[]> {
  await assertPlatformAdmin(supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw new Error(error.message);

  const { data: memberships } = await supabaseAdmin
    .from("memberships")
    .select("user_id, role, organisation_id, organisations(name)");

  const byUser = new Map<string, { id: string; name: string; role: string }[]>();
  for (const row of (memberships ?? []) as any[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({
      id: row.organisation_id,
      name: row.organisations?.name ?? "Unnamed organisation",
      role: row.role,
    });
    byUser.set(row.user_id, list);
  }

  return users.users.map((user) => ({
    id: user.id,
    email: user.email ?? "No email on the account",
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    confirmed: !!user.email_confirmed_at,
    organisations: byUser.get(user.id) ?? [],
  }));
}

export async function listOrganisations(
  supabase: SupabaseClient,
): Promise<OrganisationSummary[]> {
  await assertPlatformAdmin(supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [orgs, members, projects, reports] = await Promise.all([
    supabaseAdmin
      .from("organisations")
      .select("id, name, plan, report_allowance, created_at")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("memberships").select("organisation_id"),
    supabaseAdmin.from("projects").select("organisation_id"),
    supabaseAdmin.from("reports").select("organisation_id"),
  ]);

  const tally = (rows: unknown) => {
    const map = new Map<string, number>();
    for (const row of (rows ?? []) as { organisation_id: string }[]) {
      map.set(row.organisation_id, (map.get(row.organisation_id) ?? 0) + 1);
    }
    return map;
  };

  const memberCount = tally(members.data);
  const projectCount = tally(projects.data);
  const reportCount = tally(reports.data);

  return ((orgs.data ?? []) as any[]).map((row) => ({
    id: row.id,
    name: row.name,
    plan: row.plan,
    reportAllowance: row.report_allowance,
    members: memberCount.get(row.id) ?? 0,
    projects: projectCount.get(row.id) ?? 0,
    reports: reportCount.get(row.id) ?? 0,
    createdAt: row.created_at,
  }));
}

export async function setOrganisationPlan(
  supabase: SupabaseClient,
  organisationId: string,
  plan: string,
): Promise<void> {
  await assertPlatformAdmin(supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("organisations")
    .update({ plan })
    .eq("id", organisationId);
  if (error) throw new Error(error.message);
}
