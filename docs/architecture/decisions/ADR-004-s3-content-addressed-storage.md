# ADR-004: S3-compatible content-addressed source storage

- Status: Accepted
- Date: 2026-08-03

## Context

Fixed source bytes and bounded artifacts must be reproducible without bloating relational storage.

## Decision

Store selected normalized bytes through an S3-compatible port under SHA-256 content-addressed keys; retain hashes and ownership metadata canonically.

## Consequences

Storage is provider-neutral and deduplicated. Integrity and orphan checks are required before staging.
