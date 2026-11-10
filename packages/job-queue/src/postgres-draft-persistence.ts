import { createHash, randomBytes } from "node:crypto";

import {
  AcceptedBindingSnapshotV1Schema,
  DraftRevisionV1Schema,
  GenerateDraftRequestV1Schema,
  GenerateDraftResultV1Schema,
  M05InputManifestV1Schema,
  M05PolicyArtifactsV1Schema,
  M05ProviderConfigV1Schema,
  canonicalJsonM03,
  decodeM04IdempotencyKeyFromDatabase,
  encodeM04IdempotencyKeyForDatabase,
  fingerprintM05,
  type AcceptedBindingSnapshotV1,
  type DraftRevisionV1,
  type GenerateDraftRequestV1,
  type M05PolicyArtifactsV1,
} from "@ai-ark/contracts";
import {
  m03LogicalProjection,
  projectEvidenceBinding,
  recomputeM03OutputFingerprint,
} from "@ai-ark/evidence";
import {
  assertM05FingerprintReuseBytesV1,
  validateDraftPersistenceCandidateV1,
} from "@ai-ark/draft-generation";
import type { Pool, PoolClient, QueryResultRow } from "pg";

const decoder = new TextDecoder("utf-8", { fatal: true });
const canonicalBytes = (value: unknown): Buffer => Buffer.from(canonicalJsonM03(value), "utf8");
const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
const equal = (left: unknown, right: unknown): boolean =>
  canonicalJsonM03(left) === canonicalJsonM03(right);
const CHUNK = 65_536;
const MAXIMUM = 268_435_456;
const assertActive = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new Error("M05_APPLICATION_DEADLINE");
};

function outputPreimage(revision: DraftRevisionV1): object {
  return {
    schemaVersion: "M05_OUTPUT_V1",
    label: revision.label,
    state: revision.state,
    sections: revision.sections,
    provenanceIndex: revision.provenanceIndex,
  };
}

function revisionIdPreimage(revision: DraftRevisionV1): object {
  return {
    schemaVersion: "M05_REVISION_ID_V1",
    generationFingerprint: revision.generationFingerprint,
    outputFingerprint: revision.outputFingerprint,
  };
}

function recordFingerprintPreimage(revision: DraftRevisionV1): object {
  return Object.fromEntries(
    Object.entries(revision).filter(([key]) => key !== "recordFingerprint"),
  );
}

function assertReusedRevisionIdentities(
  incumbent: DraftRevisionV1,
  candidate: DraftRevisionV1,
): void {
  if (incumbent.outputFingerprint === candidate.outputFingerprint)
    assertM05FingerprintReuseBytesV1(
      candidate.outputFingerprint,
      canonicalBytes(outputPreimage(incumbent)),
      canonicalBytes(outputPreimage(candidate)),
    );
  if (incumbent.revisionId === candidate.revisionId)
    assertM05FingerprintReuseBytesV1(
      candidate.revisionId.slice("drv_".length),
      canonicalBytes(revisionIdPreimage(incumbent)),
      canonicalBytes(revisionIdPreimage(candidate)),
    );
  if (incumbent.recordFingerprint === candidate.recordFingerprint)
    assertM05FingerprintReuseBytesV1(
      candidate.recordFingerprint,
      canonicalBytes(recordFingerprintPreimage(incumbent)),
      canonicalBytes(recordFingerprintPreimage(candidate)),
    );
}

function databaseErrorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function safeInternalCause(error: unknown): Error {
  return new Error(
    error instanceof Error && databaseErrorCode(error) !== undefined
      ? "M05_RETRYABLE_DATABASE_TRANSACTION"
      : "M05_INTERNAL_FAILURE",
  );
}

function throwSerializationRetryExhausted(error: unknown): never {
  throw new Error("M05_SERIALIZATION_RETRY_EXHAUSTED", {
    cause: safeInternalCause(error),
  });
}

function exactlyOne<T>(values: readonly T[]): T {
  const [value] = values;
  if (value === undefined || values.length !== 1)
    throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
  return value;
}

function assertSourceIntegrity(source: AcceptedBindingSnapshotV1): string {
  const projected = projectEvidenceBinding(source.bundle);
  const sourceRequest = source.semanticRequest;
  const bindingPreimage = {
    schemaVersion: "M04_BINDING_ID_V1",
    extractionId: source.bundle.extractionId,
    logicalPayloadSha256: fingerprintM05(m03LogicalProjection(source.bundle)),
    evidencePolicyVersion: sourceRequest.evidencePolicyVersion,
    materialFieldRegistryVersion: sourceRequest.materialFieldRegistryVersion,
    evidenceItemIds: projected.evidenceItems
      .map(({ id }) => id)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
    claimIds: projected.claims.map(({ id }) => id),
    linkIds: projected.links.map(({ id }) => id),
    completenessId: projected.completeness.id,
  };
  const bindingFingerprint = fingerprintM05(bindingPreimage);
  const acceptedCore = {
    kind: "ACCEPTED",
    bindingId: `bnd_${bindingFingerprint}`,
    extractionId: source.bundle.extractionId,
    completenessId: projected.completeness.id,
  };
  if (
    recomputeM03OutputFingerprint(source.bundle) !== source.bundle.outputFingerprint ||
    !equal(source.bindingPreimage, bindingPreimage) ||
    !equal(
      source.evidenceItems,
      [...projected.evidenceItems].sort((left, right) =>
        Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
      ),
    ) ||
    !equal(source.claims, projected.claims) ||
    !equal(source.links, projected.links) ||
    !equal(source.completeness, projected.completeness) ||
    !equal(source.acceptedResultRecord, {
      schemaVersion: "M04_RESULT_V1",
      resultId: `m4r_${fingerprintM05(acceptedCore)}`,
      ...acceptedCore,
    }) ||
    sourceRequest.extractionId !== source.bundle.extractionId ||
    sourceRequest.expectedM03OutputFingerprint !== source.bundle.outputFingerprint ||
    sourceRequest.expectedResourceIdentityId !== source.bundle.m02.resourceIdentityId ||
    sourceRequest.expectedResourceVersionIdentityId !==
      source.bundle.m02.resourceVersionIdentityId ||
    sourceRequest.expectedSourceSnapshotId !== source.bundle.m02.sourceSnapshotId ||
    sourceRequest.expectedSourceRevision !== source.bundle.m02.sourceRevision ||
    !equal(sourceRequest.expectedPredecessorState, source.bundle.expectedPredecessorState)
  )
    throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
  return bindingFingerprint;
}

export interface PostgresDraftPersistenceOptionsV1 {
  readonly loginRole: string;
  readonly migrationOwnerRole: string;
  readonly migrationOwnerOid: string;
  readonly predecessorLoginRoles: readonly [string, string];
  readonly schema?: "ai_ark_m05";
  readonly predecessorSchema?: string;
  readonly trustedProviderConfigs?: readonly NonNullable<
    M05PolicyArtifactsV1["providerConfigOrNull"]
  >[];
}

interface Candidate {
  readonly request: GenerateDraftRequestV1;
  readonly requestFingerprint: string;
  readonly semanticRequestFingerprint: string;
  readonly source: AcceptedBindingSnapshotV1;
  readonly policy: M05PolicyArtifactsV1;
  readonly sourceFingerprint: string;
  readonly policyFingerprint: string;
  readonly inputFingerprint: string;
  readonly generationFingerprint: string;
  readonly revision: DraftRevisionV1;
}

interface StoredRow extends QueryResultRow {
  encoded_key: string;
  request_fingerprint: string;
  semantic_request_fingerprint: string;
  canonical_request: Buffer;
  request_generation_fingerprint: string;
  request_revision_id: string;
  canonical_result: Buffer;
  result_sha256: string;
  revision_id: string;
  generation_fingerprint: string;
  input_fingerprint: string;
  output_fingerprint: string;
  record_fingerprint: string;
  revision_payload: Buffer;
  source_fingerprint: string;
  policy_fingerprint: string;
  binding_id: string;
  extraction_id: string;
  byte_length: string;
  chunk_count: number;
  canonical_manifest: Buffer;
  manifest_sha256: string;
  chunk_payloads: Buffer[];
  stored_chunk_hashes: string[];
  stored_chunk_ordinals: number[];
}

interface StoredRequestRow extends QueryResultRow {
  encoded_key: string;
  request_fingerprint: string;
  semantic_request_fingerprint: string;
  canonical_request: Buffer;
  request_generation_fingerprint: string;
  request_revision_id: string;
  canonical_result: Buffer;
  result_sha256: string;
}

export class PostgresDraftPersistenceAdapterV1 {
  readonly #schemaSql = '"ai_ark_m05"';
  readonly #prefix = randomBytes(8).toString("hex");
  #sequence = 0;
  #catalogIdentity: string | undefined;

  private constructor(
    private readonly pool: Pool,
    private readonly options: PostgresDraftPersistenceOptionsV1,
  ) {}

