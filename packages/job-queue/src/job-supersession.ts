import type { AcquisitionJobStatus, Role } from "@ai-ark/contracts";
import { canonicalM02Json, fingerprintM02Payload, sha256Base64Url } from "@ai-ark/classification";

export type M02OperationScope = "CLASSIFICATION" | "IDENTITY_RESOLUTION" | "FULL_PIPELINE";
export type SupersessionState = "CONTROLLING" | "SUPERSEDED";

export type M02JobReplacementReason =
  | "FAILED_STAGE_REPLACEMENT"
  | "RETRY_EXHAUSTED"
  | "NEW_SUPPORTED_SNAPSHOT"
  | "POLICY_OR_METHODOLOGY_CHANGE"
  | "ADMINISTRATIVE_CORRECTION";

export interface M02JobRecord {
  readonly id: string;
  readonly jobLineageId: string;
  readonly acquisitionStatus: AcquisitionJobStatus;
  readonly operationScope: M02OperationScope;
  readonly jobScopeKey: string;
  readonly supersessionState: SupersessionState;
  readonly supersededByJobId: string | null;
  readonly supersessionSequence: number;
  readonly controllingClassificationDecisionId: string | null;
  readonly sourceSnapshotId: string | null;
  readonly inputFingerprint: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly analysisPolicyVersion: string;
  readonly promptBundleVersion: string;
  readonly recordVersion: number;
}

export interface M02SourceSnapshotEligibility {
  readonly id: string;
  readonly jobLineageId: string;
  readonly completed: boolean;
  readonly supported: boolean;
}

export interface M02ReplacementInputRecord {
  readonly replacementJobId: string;
  readonly jobLineageId: string;
  readonly sourceSnapshotId: string | null;
  readonly inputFingerprint: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly analysisPolicyVersion: string;
  readonly promptBundleVersion: string;
}

export interface ReplaceM02JobRequest {
  readonly commandId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly sourceJobId: string;
  readonly replacementJobId: string;
  readonly operationScope: M02OperationScope;
  readonly replacementSourceSnapshotId: string | null;
  readonly replacementInputFingerprint: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly analysisPolicyVersion: string;
  readonly promptBundleVersion: string;
  readonly reasonCode: M02JobReplacementReason;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly actorId: string;
  readonly actorRole: Role;
  readonly expectedVersions: Readonly<Record<string, number | null>>;
  readonly occurredAt: string;
}

