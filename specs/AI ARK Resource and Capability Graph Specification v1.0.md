# AI ARK Resource and Capability Graph Specification v1.0

**Document status:** Canonical product-data model baseline  
**Version:** 1.0  
**Date:** August 1, 2026  
**Working product name:** AI ARK  
**Product stage:** Product Definition and Validation  
**Decision basis:** `AI ARK Worthiness Review v1.1.md`  
**Strategic foundation:** `AI ARK Product Vision and Positioning v1.0.md`  
**Product requirements:** `AI ARK MVP PRD v1.0.md`  
**UX foundation:** `AI ARK Information Architecture and UX Specification v1.0.md`  
**Primary audience:** Product, backend engineering, data engineering, frontend engineering, search, trust and safety, editorial, verification, API, and future enterprise teams  

---

## 1. Purpose

This specification defines the canonical resource model and graph structure for AI ARK.

It establishes:

- the root `Resource` abstraction;
- resource types;
- canonical identity;
- creators and organizations;
- versions;
- sources;
- claims and provenance;
- evidence;
- capabilities and tasks;
- categories and tags;
- compatibility;
- dependencies and permissions;
- regions and availability;
- reviews, comments, tests, and deployments;
- ranking snapshots;
- verification records;
- workflows and collections;
- lifecycle and moderation states;
- duplicate, fork, and replacement handling;
- API-facing representations;
- graph invariants;
- validation rules;
- privacy and audit requirements.

The data model must support the MVP launch with Skills while allowing future expansion to MCP servers, Agents, Plugins, Workflows, and other AI capabilities without requiring a destructive architectural rewrite.

---

## 2. Design Goals

The model must satisfy ten goals.

### 2.1 Resource-type neutrality

The root object must represent multiple capability types without making `Skill` the permanent center of the system.

### 2.2 Evidence-first structure

Material claims must be traceable to evidence, source, reviewer, version, and date.

### 2.3 Version awareness

Compatibility, testing, verification, reviews, dependencies, permissions, and ranking must be able to bind to a specific resource version.

### 2.4 Historical integrity

Published records, ranking snapshots, verification decisions, and review evidence must remain historically inspectable.

### 2.5 Human and machine consistency

The public website and API must derive from the same governed canonical data.

### 2.6 Graph-native relationships

The system must represent relationships such as:

- Resource solves Task;
- Resource requires Dependency;
- Resource supports Runtime;
- Resource replaces Resource;
- Workflow uses Resource;
- Creator owns Resource;
- Evidence supports Claim.

### 2.7 Regional truth

Availability must support multiple levels, regions, dates, and evidence rather than a binary field.

### 2.8 Editorial governance

AI-generated interpretations, creator declarations, source facts, community reports, and editorial decisions must remain distinguishable.

### 2.9 Extensibility

The model should allow future:

- enterprise private resources;
- additional verification levels;
- automatic compatibility testing;
- execution manifests;
- pricing data;
- policy overlays;
- partner feeds;
- public MCP access.

### 2.10 Operational practicality

The MVP should be implementable in a relational database with graph-like relationship tables. A dedicated graph database is not required initially.

---

## 3. Non-Goals

This specification does not define:

- a transactional marketplace ledger;
- payments or commissions;
- automatic code execution;
- billing;
- enterprise tenant isolation in full detail;
- a complete malware-analysis schema;
- model-hosting infrastructure;
- source-control hosting;
- social-network follower graphs;
- a universal software package format;
- permanent trust guarantees.

These may be introduced later through separate specifications.

---

## 4. Canonical Model Overview

The canonical graph centers on `Resource`.

```text
Resource
├── ResourceVersion
├── ResourceSource
├── ResourceClaim
├── ResourceAsset
├── ResourceCapability
├── ResourceTask
├── ResourceCategory
├── ResourceCompatibility
├── ResourceDependency
├── ResourcePermission
├── RegionalAvailability
├── RankingSnapshot
├── VerificationRecord
├── CommunityReview
├── CommentThread
├── TestRun
├── DeploymentEvidence
├── WorkflowStep
├── CollectionMembership
└── LifecycleEvent
```

Supporting entities:

```text
Creator
Organization
User
Reviewer
Editor
Region
Runtime
Platform
Category
Capability
Task
Dependency
Permission
SourceDocument
EvidenceItem
Claim
Workflow
Collection
TaxonomyVersion
MethodologyVersion
```

---

## 5. Entity Relationship Summary

```text
Creator ──creates/maintains──> Resource
Organization ──owns/publishes──> Resource
Resource ──has──> ResourceVersion
ResourceVersion ──has source──> ResourceSource
ResourceVersion ──makes──> Claim
EvidenceItem ──supports/refutes──> Claim
ResourceVersion ──provides──> Capability
ResourceVersion ──solves──> Task
ResourceVersion ──compatible with──> Runtime
ResourceVersion ──depends on──> Dependency
ResourceVersion ──requires──> Permission
ResourceVersion ──available in──> Region
User ──writes──> CommunityReview
CommunityReview ──binds to──> ResourceVersion
TestRun ──evaluates──> ResourceVersion
VerificationRecord ──evaluates──> ResourceVersion
RankingSnapshot ──ranks──> ResourceVersion
Workflow ──contains──> WorkflowStep
WorkflowStep ──uses──> ResourceVersion
Collection ──contains──> Resource
```

---

## 6. Identifier Strategy

### 6.1 Internal IDs

Every first-class entity should use a globally unique opaque identifier.

Recommended format:

- UUIDv7;
- ULID;
- another sortable opaque identifier.

Example:

```text
res_01J...
ver_01J...
src_01J...
evd_01J...
clm_01J...
wrk_01J...
```

Prefixing is optional at storage level but useful in logs, APIs, and debugging.

### 6.2 Public slugs

Public pages should use human-readable slugs.

Example:

```text
/skills/guizang-ppt-skill
```

Slugs are not canonical identity.

Rules:

- unique within public namespace;
- stable after publication;
- redirects retained after change;
- normalized lowercase;
- hyphen-separated;
- protected against collision;
- not reused after resource deletion.

### 6.3 External identifiers

Store external identifiers separately:

- GitHub repository node ID;
- npm package name;
- PyPI project name;
- MCP Registry identifier;
- official product ID;
- domain;
- creator organization ID.

External identifiers may change and must not replace internal IDs.

### 6.4 Canonical identity rule

A canonical `Resource` represents one logical capability product across versions.

A major rewrite may remain the same Resource if:

- creator continuity exists;
- purpose continuity exists;
- users reasonably consider it the same product;
- official identity remains continuous.

A fork, independent rewrite, or ownership-separated derivative is normally a separate Resource.

---

## 7. Resource Entity

### 7.1 Definition

`Resource` represents the enduring logical identity of an AI capability.

### 7.2 Core fields

