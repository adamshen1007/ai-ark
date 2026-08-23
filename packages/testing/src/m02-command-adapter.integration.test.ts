import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { canonicalJson, type JsonValue } from "@ai-ark/contracts";
import {
  PostgresManualResolutionAdapter,
  canonicalOrderedTargetIds,
  canonicalGuard,
  humanProjectionModes,
  validateManualResolutionEnvelope,
  type CommandMutationPlanV1,
  type HumanProjectionMode,
  type ManualResolutionEnvelope,
} from "@ai-ark/job-queue";
import {
  ManualResolutionCoordinator,
  deriveRequiredExpectedVersionKeys,
  manualResolutionPayloadKeys,
  type IdentityManualResolutionCommand,
} from "@ai-ark/identity";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EphemeralPostgresHarness } from "./postgres-harness.js";
import { ExecutedReceiptCollector } from "./m02-executed-receipts.js";
import { seedM02ProductionGraph } from "./m02-postgres-fixture.js";

const migration001Url = new URL(
  "../../job-queue/migrations/001_m01_acquisition_jobs.sql",
  import.meta.url,
);
const migration002Url = new URL(
  "../../job-queue/migrations/002_m02_classification_identity.sql",
  import.meta.url,
);
const typedProjectorUrl = new URL("../../job-queue/src/m02-typed-state.ts", import.meta.url);
const humanProjectorUrl = new URL("../../job-queue/src/m02-human-projectors.ts", import.meta.url);
const commandPlanUrl = new URL("../../job-queue/src/m02-human-command-plan.ts", import.meta.url);
const postgresAdapterUrl = new URL(
  "../../job-queue/src/postgres-manual-resolution.ts",
  import.meta.url,
);
const harness = new EphemeralPostgresHarness();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const GOLDEN_P1_CANDIDATE_ID = "00000000-0000-7000-8000-000000000101";
const GOLDEN_P1_JOB_ID = "00000000-0000-7000-8000-000000000102";
const GOLDEN_P1_REVIEW_ID = "00000000-0000-7000-8000-000000000103";
const GOLDEN_P1_DECISION_ID = "00000000-0000-7000-8000-000000000104";

interface ExpectedFixtureEvidence {
  readonly id: string;
  readonly fingerprints: readonly string[];
  readonly records: readonly string[];
  readonly decision: string;
  readonly auditStates: readonly string[];
}

const expectedEvidence = new Map(
  (
    JSON.parse(
      await readFile(
        new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as { readonly expectedEvidence: readonly ExpectedFixtureEvidence[] }
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

const humanExecutedReceipts = new ExecutedReceiptCollector({
  F36: [
    "concurrency.winner_loser",
    "concurrency.plan_drift",
    "concurrency.rollback",
    "concurrency.replay",
    "concurrency.retry",
  ],
  F37: ["modes.committed_ids", "modes.plan_result_postconditions"],
  F38: ["topology.rows_mappings_history"],
  F39: ["replacement.modes_and_predecessors", "replacement.outside_clarification"],
  F40: ["audits.actions_subjects_before_after", "audits.mapping_cardinality"],
  F41: ["guards.all_mode_rows", "guards.provisional_id_independence"],
});

function finalizeExecutedEvidence(
  id: "F36" | "F37" | "F38" | "F39" | "F40" | "F41",
): ExpectedFixtureEvidence {
  const actual = humanExecutedReceipts.finalize(id);
  const fingerprint = createHash("sha256")
    .update(
      canonicalJson({
        records: actual.records,
        decision: actual.decision,
        auditStates: actual.auditStates,
      }),
    )
    .digest("hex");
  return {
    id,
    fingerprints: [fingerprint],
    ...actual,
  };
}

function normalizeDatabaseValue(value: unknown): JsonValue {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex")}`;
  if (Array.isArray(value)) return value.map(normalizeDatabaseValue);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeDatabaseValue(nested)]),
    );
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value))
    return new Date(value).toISOString();
  if (typeof value === "string" && /^\d+$/u.test(value)) return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  throw new TypeError(`DATABASE_VALUE_NOT_JSON:${typeof value}`);
}

function stableStateReceipt(value: unknown): JsonValue {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return { present: value !== null && value !== undefined };
  const record = value as Record<string, unknown>;
  const factKeys = [
    "action",
    "after_version",
    "before_version",
    "controllingJobState",
    "controlling_job_state",
    "identityOutcome",
    "identity_outcome",
    "identity_projection_mode_id",
    "ownership",
    "recordVersion",
    "record_version",
    "relationship_type",
    "replacement_kind",
    "reviewState",
    "review_state",
    "state",
    "status",
    "supersessionState",
    "supersession_state",
  ];
  return {
    present: true,
    keys: Object.keys(record).sort(),
    facts: Object.fromEntries(
      factKeys
        .filter((key) => record[key] !== undefined)
        .map((key) => [key, normalizeDatabaseValue(record[key])]),
    ),
  };
}

function persistedRowsReceipt(rows: readonly unknown[]): JsonValue {
  const summaries = rows.map((row) => {
    if (typeof row !== "object" || row === null) throw new Error("PERSISTED_ROW_RECEIPT_INVALID");
    const record = row as { readonly table?: unknown; readonly value?: unknown };
    return { table: String(record.table), value: stableStateReceipt(record.value) };
  });
  return [...new Set(summaries.map(({ table }) => table))].sort().map((table) => ({
    table,
    count: summaries.filter((summary) => summary.table === table).length,
    states: summaries
      .filter((summary) => summary.table === table)
      .map(({ value }) => value)
      .sort((left, right) =>
        Buffer.compare(Buffer.from(canonicalJson(left)), Buffer.from(canonicalJson(right))),
      ),
  }));
}
let migration001 = "";
let migration002 = "";
let typedProjectorSource = "";
let humanProjectorSource = "";
let commandPlanSource = "";
let postgresAdapterSource = "";

const commands: readonly IdentityManualResolutionCommand[] = [
  "CREATE_RESOURCE",
  "ATTACH_NEW_VERSION",
  "MARK_FORK",
  "MARK_MIRROR",
  "MARK_DUPLICATE",
  "REJECT_CANDIDATE",
  "SPLIT_ROOTS",
  "MERGE_ROOTS",
  "OVERRIDE_NON_SKILL",
  "REQUEST_CLARIFICATION",
  "RESOLVE_AMBIGUITY",
  "REPLACE_M02_JOB",
];

const GOLDEN_AUDIT_SUBJECT_BY_TABLE: Readonly<Record<string, string>> = {
  acquisition_jobs: "ACQUISITION_JOB",
  candidate_root_ownership: "CANDIDATE_ROOT_OWNERSHIP",
  candidate_roots: "CANDIDATE_ROOT",
  duplicate_candidates: "DUPLICATE_CANDIDATE",
  fork_relationships: "FORK_RELATIONSHIP",
  identity_decisions: "IDENTITY_DECISION",
  m02_candidate_rejection_decisions: "M02_REJECTION_DECISION",
  m02_candidate_replacements: "CANDIDATE_REPLACEMENT",
  m02_clarification_requests: "M02_CLARIFICATION_REQUEST",
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

interface GoldenProjectionCase {
  readonly expansionId: string;
  readonly family: string;
  readonly requiredCreateTables: readonly string[];
  readonly requiredUpdateTables: readonly string[];
  readonly requiredResultMode: string | null;
  readonly requiredOutcome: string | null;
  readonly exactCreateCounts: Readonly<Record<string, number>>;
  readonly exactUpdateCounts: Readonly<Record<string, number>>;
  readonly exactSupersedeCounts: Readonly<Record<string, number>>;
  readonly exactGuardTypes: readonly string[];
  readonly identitySetCardinalities: {
    readonly createdResources: number;
    readonly reusedResources: number;
    readonly createdVersions: number;
    readonly reusedVersions: number;
  };
  readonly finalCandidate: {
    readonly status: string;
    readonly outcome: string | null;
    readonly hasResourceIdentity: boolean;
    readonly hasResourceVersionIdentity: boolean;
    readonly recordVersion: number;
  } | null;
}

function goldenProjectionCase(mode: HumanProjectionMode): GoldenProjectionCase {
  const selected =
    mode.family === "RESOLVE_AMBIGUITY"
      ? (mode.expansionId.slice("RESOLVE_AMBIGUITY:".length).split(":")[0] ?? "")
      : mode.family;
  const creates = new Set<string>();
  const updates = new Set<string>();
  let resultMode: string | null = null;
  let outcome: string | null = null;
  if (["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(selected)) {
    creates.add("identity_decisions");
    if (!(selected === "MARK_FORK" && mode.expansionId.includes(":CORRECTION:")))
      creates.add("m02_identity_handoff_markers");
    updates.add("resource_candidates");
    updates.add("m02_review_states");
    updates.add("acquisition_jobs");
    updates.add("m02_jobs");
  }
  if (selected === "CREATE_RESOURCE") {
    for (const table of [
      "resource_identities",
      "resource_version_identities",
      "resource_source_links",
      "resource_version_observations",
    ])
      creates.add(table);
    resultMode = "CREATE_RESOURCE";
    outcome = "NEW_RESOURCE";
  } else if (selected === "ATTACH_NEW_VERSION") {
    const attach = mode.expansionId.includes(":A1:")
      ? "A1"
      : mode.expansionId.includes(":A2:")
        ? "A2"
        : "A3";
    if (attach === "A1") creates.add("resource_version_identities");
    if (attach === "A1") creates.add("resource_source_links");
    if (attach !== "A3") {
      creates.add("resource_version_observations");
    }
    resultMode = `ATTACH_NEW_VERSION_${attach}`;
    outcome = attach === "A1" ? "EXISTING_RESOURCE_NEW_VERSION" : "EXACT_REPEAT_REUSE";
  } else if (selected === "MARK_FORK") {
    creates.add("fork_relationships");
    if (mode.expansionId.includes(":FIRST:")) {
      creates.add("resource_identities");
      creates.add("resource_version_identities");
      creates.add("resource_source_links");
      creates.add("resource_version_observations");
    }
    resultMode = "MARK_FORK";
    outcome = "FORK_OF_EXISTING_RESOURCE";
  } else if (selected === "MARK_MIRROR") {
    creates.add("source_repository_relationships");
    if (!mode.expansionId.includes(":FIRST:M2:")) {
      creates.add("resource_source_links");
      creates.add("resource_version_observations");
    }
    resultMode = "MARK_MIRROR";
    outcome = "MIRROR";
  } else if (selected === "MARK_DUPLICATE") {
    creates.add("identity_decisions");
    creates.add("duplicate_candidates");
    updates.add("resource_candidates");
    updates.add("m02_review_states");
    updates.add("acquisition_jobs");
    updates.add("m02_jobs");
    resultMode = "MARK_DUPLICATE";
    outcome = "POSSIBLE_DUPLICATE";
  } else if (selected === "REJECT_CANDIDATE") {
    creates.add("m02_candidate_rejection_decisions");
    updates.add("resource_candidates");
    updates.add("m02_review_states");
    updates.add("acquisition_jobs");
    updates.add("m02_jobs");
  } else if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)) {
    for (const table of [
      "repository_candidate_groups",
      "repository_classification_runs",
      "candidate_roots",
      "repository_candidate_root_order",
      "resource_candidates",
      "repository_group_relationships",
      "m02_review_states",
      "candidate_root_ownership",
      "m02_root_replacements",
      "m02_candidate_replacements",
      "m02_ownership_replacements",
      "m02_group_edge_replacements",
    ])
      creates.add(table);
    updates.add("acquisition_jobs");
    updates.add("m02_jobs");
  } else if (selected === "REQUEST_CLARIFICATION") {
    creates.add("m02_clarification_requests");
    updates.add("m02_review_states");
    updates.add("acquisition_jobs");
    updates.add("m02_jobs");
  } else if (selected === "REPLACE_M02_JOB") {
    creates.add("acquisition_jobs");
    creates.add("m02_jobs");
    creates.add("m02_job_supersessions");
  }
  const exactCreateCounts: Record<string, number> = Object.fromEntries(
    [...creates].map((table) => [table, 1]),
  );
  const exactUpdateCounts: Record<string, number> = Object.fromEntries(
    [...updates].map((table) => [table, 1]),
  );
  const exactSupersedeCounts: Record<string, number> = {};
  const k2 = mode.expansionId.includes(":K2:") || mode.expansionId.endsWith(":K2");
  const correction = mode.expansionId.includes(":CORRECTION:");
  const p1 = mode.expansionId.includes(":P1:");
  const guardTypes: string[] = [];
  const addGuards = (...types: string[]): void => void guardTypes.push(...types);
  let identitySetCardinalities = {
    createdResources: 0,
    reusedResources: 0,
    createdVersions: 0,
    reusedVersions: 0,
  };
  let finalCandidate: GoldenProjectionCase["finalCandidate"] = null;
  if (selected === "CREATE_RESOURCE") {
    identitySetCardinalities = {
      createdResources: 1,
      reusedResources: 0,
      createdVersions: 1,
      reusedVersions: 0,
    };
    addGuards("RESOURCE_SOURCE", "RESOURCE_VERSION", "OBSERVATION", "HANDOFF");
  } else if (selected === "ATTACH_NEW_VERSION") {
    const a1 = mode.expansionId.includes(":A1:");
    identitySetCardinalities = {
      createdResources: 0,
      reusedResources: 1,
      createdVersions: a1 ? 1 : 0,
      reusedVersions: a1 ? 0 : 1,
    };
    addGuards("RESOURCE_SOURCE", "RESOURCE_VERSION", "OBSERVATION", "HANDOFF");
    if (mode.expansionId.includes(":A1:")) exactSupersedeCounts.resource_source_links = 1;
  } else if (selected === "MARK_FORK") {
    identitySetCardinalities = {
      createdResources: correction ? 0 : 1,
      reusedResources: correction ? 1 : 0,
      createdVersions: correction ? 0 : 1,
      reusedVersions: correction ? 1 : 0,
    };
    addGuards(
      "FORK_LINEAGE",
      "RELATIONSHIP_PAIR",
      "RESOURCE_SOURCE",
      "RESOURCE_VERSION",
      "OBSERVATION",
      "HANDOFF",
    );
    if (correction) exactSupersedeCounts.fork_relationships = 1;
  } else if (selected === "MARK_MIRROR") {
    identitySetCardinalities = {
      createdResources: 0,
      reusedResources: 1,
      createdVersions: 0,
      reusedVersions: 1,
    };
    addGuards("MIRROR_LINEAGE", "RELATIONSHIP_PAIR", "RESOURCE_SOURCE", "OBSERVATION", "HANDOFF");
    if (correction) {
      exactSupersedeCounts.source_repository_relationships = 1;
      exactSupersedeCounts.resource_source_links = 1;
    }
  } else if (selected === "MARK_DUPLICATE") {
    addGuards("DUPLICATE_DISPOSITION", "RELATIONSHIP_PAIR");
    if (correction) exactSupersedeCounts.duplicate_candidates = 1;
  } else if (selected === "REJECT_CANDIDATE") addGuards("REJECTION_DECISION");
  else if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)) {
    const split = selected === "SPLIT_ROOTS";
    const override = selected === "OVERRIDE_NON_SKILL";
    const successorCount = split ? 2 : 1;
    const predecessorCount = override ? 0 : selected === "MERGE_ROOTS" ? 2 : 1;
    exactCreateCounts.candidate_roots = successorCount;
    exactCreateCounts.repository_candidate_root_order = successorCount;
    exactCreateCounts.resource_candidates = successorCount;
    exactCreateCounts.repository_group_relationships = successorCount;
    exactCreateCounts.m02_review_states = successorCount;
    exactCreateCounts.candidate_root_ownership = successorCount;
    exactCreateCounts.m02_root_replacements = Math.max(1, predecessorCount) * successorCount;
    exactCreateCounts.m02_candidate_replacements = Math.max(1, predecessorCount) * successorCount;
    exactCreateCounts.m02_ownership_replacements = Math.max(1, predecessorCount) * successorCount;
    exactCreateCounts.m02_group_edge_replacements = Math.max(1, predecessorCount) * successorCount;
    exactSupersedeCounts.repository_candidate_groups = 1;
    exactSupersedeCounts.m02_review_states = override ? 1 : predecessorCount;
    if (!override) {
      exactSupersedeCounts.resource_candidates = predecessorCount;
      exactSupersedeCounts.candidate_roots = predecessorCount;
      exactSupersedeCounts.identity_decisions = predecessorCount;
    }
    addGuards("GROUP_KEY", "GROUP_MEMBERSHIP");
    for (let index = 0; index < (split ? 2 : 1); index += 1) addGuards("ROOT_KEY", "CANDIDATE_KEY");
  } else if (selected === "REQUEST_CLARIFICATION")
    addGuards("CLARIFICATION_OPEN", "CLARIFICATION_TARGET");
  else if (selected === "REPLACE_M02_JOB") {
    const predecessorCount = mode.expansionId.includes(":MULTIPLE:") ? 2 : 1;
    exactCreateCounts.m02_job_supersessions = predecessorCount;
    exactSupersedeCounts.acquisition_jobs = predecessorCount;
    exactSupersedeCounts.m02_jobs = predecessorCount;
    if (mode.expansionId.endsWith(":Z1")) exactSupersedeCounts.m02_clarification_requests = 1;
    addGuards(...Array.from({ length: predecessorCount }, () => "JOB_SCOPE_CONTROLLER"));
    addGuards("JOB_REPLACEMENT_INPUT");
  }
  if (
    [
      "CREATE_RESOURCE",
      "ATTACH_NEW_VERSION",
      "MARK_FORK",
      "MARK_MIRROR",
      "MARK_DUPLICATE",
    ].includes(selected)
  ) {
    if (!mode.expansionId.includes(":P0:")) exactSupersedeCounts.identity_decisions = 1;
    if (
      (mode.expansionId.includes(":P2:") ||
        (selected === "MARK_MIRROR" && mode.expansionId.includes(":CORRECTION:"))) &&
      !(selected === "MARK_FORK" && mode.expansionId.includes(":CORRECTION:"))
    )
      exactSupersedeCounts.m02_identity_handoff_markers = 1;
    finalCandidate = {
      status: selected === "MARK_DUPLICATE" ? "REJECTED" : "IDENTITY_RESOLVED",
      outcome,
      hasResourceIdentity: selected !== "MARK_DUPLICATE",
      hasResourceVersionIdentity: selected !== "MARK_DUPLICATE",
      recordVersion:
        correction ||
        mode.expansionId.includes(":FIRST:") ||
        mode.expansionId.includes(":P1:") ||
        mode.expansionId.includes(":P2:")
          ? 3
          : 2,
    };
  } else if (selected === "REJECT_CANDIDATE") {
    if (!mode.expansionId.includes(":P0:")) exactSupersedeCounts.identity_decisions = 1;
    finalCandidate = {
      status: "REJECTED",
      outcome: null,
      hasResourceIdentity: false,
      hasResourceVersionIdentity: false,
      recordVersion: mode.expansionId.includes(":P1:") ? 3 : 2,
    };
  }
  if (!["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected)) {
    addGuards("CLARIFICATION_TARGET");
    if (
      p1 ||
      (!correction && ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(selected)) ||
      ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)
    )
      addGuards("DUPLICATE_PROPOSAL_SET");
    if (k2) {
      const target = ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)
        ? exactSupersedeCounts
        : exactUpdateCounts;
      target.m02_clarification_requests = 1;
    }
  }
  return {
    expansionId: mode.expansionId,
    family: mode.family,
    requiredCreateTables: [...creates].sort(),
    requiredUpdateTables: [...updates].sort(),
    requiredResultMode: resultMode,
    requiredOutcome: outcome,
    exactCreateCounts,
    exactUpdateCounts,
    exactSupersedeCounts,
    exactGuardTypes: guardTypes.sort(),
    identitySetCardinalities,
    finalCandidate,
  };
}

const golden256 = humanProjectionModes().map(goldenProjectionCase);

const canonicalReplacementInputFingerprint = createHash("sha256")
  .update(
    Buffer.from(
      canonicalJson({
        schemaVersion: "1",
        jobLineageId: "lineage-1",
        sourceJobId: "job-source",
        sourceOperationScope: "CLASSIFICATION",
        requestedOperationScope: "CLASSIFICATION",
        predecessorJobIds: ["job-overlap", "job-source"],
        sourceSnapshotId: "snapshot-1",
        replacementSourceSnapshotIdOrNull: "snapshot-replacement",
        classificationPolicyVersion: "classification-v1",
        identityPolicyVersion: "identity-v1",
        analysisPolicyVersion: "analysis-v1",
        parserProfileVersion: "parser-v1",
        promptBundleVersion: "prompt-v1",
        analysisProviderAdapterIdOrNull: null,
        analysisModelIdOrNull: null,
        analysisMethodologyVersionOrNull: null,
        controllingClassificationDecisionIdOrNull: null,
      }),
      "utf8",
    ),
  )
  .digest("hex");

function completeEnvelope(command: IdentityManualResolutionCommand, index: number) {
  const resourceIdentityId = ["CREATE_RESOURCE", "MARK_FORK"].includes(command)
    ? "resource-new"
    : "resource-existing";
  const fullPayload = {
    jobId: "job-1",
    candidateRootId: "root-1",
    classificationRunId: "run-1",
    decisionId: "decision-new",
    resourceIdentityId,
    resourceVersionIdentityId: "version-new",
    provider: "github",
    providerRepositoryId: "repo-1",
    normalizedRoot: ".",
    contentFingerprint: command === "ATTACH_NEW_VERSION" ? "d".repeat(64) : "a".repeat(64),
    reliableIdentityToken: "demo-skill",
    reliableTokenEvidenceId: "evidence-1",
    sourceLinkId: "source-link-new",
    originResourceVersionId: "version-origin",
    priorResourceVersionIdentityId: "version-prior",
    activeSourceLinkId: "source-link-active",
    continuityEvidenceIds: "evidence-1",
    forkResourceVersionId: "version-new",
    relationshipId: "relationship-new",
    targetResourceVersionId: "version-target",
    targetResourceIdentityId: "resource-existing",
    identicalContentFingerprint: "a".repeat(64),
    mirrorSourceRepositoryId: "source-mirror",
    originSourceRepositoryId: "source-origin",
    duplicateId: "duplicate-new",
    originalCandidateIds:
      command === "MERGE_ROOTS"
        ? "candidate-1,candidate-2"
        : command === "OVERRIDE_NON_SKILL"
          ? ""
          : "candidate-1",
    originalRootIds:
      command === "MERGE_ROOTS"
        ? "root-1,root-2"
        : command === "OVERRIDE_NON_SKILL"
          ? ""
          : "root-1",
    replacementCandidateIds:
      command === "SPLIT_ROOTS" ? "candidate-new-a,candidate-new-b" : "candidate-new",
    replacementRootIds: command === "SPLIT_ROOTS" ? "root-new-a,root-new-b" : "root-new",
    replacementRootsJson:
      command === "SPLIT_ROOTS"
        ? '[{"id":"root-new-a","normalizedPath":"skills/a"},{"id":"root-new-b","normalizedPath":"skills/b"}]'
        : '[{"id":"root-new","normalizedPath":"skills/new"}]',
    replacementOwnershipJson:
      command === "SPLIT_ROOTS"
        ? '[{"rootId":"root-new-a","sourceEntryId":"entry-1","ownership":"OWNED"},{"rootId":"root-new-b","sourceEntryId":"entry-1","ownership":"SHARED"}]'
        : '[{"rootId":"root-new","sourceEntryId":"entry-1","ownership":"OWNED"}]',
    selectedRootPathsJson: '["skills/new"]',
    reviewId: "review-1",
    clarificationId: "clarification-new",
    questionCode: "IDENTITY_EVIDENCE_REQUIRED",
    evidenceGapsJson: '["reliable-token"]',
    requestedResponderClass: "TECHNICAL_REVIEWER",
    selectedCommand: "REJECT_CANDIDATE",
    sourceJobId: "job-source",
    replacementJobId: "job-replacement",
    requestedOperationScope: "CLASSIFICATION",
    replacementInputFingerprint: canonicalReplacementInputFingerprint,
    replacementSnapshotId: "snapshot-replacement",
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "analysis-v1",
    promptBundleVersion: "prompt-v1",
    auditId: "audit-new",
    replacementGroupId: "group-new",
    replacementRunId: "run-new",
    observationId: "observation-new",
    sourceSnapshotId: "snapshot-1",
  };
  const selected = fullPayload.selectedCommand as IdentityManualResolutionCommand;
  const payload = Object.fromEntries(
    manualResolutionPayloadKeys(command, selected, false, command === "REPLACE_M02_JOB").map(
      (key) => [key, fullPayload[key as keyof typeof fullPayload]],
    ),
  ) as Record<string, string>;
  return {
    commandId: `command-${String(index)}`,
    requestId: `request-${String(index)}`,
    idempotencyKey: `idempotency-${String(index)}`,
    actorId: "admin-1",
    actorRole: "ADMIN" as const,
    command,
    targetCandidateId: "candidate-1",
    targetGroupId: "group-1",
    expectedVersions: {} as Record<string, number | null>,
    reasonCode:
      command === "REPLACE_M02_JOB"
        ? "RETRY_EXHAUSTED"
        : command === "REQUEST_CLARIFICATION"
          ? "CLASSIFICATION_EVIDENCE_REQUIRED"
          : "REVIEWED_DECISION",
    reason: "Complete reviewed M02 command evidence.",
    evidenceIds: ["evidence-1"],
    decisionIds: [],
    timestamp: "2026-08-09T00:00:00.000Z",
    payload,
  };
}

function isCreationKey(command: IdentityManualResolutionCommand, key: string): boolean {
  return (
    key.startsWith("guard:") ||
    key.startsWith("job-supersession:") ||
    key.startsWith("decision:") ||
    key.startsWith("handoff:") ||
    key.includes("-new") ||
    key.startsWith("manual-command:") ||
    key === "job:job-replacement" ||
    (command === "CREATE_RESOURCE" &&
      [
        "resource:resource-new",
        "version:version-new",
        "source-link:source-link-new",
        "observation:observation-new",
      ].includes(key))
  );
}

