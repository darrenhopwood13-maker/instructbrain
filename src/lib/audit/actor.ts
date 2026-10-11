/**
 * Who caused an audit event, as at the time.
 *
 * `audit_log.actor_id` records the user, but the name behind that id lives in
 * `auth.users.raw_user_meta_data`, which the browser client cannot read under
 * RLS. So the name is stamped onto the row as it is written, which is also the
 * right thing for an audit trail: the record should say who did what at the
 * time, and not change retroactively when someone is renamed or leaves.
 *
 * There are two kinds of actor in this product:
 *
 * 1. A signed-in user (the app, and the email send path) - they have a name.
 * 2. A subcontractor on a trade link - no user, no name, only a trade. The trade
 *    is the honest answer to "who", and impersonating a person we cannot identify
 *    would be worse than saying "Electrical".
 *
 * Nothing here returns an empty string. A blank where a person should be reads as
 * a broken screen; an explicit null lets the caller say "someone" instead.
 */

export type AuditActor = { id: string | null; name: string | null };

type AuthLike =
  | {
      id?: string | null;
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
    }
  | null
  | undefined;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The best display name available for a signed-in user.
 *
 * Order matches the audit_log backfill migration: the name they chose, then any
 * other name field, then the email. Never an empty string.
 */
export function displayNameFor(user: AuthLike): string | null {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return clean(meta["full_name"]) ?? clean(meta["name"]) ?? clean(user?.email);
}

/** The actor stamp for a signed-in user. */
export function actorFromUser(user: AuthLike): AuditActor {
  return { id: clean(user?.id) ?? null, name: displayNameFor(user) };
}

/** The actor stamp for a trade-link action, where the trade is the who. */
export function actorFromTrade(
  access: { label?: string | null; trade?: string | null } | null | undefined,
): AuditActor {
  return {
    id: null,
    // The label is what was written on the link, so it is the more specific of
    // the two; the trade is the fallback, and a plain description the last resort.
    name: clean(access?.label) ?? clean(access?.trade) ?? "A trade link",
  };
}
