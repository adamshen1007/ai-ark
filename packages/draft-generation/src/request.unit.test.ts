import { describe, expect, it } from "vitest";

import { hasDuplicateObjectKeys, parseGenerateDraftRequestV1 } from "./index.js";

const valid = {
  schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
  idempotencyKey: "key-1",
  bindingId: `bnd_${"a".repeat(64)}`,
  extractionId: `ext_${"b".repeat(64)}`,
  expectedBindingFingerprint: "a".repeat(64),
  mode: "DETERMINISTIC",
  regenerationToken: "generation-1",
  policyVersion: "m05-draft-policy-v1",
  methodologyVersion: "m05-draft-methodology-v1",
  promptBundleVersion: "m05-draft-prompt-v1",
  providerConfigIdOrNull: null,
} as const;

describe("M05 strict raw request parser", () => {
  it("accepts canonical semantic input", () => {
    expect(parseGenerateDraftRequestV1(Buffer.from(JSON.stringify(valid)))).toEqual(valid);
  });

  it("rejects duplicate keys at any object depth", () => {
    expect(hasDuplicateObjectKeys('{"outer":{"x":1,"x":2}}')).toBe(true);
    const result = parseGenerateDraftRequestV1(
      Buffer.from(
        '{"schemaVersion":"M05_GENERATE_DRAFT_REQUEST_V1","schemaVersion":"M05_GENERATE_DRAFT_REQUEST_V1"}',
      ),
    );
    expect(result).toMatchObject({ kind: "MALFORMED", code: "REQUEST_JSON_INVALID" });
  });

  it("rejects invalid UTF-8, lone surrogates, exponent numbers, and unknown keys", () => {
    expect(parseGenerateDraftRequestV1(Uint8Array.from([0xff]))).toMatchObject({
      kind: "MALFORMED",
      code: "REQUEST_JSON_INVALID",
    });
    expect(
      parseGenerateDraftRequestV1(
        Buffer.from(JSON.stringify({ ...valid, idempotencyKey: "\ud800" })),
      ),
    ).toMatchObject({ kind: "MALFORMED", code: "REQUEST_SCHEMA_INVALID" });
    expect(
      parseGenerateDraftRequestV1(Buffer.from(JSON.stringify({ ...valid, exponent: 1e3 }))),
    ).toMatchObject({ kind: "MALFORMED", code: "REQUEST_SCHEMA_INVALID" });
    expect(
      parseGenerateDraftRequestV1(Buffer.from(JSON.stringify({ ...valid, unknown: true }))),
    ).toMatchObject({ kind: "MALFORMED", code: "REQUEST_SCHEMA_INVALID" });
  });

  it("enforces the raw byte ceiling", () => {
    const canonical = JSON.stringify(valid);
    const exact = Buffer.from(`${canonical}${" ".repeat(16_384 - Buffer.byteLength(canonical))}`);
    expect(exact).toHaveLength(16_384);
    expect(parseGenerateDraftRequestV1(exact)).toEqual(valid);
    expect(parseGenerateDraftRequestV1(Buffer.alloc(16_385, 0x20))).toMatchObject({
      kind: "MALFORMED",
      code: "REQUEST_TOO_LARGE",
    });
  });

  it("preserves the inherited U+0000 scalar domain", () => {
    expect(
      parseGenerateDraftRequestV1(
        Buffer.from(JSON.stringify({ ...valid, idempotencyKey: "key\u0000value" })),
      ),
    ).toMatchObject({ idempotencyKey: "key\u0000value" });
  });
});
