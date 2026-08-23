import { createHash } from "node:crypto";

import { canonicalJson, type JsonValue } from "@ai-ark/contracts";

export interface ExecutedFixtureEvidence {
  readonly records: readonly string[];
  readonly decision: string;
  readonly auditStates: readonly string[];
}

type ReceiptMatrix = Readonly<Record<string, readonly string[]>>;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonValue(nested)]),
    );
  throw new TypeError(`EXECUTED_RECEIPT_NOT_JSON:${typeof value}`);
}

export class ExecutedReceiptCollector {
  readonly #required: ReceiptMatrix;
  readonly #receipts = new Map<string, Map<string, string>>();

  public constructor(required: ReceiptMatrix) {
    this.#required = Object.freeze(
      Object.fromEntries(
        Object.entries(required).map(([scenario, predicates]) => [
          scenario,
          Object.freeze([...predicates]),
        ]),
      ),
    );
  }

  public record(scenario: string, predicate: string, value: unknown): void {
    const required = this.#required[scenario];
    if (required === undefined) throw new Error(`EXECUTED_RECEIPT_SCENARIO_UNKNOWN:${scenario}`);
    if (!required.includes(predicate))
      throw new Error(`EXECUTED_RECEIPT_PREDICATE_UNKNOWN:${scenario}:${predicate}`);
    const scenarioReceipts = this.#receipts.get(scenario) ?? new Map<string, string>();
    if (scenarioReceipts.has(predicate))
      throw new Error(`EXECUTED_RECEIPT_DUPLICATE:${scenario}:${predicate}`);
    scenarioReceipts.set(predicate, canonicalJson(toJsonValue(value)));
    this.#receipts.set(scenario, scenarioReceipts);
  }

  public finalize(scenario: string): ExecutedFixtureEvidence {
    const required = this.#required[scenario];
    if (required === undefined) throw new Error(`EXECUTED_RECEIPT_SCENARIO_UNKNOWN:${scenario}`);
    const receipts = this.#receipts.get(scenario) ?? new Map<string, string>();
    const missing = required.filter((predicate) => !receipts.has(predicate));
    if (missing.length > 0)
      throw new Error(`EXECUTED_RECEIPTS_MISSING:${scenario}:${missing.join(",")}`);
    const ordered = required.map((predicate) => {
      const canonicalValue = receipts.get(predicate);
      if (canonicalValue === undefined)
        throw new Error(`EXECUTED_RECEIPTS_MISSING:${scenario}:${predicate}`);
      return { predicate, canonicalValue };
    });
    const records = ordered.map(
      ({ predicate, canonicalValue }) =>
        `receipt:${predicate}:sha256=${digest(canonicalValue)}:bytes=${String(Buffer.byteLength(canonicalValue))}`,
    );
    const groups = [
      ...new Set(ordered.map(({ predicate }) => predicate.split(".")[0] ?? predicate)),
    ]
      .sort()
      .map((group) => {
        const groupReceipts = ordered.filter(({ predicate }) => predicate.startsWith(`${group}.`));
        return `receipt-group:${group}:count=${String(groupReceipts.length)}:sha256=${digest(canonicalJson(groupReceipts))}`;
      });
    return {
      records,
      decision: `EXECUTED_RECEIPTS:${scenario}:count=${String(ordered.length)}:sha256=${digest(canonicalJson(ordered))}`,
      auditStates: groups,
    };
  }
}
