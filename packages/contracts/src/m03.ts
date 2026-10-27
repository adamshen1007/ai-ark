import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalJsonM03, containsOnlyUnicodeScalarStrings } from "./m03-normalization.js";
import { defaultCaseFoldUnicode15_1 } from "./m03-unicode-15-1.js";

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
// V1 request semantics are frozen; V2 requests replace only the literal.
// Scalar validation belongs to the new retained projection/bundle boundaries.
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

const m03ByteStringSchema = strictObject({
  byteLength: z.number().int().nonnegative(),
  base64: z.string(),
}).superRefine((value, context) => {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value.base64, "base64");
  } catch {
    context.addIssue({ code: "custom", message: "invalid canonical base64" });
    return;
  }
  if (bytes.byteLength !== value.byteLength || bytes.toString("base64") !== value.base64) {
    context.addIssue({ code: "custom", message: "invalid canonical base64" });
  }
});

const normalizedIdentityTokenSchema = z.string().superRefine((value, context) => {
  const normalized = defaultCaseFoldUnicode15_1(value.normalize("NFKC"))
    .replace(/^[\p{White_Space}]+|[\p{White_Space}]+$/gu, "")
    .replace(/[\p{White_Space}_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (
    value !== normalized ||
    Array.from(value).length < 1 ||
    Array.from(value).length > 128 ||
    !/^[\p{L}\p{Nd}-]+$/u.test(value)
  ) {
    context.addIssue({ code: "custom", message: "invalid normalized identity token" });
  }
});

const m02OperationScopeSchema = z.enum(["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"]);
const identityOutcomeSchema = z.enum([
  "NEW_RESOURCE",
  "EXACT_REPEAT_REUSE",
  "EXISTING_RESOURCE_NEW_VERSION",
  "AMBIGUOUS_IDENTITY",
  "POSSIBLE_DUPLICATE",
  "FORK_OF_EXISTING_RESOURCE",
  "MIRROR",
]);
const originalReplacementSchema = strictObject({
  kind: z.literal("ORIGINAL"),
  reasonCodeOrNull: z.null(),
  inputPayloadOrNull: z.null(),
  inputFingerprintOrNull: z.null(),
  sourceJobIdOrNull: z.null(),
  sourceOperationScopeOrNull: z.null(),
  requestedOperationScopeOrNull: z.null(),
  predecessorJobIds: z.tuple([]),
  originalSourceSnapshotIdOrNull: z.null(),
  replacementSourceSnapshotIdOrNull: z.null(),
});
const replacementSchema = strictObject({
  kind: z.literal("REPLACEMENT"),
  reasonCode: z.enum([
    "FAILED_STAGE_REPLACEMENT",
    "RETRY_EXHAUSTED",
    "NEW_SUPPORTED_SNAPSHOT",
    "POLICY_OR_METHODOLOGY_CHANGE",
    "ADMINISTRATIVE_CORRECTION",
  ]),
  inputPayloadOrNull: m03ByteStringSchema,
  inputFingerprintOrNull: lowercaseSha256,
  sourceJobIdOrNull: nonemptyId,
  sourceOperationScopeOrNull: m02OperationScopeSchema,
  requestedOperationScopeOrNull: m02OperationScopeSchema,
  predecessorJobIds: z.array(nonemptyId).min(1),
  originalSourceSnapshotIdOrNull: nonemptyId,
  replacementSourceSnapshotIdOrNull: nonemptyId.nullable(),
});

const projectionSchema = strictObject({
  handoff: strictObject({
    id: nonemptyId,
    resourceCandidateId: nonemptyId,
    resourceIdentityId: nonemptyId,
    resourceVersionIdentityId: nonemptyId,
    controllingM02JobId: nonemptyId,
    sourceSnapshotId: nonemptyId,
    identityDecisionId: nonemptyId,
    originType: z.enum(["HUMAN_COMMAND", "SYSTEM_IDENTITY_OPERATION"]),
    logicalKey: nonemptyId,
    state: z.enum(["ACTIVE", "SUPERSEDED"]),
    recordVersion: PositiveBigIntSchema,
  }),
  acquisitionJob: strictObject({
    id: nonemptyId,
    status: z.enum(["ACTIVE", "COMPLETED", "FAILED", "CANCELLED", "OPERATOR_REVIEW_REQUIRED"]),
    currentStage: z.enum([
      "RECEIVED",
      "VALIDATING_SOURCE",
      "ACQUIRING_SOURCE",
      "INVENTORYING_SOURCE",
    ]),
    sourceSnapshotId: nonemptyId,
    cancellationRequested: z.boolean(),
    recordVersion: PositiveBigIntSchema,
  }),
  m02Job: strictObject({
    id: nonemptyId,
    jobLineageId: nonemptyId,
    sourceSnapshotId: nonemptyId,
    operationScope: m02OperationScopeSchema,
    currentStage: z.enum(["CLASSIFYING_REPOSITORY", "RESOLVING_IDENTITY"]),
    reviewState: z.enum([
      "NOT_REQUIRED",
      "CLASSIFICATION_REVIEW_REQUIRED",
      "IDENTITY_REVIEW_REQUIRED",
      "CLARIFICATION_REQUESTED",
      "RESOLVED",
      "REJECTED",
    ]),
    supersessionState: z.enum(["CONTROLLING", "SUPERSEDED"]),
    supersededByJobIdOrNull: nonemptyId.nullable(),
    supersessionSequence: PositiveBigIntSchema,
    controllingClassificationDecisionIdOrNull: nonemptyId.nullable(),
    jobScopeKey: lowercaseSha256,
    inputFingerprint: lowercaseSha256,
    classificationPolicyVersion: nonemptyId,
    identityPolicyVersion: nonemptyId,
    analysisPolicyVersion: nonemptyId,
    parserProfileVersion: nonemptyId,
    promptBundleVersion: nonemptyId,
    analysisProviderAdapterIdOrNull: nonemptyId.nullable(),
    analysisModelIdOrNull: nonemptyId.nullable(),
    analysisMethodologyVersionOrNull: nonemptyId.nullable(),
    recordVersion: PositiveBigIntSchema,
    replacement: z.discriminatedUnion("kind", [originalReplacementSchema, replacementSchema]),
  }),
  candidate: strictObject({
    id: nonemptyId,
    sourceSnapshotId: nonemptyId,
    candidateRootId: nonemptyId,
    candidateRootFingerprint: lowercaseSha256,
    candidateContentFingerprint: lowercaseSha256,
    reconciledClassificationRunId: nonemptyId,
    classificationPolicyVersion: nonemptyId,
    identityPolicyVersion: nonemptyId,
    identityOutcome: identityOutcomeSchema,
    status: z.enum([
      "CLASSIFIED",
      "IDENTITY_REVIEW_REQUIRED",
      "IDENTITY_RESOLVED",
      "REJECTED",
      "SUPERSEDED",
    ]),
    resourceIdentityId: nonemptyId,
    resourceVersionIdentityId: nonemptyId,
    recordVersion: PositiveBigIntSchema,
  }),
  resourceIdentity: strictObject({
    id: nonemptyId,
    resourceType: z.literal("SKILL"),
    status: z.enum(["ACTIVE", "AMBIGUOUS", "REJECTED"]),
    reliableIdentityTokenOrNull: normalizedIdentityTokenSchema.nullable(),
    reliableTokenEvidenceIdOrNull: nonemptyId.nullable(),
    guardAnchorCandidateId: nonemptyId,
    recordVersion: PositiveBigIntSchema,
  }),
  resourceVersionIdentity: strictObject({
    id: nonemptyId,
    resourceIdentityId: nonemptyId,
    contentFingerprint: lowercaseSha256,
    firstObservedSourceSnapshotId: nonemptyId,
    firstObservedCandidateRootId: nonemptyId,
    firstObservedSourceRevision: gitRevision,
    observationLabel: z.string().regex(/^snapshot:[0-9a-f]{12}$/u),
    status: z.enum(["IDENTITY_RESOLVED", "SUPERSEDED", "REJECTED"]),
    recordVersion: PositiveBigIntSchema,
  }),
  observation: strictObject({
    id: nonemptyId,
    resourceVersionIdentityId: nonemptyId,
    sourceSnapshotId: nonemptyId,
    candidateRootId: nonemptyId,
    resourceSourceLinkId: nonemptyId,
    sourceRepositoryId: nonemptyId,
    provider: z.literal("github"),
    providerRepositoryId: nonemptyId,
    normalizedRootPath: z.string(),
    immutableRevision: gitRevision,
    observedAt: z.iso.datetime({ offset: true }),
  }),
  sourceLink: strictObject({
    id: nonemptyId,
    sourceRepositoryId: nonemptyId,
    normalizedRootPath: z.string(),
    targetResourceVersionId: nonemptyId,
    relationship: z.enum(["PRIMARY", "ALTERNATE"]),
    decisionId: nonemptyId,
    state: z.enum(["ACTIVE", "SUPERSEDED"]),
    recordVersion: PositiveBigIntSchema,
  }),
  sourceRepository: strictObject({
    id: nonemptyId,
    provider: z.literal("github"),
    providerRepositoryId: nonemptyId,
    firstObservedSourceSnapshotId: nonemptyId,
    recordVersion: PositiveBigIntSchema,
  }),
  identityDecision: strictObject({
    id: nonemptyId,
    resourceCandidateId: nonemptyId,
    outcome: identityOutcomeSchema,
    matchedTierOrNull: z.enum(["P1", "P2", "P3", "P4", "P5", "P6"]).nullable(),
    confidenceOrNull: z.number().min(0).max(1).nullable(),
    identityPolicyVersion: nonemptyId,
    decisionSource: z.enum(["DETERMINISTIC", "AI_ASSISTED", "HUMAN_COMMAND"]),
    state: z.enum(["ACTIVE", "SUPERSEDED"]),
    recordVersion: PositiveBigIntSchema,
  }),
  candidateReviewState: strictObject({
    id: nonemptyId,
    groupIdOrNull: nonemptyId.nullable(),
    resourceCandidateId: nonemptyId,
    reviewState: z.enum([
      "NOT_REQUIRED",
      "CLASSIFICATION_REVIEW_REQUIRED",
      "IDENTITY_REVIEW_REQUIRED",
      "CLARIFICATION_REQUESTED",
      "RESOLVED",
      "REJECTED",
      "SUPERSEDED",
    ]),
    supersededByReviewIdOrNull: nonemptyId.nullable(),
    recordVersion: PositiveBigIntSchema,
  }),
  candidateRoot: strictObject({
    id: nonemptyId,
    groupId: nonemptyId,
    classificationRunId: nonemptyId,
    sourceSnapshotId: nonemptyId,
    normalizedRootPath: z.string(),
    candidateRootFingerprint: lowercaseSha256,
    candidateContentFingerprint: lowercaseSha256,
    state: z.enum(["ACTIVE", "SUPERSEDED"]),
    recordVersion: PositiveBigIntSchema,
  }),
});

function projectionIssue(
  context: { addIssue(issue: { code: "custom"; message: string }): void },
  ok: boolean,
) {
  if (!ok) context.addIssue({ code: "custom", message: "M02 input projection invariant failed" });
}

export const M03M02InputProjectionV1Schema = projectionSchema.superRefine((value, context) => {
  if (!containsOnlyUnicodeScalarStrings(value)) {
    context.addIssue({
      code: "custom",
      message: "M02 input projection contains invalid Unicode scalar",
    });
    return;
  }
  const { handoff, acquisitionJob, m02Job, candidate, resourceIdentity, resourceVersionIdentity } =
    value;
  const {
    observation,
    sourceLink,
    sourceRepository,
    identityDecision,
    candidateReviewState,
    candidateRoot,
  } = value;
  const equal = (...members: readonly unknown[]) =>
    members.every((member) => member === members[0]);
  projectionIssue(context, equal(handoff.resourceCandidateId, candidate.id));
  projectionIssue(
    context,
    equal(handoff.resourceIdentityId, candidate.resourceIdentityId, resourceIdentity.id),
  );
  projectionIssue(
    context,
    equal(
      handoff.resourceVersionIdentityId,
      candidate.resourceVersionIdentityId,
      resourceVersionIdentity.id,
    ),
  );
  projectionIssue(context, equal(handoff.controllingM02JobId, m02Job.id));
  projectionIssue(context, equal(handoff.identityDecisionId, identityDecision.id));
  projectionIssue(
    context,
    equal(
      handoff.sourceSnapshotId,
      m02Job.sourceSnapshotId,
      candidate.sourceSnapshotId,
      candidateRoot.sourceSnapshotId,
      observation.sourceSnapshotId,
    ),
  );
  projectionIssue(
    context,
    equal(candidate.candidateRootId, candidateRoot.id, observation.candidateRootId),
  );
  projectionIssue(
    context,
    equal(candidate.candidateRootFingerprint, candidateRoot.candidateRootFingerprint),
  );
  projectionIssue(
    context,
    equal(candidate.reconciledClassificationRunId, candidateRoot.classificationRunId),
  );
  projectionIssue(
    context,
    equal(candidate.classificationPolicyVersion, m02Job.classificationPolicyVersion),
  );
  projectionIssue(
    context,
    equal(
      candidate.identityPolicyVersion,
      m02Job.identityPolicyVersion,
      identityDecision.identityPolicyVersion,
    ),
  );
  projectionIssue(
    context,
    equal(
      candidate.candidateContentFingerprint,
      candidateRoot.candidateContentFingerprint,
      resourceVersionIdentity.contentFingerprint,
    ),
  );
  projectionIssue(context, equal(resourceVersionIdentity.resourceIdentityId, resourceIdentity.id));
  projectionIssue(
    context,
    equal(
      observation.resourceVersionIdentityId,
      resourceVersionIdentity.id,
      sourceLink.targetResourceVersionId,
    ),
  );
  projectionIssue(context, equal(observation.resourceSourceLinkId, sourceLink.id));
  projectionIssue(
    context,
    equal(observation.sourceRepositoryId, sourceLink.sourceRepositoryId, sourceRepository.id),
  );
  projectionIssue(
    context,
    equal(
      observation.normalizedRootPath,
      sourceLink.normalizedRootPath,
      candidateRoot.normalizedRootPath,
    ),
  );
  projectionIssue(context, equal(observation.provider, sourceRepository.provider));
  projectionIssue(
    context,
    equal(observation.providerRepositoryId, sourceRepository.providerRepositoryId),
  );
  projectionIssue(context, equal(sourceLink.decisionId, identityDecision.id));
  projectionIssue(context, equal(identityDecision.resourceCandidateId, candidate.id));
  projectionIssue(context, equal(candidateReviewState.resourceCandidateId, candidate.id));
  projectionIssue(context, equal(acquisitionJob.id, m02Job.id, handoff.controllingM02JobId));
  projectionIssue(
    context,
    equal(
      acquisitionJob.sourceSnapshotId,
      m02Job.sourceSnapshotId,
      handoff.sourceSnapshotId,
      observation.sourceSnapshotId,
    ),
  );
  projectionIssue(
    context,
    equal(
      m02Job.controllingClassificationDecisionIdOrNull,
      candidate.reconciledClassificationRunId,
      candidateRoot.classificationRunId,
    ),
  );
  projectionIssue(context, equal(candidate.identityOutcome, identityDecision.outcome));
  projectionIssue(
    context,
    handoff.state === "ACTIVE" &&
      acquisitionJob.status === "COMPLETED" &&
      !acquisitionJob.cancellationRequested &&
      m02Job.supersessionState === "CONTROLLING" &&
      candidate.status === "IDENTITY_RESOLVED" &&
      resourceIdentity.status === "ACTIVE" &&
      resourceVersionIdentity.status === "IDENTITY_RESOLVED" &&
      sourceLink.state === "ACTIVE" &&
      identityDecision.state === "ACTIVE" &&
      (candidateReviewState.reviewState === "NOT_REQUIRED" ||
        candidateReviewState.reviewState === "RESOLVED") &&
      candidateReviewState.supersededByReviewIdOrNull === null &&
      candidateRoot.state === "ACTIVE",
  );
  projectionIssue(
    context,
    (resourceIdentity.reliableIdentityTokenOrNull === null) ===
      (resourceIdentity.reliableTokenEvidenceIdOrNull === null),
  );
  const analysisMembers = [
    m02Job.analysisProviderAdapterIdOrNull,
    m02Job.analysisModelIdOrNull,
    m02Job.analysisMethodologyVersionOrNull,
  ];
  projectionIssue(
    context,
    analysisMembers.every((member) => member === null) ||
      analysisMembers.every((member) => member !== null),
  );
  if (m02Job.replacement.kind === "REPLACEMENT") {
    const replacement = m02Job.replacement;
    projectionIssue(context, replacement.requestedOperationScopeOrNull === m02Job.operationScope);
    const canonicalBytes = Buffer.from(replacement.inputPayloadOrNull.base64, "base64");
    const expectedPayload = canonicalJsonM03({
      schemaVersion: "1",
      jobLineageId: m02Job.jobLineageId,
      sourceJobId: replacement.sourceJobIdOrNull,
      sourceOperationScope: replacement.sourceOperationScopeOrNull,
      requestedOperationScope: replacement.requestedOperationScopeOrNull,
      predecessorJobIds: replacement.predecessorJobIds,
      sourceSnapshotId: replacement.originalSourceSnapshotIdOrNull,
      replacementSourceSnapshotIdOrNull: replacement.replacementSourceSnapshotIdOrNull,
      classificationPolicyVersion: m02Job.classificationPolicyVersion,
      identityPolicyVersion: m02Job.identityPolicyVersion,
      analysisPolicyVersion: m02Job.analysisPolicyVersion,
      parserProfileVersion: m02Job.parserProfileVersion,
      promptBundleVersion: m02Job.promptBundleVersion,
      analysisProviderAdapterIdOrNull: m02Job.analysisProviderAdapterIdOrNull,
      analysisModelIdOrNull: m02Job.analysisModelIdOrNull,
      analysisMethodologyVersionOrNull: m02Job.analysisMethodologyVersionOrNull,
      controllingClassificationDecisionIdOrNull: m02Job.controllingClassificationDecisionIdOrNull,
    });
    projectionIssue(context, canonicalBytes.toString("utf8") === expectedPayload);
    projectionIssue(
      context,
      createHash("sha256").update(canonicalBytes).digest("hex") ===
        replacement.inputFingerprintOrNull,
    );
    const sorted = [...replacement.predecessorJobIds].sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right)),
    );
    projectionIssue(
      context,
      new Set(replacement.predecessorJobIds).size === replacement.predecessorJobIds.length &&
        JSON.stringify(sorted) === JSON.stringify(replacement.predecessorJobIds),
    );
  }
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

export const ExtractionRequestV2Schema = ExtractionRequestV1Schema.extend({
  schemaVersion: z.literal("M03_EXTRACTION_REQUEST_V2"),
});

export const BasicExtractionRequestV2Schema = ExtractionRequestV2Schema.extend({
  expectedPredecessorState: z.unknown(),
});

export type M03FieldKey = (typeof M03_FIELD_KEYS)[number];
export type M03WarningCode = (typeof M03_WARNING_CODES)[number];
export type M03AnalysisSubOperation = (typeof M03_ANALYSIS_SUB_OPERATIONS)[number];
export type ExpectedPredecessorStateV1 = z.infer<typeof ExpectedPredecessorStateV1Schema>;
export type M03M02InputProjectionV1 = z.infer<typeof M03M02InputProjectionV1Schema>;
export type AnalysisConfigurationV1 = z.infer<typeof AnalysisConfigurationV1Schema>;
export type ExtractionRequestV1 = z.infer<typeof ExtractionRequestV1Schema>;
export type BasicExtractionRequestV1 = z.infer<typeof BasicExtractionRequestV1Schema>;
export type ExtractionRequestV2 = z.infer<typeof ExtractionRequestV2Schema>;
export type BasicExtractionRequestV2 = z.infer<typeof BasicExtractionRequestV2Schema>;

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
