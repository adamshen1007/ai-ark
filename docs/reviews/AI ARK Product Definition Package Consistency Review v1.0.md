# AI ARK Product Definition Package Consistency Review v1.0

**Document status:** Cross-document review and controlling clarification  
**Version:** 1.0  
**Date:** August 2, 2026  
**Working product name:** AI ARK  
**Review stage:** Pre-prototype product-definition gate  
**Decision:** CONDITIONAL GO — PROTOTYPE AUTHORIZED SUBJECT TO THE CONTROLLING DECISIONS IN THIS REVIEW  
**Engineering status:** NOT AUTHORIZED  
**Reviewed package:** Twelve AI ARK Product Definition documents  
**Primary audience:** Founder, product, design, engineering, editorial, trust and safety, creator relations, Mainland operations, API, research, and future independent reviewers  

---

## 1. Purpose

This review evaluates the complete AI ARK Product Definition Package as one system.

It identifies and resolves:

- contradictions;
- duplicated concepts;
- inconsistent terminology;
- overlapping state models;
- scope expansion;
- unclear ownership of requirements;
- API and graph mismatches;
- ranking and verification ambiguity;
- community and Labs evidence overlap;
- workflow-model ambiguity;
- Mainland scope and regulatory sequencing;
- validation-threshold inconsistencies;
- requirements that are missing before prototype or engineering.

This review is a **controlling clarification**.

Where the twelve reviewed documents conflict, the decisions in this review govern until the affected source documents are formally revised.

---

## 2. Reviewed Documents

The following documents were reviewed together:

1. `AI ARK Product Vision and Positioning v1.0.md`
2. `AI ARK MVP PRD v1.0.md`
3. `AI ARK Information Architecture and UX Specification v1.0.md`
4. `AI ARK Resource and Capability Graph Specification v1.0.md`
5. `AI ARK Resource Intelligence Pipeline Specification v1.0.md`
6. `AI ARK Ranking and Verification Standard v1.0.md`
7. `AI ARK Community Review and Usage Evidence Specification v1.0.md`
8. `AI ARK Creator and Labs Specification v1.0.md`
9. `AI ARK Workflow and Task Resolution Specification v1.0.md`
10. `AI ARK API and Connector Specification v1.0.md`
11. `AI ARK Mainland Availability Specification v1.0.md`
12. `AI ARK Validation and Analytics Plan v1.0.md`

The earlier `AI ARK Worthiness Review v1.1.md` was treated as the governing opportunity decision, but it is not counted among the twelve Product Definition documents.

---

## 3. Review Method

The package was reviewed across nine consistency dimensions.

### 3.1 Strategic consistency

Do the documents describe the same company and product category?

### 3.2 MVP consistency

Do they agree on what is included, piloted, deferred, and prohibited?

### 3.3 Terminology consistency

Do repeated terms have one stable meaning?

### 3.4 Data consistency

Can the proposed public, editorial, ranking, review, workflow, API, and Mainland systems use one canonical graph?

### 3.5 State consistency

Are lifecycle, maturity, publication, review, verification, and update states separated correctly?

### 3.6 Trust consistency

Do ranking, verification, reviews, creator claims, and commercial relationships remain distinct?

### 3.7 Interface consistency

Do the website, API, MCP, and FounderOS Connector expose compatible interpretations of canonical data?

### 3.8 Regional consistency

Can Mainland availability remain accurate without forcing an immediate Mainland public launch?

### 3.9 Validation consistency

Can the proposed metrics be measured in the phase where they are required?

---

## 4. Executive Finding

# The package is strategically coherent but operationally over-specified for an initial validation product.

The twelve documents consistently support the same long-term thesis:

> AI ARK is a trusted discovery and intelligence layer that helps humans and AI systems find, evaluate, test, verify, combine, and access AI capabilities.

The strongest and most consistent concepts are:

- Skills as the market-entry wedge;
- `Resource` as the root capability object;
- evidence and provenance as core infrastructure;
- a human-reviewed URL-to-publication pipeline;
- transparent ranking;
- layered, version-specific verification;
- structured community usage evidence;
- creator claims and testing;
- task-oriented workflows;
- a read-only agent API;
- a separate FounderOS Connector;
- four-level Mainland availability;
- no automatic publication;
- no automatic execution;
- no paid credibility.

The primary inconsistency is not strategic disagreement.

It is **MVP boundary inflation**.

Several specialized specifications describe the correct long-term architecture but sometimes present advanced systems as if they all belong in the same public MVP.

This review resolves that by separating:

```text
Public Validation MVP
Controlled Validation Pilots
Architecture-Only Foundations
Post-MVP Products
Explicitly Prohibited MVP Scope
```

---

## 5. Package Decision

# CONDITIONAL GO — CLICKABLE PROTOTYPE MAY PROCEED

Prototype design is authorized using the canonical decisions in this review.

Production engineering is not authorized.

Before engineering authorization:

1. prototype validation must be completed;
2. concierge validation must be completed;
3. the MVP scope must be frozen;
4. the documents must receive a harmonization update;
5. system architecture and security documentation must be generated;
6. brand status must be resolved or explicitly accepted as a temporary codename risk.

---

## 6. Controlling Document Hierarchy

When documents overlap, use the following hierarchy.

### Level 1 — Opportunity authority

`AI ARK Worthiness Review v1.1.md`

Controls:

- whether the project proceeds;
- major strategic conditions;
- high-level exclusions.

