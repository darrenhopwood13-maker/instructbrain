import { describe, expect, it } from "vitest";

import { describeSignOff, signaturePath } from "@/lib/compliance/signature";

describe("signaturePath", () => {
  it("keeps the organisation id first, because the storage policy reads that segment", () => {
    expect(signaturePath("org-1", "report-2", "run-3")).toBe(
      "org-1/report-2/signatures/run-3.png",
    );
  });

  it("keeps the signature out of the photo paths, so it never joins the photo grid", () => {
    const path = signaturePath("org-1", "report-2", "run-3");
    expect(path).not.toContain("/thumbnails/");
    expect(path).not.toContain("/analysis/");
    expect(path).not.toContain("/prints/");
  });

  it("refuses to invent a location when the check has no report", () => {
    expect(() => signaturePath("org-1", "", "run-3")).toThrow(/no report attached/i);
  });

  it("refuses without an organisation", () => {
    expect(() => signaturePath("", "report-2", "run-3")).toThrow(/organisation/i);
  });
});

describe("describeSignOff", () => {
  it("names the signer and the time", () => {
    const line = describeSignOff({
      signedAt: "2026-11-01T09:30:00.000Z",
      signerName: "D Hopwood",
      performedByName: "D Hopwood",
    });
    expect(line).toContain("Signed electronically by D Hopwood on");
    expect(line).toContain("Nov 2026");
  });

  it("uses the name typed at signing, not the header name", () => {
    const line = describeSignOff({
      signedAt: "2026-11-01T09:30:00.000Z",
      signerName: "S Hopwood",
      performedByName: "D Hopwood",
    });
    expect(line).toContain("S Hopwood");
    expect(line).not.toContain("D Hopwood");
  });

  it("says plainly when nobody was recorded, rather than passing a timestamp off as a signature", () => {
    const line = describeSignOff({
      signedAt: "2026-11-01T09:30:00.000Z",
      signerName: null,
      performedByName: null,
    });
    expect(line).toContain("no signer was recorded");
  });

  it("returns nothing for a check that has not been signed", () => {
    expect(
      describeSignOff({ signedAt: null, signerName: "D Hopwood", performedByName: null }),
    ).toBeNull();
  });
});
