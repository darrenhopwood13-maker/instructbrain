import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Who is in an organisation, and putting someone new in it.
 *
 * Until now the app could ACCEPT an invitation (auth.accept-invite) but nothing
 * anywhere created one, so the only way to add a second person was to insert a
 * membership row by hand in the database. Worse, a person who signed in without
 * a membership was sent to create their OWN organisation (auth.callback), which
 * is the opposite of joining yours.
 *
 * The caller's role is verified through their own authenticated client, and the
 * membership row is written with the service client - so no RLS change is
 * needed and nobody can invite themselves into an organisation they are not
 * already an owner or admin of.
 */

const ROLE_VALUES = ["owner", "admin", "surveyor", "supervisor", "viewer"] as const;
const ROLE_LABELS: Record<(typeof ROLE_VALUES)[number], string> = {
  owner: "Owner",
  admin: "Admin",
  surveyor: "Surveyor",
  supervisor: "Supervisor",
  viewer: "Viewer",
};

export type OrganisationRole = (typeof ROLE_VALUES)[number];

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as OrganisationRole] ?? role;
}

/** Trim and lower-case. An email address has no meaningful case. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** Deliberately simple: something@something.something, no spaces. */
export function isInvitableEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/**
 * Why this address cannot be added, or null when it can.
 *
 * Pure, so the wording the user sees is testable without a database or a mail
 * server. `existingEmails` are already lower-cased.
 */
export function inviteBlockedReason(email: string, existingEmails: string[]): string | null {
  if (!isInvitableEmail(email)) return "That does not look like an email address.";
  if (existingEmails.includes(email)) return "That person is already in this organisation.";
  return null;
}

export type OrganisationMember = {
  userId: string;
  email: string;
  role: string;
  roleLabel: string;
  joinedAt: string;
  isYou: boolean;
};

export type InviteOutcome =
  | { ok: true; email: string; role: OrganisationRole; emailed: boolean; alreadyHadAccount: boolean }
  | { ok: false; reason: string };

async function assertOwnerOrAdmin(
  supabase: SupabaseClient<Database>,
  organisationId: string,
): Promise<void> {
  const { data } = await supabase.rpc("is_platform_admin");
  if (data === true) return;
  const { data: allowed } = await supabase.rpc("has_org_role", {
    _org: organisationId,
    _roles: ["owner", "admin"],
  });
  if (allowed !== true) throw new Error("Only an owner or an admin can manage who is in this organisation.");
}

/** Emails for a set of user ids, from the auth users. Never throws. */
async function emailsFor(userIds: string[]): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const found = new Map<string, string>();
  await Promise.all(
    userIds.slice(0, 100).map(async (userId) => {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (data?.user?.email) found.set(userId, data.user.email);
      } catch {
        // A member without a readable email still appears, by id.
      }
    }),
  );
  return found;
}

export const listOrganisationMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organisationId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<OrganisationMember[]> => {
    const { organisationId } = data;
    await assertOwnerOrAdmin(context.supabase, organisationId);

    const { data: rows, error } = await context.supabase
      .from("memberships")
      .select("user_id, role, created_at")
      .eq("organisation_id", organisationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const members = (rows ?? []) as Array<{ user_id: string; role: string; created_at: string }>;
    const emails = await emailsFor(members.map((member) => member.user_id));
    const { data: userData } = await context.supabase.auth.getUser();
    const ownId = userData.user?.id ?? null;

    return members.map((member) => ({
      userId: member.user_id,
      email: emails.get(member.user_id) ?? "Email not readable",
      role: member.role,
      roleLabel: roleLabel(member.role),
      joinedAt: member.created_at,
      isYou: member.user_id === ownId,
    }));
  });

