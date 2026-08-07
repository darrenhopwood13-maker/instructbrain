import { absoluteUrl } from "@/lib/site-url";

/**
 * The one place a public share URL is built. Always the public token route —
 * never the authenticated report or print route, which a recipient without an
 * account cannot open.
 */
export function shareUrlForToken(token: string): string {
  return absoluteUrl(`/shared/${token}`);
}

/**
 * A share link is live until it is revoked. A null expires_at means no expiry
 * at all — the only way to withdraw such a link is to revoke it.
 */
export function isShareLinkLive(share: {
  expires_at: string | null;
  revoked_at: string | null;
}): boolean {
  if (share.revoked_at) return false;
  if (!share.expires_at) return true;
  return new Date(share.expires_at).getTime() > Date.now();
}

/** Plain-English state of a share link, for display. */
export function shareLinkState(share: {
  expires_at: string | null;
  revoked_at: string | null;
}): { kind: "revoked" | "expired" | "no-expiry" | "dated"; label: string } {
  if (share.revoked_at) return { kind: "revoked", label: "Revoked" };
  if (!share.expires_at) return { kind: "no-expiry", label: "No expiry — revoke to withdraw" };
  if (new Date(share.expires_at).getTime() < Date.now())
    return { kind: "expired", label: "Expired" };
  return {
    kind: "dated",
    label: `Expires ${new Date(share.expires_at).toLocaleDateString("en-GB")}`,
  };
}
