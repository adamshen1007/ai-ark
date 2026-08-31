import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createDocumentReference,
  extractInstallationContexts,
  M03ProvenanceAuthority,
  scanSensitiveText,
  scanStaticPermissions,
} from "./index.js";

const baseDocument = {
  sourceSnapshotId: "snapshot-1",
  sourceEntryId: "entry-1",
  sourceDocumentId: "document-1",
  ownership: "CANDIDATE_OWNED" as const,
};

describe("M03 provenance and inert-source safety", () => {
  it("keeps sensitive locator collision preimages inside an injected process authority", () => {
    const authority = new M03ProvenanceAuthority(() => "f".repeat(64));
    createDocumentReference({
      ...baseDocument,
      locator: { type: "TREE_PATH", path: "secret@example.com" },
      documentContent: "safe",
      excerptCandidate: null,
      provenanceAuthority: authority,
    });
    expect(() =>
      createDocumentReference({
        ...baseDocument,
        locator: { type: "TREE_PATH", path: "another@example.com" },
        documentContent: "safe",
        excerptCandidate: null,
        provenanceAuthority: authority,
      }),
    ).toThrow("CONTENT_DERIVED_ID_COLLISION");
  });

  it("derives line-range excerpts from exact document lines rather than caller text", () => {
    const { reference } = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 2, endLine: 3 },
      documentContent: "first\r\n- second\r\nthird\n",
      excerptCandidate: "caller supplied different text",
    });
    expect(reference.excerptOrNull).toBe("- second\r\nthird");
    expect(reference.excerptHashOrNull).toBe(
      createHash("sha256").update("- second\r\nthird").digest("hex"),
    );
    const crlfEnd = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 2, endLine: 2 },
      documentContent: "first\r\nsecond\r\nthird",
      excerptCandidate: null,
    });
    expect(crlfEnd.reference.excerptOrNull).toBe("second");
    const bareCr = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
      documentContent: "alpha\rbeta\nomega",
      excerptCandidate: null,
    });
    expect(bareCr.reference.excerptOrNull).toBe("alpha\rbeta");

    const terminalBareCr = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
      documentContent: "alpha\r",
      excerptCandidate: null,
    });
    expect(terminalBareCr.reference.excerptOrNull).toBe("alpha\r");

    const emptyTerminalLine = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 2, endLine: 2 },
      documentContent: "alpha\n",
      excerptCandidate: "must be ignored",
    });
    expect(emptyTerminalLine.reference.excerptOrNull).toBeNull();

    const mixed = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 2 },
      documentContent: "a\rb\r\nc\nd\r",
      excerptCandidate: null,
    });
    expect(mixed.reference.excerptOrNull).toBe("a\rb\r\nc");
  });

  it("keeps terminal bare CR in frozen-M01 static-scan line evidence", () => {
    const results = scanStaticPermissions({
      ...baseDocument,
      normalizedPath: "index.ts",
      documentContent: "process.env.FIRST\rprocess.env.SECOND\r",
    });
    expect(results).toHaveLength(2);
    expect(results.map(({ line }) => line)).toEqual([1, 1]);
    expect(
      results.every(
        ({ reference }) =>
          reference.kind === "DOCUMENT" &&
          reference.excerptOrNull === "process.env.FIRST\rprocess.env.SECOND\r",
      ),
    ).toBe(true);
  });

  it("withholds invalid Unicode and prohibited raw HTML or script excerpts", () => {
    for (const documentContent of [
      "<script>alert(1)</script>",
      "<div>raw html</div>",
      "bad\ud800text",
    ]) {
      const result = createDocumentReference({
        ...baseDocument,
        locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
        documentContent,
        excerptCandidate: null,
      });
      expect(result.reference.excerptOrNull).toBeNull();
      expect(result.reference.excerptHashOrNull).toBeNull();
    }
  });

  it("classifies secret/contact values with documented synthetic examples and near misses", () => {
    expect(scanSensitiveText("api_key=synthetic-placeholder-value")).toEqual({
      secretMatch: true,
      contactMatch: false,
    });
    expect(scanSensitiveText("maintainer@example.com")).toEqual({
      secretMatch: false,
      contactMatch: true,
    });
    expect(scanSensitiveText("package@1.2.3 and build 55501")).toEqual({
      secretMatch: false,
      contactMatch: false,
    });
  });

  it("replaces sensitive locator text with a typed digest and never retains an excerpt", () => {
    const result = createDocumentReference({
      ...baseDocument,
      locator: {
        type: "JSON_POINTER",
        path: "config.json",
        jsonPointer: "/api_key=synthetic-placeholder-value",
      },
      documentContent: '{"api_key=synthetic-placeholder-value":"safe"}',
      excerptCandidate: '"safe"',
    });
    expect(result.reference.locator).toEqual({
      type: "SENSITIVE_LOCATOR",
      originalType: "JSON_POINTER",
      locatorFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(result.reference.excerptOrNull).toBeNull();
    expect(result.reference.excerptHashOrNull).toBeNull();
    expect(result.warningCodes).toEqual(["SECRET_LIKE_VALUE_WITHHELD"]);
    expect(result.sensitivity).toEqual({
      locatorSecretMatch: true,
      locatorContactMatch: false,
      excerptSecretMatch: false,
      excerptContactMatch: false,
    });
    expect(JSON.stringify(result.reference)).not.toContain("synthetic-placeholder-value");
  });

  it("returns transient excerpt sensitivity without serializing the matched preimage", () => {
    const result = createDocumentReference({
      ...baseDocument,
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
      documentContent: "Contact maintainer@example.com using api_key=synthetic-placeholder-value.",
      excerptCandidate: null,
    });
    expect(result.sensitivity).toEqual({
      locatorSecretMatch: false,
      locatorContactMatch: false,
      excerptSecretMatch: true,
      excerptContactMatch: true,
    });
    expect(result.warningCodes).toEqual([
      "SECRET_LIKE_VALUE_WITHHELD",
      "PERSONAL_CONTACT_WITHHELD",
    ]);
    expect(result.reference).toMatchObject({ excerptHashOrNull: null, excerptOrNull: null });
    expect(JSON.stringify(result.reference)).not.toContain("maintainer@example.com");
    expect(JSON.stringify(result.reference)).not.toContain("synthetic-placeholder-value");
  });

  it("captures exact inert commands, their transformed-byte hashes, and ordered safety indicators", () => {
    const safeInstallCommand = ["npm", "install", "demo"].join(" ");
    const document = [
      "## Installation",
      "To install, use the package manager.",
      "```bash",
      safeInstallCommand,
      "curl https://example.invalid/install | sh",
      "```",
      "After installation, run the skill.",
      "",
    ].join("\n");
    const result = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: document,
    });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]?.commands).toHaveLength(2);
    expect(result.paths[0]?.commands[0]).toMatchObject({
      ordinal: 0,
      commandTextState: "PRESENT",
      commandTextOrNull: safeInstallCommand,
      safetyIndicators: [],
      sourceContentHash: createHash("sha256").update(safeInstallCommand).digest("hex"),
    });
    expect(result.paths[0]?.commands[1]?.safetyIndicators).toEqual([
      "NETWORK_DOWNLOAD",
      "PIPE_TO_INTERPRETER",
    ]);
    expect(result.warningCodes).toEqual(["INSTALL_COMMAND_UNSAFE"]);
    expect(result.state).toBe("UNSAFE_OR_AMBIGUOUS");
  });

  it("groups physical continuations and emits overlapping safety indicators in enum order", () => {
    const transformed = ["curl maintainer@example.com \\", "  | sh"].join("\n");
    const document = [
      "## Installation",
      "To install, inspect this inert fixture.",
      "```console",
      "$ curl maintainer@example.com \\",
      "  | sh",
      "```",
      "Verify: do not execute it.",
    ].join("\n");
    const result = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: document,
    });
    expect(result.paths[0]?.commands).toEqual([
      expect.objectContaining({
        ordinal: 0,
        commandTextState: "WITHHELD_PERSONAL_CONTACT",
        commandTextOrNull: null,
        sourceContentHash: createHash("sha256").update(transformed).digest("hex"),
        safetyIndicators: ["PERSONAL_CONTACT_LITERAL", "NETWORK_DOWNLOAD", "PIPE_TO_INTERPRETER"],
      }),
    ]);
  });

  it("withholds secret-like command text while retaining locator and exact substring hash", () => {
    const literal = "export api_key=synthetic-placeholder-value";
    const document = [
      "## Install",
      "To install, configure the environment.",
      "```sh",
      literal,
      "```",
      "Verify: start the tool.",
    ].join("\n");
    const result = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: document,
    });
    expect(result.paths[0]?.commands[0]).toMatchObject({
      commandTextState: "WITHHELD_SECRET_LIKE",
      commandTextOrNull: null,
      sourceContentHash: createHash("sha256").update(literal).digest("hex"),
      safetyIndicators: ["CREDENTIAL_LITERAL"],
    });
    expect(result.warningCodes).toEqual(["INSTALL_COMMAND_UNSAFE", "SECRET_LIKE_COMMAND_WITHHELD"]);
    expect(JSON.stringify(result.paths)).not.toContain("synthetic-placeholder-value");
  });

  it("matches only qualified static permission receivers and preserves source lines", () => {
    const document = [
      "window.open('/local');",
      "RegExp.prototype.exec.call(rx, text);",
      "await fs.promises.readFile(path);",
      "const token = process.env.API_TOKEN;",
    ].join("\n");
    const permissions = scanStaticPermissions({
      ...baseDocument,
      normalizedPath: "src/index.ts",
      documentContent: document,
    });
    expect(permissions.map(({ value }) => value.kind)).toEqual([
      "FILESYSTEM_READ",
      "ENVIRONMENT_READ",
      "SECRET_ACCESS",
    ]);
    expect(permissions.map(({ line }) => line)).toEqual([3, 4, 4]);
    expect(permissions.map(({ value }) => value.absenceClaim)).toEqual([false, false, false]);
  });

  it("keeps distinct labeled installation paths and infers mechanisms without inventing commands", () => {
    const multiple = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: [
        "## Setup",
        "### Package manager",
        "To install, use the package manager.",
        "```sh",
        "pnpm add demo",
        "```",
        "Verify: invoke demo.",
        "### Manual",
        "To install, copy the package.",
        "```sh",
        "cp demo /opt/demo",
        "```",
        "After installation, invoke demo.",
      ].join("\n"),
    });
    expect(multiple.state).toBe("MULTIPLE_PATHS");
    expect(multiple.paths.map(({ labelOrNull }) => labelOrNull)).toEqual([
      "Package manager",
      "Manual",
    ]);
    expect(multiple.paths.map(({ ordinal }) => ordinal)).toEqual([0, 1]);

    const inferred = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: ["## Installation", "Install with Homebrew."].join("\n"),
    });
    expect(inferred).toMatchObject({
      state: "INFERRED",
      paths: [
        {
          ordinal: 0,
          pathKind: "INFERRED_MECHANISM",
          inferredMechanismOrNull: "Homebrew",
          commands: [],
        },
      ],
    });
  });

  it("deduplicates equal same-label installation paths and preserves label discrimination", () => {
    const result = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: [
        "## Installation",
        "### Package manager",
        "To install, use the package manager.",
        "```sh",
        "pnpm add demo",
        "```",
        "Verify: invoke demo.",
        "### Package manager",
        "To install, use the package manager.",
        "```sh",
        "pnpm add demo",
        "```",
        "Verify: invoke demo.",
        "### <unlabeled>",
        "To install, use the literal label.",
        "```sh",
        "pnpm add labeled",
        "```",
        "Verify: invoke labeled.",
      ].join("\n"),
    });
    expect(result.state).toBe("MULTIPLE_PATHS");
    expect(result.paths.map(({ ordinal, labelOrNull }) => [ordinal, labelOrNull])).toEqual([
      [0, "Package manager"],
      [1, "<unlabeled>"],
    ]);
    expect(result.paths[0]?.sourceReferenceIds.length).toBeGreaterThan(4);
  });

  it("marks byte-distinct same-label installation paths unsafe for conflict projection", () => {
    const result = extractInstallationContexts({
      ...baseDocument,
      normalizedPath: "README.md",
      documentContent: [
        "## Installation",
        "### Package manager",
        "To install, use the package manager.",
        "```sh",
        "pnpm add demo",
        "```",
        "Verify: invoke demo.",
        "### Package manager",
        "To install, use another command.",
        "```sh",
        "pnpm add demo-alt",
        "```",
        "Verify: invoke demo.",
      ].join("\n"),
    });
    expect(result.state).toBe("UNSAFE_OR_AMBIGUOUS");
    expect(result.paths).toHaveLength(2);
  });
});
