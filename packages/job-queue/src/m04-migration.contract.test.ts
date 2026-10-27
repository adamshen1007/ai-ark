import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../migrations/003_m04_evidence_binding.sql", import.meta.url),
  "utf8",
);

describe("M04 migration contract", () => {
  it("freezes predecessor migration bytes", () => {
    const hash = (name: string) =>
      createHash("sha256")
        .update(readFileSync(new URL(`../migrations/${name}`, import.meta.url)))
        .digest("hex");
    expect(hash("001_m01_acquisition_jobs.sql")).toBe(
      "4896d8240d81bcdacc8763c0ba4e09cc12ce17983519acb798612d29b4434958",
    );
    expect(hash("002_m02_classification_identity.sql")).toBe(
      "310c6761eb9ac94bcdac03e395a3abbe27a711a6570ffc0839b44b8300563c64",
    );
  });

  it.each([
    "schema_migrations",
    "m03_extraction_bundles",
    "m03_extraction_bundle_chunks",
    "m04_binding_requests",
    "m04_evidence_items",
    "m04_claims",
    "m04_claim_evidence_links",
    "m04_completeness_snapshots",
    "m04_binding_results",
  ])("creates %s", (table) => {
    expect(migration).toMatch(new RegExp(`CREATE TABLE ${table}\\b`, "u"));
  });

  it.each([
    "source_snapshots",
    "acquisition_results",
    "m01_source_entries",
    "m01_source_documents",
    "resource_version_observations",
  ])("protects immutable lineage table %s", (table) => {
    expect(migration).toMatch(new RegExp(`BEFORE UPDATE OR DELETE ON ${table}\\b`, "u"));
  });

  it("closes every request field and its relational columns in PostgreSQL", () => {
    for (const literal of [
      "schemaVersion",
      "idempotencyKey",
      "expectedResourceIdentityId",
      "expectedResourceVersionIdentityId",
      "expectedSourceSnapshotId",
      "expectedSourceRevision",
      "expectedPredecessorState",
      "evidencePolicyVersion",
      "materialFieldRegistryVersion",
      "request_payload_byte_length",
      "request_payload_sha256",
      "request_fingerprint",
    ])
      expect(migration, literal).toContain(literal);
    expect(migration).toContain(
      "'ee8080ee8080','00'),'ee8080ee8081','ee8080') <> request_row.idempotency_key",
    );
    expect(migration).toContain(
      "current_request_payload->'expectedPredecessorState' IS DISTINCT FROM bundle_value->'expectedPredecessorState'",
    );
  });

  it("defines the exact schema-local M03/M04 predecessor fence", () => {
    expect(migration).toContain("CREATE TABLE <S>.m03_m04_predecessor_fence");
    expect(migration).toContain("<S>.m03_m04_lock_predecessor_shared()");
    expect(migration).toContain("<S>.m03_m04_lock_predecessor_exclusive()");
    expect(migration).toContain("<S>.m03_m04_bump_predecessor_epoch()");
    for (const relation of [
      "acquisition_jobs",
      "acquisition_results",
      "candidate_root_ownership",
      "candidate_roots",
      "identity_decisions",
      "m01_source_documents",
      "m01_source_entries",
      "m02_identity_handoff_markers",
      "m02_jobs",
      "m02_review_states",
      "repository_candidate_root_order",
      "resource_candidates",
      "resource_identities",
      "resource_source_links",
      "resource_version_identities",
      "resource_version_observations",
      "source_repository_identities",
      "source_snapshots",
    ])
      expect(migration).toContain(`m03_m04_fence_${relation}_stmt`);
  });

  it("persists redundant V2 projection and input fingerprints", () => {
    expect(migration).toContain("m02_input_projection_fingerprint text NOT NULL");
    expect(migration).toContain("m03_input_fingerprint text NOT NULL");
  });

  it("closes accepted results by canonical bytes, not a lossy jsonb reparse", () => {
    const acceptedResultGuard = migration
      .split("CREATE FUNCTION <S>.m04_validate_accepted_result()", 2)[1]
      ?.split("CREATE CONSTRAINT TRIGGER m04_accepted_result_guard", 1)[0];
    expect(acceptedResultGuard).toBeDefined();
    expect(acceptedResultGuard).toContain(
      "NEW.canonical_payload <> convert_to(<S>.m04_canonical_json(core), 'UTF8')",
    );
    expect(acceptedResultGuard).not.toContain("NEW.canonical_payload, 'UTF8')::jsonb");
  });
});
