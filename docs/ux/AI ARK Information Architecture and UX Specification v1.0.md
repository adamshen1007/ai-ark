# AI ARK Information Architecture and UX Specification v1.0

**Document status:** Product experience baseline  
**Version:** 1.0  
**Date:** August 1, 2026  
**Working product name:** AI ARK  
**Brand status:** Working name pending legal, trademark, domain, and search-ownership clearance  
**Product stage:** Validation MVP  
**Decision basis:** `AI ARK Worthiness Review v1.1.md`  
**Strategic foundation:** `AI ARK Product Vision and Positioning v1.0.md`  
**Product requirements:** `AI ARK MVP PRD v1.0.md`  
**Primary audience:** Founder, product, design, frontend engineering, backend engineering, editorial, trust and safety, creator relations, and validation teams  

---

## 1. Purpose

This specification defines the information architecture, interaction model, screen hierarchy, content presentation, responsive behavior, and UX principles for the AI ARK validation MVP.

It translates the approved product vision and MVP requirements into a coherent experience for:

- capability users;
- creators;
- testers;
- reviewers;
- editors;
- moderators;
- verification reviewers;
- API-adjacent agent use cases.

It also converts the strongest observations from the user-supplied ColaSkill screenshots into an original AI ARK product experience.

AI ARK should learn from ColaSkill’s:

- editorial clarity;
- strong visual hierarchy;
- creator visibility;
- resource previews;
- prominent installation actions;
- suggested prompts;
- structured documentation;
- calm, content-first presentation.

AI ARK must add:

- task-oriented search;
- transparent rankings;
- version-aware evidence;
- verification;
- community usage outcomes;
- creator testing;
- regional availability;
- workflow intelligence;
- machine-readable structure;
- original visual identity.

---

## 2. Experience Vision

# AI ARK should feel like a trusted editorial publication, a capability search engine, and a structured intelligence platform at the same time.

A user should be able to move through four stages without losing context:

```text
Discover
↓
Evaluate
↓
Act
↓
Contribute evidence
```

A creator should be able to move through:

```text
Claim
↓
Improve presentation
↓
Launch or recruit testers
↓
Respond to evidence
↓
Build reputation
```

An editor should be able to move through:

```text
Import
↓
Inspect evidence
↓
Resolve uncertainty
↓
Publish
↓
Monitor changes
```

The UX must make AI-generated interpretation useful without hiding:

- source facts;
- uncertainty;
- version scope;
- commercial relationships;
- regional limitations;
- verification limits.

---

## 3. Core UX Principles

### 3.1 Outcome first

Lead with the user problem and expected result before technical implementation details.

### 3.2 Evidence close to claims

Users should not need to search another page to understand why a claim exists.

### 3.3 Progressive disclosure

Show the information required for the current decision while preserving deeper technical detail.

### 3.4 Visual proof where useful

Output previews, interfaces, examples, and workflow diagrams should explain capability value.

### 3.5 Calm density

Pages may contain substantial information, but typography, spacing, grouping, and sticky navigation should prevent overload.

### 3.6 Neutrality

Organic rank, verification, and editorial evaluation must not visually blur with sponsorship or creator partnerships.

### 3.7 Version awareness

Version, update date, and evidence age should be visible in important decision areas.

### 3.8 Regional truth

Availability should not be reduced to a misleading yes/no label.

### 3.9 Human and machine consistency

The public page and API should represent the same governed resource record.

### 3.10 Accessible by default

The experience should support keyboard navigation, semantic structure, screen readers, sufficient contrast, and responsive layouts.

### 3.11 No false certainty

Unknown, inferred, community-reported, and tested states must look different.

### 3.12 Actionable completion

Every important page should offer a clear next action.

---

## 4. Experience Architecture

AI ARK has six top-level experience systems.

```text
1. Discovery
   Search, browse, categories, rankings, collections

2. Resource Intelligence
   Resource dossiers, evidence, compatibility, installation

3. Workflow Intelligence
   Goal-to-path experiences and ordered capability combinations

4. Creator and Labs
   Creator profiles, claims, launches, beta campaigns

5. Community Evidence
   Comments, structured reviews, deployments, creator responses

6. Editorial and Trust Operations
   Ingestion, review, verification, moderation, updates
```

These systems should share one canonical resource identity and evidence model.

---

## 5. Primary Navigation

### 5.1 Desktop navigation

Recommended primary navigation:

```text
AI ARK logo

Discover
Skills
Rankings
Workflows
Creators
Labs

Search
Submit
Sign in / Account
```

### 5.2 Mobile navigation

Mobile should use:

- logo;
- search icon;
- account icon;
- menu button.

Menu contents:

```text
Discover
Skills
Rankings
Workflows
Creators
Labs
Submit a resource
Saved
My reviews
My Labs
About
Methodology
```

### 5.3 Navigation behavior

- header becomes compact and sticky after scrolling;
- current section is visibly active;
- global search remains accessible;
- resource pages provide an additional local section navigator;
- sponsored items do not appear in the main navigation.

---

## 6. Sitemap

### 6.1 Public routes

```text
/
├── /search
├── /discover
├── /skills
│   └── /skills/{slug}
├── /categories
│   └── /categories/{slug}
├── /rankings
│   └── /rankings/{category}
├── /collections
│   └── /collections/{slug}
├── /workflows
│   └── /workflows/{slug}
├── /creators
│   └── /creators/{slug}
├── /labs
│   └── /labs/{campaign-slug}
├── /submit
├── /about
├── /methodology
│   ├── /methodology/rankings
│   ├── /methodology/verification
│   └── /methodology/regional-availability
├── /policies
│   ├── /policies/community
│   ├── /policies/editorial
│   ├── /policies/sponsorship
│   └── /policies/takedown
└── /status
```

