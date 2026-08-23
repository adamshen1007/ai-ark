import { createHash, timingSafeEqual } from "node:crypto";

import type { EntryDisposition, RepositoryClassification } from "@ai-ark/contracts";

export type CanonicalM02Value =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalM02Value[]
  | { readonly [key: string]: CanonicalM02Value };

const encoder = new TextEncoder();

function assertUnicodeScalarString(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("canonical strings must contain only Unicode scalar values");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError("canonical strings must contain only Unicode scalar values");
    }
  }
}

function normalizeCanonicalString(value: string): string {
  assertUnicodeScalarString(value);
  return value.normalize("NFC");
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0) ?? 0);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0) ?? 0);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftPoints[index] ?? 0) - (rightPoints[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function serialize(value: CanonicalM02Value): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value.normalize("NFC"));
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new TypeError("canonical numbers must be safe integers");
    return Object.is(value, -0) ? "0" : value.toString(10);
  }
  if (Array.isArray(value)) {
    const entries = value as readonly CanonicalM02Value[];
    return `[${entries.map((entry) => serialize(entry)).join(",")}]`;
  }

  const normalized = new Map<string, CanonicalM02Value>();
  for (const [key, entry] of Object.entries(value)) {
    assertUnicodeScalarString(key);
    const normalizedKey = key.normalize("NFC");
    if (normalized.has(normalizedKey)) {
      throw new TypeError("object keys collide after NFC normalization");
    }
    normalized.set(normalizedKey, entry);
  }
  const entries = [...normalized.entries()].sort(([left], [right]) =>
    compareCodePoints(left, right),
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${serialize(entry)}`)
    .join(",")}}`;
}

export function canonicalM02Json(value: CanonicalM02Value): string {
  return serialize(value);
}

export function canonicalM02JsonBytes(value: CanonicalM02Value): Uint8Array {
  return encoder.encode(canonicalM02Json(value));
}

export function fingerprintM02Payload(value: CanonicalM02Value): string {
  return createHash("sha256").update(canonicalM02JsonBytes(value)).digest("hex");
}

export function sha256Base64Url(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function hasMatchingCanonicalPayload(stored: Uint8Array, attempted: Uint8Array): boolean {
  return stored.byteLength === attempted.byteLength && timingSafeEqual(stored, attempted);
}

const byteCompare = (left: string, right: string) => Buffer.from(left).compare(Buffer.from(right));
const orderedStrings = (values: readonly string[], field = "ordered string") => {
  const normalized = values.map(normalizeCanonicalString);
  if (new Set(normalized).size !== normalized.length)
    throw new TypeError(`${field} values collide after NFC normalization`);
  return normalized.sort(byteCompare);
};
const SHA256 = /^[a-f0-9]{64}$/u;

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) throw new TypeError(`${field} must be non-empty`);
}

function assertSha256(value: string, field = "SHA-256"): void {
  if (!SHA256.test(value)) throw new TypeError(`invalid ${field}`);
}

function assertSafePath(value: string, field: string): void {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  )
    throw new TypeError(`invalid ${field}`);
}

export interface CandidateContentEntry {
  readonly path: string;
  readonly contentSha256: string;
}

function orderedContentEntries(values: readonly CandidateContentEntry[]) {
  const seen = new Set<string>();
  const ordered = values
    .map((entry) => ({
      path: normalizeCanonicalString(entry.path),
      contentSha256: entry.contentSha256,
    }))
    .sort(
      (left, right) =>
        byteCompare(left.path, right.path) || byteCompare(left.contentSha256, right.contentSha256),
    );
  for (const entry of ordered) {
    if (seen.has(entry.path)) throw new TypeError("duplicate candidate content path");
    assertSafePath(entry.path, "candidate content path");
    assertSha256(entry.contentSha256, "content SHA-256");
    seen.add(entry.path);
  }
  return ordered;
}

