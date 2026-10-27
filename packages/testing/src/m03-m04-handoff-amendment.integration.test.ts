import {
  EvidenceBindingRequestV1Schema,
  M03M02InputProjectionV1Schema,
  StructuredExtractionBundleV1Schema,
  StructuredExtractionBundleV2Schema,
  canonicalJsonM03,
  fingerprintM03M02InputProjectionV1,
} from "@ai-ark/contracts";
import { EvidenceBindingServiceV1, recomputeM03OutputFingerprint } from "@ai-ark/evidence";
import { describe, expect, it } from "vitest";

import { createGenuineM03BundleFixture } from "./m03-genuine-bundle-fixture.js";

describe("M03/M04 complete handoff amendment", () => {
  it("emits a closed V2 bundle binding the exact strict M02 projection", async () => {
    const bundle = await createGenuineM03BundleFixture();
    expect(StructuredExtractionBundleV2Schema.safeParse(bundle).success).toBe(true);
    expect(M03M02InputProjectionV1Schema.safeParse(bundle.m02InputProjection).success).toBe(true);
    expect(bundle.m02InputProjectionFingerprint).toBe(
      fingerprintM03M02InputProjectionV1(bundle.m02InputProjection),
    );
    expect(bundle.outputFingerprint).toBe(recomputeM03OutputFingerprint(bundle));
    expect(canonicalJsonM03(bundle.m02InputProjection)).not.toContain("Technical reviewers");
  });

  it("rejects unpaired surrogates in retained telemetry and M02 input before persistence", async () => {
    const genuine = await createGenuineM03BundleFixture();
    expect(
      M03M02InputProjectionV1Schema.safeParse({
        ...genuine.m02InputProjection,
        handoff: { ...genuine.m02InputProjection.handoff, id: "\ud800" },
      }).success,
    ).toBe(false);
    const firstAttempt = genuine.analysisAttempts[0];
    if (firstAttempt === undefined) throw new Error("M03_ANALYSIS_ATTEMPT_REQUIRED");
    const invalid = {
      ...genuine,
      analysisAttempts: [
        { ...firstAttempt, providerRequestIdOrNull: "\ud800" },
        ...genuine.analysisAttempts.slice(1),
      ],
    };
    expect(StructuredExtractionBundleV2Schema.safeParse(invalid).success).toBe(false);
    let writes = 0;
    const service = new EvidenceBindingServiceV1({
      persistAccepted: () => {
        writes += 1;
        return Promise.reject(new Error("unexpected persistence"));
      },
    });
    const request = EvidenceBindingRequestV1Schema.parse({
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "scalar-rejection-key",
      extractionId: genuine.extractionId,
      expectedM03OutputFingerprint: genuine.outputFingerprint,
      expectedResourceIdentityId: genuine.m02.resourceIdentityId,
      expectedResourceVersionIdentityId: genuine.m02.resourceVersionIdentityId,
      expectedSourceSnapshotId: genuine.m02.sourceSnapshotId,
      expectedSourceRevision: genuine.m02.sourceRevision,
      expectedPredecessorState: genuine.expectedPredecessorState,
      evidencePolicyVersion: "m04-evidence-policy-v1",
      materialFieldRegistryVersion: "m04-material-fields-v1",
    });
    await expect(
      service.bindEvidence(Buffer.from(canonicalJsonM03(request)), invalid),
    ).resolves.toMatchObject({ kind: "REJECTED", error: "M03_BUNDLE_SCHEMA_INVALID" });
    expect(writes).toBe(0);
  });

  it("rejects historical schema-valid V1 at M04 without persistence", async () => {
    const v2 = await createGenuineM03BundleFixture();
    const {
      m02InputProjection: _projection,
      m02InputProjectionFingerprint: _projectionFingerprint,
      ...withoutProjection
    } = v2;
    void _projection;
    void _projectionFingerprint;
    const historical = StructuredExtractionBundleV1Schema.parse({
      ...withoutProjection,
      schemaVersion: "M03_EXTRACTION_V1",
    });
    let writes = 0;
    const service = new EvidenceBindingServiceV1({
      persistAccepted: () => {
        writes += 1;
        return Promise.reject(new Error("unexpected persistence"));
      },
    });
    const request = EvidenceBindingRequestV1Schema.parse({
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "v1-rejection-key",
      extractionId: historical.extractionId,
      expectedM03OutputFingerprint: historical.outputFingerprint,
      expectedResourceIdentityId: historical.m02.resourceIdentityId,
      expectedResourceVersionIdentityId: historical.m02.resourceVersionIdentityId,
      expectedSourceSnapshotId: historical.m02.sourceSnapshotId,
      expectedSourceRevision: historical.m02.sourceRevision,
      expectedPredecessorState: historical.expectedPredecessorState,
      evidencePolicyVersion: "m04-evidence-policy-v1",
      materialFieldRegistryVersion: "m04-material-fields-v1",
    });
    await expect(
      service.bindEvidence(Buffer.from(canonicalJsonM03(request)), historical),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "M03_BUNDLE_SCHEMA_INVALID",
      diagnostics: [{ code: "SCHEMA_INVALID", stage: "BUNDLE", subjectKind: "EXTRACTION" }],
    });
    expect(writes).toBe(0);
  });

  it("rejects a forged V2 extraction identity even when its output fingerprint is recomputed", async () => {
    const genuine = await createGenuineM03BundleFixture();
    const forged = {
      ...genuine,
      extractionId: `ext_${"f".repeat(64)}`,
      outputFingerprint: "0".repeat(64),
    };
    forged.outputFingerprint = recomputeM03OutputFingerprint(forged);
    expect(StructuredExtractionBundleV2Schema.safeParse(forged).success).toBe(false);

    let writes = 0;
    const service = new EvidenceBindingServiceV1({
      persistAccepted: () => {
        writes += 1;
        return Promise.reject(new Error("unexpected persistence"));
      },
    });
    const request = EvidenceBindingRequestV1Schema.parse({
      schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1",
      idempotencyKey: "forged-extraction-id",
      extractionId: forged.extractionId,
      expectedM03OutputFingerprint: forged.outputFingerprint,
      expectedResourceIdentityId: forged.m02.resourceIdentityId,
      expectedResourceVersionIdentityId: forged.m02.resourceVersionIdentityId,
      expectedSourceSnapshotId: forged.m02.sourceSnapshotId,
      expectedSourceRevision: forged.m02.sourceRevision,
      expectedPredecessorState: forged.expectedPredecessorState,
      evidencePolicyVersion: "m04-evidence-policy-v1",
      materialFieldRegistryVersion: "m04-material-fields-v1",
    });
    await expect(
      service.bindEvidence(Buffer.from(canonicalJsonM03(request)), forged),
    ).resolves.toMatchObject({
      kind: "REJECTED",
      error: "M03_BUNDLE_SCHEMA_INVALID",
    });
    expect(writes).toBe(0);
  });
});
