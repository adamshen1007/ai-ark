import { createHash } from "node:crypto";

import {
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  type CanonicalM02Value,
} from "@ai-ark/classification";
import {
  ManualResolutionError,
  type ManualResolutionEnvelope,
  type ManualResolutionResult,
} from "@ai-ark/identity";
import type { PoolClient } from "pg";

import {
  allocateM02Id,
  compareUtf8,
  type CommandMutationPlanV1,
  type PlannedAudit,
  type PlannedTypedRow,
} from "./m02-human-command-plan.js";
import { canonicalGuard } from "./m02-human-projectors.js";

interface TypedProjectionContext {
  readonly source_snapshot_id: string;
  readonly immutable_revision: string;
  readonly candidate_root_id: string;
  readonly normalized_root_path: string;
  readonly canonical_content_payload: Buffer;
  readonly candidate_content_fingerprint: string;
  readonly reconciled_classification_run_id: string;
  readonly identity_policy_version: string;
  readonly classification_policy_version: string;
  readonly source_repository_id: string;
  readonly provider: string;
  readonly provider_repository_id: string;
}

export interface TypedAuditSubject {
  readonly auditId?: string;
  readonly action:
    "COMMAND_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED" | "SUBJECT_SUPERSEDED";
  readonly subjectType: string;
  readonly subjectId: string;
  readonly beforeVersion?: number;
  readonly afterVersion?: number;
  readonly beforeState?: string;
  readonly afterState?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

const HUMAN_TIER_SEQUENCE = [
  { tier: "P1", evaluationDisposition: "NO_MATCH" },
  { tier: "P2", evaluationDisposition: "NO_MATCH" },
  { tier: "P3", evaluationDisposition: "NO_MATCH" },
  { tier: "P4", evaluationDisposition: "NO_MATCH" },
  { tier: "P5", evaluationDisposition: "NO_MATCH" },
  { tier: "P6", evaluationDisposition: "NO_MATCH" },
] as const;

function hash(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalState(value: Readonly<Record<string, unknown>>): string {
  return Buffer.from(canonicalM02JsonBytes(value as never)).toString("utf8");
}

function requiredValue<T>(value: T | undefined): T {
  if (value === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  return value;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  return value;
}

function isCanonicalObject(
  value: CanonicalM02Value,
): value is Readonly<Record<string, CanonicalM02Value>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allocatedIds(command: ManualResolutionEnvelope, name: string): readonly string[] {
  return JSON.parse(command.payload[name] ?? "[]") as readonly string[];
}

function allocatedId(command: ManualResolutionEnvelope, name: string, index: number): string {
  const ids = [...allocatedIds(command, name)];
  if (name === "auditIdsJson") {
    while (ids.length <= index) ids.push(allocateM02Id());
    (command.payload as Record<string, string>)[name] = JSON.stringify(ids);
  }
  const id = ids[index];
  if (id === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  return id;
}

function nextSubjectAuditId(
  command: ManualResolutionEnvelope,
  _auditBase: string,
  subjects: readonly TypedAuditSubject[],
): string {
  return allocatedId(command, "auditIdsJson", subjects.length);
}

const LOCK_ROW_TABLES = new Set([
  "acquisition_jobs",
  "candidate_roots",
  "duplicate_candidates",
  "fork_relationships",
  "identity_decisions",
  "m02_clarification_requests",
  "m02_identity_handoff_markers",
  "m02_jobs",
  "m02_review_states",
  "repository_candidate_groups",
  "resource_candidates",
  "resource_identities",
  "resource_source_links",
  "resource_version_observations",
  "resource_version_identities",
  "source_repository_identities",
  "source_repository_relationships",
]);

export async function lockTypedRows(client: PoolClient, keys: readonly string[]): Promise<void> {
  const rows = keys
    .map((key) => {
      if (key.startsWith("guard:")) return { id: key, table: "m02_concurrency_guards" };
      if (!key.startsWith("row:")) throw new ManualResolutionError("REFERENCE_INVALID");
      const [, table, ...idParts] = key.split(":");
      const id = idParts.join(":");
      if (table === undefined || !LOCK_ROW_TABLES.has(table) || id.length === 0)
        throw new ManualResolutionError("REFERENCE_INVALID");
      return { id, table };
    })
    .sort((left, right) => compareUtf8(`${left.table}:${left.id}`, `${right.table}:${right.id}`));
  for (const row of rows)
    await client.query(
      row.table === "m02_concurrency_guards"
        ? "SELECT guard_key FROM m02_concurrency_guards WHERE guard_key=$1 FOR UPDATE"
        : `SELECT id FROM ${row.table} WHERE id=$1 FOR UPDATE`,
      [row.id],
    );
}

async function projectionContext(
  client: PoolClient,
  command: ManualResolutionEnvelope,
): Promise<TypedProjectionContext> {
  const result = await client.query<TypedProjectionContext>(
    `SELECT candidate.source_snapshot_id, snapshot.immutable_revision,
       candidate.candidate_root_id, root.normalized_root_path, root.canonical_content_payload,
       candidate.candidate_content_fingerprint, candidate.reconciled_classification_run_id,
       candidate.identity_policy_version, candidate.classification_policy_version,
       repository.id AS source_repository_id, snapshot.provider, snapshot.provider_repository_id
     FROM resource_candidates candidate
     JOIN candidate_roots root ON root.id = candidate.candidate_root_id
     JOIN source_snapshots snapshot ON snapshot.id = candidate.source_snapshot_id
     JOIN source_repository_identities repository
       ON repository.provider = snapshot.provider
      AND repository.provider_repository_id = snapshot.provider_repository_id
     WHERE candidate.id = $1`,
    [command.targetCandidateId],
  );
  const context = result.rows[0];
  if (context === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  return context;
}

function effectiveCommand(command: ManualResolutionEnvelope): string {
  return command.command === "RESOLVE_AMBIGUITY"
    ? (command.payload.selectedCommand ?? "")
    : command.command;
}

interface OpenClarificationTargetRow {
  readonly id: string;
  readonly record_version: string;
  readonly target_classification_run_id: string | null;
  readonly target_identity_decision_id: string | null;
  readonly target_rejection_decision_id: string | null;
}

async function exactOpenClarifications(
  client: PoolClient,
  command: ManualResolutionEnvelope,
): Promise<readonly OpenClarificationTargetRow[]> {
  const controllingJobId = command.payload.jobId;
  if (controllingJobId === undefined) return [];
  const lineage = (
    await client.query<{
      reconciled_classification_run_id: string;
      active_identity_decision_id: string | null;
      active_rejection_decision_id: string | null;
    }>(
      `SELECT candidate.reconciled_classification_run_id,
          (SELECT decision.id FROM identity_decisions decision
           WHERE decision.resource_candidate_id=candidate.id AND decision.state='ACTIVE'
           ORDER BY convert_to(decision.id,'UTF8') LIMIT 1) AS active_identity_decision_id,
          (SELECT rejection.id FROM m02_candidate_rejection_decisions rejection
           WHERE rejection.resource_candidate_id=candidate.id AND rejection.state='ACTIVE'
           ORDER BY convert_to(rejection.id,'UTF8') LIMIT 1) AS active_rejection_decision_id
       FROM resource_candidates candidate WHERE candidate.id=$1`,
      [command.targetCandidateId],
    )
  ).rows[0];
  if (lineage === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  return (
    await client.query<OpenClarificationTargetRow>(
      `SELECT id,record_version,target_classification_run_id,target_identity_decision_id,
              target_rejection_decision_id
       FROM m02_clarification_requests
       WHERE state='OPEN' AND controlling_job_id=$1
         AND (resource_candidate_id=$2 OR candidate_group_id=$3)
         AND (target_classification_run_id=$4
           OR target_identity_decision_id=$5 OR target_rejection_decision_id=$6)
       ORDER BY convert_to(id,'UTF8')`,
      [
        controllingJobId,
        command.targetCandidateId,
        command.targetGroupId,
        lineage.reconciled_classification_run_id,
        lineage.active_identity_decision_id,
        lineage.active_rejection_decision_id,
      ],
    )
  ).rows;
}

/** Column-complete create intents for the first extracted projector phase. */
export interface TypedFamilyIntents {
  readonly creates: readonly PlannedTypedRow[];
  readonly updates: readonly PlannedTypedRow[];
  readonly supersedes: readonly PlannedTypedRow[];
  readonly audits: readonly PlannedAudit[];
}

async function completeRow(
  client: PoolClient,
  table:
    | "resource_candidates"
    | "m02_review_states"
    | "acquisition_jobs"
    | "m02_jobs"
    | "identity_decisions"
    | "m02_clarification_requests"
    | "fork_relationships"
    | "source_repository_relationships"
    | "duplicate_candidates"
    | "resource_source_links",
  id: string,
): Promise<Record<string, unknown> | undefined> {
  return (
    await client.query<{ value: Record<string, unknown> }>(
      `SELECT to_jsonb(row) AS value FROM ${table} row WHERE id=$1`,
      [id],
    )
  ).rows[0]?.value;
}

async function buildTopologyIntents(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
): Promise<TypedFamilyIntents> {
  const context = await projectionContext(client, command);
  const selected = effectiveCommand(command);
  const replacementGroupId = command.payload.replacementGroupId ?? "";
  const replacementRunId = command.payload.replacementRunId ?? "";
  const classification = selected === "SPLIT_ROOTS" ? "MULTIPLE_SKILLS" : "SINGLE_SKILL";
  const fetch = async (table: string, id: string): Promise<Record<string, unknown>> => {
    const row = (
      await client.query<{ value: Record<string, unknown> }>(
        `SELECT to_jsonb(row) AS value FROM ${table} row WHERE id=$1`,
        [id],
      )
    ).rows[0]?.value;
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    return row;
  };
  const group = await fetch("repository_candidate_groups", command.targetGroupId);
  const predecessorRun = await fetch(
    "repository_classification_runs",
    context.reconciled_classification_run_id,
  );
  const openClarificationCount = (await exactOpenClarifications(client, command)).length;
  let auditIndex = openClarificationCount;
  const nextAudit = (): string => allocatedId(command, "auditIdsJson", auditIndex++);
  const groupSupersessionAuditId = nextAudit();
  const groupCreationAuditId = nextAudit();
  const runCreationAuditId = nextAudit();
  const roots =
    command.payload.replacementRootsJson === undefined
      ? (command.payload.replacementRootIds ?? "")
          .split(",")
          .filter(Boolean)
          .map((id, index) => ({
            id,
            normalizedPath:
              (JSON.parse(command.payload.selectedRootPathsJson ?? "[]") as string[])[index] ?? ".",
          }))
      : (JSON.parse(command.payload.replacementRootsJson) as {
          id: string;
          normalizedPath: string;
        }[]);
  const orderedRootIds = (command.payload.replacementRootIds ?? "").split(",").filter(Boolean);
  const candidateIds = (command.payload.replacementCandidateIds ?? "").split(",").filter(Boolean);
  const originalCandidateIds = (command.payload.originalCandidateIds ?? "")
    .split(",")
    .filter(Boolean);
  const originalRootIds = (command.payload.originalRootIds ?? "").split(",").filter(Boolean);
  const creates: PlannedTypedRow[] = [];
  const updates: PlannedTypedRow[] = [];
  const supersedes: PlannedTypedRow[] = [];
  creates.push({
    table: "repository_candidate_groups",
    id: replacementGroupId,
    completeTypedValues: {
      id: replacementGroupId,
      source_snapshot_id: context.source_snapshot_id,
      classification_policy_version: group.classification_policy_version as never,
      group_key: `${String(group.group_key)}:${command.commandId}`,
      group_fingerprint: hash(
        canonicalM02JsonBytes({
          predecessor: command.targetGroupId,
          replacementGroupId,
          command: selected,
        }),
      ),
      classification,
      confidence: null,
      ordered_candidate_root_ids: orderedRootIds,
      ordered_evidence_reference_ids: [],
      ordered_warning_codes: [],
      ordered_reason_codes: [],
      review_state: "CLASSIFICATION_REVIEW_REQUIRED",
      identity_policy_version: group.identity_policy_version as never,
      parser_profile_version: group.parser_profile_version as never,
      analysis_policy_version: group.analysis_policy_version as never,
      prompt_bundle_version: group.prompt_bundle_version as never,
      state: "ACTIVE",
      supersedes_group_id: command.targetGroupId,
      created_at: command.timestamp,
      record_version: 1,
      superseded_by_group_id: null,
      replacement_command_id: command.commandId,
      replacement_result_id: resultId,
      replacement_audit_event_id: groupCreationAuditId,
    },
  });
  supersedes.push({
    table: "repository_candidate_groups",
    id: command.targetGroupId,
    expectedRecordVersion: Number(group.record_version),
    expectedState: String(group.state),
    completeTypedValues: {
      ...group,
      state: "SUPERSEDED",
      superseded_by_group_id: replacementGroupId,
      replacement_command_id: command.commandId,
      replacement_result_id: resultId,
      replacement_audit_event_id: groupSupersessionAuditId,
      record_version: Number(group.record_version) + 1,
    },
  });
  creates.push({
    table: "repository_classification_runs",
    id: replacementRunId,
    completeTypedValues: {
      id: replacementRunId,
      group_id: replacementGroupId,
      source_snapshot_id: context.source_snapshot_id,
      analysis_run_id: null,
      run_source: "HUMAN_OVERRIDE",
      classification,
      confidence: null,
      ordered_candidate_root_ids: orderedRootIds,
      ordered_evidence_reference_ids: [],
      ordered_warning_codes: [],
      ordered_reason_codes: [],
      review_state: "CLASSIFICATION_REVIEW_REQUIRED",
      classification_policy_version: predecessorRun.classification_policy_version as never,
      identity_policy_version: predecessorRun.identity_policy_version as never,
      analysis_policy_version: predecessorRun.analysis_policy_version as never,
      prompt_bundle_version: predecessorRun.prompt_bundle_version as never,
      parser_profile_version: predecessorRun.parser_profile_version as never,
      methodology_version: predecessorRun.methodology_version as never,
      input_fingerprint: hash(
        canonicalM02JsonBytes({ commandId: command.commandId, phase: "input" }),
      ),
      output_fingerprint: hash(
        canonicalM02JsonBytes({ commandId: command.commandId, phase: "output" }),
      ),
      supersedes_run_id: context.reconciled_classification_run_id,
      created_at: command.timestamp,
      replacement_command_id: command.commandId,
      replacement_result_id: resultId,
      replacement_audit_event_id: runCreationAuditId,
    },
  });
  for (const [ordinal, root] of roots.entries()) {
    const rootAuditId = nextAudit();
    const rootPayload = canonicalM02JsonBytes({
      normalizedRootPath: root.normalizedPath,
      sourceSnapshotId: context.source_snapshot_id,
    });
    const rootFingerprint = hash(rootPayload);
    const contentFingerprint = hash(
      canonicalM02JsonBytes({
        rootFingerprint,
        predecessorContent: context.candidate_content_fingerprint,
      }),
    );
    creates.push({
      table: "candidate_roots",
      id: root.id,
      completeTypedValues: {
        id: root.id,
        group_id: replacementGroupId,
        classification_run_id: replacementRunId,
        source_snapshot_id: context.source_snapshot_id,
        normalized_root_path: root.normalizedPath,
        candidate_root_fingerprint: rootFingerprint,
        candidate_content_fingerprint: contentFingerprint,
        canonical_root_payload: `\\x${Buffer.from(rootPayload).toString("hex")}`,
        canonical_content_payload: `\\x${Buffer.from(canonicalM02JsonBytes({ contentFingerprint })).toString("hex")}`,
        root_idempotency_key: `${replacementGroupId}:${rootFingerprint}:${contentFingerprint}`,
        state: "ACTIVE",
        record_version: 1,
        superseded_by_root_id: null,
        replacement_command_id: null,
        replacement_result_id: null,
        replacement_audit_event_id: null,
      },
    });
    void rootAuditId;
    const orderId = allocatedId(command, "rootOrderIdsJson", ordinal);
    nextAudit();
    creates.push({
      table: "repository_candidate_root_order",
      id: orderId,
      completeTypedValues: {
        id: orderId,
        group_id: replacementGroupId,
        classification_run_id: replacementRunId,
        candidate_root_id: root.id,
        source_snapshot_id: context.source_snapshot_id,
        root_ordinal: ordinal,
        created_at: command.timestamp,
        command_id: command.commandId,
      },
    });
    const candidateId = candidateIds[ordinal] ?? candidateIds[0];
    if (candidateId !== undefined) {
      const candidateAuditId = nextAudit();
      creates.push({
        table: "resource_candidates",
        id: candidateId,
        completeTypedValues: {
          id: candidateId,
          source_snapshot_id: context.source_snapshot_id,
          candidate_root_id: root.id,
          candidate_root_fingerprint: rootFingerprint,
          candidate_content_fingerprint: contentFingerprint,
          reconciled_classification_run_id: replacementRunId,
          classification_policy_version: context.classification_policy_version,
          identity_policy_version: context.identity_policy_version,
          identity_outcome: null,
          identity_confidence: null,
          ordered_provenance: [command.targetCandidateId],
          candidate_idempotency_key: `${replacementGroupId}:${rootFingerprint}:${contentFingerprint}`,
          status: "IDENTITY_REVIEW_REQUIRED",
          resource_identity_id: null,
          resource_version_identity_id: null,
          created_at: command.timestamp,
          updated_at: command.timestamp,
          record_version: 1,
          terminal_reason_code: null,
          superseded_by_candidate_id: null,
          creation_command_id: command.commandId,
          creation_result_id: resultId,
          creation_audit_event_id: candidateAuditId,
          replacement_command_id: null,
          replacement_result_id: null,
          replacement_audit_event_id: null,
        },
      });
      const edgeId = allocatedId(command, "groupEdgeIdsJson", ordinal);
      nextAudit();
      creates.push({
        table: "repository_group_relationships",
        id: edgeId,
        completeTypedValues: {
          id: edgeId,
          parent_group_id: replacementGroupId,
          child_candidate_id: candidateId,
          relationship_type: "INCLUDES",
          relationship_order: ordinal,
          command_id: command.commandId,
        },
      });
      const reviewId = allocatedId(command, "reviewIdsJson", ordinal);
      nextAudit();
      creates.push({
        table: "m02_review_states",
        id: reviewId,
        completeTypedValues: {
          id: reviewId,
          group_id: null,
          resource_candidate_id: candidateId,
          review_state: "IDENTITY_REVIEW_REQUIRED",
          record_version: 1,
          source_snapshot_id: context.source_snapshot_id,
          controlling_job_id: command.payload.jobId ?? null,
          terminal_reason_code: null,
          superseded_by_review_id: null,
          replacement_command_id: null,
          replacement_result_id: null,
          replacement_audit_event_id: null,
        },
      });
    }
  }
  for (const [index, candidateId] of originalCandidateIds.entries()) {
    const row = await fetch("resource_candidates", candidateId);
    const audit = nextAudit();
    supersedes.push({
      table: "resource_candidates",
      id: candidateId,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.status),
      completeTypedValues: {
        ...row,
        status: "SUPERSEDED",
        terminal_reason_code: "TOPOLOGY_SUPERSEDED",
        superseded_by_candidate_id: candidateIds[index] ?? candidateIds[0] ?? null,
        replacement_command_id: command.commandId,
        replacement_result_id: resultId,
        replacement_audit_event_id: audit,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  for (const [index, rootId] of originalRootIds.entries()) {
    const row = await fetch("candidate_roots", rootId);
    const audit = nextAudit();
    supersedes.push({
      table: "candidate_roots",
      id: rootId,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "SUPERSEDED",
        superseded_by_root_id: roots[index]?.id ?? roots[0]?.id ?? null,
        replacement_command_id: command.commandId,
        replacement_result_id: resultId,
        replacement_audit_event_id: audit,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  const decisions =
    originalCandidateIds.length === 0
      ? []
      : (
          await client.query<{ id: string }>(
            `SELECT id FROM identity_decisions WHERE resource_candidate_id=ANY($1::text[])
     AND state='ACTIVE' ORDER BY convert_to(id,'UTF8')`,
            [originalCandidateIds],
          )
        ).rows;
  for (const { id } of decisions) {
    const row = await fetch("identity_decisions", id);
    const audit = nextAudit();
    supersedes.push({
      table: "identity_decisions",
      id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "SUPERSEDED",
        replacement_command_id: command.commandId,
        replacement_result_id: resultId,
        replacement_audit_event_id: audit,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  const reviews = (
    await client.query<{ id: string; resource_candidate_id: string | null }>(
      `SELECT id,resource_candidate_id FROM m02_review_states
     WHERE (resource_candidate_id=ANY($1::text[]) OR ($2::boolean AND group_id=$3))
       AND review_state IN ('IDENTITY_REVIEW_REQUIRED','CLARIFICATION_REQUESTED','CLASSIFICATION_REVIEW_REQUIRED')
     ORDER BY convert_to(id,'UTF8')`,
      [originalCandidateIds, selected === "OVERRIDE_NON_SKILL", command.targetGroupId],
    )
  ).rows;
  for (const review of reviews) {
    const row = await fetch("m02_review_states", review.id);
    const successorIndex =
      review.resource_candidate_id === null
        ? -1
        : originalCandidateIds.indexOf(review.resource_candidate_id);
    const audit = nextAudit();
    supersedes.push({
      table: "m02_review_states",
      id: review.id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.review_state),
      completeTypedValues: {
        ...row,
        review_state: "SUPERSEDED",
        terminal_reason_code: "TOPOLOGY_SUPERSEDED",
        superseded_by_review_id:
          originalCandidateIds.length === candidateIds.length && successorIndex >= 0
            ? allocatedId(command, "reviewIdsJson", successorIndex)
            : null,
        replacement_command_id: command.commandId,
        replacement_result_id: resultId,
        replacement_audit_event_id: audit,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  const ownership = JSON.parse(command.payload.replacementOwnershipJson ?? "[]") as {
    rootId: string;
    sourceEntryId: string;
    ownership: string;
  }[];
  const successorOwnership: { id: string; sourceEntryId: string }[] = [];
  for (const [index, fact] of ownership.entries()) {
    const id = allocatedId(command, "ownershipIdsJson", index);
    creates.push({
      table: "candidate_root_ownership",
      id,
      completeTypedValues: {
        id,
        candidate_root_id: fact.rootId,
        source_snapshot_id: context.source_snapshot_id,
        source_entry_id: fact.sourceEntryId,
        ownership: fact.ownership,
        command_id: command.commandId,
      },
    });
    nextAudit();
    successorOwnership.push({ id, sourceEntryId: fact.sourceEntryId });
  }
  const replacementKind =
    selected === "SPLIT_ROOTS" ? "SPLIT" : selected === "MERGE_ROOTS" ? "MERGE" : "CREATED";
  const rootPairs =
    originalRootIds.length === 0
      ? roots.map((root) => [null, root.id] as const)
      : originalRootIds.flatMap((oldId) => roots.map((root) => [oldId, root.id] as const));
  for (const [index, [oldId, newId]] of rootPairs.entries()) {
    const id = allocatedId(command, "rootReplacementIdsJson", index);
    creates.push({
      table: "m02_root_replacements",
      id,
      completeTypedValues: {
        id,
        predecessor_root_id: oldId,
        successor_root_id: newId,
        replacement_kind: replacementKind,
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: nextAudit(),
        predecessor_ordinal: oldId === null ? null : originalRootIds.indexOf(oldId),
        successor_ordinal: roots.findIndex((root) => root.id === newId),
        reason: command.reason,
        created_at: command.timestamp,
      },
    });
  }
  const candidatePairs =
    originalCandidateIds.length === 0
      ? candidateIds.map((id) => [null, id] as const)
      : originalCandidateIds.flatMap((oldId) => candidateIds.map((id) => [oldId, id] as const));
  for (const [index, [oldId, newId]] of candidatePairs.entries()) {
    const id = allocatedId(command, "candidateReplacementIdsJson", index);
    creates.push({
      table: "m02_candidate_replacements",
      id,
      completeTypedValues: {
        id,
        predecessor_candidate_id: oldId,
        successor_candidate_id: newId,
        replacement_kind: replacementKind,
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: nextAudit(),
        reason: command.reason,
        created_at: command.timestamp,
      },
    });
  }
  const predecessorOwnership =
    originalRootIds.length === 0
      ? []
      : (
          await client.query<{ id: string; source_entry_id: string }>(
            `SELECT id,source_entry_id FROM candidate_root_ownership WHERE candidate_root_id=ANY($1::text[])
     ORDER BY convert_to(id,'UTF8')`,
            [originalRootIds],
          )
        ).rows;
  const predecessorSourceEntries = new Set(
    predecessorOwnership.map(({ source_entry_id }) => source_entry_id),
  );
  const ownershipPairs: {
    predecessor: { id: string; source_entry_id: string } | null;
    successor: { id: string; sourceEntryId: string } | null;
  }[] = [];
  for (const predecessor of predecessorOwnership) {
    const matches = successorOwnership.filter(
      ({ sourceEntryId }) => sourceEntryId === predecessor.source_entry_id,
    );
    if (matches.length === 0) ownershipPairs.push({ predecessor, successor: null });
    else for (const successor of matches) ownershipPairs.push({ predecessor, successor });
  }
  for (const successor of successorOwnership)
    if (!predecessorSourceEntries.has(successor.sourceEntryId))
      ownershipPairs.push({ predecessor: null, successor });
  for (const [index, { predecessor, successor }] of ownershipPairs.entries()) {
    const successorId = successor?.id ?? null;
    const sourceEntryId = predecessor?.source_entry_id ?? successor?.sourceEntryId;
    if (sourceEntryId === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const id = allocatedId(command, "ownershipReplacementIdsJson", index);
    creates.push({
      table: "m02_ownership_replacements",
      id,
      completeTypedValues: {
        id,
        predecessor_ownership_id: predecessor?.id ?? null,
        successor_ownership_id: successorId,
        replacement_kind:
          predecessor === null ? "CREATED" : successor === null ? "RETIRED" : "RETAINED",
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: nextAudit(),
        created_at: command.timestamp,
        source_entry_id: sourceEntryId,
      },
    });
  }
  const predecessorEdges = (
    await client.query<{ id: string }>(
      "SELECT id FROM repository_group_relationships WHERE parent_group_id=$1 ORDER BY convert_to(id,'UTF8')",
      [command.targetGroupId],
    )
  ).rows;
  const successorEdgeIds = candidateIds.map((_, index) =>
    allocatedId(command, "groupEdgeIdsJson", index),
  );
  const edgePairs =
    predecessorEdges.length === 0
      ? successorEdgeIds.map((id) => [null, id] as const)
      : predecessorEdges.flatMap((old) => successorEdgeIds.map((id) => [old.id, id] as const));
  for (const [index, [oldId, newId]] of edgePairs.entries()) {
    const id = allocatedId(command, "edgeReplacementIdsJson", index);
    creates.push({
      table: "m02_group_edge_replacements",
      id,
      completeTypedValues: {
        id,
        predecessor_group_edge_id: oldId,
        successor_group_edge_id: newId,
        replacement_kind: oldId === null ? "CREATED" : "REASSIGNED",
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: nextAudit(),
        created_at: command.timestamp,
      },
    });
  }
  const jobId = command.payload.jobId;
  if (jobId !== undefined) {
    const acquisition = await fetch("acquisition_jobs", jobId);
    updates.push({
      table: "acquisition_jobs",
      id: jobId,
      expectedRecordVersion: Number(acquisition.record_version),
      expectedState: String(acquisition.status),
      completeTypedValues: {
        ...acquisition,
        status: "OPERATOR_REVIEW_REQUIRED",
        record_version: Number(acquisition.record_version) + 1,
      },
    });
    const job = await fetch("m02_jobs", jobId);
    updates.push({
      table: "m02_jobs",
      id: jobId,
      expectedRecordVersion: Number(job.record_version),
      expectedState: String(job.review_state),
      completeTypedValues: {
        ...job,
        review_state: "IDENTITY_REVIEW_REQUIRED",
        record_version: Number(job.record_version) + 1,
      },
    });
  }
  return { creates, updates, supersedes, audits: [] };
}

async function buildReplacementIntents(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  auditBase: string,
): Promise<TypedFamilyIntents> {
  const sourceJobId = command.payload.sourceJobId ?? "";
  const replacementJobId = command.payload.replacementJobId ?? "";
  const fetch = async (
    table: "acquisition_jobs" | "m02_jobs",
    id: string,
  ): Promise<Record<string, unknown>> => {
    const row = (
      await client.query<{ value: Record<string, unknown> }>(
        `SELECT to_jsonb(row) AS value FROM ${table} row WHERE id=$1`,
        [id],
      )
    ).rows[0]?.value;
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    return row;
  };
  const source = await fetch("m02_jobs", sourceJobId);
  const sourceAcquisition = await fetch("acquisition_jobs", sourceJobId);
  const requestedScope = command.payload.requestedOperationScope ?? "";
  const invalidatedScopes =
    requestedScope === "FULL_PIPELINE"
      ? ["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"]
      : requestedScope === "CLASSIFICATION"
        ? ["CLASSIFICATION", "IDENTITY_RESOLUTION"]
        : ["IDENTITY_RESOLUTION"];
  const predecessors = (
    await client.query<{ id: string }>(
      `SELECT controller.id FROM m02_jobs source JOIN m02_jobs controller
       ON controller.job_lineage_id=source.job_lineage_id
     WHERE source.id=$1 AND controller.supersession_state='CONTROLLING'
       AND controller.operation_scope=ANY($2::text[])
     ORDER BY convert_to(controller.id,'UTF8')`,
      [sourceJobId, invalidatedScopes],
    )
  ).rows;
  const predecessorRows = await Promise.all(
    predecessors.map(async ({ id }) => ({
      id,
      acquisition: await fetch("acquisition_jobs", id),
      job: await fetch("m02_jobs", id),
    })),
  );
  const predecessorIds = predecessorRows.map(({ id }) => id).sort(compareUtf8);
  const snapshotId = command.payload.replacementSnapshotId ?? String(source.source_snapshot_id);
  const replacementInput = canonicalM02JsonBytes({
    schemaVersion: "1",
    jobLineageId: source.job_lineage_id as never,
    sourceJobId,
    sourceOperationScope: source.operation_scope as never,
    requestedOperationScope: command.payload.requestedOperationScope ?? "",
    predecessorJobIds: predecessorIds,
    sourceSnapshotId: source.source_snapshot_id as never,
    replacementSourceSnapshotIdOrNull: command.payload.replacementSnapshotId ?? null,
    classificationPolicyVersion: command.payload.classificationPolicyVersion ?? "",
    identityPolicyVersion: command.payload.identityPolicyVersion ?? "",
    analysisPolicyVersion: command.payload.analysisPolicyVersion ?? "",
    parserProfileVersion: source.parser_profile_version as never,
    promptBundleVersion: command.payload.promptBundleVersion ?? "",
    analysisProviderAdapterIdOrNull: source.analysis_provider_adapter_id as never,
    analysisModelIdOrNull: source.analysis_model_id as never,
    analysisMethodologyVersionOrNull: source.analysis_methodology_version as never,
    controllingClassificationDecisionIdOrNull:
      source.controlling_classification_decision_id as never,
  });
  const inputFingerprint = hash(replacementInput);
  if (inputFingerprint !== command.payload.replacementInputFingerprint)
    throw new ManualResolutionError("REFERENCE_INVALID");
  const nextSequence =
    Math.max(...predecessorRows.map(({ job }) => Number(job.supersession_sequence))) + 1;
  const creates: PlannedTypedRow[] = [
    {
      table: "acquisition_jobs",
      id: replacementJobId,
      completeTypedValues: {
        ...sourceAcquisition,
        id: replacementJobId,
        idempotency_key: `m02-replacement:${command.idempotencyKey}`,
        status: "ACTIVE",
        attempt: Number(sourceAcquisition.attempt) + 1,
        source_snapshot_id: snapshotId,
        failure: null,
        cancellation_requested: false,
        record_version: 1,
      },
    },
    {
      table: "m02_jobs",
      id: replacementJobId,
      completeTypedValues: {
        id: replacementJobId,
        job_lineage_id: source.job_lineage_id as never,
        source_snapshot_id: snapshotId,
        operation_scope: command.payload.requestedOperationScope ?? "",
        current_stage: "CLASSIFYING_REPOSITORY",
        review_state: "NOT_REQUIRED",
        supersession_state: "CONTROLLING",
        superseded_by_job_id: null,
        supersession_sequence: nextSequence,
        job_scope_key: hash(
          canonicalM02JsonBytes({
            jobLineageId: source.job_lineage_id as never,
            scope: command.payload.requestedOperationScope ?? "",
          }),
        ),
        input_fingerprint: inputFingerprint,
        classification_policy_version: command.payload.classificationPolicyVersion ?? "",
        identity_policy_version: command.payload.identityPolicyVersion ?? "",
        analysis_policy_version: command.payload.analysisPolicyVersion ?? "",
        parser_profile_version: source.parser_profile_version as never,
        prompt_bundle_version: command.payload.promptBundleVersion ?? "",
        replacement_reason_code: command.reasonCode,
        replacement_input_payload: `\\x${Buffer.from(replacementInput).toString("hex")}`,
        replacement_input_fingerprint: inputFingerprint,
        replacement_source_job_id: sourceJobId,
        replacement_source_operation_scope: source.operation_scope as never,
        replacement_requested_operation_scope: command.payload.requestedOperationScope ?? "",
        replacement_predecessor_job_ids: predecessorIds,
        replacement_original_source_snapshot_id: source.source_snapshot_id as never,
        replacement_source_snapshot_id: command.payload.replacementSnapshotId ?? null,
        analysis_provider_adapter_id: source.analysis_provider_adapter_id as never,
        analysis_model_id: source.analysis_model_id as never,
        analysis_methodology_version: source.analysis_methodology_version as never,
        controlling_classification_decision_id:
          source.controlling_classification_decision_id as never,
        record_version: 1,
      },
    },
  ];
  const supersedes: PlannedTypedRow[] = [];
  for (const predecessor of predecessorRows) {
    supersedes.push({
      table: "acquisition_jobs",
      id: predecessor.id,
      expectedRecordVersion: Number(predecessor.acquisition.record_version),
      completeTypedValues: {
        ...predecessor.acquisition,
        record_version: Number(predecessor.acquisition.record_version) + 1,
      },
    });
    supersedes.push({
      table: "m02_jobs",
      id: predecessor.id,
      expectedRecordVersion: Number(predecessor.job.record_version),
      expectedState: "CONTROLLING",
      completeTypedValues: {
        ...predecessor.job,
        supersession_state: "SUPERSEDED",
        superseded_by_job_id: replacementJobId,
        record_version: Number(predecessor.job.record_version) + 1,
      },
    });
  }
  const handoffs = (
    await client.query<{ id: string }>(
      `SELECT id FROM m02_identity_handoff_markers
     WHERE controlling_m02_job_id=ANY($1::text[]) AND state='ACTIVE'
     ORDER BY convert_to(id,'UTF8')`,
      [predecessorIds],
    )
  ).rows;
  for (const { id } of handoffs) {
    const row = (
      await client.query<{ value: Record<string, unknown> }>(
        "SELECT to_jsonb(row) AS value FROM m02_identity_handoff_markers row WHERE id=$1",
        [id],
      )
    ).rows[0]?.value;
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    supersedes.push({
      table: "m02_identity_handoff_markers",
      id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "SUPERSEDED",
        controlling_job_state: null,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  const clarifications = (
    await client.query<{ id: string }>(
      `SELECT id FROM m02_clarification_requests
     WHERE controlling_job_id=ANY($1::text[]) AND state='OPEN'
     ORDER BY convert_to(id,'UTF8')`,
      [predecessorIds],
    )
  ).rows;
  const edgeIds = JSON.parse(command.payload.replacementSupersessionIdsJson ?? "[]") as string[];
  const edgeAuditIds = JSON.parse(
    command.payload.replacementSupersessionAuditIdsJson ?? "[]",
  ) as string[];
  for (const [index, predecessor] of predecessorRows.entries()) {
    const id = edgeIds[index];
    const edgeAuditId = edgeAuditIds[index];
    if (id === undefined || edgeAuditId === undefined)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const scope = String(predecessor.job.operation_scope);
    creates.push({
      table: "m02_job_supersessions",
      id,
      completeTypedValues: {
        id,
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: edgeAuditId,
        guard_key: canonicalGuard("JOB_SCOPE_CONTROLLER", {
          jobLineageId: source.job_lineage_id as never,
          operationScope: scope,
        }).key,
        source_job_id: predecessor.id,
        replacement_job_id: replacementJobId,
        job_lineage_id: source.job_lineage_id as never,
        operation_scope: scope,
        supersession_state: "SUPERSEDED",
        reason_code: command.reasonCode,
        actor_id: command.actorId,
        actor_role: command.actorRole,
        evidence_ids: command.evidenceIds,
        supersession_sequence: nextSequence,
        created_at: command.timestamp,
      },
    });
  }
  let ordinaryAuditIndex = 0;
  const nextOrdinaryAudit = (): string =>
    allocatedId(command, "auditIdsJson", ordinaryAuditIndex++);
  const acquisitionAuditIds = new Map(predecessorRows.map(({ id }) => [id, nextOrdinaryAudit()]));
  const handoffAuditIds = new Map(handoffs.map(({ id }) => [id, nextOrdinaryAudit()]));
  const clarificationAuditIds = new Map(clarifications.map(({ id }) => [id, nextOrdinaryAudit()]));
  for (const { id } of clarifications) {
    const row = await completeRow(client, "m02_clarification_requests", id);
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    supersedes.push({
      table: "m02_clarification_requests",
      id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "SUPERSEDED",
        resolution_command_id: command.commandId,
        resolution_result_id: resultId,
        resolution_audit_event_id: requiredValue(clarificationAuditIds.get(id)),
        superseded_by_command_id: command.commandId,
        resolved_at: command.timestamp,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  const acquisitionCreationAuditId = nextOrdinaryAudit();
  const jobCreationAuditId = nextOrdinaryAudit();
  const audits: PlannedAudit[] = [
    {
      id: auditBase,
      action: "COMMAND_ACCEPTED",
      subjectType: "MANUAL_RESOLUTION_COMMAND",
      subjectId: command.commandId,
      beforeVersion: null,
      afterVersion: null,
      beforeState: null,
      afterState: null,
      metadata: {},
    },
  ];
  for (const predecessor of predecessorRows)
    audits.push({
      id: requiredValue(acquisitionAuditIds.get(predecessor.id)),
      action: "SUBJECT_UPDATED",
      subjectType: "ACQUISITION_JOB",
      subjectId: predecessor.id,
      beforeVersion: Number(predecessor.acquisition.record_version),
      afterVersion: Number(predecessor.acquisition.record_version) + 1,
      beforeState: {
        recordVersion: Number(predecessor.acquisition.record_version),
        status: String(predecessor.acquisition.status),
      },
      afterState: {
        recordVersion: Number(predecessor.acquisition.record_version) + 1,
        status: String(predecessor.acquisition.status),
      },
      metadata: {},
    });
  for (const [index, predecessor] of predecessorRows.entries())
    audits.push({
      id: requiredValue(edgeAuditIds[index]),
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_JOB",
      subjectId: predecessor.id,
      beforeVersion: Number(predecessor.job.record_version),
      afterVersion: Number(predecessor.job.record_version) + 1,
      beforeState: {
        recordVersion: Number(predecessor.job.record_version),
        state: "CONTROLLING",
      },
      afterState: {
        recordVersion: Number(predecessor.job.record_version) + 1,
        state: "SUPERSEDED",
        supersededByJobId: replacementJobId,
      },
      metadata: {
        scope: String(predecessor.job.operation_scope),
        guardKey:
          creates.find((row) => row.table === "m02_job_supersessions" && row.id === edgeIds[index])
            ?.completeTypedValues.guard_key ?? "",
      },
    });
  for (const { id } of handoffs) {
    const row = requiredValue(
      supersedes.find((entry) => entry.table === "m02_identity_handoff_markers" && entry.id === id),
    );
    audits.push({
      id: requiredValue(handoffAuditIds.get(id)),
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_IDENTITY_HANDOFF",
      subjectId: id,
      beforeVersion: row.expectedRecordVersion ?? null,
      afterVersion: Number(row.completeTypedValues.record_version),
      beforeState: { recordVersion: row.expectedRecordVersion ?? null, state: "ACTIVE" },
      afterState: {
        recordVersion: Number(row.completeTypedValues.record_version),
        state: "SUPERSEDED",
      },
      metadata: {},
    });
  }
  for (const { id } of clarifications) {
    const row = requiredValue(
      supersedes.find((entry) => entry.table === "m02_clarification_requests" && entry.id === id),
    );
    const values = row.completeTypedValues;
    const metadata =
      values.target_classification_run_id !== null
        ? {
            clarificationTargetType: "CLASSIFICATION",
            clarificationTargetId: values.target_classification_run_id as string,
          }
        : values.target_identity_decision_id !== null
          ? {
              clarificationTargetType: "IDENTITY",
              clarificationTargetId: values.target_identity_decision_id as string,
            }
          : {
              clarificationTargetType: "REJECTION",
              clarificationTargetId: values.target_rejection_decision_id as string,
            };
    audits.push({
      id: requiredValue(clarificationAuditIds.get(id)),
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: id,
      beforeVersion: row.expectedRecordVersion ?? null,
      afterVersion: Number(values.record_version),
      beforeState: { recordVersion: row.expectedRecordVersion ?? null, state: "OPEN" },
      afterState: { recordVersion: Number(values.record_version), state: "SUPERSEDED" },
      metadata,
    });
  }
  audits.push({
    id: acquisitionCreationAuditId,
    action: "SUBJECT_CREATED",
    subjectType: "ACQUISITION_JOB",
    subjectId: replacementJobId,
    beforeVersion: null,
    afterVersion: 1,
    beforeState: null,
    afterState: { recordVersion: 1, status: "ACTIVE" },
    metadata: {},
  });
  audits.push({
    id: jobCreationAuditId,
    action: "SUBJECT_CREATED",
    subjectType: "M02_JOB",
    subjectId: replacementJobId,
    beforeVersion: null,
    afterVersion: 1,
    beforeState: null,
    afterState: { recordVersion: 1, state: "CONTROLLING" },
    metadata: {
      scope: command.payload.requestedOperationScope ?? "",
      guardKey: canonicalGuard("JOB_SCOPE_CONTROLLER", {
        jobLineageId: source.job_lineage_id as never,
        operationScope: command.payload.requestedOperationScope ?? "",
      }).key,
    },
  });
  return { creates, updates: [], supersedes, audits };
}

async function buildReviewFamilyIntentsRaw(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  auditBase: string,
  expansionId: string,
): Promise<TypedFamilyIntents> {
  const selected = effectiveCommand(command);
  const empty: TypedFamilyIntents = { creates: [], updates: [], supersedes: [], audits: [] };
  if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected))
    return buildTopologyIntents(client, command, resultId);
  if (selected === "REPLACE_M02_JOB")
    return buildReplacementIntents(client, command, resultId, auditBase);
  if (["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(selected)) {
    const priorId = command.payload.priorRelationshipId;
    const table =
      selected === "MARK_FORK"
        ? "fork_relationships"
        : selected === "MARK_MIRROR"
          ? "source_repository_relationships"
          : "duplicate_candidates";
    const relationshipId =
      selected === "MARK_DUPLICATE"
        ? (command.payload.duplicateId ?? "")
        : (command.payload.relationshipId ?? "");
    const openClarifications = (await exactOpenClarifications(client, command)).length;
    let auditIndex = openClarifications;
    if (selected !== "MARK_DUPLICATE") {
      const surface = identityResultSurface(command, expansionId);
      auditIndex += surface.createdResources.length + surface.createdVersions.length;
      const sourceLinkId = command.payload.sourceLinkId ?? "";
      const oldLinkId = command.payload.activeSourceLinkId ?? command.payload.priorSourceLinkId;
      if (oldLinkId !== undefined && oldLinkId !== sourceLinkId) auditIndex += 1;
      if (
        Number(
          (
            await client.query<{ count: string }>(
              "SELECT count(*) FROM resource_source_links WHERE id=$1",
              [sourceLinkId],
            )
          ).rows[0]?.count ?? "0",
        ) === 0
      )
        auditIndex += 1;
      if (
        Number(
          (
            await client.query<{ count: string }>(
              "SELECT count(*) FROM resource_version_observations WHERE id=$1",
              [command.payload.observationId ?? ""],
            )
          ).rows[0]?.count ?? "0",
        ) === 0
      )
        auditIndex += 1;
    }
    const supersedes: PlannedTypedRow[] = [];
    if (priorId !== undefined) {
      const prior = await completeRow(client, table, priorId);
      if (prior === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      supersedes.push({
        table,
        id: priorId,
        expectedRecordVersion: Number(prior.record_version),
        expectedState: String(prior[selected === "MARK_DUPLICATE" ? "status" : "state"]),
        completeTypedValues: {
          ...prior,
          [selected === "MARK_DUPLICATE" ? "status" : "state"]: "SUPERSEDED",
          record_version: Number(prior.record_version) + 1,
        } as never,
      });
      auditIndex += 1;
    }
    if (selected === "MARK_DUPLICATE") {
      auditIndex +=
        Number(
          (
            await client.query<{ count: string }>(
              `SELECT count(*) FROM identity_decisions
         WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2`,
              [command.targetCandidateId, command.payload.decisionId ?? ""],
            )
          ).rows[0]?.count ?? "0",
        ) + 1;
    }
    const auditEventId = allocatedId(command, "auditIdsJson", auditIndex);
    const common = {
      id: relationshipId,
      evidence_ids: command.evidenceIds,
      decision_id: command.payload.decisionId ?? "",
      reason: command.reason,
      actor_id: command.actorId,
      created_at: command.timestamp,
      record_version: 1,
      command_id: command.commandId,
      result_id: resultId,
      audit_event_id: auditEventId,
    };
    const completeTypedValues =
      selected === "MARK_FORK"
        ? {
            ...common,
            fork_resource_version_id: command.payload.forkResourceVersionId ?? "",
            origin_resource_version_id: command.payload.originResourceVersionId ?? "",
            state: "ACTIVE",
            supersedes_relationship_id: priorId ?? null,
          }
        : selected === "MARK_MIRROR"
          ? {
              ...common,
              mirror_source_repository_id: command.payload.mirrorSourceRepositoryId ?? "",
              origin_source_repository_id: command.payload.originSourceRepositoryId ?? "",
              state: "ACTIVE",
              target_resource_version_id: command.payload.targetResourceVersionId ?? "",
              delivery_source_link_id: command.payload.sourceLinkId ?? "",
              supersedes_relationship_id: priorId ?? null,
            }
          : {
              ...common,
              resource_candidate_id: command.targetCandidateId,
              target_resource_version_id: command.payload.targetResourceVersionId ?? "",
              status: "CONFIRMED",
              supersedes_duplicate_id: priorId ?? null,
              origin_type: "HUMAN_COMMAND",
              system_operation_id: null,
              system_result_id: null,
            };
    return {
      creates: [{ table, id: relationshipId, completeTypedValues: completeTypedValues }],
      updates: [],
      supersedes,
      audits: [],
    };
  }
  if (selected === "ATTACH_NEW_VERSION" && expansionId.includes(":A1:")) {
    const context = await projectionContext(client, command);
    const surface = identityResultSurface(command, expansionId);
    const id = surface.versionId ?? "";
    return {
      creates: [
        {
          table: "resource_version_identities",
          id,
          completeTypedValues: {
            id,
            resource_identity_id: surface.resourceId ?? "",
            content_fingerprint:
              command.payload.contentFingerprint ?? context.candidate_content_fingerprint,
            canonical_payload: `\\x${context.canonical_content_payload.toString("hex")}`,
            first_observed_source_snapshot_id: context.source_snapshot_id,
            first_observed_candidate_root_id: context.candidate_root_id,
            first_observed_source_revision: context.immutable_revision,
            observation_label: `snapshot:${hash(context.source_snapshot_id).slice(0, 12)}`,
            status: "IDENTITY_RESOLVED",
            created_at: command.timestamp,
            record_version: 1,
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", 0),
          },
        },
      ],
      updates: [],
      supersedes: [],
      audits: [],
    };
  }
  if (selected === "CREATE_RESOURCE") {
    const context = await projectionContext(client, command);
    const surface = identityResultSurface(command, expansionId);
    const resourceId = surface.resourceId ?? "";
    const versionId = surface.versionId ?? "";
    const activeDecision =
      (
        await client.query<{ id: string }>(
          `SELECT id FROM identity_decisions WHERE resource_candidate_id=$1 AND state='ACTIVE'
       ORDER BY convert_to(id,'UTF8') LIMIT 1`,
          [command.targetCandidateId],
        )
      ).rows[0]?.id ?? null;
    return {
      creates: [
        {
          table: "resource_identities",
          id: resourceId,
          completeTypedValues: {
            id: resourceId,
            resource_type: "SKILL",
            status: "ACTIVE",
            reliable_identity_token: command.payload.reliableIdentityToken ?? null,
            reliable_token_evidence_id: command.payload.reliableTokenEvidenceId ?? null,
            created_at: command.timestamp,
            record_version: 1,
            origin_type: "HUMAN_COMMAND",
            guard_anchor_candidate_id: command.targetCandidateId,
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", 0),
          },
        },
        {
          table: "resource_version_identities",
          id: versionId,
          completeTypedValues: {
            id: versionId,
            resource_identity_id: resourceId,
            content_fingerprint:
              command.payload.contentFingerprint ?? context.candidate_content_fingerprint,
            canonical_payload: `\\x${context.canonical_content_payload.toString("hex")}`,
            first_observed_source_snapshot_id: context.source_snapshot_id,
            first_observed_candidate_root_id: context.candidate_root_id,
            first_observed_source_revision: context.immutable_revision,
            observation_label: `snapshot:${hash(context.source_snapshot_id).slice(0, 12)}`,
            status: "IDENTITY_RESOLVED",
            created_at: command.timestamp,
            record_version: 1,
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", 1),
          },
        },
        {
          table: "resource_source_links",
          id: command.payload.sourceLinkId ?? "",
          completeTypedValues: {
            id: command.payload.sourceLinkId ?? "",
            source_repository_id: context.source_repository_id,
            normalized_root_path: command.payload.normalizedRoot ?? context.normalized_root_path,
            target_resource_version_id: versionId,
            relationship: "PRIMARY",
            evidence_ids: command.evidenceIds,
            decision_id: command.payload.decisionId ?? "",
            reason: command.reason,
            actor_id: command.actorId,
            created_at: command.timestamp,
            state: "ACTIVE",
            supersedes_source_link_id: null,
            record_version: 1,
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", 2),
          },
        },
        {
          table: "resource_version_observations",
          id: command.payload.observationId ?? "",
          completeTypedValues: {
            id: command.payload.observationId ?? "",
            resource_version_identity_id: versionId,
            source_snapshot_id: context.source_snapshot_id,
            candidate_root_id: context.candidate_root_id,
            resource_source_link_id: command.payload.sourceLinkId ?? "",
            source_repository_id: context.source_repository_id,
            provider: context.provider,
            provider_repository_id: context.provider_repository_id,
            normalized_root_path: command.payload.normalizedRoot ?? context.normalized_root_path,
            immutable_revision: context.immutable_revision,
            observed_at: command.timestamp,
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", 3),
          },
        },
        {
          table: "identity_decisions",
          id: command.payload.decisionId ?? "",
          completeTypedValues: {
            id: command.payload.decisionId ?? "",
            resource_candidate_id: command.targetCandidateId,
            outcome: surface.outcome,
            matched_tier: null,
            confidence: null,
            identity_policy_version: context.identity_policy_version,
            decision_source: "HUMAN_COMMAND",
            signals: command.evidenceIds,
            rejected_lower_tier_signals: [],
            conflicts: [],
            audit_fingerprint: hash(
              canonicalM02JsonBytes({
                commandId: command.commandId,
                decisionId: command.payload.decisionId ?? "",
              }),
            ),
            state: "ACTIVE",
            supersedes_decision_id: activeDecision,
            created_at: command.timestamp,
            record_version: 1,
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", activeDecision === null ? 4 : 5),
            replacement_command_id: null,
            replacement_result_id: null,
            replacement_system_operation_id: null,
            replacement_system_result_id: null,
            replacement_audit_event_id: null,
            superseded_by_decision_id: null,
          },
        },
        {
          table: "m02_identity_handoff_markers",
          id: command.payload.handoffId ?? "",
          completeTypedValues: {
            id: command.payload.handoffId ?? "",
            resource_candidate_id: command.targetCandidateId,
            resource_identity_id: resourceId,
            resource_version_identity_id: versionId,
            controlling_m02_job_id: command.payload.jobId ?? "",
            source_snapshot_id: context.source_snapshot_id,
            identity_decision_id: command.payload.decisionId ?? "",
            origin_type: "HUMAN_COMMAND",
            command_id: command.commandId,
            result_id: resultId,
            system_operation_id: null,
            system_result_id: null,
            audit_event_id: allocatedId(command, "auditIdsJson", activeDecision === null ? 8 : 9),
            logical_key: `candidate:${command.targetCandidateId}`,
            controlling_job_state: "CONTROLLING",
            state: "ACTIVE",
            supersedes_handoff_marker_id: null,
            created_at: command.timestamp,
            record_version: 1,
          },
        },
      ],
      updates: [],
      supersedes: [],
      audits: [],
    };
  }
  if (selected !== "REJECT_CANDIDATE" && selected !== "REQUEST_CLARIFICATION") return empty;
  const context = await projectionContext(client, command);
  const openClarificationCount =
    selected === "REJECT_CANDIDATE" ? (await exactOpenClarifications(client, command)).length : 0;
  if (selected === "REJECT_CANDIDATE") {
    const id = command.payload.decisionId ?? "";
    const reviewCount =
      command.payload.reviewId === undefined
        ? 0
        : Number(
            (
              await client.query<{ count: string }>(
                "SELECT count(*) FROM m02_review_states WHERE id=$1",
                [command.payload.reviewId],
              )
            ).rows[0]?.count ?? "0",
          );
    const jobCount =
      command.payload.jobId === undefined
        ? 0
        : Number(
            (
              await client.query<{ count: string }>("SELECT count(*) FROM m02_jobs WHERE id=$1", [
                command.payload.jobId,
              ])
            ).rows[0]?.count ?? "0",
          );
    const activeDecisionCount = Number(
      (
        await client.query<{ count: string }>(
          "SELECT count(*) FROM identity_decisions WHERE resource_candidate_id=$1 AND state='ACTIVE'",
          [command.targetCandidateId],
        )
      ).rows[0]?.count ?? "0",
    );
    const rejectionAuditIndex =
      openClarificationCount + 1 + reviewCount + jobCount * 2 + activeDecisionCount;
    const creates: PlannedTypedRow[] = [
      {
        table: "m02_candidate_rejection_decisions",
        id,
        completeTypedValues: {
          id,
          resource_candidate_id: command.targetCandidateId,
          controlling_job_id: command.payload.jobId ?? null,
          classification_run_id: context.reconciled_classification_run_id,
          source_snapshot_id: context.source_snapshot_id,
          command_id: command.commandId,
          result_id: resultId,
          audit_event_id: allocatedId(command, "auditIdsJson", rejectionAuditIndex),
          evidence_ids: command.evidenceIds,
          actor_id: command.actorId,
          actor_role: command.actorRole,
          reason_code: command.reasonCode,
          reason_text: command.reason,
          state: "ACTIVE",
          supersedes_rejection_decision_id: null,
          superseded_by_rejection_decision_id: null,
          created_at: command.timestamp,
          record_version: 1,
        },
      },
    ];
    const updates: PlannedTypedRow[] = [];
    const supersedes: PlannedTypedRow[] = [];
    const candidate = await completeRow(client, "resource_candidates", command.targetCandidateId);
    if (candidate !== undefined)
      updates.push({
        table: "resource_candidates",
        id: command.targetCandidateId,
        expectedRecordVersion: Number(candidate.record_version),
        expectedState: String(candidate.status),
        completeTypedValues: {
          ...candidate,
          status: "REJECTED",
          resource_identity_id: null,
          resource_version_identity_id: null,
          identity_outcome: null,
          updated_at: command.timestamp,
          record_version: Number(candidate.record_version) + 1,
        },
      });
    if (command.payload.reviewId !== undefined) {
      const review = await completeRow(client, "m02_review_states", command.payload.reviewId);
      if (review !== undefined)
        updates.push({
          table: "m02_review_states",
          id: command.payload.reviewId,
          expectedRecordVersion: Number(review.record_version),
          expectedState: String(review.review_state),
          completeTypedValues: {
            ...review,
            review_state: "REJECTED",
            record_version: Number(review.record_version) + 1,
          },
        });
    }
    if (command.payload.jobId !== undefined) {
      const acquisition = await completeRow(client, "acquisition_jobs", command.payload.jobId);
      if (acquisition !== undefined)
        updates.push({
          table: "acquisition_jobs",
          id: command.payload.jobId,
          expectedRecordVersion: Number(acquisition.record_version),
          expectedState: String(acquisition.status),
          completeTypedValues: {
            ...acquisition,
            status: "COMPLETED",
            record_version: Number(acquisition.record_version) + 1,
          },
        });
      const job = await completeRow(client, "m02_jobs", command.payload.jobId);
      if (job !== undefined)
        updates.push({
          table: "m02_jobs",
          id: command.payload.jobId,
          expectedRecordVersion: Number(job.record_version),
          expectedState: String(job.review_state),
          completeTypedValues: {
            ...job,
            review_state: "REJECTED",
            record_version: Number(job.record_version) + 1,
          },
        });
    }
    const active = await client.query<{ id: string }>(
      "SELECT id FROM identity_decisions WHERE resource_candidate_id=$1 AND state='ACTIVE' ORDER BY convert_to(id,'UTF8')",
      [command.targetCandidateId],
    );
    for (const [decisionIndex, row] of active.rows.entries()) {
      const decision = await completeRow(client, "identity_decisions", row.id);
      if (decision !== undefined)
        supersedes.push({
          table: "identity_decisions",
          id: row.id,
          expectedRecordVersion: Number(decision.record_version),
          completeTypedValues: {
            ...decision,
            state: "SUPERSEDED",
            replacement_command_id: command.commandId,
            replacement_result_id: resultId,
            replacement_audit_event_id: allocatedId(
              command,
              "auditIdsJson",
              openClarificationCount + updates.length + decisionIndex,
            ),
            record_version: Number(decision.record_version) + 1,
          },
        });
    }
    const openClarifications = await exactOpenClarifications(client, command);
    const clarificationUpdates: PlannedTypedRow[] = [];
    for (const row of openClarifications) {
      const clarification = await completeRow(client, "m02_clarification_requests", row.id);
      if (clarification !== undefined)
        clarificationUpdates.push({
          table: "m02_clarification_requests",
          id: row.id,
          expectedRecordVersion: Number(clarification.record_version),
          completeTypedValues: {
            ...clarification,
            state: "RESOLVED",
            resolution_command_id: command.commandId,
            resolution_result_id: resultId,
            resolution_audit_event_id: allocatedId(
              command,
              "auditIdsJson",
              clarificationUpdates.length,
            ),
            superseded_by_command_id: null,
            resolved_at: command.timestamp,
            record_version: Number(clarification.record_version) + 1,
          },
        });
    }
    updates.unshift(...clarificationUpdates);
    const audits: PlannedAudit[] = [
      {
        id: auditBase,
        action: "COMMAND_ACCEPTED",
        subjectType: "MANUAL_RESOLUTION_COMMAND",
        subjectId: command.commandId,
        beforeVersion: null,
        afterVersion: null,
        beforeState: null,
        afterState: null,
        metadata: {},
      },
    ];
    let auditIndex = 0;
    for (const row of clarificationUpdates)
      audits.push({
        id: allocatedId(command, "auditIdsJson", auditIndex++),
        action: "SUBJECT_UPDATED",
        subjectType: "M02_CLARIFICATION_REQUEST",
        subjectId: row.id,
        beforeVersion: row.expectedRecordVersion ?? null,
        afterVersion: Number(row.completeTypedValues.record_version),
        beforeState: { state: "OPEN" },
        afterState: { state: "RESOLVED" },
        metadata:
          row.completeTypedValues.target_classification_run_id !== null
            ? {
                clarificationTargetType: "CLASSIFICATION",
                clarificationTargetId: row.completeTypedValues
                  .target_classification_run_id as never,
              }
            : row.completeTypedValues.target_identity_decision_id !== null
              ? {
                  clarificationTargetType: "IDENTITY",
                  clarificationTargetId: row.completeTypedValues
                    .target_identity_decision_id as never,
                }
              : {
                  clarificationTargetType: "REJECTION",
                  clarificationTargetId: row.completeTypedValues
                    .target_rejection_decision_id as never,
                },
      });
    for (const row of updates.filter(
      (entry) => entry.table !== "acquisition_jobs" && entry.table !== "m02_clarification_requests",
    ))
      audits.push({
        id: allocatedId(command, "auditIdsJson", auditIndex++),
        action: "SUBJECT_UPDATED",
        subjectType:
          row.table === "resource_candidates"
            ? "RESOURCE_CANDIDATE"
            : row.table === "m02_review_states"
              ? "M02_REVIEW_STATE"
              : "M02_JOB",
        subjectId: row.id,
        beforeVersion: row.expectedRecordVersion ?? null,
        afterVersion: Number(row.completeTypedValues.record_version),
        beforeState:
          row.table === "resource_candidates"
            ? {
                identityOutcome: null,
                recordVersion: row.expectedRecordVersion ?? null,
                resourceIdentityId: null,
                resourceVersionIdentityId: null,
                status: "CLASSIFIED",
              }
            : { state: row.expectedState ?? "IDENTITY_REVIEW_REQUIRED" },
        afterState:
          row.table === "resource_candidates"
            ? {
                identityOutcome: row.completeTypedValues.identity_outcome ?? null,
                recordVersion: Number(row.completeTypedValues.record_version),
                resourceIdentityId: row.completeTypedValues.resource_identity_id ?? null,
                resourceVersionIdentityId:
                  row.completeTypedValues.resource_version_identity_id ?? null,
                status: requiredString(row.completeTypedValues.status),
              }
            : { state: requiredString(row.completeTypedValues.review_state) },
        metadata:
          row.table === "m02_jobs"
            ? { scope: "IDENTITY_RESOLUTION", guardKey: `row:m02_jobs:${row.id}` }
            : {},
      });
    for (const row of supersedes.filter((entry) => entry.table === "identity_decisions"))
      audits.push({
        id: allocatedId(command, "auditIdsJson", auditIndex++),
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: row.id,
        beforeVersion: row.expectedRecordVersion ?? null,
        afterVersion: Number(row.completeTypedValues.record_version),
        beforeState: { recordVersion: row.expectedRecordVersion ?? null, state: "ACTIVE" },
        afterState: {
          recordVersion: Number(row.completeTypedValues.record_version),
          state: "SUPERSEDED",
        },
        metadata: { evaluatedTierSequence: HUMAN_TIER_SEQUENCE },
      });
    audits.push({
      id: allocatedId(command, "auditIdsJson", auditIndex),
      action: "SUBJECT_CREATED",
      subjectType: "M02_REJECTION_DECISION",
      subjectId: id,
      beforeVersion: null,
      afterVersion: null,
      beforeState: null,
      afterState: null,
      metadata: {},
    });
    return { creates, updates, supersedes, audits };
  }
  const id = command.payload.clarificationId ?? "";
  const targetType = command.reasonCode.includes("CLASSIFICATION")
    ? "CLASSIFICATION"
    : command.reasonCode.includes("REJECTION")
      ? "REJECTION"
      : "IDENTITY";
  const targetId =
    targetType === "CLASSIFICATION"
      ? context.reconciled_classification_run_id
      : (command.decisionIds[0] ?? null);
  const creates: PlannedTypedRow[] = [
    {
      table: "m02_clarification_requests",
      id,
      completeTypedValues: {
        id,
        command_id: command.commandId,
        result_id: resultId,
        audit_event_id: allocatedId(command, "auditIdsJson", 0),
        review_id: command.payload.reviewId ?? null,
        controlling_job_id: command.payload.jobId ?? null,
        source_snapshot_id: context.source_snapshot_id,
        target_classification_run_id: targetType === "CLASSIFICATION" ? targetId : null,
        target_identity_decision_id: targetType === "IDENTITY" ? targetId : null,
        target_rejection_decision_id: targetType === "REJECTION" ? targetId : null,
        resource_candidate_id: targetType === "CLASSIFICATION" ? null : command.targetCandidateId,
        candidate_group_id: command.targetGroupId,
        question_code: command.payload.questionCode ?? null,
        reason_code: command.reasonCode,
        question_payload: `\\x${Buffer.from(command.reason).toString("hex")}`,
        evidence_ids: command.evidenceIds,
        evidence_gaps: JSON.parse(command.payload.evidenceGapsJson ?? "[]") as never,
        requested_responder_class: command.payload.requestedResponderClass ?? null,
        actor_id: command.actorId,
        actor_role: command.actorRole,
        state: "OPEN",
        created_at: command.timestamp,
        record_version: 1,
        resolution_command_id: null,
        resolution_result_id: null,
        resolution_audit_event_id: null,
        superseded_by_command_id: null,
        resolved_at: null,
      },
    },
  ];
  const updates: PlannedTypedRow[] = [];
  if (command.payload.reviewId !== undefined) {
    const review = await completeRow(client, "m02_review_states", command.payload.reviewId);
    if (review !== undefined)
      updates.push({
        table: "m02_review_states",
        id: command.payload.reviewId,
        expectedRecordVersion: Number(review.record_version),
        expectedState: String(review.review_state),
        completeTypedValues: {
          ...review,
          review_state: "CLARIFICATION_REQUESTED",
          record_version: Number(review.record_version) + 1,
        },
      });
  }
  if (command.payload.jobId !== undefined) {
    const acquisition = await completeRow(client, "acquisition_jobs", command.payload.jobId);
    if (acquisition !== undefined)
      updates.push({
        table: "acquisition_jobs",
        id: command.payload.jobId,
        expectedRecordVersion: Number(acquisition.record_version),
        expectedState: String(acquisition.status),
        completeTypedValues: {
          ...acquisition,
          status: "OPERATOR_REVIEW_REQUIRED",
          record_version: Number(acquisition.record_version) + 1,
        },
      });
    const job = await completeRow(client, "m02_jobs", command.payload.jobId);
    if (job !== undefined)
      updates.push({
        table: "m02_jobs",
        id: command.payload.jobId,
        expectedRecordVersion: Number(job.record_version),
        expectedState: String(job.review_state),
        completeTypedValues: {
          ...job,
          review_state: "CLARIFICATION_REQUESTED",
          record_version: Number(job.record_version) + 1,
        },
      });
  }
  const audits: PlannedAudit[] = [
    {
      id: auditBase,
      action: "COMMAND_ACCEPTED",
      subjectType: "MANUAL_RESOLUTION_COMMAND",
      subjectId: command.commandId,
      beforeVersion: null,
      afterVersion: null,
      beforeState: null,
      afterState: null,
      metadata: {},
    },
    {
      id: allocatedId(command, "auditIdsJson", 0),
      action: "SUBJECT_CREATED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: id,
      beforeVersion: null,
      afterVersion: 1,
      beforeState: null,
      afterState: { recordVersion: 1, state: "OPEN" },
      metadata: { clarificationTargetType: targetType, clarificationTargetId: targetId ?? "" },
    },
  ];
  let updateAuditIndex = 1;
  for (const row of updates) {
    const beforeVersion = row.expectedRecordVersion ?? 0;
    const afterVersion = Number(row.completeTypedValues.record_version);
    const beforeState =
      row.table === "acquisition_jobs"
        ? { recordVersion: beforeVersion, status: row.expectedState ?? "OPERATOR_REVIEW_REQUIRED" }
        : row.table === "m02_jobs"
          ? {
              currentStage: row.completeTypedValues.current_stage as never,
              recordVersion: beforeVersion,
              reviewState: row.expectedState ?? "IDENTITY_REVIEW_REQUIRED",
            }
          : {
              recordVersion: beforeVersion,
              reviewState: row.expectedState ?? "IDENTITY_REVIEW_REQUIRED",
            };
    const afterState =
      row.table === "acquisition_jobs"
        ? { recordVersion: afterVersion, status: row.completeTypedValues.status as never }
        : row.table === "m02_jobs"
          ? {
              currentStage: row.completeTypedValues.current_stage as never,
              recordVersion: afterVersion,
              reviewState: row.completeTypedValues.review_state as never,
            }
          : {
              recordVersion: afterVersion,
              reviewState: row.completeTypedValues.review_state as never,
            };
    audits.push({
      id: allocatedId(command, "auditIdsJson", updateAuditIndex++),
      action: "SUBJECT_UPDATED",
      subjectType:
        row.table === "acquisition_jobs"
          ? "ACQUISITION_JOB"
          : row.table === "m02_jobs"
            ? "M02_JOB"
            : "M02_REVIEW_STATE",
      subjectId: row.id,
      beforeVersion,
      afterVersion,
      beforeState: beforeState,
      afterState: afterState,
      metadata:
        row.table === "m02_jobs"
          ? {
              scope: row.completeTypedValues.operation_scope as never,
              guardKey: row.completeTypedValues.job_scope_key as never,
            }
          : {},
    });
  }
  return { creates, updates, supersedes: [], audits };
}

async function augmentIdentityResolverIntents(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  expansionId: string,
  raw: TypedFamilyIntents,
): Promise<TypedFamilyIntents> {
  const selected = effectiveCommand(command);
  if (
    ![
      "CREATE_RESOURCE",
      "ATTACH_NEW_VERSION",
      "MARK_FORK",
      "MARK_MIRROR",
      "MARK_DUPLICATE",
    ].includes(selected)
  )
    return raw;
  const context = await projectionContext(client, command);
  const surface = identityResultSurface(command, expansionId);
  const creates = new Map(raw.creates.map((row) => [`${row.table}\u0000${row.id}`, row]));
  const updates = new Map(raw.updates.map((row) => [`${row.table}\u0000${row.id}`, row]));
  const supersedes = new Map(raw.supersedes.map((row) => [`${row.table}\u0000${row.id}`, row]));
  const put = (target: Map<string, PlannedTypedRow>, row: PlannedTypedRow): void => {
    target.set(`${row.table}\u0000${row.id}`, row);
  };
  let auditIndex = 0;
  const nextAudit = (): string => allocatedId(command, "auditIdsJson", auditIndex++);

  const openClarifications = await exactOpenClarifications(client, command);
  for (const { id } of openClarifications) {
    const row = await completeRow(client, "m02_clarification_requests", id);
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    put(updates, {
      table: "m02_clarification_requests",
      id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "RESOLVED",
        resolution_command_id: command.commandId,
        resolution_result_id: resultId,
        resolution_audit_event_id: nextAudit(),
        superseded_by_command_id: null,
        resolved_at: command.timestamp,
        record_version: Number(row.record_version) + 1,
      },
    });
  }

  const resourceId = surface.resourceId;
  const versionId = surface.versionId;
  if (surface.createdResources.length === 1 && resourceId !== null) {
    put(creates, {
      table: "resource_identities",
      id: resourceId,
      completeTypedValues: {
        id: resourceId,
        resource_type: "SKILL",
        status: "ACTIVE",
        reliable_identity_token: command.payload.reliableIdentityToken ?? null,
        reliable_token_evidence_id: command.payload.reliableTokenEvidenceId ?? null,
        created_at: command.timestamp,
        record_version: 1,
        guard_anchor_candidate_id: command.targetCandidateId,
        origin_type: "HUMAN_COMMAND",
        command_id: command.commandId,
        result_id: resultId,
        system_operation_id: null,
        system_result_id: null,
        audit_event_id: nextAudit(),
      },
    });
  }
  if (surface.createdVersions.length === 1 && versionId !== null && resourceId !== null) {
    put(creates, {
      table: "resource_version_identities",
      id: versionId,
      completeTypedValues: {
        id: versionId,
        resource_identity_id: resourceId,
        content_fingerprint:
          command.payload.contentFingerprint ?? context.candidate_content_fingerprint,
        canonical_payload: `\\x${context.canonical_content_payload.toString("hex")}`,
        first_observed_source_snapshot_id: context.source_snapshot_id,
        first_observed_candidate_root_id: context.candidate_root_id,
        first_observed_source_revision: context.immutable_revision,
        observation_label: `snapshot:${hash(context.source_snapshot_id).slice(0, 12)}`,
        status: "IDENTITY_RESOLVED",
        created_at: command.timestamp,
        record_version: 1,
        origin_type: "HUMAN_COMMAND",
        command_id: command.commandId,
        result_id: resultId,
        system_operation_id: null,
        system_result_id: null,
        audit_event_id: nextAudit(),
      },
    });
  }

  if (selected !== "MARK_DUPLICATE") {
    if (resourceId === null || versionId === null)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const sourceLinkId = command.payload.sourceLinkId ?? "";
    const oldLinkId = command.payload.activeSourceLinkId ?? command.payload.priorSourceLinkId;
    if (oldLinkId !== undefined && oldLinkId !== sourceLinkId) {
      const oldLink = await completeRow(client, "resource_source_links", oldLinkId);
      if (oldLink === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      put(supersedes, {
        table: "resource_source_links",
        id: oldLinkId,
        expectedRecordVersion: Number(oldLink.record_version),
        expectedState: String(oldLink.state),
        completeTypedValues: {
          ...oldLink,
          state: "SUPERSEDED",
          record_version: Number(oldLink.record_version) + 1,
        },
      });
      nextAudit();
    }
    const sourceLinkExists =
      (await client.query("SELECT 1 FROM resource_source_links WHERE id=$1", [sourceLinkId]))
        .rowCount === 1;
    const sourceRepositoryId =
      selected === "MARK_MIRROR"
        ? (command.payload.mirrorSourceRepositoryId ?? context.source_repository_id)
        : context.source_repository_id;
    if (!sourceLinkExists) {
      put(creates, {
        table: "resource_source_links",
        id: sourceLinkId,
        completeTypedValues: {
          id: sourceLinkId,
          source_repository_id: sourceRepositoryId,
          normalized_root_path: command.payload.normalizedRoot ?? context.normalized_root_path,
          target_resource_version_id: versionId,
          relationship: selected === "MARK_MIRROR" ? "ALTERNATE" : "PRIMARY",
          evidence_ids: command.evidenceIds,
          decision_id: command.payload.decisionId ?? "",
          reason: command.reason,
          actor_id: command.actorId,
          created_at: command.timestamp,
          state: "ACTIVE",
          supersedes_source_link_id: oldLinkId ?? null,
          record_version: 1,
          origin_type: "HUMAN_COMMAND",
          command_id: command.commandId,
          result_id: resultId,
          system_operation_id: null,
          system_result_id: null,
          audit_event_id: nextAudit(),
        },
      });
    }
    const observationId = command.payload.observationId ?? "";
    const observationExists =
      (
        await client.query("SELECT 1 FROM resource_version_observations WHERE id=$1", [
          observationId,
        ])
      ).rowCount === 1;
    if (!observationExists) {
      put(creates, {
        table: "resource_version_observations",
        id: observationId,
        completeTypedValues: {
          id: observationId,
          resource_version_identity_id: versionId,
          source_snapshot_id: context.source_snapshot_id,
          candidate_root_id: context.candidate_root_id,
          resource_source_link_id: sourceLinkId,
          source_repository_id: sourceRepositoryId,
          provider: context.provider,
          provider_repository_id: context.provider_repository_id,
          normalized_root_path: command.payload.normalizedRoot ?? context.normalized_root_path,
          immutable_revision: context.immutable_revision,
          observed_at: command.timestamp,
          origin_type: "HUMAN_COMMAND",
          command_id: command.commandId,
          result_id: resultId,
          system_operation_id: null,
          system_result_id: null,
          audit_event_id: nextAudit(),
        },
      });
    }
  }

  const relationshipTable =
    selected === "MARK_FORK"
      ? "fork_relationships"
      : selected === "MARK_MIRROR"
        ? "source_repository_relationships"
        : selected === "MARK_DUPLICATE"
          ? "duplicate_candidates"
          : undefined;
  if (relationshipTable !== undefined) {
    const relationshipId =
      selected === "MARK_DUPLICATE"
        ? (command.payload.duplicateId ?? "")
        : (command.payload.relationshipId ?? "");
    const priorId = command.payload.priorRelationshipId;
    if (priorId !== undefined) {
      const prior = await completeRow(client, relationshipTable, priorId);
      if (prior === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      const stateColumn = selected === "MARK_DUPLICATE" ? "status" : "state";
      put(supersedes, {
        table: relationshipTable,
        id: priorId,
        expectedRecordVersion: Number(prior.record_version),
        expectedState: String(prior[stateColumn]),
        completeTypedValues: {
          ...prior,
          [stateColumn]: "SUPERSEDED",
          record_version: Number(prior.record_version) + 1,
        } as never,
      });
      nextAudit();
    }
    const existing = creates.get(`${relationshipTable}\u0000${relationshipId}`);
    if (existing === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    if (selected !== "MARK_DUPLICATE")
      put(creates, {
        ...existing,
        completeTypedValues: {
          ...existing.completeTypedValues,
          audit_event_id: nextAudit(),
        },
      });
  }

  const decisionId = command.payload.decisionId ?? "";
  const activeDecisions = await client.query<{ id: string }>(
    `SELECT id FROM identity_decisions
     WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2
     ORDER BY convert_to(id,'UTF8')`,
    [command.targetCandidateId, decisionId],
  );
  let firstSupersededDecisionId: string | null = null;
  for (const { id } of activeDecisions.rows) {
    const row = await completeRow(client, "identity_decisions", id);
    if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    firstSupersededDecisionId ??= id;
    put(supersedes, {
      table: "identity_decisions",
      id,
      expectedRecordVersion: Number(row.record_version),
      expectedState: String(row.state),
      completeTypedValues: {
        ...row,
        state: "SUPERSEDED",
        replacement_command_id: command.commandId,
        replacement_result_id: resultId,
        replacement_system_operation_id: null,
        replacement_system_result_id: null,
        replacement_audit_event_id: nextAudit(),
        superseded_by_decision_id: decisionId,
        record_version: Number(row.record_version) + 1,
      },
    });
  }
  put(creates, {
    table: "identity_decisions",
    id: decisionId,
    completeTypedValues: {
      id: decisionId,
      resource_candidate_id: command.targetCandidateId,
      outcome: surface.outcome,
      matched_tier: null,
      confidence: null,
      identity_policy_version: context.identity_policy_version,
      decision_source: "HUMAN_COMMAND",
      signals: command.evidenceIds,
      rejected_lower_tier_signals: [],
      conflicts: [],
      audit_fingerprint: hash(canonicalM02JsonBytes({ commandId: command.commandId, decisionId })),
      state: "ACTIVE",
      supersedes_decision_id: command.payload.priorDecisionId ?? firstSupersededDecisionId,
      created_at: command.timestamp,
      record_version: 1,
      origin_type: "HUMAN_COMMAND",
      command_id: command.commandId,
      result_id: resultId,
      system_operation_id: null,
      system_result_id: null,
      audit_event_id: nextAudit(),
      replacement_command_id: null,
      replacement_result_id: null,
      replacement_system_operation_id: null,
      replacement_system_result_id: null,
      replacement_audit_event_id: null,
      superseded_by_decision_id: null,
    },
  });
  if (selected === "MARK_DUPLICATE") {
    const duplicateId = command.payload.duplicateId ?? "";
    const duplicate = creates.get(`duplicate_candidates\u0000${duplicateId}`);
    if (duplicate === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    put(creates, {
      ...duplicate,
      completeTypedValues: {
        ...duplicate.completeTypedValues,
        audit_event_id: nextAudit(),
      },
    });
  }

  const rejected = selected === "MARK_DUPLICATE";
  const candidate = await completeRow(client, "resource_candidates", command.targetCandidateId);
  if (candidate === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  put(updates, {
    table: "resource_candidates",
    id: command.targetCandidateId,
    expectedRecordVersion: Number(candidate.record_version),
    expectedState: String(candidate.status),
    completeTypedValues: {
      ...candidate,
      status: rejected ? "REJECTED" : "IDENTITY_RESOLVED",
      resource_identity_id: rejected ? null : resourceId,
      resource_version_identity_id: rejected ? null : versionId,
      identity_outcome: surface.outcome,
      updated_at: command.timestamp,
      record_version: Number(candidate.record_version) + 1,
    },
  });
  nextAudit();
  if (command.payload.reviewId !== undefined) {
    const review = await completeRow(client, "m02_review_states", command.payload.reviewId);
    if (review === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    put(updates, {
      table: "m02_review_states",
      id: command.payload.reviewId,
      expectedRecordVersion: Number(review.record_version),
      expectedState: String(review.review_state),
      completeTypedValues: {
        ...review,
        review_state: rejected ? "REJECTED" : "RESOLVED",
        record_version: Number(review.record_version) + 1,
      },
    });
    nextAudit();
  }
  if (command.payload.jobId !== undefined) {
    const acquisition = await completeRow(client, "acquisition_jobs", command.payload.jobId);
    const job = await completeRow(client, "m02_jobs", command.payload.jobId);
    if (acquisition === undefined || job === undefined)
      throw new ManualResolutionError("REFERENCE_INVALID");
    put(updates, {
      table: "acquisition_jobs",
      id: command.payload.jobId,
      expectedRecordVersion: Number(acquisition.record_version),
      expectedState: String(acquisition.status),
      completeTypedValues: {
        ...acquisition,
        status: "COMPLETED",
        record_version: Number(acquisition.record_version) + 1,
      },
    });
    nextAudit();
    put(updates, {
      table: "m02_jobs",
      id: command.payload.jobId,
      expectedRecordVersion: Number(job.record_version),
      expectedState: String(job.review_state),
      completeTypedValues: {
        ...job,
        review_state: rejected ? "REJECTED" : "RESOLVED",
        record_version: Number(job.record_version) + 1,
      },
    });
    nextAudit();
  }

  if (!rejected) {
    const priorHandoff = (
      await client.query<{ id: string }>(
        `SELECT id FROM m02_identity_handoff_markers
       WHERE resource_candidate_id=$1 AND state='ACTIVE'`,
        [command.targetCandidateId],
      )
    ).rows[0];
    const preserveHandoff =
      selected === "MARK_FORK" && command.payload.priorRelationshipId !== undefined;
    if (priorHandoff !== undefined && !preserveHandoff) {
      const row = (
        await client.query<{ value: Record<string, unknown> }>(
          "SELECT to_jsonb(row) AS value FROM m02_identity_handoff_markers row WHERE id=$1",
          [priorHandoff.id],
        )
      ).rows[0]?.value;
      if (row === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      put(supersedes, {
        table: "m02_identity_handoff_markers",
        id: priorHandoff.id,
        expectedRecordVersion: Number(row.record_version),
        expectedState: String(row.state),
        completeTypedValues: {
          ...row,
          state: "SUPERSEDED",
          controlling_job_state: null,
          record_version: Number(row.record_version) + 1,
        },
      });
      nextAudit();
    }
    if (priorHandoff === undefined || !preserveHandoff) {
      const handoffId = command.payload.handoffId ?? "";
      put(creates, {
        table: "m02_identity_handoff_markers",
        id: handoffId,
        completeTypedValues: {
          id: handoffId,
          resource_candidate_id: command.targetCandidateId,
          resource_identity_id: resourceId,
          resource_version_identity_id: versionId,
          controlling_m02_job_id: command.payload.jobId ?? "",
          source_snapshot_id: context.source_snapshot_id,
          identity_decision_id: decisionId,
          origin_type: "HUMAN_COMMAND",
          command_id: command.commandId,
          result_id: resultId,
          system_operation_id: null,
          system_result_id: null,
          audit_event_id: nextAudit(),
          logical_key: `candidate:${command.targetCandidateId}`,
          controlling_job_state: "CONTROLLING",
          state: "ACTIVE",
          supersedes_handoff_marker_id: priorHandoff?.id ?? null,
          created_at: command.timestamp,
          record_version: 1,
        },
      });
    }
  }
  return {
    creates: [...creates.values()],
    updates: [...updates.values()],
    supersedes: [...supersedes.values()],
    audits: [],
  };
}

interface PlannedAuditIdentity {
  readonly action: PlannedAudit["action"];
  readonly subjectType: string;
  readonly subjectId: string;
  readonly auditId?: string;
  readonly metadata?: Readonly<Record<string, CanonicalM02Value>>;
}

function auditSubjectType(table: string): string {
  const types: Readonly<Record<string, string>> = {
    acquisition_jobs: "ACQUISITION_JOB",
    candidate_root_ownership: "CANDIDATE_ROOT_OWNERSHIP",
    candidate_roots: "CANDIDATE_ROOT",
    duplicate_candidates: "DUPLICATE_CANDIDATE",
    fork_relationships: "FORK_RELATIONSHIP",
    identity_decisions: "IDENTITY_DECISION",
    m02_candidate_replacements: "CANDIDATE_REPLACEMENT",
    m02_clarification_requests: "M02_CLARIFICATION_REQUEST",
    m02_candidate_rejection_decisions: "M02_REJECTION_DECISION",
    m02_group_edge_replacements: "GROUP_EDGE_REPLACEMENT",
    m02_identity_handoff_markers: "M02_IDENTITY_HANDOFF",
    m02_jobs: "M02_JOB",
    m02_ownership_replacements: "OWNERSHIP_REPLACEMENT",
    m02_review_states: "M02_REVIEW_STATE",
    m02_root_replacements: "ROOT_REPLACEMENT",
    repository_candidate_groups: "REPOSITORY_CANDIDATE_GROUP",
    repository_candidate_root_order: "REPOSITORY_CANDIDATE_ROOT_ORDER",
    repository_classification_runs: "REPOSITORY_CLASSIFICATION_RUN",
    repository_group_relationships: "REPOSITORY_GROUP_RELATIONSHIP",
    resource_candidates: "RESOURCE_CANDIDATE",
    resource_identities: "RESOURCE_IDENTITY",
    resource_source_links: "RESOURCE_SOURCE_LINK",
    resource_version_identities: "RESOURCE_VERSION_IDENTITY",
    resource_version_observations: "RESOURCE_VERSION_OBSERVATION",
    source_repository_relationships: "SOURCE_REPOSITORY_RELATIONSHIP",
  };
  const type = types[table];
  if (type === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  return type;
}

const AUDIT_TABLE_BY_SUBJECT: Readonly<Record<string, string>> = {
  ACQUISITION_JOB: "acquisition_jobs",
  CANDIDATE_REPLACEMENT: "m02_candidate_replacements",
  CANDIDATE_ROOT: "candidate_roots",
  CANDIDATE_ROOT_OWNERSHIP: "candidate_root_ownership",
  DUPLICATE_CANDIDATE: "duplicate_candidates",
  FORK_RELATIONSHIP: "fork_relationships",
  GROUP_EDGE_REPLACEMENT: "m02_group_edge_replacements",
  IDENTITY_DECISION: "identity_decisions",
  M02_CLARIFICATION_REQUEST: "m02_clarification_requests",
  M02_REJECTION_DECISION: "m02_candidate_rejection_decisions",
  M02_IDENTITY_HANDOFF: "m02_identity_handoff_markers",
  M02_JOB: "m02_jobs",
  M02_REVIEW_STATE: "m02_review_states",
  OWNERSHIP_REPLACEMENT: "m02_ownership_replacements",
  REPOSITORY_CANDIDATE_GROUP: "repository_candidate_groups",
  REPOSITORY_CANDIDATE_ROOT_ORDER: "repository_candidate_root_order",
  REPOSITORY_CLASSIFICATION_RUN: "repository_classification_runs",
  REPOSITORY_GROUP_RELATIONSHIP: "repository_group_relationships",
  RESOURCE_CANDIDATE: "resource_candidates",
  RESOURCE_IDENTITY: "resource_identities",
  RESOURCE_SOURCE_LINK: "resource_source_links",
  RESOURCE_VERSION_IDENTITY: "resource_version_identities",
  RESOURCE_VERSION_OBSERVATION: "resource_version_observations",
  ROOT_REPLACEMENT: "m02_root_replacements",
  SOURCE_REPOSITORY_RELATIONSHIP: "source_repository_relationships",
};

function auditStateFromTypedRow(
  table: string,
  row: Readonly<Record<string, unknown>>,
): CanonicalM02Value | null {
  const recordVersion = row.record_version;
  if (table === "resource_candidates")
    return {
      identityOutcome: (row.identity_outcome ?? null) as never,
      recordVersion: Number(recordVersion),
      resourceIdentityId: (row.resource_identity_id ?? null) as never,
      resourceVersionIdentityId: (row.resource_version_identity_id ?? null) as never,
      status: String(row.status),
      ...(row.superseded_by_candidate_id === null || row.superseded_by_candidate_id === undefined
        ? {}
        : { supersededById: requiredString(row.superseded_by_candidate_id) }),
      ...(row.terminal_reason_code === null || row.terminal_reason_code === undefined
        ? {}
        : { terminalReasonCode: requiredString(row.terminal_reason_code) }),
    };
  if (recordVersion === null || recordVersion === undefined) return null;
  if (table === "m02_jobs")
    return {
      currentStage: String(row.current_stage),
      recordVersion: Number(recordVersion),
      reviewState: String(row.review_state),
      ...(row.superseded_by_job_id === null || row.superseded_by_job_id === undefined
        ? {}
        : { supersededByJobId: requiredString(row.superseded_by_job_id) }),
    };
  if (table === "m02_review_states")
    return {
      recordVersion: Number(recordVersion),
      reviewState: String(row.review_state),
      ...(row.terminal_reason_code === null || row.terminal_reason_code === undefined
        ? {}
        : { terminalReasonCode: requiredString(row.terminal_reason_code) }),
    };
  if (table === "identity_decisions")
    return {
      recordVersion: Number(recordVersion),
      state: String(row.state),
      ...(row.superseded_by_decision_id === null || row.superseded_by_decision_id === undefined
        ? {}
        : { supersededByDecisionId: requiredString(row.superseded_by_decision_id) }),
    };
  if (table === "m02_identity_handoff_markers")
    return { recordVersion: Number(recordVersion), state: String(row.state) };
  if (table === "acquisition_jobs")
    return { recordVersion: Number(recordVersion), status: String(row.status) };
  if (table === "m02_clarification_requests")
    return { recordVersion: Number(recordVersion), state: String(row.state) };
  if (row.state !== undefined)
    return {
      recordVersion: Number(recordVersion),
      state: requiredString(row.state),
      ...(row.superseded_by_group_id === null || row.superseded_by_group_id === undefined
        ? {}
        : { supersededById: requiredString(row.superseded_by_group_id) }),
      ...(row.superseded_by_root_id === null || row.superseded_by_root_id === undefined
        ? {}
        : { supersededById: requiredString(row.superseded_by_root_id) }),
    };
  if (row.status !== undefined)
    return { recordVersion: Number(recordVersion), status: requiredString(row.status) };
  return null;
}

function auditMetadataFromTypedRow(
  subjectType: string,
  row: Readonly<Record<string, unknown>>,
  command: ManualResolutionEnvelope,
): Readonly<Record<string, CanonicalM02Value>> {
  if (subjectType === "IDENTITY_DECISION") return { evaluatedTierSequence: HUMAN_TIER_SEQUENCE };
  if (subjectType === "FORK_RELATIONSHIP")
    return {
      relationshipType: "FORK_OF",
      sourceEndpointId: String(row.fork_resource_version_id),
      targetEndpointId: String(row.origin_resource_version_id),
    };
  if (subjectType === "SOURCE_REPOSITORY_RELATIONSHIP")
    return {
      relationshipType: "MIRROR_OF",
      sourceEndpointId: String(row.mirror_source_repository_id),
      targetEndpointId: String(row.origin_source_repository_id),
    };
  if (subjectType === "M02_CLARIFICATION_REQUEST") {
    const type =
      row.target_classification_run_id !== null
        ? "CLASSIFICATION"
        : row.target_identity_decision_id !== null
          ? "IDENTITY"
          : "REJECTION";
    const id =
      row.target_classification_run_id ??
      row.target_identity_decision_id ??
      row.target_rejection_decision_id ??
      "";
    return { clarificationTargetType: type, clarificationTargetId: requiredString(id) };
  }
  if (subjectType === "M02_JOB")
    return {
      scope:
        row.operation_scope === null || row.operation_scope === undefined
          ? (command.payload.requestedOperationScope ?? "IDENTITY_RESOLUTION")
          : requiredString(row.operation_scope),
      guardKey:
        row.job_scope_key === null || row.job_scope_key === undefined
          ? `row:m02_jobs:${requiredString(row.id)}`
          : requiredString(row.job_scope_key),
    };
  const replacement: readonly [string, unknown, string, unknown] | undefined =
    subjectType === "ROOT_REPLACEMENT"
      ? ["predecessorRootId", row.predecessor_root_id, "successorRootId", row.successor_root_id]
      : subjectType === "CANDIDATE_REPLACEMENT"
        ? [
            "predecessorCandidateId",
            row.predecessor_candidate_id,
            "successorCandidateId",
            row.successor_candidate_id,
          ]
        : subjectType === "OWNERSHIP_REPLACEMENT"
          ? [
              "predecessorOwnershipId",
              row.predecessor_ownership_id,
              "successorOwnershipId",
              row.successor_ownership_id,
            ]
          : subjectType === "GROUP_EDGE_REPLACEMENT"
            ? [
                "predecessorEdgeId",
                row.predecessor_group_edge_id,
                "successorEdgeId",
                row.successor_group_edge_id,
              ]
            : undefined;
  if (replacement !== undefined) {
    const metadata: Record<string, CanonicalM02Value> = {
      replacementKind: String(row.replacement_kind),
    };
    if (replacement[1] !== null && replacement[1] !== undefined)
      metadata[replacement[0]] = requiredString(replacement[1]);
    if (replacement[3] !== null && replacement[3] !== undefined)
      metadata[replacement[2]] = requiredString(replacement[3]);
    return metadata;
  }
  return {};
}

async function deriveCanonicalAuditIdentities(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  intents: TypedFamilyIntents,
  expansionId: string,
): Promise<readonly PlannedAuditIdentity[]> {
  const selected = effectiveCommand(command);
  const identities: PlannedAuditIdentity[] = [];
  const openClarifications = ["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected)
    ? []
    : await exactOpenClarifications(client, command);
  for (const clarification of openClarifications) {
    const metadata =
      clarification.target_classification_run_id !== null
        ? {
            clarificationTargetType: "CLASSIFICATION",
            clarificationTargetId: clarification.target_classification_run_id,
          }
        : clarification.target_identity_decision_id !== null
          ? {
              clarificationTargetType: "IDENTITY",
              clarificationTargetId: clarification.target_identity_decision_id,
            }
          : {
              clarificationTargetType: "REJECTION",
              clarificationTargetId: clarification.target_rejection_decision_id ?? "",
            };
    identities.push({
      action: ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)
        ? "SUBJECT_SUPERSEDED"
        : "SUBJECT_UPDATED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: clarification.id,
      metadata,
    });
  }

  if (["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(selected)) {
    const surface = identityResultSurface(command, expansionId);
    for (const id of surface.createdResources)
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_IDENTITY",
        subjectId: id,
      });
    for (const id of surface.createdVersions)
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_VERSION_IDENTITY",
        subjectId: id,
      });
    const sourceLinkId = command.payload.sourceLinkId ?? "";
    const oldLinkId = command.payload.activeSourceLinkId ?? command.payload.priorSourceLinkId;
    if (oldLinkId !== undefined && oldLinkId !== sourceLinkId)
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "RESOURCE_SOURCE_LINK",
        subjectId: oldLinkId,
      });
    if (
      (await client.query("SELECT 1 FROM resource_source_links WHERE id=$1", [sourceLinkId]))
        .rowCount === 0
    )
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_SOURCE_LINK",
        subjectId: sourceLinkId,
      });
    const observationId = command.payload.observationId ?? "";
    if (
      (
        await client.query("SELECT 1 FROM resource_version_observations WHERE id=$1", [
          observationId,
        ])
      ).rowCount === 0
    )
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_VERSION_OBSERVATION",
        subjectId: observationId,
      });
    if (selected === "MARK_FORK" || selected === "MARK_MIRROR") {
      const prior = command.payload.priorRelationshipId;
      if (prior !== undefined)
        identities.push({
          action: "SUBJECT_SUPERSEDED",
          subjectType:
            selected === "MARK_FORK" ? "FORK_RELATIONSHIP" : "SOURCE_REPOSITORY_RELATIONSHIP",
          subjectId: prior,
        });
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType:
          selected === "MARK_FORK" ? "FORK_RELATIONSHIP" : "SOURCE_REPOSITORY_RELATIONSHIP",
        subjectId: command.payload.relationshipId ?? "",
      });
    }
    const activeDecisions = await client.query<{ id: string }>(
      `SELECT id FROM identity_decisions
       WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2
       ORDER BY convert_to(id,'UTF8')`,
      [command.targetCandidateId, command.payload.decisionId ?? ""],
    );
    for (const { id } of activeDecisions.rows)
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: id,
      });
    identities.push({
      action: "SUBJECT_CREATED",
      subjectType: "IDENTITY_DECISION",
      subjectId: command.payload.decisionId ?? "",
    });
    identities.push({
      action: "SUBJECT_UPDATED",
      subjectType: "RESOURCE_CANDIDATE",
      subjectId: command.targetCandidateId,
    });
    if (command.payload.reviewId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "M02_REVIEW_STATE",
        subjectId: command.payload.reviewId,
      });
    if (command.payload.jobId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "ACQUISITION_JOB",
        subjectId: command.payload.jobId,
      });
    if (command.payload.jobId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "M02_JOB",
        subjectId: command.payload.jobId,
      });
    const priorHandoff = (
      await client.query<{ id: string }>(
        `SELECT id FROM m02_identity_handoff_markers
       WHERE resource_candidate_id=$1 AND state='ACTIVE'`,
        [command.targetCandidateId],
      )
    ).rows[0];
    const preserveHandoff =
      selected === "MARK_FORK" && command.payload.priorRelationshipId !== undefined;
    if (priorHandoff !== undefined && !preserveHandoff)
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "M02_IDENTITY_HANDOFF",
        subjectId: priorHandoff.id,
      });
    if (priorHandoff === undefined || !preserveHandoff)
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "M02_IDENTITY_HANDOFF",
        subjectId: command.payload.handoffId ?? "",
      });
    return identities;
  }

  if (selected === "MARK_DUPLICATE") {
    if (command.payload.priorRelationshipId !== undefined)
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "DUPLICATE_CANDIDATE",
        subjectId: command.payload.priorRelationshipId,
      });
    const active = await client.query<{ id: string }>(
      `SELECT id FROM identity_decisions
       WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2
       ORDER BY convert_to(id,'UTF8')`,
      [command.targetCandidateId, command.payload.decisionId ?? ""],
    );
    for (const { id } of active.rows)
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: id,
      });
    identities.push(
      {
        action: "SUBJECT_CREATED",
        subjectType: "IDENTITY_DECISION",
        subjectId: command.payload.decisionId ?? "",
      },
      {
        action: "SUBJECT_CREATED",
        subjectType: "DUPLICATE_CANDIDATE",
        subjectId: command.payload.duplicateId ?? "",
      },
      {
        action: "SUBJECT_UPDATED",
        subjectType: "RESOURCE_CANDIDATE",
        subjectId: command.targetCandidateId,
      },
    );
    if (command.payload.reviewId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "M02_REVIEW_STATE",
        subjectId: command.payload.reviewId,
      });
    if (command.payload.jobId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "ACQUISITION_JOB",
        subjectId: command.payload.jobId,
      });
    if (command.payload.jobId !== undefined)
      identities.push({
        action: "SUBJECT_UPDATED",
        subjectType: "M02_JOB",
        subjectId: command.payload.jobId,
      });
    return identities;
  }

  if (selected === "REJECT_CANDIDATE") {
    for (const table of [
      "resource_candidates",
      "m02_review_states",
      "acquisition_jobs",
      "m02_jobs",
    ])
      for (const row of intents.updates.filter((candidate) => candidate.table === table))
        identities.push({
          action: "SUBJECT_UPDATED",
          subjectType: auditSubjectType(table),
          subjectId: row.id,
        });
    for (const row of intents.supersedes.filter(
      (candidate) => candidate.table === "identity_decisions",
    ))
      identities.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: row.id,
      });
    for (const row of intents.creates.filter(
      (candidate) => candidate.table === "m02_candidate_rejection_decisions",
    ))
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "M02_REJECTION_DECISION",
        subjectId: row.id,
      });
    return identities;
  }

  if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)) {
    const create = (table: string): PlannedAuditIdentity[] =>
      intents.creates
        .filter((row) => row.table === table)
        .map((row) => ({
          action: "SUBJECT_CREATED",
          subjectType: auditSubjectType(table),
          subjectId: row.id,
        }));
    const supersede = (table: string): PlannedAuditIdentity[] =>
      intents.supersedes
        .filter((row) => row.table === table)
        .map((row) => ({
          action: "SUBJECT_SUPERSEDED",
          subjectType: auditSubjectType(table),
          subjectId: row.id,
        }));
    identities.push(
      ...supersede("repository_candidate_groups"),
      ...create("repository_candidate_groups"),
      ...create("repository_classification_runs"),
    );
    for (const root of intents.creates.filter((row) => row.table === "candidate_roots")) {
      identities.push({
        action: "SUBJECT_CREATED",
        subjectType: "CANDIDATE_ROOT",
        subjectId: root.id,
      });
      const order = intents.creates.find(
        (row) =>
          row.table === "repository_candidate_root_order" &&
          row.completeTypedValues.candidate_root_id === root.id,
      );
      if (order !== undefined)
        identities.push({
          action: "SUBJECT_CREATED",
          subjectType: "REPOSITORY_CANDIDATE_ROOT_ORDER",
          subjectId: order.id,
        });
      const candidate = intents.creates.find(
        (row) =>
          row.table === "resource_candidates" &&
          row.completeTypedValues.candidate_root_id === root.id,
      );
      if (candidate !== undefined) {
        identities.push({
          action: "SUBJECT_CREATED",
          subjectType: "RESOURCE_CANDIDATE",
          subjectId: candidate.id,
        });
        const edge = intents.creates.find(
          (row) =>
            row.table === "repository_group_relationships" &&
            row.completeTypedValues.child_candidate_id === candidate.id,
        );
        if (edge !== undefined)
          identities.push({
            action: "SUBJECT_CREATED",
            subjectType: "REPOSITORY_GROUP_RELATIONSHIP",
            subjectId: edge.id,
          });
        const review = intents.creates.find(
          (row) =>
            row.table === "m02_review_states" &&
            row.completeTypedValues.resource_candidate_id === candidate.id,
        );
        if (review !== undefined)
          identities.push({
            action: "SUBJECT_CREATED",
            subjectType: "M02_REVIEW_STATE",
            subjectId: review.id,
          });
      }
    }
    identities.push(
      ...supersede("resource_candidates"),
      ...supersede("candidate_roots"),
      ...supersede("identity_decisions"),
      ...supersede("m02_review_states"),
      ...create("candidate_root_ownership"),
      ...create("m02_root_replacements"),
      ...create("m02_candidate_replacements"),
      ...create("m02_ownership_replacements"),
      ...create("m02_group_edge_replacements"),
    );
    for (const table of ["acquisition_jobs", "m02_jobs"])
      for (const row of intents.updates.filter((candidate) => candidate.table === table))
        identities.push({
          action: "SUBJECT_UPDATED",
          subjectType: auditSubjectType(table),
          subjectId: row.id,
        });
    return identities;
  }
  return identities;
}

