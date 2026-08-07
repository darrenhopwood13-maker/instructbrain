import { describe, expect, it } from "vitest";
import { isShareLinkLive, shareUrlForToken } from "@/lib/report/share-url";

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
