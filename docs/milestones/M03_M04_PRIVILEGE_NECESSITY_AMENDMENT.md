# M03/M04 Privilege Necessity Amendment — Proposed

Status: **proposed specification only**. This document has no implementation authority until the product owner approves its exact whole-file SHA-256 and separately authorizes implementation. It does not authorize a commit, push, PR, merge, deployment, release, production migration, publication, or M05 work.

## 1. Authority and defect

This proposed sixth authority is based on exactly these five approved whole-file SHA-256 identities:

1. `docs/milestones/M03_SPEC.md`: `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`.
2. `docs/milestones/M04_SPEC.md`: `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569`.
3. `docs/milestones/M03_M04_HANDOFF_AMENDMENT.md`: `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c`.
4. `docs/milestones/M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`: `e4888a93074d9d0104ac6933571c7d888bf9704a0603f5c962cd2db7fc73cfe8`.
5. `docs/milestones/M03_M04_AUTHORITY_OID_AMENDMENT.md`: `3d41b58f33d111fd1e61a72bcbbc8eb2883a1e5a2cfb5b8196c8b6bb5054a504`.

It supersedes **only** the approved authority amendment's Section 2 manifest-cell set and Section 4 complete-privilege-necessity criterion as expressly stated below. All other approved M03/M04 requirements, including the exact two-role boundary, strict V2 manifest shape, OID/concurrency controls, migration ledger, and evidence-integrity requirements, remain in force.

The current local V2 manifest grants five `UPDATE` cells to `M01_M02_WRITER_GROUP` for which no concrete `PostgresManualResolutionAdapter.execute`, `PostgresSystemIdentityAdapter.execute`, or rejection-audit mutation path has been identified. The closed human and system mutation plans create or read these rows, but do not update them. A grant without a necessary named path violates the complete-privilege-necessity criterion; a successful direct SQL update is not a justification.

## 2. Exact correction

Remove **only** `UPDATE` from the writer group's manifest operations for:

1. `external_identifiers`
2. `resource_identities`
3. `resource_version_identities`
4. `resource_version_observations`
5. `source_repository_identities`

Retain every other cell, including each listed table's `SELECT` and any existing `INSERT`; retain the single rejection-audit sequence `USAGE` cell. The `M04_RUNTIME_GROUP` is unchanged. No new grant, group, role membership, schema privilege, object ownership, or broader privilege is authorized. Migration `003` must generate and enforce exactly the corrected canonical V2 manifest. Recompute and record exact SQL hash, canonical manifest hash, and the approved V2 composite ledger identity. Keep migrations `001` and `002` byte-for-byte unchanged.

This is a correction to an **unapplied local** `003` candidate only. Before implementation, verify `003` has not been applied to any shared or production database. Disposable test databases may be recreated. If a non-disposable `003` exists, stop and obtain a separate forward-migration specification and authorization; do not rewrite an applied ledger or production privileges.

## 3. Required proof

For all remaining manifest relation-operation, function-execution, and sequence cells, identify the concrete adapter method and SQL path, run an actual-LOGIN positive path, then revoke that individual cell in an isolated transaction/test and show fail-closed behavior with no committed domain effect. For indirect constraint/trigger functions, identify the invoking adapter path and assert the actual underlying SQLSTATE or a narrowly specified fail-closed translation. Restore the test grant after each isolated test. Do not weaken the exact-grant validator to make a path pass.

For each removed `UPDATE` cell, prove absence from all admissible human-command and system-projector mutation plans and direct adapter SQL; assert the manifest and actual LOGIN lack that effective right after fresh migration, no-op validation, prefix resume, and dump/restore. Prove previously permitted `SELECT` and `INSERT` paths still work where applicable. Preserve hostile `PUBLIC`, cross-role, direct/inherited/settable-role, owner-path, excess-right, OID, concurrency, recovery, fixture, adversarial, and regression checks.

The M02 and M04 integration tests must remain bounded under the repository's fixed per-test limit without removing golden modes, assertions, negative cases, or cleanup checks. The completion report must diagnose the prior fixed-limit timeout with measured evidence, not attribute it to product success. After implementation stabilizes, freeze one exact candidate; run every required M04 and M00–M03 gate and `pnpm verify` on unchanged bytes; review the whole diff and privacy/secrets boundary; then obtain a fresh independent read-only R2 whole-patch verdict on that same candidate. Any later byte change invalidates the gate/review identity.

## 4. Approval boundary

Before approval, verify that all five source files still match the exact hashes in Section 1, Markdown/link integrity, this document's exact whole-file SHA-256, and a read-only independent specification review. A favorable review is not human approval. Implementation may begin only after the product owner approves this exact final hash and separately authorizes the narrowly scoped change. Until then, the five grants stay frozen and the M04 candidate is **NO-GO**.
