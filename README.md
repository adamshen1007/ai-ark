# AI ARK

AI ARK is a governed GitHub-to-Skill Technical Alpha. The system is intended to turn a fixed public GitHub source revision into evidence-backed Skill records that require explicit human approval before internal publication.

M00 established governance and repository foundations. M01 is the approved GitHub acquisition foundation: provider-API-only immutable snapshots, fail-closed inventory/content policy, content-addressed storage, and durable acquisition stages.

M02 is completed, independently accepted, committed, and publicly verified. Its scoped implementation adds deterministic repository classification, bounded offline AI-analysis contracts, candidate fingerprints and ownership, stable Resource/ResourceVersion identity, reviewed duplicate/fork/mirror handling, durable manual-resolution and job-supersession contracts, and a forward PostgreSQL migration.

M03 Structured Extraction is implemented locally against the approved milestone specification and is pending final verification and independent acceptance. It adds deterministic field extraction, attributable source references, provider-neutral bounded AI proposal contracts, explicit conflict/review states, and immutable extraction bundles. It does not publish records, execute acquired source, call a live AI or GitHub provider, or expose a product UI. M04 and later milestones are not started or authorized.

## Runtime

- Node.js `22.23.1`
- pnpm `11.7.0`
- TypeScript `6.0.3`

Use the exact versions in `.node-version`, `.nvmrc`, and `package.json`. See [local development](docs/operations/LOCAL_DEVELOPMENT.md).

## Commands

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
```

All required root command names exist. Commands for database migrations and alpha validation report their milestone-scoped unavailable state until those capabilities are implemented; they do not fabricate results.

## Safety invariants

- Acquired repository content is permanently untrusted.
- Repository code and installation commands are never executed.
- AI output has no publication authority.
- Every material published field will require evidence and an editorial decision.
- Product-content publication and production deployment are not authorized.

The detailed rules are in [AGENTS.md](AGENTS.md) and [security boundaries](docs/architecture/SECURITY_BOUNDARIES.md).
