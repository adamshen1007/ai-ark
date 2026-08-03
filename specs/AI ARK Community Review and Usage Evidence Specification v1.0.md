# AI ARK Community Review and Usage Evidence Specification v1.0

**Document status:** Community, moderation, and usage-evidence baseline  
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
**Primary audience:** Product, community, trust and safety, moderation, ranking, verification, privacy, creator relations, data, API, and engineering teams  

---

## 1. Purpose

This specification defines how AI ARK collects, stores, verifies, moderates, displays, weights, and governs community feedback and real-world usage evidence.

It establishes:

- general comments;
- questions;
- creator responses;
- structured usage reviews;
- verified installation evidence;
- verified deployment evidence;
- verified beta-test evidence;
- verified production-use evidence;
- version binding;
- task and environment capture;
- review dimensions;
- helpful votes;
- creator responsiveness;
- moderation;
- fraud prevention;
- privacy-safe evidence handling;
- reviewer reputation foundations;
- ranking contribution;
- verification contribution;
- appeals;
- retention;
- API representation;
- operational metrics;
- acceptance criteria.

The objective is not to build a generic social network.

The objective is to create a trustworthy, continuously improving evidence layer that answers:

> What happened when real users tried this Resource, in which environment, for which task, and with what result?

---

## 2. Strategic Role

Community evidence is one of AI ARK’s primary long-term differentiators.

Most directories can collect:

- repository stars;
- download counts;
- creator descriptions;
- generic comments.

AI ARK should collect structured evidence about:

- installation success;
- deployment success;
- task completion;
- output quality;
- compatibility;
- regional availability;
- repeat use;
- creator support;
- production use;
- failure patterns.

This evidence should improve:

- resource pages;
- search;
- ranking;
- verification;
- workflow recommendations;
- regional availability;
- creator product development;
- agent-facing API responses.

---

## 3. Community Principles

### 3.1 Evidence before engagement

The community system should reward useful, specific, reproducible information rather than comment volume.

### 3.2 Comments and reviews are different

A question or opinion must not carry the same evidentiary weight as a structured, version-specific usage review.

### 3.3 Version before aggregation

Usage outcomes must bind to the ResourceVersion used whenever reasonably possible.

### 3.4 Environment matters

A result without runtime, operating system, region, or dependency context may be misleading.

### 3.5 Verified does not mean universally true

Verified evidence confirms that an event occurred within a defined scope.

### 3.6 Privacy before publicity

Users may verify real use without exposing private deployments, client data, credentials, or proprietary outputs.

### 3.7 Creator response is evidence, not authority

Creators can clarify and remediate, but they cannot unilaterally remove legitimate criticism.

### 3.8 Negative outcomes are valuable

Failure evidence can be as useful as success evidence.

### 3.9 No purchased credibility

Paid, incentivized, or creator-recruited reviews must be disclosed and weighted appropriately.

### 3.10 Human moderation remains accountable

AI may assist with detection and triage, but consequential decisions must be reviewable.

---

## 4. Feedback Taxonomy

AI ARK should support five distinct public feedback classes.

### 4.1 General Comment

Used for:

- opinions;
- tips;
- short observations;
- discussion;
- non-evidentiary feedback.

General comments do not directly affect ranking.

### 4.2 Question

Used for:

- setup questions;
- compatibility questions;
- license questions;
- regional-access questions;
- feature clarification.

Questions may generate factual corrections or creator responses.

### 4.3 Issue Report

Used for:

- installation failure;
- runtime error;
- inaccurate documentation;
- compatibility failure;
- missing dependency;
- suspected safety concern;
- regional unavailability.

Issue reports require more structure than general comments.

### 4.4 Structured Usage Review

A version-specific evaluation submitted by a user who attempted to install, use, test, or deploy the Resource.

### 4.5 Verified Usage Review

A structured usage review supported by evidence validated by AI ARK.

Verification types:

```text
VERIFIED_INSTALLATION
VERIFIED_DEPLOYMENT
VERIFIED_BETA_TEST
VERIFIED_PRODUCTION_USE
```

---

## 5. Evidence Hierarchy

Community evidence should be weighted by strength.

Recommended hierarchy:

```text
Verified production use
        ↓
Verified deployment
        ↓
Verified beta test
        ↓
Verified installation
        ↓
Structured unverified usage review
        ↓
Issue report
        ↓
General comment or opinion
```

This hierarchy affects:

- ranking weight;
- Evidence Confidence;
- verification eligibility;
- workflow recommendations;
- compatibility confidence.

It must not determine moderation priority alone. A credible severe issue can be important even before full verification.

---

## 6. Comment Model

### 6.1 Comment fields

