import { readFile } from "node:fs/promises";

import { canonicalJsonM03 } from "@ai-ark/contracts";
import { describe, expect, it } from "vitest";

import { flatLinkScalarObjectEqual } from "./postgres-evidence-persistence.js";

describe("M04 PostgreSQL evidence persistence locking", () => {
  it("uses transaction-scoped advisory locks exclusively", async () => {
    const source = await readFile(
      new URL("./postgres-evidence-persistence.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("pg_advisory_lock(");
    expect(source).not.toContain("pg_advisory_unlock(");
    expect(source.match(/pg_advisory_xact_lock\(/gu)).toHaveLength(1);
    const advisory = source.indexOf("SELECT pg_advisory_xact_lock");
    const sharedFence = source.indexOf("m03_m04_lock_predecessor_shared", advisory);
    const predecessor = source.indexOf("const predecessor = await this.readPredecessor");
    expect(sharedFence).toBeGreaterThan(advisory);
    expect(predecessor).toBeGreaterThan(sharedFence);
  });

  it("makes the exclusive predecessor fence the first M02 transaction lock", async () => {
    for (const filename of ["postgres-manual-resolution.ts", "postgres-system-identity.ts"]) {
      const source = await readFile(new URL(`./${filename}`, import.meta.url), "utf8");
      const begin = source.indexOf('client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")');
      const exclusive = source.indexOf("m03_m04_lock_predecessor_exclusive", begin);
      const advisory = source.indexOf("pg_advisory_xact_lock", begin);
      expect(exclusive, filename).toBeGreaterThan(begin);
      expect(advisory, filename).toBeGreaterThan(exclusive);
    }
  });
});

describe("M04 flat Link comparison", () => {
  const expected = {
    schemaVersion: "M04_CLAIM_EVIDENCE_LINK_V1",
    id: "cel_example",
    claimId: "clm_example",
    evidenceItemId: "evi_example",
    m03SourceReferenceId: "ref_example",
    relationship: "SUPPORTS",
    ordinal: 0,
    recordFingerprint: "a".repeat(64),
  };

  it("agrees with canonical JSON equality for the accepted flat scalar shape", () => {
    const reordered = Object.fromEntries(Object.entries(expected).reverse());
    const cases: readonly [string, unknown][] = [
      ["same", { ...expected }],
      ["reordered keys", reordered],
      ["negative zero", { ...expected, ordinal: -0 }],
      ["different ID", { ...expected, id: "cel_other" }],
      ["different ordinal", { ...expected, ordinal: 1 }],
      ["null scalar", { ...expected, relationship: null }],
      [
        "missing key",
        Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "relationship")),
      ],
      ["extra key", { ...expected, unexpected: "value" }],
      ["nested value", { ...expected, relationship: { value: "SUPPORTS" } }],
      ["array", Object.values(expected)],
      ["null", null],
    ];
    for (const [name, value] of cases)
      expect(flatLinkScalarObjectEqual(value, expected), name).toBe(
        canonicalJsonM03(value) === canonicalJsonM03(expected),
      );
  });
});
