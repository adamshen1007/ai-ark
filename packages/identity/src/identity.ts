import { isIP } from "node:net";

import {
  canonicalM02JsonBytes,
  fingerprintM02Payload,
  normalizeIdentityToken,
} from "@ai-ark/classification";
import type { IdentityOutcome, Role } from "@ai-ark/contracts";

export type IdentityManualResolutionCommand =
  | "CREATE_RESOURCE"
  | "ATTACH_NEW_VERSION"
  | "MARK_FORK"
  | "MARK_MIRROR"
  | "MARK_DUPLICATE"
  | "REJECT_CANDIDATE"
  | "SPLIT_ROOTS"
  | "MERGE_ROOTS"
  | "OVERRIDE_NON_SKILL"
  | "REQUEST_CLARIFICATION"
  | "RESOLVE_AMBIGUITY"
  | "REPLACE_M02_JOB";

const githubNamespacePattern = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const hashPattern = /^[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{12,}$/;
const unicode151WhiteSpace = new Set([
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002,
  0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f,
  0x3000,
]);

// Official Unicode DerivedAge.txt ranges assigned after 15.1. The repository pins Node 22.23.1
// (Unicode 17), so rejecting these ranges prevents runtime IDNA tables from widening external-id-v1.
const postUnicode151Ranges: readonly (readonly [number, number])[] = [
  [0x088f, 0x088f],
  [0x0897, 0x0897],
  [0x0c5c, 0x0c5c],
  [0x0cdc, 0x0cdc],
  [0x1acf, 0x1add],
  [0x1ae0, 0x1aeb],
  [0x1b4e, 0x1b4f],
  [0x1b7f, 0x1b7f],
  [0x1c89, 0x1c8a],
  [0x20c1, 0x20c1],
  [0x2427, 0x2429],
  [0x2b96, 0x2b96],
  [0x31e4, 0x31e5],
  [0xa7cb, 0xa7cf],
  [0xa7d2, 0xa7d2],
  [0xa7d4, 0xa7d4],
  [0xa7da, 0xa7dc],
  [0xa7f1, 0xa7f1],
  [0xfbc3, 0xfbd2],
  [0xfd90, 0xfd91],
  [0xfdc8, 0xfdce],
  [0x105c0, 0x105f3],
  [0x10940, 0x10959],
  [0x10d40, 0x10d65],
  [0x10d69, 0x10d85],
  [0x10d8e, 0x10d8f],
  [0x10ec2, 0x10ec7],
  [0x10ed0, 0x10ed8],
  [0x10efa, 0x10efc],
  [0x11380, 0x11389],
  [0x1138b, 0x1138b],
  [0x1138e, 0x1138e],
  [0x11390, 0x113b5],
  [0x113b7, 0x113c0],
  [0x113c2, 0x113c2],
  [0x113c5, 0x113c5],
  [0x113c7, 0x113ca],
  [0x113cc, 0x113d5],
  [0x113d7, 0x113d8],
  [0x113e1, 0x113e2],
  [0x116d0, 0x116e3],
  [0x11b60, 0x11b67],
  [0x11bc0, 0x11be1],
  [0x11bf0, 0x11bf9],
  [0x11db0, 0x11ddb],
  [0x11de0, 0x11de9],
  [0x11f5a, 0x11f5a],
  [0x13460, 0x143fa],
  [0x16100, 0x16139],
  [0x16d40, 0x16d79],
  [0x16ea0, 0x16eb8],
  [0x16ebb, 0x16ed3],
  [0x16ff2, 0x16ff6],
  [0x187f8, 0x187ff],
  [0x18cff, 0x18cff],
  [0x18d09, 0x18d1e],
  [0x18d80, 0x18df2],
  [0x1cc00, 0x1ccfc],
  [0x1cd00, 0x1ceb3],
  [0x1ceba, 0x1ced0],
  [0x1cee0, 0x1cef0],
  [0x1e5d0, 0x1e5fa],
  [0x1e5ff, 0x1e5ff],
  [0x1e6c0, 0x1e6de],
  [0x1e6e0, 0x1e6f5],
  [0x1e6fe, 0x1e6ff],
  [0x1f6d8, 0x1f6d8],
  [0x1f777, 0x1f77a],
  [0x1f8b2, 0x1f8bb],
  [0x1f8c0, 0x1f8c1],
  [0x1f8d0, 0x1f8d8],
  [0x1fa54, 0x1fa57],
  [0x1fa89, 0x1fa8a],
  [0x1fa8e, 0x1fa8f],
  [0x1fabe, 0x1fabe],
  [0x1fac6, 0x1fac6],
  [0x1fac8, 0x1fac8],
  [0x1facd, 0x1facd],
  [0x1fadc, 0x1fadc],
  [0x1fadf, 0x1fadf],
  [0x1fae9, 0x1faea],
  [0x1faef, 0x1faef],
  [0x1fbcb, 0x1fbef],
  [0x1fbfa, 0x1fbfa],
  [0x2b73a, 0x2b73f],
  [0x2cea2, 0x2cead],
  [0x323b0, 0x33479],
];

export function isUnicode151Scalar(codePoint: number): boolean {
  if (
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
  )
    return false;
  return !postUnicode151Ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
}

function assertUnicode151(value: string): void {
  if (Array.from(value).some((character) => !isUnicode151Scalar(character.codePointAt(0) ?? -1))) {
    throw new TypeError("Unicode 15.1 policy violation");
  }
}

function trimUnicode151WhiteSpace(value: string): string {
  const scalars = Array.from(value);
  let start = 0;
  let end = scalars.length;
  while (start < end && unicode151WhiteSpace.has(scalars[start]?.codePointAt(0) ?? -1)) start += 1;
  while (end > start && unicode151WhiteSpace.has(scalars[end - 1]?.codePointAt(0) ?? -1)) end -= 1;
  return scalars.slice(start, end).join("");
}

export function normalizeGithubNamespace(value: string): string {
  assertUnicode151(value);
  const normalized = trimUnicode151WhiteSpace(value.normalize("NFKC")).toLowerCase();
  if (!githubNamespacePattern.test(normalized)) {
    throw new TypeError("invalid external-id-v1 GitHub namespace");
  }
  return normalized;
}

export function normalizeGithubIssuer(value: string): string {
  try {
    assertUnicode151(value);
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.search !== "" ||
      parsed.hash !== "" ||
      (parsed.pathname !== "" && parsed.pathname !== "/") ||
      (parsed.port !== "" && parsed.port !== "443") ||
      parsed.hostname === "" ||
      isIP(parsed.hostname.replace(/^\[|\]$/gu, "")) !== 0
    ) {
      throw new Error("invalid");
    }
    const hostname = parsed.hostname.replace(/\.$/u, "").toLowerCase();
    const labels = hostname.split(".");
    if (
      hostname.length > 253 ||
      labels.some(
        (label) =>
          label.length < 1 ||
          label.length > 63 ||
          !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
      )
    )
      throw new Error("invalid");
    return hostname;
  } catch {
    throw new TypeError("INVALID_EXTERNAL_IDENTIFIER_ISSUER");
  }
}

