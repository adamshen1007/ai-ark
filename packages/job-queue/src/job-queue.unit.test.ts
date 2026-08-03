import { describe, expect, it } from "vitest";

import type { AcquisitionJob, SourceSnapshot } from "@ai-ark/contracts";
import {
  advanceJob,
  cancelJob,
  completeJob,
  DeterministicAcquisitionJobStore,
  failJob,
  retryJob,
} from "./index.js";

const initialJob = (): AcquisitionJob => ({
  id: "job_1",
  submissionId: "submission_1",
  status: "ACTIVE",
  stage: "RECEIVED",
  attempt: 1,
  sourceSnapshotId: null,
  completedStages: [],
  warnings: [],
  failure: null,
  cancellationRequested: false,
});

describe("M01 durable job semantics", () => {
  it("advances only through M01 stages and preserves partial completion", () => {
    const validating = advanceJob(initialJob(), "VALIDATING_SOURCE");
    const acquiring = advanceJob(validating, "ACQUIRING_SOURCE");
    const inventorying = advanceJob(acquiring, "INVENTORYING_SOURCE");
    expect(completeJob(inventorying, "snapshot_1")).toMatchObject({
      status: "COMPLETED",
      completedStages: ["RECEIVED", "VALIDATING_SOURCE", "ACQUIRING_SOURCE", "INVENTORYING_SOURCE"],
    });
    expect(() => advanceJob(initialJob(), "ACQUIRING_SOURCE")).toThrow("INVALID_STAGE_TRANSITION");
  });

  it("supports retry, cancellation, and bounded operator review", () => {
    const failure = {
      code: "PROVIDER_TIMEOUT",
      retryable: true,
      safeDetail: "timeout",
      path: null,
    };
    const failed = failJob(initialJob(), failure, 3);
    expect(retryJob(failed)).toMatchObject({ status: "ACTIVE", stage: "RECEIVED", attempt: 2 });
    expect(cancelJob(initialJob()).status).toBe("CANCELLED");
    expect(failJob({ ...initialJob(), attempt: 3 }, failure, 3).status).toBe(
      "OPERATOR_REVIEW_REQUIRED",
    );
  });

  it("deduplicates submissions and immutable snapshots", async () => {
    const store = new DeterministicAcquisitionJobStore();
    const first = await store.createOrGet(initialJob(), "same-request");
    const duplicate = await store.createOrGet({ ...initialJob(), id: "job_2" }, "same-request");
    expect(duplicate.id).toBe(first.id);
    const snapshot: SourceSnapshot = {
      id: "snapshot_1",
      provider: "github",
      providerRepositoryId: "42",
      immutableRevision: "a".repeat(40),
      acquisitionPolicyVersion: "v1",
      acquiredAt: "2026-01-01T00:00:00.000Z" as never,
    };
    const bound = await store.bindSnapshot("42:a:v1", snapshot);
    const duplicateSnapshot = await store.bindSnapshot("42:a:v1", {
      ...snapshot,
      id: "snapshot_2",
    });
    expect(duplicateSnapshot.id).toBe(bound.id);
  });

  it("does not allow a stale worker save to overwrite durable cancellation", async () => {
    const store = new DeterministicAcquisitionJobStore();
    const active = await store.createOrGet(initialJob(), "request");
    await store.save(cancelJob(active));
    await expect(store.save({ ...active, status: "COMPLETED" })).rejects.toThrow("JOB_CANCELLED");
    expect(await store.get(active.id)).toMatchObject({
      status: "CANCELLED",
      cancellationRequested: true,
    });
  });
});
