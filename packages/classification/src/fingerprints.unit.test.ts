import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_ANALYSIS_LIMITS_V1,
  buildBoundedInputFingerprint,
  buildCandidateAnalysisFingerprint,
  buildCandidateFingerprints,
  buildCandidateIdempotencyKey,
  canonicalM02Json,
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  hasMatchingCanonicalPayload,
  sha256Base64Url,
  type BoundedClassificationInputV1,
} from "./index.js";

function validBoundedInput(): BoundedClassificationInputV1 {
  const excerptUtf8 = "x";
  return {
    schemaVersion: "1",
    snapshot: {
      sourceSnapshotId: "snapshot-1",
      provider: "github",
      providerRepositoryId: "repo-1",
      immutableRevision: "a".repeat(40),
      acquisitionPolicyVersion: "m01-v1",
    },
    files: [
      {
        normalizedPath: "SKILL.md",
        entryKind: "file",
        disposition: "ACQUIRED",
        byteLength: 1,
        contentSha256: "a".repeat(64),
      },
    ],
    exclusions: [
      {
        normalizedPath: "vendor.bin",
        disposition: "SKIPPED",
        reasonCode: "BINARY",
        contentSha256OrNull: null,
      },
    ],
    evidenceReferences: [
      {
        evidenceReferenceId: "evidence-1",
        normalizedPath: "SKILL.md",
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
        evidenceReferenceId: "evidence-1",
        normalizedPath: "SKILL.md",
        locator: "line:1",
        utf8ByteLength: 1,
        unicodeScalarLength: 1,
        excerptSha256: createHash("sha256").update(excerptUtf8).digest("hex"),
        excerptUtf8,
      },
    ],
    truncation: [
      {
        subjectType: "EXCERPT",
        subjectKey: "evidence-1",
        originalCountOrBytes: 1,
        retainedCountOrBytes: 1,
        orderingBoundaryOrNull: null,
        reasonCode: "NOT_TRUNCATED",
      },
    ],
    limits: { ...CLASSIFICATION_ANALYSIS_LIMITS_V1 },
    policy: {
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      parserProfileVersion: "parser-v1",
      analysisPolicyVersion: "analysis-v1",
      promptBundleVersion: "prompt-v1",
    },
    deterministicAnalyzer: {
      inputEvidenceReferenceIds: ["evidence-1"],
      classification: "SINGLE_SKILL",
      candidateRootFingerprints: ["b".repeat(64)],
      warningCodes: [],
      ambiguityReasonCodes: [],
      requiresAiAssistance: false,
    },
  };
}

