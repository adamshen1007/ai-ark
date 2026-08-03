# AI ARK Figma Prototype Build Specification v1.0

**Document status:** Figma construction and interaction baseline  
**Version:** 1.0  
**Date:** August 2, 2026  
**Working product name:** AI ARK  
**Brand status:** Working name pending legal, trademark, domain, and search-ownership clearance  
**Product stage:** Clickable Prototype Build  
**Design brief:** `AI ARK Clickable Prototype Design Brief v1.0.md`  
**Content source:** `AI ARK Prototype Content Fixture Pack v1.0.md`  
**Primary audience:** Product designer, visual designer, UX designer, content designer, design-system designer, prototype builder, researcher, and future frontend engineering team  
**Build decision:** GO  
**Production engineering status:** NOT AUTHORIZED  

---

## 1. Purpose

This specification defines exactly how the AI ARK clickable prototype should be constructed in Figma.

It translates the approved prototype brief and fixture pack into:

- Figma file structure;
- page structure;
- frame naming;
- desktop, tablet, and mobile dimensions;
- layout grids;
- variables;
- design tokens;
- typography;
- component hierarchy;
- variants;
- auto-layout behavior;
- responsive constraints;
- prototype flows;
- overlays;
- animations;
- annotations;
- accessibility notes;
- research-task entry points;
- review checkpoints;
- export requirements;
- engineering-handoff preparation.

The goal is to create a prototype that is:

- visually coherent;
- behaviorally testable;
- content-complete;
- internally consistent;
- easy to review;
- ready for moderated usability testing;
- useful as a later engineering reference.

---

## 2. Build Objectives

The Figma prototype must demonstrate:

1. task-oriented discovery;
2. evidence-backed Resource comparison;
3. transparent ranking;
4. scoped verification;
5. version awareness;
6. creator identity and authorization;
7. community evidence;
8. workflow intelligence;
9. Mainland availability;
10. AI ARK Labs;
11. GitHub URL ingestion;
12. editorial publication governance.

The design should make the AI ARK product thesis visible without requiring explanatory narration.

---

## 3. Figma File Name

Use:

```text
AI ARK — Clickable Prototype v1.0
```

If a dated suffix is needed:

```text
AI ARK — Clickable Prototype v1.0 — 2026-08-02
```

---

## 4. Figma Page Structure

Create the following pages in this exact order.

```text
00 — Cover & Decisions
01 — Foundations
02 — Variables & Styles
03 — Components
04 — Desktop Public
05 — Mobile Public
06 — Creator & Labs
07 — Community
08 — Admin Console
09 — Prototype Flows
10 — Research Tasks
11 — Handoff & Annotations
12 — Archive
```

### 4.1 Page purpose

#### 00 — Cover & Decisions

Contains:

- project title;
- version;
- design status;
- product proposition;
- controlling documents;
- approved visual direction;
- prototype scope;
- unresolved questions;
- review status.

#### 01 — Foundations

Contains:

- visual direction;
- mood references;
- layout principles;
- typography samples;
- color rationale;
- trust-label architecture;
- example card anatomy;
- spacing principles.

#### 02 — Variables & Styles

Contains:

- color variables;
- spacing variables;
- radius variables;
- typography styles;
- elevation styles;
- icon sizes;
- status tokens;
- breakpoint documentation.

#### 03 — Components

Contains all production-quality prototype components and variants.

#### 04 — Desktop Public

Contains desktop and wide-screen public pages.

#### 05 — Mobile Public

Contains mobile public pages and selected tablet variants.

#### 06 — Creator & Labs

Contains creator profile, claim, dashboard, and Labs flows.

#### 07 — Community

Contains reviews, issue reports, evidence upload, creator responses, and moderation-visible states.

#### 08 — Admin Console

Contains ingestion, analysis progress, editorial review, publication, ranking explanation, and verification report states.

#### 09 — Prototype Flows

Contains duplicated clean frames linked into testable flows.

#### 10 — Research Tasks

Contains task-start frames, researcher instructions, and reset links.

#### 11 — Handoff & Annotations

Contains:

- screen inventory;
- interaction notes;
- analytics notes;
- accessibility annotations;
- responsive behavior;
- known prototype limitations.

#### 12 — Archive

Contains rejected layouts, old iterations, and unused concepts.

Archive frames must not remain linked in the final prototype.

---

## 5. Cover Page

### 5.1 Cover frame

Frame name:

```text
00.00 — Cover
```

Dimensions:

```text
1440 × 1024
```

Content:

- AI ARK;
- “Clickable Prototype v1.0”;
- “Editorial Atlas Direction”;
- primary proposition;
- prototype status;
- date;
- owner;
- links to controlling documents;
- latest review decision.

### 5.2 Decision panel

Show:

```text
Prototype: Authorized
User Testing: Pending
Production Engineering: Not Authorized
Brand Clearance: Pending
Mainland Public Launch: Not Authorized
```

### 5.3 Scope panel

Show four columns:

```text
Public Prototype
Controlled Pilot
Future Architecture
Out of Scope
```

---

## 6. Frame Naming Convention

Use:

```text
[PageGroup].[Sequence] — [Screen Name] — [State] — [Breakpoint]
```

Examples:

```text
04.01 — Homepage — Default — Desktop
04.02 — Search Results — Presentation Query — Desktop
04.04 — Resource Detail — Decksmith 2.3.0 — Desktop
05.02 — Resource Detail — Decksmith — Mobile
08.03 — Editorial Review — Needs Evidence — Desktop
```

### 6.1 Component naming

Use:

```text
Category/Component/Variant/State
```

Examples:

```text
Card/Resource/Editorial/Default
Card/Resource/Search/Saved
Badge/Verification/QualityVerified
Badge/Identity/CreatorVerified
Status/Availability/RuntimeConfirmed
Workflow/Step/Expanded
Admin/FieldInspector/NeedsEvidence
```

### 6.2 Layer naming

Important layers should have semantic names.

Use:

```text
Header
Hero
Search Input
Resource Preview
Trust Summary
Primary CTA
Local Navigation
Section — Compatibility
```

Avoid:

```text
Frame 437
Rectangle 82
Group 19
```

---

## 7. Frame Dimensions

## 7.1 Desktop

Primary desktop frame:

```text
1440 × auto-height
```

Content maximum width:

```text
1200px
```

Wide editorial pages may use:

```text
1280px
```

Admin console may use:

```text
1440px full width
```

## 7.2 Laptop

Reference laptop frame:

```text
1280 × 832
```

Use for:

- sticky right rail testing;
- long Resource pages;
- admin review workspace.

## 7.3 Tablet

Reference tablet frame:

```text
1024 × 1366
```

Tablet is annotation-only unless capacity allows full responsive frames.

## 7.4 Mobile

Primary mobile frame:

```text
390 × 844
```

Secondary mobile reference:

```text
360 × 800
```

Use 390px for clickable prototype.

## 7.5 Overlays

Desktop modal:

```text
560–720px width
```

Mobile bottom sheet:

```text
390px width
auto height
maximum 80% viewport
```

---

## 8. Layout Grids

## 8.1 Desktop grid

Use:

```text
12 columns
80px margins
24px gutters
```

For 1280 laptop:

```text
12 columns
48px margins
20px gutters
```

## 8.2 Mobile grid

Use:

```text
4 columns
20px margins
12px gutters
```

## 8.3 Admin grid

Use flexible application layout:

```text
Left rail: 240px
Main content: flexible
Inspector: 320px
Gutter: 16px
```

Editorial review workspace:

```text
Source pane: 280px
Draft pane: flexible, minimum 560px
Inspector pane: 340px
```

---

## 9. Auto-Layout Rules

### 9.1 Default

All reusable components should use auto layout.

### 9.2 Public sections

Vertical auto layout:

```text
Gap: 64–96px desktop
Gap: 40–64px mobile
```

### 9.3 Cards

Cards should use:

```text
Direction: vertical
Width: fill container or fixed variant
Height: hug content
Padding: 16–24px
Gap: 12–16px
```

### 9.4 Buttons

Use:

```text
Horizontal auto layout
Padding X: 16px
Padding Y: 10px
Gap: 8px
Minimum height: 40px
```

Primary hero buttons:

```text
Minimum height: 48px
```

### 9.5 Trust clusters

Use horizontal wrap on desktop.

Use two-column or vertical layout on mobile.

### 9.6 Responsive text

Set:

- text layers to fill container;
- headings to hug height;
- avoid fixed text heights;
- support longer Chinese strings.

---

## 10. Variables

Use Figma variables rather than isolated styles where possible.

Create collections:

```text
Color
Spacing
Radius
Size
Opacity
Motion
Breakpoint
```

---

## 11. Color Variables

Recommended initial palette for Direction A — Editorial Atlas.

### 11.1 Neutral

```text
color/bg/page          #F6F5F1
color/bg/surface       #FFFFFF
color/bg/subtle        #EFEEE9
color/bg/inverse       #111418

color/text/primary     #15181C
color/text/secondary   #5C626B
color/text/tertiary    #858C95
color/text/inverse     #FFFFFF

color/border/default   #DADDE1
color/border/strong    #B9BEC6
color/border/subtle    #E7E8EA
```

### 11.2 Primary accent

Recommended:

```text
color/accent/primary       #3157D5
color/accent/primaryHover  #2749B8
color/accent/primarySoft   #E9EEFF
color/accent/primaryText   #2342A1
```

### 11.3 Secondary accent

```text
color/accent/secondary      #0C7C79
color/accent/secondarySoft  #E5F5F3
```

### 11.4 Status

```text
color/status/success       #16794B
color/status/successSoft   #E6F4EC

color/status/warning       #A15C00
color/status/warningSoft   #FFF1DC

color/status/danger        #B23A3A
color/status/dangerSoft    #FCE8E8

color/status/info          #3168A6
color/status/infoSoft      #E9F1FA

color/status/neutral       #666D76
color/status/neutralSoft   #ECEEEF
```

### 11.5 Commercial

Commercial relationships must use a separate visual family.

```text
color/commercial/base      #7B4BB7
color/commercial/soft      #F2EAFB
color/commercial/text      #60378F
```

### 11.6 Evidence confidence

Avoid red/green judgment.

```text
color/confidence/high      #255F95
color/confidence/medium    #6F5A28
color/confidence/low       #6B6574
```

---

## 12. Typography

Use available production-safe fonts.

Recommended prototype stack:

### Display and headings