### Level 2 — Product strategy

`AI ARK Product Vision and Positioning v1.0.md`

Controls:

- mission;
- product category;
- target users;
- positioning;
- strategic boundaries.

### Level 3 — MVP scope

`AI ARK MVP PRD v1.0.md`

Controls:

- validation-MVP inclusions;
- exclusions;
- release gates;
- top-level acceptance criteria.

### Level 4 — Domain specifications

Each specialized specification controls its domain behavior:

- UX Specification → information architecture and presentation;
- Capability Graph → canonical data model;
- Pipeline Specification → ingestion and publication;
- Ranking and Verification Standard → ranking and verification;
- Community Specification → comments, reviews, and usage evidence;
- Creator and Labs Specification → creators, claims, launch programs, and testing;
- Workflow Specification → task resolution and workflow logic;
- API Specification → interface contracts;
- Mainland Specification → regional availability and Mainland governance;
- Validation Plan → research and measurement.

### Level 5 — This review

This review controls any unresolved conflict across Levels 2–4 until formal revisions are published.

---

## 7. Canonical Product Definition

The controlling product definition is:

> **AI ARK is a trusted AI capability discovery and intelligence platform that transforms fragmented sources into evidence-backed capability dossiers, rankings, workflows, and machine-readable recommendations.**

AI ARK begins with Skills.

The architecture may support additional Resource types, but the validation product should not publicly position itself as a complete Skills, MCP, Agents, Plugins, Workflows, and Tools marketplace on day one.

### 7.1 Initial user-facing proposition

> **Find the right AI Skill for the job.**

### 7.2 Long-term category

> **AI Capability Discovery and Intelligence Platform**

### 7.3 Long-term infrastructure proposition

> **Structured capability intelligence for humans and AI systems**

---

## 8. Canonical Validation-MVP Scope

The package must use the following scope classification.

# 8.1 Public Validation MVP

The public validation MVP includes:

- homepage;
- task-oriented search;
- Skill directory;
- five to eight categories;
- Resource detail pages;
- creator profiles;
- category Ranking v0;
- Source Verified status;
- limited verification-report examples;
- three to five Curated Workflows;
- comments;
- structured usage reviews;
- selected regional-availability labels;
- GitHub source links and installation actions;
- saved Resources or workflows if authentication is ready;
- public ranking and verification methodology pages.

# 8.2 Controlled Validation Pilots

The following are private, invited, feature-flagged, or manually operated pilots:

- one or two AI ARK Labs campaigns;
- five Functionally Tested evaluations;
- limited Quality Verified evaluations;
- verified installation and deployment evidence;
- a basic AI-Generated Path prototype;
- private read API;
- private AI ARK MCP prototype;
- FounderOS Connector prototype;
- Mainland installation and runtime testing;
- creator launch-program applications;
- AI ARK First or Exclusive Beta discussions;
- limited authorized mirror pilot if rights are independently confirmed.

# 8.3 Architecture-Only Foundations

The data model and interfaces should leave room for:

- MCP servers;
- Agents;
- Plugins;
- Connectors;
- public API plans;
- enterprise private Resources;
- advanced workflow branching;
- reviewer reputation;
- regional editions;
- paid evaluation operations;
- workflow execution integration.

These foundations do not need complete public product interfaces in the validation MVP.

# 8.4 Post-MVP Products

Post-MVP includes:

- broad MCP and Agent catalogues;
- public Labs marketplace;
- creator analytics subscriptions;
- public API billing;
- public MCP;
- automated collection;
- automated change monitoring at scale;
- broad China editions;
- enterprise governance;
- dynamic personalized workflows at scale;
- paid launch programs;
- advanced reviewer reputation.

# 8.5 Prohibited in MVP

The following remain prohibited:

- automatic publication;
- automatic third-party code execution;
- automatic installation;
- credential brokerage;
- marketplace transactions;
- paid ranking;
- purchased verification outcomes;
- permanent creator exclusivity;
- unauthorized mirroring;
- VPN, proxy, relay, or access-control circumvention;
- broad general AI news operation;
- public generative-AI functionality in Mainland China before compliance approval.

---

## 9. Canonical Terminology

The following definitions control the package.

### 9.1 Resource

The enduring logical identity of a capability.

Examples:

- one Skill;
- one MCP server;
- one Agent;
- one Plugin;
- one Workflow.

A GitHub repository is normally a Source, not automatically a Resource.

### 9.2 ResourceVersion

An immutable, evaluable release or source snapshot of a Resource.

### 9.3 Source

The canonical or supporting location from which evidence is acquired.

Examples:

- GitHub repository;
- official website;
- package registry;
- documentation.

### 9.4 Capability

What a Resource can do.

### 9.5 Task

What the user wants accomplished.

### 9.6 Workflow

A Resource of type `WORKFLOW` with a workflow-specific extension containing steps, edges, expected outputs, alternatives, approvals, and evidence.

### 9.7 Collection

An editorial grouping of Resources without execution order.

### 9.8 Claim

An atomic statement about a Resource, version, creator, compatibility, behavior, or availability.

### 9.9 Evidence

A source item that supports, refutes, qualifies, or contextualizes a Claim.

### 9.10 Comment

A discussion contribution that has no direct ranking weight.

### 9.11 Issue Report

A structured report of a possible failure, risk, inaccuracy, or regional problem.

### 9.12 Usage Review

A version-bound account of attempting to install, use, test, or deploy a Resource.

