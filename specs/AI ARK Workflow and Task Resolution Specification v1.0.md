# AI ARK Workflow and Task Resolution Specification v1.0

**Document status:** Workflow intelligence and task-resolution baseline  
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
**Primary audience:** Product, AI, search, workflow, data, API, frontend, backend, editorial, trust and safety, and FounderOS integration teams  

---

## 1. Purpose

This specification defines how AI ARK converts a user or agent objective into a clear, evidence-backed, practical path using one or more AI capabilities.

It establishes:

- user-goal intake;
- Task taxonomy;
- intent resolution;
- task decomposition;
- Resource matching;
- workflow assembly;
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
- human approval points;
- evidence;
- workflow versioning;
- user progress;
- feedback;
- workflow performance;
- agent-facing resolution APIs;
- safety boundaries;
- acceptance criteria.

The workflow system is intended to become AI ARK’s strongest differentiation from conventional directories.

A directory answers:

> What Resources exist?

AI ARK should answer:

> Given this goal, which Resources should be used, in what order, under which constraints, and with what expected output?

---

## 2. Strategic Role

The workflow system transforms AI ARK from a catalogue into a practical capability-intelligence platform.

It should connect:

```text
User Goal
↓
Resolved Intent
↓
Task Decomposition
↓
Capability Requirements
↓
Resource Candidates
↓
Compatibility and Trust Evaluation
↓
Ordered Workflow
↓
Expected Outputs
↓
User or Agent Action
↓
Outcome Evidence
```

This creates value for:

- developers;
- founders;
- operators;
- creators;
- enterprises;
- AI agents;
- FounderOS.

---

## 3. Core Product Promise

# Describe the goal. AI ARK shows the right capability path.

The system should help users understand:

- what needs to happen;
- which step comes first;
- which Resource is recommended;
- why it is recommended;
- which alternatives exist;
- what each step requires;
- what output each step should produce;
- what risks or approvals are involved;
- whether the path works in the user’s region and environment.

---

## 4. Product Principles

### 4.1 Goal before Resource

The user should not need to know the name of a Skill, MCP, Agent, or tool.

### 4.2 Decomposition before recommendation

A complex objective should be broken into understandable tasks before Resources are selected.

### 4.3 Evidence before confidence

Every recommendation should be able to explain why it was made.

### 4.4 Workflow class must be visible

Users must be able to distinguish:

- AI ARK Verified Workflow;
- Curated Workflow;
- AI-Generated Path;
- Creator-Submitted Workflow;
- Community-Submitted Workflow.

### 4.5 Compatibility before convenience

A highly ranked Resource should not be recommended if it is incompatible with the user’s environment.

### 4.6 Regional truth

A globally available Resource should not be recommended as runnable in Mainland China without supporting availability evidence.

### 4.7 Alternatives by default

Critical steps should include alternatives where practical.

### 4.8 Human approval before sensitive action

Workflows should identify steps requiring user approval, credential access, external communication, payment, or destructive operations.

### 4.9 Discovery before execution

The MVP should plan and recommend.

It should not automatically execute third-party Resources.

### 4.10 Versioned and reviewable

Published workflows must bind to specific ResourceVersions and create new versions when materially changed.

### 4.11 Outcome feedback

Workflow quality should improve through observed step completion, failures, and user outcomes.

---

## 5. Workflow Classes

## 5.1 AI ARK Verified Workflow

A workflow that:

- was designed or reviewed by AI ARK;
- has a fixed WorkflowVersion;
- uses fixed ResourceVersions or clearly defined constraints;
- has been tested end to end;
- has evidence for the tested path;
- includes documented environments;
- has known limitations;
- has an expiry or re-review policy.

Public label:

> AI ARK Verified Workflow

---

## 5.2 Curated Workflow

A workflow that:

- was assembled and reviewed by AI ARK;
- has coherent ordered steps;
- uses reviewed Resources;
- has not necessarily been tested end to end;
- includes evidence and limitations.

Public label:

> Curated by AI ARK

---

## 5.3 AI-Generated Path

A workflow assembled dynamically from user constraints and current Resource data.

It must be labelled:

> AI-Generated Path — not tested end to end

The system should explain:

- why each step was selected;
- what evidence exists;
- what remains uncertain;
- which approval points exist.

---

## 5.4 Creator-Submitted Workflow

A workflow submitted by a Creator or Organization.

It may become Curated or Verified after review.

Until then, it should be labelled:

> Creator-submitted workflow

---

## 5.5 Community-Submitted Workflow

A workflow submitted by a user or community member.

It requires editorial review before public publication.

---

## 6. Task Taxonomy

## 6.1 Task definition

