import { createHash } from "node:crypto";

import { z } from "zod";

import {
  AnalysisConfigurationV1Schema,
  ExpectedPredecessorStateV1Schema,
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_EXTRACTOR_REGISTRY_FINGERPRINTS,
  M03_FIELD_KEYS,
  M03_POLICY_VERSIONS,
  M03_WARNING_CODES,
  M03FieldKeySchema,
  M03WarningCodeSchema,
} from "./m03.js";
import {
  ExtractionFieldResultV1Schema,
  ExtractionSourceReferenceV1Schema,
  ExtractionValueSchemaByFieldV1,
  LimitationProposalValueV1Schema,
  MaintenanceSignalCandidateV1Schema,
  PermissionValueV1Schema,
  SemanticProposalV1Schema,
  validateCompleteM03FieldSet,
} from "./m03-values.js";
import {
  canonicalizeSpdx,
  canonicalJsonM03 as canonicalJson,
  compareUnsignedUtf8,
  textKey,
} from "./m03-normalization.js";

const strictObject = z.strictObject;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const contentId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-f0-9]{64}$`, "u"));
const sourceReferenceId = contentId("src_");
const extractorRefId = contentId("xtr_");
const candidateId = contentId("cand_");
const proposalId = contentId("aip_");
const conflictId = contentId("conf_");
const analysisAttemptId = contentId("ana_");
const analysisInvocationId = contentId("ain_");
const unique = <T extends z.ZodType>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine(
      (values) => new Set(values.map((value) => JSON.stringify(value))).size === values.length,
    );

function withoutSourceReferenceIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSourceReferenceIds);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([key]) => key !== "sourceReferenceIds")
      .map(([key, nested]) => [key, withoutSourceReferenceIds(nested)]),
  );
}

function structKey(value: unknown): string {
  return `struct:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function expectedCandidateNormalizedKey(value: {
  readonly fieldKey: (typeof M03_FIELD_KEYS)[number];
  readonly value: unknown;
}): string | null {
  const candidateValue = value.value as Readonly<Record<string, unknown>>;
  const stringValue = (member: unknown): string => (typeof member === "string" ? member : "");
  switch (value.fieldKey) {
    case "canonical_skill_name":
      return `name:${stringValue(candidateValue.normalizedName)}`;
    case "creator_candidates":
    case "organization_candidates":
      return `attribution:${stringValue(candidateValue.kind)}:${stringValue(candidateValue.normalizedHandleOrNull) || textKey(stringValue(candidateValue.displayName))}`;
    case "version":
      return `version:${stringValue(candidateValue.normalizedVersionOrNull) || textKey(stringValue(candidateValue.versionLabel))}`;
    case "source_revision":
      return `revision:${stringValue(candidateValue.immutableRevision)}`;
    case "license": {
      const spdx = candidateValue.spdxExpressionOrNull;
      return `license:${spdx === null ? stringValue(candidateValue.customTextHashOrNull) : (canonicalizeSpdx(stringValue(spdx)) ?? "")}`;
    }
    case "categories":
      return `taxonomy:${String(candidateValue.taxonomyIdOrNull ?? candidateValue.normalizedLabel)}`;
    case "outcome_candidate":
    case "capabilities":
    case "tasks":
    case "use_cases":
    case "target_user_candidates":
      return `semantic:${String(candidateValue.proposalKind)}:${String(candidateValue.normalizedKey)}`;
    case "installation":
      return structKey(withoutSourceReferenceIds(candidateValue));
    case "configuration":
      return `configuration:${String(candidateValue.normalizedName)}`;
    case "dependencies":
      return structKey({
        kind: candidateValue.kind,
        ecosystemOrNull: candidateValue.ecosystemOrNull,
        normalizedName: candidateValue.normalizedName,
        declaredConstraintOrNull: candidateValue.declaredConstraintOrNull,
        scope: candidateValue.scope,
        directness: candidateValue.directness,
      });
    case "external_services":
      return `service:${String(candidateValue.normalizedServiceName)}`;
    case "permissions":
      return structKey({
        kind: candidateValue.kind,
        evidenceLevel: candidateValue.evidenceLevel,
        scopeOrNull: candidateValue.scopeOrNull,
        absenceClaim: candidateValue.absenceClaim,
      });
    case "compatibility":
      return structKey({
        subjectKind: candidateValue.subjectKind,
        normalizedSubject: candidateValue.normalizedSubject,
        constraintOrNull: candidateValue.constraintOrNull,
        evidenceClass: candidateValue.evidenceClass,
        support: candidateValue.support,
      });
    case "limitations":
      return `limitation:${String(candidateValue.kind)}:${String(candidateValue.normalizedKey)}`;
    case "maintenance_signals":
      return structKey(withoutSourceReferenceIds(candidateValue));
  }
}

export const ExtractorRefV1Schema = strictObject({
  id: extractorRefId,
  kind: z.enum(["DETERMINISTIC_PARSER", "AI_ANALYSIS"]),
  name: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    .max(100),
  semanticVersion: z
    .string()
    .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/u)
    .max(50),
  ownedFieldKeys: unique(M03FieldKeySchema, M03_FIELD_KEYS.length).min(1),
  configurationFingerprint: sha256,
  codeBundleFingerprint: sha256,
}).superRefine((value, context) => {
  const ordinals = value.ownedFieldKeys.map((fieldKey) => M03_FIELD_KEYS.indexOf(fieldKey));
  if (ordinals.some((ordinal, index) => index > 0 && ordinal <= (ordinals[index - 1] ?? -1)))
    context.addIssue({ code: "custom", message: "owned fields must be unique registry order" });
});