export interface ExternalIdentifierKeyInput {
  readonly provider: "github";
  readonly issuer: string;
  readonly namespace: string;
  readonly identifierType: "PROVIDER_REPOSITORY_ID" | "DECLARED_MANIFEST_ID";
  readonly normalizedValue: string;
  readonly normalizationPolicyVersion: "external-id-v1";
}

export function createExternalIdentifierKey(input: ExternalIdentifierKeyInput) {
  const provider: string = input.provider;
  if (provider !== "github") throw new TypeError("external-id-v1 provider must be github");
  const normalizedValue =
    input.identifierType === "DECLARED_MANIFEST_ID"
      ? normalizeIdentityToken(input.normalizedValue)?.normalized
      : input.normalizedValue.normalize("NFC");
  if (
    normalizedValue === undefined ||
    normalizedValue.length === 0 ||
    (input.identifierType === "PROVIDER_REPOSITORY_ID" &&
      (normalizedValue !== trimUnicode151WhiteSpace(normalizedValue) ||
        /\p{Cc}/u.test(normalizedValue)))
  )
    throw new TypeError("invalid external identifier value");
  const payload = {
    provider: input.provider,
    issuer: normalizeGithubIssuer(input.issuer),
    namespace: normalizeGithubNamespace(input.namespace),
    identifierType: input.identifierType,
    normalizedValue,
    normalizationPolicyVersion: input.normalizationPolicyVersion,
  } as const;
  return {
    payload,
    canonicalPayload: canonicalM02JsonBytes(payload),
    fingerprint: fingerprintM02Payload(payload),
  };
}

