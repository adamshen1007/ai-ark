# AI ARK MVP Product Requirements Document v1.0

**Document status:** Product requirements baseline  
**Version:** 1.0  
**Date:** August 1, 2026  
**Working product name:** AI ARK  
**Brand status:** Working name pending legal, trademark, domain, and search-ownership clearance  
**Product stage:** Validation MVP  
**Decision basis:** `AI ARK Worthiness Review v1.1.md`  
**Strategic foundation:** `AI ARK Product Vision and Positioning v1.0.md`  
**Primary audience:** Founder, product, design, engineering, editorial, data, trust and safety, and future creator partners  

---

## 1. Document Purpose

This Product Requirements Document defines the first validation MVP for AI ARK.

The MVP is intended to determine whether AI ARK can become a trusted discovery and intelligence layer for AI capabilities, beginning with Skills.

This document translates the approved product vision into:

- MVP objectives;
- target users;
- user journeys;
- scope;
- functional requirements;
- non-functional requirements;
- content and editorial requirements;
- ranking and verification requirements;
- community and creator requirements;
- workflow and API requirements;
- regional-availability requirements;
- analytics and validation metrics;
- release gates;
- explicit exclusions;
- acceptance criteria.

This document does not define the complete long-term product.

It defines the smallest coherent system that can validate the core opportunity without prematurely building:

- a transactional marketplace;
- broad MCP and Agent coverage;
- automatic execution;
- enterprise governance;
- large-scale automated publication;
- permanent creator exclusivity;
- a general AI news business.

---

## 2. Executive Product Summary

# AI ARK MVP helps users find, understand, compare, and act on high-quality AI Skills.

The MVP should provide:

1. a curated Skill discovery website;
2. task-oriented search;
3. structured resource detail pages;
4. category rankings;
5. creator profiles;
6. comments and structured usage reviews;
7. curated workflows;
8. Mainland China availability information;
9. a GitHub URL-to-draft ingestion pipeline;
10. a human editorial review console;
11. a limited verification pilot;
12. a read-oriented API for AI systems and future FounderOS integration;
13. limited creator-claim and beta-campaign functionality.

The MVP should prove that AI ARK can transform fragmented source material into trusted, useful, decision-ready capability dossiers.

---

## 3. Product Goal

### 3.1 Primary goal

Validate that users prefer AI ARK for capability discovery when compared with searching GitHub, social platforms, or conventional directories.

### 3.2 Secondary goals

Validate that:

- creators value AI ARK pages and distribution;
- users contribute useful review and usage evidence;
- task-based workflows produce more value than isolated listings;
- AI-generated drafts can be reviewed efficiently and accurately;
- rankings and verification increase user confidence;
- structured API responses are useful to agents and FounderOS;
- Mainland availability information is valuable and operationally maintainable.

### 3.3 Non-goal

The MVP is not intended to maximize revenue, catalogue size, or market share.

Its purpose is to answer:

> Can AI ARK create trusted discovery value and operate the evidence pipeline economically?

---

## 4. Product Hypotheses

The MVP should test the following hypotheses.

### H1 — Curated resource pages improve decision quality

Users will find AI ARK resource pages more useful than raw repositories or generic listings.

### H2 — Task-oriented search improves discovery

Users will search by outcome and benefit from intent-aware results.

### H3 — Rankings increase confidence when methodology is transparent

Users will use category rankings if the score components and evidence confidence are visible.

### H4 — Creator identity and claims improve trust

Creators will claim, correct, and share high-quality AI ARK pages.

### H5 — Structured reviews create useful evidence

Users will provide environment- and version-specific feedback when the process is clear.

### H6 — Curated workflows create higher-value sessions

Users will engage with ordered capability paths rather than only individual resources.

### H7 — The ingestion pipeline reduces editorial cost

AI-generated drafts can reach publication quality with limited human correction.

### H8 — Regional availability matters

Mainland China users will value accurate accessibility and alternative information.

### H9 — Agents can use the same intelligence layer

A structured read API can support capability discovery without automatic execution.

---

## 5. Target Users

### 5.1 Primary user: AI-enabled developer

#### Characteristics

- uses Codex, Claude Code, Cursor, OpenClaw, Hermes, TRAE, Kimi, or similar tools;
- discovers resources through GitHub and communities;
- understands basic installation concepts;
- has a specific task to accomplish;
- can provide technical feedback.

#### Primary need

> Find a reliable Skill for a specific task without reading many repositories.

---

### 5.2 Secondary user: founder or technical operator

#### Characteristics

- searches by outcome rather than package name;
- may not understand Skill or MCP formats deeply;
- values practical workflows;
- wants clear recommendations and setup guidance.

#### Primary need

> Turn a business or product objective into a usable AI-assisted workflow.

---

### 5.3 Creator

#### Characteristics

- publishes an AI Skill;
- wants distribution, testers, feedback, or recognition;
- may maintain a GitHub repository;
- may need bilingual presentation.

#### Primary need

> Get a professional page, relevant users, and structured evidence without building a separate launch platform.

---

### 5.4 Tester and reviewer

#### Characteristics

- willing to test emerging capabilities;
- can describe setup environment and outcomes;
- may participate in beta campaigns;
- values reputation and recognition.

#### Primary need

> Discover promising resources and contribute credible feedback.

---

### 5.5 Agent or external application

#### Characteristics

- consumes structured APIs;
- needs deterministic records;
- cannot rely only on visual pages;
- requires provenance, compatibility, and freshness.

#### Primary need

> Retrieve capability candidates with enough evidence for planning and recommendation.

---

### 5.6 Editorial administrator

#### Characteristics

