import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  EvidenceCompletenessV1Schema,
  canonicalJsonM03,
  type EvidenceBindingRequestV1,
  type StructuredExtractionBundleV2,
} from "@ai-ark/contracts";
import {
  m03LogicalProjection,
  projectEvidenceBinding,
  type EvidenceBindingCandidateV1,
} from "@ai-ark/evidence";
import { PostgresEvidencePersistenceAdapterV1 } from "@ai-ark/job-queue";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript migration module is exercised directly by this integration test.
import { loadMigrations, renderMigrationSql } from "../../../scripts/db-common.mjs";
import { seedM02ProductionGraph } from "./m02-postgres-fixture.js";
import {
  M03_GENUINE_ACQUISITION_RESULT,
  M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
  M03_GENUINE_FIXTURE_TIMESTAMPS,
  createGenuineM03BundleFixture,
} from "./m03-genuine-bundle-fixture.js";
import { EphemeralPostgresHarness } from "./postgres-harness.js";
import { createM04CombinedMaximumBundleFixture } from "./m04-combined-maximum-fixture.js";

const schema = "m04_persistence";
const sourceContent = "## Target users\nTechnical reviewers.";
const sourceHash = createHash("sha256").update(sourceContent).digest("hex");
const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const bytes = (value: unknown): Buffer => Buffer.from(canonicalJsonM03(value), "utf8");

function candidate(
  bundle: StructuredExtractionBundleV2,
  idempotencyKey: string,
): EvidenceBindingCandidateV1 {
  const request: EvidenceBindingRequestV1 = {
    schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
    idempotencyKey,
    extractionId: bundle.extractionId,
    expectedM03OutputFingerprint: bundle.outputFingerprint,
    expectedResourceIdentityId: "resource-existing",
    expectedResourceVersionIdentityId: "version-prior",
    expectedSourceSnapshotId: "snapshot-m04",
    expectedSourceRevision: "b".repeat(40),
    expectedPredecessorState: M03_GENUINE_EXPECTED_PREDECESSOR_STATE,
    evidencePolicyVersion: "m04-evidence-policy-v1",
    materialFieldRegistryVersion: "m04-material-fields-v1",
  };
  const requestCanonicalPayload = bytes(request);
  const { idempotencyKey: _omitted, ...semantic } = request;
  void _omitted;
  const bundleCanonicalPayload = bytes(bundle);
  const logicalPayload = bytes(m03LogicalProjection(bundle));
  return {
    request,
    requestCanonicalPayload,
    requestFingerprint: hash(requestCanonicalPayload),
    semanticRequestFingerprint: hash(bytes(semantic)),
    bundle,
    bundleCanonicalPayload,
    bundleCanonicalSha256: hash(bundleCanonicalPayload),
    logicalPayload,
    logicalPayloadSha256: hash(logicalPayload),
    ...projectEvidenceBinding(bundle),
  };
}

/* eslint-disable @typescript-eslint/no-unsafe-return -- transparent query proxy retains the pg Promise result */
function pauseAfterResultPool(
  base: Pool,
  reached: () => void,
  released: Promise<void>,
  rollback: boolean,
): Pool {
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
              const result = await Reflect.apply(target.query.bind(target), target, args);
              if (
                typeof sql === "string" &&
                sql.trimStart().startsWith('INSERT INTO "m04_persistence".m04_binding_results')
              ) {
                reached();
                await released;
                if (rollback) throw new Error("M04_SYNTHETIC_RACE_ROLLBACK");
              }
              return result;
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
function commitIncompletePool(
  base: Pool,
  boundary: string,
  outcome: { code?: string; message?: string },
): Pool {
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
              if (typeof sql === "string" && sql.trimStart().startsWith(boundary)) {
                try {
                  await target.query("COMMIT");
                  outcome.code = "SUCCEEDED";
                } catch (error) {
                  outcome.code = (error as { code?: string }).code ?? "UNKNOWN";
                  outcome.message = (error as Error).message;
                  throw error;
                }
                throw new Error("M04_INCOMPLETE_COMMIT_UNEXPECTEDLY_SUCCEEDED");
              }
              return Reflect.apply(target.query.bind(target), target, args);
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}

function profiledPool(
  base: Pool,
  timings: Map<string, { count: number; elapsedMs: number }>,
): Pool {
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
                    : "";
              const statement = typeof sql === "string" ? sql.trimStart() : "";
              const label = statement.startsWith("INSERT INTO")
                ? statement.includes("m04_claim_evidence_links")
                  ? "INSERT_LINKS"
                  : statement.includes("m04_evidence_items")
                    ? "INSERT_EVIDENCE"
                    : statement.includes("m04_claims")
                      ? "INSERT_CLAIMS"
                      : "INSERT_OTHER"
                : statement.startsWith("SET CONSTRAINTS")
                  ? "CLOSURE"
                  : statement.startsWith("SELECT request.id AS request_id")
                    ? "READ_BINDING_CLOSURE"
                    : statement.startsWith("SELECT bundle.extraction_id")
                      ? "READ_BUNDLE_CANDIDATES"
                      : statement.includes("pg_catalog") ||
                          statement.includes("pg_") ||
                          statement.includes("has_table_privilege")
                        ? "AUTHORITY_CATALOG"
                        : "OTHER";
              const started = Date.now();
              try {
                return await Reflect.apply(target.query.bind(target), target, args);
              } finally {
                const timing = timings.get(label) ?? { count: 0, elapsedMs: 0 };
                timing.count += 1;
                timing.elapsedMs += Date.now() - started;
                timings.set(label, timing);
              }
            };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  } as unknown as Pool;
}
/* eslint-enable @typescript-eslint/no-unsafe-return */