const candidateClaimClass = z.enum([
  "SOURCE_FACT",
  "REPOSITORY_METADATA",
  "STATIC_CODE_INDICATOR",
  "FORMAT_INFERENCE",
]);

export const ExtractionCandidateV1Schema = strictObject({
  id: candidateId,
  fieldKey: M03FieldKeySchema,
  value: z.unknown(),
  normalizedKey: z.string().min(1).max(2000),
  extractorRefId,
  supportNature: z.enum(["EXACT", "INFERENTIAL"]),
  claimClass: candidateClaimClass,
  sourceType: z.enum([
    "REPOSITORY_METADATA",
    "RELEASE_SIGNAL",
    "SKILL_METADATA",
    "PACKAGE_MANIFEST",
    "LICENSE_METADATA",
    "LICENSE_TEXT",
    "MARKDOWN_TEXT",
    "FENCED_COMMAND",
    "DEPENDENCY_DECLARATION",
    "CONFIGURATION_DECLARATION",
    "STATIC_CODE",
    "CHANGELOG",
    "INVENTORY_ABSENCE",
    "SOURCE_REVISION_FALLBACK",
  ]),
  sourceReferenceIds: unique(sourceReferenceId, 4096).min(1),
  confidence: z.number().min(0).max(1),
  warningCodes: unique(M03WarningCodeSchema, 29),
  candidateFingerprint: sha256,
}).superRefine((value, context) => {
  if (value.normalizedKey !== expectedCandidateNormalizedKey(value)) {
    context.addIssue({ code: "custom", message: "candidate normalizedKey mismatch" });
  }
  const fieldSchema = ExtractionValueSchemaByFieldV1[value.fieldKey];
  const wrapped =
    value.fieldKey === "version"
      ? fieldSchema.safeParse({
          state: "RESOLVED",
          selectedOrNull: value.value,
          preferredCandidateIdOrNull: null,
        })
      : value.fieldKey === "license"
        ? fieldSchema.safeParse({
            state:
              (value.value as { spdxExpressionOrNull?: unknown }).spdxExpressionOrNull === null
                ? "CUSTOM"
                : "CONFIRMED",
            selectedOrNull: value.value,
            preferredCandidateIdOrNull: null,
          })
        : value.fieldKey === "installation"
          ? fieldSchema.safeParse({
              state:
                (value.value as { pathKind?: unknown }).pathKind === "INFERRED_MECHANISM"
                  ? "INFERRED"
                  : "EXPLICIT_COMPLETE",
              paths: [value.value],
            })
          : value.fieldKey === "maintenance_signals"
            ? MaintenanceSignalCandidateV1Schema.safeParse(value.value)
            : value.fieldKey === "canonical_skill_name" ||
                value.fieldKey === "outcome_candidate" ||
                value.fieldKey === "source_revision"
              ? fieldSchema.safeParse(value.value)
              : fieldSchema.safeParse([value.value]);
  if (!wrapped.success)
    context.addIssue({ code: "custom", message: "candidate value does not match field" });
  if (
    (value.fieldKey === "creator_candidates" &&
      (value.value as { kind?: unknown }).kind !== "CREATOR") ||
    (value.fieldKey === "organization_candidates" &&
      (value.value as { kind?: unknown }).kind !== "ORGANIZATION")
  )
    context.addIssue({ code: "custom", message: "attribution candidate kind mismatch" });
  const valueReferenceIds = (value.value as { sourceReferenceIds?: unknown }).sourceReferenceIds;
  if (
    !Array.isArray(valueReferenceIds) ||
    JSON.stringify(valueReferenceIds) !== JSON.stringify(value.sourceReferenceIds)
  )
    context.addIssue({ code: "custom", message: "candidate value reference mismatch" });
  if (
    value.supportNature === "EXACT" &&
    (value.confidence !== 1 || value.claimClass === "FORMAT_INFERENCE")
  )
    context.addIssue({ code: "custom", message: "invalid exact support" });
  if (
    value.supportNature === "INFERENTIAL" &&
    value.claimClass !== "FORMAT_INFERENCE" &&
    value.claimClass !== "STATIC_CODE_INDICATOR"
  )
    context.addIssue({ code: "custom", message: "invalid inferential support" });
});

export const ExtractionConflictV1Schema = strictObject({
  id: conflictId,
  fieldKey: M03FieldKeySchema,
  reasonCode: z.enum([
    "SAME_TIER_DISTINCT_VALUES",
    "CROSS_TIER_DISTINCT_VALUES",
    "LICENSE_METADATA_TEXT_DISAGREE",
    "INSTALLATION_PATHS_DIVERGE",
    "COMPATIBILITY_ASSERTIONS_DIVERGE",
    "PERMISSION_ASSERTIONS_DIVERGE",
    "TAXONOMY_MAPPING_AMBIGUOUS",
    "AI_DETERMINISTIC_DISAGREEMENT",
    "AI_MULTIPLE_INTERPRETATIONS",
  ]),
  candidateIds: unique(candidateId, 8192),
  aiProposalIds: unique(proposalId, 512),
  preferredCandidateIdOrNull: z.null(),
  preferenceIsNonCanonicalGuidance: z.literal(false),
  sourceReferenceIds: unique(sourceReferenceId, 4096).min(1),
}).refine((value) => value.candidateIds.length + value.aiProposalIds.length >= 2);

