# AI ARK Mainland Availability Specification v1.0

**Document status:** Mainland China availability, localization, and regional-governance baseline  
**Version:** 1.0  
**Date:** August 2, 2026  
**Working product name:** AI ARK  
**Product stage:** Product Definition and Validation  
**Decision basis:** `AI ARK Worthiness Review v1.1.md`  
**Strategic foundation:** `AI ARK Product Vision and Positioning v1.0.md`  
**Product requirements:** `AI ARK MVP PRD v1.0.md`  
**UX foundation:** `AI ARK Information Architecture and UX Specification v1.0.md`  
**Data foundation:** `AI ARK Resource and Capability Graph Specification v1.0.md`  
**Pipeline foundation:** `AI ARK Resource Intelligence Pipeline Specification v1.0.md`  
**Trust foundation:** `AI ARK Ranking and Verification Standard v1.0.md`  
**Community foundation:** `AI ARK Community Review and Usage Evidence Specification v1.0.md`  
**Creator foundation:** `AI ARK Creator and Labs Specification v1.0.md`  
**Workflow foundation:** `AI ARK Workflow and Task Resolution Specification v1.0.md`  
**API foundation:** `AI ARK API and Connector Specification v1.0.md`  
**Primary audience:** Product, legal, compliance, China operations, trust and safety, editorial, security, infrastructure, data, API, creator relations, and engineering teams  

---

## 1. Purpose

This specification defines how AI ARK determines, communicates, improves, and continuously monitors whether an AI Resource can be discovered, obtained, installed, and operated in Mainland China.

It establishes:

- the four-level Mainland availability model;
- source and documentation accessibility;
- artifact accessibility;
- installation accessibility;
- runtime verification;
- dependency mapping;
- rights and license review;
- authorized mirrors;
- creator-provided China editions;
- domestic and regionally available alternatives;
- Mainland infrastructure;
- global/Mainland data separation;
- cross-border data controls;
- algorithm-recommendation governance;
- public generative-AI governance;
- AI-generated content labelling;
- internet-information-service filing and licensing gates;
- news-service boundaries;
- user-generated-content moderation;
- synchronization and change monitoring;
- public labels;
- API contracts;
- operational review;
- explicit anti-circumvention requirements;
- validation metrics and acceptance criteria.

This specification is a product and engineering governance baseline. It is **not legal advice**. AI ARK must obtain qualified PRC legal and regulatory review before operating a public Mainland service, hosting redistributed artifacts, providing public generative-AI functions, or processing regulated data.

---

## 2. Strategic Objective

AI ARK should not treat “available in China” as a binary claim.

A Resource can be:

- understandable but not downloadable;
- downloadable but not installable;
- installable but unable to reach required APIs;
- operational only through a creator-provided China edition;
- fully usable through a verified domestic path;
- temporarily unavailable because an upstream dependency changed.

The product objective is:

> **Give Mainland users accurate, evidence-backed, lawful information about what can be accessed, installed, and run—and provide authorized or practical alternatives when the original Resource cannot be used.**

This creates differentiated value because AI ARK can answer:

- Can I read about this Resource?
- Can I lawfully download it?
- Can I install its dependencies?
- Can it complete its primary task in Mainland China?
- Is a domestic mirror authorized and current?
- Does a China edition exist?
- Which alternative solves the same task?
- When was this status last checked?
- What changed since the last check?

---

## 3. Scope

### 3.1 Included

This specification applies to:

- public AI ARK Resource pages;
- Skills;
- MCP servers;
- Agents;
- Plugins;
- Workflows;
- source repositories;
- packages;
- documentation;
- media and examples;
- dependencies;
- external APIs;
- creator submissions;
- authorized mirrors;
- China editions;
- task-resolution results;
- workflow recommendations;
- AI ARK API and MCP responses;
- community regional reports;
- Labs regional testing;
- Mainland user and creator data.

### 3.2 Deferred or separately governed

- full legal opinions for individual Resource licenses;
- nationwide regulated-content classification;
- telecommunications licensing applications;
- security assessment submissions;
- algorithm filing submissions;
- generative-AI filing or registration submissions;
- payment licensing;
- enterprise-important-data identification;
- sector-specific services such as health, finance, education, or regulated news;
- automated code execution;
- VPN, proxy, relay, or access-control-bypass services.

---

## 4. Foundational Principles

### 4.1 Lawful access before convenience

AI ARK must not solve accessibility problems through unauthorized copying, proxying, or technical circumvention.

### 4.2 Four levels before one label

Information, artifact, installation, and runtime availability must be evaluated separately.

### 4.3 Evidence before status

Every public status should include:

- check method;
- evidence type;
- date;
- expiry;
- reviewer or system;
- limitations.

### 4.4 Rights before mirroring

A public source being visible outside Mainland China does not automatically authorize AI ARK to host or mirror it.

### 4.5 Creator authorization where rights are unclear

Proprietary or ambiguously licensed Resources should use creator-provided or expressly authorized China editions.

### 4.6 Current version before historical success

A successful test of an old ResourceVersion does not establish current availability.

### 4.7 Dependency chain before top-level reachability

A reachable GitHub page does not prove that package registries, APIs, models, credentials, or runtime services are reachable.

### 4.8 Regional status is per ResourceVersion

Changes in scripts, dependencies, or external services can change availability.

### 4.9 Domestic alternatives are not substitutes for provenance

AI ARK must clearly identify when an alternative is a different Resource rather than a mirror of the original.

### 4.10 Data separation before scale

Mainland users, tester evidence, moderation records, and behavioral data should use a region-aware architecture from the beginning.

### 4.11 Transparency before regulatory assumptions

AI ARK should record which regulatory assessments were completed and which remain pending.

### 4.12 No disguised news service

Daily AI updates should initially remain source-linked capability and product updates unless specialist review authorizes a broader news service.

---

## 5. Mainland Availability Levels

AI ARK should use four independent levels.

# CN-A1 — Information Accessible

The AI ARK page, summary, documentation, provenance, and essential usage information can be accessed by a typical Mainland user.

This does not mean the original source or Resource artifact is accessible.

# CN-A2 — Artifact Accessible

The required source archive, Skill package, binary, document, or other artifact can be lawfully obtained through a tested route.

This may be:

- original source;
- package registry;
- authorized AI ARK mirror;
- creator-provided China edition.

# CN-A3 — Installation Accessible

The Resource and required dependencies can be installed or configured in the target environment.

This includes:

- package managers;
- container images;
- runtime;
- authentication;
- model access;
- configuration;
- dependent services.

