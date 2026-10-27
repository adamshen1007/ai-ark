# M04 — Evidence Binding and Durable Persistence

## 1. Status and authorization

Status: `FINAL CANDIDATE — PENDING EXACT SHA-256 HUMAN APPROVAL`.

Authorized now:

- preparation of this M04 specification;
- read-only review and spec-only remediation;
- deterministic documentation validation and exact SHA-256 calculation.

Not authorized now:

- M04 implementation or migration execution;
- application-code, package-manifest, lockfile, fixture, or CI changes;
- commit, push, pull request, merge, tag, release, deployment, production-data change, or product publication;
- M05 or later milestone work.

M04 implementation may begin only after the user approves the exact final whole-file SHA-256 of this document and
separately authorizes implementation against those exact bytes. Any substantive change after approval requires a
new hash, a fresh independent review, and renewed human approval.

## 2. Objective

Convert one valid immutable M03 structured-extraction bundle into a durable, append-only, evidence-bound canonical
record. Every material Claim must close over attributable EvidenceItems that resolve through M03 source references
to the immutable M01 snapshot and M02 ResourceVersion identity.

M04 closes the missing persistence boundary left intentionally open by M03. It persists the exact M03 bundle,
Claims, EvidenceItems, claim-to-evidence relationships, conflicts, completeness, and terminal binding result in one
serializable PostgreSQL transaction. It does not generate editorial prose, approve content, or publish anything.

## 3. Stakeholders and observable outcome

- Internal editors and future M05 draft generation receive a stable evidence-bound record instead of an in-memory
  extraction result.
- Technical reviewers can reconstruct every Claim from exact canonical bytes and immutable source lineage.
- Operators can retry identical work without duplicate records and can diagnose stale, colliding, incomplete, or
  failed attempts without inspecting source text or secrets.

M04 is complete when a fresh database can apply migrations `001` through `003`, bind eligible M03 bundles
deterministically, reject or block every invalid lineage/evidence case, survive retry and concurrency tests, and
reconstruct byte-identical canonical records after process restart.

## 4. Normative authority and conflict resolutions

Authority follows `AGENTS.md`. This specification narrows the PRD and broader pipeline/graph specifications to the
Technical Alpha milestone.

The following conflicts are resolved normatively for M04:

1. Broader specifications include editorial, creator, test, community, private, and external evidence. M04 v1
   accepts only evidence projected from one M03 bundle. Other evidence origins are deferred to their owning
   milestones.
2. Broader schemas use prose `statement` or generic subject/predicate/object claims. M04 v1 stores a typed
   field-key plus canonical M03 value. Human-facing prose is an M05 projection and is not canonical M04 truth.
3. Broader claim-status vocabularies differ. M04 v1 uses the closed status mapping in Section 12 and does not add
   publication or review decisions.
4. The PRD says unsupported material claims block approval. Approval belongs to M06. M04 records a fail-closed
   `BLOCKED` M05 handoff whenever material evidence closure is incomplete.
5. M03 source references are not EvidenceItems. M04 creates new EvidenceItem records that retain the complete M03
   reference payload and identity; it never aliases the two entity types.
6. M03 intentionally defined no durable tables. M04 owns migration `003`, the migration ledger/runner, and the
   durable M03-to-M04 transaction boundary.

## 5. Scope

M04 includes:

- strict versioned contracts for requests, records, results, diagnostics, ports, and completeness;
- deterministic validation and canonical serialization of the complete M03 bundle;
- durable immutable storage of accepted M03 bundle bytes;
- deterministic EvidenceItem projection from the exact M03 source-reference registry;
- deterministic Claim projection from all 20 M03 field results;
- explicit claim-to-evidence relationships and conflict preservation;
- material-field completeness calculation and a closed M05 progression decision;
- PostgreSQL migration `003_m04_evidence_binding.sql`;
- a real repository migration runner and validator for migrations `001` through `003`;
- serializable transaction, idempotency, collision, concurrency, restart, and recovery behavior;
- offline fixtures, negative/adversarial tests, PostgreSQL integration tests, and M00–M03 regressions;
- safe operational diagnostics and an M04 implementation report after implementation is authorized.

## 6. Explicit exclusions

M04 does not include:

- prose summaries, Best-for/Not-ideal copy, page drafts, templates, or draft regeneration;
- human editorial commands, authentication, authorization roles, approval, rejection, or publication;
- public pages, directory/search, API/UI, ranking, validation badges, or analytics;
- creator declarations, editor notes, community evidence, runtime-test evidence, external URLs, uploads, images,
  videos, private evidence, retention/deletion workflows, or legal holds;
- execution, checkout, installation, import, interpretation, or runtime verification of acquired repositories;
- live GitHub or AI calls in required gates;
- modifications to M00–M03 canonical contracts or migrations `001` and `002`;
- production deployment or migration execution against a shared/production database;
- M05+ packages, placeholders, or speculative abstractions.

## 7. Required package and dependency shape

When separately authorized, implementation shall use this exact shape:

- `packages/contracts/src/m04.ts`: M04 schemas, literals, and inferred types.
- `packages/evidence/`: deterministic evidence/claim projection, completeness, orchestration, and inward-owned
  persistence port. It may depend only on `@ai-ark/contracts`.
- `packages/job-queue/`: PostgreSQL implementation of the M04 persistence port and migration ownership. It may add
  a dependency on `@ai-ark/evidence`; it must not place M04 domain decisions in SQL adapter code.
- `packages/testing/`: deterministic fixtures and PostgreSQL integration/recovery tests. It may depend on
  `@ai-ark/evidence`.
- `scripts/check-dependency-boundaries.mjs`: register `@ai-ark/evidence` and the two new permitted edges.
- `scripts/db-migrate.mjs` and `scripts/db-validate.mjs`: real local/CI migration entry points replacing the current
  scoped unavailable messages for `db:migrate` and `db:validate`.

No new production dependency is permitted unless the implementation cannot satisfy an approved contract using
Node, Zod, `pg`, and existing workspace utilities. Any necessary dependency requires a spec amendment.

## 8. Normative language, canonical bytes, and limits

`MUST`, `MUST NOT`, `SHALL`, and `SHALL NOT` are requirements. `SHOULD` is a default that requires a recorded
reason to vary.

All M04 content IDs use lowercase SHA-256 hex over UTF-8 canonical JSON serialized with
`canonicalJsonM03`. Object keys use unsigned UTF-8 byte order, arrays retain specified order, numbers are finite
integers or exact JSON decimals defined by the schema, and no undefined/non-JSON value is permitted.

Every hashed object retains its exact canonical preimage until byte equality is checked. A matching hash with
non-byte-equal preimages is `CONTENT_HASH_COLLISION` and fails before idempotency, join, replay, or persistence.

M04 adds no smaller aggregate bound than the frozen M03 schema. Every schema-valid M03 bundle must remain bindable.
The durable bundle is therefore stored as ordered fixed-size chunks rather than one PostgreSQL `bytea` value.
Closed M04 projection limits inherited from M03 are:

| Surface                                 |                                                                           Maximum |
| --------------------------------------- | --------------------------------------------------------------------------------: |
| Raw M04 request bytes                   |                                                                     262,144 bytes |
| M03 bundle canonical bytes              | every byte accepted by `StructuredExtractionBundleV1Schema`; no extra M04 ceiling |
| Durable bundle chunk                    |                                   1 MiB except the final chunk; ordinals `0..n-1` |
| EvidenceItems per binding               |                                                                             4,096 |
| Claims per binding                      |                                                                                20 |
| Claim-evidence links                    |                                                                            81,920 |
| Conflicts per binding                   |                                                                             1,024 |
| Diagnostics per result                  |                                                                                 1 |
| Stored internal excerpt Unicode scalars |                                                                             2,000 |
| Idempotency key UTF-8 bytes             |                                                                               200 |