- sources and reviews candidate resources;
- needs efficient import and correction workflows;
- must distinguish fact from inference;
- manages lifecycle and moderation.

#### Primary need

> Publish accurate, complete resource pages with minimal repetitive work.

---

## 6. MVP Product Principles

### 6.1 Curated before comprehensive

The MVP should launch with 100–150 carefully selected Skills rather than thousands of automatically indexed entries.

### 6.2 Human-reviewed publication

No resource may be published directly from automated generation.

### 6.3 Source-grounded facts

Material factual fields must include source evidence.

### 6.4 Version-aware evaluation

Reviews, verification, compatibility, and ranking evidence should bind to versions where possible.

### 6.5 Transparent uncertainty

Inferred compatibility and incomplete evidence must be labelled.

### 6.6 Neutral ranking

Commercial relationships must not influence organic rankings.

### 6.7 Discovery before execution

The MVP may provide installation instructions but must not automatically execute third-party code.

### 6.8 Community for evidence

Comments and reviews exist to improve decision quality, not maximize engagement.

### 6.9 Workflow before content volume

A small number of useful workflows is more valuable than a large article library.

### 6.10 Regional truth

Mainland availability must distinguish information, artifact, installation, and runtime status.

---

## 7. MVP Scope Summary

### 7.1 Included

#### Public discovery

- homepage;
- search;
- Skill directory;
- category pages;
- rankings;
- new resources;
- curated collections;
- resource detail pages;
- creator profiles;
- curated workflows;
- comments;
- structured usage reviews;
- regional-availability information.

#### Creator functions

- claim creator profile;
- claim resource;
- submit corrections;
- respond to reviews;
- submit a new resource;
- apply for limited beta testing;
- express interest in AI ARK First or Official Page.

#### Editorial administration

- submit GitHub URL;
- acquire repository information;
- extract Skill information;
- generate draft content;
- bind evidence;
- identify duplicates or forks;
- review and edit;
- approve or reject;
- publish;
- archive;
- record verification;
- moderate comments and reviews;
- detect basic source updates.

#### Ranking and verification

- Ranking v0;
- Quality Score;
- Category Rank;
- Momentum indicator;
- Confidence indicator;
- Source Verified;
- limited Functionally Tested and Quality Verified pilots.

#### Workflows

- three to five curated workflows;
- structured steps;
- resource alternatives;
- regional constraints;
- expected outputs;
- manually reviewed workflow pages.

#### API

- resource retrieval;
- search;
- rankings;
- verification summary;
- workflows;
- changes;
- regional availability.

---

### 7.2 Deferred

- full MCP directory;
- full Agent directory;
- plugin directory;
- large-scale automatic collection;
- automatic publication;
- native installation;
- code execution;
- sandbox execution;
- paid marketplace;
- creator revenue sharing;
- permanent exclusivity;
- broad daily AI news;
- public API billing;
- enterprise governance;
- reviewer reputation weighting;
- automatic deployment verification;
- automated verification awards;
- comprehensive security certification;
- large-scale authorized mirroring;
- autonomous workflow execution.

---

## 8. Information Architecture

### 8.1 Public navigation

Recommended MVP navigation:

```text
Discover
Skills
Rankings
Workflows
Creators
Labs
```

Utility navigation:

```text
Search
Submit
Sign in
```

### 8.2 Public routes

```text
/
 /search
 /skills
 /skills/{slug}
 /categories/{slug}
 /rankings
 /rankings/{category}
 /collections/{slug}
 /workflows
 /workflows/{slug}
 /creators
 /creators/{slug}
 /labs
 /labs/{campaign-slug}
 /submit
 /about
 /methodology/rankings
 /methodology/verification
```

### 8.3 Authenticated user routes

```text
/account
/account/saved
/account/reviews
/account/labs
/account/claims
```

### 8.4 Creator routes

```text
/creator/dashboard
/creator/resources
/creator/resources/{id}
/creator/claims
/creator/reviews
/creator/labs
```

### 8.5 Administrative routes

```text
/admin
/admin/candidates
/admin/resources
/admin/resources/{id}
/admin/review
/admin/verification
/admin/comments
/admin/reports
/admin/updates
/admin/sources
```

---

## 9. Core User Journeys

## 9.1 Journey A — Search for a Skill

### Scenario

A user wants to turn a market-research document into a presentation.

### Flow

```text
Homepage
↓
Enter task query
↓
View ranked results
↓
Open resource detail
↓
Review compatibility and evidence
↓
Copy install command or open source
↓
Save resource
↓
Return to review after use
```

### Success condition

The user reaches a meaningful next action with confidence.

---

## 9.2 Journey B — Browse category rankings

### Scenario

A user wants the best presentation Skills.

### Flow

```text
Rankings
↓
Presentation category
↓
View ranked resources
↓
Inspect ranking components
↓
Compare current candidates
↓
Open selected resource
```

### Success condition

The user understands why resources rank differently.

---

## 9.3 Journey C — Follow a workflow

### Scenario

A founder wants to research and launch an MVP.

### Flow

```text
Search by goal
↓
Open curated workflow
↓
Review prerequisites and steps
↓
Open resources for each step
↓
Save workflow
↓
Complete one or more steps
```

### Success condition

The user takes action on at least one workflow step.

---

## 9.4 Journey D — Review a used Skill

### Scenario

A developer deployed a Skill with Codex.

### Flow

```text
Resource page
↓
Write review
↓
Select resource version
↓
Select platform and environment
↓
Describe task and result
↓
Optionally submit private evidence
↓
Publish structured review
```

### Success condition

The review adds usable evidence to the resource record.

---

## 9.5 Journey E — Creator claims a resource

### Scenario

