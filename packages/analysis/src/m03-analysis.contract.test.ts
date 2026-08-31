import { describe, expect, it } from "vitest";

import { M03_ANALYSIS_SUB_OPERATIONS, M03_POLICY_VERSIONS } from "@ai-ark/contracts";

import {
  buildM03OperationInputs,
  DeterministicM03AnalysisAdapter,
  validateM03RawAnalysisResponse,
} from "./index.js";

const sha = "a".repeat(64);
const referenceId = `src_${sha}`;
const candidateId = `cand_${"b".repeat(64)}`;

const context = {
  extractionInputFingerprint: sha,
  analysisConfigurationFingerprint: "c".repeat(64),
  extractorRefId: `xtr_${"d".repeat(64)}`,
  fieldRegistryVersion: M03_POLICY_VERSIONS.fieldRegistryVersion,
  rawAnalysisSchemaVersion: M03_POLICY_VERSIONS.rawAnalysisSchemaVersion,
  analysisBundleVersion: M03_POLICY_VERSIONS.analysisBundleVersion,
  subOperationPlan: M03_ANALYSIS_SUB_OPERATIONS,
  deterministicCandidates: [
    {
      id: candidateId,
      fieldKey: "capabilities",
      value: { label: "Automation", sourceReferenceIds: [referenceId] },
      normalizedKey: "automation",
      extractorRefId: `xtr_${"d".repeat(64)}`,
      supportNature: "EXACT",
      claimClass: "SOURCE_FACT",
      sourceType: "MARKDOWN_TEXT",
      sourceReferenceIds: [referenceId],
      confidence: 1,
      warningCodes: [],
      candidateFingerprint: "e".repeat(64),
    },
  ],
  deterministicConflicts: [],
  sourceReferences: [
    {
      id: referenceId,
      excerptHashOrNull: sha,
      excerptOrNull: "Automates routine work.",
      sensitive: false,
      ownership: "CANDIDATE_OWNED",
      normalizedPath: "SKILL.md",
      locatorCanonicalBytes: '{"endLine":1,"path":"SKILL.md","startLine":1,"type":"LINE_RANGE"}',
    },
  ],
  authorizeInvocation: () => Promise.resolve("PROCEED" as const),
} as const;