export type IdentityTier = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export interface IdentityMatch {
  readonly tier: IdentityTier;
  readonly resourceIdentityId: string;
  readonly contentEqual: boolean;
  readonly reviewed?: boolean;
  readonly providerFork?: boolean;
  readonly relationshipKind?: "FORK" | "MIRROR";
  readonly exactSourceLink?: boolean;
  readonly upstreamExact?: boolean;
  readonly trustedScopedKey?: boolean;
  readonly provenanceType?: "M01_PROVIDER_ASSERTED" | "HUMAN_VERIFIED_SOURCE_DECLARATION";
  readonly reviewState?: "UNREVIEWED" | "VERIFIED" | "REJECTED" | "SUPERSEDED";
}

export interface ResolveIdentityInput {
  readonly reliableNameToken: string | null;
  readonly matches: readonly IdentityMatch[];
}

export interface IdentityResolution {
  readonly outcome: IdentityOutcome | "EXACT_REPEAT_REUSE";
  readonly matchedTier: IdentityTier | null;
  readonly resourceIdentityId: string | null;
  readonly confidence: null;
  readonly reviewRequired: boolean;
}

export function resolveIdentity(input: ResolveIdentityInput): IdentityResolution {
  const upstreamRelationships = input.matches.filter(
    (match) => match.tier === "P3" && match.upstreamExact === true,
  );
  const upstreamRelationship = upstreamRelationships[0];
  const untrustedManifest = input.matches.find(
    (match) =>
      match.tier === "P2" &&
      match.provenanceType === "HUMAN_VERIFIED_SOURCE_DECLARATION" &&
      (match.reviewState !== "VERIFIED" || match.trustedScopedKey !== true),
  );
  const strong = input.matches.filter((match) => {
    if (match.tier === "P1") return match.exactSourceLink === true;
    if (match.tier === "P2") {
      const provenanceTrusted =
        match.provenanceType === "M01_PROVIDER_ASSERTED" ||
        (match.provenanceType === "HUMAN_VERIFIED_SOURCE_DECLARATION" &&
          match.reviewState === "VERIFIED");
      return provenanceTrusted && match.trustedScopedKey === true;
    }
    return false;
  });
  const strongTargets = new Set(strong.map((match) => match.resourceIdentityId));
  const upstreamTargets = new Set(upstreamRelationships.map((match) => match.resourceIdentityId));
  const upstreamOutcomes = new Set(
    upstreamRelationships.map((match) =>
      match.relationshipKind === "MIRROR"
        ? match.contentEqual
          ? "MIRROR"
          : "AMBIGUOUS_IDENTITY"
        : "FORK_OF_EXISTING_RESOURCE",
    ),
  );
  if (
    upstreamTargets.size > 1 ||
    upstreamOutcomes.size > 1 ||
    upstreamOutcomes.has("AMBIGUOUS_IDENTITY")
  ) {
    return decision("AMBIGUOUS_IDENTITY", null, null, true);
  }
  if (strongTargets.size > 1) {
    return decision("AMBIGUOUS_IDENTITY", null, null, true);
  }
  const unresolvedReviewTargets = new Set(
    [upstreamRelationship, untrustedManifest]
      .filter((match): match is IdentityMatch => match !== undefined)
      .map((match) => match.resourceIdentityId),
  );
  if (
    strongTargets.size === 1 &&
    (upstreamRelationships.length > 0 ||
      [...unresolvedReviewTargets].some((target) => !strongTargets.has(target)))
  ) {
    return decision("AMBIGUOUS_IDENTITY", null, null, true);
  }
  const strongest = [...strong].sort((a, b) => a.tier.localeCompare(b.tier))[0];
  if (strongest) {
    return decision(
      strongest.contentEqual ? "EXACT_REPEAT_REUSE" : "EXISTING_RESOURCE_NEW_VERSION",
      strongest.tier,
      strongest.resourceIdentityId,
      false,
    );
  }
  if (upstreamRelationship) {
    if (upstreamRelationship.relationshipKind === "MIRROR") {
      return upstreamRelationship.contentEqual
        ? decision("MIRROR", "P3", upstreamRelationship.resourceIdentityId, true)
        : decision("AMBIGUOUS_IDENTITY", "P3", null, true);
    }
    return decision(
      "FORK_OF_EXISTING_RESOURCE",
      "P3",
      upstreamRelationship.resourceIdentityId,
      true,
    );
  }
  if (untrustedManifest)
    return decision("POSSIBLE_DUPLICATE", "P2", untrustedManifest.resourceIdentityId, true);
  const content = input.matches.filter((match) => match.tier === "P4");
  if (content.length > 0) {
    const contentTargets = new Set(content.map((match) => match.resourceIdentityId));
    const target = contentTargets.size === 1 ? (content[0]?.resourceIdentityId ?? null) : null;
    return decision(target ? "POSSIBLE_DUPLICATE" : "AMBIGUOUS_IDENTITY", "P4", target, true);
  }
  const exactNames = input.matches.filter((match) => match.tier === "P5");
  if (exactNames.length > 0) {
    const exactNameTargets = new Set(exactNames.map((match) => match.resourceIdentityId));
    if (exactNameTargets.size > 1) return decision("AMBIGUOUS_IDENTITY", "P5", null, true);
    return decision("POSSIBLE_DUPLICATE", "P5", exactNames[0]?.resourceIdentityId ?? null, true);
  }
  return input.reliableNameToken === null
    ? decision("AMBIGUOUS_IDENTITY", null, null, true)
    : decision("NEW_RESOURCE", null, null, false);
}

