# ADR-005: GitHub API acquisition without repository checkout

- Status: Accepted
- Date: 2026-08-03

## Context

Checkout creates unnecessary hooks, configuration, filesystem, and accidental execution risk.

## Decision

Acquire metadata, trees, and selected files through approved GitHub read APIs/content endpoints bound to an immutable commit SHA. Never check out acquired repositories.

## Consequences

Acquisition must handle rate limits and provider contracts, but it eliminates a direct source-to-host execution path.

## M01 implementation status

M01 implements strict repository-root normalization and an injected read-only GitHub transport for repository, commit, tree, blob, release, tag, license, archive, and fork data. Required gates use fakes and make no live GitHub call.
