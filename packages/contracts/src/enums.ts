import { z } from "zod";

export const RepositoryClassifications = [
  "SINGLE_SKILL",
  "MULTIPLE_SKILLS",
  "SKILL_COLLECTION",
  "SKILL_PLUS_APPLICATION",
  "NON_SKILL",
  "AMBIGUOUS",
  "UNSUPPORTED",
] as const;
export const RepositoryClassificationSchema = z.enum(RepositoryClassifications);
export type RepositoryClassification = z.infer<typeof RepositoryClassificationSchema>;

export const IdentityOutcomes = [
  "NEW_RESOURCE",
  "EXISTING_RESOURCE_NEW_VERSION",
  "POSSIBLE_DUPLICATE",
  "FORK_OF_EXISTING_RESOURCE",
  "MIRROR",
  "AMBIGUOUS_IDENTITY",
] as const;
export const IdentityOutcomeSchema = z.enum(IdentityOutcomes);
export type IdentityOutcome = z.infer<typeof IdentityOutcomeSchema>;

export const ClaimClasses = [
  "SOURCE_FACT",
  "REPOSITORY_METADATA",
  "AI_INFERENCE",
  "EDITORIAL_INTERPRETATION",
  "TEST_RESULT",
  "CREATOR_DECLARATION",
] as const;
export const ClaimClassSchema = z.enum(ClaimClasses);
export type ClaimClass = z.infer<typeof ClaimClassSchema>;

export const ClaimSupportStatuses = [
  "SUPPORTED",
  "SUPPORTED_WITH_QUALIFIER",
  "REFUTED",
  "UNSUPPORTED",
  "AMBIGUOUS",
  "REVIEW_REQUIRED",
] as const;
export const ClaimSupportStatusSchema = z.enum(ClaimSupportStatuses);
export type ClaimSupportStatus = z.infer<typeof ClaimSupportStatusSchema>;

export const ExtractionStatuses = [
  "EXPLICIT",
  "STRONGLY_SUPPORTED",
  "INFERRED",
  "CONFLICTING",
  "MISSING",
  "UNSUPPORTED",
  "REVIEW_REQUIRED",
] as const;
export const ExtractionStatusSchema = z.enum(ExtractionStatuses);
export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

export const EvidenceTypes = [
  "SOURCE_TEXT",
  "MANIFEST_FIELD",
  "REPOSITORY_METADATA",
  "RELEASE_METADATA",
  "FILE_STRUCTURE",
  "SOURCE_CODE_OBSERVATION",
  "EDITOR_NOTE",
  "TEST_RESULT",
  "CREATOR_DECLARATION",
] as const;
export const EvidenceTypeSchema = z.enum(EvidenceTypes);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceVisibilities = [
  "INTERNAL",
  "PUBLIC_ELIGIBLE",
  "RESTRICTED",
  "REDACTED",
] as const;
export const EvidenceVisibilitySchema = z.enum(EvidenceVisibilities);
export type EvidenceVisibility = z.infer<typeof EvidenceVisibilitySchema>;

export const EditorialDecisions = [
  "ACCEPT",
  "EDIT",
  "REJECT",
  "MARK_UNSUPPORTED",
  "REQUEST_EVIDENCE",
  "REQUEST_CREATOR_CLARIFICATION",
  "HIDE",
] as const;
export const EditorialDecisionSchema = z.enum(EditorialDecisions);
export type EditorialDecision = z.infer<typeof EditorialDecisionSchema>;

export const ReviewBlockerCodes = [
  "NO_VALID_SKILL",
  "AMBIGUOUS_RESOURCE_IDENTITY",
  "MISSING_SOURCE_REVISION",
  "UNSUPPORTED_MATERIAL_CLAIM",
  "INSTALLATION_WITHOUT_EVIDENCE",
  "UNRESOLVED_LICENSE_CONFLICT",
  "DUPLICATE_UNRESOLVED",
  "SEVERE_SOURCE_SAFETY_FINDING",
  "SCHEMA_INVALID",
] as const;
export const ReviewBlockerCodeSchema = z.enum(ReviewBlockerCodes);
export type ReviewBlockerCode = z.infer<typeof ReviewBlockerCodeSchema>;