```yaml
resource:
  id: string
  slug: string
  resource_type: enum
  canonical_name: string
  display_name: string
  short_description: string
  lifecycle_status: enum
  publication_status: enum
  canonical_creator_id: string|null
  canonical_organization_id: string|null
  current_version_id: string|null
  primary_source_id: string|null
  primary_category_id: string|null
  default_language: string
  created_at: datetime
  updated_at: datetime
  first_published_at: datetime|null
  archived_at: datetime|null
```

### 7.3 Resource types

Initial enum:

```text
SKILL
MCP_SERVER
AGENT
PLUGIN
WORKFLOW
TOOL
CONNECTOR
PROMPT_PACK
TEMPLATE
OTHER
```

MVP public support:

```text
SKILL
WORKFLOW
```

Other types may exist internally before public launch.

### 7.4 Resource subtype

Optional subtype enables finer classification.

Examples:

```text
Claude Skill
Codex Skill
Agent Skill
Remote MCP Server
Local MCP Server
Hosted Agent
Open-source Agent
Workflow Template
```

Subtype should not become a substitute for compatibility data.

### 7.5 Resource invariants

- `canonical_name` is required.
- `resource_type` is required.
- A published Resource must have at least one published ResourceVersion.
- `current_version_id` must reference a version owned by the Resource.
- A Resource may have multiple sources but only one current primary source.
- A Resource may not be physically deleted after public publication except under exceptional legal or privacy procedures.
- Archived Resources remain historically addressable unless removal is legally required.

---

## 8. Resource Version

### 8.1 Definition

`ResourceVersion` represents a specific evaluable version or snapshot of a Resource.

### 8.2 Why versioning is mandatory

The following may change between versions:

- installation;
- compatibility;
- dependencies;
- permissions;
- behavior;
- creator claims;
- security posture;
- regional availability;
- user experience;
- ranking;
- verification.

### 8.3 Core fields

```yaml
resource_version:
  id: string
  resource_id: string
  version_label: string
  normalized_version: string|null
  release_channel: enum
  version_source: enum
  source_revision: string|null
  source_commit_sha: string|null
  content_fingerprint: string
  release_date: datetime|null
  discovered_at: datetime
  reviewed_at: datetime|null
  published_at: datetime|null
  superseded_at: datetime|null
  is_current: boolean
  is_mutable_source_snapshot: boolean
  lifecycle_status: enum
  editorial_status: enum
```

### 8.4 Version sources

```text
SEMVER_RELEASE
GIT_TAG
GIT_COMMIT
REGISTRY_VERSION
CREATOR_DECLARATION
AI_ARK_SNAPSHOT
WEBSITE_SNAPSHOT
UNKNOWN
```

### 8.5 Mutable sources

Some repositories do not publish formal releases.

AI ARK should create immutable snapshots using:

- commit SHA;
- content fingerprint;
- ingestion timestamp.

Example label:

```text
snapshot-2026-08-01-abc1234
```

### 8.6 Release channels

```text
ALPHA
BETA
RELEASE_CANDIDATE
STABLE
EXPERIMENTAL
DEPRECATED
ARCHIVED
UNKNOWN
```

### 8.7 Version invariants

- `content_fingerprint` is required.
- Published reviews should bind to a version where reasonably possible.
- Verification must bind to a version.
- Ranking must identify the evaluated version.
- Two versions with identical content fingerprints may be aliases but should not silently duplicate evidence.
- A mutable source snapshot cannot be edited in place after publication.

---

## 9. Creator and Organization Model

## 9.1 Creator

Represents an individual creator or maintainer.

```yaml
creator:
  id: string
  slug: string
  display_name: string
  biography: string|null
  avatar_asset_id: string|null
  location_text: string|null
  primary_language: string|null
  claim_status: enum
  identity_verification_status: enum
  created_at: datetime
  updated_at: datetime
```

### Creator claim states

```text
UNCLAIMED
CLAIM_PENDING
CLAIMED
CLAIM_REJECTED
CLAIM_REVOKED
APPEALED
```

### Identity verification states

```text
NOT_VERIFIED
BASIC_VERIFIED
SOURCE_CONTROL_VERIFIED
DOMAIN_VERIFIED
MANUALLY_VERIFIED
REVOKED
```

## 9.2 Organization

Represents a company, open-source organization, community, foundation, or publisher.

```yaml
organization:
  id: string
  slug: string
  display_name: string
  organization_type: enum
  official_domain: string|null
  verification_status: enum
  primary_region_id: string|null
  created_at: datetime
  updated_at: datetime
```

### Organization types

```text
COMPANY
OPEN_SOURCE_ORG
COMMUNITY
FOUNDATION
INDIVIDUAL_BUSINESS
RESEARCH_GROUP
OTHER
```

## 9.3 Resource attribution

Many-to-many relationship:

```yaml
resource_contributor:
  resource_id: string
  creator_id: string|null
  organization_id: string|null
  contribution_role: enum
  is_primary: boolean
  effective_from: datetime|null
  effective_to: datetime|null
  evidence_claim_id: string|null
```

Roles:

```text
CREATOR
MAINTAINER
OWNER
PUBLISHER
CONTRIBUTOR
SPONSOR
DISTRIBUTOR
TRANSLATOR
MIRROR_OPERATOR
```

### Important rule

Sponsorship or distribution must not be represented as authorship or ownership.

---

## 10. Source Model

### 10.1 Resource Source

Represents a canonical or supporting source.

```yaml
resource_source:
  id: string
  resource_id: string
  resource_version_id: string|null
  source_type: enum
  source_url: string
  canonical_url: string
  external_identifier: string|null
  is_primary: boolean
  source_owner_id: string|null
  access_status: enum
  rights_status: enum
  discovered_at: datetime
  last_accessed_at: datetime|null
  content_fingerprint: string|null
```

### 10.2 Source types

```text
GITHUB_REPOSITORY
GITLAB_REPOSITORY
OFFICIAL_WEBSITE
DOCUMENTATION
PACKAGE_REGISTRY
MCP_REGISTRY
APP_DIRECTORY
CREATOR_SUBMISSION
PRESS_RELEASE
NEWS_ARTICLE
COMMUNITY_POST
VIDEO
OTHER
```

### 10.3 Access status

```text
ACCESSIBLE
PARTIALLY_ACCESSIBLE
UNAVAILABLE
AUTHENTICATION_REQUIRED
REGIONALLY_RESTRICTED
REMOVED
UNKNOWN
```

### 10.4 Rights status

```text
LICENSE_CONFIRMED
CREATOR_AUTHORIZED
PUBLIC_METADATA_ONLY
REDISTRIBUTION_ALLOWED
REDISTRIBUTION_RESTRICTED
RIGHTS_UNCLEAR
TAKEDOWN_REQUESTED
```

### 10.5 Source document

A source may contain multiple documents.

```yaml
source_document:
  id: string
  resource_source_id: string
  resource_version_id: string|null
  document_type: enum
  path_or_fragment: string|null
  title: string|null
  language: string|null
  content_fingerprint: string
  acquired_at: datetime
  parser_version: string|null
  storage_reference: string|null
  public_reproduction_status: enum
```

Document types:

```text
README
SKILL_MD
LICENSE
PACKAGE_MANIFEST
CHANGELOG
DOCUMENTATION_PAGE
LANDING_PAGE
API_REFERENCE
IMAGE
VIDEO
RELEASE_NOTE
SECURITY_POLICY
OTHER
```

---

## 11. Claim Model

### 11.1 Definition

A `Claim` is a statement about a Resource, version, creator, compatibility, behavior, availability, or quality.

Examples:

- “Works with Codex.”
- “Requires Python 3.12.”
- “Generates HTML presentations.”
- “Runtime verified in Mainland China.”
- “Maintained by Creator X.”

### 11.2 Core fields

```yaml
claim:
  id: string
  subject_type: enum
  subject_id: string
  predicate: string
  object_type: enum
  object_value: json
  claim_class: enum
  status: enum
  confidence: decimal
  valid_from: datetime|null
  valid_to: datetime|null
  created_by_type: enum
  created_by_id: string|null
  created_at: datetime
  reviewed_at: datetime|null
```

### 11.3 Claim classes

```text
SOURCE_FACT
CREATOR_DECLARATION
AI_INFERENCE
EDITORIAL_JUDGMENT
AI_ARK_TEST_RESULT
COMMUNITY_REPORT
SYSTEM_DERIVATION
LEGAL_STATUS
COMMERCIAL_DISCLOSURE
```

### 11.4 Claim status

```text
PROPOSED
SUPPORTED
PARTIALLY_SUPPORTED
DISPUTED
REFUTED
SUPERSEDED
WITHDRAWN
UNKNOWN
```

### 11.5 Confidence

Confidence is not the same as truth.

Recommended range:

```text
0.00–1.00
```

Public display should map to:

- High;
- Medium;
- Low;
- Unknown.

### 11.6 Claim invariants

- AI-generated prose should not become a factual claim without evidence.
- Claims must identify their class.
- Public material claims should be supported or visibly qualified.
- Disputed claims remain historically available internally.
- Verification decisions should rely on explicit claims and evidence, not unstructured text alone.

---

## 12. Evidence Model

### 12.1 Evidence Item

Represents a piece of evidence supporting, refuting, or qualifying a Claim.

```yaml
evidence_item:
  id: string
  evidence_type: enum
  source_document_id: string|null
  external_url: string|null
  private_storage_reference: string|null
  content_excerpt: string|null
  locator: string|null
  content_fingerprint: string|null
  submitted_by_user_id: string|null
  acquired_by_system: string|null
  privacy_level: enum
  evidence_status: enum
  observed_at: datetime|null
  acquired_at: datetime
  expires_at: datetime|null
```

### 12.2 Evidence types

```text
SOURCE_TEXT
SOURCE_METADATA
CREATOR_CONFIRMATION
SCREENSHOT
VIDEO
INSTALLATION_LOG
TEST_LOG
DEPLOYMENT_PROOF
API_RECEIPT
PACKAGE_METADATA
CHECKSUM
LICENSE_RECORD
REGIONAL_TEST
COMMUNITY_REPORT
EDITORIAL_OBSERVATION
OTHER
```

### 12.3 Privacy levels

```text
PUBLIC
REDACTED_PUBLIC
INTERNAL
RESTRICTED_VERIFICATION
LEGAL_HOLD
```

### 12.4 Evidence relationship

```yaml
claim_evidence:
  claim_id: string
  evidence_item_id: string
  relationship: enum
  weight: decimal|null
  note: string|null
```

Relationship:

```text
SUPPORTS
PARTIALLY_SUPPORTS
REFUTES
QUALIFIES
CONTEXT_ONLY
```

### 12.5 Evidence invariants

- Private evidence must not be exposed through public APIs.
- Evidence deletion must preserve audit metadata where legally permitted.
- Public excerpts must respect source rights.
- Evidence tied to mutable web pages should include timestamp and fingerprint.
- Evidence used for verification should be retained through the verification retention period.

---

## 13. Capability Model

### 13.1 Capability

Represents what a Resource can do.

Examples:

- generate presentation;
- search web;
- analyze repository;
- connect to Notion;
- review pull request;
- extract structured data.

```yaml
capability:
  id: string
  canonical_name: string
  slug: string
  description: string
  parent_capability_id: string|null
  taxonomy_version_id: string
  status: enum
```

### 13.2 Resource capability relation

```yaml
resource_capability:
  resource_version_id: string
  capability_id: string
  relationship_type: enum
  proficiency_level: enum|null
  claim_id: string|null
  is_primary: boolean
```

Relationship types:

```text
PROVIDES
SUPPORTS
ASSISTS
AUTOMATES
REQUIRES
```

Proficiency:

```text
BASIC
INTERMEDIATE
ADVANCED
SPECIALIZED
UNKNOWN
```

### 13.3 Capability hierarchy

Capabilities may be hierarchical.

Example:

```text
Content Creation
└── Presentation Creation
    ├── Slide Structure
    ├── Visual Design
    └── HTML Presentation Generation
```

### 13.4 Taxonomy governance

Capabilities should be:

- canonical;
- versioned;
- mergeable;
- deprecatable;
- multilingual through labels, not duplicated entities.

---

## 14. Task Model

### 14.1 Definition

A `Task` represents a user goal or unit of work.

Examples:

- turn report into presentation;
- audit a landing page;
- deploy a Next.js application;
- research competitors;
- connect CRM to an agent.

```yaml
task:
  id: string
  canonical_name: string
  slug: string
  description: string
  task_level: enum
  parent_task_id: string|null
  taxonomy_version_id: string
  status: enum
```

Task levels:

```text
OUTCOME
WORKFLOW_STAGE
ACTION
MICRO_TASK
```

### 14.2 Resource-task relation

```yaml
resource_task:
  resource_version_id: string
  task_id: string
  fit_level: enum
  evidence_confidence: decimal
  claim_id: string|null
  limitation_note: string|null
```

Fit:

```text
PRIMARY
STRONG
MODERATE
LIMITED
UNSUITABLE
UNKNOWN
```

### 14.3 Task versus capability

A capability is what the Resource can do.

A task is what the user wants accomplished.

Example:

```text
Capability: HTML presentation generation
Task: Convert a market report into an investor deck
```

This distinction is necessary for task-oriented search and workflow resolution.

---

## 15. Category and Tag Model

### 15.1 Category

Categories are curated browsing and ranking groups.

```yaml
category:
  id: string
  slug: string
  display_name: string
  description: string
  parent_category_id: string|null
  category_type: enum
  taxonomy_version_id: string
  ranking_methodology_id: string|null
  status: enum
```

Category types:

```text
RESOURCE_CATEGORY
USE_CASE_CATEGORY
ROLE_CATEGORY
INDUSTRY_CATEGORY
REGION_CATEGORY
```

### 15.2 Resource category relation

```yaml
resource_category:
  resource_id: string
  category_id: string
  is_primary: boolean
  assigned_by_type: enum
  assigned_by_id: string|null
  confidence: decimal|null
```

### 15.3 Tags

