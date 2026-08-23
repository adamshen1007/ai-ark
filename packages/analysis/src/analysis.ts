import { createHash } from "node:crypto";

import {
  buildBoundedInputFingerprint,
  type BoundedClassificationInputV1,
} from "@ai-ark/classification";

export const CLASSIFICATION_ANALYSIS_LIMITS_V1 = Object.freeze({
  fileTreeEntries: 10_000,
  candidateRoots: 64,
  evidenceReferencesTotal: 512,
  evidenceReferencesPerCandidate: 32,
  excerptsTotal: 128,
  excerptsPerCandidate: 8,
  bytesPerExcerpt: 4_096,
  scalarsPerExcerpt: 4_096,
  totalRequestBytes: 1_048_576,
  estimatedInputTokens: 200_000,
  responseBytes: 262_144,
  warningCodes: 128,
  ambiguityReasonCodes: 64,
  repairAttempts: 1,
  providerAttempts: 2,
  attemptTimeoutMs: 30_000,
  totalTimeoutMs: 60_000,
});

export const CLASSIFICATION_ANALYSIS_POLICY_V1 = CLASSIFICATION_ANALYSIS_LIMITS_V1;
const ANALYSIS_LIMIT_KEYS = Object.keys(
  CLASSIFICATION_ANALYSIS_LIMITS_V1,
) as (keyof typeof CLASSIFICATION_ANALYSIS_LIMITS_V1)[];

export type AnalysisPolicyUsage = Readonly<
  Record<keyof typeof CLASSIFICATION_ANALYSIS_LIMITS_V1, number>
>;

export function validateAnalysisPolicyUsage(usage: AnalysisPolicyUsage): ValidationResult {
  if (
    JSON.stringify(Object.keys(usage).sort()) !== JSON.stringify([...ANALYSIS_LIMIT_KEYS].sort())
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "POLICY_USAGE_INVALID" };
  }
  for (const key of ANALYSIS_LIMIT_KEYS) {
    const ceiling = CLASSIFICATION_ANALYSIS_LIMITS_V1[key];
    const value = usage[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > ceiling) {
      return { ok: false, status: "LIMIT_EXCEEDED", reason: `${key}_LIMIT_EXCEEDED` };
    }
  }
  return { ok: true };
}

type Classification =
  | "SINGLE_SKILL"
  | "MULTIPLE_SKILLS"
  | "SKILL_COLLECTION"
  | "SKILL_PLUS_APPLICATION"
  | "NON_SKILL"
  | "AMBIGUOUS"
  | "UNSUPPORTED";

const classifications = new Set<Classification>([
  "SINGLE_SKILL",
  "MULTIPLE_SKILLS",
  "SKILL_COLLECTION",
  "SKILL_PLUS_APPLICATION",
  "NON_SKILL",
  "AMBIGUOUS",
  "UNSUPPORTED",
]);
const responseKeys = [
  "ambiguityCodes",
  "classification",
  "confidence",
  "evidenceIds",
  "roots",
  "warnings",
];
const requestKeys = [
  "analysisPolicyVersion",
  "boundedInput",
  "boundedInputFingerprint",
  "classificationPolicyVersion",
  "deterministicResult",
  "identityPolicyVersion",
  "operation",
  "promptBundleVersion",
  "sourceSnapshotId",
  "untrustedSourceMarker",
];

export interface AnalysisRequest {
  readonly operation: "CLASSIFY_REPOSITORY";
  readonly sourceSnapshotId: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly analysisPolicyVersion: string;
  readonly promptBundleVersion: string;
  readonly untrustedSourceMarker: true;
  readonly boundedInputFingerprint: string;
  readonly boundedInput: BoundedClassificationInputV1;
  readonly deterministicResult: {
    readonly classification: Classification;
    readonly roots: readonly string[];
    readonly candidateRootFingerprints: readonly string[];
    readonly candidateUsage: readonly {
      readonly root: string;
      readonly evidenceIds: readonly string[];
      readonly excerptEvidenceIds: readonly string[];
    }[];
  };
}