The link maximum is the frozen worst case of 20 fields times 4,096 evidence IDs. The M03 schema's own one-over
inputs fail before M04. M04 maximum-bound fixtures must exercise every legal maximum independently and a combined
maximum projection, then prove lossless chunk reconstruction. No partial truncation is permitted.

## 9. Input and eligibility contract

```ts
type EvidenceBindingRequestV1 = {
  schemaVersion: "M04_EVIDENCE_BINDING_REQUEST_V1";
  idempotencyKey: string;
  extractionId: `ext_${string}`;
  expectedM03OutputFingerprint: Sha256;
  expectedResourceIdentityId: string;
  expectedResourceVersionIdentityId: string;
  expectedSourceSnapshotId: string;
  expectedSourceRevision: GitSha40;
  expectedPredecessorState: ExpectedPredecessorStateV1;
  evidencePolicyVersion: "m04-evidence-policy-v1";
  materialFieldRegistryVersion: "m04-material-fields-v1";
};
```

The application entry point is `bindEvidence(rawRequestBytes: Uint8Array, bundle: unknown)`. After strict request
parsing, the bundle must be a trusted-process value returned by M03, not repository content or a provider response.
The application validates it again with `StructuredExtractionBundleV1Schema`, recomputes its fingerprints, and
compares every expected identity. Malformed request handling is the pre-domain arm in Section 16. An already
accepted exact replay follows Section 18 and is not re-adjudicated against later mutable state. Eligibility for a
new binding requires:

1. `schemaVersion === "M03_EXTRACTION_V1"` and `m04Bindability === "BINDABLE"`;
2. byte-valid canonical M03 payload accepted without an additional M04 aggregate-size restriction;
3. request identities and complete `expectedPredecessorState` equal the bundle's M02 identities, source lineage,
   and predecessor expectations byte-for-byte;
4. referenced M01 snapshot, M02 Resource identity, ResourceVersion identity, observation, source link, and handoff
   rows still exist and match the bundle's immutable IDs/fingerprints;
5. the complete frozen M03 predecessor state and every active/controller predicate pass the exact Section 9.1
   revalidation;
6. all M03 internal registry and cross-reference validation passes;
7. no prior accepted payload exists under the same content ID with different bytes.

Eligibility rejection or processing failure is returned but not persisted. It must not persist the request,
rejected M03 payload, Claims, EvidenceItems, excerpts, or provider errors. A later retry re-evaluates current state
from its supplied bytes and may return a different truthful terminal arm. Durable idempotency/replay applies only
after an accepted binding exists.

### 9.1 Complete predecessor freshness

M04 imports without modification the complete M03 `ExpectedPredecessorStateV1` and `m02InputProjection` defined in
M03 Sections 7.2 and 15. It re-reads and compares all eleven mutable record versions:

- acquisition job;
- controlling M02 job;
- handoff marker;
- candidate;
- Resource identity;
- ResourceVersion identity;
- Resource source link;
- source repository identity;
- identity decision;
- candidate review state; and
- candidate root.

It also recomputes and compares all six immutable/set fingerprints: source snapshot, acquisition result,
ResourceVersion observation, ownership topology, review-state set, and provider metadata. The canonical projections,
set membership, sorting, nullability, and fingerprint formulas are exactly M03 Section 7.2; M04 must reuse the M03
contract/reader authority rather than create a partial projection.

For a new binding, inside the serializable transaction M04 re-evaluates every M03 eligibility row 3 through 16,
including completed and noncancelled acquisition, controlling M02 job, active handoff, `IDENTITY_RESOLVED`
candidate, unique clear review state, Resource identity `ACTIVE`, ResourceVersion identity `IDENTITY_RESOLVED`,
exact observation tuple, active source link, controlling identity decision, source revision, and complete topology.
Any mismatch is `PREDECESSOR_NOT_CURRENT`; no M04 canonical row is written. Accepted replay resolution occurs first
and does not depend on these mutable predicates.

## 10. Durable M03 bundle record

```ts
type DurableExtractionBundleV1 = {
  schemaVersion: "M04_DURABLE_EXTRACTION_BUNDLE_V1";
  extractionId: string;
  resourceIdentityId: string;
  resourceVersionIdentityId: string;
  sourceSnapshotId: string;
  sourceRevision: GitSha40;
  m03OutputFingerprint: Sha256;
  logicalPayloadSha256: Sha256;
  canonicalPayloadSha256: Sha256;
  canonicalPayloadByteLength: number;
  canonicalPayloadChunkCount: number;
  recordVersion: "1";
};
```

The exact validated UTF-8 canonical JSON of the M03 bundle is split into consecutive 1 MiB byte chunks; only the
last chunk may be shorter. The database never uses `jsonb` as bundle authority. Every read requires all ordinals,
reconstructs the exact bytes, and verifies byte length, payload SHA-256, M03 schema, logical identity projection,
output fingerprint, and lineage. The row and chunks are immutable; a later logical extraction creates a new row.

`M03LogicalBundleProjectionV1` is the complete validated M03 bundle excluding exactly `createdAt`,
`analysisAttempts[*].durationMsOrNull`, `analysisAttempts[*].tokenCountsOrNull`, and
`analysisAttempts[*].providerRequestIdOrNull`. It retains `outputFingerprint`. `logicalPayloadSha256` hashes that
canonical projection. Two envelopes with the same extraction ID are the same logical bundle only when this complete
projection is byte-equal. Differences only in the four excluded telemetry surfaces are permitted replay metadata,
not collisions; M04 retains the first accepted full envelope and returns the stored result without writing the
later envelope. Any other byte difference under the same extraction ID, output fingerprint, or logical fingerprint
is `CONTENT_HASH_COLLISION`.

## 11. EvidenceItem contract and projection

```ts
type EvidenceItemV1 = {
  schemaVersion: "M04_EVIDENCE_ITEM_V1";
  id: `evi_${string}`;
  extractionId: string;
  m03SourceReferenceId: string;
  sourceSnapshotId: string;
  sourceRevision: GitSha40;
  evidenceType:
    | "SOURCE_TEXT"
    | "MANIFEST_FIELD"
    | "REPOSITORY_METADATA"
    | "RELEASE_METADATA"
    | "FILE_STRUCTURE"
    | "INVENTORY_ABSENCE";
  locatorOrNull: DocumentLocatorV1 | SnapshotMetadataLocatorV1 | null;
  sourceEntryIdOrNull: string | null;
  sourceDocumentIdOrNull: string | null;
  contentFingerprint: Sha256;
  excerptState: "RETAINED_INTERNAL" | "OMITTED" | "NOT_APPLICABLE";
  excerptOrNull: string | null;
  visibility: "INTERNAL_EVIDENCE";
  displayAuthorization: "NOT_GRANTED";
  recordFingerprint: Sha256;
};
```

Projection is one-to-one from the M03 `sourceReferences` registry. Every reference becomes exactly one
EvidenceItem, including references used only for routing, ambiguity, or absence. Mapping is total:

