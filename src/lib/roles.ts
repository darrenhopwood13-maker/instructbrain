/**
 * What a role may do, in one table.
 *
 * Roles have existed in the database since the first migration, but until now they only
 * decided settings and who could delete an organisation. They now decide which doors are
 * on the screen: a director reviewing performance does not start reports, and a surveyor
 * on site does not get the estate map and trends.
 *
 * THIS IS NOT THE SECURITY BOUNDARY. Hiding a route stops a person stumbling into it, not
 * a person who wants in - the data is still reachable with their own token. The boundary
 * has to be the policy on the table as well. Anything gated here must be gated there too.
 */

export type AppRole = "owner" | "admin" | "surveyor" | "supervisor" | "viewer";

export type Capability = "estate" | "capture" | "manage" | "issue" | "administer";

export type Capabilities = {
  /** The whole estate: map, trends, portfolio figures. */
  estate: boolean;
  /** Work done on site: start a report, add photographs, the compliance register. */
  capture: boolean;
  /** The organisation itself: settings, people, issuing evidence. */
  manage: boolean;
  /**
   * Getting a completed report out of the building: publish, distribute, share,
   * reopen. Separated from `manage` because signing off someone else's survey is a
   * different job from changing the company logo, and the two were being conflated.
   */
  issue: boolean;
  /**
   * The organisation's own record: name, address, brand, people, invites, deletion.
   * This is what `manage` was always meant to protect on the settings screen.
   */
  administer: boolean;
};

/**
 * A director is `supervisor` here: the role already meant "reviews and signs off reports",
 * which is exactly the job being separated out. Nobody needs a new role to get this - it is
 * a change of what the existing role is allowed, not a migration.
 *
 * `owner` and `admin` keep capture on purpose. The owner of a two-person firm surveys and
 * runs the business from the same login, and being locked out of your own camera because of
 * a job title would be the worst outcome of this change.
 */
const BY_ROLE: Record<AppRole, Capabilities> = {
  owner: { estate: true, capture: true, manage: true, issue: true, administer: true },
  admin: { estate: true, capture: true, manage: true, issue: true, administer: true },
  supervisor: { estate: true, capture: false, manage: true, issue: true, administer: true },
  surveyor: { estate: false, capture: true, manage: false, issue: false, administer: false },
  viewer: { estate: false, capture: false, manage: false, issue: false, administer: false },
};

export const NO_CAPABILITIES: Capabilities = {
  estate: false,
  capture: false,
  manage: false,
  issue: false,
  administer: false,
};

/**
 * Someone can be in two organisations with two roles. Take the union rather than the first
 * membership: a person who is a director of one company and a surveyor of another keeps
 * every door they are entitled to, instead of losing one at random by membership order.
 */
export function capabilitiesFor(roles: Array<AppRole | null | undefined>): Capabilities {
  return roles.reduce<Capabilities>((all, role) => {
    if (!role) return all;
    const found = BY_ROLE[role] ?? NO_CAPABILITIES;
    return {
      estate: all.estate || found.estate,
      capture: all.capture || found.capture,
      manage: all.manage || found.manage,
      issue: all.issue || found.issue,
      administer: all.administer || found.administer,
    };
  }, NO_CAPABILITIES);
}

export function can(capabilities: Capabilities, capability: Capability): boolean {
  return capabilities[capability] === true;
}

/**
 * Where a person lands after signing in: the widest door their role unlocks.
 *
 * `/dashboard` redirects to `/map`, so every role used to arrive at the estate map — and a
 * viewer's first screen after signing in was "the estate map is for appointed users". The
 * refusal is correct; landing on it is not.
 */
export function homeRouteFor(capabilities: Capabilities): "/map" | "/field" | "/reports" {
  if (capabilities.estate) return "/map";
  if (capabilities.capture) return "/field";
  return "/reports";
}
