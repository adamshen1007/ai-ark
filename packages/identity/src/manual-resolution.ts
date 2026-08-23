import {
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  hasMatchingCanonicalPayload,
  normalizeIdentityToken,
  sha256Base64Url,
  type CanonicalM02Value,
} from "@ai-ark/classification";
import type { Role } from "@ai-ark/contracts";

import { authorizeCommand, type IdentityManualResolutionCommand } from "./identity.js";

type ExpectedVersions = Readonly<Record<string, number | null>>;

export interface ManualResolutionEnvelope {
  readonly commandId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly actorId: string;
  readonly actorRole: Role;
  readonly command: IdentityManualResolutionCommand;
  readonly targetCandidateId: string;
  readonly targetGroupId: string;
  readonly expectedVersions: ExpectedVersions;
  readonly reasonCode: string;
  readonly reason: string;
  readonly evidenceIds: readonly string[];
  readonly decisionIds: readonly string[];
  readonly timestamp: string;
  readonly payload: Readonly<Record<string, string>>;
}

export interface VersionedRecord {
  readonly recordVersion: number;
  readonly value: unknown;
}

export interface ManualResolutionDomainMutation {
  readonly key: string;
  readonly value: Readonly<Record<string, unknown>>;
}

export interface ClassificationCommandMutationPort {
  deriveMutations(command: ManualResolutionEnvelope): readonly ManualResolutionDomainMutation[];
}

export interface JobCommandMutationPort {
  deriveMutations(
    command: ManualResolutionEnvelope,
    readRecord: (key: string) => VersionedRecord | undefined,
    requiredKeys: readonly string[],
  ): readonly ManualResolutionDomainMutation[];
}

class InMemoryClassificationCommandMutationPort implements ClassificationCommandMutationPort {
  deriveMutations(command: ManualResolutionEnvelope): readonly ManualResolutionDomainMutation[] {
    const candidateKey = `candidate:${command.targetCandidateId}`;
    const identityResolved = (
      resourceIdentityId: string | null | undefined,
      resourceVersionIdentityId: string | null | undefined,
    ): ManualResolutionDomainMutation[] => [
      {
        key: candidateKey,
        value: {
          status: "IDENTITY_RESOLVED",
          resourceIdentityId,
          resourceVersionIdentityId,
        },
      },
      {
        key: `review:${command.payload.reviewId ?? ""}`,
        value: { state: "RESOLVED" },
      },
    ];
    switch (command.command) {
      case "CREATE_RESOURCE":
        return [
          ...identityResolved(
            command.payload.resourceIdentityId,
            command.payload.resourceVersionIdentityId,
          ),
          {
            key: `resource:${command.payload.resourceIdentityId ?? ""}`,
            value: {
              type: "SKILL",
              status: "ACTIVE",
              reliableIdentityToken: command.payload.reliableIdentityToken,
              reliableTokenEvidenceId: command.payload.reliableTokenEvidenceId,
            },
          },
          {
            key: `version:${command.payload.resourceVersionIdentityId ?? ""}`,
            value: {
              status: "IDENTITY_RESOLVED",
              resourceIdentityId: command.payload.resourceIdentityId,
              contentFingerprint: command.payload.contentFingerprint,
              firstObservedSourceSnapshotId: command.payload.sourceSnapshotId,
              firstObservedCandidateRootId: command.payload.candidateRootId,
            },
          },
          {
            key: `source-link:${command.payload.sourceLinkId ?? ""}`,
            value: {
              status: "ACTIVE",
              kind: "PRIMARY",
              provider: command.payload.provider,
              providerRepositoryId: command.payload.providerRepositoryId,
              normalizedRoot: command.payload.normalizedRoot,
              targetResourceVersionId: command.payload.resourceVersionIdentityId,
            },
          },
          {
            key: `observation:${command.payload.observationId ?? ""}`,
            value: { sourceSnapshotId: command.payload.sourceSnapshotId, status: "OBSERVED" },
          },
        ];
      case "ATTACH_NEW_VERSION":
        return [
          ...identityResolved(
            command.payload.resourceIdentityId,
            command.payload.resourceVersionIdentityId,
          ),
          ...(command.expectedVersions[
            `version:${command.payload.resourceVersionIdentityId ?? ""}`
          ] === null
            ? [
                {
                  key: `version:${command.payload.resourceVersionIdentityId ?? ""}`,
                  value: {
                    status: "IDENTITY_RESOLVED",
                    resourceIdentityId: command.payload.resourceIdentityId,
                    contentFingerprint: command.payload.contentFingerprint,
                  },
                },
              ]
            : []),
          {
            key: `source-link:${command.payload.sourceLinkId ?? ""}`,
            value: {
              status: "ACTIVE",
              targetResourceVersionId: command.payload.resourceVersionIdentityId,
              supersedesSourceLinkId: command.payload.activeSourceLinkId,
              continuityEvidenceIds: commaList(command.payload.continuityEvidenceIds),
            },
          },
          {
            key: `observation:${command.payload.observationId ?? ""}`,
            value: { sourceSnapshotId: command.payload.sourceSnapshotId, status: "OBSERVED" },
          },
        ];
      case "MARK_FORK":
        return [
          ...identityResolved(
            command.payload.resourceIdentityId,
            command.payload.forkResourceVersionId,
          ),
          ...(command.expectedVersions[`resource:${command.payload.resourceIdentityId ?? ""}`] ===
          null
            ? [
                {
                  key: `resource:${command.payload.resourceIdentityId ?? ""}`,
                  value: {
                    type: "SKILL",
                    status: "ACTIVE",
                    reliableIdentityToken: command.payload.reliableIdentityToken,
                    reliableTokenEvidenceId: command.payload.reliableTokenEvidenceId,
                  },
                },
              ]
            : []),
          ...(command.expectedVersions[`version:${command.payload.forkResourceVersionId ?? ""}`] ===
          null
            ? [
                {
                  key: `version:${command.payload.forkResourceVersionId ?? ""}`,
                  value: {
                    status: "IDENTITY_RESOLVED",
                    resourceIdentityId: command.payload.resourceIdentityId,
                    contentFingerprint: command.payload.contentFingerprint,
                  },
                },
              ]
            : []),
          {
            key: `fork:${command.payload.relationshipId ?? ""}`,
            value: {
              status: "ACTIVE",
              forkResourceVersionId: command.payload.forkResourceVersionId,
              originResourceVersionId: command.payload.originResourceVersionId,
              supersedesRelationshipId: command.payload.priorRelationshipId ?? null,
            },
          },
          ...(command.payload.priorRelationshipId === undefined
            ? []
            : [
                {
                  key: `fork:${command.payload.priorRelationshipId}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByRelationshipId: command.payload.relationshipId,
                  },
                },
                {
                  key: `decision:${command.payload.priorDecisionId ?? ""}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByDecisionId: command.payload.decisionId,
                  },
                },
              ]),
          {
            key: `source-link:${command.payload.sourceLinkId ?? ""}`,
            value: {
              status: "ACTIVE",
              targetResourceVersionId: command.payload.forkResourceVersionId,
            },
          },
          {
            key: `observation:${command.payload.observationId ?? ""}`,
            value: { sourceSnapshotId: command.payload.sourceSnapshotId, status: "OBSERVED" },
          },
        ];
      case "MARK_MIRROR":
        return [
          ...identityResolved(
            command.payload.targetResourceIdentityId,
            command.payload.targetResourceVersionId,
          ),
          {
            key: `mirror:${command.payload.relationshipId ?? ""}`,
            value: {
              status: "ACTIVE",
              mirrorSourceRepositoryId: command.payload.mirrorSourceRepositoryId,
              originSourceRepositoryId: command.payload.originSourceRepositoryId,
              supersedesRelationshipId: command.payload.priorRelationshipId ?? null,
            },
          },
          ...(command.payload.priorRelationshipId === undefined
            ? []
            : [
                {
                  key: `mirror:${command.payload.priorRelationshipId}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByRelationshipId: command.payload.relationshipId,
                  },
                },
                {
                  key: `source-link:${command.payload.priorSourceLinkId ?? ""}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededBySourceLinkId: command.payload.sourceLinkId,
                  },
                },
                {
                  key: `decision:${command.payload.priorDecisionId ?? ""}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByDecisionId: command.payload.decisionId,
                  },
                },
              ]),
          {
            key: `source-link:${command.payload.sourceLinkId ?? ""}`,
            value: {
              status: "ACTIVE",
              targetResourceVersionId: command.payload.targetResourceVersionId,
              sourceRepositoryId: command.payload.mirrorSourceRepositoryId,
              normalizedRoot: command.payload.normalizedRoot,
              identicalContentFingerprint: command.payload.identicalContentFingerprint,
            },
          },
          {
            key: `observation:${command.payload.observationId ?? ""}`,
            value: { sourceSnapshotId: command.payload.sourceSnapshotId, status: "OBSERVED" },
          },
        ];
      case "MARK_DUPLICATE":
        return [
          { key: candidateKey, value: { status: "REJECTED" } },
          {
            key: `duplicate:${command.payload.duplicateId ?? ""}`,
            value: {
              status: "CONFIRMED",
              targetResourceVersionId: command.payload.targetResourceVersionId,
              supersedesRelationshipId: command.payload.priorRelationshipId ?? null,
            },
          },
          ...(command.payload.priorRelationshipId === undefined
            ? []
            : [
                {
                  key: `duplicate:${command.payload.priorRelationshipId}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByRelationshipId: command.payload.duplicateId,
                  },
                },
                {
                  key: `decision:${command.payload.priorDecisionId ?? ""}`,
                  value: {
                    status: "SUPERSEDED",
                    supersededByDecisionId: command.payload.decisionId,
                  },
                },
              ]),
        ];
      case "REJECT_CANDIDATE":
        return [{ key: candidateKey, value: { status: "REJECTED" } }];
      case "REQUEST_CLARIFICATION":
        return [
          {
            key: `review:${command.payload.reviewId ?? ""}`,
            value: { state: "CLARIFICATION_REQUESTED" },
          },
        ];
      case "SPLIT_ROOTS":
      case "MERGE_ROOTS":
        return [
          { key: `group:${command.targetGroupId}`, value: { status: "SUPERSEDED" } },
          {
            key: `group:${command.payload.replacementGroupId ?? ""}`,
            value: { status: "ACTIVE", supersedesGroupId: command.targetGroupId },
          },
          {
            key: `classification-run:${command.payload.replacementRunId ?? ""}`,
            value: { status: "CONTROLLING" },
          },
          ...commaList(command.payload.originalCandidateIds).map((id) => ({
            key: `candidate:${id}`,
            value: { status: "SUPERSEDED" },
          })),
          ...commaList(command.payload.replacementCandidateIds).map((id) => ({
            key: `candidate:${id}`,
            value: { status: "CLASSIFIED" },
          })),
          ...commaList(command.payload.originalRootIds).map((id) => ({
            key: `root:${id}`,
            value: { status: "SUPERSEDED" },
          })),
          ...commaList(command.payload.replacementRootIds).map((id) => ({
            key: `root:${id}`,
            value: { status: "ACTIVE" },
          })),
        ];
      case "OVERRIDE_NON_SKILL":
        return [
          { key: `group:${command.targetGroupId}`, value: { status: "SUPERSEDED" } },
          {
            key: `group:${command.payload.replacementGroupId ?? ""}`,
            value: { status: "ACTIVE", classification: "HUMAN_OVERRIDE" },
          },
          {
            key: `classification-run:${command.payload.replacementRunId ?? ""}`,
            value: { status: "CONTROLLING", method: "HUMAN_OVERRIDE" },
          },
          ...commaList(command.payload.replacementCandidateIds).map((id) => ({
            key: `candidate:${id}`,
            value: { status: "CLASSIFIED" },
          })),
          ...commaList(command.payload.replacementRootIds).map((id) => ({
            key: `root:${id}`,
            value: { status: "ACTIVE" },
          })),
        ];
      case "RESOLVE_AMBIGUITY": {
        const selected = command.payload.selectedCommand as
          IdentityManualResolutionCommand | undefined;
        return selected === undefined
          ? []
          : [
              ...this.deriveMutations({ ...command, command: selected }),
              { key: `review:${command.payload.reviewId ?? ""}`, value: { state: "RESOLVED" } },
            ];
      }
      default:
        return [];
    }
  }
}

