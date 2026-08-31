import { TextDecoder } from "node:util";

import {
  BasicExtractionRequestV1Schema,
  ExpectedPredecessorStateV1Schema,
  ExtractionCommandResultV1Schema,
  ExtractionSourceReferenceV1Schema,
  ExtractionRequestV1Schema,
  M03_FIELD_KEYS,
  M03_POLICY_VERSIONS,
  StructuredExtractionBundleV1Schema,
  type ExpectedPredecessorStateV1,
  type BasicExtractionRequestV1,
  type ExtractionFieldResultV1,
  type ExtractionCommandResultV1,
  type ExtractionRequestV1,
  type M03FieldKey,
  type M03WarningCode,
  type M03AnalysisExecutionResultV1,
  type M03AnalysisAttemptV1,
  type M03StructuredAnalysisPortV1,
} from "@ai-ark/contracts";

import {
  createExtractorRegistry,
  extractDeterministic,
  type DeterministicExtractionInput,
  type ExtractionConflictV1,
  type M03SourceDocument,
} from "./deterministic.js";
import { canonicalJson, compareUnsignedUtf8 } from "./normalization.js";
import { M03ProvenanceAuthority, sha256Hex } from "./provenance.js";

export interface M03PolicyArtifacts {
  readonly policyLiteral: string;
  readonly fieldRegistry: string;
  readonly taxonomyRegistry: string;
}

type M03RowVersion = string;
interface M03ByteString {
  readonly byteLength: number;
  readonly base64: string;
}

