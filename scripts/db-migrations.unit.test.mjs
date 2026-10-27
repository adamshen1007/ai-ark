import { describe, expect, it } from "vitest";

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import {
  classifyBootstrap,
  loadMigrations,
  m04MigrationIdentity,
  safeDatabaseErrorCode,
  validateDatabaseSchemaName,
  validateDatabaseTarget,
  validateRuntimePrivilegeManifest,
} from "./db-common.mjs";

describe("M04 database command safety", () => {
  it("accepts only explicit local/test allowlisted targets", () => {
    expect(
      validateDatabaseTarget({
        databaseUrl: ["postgres://user", "fixture-only@127.0.0.1:5432/ai_ark_test"].join(":"),
        environment: "test",
        allowedHosts: "127.0.0.1,localhost",
      }).hostname,
    ).toBe("127.0.0.1");
    expect(() =>
      validateDatabaseTarget({
        databaseUrl: ["postgres://user", "fixture-only@db.example.test:5432/ai_ark"].join(":"),
        environment: "production",
        allowedHosts: "db.example.test",
      }),
    ).toThrow("M04_DATABASE_ENVIRONMENT_PROHIBITED");
    expect(() =>
      validateDatabaseTarget({
        databaseUrl: ["postgres://user", "fixture-only@db.example.test:5432/ai_ark"].join(":"),
        environment: "test",
        allowedHosts: "db.example.test",
      }),
    ).toThrow("M04_DATABASE_HOST_NOT_LOOPBACK");
  });

  it("classifies only exact committed migration prefixes", () => {
    expect(
      classifyBootstrap([], ["source_snapshots", "acquisition_jobs", "acquisition_results"]),
    ).toBe(0);
    expect(
      classifyBootstrap(
        ["source_snapshots", "acquisition_jobs", "acquisition_results"],
        ["source_snapshots", "acquisition_jobs", "acquisition_results"],
      ),
    ).toBe(1);
    expect(() =>
      classifyBootstrap(
        ["source_snapshots"],
        ["source_snapshots", "acquisition_jobs", "acquisition_results"],
      ),
    ).toThrow("M04_DATABASE_BOOTSTRAP_INVALID");
  });

  it("catalogs views, sequences, types, domains, and row policies", async () => {
    const source = await readFile(new URL("./db-common.mjs", import.meta.url), "utf8");
    for (const catalogClass of ["relation", "sequence", "type", "domain", "policy"])
      expect(source).toContain(`'${catalogClass}' object_kind`);
  });

  it("maps unrestricted database errors to a closed non-sensitive code", () => {
    const hostile = new Error(
      "connection failed for postgres://private-user:private-password@host/private-db; SELECT secret",
    );
    expect(safeDatabaseErrorCode(hostile, "M04_DATABASE_VALIDATION_FAILED")).toBe(
      "M04_DATABASE_VALIDATION_FAILED",
    );
    expect(safeDatabaseErrorCode(new Error("M04_SCHEMA_CATALOG_DRIFT"), "fallback")).toBe(
      "M04_SCHEMA_CATALOG_DRIFT",
    );
  });

  it("accepts only exact non-system PostgreSQL schema identifiers", () => {
    expect(validateDatabaseSchemaName("public")).toBe("public");
    expect(validateDatabaseSchemaName("m04_runtime_1")).toBe("m04_runtime_1");
    for (const invalid of [
      "pg_catalog",
      "pg_temp_1",
      "information_schema",
      "Upper",
      "quoted-name",
      "évidence",
      `a${"b".repeat(63)}`,
    ])
      expect(() => validateDatabaseSchemaName(invalid), invalid).toThrow(
        "M04_DATABASE_SCHEMA_INVALID",
      );
  });

  it("binds canonical runtime grants into migration 003 ledger identity", async () => {
    const raw = await readFile(
      new URL("../packages/job-queue/migrations/003_m04_runtime_privileges.json", import.meta.url),
    );
    const manifest = validateRuntimePrivilegeManifest(raw);
    expect(manifest.schemaVersion).toBe("M04_RUNTIME_PRIVILEGES_V2");
    expect(manifest.groups.map(({ role }) => role)).toEqual([
      "M01_M02_WRITER_GROUP",
      "M04_RUNTIME_GROUP",
    ]);
    expect(manifest.groups.map(({ sequences }) => sequences)).toEqual([
      [{ name: "m02_rejected_command_audits_id_seq", operations: ["USAGE"] }],
      [],
    ]);
    const migrations = await loadMigrations();
    const m04 = migrations[2];
    expect(m04.manifestSha256).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(m04.sha256).toBe(m04MigrationIdentity(m04.sqlSha256, m04.manifestSha256));
    expect(m04.sha256).not.toBe(m04.sqlSha256);
    expect(m04MigrationIdentity(m04.sqlSha256, "0".repeat(64))).not.toBe(m04.sha256);
    for (const changed of [
      raw.subarray(0, -1),
      Buffer.from(`${raw.toString("utf8").trimEnd()}  \n`),
      Buffer.from(raw.toString("utf8").replace("M04_RUNTIME_GROUP", "M04_RUNTIME_GROUPX")),
      Buffer.from(
        raw.toString("utf8").replace("M04_RUNTIME_PRIVILEGES_V2", "M04_RUNTIME_PRIVILEGES_V1"),
      ),
      Buffer.from(raw.toString("utf8").replace(',"sequences":[]', "")),
      Buffer.from(
        raw.toString("utf8").replace('"operations":["USAGE"]', '"operations":["SELECT"]'),
      ),
      Buffer.from(
        raw
          .toString("utf8")
          .replace(
            '"m02_rejected_command_audits_id_seq"',
            '"m02_rejected_command_audits_id_seq_extra"',
          ),
      ),
      Buffer.from(raw.toString("utf8").replace('"SELECT","INSERT"', '"INSERT","SELECT"')),
    ])
      expect(() => validateRuntimePrivilegeManifest(changed)).toThrow(
        "M04_RUNTIME_PRIVILEGE_MANIFEST_INVALID",
      );
  });
});
