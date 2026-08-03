# AI ARK Ranking and Verification Standard v1.0

**Document status:** Trust, ranking, and verification governance baseline  
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
**Primary audience:** Product, trust and safety, data, ranking, verification, editorial, legal, creator relations, API, and engineering teams  

---

## 1. Purpose

This Standard defines how AI ARK evaluates, scores, ranks, tests, verifies, displays, audits, disputes, and re-reviews AI capabilities.

It establishes:

- ranking principles;
- category eligibility;
- lifecycle separation;
- score dimensions;
- weighting;
- normalization;
- popularity treatment;
- freshness;
- evidence confidence;
- review weighting;
- risk gates;
- ranking snapshots;
- methodology versioning;
- commercial independence;
- ranking appeals;
- verification levels;
- verification requirements;
- test and evidence standards;
- expiry;
- re-review;
- revocation;
- public methodology;
- conflict-of-interest controls;
- governance and audit.

This Standard applies initially to Skills and is designed to extend to:

- MCP servers;
- Agents;
- Plugins;
- Workflows;
- Connectors;
- other Resource types supported by AI ARK.

---

## 2. Strategic Objective

AI ARK should help users answer two different questions.

### Ranking question

> Among comparable resources, which ones appear most suitable and dependable based on current evidence?

### Verification question

> What has AI ARK actually confirmed about this specific version, within what scope, and with what limitations?

Ranking and verification must remain separate.

A high rank does not automatically grant verification.

Verification does not automatically make a Resource the highest-ranked option.

---

## 3. Foundational Principles

### 3.1 Evidence before authority

Every score and verification decision must be explainable through evidence, methodology, and scope.

### 3.2 Transparency before simplification

AI ARK may simplify complex findings for users, but it must preserve the underlying method and uncertainty.

### 3.3 Version before generalization

Ranking and verification must bind to a ResourceVersion.

### 3.4 Category fairness

Resources should be compared only against appropriate peers.

### 3.5 Lifecycle fairness

Beta resources should not compete directly against stable production resources in default rankings.

### 3.6 Risk cannot be bought away

Popularity, sponsorship, or creator payment cannot offset unresolved severe risk.

### 3.7 Commercial independence

Commercial relationships must not affect organic rank or verification outcome.

### 3.8 Confidence is separate from score

A high estimated score with weak evidence must display low confidence.

### 3.9 Human accountability

Consequential ranking overrides and verification decisions require accountable human review.

### 3.10 Appeals are part of integrity

Creators and affected parties must be able to challenge factual and procedural errors.

### 3.11 No absolute safety claims

Verification is scoped and cannot guarantee future safety, universal compatibility, or perfect performance.

### 3.12 Reproducibility

Given the same canonical data, methodology version, and time reference, ranking output should be reproducible.

---

## 4. Terminology

### 4.1 Quality Score

A normalized score representing current evidence about functional effectiveness, reliability, maintenance, documentation, compatibility, adoption, user outcomes, and creator responsiveness.

### 4.2 Category Rank

A Resource’s ordinal position among eligible peers in one category and lifecycle segment.

### 4.3 Momentum Score

A measure of recent change in adoption, maintenance, testing, community activity, and creator responsiveness.

### 4.4 Evidence Confidence

A measure of how strong, broad, current, and independent the supporting evidence is.

### 4.5 Risk Status

A separate status describing unresolved safety, security, rights, maintenance, or integrity concerns.

### 4.6 Verification Level

A version-specific status granted after a defined evaluation process.

### 4.7 Ranking Snapshot

An immutable record of ranking output at a point in time under one methodology version.

### 4.8 Methodology Version

A formal version of score dimensions, weights, normalization rules, risk gates, and eligibility requirements.

### 4.9 Eligible Resource

A ResourceVersion that satisfies the minimum requirements for a specific ranking.

### 4.10 Provisional Resource

A ResourceVersion permitted to appear in discovery but lacking enough evidence for stable ranking.

---

## 5. Ranking Outputs

AI ARK should not collapse all evaluation into one number.

Each public ranking record should expose:

```text
Quality Score
Category Rank
Momentum
Evidence Confidence
Risk Status
Lifecycle
Current Version
Last Evaluated
```

Example:

```text
AI ARK Quality Score       88/100
Presentation Skills Rank   #2
Momentum                   Rising
Evidence Confidence        High
Risk Status                Limited review; no critical issue identified
Lifecycle                  Stable
Version                    2.3.0
Last Evaluated             2026-08-01
```

---

## 6. Ranking Eligibility

### 6.1 Minimum eligibility

A ResourceVersion may enter a category ranking only when it has:

- canonical identity;
- current or explicitly selected version;
- primary category;
- sufficient source evidence;
- no unresolved critical identity dispute;
- no unresolved blocking rights issue;
- no unresolved critical safety issue;
- publication status `PUBLIC`;
- lifecycle compatible with the ranking segment;
- ranking evidence confidence above the segment minimum.

