# M02 Thirteenth-Amendment Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing uncommitted M02 implementation and PostgreSQL migration into exact conformance with the approved fourteenth-amended `M02_SPEC.md` substantive SHA-256 `4549470853202ea7c5a6c1ac831d66fa71ac089cd39abb5ed033f6d5791dde27`.

**Architecture:** Keep the pure deterministic classifier, identity registry, and manual-resolution coordinator as inward domain logic. Persist every accepted human and system identity mutation through command-specific projectors into canonical typed PostgreSQL tables inside one Serializable transaction; generic `m02_command_domain_records` is never authoritative or read by adapters. Use lifecycle-stable natural guard references, immutable operation/result records, exact audit subjects, and direct typed-table integration assertions.

**Tech Stack:** Node.js 22.23.1, pnpm 11.7.0, TypeScript 6.0.3, Vitest 4.1.10, PostgreSQL 17.6, SQL migration 002.

## Global Constraints

- Stay inside M02; do not implement M03+, publish, deploy, commit, stage, push, tag, merge, or open a PR.
- Preserve all pre-existing M00/M01 behavior and the current dirty-worktree changes.
- Use only canonical typed M02 tables for authoritative state; generic JSON ledgers are insufficient.
- Human command modes remain exactly 256 and system identity projector modes remain exactly 22.
- Human and system paths use PostgreSQL 17.6 `SERIALIZABLE`, immutable request/expectation bytes, bounded three-attempt retry, ordered advisory guards, locked reproduction, and atomic typed writes/results/audits.
- Guard identities must be lifecycle-stable and must not include server-allocated future IDs.
- Canonical identity fields use typed columns and restrictive foreign keys; corrections use immutable replacement/supersession.
- Acquired source remains inert and offline gates require no live provider or secrets.
- The approved substantive specification hash must remain recorded; approval-record metadata may have a distinct post-approval hash.
- Every task reports exact commands and outcomes. Do not claim a pass for an unrun check.

---

### Task 1: Human command requirements and deterministic coordinator

**Files:**

- Modify: `packages/identity/src/manual-resolution.ts`
- Modify: `packages/identity/src/manual-resolution-modes.ts`
- Modify: `packages/identity/src/manual-resolution.contract.test.ts`
- Modify: `packages/identity/src/manual-resolution.adversarial.test.ts`
- Modify: `packages/identity/src/manual-resolution-modes.unit.test.ts`

**Interfaces:**

- Consumes: `ManualResolutionEnvelope`, lifecycle-stable guard references, canonical command payload fields from Sections 15.1–15.9.
- Produces: exact `deriveRequiredExpectedVersionKeys`, 256-mode dispatch, deterministic mutation plan/result, and canonical optional `activeDuplicateProposalOrNull` handling used by the PostgreSQL adapter.

- [ ] Add/repair tests that derive the complete expectation set before execution for all command families, including topology replacement payloads and proposal-set/pair guards.
- [ ] Make invalid payload validation occur before expectation-set comparison so malformed commands return the specified domain error.
- [ ] Implement universal P1 proposal discovery/cleanup for CREATE_RESOURCE, ATTACH_NEW_VERSION, MARK_FORK FIRST, MARK_MIRROR FIRST, MARK_DUPLICATE FIRST, and REJECT_CANDIDATE P1 without adding modes.
- [ ] Preserve exact FIR-01 error precedence: key/null-positive mismatch is `EXPECTED_VERSION_SET_INVALID`; equal positive keys with an integer mismatch are `STALE_RECORD_VERSION`.
- [ ] Verify exact counts and targeted contracts with `pnpm test:unit -- manual-resolution` and `pnpm test:contract -- manual-resolution`.

### Task 2: Canonical migration schema and constraints

**Files:**

- Modify: `packages/job-queue/migrations/002_m02_classification_identity.sql`
- Modify: `packages/job-queue/src/m02-migration.contract.test.ts`
- Modify: `packages/testing/src/m02-migration.integration.test.ts`
- Modify: `packages/testing/src/m02-postgres-fixture.ts`

**Interfaces:**

- Consumes: Sections 13.1, 14, 15.5–15.11, 16–17 table/enum/FK/trigger contract.
- Produces: forward-only zero/M01-upgrade schema for canonical human and system projectors.

- [ ] Extend `m02_concurrency_guards.guard_type` with `SOURCE_REPOSITORY`, `DUPLICATE_PROPOSAL_SET`, and `DUPLICATE_PROPOSAL_PAIR` while retaining every existing exact guard type.
- [ ] Add immutable system operation/result/rejected-audit tables with the exact 22-mode enum, replay locator uniqueness, canonical request/input/fingerprint columns, typed postcondition arrays, phase/nullability constraints, and origin separation.
- [ ] Add all six normalized Decision child tables with typed parent/evidence/target foreign keys, UUID primary keys, canonical ordinal uniqueness, closed signal/conflict vocabularies, and restrictive deletion.
- [ ] Close human typed-table gaps for canonical audit action/subject metadata, clarification, rejection, topology mapping, job replacement, handoff result-origin XOR, proposal lineage, record versions, and append-only history.
- [ ] Ensure the migration remains forward-only without false-positive test matching inside comments/messages and validates from zero plus populated M01 on PostgreSQL 17.6.
- [ ] Verify with `pnpm test:contract -- migration` and `pnpm test:integration -- migration`.

