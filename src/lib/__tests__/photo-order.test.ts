import { describe, expect, it } from "vitest";
import { assignUploadSequences, runUploadQueue } from "@/lib/photos/upload-queue";
import { sortByPhotoOrder } from "@/lib/report/finding-order";
import { isMinimalBriefTemplate } from "@/lib/report/brief";

describe("upload order", () => {
  it("numbers photographs in selection order even when uploads finish out of order", async () => {
    const files = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"];
    const base = 7;
    const assigned: Array<{ name: string; sequence: number }> = [];

    // Mirrors the panel: sequence decided at enqueue time, not inside the task.
    await runUploadQueue(
      files.map((name, index) => ({
        id: name,
        run: async () => {
          // Deliberately finish in reverse order.
          await new Promise((resolve) => setTimeout(resolve, (files.length - index) * 5));
          assigned.push({ name, sequence: base + index });
          return name;
        },
      })),
      { concurrency: 4, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
    );

    for (const [index, name] of files.entries()) {
      expect(assigned.find((entry) => entry.name === name)?.sequence).toBe(base + index);
    }
  });

  it("keeps a failed photograph's reserved number when it is retried", () => {
    const selected = [
      { name: "slow.jpg", sequence: null as number | null },
      { name: "fast.jpg", sequence: null as number | null },
    ];

    assignUploadSequences(selected, 12);
    expect(selected.map((item) => item.sequence)).toEqual([12, 13]);

    assignUploadSequences([selected[0]!], 14);
    expect(selected.map((item) => item.sequence)).toEqual([12, 13]);
  });

  it("numbers only newly selected photographs after numbers already reserved in the session", () => {
    const nextBatch = [
      { name: "kitchen-1.jpg", sequence: null as number | null },
      { name: "kitchen-2.jpg", sequence: null as number | null },
    ];

    assignUploadSequences(nextBatch, 8);
    expect(nextBatch.map((item) => item.sequence)).toEqual([8, 9]);
  });
});

describe("finding display order", () => {
  it("follows the photograph order, not the order the AI finished in", () => {
    const findings = [
      { id: "third", photoSequence: 3, sequence: 1 },
      { id: "first", photoSequence: 1, sequence: 2 },
      { id: "second", photoSequence: 2, sequence: 3 },
    ];
    expect(sortByPhotoOrder(findings, (f) => f).map((f) => f.id)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("keeps several findings on one photograph in their created order", () => {
    const findings = [
      { id: "b", photoSequence: 1, sequence: 5 },
      { id: "a", photoSequence: 1, sequence: 2 },
      { id: "c", photoSequence: null, sequence: 1 },
    ];
    expect(sortByPhotoOrder(findings, (f) => f).map((f) => f.id)).toEqual(["a", "b", "c"]);
  });
});

describe("basic photo report", () => {
  it("is recognised as a minimal template, so no remedial box is shown", () => {
    expect(isMinimalBriefTemplate("photo_condition_record")).toBe(true);
    expect(isMinimalBriefTemplate("snagging")).toBe(false);
  });
});