function prepareCommand(command: IdentityManualResolutionCommand, index: number) {
  const coordinator = new ManualResolutionCoordinator();
  const input = completeEnvelope(command, index);
  return { coordinator, input, keys: [] as readonly string[] };
}

function prepareCorrection(command: "MARK_FORK" | "MARK_MIRROR" | "MARK_DUPLICATE", index: number) {
  const input = completeEnvelope(command, index);
  input.payload = {
    ...input.payload,
    ...(command === "MARK_FORK"
      ? {
          resourceIdentityId: "resource-existing",
          forkResourceVersionId: "version-fork-existing",
        }
      : {}),
    priorRelationshipId: "relationship-prior",
    priorDecisionId: "decision-seed",
    ...(command === "MARK_MIRROR" ? { priorSourceLinkId: "source-link-prior" } : {}),
  };
  input.expectedVersions = {};
  const coordinator = new ManualResolutionCoordinator();
  const keys = deriveRequiredExpectedVersionKeys(input);
  const guards = new Map(
    coordinator
      .deriveConcurrencyGuards(input)
      .map(({ key, canonicalPayload }) => [key, canonicalPayload] as const),
  );
  for (const key of keys) {
    const created =
      isCreationKey(command, key) && !key.includes("prior") && !key.startsWith("guard:");
    input.expectedVersions[key] = created ? null : 1;
    if (key.startsWith("guard:")) {
      const canonicalPayload = guards.get(key);
      if (canonicalPayload === undefined) throw new Error("TEST_FIXTURE_INVALID");
      coordinator.seedGuard(key, 1, canonicalPayload);
      continue;
    }
    if (created) continue;
    let value: Record<string, unknown> = {};
    if (key === "candidate:candidate-1")
      value = {
        status: command === "MARK_DUPLICATE" ? "REJECTED" : "IDENTITY_RESOLVED",
        contentFingerprint: "a".repeat(64),
        candidateRootId: "root-1",
        reconciledClassificationRunId: "run-1",
      };
    if (key === "group:group-1") value = { classification: "SINGLE_SKILL" };
    if (key === "job:job-1")
      value = { status: "OPERATOR_REVIEW_REQUIRED", supersessionState: "CONTROLLING" };
    if (key === "decision:decision-seed") value = { status: "ACTIVE" };
    if (key === "fork:relationship-prior")
      value = { status: "ACTIVE", forkResourceVersionId: "version-fork-existing" };
    if (key === "mirror:relationship-prior")
      value = { status: "ACTIVE", mirrorSourceRepositoryId: "source-mirror" };
    if (key === "duplicate:relationship-prior")
      value = { status: "ACTIVE", sourceCandidateId: "candidate-1" };
    if (key === "source-link:source-link-prior")
      value = { status: "ACTIVE", sourceRepositoryId: "source-mirror", normalizedRoot: "." };
    if (key === "version:version-target")
      value = { resourceIdentityId: "resource-existing", contentFingerprint: "a".repeat(64) };
    coordinator.seedRecord(key, 1, value);
  }
  return { coordinator, input, keys };
}

function rejectionCommand(
  overrides: Partial<ManualResolutionEnvelope> = {},
): ManualResolutionEnvelope {
  return {
    commandId: "command-reject-1",
    requestId: "request-reject-1",
    idempotencyKey: "idempotency-reject-1",
    actorId: "actor-1",
    actorRole: "EDITOR",
    command: "REJECT_CANDIDATE",
    targetCandidateId: "candidate-1",
    targetGroupId: "group-1",
    expectedVersions: {},
    reasonCode: "NOT_A_SKILL",
    reason: "Reviewed source does not define a Skill.",
    evidenceIds: ["evidence-1"],
    decisionIds: [],
    timestamp: "2026-08-10T00:00:00.000Z",
    payload: {
      auditId: "audit-reject-1",
      decisionId: "decision-reject-1",
      jobId: "job-1",
    },
    ...overrides,
  };
}

async function createSchema(pool: Pool, schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public");
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(migration001);
    await client.query(migration002);
  } finally {
    client.release();
  }
  await seedM02ProductionGraph(pool, schema);
}

async function migrateSchema(pool: Pool, schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public");
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    await client.query(migration001);
    await client.query(migration002);
  } finally {
    client.release();
  }
  await seedM02ProductionGraph(pool, schema);
}

async function resetGoldenSchema(pool: Pool, schema: string): Promise<void> {
  const tables = (
    await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema=$1 AND table_type='BASE TABLE'
       ORDER BY convert_to(table_name,'UTF8')`,
      [schema],
    )
  ).rows.map(({ table_name }) => `"${schema}"."${table_name.replaceAll('"', '""')}"`);
  if (tables.length === 0) throw new Error(`GOLDEN_SCHEMA_EMPTY:${schema}`);
  await pool.query(`TRUNCATE TABLE ${tables.join(",")} RESTART IDENTITY CASCADE`);
  await seedM02ProductionGraph(pool, schema);
}

async function seedForkCorrectionSourceFacts(pool: Pool, schema: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(
      `UPDATE identity_decisions SET outcome='FORK_OF_EXISTING_RESOURCE'
       WHERE id='decision-seed'`,
    );
    await client.query(
      `INSERT INTO m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
       VALUES
         ('audit-source-link-fork-preserved','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
          'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_SOURCE_LINK','source-link-fork-preserved',
          'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
          'Canonical fork-correction source link',1,'{"recordVersion":1,"state":"ACTIVE"}',
          '{}','snapshot-1','job-1',now()),
         ('audit-observation-fork-preserved','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
          'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_VERSION_OBSERVATION','observation-fork-preserved',
          'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
          'Canonical fork-correction observation',NULL,NULL,'{}','snapshot-1','job-1',now()),
         ('audit-handoff-fork-preserved','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
          'fixture-editor','EDITOR','SUBJECT_CREATED','M02_IDENTITY_HANDOFF','handoff-fork-preserved',
          'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
          'Canonical fork-correction handoff',1,'{"recordVersion":1,"state":"ACTIVE"}',
          '{}','snapshot-1','job-1',now())`,
    );
    await client.query(
      `INSERT INTO resource_source_links
         (id,source_repository_id,normalized_root_path,target_resource_version_id,
          relationship,evidence_ids,decision_id,reason,actor_id,created_at,state,record_version,
          origin_type,command_id,result_id,audit_event_id)
       VALUES ('source-link-fork-preserved','source-main','.','version-fork-existing','PRIMARY',
         '["evidence-1"]','decision-seed','Preserved reviewed fork source','fixture-editor',now(),
         'ACTIVE',1,'HUMAN_COMMAND','command-seed','result-seed','audit-source-link-fork-preserved')`,
    );
    await client.query(
      `INSERT INTO resource_version_observations
         (id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
          resource_source_link_id,source_repository_id,provider,provider_repository_id,
          normalized_root_path,immutable_revision,observed_at,origin_type,command_id,result_id,audit_event_id)
       VALUES ('observation-fork-preserved','version-fork-existing','snapshot-1','root-1',
         'source-link-fork-preserved','source-main','github','repo-1','.','rev-1',now(),
         'HUMAN_COMMAND','command-seed','result-seed','audit-observation-fork-preserved')`,
    );
    await client.query(
      `INSERT INTO m02_identity_handoff_markers
         (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
          controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
          command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
          created_at,record_version)
       VALUES ('handoff-fork-preserved','candidate-1','resource-existing','version-fork-existing',
         'job-1','snapshot-1','decision-seed','HUMAN_COMMAND','command-seed','result-seed',
         'audit-handoff-fork-preserved','candidate:candidate-1','CONTROLLING','ACTIVE',now(),1)`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function persistPreparedCommand(
  pool: Pool,
  schema: string,
  prepared: ReturnType<typeof prepareCommand>,
  fixtureProfile: "DEFAULT" | "ALL_COMMAND" = "DEFAULT",
): Promise<void> {
  prepared.input.expectedVersions = {};
  if (
    fixtureProfile === "ALL_COMMAND" &&
    ["CREATE_RESOURCE", "REJECT_CANDIDATE", "RESOLVE_AMBIGUITY"].includes(prepared.input.command)
  )
    await pool.query(
      `SET search_path TO ${schema}, public;
       SET session_replication_role = 'replica';
       DELETE FROM identity_decisions WHERE id='decision-seed';
       DELETE FROM m02_identity_handoff_markers WHERE resource_candidate_id='candidate-1';
       UPDATE resource_candidates
       SET status='CLASSIFIED',identity_outcome=NULL,resource_identity_id=NULL,
           resource_version_identity_id=NULL,record_version=1
       WHERE id='candidate-1';
       SET session_replication_role = 'origin'`,
    );
  if (fixtureProfile === "ALL_COMMAND" && prepared.input.command === "ATTACH_NEW_VERSION")
    await pool.query(
      `SET search_path TO ${schema}, public;
       SET session_replication_role = 'replica';
       UPDATE identity_decisions SET outcome='EXACT_REPEAT_REUSE' WHERE id='decision-seed';
       UPDATE resource_candidates
       SET status='IDENTITY_RESOLVED',identity_outcome='EXACT_REPEAT_REUSE',
           resource_identity_id='resource-existing',resource_version_identity_id='version-prior',
           record_version=2
       WHERE id='candidate-1';
       INSERT INTO m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,before_version,after_version,before_state,after_state,
          metadata_schema_version,metadata,source_snapshot_id,controlling_job_id,occurred_at)
       VALUES ('audit-candidate-attach-prior','HUMAN_COMMAND','command-seed','result-seed',
         'HUMAN','fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE','candidate-1',
         'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
         'Canonical ATTACH predecessor',1,2,
         '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
         '{"identityOutcome":"EXACT_REPEAT_REUSE","recordVersion":2,"resourceIdentityId":"resource-existing","resourceVersionIdentityId":"version-prior","status":"IDENTITY_RESOLVED"}',
         '1','{}'::jsonb,'snapshot-1','job-1',now());
       INSERT INTO m02_identity_handoff_markers
         (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
          controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
          command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
          created_at,record_version)
       VALUES ('handoff-attach-prior','candidate-1','resource-existing','version-prior',
         'job-1','snapshot-1','decision-seed','HUMAN_COMMAND','command-seed','result-seed',
         'audit-command-seed','candidate:candidate-1','CONTROLLING','ACTIVE',now(),1);
       SET session_replication_role = 'origin'`,
    );
  if (prepared.input.command === "MARK_MIRROR") {
    await pool.query(`DELETE FROM ${schema}.source_repository_identities WHERE id='source-main'`);
    await pool.query(
      `UPDATE ${schema}.source_snapshots SET provider_repository_id='repo-mirror' WHERE id='snapshot-1'`,
    );
  }
  if (["SPLIT_ROOTS", "MERGE_ROOTS"].includes(prepared.input.command)) {
    await pool.query(
      `UPDATE ${schema}.repository_candidate_groups
       SET classification='AMBIGUOUS', record_version=record_version+1 WHERE id='group-1'`,
    );
    if (prepared.input.command === "MERGE_ROOTS") {
      await pool.query(
        `INSERT INTO ${schema}.candidate_roots
           (id,group_id,classification_run_id,source_snapshot_id,normalized_root_path,
            candidate_root_fingerprint,candidate_content_fingerprint,canonical_root_payload,
            canonical_content_payload,root_idempotency_key,state,record_version)
         VALUES ('root-2','group-1','run-1','snapshot-1','skills/second',repeat('c',64),repeat('b',64),
           convert_to('{"normalizedRootPath":"skills/second"}','UTF8'),
           convert_to('{"content":"second"}','UTF8'),'root-key-2','ACTIVE',1);
         INSERT INTO ${schema}.candidate_root_ownership
           (id,candidate_root_id,source_snapshot_id,source_entry_id,ownership)
         VALUES ('ownership-2','root-2','snapshot-1','entry-1','OWNED');
         INSERT INTO ${schema}.repository_candidate_root_order
           (id,group_id,classification_run_id,candidate_root_id,source_snapshot_id,root_ordinal,created_at)
         VALUES ('root-order-2','group-1','run-1','root-2','snapshot-1',1,now());
         INSERT INTO ${schema}.resource_candidates
           (id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
            candidate_content_fingerprint,reconciled_classification_run_id,
            classification_policy_version,identity_policy_version,identity_outcome,
            ordered_provenance,candidate_idempotency_key,status,created_at,updated_at,record_version)
         VALUES ('candidate-2','snapshot-1','root-2',repeat('c',64),repeat('b',64),'run-1','classification-v1',
           'identity-v1','AMBIGUOUS_IDENTITY','[]','candidate-key-2',
           'IDENTITY_REVIEW_REQUIRED',now(),now(),2);
         INSERT INTO ${schema}.repository_group_relationships
           (id,parent_group_id,child_candidate_id,relationship_type,relationship_order)
         VALUES ('group-edge-2','group-1','candidate-2','INCLUDES',1);
         INSERT INTO ${schema}.m02_review_states
           (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
         VALUES ('review-2','group-1','candidate-2','IDENTITY_REVIEW_REQUIRED',1,'snapshot-1','job-1')`,
      );
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,before_version,after_version,before_state,after_state,
            metadata_schema_version,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-candidate-2-transition','HUMAN_COMMAND','command-seed','result-seed',
           'HUMAN','fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE','candidate-2',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,2,
           '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
           '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}',
           '1','{}'::jsonb,'snapshot-1','job-1',now()),
          ('audit-decision-2','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_CREATED','IDENTITY_DECISION','decision-2',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',NULL,1,NULL,
           '{"recordVersion":1,"state":"ACTIVE"}','1',
           '{"evaluatedTierSequence":[{"evaluationDisposition":"NO_MATCH","tier":"P1"},{"evaluationDisposition":"NO_MATCH","tier":"P2"},{"evaluationDisposition":"NO_MATCH","tier":"P3"},{"evaluationDisposition":"NO_MATCH","tier":"P4"},{"evaluationDisposition":"NO_MATCH","tier":"P5"},{"evaluationDisposition":"NO_MATCH","tier":"P6"}]}'::jsonb,
           'snapshot-1','job-1',now());
         INSERT INTO ${schema}.identity_decisions
           (id,resource_candidate_id,outcome,identity_policy_version,decision_source,signals,
            rejected_lower_tier_signals,conflicts,audit_fingerprint,state,created_at,record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ('decision-2','candidate-2','AMBIGUOUS_IDENTITY','identity-v1','HUMAN_COMMAND',
           '[]','[]','[]',repeat('c',64),'ACTIVE',now(),1,'HUMAN_COMMAND','command-seed','result-seed','audit-decision-2')`,
      );
    }
    if (
      ![
        "CREATE_RESOURCE",
        "ATTACH_NEW_VERSION",
        "MARK_FORK",
        "MARK_MIRROR",
        "MARK_DUPLICATE",
        "REJECT_CANDIDATE",
        "RESOLVE_AMBIGUITY",
      ].includes(prepared.input.command)
    )
      await pool.query(
        `WITH candidate_transition AS (
         UPDATE ${schema}.resource_candidates
         SET record_version=record_version+1
         WHERE id='candidate-1' AND record_version=1
         RETURNING id
       )
       INSERT INTO ${schema}.m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,before_version,after_version,before_state,after_state,
          metadata_schema_version,metadata,source_snapshot_id,controlling_job_id,occurred_at)
       SELECT 'audit-candidate-seed-transition','HUMAN_COMMAND','command-seed','result-seed',
         'HUMAN','fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE',id,
         'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
         'Canonical PostgreSQL fixture seed',1,2,
         '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
         '{"identityOutcome":null,"recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}',
         '1','{}'::jsonb,'snapshot-1','job-1',now()
       FROM candidate_transition`,
      );
  }
  if (prepared.input.command === "OVERRIDE_NON_SKILL") {
    await pool.query(
      `UPDATE ${schema}.repository_candidate_groups
       SET classification='NON_SKILL', record_version=record_version+1 WHERE id='group-1'`,
    );
    await pool.query(
      `UPDATE ${schema}.candidate_roots
       SET normalized_root_path='skills/new', record_version=record_version+1 WHERE id='root-1'`,
    );
    await pool.query(
      `UPDATE ${schema}.m02_review_states
       SET review_state='CLASSIFICATION_REVIEW_REQUIRED', record_version=record_version+1
       WHERE id='review-1'`,
    );
    await pool.query(
      `DELETE FROM ${schema}.repository_group_relationships WHERE parent_group_id='group-1'`,
    );
  }
  if (prepared.input.command === "REPLACE_M02_JOB") {
    await pool.query(
      `INSERT INTO ${schema}.acquisition_jobs
         (id, submission_id, idempotency_key, status, current_stage, attempt,
          source_snapshot_id, completed_stages, warnings, cancellation_requested, record_version)
       VALUES
         ('job-source','lineage-1','acq-source','OPERATOR_REVIEW_REQUIRED','INVENTORYING_SOURCE',1,
          'snapshot-1','["ACQUIRED"]','[]',false,1),
         ('job-overlap','lineage-1','acq-overlap','COMPLETED','INVENTORYING_SOURCE',1,
          'snapshot-1','["ACQUIRED"]','[]',false,1),
         ('job-snapshot-replacement','lineage-1','acq-snapshot-replacement','COMPLETED','INVENTORYING_SOURCE',1,
          'snapshot-replacement','["ACQUIRED"]','[]',false,1)`,
    );
    await pool.query(
      `INSERT INTO ${schema}.m02_jobs
         (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state,
          supersession_state, supersession_sequence, job_scope_key, input_fingerprint,
          classification_policy_version, identity_policy_version, analysis_policy_version,
          prompt_bundle_version, record_version)
       VALUES
         ('job-source','lineage-1','snapshot-1','CLASSIFICATION','RESOLVING_IDENTITY',
          'IDENTITY_REVIEW_REQUIRED','CONTROLLING',1,$1,$2,'classification-v1','identity-v1','analysis-v1','prompt-v1',1),
         ('job-overlap','lineage-1','snapshot-1','IDENTITY_RESOLUTION','RESOLVING_IDENTITY',
          'IDENTITY_REVIEW_REQUIRED','CONTROLLING',2,$3,$4,'classification-v1','identity-v1','analysis-v1','prompt-v1',1)`,
      ["d".repeat(64), "d".repeat(64), "e".repeat(64), "e".repeat(64)],
    );
    for (const scope of ["CLASSIFICATION", "IDENTITY_RESOLUTION"] as const) {
      const guard = canonicalGuard("JOB_SCOPE_CONTROLLER", {
        jobLineageId: "lineage-1",
        operationScope: scope,
      });
      await pool.query(
        `INSERT INTO ${schema}.m02_concurrency_guards
           (guard_key, guard_type, canonical_payload, payload_hash, record_version)
         VALUES ($1,'JOB_SCOPE_CONTROLLER',$2,$3,1)`,
        [
          guard.key,
          Buffer.from(guard.canonicalPayload),
          createHash("sha256").update(guard.canonicalPayload).digest("hex"),
        ],
      );
    }
  }
  if (prepared.input.command === "ATTACH_NEW_VERSION")
    await pool.query(
      `INSERT INTO ${schema}.m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
       VALUES ('audit-source-link-active','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
         'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_SOURCE_LINK','source-link-active',
         'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
         'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"state":"ACTIVE"}',
         '{}'::jsonb,'snapshot-1',$1,now())
       ON CONFLICT (id) DO NOTHING`,
      [prepared.input.payload.jobId ?? "job-1"],
    );
  if (prepared.input.command === "ATTACH_NEW_VERSION") {
    const activeVersionId =
      prepared.input.payload.contentFingerprint === "a".repeat(64)
        ? "version-target"
        : "version-prior";
    await pool.query(
      `INSERT INTO ${schema}.resource_source_links
         (id, source_repository_id, normalized_root_path, target_resource_version_id,
          relationship, evidence_ids, decision_id, reason, actor_id, created_at, state, record_version,
          origin_type,command_id,result_id,audit_event_id)
       VALUES ('source-link-active','source-main','.',$1,'PRIMARY','["evidence-1"]',
         $2,'Seed active delivery link','system',now(),'ACTIVE',1,
         'HUMAN_COMMAND','command-seed','result-seed','audit-source-link-active')
       ON CONFLICT (id) DO NOTHING`,
      [
        activeVersionId,
        prepared.input.targetCandidateId === GOLDEN_P1_CANDIDATE_ID
          ? GOLDEN_P1_DECISION_ID
          : "decision-seed",
      ],
    );
  }
  if (
    ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(prepared.input.command) &&
    prepared.input.payload.priorRelationshipId !== undefined
  ) {
    if (prepared.input.command === "MARK_FORK") {
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-version-fork-existing','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_VERSION_IDENTITY','version-fork-existing',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,
           '{"recordVersion":1,"status":"IDENTITY_RESOLVED"}','{}','snapshot-1','job-1',now())`,
      );
      await pool.query(
        `INSERT INTO ${schema}.resource_version_identities
           (id, resource_identity_id, content_fingerprint, canonical_payload,
            first_observed_source_snapshot_id, first_observed_candidate_root_id,
            first_observed_source_revision, observation_label, status, created_at, record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ('version-fork-existing','resource-existing',$1,convert_to('{"fork":true}','UTF8'),
           'snapshot-1','root-1','rev-1','snapshot:000000000004','IDENTITY_RESOLVED',now(),1,
           'HUMAN_COMMAND','command-seed','result-seed','audit-version-fork-existing')`,
        ["d".repeat(64)],
      );
    }
    await pool.query(
      `UPDATE ${schema}.resource_candidates
       SET status=$1, resource_identity_id=$2, resource_version_identity_id=$3,
           identity_outcome=$4, record_version=record_version+1
       WHERE id='candidate-1'`,
      [
        prepared.input.command === "MARK_DUPLICATE" ? "REJECTED" : "IDENTITY_RESOLVED",
        prepared.input.command === "MARK_DUPLICATE" ? null : "resource-existing",
        prepared.input.command === "MARK_FORK"
          ? "version-fork-existing"
          : prepared.input.command === "MARK_MIRROR"
            ? "version-target"
            : null,
        prepared.input.command === "MARK_FORK"
          ? "FORK_OF_EXISTING_RESOURCE"
          : prepared.input.command === "MARK_MIRROR"
            ? "MIRROR"
            : "POSSIBLE_DUPLICATE",
      ],
    );
    if (
      fixtureProfile === "ALL_COMMAND" &&
      ["MARK_FORK", "MARK_MIRROR"].includes(prepared.input.command)
    )
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,before_version,after_version,before_state,after_state,
            metadata_schema_version,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-candidate-relationship-prior','HUMAN_COMMAND','command-seed','result-seed',
           'HUMAN','fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE','candidate-1',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,2,
           '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
           $1,'1','{}'::jsonb,'snapshot-1','job-1',now())`,
        [
          prepared.input.command === "MARK_FORK"
            ? '{"identityOutcome":"FORK_OF_EXISTING_RESOURCE","recordVersion":2,"resourceIdentityId":"resource-existing","resourceVersionIdentityId":"version-fork-existing","status":"IDENTITY_RESOLVED"}'
            : '{"identityOutcome":"MIRROR","recordVersion":2,"resourceIdentityId":"resource-existing","resourceVersionIdentityId":"version-target","status":"IDENTITY_RESOLVED"}',
        ],
      );
    if (prepared.input.command === "MARK_DUPLICATE")
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,before_version,after_version,before_state,after_state,
            metadata_schema_version,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-candidate-duplicate-prior','HUMAN_COMMAND','command-seed','result-seed',
           'HUMAN','fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE','candidate-1',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,2,
           '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
           '{"identityOutcome":"POSSIBLE_DUPLICATE","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"REJECTED"}',
           '1','{}'::jsonb,'snapshot-1','job-1',now())`,
      );
    if (prepared.input.command === "MARK_FORK") {
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-relationship-prior','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_CREATED','FORK_RELATIONSHIP','relationship-prior',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"state":"ACTIVE"}',
           '{"relationshipType":"FORK_OF","sourceEndpointId":"version-fork-existing","targetEndpointId":"version-origin"}',
           'snapshot-1','job-1',now())`,
      );
      await pool.query(
        `INSERT INTO ${schema}.fork_relationships
           (id, fork_resource_version_id, origin_resource_version_id, state, evidence_ids,
            decision_id, reason, actor_id, created_at, record_version,command_id,result_id,audit_event_id)
         VALUES ('relationship-prior','version-fork-existing','version-origin','ACTIVE',
           '["evidence-1"]','decision-seed','Prior reviewed fork','admin-1',now(),1,
           'command-seed','result-seed','audit-relationship-prior')`,
      );
      await seedForkCorrectionSourceFacts(pool, schema);
    } else if (prepared.input.command === "MARK_MIRROR") {
      if (fixtureProfile === "ALL_COMMAND")
        await pool.query(
          `SET search_path TO ${schema}, public;
         SET session_replication_role = 'replica';
         UPDATE identity_decisions SET outcome='MIRROR' WHERE id='decision-seed';
         INSERT INTO m02_identity_handoff_markers
           (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
            controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
            command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
            created_at,record_version)
         VALUES ('handoff-mirror-prior','candidate-1','resource-existing','version-target',
           'job-1','snapshot-1','decision-seed','HUMAN_COMMAND','command-seed','result-seed',
           'audit-command-seed','candidate:candidate-1','CONTROLLING','ACTIVE',now(),1);
         SET session_replication_role = 'origin'`,
        );
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES
           ('audit-source-link-prior','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
            'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_SOURCE_LINK','source-link-prior',
            'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
            'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"state":"ACTIVE"}','{}','snapshot-1','job-1',now()),
           ('audit-relationship-prior','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
            'fixture-editor','EDITOR','SUBJECT_CREATED','SOURCE_REPOSITORY_RELATIONSHIP','relationship-prior',
            'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
            'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"state":"ACTIVE"}',
            '{"relationshipType":"MIRROR_OF","sourceEndpointId":"source-mirror","targetEndpointId":"source-origin"}',
            'snapshot-1','job-1',now())`,
      );
      await pool.query(
        `INSERT INTO ${schema}.resource_source_links
           (id, source_repository_id, normalized_root_path, target_resource_version_id,
            relationship, evidence_ids, decision_id, reason, actor_id, created_at, state, record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ('source-link-prior','source-mirror','.','version-target','PRIMARY',
           '["evidence-1"]','decision-seed','Prior reviewed mirror delivery','admin-1',now(),'ACTIVE',1,
           'HUMAN_COMMAND','command-seed','result-seed','audit-source-link-prior')`,
      );
      await pool.query(
        `INSERT INTO ${schema}.source_repository_relationships
           (id, mirror_source_repository_id, origin_source_repository_id, state,
            target_resource_version_id, delivery_source_link_id, evidence_ids, decision_id,
            reason, actor_id, created_at, record_version,command_id,result_id,audit_event_id)
         VALUES ('relationship-prior','source-mirror','source-origin','ACTIVE','version-target',
           'source-link-prior','["evidence-1"]','decision-seed','Prior reviewed mirror',
           'admin-1',now(),1,'command-seed','result-seed','audit-relationship-prior')`,
      );
    } else {
      await pool.query(
        `INSERT INTO ${schema}.m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-relationship-prior','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_CREATED','DUPLICATE_CANDIDATE','relationship-prior',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"status":"CONFIRMED"}',
           '{}','snapshot-1','job-1',now())`,
      );
      await pool.query(
        `INSERT INTO ${schema}.duplicate_candidates
           (id, resource_candidate_id, target_resource_version_id, status, evidence_ids,
            decision_id, reason, actor_id, created_at, record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ('relationship-prior','candidate-1','version-target','CONFIRMED',
           '["evidence-1"]','decision-seed','Prior reviewed duplicate','admin-1',now(),1,
           'HUMAN_COMMAND','command-seed','result-seed','audit-relationship-prior')`,
      );
    }
  }
  prepared.input.expectedVersions = {
    ...(await new PostgresManualResolutionAdapter(pool, {
      schema,
    }).discoverRequiredCurrentExpectations(prepared.input)),
  };
}

