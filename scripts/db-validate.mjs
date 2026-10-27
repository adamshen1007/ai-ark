import pg from "pg";

import {
  assertM04IdempotencyCollation,
  connectDatabase,
  databaseConfiguration,
  expectedSchemaCatalog,
  loadMigrations,
  quoteDatabaseIdentifier,
  readSchemaCatalog,
  safeDatabaseErrorCode,
} from "./db-common.mjs";

const { Client } = pg;

const requiredTables = [
  "schema_migrations",
  "m03_extraction_bundles",
  "m03_extraction_bundle_chunks",
  "m04_binding_requests",
  "m04_evidence_items",
  "m04_claims",
  "m04_claim_evidence_links",
  "m04_completeness_snapshots",
  "m04_binding_results",
  "m03_m04_predecessor_fence",
];
const immutableTables = [
  "schema_migrations",
  "source_snapshots",
  "acquisition_results",
  "m01_source_entries",
  "m01_source_documents",
  "resource_version_observations",
  ...requiredTables.slice(1).filter((table) => table !== "m03_m04_predecessor_fence"),
];

const GROUP_M04 = "ai_ark_m04_runtime";
const GROUP_WRITER = "ai_ark_m01_m02_writer";
const FENCE_FUNCTIONS = [
  "m03_m04_lock_predecessor_shared()",
  "m03_m04_lock_predecessor_exclusive()",
  "m03_m04_bump_predecessor_epoch()",
];

function runtimeConnectionUrl(env, ownerUrl, role, key) {
  const value = env[key];
  if (typeof value !== "string" || value.length === 0)
    throw new Error("M04_DATABASE_ROLE_CONFIGURATION_INVALID");
  let owner;
  let runtime;
  try {
    owner = new URL(ownerUrl);
    runtime = new URL(value);
  } catch {
    throw new Error("M04_DATABASE_ROLE_CONFIGURATION_INVALID");
  }
  if (
    runtime.protocol !== owner.protocol ||
    runtime.hostname !== owner.hostname ||
    runtime.port !== owner.port ||
    runtime.pathname !== owner.pathname ||
    decodeURIComponent(runtime.username) !== role ||
    runtime.password.length === 0
  )
    throw new Error("M04_DATABASE_ROLE_CONFIGURATION_INVALID");
  return value;
}