function decision(
  outcome: IdentityResolution["outcome"],
  matchedTier: IdentityTier | null,
  resourceIdentityId: string | null,
  reviewRequired: boolean,
): IdentityResolution {
  return { outcome, matchedTier, resourceIdentityId, confidence: null, reviewRequired };
}

export interface IdentityShellInput {
  readonly resourceIdentityId: string;
  readonly resourceVersionIdentityId: string;
  readonly identityToken: string;
  readonly identityTokenEvidenceId: string;
  readonly contentFingerprint: string;
  readonly sourceSnapshotId: string;
  readonly candidateRootId: string;
  readonly sourceRevision: string;
  readonly createdAt: string;
}

export function createVersionIdentityKey(
  resourceIdentityId: string,
  candidateContentFingerprint: string,
): string {
  if (!hashPattern.test(candidateContentFingerprint))
    throw new TypeError("invalid content fingerprint");
  return fingerprintM02Payload({
    schemaVersion: "resource-version-key-v1",
    resourceIdentityId,
    candidateContentFingerprint,
  });
}

export function createIdentityShells(input: IdentityShellInput) {
  if (!hashPattern.test(input.contentFingerprint))
    throw new TypeError("invalid content fingerprint");
  if (!revisionPattern.test(input.sourceRevision))
    throw new TypeError("invalid immutable revision");
  const normalizedIdentityToken = normalizeIdentityToken(input.identityToken)?.normalized;
  if (
    input.identityToken.length === 0 ||
    input.identityTokenEvidenceId.length === 0 ||
    normalizedIdentityToken !== input.identityToken
  ) {
    throw new TypeError("reliable identity token evidence is required");
  }
  return {
    identity: {
      id: input.resourceIdentityId,
      type: "SKILL" as const,
      status: "ACTIVE" as const,
      identityToken: input.identityToken,
      identityTokenEvidenceId: input.identityTokenEvidenceId,
      createdAt: input.createdAt,
      recordVersion: 1,
    },
    version: {
      id: input.resourceVersionIdentityId,
      resourceIdentityId: input.resourceIdentityId,
      candidateContentFingerprint: input.contentFingerprint,
      versionIdentityKey: createVersionIdentityKey(
        input.resourceIdentityId,
        input.contentFingerprint,
      ),
      firstObservedSourceSnapshotId: input.sourceSnapshotId,
      firstObservedCandidateRootId: input.candidateRootId,
      firstObservedSourceRevision: input.sourceRevision,
      observationLabel: `snapshot:${input.sourceRevision.slice(0, 12)}`,
      status: "IDENTITY_RESOLVED" as const,
      createdAt: input.createdAt,
      recordVersion: 1,
    },
  };
}

