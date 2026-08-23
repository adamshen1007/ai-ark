import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  PostgresManualResolutionAdapter,
  PostgresSystemIdentityAdapter,
  SYSTEM_IDENTITY_PROJECTOR_MODE_IDS,
  buildSystemIdentityReplayLocator,
  canonicalGuard,
  canonicalizeIdentityDecisionInput,
  SystemIdentityMutationError,
  type IdentityDecisionInputV1,
  type ManualResolutionEnvelope,
  type PostgresSystemIdentityOptions,
  type SystemIdentityMutationRequestV1,
  type SystemIdentityProjectorModeId,
} from "@ai-ark/job-queue";
import { canonicalJson, type JsonValue } from "@ai-ark/contracts";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { EphemeralPostgresHarness } from "./postgres-harness.js";
import { ExecutedReceiptCollector } from "./m02-executed-receipts.js";
import {
  seedM02ProductionGraph,
  seedM02SystemIdentityGraph,
  seedM02SystemReanalysisGraph,
} from "./m02-postgres-fixture.js";

const EXACT_SYSTEM_MODES = [
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
] as const satisfies readonly SystemIdentityProjectorModeId[];

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

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

const systemExecutedReceipts = new ExecutedReceiptCollector({
  F42: [
    "modes.committed_ids",
    "projection.operations_decisions_children_results_audits_handoffs",
    "lifecycle.replay",
    "lifecycle.rollback",
    "lifecycle.rejections",
  ],
});
const committedSystemModeReceipts = new Map<string, unknown>();

