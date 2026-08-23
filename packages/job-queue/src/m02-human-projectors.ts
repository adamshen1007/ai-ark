import { createHash } from "node:crypto";

import {
  canonicalM02JsonBytes,
  sha256Base64Url,
  type CanonicalM02Value,
} from "@ai-ark/classification";
import { ManualResolutionError, type ManualResolutionEnvelope } from "@ai-ark/identity";
import type { PoolClient } from "pg";

import { compareUtf8, type PlannedGuard } from "./m02-human-command-plan.js";
import {
  selectHumanProjectionMode,
  type HumanModeDiscovery,
  type HumanProjectionMode,
} from "./m02-human-command-plan.js";

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };

interface ResourceVersionRef extends Record<string, CanonicalM02Value> {
  readonly kind: "RESOURCE_VERSION_ANCHOR";
  readonly resourceIdentityRef: ResourceIdentityRef;
  readonly contentFingerprint: string;
}

interface ResourceIdentityRef extends Record<string, CanonicalM02Value> {
  readonly kind: "RESOURCE_IDENTITY_ANCHOR";
  readonly originCandidateId: string;
}

interface SourceRepositoryRef extends Record<string, CanonicalM02Value> {
  readonly provider: string;
  readonly providerRepositoryId: string;
}

interface SourceLinkRef extends Record<string, CanonicalM02Value> {
  readonly provider: string;
  readonly providerRepositoryId: string;
  readonly normalizedRootPath: string;
}

