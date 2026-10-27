import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { DeterministicM03AnalysisAdapter } from "@ai-ark/analysis";
import {
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_POLICY_VERSIONS,
  StructuredExtractionBundleV2Schema,
  textKey,
  type StructuredExtractionBundleV2,
} from "@ai-ark/contracts";
import {
  InMemoryM03Orchestrator,
  canonicalJson,
  createExtractorRegistry,
  extractDeterministic,
  fingerprintAnalysisConfiguration,
  type M03EligibilitySnapshot,
  type M03PolicyArtifacts,
  type M03SourceSnapshot,
} from "@ai-ark/extraction";
import type { M03M02InputProjectionV1 } from "@ai-ark/contracts";

const SHA = "a".repeat(64);
const CONTENT_SHA = "c".repeat(64);
const SOURCE_REVISION = "b".repeat(40);

export const M03_GENUINE_FIXTURE_IDS = {
  acquisitionJobId: "job-1",
  controllingM02JobId: "job-1",
  handoffMarkerId: "handoff-1",
  candidateId: "candidate-1",
  resourceIdentityId: "resource-existing",
  resourceVersionIdentityId: "version-prior",
  resourceSourceLinkId: "source-link-1",
  sourceRepositoryIdentityId: "source-main",
  identityDecisionId: "decision-seed",
  candidateReviewStateId: "review-1",
  candidateRootId: "root-1",
  resourceVersionObservationId: "observation-1",
  sourceSnapshotId: "snapshot-m04",
  sourceEntryId: "entry-m04",
  sourceDocumentId: "document-m04",
  sourceRevision: SOURCE_REVISION,
} as const;

export const M03_GENUINE_FIXTURE_TIMESTAMPS = {
  acquiredAt: "2026-01-01T00:00:00.000Z",
  acquisitionResultCreatedAt: "2026-01-01T00:00:01.000Z",
  observedAt: "2026-01-01T00:00:02.000Z",
} as const;

export const M03_GENUINE_PROVIDER_METADATA = {
  repositoryMetadata: {
    name: "demo",
    owner: "ExampleOrg",
    description: null,
    archived: false,
    visibility: "PUBLIC",
  },
  releaseSignals: { tags: [], latestRelease: null },
  licenseSignals: { spdxId: null, source: null },
  forkSignals: { isFork: false, parentCanonicalUrl: null },
} as const;

export const M03_GENUINE_ACQUISITION_RESULT = M03_GENUINE_PROVIDER_METADATA;

const fixtureFingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export const M03_GENUINE_EXPECTED_PREDECESSOR_STATE = {
  mutableRecordVersions: {
    acquisitionJob: "1",
    controllingM02Job: "1",
    handoffMarker: "1",
    candidate: "1",
    resourceIdentity: "1",
    resourceVersionIdentity: "1",
    resourceSourceLink: "1",
    sourceRepositoryIdentity: "1",
    identityDecision: "1",
    candidateReviewState: "1",
    candidateRoot: "1",
  },
  fingerprintExpectations: {
    sourceSnapshot: fixtureFingerprint({
      id: M03_GENUINE_FIXTURE_IDS.sourceSnapshotId,
      identityKey: "m04-key",
      provider: "github",
      providerRepositoryId: "repo-1",
      immutableRevision: SOURCE_REVISION,
      acquisitionPolicyVersion: "acquisition-v1",
      acquiredAt: M03_GENUINE_FIXTURE_TIMESTAMPS.acquiredAt,
    }),
    acquisitionResult: fixtureFingerprint({
      jobId: M03_GENUINE_FIXTURE_IDS.acquisitionJobId,
      sourceSnapshotId: M03_GENUINE_FIXTURE_IDS.sourceSnapshotId,
      result: M03_GENUINE_ACQUISITION_RESULT,
      createdAt: M03_GENUINE_FIXTURE_TIMESTAMPS.acquisitionResultCreatedAt,
    }),
    resourceVersionObservation: fixtureFingerprint({
      id: M03_GENUINE_FIXTURE_IDS.resourceVersionObservationId,
      resourceVersionIdentityId: M03_GENUINE_FIXTURE_IDS.resourceVersionIdentityId,
      sourceSnapshotId: M03_GENUINE_FIXTURE_IDS.sourceSnapshotId,
      candidateRootId: M03_GENUINE_FIXTURE_IDS.candidateRootId,
      resourceSourceLinkId: M03_GENUINE_FIXTURE_IDS.resourceSourceLinkId,
      sourceRepositoryId: M03_GENUINE_FIXTURE_IDS.sourceRepositoryIdentityId,
      provider: "github",
      providerRepositoryId: "repo-1",
      normalizedRootPath: ".",
      immutableRevision: SOURCE_REVISION,
      observedAt: M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt,
    }),
    ownershipTopology: fixtureFingerprint({
      ownershipRows: [
        {
          id: "ownership-1",
          candidateRootId: M03_GENUINE_FIXTURE_IDS.candidateRootId,
          sourceSnapshotId: M03_GENUINE_FIXTURE_IDS.sourceSnapshotId,
          sourceEntryId: M03_GENUINE_FIXTURE_IDS.sourceEntryId,
          ownership: "OWNED",
        },
      ],
      rootOrderRows: [
        {
          id: "root-order-1",
          groupId: "group-1",
          classificationRunId: "run-1",
          candidateRootId: M03_GENUINE_FIXTURE_IDS.candidateRootId,
          sourceSnapshotId: M03_GENUINE_FIXTURE_IDS.sourceSnapshotId,
          rootOrdinal: 0,
        },
      ],
    }),
    reviewStateSet: fixtureFingerprint([
      {
        id: M03_GENUINE_FIXTURE_IDS.candidateReviewStateId,
        groupIdOrNull: "group-1",
        resourceCandidateIdOrNull: M03_GENUINE_FIXTURE_IDS.candidateId,
        reviewState: "RESOLVED",
        recordVersion: "1",
        supersededByReviewIdOrNull: null,
      },
    ]),
    providerMetadata: fixtureFingerprint(M03_GENUINE_PROVIDER_METADATA),
  },
} as const;

function policyArtifacts(): M03PolicyArtifacts {
  const specification = readFileSync(
    new URL("../../../docs/milestones/M03_SPEC.md", import.meta.url),
    "utf8",
  );
  const between = (begin: string, end: string): string => {
    const beginIndex = specification.indexOf(begin);
    const start = specification.indexOf("\n", beginIndex) + 1;
    const endIndex = specification.indexOf(end, start);
    if (beginIndex < 0 || start <= 0 || endIndex < 0) throw new Error("M03_ARTIFACT_NOT_FOUND");
    return specification.slice(
      start,
      specification[endIndex - 1] === "\n" ? endIndex - 1 : endIndex,
    );
  };
  const fieldBlock = between(
    "<!-- M03_FIELD_REGISTRY_V1_BEGIN -->",
    "<!-- M03_FIELD_REGISTRY_V1_END -->",
  );
  // RegExp.exec is intentionally avoided because the acquired-source safety scanner rejects it.
  // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec
  const match = fieldBlock.match(/```json\n([\s\S]*?)\n```/u);
  return {
    policyLiteral: between(
      "<!-- M03_POLICY_ARTIFACT_V1_BEGIN -->",
      "<!-- M03_POLICY_ARTIFACT_V1_END -->",
    ),
    fieldRegistry: JSON.stringify(JSON.parse(match?.[1] ?? "null")),
    taxonomyRegistry: "[]",
  };
}