```text
Inter
```

Use heavier weights and editorial spacing.

Alternative if available in the design environment:

```text
Instrument Sans
```

### Body

```text
Inter
```

### Monospace

```text
IBM Plex Mono
```

Do not distribute font files.

### 12.1 Typography styles

```text
Display/XL       64 / 68 / 600
Display/L        52 / 58 / 600
Heading/XL       40 / 46 / 600
Heading/L        32 / 38 / 600
Heading/M        24 / 30 / 600
Heading/S        20 / 26 / 600
Body/L           18 / 28 / 400
Body/M           16 / 24 / 400
Body/S           14 / 20 / 400
Label/L          14 / 20 / 600
Label/M          12 / 16 / 600
Code/M           14 / 22 / 400
```

### 12.2 Mobile typography

```text
Display/Mobile   40 / 44 / 600
Heading/Mobile   28 / 34 / 600
Body/Mobile      16 / 24 / 400
```

### 12.3 Long-form readability

Resource detail body:

```text
Maximum readable text width: 720px
```

---

## 13. Spacing Variables

```text
space/0   0
space/1   4
space/2   8
space/3   12
space/4   16
space/5   20
space/6   24
space/8   32
space/10  40
space/12  48
space/16  64
space/20  80
space/24  96
space/32  128
```

---

## 14. Radius Variables

```text
radius/none   0
radius/s      6
radius/m      10
radius/l      14
radius/xl     20
radius/pill   999
```

Recommended use:

- inputs: 10;
- cards: 14;
- large visual panels: 20;
- badges: pill;
- admin panels: 10.

---

## 15. Elevation Styles

Use minimal elevation.

```text
elevation/none
elevation/subtle
elevation/floating
elevation/modal
```

### Suggested values

#### Subtle

```text
0 1px 2px rgba(20,24,28,0.05)
```

#### Floating

```text
0 8px 24px rgba(20,24,28,0.10)
```

#### Modal

```text
0 24px 64px rgba(20,24,28,0.18)
```

---

## 16. Icon System

Use one consistent line-icon family.

Recommended icon size variables:

```text
icon/12
icon/16
icon/20
icon/24
icon/32
```

Required icons:

- search;
- category;
- Skill;
- creator;
- ranking;
- verification;
- confidence;
- risk;
- region;
- installation;
- source;
- workflow;
- review;
- issue;
- Labs;
- save;
- share;
- filter;
- copy;
- external link;
- chevron;
- warning;
- success;
- unknown.

Avoid mixing filled and line icons without a semantic reason.

---

## 17. Component Architecture

Build components in this order.

### Tier 1 — Primitives

- button;
- icon button;
- input;
- textarea;
- checkbox;
- radio;
- switch;
- chip;
- badge;
- divider;
- avatar;
- icon;
- tooltip;
- progress indicator.

### Tier 2 — Composite controls

- search bar;
- filter bar;
- tabs;
- accordion;
- segmented control;
- code block;
- rating control;
- evidence field;
- status row;
- section header.

### Tier 3 — Product components

- Resource card;
- Ranking row;
- Trust summary;
- Compatibility row;
- Availability panel;
- Verification summary;
- Review card;
- Creator card;
- Workflow step;
- Labs campaign card;
- Admin field inspector.

### Tier 4 — Page templates

- homepage;
- search results;
- Resource detail;
- ranking;
- verification report;
- creator profile;
- workflow;
- Labs campaign;
- review form;
- admin review.

---

## 18. Buttons

Create component:

```text
Button
```

Properties:

```text
Style
Size
State
IconLeft
IconRight
FullWidth
```

### 18.1 Styles

```text
Primary
Secondary
Tertiary
Ghost
Danger
Inverse
```

### 18.2 Sizes

```text
Small
Medium
Large
```

### 18.3 States

```text
Default
Hover
Pressed
Focused
Disabled
Loading
```

### 18.4 Prototype behavior

- Primary actions: instant or dissolve 150ms;
- destructive actions: confirmation overlay;
- copy action: toast “Copied”.

---

## 19. Badge System

Create separate component families.

### 19.1 Verification badge

```text
Badge/Verification
```

Variants:

```text
SourceVerified
FunctionallyTested
QualityVerified
ProvenInUse
AIARKVerified
Expired
UnderReview
```

### 19.2 Identity badge

```text
Badge/Identity
```

Variants:

```text
CreatorClaimed
CreatorIdentityVerified
OrganizationVerified
Unclaimed
```

### 19.3 Usage evidence badge

```text
Badge/UsageEvidence
```

Variants:

```text
VerifiedInstallation
VerifiedDeployment
VerifiedBetaTest
VerifiedProductionUse
```

### 19.4 Commercial badge

```text
Badge/Commercial
```

Variants:

```text
Sponsored
AIARKFirst
ExclusiveBeta
CreatorAuthorizedPage
LaunchPartner
```

### 19.5 Status badge

```text
Badge/Status
```

Variants:

```text
Stable
Beta
Experimental
Archived
UpdateDetected
UnderReview
```

These component families must not share identical colors or icons.

---

## 20. Quality Score Component

Component:

```text
Trust/QualityScore
```

Properties:

```text
Score
Size
ShowLabel
ShowMethodology
State
```

Variants:

```text
Compact
Card
Hero
Detail
```

### 20.1 Public presentation

Show:

```text
89
Quality Score
```

Do not show:

```text
89%
```

### 20.2 Interaction

Click:

- opens Ranking Explanation page or drawer.

### 20.3 Confidence pairing

Quality Score should usually be paired with:

```text
Evidence Confidence: High
```

---

## 21. Evidence Confidence Component

Component:

```text
Trust/EvidenceConfidence
```

Variants:

```text
High
Medium
Low
Insufficient
```

Presentation:

- text label;
- small icon;
- optional explanation tooltip.

Avoid a progress bar that implies a precise probability.

---

## 22. Resource Card Components

## 22.1 Editorial card

Name:

```text
Card/Resource/Editorial
```

Width:

```text
276–320px
```

Content:

- 16:10 preview;
- category;
- title;
- one-line outcome;
- creator;
- Verification badge;
- Quality Score;
- runtime icons.

Variants:

```text
Default
Hover
Saved
Sponsored
Archived
```

## 22.2 Search card

Name:

```text
Card/Resource/Search
```

Width:

```text
Fill container
```

Layout:

```text
Preview 160px
Main content flexible
Trust summary 160px
```

Mobile:

- stacked;
- preview full width;
- trust summary wrap.

## 22.3 Ranking row

Name:

```text
Row/Ranking/Resource
```

Properties:

- rank;
- movement;
- Resource;
- score;
- confidence;
- verification;
- momentum;
- reviewed date;
- expanded.

Expanded state includes score components.

---

## 23. Trust Summary Component

Name:

```text
Trust/Summary
```

Content:

- Quality Score;
- Category Rank;
- Evidence Confidence;
- Verification;
- Risk Status;
- version;
- reviewed date.

Variants:

```text
HeroRail
CardCompact
MobileSummary
```

---

## 24. Compatibility Component

Name:

```text
Compatibility/Row
```

Properties:

- runtime;
- status;
- version;
- evidence;
- date;
- limitation.

Variants:

```text
Tested
SourceDeclared
CreatorDeclared
CommunityReported
Likely
Unsupported
Unknown
```

Mobile:

- two-row stacked layout.

---

## 25. Mainland Availability Component

Name:

```text
Availability/Mainland
```

### 25.1 Compact variant

Displays:

```text
Mainland China
Usable with limitations
```

### 25.2 Detail variant

Four rows:

```text
Information
Artifact
Installation
Runtime
```

Each row has:

- status;
- method;
- date;
- optional disclosure.

### 25.3 Card variant

Shows one compact icon and label.

### 25.4 States

```text
FullyAvailable
UsableWithLimitations
InformationOnly
AlternativeRequired
NotFeasible
Unknown
UnderReview
Expired
```

---

## 26. Workflow Components

## 26.1 Workflow step

Name:

```text
Workflow/Step
```

Properties:

- step number;
- title;
- objective;
- Resource;
- status;
- expected output;
- approval;
- regional note;
- expanded.

Variants:

```text
Collapsed
Expanded
Completed
Blocked
Failed
Optional
```

## 26.2 Step connector

Name:

```text
Workflow/Connector
```

Variants:

```text
Default
Completed
Current
Conditional
```

## 26.3 Workflow hero

Name:

```text
Workflow/Hero
```

Contains:

- workflow type;
- title;
- outcome;
- target user;
- time;
- cost;
- region;
- save/start.

---

## 27. Review Components

## 27.1 Review card

Name:

```text
Review/Card
```

Variants:

```text
Structured
VerifiedInstallation
VerifiedDeployment
VerifiedBetaTest
VerifiedProductionUse
Issue
```

Content:

- reviewer;
- status;
- version;
- environment;
- task;
- ratings;
- narrative;
- evidence;
- helpful votes;
- creator response.

## 27.2 Creator response

Name:

```text
Review/CreatorResponse
```

Variants:

```text
Answer
Acknowledged
FixPlanned
Resolved
CannotReproduce
FixedInVersion
```

## 27.3 Rating row

Name:

```text
Review/RatingRow
```

Use:

- numeric score;
- text label;
- accessible alternative.

---

## 28. Labs Components

## 28.1 Campaign card

Name:

```text
Labs/CampaignCard
```

Content:

- stage;
- title;
- creator;
- tester capacity;
- deadline;
- runtime;
- incentive;
- risk label.

## 28.2 Campaign status

Variants:

```text
ApplicationsOpen
Selection
Testing
FeedbackReview
Completed
Suspended
```

## 28.3 Tester application step

Name:

```text
Labs/ApplicationStep
```

Properties:

- step number;
- title;
- completion;
- error.

---

## 29. Admin Components

## 29.1 Source file row

```text
Admin/SourceFileRow
```

Variants:

- selected;
- warning;
- evidence-used;
- unsupported.

## 29.2 Evidence item

```text
Admin/EvidenceItem
```

Properties:

- source;
- locator;
- class;
- confidence;
- public/private;
- selected.

## 29.3 Draft field

```text
Admin/DraftField
```

Variants:

```text
Unreviewed
Accepted
Edited
Rejected
NeedsEvidence
NeedsCreatorInput
Hidden
Blocking
```

## 29.4 Warning panel

```text
Admin/WarningPanel
```

Severity:

```text
Info
Warning
Blocking
Critical
```

## 29.5 Publication checklist row

```text
Admin/ChecklistRow
```

States:

```text
Complete
Incomplete
Blocking
NotApplicable
```

---

## 30. Homepage Frame Specification

Frame:

```text
04.01 — Homepage — Default — Desktop
```

Dimensions:

```text
1440 × 5200
```

### 30.1 Sections

1. Header  
2. Hero  
3. Curated Skills  
4. Explore by Category  
5. Rankings Preview  
6. Featured Workflow  
7. AI ARK Verified  
8. New and Rising  
9. Creators  
10. Beta Testing  
11. Trust Footer  
12. Main Footer  

### 30.2 Hero height

Approximate:

```text
680px
```

### 30.3 Hero alignment

Centered copy and search.

Search width:

```text
760px
```

### 30.4 Prototype links

- search input → Search Results;
- Browse Skills → Skills/Ranking;
- Decksmith card → Resource Detail;
- Featured Workflow → Workflow;
- creator → Creator Profile;
- campaign → Labs.

---

## 31. Search Results Frame

Frame:

```text
04.02 — Search Results — Presentation Query — Desktop
```

Dimensions:

```text
1440 × 2600
```

### 31.1 Layout

- sticky header;
- query input;
- interpretation block;
- filter bar;
- three Resource results;
- workflow insertion;
- related searches.

### 31.2 Filter overlay

Frame:

```text
Overlay — Search Filters — Desktop
```

Width:

```text
360px
```

Slides in from right.

### 31.3 Prototype interactions

- first result → Resource Detail;
- ranking value → Ranking Explanation;
- workflow insertion → Workflow;
- Mainland filter → updated result-state frame;
- no-result chip → No Results frame.

---

## 32. Ranking Frame

Frame:

```text
04.03 — Ranking — Presentation — Desktop
```

Dimensions:

```text
1440 × 1800
```

### 32.1 Table width

```text
1200px
```

### 32.2 Tabs

- Best Overall;
- Best Verified;
- Rising;
- New and Promising.

### 32.3 Expanded row

Create separate frame:

```text
04.03B — Ranking — Decksmith Expanded — Desktop
```

### 32.4 Prototype interactions

- row click → expanded frame;
- Quality Score → Ranking Explanation;
- Resource name → Resource Detail;
- Methodology → explanatory overlay.

---

## 33. Resource Detail Frame

Frame:

```text
04.04 — Resource Detail — Decksmith 2.3.0 — Desktop
```

Dimensions:

```text
1440 × 7600
```

### 33.1 Hero layout

Main:

```text
760px
```

Sticky rail:

```text
320px
```

Gap:

```text
48px
```

### 33.2 Rail behavior

Prototype cannot simulate true sticky behavior perfectly.

Use:

- fixed-position illusion within scroll prototype;
- or duplicate the rail in long linked sections.

Preferred:

- use Figma fixed-position checkbox for rail if supported.

### 33.3 Local navigation

Fixed below global header.

Links to section anchors if possible.

### 33.4 Section order

1. Overview  
2. Suggested Prompts  
3. Preview and Examples  
4. Installation and Setup  
5. Compatibility  
6. Dependencies and Permissions  
7. Ranking  
8. Verification  
9. Mainland Availability  
10. Community  
11. Alternatives  
12. Source and Provenance  

### 33.5 Prototype interactions

- Copy Install → toast;
- Open Source → external-link confirmation overlay;
- Quality Score → Ranking Explanation;
- Verification → Verification Report;
- Mainland status → Mainland Detail;
- Write Review → Review flow;
- Creator → Creator Profile;
- workflow link → Workflow;
- version banner → version comparison overlay.

---

## 34. Ranking Explanation Frame

Frame:

```text
04.05 — Ranking Explanation — Decksmith — Desktop
```

Dimensions:

```text
1440 × 2200
```

Sections:

- score summary;
- confidence;
- component breakdown;
- evidence sources;
- risk status;
- methodology;
- commercial independence;
- correction/appeal.

Chart style:

- horizontal bars;
- no radar chart;
- each bar includes text score and explanation.

---

## 35. Verification Report Frame

Frame:

```text
04.06 — Verification Report — Decksmith 2.3.0 — Desktop
```

Dimensions:

```text
1440 × 2600
```

Sections:

- level;
- status;
- version;
- date and expiry;
- scope;
- environment;
- scenarios;
- findings;
- limitations;
- unresolved risks;
- methodology;
- evaluator;
- historical version.

Interaction:

- previous verification → history drawer;
- expired badge → explanation tooltip;
- appeal link → appeal-information modal.

---

## 36. Workflow Frame

Frame:

```text
04.07 — Workflow — Build SaaS MVP — Desktop
```

Dimensions:

```text
1440 × 4200
```

### 36.1 Header

- type;
- title;
- outcome;
- metadata;
- save/start.

### 36.2 Visual path

Use seven horizontal nodes.

### 36.3 Detailed steps

Vertical step cards.

### 36.4 Prototype interactions

- step expand;
- Resource link → Resource Detail or fixture card overlay;
- View Alternative → bottom sheet or modal;
- Start Workflow → progress-state frame;
- regional warning → Mainland Detail;
- approval point → approval explanation overlay.

---

