# AI ARK Creator and Labs Specification v1.0

**Document status:** Creator, launch, and beta-testing product baseline  
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
**Primary audience:** Product, creator relations, community, trust and safety, editorial, legal, privacy, design, engineering, analytics, and operations teams  

---

## 1. Purpose

This specification defines the AI ARK creator system and AI ARK Labs.

It establishes:

- creator profiles;
- creator identity;
- organization identity;
- profile claims;
- Resource claims;
- ownership and authorization verification;
- creator updates;
- creator analytics;
- creator correction rights;
- creator moderation boundaries;
- launch programs;
- AI ARK First;
- AI ARK Exclusive Beta;
- Official AI ARK Page;
- AI ARK Launch Partner;
- AI ARK Labs campaigns;
- tester recruitment;
- tester selection;
- test-task design;
- tester consent;
- incentives;
- confidentiality;
- campaign evidence;
- campaign lifecycle;
- creator and tester communications;
- commercial disclosures;
- ranking and verification separation;
- API representation;
- privacy;
- moderation;
- metrics;
- acceptance criteria.

The system should create genuine value for creators without allowing commercial relationships or creator control to compromise AI ARK’s editorial, ranking, review, or verification independence.

---

## 2. Strategic Role

The creator system serves four strategic purposes.

### 2.1 Supply development

Creators can:

- claim existing pages;
- submit new Resources;
- update official information;
- add approved examples;
- launch new versions;
- recruit testers.

### 2.2 Distribution

AI ARK can help creators:

- explain what they built;
- reach relevant users;
- launch in China or globally;
- provide bilingual presentation;
- gain workflow inclusion;
- attract early users.

### 2.3 Evidence generation

AI ARK Labs creates structured evidence about:

- installation;
- compatibility;
- task completion;
- output quality;
- failures;
- regional availability;
- user fit.

### 2.4 Trust accumulation

Creator identity, responsiveness, version history, and issue resolution become part of the Capability Evidence Graph.

The system should create the following flywheel:

```text
Creator publishes
↓
AI ARK creates a high-quality page
↓
Creator claims and improves the page
↓
Users discover and test
↓
Evidence and reviews accumulate
↓
Creator responds and improves the Resource
↓
Ranking and verification become stronger
↓
More users and creators join
```

---

## 3. Product Principles

### 3.1 Creator value without creator control over truth

Creators should control their identity and official statements.

They should not control:

- organic ranking;
- independent reviews;
- verification outcomes;
- editorial conclusions;
- legitimate critical evidence.

### 3.2 Identity before privileges

A creator must prove identity or authority before managing a Resource page.

### 3.3 Resource claims are scoped

Claiming a Resource does not transfer ownership of AI ARK’s editorial content or community evidence.

### 3.4 Launch status is not quality status

AI ARK First, Exclusive Beta, Official Page, and Launch Partner must not imply higher quality.

### 3.5 Testing before promotion claims

Beta campaigns should define what is being tested and what remains unknown.

### 3.6 Consent before participation

Testers must understand:

- what they will install;
- what permissions are involved;
- what data is collected;
- what risks are known;
- what feedback may become public.

### 3.7 Privacy before publicity

Tester identities, private deployments, logs, and proprietary outputs should remain private unless explicitly approved.

### 3.8 Incentives must be disclosed

Compensation or rewards must not be conditioned on positive feedback.

### 3.9 No automatic execution in MVP

AI ARK Labs recruits and coordinates testers but does not execute untrusted Resources on their behalf.

### 3.10 Commercial separation

Creator payments and partnerships must not affect ranking or verification.

---

## 4. Creator Entity

### 4.1 Creator definition

A Creator is an individual who:

- created;
- maintains;
- owns;
- publishes;
- contributes materially to;

one or more AI ARK Resources.

### 4.2 Organization definition

An Organization may be:

- a company;
- open-source organization;
- community;
- foundation;
- research group;
- independent studio;
- publisher.

### 4.3 Creator profile fields

```yaml
creator:
  id: string
  slug: string
  display_name: string
  legal_name: string|null
  biography: string|null
  avatar_asset_id: string|null
  location_text: string|null
  primary_language: string|null
  public_languages: string[]
  official_links: json
  claim_status: enum
  identity_verification_status: enum
  commercial_relationship_status: enum
  created_at: datetime
  updated_at: datetime
```

### 4.4 Public creator profile

Public fields may include:

- display name;
- avatar;
- biography;
- verification;
- official links;
- Resources;
- Labs campaigns;
- creator updates;
- response metrics;
- launch relationships.

Private fields must remain hidden.

---

## 5. Creator Identity Verification

### 5.1 Verification levels

```text
UNVERIFIED
BASIC_VERIFIED
SOURCE_CONTROL_VERIFIED
DOMAIN_VERIFIED
ORGANIZATION_VERIFIED
MANUALLY_VERIFIED
REVOKED
```

### 5.2 Basic verification

May confirm:

- email access;
- account control;
- identity continuity.

Does not confirm Resource ownership.

### 5.3 Source-control verification

Acceptable methods:

