import { createHash } from "node:crypto";

import {
  canonicalJsonM03 as canonicalJsonContract,
  compareUnsignedUtf8,
  M03_ANALYSIS_SUB_OPERATIONS,
  M03_FIELD_KEYS,
  M03_WARNING_CODES,
  PermissionValueV1Schema,
  SemanticProposalV1Schema,
  type M03AnalysisSubOperation,
  type M03AnalysisAttemptV1,
  type M03FieldKey,
  type M03WarningCode,
} from "@ai-ark/contracts";

const fieldsByOperation: Readonly<Record<M03AnalysisSubOperation, readonly M03FieldKey[]>> = {
  NORMALIZE_CAPABILITIES: ["capabilities"],
  MAP_TASKS: ["tasks"],
  SYNTHESIZE_OUTCOME: ["outcome_candidate"],
  PROPOSE_USE_CASES: ["use_cases"],
  PROPOSE_TARGET_USERS: ["target_user_candidates"],
  SYNTHESIZE_BEST_FOR_NOT_IDEAL: ["target_user_candidates", "limitations"],
  SYNTHESIZE_LIMITATIONS: ["limitations"],
  INFER_PERMISSIONS_FROM_STATIC_EVIDENCE: ["permissions"],
  DETECT_AMBIGUITY: [
    "outcome_candidate",
    "capabilities",
    "tasks",
    "use_cases",
    "target_user_candidates",
    "permissions",
    "limitations",
  ],
};

export interface M03AnalysisCandidateInput {
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
}

export interface M03AnalysisConflictInput {
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
}

export interface M03AnalysisSourceReferenceInput {
  readonly id: string;
  readonly excerptHashOrNull: string | null;
  readonly excerptOrNull: string | null;
  readonly sensitive: boolean;
  readonly ownership: "CANDIDATE_OWNED" | "SHARED";
  readonly normalizedPath: string;
  readonly locatorCanonicalBytes: string;
  readonly candidateIndependentFor?: readonly M03AnalysisSubOperation[];
}

export interface OperationInputV1 {
  readonly subOperation: M03AnalysisSubOperation;
  readonly deterministicCandidates: readonly Omit<M03AnalysisCandidateInput, "id">[];
  readonly deterministicConflicts: readonly Omit<M03AnalysisConflictInput, "id">[];
  readonly allReferenceIds: readonly string[];
  readonly citableAIReferenceIds: readonly string[];
  readonly sourceInputs: readonly (
    | {
        readonly sourceReferenceId: string;
        readonly state: "SUPPLIED_EXCERPT";
        readonly excerptHash: string;
        readonly excerpt: string;
      }
    | { readonly sourceReferenceId: string; readonly state: "SUPPLIED_STRUCTURED" }
    | {
        readonly sourceReferenceId: string;
        readonly state: "OMITTED_BOUNDED" | "OMITTED_SENSITIVE" | "OMITTED_INVALID";
      }
  )[];
}

