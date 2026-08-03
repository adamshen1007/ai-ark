import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { inspectContent, inspectPath } from "./index.js";

interface Scenario {
  readonly id: string;
  readonly path: string;
  readonly content?: string;
  readonly binaryHex?: string;
  readonly expected: string;
}

interface Manifest {
  readonly version: string;
  readonly providerScenarios: readonly { readonly id: string; readonly outcome: string }[];
  readonly scenarios: readonly Scenario[];
}

describe("M01 deterministic repository fixture corpus", () => {
  it("covers at least 25 scenarios and fails unsafe bytes and paths closed", async () => {
    const location = new URL("../../../fixtures/repositories/m01/manifest.json", import.meta.url);
    const manifest = JSON.parse(await readFile(location, "utf8")) as Manifest;
    expect(manifest.version).toBe("m01-v1");
    expect(manifest.scenarios.length).toBeGreaterThanOrEqual(25);
    expect(manifest.providerScenarios.length).toBeGreaterThanOrEqual(18);
    expect(manifest.providerScenarios.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "missing-repository",
        "provider-rate-limit",
        "repeated-immutable-revision",
      ]),
    );
    expect(new Set(manifest.scenarios.map(({ id }) => id)).size).toBe(manifest.scenarios.length);

    for (const scenario of manifest.scenarios) {
      const pathResult = inspectPath(scenario.path);
      if (pathResult.disposition === "QUARANTINED") {
        expect(pathResult.reasonCodes, scenario.id).toContain(scenario.expected);
        continue;
      }
      const bytes =
        scenario.binaryHex === undefined
          ? new TextEncoder().encode(scenario.content ?? "")
          : Uint8Array.from(Buffer.from(scenario.binaryHex, "hex"));
      const contentResult = inspectContent(scenario.path, bytes);
      if (scenario.expected === "ACQUIRED") {
        expect(contentResult.disposition, scenario.id).toBe("ACQUIRED");
      } else {
        expect(contentResult.reasonCodes, scenario.id).toContain(scenario.expected);
      }
    }
  });
});