A `Task` represents something the user wants accomplished.

Examples:

- research competitors;
- convert a report into a presentation;
- create a product requirements document;
- connect a database to an agent;
- test a web application;
- deploy a service.

## 6.2 Task levels

```text
OUTCOME
WORKFLOW_STAGE
ACTION
MICRO_TASK
```

### Outcome

Broad user objective.

Example:

> Launch a testable SaaS MVP.

### Workflow stage

Major phase.

Example:

> Validate the market.

### Action

Concrete task.

Example:

> Analyze five direct competitors.

### Micro-task

Small operation.

Example:

> Extract pricing pages from competitor websites.

## 6.3 Task hierarchy

Example:

```text
Launch SaaS MVP
├── Validate opportunity
│   ├── Identify customer
│   ├── Research competitors
│   └── Assess willingness to pay
├── Define product
│   ├── Draft PRD
│   └── Define acceptance criteria
├── Design interface
├── Build application
├── Test application
└── Deploy application
```

## 6.4 Task versus capability

A Task is what the user wants done.

A Capability is what a Resource can do.

Example:

```text
Task: Convert a market report into an investor deck
Capability: HTML presentation generation
```

---

## 7. Goal Intake

## 7.1 Human input

The workflow request should support natural language.

Example:

> I want to research an AI opportunity and build a testable MVP using Codex, with low cost, and all required Resources must work in Mainland China.

## 7.2 Structured constraints

Optional user inputs:

- goal;
- role;
- experience;
- preferred runtime;
- operating system;
- region;
- budget;
- time;
- privacy level;
- open-source preference;
- verification requirement;
- risk tolerance;
- available accounts;
- required output format.

## 7.3 Agent input

Machine requests should use structured data.

Example:

```json
{
  "goal": "Build and deploy a testable SaaS MVP",
  "user_role": "solo_founder",
  "experience_level": "beginner",
  "preferred_runtimes": ["Codex"],
  "region": "mainland_china",
  "budget": {
    "currency": "USD",
    "maximum": 100
  },
  "risk_tolerance": "verified_only",
  "open_source_preference": true,
  "time_limit_days": 14
}
```

## 7.4 Clarification policy

The system should ask a clarification only when the missing information materially changes the recommended path.

Examples:

- deployment region;
- preferred agent;
- whether private data is involved;
- whether paid services are acceptable.

The system should avoid excessive questioning.

---

## 8. Intent Resolution

## 8.1 Objective

Convert user language into a canonical goal and constraints.

## 8.2 Intent output

```yaml
resolved_intent:
  canonical_goal_task_id: string
  original_request: string
  user_role: string|null
  experience_level: string|null
  preferred_runtime_ids: string[]
  platform_ids: string[]
  region_id: string|null
  budget_constraint: json|null
  time_constraint: json|null
  privacy_requirement: enum|null
  verification_requirement: enum|null
  risk_tolerance: enum|null
  open_source_preference: boolean|null
  output_requirements: json|null
  confidence: decimal
  unresolved_questions: string[]
```

## 8.3 Intent confidence

```text
HIGH
MEDIUM
LOW
```

Low-confidence resolution should be shown to the user or require clarification.

## 8.4 Ambiguity examples

“Build an agent” may mean:

- design an agent architecture;
- write agent code;
- deploy an agent;
- select an existing agent.

The system should not silently choose when ambiguity materially affects the workflow.

---

## 9. Task Decomposition

## 9.1 Decomposition objective

Break the goal into steps that are:

- necessary;
- ordered;
- independently understandable;
- mapped to capabilities;
- measurable through expected outputs.

## 9.2 Decomposition inputs

- canonical goal;
- user role;
- experience;
- environment;
- region;
- budget;
- time;
- privacy;
- risk tolerance;
- available Resources;
- known workflow templates.

## 9.3 Decomposition output

```yaml
task_plan:
  goal_task_id: string
  steps:
    - sequence:
      task_id:
      objective:
      prerequisites:
      required_capabilities:
      expected_input:
      expected_output:
      approval_required:
      optional:
      conditions:
```

## 9.4 Decomposition rules

- avoid unnecessary steps;
- separate research, execution, and validation;
- identify approval points;
- identify external dependencies;
- identify user-supplied inputs;
- preserve iterative loops when necessary;
- avoid presenting a linear path where branching is essential.

## 9.5 Required step properties

Every step should have:

- objective;
- input;
- output;
- completion condition;
- risk level;
- Resource requirement or “human-only” designation.

---

## 10. Workflow Topology

## 10.1 Linear workflows

Example:

```text
Research
→
Plan
→
Build
→
Test
→
Deploy
```

## 10.2 Branching workflows

