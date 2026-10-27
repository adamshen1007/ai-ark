# M03/M04 Authority and OID-Binding Amendment — Candidate

## 1. Status, authority, and boundary

- Status: `CANDIDATE FOR INDEPENDENT SPECIFICATION REVIEW`.
- Preparation and independent read-only review: authorized by the product owner after the M04 whole-patch R2 `NO-GO`.
- Human approval of this document's exact whole-file SHA-256: `NOT YET GRANTED`.
- Implementation against this document: `NOT YET AUTHORIZED`.

The four approved, byte-frozen authorities remain:

1. `docs/milestones/M03_SPEC.md`, SHA-256 `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`;
2. `docs/milestones/M04_SPEC.md`, SHA-256 `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569`;
3. `docs/milestones/M03_M04_HANDOFF_AMENDMENT.md`, SHA-256 `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c`;
4. `docs/milestones/M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`, SHA-256 `e4888a93074d9d0104ac6933571c7d888bf9704a0603f5c962cd2db7fc73cfe8`.

If approved at its exact final hash, this document becomes a fifth authority and supersedes **only** the
specified clauses in Sections 2 and 3 below. It changes no M03/M04 product identity, evidence, privacy,
collision, predecessor-freshness, transaction-order, or publication contract. It does not authorize code or
migration edits, application of a migration, staging, commit, push, PR, merge, deployment, release,
publication, or M05 work. The present local M04 candidate remains `NO-GO` regardless of this draft or a
subsequent specification-review verdict.

## 2. Exact sequence authority and privilege-manifest correction

### 2.1 Defect and narrow supersession

The approved persistence-correction amendment Section 4.2 requires migration `003` to grant **exactly** a
strict manifest containing only relation and function cells. The frozen M02
`m02_rejected_command_audits.id` default calls `nextval` on
`m02_rejected_command_audits_id_seq`. The current M01/M02 writer's rejected-command audit path therefore
needs sequence `USAGE`, but the local candidate grants it outside that manifest. An out-of-manifest grant is
not authorized by the approved words, even if narrow and tested.

This section replaces the Section 4.2 manifest shape, schema version, exact-grant comparison, and `003`
composite-hash domain **only as stated here**. All other Section 4.2 role, table, function, namespace,
ownership, effective-right, and negative-confinement rules remain in force.

### 2.2 Manifest V2

The only allowed manifest file remains
`packages/job-queue/migrations/003_m04_runtime_privileges.json`. Its complete strict shape becomes
`{schemaVersion:"M04_RUNTIME_PRIVILEGES_V2",groups:[{role,relations,functions,sequences},...]}` with no
extra or missing keys. The two groups, role-token resolution, relation and function cells, ordering,
canonical JSON encoding, one trailing LF, and rejection of duplicates and unknown identifiers retain the
approved Section 4.2 rules. Each `sequences` value is an array of exact
`{name,operations}` entries, sorted by UTF-8 `name`. `operations` is exactly `["USAGE"]`; no other
sequence operation, implicit or wildcard entry, or broader `ALL SEQUENCES IN SCHEMA` grant is allowed.

The `M01_M02_WRITER_GROUP` has exactly one sequence entry:
`{name:"m02_rejected_command_audits_id_seq",operations:["USAGE"]}`. The `M04_RUNTIME_GROUP` has
`sequences:[]`. No other application sequence grant is allowed. `PUBLIC` and both actual LOGINs have no
direct sequence grant; the writer's sole effective `USAGE` comes through its approved NOLOGIN group. The
M04 LOGIN and the hostile `PUBLIC`-only LOGIN have no effective `USAGE`, `SELECT`, or `UPDATE` on any
application sequence. Neither application group or LOGIN has effective `SELECT` or `UPDATE` on the listed
sequence, and neither has a right on any other application sequence. The migration owner retains its
separate ownership authority.

