import { z } from "zod";

export const M03_FIELD_KEYS = [
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

export const M03_WARNING_CODES = [
  "SOURCE_CORPUS_INCOMPLETE",
  "SOURCE_DISPOSITION_EXCLUDED",
  "PREDECESSOR_METADATA_INSUFFICIENT",
  "ATTRIBUTION_TYPE_UNPROVEN",
  "MULTIPLE_EXPLICIT_VALUES",
  "NORMALIZATION_LOSS",
  "TAXONOMY_CANDIDATE",
  "DEPENDENCY_INCOMPLETE",
  "TRANSITIVE_DEPENDENCY_NOT_RESOLVED",
  "UNRECOGNIZED_MANIFEST",
  "DETERMINISTIC_DECLARATION_INVALID",
  "UNSUPPORTED_LICENSE_IDENTIFIER",
  "UNSUPPORTED_STATIC_LANGUAGE",
  "PERMISSION_NOT_PROVEN_ABSENT",
  "COMPATIBILITY_NOT_RUNTIME_VERIFIED",
  "INSTALL_COMMAND_UNSAFE",
  "INSTALL_CONTEXT_INCOMPLETE",
  "INSTALL_PATH_KINDS_MIXED",
  "SECRET_LIKE_COMMAND_WITHHELD",
  "SECRET_LIKE_VALUE_WITHHELD",
  "CONFIGURATION_TYPE_UNKNOWN",
  "SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD",
  "PERSONAL_CONTACT_WITHHELD",
  "AI_INPUT_BOUNDED",
  "AI_OUTPUT_REPAIRED",
  "AI_OUTPUT_REJECTED",
  "LOW_CONFIDENCE",
  "ARCHIVED_SOURCE",
  "NO_KNOWN_LIMITATION_NOT_PROVEN",
] as const;

export const M03_ANALYSIS_SUB_OPERATIONS = [
  "NORMALIZE_CAPABILITIES",
  "MAP_TASKS",
  "SYNTHESIZE_OUTCOME",
  "PROPOSE_USE_CASES",
  "PROPOSE_TARGET_USERS",
  "SYNTHESIZE_BEST_FOR_NOT_IDEAL",
  "SYNTHESIZE_LIMITATIONS",
  "INFER_PERMISSIONS_FROM_STATIC_EVIDENCE",
  "DETECT_AMBIGUITY",
] as const;

export const M03_POLICY_VERSIONS = Object.freeze({
  extractionPolicyVersion: "m03-extraction-policy-v1",
  fieldRegistryVersion: "m03-field-registry-v1",
  taxonomyMappingVersion: "m03-taxonomy-mapping-v1",
  taxonomyRegistryVersion: "m03-taxonomy-registry-empty-v1",
  taxonomyRegistryFingerprint: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  permissionPolicyVersion: "m03-permission-policy-v1",
  compatibilityPolicyVersion: "m03-compatibility-policy-v1",
  deterministicParserBundleVersion: "m03-parsers-v1",
  extractorRegistryFingerprint: "256f4d2b4a7dd74c647543d632bd28fc457f3f81e9fa446dfe730c015e35355a",
  normalizationProfileVersion: "m03-normalization-unicode-15.1-v1",
  policyArtifactFingerprint: "48efb226368bf9ed5cdae77ca629c2cab93dbd08250b6a12d88a2a4e08ecaaa9",
  analysisBundleVersion: "m03-analysis-bundle-v1",
  promptBundleVersion: "m03-prompt-bundle-v1",
  outputContractVersion: "m03-analysis-output-v1",
  rawAnalysisSchemaVersion: "m03-analysis-raw-v1",
  methodologyVersion: "m03-methodology-v1",
});

export const M03_EXTRACTOR_REGISTRY_FINGERPRINTS = Object.freeze({
  DISABLED: M03_POLICY_VERSIONS.extractorRegistryFingerprint,
  ENABLED: "73b4655707c860c20439b7d9ac6ab623a5f4140c89b84b25279d0a565655d466",
});

const strictObject = z.strictObject;
const nonemptyId = z.string().min(1);
const lowercaseSha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const gitRevision = z.string().regex(/^[a-f0-9]{40}$/u);

export const PositiveBigIntSchema = z.string().regex(/^[1-9][0-9]*$/u);
export const M03FieldKeySchema = z.enum(M03_FIELD_KEYS);
export const M03WarningCodeSchema = z.enum(M03_WARNING_CODES);
export const M03AnalysisSubOperationSchema = z.enum(M03_ANALYSIS_SUB_OPERATIONS);

export const ExpectedPredecessorStateV1Schema = strictObject({
  mutableRecordVersions: strictObject({
    acquisitionJob: PositiveBigIntSchema,
    controllingM02Job: PositiveBigIntSchema,
    handoffMarker: PositiveBigIntSchema,
    candidate: PositiveBigIntSchema,
    resourceIdentity: PositiveBigIntSchema,
    resourceVersionIdentity: PositiveBigIntSchema,
    resourceSourceLink: PositiveBigIntSchema,
    sourceRepositoryIdentity: PositiveBigIntSchema,
    identityDecision: PositiveBigIntSchema,
    candidateReviewState: PositiveBigIntSchema,
    candidateRoot: PositiveBigIntSchema,
  }),
  fingerprintExpectations: strictObject({
    sourceSnapshot: lowercaseSha256,
    acquisitionResult: lowercaseSha256,
    resourceVersionObservation: lowercaseSha256,
    ownershipTopology: lowercaseSha256,
    reviewStateSet: lowercaseSha256,
    providerMetadata: lowercaseSha256,
  }),
});

const disabledAnalysisConfiguration = strictObject({
  mode: z.literal("DISABLED"),
  operation: z.literal("NORMALIZE_STRUCTURED_EXTRACTION"),
  providerAdapterNameOrNull: z.null(),
  providerAdapterVersionOrNull: z.null(),
  providerNameOrNull: z.null(),
  modelNameOrNull: z.null(),
  deterministicSettings: strictObject({}),
  subOperationPlan: z.tuple([]),
});

const enabledAnalysisConfiguration = strictObject({
  mode: z.literal("ENABLED"),
  operation: z.literal("NORMALIZE_STRUCTURED_EXTRACTION"),
  providerAdapterNameOrNull: z.literal("deterministic-fake"),
  providerAdapterVersionOrNull: z.literal("1.0.0"),
  providerNameOrNull: z.literal("offline-fake"),
  modelNameOrNull: z.literal("m03-fixture-v1"),
  deterministicSettings: strictObject({
    temperature: z.literal(0),
    topP: z.literal(1),
    seedOrNull: z.literal(0),
    maxOutputTokens: z.number().int().min(1).max(16_384),
    responseFormat: z.literal("JSON_SCHEMA"),
    toolChoice: z.literal("NONE"),
  }),
  subOperationPlan: z.tuple(
    M03_ANALYSIS_SUB_OPERATIONS.map((value) => z.literal(value)) as [
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[0]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[1]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[2]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[3]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[4]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[5]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[6]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[7]>,
      z.ZodLiteral<(typeof M03_ANALYSIS_SUB_OPERATIONS)[8]>,
    ],
  ),
});

export const AnalysisConfigurationV1Schema = z.discriminatedUnion("mode", [
  disabledAnalysisConfiguration,
  enabledAnalysisConfiguration,
]);

const PolicyVersionsV1Schema = strictObject({
  extractionPolicyVersion: z.literal(M03_POLICY_VERSIONS.extractionPolicyVersion),
  fieldRegistryVersion: z.literal(M03_POLICY_VERSIONS.fieldRegistryVersion),
  taxonomyMappingVersion: z.literal(M03_POLICY_VERSIONS.taxonomyMappingVersion),
  taxonomyRegistryVersion: z.literal(M03_POLICY_VERSIONS.taxonomyRegistryVersion),
  taxonomyRegistryFingerprint: z.literal(M03_POLICY_VERSIONS.taxonomyRegistryFingerprint),
  permissionPolicyVersion: z.literal(M03_POLICY_VERSIONS.permissionPolicyVersion),
  compatibilityPolicyVersion: z.literal(M03_POLICY_VERSIONS.compatibilityPolicyVersion),
  deterministicParserBundleVersion: z.literal(M03_POLICY_VERSIONS.deterministicParserBundleVersion),
  extractorRegistryFingerprint: lowercaseSha256,
  normalizationProfileVersion: z.literal(M03_POLICY_VERSIONS.normalizationProfileVersion),
  policyArtifactFingerprint: z.literal(M03_POLICY_VERSIONS.policyArtifactFingerprint),
  analysisBundleVersion: z.literal(M03_POLICY_VERSIONS.analysisBundleVersion),
  promptBundleVersion: z.literal(M03_POLICY_VERSIONS.promptBundleVersion),
  outputContractVersion: z.literal(M03_POLICY_VERSIONS.outputContractVersion),
  rawAnalysisSchemaVersion: z.literal(M03_POLICY_VERSIONS.rawAnalysisSchemaVersion),
  methodologyVersion: z.literal(M03_POLICY_VERSIONS.methodologyVersion),
});

export const ExtractionRequestV1Schema = strictObject({
  schemaVersion: z.literal("M03_EXTRACTION_V1"),
  requestId: nonemptyId,
  idempotencyKey: nonemptyId,
  m02HandoffMarkerId: nonemptyId,
  controllingM02JobId: nonemptyId,
  identityDecisionId: nonemptyId,
  m02ReviewStateId: nonemptyId,
  resourceCandidateId: nonemptyId,
  resourceIdentityId: nonemptyId,
  resourceVersionIdentityId: nonemptyId,
  resourceVersionObservationId: nonemptyId,
  resourceSourceLinkId: nonemptyId,
  sourceRepositoryId: nonemptyId,
  sourceSnapshotId: nonemptyId,
  sourceRevision: gitRevision,
  candidateRootId: nonemptyId,
  candidateRootFingerprint: lowercaseSha256,
  candidateContentFingerprint: lowercaseSha256,
  expectedPredecessorState: ExpectedPredecessorStateV1Schema,
  policyVersions: PolicyVersionsV1Schema,
  analysisConfiguration: AnalysisConfigurationV1Schema,
  analysisConfigurationFingerprint: lowercaseSha256,
});

export const BasicExtractionRequestV1Schema = ExtractionRequestV1Schema.extend({
  expectedPredecessorState: z.unknown(),
});

export type M03FieldKey = (typeof M03_FIELD_KEYS)[number];
export type M03WarningCode = (typeof M03_WARNING_CODES)[number];
export type M03AnalysisSubOperation = (typeof M03_ANALYSIS_SUB_OPERATIONS)[number];
export type ExpectedPredecessorStateV1 = z.infer<typeof ExpectedPredecessorStateV1Schema>;
export type AnalysisConfigurationV1 = z.infer<typeof AnalysisConfigurationV1Schema>;
export type ExtractionRequestV1 = z.infer<typeof ExtractionRequestV1Schema>;
export type BasicExtractionRequestV1 = z.infer<typeof BasicExtractionRequestV1Schema>;

export interface M03AnalysisExecutionInputV1 {
  readonly extractionInputFingerprint: string;
  readonly analysisConfigurationFingerprint: string;
  readonly fieldRegistryVersion: string;
  readonly rawAnalysisSchemaVersion: string;
  readonly analysisBundleVersion: string;
  readonly subOperationPlan: readonly M03AnalysisSubOperation[];
  readonly extractorRefId: string;
  readonly deterministicCandidates: readonly {
    readonly id: string;
    readonly fieldKey: M03FieldKey;
    readonly value: unknown;
    readonly normalizedKey: string;
    readonly extractorRefId: string;
    readonly supportNature: "EXACT" | "INFERENTIAL";
    readonly claimClass:
      "SOURCE_FACT" | "REPOSITORY_METADATA" | "STATIC_CODE_INDICATOR" | "FORMAT_INFERENCE";
    readonly sourceType: string;
    readonly sourceReferenceIds: readonly string[];
    readonly confidence: number;
    readonly warningCodes: readonly M03WarningCode[];
    readonly candidateFingerprint: string;
  }[];
  readonly deterministicConflicts: readonly {
    readonly id: string;
    readonly fieldKey: M03FieldKey;
    readonly reasonCode:
      | "SAME_TIER_DISTINCT_VALUES"
      | "CROSS_TIER_DISTINCT_VALUES"
      | "LICENSE_METADATA_TEXT_DISAGREE"
      | "INSTALLATION_PATHS_DIVERGE"
      | "COMPATIBILITY_ASSERTIONS_DIVERGE"
      | "PERMISSION_ASSERTIONS_DIVERGE"
      | "TAXONOMY_MAPPING_AMBIGUOUS"
      | "AI_DETERMINISTIC_DISAGREEMENT"
      | "AI_MULTIPLE_INTERPRETATIONS";
    readonly candidateIds: readonly string[];
    readonly aiProposalIds: readonly string[];
    readonly preferredCandidateIdOrNull: null;
    readonly preferenceIsNonCanonicalGuidance: false;
    readonly sourceReferenceIds: readonly string[];
  }[];
  readonly sourceReferences: readonly {
    readonly id: string;
    readonly excerptHashOrNull: string | null;
    readonly excerptOrNull: string | null;
    readonly sensitive: boolean;
    readonly ownership: "CANDIDATE_OWNED" | "SHARED";
    readonly normalizedPath: string;
    readonly locatorCanonicalBytes: string;
    readonly candidateIndependentFor?: readonly M03AnalysisSubOperation[];
  }[];
  readonly authorizeInvocation: (
    ordinal: number,
    purpose: "PRIMARY" | "SYNTACTIC_REPAIR",
  ) => Promise<"PROCEED" | "CANCELLED" | "SUPERSEDED_INPUT">;
  readonly fingerprintRawOutput?: (bytes: Uint8Array) => string;
  readonly fingerprintAnalysisInput?: (canonicalBytes: string) => string;
  readonly deriveInvocationId?: (canonicalBytes: string) => string;
}

interface M03AnalysisAttemptBaseV1 {
  readonly invocationId: string;
  readonly id: string;
  readonly analysisConfigurationFingerprint: string;
  readonly extractionInputFingerprint: string;
  readonly analysisInputFingerprint: string;
  readonly providerRequestIdOrNull: string | null;
  readonly tokenCountsOrNull: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  } | null;
  readonly durationMsOrNull: number | null;
  readonly ordinal: 0 | 1;
  readonly purpose: "PRIMARY" | "SYNTACTIC_REPAIR";
}

