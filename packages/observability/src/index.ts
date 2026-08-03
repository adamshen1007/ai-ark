export interface AcquisitionTelemetry {
  readonly requestId: string;
  readonly correlationId: string;
  readonly submissionId: string;
  readonly jobId: string;
  readonly snapshotId: string | null;
  readonly providerRepositoryId: string | null;
  readonly immutableRevision: string | null;
  readonly stage: string;
  readonly event: string;
  readonly durationMs?: number;
  readonly entryCount?: number;
  readonly selectedFileCount?: number;
  readonly skippedFileCount?: number;
  readonly quarantinedFileCount?: number;
  readonly byteCount?: number;
  readonly providerRateLimitRemaining?: number;
  readonly warningCode?: string;
  readonly failureCode?: string;
}

const secretKey = /authorization|cookie|credential|password|secret|token/iu;
const sourceKey = /bytes|content|excerpt|raw|sourceText/iu;

export function redactTelemetryFields(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | null>> {
  const safe: Record<string, string | number | null> = {};
  for (const [key, field] of Object.entries(value)) {
    if (secretKey.test(key) || sourceKey.test(key) || field === undefined) continue;
    if (typeof field === "string" || typeof field === "number" || field === null) safe[key] = field;
  }
  return safe;
}

export function safeAcquisitionTelemetry(
  value: AcquisitionTelemetry,
): Readonly<Record<string, string | number | null>> {
  return redactTelemetryFields({ ...value });
}

export const acquisitionMetricNames = [
  "acquisition_jobs_total",
  "acquisition_stage_duration_ms",
  "acquisition_entries_total",
  "acquisition_bytes_total",
  "acquisition_warnings_total",
  "acquisition_failures_total",
] as const;