| M03 reference                                                                 | Evidence type         | Excerpt state                                       |
| ----------------------------------------------------------------------------- | --------------------- | --------------------------------------------------- |
| ordinary `DOCUMENT` with `JSON_POINTER` or `DATA_POINTER`                     | `MANIFEST_FIELD`      | excerpt present=`RETAINED_INTERNAL`; null=`OMITTED` |
| sensitive `DOCUMENT` whose `originalType` is `JSON_POINTER` or `DATA_POINTER` | `MANIFEST_FIELD`      | `OMITTED`                                           |
| ordinary `DOCUMENT` with `TREE_PATH` or `FILE_METADATA`                       | `FILE_STRUCTURE`      | `NOT_APPLICABLE`                                    |
| sensitive `DOCUMENT` whose `originalType` is `TREE_PATH` or `FILE_METADATA`   | `FILE_STRUCTURE`      | `OMITTED`                                           |
| other ordinary `DOCUMENT` reference                                           | `SOURCE_TEXT`         | excerpt present=`RETAINED_INTERNAL`; null=`OMITTED` |
| other `SENSITIVE_LOCATOR` reference                                           | `SOURCE_TEXT`         | `OMITTED`                                           |
| `SNAPSHOT_METADATA` repository field                                          | `REPOSITORY_METADATA` | `NOT_APPLICABLE`                                    |
| `SNAPSHOT_METADATA` release field                                             | `RELEASE_METADATA`    | `NOT_APPLICABLE`                                    |
| `SNAPSHOT_METADATA` snapshot/license/fork field                               | `REPOSITORY_METADATA` | `NOT_APPLICABLE`                                    |
| `INVENTORY_ABSENCE`                                                           | `INVENTORY_ABSENCE`   | `NOT_APPLICABLE`; `locatorOrNull` is null           |

Every EvidenceItem copies `sourceRevision` from the owning validated M03 bundle. A `DOCUMENT` reference requires
both source IDs from that reference; every other reference requires both source IDs to be null. These cross-field
rules are part of the strict contract schema.

`id = "evi_" + sha256(canonicalJsonM03(record without id and recordFingerprint))` and
`recordFingerprint = sha256(canonicalJsonM03(record without recordFingerprint))`.

`OMITTED` is intentionally coarse: M03 does not always retain whether a null excerpt was sensitive, empty, or
unavailable. M04 must not infer a narrower reason. EvidenceItem canonical bytes contain no wall-clock timestamp.
Database insertion time is operational metadata outside the canonical payload and is never used in an ID or record
fingerprint.

M04 must preserve the complete typed locator and M03 content hash. It must not dereference mutable URLs, reread a
working tree, infer source text, expand an omitted excerpt, or copy secret/contact preimages. EvidenceItem
visibility is fixed to `INTERNAL_EVIDENCE`, and display authorization is fixed to `NOT_GRANTED`. A public source or
retained excerpt is not public-use authority. Only a later authorized editorial/publication milestone may decide
whether an excerpt can be displayed.

## 12. Claim contract and exact M03 mapping

```ts
type ClaimV1 = {
  schemaVersion: "M04_CLAIM_V1";
  id: `clm_${string}`;
  extractionId: string;
  resourceIdentityId: string;
  resourceVersionIdentityId: string;
  fieldKey: M03FieldKey;
  value: ExtractionFieldResultV1["value"];
  claimClass: Exclude<ExtractionFieldResultV1["claimClass"], "NO_CLAIM">;
  status: "SUPPORTED" | "SUPPORTED_WITH_QUALIFIER" | "AMBIGUOUS" | "REVIEW_REQUIRED";
  confidenceOrNull: number | null;
  deterministicCandidateIds: string[];
  aiProposalIds: string[];
  conflictIds: string[];
  warningCodes: M03WarningCode[];
  recordFingerprint: Sha256;
};
```

Exactly one Claim is created for each M03 field with `claimClass !== "NO_CLAIM"`. No Claim is created for a
`MISSING` or `UNSUPPORTED` field. Claim value and ordered IDs are copied byte-for-byte from the validated field
result; M04 performs no semantic normalization.

| M03 field status                              | M04 Claim status           | Evidence-link relationship |
| --------------------------------------------- | -------------------------- | -------------------------- |
| `EXPLICIT`                                    | `SUPPORTED`                | `SUPPORTS`                 |
| `STRONGLY_SUPPORTED`                          | `SUPPORTED`                | `SUPPORTS`                 |
| `INFERRED`                                    | `SUPPORTED_WITH_QUALIFIER` | `QUALIFIES`                |
| `CONFLICTING`                                 | `AMBIGUOUS`                | `CONTEXT_ONLY`             |
| `REVIEW_REQUIRED` with a non-`NO_CLAIM` class | `REVIEW_REQUIRED`          | `QUALIFIES`                |
| `MISSING`, `UNSUPPORTED`, or `NO_CLAIM`       | no Claim                   | no link                    |

`id = "clm_" + sha256(canonicalJsonM03(record without id and recordFingerprint))`. The fingerprint formula is
the same as EvidenceItem. Claims are immutable proposals. No M04 status means approved, publishable, tested, or
creator-authorized.

## 13. Claim-evidence relationship

```ts
type ClaimEvidenceLinkV1 = {
  schemaVersion: "M04_CLAIM_EVIDENCE_LINK_V1";
  id: `cel_${string}`;
  claimId: string;
  evidenceItemId: string;
  m03SourceReferenceId: string;
  relationship: "SUPPORTS" | "QUALIFIES" | "CONTEXT_ONLY";
  ordinal: number;
  recordFingerprint: Sha256;
};
```

For each Claim, the ordered M03 field `evidenceIds` must resolve to exactly one EvidenceItem each. Links preserve
that registry order. Missing, duplicate, dangling, cross-extraction, or extra links fail the entire binding.
Candidate, AI-proposal, conflict, and field reference unions must remain closed: every referenced source ID exists,
and every Claim link is authorized by its source M03 field. Evidence existence alone never authorizes a Claim.

## 14. Conflict preservation

All M03 conflicts remain inside the durable bundle and are also referenced by the owning ambiguous Claim.
For every `AMBIGUOUS` Claim:

- `conflictIds` is nonempty;
- each conflict targets the same field;
- every conflict candidate/proposal and source reference resolves within the same M03 bundle;
- the Claim's EvidenceItems equal the field's complete evidence union;
- no preferred value, support winner, confidence, or silent resolution is added.

M04 creates no Claim for an unsupported alternative outside the M03 field result and never collapses conflicts.

## 15. Material-field registry and completeness

The exact ordered material registry is:

```ts
const M04_MATERIAL_REQUIREMENTS_V1 = [
  ["identity", ["canonical_skill_name"]],
  ["attribution", ["creator_candidates", "organization_candidates"]],
  ["version", ["version"]],
  ["license", ["license"]],
  ["purpose", ["outcome_candidate"]],
  ["capabilities", ["capabilities"]],
  ["installation", ["installation"]],
  ["dependencies", ["dependencies"]],
  ["permissions", ["permissions"]],
  ["compatibility", ["compatibility"]],
  ["limitations", ["limitations"]],
] as const;
```

An ordinary single-field requirement is covered only when it has a Claim with status `SUPPORTED` or
`SUPPORTED_WITH_QUALIFIER`, at least one valid ClaimEvidenceLink, and no unresolved conflict. Attribution is covered
when either creator or organization satisfies the same rule. `AMBIGUOUS`, `REVIEW_REQUIRED`, absent, missing, or
unsupported requirements are blocking gaps.

```ts
type EvidenceCompletenessV1 = {
  schemaVersion: "M04_EVIDENCE_COMPLETENESS_V1";
  id: `cmp_${string}`;
  registryVersion: "m04-material-fields-v1";
  totalRequirements: 11;
  coveredRequirements: number;
  coverageBasisPoints: number;
  requirements: Array<{
    key: string;
    status: "COVERED" | "MISSING" | "UNSUPPORTED" | "AMBIGUOUS" | "REVIEW_REQUIRED";
    claimIds: string[];
    evidenceItemIds: string[];
  }>;
  unresolvedConflictIds: string[];
  blockingRequirementKeys: string[];
  m05Progression: "ELIGIBLE" | "BLOCKED";
  recordFingerprint: Sha256;
};
```

`coverageBasisPoints = floor(coveredRequirements * 10000 / 11)`. M05 progression is `ELIGIBLE` only at 10,000
basis points with empty conflict and blocker arrays. This is a pipeline handoff result, not editorial approval.

## 16. Binding result and diagnostics