### 9.13 Verified Usage

Evidence that a specific installation, deployment, beta test, or production-use event occurred.

### 9.14 Resource Verification

AI ARK’s scoped evaluation of a ResourceVersion.

Levels:

- Source Verified;
- Functionally Tested;
- Quality Verified;
- Proven in Use;
- AI ARK Verified.

### 9.15 Creator Verification

Confirmation of creator identity or authority.

It is not Resource Verification.

### 9.16 Launch Relationship

A commercial or distribution relationship.

Examples:

- AI ARK First;
- Exclusive Beta;
- Creator-Authorized AI ARK Page;
- AI ARK Launch Partner.

It is not verification or ranking.

---

## 10. Canonical Resource Identity Decision

# Decision CD-01 — One independently usable capability equals one Resource.

A repository may contain:

- one Resource;
- several Resources;
- a bundle of Resources;
- documentation for a Resource;
- a mirror.

The Resource Intelligence Pipeline must not assume:

```text
one repository = one Resource
```

### 10.1 Multiple Skills in one repository

Create:

- one Resource per independently installable, nameable, and versionable Skill;
- one shared Source;
- optional `BUNDLES` or `INCLUDES` relationships.

### 10.2 Repository-level projects

A repository may be a Resource when the repository itself is the unit users install or use.

### 10.3 Why this decision matters

It prevents:

- ranking a bundle as if it were one Skill;
- mixing reviews across independent capabilities;
- ambiguous versioning;
- inaccurate installation instructions;
- duplicate creator pages.

---

## 11. Canonical Workflow Identity Decision

# Decision CD-02 — Workflow is a Resource subtype with a dedicated extension.

The Capability Graph currently defines both:

- `Resource.resource_type = WORKFLOW`;
- a separate `Workflow` entity with `resource_id`.

This is valid only if interpreted as:

```text
Resource
└── WorkflowExtension
    ├── WorkflowVersion
    ├── WorkflowStep
    └── WorkflowEdge
```

The `Workflow` record must not create a second independent public identity.

### 11.1 Identity rule

- one public Resource ID;
- one public slug;
- one canonical creator relationship;
- one ResourceVersion lineage;
- workflow-specific tables extend that identity.

### 11.2 API rule

Workflow endpoints may expose workflow-specific objects, but every Workflow response must identify the canonical Resource ID.

---

## 12. Canonical Version Decision

# Decision CD-03 — “Current” must be split into three meanings.

The package currently uses “current version” in ways that can conflict during update review.

The canonical model must include:

```text
current_published_version_id
latest_detected_version_id
latest_verified_version_id
```

### 12.1 Current published version

The version approved and currently shown publicly.

### 12.2 Latest detected version

The newest upstream release or snapshot found by monitoring.

It may still be unreviewed.

### 12.3 Latest verified version

The newest version holding active AI ARK verification.

### 12.4 Public behavior

When a newer upstream version exists:

> A newer version has been detected and is under review.

The older verified version may remain visible, but verification must not silently transfer.

---

## 13. Canonical State Model

The package contains several valid but overlapping status sets.

They must be treated as separate domains.

# 13.1 Resource Publication Status

```text
CANDIDATE
DRAFT
UNDER_REVIEW
PUBLISHED
HIDDEN
ARCHIVED
REMOVED
LEGAL_HOLD
```

This controls whether the Resource identity is publicly available.

# 13.2 Resource Maturity

```text
EXPERIMENTAL
ALPHA
BETA
RELEASE_CANDIDATE
STABLE
DEPRECATED
ARCHIVED
UNKNOWN
```

This describes product maturity.

# 13.3 ResourceVersion Editorial Status

```text
DISCOVERED
ANALYZING
DRAFT
IN_REVIEW
APPROVED
PUBLISHED
SUPERSEDED
REJECTED
```

This describes editorial processing of one version.

# 13.4 Pipeline Job Status

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

This describes one ingestion job.

# 13.5 Verification Status

```text
REQUESTED
ELIGIBILITY_REVIEW
SCHEDULED
IN_PROGRESS
AWAITING_EVIDENCE
REMEDIATION_REQUIRED
DECISION_READY
AWARDED
DENIED
EXPIRED
REVOKED
APPEALED
SUPERSEDED
```

# 13.6 Update Status

`UPDATE_DETECTED` and `RE_REVIEW_REQUIRED` are not Resource maturity states.

They should be:

- lifecycle events;
- monitoring flags;
- review tasks.

# 13.7 Workflow Status

Workflow publication uses the Resource publication status.

Workflow-specific state should be limited to:

```text
CURATED
TESTING
VERIFIED
UPDATE_REQUIRED
```

as an extension status.

### 13.8 Required amendment

All future schemas and prototypes must avoid a single generic `lifecycle_status` field whose meaning changes by context.

---

## 14. Canonical Ranking Decisions

# 14.1 Quality Score and Community Score remain separate

Public pages may contain:

- AI ARK Quality Score;
- Community Experience Summary.

They must not use one unlabeled star score as a substitute for both.

### AI ARK Quality Score

Evidence-based evaluation under the Ranking Standard.

### Community Experience Summary

Weighted user-review aggregation for a ResourceVersion.

# 14.2 Missing evidence is not zero performance

For new or niche Resources:

- a missing component must not automatically equal zero;
- the score should be provisional;
- Evidence Confidence should fall;
- ordinal ranking may be withheld;
- required dimensions may be handled through category methodology.

