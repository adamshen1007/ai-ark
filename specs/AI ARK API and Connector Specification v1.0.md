# AI ARK API and Connector Specification v1.0

**Document status:** Public and internal integration baseline  
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
**Primary audience:** Product, API, backend, platform, security, developer experience, search, workflow, FounderOS, external integration, and operations teams  

---

## 1. Purpose

This specification defines the AI ARK API, connector boundaries, machine-readable contracts, authentication model, access controls, versioning, error handling, rate limits, provenance requirements, and integration principles.

It establishes:

- API product principles;
- public and private endpoint boundaries;
- authentication and authorization;
- Resource discovery;
- Resource retrieval;
- ranking retrieval;
- verification retrieval;
- workflow retrieval;
- task resolution;
- regional availability;
- update feeds;
- pagination and filtering;
- response envelopes;
- provenance and confidence;
- versioning;
- idempotency;
- errors;
- rate limits;
- caching;
- webhooks and polling boundaries;
- AI ARK MCP;
- FounderOS Connector;
- SDK expectations;
- audit;
- security;
- privacy;
- observability;
- acceptance criteria.

The initial API should provide:

> **Discovery and planning only.**

It must not be interpreted as authorization to install, execute, approve, purchase, deploy, or grant permissions to third-party Resources.

---

## 2. Strategic Role

The API is not a secondary export layer.

It is one of the primary product interfaces.

AI ARK should support three first-class access modes:

```text
Humans
  ↓
AI ARK Web

Applications
  ↓
AI ARK API

Agents
  ↓
AI ARK MCP and Connectors
```

All three interfaces should derive from the same governed Capability Evidence Graph.

The API allows AI ARK to progress from:

```text
Website
↓
Discovery service
↓
Capability intelligence infrastructure
```

---

## 3. API Principles

### 3.1 Canonical truth

The API must reflect canonical Resource, version, evidence, ranking, verification, workflow, and availability records.

### 3.2 Stable identity

Every Resource and Workflow should have stable opaque IDs independent of slugs and external URLs.

### 3.3 Version awareness

Responses should identify the ResourceVersion or WorkflowVersion being described.

### 3.4 Provenance by default

Material machine-readable claims should include provenance or a provenance reference.

### 3.5 Confidence by default

Inferred, community-reported, tested, and creator-declared claims must remain distinguishable.

### 3.6 Discovery before execution

The MVP API may recommend installation instructions.

It must not:

- execute commands;
- install packages;
- grant credentials;
- deploy code;
- authorize external actions.

### 3.7 Explicit uncertainty

Unknown and low-confidence states should be returned explicitly rather than omitted or guessed.

### 3.8 Commercial neutrality

Sponsored placement and commercial relationships must not alter organic search or ranking responses.

### 3.9 Regional truth

Regional availability must be returned as a multi-level status.

### 3.10 Least privilege

Every API client should receive only the data and actions required for its role.

### 3.11 Backward compatibility

Breaking changes require a new major API version.

### 3.12 Deterministic read behavior

Identical requests against the same canonical snapshot should return equivalent structured results.

---

## 4. API Domains

The API should be divided into the following domains.

```text
Resources
Search and Discovery
Rankings
Verification
Workflows
Task Resolution
Regional Availability
Creators
Community Evidence
Changes and Updates
Labs
Internal Editorial
Administration
```

MVP public support should prioritize:

```text
Resources
Search
Rankings
Verification
Workflows
Task Resolution
Regional Availability
Changes
Creators
Community summaries
```

Internal editorial and administrative APIs should remain private.

---

## 5. Base URLs

Recommended structure:

```text
Public production:
https://api.aiark.example/v1

Staging:
https://api-staging.aiark.example/v1

Internal production:
https://internal-api.aiark.example/v1
```

The final domain depends on brand clearance.

### 5.1 Environment separation

- production;
- staging;
- local development;
- optional regional deployment.

Production and staging must use separate:

- credentials;
- databases;
- rate limits;
- keys;
- webhook secrets;
- audit streams.

---

## 6. API Versioning

### 6.1 Major version

Use URL versioning:

```text
/v1
/v2
```

Breaking changes require a new major version.

### 6.2 Non-breaking changes

Permitted within a major version:

- adding optional fields;
- adding new enum values when clients are expected to handle unknown values;
- adding new endpoints;
- adding response metadata;
- adding filters.

### 6.3 Breaking changes

Include:

- removing fields;
- renaming fields;
- changing field types;
- changing required fields;
- changing semantic meaning;
- changing pagination behavior;
- changing authentication requirements.

### 6.4 Deprecation

Deprecation process:

```text
Announce
↓
Mark response headers
↓
Provide migration guide
↓
Maintain overlap period
↓
Retire
```

Suggested minimum public overlap:

```text
90 days
```

Longer for enterprise or connector commitments.

---

## 7. Authentication

### 7.1 Public unauthenticated access

May support limited access to:

- public Resource summaries;
- public category rankings;
- public verification reports;
- public workflows;
- public creator profiles.

Unauthenticated access should have lower rate limits.

### 7.2 API keys

Use API keys for:

- external applications;
- approved agents;
- developer access;
- FounderOS Connector;
- server-to-server integrations.

### 7.3 OAuth 2.1

Future use for:

- user-authorized saved workflows;
- creator accounts;
- enterprise clients;
- delegated actions.

### 7.4 Session authentication

Used for first-party web and creator dashboards.

### 7.5 Internal service authentication

Use:

- short-lived service tokens;
- workload identity;
- mutual TLS where appropriate;
- explicit audience restrictions.

### 7.6 Key storage

API secrets must:

- be hashed or securely encrypted;
- never appear in logs;
- support rotation;
- support revocation;
- support scoped permissions;
- have last-used metadata.

---

## 8. Authorization and Scopes

Recommended scopes:

```text
resources:read
search:read
rankings:read
verification:read
workflows:read
task-resolution:read
regional-availability:read
changes:read
creators:read
community:read

saved:write
reviews:write
labs:apply
creator:manage

internal:ingestion
internal:editorial
internal:verification
internal:moderation
internal:admin
```

### 8.1 Scope rules

- API keys should have minimum necessary scopes.
- Creator keys must not receive editorial publication authority.
- Search clients do not need private evidence access.
- FounderOS Connector should begin with read-only discovery scopes.
- Internal administrative scopes must not be issued to external clients.

---

## 9. Response Envelope

Recommended response envelope:

```json
{
  "data": {},
  "meta": {
    "request_id": "req_...",
    "api_version": "v1",
    "generated_at": "2026-08-02T00:00:00Z",
    "canonical_snapshot_at": "2026-08-02T00:00:00Z"
  }
}
```

For lists:

```json
{
  "data": [],
  "meta": {
    "request_id": "req_...",
    "pagination": {},
    "api_version": "v1",
    "generated_at": "2026-08-02T00:00:00Z"
  }
}
```

### 9.1 Request ID

Every response should include:

- body request ID;
- `X-Request-ID` header.

Clients may supply a correlation ID.

---

