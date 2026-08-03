# ADR-003: PostgreSQL-backed durable job queue

- Status: Accepted
- Date: 2026-08-03

## Context

Ingestion requires retries, cancellation, idempotency, resumability, and durable stage history.

## Decision

Use a PostgreSQL-backed queue behind an application-owned port. Enqueue and related canonical writes may share transactions.

## Consequences

Redis and Kafka are not introduced. A later queue implementation can replace the adapter if measured throughput requires it.