export interface AnalysisResponse {
  readonly classification: Classification;
  readonly roots: readonly string[];
  readonly confidence: number | null;
  readonly evidenceIds: readonly string[];
  readonly warnings: readonly string[];
  readonly ambiguityCodes: readonly string[];
}

export interface TrustedAnalysisContext {
  readonly sourceSnapshotId: string;
  readonly candidateRoots: readonly {
    readonly candidateRootFingerprint: string;
    readonly normalizedRoot: string;
  }[];
  readonly evidenceReferences: BoundedClassificationInputV1["evidenceReferences"];
}

type ValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly status: "LIMIT_EXCEEDED" | "INVALID_OUTPUT";
      readonly reason: string;
    };

const encoder = new TextEncoder();

function serializedBytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function byteSorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function byteOrdered(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || Buffer.from(values[index - 1] ?? "").compare(Buffer.from(value)) < 0,
  );
}

function evidenceRoots(
  normalizedPath: string,
  roots: readonly string[],
): { readonly matchedRoots: readonly string[]; readonly outsideAllRoots: boolean } {
  const matching = roots.filter(
    (root) => root === "." || normalizedPath === root || normalizedPath.startsWith(`${root}/`),
  );
  if (matching.length === 0) return { matchedRoots: [], outsideAllRoots: true };
  const maximumDepth = Math.max(
    ...matching.map((root) => (root === "." ? 0 : root.split("/").length)),
  );
  return {
    matchedRoots: matching.filter(
      (root) => (root === "." ? 0 : root.split("/").length) === maximumDepth,
    ),
    outsideAllRoots: false,
  };
}

const deterministicResultKeys = [
  "candidateRootFingerprints",
  "candidateUsage",
  "classification",
  "roots",
];
const candidateUsageKeys = ["evidenceIds", "excerptEvidenceIds", "root"];

