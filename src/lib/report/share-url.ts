import { absoluteUrl } from "@/lib/site-url";

/**
 * The one place a public share URL is built. Always the public token route —
 * never the authenticated report or print route, which a recipient without an
 * account cannot open.
 */
export function shareUrlForToken(token: string): string {
  return absoluteUrl(`/shared/${token}`);
}

export function isShareLinkLive(share: {
  expires_at: string;
  revoked_at: string | null;
}): boolean {
  return !share.revoked_at && new Date(share.expires_at).getTime() > Date.now();
}
