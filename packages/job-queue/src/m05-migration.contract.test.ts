import { describe, expect, it } from "vitest";

// @ts-expect-error JavaScript migration module is exercised directly by this contract test.
import { loadMigrations, renderMigrationSql } from "../../../scripts/db-common.mjs";

describe("M05 migration 004", () => {
  it("loads the separate canonical manifest and composite identity", async () => {
    const migrations = await loadMigrations();
    const migration = migrations[3];
    expect(migration).toMatchObject({ version: "004", filename: "004_m05_draft_projection.sql" });
    expect(migration?.manifest).toMatchObject({ schemaVersion: "M05_RUNTIME_PRIVILEGES_V1" });
    expect(migration?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(migration?.sha256).not.toBe(migration?.sqlSha256);
  });

  it("renders only the fixed M05 namespace and configured least-privilege LOGIN", async () => {
    const migrations = await loadMigrations();
    const migration = migrations[3];
    if (!migration) throw new Error("M05_MIGRATION_MISSING");
    const rendered = renderMigrationSql(
      migration.sql,
      "hostile_schema",
      migration.manifest,
      "fixture_m05_login",
    );
    expect(rendered).toContain("CREATE SCHEMA ai_ark_m05");
    expect(rendered).toContain("fixture_m05_login");
    expect(rendered).not.toContain("<M05_");
    expect(rendered).not.toContain("hostile_schema.inputs");
    expect(migrations[2]?.sqlSha256).toBe(
      "6da55b9ee12fccad5feb5b9fd31ff30ce972a8b3401f83a62cdb2bdf632939e8",
    );
  });
});
