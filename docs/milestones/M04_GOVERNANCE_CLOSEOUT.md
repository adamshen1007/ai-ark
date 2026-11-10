# M04 governance closeout

Date: 2026-10-27. Decision: **GO — M04 GOVERNANCE CLOSED** for the merged implementation, not deployment or go-live.

## Published identity and evidence

- Repository: `ai-ark`; base `cd6116a41a83fe07ede8034abb816eacfa8d1b66`.
- Implementation commit: `717d9c544ad6f9c96275ae885c89d3383bbc8bf2`.
- [PR #2](https://github.com/adamshen1007/ai-ark/pull/2), merged 2026-10-27; merge commit `e9b62f80f2c5dd2402d145df5e4afda403691f2f`.
- Implementation and merge tree both `f56bbbe93c4372d588ac6790e0b6b56d4f7ddf81`.
- [PR CI](https://github.com/adamshen1007/ai-ark/actions/runs/40439508880) and [main CI](https://github.com/adamshen1007/ai-ark/actions/runs/40439719902): success, independently rechecked at closeout.
- Reviewed implementation inventory: 283 tracked/nonignored files, excluding only `M04_REPORT.md`, digest `6601951c59011900c894fadeba88b55b0f5f3037194b57b65cb9274c791d7e84`. Algorithm: unsigned UTF-8 path order; stream path, NUL, lowercase hex SHA-256(file bytes), newline into SHA-256. This identifies the historical merged candidate, not later governance-document edits.
- SQL 003 SHA-256: `6da55b9ee12fccad5feb5b9fd31ff30ce972a8b3401f83a62cdb2bdf632939e8`; manifest: `09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991`; composite V2: `da96f97b47f2999e2c94676a334a88053fa5a4f519fcb6f883268064a263be79`.

The [implementation report](M04_REPORT.md) contains the eleven approved document hashes, acceptance mapping, historical failures and remediation. None of those specification bytes is changed by this closeout.

## Verification provenance

| Evidence                                         | Actual scope and outcome                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Local `pnpm verify`                              | Passed, including 197 unit and 183 contract tests; rerun before Git publication                                         |
| Local `pnpm test --reporter=verbose`             | 58 files / 825 tests passed on the frozen candidate                                                                     |
| Local `pnpm test:integration --reporter=verbose` | 12 files / 362 tests passed on the same candidate                                                                       |
| Fixtures / adversarial                           | 60 / 23 passed                                                                                                          |
| M04 migration / persistence files                | 6 / 22 passed                                                                                                           |
| Source-only frozen installation and verify       | Passed with matching candidate; reused local dependency cache                                                           |
| Full-patch independent R2                        | Local read-only reviewer returned GO — M04 COMMIT READY                                                                 |
| Fresh Git-publication R3                         | No blocker except the two approved-file whitespace warnings; owner explicitly waived only those two lines before commit |
| GitHub CI                                        | Frozen installation and `pnpm verify`; does not reproduce the full PostgreSQL integration matrix                        |

Local review outputs and logs are execution evidence, not GitHub reviewer approvals or independently downloadable CI artifacts. The browser reviewer received a sanitized summary, not the final patch/raw logs; its no-blocker response was advisory consistency feedback only. Historical failed runs remain failures. The 240,000 ms maximum test limit was not increased; final integration/full aggregate maximum cases took 147,363 / 162,514 ms respectively.

## Narrow gate exception

After staging, raw `git diff --cached --check` exposed two intentional Markdown hard breaks previously missed while the files were untracked: line 3 in `M03_M04_ALTERNATE_UNIQUE_CONFLICT_CLARIFICATION_AMENDMENT.md` and `M03_M04_ALTERNATE_UNIQUE_CLOSURE_REACHABILITY_AMENDMENT.md`. The owner explicitly approved their preservation and the commit/push/PR/merge workflow after CI. Their approved hashes remain `44f6d6a8577ecd95eb8689446bd5e05d75fbdf52341b26d67e8477a409380e87` and `3a3e694075fb3897ee68821a7254dbb04b457e7506f854b74879f3d35123875b`. Raw warnings were not relabeled as passes. No repository-wide whitespace rule or other gate was waived.

## Residual limits and next boundary

M04 provides durable evidence binding, not a usable editorial product or production environment. The administrative-DDL exclusion and deployment-specific admission control remain as described in the [database runbook](../operations/M04_DATABASE_CHANGE_RUNBOOK.md). Migration 003 is not production-applied. There was no deployment, release, product-content publication, live-provider qualification, or M05 implementation.

GitHub main had no branch protection/rulesets or CODEOWNERS at publication; the workflow waited for CI without bypass. Nonblocking maintenance backlog: action-runtime deprecation warnings for checkout/setup-node v4 and the ubuntu-latest image transition. Neither is silently bundled into M05.

M05 specification preparation/review is now authorized. Its exact final SHA-256 approval and a separate implementation authorization remain required. This closeout does not authorize publication of the new governance/specification documents, M06+, or production changes.