# CN-A4 — Runtime Verified

The Resource’s defined primary workflow was successfully executed in a documented Mainland environment.

This is the strongest status.

It must specify:

- ResourceVersion;
- environment;
- runtime;
- dependency versions;
- region or test network;
- primary scenario;
- evidence;
- date;
- limitations.

---

## 6. Availability Status Values

Each level supports:

```text
CONFIRMED
PARTIAL
UNAVAILABLE
UNKNOWN
UNDER_REVIEW
NOT_APPLICABLE
```

### 6.1 Confirmed

Evidence supports the status for the stated ResourceVersion and period.

### 6.2 Partial

Some paths, dependencies, environments, or functions work while others do not.

### 6.3 Unavailable

The level failed through tested or authoritative evidence.

### 6.4 Unknown

No sufficient current evidence exists.

### 6.5 Under Review

A material change or conflicting report requires re-evaluation.

### 6.6 Not Applicable

The level does not apply to the Resource.

Example:

A purely informational workflow template may not have a separate downloadable artifact.

---

## 7. Composite Availability

AI ARK may produce a summary label, but it must not replace the four levels.

Suggested composite states:

```text
FULLY_AVAILABLE
USABLE_WITH_LIMITATIONS
INFORMATION_ONLY
ALTERNATIVE_REQUIRED
NOT_CURRENTLY_FEASIBLE
UNKNOWN
UNDER_REVIEW
```

### 7.1 Fully Available

All required levels through CN-A4 are confirmed for the stated scenario.

### 7.2 Usable with Limitations

Primary use works, but one or more:

- dependencies;
- platforms;
- features;
- payment methods;
- update routes;

are limited.

### 7.3 Information Only

CN-A1 is confirmed, but the artifact or runtime path is unavailable or unauthorized.

### 7.4 Alternative Required

The original Resource cannot complete the task, but AI ARK has a verified alternative.

### 7.5 Not Currently Feasible

No lawful and technically workable path is known.

---

## 8. Availability Record

```yaml
regional_availability:
  id: string
  resource_id: string
  resource_version_id: string
  region_id: string
  information_status: enum
  artifact_status: enum
  installation_status: enum
  runtime_status: enum
  composite_status: enum
  check_method: enum
  checked_at: datetime
  expires_at: datetime
  checked_by_type: enum
  checked_by_id: string|null
  evidence_item_ids: string[]
  dependency_findings: json
  rights_findings: json
  compliance_findings: json
  limitation_notes: string[]
  alternative_resource_ids: string[]
  public_summary: string
  review_status: enum
```

### 8.1 Required invariants

- status binds to a ResourceVersion;
- status includes a date;
- `RUNTIME_STATUS=CONFIRMED` requires runtime evidence;
- authorized mirror claims require rights evidence;
- unknown status is preferable to unsupported certainty;
- expired status must not appear current;
- a public summary must not omit a material limitation.

---

## 9. Mainland Availability Pipeline

```text
Resource candidate
↓
Canonical identity and version
↓
Rights and license review
↓
Source and documentation accessibility
↓
Artifact accessibility
↓
Dependency and installation mapping
↓
Runtime test
↓
Content and security review
↓
Compliance classification
↓
Availability decision
↓
Public label and alternatives
↓
Continuous monitoring
```

---

## 10. Stage 1 — Canonical Identity and Version

Before testing accessibility, AI ARK must establish:

- canonical Resource;
- canonical source;
- creator or organization;
- current ResourceVersion;
- source revision or snapshot;
- fork or mirror relationship;
- content fingerprint.

### 10.1 Blocking conditions

- ownership dispute;
- impersonation;
- ambiguous fork;
- missing version;
- source mismatch;
- unverified mirror.

A status should not be inherited from another fork or historical version without review.

---

## 11. Stage 2 — Rights and License Review

### 11.1 Review questions

- Is the Resource open source?
- Which license applies?
- Does the license allow redistribution?
- Does it allow modification?
- Does it allow translation?
- Does it require source attribution?
- Does it require preservation of notices?
- Are screenshots and brand assets covered by the same license?
- Are model weights or datasets under separate terms?
- Does the website’s contract restrict automated access or redistribution?
- Has the creator expressly authorized a China edition or mirror?

### 11.2 Rights states

```text
LICENSE_CONFIRMED
CREATOR_AUTHORIZED
METADATA_ONLY_ALLOWED
REDISTRIBUTION_ALLOWED
MODIFICATION_ALLOWED
TRANSLATION_ALLOWED
REDISTRIBUTION_RESTRICTED
RIGHTS_UNCLEAR
TAKEDOWN_PENDING
```

### 11.3 Publication consequences

#### Rights confirmed

AI ARK may use the permitted delivery method.

#### Rights unclear

AI ARK may publish:

- metadata;
- editorial summary;
- provenance;
- source link;
- alternatives.

It should not automatically host:

- full artifacts;
- extensive documentation copies;
- proprietary screenshots;
- model files.

#### Rights restricted

Use metadata-only presentation or obtain explicit permission.

### 11.4 Legal review gate

Human legal review is required for:

- proprietary artifact hosting;
- ambiguous copyleft obligations;
- commercial redistribution;
- model weights;
- datasets;
- trademark-heavy China editions;
- disputed creator authorization.

---

## 12. Stage 3 — Information Accessibility: CN-A1

### 12.1 What to test

- AI ARK China page;
- essential description;
- installation documentation;
- source provenance;
- screenshots or examples;
- license information;
- verification and ranking explanation;
- Chinese translation;
- accessibility from representative Mainland networks.

### 12.2 Information delivery

AI ARK should ensure CN-A1 through:

- Mainland-hosted application;
- domestic CDN;
- domestic object storage;
- domestic search index;
- cached reviewed metadata;
- localized text;
- approved media.

### 12.3 Source links

AI ARK may show original links even when access is uncertain, provided the status is clear.

Example:

> Original source availability varies. AI ARK’s reviewed summary remains accessible.

### 12.4 Content freshness

A locally accessible page must not conceal that its upstream evidence is stale.

Display:

- source last checked;
- AI ARK review date;
- upstream update status;
- pending re-review.

---

## 13. Stage 4 — Artifact Accessibility: CN-A2

### 13.1 Artifact classes

- source archive;
- `SKILL.md`;
- package;
- container image;
- binary;
- documentation bundle;
- model;
- dataset;
- configuration template;
- media asset.

### 13.2 Approved delivery methods

1. Original source or registry  
2. Authorized AI ARK mirror  
3. Creator-provided China edition  
4. Authorized partner distribution  
5. Metadata-only fallback  

