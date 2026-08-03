# AI ARK Resource Intelligence Pipeline Specification v1.0

**Document status:** Canonical ingestion and editorial-processing baseline  
**Version:** 1.0  
**Date:** August 1, 2026  
**Working product name:** AI ARK  
**Product stage:** Product Definition and Validation  
**Decision basis:** `AI ARK Worthiness Review v1.1.md`  
**Strategic foundation:** `AI ARK Product Vision and Positioning v1.0.md`  
**Product requirements:** `AI ARK MVP PRD v1.0.md`  
**UX foundation:** `AI ARK Information Architecture and UX Specification v1.0.md`  
**Data foundation:** `AI ARK Resource and Capability Graph Specification v1.0.md`  
**Primary audience:** Product, backend engineering, data engineering, AI engineering, editorial, trust and safety, security, operations, and future connector teams  

---

## 1. Purpose

This specification defines the AI ARK Resource Intelligence Pipeline.

The pipeline is the system that transforms a source URL or source record into a complete, evidence-backed, human-reviewed AI ARK resource page and machine-readable capability record.

The pipeline must support the following progression:

```text
Source submitted
↓
Source acquired
↓
Identity resolved
↓
Content extracted
↓
Claims generated
↓
Evidence bound
↓
Capabilities classified
↓
Compatibility assessed
↓
Risks identified
↓
Draft assembled
↓
Human review completed
↓
Resource published
↓
Source monitored
↓
Updates detected and re-reviewed
```

The pipeline is a foundational product capability.

It is not merely an administrative import tool.

It powers:

- public resource pages;
- search;
- rankings;
- verification;
- workflows;
- creator profiles;
- regional availability;
- API responses;
- future automated collection;
- FounderOS connector responses;
- AI ARK’s long-term Capability Evidence Graph.

---

## 2. Strategic Objective

The pipeline should reduce the operational cost of publishing high-quality capability records without sacrificing accuracy, source provenance, editorial control, or trust.

The desired operating model is:

> **Automated preparation, governed human publication.**

The system should eventually enable:

```text
30–90 seconds automated analysis
+
1–5 minutes human review
=
Publication-ready capability dossier
```

This is a target, not an assumption.

The validation MVP must measure whether this operating model is achievable.

---

## 3. Scope

### 3.1 MVP scope

The initial pipeline must support:

- GitHub repository URLs;
- Agent Skill repositories;
- repositories containing `SKILL.md`;
- repositories without formal releases;
- repository metadata;
- README and documentation extraction;
- asset discovery;
- dependency and permission inference;
- claim generation;
- evidence binding;
- duplicate and fork detection;
- AI-generated resource drafts;
- human editorial review;
- publication;
- basic source-change detection;
- re-review.

### 3.2 Future source types

The architecture must be extensible to:

- official product websites;
- documentation websites;
- MCP Registry records;
- package registries;
- Product Hunt pages;
- creator submissions;
- official release announcements;
- app directories;
- API documentation;
- news and update sources;
- videos and demonstrations;
- regional mirrors;
- private creator-provided materials.

### 3.3 Explicit exclusions

The MVP pipeline must not:

- execute imported repository code;
- install third-party packages;
- run shell scripts from a source;
- publish automatically;
- award verification automatically;
- mirror proprietary artifacts without authorization;
- expose private source credentials;
- infer legal rights without review;
- claim security certification;
- treat popularity as proof of quality;
- bypass regional access controls;
- replace human editorial responsibility.

---

## 4. Pipeline Principles

### 4.1 Source-grounded

Every material factual statement must be traceable to source evidence or clearly labelled as inference, creator declaration, community report, or editorial judgment.

### 4.2 Idempotent

Reprocessing the same unchanged source should produce the same canonical extraction and should not create duplicate resources or versions.

### 4.3 Version-aware

The pipeline must identify the specific source revision or create an immutable snapshot fingerprint.

### 4.4 Human-governed

No resource becomes public without an explicit authorized publication decision.

### 4.5 Untrusted input

All external content must be treated as untrusted.

### 4.6 No source execution

The pipeline may parse and analyze files but must not execute imported code.

### 4.7 Explainable output

Editors should be able to understand why the system produced each material field.

### 4.8 Failure-safe

A failed analysis must not overwrite a valid published resource.

### 4.9 Incremental

The pipeline should update changed fields without unnecessarily regenerating or invalidating all historical data.

### 4.10 Rebuildable

Derived search indexes, summaries, and draft presentations must be reproducible from canonical source and evidence data.

### 4.11 Commercially neutral

Sponsorship, launch relationships, or paid services must not affect extraction, classification, ranking inputs, or editorial truth.

### 4.12 Region-aware

Accessibility and delivery facts must be modeled separately from global capability claims.

---

## 5. High-Level Architecture

```text
Source Entry
    │
    ▼
Submission Gateway
    │
    ▼
Source Classifier
    │
    ▼
Adapter Router
    │
    ▼
Acquisition Sandbox
    │
    ▼
Source Normalizer
    │
    ▼
Identity Resolver
    │
    ▼
Document and Asset Extractors
    │
    ▼
Fact Extractor
    │
    ▼
Claim and Evidence Builder
    │
    ▼
Capability and Task Classifier
    │
    ▼
Compatibility / Dependency / Permission Analyzer
    │
    ▼
Duplicate and Relationship Analyzer
    │
    ▼
Risk and Rights Analyzer
    │
    ▼
Draft Composer
    │
    ▼
Editorial Review Workspace
    │
    ▼
Publication Authority
    │
    ▼
Canonical Resource Graph
    │
    ├── Search Index
    ├── Public Website
    ├── API
    ├── Ranking
    ├── Verification
    └── Change Monitor
```

---

## 6. Core Components

### 6.1 Submission Gateway

Accepts:

- manually entered URL;
- creator-submitted URL;
- internal candidate record;
- future collector output;
- existing resource update request.

Responsibilities:

- validate URL structure;
- normalize URL;
- reject unsupported schemes;
- prevent obvious SSRF targets;
- assign ingestion job ID;
- record submitting actor;
- detect likely existing source;
- create candidate record.

### 6.2 Source Classifier

Determines:

- source type;
- provider;
- likely resource type;
- access requirements;
- adapter;
- confidence;
- unsupported conditions.

Example output:

```json
{
  "source_type": "GITHUB_REPOSITORY",
  "provider": "github.com",
  "likely_resource_type": "SKILL",
  "adapter": "github_repository_v1",
  "confidence": 0.97
}
```

### 6.3 Adapter Router

Selects the appropriate adapter based on:

- source type;
- host;
- path pattern;
- resource type hint;
- authentication context;
- regional infrastructure.

### 6.4 Acquisition Sandbox

Retrieves external content under controlled conditions.

Required controls:

- outbound allowlist or policy;
- request timeouts;
- response-size limits;
- content-type validation;
- redirect limits;
- anti-SSRF rules;
- malware scanning for downloaded files;
- no execution permission;
- isolated storage;
- request logging;
- rate-limit compliance;
- provider-specific authentication.

### 6.5 Source Normalizer

Converts provider-specific data into a standard internal source bundle.

### 6.6 Identity Resolver

Determines whether the source represents:

- a new Resource;
- a new ResourceVersion;
- an update to an existing Resource;
- a duplicate;
- a fork;
- a mirror;
- an alias;
- an ambiguous candidate requiring review.

### 6.7 Extractors

Extract:

- metadata;
- documents;
- assets;
- installation instructions;
- dependencies;
- permissions;
- compatibility statements;
- license;
- release data;
- creator data;
- capability evidence.

### 6.8 Intelligence Layer

Produces:

- claims;
- summaries;
- use cases;
- best-fit users;
- limitations;
- suggested prompts;
- capabilities;
- tasks;
- categories;
- alternatives;
- risk notes;
- regional questions.

### 6.9 Draft Composer

Assembles all outputs into:

- resource card draft;
- resource detail draft;
- creator candidate;
- ranking input candidate;
- verification eligibility candidate;
- API preview;
- editorial warnings.

### 6.10 Editorial Review Workspace

Allows human review at field, claim, evidence, and page levels.

### 6.11 Publication Authority

Applies publication rules, creates immutable snapshots, updates canonical graph, and triggers derived systems.

### 6.12 Change Monitor

Detects upstream change and creates re-review jobs without silently overwriting published state.

---

## 7. Pipeline State Machine

### 7.1 Ingestion job states

```text
RECEIVED
VALIDATING
CLASSIFYING
QUEUED
ACQUIRING
NORMALIZING
RESOLVING_IDENTITY
EXTRACTING
ANALYZING
COMPOSING_DRAFT
AWAITING_REVIEW
IN_REVIEW
BLOCKED
APPROVED
PUBLISHING
PUBLISHED
REJECTED
FAILED
CANCELLED
SUPERSEDED
```

### 7.2 Update states

```text
MONITORED
CHANGE_DETECTED
CHANGE_CLASSIFIED
RE_REVIEW_REQUIRED
RE_REVIEW_IN_PROGRESS
UPDATE_APPROVED
UPDATE_PUBLISHED
UPDATE_REJECTED
NO_MATERIAL_CHANGE
```

### 7.3 Blocking categories

```text
SOURCE_UNAVAILABLE
AUTHENTICATION_REQUIRED
AMBIGUOUS_IDENTITY
RIGHTS_UNCLEAR
LICENSE_MISSING
DUPLICATE_UNRESOLVED
MALWARE_SIGNAL
SEVERE_RISK
INSUFFICIENT_EVIDENCE
CREATOR_DISPUTE
REGIONAL_RIGHTS_ISSUE
EDITORIAL_CONFLICT
```

### 7.4 Transition rules

- Only authorized editors can move `IN_REVIEW` to `APPROVED`.
- Only Publication Authority can move `APPROVED` to `PUBLISHED`.
- A `FAILED` job may retry without creating a new candidate if inputs are unchanged.
- A `SUPERSEDED` job cannot publish.
- An update job must not modify the current public version before approval.
- Severe security signals move the job to `BLOCKED`, not directly to `REJECTED`, until reviewed.

---

## 8. Ingestion Job Data Contract

```yaml
ingestion_job:
  id: string
  candidate_id: string
  requested_by_type: enum
  requested_by_id: string|null
  input_url: string
  normalized_url: string
  source_hint: string|null
  resource_type_hint: string|null
  adapter_id: string|null
  adapter_version: string|null
  state: enum
  priority: enum
  attempt_count: integer
  correlation_id: string
  parent_job_id: string|null
  source_snapshot_id: string|null
  resolved_resource_id: string|null
  resolved_version_id: string|null
  created_at: datetime
  started_at: datetime|null
  completed_at: datetime|null
  error_code: string|null
  error_summary: string|null
```

### 8.1 Priorities

```text
LOW
NORMAL
HIGH
EDITORIAL_URGENT
SECURITY_URGENT
```

Commercial partnership must not silently grant editorial priority. Any priority relationship should be disclosed internally and should not affect truth or rank.

---

## 9. Adapter Architecture

### 9.1 Adapter interface

Every adapter should implement:

```text
canHandle(source)
validate(source)
acquire(source, context)
normalize(rawBundle)
detectChanges(previousSnapshot, currentSnapshot)
extractProviderIdentity(normalizedBundle)
healthCheck()
```

### 9.2 Adapter metadata

```yaml
adapter:
  id: string
  version: string
  supported_source_types: string[]
  supported_hosts: string[]
  authentication_modes: string[]
  maximum_payload_size: integer
  rate_limit_policy: json
  enabled_regions: string[]
  status: enum
```

### 9.3 Adapter outputs

A standard `SourceBundle`:

```yaml
source_bundle:
  provider: string
  source_type: string
  canonical_url: string
  external_identifier: string|null
  acquired_at: datetime
  provider_metadata: json
  documents: SourceDocumentInput[]
  assets: SourceAssetInput[]
  releases: ReleaseInput[]
  contributors: ContributorInput[]
  rights_hints: RightsHint[]
  content_fingerprint: string
  warnings: PipelineWarning[]
```

### 9.4 Adapter failure policy

An adapter must distinguish:

- permanent unsupported source;
- temporary source failure;
- authorization failure;
- rate limit;
- malformed source;
- removed source;
- oversized content;
- policy-blocked source.

---

## 10. GitHub Repository Adapter

### 10.1 Priority

The GitHub adapter is the first production adapter.

### 10.2 Supported inputs

- repository root URL;
- repository URL with branch;
- repository URL with tag;
- repository URL with commit;
- repository path to `SKILL.md`;
- creator-submitted repository URL.

### 10.3 Acquisition sources

Where authorized and available:

- GitHub API;
- repository metadata endpoints;
- Git tree;
- raw file endpoints;
- release endpoints;
- contributor metadata;
- license endpoint;
- topics;
- repository languages;
- archive status;
- fork metadata.

### 10.4 Required extracted repository facts