export function buildCandidateFingerprints(input: {
  readonly normalizedRoot: string;
  readonly owned: readonly CandidateContentEntry[];
  readonly shared: readonly CandidateContentEntry[];
}) {
  const normalizedRoot = normalizeCanonicalString(input.normalizedRoot);
  if (normalizedRoot !== ".") assertSafePath(normalizedRoot, "candidate root");
  const owned = orderedContentEntries(input.owned).map(({ path, contentSha256 }) => ({
    pathRelativeToRoot: path,
    contentSha256,
  }));
  const shared = orderedContentEntries(input.shared).map(({ path, contentSha256 }) => ({
    repositoryPath: path,
    contentSha256,
  }));
  const ownedRepositoryPaths = owned.map(({ pathRelativeToRoot }) =>
    normalizedRoot === "." ? pathRelativeToRoot : `${normalizedRoot}/${pathRelativeToRoot}`,
  );
  const sharedRepositoryPaths = shared.map(({ repositoryPath }) => repositoryPath);
  const ownedPathSet = new Set(ownedRepositoryPaths);
  if (sharedRepositoryPaths.some((path) => ownedPathSet.has(path))) {
    throw new TypeError("candidate paths cannot be both owned and shared");
  }
  const candidateContentPayload = { schemaVersion: "1", owned, shared } as const;
  const candidateRootPayload = {
    schemaVersion: "1",
    normalizedRoot,
    ownedRepositoryPaths: orderedStrings(ownedRepositoryPaths, "owned repository path"),
    sharedRepositoryPaths: orderedStrings(sharedRepositoryPaths, "shared repository path"),
  } as const;
  return {
    candidateContentPayload,
    candidateContentCanonicalBytes: canonicalM02JsonBytes(candidateContentPayload),
    candidateContentFingerprint: fingerprintM02Payload(candidateContentPayload),
    candidateRootPayload,
    candidateRootCanonicalBytes: canonicalM02JsonBytes(candidateRootPayload),
    candidateRootFingerprint: fingerprintM02Payload(candidateRootPayload),
  };
}

export interface ClassificationAnalysisLimitsV1 {
  readonly fileTreeEntries: 10_000;
  readonly candidateRoots: 64;
  readonly evidenceReferencesTotal: 512;
  readonly evidenceReferencesPerCandidate: 32;
  readonly excerptsTotal: 128;
  readonly excerptsPerCandidate: 8;
  readonly bytesPerExcerpt: 4_096;
  readonly scalarsPerExcerpt: 4_096;
  readonly totalRequestBytes: 1_048_576;
  readonly estimatedInputTokens: 200_000;
  readonly responseBytes: 262_144;
  readonly warningCodes: 128;
  readonly ambiguityReasonCodes: 64;
  readonly repairAttempts: 1;
  readonly providerAttempts: 2;
  readonly attemptTimeoutMs: 30_000;
  readonly totalTimeoutMs: 60_000;
}

export const CLASSIFICATION_ANALYSIS_LIMITS_V1: ClassificationAnalysisLimitsV1 = {
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
};

export interface BoundedSnapshotV1 {
  readonly sourceSnapshotId: string;
  readonly provider: "github";
  readonly providerRepositoryId: string;
  readonly immutableRevision: string;
  readonly acquisitionPolicyVersion: string;
}

export interface BoundedFileV1 {
  readonly normalizedPath: string;
  readonly entryKind: "file" | "symlink" | "submodule";
  readonly disposition: EntryDisposition;
  readonly byteLength: number;
  readonly contentSha256: string;
}

export interface BoundedExclusionV1 {
  readonly normalizedPath: string;
  readonly disposition: EntryDisposition;
  readonly reasonCode: string;
  readonly contentSha256OrNull: string | null;
}

export interface BoundedEvidenceReferenceV1 {
  readonly evidenceReferenceId: string;
  readonly normalizedPath: string;
  readonly sourceSnapshotId: string;
  readonly sourceEntryId: string;
  readonly evidenceKind: "SOURCE_ENTRY" | "SOURCE_DOCUMENT";
  readonly contentSha256: string;
  readonly availability: "AVAILABLE" | "UNAVAILABLE" | "UNSAFE";
  readonly usage: "ROOT_SCOPED" | "SHARED_OUTSIDE_ROOT";
}

export interface BoundedExcerptV1 {
  readonly evidenceReferenceId: string;
  readonly normalizedPath: string;
  readonly locator: string;
  readonly utf8ByteLength: number;
  readonly unicodeScalarLength: number;
  readonly excerptSha256: string;
  readonly excerptUtf8: string;
}