### 13.3 Artifact verification

Record:

- source URL;
- download route;
- version;
- checksum;
- size;
- license;
- rights basis;
- malware scan;
- secret scan;
- synchronization date.

### 13.4 Artifact accessibility test

A successful HTTP response is insufficient.

The system should verify:

- complete download;
- correct checksum;
- expected file type;
- no interstitial replacement;
- no corrupted archive;
- no authentication dead end.

---

## 14. Stage 5 — Installation Accessibility: CN-A3

### 14.1 Installation graph

AI ARK should construct:

```text
Resource artifact
↓
Runtime
↓
Package manager
↓
Direct dependencies
↓
External services
↓
Credentials
↓
Configuration
↓
Installation verification
```

### 14.2 Required checks

- runtime availability;
- package registry;
- package versions;
- container registry;
- Git dependency;
- model provider;
- API endpoint;
- DNS;
- TLS;
- payment or account creation;
- phone or identity verification;
- environment variables;
- license activation.

### 14.3 Installation results

```text
INSTALL_SUCCESS
INSTALL_PARTIAL
INSTALL_FAILED
NOT_TESTED
```

### 14.4 Partial examples

- package installs but optional image assets fail;
- Skill installs but default API provider is inaccessible;
- original dependency unavailable but authorized substitute works;
- one operating system succeeds while another fails.

### 14.5 Installation evidence

- command log;
- package receipt;
- dependency resolution;
- environment snapshot;
- error output;
- final installed-state check.

### 14.6 No unsafe workarounds

AI ARK should not recommend:

- disabling certificate checks;
- untrusted package mirrors;
- hidden relays;
- unauthorized credentials;
- unofficial binaries without provenance.

---

## 15. Stage 6 — Runtime Verification: CN-A4

### 15.1 Runtime test requirements

A runtime test must define:

- primary task;
- expected input;
- expected output;
- runtime;
- platform;
- region;
- network environment;
- ResourceVersion;
- dependency versions;
- credentials class;
- test date;
- success criteria.

### 15.2 Results

```text
PASS
PARTIAL_PASS
FAIL
INCONCLUSIVE
ABORTED
```

### 15.3 Runtime Verified award

CN-A4 is confirmed only when:

- installation succeeded;
- primary functional scenario completed;
- expected output was produced;
- no undisclosed critical blocker occurred;
- evidence was reviewed.

### 15.4 Scope example

> Runtime verified for version 2.3.0 using Codex on macOS in Shanghai for the Markdown-to-HTML-presentation workflow. Windows and hosted-agent operation were not tested.

### 15.5 Expiry

Suggested default:

```text
90 days
```

Shorter for:

- hosted APIs;
- rapidly changing services;
- unstable beta Resources.

Longer may be allowed for stable, offline, immutable Resources.

---

## 16. Check Methods

```text
EDITORIAL_REVIEW
CREATOR_DECLARATION
AUTOMATED_NETWORK_CHECK
ARTIFACT_DOWNLOAD_TEST
INSTALLATION_TEST
RUNTIME_TEST
COMMUNITY_REPORT
AI_ARK_LABS_TEST
AUTHORIZED_MIRROR_CHECK
LEGAL_REVIEW
```

### 16.1 Evidence strength

Highest:

- AI ARK runtime test;
- AI ARK installation test;
- authorized mirror verification;
- reviewed Labs test.

Lower:

- creator declaration;
- community report;
- automated reachability check.

### 16.2 Public distinction

The UI and API must show whether a result was:

- tested;
- declared;
- reported;
- inferred.

---

## 17. Dependency Accessibility Model

Each dependency should have a regional record.

```yaml
regional_dependency_status:
  dependency_id: string
  dependency_version: string|null
  region_id: string
  access_status: enum
  installation_status: enum
  runtime_status: enum
  checked_at: datetime
  evidence_item_ids: string[]
  alternatives: string[]
```

### 17.1 Dependency failure categories

```text
DOMAIN_UNREACHABLE
REGISTRY_UNAVAILABLE
PACKAGE_MISSING
ACCOUNT_UNAVAILABLE
PAYMENT_UNAVAILABLE
API_UNAVAILABLE
MODEL_UNAVAILABLE
AUTHENTICATION_UNAVAILABLE
LICENSE_RESTRICTED
PERFORMANCE_UNUSABLE
UNKNOWN
```

### 17.2 Transitive limitations

MVP should prioritize direct dependencies.

Critical transitive dependencies discovered through lockfiles or tests should also be recorded.

---

## 18. Delivery Method A — Metadata-Only Page

Use when:

- redistribution is not authorized;
- artifact access cannot be made reliable;
- proprietary source terms prohibit hosting;
- legal review is incomplete.

AI ARK may provide:

- description;
- use cases;
- compatibility;
- ranking;
- reviews;
- provenance;
- source link;
- regional alternatives.

Public label:

> Information available; artifact not distributed by AI ARK.

---

## 19. Delivery Method B — Authorized Mainland Mirror

### 19.1 Eligibility

A mirror requires:

- license permission or creator authorization;
- canonical ResourceVersion;
- artifact checksum;
- source provenance;
- security scans;
- synchronization policy;
- takedown process;
- regional hosting approval.

### 19.2 Mirror record

```yaml
resource_mirror:
  id: string
  resource_version_id: string
  region_id: string
  mirror_url: string
  operator: string
  authorization_basis: enum
  authorization_evidence_id: string
  upstream_url: string
  upstream_checksum: string
  mirror_checksum: string
  software_bill_of_materials_id: string|null
  malware_scan_status: enum
  last_synced_at: datetime
  synchronization_status: enum
  status: enum
```

### 19.3 Synchronization states

```text
CURRENT
UPDATE_AVAILABLE
REVIEW_REQUIRED
SYNC_FAILED
SUSPENDED
REMOVED
```

### 19.4 Immutable publication

Published mirror versions should be immutable.

A new upstream version creates a new mirror candidate.

### 19.5 Public disclosure

Display:

- “Authorized mirror”;
- upstream source;
- mirrored version;
- checksum;
- last synchronization;
- operator;
- modifications.

---

## 20. Delivery Method C — Creator-Provided China Edition

### 20.1 Best fit

- proprietary Resources;
- hosted tools;
- Resources with inaccessible upstream services;
- Resources requiring localized dependencies;
- China-specific compliance modifications.

### 20.2 China edition relationship

A China edition may be:

- the same ResourceVersion with regional packaging;
- a distinct regional ResourceVersion;
- a separate Resource if behavior materially differs.

