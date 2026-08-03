# AI ARK Technical Alpha Codex Execution Prompt v1.0

**Document type:** Consolidated Codex implementation instruction  
**Version:** 1.0  
**Date:** August 2, 2026  
**Working product name:** AI ARK  
**Program:** GitHub-to-Skill Technical Alpha  
**Authorized implementation scope:** Milestones M00–M09  
**Public production status:** NOT AUTHORIZED  
**Git authorization:** Implementation permitted; commit, push, tag, merge, release, and deployment are not authorized unless separately instructed  
**Primary inputs:**

1. `AI ARK GitHub-to-Skill Technical Alpha PRD v1.0.md`
2. `AI ARK Technical Alpha Architecture v1.0.md`
3. `AI ARK Resource and Capability Graph Specification v1.0.md`
4. `AI ARK Resource Intelligence Pipeline Specification v1.0.md`
5. `AI ARK Information Architecture and UX Specification v1.0.md`
6. approved AI ARK Figma prototype

---

# Copy-Ready Codex Prompt

You are the principal implementation agent for the AI ARK GitHub-to-Skill Technical Alpha.

Your task is to implement Milestones M00 through M09 as one governed, documentation-first engineering program.

Do not merely produce a plan. Inspect the repository, establish the verified starting state, create or update the required documentation, implement the system milestone by milestone, run the required verification, remediate defects, and finish with an evidence-based whole-program GO / NO-GO report.

The Technical Alpha must prove this complete vertical slice:

```text
Public GitHub repository URL
↓
Safe repository acquisition
↓
Immutable source snapshot
↓
Skill/non-Skill classification
↓
Single- or multiple-Skill detection
↓
Resource identity resolution
↓
Structured fact extraction
↓
Evidence-bound claims
↓
AI-assisted Skill-page draft
↓
Human editorial review
↓
Immutable internal publication
↓
Internal Skills directory and Skill Detail
↓
Technical corpus validation
↓
Real-user validation support
```

The system must never execute repository code and must never automatically publish AI-generated content.

---

## 1. Governing Authority

Treat the following documents as authoritative, in this order:

1. this execution prompt;
2. `AI ARK Technical Alpha Architecture v1.0.md`;
3. `AI ARK GitHub-to-Skill Technical Alpha PRD v1.0.md`;
4. `AI ARK Resource Intelligence Pipeline Specification v1.0.md`;
5. `AI ARK Resource and Capability Graph Specification v1.0.md`;
6. other AI ARK product-definition documents;
7. approved Figma prototype for user-facing layout and interaction.

Where documents conflict:

- security and evidence integrity take precedence;
- the Technical Alpha’s narrow scope takes precedence over the broader MVP;
- canonical data contracts take precedence over prototype wording;
- the Figma prototype governs visual hierarchy, not system truth;
- explicit uncertainty is preferable to inferred certainty.

Document every material conflict and its resolution in an ADR, implementation note, or final report.

Do not silently broaden the scope.

---

## 2. Authorization Boundary

This prompt authorizes:

- repository inspection;
- branch creation when appropriate;
- documentation creation;
- source-code implementation;
- schema and migration creation;
- test and fixture creation;
- local verification;
- local database and object-storage usage;
- fixture-backed and fake-provider testing;
- controlled staging-readiness preparation;
- M00–M09 implementation;
- remediation necessary to satisfy acceptance criteria.

This prompt does **not** authorize:

- commit;
- push;
- tag;
- merge;
- pull-request creation;
- release;
- production deployment;
- public publication;
- public repository ingestion at scale;
- use of paid or external services without existing credentials and explicit configuration;
- destructive repository history changes;
- deletion of unrelated work;
- automatic execution of acquired repository content.

Leave all intended changes uncommitted unless a later instruction explicitly authorizes Git side effects.

Never stage files merely to make the report appear clean.

---

## 3. Required Working Method

Follow this sequence.

### Step 1 — Verify the starting state

Before changing files, inspect and report:

```bash
pwd
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
git log -5 --oneline
find . -maxdepth 2 -type f | sort | sed -n '1,240p'
```

Also inspect:

- package manifests;
- lockfiles;
- runtime-version files;
- existing CI;
- existing documentation;
- existing architecture;
- database configuration;
- existing tests;
- uncommitted or untracked work;
- repository-specific agent instructions.

If the repository is empty, initialize it within M00.

If the repository already contains implementation, adapt to it rather than replacing it blindly.

Do not overwrite user work.

### Step 2 — Establish an implementation inventory

Create a starting inventory that distinguishes:

- pre-existing files;
- pre-existing modifications;
- changes authorized by this prompt;
- unrelated files that must remain untouched.

### Step 3 — Read authority documents

Read all available governing documents before implementation.

Create a concise implementation traceability matrix mapping:

```text
Requirement
→ Architecture component
→ Milestone
→ Tests
→ Evidence
```

### Step 4 — Execute milestones sequentially

Execute M00 through M09 in order.

A milestone may depend only on contracts and behavior approved in previous milestones.

Do not begin a later milestone by weakening an earlier invariant.

### Step 5 — Gate every milestone

For every milestone:

1. create or update milestone specification;
2. implement only that milestone’s authorized scope;
3. add tests and fixtures;
4. run milestone-specific verification;
5. run all relevant regression tests;
6. inspect the actual diff;
7. issue a milestone GO / NO-GO decision;
8. remediate until GO or document a true blocker.

Continue automatically to the next milestone after an internal GO.

Stop only for:

- missing human decision that changes product meaning;
- unavailable required credential with no valid fake-provider path;
- destructive repository conflict;
- irreconcilable specification conflict;
- security issue that cannot be safely remediated;
- inability to meet a mandatory gate without changing authorized scope.

### Step 6 — Conduct independent whole-branch review

After M09:

- review the entire intended change set as if you were an independent reviewer;
- inspect dependency direction;
- inspect security boundaries;
- inspect evidence integrity;
- inspect schema and migration safety;
- inspect tests for false confidence;
- inspect all untracked and modified files;
- verify that no prohibited Git or deployment action occurred.

### Step 7 — Produce the final report

Finish with the exact report structure defined near the end of this prompt.

---

## 4. Technical Baseline

Unless the existing repository has an already-approved equivalent, use:

```text
Language              TypeScript
Runtime               Node.js 22.x, repository-pinned
Package manager       pnpm
Repository            pnpm workspace with Turborepo-style orchestration
Web UI                 React-based server-rendered application
API                    TypeScript HTTP application with runtime schema validation
Database               PostgreSQL
Database access        Typed SQL or typed query-builder boundary
Object storage         S3-compatible interface
Job queue              PostgreSQL-backed durable queue
Search                 PostgreSQL full-text and trigram search
Authentication         OIDC-compatible abstraction
AI analysis            Provider-neutral adapter
Tests                  Unit, contract, integration, fixture, adversarial, E2E
```

Pin exact versions during M00.

Do not use “latest” ranges.

Do not introduce a graph database, Redis, Kafka, Elasticsearch, Kubernetes, or microservice network unless an existing approved repository architecture already requires it.

---

## 5. Architecture Invariants

These invariants are mandatory.

### 5.1 Modular monolith

