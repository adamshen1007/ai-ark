import { describe, expect, it } from "vitest";

import {
  ClaimV1Schema,
  EvidenceBindingRequestV1Schema,
  decodeM04IdempotencyKeyFromDatabase,
  encodeM04IdempotencyKeyForDatabase,
  isValidM04IdempotencyKey,
  EvidenceCompletenessV1Schema,
  EvidenceItemV1Schema,
  M04_MATERIAL_REQUIREMENTS_V1,
  M04_TERMINAL_DIAGNOSTIC_RULES_V1,
  M04AlternateUniqueKeyKindV1Schema,
  SafeDiagnosticV1Schema,
} from "./index.js";

const sha = "a".repeat(64);

describe("M04 contracts", () => {
  it("accepts an exact request and rejects unknown keys", () => {
    const request = {
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "request-1",
      extractionId: `ext_${sha}`,
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
    };
    expect(EvidenceBindingRequestV1Schema.parse(request)).toEqual(request);
    expect(EvidenceBindingRequestV1Schema.safeParse({ ...request, extra: true }).success).toBe(
      false,
    );
    expect(
      EvidenceBindingRequestV1Schema.safeParse({ ...request, idempotencyKey: "界".repeat(100) })
        .success,
    ).toBe(false);
    expect(
      EvidenceBindingRequestV1Schema.safeParse({ ...request, idempotencyKey: "\u0000" }).success,
    ).toBe(true);
    for (const idempotencyKey of ["\ud800", "\udc00", "a".repeat(201)])
      expect(EvidenceBindingRequestV1Schema.safeParse({ ...request, idempotencyKey }).success).toBe(
        false,
      );
  });

  it("encodes every valid idempotency key byte-exactly and rejects invalid Unicode", () => {
    const keys = [
      "a",
      "00",
      "\u0000",
      "\u0000\u0000",
      "\u0001",
      "\u0000\u0001",
      "\n\t\r",
      '"\\',
      "界",
      "😀",
      "a".repeat(200),
      "界".repeat(66) + "ab",
      "shared-prefix-a",
      "shared-prefix-b",
    ];
    const encoded = keys.map(encodeM04IdempotencyKeyForDatabase);
    expect(new Set(encoded).size).toBe(keys.length);
    for (const [index, key] of keys.entries()) {
      const encodedKey = encoded[index];
      if (encodedKey === undefined) throw new Error("missing encoded key");
      expect(decodeM04IdempotencyKeyFromDatabase(encodedKey)).toBe(key);
      expect(encodedKey).toMatch(/^(?:[0-9a-f]{2}){1,200}$/u);
    }
    expect(encodeM04IdempotencyKeyForDatabase("\u0000")).toBe("00");
    expect(encodeM04IdempotencyKeyForDatabase("00")).toBe("3030");
    for (const key of ["", "a".repeat(201), "\ud800", "\udc00", "a\ud800b"]) {
      expect(isValidM04IdempotencyKey(key)).toBe(false);
      expect(() => encodeM04IdempotencyKeyForDatabase(key)).toThrow("M04_IDEMPOTENCY_KEY_INVALID");
    }
    for (const malformed of ["", "0", "ABC0", "00g0", "00".repeat(201), "ff", "eda080"])
      expect(() => decodeM04IdempotencyKeyFromDatabase(malformed)).toThrow(
        "M04_STORED_IDEMPOTENCY_KEY_INVALID",
      );
  });

  it("enforces evidence locator and excerpt cross-field rules", () => {
    const base = {
      schemaVersion: "M04_EVIDENCE_ITEM_V1",
      id: `evi_${sha}`,
      extractionId: `ext_${sha}`,
      m03SourceReferenceId: "src_1",
      sourceSnapshotId: "snapshot-1",
      sourceRevision: "b".repeat(40),
      evidenceType: "INVENTORY_ABSENCE",
      locatorOrNull: null,
      sourceEntryIdOrNull: null,
      sourceDocumentIdOrNull: null,
      contentFingerprint: sha,
      excerptState: "NOT_APPLICABLE",
      excerptOrNull: null,
      visibility: "INTERNAL_EVIDENCE",
      displayAuthorization: "NOT_GRANTED",
      recordFingerprint: sha,
    };
    expect(EvidenceItemV1Schema.safeParse(base).success).toBe(true);
    expect(
      EvidenceItemV1Schema.safeParse({ ...base, excerptState: "RETAINED_INTERNAL" }).success,
    ).toBe(false);

    const document = {
      ...base,
      evidenceType: "SOURCE_TEXT",
      locatorOrNull: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
      sourceEntryIdOrNull: "entry-1",
      sourceDocumentIdOrNull: "document-1",
      excerptState: "RETAINED_INTERNAL",
      excerptOrNull: "😀".repeat(2000),
    };
    expect(EvidenceItemV1Schema.safeParse(document).success).toBe(true);
    expect(
      EvidenceItemV1Schema.safeParse({ ...document, excerptOrNull: "😀".repeat(2001) }).success,
    ).toBe(false);
    expect(
      EvidenceItemV1Schema.safeParse({
        ...document,
        evidenceType: "MANIFEST_FIELD",
      }).success,
    ).toBe(false);
    expect(
      EvidenceItemV1Schema.safeParse({
        ...document,
        locatorOrNull: { type: "JSON_POINTER", path: "package.json", jsonPointer: "/name" },
      }).success,
    ).toBe(false);
    expect(
      EvidenceItemV1Schema.safeParse({
        ...document,
        evidenceType: "MANIFEST_FIELD",
        locatorOrNull: { type: "JSON_POINTER", path: "package.json", jsonPointer: "/name" },
      }).success,
    ).toBe(true);
  });

  it("enforces the M03 status-derived claim matrix", () => {
    const claim = {
      schemaVersion: "M04_CLAIM_V1",
      id: `clm_${sha}`,
      extractionId: `ext_${sha}`,
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      fieldKey: "canonical_skill_name",
      value: null,
      claimClass: "AI_INFERENCE",
      status: "SUPPORTED_WITH_QUALIFIER",
      confidenceOrNull: 0.7,
      deterministicCandidateIds: [],
      aiProposalIds: ["proposal-1"],
      conflictIds: [],
      warningCodes: [],
      recordFingerprint: sha,
    };
    expect(ClaimV1Schema.safeParse(claim).success).toBe(true);
    expect(ClaimV1Schema.safeParse({ ...claim, confidenceOrNull: 0.9 }).success).toBe(false);
    expect(ClaimV1Schema.safeParse({ ...claim, status: "AMBIGUOUS" }).success).toBe(false);
    expect(
      ClaimV1Schema.safeParse({
        ...claim,
        status: "AMBIGUOUS",
        confidenceOrNull: null,
        conflictIds: ["conflict-1"],
      }).success,
    ).toBe(true);
  });

  it("freezes eleven material requirements", () => {
    expect(M04_MATERIAL_REQUIREMENTS_V1).toHaveLength(11);
    const requirements = M04_MATERIAL_REQUIREMENTS_V1.map(([key]) => ({
      key,
      status: "MISSING" as const,
      claimIds: [],
      evidenceItemIds: [],
    }));
    const completeness = {
      schemaVersion: "M04_EVIDENCE_COMPLETENESS_V1",
      id: `cmp_${sha}`,
      registryVersion: "m04-material-fields-v1",
      totalRequirements: 11,
      coveredRequirements: 0,
      coverageBasisPoints: 0,
      requirements,
      unresolvedConflictIds: [],
      blockingRequirementKeys: requirements.map(({ key }) => key),
      m05Progression: "BLOCKED",
      recordFingerprint: sha,
    };
    expect(EvidenceCompletenessV1Schema.safeParse(completeness).success).toBe(true);
    expect(
      EvidenceCompletenessV1Schema.safeParse({
        ...completeness,
        coverageBasisPoints: 10000,
        m05Progression: "ELIGIBLE",
      }).success,
    ).toBe(false);
  });

  it("bounds completeness evidence occurrences by the material requirement's field count", () => {
    const completenessFor = (coveredKey: string, evidenceCount: number) => {
      const requirements = M04_MATERIAL_REQUIREMENTS_V1.map(([key]) => ({
        key,
        status: key === coveredKey ? "COVERED" : "MISSING",
        claimIds:
          key !== coveredKey
            ? []
            : key === "attribution"
              ? [`clm_${sha}`, `clm_${"b".repeat(64)}`]
              : [`clm_${sha}`],
        evidenceItemIds:
          key === coveredKey ? Array.from({ length: evidenceCount }, () => `evi_${sha}`) : [],
      }));
      return {
        schemaVersion: "M04_EVIDENCE_COMPLETENESS_V1",
        id: `cmp_${sha}`,
        registryVersion: "m04-material-fields-v1",
        totalRequirements: 11,
        coveredRequirements: 1,
        coverageBasisPoints: 909,
        requirements,
        unresolvedConflictIds: [],
        blockingRequirementKeys: requirements
          .filter(({ status }) => status !== "COVERED")
          .map(({ key }) => key),
        m05Progression: "BLOCKED",
        recordFingerprint: sha,
      };
    };
    // Creator and organization can cite the same 4,096 EvidenceItems. The
    // projection preserves each claim's ordered occurrences, not a set union.
    expect(
      EvidenceCompletenessV1Schema.safeParse(completenessFor("attribution", 8192)).success,
    ).toBe(true);
    expect(
      EvidenceCompletenessV1Schema.safeParse(completenessFor("attribution", 8193)).success,
    ).toBe(false);
    expect(EvidenceCompletenessV1Schema.safeParse(completenessFor("identity", 4096)).success).toBe(
      true,
    );
    expect(EvidenceCompletenessV1Schema.safeParse(completenessFor("identity", 4097)).success).toBe(
      false,
    );
  });

  it("requires deterministic fingerprint pairs in mismatch diagnostics", () => {
    const diagnostic = {
      code: "REQUEST_MISMATCH",
      stage: "ELIGIBILITY",
      subjectKind: "EXTRACTION",
      subjectIdOrNull: "ext-1",
      expectedFingerprintOrNull: null,
      actualFingerprintOrNull: null,
      observedCountOrNull: null,
      limitOrNull: null,
    };
    expect(SafeDiagnosticV1Schema.safeParse(diagnostic).success).toBe(false);
    expect(
      SafeDiagnosticV1Schema.safeParse({
        ...diagnostic,
        expectedFingerprintOrNull: sha,
        actualFingerprintOrNull: sha,
      }).success,
    ).toBe(true);
  });

  it("freezes every terminal diagnostic code, stage, and default subject kind", () => {
    expect(M04_TERMINAL_DIAGNOSTIC_RULES_V1).toEqual({
      IDEMPOTENCY_KEY_REUSED: ["REQUEST_MISMATCH", "ELIGIBILITY", "EXTRACTION"],
      BINDING_REQUEST_MISMATCH: ["REQUEST_MISMATCH", "ELIGIBILITY", "EXTRACTION"],
      M03_BUNDLE_SCHEMA_INVALID: ["SCHEMA_INVALID", "BUNDLE", "EXTRACTION"],
      M03_NOT_BINDABLE: ["SCHEMA_INVALID", "ELIGIBILITY", "EXTRACTION"],
      LINEAGE_MISMATCH: ["EXPECTED_ACTUAL_MISMATCH", "ELIGIBILITY", "PREDECESSOR"],
      PREDECESSOR_NOT_CURRENT: ["PREDECESSOR_STALE", "ELIGIBILITY", "PREDECESSOR"],
      DANGLING_REFERENCE: ["REFERENCE_INVALID", "PROJECTION", "EVIDENCE"],
      EVIDENCE_CLOSURE_INVALID: ["CLOSURE_INVALID", "PROJECTION", "CLAIM"],
      BOUND_EXCEEDED: ["BOUND_EXCEEDED", "PROJECTION", "BUNDLE"],
      CONTENT_HASH_COLLISION: ["HASH_COLLISION", "PERSISTENCE", "BUNDLE"],
      ALTERNATE_UNIQUE_KEY_CONFLICT: ["UNIQUE_KEY_CONFLICT", "PROJECTION", "EVIDENCE"],
      SERIALIZATION_FAILED: ["PERSISTENCE_FAILURE", "PERSISTENCE", "DATABASE"],
      SERIALIZATION_RETRY_EXHAUSTED: ["SERIALIZATION_EXHAUSTED", "PERSISTENCE", "DATABASE"],
      PERSISTENCE_UNAVAILABLE: ["PERSISTENCE_FAILURE", "PERSISTENCE", "DATABASE"],
      PERSISTENCE_INTEGRITY_FAILED: ["PERSISTENCE_FAILURE", "PERSISTENCE", "DATABASE"],
    });
  });

  it("keeps alternate unique conflicts a distinct strict diagnostic arm", () => {
    const diagnostic = {
      code: "UNIQUE_KEY_CONFLICT",
      stage: "PROJECTION",
      subjectKind: "EVIDENCE",
      subjectIdOrNull: `evi_${sha}`,
      expectedFingerprintOrNull: sha,
      actualFingerprintOrNull: "b".repeat(64),
      alternateKeyKind: "EVIDENCE_EXTRACTION_REFERENCE",
      observedCountOrNull: null,
      limitOrNull: null,
    };
    expect(M04AlternateUniqueKeyKindV1Schema.options).toHaveLength(7);
    expect(SafeDiagnosticV1Schema.safeParse(diagnostic).success).toBe(true);
    expect(SafeDiagnosticV1Schema.safeParse({ ...diagnostic, extra: true }).success).toBe(false);
    expect(
      SafeDiagnosticV1Schema.safeParse({ ...diagnostic, alternateKeyKind: "BINDING_ID" }).success,
    ).toBe(false);
    expect(
      SafeDiagnosticV1Schema.safeParse({ ...diagnostic, actualFingerprintOrNull: null }).success,
    ).toBe(false);
  });
});