- repository owner;
- repository name;
- canonical URL;
- GitHub node ID;
- default branch;
- source revision;
- commit SHA;
- description;
- topics;
- stars;
- forks;
- watchers where meaningful;
- open issues where meaningful;
- creation date;
- last push date;
- archive status;
- fork parent;
- license;
- releases;
- contributors;
- repository languages.

### 10.5 Required file detection

Search for:

```text
SKILL.md
README.md
README.*
LICENSE*
CHANGELOG*
SECURITY.md
package.json
pnpm-lock.yaml
package-lock.json
yarn.lock
pyproject.toml
requirements.txt
Cargo.toml
go.mod
Dockerfile
docker-compose.yml
*.yaml
*.yml
scripts/
references/
assets/
docs/
examples/
```

### 10.6 Agent Skill detection

A repository is a likely Skill when:

- `SKILL.md` exists;
- metadata resembles Agent Skills format;
- repository description identifies a Skill;
- installation command references a Skill registry or agent Skill mechanism;
- source evidence supports capability packaging.

A repository without `SKILL.md` may still be a Skill candidate but requires lower confidence and editorial review.

### 10.7 Repository snapshot

For each analysis:

- record commit SHA;
- create deterministic content fingerprint;
- store file manifest;
- store file hashes for relevant files;
- record adapter version;
- record acquisition timestamp.

### 10.8 GitHub-specific change detection

Material changes include:

- `SKILL.md` change;
- README installation change;
- dependency change;
- license change;
- repository archived;
- ownership transfer;
- new major release;
- permission-relevant script change;
- capability claim change;
- compatibility change;
- deletion of canonical files.

Non-material examples:

- typo correction;
- contributor list change;
- badge update;
- formatting-only README change.

The system may classify uncertain changes as material for human review.

---

## 11. Future Website Adapter

The website adapter should eventually support:

- landing pages;
- official documentation;
- pricing pages;
- release notes;
- compatibility pages;
- creator and company identity;
- screenshots;
- public API documentation.

### 11.1 Website-specific challenges

- dynamic rendering;
- anti-bot protection;
- multiple canonical URLs;
- structured-data inconsistency;
- marketing claims;
- mutable content;
- legal terms;
- region-specific versions.

### 11.2 Website acquisition rules

- obey access policies;
- avoid bypassing authentication;
- preserve timestamp and content fingerprint;
- limit page depth;
- prioritize canonical and official pages;
- mark marketing claims as creator declarations unless independently verified.

---

## 12. Future MCP Registry Adapter

The MCP Registry adapter should retrieve:

- namespace;
- package identity;
- ownership verification;
- transport information;
- package versions;
- source repository;
- installation method;
- runtime requirements;
- official metadata;
- deprecation status.

Registry presence should support identity and distribution facts.

It should not automatically prove:

- quality;
- security;
- effectiveness;
- broad adoption.

---

## 13. Source Normalization

### 13.1 Objective

Convert heterogeneous input into a standard source representation before AI interpretation.

### 13.2 Normalized fields

```yaml
normalized_source:
  canonical_identity:
  provider_identity:
  title:
  description:
  owner:
  organization:
  source_revision:
  release:
  license:
  documents:
  assets:
  dependencies:
  installation_fragments:
  compatibility_fragments:
  capability_fragments:
  permission_fragments:
  regional_fragments:
  popularity_metrics:
  maintenance_metrics:
  rights_hints:
  warnings:
```

### 13.3 Text normalization

- preserve original text;
- normalize line endings;
- preserve source offsets;
- remove non-content UI chrome;
- identify code blocks;
- identify headings;
- identify tables;
- identify links;
- retain language;
- avoid destructive rewriting.

### 13.4 Line and fragment locators

Every extracted fragment should include a locator:

```text
README.md:L120-L145
SKILL.md:section=Compatibility
docs/install.md#configuration
```

Locators enable evidence inspection.

---

## 14. Document Prioritization

The pipeline should prioritize evidence sources.

Suggested precedence:

```text
1. Versioned canonical specification
2. Versioned SKILL.md or package manifest
3. Official documentation
4. Canonical README
5. Release notes
6. Creator declaration
7. Official website marketing page
8. Community report
9. AI inference
```

Precedence is not absolute.

A newer release note may supersede an older specification.

Conflicts should be surfaced rather than silently resolved.

---

## 15. Identity Resolution

### 15.1 Objective

Prevent duplicate pages and preserve canonical resource history.

### 15.2 Resolution signals

- external provider ID;
- canonical URL;
- repository owner/name;
- package name;
- registry namespace;
- Skill metadata name;
- creator identity;
- source fingerprint;
- content similarity;
- prior aliases;
- fork relationship;
- official website.

### 15.3 Resolution outcomes

```text
NEW_RESOURCE
NEW_VERSION
UNCHANGED_EXISTING
DUPLICATE_CANDIDATE
FORK_CANDIDATE
MIRROR_CANDIDATE
ALIAS_CANDIDATE
OWNERSHIP_TRANSFER
AMBIGUOUS
```

### 15.4 Confidence

Identity resolution should output:

```json
{
  "outcome": "NEW_VERSION",
  "resource_id": "res_...",
  "confidence": 0.96,
  "reasons": [
    "Same GitHub node ID",
    "New commit SHA",
    "Content fingerprint changed"
  ]
}
```

### 15.5 Human review threshold

Ambiguous identity should block publication.

Suggested automatic-confidence threshold:

- ≥0.98: automatic internal association allowed;
- 0.80–0.98: editor confirmation required;
- <0.80: treat as new candidate or blocked.

Thresholds must be validated empirically.

---

## 16. Duplicate and Fork Detection

### 16.1 Duplicate signals

- identical external ID;
- identical canonical URL;
- identical content fingerprint;
- identical package identifier;
- near-identical source and creator;
- translated copy without independent behavior;
- mirrored repository.

### 16.2 Fork signals

- GitHub fork metadata;
- shared history;
- modified content;
- independent maintainer;
- independent branding;
- independent releases;
- different installation or compatibility.

### 16.3 Handling

#### Confirmed duplicate

- merge candidate into canonical Resource;
- preserve source record;
- create alias or redirect;
- do not duplicate rankings, reviews, or adoption.

#### Independent fork

- create separate Resource;
- connect with `FORK_OF`;
- display origin and differences;
- calculate ranking independently.

#### Authorized mirror

- remain a delivery record unless materially modified;
- connect to canonical ResourceVersion;
- preserve authorization evidence.

---

## 17. Metadata Extraction

### 17.1 Deterministic extraction

Where possible, metadata should be parsed deterministically rather than inferred.

Examples:

- repository stars;
- license;
- package name;
- version;
- file paths;
- installation command;
- declared compatibility;
- dependencies.

### 17.2 Extracted facts

Potential fact groups:

```text
Identity
Ownership
Version
License
Maintenance
Installation
Dependencies
Permissions
Compatibility
Capabilities
Use cases
Outputs
Limitations
Regional information
Commercial relationships
```

### 17.3 Extraction confidence

Each extraction should record:

- extractor type;
- extractor version;
- source location;
- confidence;
- parse warning.

---

## 18. Asset Extraction

### 18.1 Supported asset candidates

- screenshots;
- example outputs;
- diagrams;
- logos;
- demo videos;
- GIFs;
- documentation images;
- sample files.

### 18.2 Asset selection

The pipeline may recommend:

- primary hero image;
- preview carousel;
- setup screenshot;
- output example.

Human review determines public use.

### 18.3 Rights handling

Every asset must include:

- source;
- rights status;
- attribution;
- fingerprint;
- public-use decision.

### 18.4 Asset safety

- verify content type;
- scan files;
- strip unsafe metadata where appropriate;
- reject executable masquerading as media;
- limit dimensions and size;
- avoid remote hotlink dependence for approved assets where rights permit local storage.

---

## 19. AI Interpretation Layer

### 19.1 Purpose

Use AI to convert source-grounded information into user-centered product content.

### 19.2 AI-generated outputs

- short proposition;
- plain-language summary;
- “Best for” users;
- “Not ideal for” users;
- use cases;
- expected outputs;
- limitations;
- suggested prompts;
- category candidates;
- capability candidates;
- task candidates;
- alternative candidates;
- editorial questions;
- risk questions;
- regional questions.

### 19.3 AI constraints

The AI layer must:

- cite source fragments internally;
- separate facts and inferences;
- avoid invented compatibility;
- avoid invented adoption;
- avoid legal conclusions;
- avoid security guarantees;
- preserve uncertainty;
- produce structured output;
- expose confidence;
- identify missing information.

### 19.4 Structured output

Example:

```json
{
  "field": "best_for",
  "value": [
    "Developers converting long Markdown reports into HTML presentations"
  ],
  "claim_class": "AI_INFERENCE",
  "evidence": [
    {
      "source_document": "README.md",
      "locator": "L42-L88"
    }
  ],
  "confidence": 0.86,
  "review_required": true
}
```

### 19.5 Model and prompt versioning

Every AI result must record:

- model identifier;
- model version where available;
- prompt template version;
- schema version;
- generation timestamp;
- source bundle fingerprint;
- temperature or generation mode where relevant.

### 19.6 Regeneration policy

A field may be regenerated when:

- source changes;
- prompt version changes;
- model changes;
- editor requests;
- taxonomy changes.

Published editorial text must not be silently replaced by regeneration.

---

## 20. Claim Generation

### 20.1 Claim extraction classes

The pipeline should generate:

- source facts;
- creator declarations;
- AI inferences;
- system derivations;
- unresolved questions.

### 20.2 Claim granularity

Avoid one large claim such as:

> This is an excellent presentation Skill that works everywhere.

Prefer atomic claims:

- Generates HTML presentations.
- Declares Claude Code support.
- Installation uses command X.
- Requires Node.js.
- Codex compatibility is inferred.
- Runtime in Mainland China is unknown.

### 20.3 Claim validation

A claim is publishable when:

- evidence exists;
- source class is identified;
- confidence is acceptable;
- conflicts are resolved or disclosed;
- reviewer approves.

### 20.4 Contradictory claims

The system should preserve conflicts.

Example:

```text
README says Windows supported.
Issue tracker reports repeated Windows failures.
```

Public presentation may say:

> Windows support is declared by the creator, but current community reports indicate setup issues.

---

## 21. Evidence Binding

### 21.1 Evidence bundle

Each resource draft should contain an evidence bundle.

```yaml
evidence_bundle:
  id: string
  source_snapshot_id: string
  claim_ids: string[]
  evidence_item_ids: string[]
  generated_at: datetime
  completeness_score: decimal
  unresolved_conflicts: string[]
  blocking_gaps: string[]
```

### 21.2 Evidence completeness

Suggested categories:

```text
COMPLETE
SUBSTANTIAL
PARTIAL
WEAK
INSUFFICIENT
```

### 21.3 Required evidence for publication

At minimum:

- identity;
- source;
- creator or publisher where known;
- installation or access path;
- primary capability;
- version or snapshot;
- license status;
- key compatibility statement or unknown;
- limitation;
- regional status or unknown.

### 21.4 Evidence coverage metric

```text
Material factual fields with valid evidence
÷
Total material factual fields
```

Target:

```text
100%
```

AI-generated recommendations may be evidence-supported interpretations rather than source facts, but their class must be visible internally.

---

## 22. Capability and Task Classification

### 22.1 Classification steps

1. extract source phrases;
2. map to existing Capability taxonomy;
3. map to Task taxonomy;
4. propose new taxonomy term if no fit;
5. assign confidence;
6. identify primary and secondary terms;
7. require editorial approval for new canonical terms.

### 22.2 Primary category

The pipeline proposes one primary category and optional secondary categories.

### 22.3 Over-classification control

Do not tag every conceivable use.

A Resource should not receive a category solely because the source uses a broad keyword.

### 22.4 Taxonomy gap handling

Unknown concept:

```text
TAXONOMY_CANDIDATE
```

It enters a governance queue rather than automatically creating a public category.

---

## 23. Compatibility Analysis

### 23.1 Evidence hierarchy

Compatibility may be:

- tested by AI ARK;
- declared by creator;
- explicit in source;
- community reported;
- inferred from format;
- unknown;
- unsupported.

### 23.2 Analysis inputs

- `SKILL.md` format;
- installation commands;
- runtime mentions;
- file structure;
- dependency constraints;
- creator declarations;
- AI ARK tests;
- community evidence.

### 23.3 Output

```yaml
compatibility_candidate:
  runtime_id:
  status:
  version_constraint:
  evidence_claim_id:
  confidence:
  limitation:
  review_required:
```

### 23.4 Important rule

Format compatibility does not equal functional compatibility.

Example:

A Skill may use a portable Agent Skills structure, but actual scripts or assumptions may only work in one runtime.

---

## 24. Dependency Analysis

### 24.1 Deterministic sources

- package manifests;
- lockfiles;
- install instructions;
- Dockerfiles;
- scripts;
- configuration examples.

### 24.2 Dependency categories

- package;
- runtime;
- API;
- model;
- database;
- service;
- account;
- credential;
- operating system;
- hardware.