A creator discovers an AI ARK page for their Skill.

### Flow

```text
Resource page
↓
Claim this resource
↓
Authenticate
↓
Provide source ownership evidence
↓
AI ARK reviews claim
↓
Creator receives management access
↓
Creator corrects page and responds to users
```

### Success condition

Ownership is verified without weakening editorial independence.

---

## 9.6 Journey F — Creator launches a beta campaign

### Scenario

A creator needs 20 Codex users to test a beta Skill.

### Flow

```text
Creator dashboard
↓
Create Labs application
↓
Define target testers and scenarios
↓
AI ARK reviews campaign
↓
Campaign publishes
↓
Users apply
↓
Creator selects testers
↓
Testers submit structured feedback
```

### Success condition

The creator receives qualified feedback from relevant users.

---

## 9.7 Journey G — Editorial URL import

### Scenario

An editor finds a useful GitHub repository.

### Flow

```text
Admin console
↓
Paste GitHub URL
↓
System analyzes repository
↓
Draft and evidence appear
↓
Editor resolves warnings
↓
Editor edits content
↓
Approve and publish
```

### Success condition

The page is accurate, complete, sourced, and published within target review time.

---

## 9.8 Journey H — Agent API discovery

### Scenario

FounderOS needs a research Skill compatible with Codex.

### Flow

```text
FounderOS
↓
AI ARK Connector
↓
POST /v1/discover
↓
Receive structured candidates
↓
Evaluate ranking, evidence, region, and risks
↓
Return recommendation to FounderOS
```

### Success condition

The response is useful for planning and does not imply execution authorization.

---

## 10. Homepage Requirements

### 10.1 Objective

Help users begin with either a task or curated discovery.

### 10.2 Required sections

#### Hero

- concise product proposition;
- task-oriented search box;
- optional example queries.

Recommended placeholder:

> What do you want your AI to do?

#### Curated Skills

- editorial selections;
- visually strong resource cards;
- clear reasons for selection.

#### Rankings preview

- top resources across selected categories;
- link to full methodology.

#### Workflows

- three featured workflows;
- clear expected outcome.

#### New and Rising

- recent additions;
- momentum signals.

#### Creators

- selected creator profiles;
- creator portfolios.

#### Labs

- current beta campaigns;
- tester call-to-action.

### 10.3 Acceptance criteria

- task search is visible above the fold;
- at least three curated discovery paths are visible without scrolling excessively;
- resource cards contain image, title, summary, creator, category, and trust signal;
- homepage loads core content without authentication;
- homepage supports desktop and mobile layouts;
- no sponsored content is presented as organic ranking.

---

## 11. Search Requirements

### 11.1 Search modes

#### Keyword search

Supports names, categories, creators, tags, and capabilities.

#### Task search

Supports natural-language objectives.

Example:

> Create an investor presentation from a Markdown report.

#### Filtered discovery

Filters should include:

- category;
- compatible agent;
- verification status;
- lifecycle;
- license;
- regional availability;
- difficulty;
- resource freshness.

### 11.2 Result ranking

Search results should consider:

- task relevance;
- explicit capability match;
- category fit;
- compatibility;
- verification;
- quality score;
- freshness;
- evidence confidence.

Popularity should not dominate relevance.

### 11.3 Result presentation

Each result should show:

- title;
- creator;
- summary;
- category;
- compatibility;
- Quality Score;
- verification;
- regional availability;
- update date;
- primary next action.

### 11.4 Search failure handling

If no strong result exists:

- display uncertainty;
- suggest related terms;
- show alternative workflows;
- allow user to request a resource;
- avoid inventing capability matches.

### 11.5 Acceptance criteria

- search returns deterministic results for identical indexed data and query parameters;
- result cards explain at least one reason for relevance;
- low-confidence matches are visibly labelled;
- filters are shareable through URL parameters;
- no-result states provide useful alternatives;
- search analytics capture query, filters, result clicks, reformulations, and exits.

---

## 12. Skill Directory Requirements

### 12.1 Directory functions

- browse all published Skills;
- sort by category rank, quality, momentum, update date, and popularity;
- filter by category, compatibility, verification, region, and lifecycle;
- switch between card and compact list views if practical;
- save resources.

### 12.2 Resource status

Visible statuses may include:

- Stable;
- Beta;
- Experimental;
- Archived;
- Update detected;
- Under review.

### 12.3 Acceptance criteria

- unpublished resources never appear publicly;
- archived resources remain accessible but are clearly labelled;
- category pages display ranking methodology link;
- resource counts exclude rejected and duplicate records;
- filters preserve selected state.

---

## 13. Resource Detail Page Requirements

The resource detail page is the MVP’s most important public page.

## 13.1 Header and decision layer

Required fields:

- resource name;
- short proposition;
- creator;
- creator verification;
- current version;
- lifecycle;
- category;
- Quality Score;
- Category Rank;
- verification badges;
- momentum;
- evidence confidence;
- source popularity;
- last source update;
- last AI ARK review;
- primary visual preview;
- install/source actions.

### Primary actions

- Copy install command;
- Open canonical source;
- Open official website if applicable;
- Save resource;
- Add to workflow;
- Write review.

---

## 13.2 Best-fit section

Required fields:

- Best for;
- Not ideal for;
- primary tasks;
- target users;
- difficulty;
- expected setup effort.

---

## 13.3 Suggested prompts

At least three reviewed prompts:

- quick-start;
- common use;
- advanced or constrained use.

Each prompt should state the supported environment if relevant.

---

## 13.4 What it does

Required content:

- plain-language summary;
- key capabilities;
- expected outputs;
- important limitations;
- source of claims.

---

