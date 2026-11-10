import { M05_SECTION_KEYS, encodeM04IdempotencyKeyForDatabase } from "@ai-ark/contracts";
import type { GenerateDraftRequestV1 } from "@ai-ark/contracts";
import {
  DraftGenerationServiceV1,
  StaticDraftPolicyRegistryV1,
  type DraftPersistenceCandidateV1,
  type DraftPersistencePortV1,
} from "@ai-ark/draft-generation";
import { PostgresDraftPersistenceAdapterV1 } from "@ai-ark/job-queue";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript CLI module is exercised directly by this integration test.
import { migrate } from "../../../scripts/db-migrate.mjs";
import { createM04CompleteBundleFixture } from "./m04-combined-maximum-fixture.js";
import {
  createM05EligibleSnapshotFixture,
  createM05SnapshotFromBundleFixture,
} from "./m05-genuine-snapshot-fixture.js";
import { EphemeralPostgresHarness } from "./postgres-harness.js";

const harness = new EphemeralPostgresHarness();
let adapter: PostgresDraftPersistenceAdapterV1;
let ownerPool: Pool;
let migrationOwnerRole: string;
let migrationOwnerOid: string;
const adapterOptions = () => ({
  loginRole: "ai_ark_m05_login",
  migrationOwnerRole,
  migrationOwnerOid,
  predecessorLoginRoles: ["ai_ark_m04_login", "ai_ark_m01_m02_login"] as const,
  trustedProviderConfigs: [providerConfig],
});
const providerConfig = {
  providerConfigId: "collision-provider-v1",
  provider: "collision-provider",
  model: "collision-model",
  configurationRevision: "revision-1",
  selectionProfile: "M05_SELECTION_ONLY_V1" as const,
};

function invokeQuery(target: object, args: readonly unknown[]): unknown {
  const query: unknown = Reflect.get(target, "query", target);
  if (typeof query !== "function") throw new Error("M05_QUERY_SEAM_MISSING");
  return Reflect.apply(query, target, args);
}

function boundMember(target: object, property: PropertyKey): unknown {
  const value: unknown = Reflect.get(target, property, target);
  return typeof value === "function" ? value.bind(target) : value;
}

function withQueryValues(input: unknown, values: readonly unknown[]): object {
  if (input === null || typeof input !== "object") throw new Error("M05_QUERY_CONFIG_INVALID");
  return { ...input, values };
}

function orderedLockBarrierPool(
  runtimePool: Pool,
  lockNeedle: string,
): { readonly pool: Pool; readonly serializationFailures: () => number } {
  let connectionOrdinal = 0;
  let barrierOpen = false;
  let observedSerializationFailures = 0;
  const pendingLocks: {
    readonly connectionOrdinal: number;
    readonly run: () => Promise<unknown>;
    readonly resolve: (value: unknown) => void;
    readonly reject: (reason?: unknown) => void;
  }[] = [];
  const pool = {
    connect: async () => {
      const currentConnectionOrdinal = connectionOrdinal;
      connectionOrdinal += 1;
      const client = await runtimePool.connect();
      return new Proxy(client, {
        get(target, property) {
          if (property === "query")
            return (...args: unknown[]) => {
              const input = args[0];
              const sql =
                typeof input === "string"
                  ? input
                  : typeof input === "object" && input !== null && "text" in input
                    ? String(input.text)
                    : "";
              const values =
                typeof input === "object" && input !== null && "values" in input
                  ? ((input as { values?: readonly unknown[] }).values ?? [])
                  : ((args[1] as readonly unknown[] | undefined) ?? []);
              const run = () =>
                Promise.resolve(invokeQuery(target, args)).catch((error: unknown) => {
                  if (
                    error !== null &&
                    typeof error === "object" &&
                    "code" in error &&
                    error.code === "40001"
                  )
                    observedSerializationFailures += 1;
                  throw error;
                });
              if (!barrierOpen && sql.includes("pg_advisory_xact_lock") && values[0] === lockNeedle)
                return new Promise((resolve, reject) => {
                  pendingLocks.push({
                    connectionOrdinal: currentConnectionOrdinal,
                    run,
                    resolve,
                    reject,
                  });
                  if (pendingLocks.length === 2) {
                    barrierOpen = true;
                    pendingLocks.sort(
                      (left, right) => left.connectionOrdinal - right.connectionOrdinal,
                    );
                    const [designatedWinner, waiter] = pendingLocks;
                    if (designatedWinner === undefined || waiter === undefined)
                      throw new Error("M05_LOCK_BARRIER_INVALID");
                    designatedWinner.run().then(
                      (value) => {
                        designatedWinner.resolve(value);
                        waiter.run().then(waiter.resolve, waiter.reject);
                      },
                      (error: unknown) => {
                        designatedWinner.reject(error);
                        waiter.run().then(waiter.resolve, waiter.reject);
                      },
                    );
                  }
                });
              return run();
            };
          return boundMember(target, property);
        },
      });
    },
  } as unknown as Pool;
  return {
    pool,
    serializationFailures: () => observedSerializationFailures,
  };
}

