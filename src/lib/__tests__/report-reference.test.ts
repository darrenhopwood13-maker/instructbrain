import { describe, expect, it } from "vitest";
import {
  REFERENCE_ALLOCATED_NOTE,
  REFERENCE_LEGACY_NOTE,
  REFERENCE_MISSING_NOTE,
  REFERENCE_PATTERN,
  isAllocatedReference,
} from "@/lib/report/reference";

/**
 * The values below are the references that ACTUALLY EXIST in the instructBrain
 * database, read on 6 Oct 2026 - not invented examples. They are the reason
 * this module exists: the app must never describe a hand-typed "001" as if the
 * system allocated it.
 */
const LIVE_ALLOCATED: string[] = [
  "SOC-2026-10-001",
  "SW-2026-10-002",
  "SNG-2026-10-001",
  "PINV-2026-10-007",
  "WCL-2026-10-001",
  "TEST-2026-10-001",
  "RPT-2026-10-001",
];

const LIVE_LEGACY: string[] = [
  "001",
  "001 ", // trailing space, as found in the live table
  "DEMO-INV-001",
  "DEMO-PC-001",
  "FC-LI-001",
  "IB-0001",
];

describe("isAllocatedReference", () => {
  it("recognises every shape the builder produces", () => {
    for (const value of LIVE_ALLOCATED) {
      expect(isAllocatedReference(value), value).toBe(true);
    }
  });

  it("rejects every hand-typed reference that is really in the database", () => {
    for (const value of LIVE_LEGACY) {
      expect(isAllocatedReference(value), value).toBe(false);
    }
  });

  it("treats nothing, and a blank, as not allocated", () => {
    expect(isAllocatedReference(null)).toBe(false);
    expect(isAllocatedReference(undefined)).toBe(false);
    expect(isAllocatedReference("")).toBe(false);
    expect(isAllocatedReference("   ")).toBe(false);
  });

  /**
   * The old defect was a reference with a trailing space, so whitespace must
   * not be what decides whether a value looks allocated.
   */
  it("is not fooled by surrounding whitespace either way", () => {
    expect(isAllocatedReference("  SW-2026-10-001  ")).toBe(true);
    expect(isAllocatedReference(" 001 ")).toBe(false);
  });

  it("requires a real period and at least a three-digit number", () => {
    expect(isAllocatedReference("SW-2026-10-01")).toBe(false);
    expect(isAllocatedReference("SW-202610-001")).toBe(false);
    expect(isAllocatedReference("sw-2026-10-001")).toBe(false);
    expect(isAllocatedReference("SW/2026/10/001")).toBe(false);
    expect(isAllocatedReference("SW-2026-10-1000")).toBe(true); // past 999 it widens
  });

  /**
   * The pattern here and the predicate on the database's partial unique index
   * have to agree. This pins the literal so a change to one is a visible diff
   * rather than a silent divergence.
   */
  it("keeps the same pattern the database index uses", () => {
    expect(REFERENCE_PATTERN.source).toBe("^[A-Z0-9]{2,6}-[0-9]{4}-[0-9]{2}-[0-9]{3,}$");
  });

  it("says something different about an allocated, a legacy and a missing reference", () => {
    const notes = new Set([REFERENCE_ALLOCATED_NOTE, REFERENCE_LEGACY_NOTE, REFERENCE_MISSING_NOTE]);
    expect(notes.size).toBe(3);
  });
});
