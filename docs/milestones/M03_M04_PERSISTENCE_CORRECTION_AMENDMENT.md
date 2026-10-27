# M03/M04 Persistence Correction Amendment — Opaque Input Commitment and Database Authority

## 1. Status and authority

- Status: `CANDIDATE FOR INDEPENDENT SPECIFICATION REVIEW`.
- Preparation and independent review: authorized by the product owner after the M04 whole-patch R2 `NO-GO`.
- Human approval of this document's exact final SHA-256: `NOT YET GRANTED`.
- Implementation against this document: `NOT YET AUTHORIZED`.

This is a specification-only correction. It does not authorize implementation, migration edits, staging, commit,
push, pull request, merge, deployment, production migration, publication, release, or M05 work. Existing local
implementation is a candidate, not evidence that this amendment has been approved or satisfied.

The approved, byte-frozen authority tuple is:

1. `docs/milestones/M03_SPEC.md`, SHA-256
   `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`;
2. `docs/milestones/M04_SPEC.md`, SHA-256
   `f4de3bd80f5ace68def7399944b8778e9817991a036d985be089392e72999569`;
3. `docs/milestones/M03_M04_HANDOFF_AMENDMENT.md`, SHA-256
   `74e30585b84efc23b11bf58aac3cb4b95850ace32761e75067f29185759e574c`.

After the product owner approves this document's exact whole-file SHA-256, it is the fourth member of that tuple.
It controls only the clauses explicitly named below. Every other requirement, bound, result arm, ordering rule,
privacy restriction, acceptance criterion, and authorization boundary remains in force. In particular, this
document does not relax complete original M02 projection retention, the M04 predecessor freshness proof, or any
collision check for which both canonical preimages exist.

The first handoff amendment's Section 1 status lines are a historical pre-approval snapshot. The product owner's
subsequent exact-SHA approval and separate implementation authorization established its current authority; this
document does not retroactively edit those frozen bytes or withdraw that earlier authorization.

## 2. Defect and resolution

The first handoff amendment Section 5.3 explicitly says the six original predecessor-fingerprint preimages are
unavailable to M04. Approved M03 Section 15 likewise keeps the complete compound `inputFingerprint` preimage in a
transient, in-memory collision store. That preimage includes bounded but potentially sensitive exact source bytes,
provider metadata, and policy/configuration payloads. It is not in the V2 bundle or M04 database. The first
amendment's Section 7.2, final Section 8 collision paragraph, verification matrix, and `AMEND-AC-10` nevertheless
appear to require M04 to compare the original compound input preimage byte-for-byte after restart. No M04
implementation can do so without changing the approved retention and privacy boundary.

The correction treats the M03 compound input fingerprint as an **opaque upstream commitment** at M04. M03 remains
responsible for comparing its exact input preimages while those bytes exist under its approved collision store.
M04 verifies that the V2 bundle is internally valid and output-bound, that its stored `m03_input_fingerprint`
column equals the bundle value, and that all comparable retained domains match by their correct canonical
preimages. M04 never treats equality of the opaque input fingerprint alone as proof of replay, identity, source
byte equality, or binding equivalence. M04 never claims to have inspected unavailable original bytes.

If two M04 bundles have the same `m03_input_fingerprint`, M04 byte-compares every retained member known to enter
the compound input preimage: `m02InputProjection`, `expectedPredecessorState`, and the canonical
`analysisConfiguration` payload. A difference in any of these members proves that the compound preimages differ,
so M04 returns `CONTENT_HASH_COLLISION` even when the projection fingerprints themselves differ. Equality of those
retained members does not prove equality of the unavailable source, provider, root-content, or policy-artifact
bytes; the input fingerprint alone neither forces a collision result nor joins the bundles. Different AI output
with equal retained input members follows the existing extraction/semantic identity rules. An injected collision
in the complete original compound input preimage remains an M03 test and must fail there before V2 output.

This correction does **not** authorize retaining the complete compound input preimage, any acquired source bytes,
provider response, personal-contact data, credential, prompt, or unrestricted source excerpt in M04 persistence.
It also does not introduce a signature, MAC, key, external attestation, or production migration.

## 3. Exact supersessions to the first handoff amendment