### 24.3 Direct and transitive distinction

MVP should reliably capture direct dependencies.

Transitive dependency analysis may be limited unless package metadata is available.

### 24.4 Missing dependency warning

If installation instructions reference an unrecorded requirement, create:

```text
DEPENDENCY_INCOMPLETE
```

---

## 25. Permission Analysis

### 25.1 Static indicators

The pipeline may inspect:

- shell commands;
- file operations;
- network calls;
- environment variables;
- API tokens;
- browser automation;
- write operations;
- Git operations.

### 25.2 Permission claim types

- explicitly declared;
- statically inferred;
- test observed;
- community reported;
- unknown.

### 25.3 Public language

Translate technical permission into user-centered wording.

Example:

> Reads and writes files inside the selected project directory.

### 25.4 Safety rule

Static inference is not a complete security audit.

The public page should not say “safe” based on static analysis alone.

---

## 26. Rights and License Analysis

### 26.1 Extract

- detected license;
- license file;
- SPDX identifier where possible;
- asset rights;
- redistribution rights;
- modification rights;
- translation rights;
- mirror rights;
- creator authorization.

### 26.2 Rights outcomes

```text
CONFIRMED
PARTIAL
RESTRICTED
UNCLEAR
CONFLICTING
```

### 26.3 Publication behavior

Rights uncertainty may allow:

- metadata page;
- source link;
- editorial summary.

Rights uncertainty may block:

- local artifact hosting;
- screenshots;
- full documentation reproduction;
- regional mirroring.

### 26.4 Legal review

The pipeline may flag.

It must not replace professional legal review for high-risk cases.

---

## 27. Risk Analysis

### 27.1 Risk categories

- malicious content indicator;
- credential exposure;
- unsafe shell usage;
- destructive command;
- arbitrary network access;
- untrusted download;
- obfuscated script;
- suspicious dependency;
- license conflict;
- abandoned project;
- ownership uncertainty;
- regional delivery issue;
- privacy concern;
- unsupported security claim.

### 27.2 Severity

```text
INFO
LOW
MODERATE
HIGH
CRITICAL
```

### 27.3 Risk outputs

```yaml
risk_finding:
  id:
  resource_version_id:
  category:
  severity:
  summary:
  evidence:
  confidence:
  blocking:
  status:
  reviewer:
```

### 27.4 Publication policy

Critical unresolved risk:

- blocks publication or produces hidden/quarantined state.

High risk:

- requires explicit trust-and-safety review.

Moderate risk:

- may publish with warning if reviewed.

### 27.5 No execution guarantee

The pipeline must not execute source code as part of automated risk analysis.

---

## 28. Regional Availability Analysis

### 28.1 Initial automated inputs

- source accessibility;
- package registry accessibility;
- domain reachability;
- dependency domains;
- creator-provided regional support;
- authorized mirror data;
- community reports.

### 28.2 Human-reviewed outputs

- Information Accessible;
- Artifact Accessible;
- Installation Accessible;
- Runtime Verified.

### 28.3 Automation limits

Automated network checks cannot prove:

- lawful accessibility;
- user-level installation success;
- runtime behavior;
- compliance.

### 28.4 Required timestamp

Every regional status must include:

- check date;
- check method;
- evidence;
- expiry.

---

## 29. Suggested Prompt Generation

### 29.1 Prompt classes

- Quick start;
- Common use;
- Advanced;
- Constraint-aware.

### 29.2 Requirements

A suggested prompt should include:

- user objective;
- required input;
- expected output;
- relevant constraints;
- supported runtime if known.

### 29.3 Safety

Suggested prompts must not:

- request secrets;
- instruct destructive activity;
- assume unsupported capability;
- conceal external calls;
- claim guaranteed outcomes.

### 29.4 Editorial review

All public suggested prompts require human review in MVP.

---

## 30. Alternative Resource Generation

### 30.1 Inputs

- shared capabilities;
- shared tasks;
- category;
- compatibility;
- regional availability;
- setup difficulty;
- verification;
- maintenance;
- license.

### 30.2 Alternative classes

```text
SIMILAR
EASIER_SETUP
BROADER_COMPATIBILITY
REGIONAL_ALTERNATIVE
MORE_PROVEN
OPEN_SOURCE_ALTERNATIVE
SPECIALIZED_ALTERNATIVE
```

### 30.3 Publication rule

Each alternative requires an explanation.

Avoid generic “You may also like” recommendations.

---

## 31. Draft Composition

### 31.1 Draft outputs

The system should compose:

- public resource card;
- hero section;
- summary;
- “Best for”;
- “Not ideal for”;
- use cases;
- suggested prompts;
- installation;
- compatibility;
- dependencies;
- permissions;
- regional availability;
- ranking candidate inputs;
- verification eligibility;
- community placeholders;
- source and evidence section;
- alternative resources;
- API preview.

### 31.2 Draft state

A draft is not canonical truth.

It contains:

- proposed fields;
- evidence links;
- confidence;
- warnings;
- review states.

### 31.3 Field review statuses

```text
UNREVIEWED
ACCEPTED
EDITED
REJECTED
NEEDS_EVIDENCE
NEEDS_CREATOR_INPUT
HIDDEN
```

### 31.4 Draft completeness

```text
READY_FOR_REVIEW
PARTIAL
BLOCKED
INSUFFICIENT
```

---

## 32. Editorial Review Workflow

### 32.1 Review sequence

Recommended:

```text
1. Confirm identity
2. Confirm source and rights
3. Confirm version
4. Review primary proposition
5. Review capabilities and tasks
6. Review installation
7. Review compatibility
8. Review dependencies and permissions
9. Review limitations and risks
10. Review regional availability
11. Review assets
12. Review suggested prompts
13. Review evidence completeness
14. Preview public page
15. Approve or reject
```

### 32.2 Reviewer actions

- accept;
- edit;
- reject;
- reclassify;
- request evidence;
- request creator clarification;
- mark inference;
- add editorial judgment;
- block;
- escalate.

### 32.3 Review notes

Every material manual edit should support an optional rationale.

Required rationale for:

- ranking-relevant changes;
- compatibility override;
- rights override;
- risk downgrade;
- duplicate resolution;
- publication despite incomplete evidence.

### 32.4 Review assignment

Jobs may be assigned by:

- category expertise;
- language;
- region;
- technical runtime;
- risk level;
- creator conflict.

### 32.5 Conflict of interest

Reviewers must disclose material creator, sponsor, contributor, or financial relationships.

---

## 33. Creator Review and Correction

### 33.1 Pre-publication creator contact