```yaml
comment:
  id: string
  subject_type: enum
  subject_id: string
  resource_version_id: string|null
  author_user_id: string
  parent_comment_id: string|null
  comment_type: enum
  body: string
  runtime_id: string|null
  platform_id: string|null
  region_id: string|null
  creator_response_status: enum|null
  moderation_status: enum
  visibility: enum
  created_at: datetime
  updated_at: datetime|null
```

### 6.2 Comment types

```text
GENERAL
QUESTION
TIP
DOCUMENTATION_FEEDBACK
COMPATIBILITY_QUESTION
REGIONAL_QUESTION
CREATOR_UPDATE
MODERATOR_NOTE
```

### 6.3 Comment constraints

- Comments must not directly change ratings.
- Comments may reference a version but are not required to.
- Comments may be converted into structured reports with the author’s consent.
- Creator updates must be clearly labelled.
- Moderator notes must be visually distinct.

---

## 7. Issue Report Model

### 7.1 Required fields

```yaml
issue_report:
  id: string
  resource_id: string
  resource_version_id: string|null
  reporter_user_id: string
  issue_type: enum
  severity_claimed: enum
  runtime_id: string|null
  platform_id: string|null
  region_id: string|null
  reproduction_steps: string|null
  expected_result: string|null
  actual_result: string|null
  evidence_item_ids: string[]
  public_summary: string
  moderation_status: enum
  investigation_status: enum
  created_at: datetime
```

### 7.2 Issue types

```text
INSTALLATION_FAILURE
RUNTIME_FAILURE
OUTPUT_QUALITY
DOCUMENTATION_ERROR
COMPATIBILITY_ERROR
DEPENDENCY_ERROR
REGIONAL_UNAVAILABLE
PRIVACY_CONCERN
SECURITY_CONCERN
LICENSE_CONCERN
CREATOR_IMPERSONATION
OTHER
```

### 7.3 Claimed severity

```text
LOW
MODERATE
HIGH
CRITICAL
UNKNOWN
```

Claimed severity is not final severity.

Trust and Safety assigns confirmed severity after review.

### 7.4 Investigation states

```text
NEW
TRIAGED
EVIDENCE_REQUIRED
UNDER_REVIEW
CREATOR_CONTACTED
CONFIRMED
PARTIALLY_CONFIRMED
NOT_REPRODUCED
RESOLVED
REJECTED
CLOSED
```

---

## 8. Structured Usage Review

### 8.1 Review objective

Capture enough context to make a user outcome meaningful and comparable.

### 8.2 Required review fields

```yaml
community_review:
  id: string
  resource_id: string
  resource_version_id: string
  reviewer_user_id: string
  review_type: enum
  task_id: string|null
  task_description: string
  runtime_id: string|null
  runtime_version: string|null
  platform_id: string|null
  platform_version: string|null
  region_id: string|null
  installation_source: string|null
  setup_result: enum
  task_result: enum
  would_use_again: enum
  usage_frequency: enum|null
  usage_context: enum
  disclosure_status: enum
  narrative: string
  verification_status: enum
  moderation_status: enum
  created_at: datetime
  updated_at: datetime|null
```

### 8.3 Setup result

```text
SUCCESS
PARTIAL
FAILED
NOT_ATTEMPTED
```

### 8.4 Task result

```text
COMPLETED
PARTIALLY_COMPLETED
FAILED
NOT_EVALUATED
```

### 8.5 Would use again

```text
YES
MAYBE
NO
NOT_SURE
```

### 8.6 Usage frequency

```text
ONE_TIME
OCCASIONAL
WEEKLY
DAILY
CONTINUOUS
UNKNOWN
```

### 8.7 Usage context

```text
PERSONAL
OPEN_SOURCE
FREELANCE
STARTUP
PRODUCTION_BUSINESS
ENTERPRISE_INTERNAL
EDUCATION
RESEARCH
BETA_TEST
OTHER
```

### 8.8 Disclosure status

```text
NO_CONFLICT
CREATOR_INVITED
INCENTIVIZED
EMPLOYEE_OR_CONTRIBUTOR
COMMERCIAL_RELATIONSHIP
OTHER_CONFLICT
```

---

## 9. Review Rating Dimensions

A review may contain the following ratings.

| Dimension | Meaning |
|---|---|
| Setup | Difficulty and clarity of installation |
| Documentation | Accuracy and completeness |
| Functional Accuracy | Whether the claimed task was completed |
| Output Quality | Usefulness of the result |
| Reliability | Consistency across repeated use |
| Compatibility | Fit with the stated environment |
| Value | Time, cost, or effort saved |
| Creator Support | Responsiveness and usefulness of support |

### 9.1 Rating scale

Recommended:

```text
1–5
```

### 9.2 Optional dimensions

A user should be able to omit a dimension they did not evaluate.

### 9.3 Overall score

