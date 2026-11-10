# AI ARK

AI ARK is a governed GitHub-to-Skill Technical Alpha. The system is intended to turn a fixed public GitHub source revision into evidence-backed Skill records that require explicit human approval before internal publication.

M00 established governance and repository foundations. M01 is the approved GitHub acquisition foundation: provider-API-only immutable snapshots, fail-closed inventory/content policy, content-addressed storage, and durable acquisition stages.

M02 is completed, independently accepted, committed, and publicly verified. Its scoped implementation adds deterministic repository classification, bounded offline AI-analysis contracts, candidate fingerprints and ownership, stable Resource/ResourceVersion identity, reviewed duplicate/fork/mirror handling, durable manual-resolution and job-supersession contracts, and a forward PostgreSQL migration.

M03 Structured Extraction is completed, merged through PR #1, and verified by public CI. The merged PR body records the externally reported independent verdict `GO — M03 COMMIT READY`; the repository does not contain the original reviewer transcript, so this closeout does not present that verdict as independently reproducible from GitHub review metadata. M03 adds deterministic field extraction, attributable source references, provider-neutral bounded AI proposal contracts, explicit conflict/review states, and immutable extraction bundles. It does not publish records, execute acquired source, call a live AI or GitHub provider, or expose a product UI.

M04 Evidence Binding and the approved M03/M04 handoff are merged through PR #2 at `e9b62f80f2c5dd2402d145df5e4afda403691f2f`, with successful PR and main CI. The eleven-document authority chain, full local verification, independent review provenance, and the narrowly approved Markdown whitespace exception are recorded in the [M04 governance closeout](docs/milestones/M04_GOVERNANCE_CLOSEOUT.md). Migration `003` has not been applied to production. This is a verified implementation baseline, not a deployed or production-ready product.

M05 implementation is authorized against [M05 specification](docs/milestones/M05_SPEC.md) SHA-256 `dd92ed72cab610298c66918137acd9e959795801bd85b4f1b51bbe630fa72a1d`, approved with separate implementation authorization on 2026-10-27. Its [independent specification review](docs/milestones/M05_SPEC_REVIEW.md) is not implementation acceptance; see [M05 implementation report](docs/milestones/M05_REPORT.md) for the current decision and actual evidence. The frozen specification retains its pre-approval wording. Editorial approval, product-content publication, deployment, release, live-provider use, and M06+ remain out of scope.

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

All required root command names exist. M04 database migration/validation commands are implemented for explicitly authorized disposable local/test targets; they are not production commands. Alpha validation remains milestone-scoped/unavailable and does not fabricate results.

## Safety invariants

- Acquired repository content is permanently untrusted.
- Repository code and installation commands are never executed.
- AI output has no publication authority.
- Every material published field will require evidence and an editorial decision.
- Product-content publication and production deployment are not authorized.

The detailed rules are in [AGENTS.md](AGENTS.md) and [security boundaries](docs/architecture/SECURITY_BOUNDARIES.md).