  public static async open(
    pool: Pool,
    options: PostgresDraftPersistenceOptionsV1,
  ): Promise<PostgresDraftPersistenceAdapterV1> {
    const runtimeSchema: unknown = options.schema;
    if (runtimeSchema !== undefined && runtimeSchema !== "ai_ark_m05")
      throw new Error("M05_DATABASE_SCHEMA_INVALID");
    if (!/^[a-z][a-z0-9_]{0,62}$/u.test(options.loginRole))
      throw new Error("M05_DATABASE_ROLE_INVALID");
    if (
      !/^[A-Za-z_][A-Za-z0-9_$]{0,62}$/u.test(options.migrationOwnerRole) ||
      !/^[1-9][0-9]*$/u.test(options.migrationOwnerOid)
    )
      throw new Error("M05_DATABASE_MIGRATION_OWNER_INVALID");
    if (
      options.predecessorSchema !== undefined &&
      !/^[a-z][a-z0-9_]{0,62}$/u.test(options.predecessorSchema)
    )
      throw new Error("M05_DATABASE_PREDECESSOR_SCHEMA_INVALID");
    if (
      new Set(options.predecessorLoginRoles).size !== 2 ||
      options.predecessorLoginRoles.includes(options.loginRole) ||
      options.predecessorLoginRoles.some((role) => !/^[a-z][a-z0-9_]{0,62}$/u.test(role))
    )
      throw new Error("M05_DATABASE_PREDECESSOR_ROLE_INVALID");
    const trustedProviderConfigs = (options.trustedProviderConfigs ?? []).map((config) =>
      Object.freeze(M05ProviderConfigV1Schema.parse(structuredClone(config))),
    );
    if (
      new Set(trustedProviderConfigs.map(({ providerConfigId }) => providerConfigId)).size !==
      trustedProviderConfigs.length
    )
      throw new Error("M05_AUTHORITY_INVALID");
    const [firstPredecessorRole, secondPredecessorRole] = options.predecessorLoginRoles;
    const predecessorLoginRoles: readonly [string, string] = [
      firstPredecessorRole,
      secondPredecessorRole,
    ];
    const normalizedOptions = Object.freeze({
      ...options,
      predecessorLoginRoles: Object.freeze(predecessorLoginRoles),
      trustedProviderConfigs: Object.freeze(trustedProviderConfigs),
    });
    const adapter = new PostgresDraftPersistenceAdapterV1(pool, normalizedOptions);
    const client = await pool.connect();
    try {
      await adapter.assertAuthority(client);
    } finally {
      client.release();
    }
    return adapter;
  }