export const PublicationStatuses = [
  "INTERNAL_APPROVED",
  "INTERNAL_HIDDEN",
  "SUPERSEDED",
  "REVOKED",
] as const;
export const PublicationStatusSchema = z.enum(PublicationStatuses);
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;

export const IngestionStages = [
  "RECEIVED",
  "VALIDATING_SOURCE",
  "ACQUIRING_SOURCE",
  "INVENTORYING_SOURCE",
  "CLASSIFYING_REPOSITORY",
  "RESOLVING_IDENTITY",
  "EXTRACTING_FACTS",
  "BINDING_EVIDENCE",
  "GENERATING_DRAFT",
  "AWAITING_EDITORIAL_REVIEW",
  "IN_EDITORIAL_REVIEW",
  "REMEDIATION_REQUIRED",
  "APPROVED_INTERNAL",
  "REJECTED",
] as const;
export const IngestionStageSchema = z.enum(IngestionStages);
export type IngestionStage = z.infer<typeof IngestionStageSchema>;

export const IngestionTerminalStatuses = [
  "FAILED_VALIDATION",
  "FAILED_ACQUISITION",
  "FAILED_CLASSIFICATION",
  "FAILED_IDENTITY",
  "FAILED_EXTRACTION",
  "FAILED_AI_RESPONSE",
  "FAILED_EVIDENCE_GATE",
  "CANCELLED",
  "SUPERSEDED",
  "OPERATOR_REVIEW_REQUIRED",
] as const;
export const IngestionTerminalStatusSchema = z.enum(IngestionTerminalStatuses);
export type IngestionTerminalStatus = z.infer<typeof IngestionTerminalStatusSchema>;

export const MaintenanceLabels = [
  "ACTIVE",
  "RECENT",
  "SLOW",
  "INACTIVE",
  "ARCHIVED",
  "UNKNOWN",
] as const;
export const MaintenanceLabelSchema = z.enum(MaintenanceLabels);
export type MaintenanceLabel = z.infer<typeof MaintenanceLabelSchema>;

export const LicenseStatuses = [
  "CONFIRMED",
  "CONFLICTING",
  "MISSING",
  "CUSTOM",
  "AMBIGUOUS",
  "REVIEW_REQUIRED",
] as const;
export const LicenseStatusSchema = z.enum(LicenseStatuses);
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export const CompatibilityEvidenceClasses = [
  "AI_ARK_TEST",
  "SOURCE_DECLARATION",
  "CREATOR_DECLARATION",
  "COMMUNITY_REPORT",
  "FORMAT_INFERENCE",
  "UNKNOWN",
] as const;
export const CompatibilityEvidenceClassSchema = z.enum(CompatibilityEvidenceClasses);
export type CompatibilityEvidenceClass = z.infer<typeof CompatibilityEvidenceClassSchema>;

export const Roles = [
  "ADMIN",
  "EDITOR",
  "TECHNICAL_REVIEWER",
  "VALIDATION_RESEARCHER",
  "VIEWER",
] as const;
export const RoleSchema = z.enum(Roles);
export type Role = z.infer<typeof RoleSchema>;

export const AuditEventTypes = [
  "SOURCE_SUBMITTED",
  "JOB_RETRIED",
  "IDENTITY_RESOLVED",
  "FIELD_ACCEPTED",
  "FIELD_EDITED",
  "FIELD_REJECTED",
  "BLOCKER_CREATED",
  "BLOCKER_OVERRIDDEN",
  "PUBLICATION_APPROVED",
  "PUBLICATION_REJECTED",
  "PUBLICATION_REVOKED",
  "ROLE_CHANGED",
  "EVIDENCE_ACCESSED",
] as const;
export const AuditEventTypeSchema = z.enum(AuditEventTypes);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;