Example:

```text
Research
→
Choose approach
   ├── No-code path
   └── Code-first path
```

## 10.3 Conditional workflows

Example:

```text
If repository contains a Skill:
    Use Skill ingestion path
Else:
    Use generic website analysis path
```

## 10.4 Iterative workflows

Example:

```text
Test
→
Fix
→
Retest
→
Approve
```

## 10.5 Parallel workflows

Example:

```text
Market research
and
Technical feasibility
run in parallel
```

## 10.6 MVP topology

The MVP should support:

- linear workflows;
- optional steps;
- simple branches;
- simple loops represented editorially.

Complex runtime workflow engines are deferred.

---

## 11. Capability Requirement Resolution

For each step, the system determines:

- required capability;
- optional capabilities;
- minimum compatibility;
- verification threshold;
- regional requirement;
- cost constraint;
- privacy requirement;
- output format.

Example:

```yaml
capability_requirement:
  step_id: step_03
  required_capability_ids:
    - presentation_generation
  preferred_runtime_ids:
    - codex
  required_region_status:
    - CN_A3_INSTALLATION_ACCESSIBLE
  minimum_verification:
    - FUNCTIONALLY_TESTED
  maximum_setup_difficulty:
    - INTERMEDIATE
  output_format:
    - html_presentation
```

---

## 12. Resource Candidate Selection

## 12.1 Candidate inputs

Candidates are selected from Resources that:

- provide the required Capability;
- fit the Task;
- satisfy runtime constraints;
- satisfy platform constraints;
- satisfy regional constraints;
- satisfy lifecycle constraints;
- satisfy verification and risk constraints.

## 12.2 Candidate scoring

Conceptual formula:

```text
Workflow Fit Score =
Task Relevance
+ Capability Fit
+ Compatibility
+ Quality
+ Evidence Confidence
+ Regional Availability
+ Setup Fit
+ Cost Fit
+ Workflow Evidence
- Risk Penalty
```

## 12.3 Candidate exclusion

Exclude:

- incompatible Resources;
- regionally unavailable Resources when runtime access is required;
- severe unresolved risk;
- archived Resource unless explicitly requested;
- insufficient rights for required delivery;
- Resources that exceed user constraints.

## 12.4 Candidate explanation

Every selected Resource should include reasons.

Example:

> Selected because it is Functionally Tested with Codex, supports Markdown input, and has verified installation evidence in Mainland China.

---

## 13. Primary and Alternative Resources

Each critical WorkflowStep should support:

```text
PRIMARY
ALTERNATIVE
FALLBACK
OPTIONAL
REGIONAL_ALTERNATIVE
```

## 13.1 Primary

Best current fit for the given constraints.

## 13.2 Alternative

Comparable Resource with different strengths.

## 13.3 Fallback

Used when the primary Resource fails or becomes unavailable.

## 13.4 Optional

Improves quality but is not necessary.

## 13.5 Regional alternative

Used when the primary Resource is unavailable in the selected region.

## 13.6 Alternative explanation

Each alternative should explain:

- why it differs;
- when to choose it;
- trade-offs;
- regional or compatibility advantages.

---

## 14. Workflow Step Model

```yaml
workflow_step:
  id: string
  workflow_version_id: string
  sequence_number: integer
  title: string
  objective_task_id: string
  objective_text: string
  instructions: string
  expected_input: json|null
  expected_output: json
  completion_criteria: json
  approval_required: boolean
  approval_type: enum|null
  optional: boolean
  risk_level: enum
  estimated_time: json|null
  estimated_cost: json|null
  regional_note: string|null
  status: enum
```

## 14.1 Approval types

```text
USER_CONFIRMATION
CREDENTIAL_ACCESS
EXTERNAL_COMMUNICATION
PAYMENT
DESTRUCTIVE_ACTION
PUBLISHING
DEPLOYMENT
DATA_EXPORT
LEGAL_REVIEW
SECURITY_REVIEW
```

## 14.2 Risk levels

```text
LOW
MODERATE
HIGH
CRITICAL
UNKNOWN
```

---

## 15. Workflow Step Resource Model

```yaml
workflow_step_resource:
  workflow_step_id: string
  resource_version_id: string
  selection_role: enum
  selection_reason: string
  fit_score: decimal
  evidence_confidence: decimal
  compatibility_requirements: json|null
  regional_requirements: json|null
  cost_estimate: json|null
  setup_estimate: json|null
  limitation_note: string|null
```

---

## 16. Workflow Evidence

## 16.1 Evidence classes

- source evidence;
- Resource ranking evidence;
- verification evidence;
- user review evidence;
- workflow-step test evidence;
- workflow completion evidence;
- creator evidence;
- regional evidence.