| Earlier clause                                       | Replacement rule                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Section 7.1, step 4                                  | Compare all simultaneously available retained canonical preimage bytes. Validate the opaque `m03_input_fingerprint` as a syntactically valid, output-bound commitment, without asserting equality of unavailable original input preimages.                                                                                                                                                                                |
| Section 7.2                                          | Common collision preflight still precedes idempotency, replay, freshness, and association writes. Query every relevant identity/fingerprint domain. For a match, compare its complete canonical preimage when retained on both sides. For `m03_input_fingerprint`, compare every retained comparable component and apply the opaque-commitment rule in Section 2; never infer original input-byte equality from the hash. |
| Section 7.5                                          | An input-fingerprint match alone is not an existing-content binding match and does not justify replay, join, or rejection. Distinct retained semantic identities follow the existing mismatch/collision rules.                                                                                                                                                                                                            |
| Final paragraph of Section 8                         | “Equal hash with byte-distinct retained preimages” applies only where both complete domain-specific preimages are retained. The opaque compound input fingerprint follows Section 2. Projection, output, logical, canonical, request, binding, result, and record domains retain full byte-comparison requirements.                                                                                                       |
| Section 11, “Collision” row                          | Directly test same-hash/different-byte injection in every retained-preimage domain, including the projection, output, logical, canonical, request, binding, result, and record domains. Test a forced compound input-preimage collision in M03; at M04 test equal opaque input fingerprints with both equal and different retained projections without falsely claiming unavailable original-byte comparison.             |
| `AMEND-AC-10`                                        | All equal-hash/different-byte domains **with complete retained preimages on both sides** fail as `CONTENT_HASH_COLLISION`. M03 detects injected compound-input collisions while its approved preimages are available. M04 verifies the opaque input commitment and retained comparables, never joins on input hash alone, and does not claim detection of a collision requiring unavailable original input bytes.         |
| Approved M04 Section 8 preimage rule and `M04-AC-17` | Every M04-created hash and every upstream hash with complete preimages retained on both sides still requires byte comparison and the exact collision result. The upstream compound M03 input fingerprint alone follows Section 2 because its complete original preimage is intentionally unavailable at M04. All other M04 Section 8 and `M04-AC-17` requirements remain in force.                                        |

No other clause of the first amendment is superseded by this section.

## 4. Executable PostgreSQL authority

The first handoff amendment Section 8.1 requires exact LOGIN/group separation and effective privilege checks but
does not enumerate the table rights the actual adapters need. A successful validator of only the fence functions
can therefore coexist with an unusable runtime LOGIN. The following rules complete that contract without granting
application ownership or migration authority.

### 4.1 Session identity and startup gate

The configured `AI_ARK_M04_DATABASE_LOGIN_ROLE` and `AI_ARK_M01_M02_DATABASE_LOGIN_ROLE` remain distinct LOGIN
roles with the approved direct group memberships and transitive exclusions. Each corresponding adapter must use a
connection whose PostgreSQL `session_user` and `current_user` both byte-equal its configured LOGIN role. A
`SET ROLE` impersonation from a privileged connection is not a substitute. The adapter verifies these values,
the resolved namespace OID/name, the effective privilege matrix below, and the exact fence-function permissions
before its first domain query or transaction. It repeats the identity and namespace check on every checked-out
pooled connection before using it. Role, membership, effective-ACL, schema-OID, relation-OID, function-OID, or
catalog drift returns exactly `FAILED/PERSISTENCE_INTEGRITY_FAILED` with the frozen diagnostic
`{code:"PERSISTENCE_FAILURE",stage:"PERSISTENCE",subjectKind:"DATABASE"}` and all optional members null. It
commits no domain write and emits no connection string or SQL error text. A connection/service outage retains
`FAILED/PERSISTENCE_UNAVAILABLE`. If startup detects drift before any request exists, startup fails with the closed
`M04_DATABASE_ROLE_AUTHORITY_DRIFT` or `M04_DATABASE_SCHEMA_INVALID` configuration error and begins no adapter
work. There is no production or test-only bypass in the adapter.

