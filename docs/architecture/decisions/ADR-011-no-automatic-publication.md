# ADR-011: No automatic publication

- Status: Accepted
- Date: 2026-08-03

## Context

AI and automated extraction can be wrong, manipulated, or incomplete.

## Decision

Only an authenticated, authorized human command can create `INTERNAL_APPROVED` after deterministic blockers and evidence checks pass. Public publication is not part of the alpha.

## Consequences

AI outputs remain drafts. Worker and provider credentials receive no publication authority, and bypass attempts require negative tests.
