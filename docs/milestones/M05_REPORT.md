# M05 implementation report

Date: 2026-11-02. Decision: **GO — M05 COMMIT READY** for exact local Candidate 06 only.

## Candidate 06 — frozen for verification

Candidate 06 contains 305 files, excluding only this report, at digest `dcf74189547dad9c3d1ef5c07f4337fedefedc7f2618470232731f58b42bf3f8`. Inventory: `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9/candidate-06.json`. Only the concurrency integration test and a narrow AGENTS testing rule changed from Candidate 05. Application code, SQL, authority, timeouts and publication state are unchanged. Both contenders establish SERIALIZABLE snapshots before an ordered barrier admits the designated first lock to acquisition, then submits the waiter. Both output-selection orders and both different-generation same-key orders retain actual PostgreSQL `40001`, exact winner and durable row-closure assertions. Full concurrency file passed twice before freeze: 12/12 in 106.02 and 105.21 seconds (`c05-concurrency-barrier-rerun1.log`, `c05-concurrency-barrier-rerun2.log`). These are targeted evidence, not final GO. All twelve authorities, four predecessor migration/manifest files, patch whitespace and relative links passed audit. The completed independent review and full `f06-` receipts follow.

Independent Candidate 06 R2 recheck confirmed the exact manifest, both stale snapshots, deterministic lock admission, actual rather than synthetic `40001`, both output-selection orders and both same-key generation orders. It found no material issue and confirmed the tests were strengthened. The reviewer inspected the two targeted reruns but did not execute them. This code verdict is separate from the final gate decision.

### Candidate 06 full-gate receipts

All receipts use pinned Node 22.23.1 / pnpm 11.7.0 and compare source identity before and after. Logs and JSON receipts are retained in the evidence directory above.

| Exact command                                                                                                                                                                                                                                         | Actual result                                          | Receipt                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                                                                                                                                      | PASS; 0.58 seconds; unchanged                          | `f06-install.json`                                    |
| `pnpm verify`                                                                                                                                                                                                                                         | PASS; 41.79 seconds; unchanged                         | `f06-verify.json`                                     |
| `pnpm test:fixtures`                                                                                                                                                                                                                                  | PASS; 46.70 seconds; unchanged                         | `f06-fixtures.json`                                   |
| `pnpm test:adversarial`                                                                                                                                                                                                                               | PASS; 24.78 seconds; unchanged                         | `f06-adversarial.json`                                |
| `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m05-draft-persistence.integration.test.ts packages/testing/src/m05-draft-concurrency.integration.test.ts packages/testing/src/m05-draft-maximum.integration.test.ts` | PASS; 3 files / 19 tests; 397.40 seconds; unchanged    | `f06-m05-integration.json`                            |
| `pnpm test:integration`                                                                                                                                                                                                                               | PASS; 15 files / 383 tests; 7683.56 seconds; unchanged | `f06-integration.json`                                |
| `pnpm test`                                                                                                                                                                                                                                           | PASS; 66 files / 988 tests; 6842.84 seconds; unchanged | `f06-test.json`                                       |
| Source-only `pnpm install --frozen-lockfile` and `pnpm verify`                                                                                                                                                                                        | PASS; 2.78 and 80.59 seconds; clean rebuild; unchanged | `source-only-install.json`, `source-only-verify.json` |

## Final closeout

The independent R2 reviewer returned **GO — M05 COMMIT READY** on the same 305-file digest after inspecting the frozen receipts, checking for skipped or failed tests, and independently executing the authority and patch audits. The coordinator executed the gate chain; the reviewer did not independently rerun the tests. No material finding or unmet acceptance criterion remained. Candidate 01–05 failures and intermediate results below are historical, not evidence transferred to Candidate 06.

M05 generates internal, unapproved draft revisions from verified M04 evidence, with deterministic rendering, constrained AI selection, immutable PostgreSQL projection and replay. Source-only verification rebuilt all 14 packages without existing build artifacts. Unit 202, contracts 193, fixtures 61, adversarial 149, exact M05 integration 19, unfiltered integration 383, aggregate 988. These suites overlap; counts are not additive.

### Specification §14 evidence index

| Row | Named executed examples                                                                                                                                                                                                                        | Frozen receipt                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | renders the complete deterministic fixture with fourteen unapproved attributable sections; preserves multiple installation paths as separately grouped mandatory atoms                                                                         | f06-adversarial.json                           |
| 2   | preserves M04 progression blockers with zero provider calls and writes; records optional unresolved atoms without inventing maintenance facts                                                                                                  | f06-adversarial.json                           |
| 3   | maps every selected pointer to its exact claim class, status, qualifier, and evidence closure; renders every typed identity qualifier and both taxonomy union arms                                                                             | f06-adversarial.json                           |
| 4   | copies the verified source before an external caller can mutate it; rejects coherent orphan input and revision commits from the actual login                                                                                                   | f06-adversarial.json; f06-m05-integration.json |
| 5   | offers no network or tool execution surface to selection-only provider composition; returns only safe failure codes without writing hostile details to console channels; times out a provider that ignores abort and ignores its late response | f06-adversarial.json                           |
| 6   | reserves the exact 12,000-scalar aggregate and omits one optional scalar without truncation; renders all fourteen sections while retaining the complete 81,920-link provenance                                                                 | f06-adversarial.json; f06-fixtures.json        |
| 7   | persists, restarts, replays, and aliases immutable canonical input; rejects a forced same-generation digest collision before adding a request association                                                                                      | f06-m05-integration.json                       |
| 8   | serializes same-key and same-generation races while preserving explicit regeneration; rolls back every write stage and bounds serialization and deadlock retries                                                                               | f06-m05-integration.json                       |
| 9   | persists, restarts, replays, and aliases immutable canonical input (actual LOGIN and catalog checks); predecessor authority and migration-runner files ran unfiltered                                                                          | f06-m05-integration.json; f06-integration.json |
| 10  | restores a database backup and replays the complete maximum; migration-runner cases include during_004, ledger_004 and after_004                                                                                                               | f06-m05-integration.json; f06-integration.json |

### Final scope, limitations and publication state

Local main tracks origin/main at the M04 base; 23 tracked files modified and 22 new files, nothing staged, no files removed. Inventory includes preserved preceding governance work. Twelve approved specifications and four predecessor migration/manifest files passed integrity checks. Raw tracked, staged and new-file whitespace checks, 24 relative link targets and a bounded credential-pattern scan passed. The scan is not a comprehensive secret detector. Security review covered the provider boundary, SQL authority, immutable lineage and failure leakage.

Evidence is from fakes and disposable PostgreSQL, not live providers, real users or production. Coherent rewriting by a privileged historical-data owner cannot be detected without an external trust anchor. No UI exists; no E2E/UI pass is claimed. No staging, commit, push, PR, merge, deployment, product publication, production migration or release occurred. M06 was not started. No manual action is needed to complete local verification. If Git publication is desired, the next step is separate owner authorization for the intended actions against these reviewed bytes.

### Whole-patch file inventory against local main

