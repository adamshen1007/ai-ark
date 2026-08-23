import { z } from "zod";

function closedEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export const AnalysisOperationSchema = closedEnum(["CLASSIFY_REPOSITORY"]);
export type AnalysisOperation = z.infer<typeof AnalysisOperationSchema>;

export const AnalysisRunStatusSchema = closedEnum([
  "SUCCEEDED",
  "INVALID_OUTPUT",
  "LIMIT_EXCEEDED",
  "TIMED_OUT",
  "FAILED",
]);
export type AnalysisRunStatus = z.infer<typeof AnalysisRunStatusSchema>;

export const ClassificationRunSourceSchema = closedEnum([
  "DETERMINISTIC",
  "AI_ASSISTED",
  "RECONCILED",
  "HUMAN_OVERRIDE",
]);
export type ClassificationRunSource = z.infer<typeof ClassificationRunSourceSchema>;

export const RepositoryCandidateStatusSchema = closedEnum([
  "CLASSIFIED",
  "IDENTITY_REVIEW_REQUIRED",
  "IDENTITY_RESOLVED",
  "REJECTED",
  "SUPERSEDED",
]);
export type RepositoryCandidateStatus = z.infer<typeof RepositoryCandidateStatusSchema>;

export const M02ReviewStateSchema = closedEnum([
  "NOT_REQUIRED",
  "CLASSIFICATION_REVIEW_REQUIRED",
  "IDENTITY_REVIEW_REQUIRED",
  "CLARIFICATION_REQUESTED",
  "RESOLVED",
  "REJECTED",
]);
export type M02ReviewState = z.infer<typeof M02ReviewStateSchema>;

export const M02OperationScopeSchema = closedEnum([
  "CLASSIFICATION",
  "IDENTITY_RESOLUTION",
  "FULL_PIPELINE",
]);
export type M02OperationScope = z.infer<typeof M02OperationScopeSchema>;

export const SupersessionStateSchema = closedEnum(["CONTROLLING", "SUPERSEDED"]);
export type SupersessionState = z.infer<typeof SupersessionStateSchema>;

export const ManualResolutionCommandSchema = closedEnum([
  "CREATE_RESOURCE",
  "ATTACH_NEW_VERSION",
  "MARK_FORK",
  "MARK_MIRROR",
  "MARK_DUPLICATE",
  "REJECT_CANDIDATE",
  "SPLIT_ROOTS",
  "MERGE_ROOTS",
  "OVERRIDE_NON_SKILL",
  "REQUEST_CLARIFICATION",
  "RESOLVE_AMBIGUITY",
  "REPLACE_M02_JOB",
]);
export type ManualResolutionCommand = z.infer<typeof ManualResolutionCommandSchema>;

export const M02ErrorCodeSchema = closedEnum([
  "RECORD_NOT_FOUND",
  "STALE_RECORD_VERSION",
  "RECORD_ALREADY_EXISTS",
  "EXPECTED_VERSION_SET_INVALID",
  "CONCURRENCY_GUARD_COLLISION",
  "PHANTOM_CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "TRANSITION_PROHIBITED",
  "ROLE_NOT_AUTHORIZED",
  "REFERENCE_INVALID",
  "UNSUPPORTED_OVERRIDE_PROHIBITED",
  "JOB_SUPERSEDED",
  "REPLACEMENT_INPUT_UNCHANGED",
  "FINGERPRINT_COLLISION",
  "EXTERNAL_IDENTIFIER_COLLISION",
  "INVALID_EXTERNAL_IDENTIFIER_ISSUER",
]);
export type M02ErrorCode = z.infer<typeof M02ErrorCodeSchema>;

export const ResourceIdentityStatusSchema = closedEnum(["ACTIVE", "AMBIGUOUS", "REJECTED"]);
export const ResourceVersionIdentityStatusSchema = closedEnum([
  "IDENTITY_RESOLVED",
  "SUPERSEDED",
  "REJECTED",
]);
export const DuplicateCandidateStatusSchema = closedEnum([
  "PROPOSED",
  "CONFIRMED",
  "REJECTED",
  "SUPERSEDED",
]);
export const IdentityRelationshipStatusSchema = closedEnum(["ACTIVE", "REJECTED", "SUPERSEDED"]);
export const SourceLinkRelationshipSchema = closedEnum(["PRIMARY", "ALTERNATE"]);
export const ExternalIdentifierTypeSchema = closedEnum([
  "PROVIDER_REPOSITORY_ID",
  "DECLARED_MANIFEST_ID",
]);
export const ExternalIdentifierProvenanceSchema = closedEnum([
  "M01_PROVIDER_ASSERTED",
  "HUMAN_VERIFIED_SOURCE_DECLARATION",
]);
export const ExternalIdentifierReviewStateSchema = closedEnum([
  "UNREVIEWED",
  "VERIFIED",
  "REJECTED",
  "SUPERSEDED",
]);

export const M02JobReplacementReasonSchema = closedEnum([
  "FAILED_STAGE_REPLACEMENT",
  "RETRY_EXHAUSTED",
  "NEW_SUPPORTED_SNAPSHOT",
  "POLICY_OR_METHODOLOGY_CHANGE",
  "ADMINISTRATIVE_CORRECTION",
]);