const finalFieldProposal = strictObject({
  kind: z.literal("FIELD_PROPOSAL"),
  id: proposalId,
  analysisAttemptId,
  extractorRefId,
  subOperation: z.enum(
    M03_ANALYSIS_SUB_OPERATIONS.slice(0, 8) as [
      (typeof M03_ANALYSIS_SUB_OPERATIONS)[0],
      ...(typeof M03_ANALYSIS_SUB_OPERATIONS)[number][],
    ],
  ),
  targetFieldKey: M03FieldKeySchema,
  value: z.union([
    SemanticProposalV1Schema,
    LimitationProposalValueV1Schema,
    PermissionValueV1Schema,
  ]),
  confidence: z.number().min(0).max(1),
  claimClass: z.literal("AI_INFERENCE"),
  sourceReferenceIds: unique(sourceReferenceId, 4096).min(1),
  warningCodes: unique(M03WarningCodeSchema, 29),
  proposalFingerprint: sha256,
});

const ambiguityProposal = strictObject({
  kind: z.literal("AMBIGUITY_SIGNAL"),
  id: proposalId,
  analysisAttemptId,
  extractorRefId,
  subOperation: z.literal("DETECT_AMBIGUITY"),
  targetFieldKey: M03FieldKeySchema,
  reason: z.enum(["LOW_CONFIDENCE", "MULTIPLE_INTERPRETATIONS", "DETERMINISTIC_AI_DISAGREEMENT"]),
  candidateIds: unique(candidateId, 8192),
  interpretedAIProposalIds: unique(proposalId, 512),
  confidence: z.literal(1),
  sourceReferenceIds: unique(sourceReferenceId, 4096).min(1),
  warningCodes: z.tuple([]),
  proposalFingerprint: sha256,
});

export const AIProposalV1Schema = z
  .discriminatedUnion("kind", [finalFieldProposal, ambiguityProposal])
  .superRefine((value, context) => {
    if (value.kind !== "FIELD_PROPOSAL") return;
    if (
      JSON.stringify(value.sourceReferenceIds) !==
      JSON.stringify([...value.sourceReferenceIds].sort(compareUnsignedUtf8))
    )
      context.addIssue({ code: "custom", message: "proposal references not canonical" });
    if (JSON.stringify(value.value.sourceReferenceIds) !== JSON.stringify(value.sourceReferenceIds))
      context.addIssue({ code: "custom", message: "proposal value reference mismatch" });
    const semantic = "proposalKind" in value.value ? value.value : null;
    const expectedWarnings = [
      ...(semantic?.taxonomyBinding.mappingState === "TAXONOMY_CANDIDATE"
        ? (["TAXONOMY_CANDIDATE"] as const)
        : []),
      ...(value.confidence < 0.6 ? (["LOW_CONFIDENCE"] as const) : []),
    ];
    if (JSON.stringify(value.warningCodes) !== JSON.stringify(expectedWarnings))
      context.addIssue({ code: "custom", message: "proposal warning ownership mismatch" });
    const validMapping = (() => {
      switch (value.subOperation) {
        case "NORMALIZE_CAPABILITIES":
          return (
            value.targetFieldKey === "capabilities" &&
            semantic?.proposalKind === "CAPABILITY" &&
            semantic.targetFieldKey === "capabilities"
          );
        case "MAP_TASKS":
          return (
            value.targetFieldKey === "tasks" &&
            semantic?.proposalKind === "TASK" &&
            semantic.targetFieldKey === "tasks"
          );
        case "SYNTHESIZE_OUTCOME":
          return (
            value.targetFieldKey === "outcome_candidate" &&
            semantic?.proposalKind === "OUTCOME" &&
            semantic.targetFieldKey === "outcome_candidate"
          );
        case "PROPOSE_USE_CASES":
          return (
            value.targetFieldKey === "use_cases" &&
            semantic?.proposalKind === "USE_CASE" &&
            semantic.targetFieldKey === "use_cases"
          );
        case "PROPOSE_TARGET_USERS":
          return (
            value.targetFieldKey === "target_user_candidates" &&
            semantic?.proposalKind === "TARGET_USER" &&
            semantic.targetFieldKey === "target_user_candidates"
          );
        case "SYNTHESIZE_BEST_FOR_NOT_IDEAL":
          return (
            value.targetFieldKey === "target_user_candidates" &&
            (semantic?.proposalKind === "BEST_FOR" || semantic?.proposalKind === "NOT_IDEAL_FOR") &&
            semantic.targetFieldKey === "target_user_candidates"
          );
        case "SYNTHESIZE_LIMITATIONS":
          return (
            value.targetFieldKey === "limitations" &&
            "kind" in value.value &&
            value.value.kind === "SYNTHESIZED_LIMITATION"
          );
        case "INFER_PERMISSIONS_FROM_STATIC_EVIDENCE":
          return (
            value.targetFieldKey === "permissions" &&
            "evidenceLevel" in value.value &&
            value.value.evidenceLevel === "INFERRED"
          );
        default:
          return false;
      }
    })();
    if (!validMapping)
      context.addIssue({ code: "custom", message: "proposal sub-operation mapping invalid" });
  });