- `.prettierignore` (modified)
- `AGENTS.md` (modified)
- `README.md` (modified)
- `docs/architecture/ARCHITECTURE.md` (modified)
- `docs/architecture/DEPENDENCY_RULES.md` (modified)
- `docs/governance/TRACEABILITY.md` (modified)
- `docs/milestones/M04_REPORT.md` (modified)
- `packages/contracts/src/index.ts` (modified)
- `packages/job-queue/package.json` (modified)
- `packages/job-queue/src/index.ts` (modified)
- `packages/job-queue/src/postgres-evidence-persistence.ts` (modified)
- `packages/testing/package.json` (modified)
- `packages/testing/src/m04-combined-maximum-fixture.ts` (modified)
- `packages/testing/src/m04-completeness-reachability.integration.test.ts` (modified)
- `packages/testing/src/m04-evidence-persistence.integration.test.ts` (modified)
- `packages/testing/src/m04-migration-runner.integration.test.ts` (modified)
- `packages/testing/src/postgres-harness.ts` (modified)
- `pnpm-lock.yaml` (modified)
- `scripts/check-dependency-boundaries.mjs` (modified)
- `scripts/db-common.mjs` (modified)
- `scripts/db-migrate.mjs` (modified)
- `scripts/db-validate.mjs` (modified)
- `tsconfig.json` (modified)
- `docs/milestones/M04_GOVERNANCE_CLOSEOUT.md` (new)
- `docs/milestones/M05_REPORT.md` (new)
- `docs/milestones/M05_SPEC.md` (new)
- `docs/milestones/M05_SPEC_REVIEW.md` (new)
- `docs/operations/M05_DATABASE_CHANGE_RUNBOOK.md` (new)
- `packages/contracts/src/m05.contract.test.ts` (new)
- `packages/contracts/src/m05.ts` (new)
- `packages/draft-generation/package.json` (new)
- `packages/draft-generation/src/index.ts` (new)
- `packages/draft-generation/src/request.unit.test.ts` (new)
- `packages/draft-generation/tsconfig.build.json` (new)
- `packages/draft-generation/tsconfig.json` (new)
- `packages/job-queue/migrations/004_m05_draft_projection.sql` (new)
- `packages/job-queue/migrations/004_m05_runtime_privileges.json` (new)
- `packages/job-queue/src/m05-migration.contract.test.ts` (new)
- `packages/job-queue/src/postgres-draft-persistence.ts` (new)
- `packages/testing/src/m05-draft-concurrency.integration.test.ts` (new)
- `packages/testing/src/m05-draft-generation.adversarial.test.ts` (new)
- `packages/testing/src/m05-draft-generation.fixture.test.ts` (new)
- `packages/testing/src/m05-draft-maximum.integration.test.ts` (new)
- `packages/testing/src/m05-draft-persistence.integration.test.ts` (new)
- `packages/testing/src/m05-genuine-snapshot-fixture.ts` (new)

## Candidate 05 — frozen for verification

Candidate 05 contains 305 files, excluding only this report, at digest `a3a9bce73078eafd79754b71ffab5f2df27d9da6b3e4af06ce83144c03b4a6a6`. Inventory: `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9/candidate-05.json`. Only the draft-generation implementation and its adversarial tests changed from Candidate 04; SQL, manifests, approved authorities, base and publication state are unchanged.

The three corrections restrict inferred-suitability templates to BEST_FOR, preserve CONTENT_HASH_COLLISION on early replay/alias paths, and distinguish rejected provider calls (UNAVAILABLE) from resolved invalid outputs (OUTPUT_INVALID). Timeout classification uses private abort state rather than provider-controlled error text. Targeted writer evidence: build 14/14, lint, format and typecheck PASS; contracts 10/10 and full M05 adversarial 126/126 PASS. These are not substitutes for full frozen-candidate gates. The independent Candidate 04 reviewer is rechecking the exact Candidate 05 changes and whole-patch contract; this is a recheck, not a new reviewer claim. Final receipts use the `f05-` prefix in the same evidence directory.

Independent R2 recheck of this exact identity closed all three Candidate 04 findings and found no new material findings in the two-file delta or unchanged whole patch. The reviewer inspected targeted receipts but did not execute tests. This is a clean independent code verdict, not final milestone GO. Parent-executed frozen install passed (0.61 seconds) and `pnpm verify` passed (42.52 seconds), both with unchanged identity; remaining required gates are pending.

Candidate 05 additional frozen receipts: fixtures PASS (61 tests, 45.93 seconds); adversarial PASS (24.30 seconds); exact three M05 integration files FAIL (18 passed, 1 failed, 397.78 seconds), each with unchanged identity. The maximum and persistence files passed; the same-generation `mandatory-first` concurrency assertion failed because the barrier released both lock requests together but asserted invocation order as commit order. The returned second-candidate winner was not the expected first-candidate bytes. Full aggregate gates are held; a narrow test-harness correction must deterministically establish both designated commit orders while retaining actual PostgreSQL serialization failures and single-winner closure checks. This failed receipt remains `f05-m05-integration.json`/`.log`, not a pass or an environment waiver. Any correction requires Candidate 06 and renewed gates/review.

## Candidate 04 — frozen for verification

The writer stopped edits after the eight Candidate 03 corrections and an additional same-key/different-generation waiter regression. Candidate 04 has **305 files**, excluding only this report, with digest **`63291065f371d3501615fe8e621adeef9f288777a1b5eb2ce2c149598b8bca31`** under the documented path/NUL/file-SHA/newline algorithm. Inventory: `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9/candidate-04.json`. Root, `main`/`origin/main`, HEAD/base and absence of staging/publication are unchanged.

- SQL 004: `8e0ebdc73bdee46a9b21a761ecfd2489f5c4112d7ba5bea3fe6ca3ba9a42fa37`.
- Unchanged M05 manifest: `1a6251b3e7a5155bb3d5fad9354247cd1b5d383db3b628d164d5af0fdd4f6a9f`.
- Composite ledger identity: `6bbd7ebad0a199c24149f10ae150b90c286e207179db0b886f6ed605d53c0f30`.
- Approved M05 specification remains `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`; all eleven predecessor specifications and all four predecessor migration/manifest files also match their frozen authorities.

Targeted writer receipts: build 14/14, full lint, format, typecheck and whitespace PASS; adversarial **119/119** (22.11 seconds), persistence **2/2** (15.09 seconds), concurrency **12/12** (119.14 seconds), targeted contracts **10/10**. Actual PostgreSQL barrier tests observed real `40001` and one committed winner, with a second request association for same-generation aliases or `IDEMPOTENCY_KEY_REUSED` and zero loser rows for same-key/different-generation requests. No synthetic SQLSTATE, blind `23505` retry, new lock namespace or grant was introduced. Actual-LOGIN coherent orphan transactions rolled back with zero rows. Logs use the `c04-` prefix in the resumed evidence directory; full gate receipts below will use `f04-` to distinguish them.

A first key-barrier test incorrectly assumed first invocation determines commit order; its failed receipt is retained, and the corrected assertions check the actual first committed winner. The writer's maximum run was interrupted with exit 130 before any result; maximum verification remains pending. Targeted success and the writer's conditional handoff are not implementation GO. Fresh whole-patch R2 and all required exact-candidate gates remain mandatory.

