# ADR-006: Provider-neutral AI analysis boundary

- Status: Accepted
- Date: 2026-08-03

## Context

Canonical meaning must not depend on one provider response format or tool model.

## Decision

Own analysis ports and structured output contracts inside AI ARK. Adapters translate vendor requests and responses. Prompts are versioned and source content is explicitly untrusted.

## Consequences

Provider replacement and deterministic fakes are possible. Provider SDK types cannot leak into domain contracts.
