# M05 database change and recovery boundary

Status: local candidate procedure; not deployment or production migration authorization. Authority is `docs/milestones/M05_SPEC.md` at SHA-256 `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`. Use [M05_REPORT.md](../milestones/M05_REPORT.md) for executed test evidence and the current decision; the existence of this procedure is not a passing rehearsal.

## Boundaries and prerequisites

The existing [M04 administrative-change boundary](M04_DATABASE_CHANGE_RUNBOOK.md) remains in force. M05 adds a separately inventoried `ai_ark_m05` namespace, an M05-only runtime LOGIN/group, and forward migration 004. Migrations 001–003 and the M04 privilege manifest stay byte-frozen. The M05 runtime must not acquire privileges in M01–M04 schemas; the trusted M04 read bridge continues to use the existing M04 authority without new grants.

“No TEMP-based authority” means application queries and invoker triggers must not derive authority or canonical data from temporary objects. It does not authorize revoking database-wide PUBLIC TEMP permission and thereby changing predecessor behavior. Preserve database-wide predecessor rights, use qualified objects/fixed search paths, and prove resistance to hostile `pg_temp` shadows under the actual LOGIN. Any proposal to change shared database ACLs requires separate authority review.

Only disposable local/test targets are permitted by the current task. The migration owner, M01/M02 LOGIN, M04 LOGIN, and M05 LOGIN are distinct. Credentials remain in the configured environment or secret source; do not paste connection strings into reports or logs. Runtime adapters must never use the migration owner connection.

The runner requires `AI_ARK_DATABASE_URL` for the owner, `AI_ARK_DATABASE_ENVIRONMENT`, `AI_ARK_DATABASE_ALLOWED_HOSTS`, `AI_ARK_DATABASE_OWNERSHIP_SENTINEL`, and the three distinct role names `AI_ARK_M01_M02_DATABASE_LOGIN_ROLE`, `AI_ARK_M04_DATABASE_LOGIN_ROLE`, and `AI_ARK_M05_DATABASE_LOGIN_ROLE`. `AI_ARK_DATABASE_SCHEMA` selects the predecessor namespace (default `public`); it does not rename the isolated `ai_ark_m05` namespace. The validator also requires separately authenticated `AI_ARK_M01_M02_DATABASE_WRITER_URL`, `AI_ARK_M04_DATABASE_RUNTIME_URL`, and `AI_ARK_M05_DATABASE_RUNTIME_URL` for the same target database. Use the disposable test harness to provision these values for local proofs; never substitute an owner URL for a runtime URL or print any of them.

## Authorized change sequence

1. Confirm the target is disposable and the exact migration/manifest identities and test scope are authorized. A shared/production target requires a separate approval and qualified deployment-specific controls.
2. Stop admission and drain all M01/M02, M04, and M05 adapter requests; close their pools. No owner DDL, backup restoration, or migration may overlap a running adapter transaction or an admitted generation that could later commit.
3. Verify zero serving transactions for all three configured runtime LOGINs. If unobservable or nonzero, keep admission closed.
4. Run the forward migration runner only with the separately scoped owner connection. Existing ledger identities must match; do not edit a previously applied migration or use a broader grant to bypass a failure.
5. Validate the frozen M04 prefix independently from the complete M05 namespace: tables, constraints, chunk closure, canonical identities, roles/membership, direct/effective/PUBLIC/third-role/default privileges, function security/source, trigger binding, and ledger/manifest identity. A successful M04 check alone cannot qualify M05.
6. Reopen fresh runtime pools and pass each adapter's startup and checkout authority checks. Execute a bounded synthetic acceptance/read/replay test and confirm no unexpected canonical M04 write.
7. Reopen admission only after all checks succeed. On failure, keep serving stopped, preserve safe error-code evidence, and use an authorized forward repair rather than changing historical migration bytes.

## Recovery proof

Disposable backup/restore tests must reconstruct the complete input chunks, retained trusted policy artifacts, source closure, revision, and request associations. Exact and semantic-alias replay must work without a live provider or upstream M04 database after acceptance, while first generation still requires the verified upstream read. Corrupted chunks, hashes, lineage, policy mappings, projected content, or association targets must reject before preview/replay. An uncertain commit requires accepted lookup before another provider call.

No database rollback is implied by reverting Git source. Applied-schema corrections are forward-only. Production admission control and production recovery qualification remain unimplemented/out of scope; local fixture rehearsal is not production evidence.
