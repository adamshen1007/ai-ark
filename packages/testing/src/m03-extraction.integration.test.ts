/* eslint-disable @typescript-eslint/prefer-regexp-exec -- RegExp.exec is prohibited by the acquired-source safety gate. */
import { createHash } from "node:crypto";
/* eslint-disable @typescript-eslint/require-await */
import { readFileSync } from "node:fs";

import { DeterministicM03AnalysisAdapter } from "@ai-ark/analysis";
import {
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_FIELD_KEYS,
  M03_POLICY_VERSIONS,
  StructuredExtractionBundleV1Schema,
  type M03AnalysisExecutionInputV1,
} from "@ai-ark/contracts";
import {
  canonicalJson,
  createExtractorRegistry,
  extractDeterministic,
  fingerprintAnalysisConfiguration,
  InMemoryM03Orchestrator,
} from "@ai-ark/extraction";
import { describe, expect, it } from "vitest";

const sha = "a".repeat(64);
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
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
} as const;

const m02InputProjection = {
  handoff: {
    id: "handoff-1",
    resourceCandidateId: "candidate-1",
    resourceIdentityId: "resource-1",
    resourceVersionIdentityId: "version-identity-1",
    controllingM02JobId: "job-1",
    sourceSnapshotId: "snapshot-1",
    identityDecisionId: "decision-1",
    originType: "AUTOMATIC",
    logicalKey: "handoff-key",
    state: "ACTIVE",
    recordVersion: "3",
  },
  acquisitionJob: {
    id: "acquisition-job-1",
    status: "COMPLETED",
    currentStage: "COMPLETED",
    sourceSnapshotId: "snapshot-1",
    cancellationRequested: false,
    recordVersion: "1",
  },
  m02Job: {
    id: "job-1",
    jobLineageId: "lineage-1",
    sourceSnapshotId: "snapshot-1",
    operationScope: "FULL",
    currentStage: "COMPLETED",
    reviewState: "CLEAR",
    supersessionState: "CONTROLLING",
    supersededByJobIdOrNull: null,
    supersessionSequence: 0,
    controllingClassificationDecisionIdOrNull: "classification-decision-1",
    jobScopeKey: "scope-1",
    inputFingerprint: sha,
    classificationPolicyVersion: "m02-classification-v1",
    identityPolicyVersion: "m02-identity-v1",
    analysisPolicyVersion: "m02-analysis-v1",
    parserProfileVersion: "m02-parser-v1",
    promptBundleVersion: "m02-prompts-v1",
    analysisProviderAdapterIdOrNull: null,
    analysisModelIdOrNull: null,
    analysisMethodologyVersionOrNull: null,
    recordVersion: "2",
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
    reconciledClassificationRunId: "classification-run-1",
    classificationPolicyVersion: "m02-classification-v1",
    identityPolicyVersion: "m02-identity-v1",
    identityOutcome: "NEW_RESOURCE",
    status: "RESOLVED",
    resourceIdentityId: "resource-1",
    resourceVersionIdentityId: "version-identity-1",
    recordVersion: "4",
  },
  resourceIdentity: {
    id: "resource-1",
    resourceType: "SKILL",
    status: "ACTIVE",
    reliableIdentityTokenOrNull: null,
    reliableTokenEvidenceIdOrNull: null,
    guardAnchorCandidateId: "candidate-1",
    recordVersion: "5",
  },
  resourceVersionIdentity: {
    id: "version-identity-1",
    resourceIdentityId: "resource-1",
    contentFingerprint: sha,
    firstObservedSourceSnapshotId: "snapshot-0",
    firstObservedCandidateRootId: "root-1",
    firstObservedSourceRevision: "c".repeat(40),
    observationLabel: "first",
    status: "ACTIVE",
    recordVersion: "6",
  },
  observation: {
    id: "observation-1",
    resourceVersionIdentityId: "version-identity-1",
    sourceSnapshotId: "snapshot-1",
    candidateRootId: "root-1",
    resourceSourceLinkId: "source-link-1",
    sourceRepositoryId: "repository-1",
    provider: "GITHUB",
    providerRepositoryId: "repo-1",
    normalizedRootPath: ".",
    immutableRevision: "b".repeat(40),
    observedAt: "2026-08-25T00:00:00.000Z",
  },
  sourceLink: {
    id: "source-link-1",
    sourceRepositoryId: "repository-1",
    normalizedRootPath: ".",
    targetResourceVersionId: "version-identity-1",
    relationship: "PRIMARY",
    decisionId: "decision-1",
    state: "ACTIVE",
    recordVersion: "7",
  },
  sourceRepository: {
    id: "repository-1",
    provider: "GITHUB",
    providerRepositoryId: "repo-1",
    firstObservedSourceSnapshotId: "snapshot-0",
    recordVersion: "8",
  },
  identityDecision: {
    id: "decision-1",
    resourceCandidateId: "candidate-1",
    outcome: "NEW_RESOURCE",
    matchedTierOrNull: null,
    confidenceOrNull: 1,
    identityPolicyVersion: "m02-identity-v1",
    decisionSource: "DETERMINISTIC",
    state: "CONTROLLING",
    recordVersion: "9",
  },
  candidateReviewState: {
    id: "review-1",
    groupIdOrNull: null,
    resourceCandidateId: "candidate-1",
    reviewState: "CLEAR",
    supersededByReviewIdOrNull: null,
    recordVersion: "10",
  },
  candidateRoot: {
    id: "root-1",
    groupId: "group-1",
    classificationRunId: "classification-run-1",
    sourceSnapshotId: "snapshot-1",
    normalizedRootPath: ".",
    candidateRootFingerprint: sha,
    candidateContentFingerprint: sha,
    state: "ACTIVE",
    recordVersion: "11",
  },
} as const;

