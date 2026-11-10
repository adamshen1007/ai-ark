import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalJsonM03, containsOnlyUnicodeScalarStrings } from "./m03-normalization.js";
import { StructuredExtractionBundleV2Schema } from "./m03-bundle.js";
import { M03_FIELD_KEYS, M03FieldKeySchema, M03WarningCodeSchema } from "./m03.js";
import {
  ClaimEvidenceLinkV1Schema,
  ClaimV1Schema,
  EvidenceBindingRequestV1Schema,
  EvidenceCompletenessV1Schema,
  EvidenceItemV1Schema,
  isValidM04IdempotencyKey,
} from "./m04.js";

const strictObject = z.strictObject;
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const contentId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-f0-9]{64}$`, "u"));
const scalar = (minimum: number, maximum: number) =>
  z.string().superRefine((value, context) => {
    if (!containsOnlyUnicodeScalarStrings(value)) {
      context.addIssue({ code: "custom", message: "invalid Unicode scalar string" });
      return;
    }
    const count = Array.from(value).length;
    if (count < minimum || count > maximum)
      context.addIssue({ code: "custom", message: "Unicode scalar bound exceeded" });
  });

export const M05_SECTION_KEYS = [
  "IDENTITY",
  "OUTCOME_STATEMENT",
  "BEST_FOR",
  "NOT_IDEAL_FOR",
  "CAPABILITIES",
  "SUGGESTED_TASKS",
  "USE_CASES",
  "INSTALLATION",
  "COMPATIBILITY",
  "DEPENDENCIES",
  "PERMISSIONS",
  "LIMITATIONS",
  "MAINTENANCE",
  "SOURCE_AND_EVIDENCE",
] as const;
export const M05SectionKeySchema = z.enum(M05_SECTION_KEYS);

export const M05_TEMPLATE_IDS = [
  "SOURCE_DECLARATION",
  "METADATA_VALUE",
  "QUALIFIED_INDICATION",
  "INFERRED_SUITABILITY",
  "LIMITATION",
  "INSTALLATION_PATH",
  "PROVENANCE",
] as const;
export const M05TemplateIdSchema = z.enum(M05_TEMPLATE_IDS);

export const GenerateDraftRequestV1Schema = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_REQUEST_V1"),
  idempotencyKey: z.string().refine(isValidM04IdempotencyKey),
  bindingId: contentId("bnd_"),
  extractionId: contentId("ext_"),
  expectedBindingFingerprint: sha256,
  mode: z.enum(["DETERMINISTIC", "AI_ASSISTED"]),
  regenerationToken: z.string().refine(isValidM04IdempotencyKey),
  policyVersion: z.literal("m05-draft-policy-v1"),
  methodologyVersion: z.literal("m05-draft-methodology-v1"),
  promptBundleVersion: z.literal("m05-draft-prompt-v1"),
  providerConfigIdOrNull: scalar(1, 100).nullable(),
}).superRefine((value, context) => {
  if ((value.mode === "DETERMINISTIC") !== (value.providerConfigIdOrNull === null))
    context.addIssue({ code: "custom", message: "provider configuration does not match mode" });
});

export const M04SemanticRequestV1Schema = EvidenceBindingRequestV1Schema.omit({
  idempotencyKey: true,
});

export const M04BindingPreimageV1Schema = strictObject({
  schemaVersion: z.literal("M04_BINDING_ID_V1"),
  extractionId: contentId("ext_"),
  logicalPayloadSha256: sha256,
  evidencePolicyVersion: z.literal("m04-evidence-policy-v1"),
  materialFieldRegistryVersion: z.literal("m04-material-fields-v1"),
  evidenceItemIds: z
    .array(contentId("evi_"))
    .max(4096)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate evidence item ID",
    }),
  claimIds: z
    .array(contentId("clm_"))
    .max(20)
    .refine((values) => new Set(values).size === values.length, { message: "duplicate claim ID" }),
  linkIds: z
    .array(contentId("cel_"))
    .max(81920)
    .refine((values) => new Set(values).size === values.length, { message: "duplicate link ID" }),
  completenessId: contentId("cmp_"),
});

export const M04AcceptedResultRecordV1Schema = strictObject({
  schemaVersion: z.literal("M04_RESULT_V1"),
  resultId: contentId("m4r_"),
  kind: z.literal("ACCEPTED"),
  bindingId: contentId("bnd_"),
  extractionId: contentId("ext_"),
  completenessId: contentId("cmp_"),
});

export const AcceptedBindingSnapshotV1Schema = strictObject({
  schemaVersion: z.literal("M05_ACCEPTED_BINDING_SNAPSHOT_V1"),
  bindingPreimage: M04BindingPreimageV1Schema,
  acceptedResultRecord: M04AcceptedResultRecordV1Schema,
  bundle: StructuredExtractionBundleV2Schema,
  semanticRequest: M04SemanticRequestV1Schema,
  evidenceItems: z.array(EvidenceItemV1Schema).max(4096),
  claims: z.array(ClaimV1Schema).max(20),
  links: z.array(ClaimEvidenceLinkV1Schema).max(81920),
  completeness: EvidenceCompletenessV1Schema,
});

export const M05DisplayClassSchema = z.enum([
  "SOURCE_FACT",
  "REPOSITORY_METADATA",
  "STATIC_INDICATION",
  "AI_OR_RULE_INFERENCE",
  "MIXED_SUPPORT",
  "PROVENANCE_METADATA",
]);
const claimClassSchema = z.enum([
  "SOURCE_FACT",
  "REPOSITORY_METADATA",
  "STATIC_CODE_INDICATOR",
  "FORMAT_INFERENCE",
  "AI_INFERENCE",
  "MIXED_DETERMINISTIC_SUPPORT",
  "MIXED_SUPPORT",
]);
const claimStatusSchema = z.enum([
  "SUPPORTED",
  "SUPPORTED_WITH_QUALIFIER",
  "AMBIGUOUS",
  "REVIEW_REQUIRED",
]);
const fixedQualifierSchema = z.enum([
  "NOT_RUNTIME_VERIFIED",
  "RULE_INFERENCE",
  "AI_INFERENCE",
  "MIXED_PROVENANCE",
  "INFERRED_SUITABILITY",
]);
const provenanceQualifierSchema = z.union([M03WarningCodeSchema, fixedQualifierSchema]);
export const M05QualifierCodeSchema = provenanceQualifierSchema;
const fixedQualifierOrder = [
  "NOT_RUNTIME_VERIFIED",
  "RULE_INFERENCE",
  "AI_INFERENCE",
  "MIXED_PROVENANCE",
  "INFERRED_SUITABILITY",
] as const;
function qualifiersInOrder(values: readonly z.infer<typeof provenanceQualifierSchema>[]): boolean {
  if (new Set(values).size !== values.length) return false;
  let fixedStarted = false;
  let priorFixed = -1;
  for (const qualifier of values) {
    const fixedIndex = fixedQualifierOrder.indexOf(
      qualifier as (typeof fixedQualifierOrder)[number],
    );
    if (fixedIndex >= 0) {
      fixedStarted = true;
      if (fixedIndex <= priorFixed) return false;
      priorFixed = fixedIndex;
    } else if (fixedStarted) return false;
  }
  return true;
}

export const DraftItemV1Schema = strictObject({
  atomId: contentId("dat_"),
  templateId: M05TemplateIdSchema,
  text: scalar(1, 400),
  claimIds: z.array(contentId("clm_")).max(1),
  evidenceLinkIds: z.array(contentId("cel_")).max(81920),
  evidenceItemIds: z.array(contentId("evi_")).max(81920),
  originalClaimClasses: z
    .array(claimClassSchema)
    .max(7)
    .refine((values) => new Set(values).size === values.length, {
      message: "original claim classes are duplicated",
    }),
  originalStatuses: z.array(claimStatusSchema).max(1),
  displayClass: M05DisplayClassSchema,
  qualifierCodes: z
    .array(M05QualifierCodeSchema)
    .max(40)
    .refine(qualifiersInOrder, { message: "qualifiers are duplicated or out of order" }),
});

export const DraftSectionV1Schema = strictObject({
  key: M05SectionKeySchema,
  state: z.enum(["PRESENT", "NOT_PROVIDED", "WITHHELD"]),
  items: z.array(DraftItemV1Schema).max(12),
  omittedItemCount: z.number().int().nonnegative().max(81920),
});

export const M05ProviderConfigV1Schema = strictObject({
  providerConfigId: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/u),
  provider: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/u),
  model: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/u),
  configurationRevision: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/u),
  selectionProfile: z.literal("M05_SELECTION_ONLY_V1"),
});

export const M05PolicyArtifactsV1Schema = strictObject({
  schemaVersion: z.literal("M05_POLICY_ARTIFACTS_V1"),
  policyVersion: z.literal("m05-draft-policy-v1"),
  methodologyVersion: z.literal("m05-draft-methodology-v1"),
  promptBundleVersion: z.literal("m05-draft-prompt-v1"),
  promptUtf8Hex: z.string().regex(/^(?:[0-9a-f]{2}){1,65536}$/u),
  atomTemplateUtf8Hex: z.string().regex(/^(?:[0-9a-f]{2}){1,65536}$/u),
  providerConfigOrNull: M05ProviderConfigV1Schema.nullable(),
}).superRefine((value, context) => {
  const fatal = new TextDecoder("utf-8", { fatal: true });
  for (const [key, hex] of [
    ["promptUtf8Hex", value.promptUtf8Hex],
    ["atomTemplateUtf8Hex", value.atomTemplateUtf8Hex],
  ] as const) {
    try {
      fatal.decode(Buffer.from(hex, "hex"));
    } catch {
      context.addIssue({ code: "custom", path: [key], message: "artifact is not valid UTF-8" });
    }
  }
});

export const M05InputManifestV1Schema = strictObject({
  schemaVersion: z.literal("M05_INPUT_MANIFEST_V1"),
  byteLength: z.number().int().positive().max(268_435_456),
  chunkCount: z.number().int().positive().max(4096),
  payloadSha256: sha256,
  chunkHashes: z.array(sha256).min(1).max(4096),
  inputFingerprint: sha256,
  sourceFingerprint: sha256,
  policyFingerprint: sha256,
}).superRefine((value, context) => {
  if (
    value.chunkCount !== value.chunkHashes.length ||
    value.chunkCount !== Math.ceil(value.byteLength / 65_536)
  )
    context.addIssue({ code: "custom", message: "chunk manifest closure mismatch" });
});

export const M05MetricsV1Schema = strictObject({
  providerOrNull: scalar(1, 100).nullable(),
  modelOrNull: scalar(1, 100).nullable(),
  attemptCount: z.union([z.literal(0), z.literal(1)]),
  durationMs: z.number().int().nonnegative(),
  inputTokensOrNull: z.number().int().nonnegative().nullable(),
  outputTokensOrNull: z.number().int().nonnegative().nullable(),
});

const unique = <T extends z.ZodType>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate values forbidden",
    });

export const M05ProvenanceIndexV1Schema = strictObject({
  schemaVersion: z.literal("M05_PROVENANCE_INDEX_V1"),
  lineage: strictObject({
    bindingId: contentId("bnd_"),
    extractionId: contentId("ext_"),
    resourceIdentityId: z.string().min(1).max(2000),
    resourceVersionIdentityId: z.string().min(1).max(2000),
    sourceSnapshotId: z.string().min(1).max(2000),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    m03OutputFingerprint: sha256,
    completenessId: contentId("cmp_"),
    completenessRecordFingerprint: sha256,
  }),
  policy: strictObject({
    policyVersion: z.literal("m05-draft-policy-v1"),
    methodologyVersion: z.literal("m05-draft-methodology-v1"),
    promptBundleVersion: z.literal("m05-draft-prompt-v1"),
    promptArtifactSha256: sha256,
    atomTemplateArtifactSha256: sha256,
    providerConfigFingerprintOrNull: sha256.nullable(),
    providerOrNull: scalar(1, 100).nullable(),
    modelOrNull: scalar(1, 100).nullable(),
  }).superRefine((value, context) => {
    if (
      (value.providerConfigFingerprintOrNull === null) !==
      (value.providerOrNull === null && value.modelOrNull === null)
    )
      context.addIssue({ code: "custom", message: "provider provenance mismatch" });
  }),
  claimBindings: z
    .array(
      strictObject({
        claimId: contentId("clm_"),
        fieldKey: M03FieldKeySchema,
        originalClass: claimClassSchema,
        originalStatus: claimStatusSchema,
        qualifierCodes: unique(provenanceQualifierSchema, 40),
        evidenceLinkIds: z.array(contentId("cel_")).max(81920),
        evidenceItemIds: z.array(contentId("evi_")).max(81920),
      }),
    )
    .max(20)
    .refine((values) => new Set(values.map(({ claimId }) => claimId)).size === values.length, {
      message: "duplicate claim binding",
    }),
  omissions: z
    .array(
      strictObject({
        sectionKey: M05SectionKeySchema,
        atomIds: unique(contentId("dat_"), 81920),
        reason: z.enum(["OPTIONAL_LIMIT", "UNSAFE", "OPTIONAL_UNRESOLVED"]),
      }),
    )
    .max(42),
}).superRefine((value, context) => {
  const fieldIndexes = value.claimBindings.map(({ fieldKey }) => M03_FIELD_KEYS.indexOf(fieldKey));
  if (
    fieldIndexes.some((index, offset) => {
      const previous = fieldIndexes[offset - 1];
      return offset > 0 && previous !== undefined && index <= previous;
    })
  )
    context.addIssue({ code: "custom", message: "claim bindings are not in registry order" });
  for (const binding of value.claimBindings) {
    if (!qualifiersInOrder(binding.qualifierCodes))
      context.addIssue({ code: "custom", message: "qualifiers are duplicated or out of order" });
  }
  const reasonOrder = ["OPTIONAL_LIMIT", "UNSAFE", "OPTIONAL_UNRESOLVED"] as const;
  const omissionIndexes = value.omissions.map(
    ({ sectionKey, reason }) =>
      M05_SECTION_KEYS.indexOf(sectionKey) * reasonOrder.length + reasonOrder.indexOf(reason),
  );
  if (
    omissionIndexes.some((index, offset) => {
      const previous = omissionIndexes[offset - 1];
      return offset > 0 && previous !== undefined && index <= previous;
    })
  )
    context.addIssue({ code: "custom", message: "omissions are not in registry order" });
});

export const DraftRevisionV1Schema = strictObject({
  schemaVersion: z.literal("M05_DRAFT_REVISION_V1"),
  revisionId: contentId("drv_"),
  recordFingerprint: sha256,
  inputFingerprint: sha256,
  generationFingerprint: sha256,
  outputFingerprint: sha256,
  bindingId: contentId("bnd_"),
  extractionId: contentId("ext_"),
  sourceFingerprint: sha256,
  policyFingerprint: sha256,
  mode: z.enum(["DETERMINISTIC", "AI_ASSISTED"]),
  regenerationToken: scalar(1, 200),
  label: z.literal("AI-generated draft — human review required"),
  state: z.literal("UNAPPROVED"),
  sections: z.array(DraftSectionV1Schema).length(14),
  provenanceIndex: M05ProvenanceIndexV1Schema,
  generatedAt: z.iso.datetime({ offset: false, precision: 3 }),
  metrics: M05MetricsV1Schema,
}).superRefine((value, context) => {
  if (value.sections.some((section, index) => section.key !== M05_SECTION_KEYS[index]))
    context.addIssue({ code: "custom", message: "section registry order mismatch" });
  if ((value.mode === "DETERMINISTIC") !== (value.metrics.attemptCount === 0))
    context.addIssue({ code: "custom", message: "attempt count does not match mode" });
  if (
    value.mode === "DETERMINISTIC" &&
    (value.metrics.providerOrNull !== null ||
      value.metrics.modelOrNull !== null ||
      value.metrics.inputTokensOrNull !== null ||
      value.metrics.outputTokensOrNull !== null)
  )
    context.addIssue({ code: "custom", message: "deterministic metrics contain provider data" });
  if (
    value.mode === "AI_ASSISTED" &&
    (value.metrics.providerOrNull === null ||
      value.metrics.modelOrNull === null ||
      value.provenanceIndex.policy.providerOrNull !== value.metrics.providerOrNull ||
      value.provenanceIndex.policy.modelOrNull !== value.metrics.modelOrNull)
  )
    context.addIssue({
      code: "custom",
      message: "provider metrics do not match policy provenance",
    });
  const allItems = value.sections.flatMap(({ items }) => items);
  if (allItems.length > 64)
    context.addIssue({ code: "custom", message: "visible item limit exceeded" });
  const capabilities = value.sections.find(({ key }) => key === "CAPABILITIES");
  if ((capabilities?.items.length ?? 0) > 6)
    context.addIssue({ code: "custom", message: "capability limit exceeded" });
  const outcome = value.sections.find(({ key }) => key === "OUTCOME_STATEMENT");
  if ((outcome?.items ?? []).some(({ text }) => Array.from(text).length > 240))
    context.addIssue({ code: "custom", message: "outcome limit exceeded" });
  const totalScalars =
    Array.from(value.label).length +
    value.sections.reduce(
      (total, section) =>
        total +
        Array.from(section.key).length +
        section.items.reduce(
          (itemTotal, item) =>
            itemTotal +
            Array.from(item.text).length +
            item.qualifierCodes.reduce(
              (qualifierTotal, qualifier) => qualifierTotal + Array.from(qualifier).length,
              0,
            ),
          0,
        ),
      0,
    );
  if (totalScalars > 12_000)
    context.addIssue({ code: "custom", message: "visible scalar limit exceeded" });
  const bindings = new Map(
    value.provenanceIndex.claimBindings.map((binding) => [binding.claimId, binding]),
  );
  for (const item of allItems) {
    if (item.displayClass === "PROVENANCE_METADATA") {
      if (
        item.claimIds.length !== 0 ||
        item.originalClaimClasses.length !== 0 ||
        item.originalStatuses.length !== 0
      )
        context.addIssue({ code: "custom", message: "provenance metadata authority mismatch" });
      continue;
    }
    if (item.claimIds.length !== 1)
      context.addIssue({ code: "custom", message: "draft item must bind exactly one claim" });
    const binding = bindings.get(item.claimIds[0] ?? "");
    if (
      binding === undefined ||
      canonicalJsonM03(binding.evidenceLinkIds) !== canonicalJsonM03(item.evidenceLinkIds) ||
      canonicalJsonM03(binding.evidenceItemIds) !== canonicalJsonM03(item.evidenceItemIds)
    )
      context.addIssue({ code: "custom", message: "draft item provenance closure mismatch" });
  }
});

const accepted = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_RESULT_V1"),
  kind: z.literal("ACCEPTED"),
  revisionId: contentId("drv_"),
  inputFingerprint: sha256,
  outputFingerprint: sha256,
  recordFingerprint: sha256,
  replayed: z.boolean(),
});
const rejected = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_RESULT_V1"),
  kind: z.literal("REJECTED"),
  requestFingerprint: sha256,
  code: z.enum([
    "POLICY_UNSUPPORTED",
    "BINDING_NOT_FOUND",
    "EXPECTED_BINDING_MISMATCH",
    "IDEMPOTENCY_KEY_REUSED",
  ]),
});
const failed = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_RESULT_V1"),
  kind: z.literal("FAILED"),
  requestFingerprintOrNull: sha256.nullable(),
  code: z.enum([
    "SOURCE_INTEGRITY_FAILED",
    "AUTHORITY_INVALID",
    "CAPACITY_EXCEEDED",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_TIMEOUT",
    "PROVIDER_OUTPUT_INVALID",
    "DEADLINE_EXCEEDED",
    "PERSISTENCE_UNAVAILABLE",
    "PERSISTENCE_INTEGRITY_FAILED",
    "CONTENT_HASH_COLLISION",
    "SERIALIZATION_RETRY_EXHAUSTED",
  ]),
});
const blocked = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_RESULT_V1"),
  kind: z.literal("BLOCKED"),
  requestFingerprint: sha256,
  code: z.enum(["M04_PROGRESSION_BLOCKED", "MATERIAL_CONTENT_WITHHELD"]),
  completenessId: contentId("cmp_"),
  completenessRecordFingerprint: sha256,
  blockingRequirementKeys: z.array(z.string().min(1)).max(11),
});
const malformed = strictObject({
  schemaVersion: z.literal("M05_GENERATE_DRAFT_RESULT_V1"),
  kind: z.literal("MALFORMED"),
  rawRequestSha256: sha256,
  code: z.enum(["REQUEST_TOO_LARGE", "REQUEST_JSON_INVALID", "REQUEST_SCHEMA_INVALID"]),
});
export const GenerateDraftResultV1Schema = z.discriminatedUnion("kind", [
  accepted,
  blocked,
  rejected,
  failed,
  malformed,
]);

export type GenerateDraftRequestV1 = z.infer<typeof GenerateDraftRequestV1Schema>;
export type GenerateDraftResultV1 = z.infer<typeof GenerateDraftResultV1Schema>;
export type AcceptedBindingSnapshotV1 = z.infer<typeof AcceptedBindingSnapshotV1Schema>;
export type DraftRevisionV1 = z.infer<typeof DraftRevisionV1Schema>;
export type DraftSectionV1 = z.infer<typeof DraftSectionV1Schema>;
export type M05PolicyArtifactsV1 = z.infer<typeof M05PolicyArtifactsV1Schema>;
export type M05InputManifestV1 = z.infer<typeof M05InputManifestV1Schema>;

export type AcceptedBindingReadResultV1 =
  | { readonly kind: "FOUND"; readonly snapshot: AcceptedBindingSnapshotV1 }
  | {
      readonly kind:
        | "NOT_FOUND"
        | "EXPECTED_BINDING_MISMATCH"
        | "INTEGRITY_FAILED"
        | "AUTHORITY_INVALID"
        | "UNAVAILABLE";
    };

export interface AcceptedBindingReadPortV1 {
  readAcceptedBinding(
    bindingId: string,
    expectedExtractionId: string,
    expectedBindingFingerprint: string,
  ): Promise<AcceptedBindingReadResultV1>;
}

export const fingerprintM05 = (value: unknown): string =>
  createHash("sha256").update(canonicalJsonM03(value)).digest("hex");
