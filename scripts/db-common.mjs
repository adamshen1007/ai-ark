import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

import pg from "pg";

const { Client } = pg;

export const MIGRATION_DIRECTORY = new URL("../packages/job-queue/migrations/", import.meta.url);
export const M04_RUNTIME_MANIFEST_NAME = "003_m04_runtime_privileges.json";
export const FROZEN_MIGRATION_HASHES = Object.freeze({
  "001_m01_acquisition_jobs.sql":
    "4896d8240d81bcdacc8763c0ba4e09cc12ce17983519acb798612d29b4434958",
  "002_m02_classification_identity.sql":
    "310c6761eb9ac94bcdac03e395a3abbe27a711a6570ffc0839b44b8300563c64",
  "003_m04_evidence_binding.sql":
    "6da55b9ee12fccad5feb5b9fd31ff30ce972a8b3401f83a62cdb2bdf632939e8",
});
export const FROZEN_RUNTIME_MANIFEST_HASH =
  "09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const compareUtf8 = (left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right));
const canonicalJson = (value) =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(canonicalJson).join(",")}]`
      : `{${Object.keys(value)
          .sort(compareUtf8)
          .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
          .join(",")}}`;

const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort(compareUtf8)) ===
    JSON.stringify([...keys].sort(compareUtf8));

const CLOSED_RUNTIME_OBJECTS = Object.freeze({
  M01_M02_WRITER_GROUP: {
    sequences: ["m02_rejected_command_audits_id_seq"],
    relations: [
      "acquisition_jobs",
      "acquisition_results",
      "analysis_runs",
      "candidate_root_ownership",
      "candidate_roots",
      "classification_evidence_references",
      "duplicate_candidates",
      "external_identifiers",
      "fork_relationships",
      "identity_decision_conflict_evidence",
      "identity_decision_conflict_targets",
      "identity_decision_conflicts",
      "identity_decision_signal_evidence",
      "identity_decision_signals",
      "identity_decision_tier_evaluations",
      "identity_decisions",
      "m02_audit_events",
      "m02_candidate_rejection_decisions",
      "m02_candidate_replacements",
      "m02_clarification_requests",
      "m02_concurrency_guards",
      "m02_group_edge_replacements",
      "m02_identity_handoff_markers",
      "m02_job_supersessions",
      "m02_jobs",
      "m02_manual_command_results",
      "m02_ownership_replacements",
      "m02_rejected_command_audits",
      "m02_rejected_system_identity_audits",
      "m02_review_states",
      "m02_root_replacements",
      "m02_system_identity_operations",
      "m02_system_identity_results",
      "manual_resolution_commands",
      "repository_candidate_groups",
      "repository_candidate_root_order",
      "repository_classification_runs",
      "repository_group_relationships",
      "resource_candidates",
      "resource_identities",
      "resource_source_links",
      "resource_version_identities",
      "resource_version_observations",
      "source_repository_identities",
      "source_repository_relationships",
      "source_repository_urls",
      "source_snapshots",
    ],
    functions: [
      "enforce_m02_human_candidate_audit_projection(text,text)",
      "m02_audit_metadata_valid(text,text,text,jsonb)",
      "m02_audit_state_valid(text)",
      "m02_canonical_json(jsonb)",
      "m02_expected_versions_valid(jsonb)",
      "m02_guard_payload_valid(text,bytea)",
      "m02_identity_conflict_semantic_key(uuid)",
      "m02_identity_conflict_sort_key(uuid)",
      "m02_identity_conflict_target_sort_key(uuid)",
      "m02_identity_decision_input_json(text,text)",
      "m02_identity_signal_sort_key(uuid)",
      "m02_jsonb_has_exact_keys(jsonb,text[])",
      "m02_jsonb_nonempty_string(jsonb,text)",
      "m02_payload_is_canonical_json(bytea)",
      "m02_payload_matches_json(bytea,jsonb)",
      "m02_relationship_endpoint_guard_ref_valid(jsonb)",
      "m02_replacement_metadata_shape_valid(text,jsonb)",
      "m02_resource_identity_guard_ref_valid(jsonb)",
      "m02_resource_version_guard_ref_valid(jsonb)",
      "m02_source_link_guard_ref_valid(jsonb)",
      "m02_source_repository_guard_ref_valid(jsonb)",
      "m02_system_mutation_plan_body_matches(text,jsonb)",
      "m02_system_mutation_plan_payload_matches(text,bytea)",
      "m02_system_plan_before_values_match(text,text,text,jsonb)",
      "m02_system_plan_row_values_match(text,text,jsonb)",
      "m02_system_plan_values_shape_valid(text,text,jsonb)",
      "m02_system_rejection_targets_valid(jsonb)",
      "m02_system_result_mutation_plan_json(text)",
      "m02_system_s8_tier_semantics_valid(text)",
      "m02_text_array_is_canonical(text[])",
      "m02_tier_sequence_valid(jsonb)",
      "m02_uuid_array_is_canonical(uuid[])",
      "m03_m04_lock_predecessor_exclusive()",
    ],
  },
  M04_RUNTIME_GROUP: {
    sequences: [],
    relations: [
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
      "m03_extraction_bundle_chunks",
      "m03_extraction_bundles",
      "m04_binding_requests",
      "m04_binding_results",
      "m04_claim_evidence_links",
      "m04_claims",
      "m04_completeness_snapshots",
      "m04_evidence_items",
      "repository_candidate_root_order",
      "resource_candidates",
      "resource_identities",
      "resource_source_links",
      "resource_version_identities",
      "resource_version_observations",
      "source_repository_identities",
      "source_snapshots",
    ],
    functions: [
      "m03_m04_lock_predecessor_shared()",
      "m04_assert_binding_closure(text)",
      "m04_canonical_json(jsonb)",
      "m04_payload_is_canonical_json(bytea)",
    ],
  },
});

export function validateRuntimePrivilegeManifest(rawBytes) {
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(rawBytes));
  } catch {
    throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
  }
  const roles = ["M01_M02_WRITER_GROUP", "M04_RUNTIME_GROUP"];
  if (
    !exactKeys(manifest, ["schemaVersion", "groups"]) ||
    manifest.schemaVersion !== "M04_RUNTIME_PRIVILEGES_V2" ||
    !Array.isArray(manifest.groups) ||
    manifest.groups.length !== 2 ||
    manifest.groups.some((group, index) => {
      if (
        !exactKeys(group, ["role", "relations", "functions", "sequences"]) ||
        group.role !== roles[index] ||
        !Array.isArray(group.relations) ||
        !Array.isArray(group.functions) ||
        !Array.isArray(group.sequences)
      )
        return true;
      if (
        group.relations.some(
          (entry) =>
            !exactKeys(entry, ["name", "operations"]) ||
            typeof entry.name !== "string" ||
            !Array.isArray(entry.operations) ||
            entry.operations.some((operation) => typeof operation !== "string"),
        ) ||
        group.functions.some((signature) => typeof signature !== "string")
      )
        return true;
      const names = group.relations.map((entry) => entry?.name);
      const closed = CLOSED_RUNTIME_OBJECTS[group.role];
      if (closed === undefined || JSON.stringify(names) !== JSON.stringify(closed.relations))
        return true;
      if (JSON.stringify(group.functions) !== JSON.stringify(closed.functions)) return true;
      if (
        JSON.stringify(group.sequences) !==
        JSON.stringify(closed.sequences.map((name) => ({ name, operations: ["USAGE"] })))
      )
        return true;
      if (JSON.stringify(names) !== JSON.stringify([...names].sort(compareUtf8))) return true;
      if (new Set(names).size !== names.length) return true;
      for (const relation of group.relations) {
        if (
          !exactKeys(relation, ["name", "operations"]) ||
          !/^[a-z][a-z0-9_]*$/u.test(relation.name) ||
          !Array.isArray(relation.operations) ||
          relation.operations.length === 0 ||
          JSON.stringify(relation.operations) !==
            JSON.stringify(
              [...new Set(relation.operations)].sort(
                (left, right) =>
                  ["SELECT", "INSERT", "UPDATE"].indexOf(left) -
                  ["SELECT", "INSERT", "UPDATE"].indexOf(right),
              ),
            ) ||
          relation.operations.some(
            (operation) => !["SELECT", "INSERT", "UPDATE"].includes(operation),
          )
        )
          return true;
      }
      if (
        JSON.stringify(group.functions) !==
          JSON.stringify([...group.functions].sort(compareUtf8)) ||
        new Set(group.functions).size !== group.functions.length ||
        group.functions.some(
          (signature) =>
            typeof signature !== "string" ||
            !/^[a-z][a-z0-9_]*\((?:[a-z][a-z0-9_]*(?:\[\])?(?:,[a-z][a-z0-9_]*(?:\[\])?)*)?\)$/u.test(
              signature,
            ),
        )
      )
        return true;
      return false;
    }) ||
    Buffer.compare(Buffer.from(`${canonicalJson(manifest)}\n`, "utf8"), Buffer.from(rawBytes)) !== 0
  )
    throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
  return manifest;
}

export function m04MigrationIdentity(sqlHash, manifestHash) {
  if (![sqlHash, manifestHash].every((hash) => /^[0-9a-f]{64}$/u.test(hash)))
    throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
  return sha256(`AI_ARK_M04_003_MANIFEST_V2\n${sqlHash}\n${manifestHash}\n`);
}

export function validateDatabaseSchemaName(schema) {
  if (
    !/^[a-z][a-z0-9_]{0,62}$/u.test(schema) ||
    schema.startsWith("pg_") ||
    schema === "information_schema"
  )
    throw new Error("M04_DATABASE_SCHEMA_INVALID");
  return schema;
}

export function quoteDatabaseIdentifier(identifier) {
  return `"${validateDatabaseSchemaName(identifier).replaceAll('"', '""')}"`;
}

