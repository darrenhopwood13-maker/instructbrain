import { describe, expect, it } from "vitest";

import { NO_CAPABILITIES, can, capabilitiesFor, type AppRole } from "@/lib/roles";

describe("role capabilities", () => {
  it("lets an owner keep every door, including capture", () => {
    expect(capabilitiesFor(["owner"])).toEqual({ estate: true, capture: true, manage: true });
  });

  it("gives a director the estate but not the camera", () => {
    const director = capabilitiesFor(["supervisor"]);
    expect(can(director, "estate")).toBe(true);
    expect(can(director, "capture")).toBe(false);
    expect(can(director, "manage")).toBe(true);
  });

  it("keeps a surveyor on site and out of the estate map", () => {
    const surveyor = capabilitiesFor(["surveyor"]);
    expect(can(surveyor, "capture")).toBe(true);
    expect(can(surveyor, "estate")).toBe(false);
    expect(can(surveyor, "manage")).toBe(false);
  });

  it("gives a viewer nothing beyond reading", () => {
    expect(capabilitiesFor(["viewer"])).toEqual(NO_CAPABILITIES);
  });

  it("takes the union across two organisations rather than the first membership", () => {
    // Director of one company, surveyor of another: both doors stay open.
    const mixed = capabilitiesFor(["supervisor", "surveyor"]);
    expect(mixed).toEqual({ estate: true, capture: true, manage: true });
  });

  it("ignores a missing role instead of throwing", () => {
    expect(capabilitiesFor([null, undefined])).toEqual(NO_CAPABILITIES);
  });

  it("treats an unknown role as no role", () => {
    expect(capabilitiesFor(["director" as AppRole])).toEqual(NO_CAPABILITIES);
  });
});
