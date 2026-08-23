import { randomBytes } from "node:crypto";

import {
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  normalizeIdentityToken,
  type CanonicalM02Value,
} from "@ai-ark/classification";
import {
  authorizeCommand,
  enumerateManualResolutionModes,
  manualResolutionPayloadKeys,
  ManualResolutionError,
  type ManualResolutionEnvelope,
  type ManualResolutionMode,
  type ManualResolutionResult,
} from "@ai-ark/identity";

export type HumanProjectionDimension =
  | "P0"
  | "P1"
  | "P2"
  | "K0"
  | "K1"
  | "K2"
  | "JC"
  | "JR"
  | "JE"
  | "A1"
  | "A2"
  | "A3"
  | "M1"
  | "M2"
  | "T0"
  | "T1"
  | "Z0"
  | "Z1"
  | "FIRST"
  | "CORRECTION"
  | "SINGLE"
  | "MULTIPLE";

export interface HumanModeDiscovery {
  readonly candidatePhase?: "P0" | "P1" | "P2";
  readonly clarificationPhase?: "K0" | "K1" | "K2";
  readonly jobAggregate?: "JC" | "JR" | "JE";
  readonly attachShape?: "A1" | "A2" | "A3";
  readonly mirrorShape?: "M1" | "M2";
  readonly relationshipShape?: "FIRST" | "CORRECTION";
  readonly clarificationGuard?: "T0" | "T1";
  readonly predecessorCardinality?: "SINGLE" | "MULTIPLE";
  readonly replacementClarifications?: "Z0" | "Z1";
  readonly selectedDirectMode?: HumanProjectionMode;
}

export interface HumanProjectionMode extends ManualResolutionMode {
  readonly dimensions: Readonly<Record<string, string>>;
}

export interface PlannedGuard {
  readonly key: string;
  readonly guardType: string;
  readonly canonicalPayloadBase64: string;
  readonly expectedVersion: number | null;
  readonly operation: "READ" | "CREATE" | "INCREMENT";
}

export interface PlannedTypedRow {
  readonly table: string;
  readonly id: string;
  readonly completeTypedValues: Readonly<Record<string, CanonicalM02Value>>;
  readonly expectedRecordVersion?: number;
  readonly expectedState?: string;
}

export interface PlannedAudit {
  readonly id: string;
  readonly action:
    "COMMAND_ACCEPTED" | "SUBJECT_CREATED" | "SUBJECT_UPDATED" | "SUBJECT_SUPERSEDED";
  readonly subjectType: string;
  readonly subjectId: string;
  readonly beforeVersion: number | null;
  readonly afterVersion: number | null;
  readonly beforeState: CanonicalM02Value | null;
  readonly afterState: CanonicalM02Value | null;
  readonly metadata: Readonly<Record<string, CanonicalM02Value>>;
}

export interface CommandConcurrencyPlanV1 {
  readonly schemaVersion: "1";
  readonly expansionId: string;
  readonly guardPlan: readonly PlannedGuard[];
  readonly callerExpectedVersions: Readonly<Record<string, number | null>>;
  readonly requiredCurrentExpectations: Readonly<Record<string, number | null>>;
  readonly existingTypedRows: readonly string[];
}

export interface CommandDomainMutationPlanV1 {
  readonly allocatedIds: Readonly<Record<string, string>>;
  readonly creates: readonly PlannedTypedRow[];
  readonly updates: readonly PlannedTypedRow[];
  readonly supersedes: readonly PlannedTypedRow[];
  readonly mappings: readonly PlannedTypedRow[];
  readonly result: PlannedTypedRow;
  readonly audits: readonly PlannedAudit[];
  readonly postconditions: readonly CanonicalM02Value[];
}

export interface CommandMutationPlanV1 {
  readonly schemaVersion: "CommandMutationPlanV1";
  readonly concurrencyPlan: CommandConcurrencyPlanV1;
  readonly domainMutationPlan: CommandDomainMutationPlanV1;
  readonly fingerprint: string;
}

