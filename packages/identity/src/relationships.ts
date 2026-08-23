export type RelationshipStatus = "ACTIVE" | "SUPERSEDED";

interface RelationshipBase {
  readonly id: string;
  readonly evidenceIds: readonly string[];
  readonly decisionId: string;
  readonly reason: string;
  readonly actorId: string;
  readonly createdAt: string;
}

export interface DuplicateRelationshipInput extends RelationshipBase {
  readonly sourceCandidateId: string;
  readonly targetResourceVersionId: string;
}

export interface ForkRelationshipInput extends RelationshipBase {
  readonly forkResourceVersionId: string;
  readonly originResourceVersionId: string;
}

export interface MirrorRelationshipInput extends RelationshipBase {
  readonly mirrorSourceRepositoryId: string;
  readonly originSourceRepositoryId: string;
  readonly targetResourceVersionId: string;
  readonly sourceLinkId: string;
  readonly normalizedRoot: string;
  readonly contentEqual: boolean;
}

type Persisted<T> = T & {
  readonly status: RelationshipStatus;
  readonly recordVersion: number;
  readonly supersedesRelationshipId: string | null;
};

export class RelationshipError extends Error {
  constructor(
    readonly code: "REFERENCE_INVALID" | "TRANSITION_PROHIBITED" | "STALE_RECORD_VERSION",
    message: string,
  ) {
    super(message);
    this.name = "RelationshipError";
  }
}

export class IdentityRelationshipRegistry {
  readonly auditEvents: {
    relationshipId: string;
    relationshipType: "DUPLICATE_OF" | "FORK_OF" | "MIRROR_OF";
    action: "CREATED" | "CORRECTED";
    decisionId: string;
  }[] = [];

  private readonly versions = new Map<
    string,
    { readonly resourceIdentityId: string; readonly contentFingerprint: string }
  >();
  private readonly candidates = new Map<string, string>();
  private readonly sourceRepositories = new Set<string>();
  private readonly duplicates = new Map<string, Persisted<DuplicateRelationshipInput>>();
  private readonly forks = new Map<string, Persisted<ForkRelationshipInput>>();
  private readonly mirrors = new Map<string, Persisted<MirrorRelationshipInput>>();
  private readonly sourceLinks = new Map<
    string,
    {
      readonly id: string;
      readonly targetResourceVersionId: string;
      readonly sourceRepositoryId: string;
      readonly normalizedRoot: string;
      readonly status: RelationshipStatus;
      readonly recordVersion: number;
    }
  >();

  registerVersion(versionId: string, resourceIdentityId: string, contentFingerprint: string): void {
    const existing = this.versions.get(versionId);
    if (
      !/^[a-f0-9]{64}$/u.test(contentFingerprint) ||
      (existing !== undefined &&
        (existing.resourceIdentityId !== resourceIdentityId ||
          existing.contentFingerprint !== contentFingerprint))
    )
      throw new RelationshipError("REFERENCE_INVALID", "version endpoint registration conflicts");
    this.versions.set(versionId, { resourceIdentityId, contentFingerprint });
  }

  registerCandidate(candidateId: string, contentFingerprint: string): void {
    const existing = this.candidates.get(candidateId);
    if (
      !/^[a-f0-9]{64}$/u.test(contentFingerprint) ||
      (existing !== undefined && existing !== contentFingerprint)
    )
      throw new RelationshipError("REFERENCE_INVALID", "candidate endpoint registration conflicts");
    this.candidates.set(candidateId, contentFingerprint);
  }

  registerSourceRepository(sourceRepositoryId: string): void {
    this.sourceRepositories.add(sourceRepositoryId);
  }

  confirmDuplicate(input: DuplicateRelationshipInput): Persisted<DuplicateRelationshipInput> {
    if (
      !this.candidates.has(input.sourceCandidateId) ||
      !this.versions.has(input.targetResourceVersionId)
    ) {
      throw new RelationshipError("REFERENCE_INVALID", "duplicate endpoints must be registered");
    }
    if (
      this.candidates.get(input.sourceCandidateId) !==
      this.versions.get(input.targetResourceVersionId)?.contentFingerprint
    ) {
      throw new RelationshipError("REFERENCE_INVALID", "duplicate content must be byte-identical");
    }
    nonEmpty(input.targetResourceVersionId, "duplicate target version is mandatory");
    if (
      [...this.duplicates.values()].some(
        (item) => item.status === "ACTIVE" && item.sourceCandidateId === input.sourceCandidateId,
      )
    ) {
      throw new RelationshipError(
        "TRANSITION_PROHIBITED",
        "active duplicate disposition already exists",
      );
    }
    return this.insert(this.duplicates, input, "DUPLICATE_OF");
  }