### 6.2 Eligibility states

```text
ELIGIBLE
PROVISIONAL
INSUFFICIENT_EVIDENCE
INELIGIBLE
SUSPENDED
REMOVED
```

### 6.3 Provisional inclusion

A new Resource may appear in:

- New and Promising;
- Rising;
- Beta Testing;
- Editorial Discovery.

It should not enter Best Verified until required evidence exists.

### 6.4 Ineligibility conditions

A ResourceVersion is ineligible when:

- canonical identity is unresolved;
- source is impersonated;
- severe malicious behavior is confirmed;
- license or distribution status makes publication unlawful;
- verification or ranking inputs are materially fraudulent;
- current version cannot be determined;
- lifecycle is archived for a stable-current ranking;
- the Resource is a confirmed duplicate.

### 6.5 Suspension conditions

Temporary suspension may occur for:

- serious unresolved security report;
- creator ownership dispute;
- manipulated reviews;
- hidden sponsorship;
- source removal;
- material update awaiting re-review;
- verification revocation review.

Suspended Resources may remain historically visible.

---

## 7. Ranking Segments

AI ARK should provide separate ranking segments.

### 7.1 Best Verified

Requirements:

- stable lifecycle;
- Source Verified;
- sufficient functional and usage evidence;
- no unresolved severe risk;
- current methodology eligibility.

### 7.2 Best Overall

Requirements:

- stable lifecycle;
- minimum evidence confidence;
- eligible for full Quality Score.

### 7.3 Most Adopted

Focus:

- verified installations;
- verified deployments;
- package usage;
- repeat use;
- source popularity.

Popularity must be normalized and cannot alone imply quality.

### 7.4 Rising

Focus:

- recent adoption growth;
- recent review growth;
- recent maintenance;
- recent test activity;
- creator responsiveness.

### 7.5 New and Promising

For new Resources with:

- strong initial documentation;
- clear value;
- credible source;
- positive early evidence;
- insufficient mature usage.

### 7.6 Beta Testing

For alpha, beta, release candidate, and AI ARK Labs campaigns.

### 7.7 Editor’s Picks

Editorial selections with explicit reasons.

Editor’s Picks are not algorithmic rank and must be labelled separately.

---

## 8. Category Eligibility

### 8.1 Primary category

Every ranked Resource should have one primary category for rank calculation.

Secondary categories may support discovery but should not automatically create multiple ranking positions.

### 8.2 Category fit

A Resource qualifies for a category when:

- its primary capabilities materially match;
- its primary tasks align;
- user expectations are comparable;
- evaluation dimensions remain meaningful among peers.

### 8.3 Category exclusion

A Resource should be excluded from a category when its connection is only incidental.

Example:

A general coding Skill that can create presentation code is not automatically a Presentation Skill.

### 8.4 Category methodology

A category may override default weights when justified.

Example:

Security-related resources may require higher reliability and risk weights.

### 8.5 Category changes

A primary category change requires:

- editorial review;
- reason;
- taxonomy version;
- ranking recalculation;
- audit record.

Historical ranking remains tied to the prior category.

---

## 9. Quality Score Model

### 9.1 Default formula

The initial default Quality Score is:

```text
Functional Effectiveness        25%
Verified User Outcomes          15%
Reliability and Reproducibility 15%
Maintenance and Freshness       10%
Documentation and Onboarding    10%
Compatibility Breadth           10%
Verified Adoption               10%
Creator Responsiveness           5%
```

Total:

```text
100%
```

### 9.2 Formula notation

```text
Q = 0.25F
  + 0.15U
  + 0.15R
  + 0.10M
  + 0.10D
  + 0.10C
  + 0.10A
  + 0.05S
```

Where each component is normalized to:

```text
0–100
```

### 9.3 Public score presentation

Risk and confidence should not be hidden inside the Quality Score.

A Resource may display:

```text
Quality Score 90
Evidence Confidence Low
```

rather than disguising uncertainty through an unexplained reduction.

---

## 10. Functional Effectiveness

### 10.1 Definition

Measures whether the Resource performs its claimed primary tasks successfully.

### 10.2 Inputs

- AI ARK functional tests;
- verified usage reviews;
- verified beta tests;
- production-use evidence;
- task completion;
- expected output match;
- creator-provided test evidence;
- reproducible demonstrations.

### 10.3 Evidence hierarchy

Highest weight:

1. independent AI ARK functional test;
2. verified production use;
3. verified deployment;
4. verified Labs test;
5. structured usage review;
6. creator demonstration;
7. source claim;
8. AI inference.

### 10.4 Scoring considerations

- primary-task success;
- output completeness;
- output accuracy;
- task-specific quality;
- failure severity;
- repeatability.

### 10.5 Missing evidence

If no real-use or test evidence exists, the component should remain provisional rather than defaulting to a high score.

---

## 11. Verified User Outcomes

### 11.1 Definition

Measures whether real users achieved meaningful outcomes.

