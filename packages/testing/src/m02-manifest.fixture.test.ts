import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { ExecutedReceiptCollector } from "./m02-executed-receipts.js";

interface M02Manifest {
  readonly version: string;
  readonly scenarios: readonly {
    readonly id: string;
    readonly gate: string;
    readonly expected: string;
  }[];
  readonly expectedEvidence: readonly {
    readonly id: string;
    readonly fingerprints: readonly string[];
    readonly records: readonly string[];
    readonly decision: string;
    readonly auditStates: readonly string[];
  }[];
}

const executableEvidenceFileByScenario = {
  F01: "../../classification/src/classification.fixture.test.ts",
  F02: "../../classification/src/classification.fixture.test.ts",
  F03: "../../classification/src/classification.fixture.test.ts",
  F04: "../../classification/src/classification.fixture.test.ts",
  F05: "../../classification/src/classification.fixture.test.ts",
  F06: "../../classification/src/classification.fixture.test.ts",
  F07: "../../classification/src/classification.fixture.test.ts",
  F08: "../../classification/src/classification.fixture.test.ts",
  F09: "../../classification/src/classification.fixture.test.ts",
  F10: "../../classification/src/classification.fixture.test.ts",
  F11: "../../classification/src/classification.fixture.test.ts",
  F12: "../../classification/src/classification.fixture.test.ts",
  F13: "../../classification/src/classification.fixture.test.ts",
  F14: "../../classification/src/classification.fixture.test.ts",
  F15: "../../identity/src/identity.unit.test.ts",
  F16: "../../identity/src/identity.unit.test.ts",
  F17: "../../identity/src/identity.unit.test.ts",
  F18: "../../identity/src/identity.unit.test.ts",
  F19: "../../identity/src/identity.unit.test.ts",
  F20: "../../identity/src/identity-relationships.contract.test.ts",
  F21: "../../identity/src/identity-relationships.contract.test.ts",
  F22: "../../identity/src/identity-relationships.contract.test.ts",
  F23: "../../identity/src/identity-relationships.contract.test.ts",
  F24: "../../identity/src/identity.unit.test.ts",
  F25: "../../job-queue/src/job-supersession.unit.test.ts",
  F26: "../../job-queue/src/job-supersession.unit.test.ts",
  F27: "../../job-queue/src/job-supersession.unit.test.ts",
  F28: "../../analysis/src/ai-analysis.contract.test.ts",
  F29: "../../classification/src/classification.adversarial.test.ts",
  F30: "../../analysis/src/ai-analysis.contract.test.ts",
  F31: "../../classification/src/classification.adversarial.test.ts",
  F32: "../../classification/src/classification.fixture.test.ts",
  F33: "../../identity/src/identity.unit.test.ts",
  F34: "../../identity/src/manual-resolution.adversarial.test.ts",
  F35: "../../job-queue/src/job-supersession.unit.test.ts",
  F36: "./m02-command-adapter.integration.test.ts",
  F37: "./m02-command-adapter.integration.test.ts",
  F38: "./m02-command-adapter.integration.test.ts",
  F39: "./m02-command-adapter.integration.test.ts",
  F40: "./m02-command-adapter.integration.test.ts",
  F41: "./m02-command-adapter.integration.test.ts",
  F42: "./m02-system-identity.integration.test.ts",
} as const;