function m02Projection(): M03M02InputProjectionV1 {
  const ids = M03_GENUINE_FIXTURE_IDS;
  return {
    handoff: {
      id: ids.handoffMarkerId,
      resourceCandidateId: ids.candidateId,
      resourceIdentityId: ids.resourceIdentityId,
      resourceVersionIdentityId: ids.resourceVersionIdentityId,
      controllingM02JobId: ids.controllingM02JobId,
      sourceSnapshotId: ids.sourceSnapshotId,
      identityDecisionId: ids.identityDecisionId,
      originType: "HUMAN_COMMAND",
      logicalKey: "handoff-key",
      state: "ACTIVE",
      recordVersion: "1",
    },
    acquisitionJob: {
      id: ids.acquisitionJobId,
      status: "COMPLETED",
      currentStage: "INVENTORYING_SOURCE",
      sourceSnapshotId: ids.sourceSnapshotId,
      cancellationRequested: false,
      recordVersion: "1",
    },
    m02Job: {
      id: ids.controllingM02JobId,
      jobLineageId: "lineage-normal",
      sourceSnapshotId: ids.sourceSnapshotId,
      operationScope: "FULL_PIPELINE",
      currentStage: "RESOLVING_IDENTITY",
      reviewState: "RESOLVED",
      supersessionState: "CONTROLLING",
      supersededByJobIdOrNull: null,
      supersessionSequence: "1",
      controllingClassificationDecisionIdOrNull: "run-1",
      jobScopeKey: SHA,
      inputFingerprint: SHA,
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
      id: ids.candidateId,
      sourceSnapshotId: ids.sourceSnapshotId,
      candidateRootId: ids.candidateRootId,
      candidateRootFingerprint: SHA,
      candidateContentFingerprint: CONTENT_SHA,
      reconciledClassificationRunId: "run-1",
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      identityOutcome: "NEW_RESOURCE",
      status: "IDENTITY_RESOLVED",
      resourceIdentityId: ids.resourceIdentityId,
      resourceVersionIdentityId: ids.resourceVersionIdentityId,
      recordVersion: "1",
    },
    resourceIdentity: {
      id: ids.resourceIdentityId,
      resourceType: "SKILL",
      status: "ACTIVE",
      reliableIdentityTokenOrNull: null,
      reliableTokenEvidenceIdOrNull: null,
      guardAnchorCandidateId: ids.candidateId,
      recordVersion: "1",
    },
    resourceVersionIdentity: {
      id: ids.resourceVersionIdentityId,
      resourceIdentityId: ids.resourceIdentityId,
      contentFingerprint: CONTENT_SHA,
      firstObservedSourceSnapshotId: ids.sourceSnapshotId,
      firstObservedCandidateRootId: ids.candidateRootId,
      firstObservedSourceRevision: ids.sourceRevision,
      observationLabel: "snapshot:000000000001",
      status: "IDENTITY_RESOLVED",
      recordVersion: "1",
    },
    observation: {
      id: ids.resourceVersionObservationId,
      resourceVersionIdentityId: ids.resourceVersionIdentityId,
      sourceSnapshotId: ids.sourceSnapshotId,
      candidateRootId: ids.candidateRootId,
      resourceSourceLinkId: ids.resourceSourceLinkId,
      sourceRepositoryId: ids.sourceRepositoryIdentityId,
      provider: "github",
      providerRepositoryId: "repo-1",
      normalizedRootPath: ".",
      immutableRevision: ids.sourceRevision,
      observedAt: M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt,
    },
    sourceLink: {
      id: ids.resourceSourceLinkId,
      sourceRepositoryId: ids.sourceRepositoryIdentityId,
      normalizedRootPath: ".",
      targetResourceVersionId: ids.resourceVersionIdentityId,
      relationship: "PRIMARY",
      decisionId: ids.identityDecisionId,
      state: "ACTIVE",
      recordVersion: "1",
    },
    sourceRepository: {
      id: ids.sourceRepositoryIdentityId,
      provider: "github",
      providerRepositoryId: "repo-1",
      firstObservedSourceSnapshotId: "snapshot-1",
      recordVersion: "1",
    },
    identityDecision: {
      id: ids.identityDecisionId,
      resourceCandidateId: ids.candidateId,
      outcome: "NEW_RESOURCE",
      matchedTierOrNull: null,
      confidenceOrNull: 1,
      identityPolicyVersion: "identity-v1",
      decisionSource: "HUMAN_COMMAND",
      state: "ACTIVE",
      recordVersion: "1",
    },
    candidateReviewState: {
      id: ids.candidateReviewStateId,
      groupIdOrNull: "group-1",
      resourceCandidateId: ids.candidateId,
      reviewState: "RESOLVED",
      supersededByReviewIdOrNull: null,
      recordVersion: "1",
    },
    candidateRoot: {
      id: ids.candidateRootId,
      groupId: "group-1",
      classificationRunId: "run-1",
      sourceSnapshotId: ids.sourceSnapshotId,
      normalizedRootPath: ".",
      candidateRootFingerprint: SHA,
      candidateContentFingerprint: CONTENT_SHA,
      state: "ACTIVE",
      recordVersion: "1",
    },
  };
}

