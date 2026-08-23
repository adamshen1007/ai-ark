import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  buildBoundedInputFingerprint,
  type BoundedClassificationInputV1,
} from "@ai-ark/classification";
import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_ANALYSIS_POLICY_V1,
  CLASSIFICATION_ANALYSIS_LIMITS_V1,
  DeterministicClassificationAnalysisAdapter,
  validateAnalysisPolicyUsage,
  validateAnalysisRequest,
} from "./index.js";

const expectedEvidence = new Map(
  (
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as {
      readonly expectedEvidence: readonly {
        readonly id: string;
        readonly records: readonly string[];
        readonly decision: string;
        readonly auditStates: readonly string[];
      }[];
    }
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

const excerptText = "name: demo";
const baseEvidenceReference = {
  evidenceReferenceId: "e1",
  normalizedPath: "SKILL.md",
  sourceSnapshotId: "snapshot-1",
  sourceEntryId: "entry-1",
  evidenceKind: "SOURCE_DOCUMENT",
  contentSha256: "a".repeat(64),
  availability: "AVAILABLE",
  usage: "ROOT_SCOPED",
} as const;
const boundedInput = {
  schemaVersion: "1",
  snapshot: {
    sourceSnapshotId: "snapshot-1",
    provider: "github",
    providerRepositoryId: "repo-1",
    immutableRevision: "a".repeat(40),
    acquisitionPolicyVersion: "acquisition-v1",
  },
  files: [
    {
      normalizedPath: "SKILL.md",
      entryKind: "file",
      disposition: "ACQUIRED",
      byteLength: 10,
      contentSha256: "a".repeat(64),
    },
  ],
  exclusions: [],
  evidenceReferences: [baseEvidenceReference],
  excerpts: [
    {
      evidenceReferenceId: "e1",
      normalizedPath: "SKILL.md",
      locator: "front-matter:name",
      utf8ByteLength: Buffer.byteLength(excerptText, "utf8"),
      unicodeScalarLength: Array.from(excerptText).length,
      excerptSha256: createHash("sha256").update(excerptText).digest("hex"),
      excerptUtf8: excerptText,
    },
  ],
  truncation: [],
  limits: CLASSIFICATION_ANALYSIS_LIMITS_V1,
  policy: {
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    parserProfileVersion: "parser-profile-v1",
    analysisPolicyVersion: "classification-analysis-v1",
    promptBundleVersion: "classification-prompt-v1",
  },
  deterministicAnalyzer: {
    inputEvidenceReferenceIds: ["e1"],
    classification: "SINGLE_SKILL",
    candidateRootFingerprints: ["b".repeat(64)],
    warningCodes: [],
    ambiguityReasonCodes: [],
    requiresAiAssistance: false,
  },
} as const satisfies BoundedClassificationInputV1;

const baseRequest = {
  operation: "CLASSIFY_REPOSITORY" as const,
  sourceSnapshotId: "snapshot-1",
  classificationPolicyVersion: "classification-v1",
  identityPolicyVersion: "identity-v1",
  analysisPolicyVersion: "classification-analysis-v1",
  promptBundleVersion: "classification-prompt-v1",
  untrustedSourceMarker: true as const,
  boundedInput,
  boundedInputFingerprint: buildBoundedInputFingerprint(boundedInput).fingerprint,
  deterministicResult: {
    classification: "SINGLE_SKILL" as const,
    roots: ["."],
    candidateRootFingerprints: ["b".repeat(64)],
    candidateUsage: [{ root: ".", evidenceIds: ["e1"], excerptEvidenceIds: ["e1"] }],
  },
};

const baseContext = {
  sourceSnapshotId: "snapshot-1",
  candidateRoots: [{ candidateRootFingerprint: "b".repeat(64), normalizedRoot: "." }],
  evidenceReferences: [baseEvidenceReference],
} as const;

function boundaryRequest(input: {
  readonly rootCount: number;
  readonly evidenceCounts: readonly number[];
  readonly excerptCounts: readonly number[];
}) {
  const roots = Array.from({ length: input.rootCount }, (_, index) => `root-${String(index)}`);
  const candidateRootFingerprints = roots.map((_, index) =>
    (index + 1).toString(16).padStart(64, "0"),
  );
  const evidenceReferences = roots.flatMap((root, rootIndex) =>
    Array.from({ length: input.evidenceCounts[rootIndex] ?? 0 }, (_, evidenceIndex) => ({
      evidenceReferenceId: `e-${String(rootIndex).padStart(2, "0")}-${String(evidenceIndex).padStart(3, "0")}`,
      normalizedPath: `${root}/evidence-${String(evidenceIndex).padStart(3, "0")}.md`,
      sourceSnapshotId: "snapshot-1",
      sourceEntryId: `entry-${String(rootIndex)}-${String(evidenceIndex)}`,
      evidenceKind: "SOURCE_DOCUMENT" as const,
      contentSha256: (rootIndex + evidenceIndex + 1).toString(16).padStart(64, "0"),
      availability: "AVAILABLE" as const,
      usage: "ROOT_SCOPED" as const,
    })),
  );
  const evidenceByRoot = roots.map((root) =>
    evidenceReferences.filter((evidence) => evidence.normalizedPath.startsWith(`${root}/`)),
  );
  const excerpts = roots.flatMap((_, rootIndex) =>
    requireArrayEntry(evidenceByRoot, rootIndex)
      .slice(0, input.excerptCounts[rootIndex] ?? 0)
      .map((evidence) => {
        const excerptUtf8 = `excerpt:${evidence.evidenceReferenceId}`;
        return {
          evidenceReferenceId: evidence.evidenceReferenceId,
          normalizedPath: evidence.normalizedPath,
          locator: "line:1",
          utf8ByteLength: Buffer.byteLength(excerptUtf8, "utf8"),
          unicodeScalarLength: Array.from(excerptUtf8).length,
          excerptSha256: createHash("sha256").update(excerptUtf8).digest("hex"),
          excerptUtf8,
        };
      }),
  );
  const bounded = {
    ...boundedInput,
    evidenceReferences,
    excerpts,
    deterministicAnalyzer: {
      ...boundedInput.deterministicAnalyzer,
      inputEvidenceReferenceIds: evidenceReferences.map(
        ({ evidenceReferenceId }) => evidenceReferenceId,
      ),
      classification: input.rootCount === 1 ? "SINGLE_SKILL" : "MULTIPLE_SKILLS",
      candidateRootFingerprints,
    },
  };
  const request = {
    ...baseRequest,
    boundedInput: bounded,
    boundedInputFingerprint: buildBoundedInputFingerprint(bounded as never).fingerprint,
    deterministicResult: {
      classification:
        input.rootCount === 1 ? ("SINGLE_SKILL" as const) : ("MULTIPLE_SKILLS" as const),
      roots,
      candidateRootFingerprints,
      candidateUsage: roots.map((root, index) => ({
        root,
        evidenceIds: requireArrayEntry(evidenceByRoot, index).map(
          ({ evidenceReferenceId }) => evidenceReferenceId,
        ),
        excerptEvidenceIds: excerpts
          .filter((excerpt) => excerpt.normalizedPath.startsWith(`${root}/`))
          .map(({ evidenceReferenceId }) => evidenceReferenceId),
      })),
    },
  };
  return {
    request,
    context: {
      sourceSnapshotId: "snapshot-1",
      candidateRoots: roots.map((normalizedRoot, index) => ({
        normalizedRoot,
        candidateRootFingerprint: requireArrayEntry(candidateRootFingerprints, index),
      })),
      evidenceReferences,
    },
  };
}

function requireArrayEntry<T>(values: readonly T[], index: number): T {
  const value = values[index];
  if (value === undefined) throw new Error("TEST_FIXTURE_INVALID");
  return value;
}

describe("M02 provider-neutral AI classification boundary", () => {
  it("accepts independently bounded evidence and excerpts in realizable requests", () => {
    const totalBoundary = boundaryRequest({
      rootCount: 16,
      evidenceCounts: Array.from({ length: 16 }, () => 32),
      excerptCounts: Array.from({ length: 16 }, () => 8),
    });
    expect(
      validateAnalysisRequest(totalBoundary.request as never, totalBoundary.context as never),
    ).toEqual({
      ok: true,
    });

    const candidateBoundary = boundaryRequest({
      rootCount: 1,
      evidenceCounts: [32],
      excerptCounts: [8],
    });
    expect(
      validateAnalysisRequest(
        candidateBoundary.request as never,
        candidateBoundary.context as never,
      ),
    ).toEqual({ ok: true });
  });

  it("rejects each total and per-candidate evidence/excerpt one-over independently", () => {
    const cases = [
      boundaryRequest({
        rootCount: 17,
        evidenceCounts: [...Array.from({ length: 16 }, () => 31), 17],
        excerptCounts: Array.from({ length: 17 }, () => 0),
      }),
      boundaryRequest({
        rootCount: 17,
        evidenceCounts: Array.from({ length: 17 }, () => 8),
        excerptCounts: [...Array.from({ length: 16 }, () => 8), 1],
      }),
      boundaryRequest({ rootCount: 1, evidenceCounts: [33], excerptCounts: [8] }),
      boundaryRequest({ rootCount: 1, evidenceCounts: [9], excerptCounts: [9] }),
    ];
    for (const boundary of cases) {
      expect(
        validateAnalysisRequest(boundary.request as never, boundary.context as never),
      ).toMatchObject({ ok: false, status: "LIMIT_EXCEEDED" });
    }
  });

  it("binds optional excerpts to trusted evidence and rejects unavailable or foreign-root evidence", () => {
    const noExcerpt = boundaryRequest({ rootCount: 1, evidenceCounts: [1], excerptCounts: [0] });
    expect(validateAnalysisRequest(noExcerpt.request as never, noExcerpt.context as never)).toEqual(
      {
        ok: true,
      },
    );

    const unknownExcerpt = {
      ...boundedInput,
      excerpts: [
        { ...requireArrayEntry(boundedInput.excerpts, 0), evidenceReferenceId: "unknown" },
      ],
    };
    expect(() => buildBoundedInputFingerprint(unknownExcerpt as never)).toThrow(
      "hash or length mismatch",
    );

    for (const override of [
      { evidenceKind: "INVENTED_KIND" },
      { availability: "INVENTED_AVAILABILITY" },
      { usage: "INVENTED_USAGE" },
    ]) {
      const invalidEnum = boundaryRequest({
        rootCount: 1,
        evidenceCounts: [1],
        excerptCounts: [0],
      });
      expect(() =>
        buildBoundedInputFingerprint({
          ...invalidEnum.request.boundedInput,
          evidenceReferences: invalidEnum.request.boundedInput.evidenceReferences.map(
            (evidence) => ({ ...evidence, ...override }),
          ),
        } as never),
      ).toThrow("unsupported evidence");
    }

    const unavailable = boundaryRequest({ rootCount: 1, evidenceCounts: [1], excerptCounts: [0] });
    const unavailableEvidence = unavailable.request.boundedInput.evidenceReferences.map(
      (evidence) => ({
        ...evidence,
        availability: "UNSAFE" as const,
      }),
    );
    const unavailableInput = {
      ...unavailable.request.boundedInput,
      evidenceReferences: unavailableEvidence,
    };
    expect(
      validateAnalysisRequest(
        {
          ...unavailable.request,
          boundedInput: unavailableInput,
          boundedInputFingerprint: buildBoundedInputFingerprint(unavailableInput as never)
            .fingerprint,
        } as never,
        { ...unavailable.context, evidenceReferences: unavailableEvidence },
      ),
    ).toMatchObject({ ok: false, reason: "EVIDENCE_UNAVAILABLE" });

    const foreign = boundaryRequest({ rootCount: 1, evidenceCounts: [1], excerptCounts: [0] });
    const foreignEvidence = foreign.request.boundedInput.evidenceReferences.map((evidence) => ({
      ...evidence,
      normalizedPath: "foreign/evidence.md",
    }));
    const foreignInput = { ...foreign.request.boundedInput, evidenceReferences: foreignEvidence };
    expect(
      validateAnalysisRequest(
        {
          ...foreign.request,
          boundedInput: foreignInput,
          boundedInputFingerprint: buildBoundedInputFingerprint(foreignInput as never).fingerprint,
        } as never,
        { ...foreign.context, evidenceReferences: foreignEvidence },
      ),
    ).toMatchObject({ ok: false, reason: "CANDIDATE_USAGE_INVALID" });
  });

  it("allows trusted shared outside-root evidence only with complete candidate usage", () => {
    const shared = boundaryRequest({ rootCount: 2, evidenceCounts: [1, 0], excerptCounts: [0, 0] });
    const sharedEvidence = shared.request.boundedInput.evidenceReferences.map((evidence) => ({
      ...evidence,
      normalizedPath: "README.md",
      usage: "SHARED_OUTSIDE_ROOT" as const,
    }));
    const sharedInput = { ...shared.request.boundedInput, evidenceReferences: sharedEvidence };
    const sharedRequest = {
      ...shared.request,
      boundedInput: sharedInput,
      boundedInputFingerprint: buildBoundedInputFingerprint(sharedInput as never).fingerprint,
      deterministicResult: {
        ...shared.request.deterministicResult,
        candidateUsage: shared.request.deterministicResult.roots.map((root) => ({
          root,
          evidenceIds: [requireArrayEntry(sharedEvidence, 0).evidenceReferenceId],
          excerptEvidenceIds: [],
        })),
      },
    };
    const sharedContext = { ...shared.context, evidenceReferences: sharedEvidence };
    expect(validateAnalysisRequest(sharedRequest as never, sharedContext as never)).toEqual({
      ok: true,
    });
    expect(
      validateAnalysisRequest(
        {
          ...sharedRequest,
          deterministicResult: {
            ...sharedRequest.deterministicResult,
            candidateUsage: [
              requireArrayEntry(sharedRequest.deterministicResult.candidateUsage, 0),
              {
                ...requireArrayEntry(sharedRequest.deterministicResult.candidateUsage, 1),
                evidenceIds: [],
              },
            ],
          },
        } as never,
        sharedContext as never,
      ),
    ).toMatchObject({ ok: false, reason: "CANDIDATE_USAGE_INVALID" });
  });
  it("pins every v1 hard limit", () => {
    expect(CLASSIFICATION_ANALYSIS_POLICY_V1).toEqual({
      fileTreeEntries: 10_000,
      candidateRoots: 64,
      evidenceReferencesTotal: 512,
      evidenceReferencesPerCandidate: 32,
      excerptsTotal: 128,
      excerptsPerCandidate: 8,
      bytesPerExcerpt: 4_096,
      scalarsPerExcerpt: 4_096,
      totalRequestBytes: 1_048_576,
      estimatedInputTokens: 200_000,
      responseBytes: 262_144,
      warningCodes: 128,
      ambiguityReasonCodes: 64,
      repairAttempts: 1,
      providerAttempts: 2,
      attemptTimeoutMs: 30_000,
      totalTimeoutMs: 60_000,
    });
  });

  it("F28 accepts bounded evidence and fails closed one-over without reconciliation", async () => {
    expect(validateAnalysisRequest(baseRequest, baseContext)).toMatchObject({ ok: true });
    expect(expectedEvidence.get("F28")).toMatchObject({
      records: ["analysis-run:bounded"],
      decision: "BOUNDARY_PASS_ONE_OVER_FAIL",
      auditStates: ["LIMIT_EXCEEDED"],
    });
    const oversizedBoundedInput = {
      ...boundedInput,
      files: Array.from({ length: 10_001 }, (_, index) => ({
        normalizedPath: `p/${String(index)}`,
        entryKind: "file",
        disposition: "ACQUIRED",
        byteLength: 1,
        contentSha256: "a".repeat(64),
      })),
    } satisfies BoundedClassificationInputV1;
    const oversizedRequest = {
      ...baseRequest,
      boundedInput: oversizedBoundedInput,
      boundedInputFingerprint: buildBoundedInputFingerprint(oversizedBoundedInput).fingerprint,
    };
    expect(validateAnalysisRequest(oversizedRequest, baseContext)).toMatchObject({
      ok: false,
      status: "LIMIT_EXCEEDED",
    });
    const blocked = await new DeterministicClassificationAnalysisAdapter([
      {
        classification: "SINGLE_SKILL",
        roots: ["."],
        confidence: null,
        evidenceIds: ["e1"],
        warnings: [],
        ambiguityCodes: [],
      },
    ]).classify(oversizedRequest, baseContext);
    expect(blocked).toMatchObject({ reconciled: null, cancelled: true });
    const rootFingerprints = Array.from({ length: 65 }, (_, index) =>
      index.toString(16).padStart(64, "0"),
    );
    const rootBoundedInput = {
      ...boundedInput,
      evidenceReferences: [{ ...baseEvidenceReference, usage: "SHARED_OUTSIDE_ROOT" }],
      deterministicAnalyzer: {
        ...boundedInput.deterministicAnalyzer,
        classification: "MULTIPLE_SKILLS",
        candidateRootFingerprints: rootFingerprints,
      },
    } satisfies BoundedClassificationInputV1;
    expect(
      validateAnalysisRequest(
        {
          ...baseRequest,
          boundedInput: rootBoundedInput,
          boundedInputFingerprint: buildBoundedInputFingerprint(rootBoundedInput).fingerprint,
          deterministicResult: {
            classification: "MULTIPLE_SKILLS",
            roots: Array.from({ length: 65 }, (_, index) => `root-${String(index)}`),
            candidateRootFingerprints: rootFingerprints,
            candidateUsage: Array.from({ length: 65 }, (_, index) => ({
              root: `root-${String(index)}`,
              evidenceIds: ["e1"],
              excerptEvidenceIds: ["e1"],
            })),
          },
        },
        {
          sourceSnapshotId: "snapshot-1",
          candidateRoots: rootFingerprints.map((candidateRootFingerprint, index) => ({
            candidateRootFingerprint,
            normalizedRoot: `root-${String(index)}`,
          })),
          evidenceReferences: [{ ...baseEvidenceReference, usage: "SHARED_OUTSIDE_ROOT" }],
        },
      ),
    ).toMatchObject({ ok: false, status: "LIMIT_EXCEEDED" });
  }, 15_000);

  it("accepts every exact policy boundary and rejects every one-over value", () => {
    expect(validateAnalysisPolicyUsage(CLASSIFICATION_ANALYSIS_LIMITS_V1)).toEqual({ ok: true });
    expect(
      validateAnalysisPolicyUsage({
        ...CLASSIFICATION_ANALYSIS_LIMITS_V1,
        unexpected: 0,
      } as never),
    ).toMatchObject({ ok: false, status: "INVALID_OUTPUT" });
    for (const key of Object.keys(
      CLASSIFICATION_ANALYSIS_LIMITS_V1,
    ) as (keyof typeof CLASSIFICATION_ANALYSIS_LIMITS_V1)[]) {
      expect(
        validateAnalysisPolicyUsage({
          ...CLASSIFICATION_ANALYSIS_LIMITS_V1,
          [key]: CLASSIFICATION_ANALYSIS_LIMITS_V1[key] + 1,
        }),
        key,
      ).toMatchObject({ ok: false, status: "LIMIT_EXCEEDED" });
    }
  });

  it("F30 uses an offline fake with no tool authority and rejects invented evidence", async () => {
    const adapter = new DeterministicClassificationAnalysisAdapter([
      {
        classification: "SINGLE_SKILL",
        roots: ["."],
        confidence: 0.9,
        evidenceIds: ["invented"],
        warnings: [],
        ambiguityCodes: [],
      },
    ]);
    const result = await adapter.classify(baseRequest, baseContext);
    expect(result.run.source).toBe("AI_ASSISTED");
    expect(result.run.providerId).toBe("deterministic-fake");
    expect(result.run.status).toBe("INVALID_OUTPUT");
    expect(expectedEvidence.get("F30")).toMatchObject({
      records: ["analysis-run:hostile-source"],
      decision: "INERT_REJECTED",
      auditStates: [result.run.status],
    });
    expect(adapter).not.toHaveProperty("tools");
  });

  it("rejects unknown request-envelope fields before provider use", () => {
    expect(
      validateAnalysisRequest({ ...baseRequest, authority: "publish" } as never, baseContext),
    ).toEqual({
      ok: false,
      status: "INVALID_OUTPUT",
      reason: "INVALID_ANALYSIS_ENVELOPE",
    });
    expect(
      validateAnalysisRequest({ ...baseRequest, boundedInput: null } as never, baseContext),
    ).toEqual({
      ok: false,
      status: "INVALID_OUTPUT",
      reason: "INVALID_ANALYSIS_ENVELOPE",
    });
  });

  it("binds the envelope snapshot and deterministic analyzer output to the fingerprinted input", () => {
    expect(
      validateAnalysisRequest({ ...baseRequest, sourceSnapshotId: "snapshot-other" }, baseContext),
    ).toMatchObject({
      ok: false,
      reason: "SOURCE_SNAPSHOT_MISMATCH",
    });
    expect(
      validateAnalysisRequest(
        {
          ...baseRequest,
          deterministicResult: { ...baseRequest.deterministicResult, classification: "NON_SKILL" },
        },
        baseContext,
      ),
    ).toMatchObject({ ok: false, reason: "DETERMINISTIC_RESULT_MISMATCH" });
    expect(
      validateAnalysisRequest(
        {
          ...baseRequest,
          deterministicResult: {
            ...baseRequest.deterministicResult,
            candidateRootFingerprints: ["c".repeat(64)],
          },
        },
        baseContext,
      ),
    ).toMatchObject({ ok: false, reason: "DETERMINISTIC_RESULT_MISMATCH" });
  });

  it("requires ordered unique warning and ambiguity codes drawn from the bounded analyzer", async () => {
    const boundedWithCodes = {
      ...boundedInput,
      deterministicAnalyzer: {
        ...boundedInput.deterministicAnalyzer,
        warningCodes: ["WARN_A", "WARN_B"],
        ambiguityReasonCodes: ["AMB_A", "AMB_B"],
      },
    } satisfies BoundedClassificationInputV1;
    const requestWithCodes = {
      ...baseRequest,
      boundedInput: boundedWithCodes,
      boundedInputFingerprint: buildBoundedInputFingerprint(boundedWithCodes).fingerprint,
    };
    for (const response of [
      { warnings: ["WARN_B", "WARN_A"], ambiguityCodes: [] },
      { warnings: ["WARN_A", "WARN_A"], ambiguityCodes: [] },
      { warnings: ["INVENTED"], ambiguityCodes: [] },
      { warnings: [], ambiguityCodes: ["AMB_B", "AMB_A"] },
    ]) {
      const result = await new DeterministicClassificationAnalysisAdapter([
        {
          classification: "SINGLE_SKILL",
          roots: ["."],
          confidence: null,
          evidenceIds: ["e1"],
          ...response,
        },
      ]).classify(requestWithCodes, baseContext);
      expect(result.run.status).toBe("INVALID_OUTPUT");
    }
  });

  it("enforces per-candidate limits from explicit deterministic candidate usage", () => {
    const evidenceIds = Array.from(
      { length: 33 },
      (_, index) => `e${String(index).padStart(2, "0")}`,
    );
    const excerpts = evidenceIds.map((evidenceReferenceId, index) => {
      const excerptUtf8 = `evidence ${String(index)}`;
      const root =
        index < 7
          ? "alpha"
          : index < 14
            ? "beta"
            : index < 21
              ? "delta"
              : index < 27
                ? "epsilon"
                : "gamma";
      return {
        evidenceReferenceId,
        normalizedPath: `${root}/evidence/${String(index)}.md`,
        locator: `line:${String(index + 1)}`,
        utf8ByteLength: Buffer.byteLength(excerptUtf8, "utf8"),
        unicodeScalarLength: Array.from(excerptUtf8).length,
        excerptSha256: createHash("sha256").update(excerptUtf8).digest("hex"),
        excerptUtf8,
      };
    });
    const fingerprints = Array.from({ length: 5 }, (_, index) =>
      (index + 11).toString(16).padStart(64, "0"),
    );
    const bounded = {
      ...boundedInput,
      evidenceReferences: excerpts.map((excerpt, index) => ({
        evidenceReferenceId: excerpt.evidenceReferenceId,
        normalizedPath: excerpt.normalizedPath,
        sourceSnapshotId: "snapshot-1",
        sourceEntryId: `entry-${String(index)}`,
        evidenceKind: "SOURCE_DOCUMENT" as const,
        contentSha256: (index + 1).toString(16).padStart(64, "0"),
        availability: "AVAILABLE" as const,
        usage: "ROOT_SCOPED" as const,
      })),
      excerpts,
      deterministicAnalyzer: {
        ...boundedInput.deterministicAnalyzer,
        inputEvidenceReferenceIds: evidenceIds,
        classification: "MULTIPLE_SKILLS",
        candidateRootFingerprints: fingerprints,
      },
    } satisfies BoundedClassificationInputV1;
    const splitRequest = {
      ...baseRequest,
      boundedInput: bounded,
      boundedInputFingerprint: buildBoundedInputFingerprint(bounded).fingerprint,
      deterministicResult: {
        classification: "MULTIPLE_SKILLS" as const,
        roots: ["alpha", "beta", "delta", "epsilon", "gamma"],
        candidateRootFingerprints: fingerprints,
        candidateUsage: [
          {
            root: "alpha",
            evidenceIds: evidenceIds.slice(0, 7),
            excerptEvidenceIds: evidenceIds.slice(0, 7),
          },
          {
            root: "beta",
            evidenceIds: evidenceIds.slice(7, 14),
            excerptEvidenceIds: evidenceIds.slice(7, 14),
          },
          {
            root: "delta",
            evidenceIds: evidenceIds.slice(14, 21),
            excerptEvidenceIds: evidenceIds.slice(14, 21),
          },
          {
            root: "epsilon",
            evidenceIds: evidenceIds.slice(21, 27),
            excerptEvidenceIds: evidenceIds.slice(21, 27),
          },
          {
            root: "gamma",
            evidenceIds: evidenceIds.slice(27),
            excerptEvidenceIds: evidenceIds.slice(27),
          },
        ],
      },
    };
    const splitContext = {
      sourceSnapshotId: "snapshot-1",
      candidateRoots: splitRequest.deterministicResult.roots.map((normalizedRoot, index) => {
        const candidateRootFingerprint = fingerprints[index];
        if (!candidateRootFingerprint) throw new Error("TEST_FIXTURE_INVALID");
        return { candidateRootFingerprint, normalizedRoot };
      }),
      evidenceReferences: bounded.evidenceReferences,
    } as const;
    const [firstUsage, ...remainingUsage] = splitRequest.deterministicResult.candidateUsage;
    if (!firstUsage) throw new Error("TEST_FIXTURE_INVALID");
    expect(validateAnalysisRequest(splitRequest, splitContext)).toEqual({ ok: true });
    const alphaExcerpts = excerpts.map((excerpt) => ({
      ...excerpt,
      normalizedPath: `alpha/${excerpt.normalizedPath.split("/").at(-1) ?? "evidence.md"}`,
    }));
    const alphaEvidenceReferences = bounded.evidenceReferences.map((evidence) => ({
      ...evidence,
      normalizedPath: `alpha/${evidence.normalizedPath.split("/").at(-1) ?? "evidence.md"}`,
    }));
    const alphaBounded = {
      ...bounded,
      evidenceReferences: alphaEvidenceReferences,
      excerpts: alphaExcerpts,
    };
    const repartitioned = {
      ...splitRequest,
      boundedInput: alphaBounded,
      boundedInputFingerprint: buildBoundedInputFingerprint(alphaBounded).fingerprint,
    };
    expect(validateAnalysisRequest(repartitioned, splitContext)).toMatchObject({
      ok: false,
      reason: "TRUSTED_EVIDENCE_BINDING_MISMATCH",
    });
    expect(
      validateAnalysisRequest(
        {
          ...repartitioned,
          deterministicResult: {
            ...repartitioned.deterministicResult,
            candidateUsage: [
              { root: "alpha", evidenceIds, excerptEvidenceIds: evidenceIds },
              ...repartitioned.deterministicResult.candidateUsage.slice(1).map((usage) => ({
                ...usage,
                evidenceIds: [],
                excerptEvidenceIds: [],
              })),
            ],
          },
        },
        { ...splitContext, evidenceReferences: alphaEvidenceReferences },
      ),
    ).toMatchObject({ ok: false, status: "LIMIT_EXCEEDED" });
    expect(
      validateAnalysisRequest(
        {
          ...splitRequest,
          deterministicResult: {
            ...splitRequest.deterministicResult,
            candidateUsage: [
              {
                ...firstUsage,
                evidenceIds: evidenceIds.slice(1, 7),
                excerptEvidenceIds: evidenceIds.slice(1, 7),
              },
              ...remainingUsage,
            ],
          },
        },
        splitContext,
      ),
    ).toMatchObject({ ok: false, reason: "CANDIDATE_USAGE_INVALID" });
    const forgedRootNames = ["alpha/a", "alpha/b", "alpha/c", "alpha/d", "alpha/e"];
    const forgedRoots = {
      ...splitRequest,
      deterministicResult: {
        ...splitRequest.deterministicResult,
        roots: forgedRootNames,
        candidateUsage: splitRequest.deterministicResult.candidateUsage.map((usage, index) => ({
          ...usage,
          root: forgedRootNames[index] ?? "unbound-root",
        })),
      },
    };
    expect(validateAnalysisRequest(forgedRoots, splitContext)).toMatchObject({
      ok: false,
      reason: "TRUSTED_ROOT_BINDING_MISMATCH",
    });
  });

  it("rejects response tool requests and unknown fields as inert invalid output", async () => {
    const adapter = new DeterministicClassificationAnalysisAdapter([
      {
        classification: "SINGLE_SKILL",
        roots: ["."],
        confidence: null,
        evidenceIds: ["e1"],
        warnings: [],
        ambiguityCodes: [],
        toolRequest: "run shell",
      } as never,
    ]);
    expect((await adapter.classify(baseRequest, baseContext)).run.status).toBe("INVALID_OUTPUT");
    const malformed = new DeterministicClassificationAnalysisAdapter([{} as never]);
    expect((await malformed.classify(baseRequest, baseContext)).run.status).toBe("INVALID_OUTPUT");
  });

  it("permits one bounded repair within two provider attempts", async () => {
    const invalid = {
      classification: "SINGLE_SKILL" as const,
      roots: ["."],
      confidence: null,
      evidenceIds: ["invented"],
      warnings: [],
      ambiguityCodes: [],
    };
    const valid = { ...invalid, evidenceIds: ["e1"] };
    const result = await new DeterministicClassificationAnalysisAdapter([invalid, valid]).classify(
      baseRequest,
      baseContext,
    );
    expect(result.run).toMatchObject({
      status: "SUCCEEDED",
      repairCount: 1,
      providerAttemptCount: 2,
      validationOutcome: "VALID",
    });
  });

  it("fails closed at per-attempt and total timeout ceilings", async () => {
    const valid = {
      classification: "SINGLE_SKILL" as const,
      roots: ["."],
      confidence: null,
      evidenceIds: ["e1"],
      warnings: [],
      ambiguityCodes: [],
    };
    const result = await new DeterministicClassificationAnalysisAdapter(
      [valid, valid],
      () => false,
      () => undefined,
      [30_001, 30_001],
    ).classify(baseRequest, baseContext);
    expect(result.run).toMatchObject({ status: "TIMED_OUT", providerAttemptCount: 2 });
    expect(result.reconciled).toBeNull();
  });

  it("cancellation after the fake call prevents reconciliation writes", async () => {
    let cancelled = false;
    const adapter = new DeterministicClassificationAnalysisAdapter(
      [
        {
          classification: "SINGLE_SKILL",
          roots: ["."],
          confidence: null,
          evidenceIds: ["e1"],
          warnings: [],
          ambiguityCodes: [],
        },
      ],
      () => cancelled,
      () => {
        cancelled = true;
      },
    );
    const result = await adapter.classify(baseRequest, baseContext);
    expect(result.run.status).toBe("SUCCEEDED");
    expect(result.reconciled).toBeNull();
    expect(result.cancelled).toBe(true);
  });
});
