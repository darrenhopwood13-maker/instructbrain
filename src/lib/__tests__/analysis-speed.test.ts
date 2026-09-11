import { describe, expect, it } from "vitest";
import { runUploadQueue } from "@/lib/photos/upload-queue";
import { RUN_CONCURRENCY } from "@/lib/ai/use-analysis-run";

describe("upload and analysis throughput", () => {
  it("runs up to twelve uploads at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 30 }, (_, index) => ({
      id: `photo-${index}`,
      run: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return index;
      },
    }));

    const results = await runUploadQueue(tasks, { concurrency: 12, sleep: async () => {} });
    expect(results.every((result) => result.state === "done")).toBe(true);
    expect(peak).toBe(12);
  });

  it("analyses twelve photographs at once", () => {
    expect(RUN_CONCURRENCY).toBe(12);
  });
});