async function captureCandidate(
  request: GenerateDraftRequestV1,
  snapshot: Awaited<ReturnType<typeof createM05EligibleSnapshotFixture>>,
  providerSelection: "all" | "mandatory" = "all",
): Promise<DraftPersistenceCandidateV1> {
  let candidate: DraftPersistenceCandidateV1 | undefined;
  const persistence: DraftPersistencePortV1 = {
    findByRequest: () => Promise.resolve(undefined),
    findBySemanticRequest: () => Promise.resolve(undefined),
    associateAlias: () => Promise.reject(new Error("unexpected alias")),
    persistAccepted: (value) => {
      candidate = structuredClone(value);
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
    persistence,
    request.mode === "AI_ASSISTED" ? new StaticDraftPolicyRegistryV1([providerConfig]) : undefined,
    request.mode === "AI_ASSISTED"
      ? {
          compose: (input) =>
            Promise.resolve({
              outputBytes: Buffer.from(
                JSON.stringify({
                  schemaVersion: "M05_COMPOSITION_V1",
                  selections: M05_SECTION_KEYS.map((sectionKey) => ({
                    sectionKey,
                    atomIds: input.catalog
                      .filter(
                        (entry) =>
                          entry.sectionKey === sectionKey &&
                          (providerSelection === "all" || entry.mandatory),
                      )
                      .map(({ atomId }) => atomId),
                  })),
                }),
              ),
              inputTokensOrNull: 1,
              outputTokensOrNull: 1,
            }),
        }
      : undefined,
    () => new Date("2026-01-01T00:00:00.000Z"),
  );
  const result = await service.generate(Buffer.from(JSON.stringify(request)));
  if (result.kind !== "ACCEPTED" || candidate === undefined)
    throw new Error(`M05_CAPTURE_FAILED:${result.kind}`);
  return candidate;
}

describe("M05 PostgreSQL first-winner concurrency", () => {
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
    const sentinel = "m05-concurrency-sentinel-0001";
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

  it("rejects invalid or duplicate trusted provider configs and snapshots caller-owned authority", async () => {
    const runtimePool = harness.poolForRole("ai_ark_m05_login");
    await expect(
      PostgresDraftPersistenceAdapterV1.open(runtimePool, {
        ...adapterOptions(),
        trustedProviderConfigs: [providerConfig, { ...providerConfig, model: "conflicting-model" }],
      }),
    ).rejects.toThrow("M05_AUTHORITY_INVALID");
    await expect(
      PostgresDraftPersistenceAdapterV1.open(runtimePool, {
        ...adapterOptions(),
        trustedProviderConfigs: [
          { ...providerConfig, selectionProfile: "INVALID_SELECTION_PROFILE" as never },
        ],
      }),
    ).rejects.toBeDefined();

    const mutableConfig = { ...providerConfig };
    const isolated = await PostgresDraftPersistenceAdapterV1.open(runtimePool, {
      ...adapterOptions(),
      trustedProviderConfigs: [mutableConfig],
    });
    mutableConfig.model = "mutated-after-open";
    const snapshot = await createM05SnapshotFromBundleFixture(
      await createM04CompleteBundleFixture(63),
    );
    const request: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "trusted-config-copy",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
      mode: "AI_ASSISTED",
      regenerationToken: "trusted-config-copy-generation",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: providerConfig.providerConfigId,
    };
    const candidate = await captureCandidate(request, snapshot);
    await expect(isolated.persistAccepted(candidate)).resolves.toEqual(candidate.revision);
    mutableConfig.configurationRevision = "mutated-again";
    await expect(isolated.persistAccepted(candidate)).resolves.toEqual(candidate.revision);
    await expect(isolated.findByRequest(request)).resolves.toEqual(candidate.revision);
  }, 120_000);

  it.each([
    ["all-first", "all", "mandatory", 71],
    ["mandatory-first", "mandatory", "all", 72],
  ] as const)(
    "adopts the actual PostgreSQL same-generation first writer with a fresh 40001 retry: %s",
    async (_name, firstSelection, secondSelection, fixtureOrdinal) => {
      const snapshot = await createM05SnapshotFromBundleFixture(
        await createM04CompleteBundleFixture(fixtureOrdinal),
      );
      const base: GenerateDraftRequestV1 = {
        schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
        idempotencyKey: `pg-barrier-${String(fixtureOrdinal)}-a`,
        bindingId: snapshot.acceptedResultRecord.bindingId,
        extractionId: snapshot.bundle.extractionId,
        expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
        mode: "AI_ASSISTED",
        regenerationToken: `pg-barrier-generation-${String(fixtureOrdinal)}`,
        policyVersion: "m05-draft-policy-v1",
        methodologyVersion: "m05-draft-methodology-v1",
        promptBundleVersion: "m05-draft-prompt-v1",
        providerConfigIdOrNull: providerConfig.providerConfigId,
      };
      const first = await captureCandidate(base, snapshot, firstSelection);
      const second = await captureCandidate(
        { ...base, idempotencyKey: `pg-barrier-${String(fixtureOrdinal)}-b` },
        snapshot,
        secondSelection,
      );
      expect(first.revision.outputFingerprint).not.toBe(second.revision.outputFingerprint);
      const runtimePool = harness.poolForRole("ai_ark_m05_login");
      const lockNeedle = `M05_GENERATION:${first.generationFingerprint}`;
      const barrier = orderedLockBarrierPool(runtimePool, lockNeedle);
      const barrierAdapter = await PostgresDraftPersistenceAdapterV1.open(
        barrier.pool,
        adapterOptions(),
      );
      const [firstResult, secondResult] = await Promise.all([
        barrierAdapter.persistAcceptedWithDisposition(first),
        barrierAdapter.persistAcceptedWithDisposition(second),
      ]);
      expect(firstResult).toEqual({ revision: first.revision, replayed: false });
      expect(secondResult).toEqual({ revision: first.revision, replayed: true });
      expect(barrier.serializationFailures()).toBe(1);
      const counts = (
        await ownerPool.query<{ revisions: string; requests: string }>(
          `SELECT
             (SELECT count(*)::text FROM ai_ark_m05.revisions WHERE generation_fingerprint=$1) revisions,
             (SELECT count(*)::text FROM ai_ark_m05.requests WHERE generation_fingerprint=$1) requests`,
          [first.generationFingerprint],
        )
      ).rows[0];
      expect(counts).toEqual({ revisions: "1", requests: "2" });
    },
    120_000,
  );

  it.each([
    ["generation-a-first", "generation-a", "generation-b", 73],
    ["generation-b-first", "generation-b", "generation-a", 74],
  ] as const)(
    "rejects the actual PostgreSQL same-key different-generation waiter after a fresh 40001 retry: %s",
    async (_name, firstToken, secondToken, fixtureOrdinal) => {
      const snapshot = await createM05SnapshotFromBundleFixture(
        await createM04CompleteBundleFixture(fixtureOrdinal),
      );
      const idempotencyKey = `pg-key-barrier-${String(fixtureOrdinal)}`;
      const base: GenerateDraftRequestV1 = {
        schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
        idempotencyKey,
        bindingId: snapshot.acceptedResultRecord.bindingId,
        extractionId: snapshot.bundle.extractionId,
        expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
        mode: "DETERMINISTIC",
        regenerationToken: firstToken,
        policyVersion: "m05-draft-policy-v1",
        methodologyVersion: "m05-draft-methodology-v1",
        promptBundleVersion: "m05-draft-prompt-v1",
        providerConfigIdOrNull: null,
      };
      const first = await captureCandidate(base, snapshot);
      const second = await captureCandidate({ ...base, regenerationToken: secondToken }, snapshot);
      const runtimePool = harness.poolForRole("ai_ark_m05_login");
      const lockNeedle = `M05_KEY:${encodeM04IdempotencyKeyForDatabase(idempotencyKey)}`;
      const barrier = orderedLockBarrierPool(runtimePool, lockNeedle);
      const barrierAdapter = await PostgresDraftPersistenceAdapterV1.open(
        barrier.pool,
        adapterOptions(),
      );
      const [firstResult, secondResult] = await Promise.allSettled([
        barrierAdapter.persistAccepted(first),
        barrierAdapter.persistAccepted(second),
      ]);
      expect(firstResult).toEqual({ status: "fulfilled", value: first.revision });
      expect(secondResult.status).toBe("rejected");
      if (secondResult.status === "rejected")
        expect(secondResult.reason).toEqual(
          expect.objectContaining({ message: "M05_IDEMPOTENCY_KEY_REUSED" }),
        );
      expect(barrier.serializationFailures()).toBe(1);
      const counts = (
        await ownerPool.query<{
          first_revisions: string;
          second_revisions: string;
          requests: string;
        }>(
          `SELECT
             (SELECT count(*)::text FROM ai_ark_m05.revisions WHERE generation_fingerprint=$1) first_revisions,
             (SELECT count(*)::text FROM ai_ark_m05.revisions WHERE generation_fingerprint=$2) second_revisions,
             (SELECT count(*)::text FROM ai_ark_m05.requests WHERE encoded_key=$3) requests`,
          [
            first.generationFingerprint,
            second.generationFingerprint,
            encodeM04IdempotencyKeyForDatabase(idempotencyKey),
          ],
        )
      ).rows[0];
      expect(counts).toEqual({ first_revisions: "1", second_revisions: "0", requests: "1" });
    },
    120_000,
  );

  it("serializes same-key and same-generation races while preserving explicit regeneration", async () => {
    const snapshot = await createM05EligibleSnapshotFixture();
    const base: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "concurrent-base",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "concurrent-generation-1",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const capture = (targetRequest: GenerateDraftRequestV1, targetSnapshot = snapshot) =>
      captureCandidate(targetRequest, targetSnapshot);

    const firstA = await capture({
      ...base,
      idempotencyKey: "concurrent-first-a",
      regenerationToken: "concurrent-first-generation-a",
    });
    const firstB = await capture({
      ...base,
      idempotencyKey: "concurrent-first-b",
      regenerationToken: "concurrent-first-generation-b",
    });
    const firstWriters = await Promise.all([
      adapter.persistAccepted(firstA),
      adapter.persistAccepted(firstB),
    ]);
    expect(firstWriters[0].revisionId).not.toBe(firstWriters[1].revisionId);

    const inverseSnapshot = await createM05SnapshotFromBundleFixture(
      await createM04CompleteBundleFixture(8),
    );
    const inverseBase: GenerateDraftRequestV1 = {
      ...base,
      bindingId: inverseSnapshot.acceptedResultRecord.bindingId,
      extractionId: inverseSnapshot.bundle.extractionId,
      expectedBindingFingerprint: inverseSnapshot.acceptedResultRecord.bindingId.slice(4),
    };
    const inverseA = await capture(
      {
        ...inverseBase,
        idempotencyKey: "concurrent-inverse-a",
        regenerationToken: "concurrent-inverse-generation-a",
      },
      inverseSnapshot,
    );
    const inverseB = await capture(
      {
        ...inverseBase,
        idempotencyKey: "concurrent-inverse-b",
        regenerationToken: "concurrent-inverse-generation-b",
      },
      inverseSnapshot,
    );
    const inverseWriters = await Promise.all([
      adapter.persistAccepted(inverseB),
      adapter.persistAccepted(inverseA),
    ]);
    expect(inverseWriters[0].revisionId).not.toBe(inverseWriters[1].revisionId);

    const same = await capture(base);
    const sameKey = await Promise.all([
      adapter.persistAccepted(same),
      adapter.persistAccepted(same),
    ]);
    expect(sameKey[0]).toEqual(sameKey[1]);

    const aliases = await Promise.all([
      adapter.persistAccepted(await capture({ ...base, idempotencyKey: "concurrent-alias-a" })),
      adapter.persistAccepted(await capture({ ...base, idempotencyKey: "concurrent-alias-b" })),
    ]);
    expect(aliases[0]).toEqual(aliases[1]);

    const conflictingKey = "concurrent-regeneration-key";
    const generationA = await capture({
      ...base,
      idempotencyKey: conflictingKey,
      regenerationToken: "concurrent-generation-a",
    });
    const generationB = await capture({
      ...base,
      idempotencyKey: conflictingKey,
      regenerationToken: "concurrent-generation-b",
    });
    const conflict = await Promise.allSettled([
      adapter.persistAccepted(generationA),
      adapter.persistAccepted(generationB),
    ]);
    expect(conflict.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(conflict.filter(({ status }) => status === "rejected")).toHaveLength(1);

    const regenerated = await adapter.persistAccepted(
      await capture({
        ...base,
        idempotencyKey: "concurrent-regenerated",
        regenerationToken: "concurrent-generation-c",
      }),
    );
    expect(regenerated.revisionId).not.toBe(same.revision.revisionId);
  }, 120_000);

  it("rejects a forced same-generation digest collision before adding a request association", async () => {
    const snapshot = await createM05EligibleSnapshotFixture();
    const base: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "collision-incumbent",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "collision-generation-a",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const incumbent = await captureCandidate(base, snapshot);
    await adapter.persistAccepted(incumbent);
    const colliding = await captureCandidate(
      {
        ...base,
        idempotencyKey: "collision-candidate",
        regenerationToken: "collision-generation-b",
      },
      snapshot,
    );
    const runtimePool = harness.poolForRole("ai_ark_m05_login");
    const collisionPool = {
      connect: async () => {
        const client = await runtimePool.connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === "query")
              return (input: unknown, values?: readonly unknown[]) => {
                const text =
                  typeof input === "string"
                    ? input
                    : typeof input === "object" && input !== null && "text" in input
                      ? String(input.text)
                      : "";
                const originalValues =
                  typeof input === "object" && input !== null && "values" in input
                    ? ((input as { values?: readonly unknown[] }).values ?? [])
                    : (values ?? []);
                if (
                  text.includes("generation_fingerprint=$1") &&
                  originalValues[0] === colliding.generationFingerprint &&
                  text.includes("requests")
                ) {
                  const replacement = [incumbent.generationFingerprint, ...originalValues.slice(1)];
                  return Promise.resolve(
                    typeof input === "string"
                      ? invokeQuery(target, [input, replacement])
                      : invokeQuery(target, [withQueryValues(input, replacement)]),
                  );
                }
                return Promise.resolve(
                  typeof input === "string"
                    ? invokeQuery(target, [input, values])
                    : invokeQuery(target, [input]),
                );
              };
            return boundMember(target, property);
          },
        });
      },
    } as unknown as Pool;
    const collisionAdapter = await PostgresDraftPersistenceAdapterV1.open(
      collisionPool,
      adapterOptions(),
    );
    const before = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [incumbent.revision.revisionId],
    );
    await expect(collisionAdapter.persistAccepted(colliding)).rejects.toThrow(
      "M05_CONTENT_HASH_COLLISION",
    );
    const after = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [incumbent.revision.revisionId],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
    await expect(adapter.findByRequest(base)).resolves.toEqual(incumbent.revision);
  }, 120_000);

  it.each([
    ["output_fingerprint", "outputFingerprint"],
    ["revision_id", "revisionId"],
    ["record_fingerprint", "recordFingerprint"],
  ] as const)(
    "rejects a forced %s alternate-identity collision before association",
    async (column, member) => {
      const snapshot = await createM05EligibleSnapshotFixture();
      const base: GenerateDraftRequestV1 = {
        schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
        idempotencyKey: `alternate-${column}-incumbent`,
        bindingId: snapshot.acceptedResultRecord.bindingId,
        extractionId: snapshot.bundle.extractionId,
        expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
        mode: "AI_ASSISTED",
        regenerationToken: `alternate-${column}-generation-a`,
        policyVersion: "m05-draft-policy-v1",
        methodologyVersion: "m05-draft-methodology-v1",
        promptBundleVersion: "m05-draft-prompt-v1",
        providerConfigIdOrNull: providerConfig.providerConfigId,
      };
      const incumbent = await captureCandidate(base, snapshot, "all");
      await adapter.persistAccepted(incumbent);
      const candidateRequest: GenerateDraftRequestV1 = {
        ...base,
        idempotencyKey: `alternate-${column}-candidate`,
        regenerationToken: `alternate-${column}-generation-b`,
      };
      const candidate = await captureCandidate(candidateRequest, snapshot, "mandatory");
      expect(candidate.revision.outputFingerprint).not.toBe(incumbent.revision.outputFingerprint);
      const runtimePool = harness.poolForRole("ai_ark_m05_login");
      const forcedPool = {
        connect: async () => {
          const client = await runtimePool.connect();
          return new Proxy(client, {
            get(target, property) {
              if (property === "query")
                return (input: unknown, values?: readonly unknown[]) => {
                  const text =
                    typeof input === "string"
                      ? input
                      : typeof input === "object" && input !== null && "text" in input
                        ? String(input.text)
                        : "";
                  const originalValues =
                    typeof input === "object" && input !== null && "values" in input
                      ? ((input as { values?: readonly unknown[] }).values ?? [])
                      : (values ?? []);
                  const replacementValues =
                    text.includes(`${column}=$1`) &&
                    originalValues[0] === candidate.revision[member]
                      ? [incumbent.revision[member], ...originalValues.slice(1)]
                      : originalValues;
                  return Promise.resolve(
                    typeof input === "string"
                      ? invokeQuery(target, [input, replacementValues])
                      : invokeQuery(target, [withQueryValues(input, replacementValues)]),
                  );
                };
              return boundMember(target, property);
            },
          });
        },
      } as unknown as Pool;
      const forcedAdapter = await PostgresDraftPersistenceAdapterV1.open(
        forcedPool,
        adapterOptions(),
      );
      const before = await ownerPool.query<{ count: string }>(
        "SELECT count(*)::text count FROM ai_ark_m05.requests",
      );
      await expect(forcedAdapter.persistAccepted(candidate)).rejects.toThrow(
        "M05_CONTENT_HASH_COLLISION",
      );
      const after = await ownerPool.query<{ count: string }>(
        "SELECT count(*)::text count FROM ai_ark_m05.requests",
      );
      expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
      await expect(adapter.findByRequest(base)).resolves.toEqual(incumbent.revision);
      await expect(adapter.findByRequest(candidateRequest)).resolves.toBeUndefined();
    },
    120_000,
  );

  it("rolls back every write stage and bounds serialization and deadlock retries", async () => {
    const runtimePool = harness.poolForRole("ai_ark_m05_login");
    let armed:
      | { readonly needle: string; readonly codes: readonly (string | undefined)[]; hit: number }
      | undefined;
    const faultPool = {
      connect: async () => {
        const client = await runtimePool.connect();
        return new Proxy(client, {
          get(target, property) {
            if (property === "query")
              return (...args: unknown[]) => {
                const first = args[0];
                const sql =
                  typeof first === "string"
                    ? first
                    : typeof first === "object" && first !== null && "text" in first
                      ? String(first.text)
                      : "";
                if (
                  armed !== undefined &&
                  sql.includes(armed.needle) &&
                  armed.hit < armed.codes.length
                ) {
                  const code = armed.codes[armed.hit];
                  armed.hit += 1;
                  throw Object.assign(new Error("fixture injected database fault"), { code });
                }
                return Promise.resolve(invokeQuery(target, args));
              };
            return boundMember(target, property);
          },
        });
      },
    } as unknown as Pool;
    const faultAdapter = await PostgresDraftPersistenceAdapterV1.open(faultPool, adapterOptions());
    const candidate = async (ordinal: number) => {
      const snapshot = await createM05SnapshotFromBundleFixture(
        await createM04CompleteBundleFixture(20 + ordinal),
      );
      return captureCandidate(
        {
          schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
          idempotencyKey: `fault-key-${String(ordinal)}`,
          bindingId: snapshot.acceptedResultRecord.bindingId,
          extractionId: snapshot.bundle.extractionId,
          expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
          mode: "DETERMINISTIC",
          regenerationToken: `fault-generation-${String(ordinal)}`,
          policyVersion: "m05-draft-policy-v1",
          methodologyVersion: "m05-draft-methodology-v1",
          promptBundleVersion: "m05-draft-prompt-v1",
          providerConfigIdOrNull: null,
        },
        snapshot,
      );
    };
    let ordinal = 0;
    for (const needle of [
      ".inputs(input_fingerprint",
      ".input_chunks(input_fingerprint",
      ".revisions(revision_id",
      ".requests(encoded_key",
    ]) {
      const target = await candidate((ordinal += 1));
      armed = { needle, codes: [undefined], hit: 0 };
      await expect(faultAdapter.persistAccepted(target), needle).rejects.toThrow(
        "fixture injected database fault",
      );
      expect(armed.hit).toBe(1);
      const counts = (
        await ownerPool.query<{ inputs: string; revisions: string; requests: string }>(
          `SELECT
             (SELECT count(*)::text FROM ai_ark_m05.inputs WHERE input_fingerprint=$1) inputs,
             (SELECT count(*)::text FROM ai_ark_m05.revisions WHERE revision_id=$2) revisions,
             (SELECT count(*)::text FROM ai_ark_m05.requests WHERE revision_id=$2) requests`,
          [target.inputFingerprint, target.revision.revisionId],
        )
      ).rows[0];
      expect(counts).toEqual({ inputs: "0", revisions: "0", requests: "0" });
    }

    const uniqueViolation = await candidate((ordinal += 1));
    armed = { needle: ".revisions(revision_id", codes: ["23505"], hit: 0 };
    await expect(faultAdapter.persistAccepted(uniqueViolation)).rejects.toThrow(
      "M05_PERSISTENCE_INTEGRITY_FAILED",
    );
    expect(armed.hit).toBe(1);
    const uniqueViolationRows = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [uniqueViolation.revision.revisionId],
    );
    expect(uniqueViolationRows.rows[0]?.count).toBe("0");

    const retried = await candidate((ordinal += 1));
    armed = {
      needle: ".revisions(revision_id",
      codes: ["40001", "40P01"],
      hit: 0,
    };
    await expect(faultAdapter.persistAccepted(retried)).resolves.toEqual(retried.revision);
    expect(armed.hit).toBe(2);

    const exhausted = await candidate((ordinal += 1));
    armed = {
      needle: ".revisions(revision_id",
      codes: ["40001", "40001", "40001"],
      hit: 0,
    };
    await expect(faultAdapter.persistAccepted(exhausted)).rejects.toThrow(
      "M05_SERIALIZATION_RETRY_EXHAUSTED",
    );
    expect(armed.hit).toBe(3);
    const exhaustedRows = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.inputs WHERE input_fingerprint=$1",
      [exhausted.inputFingerprint],
    );
    expect(exhaustedRows.rows[0]?.count).toBe("0");

    armed = undefined;
    const aliasBase = await candidate(ordinal + 1);
    const aliasRevision = await faultAdapter.persistAccepted(aliasBase);
    let connectionAttempts = 0;
    const priorConnect = faultPool.connect.bind(faultPool);
    faultPool.connect = async () => {
      connectionAttempts += 1;
      return priorConnect();
    };
    for (const [suffix, codes] of [
      ["first-retry", ["40001"]],
      ["second-retry", ["40001", "40P01"]],
    ] as const) {
      const before = connectionAttempts;
      armed = { needle: ".requests(encoded_key", codes, hit: 0 };
      await expect(
        faultAdapter.associateAlias(
          { ...aliasBase.request, idempotencyKey: `alias-${suffix}` },
          aliasRevision,
        ),
      ).resolves.toEqual(aliasRevision);
      expect(armed.hit).toBe(codes.length);
      expect(connectionAttempts - before).toBe(codes.length + 1);
    }
    const countBeforeFailures = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [aliasRevision.revisionId],
    );
    armed = { needle: ".requests(encoded_key", codes: ["40001", "40P01", "40001"], hit: 0 };
    await expect(
      faultAdapter.associateAlias(
        { ...aliasBase.request, idempotencyKey: "alias-exhausted" },
        aliasRevision,
      ),
    ).rejects.toThrow("M05_SERIALIZATION_RETRY_EXHAUSTED");
    expect(armed.hit).toBe(3);
    armed = { needle: ".requests(encoded_key", codes: [undefined], hit: 0 };
    await expect(
      faultAdapter.associateAlias(
        { ...aliasBase.request, idempotencyKey: "alias-nonretryable" },
        aliasRevision,
      ),
    ).rejects.toThrow("fixture injected database fault");
    expect(armed.hit).toBe(1);
    const countAfterFailures = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [aliasRevision.revisionId],
    );
    expect(countAfterFailures.rows[0]?.count).toBe(countBeforeFailures.rows[0]?.count);
  }, 120_000);

  it("validates many semantic aliases sequentially in one read snapshot while aliases arrive", async () => {
    const snapshot = await createM05SnapshotFromBundleFixture(
      await createM04CompleteBundleFixture(40),
    );
    const request: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "many-aliases-base",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: snapshot.acceptedResultRecord.bindingId.slice(4),
      mode: "DETERMINISTIC",
      regenerationToken: "many-aliases-generation",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const candidate = await captureCandidate(request, snapshot);
    const revision = await adapter.persistAccepted(candidate);
    for (let index = 0; index < 64; index += 1)
      await adapter.associateAlias(
        { ...request, idempotencyKey: `many-aliases-retained-${String(index)}` },
        revision,
      );
    for (let index = 0; index < 8; index += 1) {
      const arriving = {
        ...request,
        idempotencyKey: `many-aliases-arriving-${String(index)}`,
      };
      const [read, alias] = await Promise.all([
        adapter.readRevision(revision.revisionId),
        adapter.associateAlias(arriving, revision),
      ]);
      expect(read).toEqual(revision);
      expect(alias).toEqual(revision);
    }
    await expect(adapter.readRevision(revision.revisionId)).resolves.toEqual(revision);
    const count = await ownerPool.query<{ count: string }>(
      "SELECT count(*)::text count FROM ai_ark_m05.requests WHERE revision_id=$1",
      [revision.revisionId],
    );
    expect(count.rows[0]?.count).toBe("73");
  }, 120_000);
});