### 11.2 Inputs

- verified production use;
- verified deployment;
- verified task completion;
- repeat-use declaration;
- time saved;
- business or technical outcome;
- workflow-step completion.

### 11.3 Initial evidence coefficients

```text
Verified production use       1.00
Verified deployment           0.85
Verified beta test            0.70
Verified installation         0.50
Structured unverified review  0.25
General comment               0.00
```

These are starting coefficients and must be calibrated.

### 11.4 Outcome diversity

Evidence from multiple users, environments, regions, and tasks should produce higher confidence than many nearly identical reports.

### 11.5 Fraud controls

- duplicate-account detection;
- creator self-review prohibition;
- conflict disclosure;
- suspicious timing detection;
- evidence sampling;
- manual review of unusual spikes;
- reviewer reputation later.

---

## 12. Reliability and Reproducibility

### 12.1 Definition

Measures whether installation and primary behavior work consistently.

### 12.2 Inputs

- repeated AI ARK tests;
- multi-environment results;
- setup success rate;
- task success rate;
- crash or failure rate;
- reproducible instructions;
- version stability;
- issue recurrence.

### 12.3 Dimensions

- installation reproducibility;
- runtime stability;
- output consistency;
- dependency stability;
- error recovery;
- version predictability.

### 12.4 Penalties

- undocumented failures;
- nondeterministic outcomes;
- severe version breakage;
- unreproducible installation;
- repeated unresolved issues.

---

## 13. Maintenance and Freshness

### 13.1 Definition

Measures whether the Resource remains current and maintained.

### 13.2 Inputs

- recent releases;
- meaningful commits;
- source availability;
- issue response;
- compatibility updates;
- documentation updates;
- archived status;
- stale dependencies.

### 13.3 Freshness decay

Each category may use a different expected maintenance interval.

Example:

```text
Fast-changing coding Skill: stronger decay after 90–180 days
Stable template or reference Skill: slower decay
Hosted MCP service: operational checks more important than commits
```

### 13.4 Meaningful activity

Do not treat the following as substantive maintenance:

- badge changes;
- automated dependency noise;
- formatting-only commits;
- meaningless release increments.

### 13.5 Inactivity

A Resource may remain useful despite inactivity.

Scoring should consider actual functionality and category norms.

---

## 14. Documentation and Onboarding

### 14.1 Definition

Measures whether users can understand, install, configure, and use the Resource.

### 14.2 Inputs

- README quality;
- `SKILL.md` quality;
- installation clarity;
- prerequisites;
- examples;
- suggested prompts;
- troubleshooting;
- release notes;
- uninstall guidance;
- permission disclosure;
- regional limitations.

### 14.3 Dimensions

- completeness;
- clarity;
- accuracy;
- consistency;
- accessibility;
- source alignment;
- beginner suitability.

### 14.4 AI ARK editorial content

AI ARK-generated explanation may improve the user experience but should not fully compensate for weak underlying creator documentation.

---

## 15. Compatibility Breadth

### 15.1 Definition

Measures breadth and quality of supported runtimes and platforms.

### 15.2 Evidence weighting

```text
Tested by AI ARK       Highest
Explicit in source     High
Creator declared       Medium-high
Community reported     Medium
Likely compatible      Low
Unknown                None
```

### 15.3 Breadth versus depth

Supporting many runtimes superficially should not automatically outrank deep reliability on one runtime.

### 15.4 Regional compatibility

Regional runtime availability remains a separate status rather than being hidden inside global compatibility.

---

## 16. Verified Adoption

### 16.1 Definition

Measures meaningful usage rather than raw attention.

### 16.2 Inputs

- verified installations;
- verified deployments;
- package usage;
- repeat use;
- source stars;
- forks;
- saves;
- workflow inclusion;
- active organizations where verifiable.

### 16.3 Popularity normalization

Use logarithmic transformation where appropriate.

Example:

```text
normalized_popularity = log(1 + raw_value)
```

### 16.4 Metric separation

GitHub stars, package downloads, AI ARK saves, and verified deployments are different signals.

Each metric needs:

- source;
- definition;
- time window;
- normalization;
- confidence;
- fraud controls.

### 16.5 Anti-gaming

- velocity anomaly detection;
- source reconciliation;
- duplicate-install detection where possible;
- exclusion of paid traffic;
- manual review of suspicious campaigns.

---

## 17. Creator Responsiveness

### 17.1 Definition

Measures how effectively the creator addresses legitimate feedback and maintenance needs.

### 17.2 Inputs

- response rate;
- median response time;
- issue acknowledgment;
- fix completion;
- documentation update;
- release after confirmed defect;
- unresolved critical issue count.

### 17.3 Context

A solo creator should not be measured exactly like a large company.

### 17.4 No engagement farming

Short or meaningless replies do not count as useful responsiveness.

---

## 18. Momentum Score

### 18.1 Purpose

Momentum identifies emerging Resources without confusing short-term activity with mature quality.

