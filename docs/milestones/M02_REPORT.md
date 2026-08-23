# M02 — Skill Detection and Resource Identity implementation report

## 1. Decision

`M02 TASK 5 RECEIPT REMEDIATION COMPLETE — WHOLE-REPOSITORY VERIFICATION GREEN — FRESH INDEPENDENT WHOLE-PATCH REVIEW REQUIRED`

Task 5 remediated the whole-repository ESLint and acquired-source scanner blockers, corrected the active
implementation-plan authority line, closed the canonical fixture inventory through F42, replaced self-confirming
F36–F42 evidence with fail-closed receipts populated by executed PostgreSQL predicates, and executed the required
local M02 verification under the pinned runtime. This is an implementer verification result, not independent
acceptance and not `M02 COMMIT READY`.

## 2. Authority and scope

- Approved fourteenth-amended substantive specification SHA-256:
  `4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27`.
- Current post-approval-record whole-file `docs/milestones/M02_SPEC.md` SHA-256:
  `331b85c0114f7e81749612be93f4f62d3be86bde37cb134c3c48f5dedb4b30d2`.
- The approved substantive hash is recorded in the specification status, GO/NO-GO rules, approval record,
  active implementation-plan goal, and this report. Historical hashes remain historical.
- Scope completed: M02 Task 5 blocker remediation, canonical F01–F42 fixture closure, and whole-patch local
  verification for Tasks 1–4.
- Preserved behavior: exactly 256 unique human projection modes and exactly 22 unique system projection modes.
- Preserved non-goals: no M03 descriptive extraction/generation, editorial/publication path, UI, public directory,
  deployment, release, or live-provider validation.

## 3. Repository and publication state

- Root: `<repository-root>`.
- Branch: `codex/milestone-02`.
- HEAD, local `main`, and merge base: `85198bcfb62caaaf637271c02398f4b7390d4e6e`.
- Upstream/remotes: none configured.
- Index: empty; no staged files.
- Worktree: intentionally dirty M02 patch with 12 tracked modified entries and 56 untracked files. Git's collapsed
  status view reports 25 untracked path entries because directories are collapsed.
- Tracked diff: 12 files, 128 insertions, 23 deletions before accounting for untracked M02 files.
- Publication state: no commit, push, tag, PR, merge, release, deployment, or publication was performed or
  authorized.

## 4. Runtime

- Node.js: `v22.23.1` from `/private/tmp/node-v22.23.1-darwin-x64/bin`.
- pnpm: `11.7.0`.
- TypeScript: `6.0.3`.
- Vitest: `4.1.10`.
- PostgreSQL integration image: `postgres:17.6-alpine` through the repository's ephemeral Docker harness.

## 5. Task 5 blocker reproduction and remediation

### ESLint

The pinned-runtime baseline `pnpm exec eslint .` failed with exactly 172 errors and zero warnings across the
eight task-authorized files: 1, 1, 13, 43, 79, 13, 17, and 5 errors respectively. ESLint identified 47 as
auto-fixable. Bounded `eslint --fix` was applied only to those eight files; the remaining 125 errors were fixed
manually at their typed boundaries. No rule was disabled, no file was ignored, and no `eslint-disable`,
`ts-ignore`, or `ts-expect-error` suppression was added.

The fixes remove unsafe/no-op async usage, impossible checks, unsafe array/index/unknown-value access, ambiguous
buffer byte access, deprecated matcher usage, and inaccurate PostgreSQL row declarations. Required values now
fail closed when absent or malformed. A first post-remediation typecheck exposed seven additional unsafe optional
accesses; those were narrowed before the final green typecheck.

### Acquired-source safety

The baseline `pnpm lint:source-safety` failed on four `\bexec\s*\(` matches: two RegExp `.exec(...)` calls in
TypeScript source and their two generated JavaScript copies. The calls were semantically benign, but the scanner
must conservatively prohibit their syntax because it cannot safely distinguish them from arbitrary member
execution. The legitimate sources were therefore rewritten rather than exempted.

