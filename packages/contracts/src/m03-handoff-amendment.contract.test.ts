import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BasicExtractionRequestV1Schema,
  BasicExtractionRequestV2Schema,
  ExtractionRequestV1Schema,
  ExtractionRequestV2Schema,
  M03M02InputProjectionV1Schema,
  M03_POLICY_VERSIONS,
  canonicalJsonM03,
  fingerprintM03M02InputProjectionV1,
} from "./index.js";

const sha = "a".repeat(64);
const revision = "b".repeat(40);

function projection() {
  return {
    handoff: {
      id: "handoff-1",
      resourceCandidateId: "candidate-1",
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      controllingM02JobId: "job-1",
      sourceSnapshotId: "snapshot-1",
      identityDecisionId: "decision-1",
      originType: "SYSTEM_IDENTITY_OPERATION",
      logicalKey: "candidate-1:job-1",
      state: "ACTIVE",
      recordVersion: "1",
    },
    acquisitionJob: {
      id: "job-1",
      status: "COMPLETED",
      currentStage: "INVENTORYING_SOURCE",
      sourceSnapshotId: "snapshot-1",
      cancellationRequested: false,
      recordVersion: "1",
    },
    m02Job: {
      id: "job-1",
      jobLineageId: "lineage-1",
      sourceSnapshotId: "snapshot-1",
      operationScope: "FULL_PIPELINE",
      currentStage: "RESOLVING_IDENTITY",
      reviewState: "RESOLVED",
      supersessionState: "CONTROLLING",
      supersededByJobIdOrNull: null,
      supersessionSequence: "1",
      controllingClassificationDecisionIdOrNull: "run-1",
      jobScopeKey: sha,
      inputFingerprint: sha,
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      analysisPolicyVersion: "analysis-v1",
      parserProfileVersion: "parser-v1",
      promptBundleVersion: "prompt-v1",
      analysisProviderAdapterIdOrNull: null,
      analysisModelIdOrNull: null,
      analysisMethodologyVersionOrNull: null,
      recordVersion: "1",
      replacement: {
        kind: "ORIGINAL",
        reasonCodeOrNull: null,
        inputPayloadOrNull: null,
        inputFingerprintOrNull: null,
        sourceJobIdOrNull: null,
        sourceOperationScopeOrNull: null,
        requestedOperationScopeOrNull: null,
        predecessorJobIds: [],
        originalSourceSnapshotIdOrNull: null,
        replacementSourceSnapshotIdOrNull: null,
      },
    },
    candidate: {
      id: "candidate-1",
      sourceSnapshotId: "snapshot-1",
      candidateRootId: "root-1",
      candidateRootFingerprint: sha,
      candidateContentFingerprint: sha,
      reconciledClassificationRunId: "run-1",
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      identityOutcome: "NEW_RESOURCE",
      status: "IDENTITY_RESOLVED",
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      recordVersion: "1",
    },
    resourceIdentity: {
      id: "resource-1",
      resourceType: "SKILL",
      status: "ACTIVE",
      reliableIdentityTokenOrNull: "demo-skill",
      reliableTokenEvidenceIdOrNull: "evidence-1",
      guardAnchorCandidateId: "candidate-1",
      recordVersion: "1",
    },
    resourceVersionIdentity: {
      id: "version-1",
      resourceIdentityId: "resource-1",
      contentFingerprint: sha,
      firstObservedSourceSnapshotId: "snapshot-1",
      firstObservedCandidateRootId: "root-1",
      firstObservedSourceRevision: revision,
      observationLabel: "snapshot:aaaaaaaaaaaa",
      status: "IDENTITY_RESOLVED",
      recordVersion: "1",
    },
    observation: {
      id: "observation-1",
      resourceVersionIdentityId: "version-1",
      sourceSnapshotId: "snapshot-1",
      candidateRootId: "root-1",
      resourceSourceLinkId: "link-1",
      sourceRepositoryId: "repository-1",
      provider: "github",
      providerRepositoryId: "repo-1",
      normalizedRootPath: ".",
      immutableRevision: revision,
      observedAt: "2026-01-01T00:00:00.000Z",
    },
    sourceLink: {
      id: "link-1",
      sourceRepositoryId: "repository-1",
      normalizedRootPath: ".",
      targetResourceVersionId: "version-1",
      relationship: "PRIMARY",
      decisionId: "decision-1",
      state: "ACTIVE",
      recordVersion: "1",
    },
    sourceRepository: {
      id: "repository-1",
      provider: "github",
      providerRepositoryId: "repo-1",
      firstObservedSourceSnapshotId: "snapshot-1",
      recordVersion: "1",
    },
    identityDecision: {
      id: "decision-1",
      resourceCandidateId: "candidate-1",
      outcome: "NEW_RESOURCE",
      matchedTierOrNull: "P1",
      confidenceOrNull: 1,
      identityPolicyVersion: "identity-v1",
      decisionSource: "DETERMINISTIC",
      state: "ACTIVE",
      recordVersion: "1",
    },
    candidateReviewState: {
      id: "review-1",
      groupIdOrNull: "group-1",
      resourceCandidateId: "candidate-1",
      reviewState: "RESOLVED",
      supersededByReviewIdOrNull: null,
      recordVersion: "1",
    },
    candidateRoot: {
      id: "root-1",
      groupId: "group-1",
      classificationRunId: "run-1",
      sourceSnapshotId: "snapshot-1",
      normalizedRootPath: ".",
      candidateRootFingerprint: sha,
      candidateContentFingerprint: sha,
      state: "ACTIVE",
      recordVersion: "1",
    },
  } as const;
}