  correctDuplicate(
    priorId: string,
    expectedVersion: number,
    replacement: DuplicateRelationshipInput,
  ): Persisted<DuplicateRelationshipInput> {
    const prior = this.requireActive(this.duplicates, priorId, expectedVersion);
    if (prior.sourceCandidateId !== replacement.sourceCandidateId) {
      throw new RelationshipError(
        "REFERENCE_INVALID",
        "relationship correction must preserve source endpoint",
      );
    }
    this.duplicates.set(priorId, {
      ...prior,
      status: "SUPERSEDED",
      recordVersion: prior.recordVersion + 1,
    });
    try {
      const created = this.confirmDuplicate(replacement);
      const corrected = { ...created, supersedesRelationshipId: priorId };
      this.duplicates.set(created.id, corrected);
      this.auditEvents[this.auditEvents.length - 1] = {
        relationshipId: created.id,
        relationshipType: "DUPLICATE_OF",
        action: "CORRECTED",
        decisionId: created.decisionId,
      };
      return corrected;
    } catch (error) {
      this.duplicates.set(priorId, prior);
      throw error;
    }
  }

  markFork(input: ForkRelationshipInput): Persisted<ForkRelationshipInput> {
    if (input.forkResourceVersionId === input.originResourceVersionId) {
      throw new RelationshipError("REFERENCE_INVALID", "fork self-edge is prohibited");
    }
    const forkResource = this.versions.get(input.forkResourceVersionId);
    const originResource = this.versions.get(input.originResourceVersionId);
    if (
      forkResource === undefined ||
      originResource === undefined ||
      forkResource.resourceIdentityId === originResource.resourceIdentityId
    ) {
      throw new RelationshipError(
        "REFERENCE_INVALID",
        "fork versions must exist and belong to different Resources",
      );
    }
    if (
      [...this.forks.values()].some(
        (item) =>
          item.status === "ACTIVE" && item.forkResourceVersionId === input.forkResourceVersionId,
      )
    ) {
      throw new RelationshipError(
        "TRANSITION_PROHIBITED",
        "fork version already has an active origin",
      );
    }
    if (
      this.reaches(
        this.forks,
        input.originResourceVersionId,
        input.forkResourceVersionId,
        "forkResourceVersionId",
        "originResourceVersionId",
      )
    ) {
      throw new RelationshipError("REFERENCE_INVALID", "fork relationship cycle is prohibited");
    }
    return this.insert(this.forks, input, "FORK_OF");
  }

  correctFork(
    priorId: string,
    expectedVersion: number,
    replacement: ForkRelationshipInput,
  ): Persisted<ForkRelationshipInput> {
    const prior = this.requireActive(this.forks, priorId, expectedVersion);
    if (prior.forkResourceVersionId !== replacement.forkResourceVersionId) {
      throw new RelationshipError(
        "REFERENCE_INVALID",
        "relationship correction must preserve source endpoint",
      );
    }
    this.forks.set(priorId, {
      ...prior,
      status: "SUPERSEDED",
      recordVersion: prior.recordVersion + 1,
    });
    try {
      const created = this.markFork(replacement);
      const corrected = { ...created, supersedesRelationshipId: priorId };
      this.forks.set(created.id, corrected);
      this.auditEvents[this.auditEvents.length - 1] = {
        relationshipId: created.id,
        relationshipType: "FORK_OF",
        action: "CORRECTED",
        decisionId: created.decisionId,
      };
      return corrected;
    } catch (error) {
      this.forks.set(priorId, prior);
      throw error;
    }
  }

  markMirror(input: MirrorRelationshipInput): Persisted<MirrorRelationshipInput> {
    if (
      !this.sourceRepositories.has(input.mirrorSourceRepositoryId) ||
      !this.sourceRepositories.has(input.originSourceRepositoryId) ||
      !this.versions.has(input.targetResourceVersionId)
    )
      throw new RelationshipError("REFERENCE_INVALID", "mirror endpoints must be registered");
    if (!isNormalizedRoot(input.normalizedRoot))
      throw new RelationshipError("REFERENCE_INVALID", "mirror delivery root is invalid");
    nonEmpty(input.targetResourceVersionId, "mirror target version is mandatory");
    nonEmpty(input.sourceLinkId, "mirror target-version delivery link is mandatory");
    if (!input.contentEqual)
      throw new RelationshipError("REFERENCE_INVALID", "divergent content cannot be a mirror");
    if (input.mirrorSourceRepositoryId === input.originSourceRepositoryId) {
      throw new RelationshipError("REFERENCE_INVALID", "mirror self-edge is prohibited");
    }
    if (
      [...this.mirrors.values()].some(
        (item) =>
          item.status === "ACTIVE" &&
          item.mirrorSourceRepositoryId === input.mirrorSourceRepositoryId,
      )
    ) {
      throw new RelationshipError(
        "TRANSITION_PROHIBITED",
        "mirror repository already has an active origin",
      );
    }
    if (this.sourceLinks.has(input.sourceLinkId)) {
      throw new RelationshipError("TRANSITION_PROHIBITED", "mirror source-link ID already exists");
    }
    if (
      this.reaches(
        this.mirrors,
        input.originSourceRepositoryId,
        input.mirrorSourceRepositoryId,
        "mirrorSourceRepositoryId",
        "originSourceRepositoryId",
      )
    ) {
      throw new RelationshipError("REFERENCE_INVALID", "mirror relationship cycle is prohibited");
    }
    const relationship = this.insert(this.mirrors, input, "MIRROR_OF");
    this.sourceLinks.set(input.sourceLinkId, {
      id: input.sourceLinkId,
      targetResourceVersionId: input.targetResourceVersionId,
      sourceRepositoryId: input.mirrorSourceRepositoryId,
      normalizedRoot: input.normalizedRoot,
      status: "ACTIVE",
      recordVersion: 1,
    });
    return relationship;
  }

