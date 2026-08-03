# ADR-007: Evidence-first claim model

- Status: Accepted
- Date: 2026-08-03

## Context

Generated prose alone cannot support trustworthy Skill intelligence.

## Decision

Represent field-level Claims separately from EvidenceItems. Claims carry class, support state, methodology, confidence, and snapshot-owned evidence links.

## Consequences

Unknowns and conflicts remain inspectable. Material fields without valid supported evidence cannot pass publication validation.
