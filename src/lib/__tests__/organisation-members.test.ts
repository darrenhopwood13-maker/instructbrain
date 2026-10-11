import { describe, expect, it } from "vitest";
import {
  inviteBlockedReason,
  isInvitableEmail,
  normaliseEmail,
  roleLabel,
} from "@/lib/organisation/members.functions";

/**
 * The wording and the guard rails of adding someone to an organisation.
 *
 * The invite itself touches Supabase and a mail server, so it is exercised in
 * the signed-in walk. What is pure - what counts as an email, what gets
 * refused, and what a role is called - is tested here.
 */

describe("adding someone to an organisation", () => {
  it("normalises an address, because email has no meaningful case", () => {
    expect(normaliseEmail("  Dal.Hopwood@Example.COM  ")).toBe("dal.hopwood@example.com");
    expect(normaliseEmail("a@b.co.uk")).toBe("a@b.co.uk");
  });

  it("accepts an address that could actually receive an invite", () => {
    expect(isInvitableEmail("name@company.co.uk")).toBe(true);
    expect(isInvitableEmail("first.last+tag@sub.domain.co")).toBe(true);
  });

  it("refuses what is obviously not an address, before any account is made", () => {
    expect(isInvitableEmail("dal")).toBe(false);
    expect(isInvitableEmail("dal@")).toBe(false);
    expect(isInvitableEmail("dal@company")).toBe(false);
    expect(isInvitableEmail("@company.com")).toBe(false);
    expect(isInvitableEmail("two words@company.com")).toBe(false);
    expect(isInvitableEmail("")).toBe(false);
  });

  it("refuses a second invitation to somebody already in the organisation", () => {
    const existing = ["dal@example.com", "sally@example.com"];
    expect(inviteBlockedReason("sally@example.com", existing)).toBe(
      "That person is already in this organisation.",
    );
    // Case must not defeat the check.
    expect(inviteBlockedReason(normaliseEmail("Sally@Example.com"), existing)).toBe(
      "That person is already in this organisation.",
    );
  });

  it("says which problem it is, so the person can fix it", () => {
    expect(inviteBlockedReason("dal", [])).toBe("That does not look like an email address.");
    expect(inviteBlockedReason("new@example.com", [])).toBeNull();
  });

  it("names the roles the way the app does", () => {
    expect(roleLabel("owner")).toBe("Owner");
    expect(roleLabel("surveyor")).toBe("Surveyor");
    expect(roleLabel("viewer")).toBe("Viewer");
    expect(roleLabel("something-new")).toBe("something-new");
  });
});
