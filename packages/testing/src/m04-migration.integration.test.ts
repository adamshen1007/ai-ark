import { canonicalJsonM03 } from "@ai-ark/contracts";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error JavaScript migration module is exercised directly by this integration test.
import { loadMigrations, renderMigrationSql } from "../../../scripts/db-common.mjs";
import { EphemeralPostgresHarness } from "./postgres-harness.js";

const harness = new EphemeralPostgresHarness();
let pool: Pool;
let migrations: Awaited<ReturnType<typeof loadMigrations>>;

describe("M04 PostgreSQL migration", () => {
  beforeAll(async () => {
    migrations = await loadMigrations();
    pool = await harness.start();
  }, 120_000);

  afterAll(async () => harness.stop());

  it("applies after frozen predecessors and installs durable closure", async () => {
    const client = await pool.connect();
    try {
      await client.query("CREATE SCHEMA m04_apply");
      await client.query("SET search_path TO m04_apply, public");
      for (const migration of migrations)
        await client.query(renderMigrationSql(migration.sql, "m04_apply", migration.manifest));
      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema='m04_apply' AND table_name LIKE 'm0%'
         ORDER BY table_name`,
      );
      expect(tables.rows.map(({ table_name }) => table_name)).toEqual(
        expect.arrayContaining([
          "m03_extraction_bundles",
          "m03_extraction_bundle_chunks",
          "m04_binding_requests",
          "m04_evidence_items",
          "m04_claims",
          "m04_claim_evidence_links",
          "m04_completeness_snapshots",
          "m04_binding_results",
        ]),
      );
      await client.query(
        `INSERT INTO source_snapshots
          (id,identity_key,provider,provider_repository_id,immutable_revision,acquisition_policy_version,acquired_at)
         VALUES ('snapshot-m04','key-m04','github','repo-m04',$1,'acquisition-v1',now())`,
        ["b".repeat(40)],
      );
      await expect(
        client.query("UPDATE source_snapshots SET provider='other' WHERE id='snapshot-m04'"),
      ).rejects.toThrow(/M04_IMMUTABLE_RECORD/u);
    } finally {
      client.release();
    }
  }, 120_000);

  it("serializes top-level and nested former marker arrays as ordinary data under the real LOGIN", async () => {
    const runtime = harness.poolForRole("ai_ark_m04_login");
    const ordinary = await runtime.query<{ output: string }>(
      "SELECT m04_apply.m04_canonical_json($1::jsonb) output",
      [JSON.stringify(["m04-ordinary-v1", { nested: ["m04-bytes-v1", "dropRoot", "e30=", []] }])],
    );
    expect(ordinary.rows[0]?.output).toBe(
      '["m04-ordinary-v1",{"nested":["m04-bytes-v1","dropRoot","e30=",[]]}]',
    );

    const raw = '{"a":1e-7,"z":"\\u0000"}';
    const encoded = Buffer.from(raw, "utf8").toString("base64");
    const marker = ["m04-bytes-v1", "dropRoot", encoded, ["z"]];
    const projected = await runtime.query<{ valid: boolean; ordinary: string }>(
      `SELECT m04_apply.m04_payload_is_canonical_json($1::bytea) valid,
              m04_apply.m04_canonical_json($2::jsonb) ordinary`,
      [Buffer.from(raw, "utf8"), JSON.stringify(marker)],
    );
    expect(projected.rows[0]).toMatchObject({ valid: true, ordinary: JSON.stringify(marker) });
    const malformedMarker = ["m04-bytes-v1", "dropRoot", "e30", []];
    const malformed = await runtime.query<{ ordinary: string }>(
      "SELECT m04_apply.m04_canonical_json($1::jsonb) ordinary",
      [JSON.stringify(malformedMarker)],
    );
    expect(malformed.rows[0]?.ordinary).toBe(JSON.stringify(malformedMarker));
  }, 120_000);

  it("sorts decoded escaped keys without accumulating long string values", async () => {
    const runtime = harness.poolForRole("ai_ark_m04_login");
    const canonical = canonicalJsonM03({
      "\u0000": `${"x".repeat(128 * 1024)}\n`,
      '"': 1,
      "\\": 2,
      a: 3,
      "😀": 4,
      values: ["\\u0041", "\\u0000", "\u0000", "\u000b", "\u001f", '"', "😀"],
    });
    const checked = await runtime.query<{ valid: boolean }>(
      "SELECT m04_apply.m04_payload_is_canonical_json(convert_to($1,'UTF8')) valid",
      [canonical],
    );
    expect(checked.rows[0]?.valid).toBe(true);

    const unsorted = await runtime.query<{ valid: boolean }>(
      "SELECT m04_apply.m04_payload_is_canonical_json(convert_to($1,'UTF8')) valid",
      ['{"a":1,"\\u0000":2}'],
    );
    expect(unsorted.rows[0]?.valid).toBe(false);

    const noncanonicalStrings = [
      '{"a":"\\u0041"}',
      '{"a":"\\u000B"}',
      '{"a":"\\u001F"}',
      '{"a":"\\/"}',
      '{"a":"\\ud83d\\ude00"}',
    ];
    const rejectedStrings = await runtime.query<{ valid: boolean }>(
      `SELECT m04_apply.m04_payload_is_canonical_json(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
      [noncanonicalStrings],
    );
    expect(rejectedStrings.rows.every(({ valid }) => !valid)).toBe(true);

    const whitespace = [
      ' {"a":1}',
      '{"a":1} ',
      '{"a" :1}',
      '{"a": 1}',
      '{"a":1 ,"b":2}',
      '{"a":1,\n"b":2}',
      "[1,\t2]",
      "[1,\r2]",
    ];
    const rejectedWhitespace = await runtime.query<{ valid: boolean }>(
      `SELECT m04_apply.m04_payload_is_canonical_json(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
      [whitespace],
    );
    expect(rejectedWhitespace.rows.every(({ valid }) => !valid)).toBe(true);
  }, 120_000);

  it("preserves exact canonicality around the closed ASCII link fast path", async () => {
    const runtime = harness.poolForRole("ai_ark_m04_login");
    const link = {
      claimId: `clm_${"a".repeat(64)}`,
      evidenceItemId: `evi_${"b".repeat(64)}`,
      id: `cel_${"c".repeat(64)}`,
      m03SourceReferenceId: `src_${"d".repeat(64)}`,
      ordinal: 0,
      recordFingerprint: "e".repeat(64),
      relationship: "SUPPORTS",
      schemaVersion: "M04_CLAIM_EVIDENCE_LINK_V1",
    };
    const canonical = JSON.stringify(link);
    const accepted = [
      canonical,
      ...[4095, 999_999_999, 1_000_000_000, -1, 1e-7].map((ordinal) =>
        JSON.stringify({ ...link, ordinal }),
      ),
      ...["QUALIFIES", "CONTEXT_ONLY", "OTHER", "\u0000", "😀"].map((relationship) =>
        JSON.stringify({ ...link, relationship }),
      ),
      ...[
        "src_1",
        "src_",
        "src_z",
        `src_${"A".repeat(64)}`,
        `src_${"a".repeat(63)}`,
        `src_${"a".repeat(65)}`,
      ].map((m03SourceReferenceId) => JSON.stringify({ ...link, m03SourceReferenceId })),
      canonicalJsonM03({ ...link, z: "x".repeat(1024) }),
    ];
    const rejected = [
      ` ${canonical}`,
      `${canonical}\n`,
      `${canonical} `,
      canonical.replace('"ordinal":0', '"ordinal":-0'),
      canonical.replace('"ordinal":0', '"ordinal":0.0'),
      canonical.replace('"ordinal":0', '"ordinal":0e0'),
      canonical.replace('"ordinal":0', '"ordinal":01'),
      canonical.replace('"claimId":', '"claimId":"duplicate","claimId":'),
      canonical.replace('"claimId"', '"\\u0063laimId"'),
      canonical.replace('"claimId"', '"zClaimId"'),
      canonical.replace("clm_", "\\u0063lm_"),
    ];
    const checked = await runtime.query<{ valid: boolean }>(
      `SELECT m04_apply.m04_payload_is_canonical_json(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
      [[...accepted, ...rejected]],
    );
    expect(checked.rows.map(({ valid }) => valid)).toEqual([
      ...accepted.map(() => true),
      ...rejected.map(() => false),
    ]);
    const installed = await pool.query<{ definition: string }>(
      `SELECT pg_get_functiondef('m04_apply.m04_payload_is_canonical_json(bytea)'::regprocedure)
         AS definition`,
    );
    const definition = installed.rows[0]?.definition ?? "";
    expect(definition).toContain("IF total_length < 1024 AND");
    const genericOnly = definition
      .replace(
        "m04_apply.m04_payload_is_canonical_json(payload bytea)",
        "m04_apply.m04_payload_generic_probe(payload bytea)",
      )
      .replace("IF total_length < 1024 AND", "IF false AND");
    expect(genericOnly).toContain("m04_payload_generic_probe");
    expect(genericOnly).not.toContain("IF total_length < 1024 AND");
    await pool.query(genericOnly);
    const branchProbe = definition
      .replace(
        "m04_apply.m04_payload_is_canonical_json(payload bytea)",
        "m04_apply.m04_payload_fast_branch_probe(payload bytea)",
      )
      .replace(
        "IF raw_text = fast_expected THEN RETURN true; END IF;",
        "IF raw_text = fast_expected THEN RETURN false; END IF;",
      );
    expect(branchProbe).toContain("IF raw_text = fast_expected THEN RETURN false; END IF;");
    await pool.query(branchProbe);
    try {
      const generic = await pool.query<{ valid: boolean }>(
        `SELECT m04_apply.m04_payload_generic_probe(convert_to(payload,'UTF8')) valid
           FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
        [[...accepted, ...rejected]],
      );
      expect(generic.rows).toEqual(checked.rows);
      const branch = await pool.query<{ valid: boolean }>(
        "SELECT m04_apply.m04_payload_fast_branch_probe(convert_to($1,'UTF8')) valid",
        [canonical],
      );
      expect(branch.rows[0]?.valid).toBe(false);
      if (process.env.AI_ARK_M04_CANONICAL_TRACE === "1") {
        const samples = Array.from({ length: 1000 }, (_, ordinal) =>
          JSON.stringify({ ...link, ordinal }),
        );
        for (const name of ["m04_payload_is_canonical_json", "m04_payload_generic_probe"]) {
          const started = Date.now();
          const measured = await pool.query<{ valid: string }>(
            `SELECT count(*) FILTER (WHERE m04_apply.${name}(convert_to(payload,'UTF8')))::text valid
               FROM unnest($1::text[]) samples(payload)`,
            [samples],
          );
          expect(measured.rows[0]?.valid).toBe("1000");
          process.stderr.write(
            `M04_CANONICAL_PROBE=${name} COUNT=1000 MS=${String(Date.now() - started)}\n`,
          );
        }
      }
    } finally {
      await pool.query("DROP FUNCTION m04_apply.m04_payload_fast_branch_probe(bytea)");
      await pool.query("DROP FUNCTION m04_apply.m04_payload_generic_probe(bytea)");
    }
  }, 120_000);

  it("matches a pinned-runtime canonical-byte matrix and rejects alternate encodings", async ({
    signal,
  }) => {
    let cancellation = Promise.resolve();
    const cancelActiveQueries = () => {
      cancellation = pool
        .query(
          `SELECT pg_cancel_backend(pid) FROM pg_stat_activity
             WHERE datname=current_database() AND pid<>pg_backend_pid() AND state='active'`,
        )
        .then(() => undefined)
        .catch(() => undefined);
    };
    signal.addEventListener("abort", cancelActiveQueries, { once: true });
    try {
      const runtime = harness.poolForRole("ai_ark_m04_login");
      const numericBoundaries = [
        0,
        1,
        4095,
        999_999_999,
        1_000_000_000,
        -0,
        1e-7,
        1e-6,
        1e20,
        1e21,
        Number.MIN_VALUE,
        Number.MAX_VALUE,
        2.225073858507201e-308,
        2.2250738585072014e-308,
        1.0000000000000002,
        1.0000000000000004,
        0.49999999999999994,
        0.5000000000000001,
        -0.0000010000000000000002,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        -1e-7,
        -1e21,
        0.1,
        0.9,
        1 / 3,
      ];
      const adjacentBoundaries = [
        1e-7,
        1e-6,
        1e20,
        1e21,
        Number.MIN_VALUE,
        2.2250738585072014e-308,
        0.5,
        1,
        2,
        Number.MAX_VALUE,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
      ]
        .flatMap((value) => {
          const buffer = Buffer.alloc(8);
          buffer.writeDoubleBE(value);
          const bits = buffer.readBigUInt64BE();
          return [-1n, 1n].map((offset) => {
            buffer.writeBigUInt64BE(bits + offset);
            return buffer.readDoubleBE();
          });
        })
        .filter(Number.isFinite);
      const generated: number[] = [];
      let bits = 0x9e3779b97f4a7c15n;
      const mask = (1n << 64n) - 1n;
      for (let index = 0; index < 65_536; index += 1) {
        bits ^= (bits << 13n) & mask;
        bits ^= bits >> 7n;
        bits ^= (bits << 17n) & mask;
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64BE(bits);
        const value = buffer.readDoubleBE();
        if (Number.isFinite(value)) generated.push(value);
      }
      const valid = [...numericBoundaries, ...adjacentBoundaries, ...generated].map((value) =>
        canonicalJsonM03({ value }),
      );
      valid.push(
        canonicalJsonM03({ é: [0.1, "x\u0000", ["m04-bytes-v1"]], "𝌆": '\\"\b\t\n\f\r\uE000😀' }),
        canonicalJsonM03({
          adjacent: "\u0000\u0000",
          escaped: "\\u0000\u0000",
          sentinel: "\uE000\u0000\uE000",
        }),
      );
      const accepted = await runtime.query<{ valid: boolean }>(
        `SELECT m04_apply.m04_payload_is_canonical_json(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
        [valid],
      );
      expect(accepted.rows).toHaveLength(valid.length);
      expect(accepted.rows.every((row) => row.valid)).toBe(true);
      const invalid = [
        '{"a":00}',
        '{"a":01}',
        '{"a":+1}',
        '{"a":999999999.0}',
        '{"a":1e0}',
        '{"a":0.0000001}',
        '{"a":1E-7}',
        '{"a":-0}',
        '{"a":4.9406564584124654e-324}',
        '{"a":2.4703282292062327e-324}',
        '{"a":2.2250738585072013e-308}',
        '{"a":1.7976931348623158e+308}',
        '{"a":1e-400}',
        '{"a":1e+400}',
        '{"a":1e-1000000000}',
        '{"a":1e+1000000000}',
        '{ "a":1}',
        '{"b":1,"a":2}',
        '{"a":1,"a":2}',
        '{"a":"\\u0008"}',
        '{"a":"\\ud800"}',
        '{"a":"\\uD83D\\uDE00"}',
        '{"a":"\\/"}',
        '{"a":NaN}',
      ];
      const rejected = await runtime.query<{ valid: boolean }>(
        `SELECT m04_apply.m04_payload_is_canonical_json(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
        [invalid],
      );
      expect(rejected.rows).toHaveLength(invalid.length);
      expect(rejected.rows.every((row) => !row.valid)).toBe(true);
      const malformed = await runtime.query<{ valid: boolean }>(
        "SELECT m04_apply.m04_payload_is_canonical_json($1::bytea) valid",
        [Buffer.from([0xc3, 0x28])],
      );
      expect(malformed.rows[0]?.valid).toBe(false);

      const definition = await runtime.query<{ definition: string }>(
        `SELECT pg_get_functiondef('m04_apply.m04_payload_is_canonical_json(bytea)'::regprocedure)
         AS definition`,
      );
      const numericImplementation = definition.rows[0]?.definition ?? "";
      expect(numericImplementation.match(/::float8/gu)).toHaveLength(1);
      expect(numericImplementation).toContain("FOR significant_digits IN 1..63 LOOP");
      expect(numericImplementation).not.toContain("candidate_float");
    } finally {
      signal.removeEventListener("abort", cancelActiveQueries);
      await cancellation;
    }
  }, 120_000);

  it("uses the exact bounded fallback when the platform hint is wrong", async () => {
    const installed = await pool.query<{ definition: string }>(
      `SELECT pg_get_functiondef('m04_apply.m04_payload_is_canonical_json(bytea)'::regprocedure)
         AS definition`,
    );
    const original = installed.rows[0]?.definition ?? "";
    const renamed = original.replace(
      "m04_apply.m04_payload_is_canonical_json(payload bytea)",
      "m04_apply.m04_payload_is_canonical_json_fallback(payload bytea)",
    );
    const forcedFallback = renamed.replace(
      "bits := pg_catalog.float8send(number_token::float8);",
      "bits := pg_catalog.float8send('0'::float8);",
    );
    expect(forcedFallback).not.toBe(original);
    expect(forcedFallback).toContain("m04_payload_is_canonical_json_fallback");
    expect(forcedFallback).toContain("float8send('0'::float8)");
    await pool.query(forcedFallback);

    const samples = [
      canonicalJsonM03({ value: Number.MIN_VALUE }),
      canonicalJsonM03({ value: 2.2250738585072014e-308 }),
      canonicalJsonM03({ value: 0.5 }),
      canonicalJsonM03({ value: 1.0000000000000002 }),
      canonicalJsonM03({ value: Number.MAX_VALUE }),
      canonicalJsonM03({ value: -0.0000010000000000000002 }),
    ];
    const fallback = await pool.query<{ valid: boolean }>(
      `SELECT m04_apply.m04_payload_is_canonical_json_fallback(convert_to(payload,'UTF8')) valid
         FROM unnest($1::text[]) WITH ORDINALITY AS samples(payload, ordinal) ORDER BY ordinal`,
      [samples],
    );
    expect(fallback.rows).toHaveLength(samples.length);
    expect(fallback.rows.every(({ valid }) => valid)).toBe(true);
  }, 120_000);
});
