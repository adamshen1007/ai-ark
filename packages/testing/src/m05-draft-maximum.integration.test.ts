import type { GenerateDraftRequestV1 } from "@ai-ark/contracts";
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
import { createM05MaximumSnapshotFixture } from "./m05-genuine-snapshot-fixture.js";
import { EphemeralPostgresHarness } from "./postgres-harness.js";

const harness = new EphemeralPostgresHarness();
let owner: Pool;
let adapter: PostgresDraftPersistenceAdapterV1;
let migrationOwnerRole: string;
let migrationOwnerOid: string;
let snapshot: Awaited<ReturnType<typeof createM05MaximumSnapshotFixture>>;
let candidate: DraftPersistenceCandidateV1;
let request: GenerateDraftRequestV1;
let restoredRuntime: Pool | undefined;

const adapterOptions = () => ({
  loginRole: "ai_ark_m05_login",
  migrationOwnerRole,
  migrationOwnerOid,
  predecessorLoginRoles: ["ai_ark_m04_login", "ai_ark_m01_m02_login"] as const,
});

describe("M05 durable combined maximum", { concurrent: false }, () => {
  beforeAll(async () => {
    owner = await harness.start();
    const database = (await owner.query<{ current_database: string }>("SELECT current_database()"))
      .rows[0]?.current_database;
    if (database === undefined || !/^[A-Za-z0-9_]+$/u.test(database))
      throw new Error("M05_FIXTURE_DATABASE_INVALID");
    const principal = (
      await owner.query<{ oid: string; role_name: string }>(
        "SELECT oid::text,current_user role_name FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (principal === undefined) throw new Error("M05_MIGRATION_OWNER_FIXTURE_INVALID");
    migrationOwnerRole = principal.role_name;
    migrationOwnerOid = principal.oid;
    const sentinel = "m05-maximum-sentinel-0001";
    await owner.query(`COMMENT ON DATABASE ${database} IS 'ai-ark-m04-disposable:${sentinel}'`);
    const url = new URL(harness.connectionUri());
    await migrate({
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
    });
    adapter = await PostgresDraftPersistenceAdapterV1.open(
      harness.poolForRole("ai_ark_m05_login"),
      adapterOptions(),
    );
  }, 120_000);

  afterAll(async () => {
    await restoredRuntime?.end();
    await harness.stop();
  });

  it("reconstructs the full maximum accepted source closure", async () => {
    snapshot = await createM05MaximumSnapshotFixture();
    expect(snapshot.evidenceItems).toHaveLength(4_096);
    expect(snapshot.claims).toHaveLength(20);
    expect(snapshot.links).toHaveLength(81_920);
  }, 240_000);

  it("projects the full maximum into one validated persistence candidate", async () => {
    request = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "durable-maximum-key",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "durable-maximum-generation",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const capture: DraftPersistencePortV1 = {
      findByRequest: () => Promise.resolve(undefined),
      findBySemanticRequest: () => Promise.resolve(undefined),
      associateAlias: () => Promise.reject(new Error("M05_MAXIMUM_ALIAS_UNEXPECTED")),
      persistAccepted: (value) => {
        candidate = value;
        return Promise.resolve(value.revision);
      },
      readRevision: () => Promise.resolve(undefined),
    };
    const service = new DraftGenerationServiceV1(
      {
        readAcceptedBinding: () =>
          Promise.resolve({
            kind: "FOUND",
            snapshot: structuredClone(snapshot),
          }),
      },
      capture,
      undefined,
      undefined,
      () => new Date("2026-01-01T00:00:00.000Z"),
    );
    await expect(service.generate(Buffer.from(JSON.stringify(request)))).resolves.toMatchObject({
      kind: "ACCEPTED",
      replayed: false,
    });
    expect(candidate.revision.provenanceIndex.claimBindings).toHaveLength(20);
  }, 240_000);

  it("persists the complete maximum input and provenance under the actual LOGIN", async () => {
    const revision = await adapter.persistAccepted(candidate);
    expect(revision.revisionId).toBe(candidate.revision.revisionId);
    const counts = await owner.query<{
      inputs: string;
      chunks: string;
      revisions: string;
      requests: string;
    }>(`SELECT
      (SELECT count(*)::text FROM ai_ark_m05.inputs) inputs,
      (SELECT count(*)::text FROM ai_ark_m05.input_chunks) chunks,
      (SELECT count(*)::text FROM ai_ark_m05.revisions) revisions,
      (SELECT count(*)::text FROM ai_ark_m05.requests) requests`);
    expect(counts.rows[0]).toMatchObject({ inputs: "1", revisions: "1", requests: "1" });
    expect(Number(counts.rows[0]?.chunks)).toBeGreaterThan(1);
  }, 240_000);

  it("reopens and validates the complete maximum without live source access", async () => {
    const reopened = await PostgresDraftPersistenceAdapterV1.open(
      harness.poolForRole("ai_ark_m05_login"),
      adapterOptions(),
    );
    await expect(reopened.findByRequest(request)).resolves.toEqual(candidate.revision);
    await expect(reopened.readRevision(candidate.revision.revisionId)).resolves.toEqual(
      candidate.revision,
    );
  }, 240_000);

  it("restores a database backup and replays the complete maximum", async () => {
    const sourceUrl = new URL(harness.connectionUri());
    const sourceDatabase = sourceUrl.pathname.slice(1);
    const restoreDatabase = "m05_maximum_restore";
    await owner.query(`CREATE DATABASE ${restoreDatabase}`);
    const dumpPath = "/tmp/ai-ark-m05-maximum.dump";
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
    await harness.execInContainer(["rm", "-f", dumpPath]);
    restoredRuntime = new Pool({
      connectionString: harness.connectionUriForRole("ai_ark_m05_login", restoreDatabase),
      max: 2,
    });
    const restored = await PostgresDraftPersistenceAdapterV1.open(
      restoredRuntime,
      adapterOptions(),
    );
    await expect(restored.readRevision(candidate.revision.revisionId)).resolves.toEqual(
      candidate.revision,
    );
  }, 240_000);
});
