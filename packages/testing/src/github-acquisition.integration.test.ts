import { describe, expect, it } from "vitest";

import type { AcquisitionRequest, AcquisitionTelemetryEvent } from "@ai-ark/acquisition";
import { defaultAcquisitionPolicy, runAcquisition } from "@ai-ark/acquisition";
import type { GitHubTransport } from "@ai-ark/github-source";
import { GitHubSourceProvider } from "@ai-ark/github-source";
import { cancelJob, DeterministicAcquisitionJobStore, retryJob } from "@ai-ark/job-queue";
import { DeterministicObjectStorage } from "@ai-ark/object-storage";

function fakeTransport(bytes: Uint8Array, getBlob: () => Promise<Uint8Array>): GitHubTransport {
  return {
    getRepository: () =>
      Promise.resolve({
        id: 7,
        name: "safe",
        owner: { login: "fixture" },
        description: null,
        default_branch: "main",
        archived: false,
        private: false,
        fork: false,
      }),
    getCommit: () => Promise.resolve({ sha: "b".repeat(40) }),
    getTree: () =>
      Promise.resolve({
        truncated: false,
        tree: [
          {
            path: "SKILL.md",
            type: "blob",
            mode: "100644",
            sha: "blob",
            size: bytes.length,
          },
        ],
      }),
    getBlob,
    getTags: () => Promise.resolve([]),
    getLatestRelease: () => Promise.resolve(null),
    getLicense: () => Promise.resolve(null),
  };
}

function acquisitionRequest(): AcquisitionRequest {
  return {
    requestId: "request_1",
    correlationId: "correlation_1",
    job: {
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
    },
    idempotencyKey: "request-1",
    requestedReference: "https://github.com/fixture/safe",
    sourceReferenceId: "reference_1",
    sourceSnapshotId: "snapshot_1",
    acquiredAt: "2026-01-01T00:00:00.000Z" as never,
    maxAttempts: 3,
  };
}

