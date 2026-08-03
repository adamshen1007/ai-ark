import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { DeterministicObjectStorage } from "./index.js";

describe("content-addressed object storage contract", () => {
  it("stores immutable copied bytes idempotently", async () => {
    const storage = new DeterministicObjectStorage();
    const bytes = new TextEncoder().encode("evidence");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const object = {
      key: `source-files/sha256/${sha256.slice(0, 2)}/${sha256}`,
      bytes,
      contentType: "text/plain",
      sha256,
    };
    expect(await storage.putIfAbsent(object)).toBe("stored");
    bytes.fill(0);
    expect(
      await storage.putIfAbsent({ ...object, bytes: new TextEncoder().encode("evidence") }),
    ).toBe("exists");
    expect(new TextDecoder().decode((await storage.get(object.key))?.bytes)).toBe("evidence");
  });

  it("rejects hash and object-key mismatches", async () => {
    const storage = new DeterministicObjectStorage();
    await expect(
      storage.putIfAbsent({
        key: `source-files/sha256/00/${"0".repeat(64)}`,
        bytes: new TextEncoder().encode("different"),
        contentType: "text/plain",
        sha256: "0".repeat(64),
      }),
    ).rejects.toThrow("OBJECT_HASH_MISMATCH");
  });
});