const attemptBase = {
  invocationId: analysisInvocationId,
  id: analysisAttemptId,
  analysisConfigurationFingerprint: sha256,
  extractionInputFingerprint: sha256,
  analysisInputFingerprint: sha256,
  providerRequestIdOrNull: z.string().min(1).max(200).nullable(),
  tokenCountsOrNull: strictObject({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
    .refine((value) => value.total === value.input + value.output)
    .nullable(),
  durationMsOrNull: z.number().int().nonnegative().nullable(),
  ordinal: z.union([z.literal(0), z.literal(1)]),
  purpose: z.enum(["PRIMARY", "SYNTACTIC_REPAIR"]),
};

export const AnalysisAttemptV1Schema = z
  .union([
    strictObject({
      ...attemptBase,
      status: z.literal("SUCCEEDED"),
      outputFingerprintOrNull: sha256,
      safeErrorCodeOrNull: z.null(),
    }),
    strictObject({
      ...attemptBase,
      status: z.literal("INVALID_OUTPUT"),
      outputFingerprintOrNull: sha256,
      safeErrorCodeOrNull: z.literal("ANALYSIS_OUTPUT_INVALID"),
      invalidityClass: z.enum(["SYNTACTIC_OR_SCHEMA_SHAPE", "SEMANTIC_OR_POLICY"]),
    }),
    strictObject({
      ...attemptBase,
      status: z.literal("LIMIT_EXCEEDED"),
      outputFingerprintOrNull: sha256,
      safeErrorCodeOrNull: z.literal("ANALYSIS_LIMIT_EXCEEDED"),
      invalidityClass: z.literal("LIMIT"),
    }),
    strictObject({
      ...attemptBase,
      status: z.literal("TIMED_OUT"),
      outputFingerprintOrNull: z.null(),
      safeErrorCodeOrNull: z.literal("ANALYSIS_TIMED_OUT"),
    }),
    strictObject({
      ...attemptBase,
      status: z.literal("FAILED"),
      outputFingerprintOrNull: z.null(),
      safeErrorCodeOrNull: z.literal("ANALYSIS_FAILED"),
    }),
  ])
  .superRefine((value, context) => {
    if ((value.ordinal === 0) !== (value.purpose === "PRIMARY"))
      context.addIssue({ code: "custom", message: "attempt purpose mismatch" });
  });

const policyVersionsSchema = strictObject({
  extractionPolicyVersion: z.literal(M03_POLICY_VERSIONS.extractionPolicyVersion),
  fieldRegistryVersion: z.literal(M03_POLICY_VERSIONS.fieldRegistryVersion),
  taxonomyMappingVersion: z.literal(M03_POLICY_VERSIONS.taxonomyMappingVersion),
  taxonomyRegistryVersion: z.literal(M03_POLICY_VERSIONS.taxonomyRegistryVersion),
  taxonomyRegistryFingerprint: z.literal(M03_POLICY_VERSIONS.taxonomyRegistryFingerprint),
  permissionPolicyVersion: z.literal(M03_POLICY_VERSIONS.permissionPolicyVersion),
  compatibilityPolicyVersion: z.literal(M03_POLICY_VERSIONS.compatibilityPolicyVersion),
  deterministicParserBundleVersion: z.literal(M03_POLICY_VERSIONS.deterministicParserBundleVersion),
  extractorRegistryFingerprint: z.enum([
    M03_EXTRACTOR_REGISTRY_FINGERPRINTS.DISABLED,
    M03_EXTRACTOR_REGISTRY_FINGERPRINTS.ENABLED,
  ]),
  normalizationProfileVersion: z.literal(M03_POLICY_VERSIONS.normalizationProfileVersion),
  policyArtifactFingerprint: z.literal(M03_POLICY_VERSIONS.policyArtifactFingerprint),
  analysisBundleVersion: z.literal(M03_POLICY_VERSIONS.analysisBundleVersion),
  promptBundleVersion: z.literal(M03_POLICY_VERSIONS.promptBundleVersion),
  outputContractVersion: z.literal(M03_POLICY_VERSIONS.outputContractVersion),
  rawAnalysisSchemaVersion: z.literal(M03_POLICY_VERSIONS.rawAnalysisSchemaVersion),
  methodologyVersion: z.literal(M03_POLICY_VERSIONS.methodologyVersion),
});

export const StructuredExtractionBundleV1Schema = strictObject({
  schemaVersion: z.literal("M03_EXTRACTION_V1"),
  extractionId: contentId("ext_"),
  requestFingerprint: sha256,
  inputFingerprint: sha256,
  outputFingerprint: sha256,
  m02: strictObject({
    handoffMarkerId: z.string().min(1),
    controllingM02JobId: z.string().min(1),
    identityDecisionId: z.string().min(1),
    m02ReviewStateId: z.string().min(1),
    resourceCandidateId: z.string().min(1),
    resourceIdentityId: z.string().min(1),
    resourceVersionIdentityId: z.string().min(1),
    resourceVersionObservationId: z.string().min(1),
    resourceSourceLinkId: z.string().min(1),
    sourceRepositoryId: z.string().min(1),
    candidateRootId: z.string().min(1),
    sourceSnapshotId: z.string().min(1),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    candidateContentFingerprint: sha256,
    firstObservedSourceSnapshotId: z.string().min(1),
    firstObservedSourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  }),
  expectedPredecessorState: ExpectedPredecessorStateV1Schema,
  policyVersions: policyVersionsSchema,
  analysisConfiguration: AnalysisConfigurationV1Schema,
  analysisConfigurationFingerprint: sha256,
  analysisResultFingerprint: sha256,
  sourceInventoryFingerprint: sha256,
  sourceReferences: unique(ExtractionSourceReferenceV1Schema, 4096),
  extractorRefs: unique(ExtractorRefV1Schema, 128).min(1),
  deterministicCandidates: unique(ExtractionCandidateV1Schema, 8192),
  conflicts: unique(ExtractionConflictV1Schema, 1024),
  analysisAttempts: z.array(AnalysisAttemptV1Schema).max(2),
  aiProposals: unique(AIProposalV1Schema, 512),
  fields: z.array(ExtractionFieldResultV1Schema).length(M03_FIELD_KEYS.length),
  aggregateStatus: z.enum([
    "COMPLETED",
    "COMPLETED_WITH_CONFLICTS",
    "COMPLETED_REVIEW_REQUIRED",
    "UNSUPPORTED",
  ]),
  m04Bindability: z.literal("BINDABLE"),
  laterProgressionBlockers: z
    .array(
      strictObject({
        blockerKey: z.union([M03FieldKeySchema, z.literal("ATTRIBUTION_GROUP")]),
        status: z.enum(["MISSING", "CONFLICTING", "UNSUPPORTED", "REVIEW_REQUIRED"]),
      }),
    )
    .max(M03_FIELD_KEYS.length),
  warningCodes: unique(M03WarningCodeSchema, 29),
  createdAt: z.iso.datetime({ offset: true }),
}).superRefine((value, context) => {
  const completeness = validateCompleteM03FieldSet(value.fields);
  if (!completeness.ok) context.addIssue({ code: "custom", message: completeness.errorCode });
  if (
    value.analysisConfiguration.mode === "DISABLED" &&
    (value.analysisAttempts.length > 0 || value.aiProposals.length > 0)
  )
    context.addIssue({ code: "custom", message: "disabled analysis has output" });
  if (
    value.policyVersions.extractorRegistryFingerprint !==
    M03_EXTRACTOR_REGISTRY_FINGERPRINTS[value.analysisConfiguration.mode]
  )
    context.addIssue({ code: "custom", message: "extractor registry mode mismatch" });
  const referenceIds = new Set(value.sourceReferences.map(({ id }) => id));
  const extractorIds = new Set(value.extractorRefs.map(({ id }) => id));
  const candidateById = new Map(
    value.deterministicCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const proposalById = new Map(value.aiProposals.map((proposal) => [proposal.id, proposal]));
  const conflictById = new Map(value.conflicts.map((conflict) => [conflict.id, conflict]));
  const fieldByKey = new Map(value.fields.map((field) => [field.fieldKey, field]));
  const ambiguityFields = new Set<string>();
  const matchedAIConflictIds = new Set<string>();
  const attemptIds = new Set(value.analysisAttempts.map((attempt) => attempt.id));
  const sortedReferenceIds = [...value.sourceReferences]
    .sort((left, right) => compareUnsignedUtf8(left.id, right.id))
    .map(({ id }) => id);
  if (
    JSON.stringify(value.sourceReferences.map(({ id }) => id)) !==
    JSON.stringify(sortedReferenceIds)
  )
    context.addIssue({ code: "custom", message: "source reference order invalid" });
  const sortedExtractorIds = [...value.extractorRefs]
    .sort((left, right) => compareUnsignedUtf8(left.id, right.id))
    .map(({ id }) => id);
  if (
    JSON.stringify(value.extractorRefs.map(({ id }) => id)) !== JSON.stringify(sortedExtractorIds)
  )
    context.addIssue({ code: "custom", message: "extractor order invalid" });
  if (
    JSON.stringify(value.fields.map(({ fieldKey }) => fieldKey)) !== JSON.stringify(M03_FIELD_KEYS)
  )
    context.addIssue({ code: "custom", message: "field registry order invalid" });
  if (value.analysisAttempts.some((attempt, index) => attempt.ordinal !== index))
    context.addIssue({ code: "custom", message: "analysis attempt order invalid" });
  for (const candidate of value.deterministicCandidates) {
    if (
      !extractorIds.has(candidate.extractorRefId) ||
      candidate.sourceReferenceIds.some((id) => !referenceIds.has(id))
    )
      context.addIssue({ code: "custom", message: "candidate registry reference invalid" });
  }
  for (const proposal of value.aiProposals) {
    if (
      !attemptIds.has(proposal.analysisAttemptId) ||
      !extractorIds.has(proposal.extractorRefId) ||
      proposal.sourceReferenceIds.some((id) => !referenceIds.has(id))
    )
      context.addIssue({ code: "custom", message: "proposal registry reference invalid" });
    if (proposal.kind === "AMBIGUITY_SIGNAL") {
      if (ambiguityFields.has(proposal.targetFieldKey))
        context.addIssue({ code: "custom", message: "multiple ambiguity signals for field" });
      ambiguityFields.add(proposal.targetFieldKey);
      const candidates = proposal.candidateIds.map((id) => candidateById.get(id));
      const interpreted = proposal.interpretedAIProposalIds.map((id) => proposalById.get(id));
      const fieldProposals = interpreted.filter(
        (
          candidate,
        ): candidate is Extract<(typeof value.aiProposals)[number], { kind: "FIELD_PROPOSAL" }> =>
          candidate?.kind === "FIELD_PROPOSAL",
      );
      if (
        candidates.some((candidate) => candidate?.fieldKey !== proposal.targetFieldKey) ||
        fieldProposals.length !== interpreted.length ||
        fieldProposals.some(({ targetFieldKey }) => targetFieldKey !== proposal.targetFieldKey)
      )
        context.addIssue({ code: "custom", message: "ambiguity target reference invalid" });
      const distinctValues = new Set(
        fieldProposals.map(({ value: proposalValue }) => canonicalJson(proposalValue)),
      );
      const cardinalityValid =
        (proposal.reason === "LOW_CONFIDENCE" &&
          candidates.length === 0 &&
          fieldProposals.length === 1 &&
          (fieldProposals[0]?.confidence ?? 1) < 0.6) ||
        (proposal.reason === "MULTIPLE_INTERPRETATIONS" &&
          candidates.length === 0 &&
          fieldProposals.length >= 2 &&
          distinctValues.size === fieldProposals.length) ||
        (proposal.reason === "DETERMINISTIC_AI_DISAGREEMENT" &&
          candidates.length >= 1 &&
          fieldProposals.length >= 1 &&
          distinctValues.size === fieldProposals.length);
      if (!cardinalityValid)
        context.addIssue({ code: "custom", message: "ambiguity reason cardinality invalid" });
      const expectedReferences = [
        ...new Set(
          [...candidates, ...fieldProposals].flatMap((target) => target?.sourceReferenceIds ?? []),
        ),
      ].sort(compareUnsignedUtf8);
      if (JSON.stringify(proposal.sourceReferenceIds) !== JSON.stringify(expectedReferences))
        context.addIssue({ code: "custom", message: "ambiguity source reference union invalid" });
      const field = fieldByKey.get(proposal.targetFieldKey);
      const aiConflicts = value.conflicts.filter(
        (conflict) =>
          conflict.fieldKey === proposal.targetFieldKey &&
          (conflict.reasonCode === "AI_MULTIPLE_INTERPRETATIONS" ||
            conflict.reasonCode === "AI_DETERMINISTIC_DISAGREEMENT"),
      );
      if (proposal.reason === "LOW_CONFIDENCE") {
        const deterministicConflictIds =
          field?.conflictIds.filter((id) => {
            const reason = conflictById.get(id)?.reasonCode;
            return (
              reason !== "AI_MULTIPLE_INTERPRETATIONS" && reason !== "AI_DETERMINISTIC_DISAGREEMENT"
            );
          }) ?? [];
        if (
          aiConflicts.length !== 0 ||
          field === undefined ||
          !field.warningCodes.includes("LOW_CONFIDENCE") ||
          field.aiProposalIds.includes(proposal.id) ||
          proposal.interpretedAIProposalIds.some((id) => field.aiProposalIds.includes(id)) ||
          (field.deterministicCandidateIds.length === 0 &&
            deterministicConflictIds.length === 0 &&
            field.status !== "REVIEW_REQUIRED") ||
          ((field.deterministicCandidateIds.length > 0 || deterministicConflictIds.length > 0) &&
            field.status === "REVIEW_REQUIRED")
        )
          context.addIssue({ code: "custom", message: "low-confidence field closure invalid" });
      } else {
        const expectedReason =
          proposal.reason === "MULTIPLE_INTERPRETATIONS"
            ? "AI_MULTIPLE_INTERPRETATIONS"
            : "AI_DETERMINISTIC_DISAGREEMENT";
        const matchingConflicts = aiConflicts.filter(
          (conflict) =>
            conflict.reasonCode === expectedReason &&
            JSON.stringify(conflict.candidateIds) === JSON.stringify(proposal.candidateIds) &&
            JSON.stringify(conflict.aiProposalIds) ===
              JSON.stringify(proposal.interpretedAIProposalIds) &&
            JSON.stringify(conflict.sourceReferenceIds) ===
              JSON.stringify(proposal.sourceReferenceIds),
        );
        const conflict = matchingConflicts[0];
        if (
          aiConflicts.length !== 1 ||
          matchingConflicts.length !== 1 ||
          conflict === undefined ||
          field === undefined
        )
          context.addIssue({ code: "custom", message: "ambiguity conflict closure invalid" });
        else if (
          field.status !== "CONFLICTING" ||
          JSON.stringify(field.deterministicCandidateIds) !==
            JSON.stringify(proposal.candidateIds) ||
          JSON.stringify(field.aiProposalIds) !==
            JSON.stringify(proposal.interpretedAIProposalIds) ||
          JSON.stringify(field.evidenceIds) !== JSON.stringify(proposal.sourceReferenceIds) ||
          JSON.stringify(field.conflictIds) !== JSON.stringify([conflict.id])
        )
          context.addIssue({ code: "custom", message: "ambiguity conflict closure invalid" });
        else matchedAIConflictIds.add(conflict.id);
      }
    }
  }
  for (const conflict of value.conflicts) {
    if (
      (conflict.reasonCode === "AI_MULTIPLE_INTERPRETATIONS" ||
        conflict.reasonCode === "AI_DETERMINISTIC_DISAGREEMENT") &&
      !matchedAIConflictIds.has(conflict.id)
    )
      context.addIssue({ code: "custom", message: "unmatched AI ambiguity conflict" });
  }
  for (const conflict of value.conflicts) {
    if (
      conflict.sourceReferenceIds.some((id) => !referenceIds.has(id)) ||
      conflict.candidateIds.some((id) => !candidateById.has(id)) ||
      conflict.aiProposalIds.some((id) => !proposalById.has(id))
    )
      context.addIssue({ code: "custom", message: "conflict registry reference invalid" });
  }
  for (const field of value.fields) {
    if (
      field.evidenceIds.some((id) => !referenceIds.has(id)) ||
      field.extractorRefs.some((id) => !extractorIds.has(id)) ||
      field.deterministicCandidateIds.some(
        (id) => candidateById.get(id)?.fieldKey !== field.fieldKey,
      ) ||
      field.aiProposalIds.some((id) => proposalById.get(id)?.targetFieldKey !== field.fieldKey) ||
      field.conflictIds.some((id) => conflictById.get(id)?.fieldKey !== field.fieldKey)
    )
      context.addIssue({ code: "custom", message: "field registry reference invalid" });
  }
});

export type StructuredExtractionBundleV1 = z.infer<typeof StructuredExtractionBundleV1Schema>;

const nonnegativeInteger = z.number().int().nonnegative();
const fieldCountMapSchema = z
  .record(M03FieldKeySchema, nonnegativeInteger)
  .refine(
    (value) =>
      Object.keys(value).length === M03_FIELD_KEYS.length &&
      M03_FIELD_KEYS.every((fieldKey) => Object.hasOwn(value, fieldKey)),
    { message: "field count map must contain the exact registry" },
  );

export const ObservedCountsV1Schema = strictObject({
  sourceReferences: nonnegativeInteger,
  extractorReferences: nonnegativeInteger,
  deterministicCandidates: nonnegativeInteger,
  deterministicConflicts: nonnegativeInteger,
  deterministicWarningReferences: nonnegativeInteger,
  deterministicListItemsByField: fieldCountMapSchema,
  exactCommands: nonnegativeInteger,
  aiProposalCharactersMaximum: nonnegativeInteger,
  aiProposals: nonnegativeInteger,
  aiProjectedConflicts: nonnegativeInteger,
  aiProjectedWarningReferences: nonnegativeInteger,
  aiProjectedListItemsByField: fieldCountMapSchema,
  aiCalls: nonnegativeInteger,
  aiInputExcerpts: nonnegativeInteger,
  aiInputCharacters: nonnegativeInteger,
});

export const SafeContextV1Schema = strictObject({
  phase: z.enum([
    "REQUEST_VALIDATION",
    "ELIGIBILITY",
    "INVENTORY",
    "DETERMINISTIC",
    "ANALYSIS",
    "MERGE",
    "FINAL_GUARD",
  ]),
  requestId: z.string().min(1),
  handoffMarkerIdOrNull: z.string().min(1).nullable(),
  resourceCandidateIdOrNull: z.string().min(1).nullable(),
  resourceVersionObservationIdOrNull: z.string().min(1).nullable(),
  fieldKeyOrNull: M03FieldKeySchema.nullable(),
  recordKindOrNull: z
    .enum([
      "ACQUISITION_JOB",
      "M02_JOB",
      "HANDOFF",
      "CANDIDATE",
      "RESOURCE_IDENTITY",
      "RESOURCE_VERSION_IDENTITY",
      "OBSERVATION",
      "SOURCE_LINK",
      "SOURCE_REPOSITORY",
      "IDENTITY_DECISION",
      "REVIEW_STATE",
      "REVIEW_STATE_SET",
      "CANDIDATE_ROOT",
      "SNAPSHOT",
      "ACQUISITION_RESULT",
      "OWNERSHIP_TOPOLOGY",
      "PROVIDER_METADATA",
      "FIELD",
      "LIMIT",
    ])
    .nullable(),
  expectedVersionOrNull: z
    .string()
    .regex(/^[1-9][0-9]*$/u)
    .nullable(),
  actualVersionOrNull: z
    .string()
    .regex(/^[1-9][0-9]*$/u)
    .nullable(),
  expectedFingerprintOrNull: sha256.nullable(),
  actualFingerprintOrNull: sha256.nullable(),
  limitNameOrNull: z
    .enum([
      "SOURCE_REFERENCES",
      "EXTRACTOR_REFERENCES",
      "DETERMINISTIC_CANDIDATES",
      "CONFLICTS",
      "WARNING_REFERENCES",
      "FIELD_RESULTS",
      "LIST_ITEMS",
      "EXACT_COMMANDS",
      "EXACT_COMMAND_CHARACTERS",
      "AI_PROPOSAL_CHARACTERS",
      "AI_PROPOSALS",
      "AI_CALLS",
      "AI_INPUT_EXCERPTS",
      "AI_INPUT_CHARACTERS",
      "VALUE_SCHEMA_BOUND",
    ])
    .nullable(),
  limitOrNull: nonnegativeInteger.nullable(),
  observedOrNull: nonnegativeInteger.nullable(),
});

export const ExtractionDiagnosticV1Schema = strictObject({
  lastCompletedStageOrNull: z
    .enum(["ELIGIBILITY", "INVENTORY", "DETERMINISTIC", "ANALYSIS", "MERGE", "FINAL_GUARD"])
    .nullable(),
  sourceInventoryFingerprintOrNull: sha256.nullable(),
  deterministicCandidateCount: nonnegativeInteger,
  sourceReferenceCount: nonnegativeInteger,
  conflictCount: nonnegativeInteger,
  retainedAnalysisAttempts: z.array(AnalysisAttemptV1Schema).max(2),
  warningCodes: unique(M03WarningCodeSchema, M03_WARNING_CODES.length),
  observedCounts: ObservedCountsV1Schema,
  safeContext: SafeContextV1Schema,
});

export const EligibilityErrorV1Schema = z.enum([
  "M02_HANDOFF_NOT_FOUND",
  "M02_HANDOFF_NOT_ACTIVE",
  "M02_JOB_NOT_CONTROLLING",
  "M02_CANDIDATE_NOT_RESOLVED",
  "M02_REVIEW_ACTIVE",
  "M02_IDENTITY_TUPLE_INVALID",
  "M02_OBSERVATION_NOT_FOUND",
  "M02_OBSERVATION_TUPLE_INVALID",
  "M02_SOURCE_LINK_NOT_ACTIVE",
  "M02_IDENTITY_DECISION_NOT_CONTROLLING",
  "SOURCE_SNAPSHOT_MISMATCH",
  "SOURCE_REVISION_MISMATCH",
  "SOURCE_CORPUS_INVALID",
  "EXPECTED_VERSION_SET_INVALID",
  "STALE_RECORD_VERSION",
  "IDEMPOTENCY_KEY_REUSED",
]);

export const ProcessingErrorV1Schema = z.enum([
  "INPUT_FINGERPRINT_COLLISION",
  "CONTENT_DERIVED_ID_COLLISION",
  "SOURCE_REFERENCE_INVALID",
  "FIELD_SCHEMA_INVALID",
  "FIELD_REGISTRY_INCOMPLETE",
  "DETERMINISTIC_PARSER_FAILED",
  "DETERMINISTIC_LIMIT_EXCEEDED",
  "ANALYSIS_CALL_PLAN_INVALID",
]);

const invalidRequestResult = strictObject({
  kind: z.literal("INVALID_REQUEST"),
  rawRequestDigest: sha256,
  errorCode: z.literal("REQUEST_SCHEMA_INVALID"),
  safeContext: strictObject({ phase: z.literal("REQUEST_VALIDATION") }),
});
const rejectedResult = strictObject({
  kind: z.literal("REJECTED"),
  requestFingerprint: sha256,
  errorCode: EligibilityErrorV1Schema,
  safeContext: SafeContextV1Schema,
});
const failedResult = strictObject({
  kind: z.literal("FAILED"),
  requestFingerprint: sha256,
  errorCode: ProcessingErrorV1Schema,
  diagnostic: ExtractionDiagnosticV1Schema,
});
const cancelledResult = strictObject({
  kind: z.literal("CANCELLED"),
  requestFingerprint: sha256,
  errorCode: z.literal("CANCELLED"),
  diagnostic: ExtractionDiagnosticV1Schema,
});
const supersededResult = strictObject({
  kind: z.literal("SUPERSEDED_INPUT"),
  requestFingerprint: sha256,
  errorCode: z.literal("SUPERSEDED_INPUT"),
  diagnostic: ExtractionDiagnosticV1Schema,
});
const bundleResult = strictObject({
  kind: z.literal("BUNDLE"),
  requestFingerprint: sha256,
  extractionId: contentId("ext_"),
  bundle: StructuredExtractionBundleV1Schema,
}).superRefine((value, context) => {
  if (value.requestFingerprint !== value.bundle.requestFingerprint)
    context.addIssue({ code: "custom", message: "outer request fingerprint mismatch" });
  if (value.extractionId !== value.bundle.extractionId)
    context.addIssue({ code: "custom", message: "outer extraction id mismatch" });
});

export const ExtractionCommandResultV1Schema = z.union([
  invalidRequestResult,
  bundleResult,
  rejectedResult,
  failedResult,
  cancelledResult,
  supersededResult,
]);

export type ObservedCountsV1 = z.infer<typeof ObservedCountsV1Schema>;
export type SafeContextV1 = z.infer<typeof SafeContextV1Schema>;
export type ExtractionDiagnosticV1 = z.infer<typeof ExtractionDiagnosticV1Schema>;
export type ExtractionCommandResultV1 = z.infer<typeof ExtractionCommandResultV1Schema>;
