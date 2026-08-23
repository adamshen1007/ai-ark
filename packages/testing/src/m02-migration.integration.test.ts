import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { canonicalJson, type JsonValue } from "@ai-ark/contracts";
import { PostgresSystemIdentityAdapter } from "@ai-ark/job-queue";

import { EphemeralPostgresHarness } from "./postgres-harness.js";
import { seedM02ProductionGraph, seedM02SystemIdentityGraph } from "./m02-postgres-fixture.js";

const migration001Url = new URL(
  "../../job-queue/migrations/001_m01_acquisition_jobs.sql",
  import.meta.url,
);
const migration002Url = new URL(
  "../../job-queue/migrations/002_m02_classification_identity.sql",
  import.meta.url,
);

const harness = new EphemeralPostgresHarness();
let postgresPool: Pool;
let migration001 = "";
let migration002 = "";

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const canonicalPayload = (value: JsonValue) => Buffer.from(canonicalJson(value), "utf8");
const guardKey = (guardType: string, payload: Buffer) =>
  `guard:${guardType}:${createHash("sha256").update(payload).digest("base64url")}`;

async function withSchema(
  name: string,
  execute: (client: PoolClient, pool: Pool) => Promise<void>,
) {
  const client = await postgresPool.connect();
  try {
    await client.query(`CREATE SCHEMA ${name}`);
    await client.query(`SET search_path TO ${name}, public`);
    await execute(client, postgresPool);
  } finally {
    client.release();
  }
}

async function insertHumanSubjectAudit(
  client: PoolClient,
  input: {
    id: string;
    subjectType: string;
    subjectId: string;
    afterState?: JsonValue;
  },
) {
  await client.query(
    `INSERT INTO m02_audit_events
       (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
        subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
        reason_code, reason_text, after_version, after_state, occurred_at)
     VALUES ($1, 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'HUMAN', 'actor_seed',
       'EDITOR', 'SUBJECT_CREATED', $2, $3, 'request_seed', 'M02', 'seed',
       'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical migration fixture seed',
       $4, $5, now())`,
    [
      input.id,
      input.subjectType,
      input.subjectId,
      input.afterState === undefined ? null : 1,
      input.afterState === undefined ? null : canonicalJson(input.afterState),
    ],
  );
}