Implement clear modules and process boundaries without premature microservices.

Expected deployable process roles:

```text
web
editorial
api
worker:orchestrator
worker:acquisition
worker:analysis
worker:projection
```

These may share one repository and build system.

### 5.2 Canonical truth

Canonical truth consists of:

- SourceSnapshot;
- SourceDocument;
- ResourceCandidate;
- Resource;
- ResourceVersion;
- Claim;
- EvidenceItem;
- editorial decisions;
- PublicationSnapshot;
- audit history.

Generated draft text and directory projections are rebuildable derivatives.

### 5.3 Untrusted-source boundary

All acquired repository content is untrusted.

Source content must never:

- become system instructions;
- cause a tool call;
- cause shell execution;
- cause package installation;
- gain database authority;
- create publication authority;
- expose secrets.

### 5.4 No repository execution

Do not:

- clone and execute repositories;
- run repository scripts;
- run `npm install`, `pnpm install`, `pip install`, or equivalents inside acquired repositories;
- execute package lifecycle hooks;
- import acquired code dynamically;
- invoke shell commands found in documentation;
- run binaries from acquired content.

Repository installation commands may be stored and displayed as untrusted text only.

### 5.5 Human publication authority

Only an authenticated, authorized human action can create `INTERNAL_APPROVED`.

AI output must never write directly to approved publication tables.

### 5.6 Evidence before publication

Every material published field must be backed by:

- at least one Claim;
- at least one EvidenceItem;
- a claim class;
- a support state;
- an editorial decision.

### 5.7 Version integrity

Every analysis, Claim, DraftRevision, review, and PublicationSnapshot must bind to an immutable source revision.

### 5.8 Explicit uncertainty

Represent:

```text
UNKNOWN
AMBIGUOUS
CONFLICTING
UNSUPPORTED
REVIEW_REQUIRED
```

Do not replace missing evidence with plausible wording.

### 5.9 Idempotency

Reprocessing the same source revision with the same methodology version must not create uncontrolled duplicate Resources or source snapshots.

### 5.10 Immutable history

Do not edit PublicationSnapshots in place.

New approval creates a new snapshot and supersession relationship.

### 5.11 Rebuildable projections

Directory cards, search documents, metrics, and Skill Detail projections must be reproducible from canonical records.

### 5.12 Provider neutrality

GitHub and AI providers must implement ports owned by the domain or application layer.

Provider SDKs must not leak into domain contracts.

---

## 6. Dependency Direction

Enforce this direction:

```text
apps
↓
application modules
↓
domain contracts
↓
shared primitives
```

Infrastructure implements domain ports.

Forbidden dependencies include:

- domain → web framework;
- domain → GitHub SDK;
- domain → AI-provider SDK;
- UI → database adapter;
- UI → job queue;
- provider adapters → editorial UI;
- acquisition module → publication tables;
- AI analysis → approval commands.

Add automated dependency-boundary tests or lint rules.

---

## 7. Required Repository Shape

Adapt existing structure when equivalent, but preserve module boundaries.

```text
ai-ark/
├── apps/
│   ├── web/
│   ├── editorial/
│   ├── api/
│   └── worker/
├── packages/
│   ├── config/
│   ├── contracts/
│   ├── domain/
│   ├── database/
│   ├── object-storage/
│   ├── job-queue/
│   ├── source-provider/
│   ├── github-source/
│   ├── acquisition/
│   ├── classification/
│   ├── identity/
│   ├── extraction/
│   ├── ai-analysis/
│   ├── evidence/
│   ├── draft-generation/
│   ├── editorial/
│   ├── publication/
│   ├── directory/
│   ├── search/
│   ├── analytics/
│   ├── validation-harness/
│   ├── observability/
│   ├── security/
│   ├── ui/
│   └── testing/
├── fixtures/
│   ├── repositories/
│   ├── provider-responses/
│   ├── ai-responses/
│   ├── expected/
│   └── adversarial/
├── docs/
│   ├── architecture/
│   ├── milestones/
│   ├── operations/
│   └── validation/
├── specs/
├── scripts/
├── AGENTS.md
├── README.md
├── package.json
└── pnpm-lock.yaml
```

Do not create empty packages merely to satisfy the diagram.

Every package must have a defined responsibility, public API, tests where relevant, and documented dependency direction.

---

## 8. Required Root Commands

Provide consistent root commands.

At minimum:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:contract
pnpm test:integration
pnpm test:fixtures
pnpm test:adversarial
pnpm test:e2e
pnpm build
pnpm db:validate
pnpm db:migrate
pnpm validation:technical
pnpm validation:report
pnpm verify
```

`pnpm verify` must run the complete required local gate suitable for CI.

Do not make required tests depend on live GitHub or live AI-provider calls.

---

# 9. M00 — Technical Alpha Governance and Repository Foundation

## Objective

Create the governed engineering baseline before feature implementation.

## Required deliverables

### 9.1 Repository and runtime

Create or verify:

- pinned Node.js 22 runtime;
- pinned pnpm version;
- workspace configuration;
- build orchestration;
- strict TypeScript configuration;
- formatting and linting;
- environment-schema validation;
- test runner;
- CI workflow;
- dependency-boundary enforcement;
- deterministic install.

### 9.2 Documentation

Create:

```text
README.md
AGENTS.md
docs/architecture/ARCHITECTURE.md
docs/architecture/SECURITY_BOUNDARIES.md
docs/architecture/DEPENDENCY_RULES.md
docs/operations/LOCAL_DEVELOPMENT.md
docs/validation/TECHNICAL_ALPHA_VALIDATION_PLAN.md
docs/milestones/M00_SPEC.md
CHANGELOG.md
```

Create the following ADRs:

```text
ADR-001 Modular Monolith for Technical Alpha
ADR-002 PostgreSQL as Canonical Store
ADR-003 PostgreSQL-Backed Durable Job Queue
ADR-004 S3-Compatible Content-Addressed Source Storage
ADR-005 GitHub API Acquisition Without Repository Checkout
ADR-006 Provider-Neutral AI Analysis Boundary
ADR-007 Evidence-First Claim Model
ADR-008 Immutable Publication Snapshots
ADR-009 OIDC-Compatible Internal Authentication
ADR-010 PostgreSQL Search for Technical Alpha
ADR-011 No Automatic Publication
ADR-012 No Repository Code Execution
```

### 9.3 Canonical enums and primitives

Create versioned contracts for:

```text
RepositoryClassification
IdentityOutcome
ClaimClass
ClaimSupportStatus
ExtractionStatus
EvidenceType
EvidenceVisibility
EditorialDecision
ReviewBlockerCode
PublicationStatus
IngestionStage
IngestionTerminalStatus
MaintenanceLabel
LicenseStatus
CompatibilityEvidenceClass
Role
AuditEventType
```

Create:

- opaque ID primitives;
- timestamp contracts;
- content-fingerprint primitive;
- canonical JSON serialization utility;
- result and error contracts;
- schema versioning policy.

### 9.4 Test foundation

Create:

- fake clock;
- deterministic ID generator;
- fixture loader;
- fake source provider;
- fake AI provider;
- ephemeral PostgreSQL test harness;
- object-storage test adapter;
- structured-log capture;
- audit capture.

### 9.5 CI

CI must run:

```bash
pnpm install --frozen-lockfile
pnpm verify
```

Required tests must be deterministic and offline.

## M00 acceptance criteria

- repository installs deterministically;
- all root commands exist;
- strict TypeScript passes;
- dependency boundaries are enforced;
- documentation and ADRs exist;
- AGENTS.md contains development and safety rules;
- CI has no live-provider dependency;
- no feature package violates the architecture direction;
- initial test suite passes;
- no commit or push occurred.

## M00 required verification

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm build
pnpm verify
git status --short
git diff --stat
```