async function domainRecord(pool: Pool, schema: string, key: string) {
  const [prefix, id] = key.split(":");
  const table =
    prefix === "candidate"
      ? "resource_candidates"
      : prefix === "job"
        ? "m02_jobs"
        : prefix === "decision"
          ? "identity_decisions"
          : prefix === "fork"
            ? "fork_relationships"
            : prefix === "mirror"
              ? "source_repository_relationships"
              : prefix === "duplicate"
                ? "duplicate_candidates"
                : prefix === "handoff"
                  ? "m02_identity_handoff_markers"
                  : "resource_source_links";
  const result = await pool.query<Record<string, unknown>>(
    `SELECT * FROM ${schema}.${table} WHERE ${prefix === "handoff" ? "resource_candidate_id" : "id"} = $1`,
    [id],
  );
  return result.rows[0];
}

function transactionBoundPool(client: PoolClient): Pool {
  const emptyResult = { command: "", rowCount: 0, oid: 0, fields: [], rows: [] };
  const query = async (text: string, values?: unknown[]) => {
    const normalized = text.trim().replace(/\s+/gu, " ").toUpperCase();
    if (normalized.startsWith("BEGIN") || normalized.startsWith("SET LOCAL SEARCH_PATH"))
      return emptyResult;
    if (normalized === "COMMIT") {
      await client.query("SET CONSTRAINTS ALL IMMEDIATE");
      await client.query("SET CONSTRAINTS ALL DEFERRED");
      return emptyResult;
    }
    if (normalized === "ROLLBACK") {
      await client.query("ROLLBACK TO SAVEPOINT golden_case");
      return emptyResult;
    }
    return client.query(text, values);
  };
  const connection = { query, release: () => undefined };
  return {
    connect: () => Promise.resolve(connection),
    query,
  } as unknown as Pool;
}

function directGoldenMode(mode: HumanProjectionMode): HumanProjectionMode {
  if (mode.family !== "RESOLVE_AMBIGUITY") return mode;
  const direct = humanProjectionModes().find(
    (candidate) => candidate.expansionId === mode.selectedExpansionId,
  );
  if (direct === undefined) throw new Error(`GOLDEN_MODE_INVALID:${mode.expansionId}`);
  return direct;
}

async function addGoldenSibling(
  client: PoolClient,
  aggregate: string,
  controllingJobId = "job-1",
): Promise<void> {
  if (aggregate === "JE") return;
  const resolved = aggregate === "JC";
  await client.query(
    `INSERT INTO resource_candidates
       (id,source_snapshot_id,candidate_root_id,candidate_root_fingerprint,
        candidate_content_fingerprint,reconciled_classification_run_id,
        classification_policy_version,identity_policy_version,identity_outcome,
        ordered_provenance,candidate_idempotency_key,status,resource_identity_id,
        resource_version_identity_id,created_at,updated_at,record_version)
     VALUES ('candidate-sibling','snapshot-1','root-1',$1,$2,'run-1','classification-v1',
       'identity-v1',NULL,'[]','candidate-key-sibling','IDENTITY_REVIEW_REQUIRED',NULL,NULL,
       now(),now(),1)`,
    ["b".repeat(64), "a".repeat(64)],
  );
  await client.query(
    `INSERT INTO repository_group_relationships
       (id,parent_group_id,child_candidate_id,relationship_type,relationship_order)
     VALUES ('group-edge-sibling','group-1','candidate-sibling','INCLUDES',1)`,
  );
  if (!resolved) return;
  await client.query(
    `INSERT INTO resource_identities
       (id,status,created_at,record_version,guard_anchor_candidate_id,origin_type,
        command_id,result_id,audit_event_id)
     VALUES ('resource-sibling','ACTIVE',now(),1,'candidate-sibling','HUMAN_COMMAND',
       'command-seed','result-seed','audit-resource-existing')`,
  );
  await client.query(
    `INSERT INTO resource_version_identities
       (id,resource_identity_id,content_fingerprint,canonical_payload,
        first_observed_source_snapshot_id,first_observed_candidate_root_id,
        first_observed_source_revision,observation_label,status,created_at,record_version,
        origin_type,command_id,result_id,audit_event_id)
     VALUES ('version-sibling','resource-sibling',$1,convert_to('{"sibling":true}','UTF8'),
       'snapshot-1','root-1','rev-1','snapshot:000000000099','IDENTITY_RESOLVED',now(),1,
       'HUMAN_COMMAND','command-seed','result-seed','audit-version-target')`,
    ["a".repeat(64)],
  );
  await client.query(
    `UPDATE resource_candidates SET status='IDENTITY_RESOLVED',identity_outcome='EXACT_REPEAT_REUSE',
       resource_identity_id='resource-sibling',resource_version_identity_id='version-sibling'
     WHERE id='candidate-sibling'`,
  );
  await client.query(
    `INSERT INTO identity_decisions
       (id,resource_candidate_id,outcome,identity_policy_version,decision_source,signals,
        rejected_lower_tier_signals,conflicts,audit_fingerprint,state,created_at,record_version,
        origin_type,command_id,result_id,audit_event_id)
     VALUES ('decision-sibling','candidate-sibling','EXACT_REPEAT_REUSE','identity-v1',
       'HUMAN_COMMAND','[]','[]','[]',$1,'ACTIVE',now(),1,'HUMAN_COMMAND',
       'command-seed','result-seed','audit-decision-seed')`,
    ["9".repeat(64)],
  );
  await client.query(
    `INSERT INTO m02_identity_handoff_markers
       (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
        controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
        command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
        created_at,record_version)
     VALUES ('handoff-sibling','candidate-sibling','resource-sibling','version-sibling',$1,
       'snapshot-1','decision-sibling','HUMAN_COMMAND','command-seed','result-seed',
       'audit-command-seed','candidate:candidate-sibling','CONTROLLING','ACTIVE',now(),1)`,
    [controllingJobId],
  );
}

async function addGoldenClarification(
  client: PoolClient,
  controllingJobId = "job-1",
  reviewId = "review-1",
  decisionId = "decision-seed",
  candidateId = "candidate-1",
): Promise<void> {
  await client.query(
    `INSERT INTO m02_clarification_requests
       (id,command_id,result_id,audit_event_id,review_id,controlling_job_id,source_snapshot_id,
        target_identity_decision_id,resource_candidate_id,candidate_group_id,question_code,
        reason_code,question_payload,evidence_ids,evidence_gaps,requested_responder_class,
        actor_id,actor_role,state,created_at,record_version)
     VALUES ('clarification-golden','command-seed','result-seed','audit-command-seed',$2,$1,
       'snapshot-1',$3,$4,'group-1','IDENTITY_EVIDENCE_REQUIRED',
       'IDENTITY_EVIDENCE_REQUIRED',convert_to('Provide identity evidence.','UTF8'),
       '["evidence-1"]','["identity"]','TECHNICAL_REVIEWER','fixture-editor','EDITOR','OPEN',now(),1)`,
    [controllingJobId, reviewId, decisionId, candidateId],
  );
}

async function seedGoldenP1SystemLineage(client: PoolClient): Promise<void> {
  const tierSequence = JSON.stringify(
    ["P1", "P2", "P3", "P4", "P5", "P6"].map((tier) => ({
      tier,
      evaluationDisposition: "NO_MATCH",
    })),
  );
  await client.query(
    `INSERT INTO m02_system_identity_operations
       (id,automatic_projector_mode_id,source_snapshot_id,candidate_id,controlling_job_id,
        reconciled_classification_run_id,classification_run_input_fingerprint,
        classification_run_output_fingerprint,classification_policy_version,
        identity_policy_version,analysis_policy_version,parser_profile_version,
        prompt_bundle_version,identity_decision_input_payload,
        identity_decision_input_fingerprint,system_replay_locator_payload,
        system_replay_lookup_key,idempotency_key,idempotency_payload,system_expected_versions,
        system_expected_versions_payload,system_operation_request_payload,
        system_operation_fingerprint,system_actor_id,created_at)
     VALUES ('operation-golden','S6_JR','snapshot-1','${GOLDEN_P1_CANDIDATE_ID}','${GOLDEN_P1_JOB_ID}','run-1',
       $1,$2,'classification-v1','identity-v1','analysis-v1','parser-v1','prompt-v1',
       convert_to('{}','UTF8'),encode(public.digest(convert_to('{}','UTF8'),'sha256'),'hex'),
       convert_to('{"replay":"golden"}','UTF8'),
       encode(public.digest(convert_to('{"replay":"golden"}','UTF8'),'sha256'),'hex'),
       encode(public.digest(convert_to('{"idempotency":"golden"}','UTF8'),'sha256'),'hex'),
       convert_to('{"idempotency":"golden"}','UTF8'),'{}'::jsonb,convert_to('{}','UTF8'),
       convert_to('{"request":"golden"}','UTF8'),
       encode(public.digest(convert_to('{"request":"golden"}','UTF8'),'sha256'),'hex'),
       'm02-resolver',now())`,
    ["a".repeat(64), "b".repeat(64)],
  );
  await client.query(
    `INSERT INTO m02_system_identity_results
       (id,system_operation_id,automatic_projector_mode_id,mutation_plan_payload,
        mutation_plan_fingerprint,candidate_id,controlling_job_id,source_snapshot_id,
        identity_decision_id,created_source_repository_ids,created_source_repository_url_ids,
        created_resource_identity_ids,created_resource_version_identity_ids,
        created_source_link_ids,created_observation_ids,created_duplicate_candidate_ids,
        created_identity_decision_ids,created_handoff_marker_ids,reused_source_repository_ids,
        reused_resource_identity_ids,reused_resource_version_identity_ids,reused_source_link_ids,
        reused_observation_ids,updated_resource_candidate_ids,updated_review_state_ids,
        updated_acquisition_job_ids,updated_m02_job_ids,superseded_source_link_ids,
        superseded_identity_decision_ids,superseded_handoff_marker_ids,
        superseded_duplicate_candidate_ids,created_identity_decision_tier_evaluation_ids,
        created_identity_decision_signal_ids,created_identity_decision_signal_evidence_ids,
        created_identity_decision_conflict_ids,created_identity_decision_conflict_target_ids,
        created_identity_decision_conflict_evidence_ids,final_candidate_state,
        final_review_state,final_acquisition_job_status,final_m02_job_status,final_m02_stage,
        accepted_audit_event_id,accepted_at)
     VALUES ('result-golden-system','operation-golden','S6_JR',convert_to('{}','UTF8'),
       encode(public.digest(convert_to('{}','UTF8'),'sha256'),'hex'),'${GOLDEN_P1_CANDIDATE_ID}','${GOLDEN_P1_JOB_ID}','snapshot-1',
       '${GOLDEN_P1_DECISION_ID}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}',
       '{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}','{}',
       '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}',
       'IDENTITY_REVIEW_REQUIRED','OPERATOR_REVIEW_REQUIRED','OPERATOR_REVIEW_REQUIRED',
       'RESOLVING_IDENTITY','audit-system-accepted-golden',now())`,
  );
  const metadata = JSON.stringify({
    automaticProjectorModeId: "S6_JR",
    evaluatedTierSequence: JSON.parse(tierSequence),
    identityDecisionInputFingerprint: createHash("sha256").update("{}").digest("hex"),
  });
  await client.query(
    `INSERT INTO m02_audit_events
       (id,origin_type,system_operation_id,system_result_id,actor_type,actor_id,action,
        subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
        reason_text,before_version,after_version,before_state,after_state,metadata,
        source_snapshot_id,controlling_job_id,occurred_at)
     VALUES
       ('audit-system-accepted-golden','SYSTEM_IDENTITY_OPERATION','operation-golden',
        'result-golden-system','SYSTEM','m02-resolver','SYSTEM_OPERATION_ACCEPTED',
        'SYSTEM_IDENTITY_OPERATION','operation-golden','operation-golden',
        'M02_SYSTEM_IDENTITY_PROJECTION_V1',$1,'S6_JR','Golden P1 system operation',
        NULL,NULL,NULL,NULL,$2::jsonb,'snapshot-1','${GOLDEN_P1_JOB_ID}',now()),
       ('audit-system-decision-golden','SYSTEM_IDENTITY_OPERATION','operation-golden',
        'result-golden-system','SYSTEM','m02-resolver','SUBJECT_CREATED','IDENTITY_DECISION',
        '${GOLDEN_P1_DECISION_ID}','operation-golden','M02_SYSTEM_IDENTITY_PROJECTION_V1',$1,'S6_JR',
        'Golden P1 system Decision',NULL,1,NULL,'{"recordVersion":1,"state":"ACTIVE"}',
        $2::jsonb,'snapshot-1','${GOLDEN_P1_JOB_ID}',now()),
       ('audit-system-candidate-golden','SYSTEM_IDENTITY_OPERATION','operation-golden',
        'result-golden-system','SYSTEM','m02-resolver','SUBJECT_UPDATED','RESOURCE_CANDIDATE',
        '${GOLDEN_P1_CANDIDATE_ID}','operation-golden','M02_SYSTEM_IDENTITY_PROJECTION_V1',$1,'S6_JR',
        'Golden P1 candidate transition',1,2,
        '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
        '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}',
        '{}'::jsonb,'snapshot-1','${GOLDEN_P1_JOB_ID}',now())`,
    [createHash("sha256").update('{"idempotency":"golden"}').digest("hex"), metadata],
  );
  await client.query(
    `UPDATE identity_decisions SET outcome='AMBIGUOUS_IDENTITY',decision_source='DETERMINISTIC',
       origin_type='SYSTEM_IDENTITY_OPERATION',command_id=NULL,result_id=NULL,
       system_operation_id='operation-golden',system_result_id='result-golden-system',
       audit_event_id='audit-system-decision-golden' WHERE id='${GOLDEN_P1_DECISION_ID}'`,
  );
  const tierIds = [
    "00000000-0000-7000-8000-000000000110",
    "00000000-0000-7000-8000-000000000111",
    "00000000-0000-7000-8000-000000000112",
    "00000000-0000-7000-8000-000000000113",
    "00000000-0000-7000-8000-000000000114",
    "00000000-0000-7000-8000-000000000115",
  ];
  await client.query(
    `INSERT INTO m02_audit_events
       (id,origin_type,system_operation_id,system_result_id,actor_type,actor_id,action,
        subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
        reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
     SELECT 'audit-system-tier-' || ordinality,'SYSTEM_IDENTITY_OPERATION','operation-golden',
       'result-golden-system','SYSTEM','m02-resolver','SUBJECT_CREATED',
       'IDENTITY_DECISION_TIER_EVALUATION',tier_id::text,'operation-golden',
       'M02_SYSTEM_IDENTITY_PROJECTION_V1',$2,'S6_JR','Golden P1 tier',NULL,NULL,'{}',
       'snapshot-1','${GOLDEN_P1_JOB_ID}',now()
     FROM unnest($1::uuid[]) WITH ORDINALITY AS tier(tier_id,ordinality)`,
    [tierIds, createHash("sha256").update('{"idempotency":"golden"}').digest("hex")],
  );
  await client.query(
    `INSERT INTO identity_decision_tier_evaluations
       (id,identity_decision_id,ordinal,tier,evaluation_disposition,audit_event_id,created_at)
     SELECT tier_id,'${GOLDEN_P1_DECISION_ID}',ordinality - 1,
       (ARRAY['P1','P2','P3','P4','P5','P6'])[ordinality],'NO_MATCH',
       'audit-system-tier-' || ordinality,now()
     FROM unnest($1::uuid[]) WITH ORDINALITY AS tier(tier_id,ordinality)`,
    [tierIds],
  );
  await client.query(
    `UPDATE m02_system_identity_results SET
       created_identity_decision_ids=ARRAY['${GOLDEN_P1_DECISION_ID}'::uuid],
       created_identity_decision_tier_evaluation_ids=$1::uuid[],
       updated_resource_candidate_ids=ARRAY['${GOLDEN_P1_CANDIDATE_ID}'::uuid],
       updated_review_state_ids=ARRAY['${GOLDEN_P1_REVIEW_ID}'::uuid],
       updated_acquisition_job_ids=ARRAY['${GOLDEN_P1_JOB_ID}'::uuid],
       updated_m02_job_ids=ARRAY['${GOLDEN_P1_JOB_ID}'::uuid]
     WHERE id='result-golden-system'`,
    [tierIds],
  );
  await client.query(
    `UPDATE resource_candidates SET status='IDENTITY_REVIEW_REQUIRED',
       identity_outcome='AMBIGUOUS_IDENTITY',record_version=2 WHERE id='${GOLDEN_P1_CANDIDATE_ID}';
     UPDATE m02_review_states SET review_state='IDENTITY_REVIEW_REQUIRED',record_version=2
       WHERE id='${GOLDEN_P1_REVIEW_ID}';
     UPDATE acquisition_jobs SET status='OPERATOR_REVIEW_REQUIRED',record_version=2
       WHERE id='${GOLDEN_P1_JOB_ID}';
     UPDATE m02_jobs SET review_state='IDENTITY_REVIEW_REQUIRED',record_version=2
       WHERE id='${GOLDEN_P1_JOB_ID}'`,
  );
}

async function configureGoldenDimensions(
  client: PoolClient,
  direct: HumanProjectionMode,
  input: ManualResolutionEnvelope,
): Promise<void> {
  const dimensions = direct.dimensions;
  const candidatePhase =
    dimensions.P ??
    (dimensions.mode === "FIRST" ? "P1" : dimensions.mode === "CORRECTION" ? "P2" : undefined);
  await client.query("SET LOCAL session_replication_role = 'replica'");
  if (candidatePhase === "P1") {
    await client.query(
      `UPDATE acquisition_jobs SET id='${GOLDEN_P1_JOB_ID}' WHERE id='job-1';
       UPDATE m02_jobs SET id='${GOLDEN_P1_JOB_ID}' WHERE id='job-1';
       UPDATE m02_audit_events SET controlling_job_id='${GOLDEN_P1_JOB_ID}'
         WHERE controlling_job_id='job-1';
       UPDATE resource_candidates SET id='${GOLDEN_P1_CANDIDATE_ID}' WHERE id='candidate-1';
       UPDATE identity_decisions SET id='${GOLDEN_P1_DECISION_ID}',resource_candidate_id='${GOLDEN_P1_CANDIDATE_ID}' WHERE id='decision-seed';
       UPDATE m02_review_states SET id='${GOLDEN_P1_REVIEW_ID}',resource_candidate_id='${GOLDEN_P1_CANDIDATE_ID}',controlling_job_id='${GOLDEN_P1_JOB_ID}'
         WHERE id='review-1';
       UPDATE repository_group_relationships SET child_candidate_id='${GOLDEN_P1_CANDIDATE_ID}'
         WHERE child_candidate_id='candidate-1';
       UPDATE resource_identities SET guard_anchor_candidate_id='${GOLDEN_P1_CANDIDATE_ID}'
         WHERE guard_anchor_candidate_id='candidate-1';
       UPDATE resource_source_links SET decision_id='${GOLDEN_P1_DECISION_ID}' WHERE decision_id='decision-seed';
       UPDATE duplicate_candidates SET resource_candidate_id='${GOLDEN_P1_CANDIDATE_ID}',decision_id='${GOLDEN_P1_DECISION_ID}'
         WHERE resource_candidate_id='candidate-1';
       UPDATE m02_identity_handoff_markers
         SET resource_candidate_id='${GOLDEN_P1_CANDIDATE_ID}',identity_decision_id='${GOLDEN_P1_DECISION_ID}',controlling_m02_job_id='${GOLDEN_P1_JOB_ID}'
         WHERE resource_candidate_id='candidate-1'`,
    );
  }
  if (candidatePhase !== undefined) {
    const status =
      candidatePhase === "P0"
        ? "CLASSIFIED"
        : candidatePhase === "P1"
          ? "IDENTITY_REVIEW_REQUIRED"
          : direct.family === "MARK_DUPLICATE"
            ? "REJECTED"
            : "IDENTITY_RESOLVED";
    await client.query(
      `UPDATE resource_candidates SET status=$1,
         identity_outcome=CASE
           WHEN $1='IDENTITY_RESOLVED' THEN 'EXACT_REPEAT_REUSE'
           WHEN $1='REJECTED' THEN 'POSSIBLE_DUPLICATE'
           ELSE NULL END,
         resource_identity_id=CASE WHEN $1='IDENTITY_RESOLVED' THEN 'resource-existing' ELSE NULL END,
         resource_version_identity_id=CASE WHEN $1='IDENTITY_RESOLVED' THEN 'version-target' ELSE NULL END,
         record_version=CASE WHEN $1 IN ('IDENTITY_RESOLVED','REJECTED') THEN 2 ELSE 1 END
       WHERE id=$2`,
      [status, candidatePhase === "P1" ? GOLDEN_P1_CANDIDATE_ID : "candidate-1"],
    );
    if (candidatePhase === "P0")
      await client.query("DELETE FROM identity_decisions WHERE id='decision-seed'");
    if (candidatePhase === "P1") {
      await client.query(
        `UPDATE resource_candidates SET status='CLASSIFIED',identity_outcome=NULL,record_version=1
           WHERE id='${GOLDEN_P1_CANDIDATE_ID}';
         UPDATE m02_review_states SET review_state='NOT_REQUIRED',record_version=1
           WHERE id='${GOLDEN_P1_REVIEW_ID}';
         UPDATE acquisition_jobs SET status='ACTIVE',record_version=1
           WHERE id='${GOLDEN_P1_JOB_ID}';
         UPDATE m02_jobs SET review_state='NOT_REQUIRED',record_version=1
           WHERE id='${GOLDEN_P1_JOB_ID}'`,
      );
      await seedGoldenP1SystemLineage(client);
      await client.query(
        `UPDATE resource_candidates SET identity_outcome='AMBIGUOUS_IDENTITY',record_version=2
         WHERE id=$1`,
        [GOLDEN_P1_CANDIDATE_ID],
      );
    }
    if (candidatePhase === "P2" && direct.family !== "MARK_DUPLICATE")
      await client.query(
        `INSERT INTO m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,before_version,after_version,before_state,after_state,metadata,
            source_snapshot_id,controlling_job_id,occurred_at)
         VALUES ('audit-candidate-p2','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_UPDATED','RESOURCE_CANDIDATE','candidate-1',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical PostgreSQL fixture seed',1,2,
           '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
           '{"identityOutcome":"EXACT_REPEAT_REUSE","recordVersion":2,"resourceIdentityId":"resource-existing","resourceVersionIdentityId":"version-target","status":"IDENTITY_RESOLVED"}',
           '{}','snapshot-1','job-1',now())`,
      );
    if (
      candidatePhase === "P2" &&
      direct.family !== "MARK_DUPLICATE" &&
      !(direct.family === "MARK_FORK" && dimensions.mode === "CORRECTION")
    ) {
      await client.query(
        `UPDATE identity_decisions SET outcome='EXACT_REPEAT_REUSE' WHERE id='decision-seed';
         INSERT INTO m02_audit_events
           (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
            subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
            reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,
            occurred_at)
         VALUES ('audit-handoff-p2','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
           'fixture-editor','EDITOR','SUBJECT_CREATED','M02_IDENTITY_HANDOFF','handoff-p2',
           'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
           'Golden P2 active handoff',1,'{"recordVersion":1,"state":"ACTIVE"}','{}',
           'snapshot-1','job-1',now());
         INSERT INTO m02_identity_handoff_markers
           (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
            controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
            command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
            created_at,record_version)
         VALUES ('handoff-p2','candidate-1','resource-existing','version-target','job-1',
           'snapshot-1','decision-seed','HUMAN_COMMAND','command-seed','result-seed',
           'audit-handoff-p2','candidate:candidate-1','CONTROLLING','ACTIVE',now(),1)`,
      );
    }
    if (
      candidatePhase === "P2" &&
      direct.family === "MARK_FORK" &&
      dimensions.mode === "CORRECTION"
    )
      await client.query(
        `UPDATE resource_candidates candidate
         SET resource_identity_id=handoff.resource_identity_id,
             resource_version_identity_id=handoff.resource_version_identity_id,
             identity_outcome=decision.outcome
         FROM m02_identity_handoff_markers handoff
         JOIN identity_decisions decision ON decision.id=handoff.identity_decision_id
         WHERE candidate.id=handoff.resource_candidate_id AND handoff.state='ACTIVE'
           AND candidate.id='candidate-1';
         UPDATE m02_audit_events audit
         SET after_state=m02_canonical_json(jsonb_build_object(
           'identityOutcome',candidate.identity_outcome,
           'recordVersion',candidate.record_version,
           'resourceIdentityId',candidate.resource_identity_id,
           'resourceVersionIdentityId',candidate.resource_version_identity_id,
           'status',candidate.status))
         FROM resource_candidates candidate
         WHERE audit.id='audit-candidate-p2' AND candidate.id='candidate-1'`,
      );
    if (candidatePhase === "P2" && direct.family === "MARK_DUPLICATE")
      await client.query(
        `UPDATE identity_decisions SET outcome='POSSIBLE_DUPLICATE' WHERE id='decision-seed'`,
      );
  }
  if (dimensions.J === "JR")
    await addGoldenSibling(client, "JR", candidatePhase === "P1" ? GOLDEN_P1_JOB_ID : "job-1");
  if (dimensions.J === "JC" && ["MARK_DUPLICATE", "REJECT_CANDIDATE"].includes(direct.family))
    await addGoldenSibling(client, "JC", candidatePhase === "P1" ? GOLDEN_P1_JOB_ID : "job-1");
  if (dimensions.A === "A3" || (direct.family === "MARK_MIRROR" && dimensions.M === "M2")) {
    await client.query(
      `INSERT INTO resource_source_links
         (id,source_repository_id,normalized_root_path,target_resource_version_id,
          relationship,evidence_ids,decision_id,reason,actor_id,created_at,state,record_version,
          origin_type,command_id,result_id,audit_event_id)
       VALUES ('source-link-active',$1,'.','version-target',$2,'["evidence-1"]','decision-seed',
         'Golden exact observation link','fixture-editor',now(),'ACTIVE',1,'HUMAN_COMMAND',
         'command-seed','result-seed','audit-command-seed')
       ON CONFLICT (id) DO NOTHING`,
      [
        direct.family === "MARK_MIRROR" ? "source-mirror" : "source-main",
        direct.family === "MARK_MIRROR" ? "ALTERNATE" : "PRIMARY",
      ],
    );
    await client.query(
      `UPDATE resource_source_links SET target_resource_version_id='version-target'
       WHERE id='source-link-active'`,
    );
    await client.query(
      `INSERT INTO resource_version_observations
         (id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
          resource_source_link_id,source_repository_id,provider,provider_repository_id,
          normalized_root_path,immutable_revision,observed_at,origin_type,command_id,result_id,
          audit_event_id)
       SELECT 'observation-existing','version-target','snapshot-1','root-1','source-link-active',
         link.source_repository_id,snapshot.provider,snapshot.provider_repository_id,'.','rev-1',now(),
         'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed'
       FROM resource_source_links link JOIN source_snapshots snapshot ON snapshot.id='snapshot-1'
       WHERE link.id='source-link-active'`,
    );
  }
  if (dimensions.K === "K2" || dimensions.Z === "Z1")
    if (dimensions.Z === "Z1")
      await client.query(
        `INSERT INTO m02_review_states
           (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
         VALUES ('review-replacement','group-1','candidate-1','IDENTITY_REVIEW_REQUIRED',1,
           'snapshot-1','job-source')`,
      );
  if (dimensions.K === "K2" || dimensions.Z === "Z1")
    await addGoldenClarification(
      client,
      dimensions.Z === "Z1" ? "job-source" : candidatePhase === "P1" ? GOLDEN_P1_JOB_ID : "job-1",
      dimensions.Z === "Z1"
        ? "review-replacement"
        : candidatePhase === "P1"
          ? GOLDEN_P1_REVIEW_ID
          : "review-1",
      candidatePhase === "P1" ? GOLDEN_P1_DECISION_ID : "decision-seed",
      candidatePhase === "P1" ? GOLDEN_P1_CANDIDATE_ID : "candidate-1",
    );
  if (candidatePhase === "P0" && dimensions.K === "K2")
    await client.query(
      `UPDATE m02_clarification_requests
       SET target_identity_decision_id=NULL,target_classification_run_id='run-1',
           resource_candidate_id=NULL
       WHERE id='clarification-golden'`,
    );
  if (dimensions.K === "K1") {
    const targetType = candidatePhase === "P0" ? "CANDIDATE_GROUP" : "IDENTITY_DECISION";
    const targetId =
      candidatePhase === "P0"
        ? "run-1"
        : candidatePhase === "P1"
          ? GOLDEN_P1_DECISION_ID
          : "decision-seed";
    const guard = canonicalGuard("CLARIFICATION_TARGET", {
      targetType,
      targetId,
    });
    await client.query(
      `INSERT INTO m02_concurrency_guards
         (guard_key,guard_type,canonical_payload,payload_hash,record_version)
       VALUES ($1,'CLARIFICATION_TARGET',$2,$3,1)`,
      [
        guard.key,
        Buffer.from(guard.canonicalPayload),
        createHash("sha256").update(guard.canonicalPayload).digest("hex"),
      ],
    );
  }
  if (direct.family === "REQUEST_CLARIFICATION" && dimensions.T === "T1") {
    const targetType =
      dimensions.target === "CLASSIFICATION"
        ? "CANDIDATE_GROUP"
        : dimensions.target === "IDENTITY"
          ? "IDENTITY_DECISION"
          : "RESOURCE_CANDIDATE";
    const targetId =
      dimensions.target === "CLASSIFICATION"
        ? "run-1"
        : dimensions.target === "IDENTITY"
          ? "decision-seed"
          : "rejection-golden";
    const guard = canonicalGuard("CLARIFICATION_TARGET", { targetType, targetId });
    await client.query(
      `INSERT INTO m02_concurrency_guards
         (guard_key,guard_type,canonical_payload,payload_hash,record_version)
       VALUES ($1,'CLARIFICATION_TARGET',$2,$3,1)`,
      [
        guard.key,
        Buffer.from(guard.canonicalPayload),
        createHash("sha256").update(guard.canonicalPayload).digest("hex"),
      ],
    );
  }
  if (direct.family === "REPLACE_M02_JOB" && dimensions.predecessors === "SINGLE") {
    await client.query("DELETE FROM m02_jobs WHERE id='job-overlap'");
    await client.query("DELETE FROM acquisition_jobs WHERE id='job-overlap'");
  }
  await client.query("SET LOCAL session_replication_role = 'origin'");
  void input;
}

