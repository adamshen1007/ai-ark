import { describe, expect, it } from "vitest";

import type { GitHubTransport } from "./index.js";
import { GitHubSourceProvider } from "./index.js";

const repositoryResponse = {
  id: 42,
  name: "repo",
  owner: { login: "owner" },
  description: "fixture",
  default_branch: "main",
  archived: false,
  private: false,
  fork: true,
  parent: { html_url: "https://github.com/upstream/repo" },
} as const;

function fakeTransport(): GitHubTransport {
  return {
    getRepository: () => Promise.resolve(repositoryResponse),
    getCommit: () => Promise.resolve({ sha: "a".repeat(40) }),
    getTree: () =>
      Promise.resolve({
        truncated: false,
        tree: [
          { path: "SKILL.md", type: "blob", mode: "100644", sha: "blob1", size: 4 },
          { path: "link", type: "blob", mode: "120000", sha: "blob2", size: 3 },
          { path: "script.ts", type: "blob", mode: "100755", sha: "blob3", size: 4 },
          { path: "vendor", type: "commit", mode: "160000", sha: "commit1" },
        ],
      }),
    getBlob: () => Promise.resolve(new TextEncoder().encode("safe")),
    getTags: () => Promise.resolve(["v2", "v1"]),
    getLatestRelease: () => Promise.resolve("v2"),
    getLicense: () => Promise.resolve({ spdxId: "MIT" }),
  };
}

describe("GitHub SourceProvider contract", () => {
  it("uses only read-oriented transport operations and returns an immutable revision", async () => {
    const provider = new GitHubSourceProvider(fakeTransport());
    const reference = await provider.validateReference("https://github.com/owner/repo");
    const snapshot = await provider.resolveSnapshot(reference);
    const entries = await provider.listEntries(snapshot);
    expect(snapshot.immutableRevision).toBe("a".repeat(40));
    expect(entries.map(({ kind, path }) => [path, kind])).toEqual([
      ["SKILL.md", "file"],
      ["link", "symlink"],
      ["script.ts", "file"],
      ["vendor", "submodule"],
    ]);
    expect(entries.find(({ path }) => path === "script.ts")?.executable).toBe(true);
    expect(await provider.getRepositoryMetadata(snapshot)).toMatchObject({ visibility: "public" });
    expect(await provider.getReleaseSignals(snapshot)).toEqual({
      tags: ["v1", "v2"],
      latestRelease: "v2",
    });
    expect(await provider.getLicenseSignals(snapshot)).toEqual({ spdxId: "MIT", source: "api" });
    expect(await provider.getForkSignals(snapshot)).toEqual({
      isFork: true,
      parentCanonicalUrl: "https://github.com/upstream/repo",
    });
    const file = entries.find(({ kind }) => kind === "file");
    if (file === undefined) throw new Error("fixture file entry missing");
    expect(new TextDecoder().decode((await provider.fetchEntry(snapshot, file)).bytes)).toBe(
      "safe",
    );
  });

  it("fails closed on private repositories and truncated trees", async () => {
    const privateTransport = fakeTransport();
    privateTransport.getRepository = () =>
      Promise.resolve({ ...repositoryResponse, private: true });
    const privateProvider = new GitHubSourceProvider(privateTransport);
    const reference = await privateProvider.validateReference("https://github.com/owner/repo");
    await expect(privateProvider.resolveSnapshot(reference)).rejects.toThrow("SOURCE_PRIVATE");

    const truncated = fakeTransport();
    truncated.getTree = () => Promise.resolve({ truncated: true, tree: [] });
    const provider = new GitHubSourceProvider(truncated);
    const snapshot = await provider.resolveSnapshot(reference);
    await expect(provider.listEntries(snapshot)).rejects.toThrow("SOURCE_TREE_TRUNCATED");
  });

  it.each(["SOURCE_NOT_FOUND", "PROVIDER_RATE_LIMIT", "PROVIDER_TIMEOUT"])(
    "preserves stable provider failure code %s",
    async (code) => {
      const transport = fakeTransport();
      transport.getRepository = () => Promise.reject(new Error(code));
      const provider = new GitHubSourceProvider(transport);
      const reference = await provider.validateReference("https://github.com/owner/repo");
      await expect(provider.resolveSnapshot(reference)).rejects.toThrow(code);
    },
  );

  it("reports archived repository metadata without interpreting it", async () => {
    const transport = fakeTransport();
    transport.getRepository = () => Promise.resolve({ ...repositoryResponse, archived: true });
    const provider = new GitHubSourceProvider(transport);
    const reference = await provider.validateReference("https://github.com/owner/repo");
    const snapshot = await provider.resolveSnapshot(reference);
    expect((await provider.getRepositoryMetadata(snapshot)).archived).toBe(true);
  });

  it("rejects repository identity drift after immutable snapshot resolution", async () => {
    const transport = fakeTransport();
    let repositoryCalls = 0;
    transport.getRepository = () => {
      repositoryCalls += 1;
      return Promise.resolve(
        repositoryCalls <= 2
          ? repositoryResponse
          : {
              ...repositoryResponse,
              id: 99,
              owner: { login: "attacker" },
              name: "replacement",
            },
      );
    };
    const provider = new GitHubSourceProvider(transport);
    const reference = await provider.validateReference("https://github.com/owner/repo");
    const snapshot = await provider.resolveSnapshot(reference);
    await expect(provider.getRepositoryMetadata(snapshot)).rejects.toThrow("AMBIGUOUS_REDIRECT");
  });

  it("revalidates repository identity around name-addressed evidence operations", async () => {
    const transport = fakeTransport();
    let repositoryCalls = 0;
    transport.getRepository = () => {
      repositoryCalls += 1;
      return Promise.resolve(
        repositoryCalls < 4 ? repositoryResponse : { ...repositoryResponse, id: 99 },
      );
    };
    const provider = new GitHubSourceProvider(transport);
    const reference = await provider.validateReference("https://github.com/owner/repo");
    const snapshot = await provider.resolveSnapshot(reference);
    await expect(provider.listEntries(snapshot)).rejects.toThrow("AMBIGUOUS_REDIRECT");
  });

  it("rejects identity drift while binding the immutable commit", async () => {
    const transport = fakeTransport();
    let repositoryCalls = 0;
    transport.getRepository = () => {
      repositoryCalls += 1;
      return Promise.resolve(
        repositoryCalls === 1 ? repositoryResponse : { ...repositoryResponse, id: 99 },
      );
    };
    const provider = new GitHubSourceProvider(transport);
    const reference = await provider.validateReference("https://github.com/owner/repo");
    await expect(provider.resolveSnapshot(reference)).rejects.toThrow("AMBIGUOUS_REDIRECT");
  });
});
