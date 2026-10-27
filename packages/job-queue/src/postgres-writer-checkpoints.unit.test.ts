import type { PoolClient } from "pg";
import { describe, expect, it } from "vitest";

import { guardedWriterClient } from "./postgres-writer-checkpoints.js";

describe("M01/M02 writer statement checkpoints", () => {
  it("checks both sides of every transaction statement and checks before COMMIT", async () => {
    const statements: string[] = [];
    let checks = 0;
    const raw = {
      query: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const client = guardedWriterClient(raw, () => {
      checks += 1;
      return Promise.resolve();
    });
    await client.query("BEGIN");
    await client.query("SELECT 1");
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("COMMIT");
    await client.query("SELECT 2");
    expect(checks).toBe(5);
    expect(statements).toEqual([
      "BEGIN",
      "SELECT 1",
      "SET CONSTRAINTS ALL IMMEDIATE",
      "COMMIT",
      "SELECT 2",
    ]);
  });

  it("rejects drift before a domain write while preserving rollback", async () => {
    const statements: string[] = [];
    const raw = {
      query: (sql: string) => {
        statements.push(sql);
        return Promise.resolve({ rows: [], rowCount: 0 });
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const client = guardedWriterClient(raw, () =>
      Promise.reject(new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT")),
    );
    await client.query("BEGIN");
    await expect(client.query("INSERT INTO guarded_table DEFAULT VALUES")).rejects.toThrow(
      "M04_DATABASE_ROLE_AUTHORITY_DRIFT",
    );
    await client.query("ROLLBACK");
    expect(statements).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("serializes concurrent calls as complete check-statement-check units", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    let firstStarted: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const raw = {
      query: async (sql: string) => {
        events.push(`query:${sql}`);
        if (sql === "SELECT 1") {
          firstStarted?.();
          await gate;
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    } as unknown as PoolClient;
    const client = guardedWriterClient(raw, () => {
      events.push("check");
      return Promise.resolve();
    });
    await client.query("BEGIN");
    const first = client.query("SELECT 1");
    const second = client.query("SELECT 2");
    await started;
    expect(events).toEqual(["query:BEGIN", "check", "query:SELECT 1"]);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual([
      "query:BEGIN",
      "check",
      "query:SELECT 1",
      "check",
      "check",
      "query:SELECT 2",
      "check",
    ]);
  });
});
