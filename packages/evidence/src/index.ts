import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  EvidenceBindingRequestV1Schema,
  M04_TERMINAL_DIAGNOSTIC_RULES_V1,
  M04_MATERIAL_REQUIREMENTS_V1,
  StructuredExtractionBundleV2Schema,
  canonicalJsonM03,
  compareUnsignedUtf8,
  type ClaimEvidenceLinkV1,
  type ClaimV1,
  type EvidenceBindingRequestV1,
  type EvidenceBindingResultV1,
  type EvidenceCompletenessV1,
  type EvidenceItemV1,
  type ExtractionFieldResultV1,
  type ExtractionSourceReferenceV1,
  type StructuredExtractionBundleV2,
  type StructuredExtractionBundleV1,
} from "@ai-ark/contracts";

type StructuredExtractionBundle = StructuredExtractionBundleV1 | StructuredExtractionBundleV2;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const canonicalBytes = (value: unknown): Uint8Array => encoder.encode(canonicalJsonM03(value));

function withoutKeys(value: object, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function withIdentity<
  T extends Record<string, unknown>,
  P extends "evi_" | "clm_" | "cel_" | "cmp_",
>(prefix: P, value: T): T & { id: `${P}${string}`; recordFingerprint: string } {
  const id: `${P}${string}` = `${prefix}${sha256(canonicalJsonM03(value))}`;
  const record = { ...value, id };
  return { ...record, recordFingerprint: sha256(canonicalJsonM03(record)) };
}

function evidenceKind(reference: ExtractionSourceReferenceV1): {
  evidenceType: EvidenceItemV1["evidenceType"];
  excerptState: EvidenceItemV1["excerptState"];
} {
  if (reference.kind === "INVENTORY_ABSENCE")
    return { evidenceType: "INVENTORY_ABSENCE", excerptState: "NOT_APPLICABLE" };
  if (reference.kind === "SNAPSHOT_METADATA") {
    return {
      evidenceType:
        reference.locator.type === "RELEASE_FIELD" ? "RELEASE_METADATA" : "REPOSITORY_METADATA",
      excerptState: "NOT_APPLICABLE",
    };
  }
  const originalType =
    reference.locator.type === "SENSITIVE_LOCATOR"
      ? reference.locator.originalType
      : reference.locator.type;
  const evidenceType =
    originalType === "JSON_POINTER" || originalType === "DATA_POINTER"
      ? "MANIFEST_FIELD"
      : originalType === "TREE_PATH" || originalType === "FILE_METADATA"
        ? "FILE_STRUCTURE"
        : "SOURCE_TEXT";
  const excerptState =
    reference.locator.type === "SENSITIVE_LOCATOR"
      ? "OMITTED"
      : evidenceType === "FILE_STRUCTURE"
        ? "NOT_APPLICABLE"
        : reference.excerptOrNull !== null
          ? "RETAINED_INTERNAL"
          : "OMITTED";
  return { evidenceType, excerptState };
}

function projectEvidence(
  reference: ExtractionSourceReferenceV1,
  bundle: StructuredExtractionBundle,
): EvidenceItemV1 {
  const kind = evidenceKind(reference);
  const document = reference.kind === "DOCUMENT";
  const base = {
    schemaVersion: "M04_EVIDENCE_ITEM_V1" as const,
    extractionId: bundle.extractionId,
    m03SourceReferenceId: reference.id,
    sourceSnapshotId: reference.sourceSnapshotId,
    sourceRevision: bundle.m02.sourceRevision,
    evidenceType: kind.evidenceType,
    locatorOrNull: reference.kind === "INVENTORY_ABSENCE" ? null : reference.locator,
    sourceEntryIdOrNull: document ? reference.sourceEntryId : null,
    sourceDocumentIdOrNull: document ? reference.sourceDocumentId : null,
    contentFingerprint: reference.contentHash,
    excerptState: kind.excerptState,
    excerptOrNull:
      kind.excerptState === "RETAINED_INTERNAL" && document ? reference.excerptOrNull : null,
    visibility: "INTERNAL_EVIDENCE" as const,
    displayAuthorization: "NOT_GRANTED" as const,
  };
  return withIdentity("evi_", base);
}

function claimStatus(field: ExtractionFieldResultV1): ClaimV1["status"] {
  if (field.status === "INFERRED") return "SUPPORTED_WITH_QUALIFIER";
  if (field.status === "CONFLICTING") return "AMBIGUOUS";
  if (field.status === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  return "SUPPORTED";
}

function relationship(field: ExtractionFieldResultV1): ClaimEvidenceLinkV1["relationship"] {
  if (field.status === "CONFLICTING") return "CONTEXT_ONLY";
  if (field.status === "INFERRED" || field.status === "REVIEW_REQUIRED") return "QUALIFIES";
  return "SUPPORTS";
}

function projectClaim(field: ExtractionFieldResultV1, bundle: StructuredExtractionBundle): ClaimV1 {
  if (field.claimClass === "NO_CLAIM") throw new Error("M04_NO_CLAIM_PROJECTION_PROHIBITED");
  const base = {
    schemaVersion: "M04_CLAIM_V1" as const,
    extractionId: bundle.extractionId,
    resourceIdentityId: bundle.m02.resourceIdentityId,
    resourceVersionIdentityId: bundle.m02.resourceVersionIdentityId,
    fieldKey: field.fieldKey,
    value: field.value,
    claimClass: field.claimClass,
    status: claimStatus(field),
    confidenceOrNull: field.confidence,
    deterministicCandidateIds: [...field.deterministicCandidateIds],
    aiProposalIds: [...field.aiProposalIds],
    conflictIds: [...field.conflictIds],
    warningCodes: [...field.warningCodes],
  };
  return withIdentity("clm_", base);
}

function gapStatus(
  fields: readonly ExtractionFieldResultV1[],
): EvidenceCompletenessV1["requirements"][number]["status"] {
  if (fields.some(({ status }) => status === "CONFLICTING")) return "AMBIGUOUS";
  if (fields.some(({ status }) => status === "REVIEW_REQUIRED")) return "REVIEW_REQUIRED";
  if (fields.some(({ status }) => status === "UNSUPPORTED")) return "UNSUPPORTED";
  return "MISSING";
}

export interface ProjectedEvidenceBindingV1 {
  readonly evidenceItems: readonly EvidenceItemV1[];
  readonly claims: readonly ClaimV1[];
  readonly links: readonly ClaimEvidenceLinkV1[];
  readonly completeness: EvidenceCompletenessV1;
}

export function projectEvidenceBinding(
  bundle: StructuredExtractionBundle,
): ProjectedEvidenceBindingV1 {
  const evidenceItems = bundle.sourceReferences.map((reference) =>
    projectEvidence(reference, bundle),
  );
  const evidenceByReference = new Map(
    evidenceItems.map((item) => [item.m03SourceReferenceId, item]),
  );
  const claimFields = bundle.fields.filter(
    (field) =>
      field.claimClass !== "NO_CLAIM" &&
      field.status !== "MISSING" &&
      field.status !== "UNSUPPORTED",
  );
  const claims = claimFields.map((field) => projectClaim(field, bundle));
  const claimByField = new Map(claims.map((claim) => [claim.fieldKey, claim]));
  const links = claimFields.flatMap((field) => {
    const claim = claimByField.get(field.fieldKey);
    if (!claim) throw new Error("M04_CLAIM_PROJECTION_MISSING");
    return field.evidenceIds.map((referenceId, ordinal) => {
      const evidence = evidenceByReference.get(referenceId);
      if (!evidence) throw new Error("M04_DANGLING_EVIDENCE_REFERENCE");
      return withIdentity("cel_", {
        schemaVersion: "M04_CLAIM_EVIDENCE_LINK_V1" as const,
        claimId: claim.id,
        evidenceItemId: evidence.id,
        m03SourceReferenceId: referenceId,
        relationship: relationship(field),
        ordinal,
      });
    });
  });
  const linksByClaim = new Map<string, ClaimEvidenceLinkV1[]>();
  for (const link of links) {
    const existing = linksByClaim.get(link.claimId);
    if (existing) existing.push(link);
    else linksByClaim.set(link.claimId, [link]);
  }
  const requirements = M04_MATERIAL_REQUIREMENTS_V1.map(([key, fieldKeys]) => {
    const matchingFields = fieldKeys.map((fieldKey) =>
      bundle.fields.find((field) => field.fieldKey === fieldKey),
    );
    if (matchingFields.some((field) => field === undefined))
      throw new Error("M04_FIELD_REGISTRY_INCOMPLETE");
    const typedFields = matchingFields.filter(
      (field): field is ExtractionFieldResultV1 => field !== undefined,
    );
    const eligibleClaims = fieldKeys
      .map((fieldKey) => claimByField.get(fieldKey))
      .filter((claim): claim is ClaimV1 => claim !== undefined)
      .filter(
        (claim) =>
          (claim.status === "SUPPORTED" || claim.status === "SUPPORTED_WITH_QUALIFIER") &&
          (linksByClaim.get(claim.id)?.length ?? 0) > 0 &&
          claim.conflictIds.length === 0,
      );
    const covered = eligibleClaims.length > 0;
    return {
      key,
      status: covered ? ("COVERED" as const) : gapStatus(typedFields),
      claimIds: eligibleClaims.map(({ id: claimId }) => claimId),
      evidenceItemIds: eligibleClaims.flatMap((claim) =>
        (linksByClaim.get(claim.id) ?? []).map(({ evidenceItemId }) => evidenceItemId),
      ),
    };
  });
  const coveredRequirements = requirements.filter(({ status }) => status === "COVERED").length;
  const unresolvedConflictIds = [...new Set(claims.flatMap(({ conflictIds }) => conflictIds))].sort(
    compareUnsignedUtf8,
  );
  const blockingRequirementKeys = requirements
    .filter(({ status }) => status !== "COVERED")
    .map(({ key }) => key);
  const completenessBase = {
    schemaVersion: "M04_EVIDENCE_COMPLETENESS_V1" as const,
    registryVersion: "m04-material-fields-v1" as const,
    totalRequirements: 11 as const,
    coveredRequirements,
    coverageBasisPoints: Math.floor((coveredRequirements * 10_000) / 11),
    requirements,
    unresolvedConflictIds,
    blockingRequirementKeys,
    m05Progression:
      coveredRequirements === 11 &&
      unresolvedConflictIds.length === 0 &&
      blockingRequirementKeys.length === 0
        ? ("ELIGIBLE" as const)
        : ("BLOCKED" as const),
  };
  return {
    evidenceItems,
    claims,
    links,
    completeness: withIdentity("cmp_", completenessBase),
  };
}

export function m03LogicalProjection(bundle: StructuredExtractionBundle): Record<string, unknown> {
  return {
    ...withoutKeys(bundle, ["createdAt", "analysisAttempts"]),
    analysisAttempts: bundle.analysisAttempts.map((attempt) =>
      withoutKeys(attempt, ["durationMsOrNull", "tokenCountsOrNull", "providerRequestIdOrNull"]),
    ),
  };
}

export function recomputeM03OutputFingerprint(bundle: StructuredExtractionBundle): string {
  return sha256(canonicalJsonM03(withoutKeys(m03LogicalProjection(bundle), ["outputFingerprint"])));
}

export interface EvidenceBindingCandidateV1 extends ProjectedEvidenceBindingV1 {
  readonly request: EvidenceBindingRequestV1;
  readonly requestCanonicalPayload: Uint8Array;
  readonly requestFingerprint: string;
  readonly semanticRequestFingerprint: string;
  readonly bundle: StructuredExtractionBundleV2;
  readonly bundleCanonicalPayload: Uint8Array;
  readonly bundleCanonicalSha256: string;
  readonly logicalPayload: Uint8Array;
  readonly logicalPayloadSha256: string;
}

export interface EvidencePersistencePortV1 {
  persistAccepted(candidate: EvidenceBindingCandidateV1): Promise<EvidenceBindingResultV1>;
}

function malformed(
  raw: Uint8Array,
  error: "RAW_REQUEST_TOO_LARGE" | "REQUEST_JSON_INVALID" | "REQUEST_SCHEMA_INVALID",
  fieldOrNull: "ROOT" | keyof EvidenceBindingRequestV1 = "ROOT",
): EvidenceBindingResultV1 {
  return {
    kind: "MALFORMED",
    rawRequestSha256: sha256(raw),
    error,
    diagnostics: [
      {
        code: error,
        fieldOrNull,
        observedByteLengthOrNull: error === "RAW_REQUEST_TOO_LARGE" ? raw.byteLength : null,
        limitOrNull: error === "RAW_REQUEST_TOO_LARGE" ? 262_144 : null,
      },
    ],
  };
}

function mismatchResult(
  requestFingerprint: string,
  request: EvidenceBindingRequestV1,
  bundle: StructuredExtractionBundleV2,
): EvidenceBindingResultV1 {
  const recomputedOutputFingerprint = recomputeM03OutputFingerprint(bundle);
  const orderedChecks: readonly [keyof EvidenceBindingRequestV1, unknown, unknown][] = [
    ["extractionId", request.extractionId, bundle.extractionId],
    [
      "expectedM03OutputFingerprint",
      request.expectedM03OutputFingerprint,
      recomputedOutputFingerprint,
    ],
    [
      "expectedResourceIdentityId",
      request.expectedResourceIdentityId,
      bundle.m02.resourceIdentityId,
    ],
    [
      "expectedResourceVersionIdentityId",
      request.expectedResourceVersionIdentityId,
      bundle.m02.resourceVersionIdentityId,
    ],
    ["expectedSourceSnapshotId", request.expectedSourceSnapshotId, bundle.m02.sourceSnapshotId],
    ["expectedSourceRevision", request.expectedSourceRevision, bundle.m02.sourceRevision],
    ["expectedPredecessorState", request.expectedPredecessorState, bundle.expectedPredecessorState],
  ];
  const mismatch = orderedChecks.find(
    ([, expectedValue, actualValue]) =>
      canonicalJsonM03(expectedValue) !== canonicalJsonM03(actualValue),
  );
  const fallback = orderedChecks[0];
  if (fallback === undefined) throw new Error("M04_LINEAGE_CHECK_REGISTRY_EMPTY");
  const [field, expectedValue, actualValue] = mismatch ?? fallback;
  const expected = sha256(canonicalJsonM03(expectedValue));
  const actual = sha256(canonicalJsonM03(actualValue));
  const [code, stage, subjectKind] = M04_TERMINAL_DIAGNOSTIC_RULES_V1.LINEAGE_MISMATCH;
  const diagnostics = [
    {
      code,
      stage,
      subjectKind,
      subjectIdOrNull: field,
      expectedFingerprintOrNull: expected,
      actualFingerprintOrNull: actual,
      observedCountOrNull: null,
      limitOrNull: null,
    },
  ];
  const core = {
    kind: "REJECTED" as const,
    requestFingerprint,
    error: "LINEAGE_MISMATCH" as const,
    diagnostics,
  };
  const resultId = `m4r_${sha256(canonicalJsonM03(core))}` as const;
  return {
    ...core,
    resultId,
    resultFingerprint: sha256(
      canonicalJsonM03({ schemaVersion: "M04_RESULT_V1", resultId, ...core }),
    ),
  };
}

function invalidBundleResult(requestFingerprint: string): EvidenceBindingResultV1 {
  const [code, stage, subjectKind] = M04_TERMINAL_DIAGNOSTIC_RULES_V1.M03_BUNDLE_SCHEMA_INVALID;
  const diagnostics = [
    {
      code,
      stage,
      subjectKind,
      subjectIdOrNull: null,
      expectedFingerprintOrNull: null,
      actualFingerprintOrNull: null,
      observedCountOrNull: null,
      limitOrNull: null,
    },
  ];
  const core = {
    kind: "REJECTED" as const,
    requestFingerprint,
    error: "M03_BUNDLE_SCHEMA_INVALID" as const,
    diagnostics,
  };
  const resultId = `m4r_${sha256(canonicalJsonM03(core))}` as const;
  return {
    ...core,
    resultId,
    resultFingerprint: sha256(
      canonicalJsonM03({ schemaVersion: "M04_RESULT_V1", resultId, ...core }),
    ),
  };
}

function rejectedResult(
  requestFingerprint: string,
  error: "M03_NOT_BINDABLE" | "DANGLING_REFERENCE" | "EVIDENCE_CLOSURE_INVALID" | "BOUND_EXCEEDED",
  subjectIdOrNull: string | null,
  observedCountOrNull: number | null = null,
  limitOrNull: number | null = null,
): EvidenceBindingResultV1 {
  const [code, stage, subjectKind] = M04_TERMINAL_DIAGNOSTIC_RULES_V1[error];
  const diagnostic = {
    code,
    stage,
    subjectKind,
    subjectIdOrNull,
    expectedFingerprintOrNull: null,
    actualFingerprintOrNull: null,
    observedCountOrNull,
    limitOrNull,
  };
  const core = { kind: "REJECTED" as const, requestFingerprint, error, diagnostics: [diagnostic] };
  const resultId = `m4r_${sha256(canonicalJsonM03(core))}` as const;
  return {
    ...core,
    resultId,
    resultFingerprint: sha256(
      canonicalJsonM03({ schemaVersion: "M04_RESULT_V1", resultId, ...core }),
    ),
  };
}

function firstBundleBound(
  value: unknown,
): { readonly subject: string; readonly observed: number; readonly limit: number } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const [subject, limit] of [
    ["sourceReferences", 4096],
    ["extractorRefs", 128],
    ["deterministicCandidates", 8192],
    ["conflicts", 1024],
    ["analysisAttempts", 2],
    ["aiProposals", 512],
    ["laterProgressionBlockers", 20],
    ["warningCodes", 29],
  ] as const) {
    const candidate = record[subject];
    if (Array.isArray(candidate) && candidate.length > limit)
      return { subject, observed: candidate.length, limit };
  }
  return undefined;
}

