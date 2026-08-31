import { describe, expect, it } from "vitest";

import {
  ContentFingerprintSchema,
  RepositoryClassificationSchema,
  TimestampSchema,
  canonicalJson,
  parseOpaqueId,
} from "./index.js";

describe("canonical contracts", () => {
  it("serializes objects with stable key ordering", () => {
    expect(canonicalJson({ z: 1, nested: { y: true, a: null }, a: [3, 2, 1] })).toBe(
      '{"a":[3,2,1],"nested":{"a":null,"y":true},"z":1}',
    );
  });

  it("preserves frozen M00 UTF-16 object-key ordering", () => {
    expect(canonicalJson({ "\ue000": 1, "\u{10000}": 2 })).toBe('{"𐀀":2,"":1}');
  });

  it("rejects non-finite canonical JSON numbers", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow("non-finite");
  });

  it("validates versioned primitive formats", () => {
    expect(RepositoryClassificationSchema.parse("SINGLE_SKILL")).toBe("SINGLE_SKILL");
    expect(TimestampSchema.parse("2026-08-03T00:00:00.000Z")).toBe("2026-08-03T00:00:00.000Z");
    expect(ContentFingerprintSchema.parse(`sha256:${"a".repeat(64)}`)).toHaveLength(71);
    expect(parseOpaqueId("res", "res_0001")).toBe("res_0001");
  });

  it("fails closed for invalid enum and ID inputs", () => {
    expect(() => RepositoryClassificationSchema.parse("LIKELY_SKILL")).toThrow();
    expect(() => parseOpaqueId("res", "user_0001")).toThrow("Invalid res opaque ID");
  });
});