The first remediation made the scanner import-safe and exempted member `.exec(...)` calls so RegExp syntax could
pass. A fresh independent review found one Important blocker and no other findings: the exemption also allowed
arbitrary `cp.exec(untrustedSource)` and `runner.exec(acquiredSource)` calls. That review did not approve the patch.

Round 2 restored the conservative `/\bexec\s*\(/` prohibition. The two legitimate anchored RegExp parsers were
converted to the repository's existing `matchAll(...).next().value` pattern; plain `.match(...)` was not retained
because the unchanged `@typescript-eslint/prefer-regexp-exec` rule rejects it. No scanner or ESLint rule was
weakened and no suppression was added.

TDD evidence was explicit. The round-2 focused RED run discovered seven scanner tests: five failed for `cp.exec`,
`runner.exec`, RegExp `.exec` under the conservative policy, and both CommonJS child-process alias forms; the two
pre-existing direct/import checks passed. After the fix, the focused suite passed 7/7, all 148 unit tests passed,
and the standalone scanner found zero prohibited acquired-source execution paths across source and generated
package JavaScript.

### PostgreSQL assertion boundary

The first Docker-backed Task 3 rerun exposed three raw test assertions that declared PostgreSQL `BIGINT`
`record_version` values as JavaScript numbers. The migration intentionally uses `bigint`, and `pg` returns those
values as strings. The test boundary now declares them as strings and converts with `Number(...)`, matching the
existing adapter and neighboring test pattern. No command plan, projector, concurrency, or persistence behavior
was changed. The complete 29-test Task 3 suite then passed.

### Authority lineage

Only the active goal line of
`docs/superpowers/plans/2026-08-15-m02-thirteenth-remediation.md` was corrected from the historical thirteenth
hash to the approved fourteenth-amended substantive hash. Explicit historical lineage remains unchanged.

### Canonical F36–F42 fixture closure

A final whole-M02 independent review found one Important blocker and no other findings: the fixture manifest and
its validation stopped at F35 even though specification Section 20, AC-22, and the active Task 5 plan require the
canonical F36–F42 inventory. The reports also mislabeled the old F01–F35 manifest hash as F01–F42 evidence.

Strict TDD reproduced the defect before implementation. The focused manifest test was first extended to require
exactly F01–F42 and explicit direct PostgreSQL evidence bindings. That RED run failed both discovered tests: the
manifest contained 35 rather than 42 scenarios, and its evidence inventory stopped at F35. No production
behavior was changed.

The first F36–F42 closure was structurally complete but a fresh whole-patch review found that its executable
comparisons were self-confirming: static registries and labels could satisfy the manifest without proving that
every contributing PostgreSQL case executed. Receipt remediation began RED. The focused manifest test rejected
the old non-receipt F36 record, and a selected human PostgreSQL body passed while its `afterAll` failed with
`EXECUTED_RECEIPTS_MISSING:F36`, proving skipped contributors cannot finalize.

`m02-executed-receipts.ts` now owns a closed predicate matrix, rejects unknown/duplicate/missing predicates,
canonicalizes immutable JSON receipts, and emits only digest/byte-count evidence. F36–F41 collectors are populated
after the applicable human assertions and SQL queries succeed; F42 is populated after all 22 system modes and the
replay/rollback/rejection SQL predicates succeed. Final `afterAll` aggregation requires every exact mode and every
predicate, then compares all manifest `fingerprints`, `records`, `decision`, and `auditStates` fields. Static
registries define vocabulary/order only and never count as execution.

The first deterministic rerun correctly exposed volatile server IDs, timestamps, and generated-ID ordering in
raw receipt payloads. Those values were not accepted into the manifest. Receipts now retain deterministic facts
derived from completed execution: exact committed mode IDs; typed row/result equality and postcondition booleans;
table/state/cardinality summaries; canonical-sorted audit action/subject/before-after facts; topology/replacement
mapping summaries; guard bytes and server-ID-independence predicates; and system operation/Decision-child/result/
audit/handoff counts. The final fresh-container reruns matched the canonical manifest at 29/29 and 65/65.