```ts
type EvidenceBindingResultV1 =
  | {
      kind: "MALFORMED";
      rawRequestSha256: Sha256;
      error: "RAW_REQUEST_TOO_LARGE" | "REQUEST_JSON_INVALID" | "REQUEST_SCHEMA_INVALID";
      diagnostics: SafePreDomainDiagnosticV1[];
    }
  | {
      kind: "ACCEPTED";
      resultId: `m4r_${string}`;
      bindingId: string;
      extractionId: string;
      completeness: EvidenceCompletenessV1;
      replayed: boolean;
      resultFingerprint: Sha256;
    }
  | {
      kind: "REJECTED";
      resultId: `m4r_${string}`;
      requestFingerprint: Sha256;
      error: EligibilityErrorV1;
      diagnostics: SafeDiagnosticV1[];
      resultFingerprint: Sha256;
    }
  | {
      kind: "FAILED";
      resultId: `m4r_${string}`;
      requestFingerprint: Sha256;
      error: ProcessingErrorV1;
      diagnostics: SafeDiagnosticV1[];
      resultFingerprint: Sha256;
    };
```

Closed eligibility errors:

- `IDEMPOTENCY_KEY_REUSED`
- `BINDING_REQUEST_MISMATCH`
- `M03_BUNDLE_SCHEMA_INVALID`
- `M03_NOT_BINDABLE`
- `LINEAGE_MISMATCH`
- `PREDECESSOR_NOT_CURRENT`
- `DANGLING_REFERENCE`
- `EVIDENCE_CLOSURE_INVALID`
- `BOUND_EXCEEDED`
- `CONTENT_HASH_COLLISION`

Closed processing errors:

- `SERIALIZATION_FAILED`
- `SERIALIZATION_RETRY_EXHAUSTED`
- `PERSISTENCE_UNAVAILABLE`
- `PERSISTENCE_INTEGRITY_FAILED`

The diagnostic contracts are exact:

```ts
type SafePreDomainDiagnosticV1 = {
  code: "RAW_REQUEST_TOO_LARGE" | "REQUEST_JSON_INVALID" | "REQUEST_SCHEMA_INVALID";
  fieldOrNull: "ROOT" | keyof EvidenceBindingRequestV1;
  observedByteLengthOrNull: number | null;
  limitOrNull: number | null;
};

type SafeDiagnosticV1 = {
  code:
    | "SCHEMA_INVALID"
    | "EXPECTED_ACTUAL_MISMATCH"
    | "PREDECESSOR_STALE"
    | "REFERENCE_INVALID"
    | "CLOSURE_INVALID"
    | "BOUND_EXCEEDED"
    | "HASH_COLLISION"
    | "REQUEST_MISMATCH"
    | "SERIALIZATION_EXHAUSTED"
    | "PERSISTENCE_FAILURE";
  stage: "BUNDLE" | "ELIGIBILITY" | "PROJECTION" | "PERSISTENCE";
  subjectKind:
    | "BUNDLE"
    | "REQUEST_ASSOCIATION"
    | "EXTRACTION"
    | "PREDECESSOR"
    | "EVIDENCE"
    | "CLAIM"
    | "LINK"
    | "COMPLETENESS"
    | "BINDING_RESULT"
    | "MIGRATION"
    | "DATABASE";
  subjectIdOrNull: string | null;
  expectedFingerprintOrNull: Sha256 | null;
  actualFingerprintOrNull: Sha256 | null;
  observedCountOrNull: number | null;
  limitOrNull: number | null;
};
```

For `RAW_REQUEST_TOO_LARGE`, both byte-length fields are required and `fieldOrNull` is `"ROOT"`; the other
pre-domain codes set both byte-length fields to null and identify only a closed request field or `"ROOT"`.
`EXPECTED_ACTUAL_MISMATCH`, `PREDECESSOR_STALE`, `HASH_COLLISION`, and `REQUEST_MISMATCH` require both fingerprint
fields; `BOUND_EXCEEDED` requires both count fields; reference and closure codes require `subjectIdOrNull`; all
fields not required by these rules are null. Contract schemas enforce these cross-field rules strictly.

Every `MALFORMED`, `REJECTED`, or `FAILED` result contains exactly one diagnostic; `ACCEPTED` contains none. Thus
ordering, deduplication, and overflow are not implementation choices. The diagnostic is constructed by this
exhaustive table:

| Terminal error                  | Exact diagnostic construction                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RAW_REQUEST_TOO_LARGE`         | pre-domain `RAW_REQUEST_TOO_LARGE`, `ROOT`, observed raw byte length, limit `262144`                                                                                 |
| `REQUEST_JSON_INVALID`          | pre-domain `REQUEST_JSON_INVALID`, `ROOT`, both numeric fields null                                                                                                  |
| `REQUEST_SCHEMA_INVALID`        | pre-domain `REQUEST_SCHEMA_INVALID`; `ROOT` for a non-object, otherwise first invalid/missing declared field, otherwise `ROOT` for unknown keys; numeric fields null |
| `IDEMPOTENCY_KEY_REUSED`        | `REQUEST_MISMATCH`, `ELIGIBILITY`, `EXTRACTION`, request extraction ID, stored and supplied request fingerprints                                                     |
| `BINDING_REQUEST_MISMATCH`      | `REQUEST_MISMATCH`, `ELIGIBILITY`, `EXTRACTION`, request extraction ID, stored and supplied semantic-request fingerprints                                            |
| `M03_BUNDLE_SCHEMA_INVALID`     | `SCHEMA_INVALID`, `BUNDLE`, `EXTRACTION`, null optional fields                                                                                                       |
| `M03_NOT_BINDABLE`              | `SCHEMA_INVALID`, `ELIGIBILITY`, `EXTRACTION`, extraction ID, remaining optional fields null                                                                         |
| `LINEAGE_MISMATCH`              | `EXPECTED_ACTUAL_MISMATCH`, `ELIGIBILITY`, `PREDECESSOR`, first mismatching request field name, fingerprints of expected and actual canonical field values           |
| `PREDECESSOR_NOT_CURRENT`       | `PREDECESSOR_STALE`, `ELIGIBILITY`, `PREDECESSOR`, first stale Section 9.1 row ID or closed set-guard ID, fingerprints of expected and actual canonical projections  |
| `DANGLING_REFERENCE`            | `REFERENCE_INVALID`, `PROJECTION`, owning subject kind and first invalid reference ID, remaining optional fields null                                                |
| `EVIDENCE_CLOSURE_INVALID`      | `CLOSURE_INVALID`, `PROJECTION`, owning subject kind and first invalid Claim/link/evidence ID, remaining optional fields null                                        |
| `BOUND_EXCEEDED`                | `BOUND_EXCEEDED`, `PROJECTION`, owning subject kind and opaque ID or null, observed count and Section 8 limit                                                        |
| `CONTENT_HASH_COLLISION`        | `HASH_COLLISION`, stage and subject kind of first colliding record, opaque ID or null, equal claimed SHA-256 in both fingerprint fields                              |
| `SERIALIZATION_FAILED`          | `PERSISTENCE_FAILURE`, `PERSISTENCE`, `DATABASE`, null optional fields                                                                                               |
| `SERIALIZATION_RETRY_EXHAUSTED` | `SERIALIZATION_EXHAUSTED`, `PERSISTENCE`, `DATABASE`, null optional fields                                                                                           |
| `PERSISTENCE_UNAVAILABLE`       | `PERSISTENCE_FAILURE`, `PERSISTENCE`, `DATABASE`, null optional fields                                                                                               |
| `PERSISTENCE_INTEGRITY_FAILED`  | `PERSISTENCE_FAILURE`, `PERSISTENCE`, first failing record subject kind and opaque ID or null, remaining optional fields null                                        |

“First” is deterministic: request fields use their declaration order; predecessor rows/sets use Section 9.1
order; M03 references, fields, claims, and links use their canonical registry/ordinal order; record kinds use
bundle, request association, EvidenceItem, Claim, link, completeness, binding result; ties use unsigned UTF-8 byte
order of opaque IDs with null first. Those record kinds map respectively to `BUNDLE`, `REQUEST_ASSOCIATION`,
`EVIDENCE`, `CLAIM`, `LINK`, `COMPLETENESS`, and `BINDING_RESULT`. The closed set-guard IDs are
`m04_guard:ownership_topology`,
`m04_guard:review_state_set`, and `m04_guard:provider_metadata`, corresponding to the three non-row fingerprints in
Section 9.1. `fingerprint(value)` means SHA-256 of its canonical JSON. A missing actual predecessor uses
`fingerprint({schemaVersion:"M04_MISSING_VALUE_V1"})`; no missing value is inferred. This table and priority order
are normative, and byte-exact fixtures cover every row.

Wall-clock timestamps are operational database metadata outside canonical result bytes. Diagnostics must not
contain source excerpts, exact commands, locators with sensitive preimages, M03 payload bytes, prompts/responses,
credentials, personal contact data, SQL text, connection strings, or unrestricted database errors.

### 16.1 Complete derived-identity formulas

The entry point accepts bounded raw request bytes plus the untrusted `unknown` bundle value. It rejects a request
over 262,144 bytes before JSON parsing, and rejects invalid JSON before schema parsing. Malformed request bytes
return `MALFORMED` with only `sha256(raw bytes)` and the applicable closed pre-domain diagnostics; they have no
request ID, request fingerprint, idempotency association, database write, or bundle access. Only a successfully
parsed strict `EvidenceBindingRequestV1` enters the formulas below.

The following formulas are exhaustive. `canonical(X)` means `canonicalJsonM03(X)` and every lookup compares the
retained canonical preimage bytes before accepting hash equality.

```text
requestPayload = canonical(complete EvidenceBindingRequestV1)
requestFingerprint = sha256(requestPayload)
semanticRequestPayload = canonical(complete EvidenceBindingRequestV1 excluding {idempotencyKey})
semanticRequestFingerprint = sha256(semanticRequestPayload)
requestRecordId = "m4q_" + sha256(canonical {
  schemaVersion:"M04_REQUEST_RECORD_ID_V1", requestFingerprint
})