The public overall score should be derived from available dimensions under a documented method.

It should not require the user to provide a separate overall rating.

### 9.4 Category-specific dimensions

Future categories may add dimensions.

Example:

- latency;
- output fidelity;
- security transparency;
- API stability.

---

## 10. Version Binding

### 10.1 Required version

A structured review must bind to:

- explicit release;
- Git tag;
- package version;
- commit snapshot;
- AI ARK snapshot.

### 10.2 Unknown version

If the user cannot determine version:

- allow `UNKNOWN_VERSION`;
- reduce evidence confidence;
- exclude the review from current-version rating by default;
- show it separately.

### 10.3 Current versus historical display

Resource page should show:

```text
Current version reviews
All version reviews
Historical version reviews
```

### 10.4 Material updates

A major Resource update should:

- reset or reduce current-version aggregation;
- preserve historical evidence;
- display continuity or breaking-change notes;
- request fresh reviews.

---

## 11. Environment Capture

### 11.1 Minimum environment fields

Where applicable:

- runtime;
- runtime version;
- operating system;
- operating-system version;
- region;
- installation source;
- dependency versions;
- deployment type.

### 11.2 Optional technical context

- hardware;
- package manager;
- container;
- browser;
- model provider;
- network constraints;
- language;
- organization size.

### 11.3 Privacy

Environment data must avoid:

- IP addresses;
- device identifiers;
- internal hostnames;
- credential names;
- client names;
- confidential infrastructure.

---

## 12. Verified Installation

### 12.1 Definition

Confirms that the Resource was installed or made available in a stated environment.

### 12.2 Acceptable evidence

- installation log;
- package-manager record;
- runtime list output;
- application screenshot;
- source-controlled installation record;
- AI ARK Labs setup completion;
- signed integration receipt.

### 12.3 Does not confirm

- functional success;
- output quality;
- production readiness;
- security.

### 12.4 Public label

> Verified installation

### 12.5 Required public context

- ResourceVersion;
- environment;
- date;
- verification method;
- privacy note where relevant.

---

## 13. Verified Deployment

### 13.1 Definition

Confirms that the Resource was deployed or integrated into a development, staging, or production-like environment.

### 13.2 Acceptable evidence

- deployment log;
- deployment provider receipt;
- private deployment URL checked by AI ARK;
- container or service status;
- integration test;
- API response;
- environment screenshot.

### 13.3 Deployment classes

```text
LOCAL
DEVELOPMENT
STAGING
PRODUCTION
ENTERPRISE_INTERNAL
OTHER
```

### 13.4 Public label

> Verified deployment

### 13.5 Privacy

Deployment address and environment details may remain private.

Public statement:

> Deployment verified by AI ARK. Deployment details are private.

---

## 14. Verified Beta Test

### 14.1 Definition

Confirms participation and outcome in an AI ARK Labs or approved creator beta campaign.

### 14.2 Evidence

- accepted tester record;
- completed test tasks;
- feedback submission;
- environment details;
- campaign version;
- creator acknowledgment where appropriate.

### 14.3 Public label

> Verified beta tester

### 14.4 Ranking treatment

Beta-test evidence contributes to:

- early effectiveness;
- compatibility;
- reliability;
- Momentum;
- New and Promising.

It should not carry the same weight as sustained production use.

---

## 15. Verified Production Use

### 15.1 Definition

Confirms meaningful real-world use in an operational environment.

### 15.2 Minimum evidence

At least one of:

- production deployment proof;
- recurring automation record;
- operational log;
- organization confirmation;
- private evidence reviewed by AI ARK;
- repeated verified use over time.

### 15.3 Required context

- ResourceVersion;
- use case;
- environment class;
- duration or frequency;
- outcome;
- limitations;
- verification date.

### 15.4 Public label

> Verified production use

### 15.5 Scope warning

Production use in one organization does not imply broad enterprise readiness.

---

## 16. Evidence Submission

### 16.1 Evidence uploader

The uploader should explain:

- accepted file types;
- prohibited content;
- privacy level;
- retention;
- who can access;
- what public claim may result.

### 16.2 Evidence types

```text
SCREENSHOT
VIDEO
INSTALLATION_LOG
TEST_LOG
DEPLOYMENT_PROOF
API_RECEIPT
OUTPUT_ARTIFACT
CREATOR_CONFIRMATION
ORGANIZATION_CONFIRMATION
OTHER
```

### 16.3 Evidence privacy options

```text
PUBLIC
PUBLIC_REDACTED
PRIVATE_AI_ARK_REVIEW
PRIVATE_CREATOR_AND_AI_ARK
```

### 16.4 Redaction

AI ARK should support:

- automatic secret detection;
- metadata stripping;
- manual redaction;
- replacement preview;
- rejection where safe redaction is impossible.