export function renderMigrationSql(sql, schema, manifest) {
  const schemaSql = quoteDatabaseIdentifier(schema);
  if (sql.includes("<M04_RUNTIME_GRANTS>") !== (manifest !== undefined))
    throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
  const roleNames = {
    M01_M02_WRITER_GROUP: "ai_ark_m01_m02_writer",
    M04_RUNTIME_GROUP: "ai_ark_m04_runtime",
  };
  const grants =
    manifest === undefined
      ? ""
      : [
          ...[
            ...new Set(manifest.groups.flatMap((group) => group.relations.map(({ name }) => name))),
          ]
            .sort(compareUtf8)
            .map(
              (name) =>
                `REVOKE ALL ON TABLE ${schemaSql}.${name} FROM PUBLIC, ai_ark_m01_m02_writer, ai_ark_m04_runtime;`,
            ),
          ...[...new Set(manifest.groups.flatMap((group) => group.functions))]
            .sort(compareUtf8)
            .map(
              (signature) =>
                `REVOKE ALL ON FUNCTION ${schemaSql}.${signature} FROM PUBLIC, ai_ark_m01_m02_writer, ai_ark_m04_runtime;`,
            ),
          ...[
            ...new Set(manifest.groups.flatMap((group) => group.sequences.map(({ name }) => name))),
          ]
            .sort(compareUtf8)
            .map(
              (name) =>
                `REVOKE ALL ON SEQUENCE ${schemaSql}.${name} FROM PUBLIC, ai_ark_m01_m02_writer, ai_ark_m04_runtime;`,
            ),
          ...manifest.groups.flatMap((group) => {
            const role = roleNames[group.role];
            if (role === undefined) throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
            return [
              ...group.relations.map(
                ({ name, operations }) =>
                  `GRANT ${operations.join(",")} ON TABLE ${schemaSql}.${name} TO ${role};`,
              ),
              ...group.functions.map(
                (signature) => `GRANT EXECUTE ON FUNCTION ${schemaSql}.${signature} TO ${role};`,
              ),
              ...group.sequences.map(
                ({ name, operations }) =>
                  `GRANT ${operations.join(",")} ON SEQUENCE ${schemaSql}.${name} TO ${role};`,
              ),
            ];
          }),
        ].join("\n");
  return sql.replaceAll("<S>", schemaSql).replaceAll("<M04_RUNTIME_GRANTS>", grants);
}

