import { describe, expect, it } from "vitest";

import {
  activityFrom,
  kindOf,
  lifecycleLabel,
  toLifecycleState,
  verbFor,
  type ActivityRow,
} from "@/lib/analytics/activity";

const SUBJECT = {
  findingRef: "F-003",
  findingTitle: "Cover missing on the distribution board",
  reportId: "r1",
  reportRef: "EIC-2026-10-001",
  reportTitle: "Electrical installation condition",
  projectName: "Riverside Court",
  evidencePath: null,
};

function row(over: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "a1",
    action: "lifecycle.transition",
    at: "2026-10-11T10:00:00.000Z",
    actorName: "Darren Hopwood",
    before: { lifecycle_state: "in_progress" },
    after: { lifecycle_state: "fixed" },
    subject: { ...SUBJECT },
    ...over,
  };
}

describe("reading a lifecycle transition", () => {
  it("reads the landing state out of the after payload", () => {
    expect(toLifecycleState({ lifecycle_state: "fixed" })).toBe("fixed");
    expect(toLifecycleState({ lifecycle_state: "  verified  " })).toBe("verified");
  });

  it("returns null rather than guessing at a missing or malformed payload", () => {
    expect(toLifecycleState(null)).toBeNull();
    expect(toLifecycleState("fixed")).toBeNull();
    expect(toLifecycleState({})).toBeNull();
    expect(toLifecycleState({ lifecycle_state: 42 })).toBeNull();
  });
});

describe("the kind of event", () => {
  it("separates a claim from a verification", () => {
    // The distinction the lifecycle exists for: a trade saying "done" is not the
    // same fact as a surveyor having checked it.
    expect(kindOf("lifecycle.transition", { lifecycle_state: "fixed" })).toBe("reported_fixed");
    expect(kindOf("lifecycle.transition", { lifecycle_state: "verified" })).toBe("closed_out");
  });

  it("treats a rejected item as its own thing, not as progress", () => {
    expect(kindOf("lifecycle.transition", { lifecycle_state: "rejected" })).toBe("rejected");
  });

  it("classes the rest of the lifecycle as progress", () => {
    expect(kindOf("lifecycle.transition", { lifecycle_state: "in_progress" })).toBe("progress");
    expect(kindOf("lifecycle.transition", { lifecycle_state: "assigned" })).toBe("progress");
  });

  it("recognises report and edit events", () => {
    expect(kindOf("report.issue", null)).toBe("report_event");
    expect(kindOf("finding.update", null)).toBe("item_edit");
    expect(kindOf("something.else", null)).toBe("other");
  });
});

describe("the verb that follows a name", () => {
  it("words each landing state plainly", () => {
    expect(verbFor("lifecycle.transition", { lifecycle_state: "fixed" })).toBe("reported fixed");
    expect(verbFor("lifecycle.transition", { lifecycle_state: "verified" })).toBe("closed out");
    expect(verbFor("lifecycle.transition", { lifecycle_state: "rejected" })).toBe("sent back");
  });

  it("still renders something for an action it has never been taught", () => {
    // A row must never come out blank, whatever a future action is called.
    expect(verbFor("finding.something_new", null)).toBe("something new");
    expect(verbFor("weird", null)).toBe("weird");
  });

  it("labels a state humanely", () => {
    expect(lifecycleLabel("fixed")).toBe("marked fixed");
    expect(lifecycleLabel(null)).toBeNull();
  });
});

describe("building the feed", () => {
  it("leads with close-outs, whatever happened most recently", () => {
    const feed = activityFrom([
      row({ id: "edit", action: "finding.update", at: "2026-10-11T12:00:00.000Z" }),
      row({ id: "closed", after: { lifecycle_state: "verified" }, at: "2026-10-01T09:00:00.000Z" }),
    ]);
    // The edit is newer, but an account with one closure should open on the closure.
    expect(feed.events.map((event) => event.id)).toEqual(["closed", "edit"]);
    expect(feed.events[0]?.isCloseOut).toBe(true);
  });

  it("counts every close-out, not just the ones on screen", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row({ id: `c${i}`, after: { lifecycle_state: "verified" }, at: "2026-10-11T10:00:00.000Z" }),
    );
    const feed = activityFrom(many, { limit: 20 });
    expect(feed.events).toHaveLength(20);
    expect(feed.closeOutTotal).toBe(30);
    expect(feed.total).toBe(30);
    expect(feed.truncated).toBe(true);
  });

  it("is empty, and says so, when nothing has ever happened", () => {
    const feed = activityFrom([]);
    expect(feed.events).toEqual([]);
    expect(feed.closeOutTotal).toBe(0);
    expect(feed.truncated).toBe(false);
  });

  it("carries an honest actor name, including when there is none", () => {
    const feed = activityFrom([row({ actorName: null })]);
    // Null stays null so the caller can say "Someone" - never a blank where a
    // person should be.
    expect(feed.events[0]?.actorName).toBeNull();
  });

  it("keeps a close-out that has no photograph, rather than hiding it", () => {
    const feed = activityFrom([row({ subject: { ...SUBJECT, evidencePath: null } })]);
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0]?.subject.evidencePath).toBeNull();
    expect(feed.events[0]?.kind).toBe("reported_fixed");
  });

  it("carries the evidence path through when there is one", () => {
    const feed = activityFrom([
      row({ subject: { ...SUBJECT, evidencePath: "org/report/closeout.jpg" } }),
    ]);
    expect(feed.events[0]?.subject.evidencePath).toBe("org/report/closeout.jpg");
  });
});