describe("M02 fingerprints", () => {
  it("normalizes strings to NFC and orders object keys by Unicode code point", () => {
    const value = { "\u00e9": "e\u0301", "\ud83d\ude00": "ok", a: "a" };

    expect(canonicalM02Json(value)).toBe('{"a":"a","\u00e9":"\u00e9","\ud83d\ude00":"ok"}');
    expect(new TextDecoder().decode(canonicalM02JsonBytes(value))).toBe(canonicalM02Json(value));
  });

  it("preserves prescribed array order and rejects floating point numbers", () => {
    expect(canonicalM02Json({ values: [2, 1] })).toBe('{"values":[2,1]}');
    expect(() => canonicalM02Json({ value: 1.5 })).toThrow("integer");
  });

  it("returns a bare lowercase SHA-256 fingerprint and unpadded base64url digest", () => {
    const canonical = '{"a":"a","b":true}';
    const expected = createHash("sha256").update(canonical, "utf8").digest("hex");

    expect(fingerprintM02Payload({ b: true, a: "a" })).toBe(expected);
    expect(fingerprintM02Payload({ b: true, a: "a" })).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Base64Url(canonical)).toBe(
      createHash("sha256").update(canonical, "utf8").digest("base64url"),
    );
    expect(sha256Base64Url(canonical)).not.toMatch(/[=+/]/);
  });

  it("requires byte-exact canonical payload equality after a fingerprint lookup", () => {
    const stored = canonicalM02JsonBytes({ root: ".", paths: ["SKILL.md"] });
    const attempted = canonicalM02JsonBytes({ root: ".", paths: ["README.md"] });

    expect(hasMatchingCanonicalPayload(stored, stored)).toBe(true);
    expect(hasMatchingCanonicalPayload(stored, attempted)).toBe(false);
  });

  it("rejects invalid Unicode scalar strings", () => {
    expect(() => canonicalM02Json({ value: "\ud800" })).toThrow("Unicode scalar");
    expect(() => canonicalM02Json({ "\udc00": "value" })).toThrow("Unicode scalar");
  });

  it("builds exact candidate content, root, analysis, and idempotency payloads", () => {
    const candidate = buildCandidateFingerprints({
      normalizedRoot: "skills/alpha",
      owned: [
        { path: "README.md", contentSha256: "b".repeat(64) },
        { path: "SKILL.md", contentSha256: "a".repeat(64) },
      ],
      shared: [{ path: "LICENSE", contentSha256: "c".repeat(64) }],
    });
    expect(new TextDecoder().decode(candidate.candidateContentCanonicalBytes)).toBe(
      canonicalM02Json({
        schemaVersion: "1",
        owned: [
          { pathRelativeToRoot: "README.md", contentSha256: "b".repeat(64) },
          { pathRelativeToRoot: "SKILL.md", contentSha256: "a".repeat(64) },
        ],
        shared: [{ repositoryPath: "LICENSE", contentSha256: "c".repeat(64) }],
      }),
    );
    expect(candidate.candidateRootPayload).toEqual({
      schemaVersion: "1",
      normalizedRoot: "skills/alpha",
      ownedRepositoryPaths: ["skills/alpha/README.md", "skills/alpha/SKILL.md"],
      sharedRepositoryPaths: ["LICENSE"],
    });
    expect(candidate.candidateContentFingerprint).toBe(
      "763754d60cf1d3937e500450798a810354900fbcfdd436bbc48ced4b27593550",
    );
    expect(candidate.candidateRootFingerprint).toBe(
      "2f2a5269b7d523a30d29ed41784c2448b10f8fc4c2eaeff54c99b385cdb76f2f",
    );
    const analysis = buildCandidateAnalysisFingerprint({
      sourceSnapshotId: "snapshot-1",
      candidateRootFingerprint: candidate.candidateRootFingerprint,
      candidateContentFingerprint: candidate.candidateContentFingerprint,
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      promptBundleVersion: "prompt-v1",
      boundedInputFingerprint: "d".repeat(64),
    });
    expect(analysis.payload).toEqual({
      schemaVersion: "1",
      sourceSnapshotId: "snapshot-1",
      candidateRootFingerprint: candidate.candidateRootFingerprint,
      candidateContentFingerprint: candidate.candidateContentFingerprint,
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      promptBundleVersion: "prompt-v1",
      boundedInputFingerprint: "d".repeat(64),
    });
    expect(analysis.fingerprint).toBe(
      "26ba62210c8fc640ac094d878ec0cf0c878842fd9fd162b94da2463b7e78eae6",
    );
    expect(
      buildCandidateIdempotencyKey({
        sourceSnapshotId: "snapshot-1",
        candidateRootFingerprint: candidate.candidateRootFingerprint,
        candidateContentFingerprint: candidate.candidateContentFingerprint,
      }),
    ).toBe("e1cfee20011eaa394d2a2caef4d0024a9f2717dc06b5a3523d9053d7e66226bc");
    expect(CLASSIFICATION_ANALYSIS_LIMITS_V1).toMatchObject({
      fileTreeEntries: 10_000,
      candidateRoots: 64,
      totalRequestBytes: 1_048_576,
      totalTimeoutMs: 60_000,
    });
  });

  it("rejects invalid candidate topology and analysis hashes", () => {
    expect(() =>
      buildCandidateFingerprints({
        normalizedRoot: "../unsafe",
        owned: [{ path: "SKILL.md", contentSha256: "a".repeat(64) }],
        shared: [],
      }),
    ).toThrow("root");
    expect(() =>
      buildCandidateFingerprints({
        normalizedRoot: "alpha",
        owned: [{ path: "SKILL.md", contentSha256: "a".repeat(64) }],
        shared: [{ path: "alpha/SKILL.md", contentSha256: "a".repeat(64) }],
      }),
    ).toThrow("owned and shared");
    expect(() =>
      buildCandidateAnalysisFingerprint({
        sourceSnapshotId: "snapshot-1",
        candidateRootFingerprint: "bad",
        candidateContentFingerprint: "a".repeat(64),
        classificationPolicyVersion: "classification-v1",
        identityPolicyVersion: "identity-v1",
        promptBundleVersion: "prompt-v1",
        boundedInputFingerprint: "b".repeat(64),
      }),
    ).toThrow("SHA-256");
  });

  it("rejects a bounded input that does not use every exact v1 hard limit", () => {
    const invalidLimits = { ...CLASSIFICATION_ANALYSIS_LIMITS_V1 };
    Reflect.set(invalidLimits, "totalTimeoutMs", 59_999);
    expect(() =>
      buildBoundedInputFingerprint({
        schemaVersion: "1",
        snapshot: {
          sourceSnapshotId: "snapshot-1",
          provider: "github",
          providerRepositoryId: "repo-1",
          immutableRevision: "a".repeat(40),
          acquisitionPolicyVersion: "m01-v1",
        },
        files: [],
        exclusions: [],
        evidenceReferences: [],
        excerpts: [],
        truncation: [],
        limits: invalidLimits,
        policy: {
          classificationPolicyVersion: "classification-v1",
          identityPolicyVersion: "identity-v1",
          parserProfileVersion: "parser-v1",
          analysisPolicyVersion: "analysis-v1",
          promptBundleVersion: "prompt-v1",
        },
        deterministicAnalyzer: {
          inputEvidenceReferenceIds: [],
          classification: "NON_SKILL",
          candidateRootFingerprints: [],
          warningCodes: [],
          ambiguityReasonCodes: [],
          requiresAiAssistance: false,
        },
      }),
    ).toThrow("limits");
  });

  it("rejects unknown and missing keys at every bounded-input object boundary", () => {
    const selectors = [
      (input: BoundedClassificationInputV1): object | undefined => input,
      (input: BoundedClassificationInputV1): object | undefined => input.snapshot,
      (input: BoundedClassificationInputV1): object | undefined => input.files[0],
      (input: BoundedClassificationInputV1): object | undefined => input.exclusions[0],
      (input: BoundedClassificationInputV1): object | undefined => input.evidenceReferences[0],
      (input: BoundedClassificationInputV1): object | undefined => input.excerpts[0],
      (input: BoundedClassificationInputV1): object | undefined => input.truncation[0],
      (input: BoundedClassificationInputV1): object | undefined => input.limits,
      (input: BoundedClassificationInputV1): object | undefined => input.policy,
      (input: BoundedClassificationInputV1): object | undefined => input.deterministicAnalyzer,
    ];
    for (const select of selectors) {
      const extra = validBoundedInput();
      Reflect.set(select(extra) ?? {}, "unauthorized", "value");
      expect(() => buildBoundedInputFingerprint(extra)).toThrow("approved payload keys");

      const missing = validBoundedInput();
      const target = select(missing);
      const firstKey = target === undefined ? undefined : Object.keys(target)[0];
      if (target !== undefined && firstKey !== undefined) Reflect.deleteProperty(target, firstKey);
      expect(() => buildBoundedInputFingerprint(missing)).toThrow("approved payload keys");
    }
  });

  it("orders canonical NFC strings and rejects post-normalization collisions", () => {
    const composed = buildCandidateFingerprints({
      normalizedRoot: "é",
      owned: [{ path: "SKILL.md", contentSha256: "a".repeat(64) }],
      shared: [],
    });
    const decomposed = buildCandidateFingerprints({
      normalizedRoot: "e\u0301",
      owned: [{ path: "SKILL.md", contentSha256: "a".repeat(64) }],
      shared: [],
    });
    expect(decomposed).toEqual(composed);
    expect(() =>
      buildCandidateFingerprints({
        normalizedRoot: ".",
        owned: [
          { path: "é", contentSha256: "a".repeat(64) },
          { path: "e\u0301", contentSha256: "b".repeat(64) },
        ],
        shared: [],
      }),
    ).toThrow("duplicate candidate content path");

    const input = validBoundedInput();
    expect(() =>
      buildBoundedInputFingerprint({
        ...input,
        files: [
          ...input.files,
          {
            normalizedPath: "é",
            entryKind: "file",
            disposition: "ACQUIRED",
            byteLength: 1,
            contentSha256: "c".repeat(64),
          },
          {
            normalizedPath: "e\u0301",
            entryKind: "file",
            disposition: "ACQUIRED",
            byteLength: 1,
            contentSha256: "d".repeat(64),
          },
        ],
      }),
    ).toThrow("duplicate bounded file path");
    expect(() =>
      buildBoundedInputFingerprint({
        ...input,
        deterministicAnalyzer: {
          ...input.deterministicAnalyzer,
          warningCodes: ["é", "e\u0301"],
        },
      }),
    ).toThrow("NFC normalization");
  });
});