async function augmentTerminalClarificationIntents(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  intents: TypedFamilyIntents,
): Promise<TypedFamilyIntents> {
  const selected = effectiveCommand(command);
  if (["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected)) return intents;
  const topology = ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected);
  const state = topology ? "SUPERSEDED" : "RESOLVED";
  const rows = await exactOpenClarifications(client, command);
  const updates = [...intents.updates];
  const supersedes = [...intents.supersedes];
  for (const [index, target] of rows.entries()) {
    if (
      [...updates, ...supersedes].some(
        (row) => row.table === "m02_clarification_requests" && row.id === target.id,
      )
    )
      continue;
    const current = await completeRow(client, "m02_clarification_requests", target.id);
    if (current === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    const planned: PlannedTypedRow = {
      table: "m02_clarification_requests",
      id: target.id,
      expectedRecordVersion: Number(current.record_version),
      expectedState: String(current.state),
      completeTypedValues: {
        ...current,
        state,
        resolution_command_id: command.commandId,
        resolution_result_id: resultId,
        resolution_audit_event_id: allocatedId(command, "auditIdsJson", index),
        superseded_by_command_id: topology ? command.commandId : null,
        resolved_at: command.timestamp,
        record_version: Number(current.record_version) + 1,
      },
    };
    (topology ? supersedes : updates).push(planned);
  }
  return { ...intents, updates, supersedes };
}

async function exactPlannedAudits(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  auditBase: string,
  intents: TypedFamilyIntents,
  expansionId: string,
): Promise<readonly PlannedAudit[]> {
  const identities = await deriveCanonicalAuditIdentities(client, command, intents, expansionId);
  const allRows = [...intents.creates, ...intents.updates, ...intents.supersedes];
  const rowFor = (subjectType: string, subjectId: string): PlannedTypedRow => {
    const table = AUDIT_TABLE_BY_SUBJECT[subjectType];
    const row = allRows.find(
      (candidate) => candidate.table === table && candidate.id === subjectId,
    );
    if (table === undefined || row === undefined)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row;
  };
  const successorId = (row: PlannedTypedRow): string | undefined => {
    const values = row.completeTypedValues;
    for (const key of [
      "superseded_by_candidate_id",
      "superseded_by_group_id",
      "superseded_by_root_id",
      "superseded_by_review_id",
      "superseded_by_decision_id",
      "superseded_by_job_id",
    ]) {
      const value = values[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return intents.creates.find((candidate) =>
      [
        candidate.completeTypedValues.supersedes_source_link_id,
        candidate.completeTypedValues.supersedes_handoff_marker_id,
        candidate.completeTypedValues.supersedes_duplicate_id,
        candidate.completeTypedValues.supersedes_relationship_id,
      ].includes(row.id),
    )?.id;
  };
  const audits: PlannedAudit[] = [
    {
      id: auditBase,
      action: "COMMAND_ACCEPTED",
      subjectType: "MANUAL_RESOLUTION_COMMAND",
      subjectId: command.commandId,
      beforeVersion: null,
      afterVersion: null,
      beforeState: null,
      afterState: null,
      metadata: {},
    },
  ];
  for (const [index, identity] of identities.entries()) {
    const planned = rowFor(identity.subjectType, identity.subjectId);
    const values = planned.completeTypedValues;
    const table = planned.table;
    const created = identity.action === "SUBJECT_CREATED";
    const current = created
      ? undefined
      : (
          await client.query<{ value: Readonly<Record<string, unknown>> }>(
            `SELECT to_jsonb(row_value) AS value FROM ${table} row_value WHERE id=$1`,
            [planned.id],
          )
        ).rows[0]?.value;
    if (!created && current === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    const beforeState = current === undefined ? null : auditStateFromTypedRow(table, current);
    let afterState = auditStateFromTypedRow(table, values);
    const beforeVersion = beforeState === null ? null : Number(current?.record_version);
    const afterVersion = afterState === null ? null : Number(values.record_version);
    let metadata = auditMetadataFromTypedRow(identity.subjectType, values, command);
    if (identity.action === "SUBJECT_SUPERSEDED" && Object.keys(metadata).length === 0) {
      const successor = successorId(planned);
      if (successor !== undefined) {
        metadata = { successorId: successor };
        if (
          afterState !== null &&
          identity.subjectType === "RESOURCE_SOURCE_LINK" &&
          isCanonicalObject(afterState)
        )
          afterState = { ...afterState, supersededById: successor };
      }
    }
    const rowAuditId =
      identity.action === "SUBJECT_CREATED"
        ? (values.creation_audit_event_id ?? values.audit_event_id)
        : (values.resolution_audit_event_id ?? values.replacement_audit_event_id);
    const id = identity.auditId ?? allocatedId(command, "auditIdsJson", index);
    if (typeof rowAuditId === "string" && rowAuditId !== id)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    audits.push({
      id,
      action: identity.action,
      subjectType: identity.subjectType,
      subjectId: identity.subjectId,
      beforeVersion,
      afterVersion,
      beforeState,
      afterState,
      metadata,
    });
  }
  void resultId;
  return audits;
}

export async function buildReviewFamilyIntents(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  auditBase: string,
  expansionId: string,
): Promise<TypedFamilyIntents> {
  const extracted = await buildReviewFamilyIntentsRaw(
    client,
    command,
    resultId,
    auditBase,
    expansionId,
  );
  const identityIntents = await augmentIdentityResolverIntents(
    client,
    command,
    resultId,
    expansionId,
    extracted,
  );
  const raw = await augmentTerminalClarificationIntents(client, command, resultId, identityIntents);
  if (raw.audits.length > 0 && effectiveCommand(command) !== "REJECT_CANDIDATE") return raw;
  const audits = await exactPlannedAudits(client, command, resultId, auditBase, raw, expansionId);
  return { ...raw, audits };
}

function identityResultSurface(command: ManualResolutionEnvelope, expansionId: string) {
  const selected = effectiveCommand(command);
  if (
    ![
      "CREATE_RESOURCE",
      "ATTACH_NEW_VERSION",
      "MARK_FORK",
      "MARK_MIRROR",
      "MARK_DUPLICATE",
    ].includes(selected)
  )
    return {
      projectionMode: null,
      outcome: null,
      resourceId: null,
      versionId: null,
      createdResources: [] as string[],
      reusedResources: [] as string[],
      createdVersions: [] as string[],
      reusedVersions: [] as string[],
    };
  if (selected === "MARK_DUPLICATE")
    return {
      projectionMode: "MARK_DUPLICATE",
      outcome: "POSSIBLE_DUPLICATE",
      resourceId: null,
      versionId: null,
      createdResources: [] as string[],
      reusedResources: [] as string[],
      createdVersions: [] as string[],
      reusedVersions: [] as string[],
    };
  const resourceId =
    command.payload.resourceIdentityId ?? command.payload.targetResourceIdentityId ?? null;
  const versionId =
    command.payload.resourceVersionIdentityId ??
    command.payload.forkResourceVersionId ??
    command.payload.targetResourceVersionId ??
    null;
  const resolvedId = (value: string | null): string => {
    if (value === null) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return value;
  };
  if (selected === "CREATE_RESOURCE")
    return {
      projectionMode: "CREATE_RESOURCE",
      outcome: "NEW_RESOURCE",
      resourceId,
      versionId,
      createdResources: [resolvedId(resourceId)],
      reusedResources: [] as string[],
      createdVersions: [resolvedId(versionId)],
      reusedVersions: [] as string[],
    };
  if (selected === "ATTACH_NEW_VERSION") {
    const shape = expansionId.includes("ATTACH_NEW_VERSION:A1")
      ? "A1"
      : expansionId.includes("ATTACH_NEW_VERSION:A2")
        ? "A2"
        : "A3";
    return {
      projectionMode: `ATTACH_NEW_VERSION_${shape}`,
      outcome: shape === "A1" ? "EXISTING_RESOURCE_NEW_VERSION" : "EXACT_REPEAT_REUSE",
      resourceId,
      versionId,
      createdResources: [] as string[],
      reusedResources: [resolvedId(resourceId)],
      createdVersions: shape === "A1" ? [resolvedId(versionId)] : [],
      reusedVersions: shape === "A1" ? [] : [resolvedId(versionId)],
    };
  }
  if (selected === "MARK_FORK") {
    const correction = command.payload.priorRelationshipId !== undefined;
    return {
      projectionMode: "MARK_FORK",
      outcome: "FORK_OF_EXISTING_RESOURCE",
      resourceId,
      versionId,
      createdResources: correction ? [] : [resolvedId(resourceId)],
      reusedResources: correction ? [resolvedId(resourceId)] : [],
      createdVersions: correction ? [] : [resolvedId(versionId)],
      reusedVersions: correction ? [resolvedId(versionId)] : [],
    };
  }
  return {
    projectionMode: "MARK_MIRROR",
    outcome: "MIRROR",
    resourceId,
    versionId,
    createdResources: [] as string[],
    reusedResources: [resolvedId(resourceId)],
    createdVersions: [] as string[],
    reusedVersions: [resolvedId(versionId)],
  };
}

async function updateCandidateReviewAndJob(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  candidateState: string,
  resourceId: string | null,
  versionId: string | null,
  identityOutcome: string | null,
  reviewState: string,
  subjects: TypedAuditSubject[],
  plan: CommandMutationPlanV1,
): Promise<void> {
  const planned = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const values = plan.domainMutationPlan.updates.find(
      (row) => row.table === table && row.id === id,
    )?.completeTypedValues;
    if (values === undefined || !("record_version" in values))
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return values;
  };
  const candidateBeforeResult = await client.query<{
    record_version: string;
    status: string;
    identity_outcome: string | null;
    resource_identity_id: string | null;
    resource_version_identity_id: string | null;
  }>(
    `SELECT record_version,status,identity_outcome,resource_identity_id,resource_version_identity_id
     FROM resource_candidates WHERE id=$1`,
    [command.targetCandidateId],
  );
  const candidateBefore = candidateBeforeResult.rows[0];
  if (candidateBefore === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  const predecessorCandidateAudit = await client.query<{ after_state: string }>(
    `SELECT audit.after_state
     FROM identity_decisions decision
     JOIN m02_audit_events audit
       ON audit.subject_type='RESOURCE_CANDIDATE'
      AND audit.subject_id=decision.resource_candidate_id
      AND audit.action='SUBJECT_UPDATED'
      AND audit.command_id IS NOT DISTINCT FROM decision.command_id
      AND audit.result_id IS NOT DISTINCT FROM decision.result_id
      AND audit.system_operation_id IS NOT DISTINCT FROM decision.system_operation_id
      AND audit.system_result_id IS NOT DISTINCT FROM decision.system_result_id
     WHERE decision.resource_candidate_id=$1 AND decision.state='ACTIVE'
     ORDER BY convert_to(decision.id,'UTF8')`,
    [command.targetCandidateId],
  );
  const expectedCandidateVersion =
    command.expectedVersions[`row:resource_candidates:${command.targetCandidateId}`];
  if (expectedCandidateVersion === null || expectedCandidateVersion === undefined)
    throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
  const candidate = await client.query<{
    record_version: string;
    status: string;
    identity_outcome: string | null;
    resource_identity_id: string | null;
    resource_version_identity_id: string | null;
  }>(
    `UPDATE resource_candidates
     SET status = $2, resource_identity_id = $3, resource_version_identity_id = $4,
         identity_outcome = $5, updated_at = $6, record_version = record_version + 1
     WHERE id = $1 AND record_version=$7 AND status=$8
     RETURNING record_version,status,identity_outcome,resource_identity_id,resource_version_identity_id`,
    (() => {
      const row = planned("resource_candidates", command.targetCandidateId);
      if (
        row.status !== candidateState ||
        row.resource_identity_id !== resourceId ||
        row.resource_version_identity_id !== versionId ||
        row.identity_outcome !== identityOutcome
      )
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      return [
        row.id,
        row.status,
        row.resource_identity_id,
        row.resource_version_identity_id,
        row.identity_outcome,
        row.updated_at,
        expectedCandidateVersion,
        candidateBefore.status,
      ];
    })(),
  );
  if (candidate.rowCount !== 1) throw new ManualResolutionError("REFERENCE_INVALID");
  const candidateAfter = Number(candidate.rows[0]?.record_version ?? "0");
  subjects.push({
    action: "SUBJECT_UPDATED",
    subjectType: "RESOURCE_CANDIDATE",
    subjectId: command.targetCandidateId,
    beforeVersion: candidateAfter - 1,
    afterVersion: candidateAfter,
    beforeState:
      predecessorCandidateAudit.rows[0]?.after_state ??
      canonicalState({
        identityOutcome: null,
        recordVersion: Number(candidateBefore.record_version),
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "CLASSIFIED",
      }),
    afterState: canonicalState({
      identityOutcome: candidate.rows[0]?.identity_outcome ?? null,
      recordVersion: candidateAfter,
      resourceIdentityId: candidate.rows[0]?.resource_identity_id ?? null,
      resourceVersionIdentityId: candidate.rows[0]?.resource_version_identity_id ?? null,
      status: candidate.rows[0]?.status ?? candidateState,
    }),
  });
  const reviewId = command.payload.reviewId;
  if (reviewId !== undefined) {
    const expectedReviewVersion = command.expectedVersions[`row:m02_review_states:${reviewId}`];
    if (expectedReviewVersion === null || expectedReviewVersion === undefined)
      throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
    const review = await client.query<{ record_version: string }>(
      `UPDATE m02_review_states SET review_state = $2, record_version = record_version + 1
       WHERE id = $1 AND record_version=$3 RETURNING record_version`,
      [reviewId, planned("m02_review_states", reviewId).review_state, expectedReviewVersion],
    );
    if (review.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    const after = Number(review.rows[0]?.record_version ?? "0");
    subjects.push({
      action: "SUBJECT_UPDATED",
      subjectType: "M02_REVIEW_STATE",
      subjectId: reviewId,
      beforeVersion: after - 1,
      afterVersion: after,
      beforeState: "IDENTITY_REVIEW_REQUIRED",
      afterState: reviewState,
    });
  }
  const jobId = command.payload.jobId;
  if (jobId !== undefined) {
    const expectedAcquisitionVersion = command.expectedVersions[`row:acquisition_jobs:${jobId}`];
    const expectedJobVersion = command.expectedVersions[`row:m02_jobs:${jobId}`];
    if (
      expectedAcquisitionVersion === null ||
      expectedAcquisitionVersion === undefined ||
      expectedJobVersion === null ||
      expectedJobVersion === undefined
    )
      throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
    const acquisitionPlan = plan.domainMutationPlan.updates.find(
      (row) => row.table === "acquisition_jobs" && row.id === jobId,
    );
    if (acquisitionPlan?.expectedState === undefined)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const acquisition = await client.query<{ record_version: string; status: string }>(
      `UPDATE acquisition_jobs SET status = $2, record_version = record_version + 1
       WHERE id = $1 AND record_version=$3 RETURNING record_version,status`,
      [jobId, planned("acquisition_jobs", jobId).status, expectedAcquisitionVersion],
    );
    if (acquisition.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    const acquisitionAfter = Number(acquisition.rows[0]?.record_version ?? "0");
    subjects.push({
      action: "SUBJECT_UPDATED",
      subjectType: "ACQUISITION_JOB",
      subjectId: jobId,
      beforeVersion: acquisitionAfter - 1,
      afterVersion: acquisitionAfter,
      beforeState: canonicalState({
        recordVersion: acquisitionAfter - 1,
        status: acquisitionPlan.expectedState,
      }),
      afterState: canonicalState({
        recordVersion: acquisitionAfter,
        status: acquisition.rows[0]?.status ?? "COMPLETED",
      }),
    });
    const job = await client.query<{ record_version: string }>(
      `UPDATE m02_jobs SET review_state = $2, record_version = record_version + 1
       WHERE id = $1 AND record_version=$3 RETURNING record_version`,
      [jobId, planned("m02_jobs", jobId).review_state, expectedJobVersion],
    );
    if (job.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    const after = Number(job.rows[0]?.record_version ?? "0");
    subjects.push({
      action: "SUBJECT_UPDATED",
      subjectType: "M02_JOB",
      subjectId: jobId,
      beforeVersion: after - 1,
      afterVersion: after,
      beforeState: "IDENTITY_REVIEW_REQUIRED",
      afterState: reviewState,
      metadata: { scope: "IDENTITY_RESOLUTION", guardKey: `row:m02_jobs:${jobId}` },
    });
  }
}

async function transitionOpenClarifications(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  terminalState: "RESOLVED" | "SUPERSEDED",
  subjects: TypedAuditSubject[],
  plan: CommandMutationPlanV1,
): Promise<void> {
  const plannedRows = [
    ...plan.domainMutationPlan.updates,
    ...plan.domainMutationPlan.supersedes,
  ].filter((row) => row.table === "m02_clarification_requests");
  for (const intent of plannedRows) {
    const row = (
      await client.query<OpenClarificationTargetRow>(
        `SELECT id,record_version,target_classification_run_id,target_identity_decision_id,
                target_rejection_decision_id
         FROM m02_clarification_requests WHERE id=$1 AND state='OPEN' FOR UPDATE`,
        [intent.id],
      )
    ).rows[0];
    if (row === undefined) throw new ManualResolutionError("STALE_RECORD_VERSION");
    const auditId = requiredString(intent.completeTypedValues.resolution_audit_event_id);
    const before = Number(row.record_version);
    const clarificationTarget =
      row.target_classification_run_id !== null
        ? {
            clarificationTargetType: "CLASSIFICATION",
            clarificationTargetId: row.target_classification_run_id,
          }
        : row.target_identity_decision_id !== null
          ? {
              clarificationTargetType: "IDENTITY",
              clarificationTargetId: row.target_identity_decision_id,
            }
          : {
              clarificationTargetType: "REJECTION",
              clarificationTargetId: row.target_rejection_decision_id ?? "",
            };
    subjects.push({
      auditId,
      action: terminalState === "RESOLVED" ? "SUBJECT_UPDATED" : "SUBJECT_SUPERSEDED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: row.id,
      beforeVersion: before,
      afterVersion: before + 1,
      beforeState: "OPEN",
      afterState: terminalState,
      metadata: clarificationTarget,
    });
    const updated = await client.query(
      `UPDATE m02_clarification_requests
       SET state=$2,resolution_command_id=$3,resolution_result_id=$4,
           resolution_audit_event_id=$5,superseded_by_command_id=$6,resolved_at=$7,
           record_version=record_version+1
       WHERE id=$1 AND state='OPEN' AND record_version=$8`,
      [
        row.id,
        terminalState,
        command.commandId,
        resultId,
        auditId,
        terminalState === "SUPERSEDED" ? command.commandId : null,
        command.timestamp,
        before,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  }
}

export async function persistTypedCommand(
  client: PoolClient,
  requestCommand: ManualResolutionEnvelope,
  command: ManualResolutionEnvelope,
  requestFingerprint: string,
  result: ManualResolutionResult,
  resultId: string,
  auditBase: string,
  plan: CommandMutationPlanV1,
  expansionId: string,
): Promise<void> {
  await client.query("SET CONSTRAINTS ALL DEFERRED");
  const resultFingerprint = fingerprintM02Payload(result as never);
  await client.query(
    `INSERT INTO manual_resolution_commands (
       id, request_id, command_type, idempotency_scope, idempotency_key,
       actor_id, actor_role, expected_versions, caller_expected_versions_payload,
       request_fingerprint, result_fingerprint,
       reason_code, reason, target_candidate_id, target_group_id, evidence_ids,
       decision_ids, command_payload, request_payload, result_payload, created_at
     ) VALUES ($1,$2,$3,'M02',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
    [
      requestCommand.commandId,
      requestCommand.requestId,
      requestCommand.command,
      requestCommand.idempotencyKey,
      requestCommand.actorId,
      requestCommand.actorRole,
      requestCommand.expectedVersions,
      Buffer.from(canonicalM02JsonBytes(requestCommand.expectedVersions as never)),
      requestFingerprint,
      resultFingerprint,
      requestCommand.reasonCode,
      requestCommand.reason,
      requestCommand.targetCandidateId,
      requestCommand.targetGroupId,
      JSON.stringify(requestCommand.evidenceIds),
      JSON.stringify(requestCommand.decisionIds),
      requestCommand.payload,
      Buffer.from(canonicalM02JsonBytes(requestCommand as never)),
      result,
      requestCommand.timestamp,
    ],
  );
  const context = await projectionContext(client, command);
  const selected = effectiveCommand(command);
  const clarificationCount = ["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected)
    ? 0
    : plan.domainMutationPlan.audits.filter(
        (audit) => audit.subjectType === "M02_CLARIFICATION_REQUEST",
      ).length;
  const identitySurface = identityResultSurface(command, expansionId);
  const plannedCreateValues = (
    table: string,
    id: string | null,
  ): Readonly<Record<string, unknown>> | undefined =>
    id === null
      ? undefined
      : plan.domainMutationPlan.creates.find((row) => row.table === table && row.id === id)
          ?.completeTypedValues;
  const plannedResource = plannedCreateValues(
    "resource_identities",
    identitySurface.createdResources[0] ?? null,
  );
  const plannedVersion = plannedCreateValues(
    "resource_version_identities",
    identitySurface.createdVersions[0] ?? null,
  );
  const plannedResult = plan.domainMutationPlan.result.completeTypedValues;
  if (
    plan.domainMutationPlan.result.table !== "m02_manual_command_results" ||
    plan.domainMutationPlan.result.id !== resultId ||
    plannedResult.id !== resultId ||
    plannedResult.command_id !== command.commandId ||
    plannedResult.request_id !== command.requestId ||
    plannedResult.request_fingerprint !== requestFingerprint ||
    plannedResult.mutation_plan_fingerprint !== "$SELF" ||
    plannedResult.result_fingerprint !== resultFingerprint
  )
    throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  if (
    (identitySurface.createdResources.length === 1) !== (plannedResource !== undefined) ||
    (identitySurface.createdVersions.length === 1) !== (plannedVersion !== undefined)
  )
    throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  const resourceAuditId = allocatedId(command, "auditIdsJson", clarificationCount);
  const versionAuditId = allocatedId(
    command,
    "auditIdsJson",
    clarificationCount + identitySurface.createdResources.length,
  );
  if (
    (plannedResource !== undefined && plannedResource.audit_event_id !== resourceAuditId) ||
    (plannedVersion !== undefined && plannedVersion.audit_event_id !== versionAuditId)
  )
    throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  await client.query(
    `WITH created_resource AS (
       INSERT INTO resource_identities
         (id,status,reliable_identity_token,reliable_token_evidence_id,created_at,record_version,
          guard_anchor_candidate_id,origin_type,command_id,result_id,audit_event_id)
       SELECT $19,'ACTIVE',$20,$21,$22,1,$23,'HUMAN_COMMAND',$24,$25,$26
       WHERE $27::boolean RETURNING id
     ), created_version AS (
       INSERT INTO resource_version_identities
         (id,resource_identity_id,content_fingerprint,canonical_payload,
          first_observed_source_snapshot_id,first_observed_candidate_root_id,
          first_observed_source_revision,observation_label,status,created_at,record_version,
          origin_type,command_id,result_id,audit_event_id)
       SELECT $28,$29,$30,$31,$32,$33,$34,$35,'IDENTITY_RESOLVED',$36,1,
         'HUMAN_COMMAND',$37,$38,$39 WHERE $40::boolean RETURNING id
     ) INSERT INTO m02_manual_command_results
       (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
        result_fingerprint, ordered_target_ids, record_versions, result_payload,
        identity_projection_mode_id,identity_outcome,resource_identity_id,
        resource_version_identity_id,created_resource_identity_ids,reused_resource_identity_ids,
        created_resource_version_identity_ids,reused_resource_version_identity_ids,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      plannedResult.id,
      plannedResult.command_id,
      plannedResult.request_id,
      plannedResult.request_fingerprint,
      plan.fingerprint,
      plannedResult.result_fingerprint,
      JSON.stringify(plannedResult.ordered_target_ids),
      JSON.stringify(plannedResult.record_versions),
      JSON.stringify(plannedResult.result_payload),
      plannedResult.identity_projection_mode_id,
      plannedResult.identity_outcome,
      plannedResult.resource_identity_id,
      plannedResult.resource_version_identity_id,
      plannedResult.created_resource_identity_ids,
      plannedResult.reused_resource_identity_ids,
      plannedResult.created_resource_version_identity_ids,
      plannedResult.reused_resource_version_identity_ids,
      plannedResult.created_at,
      plannedResource?.id ?? null,
      plannedResource?.reliable_identity_token ?? null,
      plannedResource?.reliable_token_evidence_id ?? null,
      plannedResource?.created_at ?? command.timestamp,
      plannedResource?.guard_anchor_candidate_id ?? command.targetCandidateId,
      command.commandId,
      resultId,
      resourceAuditId,
      identitySurface.createdResources.length === 1,
      plannedVersion?.id ?? null,
      plannedVersion?.resource_identity_id ?? null,
      plannedVersion?.content_fingerprint ?? null,
      plannedVersion === undefined
        ? context.canonical_content_payload
        : Buffer.from(String(plannedVersion.canonical_payload).slice(2), "hex"),
      plannedVersion?.first_observed_source_snapshot_id ?? null,
      plannedVersion?.first_observed_candidate_root_id ?? null,
      plannedVersion?.first_observed_source_revision ?? null,
      plannedVersion?.observation_label ?? null,
      plannedVersion?.created_at ?? command.timestamp,
      command.commandId,
      resultId,
      versionAuditId,
      identitySurface.createdVersions.length === 1,
    ],
  );

  const subjects: TypedAuditSubject[] = [];
  const decisionId = command.payload.decisionId;
  const plannedCreate = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.creates.find(
      (candidate) => candidate.table === table && candidate.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const plannedUpdate = (
    table: string,
    id: string,
  ): Readonly<Record<string, unknown>> | undefined =>
    plan.domainMutationPlan.updates.find((row) => row.table === table && row.id === id)
      ?.completeTypedValues;
  const plannedSupersede = (
    table: string,
    id: string,
  ): Readonly<Record<string, unknown>> | undefined =>
    plan.domainMutationPlan.supersedes.find((row) => row.table === table && row.id === id)
      ?.completeTypedValues;

  if (
    !["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected) &&
    [
      "CREATE_RESOURCE",
      "ATTACH_NEW_VERSION",
      "MARK_FORK",
      "MARK_MIRROR",
      "MARK_DUPLICATE",
      "REJECT_CANDIDATE",
      "SPLIT_ROOTS",
      "MERGE_ROOTS",
      "OVERRIDE_NON_SKILL",
    ].includes(selected)
  )
    await transitionOpenClarifications(
      client,
      command,
      resultId,
      ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)
        ? "SUPERSEDED"
        : "RESOLVED",
      subjects,
      plan,
    );

  if (["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(selected)) {
    const resourceId =
      command.payload.resourceIdentityId ?? command.payload.targetResourceIdentityId ?? "";
    const versionId =
      command.payload.resourceVersionIdentityId ??
      command.payload.forkResourceVersionId ??
      command.payload.targetResourceVersionId ??
      "";
    if (identitySurface.createdResources.includes(resourceId)) {
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_IDENTITY",
        subjectId: resourceId,
      });
    }
    if (identitySurface.createdVersions.includes(versionId)) {
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_VERSION_IDENTITY",
        subjectId: versionId,
      });
    }
    const sourceLinkId = command.payload.sourceLinkId ?? "";
    const oldLinkId = command.payload.activeSourceLinkId ?? command.payload.priorSourceLinkId;
    if (oldLinkId !== undefined && oldLinkId !== sourceLinkId) {
      const intent = plannedSupersede("resource_source_links", oldLinkId);
      if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const old = await client.query<{ record_version: string }>(
        `UPDATE resource_source_links SET state=$2, record_version=$3
         WHERE id=$1 AND state=$4 AND record_version=$5 RETURNING record_version`,
        [
          intent.id,
          intent.state,
          intent.record_version,
          "ACTIVE",
          Number(intent.record_version) - 1,
        ],
      );
      if (old.rowCount === 1) {
        const after = Number(old.rows[0]?.record_version ?? "0");
        subjects.push({
          action: "SUBJECT_SUPERSEDED",
          subjectType: "RESOURCE_SOURCE_LINK",
          subjectId: oldLinkId,
          beforeVersion: after - 1,
          afterVersion: after,
          beforeState: "ACTIVE",
          afterState: "SUPERSEDED",
        });
      }
    }
    const linkExists = await client.query(`SELECT 1 FROM resource_source_links WHERE id=$1`, [
      sourceLinkId,
    ]);
    if (linkExists.rowCount === 0) {
      const intent = plannedCreate("resource_source_links", sourceLinkId);
      await client.query(
        `INSERT INTO resource_source_links
           (id, source_repository_id, normalized_root_path, target_resource_version_id,
            relationship, evidence_ids, decision_id, reason, actor_id, created_at,
            state, supersedes_source_link_id, record_version,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,'HUMAN_COMMAND',$13,$14,$15)`,
        (() => {
          const audit = nextSubjectAuditId(command, auditBase, subjects);
          if (intent.audit_event_id !== audit)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.source_repository_id,
            intent.normalized_root_path,
            intent.target_resource_version_id,
            intent.relationship,
            JSON.stringify(intent.evidence_ids),
            intent.decision_id,
            intent.reason,
            intent.actor_id,
            intent.created_at,
            intent.state,
            intent.supersedes_source_link_id,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_SOURCE_LINK",
        subjectId: sourceLinkId,
      });
    }
    const observationId = command.payload.observationId ?? "";
    const observationExists = await client.query(
      `SELECT 1 FROM resource_version_observations WHERE id=$1`,
      [observationId],
    );
    if (observationExists.rowCount === 0) {
      const intent = plannedCreate("resource_version_observations", observationId);
      await client.query(
        `INSERT INTO resource_version_observations
           (id, resource_version_identity_id, source_snapshot_id, candidate_root_id,
            resource_source_link_id, source_repository_id, provider, provider_repository_id,
            normalized_root_path, immutable_revision, observed_at,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'HUMAN_COMMAND',$12,$13,$14)`,
        (() => {
          const audit = nextSubjectAuditId(command, auditBase, subjects);
          if (intent.audit_event_id !== audit)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.resource_version_identity_id,
            intent.source_snapshot_id,
            intent.candidate_root_id,
            intent.resource_source_link_id,
            intent.source_repository_id,
            intent.provider,
            intent.provider_repository_id,
            intent.normalized_root_path,
            intent.immutable_revision,
            intent.observed_at,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_VERSION_OBSERVATION",
        subjectId: observationId,
      });
    }
    if (selected === "MARK_FORK") {
      const prior = command.payload.priorRelationshipId;
      if (prior !== undefined) {
        const intent = plannedSupersede("fork_relationships", prior);
        if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const updated = await client.query<{ record_version: string }>(
          `UPDATE fork_relationships SET state=$2, record_version=$3
           WHERE id=$1 AND state=$4 AND record_version=$5 RETURNING record_version`,
          [prior, intent.state, intent.record_version, "ACTIVE", Number(intent.record_version) - 1],
        );
        if (updated.rowCount === 1) {
          const after = Number(updated.rows[0]?.record_version ?? "0");
          subjects.push({
            action: "SUBJECT_SUPERSEDED",
            subjectType: "FORK_RELATIONSHIP",
            subjectId: prior,
            beforeVersion: after - 1,
            afterVersion: after,
            beforeState: "ACTIVE",
            afterState: "SUPERSEDED",
          });
        }
      }
      await client.query(
        `INSERT INTO fork_relationships
           (id, fork_resource_version_id, origin_resource_version_id, state, evidence_ids,
            decision_id, reason, actor_id, created_at, supersedes_relationship_id, record_version,
            command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,$9,1,$10,$11,$12)`,
        (() => {
          const intent = plannedCreate("fork_relationships", command.payload.relationshipId ?? "");
          const audit = nextSubjectAuditId(command, auditBase, subjects);
          if (intent.audit_event_id !== audit)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.fork_resource_version_id,
            intent.origin_resource_version_id,
            JSON.stringify(intent.evidence_ids),
            intent.decision_id,
            intent.reason,
            intent.actor_id,
            intent.created_at,
            intent.supersedes_relationship_id,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "FORK_RELATIONSHIP",
        subjectId: command.payload.relationshipId ?? "",
      });
    }
    if (selected === "MARK_MIRROR") {
      const prior = command.payload.priorRelationshipId;
      if (prior !== undefined) {
        const intent = plannedSupersede("source_repository_relationships", prior);
        if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const updated = await client.query<{ record_version: string }>(
          `UPDATE source_repository_relationships SET state=$2, record_version=$3
           WHERE id=$1 AND state=$4 AND record_version=$5 RETURNING record_version`,
          [prior, intent.state, intent.record_version, "ACTIVE", Number(intent.record_version) - 1],
        );
        if (updated.rowCount === 1) {
          const after = Number(updated.rows[0]?.record_version ?? "0");
          subjects.push({
            action: "SUBJECT_SUPERSEDED",
            subjectType: "SOURCE_REPOSITORY_RELATIONSHIP",
            subjectId: prior,
            beforeVersion: after - 1,
            afterVersion: after,
            beforeState: "ACTIVE",
            afterState: "SUPERSEDED",
          });
        }
      }
      await client.query(
        `INSERT INTO source_repository_relationships
           (id, mirror_source_repository_id, origin_source_repository_id, state,
            target_resource_version_id, delivery_source_link_id, evidence_ids, decision_id,
            reason, actor_id, created_at, supersedes_relationship_id, record_version,
            command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$13,$14)`,
        (() => {
          const intent = plannedCreate(
            "source_repository_relationships",
            command.payload.relationshipId ?? "",
          );
          const audit = nextSubjectAuditId(command, auditBase, subjects);
          if (intent.audit_event_id !== audit)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.mirror_source_repository_id,
            intent.origin_source_repository_id,
            intent.target_resource_version_id,
            intent.delivery_source_link_id,
            JSON.stringify(intent.evidence_ids),
            intent.decision_id,
            intent.reason,
            intent.actor_id,
            intent.created_at,
            intent.supersedes_relationship_id,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "SOURCE_REPOSITORY_RELATIONSHIP",
        subjectId: command.payload.relationshipId ?? "",
      });
    }
    if (decisionId !== undefined) {
      const activeDecisions = await client.query<{ id: string; record_version: string }>(
        `SELECT id,record_version FROM identity_decisions
         WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2
         ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
        [command.targetCandidateId, decisionId],
      );
      for (const active of activeDecisions.rows) {
        const intent = plannedSupersede("identity_decisions", active.id);
        if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const supersessionAuditId = nextSubjectAuditId(command, auditBase, subjects);
        if (intent.replacement_audit_event_id !== supersessionAuditId)
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const updated = await client.query(
          `UPDATE identity_decisions
           SET state='SUPERSEDED',replacement_command_id=$2,replacement_result_id=$3,
               replacement_audit_event_id=$4,superseded_by_decision_id=$5,
               record_version=$6 WHERE id=$1 AND state='ACTIVE' AND record_version=$7`,
          [
            intent.id,
            intent.replacement_command_id,
            intent.replacement_result_id,
            intent.replacement_audit_event_id,
            intent.superseded_by_decision_id,
            intent.record_version,
            Number(intent.record_version) - 1,
          ],
        );
        if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
        subjects.push({
          action: "SUBJECT_SUPERSEDED",
          subjectType: "IDENTITY_DECISION",
          subjectId: active.id,
          beforeVersion: Number(active.record_version),
          afterVersion: Number(active.record_version) + 1,
          beforeState: "ACTIVE",
          afterState: "SUPERSEDED",
        });
      }
      await client.query(
        `INSERT INTO identity_decisions
           (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
            signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
            supersedes_decision_id, created_at, record_version,origin_type,command_id,result_id,audit_event_id)
         VALUES ($1,$2,$3,$4,'HUMAN_COMMAND',$5,'[]','[]',$6,'ACTIVE',$7,$8,1,'HUMAN_COMMAND',$9,$10,$11)`,
        (() => {
          const intent = plannedCreate("identity_decisions", decisionId);
          const audit = nextSubjectAuditId(command, auditBase, subjects);
          if (intent.audit_event_id !== audit)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.resource_candidate_id,
            intent.outcome,
            intent.identity_policy_version,
            JSON.stringify(intent.signals),
            intent.audit_fingerprint,
            intent.supersedes_decision_id,
            intent.created_at,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "IDENTITY_DECISION",
        subjectId: decisionId,
      });
    }
    const existingHandoff = await client.query<{ id: string; record_version: string }>(
      `SELECT id,record_version FROM m02_identity_handoff_markers
       WHERE resource_candidate_id=$1 AND state='ACTIVE' FOR UPDATE`,
      [command.targetCandidateId],
    );
    const priorHandoff = existingHandoff.rows[0];
    const preserveHandoff =
      selected === "MARK_FORK" && command.payload.priorRelationshipId !== undefined;
    if (priorHandoff !== undefined && !preserveHandoff) {
      const intent = plannedSupersede("m02_identity_handoff_markers", priorHandoff.id);
      if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const updated = await client.query(
        `UPDATE m02_identity_handoff_markers
         SET state=$2,controlling_job_state=$3,record_version=$4
         WHERE id=$1 AND state='ACTIVE' AND record_version=$5`,
        [
          intent.id,
          intent.state,
          intent.controlling_job_state,
          intent.record_version,
          Number(intent.record_version) - 1,
        ],
      );
      if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    }
    await updateCandidateReviewAndJob(
      client,
      command,
      "IDENTITY_RESOLVED",
      resourceId,
      versionId,
      identitySurface.outcome,
      "RESOLVED",
      subjects,
      plan,
    );
    if (priorHandoff !== undefined && !preserveHandoff) {
      subjects.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "M02_IDENTITY_HANDOFF",
        subjectId: priorHandoff.id,
        beforeVersion: Number(priorHandoff.record_version),
        afterVersion: Number(priorHandoff.record_version) + 1,
        beforeState: "ACTIVE",
        afterState: "SUPERSEDED",
      });
    }
    if (priorHandoff === undefined || !preserveHandoff) {
      const handoffId = command.payload.handoffId ?? "";
      const handoffAuditId = nextSubjectAuditId(command, auditBase, subjects);
      await client.query(
        `INSERT INTO m02_identity_handoff_markers
         (id, resource_candidate_id, resource_identity_id, resource_version_identity_id,
          controlling_m02_job_id, source_snapshot_id, identity_decision_id, origin_type,command_id,
          result_id, audit_event_id, logical_key, controlling_job_state, state,
          created_at, record_version, supersedes_handoff_marker_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'HUMAN_COMMAND',$8,$9,$10,$11,'CONTROLLING','ACTIVE',$12,1,$13)`,
        (() => {
          const intent = plannedCreate("m02_identity_handoff_markers", handoffId);
          if (intent.audit_event_id !== handoffAuditId)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            intent.id,
            intent.resource_candidate_id,
            intent.resource_identity_id,
            intent.resource_version_identity_id,
            intent.controlling_m02_job_id,
            intent.source_snapshot_id,
            intent.identity_decision_id,
            intent.command_id,
            intent.result_id,
            intent.audit_event_id,
            intent.logical_key,
            intent.created_at,
            intent.supersedes_handoff_marker_id,
          ];
        })(),
      );
      subjects.push({
        action: "SUBJECT_CREATED",
        subjectType: "M02_IDENTITY_HANDOFF",
        subjectId: handoffId,
      });
    }
  } else if (selected === "MARK_DUPLICATE") {
    const prior = command.payload.priorRelationshipId;
    if (prior !== undefined) {
      const intent = plannedSupersede("duplicate_candidates", prior);
      if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const updated = await client.query<{ record_version: string }>(
        `UPDATE duplicate_candidates SET status=$2, record_version=$3
         WHERE id=$1 AND status=$4 AND record_version=$5 RETURNING record_version`,
        [
          prior,
          intent.status,
          intent.record_version,
          "CONFIRMED",
          Number(intent.record_version) - 1,
        ],
      );
      if (updated.rowCount === 1) {
        const after = Number(updated.rows[0]?.record_version ?? "0");
        subjects.push({
          action: "SUBJECT_SUPERSEDED",
          subjectType: "DUPLICATE_CANDIDATE",
          subjectId: prior,
          beforeVersion: after - 1,
          afterVersion: after,
          beforeState: "CONFIRMED",
          afterState: "SUPERSEDED",
        });
      }
    }
    const activeDecisions = await client.query<{ id: string; record_version: string }>(
      `SELECT id,record_version FROM identity_decisions
       WHERE resource_candidate_id=$1 AND state='ACTIVE' AND id<>$2
       ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
      [command.targetCandidateId, decisionId],
    );
    for (const active of activeDecisions.rows) {
      const intent = plannedSupersede("identity_decisions", active.id);
      if (intent === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const supersessionAuditId = nextSubjectAuditId(command, auditBase, subjects);
      if (intent.replacement_audit_event_id !== supersessionAuditId)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const updated = await client.query(
        `UPDATE identity_decisions
         SET state='SUPERSEDED',replacement_command_id=$2,replacement_result_id=$3,
             replacement_audit_event_id=$4,superseded_by_decision_id=$5,
             record_version=$6 WHERE id=$1 AND state='ACTIVE' AND record_version=$7`,
        [
          intent.id,
          intent.replacement_command_id,
          intent.replacement_result_id,
          intent.replacement_audit_event_id,
          intent.superseded_by_decision_id,
          intent.record_version,
          Number(intent.record_version) - 1,
        ],
      );
      if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
      subjects.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: active.id,
        beforeVersion: Number(active.record_version),
        afterVersion: Number(active.record_version) + 1,
        beforeState: "ACTIVE",
        afterState: "SUPERSEDED",
      });
    }
    const decisionIntent = plannedCreate("identity_decisions", decisionId ?? "");
    const decisionAuditId = nextSubjectAuditId(command, auditBase, subjects);
    if (decisionIntent.audit_event_id !== decisionAuditId)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO identity_decisions
         (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
          signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
          supersedes_decision_id, created_at, record_version,origin_type,command_id,result_id,audit_event_id)
       VALUES ($1,$2,'POSSIBLE_DUPLICATE',$3,'HUMAN_COMMAND',$4,'[]','[]',$5,'ACTIVE',$6,$7,1,'HUMAN_COMMAND',$8,$9,$10)`,
      [
        decisionIntent.id,
        decisionIntent.resource_candidate_id,
        decisionIntent.identity_policy_version,
        JSON.stringify(decisionIntent.signals),
        decisionIntent.audit_fingerprint,
        decisionIntent.supersedes_decision_id,
        decisionIntent.created_at,
        decisionIntent.command_id,
        decisionIntent.result_id,
        decisionIntent.audit_event_id,
      ],
    );
    await client.query(
      `INSERT INTO duplicate_candidates
         (id, resource_candidate_id, target_resource_version_id, status, evidence_ids,
          decision_id, reason, actor_id, created_at, supersedes_duplicate_id, record_version,
          origin_type,command_id,result_id,audit_event_id)
       VALUES ($1,$2,$3,'CONFIRMED',$4,$5,$6,$7,$8,$9,1,'HUMAN_COMMAND',$10,$11,$12)`,
      (() => {
        const intent = plannedCreate("duplicate_candidates", command.payload.duplicateId ?? "");
        const audit = allocatedId(command, "auditIdsJson", subjects.length + 1);
        if (intent.audit_event_id !== audit)
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        return [
          intent.id,
          intent.resource_candidate_id,
          intent.target_resource_version_id,
          JSON.stringify(intent.evidence_ids),
          intent.decision_id,
          intent.reason,
          intent.actor_id,
          intent.created_at,
          intent.supersedes_duplicate_id,
          intent.command_id,
          intent.result_id,
          intent.audit_event_id,
        ];
      })(),
    );
    subjects.push({
      action: "SUBJECT_CREATED",
      subjectType: "IDENTITY_DECISION",
      subjectId: decisionId ?? "",
    });
    subjects.push({
      action: "SUBJECT_CREATED",
      subjectType: "DUPLICATE_CANDIDATE",
      subjectId: command.payload.duplicateId ?? "",
    });
    await updateCandidateReviewAndJob(
      client,
      command,
      "REJECTED",
      null,
      null,
      "POSSIBLE_DUPLICATE",
      "REJECTED",
      subjects,
      plan,
    );
  } else if (selected === "REJECT_CANDIDATE") {
    await updateCandidateReviewAndJob(
      client,
      command,
      "REJECTED",
      null,
      null,
      null,
      "REJECTED",
      subjects,
      plan,
    );
    const activeDecisions = await client.query<{ id: string; record_version: string }>(
      `SELECT id,record_version FROM identity_decisions
       WHERE resource_candidate_id=$1 AND state='ACTIVE'
       ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
      [command.targetCandidateId],
    );
    for (const prior of activeDecisions.rows) {
      const beforeVersion = Number(prior.record_version);
      const auditId = nextSubjectAuditId(command, auditBase, subjects);
      const intent = plannedSupersede("identity_decisions", prior.id);
      if (intent?.replacement_audit_event_id !== auditId)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const updated = await client.query(
        `UPDATE identity_decisions
         SET state='SUPERSEDED',replacement_command_id=$2,replacement_result_id=$3,
             replacement_audit_event_id=$4,record_version=record_version+1
         WHERE id=$1 AND state='ACTIVE' AND record_version=$5`,
        [
          prior.id,
          intent.replacement_command_id,
          intent.replacement_result_id,
          intent.replacement_audit_event_id,
          beforeVersion,
        ],
      );
      if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
      subjects.push({
        action: "SUBJECT_SUPERSEDED",
        subjectType: "IDENTITY_DECISION",
        subjectId: prior.id,
        beforeVersion,
        afterVersion: beforeVersion + 1,
        beforeState: "ACTIVE",
        afterState: "SUPERSEDED",
        metadata: { evaluatedTierSequence: HUMAN_TIER_SEQUENCE },
      });
    }
    const rejectionAuditId = nextSubjectAuditId(command, auditBase, subjects);
    const intent = plannedCreate("m02_candidate_rejection_decisions", decisionId ?? "");
    if (intent.audit_event_id !== rejectionAuditId)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_candidate_rejection_decisions
         (id, resource_candidate_id, controlling_job_id, classification_run_id,
          source_snapshot_id, command_id, result_id, audit_event_id, evidence_ids,
          actor_id, actor_role, reason_code, reason_text, state, created_at, record_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ACTIVE',$14,1)`,
      [
        intent.id,
        intent.resource_candidate_id,
        intent.controlling_job_id,
        intent.classification_run_id,
        intent.source_snapshot_id,
        intent.command_id,
        intent.result_id,
        intent.audit_event_id,
        JSON.stringify(intent.evidence_ids),
        intent.actor_id,
        intent.actor_role,
        intent.reason_code,
        intent.reason_text,
        intent.created_at,
      ],
    );
    subjects.push({
      action: "SUBJECT_CREATED",
      subjectType: "M02_REJECTION_DECISION",
      subjectId: decisionId ?? "",
    });
  } else if (selected === "REQUEST_CLARIFICATION") {
    const clarificationId = command.payload.clarificationId ?? "";
    const targetType = command.reasonCode.includes("CLASSIFICATION")
      ? "CLASSIFICATION"
      : command.reasonCode.includes("REJECTION")
        ? "REJECTION"
        : "IDENTITY";
    const targetId =
      targetType === "CLASSIFICATION"
        ? context.reconciled_classification_run_id
        : targetType === "REJECTION"
          ? command.decisionIds[0]
          : command.decisionIds[0];
    const clarificationAuditId = nextSubjectAuditId(command, auditBase, subjects);
    const intent = plannedCreate("m02_clarification_requests", clarificationId);
    if (intent.audit_event_id !== clarificationAuditId)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_clarification_requests
         (id, command_id, result_id, audit_event_id, review_id, controlling_job_id,
          source_snapshot_id, target_classification_run_id, target_identity_decision_id,
          target_rejection_decision_id, resource_candidate_id, candidate_group_id,
          question_code, reason_code, question_payload, evidence_ids, evidence_gaps,
          requested_responder_class, actor_id, actor_role, state, created_at, record_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'OPEN',$21,1)`,
      [
        intent.id,
        intent.command_id,
        intent.result_id,
        intent.audit_event_id,
        intent.review_id,
        intent.controlling_job_id,
        intent.source_snapshot_id,
        intent.target_classification_run_id,
        intent.target_identity_decision_id,
        intent.target_rejection_decision_id,
        intent.resource_candidate_id,
        intent.candidate_group_id,
        intent.question_code,
        intent.reason_code,
        Buffer.from(String(intent.question_payload).slice(2), "hex"),
        JSON.stringify(intent.evidence_ids),
        JSON.stringify(intent.evidence_gaps),
        intent.requested_responder_class,
        intent.actor_id,
        intent.actor_role,
        intent.created_at,
      ],
    );
    subjects.push({
      action: "SUBJECT_CREATED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: clarificationId,
      metadata: { clarificationTargetType: targetType, clarificationTargetId: targetId ?? "" },
    });
    if (command.payload.reviewId !== undefined) {
      const review = plannedUpdate("m02_review_states", command.payload.reviewId);
      if (review === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const updated = await client.query(
        `UPDATE m02_review_states
         SET review_state=$2, record_version=record_version+1
         WHERE id=$1 AND record_version=$3`,
        [review.id, review.review_state, Number(review.record_version) - 1],
      );
      if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    }
    if (command.payload.jobId !== undefined) {
      const acquisition = plannedUpdate("acquisition_jobs", command.payload.jobId);
      const job = plannedUpdate("m02_jobs", command.payload.jobId);
      if (acquisition === undefined || job === undefined)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      const acquisitionUpdated = await client.query(
        `UPDATE acquisition_jobs SET status=$2, record_version=record_version+1
         WHERE id=$1 AND record_version=$3`,
        [acquisition.id, acquisition.status, Number(acquisition.record_version) - 1],
      );
      if (acquisitionUpdated.rowCount !== 1)
        throw new ManualResolutionError("STALE_RECORD_VERSION");
      const jobUpdated = await client.query(
        `UPDATE m02_jobs SET review_state=$2, record_version=record_version+1
         WHERE id=$1 AND record_version=$3`,
        [job.id, job.review_state, Number(job.record_version) - 1],
      );
      if (jobUpdated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    }
  } else if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)) {
    await projectTopology(client, command, resultId, auditBase, subjects, plan);
  } else if (selected === "REPLACE_M02_JOB") {
    await projectReplacementJob(client, command, subjects, plan);
  }

  for (const subject of subjects) {
    if (
      !plan.domainMutationPlan.audits.some(
        (audit) =>
          audit.action === subject.action &&
          audit.subjectType === subject.subjectType &&
          audit.subjectId === subject.subjectId &&
          (subject.auditId === undefined || audit.id === subject.auditId),
      )
    )
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  }
  for (const audit of plan.domainMutationPlan.audits) {
    await client.query(
      `INSERT INTO m02_audit_events
         (id, origin_type,command_id, result_id, actor_type, actor_id, actor_role, action,
          subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
          reason_code, reason_text, before_version, after_version, before_state,
          after_state, metadata_schema_version, metadata, source_snapshot_id,
          controlling_job_id, occurred_at)
       VALUES ($1,'HUMAN_COMMAND',$2,$3,'HUMAN',$4,$5,$6,$7,$8,$9,'M02',$10,$11,$12,$13,$14,$15,$16,
               '1',$17,$18,$19,$20)`,
      [
        audit.id,
        command.commandId,
        resultId,
        command.actorId,
        command.actorRole,
        audit.action,
        audit.subjectType,
        audit.subjectId,
        command.requestId,
        command.idempotencyKey,
        command.reasonCode,
        command.reason,
        audit.beforeVersion,
        audit.afterVersion,
        audit.beforeState === null ? null : JSON.stringify(audit.beforeState),
        audit.afterState === null ? null : JSON.stringify(audit.afterState),
        audit.metadata,
        context.source_snapshot_id,
        command.payload.jobId ?? null,
        command.timestamp,
      ],
    );
  }
}

async function projectTopology(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  resultId: string,
  auditId: string,
  subjects: TypedAuditSubject[],
  plan: CommandMutationPlanV1,
): Promise<void> {
  const plannedCreate = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.creates.find(
      (entry) => entry.table === table && entry.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const plannedSupersede = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.supersedes.find(
      (entry) => entry.table === table && entry.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const plannedUpdate = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.updates.find(
      (entry) => entry.table === table && entry.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const replacementGroupId = command.payload.replacementGroupId ?? "";
  const replacementRunId = command.payload.replacementRunId ?? "";
  const predecessor = await client.query<Record<string, unknown>>(
    `SELECT * FROM repository_candidate_groups WHERE id=$1`,
    [command.targetGroupId],
  );
  const group = predecessor.rows[0];
  if (group === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  const auditFor = (subject: TypedAuditSubject): string => {
    const id = nextSubjectAuditId(command, auditId, subjects);
    subjects.push(subject);
    return id;
  };
  const groupSupersessionAuditId = nextSubjectAuditId(command, auditId, subjects);
  const groupCreationAuditId = allocatedId(command, "auditIdsJson", subjects.length + 1);
  const runCreationAuditId = allocatedId(command, "auditIdsJson", subjects.length + 2);
  await client.query(
    `INSERT INTO repository_candidate_groups
       (id, source_snapshot_id, classification_policy_version, group_key, group_fingerprint,
        classification, ordered_candidate_root_ids, ordered_evidence_reference_ids,
        ordered_warning_codes, ordered_reason_codes, review_state, identity_policy_version,
        parser_profile_version, analysis_policy_version, prompt_bundle_version, state,
        supersedes_group_id, created_at, record_version, replacement_command_id,
        replacement_result_id, replacement_audit_event_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'[]','[]','[]','CLASSIFICATION_REVIEW_REQUIRED',$8,$9,$10,$11,'ACTIVE',$12,$13,1,$14,$15,$16)`,
    (() => {
      const row = plannedCreate("repository_candidate_groups", replacementGroupId);
      if (row.replacement_audit_event_id !== groupCreationAuditId)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      return [
        row.id,
        row.source_snapshot_id,
        row.classification_policy_version,
        row.group_key,
        row.group_fingerprint,
        row.classification,
        JSON.stringify(row.ordered_candidate_root_ids),
        row.identity_policy_version,
        row.parser_profile_version,
        row.analysis_policy_version,
        row.prompt_bundle_version,
        row.supersedes_group_id,
        row.created_at,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
      ];
    })(),
  );
  const groupUpdated = await client.query(
    `UPDATE repository_candidate_groups
     SET state='SUPERSEDED', superseded_by_group_id=$2, replacement_command_id=$3,
         replacement_result_id=$4, replacement_audit_event_id=$5,
         record_version=record_version+1 WHERE id=$1 AND state=$6 AND record_version=$7`,
    (() => {
      const row = plannedSupersede("repository_candidate_groups", command.targetGroupId);
      if (row.replacement_audit_event_id !== groupSupersessionAuditId)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      return [
        row.id,
        row.superseded_by_group_id,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
        group.state,
        Number(row.record_version) - 1,
      ];
    })(),
  );
  if (groupUpdated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  await client.query(
    `INSERT INTO repository_classification_runs
       (id, group_id, source_snapshot_id, run_source, classification, ordered_candidate_root_ids,
        ordered_evidence_reference_ids, ordered_warning_codes, ordered_reason_codes, review_state,
        classification_policy_version, identity_policy_version, analysis_policy_version,
        prompt_bundle_version, parser_profile_version, methodology_version, input_fingerprint,
        output_fingerprint, supersedes_run_id, created_at, replacement_command_id,
        replacement_result_id, replacement_audit_event_id)
     SELECT $1,$2,source_snapshot_id,'HUMAN_OVERRIDE',$3,$4,'[]','[]','[]',
       'CLASSIFICATION_REVIEW_REQUIRED',classification_policy_version,identity_policy_version,
       analysis_policy_version,prompt_bundle_version,parser_profile_version,methodology_version,
       $5,$6,id,$7,$8,$9,$10 FROM repository_classification_runs WHERE id=$11`,
    (() => {
      const row = plannedCreate("repository_classification_runs", replacementRunId);
      if (row.replacement_audit_event_id !== runCreationAuditId)
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      return [
        row.id,
        row.group_id,
        row.classification,
        JSON.stringify(row.ordered_candidate_root_ids),
        row.input_fingerprint,
        row.output_fingerprint,
        row.created_at,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
        row.supersedes_run_id,
      ];
    })(),
  );
  auditFor({
    action: "SUBJECT_SUPERSEDED",
    subjectType: "REPOSITORY_CANDIDATE_GROUP",
    subjectId: command.targetGroupId,
    beforeVersion: Number(group.record_version),
    afterVersion: Number(group.record_version) + 1,
    beforeState: "ACTIVE",
    afterState: "SUPERSEDED",
  });
  auditFor({
    action: "SUBJECT_CREATED",
    subjectType: "REPOSITORY_CANDIDATE_GROUP",
    subjectId: replacementGroupId,
  });
  auditFor({
    action: "SUBJECT_CREATED",
    subjectType: "REPOSITORY_CLASSIFICATION_RUN",
    subjectId: replacementRunId,
  });
  const roots =
    command.payload.replacementRootsJson === undefined
      ? (command.payload.replacementRootIds ?? "")
          .split(",")
          .filter(Boolean)
          .map((id, index) => ({
            id,
            normalizedPath:
              (JSON.parse(command.payload.selectedRootPathsJson ?? "[]") as string[])[index] ?? ".",
          }))
      : (JSON.parse(command.payload.replacementRootsJson) as {
          id: string;
          normalizedPath: string;
        }[]);
  const candidateIds = (command.payload.replacementCandidateIds ?? "").split(",").filter(Boolean);
  for (const [ordinal, root] of roots.entries()) {
    await client.query(
      `INSERT INTO candidate_roots
         (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path,
          candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload,
          canonical_content_payload, root_idempotency_key, state, record_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE',1)`,
      (() => {
        const row = plannedCreate("candidate_roots", root.id);
        return [
          row.id,
          row.group_id,
          row.classification_run_id,
          row.source_snapshot_id,
          row.normalized_root_path,
          row.candidate_root_fingerprint,
          row.candidate_content_fingerprint,
          Buffer.from(String(row.canonical_root_payload).slice(2), "hex"),
          Buffer.from(String(row.canonical_content_payload).slice(2), "hex"),
          row.root_idempotency_key,
        ];
      })(),
    );
    auditFor({ action: "SUBJECT_CREATED", subjectType: "CANDIDATE_ROOT", subjectId: root.id });
    await client.query(
      `INSERT INTO repository_candidate_root_order
         (id, group_id, classification_run_id, candidate_root_id, source_snapshot_id, root_ordinal, created_at, command_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      (() => {
        const row = plannedCreate(
          "repository_candidate_root_order",
          allocatedId(command, "rootOrderIdsJson", ordinal),
        );
        return [
          row.id,
          row.group_id,
          row.classification_run_id,
          row.candidate_root_id,
          row.source_snapshot_id,
          row.root_ordinal,
          row.created_at,
          row.command_id,
        ];
      })(),
    );
    auditFor({
      action: "SUBJECT_CREATED",
      subjectType: "REPOSITORY_CANDIDATE_ROOT_ORDER",
      subjectId: allocatedId(command, "rootOrderIdsJson", ordinal),
    });
    const candidateId = candidateIds[ordinal] ?? candidateIds[0];
    if (candidateId !== undefined) {
      const candidateCreationAuditId = nextSubjectAuditId(command, auditId, subjects);
      await client.query(
        `INSERT INTO resource_candidates
           (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
            candidate_content_fingerprint, reconciled_classification_run_id,
            classification_policy_version, identity_policy_version, ordered_provenance,
            candidate_idempotency_key, status, created_at, updated_at, record_version,
            creation_command_id,creation_result_id,creation_audit_event_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'IDENTITY_REVIEW_REQUIRED',$11,$11,1,$12,$13,$14)`,
        (() => {
          const row = plannedCreate("resource_candidates", candidateId);
          if (row.creation_audit_event_id !== candidateCreationAuditId)
            throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
          return [
            row.id,
            row.source_snapshot_id,
            row.candidate_root_id,
            row.candidate_root_fingerprint,
            row.candidate_content_fingerprint,
            row.reconciled_classification_run_id,
            row.classification_policy_version,
            row.identity_policy_version,
            JSON.stringify(row.ordered_provenance),
            row.candidate_idempotency_key,
            row.created_at,
            row.creation_command_id,
            row.creation_result_id,
            row.creation_audit_event_id,
          ];
        })(),
      );
      const edgeRow = plannedCreate(
        "repository_group_relationships",
        allocatedId(command, "groupEdgeIdsJson", ordinal),
      );
      await client.query(
        `INSERT INTO repository_group_relationships (id,parent_group_id,child_candidate_id,relationship_type,relationship_order,command_id) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          edgeRow.id,
          edgeRow.parent_group_id,
          edgeRow.child_candidate_id,
          edgeRow.relationship_type,
          edgeRow.relationship_order,
          edgeRow.command_id,
        ],
      );
      auditFor({
        action: "SUBJECT_CREATED",
        subjectType: "RESOURCE_CANDIDATE",
        subjectId: candidateId,
      });
      auditFor({
        action: "SUBJECT_CREATED",
        subjectType: "REPOSITORY_GROUP_RELATIONSHIP",
        subjectId: allocatedId(command, "groupEdgeIdsJson", ordinal),
      });
      await client.query(
        `INSERT INTO m02_review_states
           (id, resource_candidate_id, review_state, source_snapshot_id, controlling_job_id, record_version)
         VALUES ($1,$2,'IDENTITY_REVIEW_REQUIRED',$3,$4,1)`,
        (() => {
          const row = plannedCreate(
            "m02_review_states",
            allocatedId(command, "reviewIdsJson", ordinal),
          );
          return [
            row.id,
            row.resource_candidate_id,
            row.source_snapshot_id,
            row.controlling_job_id,
          ];
        })(),
      );
      auditFor({
        action: "SUBJECT_CREATED",
        subjectType: "M02_REVIEW_STATE",
        subjectId: allocatedId(command, "reviewIdsJson", ordinal),
      });
    }
  }
  const originalCandidateIds = (command.payload.originalCandidateIds ?? "")
    .split(",")
    .filter(Boolean);
  const originalRootIds = (command.payload.originalRootIds ?? "").split(",").filter(Boolean);
  for (const [index, originalCandidateId] of originalCandidateIds.entries()) {
    const candidateBeforeResult = await client.query<{
      identity_outcome: string | null;
      record_version: string;
      resource_identity_id: string | null;
      resource_version_identity_id: string | null;
      status: string;
    }>(
      `SELECT identity_outcome,record_version,resource_identity_id,
              resource_version_identity_id,status
       FROM resource_candidates WHERE id=$1 FOR UPDATE`,
      [originalCandidateId],
    );
    const candidateBefore = candidateBeforeResult.rows[0];
    if (candidateBefore === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
    const predecessorAuditResult = await client.query<{ after_state: string }>(
      `SELECT audit.after_state
       FROM identity_decisions decision
       JOIN m02_audit_events audit
         ON audit.subject_type='RESOURCE_CANDIDATE'
        AND audit.subject_id=decision.resource_candidate_id
        AND audit.action='SUBJECT_UPDATED'
        AND audit.command_id IS NOT DISTINCT FROM decision.command_id
        AND audit.result_id IS NOT DISTINCT FROM decision.result_id
        AND audit.system_operation_id IS NOT DISTINCT FROM decision.system_operation_id
        AND audit.system_result_id IS NOT DISTINCT FROM decision.system_result_id
       WHERE decision.resource_candidate_id=$1 AND decision.state='ACTIVE'
       ORDER BY convert_to(decision.id,'UTF8')`,
      [originalCandidateId],
    );
    const successorCandidateId = candidateIds[index] ?? candidateIds[0] ?? null;
    const beforeVersion = Number(candidateBefore.record_version);
    const audit = auditFor({
      action: "SUBJECT_SUPERSEDED",
      subjectType: "RESOURCE_CANDIDATE",
      subjectId: originalCandidateId,
      beforeVersion,
      afterVersion: beforeVersion + 1,
      beforeState:
        predecessorAuditResult.rows[0]?.after_state ??
        canonicalState({
          identityOutcome: candidateBefore.identity_outcome,
          recordVersion: beforeVersion,
          resourceIdentityId: candidateBefore.resource_identity_id,
          resourceVersionIdentityId: candidateBefore.resource_version_identity_id,
          status: candidateBefore.status,
        }),
      afterState: canonicalState({
        identityOutcome: candidateBefore.identity_outcome,
        recordVersion: beforeVersion + 1,
        resourceIdentityId: candidateBefore.resource_identity_id,
        resourceVersionIdentityId: candidateBefore.resource_version_identity_id,
        status: "SUPERSEDED",
        supersededById: successorCandidateId,
        terminalReasonCode: "TOPOLOGY_SUPERSEDED",
      }),
      metadata: { successorId: successorCandidateId },
    });
    const candidateIntent = plannedSupersede("resource_candidates", originalCandidateId);
    if (candidateIntent.replacement_audit_event_id !== audit)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const updated = await client.query(
      `UPDATE resource_candidates
       SET status='SUPERSEDED', terminal_reason_code='TOPOLOGY_SUPERSEDED',
           superseded_by_candidate_id=$2, replacement_command_id=$3,
           replacement_result_id=$4, replacement_audit_event_id=$5,
           record_version=record_version+1
       WHERE id=$1 AND record_version=$6`,
      [
        candidateIntent.id,
        candidateIntent.superseded_by_candidate_id,
        candidateIntent.replacement_command_id,
        candidateIntent.replacement_result_id,
        candidateIntent.replacement_audit_event_id,
        Number(candidateIntent.record_version) - 1,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("REFERENCE_INVALID");
  }
  for (const originalRootId of originalRootIds) {
    const audit = auditFor({
      action: "SUBJECT_SUPERSEDED",
      subjectType: "CANDIDATE_ROOT",
      subjectId: originalRootId,
      beforeVersion: 1,
      afterVersion: 2,
      beforeState: "ACTIVE",
      afterState: "SUPERSEDED",
    });
    const row = plannedSupersede("candidate_roots", originalRootId);
    if (row.replacement_audit_event_id !== audit)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const updated = await client.query(
      `UPDATE candidate_roots SET state='SUPERSEDED', superseded_by_root_id=$2, replacement_command_id=$3, replacement_result_id=$4, replacement_audit_event_id=$5, record_version=record_version+1 WHERE id=$1 AND state=$6 AND record_version=$7`,
      [
        row.id,
        row.superseded_by_root_id,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
        "ACTIVE",
        Number(row.record_version) - 1,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  }
  const priorDecisions =
    originalCandidateIds.length === 0
      ? { rows: [] }
      : await client.query<{ id: string; record_version: string }>(
          `SELECT id,record_version FROM identity_decisions WHERE resource_candidate_id = ANY($1::text[]) AND state='ACTIVE' ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
          [originalCandidateIds],
        );
  for (const decision of priorDecisions.rows) {
    const before = Number(decision.record_version);
    const audit = auditFor({
      action: "SUBJECT_SUPERSEDED",
      subjectType: "IDENTITY_DECISION",
      subjectId: decision.id,
      beforeVersion: before,
      afterVersion: before + 1,
      beforeState: "ACTIVE",
      afterState: "SUPERSEDED",
    });
    const row = plannedSupersede("identity_decisions", decision.id);
    if (row.replacement_audit_event_id !== audit)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const updated = await client.query(
      `UPDATE identity_decisions SET state='SUPERSEDED',replacement_command_id=$2,replacement_result_id=$3,replacement_audit_event_id=$4,record_version=record_version+1 WHERE id=$1 AND state=$5 AND record_version=$6`,
      [
        row.id,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
        "ACTIVE",
        Number(row.record_version) - 1,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  }
  const priorReviews = await client.query<{
    id: string;
    record_version: string;
    review_state: string;
    resource_candidate_id: string | null;
  }>(
    `SELECT id,record_version,review_state,resource_candidate_id FROM m02_review_states WHERE (resource_candidate_id = ANY($1::text[]) OR ($2::boolean AND group_id=$3)) AND review_state IN ('IDENTITY_REVIEW_REQUIRED','CLARIFICATION_REQUESTED','CLASSIFICATION_REVIEW_REQUIRED') ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
    [
      originalCandidateIds,
      effectiveCommand(command) === "OVERRIDE_NON_SKILL",
      command.targetGroupId,
    ],
  );
  for (const review of priorReviews.rows) {
    const before = Number(review.record_version);
    const audit = auditFor({
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_REVIEW_STATE",
      subjectId: review.id,
      beforeVersion: before,
      afterVersion: before + 1,
      beforeState: review.review_state,
      afterState: "SUPERSEDED",
    });
    const row = plannedSupersede("m02_review_states", review.id);
    if (row.replacement_audit_event_id !== audit)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const updated = await client.query(
      `UPDATE m02_review_states SET review_state='SUPERSEDED',terminal_reason_code='TOPOLOGY_SUPERSEDED',superseded_by_review_id=$2,replacement_command_id=$3,replacement_result_id=$4,replacement_audit_event_id=$5,record_version=record_version+1 WHERE id=$1 AND review_state=$6 AND record_version=$7`,
      [
        row.id,
        row.superseded_by_review_id,
        row.replacement_command_id,
        row.replacement_result_id,
        row.replacement_audit_event_id,
        review.review_state,
        Number(row.record_version) - 1,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  }

  const ownership = JSON.parse(command.payload.replacementOwnershipJson ?? "[]") as {
    rootId: string;
    sourceEntryId: string;
    ownership: string;
  }[];
  const successorOwnership: { id: string; sourceEntryId: string }[] = [];
  for (const [index, fact] of ownership.entries()) {
    const id = allocatedId(command, "ownershipIdsJson", index);
    const row = plannedCreate("candidate_root_ownership", id);
    await client.query(
      `INSERT INTO candidate_root_ownership (id,candidate_root_id,source_snapshot_id,source_entry_id,ownership,command_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        row.id,
        row.candidate_root_id,
        row.source_snapshot_id,
        row.source_entry_id,
        row.ownership,
        row.command_id,
      ],
    );
    auditFor({ action: "SUBJECT_CREATED", subjectType: "CANDIDATE_ROOT_OWNERSHIP", subjectId: id });
    successorOwnership.push({ id, sourceEntryId: fact.sourceEntryId });
  }

  const replacementKind =
    effectiveCommand(command) === "SPLIT_ROOTS"
      ? "SPLIT"
      : effectiveCommand(command) === "MERGE_ROOTS"
        ? "MERGE"
        : "CREATED";
  const rootPairs =
    originalRootIds.length === 0
      ? roots.map((root) => [null, root.id] as const)
      : originalRootIds.flatMap((oldId) => roots.map((root) => [oldId, root.id] as const));
  for (const [index, [oldId, newId]] of rootPairs.entries()) {
    const id = allocatedId(command, "rootReplacementIdsJson", index);
    const audit = auditFor({
      action: "SUBJECT_CREATED",
      subjectType: "ROOT_REPLACEMENT",
      subjectId: id,
      metadata: {
        replacementKind,
        ...(oldId === null ? {} : { predecessorRootId: oldId }),
        successorRootId: newId,
      },
    });
    const row = plannedCreate("m02_root_replacements", id);
    if (row.audit_event_id !== audit) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_root_replacements (id,predecessor_root_id,successor_root_id,replacement_kind,command_id,result_id,audit_event_id,predecessor_ordinal,successor_ordinal,reason,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id,
        row.predecessor_root_id,
        row.successor_root_id,
        row.replacement_kind,
        row.command_id,
        row.result_id,
        row.audit_event_id,
        row.predecessor_ordinal,
        row.successor_ordinal,
        row.reason,
        row.created_at,
      ],
    );
  }
  const candidatePairs =
    originalCandidateIds.length === 0
      ? candidateIds.map((id) => [null, id] as const)
      : originalCandidateIds.flatMap((oldId) => candidateIds.map((id) => [oldId, id] as const));
  for (const [index, [oldId, newId]] of candidatePairs.entries()) {
    const id = allocatedId(command, "candidateReplacementIdsJson", index);
    const audit = auditFor({
      action: "SUBJECT_CREATED",
      subjectType: "CANDIDATE_REPLACEMENT",
      subjectId: id,
      metadata: {
        replacementKind,
        ...(oldId === null ? {} : { predecessorCandidateId: oldId }),
        successorCandidateId: newId,
      },
    });
    const row = plannedCreate("m02_candidate_replacements", id);
    if (row.audit_event_id !== audit) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_candidate_replacements (id,predecessor_candidate_id,successor_candidate_id,replacement_kind,command_id,result_id,audit_event_id,reason,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.id,
        row.predecessor_candidate_id,
        row.successor_candidate_id,
        row.replacement_kind,
        row.command_id,
        row.result_id,
        row.audit_event_id,
        row.reason,
        row.created_at,
      ],
    );
  }

  const predecessorOwnership =
    originalRootIds.length === 0
      ? { rows: [] }
      : await client.query<{ id: string; source_entry_id: string }>(
          `SELECT id,source_entry_id FROM candidate_root_ownership WHERE candidate_root_id = ANY($1::text[]) ORDER BY convert_to(id,'UTF8')`,
          [originalRootIds],
        );
  const predecessorSourceEntries = new Set(
    predecessorOwnership.rows.map(({ source_entry_id }) => source_entry_id),
  );
  const ownershipPairs: {
    predecessor: { id: string; source_entry_id: string } | null;
    successor: { id: string; sourceEntryId: string } | null;
  }[] = [];
  for (const predecessor of predecessorOwnership.rows) {
    const matches = successorOwnership.filter(
      ({ sourceEntryId }) => sourceEntryId === predecessor.source_entry_id,
    );
    if (matches.length === 0) ownershipPairs.push({ predecessor, successor: null });
    else for (const successor of matches) ownershipPairs.push({ predecessor, successor });
  }
  for (const successor of successorOwnership)
    if (!predecessorSourceEntries.has(successor.sourceEntryId))
      ownershipPairs.push({ predecessor: null, successor });
  for (const [index, { predecessor, successor }] of ownershipPairs.entries()) {
    const successorId = successor?.id ?? null;
    const id = allocatedId(command, "ownershipReplacementIdsJson", index);
    const ownershipKind =
      predecessor === null ? "CREATED" : successor === null ? "RETIRED" : "RETAINED";
    const audit = auditFor({
      action: "SUBJECT_CREATED",
      subjectType: "OWNERSHIP_REPLACEMENT",
      subjectId: id,
      metadata: {
        replacementKind: ownershipKind,
        ...(predecessor === null ? {} : { predecessorOwnershipId: predecessor.id }),
        ...(successorId === null ? {} : { successorOwnershipId: successorId }),
      },
    });
    const row = plannedCreate("m02_ownership_replacements", id);
    if (row.audit_event_id !== audit) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_ownership_replacements (id,predecessor_ownership_id,successor_ownership_id,replacement_kind,command_id,result_id,audit_event_id,created_at,source_entry_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.id,
        row.predecessor_ownership_id,
        row.successor_ownership_id,
        row.replacement_kind,
        row.command_id,
        row.result_id,
        row.audit_event_id,
        row.created_at,
        row.source_entry_id,
      ],
    );
  }

  const predecessorEdges = await client.query<{ id: string }>(
    `SELECT id FROM repository_group_relationships WHERE parent_group_id=$1 ORDER BY convert_to(id,'UTF8')`,
    [command.targetGroupId],
  );
  const successorEdgeIds = candidateIds.map((_, index) =>
    allocatedId(command, "groupEdgeIdsJson", index),
  );
  const edgePairs =
    predecessorEdges.rows.length === 0
      ? successorEdgeIds.map((id) => [null, id] as const)
      : predecessorEdges.rows.flatMap((old) => successorEdgeIds.map((id) => [old.id, id] as const));
  for (const [index, [oldId, newId]] of edgePairs.entries()) {
    const id = allocatedId(command, "edgeReplacementIdsJson", index);
    const edgeKind = oldId === null ? "CREATED" : "REASSIGNED";
    const audit = auditFor({
      action: "SUBJECT_CREATED",
      subjectType: "GROUP_EDGE_REPLACEMENT",
      subjectId: id,
      metadata: {
        replacementKind: edgeKind,
        ...(oldId === null ? {} : { predecessorEdgeId: oldId }),
        successorEdgeId: newId,
      },
    });
    const row = plannedCreate("m02_group_edge_replacements", id);
    if (row.audit_event_id !== audit) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_group_edge_replacements (id,predecessor_group_edge_id,successor_group_edge_id,replacement_kind,command_id,result_id,audit_event_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.id,
        row.predecessor_group_edge_id,
        row.successor_group_edge_id,
        row.replacement_kind,
        row.command_id,
        row.result_id,
        row.audit_event_id,
        row.created_at,
      ],
    );
  }
  const jobId = command.payload.jobId;
  if (jobId !== undefined) {
    const acquisition = plannedUpdate("acquisition_jobs", jobId);
    const acquisitionBeforeVersion = Number(acquisition.record_version) - 1;
    const acquisitionUpdated = await client.query(
      `UPDATE acquisition_jobs
       SET status=$2, record_version=record_version+1
       WHERE id=$1 AND record_version=$3`,
      [acquisition.id, acquisition.status, acquisitionBeforeVersion],
    );
    if (acquisitionUpdated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    auditFor({
      action: "SUBJECT_UPDATED",
      subjectType: "ACQUISITION_JOB",
      subjectId: jobId,
      beforeVersion: acquisitionBeforeVersion,
      afterVersion: Number(acquisition.record_version),
      beforeState: canonicalState({
        recordVersion: acquisitionBeforeVersion,
        status: "OPERATOR_REVIEW_REQUIRED",
      }),
      afterState: canonicalState({
        recordVersion: Number(acquisition.record_version),
        status: acquisition.status,
      }),
    });

    const job = plannedUpdate("m02_jobs", jobId);
    const jobBeforeVersion = Number(job.record_version) - 1;
    const jobUpdated = await client.query(
      `UPDATE m02_jobs
       SET review_state=$2, record_version=record_version+1
       WHERE id=$1 AND record_version=$3`,
      [job.id, job.review_state, jobBeforeVersion],
    );
    if (jobUpdated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    auditFor({
      action: "SUBJECT_UPDATED",
      subjectType: "M02_JOB",
      subjectId: jobId,
      beforeVersion: jobBeforeVersion,
      afterVersion: Number(job.record_version),
      beforeState: canonicalState({
        currentStage: job.current_stage,
        recordVersion: jobBeforeVersion,
        reviewState: "IDENTITY_REVIEW_REQUIRED",
      }),
      afterState: canonicalState({
        currentStage: job.current_stage,
        recordVersion: Number(job.record_version),
        reviewState: job.review_state,
      }),
      metadata: { scope: job.operation_scope, guardKey: job.job_scope_key },
    });
  }
  void resultId;
  void auditId;
}

async function projectReplacementJob(
  client: PoolClient,
  command: ManualResolutionEnvelope,
  subjects: TypedAuditSubject[],
  plan: CommandMutationPlanV1,
): Promise<void> {
  const plannedAuditId = (
    action: PlannedAudit["action"],
    subjectType: string,
    subjectId: string,
  ): string => {
    const audit = plan.domainMutationPlan.audits.find(
      (candidate) =>
        candidate.action === action &&
        candidate.subjectType === subjectType &&
        candidate.subjectId === subjectId,
    );
    if (audit === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return audit.id;
  };
  const plannedCreate = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.creates.find(
      (entry) => entry.table === table && entry.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const plannedSupersede = (table: string, id: string): Readonly<Record<string, unknown>> => {
    const row = plan.domainMutationPlan.supersedes.find(
      (entry) => entry.table === table && entry.id === id,
    );
    if (row === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return row.completeTypedValues;
  };
  const sourceJobId = command.payload.sourceJobId ?? "";
  const replacementJobId = command.payload.replacementJobId ?? "";
  const source = await client.query<{
    job_lineage_id: string;
    source_snapshot_id: string;
    supersession_sequence: string;
    operation_scope: string;
    parser_profile_version: string;
    controlling_classification_decision_id: string | null;
    analysis_provider_adapter_id: string | null;
    analysis_model_id: string | null;
    analysis_methodology_version: string | null;
  }>(
    `SELECT job_lineage_id,source_snapshot_id,supersession_sequence,operation_scope,
            parser_profile_version,controlling_classification_decision_id,
            analysis_provider_adapter_id,analysis_model_id,analysis_methodology_version
     FROM m02_jobs WHERE id=$1`,
    [sourceJobId],
  );
  const sourceRow = source.rows[0];
  if (sourceRow === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
  const requestedScope = command.payload.requestedOperationScope ?? "";
  const invalidatedScopes =
    requestedScope === "FULL_PIPELINE"
      ? ["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"]
      : requestedScope === "CLASSIFICATION"
        ? ["CLASSIFICATION", "IDENTITY_RESOLUTION"]
        : ["IDENTITY_RESOLUTION"];
  const predecessors = await client.query<{
    id: string;
    operation_scope: string;
    record_version: string;
    acquisition_record_version: string;
    supersession_sequence: string;
  }>(
    `SELECT job.id,job.operation_scope,job.record_version,
            acquisition.record_version AS acquisition_record_version,
            job.supersession_sequence
     FROM m02_jobs job JOIN acquisition_jobs acquisition ON acquisition.id=job.id
     WHERE job.job_lineage_id=$1 AND job.supersession_state='CONTROLLING'
       AND job.operation_scope=ANY($2::text[])
     ORDER BY convert_to(job.id,'UTF8') FOR UPDATE OF job,acquisition`,
    [sourceRow.job_lineage_id, invalidatedScopes],
  );
  const predecessorIds = predecessors.rows.map(({ id }) => id).sort(compareUtf8);
  const replacementInput = canonicalM02JsonBytes({
    schemaVersion: "1",
    jobLineageId: sourceRow.job_lineage_id,
    sourceJobId,
    sourceOperationScope: sourceRow.operation_scope,
    requestedOperationScope: command.payload.requestedOperationScope ?? "",
    predecessorJobIds: predecessorIds,
    sourceSnapshotId: sourceRow.source_snapshot_id,
    replacementSourceSnapshotIdOrNull: command.payload.replacementSnapshotId ?? null,
    classificationPolicyVersion: command.payload.classificationPolicyVersion ?? "",
    identityPolicyVersion: command.payload.identityPolicyVersion ?? "",
    analysisPolicyVersion: command.payload.analysisPolicyVersion ?? "",
    parserProfileVersion: sourceRow.parser_profile_version,
    promptBundleVersion: command.payload.promptBundleVersion ?? "",
    analysisProviderAdapterIdOrNull: sourceRow.analysis_provider_adapter_id,
    analysisModelIdOrNull: sourceRow.analysis_model_id,
    analysisMethodologyVersionOrNull: sourceRow.analysis_methodology_version,
    controllingClassificationDecisionIdOrNull: sourceRow.controlling_classification_decision_id,
  });
  const replacementInputFingerprint = hash(replacementInput);
  if (replacementInputFingerprint !== command.payload.replacementInputFingerprint)
    throw new ManualResolutionError("REFERENCE_INVALID");
  for (const predecessor of predecessors.rows) {
    const expectedJobVersion = command.expectedVersions[`row:m02_jobs:${predecessor.id}`];
    const expectedAcquisitionVersion =
      command.expectedVersions[`row:acquisition_jobs:${predecessor.id}`];
    if (
      expectedJobVersion === null ||
      expectedJobVersion === undefined ||
      expectedAcquisitionVersion === null ||
      expectedAcquisitionVersion === undefined
    )
      throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
    const acquisitionIntent = plannedSupersede("acquisition_jobs", predecessor.id);
    const acquisitionUpdate = await client.query(
      `UPDATE acquisition_jobs SET record_version=record_version+1
       WHERE id=$1 AND record_version=$2`,
      [acquisitionIntent.id, expectedAcquisitionVersion],
    );
    if (acquisitionUpdate.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    subjects.push({
      auditId: plannedAuditId("SUBJECT_UPDATED", "ACQUISITION_JOB", predecessor.id),
      action: "SUBJECT_UPDATED",
      subjectType: "ACQUISITION_JOB",
      subjectId: predecessor.id,
      beforeVersion: expectedAcquisitionVersion,
      afterVersion: expectedAcquisitionVersion + 1,
      beforeState: canonicalState({
        recordVersion: expectedAcquisitionVersion,
        status: String(acquisitionIntent.status),
      }),
      afterState: canonicalState({
        recordVersion: expectedAcquisitionVersion + 1,
        status: String(acquisitionIntent.status),
      }),
    });
    const jobIntent = plannedSupersede("m02_jobs", predecessor.id);
    const jobUpdate = await client.query(
      `UPDATE m02_jobs
       SET supersession_state='SUPERSEDED', superseded_by_job_id=$2,
           record_version=record_version+1
       WHERE id=$1 AND record_version=$3`,
      [jobIntent.id, jobIntent.superseded_by_job_id, expectedJobVersion],
    );
    if (jobUpdate.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
  }
  const acquisitionCreate = plannedCreate("acquisition_jobs", replacementJobId);
  await client.query(
    `INSERT INTO acquisition_jobs
       (id, submission_id, idempotency_key, status, current_stage, attempt,
        source_snapshot_id, completed_stages, warnings, failure, cancellation_requested, record_version)
     SELECT $1, submission_id, $2, 'ACTIVE', current_stage, attempt + 1, $3,
       completed_stages, warnings, NULL, false, 1 FROM acquisition_jobs WHERE id=$4`,
    [
      acquisitionCreate.id,
      acquisitionCreate.idempotency_key,
      acquisitionCreate.source_snapshot_id,
      sourceJobId,
    ],
  );
  const jobCreate = plannedCreate("m02_jobs", replacementJobId);
  await client.query(
    `INSERT INTO m02_jobs
       (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage,
        review_state, supersession_state, supersession_sequence, job_scope_key,
        input_fingerprint, classification_policy_version, identity_policy_version,
        analysis_policy_version,parser_profile_version,prompt_bundle_version,
        replacement_reason_code,replacement_input_payload,replacement_input_fingerprint,
        replacement_source_job_id,replacement_source_operation_scope,
        replacement_requested_operation_scope,replacement_predecessor_job_ids,
        replacement_original_source_snapshot_id,replacement_source_snapshot_id,
        analysis_provider_adapter_id,analysis_model_id,analysis_methodology_version,
        controlling_classification_decision_id,record_version)
     VALUES ($1,$2,$3,$4,'CLASSIFYING_REPOSITORY','NOT_REQUIRED','CONTROLLING',$5,$6,$7,
       $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,1)`,
    [
      jobCreate.id,
      jobCreate.job_lineage_id,
      jobCreate.source_snapshot_id,
      jobCreate.operation_scope,
      jobCreate.supersession_sequence,
      jobCreate.job_scope_key,
      jobCreate.input_fingerprint,
      jobCreate.classification_policy_version,
      jobCreate.identity_policy_version,
      jobCreate.analysis_policy_version,
      jobCreate.parser_profile_version,
      jobCreate.prompt_bundle_version,
      jobCreate.replacement_reason_code,
      Buffer.from(String(jobCreate.replacement_input_payload).slice(2), "hex"),
      jobCreate.replacement_input_fingerprint,
      jobCreate.replacement_source_job_id,
      jobCreate.replacement_source_operation_scope,
      jobCreate.replacement_requested_operation_scope,
      jobCreate.replacement_predecessor_job_ids,
      jobCreate.replacement_original_source_snapshot_id,
      jobCreate.replacement_source_snapshot_id,
      jobCreate.analysis_provider_adapter_id,
      jobCreate.analysis_model_id,
      jobCreate.analysis_methodology_version,
      jobCreate.controlling_classification_decision_id,
    ],
  );
  for (const [index, predecessor] of predecessors.rows.entries()) {
    const guardKey = canonicalGuard("JOB_SCOPE_CONTROLLER", {
      jobLineageId: sourceRow.job_lineage_id,
      operationScope: predecessor.operation_scope,
    }).key;
    const guard = await client.query(`SELECT 1 FROM m02_concurrency_guards WHERE guard_key=$1`, [
      guardKey,
    ]);
    if (guard.rowCount !== 1) throw new ManualResolutionError("REFERENCE_INVALID");
    const supersessionIds = JSON.parse(
      command.payload.replacementSupersessionIdsJson ?? "[]",
    ) as string[];
    const supersessionAuditIds = JSON.parse(
      command.payload.replacementSupersessionAuditIdsJson ?? "[]",
    ) as string[];
    const supersessionId = supersessionIds[index];
    const supersessionAuditId = supersessionAuditIds[index];
    if (supersessionId === undefined || supersessionAuditId === undefined)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    await client.query(
      `INSERT INTO m02_job_supersessions
         (id, command_id, result_id, audit_event_id, guard_key, source_job_id,
          replacement_job_id, job_lineage_id, operation_scope, supersession_state,
          reason_code, actor_id, actor_role, evidence_ids, supersession_sequence, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'SUPERSEDED',$10,$11,$12,$13,$14,$15)`,
      (() => {
        const row = plannedCreate("m02_job_supersessions", supersessionId);
        if (row.audit_event_id !== supersessionAuditId || row.guard_key !== guardKey)
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        return [
          row.id,
          row.command_id,
          row.result_id,
          row.audit_event_id,
          row.guard_key,
          row.source_job_id,
          row.replacement_job_id,
          row.job_lineage_id,
          row.operation_scope,
          row.reason_code,
          row.actor_id,
          row.actor_role,
          JSON.stringify(row.evidence_ids),
          row.supersession_sequence,
          row.created_at,
        ];
      })(),
    );
    subjects.push({
      auditId: supersessionAuditId,
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_JOB",
      subjectId: predecessor.id,
      beforeVersion: Number(predecessor.record_version),
      afterVersion: Number(predecessor.record_version) + 1,
      beforeState: "CONTROLLING",
      afterState: "SUPERSEDED",
      metadata: { scope: predecessor.operation_scope, guardKey },
    });
  }
  const activeHandoffs = await client.query<{ id: string; record_version: string }>(
    `SELECT id,record_version FROM m02_identity_handoff_markers
     WHERE controlling_m02_job_id=ANY($1::text[]) AND state='ACTIVE'
     ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
    [predecessors.rows.map((row) => row.id)],
  );
  for (const handoff of activeHandoffs.rows) {
    const intent = plannedSupersede("m02_identity_handoff_markers", handoff.id);
    const updated = await client.query(
      `UPDATE m02_identity_handoff_markers
       SET state=$2,controlling_job_state=$3,record_version=$4
       WHERE id=$1 AND state='ACTIVE' AND record_version=$5`,
      [
        intent.id,
        intent.state,
        intent.controlling_job_state,
        intent.record_version,
        Number(intent.record_version) - 1,
      ],
    );
    if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
    subjects.push({
      auditId: plannedAuditId("SUBJECT_SUPERSEDED", "M02_IDENTITY_HANDOFF", handoff.id),
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_IDENTITY_HANDOFF",
      subjectId: handoff.id,
      beforeVersion: Number(handoff.record_version),
      afterVersion: Number(handoff.record_version) + 1,
      beforeState: "ACTIVE",
      afterState: "SUPERSEDED",
    });
  }
  const clarifications = await client.query<{
    id: string;
    record_version: string;
    target_classification_run_id: string | null;
    target_identity_decision_id: string | null;
    target_rejection_decision_id: string | null;
  }>(
    `SELECT id,record_version,target_classification_run_id,target_identity_decision_id,
            target_rejection_decision_id
     FROM m02_clarification_requests
     WHERE controlling_job_id = ANY($1::text[]) AND state='OPEN'
     ORDER BY convert_to(id,'UTF8') FOR UPDATE`,
    [predecessors.rows.map((row) => row.id)],
  );
  for (const clarification of clarifications.rows) {
    const before = Number(clarification.record_version);
    const clarificationAuditId = plannedAuditId(
      "SUBJECT_SUPERSEDED",
      "M02_CLARIFICATION_REQUEST",
      clarification.id,
    );
    const intent = plannedSupersede("m02_clarification_requests", clarification.id);
    if (intent.resolution_audit_event_id !== clarificationAuditId)
      throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    const clarificationMetadata =
      clarification.target_classification_run_id !== null
        ? {
            clarificationTargetType: "CLASSIFICATION",
            clarificationTargetId: clarification.target_classification_run_id,
          }
        : clarification.target_identity_decision_id !== null
          ? {
              clarificationTargetType: "IDENTITY",
              clarificationTargetId: clarification.target_identity_decision_id,
            }
          : {
              clarificationTargetType: "REJECTION",
              clarificationTargetId: clarification.target_rejection_decision_id ?? "",
            };
    subjects.push({
      action: "SUBJECT_SUPERSEDED",
      subjectType: "M02_CLARIFICATION_REQUEST",
      subjectId: clarification.id,
      beforeVersion: before,
      afterVersion: before + 1,
      beforeState: "OPEN",
      afterState: "SUPERSEDED",
      metadata: clarificationMetadata,
    });
    await client.query(
      `UPDATE m02_clarification_requests
       SET state=$2,resolution_command_id=$3,resolution_result_id=$4,
           resolution_audit_event_id=$5,superseded_by_command_id=$6,resolved_at=$7,
           record_version=$8 WHERE id=$1 AND state='OPEN' AND record_version=$9`,
      [
        intent.id,
        intent.state,
        intent.resolution_command_id,
        intent.resolution_result_id,
        intent.resolution_audit_event_id,
        intent.superseded_by_command_id,
        intent.resolved_at,
        intent.record_version,
        Number(intent.record_version) - 1,
      ],
    );
  }
  const replacementScope = command.payload.requestedOperationScope ?? "";
  subjects.push({
    auditId: plannedAuditId("SUBJECT_CREATED", "ACQUISITION_JOB", replacementJobId),
    action: "SUBJECT_CREATED",
    subjectType: "ACQUISITION_JOB",
    subjectId: replacementJobId,
  });
  subjects.push({
    auditId: plannedAuditId("SUBJECT_CREATED", "M02_JOB", replacementJobId),
    action: "SUBJECT_CREATED",
    subjectType: "M02_JOB",
    subjectId: replacementJobId,
    metadata: {
      scope: replacementScope,
      guardKey: canonicalGuard("JOB_SCOPE_CONTROLLER", {
        jobLineageId: sourceRow.job_lineage_id,
        operationScope: replacementScope,
      }).key,
    },
  });
}