async function prepareGoldenExecution(
  pool: Pool,
  client: PoolClient,
  schema: string,
  mode: HumanProjectionMode,
  index: number,
): Promise<{ readonly input: ManualResolutionEnvelope; readonly direct: HumanProjectionMode }> {
  const direct = directGoldenMode(mode);
  const family = direct.family as IdentityManualResolutionCommand;
  const correction =
    direct.dimensions.mode === "CORRECTION" &&
    ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(family);
  const prepared = correction
    ? prepareCorrection(family as "MARK_FORK" | "MARK_MIRROR" | "MARK_DUPLICATE", 10_000 + index)
    : prepareCommand(family, 10_000 + index);
  if (direct.dimensions.P === "P1" || direct.dimensions.mode === "FIRST")
    Object.assign(prepared.input, {
      targetCandidateId: GOLDEN_P1_CANDIDATE_ID,
      payload: {
        ...prepared.input.payload,
        jobId: GOLDEN_P1_JOB_ID,
        ...(prepared.input.payload.reviewId === undefined ? {} : { reviewId: GOLDEN_P1_REVIEW_ID }),
      },
    });
  if (
    family === "ATTACH_NEW_VERSION" &&
    (direct.dimensions.A === "A2" || direct.dimensions.A === "A3")
  )
    prepared.input.payload = {
      ...prepared.input.payload,
      contentFingerprint: "a".repeat(64),
    };
  if (family === "REQUEST_CLARIFICATION") {
    const target = direct.dimensions.target;
    if (target === undefined) throw new Error(`GOLDEN_MODE_INVALID:${direct.expansionId}`);
    prepared.input.reasonCode = `${target}_EVIDENCE_REQUIRED`;
    (prepared.input as { decisionIds: string[] }).decisionIds =
      target === "CLASSIFICATION"
        ? []
        : [target === "IDENTITY" ? "decision-seed" : "rejection-golden"];
  }
  const configuredBeforeDiscovery =
    direct.dimensions.P === "P1" || direct.dimensions.mode === "FIRST";
  if (configuredBeforeDiscovery && family === "MARK_MIRROR") {
    await pool.query(`DELETE FROM ${schema}.source_repository_identities WHERE id='source-main'`);
    await pool.query(
      `UPDATE ${schema}.source_snapshots
       SET provider_repository_id='repo-mirror' WHERE id='snapshot-1'`,
    );
  }
  if (configuredBeforeDiscovery) await configureGoldenDimensions(client, direct, prepared.input);
  await persistPreparedCommand(pool, schema, prepared);
  if (family === "REQUEST_CLARIFICATION" && direct.dimensions.target === "REJECTION") {
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(
      `INSERT INTO m02_candidate_rejection_decisions
         (id,resource_candidate_id,controlling_job_id,classification_run_id,source_snapshot_id,
          command_id,result_id,audit_event_id,evidence_ids,actor_id,actor_role,reason_code,
          reason_text,state,created_at,record_version)
       VALUES ('rejection-golden','candidate-1','job-1','run-1','snapshot-1','command-seed',
         'result-seed','audit-command-seed','["evidence-1"]','fixture-editor','EDITOR',
         'NOT_A_SKILL','Golden rejection target','ACTIVE',now(),1)`,
    );
    await client.query("SET LOCAL session_replication_role = 'origin'");
  }
  if (!configuredBeforeDiscovery) await configureGoldenDimensions(client, direct, prepared.input);
  let input: ManualResolutionEnvelope = prepared.input;
  if (family === "REPLACE_M02_JOB" && direct.dimensions.predecessors === "SINGLE") {
    const singleInputFingerprint = createHash("sha256")
      .update(
        Buffer.from(
          canonicalJson({
            schemaVersion: "1",
            jobLineageId: "lineage-1",
            sourceJobId: "job-source",
            sourceOperationScope: "CLASSIFICATION",
            requestedOperationScope: "CLASSIFICATION",
            predecessorJobIds: ["job-source"],
            sourceSnapshotId: "snapshot-1",
            replacementSourceSnapshotIdOrNull: "snapshot-replacement",
            classificationPolicyVersion: "classification-v1",
            identityPolicyVersion: "identity-v1",
            analysisPolicyVersion: "analysis-v1",
            parserProfileVersion: "parser-v1",
            promptBundleVersion: "prompt-v1",
            analysisProviderAdapterIdOrNull: null,
            analysisModelIdOrNull: null,
            analysisMethodologyVersionOrNull: null,
            controllingClassificationDecisionIdOrNull: null,
          }),
          "utf8",
        ),
      )
      .digest("hex");
    input = {
      ...input,
      payload: { ...input.payload, replacementInputFingerprint: singleInputFingerprint },
    };
  }
  if (mode.family === "RESOLVE_AMBIGUITY")
    input = {
      ...input,
      command: "RESOLVE_AMBIGUITY",
      payload: {
        ...input.payload,
        selectedCommand: family,
        ...(input.payload.reviewId === undefined
          ? {
              reviewId:
                direct.dimensions.P === "P1" || direct.dimensions.mode === "FIRST"
                  ? GOLDEN_P1_REVIEW_ID
                  : "review-1",
            }
          : {}),
      },
    };
  input = { ...input, expectedVersions: {} };
  input = {
    ...input,
    expectedVersions: {
      ...(await new PostgresManualResolutionAdapter(pool, {
        schema,
      }).discoverRequiredCurrentExpectations(input)),
    },
  };
  return { input, direct };
}

function uniquePlanRows(plan: CommandMutationPlanV1) {
  const rows = [
    ...plan.domainMutationPlan.creates,
    ...plan.domainMutationPlan.updates,
    ...plan.domainMutationPlan.supersedes,
    ...plan.domainMutationPlan.mappings,
  ];
  return rows.filter(
    (row, index) =>
      rows.findIndex((candidate) => candidate.table === row.table && candidate.id === row.id) ===
      index,
  );
}

async function count(client: PoolClient, table: string): Promise<number> {
  const result = await client.query<{ count: string }>(`SELECT count(*) FROM ${table}`);
  return Number(result.rows[0]?.count ?? "0");
}

