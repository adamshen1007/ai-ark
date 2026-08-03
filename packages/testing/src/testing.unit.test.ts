import { describe, expect, it } from "vitest";
import {
  AuditCapture,
  DeterministicIdGenerator,
  FakeAnalysisProvider,
  FakeClock,
  ObjectStorageTestAdapter,
  StructuredLogCapture,
} from "./index.js";

describe("deterministic test foundation", () => {
  it("controls time and IDs", () => {
    const clock = new FakeClock();
    const ids = new DeterministicIdGenerator();
    clock.advance(1_000);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:01.000Z");
    expect(ids.next("res")).toBe("res_00000001");
    expect(ids.next("res")).toBe("res_00000002");
  });

  it("validates fake AI output through the caller contract", async () => {
    const provider = new FakeAnalysisProvider();
    provider.enqueue("CLASSIFY_REPOSITORY", { classification: "SINGLE_SKILL" });
    const output = await provider.analyze<{ classification: "SINGLE_SKILL" }>({
      operation: "CLASSIFY_REPOSITORY",
      input: {},
      outputContract: {
        parse(value) {
          if (
            typeof value !== "object" ||
            value === null ||
            !("classification" in value) ||
            value.classification !== "SINGLE_SKILL"
          ) {
            throw new Error("invalid fake output");
          }
          return { classification: value.classification };
        },
      },
      promptBundleVersion: "test-v1",
    });
    expect(output.classification).toBe("SINGLE_SKILL");
  });

  it("copies stored bytes and captures logs and audit events", async () => {
    const storage = new ObjectStorageTestAdapter();
    const logs = new StructuredLogCapture();
    const audit = new AuditCapture();
    await storage.put({
      key: "sha256/test",
      bytes: new Uint8Array([1]),
      contentType: "text/plain",
    });
    const retrieved = await storage.get("sha256/test");
    retrieved?.bytes.fill(9);
    logs.write({ level: "info", event: "test.completed", fields: { ok: true } });
    audit.append({
      type: "SOURCE_SUBMITTED",
      subjectId: "submission_1",
      occurredAt: "2026-01-01T00:00:00.000Z" as never,
      metadata: {},
    });
    expect((await storage.get("sha256/test"))?.bytes[0]).toBe(1);
    expect(logs.entries).toHaveLength(1);
    expect(audit.events).toHaveLength(1);
  });
});
