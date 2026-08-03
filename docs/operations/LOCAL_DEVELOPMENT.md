# Local development

## Prerequisites

- Node.js `22.23.1` (use `.node-version` or `.nvmrc`)
- Corepack
- pnpm `11.7.0`
- Docker-compatible container runtime only when explicitly running later PostgreSQL integration tests

## Setup

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
pnpm verify
```

Required unit and contract gates are offline after installation. No GitHub or AI credential is required. The PostgreSQL harness is opt-in and does not start during required M00/M01 gates. M01 uses an injected fake GitHub transport and deterministic object/job adapters; no live repository, checkout, or repository dependency installation is used.

## Environment

Configuration is validated by `@ai-ark/config`. Optional M00 variables are `DATABASE_URL`, `OBJECT_STORAGE_ENDPOINT`, `GITHUB_TOKEN`, and `AI_PROVIDER_API_KEY`; no required gate uses them. Never add real `.env` files or secrets to the repository.

## Command semantics in M00

`db:migrate`, `db:validate`, `validation:technical`, and `validation:report` exist to stabilize the root interface. Until their owning milestones define schemas or measurements, they report that status and exit without creating data or claiming validation.

## Local runtime variance

The package manifest emits a warning under a non-pinned engine. If verification must be diagnosed on another Node release, record the variance and do not treat it as satisfying the pinned-runtime acceptance criterion.