## 16.2 Workflow evidence bundle

```yaml
workflow_evidence_bundle:
  workflow_version_id: string
  step_evidence:
    - step_id:
      selected_resource_version_id:
      claim_ids:
      verification_record_ids:
      review_summary_ids:
      test_run_ids:
      regional_availability_ids:
  created_at: datetime
  completeness: enum
```

## 16.3 Completeness states

```text
COMPLETE
SUBSTANTIAL
PARTIAL
WEAK
INSUFFICIENT
```

## 16.4 Verified workflow requirement

AI ARK Verified Workflow requires substantial or complete evidence for all critical steps.

---

## 17. Curated Workflow Creation

## 17.1 Sources

Curated workflows may originate from:

- AI ARK editorial team;
- creator submission;
- community submission;
- FounderOS workflow;
- repeated user search patterns;
- Labs campaign;
- AI-generated draft.

## 17.2 Editorial process

```text
Workflow idea
↓
Goal definition
↓
Task decomposition
↓
Resource selection
↓
Evidence review
↓
Regional review
↓
Risk review
↓
UX composition
↓
Publish as Curated Workflow
```

## 17.3 Publication minimum

A Curated Workflow must have:

- clear goal;
- target user;
- prerequisites;
- ordered steps;
- expected outputs;
- Resource selection reasons;
- alternatives for critical steps where practical;
- compatibility;
- regional notes;
- limitations;
- review date;
- WorkflowVersion.

---

## 18. AI ARK Verified Workflow

## 18.1 Preconditions

- published Curated Workflow;
- fixed WorkflowVersion;
- fixed or constrained ResourceVersions;
- defined environment;
- test plan;
- no unresolved critical risk.

## 18.2 End-to-end test

The workflow should be executed from initial input to final output.

Record:

- environment;
- ResourceVersions;
- inputs;
- outputs;
- duration;
- cost;
- approvals;
- failures;
- alternatives used;
- final result.

## 18.3 Verification outcome

```text
PASS
PARTIAL_PASS
FAIL
INCONCLUSIVE
```

## 18.4 Award criteria

Requires:

- all critical steps completed;
- final output achieved;
- no undisclosed critical failure;
- evidence retained;
- limitations published.

## 18.5 Expiry

Verified workflows should expire when:

- a critical ResourceVersion changes;
- compatibility changes;
- regional availability changes;
- verification expires;
- workflow review period ends.

---

## 19. AI-Generated Path

## 19.1 Purpose

Provide personalized paths beyond the small curated library.

## 19.2 Generation inputs

- resolved goal;
- constraints;
- Task taxonomy;
- Resource graph;
- ranking;
- verification;
- regional availability;
- workflow templates;
- user experience;
- cost and time.

## 19.3 Generation output

- goal summary;
- assumptions;
- ordered steps;
- selected Resources;
- alternatives;
- approval points;
- expected outputs;
- limitations;
- uncertainty;
- evidence summary.

## 19.4 Required label

> AI-Generated Path — assembled from current AI ARK data and not tested end to end.

## 19.5 Generated-path restrictions

The system must not:

- invent Resources;
- ignore incompatibility;
- imply verification;
- hide regional limitations;
- recommend severe-risk Resources;
- automatically execute;
- present legal or security approval as complete.

## 19.6 Confidence

Path confidence should consider:

- intent confidence;
- decomposition confidence;
- Resource fit;
- evidence confidence;
- workflow-template similarity;
- unresolved constraints.

---

## 20. Workflow Versioning

## 20.1 Workflow identity

A Workflow represents one enduring goal and approach.

## 20.2 WorkflowVersion

A new WorkflowVersion is required when:

- step order changes;
- critical Resource changes;
- goal changes materially;
- approval point changes;
- regional path changes;
- risk changes;
- output changes;
- test result changes.

## 20.3 Minor metadata changes

May not require a new version:

- typo;
- non-material wording;
- visual update;
- link correction.

## 20.4 Version fields

```yaml
workflow_version:
  id: string
  workflow_id: string
  version_label: string
  content_fingerprint: string
  methodology_version: string|null
  source_type: enum
  status: enum
  created_at: datetime
  reviewed_at: datetime|null
  published_at: datetime|null
  superseded_at: datetime|null
```

---

## 21. Workflow Lifecycle

```text
IDEA
DRAFT
UNDER_REVIEW
CURATED
PUBLISHED
TESTING
VERIFIED
UPDATE_REQUIRED
DEPRECATED
ARCHIVED
REMOVED
```

## 21.1 Generated path lifecycle

Generated paths may be:

```text
GENERATED
SAVED
USER_MODIFIED
COMPLETED
ABANDONED
EXPIRED
```

## 21.2 Public lifecycle labels

- Curated;
- Verified;
- Generated;
- Update required;
- Archived.

---

## 22. User Progress

## 22.1 Progress tracking

Users may:

- save workflow;
- start workflow;
- mark step in progress;
- mark step complete;
- skip optional step;
- replace Resource;
- report failure;
- attach outcome evidence.

## 22.2 Progress states

```text
NOT_STARTED
IN_PROGRESS
BLOCKED
COMPLETED
SKIPPED
FAILED
```

## 22.3 Privacy

Workflow progress is private by default.

Users may choose to share:

- completion status;
- review;
- outcome evidence;
- public case study.

## 22.4 Progress portability

Future API may allow FounderOS to synchronize workflow state.

---

## 23. Workflow Feedback

## 23.1 Feedback questions

- Was the goal achieved?
- Which steps were completed?
- Which Resource failed?
- Which alternative was used?
- How long did it take?
- What did it cost?
- Which step was unclear?
- Would the user follow this workflow again?

## 23.2 Evidence binding

Feedback may bind to:

- WorkflowVersion;
- WorkflowStep;
- ResourceVersion.

## 23.3 Workflow-specific reviews

A user may review:

- the full workflow;
- one step;
- one Resource inside the workflow.

## 23.4 Workflow quality signals

- completion rate;
- step success;
- alternative-use rate;
- abandonment;
- final-outcome success;
- time accuracy;
- cost accuracy;
- user usefulness rating.

---

## 24. Workflow Ranking

The MVP should not create one universal workflow leaderboard.

Possible ranking views:

- Best Verified Workflows;
- Most Completed;
- Best for Beginners;
- Best for Codex;
- Best for Mainland China;
- New Workflows.

Workflow ranking may consider:

- completion rate;
- final-outcome success;
- evidence confidence;
- Resource quality;
- maintenance;
- regional fit;
- user feedback;
- verification.

---

## 25. Regional Workflow Resolution

## 25.1 Regional requirement

Each step should check:

- information access;
- artifact access;
- installation access;
- runtime verification;
- dependency access.

## 25.2 Regional substitution

If primary Resource is unavailable:

```text
Primary unavailable in region
↓
Select Regional Alternative
↓
Recalculate compatibility, cost, and output
```

## 25.3 Regional workflow status

```text
FULLY_AVAILABLE
PARTIALLY_AVAILABLE
ALTERNATIVES_REQUIRED
NOT_CURRENTLY_FEASIBLE
UNKNOWN
```

## 25.4 Public explanation

Example:

> This workflow is partially available in Mainland China. Step 3 uses a regional alternative because the primary package registry is not reliably accessible.

---

## 26. Cost Estimation

## 26.1 Cost classes

- Resource purchase;
- subscription;
- API usage;
- cloud compute;
- storage;
- model usage;
- external service;
- human review.

## 26.2 Cost representation

```yaml
cost_estimate:
  currency: string
  minimum: decimal|null
  expected: decimal|null
  maximum: decimal|null
  billing_basis: enum
  assumptions: string[]
  updated_at: datetime
```

## 26.3 Public accuracy

Cost must be labelled as:

- Confirmed;
- Estimated;
- Unknown.

## 26.4 Cost constraints

Resource selection should respect user budget where possible.

---

## 27. Time Estimation

## 27.1 Time components

- setup;
- execution;
- review;
- human input;
- deployment;
- waiting time.

## 27.2 Time estimate

```yaml
time_estimate:
  minimum_minutes: integer|null
  expected_minutes: integer|null
  maximum_minutes: integer|null
  assumptions: string[]
  evidence_confidence: enum
```

## 27.3 Feedback loop

Observed completion times should update future estimates after review.

---

## 28. Risk and Approval Model

## 28.1 Risk classes

- data exposure;
- credential access;
- destructive action;
- external communication;
- payment;
- publishing;
- legal or compliance;
- production deployment;
- security-sensitive operation.

## 28.2 Approval behavior

A workflow should visibly pause at approval points.

Example:

```text
Step 5 requires deployment to a public environment.
User approval required before continuing.
```

## 28.3 Agent API

The API should return:

```json
{
  "approval_required": true,
  "approval_type": "DEPLOYMENT",
  "reason": "This step publishes the application to a public endpoint."
}
```

## 28.4 No implicit authorization

AI ARK discovery data must never be interpreted as authorization to execute.

---

## 29. Resource Replacement

## 29.1 User replacement

Users may replace a recommended Resource.

The system should recalculate:

- compatibility;
- expected output;
- cost;
- time;
- risk;
- downstream dependencies.

