import type { StructuredExtractionBundleV1 } from "@ai-ark/contracts";
import { describe, expect, it } from "vitest";

import { EvidenceBindingServiceV1, projectEvidenceBinding } from "./index.js";

const sha = "a".repeat(64);
const extractionId = `ext_${sha}` as const;

function requestBytes(): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "request-1",
      extractionId,
      expectedM03OutputFingerprint: sha,
      expectedResourceIdentityId: "resource-1",
      expectedResourceVersionIdentityId: "version-1",
      expectedSourceSnapshotId: "snapshot-1",
      expectedSourceRevision: "b".repeat(40),
      expectedPredecessorState: {
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
          sourceSnapshot: sha,
          acquisitionResult: sha,
          resourceVersionObservation: sha,
          ownershipTopology: sha,
          reviewStateSet: sha,
          providerMetadata: sha,
        },
      },
      evidencePolicyVersion: "m04-evidence-policy-v1",
      materialFieldRegistryVersion: "m04-material-fields-v1",
    }),
  );
}

function bundle(): StructuredExtractionBundleV1 {
  const fieldKeys = [
    "canonical_skill_name",
    "creator_candidates",
    "organization_candidates",
    "version",
    "source_revision",
    "license",
    "categories",
    "outcome_candidate",
    "capabilities",
    "tasks",
    "use_cases",
    "target_user_candidates",
    "installation",
    "configuration",
    "dependencies",
    "external_services",
    "permissions",
    "compatibility",
    "limitations",
    "maintenance_signals",
  ] as const;
  const fields: Record<string, unknown>[] = fieldKeys.map((fieldKey) => ({
    fieldKey,
    value: [],
    status: "MISSING" as const,
    claimClass: "NO_CLAIM" as const,
    confidence: null,
    deterministicCandidateIds: [],
    aiProposalIds: [],
    evidenceIds: [],
    conflictIds: [],
    warningCodes: [],
    extractorRefs: ["extractor-1"],
  }));
  fields[0] = {
    ...fields[0],
    value: { normalizedName: "demo", displayName: "Demo", sourceReferenceIds: ["src_1"] },
    status: "EXPLICIT",
    claimClass: "SOURCE_FACT",
    confidence: 1,
    deterministicCandidateIds: ["candidate-1"],
    evidenceIds: ["src_1"],
  };
  return {
    schemaVersion: "M03_EXTRACTION_V1",
    extractionId,
    outputFingerprint: sha,
    m02: {
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
    },
    sourceReferences: [
      {
        kind: "INVENTORY_ABSENCE",
        id: "src_1",
        sourceSnapshotId: "snapshot-1",
        candidateRootId: "root-1",
        ownershipTopologyFingerprint: sha,
        acquisitionResultFingerprint: sha,
        predicate: "CHANGELOG_SELECTOR_SET_EMPTY",
        evaluatedSelectorPaths: [],
        contentHash: sha,
        excerptHashOrNull: null,
        excerptOrNull: null,
      },
    ],
    fields,
    conflicts: [],
    analysisAttempts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  } as unknown as StructuredExtractionBundleV1;
}

describe("M04 evidence projection", () => {
  it("rejects malformed request bytes without accessing the bundle or persistence", async () => {
    let writes = 0;
    const service = new EvidenceBindingServiceV1({
      persistAccepted: async () => {
        await Promise.resolve();
        writes += 1;
        throw new Error("must not write");
      },
    });
    const result = await service.bindEvidence(
      Buffer.from("{"),
      new Proxy(
        {},
        {
          get: () => {
            throw new Error("must not inspect bundle");
          },
        },
      ),
    );
    expect(result).toMatchObject({ kind: "MALFORMED", error: "REQUEST_JSON_INVALID" });
    expect(writes).toBe(0);
  });

  it("validates the complete V2 bundle before bindability or bound inspection", async () => {
    const service = new EvidenceBindingServiceV1({
      persistAccepted: async () => {
        await Promise.resolve();
        throw new Error("must not persist rejected input");
      },
    });
    await expect(
      service.bindEvidence(requestBytes(), { extractionId, m04Bindability: "NOT_BINDABLE" }),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "M03_BUNDLE_SCHEMA_INVALID",
      diagnostics: [
        {
          code: "SCHEMA_INVALID",
          stage: "BUNDLE",
          subjectKind: "EXTRACTION",
          subjectIdOrNull: null,
        },
      ],
    });
    await expect(
      service.bindEvidence(requestBytes(), {
        m04Bindability: "BINDABLE",
        sourceReferences: Array.from({ length: 4097 }, () => null),
      }),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "M03_BUNDLE_SCHEMA_INVALID",
      diagnostics: [
        {
          code: "SCHEMA_INVALID",
          stage: "BUNDLE",
          subjectKind: "EXTRACTION",
          subjectIdOrNull: null,
        },
      ],
    });
  });

  it("projects stable evidence, claims, links, and blocked completeness", () => {
    const first = projectEvidenceBinding(bundle());
    const second = projectEvidenceBinding(bundle());
    expect(second).toEqual(first);
    expect(first.evidenceItems).toHaveLength(1);
    expect(first.evidenceItems[0]?.id).toMatch(/^evi_[a-f0-9]{64}$/u);
    expect(first.claims).toHaveLength(1);
    expect(first.links).toHaveLength(1);
    expect(first.completeness.coveredRequirements).toBe(1);
    expect(first.completeness.coverageBasisPoints).toBe(909);
    expect(first.completeness.m05Progression).toBe("BLOCKED");
  });

  it("maps ordinary document references without exposing display authority", () => {
    const value = bundle();
    value.sourceReferences = [
      {
        kind: "DOCUMENT",
        id: "src_1",
        sourceSnapshotId: "snapshot-1",
        sourceEntryId: "entry-1",
        sourceDocumentId: "document-1",
        ownership: "CANDIDATE_OWNED",
        locator: { type: "TREE_PATH", path: "SKILL.md" },
        contentHash: sha,
        excerptHashOrNull: null,
        excerptOrNull: null,
      },
    ];
    const evidence = projectEvidenceBinding(value).evidenceItems[0];
    expect(evidence).toMatchObject({
      evidenceType: "FILE_STRUCTURE",
      excerptState: "NOT_APPLICABLE",
      visibility: "INTERNAL_EVIDENCE",
      displayAuthorization: "NOT_GRANTED",
    });
  });
});