Candidate 04 frozen receipts: install PASS (0.74 seconds), `pnpm verify` PASS (47.15 seconds), fixtures PASS (47.19 seconds), each with unchanged identity (`f04-install.json`, `f04-verify.json`, `f04-fixtures.json`). Fresh whole-patch R2 nevertheless returned **NO-GO** with exactly three medium findings: section-blind inferred-suitability templates appeared outside BEST_FOR; the early semantic-alias collision path returned integrity failure rather than CONTENT_HASH_COLLISION; and a rejected provider call returned invalid-output rather than provider-unavailable. The reviewer reported no further material safety, migration, authority, closure or predecessor-regression finding. These three bounded fixes are assigned as Candidate 05; later gates are held until refreeze.

A proposed unsafe-integer schema finding was independently disproved: under pinned Node 22.23.1 and installed Zod 4.4.3, both `z.number().int().nonnegative().safeParse(Number.MAX_SAFE_INTEGER + 1)` and the exported M05 metrics schema reject the value. The reviewer withdrew it. Deprecated `.safe()` was not restored merely to satisfy a false static inference. A broader inference-template interpretation was also withdrawn; the implementation correction is the explicit restriction against using INFERRED_SUITABILITY outside BEST_FOR.

## Candidate 03 — frozen for verification

The sole writer stopped edits after correcting the five Candidate 02 findings and all 182 lint violations without blanket rule suppression. Whole-patch format, whitespace/new-file checks, local links, bounded secret-pattern scan, and twelve-specification/predecessor-migration integrity checks passed. Candidate 03 contains **305 files**, excluding only this report, at digest **`e24ed33b2204f990860a6482afc841fb2ee9a3585b87a155a77b2d75d14e58ef`**, using the same documented algorithm. Base/HEAD, branch, upstream, SQL 004, manifest 004, composite migration identity, and approved specification hashes remain as recorded for Candidate 02. Inventory: `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9/candidate-03.json`.

Writer-executed targeted evidence before freeze: full `pnpm lint` PASS; affected builds and contracts/draft-generation/job-queue/testing typechecks PASS; M05 adversarial **113/113**; concurrency **7/7** (113.37 seconds); forced alternate collision cases **3/3**; persistence **1/1**; maximum fixture **1/1**; M05 contracts plus migration contracts **10/10**. These are not substituted for the final unchanged-candidate full gates. A fresh independent whole-patch R2 review and manifest-bound gate execution are now underway. No code edits or publication actions are authorized during those gates; any correction requires another freeze.

### Candidate 03 full-gate receipts

All entries below use Node 22.23.1 / pnpm 11.7.0 and must retain Candidate 03 identity before and after execution. Logs and JSON receipts are in the resumed evidence directory.

| Exact command                                | Actual result                                                                                                                             | Receipt                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `pnpm install --frozen-lockfile`             | PASS; 0.70 seconds; unchanged                                                                                                             | `c03-install.json`              |
| `pnpm verify`                                | PASS; 81.40 seconds; 14-package build, lint/boundaries/source-safety, format, typecheck, 202 unit tests and 193 contract tests; unchanged | `c03-verify.json`               |
| `pnpm test:fixtures`                         | PASS; 6 files / 61 tests; 46.25 seconds; unchanged                                                                                        | `c03-fixtures.json`             |
| `pnpm test:adversarial`                      | PENDING                                                                                                                                   | —                               |
| `pnpm test:integration`                      | PENDING                                                                                                                                   | —                               |
| `pnpm test`                                  | PENDING                                                                                                                                   | —                               |
| Exact M05 integration files                  | PENDING                                                                                                                                   | —                               |
| Source-only frozen install and `pnpm verify` | PENDING                                                                                                                                   | —                               |
| Fresh independent whole-patch R2             | NO-GO; eight material findings below                                                                                                      | Independent Candidate 03 review |

### Candidate 03 independent R2 outcome

Fresh read-only review of the exact frozen digest returned **NO-GO**, despite passing install/verify/fixtures. Three high findings: (1) runtime SQL could commit coherent but unreachable input/revision rows because deferred reverse reachability was missing; (2) safe siblings could mask an unsafe mandatory limitation/installation candidate; (3) fresh same-generation concurrent waiters could reach `23505` and be misclassified instead of converging on the winner. The third finding requires barrier-controlled PostgreSQL proof; the approved prohibition on blind `23505` retry remains unchanged.

Five medium findings: duplicated omission IDs for unsafe/unresolved multi-section fields; absent `target_user_candidates.notIdealFor` treatment; field-first rather than section-first atom ordering; ambiguous/mutable trusted provider registries at the durable boundary; and aggregate-only classes for mixed-support items. The reviewer confirmed a narrow specification-compatible treatment for fit caveats inside BEST_FOR using the existing LIMITATION template, never routing them into NOT_IDEAL_FOR or inventing positive suitability. No amendment or new omission enum is required.

The coordinator verified the source paths and assigned all eight as one Candidate 04 remediation batch, including corresponding adversarial/database regressions. Further full/expensive gates are held. Any changed bytes invalidate Candidate 03 acceptance evidence; its completed passes and failure verdict remain historical evidence for that exact digest. No Git or external publication action occurred.

Candidate 04 matrix interpretation: an M04 `AMBIGUOUS` claim projected from M03 `CONFLICTING` carries conflict IDs, and M04 computes unresolved conflicts across all claims. Its closed progression contract requires no unresolved conflicts for ELIGIBLE. An "eligible optional AMBIGUOUS" positive fixture would therefore violate frozen upstream authority. The corrected matrix must test optional REVIEW_REQUIRED/unsafe multi-section omissions on eligible inputs, and AMBIGUOUS/conflicting input as M04_PROGRESSION_BLOCKED with zero provider calls/writes. This preserves upstream security rather than inventing impossible success evidence; no amendment is required.

## Candidate 02 — frozen for verification

All application and governance edits stopped before freezing **305 files** at digest **`250b98fa124cc46947be7c0845252d60a3f88bf0798c7dcbad36787d96960189`**, using the same path/NUL/file-SHA/newline algorithm and excluding only this mutable report. Base/HEAD remains `e9b62f80f2c5dd2402d145df5e4afda403691f2f`, branch `main`, upstream `origin/main`; nothing is staged. Manifest: `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9/candidate-02.json`. `run-gate.mjs` takes that manifest explicitly and checks source identity before and after each gate, preserving separate logs and JSON receipts.

- Approved M05 SHA-256: `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`.
- SQL 004 SHA-256: `163f697d643aa16dbe026f34c83377419d10e344b90238203c38c081220f7585`.
- Unchanged M05 manifest SHA-256: `1a6251b3e7a5155bb3d5fad9354247cd1b5d383db3b628d164d5af0fdd4f6a9f`.
- SQL/manifest composite ledger SHA-256: `ea97302e8d611092cd6fdb1501bd4c506b18ea867352f1902caf6322dc7a024e`.

The sole writer implemented all nine Candidate 01 corrections. An interim correction review also found ambiguous escaped-PUA sentinel decoding; the final SQL rejects active noncanonical sentinel escapes before projection, while actual NUL, literal PUA and literal backslash-u values remain accepted. Current targeted persistence/sentinel **1/1** (23.99 seconds), migration contract **2/2**, and validator roles **1 selected / 21 skipped** (25.02 seconds) passed. Earlier full targeted concurrency **4/4** (109.90 seconds) and adversarial **107/107** (25.80 seconds) preceded the final SQL/test/hash change and are not exact-Candidate-02 aggregate evidence.