async function prepareDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}, public`);
    for (const name of ["001_m01_acquisition_jobs.sql", "002_m02_classification_identity.sql"])
      await client.query(
        await readFile(new URL(`../../job-queue/migrations/${name}`, import.meta.url), "utf8"),
      );
    await seedM02ProductionGraph(pool, schema);
    await client.query(
      `INSERT INTO source_snapshots(id,identity_key,provider,provider_repository_id,immutable_revision,acquisition_policy_version,acquired_at)
       VALUES ('snapshot-m04','m04-key','github','repo-1',$1,'acquisition-v1',$2)`,
      ["b".repeat(40), M03_GENUINE_FIXTURE_TIMESTAMPS.acquiredAt],
    );
    await client.query(
      `INSERT INTO m01_source_entries
       (id,source_snapshot_id,original_path,normalized_path,entry_kind,byte_length,disposition,reason_codes,content_fingerprint)
       VALUES ('entry-m04','snapshot-m04','SKILL.md','SKILL.md','file',$1,'ACQUIRED','[]',$2),
              ('unavailable-readme','snapshot-m04','README.md','README.md','file',0,'SKIPPED','["FILE_TOO_LARGE"]',NULL)`,
      [Buffer.byteLength(sourceContent), sourceHash],
    );
    await client.query(
      `INSERT INTO m01_source_documents
       (id,source_snapshot_id,source_entry_id,document_type,encoding,line_count,content_fingerprint)
       VALUES ('document-m04','snapshot-m04','entry-m04','UTF8_TEXT','utf-8',2,$1)`,
      [sourceHash],
    );
    await client.query("SET session_replication_role=replica");
    try {
      await client.query(
        `UPDATE acquisition_jobs SET status='COMPLETED',current_stage='INVENTORYING_SOURCE',
          source_snapshot_id='snapshot-m04',cancellation_requested=false,record_version=1 WHERE id='job-1'`,
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
        "UPDATE repository_candidate_groups SET source_snapshot_id='snapshot-m04' WHERE id='group-1'",
      );
      await client.query(
        "UPDATE repository_classification_runs SET source_snapshot_id='snapshot-m04' WHERE id='run-1'",
      );
      await client.query(
        "DELETE FROM classification_evidence_references WHERE classification_run_id='run-1'",
      );
      await client.query(
        `UPDATE candidate_roots SET source_snapshot_id='snapshot-m04',normalized_root_path='.',
          candidate_root_fingerprint=$1,candidate_content_fingerprint=$2,state='ACTIVE',record_version=1
          WHERE id='root-1'`,
        ["a".repeat(64), "c".repeat(64)],
      );
      await client.query(
        `UPDATE candidate_root_ownership SET source_snapshot_id='snapshot-m04',
          source_entry_id='entry-m04',ownership='OWNED' WHERE id='ownership-1'`,
      );
      await client.query(
        `UPDATE repository_candidate_root_order SET source_snapshot_id='snapshot-m04',
          root_ordinal=0 WHERE id='root-order-1'`,
      );
      await client.query(
        `UPDATE resource_candidates SET source_snapshot_id='snapshot-m04',
          candidate_root_fingerprint=$1,candidate_content_fingerprint=$2,
          identity_outcome='NEW_RESOURCE',status='IDENTITY_RESOLVED',
          resource_identity_id='resource-existing',resource_version_identity_id='version-prior',
          record_version=1 WHERE id='candidate-1'`,
        ["a".repeat(64), "c".repeat(64)],
      );
      await client.query(
        `UPDATE resource_version_identities SET first_observed_source_snapshot_id='snapshot-m04',
          first_observed_source_revision=$1,first_observed_candidate_root_id='root-1'
          WHERE first_observed_candidate_root_id='root-1'`,
        ["b".repeat(40)],
      );
      await client.query(
        `UPDATE m02_jobs SET source_snapshot_id='snapshot-m04',operation_scope='FULL_PIPELINE',
          current_stage='RESOLVING_IDENTITY',review_state='RESOLVED',
          supersession_state='CONTROLLING',controlling_classification_decision_id='run-1',
          record_version=1 WHERE id='job-1'`,
      );
      await client.query(
        `UPDATE identity_decisions SET outcome='NEW_RESOURCE',matched_tier=NULL,confidence=1,
          identity_policy_version='identity-v1',decision_source='HUMAN_COMMAND',state='ACTIVE',
          record_version=1 WHERE id='decision-seed'`,
      );
      await client.query(
        `UPDATE m02_review_states SET group_id='group-1',resource_candidate_id='candidate-1',
          review_state='RESOLVED',source_snapshot_id='snapshot-m04',controlling_job_id='job-1',
          superseded_by_review_id=NULL,record_version=1 WHERE id='review-1'`,
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
        ["b".repeat(40), M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt],
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
    const migration = (await loadMigrations())[2];
    if (migration === undefined) throw new Error("M04_MIGRATION_REQUIRED");
    await client.query(renderMigrationSql(migration.sql, schema, migration.manifest));
  } finally {
    client.release();
  }
}

async function persistedState(
  pool: Pool,
): Promise<readonly { table: string; count: number; rowSha256: string }[]> {
  const tables = [
    "schema_migrations",
    "m03_m04_predecessor_fence",
    "m03_extraction_bundles",
    "m03_extraction_bundle_chunks",
    "m04_binding_requests",
    "m04_evidence_items",
    "m04_claims",
    "m04_claim_evidence_links",
    "m04_completeness_snapshots",
    "m04_binding_results",
  ] as const;
  const state: { table: string; count: number; rowSha256: string }[] = [];
  for (const table of tables) {
    const result = await pool.query<{ row: string }>(
      `SELECT to_jsonb(t)::text AS row FROM ${schema}.${table} t
        ORDER BY to_jsonb(t)::text COLLATE pg_catalog."C"`,
    );
    state.push({ table, count: result.rows.length, rowSha256: hash(JSON.stringify(result.rows)) });
  }
  return state;
}

describe("M04 genuine completeness alternate-key reachability", () => {
  const harness = new EphemeralPostgresHarness();
  let adminA: Pool;
  let adminB: Pool;
  let runtimeA: Pool;
  let runtimeB: Pool;
  let adapterA: PostgresEvidencePersistenceAdapterV1;
  let adapterB: PostgresEvidencePersistenceAdapterV1;

  beforeAll(async () => {
    adminA = await harness.start();
    await adminA.query("CREATE DATABASE ai_ark_m04_second");
    const secondUri = new URL(harness.connectionUri());
    secondUri.pathname = "/ai_ark_m04_second";
    adminB = new Pool({ connectionString: secondUri.toString(), max: 4 });
    await prepareDatabase(adminA);
    await prepareDatabase(adminB);
    runtimeA = new Pool({ connectionString: harness.connectionUriForRole("ai_ark_m04_login") });
    runtimeB = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m04_login", "ai_ark_m04_second"),
    });
    const options = {
      schema,
      loginRole: "ai_ark_m04_login",
      peerLoginRole: "ai_ark_m01_m02_login",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    };
    adapterA = await PostgresEvidencePersistenceAdapterV1.open(runtimeA, options);
    adapterB = await PostgresEvidencePersistenceAdapterV1.open(runtimeB, options);
  }, 480_000);

  afterAll(async () => {
    await runtimeA.end();
    await runtimeB.end();
    await adminB.end();
    await harness.stop();
  });

  it.each([
    ["parent", "m03_extraction_bundle_chunks"],
    ["children", "m04_binding_results"],
    ["result", "m04_binding_requests"],
  ] as const)(
    "rejects committing an incomplete %s without sealed closure",
    async (stage, table) => {
      const database = `m04_incomplete_${stage}`;
      await adminA.query(`CREATE DATABASE ${database}`);
      const uri = new URL(harness.connectionUri());
      uri.pathname = `/${database}`;
      const admin = new Pool({ connectionString: uri.toString() });
      const runtime = new Pool({
        connectionString: harness.connectionUriForRole("ai_ark_m04_login", database),
      });
      try {
        await prepareDatabase(admin);
        const bundle = await createGenuineM03BundleFixture(
          0.9,
          "Technical reviewers",
          "FILE_TOO_LARGE",
          false,
          true,
        );
        const outcome: { code?: string; message?: string } = {};
        const adapter = await PostgresEvidencePersistenceAdapterV1.open(
          commitIncompletePool(runtime, `INSERT INTO "m04_persistence".${table}`, outcome),
          { schema, loginRole: "ai_ark_m04_login", peerLoginRole: "ai_ark_m01_m02_login" },
        );
        expect(
          await adapter.persistAccepted(candidate(bundle, `incomplete-${stage}`)),
        ).toMatchObject({ kind: "FAILED" });
        expect(outcome.code).toBe("P0001");
        expect(outcome.message).toMatch(/M04_(?:BUNDLE|FULL_CLOSURE)/u);
        for (const relation of [
          "m03_extraction_bundles",
          "m03_extraction_bundle_chunks",
          "m04_evidence_items",
          "m04_claims",
          "m04_claim_evidence_links",
          "m04_completeness_snapshots",
          "m04_binding_results",
          "m04_binding_requests",
        ]) {
          const rows = await admin.query<{ count: string }>(
            `SELECT count(*)::text count FROM ${schema}.${relation}`,
          );
          expect(rows.rows[0]?.count, relation).toBe("0");
        }
      } finally {
        await runtime.end();
        await admin.end();
      }
    },
    240_000,
  );

  it.each([
    ["READ COMMITTED", "evidence", false, false],
    ["READ COMMITTED", "link", false, false],
    ["READ COMMITTED", "chunk", false, false],
    ["READ COMMITTED", "evidence", true, false],
    ["READ COMMITTED", "link", true, false],
    ["READ COMMITTED", "chunk", true, false],
    ["REPEATABLE READ", "evidence", false, false],
    ["REPEATABLE READ", "link", false, false],
    ["REPEATABLE READ", "chunk", false, false],
    ["SERIALIZABLE", "evidence", false, false],
    ["SERIALIZABLE", "link", false, false],
    ["SERIALIZABLE", "chunk", false, false],
    ["REPEATABLE READ", "evidence", false, true],
    ["REPEATABLE READ", "link", false, true],
    ["REPEATABLE READ", "chunk", false, true],
    ["SERIALIZABLE", "evidence", false, true],
    ["SERIALIZABLE", "link", false, true],
    ["SERIALIZABLE", "chunk", false, true],
  ] as const)(
    "rejects a late %s %s after an uncommitted parent (rollback=%s, oldSnapshot=%s)",
    async (isolation, surface, rollback, oldSnapshot) => {
      const database = `m04_race_${isolation.replaceAll(" ", "_").toLowerCase()}_${surface}_${rollback ? "rollback" : "commit"}${oldSnapshot ? "_old" : ""}`;
      await adminA.query(`CREATE DATABASE ${database}`);
      const uri = new URL(harness.connectionUri());
      uri.pathname = `/${database}`;
      const admin = new Pool({ connectionString: uri.toString() });
      const runtime = new Pool({
        connectionString: harness.connectionUriForRole("ai_ark_m04_login", database),
      });
      let releaseBinding: () => void = () => undefined;
      const released = new Promise<void>((resolve) => {
        releaseBinding = resolve;
      });
      let bindingReached: () => void = () => undefined;
      const reached = new Promise<void>((resolve) => {
        bindingReached = resolve;
      });
      let hostile: PoolClient | undefined;
      let binding: ReturnType<PostgresEvidencePersistenceAdapterV1["persistAccepted"]> | undefined;
      try {
        await prepareDatabase(admin);
        const catalog = await admin.query<{
          relation: string;
          name: string;
          type: number;
          deferred: boolean;
          volatility: string;
          fk_before_guard: boolean;
        }>(
          `SELECT c.relname relation,t.tgname name,t.tgtype type,t.tgdeferrable deferred,
                  p.provolatile volatility,
                  EXISTS (SELECT 1 FROM pg_trigger fk
                    JOIN pg_constraint constraint_row ON constraint_row.oid=fk.tgconstraint
                    JOIN pg_class parent ON parent.oid=constraint_row.confrelid
                    WHERE fk.tgrelid=t.tgrelid
                    AND fk.tgisinternal AND (fk.tgtype & 4)=4 AND NOT fk.tgdeferrable
                    AND fk.tgenabled='O' AND constraint_row.contype='f'
                    AND constraint_row.convalidated AND NOT constraint_row.condeferrable
                    AND parent.relnamespace=c.relnamespace
                    AND parent.relname=CASE WHEN c.relname='m04_claim_evidence_links'
                      THEN 'm04_claims' ELSE 'm03_extraction_bundles' END
                    AND NOT EXISTS (SELECT 1 FROM unnest(constraint_row.conkey) key(attnum)
                      JOIN pg_attribute attribute ON attribute.attrelid=c.oid AND attribute.attnum=key.attnum
                      WHERE NOT attribute.attnotnull)
                    AND fk.tgname COLLATE "C" < t.tgname COLLATE "C") fk_before_guard
             FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
            WHERE n.nspname=$1 AND t.tgenabled='O' AND t.tgname=ANY($2::text[])`,
          [
            schema,
            [
              "m04_bundle_chunks_closure",
              "m04_full_evidence_closure",
              "m04_full_claim_closure",
              "m04_full_link_closure",
              "m04_full_completeness_closure",
            ],
          ],
        );
        expect(catalog.rows).toHaveLength(5);
        for (const row of catalog.rows)
          expect(row).toMatchObject({
            type: 5,
            deferred: false,
            volatility: "v",
            fk_before_guard: true,
          });
        const bundle = await createGenuineM03BundleFixture(
          0.9,
          "Technical reviewers",
          "FILE_TOO_LARGE",
          false,
          true,
        );
        const projected = candidate(bundle, "late-child-race");
        const adapter = await PostgresEvidencePersistenceAdapterV1.open(
          pauseAfterResultPool(runtime, bindingReached, released, rollback),
          { schema, loginRole: "ai_ark_m04_login", peerLoginRole: "ai_ark_m01_m02_login" },
        );
        hostile = await runtime.connect();
        await hostile.query(`BEGIN ISOLATION LEVEL ${isolation}`);
        await hostile.query(`SELECT count(*) FROM ${schema}.source_snapshots`);
        const hostilePid = (await hostile.query<{ pid: number }>("SELECT pg_backend_pid() pid"))
          .rows[0]?.pid;
        binding = adapter.persistAccepted(projected);
        await Promise.race([
          reached,
          binding.then((result) => {
            throw new Error(`M04_RACE_BARRIER_NOT_REACHED:${result.kind}`);
          }),
        ]);
        let sql: string;
        let values: unknown[];
        if (surface === "evidence") {
          const original = projected.evidenceItems[0];
          if (original === undefined) throw new Error("M04_RACE_EVIDENCE_REQUIRED");
          const { id: _id, recordFingerprint: _fingerprint, ...core } = original;
          void _id;
          void _fingerprint;
          const changed = { ...core, m03SourceReferenceId: `src_${hash("late-child")}` };
          const identified = { ...changed, id: `evi_${hash(bytes(changed))}` };
          const record = { ...identified, recordFingerprint: hash(bytes(identified)) };
          sql = `INSERT INTO ${schema}.m04_evidence_items
            (id,extraction_id,m03_source_reference_id,source_snapshot_id,source_revision,source_entry_id,source_document_id,evidence_type,canonical_payload,record_fingerprint,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`;
          values = [
            record.id,
            record.extractionId,
            record.m03SourceReferenceId,
            record.sourceSnapshotId,
            record.sourceRevision,
            record.sourceEntryIdOrNull,
            record.sourceDocumentIdOrNull,
            record.evidenceType,
            bytes(record),
            record.recordFingerprint,
          ];
        } else if (surface === "chunk") {
          const chunk = Buffer.from("{}");
          sql = `INSERT INTO ${schema}.m03_extraction_bundle_chunks
            (extraction_id,chunk_ordinal,chunk_bytes,chunk_sha256) VALUES ($1,$2,$3,$4)`;
          values = [
            projected.bundle.extractionId,
            Math.ceil(projected.bundleCanonicalPayload.byteLength / 1_048_576),
            chunk,
            hash(chunk),
          ];
        } else {
          const original = projected.links[0];
          const extraEvidence = projected.evidenceItems.find(
            (item) =>
              !projected.links.some(
                (link) => link.claimId === original?.claimId && link.evidenceItemId === item.id,
              ),
          );
          if (original === undefined || extraEvidence === undefined)
            throw new Error("M04_RACE_LINK_REQUIRED");
          const { id: _id, recordFingerprint: _fingerprint, ...core } = original;
          void _id;
          void _fingerprint;
          const changed = {
            ...core,
            evidenceItemId: extraEvidence.id,
            m03SourceReferenceId: extraEvidence.m03SourceReferenceId,
            ordinal: 4095,
          };
          const identified = { ...changed, id: `cel_${hash(bytes(changed))}` };
          const record = { ...identified, recordFingerprint: hash(bytes(identified)) };
          sql = `INSERT INTO ${schema}.m04_claim_evidence_links
            (id,claim_id,evidence_item_id,m03_source_reference_id,ordinal,relationship,canonical_payload,record_fingerprint,created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`;
          values = [
            record.id,
            record.claimId,
            record.evidenceItemId,
            record.m03SourceReferenceId,
            record.ordinal,
            record.relationship,
            bytes(record),
            record.recordFingerprint,
          ];
        }
        if (oldSnapshot) {
          releaseBinding();
          expect(await binding).toMatchObject({ kind: "ACCEPTED" });
        }
        let settled = false;
        const pending = hostile.query(sql, values).then(
          () => {
            settled = true;
            return { code: "SUCCEEDED", message: "" };
          },
          (error: unknown) => {
            settled = true;
            return {
              code: (error as { code?: string }).code,
              message: (error as Error).message,
            };
          },
        );
        await expect
          .poll(
            async () =>
              (
                await admin.query<{ wait_event_type: string }>(
                  "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
                  [hostilePid],
                )
              ).rows[0]?.wait_event_type === "Lock" || settled,
            { timeout: 10_000 },
          )
          .toBe(true);
        releaseBinding();
        const accepted = await binding;
        expect(accepted.kind).toBe(rollback ? "FAILED" : "ACCEPTED");
        const rejected = await pending;
        expect(["P0001", "23503", "40001"]).toContain(rejected.code);
        if (rejected.code === "P0001") expect(rejected.message).toContain("M04_IMMUTABLE_RECORD");
        await hostile.query("ROLLBACK");
        if (!rollback) {
          // A new snapshot sees the committed parent. The immediate seal guard,
          // rather than the missing-parent FK, must reject this extension too.
          await expect(hostile.query(sql, values)).rejects.toMatchObject({
            code: "P0001",
            message: "M04_IMMUTABLE_RECORD",
          });
        }
        const counts = await admin.query<{ count: string }>(
          `SELECT count(*)::text count FROM ${schema}.m04_evidence_items`,
        );
        expect(Number(counts.rows[0]?.count)).toBe(rollback ? 0 : projected.evidenceItems.length);
        if (!rollback)
          expect(await adapter.persistAccepted(projected)).toMatchObject({
            kind: "ACCEPTED",
            replayed: true,
          });
      } finally {
        releaseBinding();
        await binding?.catch(() => undefined);
        if (hostile !== undefined) {
          await hostile.query("ROLLBACK").catch(() => undefined);
          hostile.release();
        }
        await runtime.end();
        await admin.end();
      }
    },
    240_000,
  );

  it("commits both genuine projections independently and classifies prospective RESULT_COMPLETENESS", async () => {
    const bundleA = await createGenuineM03BundleFixture(
      0.9,
      "Technical reviewers",
      "FILE_TOO_LARGE",
      false,
      true,
    );
    const bundleB = await createGenuineM03BundleFixture(
      0.9,
      "Other reviewers",
      "FILE_TOO_LARGE",
      false,
      true,
    );
    const projectedA = candidate(bundleA, "complete-zero-a");
    const projectedB = candidate(bundleB, "complete-zero-b");
    expect(bundleA.extractionId).not.toBe(bundleB.extractionId);
    expect(projectedA.completeness.coveredRequirements).toBe(0);
    expect(bytes(projectedA.completeness)).toEqual(bytes(projectedB.completeness));
    expect((await runtimeA.query("SELECT current_user")).rows[0]?.current_user).toBe(
      "ai_ark_m04_login",
    );
    expect((await runtimeB.query("SELECT current_user")).rows[0]?.current_user).toBe(
      "ai_ark_m04_login",
    );

    const acceptedA = await adapterA.persistAccepted(projectedA);
    expect(acceptedA, JSON.stringify(acceptedA)).toMatchObject({
      kind: "ACCEPTED",
      replayed: false,
    });
    const acceptedB = await adapterB.persistAccepted(projectedB);
    expect(acceptedB, JSON.stringify(acceptedB)).toMatchObject({
      kind: "ACCEPTED",
      replayed: false,
    });
    if (acceptedA.kind !== "ACCEPTED" || acceptedB.kind !== "ACCEPTED")
      throw new Error("M04_GENUINE_INDEPENDENT_COMMIT_REQUIRED");
    expect(acceptedA.resultFingerprint).not.toBe(acceptedB.resultFingerprint);
    const before = await persistedState(adminA);
    const conflict = await adapterA.persistAccepted(projectedB);
    expect(conflict, JSON.stringify(conflict)).toMatchObject({
      kind: "REJECTED",
      error: "ALTERNATE_UNIQUE_KEY_CONFLICT",
      diagnostics: [
        {
          alternateKeyKind: "RESULT_COMPLETENESS",
          expectedFingerprintOrNull: acceptedB.resultFingerprint,
          actualFingerprintOrNull: acceptedA.resultFingerprint,
          subjectIdOrNull: acceptedA.resultId,
        },
      ],
    });
    if (conflict.kind !== "REJECTED") throw new Error("M04_COMPLETENESS_CONFLICT_REQUIRED");
    const terminalCore = {
      kind: conflict.kind,
      requestFingerprint: conflict.requestFingerprint,
      error: conflict.error,
      diagnostics: conflict.diagnostics,
    };
    const terminalResultId = `m4r_${hash(bytes(terminalCore))}`;
    expect(conflict.resultId).toBe(terminalResultId);
    expect(conflict.resultFingerprint).toBe(
      hash(bytes({ schemaVersion: "M04_RESULT_V1", resultId: terminalResultId, ...terminalCore })),
    );
    expect(await persistedState(adminA)).toEqual(before);
    expect(await adapterA.persistAccepted(projectedA)).toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
      resultId: acceptedA.resultId,
    });
    const [retryOne, retryTwo] = await Promise.all([
      adapterA.persistAccepted(projectedB),
      adapterA.persistAccepted(projectedB),
    ]);
    expect(retryOne).toEqual(conflict);
    expect(retryTwo).toEqual(conflict);
    expect(await persistedState(adminA)).toEqual(before);
    const closureProbe = await adminA.connect();
    try {
      const link = (
        await closureProbe.query<{ id: string; canonical_payload: Buffer }>(
          `SELECT link.id,link.canonical_payload FROM ${schema}.m04_claim_evidence_links link
             JOIN ${schema}.m04_claims claim ON claim.id=link.claim_id
            WHERE claim.extraction_id=$1 ORDER BY link.id LIMIT 1`,
          [bundleA.extractionId],
        )
      ).rows[0];
      expect(link).toBeDefined();
      if (link === undefined) throw new Error("M04_LINK_CLOSURE_PROBE_MISSING");
      const original = JSON.parse(link.canonical_payload.toString("utf8")) as Record<
        string,
        unknown
      >;
      for (const forged of [
        {
          ...original,
          relationship: original.relationship === "SUPPORTS" ? "CONTEXT_ONLY" : "SUPPORTS",
        },
        { ...original, ordinal: Number(original.ordinal) + 1 },
        { ...original, evidenceItemId: `evi_${"f".repeat(64)}` },
      ]) {
        await closureProbe.query("BEGIN");
        try {
          // Only this disposable owner connection bypasses mutation triggers;
          // the canonical CHECK still runs. Rollback restores the original row.
          await closureProbe.query("SET LOCAL session_replication_role=replica");
          await closureProbe.query(
            `UPDATE ${schema}.m04_claim_evidence_links SET canonical_payload=$2 WHERE id=$1`,
            [link.id, bytes(forged)],
          );
          await closureProbe.query("SET LOCAL session_replication_role=origin");
          await expect(
            closureProbe.query(`SELECT ${schema}.m04_assert_binding_closure($1)`, [
              bundleA.extractionId,
            ]),
          ).rejects.toThrow(/M04_FULL_CLOSURE_LINK_INVALID/u);
        } finally {
          await closureProbe.query("ROLLBACK");
        }
      }
      await expect(
        closureProbe.query(`SELECT ${schema}.m04_assert_binding_closure($1)`, [
          bundleA.extractionId,
        ]),
      ).resolves.toBeDefined();
    } finally {
      closureProbe.release();
    }
    expect(await persistedState(adminA)).toEqual(before);
  }, 240_000);

  it("binds the schema-valid combined maximum and reconstructs every canonical chunk", async ({
    signal,
    onTestFinished,
  }) => {
    const diagnosticStartedAt = Date.now();
    const bundle = await createM04CombinedMaximumBundleFixture();
    const projected = candidate(bundle, "combined-maximum-probe");
    if (process.env.AI_ARK_M04_MAX_TRACE === "1")
      process.stderr.write(`M04_MAX_PROJECTION_MS=${String(Date.now() - diagnosticStartedAt)}\n`);
    expect(projected.evidenceItems).toHaveLength(4096);
    expect(projected.claims).toHaveLength(20);
    expect(projected.links).toHaveLength(81_920);
    expect(EvidenceCompletenessV1Schema.safeParse(projected.completeness).success).toBe(true);
    expect(projected.bundleCanonicalPayload.byteLength).toBeGreaterThan(1_048_576);

    await adminA.query("CREATE DATABASE ai_ark_m04_maximum");
    const uri = new URL(harness.connectionUri());
    uri.pathname = "/ai_ark_m04_maximum";
    const admin = new Pool({ connectionString: uri.toString(), max: 4 });
    const runtime = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m04_login", "ai_ark_m04_maximum"),
    });
    const poolFailures: string[] = [];
    const pools: Pool[] = [];
    const poolClosures = new Map<Pool, Promise<void>>();
    const registerPool = (pool: Pool) => {
      pools.push(pool);
      pool.on("error", (error: Error & { code?: string }) => {
        // Do not allow pg's attached client/connection parameters into failure logs.
        poolFailures.push(error.code ?? "PG_POOL_ERROR");
      });
    };
    registerPool(runtime);
    registerPool(admin);
    const closePool = (pool: Pool): Promise<void> => {
      const existing = poolClosures.get(pool);
      if (existing !== undefined) return existing;
      const pending = pool.end();
      poolClosures.set(pool, pending);
      return pending;
    };
    let allPoolClosure: Promise<void> | undefined;
    const closePools = () => {
      allPoolClosure ??= (async () => {
        await Promise.all(pools.filter((pool) => pool !== admin).map(closePool));
        if (process.env.AI_ARK_M04_FUNCTION_TRACE === "1") {
          await admin.query("SELECT pg_stat_clear_snapshot()");
          const stats = await admin.query<{
            funcname: string;
            calls: string;
            total_time: number;
            self_time: number;
          }>(
            `SELECT funcname,calls::text,total_time,self_time FROM pg_stat_user_functions
              WHERE schemaname=$1 ORDER BY total_time DESC,funcname LIMIT 12`,
            [schema],
          );
          process.stderr.write(`M04_MAX_FUNCTION_TIMINGS=${JSON.stringify(stats.rows)}\n`);
        }
        await closePool(admin);
        expect(poolFailures).toEqual([]);
      })();
      return allPoolClosure;
    };
    onTestFinished(closePools);
    // A Vitest timeout does not stop an in-flight PostgreSQL query. Cancel only
    // sessions in this test's disposable database so teardown can drain pools;
    // the original fixed-limit failure remains the test outcome.
    const cancelOnTimeout = () => {
      void admin
        .query(
          `SELECT pg_cancel_backend(pid) FROM pg_stat_activity
          WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active'`,
        )
        .catch(() => undefined);
    };
    signal.addEventListener("abort", cancelOnTimeout, { once: true });
    const timings = new Map<string, { count: number; elapsedMs: number }>();
    try {
      await prepareDatabase(admin);
      if (process.env.AI_ARK_M04_FUNCTION_TRACE === "1")
        await admin.query("ALTER DATABASE ai_ark_m04_maximum SET track_functions='all'");
      if (process.env.AI_ARK_M04_MAX_TRACE === "1") {
        process.stderr.write(
          `M04_MAX_DATABASE_READY_MS=${String(Date.now() - diagnosticStartedAt)}\n`,
        );
      }
      const options = {
        schema,
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      };
      const adapter = await PostgresEvidencePersistenceAdapterV1.open(
        process.env.AI_ARK_M04_MAX_TRACE === "1" ? profiledPool(runtime, timings) : runtime,
        options,
      );
      if (process.env.AI_ARK_M04_MAX_TRACE === "1") {
        const diagnosticAdapter = adapter as unknown as {
          transaction(value: EvidenceBindingCandidateV1): Promise<unknown>;
        };
        const transaction = diagnosticAdapter.transaction.bind(adapter);
        diagnosticAdapter.transaction = async (value) => {
          try {
            return await transaction(value);
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            const reason = /^M04_[A-Z_]+$/u.test(message) ? message : "UNCLASSIFIED";
            const code = (error as { code?: unknown }).code;
            process.stderr.write(
              `M04_MAX_FAILURE=${reason} CODE=${typeof code === "string" && /^[A-Z0-9]{5}$/u.test(code) ? code : "NONE"}\n`,
            );
            throw error;
          }
        };
      }
      const monitor =
        process.env.AI_ARK_M04_MAX_TRACE === "1"
          ? setInterval(() => {
              void admin
                .query<{ state: string; query: string }>(
                  `SELECT state,query FROM pg_stat_activity
                    WHERE usename='ai_ark_m04_login' AND datname='ai_ark_m04_maximum'
                    ORDER BY pid LIMIT 1`,
                )
                .then(({ rows }) => {
                  const query = rows[0]?.query ?? "";
                  const phase = query.includes("m04_claim_evidence_links")
                    ? "LINKS"
                    : query.includes("m04_evidence_items")
                      ? "EVIDENCE"
                      : query.includes("m03_extraction_bundle_chunks")
                        ? "CHUNKS"
                        : query.includes("m04_claims")
                          ? "CLAIMS"
                          : "OTHER";
                  process.stderr.write(
                    `M04_MAX_PERSIST_MS=${String(Date.now() - diagnosticStartedAt)} PHASE=${phase} STATE=${rows[0]?.state ?? "NONE"}\n`,
                  );
                })
                .catch(() => undefined);
            }, 30_000)
          : undefined;
      let accepted: Awaited<ReturnType<typeof adapter.persistAccepted>>;
      try {
        accepted = await adapter.persistAccepted(projected);
      } finally {
        if (monitor !== undefined) clearInterval(monitor);
      }
      expect(accepted, JSON.stringify(accepted)).toMatchObject({
        kind: "ACCEPTED",
        replayed: false,
      });
      const tracePhase = (phase: string) => {
        if (process.env.AI_ARK_M04_MAX_TRACE === "1")
          process.stderr.write(
            `M04_MAX_PHASE=${phase} ELAPSED_MS=${String(Date.now() - diagnosticStartedAt)}\n`,
          );
      };
      tracePhase("ACCEPTED");
      const counts = await admin.query<{
        evidence: string;
        claims: string;
        links: string;
        chunks: string;
        reconstructed: Buffer;
      }>(
        `SELECT
           (SELECT count(*)::text FROM ${schema}.m04_evidence_items) evidence,
           (SELECT count(*)::text FROM ${schema}.m04_claims) claims,
           (SELECT count(*)::text FROM ${schema}.m04_claim_evidence_links) links,
           (SELECT count(*)::text FROM ${schema}.m03_extraction_bundle_chunks) chunks,
           (SELECT string_agg(chunk_bytes,''::bytea ORDER BY chunk_ordinal)
              FROM ${schema}.m03_extraction_bundle_chunks) reconstructed`,
      );
      expect({
        evidence: counts.rows[0]?.evidence,
        claims: counts.rows[0]?.claims,
        links: counts.rows[0]?.links,
      }).toEqual({ evidence: "4096", claims: "20", links: "81920" });
      expect(Number(counts.rows[0]?.chunks)).toBeGreaterThan(1);
      // Exact byte equality without a generic matcher enumerating 25 million
      // Buffer properties and exhausting the worker heap on a valid maximum.
      expect(
        counts.rows[0]?.reconstructed.equals(Buffer.from(projected.bundleCanonicalPayload)),
      ).toBe(true);
      tracePhase("RECONSTRUCTED");
      const replay = await adapter.persistAccepted(projected);
      expect(replay, JSON.stringify(replay)).toMatchObject({
        kind: "ACCEPTED",
        replayed: true,
      });
      const assertReplayIdentity = (result: typeof replay) => {
        if (accepted.kind !== "ACCEPTED" || result.kind !== "ACCEPTED")
          throw new Error("M04_MAXIMUM_REPLAY_NOT_ACCEPTED");
        expect(result.resultId).toBe(accepted.resultId);
        expect(result.resultFingerprint).toBe(accepted.resultFingerprint);
        expect(result.bindingId).toBe(accepted.bindingId);
        expect(bytes(result.completeness).equals(bytes(projected.completeness))).toBe(true);
        expect(bytes(result.completeness).equals(bytes(accepted.completeness))).toBe(true);
      };
      assertReplayIdentity(replay);
      tracePhase("REPLAYED");
      await closePool(runtime);
      const recovered = new Pool({
        connectionString: harness.connectionUriForRole("ai_ark_m04_login", "ai_ark_m04_maximum"),
      });
      registerPool(recovered);
      try {
        const restarted = await PostgresEvidencePersistenceAdapterV1.open(recovered, options);
        const recoveredReplay = await restarted.persistAccepted(projected);
        expect(recoveredReplay, JSON.stringify(recoveredReplay)).toMatchObject({
          kind: "ACCEPTED",
          replayed: true,
        });
        assertReplayIdentity(recoveredReplay);
        tracePhase("RECOVERED_REPLAY");
      } finally {
        await closePool(recovered);
      }
    } finally {
      signal.removeEventListener("abort", cancelOnTimeout);
      if (process.env.AI_ARK_M04_MAX_TRACE === "1") {
        process.stderr.write(
          `M04_MAX_QUERY_TIMINGS=${JSON.stringify(Object.fromEntries(timings))}\n`,
        );
      }
      await closePools();
    }
  }, 240_000);

  it("reports the first mutable predecessor before a later missing immutable row", async () => {
    const probeBundle = await createGenuineM03BundleFixture(
      0.9,
      "Other reviewers",
      "FILE_TOO_LARGE",
      false,
      true,
    );
    const probe = candidate(probeBundle, "predecessor-order-probe");
    const client = await adminA.connect();
    try {
      await client.query(`SET search_path TO ${schema}, public`);
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          "UPDATE m02_identity_handoff_markers SET record_version=2 WHERE id='handoff-1'",
        );
        await client.query("DELETE FROM acquisition_results WHERE job_id='job-1'");
      } finally {
        await client.query("SET session_replication_role=origin");
      }
      const reader = adapterA as unknown as {
        readPredecessor(
          connection: PoolClient,
          value: EvidenceBindingCandidateV1,
        ): Promise<{
          current: boolean;
          subjectId?: string;
          expectedFingerprint?: string;
          actualFingerprint?: string;
        }>;
      };
      const runtimeClient = await runtimeA.connect();
      try {
        const stale = await reader.readPredecessor(runtimeClient, probe);
        expect(stale).toMatchObject({
          current: false,
          subjectId: "handoff-1",
          expectedFingerprint: hash(bytes(probeBundle.m02InputProjection.handoff)),
          actualFingerprint: hash(
            bytes({ ...probeBundle.m02InputProjection.handoff, recordVersion: "2" }),
          ),
        });
        await client.query("SET session_replication_role=replica");
        try {
          await client.query(
            "UPDATE m02_identity_handoff_markers SET record_version=1 WHERE id='handoff-1'",
          );
        } finally {
          await client.query("SET session_replication_role=origin");
        }
        expect(await reader.readPredecessor(runtimeClient, probe)).toMatchObject({
          current: false,
          subjectId: "job-1",
          expectedFingerprint:
            probe.request.expectedPredecessorState.fingerprintExpectations.acquisitionResult,
          actualFingerprint: hash(bytes({ schemaVersion: "M04_MISSING_VALUE_V1" })),
        });
      } finally {
        runtimeClient.release();
      }
    } finally {
      await client.query("SET session_replication_role=replica");
      try {
        await client.query(
          "UPDATE m02_identity_handoff_markers SET record_version=1 WHERE id='handoff-1'",
        );
        await client.query(
          `INSERT INTO acquisition_results(job_id,source_snapshot_id,result,created_at)
           VALUES ('job-1','snapshot-m04',$1::jsonb,$2)`,
          [
            JSON.stringify(M03_GENUINE_ACQUISITION_RESULT),
            M03_GENUINE_FIXTURE_TIMESTAMPS.acquisitionResultCreatedAt,
          ],
        );
      } finally {
        await client.query("SET session_replication_role=origin");
        client.release();
      }
    }
  }, 240_000);

  it("reports missing immutable snapshot and observation with their exact marker fingerprints", async () => {
    const probeBundle = await createGenuineM03BundleFixture(
      0.9,
      "Other reviewers",
      "FILE_TOO_LARGE",
      false,
      true,
    );
    const probe = candidate(probeBundle, "missing-immutable-probe");
    const reader = adapterB as unknown as {
      readPredecessor(
        connection: PoolClient,
        value: EvidenceBindingCandidateV1,
      ): Promise<{
        current: boolean;
        subjectId?: string;
        expectedFingerprint?: string;
        actualFingerprint?: string;
      }>;
    };
    const admin = await adminB.connect();
    const runtime = await runtimeB.connect();
    const missingHash = hash(bytes({ schemaVersion: "M04_MISSING_VALUE_V1" }));
    const setReplica = async (): Promise<void> => {
      await admin.query("SET session_replication_role=replica");
    };
    const setOrigin = async (): Promise<void> => {
      await admin.query("SET session_replication_role=origin");
    };
    try {
      await admin.query(`SET search_path TO ${schema}, public`);
      await setReplica();
      try {
        await admin.query("DELETE FROM source_snapshots WHERE id='snapshot-m04'");
      } finally {
        await setOrigin();
      }
      expect(await reader.readPredecessor(runtime, probe)).toMatchObject({
        current: false,
        subjectId: "snapshot-m04",
        expectedFingerprint:
          probe.request.expectedPredecessorState.fingerprintExpectations.sourceSnapshot,
        actualFingerprint: missingHash,
      });
      await setReplica();
      try {
        await admin.query(
          `INSERT INTO source_snapshots
           (id,identity_key,provider,provider_repository_id,immutable_revision,acquisition_policy_version,acquired_at)
           VALUES ('snapshot-m04','m04-key','github','repo-1',$1,'acquisition-v1',$2)
           ON CONFLICT (id) DO NOTHING`,
          ["b".repeat(40), M03_GENUINE_FIXTURE_TIMESTAMPS.acquiredAt],
        );
        await admin.query("DELETE FROM resource_version_observations WHERE id='observation-1'");
      } finally {
        await setOrigin();
      }
      expect(await reader.readPredecessor(runtime, probe)).toMatchObject({
        current: false,
        subjectId: "observation-1",
        expectedFingerprint:
          probe.request.expectedPredecessorState.fingerprintExpectations.resourceVersionObservation,
        actualFingerprint: missingHash,
      });
    } finally {
      await setReplica();
      try {
        await admin.query(
          `INSERT INTO source_snapshots
           (id,identity_key,provider,provider_repository_id,immutable_revision,acquisition_policy_version,acquired_at)
           VALUES ('snapshot-m04','m04-key','github','repo-1',$1,'acquisition-v1',$2)
           ON CONFLICT (id) DO NOTHING`,
          ["b".repeat(40), M03_GENUINE_FIXTURE_TIMESTAMPS.acquiredAt],
        );
        await admin.query(
          `INSERT INTO resource_version_observations
           (id,resource_version_identity_id,source_snapshot_id,candidate_root_id,
            resource_source_link_id,source_repository_id,provider,provider_repository_id,
            normalized_root_path,immutable_revision,observed_at,
            origin_type,command_id,result_id,audit_event_id)
           VALUES ('observation-1','version-prior','snapshot-m04','root-1','source-link-1',
            'source-main','github','repo-1','.',$1,$2,
            'HUMAN_COMMAND','command-seed','result-seed','audit-command-seed')
           ON CONFLICT (id) DO NOTHING`,
          ["b".repeat(40), M03_GENUINE_FIXTURE_TIMESTAMPS.observedAt],
        );
      } finally {
        await setOrigin();
        runtime.release();
        admin.release();
      }
    }
  }, 240_000);
});