## 37. Creator Profile Frame

Frame:

```text
06.01 — Creator Profile — Northstar Studio — Desktop
```

Dimensions:

```text
1440 × 2400
```

Sections:

- profile header;
- identity;
- commercial disclosure;
- metrics;
- Resources;
- Labs;
- updates;
- community responses;
- about.

Interaction:

- Resource → Resource Detail;
- campaign → Labs;
- disclosure → commercial-detail modal.

---

## 38. Labs Campaign Frame

Frame:

```text
06.02 — Labs Campaign — Lighthouse Closed Beta — Desktop
```

Dimensions:

```text
1440 × 2500
```

Sections:

- header;
- objective;
- who should apply;
- test tasks;
- environment;
- risks;
- permissions;
- incentive;
- confidentiality;
- apply.

Interaction:

- Apply → application overlay or full frame;
- known risk → expanded details;
- creator → Creator Profile.

---

## 39. Review Flow Frames

Create:

```text
07.01 — Review — Step 1 Task — Desktop
07.02 — Review — Step 2 Environment — Desktop
07.03 — Review — Step 3 Results — Desktop
07.04 — Review — Step 4 Ratings — Desktop
07.05 — Review — Step 5 Narrative — Desktop
07.06 — Review — Step 6 Evidence — Desktop
07.07 — Review — Step 7 Disclosure — Desktop
07.08 — Review — Confirmation — Desktop
```

Use one shared form shell.

Progress:

```text
1 of 7
```

Interaction:

- Back;
- Continue;
- Save draft;
- Submit.

Evidence overlay:

- privacy options;
- redaction preview;
- upload state.

---

## 40. Mainland Availability Frame

Frame:

```text
04.08 — Mainland Availability — Decksmith — Desktop
```

Dimensions:

```text
1440 × 1800
```

Sections:

- composite status;
- four levels;
- evidence;
- mirror details;
- test environment;
- limitations;
- alternative;
- anti-circumvention note;
- history.

Interaction:

- authorized mirror → detail modal;
- checksum → copy;
- alternative → Resource card overlay.

---

## 41. Creator Claim Frames

Create:

```text
06.03 — Creator Claim — Entry — Desktop
06.04 — Creator Claim — GitHub Verification — Desktop
06.05 — Creator Claim — Role — Desktop
06.06 — Creator Claim — Review — Desktop
06.07 — Creator Claim — Submitted — Desktop
```

Use stepper.

---

## 42. Admin Ingestion Frames

Create:

```text
08.01 — Ingestion — URL Entry — Desktop
08.02 — Ingestion — Progress — Desktop
08.03 — Ingestion — Result Summary — Desktop
08.04 — Editorial Review — Default — Desktop
08.05 — Editorial Review — Blocking Warnings — Desktop
08.06 — Publication Checklist — Blocked — Desktop
08.07 — Publication Confirmation — Desktop
```

### 42.1 Ingestion progress

Use step progress and streamed findings.

### 42.2 Editorial review

Prototype interactions:

- source file selection updates evidence pane;
- field action changes field status;
- warning click jumps to field;
- Approve and Publish opens checklist;
- unresolved checklist blocks publish.

---

## 43. Mobile Frames

Create:

```text
05.01 — Homepage — Default — Mobile
05.02 — Search Results — Presentation Query — Mobile
05.03 — Resource Detail — Decksmith — Mobile
05.04 — Workflow — SaaS MVP — Mobile
05.05 — Review — Task — Mobile
05.06 — Review — Evidence — Mobile
05.07 — Creator Profile — Northstar — Mobile
05.08 — Labs Campaign — Lighthouse — Mobile
```

### 43.1 Mobile Resource Detail

Use:

- compact hero;
- trust summary grid;
- sticky bottom action bar;
- horizontal anchor navigation;
- accordion sections;
- single-column compatibility;
- compact reviews.

### 43.2 Mobile Workflow

Use:

- vertical progress line;
- one expanded step;
- alternative bottom sheet;
- sticky “Continue” action.

---

## 44. Prototype Flow Map

Create a visible flow map on Page 09.

## 44.1 Flow 1 — Discovery

```text
Homepage
→ Search Results
→ Resource Detail
→ Ranking Explanation
→ Resource Detail
→ Copy Install Toast
```

## 44.2 Flow 2 — Verification

```text
Resource Detail
→ Verification Report
→ Historical Verification
→ Resource Detail
```

## 44.3 Flow 3 — Workflow

```text
Homepage
→ Curated Workflow
→ Step Expand
→ Resource Detail
→ Save Workflow
```

## 44.4 Flow 4 — Community

```text
Resource Detail
→ Review Step 1
→ …
→ Review Confirmation
```

## 44.5 Flow 5 — Creator

```text
Creator Profile
→ Creator Claim
→ Submitted
```

## 44.6 Flow 6 — Labs

```text
Labs Campaign
→ Apply
→ Consent
→ Submitted
```

## 44.7 Flow 7 — Editorial

```text
URL Entry
→ Progress
→ Result
→ Review
→ Checklist
→ Confirmation
```

---

## 45. Prototype Interaction Rules

### 45.1 Navigation transitions

Use:

```text
Instant
or
Dissolve 150ms
```

### 45.2 Drawers and bottom sheets

Use:

```text
Move In 200ms
Ease Out
```