# 14.3 Public score format

Recommendation:

- internal score: decimal;
- public score: rounded integer;
- API: decimal plus methodology version.

# 14.4 No arbitrary manual score override

The Graph and Ranking documents allow a manual adjustment field.

Controlling rule:

- administrators may correct invalid input data;
- Trust and Safety may suspend eligibility;
- methodology bugs may trigger recalculation;
- arbitrary opinion-based score adjustment is prohibited.

If a correction affects a score, the system should record:

- corrected input;
- reason;
- actor;
- recalculated snapshot.

The public methodology should not depend on discretionary score editing.

# 14.5 Best Verified segment

`Best Verified` should require at least:

- Quality Verified;
- active current-version verification;
- sufficient Evidence Confidence;
- no severe unresolved risk.

Source Verified alone is insufficient for this segment.

# 14.6 Regional ranking

Global Quality Score should remain global.

Region-specific discovery may produce:

- Regional Suitability;
- Regional Availability filter;
- Regional Fit Rank.

It should not silently rewrite global Category Rank.

---

## 15. Canonical Verification Decisions

# 15.1 Creator identity and Resource verification are separate

Use distinct labels:

```text
Creator Identity Verified
Resource Source Verified
Resource Functionally Tested
Resource Quality Verified
Resource Proven in Use
Resource AI ARK Verified
```

# 15.2 Verified usage is not Resource verification

These labels:

- Verified installation;
- Verified deployment;
- Verified beta test;
- Verified production use;

describe evidence events.

They are not equivalent to:

- Functionally Tested;
- Proven in Use;
- AI ARK Verified.

# 15.3 Verification does not transfer automatically

Verification must not automatically transfer across:

- major versions;
- forks;
- China editions;
- mirrors;
- ownership changes.

# 15.4 Verification pilots

The validation MVP should publicly demonstrate only a small number of verification reports.

It should not attempt broad verification operations before:

- test methods are calibrated;
- user comprehension is proven;
- operating cost is measured;
- legal language is reviewed.

---

## 16. Canonical Feedback Model

The Community Specification contains useful but partially overlapping forms.

The canonical model is:

```text
Comment / Question
Issue Report
Usage Review
Evidence Submission
Creator Response
Moderation Report
```

### 16.1 Comment or Question

Discussion only.

No direct ranking weight.

### 16.2 Issue Report

A structured claim that something failed, is inaccurate, unsafe, or unavailable.

May trigger investigation.

### 16.3 Usage Review

A structured, version-bound experience.

May contribute to ranking after weighting.

### 16.4 Evidence Submission

A private or public artifact that may verify a Review or Issue.

### 16.5 Compatibility problems

A statement such as:

> It does not work on Windows.

should be submitted as:

- an Issue Report;
- or a Usage Review containing a failed compatibility outcome.

It should not exist as an ambiguous comment type that bypasses evidence capture.

### 16.6 Creator Update

Creator-authored release information is not a Comment.

It should use the Creator Update model.

---

## 17. Canonical Moderation Model

Use one shared moderation status across comments, reviews, issues, creator updates, and Labs communication:

```text
PENDING
PUBLISHED
LIMITED
REDACTED
REMOVED
RESTORED
LEGAL_HOLD
```

Investigation status should remain separate.

### 17.1 No creator deletion authority

Creators may:

- respond;
- dispute;
- report;
- submit evidence.

Only AI ARK moderation authorities may:

- limit;
- redact;
- remove;
- restore.

---

## 18. Creator and Launch Consistency Decisions

# 18.1 Creator-Authorized AI ARK Page

The phrase `Official AI ARK Page` may be misunderstood as AI ARK owning or officially certifying the Resource.

Recommended public phrase:

> **Creator-Authorized AI ARK Page**

The shorter internal program name may remain `OFFICIAL_PAGE`.

# 18.2 Exclusive Beta scope

Exclusive Beta can apply to:

- tester recruitment;
- beta access;
- feedback operations;
- regional pilot;
- launch window.

It cannot create meaningful exclusivity over an already-public open-source repository unless the agreement defines a different unreleased version or service.

# 18.3 Permanent exclusivity

Remains outside product strategy.

# 18.4 Launch labels and trust labels

Launch labels should use a commercial or distribution visual family.

Verification labels should use a trust visual family.

They must not share badge shape, color, or placement in a way that suggests equivalence.

# 18.5 Creator analytics

Basic creator analytics belong in the controlled validation pilot.

A full creator analytics product is post-MVP.

---

## 19. Labs Scope Decision

# Decision CD-04 — Labs is a controlled pilot, not a full public marketplace in the initial MVP.

The UX Specification places Labs in primary navigation.

The PRD and validation plan limit Labs to one or two campaigns.

The controlling decision is:

### Prototype

The prototype should include a Labs screen because the concept must be tested.

### Concierge/private validation

Labs may be available through:

- invitation;
- direct link;
- creator dashboard;
- feature flag.

### Initial public validation launch

Primary navigation inclusion is conditional on:

- at least two successful campaigns;
- manageable moderation;
- meaningful tester demand;
- no severe safety or privacy failure.

Until then, the public navigation may show:

- “Beta Testing” under Discover;
- or no Labs primary item.

---

## 20. Workflow Scope Decision

# Decision CD-05 — Public MVP uses Curated Workflows; dynamic paths remain a controlled prototype.

### Public validation MVP