### 6.2 Authenticated routes

```text
/account
├── /account/saved
├── /account/reviews
├── /account/comments
├── /account/labs
├── /account/claims
├── /account/notifications
└── /account/settings
```

### 6.3 Creator routes

```text
/creator
├── /creator/dashboard
├── /creator/profile
├── /creator/resources
│   └── /creator/resources/{id}
├── /creator/claims
├── /creator/reviews
├── /creator/labs
│   └── /creator/labs/{id}
├── /creator/submissions
└── /creator/launch
```

### 6.4 Administrative routes

```text
/admin
├── /admin/dashboard
├── /admin/candidates
├── /admin/resources
│   └── /admin/resources/{id}
├── /admin/review
├── /admin/updates
├── /admin/verification
│   └── /admin/verification/{id}
├── /admin/comments
├── /admin/reports
├── /admin/claims
├── /admin/labs
├── /admin/sources
├── /admin/rankings
└── /admin/audit
```

---

## 7. Global Search Experience

### 7.1 Search role

Search is the primary utility entry point.

It should support:

- known-item search;
- capability search;
- problem-oriented search;
- creator search;
- compatibility search;
- regional search;
- workflow search.

### 7.2 Search field

Recommended placeholder:

> What do you want your AI to do?

Example queries shown beneath or within rotating suggestions:

- Turn a report into a presentation
- Review a pull request with Codex
- Find an MCP for Notion
- Build a SaaS MVP workflow
- Skills that work in Mainland China

### 7.3 Search suggestions

As the user types, suggestions may include:

```text
Tasks
Resources
Creators
Categories
Workflows
Recent searches
```

Each suggestion should use a distinct icon and label.

### 7.4 Search result tabs

```text
Best Match
Skills
Workflows
Creators
Collections
```

The MVP may show disabled or absent tabs for unsupported resource types rather than empty categories.

### 7.5 Filters

- Category;
- Compatible with;
- Verification;
- Lifecycle;
- License;
- Regional availability;
- Difficulty;
- Last updated;
- Evidence confidence.

### 7.6 Search-result explanation

Each result should state one or more reasons:

- Matches “presentation generation”
- Tested with Codex
- AI ARK Quality Verified
- Runtime verified in Mainland China
- Included in a verified workflow

### 7.7 Search uncertainty

Low-confidence results should display:

> Partial match

or:

> Compatibility inferred, not tested

### 7.8 No-results state

Display:

- related queries;
- broader category;
- relevant workflow;
- request-a-resource action;
- current coverage limitation.

Avoid inventing matches.

---

## 8. Homepage Specification

### 8.1 Experience objective

The homepage should answer within several seconds:

- What is AI ARK?
- What can I find here?
- Why should I trust it?
- What can I do next?

### 8.2 Homepage hierarchy

Recommended order:

```text
Global header
↓
Hero and task search
↓
Curated Skills
↓
Category entry points
↓
Rankings preview
↓
Featured workflow
↓
New and Rising
↓
AI ARK Verified
↓
Creators
↓
Labs campaigns
↓
Methodology and trust statement
↓
Footer
```

### 8.3 Hero

#### Required content

Headline:

> Find the right AI capability for the job.

Supporting copy:

> Discover curated Skills, compare evidence, follow working paths, and see what actually works.

Primary input:

> What do you want your AI to do?

Secondary actions:

- Browse Skills
- Explore Workflows

Trust microcopy:

> Source-grounded. Human-reviewed. Version-aware.

### 8.4 Curated Skills

Use visually strong cards inspired by the strengths observed in ColaSkill.

Each card:

- output or product preview;
- resource title;
- one-line benefit;
- creator avatar and name;
- category;
- verification indicator;
- Quality Score or rank;
- compatible-agent icons;
- optional regional-availability icon.

Avoid excessive metadata on cards.

### 8.5 Category entry points

Use editorial tiles rather than plain tag clouds.

Examples:

- Development;
- Research;
- Presentation;
- Design;
- Content;
- Data;
- Productivity;
- Founder.

Each category tile should communicate:

- representative outcome;
- resource count;
- top-ranked resource;
- visual identity.

### 8.6 Ranking preview

Display three compact lists:

- Best Verified;
- Rising;
- New and Promising.

Each list must link to methodology.

### 8.7 Featured workflow

Use a horizontal path visualization:

```text
Research
→
Plan
→
Design
→
Build
→
Test
→
Deploy
```

Show included resources and expected final output.

### 8.8 New and Rising

Show freshness and momentum without creating a popularity-only feeling.

### 8.9 Verified section

Feature resources with verification reports.

Use restrained badges and a visible explanation:

> Verification is version-specific and scoped.

### 8.10 Creator section

Show:

- creator avatar;
- creator name;
- verified identity;
- number of resources;
- primary expertise;
- latest resource.

### 8.11 Labs section

Show active beta campaigns with:

- lifecycle;
- tester profile;
- remaining capacity;
- deadline;
- known-risk disclosure.

### 8.12 Footer

Include:

- About;
- Methodology;
- Editorial policy;
- Community rules;
- Sponsorship policy;
- Submit;
- Status;
- API interest;
- language switch;
- regional edition indicator.

