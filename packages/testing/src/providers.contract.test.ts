import { describe, expect, it } from "vitest";

import { FakeSourceProvider } from "./index.js";

describe("fake source-provider contract", () => {
  it("returns immutable fixture copies without external access", async () => {
    const provider = new FakeSourceProvider({
      reference: {
        provider: "github",
        canonicalUrl: "https://github.com/ai-ark/example",
        owner: "ai-ark",
        repository: "example",
      },
      snapshot: {
        provider: "github",
        providerRepositoryId: "1",
        immutableRevision: "a".repeat(40),
        canonicalUrl: "https://github.com/ai-ark/example",
        defaultBranch: "main",
      },
      entries: [
        {
          descriptor: { path: "SKILL.md", byteLength: 5, kind: "file", objectId: "blob-1" },
          bytes: new TextEncoder().encode("skill"),
        },
      ],
      metadata: {
        name: "example",
        owner: "ai-ark",
        description: null,
        archived: false,
        visibility: "public",
      },
      releaseSignals: { tags: [], latestRelease: null },
      licenseSignals: { spdxId: null, source: "missing" },
      forkSignals: { isFork: false, parentCanonicalUrl: null },
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