---

# 10. M01 — GitHub Acquisition Foundation

## Objective

Safely acquire public GitHub source evidence without checking out or executing repository content.

## Required modules

```text
source-provider
github-source
acquisition
object-storage
job-queue
security
observability
```

## Required behavior

### 10.1 URL validation

Support:

```text
https://github.com/{owner}/{repository}
```

Normalize:

- trailing slash;
- `.git` suffix;
- case where provider semantics allow;
- repository-root links.

Reject:

- non-GitHub hosts;
- malformed owner or repository;
- embedded credentials;
- unexpected ports;
- deceptive hosts;
- unsupported path types;
- private or inaccessible repositories;
- redirect ambiguity.

### 10.2 Provider contract

Implement a provider-neutral `SourceProvider` interface covering:

- reference validation;
- immutable snapshot resolution;
- repository metadata;
- file-tree listing;
- selected file acquisition;
- release and tag signals;
- license signals;
- fork and archived signals.

### 10.3 Acquisition method

Use GitHub APIs or approved content endpoints.

Do not perform a local repository checkout.

Resolve:

- repository provider ID;
- canonical URL;
- default branch;
- immutable commit SHA;
- source revision;
- fork relationship;
- archived state.

### 10.4 File policy

Implement configurable:

- file-count limit;
- total selected-byte limit;
- per-file-byte limit;
- maximum path length;
- maximum line count;
- allowlisted text formats;
- binary detection;
- encoding handling;
- skip and quarantine reasons.

Reject or quarantine:

- path traversal;
- absolute paths;
- null bytes;
- normalized duplicate paths;
- case collisions;
- symlinks;
- unsupported submodule indirection;
- oversized files;
- archives and executables.

### 10.5 Source snapshots

Create canonical records:

```text
SourceSubmission
SourceReference
SourceSnapshot
SourceDocument
SourceEntry
AcquisitionPolicyVersion
```

SourceSnapshot identity must include:

```text
provider
+
provider repository ID
+
immutable commit SHA
+
acquisition policy version
```

Store selected file bytes using SHA-256 content addressing.

### 10.6 Durable jobs

Implement:

- job creation;
- stage persistence;
- retries;
- cancellation;
- terminal failure;
- dead-letter/operator-review state;
- idempotency.

Initial stages:

```text
RECEIVED
VALIDATING_SOURCE
ACQUIRING_SOURCE
INVENTORYING_SOURCE
```

### 10.7 Observability

Record:

- request ID;
- job ID;
- source snapshot ID;
- acquired file count;
- skipped file count;
- selected bytes;
- duration;
- provider rate-limit state;
- safe failure code.

## Required fixtures

- valid public repository;
- missing repository;
- private repository response;
- malformed URL;
- redirect-like URL;
- oversized file;
- too many files;
- binary files;
- symlink;
- path traversal;
- case collision;
- archived repository;
- fork;
- GitHub rate limit;
- transient provider failure.

## M01 acceptance criteria

- acquisition binds to immutable commit SHA;
- content addressing is deterministic;
- repeated acquisition is idempotent;
- no repository checkout occurs;
- no source content executes;
- unsafe paths fail closed;
- skipped content is recorded;
- retries do not duplicate canonical snapshots;
- required tests do not access live GitHub;
- stage outcomes and failures are durable.

## M01 required verification

```bash
pnpm test:unit --filter acquisition
pnpm test:contract --filter source-provider
pnpm test:integration --filter github-source
pnpm test:fixtures --filter acquisition
pnpm test:adversarial --filter source-safety
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 11. M02 — Skill Detection and Resource Identity

## Objective

Classify repositories and resolve stable Resource candidates before generating descriptive content.

## Required modules

```text
classification
identity
domain
database
ai-analysis
```

## Required behavior

### 11.1 Repository classification

Support outcomes:

```text
SINGLE_SKILL
MULTIPLE_SKILLS
SKILL_COLLECTION
SKILL_PLUS_APPLICATION
NON_SKILL
AMBIGUOUS
UNSUPPORTED
```

### 11.2 Deterministic pre-classifier

Use:

- `SKILL.md`;
- metadata blocks;
- known directory patterns;
- repository description;
- manifest names;
- candidate roots;
- README sections;
- archived and fork signals.

Produce:

- likely class;
- candidate roots;
- evidence IDs;
- confidence;
- whether AI assistance is needed.

### 11.3 AI-assisted classifier

Use only selected, labelled, untrusted evidence.

The AI response must return:

- classification;
- candidate roots;
- evidence IDs;
- confidence;
- ambiguity;
- warnings.

Do not allow arbitrary tools.

### 11.4 Multi-Skill detection

A repository may produce multiple ResourceCandidates.

Preserve:

- shared SourceSnapshot;
- candidate root path;
- independently usable boundary;
- repository-level relationship;
- collection or bundle relationship.

Do not merge independent Skills into one candidate.

### 11.5 Identity resolution

Implement outcomes:

```text
NEW_RESOURCE
EXISTING_RESOURCE_NEW_VERSION
POSSIBLE_DUPLICATE
FORK_OF_EXISTING_RESOURCE
MIRROR
AMBIGUOUS_IDENTITY
```

Use:

- provider repository ID;
- canonical URL;
- candidate root path;
- explicit manifest identifier;
- normalized name;
- creator or organization;
- source-content fingerprint;
- GitHub fork metadata.

### 11.6 Stable identity

Create:

```text
ResourceCandidate
ResourceCandidateRoot
Resource
ResourceVersion
ResourceSourceLink
DuplicateCandidate
ForkRelationship
```

Resource ID remains stable across versions.

ResourceVersion binds to one SourceSnapshot.

### 11.7 Manual resolution contract

Support durable human commands:

- create new Resource;
- attach to existing Resource;
- mark fork;
- mark duplicate;
- mark mirror;
- split candidates;
- reject;
- request clarification.

Ambiguity blocks automatic progression to approved publication.

## Required fixtures

- one Skill;
- several Skills under `/skills`;
- collection repository;
- Skill plus demo application;
- ordinary library with no Skill;
- fork;
- mirror;
- duplicate content under different repository;
- ambiguous name;
- same Skill new release;
- two different Skills with similar names.

## M02 acceptance criteria

- classification evidence is retained;
- deterministic and AI-assisted outputs remain distinguishable;
- one repository may yield multiple candidates;
- NON_SKILL stops Skill-page generation;
- ambiguity is explicit and blocking;
- duplicates do not create uncontrolled new Resources;
- new versions attach to stable Resource identity;
- no descriptive summary is generated before identity resolution.

## M02 required verification

```bash
pnpm test:unit --filter classification
pnpm test:unit --filter identity
pnpm test:contract --filter ai-analysis
pnpm test:fixtures --filter classification
pnpm test:fixtures --filter identity
pnpm test:adversarial --filter classification
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 12. M03 — Structured Extraction