Tags are flexible descriptors and should not replace governed taxonomies.

```yaml
tag:
  id: string
  normalized_value: string
  display_value: string
  language: string|null
  status: enum
```

### 15.4 Taxonomy version

```yaml
taxonomy_version:
  id: string
  taxonomy_name: string
  version_label: string
  effective_at: datetime
  status: enum
  migration_note: string|null
```

---

## 16. Runtime, Platform, and Compatibility

### 16.1 Runtime

Represents an execution or consumption environment.

Examples:

- Codex;
- Claude Code;
- Cursor;
- OpenClaw;
- Hermes;
- TRAE;
- Kimi;
- generic MCP client.

```yaml
runtime:
  id: string
  slug: string
  display_name: string
  runtime_type: enum
  organization_id: string|null
  official_url: string|null
  status: enum
```

### 16.2 Platform

Represents operating or hosting environment.

Examples:

- macOS;
- Windows;
- Linux;
- web;
- Docker;
- Node.js;
- Python.

```yaml
platform:
  id: string
  slug: string
  display_name: string
  platform_type: enum
  version_constraint_format: string|null
```

### 16.3 Compatibility record

```yaml
resource_compatibility:
  id: string
  resource_version_id: string
  runtime_id: string|null
  platform_id: string|null
  status: enum
  evidence_type: enum
  tested_version_constraint: string|null
  environment_details: json|null
  claim_id: string|null
  last_checked_at: datetime|null
  expires_at: datetime|null
  limitation_note: string|null
```

### 16.4 Compatibility status

```text
TESTED_BY_AI_ARK
DECLARED_BY_CREATOR
EXPLICIT_IN_SOURCE
COMMUNITY_REPORTED
LIKELY_COMPATIBLE
PARTIALLY_COMPATIBLE
UNSUPPORTED
UNKNOWN
```

### 16.5 Compatibility invariants

- Compatibility must bind to a ResourceVersion.
- “Likely compatible” must not display as tested.
- Community reports may create provisional compatibility but not authoritative verification.
- Expired compatibility checks should be visibly stale.
- Runtime and platform compatibility should remain separate.

---

## 17. Dependency Model

### 17.1 Dependency

Represents software, service, API, package, model, runtime, account, or infrastructure required or optionally used.

```yaml
dependency:
  id: string
  dependency_type: enum
  canonical_name: string
  external_identifier: string|null
  official_url: string|null
  license: string|null
  status: enum
```

Dependency types:

```text
PACKAGE
RUNTIME
API
MODEL
DATABASE
SERVICE
CLI
BROWSER
ACCOUNT
CREDENTIAL
OPERATING_SYSTEM
HARDWARE
OTHER
```

### 17.2 Resource dependency relation

```yaml
resource_dependency:
  resource_version_id: string
  dependency_id: string
  requirement_type: enum
  version_constraint: string|null
  is_runtime_required: boolean
  is_installation_required: boolean
  is_optional: boolean
  regional_impact: enum|null
  claim_id: string|null
```

Requirement types:

```text
REQUIRED
OPTIONAL
RECOMMENDED
DEVELOPMENT_ONLY
TEST_ONLY
UNKNOWN
```

### 17.3 Dependency risk

Optional future relation:

```yaml
dependency_risk:
  dependency_id: string
  region_id: string|null
  risk_type: enum
  severity: enum
  evidence_item_id: string|null
  valid_from: datetime|null
  valid_to: datetime|null
```

---

## 18. Permission Model

### 18.1 Permission

Represents access a Resource requests or requires.

Examples:

- filesystem read;
- filesystem write;
- shell execution;
- network access;
- browser automation;
- email access;
- calendar access;
- GitHub write;
- credential access.

```yaml
permission:
  id: string
  canonical_name: string
  permission_domain: enum
  description: string
  sensitivity_level: enum
```

### 18.2 Resource permission relation

```yaml
resource_permission:
  resource_version_id: string
  permission_id: string
  requirement_type: enum
  scope_description: string|null
  source_claim_id: string|null
  test_confirmed: boolean
  user_configurable: boolean
```

### 18.3 Sensitivity

```text
LOW
MODERATE
HIGH
CRITICAL
UNKNOWN
```

### 18.4 Public display rule

The public page should explain permissions in user language.

Example:

> Can run shell commands in the working directory.

Not only:

```text
shell.exec=true
```

---

## 19. Region and Availability Model

### 19.1 Region

```yaml
region:
  id: string
  code: string
  display_name: string
  region_type: enum
  parent_region_id: string|null
```

Region types:

```text
COUNTRY
TERRITORY
ECONOMIC_AREA
MARKET
CUSTOM
```

### 19.2 Availability record

```yaml
regional_availability:
  id: string
  resource_version_id: string
  region_id: string
  information_status: enum
  artifact_status: enum
  installation_status: enum
  runtime_status: enum
  check_method: enum
  checked_at: datetime
  expires_at: datetime|null
  checked_by_type: enum
  checked_by_id: string|null
  claim_id: string|null
  limitation_note: string|null
  alternative_resource_ids: string[]
```

### 19.3 Availability statuses

```text
CONFIRMED
PARTIAL
UNAVAILABLE
UNKNOWN
UNDER_REVIEW
NOT_APPLICABLE
```

### 19.4 Check methods

```text
EDITORIAL_REVIEW
CREATOR_DECLARATION
AUTOMATED_NETWORK_CHECK
INSTALLATION_TEST
RUNTIME_TEST
COMMUNITY_REPORT
AUTHORIZED_MIRROR_CHECK
```

### 19.5 Mirror record

```yaml
resource_mirror:
  id: string
  resource_version_id: string
  region_id: string
  mirror_url: string
  operator_organization_id: string|null
  authorization_basis: enum
  checksum: string
  upstream_checksum: string|null
  synchronization_status: enum
  last_synced_at: datetime
  rights_evidence_id: string
  status: enum
```

### 19.6 Availability invariants

- CN-A4 Runtime Verified requires documented runtime evidence.
- Authorized mirror status requires rights evidence.
- Availability expires and must be rechecked.
- Region-specific claims must not be generalized globally.
- Alternatives must be separate Resource identities.

---

## 20. Asset Model

### 20.1 Resource Asset

Represents images, videos, logos, output examples, diagrams, and downloadable artifacts.

```yaml
resource_asset:
  id: string
  resource_id: string
  resource_version_id: string|null
  asset_type: enum
  storage_reference: string
  source_url: string|null
  rights_status: enum
  attribution_text: string|null
  alt_text: string|null
  caption: string|null
  content_fingerprint: string
  is_primary: boolean
  visibility: enum
```

Asset types:

```text
LOGO
SCREENSHOT
OUTPUT_EXAMPLE
VIDEO
DIAGRAM
ICON
DOCUMENT
ARCHIVE
OTHER
```

### 20.2 Asset rights

```text
CREATOR_AUTHORIZED
LICENSE_PERMITS
FAIR_USE_REVIEWED
LINK_ONLY
INTERNAL_ONLY
RIGHTS_UNCLEAR
REMOVED
```