## 13.5 Installation and setup

Required content:

- installation command;
- environment prerequisites;
- dependencies;
- credentials or API requirements;
- operating-system notes;
- regional restrictions;
- uninstall or removal guidance where available.

---

## 13.6 Compatibility

Compatibility statuses:

- Tested by AI ARK;
- Declared by creator;
- Explicit in source;
- Community reported;
- Likely compatible;
- Unknown;
- Unsupported.

Compatibility must identify:

- agent or platform;
- tested version;
- evidence;
- date.

---

## 13.7 Regional availability

Display:

- Information Accessible;
- Artifact Accessible;
- Installation Accessible;
- Runtime Verified.

Include:

- region;
- current status;
- last check;
- limitations;
- alternatives.

---

## 13.8 Ranking explanation

Display score components:

- effectiveness;
- verified outcomes;
- reliability;
- maintenance;
- documentation;
- compatibility;
- adoption;
- creator responsiveness;
- risk adjustment;
- evidence confidence.

Users must be able to access the ranking methodology.

---

## 13.9 Verification report

Display:

- current verification level;
- evaluated version;
- date;
- scope;
- environments;
- evidence;
- limitations;
- expiry;
- unresolved risks.

---

## 13.10 Community section

Tabs or filters:

- Overview;
- Reviews;
- Deployments;
- Questions;
- Creator updates.

Review filters:

- current version;
- verified use;
- agent;
- operating system;
- region;
- production deployment;
- beta test;
- issue;
- creator responded.

---

## 13.11 Source and evidence

Display:

- canonical source;
- repository or official page;
- license;
- creator authorization status;
- source-derived documentation;
- provenance summary;
- original README link;
- correction history.

---

## 13.12 Similar and alternative resources

Show:

- similar resources;
- stronger alternatives;
- regional alternatives;
- workflow-related resources.

The page should explain at least one reason for each recommendation.

---

## 13.13 Acceptance criteria

A publishable resource page must have:

- canonical identity;
- current source;
- creator;
- category;
- short proposition;
- at least one use case;
- at least one limitation or “not suitable” statement;
- installation or source action;
- source evidence;
- compatibility status;
- review date;
- regional status;
- no unresolved blocking warning.

---

## 14. Creator Profile Requirements

### 14.1 Public profile

Required fields:

- creator name;
- avatar;
- verification status;
- biography;
- location or organization if public;
- official links;
- published resources;
- beta campaigns;
- creator updates;
- response metrics;
- claimed-resource count.

### 14.2 Creator verification

Possible levels:

- Unclaimed;
- Claimed;
- Identity Verified;
- Organization Verified.

Creator verification must not imply resource quality.

### 14.3 Creator actions

- claim profile;
- claim resource;
- suggest corrections;
- respond to reviews;
- submit updates;
- create Labs application;
- request evaluation;
- express launch-program interest.

### 14.4 Acceptance criteria

- unverified claims cannot modify public content;
- creator edits are subject to editorial review for material factual claims;
- creator responses are visibly labelled;
- creator commercial relationship is disclosed where applicable.

---

## 15. Ranking Requirements

## 15.1 Ranking outputs

The MVP must support:

- Quality Score;
- Category Rank;
- Momentum indicator;
- Evidence Confidence;
- Risk Status.

### 15.2 Ranking categories

Initial categories may include:

- Development;
- Research;
- Presentation;
- Design;
- Content;
- Data;
- Productivity;
- Founder.

Final category selection should be limited to five to eight categories based on seed corpus quality.

### 15.3 Ranking lifecycle separation

Separate ranking views:

- Stable;
- Beta;
- New and Promising;
- Rising;
- Verified.

### 15.4 Ranking inputs

Initial weighting:

| Dimension | Weight |
|---|---:|
| Functional effectiveness | 25% |
| Verified user outcomes | 15% |
| Reliability and reproducibility | 15% |
| Maintenance and freshness | 10% |
| Documentation and onboarding | 10% |
| Compatibility breadth | 10% |
| Verified adoption | 10% |
| Creator responsiveness | 5% |

### 15.5 Ranking rules

- use logarithmic popularity normalization;
- use Bayesian review smoothing;
- apply freshness decay;
- separate lifecycle classes;
- exclude unresolved severe-risk resources;
- penalize incomplete evidence through confidence;
- maintain score snapshots;
- log manual overrides;
- disclose methodology.

### 15.6 Commercial independence

Sponsored resources may appear in a distinct sponsored area.

They must not receive:

- rank boosts;
- verification advantages;
- hidden editorial preference;
- score manipulation.

### 15.7 Acceptance criteria

- each public score can be decomposed into visible components;
- score calculation is reproducible from stored evidence;
- every ranking references a version and timestamp;
- resources with insufficient evidence show low confidence;
- manual interventions are recorded;
- beta and stable resources are not directly mixed in default rankings.

---

## 16. Verification Requirements

## 16.1 Supported MVP levels

### Source Verified

Required for selected launch resources.

### Functionally Tested

Pilot for at least five resources.

### Quality Verified

Pilot for a smaller subset where sufficient evidence exists.

### Proven in Use

May be displayed only when evidence threshold is met.

### AI ARK Verified

Not required for broad launch. May be piloted only if all criteria are satisfied.

## 16.2 Verification record

Required fields:

- resource;
- version;
- verification level;
- date;
- expiry;
- evaluator;
- test environments;
- scenarios;
- evidence;
- limitations;
- unresolved risks;
- conflicts;
- decision;
- appeal status.

## 16.3 Re-review

Triggered by:

- major version;
- ownership change;
- dependency change;
- permission change;
- severe report;
- inactivity;
- expiry.

