import { describe, expect, it } from "vitest";
import {
  isAppOwnedFile,
  isUnreadableFileError,
  markAppOwnedFile,
  snapshotFiles,
} from "@/lib/photos/file-snapshot";

function unreadable(name: string): File {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    value: () => {
      const error = new Error(
        "The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.",
      );
      error.name = "NotReadableError";
      return Promise.reject(error);
    },
  });
  return file;
}

describe("file snapshots", () => {
  it("copies the bytes verbatim and keeps selection order", async () => {
    const files = [
      new File([new Uint8Array([1, 2, 3, 4])], "one.jpg", { type: "image/jpeg" }),
      new File([new Uint8Array([9, 9])], "two.jpg", { type: "image/jpeg" }),
    ];
    const held = await snapshotFiles(files);
    expect(held.map((file) => file.name)).toEqual(["one.jpg", "two.jpg"]);
    expect(held[0]!.size).toBe(4);
    expect(held[0]!.type).toBe("image/jpeg");
    expect(new Uint8Array(await held[0]!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("keeps the original reference when the bytes cannot be read", async () => {
    const original = unreadable("gone.jpg");
    const held = await snapshotFiles([original]);
    expect(held[0]).toBe(original);
  });

  it("does not copy a file whose bytes were created inside the app", async () => {
    const original = markAppOwnedFile(
      new File([new Uint8Array([4, 5, 6])], "camera.jpg", { type: "image/jpeg" }),
    );
    const held = await snapshotFiles([original]);
    expect(isAppOwnedFile(original)).toBe(true);
    expect(held[0]).toBe(original);
  });

  it("recognises a revoked file reference", () => {
    const error = new Error("The requested file could not be read");
    expect(isUnreadableFileError(error)).toBe(true);
    expect(isUnreadableFileError(new Error("Connection lost during upload."))).toBe(false);
  });
});