## Objective

Extract structured Skill facts with explicit evidence state and uncertainty.

## Required modules

```text
extraction
domain
contracts
ai-analysis
github-source
```

## Required extraction fields

- canonical Skill name;
- creator;
- organization;
- version;
- source revision;
- license;
- categories;
- outcome candidate;
- capabilities;
- Tasks;
- use cases;
- target-user candidates;
- installation;
- configuration;
- dependencies;
- external services;
- permissions;
- compatibility;
- limitations;
- maintenance signals.

## Required method

Apply deterministic extraction before AI interpretation.

### 12.1 Deterministic parsers

Implement parsers for:

- repository metadata;
- release and tag metadata;
- package manifests;
- Skill metadata;
- license files;
- Markdown headings and sections;
- fenced command blocks;
- dependency declarations;
- runtime names;
- changelog versions;
- archived state;
- last source update.

### 12.2 AI-assisted normalization

Use AI only for:

- capability normalization;
- Task mapping;
- purpose synthesis;
- Best for;
- Not ideal for;
- target-user proposals;
- limitation synthesis;
- permission inference from static evidence;
- ambiguity detection.

### 12.3 Extraction field contract

Every field result must include:

```text
field_key
value
status
claim_class
confidence
evidence_ids
conflict_ids
warning_codes
```

Supported statuses:

```text
EXPLICIT
STRONGLY_SUPPORTED
INFERRED
CONFLICTING
MISSING
UNSUPPORTED
REVIEW_REQUIRED
```

### 12.4 Version precedence

Resolve version in this order:

1. explicit release or tag;
2. package manifest;
3. `SKILL.md` metadata;
4. changelog;
5. source revision fallback.

Conflicts remain visible.

### 12.5 License states

Support:

```text
CONFIRMED
CONFLICTING
MISSING
CUSTOM
AMBIGUOUS
REVIEW_REQUIRED
```

### 12.6 Compatibility evidence

Support:

```text
AI_ARK_TEST
SOURCE_DECLARATION
CREATOR_DECLARATION
COMMUNITY_REPORT
FORMAT_INFERENCE
UNKNOWN
```

The alpha must not create `AI_ARK_TEST` unless a controlled test record exists.

### 12.7 Permissions

Support:

```text
EXPLICIT
CODE_INDICATED
INFERRED
UNKNOWN
```

Never claim a permission is absent solely because documentation is silent.

### 12.8 Installation

Preserve exact commands and evidence.

Installation status:

```text
EXPLICIT_COMPLETE
EXPLICIT_PARTIAL
MULTIPLE_PATHS
INFERRED
MISSING
UNSAFE_OR_AMBIGUOUS
```

Do not execute commands.

## Required fixtures

- explicit version;
- conflicting versions;
- no version;
- explicit license;
- missing license;
- custom license;
- complete installation;
- partial installation;
- multiple install paths;
- network-dependent Skill;
- shell-access requirement;
- undocumented permission;
- unsupported compatibility claim;
- archived Skill;
- no known limitation.

## M03 acceptance criteria

- every field validates against versioned schema;
- deterministic facts remain distinguishable from AI inference;
- unknowns are explicit;
- exact commands are preserved;
- no installation command is invented;
- conflicting versions and licenses are not silently resolved;
- permissions are not falsely declared absent;
- output is reproducible from fixed fixtures.

## M03 required verification

```bash
pnpm test:unit --filter extraction
pnpm test:contract --filter extraction
pnpm test:fixtures --filter extraction
pnpm test:adversarial --filter extraction
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 13. M04 — Evidence Binding and Prompt-Injection Defense

## Objective

Make evidence and claim integrity enforceable.

## Required modules

```text
evidence
ai-analysis
security
database
contracts
```

## Required entities

```text
Claim
EvidenceItem
ClaimEvidenceLink
EvidenceConflict
ExtractionRun
AnalysisRun
MethodologyVersion
PromptBundleVersion
```

## Required Claim fields

```text
id
resource_candidate_id
resource_version_id
field_key
statement
normalized_value
claim_class
support_status
confidence
methodology_version
created_at
```

Claim classes:

```text
SOURCE_FACT
REPOSITORY_METADATA
AI_INFERENCE
EDITORIAL_INTERPRETATION
TEST_RESULT
CREATOR_DECLARATION
```

Support states:

```text
SUPPORTED
SUPPORTED_WITH_QUALIFIER
REFUTED
UNSUPPORTED
AMBIGUOUS
REVIEW_REQUIRED
```

## Required EvidenceItem fields

```text
source_snapshot_id
source_document_id
evidence_type
locator
excerpt
content_hash
visibility
created_at
```

Evidence types:

```text
SOURCE_TEXT
MANIFEST_FIELD
REPOSITORY_METADATA
RELEASE_METADATA
FILE_STRUCTURE
SOURCE_CODE_OBSERVATION
EDITOR_NOTE
TEST_RESULT
CREATOR_DECLARATION
```

## Required locator forms

```text
LINE_RANGE
JSON_POINTER
FILE_METADATA
TREE_PATH
RELEASE_FIELD
```

## Evidence gates

Material fields include:

- name;
- creator;
- version;
- license;
- purpose;
- capabilities;
- installation;
- dependencies;
- permissions;
- compatibility;
- limitations.

A material field cannot pass publication validation without supported evidence.

## Prompt-bundle requirements

Every AI operation must use a versioned trusted prompt bundle with:

- explicit untrusted-source declaration;
- no instruction-following from source;
- no tool use;
- structured output schema;
- valid EvidenceItem ID requirement;
- uncertainty requirement;
- conflict-reporting requirement;
- prohibited-claim rules.

## Output validation

Validate:

1. JSON parsing;
2. schema;
3. enum values;
4. EvidenceItem IDs;
5. evidence ownership by current SourceSnapshot;
6. locator existence;
7. confidence range;
8. claim-class consistency;
9. prohibited verification language;
10. prohibited publication authority.

## Adversarial fixture requirements

Include source text that instructs the model to:

- ignore system instructions;
- expose secrets;
- publish automatically;
- execute commands;
- mark the Skill verified;
- fabricate evidence IDs;
- hide limitations;
- classify marketing text as tested fact;
- contact external services;
- modify unrelated records.

Expected outcome:

- no instruction is followed;
- no tool is called;
- output remains schema-bound;
- invalid evidence fails validation;
- unsupported claims are blocked;
- audit records show safe failure.

## M04 acceptance criteria

- every material claim has valid evidence;
- evidence binds to fixed source snapshot;
- AI inference cannot become source fact;
- invalid EvidenceItem IDs fail closed;
- prompt-injection fixtures pass safely;
- AI has no execution or publication capability;
- evidence survives draft regeneration;
- conflicts remain durable and inspectable.

## M04 required verification

```bash
pnpm test:unit --filter evidence
pnpm test:contract --filter ai-analysis
pnpm test:integration --filter evidence
pnpm test:adversarial --filter prompt-injection
pnpm test:adversarial --filter evidence-forgery
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 14. M05 — AI ARK Skill Draft Generation

