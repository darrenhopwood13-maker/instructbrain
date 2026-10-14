import { describe, expect, it } from "vitest";
import {
  firmKeyOf,
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

const ABC_GROUNDWORKS: DirectoryHolder = {
  id: "row-abc-ground",
  company: "ABC Civil Engineering",
  trade: "Groundworks",
  contactIds: ["c-abc"],
};
const HOBBS_GROUNDWORKS: DirectoryHolder = {
  id: "row-hobbs-ground",
  company: "Hobbs Civil Engineering",
  trade: "Groundworks",
  contactIds: ["c-hobbs"],
};
const ABC_DAMP: DirectoryHolder = {
  id: "row-abc-damp",
  company: "ABC Civil Engineering",
  trade: "Damp-proofing",
  contactIds: ["c-abc"],
};
const PREMIER_JOINERY: DirectoryHolder = {
  id: "row-premier-joinery",
  company: "Premier Interiors",
  trade: "Carpenter / joiner",
  contactIds: ["c-premier"],
};
const PREMIER_TILER: DirectoryHolder = {
  id: "row-premier-tiler",
  company: "Premier Interiors",
  trade: "Tiler",
  contactIds: ["c-premier"],
};

function maps(holders: DirectoryHolder[]) {
  const byTrade = new Map<string, DirectoryHolder[]>();
  const byContact = new Map<string, string>();
  for (const holder of holders) {
    const key = (holder.trade ?? "").trim().toLowerCase();
    byTrade.set(key, [...(byTrade.get(key) ?? []), holder]);
    const firm = firmKeyOf(holder.company);
    for (const contact of holder.contactIds) if (firm) byContact.set(contact, firm);
  }
  return { byTrade, byContact };
}

const ABC = "firm:abc civil engineering";
const HOBBS = "firm:hobbs civil engineering";
const PREMIER = "firm:premier interiors";

describe("a firm is a name, not a row", () => {
  it("keys the same firm the same way however it is typed", () => {
    expect(firmKeyOf("ABC Civil Engineering")).toBe(ABC);
    expect(firmKeyOf("  abc   civil engineering ")).toBe(ABC);
    expect(firmKeyOf("")).toBeNull();
    expect(firmKeyOf(null)).toBeNull();
  });
});

describe("which firm an item belongs to", () => {
  it("lets an explicit assignment win over the trade", () => {
    const { byTrade, byContact } = maps([ABC_GROUNDWORKS, HOBBS_GROUNDWORKS, ABC_DAMP]);
    expect(
      resolveFirmKey({ assignedContactId: "c-hobbs", assignedTrade: "Groundworks" }, byTrade, byContact),
    ).toBe(HOBBS);
  });

  it("resolves a trade held by one firm without asking anybody", () => {
    const { byTrade, byContact } = maps([ABC_GROUNDWORKS, PREMIER_TILER]);
    expect(resolveFirmKey({ assignedTrade: "tiler" }, byTrade, byContact)).toBe(PREMIER);
  });

  it("resolves a trade held by TWO firms to nobody, rather than picking the first", () => {
    // The bug this replaces: the lookup took the first directory row whose trade
    // matched, so the second firm on a trade was never sent anything and
    // nothing said so. A decision belongs to a person.
    const { byTrade, byContact } = maps([ABC_GROUNDWORKS, HOBBS_GROUNDWORKS]);
    expect(resolveFirmKey({ assignedTrade: "Groundworks" }, byTrade, byContact)).toBeNull();
  });

  it("still resolves when the same firm holds a trade on more than one row", () => {
    // Two rows, one firm. There is still nothing to decide.
    const { byTrade, byContact } = maps([ABC_GROUNDWORKS, { ...ABC_GROUNDWORKS, id: "row-abc-ground-2" }]);
    expect(resolveFirmKey({ assignedTrade: "Groundworks" }, byTrade, byContact)).toBe(ABC);
  });

  it("leaves an item with no trade with nobody", () => {
    const { byTrade, byContact } = maps([ABC_GROUNDWORKS]);
    expect(resolveFirmKey({ assignedTrade: null }, byTrade, byContact)).toBeNull();
    expect(resolveFirmKey({ assignedTrade: "  " }, byTrade, byContact)).toBeNull();
  });
});

describe("grouping by subcontractor", () => {
  it("puts ONE firm's several trades in one group, whatever the trade", () => {
    // Measured on the live screen, 14 Oct 2026: Premier Interiors holds four
    // trades as four rows, and grouping on the row gave that one firm four
    // separate extracts of its own work. The firm is the recipient, so the firm
    // is the group.
    const findings = [
      finding({ id: "a", ref: "F-001", assignedFirmKey: PREMIER }),
      finding({ id: "b", ref: "F-002", assignedFirmKey: PREMIER, assignedTrade: "Tiler" }),
      finding({ id: "c", ref: "F-003", assignedFirmKey: PREMIER, assignedTrade: "Decorator" }),
      finding({ id: "d", ref: "F-004", assignedFirmKey: PREMIER, assignedTrade: "Plasterer" }),
      finding({ id: "e", ref: "F-005", assignedFirmKey: ABC, assignedTrade: "Groundworks" }),
    ];
    const groups = groupForDistribution(findings, "subcontractor");
    expect(groups.map((group) => group.key)).toEqual([ABC, PREMIER]);
    expect(groups[1]!.items.map((item) => item.ref)).toEqual(["F-001", "F-002", "F-003", "F-004"]);
  });

  it("names each firm, and tells two firms on one trade apart by their package", () => {
    const labels = new Map([
      ["firm:abc civil engineering", "ABC Civil Engineering - RC frame and slabs"],
      [HOBBS, "Hobbs Civil Engineering - Drainage and attenuation"],
      [PREMIER, "Premier Interiors"],
    ]);
    expect(groupLabelOf(ABC, "subcontractor", null, labels)).toBe(
      "ABC Civil Engineering - RC frame and slabs",
    );
    expect(groupLabelOf(HOBBS, "subcontractor", null, labels)).toBe(
      "Hobbs Civil Engineering - Drainage and attenuation",
    );
  });

  it("collects everything nobody is allocated to, and says so in words", () => {
    const findings = [
      finding({ id: "a", assignedFirmKey: null }),
      finding({ id: "b", assignedFirmKey: ABC }),
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