describe("M02 PostgreSQL migration integration", () => {
  beforeAll(async () => {
    [migration001, migration002] = await Promise.all([
      readFile(migration001Url, "utf8"),
      readFile(migration002Url, "utf8"),
    ]);
    postgresPool = await harness.start();
    await postgresPool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public");
  }, 120_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("accepts a canonical P5 POSSIBLE_DUPLICATE decision and normalized child projection", async () => {
    await withSchema("m02_p5_decision_semantics", async (client, pool) => {
      await client.query(migration001);
      await client.query(migration002);
      await seedM02ProductionGraph(pool, "m02_p5_decision_semantics");
      const fixture = await seedM02SystemIdentityGraph(
        pool,
        "m02_p5_decision_semantics",
        "S5_R0_JC",
      );
      await client.query("SET session_replication_role = 'replica'");
      try {
        await client.query(
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
      } finally {
        await client.query("SET session_replication_role = 'origin'");
      }
      await new PostgresSystemIdentityAdapter(pool, {
        schema: "m02_p5_decision_semantics",
      }).execute({
        schemaVersion: "1",
        sourceSnapshotId: fixture.snapshotId,
        candidateId: fixture.candidateId,
        controllingJobId: fixture.jobId,
        reconciledClassificationRunId: fixture.runId,
        classificationPolicyVersion: "classification-v1",
        identityPolicyVersion: "identity-v1",
      });
      const decision = await client.query<{
        outcome: string;
        matched_tier: string;
        signals: string;
      }>(
        `SELECT decision.outcome,decision.matched_tier,count(signal.id)::text AS signals
         FROM identity_decisions decision
         JOIN identity_decision_signals signal ON signal.identity_decision_id=decision.id
         WHERE decision.origin_type='SYSTEM_IDENTITY_OPERATION'
         GROUP BY decision.id`,
      );
      expect(decision.rows).toEqual([
        { outcome: "POSSIBLE_DUPLICATE", matched_tier: "P5", signals: "2" },
      ]);
    });
  }, 120_000);

  it("enforces the closed rejected-command audit identity and existing target contract", async () => {
    await withSchema("m02_rejected_command_contract", async (client, pool) => {
      await client.query(migration001);
      await client.query(migration002);
      await seedM02ProductionGraph(pool, "m02_rejected_command_contract");
      await client.query(
        `INSERT INTO m02_rejected_command_audits
           (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
            actor_id,actor_role,error_code,target_candidate_id,target_group_id,review_id,job_id,created_at)
         VALUES ('command-rejected','request-rejected','M02','rejected-key',$1,
           'admin-1','ADMIN','REFERENCE_INVALID','candidate-1','group-1','review-1','job-1',now())`,
        ["a".repeat(64)],
      );
      await expect(
        client.query(
          `INSERT INTO m02_rejected_command_audits
             (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
              actor_id,actor_role,error_code,created_at)
           VALUES ('command-duplicate','request-duplicate','M02','rejected-key',$1,
             'admin-1','ADMIN','REFERENCE_INVALID',now())`,
          ["a".repeat(64)],
        ),
      ).rejects.toThrow(/unique/iu);
      await expect(
        client.query(
          `INSERT INTO m02_rejected_command_audits
             (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
              actor_id,actor_role,error_code,created_at)
           VALUES ('command-role','request-role','M02','role-key',$1,
             'actor-1','SYSTEM','REFERENCE_INVALID',now())`,
          ["b".repeat(64)],
        ),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query(
          `INSERT INTO m02_rejected_command_audits
             (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
              actor_id,actor_role,error_code,created_at)
           VALUES ('command-code','request-code','M02','code-key',$1,
             'admin-1','ADMIN','NOT_CLOSED',now())`,
          ["c".repeat(64)],
        ),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query(
          `INSERT INTO m02_rejected_command_audits
             (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
              actor_id,actor_role,error_code,target_candidate_id,created_at)
           VALUES ('command-target','request-target','M02','target-key',$1,
             'admin-1','ADMIN','REFERENCE_INVALID','candidate-missing',now())`,
          ["d".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);
    });
  }, 120_000);

  it("requires active handoffs to match candidate identity while preserving superseded history", async () => {
    await withSchema("m02_handoff_candidate_progression", async (client, pool) => {
      await client.query(migration001);
      await client.query(migration002);
      await seedM02ProductionGraph(pool, "m02_handoff_candidate_progression");
      await client.query("SET session_replication_role = 'replica'");
      await client.query(
        `UPDATE resource_candidates
         SET status='IDENTITY_RESOLVED',identity_outcome='EXACT_REPEAT_REUSE',
             resource_identity_id='resource-existing',resource_version_identity_id='version-prior'
         WHERE id='candidate-1';
         UPDATE identity_decisions SET outcome='EXACT_REPEAT_REUSE' WHERE id='decision-seed';
         INSERT INTO m02_identity_handoff_markers
           (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
            controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
            command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,
            created_at,record_version)
         VALUES ('handoff-progression','candidate-1','resource-existing','version-prior','job-1',
           'snapshot-1','decision-seed','HUMAN_COMMAND','command-seed','result-seed',
           'audit-command-seed','candidate:candidate-1','CONTROLLING','ACTIVE',now(),1)`,
      );
      await client.query("SET session_replication_role = 'origin'");

      await client.query("BEGIN");
      await client.query(
        `UPDATE resource_candidates
         SET resource_version_identity_id='version-target',record_version=record_version+1
         WHERE id='candidate-1'`,
      );
      await expect(
        client.query(
          "SET CONSTRAINTS active_handoff_candidate_identity_tuple_from_candidate IMMEDIATE",
        ),
      ).rejects.toThrow(/ACTIVE_HANDOFF_CANDIDATE_IDENTITY_TUPLE_MISMATCH/iu);
      await client.query("ROLLBACK");

      await client.query("BEGIN");
      await client.query(
        `UPDATE m02_identity_handoff_markers
         SET state='SUPERSEDED',controlling_job_state=NULL,record_version=record_version+1
         WHERE id='handoff-progression';
         UPDATE resource_candidates
         SET resource_version_identity_id='version-target',record_version=record_version+1
         WHERE id='candidate-1'`,
      );
      await client.query(
        `SET CONSTRAINTS active_handoff_candidate_identity_tuple_from_handoff,
          active_handoff_candidate_identity_tuple_from_candidate IMMEDIATE`,
      );
      expect(
        (
          await client.query<{ state: string; resource_version_identity_id: string }>(
            `SELECT handoff.state,candidate.resource_version_identity_id
             FROM m02_identity_handoff_markers handoff
             JOIN resource_candidates candidate ON candidate.id=handoff.resource_candidate_id
             WHERE handoff.id='handoff-progression'`,
          )
        ).rows[0],
      ).toEqual({ state: "SUPERSEDED", resource_version_identity_id: "version-target" });
      await client.query("ROLLBACK");
    });
  }, 120_000);

  it("applies from zero after 001 and enforces restrictive evidence foreign keys", async () => {
    await withSchema("m02_zero", async (client) => {
      await client.query(migration001);
      await client.query(migration002);
      const tables = await client.query<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()",
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual(
        expect.arrayContaining([
          "repository_classification_runs",
          "resource_version_identities",
          "m02_job_supersessions",
          "m02_concurrency_guards",
        ]),
      );
      await expect(
        client.query(
          "INSERT INTO repository_candidate_groups (id, source_snapshot_id, classification_policy_version, group_key, group_fingerprint, classification, identity_policy_version, parser_profile_version, analysis_policy_version, prompt_bundle_version, state, created_at) VALUES ('group_missing', 'snapshot_missing', 'classification-v1', 'key', $1, 'NON_SKILL', 'identity-v1', 'parser-v1', 'analysis-v1', 'prompt-v1', 'ACTIVE', now())",
          ["a".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);
    });
  }, 120_000);

  it("applies over populated M01 and preserves history while enforcing guards and lineage", async () => {
    await withSchema("m02_from_m01", async (client, pool) => {
      await client.query(migration001);
      await client.query(
        "INSERT INTO source_snapshots (id, identity_key, provider, provider_repository_id, immutable_revision, acquisition_policy_version, acquired_at) VALUES ('snapshot_1', 'github:42:rev', 'github', '42', $1, 'm01-v1', now()), ('snapshot_2', 'github:42:rev2', 'github', '42', $2, 'm01-v1', now())",
        ["a".repeat(40), "b".repeat(40)],
      );
      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_a', 'submission_1', 'request_1', 'FAILED', 'INVENTORYING_SOURCE', 1, 'snapshot_1'), ('job_b', 'submission_1', 'request_2', 'ACTIVE', 'RECEIVED', 1, 'snapshot_1')",
      );
      await client.query(
        "INSERT INTO acquisition_results (job_id, source_snapshot_id, result, created_at) VALUES ('job_a', 'snapshot_1', $1::jsonb, now())",
        [
          JSON.stringify({
            entries: [
              {
                id: "entry_1",
                originalPath: "SKILL.md",
                normalizedPath: "SKILL.md",
                entryType: "file",
                byteLength: 42,
                disposition: "ACQUIRED",
                sha256: "7".repeat(64),
                reasonCodes: [],
              },
            ],
            documents: [
              {
                id: "document_1",
                sourceEntryId: "entry_1",
                encoding: "utf-8",
                lineCount: 3,
                contentHash: "8".repeat(64),
              },
            ],
          }),
        ],
      );
      await client.query(migration002);

      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_snapshot_mismatch', 'lineage_mismatch', 'request_snapshot_mismatch', 'FAILED', 'INVENTORYING_SOURCE', 1, 'snapshot_1')",
      );
      await expect(
        client.query(
          "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_snapshot_mismatch', 'lineage_mismatch', 'snapshot_2', 'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 1, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
          ["a".repeat(64), "b".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);

      expect(
        (
          await client.query<{ status: string }>(
            "SELECT status FROM acquisition_jobs WHERE id = 'job_a'",
          )
        ).rows[0]?.status,
      ).toBe("FAILED");
      expect(
        (
          await client.query<{ count: string }>(
            "SELECT count(*) FROM m01_source_entries WHERE source_snapshot_id = 'snapshot_1'",
          )
        ).rows[0]?.count,
      ).toBe("1");

      await client.query(
        "INSERT INTO repository_candidate_groups (id, source_snapshot_id, classification_policy_version, group_key, group_fingerprint, classification, identity_policy_version, parser_profile_version, analysis_policy_version, prompt_bundle_version, state, created_at) VALUES ('group_1', 'snapshot_1', 'classification-v1', 'group-key-1', $1, 'MULTIPLE_SKILLS', 'identity-v1', 'parser-profile-v1', 'analysis-v1', 'prompt-v1', 'ACTIVE', now())",
        ["9".repeat(64)],
      );
      await client.query(
        "INSERT INTO repository_classification_runs (id, group_id, source_snapshot_id, run_source, classification, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version, parser_profile_version, methodology_version, input_fingerprint, output_fingerprint, created_at) VALUES ('run_1', 'group_1', 'snapshot_1', 'DETERMINISTIC', 'MULTIPLE_SKILLS', 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1', 'parser-profile-v1', 'classification-v1', $1, $2, now())",
        ["7".repeat(64), "8".repeat(64)],
      );
      await client.query(
        "INSERT INTO candidate_roots (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path, candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload, canonical_content_payload, root_idempotency_key, state) VALUES ('root_1', 'group_1', 'run_1', 'snapshot_1', 'skills/one', $1, $2, decode('01', 'hex'), decode('02', 'hex'), 'root-key-1', 'ACTIVE')",
        ["1".repeat(64), "2".repeat(64)],
      );
      await client.query(
        "INSERT INTO repository_candidate_groups (id, source_snapshot_id, classification_policy_version, group_key, group_fingerprint, classification, identity_policy_version, parser_profile_version, analysis_policy_version, prompt_bundle_version, state, created_at) VALUES ('group_2', 'snapshot_2', 'classification-v1', 'group-key-2', $1, 'SINGLE_SKILL', 'identity-v1', 'parser-profile-v1', 'analysis-v1', 'prompt-v1', 'ACTIVE', now())",
        ["6".repeat(64)],
      );
      await client.query(
        "INSERT INTO repository_classification_runs (id, group_id, source_snapshot_id, run_source, classification, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version, parser_profile_version, methodology_version, input_fingerprint, output_fingerprint, created_at) VALUES ('run_2', 'group_2', 'snapshot_2', 'DETERMINISTIC', 'SINGLE_SKILL', 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1', 'parser-profile-v1', 'classification-v1', $1, $2, now())",
        ["5".repeat(64), "6".repeat(64)],
      );
      await expect(
        client.query(
          "INSERT INTO candidate_roots (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path, candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload, canonical_content_payload, root_idempotency_key, state) VALUES ('root_cross_group', 'group_1', 'run_2', 'snapshot_2', 'skills/cross', $1, $2, decode('03', 'hex'), decode('04', 'hex'), 'root-key-cross', 'ACTIVE')",
          ["3".repeat(64), "4".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);
      await client.query(
        "INSERT INTO candidate_roots (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path, candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload, canonical_content_payload, root_idempotency_key, state) VALUES ('root_2', 'group_2', 'run_2', 'snapshot_2', 'skills/two', $1, $2, decode('03', 'hex'), decode('04', 'hex'), 'root-key-2', 'ACTIVE')",
        ["3".repeat(64), "4".repeat(64)],
      );
      await expect(
        client.query(
          "INSERT INTO resource_candidates (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint, candidate_content_fingerprint, reconciled_classification_run_id, classification_policy_version, identity_policy_version, ordered_provenance, candidate_idempotency_key, status, created_at, updated_at) VALUES ('candidate_cross_snapshot', 'snapshot_1', 'root_2', $1, $2, 'run_2', 'classification-v1', 'identity-v1', '[]'::jsonb, 'candidate-key-cross', 'CLASSIFIED', now(), now())",
          ["3".repeat(64), "4".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);
      await expect(
        client.query(
          "INSERT INTO resource_candidates (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint, candidate_content_fingerprint, reconciled_classification_run_id, classification_policy_version, identity_policy_version, ordered_provenance, candidate_idempotency_key, status, created_at, updated_at) VALUES ('candidate_fingerprint_mismatch', 'snapshot_1', 'root_1', $1, $2, 'run_1', 'classification-v1', 'identity-v1', '[]'::jsonb, 'candidate-key-mismatch', 'CLASSIFIED', now(), now())",
          ["f".repeat(64), "e".repeat(64)],
        ),
      ).rejects.toThrow(/foreign key/iu);
      await client.query(
        "INSERT INTO resource_candidates (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint, candidate_content_fingerprint, reconciled_classification_run_id, classification_policy_version, identity_policy_version, ordered_provenance, candidate_idempotency_key, status, created_at, updated_at) VALUES ('candidate_1', 'snapshot_1', 'root_1', $1, $2, 'run_1', 'classification-v1', 'identity-v1', '[]'::jsonb, 'candidate-key-1', 'CLASSIFIED', now(), now())",
        ["1".repeat(64), "2".repeat(64)],
      );
      await client.query(
        "INSERT INTO repository_group_relationships (id, parent_group_id, child_candidate_id, relationship_type, relationship_order) VALUES ('group_edge_1', 'group_1', 'candidate_1', 'INCLUDES', 0)",
      );
      expect(
        (
          await client.query<{ relationship_order: number }>(
            "SELECT relationship_order FROM repository_group_relationships WHERE id = 'group_edge_1'",
          )
        ).rows[0]?.relationship_order,
      ).toBe(0);
      await expect(
        client.query(
          "INSERT INTO repository_group_relationships (id, parent_group_id, child_candidate_id, relationship_type, relationship_order) VALUES ('group_edge_invalid', 'group_1', 'candidate_missing', 'INCLUDES', 0)",
        ),
      ).rejects.toThrow(/foreign key/iu);

      await client.query(
        "INSERT INTO resource_candidates (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint, candidate_content_fingerprint, reconciled_classification_run_id, classification_policy_version, identity_policy_version, ordered_provenance, candidate_idempotency_key, status, created_at, updated_at) VALUES ('candidate_2', 'snapshot_2', 'root_2', $1, $2, 'run_2', 'classification-v1', 'identity-v1', '[]'::jsonb, 'candidate-key-2', 'CLASSIFIED', now(), now())",
        ["3".repeat(64), "4".repeat(64)],
      );
      await client.query(
        `INSERT INTO resource_candidates
           (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
            candidate_content_fingerprint, reconciled_classification_run_id,
            classification_policy_version, identity_policy_version, ordered_provenance,
            candidate_idempotency_key, status, created_at, updated_at)
         VALUES ('candidate_topology_old', 'snapshot_1', 'root_1', $1, $2, 'run_1',
           'classification-v1', 'identity-v1', '[]', 'candidate-key-topology-old',
           'CLASSIFIED', now(), now())`,
        ["1".repeat(64), "2".repeat(64)],
      );

      const seedExpectedVersions = canonicalPayload({});
      const seedRequestPayload = canonicalPayload({
        commandType: "RESOLVE_AMBIGUITY",
        schemaVersion: "1",
        targetCandidateId: "candidate_1",
      });
      const schemaExpectedVersions = canonicalPayload({});
      const schemaRequestPayload = canonicalPayload({
        commandType: "RESOLVE_AMBIGUITY",
        schemaVersion: "1",
        targetCandidateId: "candidate_1",
      });
      await client.query(
        `INSERT INTO manual_resolution_commands
           (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
            actor_role, expected_versions, caller_expected_versions_payload, request_fingerprint,
            result_fingerprint, reason_code, reason, request_payload, created_at)
         VALUES ('command_seed', 'request_seed', 'RESOLVE_AMBIGUITY', 'M02', 'seed',
           'actor_seed', 'EDITOR', '{}'::jsonb, $1, $2, $3,
           'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical migration fixture seed', $4, now())`,
        [seedExpectedVersions, sha256(seedRequestPayload), "f".repeat(64), seedRequestPayload],
      );
      await client.query(
        `INSERT INTO m02_manual_command_results
           (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
            result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
         VALUES ('result_seed', 'command_seed', 'request_seed', $1, $2, $3,
           '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, now())`,
        [sha256(seedRequestPayload), "e".repeat(64), "f".repeat(64)],
      );
      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
            subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
            reason_code, reason_text, occurred_at)
         VALUES ('audit_seed_accept', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'HUMAN',
           'actor_seed', 'EDITOR', 'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND',
           'command_seed', 'request_seed', 'M02', 'seed', 'IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical migration fixture seed', now())`,
      );

      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
            action, subject_type, subject_id, request_id, idempotency_scope,
            idempotency_key, reason_code, reason_text, metadata, occurred_at)
         VALUES ('audit_root_retained', 'HUMAN_COMMAND', 'command_seed', 'result_seed',
           'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_CREATED', 'ROOT_REPLACEMENT',
           'root_retained', 'request_seed', 'M02', 'seed', 'IDENTITY_AMBIGUITY_RESOLVED',
           'Canonical migration fixture seed',
           '{"predecessorRootId":"root_1","replacementKind":"RETAINED","successorRootId":"root_2"}',
           now())`,
      );
      await client.query(
        `INSERT INTO m02_root_replacements
           (id, predecessor_root_id, successor_root_id, replacement_kind, command_id,
            result_id, audit_event_id, predecessor_ordinal, successor_ordinal, reason, created_at)
         VALUES ('root_retained', 'root_1', 'root_2', 'RETAINED', 'command_seed',
           'result_seed', 'audit_root_retained', 0, 0, 'Retain canonical root lineage', now())`,
      );

      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, metadata, occurred_at)
           VALUES ('audit_root_reassigned_bad', 'HUMAN_COMMAND', 'command_seed',
             'result_seed', 'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_CREATED',
             'ROOT_REPLACEMENT', 'root_reassigned_bad', 'request_seed', 'M02', 'seed',
             'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical migration fixture seed',
             '{"predecessorRootId":"root_1","replacementKind":"REASSIGNED","successorRootId":"root_2"}',
             now())`,
        );
        await client.query(
          `INSERT INTO m02_root_replacements
             (id, predecessor_root_id, successor_root_id, replacement_kind, command_id,
              result_id, audit_event_id, predecessor_ordinal, successor_ordinal, reason, created_at)
           VALUES ('root_reassigned_bad', 'root_2', 'root_1', 'REASSIGNED',
             'command_seed', 'result_seed', 'audit_root_reassigned_bad', 0, 0,
             'Reject audit endpoint drift', now())`,
        );
        await expect(
          client.query("SET CONSTRAINTS m02_root_replacements_audit_guard IMMEDIATE"),
        ).rejects.toThrow(/M02_REPLACEMENT_MAPPING_AUDIT_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const incompleteWriterRequest = canonicalPayload({
        commandType: "CREATE_RESOURCE",
        schemaVersion: "1",
        targetCandidateId: "candidate_1",
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_incomplete_writer', 'request_incomplete_writer', 'CREATE_RESOURCE',
             'M02', 'incomplete-writer', 'actor_seed', 'EDITOR', '{}', $1, $2, $3,
             'IDENTITY_AMBIGUITY_RESOLVED', 'Reject incomplete identity result',
             'candidate_1', $4, now())`,
          [
            canonicalPayload({}),
            sha256(incompleteWriterRequest),
            "4".repeat(64),
            incompleteWriterRequest,
          ],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
           VALUES ('result_incomplete_writer', 'command_incomplete_writer',
             'request_incomplete_writer', $1, $2, $3, '[]', '{}', '{}', now())`,
          [sha256(incompleteWriterRequest), "5".repeat(64), "4".repeat(64)],
        );
        await expect(
          client.query(
            "SET CONSTRAINTS m02_manual_command_results_identity_projection_guard IMMEDIATE",
          ),
        ).rejects.toThrow(/M02_HUMAN_IDENTITY_RESULT_REQUIRED/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const topologyTierMetadata = canonicalJson({
        evaluatedTierSequence: ["P1", "P2", "P3", "P4", "P5", "P6"].map((tier) => ({
          evaluationDisposition: "NO_MATCH",
          tier,
        })),
      });
      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
            action, subject_type, subject_id, request_id, idempotency_scope,
            idempotency_key, reason_code, reason_text, after_version, after_state,
            metadata, occurred_at)
         VALUES ('audit_topology_seed_decision', 'HUMAN_COMMAND', 'command_seed',
           'result_seed', 'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_CREATED',
           'IDENTITY_DECISION', 'decision_topology_seed', 'request_seed', 'M02', 'seed',
           'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical migration fixture seed', 1,
           '{"recordVersion":1,"state":"ACTIVE"}', $1::jsonb, now())`,
        [topologyTierMetadata],
      );
      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
            action, subject_type, subject_id, request_id, idempotency_scope,
            idempotency_key, reason_code, reason_text, before_version, after_version,
            before_state, after_state, occurred_at)
         VALUES ('audit_topology_seed_candidate', 'HUMAN_COMMAND', 'command_seed',
           'result_seed', 'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_UPDATED',
           'RESOURCE_CANDIDATE', 'candidate_topology_old', 'request_seed', 'M02', 'seed',
           'IDENTITY_AMBIGUITY_RESOLVED', 'Canonical migration fixture seed', 1, 2,
           '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
           '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}', now())`,
      );
      await client.query(
        `INSERT INTO identity_decisions
           (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
            signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
            created_at, origin_type, command_id, result_id, audit_event_id)
         VALUES ('decision_topology_seed', 'candidate_topology_old', 'AMBIGUOUS_IDENTITY',
           'identity-v1', 'HUMAN_COMMAND', '[]', '[]', '[]', $1, 'ACTIVE', now(),
           'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_topology_seed_decision')`,
        ["0".repeat(64)],
      );
      await client.query(
        `UPDATE resource_candidates SET status = 'IDENTITY_REVIEW_REQUIRED',
           identity_outcome = 'AMBIGUOUS_IDENTITY', record_version = 2, updated_at = now()
         WHERE id = 'candidate_topology_old'`,
      );

      await insertHumanSubjectAudit(client, {
        id: "audit_resource_1",
        subjectType: "RESOURCE_IDENTITY",
        subjectId: "resource_1",
        afterState: { recordVersion: 1, status: "ACTIVE" },
      });

      await client.query(
        "INSERT INTO resource_identities (id, status, created_at, guard_anchor_candidate_id, origin_type, command_id, result_id, audit_event_id) VALUES ('resource_1', 'ACTIVE', now(), 'candidate_1', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_resource_1')",
      );
      await insertHumanSubjectAudit(client, {
        id: "audit_resource_2",
        subjectType: "RESOURCE_IDENTITY",
        subjectId: "resource_2",
        afterState: { recordVersion: 1, status: "ACTIVE" },
      });
      await client.query(
        "INSERT INTO resource_identities (id, status, created_at, guard_anchor_candidate_id, origin_type, command_id, result_id, audit_event_id) VALUES ('resource_2', 'ACTIVE', now(), 'candidate_1', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_resource_2')",
      );
      await expect(
        client.query(
          "UPDATE resource_identities SET guard_anchor_candidate_id = 'candidate_2', record_version = record_version + 1 WHERE id = 'resource_2'",
        ),
      ).rejects.toThrow(/M02_GUARD_ANCHOR_IMMUTABLE/iu);
      await insertHumanSubjectAudit(client, {
        id: "audit_version_1",
        subjectType: "RESOURCE_VERSION_IDENTITY",
        subjectId: "version_1",
        afterState: { recordVersion: 1, status: "IDENTITY_RESOLVED" },
      });
      await insertHumanSubjectAudit(client, {
        id: "audit_version_2",
        subjectType: "RESOURCE_VERSION_IDENTITY",
        subjectId: "version_2",
        afterState: { recordVersion: 1, status: "IDENTITY_RESOLVED" },
      });
      await client.query(
        "INSERT INTO resource_version_identities (id, resource_identity_id, content_fingerprint, canonical_payload, first_observed_source_snapshot_id, first_observed_candidate_root_id, first_observed_source_revision, observation_label, status, created_at, origin_type, command_id, result_id, audit_event_id) VALUES ('version_1', 'resource_1', $1, decode('01', 'hex'), 'snapshot_1', 'root_1', $2, 'snapshot:aaaaaaaaaaaa', 'IDENTITY_RESOLVED', now(), 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_version_1'), ('version_2', 'resource_2', $3, decode('02', 'hex'), 'snapshot_1', 'root_1', $2, 'snapshot:aaaaaaaaaaaa', 'IDENTITY_RESOLVED', now(), 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_version_2')",
        ["a".repeat(64), "a".repeat(40), "b".repeat(64)],
      );

      const invalidReuseRequest = canonicalPayload({
        attachmentMode: "A2",
        commandType: "ATTACH_NEW_VERSION",
        schemaVersion: "1",
        targetCandidateId: "candidate_2",
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_invalid_reuse', 'request_invalid_reuse', 'ATTACH_NEW_VERSION',
             'M02', 'invalid-reuse', 'actor_seed', 'EDITOR', '{}', $1, $2, $3,
             'IDENTITY_AMBIGUITY_RESOLVED', 'Reject a non-existent reused typed row',
             'candidate_2', $4, now())`,
          [canonicalPayload({}), sha256(invalidReuseRequest), "6".repeat(64), invalidReuseRequest],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload,
              identity_projection_mode_id, identity_outcome, resource_identity_id,
              resource_version_identity_id, reused_resource_identity_ids,
              reused_resource_version_identity_ids, created_at)
           VALUES ('result_invalid_reuse', 'command_invalid_reuse', 'request_invalid_reuse',
             $1, $2, $3, '[]', '{}', '{}', 'ATTACH_NEW_VERSION_A2',
             'EXACT_REPEAT_REUSE', 'resource_1', 'version_1', ARRAY['resource_missing'],
             ARRAY['version_1'], now())`,
          [sha256(invalidReuseRequest), "7".repeat(64), "6".repeat(64)],
        );
        await expect(
          client.query(
            "SET CONSTRAINTS m02_manual_command_results_identity_projection_guard IMMEDIATE",
          ),
        ).rejects.toThrow(/M02_HUMAN_IDENTITY_REUSED_SET_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const invalidCreatedRequest = canonicalPayload({
        commandType: "CREATE_RESOURCE",
        schemaVersion: "1",
        targetCandidateId: "candidate_2",
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_invalid_created', 'request_invalid_created', 'CREATE_RESOURCE',
             'M02', 'invalid-created', 'actor_seed', 'EDITOR', '{}', $1, $2, $3,
             'IDENTITY_AMBIGUITY_RESOLVED', 'Reject false created-row provenance',
             'candidate_2', $4, now())`,
          [
            canonicalPayload({}),
            sha256(invalidCreatedRequest),
            "8".repeat(64),
            invalidCreatedRequest,
          ],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload,
              identity_projection_mode_id, identity_outcome, resource_identity_id,
              resource_version_identity_id, created_resource_identity_ids,
              created_resource_version_identity_ids, created_at)
           VALUES ('result_invalid_created', 'command_invalid_created',
             'request_invalid_created', $1, $2, $3, '[]', '{}', '{}', 'CREATE_RESOURCE',
             'NEW_RESOURCE', 'resource_1', 'version_1', ARRAY['resource_1'],
             ARRAY['version_1'], now())`,
          [sha256(invalidCreatedRequest), "9".repeat(64), "8".repeat(64)],
        );
        await expect(
          client.query(
            "SET CONSTRAINTS m02_manual_command_results_identity_projection_guard IMMEDIATE",
          ),
        ).rejects.toThrow(/M02_HUMAN_IDENTITY_CREATED_SET_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }
      const exactRepeatRequest = canonicalPayload({
        attachmentMode: "A2",
        commandType: "ATTACH_NEW_VERSION",
        schemaVersion: "1",
        targetCandidateId: "candidate_2",
      });
      const humanTierMetadata = canonicalJson({
        evaluatedTierSequence: ["P1", "P2", "P3", "P4", "P5", "P6"].map((tier) => ({
          evaluationDisposition: "NO_MATCH",
          tier,
        })),
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_exact_repeat', 'request_exact_repeat', 'ATTACH_NEW_VERSION',
             'M02', 'exact-repeat', 'actor_seed', 'EDITOR', '{}'::jsonb, $1, $2, $3,
             'IDENTITY_AMBIGUITY_RESOLVED', 'Attach byte-identical existing version',
             'candidate_2', $4, now())`,
          [canonicalPayload({}), sha256(exactRepeatRequest), "1".repeat(64), exactRepeatRequest],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload,
              identity_projection_mode_id, identity_outcome, resource_identity_id,
              resource_version_identity_id, reused_resource_identity_ids,
              reused_resource_version_identity_ids, created_at)
           VALUES ('result_exact_repeat', 'command_exact_repeat', 'request_exact_repeat',
             $1, $2, $3, '[]', '{}', '{}', 'ATTACH_NEW_VERSION_A2',
             'EXACT_REPEAT_REUSE', 'resource_1', 'version_1', ARRAY['resource_1'],
             ARRAY['version_1'], now())`,
          [sha256(exactRepeatRequest), "2".repeat(64), "1".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, occurred_at)
           VALUES ('audit_exact_repeat_accept', 'HUMAN_COMMAND', 'command_exact_repeat',
             'result_exact_repeat', 'HUMAN', 'actor_seed', 'EDITOR', 'COMMAND_ACCEPTED',
             'MANUAL_RESOLUTION_COMMAND', 'command_exact_repeat', 'request_exact_repeat',
             'M02', 'exact-repeat', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Attach byte-identical existing version', now())`,
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, after_version, after_state,
              metadata, occurred_at)
           VALUES ('audit_exact_repeat_decision', 'HUMAN_COMMAND', 'command_exact_repeat',
             'result_exact_repeat', 'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_CREATED',
             'IDENTITY_DECISION', 'decision_exact_repeat', 'request_exact_repeat', 'M02',
             'exact-repeat', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Attach byte-identical existing version', 1,
             '{"recordVersion":1,"state":"ACTIVE"}', $1::jsonb, now())`,
          [humanTierMetadata],
        );
        await client.query(
          `INSERT INTO identity_decisions
             (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
              signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
              created_at, origin_type, command_id, result_id, audit_event_id)
           VALUES ('decision_exact_repeat', 'candidate_2', 'EXACT_REPEAT_REUSE', 'identity-v1',
             'HUMAN_COMMAND', '[]', '[]', '[]', $1, 'ACTIVE', now(), 'HUMAN_COMMAND',
             'command_exact_repeat', 'result_exact_repeat', 'audit_exact_repeat_decision')`,
          ["3".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, occurred_at)
           VALUES ('audit_exact_repeat_candidate', 'HUMAN_COMMAND', 'command_exact_repeat',
             'result_exact_repeat', 'HUMAN', 'actor_seed', 'EDITOR', 'SUBJECT_UPDATED',
             'RESOURCE_CANDIDATE', 'candidate_2', 'request_exact_repeat', 'M02',
             'exact-repeat', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Attach byte-identical existing version', 1, 2,
             '{"identityOutcome":null,"recordVersion":1,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"CLASSIFIED"}',
             '{"identityOutcome":"EXACT_REPEAT_REUSE","recordVersion":2,"resourceIdentityId":"resource_1","resourceVersionIdentityId":"version_1","status":"IDENTITY_RESOLVED"}', now())`,
        );
        await client.query(
          `UPDATE resource_candidates
           SET status = 'IDENTITY_RESOLVED', identity_outcome = 'EXACT_REPEAT_REUSE',
             resource_identity_id = 'resource_1', resource_version_identity_id = 'version_1',
             record_version = 2, updated_at = now()
           WHERE id = 'candidate_2'`,
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      await client.query("BEGIN");
      try {
        await client.query(
          `UPDATE resource_candidates SET identity_outcome = 'EXISTING_RESOURCE_NEW_VERSION',
             record_version = record_version + 1, updated_at = now()
           WHERE id = 'candidate_2'`,
        );
        await expect(
          client.query("SET CONSTRAINTS resource_candidates_identity_projection_guard IMMEDIATE"),
        ).rejects.toThrow(/M02_HUMAN_IDENTITY_RESULT_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const correctionRequest = canonicalPayload({
        attachmentMode: "A3",
        commandType: "ATTACH_NEW_VERSION",
        schemaVersion: "1",
        targetCandidateId: "candidate_2",
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_exact_repeat_correction', 'request_exact_repeat_correction',
             'ATTACH_NEW_VERSION', 'M02', 'exact-repeat-correction', 'actor_seed', 'EDITOR',
             '{}', $1, $2, $3, 'IDENTITY_AMBIGUITY_RESOLVED',
             'Correct the controlling human Decision without changing I/V',
             'candidate_2', $4, now())`,
          [canonicalPayload({}), sha256(correctionRequest), "c".repeat(64), correctionRequest],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload,
              identity_projection_mode_id, identity_outcome, resource_identity_id,
              resource_version_identity_id, reused_resource_identity_ids,
              reused_resource_version_identity_ids, created_at)
           VALUES ('result_exact_repeat_correction', 'command_exact_repeat_correction',
             'request_exact_repeat_correction', $1, $2, $3, '["candidate_2"]', '{}', '{}',
             'ATTACH_NEW_VERSION_A3', 'EXACT_REPEAT_REUSE', 'resource_1', 'version_1',
             ARRAY['resource_1'], ARRAY['version_1'], now())`,
          [sha256(correctionRequest), "d".repeat(64), "c".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, occurred_at)
           VALUES ('audit_exact_repeat_correction_accept', 'HUMAN_COMMAND',
             'command_exact_repeat_correction', 'result_exact_repeat_correction', 'HUMAN',
             'actor_seed', 'EDITOR', 'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND',
             'command_exact_repeat_correction', 'request_exact_repeat_correction', 'M02',
             'exact-repeat-correction', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Correct the controlling human Decision without changing I/V', now())`,
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, metadata, occurred_at)
           VALUES ('audit_exact_repeat_decision_superseded', 'HUMAN_COMMAND',
             'command_exact_repeat_correction', 'result_exact_repeat_correction', 'HUMAN',
             'actor_seed', 'EDITOR', 'SUBJECT_SUPERSEDED', 'IDENTITY_DECISION',
             'decision_exact_repeat', 'request_exact_repeat_correction', 'M02',
             'exact-repeat-correction', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Correct the controlling human Decision without changing I/V', 1, 2,
             '{"recordVersion":1,"state":"ACTIVE"}',
             '{"recordVersion":2,"state":"SUPERSEDED","supersededByDecisionId":"decision_exact_repeat_correction"}',
             $1::jsonb, now())`,
          [humanTierMetadata],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, after_version, after_state,
              metadata, occurred_at)
           VALUES ('audit_exact_repeat_correction_decision', 'HUMAN_COMMAND',
             'command_exact_repeat_correction', 'result_exact_repeat_correction', 'HUMAN',
             'actor_seed', 'EDITOR', 'SUBJECT_CREATED', 'IDENTITY_DECISION',
             'decision_exact_repeat_correction', 'request_exact_repeat_correction', 'M02',
             'exact-repeat-correction', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Correct the controlling human Decision without changing I/V', 1,
             '{"recordVersion":1,"state":"ACTIVE"}', $1::jsonb, now())`,
          [humanTierMetadata],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, occurred_at)
           VALUES ('audit_exact_repeat_correction_candidate', 'HUMAN_COMMAND',
             'command_exact_repeat_correction', 'result_exact_repeat_correction', 'HUMAN',
             'actor_seed', 'EDITOR', 'SUBJECT_UPDATED', 'RESOURCE_CANDIDATE',
             'candidate_2', 'request_exact_repeat_correction', 'M02',
             'exact-repeat-correction', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Correct the controlling human Decision without changing I/V', 2, 3,
             '{"identityOutcome":"EXACT_REPEAT_REUSE","recordVersion":2,"resourceIdentityId":"resource_1","resourceVersionIdentityId":"version_1","status":"IDENTITY_RESOLVED"}',
             '{"identityOutcome":"EXACT_REPEAT_REUSE","recordVersion":3,"resourceIdentityId":"resource_1","resourceVersionIdentityId":"version_1","status":"IDENTITY_RESOLVED"}', now())`,
        );
        await client.query(
          `UPDATE identity_decisions SET state = 'SUPERSEDED', record_version = 2,
             superseded_by_decision_id = 'decision_exact_repeat_correction',
             replacement_command_id = 'command_exact_repeat_correction',
             replacement_result_id = 'result_exact_repeat_correction',
             replacement_audit_event_id = 'audit_exact_repeat_decision_superseded'
           WHERE id = 'decision_exact_repeat'`,
        );
        await client.query(
          `INSERT INTO identity_decisions
             (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
              signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
              supersedes_decision_id, created_at, origin_type, command_id, result_id,
              audit_event_id)
           VALUES ('decision_exact_repeat_correction', 'candidate_2', 'EXACT_REPEAT_REUSE',
             'identity-v1', 'HUMAN_COMMAND', '[]', '[]', '[]', $1, 'ACTIVE',
             'decision_exact_repeat', now(), 'HUMAN_COMMAND',
             'command_exact_repeat_correction', 'result_exact_repeat_correction',
             'audit_exact_repeat_correction_decision')`,
          ["e".repeat(64)],
        );
        await client.query(
          `UPDATE resource_candidates SET record_version = 3, updated_at = now()
           WHERE id = 'candidate_2'`,
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      await client.query("BEGIN");
      try {
        await client.query(
          `UPDATE resource_candidates SET resource_identity_id = 'resource_2',
             resource_version_identity_id = 'version_2',
             record_version = 4, updated_at = now() WHERE id = 'candidate_2'`,
        );
        await expect(
          client.query("SET CONSTRAINTS resource_candidates_identity_projection_guard IMMEDIATE"),
        ).rejects.toThrow(/M02_HUMAN_IDENTITY_RESULT_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }
      const topologyRequest = canonicalPayload({
        commandType: "SPLIT_ROOTS",
        schemaVersion: "1",
        targetCandidateId: "candidate_topology_old",
      });
      const executeTopologySupersession = async (
        candidateBeforeState: string,
        candidateAfterState: string,
        createdCandidateAfterState: string,
        options: {
          extraCreatedAudit?: boolean;
          preseedSuccessor?: boolean;
          predecessorAuditEventId?: string;
          successorAuditEventId?: string;
        } = {},
      ) => {
        await client.query("BEGIN");
        try {
          if (options.preseedSuccessor === true) {
            await client.query(
              `INSERT INTO resource_candidates
                 (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
                  candidate_content_fingerprint, reconciled_classification_run_id,
                  classification_policy_version, identity_policy_version, ordered_provenance,
                  candidate_idempotency_key, status, created_at, updated_at)
               VALUES ('candidate_topology_new', 'snapshot_2', 'root_2', $1, $2, 'run_2',
                 'classification-v1', 'identity-v1', '[]', 'candidate-key-topology-new',
                 'IDENTITY_REVIEW_REQUIRED', now(), now())`,
              ["3".repeat(64), "4".repeat(64)],
            );
          }
          await client.query(
            `INSERT INTO manual_resolution_commands
               (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
                actor_role, expected_versions, caller_expected_versions_payload,
                request_fingerprint, result_fingerprint, reason_code, reason,
                target_candidate_id, request_payload, created_at)
             VALUES ('command_topology_terminal', 'request_topology_terminal', 'SPLIT_ROOTS',
               'M02', 'topology-terminal', 'actor_seed', 'ADMIN', '{}', $1, $2, $3,
               'IDENTITY_AMBIGUITY_RESOLVED', 'Split an unresolved predecessor candidate',
               'candidate_topology_old', $4, now())`,
            [canonicalPayload({}), sha256(topologyRequest), "1".repeat(64), topologyRequest],
          );
          await client.query(
            `INSERT INTO m02_manual_command_results
               (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
                result_fingerprint, ordered_target_ids, record_versions, result_payload,
                created_at)
             VALUES ('result_topology_terminal', 'command_topology_terminal',
               'request_topology_terminal', $1, $2, $3,
               '["candidate_topology_old","candidate_topology_new"]', '{}', '{}', now())`,
            [sha256(topologyRequest), "2".repeat(64), "1".repeat(64)],
          );
          await client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, occurred_at)
             VALUES ('audit_topology_terminal_accept', 'HUMAN_COMMAND',
               'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
               'ADMIN', 'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND',
               'command_topology_terminal', 'request_topology_terminal', 'M02',
               'topology-terminal', 'IDENTITY_AMBIGUITY_RESOLVED',
               'Split an unresolved predecessor candidate', now())`,
          );
          await client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, before_version, after_version,
                before_state, after_state, metadata, occurred_at)
             VALUES ('audit_topology_terminal_decision', 'HUMAN_COMMAND',
               'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
               'ADMIN', 'SUBJECT_SUPERSEDED', 'IDENTITY_DECISION',
               'decision_topology_seed', 'request_topology_terminal', 'M02',
               'topology-terminal', 'IDENTITY_AMBIGUITY_RESOLVED',
               'Split an unresolved predecessor candidate', 1, 2,
               '{"recordVersion":1,"state":"ACTIVE"}',
               '{"recordVersion":2,"state":"SUPERSEDED"}', $1::jsonb, now())`,
            [topologyTierMetadata],
          );
          await client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, before_version, after_version,
                before_state, after_state, metadata, occurred_at)
             VALUES ('audit_topology_terminal_candidate', 'HUMAN_COMMAND',
               'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
               'ADMIN', 'SUBJECT_SUPERSEDED', 'RESOURCE_CANDIDATE',
               'candidate_topology_old', 'request_topology_terminal', 'M02',
               'topology-terminal', 'IDENTITY_AMBIGUITY_RESOLVED',
               'Split an unresolved predecessor candidate', 2, 3, $1, $2,
               '{"successorId":"candidate_topology_new"}', now())`,
            [candidateBeforeState, candidateAfterState],
          );
          if (options.preseedSuccessor !== true) {
            await client.query(
              `INSERT INTO m02_audit_events
               (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, after_version, after_state,
                occurred_at)
             VALUES ('audit_topology_terminal_candidate_created', 'HUMAN_COMMAND',
               'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
               'ADMIN', 'SUBJECT_CREATED', 'RESOURCE_CANDIDATE', 'candidate_topology_new',
               'request_topology_terminal', 'M02', 'topology-terminal',
               'IDENTITY_AMBIGUITY_RESOLVED', 'Split an unresolved predecessor candidate',
               1, $1, now())`,
              [createdCandidateAfterState],
            );
          }
          if (options.extraCreatedAudit === true) {
            await client.query(
              `INSERT INTO m02_audit_events
                 (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                  action, subject_type, subject_id, request_id, idempotency_scope,
                  idempotency_key, reason_code, reason_text, after_version, after_state,
                  occurred_at)
               VALUES ('audit_topology_terminal_candidate_extra', 'HUMAN_COMMAND',
                 'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
                 'ADMIN', 'SUBJECT_CREATED', 'RESOURCE_CANDIDATE', 'candidate_topology_new',
                 'request_topology_terminal', 'M02', 'topology-terminal',
                 'IDENTITY_AMBIGUITY_RESOLVED', 'Split an unresolved predecessor candidate',
                 1, $1, now())`,
              [createdCandidateAfterState],
            );
          }
          await client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, metadata, occurred_at)
             VALUES ('audit_topology_terminal_mapping', 'HUMAN_COMMAND',
               'command_topology_terminal', 'result_topology_terminal', 'HUMAN', 'actor_seed',
               'ADMIN', 'SUBJECT_CREATED', 'CANDIDATE_REPLACEMENT',
               'mapping_topology_terminal', 'request_topology_terminal', 'M02',
               'topology-terminal', 'IDENTITY_AMBIGUITY_RESOLVED',
               'Split an unresolved predecessor candidate',
               '{"predecessorCandidateId":"candidate_topology_old","replacementKind":"SPLIT","successorCandidateId":"candidate_topology_new"}', now())`,
          );
          if (options.preseedSuccessor !== true) {
            await client.query(
              `INSERT INTO resource_candidates
               (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
                candidate_content_fingerprint, reconciled_classification_run_id,
                classification_policy_version, identity_policy_version, ordered_provenance,
                candidate_idempotency_key, status, creation_command_id,
                creation_result_id, creation_audit_event_id, created_at, updated_at)
             VALUES ('candidate_topology_new', 'snapshot_2', 'root_2', $1, $2, 'run_2',
               'classification-v1', 'identity-v1', '[]', 'candidate-key-topology-new',
               'IDENTITY_REVIEW_REQUIRED', 'command_topology_terminal',
               'result_topology_terminal', $3, now(), now())`,
              [
                "3".repeat(64),
                "4".repeat(64),
                options.successorAuditEventId ?? "audit_topology_terminal_candidate_created",
              ],
            );
          }
          await client.query(
            `INSERT INTO m02_candidate_replacements
               (id, predecessor_candidate_id, successor_candidate_id, replacement_kind,
                command_id, result_id, audit_event_id, reason, created_at)
             VALUES ('mapping_topology_terminal', 'candidate_topology_old',
               'candidate_topology_new', 'SPLIT', 'command_topology_terminal',
               'result_topology_terminal', 'audit_topology_terminal_mapping',
               'Split an unresolved predecessor candidate', now())`,
          );
          await client.query(
            `UPDATE identity_decisions SET state = 'SUPERSEDED', record_version = 2,
               replacement_command_id = 'command_topology_terminal',
               replacement_result_id = 'result_topology_terminal',
               replacement_audit_event_id = 'audit_topology_terminal_decision'
             WHERE id = 'decision_topology_seed'`,
          );
          await client.query(
            `UPDATE resource_candidates SET status = 'SUPERSEDED', record_version = 3,
               terminal_reason_code = 'TOPOLOGY_SUPERSEDED',
               superseded_by_candidate_id = 'candidate_topology_new',
               replacement_command_id = 'command_topology_terminal',
               replacement_result_id = 'result_topology_terminal',
               replacement_audit_event_id = $1,
               updated_at = now() WHERE id = 'candidate_topology_old'`,
            [options.predecessorAuditEventId ?? "audit_topology_terminal_candidate"],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      };
      const topologyBeforeState = canonicalJson({
        identityOutcome: "AMBIGUOUS_IDENTITY",
        recordVersion: 2,
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "IDENTITY_REVIEW_REQUIRED",
      });
      const topologyAfterState = canonicalJson({
        identityOutcome: "AMBIGUOUS_IDENTITY",
        recordVersion: 3,
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "SUPERSEDED",
        supersededById: "candidate_topology_new",
        terminalReasonCode: "TOPOLOGY_SUPERSEDED",
      });
      const topologyCreatedState = canonicalJson({
        identityOutcome: null,
        recordVersion: 1,
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "IDENTITY_REVIEW_REQUIRED",
      });
      await expect(
        executeTopologySupersession(
          canonicalJson({
            identityOutcome: "AMBIGUOUS_IDENTITY",
            recordVersion: 2,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "CLASSIFIED",
          }),
          topologyAfterState,
          topologyCreatedState,
        ),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(
          topologyBeforeState,
          canonicalJson({
            identityOutcome: "AMBIGUOUS_IDENTITY",
            recordVersion: 3,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "SUPERSEDED",
            supersededById: "candidate_topology_old",
            terminalReasonCode: "TOPOLOGY_SUPERSEDED",
          }),
          topologyCreatedState,
        ),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(
          topologyBeforeState,
          topologyAfterState,
          canonicalJson({
            identityOutcome: null,
            recordVersion: 1,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "CLASSIFIED",
          }),
        ),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(topologyBeforeState, topologyAfterState, topologyCreatedState, {
          extraCreatedAudit: true,
        }),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(topologyBeforeState, topologyAfterState, topologyCreatedState, {
          preseedSuccessor: true,
        }),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(topologyBeforeState, topologyAfterState, topologyCreatedState, {
          predecessorAuditEventId: "audit_topology_terminal_decision",
        }),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeTopologySupersession(topologyBeforeState, topologyAfterState, topologyCreatedState, {
          successorAuditEventId: "audit_topology_terminal_mapping",
        }),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await executeTopologySupersession(
        topologyBeforeState,
        topologyAfterState,
        topologyCreatedState,
      );
      await expect(
        client.query(
          "UPDATE resource_candidates SET status = 'IDENTITY_RESOLVED', resource_identity_id = 'resource_1', resource_version_identity_id = 'version_2', record_version = record_version + 1 WHERE id = 'candidate_1'",
        ),
      ).rejects.toThrow(/foreign key/iu);
      await client.query(
        "UPDATE resource_candidates SET status = 'IDENTITY_RESOLVED', resource_identity_id = 'resource_1', resource_version_identity_id = 'version_1', record_version = record_version + 1 WHERE id = 'candidate_1'",
      );
      await expect(
        client.query(
          "INSERT INTO duplicate_candidates (id, resource_candidate_id, target_resource_version_id, status, evidence_ids, decision_id, reason, actor_id, created_at) VALUES ('duplicate_mismatch', 'candidate_1', 'version_1', 'CONFIRMED', '[]'::jsonb, 'decision_missing', 'Not content equal', 'actor_1', now())",
        ),
      ).rejects.toThrow(/DUPLICATE_CONTENT_MISMATCH/iu);
      await insertHumanSubjectAudit(client, {
        id: "audit_source_repo_1",
        subjectType: "SOURCE_REPOSITORY_IDENTITY",
        subjectId: "source_repo_1",
        afterState: { recordVersion: 1 },
      });
      await client.query(
        "INSERT INTO source_repository_identities (id, provider, provider_repository_id, first_observed_source_snapshot_id, created_at, origin_type, command_id, result_id, audit_event_id) VALUES ('source_repo_1', 'github', '42', 'snapshot_1', now(), 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_source_repo_1')",
      );
      await insertHumanSubjectAudit(client, {
        id: "audit_source_url_1",
        subjectType: "SOURCE_REPOSITORY_URL",
        subjectId: "source_url_1",
      });
      await client.query(
        "INSERT INTO source_repository_urls (id, source_repository_id, provider, provider_repository_id, canonical_url, source_snapshot_id, observed_at, state, origin_type, command_id, result_id, audit_event_id) VALUES ('source_url_1', 'source_repo_1', 'github', '42', 'https://github.com/example/repo', 'snapshot_1', now(), 'ACTIVE', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_source_url_1')",
      );
      await expect(
        client.query(
          "INSERT INTO source_repository_urls (id, source_repository_id, provider, provider_repository_id, canonical_url, source_snapshot_id, observed_at, state, origin_type, command_id, result_id, audit_event_id) VALUES ('source_url_2', 'source_repo_1', 'github', '42', 'https://github.com/example/renamed', 'snapshot_1', now(), 'ACTIVE', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_seed_accept')",
        ),
      ).rejects.toThrow(/unique/iu);
      await client.query(
        "INSERT INTO source_snapshots (id, identity_key, provider, provider_repository_id, immutable_revision, acquisition_policy_version, acquired_at) VALUES ('snapshot_3', 'github:43:rev', 'github', '43', $1, 'm01-v1', now())",
        ["c".repeat(40)],
      );
      await insertHumanSubjectAudit(client, {
        id: "audit_source_repo_2",
        subjectType: "SOURCE_REPOSITORY_IDENTITY",
        subjectId: "source_repo_2",
        afterState: { recordVersion: 1 },
      });
      await client.query(
        "INSERT INTO source_repository_identities (id, provider, provider_repository_id, first_observed_source_snapshot_id, created_at, origin_type, command_id, result_id, audit_event_id) VALUES ('source_repo_2', 'github', '43', 'snapshot_3', now(), 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_source_repo_2')",
      );
      await expect(
        client.query(
          "INSERT INTO source_repository_urls (id, source_repository_id, provider, provider_repository_id, canonical_url, source_snapshot_id, observed_at, supersedes_url_id, state, origin_type, command_id, result_id, audit_event_id) VALUES ('source_url_cross_repo', 'source_repo_2', 'github', '43', 'https://github.com/example/other', 'snapshot_3', now(), 'source_url_1', 'SUPERSEDED', 'HUMAN_COMMAND', 'command_seed', 'result_seed', 'audit_seed_accept')",
        ),
      ).rejects.toThrow(/foreign key/iu);
      await expect(
        client.query(
          "INSERT INTO external_identifiers (id, resource_identity_id, provider, identifier_type, issuer, namespace, normalized_value, normalization_policy_version, evidence_reference_id, canonical_key_hash, canonical_key_payload, provenance, review_state) VALUES ('external_invalid', 'resource_1', 'gitlab', 'PROVIDER_REPOSITORY_ID', 'github.com', 'owner', '42', 'external-id-v1', 'evidence_missing', $1, decode('01', 'hex'), 'M01_PROVIDER_ASSERTED', 'VERIFIED')",
          ["a".repeat(64)],
        ),
      ).rejects.toThrow(/check constraint/iu);
      expect(
        (
          await client.query<{ count: string }>(
            "SELECT count(*) FROM m01_source_documents WHERE source_snapshot_id = 'snapshot_1'",
          )
        ).rows[0]?.count,
      ).toBe("1");
      await expect(
        client.query(
          "INSERT INTO manual_resolution_commands (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id, actor_role, expected_versions, caller_expected_versions_payload, request_fingerprint, result_fingerprint, reason_code, reason, request_payload, created_at) VALUES ('command_zero_version', 'request_zero', 'REPLACE_M02_JOB', 'M02', 'zero', 'actor_1', 'EDITOR', '{\"job:source\":0}'::jsonb, decode('00','hex'), $1, $2, 'FAILED_STAGE_REPLACEMENT', 'Invalid zero expected version', decode('00','hex'), now())",
          ["a".repeat(64), "b".repeat(64)],
        ),
      ).rejects.toThrow(/check constraint/iu);
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_a', 'submission_1', 'snapshot_1', 'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 1, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["1".repeat(64), "2".repeat(64)],
      );
      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_c', 'submission_1', 'request_3', 'ACTIVE', 'RECEIVED', 1, 'snapshot_1')",
      );
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, controlling_classification_decision_id, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_c', 'submission_1', 'snapshot_1', 'IDENTITY_RESOLUTION', 'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 5, NULL, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["b".repeat(64), "c".repeat(64)],
      );
      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_full_overlap', 'submission_1', 'request_full_overlap', 'ACTIVE', 'RECEIVED', 1, 'snapshot_1')",
      );
      await expect(
        client.query(
          "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_full_overlap', 'submission_1', 'snapshot_1', 'FULL_PIPELINE', 'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 6, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
          ["d".repeat(64), "e".repeat(64)],
        ),
      ).rejects.toThrow(/OVERLAPPING_M02_CONTROLLER/iu);

      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_identity_first', 'submission_2', 'request_identity_first', 'OPERATOR_REVIEW_REQUIRED', 'RECEIVED', 1, 'snapshot_1'), ('job_classification_second', 'submission_2', 'request_classification_second', 'OPERATOR_REVIEW_REQUIRED', 'RECEIVED', 1, 'snapshot_1')",
      );
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_identity_first', 'submission_2', 'snapshot_1', 'IDENTITY_RESOLUTION', 'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 1, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["3".repeat(64), "4".repeat(64)],
      );
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_classification_second', 'submission_2', 'snapshot_1', 'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 2, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["5".repeat(64), "6".repeat(64)],
      );
      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_failed_controller', 'submission_3', 'request_failed_controller', 'FAILED', 'INVENTORYING_SOURCE', 1, 'snapshot_1'), ('job_active_overlap', 'submission_3', 'request_active_overlap', 'ACTIVE', 'RECEIVED', 1, 'snapshot_1')",
      );
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_failed_controller', 'submission_3', 'snapshot_1', 'IDENTITY_RESOLUTION', 'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 1, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["7".repeat(64), "8".repeat(64)],
      );
      await client.query(
        "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_active_overlap', 'submission_3', 'snapshot_1', 'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 2, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
        ["9".repeat(64), "a".repeat(64)],
      );
      await client.query(
        "INSERT INTO acquisition_jobs (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id) VALUES ('job_failed_overlap', 'submission_3', 'request_failed_overlap', 'FAILED', 'INVENTORYING_SOURCE', 1, 'snapshot_1')",
      );
      await expect(
        client.query(
          "INSERT INTO m02_jobs (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage, review_state, supersession_state, supersession_sequence, job_scope_key, input_fingerprint, classification_policy_version, identity_policy_version, analysis_policy_version, prompt_bundle_version) VALUES ('job_failed_overlap', 'submission_3', 'snapshot_1', 'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 3, $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')",
          ["a".repeat(64), "b".repeat(64)],
        ),
      ).rejects.toThrow(/OVERLAPPING_M02_CONTROLLER/iu);
      const firstGuardPayload = canonicalPayload({
        components: { jobLineageId: "submission_1", operationScope: "CLASSIFICATION" },
        guardType: "JOB_SCOPE_CONTROLLER",
      });
      const collidingGuardPayload = canonicalPayload({
        components: { jobLineageId: "submission_1", operationScope: "FULL_PIPELINE" },
        guardType: "JOB_SCOPE_CONTROLLER",
      });
      await client.query(
        "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)",
        [
          guardKey("JOB_SCOPE_CONTROLLER", firstGuardPayload),
          firstGuardPayload,
          sha256(firstGuardPayload),
        ],
      );
      await client.query(
        "UPDATE m02_concurrency_guards SET record_version = record_version + 1 WHERE guard_key = $1",
        [guardKey("JOB_SCOPE_CONTROLLER", firstGuardPayload)],
      );
      await expect(
        client.query(
          `UPDATE m02_concurrency_guards
           SET canonical_payload = $2, payload_hash = $3, record_version = record_version + 1
           WHERE guard_key = $1`,
          [
            guardKey("JOB_SCOPE_CONTROLLER", firstGuardPayload),
            collidingGuardPayload,
            sha256(collidingGuardPayload),
          ],
        ),
      ).rejects.toThrow(/M02_CONCURRENCY_GUARD_IDENTITY_IMMUTABLE/iu);
      await expect(
        client.query(
          "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)",
          [
            guardKey("JOB_SCOPE_CONTROLLER", collidingGuardPayload),
            collidingGuardPayload,
            sha256(firstGuardPayload),
          ],
        ),
      ).rejects.toThrow(/check constraint/iu);

      const nonCanonicalGuardPayload = Buffer.from(
        '{"guardType":"JOB_SCOPE_CONTROLLER","components":{"operationScope":"CLASSIFICATION","jobLineageId":"submission_1"}}',
        "utf8",
      );
      await expect(
        client.query(
          "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)",
          [
            guardKey("JOB_SCOPE_CONTROLLER", nonCanonicalGuardPayload),
            nonCanonicalGuardPayload,
            sha256(nonCanonicalGuardPayload),
          ],
        ),
      ).rejects.toThrow(/check constraint/iu);
      const invalidShapeGuardPayload = canonicalPayload({
        components: {
          jobLineageId: "submission_1",
          operationScope: "CLASSIFICATION",
          replacementJobId: "future-id-is-not-authority",
        },
        guardType: "JOB_SCOPE_CONTROLLER",
      });
      await expect(
        client.query(
          "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)",
          [
            guardKey("JOB_SCOPE_CONTROLLER", invalidShapeGuardPayload),
            invalidShapeGuardPayload,
            sha256(invalidShapeGuardPayload),
          ],
        ),
      ).rejects.toThrow(/check constraint/iu);
      const arbitraryGuardPayload = Buffer.from([3]);
      await expect(
        client.query(
          "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'HANDOFF', $2, $3)",
          [
            guardKey("HANDOFF", arbitraryGuardPayload),
            arbitraryGuardPayload,
            sha256(arbitraryGuardPayload),
          ],
        ),
      ).rejects.toThrow(/check constraint/iu);

      const raceGuardPayloadA = canonicalPayload({
        components: {
          contentFingerprint: "2".repeat(64),
          resourceIdentityRef: {
            kind: "RESOURCE_IDENTITY_ANCHOR",
            originCandidateId: "candidate_1",
          },
        },
        guardType: "RESOURCE_VERSION",
      });
      const raceGuardPayloadB = Buffer.from(raceGuardPayloadA);
      const [raceClientA, raceClientB] = await Promise.all([pool.connect(), pool.connect()]);
      let concurrentGuardCreates: PromiseSettledResult<unknown>[];
      try {
        await Promise.all([
          raceClientA.query("SET search_path TO m02_from_m01, public"),
          raceClientB.query("SET search_path TO m02_from_m01, public"),
        ]);
        concurrentGuardCreates = await Promise.allSettled([
          raceClientA.query(
            "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'RESOURCE_VERSION', $2, $3)",
            [
              guardKey("RESOURCE_VERSION", raceGuardPayloadA),
              raceGuardPayloadA,
              sha256(raceGuardPayloadA),
            ],
          ),
          raceClientB.query(
            "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ($1, 'RESOURCE_VERSION', $2, $3)",
            [
              guardKey("RESOURCE_VERSION", raceGuardPayloadB),
              raceGuardPayloadB,
              sha256(raceGuardPayloadA),
            ],
          ),
        ]);
      } finally {
        raceClientA.release();
        raceClientB.release();
      }
      expect(concurrentGuardCreates.filter((result) => result.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(concurrentGuardCreates.filter((result) => result.status === "rejected")).toHaveLength(
        1,
      );

      await client.query(
        `INSERT INTO manual_resolution_commands
           (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
            actor_role, expected_versions, caller_expected_versions_payload, request_fingerprint,
            reason_code, reason, request_payload, created_at)
         VALUES ('command_schema', 'request_schema', 'RESOLVE_AMBIGUITY', 'M02', 'schema',
           'actor_1', 'EDITOR', '{}'::jsonb, $1, $2,
           'IDENTITY_AMBIGUITY_RESOLVED', 'Schema negative-test origin', $3, now())`,
        [schemaExpectedVersions, sha256(schemaRequestPayload), schemaRequestPayload],
      );
      await client.query(
        `INSERT INTO m02_manual_command_results
           (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
            result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
         VALUES ('result_schema', 'command_schema', 'request_schema', $1, $2, $3,
           '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, now())`,
        [sha256(schemaRequestPayload), "e".repeat(64), "f".repeat(64)],
      );
      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action, subject_type, subject_id,
            request_id, idempotency_scope, idempotency_key, reason_code, reason_text, occurred_at)
         VALUES ('audit_schema', 'HUMAN_COMMAND', 'command_schema', 'result_schema', 'HUMAN', 'actor_1', 'EDITOR',
           'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND', 'command_schema', 'request_schema',
           'M02', 'schema', 'IDENTITY_AMBIGUITY_RESOLVED', 'Schema negative-test origin', now())`,
      );
      await client.query(
        `INSERT INTO m02_audit_events
           (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role, action,
            subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
            reason_code, reason_text, after_version, after_state, metadata, occurred_at)
         VALUES ('audit_decision_schema', 'HUMAN_COMMAND', 'command_schema', 'result_schema',
           'HUMAN', 'actor_1', 'EDITOR', 'SUBJECT_CREATED', 'IDENTITY_DECISION',
           'decision_schema', 'request_schema', 'M02', 'schema', 'IDENTITY_AMBIGUITY_RESOLVED',
           'Schema negative-test origin', 1, '{"recordVersion":1,"state":"ACTIVE"}',
           '{"evaluatedTierSequence":[{"evaluationDisposition":"NO_MATCH","tier":"P1"},{"evaluationDisposition":"NO_MATCH","tier":"P2"},{"evaluationDisposition":"NO_MATCH","tier":"P3"},{"evaluationDisposition":"NO_MATCH","tier":"P4"},{"evaluationDisposition":"NO_MATCH","tier":"P5"},{"evaluationDisposition":"NO_MATCH","tier":"P6"}]}'::jsonb,
           now())`,
      );
      await client.query(
        `INSERT INTO identity_decisions
           (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
            signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
            created_at, origin_type, command_id, result_id, audit_event_id)
         VALUES ('decision_schema', 'candidate_1', 'AMBIGUOUS_IDENTITY', 'identity-v1',
           'HUMAN_COMMAND', '[]', '[]', '[]', $1, 'ACTIVE', now(),
           'HUMAN_COMMAND', 'command_schema', 'result_schema', 'audit_decision_schema')`,
        ["c".repeat(64)],
      );
      await expect(
        client.query(
          `INSERT INTO m02_identity_handoff_markers
             (id, resource_candidate_id, resource_identity_id, resource_version_identity_id,
              controlling_m02_job_id, source_snapshot_id, identity_decision_id, audit_event_id,
              logical_key, state, origin_type, created_at)
           VALUES ('handoff_bad_origin', 'candidate_1', 'resource_1', 'version_1', 'job_a',
             'snapshot_1', 'decision_schema', 'audit_schema', 'handoff:bad-origin', 'ACTIVE',
             'HUMAN_COMMAND', now())`,
        ),
      ).rejects.toThrow(/check constraint/iu);

      await expect(
        client.query(
          `INSERT INTO identity_decision_signals
             (identity_decision_id, ordinal, tier, signal_type, target_type,
              resource_identity_id, audit_event_id, created_at)
           VALUES ('decision_schema', 0, 'P4', 'P4_CANDIDATE_CONTENT_FINGERPRINT',
             'RESOURCE_VERSION', 'resource_1', 'audit_schema', now())`,
        ),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query(
          `INSERT INTO identity_decision_tier_evaluations
             (identity_decision_id, ordinal, tier, evaluation_disposition, audit_event_id, created_at)
           VALUES ('decision_schema', 0, 'P2', 'NO_MATCH', 'audit_schema', now())`,
        ),
      ).rejects.toThrow(/check constraint/iu);

      const locatorPayload = canonicalPayload({
        candidateId: "candidate_1",
        classificationPolicyVersion: "classification-v1",
        controllingJobId: "job_a",
        identityPolicyVersion: "identity-v1",
        reconciledClassificationRunId: "run_1",
        replayScope: "M02_SYSTEM_IDENTITY_REPLAY_V1",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_1",
        systemActorId: "m02-resolver",
      });
      const invalidPhaseRejectionContext = canonicalPayload({
        attemptedSystemOperationIdOrNull: null,
        automaticProjectorModeIdOrNull: "S6_JR",
        candidateId: "candidate_1",
        controllingJobId: "job_a",
        errorCode: "CANCELLED",
        existingTargets: [],
        idempotencyKeyOrNull: null,
        idempotencyScopeOrNull: null,
        identityDecisionInputFingerprintOrNull: null,
        phase: "PRE_PROJECTOR",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_1",
        systemActorId: "m02-resolver",
        systemOperationFingerprintOrNull: null,
        systemReplayLookupKey: sha256(locatorPayload),
      });
      await expect(
        client.query(
          `INSERT INTO m02_rejected_system_identity_audits
             (phase, candidate_id, controlling_job_id, source_snapshot_id, system_actor_id,
              system_replay_locator_payload, system_replay_lookup_key, error_code,
              existing_targets, automatic_projector_mode_id, rejection_context_payload,
              rejection_fingerprint, occurred_at)
           VALUES ('PRE_PROJECTOR', 'candidate_1', 'job_a', 'snapshot_1', 'm02-resolver',
             $1, $2, 'CANCELLED', '[]', 'S6_JR', $3, $4, now())`,
          [
            locatorPayload,
            sha256(locatorPayload),
            invalidPhaseRejectionContext,
            sha256(invalidPhaseRejectionContext),
          ],
        ),
      ).rejects.toThrow(/check constraint/iu);
      const rejectionContext = canonicalPayload({
        attemptedSystemOperationIdOrNull: null,
        automaticProjectorModeIdOrNull: null,
        candidateId: "candidate_1",
        controllingJobId: "job_a",
        errorCode: "CANCELLED",
        existingTargets: [],
        idempotencyKeyOrNull: null,
        idempotencyScopeOrNull: null,
        identityDecisionInputFingerprintOrNull: null,
        phase: "PRE_PROJECTOR",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_1",
        systemActorId: "m02-resolver",
        systemOperationFingerprintOrNull: null,
        systemReplayLookupKey: sha256(locatorPayload),
      });
      await client.query(
        `INSERT INTO m02_rejected_system_identity_audits
           (phase, candidate_id, controlling_job_id, source_snapshot_id, system_actor_id,
            system_replay_locator_payload, system_replay_lookup_key, error_code,
            existing_targets, rejection_context_payload, rejection_fingerprint, occurred_at)
         VALUES ('PRE_PROJECTOR', 'candidate_1', 'job_a', 'snapshot_1', 'm02-resolver',
           $1, $2, 'CANCELLED', '[]', $3, $4, now())`,
        [locatorPayload, sha256(locatorPayload), rejectionContext, sha256(rejectionContext)],
      );
      const wrongRejectionContext = canonicalPayload({
        ...JSON.parse(rejectionContext.toString("utf8")),
        errorCode: "JOB_SUPERSEDED",
      } as JsonValue);
      await expect(
        client.query(
          `INSERT INTO m02_rejected_system_identity_audits
             (phase, candidate_id, controlling_job_id, source_snapshot_id, system_actor_id,
              system_replay_locator_payload, system_replay_lookup_key, error_code,
              existing_targets, rejection_context_payload, rejection_fingerprint, occurred_at)
           VALUES ('PRE_PROJECTOR', 'candidate_1', 'job_a', 'snapshot_1', 'm02-resolver',
             $1, $2, 'CANCELLED', '[]', $3, $4, now())`,
          [
            locatorPayload,
            sha256(locatorPayload),
            wrongRejectionContext,
            sha256(wrongRejectionContext),
          ],
        ),
      ).rejects.toThrow(/M02_SYSTEM_REJECTION_CANONICAL_PAYLOAD_MISMATCH/iu);
      await expect(
        client.query(
          "UPDATE m02_rejected_system_identity_audits SET occurred_at = now() + interval '1 second' WHERE rejection_fingerprint = $1",
          [sha256(rejectionContext)],
        ),
      ).rejects.toThrow(/M02_HISTORY_IMMUTABLE/iu);
      await expect(
        client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, actor_type, actor_id, action, subject_type, subject_id,
              request_id, idempotency_scope, idempotency_key, reason_code, reason_text,
              occurred_at)
           VALUES ('audit_bad_origin', 'HUMAN_COMMAND', 'HUMAN', 'actor_1',
             'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND', 'command_schema',
             'request_schema', 'M02', 'schema', 'TEST', 'Bad origin XOR', now())`,
        ),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query(
          `INSERT INTO duplicate_candidates
             (id, resource_candidate_id, target_resource_version_id, status, evidence_ids,
              decision_id, reason, actor_id, created_at, origin_type, command_id, result_id,
              audit_event_id)
           VALUES ('duplicate_bad_proposal', 'candidate_1', 'version_1', 'PROPOSED', '[]',
             'decision_schema', 'Human cannot create system proposal', 'actor_1', now(),
             'HUMAN_COMMAND', 'command_schema', 'result_schema', 'audit_decision_schema')`,
        ),
      ).rejects.toThrow(/M02_HUMAN_DUPLICATE_CANNOT_BEGIN_PROPOSED/iu);
      await expect(
        client.query(
          "INSERT INTO m02_concurrency_guards (guard_key, guard_type, canonical_payload, payload_hash) VALUES ('guard:invalid', 'DUPLICATE_PROPOSAL', decode('05','hex'), $1)",
          ["9".repeat(64)],
        ),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query("DELETE FROM source_snapshots WHERE id = 'snapshot_1'"),
      ).rejects.toThrow(/foreign key/iu);
    });
  }, 120_000);

  it("accepts one complete S6 system result and rejects missing or misordered decision children", async () => {
    await withSchema("m02_system_result", async (client) => {
      const ids = {
        auditAccepted: "00000000-0000-0000-0000-000000000601",
        auditCandidate: "00000000-0000-0000-0000-000000000602",
        auditConflict: "00000000-0000-0000-0000-000000000603",
        auditDecision: "00000000-0000-0000-0000-000000000604",
        auditJob: "00000000-0000-0000-0000-000000000605",
        auditM02Job: "00000000-0000-0000-0000-000000000606",
        auditReview: "00000000-0000-0000-0000-000000000607",
        candidate: "00000000-0000-0000-0000-000000000101",
        candidateNegative: "00000000-0000-0000-0000-000000000102",
        conflict: "00000000-0000-0000-0000-000000000521",
        conflictNegative: "00000000-0000-0000-0000-000000000522",
        decision: "00000000-0000-0000-0000-000000000501",
        decisionNegative: "00000000-0000-0000-0000-000000000502",
        job: "00000000-0000-0000-0000-000000000201",
        jobNegative: "00000000-0000-0000-0000-000000000202",
        operation: "00000000-0000-0000-0000-000000000401",
        operationNegative: "00000000-0000-0000-0000-000000000403",
        result: "00000000-0000-0000-0000-000000000402",
        resultNegative: "00000000-0000-0000-0000-000000000404",
        review: "00000000-0000-0000-0000-000000000301",
        reviewNegative: "00000000-0000-0000-0000-000000000302",
        tiers: [
          "00000000-0000-0000-0000-000000000511",
          "00000000-0000-0000-0000-000000000512",
          "00000000-0000-0000-0000-000000000513",
          "00000000-0000-0000-0000-000000000514",
          "00000000-0000-0000-0000-000000000515",
          "00000000-0000-0000-0000-000000000516",
        ],
      } as const;
      const tierSequence = [
        { evaluationDisposition: "NO_MATCH", tier: "P1" },
        { evaluationDisposition: "NO_MATCH", tier: "P2" },
        { evaluationDisposition: "CONFLICT", tier: "P3" },
        { evaluationDisposition: "NOT_APPLICABLE", tier: "P4" },
        { evaluationDisposition: "NOT_APPLICABLE", tier: "P5" },
        { evaluationDisposition: "NOT_APPLICABLE", tier: "P6" },
      ] satisfies JsonValue;
      const conflicts = [
        {
          code: "MISSING_OR_UNRELIABLE_IDENTITY_TOKEN",
          evidenceReferenceIds: [],
          targets: [],
        },
      ] satisfies JsonValue;

      await client.query(migration001);
      await client.query(
        `INSERT INTO source_snapshots
           (id, identity_key, provider, provider_repository_id, immutable_revision,
            acquisition_policy_version, acquired_at)
         VALUES ('snapshot_system', 'github:system:rev', 'github', 'system-repo', $1,
           'm01-v1', now())`,
        ["a".repeat(40)],
      );
      await client.query(
        `INSERT INTO acquisition_jobs
           (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id)
         VALUES ($1, 'submission_system', 'request_system', 'ACTIVE', 'RECEIVED', 1,
           'snapshot_system')`,
        [ids.job],
      );
      await client.query(migration002);
      await client.query(
        `INSERT INTO repository_candidate_groups
           (id, source_snapshot_id, classification_policy_version, group_key,
            group_fingerprint, classification, identity_policy_version, parser_profile_version,
            analysis_policy_version, prompt_bundle_version, state, created_at)
         VALUES ('group_system', 'snapshot_system', 'classification-v1', 'group-system', $1,
           'MULTIPLE_SKILLS', 'identity-v1', 'parser-v1', 'analysis-v1', 'prompt-v1',
           'ACTIVE', now())`,
        ["1".repeat(64)],
      );
      await client.query(
        `INSERT INTO repository_classification_runs
           (id, group_id, source_snapshot_id, run_source, classification,
            classification_policy_version, identity_policy_version, analysis_policy_version,
            prompt_bundle_version, parser_profile_version, methodology_version,
            input_fingerprint, output_fingerprint, created_at)
         VALUES ('run_system', 'group_system', 'snapshot_system', 'DETERMINISTIC',
           'MULTIPLE_SKILLS', 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1',
           'parser-v1', 'classification-v1', $1, $2, now())`,
        ["2".repeat(64), "3".repeat(64)],
      );
      await client.query(
        `INSERT INTO candidate_roots
           (id, group_id, classification_run_id, source_snapshot_id, normalized_root_path,
            candidate_root_fingerprint, candidate_content_fingerprint, canonical_root_payload,
            canonical_content_payload, root_idempotency_key, state)
         VALUES ('root_system', 'group_system', 'run_system', 'snapshot_system', 'skills/system',
           $1, $2, decode('01','hex'), decode('02','hex'), 'root-system', 'ACTIVE')`,
        ["4".repeat(64), "5".repeat(64)],
      );
      await client.query(
        `INSERT INTO resource_candidates
           (id, source_snapshot_id, candidate_root_id, candidate_root_fingerprint,
            candidate_content_fingerprint, reconciled_classification_run_id,
            classification_policy_version, identity_policy_version, ordered_provenance,
            candidate_idempotency_key, status, created_at, updated_at)
         VALUES ($1, 'snapshot_system', 'root_system', $2, $3, 'run_system',
           'classification-v1', 'identity-v1', '[]', 'candidate-system', 'CLASSIFIED',
           now(), now()),
           ($4, 'snapshot_system', 'root_system', $2, $3, 'run_system',
           'classification-v1', 'identity-v1', '[]', 'candidate-system-negative', 'CLASSIFIED',
           now(), now())`,
        [ids.candidate, "4".repeat(64), "5".repeat(64), ids.candidateNegative],
      );
      await client.query(
        `INSERT INTO m02_jobs
           (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage,
            review_state, supersession_state, supersession_sequence, job_scope_key,
            input_fingerprint, classification_policy_version, identity_policy_version,
            analysis_policy_version, prompt_bundle_version)
         VALUES ($1, 'submission_system', 'snapshot_system', 'IDENTITY_RESOLUTION',
           'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 1, $2, $3,
           'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')`,
        [ids.job, "6".repeat(64), "7".repeat(64)],
      );
      await client.query(
        `INSERT INTO m02_review_states
           (id, resource_candidate_id, review_state, source_snapshot_id, controlling_job_id)
         VALUES ($1, $2, 'NOT_REQUIRED', 'snapshot_system', $3)`,
        [ids.review, ids.candidate, ids.job],
      );
      await client.query(
        `INSERT INTO acquisition_jobs
           (id, submission_id, idempotency_key, status, current_stage, attempt, source_snapshot_id)
         VALUES ($1, 'submission_system_negative', 'request_system_negative', 'ACTIVE',
           'RECEIVED', 1, 'snapshot_system')`,
        [ids.jobNegative],
      );
      await client.query(
        `INSERT INTO m02_jobs
           (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage,
            review_state, supersession_state, supersession_sequence, job_scope_key,
            input_fingerprint, classification_policy_version, identity_policy_version,
            analysis_policy_version, prompt_bundle_version)
         VALUES ($1, 'submission_system_negative', 'snapshot_system', 'IDENTITY_RESOLUTION',
           'RESOLVING_IDENTITY', 'NOT_REQUIRED', 'CONTROLLING', 1, $2, $3,
           'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')`,
        [ids.jobNegative, "a".repeat(64), "b".repeat(64)],
      );
      await client.query(
        `INSERT INTO m02_review_states
           (id, resource_candidate_id, review_state, source_snapshot_id, controlling_job_id)
         VALUES ($1, $2, 'NOT_REQUIRED', 'snapshot_system', $3)`,
        [ids.reviewNegative, ids.candidateNegative, ids.jobNegative],
      );

      const decisionInput = canonicalPayload({
        analysisPolicyVersion: "analysis-v1",
        analysisRunIdOrNull: null,
        analysisRunRequestFingerprintOrNull: null,
        analysisRunResponseFingerprintOrNull: null,
        candidateContentFingerprint: "5".repeat(64),
        candidateId: ids.candidate,
        candidateRootFingerprint: "4".repeat(64),
        classificationPolicyVersion: "classification-v1",
        classificationRunInputFingerprint: "2".repeat(64),
        classificationRunOutputFingerprint: "3".repeat(64),
        conflicts,
        evaluatedTierSequence: tierSequence,
        identityPolicyVersion: "identity-v1",
        parserProfileVersion: "parser-v1",
        promptBundleVersion: "prompt-v1",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        trustedSignals: [],
      });
      const replayLocator = canonicalPayload({
        candidateId: ids.candidate,
        classificationPolicyVersion: "classification-v1",
        controllingJobId: ids.job,
        identityPolicyVersion: "identity-v1",
        reconciledClassificationRunId: "run_system",
        replayScope: "M02_SYSTEM_IDENTITY_REPLAY_V1",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        systemActorId: "m02-resolver",
      });
      const idempotencyPayload = canonicalPayload({
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidate,
        controllingJobId: ids.job,
        identityDecisionInputFingerprint: sha256(decisionInput),
        identityPolicyVersion: "identity-v1",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
      });
      const expectedVersions = {
        [`row:acquisition_jobs:${ids.job}`]: 1,
        [`row:m02_jobs:${ids.job}`]: 1,
        [`row:m02_review_states:${ids.review}`]: 1,
        [`row:resource_candidates:${ids.candidate}`]: 1,
      };
      const operationRequest = canonicalPayload({
        SystemExpectedVersions: expectedVersions,
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidate,
        controllingJobId: ids.job,
        idempotencyKey: sha256(idempotencyPayload),
        idempotencyScope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
        identityDecisionInputFingerprint: sha256(decisionInput),
        identityPolicyVersion: "identity-v1",
        operationKind: "SYSTEM_IDENTITY_PROJECTION",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        systemActorId: "m02-resolver",
        systemReplayLookupKey: sha256(replayLocator),
      });
      const empty: string[] = [];
      const postconditions = {
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidate,
        controllingJobId: ids.job,
        createdDuplicateCandidateIds: empty,
        createdHandoffMarkerIds: empty,
        createdIdentityDecisionConflictEvidenceIds: empty,
        createdIdentityDecisionConflictIds: [ids.conflict],
        createdIdentityDecisionConflictTargetIds: empty,
        createdIdentityDecisionIds: [ids.decision],
        createdIdentityDecisionSignalEvidenceIds: empty,
        createdIdentityDecisionSignalIds: empty,
        createdIdentityDecisionTierEvaluationIds: ids.tiers,
        createdObservationIds: empty,
        createdResourceIdentityIds: empty,
        createdResourceVersionIdentityIds: empty,
        createdSourceLinkIds: empty,
        createdSourceRepositoryIds: empty,
        createdSourceRepositoryUrlIds: empty,
        duplicateCandidateIdOrNull: null,
        finalAcquisitionJobStatus: "OPERATOR_REVIEW_REQUIRED",
        finalCandidateState: {
          identityOutcome: "AMBIGUOUS_IDENTITY",
          recordVersion: 2,
          resourceIdentityId: null,
          resourceVersionIdentityId: null,
          status: "IDENTITY_REVIEW_REQUIRED",
        },
        finalM02JobStatus: "OPERATOR_REVIEW_REQUIRED",
        finalM02Stage: "RESOLVING_IDENTITY",
        finalReviewState: "IDENTITY_REVIEW_REQUIRED",
        handoffMarkerIdOrNull: null,
        identityDecisionId: ids.decision,
        resourceIdentityIdOrNull: null,
        resourceVersionIdentityIdOrNull: null,
        reusedObservationIds: empty,
        reusedResourceIdentityIds: empty,
        reusedResourceVersionIdentityIds: empty,
        reusedSourceLinkIds: empty,
        reusedSourceRepositoryIds: empty,
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        supersededDuplicateCandidateIds: empty,
        supersededHandoffMarkerIds: empty,
        supersededIdentityDecisionIds: empty,
        supersededSourceLinkIds: empty,
        updatedAcquisitionJobIds: [ids.job],
        updatedM02JobIds: [ids.job],
        updatedResourceCandidateIds: [ids.candidate],
        updatedReviewStateIds: [ids.review],
      } as const;
      const tierAuditIds = tierSequence.map(
        (_tier, ordinal) => `00000000-0000-0000-0000-00000000061${String(ordinal)}`,
      );
      const occurredAt = "2026-08-23T00:00:00.000Z";
      const metadataValue = {
        automaticProjectorModeId: "S6_JR",
        evaluatedTierSequence: tierSequence,
        identityDecisionInputFingerprint: sha256(decisionInput),
      } satisfies JsonValue;
      const plannedAudit = (input: {
        id: string;
        action: "SYSTEM_OPERATION_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED";
        subjectType: string;
        subjectId: string;
        beforeVersion?: number;
        afterVersion?: number;
        beforeState?: JsonValue;
        afterState?: JsonValue;
        metadata?: JsonValue;
      }) => ({
        id: input.id,
        action: input.action,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        beforeVersion: input.beforeVersion ?? null,
        afterVersion: input.afterVersion ?? null,
        beforeState: input.beforeState === undefined ? null : canonicalJson(input.beforeState),
        afterState: input.afterState === undefined ? null : canonicalJson(input.afterState),
        metadata: input.metadata ?? {},
        originType: "SYSTEM_IDENTITY_OPERATION",
        actorType: "SYSTEM",
        actorId: "m02-resolver",
        actorRole: null,
        requestId: ids.operation,
        idempotencyScope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
        idempotencyKey: sha256(idempotencyPayload),
        reasonCode: "S6_JR",
        reasonText: "S6_JR",
        sourceSnapshotId: "snapshot_system",
        controllingJobId: ids.job,
        occurredAt,
        systemOperationId: ids.operation,
        systemResultId: ids.result,
      });
      const creates = [
        {
          tableName: "identity_decisions",
          primaryKey: ids.decision,
          values: {
            id: ids.decision,
            resource_candidate_id: ids.candidate,
            outcome: "AMBIGUOUS_IDENTITY",
            matched_tier: null,
            confidence: null,
            identity_policy_version: "identity-v1",
            decision_source: "DETERMINISTIC",
            signals: [],
            rejected_lower_tier_signals: [],
            conflicts,
            audit_fingerprint: "8".repeat(64),
            state: "ACTIVE",
            supersedes_decision_id: null,
            created_at: occurredAt,
            record_version: 1,
            origin_type: "SYSTEM_IDENTITY_OPERATION",
            system_operation_id: ids.operation,
            system_result_id: ids.result,
            audit_event_id: ids.auditDecision,
          },
        },
        ...tierSequence.map((tier, ordinal) => {
          const tierId = ids.tiers[ordinal];
          const auditId = tierAuditIds[ordinal];
          if (tierId === undefined || auditId === undefined)
            throw new Error("SYSTEM_PLAN_TIER_ID_MISSING");
          return {
            tableName: "identity_decision_tier_evaluations",
            primaryKey: tierId,
            values: {
              id: tierId,
              identity_decision_id: ids.decision,
              ordinal,
              tier: tier.tier,
              evaluation_disposition: tier.evaluationDisposition,
              audit_event_id: auditId,
              created_at: occurredAt,
            },
          };
        }),
        {
          tableName: "identity_decision_conflicts",
          primaryKey: ids.conflict,
          values: {
            id: ids.conflict,
            identity_decision_id: ids.decision,
            ordinal: 0,
            conflict_code: "MISSING_OR_UNRELIABLE_IDENTITY_TOKEN",
            audit_event_id: ids.auditConflict,
            created_at: occurredAt,
          },
        },
      ].sort((left, right) =>
        `${left.tableName}:${left.primaryKey}`.localeCompare(
          `${right.tableName}:${right.primaryKey}`,
        ),
      );
      const updates = [
        {
          tableName: "acquisition_jobs",
          primaryKey: ids.job,
          beforeValues: { status: "ACTIVE", record_version: 1 },
          afterValues: { status: "OPERATOR_REVIEW_REQUIRED", record_version: 2 },
        },
        {
          tableName: "m02_jobs",
          primaryKey: ids.job,
          beforeValues: {
            current_stage: "RESOLVING_IDENTITY",
            review_state: "NOT_REQUIRED",
            record_version: 1,
          },
          afterValues: {
            current_stage: "RESOLVING_IDENTITY",
            review_state: "IDENTITY_REVIEW_REQUIRED",
            record_version: 2,
          },
        },
        {
          tableName: "m02_review_states",
          primaryKey: ids.review,
          beforeValues: { review_state: "NOT_REQUIRED", record_version: 1 },
          afterValues: { review_state: "IDENTITY_REVIEW_REQUIRED", record_version: 2 },
        },
        {
          tableName: "resource_candidates",
          primaryKey: ids.candidate,
          beforeValues: {
            status: "CLASSIFIED",
            identity_outcome: null,
            resource_identity_id: null,
            resource_version_identity_id: null,
            record_version: 1,
          },
          afterValues: {
            status: "IDENTITY_REVIEW_REQUIRED",
            identity_outcome: "AMBIGUOUS_IDENTITY",
            resource_identity_id: null,
            resource_version_identity_id: null,
            updated_at: occurredAt,
            record_version: 2,
          },
        },
      ];
      const audits = [
        plannedAudit({
          action: "SYSTEM_OPERATION_ACCEPTED",
          id: ids.auditAccepted,
          metadata: metadataValue,
          subjectId: ids.operation,
          subjectType: "SYSTEM_IDENTITY_OPERATION",
        }),
        plannedAudit({
          action: "SUBJECT_CREATED",
          afterState: { recordVersion: 1, state: "ACTIVE" },
          afterVersion: 1,
          id: ids.auditDecision,
          metadata: metadataValue,
          subjectId: ids.decision,
          subjectType: "IDENTITY_DECISION",
        }),
        ...ids.tiers.map((tierId, ordinal) => {
          const auditId = tierAuditIds[ordinal];
          if (auditId === undefined) throw new Error("SYSTEM_PLAN_TIER_AUDIT_ID_MISSING");
          return plannedAudit({
            action: "SUBJECT_CREATED",
            id: auditId,
            subjectId: tierId,
            subjectType: "IDENTITY_DECISION_TIER_EVALUATION",
          });
        }),
        plannedAudit({
          action: "SUBJECT_CREATED",
          id: ids.auditConflict,
          subjectId: ids.conflict,
          subjectType: "IDENTITY_DECISION_CONFLICT",
        }),
        plannedAudit({
          action: "SUBJECT_UPDATED",
          afterState: {
            identityOutcome: "AMBIGUOUS_IDENTITY",
            recordVersion: 2,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "IDENTITY_REVIEW_REQUIRED",
          },
          afterVersion: 2,
          beforeState: {
            identityOutcome: null,
            recordVersion: 1,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "CLASSIFIED",
          },
          beforeVersion: 1,
          id: ids.auditCandidate,
          subjectId: ids.candidate,
          subjectType: "RESOURCE_CANDIDATE",
        }),
        plannedAudit({
          action: "SUBJECT_UPDATED",
          afterState: { recordVersion: 2, reviewState: "IDENTITY_REVIEW_REQUIRED" },
          afterVersion: 2,
          beforeState: { recordVersion: 1, reviewState: "NOT_REQUIRED" },
          beforeVersion: 1,
          id: ids.auditReview,
          subjectId: ids.review,
          subjectType: "M02_REVIEW_STATE",
        }),
        plannedAudit({
          action: "SUBJECT_UPDATED",
          afterState: { recordVersion: 2, status: "OPERATOR_REVIEW_REQUIRED" },
          afterVersion: 2,
          beforeState: { recordVersion: 1, status: "ACTIVE" },
          beforeVersion: 1,
          id: ids.auditJob,
          subjectId: ids.job,
          subjectType: "ACQUISITION_JOB",
        }),
        plannedAudit({
          action: "SUBJECT_UPDATED",
          afterState: {
            currentStage: "RESOLVING_IDENTITY",
            recordVersion: 2,
            reviewState: "IDENTITY_REVIEW_REQUIRED",
          },
          afterVersion: 2,
          beforeState: {
            currentStage: "RESOLVING_IDENTITY",
            recordVersion: 1,
            reviewState: "NOT_REQUIRED",
          },
          beforeVersion: 1,
          id: ids.auditM02Job,
          metadata: { guardKey: "6".repeat(64), scope: "IDENTITY_RESOLUTION" },
          subjectId: ids.job,
          subjectType: "M02_JOB",
        }),
      ].sort((left, right) => left.id.localeCompare(right.id));
      const domainMutationPlan = {
        schemaVersion: "1",
        allocatedIds: [
          ids.operation,
          ids.result,
          ...creates.map((entry) => entry.primaryKey),
          ...audits.map((entry) => entry.id),
        ].sort(),
        operation: {
          id: ids.operation,
          values: {
            operation_kind: "SYSTEM_IDENTITY_PROJECTION",
            automatic_projector_mode_id: "S6_JR",
            source_snapshot_id: "snapshot_system",
            candidate_id: ids.candidate,
            controlling_job_id: ids.job,
            reconciled_classification_run_id: "run_system",
            classification_run_input_fingerprint: "2".repeat(64),
            classification_run_output_fingerprint: "3".repeat(64),
            classification_policy_version: "classification-v1",
            identity_policy_version: "identity-v1",
            analysis_policy_version: "analysis-v1",
            parser_profile_version: "parser-v1",
            prompt_bundle_version: "prompt-v1",
            analysis_run_id: null,
            analysis_run_request_fingerprint: null,
            analysis_run_response_fingerprint: null,
            identity_decision_input_payload: `\\x${decisionInput.toString("hex")}`,
            identity_decision_input_fingerprint: sha256(decisionInput),
            system_replay_locator_payload: `\\x${replayLocator.toString("hex")}`,
            system_replay_lookup_key: sha256(replayLocator),
            idempotency_scope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
            idempotency_key: sha256(idempotencyPayload),
            idempotency_payload: `\\x${idempotencyPayload.toString("hex")}`,
            system_expected_versions: expectedVersions,
            system_expected_versions_payload: `\\x${canonicalPayload(expectedVersions).toString("hex")}`,
            system_operation_request_payload: `\\x${operationRequest.toString("hex")}`,
            system_operation_fingerprint: sha256(operationRequest),
            system_actor_id: "m02-resolver",
            actor_type: "SYSTEM",
            actor_role: null,
            created_at: occurredAt,
          },
        },
        creates,
        updates,
        supersedes: [],
        audits,
        result: {
          id: ids.result,
          values: {
            system_operation_id: ids.operation,
            status: "ACCEPTED",
            automatic_projector_mode_id: "S6_JR",
            candidate_id: ids.candidate,
            controlling_job_id: ids.job,
            source_snapshot_id: "snapshot_system",
            identity_decision_id: ids.decision,
            resource_identity_id: null,
            resource_version_identity_id: null,
            duplicate_candidate_id: null,
            handoff_marker_id: null,
            accepted_audit_event_id: ids.auditAccepted,
            accepted_at: occurredAt,
          },
        },
        postconditions,
      } satisfies JsonValue;
      const mutationPlan = canonicalPayload({
        schemaVersion: "1",
        concurrencyPlan: {
          schemaVersion: "1",
          automaticProjectorModeId: "S6_JR",
          authorityFingerprint: "4".repeat(64),
          identityDecisionInputFingerprint: sha256(decisionInput),
          systemOperationFingerprint: sha256(operationRequest),
          systemExpectedVersions: expectedVersions,
          guards: [],
          affectedRows: Object.entries(expectedVersions).map(([rowKey, recordVersion]) => ({
            rowKey,
            recordVersion,
          })),
        },
        domainMutationPlan,
      });
      const metadata = canonicalJson(metadataValue);

      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO m02_system_identity_operations
             (id, automatic_projector_mode_id, source_snapshot_id, candidate_id,
              controlling_job_id, reconciled_classification_run_id,
              classification_run_input_fingerprint, classification_run_output_fingerprint,
              classification_policy_version, identity_policy_version, analysis_policy_version,
              parser_profile_version, prompt_bundle_version, identity_decision_input_payload,
              identity_decision_input_fingerprint, system_replay_locator_payload,
              system_replay_lookup_key, idempotency_key, idempotency_payload,
              system_expected_versions, system_expected_versions_payload,
              system_operation_request_payload, system_operation_fingerprint,
              system_actor_id, created_at)
           VALUES ($1, 'S6_JR', 'snapshot_system', $2, $3, 'run_system', $4, $5,
             'classification-v1', 'identity-v1', 'analysis-v1', 'parser-v1', 'prompt-v1',
             $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, 'm02-resolver', $16)`,
          [
            ids.operation,
            ids.candidate,
            ids.job,
            "2".repeat(64),
            "3".repeat(64),
            decisionInput,
            sha256(decisionInput),
            replayLocator,
            sha256(replayLocator),
            sha256(idempotencyPayload),
            idempotencyPayload,
            JSON.stringify(expectedVersions),
            canonicalPayload(expectedVersions),
            operationRequest,
            sha256(operationRequest),
            occurredAt,
          ],
        );
        await client.query(
          `INSERT INTO m02_system_identity_results
             (id, system_operation_id, automatic_projector_mode_id, mutation_plan_payload,
              mutation_plan_fingerprint, candidate_id, controlling_job_id, source_snapshot_id,
              identity_decision_id, created_source_repository_ids,
              created_source_repository_url_ids,
              created_resource_identity_ids, created_resource_version_identity_ids,
              created_source_link_ids, created_observation_ids, created_duplicate_candidate_ids,
              created_identity_decision_ids, created_handoff_marker_ids,
              reused_source_repository_ids, reused_resource_identity_ids,
              reused_resource_version_identity_ids, reused_source_link_ids, reused_observation_ids,
              updated_resource_candidate_ids, updated_review_state_ids,
              updated_acquisition_job_ids, updated_m02_job_ids, superseded_source_link_ids,
              superseded_identity_decision_ids, superseded_handoff_marker_ids,
              superseded_duplicate_candidate_ids, created_identity_decision_tier_evaluation_ids,
              created_identity_decision_signal_ids, created_identity_decision_signal_evidence_ids,
              created_identity_decision_conflict_ids, created_identity_decision_conflict_target_ids,
              created_identity_decision_conflict_evidence_ids, final_candidate_state,
              final_review_state, final_acquisition_job_status, final_m02_job_status,
              final_m02_stage, accepted_audit_event_id, accepted_at)
           VALUES ($1, $2, 'S6_JR', $3, $4, $5::text, $6::text, 'snapshot_system', $7::text,
             '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], ARRAY[$7::uuid], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], ARRAY[$5::uuid], ARRAY[$8::uuid],
             ARRAY[$6::uuid], ARRAY[$6::uuid], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], $9::uuid[], '{}'::uuid[], '{}'::uuid[], ARRAY[$10::uuid],
             '{}'::uuid[], '{}'::uuid[],
             '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}'::jsonb,
             'IDENTITY_REVIEW_REQUIRED', 'OPERATOR_REVIEW_REQUIRED',
             'OPERATOR_REVIEW_REQUIRED', 'RESOLVING_IDENTITY', $11, $12)`,
          [
            ids.result,
            ids.operation,
            mutationPlan,
            sha256(mutationPlan),
            ids.candidate,
            ids.job,
            ids.decision,
            ids.review,
            ids.tiers,
            ids.conflict,
            ids.auditAccepted,
            occurredAt,
          ],
        );

        const insertAudit = async (input: {
          id: string;
          action: "SYSTEM_OPERATION_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED";
          subjectType: string;
          subjectId: string;
          beforeVersion?: number;
          afterVersion?: number;
          beforeState?: JsonValue;
          afterState?: JsonValue;
          metadata?: string;
        }) =>
          client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, system_operation_id, system_result_id, actor_type, actor_id,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, before_version, after_version,
                before_state, after_state, metadata, source_snapshot_id, controlling_job_id,
                occurred_at)
             VALUES ($1, 'SYSTEM_IDENTITY_OPERATION', $2, $3, 'SYSTEM', 'm02-resolver',
               $4, $5, $6, $2, 'M02_SYSTEM_IDENTITY_PROJECTION_V1', $7, 'S6_JR',
               'S6_JR', $8, $9, $10, $11, $12::jsonb, 'snapshot_system', $13,
               $14::timestamptz)`,
            [
              input.id,
              ids.operation,
              ids.result,
              input.action,
              input.subjectType,
              input.subjectId,
              sha256(idempotencyPayload),
              input.beforeVersion ?? null,
              input.afterVersion ?? null,
              input.beforeState === undefined ? null : canonicalJson(input.beforeState),
              input.afterState === undefined ? null : canonicalJson(input.afterState),
              input.metadata ?? "{}",
              ids.job,
              occurredAt,
            ],
          );

        await insertAudit({
          action: "SYSTEM_OPERATION_ACCEPTED",
          id: ids.auditAccepted,
          metadata,
          subjectId: ids.operation,
          subjectType: "SYSTEM_IDENTITY_OPERATION",
        });
        await insertAudit({
          action: "SUBJECT_CREATED",
          afterState: { recordVersion: 1, state: "ACTIVE" },
          afterVersion: 1,
          id: ids.auditDecision,
          metadata,
          subjectId: ids.decision,
          subjectType: "IDENTITY_DECISION",
        });
        await client.query(
          `INSERT INTO identity_decisions
             (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
              signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
              created_at, origin_type, system_operation_id, system_result_id, audit_event_id)
           VALUES ($1, $2, 'AMBIGUOUS_IDENTITY', 'identity-v1', 'DETERMINISTIC', '[]', '[]',
             $3::jsonb, $4, 'ACTIVE', $5::timestamptz, 'SYSTEM_IDENTITY_OPERATION', $6, $7, $8)`,
          [
            ids.decision,
            ids.candidate,
            JSON.stringify(conflicts),
            "8".repeat(64),
            occurredAt,
            ids.operation,
            ids.result,
            ids.auditDecision,
          ],
        );
        for (const [ordinal, tier] of tierSequence.entries()) {
          const auditId = `00000000-0000-0000-0000-00000000061${ordinal.toString()}`;
          const tierId = ids.tiers.at(ordinal);
          if (tierId === undefined) throw new Error("SYSTEM_TIER_ID_MISSING");
          await insertAudit({
            action: "SUBJECT_CREATED",
            id: auditId,
            subjectId: tierId,
            subjectType: "IDENTITY_DECISION_TIER_EVALUATION",
          });
          await client.query(
            `INSERT INTO identity_decision_tier_evaluations
               (id, identity_decision_id, ordinal, tier, evaluation_disposition,
                audit_event_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
            [
              ids.tiers[ordinal],
              ids.decision,
              ordinal,
              tier.tier,
              tier.evaluationDisposition,
              auditId,
              occurredAt,
            ],
          );
        }
        await insertAudit({
          action: "SUBJECT_CREATED",
          id: ids.auditConflict,
          subjectId: ids.conflict,
          subjectType: "IDENTITY_DECISION_CONFLICT",
        });
        await client.query(
          `INSERT INTO identity_decision_conflicts
             (id, identity_decision_id, ordinal, conflict_code, audit_event_id, created_at)
           VALUES ($1, $2, 0, 'MISSING_OR_UNRELIABLE_IDENTITY_TOKEN', $3, $4::timestamptz)`,
          [ids.conflict, ids.decision, ids.auditConflict, occurredAt],
        );

        await insertAudit({
          action: "SUBJECT_UPDATED",
          afterState: {
            identityOutcome: "AMBIGUOUS_IDENTITY",
            recordVersion: 2,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "IDENTITY_REVIEW_REQUIRED",
          },
          afterVersion: 2,
          beforeState: {
            identityOutcome: null,
            recordVersion: 1,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "CLASSIFIED",
          },
          beforeVersion: 1,
          id: ids.auditCandidate,
          subjectId: ids.candidate,
          subjectType: "RESOURCE_CANDIDATE",
        });
        await insertAudit({
          action: "SUBJECT_UPDATED",
          afterState: { recordVersion: 2, reviewState: "IDENTITY_REVIEW_REQUIRED" },
          afterVersion: 2,
          beforeState: { recordVersion: 1, reviewState: "NOT_REQUIRED" },
          beforeVersion: 1,
          id: ids.auditReview,
          subjectId: ids.review,
          subjectType: "M02_REVIEW_STATE",
        });
        await insertAudit({
          action: "SUBJECT_UPDATED",
          afterState: { recordVersion: 2, status: "OPERATOR_REVIEW_REQUIRED" },
          afterVersion: 2,
          beforeState: { recordVersion: 1, status: "ACTIVE" },
          beforeVersion: 1,
          id: ids.auditJob,
          subjectId: ids.job,
          subjectType: "ACQUISITION_JOB",
        });
        await insertAudit({
          action: "SUBJECT_UPDATED",
          afterState: {
            currentStage: "RESOLVING_IDENTITY",
            recordVersion: 2,
            reviewState: "IDENTITY_REVIEW_REQUIRED",
          },
          afterVersion: 2,
          beforeState: {
            currentStage: "RESOLVING_IDENTITY",
            recordVersion: 1,
            reviewState: "NOT_REQUIRED",
          },
          beforeVersion: 1,
          id: ids.auditM02Job,
          metadata: canonicalJson({ guardKey: "6".repeat(64), scope: "IDENTITY_RESOLUTION" }),
          subjectId: ids.job,
          subjectType: "M02_JOB",
        });
        await client.query(
          `UPDATE resource_candidates SET status = 'IDENTITY_REVIEW_REQUIRED',
             identity_outcome = 'AMBIGUOUS_IDENTITY', record_version = 2,
             updated_at = $2::timestamptz
           WHERE id = $1`,
          [ids.candidate, occurredAt],
        );
        await client.query(
          "UPDATE m02_review_states SET review_state = 'IDENTITY_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.review],
        );
        await client.query(
          "UPDATE acquisition_jobs SET status = 'OPERATOR_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.job],
        );
        await client.query(
          "UPDATE m02_jobs SET review_state = 'IDENTITY_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.job],
        );
        await client.query("SET CONSTRAINTS ALL IMMEDIATE");
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      expect(
        (
          await client.query<{ count: string }>(
            "SELECT count(*) FROM m02_system_identity_results WHERE id = $1",
            [ids.result],
          )
        ).rows[0]?.count,
      ).toBe("1");

      const systemAuditInsert = `INSERT INTO m02_audit_events
        (id, origin_type, system_operation_id, system_result_id, actor_type, actor_id,
         action, subject_type, subject_id, request_id, idempotency_scope, idempotency_key,
         reason_code, reason_text, before_version, after_version, before_state, after_state,
         metadata_schema_version, metadata, source_snapshot_id, controlling_job_id, occurred_at)
        VALUES ($1, 'SYSTEM_IDENTITY_OPERATION', $2, $3, 'SYSTEM', 'm02-resolver',
          $4, $5, $6, $2, 'M02_SYSTEM_IDENTITY_PROJECTION_V1', $7, 'S6_JR', 'S6_JR',
          $8, $9, $10, $11, $12, $13::jsonb, 'snapshot_system', $14, now())`;
      await expect(
        client.query(systemAuditInsert, [
          "00000000-0000-0000-0000-000000000621",
          ids.operation,
          ids.result,
          "SUBJECT_CREATED",
          "IDENTITY_DECISION",
          ids.decision,
          sha256(idempotencyPayload),
          null,
          1,
          null,
          canonicalJson({ recordVersion: 1, state: "ACTIVE" }),
          "1",
          canonicalJson({
            automaticProjectorModeId: "S7_JR",
            evaluatedTierSequence: tierSequence,
            identityDecisionInputFingerprint: sha256(decisionInput),
          }),
          ids.job,
        ]),
      ).rejects.toThrow(/M02_SYSTEM_AUDIT_METADATA_MISMATCH/iu);
      await expect(
        client.query(systemAuditInsert, [
          "00000000-0000-0000-0000-000000000622",
          ids.operation,
          ids.result,
          "SUBJECT_UPDATED",
          "RESOURCE_CANDIDATE",
          ids.candidate,
          sha256(idempotencyPayload),
          1,
          2,
          canonicalJson({ recordVersion: 1, status: "CLASSIFIED" }),
          canonicalJson({ recordVersion: 2, status: "IDENTITY_REVIEW_REQUIRED" }),
          "m02-audit-v1",
          "{}",
          ids.job,
        ]),
      ).rejects.toThrow(/check constraint/iu);
      await expect(
        client.query(systemAuditInsert, [
          "00000000-0000-0000-0000-000000000623",
          ids.operation,
          ids.result,
          "SUBJECT_UPDATED",
          "RESOURCE_CANDIDATE",
          ids.candidate,
          sha256(idempotencyPayload),
          1,
          2,
          canonicalJson({ recordVersion: 1, status: "CLASSIFIED" }),
          canonicalJson({ recordVersion: 2, status: "IDENTITY_REVIEW_REQUIRED" }),
          "1",
          "{}",
          ids.job,
        ]),
      ).rejects.toThrow(/M02_SYSTEM_RESULT_AUDIT_FORMULA_MISMATCH/iu);

      await expect(
        client.query(
          `INSERT INTO m02_system_identity_results
             (id, system_operation_id, automatic_projector_mode_id, mutation_plan_payload,
              mutation_plan_fingerprint, candidate_id, controlling_job_id, source_snapshot_id,
              identity_decision_id, created_source_repository_ids,
              created_source_repository_url_ids,
              created_resource_identity_ids, created_resource_version_identity_ids,
              created_source_link_ids, created_observation_ids, created_duplicate_candidate_ids,
              created_identity_decision_ids, created_handoff_marker_ids,
              reused_source_repository_ids, reused_resource_identity_ids,
              reused_resource_version_identity_ids, reused_source_link_ids, reused_observation_ids,
              updated_resource_candidate_ids, updated_review_state_ids,
              updated_acquisition_job_ids, updated_m02_job_ids, superseded_source_link_ids,
              superseded_identity_decision_ids, superseded_handoff_marker_ids,
              superseded_duplicate_candidate_ids, created_identity_decision_tier_evaluation_ids,
              created_identity_decision_signal_ids, created_identity_decision_signal_evidence_ids,
              created_identity_decision_conflict_ids, created_identity_decision_conflict_target_ids,
              created_identity_decision_conflict_evidence_ids, final_candidate_state,
              final_review_state, final_acquisition_job_status, final_m02_job_status,
              final_m02_stage, accepted_audit_event_id, accepted_at)
           SELECT gen_random_uuid()::text, system_operation_id, automatic_projector_mode_id,
             mutation_plan_payload, mutation_plan_fingerprint, candidate_id, controlling_job_id,
             source_snapshot_id, identity_decision_id, created_source_repository_ids,
             created_source_repository_url_ids,
             created_resource_identity_ids, created_resource_version_identity_ids,
             created_source_link_ids, created_observation_ids, created_duplicate_candidate_ids,
             created_identity_decision_ids, created_handoff_marker_ids,
             reused_source_repository_ids, reused_resource_identity_ids,
             reused_resource_version_identity_ids, reused_source_link_ids, reused_observation_ids,
             ARRAY[$2::uuid, $2::uuid], updated_review_state_ids,
             updated_acquisition_job_ids, updated_m02_job_ids, superseded_source_link_ids,
             superseded_identity_decision_ids, superseded_handoff_marker_ids,
             superseded_duplicate_candidate_ids, created_identity_decision_tier_evaluation_ids,
             created_identity_decision_signal_ids, created_identity_decision_signal_evidence_ids,
             created_identity_decision_conflict_ids, created_identity_decision_conflict_target_ids,
             created_identity_decision_conflict_evidence_ids, final_candidate_state,
             final_review_state, final_acquisition_job_status, final_m02_job_status,
             final_m02_stage, accepted_audit_event_id, now()
           FROM m02_system_identity_results WHERE id = $1`,
          [ids.result, ids.candidate],
        ),
      ).rejects.toThrow(/check constraint|duplicate key/iu);

      await client.query("BEGIN");
      try {
        await client.query(
          `UPDATE resource_candidates
           SET identity_outcome = 'FORK_OF_EXISTING_RESOURCE', updated_at = now()
             , record_version = record_version + 1
           WHERE id = $1`,
          [ids.candidate],
        );
        await expect(
          client.query("SET CONSTRAINTS resource_candidates_identity_projection_guard IMMEDIATE"),
        ).rejects.toThrow(/M02_SYSTEM_CANDIDATE_PROJECTION_MISMATCH/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const rejectionRequest = canonicalPayload({
        commandType: "REJECT_CANDIDATE",
        schemaVersion: "1",
        targetCandidateId: ids.candidate,
      });
      const humanDecisionMetadata = canonicalJson({
        evaluatedTierSequence: ["P1", "P2", "P3", "P4", "P5", "P6"].map((tier) => ({
          evaluationDisposition: "NO_MATCH",
          tier,
        })),
      });
      const executeRejectionAfterS6 = async (
        candidateBeforeState: string,
        candidateAfterState: string,
      ) => {
        await client.query("BEGIN");
        try {
          await client.query(
            `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason,
              target_candidate_id, request_payload, created_at)
           VALUES ('command_reject_after_s6', 'request_reject_after_s6', 'REJECT_CANDIDATE',
             'M02', 'reject-after-s6', 'actor_human', 'EDITOR', '{}', $1, $2, $3,
             'IDENTITY_AMBIGUITY_RESOLVED', 'Human rejects the active S6 ambiguity',
             $4, $5, now())`,
            [
              canonicalPayload({}),
              sha256(rejectionRequest),
              "a".repeat(64),
              ids.candidate,
              rejectionRequest,
            ],
          );
          await client.query(
            `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
           VALUES ('result_reject_after_s6', 'command_reject_after_s6',
             'request_reject_after_s6', $1, $2, $3, $4::jsonb, '{}', '{}', now())`,
            [
              sha256(rejectionRequest),
              "b".repeat(64),
              "a".repeat(64),
              JSON.stringify([ids.candidate]),
            ],
          );
          await client.query(
            `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, occurred_at)
           VALUES ('audit_reject_after_s6_accept', 'HUMAN_COMMAND',
             'command_reject_after_s6', 'result_reject_after_s6', 'HUMAN', 'actor_human',
             'EDITOR', 'COMMAND_ACCEPTED', 'MANUAL_RESOLUTION_COMMAND',
             'command_reject_after_s6', 'request_reject_after_s6', 'M02',
             'reject-after-s6', 'IDENTITY_AMBIGUITY_RESOLVED',
             'Human rejects the active S6 ambiguity', now())`,
          );
          await client.query(
            `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, metadata, occurred_at)
           VALUES ('audit_reject_after_s6_decision', 'HUMAN_COMMAND',
             'command_reject_after_s6', 'result_reject_after_s6', 'HUMAN', 'actor_human',
             'EDITOR', 'SUBJECT_SUPERSEDED', 'IDENTITY_DECISION', $1,
             'request_reject_after_s6', 'M02', 'reject-after-s6',
             'IDENTITY_AMBIGUITY_RESOLVED', 'Human rejects the active S6 ambiguity',
             1, 2, '{"recordVersion":1,"state":"ACTIVE"}',
             '{"recordVersion":2,"state":"SUPERSEDED"}', $2::jsonb, now())`,
            [ids.decision, humanDecisionMetadata],
          );
          await client.query(
            `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, after_version, after_state,
              occurred_at)
           VALUES ('audit_reject_after_s6_rejection', 'HUMAN_COMMAND',
             'command_reject_after_s6', 'result_reject_after_s6', 'HUMAN', 'actor_human',
             'EDITOR', 'SUBJECT_CREATED', 'M02_REJECTION_DECISION',
             'rejection_after_s6', 'request_reject_after_s6', 'M02', 'reject-after-s6',
             'IDENTITY_AMBIGUITY_RESOLVED', 'Human rejects the active S6 ambiguity',
             1, '{"recordVersion":1,"state":"ACTIVE"}', now())`,
          );
          await client.query(
            `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, occurred_at)
           VALUES ('audit_reject_after_s6_candidate', 'HUMAN_COMMAND',
             'command_reject_after_s6', 'result_reject_after_s6', 'HUMAN', 'actor_human',
             'EDITOR', 'SUBJECT_UPDATED', 'RESOURCE_CANDIDATE', $1,
             'request_reject_after_s6', 'M02', 'reject-after-s6',
             'IDENTITY_AMBIGUITY_RESOLVED', 'Human rejects the active S6 ambiguity',
             2, 3, $2, $3, now())`,
            [ids.candidate, candidateBeforeState, candidateAfterState],
          );
          await client.query(
            `INSERT INTO m02_candidate_rejection_decisions
             (id, resource_candidate_id, controlling_job_id, classification_run_id,
              source_snapshot_id, command_id, result_id, audit_event_id, evidence_ids,
              actor_id, actor_role, reason_code, reason_text, state, created_at)
           VALUES ('rejection_after_s6', $1, $2, 'run_system', 'snapshot_system',
             'command_reject_after_s6', 'result_reject_after_s6',
             'audit_reject_after_s6_rejection', '[]', 'actor_human', 'EDITOR',
             'IDENTITY_AMBIGUITY_RESOLVED', 'Human rejects the active S6 ambiguity',
             'ACTIVE', now())`,
            [ids.candidate, ids.job],
          );
          await client.query(
            `UPDATE identity_decisions SET state = 'SUPERSEDED', record_version = 2,
             replacement_command_id = 'command_reject_after_s6',
             replacement_result_id = 'result_reject_after_s6',
             replacement_audit_event_id = 'audit_reject_after_s6_decision'
           WHERE id = $1`,
            [ids.decision],
          );
          await client.query(
            `UPDATE resource_candidates SET status = 'REJECTED', identity_outcome = NULL,
             resource_identity_id = NULL, resource_version_identity_id = NULL,
             record_version = 3, updated_at = now() WHERE id = $1`,
            [ids.candidate],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      };
      const rejectionBeforeState = canonicalJson({
        identityOutcome: "AMBIGUOUS_IDENTITY",
        recordVersion: 2,
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "IDENTITY_REVIEW_REQUIRED",
      });
      const rejectionAfterState = canonicalJson({
        identityOutcome: null,
        recordVersion: 3,
        resourceIdentityId: null,
        resourceVersionIdentityId: null,
        status: "REJECTED",
      });
      await expect(
        executeRejectionAfterS6(
          canonicalJson({
            identityOutcome: "AMBIGUOUS_IDENTITY",
            recordVersion: 2,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "CLASSIFIED",
          }),
          rejectionAfterState,
        ),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await expect(
        executeRejectionAfterS6(
          rejectionBeforeState,
          canonicalJson({
            identityOutcome: null,
            recordVersion: 3,
            resourceIdentityId: null,
            resourceVersionIdentityId: null,
            status: "IDENTITY_RESOLVED",
          }),
        ),
      ).rejects.toThrow(/M02_HUMAN_CANDIDATE_AUDIT_MISMATCH/iu);
      await executeRejectionAfterS6(rejectionBeforeState, rejectionAfterState);

      expect(
        (
          await client.query<{ state: string }>(
            "SELECT state FROM identity_decisions WHERE id = $1",
            [ids.decision],
          )
        ).rows[0]?.state,
      ).toBe("SUPERSEDED");

      const assertDeferredChildFailure = async (sql: string, message: RegExp) => {
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await expect(
            client.query("SET CONSTRAINTS identity_decision_children_order_guard IMMEDIATE"),
          ).rejects.toThrow(message);
        } finally {
          await client.query("ROLLBACK");
        }
      };
      await assertDeferredChildFailure(
        `INSERT INTO identity_decision_signals
           (id, identity_decision_id, ordinal, tier, signal_type, audit_event_id, created_at)
         VALUES ('00000000-0000-0000-0000-000000000701', '${ids.decision}', 1, 'P5',
           'P5_SOURCE_NAME', '${ids.auditConflict}', now())`,
        /IDENTITY_DECISION_CHILD_ORDINAL_GAP/iu,
      );
      await assertDeferredChildFailure(
        `INSERT INTO identity_decision_signals
           (id, identity_decision_id, ordinal, tier, signal_type, audit_event_id, created_at)
         VALUES ('00000000-0000-0000-0000-000000000702', '${ids.decision}', 0, 'P5',
           'P5_SOURCE_NAME', '${ids.auditConflict}', now()),
           ('00000000-0000-0000-0000-000000000703', '${ids.decision}', 1, 'P1',
           'P1_ACTIVE_SOURCE_LINK', '${ids.auditConflict}', now())`,
        /IDENTITY_DECISION_CHILD_ORDER_INVALID/iu,
      );
      await client.query(
        `INSERT INTO m01_source_entries
           (id, source_snapshot_id, original_path, normalized_path, entry_kind, byte_length,
            disposition, reason_codes, content_fingerprint)
         VALUES ('entry_delimiter_a', 'snapshot_system', 'a', 'a', 'file', 1, 'ACQUIRED', '[]', $1),
           ('entry_delimiter_b', 'snapshot_system', 'b', 'b', 'file', 1, 'ACQUIRED', '[]', $2)`,
        ["c".repeat(64), "d".repeat(64)],
      );
      const delimiterEvidenceId = `evidence${String.fromCharCode(31)}suffix`;
      await client.query(
        `INSERT INTO classification_evidence_references
           (id, classification_run_id, source_snapshot_id, source_entry_id, evidence_order)
         VALUES ($1, 'run_system', 'snapshot_system', 'entry_delimiter_a', 0),
           ('evidence', 'run_system', 'snapshot_system', 'entry_delimiter_b', 1)`,
        [delimiterEvidenceId],
      );
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO identity_decision_signals
             (id, identity_decision_id, ordinal, tier, signal_type, audit_event_id, created_at)
           VALUES ('00000000-0000-0000-0000-000000000704', $1, 0, 'P1',
             'P1_ACTIVE_SOURCE_LINK', $2, now())`,
          [ids.decision, ids.auditConflict],
        );
        await client.query(
          `INSERT INTO identity_decision_signal_evidence
             (id, signal_id, ordinal, evidence_reference_id, audit_event_id, created_at)
           VALUES ('00000000-0000-0000-0000-000000000705',
             '00000000-0000-0000-0000-000000000704', 0, $1, $3, now()),
             ('00000000-0000-0000-0000-000000000706',
             '00000000-0000-0000-0000-000000000704', 1, $2, $3, now())`,
          [delimiterEvidenceId, "evidence", ids.auditConflict],
        );
        await expect(
          client.query("SET CONSTRAINTS identity_decision_children_order_guard IMMEDIATE"),
        ).rejects.toThrow(/IDENTITY_DECISION_CHILD_ORDER_INVALID/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO identity_decision_conflicts
             (id, identity_decision_id, ordinal, conflict_code, audit_event_id, created_at)
           VALUES ('00000000-0000-0000-0000-000000000707', $1, 1,
             'MISSING_OR_UNRELIABLE_IDENTITY_TOKEN', $2, now())`,
          [ids.decision, ids.auditConflict],
        );
        await client.query(
          `INSERT INTO identity_decision_conflict_evidence
             (id, conflict_id, ordinal, evidence_reference_id, audit_event_id, created_at)
           VALUES ('00000000-0000-0000-0000-000000000708',
             '00000000-0000-0000-0000-000000000707', 0, 'evidence', $1, now())`,
          [ids.auditConflict],
        );
        await expect(
          client.query("SET CONSTRAINTS identity_decision_children_order_guard IMMEDIATE"),
        ).rejects.toThrow(/IDENTITY_DECISION_CONFLICT_SEMANTIC_DUPLICATE/iu);
      } finally {
        await client.query("ROLLBACK");
      }

      const evaluateS8Fixture = async (decisionId: string, p4Disposition: string) => {
        await client.query("BEGIN");
        try {
          await client.query(
            `INSERT INTO source_repository_identities
               (id, provider, provider_repository_id, first_observed_source_snapshot_id,
                created_at, origin_type, system_operation_id, system_result_id, audit_event_id)
             SELECT '00000000-0000-0000-0000-000000000709', provider,
               provider_repository_id, id, now(), 'SYSTEM_IDENTITY_OPERATION', $1, $2, $3
             FROM source_snapshots WHERE id = 'snapshot_system'`,
            [ids.operation, ids.result, ids.auditConflict],
          );
          await client.query(
            `INSERT INTO identity_decisions
               (id, resource_candidate_id, outcome, matched_tier, identity_policy_version,
                decision_source, signals, rejected_lower_tier_signals, conflicts,
                audit_fingerprint, state, created_at, origin_type, system_operation_id,
                system_result_id, audit_event_id)
             VALUES ($1, $2, 'FORK_OF_EXISTING_RESOURCE', 'P3', 'identity-v1',
               'DETERMINISTIC', '[]', '[]', '[]', $3, 'ACTIVE', now(),
               'SYSTEM_IDENTITY_OPERATION', $4, $5, $6)`,
            [
              decisionId,
              ids.candidateNegative,
              "d".repeat(64),
              ids.operation,
              ids.result,
              ids.auditConflict,
            ],
          );
          const dispositions = [
            "NO_MATCH",
            "NO_MATCH",
            "MATCH",
            p4Disposition,
            "NOT_APPLICABLE",
            "NOT_APPLICABLE",
          ];
          for (const [ordinal, disposition] of dispositions.entries()) {
            await client.query(
              `INSERT INTO identity_decision_tier_evaluations
                 (id, identity_decision_id, ordinal, tier, evaluation_disposition,
                  audit_event_id, created_at)
               VALUES (gen_random_uuid(), $2, $1, 'P' || ($1 + 1), $3, $4, now())`,
              [ordinal, decisionId, disposition, ids.auditConflict],
            );
          }
          await client.query(
            `INSERT INTO identity_decision_signals
               (id, identity_decision_id, ordinal, tier, signal_type, target_type,
                source_repository_id, audit_event_id, created_at)
             VALUES ('00000000-0000-0000-0000-000000000720', $1, 0, 'P3',
               'P3_PROVIDER_DECLARED_FORK_PROVENANCE', 'SOURCE_REPOSITORY',
               '00000000-0000-0000-0000-000000000709', $2, now())`,
            [decisionId, ids.auditConflict],
          );
          await client.query(
            `INSERT INTO identity_decision_signal_evidence
               (id, signal_id, ordinal, evidence_reference_id, audit_event_id, created_at)
             VALUES ('00000000-0000-0000-0000-000000000721',
               '00000000-0000-0000-0000-000000000720', 0, 'evidence', $1, now())`,
            [ids.auditConflict],
          );
          const result = await client.query<{ valid: boolean }>(
            "SELECT m02_system_s8_tier_semantics_valid($1) AS valid",
            [decisionId],
          );
          return result.rows[0]?.valid;
        } finally {
          await client.query("ROLLBACK");
        }
      };
      expect(
        await evaluateS8Fixture("00000000-0000-0000-0000-000000000730", "NOT_APPLICABLE"),
      ).toBe(true);
      expect(await evaluateS8Fixture("00000000-0000-0000-0000-000000000731", "NO_MATCH")).toBe(
        false,
      );

      const negativeTierSequence = tierSequence.slice(0, 5);
      const negativeTierIds = [
        "00000000-0000-0000-0000-000000000811",
        "00000000-0000-0000-0000-000000000812",
        "00000000-0000-0000-0000-000000000813",
        "00000000-0000-0000-0000-000000000814",
        "00000000-0000-0000-0000-000000000815",
      ];
      const negativeDecisionInput = canonicalPayload({
        analysisPolicyVersion: "analysis-v1",
        analysisRunIdOrNull: null,
        analysisRunRequestFingerprintOrNull: null,
        analysisRunResponseFingerprintOrNull: null,
        candidateContentFingerprint: "5".repeat(64),
        candidateId: ids.candidateNegative,
        candidateRootFingerprint: "4".repeat(64),
        classificationPolicyVersion: "classification-v1",
        classificationRunInputFingerprint: "2".repeat(64),
        classificationRunOutputFingerprint: "3".repeat(64),
        conflicts,
        evaluatedTierSequence: negativeTierSequence,
        identityPolicyVersion: "identity-v1",
        parserProfileVersion: "parser-v1",
        promptBundleVersion: "prompt-v1",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        trustedSignals: [],
      });
      const negativeReplay = canonicalPayload({
        candidateId: ids.candidateNegative,
        classificationPolicyVersion: "classification-v1",
        controllingJobId: ids.jobNegative,
        identityPolicyVersion: "identity-v1",
        reconciledClassificationRunId: "run_system",
        replayScope: "M02_SYSTEM_IDENTITY_REPLAY_V1",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        systemActorId: "m02-resolver",
      });
      const negativeIdempotency = canonicalPayload({
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidateNegative,
        controllingJobId: ids.jobNegative,
        identityDecisionInputFingerprint: sha256(negativeDecisionInput),
        identityPolicyVersion: "identity-v1",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
      });
      const negativeRequest = canonicalPayload({
        SystemExpectedVersions: {},
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidateNegative,
        controllingJobId: ids.jobNegative,
        idempotencyKey: sha256(negativeIdempotency),
        idempotencyScope: "M02_SYSTEM_IDENTITY_PROJECTION_V1",
        identityDecisionInputFingerprint: sha256(negativeDecisionInput),
        identityPolicyVersion: "identity-v1",
        operationKind: "SYSTEM_IDENTITY_PROJECTION",
        reconciledClassificationRunId: "run_system",
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        systemActorId: "m02-resolver",
        systemReplayLookupKey: sha256(negativeReplay),
      });
      const negativeMutation = canonicalPayload({
        automaticProjectorModeId: "S6_JR",
        candidateId: ids.candidateNegative,
        controllingJobId: ids.jobNegative,
        createdDuplicateCandidateIds: [],
        createdHandoffMarkerIds: [],
        createdIdentityDecisionConflictEvidenceIds: [],
        createdIdentityDecisionConflictIds: [ids.conflictNegative],
        createdIdentityDecisionConflictTargetIds: [],
        createdIdentityDecisionIds: [ids.decisionNegative],
        createdIdentityDecisionSignalEvidenceIds: [],
        createdIdentityDecisionSignalIds: [],
        createdIdentityDecisionTierEvaluationIds: negativeTierIds,
        createdObservationIds: [],
        createdResourceIdentityIds: [],
        createdResourceVersionIdentityIds: [],
        createdSourceLinkIds: [],
        createdSourceRepositoryIds: [],
        createdSourceRepositoryUrlIds: [],
        duplicateCandidateIdOrNull: null,
        finalAcquisitionJobStatus: "OPERATOR_REVIEW_REQUIRED",
        finalCandidateState: {
          identityOutcome: "AMBIGUOUS_IDENTITY",
          recordVersion: 2,
          resourceIdentityId: null,
          resourceVersionIdentityId: null,
          status: "IDENTITY_REVIEW_REQUIRED",
        },
        finalM02JobStatus: "OPERATOR_REVIEW_REQUIRED",
        finalM02Stage: "RESOLVING_IDENTITY",
        finalReviewState: "IDENTITY_REVIEW_REQUIRED",
        handoffMarkerIdOrNull: null,
        identityDecisionId: ids.decisionNegative,
        resourceIdentityIdOrNull: null,
        resourceVersionIdentityIdOrNull: null,
        reusedObservationIds: [],
        reusedResourceIdentityIds: [],
        reusedResourceVersionIdentityIds: [],
        reusedSourceLinkIds: [],
        reusedSourceRepositoryIds: [],
        schemaVersion: "1",
        sourceSnapshotId: "snapshot_system",
        supersededDuplicateCandidateIds: [],
        supersededHandoffMarkerIds: [],
        supersededIdentityDecisionIds: [],
        supersededSourceLinkIds: [],
        updatedAcquisitionJobIds: [ids.jobNegative],
        updatedM02JobIds: [ids.jobNegative],
        updatedResourceCandidateIds: [ids.candidateNegative],
        updatedReviewStateIds: [ids.reviewNegative],
      });
      await client.query("BEGIN");
      try {
        await client.query(
          `INSERT INTO identity_decisions
             (id, resource_candidate_id, outcome, identity_policy_version, decision_source,
              signals, rejected_lower_tier_signals, conflicts, audit_fingerprint, state,
              created_at, origin_type, system_operation_id, system_result_id, audit_event_id)
           VALUES ($1, $2, 'AMBIGUOUS_IDENTITY', 'identity-v1', 'DETERMINISTIC', '[]', '[]',
             $3::jsonb, $4, 'ACTIVE', now(), 'SYSTEM_IDENTITY_OPERATION', $5, $6, $7)`,
          [
            ids.decisionNegative,
            ids.candidateNegative,
            JSON.stringify(conflicts),
            "9".repeat(64),
            ids.operationNegative,
            ids.resultNegative,
            "00000000-0000-0000-0000-000000000851",
          ],
        );
        for (const [ordinal, tier] of negativeTierSequence.entries()) {
          await client.query(
            `INSERT INTO identity_decision_tier_evaluations
               (id, identity_decision_id, ordinal, tier, evaluation_disposition,
                audit_event_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())`,
            [
              negativeTierIds[ordinal],
              ids.decisionNegative,
              ordinal,
              tier.tier,
              tier.evaluationDisposition,
              `00000000-0000-0000-0000-00000000086${ordinal.toString()}`,
            ],
          );
        }
        await client.query(
          `INSERT INTO identity_decision_conflicts
             (id, identity_decision_id, ordinal, conflict_code, audit_event_id, created_at)
           VALUES ($1, $2, 0, 'MISSING_OR_UNRELIABLE_IDENTITY_TOKEN', $3, now())`,
          [ids.conflictNegative, ids.decisionNegative, "00000000-0000-0000-0000-000000000852"],
        );
        await client.query(
          `INSERT INTO m02_system_identity_operations
             (id, automatic_projector_mode_id, source_snapshot_id, candidate_id,
              controlling_job_id, reconciled_classification_run_id,
              classification_run_input_fingerprint, classification_run_output_fingerprint,
              classification_policy_version, identity_policy_version, analysis_policy_version,
              parser_profile_version, prompt_bundle_version, identity_decision_input_payload,
              identity_decision_input_fingerprint, system_replay_locator_payload,
              system_replay_lookup_key, idempotency_key, idempotency_payload,
              system_expected_versions, system_expected_versions_payload,
              system_operation_request_payload, system_operation_fingerprint,
              system_actor_id, created_at)
           VALUES ($1, 'S6_JR', 'snapshot_system', $2, $3, 'run_system', $4, $5,
             'classification-v1', 'identity-v1', 'analysis-v1', 'parser-v1', 'prompt-v1',
             $6, $7, $8, $9, $10, $11, '{}', convert_to('{}', 'UTF8'), $12, $13,
             'm02-resolver', now())`,
          [
            ids.operationNegative,
            ids.candidateNegative,
            ids.jobNegative,
            "2".repeat(64),
            "3".repeat(64),
            negativeDecisionInput,
            sha256(negativeDecisionInput),
            negativeReplay,
            sha256(negativeReplay),
            sha256(negativeIdempotency),
            negativeIdempotency,
            negativeRequest,
            sha256(negativeRequest),
          ],
        );
        await client.query(
          `INSERT INTO m02_system_identity_results
             (id, system_operation_id, automatic_projector_mode_id, mutation_plan_payload,
              mutation_plan_fingerprint, candidate_id, controlling_job_id, source_snapshot_id,
              identity_decision_id, created_source_repository_ids,
              created_source_repository_url_ids, created_resource_identity_ids,
              created_resource_version_identity_ids, created_source_link_ids,
              created_observation_ids, created_duplicate_candidate_ids,
              created_identity_decision_ids, created_handoff_marker_ids,
              reused_source_repository_ids, reused_resource_identity_ids,
              reused_resource_version_identity_ids, reused_source_link_ids, reused_observation_ids,
              updated_resource_candidate_ids, updated_review_state_ids,
              updated_acquisition_job_ids, updated_m02_job_ids, superseded_source_link_ids,
              superseded_identity_decision_ids, superseded_handoff_marker_ids,
              superseded_duplicate_candidate_ids, created_identity_decision_tier_evaluation_ids,
              created_identity_decision_signal_ids, created_identity_decision_signal_evidence_ids,
              created_identity_decision_conflict_ids, created_identity_decision_conflict_target_ids,
              created_identity_decision_conflict_evidence_ids, final_candidate_state,
              final_review_state, final_acquisition_job_status, final_m02_job_status,
              final_m02_stage, accepted_audit_event_id, accepted_at)
           VALUES ($1, $2, 'S6_JR', $3, $4, $5::text, $6::text, 'snapshot_system', $7::text,
             '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], '{}'::uuid[], ARRAY[$7::uuid], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], '{}'::uuid[], ARRAY[$5::uuid],
             ARRAY[$8::uuid], ARRAY[$6::uuid], ARRAY[$6::uuid], '{}'::uuid[], '{}'::uuid[],
             '{}'::uuid[], '{}'::uuid[], $9::uuid[], '{}'::uuid[], '{}'::uuid[],
             ARRAY[$10::uuid], '{}'::uuid[], '{}'::uuid[],
             '{"identityOutcome":"AMBIGUOUS_IDENTITY","recordVersion":2,"resourceIdentityId":null,"resourceVersionIdentityId":null,"status":"IDENTITY_REVIEW_REQUIRED"}'::jsonb,
             'IDENTITY_REVIEW_REQUIRED', 'OPERATOR_REVIEW_REQUIRED',
             'OPERATOR_REVIEW_REQUIRED', 'RESOLVING_IDENTITY', $11, now())`,
          [
            ids.resultNegative,
            ids.operationNegative,
            negativeMutation,
            sha256(negativeMutation),
            ids.candidateNegative,
            ids.jobNegative,
            ids.decisionNegative,
            ids.reviewNegative,
            negativeTierIds,
            ids.conflictNegative,
            "00000000-0000-0000-0000-000000000850",
          ],
        );
        const negativeMetadata = canonicalJson({
          automaticProjectorModeId: "S6_JR",
          evaluatedTierSequence: tierSequence,
          identityDecisionInputFingerprint: sha256(negativeDecisionInput),
        });
        const insertNegativeAudit = (input: {
          id: string;
          action: "SYSTEM_OPERATION_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED";
          subjectType: string;
          subjectId: string;
          beforeVersion?: number;
          afterVersion?: number;
          beforeState?: JsonValue;
          afterState?: JsonValue;
          metadata?: string;
        }) =>
          client.query(
            `INSERT INTO m02_audit_events
               (id, origin_type, system_operation_id, system_result_id, actor_type, actor_id,
                action, subject_type, subject_id, request_id, idempotency_scope,
                idempotency_key, reason_code, reason_text, before_version, after_version,
                before_state, after_state, metadata, source_snapshot_id, controlling_job_id,
                occurred_at)
             VALUES ($1, 'SYSTEM_IDENTITY_OPERATION', $2, $3, 'SYSTEM', 'm02-resolver',
               $4, $5, $6, $2, 'M02_SYSTEM_IDENTITY_PROJECTION_V1', $7, 'S6_JR',
               'S6_JR', $8, $9, $10, $11, $12::jsonb, 'snapshot_system', $13, now())`,
            [
              input.id,
              ids.operationNegative,
              ids.resultNegative,
              input.action,
              input.subjectType,
              input.subjectId,
              sha256(negativeIdempotency),
              input.beforeVersion ?? null,
              input.afterVersion ?? null,
              input.beforeState === undefined ? null : canonicalJson(input.beforeState),
              input.afterState === undefined ? null : canonicalJson(input.afterState),
              input.metadata ?? "{}",
              ids.jobNegative,
            ],
          );
        await insertNegativeAudit({
          action: "SYSTEM_OPERATION_ACCEPTED",
          id: "00000000-0000-0000-0000-000000000850",
          metadata: negativeMetadata,
          subjectId: ids.operationNegative,
          subjectType: "SYSTEM_IDENTITY_OPERATION",
        });
        await insertNegativeAudit({
          action: "SUBJECT_CREATED",
          afterState: { recordVersion: 1, state: "ACTIVE" },
          afterVersion: 1,
          id: "00000000-0000-0000-0000-000000000851",
          metadata: negativeMetadata,
          subjectId: ids.decisionNegative,
          subjectType: "IDENTITY_DECISION",
        });
        for (const [ordinal, tierId] of negativeTierIds.entries()) {
          await insertNegativeAudit({
            action: "SUBJECT_CREATED",
            id: `00000000-0000-0000-0000-00000000086${ordinal.toString()}`,
            subjectId: tierId,
            subjectType: "IDENTITY_DECISION_TIER_EVALUATION",
          });
        }
        await insertNegativeAudit({
          action: "SUBJECT_CREATED",
          id: "00000000-0000-0000-0000-000000000852",
          subjectId: ids.conflictNegative,
          subjectType: "IDENTITY_DECISION_CONFLICT",
        });
        const updates = [
          {
            afterState: {
              identityOutcome: "AMBIGUOUS_IDENTITY",
              recordVersion: 2,
              resourceIdentityId: null,
              resourceVersionIdentityId: null,
              status: "IDENTITY_REVIEW_REQUIRED",
            },
            beforeState: {
              identityOutcome: null,
              recordVersion: 1,
              resourceIdentityId: null,
              resourceVersionIdentityId: null,
              status: "CLASSIFIED",
            },
            id: "00000000-0000-0000-0000-000000000853",
            subjectId: ids.candidateNegative,
            subjectType: "RESOURCE_CANDIDATE",
          },
          {
            afterState: { recordVersion: 2, reviewState: "IDENTITY_REVIEW_REQUIRED" },
            beforeState: { recordVersion: 1, reviewState: "NOT_REQUIRED" },
            id: "00000000-0000-0000-0000-000000000854",
            subjectId: ids.reviewNegative,
            subjectType: "M02_REVIEW_STATE",
          },
          {
            afterState: { recordVersion: 2, status: "OPERATOR_REVIEW_REQUIRED" },
            beforeState: { recordVersion: 1, status: "ACTIVE" },
            id: "00000000-0000-0000-0000-000000000855",
            subjectId: ids.jobNegative,
            subjectType: "ACQUISITION_JOB",
          },
          {
            afterState: {
              currentStage: "RESOLVING_IDENTITY",
              recordVersion: 2,
              reviewState: "IDENTITY_REVIEW_REQUIRED",
            },
            beforeState: {
              currentStage: "RESOLVING_IDENTITY",
              recordVersion: 1,
              reviewState: "NOT_REQUIRED",
            },
            id: "00000000-0000-0000-0000-000000000856",
            subjectId: ids.jobNegative,
            subjectType: "M02_JOB",
          },
        ] satisfies {
          afterState: JsonValue;
          beforeState: JsonValue;
          id: string;
          subjectId: string;
          subjectType: string;
        }[];
        for (const update of updates) {
          await insertNegativeAudit({
            ...update,
            action: "SUBJECT_UPDATED",
            afterVersion: 2,
            beforeVersion: 1,
            ...(update.subjectType === "M02_JOB"
              ? {
                  metadata: canonicalJson({
                    guardKey: "a".repeat(64),
                    scope: "IDENTITY_RESOLUTION",
                  }),
                }
              : {}),
          });
        }
        await client.query(
          `UPDATE resource_candidates SET status = 'IDENTITY_REVIEW_REQUIRED',
             identity_outcome = 'AMBIGUOUS_IDENTITY', record_version = 2, updated_at = now()
           WHERE id = $1`,
          [ids.candidateNegative],
        );
        await client.query(
          "UPDATE m02_review_states SET review_state = 'IDENTITY_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.reviewNegative],
        );
        await client.query(
          "UPDATE acquisition_jobs SET status = 'OPERATOR_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.jobNegative],
        );
        await client.query(
          "UPDATE m02_jobs SET review_state = 'IDENTITY_REVIEW_REQUIRED', record_version = 2 WHERE id = $1",
          [ids.jobNegative],
        );
        await expect(client.query("COMMIT")).rejects.toThrow(
          /IDENTITY_DECISION_REQUIRES_EXACT_SIX_TIERS/iu,
        );
      } finally {
        await client.query("ROLLBACK");
      }
    });
  }, 120_000);

  it("rejects legacy job-controller arrays and authorizes canonical object supersession", async () => {
    await withSchema("m02_job_guard_authority", async (client) => {
      await client.query(migration001);
      await client.query(migration002);

      const legacyPayload = canonicalPayload({
        components: ["lineage_guard", "CLASSIFICATION"],
        guardType: "JOB_SCOPE_CONTROLLER",
      });
      await expect(
        client.query(
          `INSERT INTO m02_concurrency_guards
             (guard_key, guard_type, canonical_payload, payload_hash)
           VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)`,
          [guardKey("JOB_SCOPE_CONTROLLER", legacyPayload), legacyPayload, sha256(legacyPayload)],
        ),
      ).rejects.toThrow(/check constraint/iu);

      const canonicalGuardPayload = canonicalPayload({
        components: {
          jobLineageId: "lineage_guard",
          operationScope: "CLASSIFICATION",
        },
        guardType: "JOB_SCOPE_CONTROLLER",
      });
      const canonicalGuardKey = guardKey("JOB_SCOPE_CONTROLLER", canonicalGuardPayload);
      const expectedVersions = {
        [canonicalGuardKey]: 1,
        "row:acquisition_jobs:job_guard_source": 1,
        "row:m02_jobs:job_guard_source": 1,
      } satisfies JsonValue;
      const requestPayload = canonicalPayload({
        commandType: "REPLACE_M02_JOB",
        schemaVersion: "1",
        sourceJobId: "job_guard_source",
      });

      await client.query("BEGIN");
      try {
        await client.query("SET CONSTRAINTS ALL DEFERRED");
        await client.query(
          `INSERT INTO source_snapshots
             (id, identity_key, provider, provider_repository_id, immutable_revision,
              acquisition_policy_version, acquired_at)
           VALUES ('snapshot_guard', 'github:guard:rev', 'github', 'guard', $1,
             'm01-v1', now())`,
          ["9".repeat(40)],
        );
        await client.query(
          `INSERT INTO acquisition_jobs
             (id, submission_id, idempotency_key, status, current_stage, attempt,
              source_snapshot_id)
           VALUES
             ('job_guard_source', 'lineage_guard', 'request_guard_source', 'FAILED',
              'INVENTORYING_SOURCE', 1, 'snapshot_guard'),
             ('job_guard_replacement', 'lineage_guard', 'request_guard_replacement', 'ACTIVE',
              'RECEIVED', 1, 'snapshot_guard')`,
        );
        await client.query(
          `INSERT INTO m02_jobs
             (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage,
              review_state, supersession_state, supersession_sequence, job_scope_key,
              input_fingerprint, classification_policy_version, identity_policy_version,
              analysis_policy_version, prompt_bundle_version)
           VALUES ('job_guard_source', 'lineage_guard', 'snapshot_guard', 'CLASSIFICATION',
             'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 1, $1, $2,
             'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')`,
          ["1".repeat(64), "2".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_concurrency_guards
             (guard_key, guard_type, canonical_payload, payload_hash)
           VALUES ($1, 'JOB_SCOPE_CONTROLLER', $2, $3)`,
          [canonicalGuardKey, canonicalGuardPayload, sha256(canonicalGuardPayload)],
        );
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason, command_payload,
              request_payload, created_at)
           VALUES ('command_guard_replace', 'request_guard_replace', 'REPLACE_M02_JOB',
             'M02', 'guard-replace', 'actor_guard', 'ADMIN', $1, $2, $3, $4,
             'FAILED_STAGE_REPLACEMENT', 'Replace failed classification job',
             '{"sourceJobId":"job_guard_source"}', $5, now())`,
          [
            JSON.stringify(expectedVersions),
            canonicalPayload(expectedVersions),
            sha256(requestPayload),
            "3".repeat(64),
            requestPayload,
          ],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
           VALUES ('result_guard_replace', 'command_guard_replace', 'request_guard_replace',
             $1, $2, $3, '["job_guard_source","job_guard_replacement"]', '{}', '{}', now())`,
          [sha256(requestPayload), "4".repeat(64), "3".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, occurred_at)
           VALUES ('audit_guard_accept', 'HUMAN_COMMAND', 'command_guard_replace',
             'result_guard_replace', 'HUMAN', 'actor_guard', 'ADMIN', 'COMMAND_ACCEPTED',
             'MANUAL_RESOLUTION_COMMAND', 'command_guard_replace', 'request_guard_replace',
             'M02', 'guard-replace', 'FAILED_STAGE_REPLACEMENT',
             'Replace failed classification job', now())`,
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, metadata, occurred_at)
           VALUES ('audit_guard_supersession', 'HUMAN_COMMAND', 'command_guard_replace',
             'result_guard_replace', 'HUMAN', 'actor_guard', 'ADMIN', 'SUBJECT_SUPERSEDED',
             'M02_JOB', 'job_guard_source', 'request_guard_replace', 'M02', 'guard-replace',
             'FAILED_STAGE_REPLACEMENT', 'Replace failed classification job', 1, 2,
             '{"recordVersion":1,"status":"CONTROLLING"}',
             '{"recordVersion":2,"status":"SUPERSEDED","supersededByJobId":"job_guard_replacement"}',
             $1, now())`,
          [JSON.stringify({ guardKey: canonicalGuardKey, scope: "CLASSIFICATION" })],
        );
        await client.query(
          `UPDATE acquisition_jobs SET record_version = 2 WHERE id = 'job_guard_source'`,
        );
        await client.query(
          `UPDATE m02_jobs SET supersession_state = 'SUPERSEDED',
             superseded_by_job_id = 'job_guard_replacement', record_version = 2
           WHERE id = 'job_guard_source'`,
        );
        await client.query(
          `INSERT INTO m02_jobs
             (id, job_lineage_id, source_snapshot_id, operation_scope, current_stage,
              review_state, supersession_state, supersession_sequence, job_scope_key,
              input_fingerprint, classification_policy_version, identity_policy_version,
              analysis_policy_version, prompt_bundle_version)
           VALUES ('job_guard_replacement', 'lineage_guard', 'snapshot_guard',
             'CLASSIFICATION', 'CLASSIFYING_REPOSITORY', 'NOT_REQUIRED', 'CONTROLLING', 2,
             $1, $2, 'classification-v1', 'identity-v1', 'analysis-v1', 'prompt-v1')`,
          ["5".repeat(64), "6".repeat(64)],
        );
        await client.query(
          `UPDATE m02_concurrency_guards SET record_version = 2 WHERE guard_key = $1`,
          [canonicalGuardKey],
        );
        await client.query("SAVEPOINT legacy_expected_version_key");
        const legacyExpectedVersions = {
          [canonicalGuardKey]: 1,
          "job:job_guard_source": 1,
          "row:acquisition_jobs:job_guard_source": 1,
        } satisfies JsonValue;
        await client.query(
          `INSERT INTO manual_resolution_commands
             (id, request_id, command_type, idempotency_scope, idempotency_key, actor_id,
              actor_role, expected_versions, caller_expected_versions_payload,
              request_fingerprint, result_fingerprint, reason_code, reason, command_payload,
              request_payload, created_at)
           VALUES ('command_guard_legacy_key', 'request_guard_legacy_key', 'REPLACE_M02_JOB',
             'M02', 'guard-legacy-key', 'actor_guard', 'ADMIN', $1, $2, $3, $4,
             'FAILED_STAGE_REPLACEMENT', 'Reject obsolete job expectation key',
             '{"sourceJobId":"job_guard_source"}', $5, now())`,
          [
            JSON.stringify(legacyExpectedVersions),
            canonicalPayload(legacyExpectedVersions),
            sha256(requestPayload),
            "7".repeat(64),
            requestPayload,
          ],
        );
        await client.query(
          `INSERT INTO m02_manual_command_results
             (id, command_id, request_id, request_fingerprint, mutation_plan_fingerprint,
              result_fingerprint, ordered_target_ids, record_versions, result_payload, created_at)
           VALUES ('result_guard_legacy_key', 'command_guard_legacy_key',
             'request_guard_legacy_key', $1, $2, $3,
             '["job_guard_source","job_guard_replacement"]', '{}', '{}', now())`,
          [sha256(requestPayload), "8".repeat(64), "7".repeat(64)],
        );
        await client.query(
          `INSERT INTO m02_audit_events
             (id, origin_type, command_id, result_id, actor_type, actor_id, actor_role,
              action, subject_type, subject_id, request_id, idempotency_scope,
              idempotency_key, reason_code, reason_text, before_version, after_version,
              before_state, after_state, metadata, occurred_at)
           VALUES ('audit_guard_legacy_key', 'HUMAN_COMMAND', 'command_guard_legacy_key',
             'result_guard_legacy_key', 'HUMAN', 'actor_guard', 'ADMIN',
             'SUBJECT_SUPERSEDED', 'M02_JOB', 'job_guard_source',
             'request_guard_legacy_key', 'M02', 'guard-legacy-key',
             'FAILED_STAGE_REPLACEMENT', 'Reject obsolete job expectation key', 1, 2,
             '{"recordVersion":1,"status":"CONTROLLING"}',
             '{"recordVersion":2,"status":"SUPERSEDED","supersededByJobId":"job_guard_replacement"}',
             $1, now())`,
          [JSON.stringify({ guardKey: canonicalGuardKey, scope: "CLASSIFICATION" })],
        );
        await client.query(
          `INSERT INTO m02_job_supersessions
             (id, command_id, result_id, audit_event_id, guard_key, source_job_id,
              replacement_job_id, job_lineage_id, operation_scope, supersession_state,
              reason_code, actor_id, actor_role, evidence_ids, supersession_sequence, created_at)
           VALUES ('supersession_guard_legacy_key', 'command_guard_legacy_key',
             'result_guard_legacy_key', 'audit_guard_legacy_key', $1,
             'job_guard_source', 'job_guard_replacement', 'lineage_guard', 'CLASSIFICATION',
             'SUPERSEDED', 'FAILED_STAGE_REPLACEMENT', 'actor_guard', 'ADMIN', '[]', 2,
             now())`,
          [canonicalGuardKey],
        );
        await expect(
          client.query("SET CONSTRAINTS m02_job_supersessions_authorization_guard IMMEDIATE"),
        ).rejects.toThrow(/UNAUTHORIZED_M02_SUPERSESSION/iu);
        await client.query("ROLLBACK TO SAVEPOINT legacy_expected_version_key");
        await client.query("SET CONSTRAINTS m02_job_supersessions_authorization_guard DEFERRED");
        await client.query(
          `INSERT INTO m02_job_supersessions
             (id, command_id, result_id, audit_event_id, guard_key, source_job_id,
              replacement_job_id, job_lineage_id, operation_scope, supersession_state,
              reason_code, actor_id, actor_role, evidence_ids, supersession_sequence, created_at)
           VALUES ('supersession_guard', 'command_guard_replace', 'result_guard_replace',
             'audit_guard_supersession', $1, 'job_guard_source', 'job_guard_replacement',
             'lineage_guard', 'CLASSIFICATION', 'SUPERSEDED', 'FAILED_STAGE_REPLACEMENT',
             'actor_guard', 'ADMIN', '[]', 2, now())`,
          [canonicalGuardKey],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      expect(
        (
          await client.query<{ count: string }>(
            "SELECT count(*) FROM m02_job_supersessions WHERE id = 'supersession_guard'",
          )
        ).rows[0]?.count,
      ).toBe("1");
    });
  }, 120_000);
});