class InMemoryJobCommandMutationPort implements JobCommandMutationPort {
  deriveMutations(
    command: ManualResolutionEnvelope,
    readRecord: (key: string) => VersionedRecord | undefined,
    requiredKeys: readonly string[],
  ): readonly ManualResolutionDomainMutation[] {
    if (command.command === "REPLACE_M02_JOB") {
      const source = readRecord(`job:${command.payload.sourceJobId ?? ""}`)?.value as
        | {
            status?: string;
            supersessionState?: string;
            operationScope?: string;
            inputFingerprint?: string;
            jobLineageId?: string;
            sourceSnapshotId?: string;
            controllingClassificationDecisionId?: string | null;
          }
        | undefined;
      const replacementSnapshot =
        command.payload.replacementSnapshotId === undefined
          ? undefined
          : (readRecord(`snapshot:${command.payload.replacementSnapshotId}`)?.value as
              { status?: string; safetyState?: string; jobLineageId?: string } | undefined);
      const allowedReasons = new Set([
        "FAILED_STAGE_REPLACEMENT",
        "RETRY_EXHAUSTED",
        "NEW_SUPPORTED_SNAPSHOT",
        "POLICY_OR_METHODOLOGY_CHANGE",
        "ADMINISTRATIVE_CORRECTION",
      ]);
      const reason = command.reasonCode;
      if (!/^[a-f0-9]{64}$/u.test(command.payload.replacementInputFingerprint ?? ""))
        throw new ManualResolutionError("REFERENCE_INVALID");
      const requestedScope = command.payload.requestedOperationScope;
      const scopeAllowed =
        source?.operationScope === requestedScope ||
        (requestedScope === "FULL_PIPELINE" &&
          ["CLASSIFICATION", "IDENTITY_RESOLUTION"].includes(source?.operationScope ?? ""));
      if (source === undefined) throw new ManualResolutionError("REFERENCE_INVALID");
      if (
        !["ADMIN", "EDITOR", "TECHNICAL_REVIEWER"].includes(command.actorRole) ||
        source.supersessionState !== "CONTROLLING" ||
        !scopeAllowed ||
        (replacementSnapshot !== undefined &&
          (replacementSnapshot.status !== "COMPLETED" ||
            replacementSnapshot.safetyState !== "SAFE" ||
            replacementSnapshot.jobLineageId !== source.jobLineageId)) ||
        (reason === "NEW_SUPPORTED_SNAPSHOT" && replacementSnapshot === undefined) ||
        (reason === "NEW_SUPPORTED_SNAPSHOT" &&
          source.sourceSnapshotId === command.payload.replacementSnapshotId) ||
        !allowedReasons.has(reason)
      )
        throw new ManualResolutionError("ROLE_NOT_AUTHORIZED");
      const routineAllowed =
        (source.status === "FAILED" && reason === "FAILED_STAGE_REPLACEMENT") ||
        (source.status === "OPERATOR_REVIEW_REQUIRED" && reason === "RETRY_EXHAUSTED");
      const changedCompleted =
        source.status === "COMPLETED" &&
        source.inputFingerprint !== command.payload.replacementInputFingerprint &&
        ["NEW_SUPPORTED_SNAPSHOT", "POLICY_OR_METHODOLOGY_CHANGE"].includes(reason);
      const administrative = reason === "ADMINISTRATIVE_CORRECTION";
      if (
        !routineAllowed &&
        !(changedCompleted && command.actorRole !== "TECHNICAL_REVIEWER") &&
        !(administrative && command.actorRole === "ADMIN" && command.evidenceIds.length > 0)
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      const invalidatedJobIds = requiredKeys
        .filter(
          (key) =>
            key.startsWith("job:") && key !== `job:${command.payload.replacementJobId ?? ""}`,
        )
        .map((key) => key.slice("job:".length));
      const invalidatedJobs = invalidatedJobIds.map((id) => ({
        id,
        value: readRecord(`job:${id}`)?.value as Record<string, unknown> | undefined,
      }));
      const sequence =
        Math.max(...invalidatedJobs.map(({ value }) => Number(value?.supersessionSequence ?? 0))) +
        1;
      return [
        ...invalidatedJobIds.map((id) => ({
          key: `job:${id}`,
          value: {
            supersessionState: "SUPERSEDED",
            supersededByJobId: command.payload.replacementJobId,
          },
        })),
        ...invalidatedJobIds.map((id) => ({
          key: `job-supersession:${id}:${command.payload.replacementJobId ?? ""}`,
          value: {
            sourceJobId: id,
            replacementJobId: command.payload.replacementJobId,
            jobLineageId: source.jobLineageId,
            operationScope: requestedScope,
            reasonCode: command.reasonCode,
            actorId: command.actorId,
            evidenceIds: command.evidenceIds,
            supersessionSequence: sequence,
            status: "SUPERSEDED",
          },
        })),
        {
          key: `job:${command.payload.replacementJobId ?? ""}`,
          value: {
            status: "ACTIVE",
            supersessionState: "CONTROLLING",
            supersededByJobId: null,
            supersessionSequence: sequence,
            jobLineageId: source.jobLineageId,
            operationScope: requestedScope,
            sourceSnapshotId:
              command.payload.replacementSnapshotId ?? source.sourceSnapshotId ?? null,
            inputFingerprint: command.payload.replacementInputFingerprint,
            classificationPolicyVersion: command.payload.classificationPolicyVersion,
            identityPolicyVersion: command.payload.identityPolicyVersion,
            analysisPolicyVersion: command.payload.analysisPolicyVersion,
            promptBundleVersion: command.payload.promptBundleVersion,
            controllingClassificationDecisionId:
              requestedScope === "IDENTITY_RESOLUTION"
                ? (source.controllingClassificationDecisionId ?? null)
                : null,
          },
        },
      ];
    }
    const jobId = command.payload.jobId;
    if (jobId === undefined) return [];
    const status =
      command.command === "REQUEST_CLARIFICATION" ? "OPERATOR_REVIEW_REQUIRED" : "COMPLETED";
    return [{ key: `job:${jobId}`, value: { status } }];
  }
}

export class ManualResolutionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ManualResolutionError";
  }
}

interface ResourceVersionGuardRefV2 {
  readonly [key: string]: CanonicalM02Value;
  readonly kind: "RESOURCE_VERSION_ANCHOR";
  readonly resourceIdentityRef: {
    readonly [key: string]: CanonicalM02Value;
    readonly kind: "RESOURCE_IDENTITY_ANCHOR";
    readonly originCandidateId: string;
  };
  readonly contentFingerprint: string;
}

type GuardComponent = string | ResourceVersionGuardRefV2;

export function createGuardKey(guardType: string, components: readonly GuardComponent[]) {
  const guardPayload = { guardType, components };
  const canonicalPayload = canonicalM02JsonBytes(guardPayload);
  return {
    key: `guard:${guardType}:${sha256Base64Url(canonicalPayload)}`,
    canonicalPayload,
  };
}