export interface M03M02InputProjectionV1 {
  readonly handoff: {
    readonly id: string;
    readonly resourceCandidateId: string;
    readonly resourceIdentityId: string;
    readonly resourceVersionIdentityId: string;
    readonly controllingM02JobId: string;
    readonly sourceSnapshotId: string;
    readonly identityDecisionId: string;
    readonly originType: string;
    readonly logicalKey: string;
    readonly state: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly acquisitionJob: {
    readonly id: string;
    readonly status: string;
    readonly currentStage: string;
    readonly sourceSnapshotId: string;
    readonly cancellationRequested: boolean;
    readonly recordVersion: M03RowVersion;
  };
  readonly m02Job: {
    readonly id: string;
    readonly jobLineageId: string;
    readonly sourceSnapshotId: string;
    readonly operationScope: string;
    readonly currentStage: string;
    readonly reviewState: string;
    readonly supersessionState: string;
    readonly supersededByJobIdOrNull: string | null;
    readonly supersessionSequence: number;
    readonly controllingClassificationDecisionIdOrNull: string | null;
    readonly jobScopeKey: string;
    readonly inputFingerprint: string;
    readonly classificationPolicyVersion: string;
    readonly identityPolicyVersion: string;
    readonly analysisPolicyVersion: string;
    readonly parserProfileVersion: string;
    readonly promptBundleVersion: string;
    readonly analysisProviderAdapterIdOrNull: string | null;
    readonly analysisModelIdOrNull: string | null;
    readonly analysisMethodologyVersionOrNull: string | null;
    readonly recordVersion: M03RowVersion;
    readonly replacement:
      | {
          readonly kind: "ORIGINAL";
          readonly reasonCodeOrNull: null;
          readonly inputPayloadOrNull: null;
          readonly inputFingerprintOrNull: null;
          readonly sourceJobIdOrNull: null;
          readonly sourceOperationScopeOrNull: null;
          readonly requestedOperationScopeOrNull: null;
          readonly predecessorJobIds: readonly [];
          readonly originalSourceSnapshotIdOrNull: null;
          readonly replacementSourceSnapshotIdOrNull: null;
        }
      | {
          readonly kind: "REPLACEMENT";
          readonly reasonCode: string;
          readonly inputPayloadOrNull: M03ByteString | null;
          readonly inputFingerprintOrNull: string;
          readonly sourceJobIdOrNull: string | null;
          readonly sourceOperationScopeOrNull: string | null;
          readonly requestedOperationScopeOrNull: string | null;
          readonly predecessorJobIds: readonly string[];
          readonly originalSourceSnapshotIdOrNull: string | null;
          readonly replacementSourceSnapshotIdOrNull: string | null;
        };
  };
  readonly candidate: {
    readonly id: string;
    readonly sourceSnapshotId: string;
    readonly candidateRootId: string;
    readonly candidateRootFingerprint: string;
    readonly candidateContentFingerprint: string;
    readonly reconciledClassificationRunId: string;
    readonly classificationPolicyVersion: string;
    readonly identityPolicyVersion: string;
    readonly identityOutcome: string;
    readonly status: string;
    readonly resourceIdentityId: string;
    readonly resourceVersionIdentityId: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly resourceIdentity: {
    readonly id: string;
    readonly resourceType: string;
    readonly status: string;
    readonly reliableIdentityTokenOrNull: string | null;
    readonly reliableTokenEvidenceIdOrNull: string | null;
    readonly guardAnchorCandidateId: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly resourceVersionIdentity: {
    readonly id: string;
    readonly resourceIdentityId: string;
    readonly contentFingerprint: string;
    readonly firstObservedSourceSnapshotId: string;
    readonly firstObservedCandidateRootId: string;
    readonly firstObservedSourceRevision: string;
    readonly observationLabel: string;
    readonly status: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly observation: {
    readonly id: string;
    readonly resourceVersionIdentityId: string;
    readonly sourceSnapshotId: string;
    readonly candidateRootId: string;
    readonly resourceSourceLinkId: string;
    readonly sourceRepositoryId: string;
    readonly provider: string;
    readonly providerRepositoryId: string;
    readonly normalizedRootPath: string;
    readonly immutableRevision: string;
    readonly observedAt: string;
  };
  readonly sourceLink: {
    readonly id: string;
    readonly sourceRepositoryId: string;
    readonly normalizedRootPath: string;
    readonly targetResourceVersionId: string;
    readonly relationship: string;
    readonly decisionId: string;
    readonly state: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly sourceRepository: {
    readonly id: string;
    readonly provider: string;
    readonly providerRepositoryId: string;
    readonly firstObservedSourceSnapshotId: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly identityDecision: {
    readonly id: string;
    readonly resourceCandidateId: string;
    readonly outcome: string;
    readonly matchedTierOrNull: string | null;
    readonly confidenceOrNull: number | null;
    readonly identityPolicyVersion: string;
    readonly decisionSource: string;
    readonly state: string;
    readonly recordVersion: M03RowVersion;
  };
  readonly candidateReviewState: {
    readonly id: string;
    readonly groupIdOrNull: string | null;
    readonly resourceCandidateId: string;
    readonly reviewState: string;
    readonly supersededByReviewIdOrNull: string | null;
    readonly recordVersion: M03RowVersion;
  };
  readonly candidateRoot: {
    readonly id: string;
    readonly groupId: string;
    readonly classificationRunId: string;
    readonly sourceSnapshotId: string;
    readonly normalizedRootPath: string;
    readonly candidateRootFingerprint: string;
    readonly candidateContentFingerprint: string;
    readonly state: string;
    readonly recordVersion: M03RowVersion;
  };
}

export interface M03EligibilitySnapshot {
  readonly m02InputProjection: M03M02InputProjectionV1;
  readonly handoffExists: boolean;
  readonly handoffActive: boolean;
  readonly acquisitionCompleted: boolean;
  readonly cancellationRequested: boolean;
  readonly m02JobControlling: boolean;
  readonly candidateResolved: boolean;
  readonly reviewClear: boolean;
  readonly identityTupleValid: boolean;
  readonly observationExists: boolean;
  readonly observationTupleValid: boolean;
  readonly sourceLinkActive: boolean;
  readonly identityDecisionControlling: boolean;
  readonly snapshotMatches: boolean;
  readonly revisionMatches: boolean;
  readonly corpusValid: boolean;
  readonly expectedPredecessorState: ExpectedPredecessorStateV1;
}

export interface M03SourceSnapshot {
  readonly providerMetadata: DeterministicExtractionInput["providerMetadata"];
  readonly documents: readonly M03SourceDocument[];
  readonly unavailableEntries?: DeterministicExtractionInput["unavailableEntries"];
}

export interface M03LoadedInput {
  readonly predecessor: M03EligibilitySnapshot;
  readonly source: M03SourceSnapshot;
  readonly checkControl: () => Promise<M03EligibilitySnapshot>;
}

type EligibilityError =
  | "M02_HANDOFF_NOT_FOUND"
  | "M02_HANDOFF_NOT_ACTIVE"
  | "M02_JOB_NOT_CONTROLLING"
  | "M02_CANDIDATE_NOT_RESOLVED"
  | "M02_REVIEW_ACTIVE"
  | "M02_IDENTITY_TUPLE_INVALID"
  | "M02_OBSERVATION_NOT_FOUND"
  | "M02_OBSERVATION_TUPLE_INVALID"
  | "M02_SOURCE_LINK_NOT_ACTIVE"
  | "M02_IDENTITY_DECISION_NOT_CONTROLLING"
  | "SOURCE_SNAPSHOT_MISMATCH"
  | "SOURCE_REVISION_MISMATCH"
  | "SOURCE_CORPUS_INVALID"
  | "STALE_RECORD_VERSION";

export function fingerprintAnalysisConfiguration(input: {
  readonly mode: "DISABLED" | "ENABLED";
  readonly operation: "NORMALIZE_STRUCTURED_EXTRACTION";
  readonly providerAdapterNameOrNull: string | null;
  readonly providerAdapterVersionOrNull: string | null;
  readonly providerNameOrNull: string | null;
  readonly modelNameOrNull: string | null;
  readonly deterministicSettings: Readonly<Record<string, unknown>>;
  readonly subOperationPlan: readonly string[];
  readonly methodologyVersion: string;
  readonly promptBundleVersion: string;
  readonly outputContractVersion: string;
  readonly rawAnalysisSchemaVersion: string;
  readonly analysisBundleVersion: string;
}): string {
  return sha256Hex(
    canonicalJson({
      mode: input.mode,
      operation: input.operation,
      providerAdapterNameOrNull: input.providerAdapterNameOrNull,
      providerAdapterVersionOrNull: input.providerAdapterVersionOrNull,
      providerNameOrNull: input.providerNameOrNull,
      modelNameOrNull: input.modelNameOrNull,
      methodologyVersion: input.methodologyVersion,
      deterministicSettings: input.deterministicSettings,
      promptBundleVersion: input.promptBundleVersion,
      outputContractVersion: input.outputContractVersion,
      rawAnalysisSchemaVersion: input.rawAnalysisSchemaVersion,
      analysisBundleVersion: input.analysisBundleVersion,
      subOperationPlan: input.subOperationPlan,
    }),
  );
}

export function fingerprintExtractionRequest(request: ExtractionRequestV1): string {
  return sha256Hex(extractionRequestPreimage(request));
}

function extractionRequestPreimage(request: BasicExtractionRequestV1): string {
  const { requestId: _requestId, idempotencyKey: _idempotencyKey, ...semanticRequest } = request;
  void _requestId;
  void _idempotencyKey;
  return canonicalJson(semanticRequest);
}

function safeContext(request: BasicExtractionRequestV1, phase: string) {
  return {
    phase,
    requestId: request.requestId,
    handoffMarkerIdOrNull: request.m02HandoffMarkerId,
    resourceCandidateIdOrNull: request.resourceCandidateId,
    resourceVersionObservationIdOrNull: request.resourceVersionObservationId,
    fieldKeyOrNull: null,
    recordKindOrNull: null,
    expectedVersionOrNull: null,
    actualVersionOrNull: null,
    expectedFingerprintOrNull: null,
    actualFingerprintOrNull: null,
    limitNameOrNull: null,
    limitOrNull: null,
    observedOrNull: null,
  };
}

function eligibilityError(
  request: ExtractionRequestV1,
  predecessor: M03EligibilitySnapshot,
): EligibilityError | null {
  if (!predecessor.handoffExists) return "M02_HANDOFF_NOT_FOUND";
  if (!predecessor.handoffActive) return "M02_HANDOFF_NOT_ACTIVE";
  if (
    !predecessor.acquisitionCompleted ||
    predecessor.cancellationRequested ||
    !predecessor.m02JobControlling
  )
    return "M02_JOB_NOT_CONTROLLING";
  if (!predecessor.candidateResolved) return "M02_CANDIDATE_NOT_RESOLVED";
  if (!predecessor.reviewClear) return "M02_REVIEW_ACTIVE";
  if (!predecessor.identityTupleValid) return "M02_IDENTITY_TUPLE_INVALID";
  if (!predecessor.observationExists) return "M02_OBSERVATION_NOT_FOUND";
  if (!predecessor.observationTupleValid) return "M02_OBSERVATION_TUPLE_INVALID";
  if (!predecessor.sourceLinkActive) return "M02_SOURCE_LINK_NOT_ACTIVE";
  if (!predecessor.identityDecisionControlling) return "M02_IDENTITY_DECISION_NOT_CONTROLLING";
  if (!predecessor.snapshotMatches) return "SOURCE_SNAPSHOT_MISMATCH";
  if (!predecessor.revisionMatches) return "SOURCE_REVISION_MISMATCH";
  if (!predecessor.corpusValid) return "SOURCE_CORPUS_INVALID";
  if (
    canonicalJson(predecessor.expectedPredecessorState) !==
    canonicalJson(request.expectedPredecessorState)
  )
    return "STALE_RECORD_VERSION";
  return null;
}

function utf8Request(bytes: Uint8Array): { readonly decoded: string; readonly value: unknown } {
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return { decoded, value: JSON.parse(decoded) };
}

function duplicateJsonKeyPaths(json: string): readonly (readonly string[])[] {
  let cursor = 0;
  const duplicates: string[][] = [];
  const whitespace = new Set([" ", "\t", "\n", "\r"]);
  const skipWhitespace = () => {
    while (whitespace.has(json[cursor] ?? "")) cursor += 1;
  };
  const readString = (): string => {
    const start = cursor;
    cursor += 1;
    while (cursor < json.length) {
      const character = json[cursor];
      if (character === "\\") {
        cursor += 2;
      } else if (character === '"') {
        cursor += 1;
        return JSON.parse(json.slice(start, cursor)) as string;
      } else {
        cursor += 1;
      }
    }
    throw new SyntaxError("unterminated JSON string");
  };
  const readValue = (path: readonly string[]): void => {
    skipWhitespace();
    const character = json[cursor];
    if (character === "{") {
      cursor += 1;
      skipWhitespace();
      const keys = new Set<string>();
      while (json[cursor] !== "}") {
        const key = readString();
        if (keys.has(key)) duplicates.push([...path, key]);
        keys.add(key);
        skipWhitespace();
        cursor += 1;
        readValue([...path, key]);
        skipWhitespace();
        if (json[cursor] === ",") {
          cursor += 1;
          skipWhitespace();
        } else {
          break;
        }
      }
      cursor += 1;
      return;
    }
    if (character === "[") {
      cursor += 1;
      skipWhitespace();
      let index = 0;
      while (json[cursor] !== "]") {
        readValue([...path, String(index)]);
        index += 1;
        skipWhitespace();
        if (json[cursor] === ",") {
          cursor += 1;
          skipWhitespace();
        } else {
          break;
        }
      }
      cursor += 1;
      return;
    }
    if (character === '"') {
      readString();
      return;
    }
    while (cursor < json.length && ![",", "]", "}"].includes(json[cursor] ?? "")) cursor += 1;
  };
  readValue([]);
  return duplicates;
}

function base64Bytes(value: string) {
  const bytes = Buffer.from(value, "utf8");
  return { byteLength: bytes.byteLength, base64: bytes.toString("base64") };
}

const materialFields = new Set([
  "canonical_skill_name",
  "version",
  "source_revision",
  "license",
  "outcome_candidate",
  "capabilities",
  "tasks",
  "use_cases",
  "installation",
  "configuration",
  "dependencies",
  "external_services",
  "permissions",
  "compatibility",
  "limitations",
]);

type M03HashDomain =
  | "REQUEST"
  | "INPUT"
  | "CANDIDATE_ROOT_PAYLOAD"
  | "OWNED_CONTENT"
  | "DOCUMENT_CONTENT"
  | "SOURCE_INVENTORY"
  | "PROVIDER_METADATA"
  | "POLICY_ARTIFACT"
  | "ANALYSIS_CONFIGURATION"
  | "SOURCE_REFERENCE"
  | "SENSITIVE_LOCATOR"
  | "EXTRACTOR_REFERENCE"
  | "EXTRACTOR_CONFIGURATION"
  | "EXTRACTOR_CODE_BUNDLE"
  | "CANDIDATE"
  | "CONFLICT"
  | "ANALYSIS_ATTEMPT"
  | "ANALYSIS_INPUT"
  | "ANALYSIS_INVOCATION"
  | "ANALYSIS_RESULT"
  | "EXTRACTION_ID"
  | "OUTPUT_FINGERPRINT"
  | "RAW_PROVIDER_OUTPUT"
  | "AI_PROPOSAL_FINGERPRINT"
  | "AI_PROPOSAL_ID";

export class InMemoryM03Orchestrator {
  readonly #policyArtifacts: M03PolicyArtifacts;
  readonly #now: () => string;
  readonly #analysisPort: M03StructuredAnalysisPortV1 | null;
  readonly #hash: (domain: M03HashDomain, bytes: string | Uint8Array) => string;
  readonly #resultByEffectiveTuple = new Map<string, unknown>();
  readonly #resultByIdempotencyKey = new Map<string, unknown>();
  readonly #requestFingerprintByIdempotencyKey = new Map<string, string>();
  readonly #inFlightByIdempotencyKey = new Map<string, Promise<void>>();
  readonly #inFlightByEffectiveTuple = new Map<string, Promise<void>>();
  readonly #requestPreimageByFingerprint = new Map<string, string>();
  readonly #inputComponentPreimageByDomainAndHash = new Map<string, string>();
  readonly #contentPreimageByDomainAndHash = new Map<string, string>();
  readonly #provenanceAuthority: M03ProvenanceAuthority;

  public constructor(input: {
    readonly policyArtifacts: M03PolicyArtifacts;
    readonly now: () => string;
    readonly analysisPort?: M03StructuredAnalysisPortV1;
    readonly hashForTesting?: (domain: M03HashDomain, bytes: string | Uint8Array) => string;
  }) {
    if (
      sha256Hex(input.policyArtifacts.policyLiteral) !==
        M03_POLICY_VERSIONS.policyArtifactFingerprint ||
      Buffer.byteLength(input.policyArtifacts.fieldRegistry, "utf8") !== 2124 ||
      sha256Hex(input.policyArtifacts.fieldRegistry) !==
        "6cadc39a636f11df3443593dc1b224dc1a4e6941c9f5926166ba29ae42e39dd4" ||
      sha256Hex(input.policyArtifacts.taxonomyRegistry) !==
        M03_POLICY_VERSIONS.taxonomyRegistryFingerprint
    ) {
      throw new Error("M03_POLICY_ARTIFACT_INVALID");
    }
    this.#policyArtifacts = input.policyArtifacts;
    this.#now = input.now;
    this.#analysisPort = input.analysisPort ?? null;
    this.#hash = input.hashForTesting ?? ((_domain, bytes) => sha256Hex(bytes));
    this.#provenanceAuthority = new M03ProvenanceAuthority((preimage) =>
      this.#derivedHash("SENSITIVE_LOCATOR", preimage),
    );
  }

  #derivedHash(domain: M03HashDomain, preimage: unknown): string {
    const bytes = typeof preimage === "string" ? preimage : canonicalJson(preimage);
    const hash = this.#hash(domain, bytes);
    const key = `${domain}:${hash}`;
    const retained = this.#contentPreimageByDomainAndHash.get(key);
    if (retained !== undefined && retained !== bytes)
      throw new Error("CONTENT_DERIVED_ID_COLLISION");
    this.#contentPreimageByDomainAndHash.set(key, bytes);
    return hash;
  }

  #derivedByteHash(domain: M03HashDomain, bytes: Uint8Array): string {
    const retainedBytes = Buffer.from(bytes).toString("base64");
    const hash = this.#hash(domain, bytes);
    const key = `${domain}:${hash}`;
    const retained = this.#contentPreimageByDomainAndHash.get(key);
    if (retained !== undefined && retained !== retainedBytes)
      throw new Error("CONTENT_DERIVED_ID_COLLISION");
    this.#contentPreimageByDomainAndHash.set(key, retainedBytes);
    return hash;
  }

  #inputComponentHash(domain: M03HashDomain, preimage: unknown): string {
    const bytes = typeof preimage === "string" ? preimage : canonicalJson(preimage);
    const hash = this.#hash(domain, bytes);
    const key = `${domain}:${hash}`;
    const retained = this.#inputComponentPreimageByDomainAndHash.get(key);
    if (retained !== undefined && retained !== bytes)
      throw new Error("INPUT_FINGERPRINT_COLLISION");
    this.#inputComponentPreimageByDomainAndHash.set(key, bytes);
    return hash;
  }

  #deterministicIdentitiesValid(
    deterministic: ReturnType<typeof extractDeterministic>,
    policyFingerprint: string,
  ): boolean {
    for (const reference of deterministic.sourceReferences) {
      const {
        id,
        excerptHashOrNull: _excerptHash,
        excerptOrNull: _excerpt,
        ...identity
      } = reference;
      void _excerptHash;
      void _excerpt;
      if (id !== `src_${this.#derivedHash("SOURCE_REFERENCE", identity)}`) return false;
    }
    for (const extractor of deterministic.extractorRefs) {
      const { id, ...identity } = extractor;
      if (id !== `xtr_${this.#derivedHash("EXTRACTOR_REFERENCE", identity)}`) return false;
      if (
        extractor.configurationFingerprint !==
        this.#derivedHash("EXTRACTOR_CONFIGURATION", {
          name: extractor.name,
          policyFingerprint,
        })
      )
        return false;
      if (
        extractor.codeBundleFingerprint !==
        this.#derivedHash("EXTRACTOR_CODE_BUNDLE", {
          name: extractor.name,
          semanticVersion: extractor.semanticVersion,
        })
      )
        return false;
    }
    for (const candidate of deterministic.deterministicCandidates) {
      const { id, candidateFingerprint, ...payload } = candidate;
      const expected = this.#derivedHash("CANDIDATE", payload);
      if (candidateFingerprint !== expected || id !== `cand_${expected}`) return false;
    }
    for (const conflict of deterministic.conflicts) {
      const { id, ...payload } = conflict;
      if (id !== `conf_${this.#derivedHash("CONFLICT", payload)}`) return false;
    }
    return true;
  }

  #analysisIdentitiesValid(
    attempts: readonly M03AnalysisAttemptV1[],
    proposals: readonly Readonly<Record<string, unknown>>[],
  ): boolean {
    for (const attempt of attempts) {
      const resultIdentity = {
        invocationId: attempt.invocationId,
        status: attempt.status,
        outputFingerprintOrNull: attempt.outputFingerprintOrNull,
        safeErrorCodeOrNull: attempt.safeErrorCodeOrNull,
        invalidityClassOrNull: "invalidityClass" in attempt ? attempt.invalidityClass : null,
      };
      if (attempt.id !== `ana_${this.#derivedHash("ANALYSIS_ATTEMPT", resultIdentity)}`)
        return false;
    }
    for (const proposal of proposals) {
      const { id, analysisAttemptId, proposalFingerprint, ...payload } = proposal;
      const expectedFingerprint = this.#derivedHash("AI_PROPOSAL_FINGERPRINT", payload);
      if (proposalFingerprint !== expectedFingerprint) return false;
      if (
        id !==
        `aip_${this.#derivedHash("AI_PROPOSAL_ID", {
          analysisAttemptId,
          proposalFingerprint,
        })}`
      )
        return false;
    }
    return true;
  }

  public async execute(
    rawRequestBytes: Uint8Array,
    load: () => Promise<M03LoadedInput>,
  ): Promise<ExtractionCommandResultV1> {
    const result = await this.#executeUnchecked(rawRequestBytes, load);
    return ExtractionCommandResultV1Schema.parse(result);
  }

  async #executeUnchecked(
    rawRequestBytes: Uint8Array,
    load: () => Promise<M03LoadedInput>,
  ): Promise<unknown> {
    let rawRequest: unknown;
    let duplicateKeyPaths: readonly (readonly string[])[];
    try {
      const decoded = utf8Request(rawRequestBytes);
      rawRequest = decoded.value;
      duplicateKeyPaths = duplicateJsonKeyPaths(decoded.decoded);
    } catch {
      return {
        kind: "INVALID_REQUEST",
        rawRequestDigest: sha256Hex(rawRequestBytes),
        errorCode: "REQUEST_SCHEMA_INVALID",
        safeContext: { phase: "REQUEST_VALIDATION" },
      };
    }
    const basicParsed = BasicExtractionRequestV1Schema.safeParse(rawRequest);
    if (
      !basicParsed.success ||
      duplicateKeyPaths.some(([first]) => first !== "expectedPredecessorState")
    ) {
      return {
        kind: "INVALID_REQUEST",
        rawRequestDigest: sha256Hex(rawRequestBytes),
        errorCode: "REQUEST_SCHEMA_INVALID",
        safeContext: { phase: "REQUEST_VALIDATION" },
      };
    }
    const basicRequest = basicParsed.data;
    const expectedConfigurationFingerprint = fingerprintAnalysisConfiguration({
      ...basicRequest.analysisConfiguration,
      methodologyVersion: basicRequest.policyVersions.methodologyVersion,
      promptBundleVersion: basicRequest.policyVersions.promptBundleVersion,
      outputContractVersion: basicRequest.policyVersions.outputContractVersion,
      rawAnalysisSchemaVersion: basicRequest.policyVersions.rawAnalysisSchemaVersion,
      analysisBundleVersion: basicRequest.policyVersions.analysisBundleVersion,
    });
    const extractorRefs = createExtractorRegistry(
      basicRequest.policyVersions.policyArtifactFingerprint,
      basicRequest.analysisConfiguration.mode === "ENABLED",
    );
    const extractorRegistryFingerprint = sha256Hex(canonicalJson(extractorRefs));
    if (
      basicRequest.analysisConfigurationFingerprint !== expectedConfigurationFingerprint ||
      basicRequest.policyVersions.extractorRegistryFingerprint !== extractorRegistryFingerprint
    ) {
      return {
        kind: "INVALID_REQUEST",
        rawRequestDigest: sha256Hex(rawRequestBytes),
        errorCode: "REQUEST_SCHEMA_INVALID",
        safeContext: { phase: "REQUEST_VALIDATION" },
      };
    }
    const expectedState = ExpectedPredecessorStateV1Schema.safeParse(
      basicRequest.expectedPredecessorState,
    );
    const expectedStateHasDuplicate = duplicateKeyPaths.some(
      ([first]) => first === "expectedPredecessorState",
    );
    if (!expectedState.success || expectedStateHasDuplicate) {
      const requestPreimage = extractionRequestPreimage(basicRequest);
      const requestFingerprint = this.#hash("REQUEST", requestPreimage);
      const retainedRequestPreimage = this.#requestPreimageByFingerprint.get(requestFingerprint);
      if (retainedRequestPreimage !== undefined && retainedRequestPreimage !== requestPreimage)
        return processingFailure(
          basicRequest,
          requestFingerprint,
          "INPUT_FINGERPRINT_COLLISION",
          null,
          null,
        );
      this.#requestPreimageByFingerprint.set(requestFingerprint, requestPreimage);
      const existingFingerprint = this.#requestFingerprintByIdempotencyKey.get(
        basicRequest.idempotencyKey,
      );
      if (existingFingerprint !== undefined && existingFingerprint !== requestFingerprint)
        return {
          kind: "REJECTED",
          requestFingerprint,
          errorCode: "IDEMPOTENCY_KEY_REUSED",
          safeContext: safeContext(basicRequest, "ELIGIBILITY"),
        };
      const replay = this.#resultByIdempotencyKey.get(basicRequest.idempotencyKey);
      if (replay !== undefined) return replay;
      this.#requestFingerprintByIdempotencyKey.set(basicRequest.idempotencyKey, requestFingerprint);
      const result = {
        kind: "REJECTED",
        requestFingerprint,
        errorCode: "EXPECTED_VERSION_SET_INVALID",
        safeContext: safeContext(basicRequest, "ELIGIBILITY"),
      };
      this.#resultByIdempotencyKey.set(basicRequest.idempotencyKey, result);
      return result;
    }
    const parsed = ExtractionRequestV1Schema.safeParse({
      ...basicRequest,
      expectedPredecessorState: expectedState.data,
    });
    if (!parsed.success) throw new Error("M03_REQUEST_SCHEMA_INTERNAL_INCONSISTENCY");
    const request = parsed.data;
    const requestPreimage = extractionRequestPreimage(request);
    const requestFingerprint = this.#hash("REQUEST", requestPreimage);
    const retainedRequestPreimage = this.#requestPreimageByFingerprint.get(requestFingerprint);
    if (retainedRequestPreimage !== undefined && retainedRequestPreimage !== requestPreimage) {
      return processingFailure(
        request,
        requestFingerprint,
        "INPUT_FINGERPRINT_COLLISION",
        null,
        null,
      );
    }
    this.#requestPreimageByFingerprint.set(requestFingerprint, requestPreimage);
    const existingFingerprint = this.#requestFingerprintByIdempotencyKey.get(
      request.idempotencyKey,
    );
    if (existingFingerprint !== undefined && existingFingerprint !== requestFingerprint) {
      return {
        kind: "REJECTED",
        requestFingerprint,
        errorCode: "IDEMPOTENCY_KEY_REUSED",
        safeContext: safeContext(request, "ELIGIBILITY"),
      };
    }
    const idempotentReplay = this.#resultByIdempotencyKey.get(request.idempotencyKey);
    if (idempotentReplay !== undefined) return idempotentReplay;
    const concurrent = this.#inFlightByIdempotencyKey.get(request.idempotencyKey);
    if (concurrent !== undefined) {
      await concurrent;
      const joined = this.#resultByIdempotencyKey.get(request.idempotencyKey);
      if (joined !== undefined) return joined;
      throw new Error("M03_CONCURRENT_CONTROLLER_FAILED");
    }
    let releaseController: (() => void) | undefined;
    const controller = new Promise<void>((resolve) => {
      releaseController = resolve;
    });
    this.#inFlightByIdempotencyKey.set(request.idempotencyKey, controller);
    let effectiveTupleKey: string | null = null;
    let releaseEffectiveController: (() => void) | undefined;
    try {
      this.#requestFingerprintByIdempotencyKey.set(request.idempotencyKey, requestFingerprint);
      const loaded = await load();
      const rejected = eligibilityError(request, loaded.predecessor);
      if (rejected !== null) {
        const result = {
          kind: "REJECTED",
          requestFingerprint,
          errorCode: rejected,
          safeContext: safeContext(request, "ELIGIBILITY"),
        };
        this.#resultByIdempotencyKey.set(request.idempotencyKey, result);
        return result;
      }
      const initialControl = await readControl(request, loaded);
      if (initialControl !== null) {
        const result = terminalControlResult(
          request,
          requestFingerprint,
          initialControl,
          null,
          null,
          [],
        );
        this.#resultByIdempotencyKey.set(request.idempotencyKey, result);
        return result;
      }
      const providerMetadataCanonicalBytes = canonicalJson(loaded.source.providerMetadata);
      const sourceInventoryDocuments = loaded.source.documents
        .map((document) => ({
          sourceEntryId: document.sourceEntryId,
          sourceDocumentId: document.sourceDocumentId,
          ownership: document.ownership,
          normalizedPath: document.normalizedPath,
          exactContent: base64Bytes(document.content),
        }))
        .sort((left, right) => compareUnsignedUtf8(canonicalJson(left), canonicalJson(right)));
      const sourceInventoryPreimage = {
        sourceSnapshotId: request.sourceSnapshotId,
        resourceVersionObservationId: request.resourceVersionObservationId,
        resourceSourceLinkId: request.resourceSourceLinkId,
        providerMetadataCanonicalPayload: base64Bytes(providerMetadataCanonicalBytes),
        documents: sourceInventoryDocuments,
      };
      const analysisConfigurationCanonicalBytes = canonicalJson(request.analysisConfiguration);
      const analysisConfigurationCanonicalPayload = base64Bytes(
        analysisConfigurationCanonicalBytes,
      );
      const candidateRootCanonicalBytes = canonicalJson({
        candidateRootId: request.candidateRootId,
        candidateRootFingerprint: request.candidateRootFingerprint,
      });
      const candidateContentExactOwnedBytes = loaded.source.documents
        .filter((document) => document.ownership === "CANDIDATE_OWNED")
        .map((document) => ({
          normalizedPath: document.normalizedPath,
          ownership: document.ownership,
          content: base64Bytes(document.content),
        }))
        .sort((left, right) => compareUnsignedUtf8(canonicalJson(left), canonicalJson(right)));
      const policyArtifactsCanonicalPayloads = [
        {
          artifactName: "M03_POLICY_LITERAL",
          artifactVersion: "m03-policy-artifact-v1",
          content: base64Bytes(this.#policyArtifacts.policyLiteral),
        },
        {
          artifactName: "FIELD_REGISTRY",
          artifactVersion: "m03-fields-v1",
          content: base64Bytes(this.#policyArtifacts.fieldRegistry),
        },
        {
          artifactName: "TAXONOMY_REGISTRY",
          artifactVersion: "m03-taxonomy-empty-v1",
          content: base64Bytes(this.#policyArtifacts.taxonomyRegistry),
        },
        {
          artifactName: "EXTRACTOR_REGISTRY",
          artifactVersion: "m03-extractors-v1",
          content: base64Bytes(canonicalJson(extractorRefs)),
        },
      ] as const;
      const inputPreimage = {
        schemaVersion: request.schemaVersion,
        m02InputProjection: loaded.predecessor.m02InputProjection,
        expectedPredecessorState: request.expectedPredecessorState,
        candidateRootCanonicalPayload: base64Bytes(candidateRootCanonicalBytes),
        candidateContentExactOwnedBytes,
        sourceInventoryPreimage,
        policyArtifactsCanonicalPayloads,
        analysisConfigurationCanonicalPayload,
      };
      const inputPreimageBytes = canonicalJson(inputPreimage);
      let sourceInventoryFingerprint: string;
      let inputFingerprint: string;
      try {
        this.#inputComponentHash("PROVIDER_METADATA", providerMetadataCanonicalBytes);
        for (const document of loaded.source.documents)
          this.#inputComponentHash("DOCUMENT_CONTENT", document.content);
        this.#inputComponentHash("CANDIDATE_ROOT_PAYLOAD", candidateRootCanonicalBytes);
        this.#inputComponentHash("OWNED_CONTENT", candidateContentExactOwnedBytes);
        for (const artifact of policyArtifactsCanonicalPayloads)
          this.#inputComponentHash("POLICY_ARTIFACT", artifact);
        this.#inputComponentHash("ANALYSIS_CONFIGURATION", analysisConfigurationCanonicalBytes);
        sourceInventoryFingerprint = this.#inputComponentHash(
          "SOURCE_INVENTORY",
          sourceInventoryPreimage,
        );
        inputFingerprint = this.#inputComponentHash("INPUT", inputPreimageBytes);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "INPUT_FINGERPRINT_COLLISION")
          throw error;
        const result = processingFailure(
          request,
          requestFingerprint,
          "INPUT_FINGERPRINT_COLLISION",
          null,
          null,
        );
        this.#resultByIdempotencyKey.set(request.idempotencyKey, result);
        return result;
      }
      effectiveTupleKey = canonicalJson({
        resourceVersionIdentityId: request.resourceVersionIdentityId,
        resourceVersionObservationId: request.resourceVersionObservationId,
        inputFingerprint,
      });
      const effectiveReplay = this.#resultByEffectiveTuple.get(effectiveTupleKey);
      if (effectiveReplay !== undefined) {
        this.#resultByIdempotencyKey.set(request.idempotencyKey, effectiveReplay);
        return effectiveReplay;
      }
      const effectiveConcurrent = this.#inFlightByEffectiveTuple.get(effectiveTupleKey);
      if (effectiveConcurrent !== undefined) {
        await effectiveConcurrent;
        const joined = this.#resultByEffectiveTuple.get(effectiveTupleKey);
        if (joined !== undefined) {
          this.#resultByIdempotencyKey.set(request.idempotencyKey, joined);
          return joined;
        }
        throw new Error("M03_EFFECTIVE_TUPLE_CONTROLLER_FAILED");
      }
      const effectiveController = new Promise<void>((resolve) => {
        releaseEffectiveController = resolve;
      });
      this.#inFlightByEffectiveTuple.set(effectiveTupleKey, effectiveController);
      const retainEffective = (result: unknown) => {
        if (effectiveTupleKey === null) throw new Error("M03_EFFECTIVE_TUPLE_NOT_BOUND");
        this.#resultByEffectiveTuple.set(effectiveTupleKey, result);
        this.#resultByIdempotencyKey.set(request.idempotencyKey, result);
      };
      let deterministic: ReturnType<typeof extractDeterministic>;
      try {
        deterministic = extractDeterministic({
          sourceSnapshotId: request.sourceSnapshotId,
          sourceRevision: request.sourceRevision,
          resourceVersionObservationId: request.resourceVersionObservationId,
          resourceSourceLinkId: request.resourceSourceLinkId,
          candidateRootId: request.candidateRootId,
          ownershipTopologyFingerprint:
            request.expectedPredecessorState.fingerprintExpectations.ownershipTopology,
          acquisitionResultFingerprint:
            request.expectedPredecessorState.fingerprintExpectations.acquisitionResult,
          sourceSnapshotFingerprint:
            request.expectedPredecessorState.fingerprintExpectations.sourceSnapshot,
          providerMetadataFingerprint:
            request.expectedPredecessorState.fingerprintExpectations.providerMetadata,
          policyVersions: request.policyVersions,
          providerMetadata: loaded.source.providerMetadata,
          documents: loaded.source.documents,
          ...(loaded.source.unavailableEntries === undefined
            ? {}
            : { unavailableEntries: loaded.source.unavailableEntries }),
          includeOperationReferences: request.analysisConfiguration.mode === "ENABLED",
          provenanceAuthority: this.#provenanceAuthority,
        });
      } catch (error) {
        const collision =
          error instanceof Error && error.message === "CONTENT_DERIVED_ID_COLLISION";
        const result = processingFailure(
          request,
          requestFingerprint,
          collision ? "CONTENT_DERIVED_ID_COLLISION" : "DETERMINISTIC_PARSER_FAILED",
          "INVENTORY",
          sourceInventoryFingerprint,
        );
        retainEffective(result);
        return result;
      }
      if (
        deterministic.sourceReferences.some(
          (reference) => !ExtractionSourceReferenceV1Schema.safeParse(reference).success,
        )
      ) {
        const result = processingFailure(
          request,
          requestFingerprint,
          "SOURCE_REFERENCE_INVALID",
          "DETERMINISTIC",
          sourceInventoryFingerprint,
          deterministic,
        );
        retainEffective(result);
        return result;
      }
      try {
        if (
          !this.#deterministicIdentitiesValid(
            deterministic,
            request.policyVersions.policyArtifactFingerprint,
          )
        ) {
          const result = processingFailure(
            request,
            requestFingerprint,
            "CONTENT_DERIVED_ID_COLLISION",
            "DETERMINISTIC",
            sourceInventoryFingerprint,
            deterministic,
          );
          retainEffective(result);
          return result;
        }
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "CONTENT_DERIVED_ID_COLLISION")
          throw error;
        const result = processingFailure(
          request,
          requestFingerprint,
          "CONTENT_DERIVED_ID_COLLISION",
          "DETERMINISTIC",
          sourceInventoryFingerprint,
          deterministic,
        );
        retainEffective(result);
        return result;
      }
      const deterministicLimit = findDeterministicLimit(deterministic);
      if (deterministicLimit !== null) {
        const result = deterministicLimitFailure(
          request,
          requestFingerprint,
          sourceInventoryFingerprint,
          deterministic,
          deterministicLimit,
        );
        retainEffective(result);
        return result;
      }
      const deterministicControl = await readControl(request, loaded);
      if (deterministicControl !== null) {
        const result = terminalControlResult(
          request,
          requestFingerprint,
          deterministicControl,
          "DETERMINISTIC",
          sourceInventoryFingerprint,
          [],
          deterministic,
        );
        retainEffective(result);
        return result;
      }
      let analysisAttempts: readonly M03AnalysisAttemptV1[] = [];
      let aiProposals: readonly Readonly<Record<string, unknown>>[] = [];
      let aiInputExcerpts = 0;
      let aiInputCharacters = 0;
      let fields = deterministic.fields;
      let conflicts: readonly ExtractionConflictV1[] = deterministic.conflicts;
      let bundleWarnings = deterministic.warningCodes;
      if (request.analysisConfiguration.mode === "ENABLED") {
        const aiExtractor = extractorRefs.find((extractor) => extractor.kind === "AI_ANALYSIS");
        if (this.#analysisPort === null || aiExtractor === undefined) {
          const result = {
            kind: "FAILED",
            requestFingerprint,
            errorCode: "ANALYSIS_CALL_PLAN_INVALID",
            diagnostic: {
              lastCompletedStageOrNull: "DETERMINISTIC",
              sourceInventoryFingerprintOrNull: sourceInventoryFingerprint,
              deterministicCandidateCount: deterministic.deterministicCandidates.length,
              sourceReferenceCount: deterministic.sourceReferences.length,
              conflictCount: deterministic.conflicts.length,
              retainedAnalysisAttempts: [],
              warningCodes: deterministic.warningCodes,
              observedCounts: {
                sourceReferences: deterministic.sourceReferences.length,
                extractorReferences: deterministic.extractorRefs.length,
                deterministicCandidates: deterministic.deterministicCandidates.length,
                deterministicConflicts: deterministic.conflicts.length,
                deterministicWarningReferences: deterministicWarningReferences(deterministic),
                deterministicListItemsByField: listItemCounts(deterministic.fields),
                exactCommands: exactCommands(deterministic.fields).length,
                aiProposalCharactersMaximum: 0,
                aiProposals: 0,
                aiProjectedConflicts: 0,
                aiProjectedWarningReferences: 0,
                aiProjectedListItemsByField: zeroFieldCounts(),
                aiCalls: 0,
                aiInputExcerpts: 0,
                aiInputCharacters: 0,
              },
              safeContext: safeContext(request, "ANALYSIS"),
            },
          };
          retainEffective(result);
          return result;
        }
        let analysis: M03AnalysisExecutionResultV1;
        let nextAuthorizedAnalysisOrdinal = 0;
        let requestedAnalysisCallCount = 0;
        try {
          analysis = await this.#analysisPort.analyze({
            extractionInputFingerprint: inputFingerprint,
            analysisConfigurationFingerprint: request.analysisConfigurationFingerprint,
            fieldRegistryVersion: request.policyVersions.fieldRegistryVersion,
            rawAnalysisSchemaVersion: request.policyVersions.rawAnalysisSchemaVersion,
            analysisBundleVersion: request.policyVersions.analysisBundleVersion,
            subOperationPlan: request.analysisConfiguration.subOperationPlan,
            extractorRefId: aiExtractor.id,
            deterministicCandidates: deterministic.deterministicCandidates,
            deterministicConflicts: deterministic.conflicts,
            sourceReferences: deterministic.sourceReferences.map((reference) => ({
              id: reference.id,
              excerptHashOrNull: reference.excerptHashOrNull,
              excerptOrNull: reference.excerptOrNull,
              sensitive:
                (deterministic.sensitiveReferenceWarningCodesById[reference.id]?.length ?? 0) > 0 ||
                (reference.kind === "DOCUMENT" && reference.locator.type === "SENSITIVE_LOCATOR"),
              ownership: reference.kind === "DOCUMENT" ? reference.ownership : ("SHARED" as const),
              normalizedPath:
                reference.kind === "DOCUMENT" && "path" in reference.locator
                  ? reference.locator.path
                  : reference.kind === "DOCUMENT"
                    ? reference.sourceDocumentId
                    : reference.kind === "SNAPSHOT_METADATA"
                      ? `@snapshot/${reference.locator.type}`
                      : "@inventory/absence",
              locatorCanonicalBytes: canonicalJson(
                reference.kind === "INVENTORY_ABSENCE"
                  ? {
                      predicate: reference.predicate,
                      evaluatedSelectorPaths: reference.evaluatedSelectorPaths,
                    }
                  : reference.locator,
              ),
              candidateIndependentFor: Object.entries(deterministic.operationSourceReferenceIds)
                .filter(([, ids]) => ids.includes(reference.id))
                .map(
                  ([operation]) =>
                    operation as keyof typeof deterministic.operationSourceReferenceIds,
                ),
            })),
            authorizeInvocation: async (ordinal, purpose) => {
              requestedAnalysisCallCount = Math.max(requestedAnalysisCallCount, ordinal + 1);
              const expectedPurpose = ordinal === 0 ? "PRIMARY" : "SYNTACTIC_REPAIR";
              if (
                ordinal !== nextAuthorizedAnalysisOrdinal ||
                ordinal > 1 ||
                purpose !== expectedPurpose
              )
                throw new Error("ANALYSIS_CALL_PLAN_INVALID");
              nextAuthorizedAnalysisOrdinal += 1;
              return (await readControl(request, loaded)) ?? "PROCEED";
            },
            fingerprintRawOutput: (bytes) => this.#derivedByteHash("RAW_PROVIDER_OUTPUT", bytes),
            fingerprintAnalysisInput: (bytes) => this.#inputComponentHash("ANALYSIS_INPUT", bytes),
            deriveInvocationId: (bytes) => this.#derivedHash("ANALYSIS_INVOCATION", bytes),
          });
        } catch (error) {
          const contentCollision =
            error instanceof Error && error.message === "CONTENT_DERIVED_ID_COLLISION";
          const inputCollision =
            error instanceof Error && error.message === "INPUT_FINGERPRINT_COLLISION";
          const errorCode = contentCollision
            ? "CONTENT_DERIVED_ID_COLLISION"
            : inputCollision
              ? "INPUT_FINGERPRINT_COLLISION"
              : "ANALYSIS_CALL_PLAN_INVALID";
          const result = processingFailure(
            request,
            requestFingerprint,
            errorCode,
            "ANALYSIS",
            sourceInventoryFingerprint,
            deterministic,
            [],
            [],
            deterministic.fields,
            deterministic.conflicts,
            0,
            0,
            errorCode === "ANALYSIS_CALL_PLAN_INVALID"
              ? { name: "AI_CALLS", limit: 2, observed: requestedAnalysisCallCount }
              : undefined,
            errorCode === "ANALYSIS_CALL_PLAN_INVALID" ? nextAuthorizedAnalysisOrdinal : undefined,
          );
          retainEffective(result);
          return result;
        }
        analysisAttempts = analysis.attempts;
        aiInputExcerpts = analysis.observedInputExcerpts;
        aiInputCharacters = analysis.observedInputCharacters;
        try {
          if (!this.#analysisIdentitiesValid(analysis.attempts, analysis.proposals)) {
            const result = processingFailure(
              request,
              requestFingerprint,
              "CONTENT_DERIVED_ID_COLLISION",
              "ANALYSIS",
              sourceInventoryFingerprint,
              deterministic,
              analysis.attempts,
              analysis.proposals,
              deterministic.fields,
              deterministic.conflicts,
              aiInputExcerpts,
              aiInputCharacters,
            );
            retainEffective(result);
            return result;
          }
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "CONTENT_DERIVED_ID_COLLISION")
            throw error;
          const result = processingFailure(
            request,
            requestFingerprint,
            "CONTENT_DERIVED_ID_COLLISION",
            "ANALYSIS",
            sourceInventoryFingerprint,
            deterministic,
            analysis.attempts,
            analysis.proposals,
            deterministic.fields,
            deterministic.conflicts,
            aiInputExcerpts,
            aiInputCharacters,
          );
          retainEffective(result);
          return result;
        }
        if (analysis.controlTerminationOrNull !== null) {
          const result = terminalControlResult(
            request,
            requestFingerprint,
            analysis.controlTerminationOrNull,
            "ANALYSIS",
            sourceInventoryFingerprint,
            analysisAttempts,
            deterministic,
            analysis.proposals,
            deterministic.fields,
            deterministic.conflicts,
            aiInputExcerpts,
            aiInputCharacters,
          );
          retainEffective(result);
          return result;
        }
        const analysisControl = await readControl(request, loaded);
        if (analysisControl !== null) {
          const result = terminalControlResult(
            request,
            requestFingerprint,
            analysisControl,
            "ANALYSIS",
            sourceInventoryFingerprint,
            analysisAttempts,
            deterministic,
            analysis.proposals,
            deterministic.fields,
            deterministic.conflicts,
            aiInputExcerpts,
            aiInputCharacters,
          );
          retainEffective(result);
          return result;
        }
        aiProposals = analysis.proposals;
        const merged = mergeAnalysisFields(
          deterministic.fields,
          deterministic.conflicts,
          analysis.proposals,
          aiExtractor.id,
          analysis.unrecoveredError,
        );
        fields = merged.fields;
        conflicts = merged.conflicts;
        bundleWarnings = warningUnion([
          ...deterministic.warningCodes,
          ...analysis.warningCodes,
          ...fields.flatMap((field) => field.warningCodes),
        ]);
      }
      const requiredSourceReferenceIds = [
        ...new Set([
          ...deterministic.deterministicCandidates.flatMap(
            (candidate) => candidate.sourceReferenceIds,
          ),
          ...conflicts.flatMap((conflict) => conflict.sourceReferenceIds),
          ...fields.flatMap((field) => field.evidenceIds),
          ...Object.values(deterministic.operationSourceReferenceIds).flatMap((ids) => ids),
          ...deterministic.routingSourceReferenceIds,
          ...aiProposals.flatMap((proposal) =>
            Array.isArray(proposal.sourceReferenceIds)
              ? proposal.sourceReferenceIds.filter(
                  (reference): reference is string => typeof reference === "string",
                )
              : [],
          ),
        ]),
      ].sort(compareUnsignedUtf8);
      const serializedSourceReferenceIds = deterministic.sourceReferences
        .map(({ id }) => id)
        .sort(compareUnsignedUtf8);
      if (
        canonicalJson(requiredSourceReferenceIds) !== canonicalJson(serializedSourceReferenceIds)
      ) {
        const result = processingFailure(
          request,
          requestFingerprint,
          "SOURCE_REFERENCE_INVALID",
          "MERGE",
          sourceInventoryFingerprint,
          deterministic,
          analysisAttempts,
          aiProposals,
          fields,
          conflicts,
          aiInputExcerpts,
          aiInputCharacters,
        );
        retainEffective(result);
        return result;
      }
      let analysisResultFingerprint: string;
      let extractionId: string;
      try {
        analysisResultFingerprint = this.#derivedHash("ANALYSIS_RESULT", {
          analysisConfigurationFingerprint: request.analysisConfigurationFingerprint,
          validatedProposalPayloads: [...aiProposals].sort((left, right) =>
            compareUnsignedUtf8(canonicalJson(left), canonicalJson(right)),
          ),
          logicalAttemptPayloads: analysisAttempts
            .map((attempt) => logicalAnalysisAttempt(attempt))
            .sort((left, right) => compareUnsignedUtf8(canonicalJson(left), canonicalJson(right))),
        });
        extractionId = `ext_${this.#derivedHash("EXTRACTION_ID", {
          schemaVersion: request.schemaVersion,
          resourceVersionIdentityId: request.resourceVersionIdentityId,
          resourceVersionObservationId: request.resourceVersionObservationId,
          inputFingerprint,
          analysisResultFingerprint,
        })}`;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "CONTENT_DERIVED_ID_COLLISION")
          throw error;
        const result = processingFailure(
          request,
          requestFingerprint,
          "CONTENT_DERIVED_ID_COLLISION",
          "MERGE",
          sourceInventoryFingerprint,
          deterministic,
          analysisAttempts,
          aiProposals,
          fields,
          conflicts,
          aiInputExcerpts,
          aiInputCharacters,
        );
        retainEffective(result);
        return result;
      }
      const aggregateStatus = aggregate(fields);
      const laterProgressionBlockers = progressionBlockers(fields);
      const bundleWithoutOutput = {
        schemaVersion: request.schemaVersion,
        extractionId,
        requestFingerprint,
        inputFingerprint,
        m02: {
          handoffMarkerId: request.m02HandoffMarkerId,
          controllingM02JobId: request.controllingM02JobId,
          identityDecisionId: request.identityDecisionId,
          m02ReviewStateId: request.m02ReviewStateId,
          resourceCandidateId: request.resourceCandidateId,
          resourceIdentityId: request.resourceIdentityId,
          resourceVersionIdentityId: request.resourceVersionIdentityId,
          resourceVersionObservationId: request.resourceVersionObservationId,
          resourceSourceLinkId: request.resourceSourceLinkId,
          sourceRepositoryId: request.sourceRepositoryId,
          candidateRootId: request.candidateRootId,
          sourceSnapshotId: request.sourceSnapshotId,
          sourceRevision: request.sourceRevision,
          candidateContentFingerprint: request.candidateContentFingerprint,
          firstObservedSourceSnapshotId:
            loaded.predecessor.m02InputProjection.resourceVersionIdentity
              .firstObservedSourceSnapshotId,
          firstObservedSourceRevision:
            loaded.predecessor.m02InputProjection.resourceVersionIdentity
              .firstObservedSourceRevision,
        },
        expectedPredecessorState: request.expectedPredecessorState,
        policyVersions: request.policyVersions,
        analysisConfiguration: request.analysisConfiguration,
        analysisConfigurationFingerprint: request.analysisConfigurationFingerprint,
        analysisResultFingerprint,
        sourceInventoryFingerprint,
        sourceReferences: deterministic.sourceReferences,
        extractorRefs,
        deterministicCandidates: deterministic.deterministicCandidates,
        conflicts,
        analysisAttempts,
        aiProposals,
        fields,
        aggregateStatus,
        m04Bindability: "BINDABLE",
        laterProgressionBlockers,
        warningCodes: bundleWarnings,
        createdAt: this.#now(),
      };
      const { createdAt: _createdAt, ...bundleWithoutCreatedAt } = bundleWithoutOutput;
      void _createdAt;
      const logicalBundle = {
        ...bundleWithoutCreatedAt,
        analysisAttempts: bundleWithoutCreatedAt.analysisAttempts.map((attempt) =>
          logicalAnalysisAttempt(attempt),
        ),
      };
      let outputFingerprint: string;
      try {
        outputFingerprint = this.#derivedHash("OUTPUT_FINGERPRINT", logicalBundle);
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "CONTENT_DERIVED_ID_COLLISION")
          throw error;
        const result = processingFailure(
          request,
          requestFingerprint,
          "CONTENT_DERIVED_ID_COLLISION",
          "MERGE",
          sourceInventoryFingerprint,
          deterministic,
          analysisAttempts,
          aiProposals,
          fields,
          conflicts,
          aiInputExcerpts,
          aiInputCharacters,
        );
        retainEffective(result);
        return result;
      }
      const bundle = { ...bundleWithoutOutput, outputFingerprint };
      const validatedBundle = StructuredExtractionBundleV1Schema.safeParse(bundle);
      if (!validatedBundle.success) {
        const result = processingFailure(
          request,
          requestFingerprint,
          "FIELD_SCHEMA_INVALID",
          "MERGE",
          sourceInventoryFingerprint,
          deterministic,
          analysisAttempts,
          aiProposals,
          fields,
          conflicts,
          aiInputExcerpts,
          aiInputCharacters,
        );
        retainEffective(result);
        return result;
      }
      const finalControl = await readControl(request, loaded);
      if (finalControl !== null) {
        const result = terminalControlResult(
          request,
          requestFingerprint,
          finalControl,
          "FINAL_GUARD",
          sourceInventoryFingerprint,
          analysisAttempts,
          deterministic,
          aiProposals,
          fields,
          conflicts,
          aiInputExcerpts,
          aiInputCharacters,
        );
        retainEffective(result);
        return result;
      }
      const result = { kind: "BUNDLE", requestFingerprint, extractionId, bundle };
      retainEffective(result);
      return result;
    } finally {
      this.#inFlightByIdempotencyKey.delete(request.idempotencyKey);
      if (effectiveTupleKey !== null) this.#inFlightByEffectiveTuple.delete(effectiveTupleKey);
      releaseEffectiveController?.();
      releaseController?.();
    }
  }
}

