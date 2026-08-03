# AI ARK

AI ARK is a governed GitHub-to-Skill Technical Alpha. The system is intended to turn a fixed public GitHub source revision into evidence-backed Skill records that require explicit human approval before internal publication.

M00 established governance and repository foundations. M01 implements the GitHub acquisition foundation: provider-API-only immutable snapshots, fail-closed inventory/content policy, content-addressed storage, and durable acquisition stages. It does not classify repositories, call AI providers, publish records, or expose a product UI.

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
- Public publication and production deployment are not authorized.

The detailed rules are in [AGENTS.md](AGENTS.md) and [security boundaries](docs/architecture/SECURITY_BOUNDARIES.md).