### 20.3 Required disclosure

- creator authorization;
- differences from global version;
- data location;
- service provider;
- model provider;
- feature limitations;
- update cadence;
- support contact.

### 20.4 No false equivalence

AI ARK must not present a materially modified China edition as identical to the global version.

---

## 21. Delivery Method D — Domestic or Regional Alternative

Use when the original Resource cannot be lawfully or technically delivered.

Alternatives should be selected through:

- capability match;
- task fit;
- runtime compatibility;
- regional availability;
- ranking;
- verification;
- cost;
- workflow compatibility.

### 21.1 Alternative types

```text
FUNCTIONAL_EQUIVALENT
PARTIAL_EQUIVALENT
OPEN_SOURCE_ALTERNATIVE
DOMESTIC_SERVICE
CREATOR_CHINA_EDITION
MANUAL_WORKAROUND
```

### 21.2 Explanation

Example:

> The original MCP server depends on an unavailable hosted API. This alternative provides the same database-query capability through a Mainland-accessible service but uses a different authentication model.

---

## 22. Prohibited Circumvention Methods

AI ARK must not provide, operate, or instruct users to use:

- unauthorized VPN services;
- proxy services intended to bypass access controls;
- hidden relays;
- domain-fronting or similar evasion;
- unauthorized account sharing;
- stolen or fabricated credentials;
- unauthorized mirrors;
- certificate-validation bypass;
- software designed to evade regulatory or platform restrictions.

### 22.1 Product response

When lawful delivery is not available:

```text
Information-only page
+
Transparent limitation
+
Authorized or domestic alternatives
```

### 22.2 Engineering control

Availability analyzers must not automatically discover and publish circumvention routes.

---

## 23. Mainland Infrastructure Architecture

Recommended regional architecture:

```text
Global AI ARK
├── Global application
├── Global canonical public graph
├── Global source collectors
└── Global integrations

Mainland AI ARK
├── Mainland web application
├── Mainland API gateway
├── Mainland object storage
├── Mainland CDN
├── Mainland search index
├── Mainland user and community database
├── Mainland moderation
├── Mainland LLM integration
├── Mainland monitoring probes
└── Approved synchronization service
```

### 23.1 Separation goals

- regional performance;
- filing/licensing compatibility;
- data governance;
- operational resilience;
- moderation;
- lawful cross-border synchronization.

### 23.2 Shared versus regional data

#### Globally shareable candidates

- public Resource metadata;
- public source URLs;
- open-source license;
- public ranking methodology;
- non-personal public evidence;
- content fingerprints.

#### Regionally restricted by default

- Mainland user accounts;
- tester applications;
- private reviews;
- private deployment evidence;
- moderation records;
- behavioral data;
- identity verification;
- creator contracts.

### 23.3 No automatic global replication

Regional personal or sensitive data must not be replicated outside Mainland infrastructure without a documented legal basis and approved process.

---

## 24. Internet Information Service Filing and Licensing Gate

AI ARK must determine whether the Mainland service is:

- non-commercial internet information service;
- commercial internet information service;
- mobile application;
- mini-program or other app form;
- subject to additional sector licensing.

The current Internet Information Services Measures distinguish commercial services, which use a licensing system, from non-commercial services, which use a filing system. A Mainland public website therefore requires a formal ICP assessment and applicable filing or license before launch.[1]

### 24.1 Required launch checklist

- legal operating entity;
- service classification;
- domain ownership;
- Mainland hosting arrangement;
- ICP filing or license;
- public display of filing number;
- APP filing if applicable;
- public-security filing assessment;
- sector-specific review;
- privacy policy;
- user agreement;
- complaint channel.

### 24.2 Mobile application

If AI ARK launches an APP, mini-program, or similar mobile application in Mainland China, the app-filing process must be assessed and completed as applicable.[2]

### 24.3 Gate rule

No Mainland public production launch before the required filing and licensing checklist is signed off by qualified local counsel and the responsible operating entity.

---

## 25. Algorithm-Recommendation Governance

AI ARK intends to provide:

- search;
- ranking;
- filtering;
- personalized recommendations;
- task resolution;
- workflow selection.

The PRC Algorithm Recommendation Provisions expressly cover generation/synthesis, personalized pushing, ranking/selection, search/filtering, and scheduling/decision technologies used to provide information services.[3]

### 25.1 AI ARK algorithm inventory

Maintain a registry of:

- search-ranking algorithm;
- category-ranking algorithm;
- recommendation algorithm;
- workflow Resource-selection algorithm;
- regional-alternative algorithm;
- moderation triage algorithm;
- fraud detection;
- generated-path algorithm.

### 25.2 Governance controls

- public methodology;
- sponsored-content separation;
- human intervention;
- complaint and appeal;
- periodic audit;
- data-source documentation;
- discrimination testing;
- manipulation detection;
- model and methodology versioning;
- incident response.

### 25.3 Filing and safety assessment gate

For services with public-opinion attributes or social-mobilization capability, the Algorithm Recommendation Provisions require filing and safety-assessment obligations, including filing within the prescribed period and public display of the filing number.[3]

AI ARK must obtain specialist assessment of whether its:

- ranking;
- recommendation;
- news/update;
- community;
- generative search;

functions meet those conditions.

### 25.4 No hidden ranking manipulation

Commercial launch status, sponsorship, or paid evaluation must remain outside organic ranking.

---

## 26. Public Generative-AI Function Gate

### 26.1 Internal editorial generation

AI ARK may use LLMs internally to draft summaries, tags, translations, and workflow candidates.

Internal draft generation should remain:

- human-reviewed;
- source-grounded;
- logged;
- model-versioned;
- unavailable directly to the public before review.

### 26.2 Public generative functions

Examples:

- dynamic natural-language answers;
- AI-generated workflow paths;
- chat assistant;
- generated comparisons;
- generated creator summaries.

The Interim Measures for Generative AI Services apply when generative-AI services are provided to the public in Mainland China, and they include obligations concerning lawful content, personal information, service agreements, complaints, and applicable filing/safety assessment.[4]

### 26.3 Filing or registration assessment

Current CAC notices distinguish:

- generative-AI services completing national filing;
- applications or functions that directly call already-filed models through APIs, which may undergo local registration.

They also state that applicable launched products should publicly identify the model and filing or registration information.[5]

### 26.4 MVP recommendation

For the earliest Mainland edition:

- keep dynamic public generation limited or disabled;
- publish human-reviewed generated content;
- use a compliant Mainland model/provider;
- complete filing or application-registration assessment;
- disclose model and registration details where required;
- retain prompt and output governance logs according to policy.