- three to five Curated Workflows;
- one may become AI ARK Verified after an end-to-end test.

### Controlled pilot

- AI-Generated Path;
- `/resolve-task`;
- FounderOS workflow resolution.

### Public dynamic generation

Deferred until:

- intent quality is validated;
- workflow-resource matching is reliable;
- users understand generated versus verified;
- security and privacy controls exist;
- Mainland generative-AI compliance is cleared for any Mainland public service.

---

## 21. API and MCP Scope Decision

# Decision CD-06 — The validation API is private or partner-access only.

The API Specification describes a broad public API.

The PRD describes a basic read boundary.

The controlling MVP interpretation is:

### Required

- stable internal `/v1` contracts;
- API key authentication;
- Resource read;
- search;
- ranking;
- verification;
- workflow read;
- regional availability;
- changes;
- private `resolveTask`;
- FounderOS Connector prototype.

### Controlled pilot

- AI ARK MCP;
- external design-partner access.

### Deferred public product

- public self-service API registration;
- paid API plans;
- public MCP directory listing;
- broad unauthenticated access;
- webhooks.

### Why

AI ARK must first prove:

- data quality;
- schema stability;
- provenance usefulness;
- operational cost;
- abuse controls.

---

## 22. Search, Discover, and Resolve-Task Separation

The API defines three overlapping operations.

The canonical separation is:

### `/search`

Deterministic retrieval of Resources, creators, categories, and workflows from a query and filters.

### `/discover`

Recommendation of individual Resources for one task under structured constraints.

It does not decompose a broad multi-step goal.

### `/resolve-task`

Interprets a broad goal, decomposes it, and returns a Workflow or Path.

### 22.1 MVP priority

1. `/search`
2. Resource retrieval
3. Workflow retrieval
4. private `/resolve-task`
5. `/discover` only if it adds measurable value beyond search

`/discover` may be deferred to avoid redundant API behavior.

---

## 23. API Identity Decision

# Decision CD-07 — Machine APIs use stable IDs; web pages use slugs.

### Public web

```text
/skills/{slug}
```

### API

```text
/v1/resources/{resourceId}
```

### Optional resolver

```text
GET /v1/resource-resolutions/by-slug/{slug}
```

An API should not ambiguously accept either ID or slug in the same path unless behavior is precisely documented.

---

## 24. Region Identifier Decision

The package uses:

- `mainland_china`;
- `mainland-china`;
- Mainland China;
- country and custom Region entities.

The canonical convention should be:

### Internal stable ID

Opaque:

```text
rgn_...
```

### Public canonical code

```text
CN-MAINLAND
```

### URL slug

```text
mainland-china
```

### API filter value

```text
cn-mainland
```

### Display label

```text
Mainland China
```

Other countries may use ISO country codes where the entire country is the relevant region.

---

## 25. Mainland Scope Decision

# Decision CD-08 — Mainland availability validation does not authorize a Mainland public product launch.

The Mainland Specification correctly defines a substantial compliance and infrastructure program.

The validation MVP should separate two activities.

### 25.1 Availability intelligence validation

May proceed through:

- globally hosted prototype;
- private test environment;
- manual network and installation testing;
- Mainland user interviews;
- Resource metadata;
- regional alternatives.

### 25.2 Mainland public service launch

Requires separate authorization after:

- legal entity decision;
- hosting decision;
- ICP/app-filing assessment;
- algorithm assessment;
- generative-AI assessment;
- content-labelling implementation;
- regional data design;
- moderation readiness;
- legal sign-off.

### 25.3 Mirror pilot

No mirror should be publicly released during validation unless:

- rights are confirmed;
- security checks pass;
- the operating entity approves;
- legal review confirms the delivery path.

### 25.4 Public generative path

Dynamic public generation should remain disabled in a Mainland public edition until the required compliance path is complete.

---

## 26. News Scope Decision

All documents consistently defer a general news operation.

The controlling position is:

### Validation MVP

May publish:

- Resource updates;
- release updates;
- verification changes;
- workflow changes;
- official creator announcements.

### Not included

- general AI news;
- independent current-affairs reporting;
- broad news aggregation;
- “breaking news” generation.

A future `AI ARK Daily` should be evaluated after discovery retention is proven.

---

## 27. Metrics and Phase Consistency

The Validation Plan combines prototype, concierge, private-MVP, and public-volume thresholds.

The following phase mapping controls.

### 27.1 Prototype phase

Measures:

- task completion;
- comprehension;
- usability;
- confidence;
- misunderstanding.

Sample:

```text
15–25 users
```

No traffic-rate gate is required.

### 27.2 Concierge phase

Measures:

- time savings;
- qualitative value;
- action;
- creator interest;
- editorial effort.

Sample:

```text
30–50 Resources
15–30 users
5–10 creators
```

### 27.3 Technical corpus phase

Measures:

- pipeline precision;
- review time;
- evidence coverage;
- duplicates;
- errors.

Sample:

```text
100 Resources
```

### 27.4 Private MVP phase

Measures:

- funnels;
- retention;
- community participation;
- workflow engagement;
- API repetition.

### 27.5 1,000-session threshold

The `1,000 qualified sessions` threshold applies only to private/public MVP discovery validation.

It is not a prerequisite for prototype or concierge decisions.

---

## 28. Canonical Validation Gates

The package uses many valid metrics.

The controlling gate hierarchy is:

# Gate 1 — User Discovery

