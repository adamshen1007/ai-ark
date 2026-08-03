# ADR-002: PostgreSQL as canonical store

- Status: Accepted
- Date: 2026-08-03

## Context

AI ARK needs relational integrity, immutable history, auditability, and graph-like relationships.

## Decision

Use PostgreSQL for canonical records with typed access, foreign keys, explicit columns, forward-only migrations, and bounded versioned JSON extensions.

## Consequences

A graph database is unnecessary in the alpha. Projections remain rebuildable and canonical invariants can be transactionally enforced.