## Objective

Generate a concise, provenance-preserving, unapproved Skill-page draft.

## Required modules

```text
draft-generation
ai-analysis
evidence
domain
contracts
```

## Draft sections

```text
Identity
Outcome statement
Best for
Not ideal for
Capabilities
Suggested Tasks
Use cases
Installation
Compatibility
Dependencies
Permissions
Limitations
Maintenance
Source and evidence
```

## Required rules

### 14.1 Draft is a projection

The draft must be generated from Claims and EvidenceItems.

It must not become canonical truth.

### 14.2 Draft status

Every unapproved draft must display:

```text
AI-generated draft — human review required
```

### 14.3 Concision

Public-facing copy must:

- lead with user outcome;
- avoid promotional adjectives;
- avoid repeated methodology explanation;
- avoid raw evidence clutter in the main view;
- expose detail through evidence panels or progressive disclosure;
- preserve limitations and uncertainty.

### 14.4 Fact classes

The UI and contracts must distinguish:

- source fact;
- repository metadata;
- AI inference;
- editorial interpretation;
- test result;
- creator declaration.

### 14.5 Draft revisions

Create a new DraftRevision when:

- SourceSnapshot changes;
- extraction changes;
- methodology changes;
- prompt bundle changes;
- editor explicitly regenerates;
- accepted editorial decisions update the preview.

Do not mutate old DraftRevisions.

### 14.6 Determinism and provenance

Persist:

- input fingerprint;
- Claim set;
- prompt bundle version;
- provider and model;
- output fingerprint;
- generated time;
- token and duration metrics.

## Required fixtures

- complete evidence set;
- incomplete evidence;
- conflicting purpose;
- several capabilities;
- no suitable limitation;
- unsupported marketing claim;
- inferred target user;
- multiple install paths;
- missing license.

## M05 acceptance criteria

- draft contains required sections;
- source facts and editorial interpretations are distinguishable;
- unsupported material content is excluded or visibly blocked;
- draft remains concise;
- no verification badge is generated;
- no production score or rank is generated;
- draft versions are immutable;
- provenance is durable.

## M05 required verification

```bash
pnpm test:unit --filter draft-generation
pnpm test:contract --filter draft
pnpm test:fixtures --filter draft-generation
pnpm test:adversarial --filter generated-claims
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 15. M06 — Editorial Review and Internal Publication Boundary

## Objective

Create the human review system and enforce publication authority.

## Required modules and apps

```text
apps/editorial
editorial
publication
database
audit
security
ui
```

## Required editorial UI

Implement a three-pane review workspace.

### Left pane — Source and evidence

- source file tree;
- selected file;
- line or locator reference;
- EvidenceItem details;
- source revision;
- acquisition warnings.

### Center pane — Draft preview

- AI ARK Skill Detail preview;
- section navigation;
- unapproved label;
- visible blockers;
- version state.

### Right pane — Field inspector

- proposed field value;
- Claim class;
- support state;
- confidence;
- evidence links;
- conflicts;
- reviewer action;
- reviewer notes.

## Required field decisions

```text
ACCEPT
EDIT
REJECT
MARK_UNSUPPORTED
REQUEST_EVIDENCE
REQUEST_CREATOR_CLARIFICATION
HIDE
```

## Required review entities

```text
DraftRevision
DraftField
EditorialReview
FieldReviewDecision
ReviewBlocker
ReviewerNote
```

## Deterministic blockers

At minimum:

```text
NO_VALID_SKILL
AMBIGUOUS_RESOURCE_IDENTITY
MISSING_SOURCE_REVISION
UNSUPPORTED_MATERIAL_CLAIM
INSTALLATION_WITHOUT_EVIDENCE
UNRESOLVED_LICENSE_CONFLICT
DUPLICATE_UNRESOLVED
SEVERE_SOURCE_SAFETY_FINDING
SCHEMA_INVALID
```

## Concurrency

Use optimistic concurrency for:

- EditorialReview version;
- DraftRevision version;
- field decisions.

Return stable `REVIEW_CONFLICT` errors.

## Approval transaction

Approval must atomically:

1. authenticate reviewer;
2. authorize role;
3. validate record versions;
4. evaluate blockers;
5. assemble approved fields;
6. create or attach Resource;
7. create ResourceVersion;
8. create immutable PublicationSnapshot;
9. update current internal version pointer;
10. write audit events;
11. enqueue projection rebuild.

## Required publication statuses

```text
INTERNAL_APPROVED
INTERNAL_HIDDEN
SUPERSEDED
REVOKED
```

Do not implement public publication.

## Authentication and roles

Implement an internal authorization abstraction supporting:

```text
ADMIN
EDITOR
TECHNICAL_REVIEWER
VALIDATION_RESEARCHER
VIEWER
```

Required capabilities:

- submit source;
- inspect raw evidence;
- review fields;
- resolve identity;
- approve;
- browse approved Skills;
- view validation metrics;
- manage roles.

Tests must enforce object-level and state-level authorization.

## Audit

Audit:

- source submission;
- field decision;
- blocker creation;
- blocker override;
- identity resolution;
- approval;
- rejection;
- revocation;
- role change;
- restricted evidence access.

## M06 acceptance criteria

- no browser can write approved publication directly;
- AI cannot approve;
- unresolved blockers prevent approval;
- every decision is durable and audited;
- PublicationSnapshot is immutable;
- corrections create superseding snapshots;
- role and object-level authorization pass;
- concurrent edit conflict is handled;
- unapproved content never appears in approved read models.

## M06 required verification

```bash
pnpm test:unit --filter editorial
pnpm test:unit --filter publication
pnpm test:contract --filter editorial-api
pnpm test:integration --filter approval
pnpm test:integration --filter authorization
pnpm test:e2e --filter editorial
pnpm test:adversarial --filter publication-bypass
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 16. M07 — Internal Skills Directory and Skill Detail

## Objective

Display only approved Skill records through the approved AI ARK product structure.

## Required modules and apps

```text
apps/web
directory
search
publication
ui
analytics
```

## Required directory states

Implement tabs:

```text
All
Development
Research
Presentation
Design
Content
Data
Productivity
Founder
```

## Required card fields

- visual background or deterministic placeholder art;
- Skill name;
- concise outcome;
- creator avatar or safe fallback;
- creator name;
- internal feature status;
- New / Just launched / internal approval date where applicable.

Do not display production Quality Score or Evidence Confidence as a ranking claim.

## Required ordering

Use an explicit internal-only order:

1. manually featured;
2. validation priority;
3. internal approval date;
4. name.

Label it as non-production where necessary.

## Search

Support:

- Skill name;
- outcome;
- creator;
- category;
- Capability;
- Task;
- runtime.

Use PostgreSQL search for the alpha.

Semantic search is out of scope.

## Skill Detail

Display approved:

- identity;
- creator;
- source;
- ResourceVersion;
- outcome;
- Best for;
- Not ideal for;
- capabilities;
- Tasks and use cases;
- installation;
- compatibility;
- dependencies;
- permissions;
- limitations;
- maintenance;
- version state;
- source and evidence links;
- Follow Skill prototype action;
- validation-feedback action.

Use the approved warm visual system:

- warm ivory surfaces;
- dark charcoal text;
- serif-led headings;
- restrained terracotta actions;
- sage, amber, and plum statuses;
- progressive disclosure for explanation.

## Projection architecture

Build rebuildable projections:

```text
PublishedSkillProjection
SkillCardProjection
SkillDetailProjection
SearchDocument
CreatorSummaryProjection
```

Provide:

- rebuild one projection;
- rebuild all projections;
- validate projection fingerprint;
- detect canonical/projection mismatch.

## Analytics events

At minimum:

```text
skill.viewed
category.selected
source.opened
install.action.copied
skill.followed
validation.feedback.started
validation.feedback.submitted
```

## M07 acceptance criteria

- only approved PublicationSnapshots appear;
- category tabs work;
- search works over approved projections;
- Skill Detail exactly reflects approved content;
- source and revision are visible;
- temporary ordering is not presented as production ranking;
- projections can be rebuilt;
- projection failure cannot mutate canonical data;
- keyboard navigation and non-color status text are supported.

## M07 required verification

```bash
pnpm test:unit --filter directory
pnpm test:unit --filter search
pnpm test:integration --filter projections
pnpm test:e2e --filter skills-directory
pnpm test:e2e --filter skill-detail
pnpm test:e2e --filter category-tabs
pnpm test:e2e --filter approved-only
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 17. M08 — Technical Validation Harness

## Objective

Create a first-class, reproducible validation system for the 25-repository corpus.

## Required module

```text
validation-harness
```

## Required corpus composition

Target:

| Repository type | Count |
|---|---:|
| Clear, well-documented Skill | 6 |
| Weak documentation | 5 |
| Multiple Skills in one repository | 4 |
| Fork or duplicate | 3 |
| Archived or abandoned | 2 |
| Missing or ambiguous license | 2 |
| Suspicious prompt or source instruction | 1 |
| Complex regional dependency | 1 |
| Non-Skill submitted as Skill | 1 |

Do not require live public repositories in CI.

Represent the corpus through fixed fixtures and optionally a separately authorized live-validation profile.

## Corpus manifest

Create a versioned manifest:

```text
corpus version
source reference
fixed revision
fixture location
expected classification
expected candidate count
known conditions
expected blockers
independent ground truth
```

Do not define expected AI wording.

## Required metrics

### Acquisition

- access success;
- fixed revision success;
- file-inventory success;
- skipped files;
- duration.

### Classification

- Skill/non-Skill accuracy;
- single/multiple-Skill accuracy;
- precision and recall;
- identity accuracy;
- duplicate and fork precision.

### Extraction

- field completion;
- material factual accuracy;
- evidence coverage;
- version accuracy;
- license accuracy;
- installation accuracy;
- unsupported-claim rate.

### Editorial

- review time;
- accepted fields;
- edited fields;
- rejected fields;
- blocker rate;
- approval rate.

### Safety

- source code executed;
- prompt-injection success;
- invalid evidence accepted;
- automatic publication;
- path-policy bypass;
- secret disclosure.

## Required technical GO calculations

Calculate:

```text
Public repository acquisition success        ≥95%
Correct Skill/non-Skill classification        ≥90%
Correct Resource identity                     ≥90%
Fork/duplicate precision                      ≥95%
Material factual claims with evidence         100%
No repository code executed                   100%
No automatic publication                      100%
No severe prompt-injection compromise         100%
Material factual correction rate              <10%
Median standard review time                    <10 minutes
```

When a real 25-repository corpus cannot be completed without external selection, implement:

- the complete harness;
- representative fixed fixtures;
- corpus manifest template;
- import command;
- report generation;
- clearly mark live measurements as pending.

Do not invent live results.

## Required commands

```bash
pnpm validation:technical
pnpm validation:report
```

Reports must include:

- corpus version;
- methodology version;
- prompt bundle version;
- actual denominators;
- missing measurements;
- failure inventory;
- GO / CONDITIONAL GO / NO-GO calculation.

## M08 acceptance criteria

- fixture corpus runs deterministically;
- metrics are reproducible;
- expected and actual data remain separate;
- fixture changes are visible in review;
- adversarial outcomes fail safely;
- report does not fabricate live-user or live-repository results;
- all mandatory technical metrics have definitions.

## M08 required verification

```bash
pnpm test:unit --filter validation-harness
pnpm test:fixtures
pnpm test:adversarial
pnpm validation:technical
pnpm validation:report
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 18. M09 — User Validation Support and Final Alpha Decision

## Objective

Implement the system support required to test reviewed Skill pages with invited users and calculate user-value GO criteria.

This milestone must not fabricate real participant outcomes.

## Required functionality

### 18.1 Participant records

Create restricted records for:

```text
ValidationParticipant
ValidationSession
SkillInteraction
ValidationOutcome
ValidationMetricSnapshot
```

Separate participant identity from product telemetry.

Use pseudonymous IDs in events and reports.

### 18.2 Validation tasks

Support collection of:

- participant type;
- real task description;
- PublicationSnapshot used;
- whether purpose was understood;
- whether runtime was understood;
- whether limitations were found;
- source-open action;
- installation attempt;
- installation success;
- task attempt;
- task completion;
- usefulness versus README;
- research-time savings;
- missing information;
- major misunderstanding;
- willingness to use again.

### 18.3 User-value calculations

Calculate:

```text
Users finding pages more useful than README alone     ≥60%
Users reporting meaningful research-time savings      ≥50%
Users taking source/install/follow action              ≥30%
Successful installations or meaningful trials         ≥8
Completed real tasks                                   ≥5
Major factual misunderstanding caused by AI ARK        0
```

### 18.4 Study documents

Create:

```text
docs/validation/USER_VALIDATION_PROTOCOL.md
docs/validation/PARTICIPANT_SCREENER.md
docs/validation/MODERATOR_SCRIPT.md
docs/validation/OUTCOME_FORM.md
docs/validation/USER_VALUE_METRIC_DEFINITIONS.md
docs/validation/USER_VALIDATION_REPORT_TEMPLATE.md
```

### 18.5 Data protection

Implement:

- restricted participant tables;
- role-based access;
- minimum personal data;
- separation from general analytics;
- export and deletion procedure;
- retention configuration.

### 18.6 Final decision generator

Create a report generator able to produce:

```text
GO
CONDITIONAL GO
REPOSITION
NO-GO
```

The decision must distinguish:

- implemented capability;
- fixture-based technical evidence;
- real technical corpus evidence;
- real user evidence;
- pending measurements.

If real studies are not yet complete, the final program decision must be:

```text
IMPLEMENTATION READY FOR VALIDATION
```

not a fabricated product GO.

## M09 acceptance criteria

- participant and outcome records are access-controlled;
- outcomes bind to PublicationSnapshot;
- telemetry is pseudonymous;
- user-value calculations are reproducible;
- study templates exist;
- no fake participants or fake successful outcomes are created;
- decision report distinguishes pending evidence;
- private-alpha validation can begin safely.

