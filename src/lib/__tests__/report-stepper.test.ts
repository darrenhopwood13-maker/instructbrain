import { describe, expect, it } from "vitest";
import { defaultStep, readyToIssue, resolveStep } from "@/components/report/report-stepper";

const open = { hasFindings: true, unresolved: 3, issued: false };
const resolved = { hasFindings: true, unresolved: 0, issued: false };
const published = { hasFindings: true, unresolved: 0, issued: true };

describe("report step derivation", () => {
  it("opens on photos with no findings", () => {
    expect(defaultStep({ hasFindings: false, unresolved: 0, issued: false })).toBe("photos");
  });
  it("opens on photos & findings while anything is unresolved", () => {
    expect(defaultStep({ hasFindings: true, unresolved: 3, issued: false })).toBe("photos");
  });
  it("opens on issue once resolved, or when issued", () => {
    expect(defaultStep({ hasFindings: true, unresolved: 0, issued: false })).toBe("output");
    expect(defaultStep({ hasFindings: true, unresolved: 2, issued: true })).toBe("output");
  });
  it("not assessed or unconfirmed items block the continue prompt", () => {
    expect(readyToIssue({ hasFindings: true, unresolved: 1, issued: false })).toBe(false);
    expect(readyToIssue({ hasFindings: true, unresolved: 0, issued: false })).toBe(true);
  });
});

describe("which step opens", () => {
  it("puts a published report on its published document, whatever the address bar says", () => {
    // The two step buttons are not rendered on a published report, so nothing
    // may land on a working screen the owner cannot get back out of.
    expect(resolveStep({ tab: "photos", locked: true, running: false, loaded: true, state: published })).toBe(
      "output",
    );
    expect(resolveStep({ tab: "output", locked: true, running: false, loaded: true, state: published })).toBe(
      "output",
    );
    expect(resolveStep({ tab: undefined, locked: true, running: false, loaded: true, state: published })).toBe(
      "output",
    );
  });

  it("still honours a tab while the report can be worked on", () => {
    expect(resolveStep({ tab: "photos", locked: false, running: false, loaded: true, state: resolved })).toBe(
      "photos",
    );
    expect(resolveStep({ tab: "output", locked: false, running: false, loaded: true, state: open })).toBe(
      "output",
    );
  });

  it("never opens on the review step, which has no screen of its own", () => {
    expect(resolveStep({ tab: "review", locked: false, running: false, loaded: true, state: open })).toBe(
      "photos",
    );
  });

  it("holds the screen on photos while a run is going, so the run is not cut short", () => {
    expect(resolveStep({ tab: undefined, locked: false, running: true, loaded: true, state: resolved })).toBe(
      "photos",
    );
  });

  it("waits for the report to load before deriving the step", () => {
    expect(resolveStep({ tab: undefined, locked: false, running: false, loaded: false, state: resolved })).toBe(
      "photos",
    );
  });

  it("derives the step from progress when there is no tab", () => {
    expect(resolveStep({ tab: undefined, locked: false, running: false, loaded: true, state: resolved })).toBe(
      "output",
    );
    expect(resolveStep({ tab: undefined, locked: false, running: false, loaded: true, state: open })).toBe(
      "photos",
    );
  });
});