const SAFE_DATABASE_ERROR_CODES = new Set([
  "M04_DATABASE_ENVIRONMENT_PROHIBITED",
  "M04_DATABASE_URL_INVALID",
  "M04_DATABASE_HOST_NOT_ALLOWLISTED",
  "M04_DATABASE_HOST_NOT_LOOPBACK",
  "M04_DATABASE_BOOTSTRAP_INVALID",
  "M04_MIGRATION_SEQUENCE_INVALID",
  "M04_FROZEN_MIGRATION_HASH_MISMATCH",
  "M04_DATABASE_CONFIGURATION_REQUIRED",
  "M04_DATABASE_SENTINEL_INVALID",
  "M04_DATABASE_SCHEMA_INVALID",
  "M04_DATABASE_OWNERSHIP_GUARD_FAILED",
  "M04_DATABASE_SENTINEL_MISMATCH",
  "M04_MIGRATION_LEDGER_DRIFT",
  "M04_MIGRATION_LEDGER_INCOMPLETE",
  "M04_SCHEMA_CATALOG_DRIFT",
  "M04_SCHEMA_TABLE_DRIFT",
  "M04_IMMUTABILITY_TRIGGER_DRIFT",
  "M04_SCHEMA_INDEX_DRIFT",
  "M04_DATABASE_ROLE_CONFIGURATION_INVALID",
  "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
  "M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID",
]);

