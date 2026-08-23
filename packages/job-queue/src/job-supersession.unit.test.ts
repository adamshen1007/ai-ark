import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  aggregateM02JobResult,
  createJobLineageGuardKey,
  createM02JobScopeKey,
  DeterministicM02JobStore,
  type M02JobRecord,
  type M02ReplacementInputRecord,
  type M02SourceSnapshotEligibility,
  type ReplaceM02JobRequest,
} from "./index.js";

const expectedEvidence = new Map(
  (
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as {
      readonly expectedEvidence: readonly {
        readonly id: string;
        readonly records: readonly string[];
        readonly decision: string;
        readonly auditStates: readonly string[];
      }[];
    }
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

function replacementInput(
  overrides: Partial<M02ReplacementInputRecord> = {},
): M02ReplacementInputRecord {
  return {
    replacementJobId: "job_b",
    jobLineageId: "lineage_1",
    sourceSnapshotId: "snapshot_1",
    inputFingerprint: "b".repeat(64),
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "classification-analysis-v1",
    promptBundleVersion: "classification-prompt-v1",
    ...overrides,
  };
}

function jobStore(
  jobs: readonly M02JobRecord[],
  snapshots: readonly M02SourceSnapshotEligibility[] = [
    { id: "snapshot_1", jobLineageId: "lineage_1", completed: true, supported: true },
  ],
  inputs: readonly M02ReplacementInputRecord[] = [
    replacementInput(),
    replacementInput({ replacementJobId: "job_identity_b", inputFingerprint: "c".repeat(64) }),
  ],
): DeterministicM02JobStore {
  return new DeterministicM02JobStore(jobs, snapshots, inputs);
}

const failedJob = (overrides: Partial<M02JobRecord> = {}): M02JobRecord => {
  const job = {
    id: "job_a",
    jobLineageId: "lineage_1",
    acquisitionStatus: "FAILED",
    operationScope: "CLASSIFICATION",
    supersessionState: "CONTROLLING",
    supersededByJobId: null,
    supersessionSequence: 1,
    controllingClassificationDecisionId: null,
    sourceSnapshotId: "snapshot_1",
    inputFingerprint: "a".repeat(64),
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "classification-analysis-v1",
    promptBundleVersion: "classification-prompt-v1",
    recordVersion: 3,
    ...overrides,
  } satisfies Omit<M02JobRecord, "jobScopeKey">;
  return {
    ...job,
    jobScopeKey:
      overrides.jobScopeKey ?? createM02JobScopeKey(job.jobLineageId, job.operationScope),
  };
};

function request(
  store: DeterministicM02JobStore,
  overrides: Partial<ReplaceM02JobRequest> = {},
): ReplaceM02JobRequest {
  const source = store.get("job_a");
  if (source === undefined) throw new Error("TEST_SOURCE_MISSING");
  return {
    commandId: "command_1",
    requestId: "request_1",
    idempotencyKey: "replace_1",
    sourceJobId: source.id,
    replacementJobId: "job_b",
    operationScope: source.operationScope,
    replacementSourceSnapshotId: source.sourceSnapshotId,
    replacementInputFingerprint: "b".repeat(64),
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "classification-analysis-v1",
    promptBundleVersion: "classification-prompt-v1",
    reasonCode: "FAILED_STAGE_REPLACEMENT",
    reason: "Retry the failed classification with corrected policy inputs.",
    evidenceIds: ["evidence-1"],
    actorId: "actor_1",
    actorRole: "EDITOR",
    expectedVersions: {
      [`job:${source.id}`]: source.recordVersion,
      "job:job_b": null,
      [createJobLineageGuardKey(source.jobLineageId, source.operationScope)]: null,
    },
    occurredAt: "2026-08-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("M02 job supersession", () => {
  it("uses the shared NFC canonical guard-key profile", () => {
    expect(createJobLineageGuardKey("caf\u00e9", "CLASSIFICATION")).toBe(
      createJobLineageGuardKey("cafe\u0301", "CLASSIFICATION"),
    );
    expect(() => createJobLineageGuardKey("bad\ud800", "CLASSIFICATION")).toThrow("Unicode scalar");
    expect(createM02JobScopeKey("lineage_1", "CLASSIFICATION")).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("atomically creates version 1, preserves M01 status, and rejects stale workers", () => {
    const store = jobStore([failedJob()]);
    const result = store.replace(request(store));

    expect(result.replacement).toMatchObject({
      id: "job_b",
      acquisitionStatus: "ACTIVE",
      supersessionState: "CONTROLLING",
      supersessionSequence: 2,
      recordVersion: 1,
    });
    expect(store.get("job_a")).toMatchObject({
      acquisitionStatus: "FAILED",
      supersessionState: "SUPERSEDED",
      supersededByJobId: "job_b",
      recordVersion: 4,
    });
    expect(store.history("lineage_1").map((job) => job.id)).toEqual(["job_a", "job_b"]);
    expect(() => {
      store.assertCanWrite("job_a");
    }).toThrow("JOB_SUPERSEDED");
    expect(() => {
      store.assertCanWrite("job_b");
    }).not.toThrow();
  });

  it("F35 returns an identical replay and rejects a changed idempotency payload", () => {
    const store = jobStore([failedJob()]);
    const firstRequest = request(store);
    const first = store.replace(firstRequest);
    expect(store.replace(firstRequest)).toEqual(first);
    expect(() => store.replace({ ...firstRequest, reason: "A different reason." })).toThrow(
      "IDEMPOTENCY_KEY_REUSED",
    );
    expect(expectedEvidence.get("F35")).toMatchObject({
      records: ["job:job_a", "job:job_b", "job-supersession:edge_1"],
      decision: "LINEAR_CONTROLLER_CHAIN",
      auditStates: ["SUPERSEDED", "CONTROLLING"],
    });
  });

  it("requires the exact complete expected-version map including null first use", () => {
    const store = jobStore([failedJob()]);
    const valid = request(store);
    expect(() =>
      store.replace({
        ...valid,
        expectedVersions: { ...valid.expectedVersions, "job:unexpected": null },
      }),
    ).toThrow("EXPECTED_VERSION_SET_INVALID");
    expect(() =>
      store.replace({
        ...valid,
        expectedVersions: { ...valid.expectedVersions, "job:job_b": 1 },
      }),
    ).toThrow("RECORD_NOT_FOUND");
    expect(() =>
      store.replace({
        ...valid,
        expectedVersions: { ...valid.expectedVersions, "job:job_a": 2 },
      }),
    ).toThrow("STALE_RECORD_VERSION");
    expect(() => store.replace({ ...valid, authority: "publish" } as never)).toThrow(
      "REFERENCE_INVALID",
    );

    const fullPipeline = jobStore([failedJob()]);
    const fullRequest = request(fullPipeline, {
      operationScope: "FULL_PIPELINE",
      expectedVersions: {
        "job:job_a": 3,
        "job:job_b": null,
        [createJobLineageGuardKey("lineage_1", "CLASSIFICATION")]: null,
        [createJobLineageGuardKey("lineage_1", "FULL_PIPELINE")]: null,
      },
    });
    expect(fullPipeline.replace(fullRequest).replacement.operationScope).toBe("FULL_PIPELINE");
  });

  it("rejects a superseded source and a non-linear second successor", () => {
    const store = jobStore([failedJob()]);
    const first = request(store);
    store.replace(first);
    expect(() =>
      store.replace({
        ...first,
        commandId: "command_2",
        requestId: "request_2",
        idempotencyKey: "replace_2",
        replacementJobId: "job_c",
        expectedVersions: {
          "job:job_a": 4,
          "job:job_c": null,
          [createJobLineageGuardKey("lineage_1", "CLASSIFICATION")]: 1,
        },
      }),
    ).toThrow("JOB_SUPERSEDED");
  });

  it("blocks identity replacement while classification has an unresolved controller", () => {
    const classification = failedJob();
    const identity = failedJob({
      id: "job_identity",
      acquisitionStatus: "OPERATOR_REVIEW_REQUIRED",
      operationScope: "IDENTITY_RESOLUTION",
      controllingClassificationDecisionId: "decision-classification",
      recordVersion: 2,
    });
    const store = jobStore([classification, identity]);
    expect(() =>
      store.replace(
        request(store, {
          sourceJobId: "job_identity",
          replacementJobId: "job_identity_b",
          operationScope: "IDENTITY_RESOLUTION",
          replacementInputFingerprint: "c".repeat(64),
          reasonCode: "RETRY_EXHAUSTED",
          expectedVersions: {
            "job:job_identity": 2,
            "job:job_identity_b": null,
            [createJobLineageGuardKey("lineage_1", "IDENTITY_RESOLUTION")]: null,
          },
        }),
      ),
    ).toThrow("TRANSITION_PROHIBITED");
  });

  it("enforces source-state, reason, role, and unchanged-input rules", () => {
    const active = jobStore([failedJob({ acquisitionStatus: "ACTIVE" })]);
    expect(() => active.replace(request(active))).toThrow("ROLE_NOT_AUTHORIZED");

    for (const actorRole of ["VIEWER", "VALIDATION_RESEARCHER"] as const) {
      const failed = jobStore([failedJob()]);
      expect(() => failed.replace(request(failed, { actorRole }))).toThrow("ROLE_NOT_AUTHORIZED");
    }

    const adminRequest = request(active, {
      actorRole: "ADMIN",
      reasonCode: "ADMINISTRATIVE_CORRECTION",
    });
    expect(active.replace(adminRequest).replacement.id).toBe("job_b");

    const completed = jobStore(
      [failedJob({ acquisitionStatus: "COMPLETED" })],
      [{ id: "snapshot_1", jobLineageId: "lineage_1", completed: true, supported: true }],
      [replacementInput({ inputFingerprint: "a".repeat(64) })],
    );
    expect(() =>
      completed.replace(
        request(completed, {
          reasonCode: "POLICY_OR_METHODOLOGY_CHANGE",
          replacementInputFingerprint: "a".repeat(64),
        }),
      ),
    ).toThrow("REPLACEMENT_INPUT_UNCHANGED");

    const unregisteredChange = jobStore([failedJob({ acquisitionStatus: "COMPLETED" })]);
    expect(() =>
      unregisteredChange.replace(
        request(unregisteredChange, {
          reasonCode: "POLICY_OR_METHODOLOGY_CHANGE",
          replacementInputFingerprint: "c".repeat(64),
        }),
      ),
    ).toThrow("REFERENCE_INVALID");

    const completedWithoutEligibleSnapshot = jobStore(
      [failedJob({ acquisitionStatus: "COMPLETED" })],
      [],
      [replacementInput()],
    );
    expect(() =>
      completedWithoutEligibleSnapshot.replace(
        request(completedWithoutEligibleSnapshot, {
          reasonCode: "POLICY_OR_METHODOLOGY_CHANGE",
        }),
      ),
    ).toThrow("REFERENCE_INVALID");

    const failedWithoutEligibleSnapshot = jobStore([failedJob()], [], [replacementInput()]);
    expect(() =>
      failedWithoutEligibleSnapshot.replace(request(failedWithoutEligibleSnapshot)),
    ).toThrow("REFERENCE_INVALID");

    const completedAdministrative = jobStore([failedJob({ acquisitionStatus: "COMPLETED" })]);
    expect(
      completedAdministrative.replace(
        request(completedAdministrative, {
          actorRole: "ADMIN",
          reasonCode: "ADMINISTRATIVE_CORRECTION",
        }),
      ).replacement.id,
    ).toBe("job_b");

    const changedSnapshotSameInput = jobStore(
      [failedJob({ acquisitionStatus: "COMPLETED" })],
      [{ id: "snapshot_2", jobLineageId: "lineage_1", completed: true, supported: true }],
      [replacementInput({ sourceSnapshotId: "snapshot_2", inputFingerprint: "a".repeat(64) })],
    );
    expect(() =>
      changedSnapshotSameInput.replace(
        request(changedSnapshotSameInput, {
          reasonCode: "NEW_SUPPORTED_SNAPSHOT",
          replacementSourceSnapshotId: "snapshot_2",
          replacementInputFingerprint: "a".repeat(64),
        }),
      ),
    ).toThrow("REPLACEMENT_INPUT_UNCHANGED");
  });

  it("requires eligible same-lineage snapshots and evidence for administrative correction", () => {
    const source = failedJob({ acquisitionStatus: "COMPLETED" });
    const store = jobStore(
      [source],
      [
        {
          id: "snapshot_2",
          jobLineageId: "lineage_1",
          completed: true,
          supported: true,
        },
        {
          id: "snapshot_other",
          jobLineageId: "lineage_other",
          completed: true,
          supported: true,
        },
      ],
      [replacementInput({ sourceSnapshotId: "snapshot_2" })],
    );
    expect(
      store.replace(
        request(store, {
          reasonCode: "NEW_SUPPORTED_SNAPSHOT",
          replacementSourceSnapshotId: "snapshot_2",
        }),
      ).replacement.sourceSnapshotId,
    ).toBe("snapshot_2");

    const wrongLineage = jobStore(
      [source],
      [
        {
          id: "snapshot_other",
          jobLineageId: "lineage_other",
          completed: true,
          supported: true,
        },
      ],
      [replacementInput({ sourceSnapshotId: "snapshot_other" })],
    );
    expect(() =>
      wrongLineage.replace(
        request(wrongLineage, {
          reasonCode: "NEW_SUPPORTED_SNAPSHOT",
          replacementSourceSnapshotId: "snapshot_other",
        }),
      ),
    ).toThrow("REFERENCE_INVALID");

    const active = jobStore([failedJob({ acquisitionStatus: "ACTIVE" })]);
    expect(() =>
      active.replace(
        request(active, {
          actorRole: "ADMIN",
          reasonCode: "ADMINISTRATIVE_CORRECTION",
          evidenceIds: [],
        }),
      ),
    ).toThrow("REFERENCE_INVALID");
  });

  it("F25/F27 retains mixed and partial evidence without producing an unsafe handoff", () => {
    const mixed = aggregateM02JobResult({
      candidates: [
        { id: "resolved", disposition: "IDENTITY_RESOLVED" },
        { id: "rejected", disposition: "REJECTED" },
        { id: "ambiguous", disposition: "IDENTITY_REVIEW_REQUIRED" },
      ],
      completedEvidenceIds: ["evidence-b", "evidence-a"],
      failureCode: null,
      cancelled: false,
    });
    expect(mixed).toEqual({
      status: "OPERATOR_REVIEW_REQUIRED",
      reviewState: "IDENTITY_REVIEW_REQUIRED",
      readyCandidateIds: ["resolved"],
      retainedEvidenceIds: ["evidence-a", "evidence-b"],
      handoffAllowed: false,
    });
    expect(expectedEvidence.get("F25")).toMatchObject({
      records: ["candidate:resolved", "candidate:rejected", "candidate:ambiguous"],
      decision: mixed.status,
      auditStates: [mixed.reviewState],
    });

    const partial = aggregateM02JobResult({
      candidates: [{ id: "resolved", disposition: "IDENTITY_RESOLVED" }],
      completedEvidenceIds: ["evidence-a"],
      failureCode: "FAILED_IDENTITY",
      cancelled: false,
    });
    expect(partial).toMatchObject({
      status: "FAILED",
      retainedEvidenceIds: ["evidence-a"],
      handoffAllowed: false,
    });
    expect(expectedEvidence.get("F27")).toMatchObject({
      records: partial.retainedEvidenceIds.map((id) => `evidence:${id}`),
      decision: "FAILED_NO_HANDOFF",
      auditStates: ["EVIDENCE_RETAINED"],
    });
  });

  it("F26 rejects writes from cancelled and superseded workers", () => {
    expect(expectedEvidence.get("F26")).toMatchObject({
      records: ["job:cancelled", "job:superseded"],
      decision: "STALE_WRITE_REJECTED",
      auditStates: ["REJECTED"],
    });
    const cancelled = jobStore([failedJob({ acquisitionStatus: "CANCELLED" })]);
    expect(() => {
      cancelled.assertCanWrite("job_a");
    }).toThrow("TRANSITION_PROHIBITED");

    const superseded = jobStore([failedJob()]);
    superseded.replace(request(superseded));
    expect(() => {
      superseded.assertCanWrite("job_a");
    }).toThrow("JOB_SUPERSEDED");
  });

  it("lets classification supersede dependent identity while identity cannot run ahead", () => {
    const classification = failedJob();
    const identity = failedJob({
      id: "job_identity",
      operationScope: "IDENTITY_RESOLUTION",
      controllingClassificationDecisionId: "decision_1",
      recordVersion: 2,
    });
    const store = jobStore([classification, identity]);
    const replacement = request(store, {
      expectedVersions: {
        "job:job_a": 3,
        "job:job_identity": 2,
        "job:job_b": null,
        [createJobLineageGuardKey("lineage_1", "CLASSIFICATION")]: null,
        [createJobLineageGuardKey("lineage_1", "IDENTITY_RESOLUTION")]: null,
      },
    });
    store.replace(replacement);
    expect(store.get("job_identity")).toMatchObject({
      supersessionState: "SUPERSEDED",
      supersededByJobId: "job_b",
    });
    expect(
      store
        .auditHistory()
        .map(({ sourceJobId }) => sourceJobId)
        .sort(),
    ).toEqual(["job_a", "job_identity"]);

    const identityStore = jobStore([failedJob({ acquisitionStatus: "ACTIVE" }), identity]);
    const identityRequest = request(identityStore, {
      sourceJobId: "job_identity",
      replacementJobId: "job_identity_b",
      operationScope: "IDENTITY_RESOLUTION",
      replacementInputFingerprint: "c".repeat(64),
      expectedVersions: {
        "job:job_identity": 2,
        "job:job_identity_b": null,
        [createJobLineageGuardKey("lineage_1", "IDENTITY_RESOLUTION")]: null,
      },
    });
    expect(() => identityStore.replace(identityRequest)).toThrow("TRANSITION_PROHIBITED");
  });
});
