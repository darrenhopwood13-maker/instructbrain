import { describe, expect, it } from "vitest";

import { inventoryReadiness, outstandingReadiness } from "@/lib/photos/inventory-readiness";
import type { PhotoWorkflow } from "@/lib/survey-types";

const workflow = {
  mode: "sections",
  roleField: "photo_role",
  sectionField: "room",
  coverRoleId: "exterior",
  firstPhotoRoleId: "exterior",
  overviewRoleId: "room_overview",
  maxOverviewPhotos: 3,
} as unknown as PhotoWorkflow;

function photo(id: string, fields: Record<string, string>) {
  return { id, sequence: Number(id), capture_fields: fields };
}

describe("inventoryReadiness", () => {
  it("shows no steps until photographs exist", () => {
    expect(inventoryReadiness(workflow, [], null)).toEqual([]);
  });

  it("flags every outstanding step on a bare set of photographs", () => {
    const steps = inventoryReadiness(workflow, [photo("1", {}), photo("2", {})], null);
    expect(steps.map((step) => step.id)).toEqual(["cover", "rooms", "allocated", "overviews"]);
    expect(outstandingReadiness(steps)).toBe(4);
  });

  it("is complete when the cover, rooms, allocation and room photographs are all set", () => {
    const steps = inventoryReadiness(
      workflow,
      [
        photo("1", { photo_role: "exterior" }),
        photo("2", { room: "Kitchen", photo_role: "room_overview" }),
        photo("3", { room: "Kitchen", photo_role: "room_overview" }),
        photo("4", { room: "Kitchen", photo_role: "room_overview" }),
        photo("5", { room: "Kitchen", photo_role: "item" }),
      ],
      "1",
    );
    expect(outstandingReadiness(steps)).toBe(0);
  });

  it("names the room still short of its room photographs", () => {
    const steps = inventoryReadiness(
      workflow,
      [
        photo("1", { photo_role: "exterior" }),
        photo("2", { room: "Hallway", photo_role: "room_overview" }),
        photo("3", { room: "Hallway", photo_role: "item" }),
      ],
      "1",
    );
    const overviews = steps.find((step) => step.id === "overviews");
    expect(overviews?.done).toBe(false);
    expect(overviews?.detail).toContain("Hallway (1 of 3)");
  });
});