---

## 21. Community Comment Model

### 21.1 Comment thread

```yaml
comment_thread:
  id: string
  subject_type: enum
  subject_id: string
  status: enum
  created_at: datetime
```

### 21.2 Comment

```yaml
comment:
  id: string
  thread_id: string
  author_user_id: string
  parent_comment_id: string|null
  comment_type: enum
  body: string
  resource_version_id: string|null
  runtime_id: string|null
  region_id: string|null
  moderation_status: enum
  creator_response_status: enum|null
  created_at: datetime
  updated_at: datetime|null
```

Comment types:

```text
QUESTION
TIP
OPINION
DOCUMENTATION_FEEDBACK
COMPATIBILITY_REPORT
ISSUE_REPORT
CREATOR_UPDATE
MODERATOR_NOTE
```

### 21.3 Ranking rule

Comments do not directly affect ranking.

They may generate reviewed Claims or CommunityReview records.

---

## 22. Community Review Model

### 22.1 Review

```yaml
community_review:
  id: string
  resource_id: string
  resource_version_id: string
  reviewer_user_id: string
  review_type: enum
  verification_status: enum
  task_id: string|null
  task_description: string
  runtime_id: string|null
  platform_id: string|null
  region_id: string|null
  setup_result: enum
  task_result: enum
  would_use_again: enum
  narrative: string
  moderation_status: enum
  created_at: datetime
  updated_at: datetime|null
```

### 22.2 Dimension ratings

```yaml
review_rating:
  review_id: string
  dimension: enum
  score: integer
```

Dimensions:

```text
SETUP
DOCUMENTATION
FUNCTIONAL_ACCURACY
OUTPUT_QUALITY
RELIABILITY
COMPATIBILITY
VALUE
SUPPORT
```

Recommended scale:

```text
1–5
```

### 22.3 Review types

```text
STRUCTURED_USAGE
VERIFIED_INSTALLATION
VERIFIED_DEPLOYMENT
VERIFIED_BETA_TEST
VERIFIED_PRODUCTION_USE
```

### 22.4 Setup result

```text
SUCCESS
PARTIAL
FAILED
NOT_ATTEMPTED
```

### 22.5 Task result

```text
COMPLETED
PARTIALLY_COMPLETED
FAILED
NOT_EVALUATED
```

### 22.6 Review verification

```yaml
review_verification:
  review_id: string
  verification_method: enum
  evidence_item_id: string
  verified_by_user_id: string|null
  verified_at: datetime
  public_disclosure_level: enum
  status: enum
```

### 22.7 Review invariants

- A structured review must bind to a ResourceVersion.
- A verified review requires evidence.
- Private evidence must not be exposed.
- Creator self-reviews are prohibited.
- Historical reviews remain associated with their version.
- Moderation removal does not erase internal audit history where legally permitted.

---

## 23. Test Run Model

### 23.1 Definition

Represents a structured AI ARK or Labs test.

```yaml
test_run:
  id: string
  resource_version_id: string
  test_type: enum
  environment: json
  initiated_by_type: enum
  initiated_by_id: string|null
  scenario_definition_id: string|null
  status: enum
  started_at: datetime
  completed_at: datetime|null
  result: enum|null
  evidence_bundle_id: string|null
  summary: string|null
```

Test types:

```text
INSTALLATION
FUNCTIONAL
COMPATIBILITY
REGIONAL
WORKFLOW_STEP
SECURITY_STATIC
PERFORMANCE
USER_ACCEPTANCE
```

Results:

```text
PASS
PARTIAL_PASS
FAIL
INCONCLUSIVE
ABORTED
```

### 23.2 Test scenario

```yaml
test_scenario:
  id: string
  name: string
  objective: string
  prerequisites: json
  steps: json
  expected_results: json
  methodology_version_id: string|null
  status: enum
```

---

## 24. Deployment Evidence Model

```yaml
deployment_evidence:
  id: string
  resource_version_id: string
  user_id: string|null
  deployment_type: enum
  environment: json
  region_id: string|null
  verified_status: enum
  evidence_item_id: string
  public_summary: string|null
  private_details_retained: boolean
  observed_at: datetime
```

Deployment types:

```text
LOCAL
DEVELOPMENT
STAGING
PRODUCTION
ENTERPRISE_INTERNAL
OTHER
```

---

## 25. Ranking Model

### 25.1 Methodology version

```yaml
ranking_methodology:
  id: string
  name: string
  version_label: string
  category_id: string|null
  lifecycle_scope: enum
  weight_configuration: json
  eligibility_rules: json
  normalization_rules: json
  effective_from: datetime
  effective_to: datetime|null
  status: enum
```

### 25.2 Ranking snapshot

```yaml
ranking_snapshot:
  id: string
  resource_id: string
  resource_version_id: string
  category_id: string
  methodology_id: string
  quality_score: decimal
  category_rank: integer|null
  momentum_score: decimal|null
  evidence_confidence: decimal
  risk_status: enum
  eligibility_status: enum
  score_components: json
  manual_adjustment: decimal|null
  manual_adjustment_reason: string|null
  calculated_at: datetime
  published_at: datetime|null
```

### 25.3 Risk status

```text
NO_CRITICAL_ISSUE_IDENTIFIED
LIMITED_REVIEW
UNRESOLVED_RISK
SEVERE_RISK
NOT_EVALUATED
```

### 25.4 Eligibility

```text
ELIGIBLE
PROVISIONAL
INELIGIBLE
SUSPENDED
INSUFFICIENT_EVIDENCE
```

### 25.5 Ranking invariants

- Ranking snapshots are immutable.
- Public ranking references a MethodologyVersion.
- Manual adjustment requires actor, reason, and audit record.
- Sponsorship and commercial relationships cannot be inputs.
- Beta and stable rankings require separate lifecycle scopes.
- Low evidence confidence must remain visible.

---

## 26. Verification Model

### 26.1 Verification level

```text
SOURCE_VERIFIED
FUNCTIONALLY_TESTED
QUALITY_VERIFIED
PROVEN_IN_USE
AI_ARK_VERIFIED
```

### 26.2 Verification record

```yaml
verification_record:
  id: string
  resource_id: string
  resource_version_id: string
  verification_level: enum
  methodology_id: string
  status: enum
  evaluator_user_id: string
  requested_by_type: enum|null
  requested_by_id: string|null
  scope: json
  environments: json
  scenario_ids: string[]
  evidence_item_ids: string[]
  findings: json
  limitations: string[]
  unresolved_risks: string[]
  conflict_disclosure: string|null
  decision_reason: string
  awarded_at: datetime|null
  expires_at: datetime|null
  revoked_at: datetime|null
  superseded_by_id: string|null
```

### 26.3 Verification status

```text
REQUESTED
SCHEDULED
IN_PROGRESS
AWAITING_EVIDENCE
REMEDIATION_REQUIRED
AWARDED
DENIED
EXPIRED
REVOKED
APPEALED
SUPERSEDED
```

