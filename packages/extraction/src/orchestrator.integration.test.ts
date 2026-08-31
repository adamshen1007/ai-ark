/* eslint-disable @typescript-eslint/prefer-regexp-exec -- RegExp.exec is prohibited by the acquired-source safety gate. */
import { createHash } from "node:crypto";
/* eslint-disable @typescript-eslint/require-await */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_POLICY_VERSIONS,
  StructuredExtractionBundleV1Schema,
} from "@ai-ark/contracts";

import {
  InMemoryM03Orchestrator,
  canonicalJson,
  createExtractorRegistry,
  fingerprintAnalysisConfiguration,
  type M03SourceSnapshot,
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
} as const;

const disabledAnalysis = {
  mode: "DISABLED",
  operation: "NORMALIZE_STRUCTURED_EXTRACTION",
  providerAdapterNameOrNull: null,
  providerAdapterVersionOrNull: null,
  providerNameOrNull: null,
  modelNameOrNull: null,
  deterministicSettings: {},
  subOperationPlan: [],
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

function request(idempotencyKey = "idem-1") {
  return {
    schemaVersion: "M03_EXTRACTION_V1",
    requestId: "request-1",
    idempotencyKey,
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
    analysisConfiguration: disabledAnalysis,
    analysisConfigurationFingerprint: fingerprintAnalysisConfiguration({
      ...disabledAnalysis,
      methodologyVersion: M03_POLICY_VERSIONS.methodologyVersion,
      promptBundleVersion: M03_POLICY_VERSIONS.promptBundleVersion,
      outputContractVersion: M03_POLICY_VERSIONS.outputContractVersion,
      rawAnalysisSchemaVersion: M03_POLICY_VERSIONS.rawAnalysisSchemaVersion,
      analysisBundleVersion: M03_POLICY_VERSIONS.analysisBundleVersion,
    }),
  } as const;
}

function policyArtifacts() {
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
  const policyLiteral = between(
    "<!-- M03_POLICY_ARTIFACT_V1_BEGIN -->",
    "<!-- M03_POLICY_ARTIFACT_V1_END -->",
  );
  const fieldBlock = between(
    "<!-- M03_FIELD_REGISTRY_V1_BEGIN -->",
    "<!-- M03_FIELD_REGISTRY_V1_END -->",
  );
  const fieldRegistry = JSON.stringify(
    JSON.parse(fieldBlock.match(/```json\n([\s\S]*?)\n```/u)?.[1] ?? "null"),
  );
  return { policyLiteral, fieldRegistry, taxonomyRegistry: "[]" };
}

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
      sourceEntryId: "entry-1",
      sourceDocumentId: "document-1",
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
  ],
};
const sourceDocument = source.documents[0];
if (sourceDocument === undefined) throw new Error("TEST_SOURCE_DOCUMENT_MISSING");