## 16.4 Acceptance criteria

- verification is version-specific;
- verification reports disclose scope;
- no verification badge is awarded automatically;
- commercial payment cannot determine outcome;
- expired verification is visibly marked;
- disputed decisions can enter appeal state.

---

## 17. Community Comments and Reviews

## 17.1 Comment types

### General comment

- question;
- tip;
- opinion;
- compatibility discussion;
- documentation feedback.

### Structured usage review

Requires:

- resource version;
- task;
- platform;
- environment;
- setup result;
- outcome;
- problems;
- reuse intent.

### Verified usage review

May include:

- verified installation;
- verified deployment;
- verified beta test;
- verified production use.

## 17.2 Review dimensions

- setup;
- documentation;
- functional accuracy;
- output quality;
- reliability;
- compatibility;
- value;
- creator support.

## 17.3 Creator responses

Creators can respond and optionally mark:

- acknowledged;
- fix planned;
- resolved;
- cannot reproduce;
- documentation updated;
- fixed in version.

## 17.4 Helpful votes

Users may mark reviews helpful.

Helpful votes must not directly create verification.

## 17.5 Moderation

Users can report:

- spam;
- abuse;
- conflict of interest;
- fake review;
- confidential information;
- unsupported security allegation;
- impersonation.

## 17.6 Acceptance criteria

- comments do not directly affect ranking;
- structured reviews bind to version;
- verified reviews show verification type;
- private evidence is not publicly exposed;
- creator self-review is prohibited;
- moderation actions are auditable;
- current-version and historical reviews are distinguishable.

---

## 18. AI ARK Labs MVP Requirements

## 18.1 Scope

The MVP should support one or two manually managed beta campaigns.

### Creator application fields

- resource;
- version;
- stage;
- objective;
- tester profile;
- environment;
- geography;
- tester capacity;
- test period;
- risks;
- required permissions;
- tasks;
- success criteria;
- feedback questions;
- incentive;
- confidentiality terms.

### Tester application fields

- experience;
- agent environment;
- operating system;
- region;
- relevant use case;
- consent;
- conflict disclosure.

### Campaign workflow

```text
Application
↓
Editorial review
↓
Published campaign
↓
Tester applications
↓
Creator selection
↓
Structured feedback
↓
Campaign summary
```

## 18.2 Acceptance criteria

- every campaign is manually approved;
- known risks are visible;
- tester consent is recorded;
- AI ARK does not execute the resource;
- campaign data is access-controlled;
- creator cannot publicly expose private tester data;
- feedback can contribute to evidence only after review.

---

## 19. Collections and Workflows

## 19.1 Collections

A collection groups resources by theme.

Examples:

- Best Skills for Codex;
- Presentation Skills;
- Founder Skills;
- Chinese Skills for Global Developers.

### Collection fields

- title;
- summary;
- curator;
- inclusion criteria;
- resources;
- update date;
- sponsorship disclosure.

---

## 19.2 Workflows

A workflow defines an ordered path to an outcome.

### Required workflow fields

- goal;
- target user;
- prerequisites;
- supported environments;
- region;
- estimated time;
- estimated cost;
- steps;
- resource alternatives;
- expected output;
- approval points;
- limitations;
- version;
- evidence;
- review status.

### Workflow types

#### AI ARK Verified Workflow

Human-designed and tested.

#### AI-Generated Path

Not required for public MVP unless clearly labelled and limited to internal prototype use.

### 19.3 Acceptance criteria

- MVP launches with three to five workflows;
- every public workflow is manually reviewed;
- every step has an objective and expected output;
- each resource has at least one alternative where practical;
- regional limitations are visible;
- workflow changes create a new version;
- users can save or share a workflow.

---

## 20. Mainland Availability Requirements

## 20.1 Status model

Each resource can have region-specific statuses:

- CN-A1 Information Accessible;
- CN-A2 Artifact Accessible;
- CN-A3 Installation Accessible;
- CN-A4 Runtime Verified.

## 20.2 Required fields

- region;
- status level;
- source;
- check date;
- checked by;
- known limitation;
- authorized mirror status;
- alternative resources;
- runtime environment if tested.

## 20.3 Delivery rules

AI ARK may provide:

- metadata and explanation;
- source links;
- authorized mirrors;
- creator-provided China editions;
- domestic alternatives.

AI ARK must not provide:

- proxy access;
- unauthorized mirrors;
- hidden relays;
- access-control circumvention.

## 20.4 Acceptance criteria

- availability claims include check date;
- status levels are not collapsed into a single yes/no;
- authorized mirrors record rights basis and checksum;
- unavailable resources display alternatives where possible;
- runtime verified status requires a documented test.

---

## 21. Resource Ingestion Requirements

## 21.1 Input

Initial MVP input:

- GitHub repository URL.

Optional:

- creator-provided notes;
- preferred category;
- official website;
- screenshots;
- authorization.

## 21.2 Automated acquisition

Retrieve where available:

- repository metadata;
- README;
- `SKILL.md`;
- scripts;
- references;
- assets;
- license;
- releases;
- commit activity;
- dependencies;
- installation instructions;
- explicit compatibility;
- owner information.

## 21.3 Automated draft generation

Generate:

- title;
- short proposition;
- summary;
- use cases;
- best for;
- not suitable for;
- suggested prompts;
- installation summary;
- requirements;
- expected outputs;
- compatibility candidates;
- limitations;
- categories;
- tags;
- alternatives;
- risk notes;
- regional questions;
- creator profile candidate.

## 21.4 Evidence model

Every material generated field must reference:

- source fact;
- creator declaration;
- inference;
- AI ARK test;
- community report;
- editorial judgment.