describe("M02 deterministic fixture manifest", () => {
  it("fails closed until every executed receipt predicate is present", () => {
    const collector = new ExecutedReceiptCollector({ F99: ["query.rows", "assertion.equal"] });
    collector.record("F99", "query.rows", { count: 1 });
    expect(() => collector.finalize("F99")).toThrow(
      "EXECUTED_RECEIPTS_MISSING:F99:assertion.equal",
    );
  });

  it("finalizes immutable evidence only after the complete receipt matrix executes", () => {
    const collector = new ExecutedReceiptCollector({ F99: ["query.rows", "assertion.equal"] });
    collector.record("F99", "query.rows", { count: 1 });
    collector.record("F99", "assertion.equal", true);
    const evidence = collector.finalize("F99");
    expect(evidence.records).toHaveLength(2);
    expect(evidence.records.every((record) => record.startsWith("receipt:"))).toBe(true);
    expect(evidence.decision).toMatch(/^EXECUTED_RECEIPTS:F99:count=2:sha256=/u);
  });

  it("contains every F01-F42 scenario exactly once with a gate and expected outcome", async () => {
    const location = new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url);
    const manifest = JSON.parse(await readFile(location, "utf8")) as M02Manifest;
    expect(manifest.version).toBe("m02-v1");
    expect(manifest.scenarios.map(({ id }) => id)).toEqual(
      Array.from(
        { length: 42 },
        (_, index) =>
          `F${String(index + 1).padStart(2, "0")}-${
            [
              "single-root",
              "multiple",
              "collection",
              "skill-app",
              "non-skill",
              "ambiguous-overlap",
              "unsupported",
              "example-only",
              "same-content-roots",
              "same-content-repositories",
              "shared-root-files",
              "reordered-input",
              "overlap-change",
              "shared-change",
              "methodology-only",
              "same-content-new-snapshot",
              "changed-source",
              "identity-matrix",
              "minimum-shells",
              "duplicate-no-source-resource",
              "independent-fork",
              "mirror",
              "relationship-correction",
              "command-roles",
              "mixed-job",
              "stale-worker",
              "partial-failure",
              "limits",
              "collision",
              "hostile-source",
              "parser-profile",
              "bounded-input-fingerprint",
              "external-identifiers",
              "command-concurrency",
              "job-supersession",
              "lock-categories",
              "mode-expansion",
              "topology-control",
              "replacement-clarifications",
              "audit-multiplicity",
              "server-id-independent-guards",
              "system-identity-projection",
            ][index] ?? "missing"
          }`,
      ),
    );
    expect(
      manifest.scenarios.every(({ gate, expected }) => gate.length > 0 && expected.length > 0),
    ).toBe(true);
    expect(manifest.expectedEvidence.map(({ id }) => id)).toEqual(
      Array.from({ length: 42 }, (_, index) => `F${String(index + 1).padStart(2, "0")}`),
    );
    for (const evidence of manifest.expectedEvidence) {
      expect(evidence.records.length, `${evidence.id} records`).toBeGreaterThan(0);
      expect(evidence.decision.length, `${evidence.id} decision`).toBeGreaterThan(0);
      expect(evidence.auditStates.length, `${evidence.id} audit states`).toBeGreaterThan(0);
      expect(
        evidence.fingerprints.every((fingerprint) => /^[a-f0-9]{64}$/u.test(fingerprint)),
        `${evidence.id} fingerprints`,
      ).toBe(true);
    }
  });

  it("maps every F01-F42 inventory entry to discovered executable behavioral evidence", async () => {
    const location = new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url);
    const manifest = JSON.parse(await readFile(location, "utf8")) as M02Manifest;
    expect(Object.keys(executableEvidenceFileByScenario)).toEqual(
      manifest.scenarios.map(({ id }) => id.slice(0, 3)),
    );
    for (const scenario of manifest.scenarios) {
      const fixtureId = scenario.id.slice(0, 3);
      const evidenceFile =
        executableEvidenceFileByScenario[
          fixtureId as keyof typeof executableEvidenceFileByScenario
        ];
      const evidenceSource = await readFile(new URL(evidenceFile, import.meta.url), "utf8");
      expect(
        new RegExp(`\\b${fixtureId}\\b`, "u").test(evidenceSource),
        `${scenario.id} lacks its explicit executable evidence mapping in ${evidenceFile}`,
      ).toBe(true);
      expect(
        evidenceSource.includes("manifest.json") && evidenceSource.includes("expectedEvidence"),
        `${scenario.id} does not compare executable output to manifest evidence in ${evidenceFile}`,
      ).toBe(true);
      if (Number(fixtureId.slice(1)) >= 36) {
        expect(
          evidenceSource.includes(`finalizeExecutedEvidence("${fixtureId}"`) &&
            evidenceSource.includes("expectedEvidence.get"),
          `${scenario.id} does not consume all expectedEvidence fields through an executable comparison in ${evidenceFile}`,
        ).toBe(true);
      }
    }
  });

  it("requires F36-F42 evidence to finalize only from complete executed PostgreSQL receipt matrices", async () => {
    const location = new URL("../../../fixtures/repositories/m02/manifest.json", import.meta.url);
    const manifest = JSON.parse(await readFile(location, "utf8")) as M02Manifest;
    for (const evidence of manifest.expectedEvidence.slice(35)) {
      expect(
        evidence.records.every((record) => record.startsWith("receipt:")),
        `${evidence.id} contains a non-receipt evidence record`,
      ).toBe(true);
      const evidenceFile =
        executableEvidenceFileByScenario[
          evidence.id as keyof typeof executableEvidenceFileByScenario
        ];
      const evidenceSource = await readFile(new URL(evidenceFile, import.meta.url), "utf8");
      expect(
        evidenceSource.includes(`finalizeExecutedEvidence("${evidence.id}"`),
        `${evidence.id} has no complete executed-receipt finalizer`,
      ).toBe(true);
    }
  });
});
