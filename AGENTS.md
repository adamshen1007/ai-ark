# AI ARK — Repository Working Agreement

## 1. Product and Current Outcome

AI ARK is a governed GitHub-to-Skill Technical Alpha that turns a fixed public GitHub revision into structured, evidence-backed, human-reviewable Skill records. Primary alpha users are internal editors/founders and technical reviewers; later validation users and creator participants evaluate approved records and provide evidence.

The validated repository outcome is M02 `GO`: provider-API-only GitHub acquisition produces immutable, policy-versioned snapshots, and the M02 layer adds deterministic classification, attributable AI-analysis contracts, multiple candidate roots, stable Resource/ResourceVersion identity, explicit ambiguity, and governed duplicate/fork/mirror resolution. It does not generate descriptive records or publish product content.

- Current phase: GitHub-to-Skill Technical Alpha.
- Completed and publicly verified implementation baseline: M00, M01, and M02.
- M02 authority: approved `docs/milestones/M02_SPEC.md`, completed implementation, independent `GO — M02 COMMIT READY`, and successful public clean-checkout CI.
- Current authorization boundary: M02 is frozen. M03 is not started or authorized; a branch name or completed M02 state does not activate it.

## 2. Scope and Non-Goals

Completed M02 scope is limited to deterministic and AI-assisted classification, candidate-root and multi-Skill detection, non-Skill/ambiguous outcomes, stable Resource/ResourceVersion identity, fork/mirror/duplicate analysis, durable manual-resolution contracts, and deterministic fixtures. Classification evidence remains attributable, deterministic and AI-assisted outputs remain distinguishable, ambiguity blocks automatic progression, and no descriptive summary precedes identity resolution.

Preserve the completed M02 identity-resolved handoff boundary. Never use later work to make an earlier milestone appear complete.

### Do not implement in the active milestone

- M03+ structured extraction, evidence binding, draft generation, editorial review, publication, directory/search, validation harness, or user validation.
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

Within that hierarchy, the approved active-milestone spec controls its defined implementation scope and acceptance criteria. Completed scoped evidence includes `docs/milestones/M01_SPEC.md`, `docs/milestones/M01_REPORT.md`, `docs/milestones/M02_SPEC.md`, and `docs/milestones/M02_REPORT.md`. No M03 specification or implementation is authorized.

Use `README.md` as the repository entry point; `docs/architecture/ARCHITECTURE.md`, `docs/architecture/DEPENDENCY_RULES.md`, `docs/architecture/SECURITY_BOUNDARIES.md`, accepted ADRs, and `docs/governance/` refine the authorities above. Reports record evidence but do not silently expand authorization.

Resolve conflicts by preserving security and evidence integrity first, then narrow Technical Alpha scope, canonical contracts, and explicit uncertainty. The prototype never defines system truth. Record every material conflict and resolution.

## 4. Repository, Stack, and Layout

- Repository: `ai-ark`; pnpm/Turborepo-style TypeScript modular-monolith workspace.
- Intended base: `main`; the public `origin` is `https://github.com/adamshen1007/ai-ark.git`, and local `main` tracks `origin/main`.
- Runtime: Node `22.23.1`, pnpm `11.7.0`, TypeScript `6.0.3`; versions are pinned in `.node-version`, `.nvmrc`, and `package.json`.
- CI: `.github/workflows/ci.yml` runs frozen installation and `pnpm verify` on pull requests and pushes to `main`.
- Implemented packages: `contracts`, `config`, `testing`, `acquisition`, `github-source`, `object-storage`, `job-queue`, `observability`, `analysis`, `classification`, and `identity` under `packages/`.
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

## 7. Acceptance and Verification Gates

Before a milestone `GO`, require an approved milestone spec, scoped implementation and fixtures, requirement-to-test traceability, all milestone-specific commands, all relevant regression gates, `pnpm verify`, `git diff --check`, a security/secrets review, documentation/path/schema validation as applicable, and a whole-branch diff against local `main`. Review all staged, unstaged, and untracked files and perform a separate independent review pass when available.

For M02 specifically, observable gates are:

1. Classification evidence is retained and deterministic output is distinguishable from AI-assisted output.
2. One repository can yield multiple independently rooted candidates; `NON_SKILL` stops Skill-page generation.
3. Ambiguity is explicit and blocking; duplicate/fork/mirror handling does not create uncontrolled Resources.
4. New versions attach to stable Resource identity and no descriptive summary is generated before identity resolution.
5. Classification, identity, AI-analysis contract, fixture, and adversarial tests pass offline, together with typecheck, lint, build, `pnpm verify`, M00/M01 regressions, migration checks if schemas change, and authority-document integrity checks.

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