function duplicateProposalSupersessionMutations(
  command: ManualResolutionEnvelope,
  proposalId: string | undefined,
): readonly ManualResolutionDomainMutation[] {
  if (proposalId === undefined) return [];
  return [
    {
      key: `duplicate:${proposalId}`,
      value: { status: "SUPERSEDED", supersededByCommandId: command.commandId },
    },
    {
      key: duplicateProposalAuditKey(proposalId),
      value: {
        action: "SUBJECT_SUPERSEDED",
        subjectType: "DUPLICATE_PROPOSAL",
        subjectId: proposalId,
        commandId: command.commandId,
      },
    },
  ];
}

class InMemoryManualResolutionStore {
  readonly auditEvents: { commandId: string; accepted: boolean; code: string | null }[] = [];
  private records = new Map<string, VersionedRecord>();
  private guards = new Map<string, { recordVersion: number; canonicalPayload: Uint8Array }>();
  private idempotency = new Map<string, { fingerprint: string; result: ManualResolutionResult }>();
  private serial: Promise<void> = Promise.resolve();

  constructor(
    private readonly classificationPort: ClassificationCommandMutationPort,
    private readonly jobPort: JobCommandMutationPort,
  ) {}

  seedRecord(key: string, recordVersion: number, value: unknown): void {
    this.records.set(key, { recordVersion, value });
  }

  getRecord(key: string): VersionedRecord | undefined {
    return this.records.get(key);
  }

  getGuard(
    key: string,
  ): { readonly recordVersion: number; readonly canonicalPayload: Uint8Array } | undefined {
    const guard = this.guards.get(key);
    return guard === undefined
      ? undefined
      : { recordVersion: guard.recordVersion, canonicalPayload: guard.canonicalPayload.slice() };
  }

  seedGuard(key: string, recordVersion: number, canonicalPayload: Uint8Array): void {
    this.guards.set(key, { recordVersion, canonicalPayload });
  }

  assertGuardPayload(key: string, attempted: Uint8Array): void {
    const stored = this.guards.get(key);
    if (stored !== undefined && !hasMatchingCanonicalPayload(stored.canonicalPayload, attempted)) {
      throw new ManualResolutionError("CONCURRENCY_GUARD_COLLISION");
    }
  }

  assertCommandAllowed(
    role: Role,
    command: IdentityManualResolutionCommand,
    replacementAuthorized = false,
  ): void {
    if ((command as string) === "OVERRIDE_UNSUPPORTED")
      throw new ManualResolutionError("UNSUPPORTED_OVERRIDE_PROHIBITED");
    if (!authorizeCommand(role, command, replacementAuthorized))
      throw new ManualResolutionError("ROLE_NOT_AUTHORIZED");
  }