### Task 3: Human PostgreSQL typed projector

**Files:**

- Create: `packages/job-queue/src/m02-human-command-plan.ts`
- Create: `packages/job-queue/src/m02-human-projectors.ts`
- Modify: `packages/job-queue/src/m02-typed-state.ts`
- Modify: `packages/job-queue/src/postgres-manual-resolution.ts`
- Modify: `packages/job-queue/src/index.ts`
- Modify: `packages/testing/src/m02-command-adapter.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 coordinator plan/result and Task 2 canonical schema.
- Produces: durable typed execution for all 256 human modes, with no reads/writes to `m02_command_domain_records`.

- [ ] Hydrate the coordinator only from canonical typed rows and reproduce the same complete locked plan/expectation set inside each Serializable attempt.
- [ ] Project CREATE/ATTACH/FORK/MIRROR/DUPLICATE/REJECT, SPLIT/MERGE/OVERRIDE, clarification, recursive ambiguity, and replacement-job effects into the exact typed tables with `WHERE record_version = expected` updates.
- [ ] Allocate/consume all command-provided server IDs and canonical payload/fingerprint/provenance fields; preserve immutable observations/history and insert replacement mappings.
- [ ] Emit one accepted command result and exact audit formula subjects/counts; replay returns the committed result and creates no writes; rejection persists only its bounded rejected audit after rollback.
- [ ] Cover proposal absent/matching/different target, rollback injection, restart replay, changed-payload idempotency, corrections, job replacement, and two-session first-use/stale concurrency by querying typed tables directly.
- [ ] Verify with `pnpm test:integration -- command-adapter` and focused identity/contract suites.

### Task 4: System-origin 22-mode durable identity projector

**Files:**

- Create: `packages/job-queue/src/postgres-system-identity.ts`
- Modify: `packages/job-queue/src/index.ts`
- Modify: `packages/job-queue/src/m02-typed-state.ts` or create a focused `packages/job-queue/src/m02-system-typed-state.ts`
- Create: `packages/testing/src/m02-system-identity.integration.test.ts`
- Modify: `packages/testing/src/m02-postgres-fixture.ts`

**Interfaces:**

- Consumes: exact Section 13.1 mode matrix, `IdentityDecisionInputV1`, `SystemIdentityReplayLocatorV1`, shared V2 guards, Task 2 schema.
- Produces: server-only `SystemIdentityMutationOperationV1` adapter and immutable typed operation/result/rejection evidence.

- [ ] Define closed TypeScript schemas/types for the exact 22 mode IDs, six-tier evaluation, signal/conflict typed targets, replay locator, request, result, and three rejection phases.
- [ ] Implement accepted replay lookup from the pre-projector locator before mutable eligibility; derive/freeze the full input/idempotency/request/expectation bytes after exact mode selection and before provisional IDs.
- [ ] Execute one bounded Serializable transaction with shared ordered guards, locked plan reproduction, current-controller/cancellation/precedence checks, canonical typed writes, Decision parent plus six child projections, result arrays, audits, and rollback.
- [ ] Implement S1–S5 R/J branches, S6/S7/S8 blocking outcomes, reachable S9 JC/JR and S10 JR reanalysis, S7 candidate-set/pair proposal guards, S8 provider-declared-fork signal, and human-Decision precedence.
- [ ] Persist phase-correct rejected attempts separately after preflight failure/rollback, with accepted replay taking precedence.
- [ ] Execute all 22 IDs directly against PostgreSQL 17.6, including replay after state mutation, child-row/audit cardinality, rollback, collisions, new-controller separation, and system/human guard continuity.

### Task 5: Fixture closure, whole-patch verification, and report

**Files:**

- Modify: `fixtures/repositories/m02/manifest.json`
- Modify: `packages/testing/src/m02-manifest.fixture.test.ts`
- Modify: `docs/milestones/M02_REPORT.md`
- Format only as needed: all M02 implementation files reported by `pnpm format:check`

**Interfaces:**

- Consumes: Tasks 1–4 and F01–F42/AC-01–AC-22.
- Produces: exact traceability, reproducible verification evidence, and a truthful readiness report for independent whole-patch review.

- [x] Add F36–F42 manifest entries and direct scenario-to-test mapping for guard lifecycle, 256 human modes, topology, clarification, audit, future-ID exclusion, and 22 system projectors.
- [x] Bind F36–F42 to fail-closed receipt collectors populated only after contributing PostgreSQL assertions and queries succeed; canonical-sort deterministic receipts and compare every manifest evidence field in final aggregation.
- [x] Run Prettier only on intended M02 files and verify no unrelated user changes are rewritten.
- [x] Run every Section 23 command with pinned Node 22.23.1/pnpm 11.7.0, including PostgreSQL 17.6 migration/integration/concurrency suites, fixtures, adversarial tests, regressions, source-safety, dependency boundaries, build, `pnpm verify`, and Git integrity commands.
- [x] Independently scan the whole worktree including untracked files for generic-ledger authority, future-ID guards, source execution, secrets, M03 scope, skipped tests, and stale report claims.
- [x] Update `M02_REPORT.md` with exact repository state, file inventory, AC mapping, commands/counts, risks, evidence distinctions, and publication boundaries.
- [ ] Submit the sanitized diff/test/report evidence to the open browser conversation and continue the independent review/remediation loop until `GO — M02 COMMIT READY` or a human decision is required.