## 6. Implementation summary

- Deterministic classification, parser-profile, root ownership, evidence, and fingerprint behavior remains
  offline and fail closed.
- Stable Resource/ResourceVersion identity, duplicate/fork/mirror relationships, correction/supersession, manual
  resolution, job aggregation/replacement, and bounded provider-neutral analysis remain within M02.
- The human PostgreSQL adapter projects all 256 modes into canonical typed tables within bounded Serializable
  transactions, with immutable request/expectation evidence, ordered lifecycle-stable guards, replay, rollback,
  concurrency, result, and audit coverage.
- The system PostgreSQL adapter projects the exact 22 closed modes with origin-separated immutable operations,
  accepted/rejected results, typed Decision child rows, replay ordering, rollback, guards, and human precedence.
- The deterministic fixture manifest contains exactly F01–F42. F36–F41 compare canonical expected evidence to
  complete executed human PostgreSQL receipt matrices, and F42 compares it to the complete executed system
  PostgreSQL receipt matrix.
- `m02_command_domain_records` remains only non-authoritative compatibility storage. Runtime adapter source has no
  reference to it, and exhaustive human integration assertions require its row count to remain zero.
- No descriptive summary or M03 handoff consumer executes before identity resolution.

## 7. File inventory

The whole M02 patch contains 12 tracked modifications and 56 untracked files. Task 5 itself changed the eight
named ESLint files, `scripts/check-source-safety.mjs`, new
`scripts/check-source-safety.unit.test.mjs`, `vitest.unit.config.ts`, the canonical fixture manifest, its fixture
validator, new fail-closed receipt collector, both direct PostgreSQL evidence suites, the active Task 5 plan, and
this report.

The broader preserved M02 patch includes:

- Governance/docs: `.prettierignore`, `README.md`, `docs/milestones/M02_SPEC.md`, this report, and the checked-in
  implementation plan.
- Contracts/fixtures: M02 contracts/tests and the F01–F42 fixture manifest.
- Packages: new `analysis`, `classification`, and `identity` packages plus M02 extensions to `job-queue` and
  `testing`.
- Persistence: migration 002, human command plan/projectors/typed state, PostgreSQL human adapter, and PostgreSQL
  system adapter.
- Verification tooling: dependency-boundary registration and the source-safety scanner regression suite.
- Removed files: none.

## 8. Acceptance-criteria traceability

| Criteria    | Implementation/evidence                                                                                              | Task 5 result                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AC-01–AC-04 | classifier, parser profile, roots/ownership, fingerprints; unit/fixture/adversarial suites                           | PASS                                      |
| AC-05–AC-09 | stable identity/version and duplicate/fork/mirror registries; unit/contract/integration suites                       | PASS                                      |
| AC-10–AC-15 | typed correction/topology/manual-command/job/handoff projectors; F36–F41 manifest receipts; 256-mode Task 3 suite    | PASS                                      |
| AC-16–AC-17 | bounded provider-neutral analysis request/response, evidence and hard-limit contracts                                | PASS                                      |
| AC-18       | forward-only migration, typed constraints, guards, rollback/replay/concurrency; migration plus both projector suites | PASS                                      |
| AC-19       | whole-discovery unit/contract and four-file integration runs include M00/M01 regression evidence                     | PASS                                      |
| AC-20       | approved substantive hash and current whole-file hash distinguished; active plan/report lineage corrected            | PASS                                      |
| AC-21       | source safety, dependencies, secrets, skipped-test, generic-ledger, future-ID and M03-scope scans                    | PASS                                      |
| AC-22       | F41/F42 manifest receipts plus every required local Task 5/Section 23 command; fresh review remains the next gate    | PASS locally; independent review required |

