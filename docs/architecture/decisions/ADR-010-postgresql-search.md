# ADR-010: PostgreSQL search for the Technical Alpha

- Status: Accepted
- Date: 2026-08-03

## Context

The internal directory needs conventional search but not the operating cost of a separate search cluster.

## Decision

Use PostgreSQL full-text and trigram search over rebuildable approved-only projections.

## Consequences

Elasticsearch and semantic search are deferred. Search can evolve behind a projection/query boundary after validation.