### 18.2 Inputs

- adoption growth;
- review growth;
- verified-use growth;
- source activity;
- release activity;
- creator response;
- workflow inclusion;
- Labs participation.

### 18.3 Time windows

Recommended:

- 7 days;
- 30 days;
- 90 days.

### 18.4 Public states

```text
Rapidly Rising
Rising
Stable
Cooling
Insufficient Data
```

### 18.5 Exclusions

Exclude or down-weight:

- paid campaign traffic;
- suspicious spikes;
- creator self-generated activity;
- automated dependency commits;
- unrelated platform-wide events.

---

## 19. Evidence Confidence

### 19.1 Purpose

Evidence Confidence indicates how much trust users should place in the estimated ranking.

### 19.2 Dimensions

```text
Evidence quantity
Evidence quality
Evidence independence
Evidence diversity
Evidence recency
Version alignment
Method consistency
Conflict level
```

### 19.3 Conceptual formula

```text
Confidence =
Quality
× Diversity
× Recency
× Version Alignment
× Independence
× Conflict Adjustment
```

### 19.4 Public levels

```text
HIGH
MEDIUM
LOW
INSUFFICIENT
```

### 19.5 Example

```text
Quality Score: 91
Evidence Confidence: Low
```

The Resource appears strong, but the available evidence remains limited.

### 19.6 Confidence is not popularity

A niche Resource with strong independent tests may have higher confidence than a popular Resource supported mostly by stars.

---

## 20. Review Aggregation

### 20.1 Bayesian averaging

Simple arithmetic averages should not determine public scores.

Recommended model:

```text
Bayesian Score =
(v / (v + m)) × R
+
(m / (v + m)) × C
```

Where:

- `R` = Resource average;
- `v` = weighted review count;
- `C` = category prior;
- `m` = minimum evidence threshold.

### 20.2 Weighted review count

Verified reviews receive greater weight than unverified reviews.

### 20.3 Current-version emphasis

Current-version reviews receive primary public emphasis.

Historical reviews remain relevant to long-term reliability.

### 20.4 Freshness

Recent reviews receive more relevance when the Resource changed materially.

### 20.5 Negative review integrity

Verified negative reviews must not be suppressed because of creator or commercial relationships.

---

## 21. Risk Gates

### 21.1 Separate risk model

Risk functions as:

```text
Eligibility gate
+
Penalty
+
Warning
+
Possible suspension or disqualification
```

### 21.2 Risk categories

- malicious behavior;
- credential exposure;
- destructive commands;
- severe privacy issue;
- insecure dependency;
- impersonation;
- rights violation;
- review manipulation;
- hidden sponsorship;
- abandoned critical dependency;
- regional legal or access issue.

### 21.3 Risk statuses

```text
NO_CRITICAL_ISSUE_IDENTIFIED
LIMITED_REVIEW
UNRESOLVED_RISK
SEVERE_RISK
NOT_EVALUATED
```

### 21.4 Gate behavior

#### Critical confirmed risk

- ranking ineligible;
- verification suspended or revoked;
- public warning;
- install action may be disabled.

#### High unresolved risk

- provisional or suspended;
- trust review required;
- rank may be hidden.

#### Moderate risk

- may rank with visible penalty or warning.

### 21.5 Meaning of “No critical issue identified”

It means only:

> No critical issue was identified within the current review scope.

It does not mean “safe.”

---

## 22. Category Normalization

### 22.1 Purpose

Raw metrics differ across categories.

### 22.2 Methods

Potential methods:

- percentile within category;
- z-score with outlier control;
- capped logarithmic scale;
- lifecycle-specific priors;
- category-specific maintenance intervals.

### 22.3 Sparse categories

When there are insufficient peers:

- do not publish ordinal rank;
- show Quality Score and Confidence;
- label ranking provisional.

### 22.4 Initial threshold

- at least five eligible Resources for public ordinal rank;
- at least ten preferred for a robust ranking.

---

## 23. Lifecycle Separation

### Stable

Eligible for:

- Best Overall;
- Best Verified;
- Most Adopted.

### Beta

Eligible for:

- Beta Testing;
- New and Promising;
- Rising Beta.

### Experimental

Eligible only for explicitly experimental discovery.

### Deprecated

Excluded from default ranking.

### Archived

Excluded from current ranking but retains historical snapshots.

---

## 24. Ranking Calculation Process

```text
1. Select category and lifecycle segment
2. Apply eligibility rules
3. Resolve current ResourceVersion
4. Collect canonical metrics
5. Validate evidence freshness
6. Compute normalized component scores
7. Apply review weighting
8. Compute Evidence Confidence
9. Apply Risk Gate
10. Compute Quality Score
11. Compute Momentum
12. Assign Category Rank
13. Record immutable RankingSnapshot
14. Run anomaly checks
15. Publish under governance rules
```

---

## 25. Ranking Snapshot

Every public ranking update must record:

- Resource;
- ResourceVersion;
- category;
- lifecycle segment;
- methodology version;
- component scores;
- Quality Score;
- rank;
- Momentum;
- Evidence Confidence;
- Risk Status;
- eligibility;
- data cutoff;
- calculation time;
- manual adjustment;
- audit reference.

---

## 26. Recalculation Triggers

- new ResourceVersion;
- material source update;
- new verified review;
- new test;
- verification change;
- risk change;
- regional change where relevant;
- creator-response change;
- methodology update;
- scheduled refresh.

Suggested cadence:

```text
High-activity categories: daily or weekly
Stable categories: weekly
Low-activity categories: monthly
Severe-risk change: immediate
```

---

## 27. Manual Adjustments

### 27.1 Default

Manual adjustment should be rare.

### 27.2 Permitted cases

- confirmed data corruption;
- source-metric anomaly;
- duplicate inflation;
- fraud;
- methodology bug;
- emergency risk intervention.

### 27.3 Required record

- actor;
- reason;
- original value;
- adjusted value;
- expiry;
- evidence;
- approval;
- audit event.

### 27.4 Prohibited reasons

- sponsorship;
- creator relationship;
- launch partnership;
- payment;
- editorial preference alone;
- competitive pressure.

---

## 28. Ranking Appeals

### 28.1 Eligible appellants

- verified creator;
- organization owner;
- user with evidence;
- editor;
- trust reviewer.

### 28.2 Grounds

- wrong identity;
- wrong version;
- factual error;
- ignored evidence;
- fraudulent review;
- category error;
- methodology error;
- conflict of interest;
- commercial influence.

### 28.3 Process

```text
Appeal submitted
↓
Eligibility review
↓
Evidence review
↓
Independent reviewer
↓
Decision
↓
Correction or rejection
↓
Public explanation where material
```

### 28.4 States

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

### 28.5 Independence

The original decision-maker should not be the sole appeal reviewer.

---

## 29. Commercial Independence

### 29.1 Required separation

Maintain separate systems for:

- organic ranking;
- verification;
- sponsored placement;
- launch partnership;
- creator subscription;
- paid evaluation.

### 29.2 Prohibited influence

Commercial relationships may not:

- increase organic score;
- alter rank;
- lower evidence thresholds;
- bypass risk gates;
- guarantee verification;
- suppress legitimate negative reviews;
- delay adverse updates.

### 29.3 Disclosure

Public disclosure should state:

> AI ARK has a commercial relationship with this creator. This relationship does not affect organic ranking or verification.

### 29.4 Paid evaluation

A fee may purchase:

- scheduling;
- testing effort;
- report preparation.

It does not purchase:

- a successful result;
- a badge;
- ranking benefit.

---

# Part II — Verification Standard

## 30. Verification Philosophy

Verification answers:

> What did AI ARK confirm about this version, using which evidence, under which conditions?

Verification is:

- scoped;
- versioned;
- dated;
- evidence-backed;
- expiring;
- reviewable;
- revocable.

---

## 31. Verification Levels

### Level 1 — Source Verified

Confirms:

- canonical source;
- creator or organization identity;
- ownership or authorization;
- license status;
- selected version.

### Level 2 — Functionally Tested

Confirms:

- installation or access completed;
- defined scenarios executed;
- core functionality reproduced;
- environment and version documented.

### Level 3 — Quality Verified

Confirms:

- quality threshold passed;
- documentation met standard;
- reliability criteria satisfied;
- no unresolved disqualifying risk identified within scope;
- evaluation evidence sufficient.

### Level 4 — Proven in Use

Confirms:

- meaningful verified adoption;
- real-user outcomes;
- acceptable failure profile;
- sufficient environment diversity;
- current-version relevance.

### Level 5 — AI ARK Verified

Confirms the required lower levels and adequate real-use evidence under the current methodology.

---

## 32. Level Independence

A Resource may be:

```text
Source Verified
Functionally Tested
Quality Verified
Not yet Proven in Use
```

It should not display AI ARK Verified until all top-level requirements are met.

---

## 33. Source Verified Requirements

### Required evidence

- canonical source;
- stable Resource identity;
- creator or organization verification;
- ownership or authorization;
- license or rights status;
- version or immutable snapshot;
- no unresolved impersonation dispute.

### Acceptable ownership evidence

- repository control;
- signed verification file;
- organization domain;
- official website linkage;
- package namespace control;
- registry ownership;
- manual identity evidence.

### Does not confirm

- functional quality;
- security;
- adoption;
- compatibility;
- maintenance.

### Re-review triggers

- ownership transfer;
- source change;
- domain loss;
- repository transfer;
- creator dispute;
- prolonged inactivity.

---

## 34. Functionally Tested Requirements

### Preconditions

- Source Verified;
- testable current version;
- documented installation or access;
- defined environment;
- defined scenario;
- no blocking risk.

### Required test evidence