export function buildM03OperationInputs(input: {
  readonly subOperationPlan: readonly M03AnalysisSubOperation[];
  readonly deterministicCandidates: readonly M03AnalysisCandidateInput[];
  readonly deterministicConflicts: readonly M03AnalysisConflictInput[];
  readonly sourceReferences: readonly M03AnalysisSourceReferenceInput[];
}): readonly OperationInputV1[] {
  const referenceById = new Map(
    input.sourceReferences.map((reference) => [reference.id, reference]),
  );
  const canonicalCompare = (left: unknown, right: unknown) =>
    compareUnsignedUtf8(canonicalJson(left), canonicalJson(right));
  const partitions = input.subOperationPlan.map((subOperation) => {
    const fields = new Set(fieldsByOperation[subOperation]);
    const deterministicCandidates = input.deterministicCandidates
      .filter((candidate) => fields.has(candidate.fieldKey))
      .map((candidate) => ({
        fieldKey: candidate.fieldKey,
        value: candidate.value,
        normalizedKey: candidate.normalizedKey,
        extractorRefId: candidate.extractorRefId,
        supportNature: candidate.supportNature,
        claimClass: candidate.claimClass,
        sourceType: candidate.sourceType,
        sourceReferenceIds: candidate.sourceReferenceIds,
        confidence: candidate.confidence,
        warningCodes: candidate.warningCodes,
        candidateFingerprint: candidate.candidateFingerprint,
      }))
      .sort(canonicalCompare);
    const deterministicConflicts = input.deterministicConflicts
      .filter((conflict) => fields.has(conflict.fieldKey))
      .map((conflict) => ({
        fieldKey: conflict.fieldKey,
        reasonCode: conflict.reasonCode,
        candidateIds: conflict.candidateIds,
        aiProposalIds: conflict.aiProposalIds,
        preferredCandidateIdOrNull: conflict.preferredCandidateIdOrNull,
        preferenceIsNonCanonicalGuidance: conflict.preferenceIsNonCanonicalGuidance,
        sourceReferenceIds: conflict.sourceReferenceIds,
      }))
      .sort(canonicalCompare);
    const candidateBackedIds = new Set([
      ...deterministicCandidates.flatMap((candidate) => candidate.sourceReferenceIds),
      ...deterministicConflicts.flatMap((conflict) => conflict.sourceReferenceIds),
    ]);
    const reachable = new Set([
      ...deterministicCandidates.flatMap((candidate) => candidate.sourceReferenceIds),
      ...deterministicConflicts.flatMap((conflict) => conflict.sourceReferenceIds),
      ...input.sourceReferences
        .filter((reference) =>
          subOperation === "DETECT_AMBIGUITY"
            ? (reference.candidateIndependentFor?.length ?? 0) > 0
            : reference.candidateIndependentFor?.includes(subOperation) === true,
        )
        .map((reference) => reference.id),
    ]);
    return {
      subOperation,
      deterministicCandidates,
      deterministicConflicts,
      candidateBackedIds,
      reachable,
    };
  });
  const occurrences = partitions
    .flatMap((partition) =>
      [...partition.reachable].map((sourceReferenceId) => {
        const reference = referenceById.get(sourceReferenceId);
        const fieldOrdinals = [
          ...partition.deterministicCandidates
            .filter((candidate) => candidate.sourceReferenceIds.includes(sourceReferenceId))
            .map((candidate) => M03_FIELD_KEYS.indexOf(candidate.fieldKey)),
          ...partition.deterministicConflicts
            .filter((conflict) => conflict.sourceReferenceIds.includes(sourceReferenceId))
            .map((conflict) => M03_FIELD_KEYS.indexOf(conflict.fieldKey)),
          ...(reference?.candidateIndependentFor ?? [])
            .filter((operation) => operation !== "DETECT_AMBIGUITY")
            .flatMap((operation) => fieldsByOperation[operation])
            .map((fieldKey) => M03_FIELD_KEYS.indexOf(fieldKey)),
        ].filter((ordinal) => ordinal >= 0);
        return {
          partition,
          sourceReferenceId,
          reference,
          minimumOwningFieldOrdinal:
            fieldOrdinals.length === 0 ? M03_FIELD_KEYS.length : Math.min(...fieldOrdinals),
        };
      }),
    )
    .sort((left, right) => {
      const leftReference = left.reference;
      const rightReference = right.reference;
      return (
        left.minimumOwningFieldOrdinal - right.minimumOwningFieldOrdinal ||
        Number(rightReference?.ownership === "CANDIDATE_OWNED") -
          Number(leftReference?.ownership === "CANDIDATE_OWNED") ||
        compareUnsignedUtf8(
          leftReference?.normalizedPath ?? "",
          rightReference?.normalizedPath ?? "",
        ) ||
        compareUnsignedUtf8(
          leftReference?.locatorCanonicalBytes ?? "",
          rightReference?.locatorCanonicalBytes ?? "",
        ) ||
        compareUnsignedUtf8(left.sourceReferenceId, right.sourceReferenceId) ||
        input.subOperationPlan.indexOf(left.partition.subOperation) -
          input.subOperationPlan.indexOf(right.partition.subOperation)
      );
    });
  let totalExcerptCharacters = 0;
  const excerptsByPartition = new Map<M03AnalysisSubOperation, number>();
  const selected = new Map<string, OperationInputV1["sourceInputs"][number]>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.partition.subOperation}\u0000${occurrence.sourceReferenceId}`;
    const reference = occurrence.reference;
    let sourceInput: OperationInputV1["sourceInputs"][number];
    if (!reference)
      sourceInput = { sourceReferenceId: occurrence.sourceReferenceId, state: "OMITTED_INVALID" };
    else if (reference.sensitive)
      sourceInput = { sourceReferenceId: occurrence.sourceReferenceId, state: "OMITTED_SENSITIVE" };
    else if (reference.excerptOrNull !== null && reference.excerptHashOrNull !== null) {
      const characters = Array.from(reference.excerptOrNull).length;
      const supplied = excerptsByPartition.get(occurrence.partition.subOperation) ?? 0;
      if (characters > 2000 || supplied >= 64 || totalExcerptCharacters + characters > 64000)
        sourceInput = { sourceReferenceId: occurrence.sourceReferenceId, state: "OMITTED_BOUNDED" };
      else {
        excerptsByPartition.set(occurrence.partition.subOperation, supplied + 1);
        totalExcerptCharacters += characters;
        sourceInput = {
          sourceReferenceId: occurrence.sourceReferenceId,
          state: "SUPPLIED_EXCERPT",
          excerptHash: reference.excerptHashOrNull,
          excerpt: reference.excerptOrNull,
        };
      }
    } else if (occurrence.partition.candidateBackedIds.has(occurrence.sourceReferenceId))
      sourceInput = {
        sourceReferenceId: occurrence.sourceReferenceId,
        state: "SUPPLIED_STRUCTURED",
      };
    else
      sourceInput = { sourceReferenceId: occurrence.sourceReferenceId, state: "OMITTED_INVALID" };
    selected.set(key, sourceInput);
  }
  return partitions.map((partition) => {
    const sourceInputs = [...partition.reachable]
      .sort(compareUnsignedUtf8)
      .map((sourceReferenceId) =>
        selected.get(`${partition.subOperation}\u0000${sourceReferenceId}`),
      )
      .filter((value): value is OperationInputV1["sourceInputs"][number] => value !== undefined);
    return {
      subOperation: partition.subOperation,
      deterministicCandidates: partition.deterministicCandidates,
      deterministicConflicts: partition.deterministicConflicts,
      allReferenceIds: sourceInputs.map(({ sourceReferenceId }) => sourceReferenceId),
      citableAIReferenceIds: sourceInputs
        .filter(({ state }) => state === "SUPPLIED_EXCERPT" || state === "SUPPLIED_STRUCTURED")
        .map(({ sourceReferenceId }) => sourceReferenceId),
      sourceInputs,
    };
  });
}

function canonicalJson(value: unknown): string {
  return canonicalJsonContract(value);
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

const rejectedOutputPatterns = [
  /\b(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret|private[_-]?key)\b\s*[:=]\s*[^\s]+/iu,
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/iu,
  /\bsk-[A-Za-z0-9_-]{20,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/iu,
  /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}(?![A-Za-z0-9.-])/iu,
  /(?<![0-9])(?:\+[0-9]{1,3}[ .-]?)?(?:\(?[0-9]{2,4}\)?[ .-]?){2,4}[0-9]{3,4}(?![0-9])/iu,
  /\b(verified|independently verified)\b/iu,
  /\b(guaranteed|guarantees)\b/iu,
  /\bproduction[- ]ready\b/iu,
  /\b(proven secure|completely safe|security audited)\b/iu,
  /\b(best[- ]in[- ]class|unmatched|unbeatable)\b/iu,
] as const;

function containsRejectedOutputText(value: unknown): boolean {
  if (typeof value === "string")
    return rejectedOutputPatterns.some((pattern) => pattern.test(value));
  if (Array.isArray(value)) return value.some((member) => containsRejectedOutputText(member));
  if (value !== null && typeof value === "object") {
    const sourceDerivedKeys = new Set(["text", "normalizedKey", "scopeOrNull"]);
    return Object.entries(value as Readonly<Record<string, unknown>>).some(
      ([key, member]) => sourceDerivedKeys.has(key) && containsRejectedOutputText(member),
    );
  }
  return false;
}

const proposalKeys = [
  "kind",
  "localOrdinal",
  "subOperation",
  "targetFieldKey",
  "value",
  "confidence",
  "claimClass",
  "sourceReferenceIds",
  "warningCodes",
] as const;

const ambiguityKeys = [
  "kind",
  "localOrdinal",
  "subOperation",
  "targetFieldKey",
  "reason",
  "candidateIds",
  "interpretedProposalOrdinals",
  "confidence",
  "sourceReferenceIds",
  "warningCodes",
] as const;

const proposalMapping = {
  NORMALIZE_CAPABILITIES: { targetFieldKey: "capabilities", proposalKinds: ["CAPABILITY"] },
  MAP_TASKS: { targetFieldKey: "tasks", proposalKinds: ["TASK"] },
  SYNTHESIZE_OUTCOME: { targetFieldKey: "outcome_candidate", proposalKinds: ["OUTCOME"] },
  PROPOSE_USE_CASES: { targetFieldKey: "use_cases", proposalKinds: ["USE_CASE"] },
  PROPOSE_TARGET_USERS: {
    targetFieldKey: "target_user_candidates",
    proposalKinds: ["TARGET_USER"],
  },
  SYNTHESIZE_BEST_FOR_NOT_IDEAL: {
    targetFieldKey: "target_user_candidates",
    proposalKinds: ["BEST_FOR", "NOT_IDEAL_FOR"],
  },
  SYNTHESIZE_LIMITATIONS: {
    targetFieldKey: "limitations",
    proposalKinds: ["SYNTHESIZED_LIMITATION"],
  },
  INFER_PERMISSIONS_FROM_STATIC_EVIDENCE: { targetFieldKey: "permissions", proposalKinds: [] },
} as const;

function invalidAttempt(
  input: ValidationInput,
  outputFingerprint: string,
  invalidityClass: "SYNTACTIC_OR_SCHEMA_SHAPE" | "SEMANTIC_OR_POLICY",
) {
  const identity = invocationIdentity(input);
  const resultIdentity = {
    invocationId: identity.invocationId,
    status: "INVALID_OUTPUT",
    outputFingerprintOrNull: outputFingerprint,
    safeErrorCodeOrNull: "ANALYSIS_OUTPUT_INVALID",
    invalidityClassOrNull: invalidityClass,
  };
  return {
    status: "INVALID_OUTPUT" as const,
    repairable: invalidityClass === "SYNTACTIC_OR_SCHEMA_SHAPE",
    attempt: {
      ...identity,
      id: `ana_${sha256(canonicalJson(resultIdentity))}`,
      providerRequestIdOrNull: null,
      tokenCountsOrNull: null,
      durationMsOrNull: null,
      status: "INVALID_OUTPUT" as const,
      outputFingerprintOrNull: outputFingerprint,
      safeErrorCodeOrNull: "ANALYSIS_OUTPUT_INVALID" as const,
      invalidityClass,
    },
  };
}

function limitAttempt(input: ValidationInput, outputFingerprint: string) {
  const identity = invocationIdentity(input);
  const resultIdentity = {
    invocationId: identity.invocationId,
    status: "LIMIT_EXCEEDED",
    outputFingerprintOrNull: outputFingerprint,
    safeErrorCodeOrNull: "ANALYSIS_LIMIT_EXCEEDED",
    invalidityClassOrNull: "LIMIT",
  };
  return {
    status: "LIMIT_EXCEEDED" as const,
    repairable: false,
    attempt: {
      ...identity,
      id: `ana_${sha256(canonicalJson(resultIdentity))}`,
      providerRequestIdOrNull: null,
      tokenCountsOrNull: null,
      durationMsOrNull: null,
      status: "LIMIT_EXCEEDED" as const,
      outputFingerprintOrNull: outputFingerprint,
      safeErrorCodeOrNull: "ANALYSIS_LIMIT_EXCEEDED" as const,
      invalidityClass: "LIMIT" as const,
    },
  };
}

interface ValidationInput {
  readonly extractionInputFingerprint: string;
  readonly analysisConfigurationFingerprint: string;
  readonly extractorRefId: string;
  readonly fieldRegistryVersion: string;
  readonly rawAnalysisSchemaVersion: string;
  readonly analysisBundleVersion: string;
  readonly subOperationPlan: readonly M03AnalysisSubOperation[];
  readonly operationInputs: readonly OperationInputV1[];
  readonly deterministicCandidates: readonly M03AnalysisCandidateInput[];
  readonly ordinal: 0 | 1;
  readonly purpose: "PRIMARY" | "SYNTACTIC_REPAIR";
  readonly priorInvalidOutputFingerprintOrNull: string | null;
  readonly rawResponseBytes: Uint8Array;
  readonly fingerprintRawOutput?: (bytes: Uint8Array) => string;
  readonly fingerprintAnalysisInput?: (canonicalBytes: string) => string;
  readonly deriveInvocationId?: (canonicalBytes: string) => string;
}

function invocationIdentity(input: ValidationInput) {
  const analysisInputPreimage = canonicalJson({
    analysisBundleVersion: input.analysisBundleVersion,
    extractionInputFingerprint: input.extractionInputFingerprint,
    purpose: input.purpose,
    priorInvalidOutputFingerprintOrNull: input.priorInvalidOutputFingerprintOrNull,
    fieldRegistryVersion: input.fieldRegistryVersion,
    rawAnalysisSchemaVersion: input.rawAnalysisSchemaVersion,
    subOperationPlan: input.subOperationPlan,
    operationInputs: input.operationInputs,
    bundleLimitDeclaration: {
      excerptsPerPartition: 64,
      charactersPerExcerpt: 2000,
      totalExcerptCharacters: 64000,
    },
  });
  const analysisInputFingerprint =
    input.fingerprintAnalysisInput?.(analysisInputPreimage) ?? sha256(analysisInputPreimage);
  const invocationPreimage = canonicalJson({
    extractionInputFingerprint: input.extractionInputFingerprint,
    analysisInputFingerprint,
    ordinal: input.ordinal,
    purpose: input.purpose,
    analysisConfigurationFingerprint: input.analysisConfigurationFingerprint,
  });
  const invocationId = `ain_${input.deriveInvocationId?.(invocationPreimage) ?? sha256(invocationPreimage)}`;
  return {
    invocationId,
    ordinal: input.ordinal,
    purpose: input.purpose,
    analysisConfigurationFingerprint: input.analysisConfigurationFingerprint,
    extractionInputFingerprint: input.extractionInputFingerprint,
    analysisInputFingerprint,
  };
}

export function createM03TransportFailureAttempt(
  input: Omit<ValidationInput, "rawResponseBytes">,
  status: "TIMED_OUT" | "FAILED",
): M03AnalysisAttemptV1 {
  const identity = invocationIdentity({ ...input, rawResponseBytes: new Uint8Array() });
  const resultIdentity = {
    invocationId: identity.invocationId,
    status,
    outputFingerprintOrNull: null,
    safeErrorCodeOrNull: status === "TIMED_OUT" ? "ANALYSIS_TIMED_OUT" : "ANALYSIS_FAILED",
    invalidityClassOrNull: null,
  };
  const base = {
    ...identity,
    id: `ana_${sha256(canonicalJson(resultIdentity))}`,
    providerRequestIdOrNull: null,
    tokenCountsOrNull: null,
    durationMsOrNull: null,
    outputFingerprintOrNull: null,
  } as const;
  return status === "TIMED_OUT"
    ? { ...base, status, safeErrorCodeOrNull: "ANALYSIS_TIMED_OUT" }
    : { ...base, status, safeErrorCodeOrNull: "ANALYSIS_FAILED" };
}

export function validateM03RawAnalysisResponse(input: ValidationInput):
  | ReturnType<typeof invalidAttempt>
  | ReturnType<typeof limitAttempt>
  | {
      readonly status: "SUCCEEDED";
      readonly repairable: false;
      readonly attempt: M03AnalysisAttemptV1;
      readonly proposals: readonly Readonly<Record<string, unknown>>[];
    } {
  const outputFingerprint =
    input.fingerprintRawOutput?.(input.rawResponseBytes) ?? sha256(input.rawResponseBytes);
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(input.rawResponseBytes).toString("utf8"));
  } catch {
    return invalidAttempt(input, outputFingerprint, "SYNTACTIC_OR_SCHEMA_SHAPE");
  }
  if (
    decoded === null ||
    typeof decoded !== "object" ||
    Array.isArray(decoded) ||
    !exactKeys(decoded as Record<string, unknown>, ["schemaVersion", "proposals"]) ||
    (decoded as { schemaVersion?: unknown }).schemaVersion !== "m03-analysis-raw-v1" ||
    !Array.isArray((decoded as { proposals?: unknown }).proposals)
  ) {
    return invalidAttempt(input, outputFingerprint, "SYNTACTIC_OR_SCHEMA_SHAPE");
  }
  const rawProposals = (decoded as { proposals: unknown[] }).proposals;
  if (rawProposals.length > 512) {
    return limitAttempt(input, outputFingerprint);
  }
  const validated: Readonly<Record<string, unknown>>[] = [];
  const ambiguities: Readonly<Record<string, unknown>>[] = [];
  for (let index = 0; index < rawProposals.length; index += 1) {
    const raw = rawProposals[index];
    if (
      raw === null ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      (raw as { localOrdinal?: unknown }).localOrdinal !== index
    ) {
      return invalidAttempt(input, outputFingerprint, "SYNTACTIC_OR_SCHEMA_SHAPE");
    }
    const kind = (raw as { kind?: unknown }).kind;
    if (kind === "AMBIGUITY_SIGNAL") {
      if (!exactKeys(raw as Record<string, unknown>, ambiguityKeys))
        return invalidAttempt(input, outputFingerprint, "SYNTACTIC_OR_SCHEMA_SHAPE");
      const ambiguity = raw as Record<string, unknown>;
      if (
        ambiguity.subOperation !== "DETECT_AMBIGUITY" ||
        !fieldsByOperation.DETECT_AMBIGUITY.includes(ambiguity.targetFieldKey as M03FieldKey) ||
        !["LOW_CONFIDENCE", "MULTIPLE_INTERPRETATIONS", "DETERMINISTIC_AI_DISAGREEMENT"].includes(
          String(ambiguity.reason),
        ) ||
        ambiguity.confidence !== 1 ||
        !Array.isArray(ambiguity.candidateIds) ||
        new Set(ambiguity.candidateIds).size !== ambiguity.candidateIds.length ||
        !Array.isArray(ambiguity.interpretedProposalOrdinals) ||
        new Set(ambiguity.interpretedProposalOrdinals).size !==
          ambiguity.interpretedProposalOrdinals.length ||
        (ambiguity.interpretedProposalOrdinals as unknown[]).some(
          (ordinal) =>
            !Number.isInteger(ordinal) || (ordinal as number) < 0 || (ordinal as number) > 511,
        ) ||
        !Array.isArray(ambiguity.sourceReferenceIds) ||
        ambiguity.sourceReferenceIds.length === 0 ||
        new Set(ambiguity.sourceReferenceIds).size !== ambiguity.sourceReferenceIds.length ||
        !Array.isArray(ambiguity.warningCodes) ||
        ambiguity.warningCodes.length !== 0
      ) {
        return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
      }
      ambiguities.push(ambiguity);
      continue;
    }
    if (kind !== "FIELD_PROPOSAL" || !exactKeys(raw as Record<string, unknown>, proposalKeys))
      return invalidAttempt(input, outputFingerprint, "SYNTACTIC_OR_SCHEMA_SHAPE");
    const proposal = raw as Record<string, unknown>;
    const proposalText =
      proposal.value !== null && typeof proposal.value === "object"
        ? (proposal.value as { text?: unknown }).text
        : undefined;
    if (typeof proposalText === "string" && Array.from(proposalText).length > 1000)
      return limitAttempt(input, outputFingerprint);
    if (containsRejectedOutputText(proposal.value))
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    const subOperation = proposal.subOperation;
    if (
      typeof subOperation !== "string" ||
      subOperation === "DETECT_AMBIGUITY" ||
      !(subOperation in proposalMapping) ||
      proposal.claimClass !== "AI_INFERENCE" ||
      typeof proposal.confidence !== "number" ||
      proposal.confidence < 0 ||
      proposal.confidence > 1 ||
      !Array.isArray(proposal.sourceReferenceIds) ||
      proposal.sourceReferenceIds.length === 0 ||
      new Set(proposal.sourceReferenceIds).size !== proposal.sourceReferenceIds.length ||
      canonicalJsonContract(proposal.sourceReferenceIds) !==
        canonicalJsonContract(
          [...(proposal.sourceReferenceIds as string[])].sort(compareUnsignedUtf8),
        ) ||
      !Array.isArray(proposal.warningCodes) ||
      proposal.warningCodes.some((warning) => !M03_WARNING_CODES.includes(warning as never))
    ) {
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    }
    const mapping = proposalMapping[subOperation as keyof typeof proposalMapping];
    const partition = input.operationInputs.find(
      (operation) => operation.subOperation === subOperation,
    );
    if (
      proposal.targetFieldKey !== mapping.targetFieldKey ||
      !partition ||
      (proposal.sourceReferenceIds as unknown[]).some(
        (reference) =>
          typeof reference !== "string" || !partition.citableAIReferenceIds.includes(reference),
      )
    ) {
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    }
    let requiresTaxonomyCandidate = false;
    if (subOperation === "INFER_PERMISSIONS_FROM_STATIC_EVIDENCE") {
      const parsed = PermissionValueV1Schema.safeParse(proposal.value);
      if (!parsed.success || parsed.data.evidenceLevel !== "INFERRED")
        return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    } else if (subOperation === "SYNTHESIZE_LIMITATIONS") {
      const value = proposal.value as Record<string, unknown> | null;
      if (
        value === null ||
        typeof value !== "object" ||
        value.kind !== "SYNTHESIZED_LIMITATION" ||
        value.sourceAIProposalIdOrNull !== undefined
      )
        return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    } else {
      const parsed = SemanticProposalV1Schema.safeParse(proposal.value);
      if (
        !parsed.success ||
        !mapping.proposalKinds.includes(parsed.data.proposalKind as never) ||
        parsed.data.targetFieldKey !== mapping.targetFieldKey ||
        JSON.stringify(parsed.data.sourceReferenceIds) !==
          JSON.stringify(proposal.sourceReferenceIds)
      ) {
        return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
      }
      requiresTaxonomyCandidate = parsed.data.taxonomyBinding.mappingState === "TAXONOMY_CANDIDATE";
    }
    const requiresLow = proposal.confidence < 0.6;
    const expectedWarnings = [
      ...(requiresTaxonomyCandidate ? (["TAXONOMY_CANDIDATE"] as const) : []),
      ...(requiresLow ? (["LOW_CONFIDENCE"] as const) : []),
    ];
    if (canonicalJsonContract(proposal.warningCodes) !== canonicalJsonContract(expectedWarnings))
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    validated.push(proposal);
  }
  const identity = invocationIdentity(input);
  const resultIdentity = {
    invocationId: identity.invocationId,
    status: "SUCCEEDED",
    outputFingerprintOrNull: outputFingerprint,
    safeErrorCodeOrNull: null,
    invalidityClassOrNull: null,
  };
  const attempt = {
    ...identity,
    id: `ana_${sha256(canonicalJson(resultIdentity))}`,
    providerRequestIdOrNull: null,
    tokenCountsOrNull: null,
    durationMsOrNull: null,
    status: "SUCCEEDED" as const,
    outputFingerprintOrNull: outputFingerprint,
    safeErrorCodeOrNull: null,
  };
  const proposals = validated.map((proposal) => {
    const finalPayload = {
      kind: "FIELD_PROPOSAL" as const,
      extractorRefId: input.extractorRefId,
      subOperation: proposal.subOperation,
      targetFieldKey: proposal.targetFieldKey,
      value: proposal.value,
      confidence: proposal.confidence,
      claimClass: proposal.claimClass,
      sourceReferenceIds: proposal.sourceReferenceIds,
      warningCodes: proposal.warningCodes,
    };
    const proposalFingerprint = sha256(canonicalJson(finalPayload));
    return {
      ...finalPayload,
      id: `aip_${sha256(canonicalJson({ analysisAttemptId: attempt.id, proposalFingerprint }))}`,
      analysisAttemptId: attempt.id,
      proposalFingerprint,
      rawLocalOrdinal: proposal.localOrdinal,
    };
  });
  if (new Set(proposals.map(({ id }) => id)).size !== proposals.length)
    return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
  const finalByOrdinal = new Map(
    proposals.map((proposal) => [proposal.rawLocalOrdinal as number, proposal]),
  );
  const candidateById = new Map(
    input.deterministicCandidates.map((candidate) => [candidate.id, candidate]),
  );
  const finalAmbiguities: Readonly<Record<string, unknown>>[] = [];
  const ambiguityCanonicalByField = new Map<M03FieldKey, string>();
  const ambiguityPartition = input.operationInputs.find(
    ({ subOperation }) => subOperation === "DETECT_AMBIGUITY",
  );
  for (const ambiguity of ambiguities) {
    const targetFieldKey = ambiguity.targetFieldKey as M03FieldKey;
    const interpreted = (ambiguity.interpretedProposalOrdinals as number[]).map((ordinal) =>
      finalByOrdinal.get(ordinal),
    );
    const candidates = (ambiguity.candidateIds as string[]).map((id) => candidateById.get(id));
    if (
      interpreted.some((proposal) => proposal === undefined) ||
      candidates.some((candidate) => candidate === undefined) ||
      interpreted.some((proposal) => proposal?.targetFieldKey !== targetFieldKey) ||
      candidates.some((candidate) => candidate?.fieldKey !== targetFieldKey)
    ) {
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    }
    const concreteProposals = interpreted.filter((proposal) => proposal !== undefined);
    const concreteCandidates = candidates.filter((candidate) => candidate !== undefined);
    const reason = String(ambiguity.reason);
    const interpretations = new Set(
      concreteProposals.map((proposal) =>
        canonicalJson({
          targetFieldKey: proposal.targetFieldKey,
          subOperation: proposal.subOperation,
          value: proposal.value,
        }),
      ),
    );
    const validTruthTable =
      (reason === "LOW_CONFIDENCE" &&
        concreteCandidates.length === 0 &&
        concreteProposals.length === 1 &&
        (concreteProposals[0]?.confidence as number) < 0.6) ||
      (reason === "MULTIPLE_INTERPRETATIONS" &&
        concreteCandidates.length === 0 &&
        !ambiguityPartition?.deterministicCandidates.some(
          (candidate) => candidate.fieldKey === targetFieldKey,
        ) &&
        !ambiguityPartition?.deterministicConflicts.some(
          (conflict) => conflict.fieldKey === targetFieldKey,
        ) &&
        concreteProposals.length >= 2 &&
        interpretations.size >= 2) ||
      (reason === "DETERMINISTIC_AI_DISAGREEMENT" &&
        concreteCandidates.length >= 1 &&
        concreteProposals.length >= 1);
    const expectedReferences = [
      ...new Set([
        ...concreteCandidates.flatMap(({ sourceReferenceIds }) => sourceReferenceIds),
        ...concreteProposals.flatMap((proposal) => proposal.sourceReferenceIds as string[]),
      ]),
    ].sort();
    if (
      !validTruthTable ||
      canonicalJson(ambiguity.candidateIds) !==
        canonicalJson([...(ambiguity.candidateIds as string[])].sort()) ||
      canonicalJson(ambiguity.interpretedProposalOrdinals) !==
        canonicalJson(
          [...(ambiguity.interpretedProposalOrdinals as number[])].sort(
            (left, right) => left - right,
          ),
        ) ||
      canonicalJson(ambiguity.sourceReferenceIds) !== canonicalJson(expectedReferences)
    ) {
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    }
    const ambiguityCanonical = canonicalJson(
      Object.fromEntries(Object.entries(ambiguity).filter(([key]) => key !== "localOrdinal")),
    );
    const existingAmbiguityCanonical = ambiguityCanonicalByField.get(targetFieldKey);
    if (
      existingAmbiguityCanonical !== undefined &&
      existingAmbiguityCanonical !== ambiguityCanonical
    )
      return invalidAttempt(input, outputFingerprint, "SEMANTIC_OR_POLICY");
    ambiguityCanonicalByField.set(targetFieldKey, ambiguityCanonical);
    const finalPayload = {
      kind: "AMBIGUITY_SIGNAL" as const,
      extractorRefId: input.extractorRefId,
      subOperation: "DETECT_AMBIGUITY" as const,
      targetFieldKey,
      reason,
      candidateIds: ambiguity.candidateIds,
      interpretedAIProposalIds: concreteProposals.map(({ id }) => id).sort(),
      confidence: 1,
      sourceReferenceIds: expectedReferences,
      warningCodes: [] as readonly string[],
    };
    const proposalFingerprint = sha256(canonicalJson(finalPayload));
    finalAmbiguities.push({
      ...finalPayload,
      id: `aip_${sha256(canonicalJson({ analysisAttemptId: attempt.id, proposalFingerprint }))}`,
      analysisAttemptId: attempt.id,
      proposalFingerprint,
    });
  }
  const finalFields = proposals.map((proposal) =>
    Object.fromEntries(Object.entries(proposal).filter(([key]) => key !== "rawLocalOrdinal")),
  );
  const uniqueFinalAmbiguities = [
    ...new Map(finalAmbiguities.map((ambiguity) => [String(ambiguity.id), ambiguity])).values(),
  ];
  const finalProposals = [...finalFields, ...uniqueFinalAmbiguities].sort((left, right) => {
    const leftField = M03_FIELD_KEYS.indexOf(left.targetFieldKey as M03FieldKey);
    const rightField = M03_FIELD_KEYS.indexOf(right.targetFieldKey as M03FieldKey);
    const leftOperation = M03_ANALYSIS_SUB_OPERATIONS.indexOf(
      left.subOperation as M03AnalysisSubOperation,
    );
    const rightOperation = M03_ANALYSIS_SUB_OPERATIONS.indexOf(
      right.subOperation as M03AnalysisSubOperation,
    );
    const leftKind = left.kind === "FIELD_PROPOSAL" ? 0 : 1;
    const rightKind = right.kind === "FIELD_PROPOSAL" ? 0 : 1;
    return (
      leftField - rightField ||
      leftOperation - rightOperation ||
      leftKind - rightKind ||
      Buffer.from(canonicalJson(left)).compare(Buffer.from(canonicalJson(right))) ||
      compareUnsignedUtf8(String(left.id), String(right.id))
    );
  });
  return {
    status: "SUCCEEDED",
    repairable: false,
    attempt,
    proposals: finalProposals,
  };
}