export function safeDatabaseErrorCode(error, fallback) {
  const message = error instanceof Error ? error.message : "";
  return SAFE_DATABASE_ERROR_CODES.has(message) ? message : fallback;
}

export function validateDatabaseTarget({ databaseUrl, environment, allowedHosts }) {
  if (environment !== "local" && environment !== "test")
    throw new Error("M04_DATABASE_ENVIRONMENT_PROHIBITED");
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("M04_DATABASE_URL_INVALID");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:")
    throw new Error("M04_DATABASE_URL_INVALID");
  const allowlist = new Set(
    allowedHosts
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  if (allowlist.size === 0 || !allowlist.has(parsed.hostname.toLowerCase()))
    throw new Error("M04_DATABASE_HOST_NOT_ALLOWLISTED");
  if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(parsed.hostname.toLowerCase()))
    throw new Error("M04_DATABASE_HOST_NOT_LOOPBACK");
  return parsed;
}

export function classifyBootstrap(actualTables, expected001, expected002 = []) {
  const actual = [...actualTables].sort();
  const first = [...expected001].sort();
  const second = [...new Set([...expected001, ...expected002])].sort();
  if (actual.length === 0) return 0;
  if (JSON.stringify(actual) === JSON.stringify(first)) return 1;
  if (expected002.length > 0 && JSON.stringify(actual) === JSON.stringify(second)) return 2;
  throw new Error("M04_DATABASE_BOOTSTRAP_INVALID");
}

export async function loadMigrations() {
  const names = (await readdir(MIGRATION_DIRECTORY))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/u.test(name))
    .sort();
  if (names.length === 0 || names.some((name, index) => Number(name.slice(0, 3)) !== index + 1))
    throw new Error("M04_MIGRATION_SEQUENCE_INVALID");
  return Promise.all(
    names.map(async (filename) => {
      const sql = await readFile(new URL(filename, MIGRATION_DIRECTORY));
      const sqlHash = sha256(sql);
      const frozen = FROZEN_MIGRATION_HASHES[filename];
      if (frozen !== undefined && frozen !== sqlHash)
        throw new Error("M04_FROZEN_MIGRATION_HASH_MISMATCH");
      const manifestBytes =
        filename === "003_m04_evidence_binding.sql"
          ? await readFile(new URL(M04_RUNTIME_MANIFEST_NAME, MIGRATION_DIRECTORY))
          : undefined;
      const manifest =
        manifestBytes === undefined ? undefined : validateRuntimePrivilegeManifest(manifestBytes);
      const manifestHash = manifestBytes === undefined ? undefined : sha256(manifestBytes);
      if (manifestHash !== undefined && manifestHash !== FROZEN_RUNTIME_MANIFEST_HASH)
        throw new Error("M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID");
      return {
        version: filename.slice(0, 3),
        filename,
        sha256: manifestHash === undefined ? sqlHash : m04MigrationIdentity(sqlHash, manifestHash),
        sqlSha256: sqlHash,
        manifestSha256: manifestHash,
        manifest,
        sql: sql.toString("utf8"),
      };
    }),
  );
}