describe("M02 durable PostgreSQL command adapter", () => {
  beforeAll(async () => {
    [
      migration001,
      migration002,
      typedProjectorSource,
      humanProjectorSource,
      commandPlanSource,
      postgresAdapterSource,
    ] = await Promise.all([
      readFile(migration001Url, "utf8"),
      readFile(migration002Url, "utf8"),
      readFile(typedProjectorUrl, "utf8"),
      readFile(humanProjectorUrl, "utf8"),
      readFile(commandPlanUrl, "utf8"),
      readFile(postgresAdapterUrl, "utf8"),
    ]);
  });

  afterAll(async () => {
    try {
      const actual = [
        finalizeExecutedEvidence("F36"),
        finalizeExecutedEvidence("F37"),
        finalizeExecutedEvidence("F38"),
        finalizeExecutedEvidence("F39"),
        finalizeExecutedEvidence("F40"),
        finalizeExecutedEvidence("F41"),
      ];
      expect(actual, "F36-F41:manifest-executable-evidence").toEqual(
        actual.map(({ id }) => expectedEvidence.get(id)),
      );
    } finally {
      await harness.stop();
    }
  });

  it("contains no generic mutation descriptor or optional-intent SQL fallback", () => {
    expect(typedProjectorSource).not.toMatch(/recordRow|TABLE_BY_RECORD_PREFIX/u);
    expect(typedProjectorSource).not.toContain("LOCK_TABLE_BY_PREFIX");
    expect(typedProjectorSource).not.toContain("ManualResolutionCoordinator");
    expect(typedProjectorSource).not.toContain("loadTypedCoordinator");
    expect(typedProjectorSource).not.toMatch(/intent\?\.[A-Za-z_]+\s*\?\?/u);
    expect(typedProjectorSource).not.toMatch(/planned\([^)]*\)\?\.[A-Za-z_]+\s*\?\?/u);
    expect(postgresAdapterSource).not.toContain("isPotentiallyRetryableUnique");
    expect(postgresAdapterSource).toContain("classifyUniqueConflictAfterRollback");
    expect(postgresAdapterSource).toContain("row.canonical_payload");
    expect(postgresAdapterSource).not.toContain("ManualResolutionCoordinator");
    expect(typedProjectorSource).not.toContain('{ state: "BEFORE" }');
    expect(typedProjectorSource).not.toContain('{ state: "AFTER" }');
    expect(typedProjectorSource).toContain("exactOpenClarifications");
    expect(typedProjectorSource).toContain("for (const audit of plan.domainMutationPlan.audits)");
    const lockMethod = postgresAdapterSource.slice(
      postgresAdapterSource.indexOf("private async lockRequiredKeysInCanonicalOrder"),
      postgresAdapterSource.indexOf("private async assertTypedPlanPostconditions"),
    );
    expect(lockMethod.indexOf("pg_advisory_xact_lock")).toBeGreaterThanOrEqual(0);
    expect(lockMethod.indexOf("lockTypedRows")).toBeGreaterThan(
      lockMethod.indexOf("pg_advisory_xact_lock"),
    );
    expect(postgresAdapterSource).toContain("await this.assertTypedPlanPostconditions");
    const executeAttempt = postgresAdapterSource.slice(
      postgresAdapterSource.indexOf("private async executeAttempt"),
      postgresAdapterSource.indexOf("private async preflight"),
    );
    expect(executeAttempt.indexOf("const lockedRequirements")).toBeLessThan(
      executeAttempt.indexOf("await this.assertExpectedVersions"),
    );
    expect(
      executeAttempt.indexOf("preflight.plan.fingerprint !== lockedPlan.fingerprint"),
    ).toBeLessThan(executeAttempt.indexOf("await this.assertExpectedVersions"));
    const requirementDiscovery = postgresAdapterSource.slice(
      postgresAdapterSource.indexOf("private async deriveTypedRequirements"),
      postgresAdapterSource.indexOf("private async assertIdentityControlTuple"),
    );
    expect(
      requirementDiscovery.match(/captureRejectionCommand\?\.\(logicalCommand\)/gu),
    ).toHaveLength(2);
  });

  it("validates the immutable envelope and exact role matrix before database preflight", () => {
    const valid = completeEnvelope("CREATE_RESOURCE", 99_001);
    expect(() => {
      validateManualResolutionEnvelope(valid);
    }).not.toThrow();

    expect(() => {
      validateManualResolutionEnvelope({
        ...completeEnvelope("SPLIT_ROOTS", 99_002),
        actorRole: "EDITOR",
      });
    }).toThrow(expect.objectContaining({ code: "ROLE_NOT_AUTHORIZED" }));
    expect(() => {
      validateManualResolutionEnvelope({
        ...completeEnvelope("RESOLVE_AMBIGUITY", 99_003),
        actorRole: "EDITOR",
        payload: {
          ...completeEnvelope("SPLIT_ROOTS", 99_003).payload,
          reviewId: "review-1",
          selectedCommand: "SPLIT_ROOTS",
        },
      });
    }).toThrow(expect.objectContaining({ code: "ROLE_NOT_AUTHORIZED" }));
    expect(() => {
      validateManualResolutionEnvelope({
        ...completeEnvelope("CREATE_RESOURCE", 99_004),
        payload: { ...completeEnvelope("CREATE_RESOURCE", 99_004).payload, extra: "forbidden" },
      });
    }).toThrow(expect.objectContaining({ code: "COMMAND_SCHEMA_INVALID" }));
    expect(() => {
      validateManualResolutionEnvelope({
        ...completeEnvelope("REPLACE_M02_JOB", 99_005),
        reasonCode: "ADMINISTRATIVE_CORRECTION",
        evidenceIds: [],
      });
    }).toThrow(expect.objectContaining({ code: "TRANSITION_PROHIBITED" }));

    const executeBody = postgresAdapterSource.slice(
      postgresAdapterSource.indexOf("async execute(command"),
      postgresAdapterSource.indexOf("private async classifyUniqueConflictAfterRollback"),
    );
    expect(executeBody.indexOf("validateManualResolutionEnvelope(command)")).toBeGreaterThanOrEqual(
      0,
    );
    expect(executeBody.indexOf("validateManualResolutionEnvelope(command)")).toBeLessThan(
      executeBody.indexOf("commandFingerprint(command)"),
    );
  });

  it("discovers P/K/J and replacement modes from exact controlling typed lineage", () => {
    expect(postgresAdapterSource).toContain("assertIdentityControlTuple");
    expect(postgresAdapterSource).toContain("validateReplacementTransition");
    expect(postgresAdapterSource).toContain("invalidatedReplacementScopes");
    expect(humanProjectorSource).toContain("validateTopologyDiscovery");
    expect(humanProjectorSource).toContain("decision.outcome='AMBIGUOUS_IDENTITY'");
    expect(humanProjectorSource).toContain("handoff.identity_decision_id=decision.id");
    expect(humanProjectorSource).toContain("clarification.controlling_job_id=$1");
    expect(humanProjectorSource).toContain("handoff.controlling_m02_job_id=$2");
  });

  it("classifies a 23505 only against the exact failed canonical identity", () => {
    expect(postgresAdapterSource).toContain("failedCanonicalUniqueIdentity");
    expect(postgresAdapterSource).toContain("failedUnique.constraint");
    expect(postgresAdapterSource).toContain("failedUnique.detail");
    expect(postgresAdapterSource).toContain("uniqueDetailMatches");
    expect(postgresAdapterSource).not.toContain("for (const guard of preflight.guards.filter");
    expect(postgresAdapterSource).not.toContain(
      "for (const planned of preflight.plan.domainMutationPlan.creates)",
    );
  });

  it("allocates exact audit and plural topology IDs into the canonical plan", () => {
    expect(postgresAdapterSource).toContain('payload.auditIdsJson = "[]"');
    expect(typedProjectorSource).toContain('if (name === "auditIdsJson")');
    expect(commandPlanSource).toContain(
      "persistedAllocatedIds(resultId, auditBase, creates, audits)",
    );
    expect(commandPlanSource).toContain("`row:${row.table}:${row.id}`");
    const allocationBody = commandPlanSource.slice(
      commandPlanSource.indexOf("function persistedAllocatedIds"),
      commandPlanSource.indexOf("/**\n * Canonical runtime plan"),
    );
    expect(allocationBody).not.toContain("command.payload");
    expect(postgresAdapterSource).toContain("payload.priorRelationshipId === undefined");
    expect(postgresAdapterSource).toContain("delete payload.auditId");
    expect(postgresAdapterSource).not.toContain("Array.from({ length: 96 }");
  });

  it("requires the exact active link for A2 and preserves fork-correction source facts", () => {
    expect(humanProjectorSource).toContain("link.target_resource_version_id=$4");
    expect(humanProjectorSource).toContain("command.payload.priorResourceVersionIdentityId");
    expect(humanProjectorSource).toContain("priorLinks.rows.length !== 1 ||");
    expect(humanProjectorSource).toContain("links.rows.length !== 1 ||");
    expect(humanProjectorSource).toContain("activeLink.id !== command.payload.activeSourceLinkId");
    const attachAllocation = postgresAdapterSource.slice(
      postgresAdapterSource.indexOf('} else if (selected === "ATTACH_NEW_VERSION")'),
      postgresAdapterSource.indexOf('} else if (selected === "MARK_FORK")'),
    );
    expect(attachAllocation).toContain("if (versionId === undefined)");
    expect(attachAllocation).toContain("payload.priorResourceVersionIdentityId");
    expect(attachAllocation).toContain("payload.activeSourceLinkId = existingPriorLink.id");
    expect(attachAllocation).toContain("link.rows.length !== 1 ||");
    expect(attachAllocation).not.toContain("link.rows[0]?.id ?? allocateM02Id()");
    expect(postgresAdapterSource).toContain("source_link_id: string; observation_id: string");
    expect(postgresAdapterSource).toContain("if (preserved.length !== 1)");
  });

  it("preserves ownership multiplicity and the independent golden target-set union", () => {
    expect(typedProjectorSource).not.toContain("new Map<string, string>()");
    expect(typedProjectorSource).toContain("ownershipPairs");
    expect(postgresAdapterSource).toContain("retainedOrRetiredOwnershipCount");
    expect(postgresAdapterSource).toContain("created: intents.creates.map");
    expect(postgresAdapterSource).toContain("updated: intents.updates.map");
    expect(postgresAdapterSource).toContain("superseded: intents.supersedes.map");
    expect(
      canonicalOrderedTargetIds({
        created: ["created-b", "created-a"],
        reused: ["reused", "created-a"],
        updated: ["updated"],
        superseded: ["superseded", "updated"],
      }),
    ).toEqual(["created-a", "created-b", "reused", "superseded", "updated"]);
  });

  it("models exact A2, fork-correction, override, and merge cardinalities independently", () => {
    const mode = (id: string): HumanProjectionMode => {
      const found = humanProjectionModes().find(({ expansionId }) => expansionId === id);
      if (found === undefined) throw new Error(`MODE_NOT_FOUND:${id}`);
      return found;
    };
    const a2 = goldenProjectionCase(mode("ATTACH_NEW_VERSION:A2:P1:K0:JR"));
    expect(a2.exactCreateCounts.resource_source_links).toBeUndefined();
    expect(a2.exactCreateCounts.resource_version_observations).toBe(1);

    const forkCorrection = goldenProjectionCase(mode("MARK_FORK:CORRECTION:K0:JR"));
    expect(forkCorrection.exactCreateCounts.resource_source_links).toBeUndefined();
    expect(forkCorrection.exactCreateCounts.resource_version_observations).toBeUndefined();
    expect(forkCorrection.exactCreateCounts.m02_identity_handoff_markers).toBeUndefined();
    expect(forkCorrection.exactCreateCounts.fork_relationships).toBe(1);

    const override = goldenProjectionCase(mode("OVERRIDE_NON_SKILL:K0"));
    expect(override.exactSupersedeCounts).toEqual({
      repository_candidate_groups: 1,
      m02_review_states: 1,
    });

    const merge = goldenProjectionCase(mode("MERGE_ROOTS:K0"));
    expect(merge.exactSupersedeCounts.resource_candidates).toBe(2);
    expect(merge.exactSupersedeCounts.candidate_roots).toBe(2);
    expect(merge.exactSupersedeCounts.identity_decisions).toBe(2);
    expect(merge.exactSupersedeCounts.m02_review_states).toBe(2);
    expect(merge.exactCreateCounts.m02_root_replacements).toBe(2);
    expect(merge.exactCreateCounts.m02_candidate_replacements).toBe(2);
  });

  it("defines the exact golden 256 projection oracle with no aliases or empty families", () => {
    expect(golden256).toHaveLength(256);
    expect(new Set(golden256.map(({ expansionId }) => expansionId))).toHaveLength(256);
    const familyCounts = Object.fromEntries(
      [...new Set(golden256.map(({ family }) => family))].map((family) => [
        family,
        golden256.filter((entry) => entry.family === family).length,
      ]),
    );
    expect(familyCounts).toEqual({
      CREATE_RESOURCE: 12,
      ATTACH_NEW_VERSION: 36,
      MARK_FORK: 12,
      MARK_MIRROR: 18,
      MARK_DUPLICATE: 18,
      REJECT_CANDIDATE: 18,
      SPLIT_ROOTS: 3,
      MERGE_ROOTS: 3,
      OVERRIDE_NON_SKILL: 3,
      REQUEST_CLARIFICATION: 6,
      RESOLVE_AMBIGUITY: 123,
      REPLACE_M02_JOB: 4,
    });
    for (const entry of golden256) {
      expect(
        entry.requiredCreateTables.length + entry.requiredUpdateTables.length,
        entry.expansionId,
      ).toBeGreaterThan(0);
      expect(entry.requiredCreateTables, entry.expansionId).not.toContain(
        "m02_command_domain_records",
      );
      expect(entry.requiredUpdateTables, entry.expansionId).not.toContain(
        "m02_command_domain_records",
      );
    }
  });

  it("rejects independently valid but cross-lineage identity target tuples", async () => {
    const pool = await harness.start();
    const schema = "m02_identity_control_tuple";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("CREATE_RESOURCE", 99_100);
    await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
    await pool.query(
      `INSERT INTO ${schema}.repository_candidate_groups
         (id,source_snapshot_id,classification_policy_version,group_key,group_fingerprint,
          classification,ordered_candidate_root_ids,ordered_evidence_reference_ids,
          ordered_warning_codes,ordered_reason_codes,review_state,identity_policy_version,
          parser_profile_version,analysis_policy_version,prompt_bundle_version,state,created_at,record_version)
       SELECT 'group-other',source_snapshot_id,classification_policy_version,
          group_key || ':other',group_fingerprint,classification,ordered_candidate_root_ids,
          ordered_evidence_reference_ids,ordered_warning_codes,ordered_reason_codes,review_state,
          identity_policy_version,parser_profile_version,analysis_policy_version,
          prompt_bundle_version,state,now(),1
       FROM ${schema}.repository_candidate_groups WHERE id='group-1';
       INSERT INTO ${schema}.acquisition_jobs
         (id,submission_id,idempotency_key,status,current_stage,attempt,source_snapshot_id,
          completed_stages,warnings,cancellation_requested,record_version)
       VALUES ('job-other','lineage-other','acq-job-other','OPERATOR_REVIEW_REQUIRED',
          'INVENTORYING_SOURCE',1,'snapshot-1','["ACQUIRED"]','[]',false,1);
       INSERT INTO ${schema}.m02_jobs
         (id,job_lineage_id,source_snapshot_id,operation_scope,current_stage,review_state,
          supersession_state,supersession_sequence,job_scope_key,input_fingerprint,
          classification_policy_version,identity_policy_version,analysis_policy_version,
          prompt_bundle_version,record_version)
       VALUES ('job-other','lineage-other','snapshot-1','IDENTITY_RESOLUTION','RESOLVING_IDENTITY',
          'IDENTITY_REVIEW_REQUIRED','CONTROLLING',1,repeat('7',64),repeat('8',64),
          'classification-v1','identity-v1','analysis-v1','prompt-v1',1);
       INSERT INTO ${schema}.m02_review_states
         (id,group_id,resource_candidate_id,review_state,record_version,source_snapshot_id,controlling_job_id)
       VALUES ('review-other','group-other','candidate-1','IDENTITY_REVIEW_REQUIRED',1,
          'snapshot-1','job-other')`,
    );
    const mismatched = {
      ...prepared.input,
      targetGroupId: "group-other",
      expectedVersions: {},
      payload: { ...prepared.input.payload, jobId: "job-other", reviewId: "review-other" },
    };
    await expect(
      new PostgresManualResolutionAdapter(pool, { schema }).discoverRequiredCurrentExpectations(
        mismatched,
      ),
    ).rejects.toMatchObject({ code: "REFERENCE_INVALID" });
    await harness.stop();
  }, 120_000);

  it("reports locked plan drift before expected-version drift", async () => {
    const pool = await harness.start();
    const schema = "m02_locked_plan_precedence";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("CREATE_RESOURCE", 99_101);
    await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
    const clarificationTarget = canonicalGuard("CLARIFICATION_TARGET", {
      targetType: "CANDIDATE_GROUP",
      targetId: "run-1",
    });
    expect(prepared.input.expectedVersions[clarificationTarget.key]).toBeNull();
    const adapter = new PostgresManualResolutionAdapter(pool, {
      schema,
      onAttemptOpened: async () => {
        await pool.query(
          `INSERT INTO ${schema}.m02_concurrency_guards
             (guard_key,guard_type,canonical_payload,payload_hash,record_version)
           VALUES ($1,$2,$3,$4,1)`,
          [
            clarificationTarget.key,
            clarificationTarget.guardType,
            Buffer.from(clarificationTarget.canonicalPayload),
            createHash("sha256").update(clarificationTarget.canonicalPayload).digest("hex"),
          ],
        );
      },
    });
    await expect(adapter.execute(prepared.input)).rejects.toMatchObject({
      code: "MUTATION_PLAN_CHANGED",
    });
    const planDriftReceipt = (
      await pool.query<{
        command_count: string;
        guard_version: string;
        result_count: string;
      }>(
        `SELECT
          (SELECT count(*) FROM ${schema}.manual_resolution_commands WHERE id=$1)::text AS command_count,
          (SELECT record_version::text FROM ${schema}.m02_concurrency_guards WHERE guard_key=$2)
            AS guard_version,
          (SELECT count(*) FROM ${schema}.m02_manual_command_results WHERE command_id=$1)::text
            AS result_count`,
        [prepared.input.commandId, clarificationTarget.key],
      )
    ).rows[0];
    expect(planDriftReceipt).toEqual({ command_count: "0", guard_version: "1", result_count: "0" });
    humanExecutedReceipts.record("F36", "concurrency.plan_drift", planDriftReceipt);
    await harness.stop();
  }, 120_000);

  it("executes all 256 golden PostgreSQL projection modes without leaking case state", async () => {
    const pool = await harness.start();
    const schema = "m02_golden_256";
    await migrateSchema(pool, schema);
    const committedModeIds: string[] = [];
    const modeReceipts: unknown[] = [];
    const topologyReceipts: unknown[] = [];
    const replacementReceipts: unknown[] = [];
    const auditReceipts: unknown[] = [];
    const mappingAuditReceipts: unknown[] = [];
    const guardReceipts: unknown[] = [];
    try {
      for (const [index, mode] of humanProjectionModes().entries()) {
        if (index > 0) await resetGoldenSchema(pool, schema);
        const client = await pool.connect();
        let setupCommitted = false;
        try {
          await client.query("BEGIN");
          await client.query(`SET LOCAL search_path TO ${schema}, public`);
          await client.query("SET CONSTRAINTS ALL DEFERRED");
          const transactionPool = transactionBoundPool(client);
          const expected = golden256[index];
          if (expected === undefined) throw new Error(`GOLDEN_ORACLE_MISSING:${mode.expansionId}`);
          const { input } = await prepareGoldenExecution(
            transactionPool,
            client,
            schema,
            mode,
            index,
          );
          await client.query("COMMIT");
          setupCommitted = true;
          await client.query(`SET search_path TO ${schema}, public`);
          let finalizedPlan: CommandMutationPlanV1 | undefined;
          await new PostgresManualResolutionAdapter(pool, {
            schema,
            onPlanFinalized: (plan) => {
              finalizedPlan = plan;
            },
          }).execute(input);
          if (finalizedPlan === undefined)
            throw new Error(`GOLDEN_PLAN_NOT_FINALIZED:${mode.expansionId}`);
          const plan = finalizedPlan;
          expect(plan.concurrencyPlan.expansionId, mode.expansionId).toBe(mode.expansionId);

          const createTables = new Set(plan.domainMutationPlan.creates.map(({ table }) => table));
          const updateTables = new Set(
            [...plan.domainMutationPlan.updates, ...plan.domainMutationPlan.supersedes].map(
              ({ table }) => table,
            ),
          );
          for (const table of expected.requiredCreateTables)
            expect(createTables.has(table), `${mode.expansionId}:create:${table}`).toBe(true);
          for (const table of expected.requiredUpdateTables)
            expect(updateTables.has(table), `${mode.expansionId}:update:${table}`).toBe(true);
          const countByTable = (rows: readonly { readonly table: string }[]) =>
            Object.fromEntries(
              [...new Set(rows.map(({ table }) => table))]
                .sort()
                .map((table) => [table, rows.filter((row) => row.table === table).length]),
            );
          expect(
            countByTable(plan.domainMutationPlan.creates),
            `${mode.expansionId}:independent-exact-create-counts`,
          ).toEqual(expected.exactCreateCounts);
          expect(
            countByTable(plan.domainMutationPlan.updates),
            `${mode.expansionId}:independent-exact-update-counts`,
          ).toEqual(expected.exactUpdateCounts);
          expect(
            countByTable(plan.domainMutationPlan.supersedes),
            `${mode.expansionId}:independent-exact-supersede-counts`,
          ).toEqual(expected.exactSupersedeCounts);
          expect(
            plan.concurrencyPlan.guardPlan.map(({ guardType }) => guardType).sort(),
            `${mode.expansionId}:independent-exact-guard-types`,
          ).toEqual(expected.exactGuardTypes);

          const persistedPlanRows: unknown[] = [];
          for (const intent of uniquePlanRows(plan)) {
            const persisted = (
              await client.query<{ value: Record<string, unknown> }>(
                `SELECT to_jsonb(row_value) AS value FROM ${intent.table} row_value WHERE id=$1`,
                [intent.id],
              )
            ).rows[0]?.value;
            const normalizedPersisted = normalizeDatabaseValue(persisted);
            expect(
              normalizedPersisted,
              `${mode.expansionId}:${intent.table}:${intent.id}:complete-plan-equality`,
            ).toEqual(normalizeDatabaseValue(intent.completeTypedValues));
            persistedPlanRows.push({
              table: intent.table,
              id: intent.id,
              value: normalizedPersisted,
            });
          }

          const persistedResult = (
            await client.query<{ value: Record<string, unknown> }>(
              `SELECT to_jsonb(row_value) AS value FROM m02_manual_command_results row_value
               WHERE command_id=$1`,
              [input.commandId],
            )
          ).rows[0]?.value;
          expect(
            normalizeDatabaseValue(persistedResult),
            `${mode.expansionId}:complete-result-plan-equality`,
          ).toEqual(
            normalizeDatabaseValue({
              ...plan.domainMutationPlan.result.completeTypedValues,
              mutation_plan_fingerprint: plan.fingerprint,
            }),
          );
          expect(persistedResult?.identity_projection_mode_id, mode.expansionId).toBe(
            expected.requiredResultMode,
          );
          expect(persistedResult?.identity_outcome, mode.expansionId).toBe(
            expected.requiredOutcome,
          );
          const identitySetCardinalities = {
            createdResources: (persistedResult?.created_resource_identity_ids as unknown[]).length,
            reusedResources: (persistedResult?.reused_resource_identity_ids as unknown[]).length,
            createdVersions: (persistedResult?.created_resource_version_identity_ids as unknown[])
              .length,
            reusedVersions: (persistedResult?.reused_resource_version_identity_ids as unknown[])
              .length,
          };
          expect(
            identitySetCardinalities,
            `${mode.expansionId}:independent-identity-set-cardinalities`,
          ).toEqual(expected.identitySetCardinalities);
          let finalCandidateReceipt: JsonValue = null;
          if (expected.finalCandidate !== null) {
            const candidate = (
              await client.query<{
                identity_outcome: string | null;
                record_version: string;
                resource_identity_id: string | null;
                resource_version_identity_id: string | null;
                status: string;
              }>(
                `SELECT status,identity_outcome,resource_identity_id,
                        resource_version_identity_id,record_version
                 FROM resource_candidates WHERE id=$1`,
                [input.targetCandidateId],
              )
            ).rows[0];
            expect(
              candidate === undefined
                ? undefined
                : {
                    status: candidate.status,
                    identity_outcome: candidate.identity_outcome,
                    record_version: Number(candidate.record_version),
                  },
              `${mode.expansionId}:independent-final-candidate`,
            ).toEqual({
              status: expected.finalCandidate.status,
              identity_outcome: expected.finalCandidate.outcome,
              record_version: expected.finalCandidate.recordVersion,
            });
            expect(candidate?.resource_identity_id !== null).toBe(
              expected.finalCandidate.hasResourceIdentity,
            );
            expect(candidate?.resource_version_identity_id !== null).toBe(
              expected.finalCandidate.hasResourceVersionIdentity,
            );
            finalCandidateReceipt = {
              status: candidate?.status ?? null,
              identityOutcome: candidate?.identity_outcome ?? null,
              recordVersion: Number(candidate?.record_version ?? "0"),
              hasResourceIdentity: candidate?.resource_identity_id !== null,
              hasResourceVersionIdentity: candidate?.resource_version_identity_id !== null,
            };
          }

          const persistedAudits = (
            await client.query<{
              action: string;
              id: string;
              subject_id: string;
              subject_type: string;
            }>(
              `SELECT id,action,subject_type,subject_id FROM m02_audit_events
               WHERE command_id=$1 ORDER BY convert_to(id,'UTF8')`,
              [input.commandId],
            )
          ).rows;
          const replacementEdges = (
            await client.query<{ id: string }>(
              `SELECT id FROM m02_job_supersessions
               WHERE command_id=$1 ORDER BY convert_to(id,'UTF8')`,
              [input.commandId],
            )
          ).rows.map(({ id }) => id);
          const independentlyObservedTargets = [
            ...new Set([
              ...Object.entries(input.expectedVersions).flatMap(([key, version]) =>
                key.startsWith("row:") && version !== null
                  ? [key.split(":").slice(2).join(":")]
                  : [],
              ),
              ...persistedAudits.flatMap(({ action, subject_id }) =>
                action.startsWith("SUBJECT_") ? [subject_id] : [],
              ),
              ...replacementEdges,
            ]),
          ].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
          expect(
            persistedResult?.ordered_target_ids,
            `${mode.expansionId}:independent-created-reused-updated-superseded-target-union`,
          ).toEqual(independentlyObservedTargets);
          expect(persistedAudits, `${mode.expansionId}:exact-audit-formula`).toEqual(
            [...plan.domainMutationPlan.audits]
              .map(({ id, action, subjectType, subjectId }) => ({
                id,
                action,
                subject_type: subjectType,
                subject_id: subjectId,
              }))
              .sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id))),
          );
          const expectedAuditCount =
            1 +
            Object.values(expected.exactCreateCounts).reduce((sum, count) => sum + count, 0) +
            Object.values(expected.exactUpdateCounts).reduce((sum, count) => sum + count, 0) +
            Object.values(expected.exactSupersedeCounts).reduce((sum, count) => sum + count, 0) -
            (expected.exactCreateCounts.m02_job_supersessions ?? 0);
          expect(
            persistedAudits.length,
            `${mode.expansionId}:independent-exact-audit-cardinality`,
          ).toBe(expectedAuditCount);
          const expectedAuditSubjects: Record<string, number> = {};
          const addExpectedAudits = (
            rows: Readonly<Record<string, number>>,
            action: "SUBJECT_CREATED" | "SUBJECT_UPDATED" | "SUBJECT_SUPERSEDED",
          ): void => {
            for (const [table, tableCount] of Object.entries(rows)) {
              if (table === "m02_job_supersessions") continue;
              const subject = GOLDEN_AUDIT_SUBJECT_BY_TABLE[table];
              if (subject === undefined) throw new Error(`GOLDEN_SUBJECT_MISSING:${table}`);
              const effectiveAction =
                table === "acquisition_jobs" && action === "SUBJECT_SUPERSEDED"
                  ? "SUBJECT_UPDATED"
                  : action;
              const key = `${effectiveAction}:${subject}`;
              expectedAuditSubjects[key] = (expectedAuditSubjects[key] ?? 0) + tableCount;
            }
          };
          addExpectedAudits(expected.exactCreateCounts, "SUBJECT_CREATED");
          addExpectedAudits(expected.exactUpdateCounts, "SUBJECT_UPDATED");
          addExpectedAudits(expected.exactSupersedeCounts, "SUBJECT_SUPERSEDED");
          const actualAuditSubjects = Object.fromEntries(
            [
              ...new Set(
                persistedAudits
                  .filter(({ action }) => action !== "COMMAND_ACCEPTED")
                  .map(({ action, subject_type }) => `${action}:${subject_type}`),
              ),
            ]
              .sort()
              .map((key) => [
                key,
                persistedAudits.filter(
                  ({ action, subject_type }) => `${action}:${subject_type}` === key,
                ).length,
              ]),
          );
          expect(
            actualAuditSubjects,
            `${mode.expansionId}:independent-exact-audit-subject-actions`,
          ).toEqual(expectedAuditSubjects);

          const auditTransitionRows = (
            await client.query<{
              action: string;
              after_state: unknown;
              after_version: string | null;
              before_state: unknown;
              before_version: string | null;
              subject_id: string;
              subject_type: string;
            }>(
              `SELECT action,subject_type,subject_id,before_version::text,after_version::text,
                      before_state,after_state
               FROM m02_audit_events WHERE command_id=$1
               ORDER BY convert_to(id,'UTF8')`,
              [input.commandId],
            )
          ).rows;
          expect(auditTransitionRows).toHaveLength(persistedAudits.length);
          const auditTransitions = auditTransitionRows
            .map((row) => ({
              action: row.action,
              subjectType: row.subject_type,
              beforeVersion: row.before_version,
              afterVersion: row.after_version,
              beforeState: stableStateReceipt(row.before_state),
              afterState: stableStateReceipt(row.after_state),
            }))
            .sort((left, right) =>
              Buffer.compare(Buffer.from(canonicalJson(left)), Buffer.from(canonicalJson(right))),
            );

          const persistedGuardRows: unknown[] = [];
          for (const guard of plan.concurrencyPlan.guardPlan) {
            const persisted = (
              await client.query<{
                canonical_payload_base64: string;
                guard_type: string;
                record_version: string;
              }>(
                `SELECT replace(encode(canonical_payload,'base64'), E'\\n', '') AS canonical_payload_base64,
                        guard_type,record_version
                 FROM m02_concurrency_guards WHERE guard_key=$1`,
                [guard.key],
              )
            ).rows[0];
            expect(
              persisted === undefined
                ? undefined
                : { ...persisted, record_version: Number(persisted.record_version) },
              `${mode.expansionId}:guard:${guard.key}`,
            ).toEqual({
              canonical_payload_base64: guard.canonicalPayloadBase64,
              guard_type: guard.guardType,
              record_version:
                guard.operation === "CREATE"
                  ? 1
                  : guard.operation === "INCREMENT"
                    ? (guard.expectedVersion ?? 0) + 1
                    : guard.expectedVersion,
            });
            persistedGuardRows.push({
              guardKey: guard.key,
              expectedOperation: guard.operation,
              persisted: normalizeDatabaseValue(persisted),
            });
          }
          expect(
            Number(
              (
                await client.query<{ count: string }>(
                  "SELECT count(*) FROM m02_command_domain_records",
                )
              ).rows[0]?.count ?? "0",
            ),
            `${mode.expansionId}:zero-generic-ledger`,
          ).toBe(0);

          const receipt = {
            expansionId: mode.expansionId,
            family: mode.family,
            typedPlanRows: persistedRowsReceipt(persistedPlanRows),
            result: stableStateReceipt(persistedResult),
            identitySetCardinalities,
            finalCandidate: finalCandidateReceipt,
            auditCount: auditTransitions.length,
            guardCount: persistedGuardRows.length,
            typedPlanEquality: true,
            typedResultEquality: true,
            postconditionsMatched: true,
          };
          committedModeIds.push(mode.expansionId);
          modeReceipts.push(receipt);
          auditReceipts.push({
            expansionId: mode.expansionId,
            transitions: auditTransitions,
          });
          guardReceipts.push({
            expansionId: mode.expansionId,
            guards: persistedGuardRows,
          });
          if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(mode.family)) {
            const topologyReceipt = {
              expansionId: mode.expansionId,
              rows: persistedRowsReceipt(
                persistedPlanRows.filter(
                  (row) =>
                    typeof row === "object" &&
                    row !== null &&
                    "table" in row &&
                    [
                      "candidate_roots",
                      "resource_candidates",
                      "candidate_root_ownership",
                      "repository_group_relationships",
                      "m02_root_replacements",
                      "m02_candidate_replacements",
                      "m02_ownership_replacements",
                      "m02_group_edge_replacements",
                    ].includes(String(row.table)),
                ),
              ),
              audits: auditTransitions,
            };
            topologyReceipts.push(topologyReceipt);
            mappingAuditReceipts.push({
              expansionId: mode.expansionId,
              mappingRows: persistedRowsReceipt(
                persistedPlanRows.filter(
                  (row) =>
                    typeof row === "object" &&
                    row !== null &&
                    "table" in row &&
                    String(row.table).startsWith("m02_") &&
                    String(row.table).endsWith("_replacements"),
                ),
              ),
              audits: auditTransitions,
            });
          }
          if (mode.family === "REPLACE_M02_JOB")
            replacementReceipts.push({
              expansionId: mode.expansionId,
              rows: persistedRowsReceipt(persistedPlanRows),
              audits: auditTransitions,
            });
        } catch (error) {
          if (!setupCommitted) await client.query("ROLLBACK");
          throw new Error(`${mode.expansionId}: ${(error as Error).message}`, { cause: error });
        } finally {
          client.release();
        }
      }
      expect(committedModeIds).toHaveLength(256);
      expect(new Set(committedModeIds).size).toBe(256);
      expect(modeReceipts).toHaveLength(256);
      expect(topologyReceipts).toHaveLength(9);
      expect(replacementReceipts).toHaveLength(4);
      expect(auditReceipts).toHaveLength(256);
      expect(mappingAuditReceipts).toHaveLength(9);
      expect(guardReceipts).toHaveLength(256);
      humanExecutedReceipts.record("F37", "modes.committed_ids", committedModeIds);
      humanExecutedReceipts.record("F37", "modes.plan_result_postconditions", modeReceipts);
      humanExecutedReceipts.record("F38", "topology.rows_mappings_history", topologyReceipts);
      humanExecutedReceipts.record(
        "F39",
        "replacement.modes_and_predecessors",
        replacementReceipts,
      );
      humanExecutedReceipts.record("F40", "audits.actions_subjects_before_after", auditReceipts);
      humanExecutedReceipts.record("F40", "audits.mapping_cardinality", mappingAuditReceipts);
      humanExecutedReceipts.record("F41", "guards.all_mode_rows", guardReceipts);
    } finally {
      await harness.stop();
    }
  }, 900_000);

  it("executes a command atomically and replays its result after adapter restart", async () => {
    const pool = await harness.start();
    await createSchema(pool, "m02_command_restart");
    await pool.query(
      `SET search_path TO m02_command_restart, public;
       SET session_replication_role = 'replica';
       DELETE FROM identity_decisions WHERE id='decision-seed';
       UPDATE resource_candidates
       SET status='CLASSIFIED',identity_outcome=NULL,resource_identity_id=NULL,
           resource_version_identity_id=NULL,record_version=1
       WHERE id='candidate-1';
       SET session_replication_role = 'origin'`,
    );
    const provisionalCommand = rejectionCommand();
    let finalizedPlan: CommandMutationPlanV1 | undefined;
    const firstAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: "m02_command_restart",
      onPlanFinalized: (plan) => {
        finalizedPlan = plan;
      },
    });
    const command = {
      ...provisionalCommand,
      expectedVersions: {
        ...(await firstAdapter.discoverRequiredCurrentExpectations(provisionalCommand)),
      },
    };
    expect(
      Object.keys(command.expectedVersions).filter((key) => !key.startsWith("guard:")),
    ).toSatisfy((keys: string[]) => keys.length > 0 && keys.every((key) => key.startsWith("row:")));
    const first = await firstAdapter.execute(command);
    const replay = await new PostgresManualResolutionAdapter(pool, {
      schema: "m02_command_restart",
    }).execute(command);
    expect(replay).toEqual(first);
    expect(first.transactionIsolation).toBe("SERIALIZABLE");

    const client = await pool.connect();
    try {
      await client.query("SET search_path TO m02_command_restart");
      expect(
        Number(
          (
            await client.query<{ count: string }>(
              "SELECT count(*) FROM manual_resolution_commands WHERE id='command-reject-1'",
            )
          ).rows[0]?.count,
        ),
      ).toBe(1);
      expect(await count(client, "m02_audit_events")).toBeGreaterThan(1);
      expect(await count(client, "m02_concurrency_guards")).toBe(2);
      expect(
        (
          await client.query<{ record_version: string; status: string }>(
            "SELECT record_version, status FROM resource_candidates WHERE id = 'candidate-1'",
          )
        ).rows[0],
      ).toEqual({ record_version: "2", status: "REJECTED" });
      expect(await count(client, "m02_candidate_rejection_decisions")).toBe(1);
      const rejectionIntent = finalizedPlan?.domainMutationPlan.creates.find(
        (row) => row.table === "m02_candidate_rejection_decisions",
      );
      expect(rejectionIntent).toBeDefined();
      const persistedRejection = (
        await client.query<{ value: Record<string, unknown> }>(
          "SELECT to_jsonb(row) AS value FROM m02_candidate_rejection_decisions row WHERE id=$1",
          [rejectionIntent?.id],
        )
      ).rows[0]?.value;
      expect(normalizeDatabaseValue(persistedRejection)).toEqual(
        normalizeDatabaseValue(rejectionIntent?.completeTypedValues),
      );
      expect(await count(client, "m02_command_domain_records")).toBe(0);
      const replayReceipt = (
        await client.query<{
          audit_count: string;
          candidate_version: string;
          command_count: string;
          guard_count: string;
          rejection_count: string;
          result_count: string;
        }>(
          `SELECT
            (SELECT count(*) FROM manual_resolution_commands WHERE id=$1)::text AS command_count,
            (SELECT count(*) FROM m02_manual_command_results WHERE command_id=$1)::text AS result_count,
            (SELECT count(*) FROM m02_audit_events WHERE command_id=$1)::text AS audit_count,
            (SELECT count(*) FROM m02_concurrency_guards)::text AS guard_count,
            (SELECT count(*) FROM m02_candidate_rejection_decisions WHERE command_id=$1)::text
              AS rejection_count,
            (SELECT record_version::text FROM resource_candidates WHERE id='candidate-1')
              AS candidate_version`,
          [command.commandId],
        )
      ).rows[0];
      expect(replayReceipt).toMatchObject({
        command_count: "1",
        result_count: "1",
        guard_count: "2",
        rejection_count: "1",
        candidate_version: "2",
      });
      expect(Number(replayReceipt?.audit_count ?? "0")).toBeGreaterThan(1);
      humanExecutedReceipts.record("F36", "concurrency.replay", {
        sameResult:
          canonicalJson(normalizeDatabaseValue(replay)) ===
          canonicalJson(normalizeDatabaseValue(first)),
        sameCommandId: replay.commandId === first.commandId,
        sameRequestId: replay.requestId === first.requestId,
        sameOrderedTargets:
          canonicalJson(replay.orderedTargetIds) === canonicalJson(first.orderedTargetIds),
        transactionIsolation: first.transactionIsolation,
        rows: replayReceipt ?? null,
      });
    } finally {
      client.release();
      await harness.stop();
    }
  }, 120_000);

  it("rejects a fixed-null canonical-guard loser after the locked fresh read", async () => {
    const pool = await harness.start();
    try {
      await createSchema(pool, "m02_command_concurrency");
      await pool.query(
        `SET search_path TO m02_command_concurrency, public;
       SET session_replication_role = 'replica';
       DELETE FROM identity_decisions WHERE id='decision-seed';
       UPDATE resource_candidates
       SET status='CLASSIFIED',identity_outcome=NULL,resource_identity_id=NULL,
           resource_version_identity_id=NULL,record_version=1
       WHERE id='candidate-1';
       SET session_replication_role = 'origin'`,
      );
      const attemptsA: number[] = [];
      const attemptsB: number[] = [];
      const uniqueViolations: { constraint?: string; detail?: string; table?: string }[] = [];
      let openedAttempts = 0;
      let releasePreflightBarrier!: () => void;
      const preflightBarrier = new Promise<void>((resolve) => {
        releasePreflightBarrier = resolve;
      });
      const waitForBothPreflights = async (): Promise<void> => {
        openedAttempts += 1;
        if (openedAttempts === 2) releasePreflightBarrier();
        await preflightBarrier;
      };
      const adapterA = new PostgresManualResolutionAdapter(pool, {
        schema: "m02_command_concurrency",
        onAttemptOpened: async (attempt) => {
          attemptsA.push(attempt);
          await waitForBothPreflights();
        },
        onUniqueViolation: (evidence) => uniqueViolations.push(evidence),
      });
      const adapterB = new PostgresManualResolutionAdapter(pool, {
        schema: "m02_command_concurrency",
        onAttemptOpened: async (attempt) => {
          attemptsB.push(attempt);
          await waitForBothPreflights();
        },
        onUniqueViolation: (evidence) => uniqueViolations.push(evidence),
      });
      const provisionalA = rejectionCommand();
      const provisionalB = rejectionCommand({
        commandId: "command-reject-2",
        requestId: "request-reject-2",
        idempotencyKey: "idempotency-reject-2",
        expectedVersions: {},
        payload: {
          auditId: "audit-reject-2",
          decisionId: "decision-reject-2",
          jobId: "job-1",
        },
      });
      const commandA = {
        ...provisionalA,
        expectedVersions: {
          ...(await adapterA.discoverRequiredCurrentExpectations(provisionalA)),
        },
      };
      const commandB = {
        ...provisionalB,
        expectedVersions: {
          ...(await adapterB.discoverRequiredCurrentExpectations(provisionalB)),
        },
      };
      const outcomes = await Promise.allSettled([
        adapterA.execute(commandA),
        adapterB.execute(commandB),
      ]);
      const winnerCount = outcomes.filter(({ status }) => status === "fulfilled").length;
      const rejectedOutcome = outcomes.find(({ status }) => status === "rejected");
      const loserCode =
        rejectedOutcome?.status === "rejected"
          ? (rejectedOutcome.reason as { readonly code?: unknown }).code
          : undefined;
      const attemptVectors = [attemptsA, attemptsB].sort(
        (left, right) => right.length - left.length,
      );
      expect(winnerCount).toBe(1);
      expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
      expect(
        rejectedOutcome,
        "fixed-null loser must re-discover the positive guard after rollback",
      ).toMatchObject({ status: "rejected", reason: { code: "EXPECTED_VERSION_SET_INVALID" } });
      expect(loserCode).toBe("EXPECTED_VERSION_SET_INVALID");
      expect(attemptVectors).toEqual([[1], [1]]);
      expect(uniqueViolations, "the advisory guard lock must prevent a 23505 retry path").toEqual(
        [],
      );
      const acceptedResultCount = Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM m02_command_concurrency.m02_manual_command_results
             WHERE command_id=ANY($1::text[])`,
            [[commandA.commandId, commandB.commandId]],
          )
        ).rows[0]?.count ?? "0",
      );
      expect(acceptedResultCount).toBe(1);
      const allGuardsVersionOne = (
        await pool.query<{ record_version: string }>(
          `SELECT record_version FROM m02_command_concurrency.m02_concurrency_guards`,
        )
      ).rows.every(({ record_version }) => Number(record_version) === 1);
      expect(allGuardsVersionOne).toBe(true);
      const candidateVersion = Number(
        (
          await pool.query<{ record_version: string }>(
            `SELECT record_version FROM m02_command_concurrency.resource_candidates
             WHERE id='candidate-1'`,
          )
        ).rows[0]?.record_version,
      );
      expect(candidateVersion).toBe(2);

      const firstOutcome = outcomes.at(0);
      if (firstOutcome === undefined) throw new Error("CONCURRENCY_OUTCOME_MISSING");
      const acceptedCommand = firstOutcome.status === "fulfilled" ? commandA : commandB;
      await expect(
        new PostgresManualResolutionAdapter(pool, { schema: "m02_command_concurrency" }).execute({
          ...acceptedCommand,
          reason: "Changed payload reusing the same idempotency key.",
        }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });

      humanExecutedReceipts.record("F36", "concurrency.winner_loser", {
        winnerCount,
        loserCode,
        attemptVectors,
        uniqueViolationCount: uniqueViolations.length,
        acceptedResultCount,
        allGuardsVersionOne,
        candidateVersion,
      });
    } finally {
      await harness.stop();
    }
  }, 120_000);

  it("routes every approved M02 command through durable records, audit, and restart replay", async () => {
    const pool = await harness.start();
    for (const [index, command] of commands.entries()) {
      const schema = `m02_all_${String(index)}`;
      await migrateSchema(pool, schema);
      const prepared = ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(command)
        ? prepareCorrection(
            command as "MARK_FORK" | "MARK_MIRROR" | "MARK_DUPLICATE",
            1_000 + index,
          )
        : prepareCommand(command, 1_000 + index);
      try {
        await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
      } catch (error) {
        throw new Error(`${command} discovery: ${(error as Error).message}`, { cause: error });
      }
      let result;
      let finalizedPlan: CommandMutationPlanV1 | undefined;
      try {
        result = await new PostgresManualResolutionAdapter(pool, {
          schema,
          onPlanFinalized: (plan) => {
            finalizedPlan = plan;
          },
        }).execute(prepared.input);
      } catch (error) {
        throw new Error(`${command}: ${(error as Error).message}`, { cause: error });
      }
      expect(result.transactionIsolation, command).toBe("SERIALIZABLE");
      const authoritativePlanRows = [
        ...(finalizedPlan?.domainMutationPlan.creates ?? []),
        ...(finalizedPlan?.domainMutationPlan.updates ?? []),
        ...(finalizedPlan?.domainMutationPlan.supersedes ?? []),
        ...(finalizedPlan?.domainMutationPlan.mappings ?? []),
      ];
      expect(
        authoritativePlanRows.filter(
          (row) =>
            "commandType" in row.completeTypedValues || "commandPayload" in row.completeTypedValues,
        ),
        `${command}:generic-plan-fallback`,
      ).toEqual([]);
      await expect(
        new PostgresManualResolutionAdapter(pool, { schema }).execute(prepared.input),
      ).resolves.toEqual(result);
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              `SELECT count(*) FROM ${schema}.manual_resolution_commands WHERE id=$1`,
              [prepared.input.commandId],
            )
          ).rows[0]?.count,
        ),
        command,
      ).toBe(1);
      expect(
        Number(
          (await pool.query<{ count: string }>(`SELECT count(*) FROM ${schema}.m02_audit_events`))
            .rows[0]?.count,
        ),
        command,
      ).toBeGreaterThan(1);
      const persistedAudits = await pool.query<{
        action: string;
        id: string;
        subject_id: string;
        subject_type: string;
      }>(
        `SELECT id,action,subject_type,subject_id
         FROM ${schema}.m02_audit_events
         WHERE command_id=$1
         ORDER BY convert_to(id,'UTF8')`,
        [prepared.input.commandId],
      );
      expect(
        [...(finalizedPlan?.domainMutationPlan.audits ?? [])]
          .map(({ id, action, subjectType, subjectId }) => ({
            id,
            action,
            subject_type: subjectType,
            subject_id: subjectId,
          }))
          .sort((left, right) => Buffer.compare(Buffer.from(left.id), Buffer.from(right.id))),
        `${command}:audit-plan-equality`,
      ).toEqual(persistedAudits.rows);
      const typedPlanRows = authoritativePlanRows.filter(
        (row, rowIndex, rows) =>
          rows.findIndex(
            (candidate) => candidate.table === row.table && candidate.id === row.id,
          ) === rowIndex,
      );
      for (const intent of typedPlanRows) {
        const persisted = (
          await pool.query<{ value: Record<string, unknown> }>(
            `SELECT to_jsonb(row) AS value FROM ${schema}.${intent.table} row WHERE id=$1`,
            [intent.id],
          )
        ).rows[0]?.value;
        expect(
          normalizeDatabaseValue(persisted),
          `${command}:${intent.table}:${intent.id}:complete-plan-equality`,
        ).toEqual(normalizeDatabaseValue(intent.completeTypedValues));
      }
      const persistedResult = (
        await pool.query<{ value: Record<string, unknown> }>(
          `SELECT to_jsonb(row) AS value FROM ${schema}.m02_manual_command_results row
           WHERE command_id=$1`,
          [prepared.input.commandId],
        )
      ).rows[0]?.value;
      expect(
        normalizeDatabaseValue(persistedResult),
        `${command}:typed-result-plan-equality`,
      ).toEqual(
        normalizeDatabaseValue({
          ...finalizedPlan?.domainMutationPlan.result.completeTypedValues,
          mutation_plan_fingerprint: finalizedPlan?.fingerprint,
        }),
      );
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              `SELECT count(*) FROM ${schema}.m02_command_domain_records`,
            )
          ).rows[0]?.count,
        ),
        command,
      ).toBe(0);
      const storedExpectations = await pool.query<{ key: string }>(
        `SELECT jsonb_object_keys(expected_versions) AS key
         FROM ${schema}.manual_resolution_commands`,
      );
      expect(
        storedExpectations.rows
          .map(({ key }) => key)
          .filter((key) => !key.startsWith("guard:"))
          .every((key) => key.startsWith("row:")),
        `${command} caller expectations must contain only canonical typed row keys`,
      ).toBe(true);
      if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(command)) {
        expect(prepared.input.expectedVersions, `${command}:typed-job-expectations`).toMatchObject({
          "row:acquisition_jobs:job-1": 1,
          "row:m02_jobs:job-1": 1,
        });
        expect(
          finalizedPlan?.domainMutationPlan.updates
            .filter((row) => ["acquisition_jobs", "m02_jobs"].includes(row.table))
            .map((row) => row.table)
            .sort(),
          `${command}:typed-job-plan`,
        ).toEqual(["acquisition_jobs", "m02_jobs"]);
        const topologyTables = new Set([
          "repository_candidate_groups",
          "repository_classification_runs",
          "candidate_roots",
          "repository_candidate_root_order",
          "resource_candidates",
          "repository_group_relationships",
          "m02_review_states",
          "candidate_root_ownership",
          "m02_root_replacements",
          "m02_candidate_replacements",
          "m02_ownership_replacements",
          "m02_group_edge_replacements",
          "acquisition_jobs",
          "m02_jobs",
        ]);
        const topologyIntents = [
          ...(finalizedPlan?.domainMutationPlan.creates ?? []),
          ...(finalizedPlan?.domainMutationPlan.updates ?? []),
          ...(finalizedPlan?.domainMutationPlan.supersedes ?? []),
          ...(finalizedPlan?.domainMutationPlan.mappings ?? []),
        ].filter(
          (row, rowIndex, rows) =>
            topologyTables.has(row.table) &&
            rows.findIndex(
              (candidate) => candidate.table === row.table && candidate.id === row.id,
            ) === rowIndex,
        );
        expect(topologyIntents.length, `${command}:topology-plan-size`).toBeGreaterThan(0);
        for (const intent of topologyIntents) {
          const persisted = (
            await pool.query<{ value: Record<string, unknown> }>(
              `SELECT to_jsonb(row) AS value FROM ${schema}.${intent.table} row WHERE id=$1`,
              [intent.id],
            )
          ).rows[0]?.value;
          expect(
            normalizeDatabaseValue(persisted),
            `${command}:${intent.table}:${intent.id}:plan-equality`,
          ).toEqual(normalizeDatabaseValue(intent.completeTypedValues));
        }
        const predecessorGroup = (
          await pool.query<{
            state: string;
            superseded_by_group_id: string;
            source_snapshot_id: string;
            classification_policy_version: string;
            identity_policy_version: string;
          }>(
            `SELECT state,superseded_by_group_id,source_snapshot_id,
                    classification_policy_version,identity_policy_version
             FROM ${schema}.repository_candidate_groups WHERE id='group-1'`,
          )
        ).rows[0];
        expect(predecessorGroup, command).toMatchObject({
          state: "SUPERSEDED",
          source_snapshot_id: "snapshot-1",
          classification_policy_version: "classification-v1",
          identity_policy_version: "identity-v1",
        });
        expect(predecessorGroup?.superseded_by_group_id, command).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(predecessorGroup?.superseded_by_group_id, command).not.toBe(
          prepared.input.payload.replacementGroupId,
        );
        const replacementGroupId = predecessorGroup?.superseded_by_group_id ?? "";
        const provisionalTopologyIds = new Set([
          ...(prepared.input.payload.replacementRootIds ?? "").split(",").filter(Boolean),
          ...(prepared.input.payload.replacementCandidateIds ?? "").split(",").filter(Boolean),
        ]);
        const allocatedTopologyRows = [...(finalizedPlan?.domainMutationPlan.creates ?? [])].filter(
          (row) => ["candidate_roots", "resource_candidates"].includes(row.table),
        );
        expect(
          allocatedTopologyRows.length,
          `${command}:plural-topology-allocation`,
        ).toBeGreaterThan(0);
        for (const row of allocatedTopologyRows) {
          expect(row.id, `${command}:${row.table}:server-id`).toMatch(UUID_PATTERN);
          expect(
            provisionalTopologyIds.has(row.id),
            `${command}:${row.table}:no-provisional-id`,
          ).toBe(false);
        }
        const committedResultId = (
          await pool.query<{ id: string }>(
            `SELECT id FROM ${schema}.m02_manual_command_results WHERE command_id=$1`,
            [prepared.input.commandId],
          )
        ).rows[0]?.id;
        expect(committedResultId, `${command}:committed-result-id`).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(
          (
            await pool.query<{
              state: string;
              supersedes_group_id: string;
              replacement_command_id: string;
              replacement_result_id: string;
              replacement_audit_event_id: string;
            }>(
              `SELECT state,supersedes_group_id,replacement_command_id,
                      replacement_result_id,replacement_audit_event_id
               FROM ${schema}.repository_candidate_groups WHERE id=$1`,
              [replacementGroupId],
            )
          ).rows[0],
          `${command}:successor-group-provenance`,
        ).toMatchObject({
          state: "ACTIVE",
          supersedes_group_id: "group-1",
          replacement_command_id: prepared.input.commandId,
          replacement_result_id: committedResultId,
        });
        expect(
          (
            await pool.query<{
              normalized_root_path: string;
              candidate_root_fingerprint: string;
              candidate_content_fingerprint: string;
              source_snapshot_id: string;
            }>(
              `SELECT normalized_root_path,candidate_root_fingerprint,
                      candidate_content_fingerprint,source_snapshot_id
               FROM ${schema}.candidate_roots WHERE id='root-1'`,
            )
          ).rows[0],
          `${command}:immutable-predecessor-root`,
        ).toEqual({
          normalized_root_path: command === "OVERRIDE_NON_SKILL" ? "skills/new" : ".",
          candidate_root_fingerprint: "b".repeat(64),
          candidate_content_fingerprint: "a".repeat(64),
          source_snapshot_id: "snapshot-1",
        });
        for (const table of [
          "m02_root_replacements",
          "m02_candidate_replacements",
          "m02_ownership_replacements",
          "m02_group_edge_replacements",
        ])
          expect(
            Number(
              (await pool.query<{ count: string }>(`SELECT count(*) FROM ${schema}.${table}`))
                .rows[0]?.count,
            ),
            `${command}:${table}`,
          ).toBeGreaterThan(0);
        expect(
          Number(
            (
              await pool.query<{ count: string }>(
                `SELECT count(*) FROM ${schema}.candidate_root_ownership ownership
                 JOIN ${schema}.candidate_roots root ON root.id=ownership.candidate_root_id
                 WHERE root.group_id=$1`,
                [replacementGroupId],
              )
            ).rows[0]?.count,
          ),
          command,
        ).toBe(JSON.parse(prepared.input.payload.replacementOwnershipJson ?? "[]").length);
        expect(
          Number(
            (
              await pool.query<{ count: string }>(
                `SELECT count(DISTINCT successor.id)
                 FROM ${schema}.m02_candidate_replacements replacement
                 JOIN ${schema}.resource_candidates successor
                   ON successor.id=replacement.successor_candidate_id
                 JOIN ${schema}.m02_audit_events audit
                   ON audit.id=successor.creation_audit_event_id
                 WHERE replacement.command_id=$1 AND replacement.result_id=$2
                   AND successor.creation_command_id=$1 AND successor.creation_result_id=$2
                   AND audit.command_id=$1 AND audit.result_id=$2
                   AND audit.action='SUBJECT_CREATED'
                   AND audit.subject_type='RESOURCE_CANDIDATE'
                   AND audit.subject_id=successor.id
                   AND audit.before_version IS NULL AND audit.before_state IS NULL
                   AND audit.after_version=1`,
                [prepared.input.commandId, committedResultId],
              )
            ).rows[0]?.count,
          ),
          `${command}:successor-candidate-created-provenance`,
        ).toBe(command === "SPLIT_ROOTS" ? 2 : 1);
      }
    }
    await harness.stop();
  }, 180_000);

  it("rolls back domain, command, and accepted audit writes after a locked invariant failure", async () => {
    const pool = await harness.start();
    const schema = "m02_rollback";
    await migrateSchema(pool, schema);
    await pool.query(
      `SET search_path TO m02_rollback, public;
       SET session_replication_role = 'replica';
       DELETE FROM identity_decisions WHERE id='decision-seed';
       UPDATE resource_candidates
       SET status='CLASSIFIED',identity_outcome=NULL,resource_identity_id=NULL,
           resource_version_identity_id=NULL,record_version=1
       WHERE id='candidate-1';
       SET session_replication_role = 'origin'`,
    );
    const prepared = prepareCommand("CREATE_RESOURCE", 1_100);
    await persistPreparedCommand(pool, schema, prepared);
    const before = await domainRecord(pool, schema, "candidate:candidate-1");
    await expect(
      new PostgresManualResolutionAdapter(pool, { schema }).execute({
        ...prepared.input,
        evidenceIds: ["evidence-missing"],
        payload: { ...prepared.input.payload, reliableTokenEvidenceId: "evidence-missing" },
      }),
    ).rejects.toMatchObject({ code: "REFERENCE_INVALID" });
    expect(await domainRecord(pool, schema, "candidate:candidate-1")).toEqual(before);
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${schema}.manual_resolution_commands WHERE id=$1`,
            [prepared.input.commandId],
          )
        ).rows[0]?.count,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${schema}.m02_audit_events WHERE command_id=$1`,
            [prepared.input.commandId],
          )
        ).rows[0]?.count,
      ),
    ).toBe(0);
    const rejection = (
      await pool.query<{
        actor_role: string;
        error_code: string;
        idempotency_scope: string;
        job_id: string | null;
        review_id: string | null;
        target_candidate_id: string | null;
        target_group_id: string | null;
      }>(
        `SELECT actor_role,error_code,idempotency_scope,job_id,review_id,
                target_candidate_id,target_group_id
         FROM ${schema}.m02_rejected_command_audits
         WHERE idempotency_scope='M02' AND idempotency_key=$1
           AND error_code='REFERENCE_INVALID'`,
        [prepared.input.idempotencyKey],
      )
    ).rows[0];
    expect(rejection).toEqual({
      actor_role: "ADMIN",
      error_code: "REFERENCE_INVALID",
      idempotency_scope: "M02",
      job_id: "job-1",
      review_id: "review-1",
      target_candidate_id: "candidate-1",
      target_group_id: "group-1",
    });
    const rollbackCounts = (
      await pool.query<{ accepted_audits: string; commands: string; results: string }>(
        `SELECT
          (SELECT count(*) FROM ${schema}.manual_resolution_commands WHERE id=$1)::text AS commands,
          (SELECT count(*) FROM ${schema}.m02_manual_command_results WHERE command_id=$1)::text AS results,
          (SELECT count(*) FROM ${schema}.m02_audit_events WHERE command_id=$1)::text
            AS accepted_audits`,
        [prepared.input.commandId],
      )
    ).rows[0];
    expect(rollbackCounts).toEqual({ accepted_audits: "0", commands: "0", results: "0" });
    humanExecutedReceipts.record("F36", "concurrency.rollback", {
      before,
      after: await domainRecord(pool, schema, "candidate:candidate-1"),
      rollbackCounts,
      rejection,
    });
    await harness.stop();
  }, 120_000);

  it("retains only server-discovered existing rejection targets", async () => {
    const pool = await harness.start();

    const reviewSchema = "m02_rejection_discovered_review";
    await migrateSchema(pool, reviewSchema);
    const reviewPrepared = prepareCommand("REJECT_CANDIDATE", 1_150);
    const reviewPayload = { ...reviewPrepared.input.payload };
    delete reviewPayload.reviewId;
    const reviewInput = { ...reviewPrepared.input, payload: reviewPayload };
    const reviewCase = { ...reviewPrepared, input: reviewInput };
    await persistPreparedCommand(pool, reviewSchema, reviewCase, "ALL_COMMAND");
    await expect(
      new PostgresManualResolutionAdapter(pool, {
        schema: reviewSchema,
        onAttemptOpened: async () => {
          await pool.query(
            `UPDATE ${reviewSchema}.m02_review_states
             SET record_version=record_version+1 WHERE id='review-1'`,
          );
        },
      }).execute(reviewInput),
    ).rejects.toMatchObject({ code: "MUTATION_PLAN_CHANGED" });
    expect(
      (
        await pool.query<{ job_id: string | null; review_id: string | null }>(
          `SELECT job_id,review_id FROM ${reviewSchema}.m02_rejected_command_audits
           WHERE idempotency_key=$1 AND error_code='MUTATION_PLAN_CHANGED'`,
          [reviewInput.idempotencyKey],
        )
      ).rows[0],
    ).toEqual({ job_id: "job-1", review_id: "review-1" });

    const replacementSchema = "m02_rejection_replacement_source";
    await migrateSchema(pool, replacementSchema);
    const replacementPrepared = prepareCommand("REPLACE_M02_JOB", 1_151);
    await persistPreparedCommand(pool, replacementSchema, replacementPrepared);
    await expect(
      new PostgresManualResolutionAdapter(pool, {
        schema: replacementSchema,
        onAttemptOpened: async () => {
          await pool.query(
            `UPDATE ${replacementSchema}.m02_jobs
             SET record_version=record_version+1 WHERE id='job-source'`,
          );
        },
      }).execute(replacementPrepared.input),
    ).rejects.toMatchObject({ code: "MUTATION_PLAN_CHANGED" });
    expect(
      (
        await pool.query<{ job_id: string | null; review_id: string | null }>(
          `SELECT job_id,review_id FROM ${replacementSchema}.m02_rejected_command_audits
           WHERE idempotency_key=$1 AND error_code='MUTATION_PLAN_CHANGED'`,
          [replacementPrepared.input.idempotencyKey],
        )
      ).rows[0],
    ).toEqual({ job_id: "job-source", review_id: null });

    await harness.stop();
  }, 120_000);

  it("retains auto-discovered rejection targets when preflight fails before returning", async () => {
    const pool = await harness.start();
    const schema = "m02_rejection_preflight_discovery";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("REJECT_CANDIDATE", 1_152);
    const payload = { ...prepared.input.payload };
    delete payload.reviewId;
    const input = { ...prepared.input, payload, expectedVersions: {} };
    const testCase = { ...prepared, input };
    await persistPreparedCommand(pool, schema, testCase, "ALL_COMMAND");
    input.expectedVersions = {};

    await expect(
      new PostgresManualResolutionAdapter(pool, { schema }).execute(input),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });
    expect(
      (
        await pool.query<{
          job_id: string | null;
          review_id: string | null;
          target_candidate_id: string | null;
          target_group_id: string | null;
        }>(
          `SELECT job_id,review_id,target_candidate_id,target_group_id
           FROM ${schema}.m02_rejected_command_audits
           WHERE idempotency_key=$1 AND error_code='EXPECTED_VERSION_SET_INVALID'`,
          [input.idempotencyKey],
        )
      ).rows[0],
    ).toEqual({
      job_id: "job-1",
      review_id: "review-1",
      target_candidate_id: "candidate-1",
      target_group_id: "group-1",
    });

    await harness.stop();
  }, 120_000);

  it("executes recursive ambiguity resolution through the same durable transaction", async () => {
    const pool = await harness.start();
    const schema = "m02_recursive";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("CREATE_RESOURCE", 1_200);
    const input = {
      ...prepared.input,
      command: "RESOLVE_AMBIGUITY" as const,
      payload: { ...prepared.input.payload, selectedCommand: "CREATE_RESOURCE" },
      expectedVersions: {} as Record<string, number | null>,
    };
    await persistPreparedCommand(pool, schema, { ...prepared, input, keys: [] }, "ALL_COMMAND");
    let finalizedPlan: CommandMutationPlanV1 | undefined;
    const result = await new PostgresManualResolutionAdapter(pool, {
      schema,
      onPlanFinalized: (plan) => {
        finalizedPlan = plan;
      },
    }).execute(input);
    expect(result).toMatchObject({ transactionIsolation: "SERIALIZABLE" });
    const handoff = await domainRecord(pool, schema, "handoff:candidate-1");
    expect(handoff).toMatchObject({ state: "ACTIVE" });
    expect(handoff?.resource_identity_id).toMatch(UUID_PATTERN);
    expect(handoff?.resource_version_identity_id).toMatch(UUID_PATTERN);
    expect(result.orderedTargetIds).toEqual(
      expect.arrayContaining([
        handoff?.resource_identity_id,
        handoff?.resource_version_identity_id,
      ]),
    );
    for (const table of [
      "resource_identities",
      "resource_version_identities",
      "resource_source_links",
      "resource_version_observations",
      "identity_decisions",
      "m02_identity_handoff_markers",
    ]) {
      const intent = finalizedPlan?.domainMutationPlan.creates.find((row) => row.table === table);
      expect(intent, `${table}:planned-create`).toBeDefined();
      const persisted = (
        await pool.query<{ value: Record<string, unknown> }>(
          `SELECT to_jsonb(row) AS value FROM ${schema}.${table} row WHERE id=$1`,
          [intent?.id],
        )
      ).rows[0]?.value;
      expect(normalizeDatabaseValue(persisted), `${table}:plan-equality`).toEqual(
        normalizeDatabaseValue(intent?.completeTypedValues),
      );
    }
    await harness.stop();
  }, 120_000);

  it("serializes competing replacement jobs and supersedes every overlapping controller", async () => {
    const pool = await harness.start();
    const schema = "m02_replace_race";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("REPLACE_M02_JOB", 1_300);
    await persistPreparedCommand(pool, schema, prepared);
    const competing = {
      ...prepared.input,
      commandId: "command-replace-competitor",
      requestId: "request-replace-competitor",
      idempotencyKey: "idempotency-replace-competitor",
      payload: { ...prepared.input.payload, auditId: "audit-replace-competitor" },
      expectedVersions: {} as Record<string, number | null>,
    };
    competing.expectedVersions = {
      ...(await new PostgresManualResolutionAdapter(pool, {
        schema,
      }).discoverRequiredCurrentExpectations(competing)),
    };
    const outcomes = await Promise.allSettled([
      new PostgresManualResolutionAdapter(pool, { schema }).execute(prepared.input),
      new PostgresManualResolutionAdapter(pool, { schema }).execute(competing),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(await domainRecord(pool, schema, "job:job-source")).toMatchObject({
      supersession_state: "SUPERSEDED",
    });
    expect(await domainRecord(pool, schema, "job:job-overlap")).toMatchObject({
      supersession_state: "SUPERSEDED",
    });
    const replacement = (
      await pool.query<Record<string, unknown>>(
        `SELECT * FROM ${schema}.m02_jobs
         WHERE replacement_source_job_id='job-source'
           AND supersession_state='CONTROLLING'`,
      )
    ).rows[0];
    expect(replacement?.id).toMatch(UUID_PATTERN);
    expect(replacement).toMatchObject({ supersession_state: "CONTROLLING" });
    await harness.stop();
  }, 120_000);

  it("applies the exact replacement overlap matrix for identity-only scope", async () => {
    const pool = await harness.start();
    const schema = "m02_replace_identity_scope";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("REPLACE_M02_JOB", 1_350);
    await persistPreparedCommand(pool, schema, prepared);
    await pool.query(
      `UPDATE ${schema}.acquisition_jobs
       SET status='OPERATOR_REVIEW_REQUIRED' WHERE id='job-overlap'`,
    );
    const fingerprint = createHash("sha256")
      .update(
        Buffer.from(
          canonicalJson({
            schemaVersion: "1",
            jobLineageId: "lineage-1",
            sourceJobId: "job-overlap",
            sourceOperationScope: "IDENTITY_RESOLUTION",
            requestedOperationScope: "IDENTITY_RESOLUTION",
            predecessorJobIds: ["job-overlap"],
            sourceSnapshotId: "snapshot-1",
            replacementSourceSnapshotIdOrNull: "snapshot-replacement",
            classificationPolicyVersion: "classification-v1",
            identityPolicyVersion: "identity-v1",
            analysisPolicyVersion: "analysis-v1",
            parserProfileVersion: "parser-v1",
            promptBundleVersion: "prompt-v1",
            analysisProviderAdapterIdOrNull: null,
            analysisModelIdOrNull: null,
            analysisMethodologyVersionOrNull: null,
            controllingClassificationDecisionIdOrNull: null,
          }),
          "utf8",
        ),
      )
      .digest("hex");
    const provisional = {
      ...prepared.input,
      payload: {
        ...prepared.input.payload,
        sourceJobId: "job-overlap",
        requestedOperationScope: "IDENTITY_RESOLUTION",
        replacementInputFingerprint: fingerprint,
      },
      expectedVersions: {},
    };
    const adapter = new PostgresManualResolutionAdapter(pool, { schema });
    const input = {
      ...provisional,
      expectedVersions: { ...(await adapter.discoverRequiredCurrentExpectations(provisional)) },
    };
    await adapter.execute(input);
    expect(await domainRecord(pool, schema, "job:job-source")).toMatchObject({
      supersession_state: "CONTROLLING",
    });
    expect(await domainRecord(pool, schema, "job:job-overlap")).toMatchObject({
      supersession_state: "SUPERSEDED",
    });
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${schema}.m02_job_supersessions WHERE command_id=$1`,
            [input.commandId],
          )
        ).rows[0]?.count ?? "0",
      ),
    ).toBe(1);
    await harness.stop();
  }, 120_000);

  it("replaces failed source and failed overlapping jobs without leaving split authority", async () => {
    const pool = await harness.start();
    const schema = "m02_replace_failed";
    await migrateSchema(pool, schema);
    const prepared = prepareCommand("REPLACE_M02_JOB", 1_400);
    await persistPreparedCommand(pool, schema, prepared);
    await pool.query(
      `UPDATE ${schema}.acquisition_jobs SET status='FAILED', failure=$1, record_version=record_version+1
       WHERE id = ANY($2::text[])`,
      [{ reasonCode: "RETRY_EXHAUSTED" }, ["job-source", "job-overlap"]],
    );
    const failedInput = {
      ...prepared.input,
      reasonCode: "FAILED_STAGE_REPLACEMENT",
      expectedVersions: {} as Record<string, number | null>,
    };
    failedInput.expectedVersions = {
      ...(await new PostgresManualResolutionAdapter(pool, {
        schema,
      }).discoverRequiredCurrentExpectations(failedInput)),
    };
    let finalizedPlan: CommandMutationPlanV1 | undefined;
    await expect(
      new PostgresManualResolutionAdapter(pool, {
        schema,
        onPlanFinalized: (plan) => {
          finalizedPlan = plan;
        },
      }).execute(failedInput),
    ).resolves.toMatchObject({ transactionIsolation: "SERIALIZABLE" });
    for (const key of ["job:job-source", "job:job-overlap"])
      expect(await domainRecord(pool, schema, key)).toMatchObject({
        supersession_state: "SUPERSEDED",
      });
    const replacement = (
      await pool.query<Record<string, unknown>>(
        `SELECT * FROM ${schema}.m02_jobs
         WHERE replacement_source_job_id='job-source'
           AND supersession_state='CONTROLLING'`,
      )
    ).rows[0];
    expect(replacement?.id).toMatch(UUID_PATTERN);
    expect(replacement).toMatchObject({ supersession_state: "CONTROLLING" });
    const replacementTables = new Set(["acquisition_jobs", "m02_jobs", "m02_job_supersessions"]);
    const intents = [
      ...(finalizedPlan?.domainMutationPlan.creates ?? []),
      ...(finalizedPlan?.domainMutationPlan.updates ?? []),
      ...(finalizedPlan?.domainMutationPlan.supersedes ?? []),
      ...(finalizedPlan?.domainMutationPlan.mappings ?? []),
    ].filter(
      (row, index, rows) =>
        replacementTables.has(row.table) &&
        rows.findIndex((candidate) => candidate.table === row.table && candidate.id === row.id) ===
          index,
    );
    expect(intents.length, "replacement-plan-size").toBeGreaterThanOrEqual(6);
    for (const intent of intents) {
      const persisted = (
        await pool.query<{ value: Record<string, unknown> }>(
          `SELECT to_jsonb(row) AS value FROM ${schema}.${intent.table} row WHERE id=$1`,
          [intent.id],
        )
      ).rows[0]?.value;
      expect(
        normalizeDatabaseValue(persisted),
        `${intent.table}:${intent.id}:plan-equality`,
      ).toEqual(normalizeDatabaseValue(intent.completeTypedValues));
    }
    expect(
      finalizedPlan?.domainMutationPlan.audits.filter((audit) => audit.subjectType === "M02_JOB"),
      "replacement-audits",
    ).toHaveLength(3);
    await harness.stop();
  }, 120_000);

  it("durably supersedes prior fork, mirror, and duplicate relationships during correction", async () => {
    const pool = await harness.start();
    for (const [index, command] of (
      ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"] as const
    ).entries()) {
      const schema = `m02_correction_${String(index)}`;
      await migrateSchema(pool, schema);
      const prepared = prepareCorrection(command, 1_500 + index);
      await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
      let finalizedPlan: CommandMutationPlanV1 | undefined;
      let correctionResult;
      try {
        correctionResult = await new PostgresManualResolutionAdapter(pool, {
          schema,
          onPlanFinalized: (plan) => {
            finalizedPlan = plan;
          },
        }).execute(prepared.input);
      } catch (error) {
        throw new Error(`${command}: ${(error as Error).message}`, { cause: error });
      }
      expect(correctionResult).toMatchObject({ transactionIsolation: "SERIALIZABLE" });
      const prefix =
        command === "MARK_FORK" ? "fork" : command === "MARK_MIRROR" ? "mirror" : "duplicate";
      const predecessor = await domainRecord(pool, schema, `${prefix}:relationship-prior`);
      expect(predecessor, command).toMatchObject({
        [command === "MARK_DUPLICATE" ? "status" : "state"]: "SUPERSEDED",
      });
      expect(predecessor, `${command}:immutable-predecessor-endpoints`).toMatchObject(
        command === "MARK_FORK"
          ? {
              fork_resource_version_id: "version-fork-existing",
              origin_resource_version_id: "version-origin",
            }
          : command === "MARK_MIRROR"
            ? {
                mirror_source_repository_id: "source-mirror",
                origin_source_repository_id: "source-origin",
                target_resource_version_id: "version-target",
              }
            : {
                resource_candidate_id: "candidate-1",
                target_resource_version_id: "version-target",
              },
      );
      const relationshipTable =
        command === "MARK_FORK"
          ? "fork_relationships"
          : command === "MARK_MIRROR"
            ? "source_repository_relationships"
            : "duplicate_candidates";
      const replacement = (
        await pool.query<Record<string, unknown>>(
          `SELECT * FROM ${schema}.${relationshipTable} WHERE command_id=$1`,
          [prepared.input.commandId],
        )
      ).rows[0];
      expect(replacement?.id, `${command}:server-id`).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(replacement?.id).not.toBe(
        command === "MARK_DUPLICATE" ? "duplicate-new" : "relationship-new",
      );
      expect(replacement, command).toMatchObject({
        [command === "MARK_DUPLICATE" ? "supersedes_duplicate_id" : "supersedes_relationship_id"]:
          "relationship-prior",
      });
      const plannedRelationship = finalizedPlan?.domainMutationPlan.creates.find(
        (row) => row.table === relationshipTable && row.id === replacement?.id,
      );
      expect(plannedRelationship, `${command}:planned-relationship-create`).toBeDefined();
      expect(normalizeDatabaseValue(replacement), `${command}:relationship-plan-equality`).toEqual(
        normalizeDatabaseValue(plannedRelationship?.completeTypedValues),
      );
      const plannedPredecessor = finalizedPlan?.domainMutationPlan.supersedes.find(
        (row) => row.table === relationshipTable && row.id === "relationship-prior",
      );
      expect(plannedPredecessor, `${command}:planned-predecessor-supersession`).toBeDefined();
      expect(normalizeDatabaseValue(predecessor), `${command}:predecessor-plan-equality`).toEqual(
        normalizeDatabaseValue(plannedPredecessor?.completeTypedValues),
      );
      const supersessionAudit = (
        await pool.query<{ command_id: string; result_id: string }>(
          `SELECT command_id,result_id FROM ${schema}.m02_audit_events
           WHERE action='SUBJECT_SUPERSEDED' AND subject_id='relationship-prior'
             AND command_id=$1`,
          [prepared.input.commandId],
        )
      ).rows[0];
      expect(supersessionAudit?.command_id).toBe(prepared.input.commandId);
      expect(supersessionAudit?.result_id).toBeTruthy();
      expect(await domainRecord(pool, schema, "decision:decision-seed"), command).toMatchObject({
        state: "SUPERSEDED",
      });
    }
    await harness.stop();
  }, 180_000);

  it("plans and persists FIRST relationship rows with canonical collision postconditions", async () => {
    const pool = await harness.start();
    for (const [index, command] of (
      ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"] as const
    ).entries()) {
      const schema = `m02_relationship_first_${String(index)}`;
      await migrateSchema(pool, schema);
      const mode = humanProjectionModes().find(
        (candidate) => candidate.family === command && candidate.dimensions.mode === "FIRST",
      );
      if (mode === undefined) throw new Error(`${command}:FIRST_MODE_MISSING`);
      const client = await pool.connect();
      let finalizedPlan: CommandMutationPlanV1 | undefined;
      let input: ManualResolutionEnvelope;
      try {
        await client.query(`SET search_path TO ${schema}, public`);
        await client.query("BEGIN");
        await client.query("SAVEPOINT golden_case");
        const transactionPool = transactionBoundPool(client);
        ({ input } = await prepareGoldenExecution(
          transactionPool,
          client,
          schema,
          mode,
          1_600 + index,
        ));
        await new PostgresManualResolutionAdapter(transactionPool, {
          schema,
          onPlanFinalized: (plan) => {
            finalizedPlan = plan;
          },
        }).execute(input);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`${command}: ${(error as Error).message}`, { cause: error });
      } finally {
        client.release();
      }
      const table =
        command === "MARK_FORK"
          ? "fork_relationships"
          : command === "MARK_MIRROR"
            ? "source_repository_relationships"
            : "duplicate_candidates";
      const persisted = (
        await pool.query<{ value: Record<string, unknown> }>(
          `SELECT to_jsonb(row) AS value FROM ${schema}.${table} row WHERE command_id=$1`,
          [input.commandId],
        )
      ).rows[0]?.value;
      const intent = finalizedPlan?.domainMutationPlan.creates.find(
        (row) => row.table === table && row.id === persisted?.id,
      );
      expect(intent, `${command}:FIRST-plan`).toBeDefined();
      expect(normalizeDatabaseValue(persisted), `${command}:FIRST-plan-equality`).toEqual(
        normalizeDatabaseValue(intent?.completeTypedValues),
      );
      expect(finalizedPlan?.domainMutationPlan.postconditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ collisionTable: table, expectedCount: 1 }),
        ]),
      );
    }
    await harness.stop();
  }, 180_000);

  it("projects ATTACH A2 and A3 as exact identity/version reuse without created identity rows", async () => {
    const pool = await harness.start();
    const a1Schema = "m02_attach_a1";
    await migrateSchema(pool, a1Schema);
    const a1 = prepareCommand("ATTACH_NEW_VERSION", 1_799);
    await persistPreparedCommand(pool, a1Schema, a1, "ALL_COMMAND");
    let a1Plan: CommandMutationPlanV1 | undefined;
    await new PostgresManualResolutionAdapter(pool, {
      schema: a1Schema,
      onPlanFinalized: (plan) => {
        a1Plan = plan;
      },
    }).execute(a1.input);
    const a1VersionIntent = a1Plan?.domainMutationPlan.creates.find(
      (row) => row.table === "resource_version_identities",
    );
    expect(a1VersionIntent).toBeDefined();
    expect(
      normalizeDatabaseValue(
        (
          await pool.query<{ value: Record<string, unknown> }>(
            `SELECT to_jsonb(row) AS value FROM ${a1Schema}.resource_version_identities row WHERE id=$1`,
            [a1VersionIntent?.id],
          )
        ).rows[0]?.value,
      ),
    ).toEqual(normalizeDatabaseValue(a1VersionIntent?.completeTypedValues));
    const schema = "m02_attach_reuse";
    await migrateSchema(pool, schema);
    const a2 = prepareCommand("ATTACH_NEW_VERSION", 1_800);
    a2.input.payload = { ...a2.input.payload, contentFingerprint: "a".repeat(64) };
    await persistPreparedCommand(pool, schema, a2, "ALL_COMMAND");
    let a2Plan: CommandMutationPlanV1 | undefined;
    await new PostgresManualResolutionAdapter(pool, {
      schema,
      onPlanFinalized: (plan) => {
        a2Plan = plan;
      },
    }).execute(a2.input);
    expect(
      a2Plan?.domainMutationPlan.creates.some(
        (row) => row.table === "resource_identities" || row.table === "resource_version_identities",
      ),
    ).toBe(false);
    expect(a2Plan?.domainMutationPlan.postconditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "resource_identities",
          id: "resource-existing",
          reuse: true,
        }),
        expect.objectContaining({
          table: "resource_version_identities",
          id: "version-target",
          reuse: true,
        }),
      ]),
    );

    const a2Result = (
      await pool.query<{
        identity_projection_mode_id: string;
        identity_outcome: string;
        resource_identity_id: string;
        resource_version_identity_id: string;
        created_resource_identity_ids: string[];
        reused_resource_identity_ids: string[];
        created_resource_version_identity_ids: string[];
        reused_resource_version_identity_ids: string[];
      }>(
        `SELECT identity_projection_mode_id,identity_outcome,resource_identity_id,
                resource_version_identity_id,created_resource_identity_ids,
                reused_resource_identity_ids,created_resource_version_identity_ids,
                reused_resource_version_identity_ids
         FROM ${schema}.m02_manual_command_results WHERE command_id=$1`,
        [a2.input.commandId],
      )
    ).rows[0];
    expect(a2Result).toEqual({
      identity_projection_mode_id: "ATTACH_NEW_VERSION_A2",
      identity_outcome: "EXACT_REPEAT_REUSE",
      resource_identity_id: "resource-existing",
      resource_version_identity_id: "version-target",
      created_resource_identity_ids: [],
      reused_resource_identity_ids: ["resource-existing"],
      created_resource_version_identity_ids: [],
      reused_resource_version_identity_ids: ["version-target"],
    });

    const missingLinkSchema = "m02_attach_exact_version_missing_link";
    await migrateSchema(pool, missingLinkSchema);
    const missingLink = prepareCommand("ATTACH_NEW_VERSION", 1_802);
    missingLink.input.payload = {
      ...missingLink.input.payload,
      contentFingerprint: "a".repeat(64),
    };
    await persistPreparedCommand(pool, missingLinkSchema, missingLink, "ALL_COMMAND");
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${missingLinkSchema}.resource_version_identities
             WHERE resource_identity_id='resource-existing' AND content_fingerprint=$1`,
            ["a".repeat(64)],
          )
        ).rows[0]?.count,
      ),
      "missing-link fixture must retain the exact version",
    ).toBe(1);
    await pool.query(
      `DELETE FROM ${missingLinkSchema}.resource_source_links WHERE id='source-link-active'`,
    );
    const missingLinkAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: missingLinkSchema,
    });
    missingLink.input.expectedVersions = {
      ...(await missingLinkAdapter.discoverRequiredCurrentExpectations(missingLink.input)),
    };
    await expect(missingLinkAdapter.execute(missingLink.input)).rejects.toMatchObject({
      code: "TRANSITION_PROHIBITED",
    });

    for (const [suffix, ambiguity] of [
      ["direct", false],
      ["ambiguity", true],
    ] as const) {
      const a1AuthoritySchema = `m02_attach_a1_authority_${suffix}`;
      await migrateSchema(pool, a1AuthoritySchema);
      const a1Authority = prepareCommand("ATTACH_NEW_VERSION", ambiguity ? 1_804 : 1_803);
      await persistPreparedCommand(pool, a1AuthoritySchema, a1Authority, "ALL_COMMAND");
      const invalidInput: ManualResolutionEnvelope = {
        ...a1Authority.input,
        ...(ambiguity ? { command: "RESOLVE_AMBIGUITY" as const } : {}),
        payload: {
          ...a1Authority.input.payload,
          ...(ambiguity ? { selectedCommand: "ATTACH_NEW_VERSION" } : {}),
          activeSourceLinkId: "source-link-not-the-prior-delivery",
        },
      };
      const authorityAdapter = new PostgresManualResolutionAdapter(pool, {
        schema: a1AuthoritySchema,
      });
      const invalidWithExpectations = {
        ...invalidInput,
        expectedVersions: {
          ...(await authorityAdapter.discoverRequiredCurrentExpectations(invalidInput)),
        },
      };
      await expect(authorityAdapter.execute(invalidWithExpectations)).rejects.toMatchObject({
        code: "TRANSITION_PROHIBITED",
      });
    }

    const a3Schema = "m02_attach_reuse_a3";
    await migrateSchema(pool, a3Schema);
    const a3 = prepareCommand("ATTACH_NEW_VERSION", 1_801);
    a3.input.payload = {
      ...a3.input.payload,
      contentFingerprint: "a".repeat(64),
    };
    await persistPreparedCommand(pool, a3Schema, a3, "ALL_COMMAND");
    await pool.query(
      `UPDATE ${a3Schema}.resource_source_links
       SET source_repository_id='source-origin',record_version=record_version+1
       WHERE id='source-link-active'`,
    );
    await pool.query(
      `INSERT INTO ${a3Schema}.m02_audit_events
         (id,origin_type,command_id,result_id,actor_type,actor_id,actor_role,action,
          subject_type,subject_id,request_id,idempotency_scope,idempotency_key,reason_code,
          reason_text,after_version,after_state,metadata,source_snapshot_id,controlling_job_id,occurred_at)
       VALUES
         ('audit-exact-link-a3','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
          'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_SOURCE_LINK','exact-link-a3',
          'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
          'Canonical PostgreSQL fixture seed',1,'{"recordVersion":1,"state":"ACTIVE"}',
          '{}','snapshot-1','job-1',now()),
         ('audit-exact-observation-a3','HUMAN_COMMAND','command-seed','result-seed','HUMAN',
          'fixture-editor','EDITOR','SUBJECT_CREATED','RESOURCE_VERSION_OBSERVATION','exact-observation-a3',
          'request-seed','M02','fixture-seed','IDENTITY_AMBIGUITY_RESOLVED',
          'Canonical PostgreSQL fixture seed',NULL,NULL,'{}','snapshot-1','job-1',now())`,
    );
    await pool.query(
      `INSERT INTO ${a3Schema}.resource_source_links
         (id,source_repository_id,normalized_root_path,target_resource_version_id,
          relationship,evidence_ids,decision_id,reason,actor_id,created_at,state,record_version,
          origin_type,command_id,result_id,audit_event_id)
       VALUES ('exact-link-a3','source-main','.','version-target','PRIMARY','["evidence-1"]',
         'decision-seed','Canonical exact-repeat fixture','fixture-editor',now(),'ACTIVE',1,
         'HUMAN_COMMAND','command-seed','result-seed','audit-exact-link-a3')`,
    );
    await pool.query(
      `INSERT INTO ${a3Schema}.resource_version_observations
         (id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
          resource_source_link_id,source_repository_id,provider,provider_repository_id,
          normalized_root_path,immutable_revision,observed_at,origin_type,command_id,result_id,audit_event_id)
       VALUES ('exact-observation-a3','version-target','snapshot-1','root-1','exact-link-a3',
         'source-main','github','repo-1','.','rev-1',now(),'HUMAN_COMMAND','command-seed',
         'result-seed','audit-exact-observation-a3')`,
    );
    a3.input.payload = { ...a3.input.payload, activeSourceLinkId: "exact-link-a3" };
    a3.input.expectedVersions = {
      ...(await new PostgresManualResolutionAdapter(pool, {
        schema: a3Schema,
      }).discoverRequiredCurrentExpectations(a3.input)),
    };
    let a3Plan: CommandMutationPlanV1 | undefined;
    await new PostgresManualResolutionAdapter(pool, {
      schema: a3Schema,
      onPlanFinalized: (plan) => {
        a3Plan = plan;
      },
    }).execute(a3.input);
    expect(
      a3Plan?.domainMutationPlan.creates.some((row) =>
        [
          "resource_identities",
          "resource_version_identities",
          "resource_source_links",
          "resource_version_observations",
        ].includes(row.table),
      ),
    ).toBe(false);
    expect(
      (
        await pool.query<{
          identity_projection_mode_id: string;
          identity_outcome: string;
          created_resource_identity_ids: string[];
          reused_resource_identity_ids: string[];
          created_resource_version_identity_ids: string[];
          reused_resource_version_identity_ids: string[];
        }>(
          `SELECT identity_projection_mode_id,identity_outcome,created_resource_identity_ids,
                  reused_resource_identity_ids,created_resource_version_identity_ids,
                  reused_resource_version_identity_ids
           FROM ${a3Schema}.m02_manual_command_results WHERE command_id=$1`,
          [a3.input.commandId],
        )
      ).rows[0],
    ).toEqual({
      identity_projection_mode_id: "ATTACH_NEW_VERSION_A3",
      identity_outcome: "EXACT_REPEAT_REUSE",
      created_resource_identity_ids: [],
      reused_resource_identity_ids: ["resource-existing"],
      created_resource_version_identity_ids: [],
      reused_resource_version_identity_ids: ["version-target"],
    });
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${schema}.resource_version_identities
             WHERE resource_identity_id='resource-existing' AND content_fingerprint=$1`,
            ["a".repeat(64)],
          )
        ).rows[0]?.count,
      ),
    ).toBe(1);
    await harness.stop();
  }, 180_000);

  it("projects all six typed clarification target and historical-guard modes", async () => {
    const pool = await harness.start();
    for (const [index, targetType] of ["CLASSIFICATION", "IDENTITY", "REJECTION"].entries()) {
      for (const historical of [false, true]) {
        const schema = `m02_clarification_${String(index)}_${historical ? "t1" : "t0"}`;
        await migrateSchema(pool, schema);
        let targetId = "run-1";
        if (targetType === "IDENTITY") {
          targetId = "decision-seed";
        } else if (targetType === "REJECTION") {
          await pool.query(
            `SET search_path TO ${schema}, public;
             SET session_replication_role = 'replica';
             DELETE FROM identity_decisions WHERE id='decision-seed';
             DELETE FROM m02_identity_handoff_markers WHERE resource_candidate_id='candidate-1';
             UPDATE resource_candidates
             SET status='CLASSIFIED',identity_outcome=NULL,resource_identity_id=NULL,
                 resource_version_identity_id=NULL,record_version=1
             WHERE id='candidate-1';
             SET session_replication_role = 'origin'`,
          );
          const provisionalRejection = rejectionCommand({
            commandId: `command-clarification-reject-${String(index)}`,
            requestId: `request-clarification-reject-${String(index)}`,
            idempotencyKey: `idempotency-clarification-reject-${String(index)}`,
            payload: {
              auditId: `audit-clarification-reject-${String(index)}`,
              decisionId: `decision-clarification-reject-${String(index)}`,
              jobId: "job-1",
            },
          });
          const rejectionAdapter = new PostgresManualResolutionAdapter(pool, { schema });
          const rejection = {
            ...provisionalRejection,
            expectedVersions: {
              ...(await rejectionAdapter.discoverRequiredCurrentExpectations(provisionalRejection)),
            },
          };
          await rejectionAdapter.execute(rejection);
          targetId =
            (
              await pool.query<{ id: string }>(
                `SELECT id FROM ${schema}.m02_candidate_rejection_decisions WHERE command_id=$1`,
                [rejection.commandId],
              )
            ).rows[0]?.id ?? "";
        }
        if (historical) {
          const targetGuard = canonicalGuard("CLARIFICATION_TARGET", {
            targetType:
              targetType === "CLASSIFICATION"
                ? "CANDIDATE_GROUP"
                : targetType === "IDENTITY"
                  ? "IDENTITY_DECISION"
                  : "RESOURCE_CANDIDATE",
            targetId,
          });
          await pool.query(
            `INSERT INTO ${schema}.m02_concurrency_guards
               (guard_key,guard_type,canonical_payload,payload_hash,record_version)
             VALUES ($1,'CLARIFICATION_TARGET',$2,$3,1)`,
            [
              targetGuard.key,
              Buffer.from(targetGuard.canonicalPayload),
              createHash("sha256").update(targetGuard.canonicalPayload).digest("hex"),
            ],
          );
        }
        const provisional = completeEnvelope(
          "REQUEST_CLARIFICATION",
          2_000 + index * 2 + Number(historical),
        );
        provisional.reasonCode = `${targetType}_EVIDENCE_REQUIRED`;
        (provisional as { decisionIds: string[] }).decisionIds =
          targetType === "CLASSIFICATION" ? [] : [targetId];
        provisional.payload = {
          ...provisional.payload,
          clarificationId: `clarification-${targetType.toLowerCase()}-${historical ? "t1" : "t0"}`,
          auditId: `audit-${targetType.toLowerCase()}-${historical ? "t1" : "t0"}`,
        };
        let finalizedPlan: CommandMutationPlanV1 | undefined;
        const adapter = new PostgresManualResolutionAdapter(pool, {
          schema,
          onPlanFinalized: (plan) => {
            finalizedPlan = plan;
          },
        });
        provisional.expectedVersions = {
          ...(await adapter.discoverRequiredCurrentExpectations(provisional)),
        };
        await adapter.execute(provisional);
        const row = (
          await pool.query<Record<string, unknown>>(
            `SELECT * FROM ${schema}.m02_clarification_requests WHERE command_id=$1`,
            [provisional.commandId],
          )
        ).rows[0];
        const clarificationIntent = finalizedPlan?.domainMutationPlan.creates.find(
          (entry) => entry.table === "m02_clarification_requests",
        );
        expect(clarificationIntent).toBeDefined();
        expect(normalizeDatabaseValue(row)).toEqual(
          normalizeDatabaseValue(clarificationIntent?.completeTypedValues),
        );
        expect(row).toMatchObject({
          state: "OPEN",
          resource_candidate_id: targetType === "CLASSIFICATION" ? null : "candidate-1",
          candidate_group_id: "group-1",
          target_classification_run_id: targetType === "CLASSIFICATION" ? targetId : null,
          target_identity_decision_id: targetType === "IDENTITY" ? targetId : null,
          target_rejection_decision_id: targetType === "REJECTION" ? targetId : null,
        });
        expect(row?.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(row?.id).not.toBe(provisional.payload.clarificationId);
        expect(
          [
            row?.target_classification_run_id,
            row?.target_identity_decision_id,
            row?.target_rejection_decision_id,
          ].filter((value) => value !== null),
          `${targetType}:${historical ? "T1" : "T0"}:target-xor`,
        ).toHaveLength(1);
        expect(
          (
            await pool.query<{ record_version: string }>(
              `SELECT max(record_version)::text AS record_version FROM ${schema}.m02_concurrency_guards
               WHERE guard_type='CLARIFICATION_TARGET'`,
            )
          ).rows[0]?.record_version,
          `${targetType}:${historical ? "T1" : "T0"}:guard-version`,
        ).toBe(historical ? "2" : "1");
      }
    }
    await harness.stop();
  }, 180_000);

  it("keeps concurrency-plan bytes allocation-free while server domain IDs vary", async () => {
    const pool = await harness.start();
    const allocationReceipts: unknown[] = [];
    for (const [familyIndex, command] of (
      ["CREATE_RESOURCE", "MARK_FORK", "OVERRIDE_NON_SKILL"] as const
    ).entries()) {
      const observations: {
        concurrencyBytes: string;
        mutationPlanFingerprint: string;
        domainIds: string[];
      }[] = [];
      for (const replica of [0, 1]) {
        const schema = `m02_allocation_${String(familyIndex)}_${String(replica)}`;
        await migrateSchema(pool, schema);
        const prepared =
          command === "MARK_FORK"
            ? prepareCorrection("MARK_FORK", 2_300 + familyIndex)
            : prepareCommand(command, 2_300 + familyIndex);
        await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
        await new PostgresManualResolutionAdapter(pool, { schema }).execute(prepared.input);
        const commandRow = (
          await pool.query<{
            expected_versions: Record<string, number | null>;
            mutation_plan_fingerprint: string;
          }>(
            `SELECT command.expected_versions,result.mutation_plan_fingerprint
             FROM ${schema}.manual_resolution_commands command
             JOIN ${schema}.m02_manual_command_results result ON result.command_id=command.id
             WHERE command.id=$1`,
            [prepared.input.commandId],
          )
        ).rows[0];
        const guardRows = await pool.query<{
          guard_key: string;
          canonical_payload_hex: string;
          record_version: string;
        }>(
          `SELECT guard.guard_key,encode(guard.canonical_payload,'hex') AS canonical_payload_hex,
                  guard.record_version
           FROM ${schema}.m02_concurrency_guards guard
           WHERE guard.guard_key = ANY($1::text[])
           ORDER BY convert_to(guard.guard_key,'UTF8')`,
          [
            Object.keys(commandRow?.expected_versions ?? {}).filter((key) =>
              key.startsWith("guard:"),
            ),
          ],
        );
        const domainIds =
          command === "OVERRIDE_NON_SKILL"
            ? [
                ...(
                  await pool.query<{ id: string }>(
                    `SELECT id FROM ${schema}.repository_candidate_groups
                     WHERE replacement_command_id=$1 ORDER BY convert_to(id,'UTF8')`,
                    [prepared.input.commandId],
                  )
                ).rows.map(({ id }) => id),
              ]
            : [
                ...(
                  await pool.query<{ id: string }>(
                    `SELECT resource_identity_id AS id FROM ${schema}.m02_manual_command_results
                     WHERE command_id=$1
                     UNION ALL
                     SELECT resource_version_identity_id FROM ${schema}.m02_manual_command_results
                     WHERE command_id=$1
                     ORDER BY id`,
                    [prepared.input.commandId],
                  )
                ).rows.map(({ id }) => id),
                ...(command === "MARK_FORK"
                  ? (
                      await pool.query<{ id: string }>(
                        `SELECT id FROM ${schema}.fork_relationships WHERE command_id=$1`,
                        [prepared.input.commandId],
                      )
                    ).rows.map(({ id }) => id)
                  : []),
              ];
        observations.push({
          concurrencyBytes: canonicalJson({
            expectedVersions: commandRow?.expected_versions ?? {},
            guards: guardRows.rows.map((row) => ({
              guardKey: row.guard_key,
              canonicalPayloadHex: row.canonical_payload_hex,
              recordVersion: Number(row.record_version),
            })),
          }),
          mutationPlanFingerprint: commandRow?.mutation_plan_fingerprint ?? "",
          domainIds,
        });
      }
      expect(observations[0]?.concurrencyBytes, command).toBe(observations[1]?.concurrencyBytes);
      expect(observations[0]?.domainIds, command).not.toEqual(observations[1]?.domainIds);
      expect(observations[0]?.mutationPlanFingerprint, command).not.toBe(
        observations[1]?.mutationPlanFingerprint,
      );
      allocationReceipts.push({
        command,
        concurrencyBytesEqual:
          observations[0]?.concurrencyBytes === observations[1]?.concurrencyBytes,
        concurrencyBytesFingerprint: createHash("sha256")
          .update(observations[0]?.concurrencyBytes ?? "")
          .digest("hex"),
        domainIdsDiffer:
          canonicalJson(observations[0]?.domainIds ?? []) !==
          canonicalJson(observations[1]?.domainIds ?? []),
        mutationPlanFingerprintsDiffer:
          observations[0]?.mutationPlanFingerprint !== observations[1]?.mutationPlanFingerprint,
        domainIdCounts: observations.map(({ domainIds }) => domainIds.length),
      });
    }
    expect(allocationReceipts).toHaveLength(3);
    humanExecutedReceipts.record("F41", "guards.provisional_id_independence", allocationReceipts);
    await harness.stop();
  }, 240_000);

  it("resolves or supersedes the complete open clarification set by projector family", async () => {
    const pool = await harness.start();
    const replacementClarificationReceipts: unknown[] = [];
    for (const [index, command] of (
      ["CREATE_RESOURCE", "SPLIT_ROOTS", "REPLACE_M02_JOB"] as const
    ).entries()) {
      const schema = `m02_clarification_transition_${String(index)}`;
      await migrateSchema(pool, schema);
      const prepared = prepareCommand(command, 2_100 + index);
      if (command === "SPLIT_ROOTS") await persistPreparedCommand(pool, schema, prepared);
      if (command === "REPLACE_M02_JOB") await persistPreparedCommand(pool, schema, prepared);
      if (command === "REPLACE_M02_JOB")
        await pool.query(
          `UPDATE ${schema}.m02_review_states
           SET controlling_job_id='job-source', record_version=record_version+1
           WHERE id='review-1'`,
        );
      const provisionalRequest = completeEnvelope("REQUEST_CLARIFICATION", 2_200 + index);
      provisionalRequest.commandId = `command-open-${String(index)}`;
      provisionalRequest.requestId = `request-open-${String(index)}`;
      provisionalRequest.idempotencyKey = `idempotency-open-${String(index)}`;
      provisionalRequest.payload = {
        ...provisionalRequest.payload,
        clarificationId: `clarification-open-${String(index)}`,
        auditId: `audit-open-${String(index)}`,
        jobId: command === "REPLACE_M02_JOB" ? "job-source" : "job-1",
      };
      const requestAdapter = new PostgresManualResolutionAdapter(pool, { schema });
      provisionalRequest.expectedVersions = {
        ...(await requestAdapter.discoverRequiredCurrentExpectations(provisionalRequest)),
      };
      await requestAdapter.execute(provisionalRequest);
      let outsideBefore: Record<string, unknown> | undefined;
      let outsideClarificationId: string | undefined;
      if (command === "REPLACE_M02_JOB") {
        outsideClarificationId = `clarification-outside-${String(index)}`;
        await pool.query(
          `INSERT INTO ${schema}.m02_review_states
             (id,group_id,resource_candidate_id,review_state,record_version,
              source_snapshot_id,controlling_job_id)
           VALUES ('review-outside','group-1','candidate-1','CLARIFICATION_REQUESTED',1,
             'snapshot-1','job-1')`,
        );
        await pool.query(
          `INSERT INTO ${schema}.m02_clarification_requests
             (id,command_id,result_id,audit_event_id,review_id,controlling_job_id,
              source_snapshot_id,target_identity_decision_id,resource_candidate_id,
              candidate_group_id,question_code,reason_code,question_payload,evidence_ids,
              evidence_gaps,requested_responder_class,actor_id,actor_role,state,created_at,
              record_version)
           VALUES ($1,'command-seed','result-seed','audit-command-seed','review-outside','job-1',
             'snapshot-1','decision-seed','candidate-1','group-1','OUTSIDE_JOB_EVIDENCE',
             'CLASSIFICATION_EVIDENCE_REQUIRED',convert_to('Outside controller evidence.','UTF8'),
             '["evidence-1"]','["outside-controller"]','TECHNICAL_REVIEWER',
             'fixture-editor','EDITOR','OPEN',now(),1)`,
          [outsideClarificationId],
        );
        outsideBefore = (
          await pool.query<Record<string, unknown>>(
            `SELECT id,controlling_job_id,question_code,state,resolution_command_id,
                    superseded_by_command_id,record_version::text
             FROM ${schema}.m02_clarification_requests WHERE id=$1`,
            [outsideClarificationId],
          )
        ).rows[0];
        expect(outsideBefore).toMatchObject({ state: "OPEN", controlling_job_id: "job-1" });
      }
      if (command === "CREATE_RESOURCE")
        await persistPreparedCommand(pool, schema, prepared, "ALL_COMMAND");
      else
        prepared.input.expectedVersions = {
          ...(await new PostgresManualResolutionAdapter(pool, {
            schema,
          }).discoverRequiredCurrentExpectations(prepared.input)),
        };
      await new PostgresManualResolutionAdapter(pool, { schema }).execute(prepared.input);
      const clarification = (
        await pool.query<{
          state: string;
          resolution_command_id: string;
          resolution_result_id: string;
          resolution_audit_event_id: string;
          superseded_by_command_id: string | null;
          record_version: string;
        }>(
          `SELECT state,resolution_command_id,resolution_result_id,resolution_audit_event_id,
             superseded_by_command_id,record_version
           FROM ${schema}.m02_clarification_requests WHERE command_id=$1`,
          [provisionalRequest.commandId],
        )
      ).rows[0];
      expect(clarification, command).toMatchObject({
        state: command === "CREATE_RESOURCE" ? "RESOLVED" : "SUPERSEDED",
        resolution_command_id: prepared.input.commandId,
        superseded_by_command_id: command === "CREATE_RESOURCE" ? null : prepared.input.commandId,
        record_version: "2",
      });
      expect(clarification?.resolution_result_id).toBeTruthy();
      expect(clarification?.resolution_audit_event_id).toBeTruthy();
      if (command === "REPLACE_M02_JOB") {
        const outsideAfter = (
          await pool.query<Record<string, unknown>>(
            `SELECT id,controlling_job_id,question_code,state,resolution_command_id,
                    superseded_by_command_id,record_version::text
             FROM ${schema}.m02_clarification_requests WHERE id=$1`,
            [outsideClarificationId],
          )
        ).rows[0];
        expect(normalizeDatabaseValue(outsideAfter)).toEqual(normalizeDatabaseValue(outsideBefore));
        replacementClarificationReceipts.push({
          predecessorClarification: {
            state: clarification?.state ?? null,
            recordVersion: clarification?.record_version ?? null,
            resolutionCommandMatches:
              clarification?.resolution_command_id === prepared.input.commandId,
            supersedingCommandMatches:
              clarification?.superseded_by_command_id === prepared.input.commandId,
            hasResolutionResult: Boolean(clarification?.resolution_result_id),
            hasResolutionAudit: Boolean(clarification?.resolution_audit_event_id),
          },
          outside: stableStateReceipt(outsideAfter),
          outsideUnchanged:
            canonicalJson(normalizeDatabaseValue(outsideAfter)) ===
            canonicalJson(normalizeDatabaseValue(outsideBefore)),
        });
      }
    }
    expect(replacementClarificationReceipts).toHaveLength(1);
    humanExecutedReceipts.record(
      "F39",
      "replacement.outside_clarification",
      replacementClarificationReceipts,
    );
    await harness.stop();
  }, 180_000);

  it("bounds Serializable retries and rechecks immutable caller expectations before reopening", async () => {
    const pool = await harness.start();
    const installFailure = async (
      schema: string,
      kind: "40001_ONCE" | "40001_ALWAYS" | "23505_ALLOWED_ONCE" | "23505_OTHER_ALWAYS",
    ) => {
      await pool.query(`CREATE SEQUENCE ${schema}.injected_failure_sequence`);
      await pool.query(`
        CREATE FUNCTION ${schema}.inject_command_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE invocation bigint;
        BEGIN
          invocation := nextval('${schema}.injected_failure_sequence');
          IF '${kind}' = '40001_ALWAYS' OR ('${kind}' = '40001_ONCE' AND invocation = 1) THEN
            RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='injected serialization failure';
          END IF;
          IF '${kind}' = '23505_OTHER_ALWAYS' THEN
            RAISE EXCEPTION USING ERRCODE='23505', CONSTRAINT='unrelated_unique', MESSAGE='injected unrelated unique failure';
          END IF;
          IF '${kind}' = '23505_ALLOWED_ONCE' AND invocation = 1 THEN
            RAISE EXCEPTION USING ERRCODE='23505', CONSTRAINT='m02_concurrency_guards_pkey', MESSAGE='injected approved first-use race';
          END IF;
          RETURN NEW;
        END;
        $$`);
      await pool.query(`
        CREATE TRIGGER inject_command_failure
        BEFORE INSERT ON ${schema}.manual_resolution_commands
        FOR EACH ROW EXECUTE FUNCTION ${schema}.inject_command_failure()`);
    };

    const successfulAttemptReceipts: number[][] = [];
    for (const [index, kind] of (["40001_ONCE"] as const).entries()) {
      const schema = `m02_retry_success_${String(index)}`;
      await migrateSchema(pool, schema);
      await persistPreparedCommand(
        pool,
        schema,
        prepareCommand("REJECT_CANDIDATE", 30_000 + index),
        "ALL_COMMAND",
      );
      await installFailure(schema, kind);
      const provisional = rejectionCommand({
        commandId: `command-retry-success-${String(index)}`,
        requestId: `request-retry-success-${String(index)}`,
        idempotencyKey: `idempotency-retry-success-${String(index)}`,
        payload: {
          auditId: `audit-retry-success-${String(index)}`,
          decisionId: `decision-retry-success-${String(index)}`,
          jobId: "job-1",
        },
      });
      const attempts: number[] = [];
      const adapter = new PostgresManualResolutionAdapter(pool, {
        schema,
        onAttemptOpened: (attempt) => {
          attempts.push(attempt);
        },
      });
      const command = {
        ...provisional,
        expectedVersions: {
          ...(await adapter.discoverRequiredCurrentExpectations(provisional)),
        },
      };
      await expect(adapter.execute(command)).resolves.toMatchObject({
        transactionIsolation: "SERIALIZABLE",
      });
      expect(attempts).toEqual([1, 2]);
      successfulAttemptReceipts.push([...attempts]);
      expect(
        Number(
          (
            await pool.query<{ count: string }>(
              `SELECT count(*) FROM ${schema}.manual_resolution_commands WHERE id = $1`,
              [command.commandId],
            )
          ).rows[0]?.count,
        ),
      ).toBe(1);
    }

    const phantomSchema = "m02_retry_phantom_first_use";
    await migrateSchema(pool, phantomSchema);
    await persistPreparedCommand(
      pool,
      phantomSchema,
      prepareCommand("REJECT_CANDIDATE", 30_100),
      "ALL_COMMAND",
    );
    await installFailure(phantomSchema, "23505_ALLOWED_ONCE");
    const phantomProvisional = rejectionCommand({
      commandId: "command-retry-phantom",
      requestId: "request-retry-phantom",
      idempotencyKey: "idempotency-retry-phantom",
      payload: {
        auditId: "audit-retry-phantom",
        decisionId: "decision-retry-phantom",
        jobId: "job-1",
      },
    });
    const phantomAttempts: number[] = [];
    const phantomAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: phantomSchema,
      onAttemptOpened: (attempt) => {
        phantomAttempts.push(attempt);
      },
    });
    const phantomCommand = {
      ...phantomProvisional,
      expectedVersions: {
        ...(await phantomAdapter.discoverRequiredCurrentExpectations(phantomProvisional)),
      },
    };
    await expect(phantomAdapter.execute(phantomCommand)).rejects.toMatchObject({
      code: "PHANTOM_CONFLICT",
    });
    expect(phantomAttempts).toEqual([1]);

    const exhaustedSchema = "m02_retry_exhausted";
    await migrateSchema(pool, exhaustedSchema);
    await persistPreparedCommand(
      pool,
      exhaustedSchema,
      prepareCommand("REJECT_CANDIDATE", 30_101),
      "ALL_COMMAND",
    );
    await installFailure(exhaustedSchema, "40001_ALWAYS");
    const exhaustedProvisional = rejectionCommand({
      commandId: "command-retry-exhausted",
      requestId: "request-retry-exhausted",
      idempotencyKey: "idempotency-retry-exhausted",
      payload: {
        auditId: "audit-retry-exhausted",
        decisionId: "decision-retry-exhausted",
        jobId: "job-1",
      },
    });
    const exhaustedAttempts: number[] = [];
    const exhaustedAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: exhaustedSchema,
      onAttemptOpened: (attempt) => {
        exhaustedAttempts.push(attempt);
      },
    });
    const exhaustedCommand = {
      ...exhaustedProvisional,
      expectedVersions: {
        ...(await exhaustedAdapter.discoverRequiredCurrentExpectations(exhaustedProvisional)),
      },
    };
    await expect(exhaustedAdapter.execute(exhaustedCommand)).rejects.toMatchObject({
      code: "SERIALIZATION_RETRY_EXHAUSTED",
    });
    expect(exhaustedAttempts).toEqual([1, 2, 3]);
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${exhaustedSchema}.manual_resolution_commands WHERE id = $1`,
            [exhaustedCommand.commandId],
          )
        ).rows[0]?.count,
      ),
    ).toBe(0);

    const changedSchema = "m02_retry_changed_preflight";
    await migrateSchema(pool, changedSchema);
    await persistPreparedCommand(
      pool,
      changedSchema,
      prepareCommand("REJECT_CANDIDATE", 30_102),
      "ALL_COMMAND",
    );
    await installFailure(changedSchema, "40001_ONCE");
    const changedProvisional = rejectionCommand({
      commandId: "command-retry-changed",
      requestId: "request-retry-changed",
      idempotencyKey: "idempotency-retry-changed",
      payload: {
        auditId: "audit-retry-changed",
        decisionId: "decision-retry-changed",
        jobId: "job-1",
      },
    });
    const changedAttempts: number[] = [];
    const changedAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: changedSchema,
      onAttemptOpened: (attempt) => {
        changedAttempts.push(attempt);
      },
      onRetry: async () => {
        await pool.query(
          `UPDATE ${changedSchema}.resource_candidates
           SET updated_at=clock_timestamp(),record_version=record_version+1 WHERE id='candidate-1'`,
        );
      },
    });
    const changedCommand = {
      ...changedProvisional,
      expectedVersions: {
        ...(await changedAdapter.discoverRequiredCurrentExpectations(changedProvisional)),
      },
    };
    const immutableRequest = JSON.stringify(changedCommand);
    await expect(changedAdapter.execute(changedCommand)).rejects.toMatchObject({
      code: "STALE_RECORD_VERSION",
    });
    expect(changedAttempts).toEqual([1]);
    expect(JSON.stringify(changedCommand)).toBe(immutableRequest);

    const unrelatedSchema = "m02_retry_unrelated_unique";
    await migrateSchema(pool, unrelatedSchema);
    await persistPreparedCommand(
      pool,
      unrelatedSchema,
      prepareCommand("REJECT_CANDIDATE", 30_103),
      "ALL_COMMAND",
    );
    await installFailure(unrelatedSchema, "23505_OTHER_ALWAYS");
    const unrelatedProvisional = rejectionCommand({
      commandId: "command-retry-unrelated",
      requestId: "request-retry-unrelated",
      idempotencyKey: "idempotency-retry-unrelated",
      payload: {
        auditId: "audit-retry-unrelated",
        decisionId: "decision-retry-unrelated",
        jobId: "job-1",
      },
    });
    const unrelatedAttempts: number[] = [];
    const unrelatedAdapter = new PostgresManualResolutionAdapter(pool, {
      schema: unrelatedSchema,
      onAttemptOpened: (attempt) => {
        unrelatedAttempts.push(attempt);
      },
    });
    const unrelatedCommand = {
      ...unrelatedProvisional,
      expectedVersions: {
        ...(await unrelatedAdapter.discoverRequiredCurrentExpectations(unrelatedProvisional)),
      },
    };
    await expect(unrelatedAdapter.execute(unrelatedCommand)).rejects.toMatchObject({
      code: "PHANTOM_CONFLICT",
    });
    expect(unrelatedAttempts).toEqual([1]);
    const retryRows = {
      successfulCommands: Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM m02_retry_success_0.manual_resolution_commands
             WHERE id=$1`,
            ["command-retry-success-0"],
          )
        ).rows[0]?.count ?? "0",
      ),
      exhaustedCommands: Number(
        (
          await pool.query<{ count: string }>(
            `SELECT count(*) FROM ${exhaustedSchema}.manual_resolution_commands WHERE id=$1`,
            [exhaustedCommand.commandId],
          )
        ).rows[0]?.count ?? "0",
      ),
      changedCandidateVersion: Number(
        (
          await pool.query<{ record_version: string }>(
            `SELECT record_version FROM ${changedSchema}.resource_candidates WHERE id='candidate-1'`,
          )
        ).rows[0]?.record_version ?? "0",
      ),
    };
    expect(retryRows).toEqual({
      successfulCommands: 1,
      exhaustedCommands: 0,
      changedCandidateVersion: 2,
    });
    humanExecutedReceipts.record("F36", "concurrency.retry", {
      successfulAttemptReceipts,
      phantomAttempts,
      exhaustedAttempts,
      changedAttempts,
      unrelatedAttempts,
      immutableRequestPreserved: JSON.stringify(changedCommand) === immutableRequest,
      rows: retryRows,
    });
    await harness.stop();
  }, 240_000);
});
