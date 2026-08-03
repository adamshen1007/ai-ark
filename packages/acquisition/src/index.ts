import { createHash } from "node:crypto";
import { posix } from "node:path";
import type {
  AcquisitionFailure,
  AcquisitionJob,
  AcquisitionJobStore,
  AcquisitionPolicyVersion,
  AcquisitionResult,
  ObjectStorage,
  SourceDocument,
  SourceEntry,
  SourceEntryContent,
  SourceEntryDescriptor,
  SourceProvider,
  SourceReference,
  SourceSnapshot,
  Timestamp,
} from "@ai-ark/contracts";

export const defaultAcquisitionPolicy: AcquisitionPolicyVersion = {
  id: "acquisition-policy-v1",
  maxEntries: 10_000,
  maxSelectedFiles: 1_000,
  maxFileBytes: 2_000_000,
  maxTotalBytes: 50_000_000,
  maxPathBytes: 512,
  maxLines: 25_000,
  allowedExtensions: [
    ".css",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".jsx",
    ".md",
    ".mjs",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
  ],
  allowedEncodings: ["utf-8"],
};

const executableExtensions = new Set([
  ".app",
  ".bat",
  ".bin",
  ".cmd",
  ".com",
  ".dll",
  ".dylib",
  ".exe",
  ".msi",
  ".ps1",
  ".sh",
  ".so",
]);
const archiveExtensions = new Set([
  ".7z",
  ".bz2",
  ".gz",
  ".jar",
  ".rar",
  ".tar",
  ".tgz",
  ".war",
  ".xz",
  ".zip",
]);

export interface InspectedPath {
  readonly normalizedPath: string | null;
  readonly disposition: "ELIGIBLE" | "QUARANTINED";
  readonly reasonCodes: readonly string[];
}

export function inspectPath(path: string, policy = defaultAcquisitionPolicy): InspectedPath {
  const reasons: string[] = [];
  if (path.includes("\0")) reasons.push("PATH_NULL_BYTE");
  if (path.includes("\\")) reasons.push("PATH_BACKSLASH");
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) reasons.push("PATH_ABSOLUTE");
  if (path.length === 0) reasons.push("PATH_EMPTY");
  if (Buffer.byteLength(path, "utf8") > policy.maxPathBytes) reasons.push("PATH_TOO_LONG");

  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    reasons.push("PATH_INVALID_PERCENT_ENCODING");
  }
  const segments = decoded.split("/");
  if (segments.some((segment) => segment === "..")) reasons.push("PATH_TRAVERSAL");
  if (segments.some((segment) => segment === "" || segment === "."))
    reasons.push("PATH_AMBIGUOUS_SEGMENT");
  const normalizedPath = reasons.length === 0 ? posix.normalize(path) : null;
  return {
    normalizedPath,
    disposition: reasons.length === 0 ? "ELIGIBLE" : "QUARANTINED",
    reasonCodes: [...new Set(reasons)].sort(),
  };
}

export interface InspectedContent {
  readonly disposition: "ACQUIRED" | "SKIPPED" | "QUARANTINED";
  readonly reasonCodes: readonly string[];
  readonly mediaType: string | null;
  readonly text: string | null;
  readonly lineCount: number;
  readonly sha256: string | null;
}

function extensionFor(path: string): string {
  const filename = posix.basename(path).toLowerCase();
  if (["dockerfile", "license", "makefile", "readme"].includes(filename)) return "";
  if (filename.endsWith(".example") || filename.endsWith(".sample")) return ".txt";
  return posix.extname(filename);
}

