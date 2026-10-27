import {
  EvidenceItemV1Schema,
  M03_FIELD_KEYS,
  type StructuredExtractionBundleV1,
} from "@ai-ark/contracts";
import { describe, expect, it } from "vitest";

import { projectEvidenceBinding } from "./index.js";

describe("M04 deterministic evidence fixture", () => {
  it("freezes the byte-derived identity of inventory-absence evidence", () => {
    const sha = "a".repeat(64);
    const bundle = {
      extractionId: `ext_${sha}`,
      outputFingerprint: sha,
      m02: {
        resourceIdentityId: "resource-1",
        resourceVersionIdentityId: "version-1",
        sourceSnapshotId: "snapshot-1",
        sourceRevision: "b".repeat(40),
      },
      sourceReferences: [
        {
          kind: "INVENTORY_ABSENCE",
          id: "src_1",
          sourceSnapshotId: "snapshot-1",
          candidateRootId: "root-1",
          ownershipTopologyFingerprint: sha,
          acquisitionResultFingerprint: sha,
          predicate: "CHANGELOG_SELECTOR_SET_EMPTY",
          evaluatedSelectorPaths: [],
          contentHash: sha,
          excerptHashOrNull: null,
          excerptOrNull: null,
        },
      ],
      fields: M03_FIELD_KEYS.map((fieldKey) => ({
        fieldKey,
        value: [],
        status: "MISSING",
        claimClass: "NO_CLAIM",
        confidence: null,
        deterministicCandidateIds: [],
        aiProposalIds: [],
        evidenceIds: [],
        conflictIds: [],
        warningCodes: [],
        extractorRefs: ["extractor-1"],
      })),
      conflicts: [],
      analysisAttempts: [],
    } as unknown as StructuredExtractionBundleV1;
    expect(projectEvidenceBinding(bundle).evidenceItems[0]).toMatchObject({
      id: "evi_7608ee178e44ca6b122c37d45069ed238852838cdaea7109f5dd2eacb335c2c2",
      recordFingerprint: "693290f86ac64fd1f8c21c01d1351ce4d316ee560aaaff40fdc81450729636b4",
    });
  });

  it("does not retain a valid FILE_METADATA excerpt in FILE_STRUCTURE evidence", () => {
    const sha = "a".repeat(64);
    const bundle = {
      extractionId: `ext_${sha}`,
      m02: {
        resourceIdentityId: "resource-1",
        resourceVersionIdentityId: "version-1",
        sourceSnapshotId: "snapshot-1",
        sourceRevision: "b".repeat(40),
      },
      sourceReferences: [
        {
          kind: "DOCUMENT",
          id: "src_1",
          sourceSnapshotId: "snapshot-1",
          sourceEntryId: "entry-1",
          sourceDocumentId: "document-1",
          ownership: "CANDIDATE_OWNED",
          locator: {
            type: "FILE_METADATA",
            path: "SKILL.md",
            owningRecord: "SOURCE_ENTRY",
            metadataKey: "byteLength",
          },
          contentHash: sha,
          excerptHashOrNull: sha,
          excerptOrNull: '{"byteLength":12}',
        },
      ],
      fields: M03_FIELD_KEYS.map((fieldKey) => ({
        fieldKey,
        value: [],
        status: "MISSING",
        claimClass: "NO_CLAIM",
        confidence: null,
        deterministicCandidateIds: [],
        aiProposalIds: [],
        evidenceIds: [],
        conflictIds: [],
        warningCodes: [],
        extractorRefs: ["extractor-1"],
      })),
      conflicts: [],
      analysisAttempts: [],
    } as unknown as StructuredExtractionBundleV1;
    const item = projectEvidenceBinding(bundle).evidenceItems[0];
    expect(item).toMatchObject({
      evidenceType: "FILE_STRUCTURE",
      excerptState: "NOT_APPLICABLE",
      excerptOrNull: null,
    });
    expect(EvidenceItemV1Schema.safeParse(item).success).toBe(true);
    expect(
      EvidenceItemV1Schema.safeParse({
        ...item,
        excerptState: "RETAINED_INTERNAL",
        excerptOrNull: '{"byteLength":12}',
      }).success,
    ).toBe(false);
  });
});
