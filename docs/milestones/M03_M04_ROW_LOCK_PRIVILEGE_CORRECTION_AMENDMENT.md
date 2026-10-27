# M03/M04 Row-Lock Privilege Correction Amendment — Candidate

Status: **proposed specification only**. Preparation and independent read-only review are authorized. This document does not authorize implementation, migration changes or execution, staging, commit, push, PR, merge, deployment, release, publication, or M05+ work. The local M04 candidate remains **NO-GO**.

## 1. Exact authority and discovered conflict

This proposed seventh authority depends on these six approved, byte-frozen documents (whole-file SHA-256):

1. `docs/milestones/M03_SPEC.md`: `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`.
2. `docs/milestones/M04_SPEC.md`: `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569`.
3. `docs/milestones/M03_M04_HANDOFF_AMENDMENT.md`: `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c`.
4. `docs/milestones/M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`: `e4888a93074d9d0104ac6933571c7d888bf9704a0603f5c962cd2db7fc73cfe8`.
5. `docs/milestones/M03_M04_AUTHORITY_OID_AMENDMENT.md`: `3d41b58f33d111fd1e61a72bcbbc8eb2883a1e5a2cfb5b8196c8b6bb5054a504`.
6. `docs/milestones/M03_M04_PRIVILEGE_NECESSITY_AMENDMENT.md`: `0e9108751bd91cfb5b7d7c3b335a34ec667185658ceed6faefa688510049fd97`.

The sixth amendment inferred that five writer `UPDATE` grants lacked an adapter path because the closed mutation plans do not issue row-changing `UPDATE` statements on those tables. That inference omitted row-locking reads. `PostgresSystemIdentityAdapter.lockFrozenRequirements` executes `SELECT id FROM ${table} WHERE id=$1 FOR UPDATE` for frozen expected-version rows, including all five tables. `lockTypedRows` also uses `SELECT ... FOR UPDATE` for applicable typed rows. [PostgreSQL 17's `SELECT` privilege rules](https://www.postgresql.org/docs/17/sql-select.html) require `UPDATE` privilege as well as `SELECT` for this locking clause. A diagnostic removal caused `42501` failures in 43 of 104 M02 system-identity tests; the local manifest was restored. This is a specification conflict, not a passing remediation.

## 2. Narrow supersession and unchanged boundary

If approved, this document supersedes **only** the sixth amendment's Section 1 claim that the five cells have no concrete adapter path, Section 2's instruction to remove those five cells and recompute the migration identity, and Section 3's removed-cell absence proofs. The five `M01_M02_WRITER_GROUP` relation `UPDATE` cells shall **remain** in the canonical V2 manifest for:

1. `external_identifiers`;
2. `resource_identities`;
3. `resource_version_identities`;
4. `resource_version_observations`;
5. `source_repository_identities`.

Their necessity is the existing row-locking path, **not** a claim that the adapter mutates those rows. Retain the complete 180-cell manifest (142 writer, 38 M04 runtime), existing `003` SQL, and V2 composite ledger identity without a grant or schema expansion. The current local identities are SQL SHA-256 `9c53039956df0bfe53bb259d49b0ab2e8d5d679886723224f19c5cbd535ed362`, manifest SHA-256 `09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991`, and V2 composite `8d6b699952cf3d5ebde5a474e24928cd02d9c20abc385848116153ee5fe44336`. These are candidate fingerprints to revalidate, not authorization to apply a migration. Migrations `001` and `002` remain byte-frozen. If any fingerprint differs at implementation time, stop and diagnose; do not silently rebase this authority.

Every other requirement of the six approved documents remains in force, including strict manifest and exact-grant validation, actual-LOGIN and hostile-role confinement, transaction fencing, OID/concurrency checks, evidence integrity, privacy, fixed test limits, recovery, and unchanged-candidate full gates. The sixth amendment's necessity and path-specific revocation criteria continue to apply to **all 180 cells**. A separate cell proven unnecessary must follow the approved removal process; this correction does not grandfather it.

Retaining table-level `UPDATE` is a material residual privilege: a compromised writer LOGIN could attempt direct row-changing SQL even though the authorized adapters use these five cells for locking only. This amendment neither claims that such SQL is impossible nor broadens the application's accepted command set. Column-level grants or lock redesign might reduce that exposure but would change the strict manifest/transaction contract and require a separate specification, review, and approval. The independent reviewer must assess whether this disclosed residual is acceptable within the approved actual-LOGIN trust boundary.

## 3. Required implementation proof after separate authorization

For **each** of the five cells, record a named reachable `PostgresSystemIdentityAdapter.execute` mode and frozen expected-version row that reaches `lockFrozenRequirements` (or a named human-command mode that reaches `lockTypedRows`), with the exact adapter method and locking SQL. Under the actual writer LOGIN, prove the positive adapter path succeeds with the canonical grant. In a disposable database and isolated test, revoke **only that table's writer-group `UPDATE`**, keep its `SELECT` and every other cell intact, execute the **same** named adapter path, and assert the expected SQLSTATE `42501` or narrowly specified fail-closed translation plus zero committed domain, audit, and result side effects. Restore the grant for fixture cleanup and prove the positive path again. A generic direct SQL privilege probe, an unreachable mode, or a test that fails before the row lock does not prove necessity.

Map and test every other manifest relation-operation, function-execution, and sequence cell against its named adapter path under the approved sixth-amendment criterion. Preserve the hostile `PUBLIC`, third-role, direct/inherited/settable-role, owner-path, excess-right, OID, concurrency, migration, recovery, fixture, adversarial, and M00–M03 regression matrix. No grant may be retained merely because its ACL probe succeeds. Diagnose any fixed-limit persistence timeout with measured evidence; do not raise limits, remove cases, or report a partial suite as a pass.

Before any work on `003`, verify it remains unapplied outside disposable local test databases. If shared or production `003` exists, stop for a separately approved forward-migration design; do not rewrite an applied ledger or privileges. No production migration is authorized by this document.

After a separately authorized implementation stabilizes, freeze one exact candidate, run every required M04 and M00–M03 gate plus `pnpm verify` on unchanged bytes, inspect the full staged/unstaged/untracked inventory, whole diff, secrets/privacy and authority boundaries, and obtain a fresh independent read-only R2 whole-patch verdict. Any later candidate byte change invalidates those gate/review claims.

## 4. Specification approval gate

Verify the six predecessor hashes above, this document's exact whole-file SHA-256, Markdown/link integrity, and the scope-only diff. Obtain an independent read-only R2 specification review of the PostgreSQL privilege premise, exact supersession, unchanged manifest identity, five path/revocation proofs, and residual writer-LOGIN privilege. Review is evidence, not approval. Implementation may begin only after the product owner approves this document's **exact final SHA-256** and separately authorizes implementation against it. Until both actions occur, no implementation or migration edit is authorized and M04 remains **NO-GO**.