export interface M02JobSupersessionAudit {
  readonly sourceJobId: string;
  readonly replacementJobId: string;
  readonly reasonCode: M02JobReplacementReason;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface ReplaceM02JobResult {
  readonly replacement: M02JobRecord;
  readonly supersededJobIds: readonly string[];
  readonly audit: M02JobSupersessionAudit;
}

export function createJobLineageGuardKey(
  jobLineageId: string,
  operationScope: M02OperationScope,
): string {
  const payload = canonicalM02Json({
    components: { jobLineageId, operationScope },
    guardType: "job-lineage",
  });
  return `guard:job-lineage:${sha256Base64Url(payload)}`;
}

export function createM02JobScopeKey(
  jobLineageId: string,
  operationScope: M02OperationScope,
): string {
  return fingerprintM02Payload({ jobLineageId, operationScope });
}

function requestFingerprint(request: ReplaceM02JobRequest): string {
  return fingerprintM02Payload({
    commandId: request.commandId,
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    sourceJobId: request.sourceJobId,
    replacementJobId: request.replacementJobId,
    operationScope: request.operationScope,
    replacementSourceSnapshotId: request.replacementSourceSnapshotId,
    replacementInputFingerprint: request.replacementInputFingerprint,
    classificationPolicyVersion: request.classificationPolicyVersion,
    identityPolicyVersion: request.identityPolicyVersion,
    analysisPolicyVersion: request.analysisPolicyVersion,
    promptBundleVersion: request.promptBundleVersion,
    reasonCode: request.reasonCode,
    reason: request.reason,
    evidenceIds: request.evidenceIds,
    actorId: request.actorId,
    actorRole: request.actorRole,
    expectedVersions: request.expectedVersions,
    occurredAt: request.occurredAt,
  });
}

const REPLACEMENT_REQUEST_KEYS = [
  "actorId",
  "actorRole",
  "analysisPolicyVersion",
  "classificationPolicyVersion",
  "commandId",
  "evidenceIds",
  "expectedVersions",
  "idempotencyKey",
  "identityPolicyVersion",
  "occurredAt",
  "operationScope",
  "promptBundleVersion",
  "reason",
  "reasonCode",
  "replacementInputFingerprint",
  "replacementJobId",
  "replacementSourceSnapshotId",
  "requestId",
  "sourceJobId",
] as const;

function assertReplacementEnvelope(request: ReplaceM02JobRequest): void {
  if (
    canonicalM02Json(Object.keys(request).sort()) !== canonicalM02Json(REPLACEMENT_REQUEST_KEYS)
  ) {
    throw new Error("REFERENCE_INVALID");
  }
  for (const id of [
    request.commandId,
    request.requestId,
    request.idempotencyKey,
    request.sourceJobId,
    request.replacementJobId,
    request.actorId,
  ]) {
    if (id.length === 0) throw new Error("REFERENCE_INVALID");
  }
  if (
    new Set(request.evidenceIds).size !== request.evidenceIds.length ||
    request.evidenceIds.some((id) => id.length === 0) ||
    request.evidenceIds.some(
      (id, index) =>
        index > 0 &&
        Buffer.from(id).compare(Buffer.from(request.evidenceIds[index - 1] ?? "")) <= 0,
    )
  ) {
    throw new Error("REFERENCE_INVALID");
  }
  const occurredAtMs = Date.parse(request.occurredAt);
  if (
    !Number.isFinite(occurredAtMs) ||
    new Date(occurredAtMs).toISOString() !== request.occurredAt
  ) {
    throw new Error("REFERENCE_INVALID");
  }
}

function idempotencyScopeKey(request: ReplaceM02JobRequest): string {
  return fingerprintM02Payload({
    idempotencyKey: request.idempotencyKey,
    operationScope: request.operationScope,
    sourceJobId: request.sourceJobId,
  });
}

function copyJob(job: M02JobRecord): M02JobRecord {
  return { ...job };
}

function copyResult(result: ReplaceM02JobResult): ReplaceM02JobResult {
  return {
    replacement: copyJob(result.replacement),
    supersededJobIds: [...result.supersededJobIds],
    audit: { ...result.audit },
  };
}

function scopesInvalidatedBy(replacementScope: M02OperationScope): readonly M02OperationScope[] {
  if (replacementScope === "FULL_PIPELINE") {
    return ["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"];
  }
  if (replacementScope === "CLASSIFICATION") {
    return ["CLASSIFICATION", "IDENTITY_RESOLUTION"];
  }
  return ["IDENTITY_RESOLUTION"];
}

function assertReason(reason: string): void {
  const size = Buffer.byteLength(reason, "utf8");
  if (size < 1 || size > 2_000) throw new Error("REFERENCE_INVALID");
}

function assertAuthorized(source: M02JobRecord, request: ReplaceM02JobRequest): void {
  if (!["ADMIN", "EDITOR", "TECHNICAL_REVIEWER"].includes(request.actorRole)) {
    throw new Error("ROLE_NOT_AUTHORIZED");
  }
  if (request.actorRole === "ADMIN" && request.reasonCode === "ADMINISTRATIVE_CORRECTION") return;
  const { acquisitionStatus: status } = source;
  if (status === "FAILED" && request.reasonCode === "FAILED_STAGE_REPLACEMENT") return;
  if (status === "OPERATOR_REVIEW_REQUIRED" && request.reasonCode === "RETRY_EXHAUSTED") return;

  if (status === "COMPLETED") {
    if (!["ADMIN", "EDITOR"].includes(request.actorRole)) throw new Error("ROLE_NOT_AUTHORIZED");
    if (
      request.reasonCode !== "NEW_SUPPORTED_SNAPSHOT" &&
      request.reasonCode !== "POLICY_OR_METHODOLOGY_CHANGE"
    ) {
      throw new Error("TRANSITION_PROHIBITED");
    }
    if (request.replacementInputFingerprint === source.inputFingerprint) {
      throw new Error("REPLACEMENT_INPUT_UNCHANGED");
    }
    return;
  }

  if (request.actorRole !== "ADMIN") throw new Error("ROLE_NOT_AUTHORIZED");
  if (request.reasonCode !== "ADMINISTRATIVE_CORRECTION") {
    throw new Error("TRANSITION_PROHIBITED");
  }
}

export interface M02AggregateInput {
  readonly candidates: readonly {
    readonly id: string;
    readonly disposition: "IDENTITY_RESOLVED" | "IDENTITY_REVIEW_REQUIRED" | "REJECTED";
  }[];
  readonly completedEvidenceIds: readonly string[];
  readonly failureCode: "FAILED_CLASSIFICATION" | "FAILED_IDENTITY" | null;
  readonly cancelled: boolean;
}

export function aggregateM02JobResult(input: M02AggregateInput) {
  const readyCandidateIds = input.candidates
    .filter(({ disposition }) => disposition === "IDENTITY_RESOLVED")
    .map(({ id }) => id)
    .sort();
  const retainedEvidenceIds = [...new Set(input.completedEvidenceIds)].sort();
  const unresolved = input.candidates.some(
    ({ disposition }) => disposition === "IDENTITY_REVIEW_REQUIRED",
  );
  if (input.cancelled) {
    return {
      status: "CANCELLED" as const,
      reviewState: "NOT_REQUIRED" as const,
      readyCandidateIds,
      retainedEvidenceIds,
      handoffAllowed: false,
    };
  }
  if (input.failureCode !== null) {
    return {
      status: "FAILED" as const,
      reviewState: unresolved ? ("IDENTITY_REVIEW_REQUIRED" as const) : ("NOT_REQUIRED" as const),
      readyCandidateIds,
      retainedEvidenceIds,
      handoffAllowed: false,
    };
  }
  if (unresolved) {
    return {
      status: "OPERATOR_REVIEW_REQUIRED" as const,
      reviewState: "IDENTITY_REVIEW_REQUIRED" as const,
      readyCandidateIds,
      retainedEvidenceIds,
      handoffAllowed: false,
    };
  }
  return {
    status: "COMPLETED" as const,
    reviewState: "RESOLVED" as const,
    readyCandidateIds,
    retainedEvidenceIds,
    handoffAllowed: readyCandidateIds.length > 0,
  };
}

export class DeterministicM02JobStore {
  private readonly jobs = new Map<string, M02JobRecord>();
  private readonly guardVersions = new Map<string, number>();
  private readonly idempotency = new Map<
    string,
    { readonly fingerprint: string; readonly result: ReplaceM02JobResult }
  >();
  private readonly audits: M02JobSupersessionAudit[] = [];
  private readonly snapshots = new Map<string, M02SourceSnapshotEligibility>();
  private readonly replacementInputs = new Map<string, M02ReplacementInputRecord>();