Pre-freeze format check, complete patch whitespace check including new files, relative-link target check, bounded credential-pattern scan and twelve-specification/predecessor-migration integrity audit passed. A fresh independent whole-patch R2 review and all required unchanged-candidate gates are now pending. This is not implementation GO or Git-publication authority.

Candidate 02 frozen receipts: `pnpm install --frozen-lockfile` **PASS**, 1.93 seconds, unchanged identity; `pnpm verify` **FAIL**, 49.10 seconds, unchanged identity. Build completed (14 packages), then ESLint reported **182 errors** and stopped the gate. Later verify stages were not executed and are not counted as passing. Logs/receipts are `c02-install.*` and `c02-verify.*` in the resumed evidence directory. The first verify launch was blocked before execution because a reviewer accidentally wrote a duplicate manifest named `--help` into the root; that exact review artifact was moved outside the repository, original candidate identity was rechecked, and the helper now rejects flag arguments. No candidate source file was changed by that incident.

Fresh R2 also identified a confirmed result-code defect: the service does not map the adapter's `M05_CAPACITY_EXCEEDED` to public `CAPACITY_EXCEEDED`, instead falling through to `PERSISTENCE_UNAVAILABLE`. Candidate 02 therefore remains **NO-GO** regardless of lint. Expensive database/aggregate gates are held while the review consolidates further findings and the sole writer prepares a combined correction.

The completed fresh Candidate 02 R2 verdict is **NO-GO**, with five medium findings, all verified in source and assigned as one batch: (1) the capacity mapping above; (2) mandatory rendered atoms over 400 scalars were classified as unsafe/withheld instead of capacity overflow; (3) attribution/version/category/semantic value qualifiers were omitted by typed text rendering; (4) reused output/revision/record identities lacked complete conditional preimage-byte comparison and alternate-unique closure; (5) invalid provider token metrics reached final revision validation and were misclassified as capacity failure rather than provider-output failure. The reviewer found no further high-severity defect in the inspected grants, role closure, read bridge, lock ordering, Unicode sentinel or migration paths; that static observation is not an executed gate or acceptance. Code remediation and scoped lint cleanup invalidate Candidate 02; Candidate 03 must be freshly frozen and reviewed after targeted checks.

## Resumed review checkpoint — 2026-11-02

The coordinator reconstructed the 305-file inventory and confirmed that resumed source bytes still match Candidate 01, `b305662aafb1ec2884cc8d48a519b985dbdbc52ba84c816d9541784972ba2ecd`. The approved M05 specification hash also matches. The previous `/private/tmp/ai-ark-m05-verification.njDcdz` directory is no longer present; the interrupted `pnpm verify` has no recoverable completion receipt and is **NOT VERIFIED**, not passed. Historical targeted receipts below remain historical reported evidence, not new unchanged-candidate gates.

A prior independent R2 finding was verified directly in current source: `PostgresDraftPersistenceAdapterV1.writeRequestAssociation` performs only one SERIALIZABLE attempt, unlike `persistAccepted`. Semantic-alias association therefore lacks the mandated maximum-three-attempt handling for SQLSTATE `40001` / `40P01` (specification §§10, 14.8). This is a HIGH implementation finding and Candidate 01 is NO-GO independently of the missing gates. A resumed independent whole-patch review is consolidating remaining findings before remediation and a new freeze. No specification amendment or additional grant is authorized or needed for this correction.

The resumed evidence directory is `/Users/adam/.codex/tmp/ai-ark-m05-evidence.7HsCb9`; `candidate.mjs` and `resumed-candidate01.json` retain the reconstructed inventory. Docker was initially stopped and was started for authorized disposable testing. The prior temporary pinned Node installation was also absent; Node 22.23.1 was downloaded from its official distribution and checked against the official SHA-256 listing before use. No repository dependency version changed.

The resumed independent reviewer identified the following additional Candidate 01 findings, verified by coordinator source inspection and assigned to the sole implementation writer. None is closed until regression evidence and re-review:

| Finding                                      | Required correction                                                                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy authority checked after provider work | Bind exact trusted artifacts and complete provider configuration before invocation, and revalidate before write; initial substitutions must cause zero calls/writes.                                       |
| Optional aggregate and catalog overflow      | Reserve mandatory content and apply stable whole-atom optional omission for aggregate item/scalar and provider-catalog bounds; retain exact omission provenance.                                           |
| M04 read-port expectations ignored           | After full durable validation, return a typed mismatch for wrong extraction/fingerprint, rather than FOUND; preserve service defense-in-depth.                                                             |
| Generation winner adopted by hash alone      | Compare complete generation preimage and retained input bytes before adoption; exercise the real adapter collision branch and prove no new association.                                                    |
| SQL indexed-parent closure incomplete        | Bind manifest, revision and request/result indexed identities through invoker triggers without new grants or narrowing the accepted byte domain; test coherent direct-SQL bypasses under the actual LOGIN. |
| Concurrent adopted winner reported as new    | Carry a closed persistence disposition and return correct transport replay metadata, while stored canonical results retain `replayed:false`.                                                               |
| Migration validator membership gap           | Check both endpoints of writer/LOGIN memberships and reject outbound/inbound role paths, including validator-level negative tests.                                                                         |
| Provider ordering discarded                  | Preserve permitted optional selection order and verify output fingerprint differences plus first-winner replay.                                                                                            |

The resumed authority audit checked all twelve approved specification hashes and all four predecessor migration/manifest files against their retained authorities/base: **PASS**. This is authority-integrity evidence only, not implementation acceptance. No staged changes or Git publication occurred.

### Remediation checkpoint receipts (not a frozen candidate)

The writer reported contracts/evidence/draft-generation/job-queue builds and testing typecheck passing, followed by the exact M05 adversarial file **104/104** (34.85 seconds), persistence integration **1/1** (18.57 seconds), and migration-contract **2/2**. An intermediate persistence failure due to the pre-trigger catalog expectation was corrected and rerun; this does not replace final catalog/authority review.

New valid-NUL coverage then exposed a real compatibility failure in the draft SQL revision trigger: PostgreSQL `22P05`, `\\u0000 cannot be converted to text`, **1 failed test**, 58.71 seconds total. The failure is retained in `m05-draft-persistence-after-r2.log` in the resumed evidence directory. Neither the accepted NUL domain nor timeout was relaxed. After further correction, `m05-draft-persistence-after-r2-rerun2.log` records **1/1 passed**, 32.86 seconds total / 26.91 seconds tests. These evolving-code receipts are diagnostic evidence, not frozen-candidate acceptance.

The subsequent full concurrency file recorded **1 failed / 2 passed of the then-current 3 tests**, 178.35 seconds total: the 73-alias test exceeded its unchanged 120-second limit. Coordinator inspection found redundant full-revision canonical serialization for every alias even after one transaction-local revision had been fully validated. The correction compares that revision once while retaining every alias's canonical request/result/index/semantic checks. A focused rerun (`-t 'validates many semantic aliases'`) passed **1 selected / 3 skipped**, 83.53 seconds total / 80.63 seconds tests. It is not a full concurrency-file pass. The machine had another project's tests active; no causal performance attribution to that load is claimed.