function mutatePath(value: unknown, path: readonly string[], replacement: unknown): unknown {
  if (path.length === 0) return replacement;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid mutation path");
  const [head, ...tail] = path;
  if (head === undefined) return replacement;
  return {
    ...(value as Record<string, unknown>),
    [head]: mutatePath((value as Record<string, unknown>)[head], tail, replacement),
  };
}

function leafPaths(value: unknown, prefix: readonly string[] = []): string[][] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [[...prefix]];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    leafPaths(nested, [...prefix, key]),
  );
}

function omitPath(value: unknown, path: readonly string[]): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value) || path.length === 0)
    throw new Error("invalid omission path");
  const [head, ...tail] = path;
  if (head === undefined) throw new Error("invalid omission path");
  const copy =
    tail.length === 0
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).filter(([key]) => key !== head),
        )
      : { ...(value as Record<string, unknown>) };
  if (tail.length !== 0) copy[head] = omitPath(copy[head], tail);
  return copy;
}

describe("M03/M04 handoff amendment contracts", () => {
  it("accepts the complete strict internally consistent M02 projection", () => {
    expect(M03M02InputProjectionV1Schema.safeParse(projection()).success).toBe(true);
  });

  it("rejects every tested cross-row projection mismatch", () => {
    const valid = projection();
    const mutations = [
      { ...valid, acquisitionJob: { ...valid.acquisitionJob, id: "other-job" } },
      { ...valid, m02Job: { ...valid.m02Job, sourceSnapshotId: "other-snapshot" } },
      { ...valid, candidate: { ...valid.candidate, identityOutcome: "MIRROR" } },
      { ...valid, sourceLink: { ...valid.sourceLink, normalizedRootPath: "other" } },
      { ...valid, identityDecision: { ...valid.identityDecision, state: "SUPERSEDED" } },
    ];
    for (const mutation of mutations) {
      expect(M03M02InputProjectionV1Schema.safeParse(mutation).success).toBe(false);
    }
  });

  it("rejects partial analysis provenance and non-normalized reliable tokens", () => {
    const valid = projection();
    expect(
      M03M02InputProjectionV1Schema.safeParse({
        ...valid,
        m02Job: { ...valid.m02Job, analysisProviderAdapterIdOrNull: "adapter" },
      }).success,
    ).toBe(false);
    expect(
      M03M02InputProjectionV1Schema.safeParse({
        ...valid,
        resourceIdentity: {
          ...valid.resourceIdentity,
          reliableIdentityTokenOrNull: "Not Normalized!",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only an exact canonical replacement-job payload and hash", () => {
    const valid = projection();
    const replacementInput = {
      schemaVersion: "1",
      jobLineageId: valid.m02Job.jobLineageId,
      sourceJobId: "source-job-1",
      sourceOperationScope: "IDENTITY_RESOLUTION",
      requestedOperationScope: valid.m02Job.operationScope,
      predecessorJobIds: ["predecessor-a", "predecessor-b"],
      sourceSnapshotId: "snapshot-0",
      replacementSourceSnapshotIdOrNull: valid.m02Job.sourceSnapshotId,
      classificationPolicyVersion: valid.m02Job.classificationPolicyVersion,
      identityPolicyVersion: valid.m02Job.identityPolicyVersion,
      analysisPolicyVersion: valid.m02Job.analysisPolicyVersion,
      parserProfileVersion: valid.m02Job.parserProfileVersion,
      promptBundleVersion: valid.m02Job.promptBundleVersion,
      analysisProviderAdapterIdOrNull: valid.m02Job.analysisProviderAdapterIdOrNull,
      analysisModelIdOrNull: valid.m02Job.analysisModelIdOrNull,
      analysisMethodologyVersionOrNull: valid.m02Job.analysisMethodologyVersionOrNull,
      controllingClassificationDecisionIdOrNull:
        valid.m02Job.controllingClassificationDecisionIdOrNull,
    } as const;
    const payload = Buffer.from(canonicalJsonM03(replacementInput));
    const replacement = {
      kind: "REPLACEMENT" as const,
      reasonCode: "NEW_SUPPORTED_SNAPSHOT" as const,
      inputPayloadOrNull: { byteLength: payload.byteLength, base64: payload.toString("base64") },
      inputFingerprintOrNull: createHash("sha256").update(payload).digest("hex"),
      sourceJobIdOrNull: replacementInput.sourceJobId,
      sourceOperationScopeOrNull: replacementInput.sourceOperationScope,
      requestedOperationScopeOrNull: replacementInput.requestedOperationScope,
      predecessorJobIds: replacementInput.predecessorJobIds,
      originalSourceSnapshotIdOrNull: replacementInput.sourceSnapshotId,
      replacementSourceSnapshotIdOrNull: replacementInput.replacementSourceSnapshotIdOrNull,
    };
    const candidate = { ...valid, m02Job: { ...valid.m02Job, replacement } };
    expect(M03M02InputProjectionV1Schema.safeParse(candidate).success).toBe(true);
    expect(
      M03M02InputProjectionV1Schema.safeParse({
        ...candidate,
        m02Job: {
          ...candidate.m02Job,
          replacement: {
            ...replacement,
            predecessorJobIds: [...replacement.predecessorJobIds].reverse(),
          },
        },
      }).success,
    ).toBe(false);
    expect(
      M03M02InputProjectionV1Schema.safeParse({
        ...candidate,
        m02Job: {
          ...candidate.m02Job,
          replacement: { ...replacement, inputFingerprintOrNull: "f".repeat(64) },
        },
      }).success,
    ).toBe(false);
  });

  it("fails closed when any required scalar projection member is omitted", () => {
    const valid = projection();
    for (const path of leafPaths(valid))
      expect(
        M03M02InputProjectionV1Schema.safeParse(omitPath(valid, path)).success,
        path.join("."),
      ).toBe(false);
  });

  it("enforces every internal equality and eligibility predicate", () => {
    const mutations: readonly [readonly string[], unknown][] = [
      [["handoff", "resourceCandidateId"], "different"],
      [["handoff", "resourceIdentityId"], "different"],
      [["handoff", "resourceVersionIdentityId"], "different"],
      [["handoff", "controllingM02JobId"], "different"],
      [["handoff", "identityDecisionId"], "different"],
      [["handoff", "sourceSnapshotId"], "different"],
      [["candidate", "candidateRootId"], "different"],
      [["candidate", "candidateRootFingerprint"], "b".repeat(64)],
      [["candidate", "reconciledClassificationRunId"], "different"],
      [["candidate", "classificationPolicyVersion"], "different"],
      [["candidate", "identityPolicyVersion"], "different"],
      [["candidate", "candidateContentFingerprint"], "b".repeat(64)],
      [["resourceVersionIdentity", "resourceIdentityId"], "different"],
      [["observation", "resourceVersionIdentityId"], "different"],
      [["observation", "resourceSourceLinkId"], "different"],
      [["observation", "sourceRepositoryId"], "different"],
      [["observation", "normalizedRootPath"], "different"],
      [["observation", "providerRepositoryId"], "different"],
      [["sourceLink", "decisionId"], "different"],
      [["identityDecision", "resourceCandidateId"], "different"],
      [["candidateReviewState", "resourceCandidateId"], "different"],
      [["acquisitionJob", "id"], "different"],
      [["acquisitionJob", "sourceSnapshotId"], "different"],
      [["m02Job", "controllingClassificationDecisionIdOrNull"], null],
      [["identityDecision", "outcome"], "MIRROR"],
      [["handoff", "state"], "SUPERSEDED"],
      [["acquisitionJob", "status"], "ACTIVE"],
      [["acquisitionJob", "cancellationRequested"], true],
      [["m02Job", "supersessionState"], "SUPERSEDED"],
      [["candidate", "status"], "CLASSIFIED"],
      [["resourceIdentity", "status"], "AMBIGUOUS"],
      [["resourceVersionIdentity", "status"], "SUPERSEDED"],
      [["sourceLink", "state"], "SUPERSEDED"],
      [["identityDecision", "state"], "SUPERSEDED"],
      [["candidateReviewState", "reviewState"], "IDENTITY_REVIEW_REQUIRED"],
      [["candidateReviewState", "supersededByReviewIdOrNull"], "other-review"],
      [["candidateRoot", "state"], "SUPERSEDED"],
    ];
    for (const [path, replacement] of mutations)
      expect(
        M03M02InputProjectionV1Schema.safeParse(mutatePath(projection(), path, replacement))
          .success,
        path.join("."),
      ).toBe(false);
  });

  it("fingerprints canonical projection bytes independent of object insertion order", () => {
    const valid = M03M02InputProjectionV1Schema.parse(projection());
    const reversed = Object.fromEntries(Object.entries(valid).reverse());
    expect(fingerprintM03M02InputProjectionV1(M03M02InputProjectionV1Schema.parse(reversed))).toBe(
      fingerprintM03M02InputProjectionV1(valid),
    );
    const changed = M03M02InputProjectionV1Schema.parse(
      mutatePath(valid, ["m02Job", "jobLineageId"], "lineage-2"),
    );
    expect(fingerprintM03M02InputProjectionV1(changed)).not.toBe(
      fingerprintM03M02InputProjectionV1(valid),
    );
  });

  it.each([
    ["ordinary identifier", "request-1"],
    ["historical unpaired high surrogate", "\ud800"],
    ["historical unpaired low surrogate", "\udc00"],
  ])("preserves V1 and literal-only V2 request compatibility: %s", (_name, requestId) => {
    const request = {
      schemaVersion: "M03_EXTRACTION_REQUEST_V2",
      requestId,
      idempotencyKey: "key-1",
      m02HandoffMarkerId: "handoff-1",
      controllingM02JobId: "job-1",
      identityDecisionId: "decision-1",
      m02ReviewStateId: "review-1",
      resourceCandidateId: "candidate-1",
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "link-1",
      sourceRepositoryId: "repository-1",
      sourceSnapshotId: "snapshot-1",
      sourceRevision: revision,
      candidateRootId: "root-1",
      candidateRootFingerprint: sha,
      candidateContentFingerprint: sha,
      expectedPredecessorState: {
        mutableRecordVersions: Object.fromEntries(
          [
            "acquisitionJob",
            "controllingM02Job",
            "handoffMarker",
            "candidate",
            "resourceIdentity",
            "resourceVersionIdentity",
            "resourceSourceLink",
            "sourceRepositoryIdentity",
            "identityDecision",
            "candidateReviewState",
            "candidateRoot",
          ].map((key) => [key, "1"]),
        ),
        fingerprintExpectations: Object.fromEntries(
          [
            "sourceSnapshot",
            "acquisitionResult",
            "resourceVersionObservation",
            "ownershipTopology",
            "reviewStateSet",
            "providerMetadata",
          ].map((key) => [key, sha]),
        ),
      },
      policyVersions: M03_POLICY_VERSIONS,
      analysisConfiguration: {
        mode: "DISABLED",
        operation: "NORMALIZE_STRUCTURED_EXTRACTION",
        providerAdapterNameOrNull: null,
        providerAdapterVersionOrNull: null,
        providerNameOrNull: null,
        modelNameOrNull: null,
        deterministicSettings: {},
        subOperationPlan: [],
      },
      analysisConfigurationFingerprint: sha,
    };
    expect(ExtractionRequestV2Schema.safeParse(request).success).toBe(true);
    const historical = { ...request, schemaVersion: "M03_EXTRACTION_V1" };
    expect(ExtractionRequestV1Schema.safeParse(historical).success).toBe(true);
    expect(
      BasicExtractionRequestV1Schema.safeParse({
        ...historical,
        expectedPredecessorState: null,
      }).success,
    ).toBe(true);
    expect(
      BasicExtractionRequestV2Schema.safeParse({
        ...request,
        expectedPredecessorState: null,
      }).success,
    ).toBe(true);
    expect(ExtractionRequestV1Schema.safeParse(request).success).toBe(false);
    expect(ExtractionRequestV2Schema.safeParse(historical).success).toBe(false);
  });
});
