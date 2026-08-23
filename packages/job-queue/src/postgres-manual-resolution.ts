import {
  allocateM02Id,
  canonicalOrderedTargetIds,
  compareUtf8,
  materializeCommandMutationPlan,
  validateManualResolutionEnvelope,
  type CommandMutationPlanV1,
  type PlannedTypedRow,
} from "./m02-human-command-plan.js";
import {
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  type CanonicalM02Value,
} from "@ai-ark/classification";
import {
  ManualResolutionError,
  type ManualResolutionEnvelope,
  type ManualResolutionResult,
} from "@ai-ark/identity";
import type { Pool, PoolClient } from "pg";

import {
  deriveCanonicalGuardIdentities,
  discoverHumanProjectionMode,
  invalidatedReplacementScopes,
  validateReplacementTransition,
  type CanonicalGuardIdentity,
} from "./m02-human-projectors.js";
import { buildReviewFamilyIntents, lockTypedRows, persistTypedCommand } from "./m02-typed-state.js";

export type { ManualResolutionEnvelope, ManualResolutionResult } from "@ai-ark/identity";

export interface PostgresManualResolutionOptions {
  readonly schema?: string;
  readonly serializationRetries?: number;
  readonly onAttemptOpened?: (attempt: number) => void | Promise<void>;
  readonly onRetry?: (attempt: number, error: unknown) => void | Promise<void>;
  readonly onUniqueViolation?: (evidence: {
    readonly constraint?: string;
    readonly detail?: string;
    readonly table?: string;
  }) => void;
  /** Read-only verification hook; receives the authoritative locked plan before SQL writes. */
  readonly onPlanFinalized?: (plan: CommandMutationPlanV1) => void;
}

interface StoredCommandRow {
  readonly request_fingerprint: string;
  readonly result_payload: ManualResolutionResult | null;
}

interface CommandPreflight {
  readonly requiredKeys: readonly string[];
  readonly guards: readonly CanonicalGuardIdentity[];
  readonly rejectionCommand: ManualResolutionEnvelope;
  readonly executionCommand: ManualResolutionEnvelope;
  readonly resultId: string;
  readonly auditBase: string;
  readonly expansionId: string;
  readonly plan: CommandMutationPlanV1;
  readonly replay?: ManualResolutionResult;
}

function requiredReplacementRoot<T>(roots: readonly T[], index: number): T {
  const root = roots[index];
  if (root === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  return root;
}

const ROW_TABLES = new Set([
  "acquisition_jobs",
  "candidate_roots",
  "duplicate_candidates",
  "fork_relationships",
  "identity_decisions",
  "m02_clarification_requests",
  "m02_identity_handoff_markers",
  "m02_jobs",
  "m02_review_states",
  "repository_candidate_groups",
  "resource_candidates",
  "resource_identities",
  "resource_source_links",
  "resource_version_identities",
  "source_repository_identities",
  "source_repository_relationships",
]);

function selectedCommand(command: ManualResolutionEnvelope): string {
  return command.command === "RESOLVE_AMBIGUITY"
    ? (command.payload.selectedCommand ?? command.command)
    : command.command;
}

function parseRowKey(key: string): { readonly table: string; readonly id: string } | undefined {
  if (!key.startsWith("row:")) return undefined;
  const [, table, ...idParts] = key.split(":");
  if (table === undefined || !ROW_TABLES.has(table)) return undefined;
  return { table, id: idParts.join(":") };
}

function assertSchema(schema: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(schema)) {
    throw new ManualResolutionError("REFERENCE_INVALID");
  }
  return schema;
}

function commandFingerprint(command: ManualResolutionEnvelope): string {
  return fingerprintM02Payload(command as unknown as CanonicalM02Value);
}

function isSerializationFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: string }).code === "40001"
  );
}

interface UniqueViolationEvidence {
  readonly code: "23505";
  readonly constraint?: string;
  readonly detail?: string;
  readonly table?: string;
}

function isUniqueViolation(error: unknown): error is UniqueViolationEvidence {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: string }).code === "23505"
  );
}

type FailedCanonicalIdentity =
  | { readonly kind: "GUARD"; readonly guard: CanonicalGuardIdentity }
  | { readonly kind: "TYPED_CREATE"; readonly planned: PlannedTypedRow };

function parsedUniqueKey(detail: string | undefined): readonly string[] | undefined {
  const matched = (detail ?? "")
    .matchAll(/^Key \(([^)]+)\)=\((.*)\) already exists\.$/gu)
    .next().value;
  if (matched === undefined) return undefined;
  const columns = (matched[1] ?? "").split(", ");
  if (columns.length === 0) return undefined;
  return columns;
}

function uniqueDetailMatches(
  detail: string | undefined,
  columns: readonly string[],
  values: readonly unknown[],
): boolean {
  return (
    detail === `Key (${columns.join(", ")})=(${values.map(String).join(", ")}) already exists.`
  );
}

function failedCanonicalUniqueIdentity(
  failedUnique: UniqueViolationEvidence,
  command: ManualResolutionEnvelope,
  preflight: CommandPreflight,
): FailedCanonicalIdentity | undefined {
  const key = parsedUniqueKey(failedUnique.detail);
  if (key === undefined || failedUnique.constraint === undefined) return undefined;
  const failedConstraint = failedUnique.constraint;
  if (
    failedUnique.table === "m02_concurrency_guards" ||
    failedConstraint.startsWith("m02_concurrency_guards_")
  ) {
    const matches = preflight.guards.filter(
      (guard) =>
        command.expectedVersions[guard.key] === null &&
        ((key.join(",") === "guard_key" &&
          uniqueDetailMatches(failedUnique.detail, ["guard_key"], [guard.key])) ||
          (key.join(",") === "guard_type,payload_hash" &&
            uniqueDetailMatches(
              failedUnique.detail,
              ["guard_type", "payload_hash"],
              [guard.guardType, guard.payloadHash],
            ))),
    );
    const match = matches.at(0);
    return matches.length === 1 && match !== undefined
      ? { kind: "GUARD", guard: match }
      : undefined;
  }
  const naturalColumns: Readonly<Record<string, readonly string[]>> = {
    resource_version_identities: ["resource_identity_id", "content_fingerprint"],
    source_repository_identities: ["provider", "provider_repository_id"],
    resource_source_links: ["source_repository_id", "normalized_root_path"],
    resource_version_observations: [
      "resource_version_identity_id",
      "source_snapshot_id",
      "candidate_root_id",
      "resource_source_link_id",
    ],
  };
  const table =
    failedUnique.table ??
    Object.keys(naturalColumns).find(
      (candidate) =>
        (candidate === "resource_source_links" &&
          failedConstraint === "resource_source_links_one_active_binding") ||
        failedConstraint.startsWith(`${candidate}_`),
    ) ??
    "";
  const columns = naturalColumns[table];
  if (
    columns === undefined ||
    !failedConstraint.startsWith(`${table}_`) ||
    JSON.stringify([...key].sort(compareUtf8)) !== JSON.stringify([...columns].sort(compareUtf8))
  )
    return undefined;
  const matches = preflight.plan.domainMutationPlan.creates.filter(
    (planned) =>
      planned.table === table &&
      uniqueDetailMatches(
        failedUnique.detail,
        key,
        key.map((column) => planned.completeTypedValues[column]),
      ),
  );
  const match = matches.at(0);
  return matches.length === 1 && match !== undefined
    ? { kind: "TYPED_CREATE", planned: match }
    : undefined;
}

function canonicalConflictValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString("hex")}`;
  if (Array.isArray(value)) return value.map(canonicalConflictValue);
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, canonicalConflictValue(nested)]),
    );
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value))
    return new Date(value).toISOString();
  return typeof value === "bigint" ? Number(value) : value;
}

function canonicalConflictEqual(left: unknown, right: unknown): boolean {
  return Buffer.from(
    canonicalM02JsonBytes(canonicalConflictValue(left) as CanonicalM02Value),
  ).equals(Buffer.from(canonicalM02JsonBytes(canonicalConflictValue(right) as CanonicalM02Value)));
}

function isCanonicalRecord(
  value: CanonicalM02Value,
): value is Readonly<Record<string, CanonicalM02Value>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NON_CANONICAL_CONFLICT_COLUMNS = new Set([
  "id",
  "created_at",
  "observed_at",
  "command_id",
  "result_id",
  "audit_event_id",
  "origin_type",
  "system_operation_id",
  "system_result_id",
  "record_version",
]);

function exactCanonicalConflictPayload(
  stored: Readonly<Record<string, unknown>>,
  planned: PlannedTypedRow,
): boolean {
  return Object.entries(planned.completeTypedValues)
    .filter(([key]) => !NON_CANONICAL_CONFLICT_COLUMNS.has(key))
    .every(([key, value]) => canonicalConflictEqual(stored[key], value));
}

interface TypedRequirements {
  readonly command: ManualResolutionEnvelope;
  readonly requiredKeys: readonly string[];
  readonly guards: readonly CanonicalGuardIdentity[];
}

function typedResultFromPlanInputs(
  command: ManualResolutionEnvelope,
  executionCommand: ManualResolutionEnvelope,
  requiredKeys: readonly string[],
  guards: readonly CanonicalGuardIdentity[],
  intents: {
    readonly creates: readonly PlannedTypedRow[];
    readonly updates: readonly PlannedTypedRow[];
    readonly supersedes: readonly PlannedTypedRow[];
  },
): ManualResolutionResult {
  const recordVersions: Record<string, number> = {};
  for (const guard of guards)
    recordVersions[guard.key] = (command.expectedVersions[guard.key] ?? 0) + 1;
  for (const row of [...intents.creates, ...intents.updates, ...intents.supersedes]) {
    const version = row.completeTypedValues.record_version;
    if (typeof version === "number") recordVersions[`row:${row.table}:${row.id}`] = version;
  }
  const reused = requiredKeys.flatMap((key) => {
    if (!key.startsWith("row:") || command.expectedVersions[key] === null) return [];
    const parsed = parseRowKey(key);
    return parsed === undefined ? [] : [parsed.id];
  });
  const orderedTargetIds = canonicalOrderedTargetIds({
    created: intents.creates.map(({ id }) => id),
    reused,
    updated: intents.updates.map(({ id }) => id),
    superseded: intents.supersedes.map(({ id }) => id),
  });
  return {
    commandId: executionCommand.commandId,
    requestId: executionCommand.requestId,
    orderedTargetIds,
    recordVersions,
    lockOrder: [...requiredKeys].sort(compareUtf8),
    transactionIsolation: "SERIALIZABLE",
  };
}

function durableError(error: unknown): ManualResolutionError {
  if (error instanceof ManualResolutionError) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: string }).code === "23505"
  ) {
    return new ManualResolutionError("PHANTOM_CONFLICT");
  }
  const mapped = new ManualResolutionError("TRANSITION_PROHIBITED");
  mapped.cause = error;
  return mapped;
}

export class PostgresManualResolutionAdapter {
  private readonly schema: string;
  private readonly serializationRetries: number;
  private readonly onAttemptOpened: ((attempt: number) => void | Promise<void>) | undefined;
  private readonly onRetry: ((attempt: number, error: unknown) => void | Promise<void>) | undefined;
  private readonly onUniqueViolation:
    ((evidence: { constraint?: string; detail?: string; table?: string }) => void) | undefined;
  private readonly onPlanFinalized: ((plan: CommandMutationPlanV1) => void) | undefined;

  constructor(
    private readonly pool: Pool,
    options: PostgresManualResolutionOptions = {},
  ) {
    this.schema = assertSchema(options.schema ?? "public");
    this.serializationRetries = options.serializationRetries ?? 2;
    this.onAttemptOpened = options.onAttemptOpened;
    this.onRetry = options.onRetry;
    this.onUniqueViolation = options.onUniqueViolation;
    this.onPlanFinalized = options.onPlanFinalized;
  }

  async execute(command: ManualResolutionEnvelope): Promise<ManualResolutionResult> {
    validateManualResolutionEnvelope(command);
    const fingerprint = commandFingerprint(command);
    let attemptCount = 0;
    while (attemptCount <= this.serializationRetries) {
      let attemptedPreflight: CommandPreflight | undefined;
      let bestKnownRejectionCommand = command;
      try {
        const preflight = await this.preflight(command, fingerprint, (discovered) => {
          bestKnownRejectionCommand = discovered;
        });
        attemptedPreflight = preflight;
        if (preflight.replay !== undefined) return preflight.replay;
        attemptCount += 1;
        await this.onAttemptOpened?.(attemptCount);
        return await this.executeAttempt(command, fingerprint, preflight);
      } catch (error) {
        if (isUniqueViolation(error))
          this.onUniqueViolation?.({
            ...(error.constraint === undefined ? {} : { constraint: error.constraint }),
            ...(error.detail === undefined ? {} : { detail: error.detail }),
            ...(error.table === undefined ? {} : { table: error.table }),
          });
        const uniqueClassification = isUniqueViolation(error)
          ? await this.classifyUniqueConflictAfterRollback(
              command,
              fingerprint,
              attemptedPreflight,
              error,
            )
          : undefined;
        const serializationClassification = isSerializationFailure(error)
          ? await this.classifyExpectedVersionsAfterRollback(command, attemptedPreflight)
          : undefined;
        if (
          (isSerializationFailure(error) && serializationClassification === undefined) ||
          uniqueClassification === "RETRY"
        ) {
          if (attemptCount <= this.serializationRetries) {
            await this.onRetry?.(attemptCount, error);
            continue;
          }
          const exhausted = new ManualResolutionError("SERIALIZATION_RETRY_EXHAUSTED");
          await this.persistRejection(
            attemptedPreflight?.rejectionCommand ?? bestKnownRejectionCommand,
            fingerprint,
            exhausted.code,
          );
          throw exhausted;
        }
        const mapped = serializationClassification ?? uniqueClassification ?? durableError(error);
        await this.persistRejection(
          attemptedPreflight?.rejectionCommand ?? bestKnownRejectionCommand,
          fingerprint,
          mapped.code,
        );
        throw mapped;
      }
    }
    throw new ManualResolutionError("SERIALIZATION_RETRY_EXHAUSTED");
  }

  private async classifyUniqueConflictAfterRollback(
    command: ManualResolutionEnvelope,
    fingerprint: string,
    preflight: CommandPreflight | undefined,
    failedUnique: UniqueViolationEvidence,
  ): Promise<"RETRY" | ManualResolutionError> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${this.schema}"`);
      const accepted = await client.query<StoredCommandRow>(
        `SELECT request_fingerprint,result_payload
         FROM manual_resolution_commands
         WHERE idempotency_scope='M02' AND idempotency_key=$1`,
        [command.idempotencyKey],
      );
      const acceptedRow = accepted.rows[0];
      if (acceptedRow !== undefined) {
        if (acceptedRow.request_fingerprint !== fingerprint)
          return new ManualResolutionError("IDEMPOTENCY_KEY_REUSED");
        if (acceptedRow.result_payload === null)
          return new ManualResolutionError("PHANTOM_CONFLICT");
        return "RETRY";
      }
      if (preflight === undefined) return new ManualResolutionError("PHANTOM_CONFLICT");
      const failedIdentity = failedCanonicalUniqueIdentity(failedUnique, command, preflight);
      if (failedIdentity === undefined) return new ManualResolutionError("PHANTOM_CONFLICT");
      if (failedIdentity.kind === "GUARD") {
        const guard = failedIdentity.guard;
        const stored = await client.query<{
          canonical_payload: Buffer;
          guard_key: string;
          guard_type: string;
          payload_hash: string;
        }>(
          `SELECT guard_key,guard_type,canonical_payload,payload_hash
           FROM m02_concurrency_guards
           WHERE guard_key=$1 OR (guard_type=$2 AND payload_hash=$3)`,
          [guard.key, guard.guardType, guard.payloadHash],
        );
        const row = stored.rows[0];
        if (row === undefined) return new ManualResolutionError("PHANTOM_CONFLICT");
        if (
          row.guard_key !== guard.key ||
          row.guard_type !== guard.guardType ||
          row.payload_hash !== guard.payloadHash ||
          !row.canonical_payload.equals(Buffer.from(guard.canonicalPayload))
        )
          return new ManualResolutionError("CONCURRENCY_GUARD_COLLISION");
        return new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      }
      {
        const planned = failedIdentity.planned;
        const values = planned.completeTypedValues;
        const lookup =
          planned.table === "resource_version_identities"
            ? {
                sql: `SELECT to_jsonb(row_value) AS value FROM resource_version_identities row_value
                      WHERE resource_identity_id=$1 AND content_fingerprint=$2`,
                values: [values.resource_identity_id, values.content_fingerprint],
              }
            : planned.table === "source_repository_identities"
              ? {
                  sql: `SELECT to_jsonb(row_value) AS value FROM source_repository_identities row_value
                        WHERE provider=$1 AND provider_repository_id=$2`,
                  values: [values.provider, values.provider_repository_id],
                }
              : planned.table === "resource_source_links"
                ? {
                    sql: `SELECT to_jsonb(row_value) AS value FROM resource_source_links row_value
                          WHERE source_repository_id=$1 AND normalized_root_path=$2 AND state='ACTIVE'`,
                    values: [values.source_repository_id, values.normalized_root_path],
                  }
                : planned.table === "resource_version_observations"
                  ? {
                      sql: `SELECT to_jsonb(row_value) AS value FROM resource_version_observations row_value
                            WHERE resource_version_identity_id=$1 AND source_snapshot_id=$2
                              AND candidate_root_id=$3 AND resource_source_link_id=$4`,
                      values: [
                        values.resource_version_identity_id,
                        values.source_snapshot_id,
                        values.candidate_root_id,
                        values.resource_source_link_id,
                      ],
                    }
                  : undefined;
        if (lookup === undefined) return new ManualResolutionError("PHANTOM_CONFLICT");
        const stored = await client.query<{ value: Readonly<Record<string, unknown>> }>(
          lookup.sql,
          lookup.values,
        );
        const row = stored.rows[0]?.value;
        if (row === undefined) return new ManualResolutionError("PHANTOM_CONFLICT");
        return exactCanonicalConflictPayload(row, planned)
          ? new ManualResolutionError("EXPECTED_VERSION_SET_INVALID")
          : new ManualResolutionError("FINGERPRINT_COLLISION");
      }
    } finally {
      client.release();
    }
  }

  private async classifyExpectedVersionsAfterRollback(
    command: ManualResolutionEnvelope,
    preflight: CommandPreflight | undefined,
  ): Promise<ManualResolutionError | undefined> {
    if (preflight === undefined) return undefined;
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${this.schema}"`);
      try {
        await this.assertExpectedVersions(client, command, preflight.requiredKeys);
        return undefined;
      } catch (error) {
        return error instanceof ManualResolutionError ? error : durableError(error);
      }
    } finally {
      client.release();
    }
  }

  async discoverRequiredCurrentExpectations(
    command: ManualResolutionEnvelope,
  ): Promise<Readonly<Record<string, number | null>>> {
    validateManualResolutionEnvelope(command);
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${this.schema}"`);
      const { requiredKeys } = await this.deriveTypedRequirements(client, command);
      return Object.fromEntries(
        await Promise.all(
          requiredKeys.map(async (key) => {
            if (key.startsWith("guard:")) {
              const row = await client.query<{ record_version: string }>(
                "SELECT record_version FROM m02_concurrency_guards WHERE guard_key=$1",
                [key],
              );
              return [
                key,
                row.rows[0] === undefined ? null : Number(row.rows[0].record_version),
              ] as const;
            }
            if (key.startsWith("row:")) {
              const parsed = parseRowKey(key);
              if (parsed === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
              const row = await client.query<{ record_version: string }>(
                `SELECT record_version FROM ${parsed.table} WHERE id=$1`,
                [parsed.id],
              );
              return [
                key,
                row.rows[0] === undefined ? null : Number(row.rows[0].record_version),
              ] as const;
            }
            throw new ManualResolutionError("REFERENCE_INVALID");
          }),
        ),
      );
    } finally {
      client.release();
    }
  }

  private async executeAttempt(
    command: ManualResolutionEnvelope,
    fingerprint: string,
    preflight: CommandPreflight,
  ): Promise<ManualResolutionResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query(`SET LOCAL search_path TO "${this.schema}"`);

      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `m02:idempotency:M02:${command.idempotencyKey}`,
      ]);

      const replay = await client.query<StoredCommandRow>(
        `SELECT request_fingerprint, result_payload
         FROM manual_resolution_commands
         WHERE idempotency_scope = 'M02' AND idempotency_key = $1`,
        [command.idempotencyKey],
      );
      const stored = replay.rows[0];
      if (stored !== undefined) {
        if (stored.request_fingerprint !== fingerprint) {
          throw new ManualResolutionError("IDEMPOTENCY_KEY_REUSED");
        }
        if (stored.result_payload === null) {
          throw new ManualResolutionError("PHANTOM_CONFLICT");
        }
        await client.query("COMMIT");
        return stored.result_payload;
      }

      await this.lockRequiredKeysInCanonicalOrder(client, preflight.requiredKeys);

      const lockedRequirements = await this.deriveTypedRequirements(client, command);
      const lockedMode = await discoverHumanProjectionMode(
        client,
        command,
        lockedRequirements.guards,
      );
      const typedIntents = await buildReviewFamilyIntents(
        client,
        preflight.executionCommand,
        preflight.resultId,
        preflight.auditBase,
        lockedMode.expansionId,
      );
      const result = typedResultFromPlanInputs(
        command,
        preflight.executionCommand,
        lockedRequirements.requiredKeys,
        lockedRequirements.guards,
        typedIntents,
      );
      const lockedPlan = materializeCommandMutationPlan(
        command,
        preflight.executionCommand,
        lockedMode.expansionId,
        lockedRequirements.guards,
        lockedRequirements.requiredKeys,
        result,
        preflight.resultId,
        preflight.auditBase,
        typedIntents,
      );
      if (
        JSON.stringify(preflight.requiredKeys) !==
          JSON.stringify(lockedRequirements.requiredKeys) ||
        JSON.stringify(preflight.guards.map(({ key }) => key)) !==
          JSON.stringify(lockedRequirements.guards.map(({ key }) => key)) ||
        preflight.expansionId !== lockedMode.expansionId ||
        preflight.plan.fingerprint !== lockedPlan.fingerprint
      ) {
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      }
      await this.assertExpectedVersions(client, command, preflight.requiredKeys);
      // Observers receive an isolated evidence copy and cannot mutate the executing plan.
      this.onPlanFinalized?.(structuredClone(lockedPlan));
      await this.persistResult(
        client,
        command,
        preflight.executionCommand,
        fingerprint,
        result,
        lockedRequirements.guards,
        preflight.resultId,
        preflight.auditBase,
        lockedPlan,
        lockedMode.expansionId,
      );
      await this.assertTypedPlanPostconditions(client, lockedPlan);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async preflight(
    command: ManualResolutionEnvelope,
    fingerprint: string,
    captureRejectionCommand: (command: ManualResolutionEnvelope) => void,
  ): Promise<CommandPreflight> {
    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO "${this.schema}"`);
      const replay = await client.query<StoredCommandRow>(
        `SELECT request_fingerprint, result_payload
         FROM manual_resolution_commands
         WHERE idempotency_scope = 'M02' AND idempotency_key = $1`,
        [command.idempotencyKey],
      );
      const stored = replay.rows[0];
      if (stored !== undefined) {
        if (stored.request_fingerprint !== fingerprint)
          throw new ManualResolutionError("IDEMPOTENCY_KEY_REUSED");
        if (stored.result_payload === null) throw new ManualResolutionError("PHANTOM_CONFLICT");
        return {
          requiredKeys: [],
          guards: [],
          rejectionCommand: command,
          executionCommand: command,
          resultId: "",
          auditBase: "",
          expansionId: "",
          plan: {
            schemaVersion: "CommandMutationPlanV1",
            concurrencyPlan: {
              schemaVersion: "1",
              expansionId: "",
              guardPlan: [],
              callerExpectedVersions: {},
              requiredCurrentExpectations: {},
              existingTypedRows: [],
            },
            domainMutationPlan: {
              allocatedIds: {},
              creates: [],
              updates: [],
              supersedes: [],
              mappings: [],
              result: { table: "m02_manual_command_results", id: "", completeTypedValues: {} },
              audits: [],
              postconditions: [],
            },
            fingerprint: "",
          },
          replay: stored.result_payload,
        };
      }
      const {
        command: logicalCommand,
        requiredKeys,
        guards,
      } = await this.deriveTypedRequirements(client, command, captureRejectionCommand);
      const mode = await discoverHumanProjectionMode(client, logicalCommand, guards);
      await this.assertExpectedVersions(client, command, requiredKeys);
      const executionCommand = await this.allocateExecutionCommand(client, logicalCommand);
      const resultId = allocateM02Id();
      const auditBase = allocateM02Id();
      const typedIntents = await buildReviewFamilyIntents(
        client,
        executionCommand,
        resultId,
        auditBase,
        mode.expansionId,
      );
      const result = typedResultFromPlanInputs(
        command,
        executionCommand,
        requiredKeys,
        guards,
        typedIntents,
      );
      const plan = materializeCommandMutationPlan(
        command,
        executionCommand,
        mode.expansionId,
        guards,
        requiredKeys,
        result,
        resultId,
        auditBase,
        typedIntents,
      );
      return {
        requiredKeys,
        guards,
        rejectionCommand: logicalCommand,
        executionCommand,
        resultId,
        auditBase,
        expansionId: mode.expansionId,
        plan,
      };
    } finally {
      client.release();
    }
  }

  private async assertExpectedVersions(
    client: PoolClient,
    command: ManualResolutionEnvelope,
    requiredKeys: readonly string[],
  ): Promise<void> {
    const callerKeys = Object.keys(command.expectedVersions).sort();
    if (JSON.stringify(callerKeys) !== JSON.stringify([...requiredKeys].sort()))
      throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
    for (const key of requiredKeys) {
      const actual = key.startsWith("guard:")
        ? Number(
            (
              await client.query<{ record_version: string }>(
                "SELECT record_version FROM m02_concurrency_guards WHERE guard_key=$1",
                [key],
              )
            ).rows[0]?.record_version,
          ) || undefined
        : key.startsWith("row:")
          ? await (async () => {
              const parsed = parseRowKey(key);
              if (parsed === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
              const row = await client.query<{ record_version: string }>(
                `SELECT record_version FROM ${parsed.table} WHERE id=$1`,
                [parsed.id],
              );
              return row.rows[0] === undefined ? undefined : Number(row.rows[0].record_version);
            })()
          : undefined;
      const expected = command.expectedVersions[key];
      if (actual === undefined) {
        if (expected !== null) throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      } else if (expected === null) {
        throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      } else if (expected !== actual) {
        throw new ManualResolutionError("STALE_RECORD_VERSION");
      }
    }
  }

  private async allocateExecutionCommand(
    client: PoolClient,
    command: ManualResolutionEnvelope,
  ): Promise<ManualResolutionEnvelope> {
    const payload = { ...command.payload };
    const fresh = (name: string): void => {
      payload[name] = allocateM02Id();
    };
    const selected =
      command.command === "RESOLVE_AMBIGUITY" ? payload.selectedCommand : command.command;
    if (["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(selected ?? "")) {
      const active =
        selected === "MARK_FORK"
          ? await client.query<{ id: string }>(
              "SELECT id FROM fork_relationships WHERE fork_resource_version_id=$1 AND state='ACTIVE'",
              [payload.forkResourceVersionId],
            )
          : selected === "MARK_MIRROR"
            ? await client.query<{ id: string }>(
                "SELECT id FROM source_repository_relationships WHERE mirror_source_repository_id=$1 AND state='ACTIVE'",
                [payload.mirrorSourceRepositoryId],
              )
            : await client.query<{ id: string }>(
                "SELECT id FROM duplicate_candidates WHERE resource_candidate_id=$1 AND status='CONFIRMED'",
                [command.targetCandidateId],
              );
      const activeId = active.rows[0]?.id;
      if (activeId === undefined) delete payload.priorRelationshipId;
      else payload.priorRelationshipId = activeId;
    }
    delete payload.auditId;
    payload.auditIdsJson = "[]";
    if (
      [
        "CREATE_RESOURCE",
        "ATTACH_NEW_VERSION",
        "MARK_FORK",
        "MARK_MIRROR",
        "MARK_DUPLICATE",
      ].includes(selected ?? "")
    )
      fresh("decisionId");
    if (
      ["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_MIRROR"].includes(selected ?? "") ||
      (selected === "MARK_FORK" && payload.priorRelationshipId === undefined)
    )
      fresh("handoffId");
    if (selected === "CREATE_RESOURCE") {
      for (const name of [
        "resourceIdentityId",
        "resourceVersionIdentityId",
        "sourceLinkId",
        "observationId",
      ])
        fresh(name);
    } else if (selected === "ATTACH_NEW_VERSION") {
      const exact = await client.query<{ id: string }>(
        `SELECT id FROM resource_version_identities
         WHERE resource_identity_id=$1 AND content_fingerprint=$2`,
        [payload.resourceIdentityId, payload.contentFingerprint],
      );
      const versionId = exact.rows[0]?.id;
      if (versionId === undefined) {
        const priorLink = await client.query<{ id: string }>(
          `SELECT link.id FROM resource_source_links link
           JOIN source_repository_identities repository ON repository.id=link.source_repository_id
           WHERE repository.provider=$1 AND repository.provider_repository_id=$2
             AND link.normalized_root_path=$3 AND link.target_resource_version_id=$4
             AND link.state='ACTIVE'
           ORDER BY convert_to(link.id,'UTF8')`,
          [
            payload.provider,
            payload.providerRepositoryId,
            payload.normalizedRoot,
            payload.priorResourceVersionIdentityId,
          ],
        );
        const existingPriorLink = priorLink.rows.at(0);
        if (
          priorLink.rows.length !== 1 ||
          existingPriorLink === undefined ||
          (payload.activeSourceLinkId !== undefined &&
            existingPriorLink.id !== payload.activeSourceLinkId)
        )
          throw new ManualResolutionError("TRANSITION_PROHIBITED");
        payload.activeSourceLinkId = existingPriorLink.id;
        payload.resourceVersionIdentityId = allocateM02Id();
        payload.sourceLinkId = allocateM02Id();
      } else {
        payload.resourceVersionIdentityId = versionId;
        const link = await client.query<{ id: string }>(
          `SELECT link.id FROM resource_source_links link
           JOIN source_repository_identities repository ON repository.id=link.source_repository_id
           WHERE repository.provider=$1 AND repository.provider_repository_id=$2
             AND link.normalized_root_path=$3 AND link.target_resource_version_id=$4
             AND link.state='ACTIVE'
           ORDER BY convert_to(link.id,'UTF8')`,
          [
            payload.provider,
            payload.providerRepositoryId,
            payload.normalizedRoot,
            payload.resourceVersionIdentityId,
          ],
        );
        const existingLink = link.rows.at(0);
        if (
          link.rows.length !== 1 ||
          existingLink === undefined ||
          (payload.activeSourceLinkId !== undefined &&
            existingLink.id !== payload.activeSourceLinkId)
        )
          throw new ManualResolutionError("TRANSITION_PROHIBITED");
        payload.activeSourceLinkId = existingLink.id;
        payload.sourceLinkId = existingLink.id;
      }
      const observation = await client.query<{ id: string }>(
        `SELECT id FROM resource_version_observations
         WHERE resource_version_identity_id=$1 AND source_snapshot_id=$2
           AND candidate_root_id=(SELECT candidate_root_id FROM resource_candidates WHERE id=$3)
           AND resource_source_link_id=$4`,
        [
          payload.resourceVersionIdentityId,
          payload.sourceSnapshotId,
          command.targetCandidateId,
          payload.sourceLinkId,
        ],
      );
      payload.observationId = observation.rows[0]?.id ?? allocateM02Id();
    } else if (selected === "MARK_FORK") {
      if (payload.priorRelationshipId === undefined) {
        for (const name of [
          "resourceIdentityId",
          "forkResourceVersionId",
          "sourceLinkId",
          "observationId",
        ])
          fresh(name);
      } else {
        const preserved = (
          await client.query<{ source_link_id: string; observation_id: string }>(
            `SELECT link.id AS source_link_id,observation.id AS observation_id
             FROM resource_source_links link
             JOIN resource_version_observations observation
               ON observation.resource_source_link_id=link.id
              AND observation.resource_version_identity_id=link.target_resource_version_id
             JOIN resource_candidates candidate ON candidate.id=$1
             WHERE link.target_resource_version_id=$2 AND link.state='ACTIVE'
               AND observation.source_snapshot_id=candidate.source_snapshot_id
               AND observation.candidate_root_id=candidate.candidate_root_id
             ORDER BY convert_to(link.id,'UTF8'),convert_to(observation.id,'UTF8')`,
            [command.targetCandidateId, payload.forkResourceVersionId],
          )
        ).rows;
        if (preserved.length !== 1) throw new ManualResolutionError("TRANSITION_PROHIBITED");
        const preservedAssociation = preserved.at(0);
        if (preservedAssociation === undefined)
          throw new ManualResolutionError("TRANSITION_PROHIBITED");
        payload.sourceLinkId = preservedAssociation.source_link_id;
        payload.observationId = preservedAssociation.observation_id;
      }
      fresh("relationshipId");
    } else if (selected === "MARK_MIRROR") {
      fresh("relationshipId");
      if (payload.priorRelationshipId !== undefined) {
        fresh("sourceLinkId");
        fresh("observationId");
      } else {
        const link = await client.query<{ id: string }>(
          `SELECT id FROM resource_source_links WHERE source_repository_id=$1
           AND normalized_root_path=$2 AND target_resource_version_id=$3 AND state='ACTIVE'`,
          [
            payload.mirrorSourceRepositoryId,
            payload.normalizedRoot,
            payload.targetResourceVersionId,
          ],
        );
        payload.sourceLinkId = link.rows[0]?.id ?? allocateM02Id();
        const observation = await client.query<{ id: string }>(
          `SELECT id FROM resource_version_observations WHERE resource_version_identity_id=$1
           AND source_snapshot_id=$2 AND resource_source_link_id=$3`,
          [payload.targetResourceVersionId, payload.sourceSnapshotId, payload.sourceLinkId],
        );
        payload.observationId = observation.rows[0]?.id ?? allocateM02Id();
      }
    } else if (selected === "MARK_DUPLICATE") {
      fresh("duplicateId");
    } else if (selected === "REJECT_CANDIDATE") {
      fresh("decisionId");
    } else if (selected === "REQUEST_CLARIFICATION") {
      fresh("clarificationId");
    } else if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected ?? "")) {
      fresh("replacementGroupId");
      fresh("replacementRunId");
      const roots =
        selected === "OVERRIDE_NON_SKILL"
          ? (JSON.parse(payload.selectedRootPathsJson ?? "[]") as string[]).map(
              (normalizedPath, index) => ({
                id:
                  (payload.replacementRootIds ?? "").split(",").filter(Boolean)[index] ??
                  normalizedPath,
                normalizedPath,
              }),
            )
          : (JSON.parse(payload.replacementRootsJson ?? "[]") as {
              id: string;
              normalizedPath: string;
            }[]);
      const replacementRoots = roots.map((root) => ({ ...root, id: allocateM02Id() }));
      const rootMap = new Map(
        roots.map((root, index) => [root.id, requiredReplacementRoot(replacementRoots, index).id]),
      );
      payload.replacementRootsJson = JSON.stringify(replacementRoots);
      payload.replacementRootIds = replacementRoots
        .map(({ id }) => id)
        .sort(compareUtf8)
        .join(",");
      payload.replacementCandidateIds = (payload.replacementCandidateIds ?? "")
        .split(",")
        .filter(Boolean)
        .map(() => allocateM02Id())
        .sort(compareUtf8)
        .join(",");
      const rootCount = replacementRoots.length;
      const candidateCount = payload.replacementCandidateIds.split(",").filter(Boolean).length;
      const originalRootCount = (payload.originalRootIds ?? "").split(",").filter(Boolean).length;
      const originalCandidateCount = (payload.originalCandidateIds ?? "")
        .split(",")
        .filter(Boolean).length;
      const allocateList = (name: string, count: number): void => {
        payload[name] = JSON.stringify(Array.from({ length: count }, () => allocateM02Id()));
      };
      allocateList("rootOrderIdsJson", rootCount);
      allocateList("groupEdgeIdsJson", candidateCount);
      allocateList("reviewIdsJson", candidateCount);
      const ownership = JSON.parse(payload.replacementOwnershipJson ?? "[]") as {
        rootId: string;
        sourceEntryId: string;
        ownership: string;
      }[];
      payload.replacementOwnershipJson = JSON.stringify(
        ownership.map((fact) => ({ ...fact, rootId: rootMap.get(fact.rootId) ?? fact.rootId })),
      );
      allocateList("ownershipIdsJson", ownership.length);
      allocateList(
        "rootReplacementIdsJson",
        (originalRootCount === 0 ? 1 : originalRootCount) * rootCount,
      );
      allocateList(
        "candidateReplacementIdsJson",
        (originalCandidateCount === 0 ? 1 : originalCandidateCount) * candidateCount,
      );
      // The exact predecessor ownership/edge cardinalities are discovered server-side before allocation.
      const predecessorOwnership =
        originalRootCount === 0
          ? []
          : (
              await client.query<{ source_entry_id: string }>(
                "SELECT source_entry_id FROM candidate_root_ownership WHERE candidate_root_id = ANY($1::text[])",
                [(payload.originalRootIds ?? "").split(",").filter(Boolean)],
              )
            ).rows;
      const predecessorEdgeCount = Number(
        (
          await client.query<{ count: string }>(
            "SELECT count(*) FROM repository_group_relationships WHERE parent_group_id=$1",
            [command.targetGroupId],
          )
        ).rows[0]?.count ?? "0",
      );
      const predecessorSourceEntries = new Set(
        predecessorOwnership.map(({ source_entry_id }) => source_entry_id),
      );
      const retainedOrRetiredOwnershipCount = predecessorOwnership.reduce(
        (count, predecessor) =>
          count +
          Math.max(
            1,
            ownership.filter(({ sourceEntryId }) => sourceEntryId === predecessor.source_entry_id)
              .length,
          ),
        0,
      );
      const createdSuccessorOwnershipCount = ownership.filter(
        ({ sourceEntryId }) => !predecessorSourceEntries.has(sourceEntryId),
      ).length;
      allocateList(
        "ownershipReplacementIdsJson",
        retainedOrRetiredOwnershipCount + createdSuccessorOwnershipCount,
      );
      allocateList(
        "edgeReplacementIdsJson",
        (predecessorEdgeCount === 0 ? 1 : predecessorEdgeCount) * candidateCount,
      );
    } else if (selected === "REPLACE_M02_JOB") {
      fresh("replacementJobId");
      const requestedScope = payload.requestedOperationScope ?? "";
      const invalidatedScopes = invalidatedReplacementScopes(requestedScope);
      const predecessors = await client.query<{ id: string }>(
        `SELECT controller.id FROM m02_jobs source JOIN m02_jobs controller
           ON controller.job_lineage_id=source.job_lineage_id
         WHERE source.id=$1 AND controller.supersession_state='CONTROLLING'
           AND controller.operation_scope=ANY($2::text[])
         ORDER BY convert_to(controller.id,'UTF8')`,
        [payload.sourceJobId, invalidatedScopes],
      );
      payload.replacementSupersessionIdsJson = JSON.stringify(
        predecessors.rows.map(() => allocateM02Id()),
      );
      payload.replacementSupersessionAuditIdsJson = JSON.stringify(
        predecessors.rows.map(() => allocateM02Id()),
      );
    }
    return { ...command, payload };
  }

  private async deriveTypedRequirements(
    client: PoolClient,
    command: ManualResolutionEnvelope,
    captureRejectionCommand?: (command: ManualResolutionEnvelope) => void,
  ): Promise<TypedRequirements> {
    let logicalCommand = await this.withDiscoveredRelationshipPredecessor(client, command);
    captureRejectionCommand?.(logicalCommand);
    if (logicalCommand.evidenceIds.length > 0) {
      const evidence = await client.query<{ id: string }>(
        `SELECT reference.id
         FROM resource_candidates candidate
         JOIN classification_evidence_references reference
           ON reference.classification_run_id=candidate.reconciled_classification_run_id
          AND reference.source_snapshot_id=candidate.source_snapshot_id
         WHERE candidate.id=$1 AND reference.id=ANY($2::text[])
         ORDER BY convert_to(reference.id,'UTF8')`,
        [logicalCommand.targetCandidateId, logicalCommand.evidenceIds],
      );
      if (
        JSON.stringify(evidence.rows.map(({ id }) => id)) !==
        JSON.stringify([...logicalCommand.evidenceIds].sort(compareUtf8))
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    const selectedBeforeReview = selectedCommand(logicalCommand);
    if (
      ["MARK_DUPLICATE", "REJECT_CANDIDATE"].includes(selectedBeforeReview) &&
      logicalCommand.payload.reviewId === undefined
    ) {
      const reviews = await client.query<{ id: string }>(
        `SELECT review.id
         FROM resource_candidates candidate
         JOIN repository_classification_runs run
           ON run.id=candidate.reconciled_classification_run_id
          AND run.source_snapshot_id=candidate.source_snapshot_id
         JOIN m02_review_states review
           ON review.resource_candidate_id=candidate.id
          AND review.group_id=run.group_id
          AND review.source_snapshot_id=candidate.source_snapshot_id
         JOIN m02_jobs job
           ON job.id=review.controlling_job_id
          AND job.source_snapshot_id=candidate.source_snapshot_id
          AND job.supersession_state='CONTROLLING'
         WHERE candidate.id=$1 AND run.group_id=$2 AND review.controlling_job_id=$3
         ORDER BY convert_to(review.id,'UTF8')`,
        [
          logicalCommand.targetCandidateId,
          logicalCommand.targetGroupId,
          logicalCommand.payload.jobId,
        ],
      );
      if (reviews.rows.length !== 1) throw new ManualResolutionError("REFERENCE_INVALID");
      const review = reviews.rows.at(0);
      if (review === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      logicalCommand = {
        ...logicalCommand,
        payload: { ...logicalCommand.payload, reviewId: review.id },
      };
      captureRejectionCommand?.(logicalCommand);
    }
    const selected = selectedCommand(logicalCommand);
    const payload = logicalCommand.payload;
    const need = (name: string): string => {
      const value = payload[name];
      if (value === undefined || value.length === 0)
        throw new ManualResolutionError("REFERENCE_INVALID");
      return value;
    };
    const keys = new Set<string>();
    const addRow = (table: string, id: string | undefined): void => {
      if (id === undefined || id.length === 0) throw new ManualResolutionError("REFERENCE_INVALID");
      keys.add(`row:${table}:${id}`);
    };
    const legacyGuards: { readonly key: string; readonly canonicalPayload: Uint8Array }[] = [];
    const addGuard = (guardType: string, components: readonly CanonicalM02Value[]): void => {
      legacyGuards.push({
        key: "typed-postgres-authority",
        canonicalPayload: canonicalM02JsonBytes({ guardType, components }),
      });
    };
    const addJob = (id: string): void => {
      addRow("acquisition_jobs", id);
      addRow("m02_jobs", id);
    };
    const addBase = (): void => {
      addRow("resource_candidates", logicalCommand.targetCandidateId);
      addRow("repository_candidate_groups", logicalCommand.targetGroupId);
      addJob(need("jobId"));
      if (payload.reviewId !== undefined) addRow("m02_review_states", payload.reviewId);
    };

    if (
      [
        "CREATE_RESOURCE",
        "ATTACH_NEW_VERSION",
        "MARK_FORK",
        "MARK_MIRROR",
        "MARK_DUPLICATE",
        "REJECT_CANDIDATE",
      ].includes(selected)
    )
      await this.assertIdentityControlTuple(client, logicalCommand);

    if (
      [
        "CREATE_RESOURCE",
        "ATTACH_NEW_VERSION",
        "MARK_FORK",
        "MARK_MIRROR",
        "MARK_DUPLICATE",
        "REJECT_CANDIDATE",
      ].includes(selected)
    )
      addBase();
    if (selected === "CREATE_RESOURCE" || selected === "ATTACH_NEW_VERSION") {
      if (selected === "ATTACH_NEW_VERSION") {
        addRow("resource_identities", need("resourceIdentityId"));
        addRow("resource_version_identities", need("priorResourceVersionIdentityId"));
        addRow("resource_source_links", need("activeSourceLinkId"));
      }
      addGuard("RESOURCE_SOURCE", [
        need("provider"),
        need("providerRepositoryId"),
        need("normalizedRoot"),
      ]);
      addGuard("RESOURCE_VERSION", [need("resourceIdentityId"), need("contentFingerprint")]);
      addGuard("OBSERVATION", [
        need("resourceVersionIdentityId"),
        need("sourceSnapshotId"),
        logicalCommand.targetCandidateId,
        need("sourceLinkId"),
      ]);
      addGuard("HANDOFF", [logicalCommand.targetCandidateId]);
    } else if (selected === "MARK_FORK") {
      addRow("resource_version_identities", need("originResourceVersionId"));
      if (payload.priorRelationshipId !== undefined) {
        addRow("resource_identities", need("resourceIdentityId"));
        addRow("resource_version_identities", need("forkResourceVersionId"));
        addRow("fork_relationships", payload.priorRelationshipId);
        addRow("identity_decisions", need("priorDecisionId"));
      }
      addGuard("FORK_LINEAGE", [need("forkResourceVersionId")]);
      addGuard("RELATIONSHIP_PAIR", [
        "FORK",
        need("forkResourceVersionId"),
        need("originResourceVersionId"),
      ]);
      addGuard("RESOURCE_SOURCE", [
        need("provider"),
        need("providerRepositoryId"),
        need("normalizedRoot"),
      ]);
      addGuard("RESOURCE_VERSION", [need("resourceIdentityId"), need("contentFingerprint")]);
      addGuard("OBSERVATION", [
        need("forkResourceVersionId"),
        need("sourceSnapshotId"),
        need("candidateRootId"),
        need("sourceLinkId"),
      ]);
      addGuard("HANDOFF", [logicalCommand.targetCandidateId]);
    } else if (selected === "MARK_MIRROR") {
      addRow("resource_version_identities", need("targetResourceVersionId"));
      addRow("resource_identities", need("targetResourceIdentityId"));
      addRow("source_repository_identities", need("mirrorSourceRepositoryId"));
      addRow("source_repository_identities", need("originSourceRepositoryId"));
      if (payload.priorRelationshipId !== undefined) {
        addRow("source_repository_relationships", payload.priorRelationshipId);
        addRow("resource_source_links", need("priorSourceLinkId"));
        addRow("identity_decisions", need("priorDecisionId"));
      }
      addGuard("MIRROR_LINEAGE", [need("mirrorSourceRepositoryId")]);
      addGuard("RELATIONSHIP_PAIR", [
        "MIRROR",
        need("mirrorSourceRepositoryId"),
        need("originSourceRepositoryId"),
      ]);
      const mirrorRepository = (
        await client.query<{ provider: string; provider_repository_id: string }>(
          `SELECT provider,provider_repository_id FROM source_repository_identities WHERE id=$1`,
          [need("mirrorSourceRepositoryId")],
        )
      ).rows[0];
      if (mirrorRepository === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      addGuard("RESOURCE_SOURCE", [
        mirrorRepository.provider,
        mirrorRepository.provider_repository_id,
        need("normalizedRoot"),
      ]);
      addGuard("OBSERVATION", [
        need("targetResourceVersionId"),
        need("sourceSnapshotId"),
        logicalCommand.targetCandidateId,
        need("sourceLinkId"),
      ]);
      addGuard("HANDOFF", [logicalCommand.targetCandidateId]);
    } else if (selected === "MARK_DUPLICATE") {
      addRow("resource_version_identities", need("targetResourceVersionId"));
      if (payload.priorRelationshipId !== undefined) {
        addRow("duplicate_candidates", payload.priorRelationshipId);
        addRow("identity_decisions", need("priorDecisionId"));
      }
      addGuard("DUPLICATE_DISPOSITION", [logicalCommand.targetCandidateId]);
      addGuard("RELATIONSHIP_PAIR", [
        "DUPLICATE",
        logicalCommand.targetCandidateId,
        need("targetResourceVersionId"),
      ]);
    } else if (selected === "REJECT_CANDIDATE") {
      addGuard("REJECTION_DECISION", [logicalCommand.targetCandidateId]);
    }

    if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected)) {
      addRow("repository_candidate_groups", logicalCommand.targetGroupId);
      addJob(need("jobId"));
      const originalCandidates =
        selected === "OVERRIDE_NON_SKILL"
          ? []
          : (payload.originalCandidateIds ?? "").split(",").filter(Boolean);
      const originalRoots = (payload.originalRootIds ?? "").split(",").filter(Boolean);
      for (const id of originalCandidates) addRow("resource_candidates", id);
      for (const id of originalRoots) addRow("candidate_roots", id);
      const activeRows = await client.query<{ id: string; table_name: string }>(
        `SELECT id,'identity_decisions' AS table_name FROM identity_decisions
         WHERE resource_candidate_id=ANY($1::text[]) AND state='ACTIVE'
         UNION ALL
         SELECT id,'m02_review_states' FROM m02_review_states
         WHERE (resource_candidate_id=ANY($1::text[]) OR ($2::boolean AND group_id=$3))
           AND review_state IN ('IDENTITY_REVIEW_REQUIRED','CLARIFICATION_REQUESTED','CLASSIFICATION_REVIEW_REQUIRED')`,
        [originalCandidates, selected === "OVERRIDE_NON_SKILL", logicalCommand.targetGroupId],
      );
      for (const row of activeRows.rows) addRow(row.table_name, row.id);
      addGuard("GROUP_KEY", [need("sourceSnapshotId"), need("classificationPolicyVersion")]);
      addGuard("GROUP_MEMBERSHIP", [logicalCommand.targetGroupId]);
      const predecessor = await client.query<{ candidate_content_fingerprint: string }>(
        "SELECT candidate_content_fingerprint FROM resource_candidates WHERE id=$1",
        [originalCandidates[0] ?? logicalCommand.targetCandidateId],
      );
      const roots =
        payload.replacementRootsJson === undefined
          ? (JSON.parse(need("selectedRootPathsJson")) as string[]).map((normalizedPath) => ({
              normalizedPath,
            }))
          : (JSON.parse(payload.replacementRootsJson) as { normalizedPath: string }[]);
      for (const root of roots) {
        const rootFingerprint = fingerprintM02Payload({
          normalizedRootPath: root.normalizedPath,
          sourceSnapshotId: need("sourceSnapshotId"),
        });
        const contentFingerprint = fingerprintM02Payload({
          rootFingerprint,
          predecessorContent: predecessor.rows[0]?.candidate_content_fingerprint ?? "",
        });
        addGuard("ROOT_KEY", [need("sourceSnapshotId"), rootFingerprint, contentFingerprint]);
        addGuard("CANDIDATE_KEY", [need("sourceSnapshotId"), rootFingerprint, contentFingerprint]);
      }
    } else if (selected === "REQUEST_CLARIFICATION") {
      addRow("m02_review_states", need("reviewId"));
      addJob(need("jobId"));
      addGuard("CLARIFICATION_OPEN", [need("reviewId"), need("questionCode")]);
      const targetType = logicalCommand.reasonCode.includes("CLASSIFICATION")
        ? "CLASSIFICATION"
        : logicalCommand.reasonCode.includes("REJECTION")
          ? "REJECTION"
          : "IDENTITY";
      const targetId =
        targetType === "CLASSIFICATION"
          ? (
              await client.query<{ reconciled_classification_run_id: string }>(
                "SELECT reconciled_classification_run_id FROM resource_candidates WHERE id=$1",
                [logicalCommand.targetCandidateId],
              )
            ).rows[0]?.reconciled_classification_run_id
          : (logicalCommand.decisionIds[0] ?? logicalCommand.targetCandidateId);
      addGuard("CLARIFICATION_TARGET", [targetType, targetId ?? logicalCommand.targetCandidateId]);
    } else if (selected === "REPLACE_M02_JOB") {
      const requestedScope = need("requestedOperationScope");
      const scopes = invalidatedReplacementScopes(requestedScope);
      const sourceState = (
        await client.query<{
          id: string;
          status: string;
          cancellation_requested: boolean;
          supersession_state: string;
          operation_scope: string;
          input_fingerprint: string;
        }>(
          `SELECT source.id,acquisition.status,acquisition.cancellation_requested,
                  source.supersession_state,source.operation_scope,source.input_fingerprint
           FROM m02_jobs source JOIN acquisition_jobs acquisition ON acquisition.id=source.id
           WHERE source.id=$1`,
          [need("sourceJobId")],
        )
      ).rows[0];
      if (sourceState === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      validateReplacementTransition(logicalCommand, sourceState);
      const controllers = await client.query<{
        id: string;
        job_lineage_id: string;
        operation_scope: string;
      }>(
        `SELECT controller.id,controller.job_lineage_id,controller.operation_scope
         FROM m02_jobs source JOIN m02_jobs controller ON controller.job_lineage_id=source.job_lineage_id
         WHERE source.id=$1 AND controller.supersession_state='CONTROLLING'
           AND controller.operation_scope=ANY($2::text[])
         ORDER BY convert_to(controller.id,'UTF8')`,
        [need("sourceJobId"), scopes],
      );
      for (const row of controllers.rows) {
        addJob(row.id);
        addGuard("JOB_SCOPE_CONTROLLER", [row.job_lineage_id, row.operation_scope]);
      }
      addGuard("JOB_REPLACEMENT_INPUT", [
        need("sourceJobId"),
        requestedScope,
        need("replacementInputFingerprint"),
      ]);
      const predecessorIds = controllers.rows.map(({ id }) => id);
      const dependent = await client.query<{ id: string; table_name: string }>(
        `SELECT id,'m02_clarification_requests' AS table_name FROM m02_clarification_requests
         WHERE state='OPEN' AND controlling_job_id=ANY($1::text[])
         UNION ALL SELECT id,'m02_identity_handoff_markers' FROM m02_identity_handoff_markers
         WHERE state='ACTIVE' AND controlling_m02_job_id=ANY($1::text[])`,
        [predecessorIds],
      );
      for (const row of dependent.rows) addRow(row.table_name, row.id);
    }

    if (!["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(selected)) {
      const activeDecision = (
        await client.query<{ id: string }>(
          "SELECT id FROM identity_decisions WHERE resource_candidate_id=$1 AND state='ACTIVE' ORDER BY convert_to(id,'UTF8') LIMIT 1",
          [logicalCommand.targetCandidateId],
        )
      ).rows[0]?.id;
      if (activeDecision !== undefined) addRow("identity_decisions", activeDecision);
      const activeHandoff = (
        await client.query<{ id: string }>(
          "SELECT id FROM m02_identity_handoff_markers WHERE resource_candidate_id=$1 AND state='ACTIVE' ORDER BY convert_to(id,'UTF8') LIMIT 1",
          [logicalCommand.targetCandidateId],
        )
      ).rows[0]?.id;
      if (activeHandoff !== undefined) addRow("m02_identity_handoff_markers", activeHandoff);
      const candidateLineage = await client.query<{ reconciled_classification_run_id: string }>(
        "SELECT reconciled_classification_run_id FROM resource_candidates WHERE id=$1",
        [logicalCommand.targetCandidateId],
      );
      const activeRejection = (
        await client.query<{ id: string }>(
          "SELECT id FROM m02_candidate_rejection_decisions WHERE resource_candidate_id=$1 AND state='ACTIVE' ORDER BY convert_to(id,'UTF8') LIMIT 1",
          [logicalCommand.targetCandidateId],
        )
      ).rows[0]?.id;
      const clarifications = await client.query<{
        id: string;
        target_classification_run_id: string | null;
        target_identity_decision_id: string | null;
        target_rejection_decision_id: string | null;
      }>(
        `SELECT id,target_classification_run_id,target_identity_decision_id,target_rejection_decision_id
         FROM m02_clarification_requests
         WHERE state='OPEN' AND controlling_job_id=$1
           AND (resource_candidate_id=$2 OR candidate_group_id=$3)
           AND (target_classification_run_id=$4 OR target_identity_decision_id=$5 OR target_rejection_decision_id=$6)
         ORDER BY convert_to(id,'UTF8')`,
        [
          need("jobId"),
          logicalCommand.targetCandidateId,
          logicalCommand.targetGroupId,
          candidateLineage.rows[0]?.reconciled_classification_run_id ?? null,
          activeDecision ?? null,
          activeRejection ?? null,
        ],
      );
      for (const clarification of clarifications.rows) {
        addRow("m02_clarification_requests", clarification.id);
        const target =
          clarification.target_classification_run_id !== null
            ? ["CLASSIFICATION", clarification.target_classification_run_id]
            : clarification.target_identity_decision_id !== null
              ? ["IDENTITY", clarification.target_identity_decision_id]
              : ["REJECTION", clarification.target_rejection_decision_id ?? ""];
        addGuard("CLARIFICATION_TARGET", target);
      }
      if (activeDecision !== undefined)
        addGuard("CLARIFICATION_TARGET", ["IDENTITY", activeDecision]);
      else if (activeRejection !== undefined)
        addGuard("CLARIFICATION_TARGET", ["REJECTION", activeRejection]);
      else {
        const classificationRunId = candidateLineage.rows[0]?.reconciled_classification_run_id;
        if (classificationRunId !== undefined)
          addGuard("CLARIFICATION_TARGET", ["CLASSIFICATION", classificationRunId]);
      }
      const candidateState = await client.query<{ status: string }>(
        "SELECT status FROM resource_candidates WHERE id=$1",
        [logicalCommand.targetCandidateId],
      );
      if (candidateState.rows[0]?.status === "IDENTITY_REVIEW_REQUIRED") {
        addGuard("DUPLICATE_PROPOSAL_SET", [logicalCommand.targetCandidateId]);
        const proposal = (
          await client.query<{ id: string; target_resource_version_id: string }>(
            `SELECT id,target_resource_version_id FROM duplicate_candidates
           WHERE resource_candidate_id=$1 AND status='PROPOSED'
           ORDER BY convert_to(id,'UTF8')`,
            [logicalCommand.targetCandidateId],
          )
        ).rows;
        if (proposal.length > 1) throw new ManualResolutionError("REFERENCE_INVALID");
        if (proposal[0] !== undefined) {
          addRow("duplicate_candidates", proposal[0].id);
          addGuard("DUPLICATE_PROPOSAL_PAIR", [
            logicalCommand.targetCandidateId,
            proposal[0].target_resource_version_id,
          ]);
        }
      }
    }
    const guards = await deriveCanonicalGuardIdentities(client, logicalCommand, legacyGuards);
    return {
      command: logicalCommand,
      requiredKeys: [...new Set([...keys, ...guards.map(({ key }) => key)])].sort(compareUtf8),
      guards,
    };
  }

  private async assertIdentityControlTuple(
    client: PoolClient,
    command: ManualResolutionEnvelope,
  ): Promise<void> {
    const reviewId = command.payload.reviewId;
    const jobId = command.payload.jobId;
    if (reviewId === undefined || jobId === undefined)
      throw new ManualResolutionError("REFERENCE_INVALID");
    const exact = await client.query<{ id: string }>(
      `SELECT candidate.id
       FROM resource_candidates candidate
       JOIN repository_classification_runs run
         ON run.id=candidate.reconciled_classification_run_id
        AND run.source_snapshot_id=candidate.source_snapshot_id
       JOIN repository_candidate_groups candidate_group
         ON candidate_group.id=run.group_id
        AND candidate_group.source_snapshot_id=candidate.source_snapshot_id
        AND candidate_group.state='ACTIVE'
       JOIN m02_review_states review
         ON review.id=$3
        AND review.resource_candidate_id=candidate.id
        AND review.group_id=candidate_group.id
        AND review.source_snapshot_id=candidate.source_snapshot_id
       JOIN m02_jobs job
         ON job.id=$4
        AND job.id=review.controlling_job_id
        AND job.source_snapshot_id=candidate.source_snapshot_id
        AND job.supersession_state='CONTROLLING'
       WHERE candidate.id=$1 AND candidate_group.id=$2`,
      [command.targetCandidateId, command.targetGroupId, reviewId, jobId],
    );
    if (exact.rows.length !== 1) throw new ManualResolutionError("REFERENCE_INVALID");
  }

  private async withDiscoveredRelationshipPredecessor(
    client: PoolClient,
    command: ManualResolutionEnvelope,
  ): Promise<ManualResolutionEnvelope> {
    const selected =
      command.command === "RESOLVE_AMBIGUITY" ? command.payload.selectedCommand : command.command;
    if (!["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(selected ?? "")) return command;
    const active =
      selected === "MARK_FORK"
        ? await client.query<{
            id: string;
            decision_id: string;
            delivery_source_link_id: string | null;
          }>(
            `SELECT id,decision_id,NULL::text AS delivery_source_link_id
             FROM fork_relationships WHERE fork_resource_version_id=$1 AND state='ACTIVE'`,
            [command.payload.forkResourceVersionId],
          )
        : selected === "MARK_MIRROR"
          ? await client.query<{
              id: string;
              decision_id: string;
              delivery_source_link_id: string | null;
            }>(
              `SELECT id,decision_id,delivery_source_link_id
               FROM source_repository_relationships
               WHERE mirror_source_repository_id=$1 AND state='ACTIVE'`,
              [command.payload.mirrorSourceRepositoryId],
            )
          : await client.query<{
              id: string;
              decision_id: string;
              delivery_source_link_id: string | null;
            }>(
              `SELECT id,decision_id,NULL::text AS delivery_source_link_id
               FROM duplicate_candidates
               WHERE resource_candidate_id=$1 AND status='CONFIRMED'`,
              [command.targetCandidateId],
            );
    if (active.rows.length > 1) throw new ManualResolutionError("TRANSITION_PROHIBITED");
    const prior = active.rows[0];
    const payload = { ...command.payload };
    if (prior === undefined) {
      delete payload.priorRelationshipId;
      delete payload.priorDecisionId;
      delete payload.priorSourceLinkId;
    } else {
      payload.priorRelationshipId = prior.id;
      payload.priorDecisionId = prior.decision_id;
      if (selected === "MARK_MIRROR") {
        if (prior.delivery_source_link_id === null)
          throw new ManualResolutionError("REFERENCE_INVALID");
        payload.priorSourceLinkId = prior.delivery_source_link_id;
      }
    }
    return { ...command, payload };
  }

  private async lockRequiredKeysInCanonicalOrder(
    client: PoolClient,
    requiredKeys: readonly string[],
  ): Promise<void> {
    for (const key of requiredKeys.filter((entry) => entry.startsWith("guard:")).sort(compareUtf8))
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key]);
    await lockTypedRows(client, requiredKeys);
  }

  private async assertTypedPlanPostconditions(
    client: PoolClient,
    plan: CommandMutationPlanV1,
  ): Promise<void> {
    const identifier = (value: string): string => {
      if (!/^[a-z][a-z0-9_]*$/u.test(value))
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      return value;
    };
    const plannedRows = [
      ...plan.domainMutationPlan.creates,
      ...plan.domainMutationPlan.updates,
      ...plan.domainMutationPlan.supersedes,
      ...plan.domainMutationPlan.mappings,
    ].filter(
      (row, index, rows) =>
        rows.findIndex((candidate) => candidate.table === row.table && candidate.id === row.id) ===
        index,
    );
    for (const row of plannedRows) {
      const persisted = await client.query<{ value: Readonly<Record<string, unknown>> }>(
        `SELECT to_jsonb(row_value) AS value FROM ${identifier(row.table)} row_value WHERE id=$1`,
        [row.id],
      );
      const value = persisted.rows[0]?.value;
      if (value === undefined || !canonicalConflictEqual(value, row.completeTypedValues))
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    }
    for (const postcondition of plan.domainMutationPlan.postconditions) {
      if (!isCanonicalRecord(postcondition))
        throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      if (typeof postcondition.table === "string" && typeof postcondition.id === "string") {
        const found = await client.query<{ value: Readonly<Record<string, unknown>> }>(
          `SELECT to_jsonb(row_value) AS value FROM ${identifier(postcondition.table)} row_value WHERE id=$1`,
          [postcondition.id],
        );
        if (found.rowCount !== 1) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const value = found.rows[0]?.value;
        if (value === undefined) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        if (
          typeof postcondition.expectedRecordVersion === "number" &&
          Number(value.record_version) !== postcondition.expectedRecordVersion
        )
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        if (
          typeof postcondition.expectedStateColumn === "string" &&
          value[identifier(postcondition.expectedStateColumn)] !== postcondition.expectedState
        )
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const expectedForeignKeys = postcondition.expectedForeignKeys ?? null;
        if (isCanonicalRecord(expectedForeignKeys))
          for (const [column, expected] of Object.entries(expectedForeignKeys))
            if (!canonicalConflictEqual(value[identifier(column)], expected))
              throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      }
      if (
        typeof postcondition.collisionTable === "string" &&
        Array.isArray(postcondition.collisionColumns) &&
        Array.isArray(postcondition.collisionValues) &&
        typeof postcondition.expectedCount === "number"
      ) {
        const columns = postcondition.collisionColumns.map((column) => identifier(String(column)));
        if (columns.length !== postcondition.collisionValues.length)
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
        const predicates = columns.map(
          (column, index) => `${column} IS NOT DISTINCT FROM $${String(index + 1)}`,
        );
        const result = await client.query<{ count: string }>(
          `SELECT count(*) FROM ${identifier(postcondition.collisionTable)} WHERE ${predicates.join(" AND ")}`,
          postcondition.collisionValues,
        );
        if (Number(result.rows[0]?.count ?? "0") !== postcondition.expectedCount)
          throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
      }
    }
  }

  private async persistResult(
    client: PoolClient,
    requestCommand: ManualResolutionEnvelope,
    command: ManualResolutionEnvelope,
    fingerprint: string,
    result: ManualResolutionResult,
    guards: readonly CanonicalGuardIdentity[],
    resultId: string,
    auditBase: string,
    plan: CommandMutationPlanV1,
    expansionId: string,
  ): Promise<void> {
    for (const guard of guards) {
      const key = guard.key;
      const expected = requestCommand.expectedVersions[key];
      if (expected === null) {
        await client.query(
          `INSERT INTO m02_concurrency_guards
              (guard_key, guard_type, canonical_payload, payload_hash, record_version)
             VALUES ($1, $2, $3, $4, 1)`,
          [key, guard.guardType, Buffer.from(guard.canonicalPayload), guard.payloadHash],
        );
      } else if (result.recordVersions[key] !== undefined) {
        const updated = await client.query(
          `UPDATE m02_concurrency_guards
             SET canonical_payload = $2, payload_hash = $3, record_version = record_version + 1
             WHERE guard_key = $1 AND record_version = $4`,
          [key, Buffer.from(guard.canonicalPayload), guard.payloadHash, expected],
        );
        if (updated.rowCount !== 1) throw new ManualResolutionError("STALE_RECORD_VERSION");
      }
    }
    await persistTypedCommand(
      client,
      requestCommand,
      command,
      fingerprint,
      result,
      resultId,
      auditBase,
      plan,
      expansionId,
    );
  }

  private async persistRejection(
    command: ManualResolutionEnvelope,
    fingerprint: string,
    code: string,
  ): Promise<void> {
    const selected = selectedCommand(command);
    const identityFamily = [
      "CREATE_RESOURCE",
      "ATTACH_NEW_VERSION",
      "MARK_FORK",
      "MARK_MIRROR",
      "MARK_DUPLICATE",
      "REJECT_CANDIDATE",
    ].includes(selected);
    const topologyFamily = ["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(selected);
    const clarificationFamily = selected === "REQUEST_CLARIFICATION";
    const classificationClarification =
      clarificationFamily && command.reasonCode.includes("CLASSIFICATION");
    const targetCandidateId =
      identityFamily || (clarificationFamily && !classificationClarification)
        ? command.targetCandidateId
        : null;
    const targetGroupId =
      identityFamily || topologyFamily || clarificationFamily ? command.targetGroupId : null;
    const reviewId =
      identityFamily || clarificationFamily ? (command.payload.reviewId ?? null) : null;
    const jobId =
      selected === "REPLACE_M02_JOB"
        ? (command.payload.sourceJobId ?? null)
        : identityFamily || topologyFamily || clarificationFamily
          ? (command.payload.jobId ?? null)
          : null;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL search_path TO "${this.schema}"`);
      await client.query(
        `INSERT INTO m02_rejected_command_audits (
          command_id, request_id, idempotency_scope, idempotency_key, request_fingerprint,
          actor_id, actor_role, error_code, target_candidate_id, target_group_id,
          review_id, job_id, created_at
        ) VALUES (
          $1, $2, 'M02', $3, $4, $5, $6, $7,
          (SELECT id FROM resource_candidates WHERE id=$8),
          (SELECT id FROM repository_candidate_groups WHERE id=$9),
          (SELECT id FROM m02_review_states WHERE id=$10),
          (SELECT id FROM m02_jobs WHERE id=$11),
          clock_timestamp()
        )
        ON CONFLICT (idempotency_scope, idempotency_key, request_fingerprint, error_code)
        DO NOTHING`,
        [
          command.commandId,
          command.requestId,
          command.idempotencyKey,
          fingerprint,
          command.actorId,
          command.actorRole,
          code,
          targetCandidateId,
          targetGroupId,
          reviewId,
          jobId,
        ],
      );
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }
}
