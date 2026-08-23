import { createHash } from "node:crypto";

import { canonicalM02JsonBytes, type CanonicalM02Value } from "@ai-ark/classification";
import { createExternalIdentifierKey } from "@ai-ark/identity";
import type { Pool, PoolClient } from "pg";

import { allocateM02Id } from "./m02-human-command-plan.js";
import { canonicalGuard, type CanonicalGuardIdentity } from "./m02-human-projectors.js";

export const SYSTEM_IDENTITY_PROJECTOR_MODE_IDS = [
  "S1_R0_JC",
  "S1_R0_JR",
  "S1_R1_JC",
  "S1_R1_JR",
  "S2_JC",
  "S2_JR",
  "S3_JC",
  "S3_JR",
  "S4_R0_JC",
  "S4_R0_JR",
  "S4_R1_JC",
  "S4_R1_JR",
  "S5_R0_JC",
  "S5_R0_JR",
  "S5_R1_JC",
  "S5_R1_JR",
  "S6_JR",
  "S7_JR",
  "S8_JR",
  "S9_JC",
  "S9_JR",
  "S10_JR",
] as const;

export type SystemIdentityProjectorModeId = (typeof SYSTEM_IDENTITY_PROJECTOR_MODE_IDS)[number];

export type IdentityTierV1 = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
export type IdentityTierDispositionV1 =
  "MATCH" | "NO_MATCH" | "CONFLICT" | "MULTIPLE_TARGETS" | "NOT_APPLICABLE";
export type IdentitySignalTypeV1 =
  | "P1_ACTIVE_SOURCE_LINK"
  | "P2_TRUSTED_EXTERNAL_IDENTIFIER"
  | "P3_REVIEWED_MIRROR_PROVENANCE"
  | "P3_REVIEWED_FORK_PROVENANCE"
  | "P3_REVIEWED_UPSTREAM_PROVENANCE"
  | "P3_PROVIDER_DECLARED_FORK_PROVENANCE"
  | "P4_CANDIDATE_CONTENT_FINGERPRINT"
  | "P5_SOURCE_NAME"
  | "P5_CREATOR_IDENTITY"
  | "P5_ORGANIZATION_IDENTITY"
  | "P6_WEAK_SIMILAR_NAME";
export type IdentitySignalTargetTypeV1 =
  "RESOURCE_IDENTITY" | "RESOURCE_VERSION" | "SOURCE_REPOSITORY";
export type IdentityDecisionConflictCodeV1 =
  | "MISSING_OR_UNRELIABLE_IDENTITY_TOKEN"
  | "TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT"
  | "EXTERNAL_IDENTIFIER_COLLISION"
  | "MULTIPLE_CANONICAL_TARGETS"
  | "DIVERGENT_MIRROR_CONTENT"
  | "CONTENT_FINGERPRINT_PAYLOAD_COLLISION"
  | "PROVENANCE_SIGNAL_CONFLICT";

export interface IdentityTierEvaluationV1 {
  readonly tier: IdentityTierV1;
  readonly evaluationDisposition: IdentityTierDispositionV1;
}

export interface IdentityTrustedSignalV1 {
  readonly tier: IdentityTierV1;
  readonly signalType: IdentitySignalTypeV1;
  readonly targetTypeOrNull: IdentitySignalTargetTypeV1 | null;
  readonly targetIdOrNull: string | null;
  readonly evidenceReferenceIds: readonly string[];
}

export interface IdentityDecisionConflictTargetV1 {
  readonly targetType: IdentitySignalTargetTypeV1;
  readonly targetId: string;
}

export interface IdentityDecisionConflictV1 {
  readonly code: IdentityDecisionConflictCodeV1;
  readonly targets: readonly IdentityDecisionConflictTargetV1[];
  readonly evidenceReferenceIds: readonly string[];
}

export interface IdentityDecisionInputV1 {
  readonly schemaVersion: "1";
  readonly sourceSnapshotId: string;
  readonly candidateId: string;
  readonly candidateRootFingerprint: string;
  readonly candidateContentFingerprint: string;
  readonly reconciledClassificationRunId: string;
  readonly classificationRunInputFingerprint: string;
  readonly classificationRunOutputFingerprint: string;
  readonly analysisRunIdOrNull: string | null;
  readonly analysisRunRequestFingerprintOrNull: string | null;
  readonly analysisRunResponseFingerprintOrNull: string | null;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly analysisPolicyVersion: string;
  readonly parserProfileVersion: string;
  readonly promptBundleVersion: string;
  readonly evaluatedTierSequence: readonly IdentityTierEvaluationV1[];
  readonly trustedSignals: readonly IdentityTrustedSignalV1[];
  readonly conflicts: readonly IdentityDecisionConflictV1[];
}

export interface SystemIdentityReplayLocatorInputV1 {
  readonly sourceSnapshotId: string;
  readonly candidateId: string;
  readonly controllingJobId: string;
  readonly reconciledClassificationRunId: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly systemActorId: string;
}

export interface FrozenCanonicalPayload {
  readonly payload: Uint8Array;
  readonly fingerprint: string;
}

export interface FrozenSystemIdentityReplayLocator extends FrozenCanonicalPayload {
  readonly lookupKey: string;
}

export interface SystemIdentityMutationRequestV1 {
  readonly schemaVersion: "1";
  readonly sourceSnapshotId: string;
  readonly candidateId: string;
  readonly controllingJobId: string;
  readonly reconciledClassificationRunId: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
}

interface DerivedSystemIdentityMutation {
  readonly automaticProjectorModeId: SystemIdentityProjectorModeId;
  readonly candidateId: string;
  readonly controllingJobId: string;
  readonly systemActorId: "m02-system-identity-resolver";
  readonly identityDecisionInput: IdentityDecisionInputV1;
  readonly canonicalRepositoryUrl: string;
  readonly reliableIdentityTokenOrNull: string | null;
  readonly externalIdentifierIdOrNull: string | null;
  readonly externalIdentifierKeyFingerprintOrNull: string | null;
  readonly externalIdentifierKeyPayloadOrNull: Buffer | null;
  readonly externalIdentifierProvenanceOrNull: string | null;
  readonly externalIdentifierReviewStateOrNull: string | null;
  readonly externalIdentifierEvidenceReferenceIdOrNull: string | null;
  readonly targetResourceIdentityIdOrNull: string | null;
  readonly targetResourceVersionIdentityIdOrNull: string | null;
  readonly priorResourceVersionIdentityIdOrNull: string | null;
  readonly activeSourceLinkIdOrNull: string | null;
  readonly duplicateTargetResourceVersionIdOrNull: string | null;
  readonly forkSourceRepositoryIdOrNull: string | null;
  readonly frozenResourceVersionTargets: readonly DiscoveredResourceVersionTarget[];
  readonly sourceRepositoryUrlIdOrNull: string | null;
  readonly sourceRepositoryUrlOrNull: string | null;
  readonly reviewedMirrorRelationshipIdOrNull: string | null;
}

interface DiscoveredResourceVersionTarget {
  readonly resourceIdentityId: string;
  readonly resourceVersionId: string;
  readonly guardAnchorCandidateId: string;
  readonly contentFingerprint: string;
  readonly canonicalPayloadFingerprint: string;
}

export interface SystemIdentityMutationResultV1 {
  readonly id: string;
  readonly systemOperationId: string;
  readonly automaticProjectorModeId: SystemIdentityProjectorModeId;
  readonly identityDecisionId: string;
  readonly resourceIdentityIdOrNull: string | null;
  readonly resourceVersionIdentityIdOrNull: string | null;
  readonly duplicateCandidateIdOrNull: string | null;
  readonly handoffMarkerIdOrNull: string | null;
  readonly createdIdentityDecisionTierEvaluationIds: readonly string[];
  readonly createdIdentityDecisionSignalIds: readonly string[];
  readonly createdIdentityDecisionSignalEvidenceIds: readonly string[];
  readonly createdIdentityDecisionConflictIds: readonly string[];
  readonly createdIdentityDecisionConflictTargetIds: readonly string[];
  readonly createdIdentityDecisionConflictEvidenceIds: readonly string[];
  readonly replayed: boolean;
  readonly attemptCount: number;
}

export interface PostgresSystemIdentityOptions {
  readonly schema?: string;
  readonly serializationRetries?: number;
  readonly idAllocator?: () => string;
  readonly onFrozen?: (
    request: Readonly<{
      replayLookupKey: string;
      identityDecisionInputFingerprint: string;
      idempotencyKey: string;
      systemOperationFingerprint: string;
    }>,
  ) => void | Promise<void>;
  readonly onTransactionAttempt?: (attempt: number, client: PoolClient) => void | Promise<void>;
  readonly onPlanFrozen?: (
    plan: Readonly<{
      concurrencyPlanFingerprint: string;
      mutationPlanFingerprint: string;
      systemOperationId: string;
    }>,
  ) => void | Promise<void>;
}

export type SystemIdentityRejectionPhaseV1 =
  "PRE_PROJECTOR" | "POST_PROJECTOR_PRE_ALLOCATION" | "TRANSACTION_ATTEMPT";

export type SystemIdentityMutationErrorCode =
  | "JOB_SUPERSEDED"
  | "CANCELLED"
  | "EXPECTED_VERSION_SET_INVALID"
  | "STALE_RECORD_VERSION"
  | "MUTATION_PLAN_CHANGED"
  | "SERIALIZATION_RETRY_EXHAUSTED"
  | "FINGERPRINT_COLLISION"
  | "CONCURRENCY_GUARD_COLLISION";

export class SystemIdentityMutationError extends Error {
  public constructor(
    public readonly code: SystemIdentityMutationErrorCode,
    public readonly phase: SystemIdentityRejectionPhaseV1,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "SystemIdentityMutationError";
  }
}

const TIERS = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
const TIER_DISPOSITIONS = new Set<IdentityTierDispositionV1>([
  "MATCH",
  "NO_MATCH",
  "CONFLICT",
  "MULTIPLE_TARGETS",
  "NOT_APPLICABLE",
]);
const SIGNAL_TYPES = new Set<IdentitySignalTypeV1>([
  "P1_ACTIVE_SOURCE_LINK",
  "P2_TRUSTED_EXTERNAL_IDENTIFIER",
  "P3_REVIEWED_MIRROR_PROVENANCE",
  "P3_REVIEWED_FORK_PROVENANCE",
  "P3_REVIEWED_UPSTREAM_PROVENANCE",
  "P3_PROVIDER_DECLARED_FORK_PROVENANCE",
  "P4_CANDIDATE_CONTENT_FINGERPRINT",
  "P5_SOURCE_NAME",
  "P5_CREATOR_IDENTITY",
  "P5_ORGANIZATION_IDENTITY",
  "P6_WEAK_SIMILAR_NAME",
]);
const SIGNAL_TIER_BY_TYPE: Readonly<Record<IdentitySignalTypeV1, IdentityTierV1>> = {
  P1_ACTIVE_SOURCE_LINK: "P1",
  P2_TRUSTED_EXTERNAL_IDENTIFIER: "P2",
  P3_REVIEWED_MIRROR_PROVENANCE: "P3",
  P3_REVIEWED_FORK_PROVENANCE: "P3",
  P3_REVIEWED_UPSTREAM_PROVENANCE: "P3",
  P3_PROVIDER_DECLARED_FORK_PROVENANCE: "P3",
  P4_CANDIDATE_CONTENT_FINGERPRINT: "P4",
  P5_SOURCE_NAME: "P5",
  P5_CREATOR_IDENTITY: "P5",
  P5_ORGANIZATION_IDENTITY: "P5",
  P6_WEAK_SIMILAR_NAME: "P6",
};
const TARGET_TYPES = new Set<IdentitySignalTargetTypeV1>([
  "RESOURCE_IDENTITY",
  "RESOURCE_VERSION",
  "SOURCE_REPOSITORY",
]);
const CONFLICT_CODES = new Set<IdentityDecisionConflictCodeV1>([
  "MISSING_OR_UNRELIABLE_IDENTITY_TOKEN",
  "TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT",
  "EXTERNAL_IDENTIFIER_COLLISION",
  "MULTIPLE_CANONICAL_TARGETS",
  "DIVERGENT_MIRROR_CONTENT",
  "CONTENT_FINGERPRINT_PAYLOAD_COLLISION",
  "PROVENANCE_SIGNAL_CONFLICT",
]);
const HEX_64 = /^[0-9a-f]{64}$/u;

function fingerprint(payload: Uint8Array): string {
  return createHash("sha256").update(payload).digest("hex");
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function requiredValue<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
  return value;
}

function runtimeProperty(record: object, key: string): unknown {
  return Reflect.get(record, key);
}

interface ExactNameCreatorOrganizationMatchInput {
  readonly normalizedSourceName: string;
  readonly creatorIdentityOrNull: string | null;
  readonly organizationIdentityOrNull: string | null;
  readonly targetResourceIdentityId: string;
  readonly targetResourceVersionId: string;
  readonly evidenceReferenceIds: readonly string[];
}

interface WeakSimilarNameMatchInput {
  readonly targetResourceIdentityId: string;
  readonly targetResourceVersionId: string;
  readonly evidenceReferenceIds: readonly string[];
}

function recordValue(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

function exactObjectKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compareUtf8);
  const sortedExpected = [...expected].sort(compareUtf8);
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function sortedEvidenceIds(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== "string"))
    return undefined;
  const ids = [...(value as string[])].sort(compareUtf8);
  if (new Set(ids).size !== ids.length) return undefined;
  return ids;
}

function parseExactNameMatches(
  value: unknown,
): readonly ExactNameCreatorOrganizationMatchInput[] | undefined {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const matches: ExactNameCreatorOrganizationMatchInput[] = [];
  for (const item of value) {
    const object = recordValue(item);
    if (
      object === undefined ||
      !exactObjectKeys(object, [
        "creatorIdentityOrNull",
        "evidenceReferenceIds",
        "normalizedSourceName",
        "organizationIdentityOrNull",
        "targetResourceIdentityId",
        "targetResourceVersionId",
      ]) ||
      typeof object.normalizedSourceName !== "string" ||
      typeof object.targetResourceIdentityId !== "string" ||
      typeof object.targetResourceVersionId !== "string" ||
      (object.creatorIdentityOrNull !== null && typeof object.creatorIdentityOrNull !== "string") ||
      (object.organizationIdentityOrNull !== null &&
        typeof object.organizationIdentityOrNull !== "string") ||
      (object.creatorIdentityOrNull === null && object.organizationIdentityOrNull === null)
    )
      return undefined;
    const evidenceReferenceIds = sortedEvidenceIds(object.evidenceReferenceIds);
    if (evidenceReferenceIds === undefined) return undefined;
    matches.push({
      normalizedSourceName: object.normalizedSourceName,
      creatorIdentityOrNull: object.creatorIdentityOrNull,
      organizationIdentityOrNull: object.organizationIdentityOrNull,
      targetResourceIdentityId: object.targetResourceIdentityId,
      targetResourceVersionId: object.targetResourceVersionId,
      evidenceReferenceIds,
    });
  }
  return matches.sort((left, right) =>
    compareUtf8(left.targetResourceVersionId, right.targetResourceVersionId),
  );
}

function parseWeakNameMatch(value: unknown): WeakSimilarNameMatchInput | null | undefined {
  if (value === null || value === undefined) return null;
  const object = recordValue(value);
  if (
    object === undefined ||
    !exactObjectKeys(object, [
      "evidenceReferenceIds",
      "targetResourceIdentityId",
      "targetResourceVersionId",
    ]) ||
    typeof object.targetResourceIdentityId !== "string" ||
    typeof object.targetResourceVersionId !== "string"
  )
    return undefined;
  const evidenceReferenceIds = sortedEvidenceIds(object.evidenceReferenceIds);
  if (evidenceReferenceIds === undefined) return undefined;
  return {
    targetResourceIdentityId: object.targetResourceIdentityId,
    targetResourceVersionId: object.targetResourceVersionId,
    evidenceReferenceIds,
  };
}

function parseDiscoveredVersionTargets(
  value: unknown,
): readonly DiscoveredResourceVersionTarget[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const targets: DiscoveredResourceVersionTarget[] = [];
  for (const item of value) {
    const object = recordValue(item);
    if (
      object === undefined ||
      !exactObjectKeys(object, [
        "canonicalPayloadFingerprint",
        "contentFingerprint",
        "guardAnchorCandidateId",
        "resourceIdentityId",
        "resourceVersionId",
      ]) ||
      typeof object.canonicalPayloadFingerprint !== "string" ||
      !HEX_64.test(object.canonicalPayloadFingerprint) ||
      typeof object.contentFingerprint !== "string" ||
      !HEX_64.test(object.contentFingerprint) ||
      typeof object.guardAnchorCandidateId !== "string" ||
      typeof object.resourceIdentityId !== "string" ||
      typeof object.resourceVersionId !== "string"
    )
      return undefined;
    targets.push({
      canonicalPayloadFingerprint: object.canonicalPayloadFingerprint,
      contentFingerprint: object.contentFingerprint,
      guardAnchorCandidateId: object.guardAnchorCandidateId,
      resourceIdentityId: object.resourceIdentityId,
      resourceVersionId: object.resourceVersionId,
    });
  }
  targets.sort((left, right) => compareUtf8(left.resourceVersionId, right.resourceVersionId));
  if (new Set(targets.map((target) => target.resourceVersionId)).size !== targets.length)
    return undefined;
  return targets;
}

function parseRowVersionKey(
  key: string,
): { readonly table: string; readonly id: string } | undefined {
  if (!key.startsWith("row:")) return undefined;
  const separator = key.indexOf(":", 4);
  if (separator < 5) return undefined;
  const table = key.slice(4, separator);
  const id = key.slice(separator + 1);
  if (!/^[a-z][a-z0-9_]*$/u.test(table) || id.length === 0) return undefined;
  return { table, id };
}

function assertByteSortedDistinct(values: readonly string[]): void {
  if (
    values.some(
      (value, index) => index > 0 && compareUtf8(requiredValue(values[index - 1]), value) >= 0,
    )
  )
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION");
}