## 21.5 Duplicate and fork detection

The system should compare:

- repository identity;
- source URLs;
- forks;
- package names;
- Skill names;
- content fingerprints;
- creator identity.

## 21.6 Editorial review requirements

The editor must be able to:

- compare source and draft;
- inspect evidence;
- edit fields;
- mark unsupported claims;
- resolve compatibility;
- classify resource;
- approve;
- reject;
- archive;
- request creator input.

## 21.7 Acceptance criteria

- median URL-to-draft target ≤2 minutes;
- no automatic publication;
- unsupported material claims are flagged;
- source evidence is preserved;
- duplicate candidates are surfaced;
- editor can save partial review;
- publication creates immutable review snapshot;
- changes are auditable.

---

## 22. Editorial Console Requirements

## 22.1 Dashboard

Display:

- new candidates;
- drafts awaiting review;
- blocked resources;
- updates detected;
- verification due;
- reported comments;
- Labs applications;
- creator claims.

## 22.2 Resource review screen

Two-pane or equivalent presentation:

```text
Source evidence
↔
AI ARK draft
```

Required actions:

- edit;
- accept field;
- reject field;
- change evidence type;
- mark confidence;
- approve;
- reject;
- request revision;
- publish.

## 22.3 Moderation screen

Support:

- review report;
- remove or retain;
- redact sensitive data;
- warn user;
- suspend user;
- restore content;
- record reason.

## 22.4 Verification screen

Support:

- define scope;
- record test environment;
- upload private evidence;
- enter findings;
- award or deny level;
- set expiry;
- publish report.

## 22.5 Acceptance criteria

- role-based access;
- all material decisions audited;
- rejected content remains recoverable for internal review;
- sensitive evidence is access-controlled;
- moderation and editorial actions are distinguishable;
- no user-facing change occurs without a recorded actor.

---

## 23. API Requirements

## 23.1 MVP API endpoints

```text
GET  /v1/resources
GET  /v1/resources/{id}
POST /v1/search
GET  /v1/rankings
GET  /v1/rankings/{category}
GET  /v1/verification/{resourceId}
GET  /v1/workflows
GET  /v1/workflows/{id}
GET  /v1/changes
GET  /v1/regional-availability/{resourceId}
```

Optional internal endpoint:

```text
POST /v1/discover
```

## 23.2 Response requirements

Responses should include:

- stable ID;
- slug;
- type;
- version;
- source;
- creator;
- category;
- capabilities;
- compatibility;
- ranking;
- confidence;
- verification;
- regional availability;
- freshness;
- alternatives;
- provenance summary.

## 23.3 API principles

- versioned;
- deterministic;
- paginated;
- rate-limited;
- authenticated where required;
- no installation authorization;
- no execution side effects;
- no hidden commercial ranking;
- clear freshness metadata.

## 23.4 FounderOS connector acceptance

A test connector should be able to:

- search resources;
- retrieve a resource;
- retrieve ranking and verification;
- retrieve a workflow;
- check updates;
- check regional availability.

The connector must not access AI ARK’s database directly.

---

## 24. Authentication and Roles

### 24.1 Roles

- Visitor;
- Registered User;
- Creator;
- Tester;
- Moderator;
- Editor;
- Verification Reviewer;
- Administrator;
- API Client.

### 24.2 Permissions

#### Visitor

- browse;
- search;
- view rankings;
- view reviews.

#### Registered User

- save;
- comment;
- review;
- apply to Labs;
- report content.

#### Creator

- claim;
- respond;
- submit;
- apply for launch or Labs.

#### Editor

- review resources;
- publish;
- archive.

#### Moderator

- review user-generated content;
- apply moderation actions.

#### Verification Reviewer

- manage evaluation records.

### 24.3 Acceptance criteria

- least-privilege access;
- creator status does not grant editorial publication rights;
- editor cannot silently modify verification without appropriate role;
- private evidence access is restricted;
- role changes are audited.

---

## 25. Content and Editorial Standards

### 25.1 Required content style

- clear;
- specific;
- non-hyperbolic;
- evidence-grounded;
- transparent about uncertainty;
- useful before promotional.

### 25.2 Prohibited editorial patterns

- unsupported superlatives;
- hidden sponsorship;
- copied long-form source content without rights;
- fabricated compatibility;
- fabricated adoption;
- security guarantees;
- false regional-access claims.

### 25.3 Source use

AI ARK should:

- summarize;
- attribute;
- link to canonical sources;
- preserve license information;
- respect creator correction requests;
- maintain takedown process.

### 25.4 Acceptance criteria

- every published resource has canonical source;
- factual claims are traceable;
- inferred claims are labelled;
- content has editor and review date;
- creator-provided marketing language is not accepted as independent evaluation.

---

## 26. Non-Functional Requirements

## 26.1 Performance

Targets:

- public page largest-contentful load ≤2.5 seconds under normal broadband;
- search response ≤1.5 seconds for indexed queries;
- API p95 response ≤1 second for read endpoints;
- draft generation asynchronous with visible progress.

## 26.2 Availability

Validation MVP target:

- 99.5% monthly public availability;
- graceful degradation if external source APIs fail;
- cached public records remain readable.

## 26.3 Security

Required:

- secure authentication;
- role-based access;
- input validation;
- rate limiting;
- audit logs;
- secret management;
- dependency scanning;
- private-evidence encryption;
- secure file handling;
- no execution of imported repository code.

## 26.4 Privacy

Required:

- minimal personal data;
- clear review and evidence consent;
- account deletion process;
- private evidence separation;
- regional data planning;
- moderation access controls.

## 26.5 Accessibility

Target:

- WCAG 2.2 AA for primary public experiences;
- keyboard navigation;
- semantic headings;
- accessible form labels;
- sufficient contrast;
- alt text for meaningful images.

## 26.6 Responsiveness

Primary pages must support:

- desktop;
- tablet;
- mobile web.

## 26.7 Observability

Required:

- request logs;
- error tracking;
- ingestion job status;
- API metrics;
- search analytics;
- editorial timing;
- moderation metrics;
- ranking computation logs.

## 26.8 Data durability

Required:

- backups;
- immutable publication snapshots;
- verification history;
- ranking snapshots;
- review history;
- audit trail.

---

## 27. Analytics Requirements

## 27.1 Core events

- homepage viewed;
- search submitted;
- filter applied;
- result clicked;
- resource viewed;
- install copied;
- source opened;
- resource saved;
- workflow viewed;
- workflow step opened;
- review started;
- review submitted;
- creator claim started;
- creator claim approved;
- Labs application started;
- Labs application submitted;
- API request succeeded;
- API request failed.

## 27.2 Funnel metrics

### Discovery funnel

```text
Search or browse
↓
Result click
↓
Resource evaluation
↓
Meaningful action
```

### Creator funnel

```text
Page discovered
↓
Claim started
↓
Claim approved
↓
Correction or share
```

### Review funnel

```text
Resource used
↓
Review started
↓
Structured review submitted
↓
Evidence verified
```

### Workflow funnel

```text
Workflow opened
↓
Step resource opened
↓
Workflow saved
↓
Step completed
```

## 27.3 Editorial metrics

- URL-to-draft time;
- human review time;
- rejection rate;
- factual correction rate;
- duplicate-detection precision;
- evidence-coverage rate;
- update-review time.

## 27.4 Ranking metrics

- ranking click-through;
- rank explanation views;
- ranking disagreement reports;
- low-confidence selection behavior;
- category distribution.

## 27.5 Acceptance criteria

- analytics do not capture secrets or private evidence;
- events have stable names and schemas;
- validation metrics can be computed without manual reconstruction;
- users can be separated from bots and internal testers;
- regional analytics follow applicable privacy requirements.

---

## 28. Validation Gates

## Gate A — Discovery value

After at least 1,000 qualified sessions:

- result-to-resource click ≥30%;
- resource-to-source/install action ≥15%;
- immediate query reformulation <35%;
- at least 20 users confirm meaningful research-time savings.

## Gate B — Workflow value

- at least 60% of tested users rate a curated workflow useful;
- at least 20% open or save multiple workflow resources;
- at least ten users complete a meaningful workflow step.

## Gate C — Editorial economics

Across at least 100 imported resources:

- median URL-to-draft ≤2 minutes;
- median human review ≤5 minutes;
- material factual correction rate <5%;
- factual-field source coverage 100%;
- duplicate-detection precision ≥95% in test corpus.

## Gate D — Creator value

- at least five creators claim a page;
- at least two commit to a beta campaign;
- at least five share their AI ARK page;
- at least two express interest in AI ARK First, Exclusive Beta, or Official Page.

## Gate E — Community evidence

- at least 25 structured reviews;
- at least ten verified-use evidence submissions;
- at least five creator responses;
- no unresolved severe moderation incident.

## Gate F — Agent value

- at least 20 successful structured discovery requests;
- responses include version, provenance, confidence, and freshness;
- a test FounderOS connector consumes the API;
- API never implies execution authorization.

## Gate G — Regional value

- at least 20 resources have reviewed Mainland availability;
- at least five have installation or runtime evidence;
- users confirm regional status is useful;
- no unauthorized mirror is published.

## Gate H — Commercial signal

At least one:

- three paid launch or promotion pilots;
- two credible enterprise/API design partners;
- ten creators willing to pay for analytics or distribution;
- one meaningful distribution partnership.

---

## 29. MVP Acceptance Criteria

The MVP can be considered feature-complete only when all mandatory conditions are met.

### 29.1 Public product

- 100–150 published Skills;
- five to eight categories;
- task search;
- category ranking;
- resource pages;
- creator profiles;
- three to five workflows;
- comments and structured reviews;
- regional-availability labels;
- responsive desktop and mobile layouts.

### 29.2 Editorial product

- GitHub URL import;
- automated draft;
- evidence binding;
- human review;
- duplicate detection;
- publish and archive;
- audit logs;
- basic update detection.

### 29.3 Trust product

- Ranking v0;
- public methodology;
- Source Verified support;
- at least five functional-test pilots;
- version-specific reviews;
- moderation and reporting.

### 29.4 Creator product

- profile claim;
- resource claim;
- creator responses;
- resource submission;
- Labs application;
- launch-interest capture.

### 29.5 API

- resource;
- search;
- ranking;
- verification;
- workflow;
- changes;
- regional availability;
- test FounderOS connector.

### 29.6 Quality

- no unresolved critical security defect;
- no automatic third-party code execution;
- no hidden sponsored ranking;
- factual source coverage target met;
- accessibility and performance targets substantially met;
- operational runbooks exist.

---

## 30. Release Gates

## Gate 0 — Documentation readiness

Required before implementation:

- PRD approved;
- information architecture approved;
- Resource and Capability Graph approved;
- ingestion specification approved;
- ranking and verification standard approved;
- community specification approved;
- API boundary approved;
- Mainland availability specification approved;
- validation plan approved.

## Gate 1 — Internal prototype

Required:

- core page designs;
- admin import flow;
- ranking presentation;
- workflow page;
- review flow;
- creator claim flow.

Decision:

- GO;
- REMEDIATE;
- NO-GO.

## Gate 2 — Concierge validation

