import { describe, expect, it } from "vitest";

import {
  GenerateDraftRequestV1Schema,
  GenerateDraftResultV1Schema,
  DraftRevisionV1Schema,
  DraftItemV1Schema,
  DraftSectionV1Schema,
  M05InputManifestV1Schema,
  M05PolicyArtifactsV1Schema,
  M05ProvenanceIndexV1Schema,
  M05_SECTION_KEYS,
  M05_TEMPLATE_IDS,
} from "./m05.js";

const request = {
  schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
  idempotencyKey: "key-1",
  bindingId: `bnd_${"a".repeat(64)}`,
  extractionId: `ext_${"b".repeat(64)}`,
  expectedBindingFingerprint: "a".repeat(64),
  mode: "DETERMINISTIC",
  regenerationToken: "generation-1",
  policyVersion: "m05-draft-policy-v1",
  methodologyVersion: "m05-draft-methodology-v1",
  promptBundleVersion: "m05-draft-prompt-v1",
  providerConfigIdOrNull: null,
} as const;

describe("M05 contracts", () => {
  it("accepts the exact deterministic request and rejects unknown keys", () => {
    expect(GenerateDraftRequestV1Schema.parse(request)).toEqual(request);
    expect(GenerateDraftRequestV1Schema.safeParse({ ...request, extra: true }).success).toBe(false);
  });

  it("enforces provider configuration mode closure", () => {
    expect(
      GenerateDraftRequestV1Schema.safeParse({
        ...request,
        mode: "AI_ASSISTED",
        providerConfigIdOrNull: null,
      }).success,
    ).toBe(false);
    expect(
      GenerateDraftRequestV1Schema.safeParse({
        ...request,
        mode: "AI_ASSISTED",
        providerConfigIdOrNull: "fixture-provider-v1",
      }).success,
    ).toBe(true);
  });

  it("rejects non-scalar and oversized opaque keys", () => {
    expect(
      GenerateDraftRequestV1Schema.safeParse({ ...request, idempotencyKey: "\ud800" }).success,
    ).toBe(false);
    expect(
      GenerateDraftRequestV1Schema.safeParse({ ...request, regenerationToken: "界".repeat(67) })
        .success,
    ).toBe(false);
  });

  it("freezes the fourteen sections and seven template IDs", () => {
    expect(M05_SECTION_KEYS).toHaveLength(14);
    expect(new Set(M05_SECTION_KEYS).size).toBe(14);
    expect(M05_TEMPLATE_IDS).toHaveLength(7);
  });

  it("keeps each result arm closed", () => {
    const accepted = {
      schemaVersion: "M05_GENERATE_DRAFT_RESULT_V1",
      kind: "ACCEPTED",
      revisionId: `drv_${"c".repeat(64)}`,
      inputFingerprint: "d".repeat(64),
      outputFingerprint: "e".repeat(64),
      recordFingerprint: "f".repeat(64),
      replayed: false,
    } as const;
    expect(GenerateDraftResultV1Schema.parse(accepted)).toEqual(accepted);
    expect(
      GenerateDraftResultV1Schema.safeParse({ ...accepted, requestFingerprint: "0".repeat(64) })
        .success,
    ).toBe(false);
  });

  it("keeps policy, manifest, and provenance nested objects closed", () => {
    const policy = {
      schemaVersion: "M05_POLICY_ARTIFACTS_V1",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      promptUtf8Hex: "61",
      atomTemplateUtf8Hex: "62",
      providerConfigOrNull: null,
    } as const;
    expect(M05PolicyArtifactsV1Schema.parse(policy)).toEqual(policy);
    expect(
      M05PolicyArtifactsV1Schema.safeParse({ ...policy, endpoint: "https://example.test" }).success,
    ).toBe(false);
    const manifest = {
      schemaVersion: "M05_INPUT_MANIFEST_V1",
      byteLength: 65_537,
      chunkCount: 2,
      payloadSha256: "a".repeat(64),
      chunkHashes: ["b".repeat(64), "c".repeat(64)],
      inputFingerprint: "d".repeat(64),
      sourceFingerprint: "e".repeat(64),
      policyFingerprint: "f".repeat(64),
    } as const;
    expect(M05InputManifestV1Schema.parse(manifest)).toEqual(manifest);
    expect(M05InputManifestV1Schema.safeParse({ ...manifest, chunkCount: 1 }).success).toBe(false);
    const provenance = {
      schemaVersion: "M05_PROVENANCE_INDEX_V1",
      lineage: {
        bindingId: `bnd_${"a".repeat(64)}`,
        extractionId: `ext_${"b".repeat(64)}`,
        resourceIdentityId: "resource",
        resourceVersionIdentityId: "version",
        sourceSnapshotId: "snapshot",
        sourceRevision: "c".repeat(40),
        m03OutputFingerprint: "d".repeat(64),
        completenessId: `cmp_${"e".repeat(64)}`,
        completenessRecordFingerprint: "f".repeat(64),
      },
      policy: {
        policyVersion: "m05-draft-policy-v1",
        methodologyVersion: "m05-draft-methodology-v1",
        promptBundleVersion: "m05-draft-prompt-v1",
        promptArtifactSha256: "1".repeat(64),
        atomTemplateArtifactSha256: "2".repeat(64),
        providerConfigFingerprintOrNull: null,
        providerOrNull: null,
        modelOrNull: null,
      },
      claimBindings: [],
      omissions: [],
    } as const;
    expect(M05ProvenanceIndexV1Schema.parse(provenance)).toEqual(provenance);
    expect(M05ProvenanceIndexV1Schema.safeParse({ ...provenance, foreignIds: [] }).success).toBe(
      false,
    );
    const binding = (fieldKey: "license" | "canonical_skill_name", suffix: string) => ({
      claimId: `clm_${suffix.repeat(64)}`,
      fieldKey,
      originalClass: "SOURCE_FACT" as const,
      originalStatus: "SUPPORTED_WITH_QUALIFIER" as const,
      qualifierCodes: ["NOT_RUNTIME_VERIFIED"] as const,
      evidenceLinkIds: [],
      evidenceItemIds: [],
    });
    expect(
      M05ProvenanceIndexV1Schema.safeParse({
        ...provenance,
        claimBindings: [binding("license", "a"), binding("canonical_skill_name", "b")],
      }).success,
    ).toBe(false);
    expect(
      M05ProvenanceIndexV1Schema.safeParse({
        ...provenance,
        claimBindings: [
          {
            ...binding("license", "a"),
            qualifierCodes: ["INFERRED_SUITABILITY", "RULE_INFERENCE"],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      M05ProvenanceIndexV1Schema.safeParse({
        ...provenance,
        omissions: [
          { sectionKey: "CAPABILITIES", atomIds: [`dat_${"a".repeat(64)}`], reason: "UNSAFE" },
          { sectionKey: "IDENTITY", atomIds: [`dat_${"b".repeat(64)}`], reason: "OPTIONAL_LIMIT" },
        ],
      }).success,
    ).toBe(false);
  });

  it("enforces exact artifact, identifier, text, section, and manifest limits", () => {
    const policy = {
      schemaVersion: "M05_POLICY_ARTIFACTS_V1",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      promptUtf8Hex: Buffer.alloc(65_536, 0x61).toString("hex"),
      atomTemplateUtf8Hex: "61",
      providerConfigOrNull: null,
    } as const;
    expect(M05PolicyArtifactsV1Schema.safeParse(policy).success).toBe(true);
    expect(
      M05PolicyArtifactsV1Schema.safeParse({
        ...policy,
        promptUtf8Hex: `${policy.promptUtf8Hex}61`,
      }).success,
    ).toBe(false);
    const item = {
      atomId: `dat_${"a".repeat(64)}`,
      templateId: "SOURCE_DECLARATION",
      text: "界".repeat(400),
      claimIds: [`clm_${"b".repeat(64)}`],
      evidenceLinkIds: [],
      evidenceItemIds: [],
      originalClaimClasses: ["SOURCE_FACT"],
      originalStatuses: ["SUPPORTED"],
      displayClass: "SOURCE_FACT",
      qualifierCodes: [],
    } as const;
    expect(DraftItemV1Schema.safeParse(item).success).toBe(true);
    expect(DraftItemV1Schema.safeParse({ ...item, text: `${item.text}界` }).success).toBe(false);
    const section = {
      key: "IDENTITY",
      state: "PRESENT",
      items: Array.from({ length: 12 }, (_, index) => ({
        ...item,
        atomId: `dat_${index.toString(16).padStart(64, "0")}`,
      })),
      omittedItemCount: 0,
    } as const;
    expect(DraftSectionV1Schema.safeParse(section).success).toBe(true);
    expect(
      DraftSectionV1Schema.safeParse({ ...section, items: [...section.items, item] }).success,
    ).toBe(false);
    expect(
      M05InputManifestV1Schema.safeParse({
        schemaVersion: "M05_INPUT_MANIFEST_V1",
        byteLength: 268_435_456,
        chunkCount: 4096,
        payloadSha256: "a".repeat(64),
        chunkHashes: Array.from({ length: 4096 }, () => "b".repeat(64)),
        inputFingerprint: "c".repeat(64),
        sourceFingerprint: "d".repeat(64),
        policyFingerprint: "e".repeat(64),
      }).success,
    ).toBe(true);
    expect(
      M05InputManifestV1Schema.safeParse({
        schemaVersion: "M05_INPUT_MANIFEST_V1",
        byteLength: 268_435_457,
        chunkCount: 4096,
        payloadSha256: "a".repeat(64),
        chunkHashes: Array.from({ length: 4096 }, () => "b".repeat(64)),
        inputFingerprint: "c".repeat(64),
        sourceFingerprint: "d".repeat(64),
        policyFingerprint: "e".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("enforces exact aggregate item, outcome, and visible-scalar limits", () => {
    const provenanceIndex = {
      schemaVersion: "M05_PROVENANCE_INDEX_V1",
      lineage: {
        bindingId: `bnd_${"a".repeat(64)}`,
        extractionId: `ext_${"b".repeat(64)}`,
        resourceIdentityId: "resource",
        resourceVersionIdentityId: "version",
        sourceSnapshotId: "snapshot",
        sourceRevision: "c".repeat(40),
        m03OutputFingerprint: "d".repeat(64),
        completenessId: `cmp_${"e".repeat(64)}`,
        completenessRecordFingerprint: "f".repeat(64),
      },
      policy: {
        policyVersion: "m05-draft-policy-v1",
        methodologyVersion: "m05-draft-methodology-v1",
        promptBundleVersion: "m05-draft-prompt-v1",
        promptArtifactSha256: "1".repeat(64),
        atomTemplateArtifactSha256: "2".repeat(64),
        providerConfigFingerprintOrNull: null,
        providerOrNull: null,
        modelOrNull: null,
      },
      claimBindings: [],
      omissions: [],
    } as const;
    const item = (ordinal: number, text = "x") => ({
      atomId: `dat_${ordinal.toString(16).padStart(64, "0")}`,
      templateId: "PROVENANCE" as const,
      text,
      claimIds: [],
      evidenceLinkIds: [],
      evidenceItemIds: [],
      originalClaimClasses: [],
      originalStatuses: [],
      displayClass: "PROVENANCE_METADATA" as const,
      qualifierCodes: [],
    });
    const revisionWithItems = (count: number) => {
      let ordinal = 0;
      const sections = M05_SECTION_KEYS.map((key) => {
        const limit = key === "CAPABILITIES" ? 6 : 12;
        const items = Array.from({ length: Math.min(limit, Math.max(0, count - ordinal)) }, () =>
          item(ordinal++),
        );
        return {
          key,
          state: items.length === 0 ? ("NOT_PROVIDED" as const) : ("PRESENT" as const),
          items,
          omittedItemCount: 0,
        };
      });
      return {
        schemaVersion: "M05_DRAFT_REVISION_V1" as const,
        revisionId: `drv_${"3".repeat(64)}`,
        recordFingerprint: "4".repeat(64),
        inputFingerprint: "5".repeat(64),
        generationFingerprint: "6".repeat(64),
        outputFingerprint: "7".repeat(64),
        bindingId: `bnd_${"a".repeat(64)}`,
        extractionId: `ext_${"b".repeat(64)}`,
        sourceFingerprint: "8".repeat(64),
        policyFingerprint: "9".repeat(64),
        mode: "DETERMINISTIC" as const,
        regenerationToken: "generation",
        label: "AI-generated draft — human review required" as const,
        state: "UNAPPROVED" as const,
        sections,
        provenanceIndex,
        generatedAt: "2026-01-01T00:00:00.000Z",
        metrics: {
          providerOrNull: null,
          modelOrNull: null,
          attemptCount: 0 as const,
          durationMs: 0,
          inputTokensOrNull: null,
          outputTokensOrNull: null,
        },
      };
    };
    const exactItems = revisionWithItems(64);
    expect(DraftRevisionV1Schema.safeParse(exactItems).success).toBe(true);
    expect(DraftRevisionV1Schema.safeParse(revisionWithItems(65)).success).toBe(false);
    const outcome = exactItems.sections.find(({ key }) => key === "OUTCOME_STATEMENT");
    if (outcome?.items[0] === undefined) throw new Error("M05_OUTCOME_LIMIT_FIXTURE_MISSING");
    outcome.items[0].text = "x".repeat(240);
    expect(DraftRevisionV1Schema.safeParse(exactItems).success).toBe(true);
    outcome.items[0].text = "x".repeat(241);
    expect(DraftRevisionV1Schema.safeParse(exactItems).success).toBe(false);

    const scalarExact = revisionWithItems(64);
    const visibleBase =
      Array.from(scalarExact.label).length +
      scalarExact.sections.reduce((total, section) => total + Array.from(section.key).length, 0);
    let remaining = 12_000 - visibleBase;
    const scalarEntries = scalarExact.sections.flatMap((section) =>
      section.items.map((entry) => ({ entry, sectionKey: section.key })),
    );
    for (const [index, { entry, sectionKey }] of scalarEntries.entries()) {
      const maximum = sectionKey === "OUTCOME_STATEMENT" ? 240 : 400;
      const laterMinimum = scalarEntries.length - index - 1;
      const length = Math.min(maximum, remaining - laterMinimum);
      entry.text = "x".repeat(length);
      remaining -= length;
    }
    expect(remaining).toBe(0);
    expect(DraftRevisionV1Schema.safeParse(scalarExact).success).toBe(true);
    const expandable = scalarExact.sections
      .flatMap(({ items }) => items)
      .find(({ text }) => text.length < 400);
    if (expandable === undefined) throw new Error("M05_SCALAR_LIMIT_FIXTURE_MISSING");
    expandable.text += "x";
    expect(DraftRevisionV1Schema.safeParse(scalarExact).success).toBe(false);
  });
});
