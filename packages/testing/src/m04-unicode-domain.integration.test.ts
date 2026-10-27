import {
  StructuredExtractionBundleV2Schema,
  canonicalJsonM03,
  type EvidenceBindingRequestV1,
} from "@ai-ark/contracts";
import { EvidenceBindingServiceV1 } from "@ai-ark/evidence";
import { describe, expect, it, vi } from "vitest";

import { createGenuineM03BundleFixture } from "./m03-genuine-bundle-fixture.js";

describe("M04 authoritative Unicode scalar domain", () => {
  it("rejects lone surrogates before persistence while allowing paired scalars and NUL keys", async () => {
    const bundle = await createGenuineM03BundleFixture();
    const request: EvidenceBindingRequestV1 = {
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "valid-\u0000-😀",
      extractionId: bundle.extractionId,
      expectedM03OutputFingerprint: bundle.outputFingerprint,
      expectedResourceIdentityId: bundle.m02.resourceIdentityId,
      expectedResourceVersionIdentityId: bundle.m02.resourceVersionIdentityId,
      expectedSourceSnapshotId: bundle.m02.sourceSnapshotId,
      expectedSourceRevision: bundle.m02.sourceRevision,
      expectedPredecessorState: bundle.expectedPredecessorState,
      evidencePolicyVersion: "m04-evidence-policy-v1",
      materialFieldRegistryVersion: "m04-material-fields-v1",
    };
    const persistAccepted = vi.fn(() => Promise.reject(new Error("M04_TEST_PERSISTENCE_REACHED")));
    const service = new EvidenceBindingServiceV1({ persistAccepted });
    const bytes = (value: unknown) => Buffer.from(canonicalJsonM03(value), "utf8");
    await expect(service.bindEvidence(bytes(request), bundle)).rejects.toThrow(
      "M04_TEST_PERSISTENCE_REACHED",
    );
    expect(persistAccepted).toHaveBeenCalledTimes(1);
    persistAccepted.mockClear();
    for (const invalid of ["\ud800", "\udc00", "x\ud800y"]) {
      const malformedBundle = structuredClone(bundle);
      malformedBundle.m02.resourceIdentityId = invalid;
      expect(StructuredExtractionBundleV2Schema.safeParse(malformedBundle).success).toBe(false);
      expect((await service.bindEvidence(bytes(request), malformedBundle)).kind).not.toBe(
        "ACCEPTED",
      );
      for (const field of [
        "idempotencyKey",
        "expectedResourceIdentityId",
        "expectedResourceVersionIdentityId",
        "expectedSourceSnapshotId",
      ] as const) {
        expect(
          (await service.bindEvidence(bytes({ ...request, [field]: invalid }), bundle)).kind,
        ).not.toBe("ACCEPTED");
      }
    }
    expect(persistAccepted).not.toHaveBeenCalled();
  });
});