export interface BoundedTruncationV1 {
  readonly subjectType: string;
  readonly subjectKey: string;
  readonly originalCountOrBytes: number;
  readonly retainedCountOrBytes: number;
  readonly orderingBoundaryOrNull: string | null;
  readonly reasonCode: string;
}

export interface BoundedPolicyV1 {
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly parserProfileVersion: string;
  readonly analysisPolicyVersion: string;
  readonly promptBundleVersion: string;
}

export interface BoundedClassificationInputV1 {
  readonly schemaVersion: "1";
  readonly snapshot: BoundedSnapshotV1;
  readonly files: readonly BoundedFileV1[];
  readonly exclusions: readonly BoundedExclusionV1[];
  readonly evidenceReferences: readonly BoundedEvidenceReferenceV1[];
  readonly excerpts: readonly BoundedExcerptV1[];
  readonly truncation: readonly BoundedTruncationV1[];
  readonly limits: ClassificationAnalysisLimitsV1;
  readonly policy: BoundedPolicyV1;
  readonly deterministicAnalyzer: {
    readonly inputEvidenceReferenceIds: readonly string[];
    readonly classification: RepositoryClassification;
    readonly candidateRootFingerprints: readonly string[];
    readonly warningCodes: readonly string[];
    readonly ambiguityReasonCodes: readonly string[];
    readonly requiresAiAssistance: boolean;
  };
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : -1;
  return right === null ? 1 : byteCompare(left, right);
}

const LIMIT_KEYS = [
  "fileTreeEntries",
  "candidateRoots",
  "evidenceReferencesTotal",
  "evidenceReferencesPerCandidate",
  "excerptsTotal",
  "excerptsPerCandidate",
  "bytesPerExcerpt",
  "scalarsPerExcerpt",
  "totalRequestBytes",
  "estimatedInputTokens",
  "responseBytes",
  "warningCodes",
  "ambiguityReasonCodes",
  "repairAttempts",
  "providerAttempts",
  "attemptTimeoutMs",
  "totalTimeoutMs",
] as const satisfies readonly (keyof ClassificationAnalysisLimitsV1)[];

function assertExactLimits(limits: ClassificationAnalysisLimitsV1): void {
  if (
    Object.keys(limits).length !== LIMIT_KEYS.length ||
    LIMIT_KEYS.some((key) => limits[key] !== CLASSIFICATION_ANALYSIS_LIMITS_V1[key])
  ) {
    throw new TypeError("bounded input limits must equal ClassificationAnalysisPolicy v1");
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) throw new TypeError(`duplicate ${field}`);
}

function assertExactKeys(value: object, expected: readonly string[], field: string): void {
  const actual = Reflect.ownKeys(value);
  if (
    actual.some((key) => typeof key !== "string") ||
    actual.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(value, key))
  )
    throw new TypeError(`${field} must contain only the approved payload keys`);
}

function assertArray(value: unknown, field: string): void {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
}

const ROOT_KEYS = [
  "schemaVersion",
  "snapshot",
  "files",
  "exclusions",
  "evidenceReferences",
  "excerpts",
  "truncation",
  "limits",
  "policy",
  "deterministicAnalyzer",
] as const satisfies readonly (keyof BoundedClassificationInputV1)[];
const FILE_KEYS = [
  "normalizedPath",
  "entryKind",
  "disposition",
  "byteLength",
  "contentSha256",
] as const satisfies readonly (keyof BoundedFileV1)[];
const EXCLUSION_KEYS = [
  "normalizedPath",
  "disposition",
  "reasonCode",
  "contentSha256OrNull",
] as const satisfies readonly (keyof BoundedExclusionV1)[];
const EVIDENCE_REFERENCE_KEYS = [
  "evidenceReferenceId",
  "normalizedPath",
  "sourceSnapshotId",
  "sourceEntryId",
  "evidenceKind",
  "contentSha256",
  "availability",
  "usage",
] as const satisfies readonly (keyof BoundedEvidenceReferenceV1)[];
const EXCERPT_KEYS = [
  "evidenceReferenceId",
  "normalizedPath",
  "locator",
  "utf8ByteLength",
  "unicodeScalarLength",
  "excerptSha256",
  "excerptUtf8",
] as const satisfies readonly (keyof BoundedExcerptV1)[];
const TRUNCATION_KEYS = [
  "subjectType",
  "subjectKey",
  "originalCountOrBytes",
  "retainedCountOrBytes",
  "orderingBoundaryOrNull",
  "reasonCode",
] as const satisfies readonly (keyof BoundedTruncationV1)[];
const ANALYZER_KEYS = [
  "inputEvidenceReferenceIds",
  "classification",
  "candidateRootFingerprints",
  "warningCodes",
  "ambiguityReasonCodes",
  "requiresAiAssistance",
] as const satisfies readonly (keyof BoundedClassificationInputV1["deterministicAnalyzer"])[];