---

## 27. AI-Generated and Synthetic Content Labelling

The Measures for Labelling AI-Generated or Synthetic Content took effect on September 1, 2025 and establish explicit and implicit labelling obligations for relevant generated/synthetic content and distribution services.[6]

### 27.1 AI ARK content classes

- AI-assisted summary;
- AI-assisted translation;
- AI-generated workflow path;
- AI-generated image;
- AI-generated comparison;
- user-uploaded AI-generated content;
- creator-provided AI-generated media.

### 27.2 Public labelling

AI ARK should support labels such as:

```text
AI-assisted, human-reviewed
AI-generated path
Creator-declared AI-generated media
Suspected AI-generated content
```

### 27.3 Metadata

Where required and technically applicable:

- preserve or add implicit metadata;
- record AI ARK service identifier;
- content ID;
- generation type;
- model/provider;
- review status.

### 27.4 Export and download

Downloaded or exported AI-generated content should preserve required labels.

### 27.5 User declaration

User upload flows should ask whether content contains AI-generated or synthetic material.

---

## 28. Network Data and Personal Information Governance

AI ARK will process:

- accounts;
- creator identities;
- comments;
- reviews;
- Labs applications;
- private evidence;
- analytics;
- regional status reports;
- moderation records.

The Personal Information Protection Law and the Network Data Security Management Regulation provide core requirements for personal-information and network-data processing, including lawful processing, user rights, security controls, audits, and cross-border conditions.[7][8]

### 28.1 Data inventory

Maintain:

- data category;
- purpose;
- legal basis;
- retention;
- region;
- recipients;
- sensitivity;
- deletion method.

### 28.2 Data minimization

Do not collect:

- unnecessary legal identity;
- full production logs;
- credentials;
- unrelated company information;
- raw device identifiers;

when lower-risk evidence is sufficient.

### 28.3 User rights

Provide processes for:

- access;
- copy;
- correction;
- deletion;
- withdrawal of consent;
- account cancellation;
- complaint.

### 28.4 Sensitive information

High-risk evidence may include:

- identity documents;
- private deployment;
- precise location;
- financial data;
- biometric information;
- credential information.

Use:

- separate consent;
- stronger access control;
- impact assessment;
- short retention;
- encryption.

### 28.5 Compliance audits

The Mainland operator should establish periodic personal-information and network-data compliance reviews.

---

## 29. Cross-Border Data Governance

Global/Mainland synchronization can become a data-export activity when Mainland personal information or important data is transferred or remotely accessed from outside Mainland China.

The 2024 Provisions on Promoting and Regulating Cross-Border Data Flows define exemptions, standard-contract/certification ranges, and security-assessment thresholds, while continuing to require notice, separate consent where applicable, impact assessment, and security safeguards.[9]

### 29.1 Default architecture

Prefer:

- Mainland storage for Mainland personal data;
- aggregation or anonymization before global sharing;
- public metadata synchronization;
- explicit approved export pipelines;
- no unrestricted foreign administrator access.

### 29.2 Cross-border decision record

```yaml
cross_border_transfer_assessment:
  data_set:
  origin_region:
  destination:
  purpose:
  data_categories:
  personal_information_count:
  sensitive_information_count:
  important_data_status:
  transfer_mechanism:
  exemption:
  impact_assessment_id:
  consent_status:
  approved_by:
  review_date:
```

### 29.3 Thresholds

Current thresholds and mechanisms must be reviewed against the most recent official rules and guidance at the time of implementation. The 2024 Provisions include separate treatment for:

- transfers below 100,000 individuals’ non-sensitive personal information;
- transfers from 100,000 to below 1 million individuals;
- transfers of sensitive personal information;
- transfers reaching 1 million individuals;
- important data;
- critical-information-infrastructure operators.[9]

The specification should not hardcode legal thresholds into application logic without a configurable policy version.

### 29.4 Important data

If AI ARK is informed that data is classified as important data, additional controls and security-assessment processes apply.

### 29.5 Remote access

Foreign remote access to Mainland-hosted personal data should be treated as a potential cross-border data scenario and reviewed accordingly.

---

## 30. User-Generated Content and Moderation

AI ARK Mainland may host:

- comments;
- reviews;
- questions;
- creator updates;
- Labs feedback;
- issue reports.

### 30.1 Required controls

- user agreement;
- community policy;
- complaint and reporting;
- automated screening;
- human moderation;
- appeal;
- evidence retention;
- emergency escalation;
- creator retaliation controls.

### 30.2 Regional moderation

Mainland moderation should operate through:

- local policy;
- local team or approved provider;
- regional audit logs;
- documented escalation;
- lawful reporting.

### 30.3 Ranking impact

Moderation removal and fraud findings must propagate to:

- review aggregation;
- ranking;
- verification;
- workflow recommendations.

---

## 31. AI Updates and News Boundary

The long-term AI ARK vision includes daily AI updates.

A public internet news-information service in Mainland China may require an Internet News Information Service License, depending on the service form and content.[10]

### 31.1 MVP-safe positioning

Initial Mainland update content should focus on:

- official Resource releases;
- version updates;
- official creator announcements;
- source-linked product updates;
- ranking and verification changes;
- workflow updates.

### 31.2 Avoid before legal review

- independent political or current-affairs reporting;
- broad news aggregation presented as original news service;
- unlicensed news editing or republication;
- generated “breaking news” content.

### 31.3 Product label

Use:

> AI capability updates

rather than presenting AI ARK as a general news organization during MVP.

---

## 32. China Edition Content Model

A Resource may have localized content without creating a different identity.

```yaml
regional_content:
  resource_id:
  resource_version_id:
  region_id:
  language:
  title:
  summary:
  installation:
  regional_limitations:
  regional_alternatives:
  translation_type:
  review_status:
  updated_at:
```

### 32.1 Translation states

```text
CREATOR_PROVIDED
HUMAN_TRANSLATED
AI_ASSISTED_HUMAN_REVIEWED
UNREVIEWED_INTERNAL
```

Only reviewed content should publish.

### 32.2 China edition version

Create a separate regional ResourceVersion when:

- dependencies differ materially;
- functionality differs;
- legal terms differ;
- data processing differs;
- creator packages a distinct release;
- model or API provider changes.

---

## 33. Public UX Requirements

### 33.1 Resource page availability panel

Display:

```text
Mainland China Availability

Information          Confirmed
Artifact             Confirmed via authorized mirror
Installation         Partial
Runtime              Verified for Codex on macOS

Last checked         2026-08-01
Current version      2.3.0
```

