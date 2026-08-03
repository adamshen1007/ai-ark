# ADR-001: Modular monolith for the Technical Alpha

- Status: Accepted
- Date: 2026-08-03

## Context

The vertical slice needs durable background stages and strong boundaries but not distributed-service overhead.

## Decision

Use one TypeScript workspace with separate web, editorial, API, and worker process roles. Enforce module dependency direction in code and tooling.

## Consequences

Transactions and operations remain simple; process roles can be isolated or extracted later. Module boundary violations fail CI.
