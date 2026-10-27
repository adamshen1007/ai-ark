# AI ARK — Repository Working Agreement

## 1. Product and Current Outcome

AI ARK is a governed GitHub-to-Skill Technical Alpha that turns a fixed public GitHub revision into structured, evidence-backed, human-reviewable Skill records. Primary alpha users are internal editors/founders and technical reviewers; later validation users and creator participants evaluate approved records and provide evidence.

The validated repository outcome is M03 `GO`: provider-API-only GitHub acquisition produces immutable, policy-versioned snapshots; M02 adds deterministic classification and stable Resource/ResourceVersion identity; and M03 adds deterministic and bounded AI-assisted structured extraction with attributable source references, explicit uncertainty, and immutable extraction bundles. It does not create durable Claims/EvidenceItems, generate drafts, or publish product content.

- Current phase: GitHub-to-Skill Technical Alpha.
- Completed and publicly verified implementation baseline: M00, M01, M02, and M03.
- M03 authority: approved `docs/milestones/M03_SPEC.md` at SHA-256 `3946c15149d08b15e50697dc83d746979f0b2a8a87abeb5dbb25a78809949f80`, completed implementation, merged PR #1, and successful public CI run `33422220807`. The merged PR body records the externally reported independent verdict `GO — M03 COMMIT READY`; its original reviewer transcript is not repository/GitHub review evidence.
- Current authorization boundary: M04 implementation against the exact eleven-document M03/M04 authority chain is approved and authorized, including the alternate-unique conflict clarification at SHA-256 `44f6d6a8577ecd95eb8689446bd5e05d75fbdf52341b26d67e8477a409380e87` and closure-reachability clarification at SHA-256 `3a3e694075fb3897ee68821a7254dbb04b457e7506f854b74879f3d35123875b`. The seventh row-lock correction retains five writer `UPDATE` cells for `SELECT ... FOR UPDATE`, and the 180-cell V2 manifest remains frozen. The local, unapplied migration `003` candidate remains NO-GO until its full unchanged-byte gates and independent R2 review close. Commit, push, PR, merge, deployment, release, publication, production migration, and M05+ remain unauthorized.

## 2. Scope and Non-Goals

Completed M03 scope includes the frozen M02 identity-resolved handoff plus deterministic structured extraction, bounded attributable AI proposals, complete field/status/conflict contracts, source references, and immutable extraction bundles. M03 persistence is intentionally in-memory: it defines no durable extraction, Claim, or EvidenceItem tables. Deterministic and AI-assisted outputs remain distinguishable, ambiguity remains explicit, and no draft or publication authority exists.

Preserve the completed M03 immutable-bundle handoff boundary. Never use later work to make an earlier milestone appear complete.

### Do not implement in the active milestone

- M05+ draft generation, editorial review, publication, directory/search, validation harness, or user validation.
- Full marketplace, public accounts/profiles/comments/reviews/creator claims, broad ranking, Labs, public API/MCP/Agent catalogue, dynamic workflows, payments, sponsorship, mirroring, or public Mainland deployment.
- Autonomous installation or execution, automatic verification badges, automatic or public publication, semantic search, graph databases, Redis, Kafka, Elasticsearch, Kubernetes, or a microservice network.
- Runtime verification of acquired repositories, live-provider-required CI, speculative platform abstractions, empty packages, placeholder production services, unrelated refactors, or production deployment.

## 3. Authoritative Documents

Apply repository sources in this precedence order:

1. `docs/execution/AI ARK Technical Alpha Codex Execution Prompt v1.0.md`
2. `docs/architecture/AI ARK Technical Alpha Architecture v1.0.md`
3. `docs/product/AI ARK GitHub-to-Skill Technical Alpha PRD v1.0.md`
4. `specs/AI ARK Resource Intelligence Pipeline Specification v1.0.md`
5. `specs/AI ARK Resource and Capability Graph Specification v1.0.md`
6. Other files under `docs/product/`, `specs/`, `docs/ux/`, `docs/design/`, and `docs/validation/`
7. The approved Figma prototype, for visual hierarchy and interaction only