## M09 required verification

```bash
pnpm test:unit --filter validation-outcomes
pnpm test:integration --filter validation-authorization
pnpm test:e2e --filter validation-feedback
pnpm test:e2e --filter participant-privacy
pnpm validation:report
pnpm typecheck
pnpm lint
pnpm build
pnpm verify
```

---

# 19. Database and Migration Requirements

Use forward-only, reviewable migrations.

Required principles:

- opaque primary IDs;
- explicit foreign keys;
- uniqueness constraints for stable identity;
- immutable snapshot rows;
- optimistic-concurrency versions;
- timestamps in UTC;
- schema-version columns where applicable;
- no unconstrained JSON for canonical fields;
- JSON allowed only for versioned bounded extensions;
- indexes for source identity, Resource identity, review queues, publication lookup, and search.

Provide:

```bash
pnpm db:validate
pnpm db:migrate
```

For tests:

- create clean ephemeral database;
- apply all migrations from zero;
- verify rollback strategy through restore or new forward migration;
- test uniqueness and invariant constraints.

Do not alter production data because no production environment is authorized.

---

# 20. Security Requirements

## 20.1 Worker egress

Acquisition worker may access:

- GitHub;
- PostgreSQL;
- object storage;
- observability.

Analysis worker may access:

- approved AI provider;
- PostgreSQL;
- object storage;
- observability.

Analysis worker must not access GitHub directly.

Acquisition worker must not access the AI provider.

Document local enforcement and staging enforcement separately.

## 20.2 Secrets

Secrets must:

- be validated at startup;
- come from environment or secret manager;
- never enter logs;
- never enter Claims or EvidenceItems;
- use least-privilege scopes;
- support rotation.

## 20.3 Content handling

Source excerpts must:

- remain internal during alpha;
- have bounded length;
- bind to content hashes;
- have visibility states;
- support redaction;
- avoid accidental exposure through API errors.

## 20.4 Static prohibited-path check

Add a test or lint step that detects prohibited acquisition behavior, including inappropriate uses of:

```text
child_process
exec
spawn
eval
dynamic import of acquired paths
package-manager invocation
Docker socket
```

Do not prohibit legitimate build tooling globally; target runtime code paths handling acquired content.

## 20.5 Authorization

Server-side authorization is mandatory.

Client-side hiding is not authorization.

## 20.6 Audit

Audit events are append-only from application perspective.

---

# 21. Observability Requirements

Use structured logs and traceable stage events.

Every ingestion flow must be traceable through:

```text
request_id
correlation_id
job_id
source_submission_id
source_snapshot_id
resource_candidate_id
analysis_run_id
editorial_review_id
publication_snapshot_id
```

Provide metrics for:

- API;
- acquisition;
- AI analysis;
- editorial review;
- publication;
- projections;
- validation.

Redact:

- credentials;
- cookies;
- raw participant identities;
- unrestricted source text;
- AI-provider secrets.

Provide local inspection documentation.

---

# 22. Testing Standards

## 22.1 Tests must prove invariants

Avoid tests that merely mirror implementation.

Every security or governance invariant requires a negative test.

## 22.2 No live-service dependency in required gates

Required CI tests use:

- fake GitHub provider;
- fixed source fixtures;
- fake AI provider;
- deterministic model outputs;
- ephemeral PostgreSQL;
- test object storage.

Optional live-provider smoke tests must be separate and disabled by default.

## 22.3 Required test classes

```text
unit
contract
integration
fixture
adversarial
end-to-end
performance
recovery
```

## 22.4 Required recovery scenarios

Test:

- worker restart mid-stage;
- retry after transient provider failure;
- duplicate submission;
- job cancellation;
- projection rebuild;
- partial stage failure;
- optimistic concurrency conflict;
- snapshot supersession;
- provider outage;
- object-storage failure.

## 22.5 Accessibility

Test:

- keyboard navigation;
- focus visibility;
- form errors;
- status not conveyed by color alone;
- evidence panel accessibility;
- category-tab semantics.

---

# 23. Required Documentation by Program Completion

At minimum:

```text
README.md
AGENTS.md
CHANGELOG.md

docs/architecture/ARCHITECTURE.md
docs/architecture/SECURITY_BOUNDARIES.md
docs/architecture/DEPENDENCY_RULES.md

docs/operations/LOCAL_DEVELOPMENT.md
docs/operations/GITHUB_RATE_LIMIT_RUNBOOK.md
docs/operations/AI_PROVIDER_OUTAGE_RUNBOOK.md
docs/operations/STUCK_JOB_RUNBOOK.md
docs/operations/SNAPSHOT_INTEGRITY_RUNBOOK.md
docs/operations/EVIDENCE_MISMATCH_RUNBOOK.md
docs/operations/PUBLICATION_SUPERSESSION_RUNBOOK.md
docs/operations/SECRET_ROTATION_RUNBOOK.md
docs/operations/AUDIT_INVESTIGATION_RUNBOOK.md
docs/operations/BACKUP_RESTORE_RUNBOOK.md
docs/operations/PROMPT_INJECTION_INCIDENT_RUNBOOK.md

docs/validation/TECHNICAL_ALPHA_VALIDATION_PLAN.md
docs/validation/TECHNICAL_VALIDATION_REPORT_TEMPLATE.md
docs/validation/USER_VALIDATION_PROTOCOL.md
docs/validation/PARTICIPANT_SCREENER.md
docs/validation/MODERATOR_SCRIPT.md
docs/validation/OUTCOME_FORM.md
docs/validation/USER_VALUE_METRIC_DEFINITIONS.md
docs/validation/USER_VALIDATION_REPORT_TEMPLATE.md

docs/milestones/M00_SPEC.md
docs/milestones/M01_SPEC.md
docs/milestones/M02_SPEC.md
docs/milestones/M03_SPEC.md
docs/milestones/M04_SPEC.md
docs/milestones/M05_SPEC.md
docs/milestones/M06_SPEC.md
docs/milestones/M07_SPEC.md
docs/milestones/M08_SPEC.md
docs/milestones/M09_SPEC.md
```

Each milestone spec must include:

- purpose;
- scope;
- exclusions;
- domain contracts;
- implementation tasks;
- acceptance criteria;
- verification;
- risks;
- GO / NO-GO result.

---

# 24. Figma Alignment Requirements

The approved Figma prototype is a UX reference for:

- warm Anthropic-inspired visual direction;
- Source Serif 4 or approved serif headings;
- IBM Plex Sans or approved UI font;
- category tabs;
- four-card-per-row desktop directory;
- creator identity on Skill cards;
- concise visible wording;
- progressive-disclosure explanations;
- user and creator profile concepts;
- internal Skill Detail hierarchy.

For the Technical Alpha implement only:

- authenticated application shell;
- Skills directory;
- category tabs;
- Skill cards;
- Skill Detail;
- editorial review;
- submission progress;
- validation feedback.

Do not implement the complete prototype’s:

- public rankings;
- Labs;
- creator launch application;
- community reviews;
- broad workflows;
- public user profiles.

Record any Figma deviation required by alpha scope.

---

