import { describe, expect, it } from "vitest";

import { distanceBetween } from "@/lib/map/geo";

describe("distanceBetween", () => {
  it("is zero for the same point", () => {
    const same = distanceBetween({ latitude: 51.5074, longitude: -0.1278 }, { latitude: 51.5074, longitude: -0.1278 });
    expect(same).toBe(0);
  });

  it("measures a known street hop in metres", () => {
    // Bruton Street towards Berkeley Square, a couple of hundred metres apart.
    const metres = distanceBetween(
      { latitude: 51.5107, longitude: -0.1455 },
      { latitude: 51.5095, longitude: -0.1441 },
    );
    expect(metres).toBeGreaterThan(150);
    expect(metres).toBeLessThan(250);
  });

  it("measures a long hop in kilometres, not degrees", () => {
    // London to Bristol is roughly 170km.
    const metres = distanceBetween(
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 51.4545, longitude: -2.5879 },
    );
    expect(metres).toBeGreaterThan(160_000);
    expect(metres).toBeLessThan(180_000);
  });
});
