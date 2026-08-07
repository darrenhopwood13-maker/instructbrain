import { describe, expect, it } from "vitest";
import { isShareLinkLive, shareLinkState, shareUrlForToken } from "@/lib/report/share-url";

describe("share links", () => {
  it("always shares the public token route, never the authenticated report route", () => {
    const shared: string[] = [];
    const navigatorShare = (payload: { url: string }) => {
      shared.push(payload.url);
    };

    navigatorShare({ url: shareUrlForToken("abc123def456") });

    expect(shared).toHaveLength(1);
    expect(shared[0]).toContain("/shared/");
    expect(shared[0]).not.toContain("/reports/");
    expect(shared[0]).toMatch(/^https?:\/\//);
  });

  it("treats revoked and expired links as not live", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isShareLinkLive({ expires_at: future, revoked_at: null })).toBe(true);
    expect(isShareLinkLive({ expires_at: past, revoked_at: null })).toBe(false);
    expect(isShareLinkLive({ expires_at: future, revoked_at: past })).toBe(false);
  });
});

describe("no-expiry share links", () => {
  it("treats a null expiry as live until revoked", () => {
    expect(isShareLinkLive({ expires_at: null, revoked_at: null })).toBe(true);
    expect(
      isShareLinkLive({ expires_at: null, revoked_at: new Date().toISOString() }),
    ).toBe(false);
  });

  it("labels each link state in plain English", () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(shareLinkState({ expires_at: null, revoked_at: null })).toEqual({
      kind: "no-expiry",
      label: "No expiry — revoke to withdraw",
    });
    expect(shareLinkState({ expires_at: past, revoked_at: null }).kind).toBe("expired");
    expect(shareLinkState({ expires_at: future, revoked_at: past }).kind).toBe("revoked");
    expect(shareLinkState({ expires_at: future, revoked_at: null }).kind).toBe("dated");
  });
});
