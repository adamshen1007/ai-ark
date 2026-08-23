import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  ManualResolutionCoordinator,
  ManualResolutionError,
  createGuardKey,
  deriveRequiredExpectedVersionKeys,
} from "./index.js";

const expectedF34 = (
  JSON.parse(
    readFileSync(
      new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
      "utf8",
    ),
  ) as {
    readonly expectedEvidence: readonly {
      readonly id: string;
      readonly records: readonly string[];
      readonly decision: string;
      readonly auditStates: readonly string[];
    }[];
  }
).expectedEvidence.find(({ id }) => id === "F34");

const baseCommand = {
  commandId: "command-1",
  requestId: "request-1",
  idempotencyKey: "idempotency-1",
  actorId: "editor-1",
  actorRole: "EDITOR" as const,
  command: "REJECT_CANDIDATE" as const,
  targetCandidateId: "candidate-1",
  targetGroupId: "group-1",
  reasonCode: "INVALID_CANDIDATE",
  reason: "Reviewed candidate is not independently usable.",
  evidenceIds: ["evidence-1"],
  decisionIds: [],
  timestamp: "2026-08-09T00:00:00.000Z",
  payload: {
    decisionId: "decision-1",
    jobId: "job-1",
    auditId: "audit-1",
  },
};

function expectedFor(command: typeof baseCommand & { commandId?: string }) {
  const expected: Record<string, number | null> = {};
  for (const key of deriveRequiredExpectedVersionKeys({
    ...baseCommand,
    ...command,
    expectedVersions: expected,
  }))
    expected[key] = key.startsWith("guard:") ? null : 1;
  return expected;
}