async function readControl(
  request: ExtractionRequestV1,
  loaded: M03LoadedInput,
): Promise<"CANCELLED" | "SUPERSEDED_INPUT" | null> {
  const state = await loaded.checkControl();
  if (state.cancellationRequested) return "CANCELLED";
  if (
    eligibilityError(request, state) !== null ||
    canonicalJson(state) !== canonicalJson(loaded.predecessor)
  )
    return "SUPERSEDED_INPUT";
  return null;
}

function terminalControlResult(
  request: ExtractionRequestV1,
  requestFingerprint: string,
  code: "CANCELLED" | "SUPERSEDED_INPUT",
  lastCompletedStageOrNull: null | "DETERMINISTIC" | "ANALYSIS" | "FINAL_GUARD",
  sourceInventoryFingerprintOrNull: string | null,
  retainedAnalysisAttempts: readonly M03AnalysisAttemptV1[],
  deterministic?: ReturnType<typeof extractDeterministic>,
  aiProposals: readonly Readonly<Record<string, unknown>>[] = [],
  finalFields: readonly ExtractionFieldResultV1[] = deterministic?.fields ?? [],
  finalConflicts: readonly ExtractionConflictV1[] = deterministic?.conflicts ?? [],
  aiInputExcerpts = 0,
  aiInputCharacters = 0,
) {
  const observedCounts = buildObservedCounts(
    deterministic,
    retainedAnalysisAttempts,
    aiProposals,
    finalFields,
    finalConflicts,
    aiInputExcerpts,
    aiInputCharacters,
  );
  return {
    kind: code,
    requestFingerprint,
    errorCode: code,
    diagnostic: {
      lastCompletedStageOrNull,
      sourceInventoryFingerprintOrNull,
      deterministicCandidateCount: deterministic?.deterministicCandidates.length ?? 0,
      sourceReferenceCount: deterministic?.sourceReferences.length ?? 0,
      conflictCount: deterministic?.conflicts.length ?? 0,
      retainedAnalysisAttempts,
      warningCodes: deterministic?.warningCodes ?? [],
      observedCounts,
      safeContext: safeContext(request, lastCompletedStageOrNull ?? "ELIGIBILITY"),
    },
  };
}