async function validateExactAclClosure(
  client,
  namespaceOid,
  schema,
  manifest,
  byName,
  configuration,
) {
  const roleNames = {
    M01_M02_WRITER_GROUP: GROUP_WRITER,
    M04_RUNTIME_GROUP: GROUP_M04,
  };
  const cell = (kind, name, grantee, privilege) => JSON.stringify([kind, name, grantee, privilege]);
  const expected = new Set();
  for (const group of manifest.groups) {
    const oid = byName.get(roleNames[group.role])?.oid;
    if (oid === undefined) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    const grantee = String(oid);
    expected.add(cell("schema", schema, grantee, "USAGE"));
    for (const relation of group.relations)
      for (const operation of relation.operations)
        expected.add(cell("relation", relation.name, grantee, operation));
    for (const sequence of group.sequences)
      for (const operation of sequence.operations)
        expected.add(cell("sequence", sequence.name, grantee, operation));
    for (const signature of group.functions)
      expected.add(cell("function", signature, grantee, "EXECUTE"));
  }
  const actual = await client.query(
    `SELECT 'schema' kind,n.nspname name,n.nspowner::text owner_oid,
            acl.grantee::text grantee_oid,acl.grantor::text grantor_oid,
            acl.privilege_type privilege,acl.is_grantable grantable
       FROM pg_namespace n,
            LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
      WHERE n.oid=$1::oid
     UNION ALL
     SELECT CASE WHEN c.relkind='S' THEN 'sequence' ELSE 'relation' END kind,
            c.relname name,c.relowner::text owner_oid,
            acl.grantee::text grantee_oid,acl.grantor::text grantor_oid,
            acl.privilege_type privilege,acl.is_grantable grantable
       FROM pg_class c,
            LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
      WHERE c.relnamespace=$1::oid AND c.relkind IN ('r','p','S')
     UNION ALL
     SELECT 'function' kind,
            p.proname||'('||replace(oidvectortypes(p.proargtypes),', ', ',')||')' name,
            p.proowner::text owner_oid,acl.grantee::text grantee_oid,
            acl.grantor::text grantor_oid,acl.privilege_type privilege,
            acl.is_grantable grantable
       FROM pg_proc p,
            LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      WHERE p.pronamespace=$1::oid
        AND NOT EXISTS (SELECT 1 FROM pg_depend d
          WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
    [namespaceOid],
  );
  const ownership = await client.query(
    `SELECT ledger.relowner::text owner_oid,db_owner.oid::text database_owner_oid
       FROM pg_class ledger JOIN pg_roles db_owner ON db_owner.rolname='pg_database_owner'
      WHERE ledger.relnamespace=$1::oid AND ledger.relname='schema_migrations'
        AND ledger.relkind='r'`,
    [namespaceOid],
  );
  if (ownership.rowCount !== 1) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const migrationOwner = ownership.rows[0].owner_oid;
  const databaseOwner = ownership.rows[0].database_owner_oid;
  const validatorPrincipal = await client.query(
    `SELECT oid::text owner_oid FROM pg_roles
      WHERE rolname=session_user AND rolname=current_user`,
  );
  if (validatorPrincipal.rowCount !== 1 || validatorPrincipal.rows[0].owner_oid !== migrationOwner)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const objectOwners = await client.query(
    `SELECT 'schema' kind,n.nspowner::text owner_oid FROM pg_namespace n WHERE n.oid=$1::oid
     UNION ALL
     SELECT 'object',c.relowner::text FROM pg_class c
      WHERE c.relnamespace=$1::oid AND c.relkind IN ('r','p','S')
     UNION ALL
     SELECT 'object',p.proowner::text FROM pg_proc p
      WHERE p.pronamespace=$1::oid
        AND NOT EXISTS (SELECT 1 FROM pg_depend d
          WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
    [namespaceOid],
  );
  if (
    objectOwners.rowCount === 0 ||
    objectOwners.rows.some((row) =>
      row.kind === "schema"
        ? row.owner_oid !== migrationOwner && row.owner_oid !== databaseOwner
        : row.owner_oid !== migrationOwner,
    )
  )
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  for (const row of actual.rows) {
    if (
      row.kind === "schema"
        ? row.owner_oid !== migrationOwner && row.owner_oid !== databaseOwner
        : row.owner_oid !== migrationOwner
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    if (row.grantee_oid === row.owner_oid) continue;
    if (
      row.grantable ||
      row.grantor_oid !== row.owner_oid ||
      !expected.delete(cell(row.kind, row.name, row.grantee_oid, row.privilege))
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  }
  if (expected.size !== 0) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const columns = await client.query(
    `SELECT c.relname relation,a.attname column
       FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid,
            LATERAL aclexplode(a.attacl) acl
      WHERE c.relnamespace=$1::oid AND a.attnum>0 AND NOT a.attisdropped`,
    [namespaceOid],
  );
  if (columns.rowCount !== 0) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const inbound = await client.query(
    `WITH RECURSIVE inbound(group_name,member_oid) AS (
       SELECT parent.rolname,m.member FROM pg_auth_members m
         JOIN pg_roles parent ON parent.oid=m.roleid
        WHERE parent.rolname=ANY($1::text[])
       UNION
       SELECT prior.group_name,m.member FROM inbound prior
         JOIN pg_auth_members m ON m.roleid=prior.member_oid
     )
     SELECT i.group_name,member.rolname member_name,member.rolcanlogin login,
            direct.inherit_option,direct.admin_option
       FROM inbound i JOIN pg_roles member ON member.oid=i.member_oid
         JOIN pg_roles parent ON parent.rolname=i.group_name
         LEFT JOIN pg_auth_members direct
           ON direct.roleid=parent.oid AND direct.member=i.member_oid`,
    [[GROUP_WRITER, GROUP_M04]],
  );
  if (
    inbound.rowCount !== 2 ||
    inbound.rows.filter(
      (row) => row.group_name === GROUP_WRITER && row.member_name === configuration.m01M02LoginRole,
    ).length !== 1 ||
    inbound.rows.filter(
      (row) => row.group_name === GROUP_M04 && row.member_name === configuration.m04LoginRole,
    ).length !== 1 ||
    inbound.rows.some((row) => !row.login || !row.inherit_option || row.admin_option !== false)
  )
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
}

async function validateRoleAuthority(client, schema, configuration, manifest, env) {
  const namespace = await client.query(
    `SELECT oid,nspname,nspowner FROM pg_namespace
      WHERE nspname=$1 AND nspname !~ '^pg_' AND nspname <> 'information_schema'`,
    [schema],
  );
  if (namespace.rowCount !== 1 || namespace.rows[0].nspname !== schema)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const roles = await client.query(
    `SELECT oid,rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication
       FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
    [[GROUP_M04, GROUP_WRITER, configuration.m04LoginRole, configuration.m01M02LoginRole]],
  );
  if (roles.rowCount !== 4) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const byName = new Map(roles.rows.map((role) => [role.rolname, role]));
  await validateExactAclClosure(
    client,
    namespace.rows[0].oid,
    schema,
    manifest,
    byName,
    configuration,
  );
  for (const group of [GROUP_M04, GROUP_WRITER]) {
    const role = byName.get(group);
    if (
      role?.rolcanlogin !== false ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreaterole ||
      role.rolcreatedb ||
      role.rolreplication
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  }
  for (const login of [configuration.m04LoginRole, configuration.m01M02LoginRole]) {
    const role = byName.get(login);
    if (
      role?.rolcanlogin !== true ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreaterole ||
      role.rolcreatedb ||
      role.rolreplication
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  }
  const direct = await client.query(
    `SELECT member.rolname member_name,parent.rolname parent_name,m.inherit_option
       FROM pg_auth_members m
       JOIN pg_roles member ON member.oid=m.member
       JOIN pg_roles parent ON parent.oid=m.roleid
      WHERE member.rolname=ANY($1::text[])`,
    [[configuration.m04LoginRole, configuration.m01M02LoginRole]],
  );
  const exactMembership = (login, group) =>
    direct.rows.filter((row) => row.member_name === login && row.parent_name === group).length ===
      1 &&
    direct.rows.find((row) => row.member_name === login && row.parent_name === group)
      ?.inherit_option === true;
  if (
    !exactMembership(configuration.m04LoginRole, GROUP_M04) ||
    !exactMembership(configuration.m01M02LoginRole, GROUP_WRITER) ||
    direct.rows.length !== 2 ||
    direct.rows.some(
      (row) =>
        (row.member_name === configuration.m04LoginRole && row.parent_name !== GROUP_M04) ||
        (row.member_name === configuration.m01M02LoginRole && row.parent_name !== GROUP_WRITER),
    )
  )
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const groupCrossMembership = await client.query(
    `SELECT 1 FROM pg_auth_members membership
      JOIN pg_roles parent_role ON parent_role.oid=membership.roleid
      JOIN pg_roles member_role ON member_role.oid=membership.member
     WHERE (parent_role.rolname=$1 AND member_role.rolname=$2)
        OR (parent_role.rolname=$2 AND member_role.rolname=$1)`,
    [GROUP_M04, GROUP_WRITER],
  );
  if (groupCrossMembership.rowCount !== 0) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  for (const [login, prohibitedGroup] of [
    [configuration.m04LoginRole, GROUP_WRITER],
    [configuration.m01M02LoginRole, GROUP_M04],
  ]) {
    const reachable = await client.query(
      `WITH RECURSIVE reachable(oid) AS (
         SELECT oid FROM pg_roles WHERE rolname=$1
         UNION
         SELECT membership.roleid FROM pg_auth_members membership
         JOIN reachable prior ON prior.oid=membership.member
         WHERE membership.inherit_option OR membership.set_option
       )
       SELECT role.oid,role.rolname,role.rolsuper,role.rolbypassrls,role.rolcreaterole,
              role.rolcreatedb,role.rolreplication
         FROM reachable JOIN pg_roles role USING (oid)`,
      [login],
    );
    if (
      reachable.rows.length !== 2 ||
      reachable.rows.some(
        (role) =>
          ![login, login === configuration.m04LoginRole ? GROUP_M04 : GROUP_WRITER].includes(
            role.rolname,
          ) ||
          role.rolname === prohibitedGroup ||
          role.rolsuper ||
          role.rolbypassrls ||
          role.rolcreaterole ||
          role.rolcreatedb ||
          role.rolreplication ||
          role.oid === namespace.rows[0].nspowner,
      )
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  }
  const schemaIdentifier = quoteDatabaseIdentifier(schema);
  const fenceRelation = `${schemaIdentifier}.m03_m04_predecessor_fence`;
  for (const [login, shared, exclusive, groupToken, urlKey] of [
    [
      configuration.m04LoginRole,
      true,
      false,
      "M04_RUNTIME_GROUP",
      "AI_ARK_M04_DATABASE_RUNTIME_URL",
    ],
    [
      configuration.m01M02LoginRole,
      false,
      true,
      "M01_M02_WRITER_GROUP",
      "AI_ARK_M01_M02_DATABASE_WRITER_URL",
    ],
  ]) {
    const url = runtimeConnectionUrl(env, configuration.databaseUrl, login, urlKey);
    const runtime = new Client({ connectionString: url });
    try {
      await runtime.connect();
      const session = (await runtime.query("SELECT session_user,current_user")).rows[0];
      if (session?.session_user !== login || session.current_user !== login)
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const actualNamespace = (
        await runtime.query("SELECT oid,nspname FROM pg_namespace WHERE nspname=$1", [schema])
      ).rows;
      if (
        actualNamespace.length !== 1 ||
        actualNamespace[0].nspname !== schema ||
        actualNamespace[0].oid !== namespace.rows[0].oid
      )
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const expectedGroup = manifest.groups.find((group) => group.role === groupToken);
      if (expectedGroup === undefined) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const expectedRelations = new Map(
        expectedGroup.relations.map((relation) => [relation.name, new Set(relation.operations)]),
      );
      const actualRelations = await runtime.query(
        `SELECT c.relname,
                has_table_privilege(current_user,c.oid,'SELECT') can_select,
                has_table_privilege(current_user,c.oid,'INSERT') can_insert,
                has_table_privilege(current_user,c.oid,'UPDATE') can_update,
                has_table_privilege(current_user,c.oid,'DELETE') can_delete,
                has_table_privilege(current_user,c.oid,'TRUNCATE') can_truncate,
                has_table_privilege(current_user,c.oid,'REFERENCES') can_references,
                has_table_privilege(current_user,c.oid,'TRIGGER') can_trigger
           FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.oid=$1 AND c.relkind IN ('r','p') ORDER BY c.relname`,
        [namespace.rows[0].oid],
      );
      if (
        actualRelations.rows.some((relation) => {
          const allowed = expectedRelations.get(relation.relname) ?? new Set();
          return (
            relation.can_select !== allowed.has("SELECT") ||
            relation.can_insert !== allowed.has("INSERT") ||
            relation.can_update !== allowed.has("UPDATE") ||
            relation.can_delete ||
            relation.can_truncate ||
            relation.can_references ||
            relation.can_trigger
          );
        }) ||
        expectedRelations.size !==
          actualRelations.rows.filter((relation) => expectedRelations.has(relation.relname)).length
      )
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const permittedSequences = new Set(
        expectedGroup.sequences.map(({ name, operations }) => {
          if (operations.length !== 1 || operations[0] !== "USAGE")
            throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
          return name;
        }),
      );
      const actualSequences = await runtime.query(
        `SELECT c.relname name,
                has_sequence_privilege(current_user,c.oid,'USAGE') usage,
                has_sequence_privilege(current_user,c.oid,'SELECT') can_select,
                has_sequence_privilege(current_user,c.oid,'UPDATE') can_update
           FROM pg_class c WHERE c.relnamespace=$1::oid AND c.relkind='S'`,
        [namespace.rows[0].oid],
      );
      if (
        actualSequences.rows.filter((row) => permittedSequences.has(row.name)).length !==
          permittedSequences.size ||
        actualSequences.rows.some(
          (row) =>
            row.usage !== permittedSequences.has(row.name) || row.can_select || row.can_update,
        )
      )
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const directGrants = await runtime.query(
        `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
                LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) grant_row
          WHERE n.oid=$1 AND grant_row.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
          LIMIT 1`,
        [namespace.rows[0].oid, login],
      );
      if (directGrants.rowCount !== 0) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const privileges = await runtime.query(
        `SELECT has_schema_privilege($1,$2,'USAGE') schema_usage,
              has_schema_privilege($1,$2,'CREATE') schema_create,
              has_table_privilege($1,$3,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') table_access,
              has_function_privilege($1,$4,'EXECUTE') shared_execute,
              has_function_privilege($1,$5,'EXECUTE') exclusive_execute,
              has_function_privilege($1,$6,'EXECUTE') bump_execute`,
        [
          login,
          schema,
          fenceRelation,
          `${schemaIdentifier}.${FENCE_FUNCTIONS[0]}`,
          `${schemaIdentifier}.${FENCE_FUNCTIONS[1]}`,
          `${schemaIdentifier}.${FENCE_FUNCTIONS[2]}`,
        ],
      );
      const value = privileges.rows[0];
      if (
        value?.schema_usage !== true ||
        value.schema_create ||
        value.table_access ||
        value.shared_execute !== shared ||
        value.exclusive_execute !== exclusive ||
        value.bump_execute
      )
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      for (const signature of expectedGroup.functions) {
        const allowed = await runtime.query(
          "SELECT has_function_privilege(current_user,$1,'EXECUTE') allowed",
          [`${schemaIdentifier}.${signature}`],
        );
        if (allowed.rows[0]?.allowed !== true) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      }
      const m04Functions = await runtime.query(
        `SELECT p.proname||'('||replace(oidvectortypes(p.proargtypes),', ', ',')||')' signature,
                has_function_privilege(current_user,p.oid,'EXECUTE') allowed
           FROM pg_proc p WHERE p.pronamespace=$1::oid
             AND NOT EXISTS (SELECT 1 FROM pg_depend d
               WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
           ORDER BY p.oid`,
        [namespace.rows[0].oid],
      );
      const permittedFunctions = new Set(expectedGroup.functions);
      if (
        m04Functions.rows.some((fn) => fn.allowed !== permittedFunctions.has(fn.signature)) ||
        [...permittedFunctions].some(
          (signature) => !m04Functions.rows.some((fn) => fn.signature === signature),
        )
      )
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const directFunctions = await runtime.query(
        `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
                LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) grant_row
          WHERE n.oid=$1 AND grant_row.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
          LIMIT 1`,
        [namespace.rows[0].oid, login],
      );
      if (directFunctions.rowCount !== 0) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
      const publicGrants = await runtime.query(
        `SELECT EXISTS (
           SELECT 1 FROM pg_namespace n,
             LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) acl
            WHERE n.oid=$1::oid AND acl.grantee=0
           UNION ALL
           SELECT 1 FROM pg_class c,
             LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
            WHERE c.relnamespace=$1::oid AND acl.grantee=0
           UNION ALL
           SELECT 1 FROM pg_proc p,
             LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            WHERE p.pronamespace=$1::oid AND acl.grantee=0
              AND NOT EXISTS (SELECT 1 FROM pg_depend d
                WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
         ) granted`,
        [namespace.rows[0].oid],
      );
      if (publicGrants.rows[0]?.granted !== false)
        throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("M04_")) throw error;
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT", { cause: error });
    } finally {
      await runtime.end().catch(() => undefined);
    }
  }
}

export async function validate(env = process.env) {
  const migrations = await loadMigrations();
  const configuration = databaseConfiguration(env);
  const { client, schema } = await connectDatabase(env);
  try {
    const ledger = await client.query(
      "SELECT version,filename,sha256 FROM schema_migrations ORDER BY version",
    );
    if (ledger.rows.length !== migrations.length)
      throw new Error("M04_MIGRATION_LEDGER_INCOMPLETE");
    for (const [index, row] of ledger.rows.entries()) {
      const expected = migrations[index];
      if (
        !expected ||
        row.version !== expected.version ||
        row.filename !== expected.filename ||
        row.sha256 !== expected.sha256
      )
        throw new Error("M04_MIGRATION_LEDGER_DRIFT");
    }
    await assertM04IdempotencyCollation(client, schema);
    const actualCatalog = await readSchemaCatalog(client, schema);
    const expectedCatalog = await expectedSchemaCatalog(
      client,
      migrations,
      migrations.length,
      schema,
    );
    if (JSON.stringify(actualCatalog) !== JSON.stringify(expectedCatalog)) {
      throw new Error("M04_SCHEMA_CATALOG_DRIFT");
    }
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_name=ANY($2::text[])`,
      [schema, requiredTables],
    );
    if (tables.rows.length !== requiredTables.length) throw new Error("M04_SCHEMA_TABLE_DRIFT");
    const triggers = await client.query(
      `SELECT event_object_table,array_agg(DISTINCT event_manipulation) AS events
       FROM information_schema.triggers WHERE trigger_schema=$1 AND event_object_table=ANY($2::text[])
       GROUP BY event_object_table`,
      [schema, immutableTables],
    );
    const protectedTables = new Set(
      triggers.rows
        .filter(({ events }) => events.includes("UPDATE") && events.includes("DELETE"))
        .map(({ event_object_table }) => event_object_table),
    );
    if (immutableTables.some((table) => !protectedTables.has(table)))
      throw new Error("M04_IMMUTABILITY_TRIGGER_DRIFT");
    const semanticIndex = await client.query(
      `SELECT 1 FROM pg_indexes WHERE schemaname=$1 AND indexname='m04_binding_requests_semantic_idx'`,
      [schema],
    );
    if (semanticIndex.rowCount !== 1) throw new Error("M04_SCHEMA_INDEX_DRIFT");
    await validateRoleAuthority(client, schema, configuration, migrations[2].manifest, env);
    return {
      migrations: migrations.length,
      tables: requiredTables.length,
      immutableTables: immutableTables.length,
    };
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await validate();
    console.log(
      `Database schema valid: ${result.migrations} migrations, ${result.tables} M04 tables.`,
    );
  } catch (error) {
    console.error(safeDatabaseErrorCode(error, "M04_DATABASE_VALIDATION_FAILED"));
    process.exitCode = 1;
  }
}
