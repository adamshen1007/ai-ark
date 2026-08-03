# M01 — GitHub Acquisition Foundation specification

## Objective

Acquire bounded evidence from a public GitHub repository through read-only provider operations, bind it to an immutable commit SHA and versioned policy, and persist a deterministic acquisition result without cloning, installing, interpreting, or executing repository content.

## Scope

- strict GitHub repository-root URL validation and normalization;
- provider-neutral source, metadata, entry, signal, storage, and job contracts;
- a GitHub adapter over an injected read-only transport;
- recursive deterministic inventory, relevant-file priority, and fail-closed source policy;
- SHA-256 content addressing through an S3-compatible port and deterministic adapter;
- durable M01 stage schema, retry/cancellation/idempotency semantics, partial results, and telemetry;
- offline fake-provider, fixture, adversarial, unit, contract, and integration tests.

## Exclusions

M01 does not classify repositories or interpret `SKILL.md`; resolve Resource, creator, capability, Task, duplicate, or license meaning; call AI; generate drafts; review; publish; or build a directory. It makes no repository checkout, package installation, hook, child-process, dynamic-load, container, or live-GitHub path.

## Domain contracts

`@ai-ark/contracts` owns `SourceSubmission`, `SourceReference`, `SourceSnapshot`, `SourceDocument`, `SourceEntry`, `AcquisitionPolicyVersion`, warnings/failures/jobs/results, `SourceProvider`, `ObjectStorage`, and `AcquisitionJobStore`. Provider contracts expose only canonical values—not GitHub SDK or HTTP types. Snapshot identity is:

```text
provider : provider repository ID : immutable commit SHA : acquisition policy version
```

## Source-safety policy

Policy v1 bounds repository entries, selected files, selected bytes, per-file bytes, UTF-8 path bytes, and lines. It allowlists textual extensions and UTF-8. Paths with traversal, absolute forms, backslashes, nulls, ambiguous components, excessive length, duplicates, or case collisions are quarantined. Symlinks and submodules are quarantined. Oversized, unsupported, binary, executable, archive, encrypted, and invalidly encoded content is skipped or quarantined with stable reason codes. No acquired byte is executed.

Relevant-file priority covers `SKILL.md`, README/LICENSE/CHANGELOG variants, manifests, configuration, `docs/`, `examples/`, and `references/`; allowed source files remain inert text. Priority is not Skill classification.

## Job stages

M01 owns only:

1. `RECEIVED`
2. `VALIDATING_SOURCE`
3. `ACQUIRING_SOURCE`
4. `INVENTORYING_SOURCE`

The store contract and PostgreSQL migration preserve stage, completed-stage, warning, failure, cancellation, attempt, and result state. Idempotency keys reuse a job; snapshot identity keys reuse a canonical snapshot. Transient provider/rate-limit/storage failures are retryable, bounded exhaustion requires operator review, and completed partial state remains inspectable.

## Implementation plan

1. Extend inward-owned contracts.
2. Implement the injected GitHub transport adapter.
3. Inventory and inspect paths before fetching bytes.
4. Inspect bytes before content-addressed storage.
5. Persist the result and terminal job state.
6. Expose only bounded, redacted telemetry.
7. Verify through deterministic offline tests and full M00 regression gates.

## Fixtures

`fixtures/repositories/m01/manifest.json` defines 32 content/path scenarios plus 18 provider/job scenarios. It covers public, missing, private, malformed/deceptive/credential URLs; archive/fork/transient/rate-limit states; entry/file/total limits; binary/executable/archive/encrypted/encoding failures; symlink/submodule and path attacks; prompt-like hostile text; and repeated immutable revisions.

## Acceptance criteria

- repository-root URLs normalize deterministically and deceptive inputs fail;
- public identity resolves to provider ID and immutable 40-character SHA;
- metadata, signals, inventory, and bytes cross a provider-neutral port;
- unsafe paths and bytes record a deterministic non-acquired disposition;
- selected content has verified SHA-256 and a stable object key;
- retries and duplicates do not duplicate canonical snapshots or objects;
- cancellation, partial results, and operator review are represented durably;
- telemetry contains identifiers/counts/codes but no credentials or source bodies;
- all required M01 tests and M00 regression gates pass offline;
- authority documents remain byte-identical and formatter-excluded;
- the diff contains only M01 work and no prohibited Git/deployment action occurs.

## Verification commands

Vitest 4 uses positional filename filters, so the requested `--filter` examples are run as:

```bash
pnpm test:unit -- acquisition
pnpm test:contract -- source-provider
pnpm test:integration -- github-acquisition
pnpm test:fixtures -- repository-safety
pnpm test:adversarial -- source-safety
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm verify
git diff --check
git status --short
git diff --stat
git diff --name-status
git diff main...HEAD
git diff
```

The final pass also proves Prettier exclusions, `cmp`/SHA-256 integrity for the four restored authorities, and the prohibited-source-execution scan.

## Risks

- GitHub API behavior is represented through an injected transport and must be validated against a narrowly allowlisted live profile only after separate authorization.
- PostgreSQL migration semantics are specified, while deterministic required gates use the in-memory contract adapter.
- Extension and size policy will require evidence-led tuning; widening must remain explicit and versioned.

## Decision rules

`GO` requires every acceptance criterion and verification command to pass with an intended M01-only diff. Any safety, authority-integrity, immutable-identity, idempotency, or required-gate failure is `NO-GO`. An external prerequisite that prevents the evidence from being produced is `BLOCKED`. M02 must not begin under any M01 decision.