function processingFailure(
  request: BasicExtractionRequestV1,
  requestFingerprint: string,
  errorCode:
    | "INPUT_FINGERPRINT_COLLISION"
    | "CONTENT_DERIVED_ID_COLLISION"
    | "SOURCE_REFERENCE_INVALID"
    | "DETERMINISTIC_PARSER_FAILED"
    | "ANALYSIS_CALL_PLAN_INVALID"
    | "FIELD_SCHEMA_INVALID",
  lastCompletedStageOrNull: null | "INVENTORY" | "DETERMINISTIC" | "ANALYSIS" | "MERGE",
  sourceInventoryFingerprintOrNull: string | null,
  deterministic?: ReturnType<typeof extractDeterministic>,
  retainedAnalysisAttempts: readonly M03AnalysisAttemptV1[] = [],
  aiProposals: readonly Readonly<Record<string, unknown>>[] = [],
  finalFields: readonly ExtractionFieldResultV1[] = deterministic?.fields ?? [],
  finalConflicts: readonly ExtractionConflictV1[] = deterministic?.conflicts ?? [],
  aiInputExcerpts = 0,
  aiInputCharacters = 0,
  limit?: { readonly name: "AI_CALLS"; readonly limit: number; readonly observed: number },
  actualAiCalls?: number,
) {
  const baseObservedCounts = buildObservedCounts(
    deterministic,
    retainedAnalysisAttempts,
    aiProposals,
    finalFields,
    finalConflicts,
    aiInputExcerpts,
    aiInputCharacters,
  );
  const observedCounts =
    actualAiCalls === undefined
      ? baseObservedCounts
      : { ...baseObservedCounts, aiCalls: actualAiCalls };
  return {
    kind: "FAILED",
    requestFingerprint,
    errorCode,
    diagnostic: {
      lastCompletedStageOrNull,
      sourceInventoryFingerprintOrNull,
      deterministicCandidateCount: deterministic?.deterministicCandidates.length ?? 0,
      sourceReferenceCount: deterministic?.sourceReferences.length ?? 0,
      conflictCount: finalConflicts.length,
      retainedAnalysisAttempts,
      warningCodes: deterministic?.warningCodes ?? [],
      observedCounts,
      safeContext:
        limit === undefined
          ? safeContext(request, lastCompletedStageOrNull ?? "ELIGIBILITY")
          : {
              ...safeContext(request, lastCompletedStageOrNull ?? "ELIGIBILITY"),
              recordKindOrNull: "LIMIT",
              limitNameOrNull: limit.name,
              limitOrNull: limit.limit,
              observedOrNull: limit.observed,
            },
    },
  };
}

