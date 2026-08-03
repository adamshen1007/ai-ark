import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("M01 PostgreSQL migration", () => {
  it("defines durable idempotent acquisition state without destructive statements", async () => {
    const migration = await readFile(
      new URL("../migrations/001_m01_acquisition_jobs.sql", import.meta.url),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE source_snapshots");
    expect(migration).toContain("identity_key text NOT NULL UNIQUE");
    expect(migration).toContain("CREATE TABLE acquisition_jobs");
    expect(migration).toContain("idempotency_key text NOT NULL UNIQUE");
    expect(migration).toContain("status IN ('ACTIVE', 'COMPLETED', 'FAILED'");
    expect(migration).toContain("current_stage IN ('RECEIVED', 'VALIDATING_SOURCE'");
    expect(migration).toContain("completed_stages jsonb NOT NULL");
    expect(migration).toContain("cancellation_requested boolean NOT NULL");
    expect(migration).toContain("CREATE TABLE acquisition_results");
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b/iu);
  });
});
