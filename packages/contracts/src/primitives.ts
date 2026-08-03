import { z } from "zod";

declare const opaqueIdBrand: unique symbol;
export type OpaqueId<Kind extends string = string> = string & {
  readonly [opaqueIdBrand]: Kind;
};

const opaqueIdPattern = /^[a-z][a-z0-9_]*_[A-Za-z0-9_-]+$/;

export function parseOpaqueId<Kind extends string>(kind: Kind, value: string): OpaqueId<Kind> {
  if (!opaqueIdPattern.test(value) || !value.startsWith(`${kind}_`)) {
    throw new Error(`Invalid ${kind} opaque ID`);
  }
  return value as OpaqueId<Kind>;
}

declare const timestampBrand: unique symbol;
export type Timestamp = string & { readonly [timestampBrand]: "Timestamp" };
export const TimestampSchema = z.iso
  .datetime({ offset: false, precision: 3 })
  .transform((value) => value as Timestamp);

export function timestampFromDate(date: Date): Timestamp {
  return TimestampSchema.parse(date.toISOString());
}

declare const fingerprintBrand: unique symbol;
export type ContentFingerprint = string & {
  readonly [fingerprintBrand]: "ContentFingerprint";
};
export const ContentFingerprintSchema = z
  .string()
  .regex(/^sha256:[a-f0-9]{64}$/)
  .transform((value) => value as ContentFingerprint);

export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function serialize(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new TypeError("Canonical JSON rejects non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(",")}]`;
  }
  const record = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key] as JsonValue)}`)
    .join(",")}}`;
}

export function canonicalJson(value: JsonValue): string {
  return serialize(value);
}
