import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { IdentityRelationshipRegistry, RelationshipError } from "./index.js";

const expectedEvidence = new Map(
  (
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
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

describe("M02 identity relationship endpoints", () => {
  it("F20 binds duplicate candidate to one exact mandatory version without a source Resource", () => {
    const registry = new IdentityRelationshipRegistry();
    registry.registerCandidate("candidate-1", "a".repeat(64));
    registry.registerVersion("version-a", "resource-a", "a".repeat(64));
    const duplicate = registry.confirmDuplicate({
      id: "duplicate-1",
      sourceCandidateId: "candidate-1",
      targetResourceVersionId: "version-a",
      evidenceIds: ["evidence-1"],
      decisionId: "decision-1",
      reason: "Exact content duplicate",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });

    expect(duplicate.sourceCandidateId).toBe("candidate-1");
    expect(duplicate.targetResourceVersionId).toBe("version-a");
    expect(duplicate).not.toHaveProperty("sourceResourceIdentityId");
    expect(expectedEvidence.get("F20")).toMatchObject({
      records: [`duplicate:${duplicate.id}`, `version:${duplicate.targetResourceVersionId}`],
      decision: "DUPLICATE_OF_VERSION",
      auditStates: ["ACTIVE"],
    });
    expect(() =>
      registry.confirmDuplicate({ ...duplicate, id: "duplicate-2", decisionId: "decision-2" }),
    ).toThrow(RelationshipError);
    const mismatch = new IdentityRelationshipRegistry();
    mismatch.registerCandidate("candidate-1", "a".repeat(64));
    mismatch.registerVersion("version-b", "resource-b", "b".repeat(64));
    expect(() =>
      mismatch.confirmDuplicate({
        ...duplicate,
        id: "duplicate-mismatch",
        targetResourceVersionId: "version-b",
      }),
    ).toThrow("duplicate content must be byte-identical");
  });

  it("F21 uses version-to-version fork direction and rejects self, same-Resource, and cycles", () => {
    const registry = new IdentityRelationshipRegistry();
    registry.registerVersion("version-a", "resource-a", "a".repeat(64));
    registry.registerVersion("version-b", "resource-b", "a".repeat(64));
    registry.registerVersion("version-c", "resource-c", "c".repeat(64));

    const fork = registry.markFork({
      id: "fork-1",
      forkResourceVersionId: "version-b",
      originResourceVersionId: "version-a",
      evidenceIds: ["evidence-1"],
      decisionId: "decision-1",
      reason: "Reviewed independent fork",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    expect(fork.forkResourceVersionId).toBe("version-b");
    expect(fork.originResourceVersionId).toBe("version-a");
    expect(expectedEvidence.get("F21")).toMatchObject({
      records: ["fork:fork-1", "version:version-a", "version:version-b"],
      decision: "VERSION_FORK_OF_VERSION",
      auditStates: ["ACTIVE"],
    });
    expect(() =>
      registry.markFork({ ...fork, id: "fork-self", originResourceVersionId: "version-b" }),
    ).toThrow();

    registry.markFork({
      ...fork,
      id: "fork-2",
      forkResourceVersionId: "version-c",
      originResourceVersionId: "version-b",
    });
    expect(() =>
      registry.markFork({
        ...fork,
        id: "fork-cycle",
        forkResourceVersionId: "version-a",
        originResourceVersionId: "version-c",
      }),
    ).toThrow("cycle");
  });

  it("F22 uses repository-to-repository mirror direction with exact delivery-version binding", () => {
    const registry = new IdentityRelationshipRegistry();
    registry.registerVersion("version-a", "resource-a", "a".repeat(64));
    registry.registerSourceRepository("source-mirror");
    registry.registerSourceRepository("source-origin");
    const mirror = registry.markMirror({
      id: "mirror-1",
      mirrorSourceRepositoryId: "source-mirror",
      originSourceRepositoryId: "source-origin",
      targetResourceVersionId: "version-a",
      sourceLinkId: "source-link-1",
      normalizedRoot: "skills/demo",
      contentEqual: true,
      evidenceIds: ["evidence-1"],
      decisionId: "decision-1",
      reason: "Reviewed exact mirror",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    expect(mirror.targetResourceVersionId).toBe("version-a");
    expect(mirror.sourceLinkId).toBe("source-link-1");
    expect(registry.getSourceLink("source-link-1")).toMatchObject({
      sourceRepositoryId: "source-mirror",
      normalizedRoot: "skills/demo",
      targetResourceVersionId: "version-a",
    });
    expect(expectedEvidence.get("F22")).toMatchObject({
      records: ["mirror:mirror-1", "source-link:source-link-1"],
      decision: "SOURCE_MIRROR_OF_SOURCE",
      auditStates: ["ACTIVE"],
    });
    expect(() =>
      registry.markMirror({
        ...mirror,
        id: "mirror-diverged",
        mirrorSourceRepositoryId: "other",
        contentEqual: false,
      }),
    ).toThrow();
  });

  it("F23 corrects by immutable same-source supersession and appends audit", () => {
    const registry = new IdentityRelationshipRegistry();
    registry.registerVersion("version-a", "resource-a", "a".repeat(64));
    registry.registerVersion("version-b", "resource-b", "b".repeat(64));
    registry.registerSourceRepository("source-mirror");
    registry.registerSourceRepository("source-origin-a");
    registry.registerSourceRepository("source-origin-b");
    const first = registry.markMirror({
      id: "mirror-1",
      mirrorSourceRepositoryId: "source-mirror",
      originSourceRepositoryId: "source-origin-a",
      targetResourceVersionId: "version-a",
      sourceLinkId: "source-link-1",
      normalizedRoot: ".",
      contentEqual: true,
      evidenceIds: ["evidence-1"],
      decisionId: "decision-1",
      reason: "Initial review",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    const corrected = registry.correctMirror(first.id, first.recordVersion, {
      ...first,
      id: "mirror-2",
      originSourceRepositoryId: "source-origin-b",
      targetResourceVersionId: "version-b",
      sourceLinkId: "source-link-2",
      decisionId: "decision-2",
      reason: "Corrected reviewed origin",
      createdAt: "2026-08-09T01:00:00.000Z",
    });

    expect(registry.getMirror(first.id)?.status).toBe("SUPERSEDED");
    expect(registry.getSourceLink("source-link-1")?.status).toBe("SUPERSEDED");
    expect(registry.getSourceLink("source-link-2")?.status).toBe("ACTIVE");
    expect(corrected.supersedesRelationshipId).toBe(first.id);
    expect(registry.auditEvents).toHaveLength(2);
    expect(expectedEvidence.get("F23")).toMatchObject({
      records: ["mirror:mirror-1", "mirror:mirror-2", "source-link:source-link-2"],
      decision: "IMMUTABLE_SUPERSESSION",
      auditStates: ["SUPERSEDED", "ACTIVE"],
    });
    expect(() =>
      registry.correctMirror(first.id, first.recordVersion, { ...corrected, id: "mirror-3" }),
    ).toThrow("active");
  });

  it("corrects duplicate and fork edges without changing their source endpoints", () => {
    const registry = new IdentityRelationshipRegistry();
    registry.registerCandidate("candidate-1", "a".repeat(64));
    registry.registerVersion("version-a", "resource-a", "a".repeat(64));
    registry.registerVersion("version-b", "resource-b", "a".repeat(64));
    registry.registerVersion("version-c", "resource-c", "c".repeat(64));
    const duplicate = registry.confirmDuplicate({
      id: "duplicate-1",
      sourceCandidateId: "candidate-1",
      targetResourceVersionId: "version-a",
      evidenceIds: ["evidence-1"],
      decisionId: "decision-1",
      reason: "Initial duplicate",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    const correctedDuplicate = registry.correctDuplicate(duplicate.id, 1, {
      ...duplicate,
      id: "duplicate-2",
      targetResourceVersionId: "version-b",
      decisionId: "decision-2",
    });
    expect(correctedDuplicate.supersedesRelationshipId).toBe(duplicate.id);

    const fork = registry.markFork({
      id: "fork-1",
      forkResourceVersionId: "version-c",
      originResourceVersionId: "version-a",
      evidenceIds: ["evidence-1"],
      decisionId: "decision-3",
      reason: "Initial fork",
      actorId: "editor-1",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    const correctedFork = registry.correctFork(fork.id, 1, {
      ...fork,
      id: "fork-2",
      originResourceVersionId: "version-b",
      decisionId: "decision-4",
    });
    expect(correctedFork.supersedesRelationshipId).toBe(fork.id);
    expect(() =>
      registry.correctFork(correctedFork.id, 1, {
        ...correctedFork,
        id: "fork-3",
        forkResourceVersionId: "version-b",
      }),
    ).toThrow("source endpoint");
  });

  it("F20-F23 reject unregistered endpoint types and missing mirror delivery binding", () => {
    const registry = new IdentityRelationshipRegistry();
    expect(() =>
      registry.confirmDuplicate({
        id: "duplicate-x",
        sourceCandidateId: "candidate-x",
        targetResourceVersionId: "version-x",
        evidenceIds: ["evidence-1"],
        decisionId: "decision-1",
        reason: "invalid endpoints",
        actorId: "editor-1",
        createdAt: "2026-08-09T00:00:00.000Z",
      }),
    ).toThrow("registered");
    expect(() =>
      registry.markMirror({
        id: "mirror-x",
        mirrorSourceRepositoryId: "source-x",
        originSourceRepositoryId: "source-y",
        targetResourceVersionId: "version-x",
        sourceLinkId: "source-link-x",
        normalizedRoot: "../bad",
        contentEqual: true,
        evidenceIds: ["evidence-1"],
        decisionId: "decision-1",
        reason: "invalid endpoints",
        actorId: "editor-1",
        createdAt: "2026-08-09T00:00:00.000Z",
      }),
    ).toThrow("registered");
  });
});
