import type { RepositoryClassification } from "@ai-ark/contracts";

import { fingerprintM02Payload } from "./fingerprints.js";

export interface RepositoryGroupCandidate {
  readonly id: string;
  readonly rootFingerprint: string;
}

export interface RepositoryGroupRelationship {
  readonly order: number;
  readonly relationshipType: "INCLUDES" | "BUNDLES";
  readonly candidateId: string;
}

export interface ApplicationContext {
  readonly id: string;
  readonly evidenceReferenceIds: readonly string[];
  readonly applicationPaths: readonly string[];
}

export interface RepositoryCandidateGroup {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly classificationPolicyVersion: string;
  readonly classification: RepositoryClassification;
  readonly candidateIds: readonly string[];
  readonly evidenceReferenceIds: readonly string[];
  readonly warningCodes: readonly string[];
  readonly relationships: readonly RepositoryGroupRelationship[];
  readonly applicationContext: ApplicationContext | null;
  readonly groupFingerprint: string;
  readonly supersedesGroupId: string | null;
}

const byteSort = (values: Iterable<string>) =>
  [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));

export function buildRepositoryCandidateGroup(input: {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly classificationPolicyVersion: string;
  readonly classification: RepositoryClassification;
  readonly candidates: readonly RepositoryGroupCandidate[];
  readonly evidenceReferenceIds: readonly string[];
  readonly warningCodes: readonly string[];
  readonly applicationPaths?: readonly string[] | undefined;
  readonly supersedesGroupId: string | null;
}): RepositoryCandidateGroup {
  const evidenceReferenceIds = byteSort(new Set(input.evidenceReferenceIds));
  const warningCodes = byteSort(new Set(input.warningCodes));
  const relationshipType: RepositoryGroupRelationship["relationshipType"] | null =
    input.classification === "SKILL_COLLECTION"
      ? "INCLUDES"
      : input.classification === "SKILL_PLUS_APPLICATION"
        ? "BUNDLES"
        : null;
  const relationships: readonly RepositoryGroupRelationship[] =
    relationshipType === null
      ? []
      : input.candidates.map((candidate, order) => ({
          order,
          relationshipType,
          candidateId: candidate.id,
        }));
  const applicationPaths = byteSort(new Set(input.applicationPaths ?? []));
  const applicationContext =
    input.classification === "SKILL_PLUS_APPLICATION"
      ? {
          id: `${input.id}:application-context`,
          evidenceReferenceIds,
          applicationPaths,
        }
      : null;
  const fingerprintPayload = {
    schemaVersion: "1",
    classification: input.classification,
    childRootFingerprints: input.candidates.map((candidate) => candidate.rootFingerprint),
    relationships: relationships.map((relationship) => ({
      order: relationship.order,
      relationshipType: relationship.relationshipType,
    })),
    warningCodes,
    evidenceReferenceIds,
  } as const;

  return {
    id: input.id,
    sourceSnapshotId: input.sourceSnapshotId,
    classificationPolicyVersion: input.classificationPolicyVersion,
    classification: input.classification,
    candidateIds: input.candidates.map((candidate) => candidate.id),
    evidenceReferenceIds,
    warningCodes,
    relationships,
    applicationContext,
    groupFingerprint: fingerprintM02Payload(fingerprintPayload),
    supersedesGroupId: input.supersedesGroupId,
  };
}