describe("M02 manual-resolution concurrency", () => {
  it("rejects incomplete/extra expected maps and validates integer/null semantics atomically", async () => {
    const store = new ManualResolutionCoordinator();
    store.seedRecord("candidate:candidate-1", 1, { status: "CLASSIFIED" });
    store.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    store.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    const completeExpected = expectedFor(baseCommand);
    const requiredKeys = Object.keys(completeExpected).sort();

    await expect(
      store.execute({ ...baseCommand, expectedVersions: { "candidate:candidate-1": 1 } }),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });
    await expect(
      store.execute({
        ...baseCommand,
        expectedVersions: {
          "candidate:candidate-1": 1,
          "audit:audit-1": null,
          "decision:decision-1": null,
          "group:group-1": 1,
          "job:job-1": 1,
          "manual-command:command-1": null,
          "extra:x": null,
        },
      }),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });

    const result = await store.execute({
      ...baseCommand,
      expectedVersions: completeExpected,
    });
    expect(result.lockOrder).toEqual(requiredKeys);
    expect(store.auditEvents.at(-1)?.accepted).toBe(true);
    expect(store.getRecord("candidate:candidate-1")?.value).toMatchObject({ status: "REJECTED" });
    expect(store.getRecord("job:job-1")?.value).toMatchObject({ status: "COMPLETED" });
  });

  it("F24/F26/F34 derives command guards and blocks cancelled or human-decided stale work", async () => {
    const store = new ManualResolutionCoordinator();
    store.seedRecord("candidate:candidate-1", 1, { status: "CLASSIFIED" });
    store.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    store.seedRecord("job:job-1", 1, { status: "CANCELLED" });
    await expect(
      store.execute({
        ...baseCommand,
        expectedVersions: expectedFor(baseCommand),
      }),
    ).rejects.toMatchObject({ code: "TRANSITION_PROHIBITED" });
    expect(store.getRecord("candidate:candidate-1")?.value).toMatchObject({ status: "CLASSIFIED" });
  });

  it("FIR-01 validates malformed payloads before map comparison, then distinguishes map class from stale integers", async () => {
    const seed = (store: ManualResolutionCoordinator): void => {
      store.seedRecord("candidate:candidate-1", 1, { status: "CLASSIFIED" });
      store.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
      store.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    };
    const malformed = new ManualResolutionCoordinator();
    seed(malformed);
    await expect(
      malformed.execute({
        ...baseCommand,
        expectedVersions: {},
        payload: { ...baseCommand.payload, decisionId: "" },
      }),
    ).rejects.toMatchObject({ code: "COMMAND_SCHEMA_INVALID" });

    const classificationMismatch = new ManualResolutionCoordinator();
    seed(classificationMismatch);
    const nullForPositive = expectedFor(baseCommand);
    nullForPositive["candidate:candidate-1"] = null;
    await expect(
      classificationMismatch.execute({ ...baseCommand, expectedVersions: nullForPositive }),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });

    const stale = new ManualResolutionCoordinator();
    seed(stale);
    const stalePositive = expectedFor(baseCommand);
    stalePositive["candidate:candidate-1"] = 2;
    await expect(
      stale.execute({ ...baseCommand, expectedVersions: stalePositive }),
    ).rejects.toMatchObject({
      code: "STALE_RECORD_VERSION",
    });

    const globalPrecedence = new ManualResolutionCoordinator();
    seed(globalPrecedence);
    const staleBeforeLaterClassMismatch = expectedFor(baseCommand);
    staleBeforeLaterClassMismatch["candidate:candidate-1"] = 2;
    const rejectionGuard = createGuardKey("REJECTION_DECISION", ["candidate-1"]);
    globalPrecedence.seedGuard(rejectionGuard.key, 1, rejectionGuard.canonicalPayload);
    await expect(
      globalPrecedence.execute({
        ...baseCommand,
        expectedVersions: staleBeforeLaterClassMismatch,
      }),
    ).rejects.toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });
  });

  it("serializes competing creators so exactly one wins", async () => {
    const store = new ManualResolutionCoordinator();
    store.seedRecord("candidate:candidate-1", 1, { status: "CLASSIFIED" });
    store.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    store.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    const makeCompeting = (id: string) => {
      const command = {
        ...baseCommand,
        commandId: id,
        idempotencyKey: id,
        payload: { ...baseCommand.payload, auditId: `audit-${id}` },
        expectedVersions: {} as Record<string, number | null>,
      };
      for (const key of deriveRequiredExpectedVersionKeys(command))
        command.expectedVersions[key] = key.startsWith("guard:") ? null : 1;
      return command;
    };
    const commands = [store.execute(makeCompeting("a")), store.execute(makeCompeting("b"))];
    const results = await Promise.allSettled(commands);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.status !== "rejected") throw new Error("expected one rejected creator");
    expect(rejected.reason).toMatchObject({ code: "EXPECTED_VERSION_SET_INVALID" });
    expect(expectedF34).toMatchObject({
      records: ["guard:null-to-v1", "manual-command:serialized"],
      decision: "SERIALIZED_FIRST_USE",
      auditStates: ["ONE_ACCEPTED", "ONE_REJECTED"],
    });
  });

  it("returns identical idempotent replay and rejects changed payload without mutation", async () => {
    const store = new ManualResolutionCoordinator();
    store.seedRecord("candidate:candidate-1", 1, { status: "CLASSIFIED" });
    store.seedRecord("group:group-1", 1, { classification: "SINGLE_SKILL" });
    store.seedRecord("job:job-1", 1, { status: "OPERATOR_REVIEW_REQUIRED" });
    const command = {
      ...baseCommand,
      expectedVersions: expectedFor(baseCommand),
    };
    const first = await store.execute(command);
    expect(await store.execute(command)).toEqual(first);
    const before = store.snapshot();
    await expect(
      store.execute({ ...command, payload: { candidateId: "other", decisionId: "decision-1" } }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(store.snapshot().records).toEqual(before.records);
    expect(store.auditEvents.at(-1)?.accepted).toBe(false);
  });

  it("materializes collision-safe guards and rejects canonical-payload mismatch", () => {
    const store = new ManualResolutionCoordinator();
    const guard = createGuardKey("duplicate-disposition", ["candidate-1", "version-a"]);
    expect(guard.key).toMatch(/^guard:duplicate-disposition:[A-Za-z0-9_-]{43}$/u);
    store.seedGuard(guard.key, 1, guard.canonicalPayload);
    expect(() => {
      store.assertGuardPayload(
        guard.key,
        createGuardKey("duplicate-disposition", ["candidate-1", "version-b"]).canonicalPayload,
      );
    }).toThrow(ManualResolutionError);
  });

  it("rejects unsupported override and withholds handoff until exactly one resolved identity/version", () => {
    const store = new ManualResolutionCoordinator();
    expect(() => {
      store.assertCommandAllowed("ADMIN", "OVERRIDE_UNSUPPORTED" as never);
    }).toThrow("UNSUPPORTED_OVERRIDE_PROHIBITED");
    expect(
      store.createHandoffMarker({
        candidateId: "candidate-1",
        status: "CLASSIFIED",
        resourceIdentityIds: [],
        resourceVersionIdentityIds: [],
        activeReview: false,
      }),
    ).toBeNull();
    expect(
      store.createHandoffMarker({
        candidateId: "candidate-1",
        status: "IDENTITY_RESOLVED",
        resourceIdentityIds: ["resource-1"],
        resourceVersionIdentityIds: ["version-1"],
        activeReview: false,
      }),
    ).toMatchObject({ candidateId: "candidate-1" });
  });
});