function assertDecisionInput(input: IdentityDecisionInputV1): void {
  if (
    !HEX_64.test(input.candidateRootFingerprint) ||
    !HEX_64.test(input.candidateContentFingerprint) ||
    !HEX_64.test(input.classificationRunInputFingerprint) ||
    !HEX_64.test(input.classificationRunOutputFingerprint) ||
    input.evaluatedTierSequence.length !== 6 ||
    input.evaluatedTierSequence.some(
      (entry, index) =>
        entry.tier !== TIERS[index] || !TIER_DISPOSITIONS.has(entry.evaluationDisposition),
    )
  )
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION");
  const stopOrdinal = input.evaluatedTierSequence.findIndex((entry) =>
    ["MATCH", "CONFLICT", "MULTIPLE_TARGETS"].includes(entry.evaluationDisposition),
  );
  if (
    input.evaluatedTierSequence.some((entry, ordinal) =>
      stopOrdinal < 0
        ? entry.evaluationDisposition === "NOT_APPLICABLE"
        : ordinal < stopOrdinal
          ? entry.evaluationDisposition === "NOT_APPLICABLE"
          : ordinal > stopOrdinal
            ? entry.evaluationDisposition !== "NOT_APPLICABLE"
            : entry.evaluationDisposition === "NOT_APPLICABLE",
    )
  )
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION");
  const analysisValues = [
    input.analysisRunIdOrNull,
    input.analysisRunRequestFingerprintOrNull,
    input.analysisRunResponseFingerprintOrNull,
  ];
  if (!(
    analysisValues.every((value) => value === null) ||
    (input.analysisRunIdOrNull !== null &&
      input.analysisRunRequestFingerprintOrNull !== null &&
      HEX_64.test(input.analysisRunRequestFingerprintOrNull) &&
      input.analysisRunResponseFingerprintOrNull !== null &&
      HEX_64.test(input.analysisRunResponseFingerprintOrNull))
  ))
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION");
  for (const signal of input.trustedSignals) {
    const tierDisposition =
      input.evaluatedTierSequence[TIERS.indexOf(signal.tier)]?.evaluationDisposition;
    const validP3Target =
      signal.signalType === "P3_REVIEWED_FORK_PROVENANCE"
        ? signal.targetTypeOrNull === "RESOURCE_VERSION"
        : ![
            "P3_REVIEWED_MIRROR_PROVENANCE",
            "P3_REVIEWED_UPSTREAM_PROVENANCE",
            "P3_PROVIDER_DECLARED_FORK_PROVENANCE",
          ].includes(signal.signalType) || signal.targetTypeOrNull === "SOURCE_REPOSITORY";
    const validNameTarget =
      ![
        "P5_SOURCE_NAME",
        "P5_CREATOR_IDENTITY",
        "P5_ORGANIZATION_IDENTITY",
        "P6_WEAK_SIMILAR_NAME",
      ].includes(signal.signalType) ||
      ["RESOURCE_IDENTITY", "RESOURCE_VERSION"].includes(signal.targetTypeOrNull ?? "");
    if (
      !TIERS.includes(signal.tier) ||
      !SIGNAL_TYPES.has(signal.signalType) ||
      SIGNAL_TIER_BY_TYPE[signal.signalType] !== signal.tier ||
      tierDisposition !== "MATCH" ||
      (signal.targetTypeOrNull === null) !== (signal.targetIdOrNull === null) ||
      (signal.targetTypeOrNull !== null && !TARGET_TYPES.has(signal.targetTypeOrNull)) ||
      signal.evidenceReferenceIds.length === 0 ||
      (signal.signalType === "P1_ACTIVE_SOURCE_LINK" &&
        signal.targetTypeOrNull !== "RESOURCE_VERSION") ||
      (signal.signalType === "P2_TRUSTED_EXTERNAL_IDENTIFIER" &&
        !["RESOURCE_IDENTITY", "RESOURCE_VERSION"].includes(signal.targetTypeOrNull ?? "")) ||
      (signal.signalType === "P3_PROVIDER_DECLARED_FORK_PROVENANCE" &&
        signal.targetTypeOrNull !== "SOURCE_REPOSITORY") ||
      (signal.signalType === "P4_CANDIDATE_CONTENT_FINGERPRINT" &&
        signal.targetTypeOrNull !== "RESOURCE_VERSION") ||
      !validP3Target ||
      !validNameTarget
    )
      throw new SystemIdentityMutationError(
        "MUTATION_PLAN_CHANGED",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    assertByteSortedDistinct(signal.evidenceReferenceIds);
  }
  if (
    input.evaluatedTierSequence.some(
      (evaluation) =>
        evaluation.evaluationDisposition === "MATCH" &&
        !input.trustedSignals.some((signal) => signal.tier === evaluation.tier),
    )
  )
    throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION");
  for (const conflict of input.conflicts) {
    if (!CONFLICT_CODES.has(conflict.code) || conflict.evidenceReferenceIds.length === 0)
      throw new SystemIdentityMutationError(
        "MUTATION_PLAN_CHANGED",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    assertByteSortedDistinct(conflict.evidenceReferenceIds);
    const targetKeys = conflict.targets.map(
      ({ targetType, targetId }) => `${targetType}\u001f${targetId}`,
    );
    if (
      conflict.targets.some(
        ({ targetType, targetId }) => !TARGET_TYPES.has(targetType) || !targetId,
      )
    )
      throw new SystemIdentityMutationError(
        "MUTATION_PLAN_CHANGED",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    assertByteSortedDistinct(targetKeys);
  }
  const signalKeys = input.trustedSignals.map(
    (signal) =>
      `${signal.tier}\u001f${signal.signalType}\u001f${signal.targetTypeOrNull ?? ""}\u001f${signal.targetIdOrNull ?? ""}\u001f${signal.evidenceReferenceIds.join("\u001f")}`,
  );
  assertByteSortedDistinct(signalKeys);
  const conflictKeys = input.conflicts.map(
    (conflict) =>
      `${conflict.code}\u001f${conflict.targets.map(({ targetType, targetId }) => `${targetType}\u001f${targetId}`).join("\u001f")}\u001f${conflict.evidenceReferenceIds.join("\u001f")}`,
  );
  assertByteSortedDistinct(conflictKeys);
}

export function canonicalizeIdentityDecisionInput(
  input: IdentityDecisionInputV1,
): FrozenCanonicalPayload {
  assertDecisionInput(input);
  const payload = canonicalM02JsonBytes(input as unknown as CanonicalM02Value);
  return { payload, fingerprint: fingerprint(payload) };
}

export function buildSystemIdentityReplayLocator(
  input: SystemIdentityReplayLocatorInputV1,
): FrozenSystemIdentityReplayLocator {
  const locator = {
    schemaVersion: "1",
    replayScope: "M02_SYSTEM_IDENTITY_REPLAY_V1",
    sourceSnapshotId: input.sourceSnapshotId,
    candidateId: input.candidateId,
    controllingJobId: input.controllingJobId,
    reconciledClassificationRunId: input.reconciledClassificationRunId,
    classificationPolicyVersion: input.classificationPolicyVersion,
    identityPolicyVersion: input.identityPolicyVersion,
    systemActorId: input.systemActorId,
  } as const;
  const payload = canonicalM02JsonBytes(locator);
  const lookupKey = fingerprint(payload);
  return { payload, fingerprint: lookupKey, lookupKey };
}

function derivedAuthorityFingerprint(request: DerivedSystemIdentityMutation): string {
  return canonicalPayload({
    automaticProjectorModeId: request.automaticProjectorModeId,
    identityDecisionInputFingerprint: canonicalizeIdentityDecisionInput(
      request.identityDecisionInput,
    ).fingerprint,
    canonicalRepositoryUrl: request.canonicalRepositoryUrl,
    reliableIdentityTokenOrNull: request.reliableIdentityTokenOrNull,
    externalIdentifierIdOrNull: request.externalIdentifierIdOrNull,
    externalIdentifierKeyFingerprintOrNull: request.externalIdentifierKeyFingerprintOrNull,
    externalIdentifierKeyPayloadFingerprintOrNull:
      request.externalIdentifierKeyPayloadOrNull === null
        ? null
        : fingerprint(request.externalIdentifierKeyPayloadOrNull),
    externalIdentifierProvenanceOrNull: request.externalIdentifierProvenanceOrNull,
    externalIdentifierReviewStateOrNull: request.externalIdentifierReviewStateOrNull,
    externalIdentifierEvidenceReferenceIdOrNull:
      request.externalIdentifierEvidenceReferenceIdOrNull,
    targetResourceIdentityIdOrNull: request.targetResourceIdentityIdOrNull,
    targetResourceVersionIdentityIdOrNull: request.targetResourceVersionIdentityIdOrNull,
    priorResourceVersionIdentityIdOrNull: request.priorResourceVersionIdentityIdOrNull,
    activeSourceLinkIdOrNull: request.activeSourceLinkIdOrNull,
    duplicateTargetResourceVersionIdOrNull: request.duplicateTargetResourceVersionIdOrNull,
    forkSourceRepositoryIdOrNull: request.forkSourceRepositoryIdOrNull,
    frozenResourceVersionTargets: request.frozenResourceVersionTargets.map((target) => ({
      resourceIdentityId: target.resourceIdentityId,
      resourceVersionId: target.resourceVersionId,
      guardAnchorCandidateId: target.guardAnchorCandidateId,
      contentFingerprint: target.contentFingerprint,
      canonicalPayloadFingerprint: target.canonicalPayloadFingerprint,
    })),
    sourceRepositoryUrlIdOrNull: request.sourceRepositoryUrlIdOrNull,
    sourceRepositoryUrlOrNull: request.sourceRepositoryUrlOrNull,
    reviewedMirrorRelationshipIdOrNull: request.reviewedMirrorRelationshipIdOrNull,
  }).fingerprint;
}

const SCHEMA_NAME = /^[a-z][a-z0-9_]{0,62}$/u;
const SYSTEM_ACTOR_ID = "m02-system-identity-resolver" as const;

interface AuthoritativeIdentityDiscovery {
  readonly source_snapshot_id: string;
  readonly reconciled_classification_run_id: string;
  readonly classification_policy_version: string;
  readonly identity_policy_version: string;
  readonly candidate_root_fingerprint: string;
  readonly candidate_content_fingerprint: string;
  readonly classification_run_input_fingerprint: string;
  readonly classification_run_output_fingerprint: string;
  readonly classification_analysis_run_id: string | null;
  readonly classification_analysis_run_request_fingerprint: string | null;
  readonly classification_analysis_run_response_fingerprint: string | null;
  readonly analysis_policy_version: string;
  readonly parser_profile_version: string;
  readonly prompt_bundle_version: string;
  readonly evidence_ids: string[];
  readonly provider: string;
  readonly provider_repository_id: string;
  readonly m01_canonical_url: string | null;
  readonly reliable_identity_token: string | null;
  readonly provider_fork_repository_id: string | null;
  readonly provider_fork_source_repository_id: string | null;
  readonly source_repository_id: string | null;
  readonly source_repository_url_id: string | null;
  readonly source_repository_canonical_url: string | null;
  readonly active_source_link_id: string | null;
  readonly active_source_link_version_id: string | null;
  readonly active_source_link_identity_id: string | null;
  readonly active_source_link_content_fingerprint: string | null;
  readonly active_source_link_canonical_payload: Buffer | null;
  readonly current_observation_id: string | null;
  readonly external_identifier_lookup: unknown;
  readonly external_target_count: string;
  readonly external_target_identifier_id: string | null;
  readonly external_target_identity_id: string | null;
  readonly external_target_version_id: string | null;
  readonly external_target_canonical_key_hash: string | null;
  readonly external_target_canonical_key_payload: Buffer | null;
  readonly external_target_provenance: string | null;
  readonly external_target_review_state: string | null;
  readonly external_target_evidence_reference_id: string | null;
  readonly content_target_count: string;
  readonly content_target_identity_id: string | null;
  readonly content_target_version_id: string | null;
  readonly content_target_canonical_payload: Buffer | null;
  readonly content_targets: unknown;
  readonly p5_match_input: unknown;
  readonly p6_match_input: unknown;
  readonly reviewed_mirror_relationship_id: string | null;
  readonly reviewed_mirror_origin_repository_id: string | null;
  readonly reviewed_mirror_target_version_id: string | null;
  readonly reviewed_mirror_target_identity_id: string | null;
  readonly reviewed_mirror_target_content_fingerprint: string | null;
  readonly reviewed_mirror_target_canonical_payload: Buffer | null;
  readonly reviewed_mirror_evidence_ids: string[] | null;
  readonly reviewed_mirror_command_id: string | null;
  readonly reviewed_mirror_result_id: string | null;
  readonly reviewed_mirror_audit_event_id: string | null;
  readonly reviewed_fork_relationship_id: string | null;
  readonly reviewed_fork_origin_version_id: string | null;
  readonly reviewed_fork_evidence_ids: string[] | null;
  readonly reviewed_fork_command_id: string | null;
  readonly reviewed_fork_result_id: string | null;
  readonly reviewed_fork_audit_event_id: string | null;
  readonly candidate_canonical_payload: Buffer;
  readonly candidate_status: string;
  readonly candidate_resource_identity_id: string | null;
  readonly candidate_resource_version_identity_id: string | null;
  readonly prior_decision_id: string | null;
  readonly prior_decision_origin_type: string | null;
  readonly prior_decision_system_operation_id: string | null;
  readonly prior_decision_controller_id: string | null;
  readonly prior_decision_input_fingerprint: string | null;
  readonly prior_handoff_id: string | null;
  readonly prior_handoff_state: string | null;
  readonly prior_handoff_controller_id: string | null;
  readonly prior_handoff_chain_count: string;
  readonly replacement_source_job_id: string | null;
  readonly replacement_input_payload: Buffer | null;
  readonly replacement_input_fingerprint: string | null;
  readonly replacement_edge_count: string;
  readonly replacement_command_result_count: string;
  readonly replacement_handoff_provenance_count: string;
  readonly open_clarification_count: string;
  readonly unresolved_sibling_count: string;
}

interface MutableIdentityContext {
  readonly source_snapshot_id: string;
  readonly candidate_root_fingerprint: string;
  readonly candidate_content_fingerprint: string;
  readonly reconciled_classification_run_id: string;
  readonly classification_policy_version: string;
  readonly identity_policy_version: string;
  readonly candidate_status: string;
  readonly candidate_record_version: string;
  readonly candidate_identity_outcome: string | null;
  readonly candidate_resource_identity_id: string | null;
  readonly candidate_resource_version_identity_id: string | null;
  readonly review_id: string;
  readonly review_state: string;
  readonly review_record_version: string;
  readonly acquisition_status: string;
  readonly acquisition_record_version: string;
  readonly cancellation_requested: boolean;
  readonly m02_current_stage: string;
  readonly m02_review_state: string;
  readonly m02_record_version: string;
  readonly supersession_state: string;
  readonly classification_run_input_fingerprint: string;
  readonly classification_run_output_fingerprint: string;
  readonly classification_analysis_run_id: string | null;
  readonly classification_analysis_run_request_fingerprint: string | null;
  readonly classification_analysis_run_response_fingerprint: string | null;
  readonly analysis_policy_version: string;
  readonly parser_profile_version: string;
  readonly prompt_bundle_version: string;
  readonly job_scope_key: string;
  readonly operation_scope: string;
  readonly candidate_root_id: string;
  readonly normalized_root_path: string;
  readonly canonical_content_payload: Buffer;
  readonly provider: string;
  readonly provider_repository_id: string;
  readonly fork_source_repository_provider: string | null;
  readonly fork_source_repository_provider_id: string | null;
  readonly immutable_revision: string;
  readonly evidence_id: string;
  readonly source_repository_id: string | null;
  readonly prior_decision_id: string | null;
  readonly prior_decision_record_version: string | null;
  readonly prior_handoff_id: string | null;
  readonly prior_handoff_record_version: string | null;
  readonly prior_handoff_state: string | null;
  readonly replacement_source_job_id: string | null;
  readonly replacement_input_fingerprint: string | null;
  readonly job_lineage_id: string;
  readonly duplicate_target_guard_anchor_candidate_id: string | null;
  readonly duplicate_target_content_fingerprint: string | null;
  readonly target_guard_anchor_candidate_id: string | null;
  readonly target_version_content_fingerprint: string | null;
  readonly prior_version_content_fingerprint: string | null;
  readonly guard_versions: Readonly<Record<string, number | null>>;
  readonly guard_payloads: Readonly<Record<string, Buffer | null>>;
  readonly expected_row_versions: Readonly<Record<string, number>>;
}

interface PreProjectorContext {
  readonly source_snapshot_id: string;
  readonly review_id: string;
  readonly acquisition_status: string;
  readonly cancellation_requested: boolean;
  readonly supersession_state: string;
}

interface RejectionRequestContext {
  readonly candidateId: string;
  readonly controllingJobId: string;
  readonly systemActorId: "m02-system-identity-resolver";
  readonly automaticProjectorModeId?: SystemIdentityProjectorModeId;
}

interface RejectionMutableContext {
  readonly source_snapshot_id: string;
  readonly review_id: string;
}

interface PlannedSystemGuard extends CanonicalGuardIdentity {
  readonly mutation: "READ_ONLY" | "ACTIVE_SET_CHANGE";
}

interface FrozenSystemOperation {
  readonly canonicalInput: FrozenCanonicalPayload;
  readonly replay: FrozenSystemIdentityReplayLocator;
  readonly expectedVersions: Readonly<Record<string, number | null>>;
  readonly expectedVersionsPayload: Uint8Array;
  readonly idempotencyPayload: Uint8Array;
  readonly idempotencyKey: string;
  readonly operationRequestPayload: Uint8Array;
  readonly operationFingerprint: string;
  readonly authorityFingerprint: string;
  readonly guards: readonly PlannedSystemGuard[];
  readonly concurrencyPlan: Readonly<Record<string, CanonicalM02Value>>;
  readonly concurrencyPlanPayload: Uint8Array;
  readonly concurrencyPlanFingerprint: string;
}

interface FrozenSystemMutationAttempt extends FrozenSystemOperation {
  readonly ids: SystemIds;
  readonly writtenAt: Date;
  readonly domainMutationPlan: Readonly<Record<string, CanonicalM02Value>>;
  readonly mutationPlanPayload: Uint8Array;
  readonly mutationPlanFingerprint: string;
}

interface SystemIds {
  readonly operationId: string;
  readonly resultId: string;
  readonly decisionId: string;
  readonly acceptedAuditId: string;
  readonly tierIds: readonly string[];
  readonly tierAuditIds: readonly string[];
  readonly signalIds: readonly string[];
  readonly signalAuditIds: readonly string[];
  readonly signalEvidenceIds: readonly (readonly string[])[];
  readonly signalEvidenceAuditIds: readonly (readonly string[])[];
  readonly conflictIds: readonly string[];
  readonly conflictAuditIds: readonly string[];
  readonly conflictTargetIds: readonly (readonly string[])[];
  readonly conflictTargetAuditIds: readonly (readonly string[])[];
  readonly conflictEvidenceIds: readonly (readonly string[])[];
  readonly conflictEvidenceAuditIds: readonly (readonly string[])[];
  readonly decisionAuditId: string;
  readonly candidateAuditId: string;
  readonly reviewAuditId: string;
  readonly acquisitionAuditId: string;
  readonly jobAuditId: string;
  readonly sourceRepositoryId?: string;
  readonly sourceRepositoryUrlId?: string;
  readonly resourceIdentityId?: string;
  readonly resourceVersionIdentityId?: string;
  readonly sourceLinkId?: string;
  readonly observationId?: string;
  readonly duplicateCandidateId?: string;
  readonly handoffMarkerId?: string;
  readonly sourceRepositoryAuditId?: string;
  readonly sourceRepositoryUrlAuditId?: string;
  readonly resourceIdentityAuditId?: string;
  readonly resourceVersionIdentityAuditId?: string;
  readonly sourceLinkAuditId?: string;
  readonly observationAuditId?: string;
  readonly duplicateCandidateAuditId?: string;
  readonly handoffMarkerAuditId?: string;
  readonly supersededSourceLinkAuditId?: string;
  readonly supersededDecisionAuditId?: string;
}

interface ResultRow {
  readonly id: string;
  readonly system_operation_id: string;
  readonly automatic_projector_mode_id: SystemIdentityProjectorModeId;
  readonly identity_decision_id: string;
  readonly resource_identity_id: string | null;
  readonly resource_version_identity_id: string | null;
  readonly duplicate_candidate_id: string | null;
  readonly handoff_marker_id: string | null;
  readonly created_identity_decision_tier_evaluation_ids: string[];
  readonly created_identity_decision_signal_ids: string[];
  readonly created_identity_decision_signal_evidence_ids: string[];
  readonly created_identity_decision_conflict_ids: string[];
  readonly created_identity_decision_conflict_target_ids: string[];
  readonly created_identity_decision_conflict_evidence_ids: string[];
}

function canonicalPayload(value: CanonicalM02Value): FrozenCanonicalPayload {
  const payload = canonicalM02JsonBytes(value);
  return { payload, fingerprint: fingerprint(payload) };
}

function canonicalText(value: CanonicalM02Value): string {
  return Buffer.from(canonicalM02JsonBytes(value)).toString("utf8");
}

function rowVersionKey(table: string, id: string): string {
  return `row:${table}:${id}`;
}

function systemGuards(
  request: DerivedSystemIdentityMutation,
  context: Pick<
    MutableIdentityContext,
    | "job_lineage_id"
    | "operation_scope"
    | "provider"
    | "provider_repository_id"
    | "normalized_root_path"
    | "source_snapshot_id"
    | "candidate_root_id"
    | "candidate_content_fingerprint"
    | "duplicate_target_guard_anchor_candidate_id"
    | "duplicate_target_content_fingerprint"
    | "target_guard_anchor_candidate_id"
    | "target_version_content_fingerprint"
    | "prior_version_content_fingerprint"
    | "replacement_source_job_id"
    | "replacement_input_fingerprint"
    | "fork_source_repository_provider"
    | "fork_source_repository_provider_id"
  >,
): readonly PlannedSystemGuard[] {
  const mode = request.automaticProjectorModeId;
  const guards = new Map<string, PlannedSystemGuard>();
  const add = (
    identity: CanonicalGuardIdentity,
    mutation: PlannedSystemGuard["mutation"],
  ): void => {
    const prior = guards.get(identity.key);
    guards.set(identity.key, {
      ...identity,
      mutation: prior?.mutation === "ACTIVE_SET_CHANGE" ? "ACTIVE_SET_CHANGE" : mutation,
    });
  };
  add(
    canonicalGuard("JOB_SCOPE_CONTROLLER", {
      jobLineageId: context.job_lineage_id,
      operationScope: context.operation_scope,
    }),
    "ACTIVE_SET_CHANGE",
  );
  add(
    canonicalGuard("SOURCE_REPOSITORY", {
      repositoryRef: {
        provider: context.provider,
        providerRepositoryId: context.provider_repository_id,
      },
    }),
    mode.includes("_R0_") ? "ACTIVE_SET_CHANGE" : "READ_ONLY",
  );
  add(
    canonicalGuard("HANDOFF", { candidateId: request.candidateId }),
    /^S[1-5]_/u.test(mode) || mode.startsWith("S9_") ? "ACTIVE_SET_CHANGE" : "READ_ONLY",
  );
  if (mode.startsWith("S9_") || mode === "S10_JR") {
    if (
      context.replacement_source_job_id === null ||
      context.replacement_input_fingerprint === null
    )
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    add(
      canonicalGuard("JOB_REPLACEMENT_INPUT", {
        sourceJobId: context.replacement_source_job_id,
        requestedScope: context.operation_scope,
        replacementInputFingerprint: context.replacement_input_fingerprint,
      }),
      "READ_ONLY",
    );
  }
  if (mode === "S8_JR") {
    if (
      context.fork_source_repository_provider === null ||
      context.fork_source_repository_provider_id === null
    )
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    add(
      canonicalGuard("SOURCE_REPOSITORY", {
        repositoryRef: {
          provider: context.fork_source_repository_provider,
          providerRepositoryId: context.fork_source_repository_provider_id,
        },
      }),
      "READ_ONLY",
    );
  }
  const identityAnchorCandidateId = mode.startsWith("S1_")
    ? request.candidateId
    : context.target_guard_anchor_candidate_id;
  const versionContentFingerprint = mode.startsWith("S2_")
    ? context.candidate_content_fingerprint
    : mode.startsWith("S1_") || mode.startsWith("S5_")
      ? context.candidate_content_fingerprint
      : context.target_version_content_fingerprint;
  if (/^S[1-5]_/u.test(mode) || mode.startsWith("S9_") || mode === "S10_JR") {
    if (identityAnchorCandidateId === null || versionContentFingerprint === null)
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    const resourceIdentityRef = {
      kind: "RESOURCE_IDENTITY_ANCHOR",
      originCandidateId: identityAnchorCandidateId,
    } as const;
    const resourceVersionRef = {
      kind: "RESOURCE_VERSION_ANCHOR",
      resourceIdentityRef,
      contentFingerprint: versionContentFingerprint,
    } as const;
    add(
      canonicalGuard("RESOURCE_VERSION", {
        resourceIdentityRef,
        contentFingerprint: versionContentFingerprint,
      }),
      mode.startsWith("S1_") || mode.startsWith("S2_") || mode.startsWith("S5_")
        ? "ACTIVE_SET_CHANGE"
        : "READ_ONLY",
    );
    add(
      canonicalGuard("RESOURCE_SOURCE", {
        provider: context.provider,
        providerRepositoryId: context.provider_repository_id,
        normalizedRootPath: context.normalized_root_path,
      }),
      mode.startsWith("S1_") ||
        mode.startsWith("S2_") ||
        mode.startsWith("S4_") ||
        mode.startsWith("S5_")
        ? "ACTIVE_SET_CHANGE"
        : "READ_ONLY",
    );
    add(
      canonicalGuard("OBSERVATION", {
        resourceVersionRef,
        sourceSnapshotId: context.source_snapshot_id,
        candidateRootId: context.candidate_root_id,
        sourceLinkRef: {
          provider: context.provider,
          providerRepositoryId: context.provider_repository_id,
          normalizedRootPath: context.normalized_root_path,
        },
      }),
      /^S[1-5]_/u.test(mode) ? "ACTIVE_SET_CHANGE" : "READ_ONLY",
    );
  }
  if (
    mode.startsWith("S2_") &&
    identityAnchorCandidateId !== null &&
    context.prior_version_content_fingerprint !== null
  )
    add(
      canonicalGuard("RESOURCE_VERSION", {
        resourceIdentityRef: {
          kind: "RESOURCE_IDENTITY_ANCHOR",
          originCandidateId: identityAnchorCandidateId,
        },
        contentFingerprint: context.prior_version_content_fingerprint,
      }),
      "READ_ONLY",
    );
  if (
    mode === "S7_JR" &&
    context.duplicate_target_guard_anchor_candidate_id !== null &&
    context.duplicate_target_content_fingerprint !== null
  ) {
    const targetVersionRef = {
      kind: "RESOURCE_VERSION_ANCHOR",
      resourceIdentityRef: {
        kind: "RESOURCE_IDENTITY_ANCHOR",
        originCandidateId: context.duplicate_target_guard_anchor_candidate_id,
      },
      contentFingerprint: context.duplicate_target_content_fingerprint,
    } as const;
    add(
      canonicalGuard("DUPLICATE_PROPOSAL_SET", { candidateId: request.candidateId }),
      "ACTIVE_SET_CHANGE",
    );
    add(
      canonicalGuard("DUPLICATE_PROPOSAL_PAIR", {
        candidateId: request.candidateId,
        targetVersionRef,
      }),
      "ACTIVE_SET_CHANGE",
    );
    add(canonicalGuard("DUPLICATE_DISPOSITION", { candidateId: request.candidateId }), "READ_ONLY");
    add(
      canonicalGuard("RELATIONSHIP_PAIR", {
        relationshipType: "DUPLICATE_OF",
        sourceEndpointRef: { kind: "CANDIDATE", candidateId: request.candidateId },
        targetEndpointRef: { kind: "RESOURCE_VERSION", versionRef: targetVersionRef },
      }),
      "READ_ONLY",
    );
  }
  for (const target of request.frozenResourceVersionTargets) {
    add(
      canonicalGuard("RESOURCE_VERSION", {
        resourceIdentityRef: {
          kind: "RESOURCE_IDENTITY_ANCHOR",
          originCandidateId: target.guardAnchorCandidateId,
        },
        contentFingerprint: target.contentFingerprint,
      }),
      "READ_ONLY",
    );
  }
  return [...guards.values()].sort((left, right) => compareUtf8(left.key, right.key));
}

function allocateIds(
  input: IdentityDecisionInputV1,
  mode: SystemIdentityProjectorModeId,
  allocate: () => string,
): SystemIds {
  const createsRepository = mode.includes("_R0_");
  const createsIdentity = mode.startsWith("S1_");
  const createsVersion = mode.startsWith("S1_") || mode.startsWith("S2_") || mode.startsWith("S5_");
  const createsLink =
    mode.startsWith("S1_") ||
    mode.startsWith("S2_") ||
    mode.startsWith("S4_") ||
    mode.startsWith("S5_");
  const createsObservation = /^S[1-5]_/u.test(mode);
  const createsDuplicate = mode === "S7_JR";
  const createsHandoff = /^S[1-5]_/u.test(mode) || mode.startsWith("S9_");
  const supersedesSourceLink = mode.startsWith("S2_");
  const supersedesDecision = mode.startsWith("S9_") || mode === "S10_JR";
  return {
    operationId: allocate(),
    resultId: allocate(),
    decisionId: allocate(),
    acceptedAuditId: allocate(),
    tierIds: input.evaluatedTierSequence.map(() => allocate()).sort(compareUtf8),
    tierAuditIds: input.evaluatedTierSequence.map(() => allocate()),
    signalIds: input.trustedSignals.map(() => allocate()).sort(compareUtf8),
    signalAuditIds: input.trustedSignals.map(() => allocate()),
    signalEvidenceIds: input.trustedSignals.map((signal) =>
      signal.evidenceReferenceIds.map(() => allocate()).sort(compareUtf8),
    ),
    signalEvidenceAuditIds: input.trustedSignals.map((signal) =>
      signal.evidenceReferenceIds.map(() => allocate()),
    ),
    conflictIds: input.conflicts.map(() => allocate()).sort(compareUtf8),
    conflictAuditIds: input.conflicts.map(() => allocate()),
    conflictTargetIds: input.conflicts.map((conflict) =>
      conflict.targets.map(() => allocate()).sort(compareUtf8),
    ),
    conflictTargetAuditIds: input.conflicts.map((conflict) =>
      conflict.targets.map(() => allocate()),
    ),
    conflictEvidenceIds: input.conflicts.map((conflict) =>
      conflict.evidenceReferenceIds.map(() => allocate()).sort(compareUtf8),
    ),
    conflictEvidenceAuditIds: input.conflicts.map((conflict) =>
      conflict.evidenceReferenceIds.map(() => allocate()),
    ),
    decisionAuditId: allocate(),
    candidateAuditId: allocate(),
    reviewAuditId: allocate(),
    acquisitionAuditId: allocate(),
    jobAuditId: allocate(),
    ...(createsRepository
      ? {
          sourceRepositoryId: allocate(),
          sourceRepositoryUrlId: allocate(),
          sourceRepositoryAuditId: allocate(),
          sourceRepositoryUrlAuditId: allocate(),
        }
      : {}),
    ...(createsIdentity
      ? { resourceIdentityId: allocate(), resourceIdentityAuditId: allocate() }
      : {}),
    ...(createsVersion
      ? { resourceVersionIdentityId: allocate(), resourceVersionIdentityAuditId: allocate() }
      : {}),
    ...(createsLink ? { sourceLinkId: allocate(), sourceLinkAuditId: allocate() } : {}),
    ...(createsObservation ? { observationId: allocate(), observationAuditId: allocate() } : {}),
    ...(createsDuplicate
      ? { duplicateCandidateId: allocate(), duplicateCandidateAuditId: allocate() }
      : {}),
    ...(createsHandoff ? { handoffMarkerId: allocate(), handoffMarkerAuditId: allocate() } : {}),
    ...(supersedesSourceLink ? { supersededSourceLinkAuditId: allocate() } : {}),
    ...(supersedesDecision ? { supersededDecisionAuditId: allocate() } : {}),
  };
}

function resultFromRow(
  row: ResultRow,
  replayed: boolean,
  attemptCount: number,
): SystemIdentityMutationResultV1 {
  return {
    id: row.id,
    systemOperationId: row.system_operation_id,
    automaticProjectorModeId: row.automatic_projector_mode_id,
    identityDecisionId: row.identity_decision_id,
    resourceIdentityIdOrNull: row.resource_identity_id,
    resourceVersionIdentityIdOrNull: row.resource_version_identity_id,
    duplicateCandidateIdOrNull: row.duplicate_candidate_id,
    handoffMarkerIdOrNull: row.handoff_marker_id,
    createdIdentityDecisionTierEvaluationIds: row.created_identity_decision_tier_evaluation_ids,
    createdIdentityDecisionSignalIds: row.created_identity_decision_signal_ids,
    createdIdentityDecisionSignalEvidenceIds: row.created_identity_decision_signal_evidence_ids,
    createdIdentityDecisionConflictIds: row.created_identity_decision_conflict_ids,
    createdIdentityDecisionConflictTargetIds: row.created_identity_decision_conflict_target_ids,
    createdIdentityDecisionConflictEvidenceIds: row.created_identity_decision_conflict_evidence_ids,
    replayed,
    attemptCount,
  };
}

function flatten(values: readonly (readonly string[])[]): readonly string[] {
  return values.flat().sort(compareUtf8);
}

interface PlannedSystemCreate {
  readonly tableName: string;
  readonly primaryKey: string;
  readonly values: Readonly<Record<string, CanonicalM02Value>>;
}

interface PlannedSystemChange {
  readonly tableName: string;
  readonly primaryKey: string;
  readonly beforeValues: Readonly<Record<string, CanonicalM02Value>>;
  readonly afterValues: Readonly<Record<string, CanonicalM02Value>>;
}

interface PlannedSystemAudit {
  readonly id: string;
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly beforeVersion: number | null;
  readonly afterVersion: number | null;
  readonly beforeState: string | null;
  readonly afterState: string | null;
  readonly metadata: CanonicalM02Value;
  readonly originType: string;
  readonly actorType: string;
  readonly actorId: string;
  readonly actorRole: string | null;
  readonly requestId: string;
  readonly idempotencyScope: string;
  readonly idempotencyKey: string;
  readonly reasonCode: string;
  readonly reasonText: string;
  readonly sourceSnapshotId: string;
  readonly controllingJobId: string;
  readonly occurredAt: string;
  readonly systemOperationId: string;
  readonly systemResultId: string;
}

const SYSTEM_PLAN_COLUMNS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  acquisition_jobs: new Set(["id", "status", "record_version"]),
  duplicate_candidates: new Set([
    "id",
    "resource_candidate_id",
    "target_resource_version_id",
    "status",
    "evidence_ids",
    "decision_id",
    "reason",
    "actor_id",
    "created_at",
    "record_version",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  identity_decision_conflict_evidence: new Set([
    "id",
    "conflict_id",
    "ordinal",
    "evidence_reference_id",
    "audit_event_id",
    "created_at",
  ]),
  identity_decision_conflict_targets: new Set([
    "id",
    "conflict_id",
    "ordinal",
    "target_type",
    "resource_identity_id",
    "resource_version_id",
    "source_repository_id",
    "audit_event_id",
    "created_at",
  ]),
  identity_decision_conflicts: new Set([
    "id",
    "identity_decision_id",
    "ordinal",
    "conflict_code",
    "audit_event_id",
    "created_at",
  ]),
  identity_decision_signal_evidence: new Set([
    "id",
    "signal_id",
    "ordinal",
    "evidence_reference_id",
    "audit_event_id",
    "created_at",
  ]),
  identity_decision_signals: new Set([
    "id",
    "identity_decision_id",
    "ordinal",
    "tier",
    "signal_type",
    "target_type",
    "resource_identity_id",
    "resource_version_id",
    "source_repository_id",
    "audit_event_id",
    "created_at",
  ]),
  identity_decision_tier_evaluations: new Set([
    "id",
    "identity_decision_id",
    "ordinal",
    "tier",
    "evaluation_disposition",
    "audit_event_id",
    "created_at",
  ]),
  identity_decisions: new Set([
    "id",
    "resource_candidate_id",
    "outcome",
    "matched_tier",
    "confidence",
    "identity_policy_version",
    "decision_source",
    "signals",
    "rejected_lower_tier_signals",
    "conflicts",
    "audit_fingerprint",
    "state",
    "supersedes_decision_id",
    "created_at",
    "record_version",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
    "replacement_system_operation_id",
    "replacement_system_result_id",
    "replacement_audit_event_id",
    "superseded_by_decision_id",
  ]),
  m02_audit_events: new Set([
    "id",
    "origin_type",
    "actor_type",
    "actor_id",
    "actor_role",
    "action",
    "subject_type",
    "subject_id",
    "request_id",
    "idempotency_scope",
    "idempotency_key",
    "reason_code",
    "reason_text",
    "before_version",
    "after_version",
    "before_state",
    "after_state",
    "metadata",
    "source_snapshot_id",
    "controlling_job_id",
    "occurred_at",
    "system_operation_id",
    "system_result_id",
  ]),
  m02_identity_handoff_markers: new Set([
    "id",
    "resource_candidate_id",
    "resource_identity_id",
    "resource_version_identity_id",
    "controlling_m02_job_id",
    "source_snapshot_id",
    "identity_decision_id",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
    "logical_key",
    "state",
    "created_at",
    "record_version",
  ]),
  m02_jobs: new Set(["id", "current_stage", "review_state", "record_version"]),
  m02_review_states: new Set(["id", "review_state", "record_version"]),
  m02_system_identity_operations: new Set([
    "id",
    "operation_kind",
    "automatic_projector_mode_id",
    "source_snapshot_id",
    "candidate_id",
    "controlling_job_id",
    "reconciled_classification_run_id",
    "classification_run_input_fingerprint",
    "classification_run_output_fingerprint",
    "classification_policy_version",
    "identity_policy_version",
    "analysis_policy_version",
    "parser_profile_version",
    "prompt_bundle_version",
    "analysis_run_id",
    "analysis_run_request_fingerprint",
    "analysis_run_response_fingerprint",
    "identity_decision_input_payload",
    "identity_decision_input_fingerprint",
    "system_replay_locator_payload",
    "system_replay_lookup_key",
    "idempotency_scope",
    "idempotency_key",
    "idempotency_payload",
    "system_expected_versions",
    "system_expected_versions_payload",
    "system_operation_request_payload",
    "system_operation_fingerprint",
    "system_actor_id",
    "actor_type",
    "actor_role",
    "created_at",
  ]),
  m02_system_identity_results: new Set([
    "id",
    "system_operation_id",
    "status",
    "automatic_projector_mode_id",
    "mutation_plan_payload",
    "mutation_plan_fingerprint",
    "candidate_id",
    "controlling_job_id",
    "source_snapshot_id",
    "identity_decision_id",
    "resource_identity_id",
    "resource_version_identity_id",
    "duplicate_candidate_id",
    "handoff_marker_id",
    "created_source_repository_ids",
    "created_source_repository_url_ids",
    "created_resource_identity_ids",
    "created_resource_version_identity_ids",
    "created_source_link_ids",
    "created_observation_ids",
    "created_duplicate_candidate_ids",
    "created_identity_decision_ids",
    "created_handoff_marker_ids",
    "reused_source_repository_ids",
    "reused_resource_identity_ids",
    "reused_resource_version_identity_ids",
    "reused_source_link_ids",
    "reused_observation_ids",
    "updated_resource_candidate_ids",
    "updated_review_state_ids",
    "updated_acquisition_job_ids",
    "updated_m02_job_ids",
    "superseded_source_link_ids",
    "superseded_identity_decision_ids",
    "superseded_handoff_marker_ids",
    "superseded_duplicate_candidate_ids",
    "created_identity_decision_tier_evaluation_ids",
    "created_identity_decision_signal_ids",
    "created_identity_decision_signal_evidence_ids",
    "created_identity_decision_conflict_ids",
    "created_identity_decision_conflict_target_ids",
    "created_identity_decision_conflict_evidence_ids",
    "final_candidate_state",
    "final_review_state",
    "final_acquisition_job_status",
    "final_m02_job_status",
    "final_m02_stage",
    "accepted_audit_event_id",
    "accepted_at",
  ]),
  resource_candidates: new Set([
    "id",
    "status",
    "identity_outcome",
    "resource_identity_id",
    "resource_version_identity_id",
    "updated_at",
    "record_version",
  ]),
  resource_identities: new Set([
    "id",
    "status",
    "reliable_identity_token",
    "reliable_token_evidence_id",
    "created_at",
    "record_version",
    "guard_anchor_candidate_id",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  resource_source_links: new Set([
    "id",
    "source_repository_id",
    "normalized_root_path",
    "target_resource_version_id",
    "relationship",
    "evidence_ids",
    "decision_id",
    "reason",
    "actor_id",
    "created_at",
    "state",
    "supersedes_source_link_id",
    "record_version",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  resource_version_identities: new Set([
    "id",
    "resource_identity_id",
    "content_fingerprint",
    "canonical_payload",
    "first_observed_source_snapshot_id",
    "first_observed_candidate_root_id",
    "first_observed_source_revision",
    "observation_label",
    "status",
    "created_at",
    "record_version",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  resource_version_observations: new Set([
    "id",
    "resource_version_identity_id",
    "source_snapshot_id",
    "candidate_root_id",
    "resource_source_link_id",
    "source_repository_id",
    "provider",
    "provider_repository_id",
    "normalized_root_path",
    "immutable_revision",
    "observed_at",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  source_repository_identities: new Set([
    "id",
    "provider",
    "provider_repository_id",
    "created_at",
    "record_version",
    "first_observed_source_snapshot_id",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
  source_repository_urls: new Set([
    "id",
    "source_repository_id",
    "provider",
    "provider_repository_id",
    "canonical_url",
    "source_snapshot_id",
    "observed_at",
    "state",
    "origin_type",
    "system_operation_id",
    "system_result_id",
    "audit_event_id",
  ]),
});

const SYSTEM_PLAN_JSONB_COLUMNS = new Set([
  "duplicate_candidates.evidence_ids",
  "identity_decisions.conflicts",
  "identity_decisions.rejected_lower_tier_signals",
  "identity_decisions.signals",
  "m02_audit_events.metadata",
  "m02_system_identity_operations.system_expected_versions",
  "m02_system_identity_results.final_candidate_state",
  "resource_source_links.evidence_ids",
]);

const SYSTEM_PLAN_CREATE_ORDER: Readonly<Record<string, number>> = Object.freeze({
  source_repository_identities: 10,
  resource_identities: 20,
  resource_version_identities: 30,
  identity_decisions: 40,
  identity_decision_tier_evaluations: 50,
  identity_decision_signals: 50,
  identity_decision_conflicts: 50,
  identity_decision_signal_evidence: 60,
  identity_decision_conflict_targets: 60,
  identity_decision_conflict_evidence: 60,
  source_repository_urls: 70,
  resource_source_links: 80,
  resource_version_observations: 90,
  duplicate_candidates: 90,
  m02_identity_handoff_markers: 90,
});

/**
 * Sole server-side PostgreSQL writer for the closed F42 system identity mode vocabulary.
 * It accepts only immutable pre-projector locator/policy context and derives the mode, facts,
 * IDs, expectations, fingerprints, actors, origins, versions, and audit claims from PostgreSQL.
 */
export class PostgresSystemIdentityAdapter {
  private readonly schema: string;
  private readonly maxAttempts: number;

  public constructor(
    private readonly pool: Pool,
    private readonly options: PostgresSystemIdentityOptions = {},
  ) {
    this.schema = options.schema ?? "public";
    if (!SCHEMA_NAME.test(this.schema)) throw new Error("INVALID_SCHEMA");
    this.maxAttempts = Math.min(3, Math.max(1, (options.serializationRetries ?? 2) + 1));
  }

  private async loadPreProjectorContext(
    request: SystemIdentityMutationRequestV1,
  ): Promise<PreProjectorContext> {
    const result = await this.pool.query<PreProjectorContext>(
      `SELECT candidate.source_snapshot_id,review.id AS review_id,
         acquisition.status AS acquisition_status,acquisition.cancellation_requested,
         job.supersession_state
       FROM ${this.schema}.resource_candidates candidate
       JOIN ${this.schema}.m02_review_states review
         ON review.resource_candidate_id=candidate.id
       JOIN ${this.schema}.acquisition_jobs acquisition ON acquisition.id=$2
       JOIN ${this.schema}.m02_jobs job ON job.id=acquisition.id
       WHERE candidate.id=$1 AND candidate.source_snapshot_id=$3
         AND acquisition.source_snapshot_id=candidate.source_snapshot_id
         AND job.source_snapshot_id=candidate.source_snapshot_id`,
      [request.candidateId, request.controllingJobId, request.sourceSnapshotId],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new SystemIdentityMutationError(
        "EXPECTED_VERSION_SET_INVALID",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    return row;
  }

  private async deriveAuthoritativeMutation(
    request: SystemIdentityMutationRequestV1,
    existingClient?: PoolClient,
  ): Promise<DerivedSystemIdentityMutation> {
    const discoveryChanged = (): SystemIdentityMutationError =>
      existingClient === undefined
        ? new SystemIdentityMutationError(
            "EXPECTED_VERSION_SET_INVALID",
            "POST_PROJECTOR_PRE_ALLOCATION",
          )
        : new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    if (
      runtimeProperty(request, "schemaVersion") !== "1" ||
      request.sourceSnapshotId.length === 0 ||
      request.candidateId.length === 0 ||
      request.controllingJobId.length === 0 ||
      request.reconciledClassificationRunId.length === 0 ||
      request.classificationPolicyVersion.length === 0 ||
      request.identityPolicyVersion.length === 0
    )
      throw new SystemIdentityMutationError(
        "EXPECTED_VERSION_SET_INVALID",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    const ownedClient = existingClient === undefined ? await this.pool.connect() : undefined;
    const client = existingClient ?? requiredValue(ownedClient);
    try {
      if (existingClient === undefined)
        await client.query(`SET search_path TO ${this.schema}, public`);
      const result = await client.query<AuthoritativeIdentityDiscovery>(
        `SELECT candidate.source_snapshot_id,candidate.reconciled_classification_run_id,
          candidate.classification_policy_version,candidate.identity_policy_version,
          candidate.candidate_root_fingerprint,candidate.candidate_content_fingerprint,
          candidate.status AS candidate_status,
          candidate.resource_identity_id AS candidate_resource_identity_id,
          candidate.resource_version_identity_id AS candidate_resource_version_identity_id,
          root.canonical_content_payload AS candidate_canonical_payload,
          run.input_fingerprint AS classification_run_input_fingerprint,
          run.output_fingerprint AS classification_run_output_fingerprint,
          run.analysis_run_id AS classification_analysis_run_id,
          analysis.request_fingerprint AS classification_analysis_run_request_fingerprint,
          analysis.response_fingerprint AS classification_analysis_run_response_fingerprint,
          job.analysis_policy_version,job.parser_profile_version,job.prompt_bundle_version,
          snapshot.provider,snapshot.provider_repository_id,
          acquisition_result.result #>> '{sourceReference,canonicalUrl}' AS m01_canonical_url,
          COALESCE(evidence.evidence_ids,ARRAY[]::text[]) AS evidence_ids,
          NULLIF(acquisition_result.result #>> '{identityDiscovery,reliableIdentityTokenOrNull}','')
            AS reliable_identity_token,
          NULLIF(acquisition_result.result #>> '{identityDiscovery,providerDeclaredForkRepositoryIdOrNull}','')
            AS provider_fork_repository_id,
          fork_repository.id AS provider_fork_source_repository_id,
          repository.id AS source_repository_id,
          repository_url.id AS source_repository_url_id,
          repository_url.canonical_url AS source_repository_canonical_url,
          source_link.id AS active_source_link_id,
          source_link.target_resource_version_id AS active_source_link_version_id,
          source_link.resource_identity_id AS active_source_link_identity_id,
          source_link.content_fingerprint AS active_source_link_content_fingerprint,
          source_link.canonical_payload AS active_source_link_canonical_payload,
          observation.id AS current_observation_id,
          acquisition_result.result #> '{identityDiscovery,trustedExternalIdentifierOrNull}'
            AS external_identifier_lookup,
          external_target.target_count::text AS external_target_count,
          external_target.id AS external_target_identifier_id,
          external_target.resource_identity_id AS external_target_identity_id,
          external_version.id AS external_target_version_id,
          external_target.canonical_key_hash AS external_target_canonical_key_hash,
          external_target.canonical_key_payload AS external_target_canonical_key_payload,
          external_target.provenance AS external_target_provenance,
          external_target.review_state AS external_target_review_state,
          external_target.evidence_reference_id AS external_target_evidence_reference_id,
          content_target.target_count::text AS content_target_count,
          content_target.resource_identity_id AS content_target_identity_id,
          content_target.id AS content_target_version_id,
          content_target.canonical_payload AS content_target_canonical_payload,
          COALESCE(content_targets.targets,'[]'::jsonb) AS content_targets,
          acquisition_result.result #> '{identityDiscovery,exactNameCreatorOrganizationMatches}'
            AS p5_match_input,
          acquisition_result.result #> '{identityDiscovery,weakSimilarNameMatchOrNull}'
            AS p6_match_input,
          reviewed_mirror.id AS reviewed_mirror_relationship_id,
          reviewed_mirror.origin_source_repository_id AS reviewed_mirror_origin_repository_id,
          reviewed_mirror.target_resource_version_id AS reviewed_mirror_target_version_id,
          reviewed_mirror.resource_identity_id AS reviewed_mirror_target_identity_id,
          reviewed_mirror.content_fingerprint AS reviewed_mirror_target_content_fingerprint,
          reviewed_mirror.canonical_payload AS reviewed_mirror_target_canonical_payload,
          reviewed_mirror.evidence_ids AS reviewed_mirror_evidence_ids,
          reviewed_mirror.command_id AS reviewed_mirror_command_id,
          reviewed_mirror.result_id AS reviewed_mirror_result_id,
          reviewed_mirror.audit_event_id AS reviewed_mirror_audit_event_id,
          reviewed_fork.id AS reviewed_fork_relationship_id,
          reviewed_fork.origin_resource_version_id AS reviewed_fork_origin_version_id,
          reviewed_fork.evidence_ids AS reviewed_fork_evidence_ids,
          reviewed_fork.command_id AS reviewed_fork_command_id,
          reviewed_fork.result_id AS reviewed_fork_result_id,
          reviewed_fork.audit_event_id AS reviewed_fork_audit_event_id,
          decision.id AS prior_decision_id,decision.origin_type AS prior_decision_origin_type,
          decision.system_operation_id AS prior_decision_system_operation_id,
          decision.controlling_job_id AS prior_decision_controller_id,
          decision.identity_decision_input_fingerprint AS prior_decision_input_fingerprint,
          handoff.id AS prior_handoff_id,handoff.state AS prior_handoff_state,
          handoff.controlling_m02_job_id AS prior_handoff_controller_id,
          COALESCE(handoff.chain_count,0)::text AS prior_handoff_chain_count,
          job.replacement_source_job_id,job.replacement_input_payload,
          job.replacement_input_fingerprint,
          (SELECT count(*) FROM m02_job_supersessions edge
           WHERE edge.source_job_id=job.replacement_source_job_id
             AND edge.replacement_job_id=job.id)::text AS replacement_edge_count,
          (SELECT count(*) FROM m02_job_supersessions edge
           JOIN manual_resolution_commands command ON command.id=edge.command_id
           JOIN m02_manual_command_results command_result ON command_result.id=edge.result_id
           WHERE edge.source_job_id=job.replacement_source_job_id
             AND edge.replacement_job_id=job.id
             AND command.command_type='REPLACE_M02_JOB'
             AND command_result.command_id=command.id)::text AS replacement_command_result_count,
          (SELECT count(*) FROM m02_job_supersessions edge
           JOIN m02_audit_events audit
             ON audit.command_id=edge.command_id AND audit.result_id=edge.result_id
           WHERE edge.source_job_id=job.replacement_source_job_id
             AND edge.replacement_job_id=job.id
             AND audit.origin_type='HUMAN_COMMAND'
             AND audit.action='SUBJECT_SUPERSEDED'
             AND audit.subject_type='M02_IDENTITY_HANDOFF'
             AND audit.subject_id=handoff.id)::text AS replacement_handoff_provenance_count,
          (SELECT count(*) FROM m02_clarification_requests clarification
           WHERE clarification.resource_candidate_id=candidate.id
             AND clarification.state='OPEN')::text AS open_clarification_count,
          (SELECT count(*) FROM resource_candidates sibling
           JOIN candidate_roots sibling_root ON sibling_root.id=sibling.candidate_root_id
           WHERE sibling_root.group_id=root.group_id AND sibling.id<>candidate.id
             AND sibling.status NOT IN ('REJECTED','SUPERSEDED')
             AND NOT (
               sibling.status='IDENTITY_RESOLVED'
               AND EXISTS (
                 SELECT 1 FROM identity_decisions sibling_decision
                 JOIN m02_identity_handoff_markers sibling_handoff
                   ON sibling_handoff.identity_decision_id=sibling_decision.id
                 LEFT JOIN m02_system_identity_operations sibling_operation
                   ON sibling_operation.id=sibling_decision.system_operation_id
                 WHERE sibling_decision.resource_candidate_id=sibling.id
                   AND sibling_decision.state='ACTIVE'
                   AND sibling_handoff.state='ACTIVE'
                   AND sibling_handoff.controlling_m02_job_id=job.id
                   AND sibling_handoff.resource_identity_id=sibling.resource_identity_id
                   AND sibling_handoff.resource_version_identity_id=sibling.resource_version_identity_id
                   AND sibling_handoff.origin_type=sibling_decision.origin_type
                   AND (
                     (sibling_decision.origin_type='SYSTEM_IDENTITY_OPERATION'
                       AND sibling_operation.controlling_job_id=job.id
                       AND sibling_decision.command_id IS NULL
                       AND sibling_decision.result_id IS NULL
                       AND sibling_handoff.system_operation_id=sibling_decision.system_operation_id
                       AND sibling_handoff.system_result_id=sibling_decision.system_result_id
                       AND sibling_handoff.command_id IS NULL
                       AND sibling_handoff.result_id IS NULL)
                     OR
                     (sibling_decision.origin_type='HUMAN_COMMAND'
                       AND sibling_decision.system_operation_id IS NULL
                       AND sibling_decision.system_result_id IS NULL
                       AND sibling_handoff.command_id=sibling_decision.command_id
                       AND sibling_handoff.result_id=sibling_decision.result_id
                       AND sibling_handoff.system_operation_id IS NULL
                       AND sibling_handoff.system_result_id IS NULL)
                   )
               )
             ))::text
            AS unresolved_sibling_count
       FROM resource_candidates candidate
       JOIN candidate_roots root ON root.id=candidate.candidate_root_id
       JOIN repository_classification_runs run ON run.id=candidate.reconciled_classification_run_id
       LEFT JOIN analysis_runs analysis ON analysis.id=run.analysis_run_id
       JOIN source_snapshots snapshot ON snapshot.id=candidate.source_snapshot_id
       JOIN acquisition_jobs acquisition ON acquisition.id=$3
       LEFT JOIN acquisition_results acquisition_result ON acquisition_result.job_id=acquisition.id
       JOIN m02_jobs job ON job.id=$3
       LEFT JOIN source_repository_identities repository
         ON repository.provider=snapshot.provider
        AND repository.provider_repository_id=snapshot.provider_repository_id
       LEFT JOIN LATERAL (
         SELECT url.id,url.canonical_url
         FROM source_repository_urls url
         WHERE url.source_repository_id=repository.id AND url.state='ACTIVE'
         ORDER BY convert_to(url.id,'UTF8') LIMIT 1
       ) repository_url ON true
       LEFT JOIN source_repository_identities fork_repository
         ON fork_repository.provider=snapshot.provider
        AND fork_repository.provider_repository_id=
          NULLIF(acquisition_result.result #>> '{identityDiscovery,providerDeclaredForkRepositoryIdOrNull}','')
       LEFT JOIN LATERAL (
         SELECT array_agg(reference.id ORDER BY convert_to(reference.id,'UTF8')) AS evidence_ids
         FROM classification_evidence_references reference
         WHERE reference.classification_run_id=run.id
       ) evidence ON true
       LEFT JOIN LATERAL (
         SELECT link.id,link.target_resource_version_id,version.resource_identity_id,
           version.content_fingerprint,version.canonical_payload
         FROM resource_source_links link
         JOIN resource_version_identities version ON version.id=link.target_resource_version_id
         WHERE link.source_repository_id=repository.id
           AND link.normalized_root_path=root.normalized_root_path AND link.state='ACTIVE'
         ORDER BY convert_to(link.id,'UTF8') LIMIT 1
       ) source_link ON true
       LEFT JOIN LATERAL (
         SELECT observed.id FROM resource_version_observations observed
         WHERE observed.source_snapshot_id=candidate.source_snapshot_id
           AND observed.candidate_root_id=candidate.candidate_root_id
           AND observed.resource_source_link_id=source_link.id
         ORDER BY convert_to(observed.id,'UTF8') LIMIT 1
       ) observation ON true
       LEFT JOIN LATERAL (
         SELECT count(DISTINCT identifier.resource_identity_id) AS target_count,
           (array_agg(identifier.id ORDER BY convert_to(identifier.id,'UTF8')))[1] AS id,
           (array_agg(identifier.resource_identity_id
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS resource_identity_id,
           (array_agg(identifier.canonical_key_hash
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS canonical_key_hash,
           (array_agg(identifier.canonical_key_payload
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS canonical_key_payload,
           (array_agg(identifier.provenance
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS provenance,
           (array_agg(identifier.review_state
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS review_state,
           (array_agg(identifier.evidence_reference_id
             ORDER BY convert_to(identifier.id,'UTF8')))[1] AS evidence_reference_id
         FROM external_identifiers identifier
         WHERE identifier.provider=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,provider}'
           AND identifier.issuer=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,issuer}'
           AND identifier.namespace=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,namespace}'
           AND identifier.identifier_type=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,identifierType}'
           AND identifier.normalized_value=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,normalizedValue}'
           AND identifier.normalization_policy_version=
             acquisition_result.result #>> '{identityDiscovery,trustedExternalIdentifierOrNull,normalizationPolicyVersion}'
           AND (
             (identifier.provenance='M01_PROVIDER_ASSERTED'
               AND identifier.review_state IN ('UNREVIEWED','VERIFIED'))
             OR
             (identifier.provenance='HUMAN_VERIFIED_SOURCE_DECLARATION'
               AND identifier.review_state='VERIFIED')
           )
       ) external_target ON true
       LEFT JOIN resource_version_identities external_version
         ON external_version.resource_identity_id=external_target.resource_identity_id
        AND external_version.content_fingerprint=candidate.candidate_content_fingerprint
        AND external_version.status='IDENTITY_RESOLVED'
       LEFT JOIN LATERAL (
         SELECT count(*) OVER () AS target_count,version.id,version.resource_identity_id,
           version.canonical_payload
         FROM resource_version_identities version
         WHERE version.content_fingerprint=candidate.candidate_content_fingerprint
           AND version.status='IDENTITY_RESOLVED'
           AND version.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         ORDER BY convert_to(version.id,'UTF8') LIMIT 1
       ) content_target ON true
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(jsonb_build_object(
           'resourceIdentityId',version.resource_identity_id,
           'resourceVersionId',version.id,
           'guardAnchorCandidateId',identity.guard_anchor_candidate_id,
           'contentFingerprint',version.content_fingerprint,
           'canonicalPayloadFingerprint',encode(digest(version.canonical_payload,'sha256'),'hex')
         ) ORDER BY convert_to(version.id,'UTF8')) AS targets
         FROM resource_version_identities version
         JOIN resource_identities identity ON identity.id=version.resource_identity_id
         WHERE version.content_fingerprint=candidate.candidate_content_fingerprint
           AND version.status='IDENTITY_RESOLVED'
           AND version.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) content_targets ON true
       LEFT JOIN LATERAL (
         SELECT relationship.id,relationship.origin_source_repository_id,
           relationship.target_resource_version_id,relationship.evidence_ids,
           relationship.command_id,relationship.result_id,relationship.audit_event_id,
           version.resource_identity_id,version.content_fingerprint,version.canonical_payload
         FROM source_repository_relationships relationship
         JOIN resource_version_identities version
           ON version.id=relationship.target_resource_version_id
         WHERE relationship.mirror_source_repository_id=repository.id
           AND relationship.state='ACTIVE'
         ORDER BY convert_to(relationship.id,'UTF8') LIMIT 1
       ) reviewed_mirror ON true
       LEFT JOIN LATERAL (
         SELECT relationship.id,relationship.origin_resource_version_id,
           relationship.evidence_ids,relationship.command_id,relationship.result_id,
           relationship.audit_event_id
         FROM fork_relationships relationship
         WHERE relationship.fork_resource_version_id=source_link.target_resource_version_id
           AND relationship.state='ACTIVE'
         ORDER BY convert_to(relationship.id,'UTF8') LIMIT 1
       ) reviewed_fork ON true
       LEFT JOIN LATERAL (
         SELECT active.id,active.origin_type,active.system_operation_id,
           operation.controlling_job_id,operation.identity_decision_input_fingerprint
         FROM identity_decisions active
         LEFT JOIN m02_system_identity_operations operation
           ON operation.id=active.system_operation_id
         WHERE active.resource_candidate_id=candidate.id AND active.state='ACTIVE'
         ORDER BY convert_to(active.id,'UTF8') LIMIT 1
       ) decision ON true
       LEFT JOIN LATERAL (
         SELECT marker.id,marker.state,marker.controlling_m02_job_id,count(*) OVER () AS chain_count
         FROM m02_identity_handoff_markers marker
         WHERE marker.resource_candidate_id=candidate.id
           AND marker.identity_decision_id=decision.id
           AND marker.resource_identity_id=candidate.resource_identity_id
           AND marker.resource_version_identity_id=candidate.resource_version_identity_id
         ORDER BY marker.created_at DESC,convert_to(marker.id,'UTF8') DESC LIMIT 1
       ) handoff ON true
       WHERE candidate.id=$1 AND candidate.source_snapshot_id=$2`,
        [request.candidateId, request.sourceSnapshotId, request.controllingJobId],
      );
      const row = result.rows[0];
      if (row?.reconciled_classification_run_id !== request.reconciledClassificationRunId)
        throw new SystemIdentityMutationError(
          "EXPECTED_VERSION_SET_INVALID",
          "POST_PROJECTOR_PRE_ALLOCATION",
        );
      if (
        row.classification_policy_version !== request.classificationPolicyVersion ||
        row.identity_policy_version !== request.identityPolicyVersion ||
        row.evidence_ids.length === 0
      )
        throw new SystemIdentityMutationError(
          "EXPECTED_VERSION_SET_INVALID",
          "POST_PROJECTOR_PRE_ALLOCATION",
        );
      const evidenceReferenceIds = [...row.evidence_ids].sort(compareUtf8);
      if (
        row.provider !== "github" ||
        row.m01_canonical_url === null ||
        !/^https:\/\/github\.com\/[^/?#]+\/[^/?#]+$/u.test(row.m01_canonical_url)
      )
        throw discoveryChanged();
      const contentTargets = parseDiscoveredVersionTargets(row.content_targets);
      const exactNameMatches = parseExactNameMatches(row.p5_match_input);
      const weakNameMatch = parseWeakNameMatch(row.p6_match_input);
      if (
        contentTargets === undefined ||
        exactNameMatches === undefined ||
        weakNameMatch === undefined ||
        contentTargets.length !== Number(row.content_target_count) ||
        exactNameMatches.some(
          (match) =>
            match.normalizedSourceName !== row.reliable_identity_token ||
            match.normalizedSourceName.length === 0 ||
            match.normalizedSourceName.length > 2_000 ||
            match.creatorIdentityOrNull === "" ||
            match.organizationIdentityOrNull === "" ||
            match.evidenceReferenceIds.some((id) => !evidenceReferenceIds.includes(id)),
        ) ||
        weakNameMatch?.evidenceReferenceIds.some((id) => !evidenceReferenceIds.includes(id)) ===
          true
      )
        throw discoveryChanged();
      const namedInputs = [
        ...exactNameMatches.map((match) => ({
          resourceIdentityId: match.targetResourceIdentityId,
          resourceVersionId: match.targetResourceVersionId,
        })),
        ...(weakNameMatch === null
          ? []
          : [
              {
                resourceIdentityId: weakNameMatch.targetResourceIdentityId,
                resourceVersionId: weakNameMatch.targetResourceVersionId,
              },
            ]),
        ...(row.reviewed_mirror_target_identity_id === null ||
        row.reviewed_mirror_target_version_id === null
          ? []
          : [
              {
                resourceIdentityId: row.reviewed_mirror_target_identity_id,
                resourceVersionId: row.reviewed_mirror_target_version_id,
              },
            ]),
      ];
      const namedVersionIds = [...new Set(namedInputs.map((target) => target.resourceVersionId))];
      const namedTargetResult = await client.query<{
        resource_identity_id: string;
        resource_version_id: string;
        guard_anchor_candidate_id: string;
        content_fingerprint: string;
        canonical_payload_fingerprint: string;
      }>(
        `SELECT identity.id AS resource_identity_id,version.id AS resource_version_id,
           identity.guard_anchor_candidate_id,version.content_fingerprint,
           encode(digest(version.canonical_payload,'sha256'),'hex') AS canonical_payload_fingerprint
         FROM resource_version_identities version
         JOIN resource_identities identity ON identity.id=version.resource_identity_id
         WHERE version.id=ANY($1::text[]) AND version.status='IDENTITY_RESOLVED'
         ORDER BY convert_to(version.id,'UTF8')`,
        [namedVersionIds],
      );
      const namedTargets = namedTargetResult.rows.map((target) => ({
        resourceIdentityId: target.resource_identity_id,
        resourceVersionId: target.resource_version_id,
        guardAnchorCandidateId: target.guard_anchor_candidate_id,
        contentFingerprint: target.content_fingerprint,
        canonicalPayloadFingerprint: target.canonical_payload_fingerprint,
      }));
      const namedTargetByVersion = new Map(
        namedTargets.map((target) => [target.resourceVersionId, target]),
      );
      if (
        namedTargets.length !== namedVersionIds.length ||
        namedInputs.some(
          (target) =>
            namedTargetByVersion.get(target.resourceVersionId)?.resourceIdentityId !==
            target.resourceIdentityId,
        )
      )
        throw discoveryChanged();
      let externalIdentifierKey: ReturnType<typeof createExternalIdentifierKey> | undefined;
      if (row.external_identifier_lookup !== null) {
        const value = row.external_identifier_lookup;
        if (typeof value !== "object" || Array.isArray(value)) throw discoveryChanged();
        const object = value as Readonly<Record<string, unknown>>;
        const keys = Object.keys(object).sort(compareUtf8);
        const expectedKeys = [
          "identifierType",
          "issuer",
          "namespace",
          "normalizationPolicyVersion",
          "normalizedValue",
          "provider",
        ].sort(compareUtf8);
        if (
          keys.length !== expectedKeys.length ||
          keys.some((key, index) => key !== expectedKeys[index]) ||
          object.provider !== "github" ||
          (object.identifierType !== "PROVIDER_REPOSITORY_ID" &&
            object.identifierType !== "DECLARED_MANIFEST_ID") ||
          object.normalizationPolicyVersion !== "external-id-v1" ||
          typeof object.issuer !== "string" ||
          typeof object.namespace !== "string" ||
          typeof object.normalizedValue !== "string"
        )
          throw discoveryChanged();
        try {
          externalIdentifierKey = createExternalIdentifierKey({
            provider: object.provider,
            identifierType: object.identifierType,
            issuer: `https://${object.issuer}/`,
            namespace: object.namespace,
            normalizedValue: object.normalizedValue,
            normalizationPolicyVersion: object.normalizationPolicyVersion,
          });
        } catch {
          throw discoveryChanged();
        }
        if (
          !Buffer.from(canonicalM02JsonBytes(value as CanonicalM02Value)).equals(
            Buffer.from(externalIdentifierKey.canonicalPayload),
          )
        )
          throw discoveryChanged();
      }
      const exactContentPayload = (payload: Buffer | null): boolean =>
        payload !== null &&
        Buffer.from(payload).equals(Buffer.from(row.candidate_canonical_payload));
      const p1UrlMatches =
        row.source_repository_url_id !== null &&
        row.source_repository_canonical_url === row.m01_canonical_url;
      const p1UrlConflict = row.active_source_link_id !== null && !p1UrlMatches;
      const p1 = row.active_source_link_id !== null && p1UrlMatches;
      const p1SameContent =
        p1 && row.active_source_link_content_fingerprint === row.candidate_content_fingerprint;
      const p1Collision =
        p1SameContent && !exactContentPayload(row.active_source_link_canonical_payload);
      const externalTargetCount = Number(row.external_target_count);
      const contentTargetCount = Number(row.content_target_count);
      if (
        externalTargetCount === 1 &&
        (externalIdentifierKey === undefined ||
          row.external_target_identifier_id === null ||
          row.external_target_identity_id === null ||
          row.external_target_canonical_key_hash !== externalIdentifierKey.fingerprint ||
          row.external_target_canonical_key_payload === null ||
          !Buffer.from(row.external_target_canonical_key_payload).equals(
            Buffer.from(externalIdentifierKey.canonicalPayload),
          ) ||
          row.external_target_evidence_reference_id === null ||
          !(
            (row.external_target_provenance === "M01_PROVIDER_ASSERTED" &&
              ["UNREVIEWED", "VERIFIED"].includes(row.external_target_review_state ?? "")) ||
            (row.external_target_provenance === "HUMAN_VERIFIED_SOURCE_DECLARATION" &&
              row.external_target_review_state === "VERIFIED")
          ))
      )
        throw discoveryChanged();
      const p2 =
        externalIdentifierKey !== undefined &&
        externalTargetCount === 1 &&
        row.external_target_identity_id !== null;
      const p2EvidenceReferenceIds =
        row.external_target_evidence_reference_id === null
          ? evidenceReferenceIds
          : [row.external_target_evidence_reference_id];
      const p2SameContent = p2 && row.external_target_version_id !== null;
      const p1P2Conflict =
        p1 && p2 && row.active_source_link_identity_id !== row.external_target_identity_id;
      const contentCollision =
        contentTargetCount === 1 && !exactContentPayload(row.content_target_canonical_payload);
      const p5TargetVersionIds = [
        ...new Set(exactNameMatches.map((match) => match.targetResourceVersionId)),
      ].sort(compareUtf8);
      const p5Target =
        p5TargetVersionIds.length === 1
          ? namedTargetByVersion.get(requiredValue(p5TargetVersionIds[0]))
          : undefined;
      const p6Target =
        weakNameMatch === null
          ? undefined
          : namedTargetByVersion.get(weakNameMatch.targetResourceVersionId);
      const reviewedMirrorEvidenceIds = [...(row.reviewed_mirror_evidence_ids ?? [])].sort(
        compareUtf8,
      );
      const reviewedMirrorDivergent =
        row.reviewed_mirror_relationship_id !== null &&
        (row.reviewed_mirror_target_content_fingerprint !== row.candidate_content_fingerprint ||
          !exactContentPayload(row.reviewed_mirror_target_canonical_payload));
      const reviewedMirrorHumanOwned =
        row.reviewed_mirror_relationship_id !== null &&
        row.reviewed_mirror_command_id !== null &&
        row.reviewed_mirror_result_id !== null &&
        row.reviewed_mirror_audit_event_id !== null;
      const reviewedIndependentForkHumanOwned =
        row.reviewed_fork_relationship_id !== null &&
        row.reviewed_fork_origin_version_id !== null &&
        row.reviewed_fork_command_id !== null &&
        row.reviewed_fork_result_id !== null &&
        row.reviewed_fork_audit_event_id !== null;
      if (
        (reviewedMirrorHumanOwned && !reviewedMirrorDivergent) ||
        reviewedIndependentForkHumanOwned
      )
        throw discoveryChanged();
      const reanalysis = row.replacement_source_job_id !== null && row.prior_decision_id !== null;
      const replacementChainValid =
        row.replacement_edge_count === "1" &&
        row.replacement_command_result_count === "1" &&
        row.replacement_handoff_provenance_count === "1" &&
        row.replacement_input_payload !== null &&
        row.replacement_input_fingerprint !== null &&
        fingerprint(row.replacement_input_payload) === row.replacement_input_fingerprint &&
        row.prior_decision_origin_type === "SYSTEM_IDENTITY_OPERATION" &&
        row.prior_decision_system_operation_id !== null &&
        row.prior_decision_controller_id === row.replacement_source_job_id &&
        row.prior_handoff_state === "SUPERSEDED" &&
        row.prior_handoff_controller_id === row.replacement_source_job_id &&
        row.prior_handoff_chain_count === "1";
      const sameResolvedTarget =
        row.candidate_resource_identity_id !== null &&
        row.candidate_resource_version_identity_id !== null &&
        row.active_source_link_identity_id === row.candidate_resource_identity_id &&
        row.active_source_link_version_id === row.candidate_resource_version_identity_id &&
        p1SameContent &&
        !p1Collision;
      const reanalysisConflict =
        p1Collision ||
        p1UrlConflict ||
        p1P2Conflict ||
        reviewedMirrorDivergent ||
        contentCollision ||
        contentTargetCount > 1 ||
        p5TargetVersionIds.length > 1 ||
        externalTargetCount > 1 ||
        (p2 && row.external_target_identity_id !== row.candidate_resource_identity_id);
      const siblingSuffix = Number(row.unresolved_sibling_count) === 0 ? "JC" : "JR";
      let mode: SystemIdentityProjectorModeId;
      if (reanalysis) {
        if (!replacementChainValid)
          throw new SystemIdentityMutationError(
            "MUTATION_PLAN_CHANGED",
            "POST_PROJECTOR_PRE_ALLOCATION",
          );
        mode =
          sameResolvedTarget && !reanalysisConflict ? (`S9_${siblingSuffix}` as const) : "S10_JR";
      } else if (
        row.open_clarification_count !== "0" ||
        row.prior_decision_id !== null ||
        row.prior_handoff_id !== null
      ) {
        throw discoveryChanged();
      } else if (
        p1Collision ||
        p1UrlConflict ||
        p1P2Conflict ||
        reviewedMirrorDivergent ||
        contentCollision ||
        contentTargetCount > 1 ||
        p5TargetVersionIds.length > 1 ||
        externalTargetCount > 1
      ) {
        mode = "S6_JR";
      } else if (p1) {
        mode = p1SameContent ? (`S3_${siblingSuffix}` as const) : (`S2_${siblingSuffix}` as const);
      } else if (p2) {
        mode = p2SameContent
          ? (`S4_${row.source_repository_id === null ? "R0" : "R1"}_${siblingSuffix}` as const)
          : (`S5_${row.source_repository_id === null ? "R0" : "R1"}_${siblingSuffix}` as const);
      } else if (
        row.provider_fork_repository_id !== null &&
        row.provider_fork_source_repository_id !== null
      ) {
        mode = "S8_JR";
      } else if (contentTargetCount === 1 && row.content_target_version_id !== null) {
        mode = "S7_JR";
      } else if (p5Target !== undefined) {
        mode = "S7_JR";
      } else if (row.reliable_identity_token !== null) {
        mode = `S1_${row.source_repository_id === null ? "R0" : "R1"}_${siblingSuffix}` as const;
      } else {
        mode = "S6_JR";
      }
      const tiers: IdentityTierEvaluationV1[] = TIERS.map((tier) => ({
        tier,
        evaluationDisposition: "NO_MATCH",
      }));
      const signals: IdentityTrustedSignalV1[] = [];
      const conflicts: IdentityDecisionConflictV1[] = [];
      const winTier = (tier: IdentityTierV1): void => {
        const index = TIERS.indexOf(tier);
        tiers[index] = { tier, evaluationDisposition: "MATCH" };
        for (let ordinal = index + 1; ordinal < tiers.length; ordinal += 1)
          tiers[ordinal] = {
            tier: TIERS[ordinal] ?? "P6",
            evaluationDisposition: "NOT_APPLICABLE",
          };
      };
      const stopTier = (
        tier: IdentityTierV1,
        disposition: "CONFLICT" | "MULTIPLE_TARGETS",
      ): void => {
        const index = TIERS.indexOf(tier);
        tiers[index] = { tier, evaluationDisposition: disposition };
        for (let ordinal = index + 1; ordinal < tiers.length; ordinal += 1)
          tiers[ordinal] = {
            tier: TIERS[ordinal] ?? "P6",
            evaluationDisposition: "NOT_APPLICABLE",
          };
      };
      if (mode.startsWith("S2_") || mode.startsWith("S3_") || mode.startsWith("S9_")) {
        winTier("P1");
        signals.push({
          tier: "P1",
          signalType: "P1_ACTIVE_SOURCE_LINK",
          targetTypeOrNull: "RESOURCE_VERSION",
          targetIdOrNull: mode.startsWith("S2_")
            ? row.active_source_link_version_id
            : (row.candidate_resource_version_identity_id ?? row.active_source_link_version_id),
          evidenceReferenceIds,
        });
      } else if (mode.startsWith("S4_") || mode.startsWith("S5_")) {
        winTier("P2");
        signals.push({
          tier: "P2",
          signalType: "P2_TRUSTED_EXTERNAL_IDENTIFIER",
          targetTypeOrNull:
            row.external_target_version_id === null ? "RESOURCE_IDENTITY" : "RESOURCE_VERSION",
          targetIdOrNull: row.external_target_version_id ?? row.external_target_identity_id,
          evidenceReferenceIds: p2EvidenceReferenceIds,
        });
      } else if (mode === "S7_JR" && contentTargetCount === 1) {
        winTier("P4");
        signals.push({
          tier: "P4",
          signalType: "P4_CANDIDATE_CONTENT_FINGERPRINT",
          targetTypeOrNull: "RESOURCE_VERSION",
          targetIdOrNull: row.content_target_version_id,
          evidenceReferenceIds,
        });
      } else if (mode === "S7_JR" && p5Target !== undefined) {
        winTier("P5");
        const p5EvidenceReferenceIds = [
          ...new Set(exactNameMatches.flatMap((match) => match.evidenceReferenceIds)),
        ].sort(compareUtf8);
        if (exactNameMatches.some((match) => match.creatorIdentityOrNull !== null))
          signals.push({
            tier: "P5",
            signalType: "P5_CREATOR_IDENTITY",
            targetTypeOrNull: "RESOURCE_VERSION",
            targetIdOrNull: p5Target.resourceVersionId,
            evidenceReferenceIds: p5EvidenceReferenceIds,
          });
        if (exactNameMatches.some((match) => match.organizationIdentityOrNull !== null))
          signals.push({
            tier: "P5",
            signalType: "P5_ORGANIZATION_IDENTITY",
            targetTypeOrNull: "RESOURCE_VERSION",
            targetIdOrNull: p5Target.resourceVersionId,
            evidenceReferenceIds: p5EvidenceReferenceIds,
          });
        signals.push({
          tier: "P5",
          signalType: "P5_SOURCE_NAME",
          targetTypeOrNull: "RESOURCE_VERSION",
          targetIdOrNull: p5Target.resourceVersionId,
          evidenceReferenceIds: p5EvidenceReferenceIds,
        });
      } else if (mode === "S8_JR") {
        winTier("P3");
        signals.push({
          tier: "P3",
          signalType: "P3_PROVIDER_DECLARED_FORK_PROVENANCE",
          targetTypeOrNull: "SOURCE_REPOSITORY",
          targetIdOrNull: row.provider_fork_source_repository_id,
          evidenceReferenceIds,
        });
      } else if (mode === "S6_JR" || mode === "S10_JR") {
        if (
          mode === "S10_JR" ||
          p1Collision ||
          p1UrlConflict ||
          p1P2Conflict ||
          (reviewedMirrorDivergent && p1)
        )
          stopTier("P1", "CONFLICT");
        else if (externalTargetCount > 1) stopTier("P2", "MULTIPLE_TARGETS");
        else if (reviewedMirrorDivergent) stopTier("P3", "CONFLICT");
        else if (contentTargetCount > 1) stopTier("P4", "MULTIPLE_TARGETS");
        else if (p5TargetVersionIds.length > 1) stopTier("P5", "MULTIPLE_TARGETS");
        else if (contentCollision) stopTier("P4", "CONFLICT");
        conflicts.push({
          code:
            p1P2Conflict || (mode === "S10_JR" && p2)
              ? "TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT"
              : reviewedMirrorDivergent
                ? "DIVERGENT_MIRROR_CONTENT"
                : p1UrlConflict
                  ? "PROVENANCE_SIGNAL_CONFLICT"
                  : p1Collision || contentCollision
                    ? "CONTENT_FINGERPRINT_PAYLOAD_COLLISION"
                    : externalTargetCount > 1 ||
                        contentTargetCount > 1 ||
                        p5TargetVersionIds.length > 1
                      ? "MULTIPLE_CANONICAL_TARGETS"
                      : row.reliable_identity_token === null
                        ? "MISSING_OR_UNRELIABLE_IDENTITY_TOKEN"
                        : "PROVENANCE_SIGNAL_CONFLICT",
          targets: [
            ...(row.candidate_resource_version_identity_id === null
              ? []
              : [
                  {
                    targetType: "RESOURCE_VERSION" as const,
                    targetId: row.candidate_resource_version_identity_id,
                  },
                ]),
            ...(mode === "S10_JR" &&
            row.external_target_identity_id !== null &&
            row.external_target_identity_id !== row.candidate_resource_identity_id
              ? [
                  {
                    targetType: "RESOURCE_IDENTITY" as const,
                    targetId: row.external_target_identity_id,
                  },
                ]
              : []),
            ...(p1P2Conflict && row.active_source_link_version_id !== null
              ? [
                  {
                    targetType: "RESOURCE_VERSION" as const,
                    targetId: row.active_source_link_version_id,
                  },
                ]
              : []),
            ...(p1P2Conflict
              ? [
                  {
                    targetType: "RESOURCE_IDENTITY" as const,
                    targetId: row.external_target_identity_id,
                  },
                ]
              : []),
            ...(contentTargetCount > 1
              ? contentTargets.map((target) => ({
                  targetType: "RESOURCE_VERSION" as const,
                  targetId: target.resourceVersionId,
                }))
              : []),
            ...(p5TargetVersionIds.length > 1
              ? p5TargetVersionIds.map((targetId) => ({
                  targetType: "RESOURCE_VERSION" as const,
                  targetId,
                }))
              : []),
            ...(reviewedMirrorDivergent && row.reviewed_mirror_origin_repository_id !== null
              ? [
                  {
                    targetType: "SOURCE_REPOSITORY" as const,
                    targetId: row.reviewed_mirror_origin_repository_id,
                  },
                ]
              : []),
            ...(mode === "S6_JR" && row.reliable_identity_token === null && p6Target !== undefined
              ? [
                  {
                    targetType: "RESOURCE_VERSION" as const,
                    targetId: p6Target.resourceVersionId,
                  },
                ]
              : []),
          ]
            .sort((left, right) =>
              compareUtf8(
                `${left.targetType}\u001f${left.targetId}`,
                `${right.targetType}\u001f${right.targetId}`,
              ),
            )
            .filter(
              (target, index, targets) =>
                index === 0 ||
                target.targetType !== targets[index - 1]?.targetType ||
                target.targetId !== targets[index - 1]?.targetId,
            ),
          evidenceReferenceIds:
            reviewedMirrorDivergent && reviewedMirrorEvidenceIds.length > 0
              ? reviewedMirrorEvidenceIds
              : p1P2Conflict
                ? [...new Set([...evidenceReferenceIds, ...p2EvidenceReferenceIds])].sort(
                    compareUtf8,
                  )
                : evidenceReferenceIds,
        });
      }
      if (
        (mode.startsWith("S1_") || mode === "S6_JR") &&
        weakNameMatch !== null &&
        p6Target !== undefined &&
        !signals.some((signal) => signal.tier === "P6")
      ) {
        winTier("P6");
        signals.push({
          tier: "P6",
          signalType: "P6_WEAK_SIMILAR_NAME",
          targetTypeOrNull: "RESOURCE_VERSION",
          targetIdOrNull: p6Target.resourceVersionId,
          evidenceReferenceIds: weakNameMatch.evidenceReferenceIds,
        });
      }
      signals.sort((left, right) => {
        const tierOrder = TIERS.indexOf(left.tier) - TIERS.indexOf(right.tier);
        if (tierOrder !== 0) return tierOrder;
        const typeOrder = compareUtf8(left.signalType, right.signalType);
        if (typeOrder !== 0) return typeOrder;
        return compareUtf8(left.targetIdOrNull ?? "", right.targetIdOrNull ?? "");
      });
      const identityDecisionInput: IdentityDecisionInputV1 = {
        schemaVersion: "1",
        sourceSnapshotId: row.source_snapshot_id,
        candidateId: request.candidateId,
        candidateRootFingerprint: row.candidate_root_fingerprint,
        candidateContentFingerprint: row.candidate_content_fingerprint,
        reconciledClassificationRunId: row.reconciled_classification_run_id,
        classificationRunInputFingerprint: row.classification_run_input_fingerprint,
        classificationRunOutputFingerprint: row.classification_run_output_fingerprint,
        analysisRunIdOrNull: row.classification_analysis_run_id,
        analysisRunRequestFingerprintOrNull: row.classification_analysis_run_request_fingerprint,
        analysisRunResponseFingerprintOrNull: row.classification_analysis_run_response_fingerprint,
        classificationPolicyVersion: row.classification_policy_version,
        identityPolicyVersion: row.identity_policy_version,
        analysisPolicyVersion: row.analysis_policy_version,
        parserProfileVersion: row.parser_profile_version,
        promptBundleVersion: row.prompt_bundle_version,
        evaluatedTierSequence: tiers,
        trustedSignals: signals,
        conflicts,
      };
      if (
        reanalysis &&
        canonicalizeIdentityDecisionInput(identityDecisionInput).fingerprint ===
          row.prior_decision_input_fingerprint
      )
        throw discoveryChanged();
      return {
        automaticProjectorModeId: mode,
        candidateId: request.candidateId,
        controllingJobId: request.controllingJobId,
        systemActorId: SYSTEM_ACTOR_ID,
        identityDecisionInput,
        canonicalRepositoryUrl: row.m01_canonical_url,
        reliableIdentityTokenOrNull: row.reliable_identity_token,
        externalIdentifierIdOrNull: row.external_target_identifier_id,
        externalIdentifierKeyFingerprintOrNull: row.external_target_canonical_key_hash,
        externalIdentifierKeyPayloadOrNull: row.external_target_canonical_key_payload,
        externalIdentifierProvenanceOrNull: row.external_target_provenance,
        externalIdentifierReviewStateOrNull: row.external_target_review_state,
        externalIdentifierEvidenceReferenceIdOrNull: row.external_target_evidence_reference_id,
        targetResourceIdentityIdOrNull:
          mode.startsWith("S2_") || mode.startsWith("S3_")
            ? row.active_source_link_identity_id
            : mode.startsWith("S4_") || mode.startsWith("S5_")
              ? row.external_target_identity_id
              : mode.startsWith("S9_") || mode === "S10_JR"
                ? row.candidate_resource_identity_id
                : null,
        targetResourceVersionIdentityIdOrNull:
          mode.startsWith("S3_") || mode.startsWith("S4_")
            ? (row.active_source_link_version_id ?? row.external_target_version_id)
            : mode.startsWith("S9_") || mode === "S10_JR"
              ? row.candidate_resource_version_identity_id
              : null,
        priorResourceVersionIdentityIdOrNull: mode.startsWith("S2_")
          ? row.active_source_link_version_id
          : null,
        activeSourceLinkIdOrNull:
          mode.startsWith("S2_") || mode.startsWith("S3_") ? row.active_source_link_id : null,
        duplicateTargetResourceVersionIdOrNull:
          mode === "S7_JR"
            ? (row.content_target_version_id ?? p5Target?.resourceVersionId ?? null)
            : null,
        forkSourceRepositoryIdOrNull:
          mode === "S8_JR" ? row.provider_fork_source_repository_id : null,
        frozenResourceVersionTargets: [
          ...new Map(
            [...contentTargets, ...namedTargets]
              .sort((left, right) => compareUtf8(left.resourceVersionId, right.resourceVersionId))
              .map((target) => [target.resourceVersionId, target]),
          ).values(),
        ],
        sourceRepositoryUrlIdOrNull: row.source_repository_url_id,
        sourceRepositoryUrlOrNull: row.source_repository_canonical_url,
        reviewedMirrorRelationshipIdOrNull: row.reviewed_mirror_relationship_id,
      };
    } finally {
      ownedClient?.release();
    }
  }

  public async execute(
    request: SystemIdentityMutationRequestV1,
  ): Promise<SystemIdentityMutationResultV1> {
    const replay = buildSystemIdentityReplayLocator({
      sourceSnapshotId: request.sourceSnapshotId,
      candidateId: request.candidateId,
      controllingJobId: request.controllingJobId,
      reconciledClassificationRunId: request.reconciledClassificationRunId,
      classificationPolicyVersion: request.classificationPolicyVersion,
      identityPolicyVersion: request.identityPolicyVersion,
      systemActorId: SYSTEM_ACTOR_ID,
    });
    let immutableFrozen: FrozenSystemOperation | undefined;
    let lastAttempt:
      | Readonly<{
          derived: DerivedSystemIdentityMutation;
          context: MutableIdentityContext;
          frozen: FrozenSystemMutationAttempt;
        }>
      | undefined;
    let lastSerializationError: unknown;
    let attemptCount = 0;
    while (attemptCount < this.maxAttempts) {
      const early = await this.lookupReplay(replay);
      if (early !== undefined) return resultFromRow(early, true, attemptCount);

      const preProjector = await this.loadPreProjectorContext(request);
      try {
        this.assertPreProjector(preProjector);
      } catch (error) {
        if (error instanceof SystemIdentityMutationError)
          await this.persistRejection(
            {
              candidateId: request.candidateId,
              controllingJobId: request.controllingJobId,
              systemActorId: SYSTEM_ACTOR_ID,
            },
            preProjector,
            replay,
            error,
          );
        throw error;
      }

      const derived = await this.deriveAuthoritativeMutation(request);
      const context = await this.loadContext(derived);
      try {
        this.assertPreProjector(context);
      } catch (error) {
        if (error instanceof SystemIdentityMutationError)
          await this.persistRejection(derived, context, replay, error);
        throw error;
      }

      let currentFrozen: FrozenSystemOperation | undefined;
      let preflightDerived: DerivedSystemIdentityMutation;
      let preflight: MutableIdentityContext;
      try {
        this.assertInputMatchesContext(derived, context);
        currentFrozen = this.freeze(derived, context, replay);
        await this.options.onFrozen?.({
          replayLookupKey: replay.lookupKey,
          identityDecisionInputFingerprint: currentFrozen.canonicalInput.fingerprint,
          idempotencyKey: currentFrozen.idempotencyKey,
          systemOperationFingerprint: currentFrozen.operationFingerprint,
        });
        const fullReplay = await this.lookupIdempotency(currentFrozen);
        if (fullReplay !== undefined) return resultFromRow(fullReplay, true, attemptCount);

        preflightDerived = await this.deriveAuthoritativeMutation(request);
        if (derivedAuthorityFingerprint(preflightDerived) !== currentFrozen.authorityFingerprint)
          throw new SystemIdentityMutationError(
            "EXPECTED_VERSION_SET_INVALID",
            "POST_PROJECTOR_PRE_ALLOCATION",
          );
        preflight = await this.loadContext(preflightDerived);
        this.assertPreProjector(preflight);
        this.assertInputMatchesContext(preflightDerived, preflight);
        this.assertExpectedVersions(
          currentFrozen.expectedVersions,
          preflight,
          "POST_PROJECTOR_PRE_ALLOCATION",
        );
        if (immutableFrozen !== undefined) {
          this.assertExpectedVersionMaps(
            immutableFrozen.expectedVersions,
            currentFrozen.expectedVersions,
            "POST_PROJECTOR_PRE_ALLOCATION",
          );
          if (!this.frozenConcurrencyPlanEquals(immutableFrozen, currentFrozen))
            throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
        } else {
          immutableFrozen = currentFrozen;
        }
      } catch (error) {
        if (error instanceof SystemIdentityMutationError) {
          const retainedFrozen = immutableFrozen ?? currentFrozen;
          const retainedAttempt = error.phase === "TRANSACTION_ATTEMPT" ? lastAttempt : undefined;
          if (retainedFrozen !== undefined)
            await this.persistRejection(
              retainedAttempt?.derived ?? derived,
              retainedAttempt?.context ?? context,
              replay,
              error,
              retainedAttempt?.frozen ?? retainedFrozen,
              retainedAttempt?.frozen.ids.operationId,
            );
        }
        throw error;
      }

      const ids = allocateIds(
        preflightDerived.identityDecisionInput,
        preflightDerived.automaticProjectorModeId,
        this.options.idAllocator ?? allocateM02Id,
      );
      const frozen = this.freezeMutationPlan(
        requiredValue(currentFrozen),
        preflightDerived,
        preflight,
        ids,
      );
      await this.options.onPlanFrozen?.({
        concurrencyPlanFingerprint: frozen.concurrencyPlanFingerprint,
        mutationPlanFingerprint: frozen.mutationPlanFingerprint,
        systemOperationId: frozen.ids.operationId,
      });
      lastAttempt = { derived: preflightDerived, context: preflight, frozen };
      attemptCount += 1;
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        await client.query(`SET LOCAL search_path TO ${this.schema}, public`);
        await client.query("SET CONSTRAINTS ALL DEFERRED");
        await this.options.onTransactionAttempt?.(attemptCount, client);
        await this.lockFrozenRequirements(client, frozen);
        const lockedDerived = await this.deriveAuthoritativeMutation(request, client);
        const locked = await this.queryContext(client, lockedDerived);
        this.assertPreProjector(locked);
        this.assertInputMatchesContext(lockedDerived, locked, "TRANSACTION_ATTEMPT");
        const lockedFrozen = this.freezeMutationPlan(
          this.freeze(lockedDerived, locked, replay),
          lockedDerived,
          locked,
          ids,
          frozen.writtenAt,
        );
        if (
          !Buffer.from(frozen.mutationPlanPayload).equals(
            Buffer.from(lockedFrozen.mutationPlanPayload),
          )
        )
          throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
        this.assertExpectedVersions(frozen.expectedVersions, locked, "TRANSACTION_ATTEMPT");
        await this.persistPlanInitial(client, frozen, locked.guard_versions, locked.guard_payloads);
        await client.query("SET CONSTRAINTS ALL IMMEDIATE");
        await client.query("COMMIT");
        const accepted = await this.lookupReplay(replay);
        if (accepted === undefined)
          throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
        return resultFromRow(accepted, false, attemptCount);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        const databaseCode = (error as { code?: string }).code;
        if (databaseCode === "40001" || databaseCode === "23505") {
          const accepted = await this.lookupReplay(replay);
          if (accepted !== undefined) return resultFromRow(accepted, true, attemptCount);
        }
        if (databaseCode === "23505") {
          let carefullyRetryable: boolean;
          try {
            carefullyRetryable = await this.verifyUniqueConflict(error, frozen);
          } catch (collisionError) {
            if (!(collisionError instanceof SystemIdentityMutationError)) throw collisionError;
            await this.persistRejection(
              derived,
              context,
              replay,
              collisionError,
              frozen,
              frozen.ids.operationId,
            );
            throw collisionError;
          }
          if (carefullyRetryable) {
            try {
              const currentDerived = await this.deriveAuthoritativeMutation(request);
              if (derivedAuthorityFingerprint(currentDerived) !== frozen.authorityFingerprint)
                throw new SystemIdentityMutationError(
                  "MUTATION_PLAN_CHANGED",
                  "TRANSACTION_ATTEMPT",
                );
              const currentContext = await this.loadContext(currentDerived);
              this.assertExpectedVersions(
                frozen.expectedVersions,
                currentContext,
                "TRANSACTION_ATTEMPT",
              );
            } catch (classificationError) {
              if (!(classificationError instanceof SystemIdentityMutationError))
                throw classificationError;
              await this.persistRejection(
                preflightDerived,
                preflight,
                replay,
                classificationError,
                frozen,
                frozen.ids.operationId,
              );
              throw classificationError;
            }
            lastSerializationError = error;
            continue;
          }
          const mapped = new SystemIdentityMutationError(
            "MUTATION_PLAN_CHANGED",
            "TRANSACTION_ATTEMPT",
            { cause: error },
          );
          await this.persistRejection(
            preflightDerived,
            preflight,
            replay,
            mapped,
            frozen,
            frozen.ids.operationId,
          );
          throw mapped;
        }
        if (databaseCode === "40001") {
          lastSerializationError = error;
          continue;
        }
        if (error instanceof SystemIdentityMutationError)
          await this.persistRejection(
            preflightDerived,
            preflight,
            replay,
            error,
            frozen,
            frozen.ids.operationId,
          );
        throw error;
      } finally {
        client.release();
      }
    }
    const exhausted = new SystemIdentityMutationError(
      "SERIALIZATION_RETRY_EXHAUSTED",
      "TRANSACTION_ATTEMPT",
      {
        cause: lastSerializationError,
      },
    );
    const exhaustedAttempt = requiredValue(lastAttempt);
    await this.persistRejection(
      exhaustedAttempt.derived,
      exhaustedAttempt.context,
      replay,
      exhausted,
      exhaustedAttempt.frozen,
      exhaustedAttempt.frozen.ids.operationId,
    );
    throw exhausted;
  }

  private async lookupReplay(
    locator: FrozenSystemIdentityReplayLocator,
  ): Promise<ResultRow | undefined> {
    const result = await this.pool.query<ResultRow & { system_replay_locator_payload: Buffer }>(
      `SELECT result.*, operation.system_replay_locator_payload
       FROM ${this.schema}.m02_system_identity_operations operation
       JOIN ${this.schema}.m02_system_identity_results result ON result.system_operation_id=operation.id
       WHERE operation.system_replay_lookup_key=$1`,
      [locator.lookupKey],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    if (!Buffer.from(row.system_replay_locator_payload).equals(Buffer.from(locator.payload)))
      throw new SystemIdentityMutationError("FINGERPRINT_COLLISION", "PRE_PROJECTOR");
    return row;
  }

  private async lookupIdempotency(frozen: FrozenSystemOperation): Promise<ResultRow | undefined> {
    const result = await this.pool.query<
      ResultRow & { idempotency_payload: Buffer; system_replay_locator_payload: Buffer }
    >(
      `SELECT result.*, operation.idempotency_payload, operation.system_replay_locator_payload
       FROM ${this.schema}.m02_system_identity_operations operation
       JOIN ${this.schema}.m02_system_identity_results result ON result.system_operation_id=operation.id
       WHERE operation.idempotency_scope='M02_SYSTEM_IDENTITY_PROJECTION_V1'
         AND operation.idempotency_key=$1`,
      [frozen.idempotencyKey],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    if (
      !Buffer.from(row.idempotency_payload).equals(Buffer.from(frozen.idempotencyPayload)) ||
      !Buffer.from(row.system_replay_locator_payload).equals(Buffer.from(frozen.replay.payload))
    )
      throw new SystemIdentityMutationError(
        "FINGERPRINT_COLLISION",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    return row;
  }

  private async verifyUniqueConflict(
    error: unknown,
    frozen: FrozenSystemOperation,
  ): Promise<boolean> {
    const databaseError = error as { readonly constraint?: string; readonly detail?: string };
    if (databaseError.constraint === "m02_concurrency_guards_pkey") {
      const detail = databaseError.detail ?? "";
      const detailPrefix = "Key (guard_key)=(";
      const detailSuffix = ") already exists.";
      const guardKey =
        detail.startsWith(detailPrefix) && detail.endsWith(detailSuffix)
          ? detail.slice(detailPrefix.length, -detailSuffix.length)
          : undefined;
      const guard = frozen.guards.find((candidate) => candidate.key === guardKey);
      if (guardKey === undefined || !guardKey.startsWith("guard:") || guard === undefined)
        return false;
      const actual = await this.pool.query<{
        guard_type: string;
        canonical_payload: Buffer;
        payload_hash: string;
        record_version: string;
      }>(
        `SELECT guard_type,canonical_payload,payload_hash,record_version
         FROM ${this.schema}.m02_concurrency_guards WHERE guard_key=$1`,
        [guardKey],
      );
      const row = actual.rows[0];
      if (row === undefined) return false;
      if (
        row.guard_type !== guard.guardType ||
        row.payload_hash !== guard.payloadHash ||
        !Buffer.from(row.canonical_payload).equals(Buffer.from(guard.canonicalPayload))
      )
        throw new SystemIdentityMutationError("CONCURRENCY_GUARD_COLLISION", "TRANSACTION_ATTEMPT");
      return frozen.expectedVersions[guardKey] === null && Number(row.record_version) === 1;
    }

    if (
      databaseError.constraint ===
      "m02_system_identity_operations_idempotency_scope_idempotency_key_key"
    ) {
      const actual = await this.pool.query<{ idempotency_payload: Buffer }>(
        `SELECT idempotency_payload FROM ${this.schema}.m02_system_identity_operations
         WHERE idempotency_scope='M02_SYSTEM_IDENTITY_PROJECTION_V1' AND idempotency_key=$1`,
        [frozen.idempotencyKey],
      );
      const row = actual.rows[0];
      return (
        row !== undefined &&
        Buffer.from(row.idempotency_payload).equals(Buffer.from(frozen.idempotencyPayload))
      );
    }

    if (
      databaseError.constraint === "m02_system_identity_operations_system_replay_lookup_key_key" ||
      databaseError.constraint ===
        "m02_system_identity_operations_system_replay_lookup_key_system_replay_locator_payload_key"
    ) {
      const actual = await this.pool.query<{ system_replay_locator_payload: Buffer }>(
        `SELECT system_replay_locator_payload
         FROM ${this.schema}.m02_system_identity_operations
         WHERE system_replay_lookup_key=$1`,
        [frozen.replay.lookupKey],
      );
      const row = actual.rows[0];
      return (
        row !== undefined &&
        Buffer.from(row.system_replay_locator_payload).equals(Buffer.from(frozen.replay.payload))
      );
    }
    return false;
  }

  private async loadContext(
    request: DerivedSystemIdentityMutation,
  ): Promise<MutableIdentityContext> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${this.schema}, public`);
      return await this.queryContext(client, request);
    } finally {
      client.release();
    }
  }

  private async lockFrozenRequirements(
    client: PoolClient,
    frozen: FrozenSystemOperation,
  ): Promise<void> {
    const guardKeys = frozen.guards.map((guard) => guard.key).sort(compareUtf8);
    for (const key of guardKeys)
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
    await client.query(
      "SELECT guard_key FROM m02_concurrency_guards WHERE guard_key=ANY($1::text[]) ORDER BY guard_key FOR UPDATE",
      [guardKeys],
    );
    const allowedTables = new Set([
      "acquisition_jobs",
      "candidate_roots",
      "duplicate_candidates",
      "external_identifiers",
      "identity_decisions",
      "m02_clarification_requests",
      "m02_identity_handoff_markers",
      "m02_jobs",
      "m02_review_states",
      "repository_candidate_groups",
      "resource_candidates",
      "resource_identities",
      "resource_source_links",
      "resource_version_identities",
      "resource_version_observations",
      "source_repository_identities",
      "source_repository_relationships",
    ]);
    const rowKeys = Object.keys(frozen.expectedVersions)
      .filter((key) => key.startsWith("row:"))
      .sort(compareUtf8);
    for (const key of rowKeys) {
      const parsed = parseRowVersionKey(key);
      const table = parsed?.table;
      const id = parsed?.id;
      if (table === undefined || id === undefined || !allowedTables.has(table))
        throw new SystemIdentityMutationError(
          "EXPECTED_VERSION_SET_INVALID",
          "TRANSACTION_ATTEMPT",
        );
      await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [id]);
    }
  }

  private async queryContext(
    client: PoolClient,
    request: DerivedSystemIdentityMutation,
  ): Promise<MutableIdentityContext> {
    const result = await client.query<
      Omit<MutableIdentityContext, "guard_versions" | "guard_payloads">
    >(
      `SELECT candidate.source_snapshot_id, candidate.candidate_root_fingerprint,
          candidate.candidate_content_fingerprint, candidate.reconciled_classification_run_id,
          candidate.classification_policy_version, candidate.identity_policy_version,
          candidate.status AS candidate_status, candidate.record_version AS candidate_record_version,
          candidate.identity_outcome AS candidate_identity_outcome,
          candidate.resource_identity_id AS candidate_resource_identity_id,
          candidate.resource_version_identity_id AS candidate_resource_version_identity_id,
          review.id AS review_id, review.review_state, review.record_version AS review_record_version,
          acquisition.status AS acquisition_status,
          acquisition.record_version AS acquisition_record_version,
          acquisition.cancellation_requested,
          job.current_stage AS m02_current_stage, job.review_state AS m02_review_state,
          job.record_version AS m02_record_version, job.supersession_state,
          run.input_fingerprint AS classification_run_input_fingerprint,
          run.output_fingerprint AS classification_run_output_fingerprint,
          run.analysis_run_id AS classification_analysis_run_id,
          analysis.request_fingerprint AS classification_analysis_run_request_fingerprint,
          analysis.response_fingerprint AS classification_analysis_run_response_fingerprint,
          job.analysis_policy_version, job.parser_profile_version, job.prompt_bundle_version,
          job.job_scope_key, job.operation_scope, job.job_lineage_id, candidate.candidate_root_id,
          root.normalized_root_path, root.canonical_content_payload,
          snapshot.provider, snapshot.provider_repository_id, snapshot.immutable_revision,
          fork_repository.provider AS fork_source_repository_provider,
          fork_repository.provider_repository_id AS fork_source_repository_provider_id,
          evidence.id AS evidence_id, repository.id AS source_repository_id,
          decision.id AS prior_decision_id,
          decision.record_version AS prior_decision_record_version,
          handoff.id AS prior_handoff_id,
          handoff.record_version AS prior_handoff_record_version,
          handoff.state AS prior_handoff_state, job.replacement_source_job_id,
          job.replacement_input_fingerprint,
          duplicate_target_identity.guard_anchor_candidate_id
            AS duplicate_target_guard_anchor_candidate_id,
          duplicate_target_version.content_fingerprint
            AS duplicate_target_content_fingerprint,
          target_identity.guard_anchor_candidate_id AS target_guard_anchor_candidate_id,
          target_version.content_fingerprint AS target_version_content_fingerprint,
          prior_version.content_fingerprint AS prior_version_content_fingerprint
       FROM resource_candidates candidate
       JOIN repository_classification_runs run ON run.id=candidate.reconciled_classification_run_id
       LEFT JOIN analysis_runs analysis ON analysis.id=run.analysis_run_id
       JOIN candidate_roots root ON root.id=candidate.candidate_root_id
       JOIN source_snapshots snapshot ON snapshot.id=candidate.source_snapshot_id
       JOIN LATERAL (
         SELECT evidence.id FROM classification_evidence_references evidence
         WHERE evidence.classification_run_id=run.id
         ORDER BY convert_to(evidence.id,'UTF8') LIMIT 1
       ) evidence ON true
       LEFT JOIN source_repository_identities repository
         ON repository.provider=snapshot.provider
        AND repository.provider_repository_id=snapshot.provider_repository_id
       LEFT JOIN source_repository_identities fork_repository ON fork_repository.id=$7
       LEFT JOIN resource_version_identities duplicate_target_version
         ON duplicate_target_version.id=$3
       LEFT JOIN resource_identities duplicate_target_identity
         ON duplicate_target_identity.id=duplicate_target_version.resource_identity_id
       LEFT JOIN resource_identities target_identity
         ON target_identity.id=$4
       LEFT JOIN resource_version_identities target_version
         ON target_version.id=$5
       LEFT JOIN resource_version_identities prior_version
         ON prior_version.id=$6
       LEFT JOIN LATERAL (
         SELECT decision.id, decision.record_version
         FROM identity_decisions decision
         WHERE decision.resource_candidate_id=candidate.id AND decision.state='ACTIVE'
         ORDER BY convert_to(decision.id,'UTF8') LIMIT 1
       ) decision ON true
       LEFT JOIN LATERAL (
         SELECT handoff.id, handoff.record_version, handoff.state
         FROM m02_identity_handoff_markers handoff
         WHERE handoff.resource_candidate_id=candidate.id
           AND handoff.identity_decision_id=decision.id
           AND handoff.resource_identity_id=candidate.resource_identity_id
           AND handoff.resource_version_identity_id=candidate.resource_version_identity_id
         ORDER BY handoff.created_at DESC, convert_to(handoff.id,'UTF8') DESC LIMIT 1
       ) handoff ON true
       JOIN m02_review_states review ON review.resource_candidate_id=candidate.id
       JOIN acquisition_jobs acquisition ON acquisition.id=$2
       JOIN m02_jobs job ON job.id=$2
       WHERE candidate.id=$1`,
      [
        request.candidateId,
        request.controllingJobId,
        request.duplicateTargetResourceVersionIdOrNull,
        request.targetResourceIdentityIdOrNull,
        request.targetResourceVersionIdentityIdOrNull,
        request.priorResourceVersionIdentityIdOrNull,
        request.forkSourceRepositoryIdOrNull,
      ],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new SystemIdentityMutationError(
        "EXPECTED_VERSION_SET_INVALID",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
    const guards = systemGuards(request, row);
    const existingGuards = await client.query<{
      guard_key: string;
      record_version: string;
      canonical_payload: Buffer;
    }>(
      "SELECT guard_key,record_version,canonical_payload FROM m02_concurrency_guards WHERE guard_key=ANY($1::text[])",
      [guards.map((guard) => guard.key)],
    );
    const existingByKey = new Map(existingGuards.rows.map((guard) => [guard.guard_key, guard]));
    const expectedRowVersions = await this.queryExpectedRowVersions(client, request);
    return {
      ...row,
      guard_versions: Object.fromEntries(
        guards.map((guard) => [
          guard.key,
          existingByKey.has(guard.key)
            ? Number(requiredValue(existingByKey.get(guard.key)).record_version)
            : null,
        ]),
      ),
      guard_payloads: Object.fromEntries(
        guards.map((guard) => [guard.key, existingByKey.get(guard.key)?.canonical_payload ?? null]),
      ),
      expected_row_versions: expectedRowVersions,
    };
  }

  private async queryExpectedRowVersions(
    client: PoolClient,
    request: DerivedSystemIdentityMutation,
  ): Promise<Readonly<Record<string, number>>> {
    const result = await client.query<{ table_name: string; id: string; record_version: string }>(
      `WITH scope AS (
         SELECT candidate.candidate_root_id,root.group_id,root.normalized_root_path,
           snapshot.provider,snapshot.provider_repository_id
         FROM resource_candidates candidate
         JOIN candidate_roots root ON root.id=candidate.candidate_root_id
         JOIN source_snapshots snapshot ON snapshot.id=candidate.source_snapshot_id
         WHERE candidate.id=$1
       ), mutable_rows AS (
         SELECT 'repository_candidate_groups'::text AS table_name,group_value.id,
           group_value.record_version FROM repository_candidate_groups group_value
           JOIN scope ON scope.group_id=group_value.id
         UNION ALL SELECT 'candidate_roots',root.id,root.record_version FROM candidate_roots root
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'resource_candidates',candidate.id,candidate.record_version
           FROM resource_candidates candidate JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'm02_review_states',review.id,review.record_version
           FROM m02_review_states review JOIN resource_candidates candidate
             ON candidate.id=review.resource_candidate_id
           JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'acquisition_jobs',job.id,job.record_version
           FROM acquisition_jobs job WHERE job.id=$2
         UNION ALL SELECT 'm02_jobs',job.id,job.record_version
           FROM m02_jobs job WHERE job.id=$2
         UNION ALL SELECT 'acquisition_jobs',predecessor.id,predecessor.record_version
           FROM m02_jobs job JOIN acquisition_jobs predecessor
             ON predecessor.id=job.replacement_source_job_id WHERE job.id=$2
         UNION ALL SELECT 'm02_jobs',predecessor.id,predecessor.record_version
           FROM m02_jobs job JOIN m02_jobs predecessor
             ON predecessor.id=job.replacement_source_job_id WHERE job.id=$2
         UNION ALL SELECT 'source_repository_identities',repository.id,repository.record_version
           FROM source_repository_identities repository JOIN scope
             ON repository.provider=scope.provider
            AND repository.provider_repository_id=scope.provider_repository_id
         UNION ALL SELECT 'source_repository_identities',repository.id,repository.record_version
           FROM source_repository_identities repository WHERE repository.id=$7
         UNION ALL SELECT 'resource_identities',identity.id,identity.record_version
           FROM resource_identities identity
           WHERE identity.id=ANY($3::text[])
         UNION ALL SELECT 'resource_identities',identity.id,identity.record_version
           FROM resource_version_identities version JOIN resource_identities identity
             ON identity.id=version.resource_identity_id
           WHERE version.id=$6
         UNION ALL SELECT 'resource_version_identities',version.id,version.record_version
           FROM resource_version_identities version
           WHERE version.id=ANY($4::text[])
         UNION ALL SELECT 'resource_source_links',link.id,link.record_version
           FROM resource_source_links link JOIN source_repository_identities repository
             ON repository.id=link.source_repository_id JOIN scope
             ON repository.provider=scope.provider
            AND repository.provider_repository_id=scope.provider_repository_id
            AND link.normalized_root_path=scope.normalized_root_path
         UNION ALL SELECT 'external_identifiers',identifier.id,identifier.record_version
           FROM external_identifiers identifier
           WHERE identifier.id=$5
         UNION ALL SELECT 'source_repository_relationships',relationship.id,
           relationship.record_version
           FROM source_repository_relationships relationship WHERE relationship.id=$8
         UNION ALL SELECT 'identity_decisions',decision.id,decision.record_version
           FROM identity_decisions decision JOIN resource_candidates candidate
             ON candidate.id=decision.resource_candidate_id
           JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'm02_identity_handoff_markers',handoff.id,handoff.record_version
           FROM m02_identity_handoff_markers handoff JOIN resource_candidates candidate
             ON candidate.id=handoff.resource_candidate_id
           JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'm02_clarification_requests',clarification.id,clarification.record_version
           FROM m02_clarification_requests clarification JOIN resource_candidates candidate
             ON candidate.id=clarification.resource_candidate_id
           JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'duplicate_candidates',duplicate.id,duplicate.record_version
           FROM duplicate_candidates duplicate JOIN resource_candidates candidate
             ON candidate.id=duplicate.resource_candidate_id
           JOIN candidate_roots root ON root.id=candidate.candidate_root_id
           JOIN scope ON scope.group_id=root.group_id
         UNION ALL SELECT 'resource_version_observations',observation.id,1::bigint
           FROM resource_version_observations observation JOIN scope
             ON observation.candidate_root_id=scope.candidate_root_id
       )
       SELECT table_name,id,max(record_version)::text AS record_version
       FROM mutable_rows GROUP BY table_name,id
       ORDER BY convert_to(table_name,'UTF8'),convert_to(id,'UTF8')`,
      [
        request.candidateId,
        request.controllingJobId,
        [
          request.targetResourceIdentityIdOrNull,
          ...request.frozenResourceVersionTargets.map((target) => target.resourceIdentityId),
        ].filter((value): value is string => value !== null),
        [
          request.targetResourceVersionIdentityIdOrNull,
          request.priorResourceVersionIdentityIdOrNull,
          request.duplicateTargetResourceVersionIdOrNull,
          ...request.frozenResourceVersionTargets.map((target) => target.resourceVersionId),
        ].filter((value): value is string => value !== null),
        request.externalIdentifierIdOrNull,
        request.duplicateTargetResourceVersionIdOrNull,
        request.forkSourceRepositoryIdOrNull,
        request.reviewedMirrorRelationshipIdOrNull,
      ],
    );
    return Object.fromEntries(
      result.rows.map((row) => [rowVersionKey(row.table_name, row.id), Number(row.record_version)]),
    );
  }

  private assertPreProjector(
    context: Pick<
      MutableIdentityContext,
      "supersession_state" | "cancellation_requested" | "acquisition_status"
    >,
  ): void {
    if (context.supersession_state !== "CONTROLLING")
      throw new SystemIdentityMutationError("JOB_SUPERSEDED", "PRE_PROJECTOR");
    if (context.cancellation_requested || context.acquisition_status === "CANCELLED")
      throw new SystemIdentityMutationError("CANCELLED", "PRE_PROJECTOR");
  }

  private assertInputMatchesContext(
    request: DerivedSystemIdentityMutation,
    context: MutableIdentityContext,
    phase:
      "POST_PROJECTOR_PRE_ALLOCATION" | "TRANSACTION_ATTEMPT" = "POST_PROJECTOR_PRE_ALLOCATION",
  ): void {
    const input = request.identityDecisionInput;
    canonicalizeIdentityDecisionInput(input);
    if (
      request.candidateId !== input.candidateId ||
      input.sourceSnapshotId !== context.source_snapshot_id ||
      input.candidateRootFingerprint !== context.candidate_root_fingerprint ||
      input.candidateContentFingerprint !== context.candidate_content_fingerprint ||
      input.reconciledClassificationRunId !== context.reconciled_classification_run_id ||
      input.classificationRunInputFingerprint !== context.classification_run_input_fingerprint ||
      input.classificationRunOutputFingerprint !== context.classification_run_output_fingerprint ||
      input.analysisRunIdOrNull !== context.classification_analysis_run_id ||
      input.analysisRunRequestFingerprintOrNull !==
        context.classification_analysis_run_request_fingerprint ||
      input.analysisRunResponseFingerprintOrNull !==
        context.classification_analysis_run_response_fingerprint ||
      input.classificationPolicyVersion !== context.classification_policy_version ||
      input.identityPolicyVersion !== context.identity_policy_version ||
      input.analysisPolicyVersion !== context.analysis_policy_version ||
      input.parserProfileVersion !== context.parser_profile_version ||
      input.promptBundleVersion !== context.prompt_bundle_version
    )
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", phase);
    const mode = request.automaticProjectorModeId;
    const reanalysis = mode.startsWith("S9_") || mode === "S10_JR";
    if (
      context.m02_current_stage !== "RESOLVING_IDENTITY" ||
      (reanalysis
        ? context.candidate_status !== "IDENTITY_RESOLVED" ||
          context.review_state !== "RESOLVED" ||
          context.m02_review_state !== "RESOLVED" ||
          context.prior_decision_id === null ||
          context.prior_handoff_id === null ||
          context.prior_handoff_state !== "SUPERSEDED" ||
          context.replacement_source_job_id === null ||
          request.targetResourceIdentityIdOrNull !== context.candidate_resource_identity_id ||
          request.targetResourceVersionIdentityIdOrNull !==
            context.candidate_resource_version_identity_id
        : context.candidate_status !== "CLASSIFIED" ||
          context.review_state !== "NOT_REQUIRED" ||
          context.m02_review_state !== "NOT_REQUIRED")
    )
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", phase);
    const repositoryExpected =
      mode.includes("_R1_") || mode.startsWith("S2_") || mode.startsWith("S3_") || mode === "S8_JR";
    const repositoryAbsent = mode.includes("_R0_");
    const validModeShape =
      (mode.startsWith("S1_") &&
        request.reliableIdentityTokenOrNull !== null &&
        request.targetResourceIdentityIdOrNull === null &&
        request.targetResourceVersionIdentityIdOrNull === null) ||
      (mode.startsWith("S2_") &&
        request.targetResourceIdentityIdOrNull !== null &&
        request.priorResourceVersionIdentityIdOrNull !== null &&
        request.activeSourceLinkIdOrNull !== null) ||
      (mode.startsWith("S3_") &&
        request.targetResourceIdentityIdOrNull !== null &&
        request.targetResourceVersionIdentityIdOrNull !== null &&
        request.activeSourceLinkIdOrNull !== null) ||
      (mode.startsWith("S4_") &&
        request.targetResourceIdentityIdOrNull !== null &&
        request.targetResourceVersionIdentityIdOrNull !== null &&
        request.activeSourceLinkIdOrNull === null) ||
      (mode.startsWith("S5_") &&
        request.targetResourceIdentityIdOrNull !== null &&
        request.targetResourceVersionIdentityIdOrNull === null &&
        request.activeSourceLinkIdOrNull === null) ||
      (mode === "S6_JR" &&
        input.conflicts.length > 0 &&
        request.targetResourceIdentityIdOrNull === null &&
        request.targetResourceVersionIdentityIdOrNull === null) ||
      (mode === "S7_JR" &&
        request.duplicateTargetResourceVersionIdOrNull !== null &&
        context.duplicate_target_guard_anchor_candidate_id !== null &&
        context.duplicate_target_content_fingerprint !== null) ||
      (mode === "S8_JR" &&
        input.trustedSignals.some(
          (signal) =>
            signal.signalType === "P3_PROVIDER_DECLARED_FORK_PROVENANCE" &&
            signal.targetTypeOrNull === "SOURCE_REPOSITORY",
        )) ||
      ((mode.startsWith("S9_") || mode === "S10_JR") &&
        request.targetResourceIdentityIdOrNull !== null &&
        request.targetResourceVersionIdentityIdOrNull !== null);
    const expectedSignalType =
      mode.startsWith("S2_") || mode.startsWith("S3_") || mode.startsWith("S9_")
        ? "P1_ACTIVE_SOURCE_LINK"
        : mode.startsWith("S4_") || mode.startsWith("S5_")
          ? "P2_TRUSTED_EXTERNAL_IDENTIFIER"
          : mode === "S7_JR"
            ? input.trustedSignals.some((signal) => signal.tier === "P5")
              ? "P5"
              : "P4_CANDIDATE_CONTENT_FINGERPRINT"
            : mode === "S8_JR"
              ? "P3_PROVIDER_DECLARED_FORK_PROVENANCE"
              : (mode.startsWith("S1_") || mode === "S6_JR") &&
                  input.trustedSignals.some((signal) => signal.tier === "P6")
                ? "P6_WEAK_SIMILAR_NAME"
                : null;
    const validEvidenceShape =
      (expectedSignalType === "P5"
        ? input.trustedSignals.length >= 2 &&
          input.trustedSignals.every(
            (signal) =>
              signal.tier === "P5" &&
              ["P5_SOURCE_NAME", "P5_CREATOR_IDENTITY", "P5_ORGANIZATION_IDENTITY"].includes(
                signal.signalType,
              ),
          )
        : expectedSignalType === null
          ? input.trustedSignals.length === 0
          : input.trustedSignals.length === 1 &&
            input.trustedSignals[0]?.signalType === expectedSignalType) &&
      (["S6_JR", "S10_JR"].includes(mode)
        ? input.conflicts.length > 0
        : input.conflicts.length === 0);
    if (
      !validModeShape ||
      !validEvidenceShape ||
      (repositoryExpected && context.source_repository_id === null) ||
      (repositoryAbsent && context.source_repository_id !== null)
    )
      throw new SystemIdentityMutationError(
        "MUTATION_PLAN_CHANGED",
        "POST_PROJECTOR_PRE_ALLOCATION",
      );
  }

  private freeze(
    request: DerivedSystemIdentityMutation,
    context: MutableIdentityContext,
    replay: FrozenSystemIdentityReplayLocator,
  ): FrozenSystemOperation {
    const canonicalInput = canonicalizeIdentityDecisionInput(request.identityDecisionInput);
    const authorityFingerprint = derivedAuthorityFingerprint(request);
    const guards = systemGuards(request, context);
    const expectedVersions = {
      ...context.guard_versions,
      ...context.expected_row_versions,
    };
    const expectedVersionsPayload = canonicalM02JsonBytes(expectedVersions);
    const idempotency = canonicalPayload({
      schemaVersion: "1",
      sourceSnapshotId: request.identityDecisionInput.sourceSnapshotId,
      candidateId: request.candidateId,
      controllingJobId: request.controllingJobId,
      reconciledClassificationRunId: request.identityDecisionInput.reconciledClassificationRunId,
      identityDecisionInputFingerprint: canonicalInput.fingerprint,
      identityPolicyVersion: request.identityDecisionInput.identityPolicyVersion,
      automaticProjectorModeId: request.automaticProjectorModeId,
    });
    const operationRequest = canonicalPayload({
      schemaVersion: "1",
      operationKind: "SYSTEM_IDENTITY_PROJECTION",
      automaticProjectorModeId: request.automaticProjectorModeId,
      sourceSnapshotId: request.identityDecisionInput.sourceSnapshotId,
      candidateId: request.candidateId,
      controllingJobId: request.controllingJobId,
      reconciledClassificationRunId: request.identityDecisionInput.reconciledClassificationRunId,
      identityDecisionInputFingerprint: canonicalInput.fingerprint,
      identityPolicyVersion: request.identityDecisionInput.identityPolicyVersion,
      idempotencyScope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
      idempotencyKey: idempotency.fingerprint,
      systemReplayLookupKey: replay.lookupKey,
      SystemExpectedVersions: expectedVersions,
      systemActorId: request.systemActorId,
    });
    const concurrencyPlan: Readonly<Record<string, CanonicalM02Value>> = {
      schemaVersion: "1",
      automaticProjectorModeId: request.automaticProjectorModeId,
      authorityFingerprint,
      identityDecisionInputFingerprint: canonicalInput.fingerprint,
      systemOperationFingerprint: operationRequest.fingerprint,
      systemExpectedVersions: expectedVersions,
      guards: guards.map((guard) => ({
        guardKey: guard.key,
        guardType: guard.guardType,
        canonicalPayload: Buffer.from(guard.canonicalPayload).toString("utf8"),
        payloadHash: guard.payloadHash,
        mutation: guard.mutation,
      })),
      affectedRows: Object.entries(context.expected_row_versions)
        .sort(([left], [right]) => compareUtf8(left, right))
        .map(([rowKey, recordVersion]) => ({ rowKey, recordVersion })),
    };
    const frozenConcurrencyPlan = canonicalPayload(concurrencyPlan);
    return {
      canonicalInput,
      replay,
      expectedVersions,
      expectedVersionsPayload,
      idempotencyPayload: idempotency.payload,
      idempotencyKey: idempotency.fingerprint,
      operationRequestPayload: operationRequest.payload,
      operationFingerprint: operationRequest.fingerprint,
      authorityFingerprint,
      guards,
      concurrencyPlan,
      concurrencyPlanPayload: frozenConcurrencyPlan.payload,
      concurrencyPlanFingerprint: frozenConcurrencyPlan.fingerprint,
    };
  }

  private freezeMutationPlan(
    frozen: FrozenSystemOperation,
    request: DerivedSystemIdentityMutation,
    context: MutableIdentityContext,
    ids: SystemIds,
    writtenAt = new Date(),
  ): FrozenSystemMutationAttempt {
    const domainMutationPlan = this.initialPlan(frozen, request, context, ids, writtenAt);
    const completePlan = canonicalPayload({
      schemaVersion: "1",
      concurrencyPlan: frozen.concurrencyPlan,
      domainMutationPlan,
    });
    return {
      ...frozen,
      ids,
      writtenAt,
      domainMutationPlan,
      mutationPlanPayload: completePlan.payload,
      mutationPlanFingerprint: completePlan.fingerprint,
    };
  }

  private frozenConcurrencyPlanEquals(
    left: FrozenSystemOperation,
    right: FrozenSystemOperation,
  ): boolean {
    return Buffer.from(left.concurrencyPlanPayload).equals(
      Buffer.from(right.concurrencyPlanPayload),
    );
  }

  private assertExpectedVersions(
    frozen: Readonly<Record<string, number | null>>,
    context: MutableIdentityContext,
    phase: "POST_PROJECTOR_PRE_ALLOCATION" | "TRANSACTION_ATTEMPT",
  ): void {
    const current = {
      ...context.guard_versions,
      ...context.expected_row_versions,
    };
    this.assertExpectedVersionMaps(frozen, current, phase);
  }

  private assertExpectedVersionMaps(
    frozen: Readonly<Record<string, number | null>>,
    current: Readonly<Record<string, number | null>>,
    phase: "POST_PROJECTOR_PRE_ALLOCATION" | "TRANSACTION_ATTEMPT",
  ): void {
    const expectedKeys = Object.keys(frozen).sort(compareUtf8);
    const actualKeys = Object.keys(current).sort(compareUtf8);
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys))
      throw new SystemIdentityMutationError("EXPECTED_VERSION_SET_INVALID", phase);
    if (expectedKeys.some((key) => (frozen[key] === null) !== (current[key] === null)))
      throw new SystemIdentityMutationError("EXPECTED_VERSION_SET_INVALID", phase);
    if (expectedKeys.some((key) => frozen[key] !== current[key]))
      throw new SystemIdentityMutationError("STALE_RECORD_VERSION", phase);
  }

  private initialPlan(
    frozen: FrozenSystemOperation,
    request: DerivedSystemIdentityMutation,
    context: MutableIdentityContext,
    ids: SystemIds,
    writtenAt: Date,
  ): Readonly<Record<string, CanonicalM02Value>> {
    const input = request.identityDecisionInput;
    const mode = request.automaticProjectorModeId;
    const createsRepository = mode.includes("_R0_");
    const reusesRepository =
      mode.includes("_R1_") || mode.startsWith("S2_") || mode.startsWith("S3_");
    const createsIdentity = mode.startsWith("S1_");
    const reusesIdentity =
      mode.startsWith("S2_") ||
      mode.startsWith("S3_") ||
      mode.startsWith("S4_") ||
      mode.startsWith("S5_") ||
      mode.startsWith("S9_") ||
      mode === "S10_JR";
    const createsVersion =
      mode.startsWith("S1_") || mode.startsWith("S2_") || mode.startsWith("S5_");
    const reusesVersion =
      mode.startsWith("S2_") ||
      mode.startsWith("S3_") ||
      mode.startsWith("S4_") ||
      mode.startsWith("S9_") ||
      mode === "S10_JR";
    const createsLink =
      mode.startsWith("S1_") ||
      mode.startsWith("S2_") ||
      mode.startsWith("S4_") ||
      mode.startsWith("S5_");
    const reusesLink = mode.startsWith("S3_");
    const createsObservation = /^S[1-5]_/u.test(mode);
    const createsHandoff = /^S[1-5]_/u.test(mode) || mode.startsWith("S9_");
    const createsDuplicate = mode === "S7_JR";
    const blocking = ["S6_JR", "S7_JR", "S8_JR", "S10_JR"].includes(mode);
    const createdSourceRepositoryId = createsRepository
      ? requiredValue(ids.sourceRepositoryId)
      : null;
    const createdSourceRepositoryUrlId = createsRepository
      ? requiredValue(ids.sourceRepositoryUrlId)
      : null;
    const createdResourceIdentityId = createsIdentity
      ? requiredValue(ids.resourceIdentityId)
      : null;
    const createdResourceVersionIdentityId = createsVersion
      ? requiredValue(ids.resourceVersionIdentityId)
      : null;
    const createdSourceLinkId = createsLink ? requiredValue(ids.sourceLinkId) : null;
    const createdObservationId = createsObservation ? requiredValue(ids.observationId) : null;
    const createdDuplicateCandidateId = createsDuplicate
      ? requiredValue(ids.duplicateCandidateId)
      : null;
    const createdHandoffMarkerId = createsHandoff ? requiredValue(ids.handoffMarkerId) : null;
    const resourceIdentityId = createsIdentity
      ? requiredValue(createdResourceIdentityId)
      : reusesIdentity
        ? request.targetResourceIdentityIdOrNull
        : null;
    const resourceVersionIdentityId = createsVersion
      ? requiredValue(createdResourceVersionIdentityId)
      : mode.startsWith("S3_") ||
          mode.startsWith("S4_") ||
          mode.startsWith("S9_") ||
          mode === "S10_JR"
        ? request.targetResourceVersionIdentityIdOrNull
        : null;
    const outcome = mode.startsWith("S1_")
      ? "NEW_RESOURCE"
      : mode.startsWith("S2_") || mode.startsWith("S5_")
        ? "EXISTING_RESOURCE_NEW_VERSION"
        : mode.startsWith("S3_") || mode.startsWith("S4_") || mode.startsWith("S9_")
          ? "EXACT_REPEAT_REUSE"
          : mode.startsWith("S9_")
            ? "EXACT_REPEAT_REUSE"
            : mode === "S7_JR"
              ? "POSSIBLE_DUPLICATE"
              : mode === "S8_JR"
                ? "FORK_OF_EXISTING_RESOURCE"
                : "AMBIGUOUS_IDENTITY";
    const finalCandidateState = {
      status: blocking ? "IDENTITY_REVIEW_REQUIRED" : "IDENTITY_RESOLVED",
      identityOutcome: outcome,
      resourceIdentityId,
      resourceVersionIdentityId,
      recordVersion: Number(context.candidate_record_version) + 1,
    } as const;
    const postconditions = {
      schemaVersion: "1",
      automaticProjectorModeId: request.automaticProjectorModeId,
      candidateId: request.candidateId,
      controllingJobId: request.controllingJobId,
      sourceSnapshotId: input.sourceSnapshotId,
      identityDecisionId: ids.decisionId,
      resourceIdentityIdOrNull: resourceIdentityId,
      resourceVersionIdentityIdOrNull: resourceVersionIdentityId,
      duplicateCandidateIdOrNull: createdDuplicateCandidateId,
      handoffMarkerIdOrNull: createdHandoffMarkerId,
      createdSourceRepositoryIds:
        createdSourceRepositoryId === null ? [] : [createdSourceRepositoryId],
      createdSourceRepositoryUrlIds:
        createdSourceRepositoryUrlId === null ? [] : [createdSourceRepositoryUrlId],
      createdResourceIdentityIds:
        createdResourceIdentityId === null ? [] : [createdResourceIdentityId],
      createdResourceVersionIdentityIds:
        createdResourceVersionIdentityId === null ? [] : [createdResourceVersionIdentityId],
      createdSourceLinkIds: createdSourceLinkId === null ? [] : [createdSourceLinkId],
      createdObservationIds: createdObservationId === null ? [] : [createdObservationId],
      createdDuplicateCandidateIds:
        createdDuplicateCandidateId === null ? [] : [createdDuplicateCandidateId],
      createdIdentityDecisionIds: [ids.decisionId],
      createdHandoffMarkerIds: createdHandoffMarkerId === null ? [] : [createdHandoffMarkerId],
      reusedSourceRepositoryIds: reusesRepository
        ? [requiredValue(context.source_repository_id)]
        : [],
      reusedResourceIdentityIds: reusesIdentity
        ? [requiredValue(request.targetResourceIdentityIdOrNull)]
        : [],
      reusedResourceVersionIdentityIds: reusesVersion
        ? [
            mode.startsWith("S2_")
              ? requiredValue(request.priorResourceVersionIdentityIdOrNull)
              : requiredValue(request.targetResourceVersionIdentityIdOrNull),
          ]
        : [],
      reusedSourceLinkIds: reusesLink ? [requiredValue(request.activeSourceLinkIdOrNull)] : [],
      reusedObservationIds: [],
      updatedResourceCandidateIds: [request.candidateId],
      updatedReviewStateIds: [context.review_id],
      updatedAcquisitionJobIds: [request.controllingJobId],
      updatedM02JobIds: [request.controllingJobId],
      supersededSourceLinkIds: mode.startsWith("S2_")
        ? [requiredValue(request.activeSourceLinkIdOrNull)]
        : [],
      supersededIdentityDecisionIds:
        mode.startsWith("S9_") || mode === "S10_JR"
          ? [requiredValue(context.prior_decision_id)]
          : [],
      supersededHandoffMarkerIds: [],
      supersededDuplicateCandidateIds: [],
      createdIdentityDecisionTierEvaluationIds: ids.tierIds,
      createdIdentityDecisionSignalIds: ids.signalIds,
      createdIdentityDecisionSignalEvidenceIds: flatten(ids.signalEvidenceIds),
      createdIdentityDecisionConflictIds: ids.conflictIds,
      createdIdentityDecisionConflictTargetIds: flatten(ids.conflictTargetIds),
      createdIdentityDecisionConflictEvidenceIds: flatten(ids.conflictEvidenceIds),
      finalCandidateState,
      finalReviewState: blocking ? "IDENTITY_REVIEW_REQUIRED" : "RESOLVED",
      finalAcquisitionJobStatus: mode.endsWith("_JC") ? "COMPLETED" : "OPERATOR_REVIEW_REQUIRED",
      finalM02JobStatus: mode.endsWith("_JC") ? "COMPLETED" : "OPERATOR_REVIEW_REQUIRED",
      finalM02Stage: "RESOLVING_IDENTITY",
    };
    const writtenAtText = writtenAt.toISOString();
    const systemMetadata = {
      evaluatedTierSequence: input.evaluatedTierSequence,
      automaticProjectorModeId: request.automaticProjectorModeId,
      identityDecisionInputFingerprint: frozen.canonicalInput.fingerprint,
    } as unknown as CanonicalM02Value;
    const row = (
      tableName: string,
      primaryKey: string,
      values: Readonly<Record<string, CanonicalM02Value>>,
    ): CanonicalM02Value => ({ tableName, primaryKey, values });
    const creates: CanonicalM02Value[] = [
      row("identity_decisions", ids.decisionId, {
        id: ids.decisionId,
        resource_candidate_id: request.candidateId,
        outcome,
        matched_tier:
          input.evaluatedTierSequence.find((tier) => tier.evaluationDisposition === "MATCH")
            ?.tier ?? null,
        confidence: null,
        identity_policy_version: input.identityPolicyVersion,
        decision_source: input.analysisRunIdOrNull === null ? "DETERMINISTIC" : "AI_ASSISTED",
        signals: input.trustedSignals as unknown as CanonicalM02Value,
        rejected_lower_tier_signals: [],
        conflicts: input.conflicts as unknown as CanonicalM02Value,
        audit_fingerprint: frozen.canonicalInput.fingerprint,
        state: "ACTIVE",
        supersedes_decision_id: context.prior_decision_id,
        created_at: writtenAtText,
        record_version: 1,
        origin_type: "SYSTEM_IDENTITY_OPERATION",
        system_operation_id: ids.operationId,
        system_result_id: ids.resultId,
        audit_event_id: ids.decisionAuditId,
      }),
    ];
    for (let ordinal = 0; ordinal < input.evaluatedTierSequence.length; ordinal += 1) {
      const tier = requiredValue(input.evaluatedTierSequence[ordinal]);
      creates.push(
        row("identity_decision_tier_evaluations", requiredValue(ids.tierIds[ordinal]), {
          id: requiredValue(ids.tierIds[ordinal]),
          identity_decision_id: ids.decisionId,
          ordinal,
          tier: tier.tier,
          evaluation_disposition: tier.evaluationDisposition,
          audit_event_id: requiredValue(ids.tierAuditIds[ordinal]),
          created_at: writtenAtText,
        }),
      );
    }
    for (let ordinal = 0; ordinal < input.trustedSignals.length; ordinal += 1) {
      const signal = requiredValue(input.trustedSignals[ordinal]);
      const signalId = requiredValue(ids.signalIds[ordinal]);
      creates.push(
        row("identity_decision_signals", signalId, {
          id: signalId,
          identity_decision_id: ids.decisionId,
          ordinal,
          tier: signal.tier,
          signal_type: signal.signalType,
          target_type: signal.targetTypeOrNull,
          resource_identity_id:
            signal.targetTypeOrNull === "RESOURCE_IDENTITY" ? signal.targetIdOrNull : null,
          resource_version_id:
            signal.targetTypeOrNull === "RESOURCE_VERSION" ? signal.targetIdOrNull : null,
          source_repository_id:
            signal.targetTypeOrNull === "SOURCE_REPOSITORY" ? signal.targetIdOrNull : null,
          audit_event_id: requiredValue(ids.signalAuditIds[ordinal]),
          created_at: writtenAtText,
        }),
      );
      for (
        let evidenceOrdinal = 0;
        evidenceOrdinal < signal.evidenceReferenceIds.length;
        evidenceOrdinal += 1
      ) {
        const evidenceId = requiredValue(
          requiredValue(ids.signalEvidenceIds[ordinal])[evidenceOrdinal],
        );
        creates.push(
          row("identity_decision_signal_evidence", evidenceId, {
            id: evidenceId,
            signal_id: signalId,
            ordinal: evidenceOrdinal,
            evidence_reference_id: requiredValue(signal.evidenceReferenceIds[evidenceOrdinal]),
            audit_event_id: requiredValue(
              requiredValue(ids.signalEvidenceAuditIds[ordinal])[evidenceOrdinal],
            ),
            created_at: writtenAtText,
          }),
        );
      }
    }
    for (let ordinal = 0; ordinal < input.conflicts.length; ordinal += 1) {
      const conflict = requiredValue(input.conflicts[ordinal]);
      const conflictId = requiredValue(ids.conflictIds[ordinal]);
      creates.push(
        row("identity_decision_conflicts", conflictId, {
          id: conflictId,
          identity_decision_id: ids.decisionId,
          ordinal,
          conflict_code: conflict.code,
          audit_event_id: requiredValue(ids.conflictAuditIds[ordinal]),
          created_at: writtenAtText,
        }),
      );
      for (let targetOrdinal = 0; targetOrdinal < conflict.targets.length; targetOrdinal += 1) {
        const target = requiredValue(conflict.targets[targetOrdinal]);
        const targetId = requiredValue(
          requiredValue(ids.conflictTargetIds[ordinal])[targetOrdinal],
        );
        creates.push(
          row("identity_decision_conflict_targets", targetId, {
            id: targetId,
            conflict_id: conflictId,
            ordinal: targetOrdinal,
            target_type: target.targetType,
            resource_identity_id:
              target.targetType === "RESOURCE_IDENTITY" ? target.targetId : null,
            resource_version_id: target.targetType === "RESOURCE_VERSION" ? target.targetId : null,
            source_repository_id:
              target.targetType === "SOURCE_REPOSITORY" ? target.targetId : null,
            audit_event_id: requiredValue(
              requiredValue(ids.conflictTargetAuditIds[ordinal])[targetOrdinal],
            ),
            created_at: writtenAtText,
          }),
        );
      }
      for (
        let evidenceOrdinal = 0;
        evidenceOrdinal < conflict.evidenceReferenceIds.length;
        evidenceOrdinal += 1
      ) {
        const evidenceId = requiredValue(
          requiredValue(ids.conflictEvidenceIds[ordinal])[evidenceOrdinal],
        );
        creates.push(
          row("identity_decision_conflict_evidence", evidenceId, {
            id: evidenceId,
            conflict_id: conflictId,
            ordinal: evidenceOrdinal,
            evidence_reference_id: requiredValue(conflict.evidenceReferenceIds[evidenceOrdinal]),
            audit_event_id: requiredValue(
              requiredValue(ids.conflictEvidenceAuditIds[ordinal])[evidenceOrdinal],
            ),
            created_at: writtenAtText,
          }),
        );
      }
    }
    if (createsRepository) {
      creates.push(
        row("source_repository_identities", requiredValue(createdSourceRepositoryId), {
          id: requiredValue(createdSourceRepositoryId),
          provider: context.provider,
          provider_repository_id: context.provider_repository_id,
          created_at: writtenAtText,
          record_version: 1,
          first_observed_source_snapshot_id: input.sourceSnapshotId,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.sourceRepositoryAuditId),
        }),
        row("source_repository_urls", requiredValue(createdSourceRepositoryUrlId), {
          id: requiredValue(createdSourceRepositoryUrlId),
          source_repository_id: requiredValue(createdSourceRepositoryId),
          provider: context.provider,
          provider_repository_id: context.provider_repository_id,
          canonical_url: request.canonicalRepositoryUrl,
          source_snapshot_id: input.sourceSnapshotId,
          observed_at: writtenAtText,
          state: "ACTIVE",
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.sourceRepositoryUrlAuditId),
        }),
      );
    }
    if (createsIdentity)
      creates.push(
        row("resource_identities", requiredValue(createdResourceIdentityId), {
          id: requiredValue(createdResourceIdentityId),
          status: "ACTIVE",
          reliable_identity_token: request.reliableIdentityTokenOrNull,
          reliable_token_evidence_id: context.evidence_id,
          created_at: writtenAtText,
          record_version: 1,
          guard_anchor_candidate_id: request.candidateId,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.resourceIdentityAuditId),
        }),
      );
    if (createsVersion)
      creates.push(
        row("resource_version_identities", requiredValue(createdResourceVersionIdentityId), {
          id: requiredValue(createdResourceVersionIdentityId),
          resource_identity_id: requiredValue(resourceIdentityId),
          content_fingerprint: input.candidateContentFingerprint,
          canonical_payload: `\\x${Buffer.from(context.canonical_content_payload).toString("hex")}`,
          first_observed_source_snapshot_id: input.sourceSnapshotId,
          first_observed_candidate_root_id: context.candidate_root_id,
          first_observed_source_revision: context.immutable_revision,
          observation_label: `snapshot:${context.immutable_revision.slice(0, 12)}`,
          status: "IDENTITY_RESOLVED",
          created_at: writtenAtText,
          record_version: 1,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.resourceVersionIdentityAuditId),
        }),
      );
    const sourceRepositoryId = createsRepository
      ? requiredValue(createdSourceRepositoryId)
      : context.source_repository_id;
    if (createsLink)
      creates.push(
        row("resource_source_links", requiredValue(createdSourceLinkId), {
          id: requiredValue(createdSourceLinkId),
          source_repository_id: requiredValue(sourceRepositoryId),
          normalized_root_path: context.normalized_root_path,
          target_resource_version_id: requiredValue(resourceVersionIdentityId),
          relationship: "PRIMARY",
          evidence_ids: [context.evidence_id],
          decision_id: ids.decisionId,
          reason: mode,
          actor_id: request.systemActorId,
          created_at: writtenAtText,
          state: "ACTIVE",
          supersedes_source_link_id: mode.startsWith("S2_")
            ? request.activeSourceLinkIdOrNull
            : null,
          record_version: 1,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.sourceLinkAuditId),
        }),
      );
    const sourceLinkId = createsLink
      ? requiredValue(createdSourceLinkId)
      : request.activeSourceLinkIdOrNull;
    if (createsObservation)
      creates.push(
        row("resource_version_observations", requiredValue(createdObservationId), {
          id: requiredValue(createdObservationId),
          resource_version_identity_id: requiredValue(resourceVersionIdentityId),
          source_snapshot_id: input.sourceSnapshotId,
          candidate_root_id: context.candidate_root_id,
          resource_source_link_id: requiredValue(sourceLinkId),
          source_repository_id: requiredValue(sourceRepositoryId),
          provider: context.provider,
          provider_repository_id: context.provider_repository_id,
          normalized_root_path: context.normalized_root_path,
          immutable_revision: context.immutable_revision,
          observed_at: writtenAtText,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.observationAuditId),
        }),
      );
    if (createsDuplicate)
      creates.push(
        row("duplicate_candidates", requiredValue(createdDuplicateCandidateId), {
          id: requiredValue(createdDuplicateCandidateId),
          resource_candidate_id: request.candidateId,
          target_resource_version_id: request.duplicateTargetResourceVersionIdOrNull,
          status: "PROPOSED",
          evidence_ids: [context.evidence_id],
          decision_id: ids.decisionId,
          reason: mode,
          actor_id: request.systemActorId,
          created_at: writtenAtText,
          record_version: 1,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.duplicateCandidateAuditId),
        }),
      );
    if (createsHandoff)
      creates.push(
        row("m02_identity_handoff_markers", requiredValue(createdHandoffMarkerId), {
          id: requiredValue(createdHandoffMarkerId),
          resource_candidate_id: request.candidateId,
          resource_identity_id: requiredValue(resourceIdentityId),
          resource_version_identity_id: requiredValue(resourceVersionIdentityId),
          controlling_m02_job_id: request.controllingJobId,
          source_snapshot_id: input.sourceSnapshotId,
          identity_decision_id: ids.decisionId,
          origin_type: "SYSTEM_IDENTITY_OPERATION",
          system_operation_id: ids.operationId,
          system_result_id: ids.resultId,
          audit_event_id: requiredValue(ids.handoffMarkerAuditId),
          logical_key: `${request.candidateId}:${request.controllingJobId}`,
          state: "ACTIVE",
          created_at: writtenAtText,
          record_version: 1,
        }),
      );

    const candidateBeforeVersion = Number(context.candidate_record_version);
    const reviewBeforeVersion = Number(context.review_record_version);
    const acquisitionBeforeVersion = Number(context.acquisition_record_version);
    const jobBeforeVersion = Number(context.m02_record_version);
    const updates: CanonicalM02Value[] = [
      {
        tableName: "resource_candidates",
        primaryKey: request.candidateId,
        beforeValues: {
          status: context.candidate_status,
          identity_outcome: context.candidate_identity_outcome,
          resource_identity_id: context.candidate_resource_identity_id,
          resource_version_identity_id: context.candidate_resource_version_identity_id,
          record_version: candidateBeforeVersion,
        },
        afterValues: {
          status: finalCandidateState.status,
          identity_outcome: outcome,
          resource_identity_id: resourceIdentityId,
          resource_version_identity_id: resourceVersionIdentityId,
          updated_at: writtenAtText,
          record_version: candidateBeforeVersion + 1,
        },
      },
      {
        tableName: "m02_review_states",
        primaryKey: context.review_id,
        beforeValues: {
          review_state: context.review_state,
          record_version: reviewBeforeVersion,
        },
        afterValues: {
          review_state: postconditions.finalReviewState,
          record_version: reviewBeforeVersion + 1,
        },
      },
      {
        tableName: "acquisition_jobs",
        primaryKey: request.controllingJobId,
        beforeValues: {
          status: context.acquisition_status,
          record_version: acquisitionBeforeVersion,
        },
        afterValues: {
          status: postconditions.finalAcquisitionJobStatus,
          record_version: acquisitionBeforeVersion + 1,
        },
      },
      {
        tableName: "m02_jobs",
        primaryKey: request.controllingJobId,
        beforeValues: {
          current_stage: context.m02_current_stage,
          review_state: context.m02_review_state,
          record_version: jobBeforeVersion,
        },
        afterValues: {
          current_stage: "RESOLVING_IDENTITY",
          review_state: postconditions.finalReviewState,
          record_version: jobBeforeVersion + 1,
        },
      },
    ];
    const supersedes: CanonicalM02Value[] = [];
    if (mode.startsWith("S2_")) {
      const beforeVersion = requiredValue(
        context.expected_row_versions[
          rowVersionKey("resource_source_links", requiredValue(request.activeSourceLinkIdOrNull))
        ],
      );
      supersedes.push({
        tableName: "resource_source_links",
        primaryKey: requiredValue(request.activeSourceLinkIdOrNull),
        beforeValues: { state: "ACTIVE", record_version: beforeVersion },
        afterValues: { state: "SUPERSEDED", record_version: beforeVersion + 1 },
      });
    }
    if (mode.startsWith("S9_") || mode === "S10_JR") {
      const beforeVersion = Number(context.prior_decision_record_version);
      supersedes.push({
        tableName: "identity_decisions",
        primaryKey: requiredValue(context.prior_decision_id),
        beforeValues: { state: "ACTIVE", record_version: beforeVersion },
        afterValues: {
          state: "SUPERSEDED",
          replacement_system_operation_id: ids.operationId,
          replacement_system_result_id: ids.resultId,
          replacement_audit_event_id: requiredValue(ids.supersededDecisionAuditId),
          superseded_by_decision_id: ids.decisionId,
          record_version: beforeVersion + 1,
        },
      });
    }

    const audits: CanonicalM02Value[] = [];
    const planAudit = (
      id: string,
      action:
        "SYSTEM_OPERATION_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED" | "SUBJECT_SUPERSEDED",
      subjectType: string,
      subjectId: string,
      beforeVersion: number | null = null,
      afterVersion: number | null = null,
      beforeState: string | null = null,
      afterState: string | null = null,
      metadata: CanonicalM02Value = {},
    ): void => {
      audits.push({
        id,
        action,
        subjectType,
        subjectId,
        beforeVersion,
        afterVersion,
        beforeState,
        afterState,
        metadata,
        originType: "SYSTEM_IDENTITY_OPERATION",
        actorType: "SYSTEM",
        actorId: request.systemActorId,
        actorRole: null,
        requestId: ids.operationId,
        idempotencyScope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
        idempotencyKey: frozen.idempotencyKey,
        reasonCode: mode,
        reasonText: mode,
        sourceSnapshotId: input.sourceSnapshotId,
        controllingJobId: request.controllingJobId,
        occurredAt: writtenAtText,
        systemOperationId: ids.operationId,
        systemResultId: ids.resultId,
      });
    };
    const createdDomainAudits = [
      [
        createsRepository,
        ids.sourceRepositoryAuditId,
        "SOURCE_REPOSITORY_IDENTITY",
        ids.sourceRepositoryId,
        1,
        canonicalText({ recordVersion: 1 }),
      ],
      [
        createsRepository,
        ids.sourceRepositoryUrlAuditId,
        "SOURCE_REPOSITORY_URL",
        ids.sourceRepositoryUrlId,
        null,
        null,
      ],
      [
        createsIdentity,
        ids.resourceIdentityAuditId,
        "RESOURCE_IDENTITY",
        ids.resourceIdentityId,
        1,
        canonicalText({ recordVersion: 1, status: "ACTIVE" }),
      ],
      [
        createsVersion,
        ids.resourceVersionIdentityAuditId,
        "RESOURCE_VERSION_IDENTITY",
        ids.resourceVersionIdentityId,
        1,
        canonicalText({ recordVersion: 1, status: "IDENTITY_RESOLVED" }),
      ],
      [
        createsLink,
        ids.sourceLinkAuditId,
        "RESOURCE_SOURCE_LINK",
        ids.sourceLinkId,
        1,
        canonicalText({ recordVersion: 1, state: "ACTIVE" }),
      ],
      [
        createsObservation,
        ids.observationAuditId,
        "RESOURCE_VERSION_OBSERVATION",
        ids.observationId,
        null,
        null,
      ],
      [
        createsDuplicate,
        ids.duplicateCandidateAuditId,
        "DUPLICATE_CANDIDATE",
        ids.duplicateCandidateId,
        1,
        canonicalText({ recordVersion: 1, status: "PROPOSED" }),
      ],
      [
        createsHandoff,
        ids.handoffMarkerAuditId,
        "M02_IDENTITY_HANDOFF",
        ids.handoffMarkerId,
        1,
        canonicalText({ recordVersion: 1, state: "ACTIVE" }),
      ],
    ] as const;
    for (const [
      applies,
      auditId,
      subjectType,
      subjectId,
      afterVersion,
      afterState,
    ] of createdDomainAudits)
      if (applies)
        planAudit(
          requiredValue(auditId),
          "SUBJECT_CREATED",
          subjectType,
          requiredValue(subjectId),
          null,
          afterVersion,
          null,
          afterState,
        );
    planAudit(
      ids.decisionAuditId,
      "SUBJECT_CREATED",
      "IDENTITY_DECISION",
      ids.decisionId,
      null,
      1,
      null,
      canonicalText({ recordVersion: 1, state: "ACTIVE" }),
      systemMetadata,
    );
    for (let ordinal = 0; ordinal < ids.tierIds.length; ordinal += 1)
      planAudit(
        requiredValue(ids.tierAuditIds[ordinal]),
        "SUBJECT_CREATED",
        "IDENTITY_DECISION_TIER_EVALUATION",
        requiredValue(ids.tierIds[ordinal]),
      );
    for (let ordinal = 0; ordinal < ids.signalIds.length; ordinal += 1) {
      planAudit(
        requiredValue(ids.signalAuditIds[ordinal]),
        "SUBJECT_CREATED",
        "IDENTITY_DECISION_SIGNAL",
        requiredValue(ids.signalIds[ordinal]),
      );
      const evidenceIds = requiredValue(ids.signalEvidenceIds[ordinal]);
      for (let evidenceOrdinal = 0; evidenceOrdinal < evidenceIds.length; evidenceOrdinal += 1)
        planAudit(
          requiredValue(requiredValue(ids.signalEvidenceAuditIds[ordinal])[evidenceOrdinal]),
          "SUBJECT_CREATED",
          "IDENTITY_DECISION_SIGNAL_EVIDENCE",
          requiredValue(evidenceIds[evidenceOrdinal]),
        );
    }
    for (let ordinal = 0; ordinal < ids.conflictIds.length; ordinal += 1) {
      planAudit(
        requiredValue(ids.conflictAuditIds[ordinal]),
        "SUBJECT_CREATED",
        "IDENTITY_DECISION_CONFLICT",
        requiredValue(ids.conflictIds[ordinal]),
      );
      const targetIds = requiredValue(ids.conflictTargetIds[ordinal]);
      for (let targetOrdinal = 0; targetOrdinal < targetIds.length; targetOrdinal += 1)
        planAudit(
          requiredValue(requiredValue(ids.conflictTargetAuditIds[ordinal])[targetOrdinal]),
          "SUBJECT_CREATED",
          "IDENTITY_DECISION_CONFLICT_TARGET",
          requiredValue(targetIds[targetOrdinal]),
        );
      const evidenceIds = requiredValue(ids.conflictEvidenceIds[ordinal]);
      for (let evidenceOrdinal = 0; evidenceOrdinal < evidenceIds.length; evidenceOrdinal += 1)
        planAudit(
          requiredValue(requiredValue(ids.conflictEvidenceAuditIds[ordinal])[evidenceOrdinal]),
          "SUBJECT_CREATED",
          "IDENTITY_DECISION_CONFLICT_EVIDENCE",
          requiredValue(evidenceIds[evidenceOrdinal]),
        );
    }
    if (mode.startsWith("S2_")) {
      const beforeVersion = requiredValue(
        context.expected_row_versions[
          rowVersionKey("resource_source_links", requiredValue(request.activeSourceLinkIdOrNull))
        ],
      );
      planAudit(
        requiredValue(ids.supersededSourceLinkAuditId),
        "SUBJECT_SUPERSEDED",
        "RESOURCE_SOURCE_LINK",
        requiredValue(request.activeSourceLinkIdOrNull),
        beforeVersion,
        beforeVersion + 1,
        canonicalText({ recordVersion: beforeVersion, state: "ACTIVE" }),
        canonicalText({
          recordVersion: beforeVersion + 1,
          state: "SUPERSEDED",
          supersededById: requiredValue(createdSourceLinkId),
        }),
        { successorId: requiredValue(createdSourceLinkId) },
      );
    }
    if (mode.startsWith("S9_") || mode === "S10_JR") {
      const beforeVersion = Number(context.prior_decision_record_version);
      planAudit(
        requiredValue(ids.supersededDecisionAuditId),
        "SUBJECT_SUPERSEDED",
        "IDENTITY_DECISION",
        requiredValue(context.prior_decision_id),
        beforeVersion,
        beforeVersion + 1,
        canonicalText({ recordVersion: beforeVersion, state: "ACTIVE" }),
        canonicalText({
          recordVersion: beforeVersion + 1,
          state: "SUPERSEDED",
          supersededByDecisionId: ids.decisionId,
        }),
        systemMetadata,
      );
    }
    planAudit(
      ids.candidateAuditId,
      "SUBJECT_UPDATED",
      "RESOURCE_CANDIDATE",
      request.candidateId,
      candidateBeforeVersion,
      candidateBeforeVersion + 1,
      canonicalText({
        identityOutcome: context.candidate_identity_outcome,
        recordVersion: candidateBeforeVersion,
        resourceIdentityId: context.candidate_resource_identity_id,
        resourceVersionIdentityId: context.candidate_resource_version_identity_id,
        status: context.candidate_status,
      }),
      canonicalText({
        identityOutcome: outcome,
        recordVersion: candidateBeforeVersion + 1,
        resourceIdentityId,
        resourceVersionIdentityId,
        status: finalCandidateState.status,
      }),
    );
    planAudit(
      ids.reviewAuditId,
      "SUBJECT_UPDATED",
      "M02_REVIEW_STATE",
      context.review_id,
      reviewBeforeVersion,
      reviewBeforeVersion + 1,
      canonicalText({ recordVersion: reviewBeforeVersion, reviewState: context.review_state }),
      canonicalText({
        recordVersion: reviewBeforeVersion + 1,
        reviewState: postconditions.finalReviewState,
      }),
    );
    planAudit(
      ids.acquisitionAuditId,
      "SUBJECT_UPDATED",
      "ACQUISITION_JOB",
      request.controllingJobId,
      acquisitionBeforeVersion,
      acquisitionBeforeVersion + 1,
      canonicalText({
        recordVersion: acquisitionBeforeVersion,
        status: context.acquisition_status,
      }),
      canonicalText({
        recordVersion: acquisitionBeforeVersion + 1,
        status: postconditions.finalAcquisitionJobStatus,
      }),
    );
    planAudit(
      ids.jobAuditId,
      "SUBJECT_UPDATED",
      "M02_JOB",
      request.controllingJobId,
      jobBeforeVersion,
      jobBeforeVersion + 1,
      canonicalText({
        currentStage: context.m02_current_stage,
        recordVersion: jobBeforeVersion,
        reviewState: context.m02_review_state,
      }),
      canonicalText({
        currentStage: "RESOLVING_IDENTITY",
        recordVersion: jobBeforeVersion + 1,
        reviewState: postconditions.finalReviewState,
      }),
      { scope: context.operation_scope, guardKey: context.job_scope_key },
    );
    planAudit(
      ids.acceptedAuditId,
      "SYSTEM_OPERATION_ACCEPTED",
      "SYSTEM_IDENTITY_OPERATION",
      ids.operationId,
      null,
      null,
      null,
      null,
      systemMetadata,
    );

    const sortRows = (entries: CanonicalM02Value[]): CanonicalM02Value[] =>
      entries.sort((left, right) => {
        const leftRow = left as { tableName: string; primaryKey: string };
        const rightRow = right as { tableName: string; primaryKey: string };
        const byTable = compareUtf8(leftRow.tableName, rightRow.tableName);
        return byTable === 0 ? compareUtf8(leftRow.primaryKey, rightRow.primaryKey) : byTable;
      });
    sortRows(creates);
    sortRows(updates);
    sortRows(supersedes);
    audits.sort((left, right) =>
      compareUtf8((left as { id: string }).id, (right as { id: string }).id),
    );
    const allocatedIds = [
      ids.operationId,
      ids.resultId,
      ...creates.map((entry) => (entry as { primaryKey: string }).primaryKey),
      ...audits.map((entry) => (entry as { id: string }).id),
    ].sort(compareUtf8);
    return {
      schemaVersion: "1",
      allocatedIds,
      operation: {
        id: ids.operationId,
        values: {
          operation_kind: "SYSTEM_IDENTITY_PROJECTION",
          automatic_projector_mode_id: mode,
          source_snapshot_id: input.sourceSnapshotId,
          candidate_id: request.candidateId,
          controlling_job_id: request.controllingJobId,
          reconciled_classification_run_id: input.reconciledClassificationRunId,
          classification_run_input_fingerprint: input.classificationRunInputFingerprint,
          classification_run_output_fingerprint: input.classificationRunOutputFingerprint,
          classification_policy_version: input.classificationPolicyVersion,
          identity_policy_version: input.identityPolicyVersion,
          analysis_policy_version: input.analysisPolicyVersion,
          parser_profile_version: input.parserProfileVersion,
          prompt_bundle_version: input.promptBundleVersion,
          analysis_run_id: input.analysisRunIdOrNull,
          analysis_run_request_fingerprint: input.analysisRunRequestFingerprintOrNull,
          analysis_run_response_fingerprint: input.analysisRunResponseFingerprintOrNull,
          identity_decision_input_payload: `\\x${Buffer.from(frozen.canonicalInput.payload).toString("hex")}`,
          identity_decision_input_fingerprint: frozen.canonicalInput.fingerprint,
          system_replay_locator_payload: `\\x${Buffer.from(frozen.replay.payload).toString("hex")}`,
          system_replay_lookup_key: frozen.replay.lookupKey,
          idempotency_scope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
          idempotency_key: frozen.idempotencyKey,
          idempotency_payload: `\\x${Buffer.from(frozen.idempotencyPayload).toString("hex")}`,
          system_expected_versions: frozen.expectedVersions,
          system_expected_versions_payload: `\\x${Buffer.from(frozen.expectedVersionsPayload).toString("hex")}`,
          system_operation_request_payload: `\\x${Buffer.from(frozen.operationRequestPayload).toString("hex")}`,
          system_operation_fingerprint: frozen.operationFingerprint,
          system_actor_id: request.systemActorId,
          actor_type: "SYSTEM",
          actor_role: null,
          created_at: writtenAtText,
        },
      },
      creates,
      updates,
      supersedes,
      audits,
      result: {
        id: ids.resultId,
        values: {
          system_operation_id: ids.operationId,
          status: "ACCEPTED",
          automatic_projector_mode_id: mode,
          candidate_id: request.candidateId,
          controlling_job_id: request.controllingJobId,
          source_snapshot_id: input.sourceSnapshotId,
          identity_decision_id: ids.decisionId,
          resource_identity_id: resourceIdentityId,
          resource_version_identity_id: resourceVersionIdentityId,
          duplicate_candidate_id: postconditions.duplicateCandidateIdOrNull,
          handoff_marker_id: postconditions.handoffMarkerIdOrNull,
          accepted_audit_event_id: ids.acceptedAuditId,
          accepted_at: writtenAtText,
        },
      },
      postconditions,
    };
  }

  private planRecord(value: unknown): Readonly<Record<string, CanonicalM02Value>> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    return value as Readonly<Record<string, CanonicalM02Value>>;
  }

  private planArray(value: unknown): readonly unknown[] {
    if (!Array.isArray(value))
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    return value;
  }

  private planString(value: unknown): string {
    if (typeof value !== "string")
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    return value;
  }

  private databasePlanValue(tableName: string, columnName: string, value: unknown): unknown {
    return SYSTEM_PLAN_JSONB_COLUMNS.has(`${tableName}.${columnName}`)
      ? JSON.stringify(value)
      : value;
  }

  private assertPlannedColumns(tableName: string, values: Readonly<Record<string, unknown>>): void {
    const allowed = SYSTEM_PLAN_COLUMNS[tableName];
    if (allowed === undefined || Object.keys(values).some((columnName) => !allowed.has(columnName)))
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
  }

  private async insertPlannedRow(client: PoolClient, row: PlannedSystemCreate): Promise<void> {
    const retainedId = row.values.id;
    if (retainedId !== undefined && retainedId !== row.primaryKey)
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
    const values: Readonly<Record<string, unknown>> = { id: row.primaryKey, ...row.values };
    this.assertPlannedColumns(row.tableName, values);
    const columns = Object.keys(values).sort(compareUtf8);
    const parameters = columns.map((columnName) =>
      this.databasePlanValue(row.tableName, columnName, values[columnName]),
    );
    const placeholders = columns.map((_columnName, index) => `$${String(index + 1)}`).join(",");
    const inserted = await client.query(
      `INSERT INTO ${row.tableName} (${columns.join(",")}) VALUES (${placeholders})`,
      parameters,
    );
    if (inserted.rowCount !== 1)
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
  }

  private async applyPlannedChange(client: PoolClient, change: PlannedSystemChange): Promise<void> {
    this.assertPlannedColumns(change.tableName, change.beforeValues);
    this.assertPlannedColumns(change.tableName, change.afterValues);
    const afterColumns = Object.keys(change.afterValues).sort(compareUtf8);
    const beforeColumns = Object.keys(change.beforeValues).sort(compareUtf8);
    const parameters: unknown[] = [change.primaryKey];
    const assignments = afterColumns.map((columnName) => {
      parameters.push(
        this.databasePlanValue(change.tableName, columnName, change.afterValues[columnName]),
      );
      return `${columnName}=$${String(parameters.length)}`;
    });
    const predicates = beforeColumns.map((columnName) => {
      parameters.push(
        this.databasePlanValue(change.tableName, columnName, change.beforeValues[columnName]),
      );
      return `${columnName} IS NOT DISTINCT FROM $${String(parameters.length)}`;
    });
    const updated = await client.query(
      `UPDATE ${change.tableName} SET ${assignments.join(",")}
       WHERE id=$1 AND ${predicates.join(" AND ")}`,
      parameters,
    );
    if (updated.rowCount !== 1)
      throw new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "TRANSACTION_ATTEMPT");
  }

  private plannedAuditRow(audit: PlannedSystemAudit): PlannedSystemCreate {
    return {
      tableName: "m02_audit_events",
      primaryKey: audit.id,
      values: {
        id: audit.id,
        origin_type: audit.originType,
        actor_type: audit.actorType,
        actor_id: audit.actorId,
        actor_role: audit.actorRole,
        action: audit.action,
        subject_type: audit.subjectType,
        subject_id: audit.subjectId,
        request_id: audit.requestId,
        idempotency_scope: audit.idempotencyScope,
        idempotency_key: audit.idempotencyKey,
        reason_code: audit.reasonCode,
        reason_text: audit.reasonText,
        before_version: audit.beforeVersion,
        after_version: audit.afterVersion,
        before_state: audit.beforeState,
        after_state: audit.afterState,
        metadata: audit.metadata,
        source_snapshot_id: audit.sourceSnapshotId,
        controlling_job_id: audit.controllingJobId,
        occurred_at: audit.occurredAt,
        system_operation_id: audit.systemOperationId,
        system_result_id: audit.systemResultId,
      },
    };
  }

  private plannedResultRow(
    frozen: FrozenSystemMutationAttempt,
    resultPlan: Readonly<{ id: string; values: Readonly<Record<string, CanonicalM02Value>> }>,
    postconditions: Readonly<Record<string, CanonicalM02Value>>,
  ): PlannedSystemCreate {
    const arrayColumns = {
      created_source_repository_ids: "createdSourceRepositoryIds",
      created_source_repository_url_ids: "createdSourceRepositoryUrlIds",
      created_resource_identity_ids: "createdResourceIdentityIds",
      created_resource_version_identity_ids: "createdResourceVersionIdentityIds",
      created_source_link_ids: "createdSourceLinkIds",
      created_observation_ids: "createdObservationIds",
      created_duplicate_candidate_ids: "createdDuplicateCandidateIds",
      created_identity_decision_ids: "createdIdentityDecisionIds",
      created_handoff_marker_ids: "createdHandoffMarkerIds",
      reused_source_repository_ids: "reusedSourceRepositoryIds",
      reused_resource_identity_ids: "reusedResourceIdentityIds",
      reused_resource_version_identity_ids: "reusedResourceVersionIdentityIds",
      reused_source_link_ids: "reusedSourceLinkIds",
      reused_observation_ids: "reusedObservationIds",
      updated_resource_candidate_ids: "updatedResourceCandidateIds",
      updated_review_state_ids: "updatedReviewStateIds",
      updated_acquisition_job_ids: "updatedAcquisitionJobIds",
      updated_m02_job_ids: "updatedM02JobIds",
      superseded_source_link_ids: "supersededSourceLinkIds",
      superseded_identity_decision_ids: "supersededIdentityDecisionIds",
      superseded_handoff_marker_ids: "supersededHandoffMarkerIds",
      superseded_duplicate_candidate_ids: "supersededDuplicateCandidateIds",
      created_identity_decision_tier_evaluation_ids: "createdIdentityDecisionTierEvaluationIds",
      created_identity_decision_signal_ids: "createdIdentityDecisionSignalIds",
      created_identity_decision_signal_evidence_ids: "createdIdentityDecisionSignalEvidenceIds",
      created_identity_decision_conflict_ids: "createdIdentityDecisionConflictIds",
      created_identity_decision_conflict_target_ids: "createdIdentityDecisionConflictTargetIds",
      created_identity_decision_conflict_evidence_ids: "createdIdentityDecisionConflictEvidenceIds",
    } as const;
    const arrays = Object.fromEntries(
      Object.entries(arrayColumns).map(([columnName, planName]) => [
        columnName,
        postconditions[planName],
      ]),
    );
    return {
      tableName: "m02_system_identity_results",
      primaryKey: resultPlan.id,
      values: {
        id: resultPlan.id,
        ...resultPlan.values,
        mutation_plan_payload: `\\x${Buffer.from(frozen.mutationPlanPayload).toString("hex")}`,
        mutation_plan_fingerprint: frozen.mutationPlanFingerprint,
        ...arrays,
        final_candidate_state: requiredValue(postconditions.finalCandidateState),
        final_review_state: requiredValue(postconditions.finalReviewState),
        final_acquisition_job_status: requiredValue(postconditions.finalAcquisitionJobStatus),
        final_m02_job_status: requiredValue(postconditions.finalM02JobStatus),
        final_m02_stage: requiredValue(postconditions.finalM02Stage),
      },
    };
  }

  private async persistPlanInitial(
    client: PoolClient,
    frozen: FrozenSystemMutationAttempt,
    guardVersions: Readonly<Record<string, number | null>>,
    guardPayloads: Readonly<Record<string, Uint8Array | null>>,
  ): Promise<void> {
    for (const guard of frozen.guards) {
      if (guardVersions[guard.key] === null) {
        if (guard.mutation === "ACTIVE_SET_CHANGE")
          await client.query(
            `INSERT INTO m02_concurrency_guards
              (guard_key,guard_type,canonical_payload,payload_hash,record_version)
             VALUES ($1,$2,$3,$4,1)`,
            [guard.key, guard.guardType, Buffer.from(guard.canonicalPayload), guard.payloadHash],
          );
      } else {
        const retainedPayload = guardPayloads[guard.key];
        if (
          retainedPayload === null ||
          retainedPayload === undefined ||
          !Buffer.from(retainedPayload).equals(Buffer.from(guard.canonicalPayload))
        )
          throw new SystemIdentityMutationError(
            "CONCURRENCY_GUARD_COLLISION",
            "TRANSACTION_ATTEMPT",
          );
        if (guard.mutation === "ACTIVE_SET_CHANGE")
          await client.query(
            "UPDATE m02_concurrency_guards SET record_version=record_version+1 WHERE guard_key=$1",
            [guard.key],
          );
      }
    }

    const plan = this.planRecord(frozen.domainMutationPlan);
    const operation = this.planRecord(plan.operation);
    const operationId = this.planString(operation.id);
    await this.insertPlannedRow(client, {
      tableName: "m02_system_identity_operations",
      primaryKey: operationId,
      values: this.planRecord(operation.values),
    });

    for (const audit of this.planArray(plan.audits) as readonly PlannedSystemAudit[])
      await this.insertPlannedRow(client, this.plannedAuditRow(audit));
    for (const change of this.planArray(plan.supersedes) as readonly PlannedSystemChange[])
      await this.applyPlannedChange(client, change);
    const creates = [...(this.planArray(plan.creates) as readonly PlannedSystemCreate[])].sort(
      (left, right) =>
        requiredValue(SYSTEM_PLAN_CREATE_ORDER[left.tableName]) -
          requiredValue(SYSTEM_PLAN_CREATE_ORDER[right.tableName]) ||
        compareUtf8(left.primaryKey, right.primaryKey),
    );
    for (const create of creates) await this.insertPlannedRow(client, create);
    for (const change of this.planArray(plan.updates) as readonly PlannedSystemChange[])
      await this.applyPlannedChange(client, change);

    const result = this.planRecord(plan.result);
    await this.insertPlannedRow(
      client,
      this.plannedResultRow(
        frozen,
        {
          id: this.planString(result.id),
          values: this.planRecord(result.values),
        },
        this.planRecord(plan.postconditions),
      ),
    );
  }

  private async persistRejection(
    request: RejectionRequestContext,
    context: RejectionMutableContext,
    replay: FrozenSystemIdentityReplayLocator,
    error: SystemIdentityMutationError,
    frozen?: FrozenSystemOperation,
    attemptedSystemOperationId?: string,
  ): Promise<void> {
    const legal =
      (error.phase === "PRE_PROJECTOR" && ["JOB_SUPERSEDED", "CANCELLED"].includes(error.code)) ||
      (error.phase === "POST_PROJECTOR_PRE_ALLOCATION" &&
        ["EXPECTED_VERSION_SET_INVALID", "STALE_RECORD_VERSION", "FINGERPRINT_COLLISION"].includes(
          error.code,
        )) ||
      (error.phase === "TRANSACTION_ATTEMPT" &&
        [
          "EXPECTED_VERSION_SET_INVALID",
          "STALE_RECORD_VERSION",
          "MUTATION_PLAN_CHANGED",
          "SERIALIZATION_RETRY_EXHAUSTED",
          "FINGERPRINT_COLLISION",
          "CONCURRENCY_GUARD_COLLISION",
        ].includes(error.code));
    if (!legal) return;
    const postProjector = error.phase !== "PRE_PROJECTOR";
    if (postProjector && frozen === undefined) return;
    const transactionAttempt = error.phase === "TRANSACTION_ATTEMPT";
    if (transactionAttempt && attemptedSystemOperationId === undefined) return;
    const retainedFrozen = frozen;
    const retainedAttemptedSystemOperationId = attemptedSystemOperationId;
    const rejectionTargetTypeByTable: Readonly<Record<string, string>> = {
      acquisition_jobs: "ACQUISITION_JOB",
      duplicate_candidates: "DUPLICATE_CANDIDATE",
      identity_decisions: "IDENTITY_DECISION",
      m02_clarification_requests: "CLARIFICATION_REQUEST",
      m02_identity_handoff_markers: "HANDOFF",
      m02_jobs: "M02_JOB",
      m02_review_states: "REVIEW_STATE",
      resource_candidates: "RESOURCE_CANDIDATE",
      resource_identities: "RESOURCE_IDENTITY",
      resource_source_links: "SOURCE_LINK",
      resource_version_identities: "RESOURCE_VERSION",
      resource_version_observations: "OBSERVATION",
      source_repository_identities: "SOURCE_REPOSITORY",
    };
    const discoveredTargets = new Map<string, { targetType: string; targetValue: string }>();
    const addTarget = (targetType: string, targetValue: string): void => {
      discoveredTargets.set(`${targetType}\u001f${targetValue}`, { targetType, targetValue });
    };
    addTarget("ACQUISITION_JOB", request.controllingJobId);
    addTarget("M02_JOB", request.controllingJobId);
    addTarget("RESOURCE_CANDIDATE", request.candidateId);
    addTarget("REVIEW_STATE", context.review_id);
    if (frozen !== undefined)
      for (const [key, version] of Object.entries(frozen.expectedVersions)) {
        if (version === null) continue;
        if (key.startsWith("guard:")) {
          addTarget("CONCURRENCY_GUARD", key);
          continue;
        }
        const parsed = parseRowVersionKey(key);
        const targetType =
          parsed === undefined ? undefined : rejectionTargetTypeByTable[parsed.table];
        const targetValue = parsed?.id;
        if (targetType !== undefined && targetValue !== undefined)
          addTarget(targetType, targetValue);
      }
    const existingTargets = [...discoveredTargets.values()]
      .sort((left, right) =>
        compareUtf8(
          `${left.targetType}\u001f${left.targetValue}`,
          `${right.targetType}\u001f${right.targetValue}`,
        ),
      )
      .slice(0, 128);
    const rejectionContext = {
      schemaVersion: "1",
      phase: error.phase,
      candidateId: request.candidateId,
      controllingJobId: request.controllingJobId,
      sourceSnapshotId: context.source_snapshot_id,
      systemActorId: request.systemActorId,
      systemReplayLookupKey: replay.lookupKey,
      errorCode: error.code,
      existingTargets,
      automaticProjectorModeIdOrNull: postProjector
        ? requiredValue(request.automaticProjectorModeId)
        : null,
      identityDecisionInputFingerprintOrNull: postProjector
        ? requiredValue(retainedFrozen).canonicalInput.fingerprint
        : null,
      idempotencyScopeOrNull: postProjector ? "M02_SYSTEM_IDENTITY_PROJECTION_V1" : null,
      idempotencyKeyOrNull: postProjector ? requiredValue(retainedFrozen).idempotencyKey : null,
      systemOperationFingerprintOrNull: postProjector
        ? requiredValue(retainedFrozen).operationFingerprint
        : null,
      attemptedSystemOperationIdOrNull: transactionAttempt
        ? requiredValue(retainedAttemptedSystemOperationId)
        : null,
    } as const;
    const canonical = canonicalPayload(rejectionContext);
    const rejectionClient = await this.pool.connect();
    try {
      await rejectionClient.query("BEGIN");
      await rejectionClient.query(`SET LOCAL search_path TO ${this.schema}, public`);
      await rejectionClient.query(
        `INSERT INTO m02_rejected_system_identity_audits
        (phase,candidate_id,controlling_job_id,source_snapshot_id,system_actor_id,
         system_replay_locator_payload,system_replay_lookup_key,error_code,existing_targets,
         automatic_projector_mode_id,identity_decision_input_fingerprint,idempotency_scope,
         idempotency_key,system_operation_fingerprint,attempted_system_operation_id,
         rejection_context_payload,rejection_fingerprint,occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,now())
       ON CONFLICT (rejection_fingerprint) DO NOTHING`,
        [
          error.phase,
          request.candidateId,
          request.controllingJobId,
          context.source_snapshot_id,
          request.systemActorId,
          Buffer.from(replay.payload),
          replay.lookupKey,
          error.code,
          JSON.stringify(existingTargets),
          postProjector ? request.automaticProjectorModeId : null,
          postProjector ? requiredValue(retainedFrozen).canonicalInput.fingerprint : null,
          postProjector ? "M02_SYSTEM_IDENTITY_PROJECTION_V1" : null,
          postProjector ? requiredValue(retainedFrozen).idempotencyKey : null,
          postProjector ? requiredValue(retainedFrozen).operationFingerprint : null,
          transactionAttempt ? requiredValue(retainedAttemptedSystemOperationId) : null,
          Buffer.from(canonical.payload),
          canonical.fingerprint,
        ],
      );
      await rejectionClient.query("COMMIT");
    } catch (rejectionError) {
      await rejectionClient.query("ROLLBACK");
      throw rejectionError;
    } finally {
      rejectionClient.release();
    }
  }
}
