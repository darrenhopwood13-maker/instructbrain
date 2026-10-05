import { describe, expect, it } from "vitest";
import { scheduleOfConditionDefinition, snapshotOf } from "@/lib/survey-definitions";
import { requiresConditionGrade, requiresTradeAssignment } from "@/lib/survey-types";

/**
 * A Schedule of Condition grades each element. It does NOT name a trade.
 *
 * The definition briefly required both, so that one survey type exercised both
 * capability flags. On live data that produced the same trade -
 * "Principal contractor" - on all twenty elements of a real report: noise on the
 * document, and twenty pointless decisions on the organiser. The grade is the
 * claim this report makes, so trade assignment is off and the assessment is told
 * not to name one.
 *
 * These assertions exist because the whole suite stayed green when the flag was
 * flipped: no test was holding this behaviour in place, so nothing would have
 * caught it being turned back on.
 */
describe("the Schedule of Condition definition", () => {
  it("asks for a condition grade", () => {
    expect(scheduleOfConditionDefinition.requiresConditionGrade).toBe(true);
  });

  it("does not ask for a trade, and names no standard trades", () => {
    expect(scheduleOfConditionDefinition.requiresTradeAssignment).toBe(false);
    expect(scheduleOfConditionDefinition.standardTrades).toEqual([]);
  });

  it("reads the same through a frozen snapshot as through the definition", () => {
    const snapshot = snapshotOf(scheduleOfConditionDefinition);
    expect(requiresConditionGrade(snapshot)).toBe(true);
    expect(requiresTradeAssignment(snapshot)).toBe(false);
  });

  it("tells the assessment not to name a trade", () => {
    const guidance = scheduleOfConditionDefinition.aiGuidance.tradeGuidance ?? "";
    expect(guidance.toLowerCase()).toContain("do not suggest a trade");
  });

  it("carries the scope section the limitations block is rendered into", () => {
    expect(scheduleOfConditionDefinition.outputSections).toContain("scope");
  });
});
