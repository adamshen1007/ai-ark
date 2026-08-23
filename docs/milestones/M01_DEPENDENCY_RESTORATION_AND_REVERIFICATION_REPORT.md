# M01 — Dependency restoration and re-verification report

## 1. Starting dependency state

- Repository: `<repository-root>`
- Branch: `codex/milestone-01`
- HEAD and merge base with `main`: `ca522ff91cf1a1ce0b611eaf53ab1992bbc87147`
- Required runtime: Node `22.23.1`, pnpm `11.7.0`
- pnpm store: `<repository-root>/.pnpm-store/v11`
- Starting condition: the workspace links were incomplete and the local store could not satisfy an offline frozen installation because the exact `eslint@10.8.0` package archive was unavailable.
- Starting staged diff: empty. The existing unstaged/untracked diff was the M01 implementation.

## 2. Narrow network authorization used

Network authorization was used only for the frozen-lockfile dependency restoration permitted by the task. No live GitHub repository was contacted. No dependency was added, removed, upgraded, or downgraded. pnpm reported 306 packages reused and zero packages downloaded during the successful restoration, so no individual new artifact download was reported.

## 3. Exact restoration commands

The controlled sequence was:

```text
corepack enable
pnpm fetch --frozen-lockfile
CI=true pnpm install --offline --frozen-lockfile --ignore-scripts
CI=true pnpm install --frozen-lockfile --ignore-scripts
```

`pnpm fetch --frozen-lockfile` completed with the pinned store. The offline install then proved the exact missing `eslint@10.8.0` archive. The authorized fallback frozen install completed the workspace relink with `--ignore-scripts`; it reported 306 reused, zero downloaded, and no resolution outside `pnpm-lock.yaml`.

## 4. Downloaded dependencies

The successful pnpm operations reported `reused 306, downloaded 0`. Dependency identities and versions came exclusively from the unchanged lockfile. No unpinned or `latest` resolution, `pnpm add`, `pnpm update`, npm, or Yarn command was used.

## 5. Lifecycle-script status

No dependency lifecycle script ran. Both install attempts used `--ignore-scripts`. No omitted lifecycle script was needed by the verification suite.

## 6. Package-manifest and lockfile integrity

The pre- and post-restoration hashes are identical:

| File                  | SHA-256 before and after                                           |
| --------------------- | ------------------------------------------------------------------ |
| `package.json`        | `052043108cb4a71d24b97493c2e2c0c821f302c1445c935bee26f31deb6a7007` |
| `pnpm-lock.yaml`      | `84fd3cfbd466bc7d673b2230291eb6728da02124fb04231b37bdf48aa658787b` |
| `pnpm-workspace.yaml` | `b64508af05d310c84e850fdc9d0d6fab63226e5aaa4785c8204a7f8f18ea8b49` |

`git diff -- package.json pnpm-lock.yaml pnpm-workspace.yaml` contains only the intended pre-existing M01 workspace-importer lockfile diff against the M00 baseline; the restoration itself changed none of these files.

## 7. Every verification command and result

All pnpm commands below ran with Node `22.23.1` and pnpm `11.7.0`.

| Exact command                                  | Result | Relevant output                                      |
| ---------------------------------------------- | ------ | ---------------------------------------------------- |
| `pnpm test:unit -- acquisition`                | PASS   | 7 files, 52 tests, 0 skipped                         |
| `pnpm test:contract -- source-provider`        | PASS   | 5 files, 14 tests, 0 skipped                         |
| `pnpm test:integration -- github-acquisition`  | PASS   | 1 file, 5 tests, 0 skipped                           |
| `pnpm test:fixtures -- repository-safety`      | PASS   | 1 file, 1 test, 0 skipped                            |
| `pnpm test:adversarial -- source-safety`       | PASS   | 1 file, 1 test, 0 skipped                            |
| `pnpm lint`                                    | PASS   | ESLint, dependency boundaries, source safety         |
| `pnpm format:check`                            | PASS   | all matched files use Prettier style                 |
| `pnpm typecheck`                               | PASS   | 13 tasks across 8 packages                           |
| `pnpm build`                                   | PASS   | 8 of 8 package builds                                |
| `pnpm verify`                                  | PASS   | lint, format, typecheck, 52 unit, 14 contract, build |
| `git diff --check`                             | PASS   | no whitespace errors                                 |
| `node scripts/check-dependency-boundaries.mjs` | PASS   | 8 M00–M01 packages                                   |
| `node scripts/check-source-safety.mjs`         | PASS   | no prohibited acquired-source execution path         |
| `pnpm test:contract -- migration`              | PASS   | 5 files, 14 tests, 0 skipped; migration included     |
| JSON parse validation                          | PASS   | 32 repository JSON files parsed                      |
| `git status --short`                           | PASS   | intended unstaged/untracked M01 work only            |

