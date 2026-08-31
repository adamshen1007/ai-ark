# M03 — Structured Extraction implementation report

## 1. Decision

`CONDITIONAL GO — M03 REMEDIATION READY FOR FRESH INDEPENDENT WHOLE-PATCH REVIEW`

The approved M03 specification and the bounded whole-patch remediation instruction have been implemented. Fresh
local verification is green. Commit readiness remains conditional on a new independent whole-patch review
returning `GO — M03 COMMIT READY`. This report is local evidence, not independent acceptance, commit authorization,
or publication authorization.

## 2. Authority and scope

- Approved exact `docs/milestones/M03_SPEC.md` SHA-256:
  `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`.
- Authorized scope: M03 structured extraction against that exact specification.
- Preserved M02 baseline: commit `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7`; M02 specification and report
  remain byte-unchanged.
- Preserved non-goals: no M03 migrations, M04 evidence binding or draft generation, editorial/publication flow,
  UI, public directory, runtime execution of acquired content, live-provider requirement, deployment, or release.

## 3. Repository and publication state

- Root: `<repository-root>`.
- Branch: `main`; intended base and upstream: local `main` / `origin/main`.
- HEAD, local base, and upstream before publication: all
  `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7` (`+0/-0`).
- Worktree: nine tracked files modified plus the M03 specification, report, contracts, analysis, extraction,
  and integration files untracked. The index is unstaged.
- Commit: not created. Push, PR, merge, tag, release, deployment, and publication: not performed.

## 4. Runtime

- Node.js: `v22.23.1`.
- pnpm: `11.7.0`.
- TypeScript: `6.0.3`.
- Vitest: `4.1.10`.
- PostgreSQL regression image: `postgres:17.6-alpine` through the existing ephemeral Docker harness.

## 5. Implementation summary

- Added strict M03 request, policy, field, warning, typed-value, provenance, candidate, conflict, AI proposal,
  attempt, and immutable structured-extraction bundle contracts.
- Added the `@ai-ark/extraction` package with deterministic normalization, provenance construction, source-safety
  withholding, exact-command parsing, static-permission inference, structured manifest parsing, merge logic,
  aggregate status, progression blockers, fingerprints, and an in-memory orchestration boundary.
- Added provider-neutral AI-analysis partitions, a bounded one-repair-attempt response validator, and a
  deterministic fake adapter. AI output remains proposal-only and cannot approve, publish, execute source, or
  mutate M02 authority.
- Added stable extraction identity, idempotent replay, concurrent request joining, cancellation/supersession
  checks, immutable output fingerprints, content-derived collision rejection, and predecessor freshness checks.
- Added exact 20-field registry ordering, schema cross-reference validation, hard counts, secret/contact
  withholding, and explicit `MISSING`, `CONFLICTING`, `UNSUPPORTED`, and `REVIEW_REQUIRED` outcomes.
- Added strict YAML and TOML parsing with pinned `yaml@2.9.0` and `smol-toml@1.8.0`; aliases, anchors, custom tags,
  duplicate keys, non-finite/non-JSON values, and interpolation are rejected or routed for review.
- Added operation-specific, heading-scoped candidate-independent references. Operation-only references are absent
  when analysis is disabled, while enabled analysis receives only its exact operation partition and canonical
  ambiguity union.
- Replaced ad hoc Markdown cue/table recognition with the frozen CommonMark/GFM profile: raw ATX heading labels,
  list-descendant paragraph exclusion, parser-derived GFM table rows, and one-line eligible cue/declaration blocks.
- Applied the exact `SKILL.md` front-matter state machine before every Markdown/install/declaration/operation-input
  parse while retaining absolute frozen-document line and byte locators. An unclosed opener yields an empty body.
- Centralized the frozen M01 LF-only line model for provenance, static permission scans, front-matter boundaries,
  and raw Markdown consumers: CRLF removes only the CR directly before LF, while bare CR remains authored content.
- Bound user-facing string limits to valid Unicode scalar counts rather than UTF-16 code units; malformed lone
  surrogates fail closed, and exact astral-scalar maxima remain valid.
- Canonicalized every serialized `OperationInputV1` reference set by `SourceReferenceId` after bounded
  allocation-priority selection, so selection policy cannot alter the specified wire order.
- Rebuilt the final source-reference registry from independently accumulated support, explicit routing,
  operation, and retained-AI sets; records outside that union are not serialized, missing members fail closed,
  and the complete registry is validated in `SourceReferenceId` order rather than whole-record order.
- Expanded analysis candidate/conflict identities to the complete canonical records, strips only each record's
  derived `id` when constructing `OperationInputV1`, and binds those exact payload bytes into the analysis-input
  fingerprint. Orchestrator-owned invocation authorization admits only ordinal 0 primary and ordinal 1 repair;
  ordinal 2/count 3 fails before the adapter spy can make a third provider call.
- Made the current-predecessor reread capability a required loaded-input member. Every eligible enabled and
  disabled execution now performs authoritative cancellation-first freshness checks at the prescribed
  post-eligibility, pre/post-analysis, and final-return boundaries.
- Closed the v5 whole-patch findings: every nonconfiguration sensitive value now constructs and explicitly routes
  its privacy-safe locator/hash reference before candidate suppression; all Skill body declarations use original
  post-front-matter absolute lines; field reconciliation removes provenance for semantic equality, unions exact
  citations, applies field-specific ordering, and rejects illegal status/claim/support arms; installation paths
  now group by the discriminated normalized label, deduplicate equal content, and conflict on same-label
  divergence; and explicit deprecation follows the complete absent/invalid/true/false/disagreement state machine.
- Closed the v8 five-blocker review: structured selector objects and field-specific typed values are exact;
  compatibility and permission vocabularies are separate closed authorities; Python dependencies use a bounded
  PEP-508 parser for extras, version sets, direct references, and markers; invalid/no-candidate declarations retain
  locator-only routing provenance; deterministic typed-value scalar overages report
  `DETERMINISTIC_LIMIT_EXCEEDED/VALUE_SCHEMA_BOUND`; and attribution/semantic discriminators are field-bound.
- Updated architecture, dependency rules, package registration, exports, test discovery, README status, and the
  frozen lockfile. No database schema was required or changed.

## 6. File inventory

### Modified tracked files

- `README.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/architecture/DEPENDENCY_RULES.md`
- `packages/analysis/src/index.ts`
- `packages/contracts/src/contracts.unit.test.ts`
- `packages/contracts/src/index.ts`
- `packages/testing/package.json`
- `pnpm-lock.yaml`
- `scripts/check-dependency-boundaries.mjs`

### Added files

- `docs/milestones/M03_SPEC.md`
- `docs/milestones/M03_REPORT.md`
- M03 analysis contract, validator, fake adapter, and tests under `packages/analysis/src/`
- M03 request/value/bundle contracts and tests under `packages/contracts/src/`
- The complete `packages/extraction/` package and its unit, fixture, and integration tests
- `packages/testing/src/m03-extraction.integration.test.ts`

Removed files: none. Migration files added or modified: none.

## 7. Acceptance-criteria traceability

The table below reproduces all 133 approved acceptance criteria individually. PASS means the cited direct M03 evidence and the fresh required local gates passed; it does not mean independent acceptance or commit authorization.