### 26.4 Verification methodology

```yaml
verification_methodology:
  id: string
  name: string
  version_label: string
  level: enum
  eligibility_rules: json
  test_requirements: json
  evidence_requirements: json
  expiry_policy: json
  effective_from: datetime
  status: enum
```

### 26.5 Verification invariants

- Verification binds to one version.
- Higher levels do not erase lower-level history.
- AI ARK Verified requires the necessary prerequisite evidence.
- Payment cannot be stored as an evaluation factor.
- Expired verification must not appear active.
- Public report must state scope and limits.

---

## 27. Labs Campaign Model

```yaml
labs_campaign:
  id: string
  resource_id: string
  resource_version_id: string
  creator_id: string
  stage: enum
  objective: string
  target_tester_profile: json
  required_runtime_ids: string[]
  required_platform_ids: string[]
  region_ids: string[]
  tester_capacity: integer
  application_open_at: datetime
  application_close_at: datetime
  testing_start_at: datetime
  testing_end_at: datetime
  known_risks: string[]
  required_permissions: string[]
  task_ids: string[]
  success_criteria: json
  feedback_schema: json
  incentive: json|null
  confidentiality_terms: string|null
  status: enum
  reviewed_by_user_id: string|null
```

Campaign stage:

```text
ALPHA
CLOSED_BETA
PUBLIC_BETA
RELEASE_CANDIDATE
VERSION_TEST
```

Campaign status:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
OPEN
TESTING
COMPLETED
CANCELLED
ARCHIVED
```

### Tester application

```yaml
labs_application:
  id: string
  campaign_id: string
  user_id: string
  profile_snapshot: json
  runtime_ids: string[]
  platform_ids: string[]
  region_id: string|null
  relevant_experience: string
  intended_use_case: string
  consent_status: enum
  conflict_disclosure: string|null
  status: enum
  submitted_at: datetime
```

---

## 28. Workflow Model

### 28.1 Workflow

A Workflow may be a Resource and also possess workflow-specific structure.

```yaml
workflow:
  id: string
  resource_id: string
  workflow_type: enum
  goal_task_id: string
  target_user_profile: json
  prerequisites: json
  supported_runtime_ids: string[]
  supported_region_ids: string[]
  estimated_time: json|null
  estimated_cost: json|null
  risk_summary: json|null
  verification_status: enum
  current_version_id: string
```

Workflow types:

```text
AI_ARK_VERIFIED
CURATED
AI_GENERATED
CREATOR_SUBMITTED
COMMUNITY_SUBMITTED
```

### 28.2 Workflow version

```yaml
workflow_version:
  id: string
  workflow_id: string
  version_label: string
  content_fingerprint: string
  status: enum
  reviewed_at: datetime|null
  published_at: datetime|null
```

### 28.3 Workflow step

```yaml
workflow_step:
  id: string
  workflow_version_id: string
  sequence_number: integer
  objective_task_id: string
  title: string
  instructions: string
  expected_input: json|null
  expected_output: json
  approval_required: boolean
  optional: boolean
  regional_note: string|null
```

### 28.4 Workflow step resource

```yaml
workflow_step_resource:
  workflow_step_id: string
  resource_version_id: string
  selection_role: enum
  selection_reason: string
  priority: integer
  compatibility_requirements: json|null
```

Selection role:

```text
PRIMARY
ALTERNATIVE
FALLBACK
OPTIONAL
REGIONAL_ALTERNATIVE
```

### 28.5 Workflow edge

For non-linear workflows:

```yaml
workflow_edge:
  workflow_version_id: string
  from_step_id: string
  to_step_id: string
  condition: json|null
  edge_type: enum
```

### 28.6 Workflow invariants

- Public workflows are versioned.
- Every step has expected output.
- Verified workflows require test evidence.
- AI-generated paths must be visibly typed.
- Resource replacement creates a new WorkflowVersion.
- Workflow recommendations should preserve regional and compatibility constraints.

---

## 29. Collection Model

```yaml
collection:
  id: string
  slug: string
  title: string
  summary: string
  curator_type: enum
  curator_id: string|null
  inclusion_criteria: string
  status: enum
  sponsorship_status: enum
  published_at: datetime|null
  updated_at: datetime
```

### Collection membership

```yaml
collection_membership:
  collection_id: string
  resource_id: string
  resource_version_id: string|null
  position: integer|null
  inclusion_reason: string
  added_at: datetime
  removed_at: datetime|null
```

Collections are not ordered workflows and should not imply execution sequence.

---

## 30. Commercial Relationship Model

```yaml
commercial_relationship:
  id: string
  relationship_type: enum
  resource_id: string|null
  creator_id: string|null
  organization_id: string|null
  starts_at: datetime
  ends_at: datetime|null
  disclosure_text: string
  status: enum
```

Types:

```text
SPONSORED_PLACEMENT
AI_ARK_FIRST
EXCLUSIVE_BETA
OFFICIAL_PAGE
LAUNCH_PARTNER
EVALUATION_FEE
ADVERTISING
OTHER
```

### Invariant

Commercial relationships must be excluded from organic ranking inputs and verification outcomes.

---

## 31. Lifecycle Model

### 31.1 Resource lifecycle

```text
CANDIDATE
DRAFT
UNDER_REVIEW
PUBLISHED
UPDATE_DETECTED
RE_REVIEW_REQUIRED
DEPRECATED
ARCHIVED
REMOVED
LEGAL_HOLD
```

### 31.2 Publication status

```text
UNPUBLISHED
SCHEDULED
PUBLIC
HIDDEN
RESTRICTED
REMOVED
```

### 31.3 Lifecycle event

```yaml
lifecycle_event:
  id: string
  subject_type: enum
  subject_id: string
  event_type: enum
  from_status: string|null
  to_status: string
  actor_type: enum
  actor_id: string|null
  reason: string|null
  evidence_item_id: string|null
  occurred_at: datetime
```

### 31.4 Immutability

Published history should be append-only where practical.

Corrections create:

- new event;
- updated canonical field;
- preserved prior value in audit history.

---

## 32. Duplicate, Fork, Alias, and Replacement Model

### 32.1 Relationship types

```text
DUPLICATE_OF
FORK_OF
DERIVED_FROM
RENAMED_TO
REPLACED_BY
SUPERSEDES
MIRROR_OF
ALIAS_OF
BUNDLES
INCLUDES
INTEGRATES_WITH
```

### 32.2 Resource relationship

```yaml
resource_relationship:
  id: string
  source_resource_id: string
  target_resource_id: string
  relationship_type: enum
  claim_id: string|null
  effective_from: datetime|null
  effective_to: datetime|null
  status: enum
```

### 32.3 Duplicate handling

If two records are confirmed duplicates:

- select canonical Resource;
- merge public traffic;
- preserve source records;
- create redirects;
- preserve audit history;
- avoid double-counting reviews or adoption.

### 32.4 Fork handling

Forks remain separate Resources when:

- maintained independently;
- materially changed;
- separately branded;
- separately distributed;
- user choice meaningfully differs.

### 32.5 Alias handling

Aliases may include:

- old name;
- translated name;
- repository name;
- package name;
- acronym.

```yaml
resource_alias:
  id: string
  resource_id: string
  alias: string
  language: string|null
  alias_type: enum
  status: enum