The structural SQL correction uses the predecessor's reversible NUL-safe projection and actual JSON structure/closed top-level fields, not substring presence as an identity oracle. `m05-draft-persistence-structural.log` records **1/1 passed**, 18.99 seconds total / 17.29 seconds tests. The validator-role focused test passed **1 selected / 21 skipped**, 35.26 seconds total / 32.73 seconds tests. The expanded adversarial file passed **106/106**, 23.25 seconds total / 22.14 seconds tests.

The intermediate full M04 evidence-persistence run was manually interrupted (exit 130); its log has no completed gate result. A subsequent bridge-only filter again failed ordered fixture initialization (**1 failed / 22 skipped**, 5.15 seconds). Neither is bridge acceptance. `AGENTS.md` now explicitly requires this ordered file to run unfiltered; the complete frozen-candidate regression remains required.

## Candidate 01 verification boundary

Application-code edits stopped before freezing **305 tracked/nonignored-untracked files**, excluding only this report. Branch `main`, base/HEAD `e9b62f80f2c5dd2402d145df5e4afda403691f2f`; candidate digest **`b305662aafb1ec2884cc8d48a519b985dbdbc52ba84c816d9541784972ba2ecd`**. Algorithm: sort repository-relative UTF-8 paths bytewise, then SHA-256 each path, NUL, lowercase hex SHA-256 of its file bytes, and newline in sequence. Local manifest and checker: `/private/tmp/ai-ark-m05-verification.njDcdz/candidate-01.json` and `candidate.mjs`. No source changes are permitted during candidate gates; any correction requires a new identity and appropriate reruns.

| Identity                         | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Approved M05 specification       | `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d` |
| SQL 004                          | `b9da79536adfbde2343b7cbb4f8e92fe182f3f21457ce0180041b7ceb37eca7b` |
| Canonical M05 privilege manifest | `1a6251b3e7a5155bb3d5fad9354247cd1b5d383db3b628d164d5af0fdd4f6a9f` |
| SQL + manifest ledger composite  | `e655b21f2bcc11f0fc02265840a14cc26c27212bb34bf40a31dfa6abbc74e0f4` |

Pre-freeze `pnpm format:check` and `git diff --check` passed. Approved M05 and frozen predecessor migration identities were preserved. Targeted historical receipts below do not substitute for the full exact-candidate gates now pending. Fresh independent whole-patch R2 review must assess the complete candidate, including the precisely scoped supplied-digest collision-classifier evidence rather than treating it as an end-to-end injected SHA collision.

## Authority, scope, and repository state

The owner approved `M05_SPEC.md` at whole-file SHA-256 `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d` and separately authorized implementation on 2026-10-27. The exact approved file was rehashed and matched before work. Its pre-approval status text remains unchanged to preserve the approved bytes. Independent specification review is recorded in [M05_SPEC_REVIEW.md](M05_SPEC_REVIEW.md); it is not implementation review.

Root: `/Users/adam/Developer/ai-ark`. Starting branch/base `main`, upstream `origin/main`, HEAD `e9b62f80f2c5dd2402d145df5e4afda403691f2f`. Seven pre-existing uncommitted governance/specification documents from the preceding task are preserved. No staged changes were present. No new commit, push, PR, merge, release, deployment, or production migration is authorized or performed by this task.

Scope: strict M05 contracts and canonical identities; verified durable M04 read bridge under existing grants; deterministic evidence-bound draft projection; opaque-metadata-only provider selection; isolated append-only PostgreSQL persistence, migration 004, exact privilege manifest, replay/recovery/concurrency tests. Preserve all eleven M03/M04 specification hashes, migrations 001–003, and the 180-cell M04 manifest.

Non-goals: UI/API deployment, live providers, new Claims/evidence, editorial decisions, approval/publication, M06+, dependency/runtime upgrades, production data or credentials, and Git publication.

## Execution and acceptance ledger

One accountable application-code writer is assigned; the coordinator owns governance/report updates. A separate read-only feasibility audit examines migration/ACL compatibility. Required independent whole-patch R2 review follows a stabilized candidate and full gates, not partial code.

| Acceptance                                       | Implementation and test surfaces                                                                        | Current status                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| AC-01 verified durable source handoff            | M04 `readAcceptedBinding`; M04 evidence-persistence and completeness-reachability integration files     | PASS — Integration / adversarial: verified handoff and forged-input rejection |
| AC-02 upstream blockers preserved                | Draft service eligibility; M05 adversarial material-requirement matrix                                  | PASS — Adversarial: blocked material requirements with zero calls/writes      |
| AC-03 fourteen concise unapproved sections       | Draft atom registry/rendering; M05 fixture and adversarial files                                        | PASS — Fixtures / adversarial: fourteen unapproved sections and scalar bounds |
| AC-04 attributable classes/qualifiers/evidence   | Typed atom mappings and retained provenance; M05 adversarial and maximum files                          | PASS — Adversarial / maximum: typed qualifiers and full provenance            |
| AC-05 confined provider authority                | Trusted registry and closed composition; M05 adversarial file                                           | PASS — Adversarial: closed metadata selection and hostile outputs             |
| AC-06 immutable durable provenance/replay        | PostgreSQL draft adapter and migration 004; persistence/concurrency/maximum integrations                | PASS — Integration: PostgreSQL rollback, replay and backup/restore            |
| AC-07 canonical Unicode/number/byte domain       | Contracts, parser, canonical validators and chunk storage; contract/persistence/maximum tests           | PASS — Contracts / persistence: canonical bytes and Unicode round-trip        |
| AC-08 least privilege and predecessor regression | Nine-cell M05 manifest, runtime catalog and migration validator; persistence and migration-runner tests | PASS — Integration / authority audit: LOGIN grants and predecessor checks     |
| AC-09 forward migration and recovery             | Migration tooling and 004; migration-runner and maximum backup/restore tests                            | PASS — Integration: migration runner, failure closure and restored replay     |
| AC-10 regeneration and first-winner concurrency  | Service and durable adapter; M05 concurrency and adversarial tests                                      | PASS — Concurrency: both winner orders, retry and regeneration                |
| AC-11 bounds and leakage                         | Projection/provider budgets and safety filters; contract/adversarial/maximum tests                      | PASS — Fixtures / adversarial / maximum: bounds, omissions and leakage        |
| AC-12 scope and source safety                    | Dependency/source-safety checks and whole-patch review                                                  | PASS — Verify / patch audit / whole-patch R2: scope and source safety         |

## Verification ledger

Only executed checks will be recorded as passing. Historical M04 full/integration passes apply to its merged baseline, not new M05 bytes. The targeted evolving-candidate runtime receipts below are not final milestone gates. Full unchanged-candidate `pnpm verify`, fixtures, adversarial, integration, aggregate tests, source-only frozen verification, raw new-file diff checks, secret scan, and independent R2 remain required by the approved specification.

Preflight executed: `node --version` → v22.23.1; `pnpm --version` → 11.7.0 using the pinned runtime path; `docker info --format '{{.ServerVersion}}'` → 29.5.3. Whole-file SHA-256 checks matched the approved M05 specification, SQL 003 `6da55b9ee12fccad5feb5b9fd31ff30ce972a8b3401f83a62cdb2bdf632939e8`, and manifest `09de293bd6132c124c086d4d3e75a357e6867383d36821602c53e5b496a8a991`.

