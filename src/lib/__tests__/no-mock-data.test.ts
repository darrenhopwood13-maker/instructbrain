import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const appFiles = walk(SRC).filter(
  (path) => /\.(ts|tsx)$/.test(path) && !path.includes("__tests__") && !path.endsWith(".test.ts"),
);

describe("no fixture data in application code", () => {
  it("has no mock-data module", () => {
    expect(appFiles.some((path) => /mock-data\.tsx?$/.test(path))).toBe(false);
  });

  it("no application module imports fixture or mock data", () => {
    const offenders = appFiles.filter((path) =>
      /from\s+["'][^"']*(mock-data|fixtures?|seed-data|demo-data)["']/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