### 45.3 Accordions

Use:

```text
Smart Animate 200ms
```

### 45.4 Hover

Desktop only:

- card lift 2px;
- border accent;
- image scale maximum 1.01;
- no dramatic motion.

### 45.5 Focus

Prototype frames should visually demonstrate keyboard focus on:

- search;
- buttons;
- tabs;
- filters;
- form fields.

---

## 46. Overlays

Required overlays:

```text
Search Filters
Ranking Methodology
Verification Scope
Commercial Disclosure
Version Comparison
Copy Toast
Save Confirmation
Alternative Resource
Approval Point
Authorized Mirror Detail
Evidence Privacy
External Link Warning
Destructive Confirmation
```

### 46.1 Overlay behavior

- close on X;
- close on outside click unless destructive;
- support Escape annotation;
- mobile uses bottom sheet where appropriate.

---

## 47. Form Validation States

Every form field should have:

```text
Default
Focused
Filled
Error
Disabled
Success
```

Examples:

### Review version missing

> Select the Resource version you used.

### Evidence contains possible secret

> This file may contain a credential. Remove or redact it before continuing.

### Claim authority missing

> Choose the role you are claiming for this Resource.

### GitHub URL invalid

> Enter a valid public GitHub repository URL.

---

## 48. Accessibility Annotations

Page 11 should contain annotation cards for:

- heading order;
- focus order;
- keyboard behavior;
- status text;
- contrast;
- alt text;
- form errors;
- motion;
- table alternatives;
- chart alternatives.

### 48.1 Ranking bars

Each visual bar must have:

- numeric score;
- label;
- explanatory text.

### 48.2 Availability status

Every colored status must include text.

### 48.3 Review ratings

Do not rely only on star icons.

Show:

```text
Output Quality: 5 of 5
```

### 48.4 Long pages

Provide:

- local section navigation;
- skip-to-content note;
- meaningful headings.

---

## 49. Analytics Annotations

Annotate prototype actions with proposed event names.

Examples:

```text
search_submitted
search_result_clicked
resource_viewed
install_command_copied
ranking_explanation_opened
verification_opened
workflow_saved
review_started
review_submitted
creator_claim_started
labs_application_started
source_submitted
resource_published
```

Use a small annotation label outside the visible prototype frame.

---

## 50. Content-to-Frame Mapping

Page 11 should include a table.

| Frame | Fixture section |
|---|---|
| Homepage | Fixture §§5–14 |
| Search Results | Fixture §§21–25 |
| Ranking | Fixture §§26–28 |
| Resource Detail | Fixture §§29–51 |
| Verification | Fixture §§52–57 |
| Creator Profile | Fixture §§58–63 |
| SaaS Workflow | Fixture §§64–71 |
| Research-to-Deck Workflow | Fixture §§72–74 |
| Landing Audit Workflow | Fixture §§75–76 |
| Labs | Fixture §§77–85 |
| Reviews | Fixture §§86–88 |
| Mainland | Fixture §§89–95 |
| Creator Claim | Fixture §§96–99 |
| Ingestion | Fixture §§100–104 |
| Evidence | Fixture §§105–110 |
| Editorial Review | Fixture §§111–120 |

---

## 51. Prototype Entry Points for Research

Create task-start frames on Page 10.

### Research Start 1

```text
10.01 — Task Start — Find a Presentation Skill
```

Button:

> Start Task

Links to Homepage.

### Research Start 2

```text
10.02 — Task Start — Explain the Ranking
```

Links directly to Ranking.

### Research Start 3

```text
10.03 — Task Start — Check Mainland Availability
```

Links to Resource Detail.

### Research Start 4

```text
10.04 — Task Start — Follow a Workflow
```

Links to Homepage or Workflow.

### Research Start 5

```text
10.05 — Task Start — Submit a Review
```

Links to Resource Detail.

### Research Start 6

```text
10.06 — Task Start — Import a GitHub Resource
```

Links to Admin Ingestion.

---

## 52. Reset and Completion Frames

Each research flow should end on:

```text
10.90 — Task Complete
```

Content:

> Task complete. Return to the researcher.

Provide hidden reset link back to task start.

---

## 53. Prototype State Coverage

The final Figma file should demonstrate:

### Public

- default;
- hover;
- focused;
- loading;
- no results;
- saved;
- update detected;
- verification expired;
- regional status expired;
- severe risk.

### Creator

- unclaimed;
- claim pending;
- verified;
- commercial disclosure.

### Community

- review submitted;
- evidence pending;
- creator responded;
- issue confirmed.

### Admin

- ingestion progress;
- duplicate warning;
- rights warning;
- unsupported claim;
- blocked publication;
- successful publication.

---

## 54. Internal Review Checkpoints

### Checkpoint 1 — Foundations

Review:

- visual direction;
- color;
- typography;
- trust separation;
- component naming.

### Checkpoint 2 — Core public pages

Review:

- homepage;
- search;
- ranking;
- Resource detail.

### Checkpoint 3 — Trust and workflow

Review:

- verification;
- Mainland;
- workflow;
- reviews.

### Checkpoint 4 — Creator and admin

Review:

- creator;
- Labs;
- claim;
- ingestion;
- editorial review.

### Checkpoint 5 — Mobile and prototype links

