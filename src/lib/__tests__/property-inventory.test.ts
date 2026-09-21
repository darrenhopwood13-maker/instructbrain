import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  propertyInventoryDefinition,
  snapshotOf,
  systemDefinitions,
} from "@/lib/survey-definitions";
import {
  asksForDocumentHeader,
  photoExcludesFromAnalysis,
  photoRoleLabel,
  photoWorkflowOf,
  reportLayoutOf,
} from "@/lib/survey-types";

describe("property inventory", () => {
  it("is version 3 and asks for its own document header", () => {
    expect(propertyInventoryDefinition.version).toBe(3);
    expect(asksForDocumentHeader(propertyInventoryDefinition)).toBe(true);
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

    expect(layout?.kind).toBe("inventory_room_schedule");
    expect(layout?.columns).toMatchObject({
      item: "Item",
      description: "Description",
      condition: "Condition",
      checkoutComment: "Check Out Comment",
    });
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