  public constructor(
    initialJobs: readonly M02JobRecord[] = [],
    snapshots: readonly M02SourceSnapshotEligibility[] = [],
    replacementInputs: readonly M02ReplacementInputRecord[] = [],
  ) {
    for (const job of initialJobs) {
      if (this.jobs.has(job.id)) throw new Error("RECORD_ALREADY_EXISTS");
      if (job.jobScopeKey !== createM02JobScopeKey(job.jobLineageId, job.operationScope)) {
        throw new Error("REFERENCE_INVALID");
      }
      this.jobs.set(job.id, copyJob(job));
    }
    for (const snapshot of snapshots) {
      if (this.snapshots.has(snapshot.id)) throw new Error("RECORD_ALREADY_EXISTS");
      this.snapshots.set(snapshot.id, { ...snapshot });
    }
    for (const input of replacementInputs) {
      if (this.replacementInputs.has(input.replacementJobId)) {
        throw new Error("RECORD_ALREADY_EXISTS");
      }
      this.replacementInputs.set(input.replacementJobId, { ...input });
    }
  }

  public get(jobId: string): M02JobRecord | undefined {
    const job = this.jobs.get(jobId);
    return job === undefined ? undefined : copyJob(job);
  }

  public history(jobLineageId: string): readonly M02JobRecord[] {
    return [...this.jobs.values()]
      .filter((job) => job.jobLineageId === jobLineageId)
      .sort((a, b) => a.supersessionSequence - b.supersessionSequence || a.id.localeCompare(b.id))
      .map(copyJob);
  }

  public auditHistory(): readonly M02JobSupersessionAudit[] {
    return this.audits.map((audit) => ({ ...audit }));
  }

  public assertCanWrite(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job === undefined) throw new Error("RECORD_NOT_FOUND");
    if (job.supersessionState !== "CONTROLLING") throw new Error("JOB_SUPERSEDED");
    if (job.acquisitionStatus === "CANCELLED") throw new Error("TRANSITION_PROHIBITED");
    const higherController = [...this.jobs.values()].find(
      (candidate) =>
        candidate.jobLineageId === job.jobLineageId &&
        candidate.supersessionState === "CONTROLLING" &&
        candidate.id !== job.id &&
        scopesInvalidatedBy(candidate.operationScope).includes(job.operationScope),
    );
    if (higherController !== undefined) throw new Error("JOB_SUPERSEDED");
  }

