import { describe, expect, it } from "vitest";

import {
  AnalysisConfigurationV1Schema,
  ExpectedPredecessorStateV1Schema,
  ExtractionCommandResultV1Schema,
  ExtractionRequestV1Schema,
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_FIELD_KEYS,
  M03_POLICY_VERSIONS,
  M03_WARNING_CODES,
  PositiveBigIntSchema,
} from "./index.js";

const sha = "a".repeat(64);

const expectedPredecessorState = {
  mutableRecordVersions: {
    acquisitionJob: "1",
    controllingM02Job: "2",
    handoffMarker: "3",
    candidate: "4",
    resourceIdentity: "5",
    resourceVersionIdentity: "6",
    resourceSourceLink: "7",
    sourceRepositoryIdentity: "8",
    identityDecision: "9",
    candidateReviewState: "10",
    candidateRoot: "11",
  },
  fingerprintExpectations: {
    sourceSnapshot: sha,
    acquisitionResult: sha,
    resourceVersionObservation: sha,
    ownershipTopology: sha,
    reviewStateSet: sha,
    providerMetadata: sha,
  },
};

describe("M03 closed contracts", () => {
  it("freezes the exact field, warning, and analysis-operation registries", () => {
    expect(M03_FIELD_KEYS).toHaveLength(20);
    expect(M03_FIELD_KEYS[0]).toBe("canonical_skill_name");
    expect(M03_FIELD_KEYS.at(-1)).toBe("maintenance_signals");
    expect(M03_WARNING_CODES).toHaveLength(29);
    expect(M03_ANALYSIS_SUB_OPERATIONS).toHaveLength(9);
    expect(new Set(M03_FIELD_KEYS).size).toBe(20);
  });

  it("accepts only canonical positive bigint strings and the complete predecessor key set", () => {
    expect(PositiveBigIntSchema.safeParse("9007199254740993").success).toBe(true);
    for (const invalid of ["0", "01", "+1", "-1", "1.0", 1]) {
      expect(PositiveBigIntSchema.safeParse(invalid).success).toBe(false);
    }
    expect(ExpectedPredecessorStateV1Schema.safeParse(expectedPredecessorState).success).toBe(true);
    expect(
      ExpectedPredecessorStateV1Schema.safeParse({
        ...expectedPredecessorState,
        mutableRecordVersions: {
          ...expectedPredecessorState.mutableRecordVersions,
          extra: "12",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts only disabled analysis or the exact deterministic fake tuple", () => {
    expect(
      AnalysisConfigurationV1Schema.safeParse({
        mode: "DISABLED",
        operation: "NORMALIZE_STRUCTURED_EXTRACTION",
        providerAdapterNameOrNull: null,
        providerAdapterVersionOrNull: null,
        providerNameOrNull: null,
        modelNameOrNull: null,
        deterministicSettings: {},
        subOperationPlan: [],
      }).success,
    ).toBe(true);

    const enabled = {
      mode: "ENABLED",
      operation: "NORMALIZE_STRUCTURED_EXTRACTION",
      providerAdapterNameOrNull: "deterministic-fake",
      providerAdapterVersionOrNull: "1.0.0",
      providerNameOrNull: "offline-fake",
      modelNameOrNull: "m03-fixture-v1",
      deterministicSettings: {
        temperature: 0,
        topP: 1,
        seedOrNull: 0,
        maxOutputTokens: 4096,
        responseFormat: "JSON_SCHEMA",
        toolChoice: "NONE",
      },
      subOperationPlan: M03_ANALYSIS_SUB_OPERATIONS,
    } as const;
    expect(AnalysisConfigurationV1Schema.safeParse(enabled).success).toBe(true);
    for (const maxOutputTokens of [1, 16_384]) {
      expect(
        AnalysisConfigurationV1Schema.safeParse({
          ...enabled,
          deterministicSettings: { ...enabled.deterministicSettings, maxOutputTokens },
        }).success,
      ).toBe(true);
    }
    for (const maxOutputTokens of [0, 16_385]) {
      expect(
        AnalysisConfigurationV1Schema.safeParse({
          ...enabled,
          deterministicSettings: { ...enabled.deterministicSettings, maxOutputTokens },
        }).success,
      ).toBe(false);
    }
    expect(
      AnalysisConfigurationV1Schema.safeParse({ ...enabled, modelNameOrNull: "other" }).success,
    ).toBe(false);
  });

  it("rejects request policy drift and extra envelope keys", () => {
    const request = {
      schemaVersion: "M03_EXTRACTION_V1",
      requestId: "req-1",
      idempotencyKey: "idem-1",
      m02HandoffMarkerId: "handoff-1",
      controllingM02JobId: "job-1",
      identityDecisionId: "decision-1",
      m02ReviewStateId: "review-1",
      resourceCandidateId: "candidate-1",
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-identity-1",
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "source-link-1",
      sourceRepositoryId: "repository-1",
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
      candidateRootId: "root-1",
      candidateRootFingerprint: sha,
      candidateContentFingerprint: sha,
      expectedPredecessorState,
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
    } as const;
    expect(ExtractionRequestV1Schema.safeParse(request).success).toBe(true);
    expect(
      ExtractionRequestV1Schema.safeParse({
        ...request,
        policyVersions: { ...request.policyVersions, fieldRegistryVersion: "drift" },
      }).success,
    ).toBe(false);
    expect(ExtractionRequestV1Schema.safeParse({ ...request, extra: true }).success).toBe(false);
  });

  it("exports the closed command-result arms and error partitions", () => {
    const requestFingerprint = "b".repeat(64);
    expect(
      ExtractionCommandResultV1Schema.safeParse({
        kind: "INVALID_REQUEST",
        rawRequestDigest: sha,
        errorCode: "REQUEST_SCHEMA_INVALID",
        safeContext: { phase: "REQUEST_VALIDATION" },
      }).success,
    ).toBe(true);
    const safeContext = {
      phase: "ELIGIBILITY",
      requestId: "req-1",
      handoffMarkerIdOrNull: "handoff-1",
      resourceCandidateIdOrNull: "candidate-1",
      resourceVersionObservationIdOrNull: "observation-1",
      fieldKeyOrNull: null,
      recordKindOrNull: null,
      expectedVersionOrNull: null,
      actualVersionOrNull: null,
      expectedFingerprintOrNull: null,
      actualFingerprintOrNull: null,
      limitNameOrNull: null,
      limitOrNull: null,
      observedOrNull: null,
    } as const;
    expect(
      ExtractionCommandResultV1Schema.safeParse({
        kind: "REJECTED",
        requestFingerprint,
        errorCode: "EXPECTED_VERSION_SET_INVALID",
        safeContext,
      }).success,
    ).toBe(true);
    expect(
      ExtractionCommandResultV1Schema.safeParse({
        kind: "REJECTED",
        requestFingerprint,
        errorCode: "SOURCE_REFERENCE_INVALID",
        safeContext,
      }).success,
    ).toBe(false);
  });
});
