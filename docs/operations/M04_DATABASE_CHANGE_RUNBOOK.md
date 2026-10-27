# M04 database administrative-change boundary

Status: local Technical Alpha procedure. This is not production deployment or migration authorization.
The approved authority is `docs/milestones/M03_M04_AUTHORITY_OID_AMENDMENT.md` at SHA-256
`3d41b58f33d111fd1e61a72bcbbc8eb2883a1e5a2cfb5b8196c8b6bb5054a504`.

## Purpose and prerequisites

M01/M02 and M04 application LOGINs cannot alter the serving schema. A trusted migration owner can alter
functions and triggers, so catalog checks alone do not detect a malicious transient swap-and-restore. No
privileged DDL, restore, or migration may overlap admitted or executing adapter requests. A database
administrator must hold separate authorization for the exact change and use a control that stops both
adapter classes. Database credentials remain in an approved secret source and must not be pasted into
reports, logs, or commands shared with a reviewer.

No shared or production M04 environment or admission-control service is selected yet. The local integration
test `m04-migration-runner.integration.test.ts` is the current executable rehearsal; it is **not** proof
that a future deployment can stop admission or prevent a privileged administrator from bypassing the
protocol. That deployment-specific control remains `PENDING` and blocks go-live.

## Change sequence

1. Confirm exact approval for the change, target database, migration bytes, and rollback/forward-repair
   plan. Without them, do not start.
2. Stop new M01/M02 and M04 request admission. Drain or terminate every active adapter transaction and
   close both pools; do not merely pause one worker. Keep admission closed.
3. From the authorized owner connection, confirm `pg_stat_activity` has zero serving transactions for
   both actual application LOGINs in the target database. If the count is nonzero or unobservable,
   abort the change and keep serving stopped.
4. Apply only the separately authorized owner DDL or forward migration. Do not edit or replay a
   previously applied migration `003`. An error leaves the service stopped.
5. Run the approved read-only catalog/ledger/role validator against that exact environment. The
   repository's current `pnpm db:validate` is restricted to disposable local/test targets; do not use
   it as a production command or as a substitute for a separately approved production procedure.
6. On validation failure, do not restart either adapter. Repair using an authorized forward change,
   validate again, and retain failure evidence without secrets.
7. Start both adapters with fresh pools. Their startup gates must verify the actual LOGINs, exact role
   and privilege matrix, schema and relation OIDs, function source/security settings, and trigger
   bindings. Only after both pass may admission reopen.

The expected immediate result is zero active serving transactions before owner DDL, successful validation
afterward, successful startup gates, and then reopened admission. Independent verification checks the
actual-LOGIN session identities and `pg_stat_activity`, the migration ledger/composite hash, validator
result, and a scoped smoke transaction with no unexpected domain write. A nonzero activity count,
catalog/ACL mismatch, or failed startup is a stop condition: keep admission closed, preserve logs with
safe codes only, and seek authorized forward repair. Return the exact target/environment class,
authorization reference, non-sensitive zero-session evidence, validator result, and startup-gate result
for review; never return connection strings or participant/source content.

## Local rehearsal evidence

The disposable PostgreSQL test stops simulated admission, closes actual M04 and M01/M02 LOGIN pools,
confirms no active application transaction, changes a fence function as owner, proves premature M04
startup and catalog validation fail, restores it, proves validation passes, and restarts both adapters.
It also rejects exclusive-fence/bump security-mode drift and a disabled predecessor trigger. This is
local fixture evidence only, not live-provider, production, or human-operator evidence.