- GitHub account authentication;
- repository ownership;
- repository collaborator role;
- signed verification file;
- pull request or commit confirmation;
- organization membership.

### 5.4 Domain verification

Methods:

- email at official domain;
- DNS record;
- website verification file;
- official-site link.

### 5.5 Organization verification

May require:

- official representative;
- domain control;
- organization account;
- legal or public documentation;
- manual review.

### 5.6 Revocation

Identity verification may be revoked for:

- impersonation;
- account compromise;
- ownership transfer;
- fraudulent evidence;
- organization dispute;
- policy violation.

### 5.7 Public meaning

Creator verification confirms identity or authority.

It does not confirm:

- Resource quality;
- security;
- broad adoption;
- ranking;
- AI ARK Verification.

---

## 6. Creator Profile Claim

### 6.1 Claim entry points

- creator profile;
- Resource page;
- creator dashboard;
- submission confirmation;
- invitation email.

### 6.2 Claim fields

```yaml
creator_claim:
  id: string
  creator_id: string
  claimant_user_id: string
  claim_method: enum
  evidence_item_ids: string[]
  status: enum
  submitted_at: datetime
  reviewed_at: datetime|null
  reviewed_by_user_id: string|null
  decision_reason: string|null
  expires_at: datetime|null
```

### 6.3 Claim methods

```text
GITHUB_AUTH
REPOSITORY_CONTROL
DOMAIN_EMAIL
DNS_RECORD
WEBSITE_FILE
OFFICIAL_ACCOUNT
MANUAL_EVIDENCE
OTHER
```

### 6.4 Claim states

```text
STARTED
EVIDENCE_REQUIRED
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
APPEALED
REVOKED
EXPIRED
```

### 6.5 Approval effects

Approved creators may:

- manage profile information;
- propose Resource corrections;
- respond to reviews;
- submit new versions;
- apply for Labs;
- request verification;
- request launch programs;
- view creator analytics.

Approval does not grant direct publication rights.

---

## 7. Resource Claim

### 7.1 Definition

A Resource claim connects a verified creator or organization to a specific Resource.

### 7.2 Claim roles

```text
OWNER
CREATOR
MAINTAINER
PUBLISHER
AUTHORIZED_REPRESENTATIVE
CONTRIBUTOR
TRANSLATOR
DISTRIBUTOR
```

### 7.3 Required evidence

Depends on role.

Owner or creator:

- source-control ownership;
- official website;
- package namespace;
- signed authorization;
- manual evidence.

Maintainer:

- repository role;
- organization confirmation;
- release authority.

Distributor:

- explicit creator authorization;
- contractual or public evidence.

### 7.4 Claim effects

A claimed Resource may show:

> Managed by verified creator.

The creator may:

- submit corrections;
- add creator-provided material;
- respond to reviews;
- submit updates;
- request launch support.

### 7.5 Editorial separation

Creators cannot directly alter:

- AI ARK ranking;
- AI ARK verification;
- independent limitations;
- community reviews;
- risk findings;
- editorial conclusions.

---

## 8. Ownership Disputes

### 8.1 Dispute triggers

- multiple conflicting claimants;
- ownership transfer;
- repository fork;
- organization split;
- creator departure;
- compromised account;
- impersonation.

### 8.2 Dispute states

```text
OPEN
EVIDENCE_REQUIRED
UNDER_REVIEW
TEMPORARY_RESTRICTION
RESOLVED
APPEALED
CLOSED
```

### 8.3 Interim behavior

AI ARK may:

- suspend creator management rights;
- display “Ownership under review”;
- preserve public Resource access;
- restrict new launch programs;
- pause verification changes.

### 8.4 Decision factors

- canonical source control;
- official domain;
- package namespace;
- historical attribution;
- creator agreements;
- public statements;
- manual evidence.

---

## 9. Creator Profile UX

### 9.1 Header

- avatar;
- display name;
- identity status;
- organization;
- biography;
- official links;
- primary expertise;
- claim status.

### 9.2 Sections

```text
Resources
Labs Campaigns
Creator Updates
Community Responses
About
Commercial Disclosures
```

### 9.3 Creator metrics

MVP may show:

- published Resources;
- claimed Resources;
- active Labs campaigns;
- response rate;
- median response time;
- issues resolved.

Metrics require sufficient sample size.

### 9.4 Avoided metrics

Do not initially show:

- opaque creator score;
- follower count as quality;
- popularity rank;
- commercial spending.

---

## 10. Creator Dashboard

### 10.1 Dashboard summary

- Resource views;
- source clicks;
- install copies;
- saves;
- review count;
- verified-use count;
- unresolved questions;
- current issues;
- creator-response metrics;
- Labs campaign status;
- claim status;
- update requests.

### 10.2 Resource management

Creators may:

- propose title correction;
- update official description;
- submit release notes;
- provide installation guidance;
- add approved visuals;
- disclose compatibility;
- report regional edition;
- submit limitations;
- propose new version;
- request re-review.

### 10.3 Editorial review

Material creator submissions enter:

```text
SUBMITTED
↓
EDITORIAL_REVIEW
↓
APPROVED / PARTIAL / REJECTED
↓
PUBLISHED
```

### 10.4 Creator analytics privacy

Creators should see aggregated data.

They should not receive:

- reviewer private identity;
- private deployment URL;
- private evidence;
- internal fraud scores;
- competitor confidential data.

---

## 11. Creator Updates

### 11.1 Update types

```text
NEW_VERSION
FIX_RELEASE
DOCUMENTATION_UPDATE
COMPATIBILITY_UPDATE
SECURITY_UPDATE
REGIONAL_EDITION
DEPRECATION
CREATOR_ANNOUNCEMENT
LABS_UPDATE
```

### 11.2 Creator update fields

```yaml
creator_update:
  id: string
  creator_id: string
  resource_id: string|null
  resource_version_id: string|null
  update_type: enum
  title: string
  body: string
  source_url: string|null
  evidence_item_ids: string[]
  editorial_status: enum
  created_at: datetime
  published_at: datetime|null
```

### 11.3 Public distinction

Creator updates are creator-authored content.

They must not be presented as independent AI ARK editorial conclusions.

---

## 12. Launch Program Overview

AI ARK should support four creator-distribution models.

```text
AI ARK First
AI ARK Exclusive Beta
Official AI ARK Page
AI ARK Launch Partner
```

Each must have a distinct meaning and disclosure.

---

## 13. AI ARK First

### 13.1 Definition

A time-limited first-publication or first-distribution window on AI ARK.

### 13.2 Typical duration

```text
7 days
14 days
30 days
```

### 13.3 Scope options

- first public discovery page;
- first beta access;
- first bilingual launch;
- first public documentation;
- first tester recruitment.

### 13.4 Creator obligations

- provide accurate source material;
- disclose other launch commitments;
- respond to critical issues;
- permit agreed editorial presentation;
- comply with disclosure rules.

### 13.5 AI ARK obligations

- prepare launch page;
- provide agreed promotion;
- disclose relationship;
- preserve editorial independence;
- provide analytics.

### 13.6 Ranking rule

AI ARK First status has no organic ranking effect.

---

## 14. AI ARK Exclusive Beta

### 14.1 Definition

A time-limited beta-testing period in which recruitment, access, or structured feedback is coordinated exclusively through AI ARK.

### 14.2 Best fit

- early Skill;
- new MCP;
- Agent beta;
- major ResourceVersion;
- proprietary pre-release;
- regional test.

### 14.3 Exclusivity scope

The agreement must specify:

- testing channel;
- geography;
- duration;
- tester count;
- public visibility;
- source availability;
- confidentiality;
- termination.

### 14.4 Limits

Exclusive Beta does not mean:

- permanent exclusivity;
- guaranteed positive coverage;
- ranking preference;
- verification award;
- security approval.

---

## 15. Official AI ARK Page

### 15.1 Definition

A creator-authorized canonical discovery, documentation, and launch page on AI ARK.

The source code or package may remain elsewhere.

### 15.2 Benefits

- verified creator identity;
- official creator-provided information;
- AI ARK editorial structure;
- version tracking;
- review integration;
- regional information;
- analytics;
- update notifications.

### 15.3 Editorial model

The page combines:

- creator-provided facts;
- AI ARK editorial explanation;
- community evidence;
- ranking;
- verification;
- commercial disclosure.

These layers must remain distinguishable.

---

## 16. AI ARK Launch Partner

### 16.1 Definition

A disclosed strategic distribution relationship.

### 16.2 Possible services

- launch planning;
- editorial production;
- creator interview;
- bilingual localization;
- collection placement;
- Labs campaign;
- analytics;
- regional launch support.

### 16.3 Commercial disclosure

Public page should state:

> AI ARK has a launch or distribution relationship with this creator. This relationship does not affect organic ranking or verification.

### 16.4 Prohibited benefit

Launch partners may not receive:

- hidden ranking boost;
- guaranteed verification;
- suppressed criticism;
- risk override.

---

## 17. Launch Application

### 17.1 Application fields

```yaml
launch_application:
  id: string
  creator_id: string
  resource_id: string|null
  resource_version_id: string|null
  program_type: enum
  desired_launch_date: datetime|null
  requested_duration: integer|null
  goals: string
  target_users: json
  regions: string[]
  source_status: enum
  confidentiality_required: boolean
  commercial_terms_requested: boolean
  existing_commitments: string|null
  status: enum
  submitted_at: datetime
```

### 17.2 Application states

```text
DRAFT
SUBMITTED
ELIGIBILITY_REVIEW
DISCOVERY_CALL
PROPOSAL
APPROVED
REJECTED
WITHDRAWN
ACTIVE
COMPLETED
TERMINATED
```

### 17.3 Selection factors

- Resource relevance;
- creator credibility;
- user value;
- launch readiness;
- evidence quality;
- operational capacity;
- safety;
- regional fit;
- editorial independence.

Commercial value may influence whether AI ARK offers a paid launch service, but not truth, rank, or verification.

---

## 18. AI ARK Labs Definition