function validateAnalysisRequestUnsafe(
  request: AnalysisRequest,
  context: TrustedAnalysisContext,
): ValidationResult {
  const runtimeRequest = request as unknown as Readonly<Record<string, unknown>>;
  const operation: string = request.operation;
  if (
    JSON.stringify(Object.keys(request).sort()) !== JSON.stringify(requestKeys) ||
    operation !== "CLASSIFY_REPOSITORY" ||
    runtimeRequest.untrustedSourceMarker !== true ||
    !request.sourceSnapshotId ||
    !request.classificationPolicyVersion ||
    !request.identityPolicyVersion ||
    !request.analysisPolicyVersion ||
    !request.promptBundleVersion
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "INVALID_ANALYSIS_ENVELOPE" };
  }
  const bounded = request.boundedInput;
  if (request.sourceSnapshotId !== bounded.snapshot.sourceSnapshotId) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "SOURCE_SNAPSHOT_MISMATCH" };
  }
  for (const key of ANALYSIS_LIMIT_KEYS) {
    if (bounded.limits[key] !== CLASSIFICATION_ANALYSIS_LIMITS_V1[key]) {
      return { ok: false, status: "INVALID_OUTPUT", reason: "POLICY_LIMITS_MISMATCH" };
    }
  }
  if (
    bounded.policy.classificationPolicyVersion !== request.classificationPolicyVersion ||
    bounded.policy.identityPolicyVersion !== request.identityPolicyVersion ||
    bounded.policy.analysisPolicyVersion !== request.analysisPolicyVersion ||
    bounded.policy.promptBundleVersion !== request.promptBundleVersion
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "POLICY_VERSION_MISMATCH" };
  }
  let boundedFingerprint: string;
  let canonicalEvidenceReferences: BoundedClassificationInputV1["evidenceReferences"];
  try {
    const fingerprinted = buildBoundedInputFingerprint(bounded);
    boundedFingerprint = fingerprinted.fingerprint;
    canonicalEvidenceReferences = fingerprinted.payload.evidenceReferences;
  } catch {
    return { ok: false, status: "INVALID_OUTPUT", reason: "BOUNDED_INPUT_INVALID" };
  }
  if (boundedFingerprint !== request.boundedInputFingerprint) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "BOUNDED_INPUT_FINGERPRINT_MISMATCH" };
  }
  if (
    JSON.stringify(Object.keys(request.deterministicResult).sort()) !==
      JSON.stringify(deterministicResultKeys) ||
    request.deterministicResult.classification !== bounded.deterministicAnalyzer.classification ||
    JSON.stringify(request.deterministicResult.candidateRootFingerprints) !==
      JSON.stringify(bounded.deterministicAnalyzer.candidateRootFingerprints) ||
    request.deterministicResult.roots.length !==
      request.deterministicResult.candidateRootFingerprints.length
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "DETERMINISTIC_RESULT_MISMATCH" };
  }
  if (
    context.sourceSnapshotId !== request.sourceSnapshotId ||
    context.candidateRoots.length !== request.deterministicResult.roots.length ||
    context.candidateRoots.some(
      (binding, index) =>
        binding.normalizedRoot !== request.deterministicResult.roots[index] ||
        binding.candidateRootFingerprint !==
          request.deterministicResult.candidateRootFingerprints[index],
    )
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "TRUSTED_ROOT_BINDING_MISMATCH" };
  }
  if (
    context.evidenceReferences.length !== canonicalEvidenceReferences.length ||
    context.evidenceReferences.some(
      (trusted, index) =>
        JSON.stringify(trusted) !== JSON.stringify(canonicalEvidenceReferences[index]),
    )
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "TRUSTED_EVIDENCE_BINDING_MISMATCH" };
  }
  if (canonicalEvidenceReferences.some(({ availability }) => availability !== "AVAILABLE")) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "EVIDENCE_UNAVAILABLE" };
  }
  const allowedEvidenceIds = new Set(bounded.deterministicAnalyzer.inputEvidenceReferenceIds);
  const allowedExcerptIds = new Set(bounded.excerpts.map((excerpt) => excerpt.evidenceReferenceId));
  const evidencePaths = new Map(
    canonicalEvidenceReferences.map((evidence) => [evidence.evidenceReferenceId, evidence]),
  );
  const candidateUsage = request.deterministicResult.candidateUsage;
  const declaredEvidenceIds = new Set(candidateUsage.flatMap((usage) => usage.evidenceIds));
  const declaredExcerptIds = new Set(candidateUsage.flatMap((usage) => usage.excerptEvidenceIds));
  if (
    candidateUsage.length !== request.deterministicResult.roots.length ||
    candidateUsage.some(
      (usage, index) =>
        JSON.stringify(Object.keys(usage).sort()) !== JSON.stringify(candidateUsageKeys) ||
        usage.root !== request.deterministicResult.roots[index] ||
        hasDuplicates(usage.evidenceIds) ||
        hasDuplicates(usage.excerptEvidenceIds) ||
        !byteOrdered(usage.evidenceIds) ||
        !byteOrdered(usage.excerptEvidenceIds) ||
        usage.evidenceIds.some((id) => !allowedEvidenceIds.has(id)) ||
        usage.excerptEvidenceIds.some((id) => !allowedExcerptIds.has(id)) ||
        JSON.stringify(usage.evidenceIds) !==
          JSON.stringify(
            byteSorted(
              [...allowedEvidenceIds].filter((id) =>
                (() => {
                  const evidence = evidencePaths.get(id);
                  if (evidence === undefined) return false;
                  const matching = evidenceRoots(
                    evidence.normalizedPath,
                    request.deterministicResult.roots,
                  );
                  return evidence.usage === "ROOT_SCOPED"
                    ? matching.matchedRoots.includes(usage.root)
                    : matching.outsideAllRoots &&
                        request.deterministicResult.roots.includes(usage.root);
                })(),
              ),
            ),
          ) ||
        JSON.stringify(usage.excerptEvidenceIds) !==
          JSON.stringify(
            byteSorted(
              [...allowedExcerptIds].filter((id) =>
                (() => {
                  const evidence = evidencePaths.get(id);
                  if (evidence === undefined) return false;
                  const matching = evidenceRoots(
                    evidence.normalizedPath,
                    request.deterministicResult.roots,
                  );
                  return evidence.usage === "ROOT_SCOPED"
                    ? matching.matchedRoots.includes(usage.root)
                    : matching.outsideAllRoots &&
                        request.deterministicResult.roots.includes(usage.root);
                })(),
              ),
            ),
          ),
    ) ||
    (candidateUsage.length > 0 &&
      (declaredEvidenceIds.size !== allowedEvidenceIds.size ||
        [...allowedEvidenceIds].some((id) => !declaredEvidenceIds.has(id)) ||
        declaredExcerptIds.size !== allowedExcerptIds.size ||
        [...allowedExcerptIds].some((id) => !declaredExcerptIds.has(id))))
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "CANDIDATE_USAGE_INVALID" };
  }
  const maximumCandidateEvidence = candidateUsage.reduce(
    (maximum, usage) => Math.max(maximum, usage.evidenceIds.length),
    0,
  );
  const maximumCandidateExcerpts = candidateUsage.reduce(
    (maximum, usage) => Math.max(maximum, usage.excerptEvidenceIds.length),
    0,
  );
  let maximumExcerptBytes = 0;
  let maximumExcerptScalars = 0;
  for (const excerpt of bounded.excerpts) {
    const text = typeof excerpt.excerptUtf8 === "string" ? excerpt.excerptUtf8 : "";
    maximumExcerptBytes = Math.max(maximumExcerptBytes, encoder.encode(text).byteLength);
    maximumExcerptScalars = Math.max(maximumExcerptScalars, Array.from(text).length);
  }
  const bytes = serializedBytes(request);
  return validateAnalysisPolicyUsage({
    fileTreeEntries: bounded.files.length + bounded.exclusions.length,
    candidateRoots: request.deterministicResult.roots.length,
    evidenceReferencesTotal: bounded.deterministicAnalyzer.inputEvidenceReferenceIds.length,
    evidenceReferencesPerCandidate: maximumCandidateEvidence,
    excerptsTotal: bounded.excerpts.length,
    excerptsPerCandidate: maximumCandidateExcerpts,
    bytesPerExcerpt: maximumExcerptBytes,
    scalarsPerExcerpt: maximumExcerptScalars,
    totalRequestBytes: bytes,
    estimatedInputTokens: Math.ceil(bytes / 4),
    responseBytes: 0,
    warningCodes: bounded.deterministicAnalyzer.warningCodes.length,
    ambiguityReasonCodes: bounded.deterministicAnalyzer.ambiguityReasonCodes.length,
    repairAttempts: 0,
    providerAttempts: 0,
    attemptTimeoutMs: 0,
    totalTimeoutMs: 0,
  });
}

