import { createHash } from "node:crypto";

import { canonicalJsonM03, type AcceptedBindingSnapshotV1 } from "@ai-ark/contracts";
import { m03LogicalProjection, projectEvidenceBinding } from "@ai-ark/evidence";

import { createGenuineM03BundleFixture } from "./m03-genuine-bundle-fixture.js";
import {
  createM04CombinedMaximumBundleFixture,
  createM04CompleteBundleFixture,
} from "./m04-combined-maximum-fixture.js";

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJsonM03(value)).digest("hex");

export function createM05SnapshotFromBundleFixture(
  bundle: Awaited<ReturnType<typeof createGenuineM03BundleFixture>>,
): Promise<AcceptedBindingSnapshotV1> {
  const projected = projectEvidenceBinding(bundle);
  const semanticRequest = {
    schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1" as const,
    extractionId: bundle.extractionId,
    expectedM03OutputFingerprint: bundle.outputFingerprint,
    expectedResourceIdentityId: bundle.m02.resourceIdentityId,
    expectedResourceVersionIdentityId: bundle.m02.resourceVersionIdentityId,
    expectedSourceSnapshotId: bundle.m02.sourceSnapshotId,
    expectedSourceRevision: bundle.m02.sourceRevision,
    expectedPredecessorState: bundle.expectedPredecessorState,
    evidencePolicyVersion: "m04-evidence-policy-v1" as const,
    materialFieldRegistryVersion: "m04-material-fields-v1" as const,
  };
  const bindingPreimage = {
    schemaVersion: "M04_BINDING_ID_V1" as const,
    extractionId: bundle.extractionId,
    logicalPayloadSha256: fingerprint(m03LogicalProjection(bundle)),
    evidencePolicyVersion: semanticRequest.evidencePolicyVersion,
    materialFieldRegistryVersion: semanticRequest.materialFieldRegistryVersion,
    evidenceItemIds: projected.evidenceItems
      .map(({ id }) => id)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
    claimIds: projected.claims.map(({ id }) => id),
    linkIds: projected.links.map(({ id }) => id),
    completenessId: projected.completeness.id,
  };
  const bindingId = `bnd_${fingerprint(bindingPreimage)}`;
  const core = {
    kind: "ACCEPTED" as const,
    bindingId,
    extractionId: bundle.extractionId,
    completenessId: projected.completeness.id,
  };
  return Promise.resolve({
    schemaVersion: "M05_ACCEPTED_BINDING_SNAPSHOT_V1",
    bindingPreimage,
    acceptedResultRecord: {
      schemaVersion: "M04_RESULT_V1",
      resultId: `m4r_${fingerprint(core)}`,
      ...core,
    },
    bundle,
    semanticRequest,
    evidenceItems: [...projected.evidenceItems].sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    ),
    claims: [...projected.claims],
    links: [...projected.links],
    completeness: projected.completeness,
  });
}

export async function createM05GenuineSnapshotFixture(): Promise<AcceptedBindingSnapshotV1> {
  return createM05SnapshotFromBundleFixture(await createGenuineM03BundleFixture());
}

export async function createM05EligibleSnapshotFixture(): Promise<AcceptedBindingSnapshotV1> {
  return createM05SnapshotFromBundleFixture(await createM04CompleteBundleFixture(7));
}

export async function createM05MaximumSnapshotFixture(): Promise<AcceptedBindingSnapshotV1> {
  return createM05SnapshotFromBundleFixture(await createM04CombinedMaximumBundleFixture());
}