### 33.2 Limitations

Example:

> Installation succeeds through the authorized package mirror. The optional image-search provider is not available, so image retrieval requires an alternative provider.

### 33.3 Alternatives

Display:

- creator China edition;
- domestic equivalent;
- manual alternative;
- supported regional workflow.

### 33.4 Status explanation

Users should be able to open:

- evidence;
- check method;
- test environment;
- expiry;
- status history.

### 33.5 Search filters

- Mainland fully available;
- installation accessible;
- runtime verified;
- China edition;
- authorized mirror;
- domestic alternative.

### 33.6 No flag-only labels

Use text, not only country flags or color.

---

## 34. API Representation

Example:

```json
{
  "resource_id": "res_...",
  "resource_version_id": "ver_...",
  "region": "mainland_china",
  "composite_status": "USABLE_WITH_LIMITATIONS",
  "levels": {
    "information": {
      "status": "CONFIRMED",
      "method": "EDITORIAL_REVIEW"
    },
    "artifact": {
      "status": "CONFIRMED",
      "method": "AUTHORIZED_MIRROR_CHECK",
      "mirror_id": "mir_..."
    },
    "installation": {
      "status": "PARTIAL",
      "method": "INSTALLATION_TEST"
    },
    "runtime": {
      "status": "CONFIRMED",
      "method": "RUNTIME_TEST",
      "scope": "Codex on macOS"
    }
  },
  "checked_at": "2026-08-01T00:00:00Z",
  "expires_at": "2026-11-01T00:00:00Z",
  "limitations": [],
  "alternatives": [],
  "provenance": []
}
```

### 34.1 Agent requirements

Machine consumers must receive:

- ResourceVersion;
- status per level;
- confidence or evidence type;
- date;
- expiry;
- alternatives;
- limitations.

### 34.2 No automatic execution authority

```json
{
  "execution_authorized": false
}
```

---

## 35. Workflow Integration

Every WorkflowStep should be region-resolved.

```text
Global workflow
↓
Check each Resource and dependency
↓
Substitute regional alternatives
↓
Recalculate cost, time, risk, and output
↓
Publish Mainland workflow status
```

### 35.1 Workflow status

```text
FULLY_AVAILABLE
PARTIALLY_AVAILABLE
ALTERNATIVES_REQUIRED
NOT_CURRENTLY_FEASIBLE
UNKNOWN
```

### 35.2 Verified workflow

A Mainland AI ARK Verified Workflow requires end-to-end testing in the documented Mainland environment.

---

## 36. Ranking Integration

Regional availability should not silently distort the global Quality Score.

Recommended approach:

- maintain global Quality Score;
- expose regional-fit score or status separately;
- allow region-filtered ranking;
- exclude Resources that cannot complete the requested regional task;
- explain substitutions.

Example:

```text
Global Presentation Rank: #2
Mainland-Compatible Presentation Rank: #5
```

### 36.1 Commercial neutrality

Authorized mirror partnerships and China launch relationships must not create hidden ranking benefits.

---

## 37. Verification Integration

Availability and AI ARK Verification remain distinct.

A Resource may be:

- Quality Verified globally;
- not installable in Mainland China.

A Resource may be:

- Runtime Verified in Mainland China;
- not yet Proven in Use globally.

### 37.1 Regional verification report

Should include:

- availability levels;
- ResourceVersion;
- environment;
- dependency path;
- mirror;
- test;
- limitations;
- expiry.

---

## 38. Community Evidence

Users may submit:

- source access report;
- download result;
- installation result;
- runtime result;
- dependency failure;
- regional alternative.

### 38.1 Public state

Community reports show:

> Community reported

until reviewed.

### 38.2 Verification

Community evidence may support CN-A2 through CN-A4 after review.

### 38.3 Fraud controls

Watch for:

- region spoofing;
- fabricated screenshots;
- copied logs;
- creator marketing campaigns;
- outdated version reports.

---

## 39. AI ARK Labs Regional Testing

Labs can recruit testers for:

- Mainland source access;
- installation;
- runtime;
- operating-system coverage;
- network-provider diversity;
- China edition;
- domestic alternative comparison.

### 39.1 Tester privacy

Do not publish:

- precise addresses;
- IP addresses;
- employer;
- private infrastructure.

### 39.2 Evidence

Record broad region and network context sufficient for repeatability without unnecessary personal data.

---

## 40. Synchronization Architecture

### 40.1 Global-to-Mainland flow

```text
Public global Resource update
↓
Synchronization candidate
↓
Content and rights review
↓
Regional transformation
↓
Mainland editorial review
↓
Publish
```

### 40.2 Mainland-to-global flow

```text
Public regional metadata or aggregated evidence
↓
Cross-border classification
↓
Anonymization or approved transfer
↓
Global graph update
```

### 40.3 No direct database replication

Use controlled export and import records rather than unrestricted database replication.

### 40.4 Synchronization record

```yaml
regional_sync:
  id:
  subject_type:
  subject_id:
  source_region:
  destination_region:
  content_fingerprint:
  data_classification:
  rights_status:
  personal_data_present:
  transfer_basis:
  review_status:
  approved_by:
  synced_at:
```

---

## 41. Update Detection and Re-Review

### 41.1 Triggers

- new ResourceVersion;
- dependency change;
- source-domain change;
- package-registry change;
- API-provider change;
- rights change;
- mirror mismatch;
- creator China edition update;
- community failure cluster;
- regulation or policy change.

### 41.2 Materiality

Always material:

- installation command;
- external service;
- permission;
- artifact checksum;
- license;
- authentication;
- runtime behavior;
- regional delivery route.

### 41.3 Public behavior

When a material update is detected:

- mark status Under Review;
- preserve prior evidence with date;
- avoid claiming current verification;
- notify saved-workflow users;
- re-test critical paths.

---

## 42. Monitoring Probes

### 42.1 Probe classes

- DNS;
- HTTP;
- artifact download;
- package registry;
- API health;
- authentication;
- installation;
- runtime.

### 42.2 Geographic diversity

Use representative Mainland regions and network providers where operationally feasible.

### 42.3 Probe limitations

Automated probes can produce false positives or negatives.

They should not replace human-reviewed installation and runtime testing.

### 42.4 Probe security

- no unauthorized access;
- no credential sharing;
- no aggressive crawling;
- provider rate limits;
- logged purpose;
- isolated environment.

---

## 43. Expiry and Freshness

Suggested defaults:

```text
Information accessibility     30 days
Artifact accessibility        30 days
Installation accessibility    60 days
Runtime verification          90 days
Authorized mirror checksum    Every sync
Hosted API availability       7–30 days
```

Category-specific policies may override.

### 43.1 Expired status

Expired status becomes:

```text
UNKNOWN
```

or:

```text
UNDER_REVIEW
```

rather than remaining Confirmed.

---

## 44. Incident Response

### 44.1 Incident types

- unauthorized mirror;
- corrupted artifact;
- malware finding;
- credential exposure;
- regional data leak;
- incorrect regulatory disclosure;
- inaccessible critical dependency;
- false Runtime Verified claim;
- source takeover;
- algorithm or generative-AI filing issue.

### 44.2 Immediate actions

- suspend affected artifact;
- disable install action;
- remove active mirror;
- mark availability Under Review;
- revoke regional verification;
- notify users where necessary;
- preserve evidence;
- escalate to legal or Trust and Safety.

### 44.3 Runbooks

Required:

- mirror compromise;
- upstream takeover;
- package poisoning;
- data-export incident;
- AI-generated-label failure;
- ICP or filing issue;
- regional outage;
- incorrect regional recommendation.

---

## 45. Operational Roles

### Mainland Product Owner

Owns regional product scope.

### Mainland Compliance Owner

Owns filing, licensing, algorithm, generative-AI, and data-governance reviews.

### Regional Editorial Reviewer

Owns localized publication and limitations.

### Regional Technical Tester

Owns installation and runtime tests.

### Rights Reviewer

Owns license and mirror authorization.

### Trust and Safety

Owns malicious or prohibited Resource handling.

### Data Protection Owner

Owns personal data, cross-border records, and retention.

One person may hold several roles during validation, but responsibilities and decisions must remain auditable.

---

## 46. Compliance Decision Register

```yaml
compliance_decision:
  id:
  product_function:
  jurisdiction:
  issue_type:
  applicable_rules:
  decision:
  conditions:
  legal_reviewer:
  effective_date:
  re_review_date:
  evidence:
```

Decision categories:

```text
ICP
APP_FILING
ALGORITHM
GENERATIVE_AI
AI_CONTENT_LABEL
DATA_EXPORT
PERSONAL_INFORMATION
NEWS_SERVICE
CONTENT_MODERATION
SECTOR_LICENSE
MIRROR_RIGHTS
```

No critical function should rely solely on informal memory of a legal assessment.

---

## 47. Mainland Launch Gates

### Gate CN-0 — Legal entity and product classification

- operating entity;
- service classification;
- business model;
- sector review.

### Gate CN-1 — Hosting and filing

- domain;
- Mainland hosting;
- ICP filing or license;
- APP filing if applicable;
- required public disclosures.

### Gate CN-2 — Algorithm governance

- algorithm inventory;
- public methodology;
- human intervention;
- complaint and appeal;
- filing/safety-assessment decision.

### Gate CN-3 — Generative AI

- public function inventory;
- model/provider;
- filing or registration decision;
- model disclosure;
- content controls;
- complaint mechanism.

### Gate CN-4 — AI content labels

- explicit labels;
- metadata labels where applicable;
- upload declaration;
- download/export behavior.

### Gate CN-5 — Data governance

- data map;
- privacy notices;
- consent;
- user rights;
- retention;
- regional storage;
- cross-border decision.

### Gate CN-6 — Resource delivery

- rights review;
- mirror governance;
- scans;
- checksum;
- takedown.

### Gate CN-7 — Moderation and incidents

- community policy;
- reporting;
- local moderation;
- incident runbooks.

### Gate CN-8 — Production readiness

- monitoring;
- backups;
- audit;
- test evidence;
- responsible owner;
- external legal sign-off.

---

## 48. MVP Scope

### Include

- four availability levels;
- Mainland status on 20 or more selected Skills;
- evidence and dates;
- dependency review;
- metadata-only presentation;
- limited authorized mirror pilot only if rights are confirmed;
- creator China-edition field;
- regional alternatives;
- one to five installation tests;
- limited runtime tests;
- API representation;
- workflow regional substitution;
- Mainland infrastructure design;
- compliance decision register;
- human review.

### Defer

- broad artifact mirroring;
- automatic legal classification;
- large-scale multi-province runtime testing;
- payment and subscriptions;
- public dynamic generative assistant before compliance approval;
- general AI news operation;
- automated China editions;
- cross-border private evidence synchronization;
- high-risk sector Resources;
- public execution;
- access-control circumvention.

---

## 49. Validation Metrics

| Metric | Validation target |
|---|---:|
| Resources with Mainland status | ≥20 |
| Resources with CN-A3 installation evidence | ≥5 |
| Resources with CN-A4 runtime evidence | ≥3 |
| Status records with date and evidence | 100% |
| Unauthorized mirrors | 0 |
| Users understanding four levels | ≥70% |
| Users finding regional status useful | ≥60% |
| Regional alternative click or selection | Establish baseline |
| Stale status shown as current | 0 |
| Material factual correction rate | <5% |
| Critical privacy incident | 0 |

---

## 50. Testing Strategy

### Unit tests

- status transitions;
- expiry;
- composite state;
- alternative selection;
- mirror authorization;
- API serialization;
- regional ranking filters.

### Fixture tests

- information only;
- accessible source but inaccessible package;
- install success, runtime failure;
- authorized mirror;
- unauthorized mirror;
- China edition;
- regional alternative;
- expired runtime test;
- dependency change;
- rights dispute.

### Integration tests

```text
Resource update
→ regional re-review
→ status change
→ workflow substitution
→ API update
→ user notification
```

### Security tests

- mirror tampering;
- checksum mismatch;
- malicious artifact;
- secret in package;
- unauthorized admin access;
- cross-region data leak;
- circumvention suggestion injection.

### Compliance tests

- required disclosures;
- AI-generated-content label;
- privacy-right request;
- complaint submission;
- regional-data export block.

---

## 51. Acceptance Criteria

The Mainland Availability system is acceptable for MVP when:

### Availability model

- all four levels exist independently;
- every status binds to a ResourceVersion;
- check date, method, evidence, and expiry exist;
- unknown is represented explicitly;
- CN-A4 requires runtime evidence.

### Rights and delivery

- every mirror has authorization evidence;
- checksums and upstream provenance are recorded;
- metadata-only fallback exists;
- creator China editions are distinguishable;
- alternatives are separate Resources;
- no prohibited circumvention is provided.

### Regional architecture

- Mainland personal and private evidence data have a regional-storage plan;
- synchronization is controlled and audited;
- global and Mainland records preserve canonical identity;
- no unrestricted cross-border database access exists.