  execute(command: ManualResolutionEnvelope): Promise<ManualResolutionResult> {
    const operation = this.serial.then(() => this.executeSerial(command));
    this.serial = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  deriveRequirements(command: ManualResolutionEnvelope): CommandRequirements {
    return deriveCommandRequirements(command, this.records);
  }

  snapshot() {
    return {
      records: [...this.records.entries()]
        .map(([key, value]) => [key, value.recordVersion] as const)
        .sort(),
      guards: [...this.guards.keys()].sort(),
      auditCount: this.auditEvents.length,
    };
  }

  createHandoffMarker(input: {
    readonly candidateId: string;
    readonly status: string;
    readonly resourceIdentityIds: readonly string[];
    readonly resourceVersionIdentityIds: readonly string[];
    readonly activeReview: boolean;
  }) {
    if (
      input.status !== "IDENTITY_RESOLVED" ||
      input.activeReview ||
      input.resourceIdentityIds.length !== 1 ||
      input.resourceVersionIdentityIds.length !== 1
    )
      return null;
    return {
      candidateId: input.candidateId,
      resourceIdentityId: input.resourceIdentityIds[0],
      resourceVersionIdentityId: input.resourceVersionIdentityIds[0],
    };
  }

  private executeSerial(command: ManualResolutionEnvelope): ManualResolutionResult {
    const fingerprint = fingerprintM02Payload({
      commandId: command.commandId,
      requestId: command.requestId,
      idempotencyKey: command.idempotencyKey,
      actorId: command.actorId,
      actorRole: command.actorRole,
      command: command.command,
      targetCandidateId: command.targetCandidateId,
      targetGroupId: command.targetGroupId,
      expectedVersions: command.expectedVersions,
      reasonCode: command.reasonCode,
      reason: command.reason,
      evidenceIds: command.evidenceIds,
      decisionIds: command.decisionIds,
      timestamp: command.timestamp,
      payload: command.payload,
    });
    const replay = this.idempotency.get(command.idempotencyKey);
    if (replay !== undefined) {
      if (replay.fingerprint !== fingerprint) {
        this.auditEvents.push({
          commandId: command.commandId,
          accepted: false,
          code: "IDEMPOTENCY_KEY_REUSED",
        });
        throw new ManualResolutionError("IDEMPOTENCY_KEY_REUSED");
      }
      return replay.result;
    }

    try {
      assertExactManualResolutionShape(command);
      if (command.command !== "REPLACE_M02_JOB")
        this.assertCommandAllowed(command.actorRole, command.command);
      const reasonBytes = new TextEncoder().encode(command.reason).byteLength;
      if (reasonBytes < 1 || reasonBytes > 2000)
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      const candidate = this.records.get(`candidate:${command.targetCandidateId}`)?.value;
      this.validateCommandPayload(command, candidate);
      const expectedKeys = Object.keys(command.expectedVersions).sort();
      const requirements = this.deriveRequirements(command);
      const exactRequired = requirements.keys;
      if (JSON.stringify(expectedKeys) !== JSON.stringify(exactRequired))
        throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      const creationKeys = requiredCreationKeys(
        command.command === "RESOLVE_AMBIGUITY"
          ? {
              ...command,
              command: command.payload.selectedCommand as IdentityManualResolutionCommand,
            }
          : command,
        requirements.proposal?.id,
      );
      const currentVersions = expectedKeys.map((key) => {
        const expected = command.expectedVersions[key];
        if (
          expected === undefined ||
          (expected !== null && (!Number.isSafeInteger(expected) || expected < 1))
        )
          throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
        const guardPayload = requirements.guards.get(key);
        const guard = guardPayload === undefined ? undefined : this.guards.get(key);
        if (
          guardPayload !== undefined &&
          guard !== undefined &&
          !hasMatchingCanonicalPayload(guard.canonicalPayload, guardPayload)
        )
          throw new ManualResolutionError("CONCURRENCY_GUARD_COLLISION");
        const current =
          guardPayload === undefined
            ? this.records.get(key)
            : guard === undefined
              ? undefined
              : { recordVersion: guard.recordVersion, value: guard.canonicalPayload };
        return { key, expected, current };
      });
      for (const { expected, current } of currentVersions) {
        if ((expected === null) !== (current === undefined))
          throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      }
      for (const { key, expected, current } of currentVersions) {
        if (
          requirements.requiredExistingGuardKeys.has(key) &&
          (expected === null || current === undefined)
        )
          throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
      }
      for (const { expected, current } of currentVersions) {
        if (expected !== null && current?.recordVersion !== expected)
          throw new ManualResolutionError("STALE_RECORD_VERSION");
      }
      this.validateSourceState(command, candidate);
      for (const key of expectedKeys.filter((entry) => entry.startsWith("job:"))) {
        const job = this.records.get(key)?.value;
        if (typeof job === "object" && job !== null) {
          const state = job as { status?: string; supersessionState?: string };
          const administrativeCancelledSource =
            command.command === "REPLACE_M02_JOB" &&
            key === `job:${command.payload.sourceJobId ?? ""}` &&
            command.actorRole === "ADMIN" &&
            command.reasonCode === "ADMINISTRATIVE_CORRECTION" &&
            state.status === "CANCELLED" &&
            state.supersessionState === "CONTROLLING";
          if (
            state.supersessionState === "SUPERSEDED" ||
            (state.status === "CANCELLED" && !administrativeCancelledSource)
          )
            throw new ManualResolutionError("TRANSITION_PROHIBITED");
        }
      }
      for (const key of expectedKeys.filter((entry) => entry.startsWith("candidate:"))) {
        const referencedCandidate = this.records.get(key)?.value;
        if (
          typeof referencedCandidate === "object" &&
          referencedCandidate !== null &&
          (referencedCandidate as { humanDecisionId?: string }).humanDecisionId !== undefined &&
          !command.decisionIds.includes(
            (referencedCandidate as { humanDecisionId: string }).humanDecisionId,
          )
        )
          throw new ManualResolutionError("REFERENCE_INVALID");
      }
      const next = new Map(this.records);
      const nextGuards = new Map(this.guards);
      const recordVersions: Record<string, number> = {};
      for (const [key, guardPayload] of requirements.guards) {
        if (requirements.readOnlyGuardKeys.has(key)) continue;
        const current = nextGuards.get(key);
        const recordVersion = current === undefined ? 1 : current.recordVersion + 1;
        nextGuards.set(key, { recordVersion, canonicalPayload: guardPayload });
        recordVersions[key] = recordVersion;
      }
      const mutations: readonly ManualResolutionDomainMutation[] = [
        ...this.classificationPort.deriveMutations(command),
        ...this.jobPort.deriveMutations(
          command.command === "RESOLVE_AMBIGUITY"
            ? {
                ...command,
                command: command.payload.selectedCommand as IdentityManualResolutionCommand,
              }
            : command,
          (key) => next.get(key),
          requirements.keys,
        ),
        ...expectedKeys
          .filter(
            (key) =>
              key.startsWith("clarification:") && command.command !== "REQUEST_CLARIFICATION",
          )
          .map((key) => ({
            key,
            value: {
              status: [
                "SPLIT_ROOTS",
                "MERGE_ROOTS",
                "OVERRIDE_NON_SKILL",
                "REPLACE_M02_JOB",
              ].includes(
                command.command === "RESOLVE_AMBIGUITY"
                  ? (command.payload.selectedCommand ?? "")
                  : command.command,
              )
                ? "SUPERSEDED"
                : "RESOLVED",
              resolutionCommandId: command.commandId,
            },
          })),
        ...expectedKeys
          .filter(
            (key) =>
              key.startsWith("decision:") &&
              key !== `decision:${command.payload.decisionId ?? ""}` &&
              key !== `decision:${command.payload.priorDecisionId ?? ""}` &&
              this.records.get(key)?.value !== undefined,
          )
          .map((key) => ({ key, value: { status: "SUPERSEDED" } })),
        ...duplicateProposalSupersessionMutations(command, requirements.proposal?.id),
        {
          key: `manual-command:${command.commandId}`,
          value: { commandId: command.commandId, status: "ACCEPTED", fingerprint },
        },
        {
          key: `audit:${command.payload.auditId ?? ""}`,
          value: { commandId: command.commandId, accepted: true },
        },
        ...(expectedKeys.includes(`decision:${command.payload.decisionId ?? ""}`)
          ? [
              {
                key: `decision:${command.payload.decisionId ?? ""}`,
                value: {
                  status: "ACTIVE",
                  command:
                    command.command === "RESOLVE_AMBIGUITY"
                      ? command.payload.selectedCommand
                      : command.command,
                },
              },
            ]
          : []),
        ...(command.command === "REQUEST_CLARIFICATION"
          ? [
              {
                key: `clarification:${command.payload.clarificationId ?? ""}`,
                value: {
                  status: "OPEN",
                  reviewId: command.payload.reviewId,
                  questionCode: command.payload.questionCode,
                  evidenceGaps: JSON.parse(command.payload.evidenceGapsJson ?? "[]") as unknown,
                  requestedResponderClass: command.payload.requestedResponderClass,
                },
              },
            ]
          : []),
        ...(["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(
          command.command === "RESOLVE_AMBIGUITY"
            ? (command.payload.selectedCommand ?? "")
            : command.command,
        )
          ? [
              {
                key: `handoff:${command.targetCandidateId}`,
                value: {
                  candidateId: command.targetCandidateId,
                  resourceIdentityId: command.payload.resourceIdentityId,
                  resourceVersionIdentityId:
                    command.payload.resourceVersionIdentityId ??
                    command.payload.forkResourceVersionId ??
                    command.payload.targetResourceVersionId,
                },
              },
            ]
          : []),
      ];
      for (const mutation of mutations) {
        const isReplacementEdgeCreate =
          command.command === "REPLACE_M02_JOB" && mutation.key.startsWith("job-supersession:");
        if (
          !expectedKeys.includes(mutation.key) &&
          !creationKeys.has(mutation.key) &&
          !isReplacementEdgeCreate
        )
          throw new ManualResolutionError("EXPECTED_VERSION_SET_INVALID");
        const current = next.get(mutation.key);
        const base =
          typeof current?.value === "object" && current.value !== null
            ? (current.value as Readonly<Record<string, unknown>>)
            : {};
        const recordVersion = current === undefined ? 1 : current.recordVersion + 1;
        next.set(mutation.key, { recordVersion, value: { ...base, ...mutation.value } });
        recordVersions[mutation.key] = recordVersion;
      }
      const result = {
        commandId: command.commandId,
        requestId: command.requestId,
        orderedTargetIds: [
          ...new Set(
            mutations
              .map(({ key }) => key)
              .filter(
                (key) =>
                  !key.startsWith("manual-command:") &&
                  !key.startsWith("audit:") &&
                  (creationKeys.has(key) || key.startsWith("job-supersession:")),
              )
              .map((key) => key.slice(key.indexOf(":") + 1)),
          ),
        ].sort(),
        recordVersions,
        lockOrder: expectedKeys,
        transactionIsolation: "SERIALIZABLE" as const,
      };
      this.records = next;
      this.guards = nextGuards;
      this.idempotency.set(command.idempotencyKey, { fingerprint, result });
      this.auditEvents.push({ commandId: command.commandId, accepted: true, code: null });
      return result;
    } catch (error) {
      const code = error instanceof ManualResolutionError ? error.code : "TRANSITION_PROHIBITED";
      this.auditEvents.push({ commandId: command.commandId, accepted: false, code });
      throw error;
    }
  }

  private validateSourceState(command: ManualResolutionEnvelope, candidate: unknown): void {
    if (command.command === "RESOLVE_AMBIGUITY") {
      const selected = command.payload.selectedCommand as
        IdentityManualResolutionCommand | undefined;
      if (
        selected === undefined ||
        selected === "RESOLVE_AMBIGUITY" ||
        selected === "REPLACE_M02_JOB"
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      this.assertCommandAllowed(command.actorRole, selected);
      this.validateSourceState({ ...command, command: selected }, candidate);
      return;
    }
    const candidateStatus =
      typeof candidate === "object" && candidate !== null
        ? (candidate as { status?: string }).status
        : undefined;
    if (command.payload.priorRelationshipId !== undefined) {
      const prefix =
        command.command === "MARK_FORK"
          ? "fork"
          : command.command === "MARK_MIRROR"
            ? "mirror"
            : command.command === "MARK_DUPLICATE"
              ? "duplicate"
              : null;
      if (prefix === null) throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
      const prior = this.records.get(`${prefix}:${command.payload.priorRelationshipId}`)?.value as
        Record<string, unknown> | undefined;
      const priorDecision = this.records.get(`decision:${command.payload.priorDecisionId ?? ""}`)
        ?.value as Record<string, unknown> | undefined;
      const priorIsActive =
        command.command === "MARK_DUPLICATE"
          ? prior?.status === "CONFIRMED"
          : prior?.status === "ACTIVE";
      if (prior === undefined || !priorIsActive || priorDecision?.status !== "ACTIVE")
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      if (
        (command.command === "MARK_FORK" &&
          prior.forkResourceVersionId !== command.payload.forkResourceVersionId) ||
        (command.command === "MARK_MIRROR" &&
          prior.mirrorSourceRepositoryId !== command.payload.mirrorSourceRepositoryId) ||
        (command.command === "MARK_DUPLICATE" &&
          prior.sourceCandidateId !== command.targetCandidateId)
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
      if (command.command === "MARK_MIRROR") {
        const priorLink = this.records.get(`source-link:${command.payload.priorSourceLinkId ?? ""}`)
          ?.value as Record<string, unknown> | undefined;
        if (
          priorLink?.status !== "ACTIVE" ||
          priorLink.sourceRepositoryId !== command.payload.mirrorSourceRepositoryId ||
          priorLink.normalizedRoot !== command.payload.normalizedRoot
        )
          throw new ManualResolutionError("REFERENCE_INVALID");
      }
    }
    if (
      !["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(command.command) &&
      command.evidenceIds.length === 0
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
    if (
      ["CREATE_RESOURCE", "ATTACH_NEW_VERSION"].includes(command.command) &&
      !["CLASSIFIED", "IDENTITY_REVIEW_REQUIRED"].includes(candidateStatus ?? "")
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (
      ["MARK_FORK", "MARK_MIRROR"].includes(command.command) &&
      !["IDENTITY_REVIEW_REQUIRED", "IDENTITY_RESOLVED"].includes(candidateStatus ?? "")
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (
      command.command === "MARK_DUPLICATE" &&
      !["IDENTITY_REVIEW_REQUIRED", "REJECTED"].includes(candidateStatus ?? "")
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (
      command.command === "REJECT_CANDIDATE" &&
      !["CLASSIFIED", "IDENTITY_REVIEW_REQUIRED"].includes(candidateStatus ?? "")
    )
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    const group = this.records.get(`group:${command.targetGroupId}`)?.value;
    const classification =
      typeof group === "object" && group !== null
        ? (group as { classification?: string }).classification
        : undefined;
    if (["SPLIT_ROOTS", "MERGE_ROOTS"].includes(command.command) && classification !== "AMBIGUOUS")
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
    if (command.command === "OVERRIDE_NON_SKILL" && classification !== "NON_SKILL")
      throw new ManualResolutionError("TRANSITION_PROHIBITED");
  }

  private validateCommandPayload(command: ManualResolutionEnvelope, candidate: unknown): void {
    if (command.command === "RESOLVE_AMBIGUITY") {
      const selected = command.payload.selectedCommand as
        IdentityManualResolutionCommand | undefined;
      if (
        selected === undefined ||
        selected === "RESOLVE_AMBIGUITY" ||
        selected === "REPLACE_M02_JOB"
      )
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      this.validateCommandPayload({ ...command, command: selected }, candidate);
      return;
    }
    const payload = command.payload;
    const requireReliableToken = (): void => {
      const token = payload.reliableIdentityToken ?? "";
      const evidenceId = payload.reliableTokenEvidenceId ?? "";
      if (
        normalizeIdentityToken(token)?.normalized !== token ||
        !command.evidenceIds.includes(evidenceId)
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    };
    const requireJsonArray = (key: string): readonly unknown[] => {
      try {
        const parsed: unknown = JSON.parse(payload[key] ?? "");
        if (!Array.isArray(parsed) || parsed.length === 0)
          throw new ManualResolutionError("REFERENCE_INVALID");
        return parsed;
      } catch (error) {
        if (error instanceof ManualResolutionError) throw error;
        throw new ManualResolutionError("REFERENCE_INVALID");
      }
    };
    const requireJsonObjectArray = (key: string): readonly Record<string, unknown>[] => {
      const parsed = requireJsonArray(key);
      if (parsed.some((entry) => typeof entry !== "object" || entry === null))
        throw new ManualResolutionError("REFERENCE_INVALID");
      return parsed as readonly Record<string, unknown>[];
    };
    if (["CREATE_RESOURCE", "MARK_FORK"].includes(command.command)) {
      requireReliableToken();
      const candidateRecord = candidate as Record<string, unknown> | undefined;
      if (
        candidateRecord?.candidateRootId !== payload.candidateRootId ||
        (command.command === "CREATE_RESOURCE" &&
          candidateRecord?.reconciledClassificationRunId !== payload.classificationRunId)
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (command.command === "ATTACH_NEW_VERSION") {
      const continuityEvidence = commaList(payload.continuityEvidenceIds);
      if (
        continuityEvidence.length === 0 ||
        continuityEvidence.some((id) => !command.evidenceIds.includes(id))
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
      const prior = this.records.get(`version:${payload.priorResourceVersionIdentityId ?? ""}`)
        ?.value as Record<string, unknown> | undefined;
      const activeLink = this.records.get(`source-link:${payload.activeSourceLinkId ?? ""}`)
        ?.value as Record<string, unknown> | undefined;
      if (
        prior?.resourceIdentityId !== payload.resourceIdentityId ||
        prior?.contentFingerprint === payload.contentFingerprint ||
        activeLink?.status !== "ACTIVE" ||
        activeLink.targetResourceVersionId !== payload.priorResourceVersionIdentityId
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (command.command === "MARK_MIRROR") {
      const targetVersion = this.records.get(`version:${payload.targetResourceVersionId ?? ""}`)
        ?.value as Record<string, unknown> | undefined;
      const candidateRecord = candidate as Record<string, unknown> | undefined;
      if (
        !/^[a-f0-9]{64}$/u.test(payload.identicalContentFingerprint ?? "") ||
        payload.resourceIdentityId !== payload.targetResourceIdentityId ||
        targetVersion?.resourceIdentityId !== payload.targetResourceIdentityId ||
        targetVersion?.contentFingerprint !== payload.identicalContentFingerprint ||
        candidateRecord?.contentFingerprint !== payload.identicalContentFingerprint
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (command.command === "MARK_DUPLICATE") {
      const targetVersion = this.records.get(`version:${payload.targetResourceVersionId ?? ""}`)
        ?.value as { contentFingerprint?: string } | undefined;
      const candidateRecord = candidate as { contentFingerprint?: string } | undefined;
      if (
        candidateRecord?.contentFingerprint === undefined ||
        targetVersion?.contentFingerprint !== candidateRecord.contentFingerprint
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (["SPLIT_ROOTS", "MERGE_ROOTS"].includes(command.command)) {
      const roots = requireJsonObjectArray("replacementRootsJson");
      const ownership = requireJsonObjectArray("replacementOwnershipJson");
      const rootIds = commaList(payload.replacementRootIds);
      const candidateIds = commaList(payload.replacementCandidateIds);
      if (
        new Set(rootIds).size !== rootIds.length ||
        new Set(candidateIds).size !== candidateIds.length ||
        roots.length !== rootIds.length ||
        candidateIds.length !== rootIds.length ||
        roots.some(
          (root, index) =>
            Object.keys(root).sort().join(",") !== "id,normalizedPath" ||
            root.id !== rootIds[index] ||
            typeof root.normalizedPath !== "string" ||
            !isSafeNormalizedPath(root.normalizedPath),
        ) ||
        ownership.some(
          (entry) =>
            Object.keys(entry).sort().join(",") !== "ownership,rootId,sourceEntryId" ||
            !rootIds.includes(String(entry.rootId)) ||
            !["OWNED", "SHARED", "EXCLUDED"].includes(String(entry.ownership)) ||
            typeof entry.sourceEntryId !== "string" ||
            entry.sourceEntryId.length === 0,
        ) ||
        rootIds.some((id) => !ownership.some((entry) => entry.rootId === id)) ||
        (command.command === "SPLIT_ROOTS" && rootIds.length < 2) ||
        (command.command === "MERGE_ROOTS" && rootIds.length !== 1)
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (command.command === "OVERRIDE_NON_SKILL") {
      const selectedPaths = requireJsonArray("selectedRootPathsJson");
      const ownership = requireJsonObjectArray("replacementOwnershipJson");
      const rootIds = commaList(payload.replacementRootIds);
      const candidateIds = commaList(payload.replacementCandidateIds);
      const eligiblePaths =
        (
          this.records.get(`group:${command.targetGroupId}`)?.value as
            { eligibleRootPaths?: readonly string[] } | undefined
        )?.eligibleRootPaths ?? [];
      if (
        selectedPaths.some((path) => typeof path !== "string" || !isSafeNormalizedPath(path)) ||
        new Set(selectedPaths).size !== selectedPaths.length ||
        new Set(rootIds).size !== rootIds.length ||
        new Set(candidateIds).size !== candidateIds.length ||
        rootIds.length !== selectedPaths.length ||
        candidateIds.length !== selectedPaths.length ||
        selectedPaths.some((path) => !eligiblePaths.includes(String(path))) ||
        ownership.some(
          (entry) =>
            Object.keys(entry).sort().join(",") !== "ownership,rootId,sourceEntryId" ||
            !rootIds.includes(String(entry.rootId)) ||
            !["OWNED", "SHARED", "EXCLUDED"].includes(String(entry.ownership)) ||
            typeof entry.sourceEntryId !== "string" ||
            !isOpaqueId(entry.sourceEntryId),
        ) ||
        rootIds.some((id) => !ownership.some((entry) => entry.rootId === id))
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
    }
    if (command.command === "REQUEST_CLARIFICATION") {
      const responder = payload.requestedResponderClass;
      if (
        (payload.questionCode ?? "").length === 0 ||
        !["ADMIN", "EDITOR", "TECHNICAL_REVIEWER"].includes(responder ?? "")
      )
        throw new ManualResolutionError("REFERENCE_INVALID");
      requireJsonArray("evidenceGapsJson");
    }
    if (
      command.command === "REPLACE_M02_JOB" &&
      !/^[a-f0-9]{64}$/u.test(payload.replacementInputFingerprint ?? "")
    )
      throw new ManualResolutionError("REFERENCE_INVALID");
  }
}

function requiredCreationKeys(command: ManualResolutionEnvelope, proposalId?: string): Set<string> {
  const keys = new Set<string>([
    `manual-command:${command.commandId}`,
    `audit:${command.payload.auditId ?? ""}`,
  ]);
  const effective = selectedDirectCommand(command);
  const projected = command.command === effective ? command : { ...command, command: effective };
  const addDecision = (): void => {
    keys.add(`decision:${projected.payload.decisionId ?? ""}`);
  };
  const addHandoff = (): void => {
    keys.add(`handoff:${projected.targetCandidateId}`);
  };
  if (effective === "CREATE_RESOURCE") {
    addDecision();
    keys.add(`resource:${projected.payload.resourceIdentityId ?? ""}`);
    keys.add(`version:${projected.payload.resourceVersionIdentityId ?? ""}`);
    keys.add(`source-link:${projected.payload.sourceLinkId ?? ""}`);
    keys.add(`observation:${projected.payload.observationId ?? ""}`);
    keys.add(`handoff:${projected.targetCandidateId}`);
  } else if (effective === "ATTACH_NEW_VERSION") {
    addDecision();
    keys.add(`version:${projected.payload.resourceVersionIdentityId ?? ""}`);
    keys.add(`source-link:${projected.payload.sourceLinkId ?? ""}`);
    keys.add(`observation:${projected.payload.observationId ?? ""}`);
    addHandoff();
  } else if (effective === "MARK_FORK") {
    addDecision();
    if (projected.payload.priorRelationshipId === undefined) {
      keys.add(`resource:${projected.payload.resourceIdentityId ?? ""}`);
      keys.add(`version:${projected.payload.forkResourceVersionId ?? ""}`);
    }
    keys.add(`fork:${projected.payload.relationshipId ?? ""}`);
    keys.add(`source-link:${projected.payload.sourceLinkId ?? ""}`);
    keys.add(`observation:${projected.payload.observationId ?? ""}`);
    addHandoff();
  } else if (effective === "MARK_MIRROR") {
    addDecision();
    keys.add(`mirror:${projected.payload.relationshipId ?? ""}`);
    keys.add(`source-link:${projected.payload.sourceLinkId ?? ""}`);
    keys.add(`observation:${projected.payload.observationId ?? ""}`);
    addHandoff();
  } else if (effective === "MARK_DUPLICATE") {
    addDecision();
    keys.add(`duplicate:${projected.payload.duplicateId ?? ""}`);
  } else if (effective === "REJECT_CANDIDATE") {
    addDecision();
  } else if (["SPLIT_ROOTS", "MERGE_ROOTS", "OVERRIDE_NON_SKILL"].includes(effective)) {
    addDecision();
    keys.add(`group:${projected.payload.replacementGroupId ?? ""}`);
    keys.add(`classification-run:${projected.payload.replacementRunId ?? ""}`);
    for (const id of commaList(projected.payload.replacementCandidateIds))
      keys.add(`candidate:${id}`);
    for (const id of commaList(projected.payload.replacementRootIds)) keys.add(`root:${id}`);
  } else if (effective === "REQUEST_CLARIFICATION") {
    keys.add(`clarification:${projected.payload.clarificationId ?? ""}`);
  } else if (effective === "REPLACE_M02_JOB") {
    keys.add(`job:${projected.payload.replacementJobId ?? ""}`);
  }
  if (proposalId !== undefined) keys.add(duplicateProposalAuditKey(proposalId));
  return keys;
}

function commaList(value: string | undefined): string[] {
  return value?.split(",").filter((entry) => entry.length > 0) ?? [];
}

const p1ProposalResolverCommands = new Set<IdentityManualResolutionCommand>([
  "CREATE_RESOURCE",
  "ATTACH_NEW_VERSION",
  "MARK_FORK",
  "MARK_MIRROR",
  "MARK_DUPLICATE",
  "REJECT_CANDIDATE",
]);

function selectedDirectCommand(command: ManualResolutionEnvelope): IdentityManualResolutionCommand {
  return command.command === "RESOLVE_AMBIGUITY"
    ? (command.payload.selectedCommand as IdentityManualResolutionCommand)
    : command.command;
}

function isP1ProposalResolver(command: ManualResolutionEnvelope): boolean {
  const selected = selectedDirectCommand(command);
  if (!p1ProposalResolverCommands.has(selected)) return false;
  return (
    !["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(selected) ||
    command.payload.priorRelationshipId === undefined
  );
}

function duplicateProposalAuditKey(proposalId: string): string {
  return `audit:proposal-superseded:${proposalId}`;
}

function isOpaqueId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(value);
}

function isSafeNormalizedPath(value: string): boolean {
  return (
    value === value.normalize("NFC") &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  );
}

const envelopeKeys = [
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

export function manualResolutionPayloadKeys(
  command: IdentityManualResolutionCommand,
  selectedCommand?: IdentityManualResolutionCommand,
  correction = false,
  replacementSnapshot = false,
): readonly string[] {
  const common = ["auditId"];
  const keysByCommand: Record<IdentityManualResolutionCommand, readonly string[]> = {
    CREATE_RESOURCE: [
      "candidateRootId",
      "classificationRunId",
      "contentFingerprint",
      "decisionId",
      "jobId",
      "normalizedRoot",
      "observationId",
      "provider",
      "providerRepositoryId",
      "reliableIdentityToken",
      "reliableTokenEvidenceId",
      "resourceIdentityId",
      "resourceVersionIdentityId",
      "reviewId",
      "sourceLinkId",
      "sourceSnapshotId",
    ],
    ATTACH_NEW_VERSION: [
      "activeSourceLinkId",
      "contentFingerprint",
      "continuityEvidenceIds",
      "decisionId",
      "jobId",
      "normalizedRoot",
      "observationId",
      "provider",
      "providerRepositoryId",
      "priorResourceVersionIdentityId",
      "resourceIdentityId",
      "resourceVersionIdentityId",
      "reviewId",
      "sourceLinkId",
      "sourceSnapshotId",
    ],
    MARK_FORK: [
      "candidateRootId",
      "contentFingerprint",
      "decisionId",
      "forkResourceVersionId",
      "jobId",
      "normalizedRoot",
      "observationId",
      "originResourceVersionId",
      "provider",
      "providerRepositoryId",
      "relationshipId",
      "reliableIdentityToken",
      "reliableTokenEvidenceId",
      "resourceIdentityId",
      "reviewId",
      "sourceLinkId",
      "sourceSnapshotId",
    ],
    MARK_MIRROR: [
      "decisionId",
      "identicalContentFingerprint",
      "jobId",
      "mirrorSourceRepositoryId",
      "normalizedRoot",
      "observationId",
      "originSourceRepositoryId",
      "relationshipId",
      "resourceIdentityId",
      "reviewId",
      "sourceLinkId",
      "sourceSnapshotId",
      "targetResourceVersionId",
      "targetResourceIdentityId",
    ],
    MARK_DUPLICATE: ["decisionId", "duplicateId", "jobId", "targetResourceVersionId"],
    REJECT_CANDIDATE: ["decisionId", "jobId"],
    SPLIT_ROOTS: [
      "classificationPolicyVersion",
      "decisionId",
      "jobId",
      "originalCandidateIds",
      "originalRootIds",
      "replacementCandidateIds",
      "replacementGroupId",
      "replacementOwnershipJson",
      "replacementRootIds",
      "replacementRootsJson",
      "replacementRunId",
      "sourceSnapshotId",
    ],
    MERGE_ROOTS: [
      "classificationPolicyVersion",
      "decisionId",
      "jobId",
      "originalCandidateIds",
      "originalRootIds",
      "replacementCandidateIds",
      "replacementGroupId",
      "replacementOwnershipJson",
      "replacementRootIds",
      "replacementRootsJson",
      "replacementRunId",
      "sourceSnapshotId",
    ],
    OVERRIDE_NON_SKILL: [
      "classificationPolicyVersion",
      "decisionId",
      "jobId",
      "replacementCandidateIds",
      "replacementGroupId",
      "replacementOwnershipJson",
      "replacementRootIds",
      "replacementRunId",
      "selectedRootPathsJson",
      "sourceSnapshotId",
    ],
    REQUEST_CLARIFICATION: [
      "clarificationId",
      "evidenceGapsJson",
      "jobId",
      "questionCode",
      "requestedResponderClass",
      "reviewId",
    ],
    RESOLVE_AMBIGUITY: [],
    REPLACE_M02_JOB: [
      "analysisPolicyVersion",
      "classificationPolicyVersion",
      "identityPolicyVersion",
      "promptBundleVersion",
      "replacementInputFingerprint",
      "replacementJobId",
      "requestedOperationScope",
      "sourceJobId",
    ],
  };
  if (command === "RESOLVE_AMBIGUITY") {
    if (
      selectedCommand === undefined ||
      selectedCommand === "RESOLVE_AMBIGUITY" ||
      selectedCommand === "REPLACE_M02_JOB"
    )
      return [...common, "reviewId", "selectedCommand"].sort();
    const selectedCorrectionKeys = correction
      ? selectedCommand === "MARK_MIRROR"
        ? ["priorDecisionId", "priorRelationshipId", "priorSourceLinkId"]
        : ["MARK_FORK", "MARK_DUPLICATE"].includes(selectedCommand)
          ? ["priorDecisionId", "priorRelationshipId"]
          : []
      : [];
    return [
      ...new Set([
        ...common,
        "reviewId",
        "selectedCommand",
        ...keysByCommand[selectedCommand],
        ...selectedCorrectionKeys,
      ]),
    ].sort();
  }
  const correctionKeys = correction
    ? command === "MARK_MIRROR"
      ? ["priorDecisionId", "priorRelationshipId", "priorSourceLinkId"]
      : ["priorDecisionId", "priorRelationshipId"]
    : [];
  return [
    ...common,
    ...keysByCommand[command],
    ...correctionKeys,
    ...(command === "REPLACE_M02_JOB" && replacementSnapshot ? ["replacementSnapshotId"] : []),
  ].sort();
}

function assertExactManualResolutionShape(command: ManualResolutionEnvelope): void {
  if (JSON.stringify(Object.keys(command).sort()) !== JSON.stringify([...envelopeKeys].sort()))
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
  const allowedPayload = manualResolutionPayloadKeys(
    command.command,
    command.payload.selectedCommand as IdentityManualResolutionCommand | undefined,
    command.payload.priorRelationshipId !== undefined,
    command.payload.replacementSnapshotId !== undefined,
  );
  if (JSON.stringify(Object.keys(command.payload).sort()) !== JSON.stringify(allowedPayload))
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
  const envelopeIds = [
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
    envelopeIds.some((id) => !isOpaqueId(id)) ||
    !/^[A-Z][A-Z0-9_]{0,127}$/u.test(command.reasonCode) ||
    Number.isNaN(Date.parse(command.timestamp)) ||
    new Date(command.timestamp).toISOString() !== command.timestamp
  )
    throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
  for (const [key, value] of Object.entries(command.payload)) {
    if (key.endsWith("Ids")) {
      const ids = commaList(value);
      if (ids.length === 0 || ids.some((id) => !isOpaqueId(id)))
        throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
    } else if (key.endsWith("Id") && !isOpaqueId(value)) {
      throw new ManualResolutionError("COMMAND_SCHEMA_INVALID");
    }
  }
}

export class ManualResolutionCoordinator {
  private readonly workspace: InMemoryManualResolutionStore;

  constructor(
    classificationPort: ClassificationCommandMutationPort = new InMemoryClassificationCommandMutationPort(),
    jobPort: JobCommandMutationPort = new InMemoryJobCommandMutationPort(),
  ) {
    this.workspace = new InMemoryManualResolutionStore(classificationPort, jobPort);
  }

  get auditEvents() {
    return this.workspace.auditEvents;
  }

  seedRecord(key: string, recordVersion: number, value: unknown): void {
    this.workspace.seedRecord(key, recordVersion, value);
  }

  getRecord(key: string) {
    return this.workspace.getRecord(key);
  }

  getGuard(key: string) {
    return this.workspace.getGuard(key);
  }

  seedGuard(key: string, recordVersion: number, canonicalPayload: Uint8Array): void {
    this.workspace.seedGuard(key, recordVersion, canonicalPayload);
  }

  assertGuardPayload(key: string, attempted: Uint8Array): void {
    this.workspace.assertGuardPayload(key, attempted);
  }

  assertCommandAllowed(role: Role, command: IdentityManualResolutionCommand): void {
    this.workspace.assertCommandAllowed(role, command);
  }

  execute(command: ManualResolutionEnvelope): Promise<ManualResolutionResult> {
    return this.workspace.execute(command);
  }

  deriveRequiredExpectedVersionKeys(command: ManualResolutionEnvelope): readonly string[] {
    return this.workspace.deriveRequirements(command).keys;
  }

  deriveConcurrencyGuards(
    command: ManualResolutionEnvelope,
  ): readonly { readonly key: string; readonly canonicalPayload: Uint8Array }[] {
    return [...this.workspace.deriveRequirements(command).guards].map(
      ([key, canonicalPayload]) => ({ key, canonicalPayload: canonicalPayload.slice() }),
    );
  }

  snapshot() {
    return this.workspace.snapshot();
  }

  createHandoffMarker(input: Parameters<InMemoryManualResolutionStore["createHandoffMarker"]>[0]) {
    return this.workspace.createHandoffMarker(input);
  }
}

export function deriveRequiredExpectedVersionKeys(
  command: ManualResolutionEnvelope,
): readonly string[] {
  return deriveCommandRequirements(command).keys;
}

interface CommandRequirements {
  readonly keys: readonly string[];
  readonly guards: ReadonlyMap<string, Uint8Array>;
  readonly readOnlyGuardKeys: ReadonlySet<string>;
  readonly requiredExistingGuardKeys: ReadonlySet<string>;
  readonly proposal?: ActiveDuplicateProposal;
}

interface ActiveDuplicateProposal {
  readonly id: string;
  readonly targetResourceVersionId: string;
}

function isP1ProposalResolverForCurrentState(
  command: ManualResolutionEnvelope,
  records: ReadonlyMap<string, VersionedRecord> | undefined,
): boolean {
  if (!isP1ProposalResolver(command)) return false;
  const candidate = records?.get(`candidate:${command.targetCandidateId}`)?.value as
    { status?: string } | undefined;
  return candidate?.status === "IDENTITY_REVIEW_REQUIRED";
}

function discoverActiveDuplicateProposal(
  command: ManualResolutionEnvelope,
  records: ReadonlyMap<string, VersionedRecord> | undefined,
): ActiveDuplicateProposal | undefined {
  if (!isP1ProposalResolverForCurrentState(command, records)) return undefined;
  const proposals = [...(records?.entries() ?? [])].flatMap(([key, record]) => {
    const value = record.value as
      { status?: string; sourceCandidateId?: string; targetResourceVersionId?: string } | undefined;
    const targetResourceVersionId = value?.targetResourceVersionId;
    if (
      !key.startsWith("duplicate:") ||
      value?.status !== "PROPOSED" ||
      value.sourceCandidateId !== command.targetCandidateId ||
      typeof targetResourceVersionId !== "string" ||
      !isOpaqueId(targetResourceVersionId)
    )
      return [];
    return [{ id: key.slice("duplicate:".length), targetResourceVersionId }];
  });
  if (proposals.length > 1) throw new ManualResolutionError("REFERENCE_INVALID");
  return proposals[0];
}

function resourceVersionGuardRefV2(
  records: ReadonlyMap<string, VersionedRecord> | undefined,
  resourceVersionId: string,
): ResourceVersionGuardRefV2 {
  const version = records?.get(`version:${resourceVersionId}`)?.value as
    { resourceIdentityId?: string; contentFingerprint?: string } | undefined;
  const identity = records?.get(`resource:${version?.resourceIdentityId ?? ""}`)?.value as
    { guardAnchorCandidateId?: string } | undefined;
  const resourceIdentityId = version?.resourceIdentityId;
  const contentFingerprint = version?.contentFingerprint;
  const guardAnchorCandidateId = identity?.guardAnchorCandidateId;
  if (
    typeof resourceIdentityId !== "string" ||
    !isOpaqueId(resourceIdentityId) ||
    typeof contentFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/u.test(contentFingerprint) ||
    typeof guardAnchorCandidateId !== "string" ||
    !isOpaqueId(guardAnchorCandidateId)
  )
    throw new ManualResolutionError("REFERENCE_INVALID");
  return {
    kind: "RESOURCE_VERSION_ANCHOR",
    resourceIdentityRef: {
      kind: "RESOURCE_IDENTITY_ANCHOR",
      originCandidateId: guardAnchorCandidateId,
    },
    contentFingerprint,
  };
}

function deriveCommandRequirements(
  command: ManualResolutionEnvelope,
  records?: ReadonlyMap<string, VersionedRecord>,
): CommandRequirements {
  const payload = command.payload;
  const need = (name: string): string => {
    const value = payload[name];
    if (value === undefined || value.length === 0)
      throw new ManualResolutionError("REFERENCE_INVALID");
    return value;
  };
  const list = (name: string): string[] => {
    const value = need(name);
    return value.split(",").filter((entry) => entry.length > 0);
  };
  const keys = new Set<string>();
  const guards = new Map<string, Uint8Array>();
  const readOnlyGuardKeys = new Set<string>();
  const requiredExistingGuardKeys = new Set<string>();
  const addBase = (): void => {
    keys.add(`candidate:${command.targetCandidateId}`);
    keys.add(`group:${command.targetGroupId}`);
    keys.add(`job:${need("jobId")}`);
  };
  const guard = (type: string, components: readonly GuardComponent[]): void => {
    const derived = createGuardKey(type, components);
    keys.add(derived.key);
    guards.set(derived.key, derived.canonicalPayload);
  };
  const addTopologyGuards = (): void => {
    const sourceSnapshotId = need("sourceSnapshotId");
    const policyVersion = need("classificationPolicyVersion");
    guard("GROUP_KEY", [sourceSnapshotId, policyVersion]);
    guard("GROUP_MEMBERSHIP", [command.targetGroupId]);
    const predecessorCandidateId =
      commaList(payload.originalCandidateIds)[0] ?? command.targetCandidateId;
    const predecessor = records?.get(`candidate:${predecessorCandidateId}`)?.value as
      { contentFingerprint?: string } | undefined;
    const roots =
      typeof payload.replacementRootsJson !== "string"
        ? commaList(payload.replacementRootIds).map((id, index) => ({
            id,
            normalizedPath:
              (JSON.parse(need("selectedRootPathsJson")) as readonly string[])[index] ?? ".",
          }))
        : (JSON.parse(payload.replacementRootsJson) as readonly {
            id: string;
            normalizedPath: string;
          }[]);
    for (const root of roots) {
      const rootFingerprint = fingerprintM02Payload({
        normalizedRootPath: root.normalizedPath,
        sourceSnapshotId,
      });
      const contentFingerprint = fingerprintM02Payload({
        rootFingerprint,
        predecessorContent: predecessor?.contentFingerprint ?? "",
      });
      guard("ROOT_KEY", [sourceSnapshotId, rootFingerprint, contentFingerprint]);
      guard("CANDIDATE_KEY", [sourceSnapshotId, rootFingerprint, contentFingerprint]);
    }
  };
  switch (command.command) {
    case "CREATE_RESOURCE":
    case "ATTACH_NEW_VERSION": {
      addBase();
      keys.add(`review:${need("reviewId")}`);
      if (command.command === "CREATE_RESOURCE") {
        keys.add(`root:${need("candidateRootId")}`);
        keys.add(`classification-run:${need("classificationRunId")}`);
      } else {
        keys.add(`resource:${need("resourceIdentityId")}`);
        keys.add(`version:${need("priorResourceVersionIdentityId")}`);
        keys.add(`source-link:${need("activeSourceLinkId")}`);
      }
      guard("RESOURCE_SOURCE", [
        need("provider"),
        need("providerRepositoryId"),
        need("normalizedRoot"),
      ]);
      guard("RESOURCE_VERSION", [need("resourceIdentityId"), need("contentFingerprint")]);
      guard("OBSERVATION", [
        need("resourceVersionIdentityId"),
        need("sourceSnapshotId"),
        command.targetCandidateId,
        need("sourceLinkId"),
      ]);
      guard("HANDOFF", [command.targetCandidateId]);
      break;
    }
    case "MARK_FORK": {
      addBase();
      keys.add(`version:${need("originResourceVersionId")}`);
      if (payload.priorRelationshipId !== undefined) {
        keys.add(`resource:${need("resourceIdentityId")}`);
        keys.add(`version:${need("forkResourceVersionId")}`);
        keys.add(`fork:${need("priorRelationshipId")}`);
        keys.add(`decision:${need("priorDecisionId")}`);
      }
      keys.add(`review:${need("reviewId")}`);
      keys.add(`root:${need("candidateRootId")}`);
      guard("FORK_LINEAGE", [need("forkResourceVersionId")]);
      guard("RELATIONSHIP_PAIR", [
        "FORK",
        need("forkResourceVersionId"),
        need("originResourceVersionId"),
      ]);
      guard("RESOURCE_SOURCE", [
        need("provider"),
        need("providerRepositoryId"),
        need("normalizedRoot"),
      ]);
      guard("RESOURCE_VERSION", [need("resourceIdentityId"), need("contentFingerprint")]);
      guard("OBSERVATION", [
        need("forkResourceVersionId"),
        need("sourceSnapshotId"),
        need("candidateRootId"),
        need("sourceLinkId"),
      ]);
      guard("HANDOFF", [command.targetCandidateId]);
      break;
    }
    case "MARK_MIRROR": {
      addBase();
      keys.add(`version:${need("targetResourceVersionId")}`);
      keys.add(`resource:${need("targetResourceIdentityId")}`);
      keys.add(`source-repository:${need("mirrorSourceRepositoryId")}`);
      keys.add(`source-repository:${need("originSourceRepositoryId")}`);
      if (payload.priorRelationshipId !== undefined) {
        keys.add(`mirror:${need("priorRelationshipId")}`);
        keys.add(`source-link:${need("priorSourceLinkId")}`);
        keys.add(`decision:${need("priorDecisionId")}`);
      }
      keys.add(`review:${need("reviewId")}`);
      const mirrorRepository = records?.get(`source-repository:${need("mirrorSourceRepositoryId")}`)
        ?.value as { provider?: string; providerRepositoryId?: string } | undefined;
      guard("MIRROR_LINEAGE", [need("mirrorSourceRepositoryId")]);
      guard("RELATIONSHIP_PAIR", [
        "MIRROR",
        need("mirrorSourceRepositoryId"),
        need("originSourceRepositoryId"),
      ]);
      guard("RESOURCE_SOURCE", [
        mirrorRepository?.provider ?? need("mirrorSourceRepositoryId"),
        mirrorRepository?.providerRepositoryId ?? need("mirrorSourceRepositoryId"),
        need("normalizedRoot"),
      ]);
      guard("OBSERVATION", [
        need("targetResourceVersionId"),
        need("sourceSnapshotId"),
        command.targetCandidateId,
        need("sourceLinkId"),
      ]);
      guard("HANDOFF", [command.targetCandidateId]);
      break;
    }
    case "MARK_DUPLICATE": {
      addBase();
      keys.add(`version:${need("targetResourceVersionId")}`);
      if (payload.priorRelationshipId !== undefined) {
        keys.add(`duplicate:${need("priorRelationshipId")}`);
        keys.add(`decision:${need("priorDecisionId")}`);
      }
      guard("DUPLICATE_DISPOSITION", [command.targetCandidateId]);
      guard("RELATIONSHIP_PAIR", [
        "DUPLICATE",
        command.targetCandidateId,
        need("targetResourceVersionId"),
      ]);
      break;
    }
    case "REJECT_CANDIDATE": {
      addBase();
      guard("REJECTION_DECISION", [command.targetCandidateId]);
      break;
    }
    case "SPLIT_ROOTS":
    case "MERGE_ROOTS": {
      keys.add(`group:${command.targetGroupId}`);
      keys.add(`job:${need("jobId")}`);
      for (const id of list("originalCandidateIds")) keys.add(`candidate:${id}`);
      for (const id of list("originalRootIds")) keys.add(`root:${id}`);
      for (const [key, record] of records?.entries() ?? []) {
        const value = record.value as { candidateId?: string; status?: string; state?: string };
        if (
          key.startsWith("decision:") &&
          value.status === "ACTIVE" &&
          list("originalCandidateIds").includes(value.candidateId ?? "")
        )
          keys.add(key);
        if (
          key.startsWith("review:") &&
          list("originalCandidateIds").includes(value.candidateId ?? "")
        )
          keys.add(key);
      }
      addTopologyGuards();
      break;
    }
    case "OVERRIDE_NON_SKILL": {
      keys.add(`group:${command.targetGroupId}`);
      keys.add(`job:${need("jobId")}`);
      for (const [key, record] of records?.entries() ?? []) {
        const value = record.value as { groupId?: string };
        if (key.startsWith("review:") && value.groupId === command.targetGroupId) keys.add(key);
      }
      addTopologyGuards();
      break;
    }
    case "REQUEST_CLARIFICATION": {
      keys.add(`review:${need("reviewId")}`);
      keys.add(`job:${need("jobId")}`);
      guard("CLARIFICATION_OPEN", [need("reviewId"), need("questionCode")]);
      const targetType = command.reasonCode.includes("CLASSIFICATION")
        ? "CLASSIFICATION"
        : command.reasonCode.includes("REJECTION")
          ? "REJECTION"
          : "IDENTITY";
      guard("CLARIFICATION_TARGET", [
        targetType,
        targetType === "CLASSIFICATION"
          ? ((
              records?.get(`candidate:${command.targetCandidateId}`)?.value as
                | {
                    reconciledClassificationRunId?: string;
                  }
                | undefined
            )?.reconciledClassificationRunId ?? command.targetGroupId)
          : (command.decisionIds[0] ?? command.targetCandidateId),
      ]);
      break;
    }
    case "RESOLVE_AMBIGUITY": {
      const selected = need("selectedCommand") as IdentityManualResolutionCommand;
      if (selected === "RESOLVE_AMBIGUITY" || selected === "REPLACE_M02_JOB")
        throw new ManualResolutionError("TRANSITION_PROHIBITED");
      const selectedRequirements = deriveCommandRequirements(
        { ...command, command: selected },
        records,
      );
      for (const key of selectedRequirements.keys) keys.add(key);
      for (const [key, canonicalPayload] of selectedRequirements.guards)
        guards.set(key, canonicalPayload);
      for (const key of selectedRequirements.readOnlyGuardKeys) readOnlyGuardKeys.add(key);
      for (const key of selectedRequirements.requiredExistingGuardKeys)
        requiredExistingGuardKeys.add(key);
      keys.add(`review:${need("reviewId")}`);
      break;
    }
    case "REPLACE_M02_JOB": {
      const sourceJobId = need("sourceJobId");
      const source = records?.get(`job:${sourceJobId}`)?.value as
        { jobLineageId?: string; operationScope?: string } | undefined;
      if (source?.jobLineageId === undefined || source.operationScope === undefined)
        throw new ManualResolutionError("REFERENCE_INVALID");
      const requestedScope = need("requestedOperationScope");
      const invalidatedScopes =
        requestedScope === "FULL_PIPELINE"
          ? ["CLASSIFICATION", "IDENTITY_RESOLUTION", "FULL_PIPELINE"]
          : requestedScope === "CLASSIFICATION"
            ? ["CLASSIFICATION", "IDENTITY_RESOLUTION"]
            : ["IDENTITY_RESOLUTION"];
      const invalidatedJobIds = [...(records?.entries() ?? [])]
        .filter(([key, record]) => {
          if (!key.startsWith("job:")) return false;
          const value = record.value as {
            jobLineageId?: string;
            operationScope?: string;
            supersessionState?: string;
          };
          return (
            value.jobLineageId === source.jobLineageId &&
            value.supersessionState === "CONTROLLING" &&
            invalidatedScopes.includes(value.operationScope ?? "")
          );
        })
        .map(([key]) => key.slice("job:".length));
      if (!invalidatedJobIds.includes(sourceJobId)) invalidatedJobIds.push(sourceJobId);
      for (const id of invalidatedJobIds.sort()) {
        keys.add(`job:${id}`);
      }
      if (payload.replacementSnapshotId !== undefined)
        keys.add(`snapshot:${need("replacementSnapshotId")}`);
      need("classificationPolicyVersion");
      need("identityPolicyVersion");
      need("analysisPolicyVersion");
      need("promptBundleVersion");
      for (const scope of new Set(
        invalidatedJobIds.map((id) => {
          const value = records?.get(`job:${id}`)?.value as { operationScope?: string } | undefined;
          return value?.operationScope ?? requestedScope;
        }),
      ))
        guard("JOB_SCOPE_CONTROLLER", [source.jobLineageId, scope]);
      guard("JOB_REPLACEMENT_INPUT", [
        sourceJobId,
        requestedScope,
        need("replacementInputFingerprint"),
      ]);
      for (const [key, record] of records?.entries() ?? []) {
        const value = record.value as { status?: string; controllingJobId?: string };
        if (
          key.startsWith("clarification:") &&
          value.status === "OPEN" &&
          invalidatedJobIds.includes(value.controllingJobId ?? "")
        )
          keys.add(key);
        if (
          key.startsWith("handoff:") &&
          value.status === "ACTIVE" &&
          invalidatedJobIds.includes(value.controllingJobId ?? "")
        )
          keys.add(key);
      }
      break;
    }
  }
  const proposal = discoverActiveDuplicateProposal(command, records);
  if (isP1ProposalResolverForCurrentState(command, records)) {
    guard("DUPLICATE_PROPOSAL_SET", [command.targetCandidateId]);
    const setGuard = createGuardKey("DUPLICATE_PROPOSAL_SET", [command.targetCandidateId]);
    if (proposal === undefined) readOnlyGuardKeys.add(setGuard.key);
    else {
      requiredExistingGuardKeys.add(setGuard.key);
      keys.add(`duplicate:${proposal.id}`);
      guard("DUPLICATE_PROPOSAL_PAIR", [
        command.targetCandidateId,
        resourceVersionGuardRefV2(records, proposal.targetResourceVersionId),
      ]);
      requiredExistingGuardKeys.add(
        createGuardKey("DUPLICATE_PROPOSAL_PAIR", [
          command.targetCandidateId,
          resourceVersionGuardRefV2(records, proposal.targetResourceVersionId),
        ]).key,
      );
    }
  }
  const effective =
    command.command === "RESOLVE_AMBIGUITY"
      ? (command.payload.selectedCommand as IdentityManualResolutionCommand | undefined)
      : command.command;
  if (
    effective !== undefined &&
    !["REQUEST_CLARIFICATION", "REPLACE_M02_JOB"].includes(effective)
  ) {
    const entries = [...(records?.entries() ?? [])];
    const activeDecisionEntry = entries.find(([key, record]) => {
      const value = record.value as { status?: string; candidateId?: string };
      return (
        key.startsWith("decision:") &&
        value.status === "ACTIVE" &&
        value.candidateId === command.targetCandidateId
      );
    });
    if (activeDecisionEntry !== undefined)
      guard("CLARIFICATION_TARGET", ["IDENTITY", activeDecisionEntry[0].slice("decision:".length)]);
    for (const [key, record] of entries) {
      const value = record.value as {
        status?: string;
        candidateId?: string;
        groupId?: string;
        targetClassificationRunId?: string;
        targetIdentityDecisionId?: string;
        targetRejectionDecisionId?: string;
      };
      if (
        key.startsWith("decision:") &&
        value.status === "ACTIVE" &&
        value.candidateId === command.targetCandidateId
      )
        keys.add(key);
      if (
        key.startsWith("handoff:") &&
        value.status === "ACTIVE" &&
        value.candidateId === command.targetCandidateId
      )
        keys.add(key);
      if (
        key.startsWith("clarification:") &&
        value.status === "OPEN" &&
        (value.candidateId === command.targetCandidateId || value.groupId === command.targetGroupId)
      ) {
        keys.add(key);
        const target =
          value.targetClassificationRunId !== undefined
            ? ["CLASSIFICATION", value.targetClassificationRunId]
            : value.targetIdentityDecisionId !== undefined
              ? ["IDENTITY", value.targetIdentityDecisionId]
              : ["REJECTION", value.targetRejectionDecisionId ?? ""];
        guard("CLARIFICATION_TARGET", target);
      }
    }
  }
  return {
    keys: [...keys].sort(),
    guards,
    readOnlyGuardKeys,
    requiredExistingGuardKeys,
    ...(proposal === undefined ? {} : { proposal }),
  };
}

export interface ManualResolutionResult {
  readonly commandId: string;
  readonly requestId: string;
  readonly orderedTargetIds: readonly string[];
  readonly recordVersions: Readonly<Record<string, number>>;
  readonly lockOrder: readonly string[];
  readonly transactionIsolation: "SERIALIZABLE";
}