  public replace(request: ReplaceM02JobRequest): ReplaceM02JobResult {
    assertReplacementEnvelope(request);
    const idempotencyScope = idempotencyScopeKey(request);
    const fingerprint = requestFingerprint(request);
    const replay = this.idempotency.get(idempotencyScope);
    if (replay !== undefined) {
      if (replay.fingerprint !== fingerprint) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return copyResult(replay.result);
    }

    const source = this.jobs.get(request.sourceJobId);
    if (source === undefined) throw new Error("RECORD_NOT_FOUND");
    if (source.supersessionState !== "CONTROLLING") throw new Error("JOB_SUPERSEDED");
    if (request.sourceJobId === request.replacementJobId) throw new Error("TRANSITION_PROHIBITED");
    if (source.jobLineageId.length === 0) throw new Error("REFERENCE_INVALID");
    assertReason(request.reason);
    for (const version of [
      request.classificationPolicyVersion,
      request.identityPolicyVersion,
      request.analysisPolicyVersion,
      request.promptBundleVersion,
    ]) {
      if (version.length === 0) throw new Error("REFERENCE_INVALID");
    }
    if (!/^[0-9a-f]{64}$/u.test(request.replacementInputFingerprint)) {
      throw new Error("REFERENCE_INVALID");
    }
    const replacementInput = this.replacementInputs.get(request.replacementJobId);
    const effectiveSourceSnapshotId =
      request.replacementSourceSnapshotId ?? source.sourceSnapshotId;
    if (
      replacementInput?.jobLineageId !== source.jobLineageId ||
      replacementInput.sourceSnapshotId !== effectiveSourceSnapshotId ||
      replacementInput.inputFingerprint !== request.replacementInputFingerprint ||
      replacementInput.classificationPolicyVersion !== request.classificationPolicyVersion ||
      replacementInput.identityPolicyVersion !== request.identityPolicyVersion ||
      replacementInput.analysisPolicyVersion !== request.analysisPolicyVersion ||
      replacementInput.promptBundleVersion !== request.promptBundleVersion
    ) {
      throw new Error("REFERENCE_INVALID");
    }

    const scopeAllowed =
      request.operationScope === source.operationScope ||
      request.operationScope === "FULL_PIPELINE";
    if (!scopeAllowed) throw new Error("TRANSITION_PROHIBITED");
    if (
      request.operationScope === "IDENTITY_RESOLUTION" &&
      source.controllingClassificationDecisionId === null
    ) {
      throw new Error("REFERENCE_INVALID");
    }
    if (
      request.operationScope === "IDENTITY_RESOLUTION" &&
      [...this.jobs.values()].some(
        (job) =>
          job.jobLineageId === source.jobLineageId &&
          job.operationScope === "CLASSIFICATION" &&
          job.supersessionState === "CONTROLLING" &&
          job.acquisitionStatus !== "COMPLETED",
      )
    ) {
      throw new Error("TRANSITION_PROHIBITED");
    }
    assertAuthorized(source, request);
    if (request.reasonCode === "ADMINISTRATIVE_CORRECTION" && request.evidenceIds.length === 0) {
      throw new Error("REFERENCE_INVALID");
    }
    const effectiveSnapshotId = request.replacementSourceSnapshotId ?? source.sourceSnapshotId;
    if (effectiveSnapshotId === null) throw new Error("REFERENCE_INVALID");
    const effectiveSnapshot = this.snapshots.get(effectiveSnapshotId);
    if (
      effectiveSnapshot === undefined ||
      !effectiveSnapshot.completed ||
      !effectiveSnapshot.supported ||
      effectiveSnapshot.jobLineageId !== source.jobLineageId
    ) {
      throw new Error("REFERENCE_INVALID");
    }
    if (request.reasonCode === "NEW_SUPPORTED_SNAPSHOT") {
      if (
        request.replacementSourceSnapshotId === null ||
        request.replacementSourceSnapshotId === source.sourceSnapshotId
      ) {
        throw new Error("REPLACEMENT_INPUT_UNCHANGED");
      }
      const snapshot = this.snapshots.get(request.replacementSourceSnapshotId);
      if (
        snapshot === undefined ||
        !snapshot.completed ||
        !snapshot.supported ||
        snapshot.jobLineageId !== source.jobLineageId
      ) {
        throw new Error("REFERENCE_INVALID");
      }
    }

    const invalidatedScopes = scopesInvalidatedBy(request.operationScope);
    const invalidated = [...this.jobs.values()]
      .filter(
        (job) =>
          job.jobLineageId === source.jobLineageId &&
          job.supersessionState === "CONTROLLING" &&
          (job.id === source.id || invalidatedScopes.includes(job.operationScope)),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const guardKeys = [
      ...new Set([
        ...invalidated.map((job) =>
          createJobLineageGuardKey(source.jobLineageId, job.operationScope),
        ),
        createJobLineageGuardKey(source.jobLineageId, request.operationScope),
      ]),
    ].sort();
    const requiredKeys = [
      ...invalidated.map((job) => `job:${job.id}`),
      `job:${request.replacementJobId}`,
      ...guardKeys,
    ].sort();
    const suppliedKeys = Object.keys(request.expectedVersions).sort();
    if (canonicalM02Json(requiredKeys) !== canonicalM02Json(suppliedKeys)) {
      throw new Error("EXPECTED_VERSION_SET_INVALID");
    }
    for (const job of invalidated) {
      const expected = request.expectedVersions[`job:${job.id}`];
      if (expected === null) throw new Error("RECORD_ALREADY_EXISTS");
      if (expected !== job.recordVersion) throw new Error("STALE_RECORD_VERSION");
    }
    const replacementExpectation = request.expectedVersions[`job:${request.replacementJobId}`];
    const existingReplacement = this.jobs.get(request.replacementJobId);
    if (replacementExpectation === null && existingReplacement !== undefined) {
      throw new Error("RECORD_ALREADY_EXISTS");
    }
    if (replacementExpectation !== null) {
      if (existingReplacement === undefined) throw new Error("RECORD_NOT_FOUND");
      throw new Error("RECORD_ALREADY_EXISTS");
    }
    const guardVersions = new Map<string, number | undefined>();
    for (const guardKey of guardKeys) {
      const guardExpectation = request.expectedVersions[guardKey];
      const guardVersion = this.guardVersions.get(guardKey);
      guardVersions.set(guardKey, guardVersion);
      if (guardExpectation === null && guardVersion !== undefined)
        throw new Error("RECORD_ALREADY_EXISTS");
      if (guardExpectation !== null) {
        if (guardVersion === undefined) throw new Error("RECORD_NOT_FOUND");
        if (guardExpectation !== guardVersion) throw new Error("STALE_RECORD_VERSION");
      }
    }

    const sequence =
      Math.max(...this.history(source.jobLineageId).map((job) => job.supersessionSequence)) + 1;
    const replacement: M02JobRecord = {
      id: request.replacementJobId,
      jobLineageId: source.jobLineageId,
      acquisitionStatus: "ACTIVE",
      operationScope: request.operationScope,
      jobScopeKey: createM02JobScopeKey(source.jobLineageId, request.operationScope),
      supersessionState: "CONTROLLING",
      supersededByJobId: null,
      supersessionSequence: sequence,
      controllingClassificationDecisionId:
        request.operationScope === "IDENTITY_RESOLUTION"
          ? source.controllingClassificationDecisionId
          : null,
      sourceSnapshotId: request.replacementSourceSnapshotId ?? source.sourceSnapshotId,
      inputFingerprint: request.replacementInputFingerprint,
      classificationPolicyVersion: request.classificationPolicyVersion,
      identityPolicyVersion: request.identityPolicyVersion,
      analysisPolicyVersion: request.analysisPolicyVersion,
      promptBundleVersion: request.promptBundleVersion,
      recordVersion: 1,
    };
    for (const job of invalidated) {
      this.jobs.set(job.id, {
        ...job,
        supersessionState: "SUPERSEDED",
        supersededByJobId: replacement.id,
        recordVersion: job.recordVersion + 1,
      });
    }
    this.jobs.set(replacement.id, replacement);
    for (const guardKey of guardKeys) {
      this.guardVersions.set(guardKey, (guardVersions.get(guardKey) ?? 0) + 1);
    }
    const audit = {
      sourceJobId: source.id,
      replacementJobId: replacement.id,
      reasonCode: request.reasonCode,
      actorId: request.actorId,
      occurredAt: request.occurredAt,
    } as const;
    this.audits.push(
      ...invalidated.map((job) => ({
        ...audit,
        sourceJobId: job.id,
      })),
    );
    const result = {
      replacement: copyJob(replacement),
      supersededJobIds: invalidated.map((job) => job.id),
      audit,
    } as const;
    this.idempotency.set(idempotencyScope, { fingerprint, result });
    return copyResult(result);
  }
}