type DeterministicResult = ReturnType<typeof extractDeterministic>;
type DeterministicLimitName =
  | "SOURCE_REFERENCES"
  | "EXTRACTOR_REFERENCES"
  | "DETERMINISTIC_CANDIDATES"
  | "CONFLICTS"
  | "WARNING_REFERENCES"
  | "LIST_ITEMS"
  | "EXACT_COMMANDS"
  | "EXACT_COMMAND_CHARACTERS"
  | "VALUE_SCHEMA_BOUND"
  | "FIELD_RESULTS";

function zeroFieldCounts(): Record<M03FieldKey, number> {
  return Object.fromEntries(M03_FIELD_KEYS.map((fieldKey) => [fieldKey, 0])) as Record<
    M03FieldKey,
    number
  >;
}

function listItemCounts(fields: readonly ExtractionFieldResultV1[]): Record<M03FieldKey, number> {
  const counts = zeroFieldCounts();
  for (const field of fields) {
    if (Array.isArray(field.value)) counts[field.fieldKey] = field.value.length;
    else if (field.fieldKey === "target_user_candidates") {
      const value = field.value as {
        targetUsers?: unknown[];
        bestFor?: unknown[];
        notIdealFor?: unknown[];
      };
      counts[field.fieldKey] =
        (value.targetUsers?.length ?? 0) +
        (value.bestFor?.length ?? 0) +
        (value.notIdealFor?.length ?? 0);
    } else if (field.fieldKey === "installation") {
      const paths =
        (
          field.value as {
            paths?: readonly {
              prerequisites?: readonly unknown[];
              commands?: readonly unknown[];
            }[];
          }
        ).paths ?? [];
      counts[field.fieldKey] =
        paths.length +
        paths.reduce(
          (sum, path) => sum + (path.prerequisites?.length ?? 0) + (path.commands?.length ?? 0),
          0,
        );
    }
  }
  return counts;
}

