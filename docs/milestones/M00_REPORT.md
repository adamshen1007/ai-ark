# AI ARK Technical Alpha M00 report

## 1. Decision

`GO`

The M00 implementation, prescribed technical gates, and documentation-integrity remediation pass. The four authority documents processed by the original Prettier run were restored from supplied pre-M00 source copies and independently verified byte-for-byte. Permanent formatter exclusions protect the complete pre-existing authority set. Detailed evidence is recorded in `M00_DOCUMENTATION_INTEGRITY_REMEDIATION_REPORT.md`.

## 2. Repository state

- Repository: `<repository-root>`
- Branch: `main` (unborn)
- HEAD/base/upstream: none; repository began without Git metadata and has no commits or remotes
- Starting implementation: product/specification Markdown only; no manifest, lockfile, source, tests, CI, or agent instructions
- Ending state: M00 files and all pre-existing files are untracked because no initial commit exists
- Staged state: `.git/index` absent; nothing staged
- Commit/push/tag/merge/release/deployment: none

## 3. Scope completed

- Exact Node `22.23.1` and pnpm `11.7.0` policy, frozen lockfile, workspace, and orchestration
- Strict TypeScript, ESLint, Prettier, Vitest, dependency enforcement, source-safety scanner, and CI
- Versioned canonical enums/primitives, provider-neutral ports, result/error contracts, and schema policy
- Environment validation/redaction and deterministic shared test infrastructure
- Required architecture, operations, validation, governance, milestone, and ADR documents

Excluded later-milestone features, external providers, public publication, release, and deployment remain unimplemented.

## 4. Files

### Added

- Root governance/tooling: `README.md`, `AGENTS.md`, `CHANGELOG.md`, runtime pins, package/workspace/TypeScript/Turbo/ESLint/Prettier/Vitest configuration, lockfile, scripts, and CI
- Packages: `packages/contracts`, `packages/config`, `packages/testing`
- Fixtures: one M00 loader smoke fixture plus reserved fixture directories
- Documentation: required architecture/operations/validation files, 12 ADRs, governance policies, inventory, traceability, deferred-scope register, and M00 spec/report

### Documentation-integrity incident and remediation

Recovery provenance and the preserved formatter-output set establish that the following four pre-existing files were processed by Prettier before exclusion rules were corrected:

- `docs/product/AI ARK GitHub-to-Skill Technical Alpha PRD v1.0.md`
- `docs/architecture/AI ARK Technical Alpha Architecture v1.0.md`
- `docs/execution/AI ARK Technical Alpha Codex Execution Prompt v1.0.md`
- `docs/validation/AI ARK Prototype Review Report v1.0.md`

The earlier report incorrectly substituted the Prototype Review and Usability Test Plan and the Validation and Analytics Plan for the Technical Alpha PRD and Codex Execution Prompt. The corrected four-file set matches both the recovery provenance and the preserved formatter-output evidence.

All four repository copies now match their supplied originals with `cmp=0` and identical SHA-256 values. All 23 pre-existing authority documents resolve as ignored by Prettier and remained byte-identical through formatter check mode. No other pre-existing authority document was rewritten. See the remediation report for hashes and command evidence.

### Deleted

None.

## 5. Architecture and invariants

- Dependency direction is executable and passes for all three M00 packages.
- Source quarantine/no-execution and human-only publication boundaries are documented in ADRs and architecture policy.
- Provider ports do not expose GitHub or AI vendor SDK types.
- M00 introduces no feature package, publication path, provider call, or live-service gate.
- The pre-existing-document preservation deviation is resolved by the recorded byte-for-byte remediation evidence.

## 6. Verification

| Command                          | Result | Evidence                                                 |
| -------------------------------- | ------ | -------------------------------------------------------- |
| `corepack enable`                | PASS   | enabled inside temporary official Node 22 runtime        |
| `pnpm install --frozen-lockfile` | PASS   | Node 22.23.1 / pnpm 11.7.0; lockfile unchanged           |
| `pnpm lint`                      | PASS   | ESLint, 3-package dependency policy, source-safety scan  |
| `pnpm format:check`              | PASS   | all matched M00 files formatted; authority docs excluded |
| `pnpm typecheck`                 | PASS   | 3 packages, strict TypeScript                            |
| `pnpm test:unit`                 | PASS   | 3 files, 10 tests, 0 failures                            |
| `pnpm test:contract`             | PASS   | 2 files, 2 tests, 0 failures                             |
| `pnpm test`                      | PASS   | 5 files, 12 tests, 0 failures                            |
| `pnpm build`                     | PASS   | 3 packages                                               |
| `pnpm verify`                    | PASS   | exact Node 22.23.1; complete M00 consolidated gate       |
| `git diff --check`               | PASS   | no tracked diff exists because branch is unborn          |
| staged-state check               | PASS   | `.git/index` absent                                      |
| documentation-integrity audit    | PASS   | 4 source matches; all 23 authority files ignored/stable  |

No tests were skipped. Later milestone test classes intentionally contain no feature tests and are not part of the M00 verification claim.

## 7. Acceptance criteria

All explicit M00 acceptance criteria pass: deterministic frozen install, root commands, strict TypeScript, dependency enforcement, documentation/ADRs, offline CI, package direction, initial test suite, and prohibited Git/deployment actions.

The higher-level preservation rule now passes: the four restored authority documents match supplied originals byte-for-byte, the complete authority set is protected from automatic formatting, and no other unintended authority-document change remains.

## 8. Risks and open issues

- Non-blocking: PostgreSQL harness is present but intentionally not started in M00 unit/contract gates; later integration tests require a container runtime.
- Deferred: all M01–M09 functionality and external validation.

## 9. Next milestone readiness

M00 is `GO`. M01 was not authorized by the remediation request and was not started.