Optional for MVP.

Required when:

- ownership is ambiguous;
- rights are unclear;
- installation instructions conflict;
- exclusive or official-page status is claimed;
- proprietary asset use is proposed.

### 33.2 Post-publication correction

Creators may submit:

- factual correction;
- new version;
- updated installation;
- new screenshot;
- regional edition;
- support clarification;
- verification request.

### 33.3 Editorial independence

Creator correction is evidence.

It is not automatic editorial approval.

---

## 34. Publication Authority

### 34.1 Preconditions

A resource may publish when:

- identity resolved;
- version fixed;
- canonical source identified;
- required evidence complete;
- rights acceptable for intended presentation;
- no blocking risk;
- editor approves;
- publication checklist passes.

### 34.2 Publication transaction

Publication should atomically:

1. create or update canonical Resource;
2. create immutable ResourceVersion;
3. persist Claims and Evidence links;
4. persist editorial snapshot;
5. persist lifecycle event;
6. persist audit event;
7. update current version pointer;
8. enqueue search reindex;
9. enqueue ranking calculation;
10. enqueue API cache refresh;
11. enqueue change monitoring.

### 34.3 Atomicity

Partial public publication is not allowed.

If a downstream index fails, canonical publication may succeed but public systems should display the last known consistent state until rebuild.

### 34.4 Publication snapshot

Record:

- source snapshot;
- draft snapshot;
- reviewer;
- publication time;
- schema version;
- prompt versions;
- adapter version;
- evidence completeness;
- unresolved non-blocking warnings.

---

## 35. Search Indexing

### 35.1 Trigger

After canonical publication.

### 35.2 Indexed data

- title;
- aliases;
- summary;
- capabilities;
- tasks;
- categories;
- creator;
- compatibility;
- verification;
- regional availability;
- ranking;
- freshness.

### 35.3 Index safety

Do not index:

- private evidence;
- unpublished claims;
- moderation notes;
- restricted creator information;
- hidden resources.

### 35.4 Rebuild

Search index must be fully rebuildable from canonical graph.

---

## 36. Ranking Input Generation

The pipeline may produce candidate ranking inputs:

- maintenance;
- documentation completeness;
- compatibility breadth;
- source popularity;
- evidence coverage;
- creator responsiveness baseline;
- risk status.

The pipeline does not publish ranking itself.

Ranking computation remains a separate governed system using a versioned methodology.

---

## 37. Verification Eligibility Generation

The pipeline may determine:

- Source Verified eligibility;
- Functional Testing readiness;
- missing evidence;
- blocking risks;
- test scenario candidates.

It must not award verification automatically.

---

## 38. Update Detection

### 38.1 Monitoring schedule

Frequency may depend on:

- popularity;
- verification;
- active Labs campaign;
- source volatility;
- creator relationship;
- workflow dependency;
- regional mirror status.

Example:

```text
High-priority verified resource: daily
Active resource: weekly
Low-activity resource: monthly
Archived resource: quarterly or on demand
```

### 38.2 Detection inputs

- source revision;
- content fingerprint;
- release;
- repository status;
- license;
- owner;
- installation files;
- dependencies;
- `SKILL.md`;
- README;
- assets;
- official website status.

### 38.3 Change classes

```text
NO_CHANGE
NON_MATERIAL
CONTENT_UPDATE
INSTALLATION_CHANGE
COMPATIBILITY_CHANGE
DEPENDENCY_CHANGE
PERMISSION_CHANGE
LICENSE_CHANGE
OWNERSHIP_CHANGE
SECURITY_RELEVANT
MAJOR_RELEASE
SOURCE_REMOVED
ARCHIVED
UNKNOWN_MATERIALITY
```

### 38.4 Materiality rules

A material change should trigger re-review.

A non-material change may update source metadata without changing editorial content.

### 38.5 Update diff

The editor should receive:

- changed files;
- changed claims;
- changed dependencies;
- changed compatibility;
- changed assets;
- affected workflows;
- affected verification;
- affected regional status.

---

## 39. Re-Review Workflow

### 39.1 Re-review outcomes

```text
NO_PUBLIC_CHANGE
METADATA_UPDATE
EDITORIAL_UPDATE
NEW_RESOURCE_VERSION
VERIFICATION_REVIEW_REQUIRED
RANKING_RECALCULATION_REQUIRED
WORKFLOW_REVIEW_REQUIRED
ARCHIVE_RESOURCE
HIDE_RESOURCE
```

### 39.2 Current public state

The current approved version remains public until:

- updated version approved;
- resource archived;
- severe risk requires immediate hide;
- legal removal required.

### 39.3 Severe change

A severe security or legal change may:

- hide install actions;
- show urgent warning;
- suspend ranking eligibility;
- revoke active verification;
- trigger workflow replacement.

---

## 40. Archival and Removal

### 40.1 Archive conditions

- source archived;
- project abandoned;
- replacement exists;
- creator ends support;
- incompatible with current runtimes;
- repeated installation failure;
- rights limitations.

### 40.2 Archive behavior

- public page remains;
- archive label visible;
- install action may be disabled;
- alternatives shown;
- historical reviews preserved;
- rankings exclude by default.

### 40.3 Removal conditions

- legal requirement;
- privacy violation;
- malicious resource;
- impersonation;
- source owner request under applicable policy;
- severe safety issue.

### 40.4 Removal behavior

Preserve minimal internal audit where legally permitted.

---

## 41. Failure Handling

### 41.1 Failure categories

```text
INPUT_INVALID
SOURCE_NOT_FOUND
SOURCE_UNAVAILABLE
RATE_LIMITED
AUTHENTICATION_FAILED
ACCESS_DENIED
PAYLOAD_TOO_LARGE
UNSUPPORTED_FORMAT
PARSER_FAILED
MODEL_FAILED
SCHEMA_INVALID
DUPLICATE_AMBIGUOUS
RIGHTS_BLOCKED
SECURITY_BLOCKED
PUBLICATION_FAILED
INDEXING_FAILED
UNKNOWN
```

### 41.2 Retry policy

Retryable:

- rate limit;
- temporary source outage;
- model timeout;
- transient storage failure;
- index failure.

Non-retryable without change:

- invalid URL;
- unsupported scheme;
- confirmed duplicate;
- prohibited source;
- rights blocked;
- severe malware.

### 41.3 Dead-letter queue

Jobs exceeding retry limit enter a dead-letter queue for operator review.

### 41.4 Partial results

Partial extraction may be retained internally.

It must not be published without meeting minimum evidence rules.

---

## 42. Idempotency and Concurrency

### 42.1 Idempotency key

