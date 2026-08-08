import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrganisationSummary, SignUp } from "@/lib/admin/admin.server";

function requiredString(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") throw new Error(`A ${label} is required.`);
  return text;
}

export const adminSignUps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignUp[]> => {
    const { listSignUps } = await import("@/lib/admin/admin.server");
    return listSignUps(context.supabase as never);
  });

export const adminOrganisations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrganisationSummary[]> => {
    const { listOrganisations } = await import("@/lib/admin/admin.server");
    return listOrganisations(context.supabase as never);
  });

export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      organisationId: requiredString(value["organisationId"], "organisation"),
      plan: requiredString(value["plan"], "plan"),
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { setOrganisationPlan } = await import("@/lib/admin/admin.server");
    await setOrganisationPlan(context.supabase as never, data.organisationId, data.plan);
    return { ok: true };
  });