export function databaseConfiguration(env = process.env) {
  const databaseUrl = env.AI_ARK_DATABASE_URL;
  const environment = env.AI_ARK_DATABASE_ENVIRONMENT;
  const allowedHosts = env.AI_ARK_DATABASE_ALLOWED_HOSTS;
  const ownershipSentinel = env.AI_ARK_DATABASE_OWNERSHIP_SENTINEL;
  const m04LoginRole = env.AI_ARK_M04_DATABASE_LOGIN_ROLE;
  const m01M02LoginRole = env.AI_ARK_M01_M02_DATABASE_LOGIN_ROLE;
  if (
    !databaseUrl ||
    !environment ||
    !allowedHosts ||
    !ownershipSentinel ||
    !m04LoginRole ||
    !m01M02LoginRole
  )
    throw new Error("M04_DATABASE_CONFIGURATION_REQUIRED");
  validateDatabaseTarget({ databaseUrl, environment, allowedHosts });
  if (!/^[a-z0-9-]{16,64}$/u.test(ownershipSentinel))
    throw new Error("M04_DATABASE_SENTINEL_INVALID");
  const schema = env.AI_ARK_DATABASE_SCHEMA ?? "public";
  validateDatabaseSchemaName(schema);
  validateDatabaseSchemaName(m04LoginRole);
  validateDatabaseSchemaName(m01M02LoginRole);
  if (m04LoginRole === m01M02LoginRole) throw new Error("M04_DATABASE_ROLE_CONFIGURATION_INVALID");
  return { databaseUrl, schema, ownershipSentinel, m04LoginRole, m01M02LoginRole };
}

