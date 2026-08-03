import { describe, expect, it } from "vitest";

import {
  defaultAcquisitionPolicy,
  entryPriority,
  inspectContent,
  inspectPath,
  inventoryDescriptors,
  sourceObjectKey,
} from "./index.js";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("acquisition path and content safety", () => {
  it.each<[string, string]>([
    ["../secret", "PATH_TRAVERSAL"],
    ["docs/../../secret", "PATH_TRAVERSAL"],
    ["/etc/passwd", "PATH_ABSOLUTE"],
    ["C:/secret", "PATH_ABSOLUTE"],
    ["docs\\secret.md", "PATH_BACKSLASH"],
    ["docs/%2e%2e/secret", "PATH_TRAVERSAL"],
    ["docs//readme.md", "PATH_AMBIGUOUS_SEGMENT"],
    ["bad\0path", "PATH_NULL_BYTE"],
  ])("quarantines unsafe path %s", (path, reason) => {
    expect(inspectPath(path).reasonCodes).toContain(reason);
  });

  it("accepts and normalizes a bounded relative path", () => {
    expect(inspectPath("docs/guide.md")).toEqual({
      normalizedPath: "docs/guide.md",
      disposition: "ELIGIBLE",
      reasonCodes: [],
    });
  });

  it("enforces the UTF-8 path-byte limit", () => {
    expect(
      inspectPath("文档.md", { ...defaultAcquisitionPolicy, maxPathBytes: 5 }).reasonCodes,
    ).toContain("PATH_TOO_LONG");
  });

  it.each<[string, Uint8Array, string]>([
    ["payload.exe", encode("MZ"), "EXECUTABLE_CONTENT"],
    ["payload.zip", encode("PK"), "ARCHIVE_CONTENT"],
    ["image.png", encode("png"), "EXTENSION_NOT_ALLOWED"],
    ["binary.txt", new Uint8Array([0, 1]), "BINARY_CONTENT"],
    ["encrypted.txt", encode("-----BEGIN PGP MESSAGE-----\nabc"), "ENCRYPTED_CONTENT"],
    ["invalid.txt", new Uint8Array([0xc3, 0x28]), "INVALID_ENCODING"],
    ["renamed.txt", new Uint8Array([0x7f, 0x45, 0x4c, 0x46]), "EXECUTABLE_CONTENT"],
    ["renamed.txt", new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "ARCHIVE_CONTENT"],
  ])("fails closed for %s", (path, bytes, reason) => {
    expect(inspectContent(path, bytes).reasonCodes).toEqual([reason]);
  });

  it("enforces file and line limits", () => {
    const policy = { ...defaultAcquisitionPolicy, maxFileBytes: 3, maxLines: 2 };
    expect(inspectContent("a.txt", encode("1234"), policy).reasonCodes).toEqual(["FILE_TOO_LARGE"]);
    expect(
      inspectContent("a.txt", encode("1\n2\n3"), { ...policy, maxFileBytes: 10 }).reasonCodes,
    ).toEqual(["LINE_LIMIT_EXCEEDED"]);
  });

  it("fails closed when the configured encoding policy excludes UTF-8", () => {
    expect(
      inspectContent("a.txt", encode("safe"), {
        ...defaultAcquisitionPolicy,
        allowedEncodings: [],
      }).reasonCodes,
    ).toEqual(["UNSUPPORTED_ENCODING_POLICY"]);
  });

  it("hashes eligible bytes and generates the required object key", () => {
    const result = inspectContent("SKILL.md", encode("safe"));
    expect(result.disposition).toBe("ACQUIRED");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/u);
    const sha256 = result.sha256;
    if (sha256 === null) throw new Error("expected acquired content hash");
    expect(sourceObjectKey(sha256)).toBe(`source-files/sha256/${sha256.slice(0, 2)}/${sha256}`);
  });

  it("detects duplicates, case collisions, links, submodules, and aggregate limits", () => {
    const result = inventoryDescriptors(
      "snapshot_1",
      [
        { path: "a.txt", byteLength: 4, kind: "file", objectId: "a" },
        { path: "b.txt", byteLength: 4, kind: "file", objectId: "b" },
        { path: "c.txt", byteLength: 4, kind: "file", objectId: "c" },
        { path: "README.md", byteLength: 4, kind: "file", objectId: "1" },
        { path: "README.md", byteLength: 4, kind: "file", objectId: "2" },
        { path: "readme.md", byteLength: 4, kind: "file", objectId: "3" },
        { path: "linked", byteLength: 4, kind: "symlink", objectId: "4" },
        { path: "vendor", byteLength: 0, kind: "submodule", objectId: "5" },
        {
          path: "executable.md",
          byteLength: 1,
          kind: "file",
          objectId: "6",
          executable: true,
        },
        { path: "invalid.md", byteLength: -1, kind: "file", objectId: "7" },
      ],
      {
        ...defaultAcquisitionPolicy,
        maxEntries: 7,
        maxSelectedFiles: 2,
        maxTotalBytes: 10,
      },
    );
    expect(result.warningCodes).toEqual(
      expect.arrayContaining([
        "CASE_COLLISION",
        "DUPLICATE_PATH",
        "ENTRY_LIMIT_EXCEEDED",
        "EXECUTABLE_ENTRY",
        "INVALID_ENTRY_SIZE",
        "SELECTED_FILE_LIMIT_EXCEEDED",
        "SUBMODULE_ENTRY",
        "SYMLINK_ENTRY",
        "TOTAL_BYTE_LIMIT_EXCEEDED",
      ]),
    );
  });

  it("skips provider-declared oversized files before content fetch eligibility", () => {
    const result = inventoryDescriptors(
      "snapshot_oversized",
      [{ path: "large.md", byteLength: 4, kind: "file", objectId: "large" }],
      { ...defaultAcquisitionPolicy, maxFileBytes: 3 },
    );
    expect(result.entries[0]).toMatchObject({
      disposition: "SKIPPED",
      reasonCodes: ["FILE_TOO_LARGE"],
    });
  });

  it("prioritizes relevant files without classifying a Skill", () => {
    expect(entryPriority("SKILL.md")).toBeGreaterThan(entryPriority("src/index.ts"));
    expect(entryPriority("README.md")).toBeGreaterThan(entryPriority("src/index.ts"));
    const inventory = inventoryDescriptors(
      "snapshot_priority",
      [
        { path: "a.ts", byteLength: 1, kind: "file", objectId: "a" },
        { path: "z/SKILL.md", byteLength: 1, kind: "file", objectId: "z" },
      ],
      { ...defaultAcquisitionPolicy, maxSelectedFiles: 1 },
    );
    expect(inventory.entries[0]).toMatchObject({
      originalPath: "z/SKILL.md",
      disposition: "SELECTED",
    });
  });
});