Migration `003` grants the complete V2 manifest, including this one sequence cell, and **no
out-of-manifest relation, function, or sequence privilege**. The separately specified exact schema
`USAGE`/no-`CREATE` grant and external role memberships remain required and are not manifest cells.
The runner and read-only validator compare both catalog grants and actual-LOGIN effective rights for all
relation, function, sequence, namespace, and role requirements. Missing, extra, direct, transitive,
settable-role, `PUBLIC`, or owner-path rights fail closed before adapter work.
The writer adapter's rejected-command audit insertion is the named positive path for the sequence cell;
revoking that single group `USAGE` in an isolated actual-LOGIN test must make that insertion fail closed
with zero committed audit or command side effects. The test restores the grant only for fixture cleanup.

### 2.3 Migration identity and forward-only limit

For version `003` only, let `sqlHash` and `manifestHash` retain the approved definitions (exact SQL bytes
and canonical manifest bytes, respectively). The expected ledger identity becomes
`sha256(UTF8("AI_ARK_M04_003_MANIFEST_V2\n" + sqlHash + "\n" + manifestHash + "\n"))`. Runner,
validator, fresh apply, already-applied no-op, prefix resume, interruption, dump/restore, and manifest-only
mutation tests use this same V2 identity and reject V1/V2 mix-and-match. The report records all three hashes
and the exact `schema_migrations` row. Migrations `001` and `002` and their hash rules remain frozen.

This correction is permissible only while `003` remains an unapplied local candidate. No previously
committed/shared/production `003` is rewritten. If `003` has been applied outside disposable local test
databases, stop: its ledger and operational state require a separately approved forward migration and
explicit human authorization, not this amendment. Disposable test databases may be recreated; no shared
or production migration execution is authorized here.

## 3. OID binding and the administrative-DDL trust boundary

### 3.1 Defect and explicit threat model

Approved persistence-correction Section 4.1 requires backend-resolved object OIDs to be verified for every
domain statement, including invoked functions, triggers, deferred closure checks, and M01/M02 fence calls.
The current candidate's catalog checks around separately parsed operations do not prove which function OID
the backend executed. PostgreSQL can re-analyze a prepared statement after definitional DDL; a unique
prepared-statement name and matching catalog before/after are not themselves that proof. PostgreSQL's
documented behavior is described in [PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html)
and [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).

This section replaces only Section 4.1's demand to observe the backend-resolved **function and trigger**
OIDs and its guarantee that an arbitrary privileged function/trigger swap-and-restore between checks is
detectable. It makes the trust boundary explicit: a database superuser, migration owner, schema/object owner,
or other principal able to replace approved functions or triggers is a trusted administrator, **not** an
untrusted concurrent application actor. Such a principal can defeat application-level catalog checks. It
must not perform DDL against the serving schema while M01/M02 or M04 adapters are admitting or executing
requests. This is a deliberate reduction of the previously stated guarantee and requires exact-hash human
approval; it must not be described as satisfying the old backend-function-OID guarantee.

### 3.2 Binding required from unprivileged application connections

Both actual application LOGINs remain non-owner, non-superuser, non-migration roles with no schema `CREATE`,
DDL, trigger, ownership, direct LOGIN grants, hostile transitive membership, or `SET ROLE` path to elevated
authority. The adapter startup and every checked-out connection verify the approved `session_user` and
`current_user`, namespace name/OID, role graph, effective ACL, and exact catalog signature. Any drift fails
closed with the already approved startup or request result; connection errors remain unavailable rather
than integrity failures. No bypass is added.

The M04 transaction retains the approved advisory/fence order and `ACCESS SHARE` locks on all eight
canonical and, for new bindings, all 18 predecessor relations. It verifies their catalog OIDs after lock
acquisition and before each relevant statement. It uses only validated, schema-qualified relation and
function names and named server-side prepared domain statements parsed after the relevant verification.
The relation locks remain held to transaction end; a conflicting relation rename/drop/recreate or trigger
DDL must wait or cause a closed transaction failure. No `search_path`/`pg_temp` substitution, dynamic
identifier, or unqualified application relation may redirect a successful operation. The migration runner
and validator retain their approved namespace/OID checks.

