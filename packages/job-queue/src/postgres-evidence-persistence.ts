import { createHash, randomBytes } from "node:crypto";

import {
  EvidenceBindingRequestV1Schema,
  decodeM04IdempotencyKeyFromDatabase,
  encodeM04IdempotencyKeyForDatabase,
  EvidenceItemV1Schema,
  ClaimV1Schema,
  ClaimEvidenceLinkV1Schema,
  M04_TERMINAL_DIAGNOSTIC_RULES_V1,
  M03M02InputProjectionV1Schema,
  EvidenceCompletenessV1Schema,
  StructuredExtractionBundleV2Schema,
  canonicalJsonM03,
  type M04AlternateUniqueKeyKindV1,
  type SafeDiagnosticV1,
  type EvidenceBindingResultV1,
  type StructuredExtractionBundleV2,
} from "@ai-ark/contracts";
import {
  m03LogicalProjection,
  projectEvidenceBinding,
  recomputeM03OutputFingerprint,
  type EvidenceBindingCandidateV1,
  type EvidencePersistencePortV1,
} from "@ai-ark/evidence";
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import { assertExactApplicationAcl } from "./postgres-acl-closure.js";
import { expectedM02Triggers } from "./postgres-m02-function-sources.js";
import { expectedM04Functions, expectedM04Triggers } from "./postgres-m04-function-sources.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength &&
  Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
const canonicalBytes = (value: unknown): Buffer => Buffer.from(canonicalJsonM03(value), "utf8");

interface CanonicalCollisionV1 {
  readonly stage: "BUNDLE" | "PROJECTION" | "PERSISTENCE";
  readonly kind:
    | "BUNDLE"
    | "REQUEST_ASSOCIATION"
    | "EVIDENCE"
    | "CLAIM"
    | "LINK"
    | "COMPLETENESS"
    | "BINDING_RESULT";
  readonly subjectId: string;
  readonly fingerprint: string;
  readonly incomingFingerprint?: string;
  readonly alternateKeyKind?: M04AlternateUniqueKeyKindV1;
}

function validateAlternateIncumbent(
  kind: CanonicalCollisionV1["kind"],
  row: { id: string; fingerprint: string; payload: Buffer; [column: string]: unknown },
): void {
  let raw: unknown;
  try {
    raw = JSON.parse(decoder.decode(row.payload));
  } catch {
    throw new PersistenceIntegrityError("M04_STORED_ALTERNATE_PAYLOAD_INVALID", kind, row.id);
  }
  if (kind === "BINDING_RESULT") {
    if (
      typeof raw !== "object" ||
      raw === null ||
      Array.isArray(raw) ||
      Object.keys(raw).sort().join(",") !== "bindingId,completenessId,extractionId,kind"
    )
      throw new PersistenceIntegrityError("M04_STORED_ALTERNATE_PAYLOAD_INVALID", kind, row.id);
    const core = raw as Record<string, unknown>;
    if (
      core.kind !== "ACCEPTED" ||
      row.kind !== "ACCEPTED" ||
      core.bindingId !== row.binding_id ||
      core.completenessId !== row.completeness_id ||
      core.extractionId !== row.extraction_id ||
      !bytesEqual(row.payload, canonicalBytes(core)) ||
      row.id !== `m4r_${sha256(row.payload)}` ||
      row.fingerprint !==
        sha256(canonicalBytes({ schemaVersion: "M04_RESULT_V1", resultId: row.id, ...core }))
    )
      throw new PersistenceIntegrityError("M04_STORED_ALTERNATE_PAYLOAD_INVALID", kind, row.id);
    return;
  }
  const parsed =
    kind === "EVIDENCE"
      ? EvidenceItemV1Schema.safeParse(raw)
      : kind === "CLAIM"
        ? ClaimV1Schema.safeParse(raw)
        : kind === "LINK"
          ? ClaimEvidenceLinkV1Schema.safeParse(raw)
          : kind === "COMPLETENESS"
            ? EvidenceCompletenessV1Schema.safeParse(raw)
            : null;
  if (parsed?.success !== true)
    throw new PersistenceIntegrityError("M04_STORED_ALTERNATE_PAYLOAD_INVALID", kind, row.id);
  const record: Record<string, unknown> = parsed.data;
  const { recordFingerprint, ...withId } = record;
  const { id, ...preimage } = withId;
  const prefix =
    kind === "EVIDENCE" ? "evi_" : kind === "CLAIM" ? "clm_" : kind === "LINK" ? "cel_" : "cmp_";
  if (
    !bytesEqual(row.payload, canonicalBytes(record)) ||
    id !== row.id ||
    recordFingerprint !== row.fingerprint ||
    row.id !== `${prefix}${sha256(canonicalBytes(preimage))}` ||
    row.fingerprint !== sha256(canonicalBytes(withId)) ||
    (kind === "EVIDENCE" &&
      (record.extractionId !== row.extraction_id ||
        record.m03SourceReferenceId !== row.m03_source_reference_id ||
        record.sourceSnapshotId !== row.source_snapshot_id ||
        record.sourceRevision !== row.source_revision ||
        record.sourceEntryIdOrNull !== row.source_entry_id ||
        record.sourceDocumentIdOrNull !== row.source_document_id ||
        record.evidenceType !== row.evidence_type)) ||
    (kind === "CLAIM" &&
      (record.extractionId !== row.extraction_id ||
        record.fieldKey !== row.field_key ||
        record.resourceIdentityId !== row.resource_identity_id ||
        record.resourceVersionIdentityId !== row.resource_version_identity_id ||
        record.status !== row.status ||
        record.claimClass !== row.claim_class)) ||
    (kind === "LINK" &&
      (record.claimId !== row.claim_id ||
        record.evidenceItemId !== row.evidence_item_id ||
        record.ordinal !== row.ordinal ||
        record.m03SourceReferenceId !== row.m03_source_reference_id ||
        record.relationship !== row.relationship)) ||
    (kind === "COMPLETENESS" &&
      (record.coverageBasisPoints !== row.coverage_basis_points ||
        record.m05Progression !== row.m05_progression))
  )
    throw new PersistenceIntegrityError("M04_STORED_ALTERNATE_PAYLOAD_INVALID", kind, row.id);
}

export interface PostgresEvidencePersistenceOptionsV1 {
  readonly schema: string;
  readonly loginRole: string;
  readonly peerLoginRole: string;
  readonly now?: () => Date;
}

const CANONICAL_RELATIONS = [
  "m03_extraction_bundle_chunks",
  "m03_extraction_bundles",
  "m04_binding_requests",
  "m04_binding_results",
  "m04_claim_evidence_links",
  "m04_claims",
  "m04_completeness_snapshots",
  "m04_evidence_items",
] as const;
const PREDECESSOR_RELATIONS = [
  "acquisition_jobs",
  "acquisition_results",
  "candidate_root_ownership",
  "candidate_roots",
  "identity_decisions",
  "m01_source_documents",
  "m01_source_entries",
  "m02_identity_handoff_markers",
  "m02_jobs",
  "m02_review_states",
  "repository_candidate_root_order",
  "resource_candidates",
  "resource_identities",
  "resource_source_links",
  "resource_version_identities",
  "resource_version_observations",
  "source_repository_identities",
  "source_snapshots",
] as const;
const RUNTIME_RELATIONS = [...PREDECESSOR_RELATIONS, ...CANONICAL_RELATIONS].sort((left, right) =>
  Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
);
const RUNTIME_FUNCTIONS = [
  "m03_m04_lock_predecessor_shared()",
  "m03_m04_lock_predecessor_exclusive()",
  "m03_m04_bump_predecessor_epoch()",
  "m04_assert_binding_closure(text)",
  "m04_canonical_json(jsonb)",
  "m04_payload_is_canonical_json(bytea)",
  "m04_reject_immutable_mutation()",
  "m04_validate_accepted_result()",
  "m04_validate_bundle_chunks()",
  "m04_validate_canonical_record()",
  "m04_validate_full_binding_closure()",
  "m04_validate_link_lineage()",
] as const;
const RUNTIME_CALLABLE_FUNCTIONS = new Set<string>([
  "m03_m04_lock_predecessor_shared()",
  "m04_assert_binding_closure(text)",
  "m04_canonical_json(jsonb)",
  "m04_payload_is_canonical_json(bytea)",
]);

interface RuntimeCatalogIdentity {
  readonly namespaceOid: string;
  readonly relationOids: ReadonlyMap<string, string>;
  readonly functionIdentities: ReadonlyMap<string, string>;
  readonly triggerIdentities: ReadonlyMap<string, string>;
}

interface PredecessorMismatchV1 {
  readonly subjectId: string;
  readonly expectedFingerprint: string;
  readonly actualFingerprint: string;
}

interface DerivedAcceptedIdentityV1 {
  readonly bindingId: `bnd_${string}`;
  readonly resultCore: {
    readonly kind: "ACCEPTED";
    readonly bindingId: `bnd_${string}`;
    readonly extractionId: string;
    readonly completenessId: string;
  };
  readonly resultId: `m4r_${string}`;
  readonly resultFingerprint: string;
}

function deriveAcceptedIdentity(candidate: EvidenceBindingCandidateV1): DerivedAcceptedIdentityV1 {
  const bindingCore = {
    schemaVersion: "M04_BINDING_ID_V1",
    extractionId: candidate.bundle.extractionId,
    logicalPayloadSha256: candidate.logicalPayloadSha256,
    evidencePolicyVersion: candidate.request.evidencePolicyVersion,
    materialFieldRegistryVersion: candidate.request.materialFieldRegistryVersion,
    evidenceItemIds: candidate.evidenceItems
      .map(({ id }) => id)
      .sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))),
    claimIds: candidate.claims.map(({ id }) => id),
    linkIds: candidate.links.map(({ id }) => id),
    completenessId: candidate.completeness.id,
  };
  const bindingId = `bnd_${sha256(canonicalJsonM03(bindingCore))}` as const;
  const resultCore = {
    kind: "ACCEPTED" as const,
    bindingId,
    extractionId: candidate.bundle.extractionId,
    completenessId: candidate.completeness.id,
  };
  const resultId = `m4r_${sha256(canonicalJsonM03(resultCore))}` as const;
  return {
    bindingId,
    resultCore,
    resultId,
    resultFingerprint: sha256(
      canonicalJsonM03({ schemaVersion: "M04_RESULT_V1", resultId, ...resultCore }),
    ),
  };
}

type PredecessorReadResultV1 =
  { readonly current: true } | ({ readonly current: false } & PredecessorMismatchV1);

const missingFingerprint = sha256(canonicalJsonM03({ schemaVersion: "M04_MISSING_VALUE_V1" }));
const fingerprintValue = (value: unknown): string => sha256(canonicalJsonM03(value));
const timestamp = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new PersistenceIntegrityError("M04_PREDECESSOR_TIMESTAMP_INVALID");
};
const mismatch = (
  subjectId: string,
  expected: unknown,
  actual: unknown,
): PredecessorReadResultV1 => ({
  current: false,
  subjectId,
  expectedFingerprint: fingerprintValue(expected),
  actualFingerprint: actual === undefined ? missingFingerprint : fingerprintValue(actual),
});

interface StoredBindingRow {
  request_id: string;
  idempotency_key: string;
  request_canonical_payload: Buffer;
  request_fingerprint: string;
  request_payload_sha256: string;
  request_payload_byte_length: number;
  semantic_request_fingerprint: string;
  binding_id: string;
  result_id: string;
  result_fingerprint: string;
  result_binding_id: string;
  result_completeness_id: string;
  result_kind: string;
  extraction_id: string;
  result_payload: Buffer;
  completeness_payload: Buffer;
  completeness_id: string;
  completeness_record_fingerprint: string;
  completeness_coverage_basis_points: number;
  completeness_m05_progression: string;
  evidence_payloads: Buffer[];
  evidence_relations: string[];
  claim_payloads: Buffer[];
  claim_relations: string[];
  link_payloads: Buffer[];
  link_relations: string[];
  bundle_payload: Buffer;
  canonical_payload_sha256: string;
  m02_input_projection_fingerprint: string;
  m03_input_fingerprint: string;
  canonical_payload_byte_length: string;
  canonical_payload_chunk_count: number;
  logical_payload_sha256: string;
  m03_output_fingerprint: string;
  resource_identity_id: string;
  resource_version_identity_id: string;
  source_snapshot_id: string;
  source_revision: string;
  chunks_valid: boolean;
}

interface ValidatedStoredAssociation {
  readonly row: StoredBindingRow;
  readonly bundle: StructuredExtractionBundleV2;
  readonly logicalPayload: Uint8Array;
  readonly accepted: EvidenceBindingResultV1;
}

type IntegritySubjectKind =
  | "BUNDLE"
  | "REQUEST_ASSOCIATION"
  | "EVIDENCE"
  | "CLAIM"
  | "LINK"
  | "COMPLETENESS"
  | "BINDING_RESULT"
  | "DATABASE";

class PersistenceIntegrityError extends Error {
  public constructor(
    message: string,
    public readonly subjectKind?: IntegritySubjectKind,
    public readonly subjectId?: string | null,
  ) {
    super(message);
  }
}

type RejectionError =
  | "IDEMPOTENCY_KEY_REUSED"
  | "BINDING_REQUEST_MISMATCH"
  | "CONTENT_HASH_COLLISION"
  | "ALTERNATE_UNIQUE_KEY_CONFLICT"
  | "PREDECESSOR_NOT_CURRENT";

function requireAlternateKeyKind(
  value: M04AlternateUniqueKeyKindV1 | undefined,
): M04AlternateUniqueKeyKindV1 {
  if (value === undefined) throw new PersistenceIntegrityError("M04_ALTERNATE_KEY_KIND_MISSING");
  return value;
}