### 16.5 Evidence integrity

Store:

- checksum;
- upload timestamp;
- submitter;
- verification reviewer;
- access history;
- retention date.

---

## 17. Evidence Verification Process

```text
Evidence submitted
↓
Automated safety scan
↓
Privacy and secret scan
↓
Evidence-type validation
↓
Human review where required
↓
Outcome confirmed or rejected
↓
Public badge or claim created
↓
Evidence retained under policy
```

### 17.1 Verification outcomes

```text
VERIFIED
PARTIALLY_VERIFIED
INSUFFICIENT
REJECTED
FRAUD_SUSPECTED
EXPIRED
```

### 17.2 Rejected evidence

Reasons may include:

- unrelated;
- unreadable;
- manipulated;
- exposes secrets;
- wrong version;
- insufficient context;
- ownership uncertain;
- prohibited content.

---

## 18. Creator Responses

### 18.1 Creator response types

```text
ANSWER
ACKNOWLEDGED
FIX_PLANNED
RESOLVED
CANNOT_REPRODUCE
DOCUMENTATION_UPDATED
FIXED_IN_VERSION
DISPUTED
```

### 18.2 Response binding

A response should bind to:

- comment;
- review;
- issue;
- ResourceVersion;
- replacement version where fixed.

### 18.3 Resolution status

A creator may propose resolution.

AI ARK or the reporting user may confirm:

- resolved;
- partially resolved;
- unresolved;
- obsolete after new version.

### 18.4 Creator moderation limits

Creators may:

- respond;
- request correction;
- flag abuse;
- provide evidence.

Creators may not:

- delete legitimate criticism;
- alter user ratings;
- reveal private reviewer information;
- mark severe issues resolved unilaterally.

---

## 19. Creator Responsiveness Metrics

Potential metrics:

- response rate;
- median first-response time;
- acknowledged issue rate;
- verified-resolution rate;
- documentation-update rate;
- unresolved current-version issue count.

### 19.1 Public presentation

During MVP, display simple metrics such as:

```text
Creator response rate: 82%
Median response time: 2 days
Current issues resolved: 7 of 9
```

Only display when sample size is sufficient.

### 19.2 Ranking contribution

Creator responsiveness may contribute up to the defined ranking weight.

Meaningless or automated responses should not count.

---

## 20. Helpful Votes

### 20.1 Purpose

Help users surface reviews that are specific, informative, and reproducible.

### 20.2 Rules

- one vote per user;
- no creator bulk voting;
- suspicious voting patterns monitored;
- helpful votes do not equal truth;
- helpful votes do not verify evidence.

### 20.3 Sorting

Available sorts:

- Most helpful;
- Most recent;
- Current version;
- Verified first;
- Critical issues;
- Creator responded.

---

## 21. Reviewer Identity

### 21.1 Identity levels

```text
ANONYMOUS_PUBLIC
PSEUDONYMOUS
REGISTERED
IDENTITY_VERIFIED
ORGANIZATION_VERIFIED
AI_ARK_LABS_TESTER
```

### 21.2 Anonymous review policy

AI ARK may allow public pseudonyms.

Verified evidence must still bind internally to an account.

### 21.3 Organization disclosure

A reviewer may state:

- organization type;
- industry;
- team size.

Organization name may remain private.

### 21.4 Conflict disclosure

Required when the reviewer is:

- creator;
- contributor;
- employee;
- paid tester;
- investor;
- competitor;
- sponsored user.

---

## 22. Reviewer Reputation Foundation

The MVP should collect reputation signals without creating a strong public reviewer score yet.

Potential signals:

- verified reviews;
- completed Labs tests;
- helpful votes;
- review accuracy;
- moderation history;
- successful issue reproduction;
- creator confirmations;
- domain expertise.

### 22.1 Future reviewer badges

```text
Verified Developer
MCP Tester
Codex Power User
Security Reviewer
AI ARK Labs Tester
Top Contributor
```

### 22.2 Reputation constraints

- no hidden permanent score;
- users can appeal errors;
- reputation cannot override evidence;
- expertise should be domain-specific;
- negative reviews must not reduce reputation merely because creators disagree.

---

## 23. Review Weighting for Ranking

Suggested initial coefficients:

```text
Verified production use       1.00
Verified deployment           0.85
Verified beta test            0.70
Verified installation         0.50
Structured usage review       0.25
Issue report                  Context only
General comment               0.00
```

### 23.1 Additional modifiers

- current-version alignment;
- evidence recency;
- environment diversity;
- reviewer conflict;
- suspicious behavior;
- category relevance;
- repeated evidence.

### 23.2 No direct star-average rank

Public ratings should not directly determine Category Rank.

They contribute to component scores under the Ranking Standard.

---