export interface IdentityLifecycleObservationInput {
  readonly resourceIdentityId: string;
  readonly candidateId: string;
  readonly candidateContentFingerprint: string;
  readonly sourceSnapshotId: string;
  readonly methodologyFingerprint: string;
}

export interface IdentityLifecycleObservationResult {
  readonly resourceVersionIdentityKey: string;
  readonly candidateCreated: boolean;
  readonly versionCreated: boolean;
  readonly observationCreated: boolean;
  readonly methodologySuperseded: boolean;
}

/** Deterministic offline lifecycle model for F15-F17 identity/version idempotency. */
export class IdentityLifecycleRegistry {
  private readonly candidates = new Set<string>();
  private readonly versions = new Set<string>();
  private readonly observations = new Set<string>();
  private readonly methodologyByCandidate = new Map<string, string>();

  observe(input: IdentityLifecycleObservationInput): IdentityLifecycleObservationResult {
    if (!hashPattern.test(input.candidateContentFingerprint))
      throw new TypeError("invalid content fingerprint");
    if (!hashPattern.test(input.methodologyFingerprint))
      throw new TypeError("invalid methodology fingerprint");
    const resourceVersionIdentityKey = createVersionIdentityKey(
      input.resourceIdentityId,
      input.candidateContentFingerprint,
    );
    const candidateCreated = !this.candidates.has(input.candidateId);
    const versionCreated = !this.versions.has(resourceVersionIdentityKey);
    const observationKey = fingerprintM02Payload({
      resourceVersionIdentityKey,
      sourceSnapshotId: input.sourceSnapshotId,
    });
    const observationCreated = !this.observations.has(observationKey);
    const previousMethodology = this.methodologyByCandidate.get(input.candidateId);
    const methodologySuperseded =
      previousMethodology !== undefined && previousMethodology !== input.methodologyFingerprint;

    this.candidates.add(input.candidateId);
    this.versions.add(resourceVersionIdentityKey);
    this.observations.add(observationKey);
    this.methodologyByCandidate.set(input.candidateId, input.methodologyFingerprint);
    return {
      resourceVersionIdentityKey,
      candidateCreated,
      versionCreated,
      observationCreated,
      methodologySuperseded,
    };
  }

  counts() {
    return {
      candidates: this.candidates.size,
      versions: this.versions.size,
      observations: this.observations.size,
    };
  }
}

const editorCommands = new Set<IdentityManualResolutionCommand>([
  "CREATE_RESOURCE",
  "ATTACH_NEW_VERSION",
  "MARK_FORK",
  "MARK_MIRROR",
  "MARK_DUPLICATE",
  "REJECT_CANDIDATE",
  "OVERRIDE_NON_SKILL",
  "REQUEST_CLARIFICATION",
  "RESOLVE_AMBIGUITY",
  "REPLACE_M02_JOB",
]);
const reviewerCommands = new Set<IdentityManualResolutionCommand>([
  "REJECT_CANDIDATE",
  "REQUEST_CLARIFICATION",
  "REPLACE_M02_JOB",
]);

export function authorizeCommand(
  role: Role,
  command: IdentityManualResolutionCommand,
  replacementAuthorized = false,
): boolean {
  const knownCommands = new Set<IdentityManualResolutionCommand>([
    "CREATE_RESOURCE",
    "ATTACH_NEW_VERSION",
    "MARK_FORK",
    "MARK_MIRROR",
    "MARK_DUPLICATE",
    "REJECT_CANDIDATE",
    "SPLIT_ROOTS",
    "MERGE_ROOTS",
    "OVERRIDE_NON_SKILL",
    "REQUEST_CLARIFICATION",
    "RESOLVE_AMBIGUITY",
    "REPLACE_M02_JOB",
  ]);
  if (!knownCommands.has(command)) return false;
  if (command === "REPLACE_M02_JOB")
    return replacementAuthorized && ["ADMIN", "EDITOR", "TECHNICAL_REVIEWER"].includes(role);
  if (role === "ADMIN") return true;
  if (role === "EDITOR") return editorCommands.has(command);
  if (role === "TECHNICAL_REVIEWER") return reviewerCommands.has(command);
  return false;
}