export const inviteOrganisationMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organisationId: z.string().uuid(),
        email: z.string().min(3).max(200),
        role: z.enum(ROLE_VALUES),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<InviteOutcome> => {
    const { organisationId } = data;
    const email = normaliseEmail(data.email);
    const role = data.role;

    await assertOwnerOrAdmin(context.supabase, organisationId);

    const { data: existingRows, error: readError } = await context.supabase
      .from("memberships")
      .select("user_id")
      .eq("organisation_id", organisationId);
    if (readError) throw new Error(readError.message);

    const existingIds = ((existingRows ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);
    const existingEmails = [...(await emailsFor(existingIds)).values()].map((value) => value.toLowerCase());

    const blocked = inviteBlockedReason(email, existingEmails);
    if (blocked) return { ok: false, reason: blocked };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId: string | null = null;
    let emailed = false;
    let alreadyHadAccount = false;

    try {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: absoluteUrl("/auth/accept-invite"),
      });
      if (error) throw new Error(error.message);
      userId = invited?.user?.id ?? null;
      emailed = true;
    } catch {
      // Most likely they already have an account. Find them and just add the
      // membership - a person who already signs in does not need an invite
      // email, and refusing here would be the whole bug again.
      alreadyHadAccount = true;
    }

    if (!userId) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = users?.users?.find((user) => (user.email ?? "").toLowerCase() === email);
      userId = match?.id ?? null;
    }

    if (!userId) {
      return {
        ok: false,
        reason:
          "The account could not be created or found. Ask them to sign up at instructbrain.com, then add them again.",
      };
    }

    const { error: insertError } = await supabaseAdmin
      .from("memberships")
      .insert({ organisation_id: organisationId, user_id: userId, role });
    if (insertError) {
      return { ok: false, reason: insertError.message };
    }

    return { ok: true, email, role, emailed, alreadyHadAccount };
  });

export type SignInLinkOutcome =
  | { ok: true; email: string; url: string; kind: "invite" | "sign-in" }
  | { ok: false; reason: string };

/**
 * A sign-in link an owner or admin can hand over themselves.
 *
 * Invitations leave the building through the mail server, and a mail server can
 * quietly refuse: a site address that filters it, a mailbox that is full, an
 * office that treats anything automated as spam. When that happens the person
 * sits waiting for an email that is never coming, and the office has no way to
 * finish the job. This creates the same link the email would have carried, and
 * shows it to the owner once so they can send it by whatever they actually use -
 * a text, a WhatsApp, over the shoulder on site.
 *
 * The link is single use and expires, so it is shown, never stored, and an
 * owner still cannot use this to reach inside anybody else's organisation
 * because the membership is checked first.
 */
export const createMemberSignInLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ organisationId: z.string().uuid(), userId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<SignInLinkOutcome> => {
    await assertOwnerOrAdmin(context.supabase, data.organisationId);

    const { data: membership } = await context.supabase
      .from("memberships")
      .select("user_id")
      .eq("organisation_id", data.organisationId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!membership) return { ok: false, reason: "That person is not in this organisation." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = found?.user?.email;
    if (!email) return { ok: false, reason: "That person has no email address on their account." };

    const activated = Boolean(found?.user?.email_confirmed_at || found?.user?.last_sign_in_at);
    const attempts: Array<{ type: "invite" | "magiclink" | "recovery"; kind: "invite" | "sign-in" }> =
      activated
        ? [
            { type: "magiclink", kind: "sign-in" },
            { type: "recovery", kind: "sign-in" },
          ]
        : [
            { type: "invite", kind: "invite" },
            { type: "magiclink", kind: "sign-in" },
            { type: "recovery", kind: "sign-in" },
          ];

    const redirectTo = absoluteUrl("/auth/accept-invite");
    for (const attempt of attempts) {
      const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
        type: attempt.type,
        email,
        options: { redirectTo },
      });
      const url = link?.properties?.action_link;
      if (!error && url) return { ok: true, email, url, kind: attempt.kind };
    }

    return { ok: false, reason: "A sign-in link could not be created for that account." };
  });