const SNAPSHOT_KEYS = [
  "sourceSnapshotId",
  "provider",
  "providerRepositoryId",
  "immutableRevision",
  "acquisitionPolicyVersion",
] as const satisfies readonly (keyof BoundedSnapshotV1)[];
const POLICY_KEYS = [
  "classificationPolicyVersion",
  "identityPolicyVersion",
  "parserProfileVersion",
  "analysisPolicyVersion",
  "promptBundleVersion",
] as const satisfies readonly (keyof BoundedPolicyV1)[];

export function buildBoundedInputFingerprint(input: BoundedClassificationInputV1) {
  assertExactKeys(input, ROOT_KEYS, "bounded input");
  assertExactKeys(input.snapshot, SNAPSHOT_KEYS, "bounded snapshot");
  assertExactKeys(input.limits, LIMIT_KEYS, "bounded limits");
  assertExactKeys(input.policy, POLICY_KEYS, "bounded policy");
  assertExactKeys(input.deterministicAnalyzer, ANALYZER_KEYS, "deterministic analyzer");
  assertArray(input.files, "bounded files");
  assertArray(input.exclusions, "bounded exclusions");
  assertArray(input.evidenceReferences, "bounded evidence references");
  assertArray(input.excerpts, "bounded excerpts");
  assertArray(input.truncation, "bounded truncation");
  for (const file of input.files) assertExactKeys(file, FILE_KEYS, "bounded file");
  for (const exclusion of input.exclusions)
    assertExactKeys(exclusion, EXCLUSION_KEYS, "bounded exclusion");
  for (const evidenceReference of input.evidenceReferences)
    assertExactKeys(evidenceReference, EVIDENCE_REFERENCE_KEYS, "bounded evidence reference");
  for (const excerpt of input.excerpts) assertExactKeys(excerpt, EXCERPT_KEYS, "bounded excerpt");
  for (const record of input.truncation)
    assertExactKeys(record, TRUNCATION_KEYS, "bounded truncation");
  assertExactLimits(input.limits);
  for (const key of SNAPSHOT_KEYS) assertNonEmpty(input.snapshot[key], "snapshot field");
  for (const key of POLICY_KEYS) assertNonEmpty(input.policy[key], "policy field");
  if (!/^[a-f0-9]{40}$/u.test(input.snapshot.immutableRevision))
    throw new TypeError("invalid immutable revision");

  const files = input.files
    .map((file) => ({
      normalizedPath: normalizeCanonicalString(file.normalizedPath),
      entryKind: file.entryKind,
      disposition: file.disposition,
      byteLength: file.byteLength,
      contentSha256: file.contentSha256,
    }))
    .sort(
      (left, right) =>
        byteCompare(left.normalizedPath, right.normalizedPath) ||
        byteCompare(left.disposition, right.disposition) ||
        byteCompare(left.contentSha256, right.contentSha256),
    );
  for (const file of files) {
    assertSafePath(file.normalizedPath, "bounded file path");
    assertSha256(file.contentSha256, "bounded file content SHA-256");
    if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 0)
      throw new TypeError("invalid bounded file byte length");
  }
  assertUnique(
    files.map(({ normalizedPath }) => normalizedPath),
    "bounded file path",
  );

  const exclusions = input.exclusions
    .map((exclusion) => ({
      normalizedPath: normalizeCanonicalString(exclusion.normalizedPath),
      disposition: exclusion.disposition,
      reasonCode: normalizeCanonicalString(exclusion.reasonCode),
      contentSha256OrNull: exclusion.contentSha256OrNull,
    }))
    .sort(
      (left, right) =>
        byteCompare(left.normalizedPath, right.normalizedPath) ||
        byteCompare(left.disposition, right.disposition) ||
        byteCompare(left.reasonCode, right.reasonCode) ||
        compareNullable(left.contentSha256OrNull, right.contentSha256OrNull),
    );
  for (const exclusion of exclusions) {
    assertSafePath(exclusion.normalizedPath, "bounded exclusion path");
    assertNonEmpty(exclusion.disposition, "exclusion disposition");
    assertNonEmpty(exclusion.reasonCode, "exclusion reason");
    if (exclusion.contentSha256OrNull !== null)
      assertSha256(exclusion.contentSha256OrNull, "exclusion content SHA-256");
  }
  assertUnique(
    exclusions.map(({ normalizedPath }) => normalizedPath),
    "bounded exclusion path",
  );
  const filePaths = new Set(files.map(({ normalizedPath }) => normalizedPath));
  if (exclusions.some(({ normalizedPath }) => filePaths.has(normalizedPath))) {
    throw new TypeError("bounded files and exclusions must be disjoint");
  }

  const evidenceReferences = input.evidenceReferences
    .map((evidence) => ({
      evidenceReferenceId: normalizeCanonicalString(evidence.evidenceReferenceId),
      normalizedPath: normalizeCanonicalString(evidence.normalizedPath),
      sourceSnapshotId: normalizeCanonicalString(evidence.sourceSnapshotId),
      sourceEntryId: normalizeCanonicalString(evidence.sourceEntryId),
      evidenceKind: evidence.evidenceKind,
      contentSha256: evidence.contentSha256,
      availability: evidence.availability,
      usage: evidence.usage,
    }))
    .sort((left, right) => byteCompare(left.evidenceReferenceId, right.evidenceReferenceId));
  for (const evidence of evidenceReferences) {
    assertNonEmpty(evidence.evidenceReferenceId, "evidence reference");
    assertSafePath(evidence.normalizedPath, "evidence path");
    assertNonEmpty(evidence.sourceSnapshotId, "evidence snapshot");
    assertNonEmpty(evidence.sourceEntryId, "evidence source entry");
    assertSha256(evidence.contentSha256, "evidence content SHA-256");
    if (!["SOURCE_ENTRY", "SOURCE_DOCUMENT"].includes(evidence.evidenceKind))
      throw new TypeError("unsupported evidence kind");
    if (!["AVAILABLE", "UNAVAILABLE", "UNSAFE"].includes(evidence.availability))
      throw new TypeError("unsupported evidence availability");
    if (!["ROOT_SCOPED", "SHARED_OUTSIDE_ROOT"].includes(evidence.usage))
      throw new TypeError("unsupported evidence usage");
    if (evidence.sourceSnapshotId !== input.snapshot.sourceSnapshotId)
      throw new TypeError("evidence reference belongs to a foreign snapshot");
  }
  assertUnique(
    evidenceReferences.map(({ evidenceReferenceId }) => evidenceReferenceId),
    "evidence reference",
  );
  const evidenceById = new Map(
    evidenceReferences.map((evidence) => [evidence.evidenceReferenceId, evidence]),
  );

  const excerpts = input.excerpts
    .map((excerpt) => ({
      evidenceReferenceId: normalizeCanonicalString(excerpt.evidenceReferenceId),
      normalizedPath: normalizeCanonicalString(excerpt.normalizedPath),
      locator: normalizeCanonicalString(excerpt.locator),
      utf8ByteLength: excerpt.utf8ByteLength,
      unicodeScalarLength: excerpt.unicodeScalarLength,
      excerptSha256: excerpt.excerptSha256,
      excerptUtf8: excerpt.excerptUtf8,
    }))
    .sort(
      (left, right) =>
        byteCompare(left.evidenceReferenceId, right.evidenceReferenceId) ||
        byteCompare(left.normalizedPath, right.normalizedPath) ||
        byteCompare(left.locator, right.locator) ||
        byteCompare(left.excerptSha256, right.excerptSha256),
    );
  for (const excerpt of excerpts) {
    assertSafePath(excerpt.normalizedPath, "excerpt path");
    assertNonEmpty(excerpt.evidenceReferenceId, "evidence reference");
    assertNonEmpty(excerpt.locator, "excerpt locator");
    const expectedHash = createHash("sha256").update(excerpt.excerptUtf8, "utf8").digest("hex");
    const evidence = evidenceById.get(excerpt.evidenceReferenceId);
    if (
      evidence?.normalizedPath !== excerpt.normalizedPath ||
      excerpt.excerptSha256 !== expectedHash ||
      excerpt.utf8ByteLength !== encoder.encode(excerpt.excerptUtf8).byteLength ||
      excerpt.unicodeScalarLength !== Array.from(excerpt.excerptUtf8).length
    ) {
      throw new TypeError("bounded excerpt hash or length mismatch");
    }
  }
  assertUnique(
    excerpts.map(({ evidenceReferenceId }) => evidenceReferenceId),
    "evidence reference",
  );
  const truncation = input.truncation
    .map((record) => ({
      subjectType: normalizeCanonicalString(record.subjectType),
      subjectKey: normalizeCanonicalString(record.subjectKey),
      originalCountOrBytes: record.originalCountOrBytes,
      retainedCountOrBytes: record.retainedCountOrBytes,
      orderingBoundaryOrNull:
        record.orderingBoundaryOrNull === null
          ? null
          : normalizeCanonicalString(record.orderingBoundaryOrNull),
      reasonCode: normalizeCanonicalString(record.reasonCode),
    }))
    .sort(
      (left, right) =>
        byteCompare(left.subjectType, right.subjectType) ||
        byteCompare(left.subjectKey, right.subjectKey) ||
        byteCompare(left.reasonCode, right.reasonCode),
    );
  for (const record of truncation) {
    assertNonEmpty(record.subjectType, "truncation subject type");
    assertNonEmpty(record.subjectKey, "truncation subject key");
    assertNonEmpty(record.reasonCode, "truncation reason");
    if (
      !Number.isSafeInteger(record.originalCountOrBytes) ||
      !Number.isSafeInteger(record.retainedCountOrBytes) ||
      record.originalCountOrBytes < 0 ||
      record.retainedCountOrBytes < 0 ||
      record.retainedCountOrBytes > record.originalCountOrBytes
    )
      throw new TypeError("invalid truncation counts");
  }
  assertUnique(
    truncation.map(({ subjectType, subjectKey, reasonCode }) =>
      canonicalM02Json([subjectType, subjectKey, reasonCode]),
    ),
    "truncation record",
  );
  const inputEvidenceReferenceIds = orderedStrings(
    input.deterministicAnalyzer.inputEvidenceReferenceIds,
    "analyzer evidence reference",
  );
  const candidateRootFingerprints = orderedStrings(
    input.deterministicAnalyzer.candidateRootFingerprints,
    "candidate root fingerprint",
  );
  const warningCodes = orderedStrings(
    input.deterministicAnalyzer.warningCodes,
    "analyzer warning code",
  );
  const ambiguityReasonCodes = orderedStrings(
    input.deterministicAnalyzer.ambiguityReasonCodes,
    "analyzer ambiguity reason",
  );
  if (
    canonicalM02Json(inputEvidenceReferenceIds) !==
    canonicalM02Json(evidenceReferences.map(({ evidenceReferenceId }) => evidenceReferenceId))
  )
    throw new TypeError("analyzer evidence references must equal the bounded evidence set");
  for (const fingerprint of candidateRootFingerprints)
    assertSha256(fingerprint, "candidate root SHA-256");
  const payload = {
    schemaVersion: input.schemaVersion,
    snapshot: {
      sourceSnapshotId: normalizeCanonicalString(input.snapshot.sourceSnapshotId),
      provider: input.snapshot.provider,
      providerRepositoryId: normalizeCanonicalString(input.snapshot.providerRepositoryId),
      immutableRevision: input.snapshot.immutableRevision,
      acquisitionPolicyVersion: normalizeCanonicalString(input.snapshot.acquisitionPolicyVersion),
    },
    files: files.map((file) => ({ ...file })),
    exclusions: exclusions.map((exclusion) => ({ ...exclusion })),
    evidenceReferences: evidenceReferences.map((evidence) => ({ ...evidence })),
    excerpts: excerpts.map((excerpt) => ({ ...excerpt })),
    truncation: truncation.map((record) => ({ ...record })),
    limits: { ...input.limits },
    policy: {
      classificationPolicyVersion: normalizeCanonicalString(
        input.policy.classificationPolicyVersion,
      ),
      identityPolicyVersion: normalizeCanonicalString(input.policy.identityPolicyVersion),
      parserProfileVersion: normalizeCanonicalString(input.policy.parserProfileVersion),
      analysisPolicyVersion: normalizeCanonicalString(input.policy.analysisPolicyVersion),
      promptBundleVersion: normalizeCanonicalString(input.policy.promptBundleVersion),
    },
    deterministicAnalyzer: {
      classification: input.deterministicAnalyzer.classification,
      requiresAiAssistance: input.deterministicAnalyzer.requiresAiAssistance,
      inputEvidenceReferenceIds,
      candidateRootFingerprints,
      warningCodes,
      ambiguityReasonCodes,
    },
  } as const satisfies CanonicalM02Value;
  const canonicalBytes = canonicalM02JsonBytes(payload);
  return {
    payload,
    canonicalBytes,
    fingerprint: createHash("sha256").update(canonicalBytes).digest("hex"),
  };
}