| AC ID      | Exact requirement                                                                                                                                                                                         | Implementation path                                                                                                             | Direct test/fixture                                                                                                                                                 | Result |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| M03-AC-01  | Only a current active identity-resolved M02 handoff is eligible                                                                                                                                           | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-02  | Every request binds the current observation/source link/decision plus stable Resource/version identities without equating current and first-observed snapshots                                            | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-03  | Exactly all 20 registry fields validate against the closed discriminated value schemas and mapping matrix                                                                                                 | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-04  | Deterministic candidates remain distinguishable from AI proposals                                                                                                                                         | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-05  | Unknown, missing, unsupported, conflicting, and review states are explicit                                                                                                                                | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-06  | Exact commands and authored order are preserved and never executed/invented                                                                                                                               | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-07  | Version precedence is deterministic and conflicts remain visible                                                                                                                                          | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-08  | License states are exact and no license/default is invented                                                                                                                                               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-09  | Permissions are never declared absent from silence or unsupported inspection                                                                                                                              | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-10  | Compatibility evidence class never overstates format/source evidence as tested                                                                                                                            | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-11  | Dependencies are direct-only and incompleteness remains explicit                                                                                                                                          | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-12  | AI is bounded, tool-free, provider-neutral, attributable, and cannot overwrite deterministic truth                                                                                                        | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-13  | Document and snapshot-metadata references satisfy their exact XOR/locator/ownership contract and are not M04 EvidenceItems                                                                                | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-14  | Fixed fake-provider fixtures reproduce IDs/fingerprints; attempt-result formulas distinguish output/status while identical effective input replays without a second call                                  | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-15  | Every success/rejection/failure/cancellation/supersession boundary returns the exact closed union arm and replays exactly                                                                                 | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-16  | Incomplete/excluded source cannot become an absence claim                                                                                                                                                 | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-17  | Required safety/size ceilings fail closed without secret or source-text echo                                                                                                                              | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-18  | M03 creates no canonical Graph promotion, durable migration, Claim/EvidenceItem, draft, approval, or publication                                                                                          | `scripts/check-source-safety.mjs`; whole-patch Git inventory; unchanged M02 authority files                                     | `pnpm test`; `pnpm verify`; M02 SHA-256 and migration/diff integrity checks                                                                                         | PASS   |
| M03-AC-19  | M00–M02 behavior and authority bytes remain unchanged                                                                                                                                                     | `scripts/check-source-safety.mjs`; whole-patch Git inventory; unchanged M02 authority files                                     | `pnpm test`; `pnpm verify`; M02 SHA-256 and migration/diff integrity checks                                                                                         | PASS   |
| M03-AC-20  | The complete required gate set passes under pinned runtime without live credentials                                                                                                                       | `scripts/check-source-safety.mjs`; whole-patch Git inventory; unchanged M02 authority files                                     | `pnpm test`; `pnpm verify`; M02 SHA-256 and migration/diff integrity checks                                                                                         | PASS   |
| M03-AC-21  | Conflict/missing/unsupported/review bundles remain M04-bindable while later progression stays blocked where required                                                                                      | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-22  | Analysis configuration and every derived ID/fingerprint use exact canonical formulas plus byte-equality collision checks                                                                                  | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-23  | Frozen M01 metadata insufficiency remains explicit; unproven release targets/dates never become exact facts                                                                                               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-24  | Best-for and Not-ideal proposals have exact target-field and cross-field projection semantics                                                                                                             | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-25  | Secret-like command bytes remain only in restricted M01 source plus the closed transient buffer; serialized M03 preserves locator/hash without echo                                                       | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-26  | Every numeric limit passes at-limit and fails/contains exactly one-over without arbitrary truncation                                                                                                      | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-27  | Every field has positive and negative/unknown exact golden coverage                                                                                                                                       | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-28  | Every mutable predecessor row, including candidate review state, has an exact decimal-string version; immutable and complete topology/review sets have exact canonical fingerprints                       | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-29  | Every outer field status and nested state enforces exact value/null/empty/support-ID/conflict-ID/claim/confidence invariants, including deterministic mixed-support derivation                            | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-30  | Deterministic and AI-owned overflows select different exact result arms without partial merge                                                                                                             | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-31  | Provider-owner-only, ambiguity with/without candidates, material missing, and nonmaterial unsupported branches have exact outcomes                                                                        | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-32  | Repository/release/tag/license/fork metadata eligibility, locators, and aggregate fingerprints are one consistent closed contract                                                                         | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-33  | Every ambiguity reason/cardinality combination has an exact valid route or invalid-response outcome and one deterministic outer status                                                                    | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-34  | Successful syntactic repair is distinguishable from unrecovered analysis error and does not itself force review                                                                                           | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-35  | Two actual AI calls are accepted; a requested third call is never invoked or represented as a provider attempt and returns the exact deterministic failure arm                                            | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-36  | AI-owned review fields use exact empty values/supports and `NO_CLAIM`; deterministic installation/maintenance exceptions retain typed values with truthful claim class                                    | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-37  | Raw local proposal ordinals resolve in the exact hash/attempt/field-ID/ambiguity-ID order without provider-supplied derived IDs                                                                           | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-38  | Every sub-operation receives exactly the complete declared deterministic candidate/conflict membership and fingerprint                                                                                    | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-39  | Every field/value candidate has one exact normalized-key formula; mismatches fail and equal-key distinct values remain visible                                                                            | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-40  | Provider SPDX metadata has an executable candidate/reference/key rule and deterministic precedence/conflict behavior                                                                                      | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-41  | Resource/version current statuses and every simultaneous eligibility failure select exact initial/final outcomes                                                                                          | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-42  | Accepted terminal tuples replay across new keys; retry execution requires an input-identity change                                                                                                        | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-43  | Categories, Tasks, capabilities, and all semantic values share the exact registry-bound taxonomy-ID XOR                                                                                                   | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-44  | Deterministic candidates encode exact/inferential support nature and single/mixed deterministic claim class; unsupported/conflicting support unions are closed                                            | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-45  | Every license value enforces SPDX/custom-hash XOR in candidates and resolutions                                                                                                                           | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-46  | Every retained/null excerpt follows exact locator, sensitive-omission, clipping, priority, and hash rules                                                                                                 | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-47  | The complete enabled plan has nine exact fingerprinted operation partitions and rejects cross-partition references                                                                                        | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-48  | Attempt/proposal/terminal IDs satisfy exact equality invariants and every proposal variant has a total comparator                                                                                         | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-49  | Normalized members follow exact Unicode/ecosystem/SPDX/SemVer transforms and every field family has deterministic same-key reconciliation                                                                 | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-50  | Recovered analysis derives only from the invalid-primary/succeeded-repair pair without later-dependent attempt identity                                                                                   | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-51  | Exact commands hash only command-substring bytes and use unique enum-ordered safety indicators                                                                                                            | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-52  | The bounded bundle extractor registry closes every candidate/proposal/field reference, ownership set, parser set, order, fingerprint, and collision                                                       | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-53  | Bundle analysis attribution serializes exact provider/adapter/model/settings/plan bytes and matches request/attempt fingerprints                                                                          | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-54  | Every locator has exact scalar domains, owning-record vocabulary, line/newline/EOF behavior, and release-ordinal bounds                                                                                   | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-55  | Semantic identity, provenance identity, within/cross-tier reconciliation, agreeing versions, and canonical-name ties are deterministic                                                                    | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-56  | AI nested/enclosing references are equal, interpretation equality excludes provenance, and conflict references are the exact member union                                                                 | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-57  | Invalid attempts carry identity-bound invalidity class; only syntactic/schema-shape invalidity authorizes one repair                                                                                      | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-58  | Bundle warnings are the exact nested/event union and the global occurrence ceiling is deterministic                                                                                                       | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-59  | Every taxonomy-bearing value binds the exact empty v1 registry and rejects arbitrary matched IDs                                                                                                          | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-60  | SPDX, release-channel, secret, permission, and prohibited-claim policy tables have executable bytes/fingerprint and exact boundary fixtures                                                               | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-61  | Line locators exactly preserve frozen M01 LF/CRLF/bare-CR/EOF-tail semantics                                                                                                                              | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-62  | License semantic identity canonicalizes equivalent SPDX expressions while retaining exact source provenance                                                                                               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-63  | Malformed request bytes have one digest-bound pre-domain terminal arm without request identity, predecessor access, or AI work                                                                            | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-64  | Equal request/input hashes require byte-equal retained preimages before idempotency, join, or tuple replay                                                                                                | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-65  | Candidate, proposal, field, and orchestrator warning issuers, propagation, and per-surface occurrence counts are exact and reject unauthorized codes                                                      | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-66  | Static permission rules bind engine/language/default semantics in policy identity and reject named false positives                                                                                        | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-67  | Enabled analysis accepts only the exact authorized deterministic-fake tuple, settings, and nine-operation plan                                                                                            | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-68  | Extractor references follow one status-discriminated parser-set contract with no contradictory fallback                                                                                                   | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-69  | Compound target-user and installation leaf/aggregate list counts accept at 256 and select the exact deterministic/AI failure at 257                                                                       | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-70  | Every nested source/provider/configuration/policy/raw-output hash compares its retained exact preimage before parent identity, join, replay, or merge                                                     | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-71  | Version/license conflicts always serialize null preferred candidate and false noncanonical-guidance state                                                                                                 | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-72  | Exact command boundaries, continuations, ordered safety indicators, overlaps, and near misses are policy-fingerprinted and deterministic                                                                  | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-73  | Deterministic manifest, Skill, documentation, changelog, and license parsing uses only the exact fingerprinted selector/pointer/shape artifact                                                            | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-74  | Maintenance signals enforce exact boolean/null/current-entry/source-reference/support cross-field invariants                                                                                              | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-75  | Frozen original and replacement M02 job fingerprints are handled as available opaque/payload-bound facts without requiring nonexistent preimages                                                          | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-76  | Every raw byte member uses canonical padded Base64/length JSON shapes and reproduces non-ASCII/newline golden fingerprints                                                                                | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-77  | Every deterministic selector/member/declaration has one exact typed constructor, locator, support class, confidence, and invalid-shape route                                                              | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-78  | The policy fingerprint hashes the exact approved-spec bytes between fixed markers with unambiguous LF boundaries                                                                                          | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-79  | Safe partial installation retains its typed path only in `REVIEW_REQUIRED` with exact context warning                                                                                                     | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-80  | Original command bytes, normalized serialized text, safety input, continuation grouping, and finite tokenizer failures are exact                                                                          | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-81  | M01 disposition and path classes map to exactly the declared affected fields and warnings                                                                                                                 | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-82  | Complete-corpus absence uses inventory/topology-bound references and distinguishes absent, empty, invalid, and excluded changelog/deprecation inputs                                                      | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-83  | Provider SPDX null/sentinel/invalid/unallowlisted/allowlisted cases select exact no-candidate/candidate/review behavior                                                                                   | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-84  | Semantic operations receive exact candidate-independent README/Skill section references and can produce fully attributable proposals                                                                      | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-85  | Command byte ranges, extraction transform, original hash, normalized value, safety input, and escaped-state tokenizer are unambiguous                                                                     | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-86  | Original/replacement M02 jobs project every required lineage/replacement column with exact discriminator and available payload bytes/null                                                                 | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-87  | Input identity contains exactly the ordered policy literal, field registry, taxonomy registry, and extractor registry artifact bytes                                                                      | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-88  | Frozen M01 dispositions/reason codes and exact supported/unsupported extension classes map to one closed field-affinity warning/error route                                                               | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-89  | Maintenance deprecation absence, invalidity, false, true, and disagreement have exact nullable-value/support/warning/status behavior                                                                      | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-90  | Every deterministic route has exact extractor/source/support/class/confidence/locator construction plus title and installation grammars                                                                   | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-91  | Skill, manifest, license-file, and provider license signals use one total null/sentinel/invalid/unallowlisted/allowlisted/custom classifier                                                               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-92  | Provider-owner-only attribution stays missing while explicit untyped attribution routes both fields to review, without cross-field conflicts                                                              | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-93  | Frozen M01 empty/nonempty/LF/CRLF/bare-CR line counts include an addressable empty terminal line after final LF                                                                                           | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-94  | Every frozen disposition and unique-sorted reason-array shape has one literal legal warning route or eligibility failure                                                                                  | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-95  | Unavailable or invalid installation input has one empty typed review arm with `NO_CLAIM` and empty support/evidence                                                                                       | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-96  | Archived false, explicit deprecated false, and no-declaration false use provider, document, and inventory-absence provenance respectively                                                                 | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-97  | Field registry content is the exact canonical 2,124-byte 20-row JSON literal with its declared SHA-256                                                                                                    | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-98  | Command extraction has exact opening-indent, per-line removal, console prompt, blank/comment, CRLF, continuation, and mixed-indent behavior                                                               | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-99  | Ambiguity signals are fixed-confidence/no-warning and low-confidence field proposals route every deterministic projection target exactly                                                                  | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-100 | AI citations are limited to supplied nonsensitive candidate-backed references and candidate-independent non-null excerpts                                                                                 | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-101 | Inventory absence, repository/source fallbacks, license locator variants, and pyproject file-reference edge cases have truthful total provenance                                                          | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-102 | Static permission scans are per-line, deterministic nonoverlapping within rule, overlap-preserving across rules, and line-locator-bound                                                                   | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-103 | Source-revision mismatch is attempt-level while malformed source-revision field shape is separately rejected by contract schema                                                                           | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-104 | Policy-fingerprinted contact detection prevents email/phone-like value or locator bytes entering fields, excerpts, commands, AI boundaries, diagnostics, persistence, or M04 payloads                     | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-105 | YAML-front-matter and TOML members use exact safe `DATA_POINTER` resolution and canonical value excerpts                                                                                                  | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-106 | Semantically equal version/SPDX candidates select one deterministic tier/byte/ID winner or canonical SPDX value while preserving provenance                                                               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-107 | Every maintenance candidate and positive aggregate uses one exact `REPOSITORY_METADATA` claim class                                                                                                       | `packages/contracts/src/m03-bundle.ts`; `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`      | `packages/contracts/src/m03.contract.test.ts`; `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`        | PASS   |
| M03-AC-108 | Low-confidence or AI-only ambiguity preserves deterministic values/status/support/evidence/conflicts and routes review only without deterministic truth                                                   | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-109 | Every ambiguity signal cites exactly the union of its listed candidate and interpreted-proposal references                                                                                                | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-110 | Static matching uses exact M01 lines, `giu` UTF-16 `lastIndex`, nonoverlap/overlap rules, and whole-line reference mapping                                                                                | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-111 | Command IDLE/CONTINUING transitions define every blank/comment/indent/EOF continuation outcome                                                                                                            | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-112 | Source revision uses representable snapshot references while observation/source-link provenance remains identity-bound in value/projection                                                                | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-113 | Whole-document JSON/YAML/TOML/requirements invalidity selects one first-match warning and literal affected-field set                                                                                      | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-114 | `OperationInputV1` serializes exact all/citable reference sets, source-input states, duplicate occurrences, omissions, bounds, and analysis fingerprint                                                   | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-115 | One or more coherent command-bearing paths with any incomplete member use the representable `EXPLICIT_PARTIAL` review arm and retain every safe authored path                                             | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-116 | Configuration declared type, sensitive name, secret/contact defaults, retention, and exact candidate/field warning occurrences follow one precedence-ordered cross-product                                | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-117 | Contact-bearing candidate-independent references map through non-ambiguity operation rows, deduplicate affected fields, preserve deterministic truth, and remain noncitable                               | `packages/analysis/src/m03-analysis.ts`; `packages/analysis/src/m03-fake-adapter.ts`; `packages/extraction/src/orchestrator.ts` | `packages/analysis/src/m03-analysis.contract.test.ts`; `packages/testing/src/m03-extraction.integration.test.ts`                                                    | PASS   |
| M03-AC-118 | Secret/contact source, locator, and raw-output bytes may occupy only the closed Sections 11.1/11.5/16 transient exception and never cross record, persistence, provider, observability, or M04 boundaries | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-119 | Bundle source references equal the canonical unique support/routing/operation/AI union, with no extra, missing, dangling, duplicate, or byte-colliding record                                             | `packages/contracts/src/m03.ts`; `packages/extraction/src/orchestrator.ts`                                                      | `packages/contracts/src/m03.contract.test.ts`; `packages/extraction/src/orchestrator.integration.test.ts`                                                           | PASS   |
| M03-AC-120 | Frozen YAML 1.2.2, TOML 1.0.0, CommonMark/GFM, front-matter delimiter/body, and literal DATA_POINTER rules yield deterministic downstream candidates and AI inputs                                        | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-121 | Installation paths serialize construction facts and a total table covers label/path mixtures while review claim class truthfully reflects exact/inferred deterministic supports                           | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-122 | Configuration TYPE uses a closed `textKey` token map, rejects aliases, represents exact `UNKNOWN`, and deterministically routes every default/sensitivity overlap                                         | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-123 | Raw Markdown heading/block selection, inline-literal behavior, nested/duplicate ranges, and post-front-matter absolute line/byte mapping reproduce exact references                                       | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-124 | Every source-derived value and locator string/token is secret/contact scanned before construction; matched bytes use privacy-safe references and remain noncitable across all surfaces                    | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-125 | Inferred installation mechanisms use exact Markdown provenance, `INFERENTIAL`/`FORMAT_INFERENCE`/`0.70`, structural key, exact warning behavior, and truthful review aggregation                          | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-126 | Installation grouping uses discriminated null/labeled keys, preventing literal-sentinel collision while deterministically merging equal and conflicting divergent paths                                   | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-127 | Configuration first-match routing covers recognized/unknown/invalid TYPE crossed with name secret/contact and default secret/contact, with exact candidate, warning, and reference outcomes               | `packages/contracts/src/m03-values.ts`; `packages/extraction/src/deterministic.ts`; `packages/extraction/src/normalization.ts`  | `packages/contracts/src/m03-values.contract.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; `packages/extraction/src/normalization.unit.test.ts` | PASS   |
| M03-AC-128 | Sensitive locator bytes serialize only typed safe data/digest; deterministic or AI conflicts remain complete while other fields follow exact sensitive-reference precedence                               | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-129 | Nonempty installation review claim class is `SOURCE_FACT`, `FORMAT_INFERENCE`, or `MIXED_DETERMINISTIC_SUPPORT` exactly from retained deterministic support classes                                       | `packages/extraction/src/commands.ts`; `packages/extraction/src/deterministic.ts`                                               | `packages/extraction/src/commands.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`                                                            | PASS   |
| M03-AC-130 | Sensitive warning equations fix exact candidate/field/bundle occurrences for commands, configurations, suppressed values, candidate excerpts, operation inputs, and locators                              | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-131 | Shared sensitive-reference precedence preserves complete deterministic/AI conflicts, routes ordinary states to empty review, and retains installation/maintenance typed review safely                     | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-132 | A safe retained candidate with unrelated sensitive excerpt uses null excerpt, `OMITTED_SENSITIVE`, no citability, exact candidate/field warnings, and conflict-preserving precedence                      | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |
| M03-AC-133 | Complete ordinary sensitive-locator preimages are authorized only for Section 11.1 collision checks under the same restricted transient lifecycle and zero-observability guarantees                       | `packages/extraction/src/provenance.ts`; `packages/extraction/src/permissions.ts`; `packages/extraction/src/deterministic.ts`   | `packages/extraction/src/provenance.unit.test.ts`; `packages/extraction/src/deterministic.fixture.test.ts`; adversarial extraction gate                             | PASS   |

## 8. Verification evidence

All passing commands ran from the repository root with pinned Node 22.23.1 and pnpm 11.7.0.

| Command                                                                                                                                 | Actual result                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                                                                                        | PASS; frozen dependency graph installed without lockfile mutation                            |
| `pnpm lint`                                                                                                                             | PASS; ESLint, 12-package dependency boundary, and acquired-source safety checks green        |
| `pnpm typecheck`                                                                                                                        | PASS; 21/21 tasks                                                                            |
| `pnpm test:unit -- extraction`                                                                                                          | PASS; 16 files, 177 tests                                                                    |
| `pnpm test:contract -- extraction`                                                                                                      | PASS; 13 files, 145 tests                                                                    |
| `pnpm test:fixtures -- extraction`                                                                                                      | PASS; 4 files, 58 tests                                                                      |
| `pnpm test:adversarial -- extraction`                                                                                                   | PASS; 3 files, 21 tests                                                                      |
| `pnpm test:unit -- acquisition classification identity`                                                                                 | PASS; exact command; 16 files, 177 tests                                                     |
| `pnpm test:contract -- acquisition classification identity`                                                                             | PASS; exact command; 13 files, 145 tests                                                     |
| `pnpm test:fixtures -- acquisition classification identity`                                                                             | PASS; exact command; 4 files, 58 tests                                                       |
| `pnpm test:adversarial -- acquisition classification identity`                                                                          | PASS; exact command; 3 files, 21 tests                                                       |
| `pnpm exec vitest run packages/extraction/src/orchestrator.integration.test.ts packages/testing/src/m03-extraction.integration.test.ts` | PASS; 2 files, 16 tests                                                                      |
| `pnpm test:integration -- extraction`                                                                                                   | PASS; 6 files, 122 tests, 484.81s                                                            |
| `pnpm test`                                                                                                                             | PASS; 42 files, 523 tests, 614.99s                                                           |
| `pnpm verify`                                                                                                                           | PASS; lint, format, 21/21 typecheck tasks, 177 unit, 145 contract, 12/12 build tasks         |
| clean-checkout build bootstrap                                                                                                          | PASS; 12/12 packages built after frozen install                                              |
| clean-checkout focused Section 28                                                                                                       | PASS; both exact filter groups: 177 unit, 145 contract, 58 fixture, and 21 adversarial tests |
| clean-checkout integration                                                                                                              | PASS; 6 files, 122 tests, 752.49s                                                            |
| clean-checkout full regression                                                                                                          | PASS; 42 files, 523 tests, 599.45s                                                           |
| clean-checkout `pnpm verify`                                                                                                            | PASS; complete required local/CI gate                                                        |
| `git diff --check`                                                                                                                      | PASS; no whitespace errors                                                                   |
| approved specification hash                                                                                                             | PASS; exact SHA-256 `3946c151...9949f80`                                                     |
| M02 authority integrity                                                                                                                 | PASS; M02 spec/report unchanged from HEAD                                                    |
| migration inventory                                                                                                                     | PASS; no changed migration paths                                                             |
| targeted secret/private-key scan                                                                                                        | PASS; zero matches outside dependencies/build output and the specification                   |
| skipped-test scan                                                                                                                       | PASS; zero skip/todo matches in packages, scripts, or fixtures                               |

The first pinned-runtime invocation of the exact integration command completed 118 of 119 tests and timed out in
the unchanged M02 PostgreSQL Serializable-retry test at its 60-second limit. The test body passed on targeted
diagnostic rerun, and an unchanged rerun of the exact command then passed all 119 tests. This isolated timing flake
is retained here rather than relabeled as a first-run pass.

A final source-only clean clone was created from baseline HEAD, the complete tracked diff and all untracked
candidate files were applied, and the approved specification hash was rechecked. Its frozen install first failed
inside the network-restricted sandbox on uncached registry packages, then passed with registry access without
lockfile mutation. After the repository's supported `pnpm build` bootstrap, the complete Section 28 focused
sequence—including all four exact acquisition/classification/identity filtered commands—exact integration command,
full regression suite, and `pnpm verify` all passed. One full-suite invocation was stopped before completion after
an operator runtime-path typo caused the engine check to report Node 24; the correctly pinned Node 22.23.1 rerun is
the only clean full-suite result cited above. An earlier pre-final clone
also proved that the raw first focused command cannot resolve workspace exports before build because a fresh
checkout has no package `dist` outputs. This existing workspace prerequisite is not presented as a raw-post-install
test pass.

The first final clean full-suite invocation timed out the M03 integration test at Vitest's five-second default
under concurrent full-suite load, without an assertion mismatch. The identical test passed alone in 2.17s; the
unchanged clean `pnpm test` rerun then passed all 42 files and 486 tests. The successful unchanged rerun is the
clean full-suite result cited above, while the initial timing failure remains part of the verification chronology.

The full suite emitted the existing `pg` deprecation warning about calling `client.query()` while a client is
already executing a query. It did not fail any test. M03 adds no PostgreSQL adapter or migration; the warning is a
pre-existing harness limitation and should be handled separately from M03 acceptance.

For the final v6 bytes, the first local integration attempt was prevented from starting PostgreSQL because the
sandbox could not access the Docker socket. Its authorized unchanged rerun passed 6 files / 119 tests in 281.52s;
the following local full suite passed 42 files / 495 tests in 273.70s. A fresh source-only reconstruction from
baseline `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7` then reused all 353 frozen packages with zero downloads after
the expected sandbox-DNS retry, built 12/12 packages from scratch, passed all eight focused commands and
`pnpm verify`, passed integration 6/119 in 268.26s, and passed the full suite 42/495 in 284.51s without a retry.

For the final post-v6 remediation bytes, all eight exact focused commands passed with 175 unit, 139 contract, 52
fixture, and 21 adversarial tests for both specified positional filter groups. `pnpm verify` passed with 21/21
typecheck tasks and 12/12 builds. The first complete-suite attempt passed 505 of 506 tests; one unchanged M02
PostgreSQL test did not execute because its ephemeral container ports were not bound within 10 seconds. A focused
diagnostic rerun then passed that test body but, as expected, could not satisfy the suite-wide receipt finalizer
with the other 28 tests filtered out. The unchanged complete suite was rerun serially and passed 42/42 files and
506/506 tests in 381.33s. The exact extraction integration command then passed 6/6 files and 119/119 tests in
307.48s.

A new source-only clone from baseline `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7` received the same 39 candidate
files and revalidated the approved specification hash. The sandboxed frozen install encountered expected DNS
denials; its authorized unchanged rerun reused all 353 packages, downloaded zero, and did not mutate the lockfile.
The raw focused sequence initially demonstrated the documented fresh-workspace prerequisite by failing package
entry-point resolution before any relevant assertion ran. After a from-scratch 12/12 package build, all eight
focused commands, typecheck, lint, format check, build, `pnpm verify`, and `git diff --check` passed. The clean exact
integration command passed 6/6 files and 119/119 tests in 273.18s, and the clean complete suite passed 42/42 files
and 506/506 tests in 262.64s. The only runtime warning was the pre-existing `pg` deprecation warning described
above.

For the v9 remediation bytes, the focused reviewer-blocker matrix passed 67/67 tests. All eight exact positional
commands passed with 175 unit, 142 contract, 58 fixture, and 21 adversarial tests in both filter groups. Typecheck,
lint (including source-safety and 12-package dependency boundaries), format, build, `pnpm verify`, and
`git diff --check` passed. The exact extraction integration command passed 6/6 files and 121/121 tests in 275.97s.
Two complete-suite attempts encountered the inherited Docker/Testcontainers 10-second port-binding startup flake:
the first passed 516/517 tests before one M02 PostgreSQL test could start, and the second passed 516/517 before a
different M02 PostgreSQL test could start. Neither failure reached an application assertion. With no ephemeral
PostgreSQL container remaining, an unchanged retry passed 42/42 files and 517/517 tests in 265.80s. The failures
and successful retry are all retained in this chronology; only the successful unchanged retry is cited as the
final full-suite result.

The exact 39-file v9 candidate was then reconstructed over a fresh local clone of baseline
`c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7`. Frozen installation reused all 353 packages with zero downloads and
did not mutate the lockfile. A from-scratch build passed 12/12 packages with zero cache hits. All eight exact
focused commands passed with the same 175/142/58/21 counts, the exact integration command passed 6/6 files and
121/121 tests in 418.35s, and the complete suite passed 42/42 files and 517/517 tests in 386.03s. The first clean
`pnpm verify` invocation caught only a report-formatting change introduced while recording these results; after
formatting and synchronizing that report-only change, the unchanged source candidate passed the clean verification
gate. This chronology does not relabel the formatting failure as a pass.

For the v11 remediation bytes, the first two exact clean integration attempts each passed 121/122 tests before a
different unchanged M02 PostgreSQL test failed solely because Testcontainers did not bind its ephemeral port within
10 seconds. Neither failure reached an application assertion. A third unchanged attempt was interrupted when its
temporary execution session was lost during context transition and is not reported as test evidence. After the
temporary clone and pinned runtime were cleaned up, a fresh 39-file reconstruction reused all 353 frozen packages
with zero downloads and rebuilt 12/12 packages with zero cache hits. One pre-build probe ran no tests because
workspace package entry points had not yet been generated; a subsequent correctly pinned attempt reached all 122
tests but Docker Desktop was stopped, so PostgreSQL containers could not start. After Docker was restored, the
unchanged exact command passed 6/6 files and 122/122 tests in 378.19s under Node 22.23.1. The earlier unchanged
clean full-suite pass of 42/42 files and 519/519 tests in 257.80s remains the cited v11 full-regression result.

The final v12 source-only reconstruction applied the exact 39 candidate files to baseline
`c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7`. Its pinned frozen install reused 353/353 packages with zero downloads
and no lockfile mutation. A zero-cache build passed 12/12 packages; all eight exact focused commands reproduced 175
unit, 144 contract, 58 fixture, and 21 adversarial tests. The exact integration command then passed 6/6 files and
122/122 tests in 261.01s, and the complete suite passed 42/42 files and 520/520 tests in 257.69s without retry.

The final v13 source-only reconstruction applied the exact 39 candidate files to the same baseline. Its pinned
frozen install reused 353/353 packages with zero downloads and no lockfile mutation, and its zero-cache build passed
12/12 packages. All eight exact focused commands reproduced 175 unit, 145 contract, 58 fixture, and 21 adversarial
tests. The first exact integration invocation passed 120/122 tests before two unchanged M02 PostgreSQL concurrency
tests reached their 60-second limits; neither failure was an M03 assertion mismatch. With no test container left
running, the unchanged exact command passed 6/6 files and 122/122 tests in 404.56s. The following unchanged complete
suite passed 42/42 files and 521/521 tests in 363.45s without retry.

For the post-v14 canonical-JSON remediation bytes, the frozen M00 `canonicalJson` implementation and file bytes
were restored exactly to baseline SHA-256 `626374400cddfbf398cd2844a8fec9c3a2bacfaa663d6b2ee531565c691cc724`.
M03 now owns a separate unsigned UTF-8/code-point canonical serializer, and paired supplementary-plane/BMP
goldens prove the opposite M00 and M03 orderings. The first focused six-file run could not resolve the new workspace
export because `packages/contracts/dist` was stale; after the supported 12/12 build bootstrap, the unchanged matrix
passed 6 files / 56 tests. The first two `pnpm verify` attempts caught, respectively, four unnecessary TypeScript
assertions and one report-independent formatting defect; after those mechanical corrections, the final gate passed
with 177 unit and 145 contract tests, 21/21 typecheck tasks, and 12/12 builds.

The first exact integration attempt could not access the sandboxed Docker socket. With Docker access, the next run
passed 121/122 tests and timed out only the M03 deterministic-fake replay case at Vitest's five-second default,
without an assertion mismatch. That case passed alone in 1.40s; the unchanged exact command then passed 6/6 files
and 122/122 tests in 484.81s. The first complete-suite attempt likewise lacked Docker access; its authorized
unchanged rerun passed 42/42 files and 523/523 tests in 614.99s. Every unsuccessful attempt and the exact successful
rerun remain part of this chronology rather than being relabeled as a first-run pass.

The post-v14 exact 39-file candidate was then reconstructed over a fresh local clone of baseline
`c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7`. Its first frozen install encountered the expected sandbox DNS
denials; the authorized unchanged rerun reused 353/353 packages, downloaded zero, and did not mutate the lockfile.
A forced zero-cache build passed 12/12 packages. All eight exact focused commands reproduced 177 unit, 145
contract, 58 fixture, and 21 adversarial tests for both filter groups. `pnpm verify` passed, the exact integration
command passed 6/6 files and 122/122 tests in 752.49s, and the complete suite passed 42/42 files and 523/523 tests
in 599.45s without retry. The clean candidate retained the exact approved M03 specification hash, 9 tracked
modifications, 30 untracked files, and the baseline-exact M00 primitive hash.

## 9. Review findings and remediations

- Strict self-review found hand-written YAML/TOML subsets that were weaker than the specification. They were
  replaced with pinned parsers and negative tests for malformed, duplicate, tagged, aliased, interpolated, and
  wrong-shaped inputs.
- Markdown source-reference review found caller-transformed excerpts could decorate the same line locator
  differently. `LINE_RANGE` excerpts now derive from the exact original document range, including CRLF handling.
- Whole-patch provenance review found candidate-independent documentation was initially over-selected and could
  remain in disabled-analysis bundles. References are now operation-heading-scoped, partition-specific, and
  excluded entirely when analysis is disabled; dedicated fixtures prove both positive and negative behavior.
- Declaration review corrected wrong-type routing, configuration heading scoping, fenced-source exclusion,
  permission closure, Python authors/maintainers and optional dependencies, inline license validation, list-marker
  handling, output-length diagnostics, and exact observed-count reporting.
- Whole-patch remediation separated basic request parsing from expected-state and full request validation, closed
  every result/diagnostic arm, enforced `maxOutputTokens` 1..16384, and added exact idempotency/effective-tuple and
  full predecessor freshness behavior.
- Normalization remediation added the pinned Unicode 15.1 case-fold table, exact whitespace/SemVer/PEP 503/SPDX
  behavior, complete value-family equality, and unsigned UTF-8 canonical ordering.
- Provenance and parser remediation added owning metadata discriminators, exact LF/CRLF/bare-CR/EOF behavior,
  sensitive locator collision retention, the exact source-reference registry union, parser-backed CommonMark
  selection, and byte-exact command hashing before newline normalization.
- AI and collision remediation added complete operation partitions, global excerpt selection, raw-output and all
  nested input/content preimage collision checks, lifecycle timeout/failure arms, and exact terminal diagnostic
  goldens before primary and before syntactic repair.
- Final reviewer-blocker remediation replaced regex Markdown/GFM recognition with the exact parser profile;
  canonicalized serialized operation reference IDs independently from excerpt allocation priority; extended
  collision authority through schema-valid invalid-state requests plus analysis-input, invocation, result,
  extraction-ID, and output-fingerprint parents; and identity-folded valid Unicode 15.1 scalars without case-fold
  mappings instead of rejecting later assigned code points.
- A separate strict read-only review then reproduced two further blockers: `SKILL.md` front matter still entered
  Markdown installation parsing, and Zod string bounds counted UTF-16 code units while accepting lone surrogates.
  Remediation now supplies only the exact closed body (or empty unclosed body) to every Markdown consumer with
  absolute locator offsets, and validates every bounded user-facing value by Unicode scalar count. Direct goldens
  prove front-matter command exclusion, unclosed-body exclusion, post-boundary byte mapping, 200 astral scalars,
  the 201-scalar rejection, and lone-surrogate rejection.
- The second strict read-only pass confirmed those two repairs and the prior five blocker areas, then reproduced
  one delimiter near-miss: generic physical-line scanning accepted bare-CR `---` boundaries even though the
  front-matter profile permits only LF/CRLF/EOF delimiter lines. The body state machine now rejects bare-CR openers
  and closers explicitly. Direct goldens cover bare-CR opener, bare-CR closer, and valid CRLF body/offset behavior.
- The latest independent whole-patch review returned three bounded blockers. `M03-LINE-02` found provenance and
  static-permission scanning treated bare CR as a delimiter or discarded terminal bare CR. `M03-PARSER-03` found
  front-matter and changelog parsing bypassed the frozen authoritative line/ATX profiles. `M03-GATE-02` found four
  exact acquisition/classification/identity commands were not individually evidenced. Remediation added one shared
  frozen M01 line/front-matter authority, routed provenance, permissions, command bodies, deterministic metadata,
  requirements, license, and changelog extraction through it, and used the frozen raw ATX parser for changelog
  selection. Focused goldens cover CRLF, interior/terminal bare CR, final-LF terminal lines, front-matter bare-CR
  near-misses, blockquoted/Setext false headings, and valid leading-space/closing-hash ATX headings. All four exact
  missing commands now pass locally and in the source-only clean checkout.
- A final independent read-only pass then found two remaining consequences of those blockers. CommonMark and GFM
  source positions still counted bare CR as a Markdown line boundary before their locators entered the frozen-M01
  line domain, and README YAML delimiters still entered the `SKILL.md` metadata parser. Markdown parser input now
  replaces only bare CR with a same-width non-line-boundary scalar while retaining CRLF, maps structural positions
  through frozen LF lines, and separately maps fenced command spans back to exact physical bytes so authored bare-CR
  command terminators remain intact. Skill metadata parsing is now guarded to exact `SKILL.md`; README continues
  through ordinary Markdown only. New red-then-green goldens prove bare-CR pseudo-headings cannot create install or
  changelog locators, exact bare-CR command hashing still works, and README delimiters cannot create
  `SKILL_METADATA` candidates or `DATA_POINTER` references.
- The next browser whole-patch review closed the line/parser/gate findings and returned three final bounded
  blockers. Source-reference remediation now accumulates routing authority explicitly at authorized
  no-candidate/withholding constructors, computes the support/routing/operation/AI union independently, excludes
  all records outside it, and sorts/validates the registry strictly by `SourceReferenceId`; union and withheld-route
  fixtures prove the absence of self-authorizing extras. Analysis remediation now supplies complete canonical
  candidate/conflict identities, removes only the derived IDs from serialized operation inputs, and gives the
  trusted orchestrator a required ordinal-aware invocation authorizer; a malicious third-call test proves ordinal
  2/count 3 returns `FAILED/ANALYSIS_CALL_PLAN_INVALID` before a third adapter-spy invocation, with exact limit
  diagnostics. Freshness remediation makes `checkControl` structurally mandatory and retains cancellation-first
  complete-predecessor comparison at every existing post-eligibility guard for both analysis modes. The full
  pinned-runtime Section 28 sequence and a new source-only clean reconstruction then passed against these bytes.
- A fresh strict read-only pass over those bytes found two remaining consequences. Invalid or sensitive
  configuration declarations created locator references but returned before explicitly retaining them in
  `R_routing`; the no-candidate branch now adds those IDs to routing authority, and a configuration golden proves
  the independent no-candidate member plus the complete final union. The prohibited-third-call failure also
  reported zero actual AI calls because no `AnalysisAttemptV1` records survive that closed failure arm; the
  orchestrator now supplies the successfully authorized provider-call count separately from retained attempts.
  The malicious adapter-spy golden proves two actual calls, requested count three, limit two, and rejection before
  a third invocation.
- The v5 browser review then returned one complete five-blocker set. Sensitive H1, Markdown attribution,
  package-author/maintainer, and Python-author/maintainer routes now create the privacy-safe reference before
  suppression, emit both applicable warnings independently, and add the locator ID to `R_routing`. Creator,
  Organization, and deprecation declarations now use the shared absolute post-front-matter line mapping.
  Reconciliation now collapses provenance-distinct semantic equals with canonical citation union, applies exact
  list-family comparators, routes same-key semantic differences to field-specific conflicts, reorders post-AI
  merged lists, and strengthens `ExtractionFieldResultV1Schema` against illegal status/class/support combinations;
  untyped attribution and configuration review use the exact empty-list/`NO_CLAIM` arm. Installation construction
  now uses the discriminated unlabeled/labeled grouping key, merges identical same-label paths and corresponding
  command provenance, renumbers retained paths, and creates `INSTALLATION_PATHS_DIVERGE` for byte-distinct
  same-label content. Maintenance now retains exact invalid declaration references and implements explicit false,
  absence, invalid-null, and true/false disagreement-null review branches without creating a deprecation conflict.
  Direct goldens cover secret-only/contact-only/combined generic routes, absolute Skill lines, duplicate provenance
  union, reversed list ordering, illegal schema arms, identical/divergent/literal-label installation cases, and
  invalid/disagreeing deprecation states.
- The v6 browser review returned three blockers. Sensitivity is now retained transiently from locator and excerpt
  scanning, propagated to the exact owning fields and AI partitions, and never serializes a sensitive preimage.
  Invalid, untyped, suppressed, commandless, sensitive-label/prose, and unclosed-fence constructors now add their
  exact privacy-safe references to explicit routing authority even when another safe installation path survives.
  Candidate-independent references derive their complete owning-field set from every non-detection operation
  membership before occurrence-priority selection. Adjacent first-match remediation makes every sensitive,
  withheld-command, invalid-context, unsafe-command, and mixed-kind installation state
  `UNSAFE_OR_AMBIGUOUS` before the `EXPLICIT_PARTIAL` fallback. Direct goldens cover candidate-backed and
  candidate-independent sensitivity, exact routed declaration lines, mixed safe/sensitive installation paths,
  unclosed fence ranges, operation-owner priority, conflict preservation, and the exact final reference union.
- A final local independent read-only pass found no source blocker and returned `GO — M03 COMMIT READY`. The v7
  browser review nevertheless returned `M03-GATE-03` because the attached report still described v6 evidence and
  the first v7 complete-suite attempt had the Docker startup failure retained above. No source bytes were changed
  for that evidence finding. The complete exact Section 28 sequence, unchanged full-suite rerun, exact integration
  command, and new clean-baseline replay now provide the byte-bound evidence recorded in Section 8. Independent
  browser acceptance remains pending and is not inferred from these local results.
- The v8 browser review verified archive identity and closure of all earlier evidence blockers, then returned five
  final source blockers. Remediation separates compatibility from permission authorities and rejects unknown
  permission kinds; enforces exact package/Skill/Python selector object shapes; parses and validates the complete
  in-scope PEP-508 dependency forms with whole-document `requirements.txt` invalidity; retains exact locator-only
  routing references for invalid/no-candidate structured and license signals; classifies 200/500/1,000 scalar
  one-over values as `DETERMINISTIC_LIMIT_EXCEEDED/VALUE_SCHEMA_BOUND`; and binds attribution handles, creator vs
  organization values, and semantic proposal kinds to their owning fields. Direct red-then-green tests cover each
  blocker, every distinct scalar ceiling, URL-semicolon and marker boundaries, empty extras, trailing version-set
  commas, and malformed PEP-508 tokens. Fresh independent acceptance of these v9 bytes remains pending.
- The independent v9 source review closed those five findings and returned three bounded consequences. The
  PEP-508 parser now accepts the original grammar's compact `and`/`or` marker operators while retaining the
  required whitespace before `in`/`not in`, and rejects the original grammar's forbidden trailing version comma.
  Final AI proposals now use operation-specific target-field/value discriminators, and persisted ambiguity
  proposals bind their target ownership, reason cardinality, confidence/value distinctness, and exact source
  reference union. The deterministic scalar map now includes the 200-scalar `providerRepositoryId` ceiling, so a
  one-over input fails as `DETERMINISTIC_LIMIT_EXCEEDED/VALUE_SCHEMA_BOUND`. Red-then-green tests reproduce all
  three findings; the pinned local gates pass with 143 contract, 122 integration, and 519 total tests. Fresh
  independent acceptance of the reconstructed v10 bytes remains pending.
- The final v10 source-only reconstruction was created from baseline
  `c6bb0c298dbb386a3ddf1a5363b98a74f2bb6db7` plus all 39 candidate files. Its first frozen-install process was
  stopped after restricted DNS entered a doomed retry cycle with no package added; the authorized unchanged
  frozen install then reused 353/353 packages with zero downloads and no lockfile mutation. A zero-cache build
  passed 12/12 packages, all eight exact focused commands reproduced 175 unit, 143 contract, 58 fixture, and 21
  adversarial tests, exact integration passed 6/122 in 255.83s, and the complete suite passed 42/519 in 240.12s
  without a behavioral retry. The report-only evidence synchronization is followed by a final clean `pnpm verify`
  and formatting check before archive construction.
- The independent v10 review returned two P1 blockers. The PEP-508 parser now implements the original grammar's
  exact space/tab domain, zero-whitespace `and`/`or` boundaries, comparator/version whitespace, relative
  `URI_reference`, and bare-CR rejection while retaining the original trailing-comma prohibition. Persisted bundle
  validation now binds every conflict-producing ambiguity signal to exactly one mapped conflict and singular field
  result with exact candidate, interpreted-proposal, reference, and conflict IDs; low-confidence signals cannot
  create or select AI conflict support; unmatched AI conflicts and multiple persisted signals for one field fail
  closed. Raw validation rejects `MULTIPLE_INTERPRETATIONS` when deterministic truth exists, requires same-field
  signals to have byte-identical canonical semantic payloads, and deduplicates only those identical signals before
  derived-ID construction. Red-then-green probes cover the reviewer examples, bare CR, missing/wrong conflicts,
  and duplicate persisted signals. Fresh v11 independent acceptance remains pending.
- The independent v11 review verified archive identity and closed the v10 ambiguity findings, then returned two
  P1 blockers. Direct requirements now validate the complete RFC-3986 `URI_reference` component structure used by
  PEP-508, including percent encoding, authority/user-info/port syntax, IPv6 and IPvFuture literals, absolute and
  relative path forms, and allowed path/query/fragment character classes; malformed characters, percent escapes,
  authorities, literals, and relative references route the whole requirements document to review. Raw AI output
  now rejects duplicate derived field-proposal identity as non-repairable `SEMANTIC_OR_POLICY` invalidity before
  ordinal resolution. An end-to-end probe proves the response produces `AI_OUTPUT_REJECTED`, preserves the
  deterministic bundle, and cannot escape as `FAILED/FIELD_SCHEMA_INVALID`. Red-then-green focused evidence passes
  5 files / 76 tests; the exact local matrix passes 175 unit, 144 contract, 58 fixture, 21 adversarial, 122
  integration, and 520 complete-suite tests. Fresh v12 independent acceptance remains pending.
- The independent v12 review verified archive identity and closed both v11 findings, then returned one P1 blocker
  at the untrusted AI boundary. Raw field proposals now require canonical UTF-8 source-reference ordering and the
  exact enum-ordered proposal-owned warning set: `TAXONOMY_CANDIDATE` iff the semantic value has that binding, plus
  `LOW_CONFIDENCE` iff confidence is below `0.60`, with no other codes. `AIProposalV1Schema` independently enforces
  the same persisted invariants. Missing taxonomy uncertainty, unauthorized warnings, reversed warning order, and
  reversed evidence order all route to non-repairable `SEMANTIC_OR_POLICY` invalidity. End-to-end probes prove each
  case preserves a bindable deterministic/review bundle with `AI_OUTPUT_REJECTED` rather than failing merge. The
  focused reviewer matrix passes 5 files / 77 tests; the exact local matrix passes 175 unit, 145 contract, 58
  fixture, 21 adversarial, 122 integration, and 521 complete-suite tests. Fresh v13 independent acceptance remains
  pending.
- The independent v13 review verified archive identity, closed the v12 code blocker, reproduced the focused
  5-file/77-test matrix, and passed `pnpm verify`. It returned one P2 report-only blocker: the direct two-file M03
  integration row retained an older 13-test count and did not name its exact command. The exact command now appears
  in Section 8 with its independently reproduced 2-file/16-test result. No implementation or specification byte
  changed for this v14 evidence remediation; fresh independent acceptance remains pending.
- The browser v14 whole-patch review returned two blockers. `M03-FREEZE-01` showed that the candidate had changed
  frozen M00 `canonicalJson` key ordering from JavaScript UTF-16 ordering to unsigned UTF-8 ordering. The exact M00
  implementation and file bytes are now restored, M03 uses a milestone-owned serializer, and paired Unicode
  goldens prove both boundaries. `M03-EVIDENCE-01` showed that a v14-only submission could not independently prove
  the report-only v13-to-v14 delta. The exact retained v13 source-only packet is therefore required alongside the
  next packet for attributable historical reconstruction. Fresh acceptance of the post-v14 bytes remains pending.

## 10. Security, risks, and limitations

- Acquired repository content is parsed as bounded inert data. It is never checked out, executed, imported,
  installed, interpreted, or promoted to system/tool instructions.
- AI analysis remains provider-neutral, optional, bounded, attributable, and proposal-only. Required tests use a
  deterministic fake and do not claim live-provider evidence.
- Fixture and fake-adapter evidence proves deterministic contracts and orchestration behavior; it is not
  live-provider, production, editorial, publication, or real-user evidence.
- The implementation is uncommitted on `main` by explicit boundary. The independent reviewer must inspect tracked
  and untracked files together; a branch-only committed diff would be incomplete.
- The pre-existing PostgreSQL deprecation warning remains a follow-up outside M03's no-migration scope.

## 11. Authorization and next gate

- Local M03 bounded remediation and verification: complete.
- Independent whole-patch acceptance: pending.
- Commit authorization: not granted and not inferred.
- Push, PR, merge, release, deploy, publication, and M04 authorization: not granted.

Recommended next step: send a sanitized M03 review packet containing the approved spec hash, complete tracked and
untracked inventory, implementation report, exact verification results, and explicit authorization boundaries to
the independent reviewer. Apply only in-scope M03 remediation from that review. Stop on
`GO — M03 COMMIT READY` or when a genuine human decision is required.