evidenceItemId = "evi_" + sha256(canonical(complete EvidenceItemV1 excluding
  {id, recordFingerprint}))
evidenceItemRecordFingerprint = sha256(canonical(complete EvidenceItemV1 excluding
  {recordFingerprint}))

claimId = "clm_" + sha256(canonical(complete ClaimV1 excluding {id, recordFingerprint}))
claimRecordFingerprint = sha256(canonical(complete ClaimV1 excluding {recordFingerprint}))

linkId = "cel_" + sha256(canonical(complete ClaimEvidenceLinkV1 excluding
  {id, recordFingerprint}))
linkRecordFingerprint = sha256(canonical(complete ClaimEvidenceLinkV1 excluding
  {recordFingerprint}))

completenessId = "cmp_" + sha256(canonical(complete EvidenceCompletenessV1 excluding
  {id, recordFingerprint}))
completenessRecordFingerprint = sha256(canonical(complete EvidenceCompletenessV1 excluding
  {recordFingerprint}))

bindingId = "bnd_" + sha256(canonical {
  schemaVersion:"M04_BINDING_ID_V1", extractionId, logicalPayloadSha256,
  evidencePolicyVersion, materialFieldRegistryVersion,
  evidenceItemIds: unsignedUtf8Sort(all evidence IDs),
  claimIds: M03 field-registry order,
  linkIds: claim order then ordinal,
  completenessId
})

acceptedResultCore = {kind:"ACCEPTED", bindingId, extractionId, completenessId}
rejectedResultCore = {kind:"REJECTED", requestFingerprint, error, diagnostics}
failedResultCore = {kind:"FAILED", requestFingerprint, error, diagnostics}
resultId = "m4r_" + sha256(canonical(complete selected result core))
resultFingerprint = sha256(canonical {schemaVersion:"M04_RESULT_V1", resultId,
  ...complete selected result core})
