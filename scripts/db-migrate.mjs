import {
  assertM04IdempotencyCollation,
  classifyCatalog,
  connectDatabase,
  expectedSchemaCatalog,
  loadMigrations,
  readSchemaCatalog,
  renderMigrationSql,
  safeDatabaseErrorCode,
} from "./db-common.mjs";

export async function migrate(env = process.env, testFault = {}) {
  const migrations = await loadMigrations();
  const { client, schema } = await connectDatabase(env);
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended('ai-ark:migrations',0))");
    const ledgerExists =
      (
        await client.query("SELECT to_regclass($1) IS NOT NULL AS exists", [
          `${schema}.schema_migrations`,
        ])
      ).rows[0]?.exists === true;
    let applied = 0;
    if (ledgerExists) {
      const ledger = await client.query(
        "SELECT version,filename,sha256 FROM schema_migrations ORDER BY version",
      );
      for (const [index, row] of ledger.rows.entries()) {
        const expected = migrations[index];
        if (
          !expected ||
          row.version !== expected.version ||
          row.filename !== expected.filename ||
          row.sha256 !== expected.sha256
        )
          throw new Error("M04_MIGRATION_LEDGER_DRIFT");
      }
      applied = ledger.rows.length;
    } else {
      const actual = await readSchemaCatalog(client, schema);
      const expectedPrefixes = [];
      for (const prefixLength of [0, 1, 2])
        expectedPrefixes.push(
          await expectedSchemaCatalog(client, migrations, prefixLength, schema),
        );
      applied = classifyCatalog(actual, expectedPrefixes);
    }
    for (let index = applied; index < migrations.length; index += 1) {
      const migration = migrations[index];
      if (!migration) throw new Error("M04_MIGRATION_SEQUENCE_INVALID");
      await client.query("BEGIN");
      try {
        await client.query(renderMigrationSql(migration.sql, schema, migration.manifest));
        if (testFault.failDuringVersion === migration.version)
          throw new Error("M04_TEST_MIGRATION_INTERRUPTED_DURING");
        if (migration.version === "003") {
          await assertM04IdempotencyCollation(client, schema);
          for (const item of migrations.slice(0, index + 1))
            await client.query(
              "INSERT INTO schema_migrations(version,filename,sha256,applied_at) VALUES ($1,$2,$3,now())",
              [item.version, item.filename, item.sha256],
            );
        } else if (ledgerExists) {
          await client.query(
            "INSERT INTO schema_migrations(version,filename,sha256,applied_at) VALUES ($1,$2,$3,now())",
            [migration.version, migration.filename, migration.sha256],
          );
        }
        if (testFault.failBeforeLedgerCommitVersion === migration.version)
          throw new Error("M04_TEST_MIGRATION_INTERRUPTED_BEFORE_LEDGER_COMMIT");
        await client.query("COMMIT");
        if (testFault.failAfterVersion === migration.version)
          throw new Error("M04_TEST_MIGRATION_INTERRUPTED_AFTER_COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    if (applied === migrations.length) await assertM04IdempotencyCollation(client, schema);
    return { appliedFrom: applied, total: migrations.length };
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtextextended('ai-ark:migrations',0))")
      .catch(() => undefined);
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await migrate();
    console.log(
      `Database migrations valid: ${result.total - result.appliedFrom} applied, ${result.total} total.`,
    );
  } catch (error) {
    console.error(safeDatabaseErrorCode(error, "M04_DATABASE_MIGRATION_FAILED"));
    process.exitCode = 1;
  }
}