export type M03AnalysisAttemptV1 = M03AnalysisAttemptBaseV1 &
  (
    | {
        readonly status: "SUCCEEDED";
        readonly outputFingerprintOrNull: string;
        readonly safeErrorCodeOrNull: null;
      }
    | {
        readonly status: "INVALID_OUTPUT";
        readonly outputFingerprintOrNull: string;
        readonly safeErrorCodeOrNull: "ANALYSIS_OUTPUT_INVALID";
        readonly invalidityClass: "SYNTACTIC_OR_SCHEMA_SHAPE" | "SEMANTIC_OR_POLICY";
      }
    | {
        readonly status: "LIMIT_EXCEEDED";
        readonly outputFingerprintOrNull: string;
        readonly safeErrorCodeOrNull: "ANALYSIS_LIMIT_EXCEEDED";
        readonly invalidityClass: "LIMIT";
      }
    | {
        readonly status: "TIMED_OUT";
        readonly outputFingerprintOrNull: null;
        readonly safeErrorCodeOrNull: "ANALYSIS_TIMED_OUT";
      }
    | {
        readonly status: "FAILED";
        readonly outputFingerprintOrNull: null;
        readonly safeErrorCodeOrNull: "ANALYSIS_FAILED";
      }
  );

export interface M03AnalysisExecutionResultV1 {
  readonly attempts: readonly M03AnalysisAttemptV1[];
  readonly proposals: readonly Readonly<Record<string, unknown>>[];
  readonly warningCodes: readonly M03WarningCode[];
  readonly unrecoveredError: boolean;
  readonly controlTerminationOrNull: "CANCELLED" | "SUPERSEDED_INPUT" | null;
  readonly observedInputExcerpts: number;
  readonly observedInputCharacters: number;
}

export interface M03StructuredAnalysisPortV1 {
  analyze(input: M03AnalysisExecutionInputV1): Promise<M03AnalysisExecutionResultV1>;
}
