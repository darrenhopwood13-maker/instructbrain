import { describe, expect, it } from "vitest";
import {
  coerceRoomProposal,
  mergeProposals,
  roomApplyPlan,
  roomSuggestionPrompt,
} from "@/lib/photos/room-suggest";
import type { PhotoWorkflow } from "@/lib/survey-types";

const workflow = {
  kind: "inventory_room_schedule",
  sectionField: "room",
  roleField: "_photo_role",
  overviewRoleId: "room_overview",
  detailRoleId: "inventory_detail",
  maxOverviewPhotos: 3,
  sectionSuggestions: ["Living room", "Kitchen"],
  roles: [],
} as unknown as PhotoWorkflow;

const photoIds = ["p1", "p2", "p3", "p4", "p5", "p6"];
const options = { photoIds, workflow, confidenceThreshold: 0.6 };

describe("suggesting rooms", () => {
  it("keeps a low-confidence room out of the accepted set and never in another room", () => {
    const proposal = coerceRoomProposal(
      {
        rooms: [
          { label: "Living room", photoRefs: [1, 2], confidence: 0.9, reason: "Sofa" },
          { label: "Kitchen", photoRefs: [3], confidence: 0.2, reason: "Unclear" },
        ],
        unsure: [4],
      },
      options,
    );

    expect(proposal.rooms[0]!.lowConfidence).toBe(false);
    expect(proposal.rooms[1]!.lowConfidence).toBe(true);
    expect(proposal.unsure).toContain("p4");
    expect(proposal.rooms.some((room) => room.photoIds.includes("p4"))).toBe(false);
  });

  it("holds every unmentioned photograph back rather than guessing", () => {
    const proposal = coerceRoomProposal(
      { rooms: [{ label: "Kitchen", photoRefs: [1], confidence: 0.9 }], unsure: [] },
      options,
    );
    expect(proposal.unsure).toEqual(["p2", "p3", "p4", "p5", "p6"]);
  });

  it("caps overview photographs at the template's limit", () => {
    const proposal = coerceRoomProposal(
      {
        rooms: [
          {
            label: "Living room",
            photoRefs: [1, 2, 3, 4, 5],
            overviewRefs: [1, 2, 3, 4, 5],
            confidence: 0.9,
          },
        ],
      },
      options,
    );
    expect(proposal.rooms[0]!.overviewPhotoIds).toHaveLength(3);
  });

  it("prefers the template's own room wording", () => {
    const proposal = coerceRoomProposal(
      { rooms: [{ label: "living ROOM", photoRefs: [1], confidence: 0.9 }] },
      options,
    );
    expect(proposal.rooms[0]!.label).toBe("Living room");
  });

  it("drops a room with no title or no photographs", () => {
    const proposal = coerceRoomProposal(
      {
        rooms: [
          { label: "", photoRefs: [1], confidence: 0.9 },
          { label: "Kitchen", photoRefs: [], confidence: 0.9 },
        ],
      },
      options,
    );
    expect(proposal.rooms).toHaveLength(0);
    expect(proposal.unsure).toContain("p1");
  });

  it("builds its prompt from the template, never from hardcoded rooms", () => {
    const { system, user } = roomSuggestionPrompt(workflow, {
      count: 6,
      roomsSoFar: ["Living room"],
    });
    expect(system).toContain("Living room, Kitchen");
    expect(system).toContain("up to 3");
    expect(user).toContain("Living room");
  });

  it("never lets a photograph appear in two rooms when batches are merged", () => {
    const merged = mergeProposals([
      {
        rooms: [
          {
            label: "Living room",
            photoIds: ["p1"],
            overviewPhotoIds: [],
            confidence: 0.9,
            reason: "",
            lowConfidence: false,
          },
        ],
        unsure: ["p2"],
      },
      {
        rooms: [
          {
            label: "Kitchen",
            photoIds: ["p2"],
            overviewPhotoIds: [],
            confidence: 0.9,
            reason: "",
            lowConfidence: false,
          },
        ],
        unsure: [],
      },
    ]);
    expect(merged.rooms.flatMap((room) => room.photoIds)).toEqual(["p1", "p2"]);
    expect(merged.unsure).toEqual([]);
  });
});

describe("applying an accepted proposal", () => {
  it("writes item and overview photographs through the ordinary room patches", () => {
    const plan = roomApplyPlan(
      [{ label: "Living room", photoIds: ["p1", "p2", "p3"], overviewPhotoIds: ["p1"] }],
      workflow,
      2,
    );
    expect(plan).toEqual([
      { ids: ["p2", "p3"], patch: { _room_order: "2", room: "Living room", _photo_role: "inventory_detail" } },
      { ids: ["p1"], patch: { _room_order: "2", room: "Living room", _photo_role: "room_overview" } },
    ]);
  });

  it("refuses the whole plan rather than half-applying a bad one", () => {
    expect(() =>
      roomApplyPlan(
        [
          { label: "Living room", photoIds: ["p1"], overviewPhotoIds: [] },
          { label: " ", photoIds: ["p2"], overviewPhotoIds: [] },
        ],
        workflow,
        0,
      ),
    ).toThrow(/title/i);

    expect(() =>
      roomApplyPlan(
        [
          { label: "Living room", photoIds: ["p1"], overviewPhotoIds: [] },
          { label: "Kitchen", photoIds: ["p1"], overviewPhotoIds: [] },
        ],
        workflow,
        0,
      ),
    ).toThrow(/two rooms/i);
  });
});