### Governance

- ICP/app-filing assessment exists;
- algorithm inventory exists;
- generative-AI function assessment exists;
- AI-generated-content labelling plan exists;
- cross-border data decision process exists;
- news-service boundary is documented;
- specialist sign-off is required before public launch.

### UX and API

- four levels are visible;
- limitations are clear;
- current date and version are shown;
- alternatives are accessible;
- API returns level-specific status;
- workflow resolution respects regional availability;
- `execution_authorized` remains false.

### Operations

- update monitoring exists;
- expiry is enforced;
- incident runbooks exist;
- critical changes can suspend install actions;
- audit records are complete.

---

## 52. Risk Register

| Risk | Probability | Impact | Control |
|---|---:|---:|---|
| Unauthorized mirroring | Medium | High | Rights gate and authorization evidence |
| Stale availability claim | High | High | Expiry and continuous monitoring |
| Dependency inaccessible after install | High | High | Dependency graph and runtime test |
| Circumvention feature creep | Medium | Very high | Explicit prohibition and review |
| Cross-border data breach | Medium | Very high | Regional storage and transfer controls |
| Algorithm-filing misclassification | Medium | High | Specialist legal assessment |
| Public GenAI non-compliance | Medium | High | Function gate and compliant model path |
| Missing AI-content labels | Medium | High | Label pipeline and validation |
| News-service licensing issue | Medium | High | Capability-update boundary |
| Mirror compromise | Medium | Very high | Immutable artifacts, hashes, scans |
| False CN-A4 claim | Medium | High | Versioned runtime evidence |
| Creator misrepresents China edition | Medium | High | Editorial and technical review |
| Regulatory change | High | High | Policy versioning and re-review |

---

## 53. Open Questions

1. Which Mainland legal entity should operate AI ARK?
2. Should the first Mainland edition be a website only?
3. Is a mobile APP needed before product-market validation?
4. Which Mainland cloud and CDN providers should be used?
5. Which compliant LLM provider should support internal generation?
6. Should public dynamic AI generation be disabled in the first release?
7. Which features may require algorithm filing or safety assessment?
8. Which data must remain exclusively in Mainland infrastructure?
9. Which public metadata may synchronize globally without review?
10. Should the initial mirror pilot include only permissively licensed Skills?
11. Which network regions and providers should be included in runtime tests?
12. How should package-registry alternatives be approved?
13. Should China editions have separate public slugs?
14. How should regional ranking relate to global ranking?
15. What expiry period is appropriate by Resource category?
16. How should foreign creators authorize China mirrors?
17. Which takedown process should be available to rights holders?
18. Should creator and tester identity evidence be processed by a local provider?
19. How should AI-generated Chinese translations be labelled?
20. What exact content qualifies as an AI capability update rather than internet news?
21. Should regional user behavior ever influence global ranking?
22. Which compliance decisions require outside counsel versus internal review?
23. How should Mainland API keys be issued to global companies?
24. Should a domestic alternative be preferred over a globally higher-ranked Resource?
25. How should an AI agent disclose that it selected a regional substitute?

---

## 54. Primary Regulatory Sources

The implementation team must re-check current official texts before launch. The following sources were current during preparation on August 2, 2026.

1. **Internet Information Services Measures** — commercial services use licensing; non-commercial services use filing.  
   Official MIIT page: https://cqca.miit.gov.cn/zwgk/zcwj/flfg/art/2026/art_3aa3d50dbe1648fda74aeab4f39b2db1.html

2. **MIIT Notice on Mobile Internet Application Filing**.  
   https://www.miit.gov.cn/jgsj/xgj/wjfb/art/2023/art_dd783a581c9644a4aee10afa582811db.html

3. **Provisions on the Administration of Algorithm-Generated Recommendations for Internet Information Services**.  
   https://www.cac.gov.cn/2022-01/04/c_1642894606364259.htm

4. **Interim Measures for the Management of Generative Artificial Intelligence Services**.  
   https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm

5. **CAC announcement on filed generative-AI services and registered applications/functions, March–April 2026**.  
   https://www.cac.gov.cn/2026-05/13/c_1780413225190669.htm

6. **Measures for Labelling AI-Generated or Synthetic Content**, effective September 1, 2025.  
   https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm

7. **Personal Information Protection Law of the People’s Republic of China**.  
   https://flk.npc.gov.cn/detail?fileId=&id=ff8081817b6472a3017b656cc2040044&title=%E4%B8%AD%E5%8D%8E%E4%BA%BA%E6%B0%91%E5%85%B1%E5%92%8C%E5%9B%BD%E4%B8%AA%E4%BA%BA%E4%BF%A1%E6%81%AF%E4%BF%9D%E6%8A%A4%E6%B3%95&type=

8. **Network Data Security Management Regulation**, effective January 1, 2025.  
   https://app.www.gov.cn/govdata/gov/202409/30/520076/article.html

9. **Provisions on Promoting and Regulating Cross-Border Data Flows**.  
   https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm

10. **Provisions on the Administration of Internet News Information Services** and current licensing notice.  
    https://www.cac.gov.cn/2017-05/03/c_1120907226.htm  
    https://www.cac.gov.cn/2026-04/28/c_1779119758823184.htm

---

## 55. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Validation and Analytics Plan v1.0.md`

It should define:

- validation questions;
- concierge validation;
- prototype testing;
- user and creator recruitment;
- research methods;
- instrumentation;
- discovery metrics;
- workflow metrics;
- creator metrics;
- editorial economics;
- community evidence;
- API and agent validation;
- Mainland validation;
- commercial signals;
- experiment design;
- data quality;
- success gates;
- kill criteria;
- reporting cadence;
- final MVP scope-freeze decision.

---

## 56. Final Mainland Availability Direction

# AI ARK should make Mainland availability accurate, lawful, testable, and useful.

The product should not promise:

> This Resource is available in China.

It should state:

- which information is accessible;
- whether the artifact can be lawfully obtained;
- whether dependencies install;
- whether the primary task was actually executed;
- which version and environment were tested;
- what remains unavailable;
- which authorized or domestic alternative exists;
- when the status expires.

The correct operating model is:

```text
Discover globally
↓
Review rights and compliance
↓
Localize information
↓
Deliver only through authorized paths
↓
Test installation and runtime
↓
Publish evidence-backed status
↓
Monitor continuously
```

This system can become one of AI ARK’s strongest defensible advantages if it is treated as governed infrastructure rather than a translation or mirroring feature.

---

**End of document**