```

---

## 33. Search Document Model

The search index should be derived from canonical entities.

```yaml
search_document:
  resource_id: string
  resource_version_id: string
  title: string
  aliases: string[]
  short_description: string
  capabilities: string[]
  tasks: string[]
  categories: string[]
  creator_names: string[]
  runtimes: string[]
  regions: string[]
  verification_levels: string[]
  quality_score: decimal|null
  evidence_confidence: decimal|null
  freshness_at: datetime
  lifecycle: string
  language_variants: json
  embedding_reference: string|null
```

### Search invariants

- Search documents are disposable derived indexes.
- Canonical truth remains in the primary database.
- Reindexing must be deterministic from canonical state.
- Hidden or removed resources must not remain searchable publicly.
- Commercial sponsorship must not alter relevance score unless in a clearly separated sponsored channel.

---

## 34. API-Facing Resource Representation

### 34.1 Summary representation

```json
{
  "id": "res_...",
  "slug": "example-skill",
  "type": "SKILL",
  "name": "Example Skill",
  "summary": "Turns structured research into presentation-ready output.",
  "current_version": {
    "id": "ver_...",
    "label": "2.3.0",
    "release_channel": "STABLE"
  },
  "creator": {
    "id": "crt_...",
    "name": "Example Creator",
    "verification": "SOURCE_CONTROL_VERIFIED"
  },
  "categories": ["Presentation", "Content"],
  "capabilities": ["HTML presentation generation"],
  "compatibility": [],
  "ranking": {},
  "verification": {},
  "regional_availability": {},
  "freshness": {
    "source_updated_at": "2026-07-30T00:00:00Z",
    "ai_ark_reviewed_at": "2026-08-01T00:00:00Z"
  }
}
```

### 34.2 Evidence summary

Public API may include:

```json
{
  "claim_id": "clm_...",
  "statement": "Works with Codex",
  "status": "SUPPORTED",
  "evidence_type": "EXPLICIT_IN_SOURCE",
  "confidence": 0.97,
  "source": {
    "type": "README",
    "url": "..."
  }
}
```

### 34.3 Private data exclusions

Public API must exclude:

- private evidence;
- email addresses;
- moderation notes;
- legal holds;
- internal fraud scores;
- unreleased ranking calculations;
- private Labs tester information;
- unpublished drafts.

### 34.4 API versioning

API schema versions should be independent from ResourceVersion.

Example:

```text
/v1/resources/{id}
```

Breaking changes require:

```text
/v2/...
```

---

## 35. Localization Model

### 35.1 Localized content

```yaml
localized_content:
  id: string
  subject_type: enum
  subject_id: string
  field_name: string
  language: string
  value: text
  translation_type: enum
  review_status: enum
  translated_by_type: enum
  translated_by_id: string|null
  source_language: string
  updated_at: datetime
```

Translation types:

```text
CREATOR_PROVIDED
HUMAN_TRANSLATED
AI_ASSISTED_HUMAN_REVIEWED
MACHINE_GENERATED_INTERNAL
```

Only reviewed translations should be public.

### 35.2 Canonical data rule

Translation does not create a separate Resource.

Regional editions may be separate ResourceVersions only when behavior or packaging materially differs.

---

## 36. Audit Model

### 36.1 Audit event

```yaml
audit_event:
  id: string
  actor_type: enum
  actor_id: string|null
  action: string
  subject_type: enum
  subject_id: string
  before_state: json|null
  after_state: json|null
  reason: string|null
  request_id: string|null
  occurred_at: datetime