function exactCommands(
  fields: readonly ExtractionFieldResultV1[],
): readonly { readonly commandTextOrNull?: string | null }[] {
  const installation = fields.find((field) => field.fieldKey === "installation");
  const paths =
    (
      installation?.value as
        | {
            paths?: readonly {
              commands?: readonly { readonly commandTextOrNull?: string | null }[];
            }[];
          }
        | undefined
    )?.paths ?? [];
  return paths.flatMap((path) => path.commands ?? []);
}

function deterministicWarningReferences(deterministic: DeterministicResult | undefined): number {
  if (deterministic === undefined) return 0;
  return (
    deterministic.warningCodes.length +
    deterministic.deterministicCandidates.reduce(
      (sum, candidate) => sum + candidate.warningCodes.length,
      0,
    ) +
    deterministic.fields.reduce((sum, field) => sum + field.warningCodes.length, 0)
  );
}

function buildObservedCounts(
  deterministic: DeterministicResult | undefined,
  attempts: readonly M03AnalysisAttemptV1[],
  proposals: readonly Readonly<Record<string, unknown>>[],
  finalFields: readonly ExtractionFieldResultV1[],
  finalConflicts: readonly ExtractionConflictV1[],
  aiInputExcerpts: number,
  aiInputCharacters: number,
) {
  const deterministicListItems = listItemCounts(deterministic?.fields ?? []);
  const finalListItems = listItemCounts(finalFields);
  const aiProjectedListItems = zeroFieldCounts();
  for (const fieldKey of M03_FIELD_KEYS)
    aiProjectedListItems[fieldKey] = Math.max(
      0,
      finalListItems[fieldKey] - deterministicListItems[fieldKey],
    );
  const proposalWarnings = proposals.reduce(
    (count, proposal) =>
      count + (Array.isArray(proposal.warningCodes) ? proposal.warningCodes.length : 0),
    0,
  );
  return {
    sourceReferences: deterministic?.sourceReferences.length ?? 0,
    extractorReferences: deterministic?.extractorRefs.length ?? 0,
    deterministicCandidates: deterministic?.deterministicCandidates.length ?? 0,
    deterministicConflicts: deterministic?.conflicts.length ?? 0,
    deterministicWarningReferences: deterministicWarningReferences(deterministic),
    deterministicListItemsByField: deterministicListItems,
    exactCommands: exactCommands(deterministic?.fields ?? []).length,
    aiProposalCharactersMaximum: proposals.reduce(
      (maximum, proposal) => Math.max(maximum, Array.from(canonicalJson(proposal)).length),
      0,
    ),
    aiProposals: proposals.length,
    aiProjectedConflicts: Math.max(
      0,
      finalConflicts.length - (deterministic?.conflicts.length ?? 0),
    ),
    aiProjectedWarningReferences: proposalWarnings,
    aiProjectedListItemsByField: aiProjectedListItems,
    aiCalls: attempts.length,
    aiInputExcerpts,
    aiInputCharacters,
  };
}