# AI ARK Labs is a structured testing and early-adoption network for emerging AI capabilities.

It connects:

- creators who need qualified testers;
- users who want early access;
- AI ARK’s evidence system;
- ranking and verification inputs;
- workflow and regional testing.

AI ARK Labs should not initially be:

- a code-execution cloud;
- a security-certification service;
- a crowdsourced bounty marketplace;
- an unmoderated review forum.

---

## 19. Labs Campaign Types

```text
ALPHA
CLOSED_BETA
PUBLIC_BETA
RELEASE_CANDIDATE
VERSION_UPGRADE_TEST
COMPATIBILITY_TEST
REGIONAL_AVAILABILITY_TEST
WORKFLOW_TEST
DOCUMENTATION_TEST
```

### 19.1 Alpha

Small, controlled group.

Higher uncertainty.

### 19.2 Closed beta

Selected testers.

Access-controlled.

### 19.3 Public beta

Open application or limited public participation.

### 19.4 Compatibility test

Focuses on:

- runtime;
- operating system;
- dependency;
- environment.

### 19.5 Regional test

Focuses on access and runtime in a specified region.

### 19.6 Workflow test

Evaluates one Resource inside a broader workflow.

---

## 20. Labs Campaign Data Model

```yaml
labs_campaign:
  id: string
  resource_id: string
  resource_version_id: string
  creator_id: string
  campaign_type: enum
  title: string
  objective: string
  lifecycle_stage: enum
  target_tester_profile: json
  required_runtime_ids: string[]
  required_platform_ids: string[]
  region_ids: string[]
  tester_capacity: integer
  minimum_testers: integer|null
  application_open_at: datetime
  application_close_at: datetime
  testing_start_at: datetime
  testing_end_at: datetime
  known_risks: string[]
  required_permissions: string[]
  test_task_ids: string[]
  success_criteria: json
  feedback_schema: json
  incentive: json|null
  confidentiality_terms: string|null
  data_handling_notice: string
  status: enum
  reviewed_by_user_id: string|null
  created_at: datetime
  updated_at: datetime
```

---

## 21. Campaign Lifecycle

```text
DRAFT
↓
SUBMITTED
↓
ELIGIBILITY_REVIEW
↓
REMEDIATION_REQUIRED
↓
APPROVED
↓
APPLICATIONS_OPEN
↓
TESTER_SELECTION
↓
TESTING
↓
FEEDBACK_REVIEW
↓
COMPLETED
↓
ARCHIVED
```

Alternative terminal states:

```text
REJECTED
CANCELLED
SUSPENDED
TERMINATED
```

---

## 22. Campaign Eligibility

### 22.1 Minimum requirements

A Labs campaign requires:

- canonical Resource;
- fixed ResourceVersion;
- verified creator or authorized representative;
- clear test objective;
- defined tester profile;
- known-risk disclosure;
- permissions disclosure;
- test tasks;
- data-handling notice;
- campaign dates;
- AI ARK review.

### 22.2 Ineligible campaigns

- impersonated Resource;
- unresolved critical risk;
- illegal or prohibited content;
- unclear ownership;
- deceptive test purpose;
- undisclosed data collection;
- reward conditioned on positive review;
- unsafe credential collection;
- automatic execution outside agreed scope.

### 22.3 Conditional approval

Campaigns may require remediation:

- clearer instructions;
- safer permissions;
- narrower tester profile;
- better privacy notice;
- more explicit known risks.

---

## 23. Test Plan Design

### 23.1 Test plan components

```text
Objective
Prerequisites
Environment
Setup steps
Test tasks
Expected outcomes
Failure reporting
Evidence requirements
Completion criteria
Time estimate
Known limitations
```

### 23.2 Task quality

Test tasks should be:

- specific;
- observable;
- relevant;
- achievable;
- safe;
- time-bounded;
- version-aligned.

### 23.3 Avoid

- vague “try it and tell us what you think” campaigns;
- hidden marketing surveys;
- excessive unpaid work;
- tasks requiring unnecessary personal data;
- unsafe production deployment.

### 23.4 AI-assisted plan generation

AI may generate a draft test plan.

Human review is required before publication.

---

## 24. Tester Profile

### 24.1 Tester fields

```yaml
tester_profile:
  user_id: string
  public_display_name: string
  identity_level: enum
  runtime_ids: string[]
  platform_ids: string[]
  regions: string[]
  expertise_categories: string[]
  experience_level: enum
  labs_history: json
  conflict_disclosures: json
  created_at: datetime
```

### 24.2 Experience levels

```text
BEGINNER
INTERMEDIATE
ADVANCED
EXPERT
```

### 24.3 Public privacy

Public tester profile should not expose:

- legal identity unless chosen;
- private email;
- employer without consent;
- device identifiers;
- private campaign history.

---

## 25. Tester Application

### 25.1 Required fields

```yaml
labs_application:
  id: string
  campaign_id: string
  user_id: string
  runtime_ids: string[]
  platform_ids: string[]
  region_id: string|null
  relevant_experience: string
  intended_use_case: string
  availability: string
  conflict_disclosure: string|null
  consent_status: enum
  confidentiality_acceptance: boolean
  status: enum
  submitted_at: datetime
```