export function validateAnalysisRequest(
  request: AnalysisRequest,
  context: TrustedAnalysisContext,
): ValidationResult {
  try {
    return validateAnalysisRequestUnsafe(request, context);
  } catch {
    return { ok: false, status: "INVALID_OUTPUT", reason: "INVALID_ANALYSIS_ENVELOPE" };
  }
}

function validateResponseUnsafe(
  request: AnalysisRequest,
  response: AnalysisResponse,
): ValidationResult {
  if (
    JSON.stringify(Object.keys(response).sort()) !== JSON.stringify(responseKeys) ||
    !classifications.has(response.classification)
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "SCHEMA_INVALID" };
  }
  if (serializedBytes(response) > CLASSIFICATION_ANALYSIS_LIMITS_V1.responseBytes) {
    return { ok: false, status: "LIMIT_EXCEEDED", reason: "RESPONSE_LIMIT_EXCEEDED" };
  }
  if (
    response.roots.length > CLASSIFICATION_ANALYSIS_LIMITS_V1.candidateRoots ||
    response.warnings.length > CLASSIFICATION_ANALYSIS_LIMITS_V1.warningCodes ||
    response.ambiguityCodes.length > CLASSIFICATION_ANALYSIS_LIMITS_V1.ambiguityReasonCodes ||
    hasDuplicates(response.roots) ||
    hasDuplicates(response.evidenceIds) ||
    hasDuplicates(response.warnings) ||
    hasDuplicates(response.ambiguityCodes) ||
    !byteOrdered(response.roots) ||
    !byteOrdered(response.evidenceIds) ||
    !byteOrdered(response.warnings) ||
    !byteOrdered(response.ambiguityCodes)
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "INVALID_ORDER_OR_DUPLICATE" };
  }
  const allowedEvidence = new Set(
    request.boundedInput.deterministicAnalyzer.inputEvidenceReferenceIds,
  );
  const allowedRoots = new Set(request.deterministicResult.roots);
  const allowedWarnings = new Set(request.boundedInput.deterministicAnalyzer.warningCodes);
  const allowedAmbiguityCodes = new Set(
    request.boundedInput.deterministicAnalyzer.ambiguityReasonCodes,
  );
  if (
    response.evidenceIds.some((id) => !allowedEvidence.has(id)) ||
    response.roots.some((root) => !allowedRoots.has(root)) ||
    response.warnings.some((code) => !allowedWarnings.has(code)) ||
    response.ambiguityCodes.some((code) => !allowedAmbiguityCodes.has(code)) ||
    (response.confidence !== null &&
      (!Number.isFinite(response.confidence) || response.confidence < 0 || response.confidence > 1))
  ) {
    return { ok: false, status: "INVALID_OUTPUT", reason: "INVENTED_OR_OUT_OF_ENVELOPE" };
  }
  return { ok: true };
}