- exact version;
- environment;
- setup steps;
- input;
- expected output;
- actual output;
- result;
- logs or evidence;
- evaluator;
- date;
- limitations.

### Minimum scenarios

- one installation or access scenario;
- one primary functional scenario;
- one error or limitation observation where practical.

### Result states

```text
PASS
PARTIAL_PASS
FAIL
INCONCLUSIVE
ABORTED
```

### Award rule

Requires:

- installation or access success;
- primary function success;
- no undisclosed critical failure within tested scope.

### Public example

> AI ARK reproduced the primary presentation workflow using version 2.3.0 in Codex on macOS.

---

## 35. Quality Verified Requirements

### Preconditions

- Source Verified;
- Functionally Tested;
- sufficient documentation;
- acceptable reliability;
- acceptable Risk Status;
- no unresolved critical rights issue.

### Quality dimensions

- effectiveness;
- reliability;
- documentation;
- compatibility accuracy;
- setup quality;
- output quality;
- maintainability;
- limitation transparency.

### Minimum evidence

- at least one AI ARK functional test;
- documentation review;
- dependency and permission review;
- risk review;
- current-version evaluation;
- methodology-compliant scoring.

### Initial threshold proposal

```text
Quality Score ≥80
Evidence Confidence ≥Medium
Risk Status not Severe
```

The threshold remains provisional until validation.

### Does not necessarily mean

- broad use;
- enterprise readiness;
- universal compatibility;
- full security audit.

---

## 36. Proven in Use Requirements

### Purpose

Confirm meaningful real-world adoption and outcomes.

### Required dimensions

- verified user count;
- verified deployment count;
- task diversity;
- environment diversity;
- recency;
- success outcomes;
- failure profile;
- repeat use.

### Provisional MVP threshold

- at least ten verified-use events;
- at least five distinct users;
- at least two environments or task contexts where relevant;
- no unresolved severe systemic failure;
- majority current-version evidence.

### Niche exception

Specialized Resources may use lower volume with stronger expert evidence.

The exception must be disclosed.

---

## 37. AI ARK Verified Requirements

### Preconditions

- Source Verified;
- Functionally Tested;
- Quality Verified;
- Proven in Use;
- current version;
- active verification period;
- no unresolved severe risk;
- no material ownership or rights dispute.

### Public meaning

> AI ARK confirmed the canonical source, reproduced defined core functionality, evaluated quality within a published scope, and reviewed sufficient current real-use evidence.

### Required public report

- Resource and version;
- level;
- evaluation date;
- expiry;
- methodology;
- environments;
- scenarios;
- evidence summary;
- score;
- limitations;
- unresolved risks;
- conflicts;
- evaluator;
- appeal process.

---

## 38. Methodology Versioning

Every VerificationRecord must reference a VerificationMethodology.

Methodology changes create a new version.

Historical verification remains tied to the original methodology.

The methodology defines:

- eligibility;
- prerequisites;
- testing;
- evidence;
- thresholds;
- expiry;
- revocation;
- category exceptions;
- appeals.

---

## 39. Verification Application

### Application sources

- creator request;
- AI ARK editorial nomination;
- Labs completion;
- community evidence threshold;
- enterprise evaluation request.

### Application fields

- Resource;
- version;
- requested level;
- creator identity;
- source;
- environment;
- known limitations;
- existing evidence;
- conflict disclosure;
- commercial disclosure.

