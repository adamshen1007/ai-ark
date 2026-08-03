# Technical Alpha architecture

## Decision

AI ARK uses a modular monolith with separate process roles for `web`, `editorial`, `api`, and worker roles (`orchestrator`, `acquisition`, `analysis`, and `projection`). M00 establishes contracts and tooling only; no deployable app is created before it has milestone-authorized behavior.

## Canonical truth

Canonical truth will consist of immutable source snapshots and documents, Resource candidates and versions, Claims and EvidenceItems, editorial decisions, publication snapshots, and append-only audit history. Generated drafts, directory cards, search documents, and metrics are rebuildable projections.

## Dependency direction

```text
apps
  ↓
application/feature packages
  ↓
domain contracts and ports
  ↓
shared primitives
```

Infrastructure adapters depend inward and implement ports. Browser UI never imports persistence or provider adapters. See `DEPENDENCY_RULES.md`.

## M00 package map

- `@ai-ark/contracts`: versioned enums, primitives, results, and provider-neutral ports.
- `@ai-ark/config`: startup environment validation and safe redaction.
- `@ai-ark/testing`: deterministic fakes, captures, fixture loading, object storage, and opt-in ephemeral PostgreSQL.

Feature packages and apps are intentionally deferred to their milestones.

## Data and infrastructure direction

- PostgreSQL: canonical relational store, durable job queue, and Technical Alpha search.
- S3-compatible storage: content-addressed acquired source bytes and bounded artifacts.
- OIDC-compatible authentication: internal invitation-only identity.
- Provider adapters: GitHub source acquisition and provider-neutral AI analysis.

## Governing invariants

- Source content is permanently untrusted and cannot reach execution authority.
- Every analysis and publication binds to an immutable source revision.
- AI output is a proposal; only authorized human commands can approve internal publication.
- Publication snapshots are immutable and corrected through supersession.
- Uncertainty is represented explicitly.
- Projections are reproducible from canonical records.