  private async assertAuthority(client: PoolClient): Promise<void> {
    const session = (
      await client.query<{
        session_user: string;
        current_user: string;
        usage: boolean;
        create_privilege: boolean;
      }>(
        `SELECT session_user,current_user,has_schema_privilege(current_user,'ai_ark_m05','USAGE') usage,has_schema_privilege(current_user,'ai_ark_m05','CREATE') create_privilege`,
      )
    ).rows[0];
    if (
      session?.session_user !== this.options.loginRole ||
      session.current_user !== this.options.loginRole ||
      !session.usage ||
      session.create_privilege
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const roles = await client.query<{
      oid: string;
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolreplication: boolean;
    }>(
      `SELECT oid::text,rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
      [["ai_ark_m05_writer", this.options.loginRole]],
    );
    if (
      roles.rowCount !== 2 ||
      roles.rows.some(
        (role) =>
          role.rolsuper ||
          role.rolbypassrls ||
          role.rolcreaterole ||
          role.rolcreatedb ||
          role.rolreplication ||
          role.rolcanlogin !== (role.rolname === this.options.loginRole),
      )
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const predecessorRoles = await client.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolreplication: boolean;
    }>(
      `SELECT rolname,rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolreplication FROM pg_roles WHERE rolname=ANY($1::text[]) ORDER BY rolname`,
      [[...this.options.predecessorLoginRoles]],
    );
    if (
      predecessorRoles.rowCount !== 2 ||
      predecessorRoles.rows.some(
        (role) =>
          !role.rolcanlogin ||
          role.rolsuper ||
          role.rolbypassrls ||
          role.rolcreaterole ||
          role.rolcreatedb ||
          role.rolreplication,
      )
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const migrationOwner = (
      await client.query<{ oid: string; rolname: string }>(
        `SELECT oid::text,rolname FROM pg_roles WHERE rolname=$1 AND oid=$2::oid`,
        [this.options.migrationOwnerRole, this.options.migrationOwnerOid],
      )
    ).rows[0];
    if (
      migrationOwner?.rolname !== this.options.migrationOwnerRole ||
      migrationOwner.oid !== this.options.migrationOwnerOid
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const membership = await client.query<{
      parent_name: string;
      member_name: string;
      inherit_option: boolean;
      admin_option: boolean;
    }>(
      `SELECT parent.rolname parent_name,member.rolname member_name,m.inherit_option,m.admin_option FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE member.rolname=$1`,
      [this.options.loginRole],
    );
    if (
      membership.rowCount !== 1 ||
      membership.rows[0]?.parent_name !== "ai_ark_m05_writer" ||
      !membership.rows[0].inherit_option ||
      membership.rows[0].admin_option
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const relevantMembership = await client.query<{
      parent_name: string;
      member_name: string;
      inherit_option: boolean;
      set_option: boolean;
      admin_option: boolean;
    }>(
      `SELECT parent.rolname parent_name,member.rolname member_name,m.inherit_option,m.set_option,m.admin_option
         FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
        WHERE parent.rolname=ANY($1::text[]) OR member.rolname=ANY($1::text[])
        ORDER BY parent.rolname,member.rolname`,
      [["ai_ark_m05_writer", this.options.loginRole]],
    );
    if (
      relevantMembership.rowCount !== 1 ||
      !equal(relevantMembership.rows[0], {
        parent_name: "ai_ark_m05_writer",
        member_name: this.options.loginRole,
        inherit_option: true,
        set_option: true,
        admin_option: false,
      })
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const inboundClosure = await client.query<{ rolname: string }>(
      `WITH RECURSIVE inheritors(oid) AS (
         SELECT oid FROM pg_roles WHERE rolname='ai_ark_m05_writer'
         UNION SELECT m.member FROM pg_auth_members m JOIN inheritors prior ON prior.oid=m.roleid
          WHERE m.inherit_option OR m.set_option
       ) SELECT rolname FROM inheritors JOIN pg_roles USING(oid) ORDER BY rolname`,
    );
    if (
      inboundClosure.rows.map(({ rolname }) => rolname).join(",") !==
      ["ai_ark_m05_writer", this.options.loginRole].sort().join(",")
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const predecessorSchema = this.options.predecessorSchema ?? "public";
    const predecessorAuthority = (
      await client.query<{
        schema_exists: boolean;
        usage: boolean;
        create_privilege: boolean;
        relation_privilege_count: string;
        function_privilege_count: string;
      }>(
        `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) schema_exists,
                has_schema_privilege(current_user,$1,'USAGE') usage,
                has_schema_privilege(current_user,$1,'CREATE') create_privilege,
                (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                  WHERE n.nspname=$1 AND (has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') OR has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))) relation_privilege_count,
                (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname=$1 AND has_function_privilege(current_user,p.oid,'EXECUTE')
                    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) function_privilege_count`,
        [predecessorSchema],
      )
    ).rows[0];
    if (
      predecessorAuthority === undefined ||
      !predecessorAuthority.schema_exists ||
      predecessorAuthority.usage ||
      predecessorAuthority.create_privilege ||
      predecessorAuthority.relation_privilege_count !== "0" ||
      predecessorAuthority.function_privilege_count !== "0"
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const acl = await client.query<{
      relname: string;
      s: boolean;
      i: boolean;
      u: boolean;
      d: boolean;
      t: boolean;
      r: boolean;
      g: boolean;
    }>(
      `SELECT c.relname,has_table_privilege(current_user,c.oid,'SELECT') s,has_table_privilege(current_user,c.oid,'INSERT') i,has_table_privilege(current_user,c.oid,'UPDATE') u,has_table_privilege(current_user,c.oid,'DELETE') d,has_table_privilege(current_user,c.oid,'TRUNCATE') t,has_table_privilege(current_user,c.oid,'REFERENCES') r,has_table_privilege(current_user,c.oid,'TRIGGER') g FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ai_ark_m05' AND c.relkind='r' ORDER BY c.relname`,
    );
    if (
      acl.rows.map(({ relname }) => relname).join(",") !==
        "input_chunks,inputs,requests,revisions" ||
      acl.rows.some((row) => !row.s || !row.i || row.u || row.d || row.t || row.r || row.g)
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const closure = await client.query<{ rolname: string; elevated: boolean }>(
      `WITH RECURSIVE reachable(oid) AS (
         SELECT oid FROM pg_roles WHERE rolname=$1
         UNION SELECT m.roleid FROM pg_auth_members m JOIN reachable prior ON prior.oid=m.member
          WHERE m.inherit_option OR m.set_option
       ) SELECT r.rolname,(r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication) elevated
           FROM reachable JOIN pg_roles r USING(oid) ORDER BY r.rolname`,
      [this.options.loginRole],
    );
    if (
      closure.rows.map(({ rolname }) => rolname).join(",") !==
        ["ai_ark_m05_writer", this.options.loginRole].sort().join(",") ||
      closure.rows.some(({ elevated }) => elevated)
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const inventory = await client.query<{
      schema_oid: string;
      schema_owner: string;
      schema_acl: string;
      relations: unknown;
      classes: unknown;
      columns: unknown;
      indexes: unknown;
      row_security: unknown;
      policy_count: string;
      functions: unknown;
      triggers: unknown;
      nonowner_acl: unknown;
      nonowner_schema_acl: unknown;
      nonowner_function_acl: unknown;
      constraint_hash: string;
      column_acl_count: string;
      default_acl_count: string;
    }>(`SELECT n.oid::text schema_oid,n.nspowner::text schema_owner,coalesce(n.nspacl::text,'') schema_acl,
        (SELECT jsonb_agg(jsonb_build_array(c.relname,c.oid::text,c.relowner::text,coalesce(c.relacl::text,'')) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace=n.oid AND c.relkind='r') relations,
        (SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,c.relowner::text) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace=n.oid) classes,
        (SELECT jsonb_agg(jsonb_build_array(c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,coll.collname,coalesce(pg_get_expr(ad.adbin,ad.adrelid),''),a.attidentity,a.attgenerated) ORDER BY c.relname,a.attnum)
           FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid LEFT JOIN pg_collation coll ON coll.oid=a.attcollation LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
          WHERE c.relnamespace=n.oid AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped) columns,
        (SELECT jsonb_agg(jsonb_build_array(ic.relname,tc.relname,i.indisunique,i.indisprimary,i.indisvalid,i.indisready,i.indislive,
                  (SELECT jsonb_agg(a.attname ORDER BY key.ordinality) FROM unnest(i.indkey) WITH ORDINALITY key(attnum,ordinality) LEFT JOIN pg_attribute a ON a.attrelid=tc.oid AND a.attnum=key.attnum),
                  (SELECT jsonb_agg(coll.collname ORDER BY key.ordinality) FROM unnest(i.indcollation) WITH ORDINALITY key(oid,ordinality) LEFT JOIN pg_collation coll ON coll.oid=key.oid),
                  coalesce(pg_get_expr(i.indpred,i.indrelid),''),coalesce(pg_get_expr(i.indexprs,i.indrelid),'')) ORDER BY ic.relname)
           FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_class tc ON tc.oid=i.indrelid WHERE ic.relnamespace=n.oid) indexes,
        (SELECT jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname) FROM pg_class c WHERE c.relnamespace=n.oid AND c.relkind='r') row_security,
        (SELECT count(*)::text FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace=n.oid) policy_count,
        (SELECT jsonb_agg(jsonb_build_array(p.proname,p.oid::text,p.proowner::text,p.prosecdef,coalesce(array_to_string(p.proconfig,','),''),pg_get_functiondef(p.oid),coalesce(p.proacl::text,''),encode(pg_catalog.sha256(convert_to(p.prosrc,'UTF8')),'hex'),l.lanname,p.provolatile,p.proparallel,p.proleakproof) ORDER BY p.proname) FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=n.oid) functions,
        (SELECT jsonb_agg(jsonb_build_array(t.tgname,t.oid::text,c.relname,p.proname,t.tgenabled,t.tgdeferrable,t.tginitdeferred,pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid WHERE c.relnamespace=n.oid AND NOT t.tgisinternal) triggers,
        (SELECT jsonb_agg(jsonb_build_array(c.relname,coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY c.relname,coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE c.relnamespace=n.oid AND a.grantee<>c.relowner) nonowner_acl,
        (SELECT jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE a.grantee<>n.nspowner) nonowner_schema_acl,
        (SELECT jsonb_agg(jsonb_build_array(p.proname,coalesce(r.rolname,'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY p.proname,coalesce(r.rolname,'PUBLIC'),a.privilege_type) FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE p.pronamespace=n.oid AND a.grantee<>p.proowner) nonowner_function_acl,
        (SELECT encode(pg_catalog.sha256(convert_to(jsonb_agg(jsonb_build_array(c.relname,con.conname,con.contype,pg_get_constraintdef(con.oid,true),con.convalidated,con.condeferrable,con.condeferred) ORDER BY c.relname,con.conname)::text,'UTF8')),'hex') FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid WHERE c.relnamespace=n.oid) constraint_hash,
        (SELECT count(*)::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace=n.oid AND a.attnum>0 AND NOT a.attisdropped AND a.attacl IS NOT NULL) column_acl_count,
        (SELECT count(*)::text FROM pg_default_acl d WHERE d.defaclrole=n.nspowner AND d.defaclnamespace IN (0,n.oid)) default_acl_count
       FROM pg_namespace n WHERE n.nspname='ai_ark_m05'`);
    const current = inventory.rows[0];
    if (
      current?.schema_owner !== this.options.migrationOwnerOid ||
      current.column_acl_count !== "0" ||
      current.default_acl_count !== "0"
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const relations = current.relations as unknown[] | null;
    const functions = current.functions as unknown[] | null;
    const triggers = current.triggers as unknown[] | null;
    const classes = current.classes as unknown[] | null;
    const columns = current.columns as unknown[] | null;
    const indexes = current.indexes as unknown[] | null;
    const rowSecurity = current.row_security as unknown[] | null;
    const grants = current.nonowner_acl as unknown[] | null;
    const schemaGrants = current.nonowner_schema_acl as unknown[] | null;
    const functionGrants = current.nonowner_function_acl as unknown[] | null;
    const expectedRelations = ["input_chunks", "inputs", "requests", "revisions"];
    const expectedClasses = [
      ["input_chunks", "r"],
      ["input_chunks_pkey", "i"],
      ["inputs", "r"],
      ["inputs_pkey", "i"],
      ["requests", "r"],
      ["requests_pkey", "i"],
      ["requests_semantic_request_fingerprint_idx", "i"],
      ["revisions", "r"],
      ["revisions_generation_fingerprint_key", "i"],
      ["revisions_generation_fingerprint_revision_id_key", "i"],
      ["revisions_pkey", "i"],
      ["revisions_record_fingerprint_key", "i"],
    ];
    const expectedColumnDefinitions: Readonly<
      Record<string, readonly (readonly [string, string, string | null])[]>
    > = {
      input_chunks: [
        ["input_fingerprint", "text", "C"],
        ["ordinal", "integer", null],
        ["payload", "bytea", null],
        ["payload_sha256", "text", "C"],
      ],
      inputs: [
        ["input_fingerprint", "text", "C"],
        ["source_fingerprint", "text", "C"],
        ["policy_fingerprint", "text", "C"],
        ["binding_id", "text", "C"],
        ["extraction_id", "text", "C"],
        ["byte_length", "bigint", null],
        ["chunk_count", "integer", null],
        ["canonical_manifest", "bytea", null],
        ["manifest_sha256", "text", "C"],
      ],
      requests: [
        ["encoded_key", "text", "C"],
        ["request_fingerprint", "text", "C"],
        ["semantic_request_fingerprint", "text", "C"],
        ["canonical_request", "bytea", null],
        ["generation_fingerprint", "text", "C"],
        ["revision_id", "text", "C"],
        ["canonical_result", "bytea", null],
        ["result_sha256", "text", "C"],
      ],
      revisions: [
        ["revision_id", "text", "C"],
        ["generation_fingerprint", "text", "C"],
        ["input_fingerprint", "text", "C"],
        ["output_fingerprint", "text", "C"],
        ["record_fingerprint", "text", "C"],
        ["canonical_payload", "bytea", null],
      ],
    };
    const expectedColumns = Object.entries(expectedColumnDefinitions).flatMap(
      ([relation, definitions]) =>
        definitions.map(([name, type, collation], index) => [
          relation,
          index + 1,
          name,
          type,
          collation,
        ]),
    );
    const expectedIndexes = [
      [
        "input_chunks_pkey",
        "input_chunks",
        true,
        true,
        ["input_fingerprint", "ordinal"],
        ["C", null],
      ],
      ["inputs_pkey", "inputs", true, true, ["input_fingerprint"], ["C"]],
      ["requests_pkey", "requests", true, true, ["encoded_key"], ["C"]],
      [
        "requests_semantic_request_fingerprint_idx",
        "requests",
        false,
        false,
        ["semantic_request_fingerprint"],
        ["C"],
      ],
      [
        "revisions_generation_fingerprint_key",
        "revisions",
        true,
        false,
        ["generation_fingerprint"],
        ["C"],
      ],
      [
        "revisions_generation_fingerprint_revision_id_key",
        "revisions",
        true,
        false,
        ["generation_fingerprint", "revision_id"],
        ["C", "C"],
      ],
      ["revisions_pkey", "revisions", true, true, ["revision_id"], ["C"]],
      ["revisions_record_fingerprint_key", "revisions", true, false, ["record_fingerprint"], ["C"]],
    ];
    const expectedFunctions = [
      "m05_reject_immutable_mutation",
      "m05_validate_input_chunk",
      "m05_validate_input_closure",
      "m05_validate_request_closure",
      "m05_validate_revision_closure",
    ];
    const expectedFunctionSourceHashes: Readonly<Record<string, string>> = {
      m05_reject_immutable_mutation:
        "7d823e8b5cc5df63754e72aee2cbb2d577973ac4a3e150e85c42b06c4dc5b00e",
      m05_validate_input_chunk: "1b542e6cabf06ff17b5b7169009c9681a3ed321848f4abb91b1dd17d6919db03",
      m05_validate_input_closure:
        "bc5e20b782bb0bde8ac0cc4d2562bfff3efbcb8a0ce03dfbeb37746c37834820",
      m05_validate_revision_closure:
        "cdf7db8f86b13f40708d74d632b5c50085c717ed0948b290c77edb85d894cbb0",
      m05_validate_request_closure:
        "5e9f509217856302ff7ba32b708d59726a5b4fefc4bfbc106343c3ad0fe7a749",
    };
    const expectedTriggers = [
      "input_chunks_immutable",
      "input_chunks_validate",
      "inputs_closure",
      "inputs_immutable",
      "requests_closure",
      "requests_immutable",
      "revisions_closure",
      "revisions_immutable",
    ];
    if (
      relations?.length !== 4 ||
      relations.map((entry) => (entry as [string])[0]).join(",") !== expectedRelations.join(",") ||
      relations.some(
        (entry) => (entry as [string, string, string])[2] !== this.options.migrationOwnerOid,
      ) ||
      !equal(
        classes?.map((entry) => {
          const row = entry as [string, string, string];
          return [row[0], row[1]];
        }),
        expectedClasses,
      ) ||
      classes?.some(
        (entry) => (entry as [string, string, string])[2] !== this.options.migrationOwnerOid,
      ) ||
      !equal(
        columns?.map((entry) => {
          const row = entry as [
            string,
            number,
            string,
            string,
            boolean,
            string | null,
            string,
            string,
            string,
          ];
          return [row[0], row[1], row[2], row[3], row[5]];
        }),
        expectedColumns,
      ) ||
      columns?.some((entry) => {
        const row = entry as [
          string,
          number,
          string,
          string,
          boolean,
          string | null,
          string,
          string,
          string,
        ];
        return !row[4] || row[6] !== "" || row[7] !== "" || row[8] !== "";
      }) ||
      !equal(
        indexes?.map((entry) => {
          const row = entry as [
            string,
            string,
            boolean,
            boolean,
            boolean,
            boolean,
            boolean,
            string[],
            (string | null)[],
            string,
            string,
          ];
          return [row[0], row[1], row[2], row[3], row[7], row[8]];
        }),
        expectedIndexes,
      ) ||
      indexes?.some((entry) => {
        const row = entry as [
          string,
          string,
          boolean,
          boolean,
          boolean,
          boolean,
          boolean,
          string[],
          (string | null)[],
          string,
          string,
        ];
        return !row[4] || !row[5] || !row[6] || row[9] !== "" || row[10] !== "";
      }) ||
      !equal(
        rowSecurity,
        expectedRelations.map((relation) => [relation, false, false]),
      ) ||
      current.policy_count !== "0" ||
      functions?.length !== 5 ||
      functions.map((entry) => (entry as [string])[0]).join(",") !== expectedFunctions.join(",") ||
      functions.some((entry) => {
        const row = entry as [
          string,
          string,
          string,
          boolean,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          boolean,
        ];
        return (
          row[2] !== this.options.migrationOwnerOid ||
          row[3] ||
          row[4] !== "search_path=pg_catalog" ||
          row[7] !== expectedFunctionSourceHashes[row[0]] ||
          row[8] !== "plpgsql" ||
          row[9] !== "v" ||
          row[10] !== "u" ||
          row[11]
        );
      }) ||
      triggers?.length !== 8 ||
      triggers.map((entry) => (entry as [string])[0]).join(",") !== expectedTriggers.join(",") ||
      triggers.some((entry) => {
        const row = entry as [string, string, string, string, string, boolean, boolean, string];
        const expectedRelation = row[0].startsWith("input_chunks")
          ? "input_chunks"
          : row[0].startsWith("inputs")
            ? "inputs"
            : row[0].startsWith("requests")
              ? "requests"
              : "revisions";
        const expectedFunction = row[0].endsWith("immutable")
          ? "m05_reject_immutable_mutation"
          : row[0] === "input_chunks_validate"
            ? "m05_validate_input_chunk"
            : row[0] === "inputs_closure"
              ? "m05_validate_input_closure"
              : row[0] === "revisions_closure"
                ? "m05_validate_revision_closure"
                : "m05_validate_request_closure";
        const closureTrigger = row[0].endsWith("closure");
        return (
          row[2] !== expectedRelation ||
          row[3] !== expectedFunction ||
          row[4] !== "O" ||
          row[5] !== closureTrigger ||
          row[6] !== closureTrigger
        );
      }) ||
      current.constraint_hash !==
        "1423c0b91d239086d507b0237b80afed742d0c11c4e1ef45c06e0f7904a6b6a9" ||
      grants?.length !== 8 ||
      grants.some((entry) => {
        const row = entry as [string, string, string, boolean];
        return row[1] !== "ai_ark_m05_writer" || !["INSERT", "SELECT"].includes(row[2]) || row[3];
      }) ||
      schemaGrants?.length !== 1 ||
      !equal(schemaGrants[0], ["ai_ark_m05_writer", "USAGE", false]) ||
      functionGrants !== null
    )
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    const identity = canonicalJsonM03(current);
    if (this.#catalogIdentity !== undefined && this.#catalogIdentity !== identity)
      throw new Error("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
    this.#catalogIdentity ??= identity;
  }

  private async query<T extends QueryResultRow>(
    client: PoolClient,
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<readonly T[]> {
    this.#sequence += 1;
    const result = await client.query<T>({
      name: `ai_ark_m05_${this.#prefix}_${this.#sequence.toString(16)}_${fingerprintM05(sql).slice(0, 16)}`,
      text: sql,
      values: [...values],
    });
    return result.rows;
  }

  private async requestKeys(
    client: PoolClient,
    predicate: string,
    values: readonly unknown[],
  ): Promise<readonly string[]> {
    const rows = await this.query<{ encoded_key: string }>(
      client,
      `SELECT q.encoded_key FROM ${this.#schemaSql}.requests q JOIN ${this.#schemaSql}.revisions r ON r.revision_id=q.revision_id AND r.generation_fingerprint=q.generation_fingerprint JOIN ${this.#schemaSql}.inputs i ON i.input_fingerprint=r.input_fingerprint WHERE ${predicate} ORDER BY q.encoded_key COLLATE pg_catalog."C"`,
      values,
    );
    return rows.map(({ encoded_key }) => encoded_key);
  }

  private async revisionRepresentativeKeys(
    client: PoolClient,
    predicate: string,
    values: readonly unknown[],
  ): Promise<readonly string[]> {
    const rows = await this.query<{ encoded_key: string }>(
      client,
      `SELECT min(q.encoded_key COLLATE pg_catalog."C") encoded_key FROM ${this.#schemaSql}.requests q JOIN ${this.#schemaSql}.revisions r ON r.revision_id=q.revision_id AND r.generation_fingerprint=q.generation_fingerprint WHERE ${predicate} GROUP BY r.revision_id ORDER BY min(q.encoded_key COLLATE pg_catalog."C")`,
      values,
    );
    return rows.map(({ encoded_key }) => encoded_key);
  }

  private async rowByKey(client: PoolClient, encodedKey: string): Promise<StoredRow> {
    const rows = await this.query<StoredRow>(
      client,
      `SELECT q.encoded_key,q.request_fingerprint,q.semantic_request_fingerprint,q.canonical_request,q.generation_fingerprint request_generation_fingerprint,q.revision_id request_revision_id,q.canonical_result,q.result_sha256,r.revision_id,r.generation_fingerprint,r.input_fingerprint,r.output_fingerprint,r.record_fingerprint,r.canonical_payload revision_payload,i.source_fingerprint,i.policy_fingerprint,i.binding_id,i.extraction_id,i.byte_length,i.chunk_count,i.canonical_manifest,i.manifest_sha256,array_agg(c.payload ORDER BY c.ordinal) chunk_payloads,array_agg(c.payload_sha256 ORDER BY c.ordinal) stored_chunk_hashes,array_agg(c.ordinal ORDER BY c.ordinal) stored_chunk_ordinals FROM ${this.#schemaSql}.requests q JOIN ${this.#schemaSql}.revisions r ON r.revision_id=q.revision_id AND r.generation_fingerprint=q.generation_fingerprint JOIN ${this.#schemaSql}.inputs i ON i.input_fingerprint=r.input_fingerprint JOIN ${this.#schemaSql}.input_chunks c ON c.input_fingerprint=i.input_fingerprint WHERE q.encoded_key=$1 GROUP BY q.encoded_key,r.revision_id,i.input_fingerprint`,
      [encodedKey],
    );
    if (rows.length !== 1) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    return exactlyOne(rows);
  }

  private async requestRowByKey(client: PoolClient, encodedKey: string): Promise<StoredRequestRow> {
    const rows = await this.query<StoredRequestRow>(
      client,
      `SELECT encoded_key,request_fingerprint,semantic_request_fingerprint,canonical_request,generation_fingerprint request_generation_fingerprint,revision_id request_revision_id,canonical_result,result_sha256 FROM ${this.#schemaSql}.requests WHERE encoded_key=$1`,
      [encodedKey],
    );
    if (rows.length !== 1) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    return exactlyOne(rows);
  }

  private validateRequestRow(
    row: StoredRequestRow,
    revision: DraftRevisionV1,
  ): GenerateDraftRequestV1 {
    let requestValue: unknown;
    let resultValue: unknown;
    try {
      requestValue = JSON.parse(decoder.decode(row.canonical_request));
      resultValue = JSON.parse(decoder.decode(row.canonical_result));
    } catch {
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    }
    const request = GenerateDraftRequestV1Schema.parse(requestValue);
    const result = GenerateDraftResultV1Schema.parse(resultValue);
    if (
      result.kind !== "ACCEPTED" ||
      result.replayed ||
      result.revisionId !== revision.revisionId ||
      result.inputFingerprint !== revision.inputFingerprint ||
      result.outputFingerprint !== revision.outputFingerprint ||
      result.recordFingerprint !== revision.recordFingerprint ||
      canonicalJsonM03(request) !== decoder.decode(row.canonical_request) ||
      canonicalJsonM03(result) !== decoder.decode(row.canonical_result) ||
      encodeM04IdempotencyKeyForDatabase(request.idempotencyKey) !== row.encoded_key ||
      decodeM04IdempotencyKeyFromDatabase(row.encoded_key) !== request.idempotencyKey ||
      sha256(row.canonical_request) !== row.request_fingerprint ||
      sha256(row.canonical_result) !== row.result_sha256 ||
      fingerprintM05(
        Object.fromEntries(Object.entries(request).filter(([key]) => key !== "idempotencyKey")),
      ) !== row.semantic_request_fingerprint ||
      row.request_generation_fingerprint !== revision.generationFingerprint ||
      row.request_revision_id !== revision.revisionId
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    return request;
  }

  private async count(
    client: PoolClient,
    relation: "requests" | "revisions",
    predicate: string,
    values: readonly unknown[],
  ): Promise<number> {
    const rows = await this.query<{ count: string }>(
      client,
      `SELECT count(*)::text count FROM ${this.#schemaSql}.${relation} WHERE ${predicate}`,
      values,
    );
    return Number(rows[0]?.count ?? "0");
  }

  private validate(row: StoredRow): {
    request: GenerateDraftRequestV1;
    revision: DraftRevisionV1;
    source: AcceptedBindingSnapshotV1;
    policy: M05PolicyArtifactsV1;
  } {
    const inputPayload = Buffer.concat(row.chunk_payloads);
    if (
      row.chunk_payloads.length !== row.chunk_count ||
      row.stored_chunk_hashes.length !== row.chunk_count ||
      row.stored_chunk_ordinals.length !== row.chunk_count ||
      row.stored_chunk_ordinals.some((ordinal, index) => ordinal !== index) ||
      row.chunk_payloads.some(
        (chunk, index) =>
          sha256(chunk) !== row.stored_chunk_hashes[index] ||
          chunk.byteLength < 1 ||
          chunk.byteLength > CHUNK ||
          (index < row.chunk_count - 1 && chunk.byteLength !== CHUNK),
      ) ||
      Number(row.byte_length) !== inputPayload.byteLength ||
      row.chunk_count !== Math.ceil(inputPayload.byteLength / CHUNK) ||
      sha256(row.canonical_manifest) !== row.manifest_sha256
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    let requestValue: unknown;
    let revisionValue: unknown;
    let inputValue: unknown;
    let resultValue: unknown;
    let manifest: unknown;
    try {
      requestValue = JSON.parse(decoder.decode(row.canonical_request));
      revisionValue = JSON.parse(decoder.decode(row.revision_payload));
      inputValue = JSON.parse(decoder.decode(inputPayload));
      resultValue = JSON.parse(decoder.decode(row.canonical_result));
      manifest = JSON.parse(decoder.decode(row.canonical_manifest));
    } catch {
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    }
    const request = GenerateDraftRequestV1Schema.parse(requestValue);
    const revision = DraftRevisionV1Schema.parse(revisionValue);
    const result = GenerateDraftResultV1Schema.parse(resultValue);
    if (
      result.kind !== "ACCEPTED" ||
      result.replayed ||
      canonicalJsonM03(request) !== decoder.decode(row.canonical_request) ||
      canonicalJsonM03(revision) !== decoder.decode(row.revision_payload) ||
      canonicalJsonM03(result) !== decoder.decode(row.canonical_result) ||
      encodeM04IdempotencyKeyForDatabase(request.idempotencyKey) !== row.encoded_key ||
      decodeM04IdempotencyKeyFromDatabase(row.encoded_key) !== request.idempotencyKey ||
      sha256(row.canonical_request) !== row.request_fingerprint ||
      sha256(row.canonical_result) !== row.result_sha256 ||
      fingerprintM05(
        Object.fromEntries(Object.entries(request).filter(([key]) => key !== "idempotencyKey")),
      ) !== row.semantic_request_fingerprint ||
      row.request_generation_fingerprint !== revision.generationFingerprint ||
      row.request_revision_id !== revision.revisionId ||
      row.generation_fingerprint !== revision.generationFingerprint ||
      row.input_fingerprint !== revision.inputFingerprint ||
      row.output_fingerprint !== revision.outputFingerprint ||
      row.record_fingerprint !== revision.recordFingerprint ||
      fingerprintM05(
        Object.fromEntries(Object.entries(revision).filter(([key]) => key !== "recordFingerprint")),
      ) !== revision.recordFingerprint
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    if (
      inputValue === null ||
      typeof inputValue !== "object" ||
      Array.isArray(inputValue) ||
      Object.keys(inputValue).sort().join(",") !== "policy,schemaVersion,source" ||
      (inputValue as { schemaVersion?: unknown }).schemaVersion !== "M05_PERSISTED_INPUT_V1"
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    const input = inputValue as { source: unknown; policy: unknown };
    const source = AcceptedBindingSnapshotV1Schema.parse(input.source);
    const policy = M05PolicyArtifactsV1Schema.parse(input.policy);
    const bindingFingerprint = assertSourceIntegrity(source);
    const expectedPolicyFingerprint = fingerprintM05({
      policyVersion: policy.policyVersion,
      methodologyVersion: policy.methodologyVersion,
      promptBundleVersion: policy.promptBundleVersion,
      promptArtifactSha256: sha256(Buffer.from(policy.promptUtf8Hex, "hex")),
      atomTemplateArtifactSha256: sha256(Buffer.from(policy.atomTemplateUtf8Hex, "hex")),
      providerConfigFingerprintOrNull:
        policy.providerConfigOrNull === null ? null : fingerprintM05(policy.providerConfigOrNull),
    });
    const expectedInputFingerprint = fingerprintM05({
      schemaVersion: "M05_INPUT_V1",
      sourceFingerprint: row.source_fingerprint,
      policyFingerprint: row.policy_fingerprint,
    });
    const parsedManifest = M05InputManifestV1Schema.parse(manifest);
    if (
      canonicalJsonM03(inputValue) !== decoder.decode(inputPayload) ||
      canonicalJsonM03(parsedManifest) !== decoder.decode(row.canonical_manifest) ||
      fingerprintM05(source) !== row.source_fingerprint ||
      expectedPolicyFingerprint !== row.policy_fingerprint ||
      expectedInputFingerprint !== row.input_fingerprint ||
      revision.sourceFingerprint !== row.source_fingerprint ||
      revision.policyFingerprint !== row.policy_fingerprint ||
      revision.bindingId !== row.binding_id ||
      revision.extractionId !== row.extraction_id ||
      request.expectedBindingFingerprint !== bindingFingerprint ||
      request.bindingId !== source.acceptedResultRecord.bindingId ||
      request.extractionId !== source.bundle.extractionId
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    if (
      parsedManifest.byteLength !== inputPayload.byteLength ||
      parsedManifest.chunkCount !== row.chunk_count ||
      parsedManifest.payloadSha256 !== sha256(inputPayload) ||
      parsedManifest.inputFingerprint !== revision.inputFingerprint ||
      parsedManifest.sourceFingerprint !== row.source_fingerprint ||
      parsedManifest.policyFingerprint !== row.policy_fingerprint ||
      !equal(parsedManifest.chunkHashes, row.stored_chunk_hashes)
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    validateDraftPersistenceCandidateV1(
      {
        request,
        requestFingerprint: row.request_fingerprint,
        semanticRequestFingerprint: row.semantic_request_fingerprint,
        source,
        policy,
        sourceFingerprint: row.source_fingerprint,
        policyFingerprint: row.policy_fingerprint,
        inputFingerprint: row.input_fingerprint,
        generationFingerprint: row.generation_fingerprint,
        revision,
      },
      this.options.trustedProviderConfigs,
    );
    return { request, revision, source, policy };
  }

  public async findByRequest(
    request: GenerateDraftRequestV1,
  ): Promise<DraftRevisionV1 | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.assertAuthority(client);
      const encoded = encodeM04IdempotencyKeyForDatabase(request.idempotencyKey);
      const rawCount = await this.count(client, "requests", "encoded_key=$1", [encoded]);
      const keys = await this.requestKeys(client, "q.encoded_key=$1", [encoded]);
      if (rawCount !== keys.length) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
      if (keys.length === 0) {
        await client.query("COMMIT");
        return undefined;
      }
      const value = this.validate(await this.rowByKey(client, exactlyOne(keys)));
      if (!equal(value.request, request)) throw new Error("M05_IDEMPOTENCY_KEY_REUSED");
      await this.assertAuthority(client);
      await client.query("COMMIT");
      return structuredClone(value.revision);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async findBySemanticRequest(
    request: GenerateDraftRequestV1,
  ): Promise<DraftRevisionV1 | undefined> {
    const semantic = Object.fromEntries(
      Object.entries(request).filter(([key]) => key !== "idempotencyKey"),
    );
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.assertAuthority(client);
      const semanticFingerprint = fingerprintM05(semantic);
      const rawCount = await this.count(client, "requests", "semantic_request_fingerprint=$1", [
        semanticFingerprint,
      ]);
      const keys = await this.requestKeys(client, "q.semantic_request_fingerprint=$1", [
        semanticFingerprint,
      ]);
      if (rawCount !== keys.length) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
      let winner: DraftRevisionV1 | undefined;
      for (const [index, encodedKey] of keys.entries()) {
        let value;
        if (index === 0) value = this.validate(await this.rowByKey(client, encodedKey));
        else {
          if (winner === undefined) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
          value = {
            request: this.validateRequestRow(
              await this.requestRowByKey(client, encodedKey),
              winner,
            ),
            revision: winner,
          };
        }
        const storedSemantic = Object.fromEntries(
          Object.entries(value.request).filter(([key]) => key !== "idempotencyKey"),
        );
        if (!equal(semantic, storedSemantic)) throw new Error("M05_CONTENT_HASH_COLLISION");
        if (winner !== undefined && !equal(winner, value.revision))
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        winner ??= value.revision;
      }
      await this.assertAuthority(client);
      await client.query("COMMIT");
      return winner === undefined ? undefined : structuredClone(winner);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async associateAlias(
    request: GenerateDraftRequestV1,
    revision: DraftRevisionV1,
    signal?: AbortSignal,
  ): Promise<DraftRevisionV1> {
    return this.writeRequestAssociation(request, revision, signal);
  }

  private async writeRequestAssociation(
    request: GenerateDraftRequestV1,
    revision: DraftRevisionV1,
    signal?: AbortSignal,
  ): Promise<DraftRevisionV1> {
    const encoded = encodeM04IdempotencyKeyForDatabase(request.idempotencyKey);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        assertActive(signal);
        await this.assertAuthority(client);
        for (const key of [
          `M05_GENERATION:${revision.generationFingerprint}`,
          `M05_KEY:${encoded}`,
        ].sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))))
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
        const rawExistingCount = await this.count(client, "requests", "encoded_key=$1", [encoded]);
        const existingKeys = await this.requestKeys(client, "q.encoded_key=$1", [encoded]);
        if (rawExistingCount !== existingKeys.length)
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        if (existingKeys.length > 0) {
          const value = this.validate(await this.rowByKey(client, exactlyOne(existingKeys)));
          if (!equal(value.request, request)) throw new Error("M05_IDEMPOTENCY_KEY_REUSED");
          assertActive(signal);
          await client.query("COMMIT");
          return structuredClone(value.revision);
        }
        const rawRevisionCount = await this.count(client, "revisions", "revision_id=$1", [
          revision.revisionId,
        ]);
        const rawRetainedCount = await this.count(client, "requests", "revision_id=$1", [
          revision.revisionId,
        ]);
        const retainedKeys = await this.requestKeys(client, "q.revision_id=$1", [
          revision.revisionId,
        ]);
        if (rawRevisionCount === 0) throw new Error("M05_ALIAS_TARGET_INVALID");
        if (
          rawRevisionCount !== 1 ||
          rawRetainedCount !== retainedKeys.length ||
          retainedKeys.length === 0
        )
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        const requestedSemantic = Object.fromEntries(
          Object.entries(request).filter(([key]) => key !== "idempotencyKey"),
        );
        let validatedRevision: DraftRevisionV1 | undefined;
        for (const retainedKey of retainedKeys) {
          const firstRetained = validatedRevision === undefined;
          let validated;
          if (firstRetained) validated = this.validate(await this.rowByKey(client, retainedKey));
          else {
            if (validatedRevision === undefined)
              throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
            validated = {
              request: this.validateRequestRow(
                await this.requestRowByKey(client, retainedKey),
                validatedRevision,
              ),
              revision: validatedRevision,
            };
          }
          validatedRevision ??= validated.revision;
          const retainedSemantic = Object.fromEntries(
            Object.entries(validated.request).filter(([key]) => key !== "idempotencyKey"),
          );
          if (
            (firstRetained && !equal(validated.revision, revision)) ||
            !equal(retainedSemantic, requestedSemantic)
          )
            throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        }
        await this.insertRequest(client, request, revision);
        await this.assertAuthority(client);
        assertActive(signal);
        await client.query("COMMIT");
        return structuredClone(revision);
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (["40001", "40P01"].includes(databaseErrorCode(error) ?? "")) {
          if (attempt < 2) continue;
          throwSerializationRetryExhausted(error);
        }
        throw error;
      } finally {
        client.release();
      }
    }
    throw new Error("M05_SERIALIZATION_RETRY_EXHAUSTED");
  }

  public async persistAccepted(
    candidate: Candidate,
    signal?: AbortSignal,
  ): Promise<DraftRevisionV1> {
    return (await this.persistAcceptedWithDisposition(candidate, signal)).revision;
  }

  public async persistAcceptedWithDisposition(
    candidate: Candidate,
    signal?: AbortSignal,
  ): Promise<{ readonly revision: DraftRevisionV1; readonly replayed: boolean }> {
    assertActive(signal);
    validateDraftPersistenceCandidateV1(candidate, this.options.trustedProviderConfigs);
    const request = GenerateDraftRequestV1Schema.parse(candidate.request);
    const source = AcceptedBindingSnapshotV1Schema.parse(candidate.source);
    const policy = M05PolicyArtifactsV1Schema.parse(candidate.policy);
    const revision = DraftRevisionV1Schema.parse(candidate.revision);
    const semantic = Object.fromEntries(
      Object.entries(request).filter(([key]) => key !== "idempotencyKey"),
    );
    const promptArtifactSha256 = sha256(Buffer.from(policy.promptUtf8Hex, "hex"));
    const atomTemplateArtifactSha256 = sha256(Buffer.from(policy.atomTemplateUtf8Hex, "hex"));
    const providerConfigFingerprintOrNull =
      policy.providerConfigOrNull === null ? null : fingerprintM05(policy.providerConfigOrNull);
    const expectedPolicyFingerprint = fingerprintM05({
      policyVersion: policy.policyVersion,
      methodologyVersion: policy.methodologyVersion,
      promptBundleVersion: policy.promptBundleVersion,
      promptArtifactSha256,
      atomTemplateArtifactSha256,
      providerConfigFingerprintOrNull,
    });
    const expectedInputFingerprint = fingerprintM05({
      schemaVersion: "M05_INPUT_V1",
      sourceFingerprint: candidate.sourceFingerprint,
      policyFingerprint: candidate.policyFingerprint,
    });
    const expectedGenerationFingerprint = fingerprintM05({
      schemaVersion: "M05_GENERATION_V1",
      inputFingerprint: candidate.inputFingerprint,
      mode: request.mode,
      regenerationToken: request.regenerationToken,
    });
    const expectedRevisionId = `drv_${fingerprintM05({ schemaVersion: "M05_REVISION_ID_V1", generationFingerprint: candidate.generationFingerprint, outputFingerprint: revision.outputFingerprint })}`;
    const projected = projectEvidenceBinding(source.bundle);
    const sourceRequest = source.semanticRequest;
    const bindingPreimage = {
      schemaVersion: "M04_BINDING_ID_V1",
      extractionId: source.bundle.extractionId,
      logicalPayloadSha256: fingerprintM05(m03LogicalProjection(source.bundle)),
      evidencePolicyVersion: sourceRequest.evidencePolicyVersion,
      materialFieldRegistryVersion: sourceRequest.materialFieldRegistryVersion,
      evidenceItemIds: projected.evidenceItems
        .map(({ id }) => id)
        .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
      claimIds: projected.claims.map(({ id }) => id),
      linkIds: projected.links.map(({ id }) => id),
      completenessId: projected.completeness.id,
    };
    const expectedBindingFingerprint = fingerprintM05(bindingPreimage);
    const acceptedCore = {
      kind: "ACCEPTED",
      bindingId: `bnd_${expectedBindingFingerprint}`,
      extractionId: source.bundle.extractionId,
      completenessId: projected.completeness.id,
    };
    if (
      candidate.requestFingerprint !== fingerprintM05(request) ||
      candidate.semanticRequestFingerprint !== fingerprintM05(semantic) ||
      candidate.sourceFingerprint !== fingerprintM05(source) ||
      candidate.policyFingerprint !== expectedPolicyFingerprint ||
      candidate.inputFingerprint !== expectedInputFingerprint ||
      candidate.generationFingerprint !== expectedGenerationFingerprint ||
      revision.revisionId !== expectedRevisionId ||
      revision.recordFingerprint !==
        fingerprintM05(
          Object.fromEntries(
            Object.entries(revision).filter(([key]) => key !== "recordFingerprint"),
          ),
        ) ||
      revision.inputFingerprint !== candidate.inputFingerprint ||
      revision.generationFingerprint !== candidate.generationFingerprint ||
      revision.sourceFingerprint !== candidate.sourceFingerprint ||
      revision.policyFingerprint !== candidate.policyFingerprint ||
      revision.bindingId !== source.acceptedResultRecord.bindingId ||
      revision.extractionId !== source.bundle.extractionId ||
      request.bindingId !== source.acceptedResultRecord.bindingId ||
      request.extractionId !== source.bundle.extractionId ||
      request.expectedBindingFingerprint !== expectedBindingFingerprint ||
      recomputeM03OutputFingerprint(source.bundle) !== source.bundle.outputFingerprint ||
      !equal(source.bindingPreimage, bindingPreimage) ||
      !equal(
        source.evidenceItems,
        [...projected.evidenceItems].sort((left, right) =>
          Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
        ),
      ) ||
      !equal(source.claims, projected.claims) ||
      !equal(source.links, projected.links) ||
      !equal(source.completeness, projected.completeness) ||
      !equal(source.acceptedResultRecord, {
        schemaVersion: "M04_RESULT_V1",
        resultId: `m4r_${fingerprintM05(acceptedCore)}`,
        ...acceptedCore,
      }) ||
      sourceRequest.extractionId !== source.bundle.extractionId ||
      sourceRequest.expectedM03OutputFingerprint !== source.bundle.outputFingerprint ||
      sourceRequest.expectedResourceIdentityId !== source.bundle.m02.resourceIdentityId ||
      sourceRequest.expectedResourceVersionIdentityId !==
        source.bundle.m02.resourceVersionIdentityId ||
      sourceRequest.expectedSourceSnapshotId !== source.bundle.m02.sourceSnapshotId ||
      sourceRequest.expectedSourceRevision !== source.bundle.m02.sourceRevision ||
      !equal(sourceRequest.expectedPredecessorState, source.bundle.expectedPredecessorState)
    )
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
    const input = {
      schemaVersion: "M05_PERSISTED_INPUT_V1",
      source: candidate.source,
      policy: candidate.policy,
    };
    const payload = canonicalBytes(input);
    const revisionPayload = canonicalBytes(candidate.revision);
    if (payload.byteLength > MAXIMUM || revisionPayload.byteLength > MAXIMUM)
      throw new Error("M05_CAPACITY_EXCEEDED");
    const chunks = Array.from({ length: Math.ceil(payload.byteLength / CHUNK) }, (_, ordinal) =>
      payload.subarray(ordinal * CHUNK, Math.min(payload.byteLength, (ordinal + 1) * CHUNK)),
    );
    const manifest = {
      schemaVersion: "M05_INPUT_MANIFEST_V1",
      byteLength: payload.byteLength,
      chunkCount: chunks.length,
      payloadSha256: sha256(payload),
      chunkHashes: chunks.map(sha256),
      inputFingerprint: candidate.inputFingerprint,
      sourceFingerprint: candidate.sourceFingerprint,
      policyFingerprint: candidate.policyFingerprint,
    };
    const manifestPayload = canonicalBytes(manifest);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        assertActive(signal);
        await this.assertAuthority(client);
        const encoded = encodeM04IdempotencyKeyForDatabase(candidate.request.idempotencyKey);
        for (const key of [
          `M05_GENERATION:${candidate.generationFingerprint}`,
          `M05_KEY:${encoded}`,
        ].sort())
          await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
        const rawByKeyCount = await this.count(client, "requests", "encoded_key=$1", [encoded]);
        const byKey = await this.requestKeys(client, "q.encoded_key=$1", [encoded]);
        if (rawByKeyCount !== byKey.length) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        if (byKey.length > 0) {
          const value = this.validate(await this.rowByKey(client, exactlyOne(byKey)));
          if (!equal(value.request, candidate.request))
            throw new Error("M05_IDEMPOTENCY_KEY_REUSED");
          assertActive(signal);
          await client.query("COMMIT");
          return { revision: structuredClone(value.revision), replayed: true };
        }
        const rawGenerationCount = await this.count(
          client,
          "revisions",
          "generation_fingerprint=$1",
          [candidate.generationFingerprint],
        );
        const rawGenerationRequestCount = await this.count(
          client,
          "requests",
          "generation_fingerprint=$1",
          [candidate.generationFingerprint],
        );
        const byGeneration = await this.requestKeys(client, "q.generation_fingerprint=$1", [
          candidate.generationFingerprint,
        ]);
        if (
          rawGenerationRequestCount !== byGeneration.length ||
          (rawGenerationCount > 0 && byGeneration.length === 0)
        )
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        if (byGeneration.length > 0) {
          let winner: DraftRevisionV1 | undefined;
          for (const generationKey of byGeneration) {
            const value = this.validate(await this.rowByKey(client, generationKey));
            assertM05FingerprintReuseBytesV1(
              candidate.generationFingerprint,
              canonicalBytes({
                schemaVersion: "M05_GENERATION_V1",
                inputFingerprint: value.revision.inputFingerprint,
                mode: value.request.mode,
                regenerationToken: value.request.regenerationToken,
              }),
              canonicalBytes({
                schemaVersion: "M05_GENERATION_V1",
                inputFingerprint: candidate.inputFingerprint,
                mode: candidate.request.mode,
                regenerationToken: candidate.request.regenerationToken,
              }),
            );
            assertM05FingerprintReuseBytesV1(
              candidate.inputFingerprint,
              canonicalBytes({
                schemaVersion: "M05_PERSISTED_INPUT_V1",
                source: value.source,
                policy: value.policy,
              }),
              payload,
            );
            assertReusedRevisionIdentities(value.revision, candidate.revision);
            if (winner !== undefined && !equal(winner, value.revision))
              throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
            winner ??= value.revision;
          }
          if (winner === undefined) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
          await this.insertRequest(client, candidate.request, winner);
          await this.assertAuthority(client);
          assertActive(signal);
          await client.query("COMMIT");
          return { revision: structuredClone(winner), replayed: true };
        }
        for (const identity of [
          {
            column: "output_fingerprint",
            value: candidate.revision.outputFingerprint,
            blocksInsert: false,
          },
          {
            column: "revision_id",
            value: candidate.revision.revisionId,
            blocksInsert: true,
          },
          {
            column: "record_fingerprint",
            value: candidate.revision.recordFingerprint,
            blocksInsert: true,
          },
        ] as const) {
          const rawIdentityCount = await this.count(client, "revisions", `${identity.column}=$1`, [
            identity.value,
          ]);
          const retainedIdentityKeys = await this.revisionRepresentativeKeys(
            client,
            `r.${identity.column}=$1`,
            [identity.value],
          );
          if (
            rawIdentityCount !== retainedIdentityKeys.length ||
            (rawIdentityCount > 0 && retainedIdentityKeys.length === 0)
          )
            throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
          for (const retainedKey of retainedIdentityKeys) {
            const retained = this.validate(await this.rowByKey(client, retainedKey));
            if (identity.column === "output_fingerprint")
              assertM05FingerprintReuseBytesV1(
                candidate.revision.outputFingerprint,
                canonicalBytes(outputPreimage(retained.revision)),
                canonicalBytes(outputPreimage(candidate.revision)),
              );
            else if (identity.column === "revision_id")
              assertM05FingerprintReuseBytesV1(
                candidate.revision.revisionId.slice("drv_".length),
                canonicalBytes(revisionIdPreimage(retained.revision)),
                canonicalBytes(revisionIdPreimage(candidate.revision)),
              );
            else
              assertM05FingerprintReuseBytesV1(
                candidate.revision.recordFingerprint,
                canonicalBytes(recordFingerprintPreimage(retained.revision)),
                canonicalBytes(recordFingerprintPreimage(candidate.revision)),
              );
          }
          if (identity.blocksInsert && retainedIdentityKeys.length > 0)
            throw new Error("M05_CONTENT_HASH_COLLISION");
        }
        const rawInput = await this.query(
          client,
          `SELECT 1 FROM ${this.#schemaSql}.inputs WHERE input_fingerprint=$1`,
          [candidate.inputFingerprint],
        );
        const retainedInput = await this.requestKeys(client, "i.input_fingerprint=$1", [
          candidate.inputFingerprint,
        ]);
        if (rawInput.length > 0 && retainedInput.length === 0)
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        if (retainedInput.length > 0) {
          for (const retainedKey of retainedInput) {
            const retained = this.validate(await this.rowByKey(client, retainedKey));
            if (retained.revision.inputFingerprint !== candidate.inputFingerprint)
              throw new Error("M05_CONTENT_HASH_COLLISION");
            assertM05FingerprintReuseBytesV1(
              candidate.inputFingerprint,
              canonicalBytes({
                schemaVersion: "M05_PERSISTED_INPUT_V1",
                source: retained.source,
                policy: retained.policy,
              }),
              payload,
            );
          }
        } else {
          const inserted = await this.query<{ inserted: number }>(
            client,
            `INSERT INTO ${this.#schemaSql}.inputs(input_fingerprint,source_fingerprint,policy_fingerprint,binding_id,extraction_id,byte_length,chunk_count,canonical_manifest,manifest_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (input_fingerprint) DO NOTHING RETURNING 1 inserted`,
            [
              candidate.inputFingerprint,
              candidate.sourceFingerprint,
              candidate.policyFingerprint,
              candidate.source.acceptedResultRecord.bindingId,
              candidate.source.bundle.extractionId,
              payload.byteLength,
              chunks.length,
              manifestPayload,
              sha256(manifestPayload),
            ],
          );
          if (inserted.length === 1) {
            for (const [ordinal, chunk] of chunks.entries())
              await this.query(
                client,
                `INSERT INTO ${this.#schemaSql}.input_chunks(input_fingerprint,ordinal,payload,payload_sha256) VALUES($1,$2,$3,$4)`,
                [candidate.inputFingerprint, ordinal, chunk, sha256(chunk)],
              );
          } else {
            const concurrentInput = await this.requestKeys(client, "i.input_fingerprint=$1", [
              candidate.inputFingerprint,
            ]);
            if (concurrentInput.length === 0) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
            for (const retainedKey of concurrentInput) {
              const retained = this.validate(await this.rowByKey(client, retainedKey));
              assertM05FingerprintReuseBytesV1(
                candidate.inputFingerprint,
                canonicalBytes({
                  schemaVersion: "M05_PERSISTED_INPUT_V1",
                  source: retained.source,
                  policy: retained.policy,
                }),
                payload,
              );
            }
          }
        }
        const insertedRevision = await this.query<{ inserted: number }>(
          client,
          `INSERT INTO ${this.#schemaSql}.revisions(revision_id,generation_fingerprint,input_fingerprint,output_fingerprint,record_fingerprint,canonical_payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (generation_fingerprint) DO NOTHING RETURNING 1 inserted`,
          [
            candidate.revision.revisionId,
            candidate.generationFingerprint,
            candidate.inputFingerprint,
            candidate.revision.outputFingerprint,
            candidate.revision.recordFingerprint,
            revisionPayload,
          ],
        );
        if (insertedRevision.length === 0) {
          const concurrentKeys = await this.requestKeys(client, "q.generation_fingerprint=$1", [
            candidate.generationFingerprint,
          ]);
          let concurrentWinner: DraftRevisionV1 | undefined;
          for (const concurrentKey of concurrentKeys) {
            const value = this.validate(await this.rowByKey(client, concurrentKey));
            assertM05FingerprintReuseBytesV1(
              candidate.generationFingerprint,
              canonicalBytes({
                schemaVersion: "M05_GENERATION_V1",
                inputFingerprint: value.revision.inputFingerprint,
                mode: value.request.mode,
                regenerationToken: value.request.regenerationToken,
              }),
              canonicalBytes({
                schemaVersion: "M05_GENERATION_V1",
                inputFingerprint: candidate.inputFingerprint,
                mode: candidate.request.mode,
                regenerationToken: candidate.request.regenerationToken,
              }),
            );
            assertM05FingerprintReuseBytesV1(
              candidate.inputFingerprint,
              canonicalBytes({
                schemaVersion: "M05_PERSISTED_INPUT_V1",
                source: value.source,
                policy: value.policy,
              }),
              payload,
            );
            assertReusedRevisionIdentities(value.revision, candidate.revision);
            if (concurrentWinner !== undefined && !equal(concurrentWinner, value.revision))
              throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
            concurrentWinner ??= value.revision;
          }
          if (concurrentWinner === undefined) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
          await this.insertRequest(client, candidate.request, concurrentWinner);
          await this.assertAuthority(client);
          assertActive(signal);
          await client.query("COMMIT");
          return { revision: structuredClone(concurrentWinner), replayed: true };
        }
        await this.insertRequest(client, candidate.request, candidate.revision);
        await this.assertAuthority(client);
        assertActive(signal);
        await client.query("COMMIT");
        return { revision: structuredClone(candidate.revision), replayed: false };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (databaseErrorCode(error) === "23505")
          return await this.classifyAlternateUniqueViolation(candidate, error);
        if (["40001", "40P01"].includes(databaseErrorCode(error) ?? "")) {
          if (attempt < 2) continue;
          throwSerializationRetryExhausted(error);
        }
        throw error;
      } finally {
        client.release();
      }
    }
    throw new Error("M05_SERIALIZATION_RETRY_EXHAUSTED");
  }

  private async classifyAlternateUniqueViolation(
    candidate: Candidate,
    error: unknown,
  ): Promise<never> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.assertAuthority(client);
      let found = false;
      for (const identity of [
        { column: "revision_id", value: candidate.revision.revisionId },
        { column: "record_fingerprint", value: candidate.revision.recordFingerprint },
      ] as const) {
        const rawCount = await this.count(client, "revisions", `${identity.column}=$1`, [
          identity.value,
        ]);
        const keys = await this.revisionRepresentativeKeys(client, `r.${identity.column}=$1`, [
          identity.value,
        ]);
        if (rawCount !== keys.length || (rawCount > 0 && keys.length === 0))
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        for (const key of keys) {
          found = true;
          const incumbent = this.validate(await this.rowByKey(client, key)).revision;
          if (identity.column === "revision_id")
            assertM05FingerprintReuseBytesV1(
              candidate.revision.revisionId.slice("drv_".length),
              canonicalBytes(revisionIdPreimage(incumbent)),
              canonicalBytes(revisionIdPreimage(candidate.revision)),
            );
          else
            assertM05FingerprintReuseBytesV1(
              candidate.revision.recordFingerprint,
              canonicalBytes(recordFingerprintPreimage(incumbent)),
              canonicalBytes(recordFingerprintPreimage(candidate.revision)),
            );
        }
      }
      await this.assertAuthority(client);
      await client.query("COMMIT");
      if (found) throw new Error("M05_CONTENT_HASH_COLLISION");
      throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED", {
        cause: safeInternalCause(error),
      });
    } catch (classificationError) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw classificationError;
    } finally {
      client.release();
    }
  }

  private async insertRequest(
    client: PoolClient,
    request: GenerateDraftRequestV1,
    revision: DraftRevisionV1,
  ): Promise<void> {
    const requestPayload = canonicalBytes(request);
    const result = {
      schemaVersion: "M05_GENERATE_DRAFT_RESULT_V1",
      kind: "ACCEPTED",
      revisionId: revision.revisionId,
      inputFingerprint: revision.inputFingerprint,
      outputFingerprint: revision.outputFingerprint,
      recordFingerprint: revision.recordFingerprint,
      replayed: false,
    };
    const resultPayload = canonicalBytes(result);
    const inserted = await this.query<{ inserted: number }>(
      client,
      `INSERT INTO ${this.#schemaSql}.requests(encoded_key,request_fingerprint,semantic_request_fingerprint,canonical_request,generation_fingerprint,revision_id,canonical_result,result_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (encoded_key) DO NOTHING RETURNING 1 inserted`,
      [
        encodeM04IdempotencyKeyForDatabase(request.idempotencyKey),
        sha256(requestPayload),
        fingerprintM05(
          Object.fromEntries(Object.entries(request).filter(([key]) => key !== "idempotencyKey")),
        ),
        requestPayload,
        revision.generationFingerprint,
        revision.revisionId,
        resultPayload,
        sha256(resultPayload),
      ],
    );
    if (inserted.length !== 1) throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
  }

  public async readRevision(revisionId: string): Promise<DraftRevisionV1 | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await this.assertAuthority(client);
      const rawCount = await this.count(client, "revisions", "revision_id=$1", [revisionId]);
      const rawRequestCount = await this.count(client, "requests", "revision_id=$1", [revisionId]);
      const keys = await this.requestKeys(client, "q.revision_id=$1", [revisionId]);
      if (rawCount === 0) {
        if (rawRequestCount !== 0 || keys.length !== 0)
          throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
        await client.query("COMMIT");
        return undefined;
      }
      if (rawCount !== 1 || rawRequestCount !== keys.length || keys.length === 0)
        throw new Error("M05_PERSISTENCE_INTEGRITY_FAILED");
      const first = this.validate(
        await this.rowByKey(client, exactlyOne(keys.slice(0, 1))),
      ).revision;
      for (const encodedKey of keys.slice(1))
        this.validateRequestRow(await this.requestRowByKey(client, encodedKey), first);
      await this.assertAuthority(client);
      await client.query("COMMIT");
      return structuredClone(first);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
