import { describe, expect, it } from "vitest";

import { FakeSourceProvider } from "./index.js";

describe("fake source-provider contract", () => {
  it("returns immutable fixture copies without external access", async () => {
    const provider = new FakeSourceProvider({
      reference: { provider: "github", canonicalUrl: "https://github.com/ai-ark/example" },
      snapshot: {
        provider: "github",
        providerRepositoryId: "1",
        immutableRevision: "a".repeat(40),
      },
      entries: [
        {
          descriptor: { path: "SKILL.md", byteLength: 5 },
          bytes: new TextEncoder().encode("skill"),
        },
      ],
      signals: { archived: false, fork: false },
    });
    const reference = await provider.validateReference("https://github.com/ai-ark/example");
    const snapshot = await provider.resolveSnapshot(reference);
    const [entry] = await provider.listEntries(snapshot);
    if (!entry) throw new Error("fixture entry missing");
    const first = await provider.fetchEntry(snapshot, entry);
    first.bytes.fill(0);
    const second = await provider.fetchEntry(snapshot, entry);
    expect(new TextDecoder().decode(second.bytes)).toBe("skill");
  });
});
