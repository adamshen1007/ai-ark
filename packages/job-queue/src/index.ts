import type {
  AcquisitionFailure,
  AcquisitionJob,
  AcquisitionJobStore,
  AcquisitionResult,
  AcquisitionStage,
  SourceSnapshot,
} from "@ai-ark/contracts";

const stageOrder: readonly AcquisitionStage[] = [
  "RECEIVED",
  "VALIDATING_SOURCE",
  "ACQUIRING_SOURCE",
  "INVENTORYING_SOURCE",
];

function copy(job: AcquisitionJob): AcquisitionJob {
  return {
    ...job,
    completedStages: [...job.completedStages],
    warnings: job.warnings.map((warning) => ({ ...warning })),
    failure: job.failure === null ? null : { ...job.failure },
  };
}

export class DeterministicAcquisitionJobStore implements AcquisitionJobStore {
  private readonly jobs = new Map<string, AcquisitionJob>();
  private readonly jobIdsByIdempotencyKey = new Map<string, string>();
  private readonly snapshotsByIdentity = new Map<string, SourceSnapshot>();
  private readonly resultsByJob = new Map<string, AcquisitionResult>();

  public createOrGet(job: AcquisitionJob, idempotencyKey: string): Promise<AcquisitionJob> {
    const existingId = this.jobIdsByIdempotencyKey.get(idempotencyKey);
    if (existingId !== undefined) {
      const existing = this.jobs.get(existingId);
      if (existing === undefined) throw new Error("JOB_STORE_CORRUPT");
      return Promise.resolve(copy(existing));
    }
    this.jobs.set(job.id, copy(job));
    this.jobIdsByIdempotencyKey.set(idempotencyKey, job.id);
    return Promise.resolve(copy(job));
  }

  public get(jobId: string): Promise<AcquisitionJob | undefined> {
    const job = this.jobs.get(jobId);
    return Promise.resolve(job === undefined ? undefined : copy(job));
  }

  public save(job: AcquisitionJob): Promise<void> {
    const existing = this.jobs.get(job.id);
    if (existing === undefined) return Promise.reject(new Error("JOB_NOT_FOUND"));
    if (
      (existing.status === "CANCELLED" || existing.cancellationRequested) &&
      job.status !== "CANCELLED"
    ) {
      return Promise.reject(new Error("JOB_CANCELLED"));
    }
    this.jobs.set(job.id, copy(job));
    return Promise.resolve();
  }

  public bindSnapshot(identityKey: string, snapshot: SourceSnapshot): Promise<SourceSnapshot> {
    const existing = this.snapshotsByIdentity.get(identityKey);
    if (existing !== undefined) return Promise.resolve({ ...existing });
    this.snapshotsByIdentity.set(identityKey, { ...snapshot });
    return Promise.resolve({ ...snapshot });
  }

  public saveResult(result: AcquisitionResult): Promise<void> {
    this.resultsByJob.set(result.jobId, structuredClone(result));
    return Promise.resolve();
  }

  public getResult(jobId: string): Promise<AcquisitionResult | undefined> {
    const result = this.resultsByJob.get(jobId);
    return Promise.resolve(result === undefined ? undefined : structuredClone(result));
  }
}

export function advanceJob(job: AcquisitionJob, nextStage: AcquisitionStage): AcquisitionJob {
  if (job.status !== "ACTIVE" || job.cancellationRequested) throw new Error("JOB_NOT_ADVANCEABLE");
  const currentIndex = stageOrder.indexOf(job.stage);
  const nextIndex = stageOrder.indexOf(nextStage);
  if (nextIndex !== currentIndex + 1) throw new Error("INVALID_STAGE_TRANSITION");
  return {
    ...job,
    stage: nextStage,
    completedStages: [...new Set([...job.completedStages, job.stage])],
  };
}

export function completeJob(job: AcquisitionJob, snapshotId: string): AcquisitionJob {
  if (job.stage !== "INVENTORYING_SOURCE" || job.status !== "ACTIVE") {
    throw new Error("JOB_NOT_COMPLETABLE");
  }
  return {
    ...job,
    status: "COMPLETED",
    sourceSnapshotId: snapshotId,
    completedStages: [...new Set([...job.completedStages, job.stage])],
  };
}

export function failJob(
  job: AcquisitionJob,
  failure: AcquisitionFailure,
  maxAttempts: number,
): AcquisitionJob {
  if (job.status !== "ACTIVE") throw new Error("JOB_NOT_FAILABLE");
  return {
    ...job,
    status: failure.retryable && job.attempt >= maxAttempts ? "OPERATOR_REVIEW_REQUIRED" : "FAILED",
    failure,
  };
}

export function retryJob(job: AcquisitionJob): AcquisitionJob {
  if (job.status !== "FAILED" || job.failure?.retryable !== true)
    throw new Error("JOB_NOT_RETRYABLE");
  return {
    ...job,
    status: "ACTIVE",
    stage: "RECEIVED",
    attempt: job.attempt + 1,
    failure: null,
  };
}

export function cancelJob(job: AcquisitionJob): AcquisitionJob {
  if (job.status !== "ACTIVE") throw new Error("JOB_NOT_CANCELLABLE");
  return { ...job, status: "CANCELLED", cancellationRequested: true };
}