# 25. Scope-Control Rules

Reject or defer work involving:

- public ranking engine;
- Quality Score methodology;
- broad creator marketplace;
- public comments and reviews;
- payments;
- Labs marketplace;
- exclusive launch operations;
- public API;
- MCP server;
- Agent catalogue;
- autonomous workflow execution;
- repository execution;
- automated runtime verification;
- Mainland mirroring;
- production deployment.

Add a deferred-scope register.

Do not create placeholder production services for deferred features.

---

# 26. Milestone Reporting Format

At the end of every milestone, write a report with:

## 1. Decision

```text
GO
NO-GO
BLOCKED
```

## 2. Repository state

- branch;
- HEAD;
- upstream;
- starting modifications;
- ending modifications;
- commit status;
- push status.

## 3. Scope completed

- required deliverables;
- important behavior;
- exclusions respected.

## 4. Files

- added;
- modified;
- deleted;
- unexpected files.

## 5. Architecture and invariants

- dependency direction;
- source-safety boundary;
- evidence boundary;
- publication boundary;
- deviations.

## 6. Verification

For every command:

```text
command
result
test count
failure count
relevant output
```

## 7. Acceptance criteria

Provide pass/fail evidence for every criterion.

## 8. Risks and open issues

Distinguish:

- blocking;
- non-blocking;
- deferred;
- external validation pending.

## 9. Next milestone readiness

State whether the next milestone is authorized by the internal gate.

Continue to the next milestone automatically after GO.

---

# 27. Final Whole-Program Verification

After M09 run, at minimum:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:contract
pnpm test:integration
pnpm test:fixtures
pnpm test:adversarial
pnpm test:e2e
pnpm build
pnpm db:validate
pnpm validation:technical
pnpm validation:report
pnpm verify
git status --short
git diff --check
git diff --stat
git diff --name-status
```

Also inspect:

```bash
git diff
find . -type f \
  \( -name '*.pem' -o -name '*.key' -o -name '.env' -o -name '.env.*' \) \
  -print
```

Search for accidental secrets and prohibited behavior.

Example searches:

```bash
rg -n --hidden \
  '(api[_-]?key|secret|token|password|BEGIN PRIVATE KEY)' \
  --glob '!pnpm-lock.yaml' \
  --glob '!fixtures/**'

rg -n \
  '(child_process|exec\(|spawn\(|eval\(|docker\.sock|npm install|pnpm install|pip install)' \
  apps packages
```

Interpret results carefully; fixture text and build scripts may contain expected strings.

---

# 28. Independent Whole-Branch Review

Perform a second review pass independent from implementation reasoning.

Review:

### Product scope

- vertical slice is complete;
- deferred features were not implemented;
- no public production claim exists.

### Source safety

- no checkout-and-run path;
- path normalization;
- limits;
- egress separation;
- prompt-injection handling;
- no dynamic execution.

### Identity

- multi-Skill handling;
- fork and duplicate handling;
- stable Resource identity;
- version binding.

### Evidence

- material fields require evidence;
- valid source snapshot ownership;
- Claim class integrity;
- conflicts;
- no fabricated evidence.

### Editorial

- human authority;
- blockers;
- concurrency;
- immutable decisions;
- approval transaction.

### Publication

- internal only;
- immutable snapshots;
- supersession;
- approved-only projections.

### Validation

- fixture and live evidence distinguished;
- no fabricated technical metrics;
- no fabricated user outcomes;
- GO calculations show denominators.

### Engineering quality

- package boundaries;
- migrations;
- errors;
- types;
- tests;
- documentation;
- observability;
- performance;
- accessibility.

Document all findings and remediate blocking and high-severity defects.

---

# 29. Final Program Decision Rules

Use one of these decisions.

## IMPLEMENTATION GO — READY FOR REAL VALIDATION

Use when:

- M00–M09 implementation acceptance criteria pass;
- fixture-based technical harness passes;
- system is safe for controlled real-repository and invited-user validation;
- real corpus and user metrics may still be pending.

## CONDITIONAL IMPLEMENTATION GO

Use when:

- architecture is sound;
- remaining issues are explicit and bounded;
- controlled validation can begin only after listed remediation.

## NO-GO

Use when:

- repository code can execute;
- prompt injection can cross authority boundaries;
- unsupported claims can be published;
- PublicationSnapshot integrity is not guaranteed;
- identity or version model is fundamentally unsafe;
- required test gates fail;
- the implementation silently broadened into an unreviewable full MVP.

Do not issue product-market GO unless real technical corpus and user studies have actually occurred.

---

# 30. Final Completion Report

Finish with:

# AI ARK Technical Alpha M00–M09 Completion Report

## 1. Executive decision

```text
IMPLEMENTATION GO — READY FOR REAL VALIDATION
CONDITIONAL IMPLEMENTATION GO
NO-GO
```

Explain the basis.

## 2. Repository state

- repository;
- branch;
- base commit;
- HEAD;
- upstream;
- worktree;
- staged state;
- commit state;
- push state;
- deployment state.

## 3. Program completion

For M00–M09 provide:

- status;
- scope;
- key files;
- test evidence;
- residual risk.

## 4. Architecture delivered

Summarize:

- deployable processes;
- domain modules;
- database;
- object storage;
- queue;
- provider adapters;
- trust boundaries;
- publication boundary.

## 5. Security evidence

Report:

- no repository execution;
- source-safety tests;
- prompt-injection tests;
- evidence-forgery tests;
- publication-bypass tests;
- secret scan;
- dependency-boundary tests.

## 6. Verification evidence

List every final command and result.

Include:

- test counts;
- skipped tests;
- expected live tests not run;
- build output;
- migration result;
- validation report path.

## 7. Technical validation status

Distinguish:

- deterministic fixtures completed;
- adversarial fixtures completed;
- live 25-repository corpus pending or completed;
- actual GO-metric values;
- missing measurements.

## 8. User validation status

Distinguish:

- user-validation system ready;
- real participants pending or completed;
- actual outcomes;
- missing measurements.

## 9. Files changed

Provide inventories:

- added;
- modified;
- deleted;
- unrelated files preserved.

## 10. Deferred scope

Confirm non-implementation of prohibited features.

## 11. Risks and remediation

Classify by severity.

## 12. Independent review

Provide:

- reviewer perspective;
- findings;
- remediation completed;
- remaining concerns.

## 13. Recommended next action

Select one:

```text
BEGIN CONTROLLED 25-REPOSITORY VALIDATION
COMPLETE LISTED REMEDIATION
STOP AND REVISE ARCHITECTURE
```

## 14. Git and deployment confirmation

Explicitly confirm:

```text
No commit
No push
No tag
No merge
No release
No deployment
```

unless a later user instruction authorized any of them.

---

# 31. Required Final Behavior

Do not stop at generated scaffolding.

Do not claim completion based only on type-checking.

Do not claim technical validation based only on mocked happy paths.

Do not claim user validation without real users.

Do not hide skipped tests.

Do not weaken acceptance criteria to produce GO.

Do not commit or push.

Implement the complete governed Technical Alpha foundation, verify it thoroughly, and report the actual state with evidence.

---

**End of Codex execution prompt**