Required:

- 30–50 manually prepared Skills;
- user interviews;
- creator interviews;
- workflow testing;
- ranking trust testing;
- editorial-time measurement.

## Gate 3 — Engineering MVP

Required:

- core implementation complete;
- acceptance criteria passed;
- security review;
- data migration test;
- API contract test;
- moderation test;
- performance test.

## Gate 4 — Private beta

Required:

- invited users;
- selected creators;
- one or two Labs campaigns;
- monitored review quality;
- incident process.

## Gate 5 — Public validation launch

Required:

- 100–150 Skills;
- creator and moderation coverage;
- public methodology;
- analytics;
- support process;
- brand clearance or approved replacement name.

---

## 31. Kill and Reposition Criteria

Stop or substantially reposition if two or more occur:

1. source/install action remains below 10%;
2. users consistently prefer GitHub or official directories;
3. returning usage remains below 8%;
4. workflows do not outperform isolated listings;
5. creators do not claim or share pages;
6. editorial review routinely exceeds 15 minutes;
7. material factual errors exceed 10%;
8. rankings are perceived as arbitrary or commercially influenced;
9. Labs requires excessive founder-managed recruitment;
10. moderation cost is disproportionate;
11. regional-availability data cannot be maintained;
12. agent clients do not value the structured API;
13. brand conflict cannot be resolved;
14. AI ARK materially slows higher-priority projects without traction.

---

## 32. Dependencies

### 32.1 Product dependencies

- approved taxonomy;
- Resource schema;
- provenance model;
- ranking methodology;
- verification standard;
- community moderation policy;
- regional-availability model;
- API schema.

### 32.2 External dependencies

- GitHub API;
- authentication provider;
- email provider;
- analytics;
- search infrastructure;
- LLM provider;
- object storage;
- moderation tools.

### 32.3 Organizational dependencies

- founder product decisions;
- editorial reviewer;
- moderation owner;
- verification decision owner;
- legal and compliance review;
- creator outreach capability;
- design capacity;
- engineering capacity.

---

## 33. Initial Operational Model

### 33.1 Minimum operating roles

A single person may hold multiple roles during validation, but responsibilities must remain conceptually separate.

- Product owner;
- Editorial reviewer;
- Technical reviewer;
- Moderator;
- Verification reviewer;
- Creator-relations owner;
- Engineering owner.

### 33.2 Separation requirements

- creators cannot approve their own pages;
- sponsored relationships cannot determine rank;
- evaluation payment cannot determine verification;
- moderators should not alter factual content without editorial process;
- verification reviewer records scope and evidence.

### 33.3 Weekly operating cadence

Recommended:

- candidate sourcing;
- editorial review;
- ranking recalculation;
- review moderation;
- creator outreach;
- workflow maintenance;
- regional status review;
- analytics review;
- incident review.

---

## 34. Open Product Questions

The following questions should be resolved during the next specifications and prototype phase.

1. What are the final five to eight launch categories?
2. Should users be required to sign in before saving?
3. How much of the ranking score should be visible by default?
4. What exact evidence qualifies as verified installation?
5. How should anonymous reviews be handled?
6. What is the minimum creator-claim evidence?
7. Should AI ARK support public comparisons in MVP?
8. How should users request missing resources?
9. Which agent compatibility states should appear publicly?
10. Which Mainland availability checks can be automated?
11. Should Labs incentives be managed by creators or AI ARK?
12. Which API endpoints should be public during private beta?
13. Which workflow representation best serves both humans and agents?
14. How should archived resources affect historical rankings?
15. What replacement name will be used if AI ARK cannot be cleared?

These questions do not block the PRD. They must be answered before the relevant implementation milestone.

---

## 35. Recommended Engineering Milestone Outline

This is an initial planning outline, not an authorized engineering kit.

| Milestone | Scope |
|---|---|
| M00 | Repository, documentation, CI, and governance foundation |
| M01 | Resource, creator, version, source, and provenance model |
| M02 | GitHub ingestion and editorial review pipeline |
| M03 | Public discovery, search, categories, and resource pages |
| M04 | Creator profiles, claims, comments, and reviews |
| M05 | Ranking v0 and verification foundation |
| M06 | Collections and curated workflows |
| M07 | Read API and FounderOS connector |
| M08 | AI ARK Labs beta campaign foundation |
| M09 | Mainland availability and regional metadata |
| M10 | Change detection, lifecycle, and public validation hardening |

Formal milestones should be generated only after:

- the complete Product Definition Package;
- clickable prototype;
- concierge validation;
- MVP scope freeze.

---

## 36. Final MVP Decision

# MVP DEFINITION APPROVED FOR FURTHER SPECIFICATION

The MVP is coherent only if it includes all four foundational systems:

```text
Public Skill Discovery
+
Resource Intelligence Pipeline
+
Evidence and Trust Foundation
+
Human and Agent Read Interfaces
```

The product should not be reduced to a directory.

It should also not attempt to deliver the complete long-term platform.

The validation MVP must prove:

- users trust the resource pages;
- rankings help rather than confuse;
- workflows create practical value;
- creators participate;
- reviews produce useful evidence;
- the ingestion pipeline is economical;
- regional availability matters;
- agents can consume the same governed intelligence.

---

## 37. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Information Architecture and UX Specification v1.0.md`

It should define:

- navigation;
- page hierarchy;
- screen requirements;
- resource-detail architecture;
- ColaSkill-inspired presentation principles;
- original AI ARK visual direction;
- responsive behavior;
- interaction states;
- search and workflow journeys;
- editorial-console UX;
- creator, Labs, ranking, verification, and review presentation.

---

**End of document**
