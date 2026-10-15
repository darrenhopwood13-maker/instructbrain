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

  it("gives every clip a poster, because the list draws stills", () => {
    // The list stopped autoplaying videos: a phone will not decode thirteen of
    // them at once, and the ones it skips cannot be played by tapping either. So
    // a topic with a clip must have a still to show in its place.
    for (const topic of HELP_TOPICS) {
      if (topic.clipUrl === null) continue;
      expect(topic.posterUrl, `${topic.id} has no poster`).toMatch(/^https:\/\//);
      expect(topic.posterUrl).toContain("posters/");
    }
  });
});