The schema name is validated by the first amendment's exact ASCII domain and quoting rule. The adapter and
validator resolve exactly one non-system `pg_namespace` row and pin its OID and byte-equal `nspname` for the
operation. Every application relation reference and every M04 migration-owned function relation reference is
schema-qualified with that validated, quoted identifier. After the approved M04 advisory locks, the transaction
uses schema-qualified `LOCK TABLE ... IN ACCESS SHARE MODE`, one relation at a time in fixed UTF-8 name order, for
the eight M03/M04 canonical relations and checks their resolved relation OIDs against the startup catalog before
collision preflight. In the new-binding branch, it takes the approved shared predecessor fence first, then uses
the same schema-qualified `LOCK TABLE ... IN ACCESS SHARE MODE` command, one relation at a time in fixed UTF-8 name
order, for the 18 predecessor relations and checks their OIDs before a predecessor read. These low-privilege
relation locks are held to transaction end and do not replace the fence row lock. Later `INSERT` operations acquire
their ordinary `ROW EXCLUSIVE` locks; no default or stronger explicit table lock is permitted. Actual-LOGIN tests
inspect `pg_locks` and the catalog in the live transaction to prove the held relation OIDs/modes and exercise
rename/recreate interleavings.
The connection checks the schema name/OID, relation OIDs, and invoked function OIDs and definitions after acquiring
locks, immediately before and after every separately parsed domain statement, and before commit. Each statement
must use a named server-side prepared operation parsed only after the relevant OID verification and executed while
the relation locks are held, with the backend-resolved object OIDs verified; an equivalently atomic guarded
server-side statement is allowed only if it proves the same OID binding. A name-only check followed by a separately
parsed SQL statement is insufficient. Any intervening rename/recreate, replan, function replacement, or OID/name
drift rolls back the complete transaction before any accepted result. The same checks repeat after a wait or retry
on a new connection or snapshot. No unqualified relation, caller `search_path`, implicit `pg_temp` precedence,
or dynamic identifier can redirect an accepted read, committed write, trigger, or closure check. The migration
runner and validator apply the same OID/name identity to rendering, catalog reads, ACL checks, and recovery
evidence.

### 4.2 Table and function privilege matrix

The migration owner remains separate from both application groups and LOGINs. Migration `003` grants exact
schema `USAGE` and no `CREATE`, and the first amendment's fence-table/function rights remain exact. No
application group or LOGIN receives `TRUNCATE`, `REFERENCES`, `TRIGGER`, `CREATE`, ownership, DDL, or broad
`ALL TABLES IN SCHEMA` rights. Required privileges are explicit, schema-scoped, and checked as **effective**
privileges of the actual LOGIN, including inherited and settable role paths:

| Principal                                                        | Relation set                                                                                                                                                                                          | Allowed table operations                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M04 runtime group/LOGIN                                          | The exact 18 predecessor relations in first-amendment Section 8.1                                                                                                                                     | `SELECT` only; no `INSERT`, `UPDATE`, or `DELETE`.                                                                                                                                                                                                                     |
| M04 runtime group/LOGIN                                          | `m03_extraction_bundles`, `m03_extraction_bundle_chunks`, `m04_evidence_items`, `m04_claims`, `m04_claim_evidence_links`, `m04_completeness_snapshots`, `m04_binding_results`, `m04_binding_requests` | `SELECT` and `INSERT` only. All eight tables are append-only after insertion. A request association is inserted for an initial canonical binding or for the approved Section 7.4 new-key semantic replay.                                                              |
| M01/M02 writer group/LOGIN                                       | Existing M01/M02 relations read or mutated by `PostgresManualResolutionAdapter` and `PostgresSystemIdentityAdapter`                                                                                   | A finite, checked-in per-relation grant manifest names each table and the exact subset of `SELECT`, `INSERT`, `UPDATE` required by the two current adapters. `DELETE` is prohibited for the current adapters. No permission is inferred from all tables or future SQL. |
| M01/M02 writer group/LOGIN                                       | All eight M03/M04 canonical tables above                                                                                                                                                              | No table privilege.                                                                                                                                                                                                                                                    |
| Both application groups/LOGINs and a hostile `PUBLIC`-only LOGIN | `m03_m04_predecessor_fence`                                                                                                                                                                           | No direct or inherited table privilege.                                                                                                                                                                                                                                |
| Hostile `PUBLIC`-only LOGIN                                      | All eight M03/M04 canonical tables                                                                                                                                                                    | No table privilege.                                                                                                                                                                                                                                                    |

