# ADR-005: GitHub API acquisition without repository checkout

- Status: Accepted
- Date: 2026-08-03

## Context

Checkout creates unnecessary hooks, configuration, filesystem, and accidental execution risk.

## Decision

Acquire metadata, trees, and selected files through approved GitHub read APIs/content endpoints bound to an immutable commit SHA. Never check out acquired repositories.

## Consequences

Acquisition must handle rate limits and provider contracts, but it eliminates a direct source-to-host execution path.
