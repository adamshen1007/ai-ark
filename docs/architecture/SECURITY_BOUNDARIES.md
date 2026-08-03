# Security boundaries

## Trust zones

1. Internal UI: may request commands, never enforce authorization alone.
2. Authenticated API: validates, authorizes, emits audit events, and owns synchronous writes.
3. Job control plane: advances durable state transitions.
4. Source quarantine: contains untrusted repository metadata and bytes with no execution authority.
5. AI provider boundary: receives bounded, labelled evidence and structured-output contracts only.
6. Canonical publication store: receives content only through authorized domain commands.

## Non-negotiable source boundary

Acquired repositories must be read through approved provider APIs without checkout. Runtime code handling acquired content must not use child processes, dynamic imports of acquired paths, `eval`, package managers, interpreters, containers, or a Docker socket. Commands found in source may be retained as bounded untrusted text only.

`pnpm lint:source-safety` statically checks runtime paths for prohibited mechanisms. Later milestones must add path, content-size, egress, prompt-injection, evidence-ownership, and publication-bypass negative tests.

## Egress separation

- Acquisition worker: GitHub, PostgreSQL, object storage, and observability only.
- Analysis worker: approved AI provider, PostgreSQL, object storage, and observability only.
- Analysis cannot fetch GitHub; acquisition cannot contact an AI provider.

M00 documents this boundary. Local and staging network enforcement is implemented with the worker milestones.

## Secrets and logs

Secrets come from validated environment configuration, use least-privilege credentials, and are redacted. Logs carry identifiers and safe error codes, not credentials, raw participant identities, or unrestricted source excerpts.

## Publication authority

AI and workers cannot create `INTERNAL_APPROVED`. An authenticated and authorized human command must pass deterministic blockers, evidence validation, source-version binding, and concurrency checks in one transaction.