---

## 9. Resource Card System

AI ARK should use multiple card variants rather than one universal card.

### 9.1 Editorial visual card

Used on homepage and collections.

Content:

- large visual;
- title;
- outcome statement;
- creator;
- category;
- trust indicator.

### 9.2 Search result card

More information-dense.

Content:

- title;
- short summary;
- creator;
- compatibility;
- rank;
- verification;
- regional availability;
- update date;
- relevance reasons.

### 9.3 Ranking row

Used in category rankings.

Content:

- rank;
- resource;
- score;
- confidence;
- change indicator;
- verification;
- primary evidence;
- updated date.

### 9.4 Compact workflow resource card

Content:

- step role;
- resource title;
- why selected;
- alternatives;
- compatibility;
- expected output.

### 9.5 Labs campaign card

Content:

- beta stage;
- project;
- creator;
- tester profile;
- region;
- deadline;
- capacity;
- incentive if any.

### 9.6 Card-state requirements

Cards should support:

- default;
- hover;
- keyboard focus;
- saved;
- selected;
- unavailable;
- archived;
- sponsored;
- loading;
- error.

Sponsored cards require an unmistakable label.

---

## 10. Skills Directory

### 10.1 Header

Include:

- title;
- concise description;
- resource count;
- search within Skills;
- category shortcuts.

### 10.2 Filter bar

Desktop:

- sticky horizontal or left-side filters.

Mobile:

- filter button opens full-screen sheet.

Filters:

- Category;
- Compatible with;
- Verification;
- Lifecycle;
- Region;
- License;
- Updated;
- Difficulty.

### 10.3 Sort options

- Recommended;
- Category Rank;
- Quality Score;
- Rising;
- Newest;
- Most Adopted;
- Recently Updated.

### 10.4 View modes

MVP default:

- card grid.

Optional:

- compact list for advanced users.

### 10.5 Empty-filter state

Show:

- remove-filter suggestions;
- related category;
- request-a-resource action.

---

## 11. Category Page

### 11.1 Objective

Explain the category and help the user compare relevant resources.

### 11.2 Page hierarchy

```text
Category header
↓
Definition and inclusion criteria
↓
Top-ranked resources
↓
Verified resources
↓
Rising resources
↓
Collections or workflows
↓
All resources
```

### 11.3 Category transparency

Display:

- category definition;
- what is excluded;
- ranking update date;
- number of eligible resources;
- confidence note.

### 11.4 Category SEO content

Any explanatory copy should support user understanding and not exist only to create keyword volume.

---

## 12. Ranking Experience

### 12.1 Ranking overview

The ranking page should not look like an unexplained leaderboard.

Top area:

- category selector;
- lifecycle selector;
- methodology summary;
- last recalculation;
- confidence explanation.

### 12.2 Ranking table

Columns:

```text
Rank
Resource
Quality Score
Evidence Confidence
Verification
Momentum
Current Version
Last Reviewed
```

Optional expandable details:

- score components;
- rank movement;
- evidence count;
- unresolved risk.

### 12.3 Rank detail drawer

Opening a ranking explanation should show:

- score components;
- data sources;
- version;
- category peers;
- confidence;
- penalties;
- manual review;
- commercial independence statement.

### 12.4 Ranking movement

Use:

- ↑;
- ↓;
- New;
- Stable.

Do not use dramatic financial-market styling.

### 12.5 Low-confidence resources

A resource may have a high provisional score but low confidence.

Show both visibly.

### 12.6 Ranking methodology page

Required sections:

- principles;
- score dimensions;
- weights;
- normalization;
- lifecycle separation;
- review weighting;
- security gates;
- appeals;
- sponsorship separation;
- update schedule.

---

## 13. Resource Detail Page

The resource detail page is the primary AI ARK experience.

### 13.1 Desktop layout

Recommended structure:

```text
Global header

Resource hero
├── Main identity and preview
└── Sticky action and status panel

Local section navigation

Main content
├── What it does
├── Best for / Not ideal for
├── Suggested prompts
├── Preview and examples
├── Installation and setup
├── Compatibility
├── Ranking explanation
├── Verification
├── Regional availability
├── Community evidence
├── Source and documentation
└── Alternatives and workflows
```

### 13.2 Hero

Left or main area:

- title;
- one-sentence outcome;
- creator;
- category;
- version;
- lifecycle;
- source popularity;
- last update;
- preview carousel.

Right sticky panel:

- primary action;
- source action;
- save;
- Quality Score;
- Category Rank;
- verification;
- evidence confidence;
- regional status;
- “Best for” summary.

### 13.3 Hero actions

Priority order:

1. Copy install command or primary use action  
2. Open canonical source  
3. Save  
4. Add to workflow  
5. Write review  

### 13.4 Local section navigation

Sticky section links:

```text
Overview
Prompts
Examples
Setup
Compatibility
Ranking
Verification
Community
Source
```

Mobile:

- horizontally scrollable anchor bar or compact dropdown.

### 13.5 Overview

Use concise editorial blocks:

- What it does;
- Best for;
- Not ideal for;
- key outputs;
- primary limitations.

### 13.6 Suggested prompts

Prompt cards should include:

- prompt title;
- prompt text;
- supported environment;
- expected result;
- copy action.

Prompt types:

- Quick start;
- Common use;
- Advanced;
- Constraint-aware.

### 13.7 Preview and examples

Support:

- screenshots;
- image carousel;
- before/after;
- video preview link;
- sample output;
- code or configuration example.

Every visual requires:

- source;
- permission state;
- alt text;
- caption.

### 13.8 Installation and setup

Use stepwise presentation:

```text
1. Requirements
2. Install
3. Configure
4. First use
5. Verify
6. Remove or rollback
```

Copyable code blocks must preserve exact source text where appropriate.

### 13.9 Compatibility matrix

Rows:

- platform or agent.

Columns:

- status;
- version;
- evidence type;
- last checked;
- known limitation.

Statuses must use both icon and text.

### 13.10 Ranking explanation

Display:

- overall score;
- category rank;
- component bars;
- evidence confidence;
- score version;
- last calculation;
- link to methodology.

### 13.11 Verification panel

Display:

- level;
- evaluated version;
- date;
- expiry;
- scope;
- environments;
- key findings;
- limitations;
- unresolved risk;
- full report link.

### 13.12 Regional availability panel

Display four levels separately:

```text
Information
Artifact
Installation
Runtime
```

Use status labels:

- Confirmed;
- Partial;
- Unavailable;
- Unknown;
- Under review.

Include alternatives.

### 13.13 Community evidence

Tabs:

```text
Reviews
Deployments
Questions
Creator Updates
```

Summary block:

- current-version rating;
- verified-use count;
- production-use count;
- setup success;
- creator response rate.

### 13.14 Source and documentation

Display:

- canonical source;
- creator authorization;
- license;
- source files used;
- README link;
- provenance summary;
- last editorial review;
- correction history.

### 13.15 Similar resources

Each recommendation must say why:

- stronger documentation;
- broader compatibility;
- easier setup;
- available in Mainland China;
- more proven in production;
- specialized for another use case.

### 13.16 Resource page states

- published and current;
- update detected;
- re-review pending;
- archived;
- source unavailable;
- verification expired;
- regional status changed;
- disputed;
- temporarily hidden.

---

## 14. Creator Profile

### 14.1 Header

- avatar;
- creator name;
- identity verification;
- organization;
- biography;
- official links;
- follower or save metrics only if meaningful;
- claim status.

### 14.2 Sections

```text
Resources
Labs campaigns
Creator updates
Community responses
About
```

### 14.3 Creator reputation indicators

MVP indicators may include:

- Claimed resources;
- Identity verified;
- Response rate;
- Current resources;
- Resolved reports.

Do not create an opaque creator score in MVP.

### 14.4 Commercial relationship

If the creator is an AI ARK launch partner, display a clear relationship label separate from quality verification.

### 14.5 Claim action

Unclaimed profile:

> Is this you? Claim this creator profile.

Claimed profile:

> Managed by verified creator.

---

## 15. Creator Dashboard

### 15.1 Dashboard summary

- resources;
- page views;
- source clicks;
- install copies;
- saved count;
- review count;
- unresolved questions;
- claim status;
- Labs status.

### 15.2 Resource management

Creators can:

- propose corrections;
- submit release notes;
- add examples;
- add approved visuals;
- respond to reviews;
- request regional update;
- request verification;
- apply for launch support.

Material factual changes enter editorial review.

### 15.3 Review inbox

Filters:

- unresolved;
- current version;
- verified use;
- issue;
- question;
- critical.

### 15.4 Launch and Labs

Creators can start:

- AI ARK First interest form;
- Exclusive Beta application;
- Official Page request;
- Labs campaign application.

The MVP may keep approval manual.

---

## 16. AI ARK Labs

### 16.1 Labs landing page

Sections:

- Active campaigns;
- Closing soon;
- Recently completed;
- How testing works;
- Tester safety;
- Creator application.

### 16.2 Campaign detail

Header:

- resource;
- creator;
- alpha/beta stage;
- campaign goal;
- deadline;
- tester capacity;
- location or environment requirement.

Required sections:

- What is being tested;
- Who should apply;
- Tasks;
- Required permissions;
- Known risks;
- Expected time;
- Incentive;
- Confidentiality;
- Creator;
- Apply action.

### 16.3 Tester application

Progressive form:

```text
1. Profile
2. Environment
3. Relevant experience
4. Use case
5. Consent
6. Review
```

### 16.4 Tester workspace

For accepted testers:

- task checklist;
- setup instructions;
- issue reporting;
- evidence upload;
- feedback form;
- completion status;
- creator messages.

### 16.5 Campaign completion

Public campaign summary may show:

- number of testers;
- environments covered;
- completion rate;
- major findings;
- current status;
- creator response.

Private tester data remains protected.

---

## 17. Community Comments and Reviews

### 17.1 Comment composer

Simple mode:

- text;
- question or comment type;
- version optional;
- platform optional.

### 17.2 Structured review composer

Steps:

```text
1. What did you try?
2. Which version and environment?
3. Did setup work?
4. Did the task complete?
5. Rate dimensions
6. Describe result
7. Add optional evidence
8. Choose public identity
9. Submit
```

### 17.3 Verification evidence

Private evidence uploader should explain:

- what is collected;
- who can see it;
- what public badge may result;
- retention period;
- deletion process.

### 17.4 Review card

Display:

- reviewer;
- reviewer status;
- review date;
- resource version;
- environment;
- task;
- dimension ratings;
- narrative;
- verified-use badge;
- helpful votes;
- creator response;
- moderation state.

### 17.5 Review summary

Separate:

- Current version;
- All versions.

Display sample size and evidence confidence.

