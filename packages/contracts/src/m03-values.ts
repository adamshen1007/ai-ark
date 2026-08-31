import { z } from "zod";

import {
  canonicalizeSpdx,
  handleKey,
  isValidDependencyName,
  normalizeDependencyName,
  semverKey,
  textKey,
} from "./m03-normalization.js";

import { M03_FIELD_KEYS, M03FieldKeySchema, M03WarningCodeSchema } from "./m03.js";

const strictObject = z.strictObject;
const nonemptyId = z.string().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const contentId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-f0-9]{64}$`, "u"));
const sourceReferenceId = contentId("src_");
const extractorRefId = contentId("xtr_");
const candidateId = contentId("cand_");
const proposalId = contentId("aip_");
const conflictId = contentId("conf_");
const unicodeWhitespaceAtEdges = /^\p{White_Space}+|\p{White_Space}+$/gu;
function unicodeScalarLength(value: string): number | null {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const trailing = value.charCodeAt(index + 1);
      if (!(trailing >= 0xdc00 && trailing <= 0xdfff)) return null;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return null;
    count += 1;
  }
  return count;
}
const boundedScalarString = (minimum: number, maximum: number) =>
  z.string().superRefine((value, context) => {
    const scalarLength = unicodeScalarLength(value);
    if (scalarLength === null || scalarLength < minimum || scalarLength > maximum)
      context.addIssue({ code: "custom", message: "invalid Unicode scalar string length" });
  });
const trimmedString = (maximum: number) =>
  boundedScalarString(1, maximum).refine(
    (value) => value === value.replace(unicodeWhitespaceAtEdges, "").normalize("NFC"),
  );
const uniqueArray = <T extends z.ZodType>(schema: T, maximum = 4096) =>
  z
    .array(schema)
    .max(maximum)
    .refine(
      (values) => new Set(values.map((value) => JSON.stringify(value))).size === values.length,
    );

const ordinaryDocumentLocatorSchema = z
  .discriminatedUnion("type", [
    strictObject({
      type: z.literal("LINE_RANGE"),
      path: trimmedString(1000),
      startLine: z.number().int().positive(),
      endLine: z.number().int().positive(),
    }).refine((value) => value.endLine >= value.startLine),
    strictObject({
      type: z.literal("BYTE_RANGE"),
      path: trimmedString(1000),
      startByte: z.number().int().nonnegative(),
      endByteExclusive: z.number().int().positive(),
      extractionTransform: z.literal("EXACT_COMMAND_V1"),
    }).refine((value) => value.endByteExclusive > value.startByte),
    strictObject({
      type: z.literal("JSON_POINTER"),
      path: trimmedString(1000),
      jsonPointer: boundedScalarString(0, 1000),
    }),
    strictObject({
      type: z.literal("DATA_POINTER"),
      path: trimmedString(1000),
      format: z.enum(["YAML_FRONT_MATTER", "TOML"]),
      dataPointer: boundedScalarString(0, 1000),
    }),
    strictObject({
      type: z.literal("FILE_METADATA"),
      path: trimmedString(1000),
      owningRecord: z.enum(["SOURCE_ENTRY", "SOURCE_DOCUMENT"]),
      metadataKey: z.enum([
        "entryType",
        "byteLength",
        "mediaType",
        "candidateFileClass",
        "priority",
        "disposition",
        "reasonCodes",
        "sha256",
        "encoding",
        "lineCount",
        "contentHash",
      ]),
    }),
    strictObject({ type: z.literal("TREE_PATH"), path: trimmedString(1000) }),
  ])
  .superRefine((value, context) => {
    if (value.type !== "FILE_METADATA") return;
    const sourceEntryKeys = new Set([
      "entryType",
      "byteLength",
      "mediaType",
      "candidateFileClass",
      "priority",
      "disposition",
      "reasonCodes",
      "sha256",
    ]);
    const sourceDocumentKeys = new Set(["encoding", "lineCount", "contentHash"]);
    const allowed = value.owningRecord === "SOURCE_ENTRY" ? sourceEntryKeys : sourceDocumentKeys;
    if (!allowed.has(value.metadataKey))
      context.addIssue({
        code: "custom",
        message: "metadata key does not belong to owning record",
      });
  });

const sensitiveLocatorSchema = z
  .discriminatedUnion("originalType", [
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("LINE_RANGE"),
      locatorFingerprint: sha256,
      startLine: z.number().int().positive(),
      endLine: z.number().int().positive(),
    }).refine((value) => value.endLine >= value.startLine),
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("BYTE_RANGE"),
      locatorFingerprint: sha256,
      startByte: z.number().int().nonnegative(),
      endByteExclusive: z.number().int().positive(),
      extractionTransform: z.literal("EXACT_COMMAND_V1"),
    }).refine((value) => value.endByteExclusive > value.startByte),
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("JSON_POINTER"),
      locatorFingerprint: sha256,
    }),
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("DATA_POINTER"),
      locatorFingerprint: sha256,
      format: z.enum(["YAML_FRONT_MATTER", "TOML"]),
    }),
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("FILE_METADATA"),
      locatorFingerprint: sha256,
      owningRecord: z.enum(["SOURCE_ENTRY", "SOURCE_DOCUMENT"]),
      metadataKey: z.enum([
        "entryType",
        "byteLength",
        "mediaType",
        "candidateFileClass",
        "priority",
        "disposition",
        "reasonCodes",
        "sha256",
        "encoding",
        "lineCount",
        "contentHash",
      ]),
    }),
    strictObject({
      type: z.literal("SENSITIVE_LOCATOR"),
      originalType: z.literal("TREE_PATH"),
      locatorFingerprint: sha256,
    }),
  ])
  .superRefine((value, context) => {
    if (value.originalType !== "FILE_METADATA") return;
    const sourceEntryKeys = new Set([
      "entryType",
      "byteLength",
      "mediaType",
      "candidateFileClass",
      "priority",
      "disposition",
      "reasonCodes",
      "sha256",
    ]);
    const sourceDocumentKeys = new Set(["encoding", "lineCount", "contentHash"]);
    const allowed = value.owningRecord === "SOURCE_ENTRY" ? sourceEntryKeys : sourceDocumentKeys;
    if (!allowed.has(value.metadataKey))
      context.addIssue({
        code: "custom",
        message: "metadata key does not belong to owning record",
      });
  });

export const DocumentLocatorV1Schema = z.union([
  ordinaryDocumentLocatorSchema,
  sensitiveLocatorSchema,
]);

const documentReferenceSchema = strictObject({
  kind: z.literal("DOCUMENT"),
  id: sourceReferenceId,
  sourceSnapshotId: nonemptyId,
  sourceEntryId: nonemptyId,
  sourceDocumentId: nonemptyId,
  ownership: z.enum(["CANDIDATE_OWNED", "SHARED"]),
  locator: DocumentLocatorV1Schema,
  contentHash: sha256,
  excerptHashOrNull: sha256.nullable(),
  excerptOrNull: boundedScalarString(0, 2000).nullable(),
}).superRefine((value, context) => {
  if ((value.excerptHashOrNull === null) !== (value.excerptOrNull === null)) {
    context.addIssue({ code: "custom", message: "excerpt and hash must be present together" });
  }
  if (
    (value.locator.type === "TREE_PATH" || value.locator.type === "SENSITIVE_LOCATOR") &&
    (value.excerptHashOrNull !== null || value.excerptOrNull !== null)
  ) {
    context.addIssue({ code: "custom", message: "locator requires a null excerpt" });
  }
});

const snapshotLocatorSchema = z.discriminatedUnion("type", [
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
    if ((value.metadataKey === "tags") !== (value.ordinalOrNull !== null)) {
      context.addIssue({ code: "custom", message: "release ordinal mismatch" });
    }
  }),
  strictObject({
    type: z.literal("LICENSE_FIELD"),
    metadataKey: z.enum(["spdxId", "source"]),
  }),
  strictObject({
    type: z.literal("FORK_FIELD"),
    metadataKey: z.enum(["isFork", "parentCanonicalUrl"]),
  }),
]);

const snapshotReferenceSchema = strictObject({
  kind: z.literal("SNAPSHOT_METADATA"),
  id: sourceReferenceId,
  sourceSnapshotId: nonemptyId,
  metadataFingerprintKind: z.enum(["SOURCE_SNAPSHOT", "PROVIDER_METADATA"]),
  metadataFingerprint: sha256,
  locator: snapshotLocatorSchema,
  contentHash: sha256,
  excerptHashOrNull: z.null(),
  excerptOrNull: z.null(),
}).superRefine((value, context) => {
  if (
    (value.locator.type === "SNAPSHOT_FIELD") !==
    (value.metadataFingerprintKind === "SOURCE_SNAPSHOT")
  ) {
    context.addIssue({ code: "custom", message: "metadata fingerprint kind mismatch" });
  }
});

const absenceReferenceSchema = strictObject({
  kind: z.literal("INVENTORY_ABSENCE"),
  id: sourceReferenceId,
  sourceSnapshotId: nonemptyId,
  candidateRootId: nonemptyId,
  ownershipTopologyFingerprint: sha256,
  acquisitionResultFingerprint: sha256,
  predicate: z.enum(["CHANGELOG_SELECTOR_SET_EMPTY", "DEPRECATION_DECLARATION_ABSENT"]),
  evaluatedSelectorPaths: uniqueArray(trimmedString(1000)),
  contentHash: sha256,
  excerptHashOrNull: z.null(),
  excerptOrNull: z.null(),
});

export const ExtractionSourceReferenceV1Schema = z.discriminatedUnion("kind", [
  documentReferenceSchema,
  snapshotReferenceSchema,
  absenceReferenceSchema,
]);

export const CommandSafetyIndicatorV1Schema = z.enum([
  "CREDENTIAL_LITERAL",
  "PERSONAL_CONTACT_LITERAL",
  "NETWORK_DOWNLOAD",
  "PIPE_TO_INTERPRETER",
  "PRIVILEGE_ESCALATION",
  "DESTRUCTIVE_OPERATION",
  "VARIABLE_INTERPOLATION",
  "UNKNOWN",
]);

export const ExactCommandV1Schema = strictObject({
  ordinal: z.number().int().min(0).max(255),
  languageTagOrNull: trimmedString(50).nullable(),
  commandTextState: z.enum(["PRESENT", "WITHHELD_SECRET_LIKE", "WITHHELD_PERSONAL_CONTACT"]),
  commandTextOrNull: trimmedString(8000).nullable(),
  sourceContentHash: sha256,
  sourceReferenceIds: uniqueArray(sourceReferenceId).min(1),
  safetyIndicators: uniqueArray(CommandSafetyIndicatorV1Schema, 8),
}).superRefine((value, context) => {
  if (value.commandTextState === "PRESENT") {
    if (value.commandTextOrNull === null) {
      context.addIssue({ code: "custom", message: "present command requires text" });
    }
    if (
      value.safetyIndicators.includes("CREDENTIAL_LITERAL") ||
      value.safetyIndicators.includes("PERSONAL_CONTACT_LITERAL")
    ) {
      context.addIssue({ code: "custom", message: "sensitive command must be withheld" });
    }
  } else if (value.commandTextOrNull !== null) {
    context.addIssue({ code: "custom", message: "withheld command prohibits text" });
  }
  if (
    value.commandTextState === "WITHHELD_SECRET_LIKE" &&
    !value.safetyIndicators.includes("CREDENTIAL_LITERAL")
  ) {
    context.addIssue({ code: "custom", message: "secret withholding requires indicator" });
  }
  if (
    value.commandTextState === "WITHHELD_PERSONAL_CONTACT" &&
    (!value.safetyIndicators.includes("PERSONAL_CONTACT_LITERAL") ||
      value.safetyIndicators.includes("CREDENTIAL_LITERAL"))
  ) {
    context.addIssue({ code: "custom", message: "contact withholding indicator mismatch" });
  }
});

const sourceIds = uniqueArray(sourceReferenceId).min(1);
const taxonomyBindingSchema = z.discriminatedUnion("mappingState", [
  strictObject({
    mappingState: z.literal("MATCHED"),
    taxonomyIdOrNull: trimmedString(200),
    taxonomyRegistryVersion: nonemptyId,
    taxonomyRegistryFingerprint: sha256,
  }),
  strictObject({
    mappingState: z.literal("TAXONOMY_CANDIDATE"),
    taxonomyIdOrNull: z.null(),
    taxonomyRegistryVersion: nonemptyId,
    taxonomyRegistryFingerprint: sha256,
  }),
]);

export const NameValueV1Schema = strictObject({
  normalizedName: trimmedString(200),
  displayName: trimmedString(200),
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedName === textKey(value.displayName), {
  message: "normalizedName mismatch",
});
export const AttributionCandidateV1Schema = strictObject({
  kind: z.enum(["CREATOR", "ORGANIZATION"]),
  displayName: trimmedString(200),
  normalizedHandleOrNull: trimmedString(200).nullable(),
  basis: z.enum([
    "SKILL_METADATA",
    "MANIFEST_AUTHOR",
    "MANIFEST_MAINTAINER",
    "SOURCE_DECLARATION",
    "PROVIDER_OWNER",
  ]),
  verificationState: z.literal("UNVERIFIED"),
  sourceReferenceIds: sourceIds,
}).refine(
  (value) =>
    value.normalizedHandleOrNull ===
    (value.displayName.startsWith("@") ? handleKey(value.displayName) : null),
  { message: "normalizedHandleOrNull mismatch" },
);
export const VersionValueV1Schema = strictObject({
  versionLabel: trimmedString(200),
  normalizedVersionOrNull: trimmedString(200).nullable(),
  versionSource: z.enum([
    "SEMVER_RELEASE",
    "GIT_TAG",
    "MANIFEST_VERSION",
    "SKILL_METADATA",
    "CHANGELOG",
    "AI_ARK_SNAPSHOT",
  ]),
  releaseChannel: z.enum([
    "ALPHA",
    "BETA",
    "RELEASE_CANDIDATE",
    "STABLE",
    "EXPERIMENTAL",
    "DEPRECATED",
    "ARCHIVED",
    "UNKNOWN",
  ]),
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedVersionOrNull === semverKey(value.versionLabel), {
  message: "normalizedVersionOrNull mismatch",
});
export const VersionResolutionV1Schema = strictObject({
  state: z.enum(["RESOLVED", "CONFLICTING", "FALLBACK", "REVIEW_REQUIRED"]),
  selectedOrNull: VersionValueV1Schema.nullable(),
  preferredCandidateIdOrNull: z.null(),
}).superRefine((value, context) => {
  const selected = value.selectedOrNull;
  if ((value.state === "RESOLVED" || value.state === "FALLBACK") !== (selected !== null)) {
    context.addIssue({ code: "custom", message: "version selection state mismatch" });
  }
  if (
    value.state === "FALLBACK" &&
    selected !== null &&
    (selected.versionSource !== "AI_ARK_SNAPSHOT" || selected.normalizedVersionOrNull !== null)
  ) {
    context.addIssue({ code: "custom", message: "invalid fallback" });
  }
});
export const SourceRevisionValueV1Schema = strictObject({
  provider: z.literal("GITHUB"),
  providerRepositoryId: trimmedString(200),
  sourceSnapshotId: nonemptyId,
  immutableRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  resourceVersionObservationId: nonemptyId,
  resourceSourceLinkId: nonemptyId,
  sourceReferenceIds: sourceIds,
});
export const LicenseValueV1Schema = strictObject({
  sourceReferenceIds: sourceIds,
  spdxExpressionOrNull: trimmedString(200).nullable(),
  customTextHashOrNull: sha256.nullable(),
})
  .refine(
    (value) => (value.spdxExpressionOrNull === null) !== (value.customTextHashOrNull === null),
  )
  .refine(
    (value) =>
      value.spdxExpressionOrNull === null ||
      canonicalizeSpdx(value.spdxExpressionOrNull) === value.spdxExpressionOrNull,
    { message: "spdxExpressionOrNull mismatch" },
  );
export const LicenseResolutionV1Schema = strictObject({
  state: z.enum(["CONFIRMED", "CONFLICTING", "MISSING", "CUSTOM", "AMBIGUOUS", "REVIEW_REQUIRED"]),
  selectedOrNull: LicenseValueV1Schema.nullable(),
  preferredCandidateIdOrNull: z.null(),
}).superRefine((value, context) => {
  const selectedRequired = value.state === "CONFIRMED" || value.state === "CUSTOM";
  if (selectedRequired !== (value.selectedOrNull !== null)) {
    context.addIssue({ code: "custom", message: "license selection state mismatch" });
  }
});
export const TaxonomyValueV1Schema = strictObject({
  label: trimmedString(200),
  normalizedLabel: trimmedString(200),
  sourceReferenceIds: sourceIds,
  mappingState: z.enum(["MATCHED", "TAXONOMY_CANDIDATE"]),
  taxonomyIdOrNull: trimmedString(200).nullable(),
  taxonomyRegistryVersion: nonemptyId,
  taxonomyRegistryFingerprint: sha256,
})
  .and(taxonomyBindingSchema)
  .refine((value) => value.normalizedLabel === textKey(value.label), {
    message: "normalizedLabel mismatch",
  });

export const SemanticProposalV1Schema = strictObject({
  text: trimmedString(1000),
  normalizedKey: trimmedString(1000),
  proposalKind: z.enum([
    "OUTCOME",
    "CAPABILITY",
    "TASK",
    "USE_CASE",
    "TARGET_USER",
    "BEST_FOR",
    "NOT_IDEAL_FOR",
  ]),
  targetFieldKey: z.enum([
    "outcome_candidate",
    "capabilities",
    "tasks",
    "use_cases",
    "target_user_candidates",
  ]),
  taxonomyBinding: taxonomyBindingSchema,
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedKey === textKey(value.text), {
  message: "semantic normalizedKey mismatch",
});

const semanticProposalFor = (
  proposalKind:
    "OUTCOME" | "CAPABILITY" | "TASK" | "USE_CASE" | "TARGET_USER" | "BEST_FOR" | "NOT_IDEAL_FOR",
  targetFieldKey:
    "outcome_candidate" | "capabilities" | "tasks" | "use_cases" | "target_user_candidates",
) =>
  SemanticProposalV1Schema.refine(
    (value) => value.proposalKind === proposalKind && value.targetFieldKey === targetFieldKey,
    { message: "semantic proposal field discriminator mismatch" },
  );

const CreatorAttributionCandidateV1Schema = AttributionCandidateV1Schema.refine(
  (value) => value.kind === "CREATOR",
  { message: "creator attribution kind mismatch" },
);
const OrganizationAttributionCandidateV1Schema = AttributionCandidateV1Schema.refine(
  (value) => value.kind === "ORGANIZATION",
  { message: "organization attribution kind mismatch" },
);
export const TargetUserResolutionV1Schema = strictObject({
  targetUsers: z.array(semanticProposalFor("TARGET_USER", "target_user_candidates")).max(256),
  bestFor: z.array(semanticProposalFor("BEST_FOR", "target_user_candidates")).max(256),
  notIdealFor: z.array(semanticProposalFor("NOT_IDEAL_FOR", "target_user_candidates")).max(256),
});
export const InstallationPathV1Schema = strictObject({
  ordinal: z.number().int().min(0).max(255),
  pathKind: z.enum(["EXPLICIT_COMMANDS", "INFERRED_MECHANISM"]),
  labelOrNull: trimmedString(200).nullable(),
  startConditionOrNull: trimmedString(1000).nullable(),
  inferredMechanismOrNull: trimmedString(1000).nullable(),
  prerequisites: z.array(trimmedString(1000)).max(256),
  commands: z.array(ExactCommandV1Schema).max(256),
  completionCueOrNull: trimmedString(1000).nullable(),
  sourceReferenceIds: sourceIds,
}).superRefine((value, context) => {
  const explicit = value.pathKind === "EXPLICIT_COMMANDS";
  if (
    explicit !== (value.inferredMechanismOrNull === null) ||
    (explicit && value.commands.length === 0) ||
    (!explicit &&
      (value.commands.length > 0 ||
        value.prerequisites.length > 0 ||
        value.startConditionOrNull !== null ||
        value.completionCueOrNull !== null))
  ) {
    context.addIssue({ code: "custom", message: "installation path shape mismatch" });
  }
});
export const InstallationResolutionV1Schema = strictObject({
  state: z.enum([
    "EXPLICIT_COMPLETE",
    "EXPLICIT_PARTIAL",
    "MULTIPLE_PATHS",
    "INFERRED",
    "MISSING",
    "UNSAFE_OR_AMBIGUOUS",
  ]),
  paths: z.array(InstallationPathV1Schema).max(256),
});
export const ConfigurationValueV1Schema = strictObject({
  name: trimmedString(200),
  normalizedName: trimmedString(200),
  requiredness: z.enum(["REQUIRED", "OPTIONAL", "UNKNOWN"]),
  valueKind: z.enum([
    "STRING",
    "NUMBER",
    "BOOLEAN",
    "PATH",
    "URL",
    "ENUM",
    "SECRET",
    "OBJECT",
    "ARRAY",
    "UNKNOWN",
  ]),
  secretSensitivity: z.enum(["SECRET", "POSSIBLY_SECRET", "NON_SECRET", "UNKNOWN"]),
  defaultPresent: z.boolean(),
  defaultValueOrNull: trimmedString(1000).nullable(),
  sourceReferenceIds: sourceIds,
}).superRefine((value, context) => {
  if (value.normalizedName !== textKey(value.name)) {
    context.addIssue({ code: "custom", message: "configuration normalizedName mismatch" });
  }
  const mayRetain = value.defaultPresent && value.secretSensitivity === "NON_SECRET";
  if ((!value.defaultPresent || !mayRetain) && value.defaultValueOrNull !== null) {
    context.addIssue({ code: "custom", message: "configuration default retention mismatch" });
  }
  if (mayRetain && value.defaultValueOrNull === null) {
    context.addIssue({ code: "custom", message: "non-sensitive present default required" });
  }
});
export const DependencyValueV1Schema = strictObject({
  kind: z.enum(["PACKAGE", "RUNTIME", "SYSTEM_BINARY", "PLUGIN_OR_EXTENSION", "UNKNOWN"]),
  ecosystemOrNull: z.enum(["NPM", "PYPI", "SYSTEM", "OTHER"]).nullable(),
  name: trimmedString(200),
  normalizedName: trimmedString(200),
  declaredConstraintOrNull: trimmedString(200).nullable(),
  scope: z.enum(["REQUIRED", "OPTIONAL", "DEVELOPMENT", "UNKNOWN"]),
  directness: z.literal("DIRECT_DECLARATION"),
  sourceReferenceIds: sourceIds,
})
  .refine((value) => isValidDependencyName(value.ecosystemOrNull, value.name), {
    message: "dependency name invalid for ecosystem",
  })
  .refine(
    (value) => value.normalizedName === normalizeDependencyName(value.ecosystemOrNull, value.name),
    { message: "dependency normalizedName mismatch" },
  );
export const ExternalServiceValueV1Schema = strictObject({
  serviceName: trimmedString(200),
  normalizedServiceName: trimmedString(200),
  basis: z.enum(["EXPLICIT_DECLARATION", "CONFIGURATION_INDICATOR", "STATIC_CODE_INDICATOR"]),
  requiredness: z.enum(["REQUIRED", "OPTIONAL", "UNKNOWN"]),
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedServiceName === textKey(value.serviceName), {
  message: "normalizedServiceName mismatch",
});
export const PermissionValueV1Schema = strictObject({
  kind: z.enum([
    "FILESYSTEM_READ",
    "FILESYSTEM_WRITE",
    "SHELL_EXECUTION",
    "PROCESS_CONTROL",
    "NETWORK_ACCESS",
    "ENVIRONMENT_READ",
    "SECRET_ACCESS",
    "DATABASE_ACCESS",
    "BROWSER_CONTROL",
    "EXTERNAL_SERVICE_ACCESS",
    "UNKNOWN",
  ]),
  evidenceLevel: z.enum(["EXPLICIT", "CODE_INDICATED", "INFERRED", "UNKNOWN"]),
  scopeOrNull: trimmedString(500).nullable(),
  absenceClaim: z.literal(false),
  sourceReferenceIds: sourceIds,
});
export const CompatibilityValueV1Schema = strictObject({
  subjectKind: z.enum(["PLATFORM", "RUNTIME", "HOST_TOOL", "FORMAT", "REGION", "UNKNOWN"]),
  subject: trimmedString(200),
  normalizedSubject: trimmedString(200),
  constraintOrNull: trimmedString(200).nullable(),
  evidenceClass: z.enum([
    "AI_ARK_TEST",
    "SOURCE_DECLARATION",
    "CREATOR_DECLARATION",
    "COMMUNITY_REPORT",
    "FORMAT_INFERENCE",
    "UNKNOWN",
  ]),
  support: z.enum(["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]),
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedSubject === textKey(value.subject), {
  message: "normalizedSubject mismatch",
});
export const LimitationValueV1Schema = strictObject({
  text: trimmedString(1000),
  normalizedKey: trimmedString(1000),
  kind: z.enum(["EXPLICIT_LIMITATION", "SYNTHESIZED_LIMITATION", "NOT_IDEAL_FOR"]),
  sourceAIProposalIdOrNull: proposalId.nullable(),
  sourceReferenceIds: sourceIds,
}).superRefine((value, context) => {
  if (value.normalizedKey !== textKey(value.text)) {
    context.addIssue({ code: "custom", message: "limitation normalizedKey mismatch" });
  }
  if ((value.kind === "EXPLICIT_LIMITATION") !== (value.sourceAIProposalIdOrNull === null)) {
    context.addIssue({ code: "custom", message: "limitation provenance mismatch" });
  }
});
export const LimitationProposalValueV1Schema = strictObject({
  text: trimmedString(1000),
  normalizedKey: trimmedString(1000),
  kind: z.enum(["SYNTHESIZED_LIMITATION", "NOT_IDEAL_FOR"]),
  sourceReferenceIds: sourceIds,
}).refine((value) => value.normalizedKey === textKey(value.text), {
  message: "limitation proposal normalizedKey mismatch",
});
export const MaintenanceSignalCandidateV1Schema = z.discriminatedUnion("kind", [
  strictObject({ kind: z.literal("ARCHIVED"), value: z.boolean(), sourceReferenceIds: sourceIds }),
  strictObject({
    kind: z.literal("PROVIDER_UPDATED_AT"),
    value: z.iso.datetime({ offset: true }),
    sourceReferenceIds: sourceIds,
  }),
  strictObject({
    kind: z.literal("MATCHING_RELEASE_OR_TAG_DATE"),
    value: z.iso.datetime({ offset: true }),
    sourceReferenceIds: sourceIds,
  }),
  strictObject({
    kind: z.literal("CHANGELOG_PRESENT"),
    value: z.boolean(),
    sourceReferenceIds: sourceIds,
  }),
  strictObject({
    kind: z.literal("CURRENT_CHANGELOG_ENTRY"),
    valueOrNull: trimmedString(200).nullable(),
    sourceReferenceIds: sourceIds,
  }),
  strictObject({
    kind: z.literal("EXPLICIT_DEPRECATION"),
    value: z.boolean(),
    sourceReferenceIds: sourceIds,
  }),
]);
export const MaintenanceSignalsV1Schema = strictObject({
  archived: z.boolean(),
  providerUpdatedAtOrNull: z.iso.datetime({ offset: true }).nullable(),
  matchingReleaseOrTagDateOrNull: z.iso.datetime({ offset: true }).nullable(),
  changelogPresent: z.boolean(),
  currentChangelogEntryOrNull: trimmedString(200).nullable(),
  explicitDeprecation: z.boolean().nullable(),
  predecessorMetadataComplete: z.boolean(),
  sourceReferenceIds: uniqueArray(sourceReferenceId),
}).refine((value) => value.changelogPresent || value.currentChangelogEntryOrNull === null);

export const ExtractionValueSchemaByFieldV1 = {
  canonical_skill_name: NameValueV1Schema.nullable(),
  creator_candidates: z.array(CreatorAttributionCandidateV1Schema).max(256),
  organization_candidates: z.array(OrganizationAttributionCandidateV1Schema).max(256),
  version: VersionResolutionV1Schema,
  source_revision: SourceRevisionValueV1Schema,
  license: LicenseResolutionV1Schema,
  categories: z.array(TaxonomyValueV1Schema).max(256),
  outcome_candidate: semanticProposalFor("OUTCOME", "outcome_candidate").nullable(),
  capabilities: z.array(semanticProposalFor("CAPABILITY", "capabilities")).max(256),
  tasks: z.array(semanticProposalFor("TASK", "tasks")).max(256),
  use_cases: z.array(semanticProposalFor("USE_CASE", "use_cases")).max(256),
  target_user_candidates: TargetUserResolutionV1Schema,
  installation: InstallationResolutionV1Schema,
  configuration: z.array(ConfigurationValueV1Schema).max(256),
  dependencies: z.array(DependencyValueV1Schema).max(256),
  external_services: z.array(ExternalServiceValueV1Schema).max(256),
  permissions: z.array(PermissionValueV1Schema).max(256),
  compatibility: z.array(CompatibilityValueV1Schema).max(256),
  limitations: z.array(LimitationValueV1Schema).max(256),
  maintenance_signals: MaintenanceSignalsV1Schema,
} as const;

const emptyValueByField: Partial<Record<(typeof M03_FIELD_KEYS)[number], unknown>> = {
  canonical_skill_name: null,
  creator_candidates: [],
  organization_candidates: [],
  license: { state: "MISSING", selectedOrNull: null, preferredCandidateIdOrNull: null },
  categories: [],
  outcome_candidate: null,
  capabilities: [],
  tasks: [],
  use_cases: [],
  target_user_candidates: { targetUsers: [], bestFor: [], notIdealFor: [] },
  installation: { state: "MISSING", paths: [] },
  configuration: [],
  dependencies: [],
  external_services: [],
  permissions: [],
  compatibility: [],
  limitations: [],
};

const baseFieldResultSchema = strictObject({
  fieldKey: M03FieldKeySchema,
  value: z.unknown(),
  status: z.enum([
    "EXPLICIT",
    "STRONGLY_SUPPORTED",
    "INFERRED",
    "CONFLICTING",
    "MISSING",
    "UNSUPPORTED",
    "REVIEW_REQUIRED",
  ]),
  claimClass: z.enum([
    "SOURCE_FACT",
    "REPOSITORY_METADATA",
    "STATIC_CODE_INDICATOR",
    "FORMAT_INFERENCE",
    "AI_INFERENCE",
    "MIXED_DETERMINISTIC_SUPPORT",
    "MIXED_SUPPORT",
    "NO_CLAIM",
  ]),
  confidence: z.number().min(0).max(1).nullable(),
  deterministicCandidateIds: uniqueArray(candidateId, 8192),
  aiProposalIds: uniqueArray(proposalId, 512),
  evidenceIds: uniqueArray(sourceReferenceId, 4096),
  conflictIds: uniqueArray(conflictId, 1024),
  warningCodes: uniqueArray(M03WarningCodeSchema, 29),
  extractorRefs: uniqueArray(extractorRefId, 128),
});

export const ExtractionFieldResultV1Schema = baseFieldResultSchema.superRefine((value, context) => {
  const fieldKey = value.fieldKey;
  const parsedValue = ExtractionValueSchemaByFieldV1[fieldKey].safeParse(value.value);
  if (!parsedValue.success) {
    context.addIssue({ code: "custom", message: `invalid ${fieldKey} value` });
    return;
  }
  const supports = value.deterministicCandidateIds.length + value.aiProposalIds.length;
  const exactReviewValue = (): boolean => {
    if (fieldKey === "version")
      return (
        JSON.stringify(value.value) ===
        JSON.stringify({
          state: "REVIEW_REQUIRED",
          selectedOrNull: null,
          preferredCandidateIdOrNull: null,
        })
      );
    if (fieldKey === "license")
      return (
        (
          value.value as {
            state?: unknown;
            selectedOrNull?: unknown;
            preferredCandidateIdOrNull?: unknown;
          }
        ).selectedOrNull === null &&
        (value.value as { preferredCandidateIdOrNull?: unknown }).preferredCandidateIdOrNull ===
          null &&
        ["AMBIGUOUS", "REVIEW_REQUIRED"].includes(
          String((value.value as { state?: unknown }).state),
        )
      );
    return (
      fieldKey in emptyValueByField &&
      JSON.stringify(value.value) === JSON.stringify(emptyValueByField[fieldKey])
    );
  };
  if (value.status === "MISSING" || value.status === "UNSUPPORTED") {
    if (
      !(fieldKey in emptyValueByField) ||
      JSON.stringify(value.value) !== JSON.stringify(emptyValueByField[fieldKey]) ||
      value.claimClass !== "NO_CLAIM" ||
      value.confidence !== null ||
      supports !== 0 ||
      value.evidenceIds.length !== 0 ||
      value.conflictIds.length !== 0 ||
      value.extractorRefs.length === 0 ||
      (value.status === "UNSUPPORTED" && value.warningCodes.length === 0)
    ) {
      context.addIssue({ code: "custom", message: "invalid empty field result" });
    }
  } else if (value.status === "EXPLICIT") {
    if (
      value.confidence !== 1 ||
      value.deterministicCandidateIds.length === 0 ||
      value.aiProposalIds.length !== 0 ||
      value.evidenceIds.length === 0 ||
      value.conflictIds.length !== 0 ||
      !["SOURCE_FACT", "REPOSITORY_METADATA", "STATIC_CODE_INDICATOR"].includes(value.claimClass)
    ) {
      context.addIssue({ code: "custom", message: "invalid explicit field result" });
    }
  } else if (value.status === "STRONGLY_SUPPORTED") {
    const validSupportMatrix =
      ((value.claimClass === "FORMAT_INFERENCE" ||
        value.claimClass === "STATIC_CODE_INDICATOR" ||
        value.claimClass === "MIXED_DETERMINISTIC_SUPPORT") &&
        value.deterministicCandidateIds.length > 0 &&
        value.aiProposalIds.length === 0) ||
      (value.claimClass === "AI_INFERENCE" &&
        value.deterministicCandidateIds.length === 0 &&
        value.aiProposalIds.length > 0) ||
      (value.claimClass === "MIXED_SUPPORT" &&
        value.deterministicCandidateIds.length > 0 &&
        value.aiProposalIds.length > 0);
    if (
      value.confidence === null ||
      value.confidence < 0.85 ||
      !validSupportMatrix ||
      value.evidenceIds.length === 0 ||
      value.conflictIds.length !== 0
    ) {
      context.addIssue({ code: "custom", message: "invalid supported field result" });
    }
  } else if (value.status === "INFERRED") {
    const validSupportMatrix =
      ((value.claimClass === "FORMAT_INFERENCE" ||
        value.claimClass === "STATIC_CODE_INDICATOR" ||
        value.claimClass === "MIXED_DETERMINISTIC_SUPPORT") &&
        value.deterministicCandidateIds.length > 0 &&
        value.aiProposalIds.length === 0) ||
      (value.claimClass === "AI_INFERENCE" &&
        value.deterministicCandidateIds.length === 0 &&
        value.aiProposalIds.length > 0) ||
      (value.claimClass === "MIXED_SUPPORT" &&
        value.deterministicCandidateIds.length > 0 &&
        value.aiProposalIds.length > 0);
    if (
      value.confidence === null ||
      value.confidence < 0.6 ||
      value.confidence >= 0.85 ||
      !validSupportMatrix ||
      value.evidenceIds.length === 0 ||
      value.conflictIds.length !== 0
    ) {
      context.addIssue({ code: "custom", message: "invalid inferred field result" });
    }
  } else if (value.status === "CONFLICTING") {
    if (
      value.confidence !== null ||
      supports < 2 ||
      value.evidenceIds.length === 0 ||
      value.conflictIds.length === 0 ||
      value.claimClass === "NO_CLAIM"
    ) {
      context.addIssue({ code: "custom", message: "invalid conflicting field result" });
    }
  } else {
    const deterministicReviewValue =
      fieldKey === "installation" || fieldKey === "maintenance_signals";
    const validReviewArm =
      value.claimClass === "NO_CLAIM"
        ? supports === 0 &&
          value.evidenceIds.length === 0 &&
          value.conflictIds.length === 0 &&
          exactReviewValue()
        : deterministicReviewValue &&
          value.deterministicCandidateIds.length > 0 &&
          value.aiProposalIds.length === 0 &&
          value.evidenceIds.length > 0 &&
          value.conflictIds.length === 0 &&
          [
            "SOURCE_FACT",
            "REPOSITORY_METADATA",
            "STATIC_CODE_INDICATOR",
            "FORMAT_INFERENCE",
            "MIXED_DETERMINISTIC_SUPPORT",
          ].includes(value.claimClass);
    if (
      value.confidence !== null ||
      value.warningCodes.length === 0 ||
      value.extractorRefs.length === 0 ||
      !validReviewArm
    ) {
      context.addIssue({ code: "custom", message: "invalid review field result" });
    }
  }
});

export function validateCompleteM03FieldSet(fields: readonly Readonly<{ fieldKey: string }>[]):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly errorCode: "FIELD_REGISTRY_INCOMPLETE" | "FIELD_SCHEMA_INVALID";
    } {
  if (fields.some(({ fieldKey }) => !M03_FIELD_KEYS.includes(fieldKey as never))) {
    return { ok: false, errorCode: "FIELD_SCHEMA_INVALID" };
  }
  const keys = fields.map(({ fieldKey }) => fieldKey);
  if (keys.length !== M03_FIELD_KEYS.length || new Set(keys).size !== M03_FIELD_KEYS.length) {
    return { ok: false, errorCode: "FIELD_REGISTRY_INCOMPLETE" };
  }
  return { ok: true };
}

export type ExtractionSourceReferenceV1 = z.infer<typeof ExtractionSourceReferenceV1Schema>;
export type ExactCommandV1 = z.infer<typeof ExactCommandV1Schema>;
export type InstallationPathV1 = z.infer<typeof InstallationPathV1Schema>;
export type PermissionValueV1 = z.infer<typeof PermissionValueV1Schema>;
export type ExtractionFieldResultV1 = z.infer<typeof ExtractionFieldResultV1Schema>;
