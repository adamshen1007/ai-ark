# M01 — GitHub Acquisition Foundation report

## 1. Decision

`GO`

M01 meets its acceptance criteria. Exact lockfile-pinned dependencies were restored without changing dependency declarations or running lifecycle scripts; all required offline verification passes; the authority documents remain byte-identical and formatter-excluded; the complete diff is M01-only; and independent review has no unresolved blocking or high-severity finding.

## 2. Repository state

- Root: `<repository-root>`
- Branch: `codex/milestone-01`
- HEAD: `ca522ff91cf1a1ce0b611eaf53ab1992bbc87147`
- Merge base with `main`: `ca522ff91cf1a1ce0b611eaf53ab1992bbc87147`
- Staged state: empty
- Commit state: unchanged from the M00 baseline; all M01 work is unstaged and uncommitted
- Worktree: intended M01 modified/untracked files only; no deleted file and no M02 implementation
- Remote/deployment state: no push, tag, merge, release, deployment, or live GitHub acquisition

## 3. Scope completed

| M01 requirement              | Implementation evidence                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL validation               | Strict HTTPS GitHub repository-root validation, canonicalization, deceptive-host/credential/port/path rejection, and identity-preserving redirect checks                                    |
| Provider-neutral acquisition | Inward-owned source-provider contracts and an injected read-only GitHub transport with immutable commit-SHA binding                                                                         |
| Inventory and safety         | Deterministic priority/order, path normalization/collision controls, symlink/submodule quarantine, bounded file/byte/line/encoding policy, and executable/archive/binary/encrypted controls |
| Immutable evidence           | Provider/repository/SHA/policy snapshot identity, verified SHA-256 object keys, immutable storage behavior, and defensive byte copies                                                       |
| Durable jobs                 | M01-only stages, PostgreSQL schema/constraints, retries, cancellation, operator review, idempotency, partial results, and deterministic adapter semantics                                   |
| Observability                | Bounded identifiers/counts/failure codes with secret/source-body redaction and telemetry-failure isolation                                                                                  |
| Security boundary            | Offline negative/fixture/adversarial coverage and static prohibition of checkout, source execution, dynamic loads, package installation, AI, or publication paths                           |

## 4. Dependency restoration

The authorized controlled commands were `corepack enable`, `pnpm fetch --frozen-lockfile`, `CI=true pnpm install --offline --frozen-lockfile --ignore-scripts`, and—after the offline command identified the unavailable pinned `eslint@10.8.0` archive—`CI=true pnpm install --frozen-lockfile --ignore-scripts`. The successful operation reported 306 reused and zero downloaded. No lifecycle script ran.

Pre/post SHA-256 values are unchanged: `package.json` `052043…a7007`, `pnpm-lock.yaml` `84fd3c…787b`, and `pnpm-workspace.yaml` `b64508…a8b49`. Full evidence is in `M01_DEPENDENCY_RESTORATION_AND_REVERIFICATION_REPORT.md`.

## 5. Verification

All pnpm commands used Node `22.23.1` and pnpm `11.7.0`.

| Exact command                                  | Result | Counts/output                                        |
| ---------------------------------------------- | ------ | ---------------------------------------------------- |
| `pnpm test:unit -- acquisition`                | PASS   | 7 files, 52 tests, 0 skipped                         |
| `pnpm test:contract -- source-provider`        | PASS   | 5 files, 14 tests, 0 skipped                         |
| `pnpm test:integration -- github-acquisition`  | PASS   | 1 file, 5 tests, 0 skipped                           |
| `pnpm test:fixtures -- repository-safety`      | PASS   | 1 file, 1 test, 0 skipped                            |
| `pnpm test:adversarial -- source-safety`       | PASS   | 1 file, 1 test, 0 skipped                            |
| `pnpm lint`                                    | PASS   | ESLint plus both repository scanners                 |
| `pnpm format:check`                            | PASS   | all matched files formatted                          |
| `pnpm typecheck`                               | PASS   | 13/13 tasks across 8 packages                        |
| `pnpm build`                                   | PASS   | 8/8 package builds                                   |
| `pnpm verify`                                  | PASS   | lint, format, typecheck, 52 unit, 14 contract, build |
| `git diff --check`                             | PASS   | no whitespace errors                                 |
| `node scripts/check-dependency-boundaries.mjs` | PASS   | 8 M00–M01 packages                                   |
| `node scripts/check-source-safety.mjs`         | PASS   | no prohibited path found                             |
| `pnpm test:contract -- migration`              | PASS   | migration contract included; 5 files/14 tests        |
| JSON validation                                | PASS   | 32 repository JSON files parsed                      |