### 17.6 Moderation affordances

- Report;
- Hide spoilers or sensitive details;
- Request correction;
- Appeal.

---

## 18. Workflow Experience

### 18.1 Workflows landing page

Entry points:

- by goal;
- by role;
- by agent;
- by category;
- by region.

Example goals:

- Build a SaaS MVP;
- Create an investor presentation;
- Conduct competitor research;
- Launch a content campaign;
- Audit a web application.

### 18.2 Workflow page structure

```text
Workflow header
↓
Expected outcome
↓
Who it is for
↓
Prerequisites
↓
Time, cost, region, risk
↓
Visual step path
↓
Step details
↓
Alternatives
↓
Evidence and verification
↓
Save or share
```

### 18.3 Step card

Each step shows:

- objective;
- input;
- selected resource;
- why selected;
- expected output;
- alternatives;
- approval point;
- region or compatibility warning.

### 18.4 Workflow status

- AI ARK Verified Workflow;
- Curated Workflow;
- AI-Generated Path;
- Draft;
- Update required.

### 18.5 Workflow comparison

Not required for MVP, but page structure should allow alternative branches.

### 18.6 Workflow action

Users can:

- save;
- share;
- open step;
- mark step completed;
- replace resource;
- report problem.

---

## 19. Collections

### 19.1 Collection role

Collections are editorial groupings, not ordered workflows.

Examples:

- Best Codex Skills;
- Presentation Skills;
- Chinese Skills for Global Developers;
- Skills Accessible in Mainland China.

### 19.2 Collection page

Include:

- title;
- curator;
- inclusion criteria;
- last updated;
- sponsorship disclosure;
- resource cards;
- editorial notes.

### 19.3 Collection quality

Every collection must explain why each resource is included.

---

## 20. Submit a Resource

### 20.1 Submission form

Fields:

- source URL;
- resource name;
- creator;
- resource type;
- category;
- short explanation;
- relationship to resource;
- contact;
- authorization;
- optional screenshots.

### 20.2 Submission states

- Submitted;
- Under review;
- More information needed;
- Accepted;
- Rejected;
- Duplicate;
- Published.

### 20.3 Submission expectations

Explain:

- submission does not guarantee publication;
- payment does not determine acceptance;
- creators may be contacted;
- AI ARK may edit for clarity;
- source rights must be respected.

---

## 21. Sign-In and Account UX

### 21.1 Sign-in triggers

Require sign-in for:

- save;
- comment;
- review;
- apply to Labs;
- claim;
- submit private evidence.

Browsing and search remain public.

### 21.2 Authentication UX

Support:

- email magic link or passkey;
- GitHub sign-in for creators and developers;
- future regional login providers if needed.

### 21.3 Account dashboard

Sections:

- Saved resources;
- Saved workflows;
- Reviews;
- Comments;
- Labs;
- Claims;
- Notifications;
- Settings.

### 21.4 Notification preferences

Users can opt into:

- creator response;
- resource update;
- verification change;
- regional availability change;
- Labs decision;
- workflow update.

---

## 22. Regional and Language UX

### 22.1 Language switch

AI ARK should support a visible language switch when bilingual content is available.

States:

- Fully translated;
- Partially translated;
- Source language only;
- Machine-assisted translation reviewed;
- Unreviewed translation unavailable publicly.

### 22.2 Regional context

Users may select or infer a region, but regional recommendations should remain editable.

Display:

> Availability shown for Mainland China

or:

> Change region

### 22.3 Mainland availability labels

Avoid flags alone.

Use text:

- Information accessible;
- Artifact accessible;
- Installation accessible;
- Runtime verified.

### 22.4 Regional alternative

If a resource is unavailable, provide:

- reason category;
- accessible alternatives;
- creator China edition if available;
- last check date.

---

## 23. Visual Design Direction

### 23.1 Desired personality

AI ARK should feel:

- editorial;
- precise;
- calm;
- intelligent;
- credible;
- contemporary;
- global;
- technically literate;
- approachable.

### 23.2 Avoid

- excessive gradients;
- neon cyberpunk styling;
- crypto-market visuals;
- dense dashboard aesthetics on public pages;
- exaggerated badge systems;
- excessive animation;
- direct imitation of ColaSkill’s orange accent or card composition.

### 23.3 Visual system

Recommended:

- warm neutral or soft light background;
- dark high-contrast typography;
- one distinctive primary accent;
- one restrained status palette;
- subtle borders;
- minimal shadows;
- generous whitespace;
- rounded but not playful cards;
- large editorial imagery;
- clear typographic scale.

### 23.4 Dark mode

Not required for initial MVP if it delays validation, but design tokens should support future dark mode.

### 23.5 Typography

Use:

- editorial display face or expressive heading style;
- highly readable sans-serif body;
- monospaced style for commands and evidence identifiers.

Avoid overly technical body typography.

### 23.6 Iconography

Use consistent line icons for:

- Skill;
- creator;
- compatibility;
- verification;
- region;
- workflow;
- evidence;
- review;
- Labs.

---

## 24. Design Tokens and Status Semantics

### 24.1 Semantic colors

Use tokens rather than hardcoded colors:

```text
--color-background
--color-surface
--color-text-primary
--color-text-secondary
--color-border
--color-accent
--color-success
--color-warning
--color-danger
--color-info
--color-neutral
```

### 24.2 Status meanings

#### Green or success

- tested;
- verified;
- accessible;
- resolved.