export function buildCandidateAnalysisFingerprint(input: {
  readonly sourceSnapshotId: string;
  readonly candidateRootFingerprint: string;
  readonly candidateContentFingerprint: string;
  readonly classificationPolicyVersion: string;
  readonly identityPolicyVersion: string;
  readonly promptBundleVersion: string;
  readonly boundedInputFingerprint: string;
}) {
  assertNonEmpty(input.sourceSnapshotId, "source snapshot ID");
  assertSha256(input.candidateRootFingerprint, "candidate root SHA-256");
  assertSha256(input.candidateContentFingerprint, "candidate content SHA-256");
  assertSha256(input.boundedInputFingerprint, "bounded input SHA-256");
  assertNonEmpty(input.classificationPolicyVersion, "classification policy version");
  assertNonEmpty(input.identityPolicyVersion, "identity policy version");
  assertNonEmpty(input.promptBundleVersion, "prompt bundle version");
  const payload = {
    schemaVersion: "1",
    sourceSnapshotId: normalizeCanonicalString(input.sourceSnapshotId),
    candidateRootFingerprint: input.candidateRootFingerprint,
    candidateContentFingerprint: input.candidateContentFingerprint,
    classificationPolicyVersion: normalizeCanonicalString(input.classificationPolicyVersion),
    identityPolicyVersion: normalizeCanonicalString(input.identityPolicyVersion),
    promptBundleVersion: normalizeCanonicalString(input.promptBundleVersion),
    boundedInputFingerprint: input.boundedInputFingerprint,
  } as const;
  return {
    payload,
    canonicalBytes: canonicalM02JsonBytes(payload),
    fingerprint: fingerprintM02Payload(payload),
  };
}

export function buildCandidateIdempotencyKey(input: {
  readonly sourceSnapshotId: string;
  readonly candidateRootFingerprint: string;
  readonly candidateContentFingerprint: string;
}): string {
  assertNonEmpty(input.sourceSnapshotId, "source snapshot ID");
  assertSha256(input.candidateRootFingerprint, "candidate root SHA-256");
  assertSha256(input.candidateContentFingerprint, "candidate content SHA-256");
  return fingerprintM02Payload({
    schemaVersion: "1",
    sourceSnapshotId: normalizeCanonicalString(input.sourceSnapshotId),
    candidateRootFingerprint: input.candidateRootFingerprint,
    candidateContentFingerprint: input.candidateContentFingerprint,
  });
}

export class FingerprintCollisionError extends Error {
  readonly code = "FINGERPRINT_COLLISION" as const;

  constructor() {
    super("canonical payload bytes differ after fingerprint lookup");
    this.name = "FingerprintCollisionError";
  }
}

export function assertCanonicalPayloadMatch(stored: Uint8Array, attempted: Uint8Array): void {
  if (!hasMatchingCanonicalPayload(stored, attempted)) throw new FingerprintCollisionError();
}
