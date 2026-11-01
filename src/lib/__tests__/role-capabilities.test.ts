import { describe, expect, it } from "vitest";

import { NO_CAPABILITIES, can, capabilitiesFor, type AppRole } from "@/lib/roles";

const ALL = { estate: true, capture: true, manage: true, issue: true, administer: true };

describe("role capabilities", () => {
  it("lets an owner keep every door, including capture", () => {
    expect(capabilitiesFor(["owner"])).toEqual(ALL);
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
    expect(mixed).toEqual(ALL);
  });

  it("ignores a missing role instead of throwing", () => {
    expect(capabilitiesFor([null, undefined])).toEqual(NO_CAPABILITIES);
  });

  it("treats an unknown role as no role", () => {
    expect(capabilitiesFor(["director" as AppRole])).toEqual(NO_CAPABILITIES);
  });

  // Signing a report off and changing the company record are different jobs, and a
  // viewer must be offered neither. These are the two capabilities that stop a viewer
  // being shown Publish, Distribute, Share and Reopen on a report they may only read.
  describe("issuing and administering", () => {
    it("a viewer may not issue or administer", () => {
      const viewer = capabilitiesFor(["viewer"]);
      expect(viewer.issue).toBe(false);
      expect(viewer.administer).toBe(false);
    });

    it("a surveyor captures but does not issue", () => {
      const surveyor = capabilitiesFor(["surveyor"]);
      expect(surveyor.capture).toBe(true);
      expect(surveyor.issue).toBe(false);
      expect(surveyor.administer).toBe(false);
    });

    it("a supervisor issues but does not capture", () => {
      const supervisor = capabilitiesFor(["supervisor"]);
      expect(supervisor.issue).toBe(true);
      expect(supervisor.administer).toBe(true);
      expect(supervisor.capture).toBe(false);
    });

    it("an admin issues and administers", () => {
      const admin = capabilitiesFor(["admin"]);
      expect(admin.issue).toBe(true);
      expect(admin.administer).toBe(true);
    });

    it("a viewer in one organisation and an admin in another may issue", () => {
      const mixed = capabilitiesFor(["viewer", "admin"]);
      expect(mixed.issue).toBe(true);
      expect(mixed.administer).toBe(true);
    });

    it("no role anywhere means no capabilities at all, including the new two", () => {
      expect(capabilitiesFor([])).toEqual(NO_CAPABILITIES);
      expect(Object.values(NO_CAPABILITIES).every((value) => value === false)).toBe(true);
    });
  });
});
