import { describe, expect, it } from "vitest";

import {
  AIProposalV1Schema,
  AnalysisAttemptV1Schema,
  AttributionCandidateV1Schema,
  ExactCommandV1Schema,
  ExtractionCandidateV1Schema,
  ExtractionConflictV1Schema,
  ExtractionFieldResultV1Schema,
  ExtractionValueSchemaByFieldV1,
  ExtractionSourceReferenceV1Schema,
  CompatibilityValueV1Schema,
  ConfigurationValueV1Schema,
  DependencyValueV1Schema,
  ExternalServiceValueV1Schema,
  LimitationValueV1Schema,
  LicenseValueV1Schema,
  M03_FIELD_KEYS,
  NameValueV1Schema,
  SemanticProposalV1Schema,
  TaxonomyValueV1Schema,
  validateCompleteM03FieldSet,
  textKey,
} from "./index.js";

const sha = "a".repeat(64);

describe("M03 value and provenance contracts", () => {
  it("identity-folds valid scalars without a Unicode 15.1 case-fold mapping", () => {
    expect(textKey("\u{1CC00}")).toBe("\u{1CC00}");
  });

  it("measures bounded user-facing strings in Unicode scalars and rejects malformed scalars", () => {
    const exactMaximum = "😀".repeat(200);
    expect(
      NameValueV1Schema.safeParse({
        normalizedName: exactMaximum,
        displayName: exactMaximum,
        sourceReferenceIds: [`src_${sha}`],
      }).success,
    ).toBe(true);
    expect(
      NameValueV1Schema.safeParse({
        normalizedName: "😀".repeat(201),
        displayName: "valid",
        sourceReferenceIds: [`src_${sha}`],
      }).success,
    ).toBe(false);
    expect(
      NameValueV1Schema.safeParse({
        normalizedName: "\ud800",
        displayName: "valid",
        sourceReferenceIds: [`src_${sha}`],
      }).success,
    ).toBe(false);
  });

  it("enforces document/metadata/absence reference XOR and sensitive locator privacy", () => {
    const document = {
      kind: "DOCUMENT",
      id: `src_${sha}`,
      sourceSnapshotId: "snapshot-1",
      sourceEntryId: "entry-1",
      sourceDocumentId: "document-1",
      ownership: "CANDIDATE_OWNED",
      locator: { type: "LINE_RANGE", path: "README.md", startLine: 1, endLine: 1 },
      contentHash: sha,
      excerptHashOrNull: sha,
      excerptOrNull: "hello",
    } as const;
    expect(ExtractionSourceReferenceV1Schema.safeParse(document).success).toBe(true);
    expect(
      ExtractionSourceReferenceV1Schema.safeParse({
        ...document,
        locator: {
          type: "SENSITIVE_LOCATOR",
          originalType: "LINE_RANGE",
          locatorFingerprint: sha,
          startLine: 1,
          endLine: 1,
        },
        excerptHashOrNull: null,
        excerptOrNull: null,
      }).success,
    ).toBe(true);
    expect(
      ExtractionSourceReferenceV1Schema.safeParse({
        ...document,
        locator: {
          type: "SENSITIVE_LOCATOR",
          originalType: "LINE_RANGE",
          locatorFingerprint: sha,
          path: "secret-token/file.md",
          startLine: 1,
          endLine: 1,
        },
        excerptHashOrNull: null,
        excerptOrNull: null,
      }).success,
    ).toBe(false);
    expect(
      ExtractionSourceReferenceV1Schema.safeParse({
        ...document,
        locator: {
          type: "FILE_METADATA",
          path: "README.md",
          owningRecord: "SOURCE_ENTRY",
          metadataKey: "encoding",
        },
        excerptHashOrNull: null,
        excerptOrNull: null,
      }).success,
    ).toBe(false);
    expect(
      ExtractionSourceReferenceV1Schema.safeParse({
        ...document,
        locator: {
          type: "FILE_METADATA",
          path: "README.md",
          owningRecord: "SOURCE_DOCUMENT",
          metadataKey: "entryType",
        },
        excerptHashOrNull: null,
        excerptOrNull: null,
      }).success,
    ).toBe(false);
  });

  it("enforces exact-command withholding and indicator invariants", () => {
    const command = {
      ordinal: 0,
      languageTagOrNull: "bash",
      commandTextState: "WITHHELD_SECRET_LIKE",
      commandTextOrNull: null,
      sourceContentHash: sha,
      sourceReferenceIds: [`src_${sha}`],
      safetyIndicators: ["CREDENTIAL_LITERAL"],
    } as const;
    expect(ExactCommandV1Schema.safeParse(command).success).toBe(true);
    expect(
      ExactCommandV1Schema.safeParse({ ...command, commandTextOrNull: "token=secret" }).success,
    ).toBe(false);
    expect(
      ExactCommandV1Schema.safeParse({ ...command, safetyIndicators: ["NETWORK_DOWNLOAD"] })
        .success,
    ).toBe(false);
  });

  it("enforces exact empty MISSING values by field family", () => {
    const missingName = {
      fieldKey: "canonical_skill_name",
      value: null,
      status: "MISSING",
      claimClass: "NO_CLAIM",
      confidence: null,
      deterministicCandidateIds: [],
      aiProposalIds: [],
      evidenceIds: [],
      conflictIds: [],
      warningCodes: [],
      extractorRefs: [`xtr_${sha}`],
    } as const;
    expect(ExtractionFieldResultV1Schema.safeParse(missingName).success).toBe(true);
    expect(ExtractionFieldResultV1Schema.safeParse({ ...missingName, value: [] }).success).toBe(
      false,
    );

    const missingList = { ...missingName, fieldKey: "dependencies", value: [] } as const;
    expect(ExtractionFieldResultV1Schema.safeParse(missingList).success).toBe(true);
    expect(ExtractionFieldResultV1Schema.safeParse({ ...missingList, value: null }).success).toBe(
      false,
    );
  });

  it("rejects illegal field status, claim-class, and support arms", () => {
    const explicit = {
      fieldKey: "canonical_skill_name",
      value: {
        normalizedName: "demo",
        displayName: "Demo",
        sourceReferenceIds: [`src_${sha}`],
      },
      status: "EXPLICIT",
      claimClass: "SOURCE_FACT",
      confidence: 1,
      deterministicCandidateIds: [`cand_${sha}`],
      aiProposalIds: [],
      evidenceIds: [`src_${sha}`],
      conflictIds: [],
      warningCodes: [],
      extractorRefs: [`xtr_${sha}`],
    } as const;
    expect(ExtractionFieldResultV1Schema.safeParse(explicit).success).toBe(true);
    expect(
      ExtractionFieldResultV1Schema.safeParse({ ...explicit, claimClass: "NO_CLAIM" }).success,
    ).toBe(false);
    expect(
      ExtractionFieldResultV1Schema.safeParse({
        ...explicit,
        status: "STRONGLY_SUPPORTED",
        claimClass: "AI_INFERENCE",
        confidence: 0.9,
      }).success,
    ).toBe(false);
    expect(
      ExtractionFieldResultV1Schema.safeParse({
        ...explicit,
        fieldKey: "creator_candidates",
        value: [],
        status: "REVIEW_REQUIRED",
        claimClass: "SOURCE_FACT",
        confidence: null,
        warningCodes: ["ATTRIBUTION_TYPE_UNPROVEN"],
      }).success,
    ).toBe(false);
  });

  it("requires exactly one result for every registry field", () => {
    const fields = M03_FIELD_KEYS.map((fieldKey) => ({ fieldKey }));
    expect(validateCompleteM03FieldSet(fields)).toEqual({ ok: true });
    expect(validateCompleteM03FieldSet(fields.slice(1))).toEqual({
      ok: false,
      errorCode: "FIELD_REGISTRY_INCOMPLETE",
    });
    expect(validateCompleteM03FieldSet([...fields, { fieldKey: "extra" }])).toEqual({
      ok: false,
      errorCode: "FIELD_SCHEMA_INVALID",
    });
  });

  it("enforces taxonomy mapping-state XOR without rejecting shared members", () => {
    const base = {
      label: "Automation",
      normalizedLabel: "automation",
      sourceReferenceIds: [`src_${sha}`],
      taxonomyRegistryVersion: "m03-taxonomy-registry-empty-v1",
      taxonomyRegistryFingerprint: sha,
    };
    expect(
      TaxonomyValueV1Schema.safeParse({
        ...base,
        mappingState: "TAXONOMY_CANDIDATE",
        taxonomyIdOrNull: null,
      }).success,
    ).toBe(true);
    expect(
      TaxonomyValueV1Schema.safeParse({
        ...base,
        mappingState: "MATCHED",
        taxonomyIdOrNull: "taxonomy-1",
      }).success,
    ).toBe(true);
    expect(
      TaxonomyValueV1Schema.safeParse({
        ...base,
        mappingState: "MATCHED",
        taxonomyIdOrNull: null,
      }).success,
    ).toBe(false);
  });

  it("equality-binds every supplied normalized member to its source value", () => {
    const sourceReferenceIds = [`src_${sha}`];
    const cases = [
      [
        NameValueV1Schema,
        { displayName: "Straße", normalizedName: "strasse", sourceReferenceIds },
        "normalizedName",
      ],
      [
        TaxonomyValueV1Schema,
        {
          label: "Straße",
          normalizedLabel: "strasse",
          sourceReferenceIds,
          mappingState: "TAXONOMY_CANDIDATE",
          taxonomyIdOrNull: null,
          taxonomyRegistryVersion: "registry-1",
          taxonomyRegistryFingerprint: sha,
        },
        "normalizedLabel",
      ],
      [
        ConfigurationValueV1Schema,
        {
          name: "API URL",
          normalizedName: "api url",
          requiredness: "OPTIONAL",
          valueKind: "URL",
          secretSensitivity: "NON_SECRET",
          defaultPresent: true,
          defaultValueOrNull: "https://example.com",
          sourceReferenceIds,
        },
        "normalizedName",
      ],
      [
        DependencyValueV1Schema,
        {
          kind: "PACKAGE",
          ecosystemOrNull: "PYPI",
          name: "My_Package.Name",
          normalizedName: "my-package-name",
          declaredConstraintOrNull: null,
          scope: "REQUIRED",
          directness: "DIRECT_DECLARATION",
          sourceReferenceIds,
        },
        "normalizedName",
      ],
      [
        ExternalServiceValueV1Schema,
        {
          serviceName: "Example API",
          normalizedServiceName: "example api",
          basis: "EXPLICIT_DECLARATION",
          requiredness: "REQUIRED",
          sourceReferenceIds,
        },
        "normalizedServiceName",
      ],
      [
        CompatibilityValueV1Schema,
        {
          subjectKind: "PLATFORM",
          subject: "macOS",
          normalizedSubject: "macos",
          constraintOrNull: null,
          evidenceClass: "SOURCE_DECLARATION",
          support: "SUPPORTED",
          sourceReferenceIds,
        },
        "normalizedSubject",
      ],
      [
        LimitationValueV1Schema,
        {
          text: "No Straße support",
          normalizedKey: "no strasse support",
          kind: "EXPLICIT_LIMITATION",
          sourceAIProposalIdOrNull: null,
          sourceReferenceIds,
        },
        "normalizedKey",
      ],
      [
        SemanticProposalV1Schema,
        {
          text: "Automates Straße",
          normalizedKey: "automates strasse",
          proposalKind: "CAPABILITY",
          targetFieldKey: "capabilities",
          taxonomyBinding: {
            mappingState: "TAXONOMY_CANDIDATE",
            taxonomyIdOrNull: null,
            taxonomyRegistryVersion: "registry-1",
            taxonomyRegistryFingerprint: sha,
          },
          sourceReferenceIds,
        },
        "normalizedKey",
      ],
    ] as const;
    for (const [schema, valid, key] of cases) {
      expect(schema.safeParse(valid).success).toBe(true);
      expect(schema.safeParse({ ...valid, [key]: "wrong" }).success).toBe(false);
    }
  });

  it("enforces normalized attribution, canonical SPDX, and valid ecosystem package names", () => {
    expect(
      AttributionCandidateV1Schema.safeParse({
        kind: "CREATOR",
        displayName: "Alice",
        normalizedHandleOrNull: "@Alice",
        basis: "SKILL_METADATA",
        verificationState: "UNVERIFIED",
        sourceReferenceIds: [`src_${sha}`],
      }).success,
    ).toBe(false);
    expect(
      LicenseValueV1Schema.safeParse({
        sourceReferenceIds: [`src_${sha}`],
        spdxExpressionOrNull: "mit",
        customTextHashOrNull: null,
      }).success,
    ).toBe(false);
    const dependency = {
      kind: "PACKAGE",
      ecosystemOrNull: "PYPI",
      name: "valid_package.name",
      normalizedName: "valid-package-name",
      declaredConstraintOrNull: null,
      scope: "REQUIRED",
      directness: "DIRECT_DECLARATION",
      sourceReferenceIds: [`src_${sha}`],
    } as const;
    expect(DependencyValueV1Schema.safeParse(dependency).success).toBe(true);
    expect(DependencyValueV1Schema.safeParse({ ...dependency, name: "-invalid" }).success).toBe(
      false,
    );
  });

  it("binds attribution handles to display names and their constructor arm", () => {
    const base = {
      kind: "CREATOR",
      displayName: "@Alice",
      normalizedHandleOrNull: "alice",
      basis: "SKILL_METADATA",
      verificationState: "UNVERIFIED",
      sourceReferenceIds: [`src_${sha}`],
    } as const;
    expect(AttributionCandidateV1Schema.safeParse(base).success).toBe(true);
    expect(
      AttributionCandidateV1Schema.safeParse({ ...base, normalizedHandleOrNull: "bob" }).success,
    ).toBe(false);
    expect(
      AttributionCandidateV1Schema.safeParse({ ...base, normalizedHandleOrNull: null }).success,
    ).toBe(false);
    expect(
      AttributionCandidateV1Schema.safeParse({
        ...base,
        displayName: "Alice",
        normalizedHandleOrNull: "alice",
      }).success,
    ).toBe(false);
  });

  it("enforces the exact attribution discriminator for each field", () => {
    const attribution = {
      kind: "CREATOR",
      displayName: "Alice",
      normalizedHandleOrNull: null,
      basis: "SKILL_METADATA",
      verificationState: "UNVERIFIED",
      sourceReferenceIds: [`src_${sha}`],
    } as const;
    expect(ExtractionValueSchemaByFieldV1.creator_candidates.safeParse([attribution]).success).toBe(
      true,
    );
    expect(
      ExtractionValueSchemaByFieldV1.creator_candidates.safeParse([
        { ...attribution, kind: "ORGANIZATION" },
      ]).success,
    ).toBe(false);
    expect(
      ExtractionValueSchemaByFieldV1.organization_candidates.safeParse([attribution]).success,
    ).toBe(false);
  });

  it("enforces the exact semantic proposal discriminator for each field", () => {
    const proposal = {
      text: "Automates reviews",
      normalizedKey: "automates reviews",
      proposalKind: "CAPABILITY",
      targetFieldKey: "capabilities",
      taxonomyBinding: {
        mappingState: "TAXONOMY_CANDIDATE",
        taxonomyIdOrNull: null,
        taxonomyRegistryVersion: "registry-1",
        taxonomyRegistryFingerprint: sha,
      },
      sourceReferenceIds: [`src_${sha}`],
    } as const;
    expect(ExtractionValueSchemaByFieldV1.capabilities.safeParse([proposal]).success).toBe(true);
    expect(ExtractionValueSchemaByFieldV1.tasks.safeParse([proposal]).success).toBe(false);
    expect(
      ExtractionValueSchemaByFieldV1.target_user_candidates.safeParse({
        targetUsers: [
          {
            ...proposal,
            proposalKind: "BEST_FOR",
            targetFieldKey: "target_user_candidates",
          },
        ],
        bestFor: [],
        notIdealFor: [],
      }).success,
    ).toBe(false);
  });

  it("binds final AI proposals to their exact sub-operation, target, and value arm", () => {
    const proposal = {
      kind: "FIELD_PROPOSAL",
      id: `aip_${sha}`,
      analysisAttemptId: `ana_${sha}`,
      extractorRefId: `xtr_${sha}`,
      subOperation: "MAP_TASKS",
      targetFieldKey: "tasks",
      value: {
        text: "Automates reviews",
        normalizedKey: "automates reviews",
        proposalKind: "TASK",
        targetFieldKey: "tasks",
        taxonomyBinding: {
          mappingState: "TAXONOMY_CANDIDATE",
          taxonomyIdOrNull: null,
          taxonomyRegistryVersion: "registry-1",
          taxonomyRegistryFingerprint: sha,
        },
        sourceReferenceIds: [`src_${sha}`],
      },
      confidence: 0.9,
      claimClass: "AI_INFERENCE",
      sourceReferenceIds: [`src_${sha}`],
      warningCodes: ["TAXONOMY_CANDIDATE"],
      proposalFingerprint: sha,
    } as const;
    expect(AIProposalV1Schema.safeParse(proposal).success).toBe(true);
    expect(AIProposalV1Schema.safeParse({ ...proposal, warningCodes: [] }).success).toBe(false);
    expect(
      AIProposalV1Schema.safeParse({
        ...proposal,
        warningCodes: ["TAXONOMY_CANDIDATE", "ARCHIVED_SOURCE"],
      }).success,
    ).toBe(false);
    const secondReferenceId = `src_${"b".repeat(64)}`;
    const twoReferenceProposal = {
      ...proposal,
      sourceReferenceIds: [proposal.sourceReferenceIds[0], secondReferenceId],
      value: {
        ...proposal.value,
        sourceReferenceIds: [proposal.sourceReferenceIds[0], secondReferenceId],
      },
    };
    expect(AIProposalV1Schema.safeParse(twoReferenceProposal).success).toBe(true);
    expect(
      AIProposalV1Schema.safeParse({
        ...twoReferenceProposal,
        sourceReferenceIds: [...twoReferenceProposal.sourceReferenceIds].reverse(),
        value: {
          ...twoReferenceProposal.value,
          sourceReferenceIds: [...twoReferenceProposal.value.sourceReferenceIds].reverse(),
        },
      }).success,
    ).toBe(false);
    expect(
      AIProposalV1Schema.safeParse({
        ...proposal,
        confidence: 0.5,
        warningCodes: ["LOW_CONFIDENCE", "TAXONOMY_CANDIDATE"],
      }).success,
    ).toBe(false);
    expect(
      AIProposalV1Schema.safeParse({
        ...proposal,
        value: {
          ...proposal.value,
          proposalKind: "CAPABILITY",
          targetFieldKey: "capabilities",
        },
      }).success,
    ).toBe(false);
    expect(
      AIProposalV1Schema.safeParse({ ...proposal, targetFieldKey: "capabilities" }).success,
    ).toBe(false);
  });

  it("closes candidate, conflict, and attributed analysis-attempt unions", () => {
    const sourceRevision = {
      provider: "GITHUB",
      providerRepositoryId: "repo-1",
      sourceSnapshotId: "snapshot-1",
      immutableRevision: "b".repeat(40),
      resourceVersionObservationId: "observation-1",
      resourceSourceLinkId: "source-link-1",
      sourceReferenceIds: [`src_${sha}`],
    };
    const candidate = {
      id: `cand_${sha}`,
      fieldKey: "source_revision",
      value: sourceRevision,
      normalizedKey: `revision:${"b".repeat(40)}`,
      extractorRefId: `xtr_${sha}`,
      supportNature: "EXACT",
      claimClass: "SOURCE_FACT",
      sourceType: "SOURCE_REVISION_FALLBACK",
      sourceReferenceIds: [`src_${sha}`],
      confidence: 1,
      warningCodes: [],
      candidateFingerprint: sha,
    } as const;
    expect(ExtractionCandidateV1Schema.safeParse(candidate).success).toBe(true);
    expect(
      ExtractionCandidateV1Schema.safeParse({ ...candidate, normalizedKey: "revision:wrong" })
        .success,
    ).toBe(false);
    expect(ExtractionCandidateV1Schema.safeParse({ ...candidate, confidence: 0.9 }).success).toBe(
      false,
    );

    const conflict = {
      id: `conf_${sha}`,
      fieldKey: "version",
      reasonCode: "SAME_TIER_DISTINCT_VALUES",
      candidateIds: [`cand_${sha}`],
      aiProposalIds: [],
      preferredCandidateIdOrNull: null,
      preferenceIsNonCanonicalGuidance: false,
      sourceReferenceIds: [`src_${sha}`],
    } as const;
    expect(ExtractionConflictV1Schema.safeParse(conflict).success).toBe(false);
    expect(
      ExtractionConflictV1Schema.safeParse({
        ...conflict,
        candidateIds: [`cand_${sha}`, `cand_${"b".repeat(64)}`],
      }).success,
    ).toBe(true);

    const attempt = {
      invocationId: `ain_${sha}`,
      id: `ana_${sha}`,
      analysisConfigurationFingerprint: sha,
      extractionInputFingerprint: sha,
      analysisInputFingerprint: sha,
      providerRequestIdOrNull: null,
      tokenCountsOrNull: { input: 2, output: 3, total: 5 },
      durationMsOrNull: 1,
      ordinal: 0,
      purpose: "PRIMARY",
      status: "SUCCEEDED",
      outputFingerprintOrNull: sha,
      safeErrorCodeOrNull: null,
    } as const;
    expect(AnalysisAttemptV1Schema.safeParse(attempt).success).toBe(true);
    expect(
      AnalysisAttemptV1Schema.safeParse({
        ...attempt,
        purpose: "SYNTACTIC_REPAIR",
      }).success,
    ).toBe(false);
  });
});