### 25.2 Application states

```text
DRAFT
SUBMITTED
UNDER_REVIEW
SHORTLISTED
ACCEPTED
WAITLISTED
REJECTED
WITHDRAWN
REMOVED
```

### 25.3 Selection criteria

- environment fit;
- task relevance;
- region;
- experience;
- diversity;
- reliability;
- conflict;
- capacity.

### 25.4 Fairness

Selection should not be based on protected characteristics unless legally justified and necessary.

---

## 26. Tester Selection

### 26.1 Selection authority

During MVP:

- creator proposes;
- AI ARK may review;
- AI ARK can reject unsafe or conflicted selection.

### 26.2 Diversity goals

Where useful, select across:

- runtime;
- platform;
- region;
- skill level;
- use case;
- language.

### 26.3 Waitlist

Campaigns should support a waitlist.

### 26.4 Rejection message

Applicants should receive a neutral reason category, such as:

- capacity reached;
- environment mismatch;
- region not in scope;
- experience mismatch;
- conflict;
- campaign cancelled.

---

## 27. Tester Consent

### 27.1 Required consent

Before acceptance, testers must acknowledge:

- beta status;
- known risks;
- permissions;
- data collection;
- confidentiality;
- evidence use;
- incentive terms;
- withdrawal process.

### 27.2 Consent versioning

Consent must bind to:

- campaign version;
- terms version;
- date;
- user.

### 27.3 Changed terms

Material changes require re-consent.

### 27.4 Withdrawal

Tester may withdraw.

Data already used in aggregated evidence may be retained according to disclosed policy and applicable law.

---

## 28. Confidentiality

### 28.1 Campaign confidentiality levels

```text
PUBLIC
PRIVATE_CAMPAIGN
NDA_REQUIRED
EMBARGOED_UNTIL_DATE
```

### 28.2 Confidential content

May include:

- source code;
- unreleased features;
- access credentials;
- roadmap;
- private outputs;
- creator communications.

### 28.3 AI ARK boundary

AI ARK should not provide legal guarantees regarding creator NDA enforceability.

Campaign terms should receive legal review for high-risk use.

### 28.4 Public review limitation

Private campaigns may delay public reviews until:

- embargo ends;
- creator approves non-confidential summary;
- AI ARK publishes aggregate findings.

Legitimate safety findings may require escalation despite confidentiality.

---

## 29. Incentives

### 29.1 Permitted incentives

- free access;
- subscription credit;
- recognition badge;
- gift card;
- monetary reward;
- creator merchandise;
- priority access;
- public acknowledgment.

### 29.2 Disclosure

Incentive must be visible before application.

### 29.3 Prohibited conditions

Incentive may not depend on:

- positive rating;
- favorable public review;
- silence about failures;
- removal of criticism.

### 29.4 Incentive responsibility

The campaign must specify whether:

- creator funds and fulfills;
- AI ARK funds and fulfills;
- no incentive exists.

### 29.5 MVP payment scope

AI ARK may record incentives but should defer complex payment escrow unless separately approved.

---

## 30. Tester Workspace

### 30.1 Workspace contents

- campaign overview;
- setup instructions;
- task checklist;
- known risks;
- required permissions;
- deadline;
- communication channel;
- feedback forms;
- evidence uploader;
- withdrawal control.

