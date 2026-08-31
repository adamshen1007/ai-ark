import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  extractInstallationContexts,
  markdownBodyForDocument,
  parseMarkdownProfile,
} from "./commands.js";

const base = {
  sourceSnapshotId: "snapshot-1",
  sourceEntryId: "entry-1",
  sourceDocumentId: "document-1",
  ownership: "CANDIDATE_OWNED" as const,
  normalizedPath: "README.md",
};

describe("M03 parser-backed Markdown command extraction", () => {
  it("rejects bare-CR front-matter delimiters while accepting exact LF and CRLF boundaries", () => {
    const bareCrOpener = "---\rname: Demo\r---\n# Body";
    expect(markdownBodyForDocument("SKILL.md", bareCrOpener)).toMatchObject({
      content: bareCrOpener,
      absoluteLineOffset: 0,
      absoluteByteOffset: 0,
    });

    const bareCrCloser = "---\nname: Demo\n---\r# Body";
    expect(markdownBodyForDocument("SKILL.md", bareCrCloser)).toMatchObject({
      content: "",
      lines: [],
    });

    const exactCrLf = "---\r\nname: Demo\r\n---\r\n# Body";
    expect(markdownBodyForDocument("SKILL.md", exactCrLf)).toEqual({
      content: "# Body",
      lines: ["# Body"],
      absoluteLineOffset: 3,
      absoluteByteOffset: Buffer.byteLength("---\r\nname: Demo\r\n---\r\n"),
    });
  });

  it("ignores quoted and fenced fake headings while selecting the real ATX context", () => {
    const result = extractInstallationContexts({
      ...base,
      documentContent: [
        "> ## Installation",
        "> ```sh",
        "> echo quoted",
        "> ```",
        "",
        "```text",
        "## Installation",
        "echo fenced-heading",
        "```",
        "",
        "## Installation",
        "To install, continue.",
        "```sh",
        "echo real",
        "```",
        "After installation, verify.",
      ].join("\n"),
    });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]?.commands).toEqual([
      expect.objectContaining({ commandTextOrNull: "echo real" }),
    ]);
  });

  it("does not treat bare CR as a Markdown line boundary", () => {
    const documentContent = [
      "# Overview\r## Installation",
      "To install, continue.",
      "```sh",
      "echo must-not-run",
      "```",
    ].join("\n");
    expect(parseMarkdownProfile(documentContent).headings).not.toContainEqual(
      expect.objectContaining({ level: 2, label: "Installation" }),
    );
    expect(
      extractInstallationContexts({
        ...base,
        documentContent,
      }).paths,
    ).toEqual([]);
  });

  it("normalizes CRLF and bare CR command terminators while retaining exact byte ranges", () => {
    const documentContent =
      "## Installation\r\nTo install, continue.\r\n```sh\r\nprintf 'a' \\\r\nprintf 'b' \\\rc\r\n```\r\nAfter installation, verify.\r\n";
    const result = extractInstallationContexts({
      ...base,
      documentContent,
    });
    const command = result.paths[0]?.commands[0];
    expect(command?.commandTextOrNull).toBe("printf 'a' \\\nprintf 'b' \\\nc");
    expect(command?.sourceContentHash).toBe(
      createHash("sha256").update("printf 'a' \\\r\nprintf 'b' \\\rc").digest("hex"),
    );
    const reference = result.sourceReferences.find(({ id }) =>
      command?.sourceReferenceIds.includes(id),
    );
    const startByte = Buffer.from(documentContent).indexOf(Buffer.from("printf 'a'"));
    const endByteExclusive = Buffer.from(documentContent).lastIndexOf(Buffer.from("\r\n```"));
    expect(reference).toMatchObject({
      kind: "DOCUMENT",
      locator: { type: "BYTE_RANGE", startByte, endByteExclusive },
    });
  });

  it("fails an unclosed command fence without retaining a partial command", () => {
    const result = extractInstallationContexts({
      ...base,
      documentContent: "## Installation\n```sh\necho incomplete",
    });
    expect(result).toMatchObject({ state: "UNSAFE_OR_AMBIGUOUS", paths: [] });
    expect(result.warningCodes).toContain("DETERMINISTIC_DECLARATION_INVALID");
  });

  it("uses literal raw ATX heading text and excludes Setext headings", () => {
    for (const heading of ["## *Installation*", "Installation\n------------"]) {
      const result = extractInstallationContexts({
        ...base,
        documentContent: `${heading}\n\n\`\`\`sh\necho must-not-match\n\`\`\``,
      });
      expect(result.paths).toEqual([]);
    }
  });

  it("restricts start, prerequisite, and completion cues to eligible one-line blocks", () => {
    const result = extractInstallationContexts({
      ...base,
      documentContent: [
        "## Installation",
        "To install, this wraps",
        "onto another physical line.",
        "",
        "| cue | value |",
        "| --- | --- |",
        "| Verify: fake | To install, fake |",
        "",
        "<div>",
        "After installation, fake.",
        "</div>",
        "",
        "```sh",
        "echo real",
        "```",
      ].join("\n"),
    });
    expect(result.paths[0]).toMatchObject({
      startConditionOrNull: null,
      prerequisites: [],
      completionCueOrNull: null,
    });
  });

  it("suppresses paths with sensitive start, prerequisite, completion, or mechanism prose", () => {
    const documents = [
      [
        "## Installation",
        "To install, contact maintainer@example.com",
        "```sh",
        "echo safe",
        "```",
        "Verify: safe.",
      ],
      [
        "## Installation",
        "- Ask maintainer@example.com",
        "```sh",
        "echo safe",
        "```",
        "Verify: safe.",
      ],
      [
        "## Installation",
        "To install, continue.",
        "```sh",
        "echo safe",
        "```",
        "Verify: contact maintainer@example.com",
      ],
      ["## Installation", "Install with api_key=synthetic-placeholder-value."],
    ];
    for (const lines of documents) {
      const result = extractInstallationContexts({
        ...base,
        documentContent: lines.join("\n"),
      });
      expect(result).toMatchObject({ state: "UNSAFE_OR_AMBIGUOUS", paths: [] });
      expect(
        result.warningCodes.includes("PERSONAL_CONTACT_WITHHELD") ||
          result.warningCodes.includes("SECRET_LIKE_VALUE_WITHHELD"),
      ).toBe(true);
      expect(result.sourceReferences.length).toBeGreaterThan(0);
      expect(JSON.stringify(result)).not.toContain("maintainer@example.com");
      expect(JSON.stringify(result)).not.toContain("synthetic-placeholder-value");
    }
  });

  it("uses parser-derived GFM table rows and keeps nested list-item ranges explicit", () => {
    const profile = parseMarkdownProfile(
      [
        "Paragraph.",
        "",
        "- outer",
        "  - inner",
        "",
        "| a\\|b | `c\\|d` |",
        "| --- | --- |",
        "| x | y |",
      ].join("\n"),
    );
    expect(profile.semanticRanges.filter(({ blockKind }) => blockKind === "PARAGRAPH")).toEqual([
      { startLine: 0, endLine: 0, blockKind: "PARAGRAPH" },
    ]);
    expect(profile.semanticRanges.filter(({ blockKind }) => blockKind === "LIST_ITEM")).toEqual([
      { startLine: 2, endLine: 3, blockKind: "LIST_ITEM" },
      { startLine: 3, endLine: 3, blockKind: "LIST_ITEM" },
    ]);
    expect(profile.semanticRanges.filter(({ blockKind }) => blockKind === "TABLE_ROW")).toEqual([
      { startLine: 5, endLine: 5, blockKind: "TABLE_ROW" },
      { startLine: 7, endLine: 7, blockKind: "TABLE_ROW" },
    ]);
  });
});