Within that hierarchy, the approved active-milestone spec controls its defined implementation scope and acceptance criteria. Completed scoped evidence includes `docs/milestones/M01_SPEC.md`, `docs/milestones/M01_REPORT.md`, `docs/milestones/M02_SPEC.md`, `docs/milestones/M02_REPORT.md`, `docs/milestones/M03_SPEC.md`, and `docs/milestones/M03_REPORT.md`. Current implementation authority is the exact eleven-document chain of `M03_SPEC.md`, `M04_SPEC.md`, `M03_M04_HANDOFF_AMENDMENT.md`, `M03_M04_PERSISTENCE_CORRECTION_AMENDMENT.md`, `M03_M04_AUTHORITY_OID_AMENDMENT.md`, `M03_M04_PRIVILEGE_NECESSITY_AMENDMENT.md`, `M03_M04_ROW_LOCK_PRIVILEGE_CORRECTION_AMENDMENT.md`, `M03_M04_CANONICAL_NUMBER_CORRECTION_AMENDMENT.md`, `M03_M04_IDEMPOTENCY_KEY_TEXT_ENCODING_AMENDMENT.md`, `M03_M04_ALTERNATE_UNIQUE_CONFLICT_CLARIFICATION_AMENDMENT.md`, and `M03_M04_ALTERNATE_UNIQUE_CLOSURE_REACHABILITY_AMENDMENT.md` at their individually approved SHA-256 values; reports do not expand that chain.

Use `README.md` as the repository entry point; `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DEPENDENCY_RULES.md`, `docs/architecture/SECURITY_BOUNDARIES.md`, accepted ADRs, and `docs/governance/` refine the authorities above. Reports record evidence but do not silently expand authorization.

Resolve conflicts by preserving security and evidence integrity first, then narrow Technical Alpha scope, canonical contracts, and explicit uncertainty. The prototype never defines system truth. Record every material conflict and resolution.

## 4. Repository, Stack, and Layout

- Repository: `ai-ark`; pnpm/Turborepo-style TypeScript modular-monolith workspace.
- Intended base: `main`; the public `origin` is `https://github.com/adamshen1007/ai-ark.git`, and local `main` tracks `origin/main`.
- Runtime: Node `22.23.1`, pnpm `11.7.0`, TypeScript `6.0.3`; versions are pinned in `.node-version`, `.nvmrc`, and `package.json`.
- CI: `.github/workflows/ci.yml` runs frozen installation and `pnpm verify` on pull requests and pushes to `main`.
- Implemented packages: `contracts`, `config`, `testing`, `acquisition`, `github-source`, `object-storage`, `job-queue`, `observability`, `analysis`, `classification`, `identity`, and `extraction` under `packages/`.
- Supporting areas: `fixtures/`, `scripts/`, `docs/`, and `specs/`. Do not create the future `apps/` or package layout until its owning milestone needs real behavior.
- Planned provider-neutral services: GitHub API/content endpoints, PostgreSQL, S3-compatible object storage, an OIDC-compatible identity provider, and an approved AI provider. No production environment or concrete OIDC/AI/storage vendor is selected here.

## 5. Architecture and Implementation Boundaries