  correctMirror(
    priorId: string,
    expectedVersion: number,
    replacement: MirrorRelationshipInput,
  ): Persisted<MirrorRelationshipInput> {
    const prior = this.requireActive(this.mirrors, priorId, expectedVersion);
    if (prior.mirrorSourceRepositoryId !== replacement.mirrorSourceRepositoryId) {
      throw new RelationshipError(
        "REFERENCE_INVALID",
        "relationship correction must preserve source endpoint",
      );
    }
    const priorSourceLink = this.sourceLinks.get(prior.sourceLinkId);
    this.mirrors.set(priorId, {
      ...prior,
      status: "SUPERSEDED",
      recordVersion: prior.recordVersion + 1,
    });
    if (priorSourceLink !== undefined) {
      this.sourceLinks.set(prior.sourceLinkId, {
        ...priorSourceLink,
        status: "SUPERSEDED",
        recordVersion: priorSourceLink.recordVersion + 1,
      });
    }
    try {
      const created = this.markMirrorWithSupersession(replacement, priorId);
      this.auditEvents[this.auditEvents.length - 1] = {
        relationshipId: created.id,
        relationshipType: "MIRROR_OF",
        action: "CORRECTED",
        decisionId: created.decisionId,
      };
      return created;
    } catch (error) {
      this.mirrors.set(priorId, prior);
      if (priorSourceLink !== undefined) this.sourceLinks.set(prior.sourceLinkId, priorSourceLink);
      throw error;
    }
  }

  getMirror(id: string): Persisted<MirrorRelationshipInput> | undefined {
    return this.mirrors.get(id);
  }

  getSourceLink(id: string) {
    return this.sourceLinks.get(id);
  }

  private markMirrorWithSupersession(input: MirrorRelationshipInput, priorId: string) {
    const created = this.markMirror(input);
    const replacement = { ...created, supersedesRelationshipId: priorId };
    this.mirrors.set(created.id, replacement);
    return replacement;
  }

  private insert<T extends RelationshipBase>(
    store: Map<string, Persisted<T>>,
    input: T,
    relationshipType: "DUPLICATE_OF" | "FORK_OF" | "MIRROR_OF",
  ): Persisted<T> {
    if (store.has(input.id))
      throw new RelationshipError("TRANSITION_PROHIBITED", "relationship ID already exists");
    nonEmpty(input.reason, "relationship reason is required");
    if (input.evidenceIds.length === 0)
      throw new RelationshipError("REFERENCE_INVALID", "relationship evidence is required");
    const persisted = {
      ...input,
      status: "ACTIVE" as const,
      recordVersion: 1,
      supersedesRelationshipId: null,
    };
    store.set(input.id, persisted);
    this.auditEvents.push({
      relationshipId: input.id,
      relationshipType,
      action: "CREATED",
      decisionId: input.decisionId,
    });
    return persisted;
  }

  private requireActive<T extends RelationshipBase>(
    store: Map<string, Persisted<T>>,
    id: string,
    expectedVersion: number,
  ): Persisted<T> {
    const prior = store.get(id);
    if (prior?.status !== "ACTIVE")
      throw new RelationshipError("TRANSITION_PROHIBITED", "prior relationship must be active");
    if (prior.recordVersion !== expectedVersion)
      throw new RelationshipError("STALE_RECORD_VERSION", "stale relationship version");
    return prior;
  }

  private reaches<T extends RelationshipBase>(
    store: Map<string, Persisted<T>>,
    start: string,
    target: string,
    sourceKey: keyof T,
    targetKey: keyof T,
  ): boolean {
    const seen = new Set<string>();
    let cursor: string | undefined = start;
    while (cursor !== undefined && !seen.has(cursor)) {
      if (cursor === target) return true;
      seen.add(cursor);
      const edge = [...store.values()].find(
        (item) => item.status === "ACTIVE" && item[sourceKey] === cursor,
      );
      cursor = edge?.[targetKey] as string | undefined;
    }
    return false;
  }
}

function nonEmpty(value: string, message: string): void {
  if (value.length === 0) throw new RelationshipError("REFERENCE_INVALID", message);
}

function isNormalizedRoot(value: string): boolean {
  return (
    value === "." ||
    (value.length > 0 &&
      !value.startsWith("/") &&
      !value.endsWith("/") &&
      !value.includes("\\") &&
      value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."))
  );
}
