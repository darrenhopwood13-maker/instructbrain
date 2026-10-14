import { describe, expect, it } from "vitest";
import {
  groupForDistribution,
  groupKeyOf,
  groupLabelOf,
  resolveFirmKey,
  UNASSIGNED_GROUP,
  type DirectoryHolder,
  type GroupableFinding,
} from "@/lib/distribution";

function finding(over: Partial<GroupableFinding> = {}): GroupableFinding {
  return {
    id: "f1",
    ref: "F-001",
    assignedTrade: "Groundworks",
    severityId: "high",
    captureFields: {},
    isConfidential: false,
    findingText: "Missing drainage surround.",
    remedialText: "Form a surround.",
    dueDate: null,
    ...over,
  };
}

const GROUNDWORKS_A: DirectoryHolder = { id: "dir-a", trade: "Groundworks", contactIds: ["c-a"] };
const GROUNDWORKS_B: DirectoryHolder = { id: "dir-b", trade: "Groundworks", contactIds: ["c-b"] };
const CEILINGS: DirectoryHolder = { id: "dir-c", trade: "Ceilings", contactIds: ["c-c"] };

function maps(holders: DirectoryHolder[]) {
  const byTrade = new Map<string, DirectoryHolder[]>();
  const byContact = new Map<string, string>();
  for (const holder of holders) {
    const key = (holder.trade ?? "").trim().toLowerCase();
    byTrade.set(key, [...(byTrade.get(key) ?? []), holder]);
    for (const contact of holder.contactIds) byContact.set(contact, holder.id);
  }
  return { byTrade, byContact };
}

describe("which firm an item belongs to", () => {
  it("lets an explicit assignment win over the trade", () => {
    const { byTrade, byContact } = maps([GROUNDWORKS_A, GROUNDWORKS_B]);
    expect(
      resolveFirmKey({ assignedContactId: "c-b", assignedTrade: "Groundworks" }, byTrade, byContact),
    ).toBe("dir-b");
  });

  it("resolves a trade held by one firm without asking anybody", () => {
    const { byTrade, byContact } = maps([GROUNDWORKS_A, CEILINGS]);
    expect(resolveFirmKey({ assignedTrade: "ceilings" }, byTrade, byContact)).toBe("dir-c");
  });

  it("resolves a trade held by TWO firms to nobody, rather than picking the first", () => {
    // The bug this replaces: the old lookup took the first directory row whose
    // trade matched, so the second firm on a trade was never sent anything and
    // nothing said so. A decision belongs to a person.
    const { byTrade, byContact } = maps([GROUNDWORKS_A, GROUNDWORKS_B]);
    expect(resolveFirmKey({ assignedTrade: "Groundworks" }, byTrade, byContact)).toBeNull();
  });

  it("leaves an item with no trade with nobody", () => {
    const { byTrade, byContact } = maps([GROUNDWORKS_A]);
    expect(resolveFirmKey({ assignedTrade: null }, byTrade, byContact)).toBeNull();
    expect(resolveFirmKey({ assignedTrade: "  " }, byTrade, byContact)).toBeNull();
  });
});

describe("grouping by subcontractor", () => {
  it("puts one firm's several trades in ONE group, whatever the trade", () => {
    // The whole point: a firm holding groundworks and drainage receives one
    // extract, not one per trade.
    const findings = [
      finding({ id: "a", ref: "F-001", assignedFirmKey: "dir-a" }),
      finding({ id: "b", ref: "F-002", assignedFirmKey: "dir-a", assignedTrade: "Drainage" }),
      finding({ id: "c", ref: "F-003", assignedFirmKey: "dir-c", assignedTrade: "Ceilings" }),
    ];
    const groups = groupForDistribution(findings, "subcontractor");
    expect(groups.map((group) => group.key)).toEqual(["dir-a", "dir-c"]);
    expect(groups[0]!.items.map((item) => item.ref)).toEqual(["F-001", "F-002"]);
  });

  it("names each firm, and tells two firms on one trade apart by their package", () => {
    const labels = new Map([
      ["dir-a", "ABC Civil Engineering - Drainage and attenuation"],
      ["dir-b", "ABC Civil Engineering - RC frame and slabs"],
    ]);
    expect(groupLabelOf("dir-a", "subcontractor", null, labels)).toBe(
      "ABC Civil Engineering - Drainage and attenuation",
    );
    expect(groupLabelOf("dir-b", "subcontractor", null, labels)).toBe(
      "ABC Civil Engineering - RC frame and slabs",
    );
  });

  it("collects everything nobody is allocated to, and says so in words", () => {
    const findings = [
      finding({ id: "a", assignedFirmKey: null }),
      finding({ id: "b", assignedFirmKey: "dir-a" }),
    ];
    const groups = groupForDistribution(findings, "subcontractor");
    expect(groups[0]!.key).toBe(UNASSIGNED_GROUP);
    expect(groups[0]!.label).toBe("Nobody allocated");
    expect(groups[0]!.items).toHaveLength(1);
  });

  it("never puts a confidential item in any group, including nobody-allocated", () => {
    const findings = [finding({ id: "a", assignedFirmKey: null, isConfidential: true })];
    expect(groupForDistribution(findings, "subcontractor")).toHaveLength(0);
  });

  it("still falls back to the trade when nobody has resolved a firm", () => {
    expect(groupKeyOf(finding({ assignedFirmKey: null }), "trade")).toBe("Groundworks");
    expect(groupKeyOf(finding({ assignedTrade: null }), "trade")).toBe(UNASSIGNED_GROUP);
  });
});