## 29.2 System replacement

AI ARK may recommend replacement after:

- Resource archived;
- verification expired;
- severe risk;
- regional unavailability;
- better evidence;
- workflow failure.

## 29.3 Replacement history

Saved workflows should record:

- original Resource;
- replacement;
- actor;
- reason;
- date.

---

## 30. Workflow Search and Discovery

Users should be able to browse by:

- goal;
- role;
- runtime;
- category;
- region;
- experience;
- time;
- budget;
- verification.

Examples:

- Workflows for Solo Founders;
- Codex Workflows;
- Mainland China-Compatible Workflows;
- Research Workflows;
- Beginner Workflows.

---

## 31. Workflow Page UX Requirements

The workflow page should show:

```text
Goal
Expected outcome
Target user
Prerequisites
Estimated time
Estimated cost
Region
Risk
Verification status
Visual path
Step details
Alternatives
Evidence
Community outcomes
Save / Start
```

## 31.1 Step display

Each step should show:

- objective;
- input;
- Resource;
- why selected;
- expected output;
- alternative;
- approval requirement;
- regional warning;
- evidence.

## 31.2 Compact view

Allow users to view the workflow as:

- visual path;
- checklist;
- structured table.

---

## 32. Workflow Authoring

## 32.1 Authoring roles

- Editor;
- Workflow Specialist;
- Creator;
- Community Contributor;
- AI Draft Generator.

## 32.2 Authoring interface

Should support:

- goal selection;
- task hierarchy;
- step ordering;
- Resource search;
- alternatives;
- condition branches;
- approval points;
- cost and time;
- evidence;
- preview;
- validation.

## 32.3 Validation warnings

- missing expected output;
- incompatible Resource;
- unavailable region;
- no alternative;
- expired verification;
- severe risk;
- ambiguous step;
- circular dependency;
- unsupported execution claim.

---

## 33. AI-Assisted Workflow Drafting

AI may help:

- decompose goal;
- propose steps;
- identify candidate Resources;
- summarize trade-offs;
- draft expected outputs;
- identify missing constraints.

AI-generated draft must remain:

```text
DRAFT
```

until reviewed.

---

## 34. Workflow Verification Testing

## 34.1 Test plan

A workflow test should include:

- fixed input;
- environment;
- ResourceVersions;
- expected outputs;
- approval points;
- time;
- cost;
- failure handling.

## 34.2 Test evidence

- step logs;
- output artifacts;
- screenshots;
- deployment receipts;
- test notes;
- failure evidence.

## 34.3 Test matrix

A workflow may be tested across:

- runtime;
- operating system;
- region;
- user experience level.

## 34.4 Verification scope

Public report must state exactly which matrix cells were tested.

---

## 35. Workflow Maintenance

## 35.1 Monitoring triggers

- Resource update;
- verification expiry;
- compatibility change;
- regional change;
- source removal;
- user failure cluster;
- cost change;
- workflow-step issue.

## 35.2 Change impact analysis

When a Resource changes, identify:

- affected workflows;
- affected steps;
- replacement candidates;
- verification impact;
- user-saved workflows.

## 35.3 User notification

Users with saved or active workflows may receive:

> Step 4 has changed because the recommended Resource was archived.

---

## 36. Workflow API

## 36.1 Resolve task

```text
POST /v1/resolve-task
```

Request:

```json
{
  "goal": "Build a testable SaaS MVP",
  "user_role": "solo_founder",
  "experience_level": "beginner",
  "runtime_preferences": ["Codex"],
  "region": "mainland_china",
  "budget": {
    "currency": "USD",
    "maximum": 100
  },
  "verification_requirement": "FUNCTIONALLY_TESTED",
  "risk_tolerance": "LOW"
}
```

## 36.2 Response

```json
{
  "resolution_id": "rsl_...",
  "workflow_type": "AI_GENERATED",
  "goal": {
    "task_id": "tsk_...",
    "label": "Build a testable SaaS MVP"
  },
  "assumptions": [],
  "confidence": "MEDIUM",
  "regional_status": "ALTERNATIVES_REQUIRED",
  "steps": [
    {
      "sequence": 1,
      "objective": "Research competitors",
      "resource": {
        "id": "res_...",
        "version": "1.4.0",
        "selection_reason": "Strong task fit and verified Codex compatibility"
      },
      "alternatives": [],
      "expected_output": {
        "type": "competitor_report"
      },
      "approval_required": false,
      "evidence_confidence": "HIGH"
    }
  ],
  "limitations": [],
  "generated_at": "2026-08-02T00:00:00Z"
}
```

## 36.3 Retrieve workflow

```text
GET /v1/workflows/{id}
```