export async function connectDatabase(env = process.env) {
  const configuration = databaseConfiguration(env);
  const client = new Client({ connectionString: configuration.databaseUrl });
  await client.connect();
  try {
    const target = (
      await client.query(
        `SELECT current_database() database_name,inet_server_addr()::text server_address,
              (d.datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)
                OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)) owns_database,
              shobj_description(d.oid,'pg_database') database_comment
         FROM pg_database d WHERE d.datname=current_database()`,
      )
    ).rows[0];
    if (target?.owns_database !== true) throw new Error("M04_DATABASE_OWNERSHIP_GUARD_FAILED");
    if (
      target.database_name === "postgres" ||
      target.database_name.startsWith("template") ||
      target.database_comment !== `ai-ark-m04-disposable:${configuration.ownershipSentinel}`
    )
      throw new Error("M04_DATABASE_SENTINEL_MISMATCH");
    const namespace = await client.query(
      `SELECT (pg_has_role(current_user,n.nspowner,'MEMBER')
                 OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user))
                AND has_schema_privilege(n.oid,'USAGE,CREATE') AS controlled
         FROM pg_catalog.pg_namespace n WHERE n.nspname=$1`,
      [configuration.schema],
    );
    if (namespace.rows.length !== 1 || namespace.rows[0].controlled !== true)
      throw new Error("M04_DATABASE_SCHEMA_GUARD_FAILED");
    await client.query(
      `SET search_path TO ${quoteDatabaseIdentifier(configuration.schema)}, public`,
    );
    return { client, schema: configuration.schema };
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export function createdTables(sql) {
  return [...sql.matchAll(/^CREATE TABLE ([a-z0-9_]+)\s*\(/gmu)].map((match) => match[1]);
}

export async function assertM04IdempotencyCollation(client, schema) {
  const result = await client.query(
    `SELECT a.attcollation = 'pg_catalog."C"'::regcollation AS column_uses_c,
            EXISTS (
              SELECT 1 FROM pg_catalog.pg_constraint con
              JOIN pg_catalog.pg_index i ON i.indexrelid=con.conindid
              WHERE con.conrelid=t.oid AND con.contype='u'
                AND con.conkey=ARRAY[a.attnum]::smallint[]
                AND i.indisunique AND i.indisvalid AND i.indisready
                AND i.indnkeyatts=1 AND i.indkey[0]=a.attnum
                AND i.indcollation[0]='pg_catalog."C"'::regcollation
            ) AS unique_index_uses_c
       FROM pg_catalog.pg_class t
       JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid
      WHERE n.nspname=$1 AND t.relname='m04_binding_requests'
        AND t.relkind IN ('r','p') AND a.attname='idempotency_key'
        AND a.attnum>0 AND NOT a.attisdropped`,
    [schema],
  );
  if (
    result.rows.length !== 1 ||
    result.rows[0].column_uses_c !== true ||
    result.rows[0].unique_index_uses_c !== true
  )
    throw new Error("M04_IDEMPOTENCY_COLLATION_DRIFT");
}

function normalizeCatalogDefinition(value, schema) {
  return value
    .replaceAll(`SET search_path TO ${schema}, public`, "SET search_path TO __schema__, public")
    .replaceAll(`SET search_path TO "${schema}", public`, "SET search_path TO __schema__, public")
    .replaceAll(`SET search_path TO '${schema}', 'public'`, "SET search_path TO __schema__, public")
    .replaceAll(`"${schema}".`, "")
    .replaceAll(`${schema}.`, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

export async function readSchemaCatalog(client, schema) {
  const rows = await client.query(
    `SELECT object_kind,object_name,definition FROM (
       SELECT 'column' object_kind,c.relname||'.'||a.attnum::text||'.'||a.attname object_name,
              format('%s|%s|%s',format_type(a.atttypid,a.atttypmod),a.attnotnull,
                coalesce(pg_get_expr(d.adbin,d.adrelid),'')) definition
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
         LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
        WHERE n.nspname=$1 AND c.relkind IN ('r','p')
       UNION ALL
       SELECT 'constraint',c.relname||'.'||con.conname,
              con.contype::text||'|'||con.condeferrable::text||'|'||con.condeferred::text||'|'||pg_get_constraintdef(con.oid,true)
         FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
       UNION ALL
       SELECT 'index',tablename||'.'||indexname,indexdef FROM pg_indexes WHERE schemaname=$1
       UNION ALL
       SELECT 'relation' object_kind,c.relname object_name,
              c.relkind::text||'|'||coalesce(pg_get_viewdef(c.oid,true),'') definition
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=$1 AND c.relkind IN ('v','m','f')
       UNION ALL
       SELECT 'sequence' object_kind,sequencename object_name,
              format('%s|%s|%s|%s|%s|%s|%s',data_type,start_value,min_value,max_value,
                increment_by,cycle,cache_size) definition
         FROM pg_sequences WHERE schemaname=$1
       UNION ALL
       SELECT 'type' object_kind,t.typname object_name,
              coalesce((SELECT string_agg(e.enumlabel,',' ORDER BY e.enumsortorder)
                          FROM pg_enum e WHERE e.enumtypid=t.oid),'') definition
         FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname=$1 AND t.typtype='e'
       UNION ALL
       SELECT 'domain' object_kind,t.typname object_name,
              format('%s|%s|%s',format_type(t.typbasetype,t.typtypmod),t.typnotnull,
                coalesce(pg_get_expr(t.typdefaultbin,0),t.typdefault,'')) definition
         FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname=$1 AND t.typtype='d'
       UNION ALL
       SELECT 'policy' object_kind,c.relname||'.'||p.polname object_name,
              format('%s|%s|%s|%s|%s',p.polcmd,p.polpermissive,
                coalesce(array_to_string(p.polroles,','),''),coalesce(pg_get_expr(p.polqual,p.polrelid),''),
                coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) definition
         FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
       UNION ALL
       SELECT 'trigger',event_object_table||'.'||trigger_name,pg_get_triggerdef(t.oid,true)
         FROM information_schema.triggers it JOIN pg_trigger t ON t.tgname=it.trigger_name
         JOIN pg_class c ON c.oid=t.tgrelid AND c.relname=it.event_object_table
         JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=it.trigger_schema
        WHERE it.trigger_schema=$1
       UNION ALL
       SELECT 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_functiondef(p.oid)
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1
          AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
            WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
     ) catalog ORDER BY object_kind,object_name,definition`,
    [schema],
  );
  return rows.rows.map(({ object_kind, object_name, definition }) => ({
    kind: object_kind,
    name: object_name,
    definition: normalizeCatalogDefinition(definition, schema),
  }));
}

export async function expectedSchemaCatalog(
  client,
  migrations,
  prefixLength,
  dependencySchema = "public",
) {
  const scratch = `m04_catalog_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  await client.query("BEGIN");
  try {
    await client.query(`CREATE SCHEMA ${scratch}`);
    validateDatabaseSchemaName(dependencySchema);
    await client.query(
      `SET LOCAL search_path TO ${quoteDatabaseIdentifier(scratch)}, public, ${quoteDatabaseIdentifier(dependencySchema)}`,
    );
    for (const migration of migrations.slice(0, prefixLength))
      await client.query(renderMigrationSql(migration.sql, scratch, migration.manifest));
    const catalog = await readSchemaCatalog(client, scratch);
    await client.query("ROLLBACK");
    return catalog;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export function classifyCatalog(actual, expectedPrefixes) {
  const actualBytes = JSON.stringify(actual);
  for (const [prefixLength, expected] of expectedPrefixes.entries())
    if (actualBytes === JSON.stringify(expected)) return prefixLength;
  throw new Error("M04_DATABASE_BOOTSTRAP_INVALID");
}
