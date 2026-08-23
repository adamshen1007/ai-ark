import { describe, expect, it } from "vitest";

import {
  ManualResolutionCoordinator,
  createGuardKey,
  deriveRequiredExpectedVersionKeys,
  manualResolutionPayloadKeys,
  type IdentityManualResolutionCommand,
} from "./index.js";

const resourceVersionGuardRef = {
  kind: "RESOURCE_VERSION_ANCHOR" as const,
  resourceIdentityRef: {
    kind: "RESOURCE_IDENTITY_ANCHOR" as const,
    originCandidateId: "candidate-anchor",
  },
  contentFingerprint: "a".repeat(64),
};

const commands: readonly IdentityManualResolutionCommand[] = [
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
];

function envelope(command: IdentityManualResolutionCommand, index: number) {
  const resourceIdentityId = ["CREATE_RESOURCE", "MARK_FORK"].includes(command)
    ? "resource-new"
    : "resource-existing";
  const fullPayload = {
    jobId: "job-1",
    candidateRootId: "root-1",
    classificationRunId: "run-1",
    decisionId: "decision-new",
    resourceIdentityId,
    resourceVersionIdentityId: "version-new",
    provider: "github",
    providerRepositoryId: "repo-1",
    normalizedRoot: ".",
    contentFingerprint: "a".repeat(64),
    reliableIdentityToken: "demo-skill",
    reliableTokenEvidenceId: "evidence-1",
    sourceLinkId: "source-link-new",
    originResourceVersionId: "version-origin",
    priorResourceVersionIdentityId: "version-prior",
    activeSourceLinkId: "source-link-active",
    continuityEvidenceIds: "evidence-1",
    forkResourceVersionId: "version-new",
    relationshipId: "relationship-new",
    targetResourceVersionId: "version-target",
    targetResourceIdentityId: "resource-existing",
    identicalContentFingerprint: "a".repeat(64),
    mirrorSourceRepositoryId: "source-mirror",
    originSourceRepositoryId: "source-origin",
    duplicateId: "duplicate-new",
    originalCandidateIds: "candidate-old",
    originalRootIds: "root-old",
    replacementCandidateIds:
      command === "SPLIT_ROOTS" ? "candidate-new-a,candidate-new-b" : "candidate-new",
    replacementRootIds: command === "SPLIT_ROOTS" ? "root-new-a,root-new-b" : "root-new",
    replacementRootsJson:
      command === "SPLIT_ROOTS"
        ? '[{"id":"root-new-a","normalizedPath":"skills/a"},{"id":"root-new-b","normalizedPath":"skills/b"}]'
        : '[{"id":"root-new","normalizedPath":"skills/new"}]',
    replacementOwnershipJson:
      command === "SPLIT_ROOTS"
        ? '[{"rootId":"root-new-a","sourceEntryId":"entry-a","ownership":"OWNED"},{"rootId":"root-new-b","sourceEntryId":"entry-b","ownership":"OWNED"}]'
        : '[{"rootId":"root-new","sourceEntryId":"entry-1","ownership":"OWNED"}]',
    selectedRootPathsJson: '["skills/new"]',
    reviewId: "review-1",
    clarificationId: "clarification-new",
    questionCode: "IDENTITY_EVIDENCE_REQUIRED",
    evidenceGapsJson: '["reliable-token"]',
    requestedResponderClass: "TECHNICAL_REVIEWER",
    selectedCommand: "REJECT_CANDIDATE",
    sourceJobId: "job-source",
    replacementJobId: "job-replacement",
    requestedOperationScope: "CLASSIFICATION",
    replacementInputFingerprint: "b".repeat(64),
    replacementSnapshotId: "snapshot-replacement",
    classificationPolicyVersion: "classification-v1",
    identityPolicyVersion: "identity-v1",
    analysisPolicyVersion: "analysis-v1",
    promptBundleVersion: "prompt-v1",
    auditId: "audit-new",
    replacementGroupId: "group-new",
    replacementRunId: "run-new",
    observationId: "observation-new",
    sourceSnapshotId: "snapshot-1",
  };
  const selected = fullPayload.selectedCommand as IdentityManualResolutionCommand;
  const payload = Object.fromEntries(
    manualResolutionPayloadKeys(command, selected, false, command === "REPLACE_M02_JOB").map(
      (key) => [key, fullPayload[key as keyof typeof fullPayload]],
    ),
  ) as Record<string, string>;
  return {
    commandId: `command-${String(index)}`,
    requestId: `request-${String(index)}`,
    idempotencyKey: `idempotency-${String(index)}`,
    actorId: "admin-1",
    actorRole: "ADMIN" as const,
    command,
    targetCandidateId: "candidate-1",
    targetGroupId: "group-1",
    expectedVersions: {} as Record<string, number | null>,
    reasonCode: command === "REPLACE_M02_JOB" ? "RETRY_EXHAUSTED" : "REVIEWED_DECISION",
    reason: "Complete reviewed M02 command evidence.",
    evidenceIds: ["evidence-1"],
    decisionIds: [],
    timestamp: "2026-08-09T00:00:00.000Z",
    payload,
  };
}

function isCreationKey(_command: IdentityManualResolutionCommand, key: string): boolean {
  return key.startsWith("guard:");
}