## 24. Review Aggregation

### 24.1 Current-version summary

Default summary should prioritize current version.

Display:

- weighted review score;
- verified-use count;
- sample size;
- Evidence Confidence;
- setup-success rate;
- task-success rate;
- would-use-again rate.

### 24.2 Historical summary

Display separately:

- all-time reviews;
- previous-version issues;
- resolved recurring problems;
- long-term reliability.

### 24.3 Small sample

If sample size is insufficient:

> Early evidence — not enough reviews for a stable aggregate.

### 24.4 Bayesian prior

Use category-level prior to prevent small-sample distortion.

---

## 25. Workflow Evidence Contribution

Community evidence should influence workflow recommendations.

Examples:

- Resource A succeeds with Codex but fails frequently on Windows.
- Resource B is easier to install in Mainland China.
- Resource C has higher output quality but greater cost.
- Resource D works well for one workflow stage but poorly for another.

### 25.1 Workflow-specific review link

A review may optionally bind to:

- Workflow;
- WorkflowVersion;
- WorkflowStep.

### 25.2 Workflow result evidence

Capture:

- step completed;
- output accepted;
- alternative used;
- failure reason;
- time spent.

---

## 26. Regional Availability Contribution

Community reports can propose regional status changes.

Example:

> Package registry unavailable in Mainland China.

### 26.1 Community regional status

Display as:

> Community reported

until reviewed.

### 26.2 Runtime Verified requirement

Community reports alone do not create `Runtime Verified`.

Runtime Verified requires documented evidence and review.

### 26.3 Expiry

Regional community evidence should expire faster than stable source facts.

---

## 27. Moderation Policy

### 27.1 Prohibited content

- spam;
- harassment;
- threats;
- doxxing;
- credentials;
- confidential data;
- illegal content;
- impersonation;
- copied reviews;
- undisclosed paid reviews;
- fabricated evidence;
- competitor sabotage;
- creator self-review;
- unsupported severe allegations presented as fact;
- malicious files;
- promotional flooding.

### 27.2 Allowed critical content

Users may publish:

- negative outcomes;
- setup failures;
- criticism;
- security concerns;
- regional failures;
- creator-support complaints;

when expressed in good faith and within policy.

### 27.3 Moderation principles

- preserve useful criticism;
- minimize unnecessary removal;
- redact sensitive data where possible;
- separate factual dispute from policy violation;
- provide appeal;
- record reason;
- protect private reporters.

---

## 28. Moderation States

```text
PUBLISHED
PENDING_REVIEW
LIMITED_VISIBILITY
REDACTED
REMOVED
RESTORED
LEGAL_HOLD
```

### 28.1 Automated actions

Automation may:

- detect spam;
- detect secrets;
- quarantine files;
- flag abuse;
- limit suspicious velocity.

Automation should not make irreversible severe-content decisions without review, except immediate quarantine for safety.

---

## 29. Moderation Workflow

```text
Content submitted
↓
Automated screening
↓
Published or temporarily held
↓
User report or system flag
↓
Moderator review
↓
Action and reason
↓
Notification
↓
Appeal
↓
Final decision
```

### 29.1 Moderator actions

- no action;
- add context;
- request edit;
- redact;
- limit distribution;
- remove;
- suspend account;
- escalate;
- restore.

### 29.2 Severe issue escalation

Security, legal, privacy, or impersonation reports may be escalated to:

- Trust and Safety;
- Legal;
- Verification Authority;
- Editorial Authority.

---

## 30. Fraud Prevention

### 30.1 Threats

- fake accounts;
- coordinated reviews;
- paid review campaigns;
- creator self-reviews;
- competitor attacks;
- copied review text;
- fake deployment proof;
- manipulated screenshots;
- vote brigading;
- review exchange groups.

### 30.2 Signals

- account age;
- identity overlap;
- IP and device risk signals where lawful;
- timing clusters;
- text similarity;
- evidence reuse;
- conflict relationships;
- abnormal vote patterns;
- creator-linked accounts;
- source traffic campaigns.

### 30.3 Responses

- down-weight;
- hold for review;
- require additional evidence;
- remove;
- suspend;
- mark conflict;
- reverse ranking impact;
- open audit.

### 30.4 Transparency

AI ARK should not expose detailed fraud-detection methods that would enable evasion.

Affected users should receive a meaningful reason and appeal route.

---

## 31. Incentivized Reviews

### 31.1 Disclosure requirement

A review must disclose if the reviewer received:

- money;
- free access;
- gift;
- contest entry;
- beta incentive;
- creator request;
- affiliate benefit.

### 31.2 Weighting

Incentivized evidence may remain useful but should receive lower independence weight.

### 31.3 Creator solicitation

Creators may invite reviews.

They may not:

- require positive sentiment;
- suppress negative results;
- script the review;
- reward only favorable reviews.

---

## 32. Privacy

### 32.1 Sensitive data

Potential sensitive content:

- client names;
- private repositories;
- API credentials;
- deployment URLs;
- internal logs;
- proprietary outputs;
- employee identities;
- personal contact details.

### 32.2 Privacy controls

- private evidence mode;
- redaction;
- restricted reviewer access;
- retention limit;
- access log;
- deletion request;
- public-summary approval where practical.

### 32.3 Public identity

Users may choose:

- public real name;
- public pseudonym;
- anonymous public display with internal account identity.

### 32.4 Data minimization

Collect only information required to establish useful evidence.

---

## 33. Evidence Retention

Suggested policy:

```text
Public review text                  Indefinite unless removed
Public evidence                     Indefinite or source-dependent
Private installation evidence       12 months after verification
Private deployment evidence         12 months after verification
Labs evidence                       12 months after campaign
Fraud investigation evidence        According to risk policy
Legal hold evidence                 Until hold is released
```

Final periods require legal review.

### 33.1 Expiry effect

When private evidence expires:

- public verification may expire;
- aggregate history may remain;
- personal data should be deleted or anonymized where required.

---

## 34. Appeals

### 34.1 Who may appeal

- review author;
- creator;
- affected user;
- organization owner;
- moderator;
- editor.

### 34.2 Appeal grounds

- factual error;
- moderation error;
- missing context;
- conflict of interest;
- wrong version;
- fraudulent evidence;
- privacy violation;
- creator-response misrepresentation.

### 34.3 Appeal flow

```text
Appeal submitted
↓
Eligibility check
↓
Independent review
↓
Evidence request
↓
Decision
↓
Restore, modify, or uphold
↓
Audit
```

### 34.4 Appeal states

```text
SUBMITTED
UNDER_REVIEW
EVIDENCE_REQUIRED
UPHELD
PARTIALLY_UPHELD
REJECTED
WITHDRAWN
CLOSED
```

---

## 35. Notifications

### 35.1 Reviewer notifications

- creator responded;
- evidence verified;
- review moderated;
- appeal decision;
- Resource updated;
- verification changed.

### 35.2 Creator notifications

- new review;
- severe issue report;
- verified deployment;
- unresolved question;
- moderation update;
- recurring problem detected.

### 35.3 Moderator notifications

- high-severity report;
- fraud cluster;
- secret detected;
- appeal;
- legal escalation.

---

## 36. Public Resource Page Presentation

### 36.1 Community summary

Display:

```text
Current version rating
Verified-use count
Setup success rate
Task success rate
Would-use-again rate
Creator response rate
Evidence Confidence
```

### 36.2 Tabs

```text
Reviews
Deployments
Questions
Creator Updates
```

### 36.3 Filters

- current version;
- verified use;
- runtime;
- operating system;
- region;
- production use;
- beta testing;
- issues;
- creator responded.

### 36.4 Review card

Show:

- reviewer;
- reviewer status;
- review date;
- ResourceVersion;
- environment;
- task;
- ratings;
- result;
- narrative;
- verification badge;
- disclosure;
- helpful votes;
- creator response;
- moderation status if relevant.

### 36.5 Historical warning

Old-version review:

> This review applies to version 1.8 and may not reflect the current release.

---

## 37. Creator Dashboard Presentation

Creator dashboard should show:

- new reviews;
- current-version ratings;
- recurring issues;
- unresolved questions;
- verified deployments;
- Labs feedback;
- response-rate metrics;
- version-specific trends.

Creators should be able to:

- respond;
- submit fix version;
- request correction;
- add release note;
- report abuse;
- export their own review data where allowed.

---

## 38. API Representation

### 38.1 Review summary

```json
{
  "resource_id": "res_...",
  "resource_version": "2.3.0",
  "review_count": 42,
  "verified_use_count": 18,
  "weighted_score": 4.4,
  "evidence_confidence": "MEDIUM",
  "setup_success_rate": 0.86,
  "task_success_rate": 0.79,
  "would_use_again_rate": 0.74
}
```

### 38.2 Review object

```json
{
  "id": "rev_...",
  "type": "VERIFIED_DEPLOYMENT",
  "resource_version": "2.3.0",
  "task": "Generate an investor presentation from Markdown",
  "runtime": "Codex",
  "platform": "macOS",
  "region": "Japan",
  "setup_result": "SUCCESS",
  "task_result": "COMPLETED",
  "ratings": {
    "setup": 4,
    "documentation": 4,
    "functional_accuracy": 5,
    "output_quality": 5,
    "reliability": 4
  },
  "verification": {
    "status": "VERIFIED",
    "public_evidence": false
  },
  "created_at": "2026-08-01T00:00:00Z"
}
```