describe("M03 provider-neutral analysis boundary", () => {
  it("builds exactly nine isolated operation partitions and deterministic citation sets", () => {
    const input = buildM03OperationInputs(context);
    expect(input).toHaveLength(9);
    expect(input.map(({ subOperation }) => subOperation)).toEqual(M03_ANALYSIS_SUB_OPERATIONS);
    expect(input[0]).toMatchObject({
      subOperation: "NORMALIZE_CAPABILITIES",
      deterministicCandidates: [
        expect.objectContaining({
          candidateFingerprint: "e".repeat(64),
          fieldKey: "capabilities",
        }),
      ],
      allReferenceIds: [referenceId],
      citableAIReferenceIds: [referenceId],
      sourceInputs: [
        {
          sourceReferenceId: referenceId,
          state: "SUPPLIED_EXCERPT",
          excerptHash: sha,
          excerpt: "Automates routine work.",
        },
      ],
    });
    expect(input[1]?.deterministicCandidates).toEqual([]);
    expect(input.at(-1)?.deterministicCandidates).toHaveLength(1);
    expect(JSON.stringify(input)).not.toContain(candidateId);
  });

  it("includes candidate-independent semantic references and bounds excerpts without truncation", () => {
    const independentId = `src_${"e".repeat(64)}`;
    const oversizedId = `src_${"f".repeat(64)}`;
    const inputs = buildM03OperationInputs({
      ...context,
      sourceReferences: [
        ...context.sourceReferences,
        {
          id: independentId,
          excerptHashOrNull: "1".repeat(64),
          excerptOrNull: "Independent semantic paragraph.",
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "README.md",
          locatorCanonicalBytes: "independent",
          candidateIndependentFor: ["MAP_TASKS"],
        },
        {
          id: oversizedId,
          excerptHashOrNull: "2".repeat(64),
          excerptOrNull: "x".repeat(2001),
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "docs/oversized.md",
          locatorCanonicalBytes: "oversized",
          candidateIndependentFor: ["MAP_TASKS"],
        },
      ],
    });
    expect(inputs[1]?.allReferenceIds).toEqual([independentId, oversizedId].sort());
    expect(inputs[1]?.sourceInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceReferenceId: independentId, state: "SUPPLIED_EXCERPT" }),
        { sourceReferenceId: oversizedId, state: "OMITTED_BOUNDED" },
      ]),
    );
    expect(JSON.stringify(inputs)).not.toContain("x".repeat(2001));
  });

  it("does not make excerptless candidate-independent references citable", () => {
    const independentId = `src_${"9".repeat(64)}`;
    const inputs = buildM03OperationInputs({
      ...context,
      sourceReferences: [
        ...context.sourceReferences,
        {
          id: independentId,
          excerptHashOrNull: null,
          excerptOrNull: null,
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "README.md",
          locatorCanonicalBytes: "tree-path",
          candidateIndependentFor: ["MAP_TASKS"],
        },
      ],
    });
    expect(inputs[1]?.sourceInputs).toContainEqual({
      sourceReferenceId: independentId,
      state: "OMITTED_INVALID",
    });
    expect(inputs[1]?.citableAIReferenceIds).not.toContain(independentId);
  });

  it("omits sensitive candidate-backed and candidate-independent references before citability", () => {
    const independentId = `src_${"8".repeat(64)}`;
    const inputs = buildM03OperationInputs({
      ...context,
      sourceReferences: [
        { ...context.sourceReferences[0], sensitive: true },
        {
          id: independentId,
          excerptHashOrNull: null,
          excerptOrNull: null,
          sensitive: true,
          ownership: "SHARED",
          normalizedPath: "README.md",
          locatorCanonicalBytes: "sensitive-independent",
          candidateIndependentFor: ["MAP_TASKS"],
        },
      ],
    });
    expect(inputs[0]?.sourceInputs).toContainEqual({
      sourceReferenceId: referenceId,
      state: "OMITTED_SENSITIVE",
    });
    expect(inputs[0]?.citableAIReferenceIds).not.toContain(referenceId);
    expect(inputs[1]?.sourceInputs).toContainEqual({
      sourceReferenceId: independentId,
      state: "OMITTED_SENSITIVE",
    });
    expect(inputs[1]?.citableAIReferenceIds).not.toContain(independentId);
  });

  it("uses occurrence priority only for bounding and serializes references in canonical ID order", () => {
    const lowId = `src_${"0".repeat(64)}`;
    const highPriorityId = `src_${"f".repeat(64)}`;
    const inputs = buildM03OperationInputs({
      ...context,
      deterministicCandidates: [
        {
          ...context.deterministicCandidates[0],
          value: { label: "Priority", sourceReferenceIds: [highPriorityId] },
          sourceReferenceIds: [highPriorityId],
        },
      ],
      sourceReferences: [
        {
          id: highPriorityId,
          excerptHashOrNull: "1".repeat(64),
          excerptOrNull: "High-priority candidate evidence.",
          sensitive: false,
          ownership: "CANDIDATE_OWNED",
          normalizedPath: "SKILL.md",
          locatorCanonicalBytes: "z-priority",
        },
        {
          id: lowId,
          excerptHashOrNull: "2".repeat(64),
          excerptOrNull: "Lower-priority independent evidence.",
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "README.md",
          locatorCanonicalBytes: "a-independent",
          candidateIndependentFor: ["NORMALIZE_CAPABILITIES"],
        },
      ],
    });
    expect(inputs[0]?.allReferenceIds).toEqual([lowId, highPriorityId]);
    expect(inputs[0]?.citableAIReferenceIds).toEqual([lowId, highPriorityId]);
    expect(inputs[0]?.sourceInputs.map(({ sourceReferenceId }) => sourceReferenceId)).toEqual([
      lowId,
      highPriorityId,
    ]);
  });

  it("uses every non-ambiguity operation owner when prioritizing candidate-independent excerpts", () => {
    const fillerReferences = Array.from({ length: 15 }, (_, index) => ({
      id: `src_${index.toString(16).padStart(64, "0")}`,
      excerptHashOrNull: index.toString(16).padStart(64, "1"),
      excerptOrNull: "f".repeat(2000),
      sensitive: false,
      ownership: "SHARED" as const,
      normalizedPath: `docs/filler-${index.toString().padStart(2, "0")}.md`,
      locatorCanonicalBytes: `filler-${index.toString().padStart(2, "0")}`,
      candidateIndependentFor: ["SYNTHESIZE_OUTCOME" as const],
    }));
    const higherPriorityId = `src_${"e".repeat(64)}`;
    const lowerPriorityId = `src_${"d".repeat(64)}`;
    const inputs = buildM03OperationInputs({
      ...context,
      deterministicCandidates: [],
      sourceReferences: [
        ...fillerReferences,
        {
          id: higherPriorityId,
          excerptHashOrNull: "a".repeat(64),
          excerptOrNull: "h".repeat(2000),
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "z-higher-priority.md",
          locatorCanonicalBytes: "z-higher-priority",
          candidateIndependentFor: ["SYNTHESIZE_BEST_FOR_NOT_IDEAL"],
        },
        {
          id: lowerPriorityId,
          excerptHashOrNull: "b".repeat(64),
          excerptOrNull: "l",
          sensitive: false,
          ownership: "SHARED",
          normalizedPath: "a-lower-priority.md",
          locatorCanonicalBytes: "a-lower-priority",
          candidateIndependentFor: ["SYNTHESIZE_LIMITATIONS"],
        },
      ],
    });
    const bestFor = inputs.find(
      ({ subOperation }) => subOperation === "SYNTHESIZE_BEST_FOR_NOT_IDEAL",
    );
    const limitations = inputs.find(
      ({ subOperation }) => subOperation === "SYNTHESIZE_LIMITATIONS",
    );
    expect(bestFor?.sourceInputs).toContainEqual(
      expect.objectContaining({
        sourceReferenceId: higherPriorityId,
        state: "SUPPLIED_EXCERPT",
      }),
    );
    expect(limitations?.sourceInputs).toContainEqual({
      sourceReferenceId: lowerPriorityId,
      state: "OMITTED_BOUNDED",
    });
  });

  it("checks control immediately before primary and again before syntactic repair", async () => {
    const repaired = Buffer.from(
      JSON.stringify({ schemaVersion: "m03-analysis-raw-v1", proposals: [] }),
    );
    const stoppedBeforePrimary = new DeterministicM03AnalysisAdapter([Buffer.from("{"), repaired]);
    const cancelled = await stoppedBeforePrimary.analyze({
      ...context,
      authorizeInvocation: () => Promise.resolve("CANCELLED"),
    });
    expect(cancelled).toMatchObject({ controlTerminationOrNull: "CANCELLED", attempts: [] });
    expect(stoppedBeforePrimary.callCount).toBe(0);

    const stoppedBeforeRepair = new DeterministicM03AnalysisAdapter([Buffer.from("{"), repaired]);
    const guards: string[] = [];
    const superseded = await stoppedBeforeRepair.analyze({
      ...context,
      authorizeInvocation: (_ordinal, purpose) => {
        guards.push(purpose);
        return Promise.resolve(purpose === "PRIMARY" ? "PROCEED" : "SUPERSEDED_INPUT");
      },
    });
    expect(guards).toEqual(["PRIMARY", "SYNTACTIC_REPAIR"]);
    expect(superseded).toMatchObject({
      controlTerminationOrNull: "SUPERSEDED_INPUT",
      attempts: [expect.objectContaining({ status: "INVALID_OUTPUT" })],
    });
    expect(stoppedBeforeRepair.callCount).toBe(1);
  });

  it("retains typed timeout and provider-failure attempts without authorizing repair", async () => {
    const timedOut = new DeterministicM03AnalysisAdapter([{ kind: "TIMED_OUT" }]);
    const failed = new DeterministicM03AnalysisAdapter([{ kind: "FAILED" }]);
    const [timeoutResult, failureResult] = await Promise.all([
      timedOut.analyze(context),
      failed.analyze(context),
    ]);
    expect(timeoutResult).toMatchObject({
      unrecoveredError: true,
      attempts: [
        expect.objectContaining({
          status: "TIMED_OUT",
          outputFingerprintOrNull: null,
          safeErrorCodeOrNull: "ANALYSIS_TIMED_OUT",
        }),
      ],
    });
    expect(failureResult).toMatchObject({
      unrecoveredError: true,
      attempts: [
        expect.objectContaining({
          status: "FAILED",
          outputFingerprintOrNull: null,
          safeErrorCodeOrNull: "ANALYSIS_FAILED",
        }),
      ],
    });
    expect(timeoutResult.attempts[0]?.id).not.toBe(failureResult.attempts[0]?.id);
    expect(timedOut.callCount).toBe(1);
    expect(failed.callCount).toBe(1);
  });

  it("compares exact raw provider bytes before accepting an equal output fingerprint", async () => {
    let retained: string | null = null;
    const fingerprintRawOutput = (bytes: Uint8Array) => {
      const current = Buffer.from(bytes).toString("base64");
      if (retained !== null && retained !== current)
        throw new Error("CONTENT_DERIVED_ID_COLLISION");
      retained = current;
      return "f".repeat(64);
    };
    const first = new DeterministicM03AnalysisAdapter([
      Buffer.from(JSON.stringify({ schemaVersion: "m03-analysis-raw-v1", proposals: [] })),
    ]);
    await first.analyze({ ...context, fingerprintRawOutput });
    const second = new DeterministicM03AnalysisAdapter([Buffer.from("{")]);
    await expect(second.analyze({ ...context, fingerprintRawOutput })).rejects.toThrow(
      "CONTENT_DERIVED_ID_COLLISION",
    );
  });

  it("attributes a valid raw response to immutable attempt and proposal identities", () => {
    const operationInputs = buildM03OperationInputs(context);
    const raw = JSON.stringify({
      schemaVersion: "m03-analysis-raw-v1",
      proposals: [
        {
          kind: "FIELD_PROPOSAL",
          localOrdinal: 0,
          subOperation: "NORMALIZE_CAPABILITIES",
          targetFieldKey: "capabilities",
          value: {
            text: "Automates routine work",
            normalizedKey: "automates routine work",
            proposalKind: "CAPABILITY",
            targetFieldKey: "capabilities",
            taxonomyBinding: {
              mappingState: "TAXONOMY_CANDIDATE",
              taxonomyIdOrNull: null,
              taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
              taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
            },
            sourceReferenceIds: [referenceId],
          },
          confidence: 0.9,
          claimClass: "AI_INFERENCE",
          sourceReferenceIds: [referenceId],
          warningCodes: ["TAXONOMY_CANDIDATE"],
        },
      ],
    });
    const result = validateM03RawAnalysisResponse({
      ...context,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: Buffer.from(raw),
    });
    expect(result.status).toBe("SUCCEEDED");
    if (result.status !== "SUCCEEDED") throw new Error("expected success");
    expect(result.attempt).toMatchObject({
      ordinal: 0,
      purpose: "PRIMARY",
      status: "SUCCEEDED",
      outputFingerprintOrNull: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(result.proposals[0]).toMatchObject({
      id: expect.stringMatching(/^aip_[a-f0-9]{64}$/u),
      analysisAttemptId: result.attempt.id,
      extractorRefId: context.extractorRefId,
      targetFieldKey: "capabilities",
      claimClass: "AI_INFERENCE",
      confidence: 0.9,
    });
  });

  it("rejects identity-equivalent duplicate field proposals as semantic invalidity", () => {
    const operationInputs = buildM03OperationInputs(context);
    const proposal = {
      kind: "FIELD_PROPOSAL",
      localOrdinal: 0,
      subOperation: "NORMALIZE_CAPABILITIES",
      targetFieldKey: "capabilities",
      value: {
        text: "Automates routine work",
        normalizedKey: "automates routine work",
        proposalKind: "CAPABILITY",
        targetFieldKey: "capabilities",
        taxonomyBinding: {
          mappingState: "TAXONOMY_CANDIDATE",
          taxonomyIdOrNull: null,
          taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
          taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
        },
        sourceReferenceIds: [referenceId],
      },
      confidence: 0.9,
      claimClass: "AI_INFERENCE",
      sourceReferenceIds: [referenceId],
      warningCodes: ["TAXONOMY_CANDIDATE"],
    };
    expect(
      validateM03RawAnalysisResponse({
        ...context,
        operationInputs,
        ordinal: 0,
        purpose: "PRIMARY",
        priorInvalidOutputFingerprintOrNull: null,
        rawResponseBytes: Buffer.from(
          JSON.stringify({
            schemaVersion: "m03-analysis-raw-v1",
            proposals: [proposal, { ...proposal, localOrdinal: 1 }],
          }),
        ),
      }),
    ).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: false,
      attempt: { status: "INVALID_OUTPUT", invalidityClass: "SEMANTIC_OR_POLICY" },
    });
  });

  it("rejects noncanonical references and any inexact proposal-owned warning set", () => {
    const secondReferenceId = `src_${"f".repeat(64)}`;
    const expandedContext = {
      ...context,
      sourceReferences: [
        ...context.sourceReferences,
        {
          id: secondReferenceId,
          excerptHashOrNull: "f".repeat(64),
          excerptOrNull: "Second capability reference.",
          sensitive: false,
          ownership: "CANDIDATE_OWNED" as const,
          normalizedPath: "SKILL.md",
          locatorCanonicalBytes: "second-capability-reference",
          candidateIndependentFor: ["NORMALIZE_CAPABILITIES"] as const,
        },
      ],
    };
    const operationInputs = buildM03OperationInputs(expandedContext);
    const proposal = {
      kind: "FIELD_PROPOSAL",
      localOrdinal: 0,
      subOperation: "NORMALIZE_CAPABILITIES",
      targetFieldKey: "capabilities",
      value: {
        text: "Automates routine work",
        normalizedKey: "automates routine work",
        proposalKind: "CAPABILITY",
        targetFieldKey: "capabilities",
        taxonomyBinding: {
          mappingState: "TAXONOMY_CANDIDATE",
          taxonomyIdOrNull: null,
          taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
          taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
        },
        sourceReferenceIds: [referenceId, secondReferenceId],
      },
      confidence: 0.5,
      claimClass: "AI_INFERENCE",
      sourceReferenceIds: [referenceId, secondReferenceId],
      warningCodes: ["TAXONOMY_CANDIDATE", "LOW_CONFIDENCE"],
    };
    const invalidProposals = [
      { ...proposal, warningCodes: ["LOW_CONFIDENCE"] },
      {
        ...proposal,
        warningCodes: ["TAXONOMY_CANDIDATE", "LOW_CONFIDENCE", "ARCHIVED_SOURCE"],
      },
      { ...proposal, warningCodes: ["LOW_CONFIDENCE", "TAXONOMY_CANDIDATE"] },
      {
        ...proposal,
        sourceReferenceIds: [secondReferenceId, referenceId],
        value: {
          ...proposal.value,
          sourceReferenceIds: [secondReferenceId, referenceId],
        },
      },
    ];
    for (const invalidProposal of invalidProposals) {
      expect(
        validateM03RawAnalysisResponse({
          ...expandedContext,
          operationInputs,
          ordinal: 0,
          purpose: "PRIMARY",
          priorInvalidOutputFingerprintOrNull: null,
          rawResponseBytes: Buffer.from(
            JSON.stringify({
              schemaVersion: "m03-analysis-raw-v1",
              proposals: [invalidProposal],
            }),
          ),
        }),
      ).toMatchObject({
        status: "INVALID_OUTPUT",
        repairable: false,
        attempt: { invalidityClass: "SEMANTIC_OR_POLICY" },
      });
    }
  });

  it("classifies proposal-count overflow as a non-repairable analysis limit", () => {
    const operationInputs = buildM03OperationInputs(context);
    const raw = Buffer.from(
      JSON.stringify({
        schemaVersion: "m03-analysis-raw-v1",
        proposals: Array.from({ length: 513 }, (_, localOrdinal) => ({ localOrdinal })),
      }),
    );
    const result = validateM03RawAnalysisResponse({
      ...context,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: raw,
    });
    expect(result).toMatchObject({
      status: "LIMIT_EXCEEDED",
      repairable: false,
      attempt: {
        status: "LIMIT_EXCEEDED",
        safeErrorCodeOrNull: "ANALYSIS_LIMIT_EXCEEDED",
        invalidityClass: "LIMIT",
      },
    });
  });

  it("classifies one normalized proposal text over its ceiling as an analysis limit", () => {
    const operationInputs = buildM03OperationInputs(context);
    const raw = Buffer.from(
      JSON.stringify({
        schemaVersion: "m03-analysis-raw-v1",
        proposals: [
          {
            kind: "FIELD_PROPOSAL",
            localOrdinal: 0,
            subOperation: "NORMALIZE_CAPABILITIES",
            targetFieldKey: "capabilities",
            value: {
              text: "x".repeat(1001),
              normalizedKey: "x".repeat(1000),
              proposalKind: "CAPABILITY",
              targetFieldKey: "capabilities",
              taxonomyBinding: {
                mappingState: "TAXONOMY_CANDIDATE",
                taxonomyIdOrNull: null,
                taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
                taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
              },
              sourceReferenceIds: [referenceId],
            },
            confidence: 0.9,
            claimClass: "AI_INFERENCE",
            sourceReferenceIds: [referenceId],
            warningCodes: ["TAXONOMY_CANDIDATE"],
          },
        ],
      }),
    );
    expect(
      validateM03RawAnalysisResponse({
        ...context,
        operationInputs,
        ordinal: 0,
        purpose: "PRIMARY",
        priorInvalidOutputFingerprintOrNull: null,
        rawResponseBytes: raw,
      }),
    ).toMatchObject({
      status: "LIMIT_EXCEEDED",
      repairable: false,
      attempt: {
        status: "LIMIT_EXCEEDED",
        safeErrorCodeOrNull: "ANALYSIS_LIMIT_EXCEEDED",
        invalidityClass: "LIMIT",
      },
    });
  });

  it("classifies malformed JSON as repairable but invented citations as nonrepairable", () => {
    const operationInputs = buildM03OperationInputs(context);
    const malformed = validateM03RawAnalysisResponse({
      ...context,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: Buffer.from("{"),
    });
    expect(malformed).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: true,
      attempt: { invalidityClass: "SYNTACTIC_OR_SCHEMA_SHAPE" },
    });

    const invented = validateM03RawAnalysisResponse({
      ...context,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: Buffer.from(
        JSON.stringify({
          schemaVersion: "m03-analysis-raw-v1",
          proposals: [
            {
              kind: "FIELD_PROPOSAL",
              localOrdinal: 0,
              subOperation: "NORMALIZE_CAPABILITIES",
              targetFieldKey: "capabilities",
              value: {
                text: "Invented",
                normalizedKey: "invented",
                proposalKind: "CAPABILITY",
                targetFieldKey: "capabilities",
                taxonomyBinding: {
                  mappingState: "TAXONOMY_CANDIDATE",
                  taxonomyIdOrNull: null,
                  taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
                  taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
                },
                sourceReferenceIds: [`src_${"f".repeat(64)}`],
              },
              confidence: 0.9,
              claimClass: "AI_INFERENCE",
              sourceReferenceIds: [`src_${"f".repeat(64)}`],
              warningCodes: ["TAXONOMY_CANDIDATE"],
            },
          ],
        }),
      ),
    });
    expect(invented).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: false,
      attempt: { invalidityClass: "SEMANTIC_OR_POLICY" },
    });
  });

  it("resolves raw ambiguity ordinals only after field proposal IDs exist", () => {
    const operationInputs = buildM03OperationInputs(context);
    const result = validateM03RawAnalysisResponse({
      ...context,
      operationInputs,
      ordinal: 0,
      purpose: "PRIMARY",
      priorInvalidOutputFingerprintOrNull: null,
      rawResponseBytes: Buffer.from(
        JSON.stringify({
          schemaVersion: "m03-analysis-raw-v1",
          proposals: [
            {
              kind: "FIELD_PROPOSAL",
              localOrdinal: 0,
              subOperation: "NORMALIZE_CAPABILITIES",
              targetFieldKey: "capabilities",
              value: {
                text: "Transforms routine work",
                normalizedKey: "transforms routine work",
                proposalKind: "CAPABILITY",
                targetFieldKey: "capabilities",
                taxonomyBinding: {
                  mappingState: "TAXONOMY_CANDIDATE",
                  taxonomyIdOrNull: null,
                  taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
                  taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
                },
                sourceReferenceIds: [referenceId],
              },
              confidence: 0.9,
              claimClass: "AI_INFERENCE",
              sourceReferenceIds: [referenceId],
              warningCodes: ["TAXONOMY_CANDIDATE"],
            },
            {
              kind: "AMBIGUITY_SIGNAL",
              localOrdinal: 1,
              subOperation: "DETECT_AMBIGUITY",
              targetFieldKey: "capabilities",
              reason: "DETERMINISTIC_AI_DISAGREEMENT",
              candidateIds: [candidateId],
              interpretedProposalOrdinals: [0],
              confidence: 1,
              sourceReferenceIds: [referenceId],
              warningCodes: [],
            },
            {
              kind: "AMBIGUITY_SIGNAL",
              localOrdinal: 2,
              subOperation: "DETECT_AMBIGUITY",
              targetFieldKey: "capabilities",
              reason: "DETERMINISTIC_AI_DISAGREEMENT",
              candidateIds: [candidateId],
              interpretedProposalOrdinals: [0],
              confidence: 1,
              sourceReferenceIds: [referenceId],
              warningCodes: [],
            },
          ],
        }),
      ),
    });
    expect(result.status).toBe("SUCCEEDED");
    if (result.status !== "SUCCEEDED") throw new Error("expected success");
    expect(result.proposals).toHaveLength(2);
    expect(result.proposals[1]).toMatchObject({
      kind: "AMBIGUITY_SIGNAL",
      id: expect.stringMatching(/^aip_[a-f0-9]{64}$/u),
      analysisAttemptId: result.attempt.id,
      interpretedAIProposalIds: [result.proposals[0]?.id],
      candidateIds: [candidateId],
      warningCodes: [],
    });
  });

  it("rejects prohibited claims and contact/credential-like output without repair", () => {
    const operationInputs = buildM03OperationInputs(context);
    const invalidText = (text: string) =>
      validateM03RawAnalysisResponse({
        ...context,
        operationInputs,
        ordinal: 0,
        purpose: "PRIMARY",
        priorInvalidOutputFingerprintOrNull: null,
        rawResponseBytes: Buffer.from(
          JSON.stringify({
            schemaVersion: "m03-analysis-raw-v1",
            proposals: [
              {
                kind: "FIELD_PROPOSAL",
                localOrdinal: 0,
                subOperation: "NORMALIZE_CAPABILITIES",
                targetFieldKey: "capabilities",
                value: {
                  text,
                  normalizedKey: text.toLowerCase(),
                  proposalKind: "CAPABILITY",
                  targetFieldKey: "capabilities",
                  taxonomyBinding: {
                    mappingState: "TAXONOMY_CANDIDATE",
                    taxonomyIdOrNull: null,
                    taxonomyRegistryVersion: M03_POLICY_VERSIONS.taxonomyRegistryVersion,
                    taxonomyRegistryFingerprint: M03_POLICY_VERSIONS.taxonomyRegistryFingerprint,
                  },
                  sourceReferenceIds: [referenceId],
                },
                confidence: 0.9,
                claimClass: "AI_INFERENCE",
                sourceReferenceIds: [referenceId],
                warningCodes: ["TAXONOMY_CANDIDATE"],
              },
            ],
          }),
        ),
      });
    expect(invalidText("Production-ready automation")).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: false,
      attempt: { invalidityClass: "SEMANTIC_OR_POLICY" },
    });
    expect(invalidText("Contact maintainer@example.com")).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: false,
      attempt: { invalidityClass: "SEMANTIC_OR_POLICY" },
    });
    expect(invalidText("api_key=synthetic-placeholder-value")).toMatchObject({
      status: "INVALID_OUTPUT",
      repairable: false,
      attempt: { invalidityClass: "SEMANTIC_OR_POLICY" },
    });
  });
});