- Dependency direction is `apps → feature/application packages → contracts/domain → shared primitives`; infrastructure implements inward-owned ports. Add every new package to `scripts/check-dependency-boundaries.mjs`; unknown packages fail closed.
- Domain/contracts cannot depend on web, database, GitHub, AI-provider, or UI implementations. UI cannot directly access databases, queues, object storage, providers, or workers. Acquisition cannot reach editorial/publication; AI analysis cannot issue approval commands.
- Treat acquired paths, metadata, manifests, instructions, and bytes as bounded untrusted data. Never check out or execute acquired repositories, invoke their package managers/scripts/hooks/interpreters/binaries/containers, dynamically import their files, or turn their content into system/tool instructions.
- Bind snapshots, analysis, claims, drafts, reviews, and publications to immutable source revisions. Idempotent reprocessing must not create uncontrolled duplicates. Canonical snapshots, publication snapshots, and audit history are immutable from the application perspective; corrections use supersession.
- AI output is a proposal without editorial or publication authority. Only an authenticated, authorized human command may create `INTERNAL_APPROVED`; public publication is outside the alpha.
- Preserve explicit `UNKNOWN`, `AMBIGUOUS`, `CONFLICTING`, `UNSUPPORTED`, and `REVIEW_REQUIRED` states. Do not infer absent facts or represent fixture, live-provider, or real-user evidence as interchangeable.
- Secrets come only from validated environment/secret-manager inputs, use least privilege, and never enter logs, Claims, EvidenceItems, fixtures, or committed `.env` files. Logs exclude credentials, participant identity, and unrestricted source text.
- Acquisition-worker egress is limited to GitHub, PostgreSQL, object storage, and observability. Analysis-worker egress is limited to the approved AI provider, PostgreSQL, object storage, and observability. Required gates remain deterministic and offline after dependency installation.
- Use strict TypeScript and runtime validation at trust boundaries. Pin exact dependencies; do not upgrade runtimes/frameworks or change the lockfile unless the milestone requires it. Add negative tests for each security or governance invariant and preserve backward compatibility unless an approved spec permits a break.

## 6. Supported Commands

Run from the repository root with the pinned runtime.

| Purpose                | Verified repository command                           | Current semantics                                                         |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Install                | `pnpm install --frozen-lockfile`                      | CI-supported; installation is not authorized by every task                |
| Format                 | `pnpm format`                                         | Writes files; scope it carefully                                          |
| Format check           | `pnpm format:check`                                   | Read-only check                                                           |
| Lint                   | `pnpm lint`                                           | ESLint plus dependency and source-safety checks                           |
| Boundary scan          | `pnpm lint:boundaries`                                | Fails on unknown/forbidden package edges                                  |
| Source-safety scan     | `pnpm lint:source-safety`                             | Checks acquired-content runtime paths                                     |
| Typecheck              | `pnpm typecheck`                                      | Turborepo package typecheck                                               |
| Full tests             | `pnpm test`                                           | All discovered Vitest tests                                               |
| Unit                   | `pnpm test:unit`                                      | Positional filters are supported, e.g. `pnpm test:unit -- acquisition`    |
| Contract               | `pnpm test:contract`                                  | Positional filters are supported                                          |
| Integration            | `pnpm test:integration`                               | Suites may be milestone-scoped/opt-in                                     |
| Fixtures               | `pnpm test:fixtures`                                  | Suites may be milestone-scoped                                            |
| Adversarial            | `pnpm test:adversarial`                               | Suites may be milestone-scoped                                            |
| E2E                    | `pnpm test:e2e`                                       | No current feature evidence; empty suite is not a pass claim              |
| Build                  | `pnpm build`                                          | Builds workspace packages                                                 |
| Required local/CI gate | `pnpm verify`                                         | Lint, format check, typecheck, unit, contract, and build                  |
| Database               | `pnpm db:migrate`, `pnpm db:validate`                 | Interface exists; owning capability remains milestone-scoped/unavailable  |
| Validation             | `pnpm validation:technical`, `pnpm validation:report` | Interface exists; measurements/report remain milestone-scoped/unavailable |

`pnpm verify` does not replace milestone-required fixture, adversarial, integration, E2E, migration, recovery, accessibility, or smoke checks. Do not use the execution prompt’s illustrative `--filter` syntax with Vitest 4; use the positional forms proven in milestone specs/reports.

For an exact integration file, use `pnpm exec vitest run --config vitest.integration.config.ts <repository-relative-test-file>` and add `-t '<test-name>'` only when intentionally selecting cases. Do not use `pnpm test:integration -- <filter>`: this argument boundary has caused unintended broad integration runs. Check the runner's selected-file output before treating a focused invocation as evidence.

## 7. Acceptance and Verification Gates