function validateResponse(request: AnalysisRequest, response: AnalysisResponse): ValidationResult {
  try {
    return validateResponseUnsafe(request, response);
  } catch {
    return { ok: false, status: "INVALID_OUTPUT", reason: "SCHEMA_INVALID" };
  }
}

function digest(value: unknown): string {
  // AnalysisRun request/response fingerprints bind the exact provider wire bytes. They are not
  // candidate/content/identity canonical fingerprints, and responses may contain decimal confidence.
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export class DeterministicClassificationAnalysisAdapter {
  private readonly responses: AnalysisResponse[];
  private readonly attemptDurationsMs: number[];

  public constructor(
    responses: readonly AnalysisResponse[],
    private readonly isCancelled: () => boolean = () => false,
    private readonly afterProviderAttempt: () => void = () => undefined,
    attemptDurationsMs: readonly number[] = [],
  ) {
    this.responses = [...responses];
    this.attemptDurationsMs = [...attemptDurationsMs];
  }

  public async classify(request: AnalysisRequest, context: TrustedAnalysisContext) {
    const startedAt = Date.now();
    const requestValidation = validateAnalysisRequest(request, context);
    if (!requestValidation.ok) {
      return this.result(
        request,
        null,
        requestValidation.status,
        requestValidation.reason,
        startedAt,
        true,
      );
    }
    if (this.isCancelled()) return this.cancelledResult(request, startedAt);
    let response: AnalysisResponse | null = null;
    let providerAttemptCount = 0;
    let repairCount = 0;
    let simulatedDurationMs = 0;
    while (providerAttemptCount < CLASSIFICATION_ANALYSIS_LIMITS_V1.providerAttempts) {
      response = this.responses.shift() ?? null;
      if (response === null) {
        return this.result(
          request,
          null,
          "FAILED",
          "FAKE_RESPONSE_UNAVAILABLE",
          startedAt,
          true,
          null,
          providerAttemptCount,
          repairCount,
          simulatedDurationMs,
        );
      }
      providerAttemptCount += 1;
      const attemptDuration = this.attemptDurationsMs.shift() ?? 0;
      simulatedDurationMs += attemptDuration;
      await Promise.resolve();
      this.afterProviderAttempt();
      if (
        attemptDuration > CLASSIFICATION_ANALYSIS_LIMITS_V1.attemptTimeoutMs ||
        simulatedDurationMs > CLASSIFICATION_ANALYSIS_LIMITS_V1.totalTimeoutMs
      ) {
        if (
          providerAttemptCount < CLASSIFICATION_ANALYSIS_LIMITS_V1.providerAttempts &&
          this.responses.length > 0
        )
          continue;
        return this.result(
          request,
          response,
          "TIMED_OUT",
          "ANALYSIS_TIMEOUT",
          startedAt,
          true,
          null,
          providerAttemptCount,
          repairCount,
          simulatedDurationMs,
        );
      }
      const validation = validateResponse(request, response);
      if (!validation.ok) {
        if (
          repairCount < CLASSIFICATION_ANALYSIS_LIMITS_V1.repairAttempts &&
          providerAttemptCount < CLASSIFICATION_ANALYSIS_LIMITS_V1.providerAttempts &&
          this.responses.length > 0
        ) {
          repairCount += 1;
          continue;
        }
        return this.result(
          request,
          response,
          validation.status,
          validation.reason,
          startedAt,
          true,
          null,
          providerAttemptCount,
          repairCount,
          simulatedDurationMs,
        );
      }
      break;
    }
    if (response === null)
      return this.result(request, null, "FAILED", "FAKE_RESPONSE_UNAVAILABLE", startedAt, true);
    if (this.isCancelled())
      return this.result(
        request,
        response,
        "SUCCEEDED",
        null,
        startedAt,
        true,
        null,
        providerAttemptCount,
        repairCount,
        simulatedDurationMs,
      );
    const agreed =
      request.deterministicResult.classification === response.classification &&
      JSON.stringify(request.deterministicResult.roots) === JSON.stringify(response.roots);
    const reconciled = agreed
      ? { classification: response.classification, roots: response.roots }
      : { classification: "AMBIGUOUS" as const, roots: request.deterministicResult.roots };
    return this.result(
      request,
      response,
      "SUCCEEDED",
      null,
      startedAt,
      false,
      reconciled,
      providerAttemptCount,
      repairCount,
      simulatedDurationMs,
    );
  }

  private cancelledResult(request: AnalysisRequest, startedAt: number) {
    return this.result(request, null, "FAILED", "CANCELLED", startedAt, true);
  }

  private result(
    request: AnalysisRequest,
    response: AnalysisResponse | null,
    status: "SUCCEEDED" | "INVALID_OUTPUT" | "LIMIT_EXCEEDED" | "TIMED_OUT" | "FAILED",
    reason: string | null,
    startedAt: number,
    cancelled: boolean,
    reconciled: {
      readonly classification: Classification;
      readonly roots: readonly string[];
    } | null = null,
    providerAttemptCount = response === null ? 0 : 1,
    repairCount = 0,
    simulatedDurationMs = 0,
  ) {
    return {
      run: {
        operation: "CLASSIFY_REPOSITORY" as const,
        source: "AI_ASSISTED" as const,
        providerId: "deterministic-fake",
        adapterId: "deterministic-fake-analysis-v1",
        modelId: "fake-classifier-v1",
        promptBundleVersion: request.promptBundleVersion,
        classificationPolicyVersion: request.classificationPolicyVersion,
        identityPolicyVersion: request.identityPolicyVersion,
        analysisPolicyVersion: request.analysisPolicyVersion,
        temperature: null,
        requestFingerprint: digest(request),
        responseFingerprint: response === null ? null : digest(response),
        status,
        reason,
        validationOutcome: reason ?? "VALID",
        providerAttemptCount,
        repairCount,
        attempt: 1,
        boundedUsage: {
          inputBytes: serializedBytes(request),
          outputBytes: response === null ? 0 : serializedBytes(response),
          estimatedInputTokens: Math.ceil(serializedBytes(request) / 4),
        },
        durationMs: Math.max(simulatedDurationMs, Date.now() - startedAt),
        startedAt: new Date(startedAt).toISOString(),
        completedAt: new Date().toISOString(),
      },
      response,
      reconciled: cancelled ? null : reconciled,
      cancelled,
    };
  }
}
