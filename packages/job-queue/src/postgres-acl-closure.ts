import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { PoolClient } from "pg";

interface ManifestGroup {
  role: "M01_M02_WRITER_GROUP" | "M04_RUNTIME_GROUP";
  relations: readonly { name: string; operations: readonly string[] }[];
  functions: readonly string[];
  sequences: readonly { name: string; operations: readonly string[] }[];
}

interface Manifest {
  schemaVersion: string;
  groups: readonly ManifestGroup[];
}

const manifestPromise = readFile(
  new URL("../migrations/003_m04_runtime_privileges.json", import.meta.url),
).then((bytes): Manifest => {
  if (
    createHash("sha256").update(bytes).digest("hex") !==
    "09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991"
  )
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  const manifest = JSON.parse(bytes.toString("utf8")) as Manifest;
  if (manifest.schemaVersion !== "M04_RUNTIME_PRIVILEGES_V2" || manifest.groups.length !== 2)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  return manifest;
});

const fail = (): never => {
  throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
};

interface AclRow {
  kind: "schema" | "relation" | "sequence" | "function";
  name: string;
  owner_oid: string;
  grantee_oid: string;
  grantor_oid: string;
  privilege: string;
  grantable: boolean;
}

const cell = (kind: string, name: string, grantee: string, privilege: string): string =>
  JSON.stringify([kind, name, grantee, privilege]);