No test was skipped.

## 6. Acceptance matrix

| Criterion                                                               | Result |
| ----------------------------------------------------------------------- | ------ |
| Repository-root URLs normalize deterministically; deceptive inputs fail | PASS   |
| Public identity resolves to provider ID and immutable 40-character SHA  | PASS   |
| Metadata, signals, inventory, and bytes cross a provider-neutral port   | PASS   |
| Unsafe paths and bytes receive deterministic non-acquired dispositions  | PASS   |
| Selected content has verified SHA-256 and stable object keys            | PASS   |
| Retries and duplicates do not duplicate snapshots or objects            | PASS   |
| Cancellation, partial results, and operator review are durable          | PASS   |
| Telemetry excludes credentials and source bodies                        | PASS   |
| Required M01 tests and M00 regression gates pass offline                | PASS   |
| Authority documents remain byte-identical and formatter-excluded        | PASS   |
| Diff is M01-only and prohibited Git/deployment actions did not occur    | PASS   |

## 7. Authority integrity

The PRD, architecture, execution prompt, and prototype-review report each return `cmp=0` against the supplied `<supplied-originals-directory>` original. Their respective SHA-256 values are `e0749f…bb42`, `da50cd…05e7`, `d546c2…104a`, and `2226f5…da14` for both copies. Prettier reports `ignored: true` for all 23 authority documents. Their Git diff is empty.

## 8. Independent review and remediation

The full worktree was reviewed for URL/redirect identity, immutable revisions, provider neutrality, path/content attacks and limits, link/submodule handling, content addressing/hash verification, retry/idempotency/cancellation/operator review, partial results, telemetry redaction/isolation, no checkout/source execution, M02 exclusion, and every modified/untracked file.

Verification and review findings were remediated within M01: deterministic contract-test assumptions; Promise rejection semantics; TypeScript/ESLint source-project resolution; strict URL and repository identity checks; executable modes and invalid sizes; relevant-file priority; retry/stage deduplication; early partial-state persistence; telemetry wiring/failure isolation; defensive storage copies; and PostgreSQL constraints. Regression and negative tests cover the changes. No blocking or high-severity issue remains.

The independent pre-commit review additionally found and closed four high-severity baseline defects: provider-declared oversized files are now skipped before fetch; repository identity is revalidated around immutable-commit binding and later name-addressed evidence operations; durable cancellation is checked at work boundaries and cannot be overwritten by stale saves; and canonical snapshots no longer embed a request-specific source-reference ID. Focused negative tests and the complete verification gate pass after these changes.

## 9. Architecture and safety conclusion

Dependency direction remains `apps → application modules → domain contracts → shared primitives`. Contracts own the provider, object-storage, job-store, and telemetry boundaries. Acquired repository content stays inert and bounded; no checkout, dependency installation, hook, interpreter, child-process, dynamic-import, container, AI, editorial, publication, or directory implementation is present.

## 10. Residual risks

Live-provider validation remains separately authorized work. PostgreSQL DDL is contract-tested while deterministic gates use the in-memory adapter. Optional duration and provider-rate-limit telemetry fields are defined but not yet populated by the acquisition orchestrator. The strict repository-name validator does not yet admit a leading-dot GitHub repository such as `.github`. Policy thresholds may later require evidence-led, versioned tuning. None is an unresolved M01 blocker or high-severity finding.

## 11. M02 readiness

M01 is technically ready to hand off, but this task does not begin or authorize M02. M02 may begin only under a separate explicit instruction and its own governing scope.

## 12. Git and deployment confirmation

Nothing was staged, committed, pushed, tagged, merged, released, or deployed. No live GitHub source was acquired. M02 was not implemented.