The final `pnpm verify` reported 7/7 unit files with 52/52 tests, 5/5 contract files with 14/14 tests, 13/13 typecheck tasks, and 8/8 builds. No test was skipped.

## 8. Test counts

The five required targeted commands executed 15 test-file runs and 73 test runs in total: 52 unit, 14 contract, 5 integration, 1 fixture, and 1 adversarial test. The totals count files/tests each time their required command ran; zero were skipped.

## 9. Authority-document integrity

At the M01 reverification point, the four restored authority files were byte-identical to their supplied originals:

| Authority file                                                         | `cmp` | SHA-256                                                            |
| ---------------------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `docs/product/AI ARK GitHub-to-Skill Technical Alpha PRD v1.0.md`      |     0 | `e0749f673d4f55fa9f1ba8b5d184019970cf4512a05d9aaff76509dfc229bb42` |
| `docs/architecture/AI ARK Technical Alpha Architecture v1.0.md`        |     0 | `da50cdb280073c02ab588ddb88778c37084890e03d6a97f775f362069da505e7` |
| `docs/execution/AI ARK Technical Alpha Codex Execution Prompt v1.0.md` |     0 | `d546c2a431ac43eba411faacef6eb32adae00a9b43456ff0fcdfd8a14f9f104a` |
| `docs/validation/AI ARK Prototype Review Report v1.0.md`               |     0 | `2226f5220c6956dff1d0743b04e5561ed13a8d9b3266589a53f3f5c86453da14` |

Each repository/source pair had the same hash at that verification point. The later authorized public-history
sanitization replaced one local absolute path in the Prototype Review Report; its current sanitized SHA-256 is
`56ae3b2712d2409f1549552efefd4fc876f9307ec98dd81702ea9d9d8ffd09af`, while the table preserves the historical
pre-sanitization hash. Prettier `--file-info` returned `"ignored": true` for all 23 pre-existing authority documents.

## 10. Independent review findings

The review covered URL and redirect validation, immutable SHA binding, provider neutrality, path collisions/traversal, link/submodule quarantine, byte/file/line/encoding limits, content addressing, hash checks, job retries/idempotency/cancellation/operator review, partial results, telemetry redaction, source non-execution, M02 exclusion, all changed files, and the complete worktree diff.

Blocking/high findings were resolved: strict canonical URL parsing, asynchronous validation semantics, repository identity revalidation, executable-mode handling, deterministic priority ordering, invalid-size quarantine, partial-state persistence, retry-stage correctness, telemetry isolation/redaction, storage byte ownership, and durable schema constraints. No blocking or high-severity finding remains.

A separate pre-commit review found four further high-severity baseline defects. Remediation now skips provider-declared oversized files before fetch, brackets immutable-commit and other name-addressed evidence operations with repository-identity checks, preserves concurrent durable cancellation against stale worker saves, and removes request-specific source-reference identity from canonical snapshots. The focused re-review and negative tests found no residual high-severity gap.

## 11. Remediation completed

- Corrected provider and object-storage contract behavior, deterministic entry selection, and fixture assumptions.
- Added Node typing and a dedicated ESLint TypeScript project so lint works from a clean build state.
- Added source aliases to the integration configuration.
- Strengthened acquisition state persistence, retries, telemetry, URL/path/content safety, GitHub entry metadata, S3-compatible copying, and PostgreSQL constraints.
- Added pre-fetch per-file enforcement, repository-identity drift checks, durable cancellation fences, and internally consistent cross-job snapshot reuse.
- Added or corrected negative, contract, migration, integration, partial-result, retry, executable, invalid-size, priority, and telemetry tests.
- Re-ran affected suites and the complete verification gate.

## 12. Residual risks

- The GitHub adapter is verified through an injected offline transport; any live-provider profile requires separate authorization.
- PostgreSQL DDL is contract-tested, while deterministic required gates use the in-memory job-store adapter.
- Optional duration and provider-rate-limit telemetry fields are defined but not yet populated by the acquisition orchestrator.
- The strict repository-name validator does not yet admit a leading-dot GitHub repository such as `.github`.
- Source-selection policy limits may need evidence-led tuning; any widening must be explicit and versioned.

These are planned integration risks, not unresolved M01 blocking/high defects.

## 13. Decision recommendation

`GO`. Exact pinned dependencies are restored, declarations and lockfile hashes are unchanged from the pre-restoration state, no lifecycle script ran, every required verification command passes, authority integrity is intact, the diff is M01-only, and independent review has no unresolved blocking/high finding. This decision closes M01 only; it does not authorize M02.
