# ADR-009: OIDC-compatible internal authentication

- Status: Accepted
- Date: 2026-08-03

## Context

The alpha is invitation-only and privileged editorial actions require auditable identity without coupling to one vendor.

## Decision

Define authentication around OIDC-compatible identities and server-side role/object authorization. Provider selection is deferred until the authentication milestone.

## Consequences

Client-side hiding never counts as authorization. Privileged sessions, revocation, and role changes require audit.
