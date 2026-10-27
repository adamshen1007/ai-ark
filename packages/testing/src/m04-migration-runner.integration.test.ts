import { readFile } from "node:fs/promises";

import { Client, Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript CLI module is exercised directly by this integration test.
import { migrate } from "../../../scripts/db-migrate.mjs";
// @ts-expect-error JavaScript CLI module is exercised directly by this integration test.
import { validate } from "../../../scripts/db-validate.mjs";
// @ts-expect-error JavaScript migration module is exercised directly by this integration test.
import { loadMigrations } from "../../../scripts/db-common.mjs";
import { EphemeralPostgresHarness } from "./postgres-harness.js";
// @ts-expect-error Internal authority helper is exercised directly for same-definition OID replacement.
import { assertWriterAuthority } from "../../job-queue/src/postgres-writer-authority.js";
import {
  PostgresEvidencePersistenceAdapterV1,
  PostgresManualResolutionAdapter,
  PostgresSystemIdentityAdapter,
} from "@ai-ark/job-queue";

const harness = new EphemeralPostgresHarness();
let pool: Pool;
const sentinel = "m04-runner-fixture-ownership";
const fencedPredecessors = [
  "acquisition_jobs",
  "acquisition_results",
  "candidate_root_ownership",
  "candidate_roots",
  "identity_decisions",
  "m01_source_documents",
  "m01_source_entries",
  "m02_identity_handoff_markers",
  "m02_jobs",
  "m02_review_states",
  "repository_candidate_root_order",
  "resource_candidates",
  "resource_identities",
  "resource_source_links",
  "resource_version_identities",
  "resource_version_observations",
  "source_repository_identities",
  "source_snapshots",
] as const;

function manifestFunctionProbe(schema: string, signature: string): string {
  const opening = signature.indexOf("(");
  if (opening < 1 || !signature.endsWith(")"))
    throw new Error("M04_TEST_FUNCTION_SIGNATURE_INVALID");
  const name = signature.slice(0, opening);
  const argumentsSql = signature
    .slice(opening + 1, -1)
    .split(",")
    .filter(Boolean)
    .map((type) => {
      const probe: Record<string, string> = {
        text: "'fixture'::text",
        jsonb: "'{}'::jsonb",
        "text[]": "ARRAY['fixture']::text[]",
        uuid: "'00000000-0000-0000-0000-000000000000'::uuid",
        "uuid[]": "ARRAY['00000000-0000-0000-0000-000000000000']::uuid[]",
        bytea: "'\\x00'::bytea",
      };
      const value = probe[type];
      if (value === undefined) throw new Error("M04_TEST_FUNCTION_ARG_TYPE_UNSUPPORTED");
      return value;
    })
    .join(",");
  return `SELECT ${schema}.${name}(${argumentsSql})`;
}

async function disposableEnvironment(name: string): Promise<Record<string, string>> {
  if (!/^[a-z0-9_]+$/u.test(name)) throw new Error("INVALID_FIXTURE_DATABASE");
  await pool.query(`CREATE DATABASE ${name}`);
  await pool.query(`COMMENT ON DATABASE ${name} IS 'ai-ark-m04-disposable:${sentinel}'`);
  const url = new URL(harness.connectionUri());
  url.pathname = `/${name}`;
  return {
    AI_ARK_DATABASE_URL: url.toString(),
    AI_ARK_DATABASE_ENVIRONMENT: "test",
    AI_ARK_DATABASE_ALLOWED_HOSTS: url.hostname,
    AI_ARK_DATABASE_SCHEMA: "public",
    AI_ARK_DATABASE_OWNERSHIP_SENTINEL: sentinel,
    AI_ARK_M04_DATABASE_LOGIN_ROLE: "ai_ark_m04_login",
    AI_ARK_M01_M02_DATABASE_LOGIN_ROLE: "ai_ark_m01_m02_login",
    AI_ARK_M04_DATABASE_RUNTIME_URL: harness.connectionUriForRole("ai_ark_m04_login", name),
    AI_ARK_M01_M02_DATABASE_WRITER_URL: harness.connectionUriForRole("ai_ark_m01_m02_login", name),
  };
}

async function applyPrefix(env: Record<string, string>, length: number): Promise<void> {
  const client = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
  await client.connect();
  try {
    for (const name of [
      "001_m01_acquisition_jobs.sql",
      "002_m02_classification_identity.sql",
    ].slice(0, length))
      await client.query(
        await readFile(new URL(`../../job-queue/migrations/${name}`, import.meta.url), "utf8"),
      );
  } finally {
    await client.end();
  }
}

describe("M04 migration runner", () => {
  beforeAll(async () => {
    pool = await harness.start();
    const databaseName = new URL(harness.connectionUri()).pathname.slice(1);
    if (!/^[a-zA-Z0-9_]+$/u.test(databaseName)) throw new Error("INVALID_FIXTURE_DATABASE");
    await pool.query(`COMMENT ON DATABASE ${databaseName} IS 'ai-ark-m04-disposable:${sentinel}'`);
    await pool.query("CREATE SCHEMA m04_runner");
  }, 120_000);
  afterAll(async () => harness.stop());

  it("applies a blank database, validates it, and is idempotent", async () => {
    const url = new URL(harness.connectionUri());
    const env = {
      AI_ARK_DATABASE_URL: url.toString(),
      AI_ARK_DATABASE_ENVIRONMENT: "test",
      AI_ARK_DATABASE_ALLOWED_HOSTS: url.hostname,
      AI_ARK_DATABASE_SCHEMA: "m04_runner",
      AI_ARK_DATABASE_OWNERSHIP_SENTINEL: sentinel,
      AI_ARK_M04_DATABASE_LOGIN_ROLE: "ai_ark_m04_login",
      AI_ARK_M01_M02_DATABASE_LOGIN_ROLE: "ai_ark_m01_m02_login",
      AI_ARK_M04_DATABASE_RUNTIME_URL: harness.connectionUriForRole("ai_ark_m04_login"),
      AI_ARK_M01_M02_DATABASE_WRITER_URL: harness.connectionUriForRole("ai_ark_m01_m02_login"),
    };
    await expect(
      migrate({ ...env, AI_ARK_DATABASE_OWNERSHIP_SENTINEL: "wrong-sentinel-value" }),
    ).rejects.toThrow("M04_DATABASE_SENTINEL_MISMATCH");
    expect(await migrate(env)).toEqual({ appliedFrom: 0, total: 3 });
    expect(await validate(env)).toMatchObject({ migrations: 3, tables: 10 });
    const authority = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await authority.connect();
    try {
      expect(
        (
          await authority.query(
            `SELECT epoch FROM m04_runner.m03_m04_predecessor_fence WHERE singleton_key=true`,
          )
        ).rows,
      ).toEqual([{ epoch: "1" }]);
      expect(
        (
          await authority.query(
            `SELECT count(DISTINCT tgname)::integer count FROM pg_trigger trigger
             JOIN pg_class relation ON relation.oid=trigger.tgrelid
             JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
             WHERE namespace.nspname='m04_runner'
               AND tgname LIKE 'm03_m04_fence_%_stmt' AND NOT trigger.tgisinternal`,
          )
        ).rows[0]?.count,
      ).toBe(18);
      for (const [role, allowed, denied] of [
        [
          "ai_ark_m04_login",
          "m03_m04_lock_predecessor_shared",
          "m03_m04_lock_predecessor_exclusive",
        ],
        [
          "ai_ark_m01_m02_login",
          "m03_m04_lock_predecessor_exclusive",
          "m03_m04_lock_predecessor_shared",
        ],
      ] as const) {
        await authority.query("BEGIN");
        await authority.query(`SET LOCAL ROLE ${role}`);
        await expect(authority.query(`SELECT m04_runner.${allowed}()`)).resolves.toHaveProperty(
          "rowCount",
          1,
        );
        await authority.query("ROLLBACK");
        await authority.query("BEGIN");
        await authority.query(`SET LOCAL ROLE ${role}`);
        await expect(authority.query(`SELECT m04_runner.${denied}()`)).rejects.toMatchObject({
          code: "42501",
        });
        await authority.query("ROLLBACK");
      }
      await authority.query("BEGIN");
      await authority.query("SET LOCAL ROLE ai_ark_hostile_login");
      await expect(
        authority.query("SELECT m04_runner.m03_m04_lock_predecessor_shared()"),
      ).rejects.toMatchObject({ code: "42501" });
      await authority.query("ROLLBACK");
      for (const role of ["ai_ark_m04_login", "ai_ark_hostile_login"]) {
        await authority.query("BEGIN");
        await authority.query(`SET LOCAL ROLE ${role}`);
        await expect(
          authority.query("SELECT nextval('m04_runner.m02_rejected_command_audits_id_seq')"),
        ).rejects.toMatchObject({ code: "42501" });
        await authority.query("ROLLBACK");
      }
      await authority.query("BEGIN");
      await authority.query("SET LOCAL ROLE ai_ark_m01_m02_login");
      await expect(
        authority.query("SELECT nextval('m04_runner.m02_rejected_command_audits_id_seq')"),
      ).resolves.toHaveProperty("rowCount", 1);
      await authority.query("ROLLBACK");
    } finally {
      await authority.end();
    }
    expect(await migrate(env)).toEqual({ appliedFrom: 3, total: 3 });
  }, 120_000);

  it("rejects a nonexistent target schema before any predecessor or ledger side effect", async () => {
    const env = await disposableEnvironment("m04_missing_schema");
    const typoEnv = { ...env, AI_ARK_DATABASE_SCHEMA: "missing_m04_schema" };
    await expect(migrate(typoEnv)).rejects.toThrow("M04_DATABASE_SCHEMA_GUARD_FAILED");
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      const inventory = await owner.query<{ predecessor: string | null; ledger: string | null }>(
        `SELECT to_regclass('public.acquisition_jobs')::text predecessor,
                to_regclass('public.schema_migrations')::text ledger`,
      );
      expect(inventory.rows).toEqual([{ predecessor: null, ledger: null }]);
    } finally {
      await owner.end();
    }
  }, 120_000);

  it("binds the encoded-key column and unique index to C despite hostile numeric ICU", async () => {
    const env = await disposableEnvironment("m04_key_collation");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      await owner.query(
        `CREATE COLLATION m04_numeric_icu (provider=icu, locale='und-u-kn', deterministic=false)`,
      );
      const control = await owner.query<{ equal: boolean }>(
        `SELECT '00'::text COLLATE m04_numeric_icu =
                '0000'::text COLLATE m04_numeric_icu AS equal`,
      );
      expect(control.rows[0]?.equal).toBe(true);
      const identity = await owner.query<{ column_uses_c: boolean; index_uses_c: boolean }>(
        `SELECT a.attcollation='pg_catalog."C"'::regcollation AS column_uses_c,
                i.indcollation[0]='pg_catalog."C"'::regcollation AS index_uses_c
           FROM pg_catalog.pg_attribute a
           JOIN pg_catalog.pg_class t ON t.oid=a.attrelid
           JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
           JOIN pg_catalog.pg_constraint con ON con.conrelid=t.oid
             AND con.contype='u' AND con.conkey=ARRAY[a.attnum]::smallint[]
           JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid
          WHERE n.nspname='public' AND t.relname='m04_binding_requests'
            AND a.attname='idempotency_key'`,
      );
      expect(identity.rows).toEqual([{ column_uses_c: true, index_uses_c: true }]);
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      await owner.query(
        `ALTER TABLE m04_binding_requests
           ALTER COLUMN idempotency_key TYPE text COLLATE m04_numeric_icu`,
      );
      await expect(validate(env)).rejects.toThrow("M04_IDEMPOTENCY_COLLATION_DRIFT");
      await expect(migrate(env)).rejects.toThrow("M04_IDEMPOTENCY_COLLATION_DRIFT");
      await owner.query(
        `ALTER TABLE m04_binding_requests
           ALTER COLUMN idempotency_key TYPE text COLLATE pg_catalog."C"`,
      );
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      await expect(migrate(env)).resolves.toEqual({ appliedFrom: 3, total: 3 });
    } finally {
      await owner.end();
    }
  }, 120_000);

  it("resumes exact 001 and 001+002 catalogs and rejects prefix definition drift", async () => {
    for (const prefixLength of [1, 2]) {
      const env = await disposableEnvironment(`m04_prefix_${String(prefixLength)}`);
      await applyPrefix(env, prefixLength);
      expect(await migrate(env)).toEqual({ appliedFrom: prefixLength, total: 3 });
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    }
    const driftEnv = await disposableEnvironment("m04_prefix_drift");
    await applyPrefix(driftEnv, 1);
    const driftClient = new Client({ connectionString: driftEnv.AI_ARK_DATABASE_URL });
    await driftClient.connect();
    await driftClient.query(
      "ALTER TABLE acquisition_jobs ALTER COLUMN submission_id DROP NOT NULL",
    );
    await driftClient.end();
    await expect(migrate(driftEnv)).rejects.toThrow("M04_DATABASE_BOOTSTRAP_INVALID");
  }, 120_000);

  it("resumes safely after every transaction/ledger interruption boundary", async () => {
    const cases = [
      ["during_001", { failDuringVersion: "001" }, 0],
      ["after_001", { failAfterVersion: "001" }, 1],
      ["during_002", { failDuringVersion: "002" }, 1],
      ["after_002", { failAfterVersion: "002" }, 2],
      ["during_003", { failDuringVersion: "003" }, 2],
      ["ledger_003", { failBeforeLedgerCommitVersion: "003" }, 2],
    ] as const;
    for (const [name, fault, expectedPrefix] of cases) {
      const env = await disposableEnvironment(`m04_interrupt_${name}`);
      await expect(migrate(env, fault)).rejects.toThrow(/M04_TEST_MIGRATION_INTERRUPTED/u);
      expect(await migrate(env)).toEqual({ appliedFrom: expectedPrefix, total: 3 });
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    }
  }, 240_000);

  it("detects per-object column, constraint, index, trigger, and function drift", async () => {
    const env = await disposableEnvironment("m04_catalog_drift");
    await migrate(env);
    const client = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await client.connect();
    const cases: readonly (readonly [string, string, string])[] = [
      [
        "column",
        "ALTER TABLE m04_binding_results ALTER COLUMN kind DROP NOT NULL",
        "ALTER TABLE m04_binding_results ALTER COLUMN kind SET NOT NULL",
      ],
      [
        "constraint",
        "ALTER TABLE m04_binding_results DROP CONSTRAINT m04_binding_results_kind_check",
        "ALTER TABLE m04_binding_results ADD CONSTRAINT m04_binding_results_kind_check CHECK (kind = 'ACCEPTED')",
      ],
      [
        "index",
        "DROP INDEX m04_binding_requests_semantic_idx",
        "CREATE INDEX m04_binding_requests_semantic_idx ON m04_binding_requests(semantic_request_fingerprint)",
      ],
      [
        "trigger",
        "DROP TRIGGER m04_binding_results_immutable ON m04_binding_results",
        `CREATE TRIGGER m04_binding_results_immutable BEFORE UPDATE OR DELETE ON m04_binding_results
         FOR EACH ROW EXECUTE FUNCTION m04_reject_immutable_mutation()`,
      ],
      [
        "view",
        "CREATE VIEW m04_unexpected_view AS SELECT 1 value",
        "DROP VIEW m04_unexpected_view",
      ],
      [
        "sequence",
        "CREATE SEQUENCE m04_unexpected_sequence",
        "DROP SEQUENCE m04_unexpected_sequence",
      ],
      [
        "type",
        "CREATE TYPE m04_unexpected_type AS ENUM ('VALUE')",
        "DROP TYPE m04_unexpected_type",
      ],
      [
        "domain",
        "CREATE DOMAIN m04_unexpected_domain AS text CHECK (VALUE <> '')",
        "DROP DOMAIN m04_unexpected_domain",
      ],
      [
        "policy",
        "CREATE POLICY m04_unexpected_policy ON m04_binding_results USING (true)",
        "DROP POLICY m04_unexpected_policy ON m04_binding_results",
      ],
    ];
    for (const [kind, mutate, restore] of cases) {
      await client.query(mutate);
      await expect(validate(env), kind).rejects.toThrow("M04_SCHEMA_CATALOG_DRIFT");
      await client.query(restore);
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    }
    const originalFunction = (
      await client.query<{ definition: string }>(
        "SELECT pg_get_functiondef('m04_payload_is_canonical_json(bytea)'::regprocedure) definition",
      )
    ).rows[0]?.definition;
    await client.query(
      `CREATE OR REPLACE FUNCTION m04_payload_is_canonical_json(payload bytea) RETURNS boolean
       LANGUAGE sql IMMUTABLE STRICT AS 'SELECT false'`,
    );
    await expect(validate(env)).rejects.toThrow("M04_SCHEMA_CATALOG_DRIFT");
    if (originalFunction === undefined) throw new Error("M04_FIXTURE_FUNCTION_MISSING");
    await client.query(originalFunction);
    await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    await client.end();
  }, 240_000);

  it("rejects direct, excess, missing, and nonmanifest actual-login privileges", async () => {
    const env = await disposableEnvironment("m04_role_acl_drift");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      const defaultPublicGrants = await owner.query<{
        kind: string;
        name: string;
        privilege: string;
      }>(
        `SELECT 'schema' kind,n.nspname name,acl.privilege_type privilege
           FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
          WHERE n.nspname='public' AND acl.grantee=0
         UNION ALL
         SELECT 'relation',c.relname,acl.privilege_type
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
             LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
          WHERE n.nspname='public' AND acl.grantee=0
         UNION ALL
         SELECT 'function',p.proname,acl.privilege_type
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
             LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
          WHERE n.nspname='public' AND acl.grantee=0
            AND NOT EXISTS (SELECT 1 FROM pg_depend d
              WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
      );
      expect(defaultPublicGrants.rows).toEqual([]);
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      for (const [grant, revoke] of [
        [
          "GRANT SELECT ON m04_binding_requests TO ai_ark_m01_m02_login",
          "REVOKE SELECT ON m04_binding_requests FROM ai_ark_m01_m02_login",
        ],
        [
          "GRANT UPDATE ON m04_binding_results TO ai_ark_m04_runtime",
          "REVOKE UPDATE ON m04_binding_results FROM ai_ark_m04_runtime",
        ],
        [
          "REVOKE SELECT ON m04_evidence_items FROM ai_ark_m04_runtime",
          "GRANT SELECT ON m04_evidence_items TO ai_ark_m04_runtime",
        ],
        [
          "GRANT EXECUTE ON FUNCTION m04_validate_full_binding_closure() TO ai_ark_m04_runtime",
          "REVOKE EXECUTE ON FUNCTION m04_validate_full_binding_closure() FROM ai_ark_m04_runtime",
        ],
        [
          "REVOKE USAGE ON SEQUENCE m02_rejected_command_audits_id_seq FROM ai_ark_m01_m02_writer",
          "GRANT USAGE ON SEQUENCE m02_rejected_command_audits_id_seq TO ai_ark_m01_m02_writer",
        ],
        [
          "GRANT USAGE ON SEQUENCE m02_rejected_command_audits_id_seq TO ai_ark_m04_runtime",
          "REVOKE USAGE ON SEQUENCE m02_rejected_command_audits_id_seq FROM ai_ark_m04_runtime",
        ],
      ] as const) {
        await owner.query(grant);
        await expect(validate(env), grant).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        await owner.query(revoke);
        await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      }
      const runtimePool = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
      const writerPool = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
      try {
        for (const [grant, revoke] of [
          [
            "GRANT SELECT ON acquisition_jobs TO PUBLIC",
            "REVOKE SELECT ON acquisition_jobs FROM PUBLIC",
          ],
          ["GRANT USAGE ON SCHEMA public TO PUBLIC", "REVOKE USAGE ON SCHEMA public FROM PUBLIC"],
          [
            "GRANT EXECUTE ON FUNCTION m04_canonical_json(jsonb) TO PUBLIC",
            "REVOKE EXECUTE ON FUNCTION m04_canonical_json(jsonb) FROM PUBLIC",
          ],
          [
            "GRANT USAGE ON SEQUENCE m02_rejected_command_audits_id_seq TO PUBLIC",
            "REVOKE USAGE ON SEQUENCE m02_rejected_command_audits_id_seq FROM PUBLIC",
          ],
        ] as const) {
          await owner.query(grant);
          try {
            await expect(validate(env), grant).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
            await expect(
              PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
                schema: "public",
                loginRole: "ai_ark_m04_login",
                peerLoginRole: "ai_ark_m01_m02_login",
              }),
            ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
            await expect(
              PostgresManualResolutionAdapter.open(writerPool, {
                schema: "public",
                loginRole: "ai_ark_m01_m02_login",
                peerLoginRole: "ai_ark_m04_login",
              }),
            ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          } finally {
            await owner.query(revoke);
          }
          await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
        }
      } finally {
        await runtimePool.end();
        await writerPool.end();
      }
      await owner.query("CREATE ROLE ai_ark_m04_extra_group NOLOGIN");
      await owner.query("GRANT ai_ark_m04_extra_group TO ai_ark_m04_login");
      try {
        await expect(validate(env)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await owner.query("REVOKE ai_ark_m04_extra_group FROM ai_ark_m04_login");
        await owner.query("DROP ROLE ai_ark_m04_extra_group");
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      await owner.query("CREATE ROLE ai_ark_m04_transitive_bridge NOLOGIN");
      await owner.query("GRANT ai_ark_m04_transitive_bridge TO ai_ark_m01_m02_writer");
      await owner.query("GRANT ai_ark_m04_runtime TO ai_ark_m04_transitive_bridge");
      try {
        await expect(validate(env)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await owner.query("REVOKE ai_ark_m04_runtime FROM ai_ark_m04_transitive_bridge");
        await owner.query("REVOKE ai_ark_m04_transitive_bridge FROM ai_ark_m01_m02_writer");
        await owner.query("DROP ROLE ai_ark_m04_transitive_bridge");
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    } finally {
      await owner.end();
    }
  }, 120_000);

  it("rejects hostile application object ownership even with otherwise intact grants", async () => {
    const env = await disposableEnvironment("m04_hostile_object_owner");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const runtime = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    const writer = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await owner.connect();
    try {
      for (const [transfer, restore] of [
        [
          "ALTER TABLE public.m04_binding_requests OWNER TO ai_ark_hostile_login",
          "ALTER TABLE public.m04_binding_requests OWNER TO CURRENT_USER",
        ],
        [
          "ALTER TABLE public.m02_rejected_command_audits OWNER TO ai_ark_hostile_login",
          "ALTER TABLE public.m02_rejected_command_audits OWNER TO CURRENT_USER",
        ],
        [
          "ALTER FUNCTION public.m03_m04_bump_predecessor_epoch() OWNER TO ai_ark_hostile_login",
          "ALTER FUNCTION public.m03_m04_bump_predecessor_epoch() OWNER TO CURRENT_USER",
        ],
      ] as const) {
        await owner.query(transfer);
        try {
          if (transfer.includes("m02_rejected_command_audits")) {
            const sequence = await owner.query<{ owner: string }>(
              "SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='public.m02_rejected_command_audits_id_seq'::regclass",
            );
            expect(sequence.rows[0]?.owner).toBe("ai_ark_hostile_login");
          }
          await expect(validate(env), transfer).rejects.toThrow(
            "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
          );
          await expect(
            PostgresEvidencePersistenceAdapterV1.open(runtime, {
              schema: "public",
              loginRole: "ai_ark_m04_login",
              peerLoginRole: "ai_ark_m01_m02_login",
            }),
            transfer,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresManualResolutionAdapter.open(writer, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
            transfer,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await owner.query(restore);
        }
        await expect(validate(env), restore).resolves.toMatchObject({ migrations: 3 });
      }
    } finally {
      await owner.end();
      await runtime.end();
      await writer.end();
    }
  }, 120_000);

  it("rejects replacement of either approved group LOGIN by a hostile third LOGIN", async () => {
    const env = await disposableEnvironment("m04_peer_login_replacement");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const runtime = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    const writer = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await owner.connect();
    try {
      for (const [group, legitimateLogin] of [
        ["ai_ark_m01_m02_writer", "ai_ark_m01_m02_login"],
        ["ai_ark_m04_runtime", "ai_ark_m04_login"],
      ] as const) {
        await owner.query(`REVOKE ${group} FROM ${legitimateLogin}`);
        await owner.query(`GRANT ${group} TO ai_ark_hostile_login`);
        try {
          const hostile = new Client({
            connectionString: harness.connectionUriForRole(
              "ai_ark_hostile_login",
              "m04_peer_login_replacement",
            ),
          });
          await hostile.connect();
          try {
            const effective = await hostile.query<{ allowed: boolean }>(
              "SELECT pg_has_role(current_user,$1,'USAGE') allowed",
              [group],
            );
            expect(effective.rows[0]?.allowed).toBe(true);
          } finally {
            await hostile.end();
          }
          await expect(validate(env), group).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresEvidencePersistenceAdapterV1.open(runtime, {
              schema: "public",
              loginRole: "ai_ark_m04_login",
              peerLoginRole: "ai_ark_m01_m02_login",
            }),
            group,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresManualResolutionAdapter.open(writer, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
            group,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await owner.query(`REVOKE ${group} FROM ai_ark_hostile_login`);
          await owner.query(`GRANT ${group} TO ${legitimateLogin} WITH INHERIT TRUE`);
        }
        await expect(validate(env), group).resolves.toMatchObject({ migrations: 3 });
      }
    } finally {
      await owner.end();
      await runtime.end();
      await writer.end();
    }
  }, 120_000);

  it("rejects coordinated migration-owner replacement during quiesced validation", async () => {
    const env = await disposableEnvironment("m04_coordinated_owner_replacement");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      const objects = await owner.query<{ target: string }>(
        `SELECT format('%s %I.%I',CASE WHEN c.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,
                       n.nspname,c.relname) target
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind IN ('r','p','S')
            AND (c.relkind<>'S' OR NOT EXISTS (
              SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
                AND d.objid=c.oid AND d.deptype IN ('a','i')))
         UNION ALL
         SELECT format('FUNCTION %I.%I(%s)',n.nspname,p.proname,
                       pg_get_function_identity_arguments(p.oid))
           FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public'
            AND NOT EXISTS (SELECT 1 FROM pg_depend d
              WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
      );
      const transferred: string[] = [];
      try {
        for (const object of objects.rows) {
          await owner.query(`ALTER ${object.target} OWNER TO ai_ark_hostile_login`);
          transferred.push(object.target);
        }
        const ledger = await owner.query<{ owner: string }>(
          "SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='public.schema_migrations'::regclass",
        );
        const domain = await owner.query<{ owner: string }>(
          "SELECT pg_get_userbyid(relowner) owner FROM pg_class WHERE oid='public.m04_binding_requests'::regclass",
        );
        expect(ledger.rows[0]?.owner).toBe("ai_ark_hostile_login");
        expect(domain.rows[0]?.owner).toBe("ai_ark_hostile_login");
        await expect(validate(env)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        for (const object of transferred.reverse())
          await owner.query(`ALTER ${object} OWNER TO CURRENT_USER`);
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    } finally {
      await owner.end();
    }
  }, 120_000);

  it("rejects fresh M04 startup on function attributes and arbitrarily named extra triggers", async () => {
    const env = await disposableEnvironment("m04_function_trigger_authority");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const runtime = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    await owner.connect();
    const options = {
      schema: "public",
      loginRole: "ai_ark_m04_login",
      peerLoginRole: "ai_ark_m01_m02_login",
    };
    try {
      await owner.query("ALTER FUNCTION public.m04_canonical_json(jsonb) VOLATILE");
      try {
        await expect(PostgresEvidencePersistenceAdapterV1.open(runtime, options)).rejects.toThrow(
          "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
        );
      } finally {
        await owner.query("ALTER FUNCTION public.m04_canonical_json(jsonb) IMMUTABLE");
      }
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtime, options),
      ).resolves.toBeDefined();
      await owner.query(`CREATE TRIGGER unexpected_claim_guard BEFORE INSERT ON public.m04_claims
        FOR EACH ROW EXECUTE FUNCTION public.m04_reject_immutable_mutation()`);
      try {
        await expect(PostgresEvidencePersistenceAdapterV1.open(runtime, options)).rejects.toThrow(
          "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
        );
      } finally {
        await owner.query("DROP TRIGGER unexpected_claim_guard ON public.m04_claims");
      }
      await expect(
        PostgresEvidencePersistenceAdapterV1.open(runtime, options),
      ).resolves.toBeDefined();
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    } finally {
      await owner.end();
      await runtime.end();
    }
  }, 120_000);

  it("rejects third-role ACL grants and grant options across every application object kind", async () => {
    const env = await disposableEnvironment("m04_third_role_acl");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const runtime = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    const writer = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await owner.connect();
    try {
      const before = await owner.query<{ count: string }>(
        "SELECT count(*) FROM public.m04_binding_requests",
      );
      const cases = [
        [
          "GRANT USAGE ON SCHEMA public TO ai_ark_hostile_login",
          "REVOKE USAGE ON SCHEMA public FROM ai_ark_hostile_login",
        ],
        [
          "GRANT SELECT ON public.m04_binding_requests TO ai_ark_hostile_login",
          "REVOKE SELECT ON public.m04_binding_requests FROM ai_ark_hostile_login",
        ],
        [
          "GRANT USAGE ON SEQUENCE public.m02_rejected_command_audits_id_seq TO ai_ark_hostile_login",
          "REVOKE USAGE ON SEQUENCE public.m02_rejected_command_audits_id_seq FROM ai_ark_hostile_login",
        ],
        [
          "GRANT EXECUTE ON FUNCTION public.m03_m04_bump_predecessor_epoch() TO ai_ark_hostile_login",
          "REVOKE EXECUTE ON FUNCTION public.m03_m04_bump_predecessor_epoch() FROM ai_ark_hostile_login",
        ],
        [
          "GRANT SELECT ON public.acquisition_jobs TO ai_ark_m04_runtime WITH GRANT OPTION",
          "REVOKE GRANT OPTION FOR SELECT ON public.acquisition_jobs FROM ai_ark_m04_runtime",
        ],
      ] as const;
      for (const [grant, revoke] of cases) {
        await owner.query(grant);
        try {
          await expect(validate(env), grant).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresEvidencePersistenceAdapterV1.open(runtime, {
              schema: "public",
              loginRole: "ai_ark_m04_login",
              peerLoginRole: "ai_ark_m01_m02_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresManualResolutionAdapter.open(writer, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await owner.query(revoke);
        }
        await expect(validate(env), grant).resolves.toMatchObject({ migrations: 3 });
      }
      for (const [grant, revoke, role, relation, column, privilege] of [
        [
          "GRANT SELECT (id) ON public.m04_binding_requests TO ai_ark_m01_m02_login",
          "REVOKE SELECT (id) ON public.m04_binding_requests FROM ai_ark_m01_m02_login",
          "writer",
          "public.m04_binding_requests",
          "id",
          "SELECT",
        ],
        [
          "GRANT INSERT (id) ON public.m04_binding_requests TO ai_ark_m01_m02_login",
          "REVOKE INSERT (id) ON public.m04_binding_requests FROM ai_ark_m01_m02_login",
          "writer",
          "public.m04_binding_requests",
          "id",
          "INSERT",
        ],
        [
          "GRANT UPDATE (cancellation_requested) ON public.acquisition_jobs TO ai_ark_m04_login",
          "REVOKE UPDATE (cancellation_requested) ON public.acquisition_jobs FROM ai_ark_m04_login",
          "runtime",
          "public.acquisition_jobs",
          "cancellation_requested",
          "UPDATE",
        ],
        [
          "GRANT REFERENCES (id) ON public.m04_binding_requests TO ai_ark_m01_m02_login",
          "REVOKE REFERENCES (id) ON public.m04_binding_requests FROM ai_ark_m01_m02_login",
          "writer",
          "public.m04_binding_requests",
          "id",
          "REFERENCES",
        ],
      ] as const) {
        await owner.query(grant);
        try {
          const actualLogin = new Client({
            connectionString:
              role === "writer"
                ? env.AI_ARK_M01_M02_DATABASE_WRITER_URL
                : env.AI_ARK_M04_DATABASE_RUNTIME_URL,
          });
          await actualLogin.connect();
          try {
            const positive = await actualLogin.query<{ allowed: boolean }>(
              "SELECT has_column_privilege(current_user,$1,$2,$3) allowed",
              [relation, column, privilege],
            );
            expect(positive.rows[0]?.allowed, grant).toBe(true);
          } finally {
            await actualLogin.end();
          }
          await expect(validate(env), grant).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresEvidencePersistenceAdapterV1.open(runtime, {
              schema: "public",
              loginRole: "ai_ark_m04_login",
              peerLoginRole: "ai_ark_m01_m02_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresManualResolutionAdapter.open(writer, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await owner.query(revoke);
        }
        await expect(validate(env), grant).resolves.toMatchObject({ migrations: 3 });
      }
      for (const [grant, revoke] of [
        [
          "GRANT ai_ark_m01_m02_writer TO ai_ark_hostile_login",
          "REVOKE ai_ark_m01_m02_writer FROM ai_ark_hostile_login",
        ],
        [
          "GRANT ai_ark_m04_runtime TO ai_ark_hostile_login WITH INHERIT FALSE, SET TRUE",
          "REVOKE ai_ark_m04_runtime FROM ai_ark_hostile_login",
        ],
      ] as const) {
        await owner.query(grant);
        try {
          const hostile = new Client({
            connectionString: harness.connectionUriForRole(
              "ai_ark_hostile_login",
              "m04_third_role_acl",
            ),
          });
          await hostile.connect();
          try {
            const positive = await hostile.query<{ allowed: boolean }>(
              "SELECT pg_has_role(current_user,$1,$2) allowed",
              [
                grant.includes("m01_m02_writer") ? "ai_ark_m01_m02_writer" : "ai_ark_m04_runtime",
                grant.includes("m01_m02_writer") ? "USAGE" : "SET",
              ],
            );
            expect(positive.rows[0]?.allowed, grant).toBe(true);
          } finally {
            await hostile.end();
          }
          await expect(validate(env), grant).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresEvidencePersistenceAdapterV1.open(runtime, {
              schema: "public",
              loginRole: "ai_ark_m04_login",
              peerLoginRole: "ai_ark_m01_m02_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          await expect(
            PostgresManualResolutionAdapter.open(writer, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
            grant,
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await owner.query(revoke);
        }
        await expect(validate(env), grant).resolves.toMatchObject({ migrations: 3 });
      }
      await owner.query("CREATE ROLE ai_ark_acl_bridge NOLOGIN");
      await owner.query(
        "GRANT ai_ark_m04_runtime TO ai_ark_acl_bridge WITH INHERIT FALSE, SET TRUE",
      );
      await owner.query("GRANT ai_ark_acl_bridge TO ai_ark_hostile_login");
      try {
        const hostile = new Client({
          connectionString: harness.connectionUriForRole(
            "ai_ark_hostile_login",
            "m04_third_role_acl",
          ),
        });
        await hostile.connect();
        try {
          const positive = await hostile.query<{ allowed: boolean }>(
            "SELECT pg_has_role(current_user,'ai_ark_m04_runtime','SET') allowed",
          );
          expect(positive.rows[0]?.allowed).toBe(true);
        } finally {
          await hostile.end();
        }
        await expect(validate(env)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        await expect(
          PostgresEvidencePersistenceAdapterV1.open(runtime, {
            schema: "public",
            loginRole: "ai_ark_m04_login",
            peerLoginRole: "ai_ark_m01_m02_login",
          }),
        ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        await expect(
          PostgresManualResolutionAdapter.open(writer, {
            schema: "public",
            loginRole: "ai_ark_m01_m02_login",
            peerLoginRole: "ai_ark_m04_login",
          }),
        ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await owner.query("REVOKE ai_ark_acl_bridge FROM ai_ark_hostile_login");
        await owner.query("REVOKE ai_ark_m04_runtime FROM ai_ark_acl_bridge");
        await owner.query("DROP ROLE ai_ark_acl_bridge");
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      const after = await owner.query<{ count: string }>(
        "SELECT count(*) FROM public.m04_binding_requests",
      );
      expect(after.rows).toEqual(before.rows);
    } finally {
      await owner.end();
      await runtime.end();
      await writer.end();
    }
  }, 120_000);

  it("bumps and rolls back all 18 predecessor fences and representative mutation verbs", async () => {
    const env = await disposableEnvironment("m04_all_predecessor_fences");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      const epoch = async (): Promise<bigint> =>
        BigInt(
          (
            await owner.query<{ epoch: string }>(
              "SELECT epoch::text epoch FROM m03_m04_predecessor_fence WHERE singleton_key=true",
            )
          ).rows[0]?.epoch ?? "0",
        );
      for (const table of fencedPredecessors) {
        const column = (
          await owner.query<{ attname: string }>(
            `SELECT attribute.attname FROM pg_attribute attribute
               JOIN pg_class relation ON relation.oid=attribute.attrelid
               JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
              WHERE namespace.nspname='public' AND relation.relname=$1
                AND attribute.attnum>0 AND NOT attribute.attisdropped
                AND attribute.attgenerated='' AND attribute.attidentity=''
              ORDER BY attribute.attnum LIMIT 1`,
            [table],
          )
        ).rows[0]?.attname;
        if (column === undefined) throw new Error(`M04_TEST_COLUMN_MISSING:${table}`);
        const quotedColumn = `"${column}"`;
        const statements = [`UPDATE ${table} SET ${quotedColumn}=${quotedColumn} WHERE false`];
        if (table === "repository_candidate_root_order")
          statements.push(
            `INSERT INTO ${table} (${quotedColumn}) SELECT ${quotedColumn} FROM ${table} WHERE false`,
            `DELETE FROM ${table} WHERE false`,
            `TRUNCATE TABLE ${table}`,
          );
        for (const sql of statements) {
          const before = await epoch();
          await owner.query("BEGIN");
          try {
            await owner.query(sql);
            expect(await epoch(), `${table}: ${sql}`).toBeGreaterThan(before);
          } finally {
            await owner.query("ROLLBACK");
          }
          expect(await epoch(), `${table}: rollback`).toBe(before);
        }
      }
    } finally {
      await owner.end();
    }
  }, 240_000);

  it("rejects owner pools and role drift at both M01/M02 adapter startup gates", async () => {
    const env = await disposableEnvironment("m04_writer_adapter_authority");
    await migrate(env);
    const ownerPool = new Pool({ connectionString: env.AI_ARK_DATABASE_URL });
    const writerPool = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    const options = {
      schema: "public",
      loginRole: "ai_ark_m01_m02_login",
      peerLoginRole: "ai_ark_m04_login",
    };
    try {
      await expect(PostgresManualResolutionAdapter.open(ownerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await expect(PostgresSystemIdentityAdapter.open(ownerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await expect(
        PostgresManualResolutionAdapter.open(writerPool, options),
      ).resolves.toBeInstanceOf(PostgresManualResolutionAdapter);
      await expect(PostgresSystemIdentityAdapter.open(writerPool, options)).resolves.toBeInstanceOf(
        PostgresSystemIdentityAdapter,
      );
      await ownerPool.query("CREATE ROLE ai_ark_writer_extra NOLOGIN");
      await ownerPool.query("GRANT ai_ark_writer_extra TO ai_ark_m01_m02_login");
      try {
        await expect(PostgresManualResolutionAdapter.open(writerPool, options)).rejects.toThrow(
          "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
        );
        await expect(PostgresSystemIdentityAdapter.open(writerPool, options)).rejects.toThrow(
          "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
        );
      } finally {
        await ownerPool.query("REVOKE ai_ark_writer_extra FROM ai_ark_m01_m02_login");
        await ownerPool.query("DROP ROLE ai_ark_writer_extra");
      }
    } finally {
      await ownerPool.end();
      await writerPool.end();
    }
  }, 120_000);

  it("rejects legacy M02 function source and attribute drift at both writer startup gates", async () => {
    const env = await disposableEnvironment("m04_legacy_function_drift");
    await migrate(env);
    const ownerPool = new Pool({ connectionString: env.AI_ARK_DATABASE_URL });
    const writerPool = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    const options = {
      schema: "public",
      loginRole: "ai_ark_m01_m02_login",
      peerLoginRole: "ai_ark_m04_login",
    };
    const functionName = "public.m02_canonical_json(jsonb)";
    try {
      const original = await ownerPool.query<{ definition: string }>(
        "SELECT pg_get_functiondef($1::regprocedure) definition",
        [functionName],
      );
      const definition = original.rows[0]?.definition;
      if (!definition) throw new Error("M02_FIXTURE_FUNCTION_MISSING");
      await ownerPool.query(`ALTER FUNCTION ${functionName} VOLATILE`);
      await expect(PostgresManualResolutionAdapter.open(writerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await ownerPool.query(`ALTER FUNCTION ${functionName} IMMUTABLE`);
      await ownerPool.query(`CREATE OR REPLACE FUNCTION public.m02_canonical_json(value jsonb)
        RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path TO public, public
        AS $$ BEGIN RETURN 'drift'; END $$`);
      await expect(PostgresSystemIdentityAdapter.open(writerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await ownerPool.query(definition);
      await expect(
        PostgresManualResolutionAdapter.open(writerPool, options),
      ).resolves.toBeInstanceOf(PostgresManualResolutionAdapter);
    } finally {
      await ownerPool.end();
      await writerPool.end();
    }
  }, 120_000);

  it("rejects legacy M02 trigger disabling and rebinding at both writer startup gates", async () => {
    const env = await disposableEnvironment("m04_legacy_trigger_drift");
    await migrate(env);
    const ownerPool = new Pool({ connectionString: env.AI_ARK_DATABASE_URL });
    const writerPool = new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    const options = {
      schema: "public",
      loginRole: "ai_ark_m01_m02_login",
      peerLoginRole: "ai_ark_m04_login",
    };
    const trigger = "fork_relationship_cycle_guard";
    try {
      await ownerPool.query(`ALTER TABLE public.fork_relationships DISABLE TRIGGER ${trigger}`);
      await expect(PostgresManualResolutionAdapter.open(writerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await ownerPool.query(`ALTER TABLE public.fork_relationships ENABLE TRIGGER ${trigger}`);
      await ownerPool.query(`DROP TRIGGER ${trigger} ON public.fork_relationships`);
      await ownerPool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON public.fork_relationships
        FOR EACH ROW EXECUTE FUNCTION public.reject_m02_fork_cycle()`);
      await expect(PostgresSystemIdentityAdapter.open(writerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await ownerPool.query(`DROP TRIGGER ${trigger} ON public.fork_relationships`);
      await ownerPool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON public.fork_relationships
        FOR EACH ROW WHEN (NEW.state = 'active') EXECUTE FUNCTION public.reject_m02_fork_cycle()`);
      await expect(PostgresManualResolutionAdapter.open(writerPool, options)).rejects.toThrow(
        "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
      );
      await ownerPool.query(`DROP TRIGGER ${trigger} ON public.fork_relationships`);
      await ownerPool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON public.fork_relationships
        FOR EACH ROW WHEN (NEW.state = 'ACTIVE') EXECUTE FUNCTION public.reject_m02_fork_cycle()`);
      await expect(
        PostgresManualResolutionAdapter.open(writerPool, options),
      ).resolves.toBeInstanceOf(PostgresManualResolutionAdapter);
    } finally {
      await ownerPool.end();
      await writerPool.end();
    }
  }, 120_000);

  it("pins a writer's legacy trigger OID across checkout and rejects same-definition replacement", async () => {
    const env = await disposableEnvironment("m04_legacy_trigger_oid");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const writer = new Client({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await owner.connect();
    await writer.connect();
    const trigger = "fork_relationship_cycle_guard";
    try {
      const identity = await assertWriterAuthority(
        writer as unknown as PoolClient,
        "public",
        "ai_ark_m01_m02_login",
        undefined,
        "ai_ark_m04_login",
      );
      if (identity === null) throw new Error("M04_TEST_WRITER_CATALOG_MISSING");
      await owner.query(`DROP TRIGGER ${trigger} ON public.fork_relationships`);
      await owner.query(`CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON public.fork_relationships
        FOR EACH ROW WHEN (NEW.state = 'ACTIVE') EXECUTE FUNCTION public.reject_m02_fork_cycle()`);
      await expect(
        assertWriterAuthority(
          writer as unknown as PoolClient,
          "public",
          "ai_ark_m01_m02_login",
          identity,
          "ai_ark_m04_login",
        ),
      ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } finally {
      await writer.end();
      await owner.end();
    }
  }, 120_000);

  it("pins an M04 runtime's legacy trigger OID across authority checkpoints", async () => {
    const env = await disposableEnvironment("m04_runtime_legacy_trigger_oid");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const runtimePool = new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    await owner.connect();
    const trigger = "fork_relationship_cycle_guard";
    try {
      const adapter = await PostgresEvidencePersistenceAdapterV1.open(runtimePool, {
        schema: "public",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      });
      const before = await owner.query<{ count: string }>(
        "SELECT count(*) count FROM public.m04_claims",
      );
      await owner.query(`DROP TRIGGER ${trigger} ON public.fork_relationships`);
      await owner.query(`CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON public.fork_relationships
        FOR EACH ROW WHEN (NEW.state = 'ACTIVE') EXECUTE FUNCTION public.reject_m02_fork_cycle()`);
      const runtime = await runtimePool.connect();
      try {
        await expect(
          (
            adapter as unknown as {
              assertRuntimeAuthority(client: PoolClient): Promise<void>;
            }
          ).assertRuntimeAuthority(runtime),
        ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        runtime.release();
      }
      const after = await owner.query<{ count: string }>(
        "SELECT count(*) count FROM public.m04_claims",
      );
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    } finally {
      await runtimePool.end();
      await owner.end();
    }
  }, 120_000);

  it("probes every V2 manifest privilege on actual LOGINs and under removal", async () => {
    const env = await disposableEnvironment("m04_manifest_cell_matrix");
    await migrate(env);
    const loaded = (await loadMigrations()) as readonly {
      manifest?: {
        groups: readonly {
          role: string;
          relations: readonly { name: string; operations: readonly string[] }[];
          functions: readonly string[];
          sequences: readonly { name: string; operations: readonly string[] }[];
        }[];
      };
    }[];
    const manifest = loaded[2]?.manifest;
    if (manifest === undefined) throw new Error("M04_TEST_MANIFEST_MISSING");
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    try {
      for (const group of manifest.groups) {
        const writer = group.role === "M01_M02_WRITER_GROUP";
        const grantRole = writer ? "ai_ark_m01_m02_writer" : "ai_ark_m04_runtime";
        const runtime = new Client({
          connectionString: writer
            ? env.AI_ARK_M01_M02_DATABASE_WRITER_URL
            : env.AI_ARK_M04_DATABASE_RUNTIME_URL,
        });
        await runtime.connect();
        try {
          for (const relation of group.relations) {
            const firstColumn = (
              await owner.query<{ column_name: string }>(
                `SELECT quote_ident(attname) column_name FROM pg_attribute
                  WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped
                    AND attgenerated=''
                  ORDER BY attnum LIMIT 1`,
                [`public.${relation.name}`],
              )
            ).rows[0]?.column_name;
            if (firstColumn === undefined) throw new Error("M04_TEST_RELATION_COLUMN_MISSING");
            for (const operation of relation.operations) {
              const sql =
                operation === "SELECT"
                  ? `EXPLAIN SELECT 1 FROM public.${relation.name} LIMIT 0`
                  : operation === "INSERT"
                    ? `EXPLAIN INSERT INTO public.${relation.name} DEFAULT VALUES`
                    : `EXPLAIN UPDATE public.${relation.name} SET ${firstColumn}=${firstColumn} WHERE false`;
              const privilege = async (): Promise<boolean> =>
                (
                  await runtime.query<{ allowed: boolean }>(
                    "SELECT has_table_privilege(current_user,$1,$2) allowed",
                    [`public.${relation.name}`, operation],
                  )
                ).rows[0]?.allowed === true;
              expect(
                await privilege(),
                `${group.role}:${relation.name}:${operation}:positive`,
              ).toBe(true);
              await expect(
                runtime.query(sql),
                `${group.role}:${relation.name}:${operation}:probe`,
              ).resolves.toHaveProperty("rowCount");
              await owner.query(
                `REVOKE ${operation} ON TABLE public.${relation.name} FROM ${grantRole}`,
              );
              try {
                expect(
                  await privilege(),
                  `${group.role}:${relation.name}:${operation}:removed`,
                ).toBe(false);
                await expect(runtime.query(sql)).rejects.toMatchObject({ code: "42501" });
              } finally {
                await owner.query(
                  `GRANT ${operation} ON TABLE public.${relation.name} TO ${grantRole}`,
                );
              }
            }
          }
          for (const signature of group.functions) {
            const sql = manifestFunctionProbe("public", signature);
            const privilege = async (): Promise<boolean> =>
              (
                await runtime.query<{ allowed: boolean }>(
                  "SELECT has_function_privilege(current_user,$1,'EXECUTE') allowed",
                  [`public.${signature}`],
                )
              ).rows[0]?.allowed === true;
            expect(await privilege(), `${group.role}:${signature}:positive`).toBe(true);
            try {
              await runtime.query(sql);
            } catch (error) {
              expect(error, `${group.role}:${signature}:positive-sql-path`).not.toMatchObject({
                code: "42501",
              });
            }
            await owner.query(`REVOKE EXECUTE ON FUNCTION public.${signature} FROM ${grantRole}`);
            try {
              expect(await privilege(), `${group.role}:${signature}:removed`).toBe(false);
              await expect(
                runtime.query(sql),
                `${group.role}:${signature}:removed-sql-path`,
              ).rejects.toMatchObject({ code: "42501" });
            } finally {
              await owner.query(`GRANT EXECUTE ON FUNCTION public.${signature} TO ${grantRole}`);
            }
          }
          for (const sequence of group.sequences) {
            const privilege = async (): Promise<boolean> =>
              (
                await runtime.query<{ allowed: boolean }>(
                  "SELECT has_sequence_privilege(current_user,$1,'USAGE') allowed",
                  [`public.${sequence.name}`],
                )
              ).rows[0]?.allowed === true;
            expect(sequence.operations).toEqual(["USAGE"]);
            expect(await privilege(), `${group.role}:${sequence.name}:positive`).toBe(true);
            await owner.query(`REVOKE USAGE ON SEQUENCE public.${sequence.name} FROM ${grantRole}`);
            try {
              expect(await privilege(), `${group.role}:${sequence.name}:removed`).toBe(false);
            } finally {
              await owner.query(`GRANT USAGE ON SEQUENCE public.${sequence.name} TO ${grantRole}`);
            }
          }
        } finally {
          await runtime.end();
        }
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    } finally {
      await owner.end();
    }
  }, 240_000);

  it("requires the manifest sequence cell for the writer audit INSERT", async () => {
    const env = await disposableEnvironment("m04_sequence_audit_path");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const writer = new Client({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await owner.connect();
    await writer.connect();
    const insertAudit = async (key: string): Promise<void> => {
      await writer.query(
        `INSERT INTO public.m02_rejected_command_audits
           (command_id,request_id,idempotency_scope,idempotency_key,request_fingerprint,
            actor_id,actor_role,error_code,created_at)
         VALUES ($1,$2,'M02',$3,$4,'fixture-editor','EDITOR','REFERENCE_INVALID',clock_timestamp())`,
        [`command-${key}`, `request-${key}`, key, "a".repeat(64)],
      );
    };
    try {
      await insertAudit("sequence-positive");
      const count = async (): Promise<number> =>
        Number(
          (
            await owner.query<{ count: string }>(
              "SELECT count(*) count FROM public.m02_rejected_command_audits",
            )
          ).rows[0]?.count,
        );
      expect(await count()).toBe(1);
      await owner.query(
        "REVOKE USAGE ON SEQUENCE public.m02_rejected_command_audits_id_seq FROM ai_ark_m01_m02_writer",
      );
      try {
        await expect(insertAudit("sequence-denied")).rejects.toMatchObject({ code: "42501" });
        expect(await count()).toBe(1);
        await expect(validate(env)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await owner.query(
          "GRANT USAGE ON SEQUENCE public.m02_rejected_command_audits_id_seq TO ai_ark_m01_m02_writer",
        );
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
    } finally {
      await writer.end();
      await owner.end();
    }
  }, 120_000);

  it("rehearses quiesced owner DDL, validation failure, and gated restart", async () => {
    const env = await disposableEnvironment("m04_quiesced_change");
    await migrate(env);
    const owner = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await owner.connect();
    const runtime = (): Pool => new Pool({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    const writer = (): Pool =>
      new Pool({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    let runtimePool = runtime();
    let writerPool = writer();
    const closedPools = new WeakSet<Pool>();
    const closePool = async (target: Pool): Promise<void> => {
      if (closedPools.has(target)) return;
      closedPools.add(target);
      await target.end();
    };
    const openRuntime = async (runtimeConnection: Pool): Promise<void> => {
      await PostgresEvidencePersistenceAdapterV1.open(runtimeConnection, {
        schema: "public",
        loginRole: "ai_ark_m04_login",
        peerLoginRole: "ai_ark_m01_m02_login",
      });
    };
    try {
      await openRuntime(runtimePool);
      await PostgresManualResolutionAdapter.open(writerPool, {
        schema: "public",
        loginRole: "ai_ark_m01_m02_login",
        peerLoginRole: "ai_ark_m04_login",
      });
      let admitting = true;
      admitting = false;
      await closePool(runtimePool);
      await closePool(writerPool);
      expect(admitting).toBe(false);
      const active = await owner.query<{ count: string }>(
        `SELECT count(*) count FROM pg_stat_activity
          WHERE datname=current_database()
            AND usename IN ('ai_ark_m04_login','ai_ark_m01_m02_login')
            AND state <> 'idle'`,
      );
      expect(Number(active.rows[0]?.count)).toBe(0);

      await owner.query("ALTER FUNCTION public.m03_m04_lock_predecessor_shared() SECURITY INVOKER");
      runtimePool = runtime();
      await expect(openRuntime(runtimePool)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      await expect(validate(env)).rejects.toThrow("M04_SCHEMA_CATALOG_DRIFT");
      await closePool(runtimePool);
      await owner.query("ALTER FUNCTION public.m03_m04_lock_predecessor_shared() SECURITY DEFINER");
      for (const functionName of [
        "m03_m04_lock_predecessor_exclusive",
        "m03_m04_bump_predecessor_epoch",
      ]) {
        await owner.query(`ALTER FUNCTION public.${functionName}() SECURITY INVOKER`);
        writerPool = writer();
        try {
          await expect(
            PostgresManualResolutionAdapter.open(writerPool, {
              schema: "public",
              loginRole: "ai_ark_m01_m02_login",
              peerLoginRole: "ai_ark_m04_login",
            }),
          ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        } finally {
          await closePool(writerPool);
          await owner.query(`ALTER FUNCTION public.${functionName}() SECURITY DEFINER`);
        }
      }
      const originalDefinition = (
        await owner.query<{ definition: string }>(
          "SELECT pg_get_functiondef('public.m03_m04_lock_predecessor_shared()'::regprocedure) definition",
        )
      ).rows[0]?.definition;
      if (originalDefinition === undefined) throw new Error("M04_TEST_FENCE_DEFINITION_MISSING");
      await owner.query(`CREATE OR REPLACE FUNCTION public.m03_m04_lock_predecessor_shared()
        RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
        AS $$ BEGIN RETURN 1; END; $$`);
      runtimePool = runtime();
      try {
        await expect(openRuntime(runtimePool)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await closePool(runtimePool);
        await owner.query(originalDefinition);
      }
      await owner.query(
        "ALTER TABLE public.acquisition_jobs DISABLE TRIGGER m03_m04_fence_acquisition_jobs_stmt",
      );
      runtimePool = runtime();
      writerPool = writer();
      try {
        await expect(openRuntime(runtimePool)).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
        await expect(
          PostgresManualResolutionAdapter.open(writerPool, {
            schema: "public",
            loginRole: "ai_ark_m01_m02_login",
            peerLoginRole: "ai_ark_m04_login",
          }),
        ).rejects.toThrow("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      } finally {
        await closePool(runtimePool);
        await closePool(writerPool);
        await owner.query(
          "ALTER TABLE public.acquisition_jobs ENABLE TRIGGER m03_m04_fence_acquisition_jobs_stmt",
        );
      }
      await expect(validate(env)).resolves.toMatchObject({ migrations: 3 });
      runtimePool = runtime();
      writerPool = writer();
      await openRuntime(runtimePool);
      await PostgresManualResolutionAdapter.open(writerPool, {
        schema: "public",
        loginRole: "ai_ark_m01_m02_login",
        peerLoginRole: "ai_ark_m04_login",
      });
      admitting = true;
      expect(admitting).toBe(true);
    } finally {
      await closePool(runtimePool);
      await closePool(writerPool);
      await owner.end();
    }
  }, 120_000);

  it("serializes actual-login shared/exclusive fence waits and exposes inverse raw-SQL deadlock", async () => {
    const env = await disposableEnvironment("m04_fence_waits");
    await migrate(env);
    const reader = new Client({ connectionString: env.AI_ARK_M04_DATABASE_RUNTIME_URL });
    const writer = new Client({ connectionString: env.AI_ARK_M01_M02_DATABASE_WRITER_URL });
    await reader.connect();
    await writer.connect();
    try {
      await reader.query("BEGIN");
      await writer.query("BEGIN");
      await reader.query("SELECT public.m03_m04_lock_predecessor_shared()");
      let writerFinished = false;
      const exclusiveWait = writer
        .query("SELECT public.m03_m04_lock_predecessor_exclusive()")
        .then(() => {
          writerFinished = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(writerFinished).toBe(false);
      await reader.query("COMMIT");
      await exclusiveWait;
      expect(writerFinished).toBe(true);
      await writer.query("ROLLBACK");
    } finally {
      await reader.query("ROLLBACK").catch(() => undefined);
      await writer.query("ROLLBACK").catch(() => undefined);
      await reader.end();
      await writer.end();
    }
    const first = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    const second = new Client({ connectionString: env.AI_ARK_DATABASE_URL });
    await first.connect();
    await second.connect();
    try {
      await first.query("BEGIN");
      await second.query("BEGIN");
      await first.query("SET LOCAL statement_timeout='5000ms'");
      await second.query("SET LOCAL statement_timeout='5000ms'");
      await first.query("SELECT public.m03_m04_lock_predecessor_shared()");
      await second.query(
        "LOCK TABLE public.repository_candidate_root_order IN ACCESS EXCLUSIVE MODE",
      );
      const tableWait = first.query(
        "LOCK TABLE public.repository_candidate_root_order IN ACCESS SHARE MODE",
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      const fenceWait = second.query("SELECT public.m03_m04_lock_predecessor_exclusive()");
      const outcomes = await Promise.allSettled([tableWait, fenceWait]);
      expect(
        outcomes.some(
          (outcome) =>
            outcome.status === "rejected" &&
            (outcome.reason as { code?: unknown }).code === "40P01",
        ),
      ).toBe(true);
    } finally {
      await first.query("ROLLBACK").catch(() => undefined);
      await second.query("ROLLBACK").catch(() => undefined);
      await first.end();
      await second.end();
    }
  }, 120_000);
});