#### Amber or warning

- partial;
- inferred;
- update detected;
- limited;
- expiring.

#### Red or danger

- severe risk;
- unavailable;
- revoked;
- blocked.

#### Gray or neutral

- unknown;
- not evaluated;
- archived;
- not applicable.

Color must never be the only status indicator.

---

## 25. Responsive Behavior

### 25.1 Breakpoint principles

Exact breakpoints should follow implementation framework, but behavior should support:

- wide desktop;
- standard desktop;
- tablet;
- mobile.

### 25.2 Resource detail on mobile

Desktop sticky side panel becomes:

- top summary card;
- sticky bottom action bar;
- collapsible status details.

### 25.3 Ranking table on mobile

Convert to ranked cards or horizontal-scroll table with pinned rank and resource name.

### 25.4 Filters on mobile

Open full-screen filter sheet with:

- current selections;
- reset;
- apply;
- result count.

### 25.5 Workflow on mobile

Vertical step path rather than horizontal.

### 25.6 Admin console

Admin is desktop-first, but review and moderation should remain usable on tablet.

---

## 26. Interaction States

Every interactive component must define:

- default;
- hover;
- focus;
- active;
- disabled;
- loading;
- success;
- warning;
- error;
- empty;
- permission denied.

### 26.1 Optimistic actions

May be used for:

- save;
- helpful vote;
- follow notification.

Do not use optimistic updates for:

- publishing;
- verification;
- moderation;
- creator claim approval.

### 26.2 Destructive actions

Require confirmation for:

- archive;
- delete;
- revoke verification;
- suspend user;
- reject claim;
- remove review.

### 26.3 Long-running actions

For ingestion and analysis:

- show job stage;
- preserve page state;
- allow background completion;
- surface errors clearly;
- permit retry.

---

## 27. Loading, Empty, and Error States

### 27.1 Skeletons

Use content-shaped skeletons for:

- cards;
- resource hero;
- ranking table;
- review list.

### 27.2 Empty states

Provide a useful next action.

Examples:

- No saved resources → Browse curated Skills
- No Labs applications → Explore active campaigns
- No reviews → Be the first to document real use
- No regional alternative → Request research

### 27.3 Error states

Explain:

- what failed;
- whether data is still available;
- what the user can do;
- whether retry is safe.

### 27.4 External-source failures

If GitHub is temporarily unavailable:

- preserve cached public data;
- show freshness warning;
- delay update calculation;
- do not mark resource inactive automatically.

---

## 28. Accessibility Requirements

Primary experiences should target WCAG 2.2 AA.

Required:

- keyboard-operable navigation;
- visible focus;
- semantic heading hierarchy;
- labels and instructions;
- accessible dialogs;
- text alternatives;
- reduced-motion support;
- sufficient contrast;
- screen-reader status announcements;
- no color-only information;
- touch target sizing;
- captions or transcripts for video.

Ranking charts and score bars must include text equivalents.

---

## 29. Editorial Console Architecture

### 29.1 Console goals

The console should minimize repetitive editorial work while preserving control and evidence inspection.

### 29.2 Main dashboard

Widgets:

- New candidates;
- Awaiting review;
- Blocked by evidence;
- Duplicate candidates;
- Updates detected;
- Verification expiring;
- Reported reviews;
- Creator claims;
- Labs applications.

### 29.3 Candidate list

Columns:

- resource;
- source;
- detected type;
- creator;
- confidence;
- duplicate risk;
- ingestion status;
- assigned editor;
- age.

### 29.4 Resource review workspace

Recommended three-part layout:

```text
Left
Source structure and evidence navigation

Center
AI ARK page draft preview

Right
Field inspector, status, warnings, actions
```

Alternative two-pane layouts are acceptable if clearer.

### 29.5 Evidence navigation

Allow editor to jump to:

- README;
- SKILL.md;
- license;
- package files;
- screenshots;
- commits;
- website;
- creator declaration.

### 29.6 Field-level review

Each field should show:

- proposed value;
- evidence type;
- source location;
- confidence;
- status;
- reviewer note.

Actions:

- Accept;
- Edit;
- Reject;
- Mark inferred;
- Request evidence;
- Hide publicly.

### 29.7 Preview modes

- Desktop;
- Mobile;
- API record;
- Regional variant;
- Unauthenticated user.

### 29.8 Publish panel

Checklist:

- identity resolved;
- source confirmed;
- license recorded;
- category selected;
- material claims sourced;
- compatibility status reviewed;
- regional status reviewed;
- no blocking risk;
- editor assigned;
- review snapshot ready.

### 29.9 Publication action

Use explicit action:

> Approve and publish

Not a generic Save button.

---

## 30. Ingestion UX

### 30.1 New-resource form

Primary field:

> Paste GitHub repository URL

Optional:

- official website;
- creator contact;
- notes;
- resource type override.

### 30.2 Analysis progress

Stages:

```text
Connecting to source
Reading repository
Finding Skill structure
Extracting metadata
Analyzing capabilities
Checking duplicates
Preparing evidence
Generating draft
```

### 30.3 Analysis result

Summary:

- detected resource;
- creator;
- type;
- duplicate risk;
- evidence coverage;
- warnings;
- recommended next action.

### 30.4 Failure handling

Examples:

- private repository;
- rate limited;
- unsupported source;
- no Skill detected;
- ambiguous license;
- duplicate;
- malicious or unsafe files;
- unavailable source.

Each failure should offer a path:

