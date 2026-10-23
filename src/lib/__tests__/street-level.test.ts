import { describe, expect, it } from "vitest";
import { lookupStreetImage } from "@/lib/map/street-level.server";

const TOKEN = "MLY|test-token-not-real";
const LAT = 51.510721;
const LNG = -0.143776;

function respond(status: number, body: unknown) {
  return () => Promise.resolve({ status, body });
}

describe("lookupStreetImage", () => {
  it("says not configured rather than pretending, when there is no token", async () => {
    const result = await lookupStreetImage(LAT, LNG, respond(200, {}), undefined);
    expect(result).toEqual({ state: "not_configured" });
  });

  it("returns the newest capture with its date", async () => {
    const result = await lookupStreetImage(
      LAT,
      LNG,
      respond(200, {
        data: [
          {
            id: "1234567890",
            thumb_1024_url: "https://example.invalid/thumb.jpg",
            captured_at: Date.UTC(2025, 4, 9),
          },
        ],
      }),
      TOKEN,
    );

    expect(result).toEqual({
      state: "ok",
      imageId: "1234567890",
      imageUrl: "https://example.invalid/thumb.jpg",
      capturedAt: "2025-05-09",
    });
  });

  it("treats an empty result as a coverage gap, not a failure", async () => {
    const result = await lookupStreetImage(LAT, LNG, respond(200, { data: [] }), TOKEN);
    expect(result).toEqual({ state: "none" });
  });

  it("treats a capture without a thumbnail as nothing to show", async () => {
    const result = await lookupStreetImage(LAT, LNG, respond(200, { data: [{ id: "9" }] }), TOKEN);
    expect(result).toEqual({ state: "none" });
  });

  it("names a rejected token as a token problem, so nobody goes hunting on the map", async () => {
    const result = await lookupStreetImage(LAT, LNG, respond(401, {}), TOKEN);
    expect(result).toEqual({ state: "unavailable", reason: "Mapillary rejected the access token." });
  });

  it("distinguishes rate limiting from a rejection", async () => {
    const result = await lookupStreetImage(LAT, LNG, respond(429, {}), TOKEN);
    expect(result.state).toBe("unavailable");
    expect(result.state === "unavailable" && result.reason).toContain("rate limiting");
  });

  it("reports a network failure in words rather than throwing", async () => {
    const failing = () => Promise.reject(new Error("getaddrinfo ENOTFOUND"));
    const result = await lookupStreetImage(LAT, LNG, failing, TOKEN);
    expect(result.state).toBe("unavailable");
    expect(result.state === "unavailable" && result.reason).toContain("could not be reached");
  });

  it("never returns the token to the caller", async () => {
    const result = await lookupStreetImage(
      LAT,
      LNG,
      respond(200, { data: [{ id: "1", thumb_1024_url: "https://example.invalid/a.jpg" }] }),
      TOKEN,
    );
    expect(JSON.stringify(result)).not.toContain("test-token-not-real");
  });

  it("bounds the lookup box around the point instead of searching the country", async () => {
    let requested = "";
    await lookupStreetImage(
      LAT,
      LNG,
      (url) => {
        requested = url;
        return Promise.resolve({ status: 200, body: { data: [] } });
      },
      TOKEN,
    );
    expect(requested).toContain("bbox=");
    expect(requested).toContain("limit=1");
    const bbox = decodeURIComponent(requested.split("bbox=")[1] ?? "");
    const edges = bbox.split(",").map(Number);
    const west = edges[0]!;
    const south = edges[1]!;
    const east = edges[2]!;
    const north = edges[3]!;
    expect(west).toBeLessThan(LNG);
    expect(east).toBeGreaterThan(LNG);
    expect(south).toBeLessThan(LAT);
    expect(north).toBeGreaterThan(LAT);
    // Roughly 50m either side, not a district.
    expect(east - west).toBeLessThan(0.002);
  });
});
