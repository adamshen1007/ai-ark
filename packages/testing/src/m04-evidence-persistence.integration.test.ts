import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  canonicalJsonM03,
  deriveM03ExtractionIdV2,
  StructuredExtractionBundleV2Schema,
  type EvidenceBindingRequestV1,
  type StructuredExtractionBundleV2,
} from "@ai-ark/contracts";
import {
  m03LogicalProjection,
  projectEvidenceBinding,
  recomputeM03OutputFingerprint,
  type EvidenceBindingCandidateV1,
} from "@ai-ark/evidence";
import { PostgresEvidencePersistenceAdapterV1 } from "@ai-ark/job-queue";
import { Client, Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript migration module is exercised directly by this integration test.
import { loadMigrations, renderMigrationSql } from "../../../scripts/db-common.mjs";
import { seedM02ProductionGraph } from "./m02-postgres-fixture.js";
import {
  M03_GENUINE_ACQUISITION_RESULT,
  M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
  M03_GENUINE_FIXTURE_TIMESTAMPS,
  createGenuineM03BundleFixture,
  createGenuineM03EmptyBundleFixture,
} from "./m03-genuine-bundle-fixture.js";
import { EphemeralPostgresHarness } from "./postgres-harness.js";

const sha = "a".repeat(64);
const revision = "b".repeat(40);
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytes = (value: unknown) => Buffer.from(canonicalJsonM03(value), "utf8");
function reidentify<T extends { id: string; recordFingerprint: string }>(
  record: T,
  prefix: string,
): T {
  const { id: _oldId, recordFingerprint: _oldFingerprint, ...base } = record;
  void _oldId;
  void _oldFingerprint;
  const id = `${prefix}${hash(bytes(base))}`;
  const withId = { ...base, id };
  return { ...withId, recordFingerprint: hash(bytes(withId)) } as T;
}
const expectedPredecessorState = M03_GENUINE_EXPECTED_PREDECESSOR_STATE;

async function bundle(): Promise<StructuredExtractionBundleV2> {
  return createGenuineM03BundleFixture();
}

async function bundleWithFileMetadata(): Promise<StructuredExtractionBundleV2> {
  const original = await createGenuineM03BundleFixture();
  const document = original.sourceReferences.find((reference) => reference.kind === "DOCUMENT");
  if (document === undefined) throw new Error("M04_METADATA_DOCUMENT_REQUIRED");
  const excerpt = '{"byteLength":64}';
  const metadataReference = {
    ...document,
    id: `src_${hash("m04-file-metadata-reference-v1")}`,
    locator: {
      type: "FILE_METADATA" as const,
      path: "SKILL.md",
      owningRecord: "SOURCE_ENTRY" as const,
      metadataKey: "byteLength" as const,
    },
    excerptHashOrNull: hash(excerpt),
    excerptOrNull: excerpt,
  };
  const analysisResultFingerprint = hash("m04-file-metadata-analysis-v1");
  const amended = {
    ...original,
    analysisResultFingerprint,
    extractionId: deriveM03ExtractionIdV2({
      m02: original.m02,
      inputFingerprint: original.inputFingerprint,
      analysisResultFingerprint,
    }),
    sourceReferences: [...original.sourceReferences, metadataReference].sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    ),
  } as StructuredExtractionBundleV2;
  return StructuredExtractionBundleV2Schema.parse({
    ...amended,
    outputFingerprint: recomputeM03OutputFingerprint(amended),
  });
}

async function candidate(
  idempotencyKey: string,
  resourceIdentityId = "resource-existing",
  suppliedBundle?: StructuredExtractionBundleV2,
): Promise<EvidenceBindingCandidateV1> {
  const value = suppliedBundle ?? (await bundle());
  const request: EvidenceBindingRequestV1 = {
    schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
    idempotencyKey,
    extractionId: value.extractionId,
    expectedM03OutputFingerprint: value.outputFingerprint,
    expectedResourceIdentityId: resourceIdentityId,
    expectedResourceVersionIdentityId: "version-prior",
    expectedSourceSnapshotId: "snapshot-m04",
    expectedSourceRevision: revision,
    expectedPredecessorState,
    evidencePolicyVersion: "m04-evidence-policy-v1",
    materialFieldRegistryVersion: "m04-material-fields-v1",
  };
  const requestPayload = bytes(request);
  const semantic = { ...request };
  delete (semantic as Partial<EvidenceBindingRequestV1>).idempotencyKey;
  const bundlePayload = bytes(value);
  const logicalPayload = bytes(m03LogicalProjection(value));
  return {
    request,
    requestCanonicalPayload: requestPayload,
    requestFingerprint: hash(requestPayload),
    semanticRequestFingerprint: hash(bytes(semantic)),
    bundle: value,
    bundleCanonicalPayload: bundlePayload,
    bundleCanonicalSha256: hash(bundlePayload),
    logicalPayload,
    logicalPayloadSha256: hash(logicalPayload),
    ...projectEvidenceBinding(value),
  };
}

const harness = new EphemeralPostgresHarness();
let pool: Pool;
let runtimePool: Pool | undefined;

function activeRuntimePool(): Pool {
  if (runtimePool === undefined) throw new Error("M04_TEST_RUNTIME_POOL_NOT_READY");
  return runtimePool;
}
let adapter: PostgresEvidencePersistenceAdapterV1;
let acceptedCandidate: EvidenceBindingCandidateV1;
let firstExtractionId: string;
let emptyExtractionId: string;