Before a milestone `GO`, require an approved milestone spec, scoped implementation and fixtures, requirement-to-test traceability, all milestone-specific commands, all relevant regression gates, `pnpm verify`, `git diff --check`, a security/secrets review, documentation/path/schema validation as applicable, and a whole-branch diff against local `main`. Review all staged, unstaged, and untracked files and perform a separate independent review pass when available.

For M04, if and only if its exact specification and implementation are separately authorized, observable gates include:

1. Every persisted Claim and EvidenceItem is closed over one immutable, byte-validated M03 bundle and its M01/M02 lineage.
2. Material claims without qualifying evidence remain explicit and block M05 progression; evidence cannot self-authorize a claim.
3. The durable PostgreSQL boundary is forward-only, idempotent, transactionally fenced, append-only except for supersession, and recoverable.
4. Secret, personal-contact, restricted, or prompt-injection content cannot enter public excerpts, Claims, logs, or AI instructions.
5. Evidence, migration, recovery, fixture, adversarial, integration, regression, and `pnpm verify` gates pass under the pinned runtime, with whole-diff and authority-integrity review.

Never weaken, skip, hide, or relabel a failed gate. For every unrun gate, record the reason, strongest substitute evidence, and readiness impact. Pending external measurement is `PENDING`, never zero or a pass. Do not claim milestone `GO` without exact command output and diff evidence.

## 8. Git and Publication Boundaries

Local inspection, scoped editing, documentation, fixtures/tests, migrations, and reversible verification are allowed only when the current task authorizes that milestone work. Use local `main` as the intended PR base unless a later repository instruction changes it. Branch naming currently follows `codex/milestone-NN`; no formal commit-message convention is documented.

Staging, commit, push, tag, PR creation/update, merge, release, public publication, deployment, production-data changes, credentials changes, billing, paid services, and other irreversible external actions each require explicit authorization in the current task. Do not infer one approval from another. Do not use destructive Git operations, rewrite history, delete unrelated work, or stage files to make a report appear clean.

The public repository and remote CI are available through `origin`; CODEOWNERS, required-reviewer rules, and branch protection remain unresolved unless verified separately. Before any separately authorized publication action, verify branch/base, exact diff, checks, review requirements, and absence of secrets. Report commit, push, PR, merge, deployment, publication, and release states separately.

## 9. External Services and Manual Actions

Verified architectural integrations are GitHub APIs/content endpoints, PostgreSQL, S3-compatible object storage, OIDC-compatible authentication, an approved provider-neutral AI service, GitHub Actions, and an optional Docker-compatible runtime for local PostgreSQL integration tests. Required offline gates use fakes/in-memory adapters where applicable and require no live GitHub, object store, identity, or AI credentials; M02 PostgreSQL evidence uses the pinned ephemeral PostgreSQL harness.

Use configured tools, CLIs, APIs, or connectors directly only when the task authorizes the external action. Public ingestion at scale, paid-provider use, public publication, and production deployment remain unauthorized. For a genuinely human-only action, report its purpose, prerequisites, exact UI path or command, exact input type, expected result, test, independent verification, visible success state, failure recovery, and evidence the user should return.

## 10. Completion Report Contract

Every substantial milestone completion report must include:

1. `GO`, `CONDITIONAL GO`, or `NO-GO` and the objective/scope completed.
2. Explicit non-goals preserved and the next milestone not implemented.
3. Repository root, branch, intended base, upstream, staged/unstaged/untracked state, and publication state.
4. Implementation summary and files added, modified, and removed.
5. Acceptance-criteria-to-implementation/test/evidence mapping.
6. Exact verification commands, actual outcomes/counts, and skipped-gate impact.
7. Independent review findings and remediations.
8. Risks, assumptions, limitations, residual issues, and distinctions among fixture, live-provider, and real-user evidence.
9. Remaining manual actions using the procedure in Section 9.
10. Separate commit, push, PR, merge, deployment, publication, and release statuses.
11. A recommended next step that does not implement the next milestone without authorization.

Never describe the system as complete, production-ready, or fully passing without evidence for that exact scope.