function source(
  includeSupportedStructuredValues = true,
  unavailableReasonCode?: string,
  targetOnly = false,
): M03SourceSnapshot {
  const ids = M03_GENUINE_FIXTURE_IDS;
  return {
    providerMetadata: {
      providerRepositoryId: "repo-1",
      ...M03_GENUINE_PROVIDER_METADATA.repositoryMetadata,
      ...M03_GENUINE_PROVIDER_METADATA.releaseSignals,
      license: M03_GENUINE_PROVIDER_METADATA.licenseSignals,
      fork: M03_GENUINE_PROVIDER_METADATA.forkSignals,
    },
    documents: [
      {
        sourceEntryId: ids.sourceEntryId,
        sourceDocumentId: ids.sourceDocumentId,
        normalizedPath: "SKILL.md",
        ownership: "CANDIDATE_OWNED",
        content: targetOnly
          ? "## Target users\nTechnical reviewers."
          : [
              "---",
              "name: Demo",
              "version: 1.0.0",
              "license: MIT",
              "deprecated: false",
              "---",
              ...(includeSupportedStructuredValues
                ? [
                    "## Installation",
                    "To install, prepare the fixture.",
                    "```sh",
                    "echo install-demo",
                    "```",
                    "After installation, verify the fixture.",
                    "## Target users",
                    "Technical reviewers.",
                  ]
                : []),
            ].join("\n"),
      },
    ],
    ...(unavailableReasonCode === undefined
      ? {}
      : {
          unavailableEntries: [
            {
              normalizedPath: "README.md",
              disposition: "SKIPPED" as const,
              reasonCodes: [unavailableReasonCode],
            },
          ],
        }),
  };
}