function artifacts() {
  const specification = readFileSync(
    new URL("../../../docs/milestones/M03_SPEC.md", import.meta.url),
    "utf8",
  );
  const between = (begin: string, end: string) => {
    const beginIndex = specification.indexOf(begin);
    const start = specification.indexOf("\n", beginIndex) + 1;
    const endIndex = specification.indexOf(end, start);
    return specification.slice(
      start,
      specification[endIndex - 1] === "\n" ? endIndex - 1 : endIndex,
    );
  };
  const fieldBlock = between(
    "<!-- M03_FIELD_REGISTRY_V1_BEGIN -->",
    "<!-- M03_FIELD_REGISTRY_V1_END -->",
  );
  return {
    policyLiteral: between(
      "<!-- M03_POLICY_ARTIFACT_V1_BEGIN -->",
      "<!-- M03_POLICY_ARTIFACT_V1_END -->",
    ),
    fieldRegistry: JSON.stringify(
      JSON.parse(fieldBlock.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null"),
    ),
    taxonomyRegistry: "[]",
  };
}

const source = {
  providerMetadata: {
    providerRepositoryId: "repo-1",
    name: "demo",
    owner: "ExampleOrg",
    description: null,
    archived: false,
    visibility: "PUBLIC",
    tags: [],
    latestRelease: null,
    license: { spdxId: null, source: null },
    fork: { isFork: false, parentCanonicalUrl: null },
  },
  documents: [
    {
      sourceEntryId: "entry-skill",
      sourceDocumentId: "document-skill",
      normalizedPath: "SKILL.md",
      ownership: "CANDIDATE_OWNED" as const,
      content: [
        "---",
        "name: Demo",
        "version: 1.0.0",
        "license: MIT",
        "deprecated: false",
        "---",
      ].join("\n"),
    },
    {
      sourceEntryId: "entry-code",
      sourceDocumentId: "document-code",
      normalizedPath: "src/index.ts",
      ownership: "CANDIDATE_OWNED" as const,
      content: "await fetch('https://example.invalid');",
    },
  ],
};

describe("M01/M02 handoff to M03 deterministic fake", () => {
  it("merges attributable AI disagreement as a conflict and replays without a second provider call", async () => {
    const enabledRegistry = createExtractorRegistry(
      M03_POLICY_VERSIONS.policyArtifactFingerprint,
      true,
    );
    const extractorRegistryFingerprint = sha256(canonicalJson(enabledRegistry));
    const policyVersions = { ...M03_POLICY_VERSIONS, extractorRegistryFingerprint };
    const deterministic = extractDeterministic({
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "source-link-1",
      candidateRootId: "root-1",
      ownershipTopologyFingerprint: sha,
      acquisitionResultFingerprint: sha,
      sourceSnapshotFingerprint: sha,
      providerMetadataFingerprint: sha,
      policyVersions,
      ...source,
    });
    const permissionCandidate = deterministic.deterministicCandidates.find(
      (candidate) => candidate.fieldKey === "permissions",
    );
    const referenceId = permissionCandidate?.sourceReferenceIds[0];
    if (!referenceId) throw new Error("fixture permission reference missing");
    const rawResponse = Buffer.from(
      JSON.stringify({
        schemaVersion: "m03-analysis-raw-v1",
        proposals: [
          {
            kind: "FIELD_PROPOSAL",
            localOrdinal: 0,
            subOperation: "INFER_PERMISSIONS_FROM_STATIC_EVIDENCE",
            targetFieldKey: "permissions",
            value: {
              kind: "EXTERNAL_SERVICE_ACCESS",
              evidenceLevel: "INFERRED",
              scopeOrNull: null,
              absenceClaim: false,
              sourceReferenceIds: [referenceId],
            },
            confidence: 0.9,
            claimClass: "AI_INFERENCE",
            sourceReferenceIds: [referenceId],
            warningCodes: [],
          },
          {
            kind: "AMBIGUITY_SIGNAL",
            localOrdinal: 1,
            subOperation: "DETECT_AMBIGUITY",
            targetFieldKey: "permissions",
            reason: "DETERMINISTIC_AI_DISAGREEMENT",
            candidateIds: [permissionCandidate.id],
            interpretedProposalOrdinals: [0],
            confidence: 1,
            sourceReferenceIds: [referenceId],
            warningCodes: [],
          },
        ],
      }),
    );
    const adapter = new DeterministicM03AnalysisAdapter([rawResponse]);
    const analysisConfiguration = {
      mode: "ENABLED" as const,
      operation: "NORMALIZE_STRUCTURED_EXTRACTION" as const,
      providerAdapterNameOrNull: "deterministic-fake" as const,
      providerAdapterVersionOrNull: "1.0.0" as const,
      providerNameOrNull: "offline-fake" as const,
      modelNameOrNull: "m03-fixture-v1" as const,
      deterministicSettings: {
        temperature: 0 as const,
        topP: 1 as const,
        seedOrNull: 0 as const,
        maxOutputTokens: 4096,
        responseFormat: "JSON_SCHEMA" as const,
        toolChoice: "NONE" as const,
      },
      subOperationPlan: M03_ANALYSIS_SUB_OPERATIONS,
    };
    const request = {
      schemaVersion: "M03_EXTRACTION_V1",
      requestId: "request-1",
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
    };
    const predecessor = {
      m02InputProjection,
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
      expectedPredecessorState,
      firstObservedSourceSnapshotId: "snapshot-0",
      firstObservedSourceRevision: "c".repeat(40),
    } as const;
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: artifacts(),
      analysisPort: adapter,
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const load = async () => ({
      predecessor,
      source,
      checkControl: async () => predecessor,
    });
    const first = await orchestrator.execute(Buffer.from(JSON.stringify(request)), load);
    const replay = await orchestrator.execute(Buffer.from(JSON.stringify(request)), load);
    const freshKeyReplay = await orchestrator.execute(
      Buffer.from(JSON.stringify({ ...request, idempotencyKey: "idem-2" })),
      load,
    );
    expect(first).toMatchObject({
      kind: "BUNDLE",
      bundle: {
        analysisAttempts: [expect.objectContaining({ status: "SUCCEEDED" })],
        aiProposals: [
          expect.objectContaining({ kind: "FIELD_PROPOSAL", targetFieldKey: "permissions" }),
          expect.objectContaining({ kind: "AMBIGUITY_SIGNAL", targetFieldKey: "permissions" }),
        ],
        conflicts: [expect.objectContaining({ reasonCode: "AI_DETERMINISTIC_DISAGREEMENT" })],
        fields: expect.arrayContaining([
          expect.objectContaining({
            fieldKey: "permissions",
            status: "CONFLICTING",
            claimClass: "MIXED_SUPPORT",
            aiProposalIds: [expect.stringMatching(/^aip_/u)],
            conflictIds: [expect.stringMatching(/^conf_/u)],
          }),
        ]),
      },
    });
    expect(replay).toEqual(first);
    expect(freshKeyReplay).toEqual(first);
    expect(adapter.callCount).toBe(1);
    if (first.kind !== "BUNDLE") throw new Error("expected bundle");
    const ambiguityIndex = first.bundle.aiProposals.findIndex(
      (proposal) => proposal.kind === "AMBIGUITY_SIGNAL",
    );
    const ambiguity = first.bundle.aiProposals[ambiguityIndex];
    if (ambiguity?.kind !== "AMBIGUITY_SIGNAL") throw new Error("expected ambiguity proposal");
    const replaceAmbiguity = (replacement: typeof ambiguity) => ({
      ...first.bundle,
      aiProposals: first.bundle.aiProposals.map((proposal, index) =>
        index === ambiguityIndex ? replacement : proposal,
      ),
    });
    expect(
      StructuredExtractionBundleV1Schema.safeParse(
        replaceAmbiguity({ ...ambiguity, targetFieldKey: "tasks" }),
      ).success,
    ).toBe(false);
    expect(
      StructuredExtractionBundleV1Schema.safeParse(
        replaceAmbiguity({ ...ambiguity, reason: "LOW_CONFIDENCE" }),
      ).success,
    ).toBe(false);
    const ambiguityConflict = first.bundle.conflicts.find(
      ({ reasonCode }) => reasonCode === "AI_DETERMINISTIC_DISAGREEMENT",
    );
    if (ambiguityConflict === undefined) throw new Error("expected ambiguity conflict");
    expect(
      StructuredExtractionBundleV1Schema.safeParse({
        ...first.bundle,
        conflicts: first.bundle.conflicts.filter(({ id }) => id !== ambiguityConflict.id),
      }).success,
    ).toBe(false);
    expect(
      StructuredExtractionBundleV1Schema.safeParse({
        ...first.bundle,
        conflicts: first.bundle.conflicts.map((conflict) =>
          conflict.id === ambiguityConflict.id
            ? { ...conflict, reasonCode: "AI_MULTIPLE_INTERPRETATIONS" as const }
            : conflict,
        ),
      }).success,
    ).toBe(false);
    expect(
      StructuredExtractionBundleV1Schema.safeParse({
        ...first.bundle,
        aiProposals: [
          ...first.bundle.aiProposals,
          {
            ...ambiguity,
            id: `aip_${"f".repeat(64)}`,
            proposalFingerprint: "f".repeat(64),
          },
        ],
      }).success,
    ).toBe(false);

    const parsedRawResponse = JSON.parse(rawResponse.toString("utf8")) as {
      schemaVersion: string;
      proposals: Readonly<Record<string, unknown>>[];
    };
    const rawFieldProposal = parsedRawResponse.proposals[0];
    if (rawFieldProposal === undefined) throw new Error("expected raw field proposal");
    const duplicateAdapter = new DeterministicM03AnalysisAdapter([
      Buffer.from(
        JSON.stringify({
          schemaVersion: parsedRawResponse.schemaVersion,
          proposals: [rawFieldProposal, { ...rawFieldProposal, localOrdinal: 1 }],
        }),
      ),
    ]);
    const duplicateOrchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: artifacts(),
      analysisPort: duplicateAdapter,
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const duplicateResult = await duplicateOrchestrator.execute(
      Buffer.from(
        JSON.stringify({
          ...request,
          requestId: "request-duplicate-proposal",
          idempotencyKey: "duplicate-proposal",
        }),
      ),
      load,
    );
    expect(duplicateResult).toMatchObject({
      kind: "BUNDLE",
      bundle: {
        analysisAttempts: [
          expect.objectContaining({
            status: "INVALID_OUTPUT",
            invalidityClass: "SEMANTIC_OR_POLICY",
          }),
        ],
        aiProposals: [],
        warningCodes: expect.arrayContaining(["AI_OUTPUT_REJECTED"]),
        fields: expect.arrayContaining([
          expect.objectContaining({
            fieldKey: "permissions",
            status: "INFERRED",
            warningCodes: expect.arrayContaining(["AI_OUTPUT_REJECTED"]),
          }),
        ]),
      },
    });
    expect(duplicateAdapter.callCount).toBe(1);

    const skillDocument = source.documents[0];
    const codeDocument = source.documents[1];
    if (skillDocument === undefined || codeDocument === undefined)
      throw new Error("expected semantic source fixture documents");
    const semanticSource = {
      ...source,
      documents: [
        {
          ...skillDocument,
          content: `${skillDocument.content}\n\n# Capabilities\nAutomates routine work.`,
        },
        codeDocument,
        {
          sourceEntryId: "entry-readme",
          sourceDocumentId: "document-readme",
          normalizedPath: "README.md",
          ownership: "CANDIDATE_OWNED" as const,
          content: "# Features\nSupports governed review workflows.",
        },
      ],
    };
    const semanticDeterministic = extractDeterministic({
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "source-link-1",
      candidateRootId: "root-1",
      ownershipTopologyFingerprint: sha,
      acquisitionResultFingerprint: sha,
      sourceSnapshotFingerprint: sha,
      providerMetadataFingerprint: sha,
      policyVersions,
      ...semanticSource,
    });
    const capabilityReferenceIds = [
      ...(semanticDeterministic.operationSourceReferenceIds.NORMALIZE_CAPABILITIES ?? []),
    ].sort();
    expect(capabilityReferenceIds.length).toBeGreaterThanOrEqual(2);
    const canonicalCapabilityReferences = capabilityReferenceIds.slice(0, 2);
    const semanticProposal = {
      kind: "FIELD_PROPOSAL",
      localOrdinal: 0,
      subOperation: "NORMALIZE_CAPABILITIES",
      targetFieldKey: "capabilities",
      value: {
        text: "Automates routine work",
        normalizedKey: "automates routine work",
        proposalKind: "CAPABILITY",
        targetFieldKey: "capabilities",
        taxonomyBinding: {
          mappingState: "TAXONOMY_CANDIDATE",
          taxonomyIdOrNull: null,
          taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
          taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
        },
        sourceReferenceIds: canonicalCapabilityReferences,
      },
      confidence: 0.5,
      claimClass: "AI_INFERENCE",
      sourceReferenceIds: canonicalCapabilityReferences,
      warningCodes: ["TAXONOMY_CANDIDATE", "LOW_CONFIDENCE"],
    };
    const invalidSemanticProposals = [
      { ...semanticProposal, warningCodes: ["LOW_CONFIDENCE"] },
      {
        ...semanticProposal,
        warningCodes: ["TAXONOMY_CANDIDATE", "LOW_CONFIDENCE", "ARCHIVED_SOURCE"],
      },
      {
        ...semanticProposal,
        warningCodes: ["LOW_CONFIDENCE", "TAXONOMY_CANDIDATE"],
      },
      {
        ...semanticProposal,
        sourceReferenceIds: [...canonicalCapabilityReferences].reverse(),
        value: {
          ...semanticProposal.value,
          sourceReferenceIds: [...canonicalCapabilityReferences].reverse(),
        },
      },
    ];
    for (const [index, invalidProposal] of invalidSemanticProposals.entries()) {
      const invalidAdapter = new DeterministicM03AnalysisAdapter([
        Buffer.from(
          JSON.stringify({ schemaVersion: "m03-analysis-raw-v1", proposals: [invalidProposal] }),
        ),
      ]);
      const invalidOrchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: artifacts(),
        analysisPort: invalidAdapter,
        now: () => "2026-08-25T00:00:00.000Z",
      });
      const invalidResult = await invalidOrchestrator.execute(
        Buffer.from(
          JSON.stringify({
            ...request,
            requestId: `request-invalid-warning-${String(index)}`,
            idempotencyKey: `invalid-warning-${String(index)}`,
          }),
        ),
        async () => ({
          predecessor,
          source: semanticSource,
          checkControl: async () => predecessor,
        }),
      );
      expect(invalidResult).toMatchObject({
        kind: "BUNDLE",
        bundle: {
          analysisAttempts: [
            expect.objectContaining({
              status: "INVALID_OUTPUT",
              invalidityClass: "SEMANTIC_OR_POLICY",
            }),
          ],
          aiProposals: [],
          warningCodes: expect.arrayContaining(["AI_OUTPUT_REJECTED"]),
        },
      });
      expect(invalidAdapter.callCount).toBe(1);
    }

    let beforePrimaryChecks = 0;
    const beforePrimaryAdapter = new DeterministicM03AnalysisAdapter([rawResponse]);
    const beforePrimaryOrchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: artifacts(),
      analysisPort: beforePrimaryAdapter,
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const beforePrimary = await beforePrimaryOrchestrator.execute(
      Buffer.from(
        JSON.stringify({
          ...request,
          requestId: "request-before-primary",
          idempotencyKey: "before-primary",
        }),
      ),
      async () => ({
        predecessor,
        source,
        checkControl: async () => {
          beforePrimaryChecks += 1;
          return beforePrimaryChecks === 3
            ? { ...predecessor, cancellationRequested: true }
            : predecessor;
        },
      }),
    );
    expect(beforePrimaryAdapter.callCount).toBe(0);
    expect(beforePrimary).toMatchObject({
      kind: "CANCELLED",
      errorCode: "CANCELLED",
      diagnostic: { lastCompletedStageOrNull: "ANALYSIS", retainedAnalysisAttempts: [] },
    });
    const zeroListItems = Object.fromEntries(M03_FIELD_KEYS.map((fieldKey) => [fieldKey, 0]));
    const deterministicListItems = { ...zeroListItems, permissions: 1 };
    const beforePrimaryCounts = {
      sourceReferences: 10,
      extractorReferences: 13,
      deterministicCandidates: 9,
      deterministicConflicts: 0,
      deterministicWarningReferences: 14,
      deterministicListItemsByField: deterministicListItems,
      exactCommands: 0,
      aiProposalCharactersMaximum: 0,
      aiProposals: 0,
      aiProjectedConflicts: 0,
      aiProjectedWarningReferences: 0,
      aiProjectedListItemsByField: zeroListItems,
      aiCalls: 0,
      aiInputExcerpts: 2,
      aiInputCharacters: 78,
    };
    expect(
      (beforePrimary as { diagnostic: { observedCounts: unknown } }).diagnostic.observedCounts,
    ).toEqual(beforePrimaryCounts);

    let beforeRepairChecks = 0;
    const beforeRepairAdapter = new DeterministicM03AnalysisAdapter([
      Buffer.from("{"),
      rawResponse,
    ]);
    const beforeRepairOrchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: artifacts(),
      analysisPort: beforeRepairAdapter,
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const beforeRepair = await beforeRepairOrchestrator.execute(
      Buffer.from(
        JSON.stringify({
          ...request,
          requestId: "request-before-repair",
          idempotencyKey: "before-repair",
        }),
      ),
      async () => ({
        predecessor,
        source,
        checkControl: async () => {
          beforeRepairChecks += 1;
          return beforeRepairChecks === 4
            ? {
                ...predecessor,
                m02InputProjection: {
                  ...predecessor.m02InputProjection,
                  handoff: {
                    ...predecessor.m02InputProjection.handoff,
                    recordVersion: "99",
                  },
                },
              }
            : predecessor;
        },
      }),
    );
    expect(beforeRepairAdapter.callCount).toBe(1);
    expect(beforeRepair).toMatchObject({
      kind: "SUPERSEDED_INPUT",
      errorCode: "SUPERSEDED_INPUT",
      diagnostic: {
        lastCompletedStageOrNull: "ANALYSIS",
        retainedAnalysisAttempts: [
          expect.objectContaining({
            ordinal: 0,
            purpose: "PRIMARY",
            status: "INVALID_OUTPUT",
            invalidityClass: "SYNTACTIC_OR_SCHEMA_SHAPE",
          }),
        ],
      },
    });
    expect(
      (beforeRepair as { diagnostic: { observedCounts: unknown } }).diagnostic.observedCounts,
    ).toEqual({ ...beforePrimaryCounts, aiCalls: 1 });

    let actualProviderCalls = 0;
    const thirdCallOrchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: artifacts(),
      analysisPort: {
        analyze: async (input: M03AnalysisExecutionInputV1) => {
          await input.authorizeInvocation(0, "PRIMARY");
          actualProviderCalls += 1;
          await input.authorizeInvocation(1, "SYNTACTIC_REPAIR");
          actualProviderCalls += 1;
          await input.authorizeInvocation(2, "SYNTACTIC_REPAIR");
          actualProviderCalls += 1;
          throw new Error("unreachable provider invocation");
        },
      },
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const thirdCall = await thirdCallOrchestrator.execute(
      Buffer.from(
        JSON.stringify({
          ...request,
          requestId: "request-third-call",
          idempotencyKey: "third-call",
        }),
      ),
      load,
    );
    expect(actualProviderCalls).toBe(2);
    expect(thirdCall).toMatchObject({
      kind: "FAILED",
      errorCode: "ANALYSIS_CALL_PLAN_INVALID",
      diagnostic: {
        retainedAnalysisAttempts: [],
        observedCounts: { aiCalls: 2 },
        safeContext: {
          recordKindOrNull: "LIMIT",
          limitNameOrNull: "AI_CALLS",
          limitOrNull: 2,
          observedOrNull: 3,
        },
      },
    });

    const changedAnalysisConfiguration = {
      ...analysisConfiguration,
      deterministicSettings: {
        ...analysisConfiguration.deterministicSettings,
        maxOutputTokens: 4097,
      },
    };
    const changedAnalysisRequest = {
      ...request,
      requestId: "request-collision-second",
      idempotencyKey: "collision-second",
      analysisConfiguration: changedAnalysisConfiguration,
      analysisConfigurationFingerprint: fingerprintAnalysisConfiguration({
        ...changedAnalysisConfiguration,
        methodologyVersion: policyVersions.methodologyVersion,
        promptBundleVersion: policyVersions.promptBundleVersion,
        outputContractVersion: policyVersions.outputContractVersion,
        rawAnalysisSchemaVersion: policyVersions.rawAnalysisSchemaVersion,
        analysisBundleVersion: policyVersions.analysisBundleVersion,
      }),
    };
    const collisionDomains = [
      "ANALYSIS_INPUT",
      "ANALYSIS_INVOCATION",
      "ANALYSIS_RESULT",
      "EXTRACTION_ID",
      "OUTPUT_FINGERPRINT",
    ] as const;
    for (const domainUnderTest of collisionDomains) {
      const collisionAdapter = new DeterministicM03AnalysisAdapter([rawResponse]);
      const collisionOrchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: artifacts(),
        analysisPort: collisionAdapter,
        now: () => "2026-08-25T00:00:00.000Z",
        hashForTesting: (domain, bytes) =>
          domain === domainUnderTest
            ? "f".repeat(64)
            : createHash("sha256").update(bytes).digest("hex"),
      });
      const firstCollisionRun = await collisionOrchestrator.execute(
        Buffer.from(
          JSON.stringify({
            ...request,
            requestId: `request-collision-first-${domainUnderTest}`,
            idempotencyKey: `collision-first-${domainUnderTest}`,
          }),
        ),
        load,
      );
      expect(firstCollisionRun, domainUnderTest).toMatchObject({ kind: "BUNDLE" });
      const secondCollisionRun = await collisionOrchestrator.execute(
        Buffer.from(JSON.stringify(changedAnalysisRequest)),
        async () => ({
          predecessor,
          source: {
            ...source,
            providerMetadata: {
              ...source.providerMetadata,
              description: "collision-variant",
            },
          },
          checkControl: async () => predecessor,
        }),
      );
      expect(
        secondCollisionRun,
        `${domainUnderTest}: ${JSON.stringify({
          first:
            firstCollisionRun.kind === "BUNDLE"
              ? firstCollisionRun.bundle.inputFingerprint
              : firstCollisionRun,
          second:
            secondCollisionRun.kind === "BUNDLE"
              ? secondCollisionRun.bundle.inputFingerprint
              : secondCollisionRun,
          calls: collisionAdapter.callCount,
        })}`,
      ).toMatchObject({
        kind: "FAILED",
        errorCode:
          domainUnderTest === "ANALYSIS_INPUT"
            ? "INPUT_FINGERPRINT_COLLISION"
            : "CONTENT_DERIVED_ID_COLLISION",
      });
    }
  });
});