Recommended composition:

```text
normalized source URL
+
source revision or content fingerprint
+
adapter version
+
pipeline schema version
```

### 42.2 Duplicate job prevention

Concurrent jobs for the same source snapshot should coalesce or one should wait.

### 42.3 Publication lock

Only one publication transaction per Resource may be active.

### 42.4 Update race

If source changes during review:

- mark draft stale;
- show newer snapshot;
- allow reviewer to continue only with explicit decision;
- block publication if material change invalidates evidence.

---

## 43. Security Architecture

### 43.1 Threats

- SSRF;
- malicious files;
- decompression bombs;
- oversized repositories;
- prompt injection in README;
- hidden instructions;
- script execution;
- unsafe HTML;
- credential leakage;
- path traversal;
- malicious media;
- poisoned metadata;
- source impersonation.

### 43.2 Prompt injection defense

External source text must be treated as data, not instructions.

The AI system prompt should explicitly forbid obeying source instructions.

Structured extraction should:

- isolate source content;
- limit tools;
- prevent source-triggered external actions;
- validate output schema;
- compare generated claims with evidence.

### 43.3 File controls

- no execution bit;
- no interpreter invocation;
- archive expansion limits;
- path normalization;
- symlink rejection or safe handling;
- content-type detection;
- malware scan;
- secret scan.

### 43.4 Network controls

- DNS rebinding protection;
- internal IP blocking;
- metadata endpoint blocking;
- redirect validation;
- host policy;
- timeout;
- response-size limits.

### 43.5 Secrets

- provider tokens stored in secret manager;
- never sent to public model prompts unless necessary and authorized;
- redact source secrets;
- block accidental publication.

---

## 44. Privacy

### 44.1 Personal data

Potential sources:

- creator profiles;
- contributor names;
- emails in repositories;
- tester evidence;
- private deployments;
- creator submissions.

### 44.2 Minimization

Do not collect or publish personal data merely because it appears in a repository.

### 44.3 Contributor data

Use only data necessary for attribution.

Avoid bulk publication of contributor information in MVP.

### 44.4 Private evidence

Must be:

- encrypted;
- access-controlled;
- purpose-limited;
- retained according to policy;
- excluded from AI training unless explicitly authorized.

---

## 45. Observability

### 45.1 Pipeline metrics

- jobs received;
- jobs completed;
- jobs failed;
- stage duration;
- retries;
- source acquisition latency;
- document count;
- evidence coverage;
- duplicate rate;
- review time;
- publish rate;
- correction rate;
- update detection latency.

### 45.2 Quality metrics

- unsupported claim rate;
- editor rejection rate by field;
- post-publication correction rate;
- compatibility error rate;
- taxonomy correction rate;
- duplicate precision;
- regional-status accuracy.

### 45.3 Cost metrics

- acquisition cost;
- model cost;
- storage cost;
- human review minutes;
- cost per published resource;
- cost per update.

### 45.4 Logs

Every job should include:

- job ID;
- candidate ID;
- Resource ID if resolved;
- correlation ID;
- stage;
- adapter;
- source;
- error code;
- timing;
- actor.

### 45.5 Tracing

Distributed trace should connect:

```text
submission
→ acquisition
→ extraction
→ AI generation
→ review
→ publication
→ indexing
```

---

## 46. Service-Level Targets

Validation MVP targets:

### 46.1 URL to draft

Median:

```text
≤2 minutes
```

### 46.2 Editorial review

Median:

```text
≤5 minutes
```

for high-quality GitHub Skill sources with sufficient documentation.

### 46.3 Evidence coverage

Material factual fields:

```text
100%
```

### 46.4 Source acquisition success

Supported public GitHub repositories:

```text
≥95%
```

excluding provider outages, removed sources, and policy blocks.

### 46.5 Duplicate precision

Test corpus:

```text
≥95%
```

### 46.6 Material factual correction

Post-publication:

```text
<5%
```

---

## 47. Editorial Quality Gates

### Gate 1 — Identity

- canonical source confirmed;
- duplicate/fork status resolved;
- creator attribution acceptable.

### Gate 2 — Version

- version or snapshot fixed;
- source fingerprint stored.

### Gate 3 — Evidence

- material facts supported;
- conflicts disclosed;
- unsupported claims removed or qualified.

### Gate 4 — Rights

- license and asset rights reviewed;
- no unauthorized mirror or reproduction.

### Gate 5 — Safety

- no unresolved blocking risk;
- no source code executed;
- permissions explained.

### Gate 6 — User value

- what it does is clear;
- best fit is clear;
- limitations are clear;
- next action is available.

### Gate 7 — Regional status

- region state recorded or marked unknown;
- no false accessibility claim.

### Gate 8 — Publication integrity

- reviewer identified;
- audit snapshot complete;
- no stale-source block.

---

## 48. Pipeline APIs

### 48.1 Submit source

```text
POST /internal/v1/ingestion/jobs
```

Request:

```json
{
  "source_url": "https://github.com/example/project",
  "resource_type_hint": "SKILL",
  "priority": "NORMAL"
}
```

### 48.2 Job status

```text
GET /internal/v1/ingestion/jobs/{jobId}
```

### 48.3 Draft retrieval

```text
GET /internal/v1/ingestion/jobs/{jobId}/draft
```

### 48.4 Evidence

```text
GET /internal/v1/ingestion/jobs/{jobId}/evidence
```

### 48.5 Review decision

```text
POST /internal/v1/reviews/{reviewId}/decision
```

### 48.6 Publish

```text
POST /internal/v1/resources/{resourceId}/publish
```

Publication endpoint must require:

- authorized role;
- review ID;
- expected snapshot fingerprint;
- idempotency key.

### 48.7 Update check

```text
POST /internal/v1/resources/{resourceId}/check-updates
```

---

## 49. Event Model

Suggested internal events:

```text
ingestion.job.received
ingestion.source.classified
ingestion.source.acquired
ingestion.identity.resolved
ingestion.extraction.completed
ingestion.analysis.completed
ingestion.draft.ready
ingestion.blocked
review.started
review.field.changed
review.approved
review.rejected
resource.published
resource.update.detected
resource.re_review.required
resource.archived
verification.review.required
ranking.recalculation.required
workflow.dependency.changed
search.reindex.requested
```

Events should include:

- event ID;
- subject ID;
- correlation ID;
- occurred time;
- schema version;
- actor;
- payload fingerprint.

---

## 50. Testing Strategy

### 50.1 Unit tests

- URL normalization;
- adapter routing;
- parser behavior;
- fingerprinting;
- identity matching;
- claim schema;
- evidence links;
- state transitions;
- publication validation.

