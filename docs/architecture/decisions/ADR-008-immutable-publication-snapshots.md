# ADR-008: Immutable publication snapshots

- Status: Accepted
- Date: 2026-08-03

## Context

User outcomes and audit history must remain tied to exactly what an editor approved.

## Decision

Create complete, deterministically serialized publication snapshots. Corrections create a new snapshot and supersession link; published snapshots are never edited in place.

## Consequences

History is reproducible and validation remains meaningful. Projection rebuilds cannot mutate canonical publication.