function findDeterministicLimit(deterministic: DeterministicResult): {
  readonly name: DeterministicLimitName;
  readonly limit: number;
  readonly observed: number;
} | null {
  const commands = exactCommands(deterministic.fields);
  const maximumCommandCharacters = commands.reduce(
    (maximum, command) => Math.max(maximum, Array.from(command.commandTextOrNull ?? "").length),
    0,
  );
  const maximumListItems = Math.max(...Object.values(listItemCounts(deterministic.fields)));
  const scalarBounds: Readonly<Record<string, number>> = {
    normalizedName: 200,
    displayName: 200,
    normalizedHandleOrNull: 200,
    versionLabel: 200,
    normalizedVersionOrNull: 200,
    providerRepositoryId: 200,
    spdxExpressionOrNull: 200,
    label: 200,
    normalizedLabel: 200,
    taxonomyIdOrNull: 200,
    text: 1000,
    normalizedKey: 1000,
    languageTagOrNull: 50,
    labelOrNull: 200,
    startConditionOrNull: 1000,
    inferredMechanismOrNull: 1000,
    completionCueOrNull: 1000,
    name: 200,
    defaultValueOrNull: 1000,
    declaredConstraintOrNull: 200,
    serviceName: 200,
    normalizedServiceName: 200,
    scopeOrNull: 500,
    subject: 200,
    normalizedSubject: 200,
    constraintOrNull: 200,
    currentChangelogEntryOrNull: 200,
  };
  const scalarViolation = (
    value: unknown,
    memberName: string | null = null,
  ): { readonly limit: number; readonly observed: number } | null => {
    if (typeof value === "string") {
      const limit = memberName === "prerequisites" ? 1000 : scalarBounds[memberName ?? ""];
      const observed = Array.from(value).length;
      return limit !== undefined && observed > limit ? { limit, observed } : null;
    }
    if (Array.isArray(value)) {
      for (const member of value) {
        const violation = scalarViolation(member, memberName);
        if (violation !== null) return violation;
      }
      return null;
    }
    if (value !== null && typeof value === "object")
      for (const [key, member] of Object.entries(value)) {
        const violation = scalarViolation(member, key);
        if (violation !== null) return violation;
      }
    return null;
  };
  const valueViolation = deterministic.deterministicCandidates
    .map(({ value }) => scalarViolation(value))
    .find((violation) => violation !== null);
  const checks: readonly {
    readonly name: DeterministicLimitName;
    readonly limit: number;
    readonly observed: number;
  }[] = [
    { name: "SOURCE_REFERENCES", limit: 4096, observed: deterministic.sourceReferences.length },
    { name: "EXTRACTOR_REFERENCES", limit: 128, observed: deterministic.extractorRefs.length },
    {
      name: "DETERMINISTIC_CANDIDATES",
      limit: 8192,
      observed: deterministic.deterministicCandidates.length,
    },
    { name: "CONFLICTS", limit: 1024, observed: deterministic.conflicts.length },
    {
      name: "WARNING_REFERENCES",
      limit: 2048,
      observed: deterministicWarningReferences(deterministic),
    },
    { name: "FIELD_RESULTS", limit: M03_FIELD_KEYS.length, observed: deterministic.fields.length },
    { name: "LIST_ITEMS", limit: 256, observed: maximumListItems },
    { name: "EXACT_COMMANDS", limit: 256, observed: commands.length },
    { name: "EXACT_COMMAND_CHARACTERS", limit: 8000, observed: maximumCommandCharacters },
    ...(valueViolation === undefined
      ? []
      : [
          {
            name: "VALUE_SCHEMA_BOUND" as const,
            limit: valueViolation.limit,
            observed: valueViolation.observed,
          },
        ]),
  ];
  return (
    checks.find(
      (check) =>
        check.observed > check.limit ||
        (check.name === "FIELD_RESULTS" && check.observed !== check.limit),
    ) ?? null
  );
}

function deterministicLimitFailure(
  request: ExtractionRequestV1,
  requestFingerprint: string,
  sourceInventoryFingerprint: string,
  deterministic: DeterministicResult,
  limit: {
    readonly name: DeterministicLimitName;
    readonly limit: number;
    readonly observed: number;
  },
) {
  return {
    kind: "FAILED",
    requestFingerprint,
    errorCode:
      limit.name === "FIELD_RESULTS" ? "FIELD_REGISTRY_INCOMPLETE" : "DETERMINISTIC_LIMIT_EXCEEDED",
    diagnostic: {
      lastCompletedStageOrNull: "DETERMINISTIC",
      sourceInventoryFingerprintOrNull: sourceInventoryFingerprint,
      deterministicCandidateCount: deterministic.deterministicCandidates.length,
      sourceReferenceCount: deterministic.sourceReferences.length,
      conflictCount: deterministic.conflicts.length,
      retainedAnalysisAttempts: [],
      warningCodes: deterministic.warningCodes,
      observedCounts: {
        sourceReferences: deterministic.sourceReferences.length,
        extractorReferences: deterministic.extractorRefs.length,
        deterministicCandidates: deterministic.deterministicCandidates.length,
        deterministicConflicts: deterministic.conflicts.length,
        deterministicWarningReferences: deterministicWarningReferences(deterministic),
        deterministicListItemsByField: listItemCounts(deterministic.fields),
        exactCommands: exactCommands(deterministic.fields).length,
        aiProposalCharactersMaximum: 0,
        aiProposals: 0,
        aiProjectedConflicts: 0,
        aiProjectedWarningReferences: 0,
        aiProjectedListItemsByField: zeroFieldCounts(),
        aiCalls: 0,
        aiInputExcerpts: 0,
        aiInputCharacters: 0,
      },
      safeContext: {
        ...safeContext(request, "DETERMINISTIC"),
        recordKindOrNull: "LIMIT",
        limitNameOrNull: limit.name,
        limitOrNull: limit.limit,
        observedOrNull: limit.observed,
      },
    },
  };
}

function warningUnion(values: readonly string[]): M03WarningCode[] {
  const order = [
    "SOURCE_CORPUS_INCOMPLETE",
    "SOURCE_DISPOSITION_EXCLUDED",
    "PREDECESSOR_METADATA_INSUFFICIENT",
    "ATTRIBUTION_TYPE_UNPROVEN",
    "MULTIPLE_EXPLICIT_VALUES",
    "NORMALIZATION_LOSS",
    "TAXONOMY_CANDIDATE",
    "DEPENDENCY_INCOMPLETE",
    "TRANSITIVE_DEPENDENCY_NOT_RESOLVED",
    "UNRECOGNIZED_MANIFEST",
    "DETERMINISTIC_DECLARATION_INVALID",
    "UNSUPPORTED_LICENSE_IDENTIFIER",
    "UNSUPPORTED_STATIC_LANGUAGE",
    "PERMISSION_NOT_PROVEN_ABSENT",
    "COMPATIBILITY_NOT_RUNTIME_VERIFIED",
    "INSTALL_COMMAND_UNSAFE",
    "INSTALL_CONTEXT_INCOMPLETE",
    "INSTALL_PATH_KINDS_MIXED",
    "SECRET_LIKE_COMMAND_WITHHELD",
    "SECRET_LIKE_VALUE_WITHHELD",
    "CONFIGURATION_TYPE_UNKNOWN",
    "SENSITIVE_CONFIGURATION_DEFAULT_WITHHELD",
    "PERSONAL_CONTACT_WITHHELD",
    "AI_INPUT_BOUNDED",
    "AI_OUTPUT_REPAIRED",
    "AI_OUTPUT_REJECTED",
    "LOW_CONFIDENCE",
    "ARCHIVED_SOURCE",
    "NO_KNOWN_LIMITATION_NOT_PROVEN",
  ] as const;
  const present = new Set(values);
  return order.filter((warning) => present.has(warning));
}

function logicalAnalysisAttempt(attempt: M03AnalysisAttemptV1): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(attempt).filter(
      ([key]) =>
        !["durationMsOrNull", "tokenCountsOrNull", "providerRequestIdOrNull"].includes(key),
    ),
  );
}

