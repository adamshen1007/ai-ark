import { createHash } from "node:crypto";

import {
  M03_FIELD_KEYS,
  StructuredExtractionBundleV2Schema,
  canonicalJsonM03,
  textKey,
  type StructuredExtractionBundleV2,
} from "@ai-ark/contracts";
import { recomputeM03OutputFingerprint } from "@ai-ark/evidence";

import { createGenuineM03BundleFixture } from "./m03-genuine-bundle-fixture.js";

const hash = (value: unknown): string =>
  createHash("sha256").update(canonicalJsonM03(value)).digest("hex");

function withoutSourceIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSourceIds);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Readonly<Record<string, unknown>>)
      .filter(([key]) => key !== "sourceReferenceIds")
      .map(([key, nested]) => [key, withoutSourceIds(nested)]),
  );
}

function fieldValue(
  fieldKey: (typeof M03_FIELD_KEYS)[number],
  sourceReferenceIds: string[],
  base: StructuredExtractionBundleV2,
): { candidateValue: Readonly<Record<string, unknown>>; value: unknown; normalizedKey: string } {
  const semantic = (proposalKind: string, text: string) => ({
    text,
    normalizedKey: textKey(text),
    proposalKind,
    targetFieldKey: fieldKey,
    taxonomyBinding: {
      mappingState: "TAXONOMY_CANDIDATE",
      taxonomyIdOrNull: null,
      taxonomyRegistryVersion: base.policyVersions.taxonomyRegistryVersion,
      taxonomyRegistryFingerprint: base.policyVersions.taxonomyRegistryFingerprint,
    },
    sourceReferenceIds,
  });
  const list = (candidateValue: Readonly<Record<string, unknown>>, normalizedKey: string) => ({
    candidateValue,
    value: [candidateValue],
    normalizedKey,
  });
  switch (fieldKey) {
    case "canonical_skill_name": {
      const candidateValue = { displayName: "Ark", normalizedName: "ark", sourceReferenceIds };
      return { candidateValue, value: candidateValue, normalizedKey: "name:ark" };
    }
    case "creator_candidates":
    case "organization_candidates": {
      const kind = fieldKey === "creator_candidates" ? "CREATOR" : "ORGANIZATION";
      return list(
        {
          kind,
          displayName: "Ark",
          normalizedHandleOrNull: null,
          basis: "SOURCE_DECLARATION",
          verificationState: "UNVERIFIED",
          sourceReferenceIds,
        },
        `attribution:${kind}:ark`,
      );
    }
    case "version": {
      const candidateValue = {
        versionLabel: "1.0.0",
        normalizedVersionOrNull: "1.0.0",
        versionSource: "SEMVER_RELEASE",
        releaseChannel: "STABLE",
        sourceReferenceIds,
      };
      return {
        candidateValue,
        value: {
          state: "RESOLVED",
          selectedOrNull: candidateValue,
          preferredCandidateIdOrNull: null,
        },
        normalizedKey: "version:1.0.0",
      };
    }
    case "source_revision": {
      const candidateValue = {
        provider: "GITHUB",
        providerRepositoryId: "repo-1",
        sourceSnapshotId: base.m02.sourceSnapshotId,
        immutableRevision: base.m02.sourceRevision,
        resourceVersionObservationId: base.m02.resourceVersionObservationId,
        resourceSourceLinkId: base.m02.resourceSourceLinkId,
        sourceReferenceIds,
      };
      return {
        candidateValue,
        value: candidateValue,
        normalizedKey: `revision:${base.m02.sourceRevision}`,
      };
    }
    case "license": {
      const candidateValue = {
        spdxExpressionOrNull: "MIT",
        customTextHashOrNull: null,
        sourceReferenceIds,
      };
      return {
        candidateValue,
        value: {
          state: "CONFIRMED",
          selectedOrNull: candidateValue,
          preferredCandidateIdOrNull: null,
        },
        normalizedKey: "license:MIT",
      };
    }
    case "categories": {
      const candidateValue = {
        label: "Tools",
        normalizedLabel: "tools",
        mappingState: "TAXONOMY_CANDIDATE",
        taxonomyIdOrNull: null,
        taxonomyRegistryVersion: base.policyVersions.taxonomyRegistryVersion,
        taxonomyRegistryFingerprint: base.policyVersions.taxonomyRegistryFingerprint,
        sourceReferenceIds,
      };
      return list(candidateValue, "taxonomy:tools");
    }
    case "outcome_candidate":
    case "capabilities":
    case "tasks":
    case "use_cases":
    case "target_user_candidates": {
      const proposalKind = {
        outcome_candidate: "OUTCOME",
        capabilities: "CAPABILITY",
        tasks: "TASK",
        use_cases: "USE_CASE",
        target_user_candidates: "TARGET_USER",
      }[fieldKey];
      const candidateValue = semantic(proposalKind, "Automates work");
      const normalizedKey = `semantic:${proposalKind}:${candidateValue.normalizedKey}`;
      if (fieldKey === "outcome_candidate")
        return { candidateValue, value: candidateValue, normalizedKey };
      if (fieldKey === "target_user_candidates")
        return {
          candidateValue,
          value: { targetUsers: [candidateValue], bestFor: [], notIdealFor: [] },
          normalizedKey,
        };
      return list(candidateValue, normalizedKey);
    }
    case "installation": {
      const candidateValue = {
        ordinal: 0,
        pathKind: "EXPLICIT_COMMANDS",
        labelOrNull: null,
        startConditionOrNull: null,
        inferredMechanismOrNull: null,
        prerequisites: [],
        commands: [
          {
            ordinal: 0,
            languageTagOrNull: null,
            commandTextState: "PRESENT",
            commandTextOrNull: "ark",
            sourceContentHash: "a".repeat(64),
            sourceReferenceIds,
            safetyIndicators: [],
          },
        ],
        completionCueOrNull: null,
        sourceReferenceIds,
      };
      return {
        candidateValue,
        value: { state: "EXPLICIT_COMPLETE", paths: [candidateValue] },
        normalizedKey: `struct:${hash(withoutSourceIds(candidateValue))}`,
      };
    }
    case "configuration":
      return list(
        {
          name: "mode",
          normalizedName: "mode",
          requiredness: "OPTIONAL",
          valueKind: "STRING",
          secretSensitivity: "NON_SECRET",
          defaultPresent: false,
          defaultValueOrNull: null,
          sourceReferenceIds,
        },
        "configuration:mode",
      );
    case "dependencies": {
      const candidateValue = {
        kind: "PACKAGE",
        ecosystemOrNull: "NPM",
        name: "pkg",
        normalizedName: "pkg",
        declaredConstraintOrNull: null,
        scope: "REQUIRED",
        directness: "DIRECT_DECLARATION",
        sourceReferenceIds,
      };
      const { name: _name, sourceReferenceIds: _ids, ...identity } = candidateValue;
      void _name;
      void _ids;
      return list(candidateValue, `struct:${hash(identity)}`);
    }
    case "external_services":
      return list(
        {
          serviceName: "API",
          normalizedServiceName: "api",
          basis: "EXPLICIT_DECLARATION",
          requiredness: "OPTIONAL",
          sourceReferenceIds,
        },
        "service:api",
      );
    case "permissions": {
      const candidateValue = {
        kind: "NETWORK_ACCESS",
        evidenceLevel: "EXPLICIT",
        scopeOrNull: null,
        absenceClaim: false,
        sourceReferenceIds,
      };
      return list(candidateValue, `struct:${hash(withoutSourceIds(candidateValue))}`);
    }
    case "compatibility": {
      const candidateValue = {
        subjectKind: "PLATFORM",
        subject: "Web",
        normalizedSubject: "web",
        constraintOrNull: null,
        evidenceClass: "SOURCE_DECLARATION",
        support: "SUPPORTED",
        sourceReferenceIds,
      };
      const { subject: _subject, sourceReferenceIds: _ids, ...identity } = candidateValue;
      void _subject;
      void _ids;
      return list(candidateValue, `struct:${hash(identity)}`);
    }
    case "limitations": {
      const candidateValue = {
        text: "No offline mode",
        normalizedKey: "no offline mode",
        kind: "EXPLICIT_LIMITATION",
        sourceAIProposalIdOrNull: null,
        sourceReferenceIds,
      };
      return list(candidateValue, "limitation:EXPLICIT_LIMITATION:no offline mode");
    }
    case "maintenance_signals": {
      const candidateValue = { kind: "ARCHIVED", value: false, sourceReferenceIds };
      return {
        candidateValue,
        value: {
          archived: false,
          providerUpdatedAtOrNull: null,
          matchingReleaseOrTagDateOrNull: null,
          changelogPresent: false,
          currentChangelogEntryOrNull: null,
          explicitDeprecation: null,
          predecessorMetadataComplete: true,
          sourceReferenceIds,
        },
        normalizedKey: `struct:${hash(withoutSourceIds(candidateValue))}`,
      };
    }
  }
}