async function readPredecessorAsRuntime(
  adapter: PostgresEvidencePersistenceAdapterV1,
  value: EvidenceBindingCandidateV1,
): Promise<{ current: boolean; subjectId?: string }> {
  const client = await activeRuntimePool().connect();
  try {
    const reader = adapter as unknown as {
      readPredecessor(
        connection: PoolClient,
        candidate: EvidenceBindingCandidateV1,
      ): Promise<{ current: boolean; subjectId?: string }>;
    };
    return await reader.readPredecessor(client, value);
  } finally {
    client.release();
  }
}

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method -- intentionally transparent fault-injection proxy */
function serializationFaultPool(
  base: Pool,
  failures: number,
  attempts: { count: number; readOnlyCount?: number },
  code = "40001",
): Pool {
  return {
    connect: async () => {
      const client = await base.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query")
            return async (...args: unknown[]) => {
              if (
                typeof args[0] === "string" &&
                args[0].startsWith("BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY")
              ) {
                if (attempts.readOnlyCount !== undefined) attempts.readOnlyCount += 1;
                return Reflect.apply(target.query, target, args);
              }
              if (
                typeof args[0] === "string" &&
                args[0].startsWith("BEGIN ISOLATION LEVEL SERIALIZABLE") &&
                attempts.count < failures
              ) {
                attempts.count += 1;
                throw Object.assign(new Error("synthetic serialization conflict"), {
                  code,
                });
              }
              if (
                typeof args[0] === "string" &&
                args[0].startsWith("BEGIN ISOLATION LEVEL SERIALIZABLE")
              )
                attempts.count += 1;
              return Reflect.apply(target.query, target, args);
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
function insertStageFaultPool(base: Pool, table: string): Pool {
  return {
    connect: async () => {
      const client = await base.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query")
            return async (...args: unknown[]) => {
              const query = args[0];
              const sql =
                typeof query === "string"
                  ? query
                  : typeof query === "object" && query !== null && "text" in query
                    ? query.text
                    : undefined;
              if (
                typeof sql === "string" &&
                sql.trimStart().startsWith(`INSERT INTO "m04_persistence".${table}`)
              )
                throw new Error(`synthetic insert-stage failure:${table}`);
              return Reflect.apply(target.query, target, args);
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
function partialLockFaultPool(base: Pool, locks: { count: number }): Pool {
  return {
    connect: async () => {
      const client = await base.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query")
            return async (...args: unknown[]) => {
              if (
                typeof args[0] === "string" &&
                args[0].startsWith("SELECT pg_advisory_xact_lock") &&
                ++locks.count === 2
              )
                throw new Error("synthetic partial transaction-lock failure");
              return Reflect.apply(target.query, target, args);
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
function rollbackBeforeCommitPool(base: Pool): Pool {
  return {
    connect: async () => {
      const client = await base.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query")
            return async (...args: unknown[]) => {
              if (typeof args[0] === "string" && args[0].trim() === "COMMIT")
                throw new Error("M04_TEST_FORCED_ROLLBACK");
              return Reflect.apply(target.query, target, args);
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
/* eslint-enable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */

describe("M04 durable evidence persistence", { concurrent: false }, () => {
  beforeAll(async () => {
    pool = await harness.start();
  }, 120_000);
  afterAll(async () => {
    try {
      await runtimePool?.end();
    } finally {
      await harness.stop();
    }
  });

  it("rejects authority drift and consumed-document predecessor changes", async () => {
    const client = await pool.connect();
    try {
      await client.query("CREATE SCHEMA m04_persistence");
      await client.query("SET search_path TO m04_persistence, public");
      for (const name of ["001_m01_acquisition_jobs.sql", "002_m02_classification_identity.sql"])
        await client.query(
          await readFile(new URL(`../../job-queue/migrations/${name}`, import.meta.url), "utf8"),
        );
      await seedM02ProductionGraph(pool, "m04_persistence");
      await client.query(
        `INSERT INTO source_snapshots(id,identity_key,provider,provider_repository_id,immutable_revision,acquisition_policy_version,acquired_at)
         VALUES ('snapshot-m04','m04-key','github','repo-1',$1,'acquisition-v1',$2)`,
        [revision, M03_GENUINE_FIXTURE_TIMESTAMPS.acquiredAt],
      );
      await client.query(
        `INSERT INTO m01_source_entries
           (id,source_snapshot_id,original_path,normalized_path,entry_kind,byte_length,
            disposition,reason_codes,content_fingerprint)
         VALUES ('entry-m04','snapshot-m04','SKILL.md','SKILL.md','file',64,'ACQUIRED','[]',$1)`,
        [sha],
      );
      await client.query(
        `INSERT INTO m01_source_documents
           (id,source_snapshot_id,source_entry_id,document_type,encoding,line_count,content_fingerprint)
         VALUES ('document-m04','snapshot-m04','entry-m04','UTF8_TEXT','utf-8',6,$1)`,
        [sha],
      );
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `UPDATE acquisition_jobs
              SET status='COMPLETED',current_stage='INVENTORYING_SOURCE',source_snapshot_id='snapshot-m04',
                  cancellation_requested=false,record_version=1
            WHERE id='job-1'`,
        );
        await client.query(
          `INSERT INTO acquisition_results(job_id,source_snapshot_id,result,created_at)
           VALUES ('job-1','snapshot-m04',$1::jsonb,$2)`,
          [
            JSON.stringify(M03_GENUINE_ACQUISITION_RESULT),
            M03_GENUINE_FIXTURE_TIMESTAMPS.acquisitionResultCreatedAt,
          ],
        );
        await client.query(
          `UPDATE repository_candidate_groups SET source_snapshot_id='snapshot-m04' WHERE id='group-1'`,
        );
        await client.query(
          `UPDATE repository_classification_runs SET source_snapshot_id='snapshot-m04' WHERE id='run-1'`,
        );
        await client.query(
          "DELETE FROM classification_evidence_references WHERE classification_run_id='run-1'",
        );
        await client.query(
          `UPDATE candidate_roots
              SET source_snapshot_id='snapshot-m04',normalized_root_path='.',
                  candidate_root_fingerprint=$1,candidate_content_fingerprint=$2,state='ACTIVE',record_version=1
            WHERE id='root-1'`,
          [sha, "c".repeat(64)],
        );
        await client.query(
          `UPDATE candidate_root_ownership
              SET source_snapshot_id='snapshot-m04',source_entry_id='entry-m04',ownership='OWNED'
            WHERE id='ownership-1'`,
        );
        await client.query(
          `UPDATE repository_candidate_root_order SET source_snapshot_id='snapshot-m04',root_ordinal=0
            WHERE id='root-order-1'`,
        );
        await client.query(
          `UPDATE resource_candidates
              SET source_snapshot_id='snapshot-m04',candidate_root_fingerprint=$1,
                  candidate_content_fingerprint=$2,identity_outcome='NEW_RESOURCE',status='IDENTITY_RESOLVED',
                  resource_identity_id='resource-existing',resource_version_identity_id='version-prior',
                  record_version=1
            WHERE id='candidate-1'`,
          [sha, "c".repeat(64)],
        );
        await client.query(
          `UPDATE resource_version_identities
              SET first_observed_source_snapshot_id='snapshot-m04',
                  first_observed_source_revision=$1,first_observed_candidate_root_id='root-1'
            WHERE first_observed_candidate_root_id='root-1'`,
          [revision],
        );
        await client.query(
          `UPDATE m02_jobs
              SET source_snapshot_id='snapshot-m04',operation_scope='FULL_PIPELINE',
                  current_stage='RESOLVING_IDENTITY',review_state='RESOLVED',
                  supersession_state='CONTROLLING',controlling_classification_decision_id='run-1',
                  record_version=1
            WHERE id='job-1'`,
        );
        await client.query(
          `UPDATE identity_decisions
              SET outcome='NEW_RESOURCE',matched_tier=NULL,confidence=1,
                  identity_policy_version='identity-v1',decision_source='HUMAN_COMMAND',state='ACTIVE',record_version=1
            WHERE id='decision-seed'`,
        );
        await client.query(
          `UPDATE m02_review_states
              SET group_id='group-1',resource_candidate_id='candidate-1',review_state='RESOLVED',
                  source_snapshot_id='snapshot-m04',controlling_job_id='job-1',
                  superseded_by_review_id=NULL,record_version=1
            WHERE id='review-1'`,
        );
        await client.query(
          `INSERT INTO resource_source_links
             (id,source_repository_id,normalized_root_path,target_resource_version_id,relationship,
              evidence_ids,decision_id,reason,actor_id,created_at,state,record_version,
              origin_type,command_id,result_id,audit_event_id)
           VALUES ('source-link-1','source-main','.','version-prior','PRIMARY','[]','decision-seed',
             'M04 integration fixture','fixture-editor',$1,'ACTIVE',1,
             'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed')`,
          [M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt],
        );
        await client.query(
          `INSERT INTO resource_version_observations
             (id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
              resource_source_link_id,source_repository_id,provider,provider_repository_id,
              normalized_root_path,immutable_revision,observed_at,
              origin_type,command_id,result_id,audit_event_id)
           VALUES ('observation-1','version-prior','snapshot-m04','root-1','source-link-1',
             'source-main','github','repo-1','.',$1,$2,
             'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed')`,
          [revision, M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt],
        );
        await client.query(
          `INSERT INTO m02_identity_handoff_markers
             (id,resource_candidate_id,resource_identity_id,resource_version_identity_id,
              controlling_m02_job_id,source_snapshot_id,identity_decision_id,origin_type,
              command_id,result_id,audit_event_id,logical_key,controlling_job_state,state,created_at,record_version)
           VALUES ('handoff-1','candidate-1','resource-existing','version-prior','job-1','snapshot-m04',
             'decision-seed','HUMAN_COMMAND','command-seed','result-seed','audit-command-seed',
             'handoff-key','CONTROLLING','ACTIVE',$1,1)`,
          [M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      const m04Migration = (await loadMigrations())[2];
      if (m04Migration === undefined) throw new Error("M04_MIGRATION_REQUIRED");
      await client.query(
        renderMigrationSql(m04Migration.sql, "m04_persistence", m04Migration.manifest),
      );
    } finally {
      client.release();
    }
    runtimePool = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m04_login"),
      max: 4,
    });
    adapter = await PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
      schema: "m04_persistence",
      loginRole: "ai_ark_m04_login",
      peerLoginRole: "ai_ark_m01_m02_login",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    await pool.query("GRANT ai_ark_m04_runtime TO ai_ark_m04_login WITH SET FALSE");
    await pool.query("GRANT ai_ark_m01_m02_writer TO ai_ark_m01_m02_login WITH SET FALSE");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).resolves.toBeInstanceOf(PostgresEvidencePersistenceAdapterV1);
      expect(
        await adapter.persistAccepted(
          await candidate("expected-memberships-set-false", "different-resource"),
        ),
      ).toMatchObject({ kind: "REJECTED", error: "PREDECESSOR_NOT_CURRENT" });
    } finally {
      await pool.query("GRANT ai_ark_m04_runtime TO ai_ark_m04_login WITH SET TRUE");
      await pool.query("GRANT ai_ark_m01_m02_writer TO ai_ark_m01_m02_login WITH SET TRUE");
    }
    await expect(
      PostgresEvidencePersistenceAdapterV1.open(pool, {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      }),
    ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    await pool.query("GRANT SELECT ON m04_persistence.acquisition_jobs TO ai_ark_m04_login");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      await pool.query("REVOKE SELECT ON m04_persistence.acquisition_jobs FROM ai_ark_m04_login");
    }
    await pool.query("REVOKE SELECT ON m04_persistence.acquisition_jobs FROM ai_ark_m04_runtime");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      await pool.query("GRANT SELECT ON m04_persistence.acquisition_jobs TO ai_ark_m04_runtime");
    }
    await pool.query(
      "GRANT USAGE ON SEQUENCE m04_persistence.m02_rejected_command_audits_id_seq TO ai_ark_m04_runtime",
    );
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      await pool.query(
        "REVOKE USAGE ON SEQUENCE m04_persistence.m02_rejected_command_audits_id_seq FROM ai_ark_m04_runtime",
      );
    }
    await pool.query("CREATE ROLE ai_ark_m04_hostile_role NOLOGIN");
    await pool.query("GRANT ai_ark_m04_hostile_role TO ai_ark_m04_login");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      await pool.query("REVOKE ai_ark_m04_hostile_role FROM ai_ark_m04_login");
      await pool.query("DROP ROLE ai_ark_m04_hostile_role");
    }
    await pool.query("ALTER ROLE ai_ark_m01_m02_login BYPASSRLS");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      expect(await adapter.persistAccepted(await candidate("peer-attribute-drift"))).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
    } finally {
      await pool.query("ALTER ROLE ai_ark_m01_m02_login NOBYPASSRLS");
    }
    await pool.query("CREATE ROLE ai_ark_m02_peer_bridge NOLOGIN");
    await pool.query("CREATE ROLE ai_ark_m02_peer_hostile NOLOGIN BYPASSRLS");
    await pool.query("GRANT ai_ark_m02_peer_hostile TO ai_ark_m02_peer_bridge");
    await pool.query("GRANT ai_ark_m02_peer_bridge TO ai_ark_m01_m02_login");
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      expect(await adapter.persistAccepted(await candidate("peer-membership-drift"))).toMatchObject(
        {
          kind: "FAILED",
          error: "PERSISTENCE_INTEGRITY_FAILED",
        },
      );
    } finally {
      await pool.query("REVOKE ai_ark_m02_peer_bridge FROM ai_ark_m01_m02_login");
      await pool.query("REVOKE ai_ark_m02_peer_hostile FROM ai_ark_m02_peer_bridge");
      await pool.query("DROP ROLE ai_ark_m02_peer_hostile");
      await pool.query("DROP ROLE ai_ark_m02_peer_bridge");
    }
    await pool.query("CREATE ROLE ai_ark_m02_peer_inert NOLOGIN");
    await pool.query(
      "GRANT ai_ark_m02_peer_inert TO ai_ark_m01_m02_login WITH INHERIT FALSE, SET FALSE",
    );
    try {
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
          schema: "m04_persistence",
          loginRole: "ai_ark_m04_login",
          peerLoginRole: "ai_ark_m01_m02_login",
        }),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      expect(await adapter.persistAccepted(await candidate("peer-inert-membership"))).toMatchObject(
        {
          kind: "FAILED",
          error: "PERSISTENCE_INTEGRITY_FAILED",
        },
      );
    } finally {
      await pool.query("REVOKE ai_ark_m02_peer_inert FROM ai_ark_m01_m02_login");
      await pool.query("DROP ROLE ai_ark_m02_peer_inert");
    }
    const shadowPool = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m04_login"),
      max: 1,
    });
    try {
      await shadowPool.query("CREATE TEMP TABLE m04_binding_requests(id text)");
      await expect(
        (
          await PostgresEvidencePersistenceAdapterV1.open(shadowPool, {
            schema: "m04_persistence",
            loginRole: "ai_ark_m04_login",
            peerLoginRole: "ai_ark_m01_m02_login",
          })
        ).persistAccepted(await candidate("temporary-shadow-safe", "different-resource")),
      ).resolves.toMatchObject({ kind: "REJECTED", error: "PREDECESSOR_NOT_CURRENT" });
      const shadowRows = await shadowPool.query(
        "SELECT count(*)::int count FROM pg_temp.m04_binding_requests",
      );
      expect(shadowRows.rows[0]?.count).toBe(0);
    } finally {
      await shadowPool.end();
    }
    await pool.query(
      "ALTER TABLE m04_persistence.m04_binding_requests RENAME TO m04_binding_requests_renamed",
    );
    await pool.query("CREATE TABLE m04_persistence.m04_binding_requests(id text)");
    try {
      expect(await adapter.persistAccepted(await candidate("renamed-oid-probe"))).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
    } finally {
      await pool.query("DROP TABLE m04_persistence.m04_binding_requests");
      await pool.query(
        "ALTER TABLE m04_persistence.m04_binding_requests_renamed RENAME TO m04_binding_requests",
      );
    }
    const originalSharedDefinition = (
      await pool.query<{ definition: string }>(
        `SELECT pg_get_functiondef(p.oid) definition FROM pg_proc p
          JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='m04_persistence' AND p.proname='m03_m04_lock_predecessor_shared'`,
      )
    ).rows[0]?.definition;
    if (originalSharedDefinition === undefined) throw new Error("M04_SHARED_FUNCTION_MISSING");
    await pool.query(
      `CREATE OR REPLACE FUNCTION m04_persistence.m03_m04_lock_predecessor_shared()
       RETURNS bigint LANGUAGE sql AS 'SELECT 0::bigint'`,
    );
    try {
      expect(
        await adapter.persistAccepted(await candidate("replaced-function-probe")),
      ).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
    } finally {
      await pool.query(originalSharedDefinition);
    }
    let swappedBetweenCheckAndExecute = false;
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method -- transparent query interception for a DDL race test */
    const functionSwapPool = {
      connect: async () => {
        const client = await activeRuntimePool().connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === "query")
              return async (...args: unknown[]) => {
                const query = args[0] as { text?: unknown } | undefined;
                if (
                  !swappedBetweenCheckAndExecute &&
                  query !== undefined &&
                  typeof query === "object" &&
                  typeof query.text === "string" &&
                  query.text.includes("to_regprocedure")
                ) {
                  swappedBetweenCheckAndExecute = true;
                  await pool.query(
                    `CREATE OR REPLACE FUNCTION m04_persistence.m03_m04_lock_predecessor_shared()
                     RETURNS bigint LANGUAGE sql AS 'SELECT 0::bigint'`,
                  );
                }
                return Reflect.apply(target.query, target, args);
              };
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    } as unknown as Pool;
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
    try {
      const swapAdapter = await PostgresEvidencePersistenceAdapterV1.open(functionSwapPool, {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      });
      expect(
        await swapAdapter.persistAccepted(
          await candidate("atomic-function-swap", "different-resource"),
        ),
      ).toMatchObject({ kind: "FAILED", error: "PERSISTENCE_INTEGRITY_FAILED" });
      expect(swappedBetweenCheckAndExecute).toBe(true);
    } finally {
      await pool.query(originalSharedDefinition);
    }
    let insertedBetweenCollisionAndPredecessor = false;
    /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method -- transparent query interception for a fenced source-mutation race */
    const sourceMutationPool = {
      connect: async () => {
        const client = await activeRuntimePool().connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === "query")
              return async (...args: unknown[]) => {
                const query = args[0] as { text?: unknown } | undefined;
                if (
                  !insertedBetweenCollisionAndPredecessor &&
                  query !== undefined &&
                  typeof query === "object" &&
                  typeof query.text === "string" &&
                  query.text.includes("to_regprocedure")
                ) {
                  insertedBetweenCollisionAndPredecessor = true;
                  await pool.query(
                    `INSERT INTO m04_persistence.m01_source_entries
                       (id,source_snapshot_id,original_path,normalized_path,entry_kind,byte_length,
                        disposition,reason_codes,content_fingerprint)
                     VALUES ('entry-fence-race','snapshot-m04','FENCE_RACE.md','FENCE_RACE.md',
                       'file',4,'ACQUIRED','[]',$1)`,
                    [hash("fence-race")],
                  );
                }
                return Reflect.apply(target.query, target, args);
              };
            const value = Reflect.get(target, property, target) as unknown;
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    } as unknown as Pool;
    /* eslint-enable @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method */
    try {
      const raceAdapter = await PostgresEvidencePersistenceAdapterV1.open(sourceMutationPool, {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      });
      const raceResult = await raceAdapter.persistAccepted(await candidate("fence-race-key"));
      expect(insertedBetweenCollisionAndPredecessor).toBe(true);
      expect(raceResult.kind).not.toBe("ACCEPTED");
    } finally {
      const cleanup = await pool.connect();
      try {
        await cleanup.query("SET session_replication_role=replica");
        await cleanup.query(
          "DELETE FROM m04_persistence.m01_source_entries WHERE id='entry-fence-race'",
        );
      } finally {
        await cleanup.query("SET session_replication_role=origin");
        cleanup.release();
      }
    }
    const probe = await candidate("probe-key");
    const consumedDocument = probe.bundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT",
    );
    if (consumedDocument === undefined) throw new Error("M04_DOCUMENT_REFERENCE_REQUIRED");
    const sourceClient = await pool.connect();
    try {
      await sourceClient.query("SET search_path TO m04_persistence, public");
      await sourceClient.query("SET session_replication_role=replica");
      try {
        await sourceClient.query(
          "UPDATE m01_source_entries SET content_fingerprint=$2 WHERE id=$1",
          [consumedDocument.sourceEntryId, consumedDocument.contentHash],
        );
        await sourceClient.query(
          "UPDATE m01_source_documents SET content_fingerprint=$2 WHERE id=$1",
          [consumedDocument.sourceDocumentId, consumedDocument.contentHash],
        );
      } finally {
        await sourceClient.query("SET session_replication_role=origin");
      }
      for (const [name, change, restore, subjectId] of [
        [
          "consumed entry disposition",
          "UPDATE m01_source_entries SET disposition='SKIPPED' WHERE id='entry-m04'",
          "UPDATE m01_source_entries SET disposition='ACQUIRED' WHERE id='entry-m04'",
          "entry-m04",
        ],
        [
          "consumed entry fingerprint",
          `UPDATE m01_source_entries SET content_fingerprint='${"d".repeat(64)}' WHERE id='entry-m04'`,
          `UPDATE m01_source_entries SET content_fingerprint='${consumedDocument.contentHash}' WHERE id='entry-m04'`,
          "entry-m04",
        ],
        [
          "consumed document fingerprint",
          `UPDATE m01_source_documents SET content_fingerprint='${"d".repeat(64)}' WHERE id='document-m04'`,
          `UPDATE m01_source_documents SET content_fingerprint='${consumedDocument.contentHash}' WHERE id='document-m04'`,
          "document-m04",
        ],
      ] as const) {
        await sourceClient.query("SET session_replication_role=replica");
        try {
          await sourceClient.query(change);
        } finally {
          await sourceClient.query("SET session_replication_role=origin");
        }
        expect(await readPredecessorAsRuntime(adapter, probe), name).toMatchObject({
          current: false,
          subjectId,
        });
        await sourceClient.query("SET session_replication_role=replica");
        try {
          await sourceClient.query(restore);
        } finally {
          await sourceClient.query("SET session_replication_role=origin");
        }
      }
    } finally {
      sourceClient.release();
    }
  }, 240_000);

  it("validates one genuine seven-surface candidate before a forced rollback", async () => {
    const probe = await candidate(
      "m04-closure-probe\u0000",
      "resource-existing",
      await createGenuineM03BundleFixture(1e-7, "Technical\u0000reviewers\u0000"),
    );
    expect(Buffer.from(probe.bundleCanonicalPayload).toString("utf8")).toContain("1e-7");
    expect(Buffer.from(probe.bundleCanonicalPayload).toString("utf8")).toContain("\\u0000");
    const rollbackAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      rollbackBeforeCommitPool(activeRuntimePool()),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    const direct = rollbackAdapter as unknown as {
      transaction(value: EvidenceBindingCandidateV1): Promise<unknown>;
    };
    await expect(direct.transaction(probe)).rejects.toThrow("M04_TEST_FORCED_ROLLBACK");
  }, 240_000);

  it("validates schema-legal FILE_METADATA excerpts without retaining them", async () => {
    const metadataBundle = await bundleWithFileMetadata();
    const metadataReference = metadataBundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT" && reference.locator.type === "FILE_METADATA",
    );
    if (metadataReference === undefined) throw new Error("M04_METADATA_REFERENCE_REQUIRED");
    const probe = await candidate("m04-metadata-probe", "resource-existing", metadataBundle);
    expect(
      probe.evidenceItems.find((item) => item.m03SourceReferenceId === metadataReference.id),
    ).toMatchObject({
      evidenceType: "FILE_STRUCTURE",
      excerptState: "NOT_APPLICABLE",
      excerptOrNull: null,
    });
    const rollbackAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      rollbackBeforeCommitPool(activeRuntimePool()),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    const direct = rollbackAdapter as unknown as {
      transaction(value: EvidenceBindingCandidateV1): Promise<unknown>;
    };
    await expect(direct.transaction(probe)).rejects.toThrow("M04_TEST_FORCED_ROLLBACK");
  }, 240_000);

  const staleCases = [
    [
      "acquisition controller",
      "UPDATE m04_persistence.acquisition_jobs SET status='ACTIVE' WHERE id='job-1'",
      "UPDATE m04_persistence.acquisition_jobs SET status='COMPLETED' WHERE id='job-1'",
      "job-1",
    ],
    [
      "handoff controller tuple",
      "UPDATE m04_persistence.m02_identity_handoff_markers SET state='SUPERSEDED',controlling_job_state=NULL WHERE id='handoff-1'",
      "UPDATE m04_persistence.m02_identity_handoff_markers SET state='ACTIVE',controlling_job_state='CONTROLLING' WHERE id='handoff-1'",
      "handoff-1",
    ],
    [
      "controlling M02 stage",
      "UPDATE m04_persistence.m02_jobs SET current_stage='CLASSIFYING_REPOSITORY' WHERE id='job-1'",
      "UPDATE m04_persistence.m02_jobs SET current_stage='RESOLVING_IDENTITY' WHERE id='job-1'",
      "job-1",
    ],
    [
      "candidate eligibility",
      "UPDATE m04_persistence.resource_candidates SET status='IDENTITY_REVIEW_REQUIRED',identity_outcome='AMBIGUOUS_IDENTITY' WHERE id='candidate-1'",
      "UPDATE m04_persistence.resource_candidates SET status='IDENTITY_RESOLVED',identity_outcome='NEW_RESOURCE' WHERE id='candidate-1'",
      "candidate-1",
    ],
    [
      "candidate policy tuple",
      "UPDATE m04_persistence.resource_candidates SET identity_policy_version='identity-drift' WHERE id='candidate-1'",
      "UPDATE m04_persistence.resource_candidates SET identity_policy_version='identity-v1' WHERE id='candidate-1'",
      "candidate-1",
    ],
    [
      "review state",
      "UPDATE m04_persistence.m02_review_states SET review_state='IDENTITY_REVIEW_REQUIRED' WHERE id='review-1'",
      "UPDATE m04_persistence.m02_review_states SET review_state='RESOLVED' WHERE id='review-1'",
      "review-1",
    ],
    [
      "resource identity",
      "UPDATE m04_persistence.resource_identities SET status='AMBIGUOUS' WHERE id='resource-existing'",
      "UPDATE m04_persistence.resource_identities SET status='ACTIVE' WHERE id='resource-existing'",
      "resource-existing",
    ],
    [
      "observation tuple",
      "UPDATE m04_persistence.resource_version_observations SET provider_repository_id='different' WHERE id='observation-1'",
      "UPDATE m04_persistence.resource_version_observations SET provider_repository_id='repo-1' WHERE id='observation-1'",
      "observation-1",
    ],
    [
      "version first-observed tuple",
      `UPDATE m04_persistence.resource_version_identities SET first_observed_source_revision='${"d".repeat(40)}' WHERE id='version-prior'`,
      `UPDATE m04_persistence.resource_version_identities SET first_observed_source_revision='${revision}' WHERE id='version-prior'`,
      "version-prior",
    ],
    [
      "source repository tuple",
      "UPDATE m04_persistence.source_repository_identities SET provider_repository_id='different' WHERE id='source-main'",
      "UPDATE m04_persistence.source_repository_identities SET provider_repository_id='repo-1' WHERE id='source-main'",
      "source-main",
    ],
    [
      "source link",
      "UPDATE m04_persistence.resource_source_links SET state='SUPERSEDED' WHERE id='source-link-1'",
      "UPDATE m04_persistence.resource_source_links SET state='ACTIVE' WHERE id='source-link-1'",
      "source-link-1",
    ],
    [
      "identity decision",
      "UPDATE m04_persistence.identity_decisions SET resource_candidate_id='different' WHERE id='decision-seed'",
      "UPDATE m04_persistence.identity_decisions SET resource_candidate_id='candidate-1' WHERE id='decision-seed'",
      "decision-seed",
    ],
    [
      "source revision",
      `UPDATE m04_persistence.source_snapshots SET immutable_revision='${"d".repeat(40)}' WHERE id='snapshot-m04'`,
      `UPDATE m04_persistence.source_snapshots SET immutable_revision='${revision}' WHERE id='snapshot-m04'`,
      "snapshot-m04",
    ],
    [
      "topology controller",
      "UPDATE m04_persistence.candidate_roots SET normalized_root_path='different' WHERE id='root-1'",
      "UPDATE m04_persistence.candidate_roots SET normalized_root_path='.' WHERE id='root-1'",
      "root-1",
    ],
  ] as const;
  it.each([
    [0, 5],
    [5, 10],
    [10, 14],
  ])(
    "rejects stale predecessor cases %i-%i",
    async (start, end) => {
      const probe = await candidate("probe-key");
      const staleClient = await pool.connect();
      try {
        for (const [name, change, restore, subjectId] of staleCases.slice(start, end)) {
          await staleClient.query("SET session_replication_role=replica");
          try {
            await staleClient.query(change);
          } finally {
            await staleClient.query("SET session_replication_role=origin");
          }
          expect(await adapter.persistAccepted(probe), name).toMatchObject({
            kind: "REJECTED",
            error: "PREDECESSOR_NOT_CURRENT",
            diagnostics: [{ subjectIdOrNull: subjectId }],
          });
          await staleClient.query("SET session_replication_role=replica");
          try {
            await staleClient.query(restore);
          } finally {
            await staleClient.query("SET session_replication_role=origin");
          }
        }
      } finally {
        staleClient.release();
      }
      await expect(readPredecessorAsRuntime(adapter, probe)).resolves.toEqual({ current: true });
    },
    240_000,
  );

  const versionCases = [
    ["acquisition_jobs", "job-1", "job-1", "acquisitionJob"],
    ["m02_jobs", "job-1", "job-1", "m02Job"],
    ["m02_identity_handoff_markers", "handoff-1", "handoff-1", "handoff"],
    ["resource_candidates", "candidate-1", "candidate-1", "candidate"],
    ["resource_identities", "resource-existing", "resource-existing", "resourceIdentity"],
    ["resource_version_identities", "version-prior", "version-prior", "resourceVersionIdentity"],
    ["resource_source_links", "source-link-1", "source-link-1", "sourceLink"],
    ["source_repository_identities", "source-main", "source-main", "sourceRepository"],
    ["identity_decisions", "decision-seed", "decision-seed", "identityDecision"],
    ["m02_review_states", "review-1", "review-1", "candidateReviewState"],
    ["candidate_roots", "root-1", "root-1", "candidateRoot"],
  ] as const;
  it.each([
    [0, 5],
    [5, 9],
    [9, 11],
  ])(
    "rejects predecessor version cases %i-%i",
    async (start, end) => {
      const probe = await candidate("probe-key");
      const staleClient = await pool.connect();
      try {
        for (const [table, id, subjectId, projectionKey] of versionCases.slice(start, end)) {
          await staleClient.query("SET session_replication_role=replica");
          try {
            await staleClient.query(
              `UPDATE m04_persistence.${table} SET record_version=2 WHERE id=$1`,
              [id],
            );
          } finally {
            await staleClient.query("SET session_replication_role=origin");
          }
          const expectedRow = probe.bundle.m02InputProjection[projectionKey];
          const actualRow = { ...expectedRow, recordVersion: "2" };
          expect(await adapter.persistAccepted(probe), `${table} version`).toMatchObject({
            kind: "REJECTED",
            error: "PREDECESSOR_NOT_CURRENT",
            diagnostics: [
              {
                subjectIdOrNull: subjectId,
                expectedFingerprintOrNull: hash(bytes(expectedRow)),
                actualFingerprintOrNull: hash(bytes(actualRow)),
              },
            ],
          });
          await staleClient.query("SET session_replication_role=replica");
          try {
            await staleClient.query(
              `UPDATE m04_persistence.${table} SET record_version=1 WHERE id=$1`,
              [id],
            );
          } finally {
            await staleClient.query("SET session_replication_role=origin");
          }
        }
      } finally {
        staleClient.release();
      }
      await expect(readPredecessorAsRuntime(adapter, probe)).resolves.toEqual({ current: true });
    },
    240_000,
  );

  const fingerprintCases = [
    [
      "source snapshot fingerprint",
      "UPDATE m04_persistence.source_snapshots SET acquired_at=acquired_at+interval '1 second' WHERE id='snapshot-m04'",
      "UPDATE m04_persistence.source_snapshots SET acquired_at=acquired_at-interval '1 second' WHERE id='snapshot-m04'",
      "snapshot-m04",
    ],
    [
      "acquisition result fingerprint",
      "UPDATE m04_persistence.acquisition_results SET created_at=created_at+interval '1 second' WHERE job_id='job-1'",
      "UPDATE m04_persistence.acquisition_results SET created_at=created_at-interval '1 second' WHERE job_id='job-1'",
      "job-1",
    ],
    [
      "observation fingerprint",
      "UPDATE m04_persistence.resource_version_observations SET observed_at=observed_at+interval '1 second' WHERE id='observation-1'",
      "UPDATE m04_persistence.resource_version_observations SET observed_at=observed_at-interval '1 second' WHERE id='observation-1'",
      "observation-1",
    ],
    [
      "ownership fingerprint",
      "UPDATE m04_persistence.candidate_root_ownership SET ownership='SHARED' WHERE id='ownership-1'",
      "UPDATE m04_persistence.candidate_root_ownership SET ownership='OWNED' WHERE id='ownership-1'",
      "m04_guard:ownership_topology",
    ],
    [
      "review-state set fingerprint",
      `INSERT INTO m04_persistence.m02_review_states
             (id,group_id,resource_candidate_id,review_state,record_version,
              source_snapshot_id,controlling_job_id,superseded_by_review_id)
           VALUES ('review-group-extra','group-1',NULL,'NOT_REQUIRED',1,
             'snapshot-m04','job-1',NULL)`,
      "DELETE FROM m04_persistence.m02_review_states WHERE id='review-group-extra'",
      "m04_guard:review_state_set",
    ],
  ] as const;
  it("rejects predecessor fingerprint and provider-metadata cases", async () => {
    const probe = await candidate("probe-key");
    const staleClient = await pool.connect();
    try {
      for (const [name, change, restore, subjectId] of fingerprintCases) {
        await staleClient.query("SET session_replication_role=replica");
        try {
          await staleClient.query(change);
        } finally {
          await staleClient.query("SET session_replication_role=origin");
        }
        expect(await adapter.persistAccepted(probe), name).toMatchObject({
          kind: "REJECTED",
          diagnostics: [{ subjectIdOrNull: subjectId }],
        });
        await staleClient.query("SET session_replication_role=replica");
        try {
          await staleClient.query(restore);
        } finally {
          await staleClient.query("SET session_replication_role=origin");
        }
      }
      await staleClient.query("SET session_replication_role=replica");
      try {
        await staleClient.query(
          `UPDATE m04_persistence.acquisition_results
              SET result=jsonb_set(result,'{repositoryMetadata,description}','"changed"'::jsonb)
            WHERE job_id='job-1'`,
        );
      } finally {
        await staleClient.query("SET session_replication_role=origin");
      }
      await staleClient.query("SET search_path TO m04_persistence, public");
      const changedAcquisition = (
        await staleClient.query<{
          job_id: string;
          source_snapshot_id: string;
          result: unknown;
          created_at: Date;
        }>(
          "SELECT job_id,source_snapshot_id,result,created_at FROM acquisition_results WHERE job_id='job-1'",
        )
      ).rows[0];
      const providerProbe = {
        ...probe,
        request: {
          ...probe.request,
          expectedPredecessorState: {
            ...probe.request.expectedPredecessorState,
            fingerprintExpectations: {
              ...probe.request.expectedPredecessorState.fingerprintExpectations,
              acquisitionResult: hash(
                bytes({
                  jobId: changedAcquisition?.job_id,
                  sourceSnapshotId: changedAcquisition?.source_snapshot_id,
                  result: changedAcquisition?.result,
                  createdAt: changedAcquisition?.created_at.toISOString(),
                }),
              ),
            },
          },
        },
      };
      await expect(readPredecessorAsRuntime(adapter, providerProbe)).resolves.toMatchObject({
        current: false,
        subjectId: "m04_guard:provider_metadata",
      });
      await staleClient.query("SET session_replication_role=replica");
      try {
        await staleClient.query(
          "UPDATE m04_persistence.acquisition_results SET result=$1::jsonb WHERE job_id='job-1'",
          [JSON.stringify(M03_GENUINE_ACQUISITION_RESULT)],
        );
      } finally {
        await staleClient.query("SET session_replication_role=origin");
      }
    } finally {
      staleClient.release();
    }
    await expect(readPredecessorAsRuntime(adapter, probe)).resolves.toEqual({ current: true });
  }, 240_000);

  it("rejects insert faults and hash collisions before the first accepted binding", async () => {
    const probe = await candidate("probe-key");
    const failureClient = await pool.connect();
    try {
      await failureClient.query("SET search_path TO m04_persistence, public");
      for (const table of [
        "m03_extraction_bundles",
        "m03_extraction_bundle_chunks",
        "m04_evidence_items",
        "m04_claims",
        "m04_claim_evidence_links",
        "m04_completeness_snapshots",
        "m04_binding_results",
        "m04_binding_requests",
      ]) {
        const faultAdapter = await PostgresEvidencePersistenceAdapterV1.open(
          insertStageFaultPool(activeRuntimePool(), table),
          {
            schema: "m04_persistence",
            loginRole: "ai_ark_m04_login",
            peerLoginRole: "ai_ark_m01_m02_login",
          },
        );
        expect(await faultAdapter.persistAccepted(probe), table).toMatchObject({
          kind: "FAILED",
          error: "PERSISTENCE_UNAVAILABLE",
          diagnostics: [{ code: "PERSISTENCE_FAILURE" }],
        });
        const partial = await failureClient.query<{ count: string }>(
          `SELECT sum(count)::text count FROM (
             SELECT count(*) FROM m03_extraction_bundles UNION ALL
             SELECT count(*) FROM m03_extraction_bundle_chunks UNION ALL
             SELECT count(*) FROM m04_evidence_items UNION ALL
             SELECT count(*) FROM m04_claims UNION ALL
             SELECT count(*) FROM m04_claim_evidence_links UNION ALL
             SELECT count(*) FROM m04_completeness_snapshots UNION ALL
             SELECT count(*) FROM m04_binding_results UNION ALL
             SELECT count(*) FROM m04_binding_requests) rows`,
        );
        expect(partial.rows[0]?.count, table).toBe("0");
      }
    } finally {
      failureClient.release();
    }
  }, 240_000);

  it("requires every M04 manifest cell in the named persistence transaction", async () => {
    const probe = await candidate("m04-cell-necessity");
    const migration = (await loadMigrations())[2] as
      | {
          manifest?: {
            groups: readonly {
              role: string;
              relations: readonly { name: string; operations: readonly string[] }[];
              functions: readonly string[];
              sequences: readonly { name: string; operations: readonly string[] }[];
            }[];
          };
        }
      | undefined;
    const group = migration?.manifest?.groups.find(({ role }) => role === "M04_RUNTIME_GROUP");
    if (group === undefined) throw new Error("M04_RUNTIME_MANIFEST_GROUP_MISSING");
    expect(group.sequences).toEqual([]);
    const role = "ai_ark_m04_runtime";
    const cells = [
      ...group.relations.flatMap(({ name, operations }) =>
        operations.map((operation) => ({
          label: `${name}:${operation}`,
          revoke: `REVOKE ${operation} ON TABLE m04_persistence.${name} FROM ${role}`,
          restore: `GRANT ${operation} ON TABLE m04_persistence.${name} TO ${role}`,
        })),
      ),
      ...group.functions.map((signature) => ({
        label: signature,
        revoke: `REVOKE EXECUTE ON FUNCTION m04_persistence.${signature} FROM ${role}`,
        restore: `GRANT EXECUTE ON FUNCTION m04_persistence.${signature} TO ${role}`,
      })),
    ];
    expect(cells).toHaveLength(38);
    const matrixAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      rollbackBeforeCommitPool(activeRuntimePool()),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    const direct = matrixAdapter as unknown as {
      assertRuntimeAuthority(connection: PoolClient): Promise<void>;
      transaction(value: EvidenceBindingCandidateV1): Promise<unknown>;
    };
    // The production entry point still verifies the full manifest. The direct transaction
    // bypasses only that precheck in this test, so PostgreSQL can prove cell necessity.
    direct.assertRuntimeAuthority = () => Promise.resolve();
    await expect(direct.transaction(probe)).rejects.toThrow("M04_TEST_FORCED_ROLLBACK");
    const count = async (): Promise<string | undefined> =>
      (
        await pool.query<{ count: string }>(
          `SELECT sum(count)::text count FROM (
             SELECT count(*) FROM m04_persistence.m03_extraction_bundles UNION ALL
             SELECT count(*) FROM m04_persistence.m03_extraction_bundle_chunks UNION ALL
             SELECT count(*) FROM m04_persistence.m04_evidence_items UNION ALL
             SELECT count(*) FROM m04_persistence.m04_claims UNION ALL
             SELECT count(*) FROM m04_persistence.m04_claim_evidence_links UNION ALL
             SELECT count(*) FROM m04_persistence.m04_completeness_snapshots UNION ALL
             SELECT count(*) FROM m04_persistence.m04_binding_results UNION ALL
             SELECT count(*) FROM m04_persistence.m04_binding_requests) rows`,
        )
      ).rows[0]?.count;
    expect(await count()).toBe("0");
    for (const cell of cells) {
      await pool.query(cell.revoke);
      try {
        expect(
          await adapter.persistAccepted(probe),
          `${cell.label}:public-fail-closed`,
        ).toMatchObject({
          kind: "FAILED",
          error: "PERSISTENCE_INTEGRITY_FAILED",
        });
        const denial = await direct.transaction(probe).then(
          () => undefined,
          (error: unknown) => error as { code?: string; table?: string; constraint?: string },
        );
        expect(denial, `${cell.label}:sql-necessity`).toMatchObject({ code: "42501" });
        expect(await count(), `${cell.label}:zero-committed-side-effect`).toBe("0");
      } finally {
        await pool.query(cell.restore);
      }
    }
  }, 240_000);

  it("rejects layered content and alternate-unique collisions", async () => {
    acceptedCandidate = await candidate("key-1");
    const forgedPayload = bytes({ schemaVersion: "M04_FORCED_COLLISION_PREIMAGE_V1" });
    const collisionClient = await pool.connect();
    try {
      await collisionClient.query("SET search_path TO m04_persistence, public");
      const evidence = acceptedCandidate.evidenceItems[0];
      const claim = acceptedCandidate.claims[0];
      const link = acceptedCandidate.links[0];
      if (evidence === undefined || claim === undefined || link === undefined)
        throw new Error("M04_COLLISION_FIXTURE_RECORD_REQUIRED");
      const completeness = acceptedCandidate.completeness;
      const bindingCore = {
        schemaVersion: "M04_BINDING_ID_V1",
        extractionId: acceptedCandidate.bundle.extractionId,
        logicalPayloadSha256: acceptedCandidate.logicalPayloadSha256,
        evidencePolicyVersion: acceptedCandidate.request.evidencePolicyVersion,
        materialFieldRegistryVersion: acceptedCandidate.request.materialFieldRegistryVersion,
        evidenceItemIds: acceptedCandidate.evidenceItems.map(({ id }) => id).sort(),
        claimIds: acceptedCandidate.claims.map(({ id }) => id),
        linkIds: acceptedCandidate.links.map(({ id }) => id),
        completenessId: completeness.id,
      };
      const bindingId = `bnd_${hash(bytes(bindingCore))}`;
      const resultCore = {
        kind: "ACCEPTED",
        bindingId,
        extractionId: acceptedCandidate.bundle.extractionId,
        completenessId: completeness.id,
      } as const;
      const resultId = `m4r_${hash(bytes(resultCore))}`;
      const resultFingerprint = hash(
        bytes({ schemaVersion: "M04_RESULT_V1", resultId, ...resultCore }),
      );
      const collisionLayers = [
        {
          kind: "EVIDENCE",
          insert: `INSERT INTO m04_evidence_items
            (id,extraction_id,m03_source_reference_id,source_snapshot_id,source_revision,
             source_entry_id,source_document_id,evidence_type,canonical_payload,record_fingerprint,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
          values: [
            evidence.id,
            evidence.extractionId,
            evidence.m03SourceReferenceId,
            evidence.sourceSnapshotId,
            evidence.sourceRevision,
            evidence.sourceEntryIdOrNull,
            evidence.sourceDocumentIdOrNull,
            evidence.evidenceType,
            forgedPayload,
            evidence.recordFingerprint,
          ],
          cleanup: "DELETE FROM m04_evidence_items WHERE id=$1",
          id: evidence.id,
        },
        {
          kind: "CLAIM",
          insert: `INSERT INTO m04_claims
            (id,extraction_id,resource_identity_id,resource_version_identity_id,field_key,status,
             claim_class,canonical_payload,record_fingerprint,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())`,
          values: [
            claim.id,
            claim.extractionId,
            claim.resourceIdentityId,
            claim.resourceVersionIdentityId,
            claim.fieldKey,
            claim.status,
            claim.claimClass,
            forgedPayload,
            claim.recordFingerprint,
          ],
          cleanup: "DELETE FROM m04_claims WHERE id=$1",
          id: claim.id,
        },
        {
          kind: "LINK",
          insert: `INSERT INTO m04_claim_evidence_links
            (id,claim_id,evidence_item_id,m03_source_reference_id,ordinal,relationship,
             canonical_payload,record_fingerprint,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
          values: [
            link.id,
            link.claimId,
            link.evidenceItemId,
            link.m03SourceReferenceId,
            link.ordinal,
            link.relationship,
            forgedPayload,
            link.recordFingerprint,
          ],
          cleanup: "DELETE FROM m04_claim_evidence_links WHERE id=$1",
          id: link.id,
        },
        {
          kind: "COMPLETENESS",
          insert: `INSERT INTO m04_completeness_snapshots
            (id,extraction_id,canonical_payload,coverage_basis_points,m05_progression,
             record_fingerprint,created_at) VALUES ($1,$2,$3,$4,$5,$6,now())`,
          values: [
            completeness.id,
            acceptedCandidate.bundle.extractionId,
            forgedPayload,
            completeness.coverageBasisPoints,
            completeness.m05Progression,
            completeness.recordFingerprint,
          ],
          cleanup: "DELETE FROM m04_completeness_snapshots WHERE id=$1",
          id: completeness.id,
        },
        {
          kind: "BINDING_RESULT",
          insert: `INSERT INTO m04_binding_results
            (id,kind,binding_id,extraction_id,completeness_id,canonical_payload,
             result_fingerprint,created_at) VALUES ($1,'ACCEPTED',$2,$3,$4,$5,$6,now())`,
          values: [
            resultId,
            bindingId,
            acceptedCandidate.bundle.extractionId,
            completeness.id,
            forgedPayload,
            resultFingerprint,
          ],
          cleanup: "DELETE FROM m04_binding_results WHERE id=$1",
          id: resultId,
        },
      ] as const;
      for (const collision of collisionLayers) {
        await collisionClient.query("SET session_replication_role=replica");
        try {
          await collisionClient.query(collision.insert, [...collision.values]);
        } finally {
          await collisionClient.query("SET session_replication_role=origin");
        }
        await expect(
          adapter.persistAccepted(acceptedCandidate),
          `collision layer ${collision.kind}`,
        ).resolves.toMatchObject({
          kind: "FAILED",
          error: "PERSISTENCE_INTEGRITY_FAILED",
          diagnostics: [{ code: "PERSISTENCE_FAILURE", subjectKind: collision.kind }],
        });
        await collisionClient.query("SET session_replication_role=replica");
        try {
          await collisionClient.query(collision.cleanup, [collision.id]);
        } finally {
          await collisionClient.query("SET session_replication_role=origin");
        }
        const alternateVariants =
          collision.kind === "LINK"
            ? ["claim-evidence", "claim-ordinal"]
            : collision.kind === "BINDING_RESULT"
              ? ["extraction", "completeness"]
              : ["alternate"];
        for (const variant of alternateVariants) {
          let alternateValues: unknown[];
          if (collision.kind === "EVIDENCE") {
            const altered = reidentify(
              { ...evidence, contentFingerprint: hash("alternate-evidence-content") },
              "evi_",
            );
            alternateValues = [
              altered.id,
              altered.extractionId,
              altered.m03SourceReferenceId,
              altered.sourceSnapshotId,
              altered.sourceRevision,
              altered.sourceEntryIdOrNull,
              altered.sourceDocumentIdOrNull,
              altered.evidenceType,
              bytes(altered),
              altered.recordFingerprint,
            ];
          } else if (collision.kind === "CLAIM") {
            const altered = reidentify(
              {
                ...claim,
                deterministicCandidateIds: [
                  ...claim.deterministicCandidateIds,
                  "alternate-candidate",
                ],
              },
              "clm_",
            );
            alternateValues = [
              altered.id,
              altered.extractionId,
              altered.resourceIdentityId,
              altered.resourceVersionIdentityId,
              altered.fieldKey,
              altered.status,
              altered.claimClass,
              bytes(altered),
              altered.recordFingerprint,
            ];
          } else if (collision.kind === "LINK") {
            const altered = reidentify(
              variant === "claim-evidence"
                ? { ...link, ordinal: link.ordinal === 0 ? 1 : 0 }
                : {
                    ...link,
                    evidenceItemId: `evi_${"d".repeat(64)}`,
                  },
              "cel_",
            );
            alternateValues = [
              altered.id,
              altered.claimId,
              altered.evidenceItemId,
              altered.m03SourceReferenceId,
              altered.ordinal,
              altered.relationship,
              bytes(altered),
              altered.recordFingerprint,
            ];
          } else if (collision.kind === "COMPLETENESS") {
            const altered = reidentify(
              {
                ...completeness,
                requirements: completeness.requirements.map((requirement, index) =>
                  index === 0
                    ? {
                        ...requirement,
                        evidenceItemIds: [...requirement.evidenceItemIds, `evi_${"d".repeat(64)}`],
                      }
                    : requirement,
                ),
              },
              "cmp_",
            );
            alternateValues = [
              altered.id,
              acceptedCandidate.bundle.extractionId,
              bytes(altered),
              altered.coverageBasisPoints,
              altered.m05Progression,
              altered.recordFingerprint,
            ];
          } else {
            const alteredCore = {
              ...resultCore,
              bindingId: `bnd_${"d".repeat(64)}`,
              extractionId:
                variant === "extraction" ? resultCore.extractionId : `ext_${"d".repeat(64)}`,
              completenessId:
                variant === "extraction" ? `cmp_${"d".repeat(64)}` : resultCore.completenessId,
            };
            const alteredId = `m4r_${hash(bytes(alteredCore))}`;
            alternateValues = [
              alteredId,
              alteredCore.bindingId,
              alteredCore.extractionId,
              alteredCore.completenessId,
              bytes(alteredCore),
              hash(bytes({ schemaVersion: "M04_RESULT_V1", resultId: alteredId, ...alteredCore })),
            ];
          }
          const alternateId = alternateValues[0] as string;
          await collisionClient.query("SET session_replication_role=replica");
          try {
            await collisionClient.query(collision.insert, alternateValues);
          } finally {
            await collisionClient.query("SET session_replication_role=origin");
          }
          await expect(
            adapter.persistAccepted(acceptedCandidate),
            `alternate collision ${collision.kind}/${variant}`,
          ).resolves.toMatchObject({
            kind: "FAILED",
            error: "PERSISTENCE_INTEGRITY_FAILED",
            diagnostics: [{ code: "PERSISTENCE_FAILURE", subjectKind: collision.kind }],
          });
          await collisionClient.query("SET session_replication_role=replica");
          try {
            await collisionClient.query(collision.cleanup, [alternateId]);
          } finally {
            await collisionClient.query("SET session_replication_role=origin");
          }
        }
      }
    } finally {
      collisionClient.release();
    }
  }, 240_000);

  it("rejects a corrupt alternate incumbent as persistence integrity failure", async () => {
    const evidence = acceptedCandidate.evidenceItems[0];
    if (evidence === undefined) throw new Error("M04_EVIDENCE_REQUIRED");
    const altered = reidentify(
      { ...evidence, contentFingerprint: hash("corrupt-alternate-incumbent") },
      "evi_",
    );
    const corruptFingerprint = "d".repeat(64);
    const client = await pool.connect();
    try {
      await client.query("SET search_path TO m04_persistence, public");
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `INSERT INTO m04_evidence_items
             (id,extraction_id,m03_source_reference_id,source_snapshot_id,source_revision,
              source_entry_id,source_document_id,evidence_type,canonical_payload,
              record_fingerprint,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
          [
            altered.id,
            altered.extractionId,
            altered.m03SourceReferenceId,
            altered.sourceSnapshotId,
            altered.sourceRevision,
            altered.sourceEntryIdOrNull,
            altered.sourceDocumentIdOrNull,
            altered.evidenceType,
            bytes(altered),
            corruptFingerprint,
          ],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      await expect(adapter.persistAccepted(acceptedCandidate)).resolves.toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
      await client.query("SET session_replication_role=replica");
      try {
        await client.query("DELETE FROM m04_evidence_items WHERE id=$1", [altered.id]);
      } finally {
        await client.query("SET session_replication_role=origin");
      }
    } finally {
      client.release();
    }
  }, 240_000);

  it("accepts the first binding after collision preflight", async () => {
    const first = await adapter.persistAccepted(acceptedCandidate);
    expect(first, JSON.stringify(first)).toMatchObject({ kind: "ACCEPTED", replayed: false });
    if (first.kind !== "ACCEPTED") throw new Error("M04_FIRST_BINDING_NOT_ACCEPTED");
    firstExtractionId = first.extractionId;
  }, 240_000);

  it("rejects semantic collisions and preserves accepted replay", async () => {
    const semanticCollisionBase = await candidate("key-semantic-collision");
    const semanticCollisionRequest = {
      ...semanticCollisionBase.request,
      expectedResourceIdentityId: "resource-collision-preimage",
    };
    const semanticCollisionPayload = bytes(semanticCollisionRequest);
    await expect(
      adapter.persistAccepted({
        ...semanticCollisionBase,
        request: semanticCollisionRequest,
        requestCanonicalPayload: semanticCollisionPayload,
        requestFingerprint: hash(semanticCollisionPayload),
        semanticRequestFingerprint: acceptedCandidate.semanticRequestFingerprint,
      }),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "CONTENT_HASH_COLLISION",
      diagnostics: [
        {
          code: "HASH_COLLISION",
          expectedFingerprintOrNull: acceptedCandidate.semanticRequestFingerprint,
          actualFingerprintOrNull: acceptedCandidate.semanticRequestFingerprint,
        },
      ],
    });
    const logicalCollision = await candidate("key-logical-collision");
    await expect(
      adapter.persistAccepted({
        ...logicalCollision,
        logicalPayload: Buffer.concat([
          Buffer.from(logicalCollision.logicalPayload),
          Buffer.from(" "),
        ]),
        logicalPayloadSha256: acceptedCandidate.logicalPayloadSha256,
      }),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "CONTENT_HASH_COLLISION",
      diagnostics: [
        {
          code: "HASH_COLLISION",
          expectedFingerprintOrNull: acceptedCandidate.logicalPayloadSha256,
          actualFingerprintOrNull: acceptedCandidate.logicalPayloadSha256,
        },
      ],
    });
    const envelopeCollision = await candidate("key-envelope-collision");
    await expect(
      adapter.persistAccepted({
        ...envelopeCollision,
        bundleCanonicalPayload: Buffer.concat([
          Buffer.from(envelopeCollision.bundleCanonicalPayload),
          Buffer.from(" "),
        ]),
        bundleCanonicalSha256: acceptedCandidate.bundleCanonicalSha256,
      }),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "CONTENT_HASH_COLLISION",
      diagnostics: [
        {
          code: "HASH_COLLISION",
          expectedFingerprintOrNull: acceptedCandidate.bundleCanonicalSha256,
          actualFingerprintOrNull: acceptedCandidate.bundleCanonicalSha256,
        },
      ],
    });
    const closureClient = await pool.connect();
    try {
      await closureClient.query("SET search_path TO m04_persistence, public");
      await closureClient.query(
        `INSERT INTO schema_migrations(version,filename,sha256,applied_at)
         VALUES ('003','003_m04_evidence_binding.sql',$1,now())`,
        ["a3423225b93ceb0e2262f192fd6521568405a253148b1619e5afb5ea9f91bd8e"],
      );
      await expect(
        closureClient.query("SELECT m04_assert_binding_closure($1)", [firstExtractionId]),
      ).resolves.toBeDefined();
      const claim = (
        await closureClient.query<{ id: string; canonical_payload: Buffer }>(
          "SELECT id,canonical_payload FROM m04_claims WHERE extraction_id=$1 ORDER BY field_key LIMIT 1",
          [firstExtractionId],
        )
      ).rows[0];
      expect(claim).toBeDefined();
      await closureClient.query("SET session_replication_role=replica");
      try {
        await closureClient.query(
          `UPDATE m04_claims
              SET canonical_payload=convert_to(m04_canonical_json(
                jsonb_set(convert_from(canonical_payload,'UTF8')::jsonb,'{value}','"forged"'::jsonb)),
                'UTF8')
            WHERE id=$1`,
          [claim?.id],
        );
      } finally {
        await closureClient.query("SET session_replication_role=origin");
      }
      await expect(
        closureClient.query("SELECT m04_assert_binding_closure($1)", [firstExtractionId]),
      ).rejects.toThrow(/M04_FULL_CLOSURE_CLAIM_INVALID/u);
      await closureClient.query("SET session_replication_role=replica");
      try {
        await closureClient.query("UPDATE m04_claims SET canonical_payload=$2 WHERE id=$1", [
          claim?.id,
          claim?.canonical_payload,
        ]);
      } finally {
        await closureClient.query("SET session_replication_role=origin");
      }
      for (const [table, key] of [
        ["schema_migrations", "version"],
        ["source_snapshots", "id"],
        ["acquisition_results", "job_id"],
        ["m01_source_entries", "id"],
        ["m01_source_documents", "id"],
        ["resource_version_observations", "id"],
        ["m03_extraction_bundles", "extraction_id"],
        ["m03_extraction_bundle_chunks", "extraction_id"],
        ["m04_binding_requests", "id"],
        ["m04_evidence_items", "id"],
        ["m04_claims", "id"],
        ["m04_claim_evidence_links", "id"],
        ["m04_completeness_snapshots", "id"],
        ["m04_binding_results", "id"],
      ] as const) {
        await expect(
          closureClient.query(
            `UPDATE ${table} SET ${key}=${key} WHERE ${key}=(SELECT ${key} FROM ${table} LIMIT 1)`,
          ),
          `${table} update`,
        ).rejects.toThrow(/(?:M04_IMMUTABLE_RECORD|M02_HISTORY_IMMUTABLE)/u);
        await expect(
          closureClient.query(
            `DELETE FROM ${table} WHERE ${key}=(SELECT ${key} FROM ${table} LIMIT 1)`,
          ),
          `${table} delete`,
        ).rejects.toThrow(/(?:M04_IMMUTABLE_RECORD|M02_HISTORY_IMMUTABLE)/u);
      }
    } finally {
      closureClient.release();
    }
    const direct = await pool.connect();
    try {
      await direct.query("BEGIN");
      await direct.query("SET LOCAL search_path TO m04_persistence, public");
      await direct.query(
        `INSERT INTO m03_extraction_bundles
         (extraction_id,resource_identity_id,resource_version_identity_id,source_snapshot_id,source_revision,
          m02_input_projection_fingerprint,m03_input_fingerprint,
          m03_output_fingerprint,logical_payload_sha256,canonical_payload_sha256,
          canonical_payload_byte_length,canonical_payload_chunk_count,persisted_at)
         VALUES ($1,'resource-existing','version-prior','snapshot-m04',$2,$3,$4,$5,$6,$7,1,1,now())`,
        [
          `ext_${"c".repeat(64)}`,
          revision,
          "1".repeat(64),
          "2".repeat(64),
          "d".repeat(64),
          "e".repeat(64),
          "f".repeat(64),
        ],
      );
      await expect(direct.query("SET CONSTRAINTS ALL IMMEDIATE")).rejects.toThrow(
        /M04_BUNDLE_CHUNK_CLOSURE_INVALID/u,
      );
    } finally {
      await direct.query("ROLLBACK");
      direct.release();
    }
    const emptyBundle = await createGenuineM03EmptyBundleFixture();
    const emptyDocument = emptyBundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT",
    );
    if (emptyDocument === undefined) throw new Error("M04_EMPTY_DOCUMENT_REFERENCE_REQUIRED");
    const emptySourceClient = await pool.connect();
    try {
      await emptySourceClient.query("SET search_path TO m04_persistence, public");
      await emptySourceClient.query("SET session_replication_role=replica");
      try {
        await emptySourceClient.query(
          "UPDATE m01_source_entries SET content_fingerprint=$1 WHERE id='entry-m04'",
          [emptyDocument.contentHash],
        );
        await emptySourceClient.query(
          "UPDATE m01_source_documents SET content_fingerprint=$1 WHERE id='document-m04'",
          [emptyDocument.contentHash],
        );
      } finally {
        await emptySourceClient.query("SET session_replication_role=origin");
      }
    } finally {
      emptySourceClient.release();
    }
    const emptyCandidate = await candidate("key-empty-1", "resource-existing", emptyBundle);
    const concurrentEmpty = await Promise.all([
      adapter.persistAccepted(emptyCandidate),
      adapter.persistAccepted(emptyCandidate),
    ]);
    const emptyFirst = concurrentEmpty.find(
      (result) => result.kind === "ACCEPTED" && !result.replayed,
    );
    expect(
      concurrentEmpty.filter((result) => result.kind === "ACCEPTED"),
      JSON.stringify(concurrentEmpty),
    ).toHaveLength(2);
    expect(
      concurrentEmpty.map((result) => (result.kind === "ACCEPTED" ? result.replayed : null)).sort(),
    ).toEqual([false, true]);
    const emptyReplay = await adapter.persistAccepted(
      await candidate("key-empty-1", "resource-existing", emptyBundle),
    );
    expect(emptyFirst).toMatchObject({ kind: "ACCEPTED", replayed: false });
    expect(emptyReplay).toMatchObject({ kind: "ACCEPTED", replayed: true });
    emptyExtractionId = emptyBundle.extractionId;
  }, 240_000);

  it("rejects hostile direct encoded-key writes without domain, audit, or result effects", async () => {
    const owner = await pool.connect();
    try {
      await owner.query("SET search_path TO m04_persistence, public");
      const binding = await owner.query<{ id: string; binding_id: string }>(
        "SELECT id,binding_id FROM m04_binding_results WHERE extraction_id=$1",
        [firstExtractionId],
      );
      const result = binding.rows[0];
      if (result === undefined) throw new Error("M04_TEST_ACCEPTED_BINDING_REQUIRED");
      const inventorySql = `SELECT jsonb_build_object(
        'bundles',(SELECT count(*) FROM m03_extraction_bundles),
        'evidence',(SELECT count(*) FROM m04_evidence_items),
        'claims',(SELECT count(*) FROM m04_claims),
        'links',(SELECT count(*) FROM m04_claim_evidence_links),
        'completeness',(SELECT count(*) FROM m04_completeness_snapshots),
        'results',(SELECT count(*) FROM m04_binding_results),
        'requests',(SELECT count(*) FROM m04_binding_requests),
        'audit',(SELECT count(*) FROM m02_audit_events),
        'rejectedAudit',(SELECT count(*) FROM m02_rejected_command_audits)) inventory`;
      const before = (await owner.query<{ inventory: unknown }>(inventorySql)).rows[0]?.inventory;
      for (const [name, encodedKey] of [
        ["nonhex", "gg"],
        ["odd", "0"],
        ["one-over", "aa".repeat(201)],
        ["mismatch", "61"],
      ] as const) {
        const probe = await candidate(`hostile-${name}`);
        const recordId = `m4q_${hash(
          canonicalJsonM03({
            schemaVersion: "M04_REQUEST_RECORD_ID_V1",
            requestFingerprint: probe.requestFingerprint,
          }),
        )}`;
        await owner.query("BEGIN");
        let rejection: unknown;
        try {
          await owner.query(
            `INSERT INTO m04_binding_requests
              (id,idempotency_key,request_fingerprint,semantic_request_fingerprint,
               request_payload_sha256,request_payload_byte_length,request_canonical_payload,
               binding_id,result_id,created_at)
             VALUES ($1,$2,$3,$4,$3,$5,$6,$7,$8,now())`,
            [
              recordId,
              encodedKey,
              probe.requestFingerprint,
              probe.semanticRequestFingerprint,
              probe.requestCanonicalPayload.byteLength,
              Buffer.from(probe.requestCanonicalPayload),
              result.binding_id,
              result.id,
            ],
          );
          await owner.query("SET CONSTRAINTS ALL IMMEDIATE");
        } catch (error) {
          rejection = error;
        } finally {
          await owner.query("ROLLBACK");
        }
        expect(rejection, name).toBeDefined();
        expect(
          (await owner.query<{ inventory: unknown }>(inventorySql)).rows[0]?.inventory,
        ).toEqual(before);
      }
    } finally {
      owner.release();
    }
  }, 240_000);

  it("replays durable bindings and classifies retry and lock faults", async () => {
    const replayStaleClient = await pool.connect();
    try {
      await replayStaleClient.query("SET session_replication_role=replica");
      await replayStaleClient.query(
        `UPDATE m04_persistence.resource_candidates
            SET status='IDENTITY_REVIEW_REQUIRED',identity_outcome='AMBIGUOUS_IDENTITY'
          WHERE id='candidate-1'`,
      );
    } finally {
      await replayStaleClient.query("SET session_replication_role=origin");
      replayStaleClient.release();
    }
    const sameKey = await adapter.persistAccepted(await candidate("key-1"));
    const newKey = await adapter.persistAccepted(await candidate("key-2"));
    expect(sameKey).toMatchObject({ kind: "ACCEPTED", replayed: true });
    expect(newKey).toMatchObject({ kind: "ACCEPTED", replayed: true });
    const retryAttempts = { count: 0 };
    const retryAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      serializationFaultPool(activeRuntimePool(), 2, retryAttempts),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    await expect(
      retryAdapter.persistAccepted(await candidate("key-serialization-retry")),
    ).resolves.toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
    });
    expect(retryAttempts.count).toBe(3);
    const exhaustedAttempts = { count: 0 };
    const exhaustedAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      serializationFaultPool(activeRuntimePool(), Number.POSITIVE_INFINITY, exhaustedAttempts),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    await expect(
      exhaustedAdapter.persistAccepted(await candidate("key-serialization-exhausted")),
    ).resolves.toMatchObject({
      kind: "FAILED",
      error: "SERIALIZATION_RETRY_EXHAUSTED",
      diagnostics: [{ code: "SERIALIZATION_EXHAUSTED" }],
    });
    expect(exhaustedAttempts.count).toBe(3);
    const uniqueAttempts = { count: 0, readOnlyCount: 0 };
    const persistentUniqueConflict = await PostgresEvidencePersistenceAdapterV1.open(
      serializationFaultPool(
        activeRuntimePool(),
        Number.POSITIVE_INFINITY,
        uniqueAttempts,
        "23505",
      ),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    await expect(
      persistentUniqueConflict.persistAccepted(await candidate("key-stable-unique-conflict")),
    ).resolves.toMatchObject({
      kind: "FAILED",
      error: "PERSISTENCE_INTEGRITY_FAILED",
    });
    expect(uniqueAttempts.count).toBe(3);
    expect(uniqueAttempts.readOnlyCount).toBe(1);
    const failedAttempts = { count: 0 };
    const failedAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      serializationFaultPool(activeRuntimePool(), 1, failedAttempts, "40003"),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    await expect(
      failedAdapter.persistAccepted(await candidate("key-serialization-failed")),
    ).resolves.toMatchObject({
      kind: "FAILED",
      error: "SERIALIZATION_FAILED",
      diagnostics: [{ code: "PERSISTENCE_FAILURE" }],
    });
    expect(failedAttempts.count).toBe(1);
    const lockAttempts = { count: 0 };
    const lockFaultAdapter = await PostgresEvidencePersistenceAdapterV1.open(
      partialLockFaultPool(activeRuntimePool(), lockAttempts),
      {
        schema: "m04_persistence",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      },
    );
    await expect(
      lockFaultAdapter.persistAccepted(await candidate("key-partial-lock-failure")),
    ).resolves.toMatchObject({ kind: "FAILED", error: "PERSISTENCE_UNAVAILABLE" });
    expect(lockAttempts.count).toBe(2);
    await expect(
      adapter.persistAccepted(await candidate("key-partial-lock-failure")),
    ).resolves.toMatchObject({ kind: "ACCEPTED", replayed: true });
    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM m04_persistence.m03_extraction_bundles) bundles,
              (SELECT count(*)::int FROM m04_persistence.m04_binding_requests) requests`,
    );
    expect(counts.rows[0]).toEqual({ bundles: 2, requests: 5 });
    expect(
      await adapter.persistAccepted(await candidate("key-1", "different-resource")),
    ).toMatchObject({ kind: "REJECTED", error: "IDEMPOTENCY_KEY_REUSED" });
  }, 240_000);

  it("rejects durable row and closure corruption", async () => {
    const corruptionCases = [
      {
        name: "bundle chunks",
        corrupt: `UPDATE m03_extraction_bundle_chunks
                    SET chunk_bytes=set_byte(chunk_bytes,0,(get_byte(chunk_bytes,0)+1)%256),
                        chunk_sha256=encode(digest(set_byte(chunk_bytes,0,(get_byte(chunk_bytes,0)+1)%256),'sha256'),'hex')
                  WHERE extraction_id=$1 AND chunk_ordinal=0`,
        restore: `UPDATE m03_extraction_bundle_chunks SET chunk_bytes=$2,chunk_sha256=$3
                  WHERE extraction_id=$1 AND chunk_ordinal=0`,
        load: `SELECT chunk_bytes original_value,chunk_sha256 original_hash
               FROM m03_extraction_bundle_chunks WHERE extraction_id=$1 AND chunk_ordinal=0`,
      },
      {
        name: "bundle lineage",
        corrupt: `UPDATE m03_extraction_bundles SET source_snapshot_id='snapshot-1'
                  WHERE extraction_id=$1`,
        restore: `UPDATE m03_extraction_bundles SET source_snapshot_id=$2 WHERE extraction_id=$1`,
        load: `SELECT source_snapshot_id original_value,NULL::text original_hash
               FROM m03_extraction_bundles WHERE extraction_id=$1`,
      },
      {
        name: "completeness payload",
        corrupt: `UPDATE m04_completeness_snapshots SET canonical_payload=convert_to('{}','UTF8')
                  WHERE extraction_id=$1`,
        restore: `UPDATE m04_completeness_snapshots SET canonical_payload=$2 WHERE extraction_id=$1`,
        load: `SELECT canonical_payload original_value,NULL::text original_hash
               FROM m04_completeness_snapshots WHERE extraction_id=$1`,
      },
      {
        name: "evidence payload",
        corrupt: `UPDATE m04_evidence_items SET canonical_payload=convert_to('{}','UTF8')
                  WHERE id=(SELECT id FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        restore: `UPDATE m04_evidence_items SET canonical_payload=$2
                  WHERE id=(SELECT id FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        load: `SELECT canonical_payload original_value,NULL::text original_hash
               FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1`,
      },
      {
        name: "claim payload",
        corrupt: `UPDATE m04_claims SET canonical_payload=convert_to('{}','UTF8')
                  WHERE id=(SELECT id FROM m04_claims WHERE extraction_id=$1 ORDER BY field_key LIMIT 1)`,
        restore: `UPDATE m04_claims SET canonical_payload=$2
                  WHERE id=(SELECT id FROM m04_claims WHERE extraction_id=$1 ORDER BY field_key LIMIT 1)`,
        load: `SELECT canonical_payload original_value,NULL::text original_hash
               FROM m04_claims WHERE extraction_id=$1 ORDER BY field_key LIMIT 1`,
      },
      {
        name: "link payload",
        corrupt: `UPDATE m04_claim_evidence_links SET canonical_payload=convert_to('{}','UTF8')
                  WHERE id=(SELECT link.id FROM m04_claim_evidence_links link
                    JOIN m04_claims claim ON claim.id=link.claim_id
                   WHERE claim.extraction_id=$1 ORDER BY claim.field_key,link.ordinal LIMIT 1)`,
        restore: `UPDATE m04_claim_evidence_links SET canonical_payload=$2
                  WHERE id=(SELECT link.id FROM m04_claim_evidence_links link
                    JOIN m04_claims claim ON claim.id=link.claim_id
                   WHERE claim.extraction_id=$1 ORDER BY claim.field_key,link.ordinal LIMIT 1)`,
        load: `SELECT link.canonical_payload original_value,NULL::text original_hash
               FROM m04_claim_evidence_links link JOIN m04_claims claim ON claim.id=link.claim_id
              WHERE claim.extraction_id=$1 ORDER BY claim.field_key,link.ordinal LIMIT 1`,
      },
      {
        name: "evidence relational fingerprint",
        corrupt: `UPDATE m04_evidence_items SET record_fingerprint='${"d".repeat(64)}'
                  WHERE id=(SELECT id FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        restore: `UPDATE m04_evidence_items SET record_fingerprint=$2
                  WHERE id=(SELECT id FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        load: `SELECT record_fingerprint original_value,NULL::text original_hash
               FROM m04_evidence_items WHERE extraction_id=$1 ORDER BY id LIMIT 1`,
      },
      {
        name: "claim relational status",
        corrupt: `UPDATE m04_claims SET status=CASE status WHEN 'SUPPORTED' THEN 'AMBIGUOUS' ELSE 'SUPPORTED' END
                  WHERE id=(SELECT id FROM m04_claims WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        restore: `UPDATE m04_claims SET status=$2
                  WHERE id=(SELECT id FROM m04_claims WHERE extraction_id=$1 ORDER BY id LIMIT 1)`,
        load: `SELECT status original_value,NULL::text original_hash
               FROM m04_claims WHERE extraction_id=$1 ORDER BY id LIMIT 1`,
      },
      {
        name: "link relational relationship",
        corrupt: `UPDATE m04_claim_evidence_links SET relationship=
                    CASE relationship WHEN 'SUPPORTS' THEN 'CONTEXT_ONLY' ELSE 'SUPPORTS' END
                  WHERE id=(SELECT link.id FROM m04_claim_evidence_links link
                    JOIN m04_claims claim ON claim.id=link.claim_id
                   WHERE claim.extraction_id=$1 ORDER BY link.id LIMIT 1)`,
        restore: `UPDATE m04_claim_evidence_links SET relationship=$2
                  WHERE id=(SELECT link.id FROM m04_claim_evidence_links link
                    JOIN m04_claims claim ON claim.id=link.claim_id
                   WHERE claim.extraction_id=$1 ORDER BY link.id LIMIT 1)`,
        load: `SELECT link.relationship original_value,NULL::text original_hash
               FROM m04_claim_evidence_links link JOIN m04_claims claim ON claim.id=link.claim_id
              WHERE claim.extraction_id=$1 ORDER BY link.id LIMIT 1`,
      },
      {
        name: "completeness relational coverage",
        corrupt: `UPDATE m04_completeness_snapshots SET coverage_basis_points=coverage_basis_points+1
                  WHERE extraction_id=$1`,
        restore: `UPDATE m04_completeness_snapshots SET coverage_basis_points=$2 WHERE extraction_id=$1`,
        load: `SELECT coverage_basis_points original_value,NULL::text original_hash
               FROM m04_completeness_snapshots WHERE extraction_id=$1`,
      },
      {
        name: "request relational binding",
        corrupt: `UPDATE m04_binding_requests SET binding_id='bnd_${"d".repeat(64)}'
                  WHERE result_id=(SELECT id FROM m04_binding_results WHERE extraction_id=$1)`,
        restore: `UPDATE m04_binding_requests SET binding_id=$2
                  WHERE result_id=(SELECT id FROM m04_binding_results WHERE extraction_id=$1)`,
        load: `SELECT request.binding_id original_value,NULL::text original_hash
               FROM m04_binding_requests request JOIN m04_binding_results result ON result.id=request.result_id
              WHERE result.extraction_id=$1 ORDER BY request.created_at LIMIT 1`,
      },
      {
        name: "result relational binding",
        corrupt: `UPDATE m04_binding_results SET binding_id='bnd_${"d".repeat(64)}'
                  WHERE extraction_id=$1`,
        restore: `UPDATE m04_binding_results SET binding_id=$2 WHERE extraction_id=$1`,
        load: `SELECT binding_id original_value,NULL::text original_hash
               FROM m04_binding_results WHERE extraction_id=$1`,
      },
      {
        name: "result payload",
        corrupt: `UPDATE m04_binding_results SET canonical_payload=convert_to('{}','UTF8')
                  WHERE extraction_id=$1`,
        restore: `UPDATE m04_binding_results SET canonical_payload=$2 WHERE extraction_id=$1`,
        load: `SELECT canonical_payload original_value,NULL::text original_hash
               FROM m04_binding_results WHERE extraction_id=$1`,
      },
    ] as const;
    const corruptionClient = await pool.connect();
    try {
      await corruptionClient.query("SET search_path TO m04_persistence, public");
      for (const corruption of corruptionCases) {
        const original = await corruptionClient.query<{
          original_value: Buffer | string | number;
          original_hash: string | null;
        }>(corruption.load, [firstExtractionId]);
        await corruptionClient.query("SET session_replication_role=replica");
        try {
          await corruptionClient.query(corruption.corrupt, [firstExtractionId]);
        } finally {
          await corruptionClient.query("SET session_replication_role=origin");
        }
        expect(
          await adapter.persistAccepted(await candidate("key-1")),
          corruption.name,
        ).toMatchObject({
          kind: "FAILED",
          error: "PERSISTENCE_INTEGRITY_FAILED",
          diagnostics: [{ code: "PERSISTENCE_FAILURE" }],
        });
        const row = original.rows[0];
        if (row === undefined) throw new Error(`missing corruption source: ${corruption.name}`);
        await corruptionClient.query("SET session_replication_role=replica");
        try {
          const restoreValues: unknown[] = [firstExtractionId, row.original_value];
          if (row.original_hash !== null) restoreValues.push(row.original_hash);
          await corruptionClient.query(corruption.restore, restoreValues);
        } finally {
          await corruptionClient.query("SET session_replication_role=origin");
        }
      }
    } finally {
      corruptionClient.release();
    }
  }, 240_000);

  it("rejects coherently self-hashed request and binding corruption before replay classification", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET search_path TO m04_persistence, public");
      const persistedState = async (): Promise<string> => {
        const tables = [
          "m03_extraction_bundles",
          "m03_extraction_bundle_chunks",
          "m04_evidence_items",
          "m04_claims",
          "m04_claim_evidence_links",
          "m04_completeness_snapshots",
          "m04_binding_results",
          "m04_binding_requests",
          "m03_m04_predecessor_fence",
          "m02_audit_events",
        ] as const;
        const state: string[] = [];
        for (const table of tables) {
          const value = (
            await client.query<{ value: string }>(
              `SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY to_jsonb(row)::text),'[]'::jsonb)::text value
                 FROM ${table} row`,
            )
          ).rows[0]?.value;
          state.push(`${table}:${value ?? "MISSING"}`);
        }
        return hash(state.join("\n"));
      };
      const originalCounts = (
        await client.query<{ requests: number; results: number }>(
          `SELECT (SELECT count(*)::int FROM m04_binding_requests) requests,
                  (SELECT count(*)::int FROM m04_binding_results) results`,
        )
      ).rows[0];
      const originalRequest = (
        await client.query<{
          id: string;
          binding_id: string;
          result_id: string;
          request_canonical_payload: Buffer;
          request_fingerprint: string;
          request_payload_sha256: string;
          request_payload_byte_length: number;
          semantic_request_fingerprint: string;
        }>(
          `SELECT request.id,request.binding_id,request.result_id,request.request_canonical_payload,
                  request.request_fingerprint,request.request_payload_sha256,
                  request.request_payload_byte_length,request.semantic_request_fingerprint
             FROM m04_binding_requests request JOIN m04_binding_results result ON result.id=request.result_id
            WHERE result.extraction_id=$1 AND request.idempotency_key=$2
            ORDER BY request.id LIMIT 1`,
          [
            firstExtractionId,
            Buffer.from(acceptedCandidate.request.idempotencyKey, "utf8").toString("hex"),
          ],
        )
      ).rows[0];
      if (originalRequest === undefined) throw new Error("M04_REQUEST_CORRUPTION_SOURCE_MISSING");
      const parsedRequest = JSON.parse(
        originalRequest.request_canonical_payload.toString("utf8"),
      ) as EvidenceBindingRequestV1;
      expect(parsedRequest.idempotencyKey).toBe(acceptedCandidate.request.idempotencyKey);
      const corruptRequest = {
        ...parsedRequest,
        expectedResourceIdentityId: "resource-coherently-corrupt",
      };
      const corruptPayload = bytes(corruptRequest);
      const corruptFingerprint = hash(corruptPayload);
      const { idempotencyKey: _key, ...corruptSemantic } = corruptRequest;
      void _key;
      const corruptRequestId = `m4q_${hash(
        bytes({
          schemaVersion: "M04_REQUEST_RECORD_ID_V1",
          requestFingerprint: corruptFingerprint,
        }),
      )}`;
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `UPDATE m04_binding_requests
              SET id=$1,request_canonical_payload=$2,request_fingerprint=$3,
                  request_payload_sha256=$3,request_payload_byte_length=$4,
                  semantic_request_fingerprint=$5
            WHERE id=$6`,
          [
            corruptRequestId,
            corruptPayload,
            corruptFingerprint,
            corruptPayload.byteLength,
            hash(bytes(corruptSemantic)),
            originalRequest.id,
          ],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      const requestCorruptionState = await persistedState();
      const corruptIncumbentCandidate = {
        ...acceptedCandidate,
        request: corruptRequest,
        requestCanonicalPayload: corruptPayload,
        requestFingerprint: corruptFingerprint,
        semanticRequestFingerprint: hash(bytes(corruptSemantic)),
      };
      expect(await adapter.persistAccepted(corruptIncumbentCandidate)).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
      const disjointExtractionId = `ext_${"e".repeat(64)}`;
      const disjointBundle = {
        ...acceptedCandidate.bundle,
        extractionId: disjointExtractionId,
        m02InputProjectionFingerprint: "1".repeat(64),
        inputFingerprint: "2".repeat(64),
        outputFingerprint: "3".repeat(64),
      } as StructuredExtractionBundleV2;
      const disjointRequest = {
        ...acceptedCandidate.request,
        extractionId: disjointExtractionId,
        expectedM03OutputFingerprint: disjointBundle.outputFingerprint,
        expectedResourceIdentityId: "resource-disjoint",
        expectedResourceVersionIdentityId: "version-disjoint",
        expectedSourceSnapshotId: "snapshot-disjoint",
        expectedSourceRevision: "c".repeat(40),
      };
      const disjointRequestPayload = bytes(disjointRequest);
      const disjointSemantic = { ...disjointRequest };
      delete (disjointSemantic as Partial<EvidenceBindingRequestV1>).idempotencyKey;
      const disjointBundlePayload = bytes(disjointBundle);
      const disjointLogicalPayload = bytes(m03LogicalProjection(disjointBundle));
      const disjointCandidate = {
        ...acceptedCandidate,
        request: disjointRequest,
        requestCanonicalPayload: disjointRequestPayload,
        requestFingerprint: hash(disjointRequestPayload),
        semanticRequestFingerprint: hash(bytes(disjointSemantic)),
        bundle: disjointBundle,
        bundleCanonicalPayload: disjointBundlePayload,
        bundleCanonicalSha256: hash(disjointBundlePayload),
        logicalPayload: disjointLogicalPayload,
        logicalPayloadSha256: hash(disjointLogicalPayload),
        evidenceItems: [],
        claims: [],
        links: [],
        completeness: {
          ...acceptedCandidate.completeness,
          id: `cmp_${"e".repeat(64)}`,
          extractionId: disjointExtractionId,
          recordFingerprint: "4".repeat(64),
        },
      } as EvidenceBindingCandidateV1;
      expect(await adapter.persistAccepted(disjointCandidate)).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
      expect(await persistedState()).toBe(requestCorruptionState);
      expect(
        (
          await client.query<{ requests: number; results: number }>(
            `SELECT (SELECT count(*)::int FROM m04_binding_requests) requests,
                    (SELECT count(*)::int FROM m04_binding_results) results`,
          )
        ).rows[0],
      ).toEqual(originalCounts);
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `UPDATE m04_binding_requests
              SET id=$1,request_canonical_payload=$2,request_fingerprint=$3,
                  request_payload_sha256=$4,request_payload_byte_length=$5,
                  semantic_request_fingerprint=$6
            WHERE id=$7`,
          [
            originalRequest.id,
            originalRequest.request_canonical_payload,
            originalRequest.request_fingerprint,
            originalRequest.request_payload_sha256,
            originalRequest.request_payload_byte_length,
            originalRequest.semantic_request_fingerprint,
            corruptRequestId,
          ],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      expect(await adapter.persistAccepted(await candidate("key-1"))).toMatchObject({
        kind: "ACCEPTED",
        replayed: true,
      });

      const originalResult = (
        await client.query<{
          id: string;
          binding_id: string;
          canonical_payload: Buffer;
          result_fingerprint: string;
          extraction_id: string;
          completeness_id: string;
        }>(
          `SELECT id,binding_id,canonical_payload,result_fingerprint,extraction_id,completeness_id
             FROM m04_binding_results WHERE extraction_id=$1`,
          [firstExtractionId],
        )
      ).rows[0];
      if (originalResult === undefined) throw new Error("M04_RESULT_CORRUPTION_SOURCE_MISSING");
      const corruptBindingId = `bnd_${"d".repeat(64)}`;
      const corruptCore = {
        kind: "ACCEPTED" as const,
        bindingId: corruptBindingId,
        extractionId: originalResult.extraction_id,
        completenessId: originalResult.completeness_id,
      };
      const corruptResultId = `m4r_${hash(bytes(corruptCore))}`;
      const corruptResultFingerprint = hash(
        bytes({ schemaVersion: "M04_RESULT_V1", resultId: corruptResultId, ...corruptCore }),
      );
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `UPDATE m04_binding_results
              SET id=$1,binding_id=$2,canonical_payload=$3,result_fingerprint=$4
            WHERE id=$5`,
          [
            corruptResultId,
            corruptBindingId,
            bytes(corruptCore),
            corruptResultFingerprint,
            originalResult.id,
          ],
        );
        await client.query(
          `UPDATE m04_binding_requests SET binding_id=$1,result_id=$2 WHERE result_id=$3`,
          [corruptBindingId, corruptResultId, originalResult.id],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      const bindingCorruptionState = await persistedState();
      expect(await adapter.persistAccepted(await candidate("key-1"))).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
      expect(
        (
          await client.query<{ requests: number; results: number }>(
            `SELECT (SELECT count(*)::int FROM m04_binding_requests) requests,
                    (SELECT count(*)::int FROM m04_binding_results) results`,
          )
        ).rows[0],
      ).toEqual(originalCounts);
      expect(await persistedState()).toBe(bindingCorruptionState);
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          `UPDATE m04_binding_requests SET binding_id=$1,result_id=$2 WHERE result_id=$3`,
          [originalRequest.binding_id, originalRequest.result_id, corruptResultId],
        );
        await client.query(
          `UPDATE m04_binding_results
              SET id=$1,binding_id=$2,canonical_payload=$3,result_fingerprint=$4
            WHERE id=$5`,
          [
            originalResult.id,
            originalResult.binding_id,
            originalResult.canonical_payload,
            originalResult.result_fingerprint,
            corruptResultId,
          ],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      expect(await adapter.persistAccepted(await candidate("key-1"))).toMatchObject({
        kind: "ACCEPTED",
        replayed: true,
      });
    } finally {
      client.release();
    }
  }, 240_000);

  it("preserves byte-exact encoded idempotency keys under hostile collation", async () => {
    await pool.query(
      `CREATE COLLATION public.m04_numeric_icu (provider=icu, locale='und-u-kn', deterministic=false)`,
    );
    const hostileComparison = await pool.query<{ equal: boolean }>(
      `SELECT '00'::text COLLATE public.m04_numeric_icu =
              '0000'::text COLLATE public.m04_numeric_icu AS equal`,
    );
    expect(hostileComparison.rows[0]?.equal).toBe(true);
    const nulKey = await candidate("\u0000");
    const doubleNulKey = await candidate("\u0000\u0000");
    const distinctKeyResults = await Promise.all([
      adapter.persistAccepted(nulKey),
      adapter.persistAccepted(doubleNulKey),
    ]);
    expect(distinctKeyResults).toEqual([
      expect.objectContaining({ kind: "ACCEPTED", replayed: true }),
      expect.objectContaining({ kind: "ACCEPTED", replayed: true }),
    ]);
    const distinctRows = await pool.query<{
      idempotency_key: string;
      request_canonical_payload: Buffer;
    }>(
      `SELECT idempotency_key,request_canonical_payload
         FROM m04_persistence.m04_binding_requests
        WHERE idempotency_key IN ('00','0000') ORDER BY idempotency_key COLLATE pg_catalog."C"`,
    );
    expect(distinctRows.rows).toEqual([
      {
        idempotency_key: "00",
        request_canonical_payload: Buffer.from(nulKey.requestCanonicalPayload),
      },
      {
        idempotency_key: "0000",
        request_canonical_payload: Buffer.from(doubleNulKey.requestCanonicalPayload),
      },
    ]);
    expect(await adapter.persistAccepted(nulKey)).toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
    });
    expect(await adapter.persistAccepted(doubleNulKey)).toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
    });
    const concurrentSameNulKey = await Promise.all([
      adapter.persistAccepted(nulKey),
      adapter.persistAccepted(nulKey),
    ]);
    expect(concurrentSameNulKey).toEqual([
      expect.objectContaining({ kind: "ACCEPTED", replayed: true }),
      expect.objectContaining({ kind: "ACCEPTED", replayed: true }),
    ]);
    expect(
      await adapter.persistAccepted(await candidate("\u0000", "different-resource")),
    ).toMatchObject({
      kind: "REJECTED",
      error: "IDEMPOTENCY_KEY_REUSED",
    });
    const keyCorruption = await pool.connect();
    try {
      await keyCorruption.query("SET session_replication_role=replica");
      await keyCorruption.query(
        `UPDATE m04_persistence.m04_binding_requests SET idempotency_key='62'
          WHERE idempotency_key='00'`,
      );
    } finally {
      await keyCorruption.query("SET session_replication_role=origin");
      keyCorruption.release();
    }
    try {
      expect(await adapter.persistAccepted(nulKey)).toMatchObject({
        kind: "FAILED",
        error: "PERSISTENCE_INTEGRITY_FAILED",
      });
    } finally {
      const restoreKey = await pool.connect();
      try {
        await restoreKey.query("SET session_replication_role=replica");
        await restoreKey.query(
          `UPDATE m04_persistence.m04_binding_requests SET idempotency_key='00'
            WHERE idempotency_key='62'`,
        );
      } finally {
        await restoreKey.query("SET session_replication_role=origin");
        restoreKey.release();
      }
    }
  }, 240_000);

  it("persists canonical variants and reconstructs a restored database", async () => {
    const variant = await candidate(
      "key-variant\u0000",
      "resource-existing",
      await createGenuineM03BundleFixture(1e-7, "Technical\u0000reviewers\u0000"),
    );
    expect(Buffer.from(variant.bundleCanonicalPayload).toString("utf8")).toContain("1e-7");
    expect(Buffer.from(variant.bundleCanonicalPayload).toString("utf8")).toContain("\\u0000");
    const variantDocument = variant.bundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT",
    );
    if (variantDocument === undefined) throw new Error("M04_VARIANT_DOCUMENT_REFERENCE_REQUIRED");
    const predecessorClient = await pool.connect();
    try {
      await predecessorClient.query("SET session_replication_role=replica");
      await predecessorClient.query(
        `UPDATE m04_persistence.resource_candidates
            SET status='IDENTITY_RESOLVED',identity_outcome='NEW_RESOURCE'
          WHERE id='candidate-1'`,
      );
      await predecessorClient.query(
        "UPDATE m04_persistence.m01_source_entries SET content_fingerprint=$1 WHERE id='entry-m04'",
        [variantDocument.contentHash],
      );
      await predecessorClient.query(
        "UPDATE m04_persistence.m01_source_documents SET content_fingerprint=$1 WHERE id='document-m04'",
        [variantDocument.contentHash],
      );
    } finally {
      await predecessorClient.query("SET session_replication_role=origin");
      predecessorClient.release();
    }
    const variantFirst = await adapter.persistAccepted(variant);
    expect(variantFirst).toMatchObject({
      kind: "ACCEPTED",
      replayed: false,
    });
    const variantRequestsBeforeReplay = await pool.query<{ count: string }>(
      `SELECT count(*)::text count FROM m04_persistence.m04_binding_requests
        WHERE idempotency_key=$1`,
      [Buffer.from("key-variant\u0000", "utf8").toString("hex")],
    );
    expect(variantRequestsBeforeReplay.rows[0]?.count).toBe("1");
    expect(await adapter.persistAccepted(variant)).toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
    });
    const metadataBundle = await bundleWithFileMetadata();
    const metadataDocument = metadataBundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT" && reference.locator.type !== "FILE_METADATA",
    );
    if (metadataDocument === undefined) throw new Error("M04_METADATA_DOCUMENT_REQUIRED");
    const metadataPredecessor = await pool.connect();
    try {
      await metadataPredecessor.query("SET session_replication_role=replica");
      await metadataPredecessor.query(
        `UPDATE m04_persistence.m01_source_entries SET content_fingerprint=$1 WHERE id='entry-m04'`,
        [metadataDocument.contentHash],
      );
      await metadataPredecessor.query(
        `UPDATE m04_persistence.m01_source_documents SET content_fingerprint=$1 WHERE id='document-m04'`,
        [metadataDocument.contentHash],
      );
    } finally {
      await metadataPredecessor.query("SET session_replication_role=origin");
      metadataPredecessor.release();
    }
    const metadata = await candidate("key-metadata", "resource-existing", metadataBundle);
    expect(await adapter.persistAccepted(metadata)).toMatchObject({
      kind: "ACCEPTED",
      replayed: false,
    });
    const metadataReference = metadataBundle.sourceReferences.find(
      (reference) => reference.kind === "DOCUMENT" && reference.locator.type === "FILE_METADATA",
    );
    if (metadataReference === undefined) throw new Error("M04_METADATA_REFERENCE_REQUIRED");
    const metadataEvidence = await pool.query<{
      evidence_type: string;
      canonical_payload: Buffer;
    }>(
      `SELECT evidence_type,canonical_payload
         FROM m04_persistence.m04_evidence_items
        WHERE extraction_id=$1 AND m03_source_reference_id=$2`,
      [metadataBundle.extractionId, metadataReference.id],
    );
    expect(metadataEvidence.rows).toHaveLength(1);
    expect(metadataEvidence.rows[0]?.evidence_type).toBe("FILE_STRUCTURE");
    expect(
      JSON.parse(metadataEvidence.rows[0]?.canonical_payload.toString("utf8") ?? "null"),
    ).toMatchObject({
      excerptState: "NOT_APPLICABLE",
      excerptOrNull: null,
    });
    const variantPayloads = await pool.query<{
      bundle_payload: Buffer;
      request_payload: Buffer;
    }>(
      `SELECT string_agg(chunks.chunk_bytes,''::bytea ORDER BY chunks.chunk_ordinal) bundle_payload,
              request.request_canonical_payload request_payload
         FROM m04_persistence.m03_extraction_bundle_chunks chunks
         JOIN m04_persistence.m04_binding_results result ON result.extraction_id=chunks.extraction_id
         JOIN m04_persistence.m04_binding_requests request ON request.result_id=result.id
        WHERE chunks.extraction_id=$1
        GROUP BY request.id`,
      [variant.bundle.extractionId],
    );
    expect(variantPayloads.rows).toHaveLength(1);
    expect(variantPayloads.rows[0]?.bundle_payload).toEqual(
      Buffer.from(variant.bundleCanonicalPayload),
    );
    expect(variantPayloads.rows[0]?.request_payload).toEqual(
      Buffer.from(variant.requestCanonicalPayload),
    );
    const canonicalInventorySql = `
      SELECT table_name,id,payload_hash FROM (
        SELECT 'bundle' table_name,extraction_id id,canonical_payload_sha256 payload_hash
          FROM m04_persistence.m03_extraction_bundles
        UNION ALL SELECT 'chunk',extraction_id||':'||chunk_ordinal::text,chunk_sha256
          FROM m04_persistence.m03_extraction_bundle_chunks
        UNION ALL SELECT 'request',id,encode(pg_catalog.sha256(request_canonical_payload),'hex')
          FROM m04_persistence.m04_binding_requests
        UNION ALL SELECT 'evidence',id,encode(pg_catalog.sha256(canonical_payload),'hex')
          FROM m04_persistence.m04_evidence_items
        UNION ALL SELECT 'claim',id,encode(pg_catalog.sha256(canonical_payload),'hex')
          FROM m04_persistence.m04_claims
        UNION ALL SELECT 'link',id,encode(pg_catalog.sha256(canonical_payload),'hex')
          FROM m04_persistence.m04_claim_evidence_links
        UNION ALL SELECT 'completeness',id,encode(pg_catalog.sha256(canonical_payload),'hex')
          FROM m04_persistence.m04_completeness_snapshots
        UNION ALL SELECT 'result',id,encode(pg_catalog.sha256(canonical_payload),'hex')
          FROM m04_persistence.m04_binding_results
      ) records ORDER BY table_name,id`;
    const beforeRecovery = await pool.query(canonicalInventorySql);
    const distinctRows = await pool.query<{
      idempotency_key: string;
      request_canonical_payload: Buffer;
    }>(
      `SELECT idempotency_key,request_canonical_payload
         FROM m04_persistence.m04_binding_requests
        WHERE idempotency_key IN ('00','0000') ORDER BY idempotency_key COLLATE pg_catalog."C"`,
    );
    const sourceUrl = new URL(harness.connectionUri());
    const sourceDatabase = sourceUrl.pathname.slice(1);
    const restoreDatabase = "m04_recovery_restore";
    await pool.query(`CREATE DATABASE ${restoreDatabase}`);
    const dumpPath = "/tmp/ai-ark-m04-recovery.dump";
    const dump = await harness.execInContainer([
      "pg_dump",
      "-U",
      decodeURIComponent(sourceUrl.username),
      "-d",
      sourceDatabase,
      "-Fc",
      "-f",
      dumpPath,
    ]);
    expect(dump, dump.output).toMatchObject({ exitCode: 0 });
    const restore = await harness.execInContainer([
      "pg_restore",
      "-U",
      decodeURIComponent(sourceUrl.username),
      "-d",
      restoreDatabase,
      "--no-owner",
      dumpPath,
    ]);
    expect(restore, restore.output).toMatchObject({ exitCode: 0 });
    const restoreUrl = new URL(harness.connectionUri());
    restoreUrl.pathname = `/${restoreDatabase}`;
    const restoreClient = new Client({ connectionString: restoreUrl.toString() });
    await restoreClient.connect();
    try {
      await harness.execInContainer(["rm", "-f", dumpPath]);
      await restoreClient.query("SET search_path TO m04_persistence, public");
      const afterRecovery = await restoreClient.query(canonicalInventorySql);
      expect(afterRecovery.rows).toEqual(beforeRecovery.rows);
      const restoredKeys = await restoreClient.query(
        `SELECT idempotency_key,request_canonical_payload
           FROM m04_binding_requests
          WHERE idempotency_key IN ('00','0000') ORDER BY idempotency_key COLLATE pg_catalog."C"`,
      );
      expect(restoredKeys.rows).toEqual(distinctRows.rows);
      for (const extractionId of [
        firstExtractionId,
        emptyExtractionId,
        variant.bundle.extractionId,
        metadataBundle.extractionId,
      ])
        await expect(
          restoreClient.query("SELECT m04_assert_binding_closure($1)", [extractionId]),
        ).resolves.toBeDefined();
      await restoreClient.query("SET session_replication_role=replica");
      try {
        await restoreClient.query(
          "UPDATE m04_binding_requests SET idempotency_key='62' WHERE idempotency_key='00'",
        );
      } finally {
        await restoreClient.query("SET session_replication_role=origin");
      }
      await expect(
        restoreClient.query("SELECT m04_assert_binding_closure($1)", [firstExtractionId]),
      ).rejects.toThrow("M04_FULL_CLOSURE_REQUEST_INVALID");
    } finally {
      await restoreClient.end();
    }
  }, 240_000);
});