function finalizeExecutedEvidence(id: "F42"): ExpectedFixtureEvidence {
  const actual = systemExecutedReceipts.finalize(id);
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

async function readSystemProjectionReceipt(schema: string): Promise<Record<string, JsonValue>> {
  const receipt = await pool.query<{
    operations: string;
    results: string;
    decisions: string;
    tiers: string;
    signals: string;
    conflicts: string;
    audits: string;
    handoffs: string;
    active_handoffs: string;
    superseded_handoffs: string;
    outcomes: string[];
  }>(
    `SELECT
      (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
      (SELECT count(*) FROM ${schema}.m02_system_identity_results)::text AS results,
      (SELECT count(*) FROM ${schema}.identity_decisions
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS decisions,
      (SELECT count(*) FROM ${schema}.identity_decision_tier_evaluations tier
        JOIN ${schema}.identity_decisions decision ON decision.id=tier.identity_decision_id
        WHERE decision.origin_type='SYSTEM_IDENTITY_OPERATION')::text AS tiers,
      (SELECT count(*) FROM ${schema}.identity_decision_signals signal
        JOIN ${schema}.identity_decisions decision ON decision.id=signal.identity_decision_id
        WHERE decision.origin_type='SYSTEM_IDENTITY_OPERATION')::text AS signals,
      (SELECT count(*) FROM ${schema}.identity_decision_conflicts conflict
        JOIN ${schema}.identity_decisions decision ON decision.id=conflict.identity_decision_id
        WHERE decision.origin_type='SYSTEM_IDENTITY_OPERATION')::text AS conflicts,
      (SELECT count(*) FROM ${schema}.m02_audit_events
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS audits,
      (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS handoffs,
      (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION' AND state='ACTIVE')::text AS active_handoffs,
      (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION' AND state='SUPERSEDED')::text
        AS superseded_handoffs,
      ARRAY(SELECT outcome FROM ${schema}.identity_decisions
        WHERE origin_type='SYSTEM_IDENTITY_OPERATION' ORDER BY created_at,id) AS outcomes`,
  );
  expect(receipt.rows).toHaveLength(1);
  expect(Number(receipt.rows[0]?.operations)).toBeGreaterThan(0);
  expect(Number(receipt.rows[0]?.results)).toBeGreaterThan(0);
  expect(Number(receipt.rows[0]?.decisions)).toBeGreaterThan(0);
  expect(Number(receipt.rows[0]?.tiers)).toBeGreaterThanOrEqual(6);
  expect(Number(receipt.rows[0]?.audits)).toBeGreaterThan(0);
  return receipt.rows[0] ?? {};
}

const migration001Url = new URL(
  "../../job-queue/migrations/001_m01_acquisition_jobs.sql",
  import.meta.url,
);
const migration002Url = new URL(
  "../../job-queue/migrations/002_m02_classification_identity.sql",
  import.meta.url,
);
const harness = new EphemeralPostgresHarness();
let pool: Pool;
let migration001 = "";
let migration002 = "";

async function createSchema(schema: string): Promise<void> {
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

async function updateImmutableFixtureResult(
  schema: string,
  sql: string,
  values: readonly unknown[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query("SET LOCAL session_replication_role = 'replica'");
    await client.query(sql, [...values]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function decisionInput(overrides: Partial<IdentityDecisionInputV1> = {}): IdentityDecisionInputV1 {
  return {
    schemaVersion: "1",
    sourceSnapshotId: "snapshot-1",
    candidateId: "candidate-1",
    candidateRootFingerprint: HASH_A,
    candidateContentFingerprint: HASH_B,
    reconciledClassificationRunId: "run-1",
    classificationRunInputFingerprint: HASH_A,
    classificationRunOutputFingerprint: HASH_B,
    analysisRunIdOrNull: null,
    analysisRunRequestFingerprintOrNull: null,
    analysisRunResponseFingerprintOrNull: null,
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "analysis-v1",
    parserProfileVersion: "parser-v1",
    promptBundleVersion: "prompt-v1",
    evaluatedTierSequence: [
      { tier: "P1", evaluationDisposition: "NO_MATCH" },
      { tier: "P2", evaluationDisposition: "NO_MATCH" },
      { tier: "P3", evaluationDisposition: "NO_MATCH" },
      { tier: "P4", evaluationDisposition: "NO_MATCH" },
      { tier: "P5", evaluationDisposition: "NO_MATCH" },
      { tier: "P6", evaluationDisposition: "NO_MATCH" },
    ],
    trustedSignals: [],
    conflicts: [],
    ...overrides,
  };
}

function projectorRequest(
  _mode: SystemIdentityProjectorModeId,
  fixture: Awaited<ReturnType<typeof seedM02SystemIdentityGraph>>,
): SystemIdentityMutationRequestV1 {
  return {
    schemaVersion: "1",
    sourceSnapshotId: fixture.snapshotId,
    candidateId: fixture.candidateId,
    controllingJobId: fixture.jobId,
    reconciledClassificationRunId: fixture.runId,
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
  };
}

function immutableProjectorRequest(
  fixture: Awaited<ReturnType<typeof seedM02SystemIdentityGraph>>,
): SystemIdentityMutationRequestV1 {
  return {
    schemaVersion: "1",
    sourceSnapshotId: fixture.snapshotId,
    candidateId: fixture.candidateId,
    controllingJobId: fixture.jobId,
    reconciledClassificationRunId: fixture.runId,
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
  };
}

describe("M02 PostgreSQL system identity projector", () => {
  beforeAll(async () => {
    [migration001, migration002] = await Promise.all([
      readFile(migration001Url, "utf8"),
      readFile(migration002Url, "utf8"),
    ]);
    pool = await harness.start();
  }, 60_000);

  afterAll(async () => {
    try {
      const missingModes = EXACT_SYSTEM_MODES.filter(
        (mode) => !committedSystemModeReceipts.has(mode),
      );
      if (missingModes.length > 0)
        throw new Error(`EXECUTED_SYSTEM_MODES_MISSING:${missingModes.join(",")}`);
      const committedModes = EXACT_SYSTEM_MODES.map((mode) => ({
        mode,
        receipt: committedSystemModeReceipts.get(mode),
      }));
      systemExecutedReceipts.record(
        "F42",
        "modes.committed_ids",
        committedModes.map(({ mode }) => mode),
      );
      systemExecutedReceipts.record(
        "F42",
        "projection.operations_decisions_children_results_audits_handoffs",
        committedModes,
      );
      const actual = finalizeExecutedEvidence("F42");
      expect(actual, "F42:manifest-executable-evidence").toEqual(expectedEvidence.get("F42"));
    } finally {
      await harness.stop();
    }
  });

  it("runs the projector evidence on PostgreSQL 17.6", async () => {
    const version = await pool.query<{ server_version: string }>("SHOW server_version");
    expect(version.rows[0]?.server_version).toBe("17.6");
  });

  it("derives the authoritative projector, actor, and facts from durable state", async () => {
    const schema = "m02_system_server_derived";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
    const immutable = immutableProjectorRequest(fixture);
    expect(Object.keys(immutable).sort()).toEqual([
      "candidateId",
      "classificationPolicyVersion",
      "controllingJobId",
      "identityPolicyVersion",
      "reconciledClassificationRunId",
      "schemaVersion",
      "sourceSnapshotId",
    ]);
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(immutable);
    expect(result.automaticProjectorModeId).toBe("S1_R0_JC");
    const operation = await pool.query<{
      automatic_projector_mode_id: string;
      system_actor_id: string;
    }>(
      `SELECT automatic_projector_mode_id,system_actor_id
       FROM ${schema}.m02_system_identity_operations`,
    );
    expect(operation.rows).toEqual([
      {
        automatic_projector_mode_id: "S1_R0_JC",
        system_actor_id: "m02-system-identity-resolver",
      },
    ]);
  }, 60_000);

  it("exports exactly the closed Section 13.1 mode vocabulary", () => {
    expect(SYSTEM_IDENTITY_PROJECTOR_MODE_IDS).toEqual(EXACT_SYSTEM_MODES);
    expect(new Set(SYSTEM_IDENTITY_PROJECTOR_MODE_IDS).size).toBe(22);
  });

  it("freezes canonical six-tier input and a pre-projector replay locator", () => {
    const canonical = canonicalizeIdentityDecisionInput(decisionInput());
    expect(canonical.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.parse(Buffer.from(canonical.payload).toString("utf8"))).toEqual(decisionInput());

    const replay = buildSystemIdentityReplayLocator({
      sourceSnapshotId: "snapshot-1",
      candidateId: "candidate-1",
      controllingJobId: "job-1",
      reconciledClassificationRunId: "run-1",
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      systemActorId: "m02-system-identity-resolver",
    });
    expect(replay.lookupKey).toMatch(/^[0-9a-f]{64}$/u);
    expect(Buffer.from(replay.payload).toString("utf8")).not.toContain("automaticProjectorModeId");
  });

  it("rejects an incomplete or out-of-order tier sequence before persistence", () => {
    const malformed = decisionInput({
      evaluatedTierSequence: decisionInput().evaluatedTierSequence.slice(0, 5),
    });
    expect(() => canonicalizeIdentityDecisionInput(malformed)).toThrow(
      new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION"),
    );
  });

  it("rejects a signal whose type is attached to the wrong tier", () => {
    expect(() =>
      canonicalizeIdentityDecisionInput(
        decisionInput({
          evaluatedTierSequence: [
            { tier: "P1", evaluationDisposition: "MATCH" },
            { tier: "P2", evaluationDisposition: "NOT_APPLICABLE" },
            { tier: "P3", evaluationDisposition: "NOT_APPLICABLE" },
            { tier: "P4", evaluationDisposition: "NOT_APPLICABLE" },
            { tier: "P5", evaluationDisposition: "NOT_APPLICABLE" },
            { tier: "P6", evaluationDisposition: "NOT_APPLICABLE" },
          ],
          trustedSignals: [
            {
              tier: "P1",
              signalType: "P2_TRUSTED_EXTERNAL_IDENTIFIER",
              targetTypeOrNull: "RESOURCE_IDENTITY",
              targetIdOrNull: "resource-1",
              evidenceReferenceIds: ["evidence-1"],
            },
          ],
        }),
      ),
    ).toThrow(
      new SystemIdentityMutationError("MUTATION_PLAN_CHANGED", "POST_PROJECTOR_PRE_ALLOCATION"),
    );
  });

  it("enforces signal type, tier disposition, and winner semantics in PostgreSQL", async () => {
    const schema = "m02_system_signal_semantics";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S4_R0_JC");
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S4_R0_JC", fixture),
    );
    await pool.query(
      `ALTER TABLE ${schema}.identity_decision_signals
       DISABLE TRIGGER identity_decision_children_immutable`,
    );
    await pool.query("BEGIN");
    try {
      await pool.query(`SET LOCAL search_path TO ${schema}, public`);
      await pool.query(
        `UPDATE identity_decision_signals SET tier='P1'
         WHERE signal_type='P2_TRUSTED_EXTERNAL_IDENTIFIER'`,
      );
      await expect(
        pool.query("SET CONSTRAINTS identity_decision_signal_semantics_guard IMMEDIATE"),
      ).rejects.toThrow(/IDENTITY_DECISION_SIGNAL_SEMANTICS_INVALID/iu);
    } finally {
      await pool.query("ROLLBACK");
      await pool.query(
        `ALTER TABLE ${schema}.identity_decision_signals
         ENABLE TRIGGER identity_decision_children_immutable`,
      );
    }
  }, 60_000);

  it("binds the conditional AnalysisRun tuple to the authoritative classification run", async () => {
    const schema = "m02_system_analysis_run";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    const linkedAnalysisRunId = "00000000-0000-7000-8000-000000004060";
    await pool.query(
      `INSERT INTO ${schema}.analysis_runs
        (id,source_snapshot_id,operation,provider_id,adapter_id,model_or_fake_id,
         prompt_bundle_version,classification_policy_version,identity_policy_version,
         analysis_policy_version,request_fingerprint,response_fingerprint,status,temperature,
         validation_repair_outcome,repair_count,provider_attempt_count,duration_ms,attempt,
         started_at,completed_at,bounded_usage,created_at)
       VALUES
        ($1,$2,'CLASSIFY_REPOSITORY','provider','adapter','model','prompt-v1',
         'classification-v1','identity-v1','analysis-v1',$3,$4,'SUCCEEDED',0,
         'NOT_REQUIRED',0,1,1,1,now(),now(),'{}',now())`,
      [linkedAnalysisRunId, fixture.snapshotId, HASH_A, HASH_B],
    );
    await pool.query(
      `UPDATE ${schema}.repository_classification_runs SET analysis_run_id=$1 WHERE id=$2`,
      [linkedAnalysisRunId, fixture.runId],
    );
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S6_JR", fixture),
    );
    const direct = await pool.query<{
      analysis_run_id: string;
      decision_source: string;
    }>(
      `SELECT operation.analysis_run_id,decision.decision_source
       FROM ${schema}.m02_system_identity_operations operation
       JOIN ${schema}.identity_decisions decision ON decision.system_operation_id=operation.id`,
    );
    expect(direct.rows).toEqual([
      { analysis_run_id: linkedAnalysisRunId, decision_source: "AI_ASSISTED" },
    ]);
  }, 60_000);

  it("matches P2 only by the exact trusted canonical scoped external-identifier tuple", async () => {
    const schema = "m02_system_external_scope";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S4_R0_JC");
    const wrongScopePayload = Buffer.from(
      canonicalJson({
        identifierType: "DECLARED_MANIFEST_ID",
        issuer: "github.com",
        namespace: "different-owner",
        normalizationPolicyVersion: "external-id-v1",
        normalizedValue: "system-skill",
        provider: "github",
      }),
      "utf8",
    );
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `UPDATE ${schema}.external_identifiers
         SET namespace='different-owner',canonical_key_payload=$1,canonical_key_hash=$2
         WHERE id='00000000-0000-7000-8000-000000004020'`,
        [wrongScopePayload, createHash("sha256").update(wrongScopePayload).digest("hex")],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S4_R0_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S7_JR");
  }, 60_000);

  it("blocks an initial P1/P2 contradiction with both exact typed targets and no association mutation", async () => {
    const schema = "m02_system_p1_p2_contradiction";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S3_JC");
    const externalPayload = Buffer.from(
      canonicalJson({
        identifierType: "DECLARED_MANIFEST_ID",
        issuer: "github.com",
        namespace: "system",
        normalizationPolicyVersion: "external-id-v1",
        normalizedValue: "contradictory-skill",
        provider: "github",
      }),
      "utf8",
    );
    const contradictoryIdentityId = "00000000-0000-7000-8000-000000004081";
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `INSERT INTO ${schema}.resource_identities
           (id,status,created_at,record_version,guard_anchor_candidate_id,origin_type,
            command_id,result_id,audit_event_id)
         VALUES ($1,'ACTIVE',now(),1,$2,'HUMAN_COMMAND','command-seed','result-seed',
           'audit-command-seed')`,
        [contradictoryIdentityId, fixture.candidateId],
      );
      await pool.query(
        `INSERT INTO ${schema}.external_identifiers
           (id,resource_identity_id,provider,identifier_type,issuer,namespace,normalized_value,
            normalization_policy_version,evidence_reference_id,canonical_key_hash,
            canonical_key_payload,provenance,review_state,record_version)
         VALUES ('00000000-0000-7000-8000-000000004082',$1,'github',
           'DECLARED_MANIFEST_ID','github.com','system','contradictory-skill',
           'external-id-v1',$2,$3,$4,'HUMAN_VERIFIED_SOURCE_DECLARATION','VERIFIED',1)`,
        [
          contradictoryIdentityId,
          fixture.evidenceId,
          createHash("sha256").update(externalPayload).digest("hex"),
          externalPayload,
        ],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    await updateImmutableFixtureResult(
      schema,
      `UPDATE acquisition_results
       SET result=jsonb_set(result,'{identityDiscovery,trustedExternalIdentifierOrNull}',$1::jsonb)
       WHERE job_id=$2`,
      [externalPayload.toString("utf8"), fixture.jobId],
    );

    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S3_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S6_JR");
    const direct = await pool.query<{
      conflict_code: string;
      targets: string[];
      candidate_status: string;
      candidate_identity_id: string | null;
    }>(
      `SELECT conflict.conflict_code,
        array_agg(target.target_type || ':' ||
          COALESCE(target.resource_identity_id,target.resource_version_id,target.source_repository_id)
          ORDER BY convert_to(target.target_type || ':' ||
            COALESCE(target.resource_identity_id,target.resource_version_id,target.source_repository_id),'UTF8'))
          AS targets,
        candidate.status AS candidate_status,
        candidate.resource_identity_id AS candidate_identity_id
       FROM ${schema}.identity_decision_conflicts conflict
       JOIN ${schema}.identity_decision_conflict_targets target ON target.conflict_id=conflict.id
       JOIN ${schema}.identity_decisions decision ON decision.id=conflict.identity_decision_id
       JOIN ${schema}.resource_candidates candidate ON candidate.id=decision.resource_candidate_id
       GROUP BY conflict.conflict_code,candidate.status,candidate.resource_identity_id`,
    );
    expect(direct.rows).toEqual([
      {
        conflict_code: "TRUSTED_IDENTIFIER_SOURCE_LINK_CONFLICT",
        targets: [
          `RESOURCE_IDENTITY:${contradictoryIdentityId}`,
          `RESOURCE_VERSION:${fixture.exactResourceVersionId}`,
        ],
        candidate_status: "IDENTITY_REVIEW_REQUIRED",
        candidate_identity_id: null,
      },
    ]);
  }, 60_000);

  it("accepts a trusted P2 identifier whose retained typed evidence belongs to an earlier run", async () => {
    const schema = "m02_system_p2_historical_evidence";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S4_R0_JC");
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `UPDATE ${schema}.external_identifiers SET evidence_reference_id='evidence-1'
         WHERE id='00000000-0000-7000-8000-000000004020'`,
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S4_R0_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S4_R0_JC");
    const evidence = await pool.query<{ evidence_reference_id: string }>(
      `SELECT child.evidence_reference_id
       FROM ${schema}.identity_decision_signal_evidence child
       JOIN ${schema}.identity_decision_signals signal ON signal.id=child.signal_id
       WHERE signal.signal_type='P2_TRUSTED_EXTERNAL_IDENTIFIER'`,
    );
    expect(evidence.rows).toEqual([{ evidence_reference_id: "evidence-1" }]);
    await expect(
      pool.query(
        `UPDATE ${schema}.classification_evidence_references
         SET evidence_order=evidence_order+1 WHERE id='evidence-1'`,
      ),
    ).rejects.toThrow(/M02_HISTORY_IMMUTABLE/iu);
  }, 60_000);

  it("dispatches exact P5 name plus creator evidence to S7 with normalized typed rows", async () => {
    const schema = "m02_system_p5_duplicate";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S5_R0_JC");
    await updateImmutableFixtureResult(
      schema,
      `UPDATE acquisition_results
       SET result=jsonb_set(
         jsonb_set(result,'{identityDiscovery,trustedExternalIdentifierOrNull}','null'::jsonb),
         '{identityDiscovery,exactNameCreatorOrganizationMatches}',
         jsonb_build_array(jsonb_build_object(
           'normalizedSourceName','system-skill','creatorIdentityOrNull','creator-system',
           'organizationIdentityOrNull',NULL,'targetResourceIdentityId',$1::text,
           'targetResourceVersionId',$2::text,
           'evidenceReferenceIds',jsonb_build_array($3::text))))
       WHERE job_id=$4`,
      [
        fixture.resourceIdentityId,
        fixture.priorResourceVersionId,
        fixture.evidenceId,
        fixture.jobId,
      ],
    );
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S5_R0_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S7_JR");
    const rows = await pool.query<{
      outcome: string;
      matched_tier: string;
      signal_type: string;
      target_type: string;
      resource_version_id: string;
      evidence_reference_id: string;
    }>(
      `SELECT decision.outcome,decision.matched_tier,signal.signal_type,signal.target_type,
        signal.resource_version_id,evidence.evidence_reference_id
       FROM ${schema}.identity_decisions decision
       JOIN ${schema}.identity_decision_signals signal ON signal.identity_decision_id=decision.id
       JOIN ${schema}.identity_decision_signal_evidence evidence ON evidence.signal_id=signal.id
       ORDER BY signal.ordinal,evidence.ordinal`,
    );
    expect(rows.rows).toEqual([
      {
        outcome: "POSSIBLE_DUPLICATE",
        matched_tier: "P5",
        signal_type: "P5_CREATOR_IDENTITY",
        target_type: "RESOURCE_VERSION",
        resource_version_id: fixture.priorResourceVersionId,
        evidence_reference_id: fixture.evidenceId,
      },
      {
        outcome: "POSSIBLE_DUPLICATE",
        matched_tier: "P5",
        signal_type: "P5_SOURCE_NAME",
        target_type: "RESOURCE_VERSION",
        resource_version_id: fixture.priorResourceVersionId,
        evidence_reference_id: fixture.evidenceId,
      },
    ]);
  }, 60_000);

  it.each([
    { reliableIdentityTokenOrNull: "system-skill", expectedMode: "S1_R0_JC" },
    { reliableIdentityTokenOrNull: null, expectedMode: "S6_JR" },
  ] as const)(
    "dispatches a P6 weak-name row without linking when own token is $reliableIdentityTokenOrNull",
    async ({ reliableIdentityTokenOrNull, expectedMode }) => {
      const schema = `m02_system_p6_${reliableIdentityTokenOrNull === null ? "ambiguous" : "new"}`;
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
      await updateImmutableFixtureResult(
        schema,
        `UPDATE acquisition_results
         SET result=jsonb_set(
           jsonb_set(result,'{identityDiscovery,reliableIdentityTokenOrNull}',$1::jsonb),
           '{identityDiscovery,weakSimilarNameMatchOrNull}',jsonb_build_object(
             'targetResourceIdentityId','resource-existing',
             'targetResourceVersionId','version-prior',
             'evidenceReferenceIds',jsonb_build_array($2::text)))
         WHERE job_id=$3`,
        [JSON.stringify(reliableIdentityTokenOrNull), fixture.evidenceId, fixture.jobId],
      );
      const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
        projectorRequest("S1_R0_JC", fixture),
      );
      expect(result.automaticProjectorModeId).toBe(expectedMode);
      const signal = await pool.query<{
        signal_type: string;
        target_type: string;
        resource_version_id: string;
      }>(
        `SELECT signal_type,target_type,resource_version_id
         FROM ${schema}.identity_decision_signals`,
      );
      expect(signal.rows).toEqual([
        {
          signal_type: "P6_WEAK_SIMILAR_NAME",
          target_type: "RESOURCE_VERSION",
          resource_version_id: "version-prior",
        },
      ]);
      const attachment = await pool.query<{ resource_identity_id: string | null }>(
        `SELECT resource_identity_id FROM ${schema}.resource_candidates WHERE id=$1`,
        [fixture.candidateId],
      );
      expect(attachment.rows[0]?.resource_identity_id).not.toBe("resource-existing");
    },
    60_000,
  );

  it("dispatches reviewed divergent mirror provenance to blocking S6", async () => {
    const schema = "m02_system_divergent_mirror";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S2_JC");
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `INSERT INTO ${schema}.source_repository_relationships
           (id,mirror_source_repository_id,origin_source_repository_id,state,
            target_resource_version_id,delivery_source_link_id,evidence_ids,decision_id,
            reason,actor_id,created_at,record_version,command_id,result_id,audit_event_id)
         VALUES ('00000000-0000-7000-8000-000000004083',$1,'source-origin','ACTIVE',$2,$3,
           jsonb_build_array($4::text),'decision-seed','reviewed mirror fixture','fixture-editor',
           now(),1,'command-seed','result-seed','audit-command-seed')`,
        [
          fixture.sourceRepositoryId,
          fixture.priorResourceVersionId,
          fixture.activeSourceLinkId,
          fixture.evidenceId,
        ],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S2_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S6_JR");
    const conflict = await pool.query<{ conflict_code: string }>(
      `SELECT conflict_code FROM ${schema}.identity_decision_conflicts`,
    );
    expect(conflict.rows).toEqual([{ conflict_code: "DIVERGENT_MIRROR_CONTENT" }]);
  }, 60_000);

  it.each([
    { relationship: "same-content reviewed mirror", schema: "m02_system_reviewed_mirror_human" },
    { relationship: "reviewed independent fork", schema: "m02_system_reviewed_fork_human" },
  ])(
    "leaves $relationship to its accepted human owner",
    async ({ relationship, schema }) => {
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(pool, schema, "S3_JC");
      await pool.query(`SET session_replication_role = 'replica'`);
      try {
        if (relationship.includes("mirror"))
          await pool.query(
            `INSERT INTO ${schema}.source_repository_relationships
             (id,mirror_source_repository_id,origin_source_repository_id,state,
              target_resource_version_id,delivery_source_link_id,evidence_ids,decision_id,
              reason,actor_id,created_at,record_version,command_id,result_id,audit_event_id)
           VALUES ('00000000-0000-7000-8000-000000004093',$1,'source-origin','ACTIVE',$2,$3,
             jsonb_build_array($4::text),'decision-seed','reviewed mirror human owner',
             'fixture-editor',now(),1,'command-seed','result-seed','audit-command-seed')`,
            [
              fixture.sourceRepositoryId,
              fixture.exactResourceVersionId,
              fixture.activeSourceLinkId,
              fixture.evidenceId,
            ],
          );
        else
          await pool.query(
            `INSERT INTO ${schema}.fork_relationships
             (id,fork_resource_version_id,origin_resource_version_id,state,evidence_ids,
              decision_id,reason,actor_id,created_at,record_version,command_id,result_id,audit_event_id)
           VALUES ('00000000-0000-7000-8000-000000004094',$1,'version-origin','ACTIVE',
             jsonb_build_array($2::text),'decision-seed','reviewed fork human owner',
             'fixture-editor',now(),1,'command-seed','result-seed','audit-command-seed')`,
            [fixture.exactResourceVersionId, fixture.evidenceId],
          );
      } finally {
        await pool.query(`SET session_replication_role = 'origin'`);
      }

      await expect(
        new PostgresSystemIdentityAdapter(pool, { schema }).execute(
          projectorRequest("S3_JC", fixture),
        ),
      ).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
        phase: "POST_PROJECTOR_PRE_ALLOCATION",
      });
      const direct = await pool.query<{
        operations: string;
        rejections: string;
        human_relationships: string;
        system_relationships: string;
      }>(
        `SELECT
        (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
        (SELECT count(*) FROM ${schema}.m02_rejected_system_identity_audits)::text AS rejections,
        (SELECT count(*) FROM ${schema}.${relationship.includes("mirror") ? "source_repository_relationships" : "fork_relationships"}
          WHERE state='ACTIVE' AND command_id='command-seed' AND result_id='result-seed')::text
          AS human_relationships,
        (SELECT count(*) FROM ${schema}.${relationship.includes("mirror") ? "source_repository_relationships" : "fork_relationships"}
          WHERE command_id IS NULL OR result_id IS NULL)::text
          AS system_relationships`,
      );
      expect(direct.rows).toEqual([
        { operations: "0", rejections: "0", human_relationships: "1", system_relationships: "0" },
      ]);
    },
    60_000,
  );

  it("enforces external-identifier canonical bytes/hash and immutable tuple versioning", async () => {
    const schema = "m02_system_external_schema";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S4_R0_JC");
    await expect(
      pool.query(
        `INSERT INTO ${schema}.external_identifiers
           (id,resource_identity_id,provider,identifier_type,issuer,namespace,normalized_value,
            normalization_policy_version,evidence_reference_id,canonical_key_hash,
            canonical_key_payload,provenance,review_state,record_version)
         VALUES ('00000000-0000-7000-8000-000000004090',$1,'github','DECLARED_MANIFEST_ID',
           'github.com','system','different-token','external-id-v1',$2,$3,convert_to('{}','UTF8'),
           'HUMAN_VERIFIED_SOURCE_DECLARATION','VERIFIED',1)`,
        [fixture.resourceIdentityId, fixture.evidenceId, HASH_A],
      ),
    ).rejects.toThrow(/EXTERNAL_IDENTIFIER_CANONICAL_KEY_MISMATCH|check constraint/iu);
    await expect(
      pool.query(
        `UPDATE ${schema}.external_identifiers
         SET namespace='rewritten',record_version=record_version+1
         WHERE id='00000000-0000-7000-8000-000000004020'`,
      ),
    ).rejects.toThrow(/EXTERNAL_IDENTIFIER_IMMUTABLE/iu);
  }, 60_000);

  it("dispatches multiple exact content targets to blocking S6", async () => {
    const schema = "m02_system_multiple_content_targets";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      for (const [identityId, versionId, auditId, anchorCandidateId] of [
        [
          "00000000-0000-7000-8000-000000004091",
          "00000000-0000-7000-8000-000000004092",
          "00000000-0000-7000-8000-000000004093",
          fixture.candidateId,
        ],
        [
          "00000000-0000-7000-8000-000000004094",
          "00000000-0000-7000-8000-000000004095",
          "00000000-0000-7000-8000-000000004096",
          "candidate-1",
        ],
      ] as const) {
        await pool.query(
          `INSERT INTO ${schema}.resource_identities
             (id,status,created_at,record_version,guard_anchor_candidate_id,origin_type,
              command_id,result_id,audit_event_id)
           VALUES ($1,'ACTIVE',now(),1,$2,'HUMAN_COMMAND','command-seed','result-seed',$3)`,
          [identityId, anchorCandidateId, auditId],
        );
        await pool.query(
          `INSERT INTO ${schema}.resource_version_identities
             (id,resource_identity_id,content_fingerprint,canonical_payload,
              first_observed_source_snapshot_id,first_observed_candidate_root_id,
              first_observed_source_revision,observation_label,status,created_at,record_version,
              origin_type,command_id,result_id,audit_event_id)
           VALUES ($1,$2,$3,convert_to('{"content":"system"}','UTF8'),$4,$5,
             '0123456789abcdef0123456789abcdef01234567','snapshot:0123456789ab','IDENTITY_RESOLVED',
             now(),1,'HUMAN_COMMAND','command-seed','result-seed',$6)`,
          [versionId, identityId, HASH_A, fixture.snapshotId, fixture.rootId, auditId],
        );
        const guard = canonicalGuard("RESOURCE_VERSION", {
          resourceIdentityRef: {
            kind: "RESOURCE_IDENTITY_ANCHOR",
            originCandidateId: anchorCandidateId,
          },
          contentFingerprint: HASH_A,
        });
        await pool.query(
          `INSERT INTO ${schema}.m02_concurrency_guards
             (guard_key,guard_type,canonical_payload,payload_hash,record_version)
           VALUES ($1,$2,$3,$4,1)`,
          [guard.key, guard.guardType, Buffer.from(guard.canonicalPayload), guard.payloadHash],
        );
      }
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S1_R0_JC", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S6_JR");
    const conflict = await pool.query<{
      conflict_code: string;
      targets: string[];
      evidence_ids: string[];
      system_expected_versions: Record<string, number | null>;
    }>(
      `SELECT conflict.conflict_code,
        array_agg(target.resource_version_id ORDER BY convert_to(target.resource_version_id,'UTF8'))
          AS targets,
        array_agg(DISTINCT evidence.evidence_reference_id
          ORDER BY evidence.evidence_reference_id) AS evidence_ids,
        operation.system_expected_versions
       FROM ${schema}.identity_decision_conflicts conflict
       JOIN ${schema}.identity_decision_conflict_targets target ON target.conflict_id=conflict.id
       JOIN ${schema}.identity_decision_conflict_evidence evidence ON evidence.conflict_id=conflict.id
       JOIN ${schema}.identity_decisions decision ON decision.id=conflict.identity_decision_id
       JOIN ${schema}.m02_system_identity_operations operation
         ON operation.id=decision.system_operation_id
       GROUP BY conflict.conflict_code,operation.system_expected_versions`,
    );
    expect(conflict.rows[0]?.conflict_code).toBe("MULTIPLE_CANONICAL_TARGETS");
    expect(conflict.rows[0]?.targets).toEqual([
      "00000000-0000-7000-8000-000000004092",
      "00000000-0000-7000-8000-000000004095",
    ]);
    expect(conflict.rows[0]?.evidence_ids).toEqual([fixture.evidenceId]);
    expect(conflict.rows[0]?.system_expected_versions).toMatchObject({
      "row:resource_identities:00000000-0000-7000-8000-000000004091": 1,
      "row:resource_identities:00000000-0000-7000-8000-000000004094": 1,
      "row:resource_version_identities:00000000-0000-7000-8000-000000004092": 1,
      "row:resource_version_identities:00000000-0000-7000-8000-000000004095": 1,
    });
    const targetGuards = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${schema}.m02_concurrency_guards
       WHERE guard_type='RESOURCE_VERSION'`,
    );
    expect(targetGuards.rows).toEqual([{ count: "2" }]);
  }, 60_000);

  it("derives R0 canonical URL from immutable M01 source input and corroborates P1 against URL history", async () => {
    const createSchemaName = "m02_system_r0_canonical_url";
    await createSchema(createSchemaName);
    const createFixture = await seedM02SystemIdentityGraph(pool, createSchemaName, "S1_R0_JC");
    await updateImmutableFixtureResult(
      createSchemaName,
      `UPDATE acquisition_results
       SET result=jsonb_set(result,'{sourceReference}',
         '{"canonicalUrl":"https://github.com/system/repo","owner":"system",\
           "provider":"github","repository":"repo"}'::jsonb)
       WHERE job_id=$1`,
      [createFixture.jobId],
    );
    await new PostgresSystemIdentityAdapter(pool, { schema: createSchemaName }).execute(
      projectorRequest("S1_R0_JC", createFixture),
    );
    const createdUrl = await pool.query<{ canonical_url: string }>(
      `SELECT canonical_url FROM ${createSchemaName}.source_repository_urls
       WHERE source_repository_id IN (
         SELECT id FROM ${createSchemaName}.source_repository_identities
         WHERE provider='github' AND provider_repository_id='system-repo')`,
    );
    expect(createdUrl.rows).toEqual([{ canonical_url: "https://github.com/system/repo" }]);
    await expect(
      pool.query(
        `UPDATE ${createSchemaName}.acquisition_results SET result='{}'::jsonb
         WHERE job_id=$1`,
        [createFixture.jobId],
      ),
    ).rejects.toThrow(/M02_HISTORY_IMMUTABLE/iu);

    const mismatchSchema = "m02_system_p1_url_conflict";
    await createSchema(mismatchSchema);
    const mismatchFixture = await seedM02SystemIdentityGraph(pool, mismatchSchema, "S3_JC");
    await updateImmutableFixtureResult(
      mismatchSchema,
      `UPDATE acquisition_results
       SET result=jsonb_set(result,'{sourceReference}',
         '{"canonicalUrl":"https://github.com/system/repo","owner":"system",\
           "provider":"github","repository":"repo"}'::jsonb)
       WHERE job_id=$1`,
      [mismatchFixture.jobId],
    );
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `UPDATE ${mismatchSchema}.source_repository_urls
         SET canonical_url='https://github.com/system/other'
         WHERE source_repository_id=$1 AND state='ACTIVE'`,
        [mismatchFixture.sourceRepositoryId],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const mismatch = await new PostgresSystemIdentityAdapter(pool, {
      schema: mismatchSchema,
    }).execute(projectorRequest("S3_JC", mismatchFixture));
    expect(mismatch.automaticProjectorModeId).toBe("S6_JR");
    const mismatchConflict = await pool.query<{ conflict_code: string }>(
      `SELECT conflict_code FROM ${mismatchSchema}.identity_decision_conflicts`,
    );
    expect(mismatchConflict.rows).toEqual([{ conflict_code: "PROVENANCE_SIGNAL_CONFLICT" }]);
  }, 60_000);

  it.each(EXACT_SYSTEM_MODES.filter((mode) => !mode.startsWith("S9_") && mode !== "S10_JR"))(
    "persists the exact initial projector graph for %s",
    async (mode) => {
      const schema = `m02_system_${mode.toLowerCase()}`;
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(pool, schema, mode);
      const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
        projectorRequest(mode, fixture),
      );
      expect(result.automaticProjectorModeId).toBe(mode);
      expect(result.replayed).toBe(false);
      expect(result.createdIdentityDecisionTierEvaluationIds).toHaveLength(6);
      const direct = await pool.query<{ operations: string; results: string; decisions: string }>(
        `SELECT
          (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
          (SELECT count(*) FROM ${schema}.m02_system_identity_results)::text AS results,
          (SELECT count(*) FROM ${schema}.identity_decisions
            WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS decisions`,
      );
      expect(direct.rows[0]).toEqual({ operations: "1", results: "1", decisions: "1" });
      const expectedOutcome = mode.startsWith("S1_")
        ? "NEW_RESOURCE"
        : mode.startsWith("S2_") || mode.startsWith("S5_")
          ? "EXISTING_RESOURCE_NEW_VERSION"
          : mode.startsWith("S3_") || mode.startsWith("S4_")
            ? "EXACT_REPEAT_REUSE"
            : mode === "S7_JR"
              ? "POSSIBLE_DUPLICATE"
              : mode === "S8_JR"
                ? "FORK_OF_EXISTING_RESOURCE"
                : "AMBIGUOUS_IDENTITY";
      const success = /^S[1-5]_/u.test(mode);
      const projection = await pool.query<{
        decision_outcome: string;
        candidate_outcome: string;
        candidate_status: string;
        review_state: string;
        acquisition_status: string;
        job_review_state: string;
        result_m02_job_status: string;
        created_resource_identities: string;
        created_resource_versions: string;
        created_source_links: string;
        created_observations: string;
        created_duplicates: string;
        created_handoffs: string;
        reused_resource_identities: string;
        reused_resource_versions: string;
        reused_source_links: string;
        superseded_source_links: string;
      }>(
        `SELECT decision.outcome AS decision_outcome,
          candidate.identity_outcome AS candidate_outcome,candidate.status AS candidate_status,
          review.review_state,acquisition.status AS acquisition_status,
          job.review_state AS job_review_state,
          result.final_m02_job_status AS result_m02_job_status,
          cardinality(result.created_resource_identity_ids)::text AS created_resource_identities,
          cardinality(result.created_resource_version_identity_ids)::text AS created_resource_versions,
          cardinality(result.created_source_link_ids)::text AS created_source_links,
          cardinality(result.created_observation_ids)::text AS created_observations,
          cardinality(result.created_duplicate_candidate_ids)::text AS created_duplicates,
          cardinality(result.created_handoff_marker_ids)::text AS created_handoffs,
          cardinality(result.reused_resource_identity_ids)::text AS reused_resource_identities,
          cardinality(result.reused_resource_version_identity_ids)::text AS reused_resource_versions,
          cardinality(result.reused_source_link_ids)::text AS reused_source_links,
          cardinality(result.superseded_source_link_ids)::text AS superseded_source_links
         FROM ${schema}.m02_system_identity_results result
         JOIN ${schema}.identity_decisions decision ON decision.id=result.identity_decision_id
         JOIN ${schema}.resource_candidates candidate ON candidate.id=result.candidate_id
         JOIN ${schema}.m02_review_states review ON review.resource_candidate_id=candidate.id
         JOIN ${schema}.acquisition_jobs acquisition ON acquisition.id=result.controlling_job_id
         JOIN ${schema}.m02_jobs job ON job.id=result.controlling_job_id`,
      );
      expect(projection.rows[0]).toEqual({
        decision_outcome: expectedOutcome,
        candidate_outcome: expectedOutcome,
        candidate_status: success ? "IDENTITY_RESOLVED" : "IDENTITY_REVIEW_REQUIRED",
        review_state: success ? "RESOLVED" : "IDENTITY_REVIEW_REQUIRED",
        acquisition_status: mode.endsWith("_JC") ? "COMPLETED" : "OPERATOR_REVIEW_REQUIRED",
        job_review_state: success ? "RESOLVED" : "IDENTITY_REVIEW_REQUIRED",
        result_m02_job_status: mode.endsWith("_JC") ? "COMPLETED" : "OPERATOR_REVIEW_REQUIRED",
        created_resource_identities: mode.startsWith("S1_") ? "1" : "0",
        created_resource_versions:
          mode.startsWith("S1_") || mode.startsWith("S2_") || mode.startsWith("S5_") ? "1" : "0",
        created_source_links: /^S[1245]_/u.test(mode) ? "1" : "0",
        created_observations: success ? "1" : "0",
        created_duplicates: mode === "S7_JR" ? "1" : "0",
        created_handoffs: success ? "1" : "0",
        reused_resource_identities: /^S[2345]_/u.test(mode) ? "1" : "0",
        reused_resource_versions: /^S[234]_/u.test(mode) ? "1" : "0",
        reused_source_links: mode.startsWith("S3_") ? "1" : "0",
        superseded_source_links: mode.startsWith("S2_") ? "1" : "0",
      });
      if (mode === "S8_JR") {
        const forkSignal = await pool.query<{ target_id: string; provider_repository_id: string }>(
          `SELECT signal.source_repository_id AS target_id,repository.provider_repository_id
           FROM ${schema}.identity_decision_signals signal
           JOIN ${schema}.source_repository_identities repository
             ON repository.id=signal.source_repository_id`,
        );
        expect(forkSignal.rows).toEqual([
          {
            target_id: "00000000-0000-7000-8000-000000004026",
            provider_repository_id: "source-origin",
          },
        ]);
        const forkRepositoryGuard = canonicalGuard("SOURCE_REPOSITORY", {
          repositoryRef: { provider: "github", providerRepositoryId: "source-origin" },
        });
        const forkGuardEvidence = await pool.query<{
          row_version: string;
          guard_version: string;
          expected_guard_version: string;
          expected_row_version: string;
        }>(
          `SELECT repository.record_version AS row_version,
            guard.record_version AS guard_version,
            operation.system_expected_versions->>$1 AS expected_guard_version,
            operation.system_expected_versions->>$2 AS expected_row_version
           FROM ${schema}.source_repository_identities repository
           JOIN ${schema}.m02_concurrency_guards guard ON guard.guard_key=$1
           JOIN ${schema}.m02_system_identity_operations operation ON true
           WHERE repository.id=$3`,
          [
            forkRepositoryGuard.key,
            "row:source_repository_identities:00000000-0000-7000-8000-000000004026",
            "00000000-0000-7000-8000-000000004026",
          ],
        );
        expect(forkGuardEvidence.rows).toEqual([
          {
            row_version: "1",
            guard_version: "1",
            expected_guard_version: "1",
            expected_row_version: "1",
          },
        ]);
      }
      const executedReceipt = await readSystemProjectionReceipt(schema);
      expect(executedReceipt).toMatchObject({ operations: "1", results: "1", decisions: "1" });
      committedSystemModeReceipts.set(mode, {
        direct: direct.rows[0],
        projection: projection.rows[0],
        persisted: executedReceipt,
      });
    },
    60_000,
  );

  it("materializes the exact S7 proposal-set and proposal-pair guards in the shared V2 namespace", async () => {
    const schema = "m02_system_s7_proposal_guards";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S7_JR");
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S7_JR", fixture),
    );
    const proposalSet = canonicalGuard("DUPLICATE_PROPOSAL_SET", {
      candidateId: fixture.candidateId,
    });
    const proposalPair = canonicalGuard("DUPLICATE_PROPOSAL_PAIR", {
      candidateId: fixture.candidateId,
      targetVersionRef: {
        kind: "RESOURCE_VERSION_ANCHOR",
        resourceIdentityRef: {
          kind: "RESOURCE_IDENTITY_ANCHOR",
          originCandidateId: fixture.candidateId,
        },
        contentFingerprint: HASH_A,
      },
    });
    const disposition = canonicalGuard("DUPLICATE_DISPOSITION", {
      candidateId: fixture.candidateId,
    });
    const relationshipPair = canonicalGuard("RELATIONSHIP_PAIR", {
      relationshipType: "DUPLICATE_OF",
      sourceEndpointRef: { kind: "CANDIDATE", candidateId: fixture.candidateId },
      targetEndpointRef: {
        kind: "RESOURCE_VERSION",
        versionRef: {
          kind: "RESOURCE_VERSION_ANCHOR",
          resourceIdentityRef: {
            kind: "RESOURCE_IDENTITY_ANCHOR",
            originCandidateId: fixture.candidateId,
          },
          contentFingerprint: HASH_A,
        },
      },
    });
    const direct = await pool.query<{
      guard_key: string;
      canonical_payload: Buffer;
      record_version: string;
    }>(
      `SELECT guard_key,canonical_payload,record_version
       FROM ${schema}.m02_concurrency_guards
       WHERE guard_key=ANY($1::text[]) ORDER BY guard_key`,
      [[proposalSet.key, proposalPair.key]],
    );
    expect(direct.rows).toHaveLength(2);
    expect(
      direct.rows.map((row) => [
        row.guard_key,
        Buffer.from(row.canonical_payload).toString("utf8"),
        Number(row.record_version),
      ]),
    ).toEqual(
      [proposalSet, proposalPair]
        .sort((left, right) => Buffer.compare(Buffer.from(left.key), Buffer.from(right.key)))
        .map((guard) => [guard.key, Buffer.from(guard.canonicalPayload).toString("utf8"), 1]),
    );
    const operation = await pool.query<{ system_expected_versions: Record<string, number | null> }>(
      `SELECT system_expected_versions FROM ${schema}.m02_system_identity_operations`,
    );
    expect(operation.rows[0]?.system_expected_versions).toMatchObject({
      [proposalSet.key]: null,
      [proposalPair.key]: null,
      [disposition.key]: null,
      [relationshipPair.key]: null,
      [`row:resource_identities:${fixture.resourceIdentityId}`]: 1,
      [`row:resource_version_identities:${fixture.exactResourceVersionId}`]: 1,
    });
    const protectedNullCount = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ${schema}.m02_concurrency_guards
       WHERE guard_key=ANY($1::text[])`,
      [[disposition.key, relationshipPair.key]],
    );
    expect(protectedNullCount.rows[0]?.count).toBe("0");
  }, 60_000);

  it("reuses exact human V2 I/V/link guards and changes only system-owned active sets", async () => {
    const schema = "m02_system_shared_full_guard_lifecycle";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S3_JC");
    const repository = canonicalGuard("SOURCE_REPOSITORY", {
      repositoryRef: { provider: "github", providerRepositoryId: "system-repo" },
    });
    const source = canonicalGuard("RESOURCE_SOURCE", {
      provider: "github",
      providerRepositoryId: "system-repo",
      normalizedRootPath: ".",
    });
    const resourceIdentityRef = {
      kind: "RESOURCE_IDENTITY_ANCHOR",
      originCandidateId: fixture.candidateId,
    } as const;
    const resourceVersionRef = {
      kind: "RESOURCE_VERSION_ANCHOR",
      resourceIdentityRef,
      contentFingerprint: HASH_A,
    } as const;
    const version = canonicalGuard("RESOURCE_VERSION", {
      resourceIdentityRef,
      contentFingerprint: HASH_A,
    });
    const observation = canonicalGuard("OBSERVATION", {
      resourceVersionRef,
      sourceSnapshotId: fixture.snapshotId,
      candidateRootId: fixture.rootId,
      sourceLinkRef: {
        provider: "github",
        providerRepositoryId: "system-repo",
        normalizedRootPath: ".",
      },
    });
    const handoff = canonicalGuard("HANDOFF", { candidateId: fixture.candidateId });
    const controller = canonicalGuard("JOB_SCOPE_CONTROLLER", {
      jobLineageId: "lineage-system",
      operationScope: "IDENTITY_RESOLUTION",
    });
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S3_JC", fixture),
    );
    const operation = await pool.query<{ system_expected_versions: Record<string, number | null> }>(
      `SELECT system_expected_versions FROM ${schema}.m02_system_identity_operations`,
    );
    expect(operation.rows[0]?.system_expected_versions).toMatchObject({
      [repository.key]: 1,
      [source.key]: 1,
      [version.key]: 1,
      [observation.key]: null,
      [handoff.key]: null,
      [controller.key]: null,
      [`row:source_repository_identities:${fixture.sourceRepositoryId}`]: 1,
      [`row:resource_identities:${fixture.resourceIdentityId}`]: 1,
      [`row:resource_version_identities:${fixture.exactResourceVersionId}`]: 1,
      [`row:resource_source_links:${fixture.activeSourceLinkId}`]: 1,
    });
    const persisted = await pool.query<{ guard_key: string; record_version: string }>(
      `SELECT guard_key,record_version FROM ${schema}.m02_concurrency_guards
       WHERE guard_key=ANY($1::text[]) ORDER BY guard_key`,
      [[repository.key, source.key, version.key, observation.key, handoff.key, controller.key]],
    );
    expect(
      Object.fromEntries(persisted.rows.map((row) => [row.guard_key, Number(row.record_version)])),
    ).toEqual({
      [repository.key]: 1,
      [source.key]: 1,
      [version.key]: 1,
      [observation.key]: 1,
      [handoff.key]: 1,
      [controller.key]: 1,
    });
  }, 60_000);

  it.each(["S9_JC", "S9_JR", "S10_JR"] as const)(
    "persists the reachable replacement-controller projector graph for %s",
    async (mode) => {
      const schema = `m02_system_${mode.toLowerCase()}`;
      await createSchema(schema);
      const initialFixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
      const initial = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
        projectorRequest("S1_R0_JC", initialFixture),
      );
      const fixture = await seedM02SystemReanalysisGraph(pool, schema, initialFixture, mode);
      const request = projectorRequest(mode, fixture);
      const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(request);
      expect(result.automaticProjectorModeId).toBe(mode);
      expect(result.resourceIdentityIdOrNull).toBe(initial.resourceIdentityIdOrNull);
      expect(result.resourceVersionIdentityIdOrNull).toBe(initial.resourceVersionIdentityIdOrNull);
      const expectedReplacementInput =
        `{"analysisMethodologyVersionOrNull":null,"analysisModelIdOrNull":null,` +
        `"analysisPolicyVersion":"analysis-v2","analysisProviderAdapterIdOrNull":null,` +
        `"classificationPolicyVersion":"classification-v1",` +
        `"controllingClassificationDecisionIdOrNull":"${initialFixture.runId}",` +
        `"identityPolicyVersion":"identity-v1","jobLineageId":"lineage-system",` +
        `"parserProfileVersion":"parser-v1","predecessorJobIds":["${initialFixture.jobId}"],` +
        `"promptBundleVersion":"prompt-v1","replacementSourceSnapshotIdOrNull":null,` +
        `"requestedOperationScope":"IDENTITY_RESOLUTION","schemaVersion":"1",` +
        `"sourceJobId":"${initialFixture.jobId}","sourceOperationScope":"IDENTITY_RESOLUTION",` +
        `"sourceSnapshotId":"${initialFixture.snapshotId}"}`;
      const expectedReplacementFingerprint = createHash("sha256")
        .update(expectedReplacementInput)
        .digest("hex");
      const replacement = await pool.query<{
        replacement_input: string;
        replacement_input_fingerprint: string;
        input_fingerprint: string;
        analysis_policy_version: string;
        replacement_edges: string;
        replacement_commands: string;
        replacement_results: string;
      }>(
        `SELECT convert_from(job.replacement_input_payload,'UTF8') AS replacement_input,
          job.replacement_input_fingerprint,job.input_fingerprint,job.analysis_policy_version,
          (SELECT count(*) FROM ${schema}.m02_job_supersessions edge
            WHERE edge.replacement_job_id=job.id AND edge.source_job_id=$2)::text AS replacement_edges,
          (SELECT count(*) FROM ${schema}.m02_job_supersessions edge
            JOIN ${schema}.manual_resolution_commands command ON command.id=edge.command_id
            WHERE edge.replacement_job_id=job.id AND edge.source_job_id=$2
              AND command.command_type='REPLACE_M02_JOB')::text AS replacement_commands,
          (SELECT count(*) FROM ${schema}.m02_job_supersessions edge
            JOIN ${schema}.m02_manual_command_results command_result ON command_result.id=edge.result_id
            WHERE edge.replacement_job_id=job.id AND edge.source_job_id=$2
              AND command_result.command_id=edge.command_id)::text AS replacement_results
         FROM ${schema}.m02_jobs job WHERE job.id=$1`,
        [fixture.jobId, initialFixture.jobId],
      );
      expect(replacement.rows[0]).toEqual({
        replacement_input: expectedReplacementInput,
        replacement_input_fingerprint: expectedReplacementFingerprint,
        input_fingerprint: expectedReplacementFingerprint,
        analysis_policy_version: "analysis-v2",
        replacement_edges: "1",
        replacement_commands: "1",
        replacement_results: "1",
      });
      const replacementInputGuard = canonicalGuard("JOB_REPLACEMENT_INPUT", {
        sourceJobId: initialFixture.jobId,
        requestedScope: "IDENTITY_RESOLUTION",
        replacementInputFingerprint: expectedReplacementFingerprint,
      });
      const replacementGuardEvidence = await pool.query<{
        record_version: string;
        expected_version: string;
        canonical_payload: string;
      }>(
        `SELECT guard.record_version,
          operation.system_expected_versions->>$1 AS expected_version,
          convert_from(guard.canonical_payload,'UTF8') AS canonical_payload
         FROM ${schema}.m02_concurrency_guards guard
         JOIN ${schema}.m02_system_identity_operations operation
           ON operation.controlling_job_id=$2
         WHERE guard.guard_key=$1`,
        [replacementInputGuard.key, fixture.jobId],
      );
      expect(replacementGuardEvidence.rows).toEqual([
        {
          record_version: "1",
          expected_version: "1",
          canonical_payload: Buffer.from(replacementInputGuard.canonicalPayload).toString("utf8"),
        },
      ]);
      const direct = await pool.query<{
        operations: string;
        active_decisions: string;
        superseded_decisions: string;
        active_handoffs: string;
        system_resource_identities: string;
        system_resource_versions: string;
        system_decisions: string;
        predecessor_system_handoffs: string;
        current_system_handoffs: string;
      }>(
        `SELECT
          (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
          (SELECT count(*) FROM ${schema}.identity_decisions
            WHERE resource_candidate_id=$1 AND state='ACTIVE')::text AS active_decisions,
          (SELECT count(*) FROM ${schema}.identity_decisions
            WHERE resource_candidate_id=$1 AND state='SUPERSEDED')::text AS superseded_decisions,
          (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
            WHERE resource_candidate_id=$1 AND state='ACTIVE')::text AS active_handoffs,
          (SELECT count(*) FROM ${schema}.resource_identities
            WHERE id=$3 AND origin_type='SYSTEM_IDENTITY_OPERATION')::text AS system_resource_identities,
          (SELECT count(*) FROM ${schema}.resource_version_identities
            WHERE id=$4 AND origin_type='SYSTEM_IDENTITY_OPERATION')::text AS system_resource_versions,
          (SELECT count(*) FROM ${schema}.identity_decisions
            WHERE resource_candidate_id=$1 AND origin_type='SYSTEM_IDENTITY_OPERATION')::text AS system_decisions,
          (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
            WHERE resource_candidate_id=$1 AND controlling_m02_job_id=$2
              AND origin_type='SYSTEM_IDENTITY_OPERATION' AND state='SUPERSEDED')::text
            AS predecessor_system_handoffs,
          (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers
            WHERE resource_candidate_id=$1 AND controlling_m02_job_id=$5
              AND origin_type='SYSTEM_IDENTITY_OPERATION' AND state='ACTIVE')::text
            AS current_system_handoffs`,
        [
          fixture.candidateId,
          initialFixture.jobId,
          initial.resourceIdentityIdOrNull,
          initial.resourceVersionIdentityIdOrNull,
          fixture.jobId,
        ],
      );
      expect(direct.rows[0]).toEqual({
        operations: "2",
        active_decisions: "1",
        superseded_decisions: "1",
        active_handoffs: mode.startsWith("S9_") ? "1" : "0",
        system_resource_identities: "1",
        system_resource_versions: "1",
        system_decisions: "2",
        predecessor_system_handoffs: "1",
        current_system_handoffs: mode.startsWith("S9_") ? "1" : "0",
      });
      const executedReceipt = await readSystemProjectionReceipt(schema);
      expect(executedReceipt).toMatchObject({ operations: "2", results: "2", decisions: "2" });
      committedSystemModeReceipts.set(mode, {
        direct: direct.rows[0],
        projection: executedReceipt,
        replacement: replacement.rows[0],
        replacementGuard: replacementGuardEvidence.rows[0],
      });
    },
    60_000,
  );

  it("requires the predecessor handoff supersession audit to match the replacement edge/result", async () => {
    const schema = "m02_system_replacement_provenance";
    await createSchema(schema);
    const initialFixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S1_R0_JC", initialFixture),
    );
    const fixture = await seedM02SystemReanalysisGraph(pool, schema, initialFixture, "S9_JC");
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `UPDATE ${schema}.m02_audit_events audit
         SET command_id='command-seed',result_id='result-seed'
         FROM ${schema}.m02_identity_handoff_markers handoff
         WHERE audit.subject_type='M02_IDENTITY_HANDOFF' AND audit.subject_id=handoff.id
           AND audit.action='SUBJECT_SUPERSEDED'
           AND handoff.resource_candidate_id=$1 AND handoff.controlling_m02_job_id=$2`,
        [fixture.candidateId, initialFixture.jobId],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    await expect(
      new PostgresSystemIdentityAdapter(pool, { schema }).execute(
        projectorRequest("S9_JC", fixture),
      ),
    ).rejects.toMatchObject({
      code: "MUTATION_PLAN_CHANGED",
      phase: "POST_PROJECTOR_PRE_ALLOCATION",
    });
  }, 60_000);

  it("derives J from every sibling's complete current-controller Decision/handoff chain", async () => {
    const schema = "m02_system_current_controller_aggregate";
    await createSchema(schema);
    const initialFixture = await seedM02SystemIdentityGraph(pool, schema, "S3_JR");
    if (initialFixture.siblingCandidateId === null) throw new Error("SIBLING_FIXTURE_MISSING");
    const siblingFixture = {
      ...initialFixture,
      candidateId: initialFixture.siblingCandidateId,
    };
    const siblingResult = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S5_R1_JR", siblingFixture),
    );
    expect(siblingResult.automaticProjectorModeId.endsWith("_JR")).toBe(true);

    const replacementFixture = await seedM02SystemReanalysisGraph(
      pool,
      schema,
      initialFixture,
      "S9_JC",
      "RETRY_EXHAUSTED",
    );
    await pool.query(
      `UPDATE ${schema}.m02_jobs
       SET review_state='NOT_REQUIRED',record_version=record_version+1 WHERE id=$1`,
      [replacementFixture.jobId],
    );
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S3_JR", replacementFixture),
    );
    expect(result.automaticProjectorModeId).toBe("S3_JR");
    const siblingChain = await pool.query<{
      candidate_status: string;
      active_decision_controller: string;
      predecessor_handoffs: string;
      current_handoffs: string;
    }>(
      `SELECT sibling.status AS candidate_status,
        operation.controlling_job_id AS active_decision_controller,
        (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers handoff
          WHERE handoff.resource_candidate_id=sibling.id
            AND handoff.controlling_m02_job_id=$2 AND handoff.state='SUPERSEDED')::text
          AS predecessor_handoffs,
        (SELECT count(*) FROM ${schema}.m02_identity_handoff_markers handoff
          WHERE handoff.resource_candidate_id=sibling.id
            AND handoff.controlling_m02_job_id=$3 AND handoff.state='ACTIVE')::text
          AS current_handoffs
       FROM ${schema}.resource_candidates sibling
       JOIN ${schema}.identity_decisions decision
         ON decision.resource_candidate_id=sibling.id AND decision.state='ACTIVE'
       JOIN ${schema}.m02_system_identity_operations operation
         ON operation.id=decision.system_operation_id
       WHERE sibling.id=$1`,
      [initialFixture.siblingCandidateId, initialFixture.jobId, replacementFixture.jobId],
    );
    expect(siblingChain.rows[0]).toEqual({
      candidate_status: "IDENTITY_RESOLVED",
      active_decision_controller: initialFixture.jobId,
      predecessor_handoffs: "1",
      current_handoffs: "0",
    });
  }, 60_000);

  it("counts a valid HUMAN_COMMAND sibling Decision/handoff chain in J", async () => {
    const schema = "m02_system_human_sibling_chain";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JR");
    if (fixture.siblingCandidateId === null) throw new Error("SIBLING_FIXTURE_MISSING");
    const siblingDecisionId = "00000000-0000-7000-8000-000000004097";
    const siblingHandoffId = "00000000-0000-7000-8000-000000004098";
    await pool.query(`SET session_replication_role = 'replica'`);
    try {
      await pool.query(
        `UPDATE ${schema}.resource_candidates
         SET status='IDENTITY_RESOLVED',identity_outcome='EXACT_REPEAT_REUSE',
           resource_identity_id='resource-existing',resource_version_identity_id='version-target',
           record_version=record_version+1,updated_at=now()
         WHERE id=$1`,
        [fixture.siblingCandidateId],
      );
      await pool.query(
        `UPDATE ${schema}.m02_review_states
         SET review_state='RESOLVED',record_version=record_version+1 WHERE resource_candidate_id=$1`,
        [fixture.siblingCandidateId],
      );
      await pool.query(
        `INSERT INTO ${schema}.identity_decisions
           (id,resource_candidate_id,outcome,identity_policy_version,decision_source,signals,
            rejected_lower_tier_signals,conflicts,audit_fingerprint,state,created_at,record_version,
            origin_type,command_id,result_id,audit_event_id)
         VALUES ($2,$1,'EXACT_REPEAT_REUSE','identity-v1','HUMAN_COMMAND','[]','[]','[]',$3,
           'ACTIVE',now(),1,'HUMAN_COMMAND','command-seed','result-seed','audit-decision-seed')`,
        [fixture.siblingCandidateId, siblingDecisionId, HASH_B],
      );
      await pool.query(
        `INSERT INTO ${schema}.m02_identity_handoff_markers
           (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
            controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
            command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
            created_at,record_version)
         VALUES ($3,$1,'resource-existing','version-target',$4,$5,$2,'HUMAN_COMMAND',
           'command-seed','result-seed','audit-command-seed','human-sibling','CONTROLLING',
           'ACTIVE',now(),1)`,
        [
          fixture.siblingCandidateId,
          siblingDecisionId,
          siblingHandoffId,
          fixture.jobId,
          fixture.snapshotId,
        ],
      );
    } finally {
      await pool.query(`SET session_replication_role = 'origin'`);
    }
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S1_R0_JR", fixture),
    );
    expect(result.automaticProjectorModeId).toBe("S1_R0_JC");
  }, 60_000);

  it("persists the blocking S6 operation, Decision children, result, and exact audits", async () => {
    const schema = "m02_system_s6";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    const adapter = new PostgresSystemIdentityAdapter(pool, { schema });
    const result = await adapter.execute(projectorRequest("S6_JR", fixture));
    expect(result.automaticProjectorModeId).toBe("S6_JR");
    expect(result.replayed).toBe(false);
    expect(result.createdIdentityDecisionTierEvaluationIds).toHaveLength(6);

    const direct = await pool.query<{
      operations: string;
      results: string;
      decisions: string;
      tiers: string;
      audits: string;
      accepted: string;
    }>(
      `SELECT
        (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
        (SELECT count(*) FROM ${schema}.m02_system_identity_results)::text AS results,
        (SELECT count(*) FROM ${schema}.identity_decisions WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS decisions,
        (SELECT count(*) FROM ${schema}.identity_decision_tier_evaluations)::text AS tiers,
        (SELECT count(*) FROM ${schema}.m02_audit_events WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS audits,
        (SELECT count(*) FROM ${schema}.m02_audit_events WHERE action='SYSTEM_OPERATION_ACCEPTED')::text AS accepted`,
    );
    expect(direct.rows[0]).toMatchObject({
      operations: "1",
      results: "1",
      decisions: "1",
      tiers: "6",
      accepted: "1",
    });
    expect(Number(direct.rows[0]?.audits)).toBe(14);
  }, 60_000);

  it("returns accepted replay before mutable eligibility and performs no second write", async () => {
    const schema = "m02_system_replay";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    const request = projectorRequest("S6_JR", fixture);
    const adapter = new PostgresSystemIdentityAdapter(pool, { schema });
    const first = await adapter.execute(request);
    const replay = await adapter.execute(request);
    expect(replay).toMatchObject({
      id: first.id,
      systemOperationId: first.systemOperationId,
      identityDecisionId: first.identityDecisionId,
      replayed: true,
      attemptCount: 0,
    });
    const counts = await pool.query<{ operations: string; audits: string; guard_version: string }>(
      `SELECT
        (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
        (SELECT count(*) FROM ${schema}.m02_audit_events
          WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS audits,
        (SELECT record_version FROM ${schema}.m02_concurrency_guards)::text AS guard_version`,
    );
    expect(counts.rows[0]).toEqual({ operations: "1", audits: "14", guard_version: "1" });
    systemExecutedReceipts.record("F42", "lifecycle.replay", {
      sameIdentityDecision: replay.identityDecisionId === first.identityDecisionId,
      sameOperation: replay.systemOperationId === first.systemOperationId,
      firstReplayed: first.replayed,
      replayed: replay.replayed,
      replayAttemptCount: replay.attemptCount,
      persisted: counts.rows[0],
    });
  }, 60_000);

  it("finds full idempotency after freeze when another resolver commits first", async () => {
    const schema = "m02_system_post_freeze_replay";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    const request = projectorRequest("S6_JR", fixture);
    let releaseFrozen!: () => void;
    let observedFrozen!: () => void;
    const frozen = new Promise<void>((resolve) => {
      observedFrozen = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFrozen = resolve;
    });
    const delayed = new PostgresSystemIdentityAdapter(pool, {
      schema,
      onFrozen: async () => {
        observedFrozen();
        await release;
      },
    }).execute(request);
    await frozen;
    const winner = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(request);
    releaseFrozen();
    const replay = await delayed;
    expect(winner.replayed).toBe(false);
    expect(replay).toMatchObject({ id: winner.id, replayed: true, attemptCount: 0 });
  }, 60_000);

  it("serializes concurrent same-identity attempts to one accepted graph", async () => {
    const schema = "m02_system_concurrent";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    const request = projectorRequest("S6_JR", fixture);
    const [left, right] = await Promise.all([
      new PostgresSystemIdentityAdapter(pool, { schema }).execute(request),
      new PostgresSystemIdentityAdapter(pool, { schema }).execute(request),
    ]);
    expect(left.id).toBe(right.id);
    expect([left.replayed, right.replayed].sort()).toEqual([false, true]);
    const count = await pool.query<{ value: string }>(
      `SELECT count(*)::text AS value FROM ${schema}.m02_system_identity_operations`,
    );
    expect(count.rows[0]?.value).toBe("1");
  }, 60_000);

  it("rolls back an interrupted attempt and succeeds on a bounded third Serializable attempt", async () => {
    const rollbackSchema = "m02_system_rollback";
    await createSchema(rollbackSchema);
    const rollbackFixture = await seedM02SystemIdentityGraph(pool, rollbackSchema, "S6_JR");
    const rollbackRequest = projectorRequest("S6_JR", rollbackFixture);
    await expect(
      new PostgresSystemIdentityAdapter(pool, {
        schema: rollbackSchema,
        onTransactionAttempt: async (_attempt, client) => {
          await client.query(
            "UPDATE resource_candidates SET record_version=record_version+1 WHERE id=$1",
            [rollbackFixture.candidateId],
          );
          throw new Error("FAULT_INJECTED");
        },
      }).execute(rollbackRequest),
    ).rejects.toThrow("FAULT_INJECTED");
    const rolledBack = await pool.query<{ operations: string; version: string }>(
      `SELECT
        (SELECT count(*) FROM ${rollbackSchema}.m02_system_identity_operations)::text AS operations,
        (SELECT record_version FROM ${rollbackSchema}.resource_candidates WHERE id=$1)::text AS version`,
      [rollbackFixture.candidateId],
    );
    expect(rolledBack.rows[0]).toEqual({ operations: "0", version: "1" });

    const retrySchema = "m02_system_retry";
    await createSchema(retrySchema);
    const retryFixture = await seedM02SystemIdentityGraph(pool, retrySchema, "S6_JR");
    const result = await new PostgresSystemIdentityAdapter(pool, {
      schema: retrySchema,
      onTransactionAttempt: (attempt) => {
        if (attempt < 3)
          throw Object.assign(new Error("SERIALIZATION_INJECTED"), { code: "40001" });
      },
    }).execute(projectorRequest("S6_JR", retryFixture));
    expect(result).toMatchObject({ replayed: false, attemptCount: 3 });
    const retried = await pool.query<{ operations: string; results: string; audits: string }>(
      `SELECT
        (SELECT count(*) FROM ${retrySchema}.m02_system_identity_operations)::text AS operations,
        (SELECT count(*) FROM ${retrySchema}.m02_system_identity_results)::text AS results,
        (SELECT count(*) FROM ${retrySchema}.m02_audit_events
          WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS audits`,
    );
    expect(retried.rows[0]).toEqual({ operations: "1", results: "1", audits: "14" });
    systemExecutedReceipts.record("F42", "lifecycle.rollback", {
      rolledBack: rolledBack.rows[0],
      retry: {
        attemptCount: result.attemptCount,
        replayed: result.replayed,
        persisted: retried.rows[0],
      },
    });
  }, 60_000);

  it.each([
    {
      change: "positive version",
      expectedCode: "STALE_RECORD_VERSION",
      schema: "m02_system_40001_positive",
    },
    {
      change: "null guard classification",
      expectedCode: "EXPECTED_VERSION_SET_INVALID",
      schema: "m02_system_40001_null",
    },
  ] as const)(
    "restarts the full outer cycle after 40001 and rejects a durable $change change before attempt two",
    async ({ change, expectedCode, schema }) => {
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(
        pool,
        schema,
        change === "positive version" ? "S6_JR" : "S1_R1_JC",
      );
      let transactionAttempts = 0;
      const repositoryGuard = canonicalGuard("SOURCE_REPOSITORY", {
        repositoryRef: { provider: "github", providerRepositoryId: "system-repo" },
      });
      await expect(
        new PostgresSystemIdentityAdapter(pool, {
          schema,
          onTransactionAttempt: async (attempt) => {
            transactionAttempts += 1;
            if (attempt !== 1) return;
            const competitor = await pool.connect();
            try {
              await competitor.query(`SET search_path TO ${schema}, public`);
              if (change === "positive version")
                await competitor.query(
                  "UPDATE acquisition_jobs SET record_version=record_version+1 WHERE id=$1",
                  [fixture.jobId],
                );
              else
                await competitor.query("DELETE FROM m02_concurrency_guards WHERE guard_key=$1", [
                  repositoryGuard.key,
                ]);
            } finally {
              competitor.release();
            }
            throw Object.assign(new Error("SERIALIZATION_INJECTED"), { code: "40001" });
          },
        }).execute(projectorRequest("S6_JR", fixture)),
      ).rejects.toMatchObject({
        code: expectedCode,
        phase: "POST_PROJECTOR_PRE_ALLOCATION",
      });
      expect(transactionAttempts).toBe(1);
      const direct = await pool.query<{
        operations: string;
        phase: string;
        error_code: string;
        attempted_system_operation_id: string | null;
      }>(
        `SELECT
          (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
          phase,error_code,attempted_system_operation_id
         FROM ${schema}.m02_rejected_system_identity_audits`,
      );
      expect(direct.rows).toEqual([
        {
          operations: "0",
          phase: "POST_PROJECTOR_PRE_ALLOCATION",
          error_code: expectedCode,
          attempted_system_operation_id: null,
        },
      ]);
    },
    60_000,
  );

  it("freezes the complete ID-bound plan before transaction and keeps concurrency bytes ID-independent", async () => {
    type PlanFreezeProbe = Readonly<{
      concurrencyPlanFingerprint: string;
      mutationPlanFingerprint: string;
      systemOperationId: string;
    }>;
    const observations: {
      allocatedIds: string[];
      events: string[];
      issuedIds: string[];
      operationFingerprint: string;
      probe: PlanFreezeProbe | undefined;
      persistedPlanFingerprint: string;
    }[] = [];
    for (const [sequence, schema] of [
      [1, "m02_system_plan_ids_a"],
      [2, "m02_system_plan_ids_b"],
    ] as const) {
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
      const events: string[] = [];
      const issuedIds: string[] = [];
      let nextId = 1;
      let operationFingerprint = "";
      let probe: PlanFreezeProbe | undefined;
      const options: PostgresSystemIdentityOptions & {
        readonly idAllocator: () => string;
        readonly onPlanFrozen: (value: PlanFreezeProbe) => void;
      } = {
        schema,
        idAllocator: () => {
          const id = `00000000-0000-700${String(sequence)}-8000-${String(nextId).padStart(12, "0")}`;
          nextId += 1;
          issuedIds.push(id);
          return id;
        },
        onFrozen: (value) => {
          events.push("request");
          operationFingerprint = value.systemOperationFingerprint;
        },
        onPlanFrozen: (value) => {
          events.push("plan");
          probe = value;
        },
        onTransactionAttempt: () => {
          events.push("transaction");
        },
      };
      await new PostgresSystemIdentityAdapter(pool, options).execute(
        projectorRequest("S6_JR", fixture),
      );
      const persisted = await pool.query<{
        mutation_plan_fingerprint: string;
        mutation_plan_payload: Buffer;
      }>(
        `SELECT mutation_plan_fingerprint,mutation_plan_payload
         FROM ${schema}.m02_system_identity_results`,
      );
      const persistedRow = persisted.rows[0];
      if (persistedRow === undefined) throw new Error("SYSTEM_PLAN_ID_RESULT_MISSING");
      const persistedPlan = JSON.parse(persistedRow.mutation_plan_payload.toString("utf8")) as {
        domainMutationPlan: {
          allocatedIds: string[];
          creates: { primaryKey: string }[];
          audits: { id: string }[];
        };
      };
      observations.push({
        allocatedIds: persistedPlan.domainMutationPlan.allocatedIds,
        events,
        issuedIds,
        operationFingerprint,
        probe,
        persistedPlanFingerprint: persistedRow.mutation_plan_fingerprint,
      });
      expect(issuedIds).toHaveLength(
        2 +
          persistedPlan.domainMutationPlan.creates.length +
          persistedPlan.domainMutationPlan.audits.length,
      );
      expect([...issuedIds].sort()).toEqual(
        [...persistedPlan.domainMutationPlan.allocatedIds].sort(),
      );
      expect(new Set(issuedIds).size).toBe(issuedIds.length);
    }
    expect(observations[0]?.events).toEqual(["request", "plan", "transaction"]);
    expect(observations[1]?.events).toEqual(["request", "plan", "transaction"]);
    expect(observations[0]?.probe?.concurrencyPlanFingerprint).toBe(
      observations[1]?.probe?.concurrencyPlanFingerprint,
    );
    expect(observations[0]?.operationFingerprint).toBe(observations[1]?.operationFingerprint);
    expect(observations[0]?.probe?.systemOperationId).not.toBe(
      observations[1]?.probe?.systemOperationId,
    );
    expect(observations[0]?.probe?.mutationPlanFingerprint).not.toBe(
      observations[1]?.probe?.mutationPlanFingerprint,
    );
    expect(observations[0]?.persistedPlanFingerprint).toBe(
      observations[0]?.probe?.mutationPlanFingerprint,
    );
    expect(observations[1]?.persistedPlanFingerprint).toBe(
      observations[1]?.probe?.mutationPlanFingerprint,
    );
  }, 60_000);

  it("retains and relationally validates every typed write and audit in the complete plan", async () => {
    const schema = "m02_system_complete_typed_plan";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S2_JC");
    const result = await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S2_JC", fixture),
    );
    const retained = await pool.query<{
      mutation_plan_payload: Buffer;
      audit_ids: string[];
    }>(
      `SELECT result.mutation_plan_payload,
        ARRAY(SELECT audit.id FROM ${schema}.m02_audit_events audit
          WHERE audit.system_operation_id=result.system_operation_id
          ORDER BY convert_to(audit.id,'UTF8')) AS audit_ids
       FROM ${schema}.m02_system_identity_results result WHERE result.id=$1`,
      [result.id],
    );
    const row = retained.rows[0];
    if (row === undefined) throw new Error("COMPLETE_TYPED_PLAN_MISSING");
    const plan = JSON.parse(row.mutation_plan_payload.toString("utf8")) as {
      schemaVersion: string;
      concurrencyPlan: Record<string, unknown>;
      domainMutationPlan: {
        schemaVersion: string;
        operation: { id: string; values: Record<string, unknown> };
        result: { id: string; values: Record<string, unknown> };
        allocatedIds: string[];
        creates: { tableName: string; primaryKey: string; values: Record<string, unknown> }[];
        updates: {
          tableName: string;
          primaryKey: string;
          beforeValues: Record<string, unknown>;
          afterValues: Record<string, unknown>;
        }[];
        supersedes: {
          tableName: string;
          primaryKey: string;
          beforeValues: Record<string, unknown>;
          afterValues: Record<string, unknown>;
        }[];
        audits: {
          id: string;
          action: string;
          subjectType: string;
          subjectId: string;
          metadata: Record<string, unknown>;
          originType: string;
          systemOperationId: string;
          systemResultId: string;
        }[];
        postconditions: Record<string, unknown>;
      };
    };
    const domain = plan.domainMutationPlan;
    expect(Object.keys(domain).sort()).toEqual([
      "allocatedIds",
      "audits",
      "creates",
      "operation",
      "postconditions",
      "result",
      "schemaVersion",
      "supersedes",
      "updates",
    ]);
    expect(domain.operation.id).toBe(result.systemOperationId);
    expect(domain.result.id).toBe(result.id);
    expect(domain.creates.map((entry) => entry.tableName)).toEqual(
      expect.arrayContaining([
        "identity_decisions",
        "identity_decision_tier_evaluations",
        "identity_decision_signals",
        "identity_decision_signal_evidence",
        "resource_version_identities",
        "resource_source_links",
        "resource_version_observations",
        "m02_identity_handoff_markers",
      ]),
    );
    expect(domain.supersedes.map((entry) => entry.tableName)).toContain("resource_source_links");
    expect(domain.updates.map((entry) => entry.tableName).sort()).toEqual([
      "acquisition_jobs",
      "m02_jobs",
      "m02_review_states",
      "resource_candidates",
    ]);
    expect(domain.audits.map((audit) => audit.id).sort()).toEqual([...row.audit_ids].sort());
    const plannedIds = new Set(domain.allocatedIds);
    expect(plannedIds.has(domain.operation.id)).toBe(true);
    expect(plannedIds.has(domain.result.id)).toBe(true);
    for (const entry of domain.creates) expect(plannedIds.has(entry.primaryKey)).toBe(true);
    for (const audit of domain.audits) expect(plannedIds.has(audit.id)).toBe(true);

    const validates = async (candidate: unknown): Promise<boolean> => {
      const payload = Buffer.from(canonicalJson(candidate as never), "utf8");
      const validation = await pool.query<{ valid: boolean }>(
        `SELECT ${schema}.m02_system_mutation_plan_payload_matches($1,$2) AS valid`,
        [result.id, payload],
      );
      return validation.rows[0]?.valid ?? false;
    };
    const relationallyValidates = async (candidate: unknown): Promise<boolean> => {
      const validation = await pool.query<{ valid: boolean }>(
        `SELECT ${schema}.m02_system_mutation_plan_body_matches($1,$2::jsonb) AS valid`,
        [result.id, JSON.stringify(candidate)],
      );
      return validation.rows[0]?.valid ?? false;
    };
    expect(await validates(plan)).toBe(true);
    expect(await relationallyValidates(plan)).toBe(true);

    const retainedPayloadDrift = structuredClone(plan);
    retainedPayloadDrift.domainMutationPlan.schemaVersion = "2";
    expect(await validates(retainedPayloadDrift)).toBe(false);

    const auditIdDrift = structuredClone(plan);
    const firstAudit = auditIdDrift.domainMutationPlan.audits[0];
    if (firstAudit === undefined) throw new Error("AUDIT_PLAN_MISSING");
    firstAudit.id = "00000000-0000-7000-8000-000000009001";
    expect(await relationallyValidates(auditIdDrift)).toBe(false);

    const auditOriginDrift = structuredClone(plan);
    const originAudit = auditOriginDrift.domainMutationPlan.audits[0];
    if (originAudit === undefined) throw new Error("AUDIT_ORIGIN_PLAN_MISSING");
    originAudit.originType = "HUMAN_COMMAND";
    expect(await relationallyValidates(auditOriginDrift)).toBe(false);

    const auditOperationDrift = structuredClone(plan);
    const operationAudit = auditOperationDrift.domainMutationPlan.audits[0];
    if (operationAudit === undefined) throw new Error("AUDIT_OPERATION_PLAN_MISSING");
    operationAudit.systemOperationId = "00000000-0000-7000-8000-000000009003";
    expect(await relationallyValidates(auditOperationDrift)).toBe(false);

    const auditResultDrift = structuredClone(plan);
    const resultAudit = auditResultDrift.domainMutationPlan.audits[0];
    if (resultAudit === undefined) throw new Error("AUDIT_RESULT_PLAN_MISSING");
    resultAudit.systemResultId = "00000000-0000-7000-8000-000000009004";
    expect(await relationallyValidates(auditResultDrift)).toBe(false);

    const typedFkDrift = structuredClone(plan);
    const decisionCreate = typedFkDrift.domainMutationPlan.creates.find(
      (entry) => entry.tableName === "identity_decisions",
    );
    if (decisionCreate === undefined) throw new Error("DECISION_CREATE_PLAN_MISSING");
    decisionCreate.values.resource_candidate_id = "00000000-0000-7000-8000-000000009002";
    expect(await relationallyValidates(typedFkDrift)).toBe(false);

    const missingTypedFk = structuredClone(plan);
    const missingDecisionCreate = missingTypedFk.domainMutationPlan.creates.find(
      (entry) => entry.tableName === "identity_decisions",
    );
    if (missingDecisionCreate === undefined) throw new Error("DECISION_CREATE_PLAN_MISSING");
    delete missingDecisionCreate.values.resource_candidate_id;
    expect(await relationallyValidates(missingTypedFk)).toBe(false);

    const beforeStateDrift = structuredClone(plan);
    const beforeCandidateUpdate = beforeStateDrift.domainMutationPlan.updates.find(
      (entry) => entry.tableName === "resource_candidates",
    );
    if (beforeCandidateUpdate === undefined) throw new Error("CANDIDATE_BEFORE_PLAN_MISSING");
    beforeCandidateUpdate.beforeValues.status = "IDENTITY_REVIEW_REQUIRED";
    expect(await relationallyValidates(beforeStateDrift)).toBe(false);

    const rowValueDrift = structuredClone(plan);
    const candidateUpdate = rowValueDrift.domainMutationPlan.updates.find(
      (entry) => entry.tableName === "resource_candidates",
    );
    if (candidateUpdate === undefined) throw new Error("CANDIDATE_UPDATE_PLAN_MISSING");
    candidateUpdate.afterValues.status = "CLASSIFIED";
    expect(await relationallyValidates(rowValueDrift)).toBe(false);

    const metadataDrift = structuredClone(plan);
    const jobAudit = metadataDrift.domainMutationPlan.audits.find(
      (audit) => audit.subjectType === "M02_JOB",
    );
    if (jobAudit === undefined) throw new Error("JOB_AUDIT_PLAN_MISSING");
    jobAudit.metadata = { drifted: true };
    expect(await relationallyValidates(metadataDrift)).toBe(false);
  }, 60_000);

  it("rejects full under-lock mutation-plan drift before expectation recheck", async () => {
    const schema = "m02_system_locked_plan_drift";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    await expect(
      new PostgresSystemIdentityAdapter(pool, {
        schema,
        onTransactionAttempt: async (_attempt, client) => {
          await client.query(
            "UPDATE resource_candidates SET record_version=record_version+1 WHERE id=$1",
            [fixture.candidateId],
          );
        },
      }).execute(projectorRequest("S6_JR", fixture)),
    ).rejects.toMatchObject({ code: "MUTATION_PLAN_CHANGED", phase: "TRANSACTION_ATTEMPT" });
    const direct = await pool.query<{
      candidate_version: string;
      operations: string;
      error_code: string;
    }>(
      `SELECT candidate.record_version::text AS candidate_version,
        (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
        rejection.error_code
       FROM ${schema}.resource_candidates candidate
       JOIN ${schema}.m02_rejected_system_identity_audits rejection
         ON rejection.candidate_id=candidate.id
       WHERE candidate.id=$1`,
      [fixture.candidateId],
    );
    expect(direct.rows).toEqual([
      { candidate_version: "1", operations: "0", error_code: "MUTATION_PLAN_CHANGED" },
    ]);
  }, 60_000);

  it("uses the shared human/system V2 guard namespace and preserves both origins", async () => {
    const schema = "m02_system_origin_guard";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S6_JR");
    await new PostgresSystemIdentityAdapter(pool, { schema }).execute(
      projectorRequest("S6_JR", fixture),
    );
    const shared = canonicalGuard("JOB_SCOPE_CONTROLLER", {
      jobLineageId: "lineage-system",
      operationScope: "IDENTITY_RESOLUTION",
    });
    const direct = await pool.query<{
      guard_key: string;
      payload: string;
      human_decisions: string;
      system_decisions: string;
    }>(
      `SELECT guard.guard_key,convert_from(guard.canonical_payload,'UTF8') AS payload,
        (SELECT count(*) FROM ${schema}.identity_decisions WHERE origin_type='HUMAN_COMMAND')::text AS human_decisions,
        (SELECT count(*) FROM ${schema}.identity_decisions WHERE origin_type='SYSTEM_IDENTITY_OPERATION')::text AS system_decisions
       FROM ${schema}.m02_concurrency_guards guard WHERE guard.guard_key=$1`,
      [shared.key],
    );
    expect(direct.rows[0]).toMatchObject({
      guard_key: shared.key,
      payload: Buffer.from(shared.canonicalPayload).toString("utf8"),
      human_decisions: "1",
      system_decisions: "1",
    });
  }, 60_000);

  it("lets a canonical human command win after system freeze without mixed-origin writes", async () => {
    const schema = "m02_system_human_winner";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R1_JC");
    let releaseFrozen!: () => void;
    let observeFrozen!: () => void;
    const frozen = new Promise<void>((resolve) => {
      observeFrozen = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseFrozen = resolve;
    });
    const systemAttempt = new PostgresSystemIdentityAdapter(pool, {
      schema,
      onFrozen: async () => {
        observeFrozen();
        await release;
      },
    }).execute(projectorRequest("S1_R1_JC", fixture));
    await frozen;
    const group = await pool.query<{ group_id: string }>(
      `SELECT root.group_id FROM ${schema}.candidate_roots root WHERE root.id=$1`,
      [fixture.rootId],
    );
    const provisional: ManualResolutionEnvelope = {
      commandId: "00000000-0000-7000-8000-000000004070",
      requestId: "00000000-0000-7000-8000-000000004071",
      idempotencyKey: "system-human-winner",
      actorId: "m02-human-winner",
      actorRole: "ADMIN",
      command: "CREATE_RESOURCE",
      targetCandidateId: fixture.candidateId,
      targetGroupId: group.rows[0]?.group_id ?? "",
      expectedVersions: {},
      reasonCode: "REVIEWED_DECISION",
      reason: "Human review resolves the candidate before the frozen resolver.",
      evidenceIds: [fixture.evidenceId],
      decisionIds: [],
      timestamp: "2026-08-22T00:00:00.000Z",
      payload: {
        auditId: "00000000-0000-7000-8000-000000004072",
        candidateRootId: fixture.rootId,
        classificationRunId: fixture.runId,
        contentFingerprint: HASH_A,
        decisionId: "00000000-0000-7000-8000-000000004073",
        jobId: fixture.jobId,
        normalizedRoot: ".",
        observationId: "00000000-0000-7000-8000-000000004074",
        provider: "github",
        providerRepositoryId: "system-repo",
        reliableIdentityToken: "system-skill",
        reliableTokenEvidenceId: fixture.evidenceId,
        resourceIdentityId: "00000000-0000-7000-8000-000000004075",
        resourceVersionIdentityId: "00000000-0000-7000-8000-000000004076",
        reviewId: fixture.reviewId,
        sourceLinkId: "00000000-0000-7000-8000-000000004077",
        sourceSnapshotId: fixture.snapshotId,
      },
    };
    const humanAdapter = new PostgresManualResolutionAdapter(pool, { schema });
    const humanRequest: ManualResolutionEnvelope = {
      ...provisional,
      expectedVersions: {
        ...(await humanAdapter.discoverRequiredCurrentExpectations(provisional)),
      },
    };
    await humanAdapter.execute(humanRequest);
    releaseFrozen();
    await expect(systemAttempt).rejects.toMatchObject({
      code: "EXPECTED_VERSION_SET_INVALID",
      phase: "POST_PROJECTOR_PRE_ALLOCATION",
    });
    const origins = await pool.query<{ origin_type: string; count: string }>(
      `SELECT origin_type,count(*)::text AS count FROM ${schema}.identity_decisions
       WHERE resource_candidate_id=$1 GROUP BY origin_type ORDER BY origin_type`,
      [fixture.candidateId],
    );
    expect(origins.rows).toEqual([{ origin_type: "HUMAN_COMMAND", count: "1" }]);
  }, 60_000);

  it("freezes the complete sibling aggregate and rejects a changed sibling review version", async () => {
    const schema = "m02_system_sibling_freeze";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JR");
    const siblingCandidateId = fixture.siblingCandidateId;
    if (siblingCandidateId === null) throw new Error("SIBLING_FIXTURE_MISSING");
    const siblingReview = await pool.query<{ id: string }>(
      `SELECT id FROM ${schema}.m02_review_states WHERE resource_candidate_id=$1`,
      [siblingCandidateId],
    );
    const siblingReviewId = siblingReview.rows[0]?.id;
    if (siblingReviewId === undefined) throw new Error("SIBLING_REVIEW_FIXTURE_MISSING");
    await expect(
      new PostgresSystemIdentityAdapter(pool, {
        schema,
        onFrozen: async () => {
          await pool.query(
            `UPDATE ${schema}.m02_review_states
             SET record_version=record_version+1 WHERE id=$1`,
            [siblingReviewId],
          );
        },
      }).execute(projectorRequest("S1_R0_JR", fixture)),
    ).rejects.toMatchObject({
      code: "STALE_RECORD_VERSION",
      phase: "POST_PROJECTOR_PRE_ALLOCATION",
    });
    const rejection = await pool.query<{
      existing_targets: { targetType: string; targetValue: string }[];
    }>(`SELECT existing_targets FROM ${schema}.m02_rejected_system_identity_audits`);
    expect(rejection.rows[0]?.existing_targets).toContainEqual({
      targetType: "REVIEW_STATE",
      targetValue: siblingReviewId,
    });
  }, 60_000);

  it("rejects an under-lock server-discovery change as MUTATION_PLAN_CHANGED and rolls it back", async () => {
    const schema = "m02_system_locked_mode_drift";
    await createSchema(schema);
    const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
    await expect(
      new PostgresSystemIdentityAdapter(pool, {
        schema,
        onTransactionAttempt: async (_attempt, client) => {
          await client.query("SET LOCAL session_replication_role = 'replica'");
          await client.query(
            `UPDATE acquisition_results
             SET result=jsonb_set(result,'{identityDiscovery,reliableIdentityTokenOrNull}','null')
             WHERE job_id=$1`,
            [fixture.jobId],
          );
          await client.query("SET LOCAL session_replication_role = 'origin'");
        },
      }).execute(projectorRequest("S1_R0_JC", fixture)),
    ).rejects.toMatchObject({
      code: "MUTATION_PLAN_CHANGED",
      phase: "TRANSACTION_ATTEMPT",
    });
    const durable = await pool.query<{ token: string; operations: string; rejections: string }>(
      `SELECT result #>> '{identityDiscovery,reliableIdentityTokenOrNull}' AS token,
        (SELECT count(*) FROM ${schema}.m02_system_identity_operations)::text AS operations,
        (SELECT count(*) FROM ${schema}.m02_rejected_system_identity_audits)::text AS rejections
       FROM ${schema}.acquisition_results WHERE job_id=$1`,
      [fixture.jobId],
    );
    expect(durable.rows[0]).toEqual({ token: "system-skill", operations: "0", rejections: "1" });
  }, 60_000);

  it("classifies real two-session 23505 collisions by the conflicting canonical guard bytes", async () => {
    const retrySchema = "m02_system_unique_retry";
    await createSchema(retrySchema);
    const retryFixture = await seedM02SystemIdentityGraph(pool, retrySchema, "S6_JR");
    const collidingGuard = canonicalGuard("JOB_SCOPE_CONTROLLER", {
      jobLineageId: "lineage-system",
      operationScope: "IDENTITY_RESOLUTION",
    });
    const competitor = await pool.connect();
    let notifyAttempt!: () => void;
    const attemptStarted = new Promise<void>((resolve) => {
      notifyAttempt = resolve;
    });
    try {
      await competitor.query("BEGIN");
      await competitor.query(`SET LOCAL search_path TO ${retrySchema}, public`);
      await competitor.query(
        `INSERT INTO m02_concurrency_guards
           (guard_key,guard_type,canonical_payload,payload_hash,record_version)
         VALUES ($1,$2,$3,$4,1)`,
        [
          collidingGuard.key,
          collidingGuard.guardType,
          Buffer.from(collidingGuard.canonicalPayload),
          collidingGuard.payloadHash,
        ],
      );
      const contender = new PostgresSystemIdentityAdapter(pool, {
        schema: retrySchema,
        onTransactionAttempt: (attempt) => {
          if (attempt === 1) notifyAttempt();
        },
      }).execute(projectorRequest("S6_JR", retryFixture));
      await attemptStarted;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      await competitor.query("COMMIT");
      await expect(contender).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
        phase: "TRANSACTION_ATTEMPT",
      });
    } finally {
      await competitor.query("ROLLBACK").catch(() => undefined);
      competitor.release();
    }

    const collisionSchema = "m02_system_unique_collision";
    await createSchema(collisionSchema);
    const collisionFixture = await seedM02SystemIdentityGraph(pool, collisionSchema, "S6_JR");
    const unrelatedGuard = canonicalGuard("HANDOFF", { candidateId: "unrelated-candidate" });
    await pool.query(
      `INSERT INTO ${collisionSchema}.m02_concurrency_guards
         (guard_key,guard_type,canonical_payload,payload_hash,record_version)
       VALUES ($1,$2,$3,$4,1)`,
      [
        unrelatedGuard.key,
        unrelatedGuard.guardType,
        Buffer.from(unrelatedGuard.canonicalPayload),
        unrelatedGuard.payloadHash,
      ],
    );
    await expect(
      new PostgresSystemIdentityAdapter(pool, {
        schema: collisionSchema,
        onTransactionAttempt: async (_attempt, client) => {
          await client.query(
            `INSERT INTO m02_concurrency_guards
               (guard_key,guard_type,canonical_payload,payload_hash,record_version)
             VALUES ($1,$2,$3,$4,1)`,
            [
              unrelatedGuard.key,
              unrelatedGuard.guardType,
              Buffer.from(unrelatedGuard.canonicalPayload),
              unrelatedGuard.payloadHash,
            ],
          );
        },
      }).execute(projectorRequest("S6_JR", collisionFixture)),
    ).rejects.toMatchObject({ code: "MUTATION_PLAN_CHANGED", phase: "TRANSACTION_ATTEMPT" });
  }, 60_000);

  it.each([
    ["cancelled", "CANCELLED"],
    ["superseded", "JOB_SUPERSEDED"],
  ] as const)(
    "checks the %s controller state before full discovery",
    async (variant, expectedCode) => {
      const schema = `m02_system_pre_${variant}`;
      await createSchema(schema);
      const fixture = await seedM02SystemIdentityGraph(pool, schema, "S1_R0_JC");
      await pool.query(`SET session_replication_role = 'replica'`);
      try {
        await pool.query(
          `UPDATE ${schema}.resource_candidates
           SET classification_policy_version='discovery-is-invalid' WHERE id=$1`,
          [fixture.candidateId],
        );
        if (variant === "cancelled")
          await pool.query(
            `UPDATE ${schema}.acquisition_jobs
             SET cancellation_requested=true,record_version=record_version+1 WHERE id=$1`,
            [fixture.jobId],
          );
        else
          await pool.query(
            `UPDATE ${schema}.m02_jobs
             SET supersession_state='SUPERSEDED',record_version=record_version+1 WHERE id=$1`,
            [fixture.jobId],
          );
      } finally {
        await pool.query(`SET session_replication_role = 'origin'`);
      }
      await expect(
        new PostgresSystemIdentityAdapter(pool, { schema }).execute(
          projectorRequest("S1_R0_JC", fixture),
        ),
      ).rejects.toMatchObject({ code: expectedCode, phase: "PRE_PROJECTOR" });
      const rejection = await pool.query<{
        phase: string;
        error_code: string;
        automatic_projector_mode_id: string | null;
      }>(
        `SELECT phase,error_code,automatic_projector_mode_id
         FROM ${schema}.m02_rejected_system_identity_audits`,
      );
      expect(rejection.rows).toEqual([
        { phase: "PRE_PROJECTOR", error_code: expectedCode, automatic_projector_mode_id: null },
      ]);
    },
    60_000,
  );

  it("retains exact PRE, POST, and TRANSACTION rejected-system audits without accepted writes", async () => {
    const cases = [
      {
        schema: "m02_system_reject_pre",
        phase: "PRE_PROJECTOR",
        code: "CANCELLED",
        prepare: async (fixture: Awaited<ReturnType<typeof seedM02SystemIdentityGraph>>) => {
          await pool.query(
            `UPDATE m02_system_reject_pre.acquisition_jobs
             SET cancellation_requested=true,record_version=record_version+1 WHERE id=$1`,
            [fixture.jobId],
          );
          return {};
        },
      },
      {
        schema: "m02_system_reject_post",
        phase: "POST_PROJECTOR_PRE_ALLOCATION",
        code: "STALE_RECORD_VERSION",
        prepare: (fixture: Awaited<ReturnType<typeof seedM02SystemIdentityGraph>>) => ({
          onFrozen: async () => {
            await pool.query(
              `UPDATE m02_system_reject_post.acquisition_jobs
               SET record_version=record_version+1 WHERE id=$1`,
              [fixture.jobId],
            );
          },
        }),
      },
      {
        schema: "m02_system_reject_transaction",
        phase: "TRANSACTION_ATTEMPT",
        code: "SERIALIZATION_RETRY_EXHAUSTED",
        prepare: () => ({
          onTransactionAttempt: () => {
            throw Object.assign(new Error("SERIALIZATION_INJECTED"), { code: "40001" });
          },
        }),
      },
    ] as const;
    const rejectionReceipts: Record<string, unknown>[] = [];
    for (const testCase of cases) {
      await createSchema(testCase.schema);
      const fixture = await seedM02SystemIdentityGraph(pool, testCase.schema, "S6_JR");
      const options = await testCase.prepare(fixture);
      await expect(
        new PostgresSystemIdentityAdapter(pool, { schema: testCase.schema, ...options }).execute(
          projectorRequest("S6_JR", fixture),
        ),
      ).rejects.toMatchObject({ code: testCase.code, phase: testCase.phase });
      const direct = await pool.query<{ phase: string; error_code: string; operations: string }>(
        `SELECT rejection.phase,rejection.error_code,
          (SELECT count(*) FROM ${testCase.schema}.m02_system_identity_operations)::text AS operations
         FROM ${testCase.schema}.m02_rejected_system_identity_audits rejection`,
      );
      expect(direct.rows).toEqual([
        { phase: testCase.phase, error_code: testCase.code, operations: "0" },
      ]);
      rejectionReceipts.push(direct.rows[0] ?? {});
    }
    expect(rejectionReceipts).toHaveLength(cases.length);
    systemExecutedReceipts.record("F42", "lifecycle.rejections", rejectionReceipts);
  }, 60_000);
});