- retry;
- manual import;
- request creator authorization;
- mark rejected;
- save candidate.

---

## 31. Verification Console UX

### 31.1 Verification queue

Filters:

- requested;
- scheduled;
- in progress;
- awaiting evidence;
- decision ready;
- expiring;
- appealed.

### 31.2 Evaluation workspace

Sections:

- scope;
- resource version;
- environments;
- test scenarios;
- evidence;
- findings;
- risks;
- decision;
- public report preview.

### 31.3 Decision action

Options:

- Award;
- Deny;
- Defer;
- Request remediation;
- Revoke;
- Expire.

Require rationale.

### 31.4 Conflict declaration

Reviewer must disclose:

- creator relationship;
- sponsorship;
- financial interest;
- contribution history.

---

## 32. Moderation Console UX

### 32.1 Report queue

Columns:

- content type;
- reason;
- severity;
- reporter;
- target;
- creator response;
- age;
- assigned moderator.

### 32.2 Review panel

Show:

- reported content;
- surrounding context;
- user history;
- creator relationship;
- private evidence warning;
- policy references.

### 32.3 Actions

- No action;
- Add warning;
- Redact;
- Remove;
- Request edit;
- Suspend;
- Escalate;
- Restore.

All actions require reason and audit entry.

---

## 33. Creator Claim UX

### 33.1 Claim entry points

- Creator profile;
- Resource page;
- Creator dashboard;
- Submission confirmation.

### 33.2 Claim methods

Possible evidence:

- GitHub organization or repository control;
- email domain;
- official website;
- signed verification file;
- manual evidence.

### 33.3 Claim states

- Started;
- Evidence required;
- Under review;
- Approved;
- Rejected;
- Appealed;
- Revoked.

### 33.4 Post-approval onboarding

Checklist:

- complete profile;
- review resource page;
- add official links;
- respond to open questions;
- request launch or Labs support.

---

## 34. Notification UX

### 34.1 User notifications

- creator responded;
- saved resource updated;
- verification changed;
- regional status changed;
- Labs application decision;
- review verified;
- moderation action.

### 34.2 Creator notifications

- new review;
- critical issue;
- claim decision;
- page update detected;
- verification expiring;
- Labs tester application;
- campaign deadline.

### 34.3 Editor notifications

- candidate assigned;
- source update;
- evidence missing;
- creator correction;
- verification due;
- report escalation.

### 34.4 Notification channels

MVP:

- in-app;
- email.

Push notifications are deferred.

---

## 35. Content Model for UX

Each public Resource view should have access to these presentation groups.

```text
Identity
Creator
Version
Lifecycle
Visuals
Summary
Capabilities
Use cases
Best fit
Non-fit
Installation
Suggested prompts
Expected outputs
Compatibility
Dependencies
Regional availability
Ranking
Verification
Reviews
Deployments
Creator responses
Source
Evidence
Alternatives
Workflow relationships
Freshness
Commercial disclosures
```

The UX must not require all fields to exist before a resource can be published, but the publication checklist defines mandatory minimums.

---

## 36. Trust Language System

AI ARK should use consistent language.

### 36.1 Evidence labels

- Source confirmed;
- Creator declared;
- AI ARK tested;
- Community reported;
- Inferred;
- Unknown.

### 36.2 Verification labels

- Source Verified;
- Functionally Tested;
- Quality Verified;
- Proven in Use;
- AI ARK Verified.

### 36.3 Availability labels

- Information accessible;
- Artifact accessible;
- Installation accessible;
- Runtime verified.

### 36.4 Risk labels

- No critical issue identified within review scope;
- Limited review;
- Unresolved risk;
- Severe risk;
- Not evaluated.

Avoid:

- Safe;
- Guaranteed;
- Fully secure;
- Works everywhere.

---

## 37. Sponsorship and Commercial UX

### 37.1 Sponsored content

Use:

> Sponsored

not:

- Recommended;
- Featured;
- Top.

### 37.2 Launch partnerships

Use:

- AI ARK First;
- Exclusive Beta on AI ARK;
- Official AI ARK Page;
- AI ARK Launch Partner.

These labels must be visually separate from verification.

### 37.3 Commercial disclosure

Resource page should contain a disclosure area when applicable:

> AI ARK has a commercial distribution relationship with this creator. This relationship does not affect organic ranking or verification.

---

## 38. SEO and Shareability

### 38.1 Public pages

Resource, creator, category, collection, and workflow pages should support:

- canonical URLs;
- structured metadata;
- social preview;
- readable titles;
- descriptive summaries;
- indexable core content.

### 38.2 Share cards

Share preview should include:

- resource or workflow name;
- concise outcome;
- creator;
- verification or rank where appropriate;
- AI ARK identity.

Avoid overcrowding.

### 38.3 Programmatic pages

Do not publish thin pages solely for keyword coverage.

Every indexable page should provide unique user value.

---

## 39. Validation Prototype Screens

The clickable prototype should cover at least these ten screens:

1. Homepage  
2. Task-oriented search results  
3. Category ranking  
4. Resource detail  
5. Creator profile  
6. Workflow detail  
7. AI ARK Labs campaign  
8. Structured review form  
9. Backend GitHub URL ingestion  
10. Editorial review workspace  

Additional recommended screens:

11. Verification report  
12. Mainland availability panel  
13. Creator dashboard  
14. Mobile resource detail  

---

## 40. Prototype Test Scenarios

### Scenario 1 — Find a presentation Skill

