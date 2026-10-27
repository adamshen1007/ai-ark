import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED_M02_SQL_HASH = "310c6761eb9ac94bcdac03e395a3abbe27a711a6570ffc0839b44b8300563c64";

export interface M02FunctionSpec {
  readonly name: string;
  readonly arguments: string;
  readonly returnType: string;
  readonly language: "sql" | "plpgsql";
  readonly volatility: "i" | "s" | "v";
  readonly strict: boolean;
  readonly source: string;
}

export interface M02TriggerSpec {
  readonly name: string;
  readonly relation: string;
  readonly functionName: string;
  readonly type: number;
  readonly deferrable: boolean;
  readonly initiallyDeferred: boolean;
  readonly when: string | null;
}

const migrationSql = readFile(
  new URL("../migrations/002_m02_classification_identity.sql", import.meta.url),
).then((bytes) => {
  if (createHash("sha256").update(bytes).digest("hex") !== EXPECTED_M02_SQL_HASH)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  return bytes.toString("utf8");
});

export async function expectedM02Functions(): Promise<ReadonlyMap<string, M02FunctionSpec>> {
  const sql = await migrationSql;
  const declarations = [...sql.matchAll(/^CREATE FUNCTION /gmu)];
  const expressions = sql.matchAll(
    /^CREATE FUNCTION ([a-z][a-z0-9_]*)\(([^)]*)\)\s+RETURNS\s+([a-z][a-z0-9_]*(?:\[\])?)([\s\S]*?)\bAS \$\$([\s\S]*?)\$\$;/gmu,
  );
  const functions = new Map<string, M02FunctionSpec>();
  for (const expression of expressions) {
    const [, name, rawArguments, returnType, attributes, source] = expression;
    const language = attributes?.match(/\bLANGUAGE (sql|plpgsql)\b/u)?.[1];
    if (
      !name ||
      rawArguments === undefined ||
      !returnType ||
      !attributes ||
      source === undefined ||
      (language !== "sql" && language !== "plpgsql") ||
      functions.has(name) ||
      /\bSECURITY DEFINER\b|\bSET [a-z_]+\b/u.test(attributes)
    )
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    functions.set(name, {
      name,
      arguments: rawArguments.replace(/\s+/gu, " ").replace(/,\s*/gu, ", ").trim(),
      returnType,
      language,
      volatility: /\bIMMUTABLE\b/u.test(attributes)
        ? "i"
        : /\bSTABLE\b/u.test(attributes)
          ? "s"
          : "v",
      strict: /\bSTRICT\b/u.test(attributes),
      source,
    });
  }
  if (declarations.length !== 66 || functions.size !== declarations.length)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  return functions;
}

export async function expectedM02Triggers(): Promise<ReadonlyMap<string, M02TriggerSpec>> {
  const sql = await migrationSql;
  const declarations = [...sql.matchAll(/^CREATE (?:CONSTRAINT )?TRIGGER /gmu)];
  const expressions = sql.matchAll(
    /^CREATE (CONSTRAINT )?TRIGGER ([a-z][a-z0-9_]*)\s+(BEFORE|AFTER) (INSERT|UPDATE|DELETE)(?: OR (INSERT|UPDATE|DELETE))?(?: OR (INSERT|UPDATE|DELETE))? ON ([a-z][a-z0-9_]*)\s+(DEFERRABLE INITIALLY DEFERRED\s+)?FOR EACH ROW(?: WHEN \(([^\n]*)\))? EXECUTE FUNCTION ([a-z][a-z0-9_]*)\(\);/gmu,
  );
  const triggers = new Map<string, M02TriggerSpec>();
  for (const expression of expressions) {
    const [
      ,
      constraint,
      name,
      timing,
      eventA,
      eventB,
      eventC,
      relation,
      deferred,
      when,
      functionName,
    ] = expression;
    if (!name || !timing || !eventA || !relation || !functionName)
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    const events = [eventA, eventB, eventC].filter((event): event is string => !!event);
    const bits = { INSERT: 4, DELETE: 8, UPDATE: 16 } as const;
    const type =
      1 +
      (timing === "BEFORE" ? 2 : 0) +
      events.reduce((sum, event) => sum + bits[event as keyof typeof bits], 0);
    const key = `${relation}.${name}`;
    if (triggers.has(key) || (constraint === undefined && deferred !== undefined))
      throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
    triggers.set(key, {
      name,
      relation,
      functionName,
      type,
      deferrable: deferred !== undefined,
      initiallyDeferred: deferred !== undefined,
      when: when ?? null,
    });
  }
  if (declarations.length !== 102 || triggers.size !== declarations.length)
    throw new Error("M04_DATABASE_ROLE_AUTHORITY_DRIFT");
  return triggers;
}
