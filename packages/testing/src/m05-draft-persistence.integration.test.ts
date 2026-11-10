import { createHash } from "node:crypto";

import { canonicalJsonM03, type GenerateDraftRequestV1 } from "@ai-ark/contracts";
import {
  DraftGenerationServiceV1,
  type DraftPersistenceCandidateV1,
  type DraftPersistencePortV1,
} from "@ai-ark/draft-generation";
import { PostgresDraftPersistenceAdapterV1 } from "@ai-ark/job-queue";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript CLI module is exercised directly by this integration test.
import { migrate } from "../../../scripts/db-migrate.mjs";
import { createM05EligibleSnapshotFixture } from "./m05-genuine-snapshot-fixture.js";
import { EphemeralPostgresHarness } from "./postgres-harness.js";

const harness = new EphemeralPostgresHarness();
const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");
let adapter: PostgresDraftPersistenceAdapterV1;
let ownerPool: Pool;
let migrationOwnerRole: string;
let migrationOwnerOid: string;
const adapterOptions = () => ({
  loginRole: "ai_ark_m05_login",
  migrationOwnerRole,
  migrationOwnerOid,
  predecessorLoginRoles: ["ai_ark_m04_login", "ai_ark_m01_m02_login"] as const,
});

describe("M05 PostgreSQL draft persistence", () => {
  beforeAll(async () => {
    const owner = await harness.start();
    ownerPool = owner;
    const migrationOwner = (
      await owner.query<{ oid: string; role_name: string }>(
        "SELECT oid::text,current_user role_name FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (migrationOwner === undefined) throw new Error("M05_MIGRATION_OWNER_FIXTURE_INVALID");
    migrationOwnerRole = migrationOwner.role_name;
    migrationOwnerOid = migrationOwner.oid;
    const database = (await owner.query<{ current_database: string }>("SELECT current_database()"))
      .rows[0]?.current_database;
    if (database === undefined || !/^[A-Za-z0-9_]+$/u.test(database))
      throw new Error("M05_FIXTURE_DATABASE_INVALID");
    const sentinel = "m05-fixture-sentinel-0001";
    await owner.query(`COMMENT ON DATABASE ${database} IS 'ai-ark-m04-disposable:${sentinel}'`);
    const url = new URL(harness.connectionUri());
    const env = {
      AI_ARK_DATABASE_URL: url.toString(),
      AI_ARK_DATABASE_ENVIRONMENT: "test",
      AI_ARK_DATABASE_ALLOWED_HOSTS: url.hostname,
      AI_ARK_DATABASE_SCHEMA: "public",
      AI_ARK_DATABASE_OWNERSHIP_SENTINEL: sentinel,
      AI_ARK_M04_DATABASE_LOGIN_ROLE: "ai_ark_m04_login",
      AI_ARK_M01_M02_DATABASE_LOGIN_ROLE: "ai_ark_m01_m02_login",
      AI_ARK_M05_DATABASE_LOGIN_ROLE: "ai_ark_m05_login",
      AI_ARK_M04_DATABASE_RUNTIME_URL: harness.connectionUriForRole("ai_ark_m04_login"),
      AI_ARK_M01_M02_DATABASE_WRITER_URL: harness.connectionUriForRole("ai_ark_m01_m02_login"),
      AI_ARK_M05_DATABASE_RUNTIME_URL: harness.connectionUriForRole("ai_ark_m05_login"),
    };
    await migrate(env);
    adapter = await PostgresDraftPersistenceAdapterV1.open(
      harness.poolForRole("ai_ark_m05_login"),
      adapterOptions(),
    );
  }, 120_000);

  afterAll(async () => harness.stop());

  it("rejects coherent orphan input and revision commits from the actual login", async () => {
    const source = await createM05EligibleSnapshotFixture();
    const request: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "orphan-closure-seed",
      bindingId: source.acceptedResultRecord.bindingId,
      extractionId: source.bundle.extractionId,
      expectedBindingFingerprint: source.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "orphan-closure-generation",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    let candidate: DraftPersistenceCandidateV1 | undefined;
    const capture: DraftPersistencePortV1 = {
      findByRequest: () => Promise.resolve(undefined),
      findBySemanticRequest: () => Promise.resolve(undefined),
      associateAlias: () => Promise.reject(new Error("unexpected alias")),
      persistAccepted: (value) => {
        candidate = structuredClone(value);
        return Promise.resolve(value.revision);
      },
      readRevision: () => Promise.resolve(undefined),
    };
    await new DraftGenerationServiceV1(
      { readAcceptedBinding: () => Promise.resolve({ kind: "FOUND", snapshot: source }) },
      capture,
    ).generate(Buffer.from(JSON.stringify(request)));
    if (candidate === undefined) throw new Error("M05_ORPHAN_CANDIDATE_MISSING");
    await adapter.persistAccepted(candidate);

    const runtime = harness.poolForRole("ai_ark_m05_login");
    const inputFingerprint = sha256(Buffer.from("m05-coherent-orphan-input", "utf8"));
    const payload = Buffer.from(
      canonicalJsonM03({
        schemaVersion: "M05_PERSISTED_INPUT_V1",
        source: candidate.source,
        policy: candidate.policy,
      }),
      "utf8",
    );
    const chunks = Array.from({ length: Math.ceil(payload.byteLength / 65_536) }, (_, ordinal) =>
      payload.subarray(ordinal * 65_536, Math.min(payload.byteLength, (ordinal + 1) * 65_536)),
    );
    const manifest = Buffer.from(
      canonicalJsonM03({
        schemaVersion: "M05_INPUT_MANIFEST_V1",
        byteLength: payload.byteLength,
        chunkCount: chunks.length,
        payloadSha256: sha256(payload),
        chunkHashes: chunks.map(sha256),
        inputFingerprint,
        sourceFingerprint: candidate.sourceFingerprint,
        policyFingerprint: candidate.policyFingerprint,
      }),
      "utf8",
    );
    const client = await runtime.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO ai_ark_m05.inputs(input_fingerprint,source_fingerprint,policy_fingerprint,binding_id,extraction_id,byte_length,chunk_count,canonical_manifest,manifest_sha256)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          inputFingerprint,
          candidate.sourceFingerprint,
          candidate.policyFingerprint,
          candidate.source.acceptedResultRecord.bindingId,
          candidate.source.bundle.extractionId,
          payload.byteLength,
          chunks.length,
          manifest,
          sha256(manifest),
        ],
      );
      for (const [ordinal, chunk] of chunks.entries())
        await client.query(
          "INSERT INTO ai_ark_m05.input_chunks(input_fingerprint,ordinal,payload,payload_sha256) VALUES($1,$2,$3,$4)",
          [inputFingerprint, ordinal, chunk, sha256(chunk)],
        );
      await expect(client.query("COMMIT")).rejects.toMatchObject({ code: "55000" });
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await expect(
      ownerPool.query("SELECT 1 FROM ai_ark_m05.inputs WHERE input_fingerprint=$1", [
        inputFingerprint,
      ]),
    ).resolves.toMatchObject({ rowCount: 0 });

    const generationFingerprint = sha256(Buffer.from("m05-coherent-orphan-revision", "utf8"));
    const revisionId = `drv_${sha256(Buffer.from("m05-coherent-orphan-revision-id", "utf8"))}`;
    const recordFingerprint = sha256(Buffer.from("m05-coherent-orphan-record", "utf8"));
    const revisionPayload = Buffer.from(
      canonicalJsonM03({
        ...candidate.revision,
        revisionId,
        generationFingerprint,
        recordFingerprint,
      }),
      "utf8",
    );
    const revisionClient = await runtime.connect();
    try {
      await revisionClient.query("BEGIN");
      await revisionClient.query(
        "INSERT INTO ai_ark_m05.revisions(revision_id,generation_fingerprint,input_fingerprint,output_fingerprint,record_fingerprint,canonical_payload) VALUES($1,$2,$3,$4,$5,$6)",
        [
          revisionId,
          generationFingerprint,
          candidate.inputFingerprint,
          candidate.revision.outputFingerprint,
          recordFingerprint,
          revisionPayload,
        ],
      );
      await expect(revisionClient.query("COMMIT")).rejects.toMatchObject({ code: "55000" });
    } finally {
      await revisionClient.query("ROLLBACK").catch(() => undefined);
      revisionClient.release();
    }
    await expect(
      ownerPool.query("SELECT 1 FROM ai_ark_m05.revisions WHERE revision_id=$1", [revisionId]),
    ).resolves.toMatchObject({ rowCount: 0 });
  }, 120_000);

  it("persists, restarts, replays, and aliases immutable canonical input", async () => {
    const source = await createM05EligibleSnapshotFixture();
    const request: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "persist-key",
      bindingId: source.acceptedResultRecord.bindingId,
      extractionId: source.bundle.extractionId,
      expectedBindingFingerprint: source.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "generation-1",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const captureCandidate = async (
      targetRequest: GenerateDraftRequestV1,
    ): Promise<DraftPersistenceCandidateV1> => {
      let captured: DraftPersistenceCandidateV1 | undefined;
      const capture: DraftPersistencePortV1 = {
        findByRequest: () => Promise.resolve(undefined),
        findBySemanticRequest: () => Promise.resolve(undefined),
        associateAlias: () => Promise.reject(new Error("unexpected alias")),
        persistAccepted: (value) => {
          captured = structuredClone(value);
          return Promise.resolve(value.revision);
        },
        readRevision: () => Promise.resolve(undefined),
      };
      const service = new DraftGenerationServiceV1(
        {
          readAcceptedBinding: () =>
            Promise.resolve({ kind: "FOUND", snapshot: structuredClone(source) }),
        },
        capture,
        undefined,
        undefined,
        () => new Date("2026-01-01T00:00:00.000Z"),
      );
      const result = await service.generate(Buffer.from(JSON.stringify(targetRequest)));
      if (result.kind !== "ACCEPTED" || captured === undefined)
        throw new Error(`M05_CANDIDATE_CAPTURE_FAILED:${result.kind}`);
      return captured;
    };
    const candidate = await captureCandidate(request);
    const revision = candidate.revision;
    const { revisionId } = revision;
    await expect(
      adapter.persistAccepted({ ...candidate, sourceFingerprint: "0".repeat(64) }),
    ).rejects.toThrow("M05_PERSISTENCE_INTEGRITY_FAILED");
    await expect(adapter.persistAccepted(candidate)).resolves.toEqual(revision);
    await expect(adapter.findByRequest(request)).resolves.toEqual(revision);
    const reopened = await PostgresDraftPersistenceAdapterV1.open(
      harness.poolForRole("ai_ark_m05_login"),
      adapterOptions(),
    );
    await expect(reopened.readRevision(revisionId)).resolves.toEqual(revision);
    const alias = { ...request, idempotencyKey: "alias-key" };
    await expect(reopened.associateAlias(alias, revision)).resolves.toEqual(revision);
    await expect(reopened.findBySemanticRequest(alias)).resolves.toEqual(revision);
    const shadowPool = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m05_login"),
      max: 1,
    });
    try {
      const shadowAdapter = await PostgresDraftPersistenceAdapterV1.open(
        shadowPool,
        adapterOptions(),
      );
      await shadowPool.query("CREATE TEMPORARY TABLE inputs(hostile text)");
      await shadowPool.query("CREATE TEMPORARY TABLE requests(hostile text)");
      await shadowPool.query(`CREATE FUNCTION pg_temp.m05_validate_request_closure()
        RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''HOSTILE_TEMP_FUNCTION_USED''; END'`);
      await shadowPool.query("SET search_path TO pg_temp,public");
      await expect(shadowAdapter.findByRequest(request)).resolves.toEqual(revision);
      await expect(
        shadowAdapter.associateAlias(
          { ...request, idempotencyKey: "pg-temp-shadow-alias" },
          revision,
        ),
      ).resolves.toEqual(revision);
    } finally {
      await shadowPool.end();
    }
    const regeneratedRequest = {
      ...request,
      idempotencyKey: "regenerated-key",
      regenerationToken: "generation-2",
    };
    const regeneratedCandidate = await captureCandidate(regeneratedRequest);
    const regeneratedRevision = regeneratedCandidate.revision;
    const regeneratedRevisionId = regeneratedRevision.revisionId;
    await expect(reopened.persistAccepted(regeneratedCandidate)).resolves.toEqual(
      regeneratedRevision,
    );
    await expect(reopened.readRevision(regeneratedRevisionId)).resolves.toEqual(
      regeneratedRevision,
    );
    const nulRequest = {
      ...request,
      idempotencyKey: "nul\u0000literal\\uE000pua\uE000\uE000\uE001",
      regenerationToken: "token\u0000literal\\uE001pua\uE000\uE000\uE001",
    };
    const nulCandidate = await captureCandidate(nulRequest);
    await expect(reopened.persistAccepted(nulCandidate)).resolves.toEqual(nulCandidate.revision);
    await expect(reopened.findByRequest(nulRequest)).resolves.toEqual(nulCandidate.revision);

    const manifestRow = (
      await ownerPool.query<{ canonical_manifest: Buffer }>(
        "SELECT canonical_manifest FROM ai_ark_m05.inputs WHERE input_fingerprint=$1",
        [candidate.inputFingerprint],
      )
    ).rows[0];
    if (manifestRow === undefined) throw new Error("M05_MANIFEST_ROW_MISSING");
    const canonicalManifest = manifestRow.canonical_manifest;
    const noncanonicalManifest = Buffer.from(
      JSON.stringify(JSON.parse(canonicalManifest.toString("utf8")), null, 1),
      "utf8",
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.inputs DISABLE TRIGGER inputs_immutable");
    await ownerPool.query(
      "UPDATE ai_ark_m05.inputs SET canonical_manifest=$2,manifest_sha256=encode(pg_catalog.sha256($2),'hex') WHERE input_fingerprint=$1",
      [candidate.inputFingerprint, noncanonicalManifest],
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.inputs ENABLE TRIGGER inputs_immutable");
    await expect(reopened.readRevision(revisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.inputs DISABLE TRIGGER inputs_immutable");
    await ownerPool.query(
      "UPDATE ai_ark_m05.inputs SET canonical_manifest=$2,manifest_sha256=encode(pg_catalog.sha256($2),'hex') WHERE input_fingerprint=$1",
      [candidate.inputFingerprint, canonicalManifest],
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.inputs ENABLE TRIGGER inputs_immutable");
    const runtime = harness.poolForRole("ai_ark_m05_login");
    const acceptedResult = {
      schemaVersion: "M05_GENERATE_DRAFT_RESULT_V1",
      kind: "ACCEPTED",
      revisionId: nulCandidate.revision.revisionId,
      inputFingerprint: nulCandidate.revision.inputFingerprint,
      outputFingerprint: nulCandidate.revision.outputFingerprint,
      recordFingerprint: nulCandidate.revision.recordFingerprint,
      replayed: false,
    } as const;
    const canonicalResult = Buffer.from(canonicalJsonM03(acceptedResult), "utf8");
    for (const escapedIdempotencyValue of [
      '"\\ue000\\ue000"',
      '"\\uE000\\uE000"',
      '"\\ue000\\u0000\\uE001"',
    ]) {
      const attackRequest = { ...nulRequest, idempotencyKey: "\uE000\uE000" };
      const canonicalAttack = canonicalJsonM03(attackRequest).replace(
        `"idempotencyKey":${JSON.stringify(attackRequest.idempotencyKey)}`,
        `"idempotencyKey":${escapedIdempotencyValue}`,
      );
      const canonicalAttackBytes = Buffer.from(canonicalAttack, "utf8");
      await expect(
        runtime.query(
          "INSERT INTO ai_ark_m05.requests(encoded_key,request_fingerprint,semantic_request_fingerprint,canonical_request,generation_fingerprint,revision_id,canonical_result,result_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            "00",
            sha256(canonicalAttackBytes),
            nulCandidate.semanticRequestFingerprint,
            canonicalAttackBytes,
            nulCandidate.generationFingerprint,
            nulCandidate.revision.revisionId,
            canonicalResult,
            sha256(canonicalResult),
          ],
        ),
        escapedIdempotencyValue,
      ).rejects.toMatchObject({ code: "55000" });
    }
    const nestedDecoy = structuredClone(revision) as typeof revision & {
      provenanceIndex: typeof revision.provenanceIndex & { decoy?: { revisionId: string } };
    };
    const indexedDecoyRevisionId = `drv_${"a".repeat(64)}`;
    nestedDecoy.revisionId = `drv_${"b".repeat(64)}`;
    nestedDecoy.provenanceIndex.decoy = { revisionId: indexedDecoyRevisionId };
    await expect(
      runtime.query(
        "INSERT INTO ai_ark_m05.revisions(revision_id,generation_fingerprint,input_fingerprint,output_fingerprint,record_fingerprint,canonical_payload) VALUES($1,$2,$3,$4,$5,$6)",
        [
          indexedDecoyRevisionId,
          "c".repeat(64),
          candidate.inputFingerprint,
          revision.outputFingerprint,
          "d".repeat(64),
          Buffer.from(JSON.stringify(nestedDecoy)),
        ],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      runtime.query(
        "INSERT INTO ai_ark_m05.revisions(revision_id,generation_fingerprint,input_fingerprint,output_fingerprint,record_fingerprint,canonical_payload) VALUES($1,$2,$3,$4,$5,$6)",
        [
          `drv_${"e".repeat(64)}`,
          "f".repeat(64),
          candidate.inputFingerprint,
          revision.outputFingerprint,
          "1".repeat(64),
          Buffer.from("{"),
        ],
      ),
    ).rejects.toBeDefined();
    await expect(
      runtime.query("UPDATE ai_ark_m05.requests SET result_sha256=$1", ["0".repeat(64)]),
    ).rejects.toMatchObject({ code: "42501" });
    for (const sql of [
      "DELETE FROM ai_ark_m05.requests",
      "TRUNCATE ai_ark_m05.requests",
      "ALTER TABLE ai_ark_m05.requests OWNER TO ai_ark_m05_login",
      "CREATE TRIGGER forbidden_trigger BEFORE INSERT ON ai_ark_m05.requests FOR EACH ROW EXECUTE FUNCTION ai_ark_m05.m05_validate_request_closure()",
    ])
      await expect(runtime.query(sql), sql).rejects.toMatchObject({ code: "42501" });
    for (const functionName of [
      "m05_reject_immutable_mutation",
      "m05_validate_input_chunk",
      "m05_validate_input_closure",
      "m05_validate_request_closure",
      "m05_validate_revision_closure",
    ])
      await expect(
        runtime.query(`SELECT ai_ark_m05.${functionName}()`),
        functionName,
      ).rejects.toMatchObject({ code: "42501" });
    await expect(
      runtime.query("CREATE TABLE ai_ark_m05.forbidden(id integer)"),
    ).rejects.toMatchObject({ code: "42501" });
    await ownerPool.query("CREATE SCHEMA m05_reference_probe");
    await ownerPool.query("CREATE TABLE m05_reference_probe.child(input_fingerprint text)");
    await ownerPool.query("ALTER TABLE m05_reference_probe.child OWNER TO ai_ark_m05_login");
    await ownerPool.query("GRANT USAGE ON SCHEMA m05_reference_probe TO ai_ark_m05_login");
    await expect(
      runtime.query(
        "ALTER TABLE m05_reference_probe.child ADD CONSTRAINT forbidden_reference FOREIGN KEY (input_fingerprint) REFERENCES ai_ark_m05.inputs(input_fingerprint)",
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await ownerPool.query("DROP SCHEMA m05_reference_probe CASCADE");
    await expect(
      runtime.query(
        `INSERT INTO ai_ark_m05.inputs(input_fingerprint,source_fingerprint,policy_fingerprint,binding_id,extraction_id,byte_length,chunk_count,canonical_manifest,manifest_sha256)
         VALUES($1,$1,$1,$2,$3,1,1,'{}',encode(pg_catalog.sha256(convert_to('{}','UTF8')),'hex'))`,
        ["0".repeat(64), `bnd_${"0".repeat(64)}`, `ext_${"0".repeat(64)}`],
      ),
    ).rejects.toBeDefined();
    await expect(
      runtime.query(
        "INSERT INTO ai_ark_m05.input_chunks(input_fingerprint,ordinal,payload,payload_sha256) VALUES($1,0,'x',encode(pg_catalog.sha256(convert_to('x','UTF8')),'hex'))",
        ["1".repeat(64)],
      ),
    ).rejects.toBeDefined();
    await expect(
      runtime.query(
        "INSERT INTO ai_ark_m05.revisions(revision_id,generation_fingerprint,input_fingerprint,output_fingerprint,record_fingerprint,canonical_payload) VALUES($1,$2,$3,$4,$5,'{}')",
        [`drv_${"2".repeat(64)}`, "3".repeat(64), "4".repeat(64), "5".repeat(64), "6".repeat(64)],
      ),
    ).rejects.toBeDefined();
    await expect(
      runtime.query(
        "INSERT INTO ai_ark_m05.requests(encoded_key,request_fingerprint,semantic_request_fingerprint,canonical_request,generation_fingerprint,revision_id,canonical_result,result_sha256) VALUES('61',$1,$1,'{}',$2,$3,'{}',$1)",
        ["7".repeat(64), "8".repeat(64), `drv_${"9".repeat(64)}`],
      ),
    ).rejects.toBeDefined();

    await ownerPool.query("GRANT CREATE ON SCHEMA ai_ark_m05 TO PUBLIC");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE CREATE ON SCHEMA ai_ark_m05 FROM PUBLIC");

    await ownerPool.query("GRANT SELECT ON ai_ark_m05.requests TO PUBLIC");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE SELECT ON ai_ark_m05.requests FROM PUBLIC");

    await ownerPool.query("CREATE ROLE ai_ark_m05_hostile NOLOGIN");
    await ownerPool.query("GRANT SELECT ON ai_ark_m05.requests TO ai_ark_m05_hostile");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE SELECT ON ai_ark_m05.requests FROM ai_ark_m05_hostile");
    await ownerPool.query("DROP ROLE ai_ark_m05_hostile");

    await ownerPool.query("GRANT UPDATE ON ai_ark_m05.requests TO ai_ark_m05_login");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE UPDATE ON ai_ark_m05.requests FROM ai_ark_m05_login");

    await ownerPool.query("GRANT ai_ark_m04_runtime TO ai_ark_m05_login");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE ai_ark_m04_runtime FROM ai_ark_m05_login");

    await ownerPool.query("GRANT ai_ark_m05_writer TO ai_ark_m04_login");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE ai_ark_m05_writer FROM ai_ark_m04_login");

    await ownerPool.query("CREATE ROLE ai_ark_m05_membership_bridge NOLOGIN");
    await ownerPool.query("GRANT ai_ark_m05_writer TO ai_ark_m05_membership_bridge");
    await ownerPool.query("GRANT ai_ark_m05_membership_bridge TO ai_ark_m04_login");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE ai_ark_m05_membership_bridge FROM ai_ark_m04_login");
    await ownerPool.query("REVOKE ai_ark_m05_writer FROM ai_ark_m05_membership_bridge");
    await ownerPool.query("DROP ROLE ai_ark_m05_membership_bridge");

    await ownerPool.query("ALTER ROLE ai_ark_m04_login CREATEROLE");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("ALTER ROLE ai_ark_m04_login NOCREATEROLE");

    await ownerPool.query("GRANT SELECT ON public.m04_binding_requests TO ai_ark_m05_login");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("REVOKE SELECT ON public.m04_binding_requests FROM ai_ark_m05_login");

    await ownerPool.query("ALTER DEFAULT PRIVILEGES GRANT SELECT ON TABLES TO PUBLIC");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("ALTER DEFAULT PRIVILEGES REVOKE SELECT ON TABLES FROM PUBLIC");

    await expect(
      PostgresDraftPersistenceAdapterV1.open(runtime, {
        ...adapterOptions(),
        migrationOwnerOid: String(Number(migrationOwnerOid) + 1),
      }),
    ).rejects.toThrow("M05_DATABASE_ROLE_AUTHORITY_DRIFT");

    await ownerPool.query("ALTER TABLE ai_ark_m05.requests ENABLE ROW LEVEL SECURITY");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DISABLE ROW LEVEL SECURITY");

    for (const [createSql, dropSql] of [
      [
        "CREATE VIEW ai_ark_m05.hostile_view AS SELECT 1 hostile",
        "DROP VIEW ai_ark_m05.hostile_view",
      ],
      ["CREATE SEQUENCE ai_ark_m05.hostile_sequence", "DROP SEQUENCE ai_ark_m05.hostile_sequence"],
      [
        "CREATE INDEX hostile_index ON ai_ark_m05.requests(request_fingerprint)",
        "DROP INDEX ai_ark_m05.hostile_index",
      ],
    ] as const satisfies readonly (readonly [string, string])[]) {
      await ownerPool.query(createSql);
      await expect(
        PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions()),
      ).rejects.toThrow("M05_DATABASE_ROLE_AUTHORITY_DRIFT");
      await ownerPool.query(dropSql);
    }

    await ownerPool.query(
      'ALTER TABLE ai_ark_m05.requests ALTER COLUMN encoded_key TYPE text COLLATE "default"',
    );
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query(
      'ALTER TABLE ai_ark_m05.requests ALTER COLUMN encoded_key TYPE text COLLATE "C"',
    );

    await ownerPool.query(
      "CREATE FUNCTION ai_ark_m05.hostile_trigger() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END'",
    );
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("DROP FUNCTION ai_ark_m05.hostile_trigger()");

    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DISABLE TRIGGER requests_closure");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests ENABLE TRIGGER requests_closure");

    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.requests ADD CONSTRAINT hostile_check CHECK (true)",
    );
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DROP CONSTRAINT hostile_check");

    await ownerPool.query("CREATE ROLE ai_ark_m05_coordinated_owner NOLOGIN");
    for (const relation of ["input_chunks", "inputs", "requests", "revisions"])
      await ownerPool.query(
        `ALTER TABLE ai_ark_m05.${relation} OWNER TO ai_ark_m05_coordinated_owner`,
      );
    for (const functionName of [
      "m05_reject_immutable_mutation",
      "m05_validate_input_chunk",
      "m05_validate_input_closure",
      "m05_validate_request_closure",
      "m05_validate_revision_closure",
    ])
      await ownerPool.query(
        `ALTER FUNCTION ai_ark_m05.${functionName}() OWNER TO ai_ark_m05_coordinated_owner`,
      );
    await ownerPool.query("ALTER SCHEMA ai_ark_m05 OWNER TO ai_ark_m05_coordinated_owner");
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    const quotedMigrationOwner = `"${migrationOwnerRole.replaceAll('"', '""')}"`;
    for (const relation of ["input_chunks", "inputs", "requests", "revisions"])
      await ownerPool.query(`ALTER TABLE ai_ark_m05.${relation} OWNER TO ${quotedMigrationOwner}`);
    for (const functionName of [
      "m05_reject_immutable_mutation",
      "m05_validate_input_chunk",
      "m05_validate_input_closure",
      "m05_validate_request_closure",
      "m05_validate_revision_closure",
    ])
      await ownerPool.query(
        `ALTER FUNCTION ai_ark_m05.${functionName}() OWNER TO ${quotedMigrationOwner}`,
      );
    await ownerPool.query(`ALTER SCHEMA ai_ark_m05 OWNER TO ${quotedMigrationOwner}`);
    await ownerPool.query("DROP ROLE ai_ark_m05_coordinated_owner");

    const storedChunks = (
      await ownerPool.query<{ ordinal: number; payload: Buffer; payload_sha256: string }>(
        "SELECT ordinal,payload,payload_sha256 FROM ai_ark_m05.input_chunks WHERE input_fingerprint=$1 ORDER BY ordinal",
        [candidate.inputFingerprint],
      )
    ).rows;
    expect(storedChunks.length).toBeGreaterThan(1);
    const lastChunk = storedChunks.at(-1);
    if (lastChunk === undefined) throw new Error("M05_LAST_CHUNK_MISSING");
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET ordinal=$1 WHERE input_fingerprint=$2 AND ordinal=$3",
      [lastChunk.ordinal + 1, candidate.inputFingerprint, lastChunk.ordinal],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_immutable",
    );
    await expect(reopened.readRevision(revisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET ordinal=$1 WHERE input_fingerprint=$2 AND ordinal=$3",
      [lastChunk.ordinal, candidate.inputFingerprint, lastChunk.ordinal + 1],
    );
    await ownerPool.query(
      "DELETE FROM ai_ark_m05.input_chunks WHERE input_fingerprint=$1 AND ordinal=$2",
      [candidate.inputFingerprint, lastChunk.ordinal],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_immutable",
    );
    await expect(reopened.readRevision(revisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    await ownerPool.query(
      "INSERT INTO ai_ark_m05.input_chunks(input_fingerprint,ordinal,payload,payload_sha256) VALUES($1,$2,$3,$4)",
      [candidate.inputFingerprint, lastChunk.ordinal, lastChunk.payload, lastChunk.payload_sha256],
    );
    const [firstChunk, secondChunk] = storedChunks;
    if (firstChunk === undefined || secondChunk === undefined)
      throw new Error("M05_CHUNK_PAIR_MISSING");
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET payload=$1,payload_sha256=$2 WHERE input_fingerprint=$3 AND ordinal=$4",
      [
        secondChunk.payload,
        secondChunk.payload_sha256,
        candidate.inputFingerprint,
        firstChunk.ordinal,
      ],
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET payload=$1,payload_sha256=$2 WHERE input_fingerprint=$3 AND ordinal=$4",
      [
        firstChunk.payload,
        firstChunk.payload_sha256,
        candidate.inputFingerprint,
        secondChunk.ordinal,
      ],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_immutable",
    );
    await expect(reopened.readRevision(revisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET payload=$1,payload_sha256=$2 WHERE input_fingerprint=$3 AND ordinal=$4",
      [
        firstChunk.payload,
        firstChunk.payload_sha256,
        candidate.inputFingerprint,
        firstChunk.ordinal,
      ],
    );
    await ownerPool.query(
      "UPDATE ai_ark_m05.input_chunks SET payload=$1,payload_sha256=$2 WHERE input_fingerprint=$3 AND ordinal=$4",
      [
        secondChunk.payload,
        secondChunk.payload_sha256,
        candidate.inputFingerprint,
        secondChunk.ordinal,
      ],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_validate",
    );
    await ownerPool.query(
      "INSERT INTO ai_ark_m05.input_chunks(input_fingerprint,ordinal,payload,payload_sha256) VALUES($1,$2,$3,$4)",
      [
        candidate.inputFingerprint,
        lastChunk.ordinal + 1,
        lastChunk.payload,
        lastChunk.payload_sha256,
      ],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_validate",
    );
    await expect(reopened.readRevision(revisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks DISABLE TRIGGER input_chunks_immutable",
    );
    await ownerPool.query(
      "DELETE FROM ai_ark_m05.input_chunks WHERE input_fingerprint=$1 AND ordinal=$2",
      [candidate.inputFingerprint, lastChunk.ordinal + 1],
    );
    await ownerPool.query(
      "ALTER TABLE ai_ark_m05.input_chunks ENABLE TRIGGER input_chunks_immutable",
    );

    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DISABLE TRIGGER requests_immutable");
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DISABLE TRIGGER requests_closure");
    await ownerPool.query("UPDATE ai_ark_m05.requests SET result_sha256=$1 WHERE encoded_key=$2", [
      "0".repeat(64),
      Buffer.from(alias.idempotencyKey, "utf8").toString("hex"),
    ]);
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests ENABLE TRIGGER requests_closure");
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests ENABLE TRIGGER requests_immutable");
    await expect(
      reopened.associateAlias({ ...request, idempotencyKey: "later-alias" }, revision),
    ).rejects.toThrow("M05_PERSISTENCE_INTEGRITY_FAILED");

    await ownerPool.query("ALTER TABLE ai_ark_m05.requests DISABLE TRIGGER requests_immutable");
    await ownerPool.query("DELETE FROM ai_ark_m05.requests WHERE revision_id=$1", [
      regeneratedRevisionId,
    ]);
    await ownerPool.query("ALTER TABLE ai_ark_m05.requests ENABLE TRIGGER requests_immutable");
    await expect(reopened.readRevision(regeneratedRevisionId)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );

    await ownerPool.query(`CREATE OR REPLACE FUNCTION ai_ark_m05.m05_validate_request_closure()
      RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS 'BEGIN RETURN NULL; END'`);
    await expect(PostgresDraftPersistenceAdapterV1.open(runtime, adapterOptions())).rejects.toThrow(
      "M05_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
  }, 120_000);
});