## 36.4 Save progress

Future authenticated API:

```text
POST /v1/workflows/{id}/progress
```

## 36.5 Get workflow changes

```text
GET /v1/workflows/{id}/changes
```

---

## 37. FounderOS Connector

## 37.1 Relationship

```text
FounderOS
↓
AI ARK Connector
↓
Task Resolution API
↓
Capability Evidence Graph
```

## 37.2 Connector functions

```text
resolveTask()
getWorkflow()
getWorkflowStep()
getAlternatives()
checkRegionalAvailability()
getWorkflowChanges()
```

## 37.3 FounderOS governance

FounderOS may use AI ARK data to recommend a path.

FounderOS must independently decide:

- authorization;
- execution;
- credentials;
- budget;
- risk;
- human approval.

AI ARK workflow output is not execution authorization.

---

## 38. Search and Ranking Integration

Workflow resolution should use:

- task relevance;
- Resource Quality Score;
- Evidence Confidence;
- verification;
- compatibility;
- regional availability;
- review outcomes;
- workflow-specific evidence;
- cost;
- time;
- risk.

It should not use:

- sponsorship;
- launch partnership;
- paid placement;

as organic selection inputs.

---

## 39. Community Evidence Integration

Community evidence may update:

- step success probability;
- setup-time estimate;
- failure warnings;
- regional alternatives;
- Resource fit;
- completion-time estimate;
- workflow confidence.

## 39.1 Minimum evidence

Do not change a workflow recommendation based on one unverified opinion alone.

## 39.2 Failure clusters

Repeated failures in the same environment may trigger:

- warning;
- alternative recommendation;
- re-review;
- verification suspension.

---

## 40. Creator Integration

Creators may:

- submit workflows;
- propose updated steps;
- provide test evidence;
- propose alternatives;
- report compatibility changes.

Creators may not:

- guarantee workflow selection;
- buy primary placement;
- suppress alternatives;
- override independent evidence.

Creator-submitted workflows must be labelled.

---

## 41. Security and Safety

### 41.1 Threats

- workflow prompt injection;
- unsafe Resource selection;
- destructive sequence;
- hidden credential requirement;
- regional access circumvention;
- fabricated cost;
- misleading verification;
- recommendation of malicious Resources.

### 41.2 Controls

- no source instruction execution;
- risk gates;
- permission display;
- approval points;
- Resource eligibility;
- evidence validation;
- no automatic execution;
- regional compliance;
- audit.

### 41.3 Sensitive workflows

High-risk workflows may require:

- human review;
- restricted publication;
- stronger verification;
- explicit legal or security approval.

---

## 42. Privacy

Workflow requests may reveal:

- business strategy;
- project details;
- budgets;
- region;
- technical stack;
- company data.

Requirements:

- minimize retention;
- protect private saved workflows;
- separate analytics from content;
- allow deletion;
- exclude private goals from public training or publication unless authorized;
- protect enterprise workflows later.

---

## 43. Observability

Track:

- resolution requests;
- intent confidence;
- clarification rate;
- workflow type;
- candidate count;
- exclusion reasons;
- regional substitutions;
- approval points;
- save rate;
- start rate;
- step completion;
- Resource replacement;
- workflow failure;
- final-outcome success;
- cost and time accuracy.

---

## 44. Workflow Quality Metrics

### Discovery

- workflow open rate;
- workflow save rate;
- step-resource click rate.

### Use

- workflow start rate;
- step completion rate;
- multi-step completion;
- final-goal completion;
- abandonment.

### Quality

- usefulness rating;
- Resource replacement rate;
- alternative-use rate;
- failure rate;
- regional-fit accuracy;
- time-estimate error;
- cost-estimate error.

### Trust

- explanation views;
- verification views;
- user misunderstanding rate;
- approval-point compliance.

---

## 45. Validation Targets

For the validation MVP:

- launch with three to five Curated Workflows;
- at least 60% of test users rate a workflow useful;
- at least 20% open or save two or more step Resources;
- at least ten users complete one meaningful step;
- at least five users complete multiple steps;
- at least one workflow tested end to end;
- fewer than 10% confuse AI-Generated Path with AI ARK Verified Workflow;
- regional status correctly understood by at least 70% of tested users.

---

## 46. Testing Strategy

### Unit tests

- intent parsing;
- task decomposition;
- candidate filtering;
- compatibility exclusion;
- regional substitution;
- approval-point assignment;
- version transitions;
- workflow status.

### Contract tests

- resolve-task API;
- workflow API;
- FounderOS connector;
- ranking integration;
- regional availability;
- review evidence.

### Fixture tests

