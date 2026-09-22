import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  propertyInventoryDefinition,
  snapshotOf,
  systemDefinitions,
} from "@/lib/survey-definitions";
import {
  asksForDocumentHeader,
  findingsRuleForPhoto,
  photoExcludesFromAnalysis,
  photoRoleLabel,
  photoWorkflowOf,
  reportLayoutOf,
} from "@/lib/survey-types";
import {
  inventoryAppendixEntries,
  inventoryItemTableLabel,
  inventoryItemWithPhotoLabel,
  inventoryRoomPhotoGroups,
  inventoryRooms,
} from "@/lib/report/inventory-layout";
import type { DocFinding, DocPhoto, ReportDocument } from "@/lib/report/document";
import { reportPrintPageClass } from "@/lib/report/print-layout";

describe("property inventory", () => {
  it("is version 5 and asks for its own document header", () => {
    expect(propertyInventoryDefinition.version).toBe(5);
    expect(asksForDocumentHeader(propertyInventoryDefinition)).toBe(true);
  });

  it("offers room title suggestions from the definition, not from shared code", () => {
    const workflow = photoWorkflowOf(snapshotOf(propertyInventoryDefinition));
    expect(workflow?.sectionSuggestions).toContain("Living room");
    expect(workflow?.sectionSuggestions).toContain("Ensuite");
    expect(workflow?.sectionSuggestions?.length ?? 0).toBeGreaterThan(8);
  });

  it("carries its room inventory workflow and layout in the snapshot", () => {
    const snapshot = snapshotOf(propertyInventoryDefinition);
    const workflow = photoWorkflowOf(snapshot);
    const layout = reportLayoutOf(snapshot);

    expect(workflow?.kind).toBe("inventory_room_schedule");
    expect(workflow?.sectionField).toBe("room");
    expect(workflow?.maxOverviewPhotos).toBe(3);
    expect(photoRoleLabel(snapshot, {}, { isFirstPhoto: true })).toBe("Exterior / title page");
    expect(photoExcludesFromAnalysis(snapshot, {}, { isFirstPhoto: true })).toBe(true);
    expect(photoExcludesFromAnalysis(snapshot, { _photo_role: "room_overview" })).toBe(true);
    expect(photoExcludesFromAnalysis(snapshot, { _photo_role: "inventory_detail" })).toBe(false);
    expect(photoExcludesFromAnalysis(snapshot, {}, { isCover: true })).toBe(true);
    expect(workflow?.roles.find((role) => role.id === "inventory_detail")?.maxFindingsPerPhoto).toBe(1);
    expect(findingsRuleForPhoto(snapshot, { _photo_role: "inventory_detail" })?.findingsPerPhoto).toBe("one");

    expect(layout?.kind).toBe("inventory_room_schedule");
    expect(layout?.columns).toMatchObject({
      item: "Item",
      description: "Description",
      condition: "Condition",
      checkoutComment: "Check Out Comment",
    });
    expect(layout?.backingPages?.map((page) => page.title)).toEqual([
      "Inventory guidance notes",
      "Check-in notes",
      "Check-out report wording",
      "Schedule of condition",
      "Keys and meter readings",
    ]);
  });

  it("groups multiple rooms by upload order and keeps their three overview photographs separate", () => {
    const snapshot = snapshotOf(propertyInventoryDefinition);
    const photo = (id: string, sequence: number, room: string, role: string): DocPhoto => ({
      id,
      sequence,
      filename: `${id}.jpg`,
      capturedAt: null,
      url: null,
      thumbUrl: null,
      captureFields: { room, _photo_role: role },
    });
    const photos: DocPhoto[] = [
      photo("cover", 1, "", "exterior_cover"),
      photo("living-wide-1", 2, "Living room", "room_overview"),
      photo("living-wide-2", 3, "Living room", "room_overview"),
      photo("living-wide-3", 4, "Living room", "room_overview"),
      photo("living-chair", 5, "Living room", "inventory_detail"),
      photo("kitchen-wide-1", 6, "Kitchen", "room_overview"),
      photo("kitchen-wide-2", 7, "Kitchen", "room_overview"),
      photo("kitchen-wide-3", 8, "Kitchen", "room_overview"),
      photo("kitchen-table", 9, "Kitchen", "inventory_detail"),
    ];
    const finding = (id: string, ref: string, sequence: number, linked: DocPhoto): DocFinding => ({
      id,
      ref,
      sequence,
      statusId: "condition_good",
      severityId: null,
      categoryId: null,
      findingText: `${linked.captureFields["room"] ?? "Room"} item`,
      remedialText: "",
      captureFields: { room: linked.captureFields["room"] ?? "Room" },
      assignedTrade: null,
      suggestedTrade: null,
      tradeReasoning: null,
      tradeConfidence: null,
      dueDate: null,
      lifecycleState: "open",
      isConfidential: false,
      confirmedAt: null,
      likelyCause: null,
      regulatoryReference: null,
      abstainReason: null,
      photos: [{ photo: linked, role: "primary", region: null }],
    });
    const document = {
      report: {
        id: "inventory",
        title: "Inventory",
        subtitle: null,
        reference: null,
        reportDate: "2026-09-21",
        status: "draft",
        issuedAt: null,
        currentVersion: 0,
        scopeText: null,
        methodologyText: null,
        executiveSummary: null,
        synthesisConfirmed: false,
        coverPhotoId: "cover",
        outputLanguage: "en",
      },
      project: null,
      organisation: null,
      snapshot,
      findings: [finding("f2", "2", 2, photos[8]!), finding("f1", "1", 1, photos[4]!)],
      photos,
      synthesis: null,
      author: null,
    } as ReportDocument;

    const rooms = inventoryRooms(document);
    expect(rooms.map((room) => room.label)).toEqual(["Living room", "Kitchen"]);
    expect(rooms.map((room) => room.overviewPhotos.map((item) => item.sequence))).toEqual([
      [2, 3, 4],
      [6, 7, 8],
    ]);
    expect(rooms.map((room) => room.findings.map((item) => item.ref))).toEqual([["1"], ["2"]]);

    const appendix = inventoryAppendixEntries(document);
    expect(appendix.map((entry) => entry.photo.sequence)).toEqual([5, 9]);
    expect(appendix.map((entry) => entry.room)).toEqual(["Living room", "Kitchen"]);

    const groups = inventoryRoomPhotoGroups(document);
    expect(groups.rooms.map((group) => group.label)).toEqual(["Living room", "Kitchen"]);
    expect(groups.rooms.map((group) => group.entries.map((entry) => entry.photo.sequence))).toEqual([
      [5],
      [9],
    ]);
    expect(groups.unallocated).toEqual([]);
    expect(inventoryItemWithPhotoLabel(document.findings[0]!)).toBe("Item 2 · Photo 9");
    expect(inventoryItemTableLabel(document.findings[0]!)).toBe("Kitchen item (Photo 9)");
  });

  it("uses the photograph's current room after analysis and keeps its row with its photograph", () => {
    const snapshot = snapshotOf(propertyInventoryDefinition);
    const movedPhoto: DocPhoto = {
      id: "moved-item",
      sequence: 8,
      filename: "chair.jpg",
      capturedAt: null,
      url: null,
      thumbUrl: null,
      captureFields: { room: "Living room", _photo_role: "inventory_detail" },
    };
    const finding = {
      id: "finding-1",
      ref: "1",
      sequence: 1,
      statusId: "condition_good",
      severityId: null,
      categoryId: null,
      findingText: "Chair",
      remedialText: "",
      captureFields: { room: "Kitchen" },
      assignedTrade: null,
      suggestedTrade: null,
      tradeReasoning: null,
      tradeConfidence: null,
      dueDate: null,
      lifecycleState: "open",
      isConfidential: false,
      confirmedAt: null,
      likelyCause: null,
      regulatoryReference: null,
      abstainReason: null,
      photos: [{ photo: movedPhoto, role: "primary", region: null }],
    } as DocFinding;
    const document = {
      report: { coverPhotoId: null },
      snapshot,
      photos: [movedPhoto],
      findings: [finding],
    } as ReportDocument;

    expect(inventoryRooms(document).map((room) => [room.label, room.findings.map((item) => item.id)])).toEqual([
      ["Living room", ["finding-1"]],
    ]);
    expect(inventoryRoomPhotoGroups(document).rooms[0]?.entries[0]?.findings.map((item) => item.id)).toEqual([
      "finding-1",
    ]);
    expect(inventoryItemTableLabel(finding, document)).toBe("Chair (Photo 8)");
  });

  it("moves a previously analysed photograph into the room overview without leaving an item row", () => {
    const snapshot = snapshotOf(propertyInventoryDefinition);
    const overviewPhoto: DocPhoto = {
      id: "overview-after-analysis",
      sequence: 4,
      filename: "room.jpg",
      capturedAt: null,
      url: null,
      thumbUrl: null,
      captureFields: { room: "Kitchen", _photo_role: "room_overview" },
    };
    const staleFinding = {
      id: "stale-finding",
      ref: "1",
      sequence: 1,
      statusId: "condition_good",
      findingText: "Old item",
      captureFields: { room: "Kitchen" },
      photos: [{ photo: overviewPhoto, role: "primary", region: null }],
    } as DocFinding;
    const document = {
      report: { coverPhotoId: null },
      snapshot,
      photos: [overviewPhoto],
      findings: [staleFinding],
    } as ReportDocument;

    const rooms = inventoryRooms(document);
    expect(rooms[0]?.overviewPhotos.map((photo) => photo.id)).toEqual(["overview-after-analysis"]);
    expect(rooms[0]?.findings).toEqual([]);
    expect(inventoryAppendixEntries(document)).toEqual([]);
  });

  it("uses landscape print pages for inventory snapshots only", () => {
    expect(reportPrintPageClass({ snapshot: snapshotOf(propertyInventoryDefinition) })).toBe(
      "inventory-print-surface",
    );
    const other = systemDefinitions.find((definition) => definition.id !== propertyInventoryDefinition.id);
    expect(other).toBeDefined();
    if (!other) return;
    expect(reportPrintPageClass({ snapshot: snapshotOf(other) })).toBe("");
  });

  it("does not leak its header requirement into the other templates", () => {
    for (const definition of systemDefinitions) {
      if (definition.id === propertyInventoryDefinition.id) continue;
      expect(asksForDocumentHeader(definition)).toBe(false);
    }
  });

  it("tells the AI to group repeats rather than repeat them", () => {
    const guidance = propertyInventoryDefinition.aiGuidance?.["multiFindingGuidance"] ?? "";
    expect(guidance).toMatch(/quantity/i);
    expect(guidance).toMatch(/never one entry per copy/i);
  });

  it("sends the analysis image without sharing the thumbnail path", () => {
    const source = readFileSync("src/lib/photos/analysis-image.server.ts", "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    expect(source).not.toMatch(/from "[^"]*thumbnail[^"]*"/);
    expect(source).not.toMatch(/resize|maxEdge|drawImage/i);
  });
});

describe("snapshotOf", () => {
  it("carries the header flag into the frozen snapshot", () => {
    expect(asksForDocumentHeader(snapshotOf(propertyInventoryDefinition))).toBe(true);
  });
});
