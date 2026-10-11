import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROJECT_COVER_FILENAME, projectCoverPath } from "@/lib/project-cover-path";

/**
 * A project cover that was never uploaded used to be signed anyway, so opening
 * any report containing that project fired a 400 at Supabase storage and logged
 * a console error. The cover has no database record - it is a bare object at a
 * fixed path - so the code has to check the folder first. That is what is
 * guarded here; the signed-in walk proves it in the browser.
 */

const source = readFileSync("src/lib/project-cover.ts", "utf8");

describe("project cover", () => {
  it("builds the path from the one shared filename", () => {
    expect(PROJECT_COVER_FILENAME).toBe("cover.jpg");
    expect(projectCoverPath("org-1", "proj-1")).toBe("org-1/projects/proj-1/cover.jpg");
  });

  it("asks whether the cover exists before signing a URL for it", () => {
    const checkIndex = source.indexOf("projectCoverExists(");
    const signIndex = source.indexOf("createSignedUrl(");
    expect(checkIndex).toBeGreaterThan(-1);
    expect(checkIndex).toBeLessThan(signIndex);
    expect(source).toContain("if (!(await projectCoverExists(organisationId, projectId))) return null;");
  });

  it("still tries the cover when the folder cannot be listed", () => {
    // Failing closed would hide covers that are really there, so a listing
    // failure falls back to the old behaviour.
    expect(source).toMatch(/if \(error\) return true;/);
  });

  it("matches the cover by exact filename, not by a prefix", () => {
    expect(source).toContain("entry.name === PROJECT_COVER_FILENAME");
  });
});