The finite manifest is `packages/job-queue/migrations/003_m04_runtime_privileges.json`. Its complete strict shape
is `{schemaVersion:"M04_RUNTIME_PRIVILEGES_V1",groups:[{role,relations,functions},...]}` with no extra or missing
keys. `groups` contains exactly two entries, sorted by the literal role tokens `M01_M02_WRITER_GROUP` and
`M04_RUNTIME_GROUP`; each token resolves only to its separately configured NOLOGIN group identifier. Each
`relations` entry is exactly `{name,operations}`; `name` is an exact schema-relative table identifier from the
closed relation sets above, entries are unique and UTF-8-name-sorted, and `operations` is a nonempty, unique array
sorted in the fixed order `SELECT`, `INSERT`, `UPDATE`. Each `functions` entry is an exact schema-relative,
argument-type-qualified function signature string; entries are unique and UTF-8-signature-sorted. No wildcard,
prefix, future table, dynamic discovery, direct LOGIN grant, null, duplicate JSON key, or alternative encoding is
valid. Manifest bytes must be exactly UTF-8 `canonicalJsonM03(parsed manifest)` followed by one LF, without BOM;
the runner and validator reject any other bytes or shape. Migration `003` grants exactly this manifest; the
validator compares exact catalog and effective rights,
including absence of every nonmanifest right. For every manifest relation-operation or function-execution cell,
the completion report identifies a named adapter SQL path and an actual-LOGIN positive test; removing that one
cell must make that path fail closed. A cell without that necessity proof is forbidden. Adding an adapter query,
mutation, or function call requires an explicit manifest change and reviewed migration `003` hash. The report
records the manifest SHA-256 and complete path-to-cell coverage matrix. Application LOGINs receive rights only
through their respective NOLOGIN groups; any direct LOGIN table or function grant fails validation.

This manifest is a required, checksum-bound adjunct to numeric SQL migration `003`, not a fourth migration or a
runtime-discovered grant source. It narrowly supersedes approved M04 Section 19's SQL-file-only hash rule for
`003` and leaves discovery/order/ledger rules for `001` and `002` unchanged. Let `sqlHash` be lowercase SHA-256
hex of the exact `003_m04_evidence_binding.sql` bytes and `manifestHash` be lowercase SHA-256 hex of the exact
canonical manifest bytes. For version `003` only, the `schema_migrations.sha256` value and expected migration
identity are `sha256(UTF8("AI_ARK_M04_003_MANIFEST_V1\n" + sqlHash + "\n" + manifestHash + "\n"))`. The runner
must verify both constituent hashes and the composite expected identity before applying `003`, and must write that
composite in the same `003` ledger transaction. It must reject missing, malformed, noncanonical, or changed
manifest bytes, or a SQL/manifest/composite mismatch, before applying a pending `003` or accepting an already
applied `003`; `pnpm db:validate` performs the same check read-only. An applied `003` never silently acquires new
rights from a changed manifest. Fresh apply, already-applied no-op, interrupted prefix resume, dump/restore,
and manifest-only mutation tests prove that manifest drift cannot pass while the SQL file is unchanged. The
completion report records `sqlHash`, `manifestHash`, composite identity, and the exact ledger row.

The M04 LOGIN has only the shared-fence function execution right; the writer LOGIN has only the exclusive-fence
function execution right; neither can execute the bump function directly. The hostile LOGIN can execute none of
the three. Both application LOGINs must have only the specific additional M04 support-function executions needed
by their granted table operations; each is listed in the same checked-in manifest and checked by the validator.
The writer's legacy M01/M02 support-function calls are likewise enumerated. `PUBLIC` execution on any M04
security-sensitive support function is revoked. The manifest must be a closed, human-reviewable table of concrete
schema-qualified relation/function names and rights in the migration and validator, not a runtime SQL-discovery
grant. Tests exercise each allowed operation using connections authenticated as the actual LOGINs, and each
cross-role, owner/superuser, hostile, direct-grant, transitive-grant, or missing-grant case fails the startup gate.

Existing triggers may perform their approved checks on behalf of an allowed DML statement, but no trigger grants
the caller an additional direct table or function right. If a legacy trigger requires a relation read by its
invoker, that relation and `SELECT` right must appear in the writer manifest; otherwise the migration is not
ready. The validator tests both positive usability and negative confinement. An owner-pool integration test
cannot substitute for either actual-LOGIN result.

### 4.3 Schema and lock adversarial evidence