describe("fake GitHub acquisition integration", () => {
  it("resolves, inventories, fetches, checks, hashes, stores, and records safe telemetry", async () => {
    const bytes = new TextEncoder().encode("# Skill\nSafe fixture");
    const transport = fakeTransport(bytes, () => Promise.resolve(bytes));
    const provider = new GitHubSourceProvider(transport);
    const storage = new DeterministicObjectStorage();
    const jobs = new DeterministicAcquisitionJobStore();
    const request = acquisitionRequest();
    const events: AcquisitionTelemetryEvent[] = [];
    const first = await runAcquisition(request, {
      provider,
      storage,
      jobs,
      telemetry: { record: (event) => events.push(event) },
    });
    const repeated = await runAcquisition(request, { provider, storage, jobs });
    expect(first.job.status).toBe("COMPLETED");
    expect(first.result?.entries[0]?.priority).toBe(100);
    expect(first.result?.sourceSnapshot.immutableRevision).toBe("b".repeat(40));
    expect(repeated.result?.sourceSnapshot.id).toBe(first.result?.sourceSnapshot.id);
    expect(storage.keys()[0]).toMatch(/^source-files\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/u);
    expect(storage.keys()).toHaveLength(1);
    expect(events.map(({ event }) => event)).toEqual([
      "acquisition.stage.entered",
      "acquisition.stage.entered",
      "acquisition.snapshot.resolved",
      "acquisition.stage.entered",
      "acquisition.completed",
    ]);
    expect(events.at(-1)).toMatchObject({
      requestId: "request_1",
      correlationId: "correlation_1",
      selectedFileCount: 1,
    });
  });

  it("retains partial inventory and resumes a retry without duplicating the snapshot", async () => {
    const bytes = new TextEncoder().encode("# Skill\nRetry fixture");
    let unavailable = true;
    const transport = fakeTransport(bytes, () =>
      unavailable ? Promise.reject(new Error("PROVIDER_TIMEOUT")) : Promise.resolve(bytes),
    );
    const provider = new GitHubSourceProvider(transport);
    const storage = new DeterministicObjectStorage();
    const jobs = new DeterministicAcquisitionJobStore();
    const request = acquisitionRequest();
    const unavailableTelemetry = {
      record: (): void => {
        throw new Error("TELEMETRY_UNAVAILABLE");
      },
    };

    const failed = await runAcquisition(request, {
      provider,
      storage,
      jobs,
      telemetry: unavailableTelemetry,
    });
    expect(failed.job).toMatchObject({ status: "FAILED", sourceSnapshotId: "snapshot_1" });
    expect((await jobs.getResult("job_1"))?.entries[0]).toMatchObject({
      disposition: "SELECTED",
    });

    unavailable = false;
    await jobs.save(retryJob(failed.job));
    const completed = await runAcquisition(request, {
      provider,
      storage,
      jobs,
      telemetry: unavailableTelemetry,
    });
    expect(completed.job).toMatchObject({ status: "COMPLETED", attempt: 2 });
    expect(completed.result?.sourceSnapshot.id).toBe("snapshot_1");
    expect(storage.keys()).toHaveLength(1);
  });

  it("does not fetch bytes for a provider-declared oversized entry", async () => {
    const bytes = new TextEncoder().encode("safe");
    let blobCalls = 0;
    const provider = new GitHubSourceProvider(
      fakeTransport(bytes, () => {
        blobCalls += 1;
        return Promise.reject(new Error("OVERSIZED_CONTENT_FETCHED"));
      }),
    );
    const storage = new DeterministicObjectStorage();
    const outcome = await runAcquisition(acquisitionRequest(), {
      provider,
      storage,
      jobs: new DeterministicAcquisitionJobStore(),
      policy: { ...defaultAcquisitionPolicy, maxFileBytes: bytes.length - 1 },
    });
    expect(outcome.job.status).toBe("COMPLETED");
    expect(outcome.result?.entries[0]).toMatchObject({
      disposition: "SKIPPED",
      reasonCodes: ["FILE_TOO_LARGE"],
    });
    expect(blobCalls).toBe(0);
    expect(storage.keys()).toHaveLength(0);
  });

  it("preserves concurrent durable cancellation and stops before storage", async () => {
    const bytes = new TextEncoder().encode("# Skill\nCancel fixture");
    const jobs = new DeterministicAcquisitionJobStore();
    let blobCalls = 0;
    const transport = fakeTransport(bytes, async () => {
      blobCalls += 1;
      const active = await jobs.get("job_1");
      if (active === undefined) throw new Error("JOB_NOT_FOUND");
      await jobs.save(cancelJob(active));
      return bytes;
    });
    const storage = new DeterministicObjectStorage();
    const outcome = await runAcquisition(acquisitionRequest(), {
      provider: new GitHubSourceProvider(transport),
      storage,
      jobs,
    });
    expect(outcome.job).toMatchObject({ status: "CANCELLED", cancellationRequested: true });
    expect(blobCalls).toBe(1);
    expect(storage.keys()).toHaveLength(0);
    expect((await jobs.get("job_1"))?.status).toBe("CANCELLED");
  });

  it("reuses a canonical snapshot across jobs without cross-reference inconsistency", async () => {
    const bytes = new TextEncoder().encode("# Skill\nShared snapshot");
    const provider = new GitHubSourceProvider(fakeTransport(bytes, () => Promise.resolve(bytes)));
    const storage = new DeterministicObjectStorage();
    const jobs = new DeterministicAcquisitionJobStore();
    const firstRequest = acquisitionRequest();
    const secondRequest: AcquisitionRequest = {
      ...firstRequest,
      job: { ...firstRequest.job, id: "job_2", submissionId: "submission_2" },
      idempotencyKey: "request-2",
      sourceReferenceId: "reference_2",
      sourceSnapshotId: "snapshot_2",
    };
    const first = await runAcquisition(firstRequest, { provider, storage, jobs });
    const second = await runAcquisition(secondRequest, { provider, storage, jobs });
    expect(first.result?.sourceSnapshot.id).toBe("snapshot_1");
    expect(second.result?.sourceSnapshot.id).toBe("snapshot_1");
    expect(first.result?.sourceReference.id).toBe("reference_1");
    expect(second.result?.sourceReference.id).toBe("reference_2");
  });
});
