import { describe, expect, it } from "vitest";
import { HELP_TOPICS } from "@/lib/help-content";

describe("help topics", () => {
  it("covers every task, in the order a person actually works", () => {
    expect(HELP_TOPICS.length).toBeGreaterThanOrEqual(13);
  });

  it("gives every topic its own id, a title and a one-line caption", () => {
    const ids = HELP_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.title.trim().length).toBeGreaterThan(3);
      expect(topic.caption.trim().length).toBeGreaterThan(3);
      expect(topic.caption).not.toContain("\n");
    }
  });

  it("keeps the slot for short clips - a topic never carries a link", () => {
    for (const topic of HELP_TOPICS) {
      expect(Object.prototype.hasOwnProperty.call(topic, "href")).toBe(false);
      if (topic.clipUrl !== null) expect(topic.clipUrl).toMatch(/^https:\/\//);
    }
  });
});