function guardComponent(components: readonly string[], index: number): string {
  const component = components[index];
  if (component === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  return component;
}

export interface CanonicalGuardIdentity {
  readonly key: string;
  readonly guardType: string;
  readonly canonicalPayload: Uint8Array;
  readonly payloadHash: string;
}

export function canonicalGuard(
  guardType: string,
  components: Readonly<Record<string, CanonicalM02Value>>,
): CanonicalGuardIdentity {
  const canonicalPayload = canonicalM02JsonBytes({ guardType, components });
  return {
    key: `guard:${guardType}:${sha256Base64Url(canonicalPayload)}`,
    guardType,
    canonicalPayload,
    payloadHash: createHash("sha256").update(canonicalPayload).digest("hex"),
  };
}

async function identityRef(
  client: PoolClient,
  identityId: string,
  fallbackCandidateId: string,
): Promise<ResourceIdentityRef> {
  const result = await client.query<{ guard_anchor_candidate_id: string }>(
    "SELECT guard_anchor_candidate_id FROM resource_identities WHERE id=$1",
    [identityId],
  );
  return {
    kind: "RESOURCE_IDENTITY_ANCHOR",
    originCandidateId: result.rows[0]?.guard_anchor_candidate_id ?? fallbackCandidateId,
  };
}

async function versionRef(
  client: PoolClient,
  versionId: string,
  command: ManualResolutionEnvelope,
): Promise<ResourceVersionRef> {
  const result = await client.query<{
    content_fingerprint: string;
    guard_anchor_candidate_id: string;
  }>(
    `SELECT version.content_fingerprint, identity.guard_anchor_candidate_id
     FROM resource_version_identities version
     JOIN resource_identities identity ON identity.id=version.resource_identity_id
     WHERE version.id=$1`,
    [versionId],
  );
  const row = result.rows[0];
  if (row !== undefined)
    return {
      kind: "RESOURCE_VERSION_ANCHOR",
      resourceIdentityRef: {
        kind: "RESOURCE_IDENTITY_ANCHOR",
        originCandidateId: row.guard_anchor_candidate_id,
      },
      contentFingerprint: row.content_fingerprint,
    };
  const identityId = command.payload.resourceIdentityId ?? command.payload.targetResourceIdentityId;
  const fingerprint =
    command.payload.contentFingerprint ?? command.payload.identicalContentFingerprint;
  if (identityId === undefined || fingerprint === undefined)
    throw new ManualResolutionError("REFERENCE_INVALID");
  return {
    kind: "RESOURCE_VERSION_ANCHOR",
    resourceIdentityRef: await identityRef(client, identityId, command.targetCandidateId),
    contentFingerprint: fingerprint,
  };
}

function repositoryRef(provider: string, providerRepositoryId: string): SourceRepositoryRef {
  return { provider, providerRepositoryId };
}

function sourceLinkRef(
  provider: string,
  providerRepositoryId: string,
  normalizedRootPath: string,
): SourceLinkRef {
  return { provider, providerRepositoryId, normalizedRootPath };
}

function endpointCandidate(candidateId: string): Readonly<Record<string, CanonicalM02Value>> {
  return { kind: "CANDIDATE", candidateId };
}

function endpointVersion(version: ResourceVersionRef): Readonly<Record<string, CanonicalM02Value>> {
  return { kind: "RESOURCE_VERSION", versionRef: version };
}

function endpointRepository(
  repository: SourceRepositoryRef,
): Readonly<Record<string, CanonicalM02Value>> {
  return { kind: "SOURCE_REPOSITORY", repositoryRef: repository };
}

/**
 * Converts the coordinator's allocation-free logical requirements into the frozen V2 schema.
 * The coordinator supplies discovery hints only; returned bytes and keys are typed-SQL authority.
 */
export async function deriveCanonicalGuardIdentities(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  legacyGuards: readonly { readonly key: string; readonly canonicalPayload: Uint8Array }[],
): Promise<readonly CanonicalGuardIdentity[]> {
  const output = new Map<string, CanonicalGuardIdentity>();
  for (const legacy of legacyGuards) {
    const parsed = JSON.parse(Buffer.from(legacy.canonicalPayload).toString("utf8")) as {
      guardType: string;
      components: readonly string[];
    };
    const c = parsed.components;
    let guardIdentity: CanonicalGuardIdentity;
    switch (parsed.guardType) {
      case "GROUP_KEY":
        guardIdentity = canonicalGuard(parsed.guardType, {
          sourceSnapshotId: guardComponent(c, 0),
          classificationPolicyVersion: guardComponent(c, 1),
        });
        break;
      case "GROUP_MEMBERSHIP":
        guardIdentity = canonicalGuard(parsed.guardType, {
          predecessorGroupId: guardComponent(c, 0),
        });
        break;
      case "ROOT_KEY":
      case "CANDIDATE_KEY":
        guardIdentity = canonicalGuard(parsed.guardType, {
          sourceSnapshotId: guardComponent(c, 0),
          rootFingerprint: guardComponent(c, 1),
          contentFingerprint: guardComponent(c, 2),
        });
        break;
      case "RESOURCE_SOURCE":
        guardIdentity = canonicalGuard(parsed.guardType, {
          provider: guardComponent(c, 0),
          providerRepositoryId: guardComponent(c, 1),
          normalizedRootPath: guardComponent(c, 2),
        });
        break;
      case "SOURCE_REPOSITORY":
        guardIdentity = canonicalGuard(parsed.guardType, {
          repositoryRef: repositoryRef(guardComponent(c, 0), guardComponent(c, 1)),
        });
        break;
      case "RESOURCE_VERSION": {
        const ref = await identityRef(client, guardComponent(c, 0), command.targetCandidateId);
        guardIdentity = canonicalGuard(parsed.guardType, {
          resourceIdentityRef: ref,
          contentFingerprint: guardComponent(c, 1),
        });
        break;
      }
      case "OBSERVATION": {
        const ref = await versionRef(client, guardComponent(c, 0), command);
        const mirrorRepository =
          selectedCommand(command) === "MARK_MIRROR"
            ? (
                await client.query<{ provider: string; provider_repository_id: string }>(
                  "SELECT provider,provider_repository_id FROM source_repository_identities WHERE id=$1",
                  [command.payload.mirrorSourceRepositoryId],
                )
              ).rows[0]
            : undefined;
        guardIdentity = canonicalGuard(parsed.guardType, {
          resourceVersionRef: ref,
          sourceSnapshotId: guardComponent(c, 1),
          candidateRootId: guardComponent(c, 2),
          sourceLinkRef: sourceLinkRef(
            mirrorRepository?.provider ?? command.payload.provider ?? "github",
            mirrorRepository?.provider_repository_id ?? command.payload.providerRepositoryId ?? "",
            command.payload.normalizedRoot ?? ".",
          ),
        });
        break;
      }
      case "DUPLICATE_DISPOSITION":
      case "DUPLICATE_PROPOSAL_SET":
      case "REJECTION_DECISION":
      case "HANDOFF":
        guardIdentity = canonicalGuard(parsed.guardType, { candidateId: guardComponent(c, 0) });
        break;
      case "DUPLICATE_PROPOSAL_PAIR":
        guardIdentity = canonicalGuard(parsed.guardType, {
          candidateId: guardComponent(c, 0),
          targetVersionRef: await versionRef(client, guardComponent(c, 1), command),
        });
        break;
      case "FORK_LINEAGE":
        guardIdentity = canonicalGuard(parsed.guardType, {
          forkVersionRef: await versionRef(client, guardComponent(c, 0), command),
        });
        break;
      case "MIRROR_LINEAGE": {
        const provider = command.payload.provider ?? "github";
        const repository = await client.query<{ provider_repository_id: string }>(
          "SELECT provider_repository_id FROM source_repository_identities WHERE id=$1",
          [c[0]],
        );
        guardIdentity = canonicalGuard(parsed.guardType, {
          mirrorRepositoryRef: repositoryRef(
            provider,
            repository.rows[0]?.provider_repository_id ?? guardComponent(c, 0),
          ),
        });
        break;
      }
      case "RELATIONSHIP_PAIR": {
        const relationshipType =
          c[0] === "FORK" ? "FORK_OF" : c[0] === "MIRROR" ? "MIRROR_OF" : "DUPLICATE_OF";
        const sourceEndpointRef =
          relationshipType === "DUPLICATE_OF"
            ? endpointCandidate(guardComponent(c, 1))
            : relationshipType === "FORK_OF"
              ? endpointVersion(await versionRef(client, guardComponent(c, 1), command))
              : endpointRepository(
                  repositoryRef(
                    command.payload.provider ?? "github",
                    command.payload.providerRepositoryId ?? guardComponent(c, 1),
                  ),
                );
        const targetEndpointRef =
          relationshipType === "MIRROR_OF"
            ? endpointRepository(
                repositoryRef(command.payload.provider ?? "github", guardComponent(c, 2)),
              )
            : endpointVersion(await versionRef(client, guardComponent(c, 2), command));
        guardIdentity = canonicalGuard(parsed.guardType, {
          relationshipType,
          sourceEndpointRef,
          targetEndpointRef,
        });
        break;
      }
      case "CLARIFICATION_OPEN":
        guardIdentity = canonicalGuard(parsed.guardType, {
          reviewId: guardComponent(c, 0),
          questionCode: guardComponent(c, 1),
        });
        break;
      case "CLARIFICATION_TARGET": {
        const type =
          c[0] === "CLASSIFICATION"
            ? "CANDIDATE_GROUP"
            : c[0] === "IDENTITY"
              ? "IDENTITY_DECISION"
              : "RESOURCE_CANDIDATE";
        guardIdentity = canonicalGuard(parsed.guardType, {
          targetType: type,
          targetId: guardComponent(c, 1),
        });
        break;
      }
      case "JOB_SCOPE_CONTROLLER":
        guardIdentity = canonicalGuard(parsed.guardType, {
          jobLineageId: guardComponent(c, 0),
          operationScope: guardComponent(c, 1),
        });
        break;
      case "JOB_REPLACEMENT_INPUT":
        guardIdentity = canonicalGuard(parsed.guardType, {
          sourceJobId: guardComponent(c, 0),
          requestedScope: guardComponent(c, 1),
          replacementInputFingerprint: guardComponent(c, 2),
        });
        break;
      default:
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    output.set(guardIdentity.key, guardIdentity);
  }
  return [...output.values()].sort((left, right) => compareUtf8(left.key, right.key));
}

export function guardPlan(
  guards: readonly CanonicalGuardIdentity[],
  expected: Readonly<Record<string, number | null>>,
): readonly PlannedGuard[] {
  return guards.map((guard) => ({
    key: guard.key,
    guardType: guard.guardType,
    canonicalPayloadBase64: Buffer.from(guard.canonicalPayload).toString("base64"),
    expectedVersion: expected[guard.key] ?? null,
    operation: expected[guard.key] === null ? "CREATE" : "INCREMENT",
  }));
}

function selectedCommand(command: ManualResolutionEnvelope): string {
  return command.command === "RESOLVE_AMBIGUITY"
    ? (command.payload.selectedCommand ?? "")
    : command.command;
}

type M02OperationScope = "CLASSIFICATION" | "IDENTITY_RESOLUTION" | "FULL_PIPELINE";

export function invalidatedReplacementScopes(requestedScope: string): readonly M02OperationScope[] {
  if (requestedScope === "FULL_PIPELINE")
    return ["CLASSIFICATION", "FULL_PIPELINE", "IDENTITY_RESOLUTION"];
  if (requestedScope === "CLASSIFICATION") return ["CLASSIFICATION", "IDENTITY_RESOLUTION"];
  if (requestedScope === "IDENTITY_RESOLUTION") return ["IDENTITY_RESOLUTION"];
  throw new ManualResolutionError("REFERENCE_INVALID");
}

interface ReplacementSourceState {
  readonly id: string;
  readonly status: string;
  readonly cancellation_requested: boolean;
  readonly supersession_state: string;
  readonly operation_scope: string;
  readonly input_fingerprint: string;
}

export function validateReplacementTransition(
  command: ManualResolutionEnvelope,
  source: ReplacementSourceState,
): void {
  const requestedScope = command.payload.requestedOperationScope ?? "";
  const scopeAllowed =
    requestedScope === source.operation_scope ||
    (requestedScope === "FULL_PIPELINE" &&
      ["CLASSIFICATION", "IDENTITY_RESOLUTION"].includes(source.operation_scope));
  if (!scopeAllowed || source.supersession_state !== "CONTROLLING")
    throw new ManualResolutionError(
      source.supersession_state === "SUPERSEDED" ? "JOB_SUPERSEDED" : "TRANSITION_PROHIBITED",
    );
  const routine =
    (source.status === "FAILED" && command.reasonCode === "FAILED_STAGE_REPLACEMENT") ||
    (source.status === "OPERATOR_REVIEW_REQUIRED" && command.reasonCode === "RETRY_EXHAUSTED");
  const changedCompleted =
    source.status === "COMPLETED" &&
    source.input_fingerprint !== command.payload.replacementInputFingerprint &&
    ["NEW_SUPPORTED_SNAPSHOT", "POLICY_OR_METHODOLOGY_CHANGE"].includes(command.reasonCode) &&
    command.actorRole !== "TECHNICAL_REVIEWER";
  const administrative =
    command.reasonCode === "ADMINISTRATIVE_CORRECTION" &&
    command.actorRole === "ADMIN" &&
    command.evidenceIds.length > 0;
  if (!routine && !changedCompleted && !administrative)
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
  if (
    (source.status === "ACTIVE" ||
      source.status === "CANCELLED" ||
      source.cancellation_requested) &&
    !administrative
  )
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
}

async function validateTopologyDiscovery(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  family: string,
): Promise<void> {
  const group = (
    await client.query<{ classification: string; state: string }>(
      "SELECT classification,state FROM repository_candidate_groups WHERE id=$1",
      [command.targetGroupId],
    )
  ).rows[0];
  if (group?.state !== "ACTIVE") throw new ManualResolutionError("TRANSITION_PROHIBITED");
  const predecessorCandidates = (command.payload.originalCandidateIds ?? "")
    .split(",")
    .filter(Boolean)
    .sort(compareUtf8);
  const predecessorRoots = (command.payload.originalRootIds ?? "")
    .split(",")
    .filter(Boolean)
    .sort(compareUtf8);
  if (family === "OVERRIDE_NON_SKILL") {
    if (
      group.classification !== "NON_SKILL" ||
      predecessorCandidates.length > 0 ||
      predecessorRoots.length > 0
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    const existing = await client.query<{ count: string }>(
      `SELECT count(*) FROM repository_group_relationships edge
       WHERE edge.parent_group_id=$1`,
      [command.targetGroupId],
    );
    if (Number(existing.rows[0]?.count ?? "0") !== 0)
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    return;
  }
  if (group.classification !== "AMBIGUOUS")
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
  if (
    predecessorCandidates.length !== predecessorRoots.length ||
    predecessorCandidates.length < (family === "MERGE_ROOTS" ? 2 : 1)
  )
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
  const exact = await client.query<{
    candidate_id: string;
    root_id: string;
    candidate_status: string;
    active_decisions: string;
    active_rejections: string;
    active_handoffs: string;
  }>(
    `SELECT candidate.id AS candidate_id,root.id AS root_id,candidate.status AS candidate_status,
       (SELECT count(*) FROM identity_decisions decision
        WHERE decision.resource_candidate_id=candidate.id AND decision.state='ACTIVE'
          AND decision.outcome='AMBIGUOUS_IDENTITY') AS active_decisions,
       (SELECT count(*) FROM m02_candidate_rejection_decisions rejection
        WHERE rejection.resource_candidate_id=candidate.id AND rejection.state='ACTIVE') AS active_rejections,
       (SELECT count(*) FROM m02_identity_handoff_markers handoff
        WHERE handoff.resource_candidate_id=candidate.id AND handoff.state='ACTIVE') AS active_handoffs
     FROM repository_group_relationships edge
     JOIN resource_candidates candidate ON candidate.id=edge.child_candidate_id
     JOIN candidate_roots root ON root.id=candidate.candidate_root_id
     WHERE edge.parent_group_id=$1
     ORDER BY convert_to(candidate.id,'UTF8')`,
    [command.targetGroupId],
  );
  if (
    JSON.stringify(exact.rows.map(({ candidate_id }) => candidate_id).sort(compareUtf8)) !==
      JSON.stringify(predecessorCandidates) ||
    JSON.stringify(exact.rows.map(({ root_id }) => root_id).sort(compareUtf8)) !==
      JSON.stringify(predecessorRoots) ||
    exact.rows.some(
      (row) =>
        row.candidate_status !== "IDENTITY_REVIEW_REQUIRED" ||
        Number(row.active_decisions) !== 1 ||
        Number(row.active_rejections) !== 0 ||
        Number(row.active_handoffs) !== 0,
    )
  )
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
}

/** Performs allocation-free mode discovery from typed PostgreSQL state only. */
export async function discoverHumanProjectionMode(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  guards: readonly CanonicalGuardIdentity[],
): Promise<HumanProjectionMode> {
  const family = selectedCommand(command);
  if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(family))
    await validateTopologyDiscovery(client, command, family);
  const candidate = await client.query<{
    status: string;
    identity_outcome: string | null;
    resource_identity_id: string | null;
    resource_version_identity_id: string | null;
    reconciled_classification_run_id: string;
  }>(
    `SELECT status,identity_outcome,resource_identity_id,resource_version_identity_id,
            reconciled_classification_run_id
     FROM resource_candidates WHERE id=$1`,
    [command.targetCandidateId],
  );
  const candidateRow = candidate.rows[0];
  const status = candidateRow?.status;
  const decisions = await client.query<{
    id: string;
    outcome: string;
    origin_type: string;
    operation_controlling_job_id: string | null;
  }>(
    `SELECT decision.id,decision.outcome,decision.origin_type,
            operation.controlling_job_id AS operation_controlling_job_id
     FROM identity_decisions decision
     LEFT JOIN m02_system_identity_operations operation
       ON operation.id=decision.system_operation_id
     WHERE decision.resource_candidate_id=$1 AND decision.state='ACTIVE'
     ORDER BY convert_to(decision.id,'UTF8')`,
    [command.targetCandidateId],
  );
  const rejections = await client.query<{ id: string }>(
    `SELECT id FROM m02_candidate_rejection_decisions
     WHERE resource_candidate_id=$1 AND state='ACTIVE'
     ORDER BY convert_to(id,'UTF8')`,
    [command.targetCandidateId],
  );
  const handoffs = await client.query<{
    id: string;
    identity_decision_id: string;
    resource_identity_id: string;
    resource_version_identity_id: string;
    controlling_m02_job_id: string;
    supersession_state: string;
  }>(
    `SELECT handoff.id,handoff.identity_decision_id,handoff.resource_identity_id,
            handoff.resource_version_identity_id,handoff.controlling_m02_job_id,
            job.supersession_state
     FROM m02_identity_handoff_markers handoff
     JOIN m02_jobs job ON job.id=handoff.controlling_m02_job_id
     WHERE handoff.resource_candidate_id=$1 AND handoff.state='ACTIVE'
     ORDER BY convert_to(handoff.id,'UTF8')`,
    [command.targetCandidateId],
  );
  const controllingJobId = command.payload.jobId;
  const currentDecision = decisions.rows.at(0);
  let candidatePhase: "P0" | "P1" | "P2" | undefined;
  if (
    status === "CLASSIFIED" &&
    decisions.rowCount === 0 &&
    rejections.rowCount === 0 &&
    handoffs.rowCount === 0
  )
    candidatePhase = "P0";
  else if (
    status === "IDENTITY_REVIEW_REQUIRED" &&
    decisions.rowCount === 1 &&
    rejections.rowCount === 0 &&
    handoffs.rowCount === 0 &&
    currentDecision?.origin_type === "SYSTEM_IDENTITY_OPERATION" &&
    currentDecision.operation_controlling_job_id === controllingJobId &&
    ["AMBIGUOUS_IDENTITY", "POSSIBLE_DUPLICATE", "FORK_OF_EXISTING_RESOURCE"].includes(
      currentDecision.outcome,
    )
  )
    candidatePhase = "P1";
  else if (
    status === "IDENTITY_RESOLVED" &&
    decisions.rowCount === 1 &&
    rejections.rowCount === 0 &&
    handoffs.rowCount === 1 &&
    handoffs.rows[0]?.identity_decision_id === decisions.rows[0]?.id &&
    handoffs.rows[0]?.resource_identity_id === candidateRow?.resource_identity_id &&
    handoffs.rows[0]?.resource_version_identity_id === candidateRow?.resource_version_identity_id &&
    handoffs.rows[0]?.controlling_m02_job_id === controllingJobId &&
    handoffs.rows[0]?.supersession_state === "CONTROLLING" &&
    decisions.rows[0]?.outcome === candidateRow?.identity_outcome
  )
    candidatePhase = "P2";
  if (candidatePhase === "P1") {
    const proposals = await client.query<{ decision_id: string }>(
      `SELECT decision_id FROM duplicate_candidates
       WHERE resource_candidate_id=$1 AND status='PROPOSED'
       ORDER BY convert_to(id,'UTF8')`,
      [command.targetCandidateId],
    );
    const proposalRequired = decisions.rows[0]?.outcome === "POSSIBLE_DUPLICATE";
    if (
      (proposals.rowCount ?? 0) > 1 ||
      proposalRequired !== ((proposals.rowCount ?? 0) === 1) ||
      (proposals.rows[0] !== undefined && proposals.rows[0].decision_id !== decisions.rows[0]?.id)
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
  }
  const targetGuard = guards.find(({ guardType }) => guardType === "CLARIFICATION_TARGET");
  const guardVersion =
    targetGuard === undefined
      ? undefined
      : (
          await client.query<{ record_version: string }>(
            "SELECT record_version FROM m02_concurrency_guards WHERE guard_key=$1",
            [targetGuard.key],
          )
        ).rows[0];
  const activeDecisionId = decisions.rows[0]?.id ?? null;
  const activeRejectionId = rejections.rows[0]?.id ?? null;
  const openClarifications = await client.query<{ count: string }>(
    `SELECT count(*) FROM m02_clarification_requests clarification
     WHERE clarification.state='OPEN' AND clarification.controlling_job_id=$1
       AND (clarification.resource_candidate_id=$2 OR clarification.candidate_group_id=$3)
       AND (clarification.target_classification_run_id=$4
         OR clarification.target_identity_decision_id=$5
         OR clarification.target_rejection_decision_id=$6)`,
    [
      controllingJobId,
      command.targetCandidateId,
      command.targetGroupId,
      candidateRow?.reconciled_classification_run_id ?? null,
      activeDecisionId,
      activeRejectionId,
    ],
  );
  const openCount = Number(openClarifications.rows[0]?.count ?? "0");
  const clarificationPhase = openCount > 0 ? "K2" : guardVersion === undefined ? "K0" : "K1";

  const targetTerminal = ["REJECT_CANDIDATE", "MARK_DUPLICATE"].includes(family)
    ? "REJECTED"
    : ["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(family)
      ? "IDENTITY_RESOLVED"
      : status;
  const siblings = await client.query<{ id: string; status: string; complete_chain: boolean }>(
    `SELECT candidate.id,candidate.status,
       (candidate.status='IDENTITY_RESOLVED'
        AND EXISTS (SELECT 1 FROM identity_decisions decision
          JOIN m02_identity_handoff_markers handoff
            ON handoff.identity_decision_id=decision.id
           AND handoff.resource_candidate_id=decision.resource_candidate_id
          JOIN m02_jobs job ON job.id=handoff.controlling_m02_job_id
          WHERE decision.resource_candidate_id=candidate.id AND decision.state='ACTIVE'
            AND handoff.state='ACTIVE' AND handoff.controlling_m02_job_id=$2
            AND handoff.resource_identity_id=candidate.resource_identity_id
            AND handoff.resource_version_identity_id=candidate.resource_version_identity_id
            AND job.supersession_state='CONTROLLING')) AS complete_chain
     FROM resource_candidates candidate
     JOIN repository_group_relationships edge ON edge.child_candidate_id=candidate.id
     WHERE edge.parent_group_id=$1 ORDER BY convert_to(candidate.id,'UTF8')`,
    [command.targetGroupId, controllingJobId],
  );
  const prospective = siblings.rows.map((row) =>
    row.id === command.targetCandidateId
      ? {
          status: targetTerminal,
          complete_chain: targetTerminal === "IDENTITY_RESOLVED",
        }
      : row,
  );
  const jobAggregate =
    prospective.length > 0 &&
    prospective.every(({ status: siblingStatus }) => siblingStatus === "REJECTED")
      ? "JE"
      : prospective.some(
            ({ status: siblingStatus, complete_chain }) =>
              siblingStatus !== "REJECTED" && !complete_chain,
          )
        ? "JR"
        : "JC";

  const discovery: Mutable<HumanModeDiscovery> = {
    ...(candidatePhase === undefined ? {} : { candidatePhase }),
    clarificationPhase,
    jobAggregate,
  };
  if (family === "ATTACH_NEW_VERSION") {
    const version = await client.query<{ id: string }>(
      "SELECT id FROM resource_version_identities WHERE resource_identity_id=$1 AND content_fingerprint=$2",
      [command.payload.resourceIdentityId, command.payload.contentFingerprint],
    );
    if (version.rows[0] === undefined) {
      const priorLinks = await client.query<{ id: string }>(
        `SELECT link.id FROM resource_source_links link
         JOIN source_repository_identities repository ON repository.id=link.source_repository_id
         WHERE link.target_resource_version_id=$4
           AND repository.provider=$1 AND repository.provider_repository_id=$2
           AND link.normalized_root_path=$3 AND link.state='ACTIVE'
         ORDER BY convert_to(link.id,'UTF8')`,
        [
          command.payload.provider,
          command.payload.providerRepositoryId,
          command.payload.normalizedRoot,
          command.payload.priorResourceVersionIdentityId,
        ],
      );
      const priorLink = priorLinks.rows.at(0);
      if (
        priorLinks.rows.length !== 1 ||
        priorLink === undefined ||
        (command.payload.activeSourceLinkId !== undefined &&
          priorLink.id !== command.payload.activeSourceLinkId)
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      discovery.attachShape = "A1";
    } else {
      const links = await client.query<{ id: string }>(
        `SELECT link.id FROM resource_source_links link
         JOIN source_repository_identities repository ON repository.id=link.source_repository_id
         WHERE link.target_resource_version_id=$4
           AND repository.provider=$1 AND repository.provider_repository_id=$2
           AND link.normalized_root_path=$3 AND link.state='ACTIVE'
         ORDER BY convert_to(link.id,'UTF8')`,
        [
          command.payload.provider,
          command.payload.providerRepositoryId,
          command.payload.normalizedRoot,
          version.rows[0].id,
        ],
      );
      const activeLink = links.rows.at(0);
      if (
        links.rows.length !== 1 ||
        activeLink === undefined ||
        activeLink.id !== command.payload.activeSourceLinkId
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      const observation = await client.query<{ id: string }>(
        `SELECT observation.id FROM resource_version_observations observation
         JOIN resource_candidates candidate ON candidate.id=$3
         WHERE observation.resource_version_identity_id=$1 AND observation.source_snapshot_id=$2
           AND observation.candidate_root_id=candidate.candidate_root_id
           AND observation.resource_source_link_id=$4`,
        [
          version.rows[0].id,
          command.payload.sourceSnapshotId,
          command.targetCandidateId,
          activeLink.id,
        ],
      );
      discovery.attachShape = observation.rows[0] === undefined ? "A2" : "A3";
    }
  }
  if (["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(family)) {
    const active =
      family === "MARK_FORK"
        ? await client.query<{ id: string; decision_id: string }>(
            `SELECT id,decision_id FROM fork_relationships
             WHERE fork_resource_version_id=$1 AND state='ACTIVE'
             ORDER BY convert_to(id,'UTF8')`,
            [command.payload.forkResourceVersionId],
          )
        : family === "MARK_MIRROR"
          ? await client.query<{ id: string; decision_id: string }>(
              `SELECT id,decision_id FROM source_repository_relationships
               WHERE mirror_source_repository_id=$1 AND state='ACTIVE'
               ORDER BY convert_to(id,'UTF8')`,
              [command.payload.mirrorSourceRepositoryId],
            )
          : await client.query<{ id: string; decision_id: string }>(
              `SELECT id,decision_id FROM duplicate_candidates
               WHERE resource_candidate_id=$1 AND status='CONFIRMED'
               ORDER BY convert_to(id,'UTF8')`,
              [command.targetCandidateId],
            );
    if ((active.rowCount ?? 0) > 1) throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (active.rows[0] === undefined) {
      if (candidatePhase !== "P1") throw new ManualResolutionError("TRANSITION_PROHIBITED");
      discovery.relationshipShape = "FIRST";
    } else {
      const activeDecision = decisions.rows.at(0);
      const activeRelationship = active.rows.at(0);
      if (
        activeRelationship === undefined ||
        activeDecision?.id !== activeRelationship.decision_id ||
        (family === "MARK_DUPLICATE" ? status !== "REJECTED" : candidatePhase !== "P2")
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      discovery.relationshipShape = "CORRECTION";
    }
  }
  if (family === "MARK_MIRROR" && discovery.relationshipShape === "FIRST") {
    const observation = await client.query<{ id: string }>(
      `SELECT observation.id FROM resource_version_observations observation
       JOIN resource_source_links link ON link.id=observation.resource_source_link_id
       WHERE link.source_repository_id=$1 AND link.normalized_root_path=$2
         AND link.target_resource_version_id=$3 AND link.state='ACTIVE'
         AND observation.source_snapshot_id=$4`,
      [
        command.payload.mirrorSourceRepositoryId,
        command.payload.normalizedRoot,
        command.payload.targetResourceVersionId,
        command.payload.sourceSnapshotId,
      ],
    );
    discovery.mirrorShape = observation.rows[0] === undefined ? "M1" : "M2";
  }
  if (family === "REQUEST_CLARIFICATION")
    discovery.clarificationGuard = guardVersion === undefined ? "T0" : "T1";
  if (family === "REPLACE_M02_JOB") {
    const source = (
      await client.query<ReplacementSourceState>(
        `SELECT source.id,acquisition.status,acquisition.cancellation_requested,
                source.supersession_state,source.operation_scope,source.input_fingerprint
         FROM m02_jobs source JOIN acquisition_jobs acquisition ON acquisition.id=source.id
         WHERE source.id=$1`,
        [command.payload.sourceJobId],
      )
    ).rows[0];
    if (source === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    validateReplacementTransition(command, source);
    const scopes = invalidatedReplacementScopes(command.payload.requestedOperationScope ?? "");
    const jobs = await client.query<{ id: string; operation_scope: string; status: string }>(
      `SELECT controller.id,controller.operation_scope,acquisition.status
       FROM m02_jobs source JOIN m02_jobs controller
         ON controller.job_lineage_id=source.job_lineage_id
       JOIN acquisition_jobs acquisition ON acquisition.id=controller.id
       WHERE source.id=$1 AND controller.supersession_state='CONTROLLING'
         AND controller.operation_scope=ANY($2::text[])
       ORDER BY convert_to(controller.id,'UTF8')`,
      [command.payload.sourceJobId, scopes],
    );
    if (
      jobs.rows.length === 0 ||
      !jobs.rows.some(({ id }) => id === command.payload.sourceJobId) ||
      (source.operation_scope === "IDENTITY_RESOLUTION" &&
        jobs.rows.some(
          ({ id, operation_scope, status: jobStatus }) =>
            id !== source.id &&
            ["CLASSIFICATION", "FULL_PIPELINE"].includes(operation_scope) &&
            jobStatus === "ACTIVE",
        ))
    )
      throw new ManualResolutionError("OVERLAPPING_CONTROLLER_CONFLICT");
    discovery.predecessorCardinality = jobs.rows.length > 1 ? "MULTIPLE" : "SINGLE";
    const predecessorIds = jobs.rows.map(({ id }) => id);
    const opens = await client.query<{ count: string }>(
      `SELECT count(*) FROM m02_clarification_requests clarification
       WHERE clarification.state='OPEN'
         AND clarification.controlling_job_id=ANY($1::text[])`,
      [predecessorIds],
    );
    discovery.replacementClarifications = Number(opens.rows[0]?.count ?? "0") === 0 ? "Z0" : "Z1";
  }
  if (command.command === "RESOLVE_AMBIGUITY") {
    const direct = {
      ...command,
      command: command.payload.selectedCommand,
    } as ManualResolutionEnvelope;
    discovery.selectedDirectMode = await discoverHumanProjectionMode(client, direct, guards);
  }
  return selectHumanProjectionMode(command, discovery);
}