The separate read-only migration feasibility audit found no PostgreSQL/specification authority contradiction. It identified required tooling work: explicit 004 manifest/composite identity, M05 role mapping, and namespace-aware catalog validation rather than replaying a fixed M05 schema through the existing single-schema scratch-catalog builder. Existing M04 prefix/role/manifest checks must remain active. Implicit invoker-trigger execution without runtime EXECUTE has precedent, but M05 must still prove its own actual-LOGIN path; this audit is not an executed M05 database test.

### First contracts/parsing checkpoint

The writer added M05 contracts, a draft-generation package and initial composition/persistence interfaces. Writer-reported focused checks: `pnpm exec vitest run --config vitest.contract.config.ts packages/contracts/src/m05.contract.test.ts` passed 1 file / 5 tests; `pnpm exec vitest run --config vitest.unit.config.ts packages/draft-generation/src/request.unit.test.ts` passed 1 file / 4 tests; `pnpm --filter @ai-ark/draft-generation typecheck` passed after rebuilding dependencies. These qualify only the selected contracts/parser, not the complete renderer, provider confinement, read closure, or durable boundary. Coordinator inspection identified incomplete typed projection, omission/mandatory-atom handling, per-section selection, timeout, and replay/closure paths for correction before broader acceptance. No implementation GO is inferred.

### Combined-maximum projection and migration checkpoint

Writer-reported `pnpm exec vitest run --config vitest.fixture.config.ts packages/testing/src/m05-draft-generation.fixture.test.ts` selected exactly 1 file / 1 test and passed in 94.06 seconds (92.00-second test). It exercises the existing combined maximum with 4,096 EvidenceItems, 20 Claims and 81,920 links, fourteen draft sections, complete provenance counts, and in-memory replay. This is fixture projection evidence, not PostgreSQL persistence/recovery acceptance or the ordinary ≤60-second target. Contracts/evidence/draft-generation builds and testing-package typecheck also passed at this checkpoint.

Migration 004 applied in a disposable run, but `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m04-migration-runner.integration.test.ts` failed 14 of 22 cases (8 passed, 257.36 seconds) because validation/test expectations still assumed three migrations: ledger-incomplete errors or expected 3 versus actual 4. This is an introduced compatibility failure and remains red historical evidence. After correcting blank-install ledger insertion, frozen M04-prefix catalog replay, and dedicated M05 scratch-catalog validation, the same exact-file command with `-t 'applies a blank database'` passed 1 case / 21 skipped in 20.65 seconds. That focused result is not a full-file pass. Full affected migration coverage remains required after the new durable adapter and migration contract checks stabilize. SQL application by itself does not establish migration readiness.

### First durable-slice checkpoint

Writer-reported M05 PostgreSQL adapter integration passed 1 file / 1 test in 17.27 seconds, using the actual M05 LOGIN for persistence, restart, read, and alias replay. Subsequent regeneration/forged-candidate/denial cases were not part of that pass and require rerun. The contracts plus migration-contract selection passed 2 files / 8 tests; raw parser remained 1 file / 4 tests. Contracts, evidence, draft-generation, job-queue and testing builds/typechecks passed; dependency boundaries reported 14 packages. These are evolving-byte targeted receipts, not unchanged-candidate final gates.

`pnpm exec vitest run scripts/db-migrations.unit.test.mjs packages/job-queue/src/m04-migration.contract.test.ts` subsequently passed 25/25 unit/contract tests. This is not the still-pending 22-case migration-runner integration file and does not supersede its earlier failure.

Source-safety initially rejected an introduced regular-expression `.exec` call in the JSON scanner; the writer replaced it with equivalent `.match` and owes a fresh scan. The isolated M04 bridge `-t` invocation failed because the host test file initializes its database in the first test, which the filter skipped. No bridge runtime pass is claimed from that invocation. The complete sequential file or a self-initializing standalone fixture must pass. The earlier maximum fixture also predates the stricter provenance schema and requires rerun.

The extended `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m05-draft-persistence.integration.test.ts` then passed 1 file / 1 test in 22.01 seconds (16.82 seconds of tests). Its named assertions now include forged candidate rejection, replay/alias/restart, same-input regeneration reuse, runtime UPDATE/CREATE denial, PUBLIC schema CREATE drift, third-role table ACL, direct-login UPDATE ACL, predecessor peer-role membership, global default ACL, unexpected function inventory, and inner-join-hidden orphan rejection. A preceding invocation failed because the new test referenced nonexistent role `ai_ark_m04_writer`; the fixture was corrected to actual `ai_ark_m04_runtime` before the clean rerun. This is a focused evolving-candidate pass, not the full M05 hostile/concurrency/recovery matrix or final whole-patch acceptance.

### Full affected migration and provider-hostile checkpoints

Coordinator-executed `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m04-migration-runner.integration.test.ts`, pinned runtime and no filter, exited 0: **1 file / 22 tests passed**, 386.82 seconds total / 378.32 seconds tests. This closes the earlier introduced migration-runner compatibility failure for the current slice; it does not erase that failed run or qualify a later changed candidate. No timeout or workload was relaxed.

Writer-reported `pnpm exec vitest run --config vitest.adversarial.config.ts packages/testing/src/m05-draft-generation.adversarial.test.ts` passed **1 file / 8 tests**, 2.30 seconds total / 1.32 seconds tests. Named cases cover deterministic fourteen-section output, metadata-only AI request and metrics, duplicate-key/fabricated-ID/added-prose/oversized provider output with zero writes, ignored-abort timeout and late-response containment, registry replacement during generation, and duplicate config-ID rejection. The first invocation failed all eight cases because its source fixture correctly blocked; a bounded eligible fixture using seven source references, twenty Claims and 140 links was then derived from the existing maximum constructor and the clean rerun passed. This ordinary fixture does not replace the required combined maximum. Testing typecheck passed before that fixture correction and remains due after final additions.

The next clean rerun of the same adversarial file passed **9/9**, 2.45 seconds total / 1.43 seconds tests, adding coherent-rehash invented prose and trusted-artifact substitution rejection. The exact M05 persistence integration file then passed **1/1**, 10.29 seconds total / 8.36 seconds tests, with PUBLIC table ACL, disabled-trigger, extra-constraint, later-corrupt-alias, and pre-open same-signature function tamper cases plus full rerender validation. `pnpm --filter @ai-ark/testing typecheck` passed after these changes. These named assertions strengthen a focused slice; the complete §14 concurrency, boundary, recovery, and maximum matrix remains pending.

Coordinator reran `pnpm lint:source-safety`: exit 0, no prohibited acquired-source execution paths found after rebuilt outputs. Fresh `shasum -a 256` again matched approved M05, frozen SQL 003 and manifest 003. The coordinator then ran the full unfiltered `packages/testing/src/m04-evidence-persistence.integration.test.ts` to verify the new read bridge with its host file's required initialization and predecessor regression; its failed result is recorded below.

The same named adversarial file subsequently passed **11/11**, 3.07 seconds total / 1.81 seconds tests, adding a hung-source total-deadline response and a late-persistence zero-write test with fake timers. Draft-generation build, job-queue typecheck and testing typecheck passed at that writer checkpoint. The shared candidate validator now explicitly checks eligible completeness, withheld material, request mode/regeneration intent, and the adapter's exact trusted historical provider configuration; broader registry/concurrency/recovery tests are still required.

