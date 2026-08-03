import type { Timestamp } from "./primitives.js";
import type { ForkSignals, LicenseSignals, ReleaseSignals, RepositoryMetadata } from "./ports.js";

export const AcquisitionStages = [
  "RECEIVED",
  "VALIDATING_SOURCE",
  "ACQUIRING_SOURCE",
  "INVENTORYING_SOURCE",
] as const;
export type AcquisitionStage = (typeof AcquisitionStages)[number];

export type AcquisitionJobStatus =
  "ACTIVE" | "COMPLETED" | "FAILED" | "CANCELLED" | "OPERATOR_REVIEW_REQUIRED";

export interface SourceSubmission {
  readonly id: string;
  readonly requestedReference: string;
  readonly requestedBy: string;
  readonly receivedAt: Timestamp;
  readonly idempotencyKey: string;
}

export interface SourceReference {
  readonly id: string;
  readonly provider: "github";
  readonly canonicalUrl: string;
  readonly owner: string;
  readonly repository: string;
}

export interface SourceSnapshot {
  readonly id: string;
  readonly provider: "github";
  readonly providerRepositoryId: string;
  readonly immutableRevision: string;
  readonly acquisitionPolicyVersion: string;
  readonly acquiredAt: Timestamp;
}

export type EntryDisposition = "SELECTED" | "ACQUIRED" | "SKIPPED" | "QUARANTINED" | "REJECTED";

export interface SourceEntry {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly originalPath: string;
  readonly normalizedPath: string | null;
  readonly entryType: "file" | "symlink" | "submodule";
  readonly byteLength: number;
  readonly mediaType: string | null;
  readonly candidateFileClass: "PRIMARY" | "DOCUMENTATION" | "MANIFEST" | "SOURCE_TEXT" | "OTHER";
  readonly sha256: string | null;
  readonly objectKey: string | null;
  readonly priority: number;
  readonly disposition: EntryDisposition;
  readonly reasonCodes: readonly string[];
}

export interface SourceDocument {
  readonly id: string;
  readonly sourceEntryId: string;
  readonly encoding: "utf-8";
  readonly lineCount: number;
  readonly contentHash: string;
}

export interface AcquisitionPolicyVersion {
  readonly id: string;
  readonly maxEntries: number;
  readonly maxSelectedFiles: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
  readonly maxPathBytes: number;
  readonly maxLines: number;
  readonly allowedExtensions: readonly string[];
  readonly allowedEncodings: readonly "utf-8"[];
}

export interface AcquisitionWarning {
  readonly code: string;
  readonly path: string | null;
  readonly message: string;
}

export interface AcquisitionFailure {
  readonly code: string;
  readonly retryable: boolean;
  readonly safeDetail: string;
  readonly path: string | null;
}

export interface AcquisitionJob {
  readonly id: string;
  readonly submissionId: string;
  readonly status: AcquisitionJobStatus;
  readonly stage: AcquisitionStage;
  readonly attempt: number;
  readonly sourceSnapshotId: string | null;
  readonly completedStages: readonly AcquisitionStage[];
  readonly warnings: readonly AcquisitionWarning[];
  readonly failure: AcquisitionFailure | null;
  readonly cancellationRequested: boolean;
}

export interface AcquisitionJobStore {
  createOrGet(job: AcquisitionJob, idempotencyKey: string): Promise<AcquisitionJob>;
  get(jobId: string): Promise<AcquisitionJob | undefined>;
  save(job: AcquisitionJob): Promise<void>;
  bindSnapshot(identityKey: string, snapshot: SourceSnapshot): Promise<SourceSnapshot>;
  saveResult(result: AcquisitionResult): Promise<void>;
  getResult(jobId: string): Promise<AcquisitionResult | undefined>;
}

export interface AcquisitionResult {
  readonly jobId: string;
  readonly sourceReference: SourceReference;
  readonly sourceSnapshot: SourceSnapshot;
  readonly repositoryMetadata: RepositoryMetadata;
  readonly releaseSignals: ReleaseSignals;
  readonly licenseSignals: LicenseSignals;
  readonly forkSignals: ForkSignals;
  readonly entries: readonly SourceEntry[];
  readonly documents: readonly SourceDocument[];
}