```

### 36.2 Required audit actions

- publish;
- unpublish;
- archive;
- merge duplicate;
- change canonical source;
- approve creator claim;
- revoke creator claim;
- modify ranking;
- award verification;
- revoke verification;
- remove review;
- expose or redact evidence;
- authorize mirror;
- change regional availability.

### 36.3 Audit invariants

- audit records are append-only;
- sensitive before/after states may be encrypted or redacted;
- every consequential administrative action has an actor;
- system actions identify system version or job.

---

## 37. Privacy and Data Classification

### 37.1 Data classes

```text
PUBLIC
INTERNAL
CONFIDENTIAL
RESTRICTED
LEGAL_HOLD
```

### 37.2 Examples

#### Public

- resource summaries;
- creator public profiles;
- public reviews;
- published verification reports.

#### Internal

- editorial drafts;
- ranking diagnostics;
- internal notes.

#### Confidential

- creator contact details;
- private tester applications;
- unpublished submissions.

#### Restricted

- private deployment evidence;
- credentials accidentally submitted;
- identity verification documents.

### 37.3 Deletion behavior

User deletion should:

- remove or anonymize personal identity where required;
- preserve aggregate review statistics where legally permitted;
- preserve moderation and verification audit records where required;
- remove private evidence according to retention rules.

---

## 38. Data Retention

Suggested MVP retention policy categories:

- public resource history: indefinite unless legal removal;
- audit records: long-term;
- private verification evidence: defined period after expiry;
- Labs applications: limited period after campaign;
- rejected claims: limited retention;
- deleted-account personal data: remove or anonymize;
- security incident evidence: according to incident policy.

Exact periods require legal and operational review.

---

## 39. Data Validation Rules

### 39.1 Resource publication minimum

A Resource cannot be published unless it has:

- canonical name;
- ResourceType;
- one canonical source;
- one ResourceVersion;
- creator or organization attribution where known;
- short description;
- primary category;
- at least one Task or Capability;
- one material limitation or explicit unknown;
- evidence for material factual claims;
- review date;
- regional-availability state;
- publication approval.

### 39.2 Review minimum

A structured review requires:

- ResourceVersion;
- user;
- task description;
- environment or explicit unknown;
- setup result;
- task result;
- narrative.

### 39.3 Verification minimum

A VerificationRecord requires:

- methodology version;
- ResourceVersion;
- scope;
- evaluator;
- evidence;
- decision reason;
- expiry policy.

### 39.4 Ranking minimum

A public RankingSnapshot requires:

- methodology version;
- category;
- ResourceVersion;
- quality score;
- confidence;
- risk status;
- calculation date.

---

## 40. Graph Query Requirements

The model should support queries such as:

### Discovery

- Find Skills that solve Task X.
- Find Resources compatible with Codex.
- Find high-confidence Resources in Category Y.
- Find Resources runtime verified in Mainland China.

### Comparison

- Compare two ResourceVersions.
- Show alternatives with easier setup.
- Show higher-quality Resources with similar capabilities.

### Workflow

- Find Resources for each WorkflowStep.
- Find regional alternatives for unavailable steps.
- Find workflows containing Resource X.

### Trust

- Explain why Resource X is ranked #2.
- Show claims supported by AI ARK tests.
- Show unresolved risks.
- Show current-version verified reviews.

### Creator

- Show all Resources maintained by Creator X.
- Show creator response rate.
- Show current Labs campaigns.

### Change monitoring

- Find Resources whose primary source changed.
- Find verification expiring within 30 days.
- Find workflows using superseded versions.

---

## 41. Relational Implementation Guidance

The MVP can use PostgreSQL.

Recommended approach:

- first-class tables for core entities;
- join tables for many-to-many relationships;
- JSONB for flexible environment, scope, and evidence summaries;
- immutable snapshot tables for ranking and verification;
- full-text and vector search derived indexes;
- object storage for evidence and assets;
- background jobs for ingestion and reindexing.

Avoid storing the entire graph as one JSON document.

### 41.1 Strongly relational entities

- Resource;
- ResourceVersion;
- Creator;
- Organization;
- Source;
- Claim;
- Evidence;
- Category;
- Capability;
- Task;
- Compatibility;
- Review;
- RankingSnapshot;
- VerificationRecord;
- Workflow;
- WorkflowStep.

### 41.2 Appropriate JSONB use

- test environments;
- verification scope;
- score components;
- workflow inputs and outputs;
- regional limitations;
- creator submission metadata.

JSONB must not hide canonical identity or critical relationships.

---

## 42. Data Migration and Schema Versioning

### 42.1 Schema migration

All schema changes require:

- migration ID;
- forward migration;
- rollback or remediation plan;
- data backfill plan;
- validation;
- audit note.

### 42.2 Taxonomy migration

When categories, capabilities, or tasks merge:

- preserve old IDs;
- create replacement relation;
- reindex;
- preserve historical ranking context.

### 42.3 Methodology changes

Ranking and verification methodology changes create new versions.

Historical snapshots remain tied to old methodology.

### 42.4 API compatibility

Internal schema change does not automatically require API break.

Use translation layers.

---

## 43. Security Requirements

- imported source content must be treated as untrusted;
- no repository code execution during ingestion;
- sanitize HTML and Markdown;
- scan uploads;
- validate URLs;
- prevent SSRF in source acquisition;
- encrypt private evidence;
- isolate verification artifacts;
- rate-limit public APIs;
- protect audit logs;
- restrict admin queries;
- prevent search index leakage of hidden content.

---

## 44. Observability Requirements

The data layer should emit metrics for:

- ingestion success;
- duplicate detection;
- evidence coverage;
- unsupported claims;
- publication delay;
- ranking computation;
- verification expiry;
- source access failure;
- regional-check age;
- search index drift;
- API schema errors;
- audit-write failures.

Every asynchronous job should have:

- job ID;
- subject ID;
- start time;
- completion time;
- status;
- retry count;
- error category.

---

## 45. Acceptance Criteria

The Resource and Capability Graph specification is implemented correctly when:

### Core identity

- every public Resource has stable internal identity and slug;
- Resource and ResourceVersion are separate;
- duplicates and forks can be represented;
- aliases and redirects are preserved.

### Evidence

- material claims can link to evidence;
- claim class is explicit;
- private evidence is protected;
- source-derived and inferred content remain distinguishable.

### Discovery

- Resources can connect to Categories, Capabilities, and Tasks;
- search indexes can be regenerated;
- task-oriented queries are supported.

### Trust

- compatibility binds to versions;
- reviews bind to versions;
- ranking snapshots are immutable;
- verification is versioned and scoped;
- regional availability has four levels.

### Community

- comments and reviews are distinct;
- verified use requires evidence;
- creator responses are represented;
- moderation history is auditable.

### Workflow

- workflows contain ordered or conditional steps;
- steps reference ResourceVersions;
- alternatives are representable;
- verified and generated workflows are distinguishable.

### API

- public resource summaries can be generated from canonical data;
- private fields are excluded;
- version, provenance, confidence, and freshness are available.

### Operations

- lifecycle transitions are recorded;
- consequential actions are audited;
- schema migrations are versioned;
- derived indexes are rebuildable.

---

## 46. Open Data-Model Questions

The following should be resolved during detailed architecture and implementation planning.

1. Should `Workflow` remain both a Resource and a dedicated entity, or should workflow-specific data be an extension table only?
2. Should `Agent` and `MCP Server` share a common executable-manifest extension?
3. Which claims are mandatory for public resource publication?
4. Should current popularity metrics be canonical entities or external snapshots?
5. How should GitHub stars and package downloads be normalized and historically stored?
6. What exact content fingerprinting method should be used for mutable repositories?
7. How should creator ownership disputes affect public attribution?
8. Should regional mirrors be separate ResourceVersions or delivery records?
9. How should community-reported compatibility expire?
10. Which permission taxonomy should be used initially?
11. How should proprietary hosted tools represent versions without public releases?
12. Should public APIs expose component-level ranking scores by default?
13. How should AI-generated paths be stored before publication?
14. What evidence threshold creates Proven in Use?
15. How should deleted reviews affect historical ranking snapshots?
16. How should enterprise-private Resources later coexist with public canonical identities?
17. Which evidence classes require cryptographic signatures?
18. How should source conflicts be resolved when creator and repository disagree?
19. Should public corrections create a visible change log?
20. How should agent-generated feedback differ from human reviews?

---

## 47. Recommended Initial Implementation Slice

For the MVP, implement first:

```text
Resource
ResourceVersion
Creator
Organization
ResourceSource
SourceDocument
Claim
EvidenceItem
Category
Capability
Task
Runtime
Platform
Compatibility
Dependency
Permission
Region
RegionalAvailability
CommunityReview
Comment
RankingSnapshot
VerificationRecord
Workflow
WorkflowStep
Collection
LifecycleEvent
AuditEvent
```

Defer advanced implementation of:

- complex workflow branching;
- enterprise tenancy;
- signed evidence bundles;
- automatic execution manifests;
- marketplace transactions;
- advanced reviewer reputation;
- broad social graphs;
- real-time graph database replication.

---

## 48. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Resource Intelligence Pipeline Specification v1.0.md`

It should define:

- source submission;
- GitHub acquisition;
- website and registry adapter architecture;
- extraction;
- identity resolution;
- duplicate detection;
- asset handling;
- AI interpretation;
- claim generation;
- evidence binding;
- risk analysis;
- draft generation;
- human review;
- publication;
- update detection;
- re-review;
- failure handling;
- operational metrics;
- acceptance criteria.

---

## 49. Final Data Architecture Direction

# AI ARK should be built around a governed Capability Evidence Graph, not a collection of generated pages.

The website, API, rankings, verification, workflows, reviews, and regional availability should all derive from the same canonical graph.

The graph must preserve:

- what a Resource is;
- who created it;
- which version is being discussed;
- what it claims to do;
- what evidence supports those claims;
- where it works;
- what it requires;
- what users experienced;
- how it ranks;
- what AI ARK verified;
- how it fits into a workflow;
- what changed over time.

This is the foundation that allows AI ARK to progress from curated Skill discovery to trusted capability infrastructure for humans and agents.

---

**End of document**