function mergeAnalysisFields(
  deterministicFields: readonly ExtractionFieldResultV1[],
  deterministicConflicts: readonly ExtractionConflictV1[],
  proposals: readonly Readonly<Record<string, unknown>>[],
  aiExtractorRefId: string,
  unrecoveredError: boolean,
): {
  readonly fields: readonly ExtractionFieldResultV1[];
  readonly conflicts: readonly ExtractionConflictV1[];
} {
  const aiOwned = new Set([
    "outcome_candidate",
    "capabilities",
    "tasks",
    "use_cases",
    "target_user_candidates",
    "permissions",
    "limitations",
  ]);
  const mergedFields: readonly ExtractionFieldResultV1[] = deterministicFields.map(
    (field): ExtractionFieldResultV1 => {
      if (!aiOwned.has(field.fieldKey)) return field;
      const fieldProposals = proposals.filter(
        (proposal) =>
          proposal.kind === "FIELD_PROPOSAL" && proposal.targetFieldKey === field.fieldKey,
      );
      if (unrecoveredError) {
        if (["EXPLICIT", "STRONGLY_SUPPORTED", "INFERRED", "CONFLICTING"].includes(field.status)) {
          return {
            ...field,
            warningCodes: warningUnion([...field.warningCodes, "AI_OUTPUT_REJECTED"]),
          };
        }
        return emptyReview(field, aiExtractorRefId, ["AI_OUTPUT_REJECTED"]);
      }
      const selected = fieldProposals.filter(
        (proposal) => typeof proposal.confidence === "number" && proposal.confidence >= 0.6,
      );
      const low = fieldProposals.some(
        (proposal) => typeof proposal.confidence === "number" && proposal.confidence < 0.6,
      );
      if (selected.length === 0) {
        if (low) {
          if (["EXPLICIT", "STRONGLY_SUPPORTED", "INFERRED", "CONFLICTING"].includes(field.status))
            return {
              ...field,
              warningCodes: warningUnion([...field.warningCodes, "LOW_CONFIDENCE"]),
            };
          return emptyReview(field, aiExtractorRefId, ["LOW_CONFIDENCE"]);
        }
        if (["MISSING", "UNSUPPORTED", "REVIEW_REQUIRED"].includes(field.status)) {
          return {
            ...field,
            extractorRefs: [...new Set([...field.extractorRefs, aiExtractorRefId])].sort(),
          };
        }
        return field;
      }
      const confidence = Math.min(
        ...selected.map((proposal) => proposal.confidence as number),
        field.confidence ?? 1,
      );
      const aiIds = selected.map((proposal) => String(proposal.id)).sort();
      const evidenceIds = [
        ...new Set([
          ...field.evidenceIds,
          ...selected.flatMap((proposal) => proposal.sourceReferenceIds as readonly string[]),
        ]),
      ].sort();
      const proposalWarnings = warningUnion(
        selected.flatMap((proposal) => proposal.warningCodes as readonly string[]),
      );
      let value: unknown;
      if (field.fieldKey === "outcome_candidate") value = selected[0]?.value ?? null;
      else if (field.fieldKey === "target_user_candidates") {
        const base = field.value as {
          targetUsers: unknown[];
          bestFor: unknown[];
          notIdealFor: unknown[];
        };
        value = {
          targetUsers: reconcileAnalysisValues("target_user_candidates", [
            ...base.targetUsers,
            ...selected
              .filter(
                (proposal) =>
                  (proposal.value as { proposalKind?: string }).proposalKind === "TARGET_USER",
              )
              .map((proposal) => proposal.value),
          ]),
          bestFor: reconcileAnalysisValues("target_user_candidates", [
            ...base.bestFor,
            ...selected
              .filter(
                (proposal) =>
                  (proposal.value as { proposalKind?: string }).proposalKind === "BEST_FOR",
              )
              .map((proposal) => proposal.value),
          ]),
          notIdealFor: reconcileAnalysisValues("target_user_candidates", [
            ...base.notIdealFor,
            ...selected
              .filter(
                (proposal) =>
                  (proposal.value as { proposalKind?: string }).proposalKind === "NOT_IDEAL_FOR",
              )
              .map((proposal) => proposal.value),
          ]),
        };
      } else {
        const base: readonly unknown[] = Array.isArray(field.value)
          ? (field.value as readonly unknown[])
          : [];
        value = reconcileAnalysisValues(field.fieldKey, [
          ...base,
          ...selected.map((proposal): unknown => proposal.value),
        ]);
      }
      return {
        ...field,
        value,
        status: confidence >= 0.85 ? "STRONGLY_SUPPORTED" : "INFERRED",
        claimClass: field.deterministicCandidateIds.length > 0 ? "MIXED_SUPPORT" : "AI_INFERENCE",
        confidence,
        aiProposalIds: [...new Set([...field.aiProposalIds, ...aiIds])].sort(),
        evidenceIds,
        warningCodes: warningUnion([...field.warningCodes, ...proposalWarnings]),
        extractorRefs: [...new Set([...field.extractorRefs, aiExtractorRefId])].sort(),
      };
    },
  );
  const conflicts = [...deterministicConflicts];
  const fieldByKey = new Map(mergedFields.map((field) => [field.fieldKey, field]));
  for (const proposal of proposals) {
    if (
      proposal.kind !== "AMBIGUITY_SIGNAL" ||
      (proposal.reason !== "MULTIPLE_INTERPRETATIONS" &&
        proposal.reason !== "DETERMINISTIC_AI_DISAGREEMENT")
    )
      continue;
    const fieldKey = proposal.targetFieldKey as M03FieldKey;
    const candidateIds = [...(proposal.candidateIds as readonly string[])].sort();
    const aiProposalIds = [...(proposal.interpretedAIProposalIds as readonly string[])].sort();
    const sourceReferenceIds = [...(proposal.sourceReferenceIds as readonly string[])].sort();
    const conflictRecord = {
      fieldKey,
      reasonCode:
        proposal.reason === "MULTIPLE_INTERPRETATIONS"
          ? ("AI_MULTIPLE_INTERPRETATIONS" as const)
          : ("AI_DETERMINISTIC_DISAGREEMENT" as const),
      candidateIds,
      aiProposalIds,
      preferredCandidateIdOrNull: null,
      preferenceIsNonCanonicalGuidance: false as const,
      sourceReferenceIds,
    };
    const conflict: ExtractionConflictV1 = {
      ...conflictRecord,
      id: `conf_${sha256Hex(canonicalJson(conflictRecord))}`,
    };
    conflicts.push(conflict);
    const prior = fieldByKey.get(fieldKey);
    if (prior === undefined) continue;
    const result: ExtractionFieldResultV1 = {
      ...prior,
      value: conflictValue(fieldKey),
      status: "CONFLICTING",
      claimClass: candidateIds.length > 0 ? "MIXED_SUPPORT" : "AI_INFERENCE",
      confidence: null,
      deterministicCandidateIds: candidateIds,
      aiProposalIds,
      evidenceIds: sourceReferenceIds,
      conflictIds: [conflict.id],
      extractorRefs: [...new Set([...prior.extractorRefs, aiExtractorRefId])].sort(),
    };
    fieldByKey.set(fieldKey, result);
  }
  const reconciledFields = mergedFields.map((field) => fieldByKey.get(field.fieldKey) ?? field);
  const deterministicFieldByKey = new Map(
    deterministicFields.map((field) => [field.fieldKey, field]),
  );
  const fields = reconciledFields.map((field) => {
    const deterministic = deterministicFieldByKey.get(field.fieldKey);
    if (
      deterministic === undefined ||
      (!deterministic.warningCodes.includes("SECRET_LIKE_VALUE_WITHHELD") &&
        !deterministic.warningCodes.includes("PERSONAL_CONTACT_WITHHELD")) ||
      field.status === "CONFLICTING"
    )
      return field;
    return deterministic;
  });
  return {
    fields,
    conflicts: conflicts.sort(
      (left, right) =>
        M03_FIELD_KEYS.indexOf(left.fieldKey) - M03_FIELD_KEYS.indexOf(right.fieldKey) ||
        Buffer.from(left.reasonCode).compare(Buffer.from(right.reasonCode)) ||
        Buffer.from(canonicalJson(left.candidateIds)).compare(
          Buffer.from(canonicalJson(right.candidateIds)),
        ) ||
        compareUnsignedUtf8(left.id, right.id),
    ),
  };
}

function stripAnalysisValueProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAnalysisValueProvenance);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([key]) => key !== "sourceReferenceIds" && key !== "sourceAIProposalIdOrNull")
      .map(([key, member]) => [key, stripAnalysisValueProvenance(member)]),
  );
}

function analysisValueSortKey(fieldKey: M03FieldKey, value: unknown): string {
  const item = value as Readonly<Record<string, unknown>>;
  if (fieldKey === "permissions")
    return canonicalJson([item.kind, item.scopeOrNull ?? "", item.evidenceLevel]);
  if (fieldKey === "limitations") return canonicalJson([item.normalizedKey, item.kind]);
  return canonicalJson([
    item.normalizedKey ?? "",
    item.proposalKind ?? "",
    item.sourceReferenceIds ?? [],
    item.sourceAIProposalIdOrNull ?? "",
  ]);
}

function reconcileAnalysisValues(fieldKey: M03FieldKey, values: readonly unknown[]): unknown[] {
  const groups = new Map<string, unknown[]>();
  for (const value of values) {
    const key = canonicalJson(stripAnalysisValueProvenance(value));
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => {
      const first = [...group].sort((left, right) =>
        compareUnsignedUtf8(canonicalJson(left), canonicalJson(right)),
      )[0] as Readonly<Record<string, unknown>>;
      const sourceReferenceIds = [
        ...new Set(
          group.flatMap((value) =>
            Array.isArray((value as { sourceReferenceIds?: unknown }).sourceReferenceIds)
              ? (value as { sourceReferenceIds: string[] }).sourceReferenceIds
              : [],
          ),
        ),
      ].sort(compareUnsignedUtf8);
      return { ...first, sourceReferenceIds };
    })
    .sort((left, right) =>
      compareUnsignedUtf8(
        analysisValueSortKey(fieldKey, left),
        analysisValueSortKey(fieldKey, right),
      ),
    );
}

function conflictValue(fieldKey: M03FieldKey): unknown {
  if (fieldKey === "outcome_candidate" || fieldKey === "canonical_skill_name") return null;
  if (fieldKey === "target_user_candidates")
    return { targetUsers: [], bestFor: [], notIdealFor: [] };
  if (fieldKey === "version")
    return { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null };
  if (fieldKey === "license")
    return { state: "CONFLICTING", selectedOrNull: null, preferredCandidateIdOrNull: null };
  if (fieldKey === "installation") return { state: "UNSAFE_OR_AMBIGUOUS", paths: [] };
  return [];
}

function emptyReview(
  field: ExtractionFieldResultV1,
  aiExtractorRefId: string,
  warningCodes: readonly string[],
): ExtractionFieldResultV1 {
  const empty =
    field.fieldKey === "outcome_candidate"
      ? null
      : field.fieldKey === "target_user_candidates"
        ? { targetUsers: [], bestFor: [], notIdealFor: [] }
        : [];
  return {
    ...field,
    value: empty,
    status: "REVIEW_REQUIRED",
    claimClass: "NO_CLAIM",
    confidence: null,
    deterministicCandidateIds: [],
    aiProposalIds: [],
    evidenceIds: [],
    conflictIds: [],
    warningCodes: warningUnion([...field.warningCodes, ...warningCodes]),
    extractorRefs: [...new Set([...field.extractorRefs, aiExtractorRefId])].sort(),
  };
}

function aggregate(
  fields: readonly { readonly fieldKey: string; readonly status: string }[],
): "COMPLETED" | "COMPLETED_WITH_CONFLICTS" | "COMPLETED_REVIEW_REQUIRED" | "UNSUPPORTED" {
  const attributionStatus = attributionGroupStatus(fields);
  if (
    fields.some((field) => materialFields.has(field.fieldKey) && field.status === "UNSUPPORTED") ||
    attributionStatus === "UNSUPPORTED"
  )
    return "UNSUPPORTED";
  if (
    fields.some((field) => field.status === "REVIEW_REQUIRED") ||
    attributionStatus === "REVIEW_REQUIRED"
  )
    return "COMPLETED_REVIEW_REQUIRED";
  if (fields.some((field) => field.status === "CONFLICTING") || attributionStatus === "CONFLICTING")
    return "COMPLETED_WITH_CONFLICTS";
  return "COMPLETED";
}

type BlockingStatus = "MISSING" | "CONFLICTING" | "UNSUPPORTED" | "REVIEW_REQUIRED";

function attributionGroupStatus(
  fields: readonly { readonly fieldKey: string; readonly status: string }[],
): BlockingStatus | null {
  const creator = fields.find((field) => field.fieldKey === "creator_candidates")?.status;
  const organization = fields.find((field) => field.fieldKey === "organization_candidates")?.status;
  if (creator === "REVIEW_REQUIRED" || organization === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (creator === "CONFLICTING" || organization === "CONFLICTING") return "CONFLICTING";
  const bothNonPositive = [creator, organization].every((status) =>
    ["MISSING", "UNSUPPORTED"].includes(status ?? ""),
  );
  if (!bothNonPositive) return null;
  if (creator === "UNSUPPORTED" || organization === "UNSUPPORTED") return "UNSUPPORTED";
  return "MISSING";
}

function progressionBlockers(
  fields: readonly { readonly fieldKey: M03FieldKey; readonly status: string }[],
): readonly {
  readonly blockerKey: M03FieldKey | "ATTRIBUTION_GROUP";
  readonly status: BlockingStatus;
}[] {
  const attributionStatus = attributionGroupStatus(fields);
  const blockers: { blockerKey: M03FieldKey | "ATTRIBUTION_GROUP"; status: BlockingStatus }[] = [];
  for (const field of fields) {
    if (field.fieldKey === "creator_candidates") {
      if (attributionStatus !== null)
        blockers.push({ blockerKey: "ATTRIBUTION_GROUP", status: attributionStatus });
      continue;
    }
    if (field.fieldKey === "organization_candidates") continue;
    if (
      materialFields.has(field.fieldKey) &&
      ["MISSING", "CONFLICTING", "UNSUPPORTED", "REVIEW_REQUIRED"].includes(field.status)
    )
      blockers.push({ blockerKey: field.fieldKey, status: field.status as BlockingStatus });
  }
  return blockers;
}

export function m03FieldRegistryOrder(): readonly string[] {
  return M03_FIELD_KEYS;
}
