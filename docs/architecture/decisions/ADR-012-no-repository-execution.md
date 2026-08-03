# ADR-012: No repository code execution

- Status: Accepted
- Date: 2026-08-03

## Context

External repositories may contain malicious scripts, prompts, paths, binaries, or lifecycle hooks.

## Decision

Treat acquired content only as bounded untrusted data. Do not run source commands, installers, interpreters, dynamic imports, binaries, containers, or package lifecycle scripts.

## Consequences

The alpha evaluates declared and statically observable facts, not runtime behavior. Any future runtime verification requires a separately authorized architecture and cannot weaken this ingestion boundary.

## M01 implementation status

M01 inventories paths before fetching and validates content before storage. Negative tests cover malicious paths, links, submodules, binaries, archives, executables, invalid encodings, encryption, limits, and hostile textual instructions; source-safety lint continues to reject execution mechanisms.
