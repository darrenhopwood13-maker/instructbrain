import { describe, expect, it } from "vitest";
import { recordCopyNotice } from "@/lib/i18n/record-copy";

describe("report language", () => {
  it("adds no notice to an English report", () => {
    expect(recordCopyNotice("en")).toBeNull();
    expect(recordCopyNotice("")).toBeNull();
  });

  it("states the language and that English is the record copy", () => {
    const notice = recordCopyNotice("Polish");
    expect(notice).toContain("Polski");
    expect(notice).toContain("version of record");
  });
});