describe("M03 in-memory orchestration", () => {
  it("returns the minimal digest-only invalid-request arm before predecessor access", async () => {
    let reads = 0;
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const result = await orchestrator.execute(Buffer.from("{"), async () => {
      reads += 1;
      return { predecessor, source, checkControl: async () => predecessor };
    });
    expect(result).toEqual({
      kind: "INVALID_REQUEST",
      rawRequestDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      errorCode: "REQUEST_SCHEMA_INVALID",
      safeContext: { phase: "REQUEST_VALIDATION" },
    });
    expect(reads).toBe(0);
  });

  it("applies the exact first-match eligibility order", async () => {
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const ineligiblePredecessor = {
      ...predecessor,
      handoffExists: false,
      acquisitionCompleted: false,
      candidateResolved: false,
    };
    const result = await orchestrator.execute(Buffer.from(JSON.stringify(request())), async () => ({
      predecessor: ineligiblePredecessor,
      source,
      checkControl: async () => ineligiblePredecessor,
    }));
    expect(result).toMatchObject({ kind: "REJECTED", errorCode: "M02_HANDOFF_NOT_FOUND" });
  });

  it("routes exact expected-state key, value, and duplicate-key failures to eligibility", async () => {
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    let reads = 0;
    const load = async () => {
      reads += 1;
      return { predecessor, source, checkControl: async () => predecessor };
    };
    const base = request("expected-state-invalid");
    const invalidRequests = [
      {
        ...base,
        expectedPredecessorState: {
          ...expectedPredecessorState,
          mutableRecordVersions: {
            ...expectedPredecessorState.mutableRecordVersions,
            extra: "12",
          },
        },
      },
      {
        ...base,
        expectedPredecessorState: {
          ...expectedPredecessorState,
          mutableRecordVersions: {
            ...expectedPredecessorState.mutableRecordVersions,
            acquisitionJob: "0",
          },
        },
      },
      {
        ...base,
        expectedPredecessorState: {
          ...expectedPredecessorState,
          mutableRecordVersions: Object.fromEntries(
            Object.entries(expectedPredecessorState.mutableRecordVersions).filter(
              ([key]) => key !== "candidateRoot",
            ),
          ),
        },
      },
    ];
    for (const [index, invalid] of invalidRequests.entries()) {
      const result = await orchestrator.execute(
        Buffer.from(
          JSON.stringify({ ...invalid, idempotencyKey: `expected-invalid-${String(index)}` }),
        ),
        load,
      );
      expect(result).toMatchObject({
        kind: "REJECTED",
        errorCode: "EXPECTED_VERSION_SET_INVALID",
      });
    }
    const duplicateRaw = JSON.stringify({ ...base, idempotencyKey: "expected-duplicate" }).replace(
      '"acquisitionJob":"1"',
      '"acquisitionJob":"1","acquisition\\u004aob":"2"',
    );
    const duplicateResult = await orchestrator.execute(Buffer.from(duplicateRaw), load);
    expect(duplicateResult).toMatchObject({
      kind: "REJECTED",
      errorCode: "EXPECTED_VERSION_SET_INVALID",
    });
    expect(reads).toBe(0);
  });

  it("builds one immutable bindable bundle and replays it without repeated work", async () => {
    let reads = 0;
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const load = async () => {
      reads += 1;
      return { predecessor, source, checkControl: async () => predecessor };
    };
    const first = await orchestrator.execute(Buffer.from(JSON.stringify(request())), load);
    const replay = await orchestrator.execute(Buffer.from(JSON.stringify(request())), load);
    expect(first).toMatchObject({
      kind: "BUNDLE",
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      extractionId: expect.stringMatching(/^ext_[a-f0-9]{64}$/u),
      bundle: {
        schemaVersion: "M03_EXTRACTION_V1",
        aggregateStatus: "COMPLETED",
        m04Bindability: "BINDABLE",
        fields: expect.arrayContaining([expect.objectContaining({ fieldKey: "source_revision" })]),
        laterProgressionBlockers: expect.arrayContaining([
          { blockerKey: "ATTRIBUTION_GROUP", status: "MISSING" },
        ]),
        outputFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
    expect(replay).toEqual(first);
    expect(reads).toBe(1);
    if (first.kind === "BUNDLE") {
      const parsed = StructuredExtractionBundleV1Schema.safeParse(first.bundle);
      expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
    }
  });

  it("revalidates a prior rejection when a fresh idempotency key is used", async () => {
    let reads = 0;
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const first = await orchestrator.execute(
      Buffer.from(JSON.stringify(request("rejected-key"))),
      async () => {
        reads += 1;
        const ineligiblePredecessor = { ...predecessor, handoffExists: false };
        return {
          predecessor: ineligiblePredecessor,
          source,
          checkControl: async () => ineligiblePredecessor,
        };
      },
    );
    const replay = await orchestrator.execute(
      Buffer.from(JSON.stringify(request("rejected-key"))),
      async () => {
        reads += 1;
        return { predecessor, source, checkControl: async () => predecessor };
      },
    );
    const fresh = await orchestrator.execute(
      Buffer.from(JSON.stringify(request("fresh-key"))),
      async () => {
        reads += 1;
        return { predecessor, source, checkControl: async () => predecessor };
      },
    );
    expect(first).toMatchObject({ kind: "REJECTED", errorCode: "M02_HANDOFF_NOT_FOUND" });
    expect(replay).toEqual(first);
    expect(fresh).toMatchObject({ kind: "BUNDLE" });
    expect(reads).toBe(2);
  });

  it("joins concurrent identical work under one controller", async () => {
    let reads = 0;
    let releaseLoad: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const load = async () => {
      reads += 1;
      await blocked;
      return { predecessor, source, checkControl: async () => predecessor };
    };
    const first = orchestrator.execute(Buffer.from(JSON.stringify(request())), load);
    const second = orchestrator.execute(Buffer.from(JSON.stringify(request())), load);
    releaseLoad?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).toEqual(firstResult);
    expect(reads).toBe(1);
  });

  it("fails closed when cancellation or handoff supersession is observed at a guard", async () => {
    const cancelled = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const cancelledResult = await cancelled.execute(
      Buffer.from(JSON.stringify(request("cancelled"))),
      async () => ({
        predecessor,
        source,
        checkControl: async () => ({ ...predecessor, cancellationRequested: true }),
      }),
    );
    expect(cancelledResult).toMatchObject({ kind: "CANCELLED", errorCode: "CANCELLED" });

    let guards = 0;
    const superseded = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const supersededResult = await superseded.execute(
      Buffer.from(JSON.stringify(request("superseded"))),
      async () => ({
        predecessor,
        source,
        checkControl: async () => {
          guards += 1;
          return guards < 2 ? predecessor : { ...predecessor, m02JobControlling: false };
        },
      }),
    );
    expect(supersededResult).toMatchObject({
      kind: "SUPERSEDED_INPUT",
      errorCode: "SUPERSEDED_INPUT",
    });
  });

  it("fails freshness guards for every predecessor row family, expected token family, and eligibility predicate", async () => {
    const paths: readonly (readonly string[])[] = [
      ...[
        "handoffExists",
        "handoffActive",
        "acquisitionCompleted",
        "m02JobControlling",
        "candidateResolved",
        "reviewClear",
        "identityTupleValid",
        "observationExists",
        "observationTupleValid",
        "sourceLinkActive",
        "identityDecisionControlling",
        "snapshotMatches",
        "revisionMatches",
        "corpusValid",
      ].map((key) => [key]),
      ...Object.keys(predecessor.m02InputProjection).map((key) => [
        "m02InputProjection",
        key,
        "recordVersion",
      ]),
      ...Object.keys(predecessor.expectedPredecessorState.mutableRecordVersions).map((key) => [
        "expectedPredecessorState",
        "mutableRecordVersions",
        key,
      ]),
      ...Object.keys(predecessor.expectedPredecessorState.fingerprintExpectations).map((key) => [
        "expectedPredecessorState",
        "fingerprintExpectations",
        key,
      ]),
    ];
    for (const [index, path] of paths.entries()) {
      const drifted = structuredClone(predecessor);
      let cursor = drifted as unknown as Record<string, unknown>;
      for (const segment of path.slice(0, -1)) cursor = cursor[segment] as Record<string, unknown>;
      const final = path.at(-1) ?? "";
      cursor[final] = typeof cursor[final] === "boolean" ? false : `drift-${String(index)}`;
      const orchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: policyArtifacts(),
        now: () => "2026-08-25T00:00:00.000Z",
      });
      const result = await orchestrator.execute(
        Buffer.from(JSON.stringify(request(`freshness-${String(index)}`))),
        async () => ({ predecessor, source, checkControl: async () => drifted }),
      );
      expect(result).toMatchObject({ kind: "SUPERSEDED_INPUT", errorCode: "SUPERSEDED_INPUT" });
    }
  });

  it("compares retained preimages before request or input fingerprint replay", async () => {
    const constant = "f".repeat(64);
    const requestCollision = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
      hashForTesting: (domain, bytes) =>
        domain === "REQUEST" ? constant : createHash("sha256").update(bytes).digest("hex"),
    });
    await requestCollision.execute(
      Buffer.from(JSON.stringify(request("collision-a"))),
      async () => ({ predecessor, source, checkControl: async () => predecessor }),
    );
    const changedRequest = {
      ...request("collision-b"),
      sourceRepositoryId: "repository-2",
    };
    const requestCollisionResult = await requestCollision.execute(
      Buffer.from(JSON.stringify(changedRequest)),
      async () => ({ predecessor, source, checkControl: async () => predecessor }),
    );
    expect(requestCollisionResult).toMatchObject({
      kind: "FAILED",
      errorCode: "INPUT_FINGERPRINT_COLLISION",
    });

    const invalidExpectedState = {
      ...expectedPredecessorState,
      mutableRecordVersions: {
        ...expectedPredecessorState.mutableRecordVersions,
        acquisitionJob: "01",
      },
    };
    const invalidRequestCollision = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
      hashForTesting: (domain, bytes) =>
        domain === "REQUEST" ? constant : createHash("sha256").update(bytes).digest("hex"),
    });
    const firstInvalid = await invalidRequestCollision.execute(
      Buffer.from(
        JSON.stringify({
          ...request("invalid-expected-first"),
          expectedPredecessorState: invalidExpectedState,
        }),
      ),
      async () => ({ predecessor, source, checkControl: async () => predecessor }),
    );
    expect(firstInvalid).toMatchObject({
      kind: "REJECTED",
      errorCode: "EXPECTED_VERSION_SET_INVALID",
    });
    const secondInvalid = await invalidRequestCollision.execute(
      Buffer.from(
        JSON.stringify({
          ...request("invalid-expected-second"),
          sourceRepositoryId: "repository-collision",
          expectedPredecessorState: invalidExpectedState,
        }),
      ),
      async () => ({ predecessor, source, checkControl: async () => predecessor }),
    );
    expect(secondInvalid).toMatchObject({
      kind: "FAILED",
      errorCode: "INPUT_FINGERPRINT_COLLISION",
    });

    const inputCollision = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
      hashForTesting: (domain, bytes) =>
        domain === "INPUT" ? constant : createHash("sha256").update(bytes).digest("hex"),
    });
    await inputCollision.execute(Buffer.from(JSON.stringify(request("input-a"))), async () => ({
      predecessor,
      source,
      checkControl: async () => predecessor,
    }));
    const inputCollisionResult = await inputCollision.execute(
      Buffer.from(JSON.stringify({ ...request("input-b"), sourceSnapshotId: "snapshot-2" })),
      async () => {
        const currentPredecessor = { ...predecessor, snapshotMatches: true };
        return {
          predecessor: currentPredecessor,
          source: {
            ...source,
            documents: source.documents.map((document) => ({
              ...document,
              content: `${document.content}\n# changed bytes`,
            })),
          },
          checkControl: async () => currentPredecessor,
        };
      },
    );
    expect(inputCollisionResult).toMatchObject({
      kind: "FAILED",
      errorCode: "INPUT_FINGERPRINT_COLLISION",
    });
  });

  it("fails closed at every retained nested input hash layer before replay or AI", async () => {
    const constant = "e".repeat(64);
    const repeatedDomains = [
      "DOCUMENT_CONTENT",
      "OWNED_CONTENT",
      "SOURCE_INVENTORY",
      "PROVIDER_METADATA",
      "CANDIDATE_ROOT_PAYLOAD",
      "ANALYSIS_CONFIGURATION",
      "INPUT",
    ] as const;
    for (const domainUnderTest of repeatedDomains) {
      const orchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: policyArtifacts(),
        now: () => "2026-08-25T00:00:00.000Z",
        hashForTesting: (domain, bytes) =>
          domain === domainUnderTest ? constant : createHash("sha256").update(bytes).digest("hex"),
      });
      const first = await orchestrator.execute(
        Buffer.from(JSON.stringify(request(`input-layer-first-${domainUnderTest}`))),
        async () => ({ predecessor, source, checkControl: async () => predecessor }),
      );
      expect(first).toMatchObject({ kind: "BUNDLE" });

      let changedRequest: Record<string, unknown> = request(
        `input-layer-second-${domainUnderTest}`,
      );
      let changedSource: M03SourceSnapshot = {
        ...source,
        documents: source.documents.map((document) => ({
          ...document,
          content: `${document.content}\n# byte-distinct`,
        })),
      };
      if (domainUnderTest === "PROVIDER_METADATA")
        changedSource = {
          ...source,
          providerMetadata: { ...source.providerMetadata, description: "byte-distinct" },
        };
      if (domainUnderTest === "CANDIDATE_ROOT_PAYLOAD")
        changedRequest = { ...changedRequest, candidateRootId: "root-2" };
      if (domainUnderTest === "ANALYSIS_CONFIGURATION") {
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
        } as const;
        changedRequest = {
          ...changedRequest,
          policyVersions: {
            ...M03_POLICY_VERSIONS,
            extractorRegistryFingerprint: createHash("sha256")
              .update(
                canonicalJson(
                  createExtractorRegistry(M03_POLICY_VERSIONS.policyArtifactFingerprint, true),
                ),
              )
              .digest("hex"),
          },
          analysisConfiguration,
          analysisConfigurationFingerprint: fingerprintAnalysisConfiguration({
            ...analysisConfiguration,
            methodologyVersion: M03_POLICY_VERSIONS.methodologyVersion,
            promptBundleVersion: M03_POLICY_VERSIONS.promptBundleVersion,
            outputContractVersion: M03_POLICY_VERSIONS.outputContractVersion,
            rawAnalysisSchemaVersion: M03_POLICY_VERSIONS.rawAnalysisSchemaVersion,
            analysisBundleVersion: M03_POLICY_VERSIONS.analysisBundleVersion,
          }),
        };
        changedSource = source;
      }
      const collision = await orchestrator.execute(
        Buffer.from(JSON.stringify(changedRequest)),
        async () => ({
          predecessor,
          source: changedSource,
          checkControl: async () => predecessor,
        }),
      );
      expect(collision, `${domainUnderTest}: ${JSON.stringify(collision)}`).toMatchObject({
        kind: "FAILED",
        errorCode: "INPUT_FINGERPRINT_COLLISION",
      });
    }

    const policyCollision = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
      hashForTesting: (domain, bytes) =>
        domain === "POLICY_ARTIFACT" ? constant : createHash("sha256").update(bytes).digest("hex"),
    });
    await expect(
      policyCollision.execute(
        Buffer.from(JSON.stringify(request("input-layer-policy"))),
        async () => ({ predecessor, source, checkControl: async () => predecessor }),
      ),
    ).resolves.toMatchObject({
      kind: "FAILED",
      errorCode: "INPUT_FINGERPRINT_COLLISION",
    });
  });

  it("fails closed for injected nested source, extractor, candidate, and conflict identity collisions", async () => {
    const domains = [
      "SOURCE_REFERENCE",
      "EXTRACTOR_REFERENCE",
      "EXTRACTOR_CONFIGURATION",
      "EXTRACTOR_CODE_BUNDLE",
      "CANDIDATE",
    ] as const;
    for (const domainUnderTest of domains) {
      const orchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: policyArtifacts(),
        now: () => "2026-08-25T00:00:00.000Z",
        hashForTesting: (domain, bytes) =>
          domain === domainUnderTest
            ? "f".repeat(64)
            : createHash("sha256").update(bytes).digest("hex"),
      });
      const result = await orchestrator.execute(
        Buffer.from(JSON.stringify(request(`nested-${domainUnderTest}`))),
        async () => ({ predecessor, source, checkControl: async () => predecessor }),
      );
      expect(result).toMatchObject({
        kind: "FAILED",
        errorCode: "CONTENT_DERIVED_ID_COLLISION",
      });
    }
  });

  it("binds every complete M02 projection row into input identity", async () => {
    const run = async (recordVersion: string) => {
      const orchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: policyArtifacts(),
        now: () => "2026-08-25T00:00:00.000Z",
      });
      return orchestrator.execute(
        Buffer.from(JSON.stringify(request("projection-binding"))),
        async () => {
          const currentPredecessor = {
            ...predecessor,
            m02InputProjection: {
              ...m02InputProjection,
              sourceRepository: { ...m02InputProjection.sourceRepository, recordVersion },
            },
          };
          return {
            predecessor: currentPredecessor,
            source,
            checkControl: async () => currentPredecessor,
          };
        },
      );
    };
    const first = await run("8");
    const second = await run("9");
    expect(first).toMatchObject({
      kind: "BUNDLE",
      bundle: { inputFingerprint: expect.any(String) },
    });
    expect(second).toMatchObject({
      kind: "BUNDLE",
      bundle: { inputFingerprint: expect.any(String) },
    });
    expect((first as { bundle: { inputFingerprint: string } }).bundle.inputFingerprint).not.toBe(
      (second as { bundle: { inputFingerprint: string } }).bundle.inputFingerprint,
    );
  });

  it("fails deterministic scalar one-over values through VALUE_SCHEMA_BOUND", async () => {
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const result = await orchestrator.execute(
      Buffer.from(JSON.stringify(request("deterministic-value-bound"))),
      async () => ({
        predecessor,
        source: {
          ...source,
          documents: [
            {
              ...sourceDocument,
              content: ["---", `name: ${"x".repeat(201)}`, "---"].join("\n"),
            },
          ],
        },
        checkControl: async () => predecessor,
      }),
    );
    expect(result).toMatchObject({
      kind: "FAILED",
      errorCode: "DETERMINISTIC_LIMIT_EXCEEDED",
      diagnostic: {
        safeContext: {
          limitNameOrNull: "VALUE_SCHEMA_BOUND",
          limitOrNull: 200,
          observedOrNull: 201,
        },
      },
    });
  });

  it("accepts the provider repository ID ceiling and classifies its one-over value", async () => {
    const orchestrator = new InMemoryM03Orchestrator({
      policyArtifacts: policyArtifacts(),
      now: () => "2026-08-25T00:00:00.000Z",
    });
    const execute = async (length: number) =>
      orchestrator.execute(
        Buffer.from(JSON.stringify(request(`provider-repository-id-${String(length)}`))),
        async () => ({
          predecessor,
          source: {
            ...source,
            providerMetadata: {
              ...source.providerMetadata,
              providerRepositoryId: "r".repeat(length),
            },
          },
          checkControl: async () => predecessor,
        }),
      );
    await expect(execute(200)).resolves.toMatchObject({ kind: "BUNDLE" });
    await expect(execute(201)).resolves.toMatchObject({
      kind: "FAILED",
      errorCode: "DETERMINISTIC_LIMIT_EXCEEDED",
      diagnostic: {
        safeContext: {
          limitNameOrNull: "VALUE_SCHEMA_BOUND",
          limitOrNull: 200,
          observedOrNull: 201,
        },
      },
    });
  });

  it("accepts each distinct deterministic scalar ceiling and rejects its one-over value", async () => {
    const cases = [
      {
        label: "name-200",
        limit: 200,
        atLimit: ["---", `name: ${"n".repeat(200)}`, "---"].join("\n"),
        oneOver: ["---", `name: ${"n".repeat(201)}`, "---"].join("\n"),
      },
      {
        label: "permission-scope-500",
        limit: 500,
        atLimit: [
          "---",
          "name: Demo",
          "permissions:",
          `  - 'NETWORK_ACCESS; scope: ${"s".repeat(500)}'`,
          "---",
        ].join("\n"),
        oneOver: [
          "---",
          "name: Demo",
          "permissions:",
          `  - 'NETWORK_ACCESS; scope: ${"s".repeat(501)}'`,
          "---",
        ].join("\n"),
      },
      {
        label: "limitation-text-1000",
        limit: 1000,
        atLimit: ["---", "name: Demo", "---", `Limitation: ${"l".repeat(1000)}`].join("\n"),
        oneOver: ["---", "name: Demo", "---", `Limitation: ${"l".repeat(1001)}`].join("\n"),
      },
    ] as const;
    for (const boundary of cases) {
      const orchestrator = new InMemoryM03Orchestrator({
        policyArtifacts: policyArtifacts(),
        now: () => "2026-08-25T00:00:00.000Z",
      });
      const execute = async (suffix: string, content: string) =>
        orchestrator.execute(
          Buffer.from(JSON.stringify(request(`${boundary.label}-${suffix}`))),
          async () => ({
            predecessor,
            source: {
              ...source,
              documents: [{ ...sourceDocument, content }],
            },
            checkControl: async () => predecessor,
          }),
        );
      await expect(execute("at", boundary.atLimit)).resolves.toMatchObject({ kind: "BUNDLE" });
      await expect(execute("over", boundary.oneOver)).resolves.toMatchObject({
        kind: "FAILED",
        errorCode: "DETERMINISTIC_LIMIT_EXCEEDED",
        diagnostic: {
          safeContext: {
            limitNameOrNull: "VALUE_SCHEMA_BOUND",
            limitOrNull: boundary.limit,
            observedOrNull: boundary.limit + 1,
          },
        },
      });
    }
  });
});