Direct tests create same-named temporary relations and functions under `pg_temp`, change `search_path`, and attempt
namespace name/OID drift. They force rename/recreate between initial validation and statement use and verify zero
committed domain writes; the adapter must use the approved OIDs or fail closed. For each of the 18 fenced
relations, a direct mutation test proves the statement trigger increments the singleton epoch atomically or
rolls the mutation back. `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE` each have a representative direct test;
where one operation is prohibited by the table's immutability contract, the test proves that prohibition rather
than treating an unexecuted operation as a pass. Tests force shared/exclusive waits, mutation between collision
preflight and predecessor read, phantom insertion, inverse raw-SQL lock order with PostgreSQL `40P01`, and
rollback of epoch plus source mutation. These tests use real LOGINs where the permission contract requires them.

## 5. Common collision order and exact comparison domains

The first amendment's Sections 7.1–7.6 already require collision-before-idempotency. This section clarifies the
implementation contract; it does not reorder those branches. Before database access, M04 computes the V2
extraction identity, projection fingerprint, output fingerprint, logical and canonical bundle payloads, and all
M04 canonical request/record/binding/result identities and their domain-specific preimages. A mismatched V2
extraction ID is a bundle-schema failure before any database read. The extraction-ID formula is shared by M03
production, V2 contract validation, and M04 validation. A caller cannot repair a forged ID merely by recomputing
the output fingerprint.

Inside the Serializable transaction, after the approved advisory locks and before any idempotency-key lookup,
semantic replay, current-predecessor check, or association write, M04 queries every primary, alternate-unique,
fingerprint, logical, canonical, projection, output, binding, result, and record domain that can match a retained
row. Matching rows are loaded with their complete retained closure. For each match, the exact domain-specific
canonical preimage on both sides is reconstructed and compared byte-for-byte; a retained hash alone is never the
preimage. A corrupt matched row fails closed. Equal hash/ID with distinct complete retained preimages returns
`CONTENT_HASH_COLLISION`, rolls back, and takes precedence over same-key/different-request or accepted replay.
The opaque M03 input fingerprint follows Section 2. The branch repeats collision preflight after the fenced
predecessor reconstruction for identities derived there. A PostgreSQL `23505` is retried only as a whole
transactional race when a fresh transaction can reclassify it; a stable unique collision cannot terminate as
`SERIALIZATION_RETRY_EXHAUSTED` and must receive the exact collision result.

Direct tests inject distinct bytes under an equal hash/ID in each retained domain, including projection, output,
logical, canonical, request, each EvidenceItem/Claim/link/completeness record, binding, and result. Combined
collision-plus-idempotency and collision-plus-semantic-replay cases prove the common preflight wins. The opaque
input cases separately mutate `m02InputProjection`, `expectedPredecessorState`, and `analysisConfiguration`
under an equal compound input hash and require `CONTENT_HASH_COLLISION`. A fourth case keeps all three equal and
proves that the opaque input hash alone causes no replay or join. These tests do not claim comparison of
unavailable original source/preimage bytes. No expected hash is accepted as a substitute for recomputing a
retained preimage.

## 6. Required review and completion evidence

Implementation requires separate product-owner approval of this document's exact final SHA-256 and separate
implementation authorization against the four-document tuple. Until then the local M04 candidate remains
`NO-GO`. After authorization, its report must map this document's rules to code and direct tests, including:

1. Exact authority/migration hashes; complete tracked, staged, and untracked inventory; and a whole-patch review.
2. M03 V1 historical and V2 six-result-arm/cross-version matrices, complete projection mutation matrix, and a
   forged V2 extraction-ID negative test before database access.
3. Every retained-preimage collision domain, opaque-input cases, collision/replay precedence, full stored V2
   closure before either replay association, and exact rollback row counts.
4. The checked-in per-relation/function privilege manifest, actual-LOGIN positive and negative tests, namespace
   OID and hostile temporary-schema tests, all 18 fence relations, lock-order/deadlock/rollback tests, and exact
   catalog and dump/restore checks.
5. Frozen migrations `001`/`002`; forward-only migration `003` hash, clean and prefix resume, interruption,
   second no-op, catalog drift, and recovery evidence; pinned Node `22.23.1` and pnpm `11.7.0` gates.
6. Targeted, fixture, adversarial, integration, unfiltered `pnpm test`, `pnpm verify`, `git diff --check`,
   secret/privacy scan, fresh source-only checkout reproduction, and a fresh independent R2 whole-patch review.

`GO` is forbidden while any required direct gate is failed, missing, or replaced with a narrower aggregate claim.
Reviewer findings are evidence to verify, not automatic approval. No M05, publication, production migration, or
irreversible action follows from a green local gate or this amendment alone.