/** Close every application ACL, including grants to roles other than the configured LOGINs. */
export async function assertExactApplicationAcl(
  client: PoolClient,
  namespaceOid: string,
  schema: string,
  loginRole: string,
  currentGroupRole: "ai_ark_m01_m02_writer" | "ai_ark_m04_runtime",
  peerLoginRole: string,
): Promise<void> {
  const manifest = await manifestPromise;
  const roleNames = {
    M01_M02_WRITER_GROUP: "ai_ark_m01_m02_writer",
    M04_RUNTIME_GROUP: "ai_ark_m04_runtime",
  } as const;
  const roles = (
    await client.query<{ name: string; oid: string }>(
      "SELECT rolname name,oid::text oid FROM pg_roles WHERE rolname=ANY($1::text[])",
      [Object.values(roleNames)],
    )
  ).rows;
  if (roles.length !== 2) fail();
  const expected = new Set<string>();
  for (const group of manifest.groups) {
    if (!(group.role in roleNames)) fail();
    const roleName = roleNames[group.role];
    const oid = roles.find((row) => row.name === roleName)?.oid;
    if (oid === undefined) throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    expected.add(cell("schema", schema, oid, "USAGE"));
    for (const relation of group.relations)
      for (const operation of relation.operations)
        expected.add(cell("relation", relation.name, oid, operation));
    for (const sequence of group.sequences)
      for (const operation of sequence.operations)
        expected.add(cell("sequence", sequence.name, oid, operation));
    for (const signature of group.functions)
      expected.add(cell("function", signature, oid, "EXECUTE"));
  }
  const rows = (
    await client.query<AclRow>(
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
    )
  ).rows;
  const ownership = (
    await client.query<{ owner_oid: string; database_owner_oid: string }>(
      `SELECT ledger.relowner::text owner_oid,db_owner.oid::text database_owner_oid
         FROM pg_class ledger JOIN pg_roles db_owner ON db_owner.rolname='pg_database_owner'
        WHERE ledger.relnamespace=$1::oid AND ledger.relname='schema_migrations'
          AND ledger.relkind='r'`,
      [namespaceOid],
    )
  ).rows;
  if (ownership.length !== 1) fail();
  const migrationOwner = ownership[0]?.owner_oid;
  const databaseOwner = ownership[0]?.database_owner_oid;
  const objectOwners = (
    await client.query<{ kind: "schema" | "object"; owner_oid: string }>(
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
    )
  ).rows;
  if (
    objectOwners.length === 0 ||
    objectOwners.some((row) =>
      row.kind === "schema"
        ? row.owner_oid !== migrationOwner && row.owner_oid !== databaseOwner
        : row.owner_oid !== migrationOwner,
    )
  )
    fail();
  for (const row of rows) {
    if (
      row.kind === "schema"
        ? row.owner_oid !== migrationOwner && row.owner_oid !== databaseOwner
        : row.owner_oid !== migrationOwner
    )
      fail();
    if (row.grantee_oid === row.owner_oid) continue;
    const key = cell(row.kind, row.name, row.grantee_oid, row.privilege);
    if (row.grantable || row.grantor_oid !== row.owner_oid || !expected.delete(key)) fail();
  }
  if (expected.size !== 0) fail();
  const columns = (
    await client.query<{ relation: string; column: string }>(
      `SELECT c.relname relation,a.attname column
         FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid,
              LATERAL aclexplode(a.attacl) acl
        WHERE c.relnamespace=$1::oid AND a.attnum>0 AND NOT a.attisdropped`,
      [namespaceOid],
    )
  ).rows;
  if (columns.length !== 0) fail();
  const loginGroups = new Map([
    [loginRole, currentGroupRole],
    [
      peerLoginRole,
      currentGroupRole === "ai_ark_m04_runtime" ? "ai_ark_m01_m02_writer" : "ai_ark_m04_runtime",
    ],
  ] as const);
  const loginAuthority = (
    await client.query<{
      login_name: string;
      role_name: string;
      can_login: boolean;
      is_superuser: boolean;
      bypass_rls: boolean;
      can_create_role: boolean;
      can_create_database: boolean;
      can_replicate: boolean;
      is_owner: boolean;
    }>(
      `WITH RECURSIVE reachable(login_name,oid) AS (
         SELECT rolname,oid FROM pg_roles WHERE rolname=ANY($2::text[])
         UNION
         SELECT prior.login_name,m.roleid FROM reachable prior
           JOIN pg_auth_members m ON m.member=prior.oid
          WHERE m.inherit_option OR m.set_option
       )
       SELECT reachable.login_name,r.rolname role_name,r.rolcanlogin can_login,
              r.rolsuper is_superuser,r.rolbypassrls bypass_rls,
              r.rolcreaterole can_create_role,r.rolcreatedb can_create_database,
              r.rolreplication can_replicate,r.oid=n.nspowner is_owner
         FROM reachable JOIN pg_roles r ON r.oid=reachable.oid
           CROSS JOIN pg_namespace n WHERE n.oid=$1::oid`,
      [namespaceOid, [loginRole, peerLoginRole]],
    )
  ).rows;
  if (
    loginRole === peerLoginRole ||
    loginAuthority.length !== 4 ||
    [...loginGroups].some(
      ([configuredLogin, expectedGroup]) =>
        loginAuthority.filter(({ login_name }) => login_name === configuredLogin).length !== 2 ||
        loginAuthority.some(
          (role) =>
            role.login_name === configuredLogin &&
            ![configuredLogin, expectedGroup].includes(role.role_name),
        ),
    ) ||
    loginAuthority.some(
      (role) =>
        role.can_login !== (role.role_name === role.login_name) ||
        role.is_superuser ||
        role.bypass_rls ||
        role.can_create_role ||
        role.can_create_database ||
        role.can_replicate ||
        role.is_owner,
    )
  )
    fail();
  const directOutbound = (
    await client.query<{
      login_name: string;
      role_name: string;
      inherit_option: boolean;
      set_option: boolean;
      admin_option: boolean;
    }>(
      `SELECT member.rolname login_name,parent.rolname role_name,
              membership.inherit_option,membership.set_option,membership.admin_option
         FROM pg_auth_members membership
         JOIN pg_roles member ON member.oid=membership.member
         JOIN pg_roles parent ON parent.oid=membership.roleid
        WHERE member.rolname=ANY($1::text[])`,
      [[loginRole, peerLoginRole]],
    )
  ).rows;
  if (
    directOutbound.length !== 2 ||
    [...loginGroups].some(
      ([configuredLogin, expectedGroup]) =>
        directOutbound.filter(
          (membership) =>
            membership.login_name === configuredLogin &&
            membership.role_name === expectedGroup &&
            membership.inherit_option &&
            !membership.admin_option,
        ).length !== 1,
    )
  )
    fail();
  const inbound = (
    await client.query<{
      group_name: string;
      member_name: string;
      login: boolean;
      inherit_option: boolean | null;
      admin_option: boolean | null;
    }>(
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
      [Object.values(roleNames)],
    )
  ).rows;
  if (
    inbound.length !== 2 ||
    Object.values(roleNames).some(
      (groupRole) => inbound.filter((row) => row.group_name === groupRole).length !== 1,
    ) ||
    inbound.some(
      (row) =>
        !row.login ||
        !row.inherit_option ||
        row.admin_option !== false ||
        row.member_name !== (row.group_name === currentGroupRole ? loginRole : peerLoginRole),
    )
  )
    fail();
}