- simple linear workflow;
- branching workflow;
- Mainland China substitution;
- budget-constrained workflow;
- verified-only workflow;
- no viable Resource;
- archived Resource;
- severe-risk Resource;
- incomplete task request;
- contradictory constraints.

### End-to-end test

```text
submit goal
→ resolve intent
→ decompose tasks
→ select Resources
→ generate path
→ user saves
→ user completes step
→ feedback updates evidence
```

---

## 47. MVP Scope

### Include

- Task taxonomy;
- natural-language goal input;
- structured constraints;
- three to five Curated Workflows;
- one end-to-end workflow test;
- basic AI-Generated Path prototype;
- Resource matching;
- alternatives;
- regional availability;
- cost and time estimates;
- approval points;
- workflow versioning;
- save and share;
- basic progress;
- feedback;
- resolve-task API;
- FounderOS connector contract.

### Defer

- autonomous execution;
- complex workflow engine;
- arbitrary nested branching;
- payment execution;
- credential brokering;
- multi-user workflow collaboration;
- enterprise private workflow governance;
- real-time orchestration;
- automatic workflow verification;
- large workflow marketplace;
- automatic workflow optimization;
- guaranteed cost estimates.

---

## 48. Acceptance Criteria

The Workflow and Task Resolution system is acceptable for MVP when:

### Goal intake

- users can submit natural-language goals;
- structured constraints are supported;
- low-confidence intent can request clarification;
- original request is preserved.

### Decomposition

- every workflow has clear steps;
- each step has objective and expected output;
- critical steps identify approvals;
- unnecessary steps can be removed editorially.

### Resource matching

- selected Resources satisfy capability requirements;
- incompatibility blocks selection;
- severe-risk Resources are excluded;
- regional availability is respected;
- selection reasons are visible;
- alternatives exist for critical steps where practical.

### Workflow classes

- Verified, Curated, Generated, Creator-Submitted, and Community-Submitted remain distinct;
- AI-Generated Paths carry an untested label;
- verified workflows have end-to-end evidence.

### Versioning

- workflows are versioned;
- Resource replacements create new versions when material;
- historical versions remain inspectable;
- change impact is recorded.

### User experience

- users can save and share;
- progress is private by default;
- users can mark steps;
- workflow limitations are visible;
- cost and time estimates show confidence.

### API

- `resolveTask` returns structured steps;
- version, evidence, confidence, region, alternatives, and approvals are present;
- private user data is excluded;
- output never implies execution authorization.

### FounderOS

- connector can resolve a task and retrieve a workflow;
- FounderOS remains responsible for authorization and execution.

---

## 49. Open Questions

1. How detailed should task decomposition be for beginner versus expert users?
2. Should users be able to edit generated steps before saving?
3. What minimum confidence permits an AI-Generated Path to be displayed?
4. Should generated paths be stored by default?
5. Which workflow fields should be public in API responses?
6. How should workflow cost estimates handle usage-based APIs?
7. Should a regional alternative automatically replace the primary Resource?
8. How should user-selected Resources affect workflow confidence?
9. What evidence threshold allows a Curated Workflow to become Verified?
10. How often should verified workflows expire?
11. Should workflow completion contribute to Resource adoption?
12. How should agent-completed steps be verified?
13. What user actions require mandatory confirmation in the web product?
14. Should workflows support multiple final outputs?
15. How should enterprise policies later restrict Resource selection?
16. Should creators be allowed to publish branded workflows?
17. How should workflow SEO pages avoid becoming thin content?
18. When should a workflow be archived rather than updated?
19. How should workflow branches be displayed on mobile?
20. Should AI ARK support private workflow templates during MVP?

---

## 50. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK API and Connector Specification v1.0.md`

It should define:

- API principles;
- authentication;
- public and private endpoints;
- Resource search;
- Resource retrieval;
- rankings;
- verification;
- workflows;
- task resolution;
- regional availability;
- updates;
- pagination;
- filtering;
- rate limits;
- errors;
- versioning;
- provenance;
- confidence;
- webhook or polling boundaries;
- AI ARK MCP;
- FounderOS Connector;
- security;
- audit;
- SDK expectations;
- acceptance criteria.

---

## 51. Final Workflow Direction

# AI ARK should not stop at telling users what exists.

It should help them understand:

- what they are trying to achieve;
- what tasks are required;
- which capabilities fit;
- which Resources are trustworthy;
- which sequence works;
- which alternatives exist;
- which approvals are required;
- which regional constraints apply;
- what output to expect.

The workflow system becomes the bridge between:

```text
Capability Discovery
and
Practical Outcome
```

It is the feature that can make AI ARK more valuable than a directory for both humans and agents.

---

**End of document**
