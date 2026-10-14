import { describe, expect, it } from "vitest";
import { HELP_TOPICS } from "@/lib/help-content";

/**
 * The Help sheet streams a topic's clip inline, in a 64px tile, on autoplay. That
 * is fine for a four-second silent loop and wrong for a narrated film: a topic
 * that carries `href` must therefore NOT also carry `clipUrl`, or the sheet starts
 * downloading megabytes onto a phone in the middle of a site walk.
 *
 * These tests hold that line, and hold the rest of the list to being a list of
 * real tasks with one-line captions.
 */
describe("help topics", () => {
  it("has a stable, unique id and a one-line caption for every topic", () => {
    const ids = HELP_TOPICS.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of HELP_TOPICS) {
      expect(topic.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(topic.title.length).toBeGreaterThan(3);
      expect(topic.caption.length).toBeGreaterThan(10);
      expect(topic.caption).not.toContain("\n");
    }
  });

  it("never both streams a clip and links out - the long piece is a link", () => {
    for (const topic of HELP_TOPICS) {
      if (topic.href) expect(topic.clipUrl).toBeNull();
      if (topic.clipUrl) expect(topic.clipUrl.startsWith("https://")).toBe(true);
      if (topic.href) expect(topic.href.startsWith("https://")).toBe(true);
    }
  });

  it("carries the walkthrough as the one link, and it is the last thing shown", () => {
    const linked = HELP_TOPICS.filter((topic) => topic.href);
    expect(linked).toHaveLength(1);
    const last = HELP_TOPICS[HELP_TOPICS.length - 1];
    expect(last?.id).toBe(linked[0]?.id);
    expect(linked[0]?.href).toContain("/instructbrain-plan/");
  });

  it("covers the work the product actually asks people to do", () => {
    const ids = HELP_TOPICS.map((topic) => topic.id);
    for (const required of ["directory", "start", "capture", "review", "allocate", "issue", "share", "distribute"]) {
      expect(ids).toContain(required);
    }
  });
});