A coordinator inline Node filesystem check found all 16 relative Markdown-link targets in nine scoped governance/architecture/spec/report/runbook documents present. This checks simple relative target existence only, not remote links, heading anchors, or all documentation semantics.

The full unfiltered M04 persistence invocation exited **1**, **22 passed / 1 failed of 23**, 319.02 seconds total / 317.36 seconds tests. The existing `replays durable bindings and classifies retry and lock faults` case expected `{bundles:2, requests:5}` but saw thirteen requests after the new bridge case added eight aliases to shared ordered state. The bridge case itself passed, but this is not a full-file pass. The writer must isolate/reorder the new fixture without relaxing the predecessor count assertion, then rerun the entire file. This introduced test-isolation failure remains historical evidence.

The writer moved the new eight-alias bridge case after the existing stateful cases without changing their count assertions; testing typecheck passed. Coordinator repeated the same full unfiltered command, which exited **0**, **1 file / 23 tests passed**, **308.78 seconds total / 304.47 seconds tests**. This closes that test-order regression on the corrected slice and verifies the bridge together with its predecessor host suite. All final unchanged-candidate gates remain outstanding.

### Expanded maximum and first concurrency checkpoint

Writer-reported same exact M05 adversarial file passed **26/26 in 5.62 seconds**. The exact M05 fixture command passed **1/1**, **46.23 seconds total / 45.35 seconds tests**, with full rerender validation and the unchanged 4,096 EvidenceItems / 20 Claims / 81,920 links. This replaces the earlier fixture's stale-byte relevance, not its historical receipt; it is still projection/in-memory replay evidence rather than durable maximum restore. The exact adapter integration file passed **1/1 in 10.45 seconds**.

`pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m05-draft-concurrency.integration.test.ts` passed **1/1**, **14.90 seconds total / 13.10 seconds tests**. The slice includes empty-store same-input/different-token races in both invocation orders and key/generation races. Shared input reuse uses `ON CONFLICT DO NOTHING` with serializable-transaction handling; no new grant or blind unique-error retry was added. Distinct AI selections, per-stage failures, retry exhaustion, uncertain commit, and backup/restore remain outstanding.

At that checkpoint, the writer's explicit §14 coverage audit identified gaps: capability/install-path variants; every material-status and typed-union/pointer/class variant; exhaustive evidence/chunk/await-mutation corruption; dedicated SQL/shell/HTML/contact/no-egress fixtures; every exact-at/one-over/omission limit; all policy/source/collision replay variants; fault/recovery matrix; all allowed/denied privilege cells and coordinated owner/peer variants; and explicit M05 recovery/log-safety evidence. Later receipts below record incremental closure; test count alone does not stand in for these requirements. No candidate had been frozen at that checkpoint.

### Durable combined maximum and backup/restore

Writer-executed `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m05-draft-maximum.integration.test.ts --reporter=verbose` passed **5/5**, **469.35 seconds total / 465.13 seconds tests**, retaining 4,096 EvidenceItems, twenty Claims and 81,920 links. Every complete operation retains its 240-second test limit:

| Named operation                               | Observed duration | Evidence boundary                            |
| --------------------------------------------- | ----------------- | -------------------------------------------- |
| Maximum fixture/source closure construction   | 8.241 seconds     | Not an actual M04 database bridge read       |
| Maximum projection                            | 41.177 seconds    | Full selected provenance retained            |
| Actual M05 LOGIN persistence                  | 86.085 seconds    | Complete input chunks and revision persisted |
| Restart validation/replay                     | 138.780 seconds   | Full closure revalidated without live source |
| PostgreSQL backup/restore and restored replay | 179.775 seconds   | Full maximum reconstructed after restore     |

These are real disposable-PostgreSQL maximum and recovery receipts, not live-provider or production evidence. Actual M04 bridge maximum-read measurement and bounded sequential M05 alias loading remain pending. Any subsequent source changes require final unchanged-candidate reruns.

The writer subsequently refactored M05 alias loading to bounded sequential validation and reported the adapter/concurrency slice passing 2/2; the durable maximum must be rerun on those bytes. The focused actual-source proof used `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m04-completeness-reachability.integration.test.ts -t 'binds the schema-valid combined maximum|exports the full maximum closure' --reporter=verbose`. It selects the real M04 maximum persistence/replay plus a separate actual-LOGIN read bridge operation. Skipped host-file cases are not counted as a full-file pass.

That focused actual-source command completed successfully: **2 selected tests passed / 24 intentionally skipped**, **218.20 seconds total / 216.01 seconds tests**. Existing combined-maximum bind/reconstruction took **174.572 seconds**; `exports the full maximum closure through the actual M04 LOGIN read bridge` took **33.069 seconds**, verifying all 4,096 EvidenceItems / twenty Claims / 81,920 links. This is genuine durable source-read measurement under the existing 240-second per-operation limit. It is not an unfiltered host-file or full integration pass.

The exact M05 durable-maximum file was rerun after the sequential-alias refactor and passed **5/5**, **355.21 seconds total / 353.34 seconds tests**, exit 0. Catalog and chunk-ordinal checks changed while that process was running, so the receipt applies to the candidate loaded at process start and is explicitly not unchanged-current-candidate evidence. No causal performance claim is inferred from timing differences across evolving runs. Further maximum reruns are held until the remaining implementation/matrix stabilizes, then all required gates must run on one frozen candidate.

## Risks and remaining work

### Narrow independent authority review: database TEMP

An intermediate migration 004 draft added a database-wide `REVOKE TEMPORARY ... FROM PUBLIC`, with effective-TEMP startup rejection and a denial test. A narrow independent read-only R2 audit found this a **HIGH implementation defect**, not a required specification change: M05 §12 scopes its object authority to `ai_ark_m05`, while §3 and AC-08 preserve predecessor authority. The global revoke affects all roles and breaks the existing actual M04 LOGIN temporary-shadow regression. The coordinator verified that regression's `CREATE TEMP TABLE m04_binding_requests` operation in source.

Required in-scope correction: remove the global revoke and effective-TEMP denial requirement; preserve the nine-cell M05 object allowlist and demonstrate that hostile `pg_temp` objects cannot influence schema-qualified application queries or fixed-search-path invoker triggers. Do not add compensating predecessor grants. Recompute the unapplied 004 candidate identity and rerun affected migration/actual-LOGIN regressions. The intermediate `09a4f7...` SQL identity and targeted passes on those bytes are not stabilized acceptance evidence. No production/shared target was touched. This narrow audit is not the final whole-patch R2 verdict.

The global revoke and effective-TEMP drift rejection were removed; corrected SQL 004 hashes to `b9da79536adfbde2343b7cbb4f8e92fe182f3f21457ce0180041b7ceb37eca7b` at this checkpoint. Writer ran the exact M04 persistence file with `-t 'rejects authority drift and consumed-document predecessor changes'` after explicitly adding 004 to its setup: **1 selected test passed / 22 skipped**, 33.09 seconds total / 29.93 seconds tests, including the unchanged actual-LOGIN temporary-shadow behavior. The coordinator then started the full unfiltered 22-case migration runner against corrected SQL and the expanded M05 validator. This focused pass is not a full M04 persistence acceptance.

