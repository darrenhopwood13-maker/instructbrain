import { describe, expect, it } from "vitest";
import {
  bearingBetween,
  geocodeWithGoogle,
  lookupGoogleStreetView,
} from "@/lib/map/google-maps.server";
import { lookupStreetLevel } from "@/lib/map/street-level.server";

const KEY = "test-key-not-real";
const LAT = 51.510721;
const LNG = -0.143776;

const json = (status: number, body: unknown) => () => Promise.resolve({ status, body });

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const image = (status = 200, bytes = JPEG) => () =>
  Promise.resolve({ status, contentType: "image/jpeg; charset=binary", bytes });

describe("geocodeWithGoogle", () => {
  it("says nothing at all when there is no key, so the caller falls back quietly", async () => {
    expect(await geocodeWithGoogle("11-13 Bruton Street, London W1J 6JH", json(200, {}), null)).toBeNull();
  });

  it("returns a rooftop point and the address Google actually matched", async () => {
    const result = await geocodeWithGoogle(
      "11-13 Bruton Street, London W1J 6JH",
      json(200, {
        status: "OK",
        results: [
          {
            formatted_address: "11-13 Bruton St, London W1J 6JH, UK",
            geometry: { location: { lat: LAT, lng: LNG }, location_type: "ROOFTOP" },
          },
        ],
      }),
      KEY,
    );

    expect(result).toEqual({
      latitude: LAT,
      longitude: LNG,
      label: "11-13 Bruton St, London W1J 6JH, UK",
      precision: "rooftop",
    });
  });

  it("labels an approximate match as postcode-accurate rather than implying a doorstep", async () => {
    const result = await geocodeWithGoogle(
      "Bruton Street",
      json(200, {
        status: "OK",
        results: [
          {
            formatted_address: "Bruton St, London, UK",
            geometry: { location: { lat: LAT, lng: LNG }, location_type: "APPROXIMATE" },
          },
        ],
      }),
      KEY,
    );
    expect(result?.precision).toBe("postcode");
  });

  it("treats a refused request as no placement, so postcodes.io still places the estate", async () => {
    const result = await geocodeWithGoogle(
      "11-13 Bruton Street, London W1J 6JH",
      json(200, { status: "REQUEST_DENIED", error_message: "API keys with referer restrictions" }),
      KEY,
    );
    expect(result).toBeNull();
  });

  it("survives a network failure without throwing", async () => {
    const result = await geocodeWithGoogle(
      "11-13 Bruton Street",
      () => Promise.reject(new Error("getaddrinfo ENOTFOUND")),
      KEY,
    );
    expect(result).toBeNull();
  });

  it("scopes the lookup to the UK and never returns the key", async () => {
    let requested = "";
    const result = await geocodeWithGoogle(
      "11-13 Bruton Street, London W1J 6JH",
      (url) => {
        requested = url;
        return Promise.resolve({
          status: 200,
          body: {
            status: "OK",
            results: [
              {
                formatted_address: "11-13 Bruton St, London W1J 6JH, UK",
                geometry: { location: { lat: LAT, lng: LNG }, location_type: "ROOFTOP" },
              },
            ],
          },
        });
      },
      KEY,
    );
    expect(requested).toContain("country%3AGB");
    expect(requested).toContain("region=uk");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});

describe("bearingBetween", () => {
  it("points north when the target is north of the camera", () => {
    expect(bearingBetween({ latitude: 51.5, longitude: -0.14 }, { latitude: 51.51, longitude: -0.14 })).toBe(0);
  });

  it("points east when the target is east of the camera", () => {
    expect(bearingBetween({ latitude: 51.5, longitude: -0.14 }, { latitude: 51.5, longitude: -0.13 })).toBe(90);
  });
});

describe("lookupGoogleStreetView", () => {
  it("says not configured rather than pretending, when there is no key", async () => {
    expect(await lookupGoogleStreetView(LAT, LNG, json(200, {}), image(), null)).toEqual({
      state: "not_configured",
    });
  });

  it("treats no panorama as a coverage gap, not a failure", async () => {
    const result = await lookupGoogleStreetView(LAT, LNG, json(200, { status: "ZERO_RESULTS" }), image(), KEY);
    expect(result).toEqual({ state: "none" });
  });

  it("names a refused key, with Google's own words, so nobody hunts on the map", async () => {
    const result = await lookupGoogleStreetView(
      LAT,
      LNG,
      json(200, {
        status: "REQUEST_DENIED",
        error_message: "This API project is not authorized to use this API.",
      }),
      image(),
      KEY,
    );
    expect(result.state).toBe("unavailable");
    expect(result.state === "unavailable" && result.reason).toContain("not authorized");
  });

  it("reports a quota problem as a quota problem", async () => {
    const result = await lookupGoogleStreetView(
      LAT,
      LNG,
      json(200, { status: "OVER_QUERY_LIMIT" }),
      image(),
      KEY,
    );
    expect(result.state).toBe("unavailable");
    expect(result.state === "unavailable" && result.reason).toContain("quota");
  });

  it("returns the panorama as bytes, aimed at the site, with the month it was captured", async () => {
    let imageRequest = "";
    const result = await lookupGoogleStreetView(
      LAT,
      LNG,
      json(200, {
        status: "OK",
        copyright: "© 2025 Google",
        date: "2025-06",
        pano_id: "pano-abc",
        location: { lat: 51.5108, lng: -0.1438 },
      }),
      (url) => {
        imageRequest = url;
        return Promise.resolve({ status: 200, contentType: "image/jpeg", bytes: JPEG });
      },
      KEY,
    );

    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // The image travels as bytes we fetched. A URL with a key in it is a key given away.
    expect(result.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(result.dataUrl).not.toContain(KEY);
    expect(result.panoId).toBe("pano-abc");
    // Google dates panorama coverage to the month; the pane must not invent a day.
    expect(result.capturedAt).toBe("2025-06-01");
    expect(result.credit).toBe("© 2025 Google");
    expect(imageRequest).toContain("heading=");
    expect(imageRequest).toContain("size=600x400");
  });

  it("reports an empty image response instead of half a panorama", async () => {
    const result = await lookupGoogleStreetView(
      LAT,
      LNG,
      json(200, { status: "OK", date: "2024-01" }),
      image(200, new Uint8Array()),
      KEY,
    );
    expect(result.state).toBe("unavailable");
  });
});

describe("lookupStreetLevel", () => {
  const googleOk = () =>
    Promise.resolve({
      state: "ok" as const,
      panoId: "pano-1",
      dataUrl: "data:image/jpeg;base64,AAAA",
      capturedAt: "2025-06-01",
      credit: "© 2025 Google",
      distanceMetres: 18,
    });

  const mapillaryOk = () =>
    Promise.resolve({
      state: "ok" as const,
      imageId: "1234567890",
      imageUrl: "https://example.invalid/thumb.jpg",
      capturedAt: "2022-07-08",
      distanceMetres: 41,
    });

  it("prefers Mapillary, because a camera car is what 'street level' promises", async () => {
    let googleAsked = 0;
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => {
        googleAsked += 1;
        return googleOk();
      },
      mapillary: mapillaryOk,
    });

    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.provider).toBe("Mapillary");
    expect(result.distanceMetres).toBe(41);
    expect(result.note).toBeNull();
    // Not one billed Google call when the free ground-level provider already has the street.
    expect(googleAsked).toBe(0);
  });

  it("falls back to Google when Mapillary has no coverage, and says what kind of capture it is", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: googleOk,
      mapillary: () => Promise.resolve({ state: "none" as const }),
    });

    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    expect(result.provider).toBe("Google");
    expect(result.credit).toBe("© 2025 Google");
    expect(result.linkUrl).toBeNull();
    expect(result.distanceMetres).toBe(18);
    // The nearest panorama is not always a photograph of the street; the pane says so.
    expect(result.note).toContain("rooftop or an indoor panorama");
  });

  it("says there is nothing rather than blaming a provider when both are empty", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => Promise.resolve({ state: "none" as const }),
      mapillary: () => Promise.resolve({ state: "none" as const }),
    });
    expect(result).toEqual({ state: "none" });
  });

  it("reports a refused key ahead of a coverage gap: that one is ours to fix", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => Promise.resolve({ state: "unavailable" as const, reason: "Street View refused the request." }),
      mapillary: () => Promise.resolve({ state: "none" as const }),
    });
    expect(result).toEqual({ state: "unavailable", reason: "Street View refused the request." });
  });

  it("is honest that nothing is configured when no provider has a key", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => Promise.resolve({ state: "not_configured" as const }),
      mapillary: () => Promise.resolve({ state: "not_configured" as const }),
    });
    expect(result).toEqual({ state: "not_configured" });
  });

  it("still shows the Mapillary capture when Google is refusing everything", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => Promise.resolve({ state: "unavailable" as const, reason: "quota" }),
      mapillary: mapillaryOk,
    });
    expect(result.state).toBe("ok");
    expect(result.state === "ok" && result.provider).toBe("Mapillary");
  });

  it("reports a rejected Mapillary token when Google has no coverage either", async () => {
    const result = await lookupStreetLevel(LAT, LNG, {
      google: () => Promise.resolve({ state: "none" as const }),
      mapillary: () => Promise.resolve({ state: "unavailable" as const, reason: "Mapillary rejected the access token." }),
    });
    expect(result).toEqual({ state: "unavailable", reason: "Mapillary rejected the access token." });
  });
});