```

Add `id` to `ClaimEvidenceLinkV1` and `EvidenceCompletenessV1` with the prefixes above. No formula includes a wall
clock, database sequence, retry ordinal, or insertion timestamp. `replayed` is response-only transport metadata,
is not stored in the canonical result, and is excluded from `resultId`/`resultFingerprint`. First execution returns
the stored canonical result plus `replayed: false`; exact replay returns the same canonical result plus
`replayed: true`.

## 17. Durable PostgreSQL schema

Migration `003_m04_evidence_binding.sql` shall create these tables:

1. `schema_migrations(version text primary key, filename text not null unique, sha256 text not null,
applied_at timestamptz not null)`. Migration `003` creates the empty ledger; the runner is its sole writer.
2. `m03_extraction_bundles(extraction_id text primary key, resource_identity_id text not null references
resource_identities(id), resource_version_identity_id text not null references resource_version_identities(id),
source_snapshot_id text not null references source_snapshots(id), source_revision text not null,
m03_output_fingerprint text not null unique, logical_payload_sha256 text not null unique,
canonical_payload_sha256 text not null unique, canonical_payload_byte_length bigint not null,
canonical_payload_chunk_count integer not null, persisted_at timestamptz not null,
record_version bigint not null default 1 check(record_version = 1),
unique (extraction_id, resource_version_identity_id, resource_identity_id),
unique (extraction_id, source_snapshot_id, source_revision), foreign key
(resource_version_identity_id, resource_identity_id) references
resource_version_identities(id, resource_identity_id) on delete restrict, foreign key
(source_snapshot_id, source_revision) references source_snapshots(id, immutable_revision) on delete restrict)`.
3. `m03_extraction_bundle_chunks(extraction_id text not null references m03_extraction_bundles,
chunk_ordinal integer not null, chunk_bytes bytea not null, chunk_sha256 text not null,
primary key(extraction_id, chunk_ordinal))`; constraint triggers require contiguous ordinals, exactly the parent
   count/length, 1 MiB nonfinal chunks, a nonempty final chunk, and exact reconstructed parent SHA-256.
4. `m04_binding_requests(id text primary key, idempotency_key text not null unique, request_fingerprint text not null
unique, semantic_request_fingerprint text not null, request_payload_sha256 text not null,
request_payload_byte_length integer not null, request_canonical_payload bytea not null, binding_id text not null,
result_id text not null, created_at timestamptz not null, record_version bigint not null default 1
check(record_version = 1))`. Only accepted request associations are stored. A non-unique index on
   `semantic_request_fingerprint` is mandatory; replay lookup reparses the retained request bytes, derives the semantic
   payload, and requires byte equality before trusting the indexed hash.
5. `m04_evidence_items(id text primary key, extraction_id text not null references m03_extraction_bundles,
m03_source_reference_id text not null, source_snapshot_id text not null references source_snapshots,
source_revision text not null, source_entry_id text, source_document_id text, evidence_type text not null,
canonical_payload bytea not null, record_fingerprint text not null unique, created_at timestamptz not null,
unique(extraction_id, m03_source_reference_id), foreign key (source_snapshot_id, source_revision) references
source_snapshots(id, immutable_revision) on delete restrict, foreign key (source_entry_id, source_snapshot_id)
references m01_source_entries(id, source_snapshot_id) on delete restrict, foreign key
(source_document_id, source_entry_id, source_snapshot_id) references
m01_source_documents(id, source_entry_id, source_snapshot_id) on delete restrict, foreign key
(extraction_id, source_snapshot_id, source_revision) references
m03_extraction_bundles(extraction_id, source_snapshot_id, source_revision) on delete restrict,
check ((evidence_type in ('SOURCE_TEXT','MANIFEST_FIELD','FILE_STRUCTURE')) =
(source_entry_id is not null and source_document_id is not null)))`.
6. `m04_claims(id text primary key, extraction_id text not null references m03_extraction_bundles,
resource_identity_id text not null references resource_identities, resource_version_identity_id text not null
references resource_version_identities, field_key text not null, status text not null, claim_class text not null,
canonical_payload bytea not null, record_fingerprint text not null unique, created_at timestamptz not null,
unique(extraction_id, field_key), foreign key (resource_version_identity_id, resource_identity_id) references
resource_version_identities(id, resource_identity_id) on delete restrict, foreign key
(extraction_id, resource_version_identity_id, resource_identity_id) references
m03_extraction_bundles(extraction_id, resource_version_identity_id, resource_identity_id) on delete restrict)`.
7. `m04_claim_evidence_links(id text primary key, claim_id text not null references m04_claims, evidence_item_id
text not null references m04_evidence_items, ordinal integer not null, relationship text not null,
record_fingerprint text not null unique, unique(claim_id, evidence_item_id), unique(claim_id, ordinal))`.
8. `m04_completeness_snapshots(id text primary key, extraction_id text not null unique references
m03_extraction_bundles, canonical_payload bytea not null, coverage_basis_points integer not null,
m05_progression text not null, record_fingerprint text not null unique, created_at timestamptz not null)`.
9. `m04_binding_results(id text primary key, kind text not null check(kind = 'ACCEPTED'), binding_id text not null
unique, extraction_id text not null unique references m03_extraction_bundles, canonical_payload bytea not null,
result_fingerprint text not null unique, created_at timestamptz not null)`.

The migration must add exact enum-equivalent `CHECK` constraints, SHA/ID format checks, positive bounds, payload
length checks, foreign keys, uniqueness, and same-extraction enforcement. Cross-table invariants that PostgreSQL
cannot express as simple checks must use narrowly scoped constraint triggers. Generic JSONB must not hide canonical
identity, relationships, statuses, or fingerprints. Before commit, constraint triggers parse every canonical
payload and require exact equality between all duplicated payload fields and relational columns, including IDs,
snapshot/revision, source entry/document, Resource/ResourceVersion, field/status/class, relationship/ordinal,
coverage/progression, and all fingerprints. Bundle closure reconstructs the M03 bytes and applies the same equality
checks to its parent columns. A valid scalar column cannot mask a different canonical-payload value.

Before creating the EvidenceItem foreign key, migration `003` adds the restrictive target uniqueness constraint
`m01_source_documents(id, source_entry_id, source_snapshot_id)`. This does not mutate predecessor rows or migration
`002`; it makes the already-authoritative document/entry/snapshot tuple available as an explicit composite target.

Every M04 table rejects `UPDATE` and `DELETE` through database triggers. Corrections create a new
extraction/binding and later supersession support, never overwrite canonical bytes. M04 v1 does not expose a
supersession command.

After request/result tables exist, deferred foreign keys bind every request association's `result_id` and
`binding_id` to the one accepted result. Constraint triggers verify byte hashes, canonical IDs/fingerprints,
same-extraction relationships, and the accepted-result closure at transaction commit. The migration ledger is
append-only and rejects update/delete.

Migration `003` also closes the inherited immutable-lineage enforcement gap by adding reject-`UPDATE`/`DELETE`
triggers to `source_snapshots`, `acquisition_results`, `m01_source_entries`, `m01_source_documents`, and
`resource_version_observations`. These are the fingerprinted M01/M02 records M03 treats as immutable. Mutable
controller/state tables retain their governed record-version transitions and are revalidated under Section 9.1;
their state at binding remains captured in the durable M03 bytes. `db:validate` and direct-write integration tests
must prove every listed immutable predecessor table rejects mutation and deletion without changing migrations
`001` or `002`.

## 18. Transaction, idempotency, concurrency, and replay

The persistence adapter executes at PostgreSQL `SERIALIZABLE` isolation:

1. parse and canonicalize the request before opening a transaction;
2. retain and collision-check exact request bytes, full M03 envelope bytes, and the logical M03 projection bytes;
3. acquire transaction-scoped advisory locks in unsigned UTF-8 order for ResourceVersion ID, extraction ID, and
   idempotency key;
4. look up the idempotency key before reading mutable predecessor state. If it exists, compare the exact stored
   request bytes: different bytes return `REJECTED/IDEMPOTENCY_KEY_REUSED` immediately; exact request bytes plus a
   byte-equal M03 logical projection return the stored canonical result with response-only `replayed: true` and
   write nothing. A different logical projection is `CONTENT_HASH_COLLISION`;
5. for a new key, look up accepted associations by `semanticRequestFingerprint`, rederive semantic payload bytes
   from each retained request preimage, and compare bytes. A byte-equal semantic request plus a byte-equal M03
   logical projection inserts only the new immutable `m04_binding_requests` association to the existing
   binding/result, then returns that result with `replayed: true`. This replay path does not read or revalidate
   mutable predecessor state;
6. if the extraction ID already has an accepted binding but no exact replay matched, return
   `REJECTED/BINDING_REQUEST_MISMATCH`; no freshness check or write occurs;
7. only when no accepted binding or replay exists, read and verify the complete M01/M02 predecessor state inside
   the transaction as Section 9.1 requires;
8. reject any hash-equal/non-byte-equal request, logical projection, canonical record, or stored envelope as
   `CONTENT_HASH_COLLISION`; full M03 envelopes may differ only on the four Section 10 excluded telemetry surfaces;
9. for a new semantic binding, insert the accepted request association, durable M03 bundle/chunks, EvidenceItems,
   Claims, links, completeness, and accepted result;
10. verify database round-trip bytes and full closure before commit;
11. commit once; no accepted partial state may be visible.

Serialization failure retries the complete transaction at most three times with deterministic attempt ordinals
0, 1, and 2. A fourth execution is prohibited. Non-serialization database errors are not retried automatically.
Concurrent same-key requests converge on one accepted request association, one binding, and one byte-identical
canonical result. Concurrent new-key/same-semantic requests may create one association per distinct key but no
duplicate canonical binding records. Different request preimages for the same idempotency key, or different logical
M03 projections for the same extraction ID, cannot both commit. After restart the adapter reloads exact stored
accepted request and logical/full M03 preimages before any replay decision. Rejected/failed attempts have no
durable replay state and are re-evaluated from supplied bytes.

## 19. Migration runner and validation boundary

`pnpm db:migrate` shall:

- require an explicit non-production PostgreSQL URL from the repository's validated test/local configuration;
- refuse unknown environment labels and any host not explicitly allowlisted by local test configuration;
- discover only numeric `.sql` files under `packages/job-queue/migrations`;
- verify exact filename order, expected file hashes, and ledger consistency;
- acquire a database advisory lock, apply each pending migration once in its own transaction, and record its hash;
- fail closed on edits to an applied migration, gaps, duplicates, dirty transactions, or partial application;
- never print connection credentials.

The frozen predecessor migration hashes are normative:

- `001_m01_acquisition_jobs.sql`:
  `4896d8240d81bcdacc8763c0ba4e09cc12ce17983519acb798612d29b4434958`;
- `002_m02_classification_identity.sql`:
  `310c6761eb9ac94bcdac03e395a3abbe27a711a6570ffc0839b44b8300563c64`.

Bootstrap is exact. Without `schema_migrations`, the runner classifies the database as exactly one of: blank;
schema-exact `001` prefix; schema-exact `001+002` prefix; or invalid. It rejects the invalid case, including extra
or partially applied objects. From blank it applies `001`; from the exact `001` prefix it resumes with `002`; from
the exact `001+002` prefix it resumes with `003`. Each file remains one transaction, so interruption always leaves
one of the three recognized states. Migration `003` creates an empty ledger and does not insert ledger rows; before
the `003` transaction commits, the runner, as sole ledger writer, inserts rows for `001`, `002`, and `003` using the
verified on-disk hashes. Once the ledger exists, every run verifies all applied filename/hash pairs before applying
a pending migration. Tests inject interruption after `001`, during `002`, after `002`, during `003`, and before
ledger commit, and prove automatic safe resumption from every committed exact prefix.

`pnpm db:validate` is read-only. It shall verify the ledger, migration hashes, tables, columns, constraints, indexes,
triggers, foreign keys, and immutable-write protections for migrations `001` through `003`. It must return nonzero
for drift. Neither command may target production in M04.

## 20. Recovery and rollback

Before merge readiness, tests must prove:

- a forced failure after each insertion stage rolls back every M04 canonical row;
- process restart followed by the same request returns the stored byte-identical canonical result, with only
  response-only `replayed` changing to `true`, and creates no duplicate rows;
- serialization conflicts converge within the three-attempt limit or return the closed exhausted error;
- a failed migration leaves no ledger entry or partial object;
- a second migration run is a no-op and an edited applied migration is rejected;
- a database dump/restore of M01–M04 tables preserves all canonical bytea hashes and closure checks.

Because migrations are forward-only, rollback before publication means revert application code and discard the
ephemeral test database. After any shared migration is ever authorized, applied, correction requires a new reviewed
forward migration; `003` is never edited or down-migrated. Production execution is outside M04.

## 21. Security and evidence-integrity invariants

1. Acquired source remains inert data and can never become system, tool, SQL, shell, or migration instructions.
2. Only validated M03 records can cross the M04 boundary; raw repository bytes are not an M04 input.
3. Prompt-injection text may persist only as a bounded internal excerpt already admitted by M03. Admission is not
   display/public-use authority. The text is never executed, interpolated into prompts, or treated as authority.
4. Secrets, credential-shaped text, personal contact data, and sensitive locator preimages remain withheld. M04
   stores only the M03 safe locator/hash representation.
5. No Claim can cite an EvidenceItem from another extraction, ResourceVersion, or source snapshot.
6. No EvidenceItem or Claim can exist without its durable M03 bundle and immutable M01/M02 lineage.
7. Every stored canonical payload is hash-checked before insert and after read; database JSON coercion is not
   authoritative.
8. AI-derived Claims retain `AI_INFERENCE` or `MIXED_SUPPORT`; M04 never upgrades their class or confidence.
9. Evidence does not approve itself. M04 creates no authenticated-human, reviewed, approved, or published state.
10. Logs, errors, metrics, test fixtures, and reports contain no secrets, personal data, full source documents,
    exact withheld commands, raw prompts/responses, or database credentials.
11. Required tests are offline after dependency installation and use only synthetic public fixture data.
12. All failure states remain explicit; no exception becomes an empty evidence set, zero score, or pass.

## 22. Observability

Allowed events contain binding/request/result fingerprints, opaque record IDs, stage, retry ordinal, counts,
coverage basis points, closed status/error codes, and durations. Metrics may count accepted/replayed/rejected/failed
bindings, completeness states, collision rejections, serialization retries, migration drift, and rollback tests.

Forbidden observability includes payloads, excerpts, commands, locators, repository content, AI content, SQL,
connection strings, credentials, contact data, or unrestricted provider/database errors. Observability has no Claim,
EvidenceItem, review, or publication authority.

## 23. Required fixture and adversarial matrix

At minimum, fixtures must cover:

| Area            | Required cases                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Happy path      | all 11 material requirements covered; deterministic-only and mixed deterministic/AI bundles                                                                                                                                                             |
| Incomplete      | each requirement independently missing, unsupported, ambiguous, and review-required                                                                                                                                                                     |
| Attribution     | creator only, organization only, both, neither, conflicting                                                                                                                                                                                             |
| Reference kinds | retained excerpt, sensitive locator, snapshot metadata, release metadata, inventory absence                                                                                                                                                             |
| Closure         | dangling, extra, duplicate, cross-extraction, wrong-field, wrong-snapshot, wrong-ResourceVersion links                                                                                                                                                  |
| Integrity       | every parent/child fingerprint mismatch and byte-distinct forced hash collision; scalar/canonical mismatch; wrong snapshot/revision, ResourceVersion/Resource, source-entry/snapshot, source-document/entry/snapshot, and binding-parent tuple          |
| Limits          | exact-at-limit and one-over for every Section 8 ceiling                                                                                                                                                                                                 |
| Idempotency     | malformed raw request; same key/same bytes after predecessor transition; new key/same semantic bytes after predecessor transition; same key/different bytes; existing binding/different request; rejected retry/re-evaluation; concurrent exact repeats |
| Staleness       | superseded/rejected M02 identity, changed predecessor version/fingerprint, missing snapshot                                                                                                                                                             |
| Transactions    | injected failure after every insert stage, serialization retry/exhaustion, restart replay                                                                                                                                                               |
| Migration       | blank apply; exact `001`/`001+002` prefix resume; interruption at every boundary; second no-op; edited hash; missing/duplicate order; schema drift                                                                                                      |
| Security        | prompt injection in excerpt, credential/contact preimages, malicious locator, SQL/shell text                                                                                                                                                            |
| Regression      | M00 canonical ordering, M01 immutable acquisition, M02 identity, complete M03 suite                                                                                                                                                                     |

Fixtures must be deterministic, reviewable, synthetic, public, and contain no provider-shaped live credentials or
real personal data.

## 24. Test responsibilities

| Layer       | Required responsibility                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Contract    | strict schemas, closed enums, canonical formulas, total M03 mapping, invalid cross-field arms        |
| Unit        | projection, status mapping, evidence closure, completeness, ordering, limits, redaction preservation |
| Fixture     | byte-exact IDs/fingerprints and all matrix rows in Section 23                                        |
| Adversarial | injection, forgery, collision, cross-lineage evidence, secret/contact leakage, unsafe execution      |
| Integration | real PostgreSQL migration, serializable transaction, constraints/triggers, restart, recovery         |
| Regression  | all existing M00–M03 behavior plus full repository suite                                             |

No empty or filtered-out suite is feature evidence. Every negative governance/security invariant requires a direct
test proving rejection occurs before an unauthorized row or log is produced.

## 25. Acceptance criteria and traceability

| ID        | Requirement                                                                                                                                                                                                               | Primary evidence            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| M04-AC-01 | Only a schema-valid, bindable, current M03 bundle is eligible                                                                                                                                                             | contract + integration      |
| M04-AC-02 | All eleven mutable versions, six immutable/set fingerprints, and M03 controller predicates are retained and revalidated in-transaction                                                                                    | integration                 |
| M04-AC-03 | Every valid M03 canonical payload is losslessly chunked, durably stored, reconstructed, and verified after restart                                                                                                        | integration + recovery      |
| M04-AC-04 | Every M03 source reference maps to exactly one EvidenceItem                                                                                                                                                               | contract + fixture          |
| M04-AC-05 | EvidenceItem IDs and fingerprints are deterministic and collision-checked by preimage bytes                                                                                                                               | unit + adversarial          |
| M04-AC-06 | Sensitive/contact data remains withheld across records, logs, diagnostics, and reports                                                                                                                                    | adversarial                 |
| M04-AC-07 | Each eligible M03 field maps to exactly one immutable Claim with no semantic rewrite                                                                                                                                      | contract + fixture          |
| M04-AC-08 | Missing/unsupported/`NO_CLAIM` fields create no Claim and remain explicit completeness gaps                                                                                                                               | fixture                     |
| M04-AC-09 | Claim class, status, confidence, warnings, candidates, proposals, and conflicts preserve M03 meaning                                                                                                                      | contract                    |
| M04-AC-10 | Every Claim link resolves to same-extraction evidence authorized by the owning M03 field                                                                                                                                  | adversarial + integration   |
| M04-AC-11 | Missing, duplicate, dangling, extra, wrong-field, and cross-lineage evidence fails atomically                                                                                                                             | adversarial                 |
| M04-AC-12 | Conflicts remain complete, visible, and unresolved                                                                                                                                                                        | fixture + contract          |
| M04-AC-13 | Completeness uses the exact 11-row registry and integer basis-point formula                                                                                                                                               | unit + fixture              |
| M04-AC-14 | Any material missing/unsupported/ambiguous/review state blocks M05 progression                                                                                                                                            | fixture                     |
| M04-AC-15 | Only 100% closed material coverage is `ELIGIBLE`; eligibility is not approval                                                                                                                                             | contract                    |
| M04-AC-16 | Same-key replay writes nothing; new-key/same-semantic replay adds only one request association; both resolve before predecessor freshness and neither duplicates canonical binding records                                | integration                 |
| M04-AC-17 | Same-hash/different-byte is collision; same-key/different-request is `IDEMPOTENCY_KEY_REUSED` before replay                                                                                                               | adversarial                 |
| M04-AC-18 | Concurrent identical requests converge and conflicting requests cannot both commit                                                                                                                                        | integration                 |
| M04-AC-19 | All canonical writes commit atomically at Serializable isolation                                                                                                                                                          | integration + recovery      |
| M04-AC-20 | Serialization retries are limited to three complete attempts                                                                                                                                                              | integration                 |
| M04-AC-21 | Migration `003` is forward-only and migrations `001`/`002` remain byte-unchanged                                                                                                                                          | hash + Git diff             |
| M04-AC-22 | `db:migrate` resumes every exact committed prefix, applies ordered hashed migrations once, and never exposes credentials                                                                                                  | integration                 |
| M04-AC-23 | `db:validate` detects ledger, schema, constraint, trigger, index, and hash drift                                                                                                                                          | integration                 |
| M04-AC-24 | Failed migration/application stages leave no partial M04 canonical state                                                                                                                                                  | recovery                    |
| M04-AC-25 | Dump/restore preserves canonical payload hashes and reference closure                                                                                                                                                     | recovery                    |
| M04-AC-26 | Database composite keys and canonical-payload equality reject M04 mutation/deletion, every mismatched lineage/identity tuple, invalid direct writes, and mutation/deletion of all listed immutable M01/M02 lineage tables | integration                 |
| M04-AC-27 | Prompt-injection fixture text remains inert data and cannot affect behavior                                                                                                                                               | adversarial                 |
| M04-AC-28 | Bounds pass exactly at limit and fail atomically one over                                                                                                                                                                 | unit + adversarial          |
| M04-AC-29 | Every terminal error produces its one exact byte-stable diagnostic containing only the closed allowlist                                                                                                                   | contract + adversarial      |
| M04-AC-30 | AI proposals remain attributable proposals without review/publication authority                                                                                                                                           | contract + fixture          |
| M04-AC-31 | No acquired repository content is executed, installed, imported, or used as instructions                                                                                                                                  | source-safety + adversarial |
| M04-AC-32 | M00–M03 authority documents, contracts, and behavior remain unchanged                                                                                                                                                     | hashes + regression         |
| M04-AC-33 | Required gates pass under pinned runtime with no live credentials                                                                                                                                                         | complete verification       |
| M04-AC-34 | M04 creates no draft, approval, publication, UI, search, validation, or M05+ behavior                                                                                                                                     | whole-diff review           |
| M04-AC-35 | Malformed raw request bytes return only a pre-domain digest/diagnostic arm and perform no bundle access or database write                                                                                                 | contract + adversarial      |
| M04-AC-36 | Rejected/failed valid requests persist no replay state and are truthfully re-evaluated on retry                                                                                                                           | integration + adversarial   |

## 26. Implementation sequence when separately authorized

1. Reconfirm exact approved M04 spec SHA-256 and separate implementation authorization.
2. Inventory Git state, instructions, runtime, package graph, migrations, and frozen M00–M03 hashes.
3. Add M04 contracts and red contract tests.
4. Add `@ai-ark/evidence` deterministic projection/completeness behavior and unit/fixture tests.
5. Add migration `003`, migration ledger/runner/validator, and PostgreSQL adapter.
6. Add transaction, idempotency, collision, concurrency, restart, and recovery tests.
7. Add adversarial evidence-integrity, injection, source-safety, and privacy tests.
8. Run targeted gates, migration/recovery gates, full regressions, and whole-diff security review.
9. Perform a separate independent whole-patch review over the exact candidate.
10. Create `docs/milestones/M04_REPORT.md` only after evidence exists.

This sequence grants no implementation authority now.

## 27. Required implementation verification

When and only when implementation is separately authorized, run with Node `22.23.1`, pnpm `11.7.0`, and the
frozen lockfile:

```bash
pnpm test:unit -- evidence
pnpm test:contract -- evidence
pnpm test:fixtures -- evidence
pnpm test:adversarial -- evidence
pnpm test:integration -- evidence
pnpm db:migrate
pnpm db:validate
pnpm test:unit -- acquisition classification identity extraction
pnpm test:contract -- acquisition classification identity extraction
pnpm test:fixtures -- acquisition classification identity extraction
pnpm test:adversarial -- acquisition classification identity extraction
pnpm test:integration -- acquisition classification identity extraction
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm verify
git diff --check
```

The implementation review must also verify exact fixture counts, migration `001`/`002` hashes, approved authority
hashes, zero skipped tests, zero unsafe source execution, zero secret/contact leakage, recovery/dump-restore results,
all staged/unstaged/untracked files, and the whole branch diff against local `main`. A source-only fresh checkout
must reproduce the complete gate. An unrun or empty gate is `UNPROVEN`.

## 28. Specification review gates

Before human approval, the exact candidate bytes require:

1. authority-chain and M03 handoff review;
2. EvidenceItem/Claim/status/mapping completeness review;
3. M01→M04 lineage and cryptographic closure review;
4. persistence schema, transaction, idempotency, concurrency, and recovery review;
5. migration runner, drift detection, and forward-only rollback review;
6. material completeness and M05 boundary review;
7. prompt-injection, source-execution, secrets, privacy, and observability review;
8. acceptance-to-test traceability review;
9. Markdown formatting, Git diff, and secret/personal-data scan; and
10. a genuinely independent read-only verdict over the exact whole-file SHA-256.

Any blocker requires spec-only remediation and a new independent review of the new exact bytes. Review evidence is
not human approval and grants no implementation or publication authority.

## 29. GO / NO-GO rules

`GO — M04 SPECIFICATION READY FOR HUMAN APPROVAL` requires every Section 28 gate and an independent read-only GO
over the exact bytes. It does not authorize implementation.

After exact-SHA human approval and separate implementation authorization, `GO — M04 COMMIT READY` requires the
complete scoped implementation, all Section 27 gates, M00–M03 regressions, migration/recovery evidence, a fresh
checkout replay, whole-diff review, and independent whole-patch GO.

Any failed or unrun required gate, evidence-closure defect, stale lineage, collision ambiguity, non-atomic write,
migration drift, mutable canonical record, source execution, secret/contact leak, invented evidence, silent
conflict, automatic approval/publication, or M05+ expansion is `NO-GO`.

## 30. Human approval boundary

The next permitted terminal action is to report:

1. the exact whole-file SHA-256 of `docs/milestones/M04_SPEC.md`;
2. the independent review verdict and findings;
3. the documentation-only diff and validation evidence; and
4. an explicit request for human approval of those exact bytes.

Only an explicit human statement approving that exact SHA-256 changes this specification from candidate to
approved. Implementation still requires separate authorization. Commit, push, PR, merge, release, deployment,
production migration, publication, and M05+ remain separate boundaries.