For each invoked application, fence, bump, trigger, and deferred-closure function, the adapter or validator
checks the exact schema-qualified signature, OID, owner, definition, security mode, `search_path`, grant,
and trigger binding at startup and at the applicable pre/post-statement and pre-commit checkpoints from
approved Section 4.1. `SET CONSTRAINTS ALL IMMEDIATE` and both M01/M02 exclusive-fence call sites are
included, not exempted. The function/trigger check is a **catalog-integrity check under the trusted-DDL
exclusion**, not a claim to introspect a PostgreSQL execution plan. An observed mismatch, relation-lock
conflict, parse/replan error, function replacement, or unexpected catalog state rolls back before an
accepted result. All retries repeat the checks on a fresh connection/snapshot as already required.

### 3.3 Administrative change protocol and residual risk

Before any authorized owner/superuser DDL, migration, restore, function replacement, or trigger change on
the serving schema, operations must stop new M01/M02 and M04 request admission, drain or terminate active
adapter transactions and pooled connections, and confirm zero serving transactions. Only then may the
trusted administrator apply a separately authorized change and run `db:validate`; adapters restart and
repeat their startup gates only after validation passes. If quiescence or validation cannot be proven,
the service remains stopped and M04 readiness is `NO-GO`. No application code, role membership, or
voluntary advisory lock is treated as a defense against a malicious or noncompliant database owner.

The M04 implementation report must identify the actual operator/control that prevents privileged DDL
while serving, show a local quiesce-change-validate-restart rehearsal, and label any deployment-specific
enforcement not yet selected or run as `PENDING`. A local test may prove the protocol's software behavior,
but cannot prove production operator compliance. Privileged transient swap-and-restore during an active
request remains an acknowledged residual administrative-compromise risk, not an application-detected
failure or a passed adversarial test. If this trust boundary is unacceptable, this amendment is `NO-GO`;
a separate architecture with enforceable privileged-DDL exclusion or backend execution attestation must be
specified and approved before M04 can proceed.

## 4. Required acceptance and review evidence

1. **Sequence closure:** Canonical V2 manifest bytes, exact one-cell sequence authority, SQL/manifest/ledger
   hash agreement, actual-LOGIN grants and denials, and direct/reachable audit-path removal testing.
2. **Complete privilege necessity:** For every relation-operation, function-execution, and sequence cell,
   the report names a concrete adapter SQL path and actual-LOGIN positive test. Remove that individual
   cell in an isolated test and run the named path: it must fail closed with no committed domain side
   effect. A cell that is not needed by a path is removed, not retained as a convenient grant. Include
   negative `PUBLIC`, cross-role, direct, inherited, settable-role, ownership, and excess-right checks.
3. **OID and hostile/concurrency matrix:** Test each protected relation's held OID/lock mode; same-named
   `pg_temp` objects, altered `search_path`, rename/recreate attempts, and relation/trigger DDL contention;
   function/trigger definition drift detected at startup, before work, and before commit; deferred closure
   and M01/M02 fence/bump bindings; all 18 mutation triggers and rollback; shared/exclusive waits,
   inverse-lock deadlock, stale predecessor, phantom, and collision races. Report exactly which tests
   simulate an unprivileged attacker versus a trusted administrator in a quiesced window. Do not claim
   detection of an excluded transient privileged function swap.
4. **Operations proof:** Rehearse stop-admission, drain, owner DDL or restore, `db:validate`, and restart
   against a disposable database, including rejection of a premature restart and an injected validation
   failure. A future shared/production environment needs its own named control and evidence before use.
5. **Unchanged-candidate gate:** After separately authorized implementation, run the complete M04 and
   M00–M03 regression/recovery gates, source-only reproduction, exact-hash/diff and privacy review, and a
   fresh independent R2 whole-patch review. No earlier green gate or review automatically transfers to
   changed SQL, manifest, code, tests, or report bytes.

Before this **specification** can be approved, verify the unchanged four authority hashes, Markdown and
link integrity, exact whole-file hash, scope-only diff, and an independent read-only R2 review that
explicitly assesses the relaxed privileged-DDL threat model and the V2 manifest/composite identity.
The reviewer may return `GO — SPECIFICATION READY FOR HUMAN APPROVAL` only if these clauses are coherent,
implementable, and do not silently weaken unrelated approved M03/M04 invariants. Review is evidence, not
approval. The product owner must approve this exact final hash and separately authorize implementation.