### States

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
WITHDRAWN
APPEALED
EXPIRED
REVOKED
SUPERSEDED
```

---

## 40. Evaluator Roles

- Source Reviewer;
- Functional Tester;
- Quality Reviewer;
- Trust and Safety Reviewer;
- Verification Decision Authority.

One person may hold multiple roles during MVP, but conflicts must be documented.

### Independence rules

- the creator cannot be sole evaluator;
- a commercial-sales owner should not be sole decision authority;
- higher-risk cases require independent trust review.

### Competence factors

- Resource type;
- runtime;
- category;
- region;
- security sensitivity;
- language.

---

## 41. Test Environment Requirements

Record:

- operating system;
- runtime;
- runtime version;
- hardware where relevant;
- region;
- network context;
- dependency versions;
- credential type without secrets;
- installation source;
- ResourceVersion;
- date.

### Reproducibility

A qualified evaluator should be able to reproduce the test within reasonable limits.

### Scope limitation

A pass in one environment must not be described as universal compatibility.

---

## 42. Verification Evidence

### Acceptable evidence

- source metadata;
- canonical files;
- installation logs;
- test logs;
- screenshots;
- output artifacts;
- deployment proof;
- API receipts;
- creator confirmation;
- verified user evidence;
- checksums;
- regional tests.

### Quality properties

Evidence should be:

- authentic;
- relevant;
- current;
- version-aligned;
- sufficiently detailed;
- privacy-safe;
- retained.

### Private evidence

Private evidence may support a public conclusion.

Public report:

> Private evidence reviewed by AI ARK.

### Integrity controls

For sensitive evaluations:

- file hash;
- timestamp;
- access log;
- chain of custody;
- reviewer identity.

---

## 43. Verification Decision

### Decision options

```text
AWARD
DENY
DEFER
REMEDIATION_REQUIRED
REVOKE
EXPIRE
```

### Required decision record

- level;
- ResourceVersion;
- methodology;
- evidence;
- findings;
- limitations;
- risk;
- reason;
- evaluator;
- decision authority;
- date;
- expiry;
- appeal route.

Every public badge must correspond to a VerificationRecord.

---

## 44. Remediation

### Purpose

Allow correctable issues to be resolved before final denial.

### Examples

- clarify documentation;
- correct installation;
- remove unsafe command;
- disclose permission;
- fix compatibility;
- supply missing evidence;
- resolve license ambiguity.

### Result

After remediation:

- create new ResourceVersion or snapshot;
- rerun relevant tests;
- preserve prior findings;
- issue new decision.

---

## 45. Expiry

### Suggested initial windows

```text
Source Verified          12 months
Functionally Tested       6 months
Quality Verified          6 months
Proven in Use             6–12 months
AI ARK Verified           6 months
```

Category-specific windows may differ.

### Public states

- Active;
- Expiring soon;
- Expired;
- Under re-review.

Expired verification remains historically visible but inactive.

---

## 46. Re-Review Triggers

- major release;
- ownership change;
- license change;
- dependency change;
- permission change;
- severe review;
- source archived;
- compatibility change;
- regional availability change;
- methodology change where required;
- expiry.

The Resource Intelligence Pipeline should emit:

```text
verification.review.required
```

when a material change affects active verification.

---

## 47. Revocation

### Conditions

- malicious behavior;
- falsified evidence;
- impersonation;
- severe undisclosed risk;
- invalid test;
- invalid rights status;
- manipulated usage evidence;
- methodology breach.

### Emergency suspension

Trust and Safety may suspend badges immediately pending investigation.

### Public notice

Material revocation should show:

- date;
- affected version;
- reason category;
- status;
- appeal availability.

Sensitive security details may remain restricted.

---

## 48. Verification Appeals

### Grounds

- wrong version;
- test error;
- missing evidence;
- evaluator conflict;
- methodology error;
- factual error;
- remediation ignored.

### Review independence

The original sole decision-maker should not decide the appeal alone.

### Outcomes

```text
UPHELD
PARTIALLY_UPHELD
REJECTED
NEW_EVALUATION_REQUIRED
```

---

## 49. Public Presentation

### Ranking display

Show:

- score;
- rank;
- confidence;
- version;
- date;
- lifecycle;
- methodology link.

### Verification display

Show:

- exact level;
- version;
- date;
- expiry;
- scope;
- limitations;
- report link.

### Label separation

These must not be visually confusing:

- Sponsored;
- AI ARK First;
- Exclusive Beta;
- Source Verified;
- Quality Verified;
- AI ARK Verified.

### Trust language

Use:

- Tested in;
- Verified for;
- Evidence supports;
- No critical issue identified within scope.

Avoid:

- Guaranteed;
- Safe;
- Best in all cases;
- Fully secure;
- Works everywhere.

---

## 50. API Representation

Ranking example:

```json
{
  "quality_score": 88.2,
  "category_rank": 2,
  "category_id": "presentation",
  "momentum": "RISING",
  "evidence_confidence": "HIGH",
  "risk_status": "LIMITED_REVIEW",
  "resource_version": "2.3.0",
  "methodology_version": "ranking-v1.0",
  "calculated_at": "2026-08-01T00:00:00Z"
}
```

Verification example:

```json
{
  "level": "QUALITY_VERIFIED",
  "status": "AWARDED",
  "resource_version": "2.3.0",
  "methodology_version": "quality-v1.0",
  "awarded_at": "2026-08-01T00:00:00Z",
  "expires_at": "2027-02-01T00:00:00Z",
  "scope": [
    "Installation",
    "Primary presentation workflow",
    "Codex on macOS"
  ],
  "limitations": [
    "Not tested on Windows",
    "No full security audit performed"
  ]
}
```

---

## 51. Audit Requirements

Audit events include:

- methodology created;
- methodology changed;
- eligibility changed;
- score calculated;
- manual adjustment;
- rank published;
- appeal submitted;
- appeal decided;
- verification requested;
- test started;
- test completed;
- verification awarded;
- verification denied;
- verification expired;
- verification revoked.

Audit records are append-only.

---

## 52. Governance Structure

### Ranking Methodology Authority

Owns:

- dimensions;
- weights;
- normalization;
- eligibility;
- category rules;
- methodology versions.

### Verification Authority

Owns:

- criteria;
- test standards;
- decisions;
- expiry;
- revocation.

### Trust and Safety Authority

Owns:

- risk gates;
- severe-risk intervention;
- review fraud;
- malicious Resource handling.

### Editorial Authority

Owns:

- category assignment;
- factual content;
- evidence quality;
- creator corrections.

### Commercial Operations

Must not control:

- organic ranking;
- verification decisions;
- risk overrides.

---

## 53. Mainland China Governance Considerations

AI ARK’s Mainland ranking and recommendation experience should be designed for:

- transparent rules;
- sponsored-content separation;
- appeal and correction;
- human intervention;
- user controls where applicable;
- documented algorithm governance;
- lawful data processing;
- regional methodology review.

Specialist legal and compliance review is required before Mainland launch.

---

## 54. Validation Plan

### Ranking validation

Test whether users:

- understand score;
- understand confidence;
- understand rank;
- can explain rank differences;
- trust methodology;
- notice commercial separation.

### Verification validation

Test whether users:

- understand levels;
- understand scope;
- understand expiry;
- avoid interpreting verification as absolute safety;
- value verification.

### Creator validation

Test whether creators:

- consider methodology fair;
- accept version-specific evaluation;
- use appeals appropriately;
- distinguish paid evaluation from paid badge;
- value remediation.

### Quantitative targets

- ≥70% correctly explain Quality Score versus Confidence;
- ≥70% distinguish Source Verified from Quality Verified;
- ≥80% identify sponsored content correctly;
- ≥60% report verification improves confidence;
- <10% interpret AI ARK Verified as unlimited security assurance after reviewing the explanation.

---

## 55. MVP Implementation Scope

### Include

- Quality Score;
- Category Rank;
- Momentum;
- Evidence Confidence;
- Risk Status;
- lifecycle segmentation;
- immutable snapshots;
- public methodology;
- Source Verified;
- five Functionally Tested pilots;
- limited Quality Verified pilots;
- appeals;
- expiry;
- re-review;
- commercial separation.

### Defer

- fully automated publication of rankings;
- advanced reviewer reputation;
- cryptographically signed reports;
- paid evaluation billing;
- enterprise rankings;
- predictive risk scoring;
- autonomous verification;
- universal security certification;
- complex cross-category ranking;
- large public rank-history views.

---

## 56. Acceptance Criteria

### Ranking

- every public rank references category, lifecycle, version, methodology, and date;
- Quality Score and Confidence are separate;
- popularity is normalized;
- reviews use weighted aggregation;
- risk gates can suspend eligibility;
- sponsorship does not influence rank;
- manual adjustments are audited;
- appeals exist;
- ranking snapshots are immutable.

### Verification

- every badge corresponds to a VerificationRecord;
- verification binds to one version;
- scope and limitations are public;
- expiry is enforced;
- re-review and revocation exist;
- payment cannot guarantee outcome;
- verification levels remain distinct.

### Governance

- methodology versions become immutable when active;
- conflicts are disclosed;
- commercial teams cannot override trust decisions;
- appeals are recorded;
- audits are complete.

### UX

- users can access methodology;
- users can inspect score components;
- score and confidence are distinguishable;
- commercial labels and verification are distinguishable;
- verification limitations are visible.

---

## 57. Open Questions

1. Should Quality Score be shown as an integer or decimal?
2. What minimum Confidence permits ordinal rank?
3. When should category-specific weights become public?
4. How should stars and downloads be combined?
5. What decay curves should categories use?
6. How should closed-source tools be scored for maintenance?
7. Should Editor’s Picks influence search?
8. Should regional limitations affect global rank?
9. What verified-use threshold defines Proven in Use by category?
10. How should reviewer reputation change weighting later?
11. Should responsiveness be excluded where support is not expected?
12. What confidence model best serves sparse niches?
13. Should higher verification require two evaluators?
14. Which evidence should be public by default?
15. How should private enterprise evidence contribute?
16. When should paid evaluation launch?
17. What is the target appeal turnaround?
18. How should methodology-driven rank changes be labelled?
19. How should workflow usage affect adoption?
20. Can agent usage count as verified adoption, and under what evidence standard?

---

## 58. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Community Review and Usage Evidence Specification v1.0.md`

It should define:

- comments;
- questions;
- creator responses;
- structured usage reviews;
- verified installation;
- verified deployment;
- verified production use;
- evidence submission;
- reviewer identity;
- version binding;
- environment capture;
- moderation;
- fraud prevention;
- helpful votes;
- privacy;
- reviewer reputation foundation;
- ranking contribution;
- creator response metrics;
- appeals;
- retention;
- API representation;
- acceptance criteria.

---

## 59. Final Standard

# AI ARK ranking should help users compare, while AI ARK verification should show what was actually confirmed.

Ranking is an evidence-based comparative estimate.

Verification is a scoped factual evaluation.

Neither should become:

- a popularity contest;
- a paid badge;
- a hidden editorial preference;
- a universal safety claim;
- a permanent judgment.

The system earns trust when users can see:

- what was measured;
- why it matters;
- how current it is;
- how strong the evidence is;
- what remains uncertain;
- who made the decision;
- how the decision can be challenged.

---

**End of document**
