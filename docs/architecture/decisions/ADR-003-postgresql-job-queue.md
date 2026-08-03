# ADR-003: PostgreSQL-backed durable job queue

- Status: Accepted
- Date: 2026-08-03

## Context

Ingestion requires retries, cancellation, idempotency, resumability, and durable stage history.

## Decision

Use a PostgreSQL-backed queue behind an application-owned port. Enqueue and related canonical writes may share transactions.

## Consequences

Redis and Kafka are not introduced. A later queue implementation can replace the adapter if measured throughput requires it.

## M01 implementation status

M01 defines the application-owned store contract, PostgreSQL schema for acquisition jobs/results and immutable snapshot identity, and deterministic contract adapter. The four M01 stages, retries, cancellation, operator review, partial results, and idempotency are implemented; production connection/worker deployment remains separately gated.