const modeRegistry = enumerateManualResolutionModes() as readonly HumanProjectionMode[];
if (
  modeRegistry.length !== 256 ||
  new Set(modeRegistry.map((mode) => mode.expansionId)).size !== 256
)
  throw new Error("The closed manual-resolution mode registry must contain 256 unique modes");

const modeById = new Map(modeRegistry.map((mode) => [mode.expansionId, mode] as const));

export function humanProjectionModes(): readonly HumanProjectionMode[] {
  return modeRegistry;
}

function exactMode(expansionId: string): HumanProjectionMode {
  const mode = modeById.get(expansionId);
  if (mode === undefined) throw new ManualResolutionError("TRANSITION_PROHIBITED");
  return mode;
}

/** Selects exactly one row from the closed Section 15.9 registry. */
export function selectHumanProjectionMode(
  command: ManualResolutionEnvelope,
  discovery: HumanModeDiscovery,
): HumanProjectionMode {
  const p = discovery.candidatePhase;
  const k = discovery.clarificationPhase;
  const j = discovery.jobAggregate;
  let directId: string;
  switch (command.command) {
    case "CREATE_RESOURCE":
      if ((p !== "P0" && p !== "P1") || k === undefined || (j !== "JC" && j !== "JR"))
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `CREATE_RESOURCE:${p}:${k}:${j}`;
      break;
    case "ATTACH_NEW_VERSION":
      if (
        discovery.attachShape === undefined ||
        (p !== "P1" && p !== "P2") ||
        k === undefined ||
        (j !== "JC" && j !== "JR")
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `ATTACH_NEW_VERSION:${discovery.attachShape}:${p}:${k}:${j}`;
      break;
    case "MARK_FORK":
      if (
        discovery.relationshipShape === undefined ||
        k === undefined ||
        (j !== "JC" && j !== "JR")
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `MARK_FORK:${discovery.relationshipShape}:${k}:${j}`;
      break;
    case "MARK_MIRROR":
      if (discovery.relationshipShape === "FIRST") {
        if (discovery.mirrorShape === undefined || k === undefined || (j !== "JC" && j !== "JR"))
          throw new ManualResolutionError("TRANSITION_PROHIBITED");
        directId = `MARK_MIRROR:FIRST:${discovery.mirrorShape}:${k}:${j}`;
      } else {
        if (
          discovery.relationshipShape !== "CORRECTION" ||
          k === undefined ||
          (j !== "JC" && j !== "JR")
        )
          throw new ManualResolutionError("TRANSITION_PROHIBITED");
        directId = `MARK_MIRROR:CORRECTION:${k}:${j}`;
      }
      break;
    case "MARK_DUPLICATE":
      if (discovery.relationshipShape === undefined || k === undefined || j === undefined)
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `MARK_DUPLICATE:${discovery.relationshipShape}:${k}:${j}`;
      break;
    case "REJECT_CANDIDATE":
      if ((p !== "P0" && p !== "P1") || k === undefined || j === undefined)
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `REJECT_CANDIDATE:${p}:${k}:${j}`;
      break;
    case "SPLIT_ROOTS":
    case "MERGE_ROOTS":
    case "OVERRIDE_NON_SKILL":
      if (k === undefined) throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `${command.command}:${k}`;
      break;
    case "REQUEST_CLARIFICATION": {
      const target = clarificationTarget(command);
      if (discovery.clarificationGuard === undefined)
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `REQUEST_CLARIFICATION:${target}:${discovery.clarificationGuard}`;
      break;
    }
    case "RESOLVE_AMBIGUITY": {
      const selected = discovery.selectedDirectMode;
      if (
        selected === undefined ||
        selected.family === "RESOLVE_AMBIGUITY" ||
        selected.family === "REPLACE_M02_JOB"
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      return exactMode(`RESOLVE_AMBIGUITY:${selected.expansionId}`);
    }
    case "REPLACE_M02_JOB":
      if (
        discovery.predecessorCardinality === undefined ||
        discovery.replacementClarifications === undefined
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      directId = `REPLACE_M02_JOB:${discovery.predecessorCardinality}:${discovery.replacementClarifications}`;
      break;
  }
  return exactMode(directId);
}

function clarificationTarget(
  command: ManualResolutionEnvelope,
): "CLASSIFICATION" | "IDENTITY" | "REJECTION" {
  if (command.payload.targetClassificationRunId !== undefined) return "CLASSIFICATION";
  if (command.payload.targetIdentityDecisionId !== undefined) return "IDENTITY";
  if (command.payload.targetRejectionDecisionId !== undefined) return "REJECTION";
  // The current public envelope uses decisionIds as locators; reason text is never authoritative.
  const declared = command.payload.clarificationTargetType;
  if (declared === "CLASSIFICATION" || declared === "IDENTITY" || declared === "REJECTION")
    return declared;
  if (command.reasonCode.includes("CLASSIFICATION")) return "CLASSIFICATION";
  if (command.reasonCode.includes("REJECTION")) return "REJECTION";
  if (command.reasonCode.includes("IDENTITY")) return "IDENTITY";
  throw new ManualResolutionError("REFERENCE_INVALID");
}

/** UUIDv7-compatible opaque ID. Timestamp ordering is useful only for storage locality, not authority. */
export function allocateM02Id(): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 6; index += 1)
    bytes[5 - index] = Number((timestamp >> BigInt(index * 8)) & 0xffn);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function allocateM02Ids(labels: readonly string[]): Readonly<Record<string, string>> {
  return Object.fromEntries([...labels].sort(compareUtf8).map((label) => [label, allocateM02Id()]));
}

export function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function canonicalOrderedTargetIds(sets: {
  readonly created: readonly string[];
  readonly reused: readonly string[];
  readonly updated: readonly string[];
  readonly superseded: readonly string[];
}): readonly string[] {
  return [...new Set([...sets.created, ...sets.reused, ...sets.updated, ...sets.superseded])].sort(
    compareUtf8,
  );
}

const manualEnvelopeKeys = [
  "actorId",
  "actorRole",
  "command",
  "commandId",
  "decisionIds",
  "evidenceIds",
  "expectedVersions",
  "idempotencyKey",
  "payload",
  "reason",
  "reasonCode",
  "requestId",
  "targetCandidateId",
  "targetGroupId",
  "timestamp",
] as const;

const opaqueIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u;
const replacementReasons = new Set([
  "FAILED_STAGE_REPLACEMENT",
  "RETRY_EXHAUSTED",
  "NEW_SUPPORTED_SNAPSHOT",
  "POLICY_OR_METHODOLOGY_CHANGE",
  "ADMINISTRATIVE_CORRECTION",
]);
const replacementScopes = new Set(["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"]);

function commaIds(value: string | undefined): readonly string[] {
  return value?.split(",").filter(Boolean) ?? [];
}

function requireJsonArray(value: string | undefined): readonly unknown[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "");
    if (!Array.isArray(parsed) || parsed.length === 0)
      throw new ManualResolutionError("REFERENCE_INVALID");
    return parsed;
  } catch (error) {
    if (error instanceof ManualResolutionError) throw error;
    throw new ManualResolutionError("REFERENCE_INVALID");
  }
}

function isSafeRootPath(value: string): boolean {
  return (
    value === value.normalize("NFC") &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  );
}

/** Step-1 validation. It is pure and intentionally owns no PostgreSQL discovery authority. */
export function validateManualResolutionEnvelope(command: ManualResolutionEnvelope): void {
  if (
    JSON.stringify(Object.keys(command).sort(compareUtf8)) !==
    JSON.stringify([...manualEnvelopeKeys].sort(compareUtf8))
  ) {
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
  }
  const selected =
    command.command === "RESOLVE_AMBIGUITY"
      ? (command.payload.selectedCommand as ManualResolutionEnvelope["command"] | undefined)
      : undefined;
  const correction = command.payload.priorRelationshipId !== undefined;
  const allowedPayload = manualResolutionPayloadKeys(
    command.command,
    selected,
    correction,
    command.payload.replacementSnapshotId !== undefined,
  );
  if (
    JSON.stringify(Object.keys(command.payload).sort(compareUtf8)) !==
    JSON.stringify([...allowedPayload].sort(compareUtf8))
  )
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");

  const ids = [
    command.commandId,
    command.requestId,
    command.idempotencyKey,
    command.actorId,
    command.targetCandidateId,
    command.targetGroupId,
    ...command.evidenceIds,
    ...command.decisionIds,
  ];
  if (
    ids.some((id) => !opaqueIdPattern.test(id)) ||
    new Set(command.evidenceIds).size !== command.evidenceIds.length ||
    new Set(command.decisionIds).size !== command.decisionIds.length ||
    !/^[A-Z][A-Z0-9_]{0,127}$/u.test(command.reasonCode) ||
    Number.isNaN(Date.parse(command.timestamp)) ||
    new Date(command.timestamp).toISOString() !== command.timestamp
  )
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
  const reasonBytes = new TextEncoder().encode(command.reason).byteLength;
  if (reasonBytes < 1 || reasonBytes > 2_000)
    throw new ManualResolutionError("TRANSITION_PROHIBITED");
  for (const [key, value] of Object.entries(command.expectedVersions)) {
    const rowKey = key.matchAll(/^row:[a-z][a-z0-9_]*:(.+)$/gu).next().value;
    const validKey =
      /^guard:[A-Z][A-Z0-9_]*:[A-Za-z0-9_-]+$/u.test(key) ||
      (rowKey !== undefined && opaqueIdPattern.test(rowKey[1] ?? ""));
    if (!validKey || (value !== null && (!Number.isSafeInteger(value) || value < 1)))
      throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
  }
  for (const [key, value] of Object.entries(command.payload)) {
    if (key.endsWith("Ids")) {
      const values = commaIds(value);
      if (values.length === 0 || values.some((id) => !opaqueIdPattern.test(id)))
        throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
    } else if (key.endsWith("Id") && !opaqueIdPattern.test(value)) {
      throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
    }
  }

  if (!authorizeCommand(command.actorRole, command.command, command.command === "REPLACE_M02_JOB"))
    throw new ManualResolutionError("ROLE_NOT_AUTHORIZED");
  if (command.command === "RESOLVE_AMBIGUITY") {
    if (
      selected === undefined ||
      selected === "RESOLVE_AMBIGUITY" ||
      selected === "REPLACE_M02_JOB"
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (!authorizeCommand(command.actorRole, selected))
      throw new ManualResolutionError("ROLE_NOT_AUTHORIZED");
  }
  const effective = selected ?? command.command;
  if (
    !["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(effective) &&
    command.evidenceIds.length === 0
  )
    throw new ManualResolutionError("REFERENCE_INVALID");
  if (["CREATE_RESOURCE", "MARK_FORK"].includes(effective)) {
    const token = command.payload.reliableIdentityToken ?? "";
    if (
      normalizeIdentityToken(token)?.normalized !== token ||
      !command.evidenceIds.includes(command.payload.reliableTokenEvidenceId ?? "")
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
  }
  if (effective === "ATTACH_NEW_VERSION") {
    const continuity = commaIds(command.payload.continuityEvidenceIds);
    if (continuity.length === 0 || continuity.some((id) => !command.evidenceIds.includes(id)))
      throw new ManualResolutionError("REFERENCE_INVALID");
  }
  if (
    effective === "MARK_MIRROR" &&
    !/^[a-f0-9]{64}$/u.test(command.payload.identicalContentFingerprint ?? "")
  )
    throw new ManualResolutionError("REFERENCE_INVALID");
  if (["SPLIT_ROOTS", "MERGE_ROOTS"].includes(effective)) {
    const roots = requireJsonArray(command.payload.replacementRootsJson) as readonly Record<
      string,
      unknown
    >[];
    const ownership = requireJsonArray(command.payload.replacementOwnershipJson) as readonly Record<
      string,
      unknown
    >[];
    const predecessorRoots = commaIds(command.payload.originalRootIds);
    const predecessorCandidates = commaIds(command.payload.originalCandidateIds);
    const successorRoots = commaIds(command.payload.replacementRootIds);
    const successorCandidates = commaIds(command.payload.replacementCandidateIds);
    if (
      predecessorRoots.length !== predecessorCandidates.length ||
      successorRoots.length !== successorCandidates.length ||
      roots.length !== successorRoots.length ||
      new Set([...predecessorRoots, ...successorRoots]).size !==
        predecessorRoots.length + successorRoots.length ||
      roots.some(
        (root, index) =>
          Object.keys(root).sort(compareUtf8).join(",") !== "id,normalizedPath" ||
          root.id !== successorRoots[index] ||
          typeof root.normalizedPath !== "string" ||
          !isSafeRootPath(root.normalizedPath),
      ) ||
      ownership.some(
        (entry) =>
          Object.keys(entry).sort(compareUtf8).join(",") !== "ownership,rootId,sourceEntryId" ||
          !successorRoots.includes(String(entry.rootId)) ||
          !["OWNED", "SHARED", "EXCLUDED"].includes(String(entry.ownership)) ||
          !opaqueIdPattern.test(String(entry.sourceEntryId)),
      ) ||
      successorRoots.some((id) => !ownership.some((entry) => entry.rootId === id)) ||
      (effective === "SPLIT_ROOTS" && (predecessorRoots.length < 1 || successorRoots.length < 2)) ||
      (effective === "MERGE_ROOTS" && (predecessorRoots.length < 2 || successorRoots.length !== 1))
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
  }
  if (effective === "OVERRIDE_NON_SKILL") {
    const selectedPaths = requireJsonArray(command.payload.selectedRootPathsJson);
    const roots = commaIds(command.payload.replacementRootIds);
    const candidates = commaIds(command.payload.replacementCandidateIds);
    if (
      selectedPaths.length < 1 ||
      selectedPaths.length > 64 ||
      roots.length !== selectedPaths.length ||
      candidates.length !== selectedPaths.length ||
      selectedPaths.some((path) => typeof path !== "string" || !isSafeRootPath(path))
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
    requireJsonArray(command.payload.replacementOwnershipJson);
  }
  if (effective === "REQUEST_CLARIFICATION") {
    if (
      !(command.payload.questionCode ?? "").length ||
      !["ADMIN", "EDITOR", "TECHNICAL_REVIEWER"].includes(
        command.payload.requestedResponderClass ?? "",
      )
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
    requireJsonArray(command.payload.evidenceGapsJson);
  }
  if (effective === "REPLACE_M02_JOB") {
    if (
      !replacementReasons.has(command.reasonCode) ||
      !replacementScopes.has(command.payload.requestedOperationScope ?? "") ||
      !/^[a-f0-9]{64}$/u.test(command.payload.replacementInputFingerprint ?? "")
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
    if (
      (command.reasonCode === "NEW_SUPPORTED_SNAPSHOT" &&
        command.payload.replacementSnapshotId === undefined) ||
      (command.reasonCode === "ADMINISTRATIVE_CORRECTION" &&
        (command.actorRole !== "ADMIN" || command.evidenceIds.length === 0))
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
  }
}

export function canonicalPlanFingerprint(
  concurrencyPlan: CommandConcurrencyPlanV1,
  domainMutationPlan: CommandDomainMutationPlanV1,
): string {
  return fingerprintM02Payload({
    schemaVersion: "CommandMutationPlanV1",
    concurrencyPlan: concurrencyPlan as unknown as CanonicalM02Value,
    domainMutationPlan: domainMutationPlan as unknown as CanonicalM02Value,
  });
}

export function finalizeCommandMutationPlan(
  concurrencyPlan: CommandConcurrencyPlanV1,
  domainMutationPlan: CommandDomainMutationPlanV1,
): CommandMutationPlanV1 {
  const sortRows = (rows: readonly PlannedTypedRow[]): readonly PlannedTypedRow[] =>
    [...rows].sort((left, right) =>
      compareUtf8(`${left.table}\u0000${left.id}`, `${right.table}\u0000${right.id}`),
    );
  const normalizedConcurrency: CommandConcurrencyPlanV1 = {
    ...concurrencyPlan,
    guardPlan: [...concurrencyPlan.guardPlan].sort((left, right) =>
      compareUtf8(left.key, right.key),
    ),
    existingTypedRows: [...concurrencyPlan.existingTypedRows].sort(compareUtf8),
  };
  const normalizedDomain: CommandDomainMutationPlanV1 = {
    ...domainMutationPlan,
    allocatedIds: Object.fromEntries(
      Object.entries(domainMutationPlan.allocatedIds).sort(([left], [right]) =>
        compareUtf8(left, right),
      ),
    ),
    creates: sortRows(domainMutationPlan.creates),
    updates: sortRows(domainMutationPlan.updates),
    supersedes: sortRows(domainMutationPlan.supersedes),
    mappings: sortRows(domainMutationPlan.mappings),
    audits: [...domainMutationPlan.audits].sort((left, right) => compareUtf8(left.id, right.id)),
    postconditions: [...domainMutationPlan.postconditions].sort((left, right) =>
      compareUtf8(
        Buffer.from(canonicalM02JsonBytes(left)).toString("base64"),
        Buffer.from(canonicalM02JsonBytes(right)).toString("base64"),
      ),
    ),
  };
  // Canonicalization here is deliberate: malformed undefined/non-canonical values fail before SQL opens.
  canonicalM02JsonBytes(normalizedConcurrency as unknown as CanonicalM02Value);
  canonicalM02JsonBytes(normalizedDomain as unknown as CanonicalM02Value);
  return {
    schemaVersion: "CommandMutationPlanV1",
    concurrencyPlan: normalizedConcurrency,
    domainMutationPlan: normalizedDomain,
    fingerprint: canonicalPlanFingerprint(normalizedConcurrency, normalizedDomain),
  };
}

function persistedAllocatedIds(
  resultId: string,
  auditBase: string,
  creates: readonly PlannedTypedRow[],
  audits: readonly PlannedAudit[],
): Readonly<Record<string, string>> {
  const ids: [string, string][] = [["resultId", resultId]];
  for (const row of creates) ids.push([`row:${row.table}:${row.id}`, row.id]);
  for (const audit of audits)
    ids.push([audit.id === auditBase ? "acceptedAuditId" : `audit:${audit.id}`, audit.id]);
  return Object.fromEntries(ids.sort(([left], [right]) => compareUtf8(left, right)));
}

/**
 * Canonical runtime plan shared by optimistic and locked reproduction. Typed row keys come from
 * the pure coordinator's exact mutation set; SQL consumes the same execution payload and IDs.
 */
export function materializeCommandMutationPlan(
  request: ManualResolutionEnvelope,
  execution: ManualResolutionEnvelope,
  expansionId: string,
  guards: readonly {
    readonly key: string;
    readonly guardType: string;
    readonly canonicalPayload: Uint8Array;
  }[],
  requiredKeys: readonly string[],
  result: ManualResolutionResult,
  resultId: string,
  auditBase: string,
  typedIntents: {
    readonly creates: readonly PlannedTypedRow[];
    readonly updates: readonly PlannedTypedRow[];
    readonly supersedes: readonly PlannedTypedRow[];
    readonly audits: readonly PlannedAudit[];
  } = { creates: [], updates: [], supersedes: [], audits: [] },
): CommandMutationPlanV1 {
  const existing = requiredKeys.filter((key) => request.expectedVersions[key] !== null);
  const concurrency: CommandConcurrencyPlanV1 = {
    schemaVersion: "1",
    expansionId,
    guardPlan: guards.map((guard) => ({
      key: guard.key,
      guardType: guard.guardType,
      canonicalPayloadBase64: Buffer.from(guard.canonicalPayload).toString("base64"),
      expectedVersion: request.expectedVersions[guard.key] ?? null,
      operation: request.expectedVersions[guard.key] === null ? "CREATE" : "INCREMENT",
    })),
    callerExpectedVersions: request.expectedVersions,
    requiredCurrentExpectations: Object.fromEntries(
      requiredKeys.map((key) => [key, request.expectedVersions[key] ?? null]),
    ),
    existingTypedRows: existing.filter((key) => !key.startsWith("guard:")),
  };
  const creates = [...typedIntents.creates];
  const updates = [...typedIntents.updates];
  const supersedes = [...typedIntents.supersedes];
  const mappingTables = new Set([
    "m02_root_replacements",
    "m02_candidate_replacements",
    "m02_ownership_replacements",
    "m02_group_edge_replacements",
    "m02_job_supersessions",
  ]);
  const mappings = [...creates, ...updates, ...supersedes].filter((row) =>
    mappingTables.has(row.table),
  );
  const selected =
    execution.command === "RESOLVE_AMBIGUITY"
      ? (execution.payload.selectedCommand ?? "")
      : execution.command;
  const resourceId =
    execution.payload.resourceIdentityId ?? execution.payload.targetResourceIdentityId ?? null;
  const versionId =
    execution.payload.resourceVersionIdentityId ??
    execution.payload.forkResourceVersionId ??
    execution.payload.targetResourceVersionId ??
    null;
  const attachShape = expansionId.includes("ATTACH_NEW_VERSION:A1")
    ? "A1"
    : expansionId.includes("ATTACH_NEW_VERSION:A2")
      ? "A2"
      : "A3";
  const relationshipCorrection = execution.payload.priorRelationshipId !== undefined;
  const requireResolvedId = (value: string | null): string => {
    if (value === null) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
    return value;
  };
  const resultSurface =
    selected === "CREATE_RESOURCE"
      ? {
          mode: "CREATE_RESOURCE",
          outcome: "NEW_RESOURCE",
          resourceId,
          versionId,
          createdResources: [requireResolvedId(resourceId)],
          reusedResources: [],
          createdVersions: [requireResolvedId(versionId)],
          reusedVersions: [],
        }
      : selected === "ATTACH_NEW_VERSION"
        ? {
            mode: `ATTACH_NEW_VERSION_${attachShape}`,
            outcome: attachShape === "A1" ? "EXISTING_RESOURCE_NEW_VERSION" : "EXACT_REPEAT_REUSE",
            resourceId,
            versionId,
            createdResources: [],
            reusedResources: [requireResolvedId(resourceId)],
            createdVersions: attachShape === "A1" ? [requireResolvedId(versionId)] : [],
            reusedVersions: attachShape === "A1" ? [] : [requireResolvedId(versionId)],
          }
        : selected === "MARK_FORK"
          ? {
              mode: "MARK_FORK",
              outcome: "FORK_OF_EXISTING_RESOURCE",
              resourceId,
              versionId,
              createdResources: relationshipCorrection ? [] : [requireResolvedId(resourceId)],
              reusedResources: relationshipCorrection ? [requireResolvedId(resourceId)] : [],
              createdVersions: relationshipCorrection ? [] : [requireResolvedId(versionId)],
              reusedVersions: relationshipCorrection ? [requireResolvedId(versionId)] : [],
            }
          : selected === "MARK_MIRROR"
            ? {
                mode: "MARK_MIRROR",
                outcome: "MIRROR",
                resourceId,
                versionId,
                createdResources: [],
                reusedResources: [requireResolvedId(resourceId)],
                createdVersions: [],
                reusedVersions: [requireResolvedId(versionId)],
              }
            : selected === "MARK_DUPLICATE"
              ? {
                  mode: "MARK_DUPLICATE",
                  outcome: "POSSIBLE_DUPLICATE",
                  resourceId: null,
                  versionId: null,
                  createdResources: [],
                  reusedResources: [],
                  createdVersions: [],
                  reusedVersions: [],
                }
              : {
                  mode: null,
                  outcome: null,
                  resourceId: null,
                  versionId: null,
                  createdResources: [],
                  reusedResources: [],
                  createdVersions: [],
                  reusedVersions: [],
                };
  const resultRow: PlannedTypedRow = {
    table: "m02_manual_command_results",
    id: resultId,
    completeTypedValues: {
      id: resultId,
      command_id: execution.commandId,
      request_id: execution.requestId,
      request_fingerprint: fingerprintM02Payload(request as unknown as CanonicalM02Value),
      mutation_plan_fingerprint: "$SELF",
      result_fingerprint: fingerprintM02Payload(result as unknown as CanonicalM02Value),
      ordered_target_ids: result.orderedTargetIds,
      record_versions: result.recordVersions,
      result_payload: result as unknown as CanonicalM02Value,
      identity_projection_mode_id: resultSurface.mode,
      identity_outcome: resultSurface.outcome,
      resource_identity_id: resultSurface.resourceId,
      resource_version_identity_id: resultSurface.versionId,
      created_resource_identity_ids: [...resultSurface.createdResources].sort(compareUtf8),
      reused_resource_identity_ids: [...resultSurface.reusedResources].sort(compareUtf8),
      created_resource_version_identity_ids: [...resultSurface.createdVersions].sort(compareUtf8),
      reused_resource_version_identity_ids: [...resultSurface.reusedVersions].sort(compareUtf8),
      created_at: execution.timestamp,
    },
  };
  if (typedIntents.audits.length === 0) throw new ManualResolutionError("MUTATION_PLAN_CHANGED");
  const audits: PlannedAudit[] = [...typedIntents.audits];
  return finalizeCommandMutationPlan(concurrency, {
    allocatedIds: persistedAllocatedIds(resultId, auditBase, creates, audits),
    creates,
    updates,
    supersedes,
    mappings,
    result: resultRow,
    audits,
    postconditions: [
      ...[...creates, ...updates, ...supersedes].map((row) => {
        const values = row.completeTypedValues;
        const stateColumn = ["state", "status", "review_state", "supersession_state"].find(
          (column) => values[column] !== undefined,
        );
        return {
          table: row.table,
          id: row.id,
          expectedRecordVersion: values.record_version ?? null,
          expectedStateColumn: stateColumn ?? null,
          expectedState: stateColumn === undefined ? null : (values[stateColumn] ?? null),
          expectedForeignKeys: Object.fromEntries(
            Object.entries(values).filter(
              ([column, value]) => column !== "id" && column.endsWith("_id") && value !== null,
            ),
          ),
        };
      }),
      ...creates.flatMap((row) => {
        const values = row.completeTypedValues;
        if (row.table === "fork_relationships")
          return [
            {
              collisionTable: row.table,
              collisionColumns: ["fork_resource_version_id", "state"],
              collisionValues: [values.fork_resource_version_id ?? null, "ACTIVE"],
              expectedCount: 1,
            },
          ];
        if (row.table === "source_repository_relationships")
          return [
            {
              collisionTable: row.table,
              collisionColumns: ["mirror_source_repository_id", "state"],
              collisionValues: [values.mirror_source_repository_id ?? null, "ACTIVE"],
              expectedCount: 1,
            },
          ];
        if (row.table === "duplicate_candidates")
          return [
            {
              collisionTable: row.table,
              collisionColumns: ["resource_candidate_id", "target_resource_version_id", "status"],
              collisionValues: [
                values.resource_candidate_id ?? null,
                values.target_resource_version_id ?? null,
                "CONFIRMED",
              ],
              expectedCount: 1,
            },
          ];
        return [];
      }),
      ...(execution.command === "ATTACH_NEW_VERSION" ||
      (execution.command === "RESOLVE_AMBIGUITY" &&
        execution.payload.selectedCommand === "ATTACH_NEW_VERSION")
        ? [
            {
              table: "resource_identities",
              id: execution.payload.resourceIdentityId ?? "",
              reuse: true,
            },
            {
              table: "resource_version_identities",
              id: execution.payload.resourceVersionIdentityId ?? "",
              reuse: expansionId.includes(":A2:") || expansionId.includes(":A3:"),
            },
          ]
        : []),
    ],
  });
}
