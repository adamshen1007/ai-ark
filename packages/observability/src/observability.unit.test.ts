import { describe, expect, it } from "vitest";

import {
  acquisitionMetricNames,
  redactTelemetryFields,
  safeAcquisitionTelemetry,
} from "./index.js";

describe("acquisition observability", () => {
  it("emits identifiers and bounded measurements", () => {
    expect(
      safeAcquisitionTelemetry({
        requestId: "request_1",
        correlationId: "correlation_1",
        submissionId: "submission_1",
        jobId: "job_1",
        snapshotId: null,
        providerRepositoryId: null,
        immutableRevision: null,
        stage: "ACQUIRING_SOURCE",
        event: "acquisition.started",
        entryCount: 2,
      }),
    ).toMatchObject({ requestId: "request_1", jobId: "job_1", entryCount: 2 });
    expect(acquisitionMetricNames).toContain("acquisition_failures_total");
    expect(
      redactTelemetryFields({ event: "safe", githubToken: "secret", sourceText: "untrusted" }),
    ).toEqual({ event: "safe" });
  });
});
