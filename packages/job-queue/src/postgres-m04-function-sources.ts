import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED_M04_SQL_HASH = "6da55b9ee12fccad5feb5b9fd31ff30ce972a8b3401f83a62cdb2bdf632939e8";

export const M04_FUNCTION_NAMES = [
  "m03_m04_lock_predecessor_shared",
  "m03_m04_lock_predecessor_exclusive",
  "m03_m04_bump_predecessor_epoch",
  "m04_assert_binding_closure",
  "m04_canonical_json",
  "m04_payload_is_canonical_json",
  "m04_reject_immutable_mutation",
  "m04_validate_accepted_result",
  "m04_validate_bundle_chunks",
  "m04_validate_canonical_record",
  "m04_validate_full_binding_closure",
  "m04_validate_link_lineage",
] as const;

const migrationSql = readFile(
  new URL("../migrations/003_m04_evidence_binding.sql", import.meta.url),
).then((bytes) => {
  if (createHash("sha256").update(bytes).digest("hex") !== EXPECTED_M04_SQL_HASH)
    throw new Error("M04_DATABASE_SCHEMA_INVALID");
  return bytes.toString("utf8");
});

export interface M04TriggerSpec {
  readonly relation: string;
  readonly functionName: string;
  readonly type: number;
  readonly deferrable: boolean;
  readonly initiallyDeferred: boolean;
}

export interface M04FunctionSpec {
  readonly source: string;
  readonly returnType: string;
  readonly volatility: "i" | "s" | "v";
  readonly strict: boolean;
  readonly securityDefiner: boolean;
}

const expectedTriggersPromise = migrationSql.then((sql): ReadonlyMap<string, M04TriggerSpec> => {
  const matches = sql.matchAll(
    /CREATE (CONSTRAINT )?TRIGGER ([a-z][a-z0-9_]*)\s+([^;]*?)\s+ON (?:<S>\.)?([a-z][a-z0-9_]*)\s+([^;]*?)EXECUTE FUNCTION (?:<S>\.)?([a-z][a-z0-9_]*)\(\);/gu,
  );
  const triggers = new Map<string, M04TriggerSpec>();
  for (const match of matches) {
    const [, constraint, name, timing, relation, remainder, functionName] = match;
    if (!name || !timing || !relation || !remainder || !functionName || triggers.has(name))
      throw new Error("M04_DATABASE_SCHEMA_INVALID");
    const before = timing.startsWith("BEFORE");
    const row = remainder.includes("FOR EACH ROW");
    const eventText = `${timing} ${remainder}`;
    const type =
      (row ? 1 : 0) +
      (before ? 2 : 0) +
      (eventText.includes("INSERT") ? 4 : 0) +
      (eventText.includes("DELETE") ? 8 : 0) +
      (eventText.includes("UPDATE") ? 16 : 0) +
      (eventText.includes("TRUNCATE") ? 32 : 0);
    triggers.set(name, {
      relation,
      functionName,
      type,
      deferrable: constraint !== undefined,
      initiallyDeferred: remainder.includes("INITIALLY DEFERRED"),
    });
  }
  if (
    triggers.size !== 47 ||
    [...triggers.keys()].filter((name) => name.startsWith("m03_m04_fence_")).length !== 18
  )
    throw new Error("M04_DATABASE_SCHEMA_INVALID");
  return triggers;
});

export async function expectedM04Triggers(): Promise<ReadonlyMap<string, M04TriggerSpec>> {
  return new Map(await expectedTriggersPromise);
}

const expectedFunctionsBySchema = new Map<string, Promise<ReadonlyMap<string, M04FunctionSpec>>>();

export async function expectedM04Functions(
  schema: string,
): Promise<ReadonlyMap<string, M04FunctionSpec>> {
  if (!/^[a-z][a-z0-9_]{0,62}$/u.test(schema) || schema.startsWith("pg_"))
    throw new Error("M04_DATABASE_SCHEMA_INVALID");
  let expected = expectedFunctionsBySchema.get(schema);
  if (expected === undefined) {
    expected = parseExpectedM04Functions(schema);
    expectedFunctionsBySchema.set(schema, expected);
  }
  return new Map(await expected);
}

async function parseExpectedM04Functions(
  schema: string,
): Promise<ReadonlyMap<string, M04FunctionSpec>> {
  const sql = await migrationSql;
  const functions = new Map<string, M04FunctionSpec>();
  for (const name of M04_FUNCTION_NAMES) {
    const expression = new RegExp(
      `CREATE FUNCTION (?:<S>\\.)?${name}\\([^)]*\\) RETURNS ([a-z][a-z0-9_]*)\\s+([\\s\\S]*?)\\bAS \\$\\$([\\s\\S]*?)\\$\\$;`,
      "u",
    );
    const matches = [...sql.matchAll(new RegExp(expression.source, "gu"))];
    const match = matches[0];
    if (
      matches.length !== 1 ||
      match?.[1] === undefined ||
      match[2] === undefined ||
      match[3] === undefined ||
      !/\bLANGUAGE plpgsql\b/u.test(match[2]) ||
      /\b(?:PARALLEL|LEAKPROOF|COST)\b/u.test(match[2])
    )
      throw new Error("M04_DATABASE_SCHEMA_INVALID");
    functions.set(name, {
      source: match[3].replaceAll("<S>", `"${schema}"`),
      returnType: match[1],
      volatility: /\bIMMUTABLE\b/u.test(match[2]) ? "i" : /\bSTABLE\b/u.test(match[2]) ? "s" : "v",
      strict: /\bSTRICT\b/u.test(match[2]),
      securityDefiner: /\bSECURITY DEFINER\b/u.test(match[2]),
    });
  }
  return functions;
}

export async function expectedM04FunctionSources(
  schema: string,
): Promise<ReadonlyMap<string, string>> {
  const functions = await expectedM04Functions(schema);
  return new Map([...functions].map(([name, spec]) => [name, spec.source]));
}