export class EvidenceBindingServiceV1 {
  public constructor(private readonly persistence: EvidencePersistencePortV1) {}

  public async bindEvidence(
    rawRequestBytes: Uint8Array,
    bundleValue: unknown,
  ): Promise<EvidenceBindingResultV1> {
    if (rawRequestBytes.byteLength > 262_144)
      return malformed(rawRequestBytes, "RAW_REQUEST_TOO_LARGE");
    let parsedRequest: unknown;
    try {
      parsedRequest = JSON.parse(decoder.decode(rawRequestBytes));
    } catch {
      return malformed(rawRequestBytes, "REQUEST_JSON_INVALID");
    }
    const requestResult = EvidenceBindingRequestV1Schema.safeParse(parsedRequest);
    if (!requestResult.success) {
      const firstPath = requestResult.error.issues[0]?.path[0];
      const field =
        typeof firstPath === "string" && firstPath in EvidenceBindingRequestV1Schema.shape
          ? firstPath
          : "ROOT";
      return malformed(
        rawRequestBytes,
        "REQUEST_SCHEMA_INVALID",
        field as "ROOT" | keyof EvidenceBindingRequestV1,
      );
    }
    const request = requestResult.data;
    const requestPayload = canonicalBytes(request);
    const requestFingerprint = sha256(requestPayload);
    const bundleResult = StructuredExtractionBundleV2Schema.safeParse(bundleValue);
    if (!bundleResult.success) return invalidBundleResult(requestFingerprint);
    const bundle = bundleResult.data;
    const bound = firstBundleBound(bundle);
    if (bound !== undefined)
      return rejectedResult(
        requestFingerprint,
        "BOUND_EXCEEDED",
        bound.subject,
        bound.observed,
        bound.limit,
      );
    if (
      recomputeM03OutputFingerprint(bundle) !== bundle.outputFingerprint ||
      request.extractionId !== bundle.extractionId ||
      request.expectedM03OutputFingerprint !== bundle.outputFingerprint ||
      request.expectedResourceIdentityId !== bundle.m02.resourceIdentityId ||
      request.expectedResourceVersionIdentityId !== bundle.m02.resourceVersionIdentityId ||
      request.expectedSourceSnapshotId !== bundle.m02.sourceSnapshotId ||
      request.expectedSourceRevision !== bundle.m02.sourceRevision ||
      canonicalJsonM03(request.expectedPredecessorState) !==
        canonicalJsonM03(bundle.expectedPredecessorState)
    )
      return mismatchResult(requestFingerprint, request, bundle);
    const semanticRequest = withoutKeys(request, ["idempotencyKey"]);
    const bundleCanonicalPayload = canonicalBytes(bundle);
    const logicalPayload = canonicalBytes(m03LogicalProjection(bundle));
    let projection: ProjectedEvidenceBindingV1;
    try {
      projection = projectEvidenceBinding(bundle);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "M04_DANGLING_EVIDENCE_REFERENCE") {
        const known = new Set(bundle.sourceReferences.map(({ id: sourceId }) => sourceId));
        const first = bundle.fields
          .flatMap(({ evidenceIds }) => evidenceIds)
          .find((sourceId) => !known.has(sourceId));
        return rejectedResult(
          requestFingerprint,
          "DANGLING_REFERENCE",
          first ?? "UNKNOWN_REFERENCE",
        );
      }
      return rejectedResult(requestFingerprint, "EVIDENCE_CLOSURE_INVALID", bundle.extractionId);
    }
    return this.persistence.persistAccepted({
      request,
      requestCanonicalPayload: requestPayload,
      requestFingerprint,
      semanticRequestFingerprint: sha256(canonicalBytes(semanticRequest)),
      bundle,
      bundleCanonicalPayload,
      bundleCanonicalSha256: sha256(bundleCanonicalPayload),
      logicalPayload,
      logicalPayloadSha256: sha256(logicalPayload),
      ...projection,
    });
  }
}