### 38.3 Public exclusions

Do not expose:

- private evidence;
- internal fraud scores;
- device identifiers;
- IP addresses;
- private deployment URLs;
- moderation notes;
- legal records;
- reviewer email.

---

## 39. Event Model

Suggested events:

```text
comment.created
comment.updated
comment.reported
review.started
review.submitted
review.verified
review.rejected
review.moderated
review.appealed
review.appeal.decided
creator.response.created
creator.issue.resolved
evidence.uploaded
evidence.verified
evidence.expired
fraud.signal.detected
regional.report.created
ranking.recalculation.requested
verification.evidence.updated
workflow.evidence.updated
```

Every event should include:

- event ID;
- actor;
- subject;
- ResourceVersion;
- timestamp;
- schema version;
- correlation ID.

---

## 40. Ranking and Verification Integration

### 40.1 Ranking inputs

Community evidence may affect:

- Functional Effectiveness;
- Verified User Outcomes;
- Reliability;
- Compatibility;
- Verified Adoption;
- Creator Responsiveness;
- Evidence Confidence;
- Risk Status.

### 40.2 Verification inputs

Community evidence may support:

- Proven in Use;
- Functionally Tested corroboration;
- Quality Verified;
- AI ARK Verified;
- re-review;
- revocation.

### 40.3 No automatic badge

No quantity of community reviews automatically awards verification.

### 40.4 Severe issue impact

A credible severe issue may:

- trigger re-review;
- suspend ranking;
- suspend verification;
- disable install action;
- create public warning.

---

## 41. Workflow Recommendation Integration

The workflow engine should use evidence to answer:

- Which Resource succeeds most often for this step?
- Which environment shows fewer failures?
- Which Resource is accessible in this region?
- Which alternative has easier setup?
- Which Resource produces better output but costs more?
- Which Resource has unresolved compatibility issues?

### 41.1 Evidence freshness

Workflow recommendations should prefer current-version and recent evidence.

### 41.2 Explanation

A recommendation should be able to state:

> Recommended for Codex users because current verified reviews show a high setup-success rate and no unresolved critical issues.

---

## 42. Reviewer Reputation Later-Stage Model

A future reputation model may include:

```text
Verified-use history
Review helpfulness
Evidence accuracy
Issue reproduction
Labs completion
Domain expertise
Moderation history
Conflict disclosure
```

### 42.1 Reputation outputs

Potential:

- domain expertise;
- evidence reliability;
- contribution level.

### 42.2 Prohibited design

Do not create one opaque universal “trust score.”

### 42.3 Appeals

Users must be able to inspect and challenge reputation-affecting moderation or evidence decisions.

---

## 43. Operational Metrics

### Community activity

- comments;
- questions;
- structured reviews;
- verified reviews;
- creator responses;
- helpful votes.

### Evidence quality

- evidence acceptance rate;
- verification rate;
- private-evidence use;
- wrong-version rate;
- rejected-evidence reasons.

### Moderation

- report rate;
- severe reports;
- resolution time;
- appeal rate;
- reversal rate;
- spam rate;
- fraud clusters.

### Creator value

- response rate;
- issue-resolution rate;
- review-driven updates;
- creator retention.

### Product value

- review-to-install conversion;
- review-section engagement;
- workflow recommendation changes;
- ranking-confidence improvement.

---

## 44. Service-Level Targets

Initial validation targets:

```text
Severe report initial review       ≤24 hours
Normal report initial review       ≤72 hours
Private evidence verification      ≤5 business days
Creator claim on issue             Immediate notification
Moderation appeal decision         ≤10 business days
Secret exposure quarantine         Immediate
```

These are operational targets, not legal guarantees.

---

## 45. Security Requirements

- sanitize comment and review content;
- scan evidence uploads;
- prevent script execution;
- strip unsafe metadata;
- protect private evidence;
- rate-limit submissions;
- prevent automated review spam;
- validate links;
- block credential publication;
- audit moderator access;
- separate creator and moderator permissions.

---

## 46. Accessibility Requirements

- forms must be keyboard accessible;
- rating controls require text labels;
- validation errors must be announced;
- evidence-upload state must be accessible;
- moderation status cannot rely on color;
- review filters must be screen-reader usable;
- creator responses must have clear semantic labels.

---

## 47. Testing Strategy

### Unit tests

- review validation;
- version binding;
- rating aggregation;
- evidence-state transitions;
- moderation transitions;
- creator-response permissions;
- helpful-vote uniqueness.

### Contract tests

- API representations;
- event schemas;
- ranking contribution;
- verification evidence export;
- private-field exclusion.

### Fixture tests

- positive review;
- negative review;
- unknown version;
- creator conflict;
- paid review;
- fake evidence;
- secret exposure;
- old-version review;
- regional report;
- duplicate-account cluster.

