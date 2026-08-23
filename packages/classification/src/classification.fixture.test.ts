import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  CLASSIFICATION_ANALYSIS_LIMITS_V1,
  buildBoundedInputFingerprint,
  buildCandidateFingerprints,
  buildCandidateIdempotencyKey,
  buildRepositoryCandidateGroup,
  canonicalM02Json,
  classifyRepository,
  type BoundedClassificationInputV1,
  type ClassificationFile,
} from "./index.js";

interface ExpectedFixtureEvidence {
  readonly id: string;
  readonly fingerprints: readonly string[];
  readonly records: readonly string[];
  readonly decision: string;
  readonly auditStates: readonly string[];
}

const expectedFixtureEvidence = new Map(
  (
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as { readonly expectedEvidence: readonly ExpectedFixtureEvidence[] }
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

function expectedEvidence(id: string): ExpectedFixtureEvidence {
  const evidence = expectedFixtureEvidence.get(id);
  if (evidence === undefined) throw new Error(`missing expected evidence for ${id}`);
  return evidence;
}

const file = (normalizedPath: string, utf8Text: string): ClassificationFile => ({
  normalizedPath,
  disposition: "ACQUIRED",
  entryKind: "file",
  contentSha256: "a".repeat(64),
  utf8Text,
});
const skill = (path: string, name: string) => file(path, `---\nname: ${name}\n---\n# ${name}\n`);

describe("M02 F01-F08 classification fixtures", () => {
  it.each([
    ["F01", [skill("SKILL.md", "one")], "SINGLE_SKILL"],
    ["F02", [skill("alpha/SKILL.md", "alpha"), skill("beta/SKILL.md", "beta")], "MULTIPLE_SKILLS"],
    [
      "F03",
      [
        skill("alpha/SKILL.md", "alpha"),
        skill("beta/SKILL.md", "beta"),
        file("README.md", "# Skills\n[A](alpha) [B](beta)\n"),
      ],
      "SKILL_COLLECTION",
    ],
    [
      "F04",
      [skill("skills/one/SKILL.md", "one"), file("package.json", "{}"), file("src/a.ts", "x")],
      "SKILL_PLUS_APPLICATION",
    ],
    ["F05", [file("README.md", "not a skill")], "NON_SKILL"],
    ["F06", [skill("SKILL.md", "outer"), skill("nested/SKILL.md", "inner")], "AMBIGUOUS"],
    ["F08", [skill("examples/one/SKILL.md", "example")], "NON_SKILL"],
  ] as const)("classifies %s with the exact deterministic outcome", (id, files, expected) => {
    const result = classifyRepository({ files });
    expect(result.classification).toBe(expected);
    const fixture = expectedEvidence(id);
    expect(result.classification).toBe(fixture.decision);
    const records = (() => {
      if (id === "F03" || id === "F04") {
        const group = buildRepositoryCandidateGroup({
          id: id === "F03" ? "collection" : "application",
          sourceSnapshotId: "snapshot-fixture",
          classificationPolicyVersion: "classification-v1",
          classification: result.classification,
          candidates: result.roots.map((root) => ({ id: root, rootFingerprint: "a".repeat(64) })),
          evidenceReferenceIds: [],
          warningCodes: [],
          applicationPaths: id === "F04" ? ["package.json", "src/a.ts"] : [],
          supersedesGroupId: null,
        });
        return [
          `group:${group.id}`,
          ...group.relationships.map(
            (relationship) =>
              `relationship:${relationship.relationshipType}:${relationship.candidateId}`,
          ),
        ];
      }
      if (id === "F05")
        return result.roots.length === 0 ? ["group:zero-candidates", "job:completed"] : [];
      if (id === "F06")
        return result.roots.map((root) => `candidate:${root === "." ? "root" : root}`);
      if (id === "F08") return result.roots.length === 0 ? ["excluded:examples/one/SKILL.md"] : [];
      return result.roots.map((root) => `candidate:${root}`);
    })();
    expect(records).toEqual(fixture.records);
    expect(fixture.auditStates).toEqual(
      id === "F06" ? ["IDENTITY_REVIEW_REQUIRED"] : ["DETERMINISTIC"],
    );
  });

  it("F07 fails closed when immutable inventory evidence is incomplete", () => {
    const result = classifyRepository({
      files: [skill("SKILL.md", "one")],
      snapshotComplete: false,
    });
    expect(result).toMatchObject({ classification: "UNSUPPORTED", roots: [] });
    expect(expectedEvidence("F07")).toEqual({
      id: "F07",
      fingerprints: [],
      records: ["classification-run:unsupported"],
      decision: result.classification,
      auditStates: ["FAIL_CLOSED"],
    });
  });
});

const boundedInput = (): BoundedClassificationInputV1 => {
  const excerptUtf8 = "---\nname: alpha\n---\n";
  const secondExcerptUtf8 = "# Alpha\n";
  return {
    schemaVersion: "1",
    snapshot: {
      sourceSnapshotId: "snapshot-1",
      provider: "github",
      providerRepositoryId: "repo-1",
      immutableRevision: "1".repeat(40),
      acquisitionPolicyVersion: "m01-v1",
    },
    files: [
      {
        normalizedPath: "zeta/README.md",
        entryKind: "file",
        disposition: "ACQUIRED",
        byteLength: 8,
        contentSha256: "c".repeat(64),
      },
      {
        normalizedPath: "alpha/SKILL.md",
        entryKind: "file",
        disposition: "ACQUIRED",
        byteLength: 22,
        contentSha256: "a".repeat(64),
      },
    ],
    exclusions: [
      {
        normalizedPath: "vendor/blob.bin",
        disposition: "SKIPPED",
        reasonCode: "UNSUPPORTED_MEDIA_TYPE",
        contentSha256OrNull: null,
      },
      {
        normalizedPath: "build/output.js",
        disposition: "QUARANTINED",
        reasonCode: "EXCLUDED_PATH",
        contentSha256OrNull: "d".repeat(64),
      },
    ],
    evidenceReferences: [
      {
        evidenceReferenceId: "evidence-2",
        normalizedPath: "zeta/README.md",
        sourceSnapshotId: "snapshot-1",
        sourceEntryId: "entry-2",
        evidenceKind: "SOURCE_DOCUMENT",
        contentSha256: "c".repeat(64),
        availability: "AVAILABLE",
        usage: "ROOT_SCOPED",
      },
      {
        evidenceReferenceId: "evidence-1",
        normalizedPath: "alpha/SKILL.md",
        sourceSnapshotId: "snapshot-1",
        sourceEntryId: "entry-1",
        evidenceKind: "SOURCE_DOCUMENT",
        contentSha256: "a".repeat(64),
        availability: "AVAILABLE",
        usage: "ROOT_SCOPED",
      },
    ],
    excerpts: [
      {
        evidenceReferenceId: "evidence-2",
        normalizedPath: "zeta/README.md",
        locator: "lines:1-1",
        utf8ByteLength: Buffer.byteLength(secondExcerptUtf8),
        unicodeScalarLength: Array.from(secondExcerptUtf8).length,
        excerptSha256: createHash("sha256").update(secondExcerptUtf8).digest("hex"),
        excerptUtf8: secondExcerptUtf8,
      },
      {
        evidenceReferenceId: "evidence-1",
        normalizedPath: "alpha/SKILL.md",
        locator: "lines:1-3",
        utf8ByteLength: Buffer.byteLength(excerptUtf8),
        unicodeScalarLength: Array.from(excerptUtf8).length,
        excerptSha256: createHash("sha256").update(excerptUtf8).digest("hex"),
        excerptUtf8,
      },
    ],
    truncation: [
      {
        subjectType: "FILE_TREE",
        subjectKey: "snapshot-1",
        originalCountOrBytes: 4,
        retainedCountOrBytes: 4,
        orderingBoundaryOrNull: "zeta/README.md",
        reasonCode: "NOT_TRUNCATED",
      },
      {
        subjectType: "EXCERPT",
        subjectKey: "evidence-1",
        originalCountOrBytes: 22,
        retainedCountOrBytes: 22,
        orderingBoundaryOrNull: null,
        reasonCode: "NOT_TRUNCATED",
      },
    ],
    limits: CLASSIFICATION_ANALYSIS_LIMITS_V1,
    policy: {
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      parserProfileVersion: "parser-v1",
      analysisPolicyVersion: "analysis-v1",
      promptBundleVersion: "prompt-v1",
    },
    deterministicAnalyzer: {
      inputEvidenceReferenceIds: ["evidence-2", "evidence-1"],
      classification: "SINGLE_SKILL",
      candidateRootFingerprints: ["c".repeat(64), "b".repeat(64)],
      warningCodes: ["WARNING_Z", "WARNING_A"],
      ambiguityReasonCodes: ["REASON_Z", "REASON_A"],
      requiresAiAssistance: false,
    },
  };
};

describe("M02 F09-F14/F32 fingerprint fixtures", () => {
  const contentHash = "a".repeat(64);
  const sharedHash = "b".repeat(64);

  it("F09/F10 keeps identical content equal while root, snapshot, and candidate identity remain distinct", () => {
    const alpha = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [],
    });
    const beta = buildCandidateFingerprints({
      normalizedRoot: "beta",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [],
    });
    expect(alpha.candidateContentFingerprint).toBe(beta.candidateContentFingerprint);
    expect(alpha.candidateContentFingerprint).toBe(
      "5daed103b224719667b12d19852de5a1d32b9fa6a56a6836b10c3112d326dc77",
    );
    expect(alpha.candidateRootFingerprint).toBe(
      "c84d721db24d61b51bf86b526181ad34a86ee7e3a53224714dc3f857920b759f",
    );
    expect(beta.candidateRootFingerprint).toBe(
      "7fc89b7971221df8593758aafa9edf14388c02f99d802f53b9293433bf512002",
    );
    expect(expectedEvidence("F09")).toEqual({
      id: "F09",
      fingerprints: [
        alpha.candidateContentFingerprint,
        alpha.candidateRootFingerprint,
        beta.candidateRootFingerprint,
      ],
      records: ["candidate:alpha", "candidate:beta"],
      decision: "CONTENT_EQUAL_ROOT_DISTINCT",
      auditStates: ["DETERMINISTIC"],
    });
    expect(expectedEvidence("F10")).toEqual({
      id: "F10",
      fingerprints: [alpha.candidateContentFingerprint],
      records: ["candidate:snapshot-a", "candidate:snapshot-b"],
      decision: "SOURCE_CANDIDATES_DISTINCT",
      auditStates: ["DETERMINISTIC"],
    });
    expect(alpha.candidateRootFingerprint).not.toBe(beta.candidateRootFingerprint);
    expect(
      buildCandidateIdempotencyKey({
        sourceSnapshotId: "snapshot-a",
        candidateRootFingerprint: alpha.candidateRootFingerprint,
        candidateContentFingerprint: alpha.candidateContentFingerprint,
      }),
    ).not.toBe(
      buildCandidateIdempotencyKey({
        sourceSnapshotId: "snapshot-b",
        candidateRootFingerprint: alpha.candidateRootFingerprint,
        candidateContentFingerprint: alpha.candidateContentFingerprint,
      }),
    );
  });

  it("F11/F12 produces deterministic shared ownership and fingerprints under reordering", () => {
    const forward = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [
        { path: "SKILL.md", contentSha256: contentHash },
        { path: "src.ts", contentSha256: "c".repeat(64) },
      ],
      shared: [{ path: "README.md", contentSha256: sharedHash }],
    });
    const reverse = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [
        { path: "src.ts", contentSha256: "c".repeat(64) },
        { path: "SKILL.md", contentSha256: contentHash },
      ],
      shared: [{ path: "README.md", contentSha256: sharedHash }],
    });
    expect(reverse).toEqual(forward);
    expect(forward.candidateContentFingerprint).toBe(
      "4e5546c8ab00e43fcdefe89572214b501af83b1650d7c17dd390f950bf70af0e",
    );
    expect(forward.candidateRootFingerprint).toBe(
      "d00274021d5cf1cc5a73cf9e0b9ed028d1df65fe3016fd9fe5422f5b8895c324",
    );
    for (const id of ["F11", "F12"] as const) {
      expect(expectedEvidence(id).fingerprints).toEqual([
        forward.candidateContentFingerprint,
        forward.candidateRootFingerprint,
      ]);
    }
    expect(forward.candidateRootPayload.sharedRepositoryPaths).toEqual(["README.md"]);
  });

  it("F13 changes only topology/root fingerprint when content moves to another root", () => {
    const before = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [],
    });
    const after = buildCandidateFingerprints({
      normalizedRoot: "skills/alpha",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [],
    });
    expect(after.candidateContentFingerprint).toBe(before.candidateContentFingerprint);
    expect(before.candidateRootFingerprint).toBe(
      "c84d721db24d61b51bf86b526181ad34a86ee7e3a53224714dc3f857920b759f",
    );
    expect(after.candidateRootFingerprint).toBe(
      "3f1cb99a44a869a27c4ed47ccfb284ed3d4d51fd407102e3a8e2c31b4edcd07e",
    );
    expect(expectedEvidence("F13").fingerprints).toEqual([
      before.candidateRootFingerprint,
      after.candidateRootFingerprint,
    ]);
    expect(after.candidateRootFingerprint).not.toBe(before.candidateRootFingerprint);
  });

  it("F14 changes only content fingerprint when shared bytes change", () => {
    const before = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [{ path: "README.md", contentSha256: sharedHash }],
    });
    const after = buildCandidateFingerprints({
      normalizedRoot: "alpha",
      owned: [{ path: "SKILL.md", contentSha256: contentHash }],
      shared: [{ path: "README.md", contentSha256: "d".repeat(64) }],
    });
    expect(after.candidateContentFingerprint).not.toBe(before.candidateContentFingerprint);
    expect(before.candidateContentFingerprint).toBe(
      "aee2cb9567b9c74d78c7ab1293ecf2cf0ba7a647eb5b33666e73a021a5e52fb9",
    );
    expect(after.candidateContentFingerprint).toBe(
      "fa9085819cfe4aac052a87b71895afcbee5d512186efe50349fb2b33bc0f965b",
    );
    expect(expectedEvidence("F14").fingerprints).toEqual([
      before.candidateContentFingerprint,
      after.candidateContentFingerprint,
    ]);
    expect(after.candidateRootFingerprint).toBe(before.candidateRootFingerprint);
  });

  it("F32 has golden canonical bounded bytes, stable reordering, and one-field mutation sensitivity", () => {
    const input = boundedInput();
    const golden = buildBoundedInputFingerprint(input);
    const expectedCanonical = canonicalM02Json(golden.payload);
    expect(new TextDecoder().decode(golden.canonicalBytes)).toBe(expectedCanonical);
    expect(golden.fingerprint).toBe(
      "fac53cd41b682dc4d7afe7aa0b17baf08e7c591129f0dc996aeb3bdc3aa99dc3",
    );
    expect(expectedEvidence("F32").fingerprints).toEqual([golden.fingerprint]);

    const reordered = buildBoundedInputFingerprint({
      ...input,
      files: [...input.files].reverse(),
      exclusions: [...input.exclusions].reverse(),
      evidenceReferences: [...input.evidenceReferences].reverse(),
      excerpts: [...input.excerpts].reverse(),
      truncation: [...input.truncation].reverse(),
      deterministicAnalyzer: {
        ...input.deterministicAnalyzer,
        warningCodes: [...input.deterministicAnalyzer.warningCodes].reverse(),
        ambiguityReasonCodes: [...input.deterministicAnalyzer.ambiguityReasonCodes].reverse(),
        candidateRootFingerprints: [
          ...input.deterministicAnalyzer.candidateRootFingerprints,
        ].reverse(),
        inputEvidenceReferenceIds: [
          ...input.deterministicAnalyzer.inputEvidenceReferenceIds,
        ].reverse(),
      },
    });
    expect(reordered).toEqual(golden);

    const mutated = buildBoundedInputFingerprint({
      ...input,
      snapshot: { ...input.snapshot, providerRepositoryId: "repo-2" },
    });
    expect(mutated.fingerprint).not.toBe(golden.fingerprint);
  });
});