function prepare(command: IdentityManualResolutionCommand, index: number) {
  const coordinator = new ManualResolutionCoordinator();
  const input = envelope(command, index);
  if (command === "REPLACE_M02_JOB") {
    coordinator.seedRecord("job:job-source", 1, {
      status: "OPERATOR_REVIEW_REQUIRED",
      supersessionState: "CONTROLLING",
      supersessionSequence: 1,
      operationScope: "CLASSIFICATION",
      inputFingerprint: "source-input",
      jobLineageId: "lineage-1",
      sourceSnapshotId: "snapshot-source",
    });
    coordinator.seedRecord("job:job-overlap", 1, {
      status: "OPERATOR_REVIEW_REQUIRED",
      supersessionState: "CONTROLLING",
      supersessionSequence: 2,
      operationScope: "IDENTITY_RESOLUTION",
      inputFingerprint: "source-input-identity",
      jobLineageId: "lineage-1",
      sourceSnapshotId: "snapshot-source",
      controllingClassificationDecisionId: "decision-classification",
    });
    coordinator.seedRecord("snapshot:snapshot-replacement", 1, {
      status: "COMPLETED",
      safetyState: "SAFE",
      jobLineageId: "lineage-1",
    });
  }
  const initialKeys =
    command === "REPLACE_M02_JOB"
      ? coordinator.deriveRequiredExpectedVersionKeys(input)
      : deriveRequiredExpectedVersionKeys(input);
  for (const key of initialKeys) {
    if (isCreationKey(command, key)) input.expectedVersions[key] = null;
    else {
      input.expectedVersions[key] = 1;
      if (coordinator.getRecord(key) !== undefined) continue;
      let value: Record<string, unknown> = {};
      if (key === "candidate:candidate-1")
        value = {
          status: ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"].includes(command)
            ? "IDENTITY_REVIEW_REQUIRED"
            : "CLASSIFIED",
          contentFingerprint: "a".repeat(64),
          candidateRootId: "root-1",
          reconciledClassificationRunId: "run-1",
        };
      if (key === "group:group-1")
        value = {
          classification:
            command === "OVERRIDE_NON_SKILL"
              ? "NON_SKILL"
              : ["SPLIT_ROOTS", "MERGE_ROOTS"].includes(command)
                ? "AMBIGUOUS"
                : "SINGLE_SKILL",
          eligibleRootPaths: command === "OVERRIDE_NON_SKILL" ? ["skills/new"] : [],
        };
      if (key.startsWith("job:"))
        value = {
          status: "OPERATOR_REVIEW_REQUIRED",
          supersessionState: "CONTROLLING",
          operationScope: "CLASSIFICATION",
          inputFingerprint: "source-input",
          jobLineageId: "lineage-1",
          sourceSnapshotId: "snapshot-source",
        };
      if (key === "snapshot:snapshot-replacement")
        value = { status: "COMPLETED", safetyState: "SAFE", jobLineageId: "lineage-1" };
      if (key === "replacement-input:job-replacement")
        value = {
          jobLineageId: "lineage-1",
          sourceSnapshotId: "snapshot-replacement",
          inputFingerprint: "b".repeat(64),
          classificationPolicyVersion: "classification-v1",
          identityPolicyVersion: "identity-v1",
          analysisPolicyVersion: "analysis-v1",
          promptBundleVersion: "prompt-v1",
        };
      if (key === "version:version-prior")
        value = { resourceIdentityId: "resource-existing", contentFingerprint: "c".repeat(64) };
      if (key === "source-link:source-link-active")
        value = { status: "ACTIVE", targetResourceVersionId: "version-prior" };
      if (key === "version:version-target")
        value = { resourceIdentityId: "resource-existing", contentFingerprint: "a".repeat(64) };
      coordinator.seedRecord(key, 1, value);
    }
  }
  const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
  for (const key of keys) {
    if (Object.hasOwn(input.expectedVersions, key)) continue;
    input.expectedVersions[key] = isCreationKey(command, key) ? null : 1;
    if (!isCreationKey(command, key)) coordinator.seedRecord(key, 1, {});
  }
  expect(coordinator.deriveRequiredExpectedVersionKeys(input)).toEqual(keys);
  return { coordinator, input, keys };
}