That corrected full migration invocation exited **0**, **1 file / 22 tests passed**, **244.73 seconds total / 242.98 seconds tests**. Exact command remained `pnpm exec vitest run --config vitest.integration.config.ts packages/testing/src/m04-migration-runner.integration.test.ts`, with no filters or relaxed limits.

The writer's latest complete exact M05 adversarial-file invocation passed **92/92**, **16.03 seconds total / 14.95 seconds tests**, exit 0. Added coverage includes provider catalog 64 accepted / 65 rejected before provider work; raw request 16,384 / 16,385 bytes; representable material missing/unsupported/review/conflict rows; explicit upstream rejection of version states forbidden by frozen M03; unsafe content and hostile provider parsing; and deadline behavior. Impossible accepted upstream states are not presented as valid M04 blockers. Fault/recovery and remaining boundary coverage still require completion before freezing.

### Post-build catalog, corruption and failure receipts

Workspace exports were confirmed to use generated `dist/index.js`; transforming test source does not establish runtime-package freshness. Earlier receipts lacking a dependency build provenance are intermediate evidence only. `AGENTS.md` now requires rebuilding affected packages/dependencies before targeted tests; final gates begin with a build.

After `pnpm --filter @ai-ark/job-queue build`, the exact M05 persistence integration file passed **1/1**, **18.30 seconds total / 15.33 seconds tests**, including full relation/index/column/collation/RLS/policy catalog checks, wrong owner OID, extra view/sequence/index, encoded-key collation drift, and shifted/missing/reordered/extra chunks, alongside prior ACL/role/function/trigger/constraint/temporary-shadow cases. The exact M05 concurrency file then passed **2/2**, **35.91 seconds total / 33.81 seconds tests**; its new case injects failures before input/chunk/revision/request stages with zero accepted graph, successful retries after `40001` and `40P01`, and three-attempt exhaustion.

After a draft-generation build, focused template and uncertain-commit cases passed **5 selected / 92 skipped** in **2.51 seconds**: source strings containing template/dollar replacement syntax remain literal in a single-pass renderer, and post-commit lookup reconciles acceptance without a second source/provider call. This does not replace the pending full adversarial rerun or the final unchanged-candidate matrix.

The next combined small-database run preserved an introduced failure: persistence passed 1/1 in 14.71 seconds, but concurrency failed 2/3 after the new 73-alias complete-closure regression timed out at 120.884 seconds (141.81-second file). Sequential loading bounded memory but redundantly reparsed the same full input per alias. The authorized correction is snapshot-local reuse of one fully validated immutable input/revision closure, with every alias's canonical request/result bytes, hashes, semantics and revision association still checked. No cache may escape that consistent transaction or replace byte comparison with hash equality. The 120-second test limit remains unchanged; a built-code exact concurrency rerun is required.

### Stabilization handoff before Candidate 01

After affected package builds, the writer reported full M05 adversarial **103/103** (19.00 seconds total / 17.45 seconds tests), selected contract files **10/10**, parser unit **5/5**, maximum fixture **1/1** (57.08 seconds total / 56.20 seconds tests), persistence **1/1** (26.76 seconds total / 23.23 seconds tests), and corrected full concurrency **3/3** (190.88 seconds total / 188.25 seconds tests). Each concurrency case retained its 120-second limit. The maximum fixture is governed by 240 seconds, not the ordinary-fixture 60-second target; no 3.8-second maximum headroom claim is made. Ordinary deterministic/AI cases are bounded within the 17.45-second adversarial aggregate, not separately measured end-to-end live-provider evidence.

The canonical 004 manifest was excluded from Prettier using the same explicit canonical-artifact policy as 003; its canonical parser/hash tests remain active. No dependency or runtime upgrade occurred. The supplied-digest/distinct-byte collision classifier is used in persistence input reuse and directly tested, but it is not an end-to-end hash-function-injection receipt; R2 must judge that coverage precisely.

The real M04 bridge snapshot now feeds `validateAcceptedBindingSnapshotV1` with durable expected identities. A filtered attempt failed during legacy ordered fixture initialization (`undefined.persistAccepted`), **1 failed / 22 skipped**, 6.75 seconds. It provides no seam verdict; the final full ordered file must execute the assertion. The earlier full-file pass preceded that new assertion. All application-code edits then stopped for Candidate 01.

Historical coordinator checkpoint: scoped `pnpm exec prettier --write` on the seven coordinator-owned governance/architecture/report/runbook files completed with all files unchanged. A fresh `pnpm lint:source-safety` exited 1 because generated `packages/draft-generation/dist/index.js` still contained the prohibited `.exec` pattern. The subsequent rebuilt-output pass is recorded above; this failed invocation remains failed evidence.

Further read-only inspection identified PUBLIC table ACL rows omitted by an inner join, trust-on-first-open of function/trigger definitions, and alias association validating only the first retained alias. These are assigned for correction with pre-open and checkout negatives and all-incumbent closure tests. A separate read-only audit is mapping every specified numeric/byte/scalar/count limit to enforcement and exact-at/one-over tests. No independent implementation verdict or frozen candidate exists yet.

The independent bounded limits audit found non-fatal request UTF-8 decoding and late-only aggregate projection validation (64 items, 12,000 scalars, and 240-scalar Outcome). It requires strict decoding plus selection-time capacity/omission handling and named exact-at/one-over tests. Its checklist also covers request 16,384 bytes; tokens 200 bytes; item 400 scalars; section 12 and capabilities 6; provider catalog/output 32,768 bytes; provider/application deadlines 30,000/240,000 ms; artifacts/chunks 65,536 bytes; input/revision 268,435,456 bytes; and the 4,096/20/81,920 combined maximum with restart/restore. This was a read-only audit of evolving code, not executed boundary-test evidence.

An intermediate writer checkpoint reported draft-generation, job-queue and testing typechecks passing after authority and alias corrections. The coordinator rehashed all eleven predecessor authorities against the M04 report table and all matched, then started the full 22-case migration-runner integration file with no filters. pnpm synchronized workspace links first using 353 cached packages and zero downloads; the lockfile diff remained workspace-link additions, not a dependency-version upgrade. The completed migration and later hostile-case receipts appear above; the full matrix remains pending.

Primary risks are exact accepted-input closure, the unchanged M04 authority boundary, complete typed atom projection, canonical database replay, and concurrency/restore correctness. No actual grant shortage or specification blocker is asserted without evidence. Disposable PostgreSQL tests and provider fakes are the verification environments; no live-provider, production, or real-user evidence is inferred.

In-progress coordinator inspection also flagged alias-related memory amplification in the first read-bridge draft, permissive provenance schema handling, incomplete runtime authority checks in the first M05 adapter draft, unclassified unique-conflict retries, and missing exact-input reuse for regeneration. These are implementation corrections required under the approved specification, not reasons to weaken it. They are not marked closed merely because a basic fixture or typecheck passes; corresponding targeted negatives and later full review are required.

Next authorized work: finish the consolidated R2 remediation, freeze a new candidate, then run all full gates and source-only verification and obtain fresh independent whole-patch R2 review. Candidate 01 remains rejected. No manual action is currently required.