### End-to-end tests

```text
use Resource
→ submit review
→ upload evidence
→ verify evidence
→ publish badge
→ update ranking input
```

### Moderation tests

- abuse;
- defamation risk;
- unsupported security claim;
- confidential data;
- creator retaliation;
- false positive appeal.

---

## 48. MVP Scope

### Include

- general comments;
- questions;
- creator responses;
- structured usage reviews;
- version binding;
- environment capture;
- rating dimensions;
- helpful votes;
- manual verified installation;
- manual verified deployment;
- manual verified beta test;
- limited verified production use;
- moderation;
- reporting;
- privacy-safe evidence;
- appeals;
- ranking contribution;
- API read access.

### Defer

- automated deployment verification;
- public reviewer score;
- financial rewards;
- complex reputation weighting;
- automated fraud enforcement;
- public evidence marketplace;
- real-time chat;
- direct messaging;
- broad social following;
- public organization verification workflow;
- on-chain evidence;
- automatic security claims.

---

## 49. Acceptance Criteria

The Community Review and Usage Evidence system is acceptable for MVP when:

### Comments

- users can post comments and questions;
- comments do not directly affect rank;
- creator responses are distinct;
- moderation and reporting work.

### Structured reviews

- reviews bind to a ResourceVersion;
- task and environment are captured;
- rating dimensions are optional but structured;
- current and historical versions are separated;
- disclosure is required.

### Verified usage

- installation, deployment, beta test, and production use remain distinct;
- evidence is required;
- private evidence is protected;
- public labels show scope;
- verification can expire.

### Ranking integration

- evidence types have explicit coefficients;
- small samples are smoothed;
- conflicts and fraud can remove ranking influence;
- negative evidence is preserved.

### Moderation

- severe content can be quarantined;
- creator cannot remove legitimate criticism;
- moderation actions are audited;
- appeals exist;
- secret exposure is handled immediately.

### Privacy

- users can use pseudonyms;
- private evidence is not exposed;
- retention is defined;
- deletion and redaction processes exist.

### API

- public review summaries exclude private data;
- version, task, environment, verification, and date are available;
- machine consumers can distinguish comments from verified usage.

---

## 50. Validation Metrics

The MVP should target:

- at least 25 structured reviews;
- at least ten verified-use evidence submissions;
- at least five creator responses;
- at least two recurring issues identified across users;
- at least one creator update based on feedback;
- no unresolved severe privacy or moderation failure;
- review completion rate established;
- median evidence-review time established;
- fewer than 10% of users confuse comments with verified reviews in usability testing.

---

## 51. Open Questions

1. Should general comments require sign-in?
2. Should reviews support public anonymity by default?
3. What exact evidence is sufficient for verified production use?
4. Should creators see private evidence summaries?
5. How long should private evidence be retained?
6. Should users be able to edit reviews after creator response?
7. How should a revised review affect ranking history?
8. Should organizations be able to submit one collective review?
9. How should AI agent-generated usage evidence be represented?
10. Should evidence verification require two reviewers at higher impact levels?
11. What minimum sample size allows public creator-response metrics?
12. Should highly incentivized beta reviews contribute to Quality Score?
13. How should private enterprise use contribute to Proven in Use?
14. When should an issue report create a public warning?
15. How should unsupported security allegations be displayed during review?
16. Should reviewer expertise be declared or verified?
17. How should regional reports expire?
18. Should creators be able to request follow-up testing from reviewers?
19. How should deleted accounts affect historical reviews?
20. What data can be exported by reviewers and creators?

---

## 52. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Creator and Labs Specification v1.0.md`

It should define:

- creator profiles;
- creator identity;
- resource claims;
- ownership verification;
- creator updates;
- creator analytics;
- AI ARK Labs campaigns;
- tester recruitment;
- tester selection;
- test-task design;
- incentives;
- confidentiality;
- Exclusive Beta;
- AI ARK First;
- Official AI ARK Page;
- launch partnerships;
- commercial disclosures;
- creator moderation boundaries;
- campaign evidence;
- lifecycle;
- API representation;
- acceptance criteria.

---

## 53. Final Community Direction

# AI ARK should turn user experience into structured, privacy-safe, version-aware evidence.

The system should not ask only:

> Did you like this Resource?

It should ask:

- What did you try?
- Which version did you use?
- In which environment?
- Did setup work?
- Did the task complete?
- What failed?
- Would you use it again?
- Can the outcome be verified?

That evidence should help:

- users choose better;
- creators improve faster;
- rankings become more rational;
- verification become more credible;
- workflows become more effective;
- agents receive better capability intelligence.

The community layer succeeds when participation improves truth rather than merely increasing activity.

---

**End of document**