export async function createM04CombinedMaximumBundleFixture(): Promise<StructuredExtractionBundleV2> {
  const base = await createGenuineM03BundleFixture(
    0.9,
    "Technical reviewers",
    "FILE_TOO_LARGE",
    false,
    true,
  );
  const syntheticCount = 4096 - base.sourceReferences.length;
  const syntheticReferences = Array.from({ length: syntheticCount }, (_, ordinal) => {
    const contentHash = hash({ ordinal, kind: "ABSENCE" });
    const withoutId = {
      kind: "INVENTORY_ABSENCE" as const,
      sourceSnapshotId: base.m02.sourceSnapshotId,
      candidateRootId: base.m02.candidateRootId,
      ownershipTopologyFingerprint:
        base.expectedPredecessorState.fingerprintExpectations.ownershipTopology,
      acquisitionResultFingerprint:
        base.expectedPredecessorState.fingerprintExpectations.acquisitionResult,
      predicate: "CHANGELOG_SELECTOR_SET_EMPTY" as const,
      evaluatedSelectorPaths: [`absent-${ordinal.toString().padStart(4, "0")}.md`],
      contentHash,
      excerptHashOrNull: null,
      excerptOrNull: null,
    };
    return { ...withoutId, id: `src_${hash(withoutId)}` };
  });
  const sourceReferences = [...base.sourceReferences, ...syntheticReferences].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const sourceReferenceIds = sourceReferences.map(({ id }) => id);
  const extractorRefId = base.extractorRefs.find(
    (extractor) => extractor.kind === "DETERMINISTIC_PARSER",
  )?.id;
  if (extractorRefId === undefined) throw new Error("M04_MAXIMUM_EXTRACTOR_MISSING");
  const values = M03_FIELD_KEYS.map((fieldKey) => {
    if (fieldKey === "target_user_candidates") {
      const existing = base.fields.find((field) => field.fieldKey === fieldKey);
      if (existing?.status !== "STRONGLY_SUPPORTED")
        throw new Error("M04_MAXIMUM_TARGET_USER_PROPOSAL_MISSING");
      return {
        deterministicCandidate: null,
        field: { ...existing, evidenceIds: sourceReferenceIds },
      };
    }
    const { candidateValue, value, normalizedKey } = fieldValue(fieldKey, sourceReferenceIds, base);
    const payload = {
      fieldKey,
      value: candidateValue,
      normalizedKey,
      extractorRefId,
      supportNature: "EXACT" as const,
      claimClass: "SOURCE_FACT" as const,
      sourceType: "INVENTORY_ABSENCE" as const,
      sourceReferenceIds,
      confidence: 1,
      warningCodes: [],
    };
    const candidateFingerprint = hash(payload);
    const deterministicCandidate = {
      ...payload,
      id: `cand_${candidateFingerprint}`,
      candidateFingerprint,
    };
    const field = {
      fieldKey,
      value,
      status: "EXPLICIT" as const,
      claimClass: "SOURCE_FACT" as const,
      confidence: 1,
      deterministicCandidateIds: [deterministicCandidate.id],
      aiProposalIds: [],
      evidenceIds: sourceReferenceIds,
      conflictIds: [],
      warningCodes: [],
      extractorRefs: [extractorRefId],
    };
    return { deterministicCandidate, field };
  });
  const withoutFingerprint = {
    ...base,
    sourceReferences,
    deterministicCandidates: values
      .map(({ deterministicCandidate }) => deterministicCandidate)
      .filter((candidate) => candidate !== null),
    fields: values.map(({ field }) => field),
    conflicts: [],
    aggregateStatus: "COMPLETED" as const,
    laterProgressionBlockers: [],
  };
  const bundle = {
    ...withoutFingerprint,
    outputFingerprint: recomputeM03OutputFingerprint(withoutFingerprint),
  };
  return StructuredExtractionBundleV2Schema.parse(bundle);
}
