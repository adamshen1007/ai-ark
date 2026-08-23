import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  authorizeCommand,
  createExternalIdentifierKey,
  createIdentityShells,
  createVersionIdentityKey,
  IdentityLifecycleRegistry,
  isUnicode151Scalar,
  normalizeGithubIssuer,
  normalizeGithubNamespace,
  resolveIdentity,
} from "./index.js";

interface ExpectedFixtureEvidence {
  readonly id: string;
  readonly fingerprints: readonly string[];
  readonly records: readonly string[];
  readonly decision: string;
  readonly auditStates: readonly string[];
}

const fixtureEvidence = new Map(
  (
    JSON.parse(
      readFileSync(
        new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url),
        "utf8",
      ),
    ) as { readonly expectedEvidence: readonly ExpectedFixtureEvidence[] }
  ).expectedEvidence.map((evidence) => [evidence.id, evidence]),
);

function expectedEvidence(id: string): ExpectedFixtureEvidence {
  const evidence = fixtureEvidence.get(id);
  if (evidence === undefined) throw new Error(`missing expected evidence for ${id}`);
  return evidence;
}

describe("M02 identity", () => {
  it("normalizes the closed GitHub external-id-v1 namespace and issuer", () => {
    expect(normalizeGithubNamespace(" Anthropic ")).toBe("anthropic");
    expect(normalizeGithubNamespace("\u3000Anthropic\u3000")).toBe("anthropic");
    expect(() => normalizeGithubNamespace("foo_bar")).toThrow();
    expect(normalizeGithubIssuer("https://github.com:443/")).toBe("github.com");
    expect(() => normalizeGithubIssuer("http://github.com/")).toThrow(
      "INVALID_EXTERNAL_IDENTIFIER_ISSUER",
    );
    expect(() => normalizeGithubIssuer("https://127.0.0.1/")).toThrow();
    expect(() => normalizeGithubIssuer("https://-invalid.example/")).toThrow(
      "INVALID_EXTERNAL_IDENTIFIER_ISSUER",
    );
    expect(() => normalizeGithubIssuer("https://invalid-.example/")).toThrow(
      "INVALID_EXTERNAL_IDENTIFIER_ISSUER",
    );
    expect(isUnicode151Scalar(0x11f02)).toBe(true);
    expect(isUnicode151Scalar(0x323b0)).toBe(false);
    expect(() => normalizeGithubIssuer(`https://${String.fromCodePoint(0x323b0)}.com/`)).toThrow(
      "INVALID_EXTERNAL_IDENTIFIER_ISSUER",
    );
  });

  it("creates a scoped exact external identifier key", () => {
    const key = createExternalIdentifierKey({
      provider: "github",
      issuer: "https://github.com/",
      namespace: "Anthropic",
      identifierType: "PROVIDER_REPOSITORY_ID",
      normalizedValue: "R_kgDOExample",
      normalizationPolicyVersion: "external-id-v1",
    });
    expect(key.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(key.payload.namespace).toBe("anthropic");
    expect(key.payload.issuer).toBe("github.com");
    const manifest = createExternalIdentifierKey({
      provider: "github",
      issuer: "https://github.com/",
      namespace: "Anthropic",
      identifierType: "DECLARED_MANIFEST_ID",
      normalizedValue: " React_Agent ",
      normalizationPolicyVersion: "external-id-v1",
    });
    expect(manifest.payload.normalizedValue).toBe("react-agent");
    expect(expectedEvidence("F33")).toMatchObject({
      records: [`external-id:${key.payload.issuer}:${key.payload.namespace}`],
      decision: "EXTERNAL_ID_V1",
      auditStates: ["VERIFIED"],
    });
    expect(() =>
      createExternalIdentifierKey({
        ...key.payload,
        provider: "gitlab" as never,
        issuer: "https://github.com/",
      }),
    ).toThrow("provider");
  });

  it("applies exact precedence and blocks contradictions", () => {
    expect(resolveIdentity({ reliableNameToken: "demo", matches: [] }).outcome).toBe(
      "NEW_RESOURCE",
    );
    expect(resolveIdentity({ reliableNameToken: null, matches: [] }).outcome).toBe(
      "AMBIGUOUS_IDENTITY",
    );
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          { tier: "P1", resourceIdentityId: "r1", contentEqual: true, exactSourceLink: true },
          {
            tier: "P2",
            resourceIdentityId: "r2",
            contentEqual: true,
            provenanceType: "M01_PROVIDER_ASSERTED",
            reviewState: "VERIFIED",
            trustedScopedKey: true,
          },
        ],
      }).outcome,
    ).toBe("AMBIGUOUS_IDENTITY");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [{ tier: "P4", resourceIdentityId: "r1", contentEqual: true }],
      }).outcome,
    ).toBe("POSSIBLE_DUPLICATE");
  });

  it("F18/F33 enforces the executable P1-P3 trust matrix", () => {
    expect(expectedEvidence("F18")).toMatchObject({
      records: ["identity-decision:precedence-matrix"],
      decision: "AMBIGUOUS_ON_CONTRADICTION",
      auditStates: ["REVIEW_REQUIRED"],
    });
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P1",
            resourceIdentityId: "r1",
            contentEqual: false,
            exactSourceLink: true,
          },
        ],
      }).outcome,
    ).toBe("EXISTING_RESOURCE_NEW_VERSION");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P2",
            resourceIdentityId: "r1",
            contentEqual: true,
            provenanceType: "M01_PROVIDER_ASSERTED",
            reviewState: "VERIFIED",
            trustedScopedKey: true,
          },
        ],
      }).outcome,
    ).toBe("EXACT_REPEAT_REUSE");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P2",
            resourceIdentityId: "r1",
            contentEqual: true,
            provenanceType: "HUMAN_VERIFIED_SOURCE_DECLARATION",
            reviewState: "UNREVIEWED",
            trustedScopedKey: false,
          },
        ],
      }).outcome,
    ).toBe("POSSIBLE_DUPLICATE");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "r1",
            contentEqual: true,
            providerFork: true,
            reviewed: false,
            upstreamExact: true,
          },
        ],
      }).outcome,
    ).toBe("FORK_OF_EXISTING_RESOURCE");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          { tier: "P1", resourceIdentityId: "r1", contentEqual: true, exactSourceLink: true },
          {
            tier: "P2",
            resourceIdentityId: "r2",
            contentEqual: true,
            provenanceType: "M01_PROVIDER_ASSERTED",
            reviewState: "VERIFIED",
            trustedScopedKey: true,
          },
        ],
      }).outcome,
    ).toBe("AMBIGUOUS_IDENTITY");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          { tier: "P1", resourceIdentityId: "r1", contentEqual: true, exactSourceLink: true },
          {
            tier: "P3",
            resourceIdentityId: "r2",
            contentEqual: true,
            providerFork: true,
            reviewed: false,
            upstreamExact: true,
          },
        ],
      }).outcome,
    ).toBe("AMBIGUOUS_IDENTITY");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          { tier: "P1", resourceIdentityId: "r1", contentEqual: true, exactSourceLink: true },
          {
            tier: "P2",
            resourceIdentityId: "r2",
            contentEqual: true,
            provenanceType: "HUMAN_VERIFIED_SOURCE_DECLARATION",
            reviewState: "UNREVIEWED",
            trustedScopedKey: false,
          },
        ],
      }).outcome,
    ).toBe("AMBIGUOUS_IDENTITY");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          { tier: "P5", resourceIdentityId: "r1", contentEqual: false },
          { tier: "P5", resourceIdentityId: "r2", contentEqual: false },
        ],
      }).outcome,
    ).toBe("AMBIGUOUS_IDENTITY");
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [{ tier: "P6", resourceIdentityId: "r1", contentEqual: false }],
      }).outcome,
    ).toBe("NEW_RESOURCE");
  });

  it("requires human disposition for reviewed fork and mirror provenance", () => {
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "origin",
            contentEqual: false,
            providerFork: true,
            relationshipKind: "FORK",
            reviewed: true,
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({
      outcome: "FORK_OF_EXISTING_RESOURCE",
      resourceIdentityId: "origin",
      reviewRequired: true,
    });
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "origin",
            contentEqual: true,
            providerFork: true,
            relationshipKind: "MIRROR",
            reviewed: true,
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({ outcome: "MIRROR", resourceIdentityId: "origin", reviewRequired: true });
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "origin",
            contentEqual: true,
            relationshipKind: "MIRROR",
            reviewed: true,
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({ outcome: "MIRROR", resourceIdentityId: "origin", reviewRequired: true });
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "origin",
            contentEqual: false,
            relationshipKind: "MIRROR",
            reviewed: true,
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({
      outcome: "AMBIGUOUS_IDENTITY",
      resourceIdentityId: null,
      reviewRequired: true,
    });
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P3",
            resourceIdentityId: "origin-a",
            contentEqual: true,
            relationshipKind: "MIRROR",
            upstreamExact: true,
          },
          {
            tier: "P3",
            resourceIdentityId: "origin-b",
            contentEqual: false,
            relationshipKind: "FORK",
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({ outcome: "AMBIGUOUS_IDENTITY", resourceIdentityId: null });
    const contradictorySameTarget = [
      {
        tier: "P3" as const,
        resourceIdentityId: "origin",
        contentEqual: true,
        relationshipKind: "MIRROR" as const,
        upstreamExact: true,
      },
      {
        tier: "P3" as const,
        resourceIdentityId: "origin",
        contentEqual: false,
        relationshipKind: "FORK" as const,
        upstreamExact: true,
      },
    ];
    for (const matches of [contradictorySameTarget, [...contradictorySameTarget].reverse()]) {
      expect(resolveIdentity({ reliableNameToken: "demo", matches })).toMatchObject({
        outcome: "AMBIGUOUS_IDENTITY",
        resourceIdentityId: null,
      });
    }
  });

  it("blocks same-target P1 reuse when P3 provenance says fork", () => {
    expect(
      resolveIdentity({
        reliableNameToken: "demo",
        matches: [
          {
            tier: "P1",
            resourceIdentityId: "r1",
            contentEqual: true,
            exactSourceLink: true,
          },
          {
            tier: "P3",
            resourceIdentityId: "r1",
            contentEqual: false,
            relationshipKind: "FORK",
            reviewed: true,
            upstreamExact: true,
          },
        ],
      }),
    ).toMatchObject({ outcome: "AMBIGUOUS_IDENTITY", reviewRequired: true });
  });

  it("F15/F16/F17 reuses methodology/content identity while adding observations and changed versions", () => {
    const registry = new IdentityLifecycleRegistry();
    const base = {
      resourceIdentityId: "resource-1",
      candidateId: "candidate-1",
      candidateContentFingerprint: "a".repeat(64),
      sourceSnapshotId: "snapshot-1",
      methodologyFingerprint: "b".repeat(64),
    };
    expect(registry.observe(base)).toMatchObject({
      candidateCreated: true,
      versionCreated: true,
      observationCreated: true,
      methodologySuperseded: false,
    });
    expect(registry.observe({ ...base, methodologyFingerprint: "c".repeat(64) })).toMatchObject({
      candidateCreated: false,
      versionCreated: false,
      observationCreated: false,
      methodologySuperseded: true,
    });
    expect(registry.counts()).toEqual({ candidates: 1, versions: 1, observations: 1 });
    expect(registry.observe({ ...base, sourceSnapshotId: "snapshot-2" })).toMatchObject({
      versionCreated: false,
      observationCreated: true,
    });
    expect(
      registry.observe({
        ...base,
        sourceSnapshotId: "snapshot-3",
        candidateContentFingerprint: "d".repeat(64),
      }),
    ).toMatchObject({ versionCreated: true, observationCreated: true });
    expect(registry.counts()).toEqual({ candidates: 1, versions: 2, observations: 3 });
    expect(expectedEvidence("F15")).toMatchObject({
      records: ["candidate:candidate-1", "version:version-1", "observation:snapshot-1"],
      decision: "VERSION_REUSED",
      auditStates: ["METHODOLOGY_SUPERSEDED"],
    });
    expect(expectedEvidence("F16")).toMatchObject({
      records: ["version:version-1", "observation:snapshot-2"],
      decision: "OBSERVATION_ADDED",
      auditStates: ["OBSERVED"],
    });
    expect(expectedEvidence("F17")).toMatchObject({
      records: ["version:version-2", "observation:snapshot-3"],
      decision: "EXISTING_RESOURCE_NEW_VERSION",
      auditStates: ["OBSERVED"],
    });
  });

  it("F19 creates only minimum non-public identity/version shells", () => {
    const shells = createIdentityShells({
      resourceIdentityId: "resource-1",
      resourceVersionIdentityId: "version-1",
      identityToken: "demo-skill",
      identityTokenEvidenceId: "evidence-1",
      contentFingerprint: "a".repeat(64),
      sourceSnapshotId: "snapshot-1",
      candidateRootId: "root-1",
      sourceRevision: "0123456789abcdef",
      createdAt: "2026-08-09T00:00:00.000Z",
    });
    expect(shells.identity.type).toBe("SKILL");
    expect(shells.version.observationLabel).toBe("snapshot:0123456789ab");
    expect(expectedEvidence("F19")).toMatchObject({
      records: [`resource:${shells.identity.id}`, `version:${shells.version.id}`],
      decision: "NON_PUBLIC_SHELLS",
      auditStates: ["IDENTITY_RESOLVED"],
    });
    expect(shells.identity).not.toHaveProperty("slug");
    expect(shells.version).not.toHaveProperty("versionLabel");
    expect(createVersionIdentityKey("resource-1", "a".repeat(64))).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      createIdentityShells({
        resourceIdentityId: "resource-2",
        resourceVersionIdentityId: "version-2",
        identityToken: "!! invented !!",
        identityTokenEvidenceId: "evidence-2",
        contentFingerprint: "b".repeat(64),
        sourceSnapshotId: "snapshot-2",
        candidateRootId: "root-2",
        sourceRevision: "0123456789abcdef",
        createdAt: "2026-08-09T00:00:00.000Z",
      }),
    ).toThrow("reliable identity token");
  });

  it("enforces the closed command role matrix", () => {
    expect(authorizeCommand("EDITOR", "CREATE_RESOURCE")).toBe(true);
    expect(authorizeCommand("EDITOR", "SPLIT_ROOTS")).toBe(false);
    expect(authorizeCommand("TECHNICAL_REVIEWER", "REJECT_CANDIDATE")).toBe(true);
    expect(authorizeCommand("TECHNICAL_REVIEWER", "MARK_FORK")).toBe(false);
    expect(authorizeCommand("ADMIN", "OVERRIDE_UNSUPPORTED" as never)).toBe(false);
    expect(authorizeCommand("VIEWER", "CREATE_RESOURCE")).toBe(false);
    expect(authorizeCommand("ADMIN", "REPLACE_M02_JOB")).toBe(false);
    expect(authorizeCommand("EDITOR", "REPLACE_M02_JOB", true)).toBe(true);
    expect(authorizeCommand("TECHNICAL_REVIEWER", "REPLACE_M02_JOB", true)).toBe(true);
    expect(expectedEvidence("F24")).toMatchObject({
      records: ["manual-command:role-matrix"],
      decision: "ROLE_MATRIX",
      auditStates: ["ACCEPTED", "REJECTED"],
    });
  });
});