Required for engineering GO.

- users find relevant Resources;
- users act;
- users report time or confidence benefit.

# Gate 2 — Editorial Economics

Required for engineering GO.

- drafts are accurate;
- review time is manageable;
- evidence coverage is complete.

# Gate 3 — Trust Comprehension

Required for public ranking and verification.

- score, confidence, verification, and commercial labels are understood.

# Gate 4 — Differentiated Feature Pull

At least one must show strong evidence:

- workflows;
- creator launch/testing;
- community evidence;
- Mainland intelligence;
- agent API.

# Gate 5 — Guardrails

All required.

- no automatic publication;
- no unauthorized mirror;
- no private-evidence leak;
- no hidden paid ranking;
- no source execution.

# Gate 6 — Commercial or Strategic Pull

Required before a large standalone operating program.

May be:

- revenue;
- design partner;
- API integration;
- creator network;
- strategic FounderOS value.

---

## 29. Acceptance-Criteria Interpretation

Several specifications use aspirational targets as if they are implementation acceptance criteria.

The controlling distinction is:

### 29.1 Product acceptance criterion

A function works according to its contract.

Example:

> Every public ranking identifies MethodologyVersion.

### 29.2 Validation target

A market or operating hypothesis to test.

Example:

> Median review time ≤5 minutes.

### 29.3 Service-level target

An operational objective.

Example:

> Search p95 ≤1.5 seconds.

### 29.4 Legal or safety gate

A mandatory condition.

Example:

> No public authorized-mirror label without rights evidence.

These categories should not be mixed in milestone acceptance criteria.

---

## 30. Source-of-Truth Matrix

| Concept | Controlling source |
|---|---|
| Product mission and category | Product Vision |
| MVP inclusion/exclusion | MVP PRD + this Review |
| Public page structure | UX Specification |
| Resource identity and relationships | Capability Graph |
| Source acquisition and publication | Pipeline Specification |
| Quality Score and Resource Verification | Ranking and Verification Standard |
| Comments, Reviews, and verified usage | Community Specification |
| Creator claims and Labs | Creator and Labs Specification |
| Task decomposition and workflows | Workflow Specification |
| External machine contracts | API Specification |
| Mainland availability and regional governance | Mainland Specification |
| Research and success gates | Validation Plan |
| Cross-document conflict | This Review |

---

## 31. Cross-Domain Traceability

### 31.1 Resource page

Requires:

- Resource and ResourceVersion from Graph;
- draft from Pipeline;
- Quality Score from Ranking;
- VerificationRecord from Verification;
- reviews from Community;
- creator identity from Creator;
- workflow links from Workflow;
- regional status from Mainland;
- machine representation from API.

### 31.2 Ranking

Requires:

- canonical versions;
- claims and evidence;
- reviews;
- test runs;
- creator responsiveness;
- risk status;
- methodology version.

### 31.3 Verification

Requires:

- fixed ResourceVersion;
- creator/source identity;
- test evidence;
- community usage evidence;
- risk review;
- expiry and update monitoring.

### 31.4 Workflow

Requires:

- Task taxonomy;
- Capability relationships;
- ResourceVersion selection;
- ranking;
- verification;
- region;
- alternatives;
- reviews;
- approval points.

### 31.5 FounderOS Connector

Consumes:

- Resource;
- Workflow;
- Ranking;
- Verification;
- Regional Availability;
- Changes.

It does not consume:

- private evidence;
- editorial drafts;
- internal moderation;
- direct database access.

---

## 32. Duplication Review

The documents deliberately repeat strategic principles.

This is acceptable for standalone readability, but implementation must not create duplicate logic.

### 32.1 Areas of repeated logic

- verification levels;
- availability levels;
- ranking labels;
- creator verification;
- workflow classes;
- evidence types;
- risk statuses;
- API examples;
- lifecycle states.

### 32.2 Resolution

Create central registries before engineering:

- `AI ARK Glossary and Terminology Registry`;
- `AI ARK Canonical Enum Registry`;
- `AI ARK Policy and Methodology Registry`;
- generated API/schema definitions.

Domain documents may explain concepts but should reference the canonical registry.

---

## 33. Missing Requirements Before Prototype

The package is sufficient for prototype design, but the prototype brief must still define:

1. exact launch categories;
2. exact seed Resources;
3. three initial workflows;
4. one representative verification report;
5. one Mainland availability example;
6. whether Labs appears in primary navigation;
7. public score presentation;
8. visual distinction among:
   - identity;
   - launch relationship;
   - verified usage;
   - Resource verification;
9. mobile Resource-page hierarchy;
10. the AI ARK visual direction.

These belong in the next prototype-design document.

---

## 34. Missing Documents Before Engineering

The following are not required to start prototype design.

They are required before production engineering authorization.

### 34.1 Glossary and Canonical Enum Registry

Defines:

- terms;
- entity names;
- state domains;
- public labels;
- API enum names.

### 34.2 System Architecture

Defines:

- services;
- deployment;
- data boundaries;
- search;
- jobs;
- storage;
- APIs;
- regional architecture.

### 34.3 Security and Threat Model

Defines:

- source ingestion threats;
- prompt injection;
- private evidence;
- API;
- MCP;
- creator claims;
- Labs;
- mirrors;
- Mainland synchronization.

### 34.4 Role and Authorization Matrix

Defines:

- user;
- creator;
- tester;
- editor;
- moderator;
- verifier;
- administrator;
- API client;
- service.