export async function createGenuineM03BundleFixture(
  proposalConfidence = 0.9,
  proposalText = "Technical reviewers",
  unavailableReasonCode?: string,
  includeSupportedStructuredValues = true,
  targetOnly = false,
): Promise<StructuredExtractionBundleV2> {
  const ids = M03_GENUINE_FIXTURE_IDS;
  const enabledRegistry = createExtractorRegistry(
    M03_POLICY_VERSIONS.policyArtifactFingerprint,
    true,
  );
  const extractorRegistryFingerprint = createHash("sha256")
    .update(canonicalJson(enabledRegistry))
    .digest("hex");
  const policyVersions = { ...M03_POLICY_VERSIONS, extractorRegistryFingerprint };
  const snapshot = source(includeSupportedStructuredValues, unavailableReasonCode, targetOnly);
  const { unavailableEntries, ...requiredSnapshot } = snapshot;
  const deterministic = extractDeterministic({
    sourceSnapshotId: ids.sourceSnapshotId,
    sourceRevision: ids.sourceRevision,
    resourceVersionObservationId: ids.resourceVersionObservationId,
    resourceSourceLinkId: ids.resourceSourceLinkId,
    candidateRootId: ids.candidateRootId,
    ownershipTopologyFingerprint:
      M03_GENUINE_EXPECTED_PREDECESSOR_STATE.fingerprintExpectations.ownershipTopology,
    acquisitionResultFingerprint:
      M03_GENUINE_EXPECTED_PREDECESSOR_STATE.fingerprintExpectations.acquisitionResult,
    sourceSnapshotFingerprint:
      M03_GENUINE_EXPECTED_PREDECESSOR_STATE.fingerprintExpectations.sourceSnapshot,
    providerMetadataFingerprint:
      M03_GENUINE_EXPECTED_PREDECESSOR_STATE.fingerprintExpectations.providerMetadata,
    policyVersions,
    ...requiredSnapshot,
    ...(unavailableEntries === undefined ? {} : { unavailableEntries }),
  });
  const sourceReferenceId = deterministic.operationSourceReferenceIds.PROPOSE_TARGET_USERS?.[0];
  if (sourceReferenceId === undefined) throw new Error("M03_FIXTURE_SOURCE_REFERENCE_MISSING");
  const rawResponse = Buffer.from(
    JSON.stringify({
      schemaVersion: "m03-analysis-raw-v1",
      proposals: [
        {
          kind: "FIELD_PROPOSAL",
          localOrdinal: 0,
          subOperation: "PROPOSE_TARGET_USERS",
          targetFieldKey: "target_user_candidates",
          value: {
            text: proposalText,
            normalizedKey: textKey(proposalText),
            proposalKind: "TARGET_USER",
            targetFieldKey: "target_user_candidates",
            taxonomyBinding: {
              mappingState: "TAXONOMY_CANDIDATE",
              taxonomyIdOrNull: null,
              taxonomyRegistryVersion: policyVersions.taxonomyRegistryVersion,
              taxonomyRegistryFingerprint: policyVersions.taxonomyRegistryFingerprint,
            },
            sourceReferenceIds: [sourceReferenceId],
          },
          confidence: proposalConfidence,
          claimClass: "AI_INFERENCE",
          sourceReferenceIds: [sourceReferenceId],
          warningCodes: [
            "TAXONOMY_CANDIDATE",
            ...(proposalConfidence < 0.6 ? ["LOW_CONFIDENCE"] : []),
          ],
        },
      ],
    }),
  );
  const analysisAdapter = new DeterministicM03AnalysisAdapter([rawResponse]);
  const analysisConfiguration = {
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
  const request = {
    schemaVersion: "M03_EXTRACTION_REQUEST_V2",
    requestId: "m04-genuine-fixture-request",
    idempotencyKey: "m04-genuine-fixture-key",
    m02HandoffMarkerId: ids.handoffMarkerId,
    controllingM02JobId: ids.controllingM02JobId,
    identityDecisionId: ids.identityDecisionId,
    m02ReviewStateId: ids.candidateReviewStateId,
    resourceCandidateId: ids.candidateId,
    resourceIdentityId: ids.resourceIdentityId,
    resourceVersionIdentityId: ids.resourceVersionIdentityId,
    resourceVersionObservationId: ids.resourceVersionObservationId,
    resourceSourceLinkId: ids.resourceSourceLinkId,
    sourceRepositoryId: ids.sourceRepositoryIdentityId,
    sourceSnapshotId: ids.sourceSnapshotId,
    sourceRevision: ids.sourceRevision,
    candidateRootId: ids.candidateRootId,
    candidateRootFingerprint: SHA,
    candidateContentFingerprint: CONTENT_SHA,
    expectedPredecessorState: M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
    policyVersions,
    analysisConfiguration,
    analysisConfigurationFingerprint: fingerprintAnalysisConfiguration({
      ...analysisConfiguration,
      methodologyVersion: policyVersions.methodologyVersion,
      promptBundleVersion: policyVersions.promptBundleVersion,
      outputContractVersion: policyVersions.outputContractVersion,
      rawAnalysisSchemaVersion: policyVersions.rawAnalysisSchemaVersion,
      analysisBundleVersion: policyVersions.analysisBundleVersion,
    }),
  } as const;
  const predecessor: M03EligibilitySnapshot = {
    m02InputProjection: m02Projection(),
    handoffExists: true,
    handoffActive: true,
    acquisitionCompleted: true,
    cancellationRequested: false,
    m02JobControlling: true,
    candidateResolved: true,
    reviewClear: true,
    identityTupleValid: true,
    observationExists: true,
    observationTupleValid: true,
    sourceLinkActive: true,
    identityDecisionControlling: true,
    snapshotMatches: true,
    revisionMatches: true,
    corpusValid: true,
    expectedPredecessorState: M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
  };
  const orchestrator = new InMemoryM03Orchestrator({
    policyArtifacts: policyArtifacts(),
    analysisPort: analysisAdapter,
    now: () => "2026-01-01T00:00:00.000Z",
  });
  const result = await orchestrator.execute(Buffer.from(JSON.stringify(request)), async () => {
    await Promise.resolve();
    return {
      predecessor,
      source: snapshot,
      checkControl: async () => {
        await Promise.resolve();
        return predecessor;
      },
    };
  });
  if (result.kind !== "BUNDLE")
    throw new Error(`M03_FIXTURE_GENERATION_FAILED:${result.errorCode}`);
  return StructuredExtractionBundleV2Schema.parse(result.bundle);
}

export async function createGenuineM03EmptyBundleFixture(): Promise<StructuredExtractionBundleV2> {
  const ids = M03_GENUINE_FIXTURE_IDS;
  const analysisConfiguration = {
    mode: "DISABLED",
    operation: "NORMALIZE_STRUCTURED_EXTRACTION",
    providerAdapterNameOrNull: null,
    providerAdapterVersionOrNull: null,
    providerNameOrNull: null,
    modelNameOrNull: null,
    deterministicSettings: {},
    subOperationPlan: [],
  } as const;
  const request = {
    schemaVersion: "M03_EXTRACTION_REQUEST_V2",
    requestId: "m04-empty-fixture-request",
    idempotencyKey: "m04-empty-fixture-key",
    m02HandoffMarkerId: ids.handoffMarkerId,
    controllingM02JobId: ids.controllingM02JobId,
    identityDecisionId: ids.identityDecisionId,
    m02ReviewStateId: ids.candidateReviewStateId,
    resourceCandidateId: ids.candidateId,
    resourceIdentityId: ids.resourceIdentityId,
    resourceVersionIdentityId: ids.resourceVersionIdentityId,
    resourceVersionObservationId: ids.resourceVersionObservationId,
    resourceSourceLinkId: ids.resourceSourceLinkId,
    sourceRepositoryId: ids.sourceRepositoryIdentityId,
    sourceSnapshotId: ids.sourceSnapshotId,
    sourceRevision: ids.sourceRevision,
    candidateRootId: ids.candidateRootId,
    candidateRootFingerprint: SHA,
    candidateContentFingerprint: CONTENT_SHA,
    expectedPredecessorState: M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
    policyVersions: M03_POLICY_VERSIONS,
    analysisConfiguration,
    analysisConfigurationFingerprint: fingerprintAnalysisConfiguration({
      ...analysisConfiguration,
      methodologyVersion: M03_POLICY_VERSIONS.methodologyVersion,
      promptBundleVersion: M03_POLICY_VERSIONS.promptBundleVersion,
      outputContractVersion: M03_POLICY_VERSIONS.outputContractVersion,
      rawAnalysisSchemaVersion: M03_POLICY_VERSIONS.rawAnalysisSchemaVersion,
      analysisBundleVersion: M03_POLICY_VERSIONS.analysisBundleVersion,
    }),
  } as const;
  const predecessor: M03EligibilitySnapshot = {
    m02InputProjection: m02Projection(),
    handoffExists: true,
    handoffActive: true,
    acquisitionCompleted: true,
    cancellationRequested: false,
    m02JobControlling: true,
    candidateResolved: true,
    reviewClear: true,
    identityTupleValid: true,
    observationExists: true,
    observationTupleValid: true,
    sourceLinkActive: true,
    identityDecisionControlling: true,
    snapshotMatches: true,
    revisionMatches: true,
    corpusValid: true,
    expectedPredecessorState: M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
  };
  const orchestrator = new InMemoryM03Orchestrator({
    policyArtifacts: policyArtifacts(),
    now: () => "2026-01-01T00:00:00.000Z",
  });
  const result = await orchestrator.execute(Buffer.from(JSON.stringify(request)), async () => {
    await Promise.resolve();
    return {
      predecessor,
      source: source(false),
      checkControl: async () => {
        await Promise.resolve();
        return predecessor;
      },
    };
  });
  if (result.kind !== "BUNDLE")
    throw new Error(`M03_EMPTY_FIXTURE_GENERATION_FAILED:${result.errorCode}`);
  return StructuredExtractionBundleV2Schema.parse(result.bundle);
}