export function inspectContent(
  path: string,
  bytes: Uint8Array,
  policy = defaultAcquisitionPolicy,
): InspectedContent {
  if (!policy.allowedEncodings.includes("utf-8")) {
    return rejected("QUARANTINED", "UNSUPPORTED_ENCODING_POLICY");
  }
  const extension = extensionFor(path);
  if (bytes.byteLength > policy.maxFileBytes) {
    return rejected("SKIPPED", "FILE_TOO_LARGE");
  }
  if (archiveExtensions.has(extension)) return rejected("QUARANTINED", "ARCHIVE_CONTENT");
  if (executableExtensions.has(extension)) return rejected("QUARANTINED", "EXECUTABLE_CONTENT");
  if (hasArchiveSignature(bytes)) return rejected("QUARANTINED", "ARCHIVE_CONTENT");
  if (hasExecutableSignature(bytes)) return rejected("QUARANTINED", "EXECUTABLE_CONTENT");
  if (extension !== "" && !policy.allowedExtensions.includes(extension)) {
    return rejected("SKIPPED", "EXTENSION_NOT_ALLOWED");
  }
  if (bytes.includes(0)) return rejected("QUARANTINED", "BINARY_CONTENT");
  if (isEncrypted(bytes)) return rejected("QUARANTINED", "ENCRYPTED_CONTENT");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return rejected("QUARANTINED", "INVALID_ENCODING");
  }
  const controlBytes = [...bytes].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length;
  if (bytes.byteLength > 0 && controlBytes / bytes.byteLength > 0.01) {
    return rejected("QUARANTINED", "BINARY_CONTENT");
  }
  const lineCount = text.length === 0 ? 0 : text.split(/\r?\n/u).length;
  if (lineCount > policy.maxLines) return rejected("SKIPPED", "LINE_LIMIT_EXCEEDED");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    disposition: "ACQUIRED",
    reasonCodes: [],
    mediaType: mediaTypeFor(extension),
    text,
    lineCount,
    sha256,
  };
}

function rejected(disposition: "SKIPPED" | "QUARANTINED", reason: string): InspectedContent {
  return {
    disposition,
    reasonCodes: [reason],
    mediaType: null,
    text: null,
    lineCount: 0,
    sha256: null,
  };
}

function isEncrypted(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(bytes.slice(0, 40));
  return prefix.startsWith("-----BEGIN PGP MESSAGE-----") || prefix.startsWith("Salted__");
}

function hasArchiveSignature(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
    (bytes[0] === 0x1f && bytes[1] === 0x8b) ||
    (bytes[0] === 0x37 && bytes[1] === 0x7a)
  );
}