## 10. Error Envelope

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested Resource does not exist or is not publicly available.",
    "details": {},
    "retryable": false,
    "request_id": "req_..."
  }
}
```

### 10.1 Error principles

- stable machine-readable code;
- useful human-readable message;
- no secret or internal stack exposure;
- explicit retryability;
- field-level validation details where appropriate.

### 10.2 HTTP mapping

```text
200 OK
201 Created
202 Accepted
204 No Content
400 Invalid Request
401 Authentication Required
403 Forbidden
404 Not Found
409 Conflict
412 Precondition Failed
422 Validation Failed
429 Rate Limited
500 Internal Error
502 Upstream Dependency Error
503 Temporarily Unavailable
```

---

## 11. Pagination

### 11.1 Cursor pagination

Preferred:

```text
?limit=20&cursor=...
```

Response:

```json
{
  "pagination": {
    "limit": 20,
    "next_cursor": "cur_...",
    "has_more": true
  }
}
```

### 11.2 Limits

Initial defaults:

```text
Default: 20
Maximum: 100
```

### 11.3 Stable ordering

Cursor pagination requires deterministic ordering.

---

## 12. Filtering

Common filters:

```text
resource_type
category
capability
task
runtime
platform
verification_level
lifecycle
region
regional_status
license
creator
updated_after
evidence_confidence
risk_status
```

### 12.1 Multiple values

Support repeated parameters or comma-separated values under a documented convention.

### 12.2 Unknown values

Return validation errors rather than silently ignoring invalid filters.

---

## 13. Sorting

Supported sort keys may include:

```text
relevance
quality_score
category_rank
momentum
updated_at
published_at
verified_adoption
```

Search relevance should remain default for task queries.

### 13.1 Sponsored separation

Sponsored content must be returned in a separate field or endpoint.

It must not be mixed into organic sorting without an explicit label.

---

# Part I — Resource API

## 14. List Resources

```text
GET /v1/resources
```

Example:

```text
GET /v1/resources?resource_type=SKILL&category=presentation&runtime=codex&limit=20
```

### 14.1 Summary response

```json
{
  "id": "res_...",
  "slug": "example-skill",
  "type": "SKILL",
  "name": "Example Skill",
  "summary": "Creates presentation-ready HTML from structured content.",
  "creator": {},
  "current_version": {},
  "categories": [],
  "capabilities": [],
  "compatibility_summary": [],
  "ranking_summary": {},
  "verification_summary": {},
  "regional_summary": {},
  "freshness": {}
}
```

---

## 15. Retrieve Resource

```text
GET /v1/resources/{resourceId}
```

May accept stable ID or slug under a documented resolver.

### 15.1 Full response groups

```text
identity
creator
current_version
versions
sources
summary
capabilities
tasks
categories
installation
dependencies
permissions
compatibility
ranking
verification
regional_availability
community_summary
alternatives
workflow_relationships
freshness
commercial_disclosures
```

### 15.2 Expand parameter

Example:

```text
GET /v1/resources/res_123?expand=evidence,community,versions
```

Allowed expansions should be limited and rate-aware.

---

## 16. Resource Versions

```text
GET /v1/resources/{resourceId}/versions
GET /v1/resources/{resourceId}/versions/{versionId}
```

Response should include:

- version label;
- source revision;
- release channel;
- release date;
- lifecycle;
- content fingerprint;
- published date;
- verification status;
- compatibility summary.

---

## 17. Resource Evidence

```text
GET /v1/resources/{resourceId}/claims
GET /v1/claims/{claimId}
```

### 17.1 Public claim object

```json
{
  "id": "clm_...",
  "predicate": "compatible_with",
  "value": "Codex",
  "claim_class": "SOURCE_FACT",
  "status": "SUPPORTED",
  "confidence": 0.97,
  "resource_version": "2.3.0",
  "evidence": [
    {
      "type": "SOURCE_TEXT",
      "source": "README.md",
      "locator": "L80-L92",
      "public_url": "..."
    }
  ]
}
```

### 17.2 Private exclusions

Do not return:

- restricted evidence;
- internal notes;
- private files;
- source secrets;
- legal-hold details.

---

# Part II — Search and Discovery API

## 18. Search Resources

```text
POST /v1/search
```

Request:

```json
{
  "query": "Turn a Markdown market report into an investor presentation",
  "filters": {
    "resource_types": ["SKILL"],
    "runtimes": ["Codex"],
    "verification_levels": ["FUNCTIONALLY_TESTED"],
    "region": "mainland_china"
  },
  "sort": "relevance",
  "limit": 20
}
```

### 18.1 Search response

```json
{
  "data": [
    {
      "resource": {},
      "relevance_score": 0.94,
      "relevance_reasons": [
        "Matches presentation generation",
        "Supports Markdown input",
        "Tested with Codex"
      ],
      "confidence": "HIGH"
    }
  ],
  "meta": {
    "query_interpretation": {
      "tasks": ["presentation_generation"],
      "constraints": ["Codex", "mainland_china"]
    }
  }
}
```

### 18.2 Search requirements

- preserve original query;
- expose interpreted task where appropriate;
- return relevance reasons;
- separate low-confidence matches;
- avoid fabricated matches;
- support deterministic filtering.

---

## 19. Discover Resources

```text
POST /v1/discover
```

This endpoint may combine task understanding and Resource search.

Request:

```json
{
  "task": "Review a pull request for security and performance issues",
  "runtime": "Codex",
  "region": "Japan",
  "risk_tolerance": "LOW",
  "verification_requirement": "QUALITY_VERIFIED"
}
```

Response:

- recommended Resources;
- alternatives;
- selection reasons;
- evidence;
- regional status;
- limitations.

---

# Part III — Ranking API

## 20. List Rankings

```text
GET /v1/rankings
GET /v1/rankings/{category}
```

Filters:

```text
lifecycle
ranking_segment
methodology_version
region
runtime
```

### 20.1 Ranking item

```json
{
  "resource_id": "res_...",
  "resource_version": "2.3.0",
  "category": "presentation",
  "rank": 2,
  "quality_score": 88.2,
  "momentum": "RISING",
  "evidence_confidence": "HIGH",
  "risk_status": "LIMITED_REVIEW",
  "methodology_version": "ranking-v1.0",
  "calculated_at": "2026-08-01T00:00:00Z"
}
```

---

## 21. Ranking Explanation

```text
GET /v1/rankings/{category}/resources/{resourceId}
```

Response:

- score components;
- methodology;
- normalization;
- eligibility;
- penalties;
- confidence;
- manual adjustment;
- appeal status;
- data cutoff.

### 21.1 Commercial exclusion

The response may contain:

```json
{
  "commercial_relationship_affects_rank": false
}
```

---

# Part IV — Verification API

## 22. Verification Summary

```text
GET /v1/verification/{resourceId}
```

Response:

- active levels;
- current ResourceVersion;
- status;
- expiry;
- scope;
- limitations;
- report links.

## 23. Verification Record

```text
GET /v1/verification/records/{verificationId}
```

Example:

```json
{
  "id": "vrf_...",
  "resource_id": "res_...",
  "resource_version": "2.3.0",
  "level": "QUALITY_VERIFIED",
  "status": "AWARDED",
  "methodology_version": "quality-v1.0",
  "scope": [],
  "environments": [],
  "evidence_summary": [],
  "findings": [],
  "limitations": [],
  "unresolved_risks": [],
  "awarded_at": "2026-08-01T00:00:00Z",
  "expires_at": "2027-02-01T00:00:00Z"
}
```

---

# Part V — Workflow API

## 24. List Workflows

```text
GET /v1/workflows
```

Filters:

```text
goal
role
runtime
region
workflow_type
verification_status
experience_level
```

---

## 25. Retrieve Workflow

```text
GET /v1/workflows/{workflowId}
```

Response:

- Workflow identity;
- WorkflowVersion;
- goal;
- target user;
- prerequisites;
- cost;
- time;
- region;
- risk;
- steps;
- alternatives;
- evidence;
- verification;
- limitations;
- freshness.

---

## 26. Resolve Task

```text
POST /v1/resolve-task
```

Request:

```json
{
  "goal": "Build and deploy a testable SaaS MVP",
  "user_role": "solo_founder",
  "experience_level": "beginner",
  "runtime_preferences": ["Codex"],
  "region": "mainland_china",
  "budget": {
    "currency": "USD",
    "maximum": 100
  },
  "verification_requirement": "FUNCTIONALLY_TESTED",
  "risk_tolerance": "LOW",
  "open_source_preference": true
}
```

### 26.1 Response requirements

- canonical resolved goal;
- assumptions;
- clarification requirements;
- workflow type;
- confidence;
- regional status;
- ordered steps;
- selected ResourceVersion;
- alternatives;
- expected outputs;
- approvals;
- risks;
- limitations;
- evidence summary.

### 26.2 Execution disclaimer

Machine-readable field:

```json
{
  "execution_authorized": false
}
```

This field should remain false for MVP endpoints.

---

## 27. Workflow Changes

```text
GET /v1/workflows/{workflowId}/changes
```

Response:

- version history;
- changed steps;
- changed Resources;
- verification impact;
- regional impact;
- deprecations.

---

# Part VI — Regional Availability API

## 28. Resource Regional Availability

```text
GET /v1/regional-availability/resources/{resourceId}
```

Optional:

```text
?region=mainland_china
```

Response:

```json
{
  "resource_id": "res_...",
  "resource_version": "2.3.0",
  "region": "mainland_china",
  "information_status": "CONFIRMED",
  "artifact_status": "CONFIRMED",
  "installation_status": "PARTIAL",
  "runtime_status": "UNKNOWN",
  "checked_at": "2026-08-01T00:00:00Z",
  "check_method": "EDITORIAL_REVIEW",
  "limitations": [],
  "alternatives": []
}
```

---

## 29. Workflow Regional Availability

```text
GET /v1/regional-availability/workflows/{workflowId}
```

Response:

- overall workflow status;
- per-step status;
- substitutions;
- unavailable dependencies;
- alternatives.

---

# Part VII — Changes and Updates API

## 30. Change Feed

```text
GET /v1/changes
```

Filters:

```text
since
resource_id
creator_id
change_type
severity
region
```

### 30.1 Change types

```text
RESOURCE_PUBLISHED
RESOURCE_UPDATED
RESOURCE_ARCHIVED
VERSION_RELEASED
RANK_CHANGED
VERIFICATION_AWARDED
VERIFICATION_EXPIRED
VERIFICATION_REVOKED
REGIONAL_STATUS_CHANGED
WORKFLOW_UPDATED
CREATOR_UPDATE
```

### 30.2 Polling

The MVP should support polling.

Webhooks may be introduced later.

### 30.3 Cursor

Change feed should use an ordered cursor.

---

## 31. Resource Change History

```text
GET /v1/resources/{resourceId}/changes
```

Response:

- change type;
- version;
- date;
- materiality;
- public summary;
- affected ranking;
- affected verification;
- affected workflows.

---

# Part VIII — Creator and Community APIs

## 32. Creator API

```text
GET /v1/creators
GET /v1/creators/{creatorId}
GET /v1/creators/{creatorId}/resources
GET /v1/creators/{creatorId}/updates
```

Public output excludes private identity and contact data.

---

## 33. Community Summary

```text
GET /v1/resources/{resourceId}/community-summary
```

Response:

- review count;
- verified-use count;
- weighted score;
- setup-success rate;
- task-success rate;
- would-use-again rate;
- creator-response rate;
- Evidence Confidence.

---

## 34. Public Reviews

```text
GET /v1/resources/{resourceId}/reviews
```

Filters:

```text
resource_version
review_type
runtime
platform
region
verified_only
creator_responded
```

Private evidence must never be returned.

---

# Part IX — AI ARK MCP

## 35. MCP Objective

AI ARK MCP should allow compatible AI agents to query AI ARK through structured tools.

The MCP should expose discovery and planning only.

It must not provide Resource execution.

---

## 36. Proposed MCP Tools

```text
search_resources
get_resource
get_ranking
get_verification
get_workflow
resolve_task
get_regional_availability
get_changes
```

### 36.1 `search_resources`

Inputs:

```json
{
  "query": "presentation generation",
  "runtime": "Codex",
  "region": "mainland_china",
  "limit": 10
}
```

### 36.2 `get_resource`

Inputs:

```json
{
  "resource_id": "res_...",
  "include": ["compatibility", "verification", "regional_availability"]
}
```

### 36.3 `resolve_task`

Inputs mirror the REST endpoint.

### 36.4 MCP outputs

Outputs should be:

- structured;
- compact;
- version-aware;
- provenance-aware;
- explicit about uncertainty;
- explicit that execution is not authorized.

---

## 37. MCP Security

- authenticate MCP clients;
- scope tools;
- rate-limit calls;
- prevent data exfiltration;
- exclude private evidence;
- log tool use;
- return safe structured content;
- avoid embedding untrusted source instructions as executable prompts;
- preserve provenance.

---

## 38. MCP Resource and Prompt Support

Future MCP implementation may expose:

### Resources

- methodology documents;
- public verification reports;
- Resource summaries;
- workflow definitions.

### Prompts

Potential prompt templates:

- compare Resources;
- explain ranking;
- build capability path;
- find Mainland-compatible alternatives.

Prompts must not imply automatic execution.

---

# Part X — FounderOS Connector

## 39. Connector Objective

The FounderOS Connector should allow FounderOS to consume AI ARK capability intelligence without direct database coupling.

Boundary:

```text
FounderOS
↓
AI ARK Connector
↓
AI ARK API
↓
Capability Evidence Graph
```

---

## 40. Connector Principles

### 40.1 Read-only first

Initial Connector capabilities are read-only.

### 40.2 Explicit trust boundary

AI ARK provides discovery evidence.

FounderOS remains responsible for:

- authorization;
- policy;
- execution;
- credentials;
- budgets;
- human approval;
- provider invocation.

### 40.3 No database access

The Connector must not query AI ARK’s internal database.

### 40.4 Stable contracts

The Connector should depend on versioned public or partner API contracts.

### 40.5 Graceful degradation

FounderOS must remain functional if AI ARK is unavailable.

---

## 41. Connector Functions

```text
searchResources()
getResource()
getRanking()
getVerification()
getWorkflow()
resolveTask()
getAlternatives()
checkRegionalAvailability()
listUpdates()
```

### 41.1 `searchResources()`

Returns Resource candidates with:

- version;
- compatibility;
- score;
- confidence;
- risk;
- regional status.

### 41.2 `resolveTask()`

Returns a structured path.

FounderOS may use it as planning evidence.

### 41.3 `listUpdates()`

Allows FounderOS to identify changed Resources used in saved plans or workflows.

---

## 42. Connector Data Contract

Example internal Connector result:

```json
{
  "resource_id": "res_...",
  "resource_version_id": "ver_...",
  "name": "Example Skill",
  "capabilities": [],
  "compatibility": [],
  "ranking": {},
  "verification": {},
  "regional_availability": {},
  "provenance": {},
  "freshness": {},
  "execution_authorized": false
}
```

---

## 43. Connector Caching

FounderOS Connector may cache:

- public Resource summaries;
- ranking;
- verification;
- regional availability;
- workflows.

Cache must preserve:

- fetched time;
- canonical snapshot time;
- expiry;
- ETag or version;
- stale state.

### 43.1 Stale behavior

If AI ARK is unavailable:

- return last known data with `stale=true`;
- avoid presenting stale verification as current;
- do not authorize execution.

---

## 44. Connector Errors

FounderOS Connector should normalize API errors into stable categories:

```text
AI_ARK_UNAVAILABLE
AUTHENTICATION_FAILED
RESOURCE_NOT_FOUND
INSUFFICIENT_EVIDENCE
REGIONAL_STATUS_UNKNOWN
WORKFLOW_NOT_AVAILABLE
RATE_LIMITED
STALE_DATA
INVALID_REQUEST
```

---

# Part XI — Rate Limits and Usage

## 45. Rate Limit Model

Suggested MVP tiers:

### Unauthenticated

```text
60 requests/hour/IP
```

### Registered developer key

```text
1,000 requests/day
```

### Approved integration

```text
Negotiated
```

### FounderOS Connector

```text
Partner-specific
```

These are placeholders requiring load testing.

### 45.1 Headers

```text
RateLimit-Limit
RateLimit-Remaining
RateLimit-Reset
Retry-After
```

### 45.2 Separate expensive limits

Task resolution and semantic search may have lower limits than simple Resource reads.

---

## 46. Quotas

Quota dimensions may include:

- requests;
- semantic searches;
- task resolutions;
- evidence expansions;
- webhook events;
- data export.

The MVP should avoid complex billing enforcement.

---

# Part XII — Caching and Conditional Requests

## 47. ETags

Resource, ranking, verification, workflow, and availability responses should support:

```text
ETag
If-None-Match
```

### 47.1 Last modified

Use:

```text
Last-Modified
If-Modified-Since
```

where meaningful.

### 47.2 Cache control

Public records may support short-lived caching.

Verification and regional availability should not be cached beyond their freshness requirements.

---

## 48. Snapshot Consistency

Clients may request:

```text
?as_of=2026-08-01T00:00:00Z
```

Future feature for enterprise and audit use.

MVP may instead expose:

- canonical snapshot timestamp;
- ResourceVersion;
- methodology version.

---

# Part XIII — Webhooks and Polling

## 49. MVP Decision

Use polling and change feeds first.

Webhooks are deferred until operational maturity.

### 49.1 Future webhook events

```text
resource.updated
resource.archived
ranking.changed
verification.awarded
verification.expired
verification.revoked
regional_availability.changed
workflow.updated
creator.update.published
```

### 49.2 Future webhook security

- signed payloads;
- timestamp;
- replay protection;
- delivery retries;
- dead-letter handling;
- endpoint verification.

---

# Part XIV — Idempotency

## 50. Write endpoints

Any future write endpoint should support:

```text
Idempotency-Key
```

Examples:

- creator claim;
- review submission;
- Labs application;
- saved workflow update.

Task resolution is read-like but may use an idempotency token for billing and tracing.

---

# Part XV — Security

## 51. Threats

- API-key leakage;
- scraping abuse;
- enumeration;
- private-data leakage;
- injection;
- excessive expansion;
- denial of service;
- cache poisoning;
- stale verification;
- false provenance;
- authorization bypass;
- MCP prompt injection;
- malicious client payloads.

---

## 52. Security Controls

- TLS;
- scoped credentials;
- rate limiting;
- input validation;
- output encoding;
- object-level authorization;
- field-level filtering;
- secret redaction;
- audit logs;
- anomaly detection;
- request-size limits;
- expansion limits;
- timeout;
- dependency protection;
- credential rotation;
- security headers.

### 52.1 No source execution

API responses containing install commands or source text must be treated as data.

### 52.2 MCP prompt injection

External Resource content must not become privileged MCP instructions.

---

## 53. Privacy

### 53.1 Public API excludes

- private evidence;
- personal contact details;
- moderation notes;
- tester applications;
- private workflows;
- account history;
- IP addresses;
- device identifiers;
- legal documents.

### 53.2 Regional deployments

Mainland China API deployment requires:

- regional data architecture;
- lawful processing;
- cross-border review;
- regional logging and retention;
- localized compliance review.

---

# Part XVI — Audit and Observability

## 54. Audit Requirements

Audit:

- API key created;
- scope changed;
- key revoked;
- privileged request;
- private evidence access;
- admin endpoint use;
- Connector credential change;
- MCP tool call;
- data export;
- webhook configuration later.

---

## 55. Observability

Track:

- request count;
- latency;
- error rate;
- cache hit;
- authentication failure;
- rate-limit events;
- search quality;
- task-resolution success;
- stale data;
- upstream dependency failure;
- MCP tool usage;
- FounderOS Connector usage.

### 55.1 Tracing

Use correlation across:

```text
client
→ API gateway
→ search/workflow service
→ canonical graph
→ response
```

---

## 56. Service-Level Targets

Validation MVP targets:

```text
Read API availability             99.5%
Read API p95 latency              ≤1 second
Search p95 latency                ≤1.5 seconds
Task resolution p95 latency       ≤10 seconds
Change-feed freshness             ≤15 minutes after publication
Verification status propagation   ≤5 minutes
Regional status propagation       ≤15 minutes
```

These are targets, not contractual commitments.

---

# Part XVII — SDK and Developer Experience

## 57. SDK Priorities

Future official SDKs:

- TypeScript;
- Python.

MVP may begin with:

- OpenAPI specification;
- generated examples;
- curl examples;
- TypeScript reference client.

### 57.1 SDK principles

- typed models;
- error classes;
- retries for safe operations;
- pagination helpers;
- ETag support;
- request IDs;
- explicit stale-data handling.

---

## 58. Developer Documentation

Required:

- getting started;
- authentication;
- endpoint reference;
- schema reference;
- error codes;
- rate limits;
- examples;
- provenance explanation;
- ranking explanation;
- verification explanation;
- MCP setup;
- FounderOS Connector guide;
- changelog;
- deprecation guide.

---

# Part XVIII — Internal APIs

## 59. Internal boundaries

Internal APIs may support:

- ingestion;
- editorial review;
- verification;
- moderation;
- ranking computation;
- publication;
- change detection.

They must not be exposed through the public gateway.

### 59.1 Internal authentication

Use workload identity and strict scopes.

### 59.2 Internal audit

Every consequential internal write should be auditable.

---

# Part XIX — Testing Strategy

## 60. Unit Tests

- authentication;
- scope checks;
- filters;
- pagination;
- sorting;
- error mapping;
- response serialization;
- private-field exclusion;
- ETag behavior;
- idempotency.

## 61. Contract Tests

- OpenAPI schema;
- MCP tool schemas;
- FounderOS Connector;
- ranking responses;
- verification responses;
- workflow responses;
- change feed.

## 62. Integration Tests

```text
canonical graph
→ API
→ search
→ workflow resolution
→ Connector
```

## 63. Security Tests

- broken object authorization;
- key leakage;
- rate-limit bypass;
- expansion abuse;
- injection;
- private evidence leak;
- MCP prompt injection;
- cache poisoning;
- stale verification display.

## 64. Compatibility Tests

- old client against new non-breaking API;
- enum expansion;
- deprecated fields;
- cursor stability;
- retry behavior.

---

# Part XX — MVP Scope

## 65. Include

- `/v1/resources`;
- Resource detail;
- Resource versions;
- search;
- discover;
- rankings;
- ranking explanation;
- verification;
- workflows;
- resolve task;
- regional availability;
- changes;
- creators;
- community summary;
- public reviews;
- API keys;
- rate limits;
- errors;
- ETags;
- OpenAPI;
- basic AI ARK MCP;
- FounderOS Connector contract;
- audit and observability.

## 66. Defer

- paid API plans;
- broad public write API;
- webhooks;
- enterprise tenancy;
- private Resource API;
- execution API;
- installation API;
- credential brokerage;
- marketplace transactions;
- complex bulk export;
- real-time streaming;
- GraphQL;
- end-user OAuth integrations;
- external moderation API;
- autonomous agent actions.

---

# Part XXI — Acceptance Criteria

## 67. Core API

- stable `/v1` namespace exists;
- public Resources can be listed and retrieved;
- every Resource response identifies version and freshness;
- private fields are excluded;
- cursor pagination works;
- filters and sorts are validated;
- errors use stable codes.

## 68. Search

- task queries return structured matches;
- relevance reasons are returned;
- low-confidence matches are marked;
- region and runtime filters work;
- sponsored content remains separate.

## 69. Ranking

- Category Rank, Quality Score, Confidence, Risk, Methodology, and date are returned;
- ranking explanation is available;
- manual adjustments are represented;
- commercial relationships do not affect organic output.

## 70. Verification

- active level, version, scope, limitations, and expiry are returned;
- expired and revoked statuses are visible;
- every badge maps to a record.

## 71. Workflow

- workflows can be retrieved;
- `resolveTask` returns ordered steps;
- selected ResourceVersions and alternatives are present;
- approval points are explicit;
- `execution_authorized` is false.

## 72. Regional Availability

- information, artifact, installation, and runtime statuses are separate;
- check method and date are returned;
- alternatives can be returned.

## 73. Changes

- clients can poll an ordered change feed;
- changed Resource, ranking, verification, workflow, and regional states are represented;
- cursor continuity is tested.

## 74. MCP

- MCP tools return structured data;
- MCP excludes private evidence;
- MCP preserves version and provenance;
- MCP does not execute Resources.

## 75. FounderOS Connector

- Connector can search Resources;
- retrieve Resource, ranking, verification, and workflow;
- resolve a task;
- check regional availability;
- list updates;
- use stale cached data with explicit stale state;
- remain read-only.

## 76. Security

- scoped authentication works;
- unauthorized object access is blocked;
- rate limits work;
- secrets are redacted;
- private data is excluded;
- audit logs exist.

---

# Part XXII — Validation Metrics

The MVP should establish:

- API p95 latency;
- search success rate;
- task-resolution success rate;
- empty-result rate;
- client error rate;
- rate-limit rate;
- API-key adoption;
- MCP usage;
- FounderOS Connector success;
- stale-data rate;
- provenance-field completeness;
- private-field leakage rate of zero;
- schema compatibility failure rate;
- partner satisfaction.

Initial target signals:

- at least 20 successful structured discovery requests;
- at least ten successful `resolveTask` calls;
- at least one working FounderOS Connector prototype;
- at least one working MCP client;
- 100% of Resource responses include version and freshness;
- 100% of ranking responses include methodology and Confidence;
- zero unauthorized private evidence exposure.

---

# Part XXIII — Open Questions

1. Should unauthenticated public API access exist at launch?
2. Should Resource slugs be accepted alongside stable IDs?
3. Which endpoint expansions should be allowed?
4. What is the maximum search result size?
5. Should task resolution be synchronous or asynchronous for complex requests?
6. Should ranking component details require authentication?
7. How should API clients handle unknown enum values?
8. Should regional availability be cached separately by region?
9. What rate limits should FounderOS receive?
10. Should MCP be public during validation or private beta only?
11. Should Connector use REST directly or a dedicated partner endpoint?
12. Which response fields require signed provenance later?
13. Should public clients access historical RankingSnapshots?
14. How long should deprecated API versions remain supported?
15. Should AI-generated paths be persisted automatically?
16. Should `resolveTask` return clarification questions instead of a path when confidence is low?
17. How should API usage contribute to verified adoption?
18. Should external agents be required to identify their runtime and organization?
19. When should webhooks be introduced?
20. Should there be a bulk export for research partners?
21. How should Mainland and global API endpoints synchronize?
22. Should API clients be allowed to request only Resources with no commercial relationship?
23. Should API responses include full installation commands by default?
24. How should public API abuse from large crawlers be managed?
25. What compatibility guarantee should official SDKs provide?

---

## 77. Authorized Next Deliverable

The next document in the AI ARK Product Definition Package is:

# `AI ARK Mainland Availability Specification v1.0.md`

It should define:

- Mainland availability levels;
- rights review;
- source accessibility;
- artifact accessibility;
- installation accessibility;
- runtime verification;
- dependency mapping;
- authorized mirrors;
- creator-provided China editions;
- domestic alternatives;
- regional infrastructure;
- data separation;
- compliance review;
- synchronization;
- monitoring;
- public labels;
- API representation;
- prohibited circumvention methods;
- acceptance criteria.

---

## 78. Final API Direction

# AI ARK should expose governed capability intelligence, not merely catalogue data.

Every machine client should be able to understand:

- what the Resource is;
- which version is current;
- what it can do;
- what evidence supports that;
- how it ranks;
- what AI ARK verified;
- where it works;
- what risks remain;
- what alternatives exist;
- how it fits into a workflow;
- how fresh the information is.

The API succeeds when humans and agents receive the same governed truth through interfaces optimized for their needs.

---

**End of document**
