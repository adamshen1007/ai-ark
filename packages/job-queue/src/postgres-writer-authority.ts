import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { PoolClient } from "pg";

import { assertExactApplicationAcl } from "./postgres-acl-closure.js";
import { expectedM02Functions, expectedM02Triggers } from "./postgres-m02-function-sources.js";
import {
  M04_FUNCTION_NAMES,
  expectedM04FunctionSources,
  expectedM04Triggers,
} from "./postgres-m04-function-sources.js";

interface Manifest {
  schemaVersion: string;
  groups: readonly {
    role: string;
    relations: readonly { name: string; operations: readonly string[] }[];
    functions: readonly string[];
    sequences: readonly { name: string; operations: readonly string[] }[];
  }[];
}

const manifestPromise = readFile(
  new URL("../migrations/003_m04_runtime_privileges.json", import.meta.url),
  "utf8",
).then((bytes): Manifest => {
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    "09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991"
  )
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const manifest = JSON.parse(bytes) as Manifest;
  if (manifest.schemaVersion !== "M04_RUNTIME_PRIVILEGES_V2")
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  return manifest;
});

const fail = (): never => {
  throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
};

export async function assertWriterAuthority(
  client: PoolClient,
  schema: string,
  loginRole: string,
  expectedIdentity?: string,
  peerLoginRole?: string,
): Promise<string | null> {
  try {
    const m04Objects = (
      await client.query<{ name: string }>(
        `SELECT c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname=$1 AND c.relname IN ('m04_binding_requests','m03_m04_predecessor_fence')`,
        [schema],
      )
    ).rows;
    // The completed M02 schema remains usable before migration 003 is installed.
    // A partial M04 schema is never treated as legacy authority.
    if (m04Objects.length === 0) {
      if (expectedIdentity !== undefined) fail();
      return null;
    }
    if (m04Objects.length !== 2) fail();
    if (typeof peerLoginRole !== "string") throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    const validatedPeerLoginRole = peerLoginRole;
    if (!/^[a-z][a-z0-9_]{0,62}$/u.test(validatedPeerLoginRole)) fail();
    const manifest = await manifestPromise;
    const writer = manifest.groups.find((group) => group.role === "M01_M02_WRITER_GROUP");
    if (writer === undefined || manifest.groups.length !== 2)
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    const session = (
      await client.query<{
        session_user: string;
        current_user: string;
        namespace_oid: string;
        schema_usage: boolean;
        schema_create: boolean;
      }>(
        `SELECT session_user,current_user,n.oid::text namespace_oid,
                has_schema_privilege(current_user,n.oid,'USAGE') schema_usage,
                has_schema_privilege(current_user,n.oid,'CREATE') schema_create
           FROM pg_namespace n WHERE n.nspname=$1`,
        [schema],
      )
    ).rows;
    const identity = session[0];
    if (identity === undefined) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    if (
      session.length !== 1 ||
      identity.session_user !== loginRole ||
      identity.current_user !== loginRole ||
      !identity.schema_usage ||
      identity.schema_create
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    const roleRows = (
      await client.query<{
        name: string;
        login: boolean;
        superuser: boolean;
        bypass_rls: boolean;
        create_role: boolean;
        create_database: boolean;
        replicate: boolean;
        owner: boolean;
      }>(
        `SELECT r.rolname name,r.rolcanlogin login,r.rolsuper superuser,
                r.rolbypassrls bypass_rls,r.rolcreaterole create_role,
                r.rolcreatedb create_database,r.rolreplication replicate,
                r.oid=n.nspowner owner
           FROM pg_roles r CROSS JOIN pg_namespace n
          WHERE n.oid=$1::oid AND r.rolname=ANY($2::text[])`,
        [identity.namespace_oid, [loginRole, "ai_ark_m01_m02_writer", "ai_ark_m04_runtime"]],
      )
    ).rows;
    if (
      roleRows.length !== 3 ||
      roleRows.some(
        (role) =>
          role.login !== (role.name === loginRole) ||
          role.superuser ||
          role.bypass_rls ||
          role.create_role ||
          role.create_database ||
          role.replicate ||
          role.owner,
      )
    )
      fail();
    await assertExactApplicationAcl(
      client,
      identity.namespace_oid,
      schema,
      loginRole,
      "ai_ark_m01_m02_writer",
      validatedPeerLoginRole,
    );
    const direct = (
      await client.query<{ name: string; inherit_option: boolean }>(
        `SELECT parent.rolname name,m.inherit_option
           FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
             JOIN pg_roles parent ON parent.oid=m.roleid
          WHERE member.rolname=$1`,
        [loginRole],
      )
    ).rows;
    if (
      direct.length !== 1 ||
      direct[0]?.name !== "ai_ark_m01_m02_writer" ||
      !direct[0].inherit_option
    )
      fail();
    const reachable = (
      await client.query<{ name: string }>(
        `WITH RECURSIVE roles(oid) AS (
           SELECT oid FROM pg_roles WHERE rolname=$1
           UNION
           SELECT m.roleid FROM pg_auth_members m JOIN roles prior ON prior.oid=m.member
            WHERE m.inherit_option OR m.set_option
         )
         SELECT r.rolname name FROM roles JOIN pg_roles r ON r.oid=roles.oid`,
        [loginRole],
      )
    ).rows;
    if (
      reachable.length !== 2 ||
      reachable.some((role) => ![loginRole, "ai_ark_m01_m02_writer"].includes(role.name))
    )
      fail();
    const permittedRelations = new Map(
      writer.relations.map((relation) => [relation.name, new Set(relation.operations)]),
    );
    const relationRows = (
      await client.query<{
        name: string;
        oid: string;
        select: boolean;
        insert: boolean;
        update: boolean;
        delete: boolean;
        truncate: boolean;
        references: boolean;
        trigger: boolean;
      }>(
        `SELECT c.relname name,c.oid::text oid,
                has_table_privilege(current_user,c.oid,'SELECT') "select",
                has_table_privilege(current_user,c.oid,'INSERT') "insert",
                has_table_privilege(current_user,c.oid,'UPDATE') "update",
                has_table_privilege(current_user,c.oid,'DELETE') "delete",
                has_table_privilege(current_user,c.oid,'TRUNCATE') "truncate",
                has_table_privilege(current_user,c.oid,'REFERENCES') "references",
                has_table_privilege(current_user,c.oid,'TRIGGER') "trigger"
           FROM pg_class c WHERE c.relnamespace=$1::oid AND c.relkind IN ('r','p')`,
        [identity.namespace_oid],
      )
    ).rows;
    if (
      relationRows.filter((row) => permittedRelations.has(row.name)).length !==
        permittedRelations.size ||
      relationRows.some((row) => {
        const allowed = permittedRelations.get(row.name) ?? new Set<string>();
        return (
          row.select !== allowed.has("SELECT") ||
          row.insert !== allowed.has("INSERT") ||
          row.update !== allowed.has("UPDATE") ||
          row.delete ||
          row.truncate ||
          row.references ||
          row.trigger
        );
      })
    )
      fail();
    const permittedSequences = new Set(
      writer.sequences
        .filter(
          (sequence) => sequence.operations.length === 1 && sequence.operations[0] === "USAGE",
        )
        .map((sequence) => sequence.name),
    );
    if (permittedSequences.size !== writer.sequences.length) fail();
    const sequenceRows = (
      await client.query<{
        name: string;
        oid: string;
        usage: boolean;
        select: boolean;
        update: boolean;
      }>(
        `SELECT c.relname name,c.oid::text oid,
                has_sequence_privilege(current_user,c.oid,'USAGE') usage,
                has_sequence_privilege(current_user,c.oid,'SELECT') "select",
                has_sequence_privilege(current_user,c.oid,'UPDATE') "update"
           FROM pg_class c WHERE c.relnamespace=$1::oid AND c.relkind='S'`,
        [identity.namespace_oid],
      )
    ).rows;
    if (
      sequenceRows.filter((row) => permittedSequences.has(row.name)).length !==
        permittedSequences.size ||
      sequenceRows.some(
        (row) => row.usage !== permittedSequences.has(row.name) || row.select || row.update,
      )
    )
      fail();
    const functionRows = (
      await client.query<{
        signature: string;
        oid: string;
        execute: boolean;
        source: string;
        security_definer: boolean;
        owner_matches_migration: boolean;
        settings: string[] | null;
        arguments: string;
        return_type: string;
        language: string;
        volatility: string;
        strict: boolean;
        kind: string;
        parallel: string;
        leakproof: boolean;
        cost: string;
      }>(
        `SELECT p.proname||'('||replace(oidvectortypes(p.proargtypes),', ', ',')||')' signature,
                p.oid::text oid,
                has_function_privilege(current_user,p.oid,'EXECUTE') execute,
                p.prosrc source,p.prosecdef security_definer,
                p.proowner=(SELECT c.relowner FROM pg_class c
                  WHERE c.relnamespace=$1::oid AND c.relname='m04_binding_requests')
                  owner_matches_migration,p.proconfig settings,
                pg_get_function_identity_arguments(p.oid) arguments,
                p.prorettype::regtype::text return_type,l.lanname language,
                p.provolatile volatility,p.proisstrict strict,p.prokind kind,
                p.proparallel parallel,p.proleakproof leakproof,p.procost::text cost
           FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
          WHERE p.pronamespace=$1::oid
             AND NOT EXISTS (SELECT 1 FROM pg_depend d
               WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')`,
        [identity.namespace_oid],
      )
    ).rows;
    const permittedFunctions = new Set(writer.functions);
    const legacyFunctions = await expectedM02Functions();
    const fenceSources = await expectedM04FunctionSources(schema);
    const fenceNames = [
      "m03_m04_lock_predecessor_shared",
      "m03_m04_lock_predecessor_exclusive",
      "m03_m04_bump_predecessor_epoch",
    ];
    if (
      functionRows.filter((row) => permittedFunctions.has(row.signature)).length !==
        permittedFunctions.size ||
      functionRows.some((row) => row.execute !== permittedFunctions.has(row.signature)) ||
      functionRows.length !== legacyFunctions.size + M04_FUNCTION_NAMES.length ||
      functionRows.some((row) => {
        const name = row.signature.slice(0, row.signature.indexOf("("));
        const expected = legacyFunctions.get(name);
        if (expected === undefined)
          return !M04_FUNCTION_NAMES.includes(name as (typeof M04_FUNCTION_NAMES)[number]);
        return (
          row.source !== expected.source ||
          row.arguments.replace(/\s+/gu, " ").replace(/,\s*/gu, ", ").trim() !==
            expected.arguments ||
          row.return_type !== expected.returnType ||
          row.language !== expected.language ||
          row.volatility !== expected.volatility ||
          row.strict !== expected.strict ||
          row.security_definer ||
          !row.owner_matches_migration ||
          row.settings?.length !== 1 ||
          row.settings[0] !== `search_path=${schema}, public` ||
          row.kind !== "f" ||
          row.parallel !== "u" ||
          row.leakproof ||
          row.cost !== "100"
        );
      }) ||
      fenceNames.some((name) => {
        const found = functionRows.find((row) => row.signature === `${name}()`);
        return (
          found === undefined ||
          found.source !== fenceSources.get(name) ||
          !found.security_definer ||
          !found.owner_matches_migration ||
          found.settings?.length !== 1 ||
          found.settings[0] !== "search_path=pg_catalog"
        );
      })
    )
      fail();
    const fenceTriggers = [...(await expectedM04Triggers()).entries()].filter(([name]) =>
      name.startsWith("m03_m04_fence_"),
    );
    const bumpOid = functionRows.find(
      (row) => row.signature === "m03_m04_bump_predecessor_epoch()",
    )?.oid;
    const actualFenceTriggers = (
      await client.query<{
        name: string;
        oid: string;
        relation: string;
        function_oid: string;
        type: number;
        enabled: string;
        no_when: boolean;
        no_args: boolean;
      }>(
        `SELECT t.tgname name,t.oid::text oid,c.relname relation,t.tgfoid::text function_oid,
                t.tgtype type,t.tgenabled enabled,t.tgqual IS NULL no_when,
                octet_length(t.tgargs)=0 no_args
           FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          WHERE c.relnamespace=$1::oid AND NOT t.tgisinternal
            AND t.tgname LIKE 'm03_m04_fence_%'`,
        [identity.namespace_oid],
      )
    ).rows;
    if (
      bumpOid === undefined ||
      actualFenceTriggers.length !== fenceTriggers.length ||
      actualFenceTriggers.some((trigger) => {
        const expected = fenceTriggers.find(([name]) => name === trigger.name)?.[1];
        if (expected === undefined) return true;
        return (
          trigger.relation !== expected.relation ||
          trigger.function_oid !== bumpOid ||
          trigger.type !== expected.type ||
          trigger.enabled !== "O" ||
          !trigger.no_when ||
          !trigger.no_args
        );
      })
    )
      fail();
    const expectedLegacyTriggers = await expectedM02Triggers();
    const m04TriggerNames = [...(await expectedM04Triggers()).keys()];
    const legacyTriggerRows = (
      await client.query<{
        name: string;
        oid: string;
        relation: string;
        function_oid: string;
        type: number;
        enabled: string;
        deferrable: boolean;
        initially_deferred: boolean;
        definition: string;
        no_args: boolean;
      }>(
        `SELECT t.tgname name,t.oid::text oid,c.relname relation,t.tgfoid::text function_oid,
                t.tgtype type,t.tgenabled enabled,t.tgdeferrable deferrable,
                t.tginitdeferred initially_deferred,
                pg_get_triggerdef(t.oid) definition,
                octet_length(t.tgargs)=0 no_args
           FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          WHERE c.relnamespace=$1::oid AND NOT t.tgisinternal
            AND NOT (t.tgname=ANY($2::text[]))`,
        [identity.namespace_oid, m04TriggerNames],
      )
    ).rows;
    const validWhen = (expected: string | null, definition: string): boolean => {
      if (expected === null) return !/\bWHEN\s*\(/u.test(definition);
      // Migration 002 has exactly two WHEN predicates. Compare the pinned
      // deparsed structure without normalizing quoted literal contents.
      return (
        expected === "NEW.state = 'ACTIVE'" &&
        /\bWHEN\s+\(+[Nn][Ee][Ww]\.state\s*=\s*'ACTIVE'::text\)+\s+EXECUTE FUNCTION/u.test(
          definition,
        )
      );
    };
    if (
      legacyTriggerRows.length !== expectedLegacyTriggers.size ||
      legacyTriggerRows.some((trigger) => {
        const expected = expectedLegacyTriggers.get(`${trigger.relation}.${trigger.name}`);
        if (expected === undefined) return true;
        const functionOid = functionRows.find(
          (row) => row.signature === `${expected.functionName}()`,
        )?.oid;
        return (
          functionOid === undefined ||
          trigger.function_oid !== functionOid ||
          trigger.type !== expected.type ||
          trigger.enabled !== "O" ||
          trigger.deferrable !== expected.deferrable ||
          trigger.initially_deferred !== expected.initiallyDeferred ||
          !validWhen(expected.when, trigger.definition) ||
          !trigger.no_args
        );
      })
    )
      fail();
    const directGrants = (
      await client.query<{ granted: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_class c,
             LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
            WHERE c.relnamespace=$1::oid
              AND acl.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
           UNION ALL
           SELECT 1 FROM pg_proc p,
             LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            WHERE p.pronamespace=$1::oid
              AND acl.grantee=(SELECT oid FROM pg_roles WHERE rolname=$2)
         ) granted`,
        [identity.namespace_oid, loginRole],
      )
    ).rows[0];
    if (directGrants?.granted !== false) fail();
    const publicGrants = (
      await client.query<{ granted: boolean }>(
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
        [identity.namespace_oid],
      )
    ).rows[0];
    if (publicGrants?.granted !== false) fail();
    const catalogIdentity = createHash("sha256")
      .update(
        JSON.stringify({
          namespaceOid: session[0]?.namespace_oid,
          relations: relationRows.map(({ name, oid }) => [name, oid]).sort(),
          sequences: sequenceRows.map(({ name, oid }) => [name, oid]).sort(),
          functions: functionRows.map(({ signature, oid }) => [signature, oid]).sort(),
          triggers: [...actualFenceTriggers, ...legacyTriggerRows]
            .map(({ relation, name, oid }) => [relation, name, oid])
            .sort(),
        }),
      )
      .digest("hex");
    if (expectedIdentity !== undefined && catalogIdentity !== expectedIdentity) fail();
    return catalogIdentity;
  } catch {
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  }
}