Review:

- mobile;
- interactions;
- research tasks;
- accessibility.

Decision at each checkpoint:

```text
GO
GO WITH FIXES
REMEDIATE
```

---

## 55. Design QA Checklist

### Visual

```text
□ Accent is distinct from ColaSkill
□ Commercial and verification badges differ
□ Cards are not overloaded
□ Long-form pages remain readable
□ Status colors are consistent
□ Mobile hierarchy is clear
```

### Content

```text
□ Scores are consistent
□ Versions are consistent
□ Verification scope is consistent
□ Mainland status is consistent
□ Fictional metrics remain internal fixtures
□ No unsupported real-world claims
```

### Interaction

```text
□ Primary flows work
□ Back paths work
□ Overlays close
□ Toasts return
□ Form validation appears
□ Task resets work
```

### Trust

```text
□ Quality Score and Confidence are distinct
□ Creator identity and Resource Verification are distinct
□ Usage evidence and Resource Verification are distinct
□ Commercial labels are distinct
□ Current, detected, and verified versions are distinct
```

### Accessibility

```text
□ Focus shown
□ Contrast checked
□ Text labels accompany icons
□ Form errors visible
□ Touch targets sufficient
□ No color-only state
```

---

## 56. Export Requirements

Export key screenshots as:

```text
PNG
2×
sRGB
```

Required exports:

```text
ai-ark-homepage-desktop.png
ai-ark-search-results-desktop.png
ai-ark-ranking-desktop.png
ai-ark-resource-detail-desktop.png
ai-ark-resource-detail-mobile.png
ai-ark-verification-report.png
ai-ark-workflow-desktop.png
ai-ark-creator-profile.png
ai-ark-labs-campaign.png
ai-ark-editorial-review.png
```

### 56.1 PDF export

Optional:

```text
AI ARK Prototype Overview v1.0.pdf
```

Should contain:

- key screens;
- flow map;
- design principles;
- prototype limitations.

### 56.2 Prototype link

Provide one primary presentation link with:

- correct starting point;
- no editor-only frames;
- no archived frames;
- hotspot hints disabled unless required;
- device framing disabled for desktop;
- mobile device frame optional.

---

## 57. Engineering-Handoff Preparation

Although production engineering is not yet authorized, the Figma file should be structured for later handoff.

Include:

- design tokens;
- component properties;
- spacing;
- states;
- responsive behavior;
- content mapping;
- analytics events;
- accessibility notes.

Do not add speculative production implementation detail that has not been validated.

---

## 58. Prototype Limitations Annotation

The Figma file must visibly document:

```text
This prototype uses fictional or composite Resource fixtures.
Ranking data is synthetic.
Verification reports are prototype examples.
Install commands are not production instructions.
Mainland mirror details are prototype fixtures.
API and generated-path features are private-pilot concepts.
```

Place this on:

- Cover page;
- Research page;
- Handoff page.

Do not place it inside normal test screens unless required to avoid participant deception.

---

## 59. Acceptance Criteria

The Figma Prototype Build Specification is satisfied when:

### File organization

- all required pages exist;
- frames use approved naming;
- components are centralized;
- archive is separated.

### Foundations

- variables exist;
- typography and color are defined;
- grids and breakpoints are documented;
- trust-label systems are distinct.

### Screens

- all required desktop, mobile, creator, Labs, community, and admin screens exist;
- exact fixture content is used;
- screen states are included.

### Interaction

- seven prototype flows are functional;
- required overlays exist;
- research entry and reset frames exist;
- destructive and blocking states behave clearly.

### Accessibility

- focus, contrast, labels, error states, and text alternatives are annotated.

### Handoff

- content mapping exists;
- analytics annotations exist;
- export list exists;
- limitations are documented;
- review checkpoints are defined.

---

## 60. Recommended Next Step

After this specification, the actual Figma prototype should be created.

The recommended sequence is:

```text
Create Figma foundations and components
↓
Build Homepage, Search, Ranking, and Resource Detail
↓
Internal Checkpoint 1
↓
Build Verification, Mainland, and Workflows
↓
Internal Checkpoint 2
↓
Build Creator, Labs, Community, and Admin
↓
Internal Checkpoint 3
↓
Build Mobile Frames and Prototype Links
↓
Design QA
↓
Moderated Usability Testing
```

The next formal documentation deliverable after the prototype is built should be:

# `AI ARK Prototype Review and Usability Test Plan v1.0.md`

It should define:

- participant recruitment;
- moderator script;
- task sequence;
- measurement;
- observation method;
- comprehension questions;
- scoring;
- issue severity;
- evidence synthesis;
- GO / REMEDIATE decision.

---

## 61. Final Build Direction

# Build the prototype as a believable product, not a presentation of abstract features.

The Figma prototype should let a user experience this sequence:

```text
I have a goal
↓
AI ARK helps me find the right Skill
↓
I understand why it ranks well
↓
I understand what was verified
↓
I check whether it works in my environment
↓
I follow a practical workflow
↓
I contribute evidence after use
```

The admin experience should demonstrate the complementary operating model:

```text
AI ARK finds a source
↓
The system extracts and structures it
↓
Evidence is attached
↓
A human resolves uncertainty
↓
Only then is it published
```

That is the product experience the prototype must prove.

---

**End of document**
