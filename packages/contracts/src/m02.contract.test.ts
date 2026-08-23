import { describe, expect, it } from "vitest";

import {
  AnalysisOperationSchema,
  AnalysisRunStatusSchema,
  ClassificationRunSourceSchema,
  ExternalIdentifierProvenanceSchema,
  ExternalIdentifierReviewStateSchema,
  ExternalIdentifierTypeSchema,
  IdentityRelationshipStatusSchema,
  M02ErrorCodeSchema,
  M02JobReplacementReasonSchema,
  M02OperationScopeSchema,
  M02ReviewStateSchema,
  ManualResolutionCommandSchema,
  RepositoryCandidateStatusSchema,
  SupersessionStateSchema,
} from "./index.js";

describe("M02 contract discovery", () => {
  it("exports the exact closed M02 state vocabularies", () => {
    expect(AnalysisOperationSchema.options).toEqual(["CLASSIFY_REPOSITORY"]);
    expect(AnalysisRunStatusSchema.options).toEqual([
      "SUCCEEDED",
      "INVALID_OUTPUT",
      "LIMIT_EXCEEDED",
      "TIMED_OUT",
      "FAILED",
    ]);
    expect(ClassificationRunSourceSchema.options).toEqual([
      "DETERMINISTIC",
      "AI_ASSISTED",
      "RECONCILED",
      "HUMAN_OVERRIDE",
    ]);
    expect(RepositoryCandidateStatusSchema.options).toEqual([
      "CLASSIFIED",
      "IDENTITY_REVIEW_REQUIRED",
      "IDENTITY_RESOLVED",
      "REJECTED",
      "SUPERSEDED",
    ]);
    expect(M02ReviewStateSchema.options).toEqual([
      "NOT_REQUIRED",
      "CLASSIFICATION_REVIEW_REQUIRED",
      "IDENTITY_REVIEW_REQUIRED",
      "CLARIFICATION_REQUESTED",
      "RESOLVED",
      "REJECTED",
    ]);
    expect(M02OperationScopeSchema.options).toEqual([
      "CLASSIFICATION",
      "IDENTITY_RESOLUTION",
      "FULL_PIPELINE",
    ]);
    expect(SupersessionStateSchema.options).toEqual(["CONTROLLING", "SUPERSEDED"]);
    expect(ExternalIdentifierTypeSchema.options).toEqual([
      "PROVIDER_REPOSITORY_ID",
      "DECLARED_MANIFEST_ID",
    ]);
    expect(ExternalIdentifierProvenanceSchema.options).toEqual([
      "M01_PROVIDER_ASSERTED",
      "HUMAN_VERIFIED_SOURCE_DECLARATION",
    ]);
    expect(ExternalIdentifierReviewStateSchema.options).toEqual([
      "UNREVIEWED",
      "VERIFIED",
      "REJECTED",
      "SUPERSEDED",
    ]);
    expect(IdentityRelationshipStatusSchema.options).toEqual(["ACTIVE", "REJECTED", "SUPERSEDED"]);
    expect(M02JobReplacementReasonSchema.options).toEqual([
      "FAILED_STAGE_REPLACEMENT",
      "RETRY_EXHAUSTED",
      "NEW_SUPPORTED_SNAPSHOT",
      "POLICY_OR_METHODOLOGY_CHANGE",
      "ADMINISTRATIVE_CORRECTION",
    ]);
  });

  it("keeps exact command names and error codes fail closed", () => {
    expect(ManualResolutionCommandSchema.options).toEqual([
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
    expect(M02ErrorCodeSchema.options).toEqual([
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
    expect(() => M02ErrorCodeSchema.parse("SILENT_RETRY")).toThrow();
    expect(() => ManualResolutionCommandSchema.parse("OVERRIDE_UNSUPPORTED")).toThrow();
  });
});