## 9. Verification evidence

All commands ran from the repository root with pinned Node 22.23.1 and pnpm 11.7.0.

| Command                                            | Actual result                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm exec eslint .`                               | PASS; 0 errors, 0 warnings                                                           |
| `pnpm lint`                                        | PASS; ESLint green, 11 packages boundary-valid, zero prohibited source paths         |
| `pnpm lint:boundaries`                             | PASS; 11 M00–M02 packages valid                                                      |
| `pnpm lint:source-safety`                          | PASS; no prohibited acquired-source execution paths                                  |
| focused source-safety unit test                    | RED: 5 failed/2 passed; GREEN: 7/7 passed                                            |
| focused F01–F42 manifest/receipt fixture test      | RED: old evidence rejected; GREEN: 1 file, 5/5 tests                                 |
| focused skipped-contributor human receipt          | RED as required: body passed; `afterAll` rejected missing F36 predicates             |
| `pnpm test:unit -- classification`                 | PASS; 13 files, 148 tests                                                            |
| `pnpm test:unit -- identity`                       | PASS; 13 files, 148 tests                                                            |
| `pnpm test:unit -- parser-profile`                 | PASS; 13 files, 148 tests                                                            |
| `pnpm test:unit -- fingerprints`                   | PASS; 13 files, 148 tests                                                            |
| `pnpm test:contract -- ai-analysis`                | PASS; 10 files, 108 tests                                                            |
| `pnpm test:contract -- identity-relationships`     | PASS; 10 files, 108 tests                                                            |
| `pnpm test:contract -- manual-resolution`          | PASS; 10 files, 108 tests                                                            |
| `pnpm test:contract -- migration`                  | PASS; 10 files, 108 tests                                                            |
| `pnpm test:integration -- classification-identity` | PASS; 4 files, 106 tests, 249.55s                                                    |
| `pnpm test:integration -- job-supersession`        | first 105/106 infrastructure attempt; exact rerun PASS 4 files/106 tests, 256.51s    |
| direct `m02-migration.integration.test.ts`         | PASS; 1 file, 7 tests, 11.14s                                                        |
| direct `m02-command-adapter.integration.test.ts`   | PASS; final deterministic rerun 1 file, 29 tests, 218.29s; exact 256 modes           |
| direct `m02-system-identity.integration.test.ts`   | PASS; 1 file, 65 tests, 99.98s; exact 22 modes                                       |
| `pnpm test:fixtures -- classification`             | PASS; 3 files, 19 tests                                                              |
| `pnpm test:fixtures -- identity`                   | PASS; 3 files, 19 tests                                                              |
| `pnpm test:adversarial -- classification`          | PASS; 3 files, 21 tests                                                              |
| `pnpm test:adversarial -- command-concurrency`     | PASS; 3 files, 21 tests                                                              |
| `pnpm test:adversarial -- source-safety`           | PASS; 3 files, 21 tests                                                              |
| `pnpm format:check`                                | PASS; all matched files use Prettier style                                           |
| `pnpm typecheck`                                   | PASS; 18/18 tasks                                                                    |
| `pnpm build`                                       | PASS; 11/11 tasks                                                                    |
| `pnpm verify`                                      | PASS; lint, format, 18/18 typecheck tasks, 148 unit, 108 contract, 11/11 build tasks |
| `git diff --check`                                 | PASS; no whitespace errors                                                           |
| `git diff --stat`                                  | PASS; tracked diff reported separately from 56 untracked files                       |
| `git diff --name-status`                           | PASS; 12 tracked modified files                                                      |
| `git diff main...HEAD`                             | PASS; empty because HEAD equals local `main`                                         |
| `git diff`                                         | PASS; reviewed tracked unstaged patch; untracked inventory reviewed separately       |
| `git ls-files --others --exclude-standard`         | PASS; 56 untracked files inventoried                                                 |

The two documented positional integration invocations discover the full four-file integration set; each broad
run therefore executes 106 tests rather than narrowing to a filename. Direct migration, Task 3, and Task 4
commands provide explicit per-suite counts. The first job-supersession broad attempt passed 105/106 but one nested
Testcontainers PostgreSQL instance did not bind its host port within 10 seconds. The same test had passed in the
direct 29/29 and classification-identity 106/106 runs; the unchanged exact job-supersession command then passed
106/106. Earlier receipt-normalization iterations also exposed the same Docker Desktop port-bind condition and
were never represented as product passes. These infrastructure attempts remain explicit rather than hidden.

## 10. Security, integrity, and review findings

- Exact registry inspection: 256 human modes, 256 unique IDs; 22 system modes, 22 unique IDs.
- Manifest integrity: exactly F01–F42; F36–F41 and F42 are consumed only after their complete executed PostgreSQL
  receipt matrices finalize, including canonical evidence fingerprints.
- Source safety: direct and arbitrary member `.exec(...)`, including CommonJS child-process aliases, plus
  child-process imports, dynamic import, spawn, package installation, checkout, container-socket, and related
  acquired-source execution patterns remain prohibited.
- Secret scan: zero AWS/GitHub/OpenAI-like token or private-key pattern hits outside dependencies/build output.
- Skipped-test scan: zero `.skip`, `.skipIf`, `describe.skip`, `it.skip`, `test.skip`, or `todo` hits in packages,
  scripts, and fixtures outside build output.
- Generic-ledger scan: references occur only in the migration's explicitly non-authoritative compatibility table
  and tests that require zero runtime rows; neither runtime adapter reads or writes it.
- Future-ID guard scan and exhaustive F41/Task 3/Task 4 tests retain lifecycle-stable guard anchors and reject
  future-ID authority.
- M03 scope scan found only hostile-input/authority-rejection fixtures and tests; implemented package inventory is
  limited to the 11 M00–M02 packages.
- No blanket ignore, lint suppression, dependency/runtime upgrade, source execution, or unrelated refactor was
  introduced by Task 5.

## 11. Hashes

- Approved M02 substantive specification:
  `4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27`.
- Current M02 specification whole file:
  `331b85c0114f7e81749612be93f4f62d3be86bde37cb134c3c48f5dedb4b30d2`.
- Migration 002:
  `310c6761eb9ac94bcdac03e395a3abbe27a711a6570ffc0839b44b8300563c64`.
- F01–F42 fixture manifest:
  `76692378c9a52059c76ee3f541b28fedd5291301c97ca9636d0872a167f4c775`.
- Source-safety scanner:
  `83e9f8f1823d27260625b4870d9b2f06301a7d877cf4744635cd13fa51dec4dd`.

## 12. Risks, evidence limits, and next gate

- The PostgreSQL suites emit a known non-failing `pg@8` deprecation warning when a test deliberately overlaps
  `client.query()` calls to exercise concurrency. It does not fail the suites. Dependency upgrades are outside
  Task 5 and were not performed.
- Transient Testcontainers host-port timeouts occurred during receipt iteration and the first job-supersession
  broad attempt; final fresh-container direct suites and the unchanged broad rerun passed.
- PostgreSQL evidence uses ephemeral local PostgreSQL 17.6 containers. AI evidence uses deterministic offline
  fakes. No live GitHub, production database/object store, OIDC, AI-provider quality, real-user, accessibility,
  deployment, or remote-CI evidence is claimed.
- No remote/upstream, CODEOWNERS, branch protection, or remote CI state exists in this checkout.
- The worktree is intentionally unstaged and uncommitted. The next gate is a fresh genuinely independent,
  read-only whole-patch re-review over tracked and untracked files. Commit readiness cannot be claimed before
  that re-review.

## 13. Authorization and manual actions

No manual external action is required to complete Task 5. The required next action is a separately conducted
fresh independent re-review. Commit, staging, push, PR, merge, deployment, publication, release, and M03 work
remain unauthorized and unperformed.