function hasExecutableSignature(bytes: Uint8Array): boolean {
  return (
    (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
    (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) ||
    (bytes[0] === 0x23 && bytes[1] === 0x21)
  );
}

function mediaTypeFor(extension: string): string {
  if (extension === ".json") return "application/json";
  if (extension === ".html") return "text/html";
  if (extension === ".css") return "text/css";
  if (extension === ".md") return "text/markdown";
  return "text/plain";
}

export function entryPriority(path: string): number {
  const lower = path.toLowerCase();
  if (lower === "skill.md" || lower.endsWith("/skill.md")) return 100;
  if (/(^|\/)(readme|license|changelog)(\.|$)/u.test(lower)) return 90;
  if (/(^|\/)(package\.json|pyproject\.toml|cargo\.toml)$/u.test(lower)) return 80;
  if (/^(docs|examples|references)\//u.test(lower)) return 70;
  if (/(^|\/)(?:config|configuration|settings).*(?:example|sample)/u.test(lower)) return 70;
  if (/\.(md|txt|ya?ml|json)$/u.test(lower)) return 60;
  return 10;
}

export function candidateFileClass(
  path: string,
): "PRIMARY" | "DOCUMENTATION" | "MANIFEST" | "SOURCE_TEXT" | "OTHER" {
  const lower = path.toLowerCase();
  if (lower === "skill.md" || lower.endsWith("/skill.md")) return "PRIMARY";
  if (/(^|\/)(readme|license|changelog)(\.|$)/u.test(lower)) return "DOCUMENTATION";
  if (/(^|\/)(package\.json|pyproject\.toml|cargo\.toml)$/u.test(lower)) return "MANIFEST";
  if (/\.(css|html|js|jsx|mjs|ts|tsx)$/u.test(lower)) return "SOURCE_TEXT";
  return "OTHER";
}

export interface InventoryResult {
  readonly entries: readonly SourceEntry[];
  readonly totalListedBytes: number;
  readonly warningCodes: readonly string[];
}

export function inventoryDescriptors(
  snapshotId: string,
  descriptors: readonly SourceEntryDescriptor[],
  policy = defaultAcquisitionPolicy,
): InventoryResult {
  const sorted = [...descriptors].sort(
    (a, b) => entryPriority(b.path) - entryPriority(a.path) || comparePaths(a.path, b.path),
  );
  const exact = new Set<string>();
  const folded = new Set<string>();
  const warnings: string[] = [];
  let total = 0;
  let selectedBytes = 0;
  let selectedCount = 0;
  const entries = sorted.map((descriptor, index): SourceEntry => {
    const pathInspection = inspectPath(descriptor.path, policy);
    const reasons = [...pathInspection.reasonCodes];
    const normalized = pathInspection.normalizedPath;
    if (descriptor.kind === "symlink") reasons.push("SYMLINK_ENTRY");
    if (descriptor.kind === "submodule") reasons.push("SUBMODULE_ENTRY");
    if (descriptor.executable === true) reasons.push("EXECUTABLE_ENTRY");
    if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 0) {
      reasons.push("INVALID_ENTRY_SIZE");
    } else {
      total += descriptor.byteLength;
      if (descriptor.byteLength > policy.maxFileBytes) reasons.push("FILE_TOO_LARGE");
    }
    if (normalized !== null) {
      if (exact.has(normalized)) reasons.push("DUPLICATE_PATH");
      if (folded.has(normalized.toLocaleLowerCase("en-US"))) reasons.push("CASE_COLLISION");
      exact.add(normalized);
      folded.add(normalized.toLocaleLowerCase("en-US"));
    }
    if (index >= policy.maxEntries) reasons.push("ENTRY_LIMIT_EXCEEDED");
    if (reasons.length === 0) {
      selectedCount += 1;
      selectedBytes += descriptor.byteLength;
      if (selectedCount > policy.maxSelectedFiles) reasons.push("SELECTED_FILE_LIMIT_EXCEEDED");
      if (selectedBytes > policy.maxTotalBytes) reasons.push("TOTAL_BYTE_LIMIT_EXCEEDED");
    }
    warnings.push(...reasons);
    return {
      id: `entry_${snapshotId}_${String(index + 1).padStart(6, "0")}`,
      sourceSnapshotId: snapshotId,
      originalPath: descriptor.path,
      normalizedPath: normalized,
      entryType: descriptor.kind,
      byteLength: descriptor.byteLength,
      mediaType: null,
      candidateFileClass: candidateFileClass(descriptor.path),
      sha256: null,
      objectKey: null,
      priority: entryPriority(descriptor.path),
      disposition:
        reasons.length === 0
          ? "SELECTED"
          : reasons.length === 1 && reasons[0] === "FILE_TOO_LARGE"
            ? "SKIPPED"
            : "QUARANTINED",
      reasonCodes: [...new Set(reasons)].sort(),
    };
  });
  return { entries, totalListedBytes: total, warningCodes: [...new Set(warnings)].sort() };
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sourceObjectKey(sha256: string): string {
  if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new Error("INVALID_SHA256");
  return `source-files/sha256/${sha256.slice(0, 2)}/${sha256}`;
}

export async function storeContent(
  storage: ObjectStorage,
  content: SourceEntryContent,
  inspection: InspectedContent,
): Promise<string | null> {
  if (inspection.disposition !== "ACQUIRED" || inspection.sha256 === null) return null;
  const key = sourceObjectKey(inspection.sha256);
  await storage.putIfAbsent({
    key,
    bytes: content.bytes,
    contentType: inspection.mediaType ?? "application/octet-stream",
    sha256: inspection.sha256,
  });
  return key;
}

export interface AcquisitionRequest {
  readonly job: AcquisitionJob;
  readonly requestId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly requestedReference: string;
  readonly sourceReferenceId: string;
  readonly sourceSnapshotId: string;
  readonly acquiredAt: Timestamp;
  readonly maxAttempts: number;
}

export interface AcquisitionDependencies {
  readonly provider: SourceProvider;
  readonly storage: ObjectStorage;
  readonly jobs: AcquisitionJobStore;
  readonly policy?: AcquisitionPolicyVersion;
  readonly telemetry?: AcquisitionTelemetrySink;
}

export interface AcquisitionTelemetryEvent {
  readonly requestId: string;
  readonly correlationId: string;
  readonly jobId: string;
  readonly submissionId: string;
  readonly stage: AcquisitionJob["stage"];
  readonly event: string;
  readonly sourceSnapshotId: string | null;
  readonly providerRepositoryId: string | null;
  readonly immutableRevision: string | null;
  readonly selectedFileCount?: number;
  readonly skippedFileCount?: number;
  readonly quarantinedFileCount?: number;
  readonly totalSelectedBytes?: number;
  readonly failureCode?: string;
}

export interface AcquisitionTelemetrySink {
  record(event: AcquisitionTelemetryEvent): void;
}

export interface AcquisitionRunOutcome {
  readonly job: AcquisitionJob;
  readonly result: AcquisitionResult | null;
}

function move(job: AcquisitionJob, stage: AcquisitionJob["stage"]): AcquisitionJob {
  return {
    ...job,
    stage,
    completedStages:
      job.stage === stage ? job.completedStages : [...new Set([...job.completedStages, job.stage])],
  };
}

function failureFor(error: unknown): AcquisitionFailure {
  const candidate = error instanceof Error ? error.message : "INTERNAL_ACQUISITION_ERROR";
  const allowed = new Set([
    "INVALID_SOURCE_REFERENCE",
    "UNSUPPORTED_SOURCE_REFERENCE",
    "SOURCE_NOT_FOUND",
    "SOURCE_PRIVATE",
    "AMBIGUOUS_REDIRECT",
    "INVALID_REPOSITORY_ID",
    "INVALID_IMMUTABLE_REVISION",
    "SOURCE_TREE_TRUNCATED",
    "ENTRY_SIZE_MISMATCH",
    "INVALID_ENTRY_SIZE",
    "PROVIDER_TIMEOUT",
    "PROVIDER_RATE_LIMIT",
    "OBJECT_STORAGE_UNAVAILABLE",
  ]);
  const code = allowed.has(candidate) ? candidate : "INTERNAL_ACQUISITION_ERROR";
  return {
    code,
    retryable: ["PROVIDER_TIMEOUT", "PROVIDER_RATE_LIMIT", "OBJECT_STORAGE_UNAVAILABLE"].includes(
      code,
    ),
    safeDetail: code,
    path: null,
  };
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "INTERNAL_ACQUISITION_ERROR";
}

async function cancellationOutcome(
  jobs: AcquisitionJobStore,
  jobId: string,
): Promise<AcquisitionRunOutcome | null> {
  const persisted = await jobs.get(jobId);
  if (persisted === undefined) throw new Error("JOB_NOT_FOUND");
  if (persisted.status !== "CANCELLED" && !persisted.cancellationRequested) return null;
  const cancelled: AcquisitionJob =
    persisted.status === "CANCELLED"
      ? persisted
      : { ...persisted, status: "CANCELLED", cancellationRequested: true };
  if (persisted.status !== "CANCELLED") await jobs.save(cancelled);
  return { job: cancelled, result: (await jobs.getResult(jobId)) ?? null };
}

export async function runAcquisition(
  request: AcquisitionRequest,
  dependencies: AcquisitionDependencies,
): Promise<AcquisitionRunOutcome> {
  const policy = dependencies.policy ?? defaultAcquisitionPolicy;
  let job = await dependencies.jobs.createOrGet(request.job, request.idempotencyKey);
  const emit = (
    event: Omit<
      AcquisitionTelemetryEvent,
      "requestId" | "correlationId" | "jobId" | "submissionId"
    >,
  ): void => {
    try {
      dependencies.telemetry?.record({
        requestId: request.requestId,
        correlationId: request.correlationId,
        jobId: job.id,
        submissionId: job.submissionId,
        ...event,
      });
    } catch {
      // Telemetry is non-authoritative and cannot change acquisition state.
    }
  };
  const priorResult = await dependencies.jobs.getResult(job.id);
  if (job.status === "COMPLETED" && priorResult !== undefined) return { job, result: priorResult };
  const initialCancellation = await cancellationOutcome(dependencies.jobs, job.id);
  if (initialCancellation !== null) return initialCancellation;
  if (job.status !== "ACTIVE" || job.stage !== "RECEIVED") return { job, result: null };

  try {
    job = move(job, "VALIDATING_SOURCE");
    await dependencies.jobs.save(job);
    emit({
      stage: job.stage,
      event: "acquisition.stage.entered",
      sourceSnapshotId: null,
      providerRepositoryId: null,
      immutableRevision: null,
    });
    const validated = await dependencies.provider.validateReference(request.requestedReference);
    const validationCancellation = await cancellationOutcome(dependencies.jobs, job.id);
    if (validationCancellation !== null) return validationCancellation;
    const sourceReference: SourceReference = {
      id: request.sourceReferenceId,
      provider: validated.provider,
      canonicalUrl: validated.canonicalUrl,
      owner: validated.owner,
      repository: validated.repository,
    };

    job = move(job, "ACQUIRING_SOURCE");
    await dependencies.jobs.save(job);
    emit({
      stage: job.stage,
      event: "acquisition.stage.entered",
      sourceSnapshotId: null,
      providerRepositoryId: null,
      immutableRevision: null,
    });
    const resolved = await dependencies.provider.resolveSnapshot(validated);
    const resolutionCancellation = await cancellationOutcome(dependencies.jobs, job.id);
    if (resolutionCancellation !== null) return resolutionCancellation;
    const identityKey = [
      resolved.provider,
      resolved.providerRepositoryId,
      resolved.immutableRevision,
      policy.id,
    ].join(":");
    const sourceSnapshot: SourceSnapshot = await dependencies.jobs.bindSnapshot(identityKey, {
      id: request.sourceSnapshotId,
      provider: sourceReference.provider,
      providerRepositoryId: resolved.providerRepositoryId,
      immutableRevision: resolved.immutableRevision,
      acquisitionPolicyVersion: policy.id,
      acquiredAt: request.acquiredAt,
    });
    job = { ...job, sourceSnapshotId: sourceSnapshot.id };
    await dependencies.jobs.save(job);
    emit({
      stage: job.stage,
      event: "acquisition.snapshot.resolved",
      sourceSnapshotId: sourceSnapshot.id,
      providerRepositoryId: sourceSnapshot.providerRepositoryId,
      immutableRevision: sourceSnapshot.immutableRevision,
    });
    const [repositoryMetadata, releaseSignals, licenseSignals, forkSignals, descriptors] =
      await Promise.all([
        dependencies.provider.getRepositoryMetadata(resolved),
        dependencies.provider.getReleaseSignals(resolved),
        dependencies.provider.getLicenseSignals(resolved),
        dependencies.provider.getForkSignals(resolved),
        dependencies.provider.listEntries(resolved),
      ]);
    const signalCancellation = await cancellationOutcome(dependencies.jobs, job.id);
    if (signalCancellation !== null) return signalCancellation;

    job = { ...move(job, "INVENTORYING_SOURCE"), sourceSnapshotId: sourceSnapshot.id };
    await dependencies.jobs.save(job);
    emit({
      stage: job.stage,
      event: "acquisition.stage.entered",
      sourceSnapshotId: sourceSnapshot.id,
      providerRepositoryId: sourceSnapshot.providerRepositoryId,
      immutableRevision: sourceSnapshot.immutableRevision,
    });
    const inventory = inventoryDescriptors(sourceSnapshot.id, descriptors, policy);
    const entries: SourceEntry[] = [];
    const documents: SourceDocument[] = [];
    const warningCodes = [...inventory.warningCodes];
    const partialResult: AcquisitionResult = {
      jobId: job.id,
      sourceReference,
      sourceSnapshot,
      repositoryMetadata,
      releaseSignals,
      licenseSignals,
      forkSignals,
      entries: inventory.entries,
      documents: [],
    };
    await dependencies.jobs.saveResult(partialResult);
    for (const entry of inventory.entries) {
      if (entry.disposition !== "SELECTED") {
        entries.push(entry);
        continue;
      }
      const preFetchCancellation = await cancellationOutcome(dependencies.jobs, job.id);
      if (preFetchCancellation !== null) return preFetchCancellation;
      const descriptor = descriptors.find(({ path }) => path === entry.originalPath);
      if (descriptor === undefined) throw new Error("INVENTORY_DESCRIPTOR_MISSING");
      const content = await dependencies.provider.fetchEntry(resolved, descriptor);
      const postFetchCancellation = await cancellationOutcome(dependencies.jobs, job.id);
      if (postFetchCancellation !== null) return postFetchCancellation;
      const inspection = inspectContent(entry.originalPath, content.bytes, policy);
      const objectKey = await storeContent(dependencies.storage, content, inspection);
      const postStorageCancellation = await cancellationOutcome(dependencies.jobs, job.id);
      if (postStorageCancellation !== null) return postStorageCancellation;
      warningCodes.push(...inspection.reasonCodes);
      const acquiredEntry: SourceEntry = {
        ...entry,
        mediaType: inspection.mediaType,
        sha256: inspection.sha256,
        objectKey,
        disposition: inspection.disposition,
        reasonCodes: inspection.reasonCodes,
      };
      entries.push(acquiredEntry);
      if (inspection.disposition === "ACQUIRED" && inspection.sha256 !== null) {
        documents.push({
          id: `document_${entry.id}`,
          sourceEntryId: entry.id,
          encoding: "utf-8",
          lineCount: inspection.lineCount,
          contentHash: inspection.sha256,
        });
      }
    }
    const result: AcquisitionResult = {
      jobId: job.id,
      sourceReference,
      sourceSnapshot,
      repositoryMetadata,
      releaseSignals,
      licenseSignals,
      forkSignals,
      entries,
      documents,
    };
    await dependencies.jobs.saveResult(result);
    const completionCancellation = await cancellationOutcome(dependencies.jobs, job.id);
    if (completionCancellation !== null) return completionCancellation;
    job = {
      ...job,
      status: "COMPLETED",
      completedStages: [...job.completedStages, "INVENTORYING_SOURCE"],
      warnings: [...new Set(warningCodes)].sort().map((code) => ({
        code,
        path: null,
        message: code,
      })),
    };
    await dependencies.jobs.save(job);
    emit({
      stage: job.stage,
      event: "acquisition.completed",
      sourceSnapshotId: sourceSnapshot.id,
      providerRepositoryId: sourceSnapshot.providerRepositoryId,
      immutableRevision: sourceSnapshot.immutableRevision,
      selectedFileCount: entries.filter(({ disposition }) => disposition === "ACQUIRED").length,
      skippedFileCount: entries.filter(({ disposition }) => disposition === "SKIPPED").length,
      quarantinedFileCount: entries.filter(({ disposition }) => disposition === "QUARANTINED")
        .length,
      totalSelectedBytes: entries
        .filter(({ disposition }) => disposition === "ACQUIRED")
        .reduce((totalBytes, entry) => totalBytes + entry.byteLength, 0),
    });
    return { job, result };
  } catch (error) {
    const cancelled = await cancellationOutcome(dependencies.jobs, job.id);
    if (cancelled !== null) return cancelled;
    const failure = failureFor(error);
    job = {
      ...job,
      status:
        failure.retryable && job.attempt >= request.maxAttempts
          ? "OPERATOR_REVIEW_REQUIRED"
          : "FAILED",
      failure,
    };
    try {
      await dependencies.jobs.save(job);
    } catch (saveError) {
      if (errorCode(saveError) !== "JOB_CANCELLED") throw saveError;
      const concurrentlyCancelled = await cancellationOutcome(dependencies.jobs, job.id);
      if (concurrentlyCancelled === null) throw saveError;
      return concurrentlyCancelled;
    }
    emit({
      stage: job.stage,
      event: "acquisition.failed",
      sourceSnapshotId: job.sourceSnapshotId,
      providerRepositoryId: null,
      immutableRevision: null,
      failureCode: failure.code,
    });
    return { job, result: null };
  }
}