### 30.2 Task states

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
COMPLETED
SKIPPED
FAILED
```

### 30.3 Issue submission

Tester may submit:

- setup issue;
- task failure;
- compatibility issue;
- regional issue;
- safety concern;
- documentation issue;
- improvement suggestion.

### 30.4 Emergency report

Severe safety, privacy, or security concerns must have a prominent escalation action.

---

## 31. Campaign Communication

### 31.1 Communication types

- creator announcement;
- AI ARK notice;
- tester question;
- issue thread;
- schedule change;
- release update.

### 31.2 MVP communication model

Use structured campaign threads rather than unrestricted direct messaging.

### 31.3 Moderation

All communication is subject to community policy.

### 31.4 Private contact

Creators should not automatically receive tester email or private account information.

---

## 32. Feedback Collection

### 32.1 Required campaign feedback

- setup result;
- task result;
- environment;
- output quality;
- reliability;
- limitations;
- would-use-again;
- open feedback.

### 32.2 Campaign-specific questions

Creator may propose custom questions.

AI ARK reviews them for:

- relevance;
- privacy;
- fairness;
- excessive burden;
- promotional bias.

### 32.3 Evidence

Campaign may require:

- screenshot;
- log;
- output artifact;
- test result;
- regional check.

Private evidence rules apply.

---

## 33. Campaign Completion

### 33.1 Completion criteria

- testing period ended;
- minimum tester threshold reached or waived;
- feedback collected;
- severe issues reviewed;
- creator response recorded;
- campaign summary prepared.

### 33.2 Campaign summary

Public summary may include:

- tester count;
- environments;
- completion rate;
- setup success;
- task success;
- major findings;
- creator remediation;
- current Resource status.

### 33.3 Private summary

May include:

- tester-level evidence;
- confidential issues;
- unpublished output;
- fraud signals;
- private creator notes.

---

## 34. Campaign Evidence Contribution

Labs evidence may contribute to:

- Functional Effectiveness;
- Reliability;
- Compatibility;
- Momentum;
- Regional Availability;
- New and Promising;
- Functionally Tested;
- Quality Verified eligibility.

### 34.1 Weighting

Beta evidence receives less weight than sustained production evidence.

### 34.2 No automatic verification

Campaign completion does not automatically award:

- Quality Verified;
- Proven in Use;
- AI ARK Verified.

### 34.3 Version binding

All campaign evidence binds to the tested ResourceVersion.

---

## 35. Campaign Safety and Risk

### 35.1 Risk review

Before approval, assess:

- code execution;
- permissions;
- external calls;
- credential use;
- data collection;
- destructive operations;
- privacy;
- dependency risk;
- regional legality;
- creator identity.

### 35.2 High-risk campaigns

May require:

- smaller tester group;
- expert testers;
- restricted environment;
- additional warning;
- no production use;
- additional evidence;
- Trust and Safety approval.

### 35.3 Prohibited campaigns

- malware;
- credential harvesting;
- unauthorized surveillance;
- harmful automation;
- unlawful access;
- unlicensed redistribution;
- deceptive research;
- prohibited regulated activity.

---

## 36. Creator Moderation Boundaries

Creators may:

- respond;
- clarify;
- provide fixes;
- dispute evidence;
- report abuse;
- request confidential handling.

Creators may not:

- delete reviews;
- hide negative evidence;
- identify anonymous reviewers;
- retaliate;
- condition incentives on positive feedback;
- alter public AI ARK conclusions;
- mark severe issues resolved without review.

AI ARK retains moderation authority.

---

## 37. Creator Analytics

### 37.1 MVP analytics

- page views;
- unique visitors;
- source clicks;
- install-command copies;
- saves;
- review count;
- verified-use count;
- workflow inclusions;
- regional interest;
- Labs applications;
- campaign completion;
- creator response metrics.

### 37.2 Analytics limitations

- exclude internal staff;
- identify bot traffic where possible;
- disclose estimation;
- protect user privacy;
- avoid exposing individual users.

### 37.3 Future analytics

- cohort retention;
- install-to-review conversion;
- workflow attribution;
- enterprise interest;
- regional conversion;
- version adoption.

---

## 38. Creator Notifications

Creators may receive:

- claim decision;
- new review;
- new question;
- critical issue;
- verified deployment;
- source update detected;
- verification expiry;
- Labs application;
- campaign deadline;
- moderation decision;
- launch-program decision.

Notification channels:

- in-app;
- email.

Push is deferred.

---

## 39. Public Disclosure System

### 39.1 Identity labels

```text
Claimed Creator
Identity Verified
Organization Verified
```

### 39.2 Launch labels

```text
AI ARK First
Exclusive Beta on AI ARK
Official AI ARK Page
AI ARK Launch Partner
```

### 39.3 Trust labels

```text
Source Verified
Functionally Tested
Quality Verified
Proven in Use
AI ARK Verified
```

### 39.4 Separation rule

Identity, launch, and trust labels must be visually and semantically distinct.

---

## 40. Commercial Terms Governance

### 40.1 Contract scope

Launch or exclusive programs should specify:

- duration;
- services;
- fees;
- creator obligations;
- AI ARK obligations;
- data rights;
- confidentiality;
- termination;
- disclosures;
- ranking independence;
- verification independence.

### 40.2 Prohibited clauses

AI ARK should not agree to:

- guaranteed rank;
- guaranteed positive review;
- removal of legitimate criticism;
- guaranteed verification;
- hidden sponsorship;
- permanent editorial control by creator.

### 40.3 Termination

AI ARK may terminate for:

- policy breach;
- safety risk;
- fraud;
- non-payment where applicable;
- creator impersonation;
- undisclosed conflict;
- unlawful content.

---

## 41. Data and Privacy Model

### 41.1 Creator private data

- legal identity;
- email;
- contracts;
- payment information;
- private submissions;
- dispute evidence.

### 41.2 Tester private data

- email;
- application;
- private environment;
- private evidence;
- confidential feedback;
- NDA acceptance.

### 41.3 Access control

- creator sees approved campaign participants only;
- creator does not see unrelated private evidence;
- editors see publication data;
- moderators see policy-relevant data;
- verification reviewers see scoped evidence;
- commercial staff do not automatically see trust evidence.

### 41.4 Cross-border data

Mainland campaigns require region-specific data and legal review.

---

## 42. Retention

Suggested initial retention:

```text
Creator claim evidence             24 months after revocation
Active creator profile             While active
Rejected launch application        12 months
Labs application                   12 months after campaign
Campaign feedback                  24 months
Private test evidence              12 months after campaign
Commercial agreement               Legal retention period
Ownership dispute evidence         Until final resolution + policy period
```

Final periods require legal review.

---

## 43. API Representation

### 43.1 Creator summary

```json
{
  "id": "crt_...",
  "slug": "example-creator",
  "display_name": "Example Creator",
  "identity_verification": "SOURCE_CONTROL_VERIFIED",
  "resources": 4,
  "active_labs_campaigns": 1,
  "response_metrics": {
    "response_rate": 0.82,
    "median_response_hours": 48
  }
}
```

### 43.2 Launch relationship

```json
{
  "type": "AI_ARK_FIRST",
  "status": "ACTIVE",
  "starts_at": "2026-08-01T00:00:00Z",
  "ends_at": "2026-08-15T00:00:00Z",
  "disclosure": "This Resource is launching first on AI ARK. The relationship does not affect organic ranking or verification."
}
```

### 43.3 Labs campaign

```json
{
  "id": "lab_...",
  "resource_id": "res_...",
  "resource_version": "0.9.0-beta",
  "campaign_type": "CLOSED_BETA",
  "status": "APPLICATIONS_OPEN",
  "tester_capacity": 20,
  "application_close_at": "2026-08-10T00:00:00Z",
  "required_runtimes": ["Codex"],
  "regions": ["Japan", "Mainland China"],
  "known_risks": [
    "Beta software",
    "Requires local filesystem write access"
  ]
}
```

### 43.4 Public exclusions

Do not expose:

- legal identity;
- private email;
- contracts;
- tester applications;
- private feedback;
- private evidence;
- internal selection notes;
- fraud signals.

---

## 44. Event Model

Suggested events:

```text
creator.profile.claim.started
creator.profile.claim.submitted
creator.profile.claim.approved
creator.profile.claim.rejected
resource.claim.submitted
resource.claim.approved
ownership.dispute.opened
creator.update.submitted
creator.update.published
launch.application.submitted
launch.application.approved
launch.relationship.started
launch.relationship.completed
labs.campaign.submitted
labs.campaign.approved
labs.applications.opened
labs.tester.applied
labs.tester.accepted
labs.testing.started
labs.issue.reported
labs.feedback.submitted
labs.campaign.completed
labs.campaign.suspended
```

Each event should include:

- event ID;
- actor;
- subject;
- ResourceVersion;
- campaign;
- timestamp;
- schema version;
- correlation ID.

---

## 45. Moderation and Abuse

### 45.1 Creator abuse examples

- false ownership claim;
- review retaliation;
- tester harassment;
- undisclosed payment;
- positive-review conditioning;
- confidential-data misuse;
- fraudulent evidence;
- impersonation.

### 45.2 Tester abuse examples

- leaked confidential material;
- fabricated testing;
- incentive fraud;
- malicious evidence;
- harassment;
- unauthorized redistribution.

### 45.3 Enforcement options

- warning;
- campaign restriction;
- claim suspension;
- campaign suspension;
- removal;
- account suspension;
- verification re-review;
- legal escalation.

### 45.4 Appeal

Creators and testers may appeal consequential enforcement.

---

## 46. Security Requirements

- secure creator authentication;
- claim evidence protection;
- private campaign access controls;
- signed or time-limited beta-access links where used;
- evidence scanning;
- secret detection;
- no automatic execution;
- campaign rate limits;
- audit logging;
- role separation;
- protection against tester-data export abuse;
- secure withdrawal and access revocation.

---

## 47. Accessibility Requirements

- claim forms keyboard accessible;
- campaign forms have clear labels;
- consent terms readable and navigable;
- test task status not color-only;
- known-risk disclosures screen-reader accessible;
- creator and trust labels semantically distinct;
- application decisions include text explanations.

---

## 48. Testing Strategy

### 48.1 Unit tests

- claim state transitions;
- identity verification;
- launch status;
- campaign eligibility;
- tester-selection permissions;
- consent versioning;
- incentive disclosure;
- creator-response permissions.

### 48.2 Contract tests

- creator API;
- campaign API;
- event schemas;
- analytics;
- private-data exclusions.

### 48.3 Fixture tests

- valid creator claim;
- conflicting claim;
- repository transfer;
- Exclusive Beta;
- incentivized test;
- NDA campaign;
- unsafe campaign;
- creator retaliation;
- tester withdrawal;
- campaign cancellation.

### 48.4 End-to-end tests

```text
creator claims page
→ submits campaign
→ AI ARK approves
→ testers apply
→ creator selects
→ testers complete
→ feedback enters evidence graph
→ campaign closes
```

---

## 49. Operational Metrics

### Creator

- claim start;
- claim approval;
- claim completion time;
- creator correction rate;
- creator response rate;
- creator retention;
- page sharing.

### Launch

- applications;
- approval rate;
- active relationships;
- launch traffic;
- source clicks;
- creator satisfaction.

### Labs

- campaigns;
- applications;
- acceptance rate;
- completion rate;
- feedback quality;
- severe issues;
- creator remediation;
- tester retention.

### Trust

- ownership disputes;
- fraudulent claims;
- incentive disclosures;
- campaign suspensions;
- appeal reversal rate.

---

## 50. Service-Level Targets

Initial targets:

```text
Creator claim initial review        ≤5 business days
Ownership dispute initial review    ≤3 business days
Labs application initial review     ≤5 business days
Severe campaign issue triage        ≤24 hours
Tester withdrawal processing        Immediate or ≤24 hours
Launch disclosure publication       Before launch begins
```

---

## 51. MVP Scope

### Include

- creator profiles;
- creator claims;
- Resource claims;
- identity verification;
- creator corrections;
- creator responses;
- basic creator analytics;
- one or two Labs campaigns;
- tester applications;
- manual tester selection;
- structured test tasks;
- consent;
- incentives disclosure;
- campaign feedback;
- AI ARK First interest;
- Exclusive Beta interest;
- Official Page interest;
- launch disclosures;
- moderation and appeals.

### Defer

- full payment processing;
- escrow;
- permanent exclusivity;
- creator subscriptions;
- public creator reputation score;
- direct messaging;
- large-scale tester marketplace;
- automatic tester matching;
- code-execution sandbox;
- automated campaign approval;
- complex contracts inside product;
- public creator follower system;
- affiliate marketplace.

---

## 52. Acceptance Criteria

The Creator and Labs system is acceptable for MVP when:

### Creator identity

- creators can claim profiles;
- claims require evidence;
- approved creators receive scoped management rights;
- ownership disputes can suspend control;
- public identity labels are accurate.

### Resource claims

- creators can claim specific Resources;
- claim role is explicit;
- material changes remain editorially reviewed;
- creators cannot alter ranking, verification, or reviews.

### Launch programs

- AI ARK First, Exclusive Beta, Official Page, and Launch Partner remain distinct;
- each relationship has public disclosure;
- commercial relationships do not affect organic ranking or verification;
- time limits and obligations are recorded.

### Labs

- campaign eligibility is reviewed;
- test objective, risks, permissions, tasks, and consent are defined;
- testers can apply and withdraw;
- creator sees only permitted data;
- feedback binds to ResourceVersion;
- severe issues can suspend campaign;
- campaign evidence enters the governed evidence system.

### Privacy and trust

- private tester evidence is protected;
- incentives are disclosed;
- positive feedback cannot be required;
- creator retaliation is prohibited;
- moderation and appeals are audited.

### API

- public creator and campaign records exclude private data;
- machine consumers can distinguish identity, launch, and verification status;
- campaign lifecycle and version are available.

---

## 53. Validation Metrics

The MVP should target:

- at least five creator claims;
- at least two approved Labs campaigns;
- at least 20 total tester applications;
- at least ten completed tester feedback records;
- at least five creator responses;
- at least one creator product update based on Labs evidence;
- at least two creators interested in AI ARK First, Exclusive Beta, or Official Page;
- no unresolved severe tester privacy incident;
- creator claim median review time established;
- campaign completion rate established.

---

## 54. Open Questions

1. Should creators be able to claim a profile before any Resource exists?
2. Which claim methods are sufficient for Source Verified?
3. Should creator analytics be free in MVP?
4. Should AI ARK First require commercial terms or allow editorial selection?
5. What maximum exclusivity duration should be supported?
6. Should creators select testers directly or submit a ranked shortlist?
7. Can AI ARK reject a creator-selected tester for conflict or safety?
8. Which campaign incentives require payment infrastructure?
9. How should tester reputation influence selection later?
10. Should Labs feedback be public by default?
11. How should NDA campaigns handle severe security disclosures?
12. Should creators receive aggregated regional demand data?
13. How should organization ownership changes be handled?
14. When should a Creator Update bypass editorial review?
15. Should Labs campaigns contribute to Momentum immediately?
16. How should failed campaigns affect public creator reputation?
17. Should AI ARK offer paid launch-page production before validation?
18. Which creator metrics should be public?
19. How should proprietary Resources without source code be tested?
20. Should AI agents be allowed to participate as testers, and under what identity and evidence rules?

---

## 55. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Workflow and Task Resolution Specification v1.0.md`

It should define:

- user goals;
- Task taxonomy;
- task decomposition;
- Resource matching;
- workflow generation;
- curated workflows;
- AI ARK Verified Workflows;
- AI-Generated Paths;
- workflow steps;
- alternatives;
- compatibility;
- regional availability;
- cost;
- time;
- risk;
- approval points;
- evidence;
- workflow versioning;
- user completion;
- feedback;
- agent API resolution;
- acceptance criteria.

---

## 56. Final Creator and Labs Direction

# AI ARK should give creators distribution, evidence, and structured testing without selling credibility.

Creators should be able to:

- prove who they are;
- claim what they built;
- improve how it is presented;
- launch new versions;
- recruit relevant testers;
- learn from real usage;
- respond to problems;
- build trustworthy adoption evidence.

Users should be able to:

- discover credible creators;
- join relevant beta programs;
- understand risk;
- test safely within disclosed scope;
- contribute evidence;
- remain protected from manipulation and retaliation.

AI ARK Labs becomes valuable when it produces better truth about emerging capabilities—not merely more launch activity.

---

**End of document**
