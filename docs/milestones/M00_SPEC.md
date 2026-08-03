# M00 — Technical Alpha governance and repository foundation

## Purpose

Create a deterministic, governed engineering baseline before feature code.

## Scope delivered

- pinned Node 22 and pnpm runtime policy;
- pnpm workspace and Turborepo-style orchestration;
- strict TypeScript, ESLint, Prettier, Vitest, boundary checks, and CI;
- versioned canonical enums, opaque IDs, timestamps, fingerprints, canonical JSON, results/errors, and schema policy;
- validated environment boundary with redaction;
- fake clock/IDs/providers, safe fixture loader, object-storage adapter, captures, and opt-in ephemeral PostgreSQL harness;
- required architecture, operations, validation, governance, and ADR documentation.

## Exclusions

No app, ingestion feature, production adapter, schema migration, external call, publication path, validation result, release, or deployment is implemented.

## Domain contracts

The `@ai-ark/contracts` public API owns the M00 enums and provider-neutral ports. Serialized contracts use schema version `0.1.0`. The exact enum vocabulary follows the Technical Alpha execution prompt and PRD; broader product aliases are documented, not silently merged.

## Acceptance criteria

- [x] frozen install succeeds with the pinned runtime and package manager;
- [x] all root commands exist;
- [x] lint, formatting, strict typecheck, unit, contract, build, and verify pass;
- [x] dependency and source-safety boundaries fail closed;
- [x] required documentation and 12 ADRs exist;
- [x] CI has no live-provider dependency;
- [x] no commit, staging, push, tag, merge, release, or deployment occurred.

## Verification

Run the commands in the governing M00 prompt. Record exact results in `M00_REPORT.md`. A local runtime mismatch is reported explicitly and cannot be hidden.

## Risks

- Exact Node 22 is not installed on the authoring machine; CI and version-manager verification are required.
- PostgreSQL harness requires a local container runtime only when later integration tests opt in.
- Long-term specification enum aliases require explicit adapter mapping in later milestones.

## Decision

`NO-GO` pending resolution or explicit acceptance of the pre-existing-document preservation defect recorded in `M00_REPORT.md`. All M00 implementation and verification criteria otherwise pass.