### 50.2 Contract tests

- GitHub adapter;
- AI model structured output;
- storage;
- search indexing;
- API payloads;
- event schemas.

### 50.3 Fixture tests

Use repository fixtures representing:

- valid Skill;
- missing `SKILL.md`;
- multiple Skills;
- archived repo;
- fork;
- duplicate;
- no license;
- malicious prompt injection;
- oversized asset;
- conflicting compatibility;
- regional dependency;
- no formal release;
- renamed repository.

### 50.4 End-to-end tests

```text
submit URL
→ analyze
→ review
→ publish
→ search
→ public API
```

### 50.5 Security tests

- SSRF;
- path traversal;
- symlink;
- archive bomb;
- malicious HTML;
- script execution attempts;
- source prompt injection;
- secret leakage.

### 50.6 Evaluation set

Maintain a human-labelled corpus for:

- resource type;
- capability;
- task;
- compatibility;
- duplicate identity;
- risk;
- regional availability.

---

## 51. Operational Runbooks

Required before public MVP:

- GitHub API outage;
- ingestion backlog;
- AI model failure;
- suspected malicious source;
- false duplicate merge;
- publication rollback;
- source ownership dispute;
- accidental secret ingestion;
- source removal;
- verification-invalidating update;
- regional mirror mismatch;
- search index drift.

---

## 52. Implementation Phasing

### Phase 1 — Deterministic GitHub acquisition

- URL validation;
- GitHub adapter;
- source snapshot;
- file extraction;
- metadata;
- fingerprint.

### Phase 2 — Identity and evidence

- Resource matching;
- version resolution;
- claim model;
- evidence locators;
- duplicate detection.

### Phase 3 — AI interpretation

- summaries;
- use cases;
- capabilities;
- tasks;
- prompts;
- limitations;
- structured output.

### Phase 4 — Editorial console

- field review;
- source comparison;
- warnings;
- approval;
- publication snapshot.

### Phase 5 — Publication and indexing

- canonical graph;
- public pages;
- API;
- search;
- ranking inputs.

### Phase 6 — Monitoring

- scheduled source checks;
- diff;
- materiality;
- re-review.

### Phase 7 — Additional adapters

- official website;
- MCP Registry;
- package registry;
- creator submission.

---

## 53. Acceptance Criteria

The Resource Intelligence Pipeline is acceptable for MVP when:

### Source handling

- public GitHub repository URLs can be submitted;
- unsupported and unsafe URLs are rejected;
- source acquisition is isolated;
- no imported code is executed;
- source revision and fingerprint are stored.

### Identity

- new Resource, new version, unchanged source, duplicate, and fork cases are distinguishable;
- ambiguous identity blocks publication;
- repeat ingestion is idempotent.

### Extraction

- README and `SKILL.md` are extracted;
- license, installation, dependencies, assets, and explicit compatibility are detected where present;
- extracted facts retain locators.

### Intelligence

- AI outputs validate against schema;
- factual and inferred claims are separate;
- suggested prompts are source-consistent;
- missing evidence is surfaced.

### Evidence

- material facts link to EvidenceItems;
- evidence completeness is calculated;
- private evidence is protected;
- conflicts remain visible.

### Editorial review

- editors can inspect source and draft;
- field-level status exists;
- blocking warnings prevent publication;
- every publication has an authorized reviewer.

### Publication

- publication is atomic;
- immutable publication snapshot is created;
- public page, search, and API derive from canonical graph;
- no draft or private data leaks.

### Updates

- source changes can be detected;
- material changes create re-review jobs;
- current approved public state remains until replacement approval;
- severe changes can suspend actions or verification.

### Operations

- metrics and logs exist;
- retries are bounded;
- dead-letter handling exists;
- runbooks exist;
- audit events are complete.

---

## 54. Validation Metrics

During concierge and MVP validation, measure:

| Metric | Target |
|---|---:|
| Median URL-to-draft | ≤2 minutes |
| Median human review | ≤5 minutes |
| Supported GitHub acquisition success | ≥95% |
| Material factual correction rate | <5% |
| Factual evidence coverage | 100% |
| Duplicate precision | ≥95% |
| Automatic field acceptance rate | Track baseline |
| Jobs requiring creator clarification | Track baseline |
| Jobs blocked by rights | Track baseline |
| Jobs blocked by risk | Track baseline |
| Cost per published resource | Establish baseline |
| Update re-review time | Establish baseline |

---

## 55. Open Questions

1. Should a repository containing multiple independent Skills create one Resource or multiple child Resources?
2. What exact Git tree depth and file-size limits should the MVP use?
3. Which LLM provider and model should be the default extractor?
4. Should different fields use different models?
5. What confidence threshold should trigger editor review versus automatic provisional acceptance?
6. How should popularity metrics be snapshotted historically?
7. How should issue trackers contribute to limitations without creating noise?
8. What source material may be stored locally versus referenced only?
9. How should creator-provided private repositories be supported later?
10. Which static-analysis tools should be included in the MVP?
11. Should source comments and issues be indexed as community evidence?
12. How should a repository with no license be presented?
13. How should source-language translation occur during ingestion?
14. Which regional network checks are reliable enough to automate?
15. How should the pipeline select preview images?
16. How should manual editorial text be preserved across source regeneration?
17. What diff threshold defines a material README change?
18. When should a changed repository create a new ResourceVersion?
19. How should source ownership transfer affect creator attribution?
20. Should an AI-generated alternative recommendation require human approval individually?

---

## 56. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Ranking and Verification Standard v1.0.md`

It should define:

- ranking principles;
- category eligibility;
- score dimensions;
- weights;
- normalization;
- popularity handling;
- freshness;
- review weighting;
- confidence;
- risk gates;
- lifecycle separation;
- rank snapshots;
- appeals;
- commercial independence;
- verification levels;
- test requirements;
- evidence requirements;
- expiry;
- re-review;
- revocation;
- public methodology;
- audit and governance.

---

## 57. Final Pipeline Direction

# AI ARK should treat ingestion as the creation of governed intelligence, not generated content.

The pipeline must preserve:

- where information came from;
- which version it describes;
- what is factual;
- what is inferred;
- what remains unknown;
- which risks exist;
- which editor approved it;
- what changed later.

The system succeeds when a single source URL can become:

- a trustworthy public capability dossier;
- a machine-readable API record;
- a ranking candidate;
- a verification candidate;
- a workflow component;
- a monitored living resource;

without sacrificing evidence, human judgment, or operational control.

---

**End of document**
