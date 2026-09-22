import { describe, expect, it } from "vitest";
import {
  allocateToRoomFields,
  clearRoomFields,
  groupPhotosByRoom,
  headerSlotsLeft,
  markAsRoomHeaderFields,
  renameRoomFields,
  reorderedRoomLabels,
  mergeDraftRooms,
  ROOM_ORDER_FIELD,
  type RoomPhoto,
} from "@/lib/photos/rooms";
import { isNetworkFailure, describeStartFailure } from "@/lib/network-error";
import type { PhotoWorkflow } from "@/lib/survey-types";

const workflow = {
  kind: "inventory_room_schedule",
  sectionField: "room",
  roleField: "_photo_role",
  overviewRoleId: "room_overview",
  detailRoleId: "inventory_detail",
  maxOverviewPhotos: 3,
  roles: [],
} as unknown as PhotoWorkflow;

function photo(id: string, sequence: number, fields: Record<string, string>): RoomPhoto {
  return { id, sequence, capture_fields: fields };
}

describe("sorting photographs into rooms", () => {
  it("groups by room and keeps un-allocated photographs separate", () => {
    const { rooms, unallocated } = groupPhotosByRoom(
      [
        photo("a", 1, {}),
        photo("b", 2, { room: "Living room", _photo_role: "room_overview" }),
        photo("c", 3, { room: "Living room", _photo_role: "inventory_detail" }),
        photo("d", 4, { room: "Kitchen", _photo_role: "inventory_detail" }),
      ],
      workflow,
    );
    expect(unallocated.map((p) => p.id)).toEqual(["a"]);
    expect(rooms.map((r) => r.label)).toEqual(["Living room", "Kitchen"]);
    expect(rooms[0]!.overviewPhotos.map((p) => p.id)).toEqual(["b"]);
    expect(rooms[0]!.itemPhotos.map((p) => p.id)).toEqual(["c"]);
  });

  it("orders rooms by the explicit order key, then first photograph", () => {
    const { rooms } = groupPhotosByRoom(
      [
        photo("a", 1, { room: "Kitchen", [ROOM_ORDER_FIELD]: "2" }),
        photo("b", 2, { room: "Living room", [ROOM_ORDER_FIELD]: "1" }),
      ],
      workflow,
    );
    expect(rooms.map((r) => r.label)).toEqual(["Living room", "Kitchen"]);
  });

  it("limits header photographs to three per room", () => {
    const { rooms } = groupPhotosByRoom(
      [1, 2, 3].map((n) =>
        photo(`h${n}`, n, { room: "Living room", _photo_role: "room_overview" }),
      ),
      workflow,
    );
    expect(headerSlotsLeft(rooms[0], workflow)).toBe(0);
    expect(markAsRoomHeaderFields(workflow)).toEqual({ _photo_role: "room_overview" });
  });

  it("allocates, renames and clears through capture fields only", () => {
    expect(allocateToRoomFields(workflow, " Kitchen ", 2)).toEqual({
      room: "Kitchen",
      _photo_role: "inventory_detail",
      [ROOM_ORDER_FIELD]: "2",
    });
    expect(renameRoomFields(workflow, "Master bedroom")).toEqual({ room: "Master bedroom" });
    expect(clearRoomFields(workflow)).toEqual({
      room: "",
      _photo_role: "",
      [ROOM_ORDER_FIELD]: "",
    });
  });

  it("moves a room up and down without losing the others", () => {
    const { rooms } = groupPhotosByRoom(
      [
        photo("a", 1, { room: "Living room" }),
        photo("b", 2, { room: "Kitchen" }),
        photo("c", 3, { room: "Dining room" }),
      ],
      workflow,
    );
    expect(reorderedRoomLabels(rooms, "kitchen", -1)).toEqual([
      "Kitchen",
      "Living room",
      "Dining room",
    ]);
    expect(reorderedRoomLabels(rooms, "dining room", 1)).toEqual([
      "Living room",
      "Kitchen",
      "Dining room",
    ]);
  });
});

describe("starting a report on a weak signal", () => {
  it("recognises connection failures and leaves other errors alone", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("Report allowance reached for this month."))).toBe(false);
  });

  it("never shows the bare browser wording", () => {
    expect(describeStartFailure(new TypeError("Failed to fetch"))).not.toContain("Failed to fetch");
    expect(describeStartFailure(new Error("Choose a report template first."))).toBe(
      "Choose a report template first.",
    );
  });
});