### 34.5 Data Retention and Privacy Matrix

Defines final retention and deletion behavior across systems.

### 34.6 Editorial and Content Rights Policy

Defines:

- source use;
- screenshots;
- summaries;
- takedown;
- creator corrections;
- mirrors;
- translations.

### 34.7 Incident and Operational Readiness

Defines:

- source takeover;
- malicious Resource;
- ranking error;
- evidence leak;
- mirror compromise;
- regional outage.

These should be produced as part of the Engineering Kit after validation scope freeze.

---

## 35. Issue Register

# P0 — Must be resolved before engineering

| ID | Issue | Resolution | Status |
|---|---|---|---|
| P0-01 | Resource lifecycle, maturity, editorial, and pipeline states overlap | Adopt the canonical state domains in Section 13 | Resolved by this Review |
| P0-02 | Workflow exists as both Resource type and separate identity | Workflow is a Resource subtype with extension tables | Resolved by this Review |
| P0-03 | “Current version” is ambiguous during upstream updates | Split published, detected, and verified version pointers | Resolved by this Review |
| P0-04 | Repository-to-Resource cardinality is unclear | One independently usable capability equals one Resource | Resolved by this Review |
| P0-05 | Public MVP scope includes too many advanced systems | Adopt Public/Pilot/Foundation/Post-MVP classification | Resolved by this Review |
| P0-06 | API appears public and broad before schema validation | Use private partner API and MCP during validation | Resolved by this Review |
| P0-07 | Mainland availability could be read as launch authorization | Separate intelligence validation from Mainland public launch | Resolved by this Review |
| P0-08 | Dynamic generated workflows conflict with public MVP and Mainland compliance | Keep generated paths private/controlled until validated | Resolved by this Review |
| P0-09 | Creator, launch, verified usage, and Resource verification labels may be confused | Use distinct semantic and visual systems | Prototype must demonstrate |
| P0-10 | Manual ranking adjustment can undermine objectivity | Correct inputs or suspend eligibility; no opinion-based score override | Resolved by this Review |

# P1 — Must be resolved before clickable prototype sign-off

| ID | Issue | Resolution | Status |
|---|---|---|---|
| P1-01 | Labs primary-navigation status is inconsistent | Prototype both discoverable and non-primary variants; public nav is conditional | Open for testing |
| P1-02 | Public Quality Score format is undefined | Prototype rounded integer with visible Confidence; API retains decimal | Resolved for prototype |
| P1-03 | Category list is provisional | Select five to eight categories based on seed corpus | Open |
| P1-04 | “Official AI ARK Page” may imply certification | Use “Creator-Authorized AI ARK Page” publicly | Resolved |
| P1-05 | Review, Issue, and compatibility-report pathways overlap | Use canonical feedback model in Section 16 | Resolved |
| P1-06 | Region codes vary across documents | Adopt `CN-MAINLAND`, `mainland-china`, and `cn-mainland` convention | Resolved |
| P1-07 | Best Verified eligibility is too weak in one description | Require active Quality Verified status | Resolved |
| P1-08 | Community score and Quality Score may be confused | Display separately with distinct names | Prototype must demonstrate |
| P1-09 | Search, Discover, and Resolve Task overlap | Apply endpoint separation in Section 22 | Resolved |
| P1-10 | Mainland four-level panel may overload cards | Cards show compact status; detail page shows all four levels | Prototype must demonstrate |

# P2 — May be resolved during validation or Engineering Kit

| ID | Issue | Resolution direction |
|---|---|---|
| P2-01 | Reviewer reputation has no final model | Keep internal signals only during MVP |
| P2-02 | Category-specific ranking weights are uncalibrated | Use default methodology and validate |
| P2-03 | Proven in Use thresholds may disadvantage niche Resources | Support category-specific exceptions with disclosure |
| P2-04 | Webhook timing is undefined | Polling only in validation |
| P2-05 | Regional rank model is incomplete | Use Regional Fit, not a modified global score |
| P2-06 | Exact verification expiry varies by category | Keep defaults configurable and methodology-versioned |
| P2-07 | Search-query privacy needs final retention policy | Define in Privacy Matrix before engineering |
| P2-08 | Multiple-language publication workflow needs detailed operations | Validate English-first with selected reviewed Chinese content |
| P2-09 | Commercial pricing remains undefined | Test offers during validation |
| P2-10 | Final public brand remains unclear | Conduct brand clearance before public launch |

---

## 36. Risk of Overbuilding

The package contains a plausible long-term platform with:

- directory;
- search;
- ranking;
- verification;
- reviews;
- Labs;
- creator network;
- workflows;
- API;
- MCP;
- China operations;
- enterprise potential.

Building all of this before discovery validation would be a strategic error.

The validation product must preserve the differentiated thesis while minimizing operational systems.

### 36.1 Minimum differentiating test

AI ARK cannot be tested as a generic directory.

The minimum meaningful test requires:

```text
Excellent Resource pages
+
Task-oriented search
+
Ranking explanation
+
One verification example
+
Curated workflows
+
Source-grounded ingestion
```

### 36.2 Systems that may remain manual

During validation:

- verification;
- Labs;
- creator claims;
- Mainland status;
- workflow curation;
- ranking review;
- moderation;
- regional alternatives.

Manual operation is acceptable when the purpose is to validate value and workflow before automation.

---

## 37. Prototype Authorization Scope

