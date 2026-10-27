import { z } from "zod";

import {
  ExpectedPredecessorStateV1Schema,
  M03FieldKeySchema,
  M03WarningCodeSchema,
  type M03FieldKey,
} from "./m03.js";
import { DocumentLocatorV1Schema, ExtractionValueSchemaByFieldV1 } from "./m03-values.js";

const strictObject = z.strictObject;
const id = z.string().min(1).max(2000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const gitSha40 = z.string().regex(/^[a-f0-9]{40}$/u);
const contentId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-f0-9]{64}$`, "u"));
const boundedScalarString = (maximum: number) =>
  z.string().superRefine((value, context) => {
    let scalars = 0;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const trailing = value.charCodeAt(index + 1);
        if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) {
          context.addIssue({ code: "custom", message: "invalid Unicode scalar string" });
          return;
        }
        index += 1;
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        context.addIssue({ code: "custom", message: "invalid Unicode scalar string" });
        return;
      }
      scalars += 1;
    }
    if (scalars > maximum)
      context.addIssue({ code: "custom", message: "Unicode scalar bound exceeded" });
  });
const snapshotMetadataLocatorV1Schema = z.discriminatedUnion("type", [
  strictObject({
    type: z.literal("SNAPSHOT_FIELD"),
    metadataKey: z.enum([
      "id",
      "identityKey",
      "provider",
      "providerRepositoryId",
      "immutableRevision",
      "acquisitionPolicyVersion",
      "acquiredAt",
    ]),
  }),
  strictObject({
    type: z.literal("REPOSITORY_FIELD"),
    metadataKey: z.enum(["name", "owner", "description", "archived", "visibility"]),
  }),
  strictObject({
    type: z.literal("RELEASE_FIELD"),
    metadataKey: z.enum(["tags", "latestRelease"]),
    ordinalOrNull: z.number().int().min(0).max(999).nullable(),
  }).superRefine((value, context) => {
    if ((value.metadataKey === "tags") !== (value.ordinalOrNull !== null))
      context.addIssue({ code: "custom", message: "release ordinal mismatch" });
  }),
  strictObject({ type: z.literal("LICENSE_FIELD"), metadataKey: z.enum(["spdxId", "source"]) }),
  strictObject({
    type: z.literal("FORK_FIELD"),
    metadataKey: z.enum(["isFork", "parentCanonicalUrl"]),
  }),
]);

export const M04_MATERIAL_REQUIREMENTS_V1 = [
  ["identity", ["canonical_skill_name"]],
  ["attribution", ["creator_candidates", "organization_candidates"]],
  ["version", ["version"]],
  ["license", ["license"]],
  ["purpose", ["outcome_candidate"]],
  ["capabilities", ["capabilities"]],
  ["installation", ["installation"]],
  ["dependencies", ["dependencies"]],
  ["permissions", ["permissions"]],
  ["compatibility", ["compatibility"]],
  ["limitations", ["limitations"]],
] as const;

const idempotencyKeyEncoder = new TextEncoder();
const idempotencyKeyDecoder = new TextDecoder("utf-8", { fatal: true });

const hasOnlyUnicodeScalars = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
};

export const isValidM04IdempotencyKey = (value: string): boolean =>
  value.length > 0 &&
  hasOnlyUnicodeScalars(value) &&
  idempotencyKeyEncoder.encode(value).byteLength <= 200;

export const encodeM04IdempotencyKeyForDatabase = (value: string): string => {
  if (!isValidM04IdempotencyKey(value)) throw new Error("M04_IDEMPOTENCY_KEY_INVALID");
  return Array.from(idempotencyKeyEncoder.encode(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};

export const decodeM04IdempotencyKeyFromDatabase = (encoded: string): string => {
  if (!/^(?:[0-9a-f]{2}){1,200}$/u.test(encoded))
    throw new Error("M04_STORED_IDEMPOTENCY_KEY_INVALID");
  const bytes = Uint8Array.from(encoded.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
  let value: string;
  try {
    value = idempotencyKeyDecoder.decode(bytes);
  } catch {
    throw new Error("M04_STORED_IDEMPOTENCY_KEY_INVALID");
  }
  if (!isValidM04IdempotencyKey(value) || encodeM04IdempotencyKeyForDatabase(value) !== encoded)
    throw new Error("M04_STORED_IDEMPOTENCY_KEY_INVALID");
  return value;
};

export const EvidenceBindingRequestV1Schema = strictObject({
  schemaVersion: z.literal("M04_EVIDENCE_BINDING_REQUEST_V1"),
  idempotencyKey: z.string().refine(isValidM04IdempotencyKey),
  extractionId: contentId("ext_"),
  expectedM03OutputFingerprint: sha256,
  expectedResourceIdentityId: id,
  expectedResourceVersionIdentityId: id,
  expectedSourceSnapshotId: id,
  expectedSourceRevision: gitSha40,
  expectedPredecessorState: ExpectedPredecessorStateV1Schema,
  evidencePolicyVersion: z.literal("m04-evidence-policy-v1"),
  materialFieldRegistryVersion: z.literal("m04-material-fields-v1"),
});

export const EvidenceItemV1Schema = strictObject({
  schemaVersion: z.literal("M04_EVIDENCE_ITEM_V1"),
  id: contentId("evi_"),
  extractionId: contentId("ext_"),
  m03SourceReferenceId: id,
  sourceSnapshotId: id,
  sourceRevision: gitSha40,
  evidenceType: z.enum([
    "SOURCE_TEXT",
    "MANIFEST_FIELD",
    "REPOSITORY_METADATA",
    "RELEASE_METADATA",
    "FILE_STRUCTURE",
    "INVENTORY_ABSENCE",
  ]),
  locatorOrNull: z.union([DocumentLocatorV1Schema, snapshotMetadataLocatorV1Schema]).nullable(),
  sourceEntryIdOrNull: id.nullable(),
  sourceDocumentIdOrNull: id.nullable(),
  contentFingerprint: sha256,
  excerptState: z.enum(["RETAINED_INTERNAL", "OMITTED", "NOT_APPLICABLE"]),
  excerptOrNull: boundedScalarString(2000).nullable(),
  visibility: z.literal("INTERNAL_EVIDENCE"),
  displayAuthorization: z.literal("NOT_GRANTED"),
  recordFingerprint: sha256,
}).superRefine((value, context) => {
  const isDocument = ["SOURCE_TEXT", "MANIFEST_FIELD", "FILE_STRUCTURE"].includes(
    value.evidenceType,
  );
  if (isDocument !== (value.sourceEntryIdOrNull !== null && value.sourceDocumentIdOrNull !== null))
    context.addIssue({ code: "custom", message: "source tuple mismatch" });
  if ((value.excerptState === "RETAINED_INTERNAL") !== (value.excerptOrNull !== null))
    context.addIssue({ code: "custom", message: "excerpt state mismatch" });
  if (value.evidenceType === "INVENTORY_ABSENCE" && value.locatorOrNull !== null)
    context.addIssue({ code: "custom", message: "absence locator must be null" });
  const locatorType = value.locatorOrNull?.type;
  const metadata =
    value.evidenceType === "REPOSITORY_METADATA" || value.evidenceType === "RELEASE_METADATA";
  if (
    metadata !==
    (
      [
        "SNAPSHOT_FIELD",
        "REPOSITORY_FIELD",
        "RELEASE_FIELD",
        "LICENSE_FIELD",
        "FORK_FIELD",
      ] as string[]
    ).includes(locatorType ?? "")
  )
    context.addIssue({ code: "custom", message: "metadata locator mismatch" });
  if (isDocument && (locatorType === undefined || metadata))
    context.addIssue({ code: "custom", message: "document locator mismatch" });
  const originalType =
    locatorType === "SENSITIVE_LOCATOR"
      ? (value.locatorOrNull as { originalType: string }).originalType
      : locatorType;
  const expectedType =
    originalType === "JSON_POINTER" || originalType === "DATA_POINTER"
      ? "MANIFEST_FIELD"
      : originalType === "TREE_PATH" || originalType === "FILE_METADATA"
        ? "FILE_STRUCTURE"
        : originalType === "LINE_RANGE" || originalType === "BYTE_RANGE"
          ? "SOURCE_TEXT"
          : locatorType === "RELEASE_FIELD"
            ? "RELEASE_METADATA"
            : locatorType === undefined
              ? "INVENTORY_ABSENCE"
              : "REPOSITORY_METADATA";
  if (value.evidenceType !== expectedType)
    context.addIssue({ code: "custom", message: "locator evidence type mismatch" });
  const expectedExcerptState =
    locatorType === "SENSITIVE_LOCATOR"
      ? "OMITTED"
      : value.evidenceType === "FILE_STRUCTURE" ||
          value.evidenceType === "INVENTORY_ABSENCE" ||
          metadata
        ? "NOT_APPLICABLE"
        : value.excerptOrNull !== null
          ? "RETAINED_INTERNAL"
          : "OMITTED";
  if (value.excerptState !== expectedExcerptState)
    context.addIssue({ code: "custom", message: "locator excerpt state mismatch" });
});

export const ClaimV1Schema = strictObject({
  schemaVersion: z.literal("M04_CLAIM_V1"),
  id: contentId("clm_"),
  extractionId: contentId("ext_"),
  resourceIdentityId: id,
  resourceVersionIdentityId: id,
  fieldKey: M03FieldKeySchema,
  value: z.unknown(),
  claimClass: z.enum([
    "SOURCE_FACT",
    "REPOSITORY_METADATA",
    "STATIC_CODE_INDICATOR",
    "FORMAT_INFERENCE",
    "AI_INFERENCE",
    "MIXED_DETERMINISTIC_SUPPORT",
    "MIXED_SUPPORT",
  ]),
  status: z.enum(["SUPPORTED", "SUPPORTED_WITH_QUALIFIER", "AMBIGUOUS", "REVIEW_REQUIRED"]),
  confidenceOrNull: z.number().min(0).max(1).nullable(),
  deterministicCandidateIds: z.array(id).max(8192),
  aiProposalIds: z.array(id).max(512),
  conflictIds: z.array(id).max(1024),
  warningCodes: z.array(M03WarningCodeSchema).max(29),
  recordFingerprint: sha256,
}).superRefine((value, context) => {
  if (!ExtractionValueSchemaByFieldV1[value.fieldKey].safeParse(value.value).success)
    context.addIssue({ code: "custom", message: "claim value does not match field" });
  const hasConflicts = value.conflictIds.length > 0;
  const validStatus =
    (value.status === "SUPPORTED" &&
      value.confidenceOrNull !== null &&
      value.confidenceOrNull >= 0.85 &&
      !hasConflicts) ||
    (value.status === "SUPPORTED_WITH_QUALIFIER" &&
      value.confidenceOrNull !== null &&
      value.confidenceOrNull >= 0.6 &&
      value.confidenceOrNull < 0.85 &&
      !hasConflicts) ||
    (value.status === "AMBIGUOUS" && value.confidenceOrNull === null && hasConflicts) ||
    (value.status === "REVIEW_REQUIRED" &&
      value.confidenceOrNull === null &&
      !hasConflicts &&
      value.warningCodes.length > 0);
  if (!validStatus) context.addIssue({ code: "custom", message: "claim status matrix mismatch" });
  const deterministic = value.deterministicCandidateIds.length > 0;
  const assisted = value.aiProposalIds.length > 0;
  const validClass =
    (["SOURCE_FACT", "REPOSITORY_METADATA", "STATIC_CODE_INDICATOR"].includes(value.claimClass) &&
      deterministic &&
      !assisted) ||
    (["FORMAT_INFERENCE", "MIXED_DETERMINISTIC_SUPPORT"].includes(value.claimClass) &&
      deterministic &&
      !assisted) ||
    (value.claimClass === "AI_INFERENCE" && !deterministic && assisted) ||
    (value.claimClass === "MIXED_SUPPORT" && deterministic && assisted);
  if (!validClass) context.addIssue({ code: "custom", message: "claim support matrix mismatch" });
});

export const ClaimEvidenceLinkV1Schema = strictObject({
  schemaVersion: z.literal("M04_CLAIM_EVIDENCE_LINK_V1"),
  id: contentId("cel_"),
  claimId: contentId("clm_"),
  evidenceItemId: contentId("evi_"),
  m03SourceReferenceId: id,
  relationship: z.enum(["SUPPORTS", "QUALIFIES", "CONTEXT_ONLY"]),
  ordinal: z.number().int().nonnegative().max(4095),
  recordFingerprint: sha256,
});

const completenessRequirementSchema = strictObject({
  key: z.string().min(1).max(100),
  status: z.enum(["COVERED", "MISSING", "UNSUPPORTED", "AMBIGUOUS", "REVIEW_REQUIRED"]),
  claimIds: z.array(contentId("clm_")).max(2),
  // Attribution contains two ordered claim projections; shared EvidenceItems
  // occur once per claim and are not deduplicated by the frozen projection.
  evidenceItemIds: z.array(contentId("evi_")).max(8192),
});

export const EvidenceCompletenessV1Schema = strictObject({
  schemaVersion: z.literal("M04_EVIDENCE_COMPLETENESS_V1"),
  id: contentId("cmp_"),
  registryVersion: z.literal("m04-material-fields-v1"),
  totalRequirements: z.literal(11),
  coveredRequirements: z.number().int().min(0).max(11),
  coverageBasisPoints: z.number().int().min(0).max(10000),
  requirements: z.array(completenessRequirementSchema).length(11),
  unresolvedConflictIds: z.array(id).max(1024),
  blockingRequirementKeys: z.array(z.string().min(1).max(100)).max(11),
  m05Progression: z.enum(["ELIGIBLE", "BLOCKED"]),
  recordFingerprint: sha256,
}).superRefine((value, context) => {
  const keys = M04_MATERIAL_REQUIREMENTS_V1.map(([key]) => key);
  const actualKeys = value.requirements.map(({ key }) => key);
  const covered = value.requirements.filter(({ status }) => status === "COVERED").length;
  const blockers = value.requirements
    .filter(({ status }) => status !== "COVERED")
    .map(({ key }) => key);
  if (JSON.stringify(actualKeys) !== JSON.stringify(keys))
    context.addIssue({ code: "custom", message: "requirement registry order mismatch" });
  for (const requirement of value.requirements) {
    const registry = M04_MATERIAL_REQUIREMENTS_V1.find(([key]) => key === requirement.key);
    if (registry !== undefined && requirement.evidenceItemIds.length > registry[1].length * 4096)
      context.addIssue({
        code: "custom",
        message: "requirement evidence occurrence bound exceeded",
      });
  }
  if (
    value.coveredRequirements !== covered ||
    value.coverageBasisPoints !== Math.floor((covered * 10000) / 11)
  )
    context.addIssue({ code: "custom", message: "coverage mismatch" });
  if (JSON.stringify(value.blockingRequirementKeys) !== JSON.stringify(blockers))
    context.addIssue({ code: "custom", message: "blocker registry mismatch" });
  const eligible =
    covered === 11 && blockers.length === 0 && value.unresolvedConflictIds.length === 0;
  if ((value.m05Progression === "ELIGIBLE") !== eligible)
    context.addIssue({ code: "custom", message: "progression mismatch" });
});

export const SafePreDomainDiagnosticV1Schema = strictObject({
  code: z.enum(["RAW_REQUEST_TOO_LARGE", "REQUEST_JSON_INVALID", "REQUEST_SCHEMA_INVALID"]),
  fieldOrNull: z.union([z.literal("ROOT"), z.enum(EvidenceBindingRequestV1Schema.keyof().options)]),
  observedByteLengthOrNull: z.number().int().nonnegative().nullable(),
  limitOrNull: z.number().int().positive().nullable(),
}).superRefine((value, context) => {
  const bounded = value.code === "RAW_REQUEST_TOO_LARGE";
  if (bounded !== (value.observedByteLengthOrNull !== null && value.limitOrNull !== null))
    context.addIssue({ code: "custom", message: "pre-domain bounds mismatch" });
});

const ExistingSafeDiagnosticV1Schema = strictObject({
  code: z.enum([
    "SCHEMA_INVALID",
    "EXPECTED_ACTUAL_MISMATCH",
    "PREDECESSOR_STALE",
    "REFERENCE_INVALID",
    "CLOSURE_INVALID",
    "BOUND_EXCEEDED",
    "HASH_COLLISION",
    "REQUEST_MISMATCH",
    "SERIALIZATION_EXHAUSTED",
    "PERSISTENCE_FAILURE",
  ]),
  stage: z.enum(["BUNDLE", "ELIGIBILITY", "PROJECTION", "PERSISTENCE"]),
  subjectKind: z.enum([
    "BUNDLE",
    "REQUEST_ASSOCIATION",
    "EXTRACTION",
    "PREDECESSOR",
    "EVIDENCE",
    "CLAIM",
    "LINK",
    "COMPLETENESS",
    "BINDING_RESULT",
    "MIGRATION",
    "DATABASE",
  ]),
  subjectIdOrNull: z.string().max(2000).nullable(),
  expectedFingerprintOrNull: sha256.nullable(),
  actualFingerprintOrNull: sha256.nullable(),
  observedCountOrNull: z.number().int().nonnegative().nullable(),
  limitOrNull: z.number().int().positive().nullable(),
}).superRefine((value, context) => {
  const needsFingerprints = [
    "EXPECTED_ACTUAL_MISMATCH",
    "PREDECESSOR_STALE",
    "HASH_COLLISION",
    "REQUEST_MISMATCH",
  ].includes(value.code);
  if (
    needsFingerprints !==
    (value.expectedFingerprintOrNull !== null && value.actualFingerprintOrNull !== null)
  )
    context.addIssue({ code: "custom", message: "diagnostic fingerprint mismatch" });
  const needsCounts = value.code === "BOUND_EXCEEDED";
  if (needsCounts !== (value.observedCountOrNull !== null && value.limitOrNull !== null))
    context.addIssue({ code: "custom", message: "diagnostic bound mismatch" });
  if (
    ["REFERENCE_INVALID", "CLOSURE_INVALID"].includes(value.code) &&
    value.subjectIdOrNull === null
  )
    context.addIssue({ code: "custom", message: "diagnostic subject required" });
});

export const M04AlternateUniqueKeyKindV1Schema = z.enum([
  "EVIDENCE_EXTRACTION_REFERENCE",
  "CLAIM_EXTRACTION_FIELD",
  "LINK_CLAIM_EVIDENCE",
  "LINK_CLAIM_ORDINAL",
  "COMPLETENESS_EXTRACTION",
  "RESULT_EXTRACTION",
  "RESULT_COMPLETENESS",
]);

const AlternateUniqueConflictDiagnosticV1Schema = strictObject({
  code: z.literal("UNIQUE_KEY_CONFLICT"),
  stage: z.enum(["PROJECTION", "PERSISTENCE"]),
  subjectKind: z.enum(["EVIDENCE", "CLAIM", "LINK", "COMPLETENESS", "BINDING_RESULT"]),
  subjectIdOrNull: z.string().max(2000),
  expectedFingerprintOrNull: sha256,
  actualFingerprintOrNull: sha256,
  alternateKeyKind: M04AlternateUniqueKeyKindV1Schema,
  observedCountOrNull: z.null(),
  limitOrNull: z.null(),
});

export const SafeDiagnosticV1Schema = z.union([
  ExistingSafeDiagnosticV1Schema,
  AlternateUniqueConflictDiagnosticV1Schema,
]);

export const M04EligibilityErrorV1Schema = z.enum([
  "IDEMPOTENCY_KEY_REUSED",
  "BINDING_REQUEST_MISMATCH",
  "M03_BUNDLE_SCHEMA_INVALID",
  "M03_NOT_BINDABLE",
  "LINEAGE_MISMATCH",
  "PREDECESSOR_NOT_CURRENT",
  "DANGLING_REFERENCE",
  "EVIDENCE_CLOSURE_INVALID",
  "BOUND_EXCEEDED",
  "CONTENT_HASH_COLLISION",
  "ALTERNATE_UNIQUE_KEY_CONFLICT",
]);

export const M04ProcessingErrorV1Schema = z.enum([
  "SERIALIZATION_FAILED",
  "SERIALIZATION_RETRY_EXHAUSTED",
  "PERSISTENCE_UNAVAILABLE",
  "PERSISTENCE_INTEGRITY_FAILED",
]);

/** Normative Section 16 diagnostic routing. Dynamic subjects/fingerprints/counts are
 * supplied by the terminal arm, but code/stage/default subject kind are closed here. */
export const M04_TERMINAL_DIAGNOSTIC_RULES_V1 = Object.freeze({
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
} as const);

const acceptedResult = strictObject({
  kind: z.literal("ACCEPTED"),
  resultId: contentId("m4r_"),
  bindingId: contentId("bnd_"),
  extractionId: contentId("ext_"),
  completeness: EvidenceCompletenessV1Schema,
  replayed: z.boolean(),
  resultFingerprint: sha256,
});
const terminalResult = <T extends z.ZodType>(kind: "REJECTED" | "FAILED", error: T) =>
  strictObject({
    kind: z.literal(kind),
    resultId: contentId("m4r_"),
    requestFingerprint: sha256,
    error,
    diagnostics: z.array(SafeDiagnosticV1Schema).length(1),
    resultFingerprint: sha256,
  });
export const EvidenceBindingResultV1Schema = z.discriminatedUnion("kind", [
  strictObject({
    kind: z.literal("MALFORMED"),
    rawRequestSha256: sha256,
    error: z.enum(["RAW_REQUEST_TOO_LARGE", "REQUEST_JSON_INVALID", "REQUEST_SCHEMA_INVALID"]),
    diagnostics: z.array(SafePreDomainDiagnosticV1Schema).length(1),
  }),
  acceptedResult,
  terminalResult("REJECTED", M04EligibilityErrorV1Schema),
  terminalResult("FAILED", M04ProcessingErrorV1Schema),
]);

export type EvidenceBindingRequestV1 = z.infer<typeof EvidenceBindingRequestV1Schema>;
export type EvidenceItemV1 = z.infer<typeof EvidenceItemV1Schema>;
export type ClaimV1 = z.infer<typeof ClaimV1Schema>;
export type ClaimEvidenceLinkV1 = z.infer<typeof ClaimEvidenceLinkV1Schema>;
export type EvidenceCompletenessV1 = z.infer<typeof EvidenceCompletenessV1Schema>;
export type SafeDiagnosticV1 = z.infer<typeof SafeDiagnosticV1Schema>;
export type M04AlternateUniqueKeyKindV1 = z.infer<typeof M04AlternateUniqueKeyKindV1Schema>;
export type EvidenceBindingResultV1 = z.infer<typeof EvidenceBindingResultV1Schema>;
export type M04FieldKey = M03FieldKey;
