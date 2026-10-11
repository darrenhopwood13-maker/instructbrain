import { describe, expect, it } from "vitest";

import { actorFromTrade, actorFromUser, displayNameFor } from "@/lib/audit/actor";

describe("naming the actor on an audit row", () => {
  it("uses the name the person set", () => {
    expect(
      displayNameFor({ id: "u1", email: "joe@example.com", user_metadata: { full_name: "Joe Abbott" } }),
    ).toBe("Joe Abbott");
  });

  it("trims and ignores a blank name rather than storing whitespace", () => {
    expect(displayNameFor({ id: "u1", user_metadata: { full_name: "   " }, email: "joe@x.com" })).toBe(
      "joe@x.com",
    );
  });

  it("falls back through name then email, and never returns an empty string", () => {
    expect(displayNameFor({ id: "u1", user_metadata: { name: "Joe A" } })).toBe("Joe A");
    expect(displayNameFor({ id: "u1", email: "joe@x.com" })).toBe("joe@x.com");
    // Nothing at all is an explicit null, never "" - a blank where a person
    // should be reads as a broken screen.
    expect(displayNameFor({ id: "u1" })).toBeNull();
    expect(displayNameFor(null)).toBeNull();
    expect(displayNameFor(undefined)).toBeNull();
  });

  it("carries the id and the name together for a signed-in user", () => {
    expect(actorFromUser({ id: "u1", user_metadata: { full_name: "Dal" } })).toEqual({
      id: "u1",
      name: "Dal",
    });
  });

  it("has no id for a user object with no id, so the row is not misattributed", () => {
    expect(actorFromUser({ user_metadata: { full_name: "Someone" } }).id).toBeNull();
  });

  it("names a trade-link actor by the trade, because there is no user behind it", () => {
    // The subcontractor path has actor_id null by design; saying "Electrical" is
    // honest where inventing a person would not be.
    expect(actorFromTrade({ label: "Electrical - Joe", trade: "Electrical" }).name).toBe(
      "Electrical - Joe",
    );
    expect(actorFromTrade({ trade: "Electrical" }).name).toBe("Electrical");
    expect(actorFromTrade({ label: "  ", trade: "Electrical" }).name).toBe("Electrical");
    expect(actorFromTrade({}).name).toBe("A trade link");
    expect(actorFromTrade(null).name).toBe("A trade link");
    expect(actorFromTrade({ trade: "Electrical" }).id).toBeNull();
  });
});