User searches:

> Turn a market report into a professional presentation.

Test:

- result relevance;
- ranking comprehension;
- resource-page usefulness;
- action confidence.

### Scenario 2 — Compare two Skills

Test:

- score understanding;
- evidence;
- compatibility;
- regional availability;
- selection reason.

### Scenario 3 — Follow a founder workflow

Test:

- workflow clarity;
- step value;
- resource transitions;
- expected outputs.

### Scenario 4 — Review a deployed resource

Test:

- form effort;
- environment capture;
- evidence consent;
- perceived value.

### Scenario 5 — Creator claims a page

Test:

- trust;
- evidence requirements;
- post-claim value.

### Scenario 6 — Editor imports a GitHub URL

Test:

- analysis clarity;
- evidence review;
- correction speed;
- publish confidence.

### Scenario 7 — Mainland China user evaluates availability

Test:

- understanding of four status levels;
- alternative usefulness;
- trust in check date.

---

## 41. UX Validation Metrics

### Discovery

- search-to-result click;
- result-to-resource action;
- query reformulation;
- filter use;
- time to meaningful action.

### Resource page

- install-copy rate;
- source-open rate;
- verification-detail views;
- ranking-explanation views;
- community-section use;
- save rate.

### Workflow

- step-open rate;
- multiple-resource engagement;
- save rate;
- reported usefulness;
- step completion.

### Creator

- claim start;
- claim completion;
- correction submitted;
- page shared;
- Labs interest.

### Review

- review start;
- review completion;
- evidence opt-in;
- creator response;
- helpful votes.

### Editorial

- URL-to-draft;
- review time;
- field rejection rate;
- warning-resolution time;
- publication confidence.

---

## 42. UX Acceptance Criteria

The UX specification is satisfied when:

### Public experience

- users can begin with a task or browse;
- important pages have clear next actions;
- resource detail supports decision, evaluation, onboarding, and evidence;
- ranking methodology is reachable;
- verification scope is visible;
- regional status is understandable;
- comments and reviews are distinct;
- workflow pages show ordered steps and outputs.

### Creator experience

- creators can identify unclaimed pages;
- claim flow communicates requirements;
- creator responses are distinct from editorial content;
- Labs campaigns disclose risk and scope.

### Editorial experience

- editors can inspect source and draft together;
- field-level evidence is visible;
- no automatic publication occurs;
- warnings and blocking issues are clear;
- publication creates a review record.

### Responsive experience

- primary user journeys work on mobile;
- sticky desktop panels adapt appropriately;
- filters remain usable;
- tables degrade gracefully.

### Trust experience

- status is never color-only;
- sponsored and verified labels cannot be confused;
- unknown and inferred states are visible;
- version and date are presented in key trust areas.

---

## 43. Open UX Questions

These should be resolved through prototype testing.

1. Should the homepage lead with Skills or the broader term “capabilities”?
2. Should Quality Score appear on all cards or only ranking contexts?
3. How much ranking detail belongs above the fold?
4. Should suggested prompts appear before examples or after them?
5. Should the resource action panel remain sticky on standard laptop screens?
6. Should users save without signing in through local storage?
7. Should creator response metrics be public in MVP?
8. Should Labs appear in primary navigation at launch?
9. How should partially translated pages be labelled?
10. What is the best mobile representation for compatibility matrices?
11. Should AI ARK Verified use one badge or a stacked status summary?
12. How should regional status interact with search ranking?
13. Should reviews default to current version or all versions?
14. Should workflow step completion be private or shareable?
15. How should evidence links appear without overwhelming nontechnical users?
16. Which visual-accent direction best differentiates AI ARK from ColaSkill?
17. How should agent/API interest be presented publicly before the API is open?

---

## 44. Handoff Requirements for Design

The design phase should produce:

- sitemap confirmation;
- low-fidelity wireframes;
- content hierarchy;
- component inventory;
- responsive behavior;
- interaction states;
- high-fidelity design direction;
- desktop and mobile prototypes;
- design tokens;
- accessibility annotations;
- analytics-event annotations;
- editorial-console prototype;
- test script.

Design should not begin with a logo or visual identity alone.

The order should be:

```text
Information hierarchy
↓
User journeys
↓
Wireframes
↓
Content validation
↓
Interaction model
↓
Visual direction
↓
High-fidelity prototype
```

---

## 45. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Resource and Capability Graph Specification v1.0.md`

It should define:

- the root `Resource` model;
- resource types;
- creators and organizations;
- versions;
- sources and provenance;
- evidence;
- capabilities and tasks;
- categories;
- compatibility;
- dependencies;
- regions;
- reviews and deployments;
- rankings;
- verification;
- collections;
- workflows;
- lifecycle;
- canonical identity;
- duplicates and forks;
- graph relationships;
- API-facing representations.

---

## 46. Final UX Direction

# AI ARK should make complex capability decisions feel clear, trustworthy, and actionable.

The public product should preserve the best qualities visible in ColaSkill:

- editorial curation;
- visual confidence;
- creator identity;
- rich detail pages;
- prompt-level onboarding;
- clear installation actions.

AI ARK should extend that model through:

- task search;
- evidence;
- rankings;
- verification;
- community outcomes;
- workflows;
- regional availability;
- agent-readable intelligence.

The result should not feel like a larger directory.

It should feel like:

> **The trusted place where humans and agents understand what AI capabilities exist, which ones are worth using, and how they fit together.**

---

**End of document**