function rejection(
  candidate: EvidenceBindingCandidateV1,
  error: RejectionError,
  expected: string,
  actual: string,
  subjectId = candidate.request.extractionId,
  collisionSubject: {
    readonly stage: "BUNDLE" | "ELIGIBILITY" | "PROJECTION" | "PERSISTENCE";
    readonly kind:
      | "BUNDLE"
      | "REQUEST_ASSOCIATION"
      | "EXTRACTION"
      | "EVIDENCE"
      | "CLAIM"
      | "LINK"
      | "COMPLETENESS"
      | "BINDING_RESULT";
  } = { stage: "PERSISTENCE", kind: "BUNDLE" },
  alternateKeyKind?: M04AlternateUniqueKeyKindV1,
): EvidenceBindingResultV1 {
  const collision = error === "CONTENT_HASH_COLLISION";
  const alternate = error === "ALTERNATE_UNIQUE_KEY_CONFLICT";
  const [ruleCode, ruleStage, ruleSubjectKind] = M04_TERMINAL_DIAGNOSTIC_RULES_V1[error];
  const diagnostics: SafeDiagnosticV1[] = [
    alternate
      ? {
          code: "UNIQUE_KEY_CONFLICT" as const,
          stage: collisionSubject.stage as "PROJECTION" | "PERSISTENCE",
          subjectKind: collisionSubject.kind as
            "EVIDENCE" | "CLAIM" | "LINK" | "COMPLETENESS" | "BINDING_RESULT",
          subjectIdOrNull: subjectId,
          expectedFingerprintOrNull: expected,
          actualFingerprintOrNull: actual,
          alternateKeyKind: requireAlternateKeyKind(alternateKeyKind),
          observedCountOrNull: null,
          limitOrNull: null,
        }
      : {
          code: ruleCode as Exclude<typeof ruleCode, "UNIQUE_KEY_CONFLICT">,
          stage: collision ? collisionSubject.stage : ruleStage,
          subjectKind: collision ? collisionSubject.kind : ruleSubjectKind,
          subjectIdOrNull: subjectId,
          expectedFingerprintOrNull: expected,
          actualFingerprintOrNull: actual,
          observedCountOrNull: null,
          limitOrNull: null,
        },
  ];
  const core = {
    kind: "REJECTED" as const,
    requestFingerprint: candidate.requestFingerprint,
    error,
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

function rejectCollision(
  candidate: EvidenceBindingCandidateV1,
  collision: CanonicalCollisionV1,
): EvidenceBindingResultV1 {
  return rejection(
    candidate,
    collision.alternateKeyKind === undefined
      ? "CONTENT_HASH_COLLISION"
      : "ALTERNATE_UNIQUE_KEY_CONFLICT",
    collision.incomingFingerprint ?? collision.fingerprint,
    collision.fingerprint,
    collision.subjectId,
    { stage: collision.stage, kind: collision.kind },
    collision.alternateKeyKind,
  );
}

function failure(
  candidate: EvidenceBindingCandidateV1,
  failureKind: boolean | "integrity" | "serialization",
  cause?: unknown,
): EvidenceBindingResultV1 {
  const integrity = failureKind === "integrity";
  const serialization = failureKind === "serialization";
  const exhausted = failureKind === true;
  const error = integrity
    ? ("PERSISTENCE_INTEGRITY_FAILED" as const)
    : serialization
      ? ("SERIALIZATION_FAILED" as const)
      : exhausted
        ? ("SERIALIZATION_RETRY_EXHAUSTED" as const)
        : ("PERSISTENCE_UNAVAILABLE" as const);
  const [code, stage, defaultSubjectKind] = M04_TERMINAL_DIAGNOSTIC_RULES_V1[error];
  const integrityMessage = cause instanceof PersistenceIntegrityError ? cause.message : "";
  const inferredSubjectKind = integrity
    ? integrityMessage.includes("REQUEST")
      ? ("REQUEST_ASSOCIATION" as const)
      : integrityMessage.includes("EVIDENCE")
        ? ("EVIDENCE" as const)
        : integrityMessage.includes("CLAIM")
          ? ("CLAIM" as const)
          : integrityMessage.includes("LINK")
            ? ("LINK" as const)
            : integrityMessage.includes("COMPLETENESS")
              ? ("COMPLETENESS" as const)
              : integrityMessage.includes("RESULT")
                ? ("BINDING_RESULT" as const)
                : integrityMessage.includes("BUNDLE") || integrityMessage.includes("CHUNK")
                  ? ("BUNDLE" as const)
                  : defaultSubjectKind
    : defaultSubjectKind;
  const subjectKind =
    integrity && cause instanceof PersistenceIntegrityError && cause.subjectKind !== undefined
      ? cause.subjectKind
      : inferredSubjectKind;
  const requestRecordId = `m4q_${sha256(
    canonicalJsonM03({
      schemaVersion: "M04_REQUEST_RECORD_ID_V1",
      requestFingerprint: candidate.requestFingerprint,
    }),
  )}`;
  const inferredSubjectId = integrity
    ? subjectKind === "REQUEST_ASSOCIATION"
      ? requestRecordId
      : subjectKind === "EVIDENCE"
        ? (candidate.evidenceItems[0]?.id ?? null)
        : subjectKind === "CLAIM"
          ? (candidate.claims[0]?.id ?? null)
          : subjectKind === "LINK"
            ? (candidate.links[0]?.id ?? null)
            : subjectKind === "COMPLETENESS"
              ? candidate.completeness.id
              : subjectKind === "BINDING_RESULT"
                ? deriveAcceptedIdentity(candidate).resultId
                : subjectKind === "BUNDLE"
                  ? candidate.bundle.extractionId
                  : null
    : null;
  const subjectIdOrNull =
    integrity && cause instanceof PersistenceIntegrityError && cause.subjectId !== undefined
      ? cause.subjectId
      : inferredSubjectId;
  const diagnostics = [
    {
      code,
      stage,
      subjectKind,
      subjectIdOrNull,
      expectedFingerprintOrNull: null,
      actualFingerprintOrNull: null,
      observedCountOrNull: null,
      limitOrNull: null,
    },
  ];
  const core = {
    kind: "FAILED" as const,
    requestFingerprint: candidate.requestFingerprint,
    error,
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

function acceptedFromStored(row: StoredBindingRow): EvidenceBindingResultV1 {
  return validateStoredAssociation(row).accepted;
}

function validateStoredAssociation(row: StoredBindingRow): ValidatedStoredAssociation {
  let coreValue: unknown;
  let completenessValue: unknown;
  try {
    coreValue = JSON.parse(decoder.decode(row.result_payload));
    completenessValue = JSON.parse(decoder.decode(row.completeness_payload));
  } catch {
    throw new PersistenceIntegrityError("M04_STORED_RESULT_JSON_INVALID");
  }
  if (coreValue === null || typeof coreValue !== "object" || Array.isArray(coreValue))
    throw new PersistenceIntegrityError("M04_STORED_RESULT_INVALID");
  const coreRecord = coreValue as Record<string, unknown>;
  if (
    Object.keys(coreRecord).sort().join("\0") !==
      ["bindingId", "completenessId", "extractionId", "kind"].sort().join("\0") ||
    coreRecord.kind !== "ACCEPTED" ||
    typeof coreRecord.bindingId !== "string" ||
    typeof coreRecord.extractionId !== "string" ||
    typeof coreRecord.completenessId !== "string" ||
    canonicalJsonM03(coreRecord) !== decoder.decode(row.result_payload)
  )
    throw new PersistenceIntegrityError("M04_STORED_RESULT_INVALID");
  const core = coreRecord as {
    kind: "ACCEPTED";
    bindingId: `bnd_${string}`;
    extractionId: `ext_${string}`;
    completenessId: string;
  };
  const parsedCompleteness = EvidenceCompletenessV1Schema.safeParse(completenessValue);
  if (
    !parsedCompleteness.success ||
    canonicalJsonM03(parsedCompleteness.data) !== decoder.decode(row.completeness_payload) ||
    parsedCompleteness.data.id !== core.completenessId
  )
    throw new PersistenceIntegrityError("M04_STORED_COMPLETENESS_INVALID");
  const completeness = parsedCompleteness.data;
  const requestDecoded = decoder.decode(row.request_canonical_payload);
  let requestValue: unknown;
  try {
    requestValue = JSON.parse(requestDecoded);
  } catch {
    throw new PersistenceIntegrityError("M04_STORED_REQUEST_JSON_INVALID");
  }
  const parsedRequest = EvidenceBindingRequestV1Schema.safeParse(requestValue);
  const expectedRequestId = `m4q_${sha256(
    canonicalJsonM03({
      schemaVersion: "M04_REQUEST_RECORD_ID_V1",
      requestFingerprint: row.request_fingerprint,
    }),
  )}`;
  if (
    !parsedRequest.success ||
    canonicalJsonM03(parsedRequest.data) !== requestDecoded ||
    row.request_id !== expectedRequestId ||
    !storedIdempotencyKeyMatchesRequest(row.idempotency_key, parsedRequest.data.idempotencyKey) ||
    row.request_payload_sha256 !== sha256(row.request_canonical_payload) ||
    row.request_payload_sha256 !== row.request_fingerprint ||
    row.request_payload_byte_length !== row.request_canonical_payload.byteLength ||
    row.request_fingerprint !== sha256(row.request_canonical_payload) ||
    row.semantic_request_fingerprint !==
      sha256(canonicalBytes(withoutIdempotencyKey(parsedRequest.data))) ||
    row.binding_id !== core.bindingId
  )
    throw new PersistenceIntegrityError("M04_STORED_REQUEST_INVALID");

  const { bundle, logicalPayload } = bundleAndLogicalFromStored(row);
  const projected = projectEvidenceBinding(bundle);
  const request = parsedRequest.data;
  if (
    request.extractionId !== bundle.extractionId ||
    request.expectedM03OutputFingerprint !== bundle.outputFingerprint ||
    request.expectedResourceIdentityId !== bundle.m02.resourceIdentityId ||
    request.expectedResourceVersionIdentityId !== bundle.m02.resourceVersionIdentityId ||
    request.expectedSourceSnapshotId !== bundle.m02.sourceSnapshotId ||
    request.expectedSourceRevision !== bundle.m02.sourceRevision ||
    canonicalJsonM03(request.expectedPredecessorState) !==
      canonicalJsonM03(bundle.expectedPredecessorState)
  )
    throw new PersistenceIntegrityError("M04_STORED_REQUEST_CLOSURE_INVALID");
  verifyCanonicalRecordSet(
    row.evidence_payloads,
    row.evidence_relations,
    projected.evidenceItems,
    EvidenceItemV1Schema,
    (record) => ({
      id: record.id,
      extractionId: record.extractionId,
      m03SourceReferenceId: record.m03SourceReferenceId,
      sourceSnapshotId: record.sourceSnapshotId,
      sourceRevision: record.sourceRevision,
      sourceEntryIdOrNull: record.sourceEntryIdOrNull,
      sourceDocumentIdOrNull: record.sourceDocumentIdOrNull,
      evidenceType: record.evidenceType,
      recordFingerprint: record.recordFingerprint,
    }),
    "EVIDENCE",
  );
  verifyCanonicalRecordSet(
    row.claim_payloads,
    row.claim_relations,
    projected.claims,
    ClaimV1Schema,
    (record) => ({
      id: record.id,
      extractionId: record.extractionId,
      resourceIdentityId: record.resourceIdentityId,
      resourceVersionIdentityId: record.resourceVersionIdentityId,
      fieldKey: record.fieldKey,
      status: record.status,
      claimClass: record.claimClass,
      recordFingerprint: record.recordFingerprint,
    }),
    "CLAIM",
  );
  verifyCanonicalRecordSet(
    row.link_payloads,
    row.link_relations,
    projected.links,
    ClaimEvidenceLinkV1Schema,
    (record) => ({
      id: record.id,
      claimId: record.claimId,
      evidenceItemId: record.evidenceItemId,
      m03SourceReferenceId: record.m03SourceReferenceId,
      ordinal: record.ordinal,
      relationship: record.relationship,
      recordFingerprint: record.recordFingerprint,
    }),
    "LINK",
  );
  if (
    canonicalJsonM03(completeness) !== canonicalJsonM03(projected.completeness) ||
    row.completeness_id !== completeness.id ||
    row.completeness_record_fingerprint !== completeness.recordFingerprint ||
    row.completeness_coverage_basis_points !== completeness.coverageBasisPoints ||
    row.completeness_m05_progression !== completeness.m05Progression
  )
    throw new PersistenceIntegrityError("M04_STORED_COMPLETENESS_CLOSURE_INVALID");
  const expectedIdentity = deriveAcceptedIdentity({
    ...projected,
    request,
    requestCanonicalPayload: row.request_canonical_payload,
    requestFingerprint: row.request_fingerprint,
    semanticRequestFingerprint: row.semantic_request_fingerprint,
    bundle,
    bundleCanonicalPayload: row.bundle_payload,
    bundleCanonicalSha256: row.canonical_payload_sha256,
    logicalPayload,
    logicalPayloadSha256: row.logical_payload_sha256,
  });
  if (
    core.bindingId !== expectedIdentity.bindingId ||
    canonicalJsonM03(core) !== canonicalJsonM03(expectedIdentity.resultCore) ||
    row.result_binding_id !== core.bindingId ||
    row.result_completeness_id !== core.completenessId ||
    row.result_kind !== core.kind ||
    row.extraction_id !== core.extractionId
  )
    throw new PersistenceIntegrityError("M04_STORED_RESULT_CLOSURE_INVALID");
  const expectedResultId = `m4r_${sha256(canonicalJsonM03(core))}`;
  const expectedResultFingerprint = sha256(
    canonicalJsonM03({ schemaVersion: "M04_RESULT_V1", resultId: expectedResultId, ...core }),
  );
  if (row.result_id !== expectedResultId || row.result_fingerprint !== expectedResultFingerprint)
    throw new PersistenceIntegrityError("M04_STORED_RESULT_INVALID");
  return {
    row,
    bundle,
    logicalPayload,
    accepted: {
      kind: "ACCEPTED",
      resultId: row.result_id,
      bindingId: core.bindingId,
      extractionId: core.extractionId,
      completeness,
      replayed: true,
      resultFingerprint: row.result_fingerprint,
    },
  };
}

function withoutIdempotencyKey(request: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(request).filter(([key]) => key !== "idempotencyKey"));
}

function storedIdempotencyKeyMatchesRequest(encoded: string, original: string): boolean {
  try {
    return (
      decodeM04IdempotencyKeyFromDatabase(encoded) === original &&
      encodeM04IdempotencyKeyForDatabase(original) === encoded
    );
  } catch {
    return false;
  }
}

interface RuntimeSchema<T extends Record<string, unknown>> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

// Link payloads and their relational projection contain only required JSON
// scalars. After schema and raw canonical-byte validation, exact own keys and
// scalar values are equivalent to canonicalJsonM03 equality for this shape.
function isJsonScalar(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function flatLinkScalarObjectEqual(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "object" ||
    left === null ||
    Array.isArray(left) ||
    typeof right !== "object" ||
    right === null ||
    Array.isArray(right)
  )
    return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  if (keys.length !== Object.keys(rightRecord).length) return false;
  for (const key of keys) {
    const value = leftRecord[key];
    const expected = rightRecord[key];
    if (
      !Object.prototype.hasOwnProperty.call(rightRecord, key) ||
      !isJsonScalar(value) ||
      !isJsonScalar(expected) ||
      value !== expected
    )
      return false;
  }
  return true;
}

function verifyCanonicalRecordSet<T extends Record<string, unknown>>(
  payloads: readonly Buffer[],
  relations: readonly string[],
  expected: readonly T[],
  schema: RuntimeSchema<T>,
  relationalProjection: (record: T) => Record<string, unknown>,
  kind: "EVIDENCE" | "CLAIM" | "LINK",
): void {
  if (payloads.length !== relations.length || payloads.length !== expected.length)
    throw new PersistenceIntegrityError(`M04_STORED_${kind}_COUNT_INVALID`, kind, null);
  const expectedById = new Map(expected.map((record) => [String(record.id), record]));
  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index];
    const relation = relations[index];
    const expectedAtIndex = expected[index];
    if (payload === undefined || relation === undefined)
      throw new PersistenceIntegrityError(
        `M04_STORED_${kind}_MISSING`,
        kind,
        expectedAtIndex === undefined ? null : String(expectedAtIndex.id),
      );
    let value: unknown;
    let relationalValue: unknown;
    let payloadText: string;
    try {
      payloadText = decoder.decode(payload);
      value = JSON.parse(payloadText);
      relationalValue = JSON.parse(relation);
    } catch {
      throw new PersistenceIntegrityError(
        `M04_STORED_${kind}_JSON_INVALID`,
        kind,
        expectedAtIndex === undefined ? null : String(expectedAtIndex.id),
      );
    }
    const parsed = schema.safeParse(value);
    const parsedCanonical = parsed.success ? canonicalJsonM03(parsed.data) : undefined;
    if (!parsed.success || parsedCanonical !== payloadText)
      throw new PersistenceIntegrityError(
        `M04_STORED_${kind}_PAYLOAD_INVALID`,
        kind,
        expectedAtIndex === undefined ? null : String(expectedAtIndex.id),
      );
    const expectedRecord = expectedById.get(String(parsed.data.id));
    if (
      expectedRecord === undefined ||
      (kind === "LINK"
        ? !flatLinkScalarObjectEqual(parsed.data, expectedRecord)
        : parsedCanonical !== canonicalJsonM03(expectedRecord)) ||
      (kind === "LINK"
        ? !flatLinkScalarObjectEqual(relationalValue, relationalProjection(parsed.data))
        : canonicalJsonM03(relationalValue) !== canonicalJsonM03(relationalProjection(parsed.data)))
    )
      throw new PersistenceIntegrityError(
        `M04_STORED_${kind}_CLOSURE_INVALID`,
        kind,
        String(parsed.data.id),
      );
  }
}

function logicalBytesFromStored(row: StoredBindingRow): Uint8Array {
  return bundleAndLogicalFromStored(row).logicalPayload;
}

function bundleAndLogicalFromStored(row: StoredBindingRow) {
  if (
    !row.chunks_valid ||
    row.bundle_payload.byteLength !== Number(row.canonical_payload_byte_length) ||
    sha256(row.bundle_payload) !== row.canonical_payload_sha256
  )
    throw new PersistenceIntegrityError("M04_STORED_CHUNKS_INVALID");
  const decoded = decoder.decode(row.bundle_payload);
  let value: unknown;
  try {
    value = JSON.parse(decoded);
  } catch {
    throw new PersistenceIntegrityError("M04_STORED_BUNDLE_JSON_INVALID");
  }
  const parsed = StructuredExtractionBundleV2Schema.safeParse(rehydrateM03ContractOrder(value));
  if (!parsed.success) throw new PersistenceIntegrityError("M04_STORED_BUNDLE_SCHEMA_INVALID");
  if (canonicalJsonM03(parsed.data) !== decoded)
    throw new PersistenceIntegrityError("M04_STORED_BUNDLE_NOT_CANONICAL");
  const logical = encoder.encode(canonicalJsonM03(m03LogicalProjection(parsed.data)));
  if (
    recomputeM03OutputFingerprint(parsed.data) !== row.m03_output_fingerprint ||
    parsed.data.outputFingerprint !== row.m03_output_fingerprint ||
    parsed.data.m02InputProjectionFingerprint !== row.m02_input_projection_fingerprint ||
    parsed.data.inputFingerprint !== row.m03_input_fingerprint ||
    sha256(logical) !== row.logical_payload_sha256 ||
    parsed.data.extractionId !== row.extraction_id ||
    parsed.data.m02.resourceIdentityId !== row.resource_identity_id ||
    parsed.data.m02.resourceVersionIdentityId !== row.resource_version_identity_id ||
    parsed.data.m02.sourceSnapshotId !== row.source_snapshot_id ||
    parsed.data.m02.sourceRevision !== row.source_revision
  )
    throw new PersistenceIntegrityError("M04_STORED_BUNDLE_FINGERPRINT_INVALID");
  return { bundle: parsed.data, logicalPayload: logical };
}

function rehydrateM03ContractOrder(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const bundle = value as Record<string, unknown>;
  if (!Array.isArray(bundle.fields)) return value;
  return {
    ...bundle,
    fields: (bundle.fields as unknown[]).map((fieldValue: unknown): unknown => {
      if (fieldValue === null || typeof fieldValue !== "object" || Array.isArray(fieldValue))
        return fieldValue;
      const field = fieldValue as Record<string, unknown>;
      const valueRecord = field.value;
      if (valueRecord === null || typeof valueRecord !== "object" || Array.isArray(valueRecord))
        return fieldValue;
      const record = valueRecord as Record<string, unknown>;
      if (field.fieldKey === "target_user_candidates")
        return {
          ...field,
          value: {
            targetUsers: record.targetUsers,
            bestFor: record.bestFor,
            notIdealFor: record.notIdealFor,
          },
        };
      if (field.fieldKey === "installation")
        return { ...field, value: { state: record.state, paths: record.paths } };
      if (field.fieldKey === "version" || field.fieldKey === "license")
        return {
          ...field,
          value: {
            state: record.state,
            selectedOrNull: record.selectedOrNull,
            preferredCandidateIdOrNull: record.preferredCandidateIdOrNull,
          },
        };
      return fieldValue;
    }),
  };
}

function semanticBytes(payload: Buffer): Uint8Array {
  const parsed = JSON.parse(decoder.decode(payload)) as Record<string, unknown>;
  delete parsed.idempotencyKey;
  return encoder.encode(canonicalJsonM03(parsed));
}

export class PostgresEvidencePersistenceAdapterV1 implements EvidencePersistencePortV1 {
  readonly #schemaSql: string;
  readonly #loginRole: string;
  readonly #peerLoginRole: string;
  #startupCatalog: RuntimeCatalogIdentity | undefined;
  readonly #preparedPrefix = randomBytes(8).toString("hex");
  #preparedSequence = 0;

  private constructor(
    private readonly pool: Pool,
    private readonly options: PostgresEvidencePersistenceOptionsV1,
  ) {
    if (
      !/^[a-z][a-z0-9_]{0,62}$/u.test(options.schema) ||
      options.schema.startsWith("pg_") ||
      options.schema === "information_schema" ||
      !/^[a-z][a-z0-9_]{0,62}$/u.test(options.loginRole) ||
      options.loginRole.startsWith("pg_") ||
      options.loginRole === "information_schema"
    )
      throw new Error("M04_DATABASE_SCHEMA_INVALID");
    this.#schemaSql = `"${options.schema}"`;
    this.#loginRole = options.loginRole;
    this.#peerLoginRole = options.peerLoginRole;
    if (!/^[a-z][a-z0-9_]{0,62}$/u.test(this.#peerLoginRole))
      throw new Error("M04_DATABASE_SCHEMA_INVALID");
  }

  public static async open(
    pool: Pool,
    options: PostgresEvidencePersistenceOptionsV1,
  ): Promise<PostgresEvidencePersistenceAdapterV1> {
    const adapter = new PostgresEvidencePersistenceAdapterV1(pool, options);
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch {
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    }
    try {
      await adapter.assertRuntimeAuthority(client);
      return adapter;
    } catch {
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      client.release();
    }
  }

  private async assertRuntimeAuthority(client: PoolClient): Promise<void> {
    const drift = (): never => {
      throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
    };
    const session = (
      await client.query<{
        session_user: string;
        current_user: string;
        namespace_oid: string | null;
        namespace_name: string | null;
        schema_usage: boolean;
        schema_create: boolean;
      }>(
        `SELECT session_user,current_user,n.oid::text namespace_oid,n.nspname namespace_name,
                has_schema_privilege(current_user,n.oid,'USAGE') schema_usage,
                has_schema_privilege(current_user,n.oid,'CREATE') schema_create
           FROM pg_namespace n WHERE n.nspname=$1`,
        [this.options.schema],
      )
    ).rows;
    if (session.length !== 1)
      throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
    const currentSession = session[0];
    if (currentSession?.namespace_oid == null)
      throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
    if (
      currentSession.session_user !== this.#loginRole ||
      currentSession.current_user !== this.#loginRole ||
      currentSession.namespace_name !== this.options.schema ||
      !currentSession.schema_usage ||
      currentSession.schema_create
    )
      drift();
    const namespaceOid = currentSession.namespace_oid;
    const roleAuthority = (
      await client.query<{
        role_name: string;
        can_login: boolean;
        is_superuser: boolean;
        bypass_rls: boolean;
        can_create_role: boolean;
        can_create_database: boolean;
        can_replicate: boolean;
        is_owner: boolean;
      }>(
        `SELECT r.rolname role_name,r.rolcanlogin can_login,r.rolsuper is_superuser,
                r.rolbypassrls bypass_rls,r.rolcreaterole can_create_role,
                r.rolcreatedb can_create_database,r.rolreplication can_replicate,
                r.oid=n.nspowner is_owner
           FROM pg_roles r CROSS JOIN pg_namespace n
          WHERE n.oid=$1::oid AND r.rolname=ANY($2::text[])`,
        [namespaceOid, [this.#loginRole, "ai_ark_m04_runtime", "ai_ark_m01_m02_writer"]],
      )
    ).rows;
    if (
      roleAuthority.length !== 3 ||
      roleAuthority.some(
        (role) =>
          role.can_login !== (role.role_name === this.#loginRole) ||
          role.is_superuser ||
          role.bypass_rls ||
          role.can_create_role ||
          role.can_create_database ||
          role.can_replicate ||
          role.is_owner,
      )
    )
      drift();
    try {
      await assertExactApplicationAcl(
        client,
        namespaceOid,
        this.options.schema,
        this.#loginRole,
        "ai_ark_m04_runtime",
        this.#peerLoginRole,
      );
    } catch {
      drift();
    }
    const memberships = (
      await client.query<{ role_name: string; inherit_option: boolean; set_option: boolean }>(
        `SELECT parent.rolname role_name,m.inherit_option,m.set_option
           FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
             JOIN pg_roles parent ON parent.oid=m.roleid
          WHERE member.rolname=$1`,
        [this.#loginRole],
      )
    ).rows;
    if (
      memberships.length !== 1 ||
      memberships[0]?.role_name !== "ai_ark_m04_runtime" ||
      !memberships[0].inherit_option
    )
      drift();
    const reachable = (
      await client.query<{ role_name: string; is_owner: boolean; is_superuser: boolean }>(
        `WITH RECURSIVE reachable(oid) AS (
           SELECT oid FROM pg_roles WHERE rolname=$2
           UNION
           SELECT m.roleid FROM pg_auth_members m JOIN reachable prior ON prior.oid=m.member
            WHERE m.inherit_option OR m.set_option
         )
         SELECT r.rolname role_name,r.oid=n.nspowner is_owner,r.rolsuper is_superuser
           FROM reachable JOIN pg_roles r ON r.oid=reachable.oid
             CROSS JOIN pg_namespace n WHERE n.oid=$1::oid`,
        [namespaceOid, this.#loginRole],
      )
    ).rows;
    if (
      reachable.length !== 2 ||
      reachable.some(
        (role) => role.role_name === "ai_ark_m01_m02_writer" || role.is_owner || role.is_superuser,
      )
    )
      drift();
    const relations = (
      await client.query<{
        relname: string;
        relation_oid: string;
        can_select: boolean;
        can_insert: boolean;
        can_update: boolean;
        can_delete: boolean;
        can_truncate: boolean;
        can_references: boolean;
        can_trigger: boolean;
      }>(
        `SELECT c.relname,c.oid::text relation_oid,
                has_table_privilege(current_user,c.oid,'SELECT') can_select,
                has_table_privilege(current_user,c.oid,'INSERT') can_insert,
                has_table_privilege(current_user,c.oid,'UPDATE') can_update,
                has_table_privilege(current_user,c.oid,'DELETE') can_delete,
                has_table_privilege(current_user,c.oid,'TRUNCATE') can_truncate,
                has_table_privilege(current_user,c.oid,'REFERENCES') can_references,
                has_table_privilege(current_user,c.oid,'TRIGGER') can_trigger
           FROM pg_class c WHERE c.relnamespace=$1::oid
             AND c.relkind IN ('r','p') ORDER BY c.relname`,
        [namespaceOid],
      )
    ).rows;
    if (
      RUNTIME_RELATIONS.some((name) => !relations.some((relation) => relation.relname === name)) ||
      relations.some((relation) => {
        const permitted = (RUNTIME_RELATIONS as readonly string[]).includes(relation.relname);
        const canonical = (CANONICAL_RELATIONS as readonly string[]).includes(relation.relname);
        return (
          relation.can_select !== permitted ||
          relation.can_insert !== canonical ||
          relation.can_update ||
          relation.can_delete ||
          relation.can_truncate ||
          relation.can_references ||
          relation.can_trigger
        );
      })
    )
      drift();
    const sequenceRights = (
      await client.query<{ can_use: boolean; can_select: boolean; can_update: boolean }>(
        `SELECT has_sequence_privilege(current_user,c.oid,'USAGE') can_use,
                has_sequence_privilege(current_user,c.oid,'SELECT') can_select,
                has_sequence_privilege(current_user,c.oid,'UPDATE') can_update
           FROM pg_class c WHERE c.relnamespace=$1::oid AND c.relkind='S'`,
        [namespaceOid],
      )
    ).rows;
    if (sequenceRights.some((row) => row.can_use || row.can_select || row.can_update)) drift();
    const directGrants = (
      await client.query<{ granted: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_class c,
             LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) grant_row
            WHERE c.relnamespace=$1::oid
              AND grant_row.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
           UNION ALL
           SELECT 1 FROM pg_proc p,
             LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) grant_row
            WHERE p.pronamespace=$1::oid
              AND grant_row.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
         ) granted`,
        [namespaceOid, this.#loginRole],
      )
    ).rows[0];
    if (directGrants?.granted !== false) drift();
    const publicGrants = (
      await client.query<{ granted: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_namespace n,
             LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
            WHERE n.oid=$1::oid AND acl.grantee=0
           UNION ALL
           SELECT 1 FROM pg_class c,
             LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
            WHERE c.relnamespace=$1::oid AND acl.grantee=0
           UNION ALL
           SELECT 1 FROM pg_proc p,
             LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            WHERE p.pronamespace=$1::oid AND acl.grantee=0
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
         ) granted`,
        [namespaceOid],
      )
    ).rows[0];
    if (publicGrants?.granted !== false) drift();
    const functions = (
      await client.query<{
        signature: string;
        function_oid: string;
        definition_hash: string;
        source_hash: string;
        can_execute: boolean;
        security_definer: boolean;
        owner_matches_migration: boolean;
        settings: string[] | null;
        return_type: string;
        language: string;
        volatility: string;
        strict: boolean;
        parallel: string;
        leakproof: boolean;
        cost: number;
        rows: number;
        kind: string;
        returns_set: boolean;
        no_defaults: boolean;
        no_extra_arguments: boolean;
      }>(
        `SELECT p.proname||'('||replace(oidvectortypes(p.proargtypes),', ', ',')||')' signature,
                p.oid::text function_oid,
                encode(pg_catalog.sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') definition_hash,
                encode(pg_catalog.sha256(convert_to(p.prosrc,'UTF8')),'hex') source_hash,
                has_function_privilege(current_user,p.oid,'EXECUTE') can_execute,
                p.prosecdef security_definer,
                p.proowner=(SELECT c.relowner FROM pg_class c
                  WHERE c.relnamespace=$1::oid AND c.relname='m04_binding_requests')
                  owner_matches_migration,
                p.proconfig settings,pg_get_function_result(p.oid) return_type,
                l.lanname language,p.provolatile volatility,p.proisstrict strict,
                p.proparallel parallel,p.proleakproof leakproof,p.procost cost,
                p.prorows rows,p.prokind kind,p.proretset returns_set,
                p.pronargdefaults=0 AND p.proargdefaults IS NULL no_defaults,
                p.proallargtypes IS NULL AND p.proargmodes IS NULL no_extra_arguments
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             JOIN pg_language l ON l.oid=p.prolang
          WHERE p.pronamespace=$1::oid
             AND NOT EXISTS (SELECT 1 FROM pg_depend d
               WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
           ORDER BY p.proname,p.oid`,
        [namespaceOid],
      )
    ).rows;
    const expectedFunctions = await expectedM04Functions(this.options.schema);
    if (
      RUNTIME_FUNCTIONS.some((name) => !functions.some((fn) => fn.signature === name)) ||
      functions.some((fn) => fn.can_execute !== RUNTIME_CALLABLE_FUNCTIONS.has(fn.signature)) ||
      functions.some((fn) => {
        if (!(RUNTIME_FUNCTIONS as readonly string[]).includes(fn.signature)) return false;
        const fence = fn.signature.startsWith("m03_m04_");
        const expected = expectedFunctions.get(fn.signature.slice(0, fn.signature.indexOf("(")));
        return (
          expected === undefined ||
          !fn.owner_matches_migration ||
          fn.security_definer !== expected.securityDefiner ||
          fn.security_definer !== fence ||
          fn.source_hash !== sha256(expected.source) ||
          fn.return_type !== expected.returnType ||
          fn.language !== "plpgsql" ||
          fn.volatility !== expected.volatility ||
          fn.strict !== expected.strict ||
          fn.parallel !== "u" ||
          fn.leakproof ||
          fn.cost !== 100 ||
          fn.rows !== 0 ||
          fn.kind !== "f" ||
          fn.returns_set ||
          !fn.no_defaults ||
          !fn.no_extra_arguments ||
          fn.settings?.length !== 1 ||
          fn.settings[0] !==
            (fence ? "search_path=pg_catalog" : `search_path=${this.options.schema}, public`)
        );
      })
    )
      drift();
    const expectedTriggers = await expectedM04Triggers();
    const triggerRows = (
      await client.query<{
        name: string;
        relation: string;
        trigger_oid: string;
        relation_oid: string;
        function_oid: string;
        type: number;
        enabled: string;
        deferrable: boolean;
        initially_deferred: boolean;
        no_when: boolean;
        no_args: boolean;
        definition: string;
      }>(
        `SELECT t.tgname name,c.relname relation,t.oid::text trigger_oid,t.tgrelid::text relation_oid,
                t.tgfoid::text function_oid,t.tgtype type,t.tgenabled enabled,
                t.tgdeferrable deferrable,t.tginitdeferred initially_deferred,
                t.tgqual IS NULL no_when,octet_length(t.tgargs)=0 no_args,
                pg_get_triggerdef(t.oid) definition
           FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          WHERE c.relnamespace=$1::oid AND NOT t.tgisinternal`,
        [namespaceOid],
      )
    ).rows;
    const expectedLegacyTriggers = await expectedM02Triggers();
    const m04Triggers = triggerRows.filter(
      (trigger) =>
        expectedTriggers.has(trigger.name) ||
        trigger.name.startsWith("m04_") ||
        trigger.name.startsWith("m03_m04_"),
    );
    if (
      triggerRows.length !== expectedTriggers.size + expectedLegacyTriggers.size ||
      triggerRows.some((trigger) => {
        if (expectedTriggers.has(trigger.name)) return false;
        const expected = expectedLegacyTriggers.get(`${trigger.relation}.${trigger.name}`);
        if (expected === undefined) return true;
        const fn = functions.find((row) => row.signature === `${expected.functionName}()`);
        const validWhen =
          expected.when === null
            ? trigger.no_when
            : expected.when === "NEW.state = 'ACTIVE'" &&
              /\bWHEN\s+\(+[Nn][Ee][Ww]\.state\s*=\s*'ACTIVE'::text\)+\s+EXECUTE FUNCTION/u.test(
                trigger.definition,
              );
        return (
          trigger.function_oid !== fn?.function_oid ||
          trigger.type !== expected.type ||
          trigger.enabled !== "O" ||
          trigger.deferrable !== expected.deferrable ||
          trigger.initially_deferred !== expected.initiallyDeferred ||
          !validWhen ||
          !trigger.no_args
        );
      }) ||
      m04Triggers.length !== expectedTriggers.size ||
      m04Triggers.some((trigger) => {
        const expected = expectedTriggers.get(trigger.name);
        if (expected === undefined) return true;
        const relation = relations.find((row) => row.relname === expected.relation);
        const fn = functions.find((row) => row.signature === `${expected.functionName}()`);
        return (
          trigger.relation_oid !== relation?.relation_oid ||
          trigger.function_oid !== fn?.function_oid ||
          trigger.type !== expected.type ||
          trigger.enabled !== "O" ||
          trigger.deferrable !== expected.deferrable ||
          trigger.initially_deferred !== expected.initiallyDeferred ||
          !trigger.no_when ||
          !trigger.no_args
        );
      })
    )
      drift();
    const identity: RuntimeCatalogIdentity = {
      namespaceOid,
      relationOids: new Map(relations.map((relation) => [relation.relname, relation.relation_oid])),
      functionIdentities: new Map(
        functions
          .filter((fn) => (RUNTIME_FUNCTIONS as readonly string[]).includes(fn.signature))
          .map((fn) => [
            fn.signature,
            `${fn.function_oid}:${fn.definition_hash}:${String(fn.security_definer)}:${String(fn.owner_matches_migration)}:${JSON.stringify(fn.settings)}`,
          ]),
      ),
      triggerIdentities: new Map(
        triggerRows.map((trigger) => [`${trigger.relation}.${trigger.name}`, trigger.trigger_oid]),
      ),
    };
    const prior = this.#startupCatalog;
    if (
      prior !== undefined &&
      (prior.namespaceOid !== identity.namespaceOid ||
        RUNTIME_RELATIONS.some(
          (name) => prior.relationOids.get(name) !== identity.relationOids.get(name),
        ) ||
        RUNTIME_FUNCTIONS.some(
          (name) => prior.functionIdentities.get(name) !== identity.functionIdentities.get(name),
        ) ||
        [...prior.triggerIdentities].some(
          ([name, oid]) => identity.triggerIdentities.get(name) !== oid,
        ))
    )
      drift();
    this.#startupCatalog ??= identity;
  }

  private async lockRelations(client: PoolClient, names: readonly string[]): Promise<void> {
    for (const name of names)
      await client.query(`LOCK TABLE ${this.#schemaSql}.${name} IN ACCESS SHARE MODE`);
    const expectedOids = names.map((name) => {
      const oid = this.#startupCatalog?.relationOids.get(name);
      if (oid === undefined)
        throw new PersistenceIntegrityError("M04_DATABASE_SCHEMA_INVALID", "DATABASE", null);
      return oid;
    });
    const held = await client.query<{ relation_oid: string }>(
      `SELECT relation::text relation_oid FROM pg_locks
        WHERE pid=pg_backend_pid() AND locktype='relation' AND granted
          AND mode='AccessShareLock' AND relation=ANY($1::oid[])`,
      [expectedOids],
    );
    const heldOids = new Set(held.rows.map((row) => row.relation_oid));
    if (expectedOids.some((oid) => !heldOids.has(oid)))
      throw new PersistenceIntegrityError("M04_DATABASE_SCHEMA_INVALID", "DATABASE", null);
    await this.assertRuntimeAuthority(client);
  }

  private async queryDomain<T extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    await this.assertRuntimeAuthority(client);
    if (this.#preparedSequence >= 0xffffffff)
      throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
    this.#preparedSequence += 1;
    const result = await client.query<T>({
      name: `ai_ark_m04_${this.#preparedPrefix}_${this.#preparedSequence.toString(16).padStart(8, "0")}_${sha256(sql).slice(0, 24)}`,
      text: sql,
      values: [...values],
    });
    await this.assertRuntimeAuthority(client);
    return result;
  }

  public async persistAccepted(
    candidate: EvidenceBindingCandidateV1,
  ): Promise<EvidenceBindingResultV1> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.transaction(candidate);
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        // An advisory-lock waiter can retain the SERIALIZABLE snapshot established by
        // the lock statement.  The winner's immutable unique row is therefore exposed
        // to the waiter as 23505 rather than 40001.  Restart the complete transaction;
        // the replay lookup in the fresh snapshot then converges on the winner.
        if (code === "40001" || code === "23505") {
          if (attempt === 2) {
            if (code === "23505") {
              try {
                const collision = await this.findCollisionAfterUnique(candidate);
                if (collision !== undefined) return rejectCollision(candidate, collision);
              } catch (inspectionError) {
                return failure(candidate, "integrity", inspectionError);
              }
            }
            return failure(candidate, code === "23505" ? "integrity" : true, error);
          }
          continue;
        }
        if (code === "40003") return failure(candidate, "serialization");
        const message = error instanceof Error ? error.message : "";
        return failure(
          candidate,
          error instanceof PersistenceIntegrityError ||
            (message.startsWith("M04_") && /(?:CLOSURE|INTEGRITY|SCALAR|LINEAGE)/u.test(message))
            ? "integrity"
            : false,
          error,
        );
      }
    }
    return failure(candidate, true);
  }

  private async findCollisionAfterUnique(
    candidate: EvidenceBindingCandidateV1,
  ): Promise<CanonicalCollisionV1 | undefined> {
    const client = await this.pool.connect();
    try {
      await this.assertRuntimeAuthority(client);
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY");
      await client.query(`SET LOCAL search_path TO ${this.#schemaSql}, public`);
      await this.lockRelations(client, CANONICAL_RELATIONS);
      const collision = await this.findCanonicalCollision(
        client,
        candidate,
        deriveAcceptedIdentity(candidate),
      );
      await client.query("ROLLBACK");
      return collision;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async transaction(
    candidate: EvidenceBindingCandidateV1,
  ): Promise<EvidenceBindingResultV1> {
    const encodedKey = encodeM04IdempotencyKeyForDatabase(candidate.request.idempotencyKey);
    const client = await this.pool.connect();
    const identity = deriveAcceptedIdentity(candidate);
    const locks = [
      {
        original: candidate.request.expectedResourceVersionIdentityId,
        database: candidate.request.expectedResourceVersionIdentityId,
      },
      { original: candidate.request.extractionId, database: candidate.request.extractionId },
      { original: candidate.request.idempotencyKey, database: encodedKey },
    ].sort((left, right) =>
      Buffer.compare(Buffer.from(left.original, "utf8"), Buffer.from(right.original, "utf8")),
    );
    try {
      await this.assertRuntimeAuthority(client);
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query(`SET LOCAL search_path TO ${this.#schemaSql}, public`);
      for (const lock of locks) {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [lock.database]);
      }
      await this.lockRelations(client, CANONICAL_RELATIONS);
      const validatedAssociations = new Map<string, ValidatedStoredAssociation>();
      const collision = await this.findCanonicalCollision(
        client,
        candidate,
        identity,
        validatedAssociations,
      );
      if (collision !== undefined) {
        await client.query("ROLLBACK");
        return rejectCollision(candidate, collision);
      }
      const validatedByKey = validatedAssociations.get(encodedKey);
      const byKey =
        validatedByKey?.row ??
        (await this.lookup(client, "request.idempotency_key=$1", [encodedKey]));
      if (byKey) {
        const validatedByKeyOrStored = validatedByKey ?? validateStoredAssociation(byKey);
        if (!bytesEqual(byKey.request_canonical_payload, candidate.requestCanonicalPayload)) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "IDEMPOTENCY_KEY_REUSED",
            byKey.request_fingerprint,
            candidate.requestFingerprint,
          );
        }
        const storedLogical = validatedByKeyOrStored.logicalPayload;
        if (
          byKey.canonical_payload_sha256 === candidate.bundleCanonicalSha256 &&
          !bytesEqual(byKey.bundle_payload, candidate.bundleCanonicalPayload)
        ) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            byKey.canonical_payload_sha256,
            candidate.bundleCanonicalSha256,
          );
        }
        if (!bytesEqual(storedLogical, candidate.logicalPayload)) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            candidate.logicalPayloadSha256,
            candidate.logicalPayloadSha256,
          );
        }
        await client.query("ROLLBACK");
        return validatedByKeyOrStored.accepted;
      }
      const semanticRows = await this.lookupMany(
        client,
        "request.semantic_request_fingerprint=$1",
        [candidate.semanticRequestFingerprint],
      );
      const candidateSemantic = semanticBytes(Buffer.from(candidate.requestCanonicalPayload));
      for (const row of semanticRows) {
        if (!bytesEqual(semanticBytes(row.request_canonical_payload), candidateSemantic)) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            row.semantic_request_fingerprint,
            candidate.semanticRequestFingerprint,
          );
        }
      }
      const semanticReplay = semanticRows[0];
      if (semanticReplay !== undefined) {
        const row = semanticReplay;
        const storedLogical = logicalBytesFromStored(row);
        if (
          row.canonical_payload_sha256 === candidate.bundleCanonicalSha256 &&
          !bytesEqual(row.bundle_payload, candidate.bundleCanonicalPayload)
        ) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            row.canonical_payload_sha256,
            candidate.bundleCanonicalSha256,
          );
        }
        if (!bytesEqual(storedLogical, candidate.logicalPayload)) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            candidate.logicalPayloadSha256,
            candidate.logicalPayloadSha256,
          );
        }
        const validatedReplay = acceptedFromStored(row);
        await this.insertRequestAssociation(client, candidate, row.binding_id, row.result_id);
        await client.query("SET CONSTRAINTS ALL IMMEDIATE");
        await this.assertRuntimeAuthority(client);
        await client.query("COMMIT");
        return validatedReplay;
      }
      const byExtraction = await this.lookup(client, "result.extraction_id=$1", [
        candidate.request.extractionId,
      ]);
      if (byExtraction) {
        if (
          byExtraction.logical_payload_sha256 === candidate.logicalPayloadSha256 &&
          !bytesEqual(logicalBytesFromStored(byExtraction), candidate.logicalPayload)
        ) {
          await client.query("ROLLBACK");
          return rejection(
            candidate,
            "CONTENT_HASH_COLLISION",
            byExtraction.logical_payload_sha256,
            candidate.logicalPayloadSha256,
          );
        }
        await client.query("ROLLBACK");
        return rejection(
          candidate,
          "BINDING_REQUEST_MISMATCH",
          byExtraction.semantic_request_fingerprint,
          candidate.semanticRequestFingerprint,
        );
      }
      const sharedIdentity = this.#startupCatalog?.functionIdentities.get(
        "m03_m04_lock_predecessor_shared()",
      );
      if (sharedIdentity === undefined)
        throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
      const [sharedOid, sharedDefinitionSha256] = sharedIdentity.split(":");
      const sharedLock = await this.queryDomain<{ epoch: string | null }>(
        client,
        `SELECT CASE
           WHEN to_regprocedure($1)::oid=$2::oid
            AND encode(pg_catalog.sha256(convert_to(pg_get_functiondef($2::oid),'UTF8')),'hex')=$3
           THEN ${this.#schemaSql}.m03_m04_lock_predecessor_shared()
           ELSE NULL END AS epoch`,
        [`${this.#schemaSql}.m03_m04_lock_predecessor_shared()`, sharedOid, sharedDefinitionSha256],
      );
      if (sharedLock.rows[0]?.epoch == null)
        throw new PersistenceIntegrityError("M04_DATABASE_ROLE_AUTHORITY_DRIFT", "DATABASE", null);
      await this.lockRelations(client, PREDECESSOR_RELATIONS);
      const predecessor = await this.readPredecessor(client, candidate);
      if (!predecessor.current) {
        await client.query("ROLLBACK");
        return rejection(
          candidate,
          "PREDECESSOR_NOT_CURRENT",
          predecessor.expectedFingerprint,
          predecessor.actualFingerprint,
          predecessor.subjectId,
        );
      }
      const fencedCollision = await this.findCanonicalCollision(client, candidate, identity);
      if (fencedCollision !== undefined) {
        await client.query("ROLLBACK");
        return rejectCollision(candidate, fencedCollision);
      }
      const accepted = await this.insertBinding(client, candidate, identity);
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      await this.assertRuntimeAuthority(client);
      await client.query("COMMIT");
      return accepted;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async readPredecessor(
    client: PoolClient,
    candidate: EvidenceBindingCandidateV1,
  ): Promise<PredecessorReadResultV1> {
    const ids = candidate.bundle.m02;
    const sortable = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value;
      return canonicalJsonM03(value);
    };
    const compare = (left: unknown, right: unknown): number =>
      Buffer.compare(Buffer.from(sortable(left), "utf8"), Buffer.from(sortable(right), "utf8"));
    const one = async (sql: string, id: string): Promise<Record<string, unknown> | undefined> =>
      (await this.queryDomain<Record<string, unknown>>(client, sql, [id])).rows[0];
    let eligibilityMismatch: PredecessorReadResultV1 | undefined;
    const markMismatch = (subjectId: string, expected: unknown, actual: unknown): void => {
      eligibilityMismatch ??= mismatch(subjectId, expected, actual);
    };
    const markFingerprintMismatch = (
      subjectId: string,
      expectedFingerprint: string,
      actual: unknown,
    ): void => {
      eligibilityMismatch ??= {
        current: false,
        subjectId,
        expectedFingerprint,
        actualFingerprint: fingerprintValue(actual),
      };
    };
    const present = (
      await this.queryDomain<Record<string, boolean>>(
        client,
        `SELECT
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.acquisition_jobs WHERE id=$1) "acquisitionJob",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.m02_jobs WHERE id=$1) "m02Job",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.m02_identity_handoff_markers WHERE id=$2) "handoff",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.resource_candidates WHERE id=$3) "candidate",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.resource_identities WHERE id=$4) "resourceIdentity",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.resource_version_identities WHERE id=$5) "resourceVersionIdentity",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.resource_source_links WHERE id=$6) "sourceLink",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.source_repository_identities WHERE id=$7) "sourceRepository",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.identity_decisions WHERE id=$8) "identityDecision",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.m02_review_states WHERE id=$9) "candidateReviewState",
           EXISTS(SELECT 1 FROM ${this.#schemaSql}.candidate_roots WHERE id=$10) "candidateRoot"`,
        [
          ids.controllingM02JobId,
          ids.handoffMarkerId,
          ids.resourceCandidateId,
          ids.resourceIdentityId,
          ids.resourceVersionIdentityId,
          ids.resourceSourceLinkId,
          ids.sourceRepositoryId,
          ids.identityDecisionId,
          ids.m02ReviewStateId,
          ids.candidateRootId,
        ],
      )
    ).rows[0];
    const requiredRows = [
      ["acquisitionJob", ids.controllingM02JobId],
      ["m02Job", ids.controllingM02JobId],
      ["handoff", ids.handoffMarkerId],
      ["candidate", ids.resourceCandidateId],
      ["resourceIdentity", ids.resourceIdentityId],
      ["resourceVersionIdentity", ids.resourceVersionIdentityId],
      ["sourceLink", ids.resourceSourceLinkId],
      ["sourceRepository", ids.sourceRepositoryId],
      ["identityDecision", ids.identityDecisionId],
      ["candidateReviewState", ids.m02ReviewStateId],
      ["candidateRoot", ids.candidateRootId],
    ] as const;
    for (const [key, subjectId] of requiredRows)
      if (present?.[key] !== true)
        return mismatch(subjectId, candidate.bundle.m02InputProjection[key], undefined);
    const handoff = await one(
      `SELECT id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
              controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
              logical_key,controlling_job_state,state,record_version::text
         FROM ${this.#schemaSql}.m02_identity_handoff_markers WHERE id=$1`,
      ids.handoffMarkerId,
    );
    if (handoff === undefined)
      return mismatch(ids.handoffMarkerId, candidate.bundle.m02InputProjection.handoff, undefined);
    if (
      handoff.state !== "ACTIVE" ||
      handoff.resource_candidate_id !== ids.resourceCandidateId ||
      handoff.resource_identity_id !== ids.resourceIdentityId ||
      handoff.resource_version_identity_id !== ids.resourceVersionIdentityId ||
      handoff.source_snapshot_id !== ids.sourceSnapshotId ||
      handoff.identity_decision_id !== ids.identityDecisionId ||
      handoff.controlling_job_state !== "CONTROLLING" ||
      handoff.id !== ids.handoffMarkerId
    )
      markMismatch(ids.handoffMarkerId, "EXACT_ACTIVE_HANDOFF_TUPLE", handoff);

    const acquisitionJob = await one(
      `SELECT id,status,current_stage,source_snapshot_id,cancellation_requested,record_version::text
         FROM ${this.#schemaSql}.acquisition_jobs WHERE id=$1`,
      ids.controllingM02JobId,
    );
    const m02Job = await one(
      `SELECT id,job_lineage_id,source_snapshot_id,operation_scope,current_stage,review_state,
              supersession_state,superseded_by_job_id,supersession_sequence::text,
              controlling_classification_decision_id,job_scope_key,input_fingerprint,
              classification_policy_version,identity_policy_version,analysis_policy_version,
              parser_profile_version,prompt_bundle_version,analysis_provider_adapter_id,
              analysis_model_id,analysis_methodology_version,replacement_reason_code,
              replacement_input_payload,replacement_input_fingerprint,replacement_source_job_id,
              replacement_source_operation_scope,replacement_requested_operation_scope,
              replacement_predecessor_job_ids,replacement_original_source_snapshot_id,
              replacement_source_snapshot_id,record_version::text
         FROM ${this.#schemaSql}.m02_jobs WHERE id=$1`,
      ids.controllingM02JobId,
    );
    if (acquisitionJob === undefined)
      return mismatch(
        ids.controllingM02JobId,
        candidate.bundle.m02InputProjection.acquisitionJob,
        undefined,
      );
    if (m02Job === undefined)
      return mismatch(
        ids.controllingM02JobId,
        candidate.bundle.m02InputProjection.m02Job,
        undefined,
      );
    if (
      acquisitionJob.status !== "COMPLETED" ||
      acquisitionJob.cancellation_requested !== false ||
      m02Job.supersession_state !== "CONTROLLING" ||
      m02Job.current_stage !== "RESOLVING_IDENTITY" ||
      m02Job.review_state !== "RESOLVED" ||
      handoff.controlling_m02_job_id !== m02Job.id
    )
      markMismatch(ids.controllingM02JobId, "COMPLETED_CONTROLLING", {
        acquisitionStatus: acquisitionJob.status,
        cancellationRequested: acquisitionJob.cancellation_requested,
        m02SupersessionState: m02Job.supersession_state,
        handoffController: handoff.controlling_m02_job_id,
      });

    const candidateRow = await one(
      `SELECT id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
              candidate_content_fingerprint,reconciled_classification_run_id,
              classification_policy_version,identity_policy_version,identity_outcome,status,
              resource_identity_id,resource_version_identity_id,record_version::text
         FROM ${this.#schemaSql}.resource_candidates WHERE id=$1`,
      ids.resourceCandidateId,
    );
    if (candidateRow === undefined)
      return mismatch(
        ids.resourceCandidateId,
        candidate.bundle.m02InputProjection.candidate,
        undefined,
      );
    if (candidateRow.status !== "IDENTITY_RESOLVED")
      markMismatch(ids.resourceCandidateId, "IDENTITY_RESOLVED", candidateRow.status);
    if (
      candidateRow.source_snapshot_id !== ids.sourceSnapshotId ||
      candidateRow.candidate_root_id !== ids.candidateRootId ||
      candidateRow.candidate_content_fingerprint !== ids.candidateContentFingerprint ||
      candidateRow.resource_identity_id !== ids.resourceIdentityId ||
      candidateRow.resource_version_identity_id !== ids.resourceVersionIdentityId ||
      candidateRow.classification_policy_version !== m02Job.classification_policy_version ||
      candidateRow.identity_policy_version !== m02Job.identity_policy_version
    )
      markMismatch(ids.resourceCandidateId, "EXACT_RESOLVED_CANDIDATE_TUPLE", candidateRow);

    const candidateRoot = await one(
      `SELECT id,group_id,classification_run_id,source_snapshot_id,normalized_root_path,
              candidate_root_fingerprint,candidate_content_fingerprint,state,record_version::text
         FROM ${this.#schemaSql}.candidate_roots WHERE id=$1`,
      ids.candidateRootId,
    );
    if (candidateRoot === undefined)
      return mismatch(
        ids.candidateRootId,
        candidate.bundle.m02InputProjection.candidateRoot,
        undefined,
      );
    const reviewRows = (
      await this.queryDomain<Record<string, unknown>>(
        client,
        `SELECT id,group_id,resource_candidate_id,review_state,record_version::text,
                superseded_by_review_id
           FROM ${this.#schemaSql}.m02_review_states
          WHERE resource_candidate_id=$1 OR group_id=$2`,
        [ids.resourceCandidateId, candidateRoot.group_id],
      )
    ).rows;
    const reviewProjection = reviewRows
      .map((row) => ({
        id: row.id,
        groupIdOrNull: row.group_id,
        resourceCandidateIdOrNull: row.resource_candidate_id,
        reviewState: row.review_state,
        recordVersion: row.record_version,
        supersededByReviewIdOrNull: row.superseded_by_review_id,
      }))
      .sort(
        (left, right) =>
          compare(left.resourceCandidateIdOrNull, right.resourceCandidateIdOrNull) ||
          compare(left.groupIdOrNull, right.groupIdOrNull) ||
          compare(left.id, right.id),
      );
    const currentReviews = reviewRows.filter(
      (row) => row.superseded_by_review_id === null && row.review_state !== "SUPERSEDED",
    );
    const selectedReview = currentReviews.filter(
      (row) =>
        row.id === ids.m02ReviewStateId &&
        row.resource_candidate_id === ids.resourceCandidateId &&
        ["NOT_REQUIRED", "RESOLVED"].includes(String(row.review_state)),
    );
    const candidateReviewRow = reviewRows.find((row) => row.id === ids.m02ReviewStateId);
    if (candidateReviewRow === undefined)
      return mismatch(
        ids.m02ReviewStateId,
        candidate.bundle.m02InputProjection.candidateReviewState,
        undefined,
      );
    const currentCandidateReviews = currentReviews.filter(
      (row) => row.resource_candidate_id === ids.resourceCandidateId,
    );
    const activeBlockingReview = currentReviews.some((row) =>
      [
        "CLASSIFICATION_REVIEW_REQUIRED",
        "IDENTITY_REVIEW_REQUIRED",
        "CLARIFICATION_REQUESTED",
      ].includes(String(row.review_state)),
    );
    if (
      selectedReview.length !== 1 &&
      currentCandidateReviews.length === 1 &&
      currentCandidateReviews[0]?.id === ids.m02ReviewStateId
    ) {
      const actualReview = reviewProjection.find((row) => row.id === ids.m02ReviewStateId);
      markMismatch(
        ids.m02ReviewStateId,
        candidate.bundle.m02InputProjection.candidateReviewState,
        actualReview,
      );
    }
    if (selectedReview.length !== 1 || currentCandidateReviews.length !== 1 || activeBlockingReview)
      markFingerprintMismatch(
        "m04_guard:review_state_set",
        candidate.request.expectedPredecessorState.fingerprintExpectations.reviewStateSet,
        reviewProjection,
      );

    const resource = await one(
      `SELECT id,resource_type,status,reliable_identity_token,reliable_token_evidence_id,
              guard_anchor_candidate_id,record_version::text
         FROM ${this.#schemaSql}.resource_identities WHERE id=$1`,
      ids.resourceIdentityId,
    );
    const version = await one(
      `SELECT id,resource_identity_id,content_fingerprint,first_observed_source_snapshot_id,
              first_observed_candidate_root_id,first_observed_source_revision,observation_label,
              status,record_version::text
         FROM ${this.#schemaSql}.resource_version_identities WHERE id=$1`,
      ids.resourceVersionIdentityId,
    );
    if (resource === undefined)
      return mismatch(
        ids.resourceIdentityId,
        candidate.bundle.m02InputProjection.resourceIdentity,
        undefined,
      );
    if (version === undefined)
      return mismatch(
        ids.resourceVersionIdentityId,
        candidate.bundle.m02InputProjection.resourceVersionIdentity,
        undefined,
      );
    if (
      resource.status !== "ACTIVE" ||
      version.status !== "IDENTITY_RESOLVED" ||
      version.resource_identity_id !== resource.id ||
      candidateRow.resource_identity_id !== resource.id ||
      candidateRow.resource_version_identity_id !== version.id ||
      version.content_fingerprint !== ids.candidateContentFingerprint ||
      version.first_observed_source_snapshot_id !== ids.firstObservedSourceSnapshotId ||
      version.first_observed_source_revision !== ids.firstObservedSourceRevision ||
      version.first_observed_candidate_root_id !== ids.candidateRootId
    )
      markMismatch(ids.resourceVersionIdentityId, "ACTIVE_IDENTITY_RESOLVED_TUPLE", {
        resourceStatus: resource.status,
        versionStatus: version.status,
        resourceId: version.resource_identity_id,
        contentFingerprint: version.content_fingerprint,
      });

    const observationRecord = await one(
      `SELECT id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
              resource_source_link_id,source_repository_id,provider,provider_repository_id,
              normalized_root_path,immutable_revision,observed_at
         FROM ${this.#schemaSql}.resource_version_observations WHERE id=$1`,
      ids.resourceVersionObservationId,
    );
    const observationMissing = observationRecord === undefined;
    const observation = observationRecord ?? {};
    const sourceRepository = await one(
      `SELECT id,provider,provider_repository_id,first_observed_source_snapshot_id,record_version::text
         FROM ${this.#schemaSql}.source_repository_identities WHERE id=$1`,
      ids.sourceRepositoryId,
    );
    if (sourceRepository === undefined)
      return mismatch(
        ids.sourceRepositoryId,
        candidate.bundle.m02InputProjection.sourceRepository,
        undefined,
      );
    if (
      observation.resource_version_identity_id !== ids.resourceVersionIdentityId ||
      observation.source_snapshot_id !== ids.sourceSnapshotId ||
      observation.candidate_root_id !== ids.candidateRootId ||
      observation.resource_source_link_id !== ids.resourceSourceLinkId ||
      observation.source_repository_id !== ids.sourceRepositoryId ||
      observation.provider !== sourceRepository.provider ||
      observation.provider_repository_id !== sourceRepository.provider_repository_id ||
      observation.immutable_revision !== ids.sourceRevision
    )
      markMismatch(ids.resourceVersionObservationId, "EXACT_OBSERVATION_TUPLE", observation);

    const sourceLink = await one(
      `SELECT id,source_repository_id,normalized_root_path,target_resource_version_id,
              relationship,decision_id,state,record_version::text
         FROM ${this.#schemaSql}.resource_source_links WHERE id=$1`,
      ids.resourceSourceLinkId,
    );
    if (sourceLink === undefined)
      return mismatch(
        ids.resourceSourceLinkId,
        candidate.bundle.m02InputProjection.sourceLink,
        undefined,
      );
    if (
      sourceLink.state !== "ACTIVE" ||
      sourceLink.source_repository_id !== ids.sourceRepositoryId ||
      sourceLink.target_resource_version_id !== ids.resourceVersionIdentityId ||
      sourceLink.normalized_root_path !== observation.normalized_root_path
    )
      markMismatch(ids.resourceSourceLinkId, "ACTIVE_EXACT_SOURCE_LINK", sourceLink);

    const decision = await one(
      `SELECT id,resource_candidate_id,outcome,matched_tier,confidence,identity_policy_version,
              decision_source,state,record_version::text
         FROM ${this.#schemaSql}.identity_decisions WHERE id=$1`,
      ids.identityDecisionId,
    );
    if (decision === undefined)
      return mismatch(
        ids.identityDecisionId,
        candidate.bundle.m02InputProjection.identityDecision,
        undefined,
      );
    if (
      decision.state !== "ACTIVE" ||
      decision.resource_candidate_id !== ids.resourceCandidateId ||
      decision.outcome !== candidateRow.identity_outcome ||
      decision.identity_policy_version !== candidateRow.identity_policy_version ||
      handoff.identity_decision_id !== decision.id ||
      sourceLink.decision_id !== decision.id
    )
      markMismatch(ids.identityDecisionId, "CONTROLLING_IDENTITY_DECISION", decision);

    const snapshotRecord = await one(
      `SELECT id,identity_key,provider,provider_repository_id,immutable_revision,
              acquisition_policy_version,acquired_at
         FROM ${this.#schemaSql}.source_snapshots WHERE id=$1`,
      ids.sourceSnapshotId,
    );
    const acquisitionResultRecord = await one(
      `SELECT job_id,source_snapshot_id,result,created_at
         FROM ${this.#schemaSql}.acquisition_results WHERE job_id=$1`,
      ids.controllingM02JobId,
    );
    const snapshotMissing = snapshotRecord === undefined;
    const acquisitionResultMissing = acquisitionResultRecord === undefined;
    const snapshot = snapshotRecord ?? {};
    const acquisitionResult = acquisitionResultRecord ?? { result: {} };
    if (
      acquisitionResult.source_snapshot_id !== snapshot.id ||
      acquisitionJob.source_snapshot_id !== snapshot.id ||
      m02Job.source_snapshot_id !== snapshot.id ||
      candidateRow.source_snapshot_id !== snapshot.id ||
      candidateRoot.source_snapshot_id !== snapshot.id ||
      handoff.source_snapshot_id !== snapshot.id
    )
      markMismatch(ids.sourceSnapshotId, "EXACT_SNAPSHOT_LINEAGE", snapshot);
    if (sourceRepository.provider_repository_id !== snapshot.provider_repository_id)
      markMismatch(ids.sourceRepositoryId, "EXACT_SOURCE_REPOSITORY_TUPLE", sourceRepository);
    if (
      snapshot.immutable_revision !== ids.sourceRevision ||
      observation.immutable_revision !== ids.sourceRevision
    )
      markMismatch(ids.sourceSnapshotId, ids.sourceRevision, snapshot.immutable_revision);

    const consumedDocuments = candidate.bundle.sourceReferences.filter(
      (reference) => reference.kind === "DOCUMENT",
    );
    for (const reference of consumedDocuments) {
      const entry = await one(
        `SELECT id,source_snapshot_id,original_path,normalized_path,entry_kind,byte_length,
                disposition,reason_codes,content_fingerprint
           FROM ${this.#schemaSql}.m01_source_entries WHERE id=$1`,
        reference.sourceEntryId,
      );
      if (entry === undefined)
        return mismatch(reference.sourceEntryId, "EXACT_CONSUMED_SOURCE_ENTRY", undefined);
      if (
        entry.id !== reference.sourceEntryId ||
        entry.source_snapshot_id !== reference.sourceSnapshotId ||
        !["ACQUIRED", "SELECTED"].includes(String(entry.disposition)) ||
        entry.entry_kind !== "file" ||
        typeof entry.normalized_path !== "string" ||
        entry.normalized_path.length === 0 ||
        Number(entry.byte_length) < 0 ||
        !Array.isArray(entry.reason_codes) ||
        entry.content_fingerprint !== reference.contentHash
      )
        markMismatch(reference.sourceEntryId, "EXACT_CONSUMED_SOURCE_ENTRY", entry);
      const document = await one(
        `SELECT id,source_snapshot_id,source_entry_id,document_type,encoding,line_count,
                content_fingerprint
           FROM ${this.#schemaSql}.m01_source_documents WHERE id=$1`,
        reference.sourceDocumentId,
      );
      if (document === undefined)
        return mismatch(reference.sourceDocumentId, "EXACT_CONSUMED_SOURCE_DOCUMENT", undefined);
      if (
        document.id !== reference.sourceDocumentId ||
        document.source_snapshot_id !== reference.sourceSnapshotId ||
        document.source_entry_id !== reference.sourceEntryId ||
        document.document_type !== "UTF8_TEXT" ||
        String(document.encoding).toLowerCase() !== "utf-8" ||
        Number(document.line_count) < 0 ||
        document.content_fingerprint !== reference.contentHash
      )
        markMismatch(reference.sourceDocumentId, "EXACT_CONSUMED_SOURCE_DOCUMENT", document);
      const locator = reference.locator;
      if (
        locator.type !== "SENSITIVE_LOCATOR" &&
        "path" in locator &&
        locator.path !== entry.normalized_path
      )
        markMismatch(reference.sourceEntryId, locator.path, entry.normalized_path);
    }

    const ownershipRows = (
      await this.queryDomain<Record<string, unknown>>(
        client,
        `SELECT id,candidate_root_id,source_snapshot_id,source_entry_id,ownership
           FROM ${this.#schemaSql}.candidate_root_ownership
          WHERE candidate_root_id=$1 AND source_snapshot_id=$2`,
        [ids.candidateRootId, ids.sourceSnapshotId],
      )
    ).rows;
    const rootOrderRows = (
      await this.queryDomain<Record<string, unknown>>(
        client,
        `SELECT id,group_id,classification_run_id,candidate_root_id,source_snapshot_id,root_ordinal
           FROM ${this.#schemaSql}.repository_candidate_root_order
          WHERE group_id=$1 AND classification_run_id=$2 AND source_snapshot_id=$3`,
        [candidateRoot.group_id, candidateRoot.classification_run_id, ids.sourceSnapshotId],
      )
    ).rows;
    const ownershipProjection = {
      ownershipRows: ownershipRows
        .map((row) => ({
          id: row.id,
          candidateRootId: row.candidate_root_id,
          sourceSnapshotId: row.source_snapshot_id,
          sourceEntryId: row.source_entry_id,
          ownership: row.ownership,
        }))
        .sort(
          (left, right) =>
            compare(left.candidateRootId, right.candidateRootId) ||
            compare(left.sourceEntryId, right.sourceEntryId) ||
            compare(left.id, right.id),
        ),
      rootOrderRows: rootOrderRows
        .map((row) => ({
          id: row.id,
          groupId: row.group_id,
          classificationRunId: row.classification_run_id,
          candidateRootId: row.candidate_root_id,
          sourceSnapshotId: row.source_snapshot_id,
          rootOrdinal: Number(row.root_ordinal),
        }))
        .sort(
          (left, right) =>
            compare(left.groupId, right.groupId) ||
            left.rootOrdinal - right.rootOrdinal ||
            compare(left.candidateRootId, right.candidateRootId) ||
            compare(left.id, right.id),
        ),
    };
    if (
      candidateRoot.state !== "ACTIVE" ||
      candidateRow.reconciled_classification_run_id !== candidateRoot.classification_run_id ||
      candidateRoot.normalized_root_path !== observation.normalized_root_path ||
      candidateRoot.candidate_root_fingerprint !== candidateRow.candidate_root_fingerprint ||
      candidateRoot.candidate_content_fingerprint !== ids.candidateContentFingerprint
    )
      markMismatch(ids.candidateRootId, "EXACT_ACTIVE_CANDIDATE_ROOT", candidateRoot);
    if (ownershipRows.length === 0 || rootOrderRows.length === 0)
      markFingerprintMismatch(
        "m04_guard:ownership_topology",
        candidate.request.expectedPredecessorState.fingerprintExpectations.ownershipTopology,
        ownershipProjection,
      );

    const expected = candidate.request.expectedPredecessorState;
    // Compare the complete canonical row projections below, in Section 9.1 order.

    const snapshotProjection = snapshotMissing
      ? { schemaVersion: "M04_MISSING_VALUE_V1" }
      : {
          id: snapshot.id,
          identityKey: snapshot.identity_key,
          provider: snapshot.provider,
          providerRepositoryId: snapshot.provider_repository_id,
          immutableRevision: snapshot.immutable_revision,
          acquisitionPolicyVersion: snapshot.acquisition_policy_version,
          acquiredAt: timestamp(snapshot.acquired_at),
        };
    const acquisitionResultProjection = acquisitionResultMissing
      ? { schemaVersion: "M04_MISSING_VALUE_V1" }
      : {
          jobId: acquisitionResult.job_id,
          sourceSnapshotId: acquisitionResult.source_snapshot_id,
          result: acquisitionResult.result,
          createdAt: timestamp(acquisitionResult.created_at),
        };
    const observationProjection = observationMissing
      ? { schemaVersion: "M04_MISSING_VALUE_V1" }
      : {
          id: observation.id,
          resourceVersionIdentityId: observation.resource_version_identity_id,
          sourceSnapshotId: observation.source_snapshot_id,
          candidateRootId: observation.candidate_root_id,
          resourceSourceLinkId: observation.resource_source_link_id,
          sourceRepositoryId: observation.source_repository_id,
          provider: observation.provider,
          providerRepositoryId: observation.provider_repository_id,
          normalizedRootPath: observation.normalized_root_path,
          immutableRevision: observation.immutable_revision,
          observedAt: timestamp(observation.observed_at),
        };
    const result = acquisitionResult.result as Record<string, unknown>;
    const providerProjection = {
      repositoryMetadata: result.repositoryMetadata,
      releaseSignals: result.releaseSignals,
      licenseSignals: result.licenseSignals,
      forkSignals: result.forkSignals,
    };
    const fingerprintChecks: readonly [string, unknown, string][] = [
      [ids.sourceSnapshotId, snapshotProjection, expected.fingerprintExpectations.sourceSnapshot],
      [
        ids.controllingM02JobId,
        acquisitionResultProjection,
        expected.fingerprintExpectations.acquisitionResult,
      ],
      [
        ids.resourceVersionObservationId,
        observationProjection,
        expected.fingerprintExpectations.resourceVersionObservation,
      ],
      [
        "m04_guard:ownership_topology",
        ownershipProjection,
        expected.fingerprintExpectations.ownershipTopology,
      ],
      [
        "m04_guard:review_state_set",
        reviewProjection,
        expected.fingerprintExpectations.reviewStateSet,
      ],
      [
        "m04_guard:provider_metadata",
        providerProjection,
        expected.fingerprintExpectations.providerMetadata,
      ],
    ];
    const replacement =
      m02Job.replacement_reason_code === null
        ? {
            kind: "ORIGINAL" as const,
            reasonCodeOrNull: null,
            inputPayloadOrNull: null,
            inputFingerprintOrNull: null,
            sourceJobIdOrNull: null,
            sourceOperationScopeOrNull: null,
            requestedOperationScopeOrNull: null,
            predecessorJobIds: [] as const,
            originalSourceSnapshotIdOrNull: null,
            replacementSourceSnapshotIdOrNull: null,
          }
        : {
            kind: "REPLACEMENT" as const,
            reasonCode: m02Job.replacement_reason_code,
            inputPayloadOrNull: {
              byteLength: (m02Job.replacement_input_payload as Buffer).byteLength,
              base64: (m02Job.replacement_input_payload as Buffer).toString("base64"),
            },
            inputFingerprintOrNull: m02Job.replacement_input_fingerprint,
            sourceJobIdOrNull: m02Job.replacement_source_job_id,
            sourceOperationScopeOrNull: m02Job.replacement_source_operation_scope,
            requestedOperationScopeOrNull: m02Job.replacement_requested_operation_scope,
            predecessorJobIds: m02Job.replacement_predecessor_job_ids,
            originalSourceSnapshotIdOrNull: m02Job.replacement_original_source_snapshot_id,
            replacementSourceSnapshotIdOrNull: m02Job.replacement_source_snapshot_id,
          };
    const currentProjectionValue = {
      handoff: {
        id: handoff.id,
        resourceCandidateId: handoff.resource_candidate_id,
        resourceIdentityId: handoff.resource_identity_id,
        resourceVersionIdentityId: handoff.resource_version_identity_id,
        controllingM02JobId: handoff.controlling_m02_job_id,
        sourceSnapshotId: handoff.source_snapshot_id,
        identityDecisionId: handoff.identity_decision_id,
        originType: handoff.origin_type,
        logicalKey: handoff.logical_key,
        state: handoff.state,
        recordVersion: handoff.record_version,
      },
      acquisitionJob: {
        id: acquisitionJob.id,
        status: acquisitionJob.status,
        currentStage: acquisitionJob.current_stage,
        sourceSnapshotId: acquisitionJob.source_snapshot_id,
        cancellationRequested: acquisitionJob.cancellation_requested,
        recordVersion: acquisitionJob.record_version,
      },
      m02Job: {
        id: m02Job.id,
        jobLineageId: m02Job.job_lineage_id,
        sourceSnapshotId: m02Job.source_snapshot_id,
        operationScope: m02Job.operation_scope,
        currentStage: m02Job.current_stage,
        reviewState: m02Job.review_state,
        supersessionState: m02Job.supersession_state,
        supersededByJobIdOrNull: m02Job.superseded_by_job_id,
        supersessionSequence: m02Job.supersession_sequence,
        controllingClassificationDecisionIdOrNull: m02Job.controlling_classification_decision_id,
        jobScopeKey: m02Job.job_scope_key,
        inputFingerprint: m02Job.input_fingerprint,
        classificationPolicyVersion: m02Job.classification_policy_version,
        identityPolicyVersion: m02Job.identity_policy_version,
        analysisPolicyVersion: m02Job.analysis_policy_version,
        parserProfileVersion: m02Job.parser_profile_version,
        promptBundleVersion: m02Job.prompt_bundle_version,
        analysisProviderAdapterIdOrNull: m02Job.analysis_provider_adapter_id,
        analysisModelIdOrNull: m02Job.analysis_model_id,
        analysisMethodologyVersionOrNull: m02Job.analysis_methodology_version,
        recordVersion: m02Job.record_version,
        replacement,
      },
      candidate: {
        id: candidateRow.id,
        sourceSnapshotId: candidateRow.source_snapshot_id,
        candidateRootId: candidateRow.candidate_root_id,
        candidateRootFingerprint: candidateRow.candidate_root_fingerprint,
        candidateContentFingerprint: candidateRow.candidate_content_fingerprint,
        reconciledClassificationRunId: candidateRow.reconciled_classification_run_id,
        classificationPolicyVersion: candidateRow.classification_policy_version,
        identityPolicyVersion: candidateRow.identity_policy_version,
        identityOutcome: candidateRow.identity_outcome,
        status: candidateRow.status,
        resourceIdentityId: candidateRow.resource_identity_id,
        resourceVersionIdentityId: candidateRow.resource_version_identity_id,
        recordVersion: candidateRow.record_version,
      },
      resourceIdentity: {
        id: resource.id,
        resourceType: resource.resource_type,
        status: resource.status,
        reliableIdentityTokenOrNull: resource.reliable_identity_token,
        reliableTokenEvidenceIdOrNull: resource.reliable_token_evidence_id,
        guardAnchorCandidateId: resource.guard_anchor_candidate_id,
        recordVersion: resource.record_version,
      },
      resourceVersionIdentity: {
        id: version.id,
        resourceIdentityId: version.resource_identity_id,
        contentFingerprint: version.content_fingerprint,
        firstObservedSourceSnapshotId: version.first_observed_source_snapshot_id,
        firstObservedCandidateRootId: version.first_observed_candidate_root_id,
        firstObservedSourceRevision: version.first_observed_source_revision,
        observationLabel: version.observation_label,
        status: version.status,
        recordVersion: version.record_version,
      },
      observation: {
        id: observation.id,
        resourceVersionIdentityId: observation.resource_version_identity_id,
        sourceSnapshotId: observation.source_snapshot_id,
        candidateRootId: observation.candidate_root_id,
        resourceSourceLinkId: observation.resource_source_link_id,
        sourceRepositoryId: observation.source_repository_id,
        provider: observation.provider,
        providerRepositoryId: observation.provider_repository_id,
        normalizedRootPath: observation.normalized_root_path,
        immutableRevision: observation.immutable_revision,
        observedAt: observationMissing ? undefined : timestamp(observation.observed_at),
      },
      sourceLink: {
        id: sourceLink.id,
        sourceRepositoryId: sourceLink.source_repository_id,
        normalizedRootPath: sourceLink.normalized_root_path,
        targetResourceVersionId: sourceLink.target_resource_version_id,
        relationship: sourceLink.relationship,
        decisionId: sourceLink.decision_id,
        state: sourceLink.state,
        recordVersion: sourceLink.record_version,
      },
      sourceRepository: {
        id: sourceRepository.id,
        provider: sourceRepository.provider,
        providerRepositoryId: sourceRepository.provider_repository_id,
        firstObservedSourceSnapshotId: sourceRepository.first_observed_source_snapshot_id,
        recordVersion: sourceRepository.record_version,
      },
      identityDecision: {
        id: decision.id,
        resourceCandidateId: decision.resource_candidate_id,
        outcome: decision.outcome,
        matchedTierOrNull: decision.matched_tier,
        confidenceOrNull: decision.confidence === null ? null : Number(decision.confidence),
        identityPolicyVersion: decision.identity_policy_version,
        decisionSource: decision.decision_source,
        state: decision.state,
        recordVersion: decision.record_version,
      },
      candidateReviewState: {
        id: candidateReviewRow.id,
        groupIdOrNull: candidateReviewRow.group_id,
        resourceCandidateId: candidateReviewRow.resource_candidate_id,
        reviewState: candidateReviewRow.review_state,
        supersededByReviewIdOrNull: candidateReviewRow.superseded_by_review_id,
        recordVersion: candidateReviewRow.record_version,
      },
      candidateRoot: {
        id: candidateRoot.id,
        groupId: candidateRoot.group_id,
        classificationRunId: candidateRoot.classification_run_id,
        sourceSnapshotId: candidateRoot.source_snapshot_id,
        normalizedRootPath: candidateRoot.normalized_root_path,
        candidateRootFingerprint: candidateRoot.candidate_root_fingerprint,
        candidateContentFingerprint: candidateRoot.candidate_content_fingerprint,
        state: candidateRoot.state,
        recordVersion: candidateRoot.record_version,
      },
    };
    const currentProjection = M03M02InputProjectionV1Schema.safeParse(currentProjectionValue);
    const expectedProjection = candidate.bundle.m02InputProjection;
    const rowOrder = [
      [ids.controllingM02JobId, "acquisitionJob"],
      [ids.controllingM02JobId, "m02Job"],
      [ids.handoffMarkerId, "handoff"],
      [ids.resourceCandidateId, "candidate"],
      [ids.resourceIdentityId, "resourceIdentity"],
      [ids.resourceVersionIdentityId, "resourceVersionIdentity"],
      [ids.resourceSourceLinkId, "sourceLink"],
      [ids.sourceRepositoryId, "sourceRepository"],
      [ids.identityDecisionId, "identityDecision"],
      [ids.m02ReviewStateId, "candidateReviewState"],
      [ids.candidateRootId, "candidateRoot"],
    ] as const;
    for (const [subjectId, key] of rowOrder) {
      const expectedRow = expectedProjection[key];
      const actualRow = currentProjection.success
        ? currentProjection.data[key]
        : currentProjectionValue[key];
      if (canonicalJsonM03(expectedRow) !== canonicalJsonM03(actualRow))
        return mismatch(subjectId, expectedRow, actualRow);
    }
    for (const [subjectId, projection, expectedFingerprint] of fingerprintChecks) {
      const actualFingerprint = fingerprintValue(projection);
      if (actualFingerprint !== expectedFingerprint)
        return { current: false, subjectId, expectedFingerprint, actualFingerprint };
    }
    if (eligibilityMismatch !== undefined) return eligibilityMismatch;
    if (!currentProjection.success)
      throw new PersistenceIntegrityError("M04_PREDECESSOR_PROJECTION_INVALID", "DATABASE", null);
    return { current: true };
  }

  private async findCanonicalCollision(
    client: PoolClient,
    candidate: EvidenceBindingCandidateV1,
    identity: DerivedAcceptedIdentityV1,
    validatedAssociations?: Map<string, ValidatedStoredAssociation>,
  ): Promise<CanonicalCollisionV1 | undefined> {
    let firstContentCollision: CanonicalCollisionV1 | undefined;
    const validatedClosure = new Set<string>();
    const rememberValidatedClosure = (
      associations: readonly StoredBindingRow[],
    ): ValidatedStoredAssociation | undefined => {
      // These aliases are learned only from complete, validated associations in
      // this preflight's serializable snapshot. Never reuse across preflights.
      // Keep at most two parsed contexts, not one large bundle per request alias.
      let firstValidated: ValidatedStoredAssociation | undefined;
      let exactKeyValidated: ValidatedStoredAssociation | undefined;
      const encodedCandidateKey = encodeM04IdempotencyKeyForDatabase(
        candidate.request.idempotencyKey,
      );
      for (const association of associations) {
        const validated = validateStoredAssociation(association);
        firstValidated ??= validated;
        if (association.idempotency_key === encodedCandidateKey) exactKeyValidated = validated;
      }
      // No alias or replay context is published until every association passes.
      for (const association of associations) {
        validatedClosure.add(`request.id=$1:${association.request_id}`);
        validatedClosure.add(`result.id=$1:${association.result_id}`);
        validatedClosure.add(`result.extraction_id=$1:${association.extraction_id}`);
      }
      // The caller still completes all collision preflight and byte comparisons
      // before serving this exact-key replay.
      if (exactKeyValidated !== undefined)
        validatedAssociations?.set(encodedCandidateKey, exactKeyValidated);
      return firstValidated;
    };
    const linkParentExtraction = new Map<string, string>();
    const validateMatchedClosure = async (
      kind: CanonicalCollisionV1["kind"],
      row: { id: string; [column: string]: unknown },
    ): Promise<void> => {
      let predicate: string;
      let value: string;
      if (kind === "REQUEST_ASSOCIATION") {
        predicate = "request.id=$1";
        value = row.id;
      } else if (kind === "BINDING_RESULT") {
        predicate = "result.id=$1";
        value = row.id;
      } else {
        let extractionId = row.extraction_id;
        if (kind === "LINK") {
          const claimId = row.claim_id;
          if (typeof claimId !== "string")
            throw new PersistenceIntegrityError("M04_STORED_MATCH_CLOSURE_INVALID", kind, row.id);
          extractionId = linkParentExtraction.get(claimId);
          if (extractionId === undefined) {
            const parent = await this.queryDomain<{ extraction_id: string }>(
              client,
              `SELECT extraction_id FROM ${this.#schemaSql}.m04_claims WHERE id=$1`,
              [claimId],
            );
            extractionId = parent.rows[0]?.extraction_id;
            if (typeof extractionId === "string") linkParentExtraction.set(claimId, extractionId);
          }
        }
        if (typeof extractionId !== "string")
          throw new PersistenceIntegrityError("M04_STORED_MATCH_CLOSURE_INVALID", kind, row.id);
        predicate = "result.extraction_id=$1";
        value = extractionId;
      }
      const key = `${predicate}:${value}`;
      if (validatedClosure.has(key)) return;
      const closure = await this.lookupMany(client, predicate, [value]);
      if (closure.length === 0)
        throw new PersistenceIntegrityError("M04_STORED_MATCH_CLOSURE_INVALID", kind, row.id);
      try {
        rememberValidatedClosure(closure);
      } catch {
        throw new PersistenceIntegrityError("M04_STORED_MATCH_CLOSURE_INVALID", kind, row.id);
      }
      validatedClosure.add(key);
    };
    const bundles = await this.queryDomain<{
      extraction_id: string;
      canonical_payload_sha256: string;
      m02_input_projection_fingerprint: string;
      m03_input_fingerprint: string;
      m03_output_fingerprint: string;
      logical_payload_sha256: string;
      payload: Buffer;
    }>(
      client,
      `SELECT bundle.extraction_id,bundle.canonical_payload_sha256,
              bundle.m02_input_projection_fingerprint,bundle.m03_input_fingerprint,
              bundle.m03_output_fingerprint,bundle.logical_payload_sha256,
              string_agg(chunk.chunk_bytes,''::bytea ORDER BY chunk.chunk_ordinal) payload
         FROM ${this.#schemaSql}.m03_extraction_bundles bundle
         JOIN ${this.#schemaSql}.m03_extraction_bundle_chunks chunk ON chunk.extraction_id=bundle.extraction_id
        WHERE bundle.extraction_id=$1 OR bundle.canonical_payload_sha256=$2
           OR bundle.m02_input_projection_fingerprint=$3 OR bundle.m03_input_fingerprint=$4
           OR bundle.m03_output_fingerprint=$5 OR bundle.logical_payload_sha256=$6
        GROUP BY bundle.extraction_id
        ORDER BY bundle.extraction_id COLLATE pg_catalog."C"`,
      [
        candidate.bundle.extractionId,
        candidate.bundleCanonicalSha256,
        candidate.bundle.m02InputProjectionFingerprint,
        candidate.bundle.inputFingerprint,
        candidate.bundle.outputFingerprint,
        candidate.logicalPayloadSha256,
      ],
    );
    for (const row of bundles.rows) {
      const closure = await this.lookupMany(client, "result.extraction_id=$1", [row.extraction_id]);
      if (closure.length === 0)
        throw new PersistenceIntegrityError(
          "M04_STORED_BUNDLE_CLOSURE_INVALID",
          "BUNDLE",
          row.extraction_id,
        );
      const firstValidated = rememberValidatedClosure(closure);
      // Reuse a bundle only after every association's complete retained closure
      // validates, and every independently selected bundle field and byte agrees.
      // This is local to this preflight/snapshot, never a cross-request cache.
      if (
        firstValidated === undefined ||
        !closure.every(
          (association) =>
            association.extraction_id === row.extraction_id &&
            association.canonical_payload_sha256 === row.canonical_payload_sha256 &&
            association.m02_input_projection_fingerprint === row.m02_input_projection_fingerprint &&
            association.m03_input_fingerprint === row.m03_input_fingerprint &&
            association.m03_output_fingerprint === row.m03_output_fingerprint &&
            association.logical_payload_sha256 === row.logical_payload_sha256 &&
            bytesEqual(association.bundle_payload, row.payload),
        )
      )
        throw new PersistenceIntegrityError(
          "M04_STORED_BUNDLE_INTEGRITY",
          "BUNDLE",
          row.extraction_id,
        );
      const value = firstValidated.bundle;
      const sameInputComponents =
        bytesEqual(
          canonicalBytes(value.m02InputProjection),
          canonicalBytes(candidate.bundle.m02InputProjection),
        ) &&
        bytesEqual(
          canonicalBytes(value.expectedPredecessorState),
          canonicalBytes(candidate.bundle.expectedPredecessorState),
        ) &&
        bytesEqual(
          canonicalBytes(value.analysisConfiguration),
          canonicalBytes(candidate.bundle.analysisConfiguration),
        );
      const sameExtractionPreimage = bytesEqual(
        canonicalBytes({
          resourceVersionIdentityId: value.m02.resourceVersionIdentityId,
          resourceVersionObservationId: value.m02.resourceVersionObservationId,
          inputFingerprint: value.inputFingerprint,
          analysisResultFingerprint: value.analysisResultFingerprint,
        }),
        canonicalBytes({
          resourceVersionIdentityId: candidate.bundle.m02.resourceVersionIdentityId,
          resourceVersionObservationId: candidate.bundle.m02.resourceVersionObservationId,
          inputFingerprint: candidate.bundle.inputFingerprint,
          analysisResultFingerprint: candidate.bundle.analysisResultFingerprint,
        }),
      );
      const outputPreimage = (bundle: typeof value) => {
        const { outputFingerprint: _fingerprint, ...preimage } = m03LogicalProjection(bundle);
        void _fingerprint;
        return canonicalBytes(preimage);
      };
      const collisionDomain = [
        {
          matched: row.extraction_id === candidate.bundle.extractionId && !sameExtractionPreimage,
          fingerprint: candidate.bundle.extractionId.slice(4),
        },
        {
          matched:
            row.canonical_payload_sha256 === candidate.bundleCanonicalSha256 &&
            !bytesEqual(row.payload, candidate.bundleCanonicalPayload),
          fingerprint: candidate.bundleCanonicalSha256,
        },
        {
          matched:
            row.m02_input_projection_fingerprint ===
              candidate.bundle.m02InputProjectionFingerprint &&
            !bytesEqual(
              canonicalBytes(value.m02InputProjection),
              canonicalBytes(candidate.bundle.m02InputProjection),
            ),
          fingerprint: candidate.bundle.m02InputProjectionFingerprint,
        },
        {
          matched:
            row.m03_input_fingerprint === candidate.bundle.inputFingerprint && !sameInputComponents,
          fingerprint: candidate.bundle.inputFingerprint,
        },
        {
          matched:
            row.m03_output_fingerprint === candidate.bundle.outputFingerprint &&
            !bytesEqual(outputPreimage(value), outputPreimage(candidate.bundle)),
          fingerprint: candidate.bundle.outputFingerprint,
        },
        {
          matched:
            row.logical_payload_sha256 === candidate.logicalPayloadSha256 &&
            !bytesEqual(canonicalBytes(m03LogicalProjection(value)), candidate.logicalPayload),
          fingerprint: candidate.logicalPayloadSha256,
        },
      ].find((domain) => domain.matched);
      if (collisionDomain !== undefined && firstContentCollision === undefined)
        firstContentCollision = {
          stage: "BUNDLE",
          kind: "BUNDLE",
          subjectId: row.extraction_id,
          fingerprint: collisionDomain.fingerprint,
        };
    }
    const requestId = `m4q_${sha256(
      canonicalJsonM03({
        schemaVersion: "M04_REQUEST_RECORD_ID_V1",
        requestFingerprint: candidate.requestFingerprint,
      }),
    )}`;
    const checks: readonly {
      table: string;
      idColumn: string;
      fingerprintColumn: string;
      payloadColumn: string;
      id: string;
      fingerprint: string;
      payload: Uint8Array | (() => Uint8Array);
      alternates: readonly { column: string; value: string | number }[];
      stage: "PROJECTION" | "PERSISTENCE";
      kind:
        "REQUEST_ASSOCIATION" | "EVIDENCE" | "CLAIM" | "LINK" | "COMPLETENESS" | "BINDING_RESULT";
    }[] = [
      {
        table: "m04_binding_requests",
        idColumn: "id",
        fingerprintColumn: "request_fingerprint",
        payloadColumn: "request_canonical_payload",
        id: requestId,
        fingerprint: candidate.requestFingerprint,
        payload: candidate.requestCanonicalPayload,
        alternates: [],
        stage: "PERSISTENCE",
        kind: "REQUEST_ASSOCIATION",
      },
      ...candidate.evidenceItems.map((record) => ({
        table: "m04_evidence_items",
        idColumn: "id",
        fingerprintColumn: "record_fingerprint",
        payloadColumn: "canonical_payload",
        id: record.id,
        fingerprint: record.recordFingerprint,
        payload: canonicalBytes(record),
        alternates: [
          { column: "extraction_id", value: record.extractionId },
          { column: "m03_source_reference_id", value: record.m03SourceReferenceId },
        ],
        stage: "PROJECTION" as const,
        kind: "EVIDENCE" as const,
      })),
      ...candidate.claims.map((record) => ({
        table: "m04_claims",
        idColumn: "id",
        fingerprintColumn: "record_fingerprint",
        payloadColumn: "canonical_payload",
        id: record.id,
        fingerprint: record.recordFingerprint,
        payload: canonicalBytes(record),
        alternates: [
          { column: "extraction_id", value: record.extractionId },
          { column: "field_key", value: record.fieldKey },
        ],
        stage: "PROJECTION" as const,
        kind: "CLAIM" as const,
      })),
      ...candidate.links.map((record) => ({
        table: "m04_claim_evidence_links",
        idColumn: "id",
        fingerprintColumn: "record_fingerprint",
        payloadColumn: "canonical_payload",
        id: record.id,
        fingerprint: record.recordFingerprint,
        // Fresh bindings have no incumbent link rows; defer their payload bytes
        // until a collision actually needs the exact comparison.
        payload: () => canonicalBytes(record),
        alternates: [
          { column: "claim_id", value: record.claimId },
          { column: "evidence_item_id", value: record.evidenceItemId },
          { column: "ordinal", value: record.ordinal },
        ],
        stage: "PROJECTION" as const,
        kind: "LINK" as const,
      })),
      {
        table: "m04_completeness_snapshots",
        idColumn: "id",
        fingerprintColumn: "record_fingerprint",
        payloadColumn: "canonical_payload",
        id: candidate.completeness.id,
        fingerprint: candidate.completeness.recordFingerprint,
        payload: canonicalBytes(candidate.completeness),
        alternates: [{ column: "extraction_id", value: candidate.bundle.extractionId }],
        stage: "PROJECTION",
        kind: "COMPLETENESS",
      },
      {
        table: "m04_binding_results",
        idColumn: "id",
        fingerprintColumn: "result_fingerprint",
        payloadColumn: "canonical_payload",
        id: identity.resultId,
        fingerprint: identity.resultFingerprint,
        payload: canonicalBytes(identity.resultCore),
        alternates: [
          { column: "binding_id", value: identity.bindingId },
          { column: "extraction_id", value: candidate.bundle.extractionId },
          { column: "completeness_id", value: candidate.completeness.id },
        ],
        stage: "PERSISTENCE",
        kind: "BINDING_RESULT",
      },
    ];
    let firstAlternateConflict: CanonicalCollisionV1 | undefined;
    type CollisionCheck = (typeof checks)[number];
    interface CollisionRow {
      id: string;
      fingerprint: string;
      payload: Buffer;
      [column: string]: unknown;
    }
    const rowsByCheck = new Map<CollisionCheck, readonly CollisionRow[]>();
    const alternateKeys = (kind: CollisionCheck["kind"]): readonly (readonly string[])[] => {
      switch (kind) {
        case "EVIDENCE":
          return [["extraction_id", "m03_source_reference_id"]];
        case "CLAIM":
          return [["extraction_id", "field_key"]];
        case "LINK":
          return [
            ["claim_id", "evidence_item_id"],
            ["claim_id", "ordinal"],
          ];
        case "COMPLETENESS":
          return [["extraction_id"]];
        case "BINDING_RESULT":
          return [["binding_id"], ["extraction_id"], ["completeness_id"]];
        case "REQUEST_ASSOCIATION":
          return [];
      }
    };
    for (const kind of [
      "REQUEST_ASSOCIATION",
      "EVIDENCE",
      "CLAIM",
      "LINK",
      "COMPLETENESS",
      "BINDING_RESULT",
    ] as const) {
      const kindChecks = checks.filter((check) => check.kind === kind);
      for (let offset = 0; offset < kindChecks.length; offset += 4096) {
        const batch = kindChecks.slice(offset, offset + 4096);
        const first = batch[0];
        if (first === undefined) continue;
        const extraColumns =
          kind === "REQUEST_ASSOCIATION"
            ? ["result_id"]
            : kind === "EVIDENCE"
              ? [
                  "source_snapshot_id",
                  "source_revision",
                  "source_entry_id",
                  "source_document_id",
                  "evidence_type",
                ]
              : kind === "CLAIM"
                ? ["resource_identity_id", "resource_version_identity_id", "status", "claim_class"]
                : kind === "LINK"
                  ? ["m03_source_reference_id", "relationship"]
                  : kind === "COMPLETENESS"
                    ? ["coverage_basis_points", "m05_progression"]
                    : ["kind"];
        const projectedColumns = [
          ...new Set([...first.alternates.map(({ column }) => column), ...extraColumns]),
        ];
        const broadColumns =
          kind === "BINDING_RESULT"
            ? ["binding_id", "extraction_id", "completeness_id"]
            : first.alternates[0] === undefined
              ? []
              : [first.alternates[0].column];
        const broadValues = broadColumns.map((column) => [
          ...new Set(
            batch.map((check) => check.alternates.find((item) => item.column === column)?.value),
          ),
        ]);
        const predicates = [
          `${first.idColumn}=ANY($1::text[])`,
          `${first.fingerprintColumn}=ANY($2::text[])`,
          ...broadColumns.map(
            (column, index) =>
              `${column}=ANY($${String(index + 3)}::${column === "ordinal" ? "integer" : "text"}[])`,
          ),
        ];
        const result = await this.queryDomain<CollisionRow>(
          client,
          `SELECT ${first.idColumn} id,${first.fingerprintColumn} fingerprint,${first.payloadColumn} payload${
            projectedColumns.length === 0 ? "" : `,${projectedColumns.join(",")}`
          } FROM ${this.#schemaSql}.${first.table}
            WHERE ${predicates.join(" OR ")}
            ORDER BY ${first.idColumn} COLLATE pg_catalog."C"`,
          [batch.map(({ id }) => id), batch.map(({ fingerprint }) => fingerprint), ...broadValues],
        );
        const byId = new Map<string, CollisionRow[]>();
        const byFingerprint = new Map<string, CollisionRow[]>();
        const alternateIndexes = alternateKeys(kind).map(() => new Map<string, CollisionRow[]>());
        const add = (index: Map<string, CollisionRow[]>, key: string, row: CollisionRow) => {
          const prior = index.get(key);
          if (prior === undefined) index.set(key, [row]);
          else prior.push(row);
        };
        for (const row of result.rows) {
          add(byId, row.id, row);
          add(byFingerprint, row.fingerprint, row);
          for (const [index, columns] of alternateKeys(kind).entries()) {
            const target = alternateIndexes[index];
            if (target !== undefined)
              add(target, JSON.stringify(columns.map((column) => row[column])), row);
          }
        }
        for (const check of batch) {
          const matches = new Map<string, CollisionRow>();
          for (const row of [
            ...(byId.get(check.id) ?? []),
            ...(byFingerprint.get(check.fingerprint) ?? []),
          ])
            matches.set(row.id, row);
          for (const [index, columns] of alternateKeys(kind).entries()) {
            const key = JSON.stringify(
              columns.map(
                (column) => check.alternates.find((item) => item.column === column)?.value,
              ),
            );
            for (const row of alternateIndexes[index]?.get(key) ?? []) matches.set(row.id, row);
          }
          rowsByCheck.set(
            check,
            [...matches.values()].sort((left, right) =>
              Buffer.compare(Buffer.from(left.id, "utf8"), Buffer.from(right.id, "utf8")),
            ),
          );
        }
      }
    }
    for (const check of checks) {
      const rows = rowsByCheck.get(check) ?? [];
      if (rows.length === 0) continue;
      const expectedPayload = typeof check.payload === "function" ? check.payload() : check.payload;
      for (const row of rows) await validateMatchedClosure(check.kind, row);
      const contentCollision = rows.find(
        (row) =>
          (row.id === check.id ||
            row.fingerprint === check.fingerprint ||
            (check.kind === "BINDING_RESULT" && row.binding_id === identity.bindingId)) &&
          !bytesEqual(row.payload, expectedPayload),
      );
      if (contentCollision !== undefined && firstContentCollision === undefined)
        firstContentCollision = {
          stage: check.stage,
          kind: check.kind,
          subjectId: contentCollision.id,
          fingerprint:
            check.kind === "BINDING_RESULT" && contentCollision.binding_id === identity.bindingId
              ? identity.bindingId.slice(4)
              : contentCollision.id === check.id
                ? check.id.slice(4)
                : check.fingerprint,
        };
      if (firstAlternateConflict !== undefined || check.alternates.length === 0) continue;
      const alternateKinds: readonly {
        kind: M04AlternateUniqueKeyKindV1;
        columns: readonly string[];
      }[] =
        check.kind === "EVIDENCE"
          ? [
              {
                kind: "EVIDENCE_EXTRACTION_REFERENCE",
                columns: ["extraction_id", "m03_source_reference_id"],
              },
            ]
          : check.kind === "CLAIM"
            ? [{ kind: "CLAIM_EXTRACTION_FIELD", columns: ["extraction_id", "field_key"] }]
            : check.kind === "LINK"
              ? [
                  { kind: "LINK_CLAIM_EVIDENCE", columns: ["claim_id", "evidence_item_id"] },
                  { kind: "LINK_CLAIM_ORDINAL", columns: ["claim_id", "ordinal"] },
                ]
              : check.kind === "COMPLETENESS"
                ? [{ kind: "COMPLETENESS_EXTRACTION", columns: ["extraction_id"] }]
                : check.kind === "BINDING_RESULT"
                  ? [
                      { kind: "RESULT_EXTRACTION", columns: ["extraction_id"] },
                      { kind: "RESULT_COMPLETENESS", columns: ["completeness_id"] },
                    ]
                  : [];
      for (const alternate of alternateKinds) {
        for (const row of rows) {
          if (bytesEqual(row.payload, expectedPayload)) continue;
          if (
            alternate.columns.every(
              (column) =>
                row[column] === check.alternates.find((item) => item.column === column)?.value,
            )
          ) {
            validateAlternateIncumbent(check.kind, row);
            firstAlternateConflict = {
              stage: check.stage,
              kind: check.kind,
              subjectId: row.id,
              fingerprint: row.fingerprint,
              incomingFingerprint: check.fingerprint,
              alternateKeyKind: alternate.kind,
            };
            break;
          }
        }
        if (firstAlternateConflict !== undefined) break;
      }
    }
    return firstContentCollision ?? firstAlternateConflict;
  }

  private async lookup(
    client: PoolClient,
    predicate: string,
    values: readonly unknown[],
  ): Promise<StoredBindingRow | undefined> {
    return (await this.lookupMany(client, predicate, values))[0];
  }

  private async lookupMany(
    client: PoolClient,
    predicate: string,
    values: readonly unknown[],
  ): Promise<StoredBindingRow[]> {
    const result = await this.queryDomain<StoredBindingRow>(
      client,
      `SELECT request.id AS request_id,request.idempotency_key,
              request.request_canonical_payload,request.request_fingerprint,
              request.request_payload_sha256,request.request_payload_byte_length,
              request.semantic_request_fingerprint,request.binding_id,request.result_id,
              result.result_fingerprint,result.binding_id AS result_binding_id,
              result.completeness_id AS result_completeness_id,result.kind AS result_kind,
              result.extraction_id,result.canonical_payload AS result_payload,
              completeness.canonical_payload AS completeness_payload,
              completeness.id AS completeness_id,
              completeness.record_fingerprint AS completeness_record_fingerprint,
              completeness.coverage_basis_points AS completeness_coverage_basis_points,
              completeness.m05_progression AS completeness_m05_progression,
              bundle.canonical_payload_sha256,bundle.canonical_payload_byte_length,
              bundle.canonical_payload_chunk_count,bundle.logical_payload_sha256,
              bundle.m02_input_projection_fingerprint,bundle.m03_input_fingerprint,
              bundle.m03_output_fingerprint,bundle.resource_identity_id,
              bundle.resource_version_identity_id,bundle.source_snapshot_id,bundle.source_revision,
              ARRAY(SELECT evidence.canonical_payload FROM ${this.#schemaSql}.m04_evidence_items evidence
                     WHERE evidence.extraction_id=result.extraction_id ORDER BY evidence.id)
                AS evidence_payloads,
              ARRAY(SELECT json_build_object(
                       'id',evidence.id,'extractionId',evidence.extraction_id,
                       'm03SourceReferenceId',evidence.m03_source_reference_id,
                       'sourceSnapshotId',evidence.source_snapshot_id,
                       'sourceRevision',evidence.source_revision,
                       'sourceEntryIdOrNull',evidence.source_entry_id,
                       'sourceDocumentIdOrNull',evidence.source_document_id,
                       'evidenceType',evidence.evidence_type,
                       'recordFingerprint',evidence.record_fingerprint)::text
                     FROM ${this.#schemaSql}.m04_evidence_items evidence
                     WHERE evidence.extraction_id=result.extraction_id ORDER BY evidence.id)
                AS evidence_relations,
              ARRAY(SELECT claim.canonical_payload FROM ${this.#schemaSql}.m04_claims claim
                     WHERE claim.extraction_id=result.extraction_id ORDER BY claim.id)
                AS claim_payloads,
              ARRAY(SELECT json_build_object(
                       'id',claim.id,'extractionId',claim.extraction_id,
                       'resourceIdentityId',claim.resource_identity_id,
                       'resourceVersionIdentityId',claim.resource_version_identity_id,
                       'fieldKey',claim.field_key,'status',claim.status,
                       'claimClass',claim.claim_class,
                       'recordFingerprint',claim.record_fingerprint)::text
                     FROM ${this.#schemaSql}.m04_claims claim
                     WHERE claim.extraction_id=result.extraction_id ORDER BY claim.id)
                AS claim_relations,
              ARRAY(SELECT link.canonical_payload
                     FROM ${this.#schemaSql}.m04_claim_evidence_links link
                     JOIN ${this.#schemaSql}.m04_claims claim ON claim.id=link.claim_id
                     WHERE claim.extraction_id=result.extraction_id ORDER BY link.id)
                AS link_payloads,
              ARRAY(SELECT json_build_object(
                       'id',link.id,'claimId',link.claim_id,
                       'evidenceItemId',link.evidence_item_id,
                       'm03SourceReferenceId',link.m03_source_reference_id,
                       'ordinal',link.ordinal,'relationship',link.relationship,
                       'recordFingerprint',link.record_fingerprint)::text
                     FROM ${this.#schemaSql}.m04_claim_evidence_links link
                     JOIN ${this.#schemaSql}.m04_claims claim ON claim.id=link.claim_id
                     WHERE claim.extraction_id=result.extraction_id ORDER BY link.id)
                AS link_relations,
              string_agg(chunks.chunk_bytes,''::bytea ORDER BY chunks.chunk_ordinal) AS bundle_payload,
              bool_and(encode(digest(chunks.chunk_bytes,'sha256'),'hex')=chunks.chunk_sha256)
                AND min(chunks.chunk_ordinal)=0
                AND max(chunks.chunk_ordinal)=bundle.canonical_payload_chunk_count-1
                AND count(*)=bundle.canonical_payload_chunk_count AS chunks_valid
       FROM ${this.#schemaSql}.m04_binding_requests request
       JOIN ${this.#schemaSql}.m04_binding_results result ON result.id=request.result_id
       JOIN ${this.#schemaSql}.m04_completeness_snapshots completeness ON completeness.extraction_id=result.extraction_id
       JOIN ${this.#schemaSql}.m03_extraction_bundle_chunks chunks ON chunks.extraction_id=result.extraction_id
       JOIN ${this.#schemaSql}.m03_extraction_bundles bundle ON bundle.extraction_id=result.extraction_id
       WHERE ${predicate}
       GROUP BY request.id,result.id,completeness.id,bundle.extraction_id
       ORDER BY request.id COLLATE pg_catalog."C"`,
      [...values],
    );
    return result.rows;
  }

  private async insertRequestAssociation(
    client: PoolClient,
    candidate: EvidenceBindingCandidateV1,
    bindingId: string,
    resultId: string,
  ): Promise<void> {
    const requestRecordId = `m4q_${sha256(canonicalJsonM03({ schemaVersion: "M04_REQUEST_RECORD_ID_V1", requestFingerprint: candidate.requestFingerprint }))}`;
    await this.queryDomain(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_binding_requests
        (id,idempotency_key,request_fingerprint,semantic_request_fingerprint,request_payload_sha256,
         request_payload_byte_length,request_canonical_payload,binding_id,result_id,created_at)
       VALUES ($1,$2,$3,$4,$3,$5,$6,$7,$8,$9)`,
      [
        requestRecordId,
        encodeM04IdempotencyKeyForDatabase(candidate.request.idempotencyKey),
        candidate.requestFingerprint,
        candidate.semanticRequestFingerprint,
        candidate.requestCanonicalPayload.byteLength,
        Buffer.from(candidate.requestCanonicalPayload),
        bindingId,
        resultId,
        this.now(),
      ],
    );
  }

  private async insertCanonicalRows<T>(
    client: PoolClient,
    statementPrefix: string,
    rows: readonly T[],
    valuesForRow: (row: T) => readonly unknown[],
  ): Promise<void> {
    // One checked, named statement per bounded batch preserves the before/after
    // authority and OID checks while avoiding an unbounded statement count.
    for (let offset = 0; offset < rows.length; offset += 4096) {
      const batch = rows.slice(offset, offset + 4096).map(valuesForRow);
      const width = batch[0]?.length;
      if (width === undefined || width === 0 || batch.some((row) => row.length !== width))
        throw new PersistenceIntegrityError("M04_DATABASE_SCHEMA_INVALID", "DATABASE", null);
      const placeholders = batch.map(
        (_, index) =>
          `(${Array.from({ length: width }, (_unused, ordinal) => `$${String(index * width + ordinal + 1)}`).join(",")})`,
      );
      await this.queryDomain(
        client,
        `${statementPrefix} VALUES ${placeholders.join(",")}`,
        batch.flat(),
      );
    }
  }

  private async insertBinding(
    client: PoolClient,
    candidate: EvidenceBindingCandidateV1,
    identity: DerivedAcceptedIdentityV1,
  ): Promise<EvidenceBindingResultV1> {
    const chunks: Buffer[] = [];
    for (let offset = 0; offset < candidate.bundleCanonicalPayload.byteLength; offset += 1_048_576)
      chunks.push(Buffer.from(candidate.bundleCanonicalPayload.slice(offset, offset + 1_048_576)));
    await this.queryDomain(
      client,
      `INSERT INTO ${this.#schemaSql}.m03_extraction_bundles
       (extraction_id,resource_identity_id,resource_version_identity_id,source_snapshot_id,source_revision,
        m02_input_projection_fingerprint,m03_input_fingerprint,m03_output_fingerprint,
        logical_payload_sha256,canonical_payload_sha256,canonical_payload_byte_length,
        canonical_payload_chunk_count,persisted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        candidate.bundle.extractionId,
        candidate.bundle.m02.resourceIdentityId,
        candidate.bundle.m02.resourceVersionIdentityId,
        candidate.bundle.m02.sourceSnapshotId,
        candidate.bundle.m02.sourceRevision,
        candidate.bundle.m02InputProjectionFingerprint,
        candidate.bundle.inputFingerprint,
        candidate.bundle.outputFingerprint,
        candidate.logicalPayloadSha256,
        candidate.bundleCanonicalSha256,
        candidate.bundleCanonicalPayload.byteLength,
        chunks.length,
        this.now(),
      ],
    );
    for (const [ordinal, chunk] of chunks.entries())
      await this.queryDomain(
        client,
        `INSERT INTO ${this.#schemaSql}.m03_extraction_bundle_chunks(extraction_id,chunk_ordinal,chunk_bytes,chunk_sha256)
         VALUES ($1,$2,$3,$4)`,
        [candidate.bundle.extractionId, ordinal, chunk, sha256(chunk)],
      );
    await this.insertCanonicalRows(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_evidence_items
         (id,extraction_id,m03_source_reference_id,source_snapshot_id,source_revision,source_entry_id,
          source_document_id,evidence_type,canonical_payload,record_fingerprint,created_at)`,
      candidate.evidenceItems,
      (item) => [
        item.id,
        item.extractionId,
        item.m03SourceReferenceId,
        item.sourceSnapshotId,
        item.sourceRevision,
        item.sourceEntryIdOrNull,
        item.sourceDocumentIdOrNull,
        item.evidenceType,
        canonicalBytes(item),
        item.recordFingerprint,
        this.now(),
      ],
    );
    await this.insertCanonicalRows(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_claims
         (id,extraction_id,resource_identity_id,resource_version_identity_id,field_key,status,claim_class,
          canonical_payload,record_fingerprint,created_at)`,
      candidate.claims,
      (claim) => [
        claim.id,
        claim.extractionId,
        claim.resourceIdentityId,
        claim.resourceVersionIdentityId,
        claim.fieldKey,
        claim.status,
        claim.claimClass,
        canonicalBytes(claim),
        claim.recordFingerprint,
        this.now(),
      ],
    );
    await this.insertCanonicalRows(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_claim_evidence_links
         (id,claim_id,evidence_item_id,m03_source_reference_id,ordinal,relationship,canonical_payload,record_fingerprint,created_at)`,
      candidate.links,
      (link) => [
        link.id,
        link.claimId,
        link.evidenceItemId,
        link.m03SourceReferenceId,
        link.ordinal,
        link.relationship,
        canonicalBytes(link),
        link.recordFingerprint,
        this.now(),
      ],
    );
    await this.queryDomain(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_completeness_snapshots
       (id,extraction_id,canonical_payload,coverage_basis_points,m05_progression,record_fingerprint,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        candidate.completeness.id,
        candidate.bundle.extractionId,
        canonicalBytes(candidate.completeness),
        candidate.completeness.coverageBasisPoints,
        candidate.completeness.m05Progression,
        candidate.completeness.recordFingerprint,
        this.now(),
      ],
    );
    const { bindingId, resultCore, resultId, resultFingerprint } = identity;
    await this.queryDomain(
      client,
      `INSERT INTO ${this.#schemaSql}.m04_binding_results
       (id,kind,binding_id,extraction_id,completeness_id,canonical_payload,result_fingerprint,created_at)
       VALUES ($1,'ACCEPTED',$2,$3,$4,$5,$6,$7)`,
      [
        resultId,
        bindingId,
        candidate.bundle.extractionId,
        candidate.completeness.id,
        canonicalBytes(resultCore),
        resultFingerprint,
        this.now(),
      ],
    );
    await this.insertRequestAssociation(client, candidate, bindingId, resultId);
    return {
      kind: "ACCEPTED",
      resultId,
      bindingId,
      extractionId: candidate.bundle.extractionId,
      completeness: candidate.completeness,
      replayed: false,
      resultFingerprint,
    };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}