The clickable prototype should include twelve core screens.

1. Homepage  
2. Task-oriented search results  
3. Category ranking  
4. Resource detail  
5. Ranking explanation  
6. Verification report  
7. Creator profile  
8. Curated Workflow  
9. Labs campaign  
10. Structured usage review  
11. GitHub URL ingestion  
12. Editorial review workspace  

Recommended additional screens:

13. Mainland availability detail  
14. Creator claim flow  
15. Mobile Resource detail  
16. Private AI-Generated Path result  

### 37.1 Prototype must demonstrate

- calm editorial quality comparable to the strongest ColaSkill patterns;
- original AI ARK visual identity;
- visible but restrained trust information;
- score versus confidence;
- identity versus verification;
- launch relationship versus ranking;
- current versus under-review version;
- global versus Mainland availability;
- curated versus generated workflow;
- creator versus AI ARK editorial voice.

---

## 38. Prototype Research Questions

The prototype should answer:

1. Does the broad term “capability” confuse users during the Skills-first launch?
2. Does the Quality Score help or overwhelm?
3. Can users understand Evidence Confidence?
4. Do users open verification scope?
5. Is the Resource detail page too long?
6. Which information belongs above the fold?
7. Do users understand Mainland availability levels?
8. Do users prefer Curated Workflow over a Resource list?
9. Does Labs deserve primary navigation?
10. Can creators understand what they control?
11. Can users distinguish creator-authorized content from AI ARK evaluation?
12. Does the editorial console make evidence review efficient?

---

## 39. Document Remediation Plan

The twelve documents do not need immediate complete rewrites before prototype design.

Instead:

### 39.1 Immediate controlling artifact

This review governs prototype work.

### 39.2 Prototype-stage addendum

Create a concise:

`AI ARK Prototype Scope and Canonical Decisions v1.0.md`

It should extract:

- MVP scope;
- terminology;
- status labels;
- screen list;
- prototype test questions.

### 39.3 Post-validation harmonization

After prototype and concierge findings:

- revise the MVP PRD to v1.1;
- revise UX Specification to v1.1;
- revise Graph Specification to v1.1;
- revise API and Workflow scope;
- publish canonical Glossary and Enum Registry.

This prevents unnecessary rewriting before evidence is collected.

---

## 40. Final Consistency Scorecard

| Dimension | Score | Finding |
|---|---:|---|
| Strategic coherence | 9.2/10 | Strong and consistent |
| Product differentiation | 9.0/10 | Clear beyond-directory thesis |
| MVP scope discipline | 6.2/10 | Over-expanded before this review |
| Terminology consistency | 7.1/10 | Strong concepts, several naming collisions |
| Data-model coherence | 8.3/10 | Robust graph; status and workflow identity needed clarification |
| Trust-system coherence | 8.7/10 | Ranking, verification, and evidence are well separated conceptually |
| Creator/community coherence | 8.1/10 | Strong, with overlapping feedback pathways corrected |
| Workflow/API coherence | 7.8/10 | Good architecture; public scope required reduction |
| Mainland sequencing | 7.4/10 | Thorough but must remain a separate launch gate |
| Validation readiness | 8.5/10 | Strong plan with phase mapping clarified |
| Prototype readiness | **8.8/10** | Ready under this review |
| Engineering readiness | **5.8/10** | Not ready until validation and architecture kit |

---

## 41. Final Decision

# CONDITIONAL GO — CLICKABLE PROTOTYPE AUTHORIZED

The Product Definition Package is sufficiently coherent to proceed to prototype design.

The authorization is limited to:

- prototype scope definition;
- visual and interaction design;
- prototype content;
- usability testing;
- concierge validation preparation;
- seed Resource selection;
- manual ranking and verification examples;
- manual workflow examples;
- private ingestion-console prototype.

The authorization does not include:

- production repository creation;
- full backend development;
- public API launch;
- public MCP launch;
- public Mainland launch;
- mirroring;
- marketplace payments;
- automatic execution;
- broad Labs operations;
- large-scale ingestion.

---

## 42. Required Next Deliverable

The next deliverable should be:

# `AI ARK Clickable Prototype Design Brief v1.0.md`

It should define:

- prototype objective;
- target users;
- final prototype scope;
- canonical terminology;
- selected categories;
- representative seed Resources;
- representative workflows;
- screen-by-screen content;
- interaction flows;
- responsive states;
- trust-label visual rules;
- AI ARK original visual directions;
- ColaSkill benchmark principles;
- Figma component requirements;
- prototype test tasks;
- acceptance criteria;
- handoff requirements.

After that brief:

```text
Clickable Figma prototype
↓
Moderated prototype testing
↓
Concierge validation
↓
MVP scope freeze
↓
Engineering Kit
```

---

## 43. Final Review Statement

The AI ARK Product Definition Package describes a credible and differentiated product.

Its strongest thesis is not:

> Build a larger directory.

It is:

> Build the trusted evidence and workflow layer between an expanding supply of AI capabilities and the humans or agents trying to use them.

The package is ready for prototype validation because this review has established:

- one product definition;
- one validation-MVP boundary;
- one Resource identity model;
- one version model;
- separate state domains;
- separate ranking, verification, review, and commercial semantics;
- a controlled Labs scope;
- a controlled agent API scope;
- a separate Mainland launch gate;
- explicit engineering preconditions.

The next work should test whether users understand and value this system before the organization commits to building it.

---

**End of document**