describe("M02 manual resolution command contracts", () => {
  it("requires the approved command-specific evidence and topology fields", () => {
    expect(manualResolutionPayloadKeys("CREATE_RESOURCE")).toEqual(
      expect.arrayContaining([
        "candidateRootId",
        "classificationRunId",
        "reliableIdentityToken",
        "reliableTokenEvidenceId",
      ]),
    );
    expect(manualResolutionPayloadKeys("ATTACH_NEW_VERSION")).toEqual(
      expect.arrayContaining([
        "activeSourceLinkId",
        "continuityEvidenceIds",
        "priorResourceVersionIdentityId",
      ]),
    );
    expect(manualResolutionPayloadKeys("MARK_FORK")).toEqual(
      expect.arrayContaining([
        "candidateRootId",
        "reliableIdentityToken",
        "reliableTokenEvidenceId",
      ]),
    );
    expect(manualResolutionPayloadKeys("MARK_MIRROR")).toEqual(
      expect.arrayContaining(["identicalContentFingerprint", "targetResourceIdentityId"]),
    );
    for (const command of ["SPLIT_ROOTS", "MERGE_ROOTS"] as const) {
      expect(manualResolutionPayloadKeys(command)).toEqual(
        expect.arrayContaining(["replacementOwnershipJson", "replacementRootsJson"]),
      );
    }
    expect(manualResolutionPayloadKeys("OVERRIDE_NON_SKILL")).toEqual(
      expect.arrayContaining(["selectedRootPathsJson", "replacementOwnershipJson"]),
    );
    expect(manualResolutionPayloadKeys("REQUEST_CLARIFICATION")).toEqual(
      expect.arrayContaining(["questionCode", "evidenceGapsJson", "requestedResponderClass"]),
    );
    expect(manualResolutionPayloadKeys("REPLACE_M02_JOB")).not.toEqual(
      expect.arrayContaining(["overlappingJobIds", "operationScopes"]),
    );
  });

  it.each([
    ["CREATE_RESOURCE", { reliableIdentityToken: "invented!" }],
    ["ATTACH_NEW_VERSION", { continuityEvidenceIds: "foreign-evidence" }],
    ["MARK_FORK", { reliableTokenEvidenceId: "foreign-evidence" }],
    ["MARK_MIRROR", { identicalContentFingerprint: "f".repeat(64) }],
    ["SPLIT_ROOTS", { replacementOwnershipJson: "[]" }],
    ["MERGE_ROOTS", { replacementRootIds: "root-a,root-b" }],
    ["OVERRIDE_NON_SKILL", { selectedRootPathsJson: "[]" }],
    ["REQUEST_CLARIFICATION", { requestedResponderClass: "VIEWER" }],
  ] as const)("rejects semantically incomplete %s payloads", async (command, payloadOverride) => {
    const prepared = prepare(command, 50 + commands.indexOf(command));
    const expectedCode = "REFERENCE_INVALID";
    await expect(
      prepared.coordinator.execute({
        ...prepared.input,
        payload: { ...prepared.input.payload, ...payloadOverride },
      }),
    ).rejects.toMatchObject({ code: expectedCode });
  });

  it("validates the selected command payload before resolving ambiguity", async () => {
    const selectedCommand: IdentityManualResolutionCommand = "CREATE_RESOURCE";
    const prepared = prepare(selectedCommand, 75);
    const input = {
      ...prepared.input,
      command: "RESOLVE_AMBIGUITY" as const,
      payload: {
        ...prepared.input.payload,
        selectedCommand: "CREATE_RESOURCE",
        reliableIdentityToken: "invented!",
      },
      expectedVersions: {} as Record<string, number | null>,
    };
    for (const key of prepared.coordinator.deriveRequiredExpectedVersionKeys(input)) {
      input.expectedVersions[key] = prepared.coordinator.getRecord(key) === undefined ? null : 1;
    }
    await expect(prepared.coordinator.execute(input)).rejects.toMatchObject({
      code: "REFERENCE_INVALID",
    });
    expect(prepared.coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
      status: "CLASSIFIED",
    });
  });

  it("consumes one canonical P1 duplicate proposal with exactly its positive proposal guards", async () => {
    const coordinator = new ManualResolutionCoordinator();
    const input = envelope("REJECT_CANDIDATE", 76);
    coordinator.seedRecord("candidate:candidate-1", 1, {
      status: "IDENTITY_REVIEW_REQUIRED",
      contentFingerprint: "a".repeat(64),
    });
    coordinator.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    coordinator.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    coordinator.seedRecord("resource:resource-existing", 1, {
      guardAnchorCandidateId: "candidate-anchor",
    });
    coordinator.seedRecord("version:version-target", 1, {
      resourceIdentityId: "resource-existing",
      contentFingerprint: "a".repeat(64),
    });
    coordinator.seedRecord("duplicate:proposal-1", 1, {
      status: "PROPOSED",
      sourceCandidateId: "candidate-1",
      targetResourceVersionId: "version-target",
    });
    const proposalSet = createGuardKey("DUPLICATE_PROPOSAL_SET", ["candidate-1"]);
    const proposalPair = createGuardKey("DUPLICATE_PROPOSAL_PAIR", [
      "candidate-1",
      resourceVersionGuardRef,
    ]);
    expect(JSON.parse(new TextDecoder().decode(proposalPair.canonicalPayload))).toEqual({
      guardType: "DUPLICATE_PROPOSAL_PAIR",
      components: ["candidate-1", resourceVersionGuardRef],
    });
    coordinator.seedGuard(proposalSet.key, 1, proposalSet.canonicalPayload);
    coordinator.seedGuard(proposalPair.key, 1, proposalPair.canonicalPayload);
    const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
    input.expectedVersions = Object.fromEntries(
      keys.map((key) => [
        key,
        [
          "candidate:candidate-1",
          "group:group-1",
          "job:job-1",
          "duplicate:proposal-1",
          proposalSet.key,
          proposalPair.key,
        ].includes(key)
          ? 1
          : null,
      ]),
    );

    await coordinator.execute(input);

    expect(coordinator.getGuard(proposalSet.key)?.recordVersion).toBe(2);
    expect(coordinator.getGuard(proposalPair.key)?.recordVersion).toBe(2);
    expect(coordinator.getRecord("duplicate:proposal-1")?.value).toMatchObject({
      status: "SUPERSEDED",
    });
    expect(coordinator.getRecord("audit:proposal-superseded:proposal-1")?.value).toMatchObject({
      action: "SUBJECT_SUPERSEDED",
      subjectId: "proposal-1",
    });
  });

  it.each(["set", "pair"] as const)(
    "rejects an active P1 proposal with a missing %s guard",
    async (missingGuard) => {
      const coordinator = new ManualResolutionCoordinator();
      const input = envelope("REJECT_CANDIDATE", missingGuard === "set" ? 761 : 762);
      coordinator.seedRecord("candidate:candidate-1", 1, { status: "IDENTITY_REVIEW_REQUIRED" });
      coordinator.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
      coordinator.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
      coordinator.seedRecord("resource:resource-existing", 1, {
        guardAnchorCandidateId: "candidate-anchor",
      });
      coordinator.seedRecord("version:version-target", 1, {
        resourceIdentityId: "resource-existing",
        contentFingerprint: "a".repeat(64),
      });
      coordinator.seedRecord("duplicate:proposal-required-guards", 1, {
        status: "PROPOSED",
        sourceCandidateId: "candidate-1",
        targetResourceVersionId: "version-target",
      });
      const proposalSet = createGuardKey("DUPLICATE_PROPOSAL_SET", ["candidate-1"]);
      const proposalPair = createGuardKey("DUPLICATE_PROPOSAL_PAIR", [
        "candidate-1",
        resourceVersionGuardRef,
      ]);
      if (missingGuard !== "set")
        coordinator.seedGuard(proposalSet.key, 1, proposalSet.canonicalPayload);
      if (missingGuard !== "pair")
        coordinator.seedGuard(proposalPair.key, 1, proposalPair.canonicalPayload);
      const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
      input.expectedVersions = Object.fromEntries(
        keys.map((key) => [
          key,
          coordinator.getRecord(key) === undefined && coordinator.getGuard(key) === undefined
            ? null
            : 1,
        ]),
      );

      await expect(coordinator.execute(input)).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
      });
      expect(
        coordinator.getGuard(missingGuard === "set" ? proposalSet.key : proposalPair.key),
      ).toBeUndefined();
      expect(coordinator.getRecord("duplicate:proposal-required-guards")?.value).toMatchObject({
        status: "PROPOSED",
      });
    },
  );

  it("rejects an active P1 proposal with a mismatched pair guard payload", async () => {
    const coordinator = new ManualResolutionCoordinator();
    const input = envelope("REJECT_CANDIDATE", 763);
    coordinator.seedRecord("candidate:candidate-1", 1, { status: "IDENTITY_REVIEW_REQUIRED" });
    coordinator.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    coordinator.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    coordinator.seedRecord("resource:resource-existing", 1, {
      guardAnchorCandidateId: "candidate-anchor",
    });
    coordinator.seedRecord("version:version-target", 1, {
      resourceIdentityId: "resource-existing",
      contentFingerprint: "a".repeat(64),
    });
    coordinator.seedRecord("duplicate:proposal-mismatched-guard", 1, {
      status: "PROPOSED",
      sourceCandidateId: "candidate-1",
      targetResourceVersionId: "version-target",
    });
    const proposalSet = createGuardKey("DUPLICATE_PROPOSAL_SET", ["candidate-1"]);
    const proposalPair = createGuardKey("DUPLICATE_PROPOSAL_PAIR", [
      "candidate-1",
      resourceVersionGuardRef,
    ]);
    coordinator.seedGuard(proposalSet.key, 1, proposalSet.canonicalPayload);
    coordinator.seedGuard(
      proposalPair.key,
      1,
      createGuardKey("DUPLICATE_PROPOSAL_PAIR", ["candidate-1", "wrong-payload"]).canonicalPayload,
    );
    const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
    input.expectedVersions = Object.fromEntries(
      keys.map((key) => [
        key,
        coordinator.getRecord(key) === undefined && coordinator.getGuard(key) === undefined
          ? null
          : 1,
      ]),
    );

    await expect(coordinator.execute(input)).rejects.toMatchObject({
      code: "CONCURRENCY_GUARD_COLLISION",
    });
    expect(coordinator.getRecord("duplicate:proposal-mismatched-guard")?.value).toMatchObject({
      status: "PROPOSED",
    });
  });

  it("keeps a historical P1 proposal-set guard without inventing a pair, row, or audit", async () => {
    const coordinator = new ManualResolutionCoordinator();
    const input = envelope("REJECT_CANDIDATE", 77);
    coordinator.seedRecord("candidate:candidate-1", 1, { status: "IDENTITY_REVIEW_REQUIRED" });
    coordinator.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    coordinator.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    const proposalSet = createGuardKey("DUPLICATE_PROPOSAL_SET", ["candidate-1"]);
    coordinator.seedGuard(proposalSet.key, 1, proposalSet.canonicalPayload);
    const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
    input.expectedVersions = Object.fromEntries(
      keys.map((key) => [
        key,
        ["candidate:candidate-1", "group:group-1", "job:job-1", proposalSet.key].includes(key)
          ? 1
          : null,
      ]),
    );

    await coordinator.execute(input);

    expect(keys).not.toContainEqual(
      createGuardKey("DUPLICATE_PROPOSAL_PAIR", ["candidate-1", "version-target"]).key,
    );
    expect(coordinator.getGuard(proposalSet.key)?.recordVersion).toBe(1);
    expect(coordinator.getRecord("duplicate:proposal-1")).toBeUndefined();
    expect(coordinator.getRecord("audit:proposal-superseded:proposal-1")).toBeUndefined();
  });

  it("derives and consumes the selected P1 proposal during ambiguity resolution", async () => {
    const coordinator = new ManualResolutionCoordinator();
    const input = {
      ...envelope("RESOLVE_AMBIGUITY", 78),
      payload: {
        ...envelope("RESOLVE_AMBIGUITY", 78).payload,
        selectedCommand: "REJECT_CANDIDATE",
      },
    };
    coordinator.seedRecord("candidate:candidate-1", 1, { status: "IDENTITY_REVIEW_REQUIRED" });
    coordinator.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    coordinator.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    coordinator.seedRecord("review:review-1", 1, { status: "OPEN", candidateId: "candidate-1" });
    coordinator.seedRecord("resource:resource-existing", 1, {
      guardAnchorCandidateId: "candidate-anchor",
    });
    coordinator.seedRecord("version:version-target", 1, {
      resourceIdentityId: "resource-existing",
      contentFingerprint: "a".repeat(64),
    });
    coordinator.seedRecord("duplicate:proposal-ambiguity", 1, {
      status: "PROPOSED",
      sourceCandidateId: "candidate-1",
      targetResourceVersionId: "version-target",
    });
    const proposalSet = createGuardKey("DUPLICATE_PROPOSAL_SET", ["candidate-1"]);
    const proposalPair = createGuardKey("DUPLICATE_PROPOSAL_PAIR", [
      "candidate-1",
      resourceVersionGuardRef,
    ]);
    coordinator.seedGuard(proposalSet.key, 1, proposalSet.canonicalPayload);
    coordinator.seedGuard(proposalPair.key, 1, proposalPair.canonicalPayload);
    const keys = coordinator.deriveRequiredExpectedVersionKeys(input);
    expect(keys).toEqual(
      expect.arrayContaining(["duplicate:proposal-ambiguity", proposalSet.key, proposalPair.key]),
    );
    input.expectedVersions = Object.fromEntries(
      keys.map((key) => [
        key,
        [
          "candidate:candidate-1",
          "group:group-1",
          "job:job-1",
          "review:review-1",
          "duplicate:proposal-ambiguity",
          proposalSet.key,
          proposalPair.key,
        ].includes(key)
          ? 1
          : null,
      ]),
    );

    await coordinator.execute(input);

    expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
      status: "REJECTED",
    });
    expect(coordinator.getRecord("duplicate:proposal-ambiguity")?.value).toMatchObject({
      status: "SUPERSEDED",
    });
  });

  it("executes the selected ambiguity outcome including its exact handoff", async () => {
    const selectedCommand: IdentityManualResolutionCommand = "CREATE_RESOURCE";
    const prepared = prepare(selectedCommand, 76);
    const input = {
      ...prepared.input,
      command: "RESOLVE_AMBIGUITY" as const,
      payload: { ...prepared.input.payload, selectedCommand },
      expectedVersions: {} as Record<string, number | null>,
    };
    for (const key of prepared.coordinator.deriveRequiredExpectedVersionKeys(input)) {
      input.expectedVersions[key] = prepared.coordinator.getRecord(key) === undefined ? null : 1;
    }
    await expect(prepared.coordinator.execute(input)).resolves.toMatchObject({
      transactionIsolation: "SERIALIZABLE",
    });
    expect(prepared.coordinator.getRecord("handoff:candidate-1")?.value).toMatchObject({
      candidateId: "candidate-1",
      resourceIdentityId: "resource-new",
      resourceVersionIdentityId: "version-new",
    });
  });

  it("rejects unsafe or unproven NON_SKILL override roots and invalid timestamps", async () => {
    for (const [index, payloadOverride] of [
      { selectedRootPathsJson: '["../../unsafe"]' },
      { replacementOwnershipJson: "[{}]" },
    ].entries()) {
      const prepared = prepare("OVERRIDE_NON_SKILL", 80 + index);
      const input = {
        ...prepared.input,
        payload: { ...prepared.input.payload, ...payloadOverride },
        expectedVersions: {} as Record<string, number | null>,
      };
      for (const key of prepared.coordinator.deriveRequiredExpectedVersionKeys(input)) {
        input.expectedVersions[key] = prepared.coordinator.getRecord(key) === undefined ? null : 1;
      }
      await expect(prepared.coordinator.execute(input)).rejects.toMatchObject({
        code: "REFERENCE_INVALID",
      });
    }
    const invalidTimestamp = prepare("REJECT_CANDIDATE", 82);
    await expect(
      invalidTimestamp.coordinator.execute({
        ...invalidTimestamp.input,
        timestamp: "not-a-timestamp",
      }),
    ).rejects.toMatchObject({ code: "COMMAND_SCHEMA_INVALID" });
  });

  it("keeps future CREATE_RESOURCE rows out of caller expectations", () => {
    const command: IdentityManualResolutionCommand = "CREATE_RESOURCE";
    const prepared = prepare(command, 83);
    expect(prepared.keys).not.toEqual(
      expect.arrayContaining([
        "manual-command:command-83",
        "audit:audit-new",
        "resource:resource-new",
        "version:version-new",
      ]),
    );
  });

  it.each([false, true])(
    "requires null first-use guards for CREATE_RESOURCE (resolved=%s)",
    async (resolved) => {
      const selected: IdentityManualResolutionCommand = "CREATE_RESOURCE";
      const prepared = prepare(selected, resolved ? 86 : 85);
      const input = resolved
        ? {
            ...prepared.input,
            command: "RESOLVE_AMBIGUITY" as const,
            payload: { ...prepared.input.payload, selectedCommand: selected },
          }
        : prepared.input;
      const guard = createGuardKey("resource-source-index", ["github", "repo-1", "."]);
      prepared.coordinator.seedGuard(guard.key, 1, guard.canonicalPayload);
      input.expectedVersions[guard.key] = 1;
      await expect(prepared.coordinator.execute(input)).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
      });
    },
  );

  it("rejects duplicate replacement identities in OVERRIDE_NON_SKILL", async () => {
    const prepared = prepare("OVERRIDE_NON_SKILL", 84);
    prepared.coordinator.seedRecord("group:group-1", 1, {
      classification: "NON_SKILL",
      eligibleRootPaths: ["skills/a", "skills/b"],
    });
    const input = {
      ...prepared.input,
      payload: {
        ...prepared.input.payload,
        replacementRootIds: "root-new,root-new",
        replacementCandidateIds: "candidate-new,candidate-new",
        selectedRootPathsJson: '["skills/a","skills/b"]',
        replacementRootsJson:
          '[{"id":"root-new","normalizedPath":"skills/a"},{"id":"root-new","normalizedPath":"skills/b"}]',
        replacementOwnershipJson:
          '[{"rootId":"root-new","sourceEntryId":"entry-a","ownership":"OWNED"},{"rootId":"root-new","sourceEntryId":"entry-b","ownership":"OWNED"}]',
      },
      expectedVersions: {} as Record<string, number | null>,
    };
    for (const key of prepared.coordinator.deriveRequiredExpectedVersionKeys(input)) {
      input.expectedVersions[key] = prepared.coordinator.getRecord(key) === undefined ? null : 1;
    }
    await expect(prepared.coordinator.execute(input)).rejects.toMatchObject({
      code: "COMMAND_SCHEMA_INVALID",
    });
  });

  for (const [index, command] of commands.entries()) {
    it(`F24/F26/F34 executes ${command} with command-derived records and guards`, async () => {
      const { coordinator, input, keys } = prepare(command, index);
      const before = new Map(keys.map((key) => [key, coordinator.getRecord(key)]));

      const result = await coordinator.execute(input);
      expect(result.lockOrder).toEqual(keys);
      expect(result.transactionIsolation).toBe("SERIALIZABLE");
      expect(coordinator.auditEvents.at(-1)).toMatchObject({ accepted: true });
      const materializedGuard = keys.find(
        (key) => key.startsWith("guard:") && coordinator.getGuard(key) !== undefined,
      );
      expect(materializedGuard).toBeDefined();
      expect(() => {
        coordinator.assertGuardPayload(
          materializedGuard ?? "",
          createGuardKey("different-guard", ["collision"]).canonicalPayload,
        );
      }).toThrow("CONCURRENCY_GUARD_COLLISION");
      for (const key of keys) {
        if (input.expectedVersions[key] === 1 && result.recordVersions[key] === undefined)
          expect(coordinator.getRecord(key)).toEqual(before.get(key));
      }
      if (["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(command))
        expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
          status: "IDENTITY_RESOLVED",
        });
      if (command === "CREATE_RESOURCE" || command === "ATTACH_NEW_VERSION")
        expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
          resourceIdentityId: input.payload.resourceIdentityId,
          resourceVersionIdentityId: "version-new",
        });
      if (command === "MARK_FORK")
        expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
          resourceIdentityId: "resource-new",
          resourceVersionIdentityId: "version-new",
        });
      if (command === "MARK_MIRROR")
        expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
          resourceIdentityId: "resource-existing",
          resourceVersionIdentityId: "version-target",
        });
      if (["MARK_DUPLICATE", "REJECT_CANDIDATE", "RESOLVE_AMBIGUITY"].includes(command))
        expect(coordinator.getRecord("candidate:candidate-1")?.value).toMatchObject({
          status: "REJECTED",
        });
      if (["CREATE_RESOURCE", "ATTACH_NEW_VERSION", "MARK_FORK", "MARK_MIRROR"].includes(command))
        expect(coordinator.getRecord("handoff:candidate-1")?.value).toMatchObject({
          candidateId: "candidate-1",
        });
      if (["SPLIT_ROOTS", "MERGE_ROOTS"].includes(command)) {
        expect(coordinator.getRecord("group:group-1")?.value).toMatchObject({
          status: "SUPERSEDED",
        });
        expect(coordinator.getRecord("group:group-new")?.value).toMatchObject({ status: "ACTIVE" });
        expect(coordinator.getRecord("candidate:candidate-old")?.value).toMatchObject({
          status: "SUPERSEDED",
        });
        const firstReplacementCandidate =
          command === "SPLIT_ROOTS" ? "candidate-new-a" : "candidate-new";
        const firstReplacementRoot = command === "SPLIT_ROOTS" ? "root-new-a" : "root-new";
        expect(
          coordinator.getRecord(`candidate:${firstReplacementCandidate}`)?.value,
        ).toMatchObject({
          status: "CLASSIFIED",
        });
        expect(coordinator.getRecord("root:root-old")?.value).toMatchObject({
          status: "SUPERSEDED",
        });
        expect(coordinator.getRecord(`root:${firstReplacementRoot}`)?.value).toMatchObject({
          status: "ACTIVE",
        });
      }
      if (command === "OVERRIDE_NON_SKILL") {
        expect(coordinator.getRecord("group:group-1")?.value).toMatchObject({
          status: "SUPERSEDED",
        });
        expect(coordinator.getRecord("group:group-new")?.value).toMatchObject({
          classification: "HUMAN_OVERRIDE",
        });
      }
      if (command === "REQUEST_CLARIFICATION") {
        expect(coordinator.getRecord("review:review-1")?.value).toMatchObject({
          state: "CLARIFICATION_REQUESTED",
        });
        expect(coordinator.getRecord("job:job-1")?.value).toMatchObject({
          status: "OPERATOR_REVIEW_REQUIRED",
        });
      }
      if (command === "RESOLVE_AMBIGUITY")
        expect(coordinator.getRecord("review:review-1")?.value).toMatchObject({
          state: "RESOLVED",
        });
      if (command === "REPLACE_M02_JOB") {
        expect(coordinator.getRecord("job:job-source")?.value).toMatchObject({
          supersessionState: "SUPERSEDED",
        });
        expect(coordinator.getRecord("job:job-replacement")?.value).toMatchObject({
          supersessionState: "CONTROLLING",
        });
      }
      expect(await coordinator.execute(input)).toEqual(result);
      expect(coordinator.auditEvents.filter((event) => event.accepted)).toHaveLength(1);
      await expect(
        coordinator.execute({ ...input, reason: `${input.reason} changed` }),
      ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
      expect(coordinator.auditEvents.at(-1)).toMatchObject({
        accepted: false,
        code: "IDEMPOTENCY_KEY_REUSED",
      });
    });

    it(`AC-12 rejects incomplete, stale, missing, existing, and phantom conflicts for ${command}`, async () => {
      const incomplete = prepare(command, index + 100);
      const omitted = incomplete.keys[0];
      if (omitted !== undefined)
        incomplete.input.expectedVersions = Object.fromEntries(
          Object.entries(incomplete.input.expectedVersions).filter(([key]) => key !== omitted),
        );
      await expect(incomplete.coordinator.execute(incomplete.input)).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
      });

      const stale = prepare(command, index + 200);
      const positive = stale.keys.find((key) => stale.input.expectedVersions[key] === 1);
      expect(positive).toBeDefined();
      stale.input.expectedVersions[positive ?? ""] = 2;
      await expect(stale.coordinator.execute(stale.input)).rejects.toMatchObject({
        code: "STALE_RECORD_VERSION",
      });

      const missing = prepare(command, index + 300);
      const missingPositive = missing.keys.find(
        (key) =>
          missing.input.expectedVersions[key] === 1 &&
          (command !== "REPLACE_M02_JOB" || key.startsWith("snapshot:")),
      );
      expect(missingPositive).toBeDefined();
      const missingCoordinator = new ManualResolutionCoordinator();
      for (const key of missing.keys) {
        if (key !== missingPositive && missing.input.expectedVersions[key] === 1)
          missingCoordinator.seedRecord(key, 1, missing.coordinator.getRecord(key)?.value ?? {});
      }
      await expect(missingCoordinator.execute(missing.input)).rejects.toMatchObject({
        code: expect.stringMatching(
          /EXPECTED_VERSION_SET_INVALID|REFERENCE_INVALID|TRANSITION_PROHIBITED/u,
        ),
      });

      const existing = prepare(command, index + 400);
      const absentGuard = existing.keys.find(
        (key) => existing.input.expectedVersions[key] === null && key.startsWith("guard:"),
      );
      expect(absentGuard).toBeDefined();
      const guardPayload = existing.coordinator
        .deriveConcurrencyGuards(existing.input)
        .find(({ key }) => key === absentGuard)?.canonicalPayload;
      expect(guardPayload).toBeDefined();
      existing.coordinator.seedGuard(absentGuard ?? "", 1, guardPayload ?? new Uint8Array());
      await expect(existing.coordinator.execute(existing.input)).rejects.toMatchObject({
        code: "EXPECTED_VERSION_SET_INVALID",
      });

      const phantom = prepare(command, index + 500);
      const guard = phantom.keys.find((key) => key.startsWith("guard:"));
      expect(guard).toBeDefined();
      phantom.input.expectedVersions[guard ?? ""] = 1;
      phantom.coordinator.seedGuard(
        guard ?? "",
        1,
        createGuardKey("collision", ["different-payload"]).canonicalPayload,
      );
      await expect(phantom.coordinator.execute(phantom.input)).rejects.toMatchObject({
        code: "CONCURRENCY_GUARD_COLLISION",
      });

      const cancelled = prepare(command, index + 550);
      const existingJob = cancelled.keys.find(
        (key) =>
          key.startsWith("job:") &&
          cancelled.input.expectedVersions[key] === 1 &&
          (command !== "REPLACE_M02_JOB" || key === "job:job-source"),
      );
      expect(existingJob).toBeDefined();
      const existingJobValue = cancelled.coordinator.getRecord(existingJob ?? "")?.value;
      cancelled.coordinator.seedRecord(existingJob ?? "", 1, {
        ...(typeof existingJobValue === "object" && existingJobValue !== null
          ? existingJobValue
          : {}),
        status: "CANCELLED",
      });
      await expect(cancelled.coordinator.execute(cancelled.input)).rejects.toMatchObject({
        code: "TRANSITION_PROHIBITED",
      });

      const race = prepare(command, index + 600);
      const competitor = {
        ...race.input,
        commandId: `${race.input.commandId}-competitor`,
        requestId: `${race.input.requestId}-competitor`,
        idempotencyKey: `${race.input.idempotencyKey}-competitor`,
        payload: {
          ...race.input.payload,
          auditId: `${String(race.input.payload.auditId)}-competitor`,
        },
        expectedVersions: {} as Record<string, number | null>,
      };
      for (const key of race.coordinator.deriveRequiredExpectedVersionKeys(competitor))
        competitor.expectedVersions[key] = isCreationKey(command, key) ? null : 1;
      const outcomes = await Promise.allSettled([
        race.coordinator.execute(race.input),
        race.coordinator.execute(competitor),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const loser = outcomes.find((outcome) => outcome.status === "rejected");
      expect(loser).toMatchObject({
        status: "rejected",
        reason: {
          code: expect.stringMatching(
            /EXPECTED_VERSION_SET_INVALID|RECORD_ALREADY_EXISTS|STALE_RECORD_VERSION|TRANSITION_PROHIBITED/,
          ),
        },
      });
    });
  }

  it("REPLACE_M02_JOB cannot be authorized by caller payload or invalid source/reason state", async () => {
    for (const actorRole of ["VIEWER", "VALIDATION_RESEARCHER"] as const) {
      const attempt = prepare("REPLACE_M02_JOB", 900);
      await expect(
        attempt.coordinator.execute({ ...attempt.input, actorRole }),
      ).rejects.toMatchObject({
        code: "ROLE_NOT_AUTHORIZED",
      });
    }
    const invalidReason = prepare("REPLACE_M02_JOB", 901);
    await expect(
      invalidReason.coordinator.execute({
        ...invalidReason.input,
        reasonCode: "CALLER_AUTHORIZED",
      }),
    ).rejects.toMatchObject({ code: "ROLE_NOT_AUTHORIZED" });
    const invalidSource = prepare("REPLACE_M02_JOB", 902);
    invalidSource.coordinator.seedRecord("job:job-source", 1, {
      status: "ACTIVE",
      supersessionState: "CONTROLLING",
      operationScope: "CLASSIFICATION",
      jobLineageId: "lineage-1",
    });
    await expect(invalidSource.coordinator.execute(invalidSource.input)).rejects.toMatchObject({
      code: "TRANSITION_PROHIBITED",
    });
    const unsafeSnapshot = prepare("REPLACE_M02_JOB", 903);
    unsafeSnapshot.coordinator.seedRecord("snapshot:snapshot-replacement", 1, {
      status: "COMPLETED",
      safetyState: "UNSAFE",
      jobLineageId: "lineage-1",
    });
    await expect(unsafeSnapshot.coordinator.execute(unsafeSnapshot.input)).rejects.toMatchObject({
      code: "ROLE_NOT_AUTHORIZED",
    });
    const wrongLineage = prepare("REPLACE_M02_JOB", 904);
    wrongLineage.coordinator.seedRecord("snapshot:snapshot-replacement", 1, {
      status: "COMPLETED",
      safetyState: "SAFE",
      jobLineageId: "other-lineage",
    });
    await expect(wrongLineage.coordinator.execute(wrongLineage.input)).rejects.toMatchObject({
      code: "ROLE_NOT_AUTHORIZED",
    });
    const invalidFingerprint = prepare("REPLACE_M02_JOB", 905);
    await expect(
      invalidFingerprint.coordinator.execute({
        ...invalidFingerprint.input,
        payload: { ...invalidFingerprint.input.payload, replacementInputFingerprint: "not-a-hash" },
      }),
    ).rejects.toMatchObject({ code: "REFERENCE_INVALID" });
    const unregisteredFingerprint = prepare("REPLACE_M02_JOB", 908);
    await expect(
      unregisteredFingerprint.coordinator.execute({
        ...unregisteredFingerprint.input,
        payload: {
          ...unregisteredFingerprint.input.payload,
          replacementInputFingerprint: "c".repeat(64),
        },
      }),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });
    const fullPipeline = prepare("REPLACE_M02_JOB", 906);
    const fullPipelineInput = {
      ...fullPipeline.input,
      payload: { ...fullPipeline.input.payload, requestedOperationScope: "FULL_PIPELINE" },
      expectedVersions: {} as Record<string, number | null>,
    };
    for (const key of fullPipeline.coordinator.deriveRequiredExpectedVersionKeys(fullPipelineInput))
      fullPipelineInput.expectedVersions[key] = isCreationKey("REPLACE_M02_JOB", key) ? null : 1;
    await expect(fullPipeline.coordinator.execute(fullPipelineInput)).resolves.toMatchObject({
      transactionIsolation: "SERIALIZABLE",
    });
    const sameSnapshot = prepare("REPLACE_M02_JOB", 907);
    sameSnapshot.coordinator.seedRecord("job:job-source", 1, {
      status: "COMPLETED",
      supersessionState: "CONTROLLING",
      operationScope: "CLASSIFICATION",
      inputFingerprint: "a".repeat(64),
      jobLineageId: "lineage-1",
      sourceSnapshotId: "snapshot-replacement",
    });
    await expect(
      sameSnapshot.coordinator.execute({
        ...sameSnapshot.input,
        reasonCode: "NEW_SUPPORTED_SNAPSHOT",
      }),
    ).rejects.toMatchObject({ code: "ROLE_NOT_AUTHORIZED" });
  });

  it("allows only ADMIN administrative correction to replace a cancelled controlling job", async () => {
    const correction = prepare("REPLACE_M02_JOB", 930);
    const source = correction.coordinator.getRecord("job:job-source")?.value as Record<
      string,
      unknown
    >;
    correction.coordinator.seedRecord("job:job-source", 1, { ...source, status: "CANCELLED" });
    const command = {
      ...correction.input,
      reasonCode: "ADMINISTRATIVE_CORRECTION",
      actorRole: "ADMIN" as const,
    };
    await expect(correction.coordinator.execute(command)).resolves.toMatchObject({
      transactionIsolation: "SERIALIZABLE",
    });
    expect(correction.coordinator.getRecord("job:job-replacement")?.value).toMatchObject({
      jobLineageId: "lineage-1",
      operationScope: "CLASSIFICATION",
      classificationPolicyVersion: "classification-v1",
      identityPolicyVersion: "identity-v1",
      analysisPolicyVersion: "analysis-v1",
      promptBundleVersion: "prompt-v1",
    });
    expect(
      correction.coordinator.getRecord("job-supersession:job-source:job-replacement")?.value,
    ).toMatchObject({ sourceJobId: "job-source", replacementJobId: "job-replacement" });
  });

  it("fails closed on extra envelope and cross-command payload keys", async () => {
    const extraEnvelope = prepare("REJECT_CANDIDATE", 950);
    await expect(
      extraEnvelope.coordinator.execute({
        ...extraEnvelope.input,
        callerAuthorized: true,
      } as never),
    ).rejects.toMatchObject({ code: "COMMAND_SCHEMA_INVALID" });
    const crossCommand = prepare("REJECT_CANDIDATE", 951);
    await expect(
      crossCommand.coordinator.execute({
        ...crossCommand.input,
        payload: { ...crossCommand.input.payload, mirrorSourceRepositoryId: "source-mirror" },
      }),
    ).rejects.toMatchObject({ code: "COMMAND_SCHEMA_INVALID" });
  });

  for (const command of ["MARK_FORK", "MARK_MIRROR", "MARK_DUPLICATE"] as const) {
    it(`corrects ${command} by locked immutable same-source supersession`, async () => {
      const input = envelope(command, 980 + commands.indexOf(command));
      input.payload = {
        ...input.payload,
        ...(command === "MARK_FORK"
          ? {
              resourceIdentityId: "resource-existing",
              forkResourceVersionId: "version-fork-existing",
            }
          : {}),
        priorRelationshipId: "relationship-prior",
        priorDecisionId: "decision-prior",
        ...(command === "MARK_MIRROR" ? { priorSourceLinkId: "source-link-prior" } : {}),
      };
      input.expectedVersions = {};
      const coordinator = new ManualResolutionCoordinator();
      const keys = deriveRequiredExpectedVersionKeys(input);
      const correctionGuards = new Map(
        coordinator
          .deriveConcurrencyGuards(input)
          .map(({ key, canonicalPayload }) => [key, canonicalPayload] as const),
      );
      for (const key of keys) {
        const created =
          isCreationKey(command, key) && !key.includes("prior") && !key.startsWith("guard:");
        input.expectedVersions[key] = created ? null : 1;
        if (key.startsWith("guard:")) {
          const canonicalPayload = correctionGuards.get(key);
          if (!canonicalPayload) throw new Error("TEST_FIXTURE_INVALID");
          coordinator.seedGuard(key, 1, canonicalPayload);
          continue;
        }
        if (created) continue;
        let value: Record<string, unknown> = {};
        if (key === "candidate:candidate-1")
          value = {
            status: command === "MARK_DUPLICATE" ? "REJECTED" : "IDENTITY_RESOLVED",
            contentFingerprint: "a".repeat(64),
            candidateRootId: "root-1",
            reconciledClassificationRunId: "run-1",
          };
        if (key === "group:group-1") value = { classification: "SINGLE_SKILL" };
        if (key === "job:job-1")
          value = { status: "OPERATOR_REVIEW_REQUIRED", supersessionState: "CONTROLLING" };
        if (key === "decision:decision-prior") value = { status: "ACTIVE" };
        if (key === "fork:relationship-prior")
          value = { status: "ACTIVE", forkResourceVersionId: "version-fork-existing" };
        if (key === "mirror:relationship-prior")
          value = { status: "ACTIVE", mirrorSourceRepositoryId: "source-mirror" };
        if (key === "duplicate:relationship-prior")
          value = { status: "CONFIRMED", sourceCandidateId: "candidate-1" };
        if (key === "source-link:source-link-prior")
          value = { status: "ACTIVE", sourceRepositoryId: "source-mirror", normalizedRoot: "." };
        if (key === "version:version-target")
          value = { resourceIdentityId: "resource-existing", contentFingerprint: "a".repeat(64) };
        coordinator.seedRecord(key, 1, value);
      }
      const result = await coordinator.execute(input);
      const prefix =
        command === "MARK_FORK" ? "fork" : command === "MARK_MIRROR" ? "mirror" : "duplicate";
      const replacementId = command === "MARK_DUPLICATE" ? "duplicate-new" : "relationship-new";
      expect(coordinator.getRecord(`${prefix}:relationship-prior`)?.value).toMatchObject({
        status: "SUPERSEDED",
      });
      expect(coordinator.getRecord(`${prefix}:${replacementId}`)?.value).toMatchObject({
        supersedesRelationshipId: "relationship-prior",
      });
      expect(coordinator.getRecord("decision:decision-prior")?.value).toMatchObject({
        status: "SUPERSEDED",
      });
      expect(result.transactionIsolation).toBe("SERIALIZABLE");

      const invalid = new ManualResolutionCoordinator();
      for (const key of keys) {
        if (input.expectedVersions[key] === 1 && key.startsWith("guard:")) {
          const canonicalPayload = correctionGuards.get(key);
          if (!canonicalPayload) throw new Error("TEST_FIXTURE_INVALID");
          invalid.seedGuard(key, 1, canonicalPayload);
        } else if (input.expectedVersions[key] === 1) {
          invalid.seedRecord(key, 1, coordinator.getRecord(key)?.value ?? {});
        }
      }
      const badInput = {
        ...input,
        commandId: `${input.commandId}-bad`,
        idempotencyKey: `${input.idempotencyKey}-bad`,
        payload: { ...input.payload, auditId: "audit-bad" },
        expectedVersions: {} as Record<string, number | null>,
      };
      for (const key of deriveRequiredExpectedVersionKeys(badInput))
        badInput.expectedVersions[key] =
          key.startsWith("audit:") || key.startsWith("manual-command:")
            ? null
            : (input.expectedVersions[key] ?? null);
      await expect(invalid.execute(badInput)).rejects.toMatchObject({
        code: "TRANSITION_PROHIBITED",
      });
    });
  }
});
