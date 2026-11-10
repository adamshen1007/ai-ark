import { createHash } from "node:crypto";

import {
  canonicalJsonM03,
  type AcceptedBindingReadPortV1,
  type GenerateDraftRequestV1,
} from "@ai-ark/contracts";
import { DraftGenerationServiceV1, InMemoryDraftPersistenceV1 } from "@ai-ark/draft-generation";
import { describe, expect, it } from "vitest";

import { createM05MaximumSnapshotFixture } from "./m05-genuine-snapshot-fixture.js";

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJsonM03(value)).digest("hex");

describe("M05 deterministic maximum fixture", () => {
  it("renders all fourteen sections while retaining the complete 81,920-link provenance", async () => {
    const snapshot = await createM05MaximumSnapshotFixture();
    expect(snapshot.completeness.m05Progression).toBe("ELIGIBLE");
    expect(snapshot.links).toHaveLength(81_920);
    const source: AcceptedBindingReadPortV1 = {
      readAcceptedBinding: () =>
        Promise.resolve({ kind: "FOUND", snapshot: structuredClone(snapshot) }),
    };
    const persistence = new InMemoryDraftPersistenceV1();
    const service = new DraftGenerationServiceV1(
      source,
      persistence,
      undefined,
      undefined,
      () => new Date("2026-01-01T00:00:00.000Z"),
    );
    const request: GenerateDraftRequestV1 = {
      schemaVersion: "M05_GENERATE_DRAFT_REQUEST_V1",
      idempotencyKey: "maximum-key",
      bindingId: snapshot.acceptedResultRecord.bindingId,
      extractionId: snapshot.bundle.extractionId,
      expectedBindingFingerprint: fingerprint(snapshot.bindingPreimage),
      mode: "DETERMINISTIC",
      regenerationToken: "maximum-generation",
      policyVersion: "m05-draft-policy-v1",
      methodologyVersion: "m05-draft-methodology-v1",
      promptBundleVersion: "m05-draft-prompt-v1",
      providerConfigIdOrNull: null,
    };
    const result = await service.generate(Buffer.from(JSON.stringify(request)));
    expect(result.kind).toBe("ACCEPTED");
    if (result.kind !== "ACCEPTED") return;
    const revision = await persistence.readRevision(result.revisionId);
    expect(revision?.sections).toHaveLength(14);
    expect(revision?.state).toBe("UNAPPROVED");
    expect(revision?.label).toBe("AI-generated draft — human review required");
    expect(
      (
        revision?.provenanceIndex as { claimBindings: { evidenceLinkIds: string[] }[] }
      ).claimBindings.reduce((total, binding) => total + binding.evidenceLinkIds.length, 0),
    ).toBe(81_920);
    expect(await service.generate(Buffer.from(JSON.stringify(request)))).toMatchObject({
      kind: "ACCEPTED",
      replayed: true,
      revisionId: result.revisionId,
    });
  }, 240_000);
});
